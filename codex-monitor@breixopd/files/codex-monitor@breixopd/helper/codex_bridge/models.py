"""Normalize Codex app-server payloads for the Cinnamon UI."""

from __future__ import annotations

import math
from typing import Any


FIVE_HOUR_MINUTES = 300
WEEKLY_MINUTES = 10_080


def _normalize_window(
    window: dict[str, Any], *, limit_id: str | None, limit_name: str | None
) -> dict[str, Any] | None:
    used_percent = window.get("usedPercent")
    duration = _integer(window.get("windowDurationMins"))
    if (
        isinstance(used_percent, bool)
        or not isinstance(used_percent, (int, float))
        or not math.isfinite(float(used_percent))
        or duration is None
        or duration <= 0
    ):
        return None
    reset_time = _integer(window.get("resetsAt"), optional=True)
    return {
        "limitId": _bounded_string(limit_id),
        "limitName": _bounded_string(limit_name),
        "usedPercent": max(0.0, min(100.0, float(used_percent))),
        "windowDurationMins": duration,
        "resetsAt": reset_time,
    }


def _integer(value: Any, *, optional: bool = False) -> int | None:
    if value is None and optional:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(float(value)):
        return None
    return int(value)


def _bounded_string(value: Any, *, maximum: int = 256) -> str | None:
    if not isinstance(value, str) or not value or len(value) > maximum:
        return None
    return " ".join(value.split()) or None


def _normalize_reset_credits(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {"availableCount": 0, "credits": []}

    credits = []
    for raw in value.get("credits") or []:
        if not isinstance(raw, dict):
            continue
        credit_id = _bounded_string(raw.get("id"))
        granted_at = _integer(raw.get("grantedAt"))
        expires_at = _integer(raw.get("expiresAt"), optional=True)
        if credit_id is None or granted_at is None:
            continue
        credits.append(
            {
                "id": credit_id,
                "resetType": _bounded_string(raw.get("resetType")) or "unknown",
                "status": _bounded_string(raw.get("status")) or "unknown",
                "grantedAt": granted_at,
                "expiresAt": expires_at,
                "title": _bounded_string(raw.get("title"), maximum=160),
                "description": _bounded_string(
                    raw.get("description"), maximum=500
                ),
            }
        )
    available_count = _integer(value.get("availableCount"))
    return {
        "availableCount": max(0, available_count or 0),
        "credits": credits[:50],
    }


def normalize_snapshot(payload: dict[str, Any], *, captured_at: int) -> dict[str, Any]:
    """Return a UI-safe snapshot from an account/rateLimits/read response."""
    payload = payload if isinstance(payload, dict) else {}
    base = payload.get("rateLimits")
    base = base if isinstance(base, dict) else {}
    buckets_by_id = payload.get("rateLimitsByLimitId")
    if isinstance(buckets_by_id, dict):
        base_limit_id = base.get("limitId")

        def bucket_priority(bucket):
            limit_id = bucket.get("limitId") if isinstance(bucket, dict) else None
            if limit_id == "codex":
                return 0
            if base_limit_id is not None and limit_id == base_limit_id:
                return 1
            return 2

        buckets = sorted(buckets_by_id.values(), key=bucket_priority)
    else:
        buckets = [base]
    if not buckets:
        buckets = [base]

    windows: dict[str, dict[str, Any] | None] = {"fiveHour": None, "weekly": None}
    extra_windows: list[dict[str, Any]] = []

    for bucket in buckets:
        if not isinstance(bucket, dict):
            continue
        limit_id = bucket.get("limitId")
        limit_name = bucket.get("limitName")
        for key in ("primary", "secondary"):
            raw_window = bucket.get(key)
            if not isinstance(raw_window, dict):
                continue
            normalized = _normalize_window(
                raw_window, limit_id=limit_id, limit_name=limit_name
            )
            if normalized is None:
                continue
            duration = normalized["windowDurationMins"]
            if duration == FIVE_HOUR_MINUTES and windows["fiveHour"] is None:
                windows["fiveHour"] = normalized
            elif duration == WEEKLY_MINUTES and windows["weekly"] is None:
                windows["weekly"] = normalized
            else:
                extra_windows.append(normalized)

    return {
        "capturedAt": int(captured_at),
        "planType": _bounded_string(base.get("planType")),
        "windows": windows,
        "extraWindows": extra_windows,
        "credits": _integer(base.get("credits"), optional=True),
        "individualLimit": None,
        "rateLimitReachedType": _bounded_string(base.get("rateLimitReachedType")),
        "resetCredits": _normalize_reset_credits(payload.get("rateLimitResetCredits")),
    }
