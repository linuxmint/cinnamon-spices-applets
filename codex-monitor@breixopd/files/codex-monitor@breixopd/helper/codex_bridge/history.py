"""Local quota-history persistence."""

from __future__ import annotations

from bisect import bisect_left, bisect_right
import json
import math
import os
from pathlib import Path
import tempfile
from typing import Any


SECONDS_PER_DAY = 86_400
SAMPLE_BUCKET_SECONDS = 300
MAX_HISTORY_BYTES = 8 * 1024 * 1024
COMPACTION_INTERVAL_SECONDS = SECONDS_PER_DAY
COMPACTION_SIZE_BYTES = MAX_HISTORY_BYTES * 3 // 4
EXPIRY_PROBE_BYTES = 64 * 1024
MAX_FUTURE_SECONDS = 300
MAX_UNIX_SECONDS = 8_640_000_000_000
REQUIRED_KEYS = {
    "capturedAt",
    "fiveHourUsedPercent",
    "fiveHourResetsAt",
    "weeklyUsedPercent",
    "weeklyResetsAt",
}


class QuotaHistory:
    def __init__(self, path, *, retention_days):
        self.path = Path(path)
        self.retention_days = max(1, int(retention_days))
        self._next_compaction_at = None
        self._cache_initialized = False
        self._cache_signature = None
        self._cache_rows: tuple[dict[str, Any], ...] = ()
        self._cache_timestamps: tuple[int, ...] = ()

    def append(self, snapshot, *, now):
        sample = self._to_sample(snapshot)
        if sample is None:
            return
        line = self._serialize(sample)
        try:
            path_stat = self.path.stat()
            size = path_stat.st_size
            signature = self._file_signature(path_stat)
            file_was_missing = False
        except FileNotFoundError:
            size = 0
            signature = None
            file_was_missing = True
        except OSError:
            return
        try:
            if size > MAX_HISTORY_BYTES:
                self._write([sample])
                self._invalidate_cache()
                self._schedule_compaction(now)
                return
            if self._should_compact(
                now=now,
                size=size,
                incoming_bytes=len(line),
                signature=signature,
            ):
                rows = self._read_rows(now=now, days=self.retention_days)
                rows = self._replace_bucket(rows, sample)
                self._write(rows)
                self._invalidate_cache()
                self._schedule_compaction(now)
                return
            before_append, after_append = self._append_line(line)
            try:
                path_signature = self._file_signature(self.path.stat())
            except OSError:
                self._invalidate_cache()
            else:
                cache_matches = (
                    self._cache_initialized
                    and self._cache_signature == signature
                    and signature == before_append
                )
                new_empty_file = file_was_missing and before_append[2] == 0
                if (
                    (cache_matches or new_empty_file)
                    and path_signature == after_append
                ):
                    normalized_sample = self._normalize_row(sample)
                    if normalized_sample is not None:
                        if cache_matches:
                            self._replace_cached_bucket(
                                normalized_sample,
                                signature=path_signature,
                            )
                        else:
                            self._set_cache([normalized_sample], path_signature)
                    elif cache_matches:
                        self._cache_signature = path_signature
                    else:
                        self._set_cache([], path_signature)
                else:
                    self._invalidate_cache()
            if self._next_compaction_at is None:
                self._schedule_compaction(now)
        except OSError:
            pass

    def load(self, *, now):
        return self._read_rows(now=now, days=self.retention_days)

    def load_for_display(self, *, now, days):
        display_days = max(1, min(int(days), self.retention_days))
        return self._read_rows(now=now, days=display_days)

    def _read_rows(self, *, now, days):
        cutoff = int(now) - int(days) * SECONDS_PER_DAY
        rows = self._normalized_rows()
        first = bisect_left(self._cache_timestamps, cutoff)
        last = bisect_right(
            self._cache_timestamps,
            int(now) + MAX_FUTURE_SECONDS,
        )
        return [row.copy() for row in rows[first:last]]

    def _normalized_rows(self):
        try:
            path_stat = self.path.stat()
        except FileNotFoundError:
            self._set_cache([], None)
            return self._cache_rows
        except OSError:
            self._invalidate_cache()
            return self._cache_rows
        signature = self._file_signature(path_stat)
        if path_stat.st_size > MAX_HISTORY_BYTES:
            self._set_cache([], signature)
            return self._cache_rows
        if self._cache_initialized and self._cache_signature == signature:
            return self._cache_rows

        for _attempt in range(2):
            try:
                with self.path.open("rb") as handle:
                    before = self._file_signature(os.fstat(handle.fileno()))
                    if before[2] > MAX_HISTORY_BYTES:
                        self._set_cache([], before)
                        return self._cache_rows
                    payload = handle.read(MAX_HISTORY_BYTES + 1)
                    after = self._file_signature(os.fstat(handle.fileno()))
                current = self._file_signature(self.path.stat())
            except FileNotFoundError:
                self._set_cache([], None)
                return self._cache_rows
            except OSError:
                self._invalidate_cache()
                return self._cache_rows
            if before != after or after != current:
                continue
            if len(payload) > MAX_HISTORY_BYTES:
                self._set_cache([], current)
                return self._cache_rows
            self._set_cache(self._parse_payload(payload), current)
            return self._cache_rows

        self._invalidate_cache()
        return self._cache_rows

    def _parse_payload(self, payload):
        rows_by_bucket: dict[int, dict[str, Any]] = {}
        for raw_line in payload.splitlines():
            try:
                row = json.loads(raw_line.decode("utf-8"))
            except (json.JSONDecodeError, TypeError, UnicodeError):
                continue
            row = self._normalize_row(row)
            if row is None:
                continue
            bucket = row["capturedAt"] // SAMPLE_BUCKET_SECONDS
            rows_by_bucket[bucket] = row
        return sorted(rows_by_bucket.values(), key=lambda row: row["capturedAt"])

    @staticmethod
    def _normalize_row(row):
        if not isinstance(row, dict) or not REQUIRED_KEYS.issubset(row):
            return None
        try:
            captured_at = int(row["capturedAt"])
            percentages = tuple(
                float(row[key]) if row[key] is not None else None
                for key in ("fiveHourUsedPercent", "weeklyUsedPercent")
            )
            reset_times = tuple(
                int(row[key]) if row[key] is not None else None
                for key in ("fiveHourResetsAt", "weeklyResetsAt")
            )
        except (TypeError, ValueError):
            return None
        if percentages == (None, None):
            return None
        if any(
            value is not None
            and (not math.isfinite(value) or not 0 <= value <= 100)
            for value in percentages
        ):
            return None
        if any(
            value is not None and not 0 <= value <= MAX_UNIX_SECONDS
            for value in reset_times
        ):
            return None
        return {
            "capturedAt": captured_at,
            "fiveHourUsedPercent": percentages[0],
            "fiveHourResetsAt": reset_times[0],
            "weeklyUsedPercent": percentages[1],
            "weeklyResetsAt": reset_times[1],
        }

    def _should_compact(self, *, now, size, incoming_bytes, signature):
        if size + incoming_bytes > MAX_HISTORY_BYTES:
            return True
        if size >= COMPACTION_SIZE_BYTES:
            return True
        if (
            self._next_compaction_at is not None
            and int(now) >= self._next_compaction_at
        ):
            return True
        cutoff = int(now) - self.retention_days * SECONDS_PER_DAY
        return self._has_expired_head(cutoff, signature=signature)

    def _has_expired_head(self, cutoff, *, signature):
        if cutoff <= 0:
            return False
        if self._cache_initialized and self._cache_signature == signature:
            return bool(
                self._cache_timestamps and self._cache_timestamps[0] < cutoff
            )
        try:
            with self.path.open("rb") as handle:
                payload = handle.read(EXPIRY_PROBE_BYTES)
        except OSError:
            return False
        for raw_line in payload.splitlines():
            try:
                row = json.loads(raw_line.decode("utf-8"))
                captured_at = int(row["capturedAt"])
            except (json.JSONDecodeError, KeyError, TypeError, UnicodeError, ValueError):
                continue
            return captured_at < cutoff
        return False

    def _schedule_compaction(self, now):
        self._next_compaction_at = int(now) + COMPACTION_INTERVAL_SECONDS

    @staticmethod
    def _file_signature(stat_result):
        return (
            stat_result.st_dev,
            stat_result.st_ino,
            stat_result.st_size,
            stat_result.st_mtime_ns,
            stat_result.st_ctime_ns,
        )

    def _set_cache(self, rows, signature):
        self._cache_rows = tuple(rows)
        self._cache_timestamps = tuple(row["capturedAt"] for row in rows)
        self._cache_signature = signature
        self._cache_initialized = True

    def _invalidate_cache(self):
        self._cache_rows = ()
        self._cache_timestamps = ()
        self._cache_signature = None
        self._cache_initialized = False

    def _replace_cached_bucket(self, sample, *, signature):
        bucket_start = (
            sample["capturedAt"] // SAMPLE_BUCKET_SECONDS
        ) * SAMPLE_BUCKET_SECONDS
        first = bisect_left(self._cache_timestamps, bucket_start)
        last = bisect_left(
            self._cache_timestamps,
            bucket_start + SAMPLE_BUCKET_SECONDS,
        )
        self._cache_rows = (
            self._cache_rows[:first] + (sample,) + self._cache_rows[last:]
        )
        self._cache_timestamps = (
            self._cache_timestamps[:first]
            + (sample["capturedAt"],)
            + self._cache_timestamps[last:]
        )
        self._cache_signature = signature
        self._cache_initialized = True

    @staticmethod
    def _replace_bucket(rows, sample):
        bucket = sample["capturedAt"] // SAMPLE_BUCKET_SECONDS
        retained = [
            row
            for row in rows
            if row["capturedAt"] // SAMPLE_BUCKET_SECONDS != bucket
        ]
        retained.append(sample)
        retained.sort(key=lambda row: row["capturedAt"])
        return retained

    @staticmethod
    def _to_sample(snapshot):
        windows = snapshot.get("windows") or {}
        five_hour = windows.get("fiveHour")
        weekly = windows.get("weekly")
        if not isinstance(five_hour, dict) and not isinstance(weekly, dict):
            return None

        def values(window):
            if not isinstance(window, dict):
                return None, None
            reset_time = window.get("resetsAt")
            return (
                float(window["usedPercent"]),
                int(reset_time) if reset_time is not None else None,
            )

        five_hour_percent, five_hour_reset = values(five_hour)
        weekly_percent, weekly_reset = values(weekly)
        return {
            "capturedAt": int(snapshot["capturedAt"]),
            "fiveHourUsedPercent": five_hour_percent,
            "fiveHourResetsAt": five_hour_reset,
            "weeklyUsedPercent": weekly_percent,
            "weeklyResetsAt": weekly_reset,
        }

    def _write(self, rows):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        lines = []
        total_bytes = 0
        for row in reversed(rows):
            line = self._serialize(row)
            if total_bytes + len(line) > MAX_HISTORY_BYTES:
                break
            lines.append(line)
            total_bytes += len(line)
        temp_path = None
        descriptor, raw_path = tempfile.mkstemp(
            prefix=".history-", suffix=".tmp", dir=self.path.parent
        )
        temp_path = Path(raw_path)
        try:
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "wb") as handle:
                descriptor = -1
                for line in reversed(lines):
                    handle.write(line)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path, self.path)
            temp_path = None
        finally:
            if descriptor >= 0:
                os.close(descriptor)
            if temp_path is not None:
                try:
                    temp_path.unlink()
                except OSError:
                    pass

    def _append_line(self, line):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(
            self.path,
            os.O_APPEND | os.O_CREAT | os.O_WRONLY,
            0o600,
        )
        try:
            before = self._file_signature(os.fstat(descriptor))
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "wb") as handle:
                descriptor = -1
                handle.write(line)
                handle.flush()
                os.fsync(handle.fileno())
                after = self._file_signature(os.fstat(handle.fileno()))
            return before, after
        finally:
            if descriptor >= 0:
                os.close(descriptor)

    @staticmethod
    def _serialize(row):
        return (json.dumps(row, separators=(",", ":")) + "\n").encode("utf-8")
