"""Process creation and JSONL serving for Codex Monitor."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess


MAX_REQUEST_BYTES = 1_000_000


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

    runner = runner or subprocess.run
    environment = dict(os.environ if base_env is None else base_env)
    if codex_home:
        environment["CODEX_HOME"] = codex_home
    configured_home = codex_home or environment.get("CODEX_HOME")
    home = Path(configured_home).expanduser() if configured_home else Path.home() / ".codex"
    fallback = home / "app-server-control" / "app-server-control.sock"
    try:
        completed = runner(
            [executable, "app-server", "daemon", "version"],
            shell=False,
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
            env=environment,
        )
    except (OSError, subprocess.TimeoutExpired):
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
    for raw_line in input_stream:
        try:
            if len(raw_line.encode("utf-8")) > MAX_REQUEST_BYTES:
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
        output_stream.write(json.dumps(response, separators=(",", ":")) + "\n")
        output_stream.flush()
