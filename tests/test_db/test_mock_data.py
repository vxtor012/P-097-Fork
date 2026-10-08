from copy import deepcopy
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from scripts.db import mock_data as mock


@pytest.fixture
def catalog():
    uid = mock.identifier
    return {
        "dealers": [{"id": uid("dealer"), "name": "Đại lý Demo", "province": "Hà Nội", "is_active": True}],
        "vehicle_prices": [{"id": uid("price"), "model": "VF6", "version": "Plus", "color": "Trắng",
            "color_hex": "#FFFFFF", "price": 1000, "price_version": "source-v1", "effective_to": None,
            "effective_from": "2025-01-01T00:00:00"}],
        "battery_prices": [{"model": "VF6", "buy_price": 100, "rent_price": 10}],
        "accessories": [{"code": "mat", "name": "Thảm", "price": 50, "is_active": True, "compatible_models": ["VF6"]},
                        {"code": "other", "name": "Không tương thích", "price": 500, "is_active": True, "compatible_models": ["VF9"]}],
        "rolling_costs": [{"province": "Hà Nội", "registration_rate": 0.1, "road_fee": 10, "inspection_fee": 20,
                           "insurance_rate": 0.02, "plate_fee": 30}],
        "promotions": [{"id": uid("promo"), "name": "Giảm 5%", "model": "VF6", "province": None,
                        "dealer_id": None, "is_active": True, "discount_type": "percent", "discount_value": 5,
                        "start_date": "2025-01-01", "end_date": "2030-01-01"},
                       {"id": uid("expired"), "name": "Hết hạn", "model": "ALL", "province": None,
                        "dealer_id": None, "is_active": True, "discount_type": "fixed", "discount_value": 999,
                        "start_date": "2024-01-01", "end_date": "2024-12-31"}],
        **{t: [] for t in mock.BUSINESS},
    }


AT = datetime(2026, 10, 8)


def test_quote_uses_source_prices_and_applicable_promotions(catalog):
    result = mock.price_snapshot(catalog, catalog["vehicle_prices"][0], "Hà Nội", "buy", ["mat"], AT)
    # 1000 vehicle + 100 battery + 50 mat + 180 rolling fees - 50 promotion.
    assert result["final_price"] == 1280
    assert result["total_discount"] == 50
    assert result["price_version"] == "source-v1"
    assert len(result["promotions"]) == 1
    rented = mock.price_snapshot(catalog, catalog["vehicle_prices"][0], "Hà Nội", "rent", [], AT)
    assert rented["final_price"] == 1130
    assert rented["battery_cost"] == 0


def test_every_quote_has_one_consistent_buyer_chat_lead_seller(catalog):
    plan = mock.build_plan(catalog, AT)
    leads = {r["id"]: r for r in plan["leads"]}
    chats = {r["session_id"]: r for r in plan["chat_sessions"]}
    users = {r["id"]: r for r in plan["users"]}
    assert len(leads) == 42 and len(plan["quotes"]) == 31 and len(chats) == 42
    assert {q["status"] for q in plan["quotes"]} == {"pending", "approved", "rejected", "expired"}
    for quote in plan["quotes"]:
        lead = leads[quote["lead_id"]]
        chat = chats[quote["session_id"]]
        buyer = users[chat["config_snapshot"]["buyer_id"]]
        seller = users[quote["seller_id"]]
        assert buyer["role"] == "buyer" and buyer["name"] == lead["name"] == quote["buyer_name"]
        assert lead["session_id"] == quote["session_id"]
        assert lead["phone"] == quote["buyer_phone"]
        assert seller["role"] == "seller" and seller["dealer_id"] == lead["dealer_id"]
        assert quote["created_at"] <= chat["updated_at"] <= AT
        assert quote["final_price"] == quote["price_snapshot"]["final_price"]
        assert "other" not in quote["accessories"]
    for stock in plan["inventory"]:
        assert users[stock["updated_by"]]["role"] == "warehouse"
        assert stock["color"] == catalog["vehicle_prices"][0]["color"]


def test_unmarked_rows_need_explicit_adoption_and_keep_ids(catalog):
    lead_id, quote_id = mock.identifier("old-lead"), mock.identifier("old-quote")
    catalog["leads"] = [{"id": lead_id, "note": "old random seed"}]
    catalog["quotes"] = [{"id": quote_id, "seller_note": None}]
    with pytest.raises(mock.OperationError, match="confirmed fake"):
        mock.build_plan(catalog, AT)
    plan = mock.build_plan(catalog, AT, adopt=True)
    assert lead_id in {r["id"] for r in plan["leads"]}
    assert quote_id in {r["id"] for r in plan["quotes"]}


def test_regeneration_is_stable_and_does_not_mutate_catalog(catalog):
    before = deepcopy(catalog)
    first = mock.build_plan(catalog, AT)
    assert catalog == before
    populated = {**catalog, **first}
    second = mock.build_plan(populated, AT)
    for table in ("leads", "quotes", "chat_sessions", "inventory"):
        assert first[table] == second[table]
    assert set(first).isdisjoint(mock.PROTECTED)


@pytest.mark.parametrize("table,row", [
    ("chat_sessions", {"id": "existing", "config_snapshot": {}}),
    ("inventory", {"id": "existing", "est_delivery": "Real stock"}),
])
def test_adoption_never_overwrites_unmarked_chat_or_stock(catalog, table, row):
    catalog[table] = [row]
    with pytest.raises(mock.OperationError, match="separately"):
        mock.build_plan(catalog, AT, adopt=True)


def test_sql_only_writes_business_and_guards_catalog(catalog):
    plan = mock.build_plan(catalog, AT)
    fingerprints = {t: "0123456789abcdef" for t in mock.PROTECTED + mock.BUSINESS}
    sql = mock.render_sql(plan, fingerprints)
    for table in mock.PROTECTED:
        assert f"INSERT INTO public.{table}" not in sql
        assert f"UPDATE public.{table}" not in sql
        assert f"Data changed: {table}" in sql
    assert "Mock integrity failed" in sql
    assert sql.startswith("BEGIN;") and sql.endswith("COMMIT;")
    assert mock.literal("O'Brien") == "'O''Brien'"


def test_recent_price_cannot_create_an_expired_quote_before_effective_date(catalog):
    catalog["vehicle_prices"][0]["effective_from"] = "2026-10-07T00:00:00"
    plan = mock.build_plan(catalog, AT)
    assert all(q["status"] != "expired" for q in plan["quotes"])
    assert all(q["created_at"] >= datetime(2026, 10, 7) for q in plan["quotes"])


@pytest.mark.asyncio
async def test_reviewed_plan_change_stops_before_business_writes(catalog, monkeypatch):
    conn = MagicMock()
    conn.transaction.return_value = AsyncMock()
    conn.execute = AsyncMock()
    conn.fetchval = AsyncMock(return_value="fingerprint")
    monkeypatch.setattr(mock, "snapshot", AsyncMock(return_value=catalog))
    with pytest.raises(mock.OperationError, match="Reviewed plan changed"):
        await mock.operate(conn, "apply", AT, expected_plan_sha256="outdated-plan")
    assert not any("INSERT INTO" in call.args[0] for call in conn.execute.call_args_list)
    assert conn.transaction.return_value.__aexit__.call_args.args[0] is mock.OperationError


def test_reference_timestamp_is_normalized_to_utc():
    assert mock.stamp("2026-10-08T07:00:00+07:00") == AT
