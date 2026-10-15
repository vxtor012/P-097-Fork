"""Opt-in functional tests on a separately provisioned localhost *_test DB.

Every test uses an outer transaction; successful HTTP commits release savepoints
and teardown rolls all test records back. No configured application DB is used.
"""

import os
import uuid
from contextlib import nullcontext
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from langchain_core.messages import AIMessage
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from src.api import routes
from src.db import get_db
from src.main import app
from src.orm_models import (
    Branch,
    Dealer,
    Inventory,
    Lead,
    LeadStatus,
    NewsletterSubscription,
    Quote,
    Store,
    User,
    UserRole,
    UserStore,
)
from src.services.auth import hash_password


@pytest_asyncio.fixture
async def workflow(monkeypatch):
    url = os.environ.get("BUSINESS_TEST_DATABASE_URL")
    if not url:
        pytest.skip("BUSINESS_TEST_DATABASE_URL is not set")
    parsed = urlsplit(url.replace("postgresql+asyncpg://", "postgresql://"))
    if parsed.hostname not in {"localhost", "127.0.0.1", "::1"} or not parsed.path.endswith("_test"):
        pytest.fail("Business tests require a separate localhost *_test database")
    url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url, poolclass=NullPool)
    connection = await engine.connect()
    outer = await connection.begin()
    actors = {}
    async with AsyncSession(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False) as setup:
        dealer_a = Dealer(name="Integration dealer A", province="Hà Nội")
        dealer_b = Dealer(name="Integration dealer B", province="Hà Nội")
        setup.add_all([dealer_a, dealer_b])
        await setup.flush()
        branch = Branch(name="Integration branch", dealer_id=dealer_a.id)
        setup.add(branch)
        await setup.flush()
        stores = [Store(name=f"Integration store {i}", dealer_id=dealer_a.id, branch_id=branch.id) for i in (1, 2)]
        setup.add_all(stores)
        await setup.flush()
        hashed = hash_password("workflow-test-password")
        for name, role, dealer in [
            ("seller", UserRole.seller, dealer_a),
            ("other", UserRole.seller, dealer_b),
            ("warehouse", UserRole.warehouse, dealer_a),
            ("manager", UserRole.warehouse_manager, dealer_a),
            ("buyer", UserRole.buyer, None),
            ("admin", UserRole.admin, None),
        ]:
            user = User(
                name=name,
                email=f"{uuid.uuid4()}@example.invalid",
                hashed_pw=hashed,
                role=role,
                dealer_id=dealer.id if dealer else None,
                is_active=True,
            )
            setup.add(user)
            await setup.flush()
            actors[name] = user
        setup.add(UserStore(user_id=actors["warehouse"].id, store_id=stores[0].id))
        for store in stores:
            setup.add(
                Inventory(
                    dealer_id=dealer_a.id,
                    store_id=store.id,
                    model="VF6",
                    version="Plus",
                    color="Trắng Tinh Khôi",
                    color_hex="#FFFFFF",
                    quantity=2,
                    updated_at=datetime.now(UTC).replace(tzinfo=None),
                )
            )
        await setup.commit()

    async def database():
        async with AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        ) as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = database
    monkeypatch.setattr(routes, "dataset_scope", nullcontext)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
        ) as client:

            async def login(name):
                response = await client.post(
                    "/api/v1/auth/login", json={"email": actors[name].email, "password": "workflow-test-password"}
                )
                assert response.status_code == 200, response.text
                return {"Authorization": "Bearer " + response.json()["token"]}

            yield client, connection, actors, dealer_a, stores, login, database
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
        await outer.rollback()
        await connection.close()
        await engine.dispose()


def config(dealer):
    return {
        "model": "VF6",
        "version": "Plus",
        "color": "Trắng Tinh Khôi",
        "province": "Hà Nội",
        "battery": "rent",
        "accessories": [],
        "dealer_id": str(dealer.id),
    }


async def submit(client, dealer):
    request = config(dealer)
    pricing = await client.post("/api/v1/configurate", json=request)
    assert pricing.status_code == 200, pricing.text
    body = {
        **request,
        "session_id": str(uuid.uuid4()),
        "buyer_name": "Khách Kiểm Thử",
        "buyer_phone": "+84 900 000 001",
        "request_id": str(uuid.uuid4()),
        "price_version": pricing.json()["price_version"],
        "final_price": pricing.json()["final_price"],
    }
    response = await client.post("/api/v1/quotes", json=body)
    assert response.status_code == 201, response.text
    return body, response.json()


@pytest.mark.asyncio
async def test_sessions_and_role_boundaries(workflow):
    client, _, _, _, _, login, _ = workflow
    for endpoint in ("leads", "quotes", "promotions", "inventory", "stores"):
        assert (await client.get("/api/v1/" + endpoint)).status_code == 401
    buyer = await login("buyer")
    assert (await client.get("/api/v1/leads", headers=buyer)).status_code == 403
    assert (await client.get("/api/v1/inventory", headers=buyer)).status_code == 403
    seller = await login("seller")
    assert (await client.get("/api/v1/quotes?status=invalid", headers=seller)).status_code == 422
    assert (await client.get("/api/v1/auth/me", headers=seller)).status_code == 200
    assert (await client.post("/api/v1/auth/logout", headers=seller)).status_code == 200
    assert (await client.get("/api/v1/auth/me", headers=seller)).status_code == 401
    assert (await client.get("/api/v1/leads", headers=seller)).status_code == 401


@pytest.mark.asyncio
async def test_quote_retry_scope_review_and_pdf(workflow):
    client, connection, _, dealer, _, login, _ = workflow
    body, quote = await submit(client, dealer)
    retry = await client.post("/api/v1/quotes", json=body)
    assert retry.status_code == 201 and retry.json()["id"] == quote["id"]
    assert (await client.post("/api/v1/quotes", json={**body, "buyer_name": "Different person"})).status_code == 409
    other = await login("other")
    assert quote["id"] not in {q["id"] for q in (await client.get("/api/v1/quotes", headers=other)).json()["quotes"]}
    review = "/api/v1/quote/approve?quote_id=" + quote["id"]
    assert (await client.post(review, json={"action": "approve"}, headers=other)).status_code == 403
    assert (await client.get("/api/v1/quotes/" + quote["id"] + "/pdf", headers=other)).status_code == 403
    seller = await login("seller")
    assert (await client.post("/api/v1/leads/" + quote["lead_id"] + "/claim", headers=seller)).status_code == 200
    assert (
        await client.post(review, json={"action": "approve", "seller_note": "Đã kiểm tra"}, headers=seller)
    ).status_code == 200
    assert (await client.post(review, json={"action": "reject"}, headers=seller)).status_code == 409
    lead_status = (await connection.execute(select(Lead.status).where(Lead.id == uuid.UUID(quote["lead_id"])))).scalar()
    assert lead_status == LeadStatus.quoted
    pdf = await client.get("/api/v1/quotes/" + quote["id"] + "/pdf", headers=seller)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    assert pdf.headers["cache-control"] == "private, no-store"
    import fitz

    document = fitz.open(stream=pdf.content, filetype="pdf")
    assert "Khách Kiểm Thử" in "".join(page.get_text() for page in document)
    document.close()


@pytest.mark.asyncio
async def test_store_scope_and_inventory_conflict(workflow):
    client, _, _, _, stores, login, _ = workflow
    warehouse = await login("warehouse")
    rows = (await client.get("/api/v1/inventory", headers=warehouse)).json()["inventory"]
    assert len(rows) == 1 and rows[0]["store_id"] == str(stores[0].id)
    assert (await client.get("/api/v1/inventory?store_id=" + str(stores[1].id), headers=warehouse)).status_code == 403
    manager = await login("manager")
    all_rows = (await client.get("/api/v1/inventory", headers=manager)).json()["inventory"]
    assert len(all_rows) == 2
    other = next(i for i in all_rows if i["store_id"] == str(stores[1].id))
    assert (
        await client.patch(
            "/api/v1/inventory/" + other["id"],
            headers=warehouse,
            json={"quantity": 0, "expected_updated_at": other["updated_at"]},
        )
    ).status_code == 403
    item = rows[0]
    edit = {"quantity": 9, "expected_updated_at": item["updated_at"], "est_delivery": "Theo lịch xác nhận"}
    endpoint = "/api/v1/inventory/" + item["id"]
    assert (await client.patch(endpoint, json=edit, headers=warehouse)).status_code == 200
    assert (await client.patch(endpoint, json={**edit, "quantity": 10}, headers=warehouse)).status_code == 409
    assert (await client.get("/api/v1/inventory", headers=warehouse)).json()["inventory"][0]["quantity"] == 9


@pytest.mark.asyncio
async def test_dealer_promotions_reprice_and_validate(workflow):
    client, _, _, dealer, _, login, _ = workflow
    seller = await login("seller")
    now = datetime.now(UTC)
    base = (await client.post("/api/v1/configurate", json=config(dealer))).json()["final_price"]
    payload = {
        "name": "Integration promotion",
        "model": "VF6",
        "discount_type": "fixed",
        "discount_value": 12345,
        "start_date": (now - timedelta(days=1)).isoformat(),
        "end_date": (now + timedelta(days=1)).isoformat(),
    }
    response = await client.post("/api/v1/promotions", json=payload, headers=seller)
    assert response.status_code == 201, response.text
    promo_id = response.json()["id"]
    price = await client.post("/api/v1/configurate", json=config(dealer))
    assert price.json()["final_price"] == base - 12345
    quote_body, _ = await submit(client, dealer)
    assert (await client.post("/api/v1/quotes", json=quote_body)).status_code == 201
    counts = (await client.get("/api/v1/promotions", headers=seller)).json()["promotions"]
    assert next(p["usage_count"] for p in counts if p["id"] == promo_id) == 1
    other = await login("other")
    assert (
        await client.patch("/api/v1/promotions/" + promo_id, json={"is_active": False}, headers=other)
    ).status_code == 403
    assert (
        await client.post(
            "/api/v1/promotions", json={**payload, "discount_type": "percent", "discount_value": 101}, headers=seller
        )
    ).status_code == 422
    assert (
        await client.patch(
            "/api/v1/promotions/" + promo_id, json={"end_date": (now - timedelta(days=10)).isoformat()}, headers=seller
        )
    ).status_code == 422
    assert (await client.delete("/api/v1/promotions/" + promo_id, headers=seller)).status_code == 200
    assert (await client.post("/api/v1/configurate", json=config(dealer))).json()["final_price"] == base


@pytest.mark.asyncio
async def test_newsletter_is_unique_and_validated(workflow):
    client, connection, _, _, _, _, _ = workflow
    email = str(uuid.uuid4()) + "@example.invalid"
    for address in (email, email.upper()):
        assert (await client.post("/api/v1/newsletter", json={"email": address, "consent": True})).status_code == 201
    count = (
        await connection.execute(
            select(func.count()).select_from(NewsletterSubscription).where(NewsletterSubscription.email == email)
        )
    ).scalar()
    assert count == 1
    assert (await client.post("/api/v1/newsletter", json={"email": "invalid", "consent": True})).status_code == 422
    assert (await client.post("/api/v1/newsletter", json={"email": email, "consent": False})).status_code == 422


@pytest.mark.asyncio
async def test_chat_history_survives_agent_memory_reset(workflow, monkeypatch):
    client, _, _, _, _, _, _ = workflow

    class Agent:
        def invoke(self, state, config):
            count = len([m for m in state["messages"] if m.type == "human"])
            reply = f"Lượt hội thoại {count}"
            return {"answer": reply, "messages": [*state["messages"], AIMessage(content=reply)]}

    monkeypatch.setattr(routes, "agent", Agent())
    session = str(uuid.uuid4())
    first = await client.post("/api/v1/chat", json={"session_id": session, "message": "Xin chào"})
    assert first.status_code == 200
    monkeypatch.setattr(routes, "agent", Agent())
    second = await client.post("/api/v1/chat", json={"session_id": session, "message": "Tiếp tục"})
    assert second.json()["response"] == "Lượt hội thoại 2"
    assert len((await client.get("/api/v1/chat/history", params={"session_id": session})).json()["messages"]) == 4


@pytest.mark.asyncio
async def test_installment_uses_live_price_and_explicit_assumptions(workflow):
    client, _, _, dealer, _, _, _ = workflow
    body = {**config(dealer), "down_payment_pct": 30, "annual_rate_pct": 10, "term_months": 60}
    price = (await client.post("/api/v1/configurate", json=config(dealer))).json()
    estimate = await client.post("/api/v1/installment", json=body)
    assert estimate.status_code == 200, estimate.text
    data = estimate.json()
    assert data["total_price"] == price["final_price"]
    assert sum(m["principal"] for m in data["schedule"]) == data["loan_amount"]
    assert data["schedule"][-1]["balance"] == 0
    assert (await client.post("/api/v1/installment", json=config(dealer))).status_code == 422
    assert (await client.post("/api/v1/installment", json={**body, "term_months": 0})).status_code == 422


@pytest.mark.asyncio
async def test_chat_configuration_update_matches_pricing(workflow, monkeypatch):
    client, _, _, dealer, _, _, _ = workflow

    class NoAgent:
        def invoke(self, *args, **kwargs):
            raise AssertionError("Explicit configuration changes should not need an LLM")

    monkeypatch.setattr(routes, "agent", NoAgent())
    session = str(uuid.uuid4())
    response = await client.post(
        "/api/v1/chat",
        json={
            "session_id": session,
            "message": "Đổi sang mua pin",
            "vehicle_context": config(dealer),
        },
    )
    assert response.status_code == 200, response.text
    update = response.json()["configuration_update"]
    assert update["battery"] == "buy" and update["dealer_id"] == str(dealer.id)
    current = (await client.post("/api/v1/configurate", json=update)).json()
    money = f"{current['final_price']:,}".replace(",", ".")
    assert money in response.json()["response"]
    assert len((await client.get("/api/v1/chat/history", params={"session_id": session})).json()["messages"]) == 2


@pytest.mark.asyncio
async def test_commit_failure_never_reports_success(workflow):
    client, connection, _, dealer, _, _, database = workflow

    async def failed_commit():
        async with AsyncSession(bind=connection, join_transaction_mode="create_savepoint") as session:
            try:
                yield session
                raise RuntimeError("simulated commit failure")
            except Exception:
                await session.rollback()
                raise

    price = (await client.post("/api/v1/configurate", json=config(dealer))).json()
    app.dependency_overrides[get_db] = failed_commit
    try:
        response = await client.post(
            "/api/v1/quotes",
            json={
                **config(dealer),
                "session_id": str(uuid.uuid4()),
                "request_id": str(uuid.uuid4()),
                "buyer_name": "Rollback test",
                "buyer_phone": "0900000002",
                "price_version": price["price_version"],
                "final_price": price["final_price"],
            },
        )
        assert response.status_code == 500
    finally:
        app.dependency_overrides[get_db] = database
    count = (
        await connection.execute(select(func.count()).select_from(Lead).where(Lead.dealer_id == dealer.id))
    ).scalar()
    assert count == 0
    assert (
        await connection.execute(select(func.count()).select_from(Quote).where(Quote.buyer_name == "Rollback test"))
    ).scalar() == 0
