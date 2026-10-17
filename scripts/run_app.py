"""Run services using existing environment variables and .env files.

python scripts/run_app.py --check
python scripts/run_app.py
No configuration, keys, databases or sample data are created.
"""

import argparse
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]


def load_environment(env_file, profile=None):
    root_values = {key: value for key, value in dotenv_values(env_file).items() if value is not None}
    environment = {**root_values, **os.environ}
    if profile is not None:
        # Local profiles are opt-in only; never silently replace the application's DB.
        config = json.loads(profile.read_text(encoding="utf-8"))
        environment.update(config["environment"])
        port = config.get("frontend_port", 3000)
        directory = profile.resolve().parent
    else:
        port = int(environment.get("FRONTEND_PORT", "3000"))
        directory = ROOT / ".runtime"
    frontend_values = {
        key: value for key, value in dotenv_values(ROOT / "frontend/.env.local").items() if value is not None
    }
    frontend_environment = {**frontend_values, **os.environ}
    backend_port = int(environment.get("APP_PORT", "8000"))
    frontend_environment.setdefault("BACKEND_URL", environment.get("BACKEND_URL", f"http://127.0.0.1:{backend_port}"))
    return environment, frontend_environment, port, backend_port, directory


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--env-file", type=Path, default=ROOT / ".env", help="Existing .env file; process variables take precedence"
    )
    parser.add_argument("--config", type=Path, help="Explicit local development profile (never loaded by default)")
    parser.add_argument("--check", action="store_true", help="Validate existing settings without starting services")
    args = parser.parse_args()
    environment, frontend_environment, port, backend_port, directory = load_environment(args.env_file, args.config)
    bridge = urlsplit(environment.get("ZALO_BRIDGE_URL", ""))
    local_bridge = bridge.hostname in {"localhost", "127.0.0.1", "::1"}
    required = ["DATABASE_URL", "JWT_SECRET", "ZALO_BRIDGE_URL", "ZALO_BRIDGE_TOKEN"]
    if local_bridge:
        required.append("ZALO_SESSION_KEY")
    missing = [key for key in required if not environment.get(key)]
    if missing:
        raise SystemExit(
            "Missing in current environment: " + ", ".join(missing) + ". No values were created or changed."
        )
    if args.check:
        print("Existing environment validated. No services started; no data changed.")
        return
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            raise RuntimeError(f"Port {port} is already in use")
    except (ConnectionRefusedError, TimeoutError):
        pass
    directory.mkdir(parents=True, exist_ok=True)
    logs = directory / "logs"
    logs.mkdir(exist_ok=True)
    stop = directory / "stop"
    stop.unlink(missing_ok=True)
    processes, handles = [], []

    def launch(name, command, cwd=ROOT, extra=None, base_environment=None):
        handle = (logs / f"{name}.log").open("a", encoding="utf-8")
        handles.append(handle)
        process = subprocess.Popen(
            command,
            cwd=cwd,
            env={**(base_environment if base_environment is not None else environment), **(extra or {})},
            stdout=handle,
            stderr=subprocess.STDOUT,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        processes.append(process)
        return process

    try:
        if local_bridge:
            launch(
                "zalo",
                ["node", "src/server.mjs"],
                ROOT / "zalo-bridge",
                {"PORT": str(bridge.port or 8010), "ZALO_BRIDGE_HOST": bridge.hostname},
            )
        launch(
            "backend",
            [
                sys.executable,
                "-m",
                "uvicorn",
                "src.main:app",
                "--host",
                environment.get("APP_HOST", "127.0.0.1"),
                "--port",
                str(backend_port),
            ],
        )
        launch("worker", [sys.executable, "-m", "src.zalo_worker"])
        launch(
            "frontend",
            ["node", "node_modules/next/dist/bin/next", "start", "-p", str(port)],
            ROOT / "frontend",
            base_environment=frontend_environment,
        )
        (directory / "processes.json").write_text(
            json.dumps({"runner": os.getpid(), "children": [p.pid for p in processes]}), encoding="utf-8"
        )
        print(f"Application started: http://localhost:{port}/login", flush=True)
        print(
            "Zalo connection and campaign worker are enabled. No campaign starts without user confirmation.", flush=True
        )
        while not stop.exists():
            if any(p.poll() is not None for p in processes):
                raise RuntimeError(f"A service stopped. See logs in {logs}")
            time.sleep(1)
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
        for handle in handles:
            handle.close()


if __name__ == "__main__":
    main()
