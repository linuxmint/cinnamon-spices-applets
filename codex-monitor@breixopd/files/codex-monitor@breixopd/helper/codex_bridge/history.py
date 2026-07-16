"""Local quota-history persistence."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import tempfile
from typing import Any


SECONDS_PER_DAY = 86_400
SAMPLE_BUCKET_SECONDS = 300
MAX_HISTORY_BYTES = 8 * 1024 * 1024
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

    def append(self, snapshot, *, now):
        rows = self.load(now=now)
        sample = self._to_sample(snapshot)
        if sample is not None:
            if rows and (
                rows[-1]["capturedAt"] // SAMPLE_BUCKET_SECONDS
                == sample["capturedAt"] // SAMPLE_BUCKET_SECONDS
            ):
                rows[-1] = sample
            else:
                rows.append(sample)
        try:
            self._write(rows)
        except OSError:
            pass

    def load(self, *, now):
        cutoff = int(now) - self.retention_days * SECONDS_PER_DAY
        rows: list[dict[str, Any]] = []
        if not self.path.exists():
            return rows
        try:
            with self.path.open("rb") as handle:
                payload = handle.read(MAX_HISTORY_BYTES + 1)
            if len(payload) > MAX_HISTORY_BYTES:
                return rows
            lines = payload.decode("utf-8").splitlines()
        except (OSError, UnicodeError):
            return rows
        for line in lines:
            try:
                row = json.loads(line)
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(row, dict) or not REQUIRED_KEYS.issubset(row):
                continue
            try:
                captured_at = int(row["capturedAt"])
                for key in ("fiveHourUsedPercent", "weeklyUsedPercent"):
                    row[key] = float(row[key]) if row[key] is not None else None
                for key in ("fiveHourResetsAt", "weeklyResetsAt"):
                    row[key] = int(row[key]) if row[key] is not None else None
            except (TypeError, ValueError):
                continue
            if row["fiveHourUsedPercent"] is None and row["weeklyUsedPercent"] is None:
                continue
            percentages = (row["fiveHourUsedPercent"], row["weeklyUsedPercent"])
            if any(
                value is not None
                and (not math.isfinite(value) or not 0 <= value <= 100)
                for value in percentages
            ):
                continue
            reset_times = (row["fiveHourResetsAt"], row["weeklyResetsAt"])
            if any(
                value is not None and not 0 <= value <= MAX_UNIX_SECONDS
                for value in reset_times
            ):
                continue
            if captured_at < cutoff or captured_at > int(now) + MAX_FUTURE_SECONDS:
                continue
            rows.append(
                {
                    "capturedAt": captured_at,
                    "fiveHourUsedPercent": row["fiveHourUsedPercent"],
                    "fiveHourResetsAt": row["fiveHourResetsAt"],
                    "weeklyUsedPercent": row["weeklyUsedPercent"],
                    "weeklyResetsAt": row["weeklyResetsAt"],
                }
            )
        rows.sort(key=lambda row: row["capturedAt"])
        return rows

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
        temp_path = None
        descriptor, raw_path = tempfile.mkstemp(
            prefix=".history-", suffix=".tmp", dir=self.path.parent
        )
        temp_path = Path(raw_path)
        try:
            os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                descriptor = -1
                for row in rows:
                    handle.write(json.dumps(row, separators=(",", ":")) + "\n")
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
