#!/bin/bash
set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-vinfast_ai}"
DB_USER="${DB_USER:-vinfast}"

export PGPASSWORD="${DB_PASS:-vinfast123}"

echo "📐 Tạo bảng..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
     -f scripts/db/schema.sql

echo "🌱 Nhập dữ liệu mẫu..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
     -f scripts/db/seed.sql

echo ""
echo "✅ Xong! Kiểm tra:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT tablename, n_live_tup AS rows
FROM pg_stat_user_tables
ORDER BY tablename;
"
