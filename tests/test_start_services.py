"""Production startup must work without new Zalo settings or public bridge access."""

import hashlib
import hmac
import subprocess

import pytest

from scripts import start_services

SECRET = "existing-application-signing-secret-for-tests"


def test_embedded_runtime_uses_stable_distinct_credentials_without_mutating_existing_environment(tmp_path):
    original = {"JWT_SECRET": SECRET, "DATABASE_URL": "postgresql://existing/app", "PORT": "10000"}
    runtime, enabled = start_services.embedded_environment(original, tmp_path)
    again, _ = start_services.embedded_environment(original, tmp_path)
    assert enabled and runtime == again
    assert "ZALO_BRIDGE_TOKEN" not in original
    assert runtime["DATABASE_URL"] == original["DATABASE_URL"]
    assert runtime["JWT_SECRET"] == SECRET and runtime["PORT"] == "10000"
    assert runtime["ZALO_BRIDGE_URL"] == "http://127.0.0.1:8010"
    assert runtime["ZALO_BRIDGE_TOKEN"] != runtime["ZALO_SESSION_KEY"]
    assert runtime["ZALO_SESSION_KEY"] == hmac.new(SECRET.encode(), b"autoquote/zalo/session-key/v1", hashlib.sha256).hexdigest()
    assert not (tmp_path / ".local").exists()  # Planning never writes credentials or storage.


def test_configured_credentials_and_data_directory_are_preserved(tmp_path):
    configured = {"ZALO_BRIDGE_TOKEN": "configured-token-" * 3, "ZALO_SESSION_KEY": "ab" * 32,
                  "ZALO_DATA_DIR": str(tmp_path), "ZALO_BRIDGE_URL": "http://localhost:8010"}
    runtime, enabled = start_services.embedded_environment(configured)
    assert enabled
    for field in ("ZALO_BRIDGE_TOKEN", "ZALO_SESSION_KEY", "ZALO_DATA_DIR"):
        assert runtime[field] == configured[field]
    (tmp_path / "bridge.sqlite").touch()
    start_services.prepare_storage(runtime, configured_key=True)
    assert not (tmp_path / ".derived-session-key-v1").exists()


def test_external_bridge_is_not_reconfigured_or_given_derived_credentials():
    configured = {"JWT_SECRET": SECRET, "ZALO_BRIDGE_URL": "https://existing-bridge.invalid"}
    runtime, enabled = start_services.embedded_environment(configured)
    assert not enabled and runtime == configured
    assert "ZALO_BRIDGE_TOKEN" not in runtime


@pytest.mark.parametrize("url", ["https://localhost:8010", "http://127.0.0.1:8010/path",
                                     "http://127.0.0.1:8000", "http://user:password@localhost:8010"])
def test_invalid_local_configuration_does_not_silently_expose_the_bridge(url):
    with pytest.raises(RuntimeError):
        start_services.embedded_environment({"JWT_SECRET": SECRET, "ZALO_BRIDGE_URL": url})


def test_untracked_existing_session_is_never_replaced_with_a_derived_key(tmp_path):
    runtime, _ = start_services.embedded_environment({"JWT_SECRET": SECRET, "ZALO_DATA_DIR": str(tmp_path)})
    database = tmp_path / "bridge.sqlite"
    database.write_bytes(b"existing encrypted session")
    with pytest.raises(RuntimeError, match="original ZALO_SESSION_KEY"):
        start_services.prepare_storage(runtime, configured_key=False)
    assert database.read_bytes() == b"existing encrypted session"
    database.unlink()
    start_services.prepare_storage(runtime, configured_key=False)
    database.touch()
    start_services.prepare_storage(runtime, configured_key=False)
    assert runtime["ZALO_SESSION_KEY"] not in (tmp_path / ".derived-session-key-v1").read_text()


def test_missing_stable_signing_secret_is_not_replaced_with_a_random_key():
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        start_services.embedded_environment({})


def test_shutdown_terminates_and_reaps_every_child_even_when_one_requires_kill():
    class Child:
        def __init__(self, stuck=False):
            self.stuck = stuck
            self.terminated = self.killed = self.reaped = False

        def poll(self):
            return None

        def terminate(self):
            self.terminated = True

        def kill(self):
            self.killed = True

        def wait(self, timeout=None):
            if self.stuck and not self.killed:
                raise subprocess.TimeoutExpired("test-child", timeout)
            self.reaped = True

    children = [Child(), Child(stuck=True), Child()]
    start_services.stop_children(children)
    assert all(child.terminated and child.reaped for child in children)
    assert children[1].killed
