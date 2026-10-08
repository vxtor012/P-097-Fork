import pytest

from src import ai_data
from tests.ai_fixtures import catalog


@pytest.fixture(autouse=True)
def synthetic_ai_repository(monkeypatch):
    rows = catalog()
    monkeypatch.setattr(ai_data, "active_dataset", lambda: {"id": "test", "embedding_model": "text-embedding-3-small", "dimensions": 1536})
    monkeypatch.setattr(ai_data, "catalog_snapshot", lambda dataset_id: rows)
