"""Non-blocking, bounded Codex release discovery and update state."""

from __future__ import annotations

from datetime import datetime, timezone
import fcntl
import json
import math
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import threading
import time
from urllib import request as urllib_request

from . import __version__
from .bounded_process import CommandOutputTooLarge, run_bounded


_CHECK_INTERVAL_SECONDS = 12 * 3600
_MAX_RESPONSE_BYTES = 1_000_000
MAX_CACHE_BYTES = 64 * 1024
MAX_VERSION_STDOUT_BYTES = 4096
_RELEASE_URL = "https://api.github.com/repos/openai/codex/releases/latest"
_USER_AGENT = f"Codex-Monitor-Cinnamon/{__version__}"
_VERSION_RE = re.compile(
    r"^(?:rust-v|codex-cli\s+)?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$"
)
_STABLE_TAG_RE = re.compile(r"^rust-v(\d+)\.(\d+)\.(\d+)$")


def parse_version(value):
    if not isinstance(value, str) or len(value) > 128:
        return None
    match = _VERSION_RE.fullmatch(value.strip())
    if match is None:
        return None
    return (tuple(int(part) for part in match.group(1, 2, 3)), match.group(4))


def _display_version(value):
    parsed = parse_version(value)
    if parsed is None:
        return None
    core, prerelease = parsed
    result = ".".join(str(part) for part in core)
    return f"{result}-{prerelease}" if prerelease else result


def is_newer_version(candidate, current):
    candidate_version = parse_version(candidate)
    current_version = parse_version(current)
    if candidate_version is None or current_version is None:
        return False
    candidate_core, candidate_prerelease = candidate_version
    current_core, current_prerelease = current_version
    if candidate_core != current_core:
        return candidate_core > current_core
    if candidate_prerelease is None and current_prerelease is not None:
        return True
    if candidate_prerelease is not None and current_prerelease is None:
        return False
    return bool(
        candidate_prerelease
        and current_prerelease
        and candidate_prerelease > current_prerelease
    )


class UpdateManager:
    def __init__(
        self,
        executable,
        codex_home,
        data_dir,
        *,
        clock=time.time,
        urlopen=None,
        runner=None,
        thread_factory=None,
    ):
        self.executable = str(executable)
        self.codex_home = Path(codex_home) if codex_home else Path.home() / ".codex"
        self.data_dir = Path(data_dir)
        self.clock = clock
        self.urlopen = urlopen or urllib_request.urlopen
        self._uses_default_runner = runner is None or runner is subprocess.run
        self.runner = runner or subprocess.run
        self.thread_factory = thread_factory or threading.Thread
        self._lock = threading.RLock()
        self._worker = None
        self._state_path = self.data_dir / "update-state.json"
        self._state_lock_path = self.data_dir / "update-state.lock"
        self._install_lock_path = self.data_dir / "update-install.lock"
        self._install_lock_fd = None
        self._process_start = self._process_start_identity(os.getpid())
        cached = self._read_monitor_cache()
        operation = cached.get("operation")
        recovered_status = "idle"
        self._operation = None
        stale_operation = False
        if operation is not None:
            if self._operation_owner_is_live(operation):
                self._operation = operation
                recovered_status = operation["status"]
            else:
                recovered_status = (
                    "failed" if operation["status"] == "updating" else "idle"
                )
                stale_operation = True
        self._state = {
            "installedVersion": self._installed_version(),
            "latestVersion": cached.get("latestVersion"),
            "updateAvailable": False,
            "checkedAt": cached.get("checkedAt"),
            "status": recovered_status,
            "message": None,
        }
        self._recalculate_availability()
        if stale_operation:
            if not self._persist_monitor_cache(expected_operation=operation):
                self._adopt_live_cached_operation()

    def status(self):
        with self._lock:
            self._reconcile_external_operation()
            return dict(self._state)

    def check(self, *, force=False):
        with self._lock:
            self._reconcile_external_operation()
            if self._state["status"] in {"checking", "updating"}:
                return dict(self._state)
            if not force:
                cached = self._read_fresh_codex_cache()
                if cached is not None:
                    latest, checked_at = cached
                    self._apply_check(latest, checked_at)
                    if not self._persist_monitor_cache(expected_operation=None):
                        self._adopt_live_cached_operation()
                    return dict(self._state)
                if self._is_monitor_cache_fresh():
                    return dict(self._state)
            self._state["status"] = "checking"
            self._state["message"] = None
            if not self._begin_operation("checking"):
                return dict(self._state)
            try:
                worker = self.thread_factory(
                    target=self._check_worker,
                    daemon=True,
                    name="codex-monitor-update-check",
                )
            except Exception:
                self._fail_thread_launch("idle")
                return dict(self._state)
            self._worker = worker
        try:
            worker.start()
        except Exception:
            with self._lock:
                self._fail_thread_launch("idle")
        return self.status()

    def start(self):
        with self._lock:
            self._reconcile_external_operation()
            if self._state["status"] in {"checking", "updating"}:
                return dict(self._state)
            if not self._state["updateAvailable"]:
                raise RuntimeError("No Codex update is available")
            try:
                if not self._acquire_install_lock():
                    cached = self._read_monitor_cache()
                    operation = cached.get("operation")
                    if operation is not None and self._operation_owner_is_live(
                        operation
                    ):
                        self._operation = operation
                    self._state["status"] = "updating"
                    self._state["message"] = None
                    return dict(self._state)
            except OSError:
                self._state["status"] = "failed"
                self._state["message"] = None
                return dict(self._state)
            self._state["status"] = "updating"
            self._state["message"] = None
            if not self._begin_operation("updating"):
                self._release_install_lock()
                return dict(self._state)
            try:
                worker = self.thread_factory(
                    target=self._update_worker,
                    daemon=True,
                    name="codex-monitor-update-install",
                )
            except Exception:
                self._fail_thread_launch("failed", release_install_lock=True)
                return dict(self._state)
            self._worker = worker
        try:
            worker.start()
        except Exception:
            with self._lock:
                self._fail_thread_launch("failed", release_install_lock=True)
        return self.status()

    def _update_worker(self):
        owned_operation = self._operation
        try:
            try:
                success = self._run_update_command()
                installed = self._installed_version() if success else None
            except Exception:
                installed = None
            with self._lock:
                if installed is not None and not is_newer_version(
                    self._state.get("latestVersion"), installed
                ):
                    self._state["installedVersion"] = installed
                    self._state["latestVersion"] = installed
                    self._state["checkedAt"] = int(self.clock())
                    self._state["status"] = "updated"
                    self._state["message"] = None
                else:
                    self._state["status"] = "failed"
                    self._state["message"] = None
                self._operation = None
                self._recalculate_availability()
                self._worker = None
                if not self._persist_monitor_cache(
                    expected_operation=owned_operation
                ):
                    self._adopt_live_cached_operation()
        finally:
            self._release_install_lock()

    def _check_worker(self):
        owned_operation = self._operation
        try:
            latest = self._fetch_latest_version()
        except Exception:
            latest = None
        with self._lock:
            self._operation = None
            if latest is not None:
                self._apply_check(latest, int(self.clock()))
            else:
                self._state["status"] = "idle"
                self._state["message"] = None
                self._recalculate_availability()
            self._worker = None
            if not self._persist_monitor_cache(
                expected_operation=owned_operation
            ):
                self._adopt_live_cached_operation()

    def _reconcile_external_operation(self):
        if self._worker is not None or self._state["status"] not in {
            "checking",
            "updating",
        }:
            return
        previous_status = self._state["status"]
        cached = self._read_monitor_cache()
        latest = cached.get("latestVersion")
        checked_at = cached.get("checkedAt")
        if latest is not None and checked_at is not None:
            self._state["latestVersion"] = latest
            self._state["checkedAt"] = checked_at
        operation = cached.get("operation")
        if operation is not None and self._operation_owner_is_live(operation):
            self._operation = operation
            self._state["status"] = operation["status"]
            self._recalculate_availability()
            return
        if operation is not None:
            self._operation = None
            self._state["status"] = (
                "failed" if operation["status"] == "updating" else "idle"
            )
            self._state["message"] = None
            self._recalculate_availability()
            if not self._persist_monitor_cache(expected_operation=operation):
                self._adopt_live_cached_operation()
            return
        if previous_status == "updating" and self._install_lock_is_held():
            return
        self._operation = None
        if previous_status == "checking":
            self._state["status"] = "idle"
        else:
            installed = self._installed_version()
            if installed is not None:
                self._state["installedVersion"] = installed
            self._state["status"] = (
                "updated"
                if installed is not None
                and not is_newer_version(self._state.get("latestVersion"), installed)
                else "failed"
            )
        self._state["message"] = None
        self._recalculate_availability()

    def _adopt_live_cached_operation(self):
        cached = self._read_monitor_cache()
        operation = cached.get("operation")
        if operation is None or not self._operation_owner_is_live(operation):
            return False
        self._operation = operation
        self._state["status"] = operation["status"]
        latest = cached.get("latestVersion")
        checked_at = cached.get("checkedAt")
        if latest is not None and checked_at is not None:
            self._state["latestVersion"] = latest
            self._state["checkedAt"] = checked_at
        self._state["message"] = None
        self._recalculate_availability()
        return True

    def _begin_operation(self, status):
        operation = {
            "status": status,
            "pid": os.getpid(),
            "processStart": self._process_start,
            "startedAt": int(self.clock()),
        }
        self._operation = operation
        if self._persist_monitor_cache(expected_operation=None):
            return True
        self._operation = None
        if not self._adopt_live_cached_operation():
            self._state["status"] = "failed" if status == "updating" else "idle"
            self._state["message"] = None
        return False

    def _fail_thread_launch(self, status, *, release_install_lock=False):
        owned_operation = self._operation
        self._state["status"] = status
        self._state["message"] = None
        self._operation = None
        self._worker = None
        if not self._persist_monitor_cache(expected_operation=owned_operation):
            self._adopt_live_cached_operation()
        if release_install_lock:
            self._release_install_lock()

    def _acquire_install_lock(self):
        self.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_CLOEXEC", 0)
        flags |= getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(self._install_lock_path, flags, 0o600)
        try:
            details = os.fstat(descriptor)
            if not stat.S_ISREG(details.st_mode):
                raise OSError("update lock is not a regular file")
            os.fchmod(descriptor, 0o600)
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                return False
            self._install_lock_fd = descriptor
            descriptor = None
            return True
        finally:
            if descriptor is not None:
                os.close(descriptor)

    def _release_install_lock(self):
        descriptor = self._install_lock_fd
        self._install_lock_fd = None
        if descriptor is None:
            return
        try:
            fcntl.flock(descriptor, fcntl.LOCK_UN)
        finally:
            os.close(descriptor)

    def _install_lock_is_held(self):
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
            flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_CLOEXEC", 0)
            flags |= getattr(os, "O_NOFOLLOW", 0)
            descriptor = os.open(self._install_lock_path, flags, 0o600)
        except OSError:
            return True
        try:
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                return True
            fcntl.flock(descriptor, fcntl.LOCK_UN)
            return False
        except OSError:
            return True
        finally:
            os.close(descriptor)

    @staticmethod
    def _process_start_identity(pid):
        if isinstance(pid, bool) or not isinstance(pid, int) or pid <= 0:
            return None
        try:
            payload = (Path("/proc") / str(pid) / "stat").read_bytes()
        except OSError:
            return None
        if len(payload) > 4096:
            return None
        try:
            fields = payload.rsplit(b")", 1)[1].split()
            value = fields[19].decode("ascii")
        except (IndexError, UnicodeError):
            return None
        return value if value.isdigit() else None

    def _operation_owner_is_live(self, operation):
        return (
            operation.get("processStart") is not None
            and self._process_start_identity(operation.get("pid"))
            == operation.get("processStart")
        )

    def _apply_check(self, latest, checked_at):
        self._state["latestVersion"] = latest
        self._state["checkedAt"] = int(checked_at)
        self._state["status"] = "idle"
        self._state["message"] = None
        self._recalculate_availability()

    def _recalculate_availability(self):
        self._state["updateAvailable"] = is_newer_version(
            self._state.get("latestVersion"), self._state.get("installedVersion")
        )

    def _installed_version(self):
        try:
            command = [self.executable, "--version"]
            if self._uses_default_runner:
                captured = run_bounded(
                    command,
                    timeout=10,
                    stdout_limit=MAX_VERSION_STDOUT_BYTES,
                )
                completed = subprocess.CompletedProcess(
                    command,
                    captured.returncode,
                    captured.stdout.decode("utf-8", errors="strict"),
                    "",
                )
            else:
                completed = self.runner(
                    command,
                    shell=False,
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
        except (
            CommandOutputTooLarge,
            OSError,
            subprocess.TimeoutExpired,
            UnicodeError,
        ):
            return None
        if completed.returncode != 0:
            return None
        return _display_version(completed.stdout.strip())

    def _read_fresh_codex_cache(self):
        try:
            raw = self._read_bounded_json(self.codex_home / "version.json")
            latest = _display_version(raw.get("latest_version"))
            checked_at = self._parse_timestamp(raw.get("last_checked_at"))
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return None
        if latest is None or checked_at is None or not self._is_fresh(checked_at):
            return None
        return latest, checked_at

    def _read_monitor_cache(self):
        try:
            raw = self._read_bounded_json(self._state_path)
            latest = _display_version(raw.get("latestVersion"))
            checked_at = raw.get("checkedAt")
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return {}
        result = {}
        if not (
            latest is None
            or isinstance(checked_at, bool)
            or not isinstance(checked_at, (int, float))
            or not math.isfinite(checked_at)
            or checked_at < 0
            or checked_at > self.clock() + 300
        ):
            result.update({"latestVersion": latest, "checkedAt": int(checked_at)})
        operation = raw.get("operation")
        if self._valid_operation(operation):
            result["operation"] = operation
        return result

    def _valid_operation(self, operation):
        if not isinstance(operation, dict) or set(operation) != {
            "status",
            "pid",
            "processStart",
            "startedAt",
        }:
            return False
        started_at = operation["startedAt"]
        return (
            operation["status"] in {"checking", "updating"}
            and isinstance(operation["pid"], int)
            and not isinstance(operation["pid"], bool)
            and operation["pid"] > 0
            and isinstance(operation["processStart"], str)
            and 0 < len(operation["processStart"]) <= 32
            and operation["processStart"].isdigit()
            and isinstance(started_at, (int, float))
            and not isinstance(started_at, bool)
            and math.isfinite(started_at)
            and 0 <= started_at <= self.clock() + 300
        )

    @staticmethod
    def _read_bounded_json(path):
        with path.open("rb") as handle:
            payload = handle.read(MAX_CACHE_BYTES + 1)
        if len(payload) > MAX_CACHE_BYTES:
            raise ValueError("cache is too large")
        value = json.loads(payload.decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("cache is invalid")
        return value

    def _is_monitor_cache_fresh(self):
        checked_at = self._state.get("checkedAt")
        return isinstance(checked_at, int) and self._is_fresh(checked_at)

    def _is_fresh(self, checked_at):
        age = self.clock() - checked_at
        return -300 <= age <= _CHECK_INTERVAL_SECONDS

    @staticmethod
    def _parse_timestamp(value):
        if not isinstance(value, str) or len(value) > 64:
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return int(parsed.timestamp())
        except (OverflowError, ValueError):
            return None

    def _fetch_latest_version(self):
        request = urllib_request.Request(
            _RELEASE_URL,
            headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
            method="GET",
        )
        with self.urlopen(request, timeout=10) as response:
            payload = response.read(_MAX_RESPONSE_BYTES + 1)
        if not isinstance(payload, bytes) or len(payload) > _MAX_RESPONSE_BYTES:
            raise ValueError("release response is invalid")
        try:
            value = json.loads(payload.decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            raise ValueError("release response is invalid") from None
        tag = value.get("tag_name") if isinstance(value, dict) else None
        match = _STABLE_TAG_RE.fullmatch(tag) if isinstance(tag, str) else None
        if match is None:
            raise ValueError("release tag is invalid")
        return ".".join(match.groups())

    def _run_update_command(self):
        environment = self._update_environment()
        try:
            completed = self.runner(
                [self.executable, "update"],
                shell=False,
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=1800,
                env=environment,
            )
        except (OSError, subprocess.TimeoutExpired):
            return False
        return completed.returncode == 0

    def _update_environment(self):
        environment = dict(os.environ)
        environment["CODEX_NON_INTERACTIVE"] = "true"
        if self.codex_home:
            environment["CODEX_HOME"] = str(self.codex_home)
        return environment

    def _persist_monitor_cache(self, *, expected_operation):
        latest = self._state.get("latestVersion")
        checked_at = self._state.get("checkedAt")
        payload = {}
        if latest is not None and isinstance(checked_at, int):
            payload.update({"latestVersion": latest, "checkedAt": checked_at})
        if self._operation is not None:
            payload["operation"] = self._operation
        temporary_path = None
        state_lock = None
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
            flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_CLOEXEC", 0)
            flags |= getattr(os, "O_NOFOLLOW", 0)
            state_lock = os.open(self._state_lock_path, flags, 0o600)
            details = os.fstat(state_lock)
            if not stat.S_ISREG(details.st_mode):
                raise OSError("update state lock is not a regular file")
            os.fchmod(state_lock, 0o600)
            fcntl.flock(state_lock, fcntl.LOCK_EX)
            try:
                current = self._read_bounded_json(self._state_path)
            except (OSError, TypeError, ValueError, json.JSONDecodeError):
                current = {}
            current_operation = current.get("operation")
            if expected_operation is None:
                if self._valid_operation(
                    current_operation
                ) and self._operation_owner_is_live(current_operation):
                    return False
            elif current_operation != expected_operation:
                return False
            descriptor, raw_path = tempfile.mkstemp(
                prefix=".update-state-", suffix=".tmp", dir=self.data_dir
            )
            temporary_path = Path(raw_path)
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, separators=(",", ":"))
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_path, self._state_path)
            os.chmod(self._state_path, 0o600)
            temporary_path = None
            return True
        except OSError:
            return False
        finally:
            if temporary_path is not None:
                try:
                    temporary_path.unlink()
                except OSError:
                    pass
            if state_lock is not None:
                try:
                    fcntl.flock(state_lock, fcntl.LOCK_UN)
                finally:
                    os.close(state_lock)
