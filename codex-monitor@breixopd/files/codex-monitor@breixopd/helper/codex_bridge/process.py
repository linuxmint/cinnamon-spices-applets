"""Process creation and JSONL serving for Codex Monitor."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess

from .bounded_process import CommandOutputTooLarge, run_bounded


MAX_REQUEST_BYTES = 1_000_000
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
MAX_CONTROL_PROBE_STDOUT_BYTES = 65_536


def spawn_app_server(executable, *, codex_home=None, popen=None, base_env=None):
    popen = popen or subprocess.Popen
    command = [
        executable,
        "-s",
        "read-only",
        "-a",
        "untrusted",
        "app-server",
    ]
    environment = dict(os.environ if base_env is None else base_env)
    if codex_home:
        environment["CODEX_HOME"] = codex_home
    return popen(
        command,
        shell=False,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        bufsize=1,
        env=environment,
        close_fds=True,
    )


def control_socket_path(
    executable,
    *,
    codex_home=None,
    runner=None,
    base_env=None,
):
    """Return the daemon-advertised control socket or the documented default."""

    uses_default_runner = runner is None or runner is subprocess.run
    runner = runner or subprocess.run
    environment = dict(os.environ if base_env is None else base_env)
    if codex_home:
        environment["CODEX_HOME"] = codex_home
    configured_home = codex_home or environment.get("CODEX_HOME")
    home = Path(configured_home).expanduser() if configured_home else Path.home() / ".codex"
    fallback = home / "app-server-control" / "app-server-control.sock"
    try:
        command = [executable, "app-server", "daemon", "version"]
        if uses_default_runner:
            captured = run_bounded(
                command,
                timeout=5,
                stdout_limit=MAX_CONTROL_PROBE_STDOUT_BYTES,
                env=environment,
            )
            completed = subprocess.CompletedProcess(
                command,
                captured.returncode,
                captured.stdout.decode("utf-8", errors="strict"),
                "",
            )
        else:
            completed = runner(
                command,
                shell=False,
                check=False,
                capture_output=True,
                text=True,
                timeout=5,
                env=environment,
            )
    except (CommandOutputTooLarge, OSError, subprocess.TimeoutExpired, UnicodeError):
        return str(fallback)
    if completed.returncode != 0:
        return str(fallback)
    try:
        value = json.loads(completed.stdout)
    except (json.JSONDecodeError, TypeError):
        return str(fallback)
    advertised = value.get("socketPath") if isinstance(value, dict) else None
    if not isinstance(advertised, str) or not advertised or len(advertised) > 4096:
        return str(fallback)
    path = Path(advertised).expanduser()
    return str(path) if path.is_absolute() else str(fallback)


def serve(router, *, input_stream, output_stream):
    while True:
        request = None
        raw_line = input_stream.readline(MAX_REQUEST_BYTES + 1)
        if not raw_line:
            break
        oversized = len(raw_line.encode("utf-8")) > MAX_REQUEST_BYTES
        while not raw_line.endswith("\n"):
            remainder = input_stream.readline(MAX_REQUEST_BYTES + 1)
            if not remainder:
                break
            oversized = oversized or len(remainder.encode("utf-8")) > 0
            if remainder.endswith("\n"):
                break
        try:
            if oversized:
                raise ValueError("request too large")
            request = json.loads(raw_line)
            if not isinstance(request, dict):
                raise ValueError("request must be an object")
        except (json.JSONDecodeError, UnicodeError, ValueError):
            response = {
                "id": None,
                "ok": False,
                "error": {
                    "code": "INVALID_JSON",
                    "message": "Invalid JSON request",
                    "retryable": False,
                },
            }
        else:
            response = router.handle(request)
        serialized = json.dumps(response, separators=(",", ":")) + "\n"
        if len(serialized.encode("utf-8")) > MAX_RESPONSE_BYTES:
            response = {
                "id": request.get("id") if isinstance(request, dict) else None,
                "ok": False,
                "error": {
                    "code": "RESPONSE_TOO_LARGE",
                    "message": "Codex response was too large",
                    "retryable": True,
                },
            }
            serialized = json.dumps(response, separators=(",", ":")) + "\n"
        output_stream.write(serialized)
        output_stream.flush()
