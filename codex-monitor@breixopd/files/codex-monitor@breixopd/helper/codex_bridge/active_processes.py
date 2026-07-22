"""Discover live local Codex threads without reading session contents."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import time
import uuid


MAX_ENVIRONMENT_BYTES = 262_144
MAX_PROCESS_STAT_BYTES = 16_384
MAX_PROCESSES = 4096
MAX_DESCRIPTORS = 2048
MAX_LIVE_THREADS = 50


def _canonical_uuid(value):
    if not isinstance(value, str):
        return None
    try:
        normalized = str(uuid.UUID(value))
    except (ValueError, AttributeError):
        return None
    return normalized if normalized == value.lower() else None


def _bounded_bytes(path, maximum):
    try:
        with path.open("rb") as handle:
            value = handle.read(maximum + 1)
    except OSError:
        return None
    return value if len(value) <= maximum else None


def _bounded_entries(directory, maximum, *, numeric=False):
    result = []
    try:
        with os.scandir(directory) as entries:
            for entry in entries:
                if numeric and not entry.name.isdigit():
                    continue
                result.append(Path(entry.path))
                if len(result) >= maximum:
                    break
    except OSError:
        return result
    return result


def _resolved_executable(executable):
    if not isinstance(executable, str) or not executable:
        return None
    candidate = shutil.which(executable) if os.sep not in executable else executable
    if not candidate:
        return None
    try:
        return Path(candidate).resolve(strict=True)
    except OSError:
        return None


def _boot_time(proc_root):
    raw = _bounded_bytes(proc_root / "stat", MAX_PROCESS_STAT_BYTES)
    if raw is None:
        return None
    for line in raw.splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[0] == b"btime":
            try:
                value = int(fields[1])
            except ValueError:
                return None
            return value if value >= 0 else None
    return None


def _process_start(process, boot_time, *, now):
    if boot_time is None:
        return None
    raw = _bounded_bytes(process / "stat", MAX_PROCESS_STAT_BYTES)
    if raw is None:
        return None
    closing_parenthesis = raw.rfind(b")")
    if closing_parenthesis < 0:
        return None
    fields = raw[closing_parenthesis + 1 :].split()
    if len(fields) <= 19:
        return None
    try:
        started_ticks = int(fields[19])
        clock_ticks = int(os.sysconf("SC_CLK_TCK"))
    except (ValueError, OSError):
        return None
    if started_ticks < 0 or clock_ticks <= 0:
        return None
    started_at = boot_time + started_ticks // clock_ticks
    return started_at if 0 <= started_at <= int(now) + 5 else None


def _environment_thread_ids(process):
    raw = _bounded_bytes(process / "environ", MAX_ENVIRONMENT_BYTES)
    if raw is None:
        return set()
    result = set()
    for item in raw.split(b"\0"):
        key, separator, value = item.partition(b"=")
        if separator and key == b"CODEX_THREAD_ID":
            try:
                thread_id = _canonical_uuid(value.decode("ascii"))
            except UnicodeDecodeError:
                thread_id = None
            if thread_id is not None:
                result.add(thread_id)
    return result


def _descriptor_thread_ids(process, sessions_root):
    result = set()
    for descriptor in _bounded_entries(process / "fd", MAX_DESCRIPTORS):
        try:
            target_text = os.readlink(descriptor)
        except OSError:
            continue
        if len(target_text) > 4096 or not os.path.isabs(target_text):
            continue
        target = Path(target_text).resolve(strict=False)
        if not target.is_relative_to(sessions_root) or target.suffix != ".jsonl":
            continue
        thread_id = _canonical_uuid(target.stem[-36:])
        if thread_id is not None:
            result.add(thread_id)
    return result


def discover_live_threads(
    executable,
    *,
    codex_home=None,
    proc_root=Path("/proc"),
    uid=None,
    now=None,
):
    """Return validated live thread UUIDs mapped to process start timestamps."""

    expected_executable = _resolved_executable(executable)
    if expected_executable is None:
        return {}
    effective_uid = os.getuid() if uid is None else int(uid)
    effective_now = time.time() if now is None else float(now)
    proc_root = Path(proc_root)
    home = Path(codex_home).expanduser() if codex_home else Path.home() / ".codex"
    sessions_root = (home / "sessions").resolve(strict=False)
    boot_time = _boot_time(proc_root)

    result = {}
    for process in _bounded_entries(proc_root, MAX_PROCESSES, numeric=True):
        try:
            if process.stat().st_uid != effective_uid:
                continue
            process_executable = (process / "exe").resolve(strict=True)
        except OSError:
            continue
        if process_executable != expected_executable:
            continue
        started_at = _process_start(process, boot_time, now=effective_now)
        thread_ids = _environment_thread_ids(process)
        thread_ids.update(_descriptor_thread_ids(process, sessions_root))
        for thread_id in sorted(thread_ids):
            existing = result.get(thread_id)
            if thread_id not in result or (
                started_at is not None
                and (existing is None or started_at < existing)
            ):
                result[thread_id] = started_at
            if len(result) >= MAX_LIVE_THREADS:
                return result
    return result
