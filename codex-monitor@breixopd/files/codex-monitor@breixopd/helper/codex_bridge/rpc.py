"""JSON-RPC client for the local Codex app-server."""

from __future__ import annotations

import json
import subprocess
import threading
import time
from typing import Any

from . import __version__


class RpcError(RuntimeError):
    """Sanitized app-server failure with a machine-readable JSON-RPC code."""

    def __init__(self, code):
        self.code = code if isinstance(code, (int, str)) else "unknown"
        super().__init__(f"Codex request failed ({self.code})")


class AppServerClient:
    def __init__(self, *, process, timeout_seconds=10.0):
        self.process = process
        self.timeout_seconds = timeout_seconds
        self._next_id = 1
        self._responses: dict[int, dict[str, Any]] = {}
        self._notifications: dict[str, Any] = {}
        self._condition = threading.Condition()
        self._reader = threading.Thread(target=self._read_responses, daemon=True)
        self._reader.start()

    def initialize(self):
        result = self.request(
            "initialize",
            {
                "clientInfo": {
                    "name": "codex-monitor-cinnamon",
                    "title": "Codex Monitor",
                    "version": __version__,
                },
                "capabilities": {
                    "experimentalApi": True,
                    "requestAttestation": False,
                },
            },
        )
        self._send({"method": "initialized"})
        return result

    def request(self, method, params=None):
        request_id = self._next_id
        self._next_id += 1
        message: dict[str, Any] = {"id": request_id, "method": method}
        if params is not None:
            message["params"] = params
        self._send(message)

        deadline = time.monotonic() + self.timeout_seconds
        with self._condition:
            while request_id not in self._responses:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError("Codex request timed out")
                self._condition.wait(timeout=remaining)
            response = self._responses.pop(request_id)

        if "error" in response:
            error = response.get("error") or {}
            code = error.get("code", "unknown")
            raise RpcError(code)
        return response.get("result")

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=2)

    def wait_for_notification(self, method, *, timeout_seconds):
        deadline = time.monotonic() + max(0.0, float(timeout_seconds))
        with self._condition:
            while method not in self._notifications:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return None
                self._condition.wait(timeout=remaining)
            return self._notifications.pop(method)

    def _send(self, message: dict[str, Any]):
        self.process.stdin.write(json.dumps(message, separators=(",", ":")) + "\n")
        flush = getattr(self.process.stdin, "flush", None)
        if flush:
            flush()

    def _read_responses(self):
        for raw_line in self.process.stdout:
            try:
                message = json.loads(raw_line)
            except (json.JSONDecodeError, TypeError):
                continue
            request_id = message.get("id")
            method = message.get("method")
            if isinstance(method, str):
                with self._condition:
                    self._notifications[method] = message.get("params")
                    self._condition.notify_all()
                continue
            if not isinstance(request_id, int):
                continue
            with self._condition:
                self._responses[request_id] = message
                self._condition.notify_all()
