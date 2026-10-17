"""Validate the private agent golden set and score recorded tool traces."""

import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CASES = ROOT / "eval" / "agent_cases.v0.jsonl"
VALID_DIFFICULTIES = {"easy", "medium", "hard"}
REQUIRED_FIELDS = {
    "id", "user_input", "reference", "reference_contexts", "expected_tool", "expected_params",
    "category", "difficulty", "tags", "reviewed_by", "version",
}
REGISTERED_TOOLS = {
    "search_gold_knowledge", "search_vehicles", "lookup_car_color_options", "lookup_province_fees",
    "calculate_vehicle_tco", "get_eligible_promotions", "price_vehicle_configuration",
    "estimate_vehicle_installment", "get_quote_status",
}


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def validate_cases(cases: list[dict]) -> None:
    ids = set()
    errors = []
    for line_number, case in enumerate(cases, 1):
        missing = REQUIRED_FIELDS - case.keys()
        if missing:
            errors.append(f"line {line_number}: missing fields {sorted(missing)}")
        case_id = case.get("id")
        if not case_id or case_id in ids:
            errors.append(f"line {line_number}: missing or duplicate id {case_id!r}")
        ids.add(case_id)
        if case.get("difficulty") not in VALID_DIFFICULTIES:
            errors.append(f"{case_id}: invalid difficulty")
        if not isinstance(case.get("reference_contexts"), list) or not case["reference_contexts"]:
            errors.append(f"{case_id}: reference_contexts must be a non-empty list")
        if not isinstance(case.get("expected_params"), dict):
            errors.append(f"{case_id}: expected_params must be an object")
        assertions = case.get("business_assertions", [])
        if not isinstance(assertions, list):
            errors.append(f"{case_id}: business_assertions must be a list")
        else:
            for assertion in assertions:
                if (not isinstance(assertion, dict) or not {"id", "path", "operator"} <= assertion.keys()
                        or assertion.get("operator") not in {"equals", "contains", "truthy"}):
                    errors.append(f"{case_id}: invalid business assertion")
        tool_name = case.get("expected_tool")
        if tool_name is not None and tool_name not in REGISTERED_TOOLS:
            errors.append(f"{case_id}: expected tool is not registered: {tool_name}")
    adversarial = sum("adversarial" in case.get("tags", []) for case in cases)
    if cases and adversarial / len(cases) < 0.10:
        errors.append("adversarial cases must be at least 10% of the set")
    if errors:
        raise ValueError("\n".join(errors))


def matches_expected(actual, expected) -> bool:
    """Match expected parameter values recursively; expected dicts may be a subset."""
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(
            key in actual and matches_expected(actual[key], value) for key, value in expected.items()
        )
    return actual == expected


def matches_expected_calls(calls: list[dict], expected: dict) -> bool:
    for key, value in expected.items():
        actual_values = [call.get("args", {}).get(key) for call in calls]
        if key == "query" and isinstance(value, str):
            if not any(isinstance(actual, str) and actual.strip() for actual in actual_values):
                return False
            continue
        if key == "accessories" and value == [] and all(actual in (None, []) for actual in actual_values):
            continue
        if isinstance(value, list):
            combined = []
            for actual in actual_values:
                if isinstance(actual, list):
                    combined.extend(actual)
            if not all(item in combined for item in value):
                return False
        elif not any(matches_expected(actual, value) for actual in actual_values):
            return False
    return True


def score_case(case: dict, observation: dict) -> dict:
    calls = observation.get("tool_calls") or []
    expected_tool = case["expected_tool"]
    if expected_tool is None:
        # A deterministic refusal/limitation is a successful terminal outcome,
        # unlike an infrastructure/runtime error such as UndefinedTable.
        terminal = observation.get("error") in {"out_of_scope", "safe_limitation", "clarification_required"}
        selection_ok = len(calls) == 0 and (not observation.get("error") or terminal)
        params_ok = selection_ok
    else:
        matching_calls = [call for call in calls if call.get("name") == expected_tool]
        selection_ok = bool(matching_calls)
        params_ok = selection_ok and matches_expected_calls(matching_calls, case["expected_params"])
    return {"tool_selection": selection_ok, "parameter_accuracy": params_ok}


def business_assertions(case: dict, observation: dict) -> dict | None:
    """Score only explicit, reviewed checks; absent checks remain unmeasured."""
    assertions = case.get("business_assertions", [])
    if not assertions:
        return None
    if "facts" not in observation and all(item["path"].startswith("facts.") for item in assertions):
        # Legacy traces lack the required instrumentation; do not invent a score.
        return None
    outcomes = {}
    for assertion in assertions:
        value = observation
        for key in assertion["path"].split("."):
            value = value.get(key) if isinstance(value, dict) else None
        operator = assertion["operator"]
        expected = assertion.get("value")
        if operator == "equals":
            passed = value == expected
        elif operator == "contains":
            passed = isinstance(value, (str, list, dict)) and expected in value
        elif operator == "truthy":
            passed = bool(value)
        else:
            raise ValueError(f"unsupported business assertion operator: {operator}")
        outcomes[assertion["id"]] = passed
    return outcomes


def percentile(values: list[float], fraction: float) -> float | None:
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)] if values else None


def output_failed(output: dict) -> bool:
    if output.get("status") == "error":
        return True
    content = output.get("content", "")
    if not isinstance(content, str):
        content = json.dumps(content, ensure_ascii=False)
    if content.lstrip().startswith("Error:") or "UndefinedTable" in content:
        return True
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return False
    return isinstance(payload, dict) and bool(payload.get("error"))


def aggregate(cases: list[dict], observations: list[dict]) -> dict:
    by_id = {item["id"]: item for item in observations}
    rows = []
    for case in cases:
        observation = by_id.get(case["id"], {})
        scores = score_case(case, observation)
        rows.append({**case, **scores, "observed": case["id"] in by_id})

    def rates(items):
        observed = [item for item in items if item["observed"]]
        if not observed:
            return {"n": 0, "tool_selection_accuracy": None, "parameter_accuracy": None,
                    "tool_outputs": 0, "failed_tool_outputs": 0, "tool_call_success_rate": None}
        outputs = [output for item in observed for output in by_id[item["id"]].get("tool_outputs", [])]
        failures = sum(output_failed(output) for output in outputs)
        raw_scores = [score_case(item, {**by_id[item["id"]], "tool_calls":
                      by_id[item["id"]].get("raw_tool_calls", by_id[item["id"]].get("tool_calls", []))})
                      for item in observed]
        resolved_items = [item for item in observed if "resolved_tool_calls" in by_id[item["id"]]]
        resolved_scores = [score_case(item, {**by_id[item["id"]], "tool_calls":
                           by_id[item["id"]]["resolved_tool_calls"]}) for item in resolved_items]
        outcomes = [result for item in observed
                    if (result := business_assertions(item, by_id[item["id"]])) is not None]
        latencies = [by_id[item["id"]]["latency_ms"] for item in observed
                     if isinstance(by_id[item["id"]].get("latency_ms"), (int, float))]
        return {
            "n": len(observed),
            "tool_selection_accuracy": sum(item["tool_selection"] for item in observed) / len(observed),
            "parameter_accuracy": sum(item["parameter_accuracy"] for item in observed) / len(observed),
            "tool_outputs": len(outputs),
            "failed_tool_outputs": failures,
            "tool_call_success_rate": (len(outputs) - failures) / len(outputs) if outputs else None,
            "raw_parameter_accuracy": sum(item["parameter_accuracy"] for item in raw_scores) / len(raw_scores),
            "resolved_parameter_accuracy": (sum(item["parameter_accuracy"] for item in resolved_scores)
                                            / len(resolved_scores)) if resolved_scores else None,
            "resolved_observations": len(resolved_items),
            "business_outcome_accuracy": (sum(all(outcome.values()) for outcome in outcomes) / len(outcomes))
                                         if outcomes else None,
            "business_cases_scored": len(outcomes),
            "mean_latency_ms": sum(latencies) / len(latencies) if latencies else None,
            "p95_latency_ms": percentile(latencies, .95),
            "mean_tool_calls": sum(len(by_id[item["id"]].get("tool_calls", [])) for item in observed) / len(observed),
        }

    groups = defaultdict(list)
    for row in rows:
        groups[f"category:{row['category']}"].append(row)
        groups[f"difficulty:{row['difficulty']}"].append(row)
        if "adversarial" in row.get("tags", []):
            groups["adversarial"].append(row)
    failed_cases = []
    for row in rows:
        if not row["observed"]:
            continue
        observation = by_id[row["id"]]
        modes = [name for name in ("tool_selection", "parameter_accuracy") if not row[name]]
        checks = business_assertions(row, observation)
        if checks:
            modes.extend(name for name, passed in checks.items() if not passed)
        if any(output_failed(output) for output in observation.get("tool_outputs", [])):
            modes.append("tool_execution")
        if modes:
            failed_cases.append({"id": row["id"], "failure_modes": modes})
    return {"overall": rates(rows), "groups": {key: rates(value) for key, value in sorted(groups.items())},
            "failed_cases": failed_cases,
            "unobserved_ids": [row["id"] for row in rows if not row["observed"]]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--observations", type=Path, help="JSONL agent traces; does not run the agent")
    parser.add_argument("--validate-only", action="store_true", help="Validate cases and print set summary")
    args = parser.parse_args()
    if not args.validate_only and args.observations is None:
        parser.error("pass --validate-only or --observations PATH")
    try:
        cases = read_jsonl(CASES)
        validate_cases(cases)
        if args.validate_only:
            adversarial = sum("adversarial" in case["tags"] for case in cases)
            print(json.dumps({"cases": len(cases), "adversarial": adversarial,
                              "adversarial_rate": adversarial / len(cases)}, indent=2))
            return 0
        observations = read_jsonl(args.observations)
        duplicate_ids = len({item.get("id") for item in observations}) != len(observations)
        if duplicate_ids:
            raise ValueError("observations contain duplicate case ids; store separate runs as separate files")
        unknown = {item.get("id") for item in observations} - {case["id"] for case in cases}
        if unknown:
            raise ValueError(f"observations contain unknown case ids: {sorted(unknown)}")
        if {item.get("id") for item in observations} != {case["id"] for case in cases}:
            raise ValueError("observations are incomplete; run every case before reporting benchmark accuracy")
        print(json.dumps(aggregate(cases, observations), ensure_ascii=False, indent=2))
        return 0
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
