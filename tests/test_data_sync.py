import json
from contextlib import contextmanager
from copy import deepcopy
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException

from src import operational_data
from src.agents.tools.vinfast_tools import (
    estimate_vehicle_installment,
    get_eligible_promotions,
    lookup_province_fees,
    price_vehicle_configuration,
    search_vehicles,
)
from src.main import app
from src.models.schemas import ConfigRequest
from src.orm_models import Lead, Quote, UserRole
from src.services.auth import get_current_user
from src.services.pricing import calculate_price
from tests.operational_fixtures import business_tables

CONFIG = {
    "model": "VF6",
    "version": "Plus",
    "color": "Trắng",
    "province": "Hà Nội",
    "battery": "rent",
    "accessories": ["camera"],
}


def test_price_uses_live_fees_and_one_offer():
    tables = business_tables()
    smaller = {**tables["promotions"][0], "id": UUID(int=3), "discount_value": 10_000_000}
    dealer = {**smaller, "dealer_id": UUID(int=4), "discount_value": 500_000_000}
    conditional = {**smaller, "conditions": {"tier": "gold"}, "discount_value": 400_000_000}
    tables["promotions"] += [smaller, dealer, conditional]
    result = calculate_price(ConfigRequest(**CONFIG), tables)
    assert result["final_price"] == 707_800_000
    assert result["total_discount"] == 20_000_000
    assert len(result["promotions"]) == 1
    assert result["price_version"] == "test-v2"


@pytest.mark.parametrize("change,status", [("province", 422), ("accessory", 422), ("battery", 503)])
def test_missing_records_do_not_turn_into_zero_costs(change, status):
    tables = business_tables()
    key = {"province": "rolling_costs", "accessory": "accessories", "battery": "battery_prices"}[change]
    tables[key] = []
    with pytest.raises(HTTPException) as error:
        calculate_price(ConfigRequest(**CONFIG), tables)
    assert error.value.status_code == status


def test_duplicate_current_price_is_rejected():
    tables = business_tables()
    tables["vehicle_prices"].append({**tables["vehicle_prices"][0], "id": UUID(int=6)})
    with pytest.raises(HTTPException) as error:
        calculate_price(ConfigRequest(**CONFIG), tables)
    assert error.value.status_code == 409


def test_public_repository_never_queries_ai_snapshot(monkeypatch):
    tables = business_tables()
    statements = []

    class Cursor:
        def execute(self, statement):
            statements.append(statement)
            self.table = statement.split(".")[-1]

        def fetchall(self):
            return tables[self.table]

    @contextmanager
    def cursor():
        yield Cursor()

    monkeypatch.setattr(operational_data, "cursor", cursor)
    result = operational_data.load_tables()
    assert result["vehicle_prices"][0]["price"] == 700_000_000
    assert statements[0] == "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"
    assert all("ai_data." not in s for s in statements)


def test_ai_sees_business_updates_on_next_turn(monkeypatch):
    tables = business_tables()
    monkeypatch.setattr(operational_data, "load_tables", lambda: deepcopy(tables))
    first = json.loads(search_vehicles.invoke({"vehicle_queries": ["VF6 Plus"], "fields": ["price", "colors"]}))
    assert first["matched_versions"][0]["price_vnd"] == tables["vehicle_prices"][0]["price"]
    assert first["catalog_source"] == "postgresql/public"
    fees = json.loads(lookup_province_fees.invoke({"province": "Hà Nội"}))
    assert fees["fees"]["car_license_plate_fee_vnd"] == tables["rolling_costs"][0]["plate_fee"]
    tables["vehicle_prices"][0]["price"] = 710_000_000
    second = json.loads(search_vehicles.invoke({"vehicle_queries": ["VF6 Plus"], "fields": ["price"]}))
    assert second["matched_versions"][0]["price_vnd"] == 710_000_000
    tables["promotions"][0]["discount_value"] = 21_000_000
    promo = json.loads(get_eligible_promotions.invoke({"vehicle_queries": ["VF6 Plus"]}))
    assert promo["vehicles"][0]["programs"][0]["discount_vnd"] == 21_000_000


def test_ai_configuration_uses_same_calculator_and_color_price(monkeypatch):
    tables = business_tables()
    tables["vehicle_prices"].append(
        {**tables["vehicle_prices"][0], "id": UUID(int=9), "color": "Đỏ", "price": 710_000_000}
    )
    monkeypatch.setattr(operational_data, "load_tables", lambda: deepcopy(tables))
    request = {**CONFIG, "color": "Đỏ", "battery": "buy", "dealer_id": str(UUID(int=10))}
    result = json.loads(price_vehicle_configuration.invoke(request))
    expected = calculate_price(ConfigRequest(**request), tables)
    assert result["final_price"] == expected["final_price"]
    assert result["base_price"] == 710_000_000
    assert result["battery_cost"] == 100_000_000
    assert result["price_version"] == expected["price_version"]
    assert result["data_source"] == "postgresql/public"
    assert result["configuration"]["dealer_id"] == str(UUID(int=10))
    loan = json.loads(
        estimate_vehicle_installment.invoke(
            {
                **request,
                "down_payment_pct": 30,
                "annual_rate_pct": 10,
                "term_months": 60,
            }
        )
    )
    assert loan["estimate"]["total_price"] == expected["final_price"]
    assert loan["estimate"]["schedule"][-1]["balance"] == 0


@pytest.mark.asyncio
async def test_catalog_configuration_quote_and_pdf_share_prices(client, operational_db, monkeypatch):
    session, tables = operational_db
    catalog = (await client.get("/api/v1/vehicles")).json()
    assert catalog["vehicles"]["VF6"]["versions"][0]["price"] == 700_000_000
    assert catalog["provinces"]["Hà Nội"]["plateFee"] == 14_000_000
    assert catalog["accessories"][0]["id"] == "camera"
    price = (await client.post("/api/v1/configurate", json=CONFIG)).json()
    assert price["final_price"] == 707_800_000
    body = {
        **CONFIG,
        "session_id": "sync-test",
        "buyer_name": "Test",
        "buyer_phone": "0900000000",
        "final_price": price["final_price"],
        "price_version": price["price_version"],
        "price_snapshot": {"base_price": 1},
        "dealer_id": str(UUID(int=10)),
        "request_id": str(UUID(int=50)),
    }
    response = await client.post("/api/v1/quotes", json=body)
    assert response.status_code == 201
    objects = [call.args[0] for call in session.add.call_args_list]
    lead = next(o for o in objects if isinstance(o, Lead))
    quote = next(o for o in objects if isinstance(o, Quote))
    assert quote.lead_id == lead.id
    assert quote.final_price == lead.budget == price["final_price"]
    assert quote.price_snapshot["base_price"] == 700_000_000
    assert quote.price_version == "test-v2"
    from src.api import routes

    captured = []
    monkeypatch.setattr(routes, "generate_quote_pdf", lambda data: captured.append(data) or b"%PDF-test")
    pdf = await client.post("/api/v1/quote/preview-pdf", json={**CONFIG, "final_price": 1, "price_snapshot": {}})
    assert pdf.status_code == 200
    assert captured[0]["final_price"] == price["final_price"]
    assert captured[0]["price_snapshot"]["base_price"] == quote.price_snapshot["base_price"]
    assert pdf.headers["content-type"] == "application/pdf"


@pytest.mark.asyncio
async def test_quote_conflict_creates_neither_lead_nor_quote(client, operational_db):
    session, _ = operational_db
    body = {
        **CONFIG,
        "session_id": "sync-test",
        "buyer_name": "Test",
        "buyer_phone": "0900000000",
        "final_price": 1,
        "price_version": "test-v2",
        "dealer_id": str(UUID(int=10)),
        "request_id": str(UUID(int=51)),
    }
    response = await client.post("/api/v1/quotes", json=body)
    assert response.status_code == 409
    session.add.assert_not_called()


@pytest.mark.asyncio
async def test_inventory_requires_auth_and_dealer_scope(client):
    response = await client.get("/api/v1/inventory")
    assert response.status_code == 401
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        role=UserRole.seller, dealer_id=UUID(int=10), id=UUID(int=11)
    )
    try:
        own = await client.get("/api/v1/inventory")
        assert own.status_code == 200
        other = await client.get("/api/v1/inventory", params={"dealer_id": str(UUID(int=12))})
        assert other.status_code == 403
        bad = await client.patch("/api/v1/inventory/anything", json={"quantity": -1})
        assert bad.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_cannot_modify_other_dealers_inventory(client, operational_db):
    from datetime import datetime

    _, tables = operational_db
    tables["inventory"] = [
        {
            "id": UUID(int=20),
            "dealer_id": UUID(int=12),
            "model": "VF6",
            "version": "Plus",
            "color": "Trắng",
            "color_hex": "#FFFFFF",
            "quantity": 4,
            "est_delivery": None,
            "updated_at": datetime.now(),
        }
    ]
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        role=UserRole.warehouse, dealer_id=UUID(int=10), id=UUID(int=11)
    )
    try:
        response = await client.patch(
            f"/api/v1/inventory/{UUID(int=20)}",
            json={"quantity": 0, "expected_updated_at": tables["inventory"][0]["updated_at"].isoformat()},
        )
        assert response.status_code == 403
        assert tables["inventory"][0]["quantity"] == 4
    finally:
        app.dependency_overrides.pop(get_current_user, None)
