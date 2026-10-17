"""No live DB or Zalo accounts: authorization, content integrity and recovery tests."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.responses import Response

from src.api.zalo_routes import CampaignBody, create_campaign, render_message, scope
from src.main import app
from src.services.access import sales_user
from src.zalo_worker import store_result, tick


def test_dealer_isolation():
    dealer = uuid4()
    seller = SimpleNamespace(role=SimpleNamespace(value="seller"), dealer_id=dealer)
    assert scope(seller, None) == dealer
    with pytest.raises(HTTPException) as error:
        scope(seller, uuid4())
    assert error.value.status_code == 403
    admin = SimpleNamespace(role=SimpleNamespace(value="admin"))
    assert scope(admin, None) is None


def test_quote_values_are_literal_and_snapshot_price_is_used():
    quote = SimpleNamespace(buyer_name="Khách {price}", model="VF7", version="Plus", final_price=900000000)
    assert render_message("{name}: {model} {price}", quote) == "Khách {price}: VF7 900.000.000"
    for invalid in ("{phone}", "{name.__class__}", "{name", "name}"):
        with pytest.raises(HTTPException):
            render_message(invalid, quote)


@pytest.mark.asyncio
async def test_routes_require_login(client):
    for url in ("connection", "friends", "candidates", "campaigns"):
        response = await client.get(f"/api/v1/zalo/{url}")
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_foreign_dealer_never_reaches_bridge(client):
    user = SimpleNamespace(id=uuid4(), dealer_id=uuid4(), role=SimpleNamespace(value="seller"))
    app.dependency_overrides[sales_user] = lambda: user
    try:
        with patch("src.api.zalo_routes.bridge", new_callable=AsyncMock) as bridge:
            response = await client.post(f"/api/v1/zalo/connection?dealer_id={uuid4()}")
            assert response.status_code == 403
            bridge.assert_not_called()
    finally:
        app.dependency_overrides.pop(sales_user, None)


@pytest.mark.asyncio
async def test_recipient_lookup_is_scoped_and_requires_friend(client):
    user = SimpleNamespace(id=uuid4(), dealer_id=uuid4(), role=SimpleNamespace(value="seller"))
    app.dependency_overrides[sales_user] = lambda: user
    try:
        with patch(
            "src.api.zalo_routes.bridge",
            new_callable=AsyncMock,
            return_value={"uid": "123", "name": "Customer", "is_friend": True},
        ) as service:
            response = await client.post("/api/v1/zalo/recipients/resolve", json={"phone": "0900000001"})
            assert response.status_code == 200
            assert service.call_args.args[1] == user.id
            service.return_value = {"uid": "123", "is_friend": False}
            response = await client.post("/api/v1/zalo/recipients/resolve", json={"phone": "0900000001"})
            assert response.status_code == 422
    finally:
        app.dependency_overrides.pop(sales_user, None)


def test_no_self_test_endpoint_in_application():
    assert not any(getattr(route, "path", "").endswith("/test") for route in app.routes)


@pytest.mark.asyncio
async def test_recovery_never_turns_unknown_into_pending():
    db = AsyncMock()
    await store_result(db, uuid4(), {"status": "unknown", "error": "needs review"})
    assert db.execute.call_args.args[1]["status"] == "unknown"
    await store_result(db, uuid4(), {"status": "deferred"})
    assert db.execute.call_args.args[1]["status"] == "pending"
    db.execute.reset_mock()
    await store_result(db, uuid4(), {"status": "sending"})
    db.execute.assert_not_called()


def result(*, first=None, rows=None, scalar=None, quotes=None):
    value = MagicMock()
    value.mappings.return_value.first.return_value = first
    value.mappings.return_value.all.return_value = rows or []
    value.scalar.return_value = scalar
    value.scalars.return_value.all.return_value = quotes or []
    return value


@pytest.mark.asyncio
@pytest.mark.parametrize("eligible", [False, True])
@pytest.mark.parametrize("attach_pdf", [False, True])
async def test_campaign_snapshots_only_approved_scoped_quotes_with_consent(eligible, attach_pdf):
    dealer, lead, quote_id, campaign_id = uuid4(), uuid4(), uuid4(), uuid4()
    user = SimpleNamespace(id=uuid4(), dealer_id=dealer, role=SimpleNamespace(value="seller"))
    quote = SimpleNamespace(
        id=quote_id, lead_id=lead, buyer_name="Khách A", model="VF7", version="Plus", final_price=900000000
    )
    contact = {"lead_id": lead, "zalo_uid": "456", "account_uid": "123", "consent_at": eligible, "opted_out": False}
    db = AsyncMock()
    db.execute.side_effect = [
        result(),
        result(quotes=[quote]),
        result(rows=[contact]),
        result(scalar=campaign_id),
        result(),
    ]
    body = CampaignBody(id=campaign_id, name="Báo giá", template="{name}: {model} {price}", quote_ids=[quote_id], attach_pdf=attach_pdf)
    with (
        patch("src.api.zalo_routes.bridge", new_callable=AsyncMock, return_value={"status": "connected", "uid": "123"}),
        patch("src.api.zalo_routes.pdf_response", return_value=Response(b"%PDF-test")) as pdf,
    ):
        if not eligible:
            with pytest.raises(HTTPException) as error:
                await create_campaign(body, None, user, db)
            assert error.value.status_code == 422
            assert db.execute.call_count == 3
        else:
            assert (await create_campaign(body, None, user, db))["id"] == campaign_id
            delivery = db.execute.call_args.args[1][0]
            assert delivery["message"] == "Khách A: VF7 900.000.000"
            assert delivery["uid"] == "456"
            assert delivery["pdf_data"] == (b"%PDF-test" if attach_pdf else None)
            assert delivery["pdf_name"] == (f"P97_BaoGia_{quote_id}.pdf" if attach_pdf else None)
            assert pdf.call_count == int(attach_pdf)
            query = str(db.execute.call_args_list[1].args[0])
            assert "leads.dealer_id" in query and "quotes.status" in query
            assert "leads.assigned_to" in query and "quotes.seller_id" in query
            assert "user_id=:user" in str(db.execute.call_args_list[2].args[0])


@pytest.mark.asyncio
async def test_campaign_rejects_missing_or_foreign_quotes_without_writes():
    dealer = uuid4()
    user = SimpleNamespace(id=uuid4(), dealer_id=dealer, role=SimpleNamespace(value="seller"))
    db = AsyncMock()
    db.execute.side_effect = [result(), result(quotes=[])]
    body = CampaignBody(id=uuid4(), name="Báo giá", template="{name}", quote_ids=[uuid4()])
    with patch(
        "src.api.zalo_routes.bridge", new_callable=AsyncMock, return_value={"status": "connected", "uid": "123"}
    ):
        with pytest.raises(HTTPException) as error:
            await create_campaign(body, None, user, db)
    assert error.value.status_code == 422
    assert db.execute.call_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("age", [1, 180])
async def test_worker_reconciles_interrupted_send_without_resending(age):
    db = AsyncMock()
    db.__aenter__.return_value = db
    db.begin = MagicMock(return_value=AsyncMock())
    row = {
        "id": uuid4(),
        "dealer_id": uuid4(),
        "user_id": uuid4(),
        "status": "sending",
        "updated_at": datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=age),
    }
    db.execute.side_effect = [result(scalar=True), result(first=row), result()]
    with (
        patch("src.zalo_worker.AsyncSessionLocal", return_value=db),
        patch("src.zalo_worker.bridge", new_callable=AsyncMock, return_value={"status": "missing"}) as service,
    ):
        await tick()
    assert service.call_args.args[0] == "GET"
    assert service.call_args.args[1] == row["user_id"]
    if age == 1:
        assert db.execute.call_count == 2
    else:
        assert db.execute.call_args.args[1]["status"] == "unknown"


@pytest.mark.asyncio
async def test_worker_skips_revoked_consent_without_calling_provider():
    db = AsyncMock()
    db.__aenter__.return_value = db
    db.begin = MagicMock(return_value=AsyncMock())
    row = {"id": uuid4(), "status": "pending", "eligible": False}
    db.execute.side_effect = [result(scalar=True), result(first=row), result()]
    with (
        patch("src.zalo_worker.AsyncSessionLocal", return_value=db),
        patch("src.zalo_worker.bridge", new_callable=AsyncMock) as service,
    ):
        await tick()
    service.assert_not_called()
    assert db.execute.call_args.args[1]["status"] == "skipped"


@pytest.mark.asyncio
async def test_same_dealer_staff_and_admin_get_only_their_own_connection(client):
    dealer = uuid4()
    users = [SimpleNamespace(id=uuid4(),dealer_id=dealer,role=SimpleNamespace(value=role))
             for role in ("seller","seller","admin")]
    def signed_in(current):
        return lambda: current
    try:
        with patch("src.api.zalo_routes.bridge",new_callable=AsyncMock,return_value={"status":"disconnected"}) as service:
            for user in users:
                app.dependency_overrides[sales_user] = signed_in(user)
                for method,endpoint in (("GET","connection"),("POST","connection"),("DELETE","connection"),("GET","friends")):
                    response=await client.request(method,f"/api/v1/zalo/{endpoint}")
                    assert response.status_code==200
                    assert service.call_args.args[1]==user.id
    finally:
        app.dependency_overrides.pop(sales_user,None)


@pytest.mark.asyncio
@pytest.mark.parametrize("role",["seller","admin"])
async def test_campaign_idempotency_cannot_claim_another_staff_campaign(role):
    user=SimpleNamespace(id=uuid4(),dealer_id=uuid4(),role=SimpleNamespace(value=role))
    db=AsyncMock()
    body=CampaignBody(id=uuid4(),name="Báo giá",template="{name}",quote_ids=[uuid4()])
    db.execute.return_value=result(first={"id":body.id,"dealer_id":user.dealer_id,"created_by":uuid4()})
    with patch("src.api.zalo_routes.bridge",new_callable=AsyncMock) as service:
        with pytest.raises(HTTPException) as error:
            await create_campaign(body,None,user,db)
    assert error.value.status_code==409
    service.assert_not_called()


@pytest.mark.asyncio
async def test_worker_dispatches_using_campaign_creator_not_dealer():
    db=AsyncMock()
    db.__aenter__.return_value=db
    db.begin=MagicMock(return_value=AsyncMock())
    row={"id":uuid4(),"dealer_id":uuid4(),"user_id":uuid4(),"account_uid":"123",
         "zalo_uid":"456","message":"Báo giá","status":"pending","eligible":True}
    db.execute.side_effect=[result(scalar=True),result(first=row),result(),result()]
    with (patch("src.zalo_worker.AsyncSessionLocal",return_value=db),
          patch("src.zalo_worker.bridge",new_callable=AsyncMock,return_value={"status":"deferred"}) as service):
        await tick()
    assert service.call_args.args[:2]==("POST",row["user_id"])
    assert service.call_args.args[1]!=row["dealer_id"]
