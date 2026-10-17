"""Environment precedence must not silently switch the application database."""

import json

from scripts import run_app


def test_existing_env_is_default_even_when_local_profile_exists(tmp_path, monkeypatch):
    monkeypatch.setattr(run_app, "ROOT", tmp_path)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("BACKEND_URL", raising=False)
    (tmp_path / "frontend").mkdir()
    (tmp_path / "frontend/.env.local").write_text("BACKEND_URL=https://existing-api.invalid\n")
    (tmp_path / ".env").write_text("DATABASE_URL=postgresql://existing-db/app\nJWT_SECRET=existing-secret\n")
    (tmp_path / ".local").mkdir()
    (tmp_path / ".local/app.json").write_text(
        json.dumps({"environment": {"DATABASE_URL": "postgresql://sample-db/app"}})
    )
    env, frontend, _, _, directory = run_app.load_environment(tmp_path / ".env")
    assert env["DATABASE_URL"] == "postgresql://existing-db/app"
    assert frontend["BACKEND_URL"] == "https://existing-api.invalid"
    assert "JWT_SECRET" not in frontend
    assert directory == tmp_path / ".runtime"


def test_process_environment_wins_over_env_file(tmp_path, monkeypatch):
    monkeypatch.setattr(run_app, "ROOT", tmp_path)
    (tmp_path / ".env").write_text("DATABASE_URL=postgresql://file-db/app\n")
    monkeypatch.setenv("DATABASE_URL", "postgresql://platform-db/app")
    env, _, _, _, _ = run_app.load_environment(tmp_path / ".env")
    assert env["DATABASE_URL"] == "postgresql://platform-db/app"
