from unittest.mock import AsyncMock, MagicMock

import asyncpg
import pytest

from scripts.db import migrate_supabase as migration


def test_database_url_accepts_asyncpg_and_redacts_secrets():
    value = "postgresql+asyncpg://postgres:secret%40value@db.example.com:5432/postgres?token=secret"
    url = migration.connection_url(value)
    assert url.startswith("postgresql://")
    assert migration.target_label(url) == "postgresql://db.example.com:5432/postgres"


@pytest.mark.parametrize("value", ["", "sqlite:///data.db", "https://db.example.com"])
def test_non_postgresql_configuration_is_rejected(value):
    with pytest.raises(migration.OperationError):
        migration.connection_url(value)


def test_check_may_fallback_to_application_database(monkeypatch):
    monkeypatch.delenv("MIGRATION_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://readonly.example.com/postgres")
    assert migration.migration_target("check") == "postgresql://readonly.example.com/postgres"


@pytest.mark.parametrize("mode", ["bootstrap", "upgrade"])
def test_write_modes_require_explicit_migration_database(monkeypatch, mode):
    monkeypatch.delenv("MIGRATION_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://application.example.com/postgres")
    with pytest.raises(migration.OperationError, match="MIGRATION_DATABASE_URL must be set explicitly"):
        migration.migration_target(mode)


def test_upgrade_allows_only_reviewed_pricing_policy_additions():
    row_counts = {"conversation_threads": 25}
    assert migration.supported_upgrade_missing(
        "conversation_threads", ["guest_secret_hash", "user_id"], row_counts
    )
    assert migration.supported_upgrade_missing(
        "pricing_policies", ["id", "version", "effective_from", "effective_to", "rules"], row_counts
    )
    assert migration.supported_upgrade_missing(
        "eligibility_verifications",
        ["id", "session_id", "dealer_id", "attribute", "value", "status", "evidence_ref",
         "verified_by", "verified_at", "created_at", "events"],
        row_counts,
    )


def test_upgrade_rejects_partial_or_unknown_additive_schema():
    assert not migration.supported_upgrade_missing("pricing_policies", ["id", "version"], {})
    assert not migration.supported_upgrade_missing("unknown_table", ["unexpected_column"], {})


@pytest.mark.asyncio
async def test_bootstrap_refuses_existing_database_before_writing_schema(monkeypatch):
    conn = MagicMock()
    conn.transaction.return_value = AsyncMock()
    conn.execute = AsyncMock()
    monkeypatch.setattr(migration, "inspect", AsyncMock(return_value={"row_counts": {"quotes": 31}}))
    with pytest.raises(migration.OperationError, match="already exist"):
        await migration.run(conn, "bootstrap", seed=True)
    assert all("CREATE" not in call.args[0] and "INSERT" not in call.args[0] for call in conn.execute.call_args_list)
    assert conn.transaction.return_value.__aexit__.call_args.args[0] is migration.OperationError


@pytest.mark.asyncio
async def test_failed_sql_is_not_recorded_as_applied(tmp_path, monkeypatch):
    sql = "DO $$ BEGIN PERFORM 1; PERFORM 2; END $$;"
    (tmp_path / "20261008030728_test.sql").write_text(sql, encoding="utf-8")
    monkeypatch.setattr(migration, "MIGRATIONS", tmp_path)
    conn = MagicMock()
    conn.execute = AsyncMock(side_effect=[None, asyncpg.PostgresSyntaxError("broken SQL")])
    conn.fetchrow = AsyncMock(return_value=None)
    with pytest.raises(asyncpg.PostgresSyntaxError):
        await migration.apply_pending(conn)
    assert conn.execute.call_args_list[1].args == (sql,)
    assert not any("INSERT INTO supabase_migrations" in call.args[0] for call in conn.execute.call_args_list)


@pytest.mark.asyncio
async def test_legacy_cloud_history_skips_incompatible_local_baseline(tmp_path, monkeypatch):
    (tmp_path / "20261014070000_complete_business_workflows.sql").write_text(
        "SELECT 'local baseline'", encoding="utf-8"
    )
    (tmp_path / "20261015060000_bridge_legacy_business_workflows.sql").write_text(
        "SELECT 'explicit bridge'", encoding="utf-8"
    )
    monkeypatch.setattr(migration, "MIGRATIONS", tmp_path)
    conn = MagicMock()
    conn.execute = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)
    conn.fetchval = AsyncMock(return_value=True)
    result = await migration.apply_pending(conn)
    assert result == ["20261015060000_bridge_legacy_business_workflows.sql"]
    assert not any(call.args[0] == "SELECT 'local baseline'" for call in conn.execute.call_args_list)
    assert any(call.args[0] == "SELECT 'explicit bridge'" for call in conn.execute.call_args_list)


@pytest.mark.asyncio
async def test_upgrade_rolls_back_if_row_counts_change(monkeypatch):
    conn = MagicMock()
    conn.transaction.return_value = AsyncMock()
    conn.execute = AsyncMock()
    report = {
        "missing_columns": {},
        "wrong_column_types": [],
        "row_counts": {"quotes": 31},
        "public_privileges": [],
        "rls": [],
        "unindexed_foreign_keys": [],
        "missing_or_invalid_unique_indexes": [],
    }
    changed = {**report, "row_counts": {"quotes": 30}}
    monkeypatch.setattr(migration, "inspect", AsyncMock(side_effect=[report, changed]))
    monkeypatch.setattr(migration, "apply_pending", AsyncMock(return_value=[]))
    with pytest.raises(migration.OperationError, match="row-count change"):
        await migration.run(conn, "upgrade")
    assert conn.transaction.return_value.__aexit__.call_args.args[0] is migration.OperationError
