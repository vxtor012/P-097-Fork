"""Summarize complete repeated agent runs without treating runs as independent items."""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.eval.score_agent_cases import CASES, aggregate, read_jsonl, validate_cases  # noqa: E402


def summarize(directory: Path) -> dict:
    cases = read_jsonl(CASES)
    validate_cases(cases)
    expected = {case["id"] for case in cases}
    paths = sorted(directory.glob("run-*.jsonl"))
    if not paths:
        raise ValueError(f"No run files in {directory}")
    reports = {}
    per_item = defaultdict(list)
    for path in paths:
        observations = read_jsonl(path)
        ids = [row["id"] for row in observations]
        if set(ids) != expected or len(ids) != len(expected):
            raise ValueError(f"Incomplete, unknown or duplicate cases in {path}")
        reports[path.name] = aggregate(cases, observations)
        for row in observations:
            per_item[row["id"]].append(row["latency_ms"])
    keys = ("tool_selection_accuracy", "parameter_accuracy", "raw_parameter_accuracy",
            "resolved_parameter_accuracy", "tool_call_success_rate", "mean_latency_ms")
    mean_rates = {}
    for key in keys:
        values = [report["overall"][key] for report in reports.values() if report["overall"].get(key) is not None]
        mean_rates[key] = sum(values) / len(values) if values else None
    return {"directory": str(directory), "runs": len(paths), "cases": len(cases),
            "mean_run_metrics": mean_rates, "per_run": reports,
            "per_item_mean_latency_ms": {key: sum(values) / len(values) for key, values in per_item.items()},
            "limitations": ["P95 is reported separately for each run/category using nearest rank.",
                            "No statistical significance is inferred from repeated runs.",
                            "Business assertions measure only explicitly configured case checks.",
                            "TTFT is unavailable in the non-streaming runner."]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        report = summarize(args.run_dir)
        rendered = json.dumps(report, ensure_ascii=False, indent=2)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(rendered + "\n", encoding="utf-8")
        print(rendered)
        return 0
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    raise SystemExit(main())
