"""Start FastAPI + Next.js production server, run Playwright E2E, and cleanly terminate both."""

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def wait_for_url(url: str, timeout_s: float = 30.0) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as resp:
                if resp.status < 500:
                    return
        except Exception:
            time.sleep(0.4)
    raise RuntimeError(f"Timed out waiting for {url}")


def main() -> int:
    env = os.environ.copy()
    env["GRIDMIND_OFFLINE_WEATHER"] = "1"
    env["FASTAPI_URL"] = "http://127.0.0.1:8000"

    api_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--app-dir", str(ROOT / "services" / "api"), "--port", "8000"],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    web_proc = subprocess.Popen(
        ["pnpm", "--dir", str(ROOT / "apps" / "web"), "start", "-p", "3000"],
        cwd=str(ROOT),
        env=env,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    try:
        wait_for_url("http://127.0.0.1:8000/health", 25.0)
        wait_for_url("http://127.0.0.1:3000", 25.0)
        res = subprocess.run(
            [sys.executable, str(ROOT / "services" / "api" / "tests" / "e2e_playwright.py")],
            cwd=str(ROOT),
            env=env,
        )
        return res.returncode
    finally:
        for proc in (api_proc, web_proc):
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
            else:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except Exception:
                    proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
