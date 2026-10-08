"""Import private AI snapshots without publishing source files or changing public data."""

import argparse
import csv
import hashlib
import json
import math
import os
import sys
import uuid
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

import psycopg2
from dotenv import load_dotenv
from psycopg2 import sql
from psycopg2.extras import Json, RealDictCursor, execute_values

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from src.ai_data import connection_url  # noqa: E402

TABLES = (
    "battery_rental_fees",
    "cars_catalog",
    "fee_rules",
    "promotions",
    "provinces",
    "rolling_cost_matrix",
    "trims_pricing",
    "vehicle_colors",
)
MODEL = "text-embedding-3-small"
DIMENSIONS = 1536
HEADERS = {
    "battery_rental_fees": {
        "car_name",
        "fee_tier3_vnd",
        "applies_to",
        "tier2_max_km",
        "tier1_max_km",
        "effective_from",
        "fee_tier2_vnd",
        "fee_tier1_vnd",
        "source_url",
        "battery_deposit_vnd",
    },
    "cars_catalog": {"vehicle_type", "default_product_id", "car_name", "car_id", "snapshot_datetime", "manufacturer"},
    "fee_rules": {"fee_code", "fixed_amount_vnd", "rate_percent", "description", "snapshot_datetime", "fee_name"},
    "promotions": {
        "loyalty_percent",
        "stack_policy",
        "promo_name",
        "tier",
        "promo_id",
        "voucher_values",
        "applies_to",
        "benefit_type",
        "audience",
        "discount_percent",
        "valid_to",
        "is_active",
        "promo_type",
        "valid_from",
        "description",
        "snapshot_datetime",
        "discount_amount_vnd",
        "channel",
    },
    "provinces": {
        "car_registration_fee_pct",
        "bike_registration_fee_pct",
        "bike_license_fee_high_vnd",
        "region_code",
        "province_id",
        "bike_license_fee_low_vnd",
        "car_license_plate_fee_vnd",
        "zone",
        "province_name",
        "snapshot_datetime",
        "bike_license_fee_medium_vnd",
    },
    "rolling_cost_matrix": {
        "trim_name",
        "snapshot_datetime",
        "road_fee_vnd",
        "car_name",
        "list_price_vnd",
        "battery_option",
        "inspection_fee_vnd",
        "license_plate_fee_vnd",
        "province_name",
        "mandatory_insurance_vnd",
        "registration_fee_vnd",
        "car_id",
        "total_rolling_cost_vnd",
    },
    "trims_pricing": {
        "trim_name",
        "snapshot_datetime",
        "car_name",
        "trim_id",
        "battery_option",
        "product_code",
        "deposit_amount_vnd",
        "car_id",
        "price_vat_vnd",
        "price_last_updated",
    },
    "vehicle_colors": {
        "vehicle_type",
        "trim_name",
        "color_name_vi",
        "color_hex",
        "car_name",
        "color_roof",
        "color_code",
        "image_url",
        "trim_code",
        "color_extra_price_vnd",
        "color_name",
        "total_car_price_vnd",
        "car_id",
        "snapshot_datetime",
        "color_type",
        "is_available",
    },
}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def validate_vector(vector, label):
    if (
        not isinstance(vector, list)
        or len(vector) != DIMENSIONS
        or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in vector)
        or not any(vector)
    ):
        raise ValueError(f"{label}: expected {DIMENSIONS} finite, nonzero embedding values")


def validate_web(config):
    if not isinstance(config, dict):
        raise ValueError("Web sources must be an object")
    domains = config.get("allowed_domains")
    sources = config.get("sources")
    if not isinstance(domains, list) or not domains or not isinstance(sources, dict):
        raise ValueError("Web sources require allowed_domains and sources")
    for domain in domains:
        if not isinstance(domain, str) or not domain or urlsplit("https://" + domain).hostname != domain:
            raise ValueError("Invalid allowed domain")
    for urls in sources.values():
        if not isinstance(urls, list):
            raise ValueError("Each web source must be a URL list")
        for url in urls:
            parsed = urlsplit(url)
            host = parsed.hostname or ""
            if (
                parsed.scheme != "https"
                or parsed.username
                or not any(host == domain or host.endswith("." + domain) for domain in domains)
            ):
                raise ValueError("Web source is outside the HTTPS allowlist")


def read_source(directory, web_file=None):
    directory = Path(directory)
    catalog, files = {}, {}
    for name in TABLES:
        path = directory / "rdb_schema" / f"{name}.csv"
        files[f"rdb_schema/{name}.csv"] = hashlib.sha256(path.read_bytes()).hexdigest()
        with path.open(encoding="utf-8-sig", newline="") as source:
            reader = csv.DictReader(source)
            if len(reader.fieldnames or []) != len(set(reader.fieldnames or [])):
                raise ValueError(f"{name}.csv: duplicate headers")
            if not HEADERS[name] <= set(reader.fieldnames or []):
                raise ValueError(f"{name}.csv: missing required headers")
            rows = list(reader)
        for index, row in enumerate(rows, 2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"{name}.csv:{index}: malformed row")
        catalog[name] = rows
        for index, row in enumerate(rows, 2):
            for field, value in row.items():
                if value and (field.endswith("_vnd") or field.endswith("_pct") or field.endswith("_percent")):
                    try:
                        number = float(value)
                        if not math.isfinite(number) or number < 0:
                            raise ValueError("invalid amount")
                        if field in {"price_vat_vnd", "total_rolling_cost_vnd"}:
                            int(value)
                    except ValueError as exc:
                        raise ValueError(f"{name}.csv:{index}: invalid numeric {field}") from exc
            for field in ("valid_from", "valid_to"):
                if row.get(field):
                    try:
                        date.fromisoformat(row[field])
                    except ValueError as exc:
                        raise ValueError(f"{name}.csv:{index}: invalid date {field}") from exc
    for name, key in (
        ("cars_catalog", "car_id"),
        ("trims_pricing", "trim_id"),
        ("provinces", "province_id"),
        ("promotions", "promo_id"),
    ):
        ids = [row[key] for row in catalog[name]]
        if any(not value for value in ids) or len(set(ids)) != len(ids):
            raise ValueError(f"{name}: missing or duplicate {key}")
    car_ids = {r["car_id"] for r in catalog["cars_catalog"]}
    provinces = {r["province_name"] for r in catalog["provinces"]}
    trims = {(r["car_id"], r["trim_name"]) for r in catalog["trims_pricing"]}
    for name in ("trims_pricing", "vehicle_colors", "rolling_cost_matrix"):
        for index, row in enumerate(catalog[name], 2):
            if row["car_id"] not in car_ids:
                raise ValueError(f"{name}.csv:{index}: unknown car_id")
            if name == "rolling_cost_matrix" and (
                row["province_name"] not in provinces or (row["car_id"], row["trim_name"]) not in trims
            ):
                raise ValueError(f"{name}.csv:{index}: unknown province/trim")
    if not catalog["cars_catalog"] or not catalog["trims_pricing"] or not catalog["provinces"]:
        raise ValueError("Catalog must contain cars, trims and provinces")
    path = directory / "vinfast_embeddings.jsonl"
    files[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    records, ids = [], set()
    with path.open(encoding="utf-8") as source:
        for index, line in enumerate(source, 1):
            if not line.strip():
                continue
            record = json.loads(line)
            key = record.get("chunk_id") or record.get("vehicle_id")
            label = f"{path.name}:{index} ({key})"
            if not isinstance(key, str) or not key or key in ids:
                raise ValueError(f"{label}: missing or duplicate record ID")
            if record.get("embedding_model") != MODEL:
                raise ValueError(f"{label}: unexpected embedding model")
            text = record.get("content") if record.get("record_type") == "chunk" else record.get("searchable_markdown")
            if not isinstance(text, str) or not text.strip() or not record.get("record_type"):
                raise ValueError(f"{label}: missing text/record_type")
            validate_vector(record.get("embedding"), label)
            canonical(record)
            records.append(record)
            ids.add(key)
    if not records:
        raise ValueError("No embedding records found")
    web = None
    if web_file:
        path = Path(web_file)
        files["web_sources.json"] = hashlib.sha256(path.read_bytes()).hexdigest()
        web = json.loads(path.read_text(encoding="utf-8"))
        validate_web(web)
    for relative, expected in files.items():
        path = Path(web_file) if relative == "web_sources.json" else directory / relative
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f"{relative}: source changed during validation; use a frozen snapshot")
    counts = {name: len(rows) for name, rows in catalog.items()}
    counts["knowledge_records"] = len(records)
    manifest = {"format_version": 1, "files": files}
    return {
        "catalog": catalog,
        "records": records,
        "web": web,
        "counts": counts,
        "manifest": manifest,
        "sha256": digest(manifest),
    }


def fingerprints(cur):
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    tables = [row["tablename"] for row in cur.fetchall()]
    result = {}
    for name in tables:
        cur.execute(
            sql.SQL(
                "SELECT count(*) AS n, md5(coalesce(string_agg(h, '' ORDER BY h),'')) AS hash "
                "FROM (SELECT md5(to_jsonb(t)::text) AS h FROM public.{} t) s"
            ).format(sql.Identifier(name))
        )
        result[name] = dict(cur.fetchone())
    return result


def verify(cur, dataset_id, source=None):
    cur.execute("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='ai_data'")
    security = {r["tablename"]: r["rowsecurity"] for r in cur.fetchall()}
    if not all(security.get(name) for name in ("datasets", "catalog_tables", "knowledge_records")):
        raise ValueError("AI schema is incomplete or RLS is disabled")
    cur.execute("""SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='ai_data' AND grantee IN ('PUBLIC','anon','authenticated') LIMIT 1""")
    if cur.fetchone():
        raise ValueError("Private AI tables have public grants")
    cur.execute("SELECT * FROM ai_data.datasets WHERE id=%s", (str(dataset_id),))
    dataset = cur.fetchone()
    if not dataset:
        raise ValueError("Dataset ID not found")
    if dataset["embedding_model"] != MODEL or dataset["dimensions"] != DIMENSIONS:
        raise ValueError("Dataset embedding metadata mismatch")
    if digest(dataset["manifest"]) != dataset["content_sha256"]:
        raise ValueError("Dataset manifest integrity mismatch")
    if dataset["web_sources"]:
        validate_web(dataset["web_sources"])
    cur.execute("SELECT * FROM ai_data.catalog_tables WHERE dataset_id=%s", (str(dataset_id),))
    tables = {row["table_name"]: row for row in cur.fetchall()}
    if set(tables) != set(TABLES):
        raise ValueError("Dataset catalog is incomplete")
    counts = {}
    for name, row in tables.items():
        counts[name] = len(row["rows"])
        if counts[name] != row["row_count"] or digest(row["rows"]) != row["content_sha256"]:
            raise ValueError(f"{name}: catalog integrity mismatch")
        if source and row["rows"] != source["catalog"][name]:
            raise ValueError(f"{name}: source content mismatch")
    cur.execute(
        "SELECT *, embedding::text AS vector FROM ai_data.knowledge_records WHERE dataset_id=%s", (str(dataset_id),)
    )
    records = cur.fetchall()
    counts["knowledge_records"] = len(records)
    if not records or counts != dataset["row_counts"]:
        raise ValueError("Dataset row counts mismatch")
    for row in records:
        original = row["original_record"]
        meta = original.get("metadata") or {}
        expected = {
            "record_id": original.get("chunk_id") or original.get("vehicle_id"),
            "record_type": original.get("record_type"),
            "category": meta.get("gold_topic") or original.get("category"),
            "title": meta.get("doc_title") or original.get("model_name"),
            "text": original.get("content")
            if original.get("record_type") == "chunk"
            else original.get("searchable_markdown"),
            "url": original.get("url"),
            "doc_id": original.get("doc_id"),
        }
        if original.get("embedding_model") != MODEL or any(row[k] != v for k, v in expected.items()):
            raise ValueError("Knowledge metadata differs from original record")
        validate_vector(original["embedding"], row["record_id"])
        stored = json.loads(row["vector"])
        if any(not math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-8) for a, b in zip(stored, original["embedding"])):
            raise ValueError("Stored vector differs from original embedding")
    if source:
        expected = {r.get("chunk_id") or r.get("vehicle_id"): r for r in source["records"]}
        if {r["record_id"]: r["original_record"] for r in records} != expected:
            raise ValueError("Knowledge source content mismatch")
        if dataset["content_sha256"] != source["sha256"] or dataset["web_sources"] != source["web"]:
            raise ValueError("Dataset manifest/web configuration mismatch")
    return {
        "dataset_id": str(dataset_id),
        "active": dataset["is_active"],
        "row_counts": counts,
        "sha256": dataset["content_sha256"],
    }


def activate(cur, dataset_id):
    verify(cur, dataset_id)
    cur.execute("UPDATE ai_data.datasets SET is_active=false WHERE is_active")
    cur.execute("UPDATE ai_data.datasets SET is_active=true WHERE id=%s", (str(dataset_id),))


def apply(cur, source, name):
    cur.execute("SELECT id FROM ai_data.datasets WHERE content_sha256=%s", (source["sha256"],))
    known = cur.fetchone()
    if known:
        return {"unchanged": True, **verify(cur, known["id"], source)}
    dataset_id = str(uuid.uuid4())
    cur.execute(
        """INSERT INTO ai_data.datasets
        (id,name,content_sha256,embedding_model,dimensions,row_counts,manifest,web_sources)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            dataset_id,
            name,
            source["sha256"],
            MODEL,
            DIMENSIONS,
            Json(source["counts"]),
            Json(source["manifest"]),
            Json(source["web"]) if source["web"] else None,
        ),
    )
    for table, rows in source["catalog"].items():
        cur.execute(
            "INSERT INTO ai_data.catalog_tables VALUES (%s,%s,%s,%s,%s)",
            (dataset_id, table, Json(rows), len(rows), digest(rows)),
        )
    values = []
    for record in source["records"]:
        metadata = record.get("metadata") or {}
        values.append(
            (
                dataset_id,
                record.get("chunk_id") or record.get("vehicle_id"),
                record["record_type"],
                metadata.get("gold_topic") or record.get("category"),
                metadata.get("doc_title") or record.get("model_name"),
                record.get("content") if record["record_type"] == "chunk" else record["searchable_markdown"],
                record.get("url"),
                record.get("doc_id"),
                json.dumps(record["embedding"]),
                Json(record),
            )
        )
    execute_values(
        cur,
        "INSERT INTO ai_data.knowledge_records VALUES %s",
        values,
        template="(%s,%s,%s,%s,%s,%s,%s,%s,%s::extensions.vector,%s)",
        page_size=25,
    )
    verify(cur, dataset_id, source)
    activate(cur, dataset_id)
    return {"unchanged": False, **verify(cur, dataset_id, source)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["plan", "apply", "check", "activate"])
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--web-sources-file", type=Path)
    parser.add_argument("--dataset-id", type=uuid.UUID)
    parser.add_argument("--name", default="Private AI snapshot")
    args = parser.parse_args()
    if args.mode in {"plan", "apply"} and not args.source_dir:
        parser.error("plan/apply require --source-dir")
    if args.mode == "activate" and not args.dataset_id:
        parser.error("activate requires --dataset-id")
    if args.web_sources_file and not args.source_dir:
        parser.error("--web-sources-file requires --source-dir")
    source = read_source(args.source_dir, args.web_sources_file) if args.source_dir else None
    if args.mode == "plan":
        print(json.dumps({"sha256": source["sha256"], "row_counts": source["counts"], "model": MODEL}))
        return
    load_dotenv(ROOT / ".env", override=False)
    url = connection_url(os.environ.get("MIGRATION_DATABASE_URL") or os.environ.get("DATABASE_URL", ""))
    options = {"connect_timeout": 15}
    ssl = os.environ.get("MIGRATION_SSLMODE")
    if ssl or (urlsplit(url).hostname or "").endswith((".supabase.com", ".supabase.co")):
        options["sslmode"] = ssl or "require"
    with psycopg2.connect(url, **options) as conn:
        conn.set_session(readonly=args.mode == "check")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL statement_timeout='60s'")
            cur.execute("SET LOCAL lock_timeout='5s'")
            if args.mode != "check":
                cur.execute("SELECT pg_advisory_xact_lock(97004)")
                before = fingerprints(cur)
            if args.mode == "apply":
                result = apply(cur, source, args.name)
            else:
                dataset_id = args.dataset_id
                if not dataset_id:
                    cur.execute("SELECT id FROM ai_data.datasets WHERE is_active")
                    row = cur.fetchone()
                    if not row:
                        raise ValueError("No active AI dataset; run apply first")
                    dataset_id = row["id"]
                if args.mode == "activate":
                    activate(cur, dataset_id)
                result = verify(cur, dataset_id, source)
            if args.mode != "check" and fingerprints(cur) != before:
                raise ValueError("Public data changed concurrently; import rolled back. Retry during a quiet window")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, psycopg2.Error) as exc:
        message = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        print(f"Import failed: {message}. No partial import was committed.", file=sys.stderr)
        sys.exit(1)
