import json
import unicodedata

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool

from src.agents.graph import (
    CONTACT_MESSAGE,
    _is_clarification,
    _is_repeat_call,
    _is_stall,
    _last_tool_errored,
    _profile_from_tool_calls,
    _ungrounded_amounts,
    build_graph,
    prefilter,
)
from src.agents.tools import vinfast_tools as vt


class FakeChatModel:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.prompts = []

    def bind_tools(self, tools):
        return self

    def invoke(self, messages):
        self.prompts.append(messages)
        return next(self.responses)


@pytest.mark.asyncio
async def test_agent_may_ask_clarifying_question(monkeypatch):
    fake = FakeChatModel([AIMessage(content="Bạn muốn tính chi phí lăn bánh ở tỉnh/thành nào và trong bao nhiêu năm?")])
    monkeypatch.setattr("src.agents.graph.get_llm", lambda: fake)
    result = await build_graph(tools=[]).ainvoke(
        {"query": "Chi phí lăn bánh VF 6 Plus?"}, {"configurable": {"thread_id": "clarify"}})
    assert result["response"].endswith("năm?")
    assert result["response"] != CONTACT_MESSAGE
    assert len(fake.prompts) == 1


@pytest.mark.asyncio
async def test_step_cap_synthesizes_from_tool_results(monkeypatch):
    @tool
    def lookup(query: str) -> str:
        """Lookup."""
        return json.dumps({"matched_versions": [{"price_vnd": 699_000_000, "price_text": "699 triệu đồng"}]})

    calls = [AIMessage(content="", tool_calls=[{"name": "lookup", "args": {"query": f"q{i}"}, "id": f"c{i}"}]) for i in range(6)]
    fake = FakeChatModel(calls + [AIMessage(content="VF 6 Plus giá 699 triệu đồng.")])
    monkeypatch.setattr("src.agents.graph.get_llm", lambda: fake)
    result = await build_graph(tools=[lookup]).ainvoke(
        {"query": "Giá VF 6 Plus?"}, {"configurable": {"thread_id": "cap"}})
    assert result["response"] == "VF 6 Plus giá 699 triệu đồng."
    # lời gọi synthesis không được chứa tool_calls mồ côi ở cuối
    last_prompt = fake.prompts[-1]
    assert not (isinstance(last_prompt[-1], AIMessage) and last_prompt[-1].tool_calls)


def test_repeat_call_detected():
    args = {"vehicle_queries": ["VF 6"]}
    messages = [
        HumanMessage(content="Giá VF 6?"),
        AIMessage(content="", tool_calls=[{"name": "search_vehicles", "args": args, "id": "1"}]),
        ToolMessage(content="{}", tool_call_id="1"),
        AIMessage(content="", tool_calls=[{"name": "search_vehicles", "args": args, "id": "2"}]),
    ]
    assert _is_repeat_call(messages)


def test_soft_tool_error_is_detected():
    messages = [HumanMessage(content="x"), ToolMessage(content=json.dumps({"error": "Không tìm thấy"}), tool_call_id="1")]
    assert _last_tool_errored(messages)


def test_money_guard_knows_color_and_fee_fields():
    messages = [
        HumanMessage(content="Giá màu đỏ?"),
        ToolMessage(content=json.dumps({"color_options": [{"total_car_price_vnd": 293_000_000, "extra_price_vnd": 8_000_000}]}),
                    tool_call_id="1"),
    ]
    assert _ungrounded_amounts("Tổng xe 293 triệu đồng, phụ phí màu 8 triệu đồng.", messages) == []


def test_money_guard_checks_followup_without_tools():
    messages = [HumanMessage(content="Vậy bản cao nhất thì sao?")]
    assert _ungrounded_amounts("Bản cao nhất giá 1,2 tỷ đồng.", messages) == ["1,2 tỷ"]


def test_money_guard_accepts_number_grounded_in_earlier_turn_tool():
    messages = [
        HumanMessage(content="Giá VF 6?"),
        ToolMessage(content=json.dumps({"matched_versions": [{"price_vnd": 699_000_000}]}), tool_call_id="1"),
        AIMessage(content="VF 6 giá 699 triệu đồng."),
        HumanMessage(content="Nhắc lại giá giúp mình"),
    ]
    assert _ungrounded_amounts("Giá là 699 triệu đồng.", messages) == []


def test_profile_ignores_values_model_invented():
    messages = [
        HumanMessage(content="Tư vấn VF 6 giúp mình"),
        AIMessage(content="", tool_calls=[{"name": "search_vehicles", "args": {"vehicle_queries": ["VF 6"], "seats": 7}, "id": "1"}]),
    ]
    assert _profile_from_tool_calls(messages, {}) == {"vehicles": ["VF 6"]}


def test_stall_regex_does_not_hit_valid_answer():
    assert not _is_stall("Nếu bạn sẽ xem thêm phiên bản Plus, giá niêm yết là 699 triệu đồng và có nhiều màu ngoại thất để chọn.")
    assert _is_stall("Để mình tra cứu giúp bạn nhé")


def test_clarification_requires_no_money():
    assert _is_clarification("Bạn ở tỉnh nào?")
    assert not _is_clarification("VF 6 giá 800 triệu, đúng không?")


def test_prefilter_normalizes_nfd_question():
    nfd = unicodedata.normalize("NFD", "Giá VF 6 bao nhiêu?")
    assert prefilter({"question": nfd})["question"] == "Giá VF 6 bao nhiêu?"


# ---------- tools ----------

def test_resolve_is_precise():
    for query in ("VinFast VF 6 Plus", "VF6 bản Plus"):
        found, unmatched = vt._resolve([query])
        assert [v["edition"] for v in found] == ["VF6 Plus"] and not unmatched
    models = {v["model_name"] for v in vt._resolve(["VF 8"])[0]}
    assert models == {"VF 8"}


def test_resolve_unknown_edition_is_reported():
    found, unmatched = vt._resolve(["VF 6 Ultra"])
    assert found and unmatched


def test_colors_join_variant_trim_codes():
    catalog, _, _ = vt._load_data()
    ec_van = next(v for v in catalog if "PAK2" in v["edition"])
    assert ec_van["colors"] and ec_van["colors_inferred_from_base_trim"]


def test_unavailable_colors_are_not_offered():
    result = json.loads(vt.lookup_car_color_options.invoke({"vehicle_queries": ["VF 2"]}))
    assert result["color_options"] == []
    assert result["unavailable_color_options"]
    assert result["notes"]


def test_color_prices_use_single_price_source():
    result = json.loads(vt.search_vehicles.invoke({"vehicle_queries": ["EC Van"], "fields": ["price", "colors"]}))
    for version in result["matched_versions"]:
        for color in version["exterior_colors"]:
            assert color["total_car_price_vnd"] == version["price_vnd"] + color["extra_price_vnd"]


def test_search_vehicles_flags_missing_spec_data():
    result = json.loads(vt.search_vehicles.invoke({"vehicle_queries": ["VF 6"], "seats": 7, "fields": ["performance"]}))
    assert result["matched_versions"]
    assert any("search_gold_knowledge" in note for note in result["notes"])


def test_province_aliases():
    assert json.loads(vt.lookup_province_fees.invoke({"province": "Sài Gòn"}))["fees"]["province"] == "TP. Hồ Chí Minh"
    assert json.loads(vt.lookup_province_fees.invoke({"province": "Huế"}))["fees"]["province"] == "Thừa Thiên Huế"
    unknown = json.loads(vt.lookup_province_fees.invoke({"province": "Atlantis"}))
    assert "error" in unknown and unknown["valid_candidates"]


def test_tco_requires_years_and_known_location():
    missing_years = json.loads(vt.calculate_vehicle_tco.invoke({"vehicle_queries": ["VF 6 Plus"], "location": "Hà Nội"}))
    assert missing_years["status"] == "need_input" and missing_years["missing"] == ["years"]
    bad = json.loads(vt.calculate_vehicle_tco.invoke({"vehicle_queries": ["VF 6 Plus"], "location": "Atlantis", "years": 5}))
    assert "error" in bad
    ok = json.loads(vt.calculate_vehicle_tco.invoke({"vehicle_queries": ["VF 6 Plus"], "location": "Sài Gòn", "years": 5}))
    assert ok["tco"][0]["location"] == "TP. Hồ Chí Minh"


def test_promotions_without_data_do_not_claim_none(monkeypatch):
    catalog, rolling, _ = vt._load_data()
    monkeypatch.setattr(vt, "_load_data", lambda: (catalog, rolling, None))
    result = json.loads(vt.get_eligible_promotions.invoke({"vehicle_queries": ["VF 6 Plus"]}))
    assert result["status"] == "data_unavailable"
    assert "programs" not in result


def _promo(vehicle, **kwargs):
    result = json.loads(vt.get_eligible_promotions.invoke({"vehicle_queries": [vehicle], **kwargs}))
    return result, result["vehicles"][0]["programs"] if result["vehicles"] else []


def test_promotions_need_user_inputs_when_unknown():
    result, programs = _promo("VF 6 Plus")
    required = {item["name"]: item["requires"] for item in result["conditional_promotions"]}
    assert programs == []
    assert set(required.values()) == {"vinclub_tier", "customer_group", "purchase_channel"}


def test_promotion_vinclub_tier_discount_and_points():
    price = vt._resolve(["VF 6 Plus"])[0][0]["price_vnd"]
    _, programs = _promo("VF 6 Plus", vinclub_tier="platinum")
    platinum = next(p for p in programs if p["name"] == "Hạng Platinum")
    assert platinum["discount_vnd"] == round(price * 0.03)
    assert platinum["loyalty_points"]["value_vnd"] == round(price * 0.03)


def test_promotion_green_switch_voucher_values():
    _, programs = _promo("VF 6 Plus", customer_group="green_switch")
    voucher = programs[0]
    assert voucher["valid_to"] == "2026-12-31"
    assert {v["value_vnd"] for v in voucher["voucher_values"]} == {30_000_000, 60_000_000, 80_000_000}
    assert "discount_vnd" not in voucher


def test_promotion_values_pass_money_guard():
    from src.agents.graph import _ungrounded_amounts
    raw = vt.get_eligible_promotions.invoke({"vehicle_queries": ["VF 6 Plus"], "customer_group": "green_switch"})
    messages = [HumanMessage(content="Tôi đổi xe xăng sang xe điện"), ToolMessage(content=raw, tool_call_id="1")]
    assert _ungrounded_amounts("Voucher cho chủ xe Lux SA2.0 là 80 triệu đồng.", messages) == []
    assert _ungrounded_amounts("Voucher cho chủ xe Lux SA2.0 là 95 triệu đồng.", messages) == ["95 triệu"]


def test_rag_category_is_enum_and_falls_back(monkeypatch):
    from src.agents.tools import rag
    monkeypatch.setattr(rag, "_embed_query", lambda q: [1.0] + [0.0] * 1535)
    monkeypatch.setattr(rag, "_retrieve", lambda vec, top_k=5, category=None: [] if category else [{"id": "x"}])
    result = json.loads(rag.search_gold_knowledge.invoke({"query": "pin", "category": "pin_va_tram_sac"}))
    assert result["results"] == [{"id": "x"}]
    with pytest.raises(Exception):
        rag.search_gold_knowledge.invoke({"query": "pin", "category": "pin"})


def test_interior_question_is_routed_to_rag():
    from src.agents.graph import _guard_reason
    reason, nudge = _guard_reason("Nội thất VF 6 màu gì?", "Nội thất màu be.", [HumanMessage(content="Nội thất VF 6 màu gì?")])
    assert reason == "interior_no_rag" and "search_gold_knowledge" in nudge


def test_interior_answer_with_rag_result_gets_confirmation_note(monkeypatch):
    import asyncio
    from src.agents.graph import build_graph

    @tool
    def search_gold_knowledge(query: str) -> str:
        """Fake RAG."""
        return json.dumps({"results": [{"id": "x", "content": "Nội thất đen"}]})

    fake = FakeChatModel([
        AIMessage(content="", tool_calls=[{"name": "search_gold_knowledge", "args": {"query": "nội thất VF 6"}, "id": "1"}]),
        AIMessage(content="VF 6 có nội thất màu đen theo tài liệu."),
    ])
    monkeypatch.setattr("src.agents.graph.get_llm", lambda: fake)
    result = asyncio.run(build_graph(tools=[search_gold_knowledge]).ainvoke(
        {"query": "Nội thất VF 6 màu gì?"}, {"configurable": {"thread_id": "interior"}}))
    assert "xác nhận với đại lý" in result["response"]
