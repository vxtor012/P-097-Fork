import json
from pathlib import Path

import pytest

from scripts.eval.score_agent_cases import (
    CASES, case_set_sha256, fact_matches, load_cases, params_match, score_code, validate, validate_run_manifest,
)
from scripts.eval.audit_agent_cases import check_reference_context


def observation(**overrides):
    return {"tool_calls": [], "tool_outputs": [], "answer": "", "error": None, **overrides}


def test_v1_case_set_is_valid_and_adversarially_stratified():
    cases = load_cases()
    assert CASES == Path("eval/agent_cases.v1.jsonl").resolve()
    assert validate(cases) == []
    assert len(cases) == 65
    assert sum("adversarial" in case["tags"] for case in cases) == 19


def test_expected_list_parameters_can_be_split_across_calls():
    calls = [
        {"name": "search_vehicles", "args": {"vehicle_queries": ["VF 5"], "fields": ["price"]}},
        {"name": "search_vehicles", "args": {"vehicle_queries": ["VF 6"], "fields": ["price", "overview"]}},
    ]
    assert params_match({"vehicle_queries": ["VF 5", "VF 6"], "fields": ["price"]}, calls)


def test_rag_query_is_presence_checked_but_category_is_checked():
    calls = [{"name": "search_gold_knowledge", "args": {
        "query": "VF 6 di duoc bao xa", "category": "pin_va_tram_sac",
    }}]
    assert params_match({"query": "VF 6 quang duong", "category": "pin_va_tram_sac"}, calls)
    assert not params_match({"query": "VF 6 quang duong", "category": "bao_gia_chi_phi"}, calls)


def test_oracle_aliases_and_power_units_are_normalized():
    assert params_match({"vehicle_queries": ["VF 3 Eco"]}, [{
        "name": "search_vehicles", "args": {"vehicle_queries": ["VF 3 Tiêu chuẩn"]},
    }])
    assert fact_matches("260", "Công suất tối đa 349 hp (xấp xỉ 260 kW).")


def test_score_code_checks_tool_parameters_forbidden_tools_and_facts():
    case = {
        "expected_tool": "search_vehicles", "expected_params": {"vehicle_queries": ["VF 6"], "fields": ["price"]},
        "expected_behavior": "tool_call", "forbidden_tools": ["search_gold_knowledge"], "expected_facts": ["675 trieu"],
    }
    result = score_code(case, observation(answer="Gia tu 675 trieu dong.", tool_calls=[
        {"name": "search_vehicles", "args": {"vehicle_queries": ["VF 6"], "fields": ["price"]}},
    ]))
    assert result["tool_ok"] is True
    assert result["param_ok"] is True
    assert result["forbidden_ok"] is True
    assert result["facts_ok"] is True
    assert result["pass_code"] is True


def test_score_code_requires_a_real_clarification_when_no_tool_is_expected():
    case = {"expected_tool": None, "expected_params": {}, "expected_behavior": "clarify"}
    assert score_code(case, observation(answer="Ban muon dang ky tai tinh nao?"))["pass_code"] is True
    assert score_code(case, observation(answer="Toi se tinh ngay."))["pass_code"] is False


def test_pricing_assertions_are_unmeasured_for_legacy_trace_and_checked_when_present():
    case = {
        "expected_tool": "price_vehicle_configuration", "expected_params": {"model": "VF 6"},
        "expected_behavior": "tool_call",
        "business_assertions": [
            {"id": "total", "path": "facts.pricing_total_matches_tool", "operator": "equals", "value": True},
            {"id": "hash", "path": "facts.pricing_hash_present", "operator": "truthy"},
        ],
    }
    call = {"name": "price_vehicle_configuration", "args": {"model": "VF 6"}}
    assert score_code(case, observation(tool_calls=[call]))["business_assertions_ok"] is None
    passed = score_code(case, observation(tool_calls=[call], facts={"pricing_total_matches_tool": True, "pricing_hash_present": True}))
    failed = score_code(case, observation(tool_calls=[call], facts={"pricing_total_matches_tool": False, "pricing_hash_present": True}))
    assert passed["business_assertions_ok"] is True
    assert passed["pass_code"] is True
    assert failed["business_assertions_ok"] is False
    assert failed["pass_code"] is False


def test_generated_cases_are_jsonl_and_have_unique_ids():
    rows = [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert [row["id"] for row in rows] == list(dict.fromkeys(row["id"] for row in rows))


def test_scorer_requires_a_complete_matching_run_manifest(tmp_path):
    cases = [{"id": "a"}]
    (tmp_path / "run-1.jsonl").write_text('{"id":"a"}\n', encoding="utf-8")
    with pytest.raises(ValueError, match="manifest"):
        validate_run_manifest(tmp_path, cases)

    (tmp_path / "manifest.json").write_text(json.dumps({
        "status": "complete", "case_set_sha256": case_set_sha256(cases), "selected_case_ids": ["a"],
    }), encoding="utf-8")
    assert validate_run_manifest(tmp_path, cases)["status"] == "complete"

    (tmp_path / "run-2.jsonl.partial").write_text("", encoding="utf-8")
    with pytest.raises(ValueError, match="partial"):
        validate_run_manifest(tmp_path, cases)


def test_reference_audit_separates_trim_rename_from_missing_data():
    sources = {"vehicle_specs.csv": ("vf 6 tieu chuan 485 km", "vf 6 base-trim 485 km")}
    renamed = check_reference_context("vehicle_specs.csv | VF 6 | Eco | range = 485 km", sources)
    missing = check_reference_context("vehicle_specs.csv | VF 6 | Eco | range = 999 km", sources)
    assert renamed["status"] == "renamed_by_trim_alias"
    assert missing["status"] == "missing_or_changed_in_local_source"


def test_case_validation_rejects_unknown_oracle_kind():
    case = {
        "id": "bad-oracle", "user_input": "x", "reference": "x", "reference_contexts": ["x"],
        "expected_tool": None, "expected_params": {}, "category": "x", "difficulty": "easy",
        "tags": [], "reviewed_by": "pending", "version": "v1.1", "oracle_kind": "tool_magic",
    }
    assert "invalid oracle_kind" in "\n".join(validate([case]))
