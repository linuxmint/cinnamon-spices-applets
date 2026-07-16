"""Safe wrappers for Codex Remote Control."""

from __future__ import annotations

import json
import os
from pathlib import Path
import signal
import shutil
import subprocess
import time

from .bounded_process import CommandOutputTooLarge, run_bounded
from .rpc import RpcError
from .qr import encode_qr_svg


MAX_REMOTE_STDOUT_BYTES = 1_000_000
MAX_REMOTE_STDERR_BYTES = 65_536


class _ControlChannelUnavailable(RuntimeError):
    pass


class RemoteDaemonStuckError(RuntimeError):
    code = "REMOTE_DAEMON_STUCK"


class RemoteControl:
    STATUS_RETRY_SECONDS = 60
    MAX_UNIX_SECONDS = 8_640_000_000_000

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
        self._uses_default_runner = runner is None or runner is subprocess.run
        self.runner = runner or subprocess.run
        self.client_factory = client_factory
        self.environment = environment
        self.proc_root = proc_root
        self.clock = clock or time.monotonic
        self.daemon_running = daemon_running or self._remote_process_running
        self.qr_encoder = qr_encoder or encode_qr_svg
        self._last_status = None
        self._status_channel_retry_at = 0.0
        self.pidfd_open = getattr(os, "pidfd_open", None)
        self.pidfd_send_signal = getattr(signal, "pidfd_send_signal", None)
        self.fd_close = os.close

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
        self._last_status = self._normalize_status(value)
        return dict(self._last_status)

    def start(self):
        status = self._compact_status(self._normalize_status(self._run_json("start")))
        self._status_channel_retry_at = 0.0
        self._last_status = status
        return dict(status)

    def stop(self):
        self._run_json("stop")
        self._status_channel_retry_at = 0.0
        self._last_status = {"status": "disabled"}
        return dict(self._last_status)

    def repair(self):
        (
            app_pid,
            updater_pid,
            updater_start_ticks,
            updater_arguments,
            updater_executable,
        ) = self._validated_stuck_daemon()
        if self.pidfd_open is None or self.pidfd_send_signal is None:
            raise RuntimeError("Codex Remote repair is unavailable")
        try:
            pidfd = self.pidfd_open(updater_pid, 0)
        except OSError:
            raise RuntimeError("Codex Remote repair could not validate the updater") from None
        try:
            self._revalidate_stuck_daemon(
                app_pid,
                updater_pid,
                updater_start_ticks,
                updater_arguments,
                updater_executable,
            )
            self.pidfd_send_signal(pidfd, signal.SIGTERM, None, 0)
        except OSError:
            raise RuntimeError("Codex Remote repair could not stop the updater") from None
        finally:
            self.fd_close(pidfd)

        if not self._wait_for_processes_to_exit(app_pid, updater_pid):
            raise RuntimeError("Codex Remote repair timed out")
        self._run_daemon_bootstrap()
        return self.start()

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
        expires_at = self._timestamp(value.get("expiresAt"))
        if (
            pairing_code is None
            or environment_id is None
            or expires_at is None
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
            completed = self._run_remote_command(command, timeout=20)
        except CommandOutputTooLarge as error:
            diagnostic = error.captured.decode("utf-8", errors="replace")
            if (
                action == "start"
                and error.stream == "stderr"
                and self._is_stuck_daemon_error(diagnostic)
            ):
                raise RemoteDaemonStuckError(
                    "Codex Remote background service is stuck"
                ) from None
            if error.stream == "stdout":
                raise RuntimeError(
                    "Codex remote-control response was invalid"
                ) from None
            raise RuntimeError("Codex remote-control command failed") from None
        except subprocess.TimeoutExpired:
            raise TimeoutError("Codex remote-control command timed out") from None
        except UnicodeDecodeError:
            raise RuntimeError("Codex remote-control response was invalid") from None
        except OSError:
            raise RuntimeError("Codex remote-control command failed") from None
        if completed.returncode != 0:
            if action == "start" and self._is_stuck_daemon_error(completed.stderr):
                raise RemoteDaemonStuckError(
                    "Codex Remote background service is stuck"
                )
            raise RuntimeError("Codex remote-control command failed")
        try:
            value = json.loads(completed.stdout)
        except (json.JSONDecodeError, TypeError, UnicodeDecodeError):
            raise RuntimeError("Codex remote-control response was invalid") from None
        if not isinstance(value, dict):
            raise RuntimeError("Codex remote-control response was invalid")
        return value

    def _run_remote_command(self, command, *, timeout):
        if not self._uses_default_runner:
            return self.runner(
                command,
                shell=False,
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=self.environment,
            )
        return self._run_bounded_process(command, timeout=timeout)

    def _run_bounded_process(self, command, *, timeout):
        completed = run_bounded(
            command,
            timeout=timeout,
            stdout_limit=MAX_REMOTE_STDOUT_BYTES,
            stderr_limit=MAX_REMOTE_STDERR_BYTES,
            env=self.environment,
        )
        return subprocess.CompletedProcess(
            command,
            completed.returncode,
            completed.stdout.decode("utf-8", errors="strict"),
            completed.stderr.decode("utf-8", errors="replace"),
        )

    def _run_daemon_bootstrap(self):
        command = [
            self.executable,
            "app-server",
            "daemon",
            "bootstrap",
            "--remote-control",
        ]
        try:
            if self._uses_default_runner:
                completed = run_bounded(
                    command,
                    timeout=90,
                    stdout_limit=0,
                    env=self.environment,
                )
            else:
                completed = self.runner(
                    command,
                    shell=False,
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=90,
                    env=self.environment,
                )
        except subprocess.TimeoutExpired:
            raise TimeoutError("Codex Remote repair timed out") from None
        except OSError:
            raise RuntimeError("Codex Remote repair failed") from None
        if completed.returncode != 0:
            raise RuntimeError("Codex Remote repair failed")

    def _validated_stuck_daemon(self):
        codex_home = Path(
            (self.environment or {}).get("CODEX_HOME") or Path.home() / ".codex"
        ).expanduser()
        daemon_dir = codex_home / "app-server-daemon"
        app_pid = self._read_pid_record(daemon_dir / "app-server.pid")
        updater_pid = self._read_pid_record(
            daemon_dir / "app-server-updater.pid"
        )
        app = self._read_process(app_pid)
        updater = self._read_process(updater_pid)
        if app["state"] != "Z" or app["ppid"] != updater_pid or app["arguments"]:
            raise RuntimeError("Codex Remote repair found no safe repair target")
        if updater["state"] == "Z" or updater["ppid"] <= 0:
            raise RuntimeError("Codex Remote repair found no safe repair target")
        if updater["arguments"][1:] != [
            "app-server",
            "daemon",
            "pid-update-loop",
        ]:
            raise RuntimeError("Codex Remote repair found no safe repair target")
        executable = Path(updater["arguments"][0]).resolve()
        releases = (codex_home / "packages" / "standalone" / "releases").resolve()
        try:
            executable.relative_to(releases)
        except ValueError:
            raise RuntimeError("Codex Remote repair found no safe repair target") from None
        if not executable.is_file() or not os.access(executable, os.X_OK):
            raise RuntimeError("Codex Remote repair found no safe repair target")
        if updater["executable"] != executable:
            raise RuntimeError("Codex Remote repair found no safe repair target")
        return (
            app_pid,
            updater_pid,
            updater["start_ticks"],
            updater["arguments"],
            executable,
        )

    def _revalidate_stuck_daemon(
        self,
        app_pid,
        updater_pid,
        updater_start_ticks,
        updater_arguments,
        updater_executable,
    ):
        app = self._read_process(app_pid)
        updater = self._read_process(updater_pid)
        if (
            app["state"] != "Z"
            or app["ppid"] != updater_pid
            or updater["state"] == "Z"
            or updater["start_ticks"] != updater_start_ticks
            or updater["arguments"] != updater_arguments
            or updater["executable"] != updater_executable
        ):
            raise RuntimeError("Codex Remote repair target changed")

    def _read_pid_record(self, path):
        try:
            with path.open("r", encoding="utf-8") as handle:
                contents = handle.read(4097)
            if len(contents) > 4096:
                raise ValueError
            value = json.loads(contents)
            pid = value.get("pid") if isinstance(value, dict) else None
            started = value.get("processStartTime") if isinstance(value, dict) else None
            if (
                not isinstance(pid, int)
                or isinstance(pid, bool)
                or not 1 < pid < 2**31
                or not isinstance(started, str)
                or not 0 < len(started) <= 128
            ):
                raise ValueError
            return pid
        except (OSError, UnicodeError, ValueError, json.JSONDecodeError):
            raise RuntimeError("Codex Remote repair state is unavailable") from None

    def _read_process(self, pid):
        process_dir = Path(self.proc_root) / str(pid)
        try:
            if process_dir.stat(follow_symlinks=False).st_uid != os.geteuid():
                raise ValueError
            with process_dir.joinpath("stat").open("r", encoding="utf-8") as handle:
                raw_stat = handle.read(4097)
            with process_dir.joinpath("cmdline").open("rb") as handle:
                raw_arguments = handle.read(65_537)
            if len(raw_stat) > 4096 or len(raw_arguments) > 65_536:
                raise ValueError
            close_paren = raw_stat.rfind(")")
            fields = raw_stat[close_paren + 2 :].split()
            if close_paren < 0 or len(fields) < 20:
                raise ValueError
            arguments = [
                os.fsdecode(argument)
                for argument in raw_arguments.split(b"\0")
                if argument
            ]
            executable = (
                process_dir.joinpath("exe").resolve(strict=True)
                if arguments
                else None
            )
            return {
                "state": fields[0],
                "ppid": int(fields[1]),
                "start_ticks": int(fields[19]),
                "arguments": arguments,
                "executable": executable,
            }
        except (OSError, UnicodeError, ValueError):
            raise RuntimeError("Codex Remote repair target is unavailable") from None

    def _wait_for_processes_to_exit(self, app_pid, updater_pid):
        app_path = Path(self.proc_root) / str(app_pid)
        updater_path = Path(self.proc_root) / str(updater_pid)
        for _attempt in range(60):
            if not app_path.exists() and not updater_path.exists():
                return True
            time.sleep(0.05)
        return False

    @staticmethod
    def _is_stuck_daemon_error(stderr):
        return isinstance(stderr, str) and (
            "app server did not become ready on" in stderr[:4096]
        )

    def _daemon_is_running(self):
        try:
            return bool(self.daemon_running())
        except (OSError, RuntimeError):
            return False

    def _fallback_status(self):
        if not self._daemon_is_running():
            self._last_status = None
            return {"status": "disabled"}
        if self._last_status is not None and self._last_status.get("status") != "running":
            return dict(self._last_status)
        self._last_status = {"status": "running"}
        return dict(self._last_status)

    def _remote_process_running(self):
        executable = self._configured_executable()
        if executable is None:
            return False
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
                        raw_arguments = handle.read(4097)
                    if len(raw_arguments) > 4096:
                        continue
                    arguments = [value for value in raw_arguments.split(b"\0") if value]
                    running_executable = Path(entry.path, "exe").resolve(strict=True)
                except (OSError, UnicodeError):
                    continue
                if (
                    running_executable == executable
                    and len(arguments) >= 3
                    and arguments[1:3] == [b"app-server", b"--remote-control"]
                ):
                    return True
        return False

    def _configured_executable(self):
        search_path = (self.environment or os.environ).get("PATH")
        candidate = shutil.which(str(self.executable), path=search_path)
        if candidate is None:
            return None
        try:
            return Path(candidate).resolve(strict=True)
        except OSError:
            return None

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
            "environmentLabel": cls._display_string(value.get("environmentId")),
        }

    @classmethod
    def _normalize_client(cls, value):
        if not isinstance(value, dict):
            return None
        client_id = cls._bounded_string(value.get("clientId"))
        if client_id is None:
            return None
        last_seen_at = cls._timestamp(value.get("lastSeenAt"), optional=True)
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
    def _timestamp(cls, value, *, optional=False):
        if value is None and optional:
            return None
        if (
            not isinstance(value, int)
            or isinstance(value, bool)
            or not 0 <= value <= cls.MAX_UNIX_SECONDS
        ):
            return None
        return value

    @classmethod
    def _require_identifier(cls, value, name):
        normalized = cls._bounded_string(value)
        if normalized is None:
            raise RuntimeError(f"Codex remote-control {name} identifier was invalid")
        return normalized
