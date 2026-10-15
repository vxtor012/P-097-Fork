import pytest

from src import ai_data, operational_data
from tests.ai_fixtures import catalog


@pytest.fixture(autouse=True)
def synthetic_ai_repository(monkeypatch):
    rows = catalog()
    monkeypatch.setattr(
        ai_data,
        "active_dataset",
        lambda: {"id": "test", "embedding_model": "text-embedding-3-small", "dimensions": 1536},
    )
    monkeypatch.setattr(ai_data, "catalog_snapshot", lambda dataset_id: rows)
    # These tests exercise tool reasoning with invented records. Live public
    # repository wiring is tested separately in test_data_sync.py.
    monkeypatch.setattr(operational_data, "load_tables", lambda: {})
    monkeypatch.setattr(operational_data, "catalog_rows", lambda name: rows[name.removesuffix(".csv")])
