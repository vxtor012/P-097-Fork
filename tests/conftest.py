from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.db import get_db
from src.main import app


@pytest_asyncio.fixture
async def client():
    """API unit tests use an empty database double, never the configured DB.

    Tests that need records can override get_db for their own scenario.
    Real PostgreSQL integration tests are separately opt-in.
    """
    session = AsyncMock()
    session.add = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    result.scalars.return_value.all.return_value = []
    session.execute.return_value = result

    async def empty_db():
        yield session

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = empty_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous


@pytest.fixture
def mock_llm():
    """Mock LLM to avoid calling OpenAI during tests.

    Usage in test:
        def test_something(mock_llm):
            # LLM calls will return mock response instead of hitting OpenAI
            ...
    """
    mock = AsyncMock()
    mock.ainvoke.return_value = AsyncMock(content="Mocked LLM response")
    return mock


@pytest.fixture
def operational_db():
    """ORM-shaped business records without a live database or network access."""
    from uuid import uuid4

    from tests.operational_fixtures import business_tables

    tables = business_tables()
    session = AsyncMock()
    session.add = MagicMock(side_effect=lambda obj: setattr(obj, "id", getattr(obj, "id", None) or uuid4()))

    async def execute(statement, *args, **kwargs):
        if not hasattr(statement, "column_descriptions"):
            return MagicMock()
        model = statement.column_descriptions[0]["entity"]
        rows = [model(**row) for row in tables.get(model.__tablename__, [])]
        result = MagicMock()
        result.scalars.return_value.all.return_value = rows
        result.scalar_one_or_none.return_value = rows[0] if rows else None
        return result

    session.execute.side_effect = execute

    async def dependency():
        yield session

    old = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = dependency
    try:
        yield session, tables
    finally:
        if old is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = old
