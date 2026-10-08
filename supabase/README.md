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

See the [single public deployment and operations guide](../docs/CLOUD_DEPLOYMENT.md) for database setup, backup, restore, and hosting.

## Dữ liệu demo nghiệp vụ

`bootstrap --seed` tạo catalog demo và bộ buyer/chat/lead/quote/tồn kho liên kết. Với DB đã có catalog, dùng `scripts/db/mock_data.py plan/apply/check`; không chạy lại `seed.sql`. Quy trình mock nằm trong phần B của [guide duy nhất](../docs/CLOUD_DEPLOYMENT.md). Migration schema không tự nạp hoặc sửa mock.
