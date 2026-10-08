# Database migrations

`migrations/20261008030728_harden_autoquote_database.sql` is an additive upgrade
for an existing application database. Its version matches the migration applied
to P097. Do not edit an already-applied migration; create the next one with
`supabase migration new <name>`.

This directory is not a complete fresh-database baseline. Use the repository
runner rather than applying migrations alone to an empty project:

```bash
python scripts/db/migrate_supabase.py bootstrap
# Demo data, fresh database only:
python scripts/db/migrate_supabase.py bootstrap --seed
# Existing application database:
python scripts/db/migrate_supabase.py upgrade
# Read-only verification:
python scripts/db/migrate_supabase.py check
```

The runner reads `MIGRATION_DATABASE_URL`, falling back to `DATABASE_URL` from
environment variables or the repository `.env`. It applies SQL in a transaction
and records pending versions in `supabase_migrations.schema_migrations` so the
history is shared with Supabase's tooling. Bootstrap uses `scripts/db/schema.sql`;
upgrade never loads `seed.sql`. Duplicate current prices abort the unique-index
migration instead of deleting or rewriting data.

Tables are accessed through FastAPI using the owner/admin PostgreSQL connection.
Public Supabase browser roles have no table privileges or RLS policies. A custom
backend role needs a reviewed access configuration before use. RLS does not
replace authentication and authorization in FastAPI.

See [public deployment](../docs/CLOUD_DEPLOYMENT.md) for hosting and
[private data import](../docs/SUPABASE_DATA_IMPORT.md) for backup, schema setup,
import and rollback. Deployment does not run seed, pipeline or import.

## Private AI snapshots

`add_private_ai_data` installs pgvector and creates the private `ai_data` schema.
The backend reads catalog snapshots and searches vector records in PostgreSQL.
Run `python scripts/db/import_ai_data.py --help` from the administrator machine.
Source CSV/JSONL files remain private and are not included in Git or Docker.

AI import does not rewrite `public` prices/promotions or business/demo records.
Mock operations remain explicit via `scripts/db/mock_data.py`; migrations do not
implicitly regenerate data.
