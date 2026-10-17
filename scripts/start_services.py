"""Run the production API and its private Zalo services in one container.

Existing external bridge settings keep the separate-service deployment path.
The embedded path uses the existing signing secret; no new settings are required.
"""

import hashlib
import hmac
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BRIDGE_PORT = 8010


def embedded_environment(environment, home=None):
    env = dict(environment)
    url = urlsplit(env.get("ZALO_BRIDGE_URL") or f"http://127.0.0.1:{BRIDGE_PORT}")
    if url.hostname not in {"127.0.0.1", "localhost", "::1"}:
        return env, False
    if url.scheme != "http" or url.path not in {"", "/"} or url.username or url.password or url.query or url.fragment:
        raise RuntimeError("The embedded Zalo bridge requires a private localhost HTTP URL")
    if url.port not in {None, BRIDGE_PORT}:
        raise RuntimeError("The embedded Zalo bridge requires port 8010")
    token = env.get("ZALO_BRIDGE_TOKEN") or ""
    session_key = env.get("ZALO_SESSION_KEY") or ""
    if not token or not session_key:
        signing_secret = env.get("JWT_SECRET", "")
        if len(signing_secret) < 32:
            raise RuntimeError("Embedded Zalo requires the existing stable JWT_SECRET (at least 32 characters)")

        def derive(purpose):
            return hmac.new(signing_secret.encode(), f"autoquote/zalo/{purpose}/v1".encode(), hashlib.sha256).hexdigest()

        token = token or derive("bridge-token")
        session_key = session_key or derive("session-key")
    if len(token) < 32 or not re.fullmatch(r"[a-fA-F0-9]{64}", session_key):
        raise RuntimeError("Existing Zalo credentials have an invalid format")
    env.update({
        "ZALO_BRIDGE_URL": f"http://127.0.0.1:{BRIDGE_PORT}",
        "ZALO_BRIDGE_TOKEN": token,
        "ZALO_SESSION_KEY": session_key,
        "ZALO_DATA_DIR": env.get("ZALO_DATA_DIR") or str((home or Path.home()) / ".local/share/autoquote/zalo"),
    })
    return env, True


def prepare_storage(environment, configured_key):
    directory = Path(environment["ZALO_DATA_DIR"])
    marker = directory / ".derived-session-key-v1"
    if not configured_key and (directory / "bridge.sqlite").exists() and not marker.exists():
        raise RuntimeError("Existing Zalo session storage requires its original ZALO_SESSION_KEY")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not configured_key and not marker.exists():
        # This is a format marker, never a persisted credential.
        marker.write_text("autoquote/zalo/session-key/v1\n", encoding="utf-8")


def wait_for_bridge(process, environment, timeout=15):
    request = Request(environment["ZALO_BRIDGE_URL"] + "/accounts/00000000-0000-0000-0000-000000000000",
                      headers={"Authorization": "Bearer " + environment["ZALO_BRIDGE_TOKEN"]})
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("The embedded Zalo bridge stopped before becoming ready")
        try:
            with urlopen(request, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError("The embedded Zalo bridge did not become ready")


def stop_children(processes):
    for process in reversed(processes):
        if process.poll() is None:
            process.terminate()
    deadline = time.monotonic() + 8
    for process in reversed(processes):
        try:
            process.wait(timeout=max(0.1, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def main():
    environment, embedded = embedded_environment(os.environ)
    port = int(environment.get("PORT") or environment.get("APP_PORT", "8000"))
    if not 1 <= port <= 65535 or (embedded and port == BRIDGE_PORT):
        raise RuntimeError("The public API port must be valid and distinct from the private Zalo port")
    processes = []
    stopping = False

    def shutdown(_signum, _frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    def launch(command, cwd, extra=None):
        process = subprocess.Popen(command, cwd=cwd, env={**environment, **(extra or {})},
                                   creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        processes.append(process)
        return process

    try:
        if embedded:
            prepare_storage(environment, bool(os.environ.get("ZALO_SESSION_KEY")))
            bridge = launch(["node", "src/server.mjs"], ROOT / "zalo-bridge",
                            {"PORT": str(BRIDGE_PORT), "ZALO_BRIDGE_HOST": "127.0.0.1"})
            wait_for_bridge(bridge, environment)
            if stopping:
                return 0
            launch([sys.executable, "-m", "src.zalo_worker"], ROOT)
            print("Private Zalo bridge and dispatcher ready; using existing application configuration.", flush=True)
        launch([sys.executable, "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", str(port)], ROOT)
        while not stopping:
            if any(process.poll() is not None for process in processes):
                raise RuntimeError("A managed service stopped; restarting the container is required")
            time.sleep(0.2)
        return 0
    finally:
        stop_children(processes)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        # Do not include subprocess environments, request headers or credentials.
        print(str(error) if isinstance(error, RuntimeError) else f"Service startup failed ({type(error).__name__})", flush=True)
        raise SystemExit(1) from None
