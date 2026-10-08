#!/usr/bin/env bash
set -euo pipefail

# Same guarded runner as Supabase; reads .env instead of hardcoded credentials.
# Usage: bash scripts/db/init_db.sh bootstrap --seed
# Existing database: bash scripts/db/init_db.sh upgrade
task_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec python "$task_script_dir/migrate_supabase.py" "$@"
