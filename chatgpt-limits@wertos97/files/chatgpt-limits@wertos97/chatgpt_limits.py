#!/usr/bin/python3

import argparse
import json
import math
import os
from pathlib import Path
import select
import shutil
import signal
import subprocess
import time


class LimitsError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def number(value, default=None):
    try:
        result = float(value)
        return result if math.isfinite(result) else default
    except (TypeError, ValueError):
        return default


def resolve_codex(configured):
    candidates = []
    if configured:
        candidates.append(configured)
    else:
        candidates.extend((str(Path.home() / ".local/bin/codex"), shutil.which("codex")))
    for candidate in candidates:
        if not candidate:
            continue
        try:
            path = Path(candidate).expanduser().resolve(strict=True)
        except OSError:
            continue
        if path.is_file() and os.access(path, os.X_OK):
            if path.name == "codex.js":
                native_dir = path.parent.parent / "node_modules" / "@openai"
                native = sorted(native_dir.glob("codex-linux-*/vendor/*/bin/codex"))
                for executable in native:
                    if executable.is_file() and os.access(executable, os.X_OK):
                        return str(executable.resolve())
            return str(path)
    raise LimitsError("not-found")


def stop_process(process):
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except (ProcessLookupError, OSError):
        pass
    try:
        process.wait(timeout=1.0)
        return
    except subprocess.TimeoutExpired:
        pass
    except InterruptedError:
        pass
    except OSError:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except (ProcessLookupError, OSError):
        pass
    try:
        process.wait(timeout=2.0)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass
        try:
            process.wait(timeout=2.0)
        except Exception:
            pass


def read_limits(codex, timeout=15):
    process = subprocess.Popen(
        [codex, "app-server", "--listen", "stdio://"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        bufsize=0,
    )
    try:
        os.set_blocking(process.stdin.fileno(), False)
        os.set_blocking(process.stdout.fileno(), False)
        messages = (
            {"method": "initialize", "id": 1,
             "params": {"clientInfo": {"name": "chatgpt-limits-cinnamon", "version": "1.0"}}},
            {"method": "initialized", "params": {}},
            {"method": "account/rateLimits/read", "id": 2},
        )
        outgoing = memoryview("".join(
            json.dumps(message, separators=(",", ":")) + "\n" for message in messages
        ).encode("utf-8"))
        pending = bytearray()
        deadline = time.monotonic() + timeout

        while time.monotonic() < deadline:
            readable, writable, _ = select.select(
                [process.stdout], [process.stdin] if outgoing else [], [],
                max(0, deadline - time.monotonic()),
            )
            if writable:
                outgoing = outgoing[os.write(process.stdin.fileno(), outgoing):]
            if not readable:
                continue
            chunk = os.read(process.stdout.fileno(), 65536)
            if not chunk:
                raise LimitsError("backend")
            pending.extend(chunk)
            if len(pending) > 1024 * 1024:
                raise LimitsError("backend")
            lines = pending.split(b"\n")
            pending = lines.pop()
            for line in lines:
                try:
                    message = json.loads(line)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                if not isinstance(message, dict) or message.get("id") != 2:
                    continue
                if "error" in message:
                    detail = message.get("error")
                    if isinstance(detail, dict):
                        detail = detail.get("message")
                    text = str(detail or "").lower()
                    if any(marker in text for marker in
                           ("auth", "login", "sign in", "unauthorized", "token")):
                        raise LimitsError("auth")
                    raise LimitsError("backend")
                result = message.get("result")
                if not isinstance(result, dict):
                    raise LimitsError("data")
                return result
        raise LimitsError("timeout")
    finally:
        stop_process(process)


def normalize(result):
    bucket = None
    buckets = result.get("rateLimitsByLimitId")
    if isinstance(buckets, dict):
        bucket = buckets.get("codex")
    if not isinstance(bucket, dict):
        bucket = result.get("rateLimits")
    if not isinstance(bucket, dict):
        raise LimitsError("data")

    windows = []
    for field in ("primary", "secondary"):
        window = bucket.get(field)
        if not isinstance(window, dict):
            continue
        duration = number(window.get("windowDurationMins"))
        used = number(window.get("usedPercent"))
        resets_at = number(window.get("resetsAt"))
        if duration and duration > 0 and used is not None and 0 <= used <= 100 \
                and resets_at and resets_at > 0:
            windows.append({
                "durationMinutes": int(duration),
                "usedPercent": used,
                "resetsAt": int(resets_at),
            })
    if not windows:
        raise LimitsError("data")
    windows.sort(key=lambda item: item["durationMinutes"])
    return {"updatedAt": int(time.time()), "windows": windows[:2]}


def cancel_request(_signum, _frame):
    raise InterruptedError()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--codex")
    args = parser.parse_args()
    signal.signal(signal.SIGTERM, cancel_request)
    try:
        payload = normalize(read_limits(resolve_codex(args.codex)))
    except LimitsError as error:
        payload = {"error": error.code}
    except (OSError, InterruptedError):
        payload = {"error": "backend"}
    print(json.dumps(payload, separators=(",", ":")))


if __name__ == "__main__":
    main()
