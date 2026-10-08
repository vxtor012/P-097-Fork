import asyncio
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Force UTF-8 stdout
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SUPABASE_URL = "postgresql+asyncpg://postgres.ddkeoxomfypnoqdcxwxa:Tckzeros.11@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

async def main():
    print("Connecting to Supabase PostgreSQL...")
    engine = create_async_engine(
        SUPABASE_URL,
        connect_args={
            "ssl": "require",
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    )

    schema_path = Path(__file__).resolve().parent / "schema.sql"
    seed_path = Path(__file__).resolve().parent / "seed.sql"

    with open(schema_path, encoding="utf-8") as f:
        schema_sql = f.read()

    with open(seed_path, encoding="utf-8") as f:
        seed_sql = f.read()

    # In modern Postgres/Supabase, replace uuid_generate_v4() with gen_random_uuid()
    schema_sql = schema_sql.replace("uuid_generate_v4()", "gen_random_uuid()")

    async with engine.begin() as conn:
        print("Executing schema.sql...")
        for stmt in schema_sql.split(";"):
            cleaned = stmt.strip()
            if cleaned:
                try:
                    await conn.execute(text(cleaned))
                except Exception as e:
                    err_msg = str(e)
                    if "already exists" in err_msg:
                        continue
                    print(f"Notice on schema: {cleaned[:35]}... -> {err_msg[:60]}")

        # Ensure DEFAULT gen_random_uuid() on tables
        for tbl in ["dealers", "users", "vehicle_prices", "battery_prices", "accessories", "rolling_costs", "promotions", "inventory", "leads", "quotes", "audit_logs"]:
            try:
                await conn.execute(text(f"ALTER TABLE IF EXISTS {tbl} ALTER COLUMN id SET DEFAULT gen_random_uuid();"))
            except Exception:
                pass

        print("Executing seed.sql...")
        for stmt in seed_sql.split(";"):
            cleaned = stmt.strip()
            if cleaned:
                try:
                    await conn.execute(text(cleaned))
                except Exception as e:
                    err_msg = str(e)
                    if "already exists" in err_msg or "duplicate key" in err_msg or "violates foreign key constraint" in err_msg:
                        continue
                    print(f"Notice on seed: {cleaned[:35]}... -> {err_msg[:80]}")

    async with engine.connect() as conn:
        res = await conn.execute(text("""
            SELECT relname AS table_name, n_live_tup AS row_count
            FROM pg_stat_user_tables
            ORDER BY relname;
        """))
        print("\n--- Supabase Tables Summary ---")
        for row in res.fetchall():
            print(f"- {row[0]}: {row[1]} rows")

    await engine.dispose()
    print("\n✅ Supabase migration and seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
