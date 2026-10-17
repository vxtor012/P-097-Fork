"""Opt-in rollback-only SQL tests on a local test DB or empty local profile."""
import base64
import hashlib
import os
from pathlib import Path
from unittest.mock import AsyncMock, patch
from urllib.parse import urlsplit
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from src.db import get_db
from src.main import app
from src.orm_models import Dealer, Lead, Quote, QuoteStatus, User, UserRole
from src.services.auth import hash_password


@pytest_asyncio.fixture
async def workflow():
    url = os.environ.get("BUSINESS_TEST_DATABASE_URL")
    if not url:
        pytest.skip("BUSINESS_TEST_DATABASE_URL is not set")
    target = urlsplit(url.replace("postgresql+asyncpg://", "postgresql://", 1))
    if target.hostname not in {"127.0.0.1", "localhost", "::1"}:
        pytest.fail("Zalo SQL tests only run on localhost")
    local_profile = target.path.startswith("/autoquote_local_")
    if not target.path.endswith("_test") and not local_profile:
        pytest.fail("A separate local test DB or empty local development profile is required")
    engine = create_async_engine(url.replace("postgresql://", "postgresql+asyncpg://", 1), poolclass=NullPool)
    connection = await engine.connect()
    outer = await connection.begin()
    previous = app.dependency_overrides.get(get_db)
    try:
        if local_profile:
            # The old preview business data was removed; never run this fixture
            # if any operational customers/accounts have since been added.
            for table in ("users", "leads", "quotes", "inventory", "zalo_contacts", "zalo_campaigns", "zalo_deliveries"):
                if (await connection.execute(text(f"SELECT count(*) FROM {table}"))).scalar():
                    pytest.fail("Local profile contains business records; test aborted without writes")
        actors = {}
        async with AsyncSession(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False) as setup:
            dealer = Dealer(id=uuid4(), name="Zalo SQL test dealership", province="Hà Nội")
            other = Dealer(id=uuid4(), name="Other SQL test dealership", province="Hà Nội")
            setup.add_all([dealer, other])
            await setup.flush()
            for name, role, organization in (("seller", UserRole.seller, dealer),
                                              ("other", UserRole.seller, other), ("admin", UserRole.admin, None)):
                actor = User(id=uuid4(), name=name, email=f"{uuid4()}@example.invalid", role=role,
                             dealer_id=organization.id if organization else None,
                             hashed_pw=hash_password("workflow-test-password"), is_active=True)
                setup.add(actor)
                await setup.flush()
                actors[name] = actor
            await setup.commit()

        async def database():
            async with AsyncSession(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False) as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise

        app.dependency_overrides[get_db] = database
        async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as client:
            async def login(name):
                response = await client.post("/api/v1/auth/login", json={
                    "email": actors[name].email, "password": "workflow-test-password"})
                assert response.status_code == 200, response.text
                return {"Authorization": "Bearer " + response.json()["token"]}
            yield client, connection, actors, dealer, None, login, database
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
        await outer.rollback()
        await connection.close()
        await engine.dispose()


@pytest.mark.asyncio
async def test_two_sellers_same_dealer_have_private_contacts_campaigns_and_dispatch(workflow, monkeypatch):
    client, connection, actors, dealer, _, login, _ = workflow
    root = Path(__file__).resolve().parents[2]
    raw = (await connection.get_raw_connection()).driver_connection
    exists = (await connection.execute(text("SELECT to_regclass('public.zalo_contacts')"))).scalar()
    if not exists:
        await raw.execute((root / "supabase/migrations/20261016090000_zalo_campaigns.sql").read_text(encoding="utf-8"))
    personal = (await connection.execute(text("""SELECT EXISTS(SELECT FROM information_schema.columns
        WHERE table_schema='public' AND table_name='zalo_contacts' AND column_name='user_id')"""))).scalar()
    if not personal:
        await raw.execute((root / "supabase/migrations/20261017130000_zalo_staff_connections.sql").read_text(encoding="utf-8"))
    pdf = (await connection.execute(text("""SELECT EXISTS(SELECT FROM information_schema.columns
        WHERE table_schema='public' AND table_name='zalo_campaigns' AND column_name='attach_pdf')"""))).scalar()
    if not pdf:
        await raw.execute((root / "supabase/migrations/20261017140000_zalo_pdf_attachments.sql").read_text(encoding="utf-8"))
    # All setup, schema additions and HTTP commits stay inside the fixture rollback.
    async with AsyncSession(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False) as setup:
        second = User(id=uuid4(), name="Second seller", email=f"{uuid4()}@example.invalid",
                      hashed_pw=actors["seller"].hashed_pw, role=UserRole.seller, dealer_id=dealer.id, is_active=True)
        setup.add(second)
        await setup.flush()
        actors["second"] = second
        leads, quotes = [], []
        for actor in (actors["seller"], second):
            lead = Lead(id=uuid4(), session_id=str(uuid4()), dealer_id=dealer.id, assigned_to=actor.id, name="Test customer")
            setup.add(lead)
            await setup.flush()
            quote = Quote(id=uuid4(), lead_id=lead.id, session_id=lead.session_id, seller_id=actor.id,
                          model="VF7", version="Plus", price_snapshot={}, price_version="test",
                          final_price=900000000, status=QuoteStatus.approved)
            setup.add(quote)
            leads.append(lead)
            quotes.append(quote)
        # Owning the quote alone must not expose a customer assigned to another employee.
        setup.add(Quote(id=uuid4(), lead_id=leads[1].id, session_id=leads[1].session_id, seller_id=actors["seller"].id,
                        model="VF7", version="Plus", price_snapshot={}, price_version="test",
                        final_price=900000000, status=QuoteStatus.approved))
        await setup.commit()

    headers = {name: await login(name) for name in ("seller", "second", "other", "admin")}

    async def personal_bridge(method, user_id, action="", payload=None):
        if action == "/friends":
            return {"friends": [{"uid": "456", "name": "Test recipient"}]}
        return {"status": "connected", "uid": str(user_id)}

    campaign_ids = [uuid4(), uuid4()]
    with patch("src.api.zalo_routes.bridge", side_effect=personal_bridge):
        for i, name in enumerate(("seller", "second")):
            response = await client.get("/api/v1/zalo/connection", headers=headers[name])
            assert response.status_code == 200
            assert response.json()["uid"] == str(actors[name].id)
            response = await client.get("/api/v1/zalo/candidates", headers=headers[name])
            assert response.status_code == 200, response.text
            assert {q["id"] for q in response.json()["quotes"]} == {str(quotes[i].id)}
            contact = {"zalo_uid": "456", "consent": True, "consent_note": "Customer request"}
            response = await client.put(f"/api/v1/zalo/contacts/{leads[i].id}", headers=headers[name], json=contact)
            assert response.status_code == 200, response.text
            response = await client.put(f"/api/v1/zalo/contacts/{leads[1-i].id}", headers=headers[name], json=contact)
            assert response.status_code == 404
            response = await client.post("/api/v1/zalo/campaigns", headers=headers[name], json={
                "id": str(campaign_ids[i]), "name": "Personal quote", "template": "{model}: {price}",
                "quote_ids": [str(quotes[i].id)], "attach_pdf": i == 0})
            assert response.status_code == 201, response.text
        for i, name in enumerate(("seller", "second")):
            response = await client.get("/api/v1/zalo/campaigns", headers=headers[name])
            assert {c["id"] for c in response.json()["campaigns"]} == {str(campaign_ids[i])}
            response = await client.get(f"/api/v1/zalo/campaigns/{campaign_ids[1-i]}", headers=headers[name])
            assert response.status_code == 404
            response = await client.patch(f"/api/v1/zalo/campaigns/{campaign_ids[1-i]}", headers=headers[name], json={"status": "active"})
            assert response.status_code == 404
        response = await client.post("/api/v1/zalo/campaigns", headers=headers["second"], json={
            "id": str(campaign_ids[0]), "name": "Cannot claim", "template": "{model}", "quote_ids": [str(quotes[1].id)]})
        assert response.status_code == 409
        for name in ("other", "admin"):
            response = await client.get(f"/api/v1/zalo/campaigns/{campaign_ids[0]}", headers=headers[name])
            assert response.status_code == 404
        # The exact PDF preview is immutable and private to the sender.
        detail = await client.get(f"/api/v1/zalo/campaigns/{campaign_ids[0]}", headers=headers["seller"])
        delivery_id = detail.json()["deliveries"][0]["id"]
        pdf_url = f"/api/v1/zalo/campaigns/{campaign_ids[0]}/deliveries/{delivery_id}/pdf"
        preview = await client.get(pdf_url, headers=headers["seller"])
        assert preview.status_code == 200, preview.text[:100]
        assert preview.content.startswith(b"%PDF-")
        assert preview.headers["content-type"] == "application/pdf"
        for name in ("second", "other", "admin"):
            assert (await client.get(pdf_url, headers=headers[name])).status_code == 404
        assert (await client.get(pdf_url.replace(delivery_id, str(uuid4())), headers=headers["seller"])).status_code == 404
        plain = await client.get(f"/api/v1/zalo/campaigns/{campaign_ids[1]}", headers=headers["second"])
        plain_id = plain.json()["deliveries"][0]["id"]
        assert plain.json()["deliveries"][0]["pdf_name"] is None
        assert (await client.get(f"/api/v1/zalo/campaigns/{campaign_ids[1]}/deliveries/{plain_id}/pdf",
                                 headers=headers["second"])).status_code == 404
        await connection.execute(text("UPDATE quotes SET final_price=1 WHERE id=:id"), {"id": quotes[0].id})
        assert (await client.get(pdf_url, headers=headers["seller"])).content == preview.content
        # A permitted admin may contact the same lead using their own Zalo;
        # this must never overwrite the employee's recipient or consent.
        response = await client.put(f"/api/v1/zalo/contacts/{leads[0].id}", headers=headers["admin"], json={
            "zalo_uid": "456", "consent": True, "consent_note": "Separate admin customer request"})
        assert response.status_code == 200, response.text
        owners = (await connection.execute(text("SELECT user_id FROM zalo_contacts WHERE lead_id=:lead"),
                                           {"lead": leads[0].id})).scalars().all()
        assert set(owners) == {actors["seller"].id, actors["admin"].id}
        admin_campaign = uuid4()
        response = await client.post("/api/v1/zalo/campaigns", headers=headers["admin"], json={
            "id": str(admin_campaign), "name": "Admin personal quote", "template": "{model}",
            "quote_ids": [str(quotes[0].id)]})
        assert response.status_code == 201, response.text
        response = await client.get("/api/v1/zalo/campaigns", headers=headers["admin"])
        assert {c["id"] for c in response.json()["campaigns"]} == {str(admin_campaign)}
        for i, name in enumerate(("seller", "second")):
            response = await client.patch(f"/api/v1/zalo/campaigns/{campaign_ids[i]}", headers=headers[name], json={"status": "active"})
            assert response.status_code == 200, response.text

    from src import zalo_worker

    def worker_session():
        return AsyncSession(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)

    monkeypatch.setattr(zalo_worker, "AsyncSessionLocal", worker_session)
    with patch("src.zalo_worker.bridge", new_callable=AsyncMock, return_value={"status": "sent", "provider_id": "test"}) as service:
        await zalo_worker.tick(campaign_ids[0])
        await zalo_worker.tick(campaign_ids[1])
    assert [call.args[1] for call in service.call_args_list] == [actors["seller"].id, second.id]
    attachment = service.call_args_list[0].args[3]["attachment"]
    assert base64.b64decode(attachment["base64"]) == preview.content
    assert attachment["sha256"] == hashlib.sha256(preview.content).hexdigest()
    assert attachment["name"] == f"P97_BaoGia_{quotes[0].id}.pdf"
    assert "attachment" not in service.call_args_list[1].args[3]
    assert (await connection.execute(text("SELECT count(*) FROM zalo_deliveries WHERE campaign_id IN (:a,:b) AND status='sent'"),
                                     {"a": campaign_ids[0], "b": campaign_ids[1]})).scalar() == 2
