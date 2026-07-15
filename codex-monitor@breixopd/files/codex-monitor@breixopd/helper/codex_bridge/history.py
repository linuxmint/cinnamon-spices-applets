"""Local quota-history persistence."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


SECONDS_PER_DAY = 86_400
SAMPLE_BUCKET_SECONDS = 300
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
        self._write(rows)

    def load(self, *, now):
        cutoff = int(now) - self.retention_days * SECONDS_PER_DAY
        rows: list[dict[str, Any]] = []
        if not self.path.exists():
            return rows
        try:
            lines = self.path.read_text(encoding="utf-8").splitlines()
        except OSError:
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
            row["capturedAt"] = captured_at
            if captured_at < cutoff:
                continue
            rows.append(row)
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
        temp_path = self.path.with_suffix(self.path.suffix + ".tmp")
        with temp_path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, separators=(",", ":")) + "\n")
        os.chmod(temp_path, 0o600)
        os.replace(temp_path, self.path)
