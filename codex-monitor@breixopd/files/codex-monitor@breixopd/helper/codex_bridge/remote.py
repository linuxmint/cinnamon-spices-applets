"""Safe wrappers for Codex Remote Control."""

from __future__ import annotations

import json
import os
import subprocess
import time

from .rpc import RpcError
from .qr import encode_qr_svg


class _ControlChannelUnavailable(RuntimeError):
    pass


class RemoteControl:
    STATUS_RETRY_SECONDS = 60

    def __init__(
        self,
        executable,
        *,
        runner=None,
        client_factory=None,
        environment=None,
        daemon_running=None,
        qr_encoder=None,
        proc_root="/proc",
        clock=None,
    ):
        self.executable = executable
        self.runner = runner or subprocess.run
        self.client_factory = client_factory
        self.environment = environment
        self.proc_root = proc_root
        self.clock = clock or time.monotonic
        self.daemon_running = daemon_running or self._remote_process_running
        self.qr_encoder = qr_encoder or encode_qr_svg
        self._last_status = None
        self._status_channel_retry_at = 0.0
        self._status_cli_retry_at = 0.0

    def status(self):
        if self.client_factory is None:
            return {"status": "disabled"}
        now = self.clock()
        if now < self._status_channel_retry_at:
            return self._fallback_status()
        try:
            value = self._channel_request("remoteControl/status/read")
        except _ControlChannelUnavailable:
            self._status_channel_retry_at = now + self.STATUS_RETRY_SECONDS
            return self._fallback_status()
        except RpcError as error:
            if error.code != -32601:
                raise
            self._status_channel_retry_at = now + self.STATUS_RETRY_SECONDS
            return self._fallback_status()
        self._status_channel_retry_at = 0.0
        self._status_cli_retry_at = 0.0
        self._last_status = self._normalize_status(value)
        return dict(self._last_status)

    def start(self):
        status = self._compact_status(self._normalize_status(self._run_json("start")))
        self._status_channel_retry_at = 0.0
        self._status_cli_retry_at = 0.0
        self._last_status = status
        return dict(status)

    def stop(self):
        self._run_json("stop")
        self._status_channel_retry_at = 0.0
        self._status_cli_retry_at = 0.0
        self._last_status = {"status": "disabled"}
        return dict(self._last_status)

    def pair_start(self):
        try:
            value = self._channel_request(
                "remoteControl/pairing/start", {"manualCode": True}
            )
        except _ControlChannelUnavailable:
            # The pairing app-server method is newer than the Remote CLI surface and
            # is not available in every app-server build. The fixed CLI command
            # provides the same bounded JSON contract.
            value = self._run_json("pair")
        except RpcError as error:
            if error.code != -32601:
                raise
            value = self._run_json("pair")
        return self._normalize_pairing(value)

    def _normalize_pairing(self, value):
        if not isinstance(value, dict):
            raise RuntimeError("Codex remote-control response was invalid")
        pairing_code = self._bounded_string(value.get("pairingCode"), maximum=4096)
        manual_code = self._bounded_string(
            value.get("manualPairingCode"), maximum=256, optional=True
        )
        environment_id = self._bounded_string(value.get("environmentId"))
        expires_at = value.get("expiresAt")
        if (
            pairing_code is None
            or environment_id is None
            or not isinstance(expires_at, int)
            or isinstance(expires_at, bool)
        ):
            raise RuntimeError("Codex remote-control response was invalid")
        return {
            "pairingCode": pairing_code,
            "manualPairingCode": manual_code,
            "environmentId": environment_id,
            "expiresAt": expires_at,
            "qrSvg": self.qr_encoder(pairing_code),
        }

    def pair_status(self, pairing_code, manual_pairing_code=None):
        pairing_code = self._bounded_string(
            pairing_code, maximum=4096, optional=True
        )
        manual_pairing_code = self._bounded_string(
            manual_pairing_code, maximum=256, optional=True
        )
        if pairing_code is None and manual_pairing_code is None:
            raise RuntimeError("Codex remote-control pairing code was invalid")
        params = (
            {"pairingCode": pairing_code}
            if pairing_code is not None
            else {"manualPairingCode": manual_pairing_code}
        )
        try:
            value = self._channel_request("remoteControl/pairing/status", params)
        except _ControlChannelUnavailable:
            return {"claimed": False, "available": False}
        except RpcError as error:
            if error.code != -32601:
                raise
            return {"claimed": False, "supported": False}
        if not isinstance(value, dict) or not isinstance(value.get("claimed"), bool):
            raise RuntimeError("Codex remote-control response was invalid")
        return {"claimed": value["claimed"]}

    def clients(self, environment_id):
        environment_id = self._require_identifier(environment_id, "environment")
        try:
            value = self._channel_request(
                "remoteControl/client/list",
                {"environmentId": environment_id, "limit": 50, "order": "desc"},
            )
        except _ControlChannelUnavailable:
            return {"clients": [], "available": False}
        except RpcError as error:
            if error.code != -32601:
                raise
            return {"clients": [], "supported": False}
        if not isinstance(value, dict) or not isinstance(value.get("data"), list):
            raise RuntimeError("Codex remote-control response was invalid")
        clients = []
        for raw in value["data"][:50]:
            client = self._normalize_client(raw)
            if client is not None:
                clients.append(client)
        clients.sort(key=lambda client: client["lastSeenAt"] or 0, reverse=True)
        return {"clients": clients}

    def revoke(self, environment_id, client_id):
        environment_id = self._require_identifier(environment_id, "environment")
        client_id = self._require_identifier(client_id, "client")
        value = self._channel_request(
            "remoteControl/client/revoke",
            {"environmentId": environment_id, "clientId": client_id},
        )
        if not isinstance(value, dict):
            raise RuntimeError("Codex remote-control response was invalid")
        return {"revoked": True}

    def _channel_request(self, method, params=None):
        if self.client_factory is None:
            raise RuntimeError("Codex remote control is unavailable")
        client = self.client_factory()
        try:
            try:
                client.initialize()
            except (OSError, RuntimeError, TimeoutError):
                raise _ControlChannelUnavailable(
                    "Codex remote-control channel is unavailable"
                ) from None
            return client.request(method, params)
        finally:
            client.close()

    def _run_json(self, action):
        command = [self.executable, "remote-control", action, "--json"]
        try:
            completed = self.runner(
                command,
                shell=False,
                check=False,
                capture_output=True,
                text=True,
                timeout=20,
                env=self.environment,
            )
        except subprocess.TimeoutExpired:
            raise TimeoutError("Codex remote-control command timed out") from None
        except OSError:
            raise RuntimeError("Codex remote-control command failed") from None
        if completed.returncode != 0:
            raise RuntimeError("Codex remote-control command failed")
        try:
            value = json.loads(completed.stdout)
        except (json.JSONDecodeError, TypeError):
            raise RuntimeError("Codex remote-control response was invalid") from None
        if not isinstance(value, dict):
            raise RuntimeError("Codex remote-control response was invalid")
        return value

    def _daemon_is_running(self):
        try:
            return bool(self.daemon_running())
        except (OSError, RuntimeError):
            return False

    def _fallback_status(self):
        if not self._daemon_is_running():
            self._last_status = None
            self._status_cli_retry_at = 0.0
            return {"status": "disabled"}
        if self._last_status is not None and self._last_status.get("status") != "running":
            return dict(self._last_status)
        now = self.clock()
        if now < self._status_cli_retry_at:
            return dict(self._last_status or {"status": "running"})
        try:
            status = self._compact_status(self._normalize_status(self._run_json("start")))
        except (RuntimeError, TimeoutError):
            status = {"status": "running"}
            self._status_cli_retry_at = now + self.STATUS_RETRY_SECONDS
        else:
            self._status_cli_retry_at = 0.0
        self._last_status = status
        return dict(status)

    def _remote_process_running(self):
        try:
            entries = os.scandir(self.proc_root)
        except OSError:
            return False
        with entries:
            for entry in entries:
                if not entry.name.isdigit():
                    continue
                try:
                    if entry.stat(follow_symlinks=False).st_uid != os.geteuid():
                        continue
                    with open(os.path.join(entry.path, "cmdline"), "rb") as handle:
                        arguments = handle.read(4096).split(b"\0")
                except OSError:
                    continue
                if b"app-server" in arguments and b"--remote-control" in arguments:
                    return True
        return False

    @staticmethod
    def _compact_status(value):
        return {key: item for key, item in value.items() if item is not None}

    @classmethod
    def _normalize_status(cls, value):
        if not isinstance(value, dict) or value.get("status") not in {
            "disabled",
            "connecting",
            "connected",
            "errored",
        }:
            raise RuntimeError("Codex remote-control status was invalid")
        return {
            "status": value["status"],
            "serverName": cls._display_string(value.get("serverName")),
            "installationId": cls._bounded_string(
                value.get("installationId"), optional=True
            ),
            "environmentId": cls._bounded_string(
                value.get("environmentId"), optional=True
            ),
        }

    @classmethod
    def _normalize_client(cls, value):
        if not isinstance(value, dict):
            return None
        client_id = cls._bounded_string(value.get("clientId"))
        if client_id is None:
            return None
        last_seen_at = value.get("lastSeenAt")
        if not isinstance(last_seen_at, int) or isinstance(last_seen_at, bool):
            last_seen_at = None
        return {
            "clientId": client_id,
            "displayName": cls._display_string(value.get("displayName")),
            "deviceModel": cls._display_string(value.get("deviceModel")),
            "deviceType": cls._display_string(value.get("deviceType")),
            "platform": cls._display_string(value.get("platform")),
            "osVersion": cls._display_string(value.get("osVersion")),
            "appVersion": cls._display_string(value.get("appVersion")),
            "lastSeenAt": last_seen_at,
        }

    @staticmethod
    def _bounded_string(value, *, maximum=256, optional=False):
        if value is None and optional:
            return None
        if not isinstance(value, str) or not value or len(value) > maximum:
            return None
        return value

    @staticmethod
    def _display_string(value, *, maximum=160):
        if not isinstance(value, str):
            return None
        normalized = " ".join(value.split())
        if not normalized or len(normalized) > maximum:
            return None
        return normalized

    @classmethod
    def _require_identifier(cls, value, name):
        normalized = cls._bounded_string(value)
        if normalized is None:
            raise RuntimeError(f"Codex remote-control {name} identifier was invalid")
        return normalized
