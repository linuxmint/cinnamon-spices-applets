"""Non-blocking, bounded Codex release discovery and update state."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import time
from urllib import request as urllib_request

from . import __version__


_CHECK_INTERVAL_SECONDS = 12 * 3600
_MAX_RESPONSE_BYTES = 1_000_000
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
        self.runner = runner or subprocess.run
        self.thread_factory = thread_factory or threading.Thread
        self._lock = threading.RLock()
        self._worker = None
        self._state_path = self.data_dir / "update-state.json"
        cached = self._read_monitor_cache()
        self._state = {
            "installedVersion": self._installed_version(),
            "latestVersion": cached.get("latestVersion"),
            "updateAvailable": False,
            "checkedAt": cached.get("checkedAt"),
            "status": "idle",
            "message": None,
        }
        self._recalculate_availability()

    def status(self):
        with self._lock:
            return dict(self._state)

    def check(self, *, force=False):
        with self._lock:
            if self._state["status"] in {"checking", "updating"}:
                return dict(self._state)
            if not force:
                cached = self._read_fresh_codex_cache()
                if cached is not None:
                    latest, checked_at = cached
                    self._apply_check(latest, checked_at)
                    self._persist_monitor_cache()
                    return dict(self._state)
                if self._is_monitor_cache_fresh():
                    return dict(self._state)
            self._state["status"] = "checking"
            self._state["message"] = None
            worker = self.thread_factory(
                target=self._check_worker,
                daemon=True,
                name="codex-monitor-update-check",
            )
            self._worker = worker
        worker.start()
        return self.status()

    def start(self):
        with self._lock:
            if self._state["status"] in {"checking", "updating"}:
                return dict(self._state)
            if not self._state["updateAvailable"]:
                raise RuntimeError("No Codex update is available")
            self._state["status"] = "updating"
            self._state["message"] = None
            worker = self.thread_factory(
                target=self._update_worker,
                daemon=True,
                name="codex-monitor-update-install",
            )
            self._worker = worker
        worker.start()
        return self.status()

    def _update_worker(self):
        success = self._run_update_command()
        installed = self._installed_version() if success else None
        with self._lock:
            if installed is not None and not is_newer_version(
                self._state.get("latestVersion"), installed
            ):
                self._state["installedVersion"] = installed
                self._state["latestVersion"] = installed
                self._state["checkedAt"] = int(self.clock())
                self._state["status"] = "updated"
                self._state["message"] = None
                self._persist_monitor_cache()
            else:
                self._state["status"] = "failed"
                self._state["message"] = None
            self._recalculate_availability()
            self._worker = None

    def _check_worker(self):
        try:
            latest = self._fetch_latest_version()
        except (OSError, RuntimeError, TimeoutError, ValueError):
            latest = None
        with self._lock:
            if latest is not None:
                self._apply_check(latest, int(self.clock()))
                self._persist_monitor_cache()
            else:
                self._state["status"] = "idle"
                self._state["message"] = None
                self._recalculate_availability()
            self._worker = None

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
            completed = self.runner(
                [self.executable, "--version"],
                shell=False,
                check=False,
                capture_output=True,
                text=True,
                timeout=10,
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        if completed.returncode != 0:
            return None
        return _display_version(completed.stdout.strip())

    def _read_fresh_codex_cache(self):
        try:
            raw = json.loads(
                (self.codex_home / "version.json").read_text(encoding="utf-8")
            )
            latest = _display_version(raw.get("latest_version"))
            checked_at = self._parse_timestamp(raw.get("last_checked_at"))
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return None
        if latest is None or checked_at is None or not self._is_fresh(checked_at):
            return None
        return latest, checked_at

    def _read_monitor_cache(self):
        try:
            raw = json.loads(self._state_path.read_text(encoding="utf-8"))
            latest = _display_version(raw.get("latestVersion"))
            checked_at = raw.get("checkedAt")
        except (OSError, TypeError, ValueError, json.JSONDecodeError):
            return {}
        if (
            latest is None
            or isinstance(checked_at, bool)
            or not isinstance(checked_at, (int, float))
            or checked_at < 0
            or checked_at > self.clock() + 300
        ):
            return {}
        return {"latestVersion": latest, "checkedAt": int(checked_at)}

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

    def _persist_monitor_cache(self):
        latest = self._state.get("latestVersion")
        checked_at = self._state.get("checkedAt")
        if latest is None or not isinstance(checked_at, int):
            return
        temporary_path = None
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
            descriptor, raw_path = tempfile.mkstemp(
                prefix=".update-state-", suffix=".tmp", dir=self.data_dir
            )
            temporary_path = Path(raw_path)
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(
                    {"latestVersion": latest, "checkedAt": checked_at},
                    handle,
                    separators=(",", ":"),
                )
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_path, self._state_path)
            os.chmod(self._state_path, 0o600)
            temporary_path = None
        except OSError:
            pass
        finally:
            if temporary_path is not None:
                try:
                    temporary_path.unlink()
                except OSError:
                    pass
