from scripts.eval.score_agent_cases import aggregate, read_jsonl, score_case, validate_cases


def test_private_agent_case_set_is_valid_and_adversarially_stratified():
    cases = read_jsonl(__import__("pathlib").Path("eval/agent_cases.v0.jsonl"))
    validate_cases(cases)
    assert len(cases) == 25
    assert sum("adversarial" in case["tags"] for case in cases) == 5


def test_trace_scorer_checks_tool_name_and_expected_parameter_subset():
    case = {
        "expected_tool": "search_vehicles",
        "expected_params": {"vehicle_queries": ["VF 6"], "fields": ["price"]},
    }
    correct = {"tool_calls": [{"name": "search_vehicles", "args": {
        "vehicle_queries": ["VF 6"], "fields": ["price"], "budget_million": None,
    }}, {"name": "search_gold_knowledge", "args": {"query": "extra context"}}]}
    wrong_tool = {"tool_calls": [{"name": "lookup_car_color_options", "args": {"vehicle_queries": ["VF 6"]}}]}
    wrong_params = {"tool_calls": [{"name": "search_vehicles", "args": {
        "vehicle_queries": ["VF 8"], "fields": ["price"],
    }}]}

    assert score_case(case, correct) == {"tool_selection": True, "parameter_accuracy": True}
    assert score_case(case, wrong_tool) == {"tool_selection": False, "parameter_accuracy": False}
    assert score_case(case, wrong_params) == {"tool_selection": True, "parameter_accuracy": False}


def test_expected_list_parameters_can_be_split_across_repeated_calls():
    case = {"expected_tool": "search_vehicles", "expected_params": {
        "vehicle_queries": ["VF 5", "VF 6"], "fields": ["price"],
    }}
    observation = {"tool_calls": [
        {"name": "search_vehicles", "args": {"vehicle_queries": ["VF 5"], "fields": ["price"]}},
        {"name": "search_vehicles", "args": {"vehicle_queries": ["VF 6"], "fields": ["overview", "price"]}},
    ]}

    assert score_case(case, observation) == {"tool_selection": True, "parameter_accuracy": True}


def test_rag_query_is_presence_checked_not_exact_phrase_matched():
    case = {"expected_tool": "search_gold_knowledge", "expected_params": {
        "query": "VF 6 quãng đường di chuyển", "category": "thong_so_va_chon_xe",
    }}
    observation = {"tool_calls": [{"name": "search_gold_knowledge", "args": {
        "query": "VF 6 đi được bao xa", "category": "thong_so_va_chon_xe",
    }}]}

    assert score_case(case, observation) == {"tool_selection": True, "parameter_accuracy": True}


def test_null_expected_tool_requires_no_tool_call():
    case = {"expected_tool": None, "expected_params": {}}

    assert score_case(case, {"tool_calls": []}) == {"tool_selection": True, "parameter_accuracy": True}
    assert score_case(case, {"tool_calls": [], "error": "UndefinedTable"}) == {
        "tool_selection": False, "parameter_accuracy": False,
    }
    assert score_case(case, {"tool_calls": [], "error": "out_of_scope"}) == {
        "tool_selection": True, "parameter_accuracy": True,
    }
    assert score_case(case, {"tool_calls": [{"name": "search_vehicles", "args": {}}]}) == {
        "tool_selection": False, "parameter_accuracy": False,
    }


def test_aggregate_reports_metrics_and_unobserved_cases():
    cases = [
        {"id": "a", "expected_tool": "search_vehicles", "expected_params": {"query": "VF 6"},
         "category": "catalog", "difficulty": "easy", "tags": []},
        {"id": "b", "expected_tool": None, "expected_params": {},
         "category": "out_of_scope", "difficulty": "hard", "tags": ["adversarial"]},
    ]
    result = aggregate(cases, [{"id": "a", "tool_calls": [{"name": "search_vehicles", "args": {"query": "VF 6"}}]}])

    assert {key: result["overall"][key] for key in (
        "n", "tool_selection_accuracy", "parameter_accuracy", "tool_outputs", "failed_tool_outputs", "tool_call_success_rate",
    )} == {
        "n": 1, "tool_selection_accuracy": 1.0, "parameter_accuracy": 1.0,
        "tool_outputs": 0, "failed_tool_outputs": 0, "tool_call_success_rate": None,
    }
    assert result["unobserved_ids"] == ["b"]


def test_aggregate_reports_tool_execution_failures():
    cases = [{"id": "a", "expected_tool": "search_vehicles", "expected_params": {},
              "category": "catalog", "difficulty": "easy", "tags": []}]
    observations = [{"id": "a", "tool_calls": [{"name": "search_vehicles", "args": {}}],
                     "tool_outputs": [{"name": "search_vehicles", "content": "Error: UndefinedTable"}]}]

    result = aggregate(cases, observations)

    assert result["overall"]["tool_outputs"] == 1
    assert result["overall"]["failed_tool_outputs"] == 1
    assert result["overall"]["tool_call_success_rate"] == 0.0


def test_raw_and_resolved_metrics_and_explicit_business_outcomes():
    case = {"id": "price", "expected_tool": "price_vehicle_configuration", "expected_params": {"model": "VF 6"},
            "category": "pricing", "difficulty": "easy", "tags": [],
            "business_assertions": [{"id": "total", "path": "facts.final_price", "operator": "equals", "value": 100}]}
    observation = {"id": "price", "tool_calls": [{"name": "price_vehicle_configuration", "args": {"model": "VF 6"}}],
                   "raw_tool_calls": [{"name": "price_vehicle_configuration", "args": {"model": "VF6"}}],
                   "resolved_tool_calls": [{"name": "price_vehicle_configuration", "args": {"model": "VF 6"}}],
                   "latency_ms": 200, "facts": {"final_price": 101}}
    report = aggregate([case], [observation])
    assert report["overall"]["raw_parameter_accuracy"] == 0
    assert report["overall"]["resolved_parameter_accuracy"] == 1
    assert report["overall"]["business_outcome_accuracy"] == 0
    assert report["overall"]["p95_latency_ms"] == 200
    assert report["failed_cases"] == [{"id": "price", "failure_modes": ["total"]}]
    del case["business_assertions"]
    assert aggregate([case], [observation])["overall"]["business_outcome_accuracy"] is None
