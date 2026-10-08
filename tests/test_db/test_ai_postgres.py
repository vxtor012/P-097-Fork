"""Opt-in integration tests against an isolated local database with the AI migration.

Set AI_TEST_DATABASE_URL to PostgreSQL on localhost; never point it at production.
All writes roll back at fixture teardown.
"""

import os
from contextlib import contextmanager
from urllib.parse import urlsplit

import psycopg2
import pytest
from psycopg2.extras import RealDictCursor

from scripts.db import import_ai_data as importer
from src import ai_data
from tests.ai_fixtures import write_source


@pytest.fixture
def database(monkeypatch):
    url = os.environ.get("AI_TEST_DATABASE_URL")
    if not url:
        pytest.skip("AI_TEST_DATABASE_URL is not set")
    if urlsplit(url).hostname not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("Integration tests require an isolated localhost DB")
    conn = psycopg2.connect(url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    @contextmanager
    def cursor():
        yield cur

    monkeypatch.setattr(ai_data, "cursor", cursor)
    ai_data.catalog_snapshot.cache_clear()
    try:
        yield conn, cur
    finally:
        conn.rollback()
        cur.close()
        conn.close()
        ai_data.catalog_snapshot.cache_clear()


def test_import_repeat_ranking_filter_and_version_pin(database, tmp_path):
    _, cur = database
    write_source(tmp_path)
    source = importer.read_source(tmp_path)
    before = importer.fingerprints(cur)
    result = importer.apply(cur, source, "integration test")
    assert result["active"]
    assert importer.apply(cur, source, "repeat")["unchanged"]
    query = [1.0] + [0.0] * 1535
    matches = ai_data.retrieve(query, 3)
    assert [r["id"] for r in matches] == ["test-0", "test-1", "test-2"]
    assert [r["score"] for r in matches] == [1.0, 0.8, 0.0]
    assert [r["id"] for r in ai_data.retrieve(query, 1, "thong_so_va_chon_xe")] == ["test-1"]
    with ai_data.dataset_scope():
        old = ai_data.active_dataset()["id"]
        file = tmp_path / "rdb_schema" / "trims_pricing.csv"
        file.write_text(file.read_text().replace("699000000", "700000000"))
        newer = importer.apply(cur, importer.read_source(tmp_path), "new version")
        assert ai_data.active_dataset()["id"] == old
        assert ai_data.catalog_rows("trims_pricing")[0]["price_vat_vnd"] == "699000000"
    assert str(ai_data.active_dataset()["id"]) == newer["dataset_id"]
    importer.activate(cur, result["dataset_id"])
    assert str(ai_data.active_dataset()["id"]) == result["dataset_id"]
    assert importer.fingerprints(cur) == before


def test_partial_import_rolls_back_and_active_is_unique(database, tmp_path, monkeypatch):
    _, cur = database
    write_source(tmp_path)
    source = importer.read_source(tmp_path)
    cur.execute("SELECT id FROM ai_data.datasets WHERE is_active")
    old = cur.fetchone()
    cur.execute("SAVEPOINT failed_import")
    monkeypatch.setattr(importer, "verify", lambda *args: (_ for _ in ()).throw(ValueError("verification failed")))
    with pytest.raises(ValueError, match="verification failed"):
        importer.apply(cur, source, "invalid")
    cur.execute("ROLLBACK TO SAVEPOINT failed_import")
    cur.execute("SELECT id FROM ai_data.datasets WHERE is_active")
    assert cur.fetchone() == old
    cur.execute("SELECT count(*) AS n FROM ai_data.datasets WHERE content_sha256=%s", (source["sha256"],))
    assert cur.fetchone()["n"] == 0
    cur.execute("SAVEPOINT unique_active")
    with pytest.raises(psycopg2.IntegrityError):
        cur.execute("""INSERT INTO ai_data.datasets
            (id,name,content_sha256,embedding_model,dimensions,row_counts,manifest,is_active)
            SELECT gen_random_uuid(),'duplicate active',repeat('a',64),embedding_model,
                   dimensions,row_counts,manifest,true FROM ai_data.datasets WHERE is_active""")
    cur.execute("ROLLBACK TO SAVEPOINT unique_active")
