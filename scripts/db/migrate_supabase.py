"""Check, bootstrap, or upgrade the configured PostgreSQL database.

No hardcoded credentials, no automatic seed on upgrade, no ignored SQL errors.
Run from any directory: python scripts/db/migrate_supabase.py --help
"""

import argparse
import ast
import asyncio
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import asyncpg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase" / "migrations"


class OperationError(ValueError):
    """An actionable error message that contains no credentials or row data."""


def connection_url(value: str) -> str:
    """Accept SQLAlchemy's asyncpg prefix, but reject unsupported protocols."""
    if value.startswith("postgresql+asyncpg://"):
        value = value.replace("postgresql+asyncpg://", "postgresql://", 1)
    if urlsplit(value).scheme not in {"postgresql", "postgres"}:
        raise OperationError("Set MIGRATION_DATABASE_URL or DATABASE_URL to a PostgreSQL URL")
    if not urlsplit(value).hostname:
        raise OperationError("Database URL must include a host")
    return value


def target_label(value: str) -> str:
    """Show the target without exposing password or query-string secrets."""
    parsed = urlsplit(value)
    host = parsed.hostname or ""
    if ":" in host:
        host = f"[{host}]"
    if parsed.port:
        host += f":{parsed.port}"
    return urlunsplit((parsed.scheme, host, parsed.path, "", ""))


def expected_columns() -> dict[str, set[str]]:
    """Read ORM declarations without importing the application's engine."""
    tree = ast.parse((ROOT / "src" / "orm_models.py").read_text(encoding="utf-8"))
    expected = {}
    for cls in (node for node in tree.body if isinstance(node, ast.ClassDef)):
        table = None
        columns = set()
        for node in cls.body:
            if not isinstance(node, ast.Assign) or not isinstance(node.targets[0], ast.Name):
                continue
            name = node.targets[0].id
            if name == "__tablename__":
                table = ast.literal_eval(node.value)
            elif isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Name):
                if node.value.func.id == "Column":
                    columns.add(name)
        if table:
            expected[table] = columns
    return expected


async def inspect(conn) -> dict:
    records = await conn.fetch("""
        SELECT table_name, column_name, data_type, character_maximum_length
        FROM information_schema.columns WHERE table_schema = 'public'
    """)
    actual = {}
    types = {}
    for record in records:
        actual.setdefault(record["table_name"], set()).add(record["column_name"])
        types[(record["table_name"], record["column_name"])] = (
            record["data_type"], record["character_maximum_length"]
        )
    expected = expected_columns()
    missing = {table: sorted(cols - actual.get(table, set()))
               for table, cols in expected.items() if cols - actual.get(table, set())}
    wrong_types = []
    for column, length in (("image_url", 500), ("roof_hex", 7)):
        value = types.get(("vehicle_prices", column))
        if value is not None and value != ("character varying", length):
            wrong_types.append(f"vehicle_prices.{column}: {value}")
    counts = {}
    for table in sorted(set(expected) & set(actual)):
        # Table names come only from the local ORM, not from user input.
        counts[table] = await conn.fetchval(f'SELECT count(*) FROM public."{table}"')
    tables = sorted(set(expected) & set(actual))
    if "chat_sessions" in actual:
        tables.append("chat_sessions")
    security = await conn.fetch("""
        SELECT tablename, rowsecurity FROM pg_tables
        WHERE schemaname = 'public' AND tablename = ANY($1::text[])
        ORDER BY tablename
    """, tables)
    privileges = await conn.fetch("""
        SELECT grantee, table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])
          AND grantee IN ('anon','authenticated','PUBLIC')
        ORDER BY table_name, grantee, privilege_type
    """, tables)
    missing_indexes = await conn.fetch("""
        SELECT c.conrelid::regclass::text AS table_name, c.conname AS foreign_key
        FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
        JOIN pg_class tbl ON tbl.oid = c.conrelid
        WHERE c.contype = 'f' AND n.nspname = 'public'
          AND tbl.relname = ANY($1::text[])
          AND NOT EXISTS (
            SELECT 1 FROM pg_index i
            WHERE i.indrelid = c.conrelid AND i.indisvalid AND i.indpred IS NULL
              AND (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey
          )
    """, tables)
    required_indexes = await conn.fetch("""
        SELECT ic.relname AS name, i.indisunique, i.indisvalid,
               pg_get_expr(i.indpred, i.indrelid) AS predicate,
               ARRAY(SELECT a.attname::text
                     FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(num, ord)
                     JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.num
                     ORDER BY k.ord) AS columns
        FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid
        JOIN pg_namespace n ON n.oid=ic.relnamespace
        WHERE n.nspname='public'
          AND ic.relname IN ('ux_vehicle_prices_current_configuration','ux_inventory_configuration')
    """)
    specifications = {
        "ux_vehicle_prices_current_configuration": (["model", "version", "color"], "(effective_to IS NULL)"),
        "ux_inventory_configuration": (["dealer_id", "model", "version", "color"], None),
    }
    valid_indexes = {row["name"] for row in required_indexes
                     if row["indisunique"] and row["indisvalid"]
                     and (row["columns"], row["predicate"]) == specifications[row["name"]]}
    return {
        "missing_columns": missing,
        "wrong_column_types": wrong_types,
        "row_counts": counts,
        "rls": [dict(row) for row in security],
        "public_privileges": [dict(row) for row in privileges],
        "unindexed_foreign_keys": [dict(row) for row in missing_indexes],
        "missing_or_invalid_unique_indexes": sorted(set(specifications) - valid_indexes),
    }


async def prepare_history(conn) -> None:
    # Same minimal structure as the Supabase CLI; existing optional columns stay intact.
    await conn.execute("""
        CREATE SCHEMA IF NOT EXISTS supabase_migrations;
        CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
            version TEXT PRIMARY KEY, statements TEXT[], name TEXT
        );
        REVOKE ALL ON SCHEMA supabase_migrations FROM PUBLIC;
        REVOKE ALL ON TABLE supabase_migrations.schema_migrations FROM PUBLIC;
    """)


async def apply_pending(conn) -> list[str]:
    applied = []
    await prepare_history(conn)
    for path in sorted(MIGRATIONS.glob("*.sql")):
        match = re.fullmatch(r"(\d{14})_(.+)\.sql", path.name)
        if not match:
            raise OperationError(f"Invalid migration filename: {path.name}")
        version, name = match.groups()
        known = await conn.fetchrow(
            "SELECT name FROM supabase_migrations.schema_migrations WHERE version = $1",
            version,
        )
        if known:
            if known["name"] != name:
                raise OperationError(f"Migration history conflicts with {path.name}")
            continue
        sql = path.read_text(encoding="utf-8")
        # Simple-query execution supports whole SQL files, including dollar-quoted DO blocks.
        # Never split SQL on semicolons; never ignore a failed statement.
        await conn.execute(sql)
        await conn.execute(
            "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) "
            "VALUES ($1, $2, $3)", version, name, [sql],
        )
        applied.append(path.name)
    return applied


async def run(conn, mode: str, seed: bool = False) -> dict:
    async with conn.transaction(readonly=mode == "check"):
        # Serialize cooperating bootstrap/upgrade runners; check stays read-only.
        if mode != "check":
            await conn.execute("SET LOCAL lock_timeout = '5s'")
            await conn.execute("SET LOCAL statement_timeout = '60s'")
            await conn.execute("SET LOCAL search_path = public, pg_catalog")
            await conn.execute("SELECT pg_advisory_xact_lock(97004)")
        before = await inspect(conn)
        if mode == "check":
            return before
        if mode == "bootstrap":
            if before["row_counts"]:
                raise OperationError("Application tables already exist; use check/upgrade, not bootstrap")
            await conn.execute((ROOT / "scripts/db/schema.sql").read_text(encoding="utf-8"))
            if seed:
                await conn.execute((ROOT / "scripts/db/seed.sql").read_text(encoding="utf-8"))
        elif mode == "upgrade":
            allowed = {"image_url", "roof_hex"}
            unsupported = {table: cols for table, cols in before["missing_columns"].items()
                           if table != "vehicle_prices" or not set(cols) <= allowed}
            if unsupported or before["wrong_column_types"]:
                raise OperationError(
                    f"Unsupported schema drift: {unsupported}; types: {before['wrong_column_types']}. "
                    "Inspect and create a dedicated migration."
                )
            if not before["row_counts"]:
                raise OperationError("No application tables found; use bootstrap")
        applied = await apply_pending(conn)
        after = await inspect(conn)
        if after["missing_columns"] or after["wrong_column_types"]:
            raise OperationError("Schema validation failed; transaction will be rolled back")
        if after["public_privileges"] or any(not row["rowsecurity"] for row in after["rls"]):
            raise OperationError("Table-access validation failed; transaction will be rolled back")
        if after["unindexed_foreign_keys"]:
            raise OperationError("Foreign-key index validation failed; transaction will be rolled back")
        if after["missing_or_invalid_unique_indexes"]:
            raise OperationError("Unique-index validation failed; transaction will be rolled back")
        if mode == "upgrade" and after["row_counts"] != before["row_counts"]:
            raise OperationError("Unexpected row-count change; transaction will be rolled back")
        return {"applied": applied, **after}


async def main(args) -> int:
    load_dotenv(ROOT / ".env", override=False)
    value = os.environ.get("MIGRATION_DATABASE_URL") or os.environ.get("DATABASE_URL", "")
    url = connection_url(value)
    print(f"Mode: {args.mode}; target: {target_label(url)}")
    host = urlsplit(url).hostname or ""
    ssl = os.environ.get("MIGRATION_SSLMODE")
    if ssl is None and host.endswith((".supabase.com", ".supabase.co")):
        ssl = "require"
    options = {"ssl": ssl} if ssl else {}
    conn = await asyncpg.connect(url, timeout=15, command_timeout=60,
                                statement_cache_size=0, **options)
    try:
        result = await run(conn, args.mode, getattr(args, "seed", False))
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.mode == "check":
            bad = (result["missing_columns"] or result["wrong_column_types"]
                   or result["public_privileges"] or result["unindexed_foreign_keys"]
                   or result["missing_or_invalid_unique_indexes"]
                   or any(not row["rowsecurity"] for row in result["rls"]))
            return 1 if bad else 0
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="mode", required=True)
    commands.add_parser("check", help="Read-only schema, row-count and table-access report")
    bootstrap = commands.add_parser("bootstrap", help="Create application tables in a fresh database")
    bootstrap.add_argument("--seed", action="store_true", help="Load demo snapshot once")
    commands.add_parser("upgrade", help="Apply pending migrations without loading seed")
    try:
        sys.exit(asyncio.run(main(parser.parse_args())))
    except OperationError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    except (TimeoutError, asyncpg.PostgresError, OSError, ValueError) as exc:
        # Database error text can contain connection details or row data. Keep it private.
        print(f"Failed ({type(exc).__name__}); no SQL error was ignored. "
              "Verify the target, credentials and schema before retrying.", file=sys.stderr)
        sys.exit(1)
