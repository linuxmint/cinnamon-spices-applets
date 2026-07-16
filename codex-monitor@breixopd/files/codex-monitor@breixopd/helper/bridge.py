#!/usr/bin/env python3
"""Codex Monitor helper process."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

from codex_bridge.active_processes import discover_live_threads
from codex_bridge.history import QuotaHistory
from codex_bridge.launcher import TerminalLauncher
from codex_bridge.process import control_socket_path, serve, spawn_app_server
from codex_bridge.protocol import CommandRouter
from codex_bridge.remote import RemoteControl
from codex_bridge.rpc import AppServerClient
from codex_bridge.service import CodexService
from codex_bridge.updates import UpdateManager
from codex_bridge.websocket_rpc import UnixSocketAppServerClient


UUID = "codex-monitor@breixopd"


def create_runtime(
    options,
    *,
    spawn=None,
    client_factory=None,
    remote_client_factory=None,
    socket_resolver=None,
    remote_runner=None,
    terminal_popen=None,
    update_manager_factory=None,
    live_thread_discovery=None,
):
    spawn = spawn or spawn_app_server
    client_factory = client_factory or (lambda process: AppServerClient(process=process))
    remote_client_factory = remote_client_factory or (
        lambda socket_path: UnixSocketAppServerClient(socket_path=socket_path)
    )
    socket_resolver = socket_resolver or control_socket_path

    process = spawn(
        options.codex,
        codex_home=options.codex_home,
    )
    client = client_factory(process)
    client.initialize()

    history = QuotaHistory(
        Path(options.data_dir) / "history.jsonl",
        retention_days=options.history_days,
    )

    remote_environment = dict(os.environ)
    if options.codex_home:
        remote_environment["CODEX_HOME"] = options.codex_home
    effective_remote_runner = remote_runner or subprocess.run
    remote_socket_path = None

    def create_remote_client():
        nonlocal remote_socket_path
        if remote_socket_path is None:
            remote_socket_path = socket_resolver(
                options.codex,
                codex_home=options.codex_home,
                runner=effective_remote_runner,
                base_env=remote_environment,
            )
        return remote_client_factory(remote_socket_path)

    remote_kwargs = {
        "client_factory": create_remote_client,
        "environment": remote_environment,
        "runner": effective_remote_runner,
    }
    remote = RemoteControl(options.codex, **remote_kwargs)
    launcher_kwargs = {}
    if terminal_popen is not None:
        launcher_kwargs["popen"] = terminal_popen
    launcher = TerminalLauncher(options.codex, **launcher_kwargs)
    update_manager_factory = update_manager_factory or UpdateManager
    live_thread_discovery = live_thread_discovery or discover_live_threads
    updates = update_manager_factory(
        options.codex,
        options.codex_home,
        options.data_dir,
    )
    service = CodexService(
        client,
        history,
        remote=remote,
        launcher=launcher,
        updates=updates,
        live_threads=lambda: live_thread_discovery(
            options.codex,
            codex_home=options.codex_home,
        ),
    )
    return SimpleNamespace(
        client=client,
        history=history,
        remote=remote,
        launcher=launcher,
        updates=updates,
        service=service,
        router=CommandRouter(service),
    )


def parse_args(argv=None):
    default_data_home = Path(
        os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")
    )
    parser = argparse.ArgumentParser(description="Codex Monitor Cinnamon bridge")
    parser.add_argument("--codex", default="codex")
    parser.add_argument("--codex-home", default=os.environ.get("CODEX_HOME"))
    parser.add_argument(
        "--data-dir", default=str(default_data_home / UUID), help=argparse.SUPPRESS
    )
    parser.add_argument("--history-days", type=int, default=30)
    return parser.parse_args(argv)


def main(argv=None):
    options = parse_args(argv)
    runtime = None
    try:
        runtime = create_runtime(options)
        serve(runtime.router, input_stream=sys.stdin, output_stream=sys.stdout)
    except (OSError, RuntimeError, TimeoutError):
        sys.stdout.write(
            '{"id":null,"ok":false,"error":{"code":"BRIDGE_START_FAILED",'
            '"message":"Unable to connect to Codex","retryable":true}}\n'
        )
        sys.stdout.flush()
        return 1
    finally:
        if runtime is not None:
            runtime.client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
