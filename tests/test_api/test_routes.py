import pytest


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_chat_empty_message(client):
    response = await client.post("/api/v1/chat", json={"message": ""})
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_chat_returns_agent_answer_and_session(client, monkeypatch):
    from contextlib import nullcontext

    from src.api import routes

    class FakeAgent:
        def invoke(self, state, config):
            assert state["messages"][-1].content == "Giá VF 6?"
            assert state["vehicle_context"] == {
                "model": "VF 6",
                "version": "Plus",
                "color": "Trắng",
                "province": "Hà Nội",
                "battery": "rent",
                "accessories": [],
            }
            assert config["configurable"]["thread_id"] == "68b3b8c2-6e21-4c3f-b070-e7ae05c6b6fe"
            return {"answer": "Giá theo catalog là 699 triệu đồng."}

    monkeypatch.setattr(routes, "agent", FakeAgent())
    monkeypatch.setattr(routes, "dataset_scope", nullcontext)
    response = await client.post(
        "/api/v1/chat",
        json={
            "message": "Giá VF 6?",
            "session_id": "68b3b8c2-6e21-4c3f-b070-e7ae05c6b6fe",
            "vehicle_context": {
                "model": "VF 6",
                "version": "Plus",
                "color": "Trắng",
                "province": "Hà Nội",
                "battery": "rent",
                "accessories": [],
            },
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "response": "Giá theo catalog là 699 triệu đồng.",
        "analysis": None,
        "session_id": "68b3b8c2-6e21-4c3f-b070-e7ae05c6b6fe",
        "configuration_update": None,
    }


@pytest.mark.asyncio
async def test_chat_database_error_is_redacted(client, monkeypatch):
    from src.api import routes

    def unavailable(*args):
        raise RuntimeError("postgresql://private-password@private-host")

    monkeypatch.setattr(routes, "_invoke_agent", unavailable)
    response = await client.post("/api/v1/chat", json={"message": "Giá xe?"})
    assert response.status_code == 503
    assert "private-password" not in response.text


@pytest.mark.asyncio
async def test_agent_status(client):
    response = await client.get("/api/v1/status")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_list_vehicles(client):
    response = await client.get("/api/v1/vehicles")
    assert response.status_code == 200
    data = response.json()
    assert "vehicles" in data
    # Empty business tables must not silently inject mock vehicle records.
    assert data["vehicles"] == {}
    assert data["data_source"] == "postgresql/public"
