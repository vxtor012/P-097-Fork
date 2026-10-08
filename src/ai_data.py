"""Private PostgreSQL AI snapshots. No filesystem data fallback."""

import json
import math
from contextlib import contextmanager
from contextvars import ContextVar
from functools import lru_cache, wraps
from threading import Lock
from urllib.parse import urlsplit

from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

from src.config import get_settings

_dataset = ContextVar("ai_dataset", default=None)
_pool_lock = Lock()
_pool = None


def connection_url(value):
    value = value.replace("postgresql+asyncpg://", "postgresql://", 1)
    value = value.replace("postgresql+psycopg2://", "postgresql://", 1)
    if urlsplit(value).scheme not in {"postgres", "postgresql"}:
        raise ValueError("AI data requires a PostgreSQL DATABASE_URL")
    return value


@contextmanager
def cursor():
    global _pool
    with _pool_lock:
        if _pool is None:
            url = connection_url(get_settings().database_url)
            options = {"connect_timeout": 10, "options": "-c statement_timeout=15000"}
            if (urlsplit(url).hostname or "").endswith((".supabase.com", ".supabase.co")):
                options["sslmode"] = "require"
            _pool = ThreadedConnectionPool(1, 4, url, **options)
    conn = _pool.getconn()
    try:
        conn.set_session(readonly=True)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
    finally:
        try:
            conn.rollback()
        finally:
            _pool.putconn(conn, close=bool(conn.closed))


def active_dataset():
    pinned = _dataset.get()
    if pinned is not None:
        return pinned
    with cursor() as cur:
        cur.execute("SELECT id, embedding_model, dimensions FROM ai_data.datasets WHERE is_active")
        result = cur.fetchone()
    if not result:
        raise RuntimeError("Supabase has no active AI dataset; run import_ai_data.py apply/check")
    return dict(result)


@contextmanager
def dataset_scope():
    token = _dataset.set(active_dataset())
    try:
        yield
    finally:
        _dataset.reset(token)


def pinned(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        with dataset_scope():
            return function(*args, **kwargs)

    return wrapped


@lru_cache(maxsize=2)
def catalog_snapshot(dataset_id):
    with cursor() as cur:
        cur.execute("SELECT table_name, rows FROM ai_data.catalog_tables WHERE dataset_id=%s", (str(dataset_id),))
        rows = {r["table_name"]: r["rows"] for r in cur.fetchall()}
    if len(rows) != 8:
        raise RuntimeError("AI catalog snapshot is incomplete; run import_ai_data.py check")
    return rows


def catalog_rows(name):
    return catalog_snapshot(active_dataset()["id"])[name.removesuffix(".csv")]


def provenance(table=None):
    suffix = f"/{table.removesuffix('.csv')}" if table else ""
    return f"supabase/ai_data{suffix}@{active_dataset()['id']}"


def web_sources():
    with cursor() as cur:
        cur.execute("SELECT web_sources FROM ai_data.datasets WHERE id=%s", (str(active_dataset()["id"]),))
        config = cur.fetchone()["web_sources"]
    if not config:
        raise RuntimeError("AI dataset has no web source configuration")
    return config


def retrieve(vector, top_k=5, category=None):
    dataset = active_dataset()
    if (
        len(vector) != dataset["dimensions"]
        or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in vector)
        or not any(vector)
    ):
        raise ValueError("Invalid query embedding")
    encoded = json.dumps(vector)
    with cursor() as cur:
        cur.execute(
            """
            SELECT record_type, record_id AS id, doc_id, title, category AS topic,
                   1 - (embedding OPERATOR(extensions.<=>) %s::extensions.vector) AS score,
                   url, left(text,1600) AS text
            FROM ai_data.knowledge_records
            WHERE dataset_id=%s AND (%s::text IS NULL OR category=%s)
            ORDER BY embedding OPERATOR(extensions.<=>) %s::extensions.vector, record_id
            LIMIT %s
        """,
            (encoded, str(dataset["id"]), category, category, encoded, max(1, min(top_k, 8))),
        )
        result = [dict(row) for row in cur.fetchall()]
    for row in result:
        row["score"] = round(row["score"], 4)
    return result
