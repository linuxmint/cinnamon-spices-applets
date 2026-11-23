#!/usr/bin/env python3
"""Read Z.ai GLM Coding Plan limits through the Z.ai usage monitor API."""

from __future__ import annotations

import argparse
import datetime as dt
import gettext
import json
import math
import os
import re
import signal
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

_data_home = os.environ.get("XDG_DATA_HOME")
_locale_dir = Path(_data_home) / "locale" if _data_home else Path.home() / ".local" / "share" / "locale"
_ = gettext.translation("z-usage@oss-singularity", localedir=str(_locale_dir), fallback=True).gettext


DEFAULT_API_BASE = "https://api.z.ai"
QUOTA_LIMIT_PATH = "/api/monitor/usage/quota/limit"
ACCOUNT_LIMIT_ID = "zai"
ACCOUNT_LIMIT_LABEL = _("Z.ai Coding Plan")
KEY_FILE_RELATIVE = ("cinnamon-z-usage", "api-key")

ZCODE_PLAN_BASE = "https://zcode.z.ai"
ZCODE_PLAN_BALANCE_PATH = "/api/v1/zcode-plan/billing/balance"
# ZCode's own client version as of this fork; the endpoint accepts the value
# ZCode itself sends and the payload shape is validated independently.
ZCODE_PLAN_APP_VERSION = "3.11.2"
ZCODE_PLAN_SOURCE = "zcode-plan"

HISTORY_VERSION = 1
HISTORY_RETENTION_SECONDS = 8 * 24 * 60 * 60
ACTIVITY_WINDOW_SECONDS = 24 * 60 * 60
DEFAULT_ACTIVITY_BUCKET_MINUTES = 60
RESET_TIMESTAMP_JITTER_SECONDS = 60
AUTH_REQUIRED_PREFIX = "AUTH_REQUIRED:"
AUTH_REQUIRED_MESSAGE = _(
    "Add a Z.ai API key with Coding Plan access in the applet settings, then refresh this applet."
)

# Monitor-API window units seen in the wild: unit 3 counts hours and unit 6
# counts weeks. Unknown units fall back to the advertised reset timestamp.
_WINDOW_UNIT_MINUTES = {1: 1, 2: 60, 3: 60, 4: 1440, 5: 1440, 6: 10080}


class UsageError(RuntimeError):
    """A user-facing usage retrieval error."""


class AuthenticationRequired(UsageError):
    """The monitor API cannot read usage without a usable Z.ai API key."""


def is_authentication_error(detail: Any) -> bool:
    """Recognise stable Z.ai authentication failures without exposing raw errors."""

    message = str(detail or "").casefold()
    markers = (
        "token expired",
        "token incorrect",
        "invalid token",
        "unauthorized",
        "authentication required",
        "not authenticated",
        "api key",
    )
    return any(marker in message for marker in markers)


def _number(value: Any, default: float = 0) -> float:
    try:
        number = float(value) if not isinstance(value, bool) else float("nan")
        return number if math.isfinite(number) else default
    except (TypeError, ValueError, OverflowError):
        return default


def _window_duration_minutes(entry: dict[str, Any], now: int) -> int:
    """Convert one monitor-API limit into the applet's window duration."""

    unit = _number(entry.get("unit"))
    count = _number(entry.get("number"))
    unit_minutes = _WINDOW_UNIT_MINUTES.get(int(unit)) if unit else None
    if unit_minutes and count > 0:
        return int(count * unit_minutes)

    # Unknown unit/count pair: snap the advertised reset timestamp onto a
    # known coding-plan window before falling back to raw remaining minutes.
    resets_at = int(_number(entry.get("nextResetTime")) / 1000) or None
    if resets_at and resets_at > now:
        remaining_minutes = (resets_at - now) / 60
        for window_minutes in (300, 10080):
            if abs(remaining_minutes - window_minutes) <= window_minutes * 0.05:
                return window_minutes
        return max(1, int(round(remaining_minutes)))
    return 0


def normalise_quota_limits(data: Any, now: int | None = None) -> dict[str, Any]:
    """Convert the Z.ai monitor payload into an applet usage snapshot."""

    now = int(time.time()) if now is None else int(now)
    entries = data.get("limits") if isinstance(data, dict) else None
    plan = str(data.get("level") or "").strip() if isinstance(data, dict) else ""

    windows = []
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        used = _number(entry.get("percentage"), -1)
        if used < 0 or used > 100:
            continue
        duration = _window_duration_minutes(entry, now)
        if duration <= 0:
            continue
        resets_at = int(_number(entry.get("nextResetTime")) / 1000) or None
        window = {
            "durationMinutes": duration,
            "usedPercent": used,
            "remainingPercent": 100.0 - used,
            "resetsAt": resets_at,
            "lastResetAt": None,
        }
        if entry.get("currentValue") is not None:
            window["usedCredits"] = _number(entry.get("currentValue"))
        if entry.get("usage") is not None:
            window["totalCredits"] = _number(entry.get("usage"))
        windows.append(window)

    windows.sort(key=lambda window: window["durationMinutes"])
    limits = []
    if windows:
        limits.append(
            {
                "id": ACCOUNT_LIMIT_ID,
                "label": ACCOUNT_LIMIT_LABEL,
                "planType": plan or None,
                "windows": windows,
            }
        )

    # Prefer the weekly remaining credits as the display balance; the shorter
    # window is only a fallback while the plan has no weekly bucket yet.
    balance = None
    for window in reversed(windows):
        if window.get("totalCredits") is None or window.get("usedCredits") is None:
            continue
        remaining = _number(window["totalCredits"]) - _number(window["usedCredits"])
        if remaining >= 0:
            balance = remaining
            break

    credits = {
        "availableResetCount": 0,
        "nextResetExpiresAt": None,
        "resetCredits": None,
        "balance": None if balance is None else str(round(balance, 6)),
        "hasCredits": balance is not None,
        "unlimited": False,
        "plan": plan or None,
        "showLimitResets": False,
    }

    return {
        "updatedAt": now,
        "limits": limits,
        "credits": credits,
    }


def default_history_path() -> Path:
    """Return the XDG state path for credential-free usage samples."""

    state_root = os.environ.get("XDG_STATE_HOME")
    if not state_root:
        state_root = os.path.expanduser("~/.local/state")
    return Path(state_root) / "cinnamon-z-usage" / "history.json"


# Rapid manual refreshes can trip the ZCode plan balance endpoint even while
# the primary quota API stays healthy. Without a fallback the plan sections
# and their rings vanish from the applet for that refresh, so the last known
# buckets are replayed for a short grace window instead.
PLAN_BALANCE_CACHE_TTL = 600
PLAN_BALANCE_CACHE_VERSION = 1


def plan_balance_cache_path() -> Path:
    """Return the XDG state path for the last known plan bucket snapshot."""

    state_root = os.environ.get("XDG_STATE_HOME")
    if not state_root:
        state_root = os.path.expanduser("~/.local/state")
    return Path(state_root) / "cinnamon-z-usage" / "plan-balances-cache.json"


def save_plan_balance_cache(limits: list[dict[str, Any]], now: int | None = None) -> None:
    """Persist the normalised plan limits; failures never break the snapshot."""

    try:
        path = plan_balance_cache_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": PLAN_BALANCE_CACHE_VERSION,
            "fetchedAt": int(time.time()) if now is None else int(now),
            "limits": limits,
        }
        path.write_text(json.dumps(payload), encoding="utf-8")
    except (OSError, TypeError, ValueError):
        pass


def load_plan_balance_cache(now: int | None = None) -> list[dict[str, Any]]:
    """Return cached plan limits within the grace window and unexpired resets.

    Entries whose reset moment already passed are dropped: replaying an
    expired window would render a countdown that is over, not stale.
    """

    now = int(time.time()) if now is None else int(now)
    try:
        payload = json.loads(plan_balance_cache_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if not isinstance(payload, dict) or payload.get("version") != PLAN_BALANCE_CACHE_VERSION:
        return []
    fetched_at = _number(payload.get("fetchedAt"), -1)
    if fetched_at < 0 or now - int(fetched_at) > PLAN_BALANCE_CACHE_TTL:
        return []
    limits = payload.get("limits")
    if not isinstance(limits, list):
        return []
    fresh: list[dict[str, Any]] = []
    for limit in limits:
        if not isinstance(limit, dict):
            continue
        windows = [
            window
            for window in limit.get("windows", [])
            if isinstance(window, dict) and int(_number(window.get("resetsAt"), 0)) > now
        ]
        if windows:
            fresh.append({**limit, "windows": windows})
    return fresh


def _history_window_key(limit_id: str, duration: int) -> str:
    return f"{limit_id}:{duration}"


def _credit_balance_from_snapshot(snapshot: dict[str, Any]) -> float | None:
    credits = snapshot.get("credits")
    if not isinstance(credits, dict) or credits.get("unlimited"):
        return None
    balance = _number(credits.get("balance"), -1)
    return round(balance, 6) if balance >= 0 else None


def _sample_from_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    windows: dict[str, dict[str, Any]] = {}
    for limit in snapshot.get("limits", []):
        limit_id = str(limit.get("id") or ACCOUNT_LIMIT_ID)
        for window in limit.get("windows", []):
            duration = int(_number(window.get("durationMinutes")))
            used = _number(window.get("usedPercent"), -1)
            if duration <= 0 or used < 0:
                continue
            windows[_history_window_key(limit_id, duration)] = {
                "usedPercent": min(100.0, max(0.0, used)),
                "resetsAt": int(_number(window.get("resetsAt"))) or None,
            }
    sample = {"timestamp": int(snapshot["updatedAt"]), "windows": windows}
    credit_balance = _credit_balance_from_snapshot(snapshot)
    if credit_balance is not None:
        sample["creditBalance"] = credit_balance
    return sample


def _load_history(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(payload, dict) or payload.get("version") != HISTORY_VERSION:
        return []
    samples = payload.get("samples")
    if not isinstance(samples, list):
        return []
    clean = []
    for sample in samples:
        if not isinstance(sample, dict) or not isinstance(sample.get("windows"), dict):
            continue
        timestamp = int(_number(sample.get("timestamp")))
        if timestamp <= 0:
            continue
        windows = {}
        for key, window in sample["windows"].items():
            if not isinstance(window, dict):
                continue
            used = _number(window.get("usedPercent"), -1)
            if 0 <= used <= 100:
                windows[key] = {
                    "usedPercent": used,
                    "resetsAt": int(_number(window.get("resetsAt"))) or None,
                }
        clean_sample = {"timestamp": timestamp, "windows": windows}
        credit_balance = _number(sample.get("creditBalance"), -1)
        if credit_balance >= 0:
            clean_sample["creditBalance"] = round(credit_balance, 6)
        if windows or "creditBalance" in clean_sample:
            clean.append(clean_sample)
    return clean


def _write_history(path: Path, samples: list[dict[str, Any]]) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=".history-", suffix=".json", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(
                {"version": HISTORY_VERSION, "samples": samples},
                stream,
                separators=(",", ":"),
            )
            stream.write("\n")
        os.replace(temporary_name, path)
    except BaseException:
        try:
            os.close(descriptor)
        except OSError:
            pass
        try:
            os.unlink(temporary_name)
        except OSError:
            pass
        raise


def _window_points(samples: list[dict[str, Any]], key: str, end_at: int) -> list[tuple[int, dict[str, Any]]]:
    points = []
    for sample in samples:
        timestamp = int(_number(sample.get("timestamp")))
        window = sample.get("windows", {}).get(key)
        if timestamp <= 0 or timestamp > end_at or not isinstance(window, dict):
            continue
        used = _number(window.get("usedPercent"), -1)
        if 0 <= used <= 100:
            points.append((timestamp, window))
    return sorted(points, key=lambda point: point[0])


def _credit_points(samples: list[dict[str, Any]], end_at: int) -> list[tuple[int, dict[str, Any]]]:
    points = []
    for sample in samples:
        timestamp = int(_number(sample.get("timestamp")))
        balance = _number(sample.get("creditBalance"), -1)
        if timestamp <= 0 or timestamp > end_at or balance < 0:
            continue
        points.append((timestamp, {"balance": balance}))
    return sorted(points, key=lambda point: point[0])


def _positive_delta(previous: dict[str, Any], current: dict[str, Any]) -> float:
    previous_reset = previous.get("resetsAt")
    current_reset = current.get("resetsAt")
    previous_used = _number(previous.get("usedPercent"))
    current_used = _number(current.get("usedPercent"))
    reset_shift = abs(_number(current_reset) - _number(previous_reset))
    if previous_reset and current_reset and reset_shift > RESET_TIMESTAMP_JITTER_SECONDS:
        # A capped rolling window can move its advertised reset timestamp while
        # remaining at 100%; that is not a fresh full-window consumption event.
        if previous_used >= 100 and current_used >= 100:
            return 0.0
        return max(0.0, current_used)
    return max(0.0, current_used - previous_used)


def _positive_credit_delta(previous: dict[str, Any], current: dict[str, Any]) -> float:
    previous_balance = _number(previous.get("balance"), -1)
    current_balance = _number(current.get("balance"), -1)
    if previous_balance < 0 or current_balance < 0:
        return 0.0
    return max(0.0, previous_balance - current_balance)


def _observed_consumption(
    points: list[tuple[int, dict[str, Any]]],
    start_at: int,
    end_at: int,
) -> tuple[float, bool, bool]:
    baseline = None
    after_start = []
    for point in points:
        if point[0] <= start_at:
            baseline = point
        elif point[0] <= end_at:
            after_start.append(point)
    selected = ([baseline] if baseline else []) + after_start
    consumed = sum(_positive_delta(previous[1], current[1]) for previous, current in zip(selected, selected[1:]))
    return consumed, baseline is not None, len(selected) >= 2


def _observed_credit_consumption(
    points: list[tuple[int, dict[str, Any]]],
    start_at: int,
    end_at: int,
) -> tuple[float, bool, bool]:
    baseline = None
    after_start = []
    for point in points:
        if point[0] <= start_at:
            baseline = point
        elif point[0] <= end_at:
            after_start.append(point)
    selected = ([baseline] if baseline else []) + after_start
    consumed = sum(_positive_credit_delta(previous[1], current[1]) for previous, current in zip(selected, selected[1:]))
    return consumed, baseline is not None, len(selected) >= 2


def _aligned_bucket_end(now: int, bucket_seconds: int) -> int:
    """Return the next local wall-clock bucket boundary, including an exact boundary."""

    local_now = dt.datetime.fromtimestamp(now).astimezone()
    offset_seconds = int((local_now.utcoffset() or dt.timedelta()).total_seconds())
    local_epoch = now + offset_seconds
    return ((local_epoch + bucket_seconds - 1) // bucket_seconds) * bucket_seconds - offset_seconds


def build_usage_history(
    snapshot: dict[str, Any],
    samples: list[dict[str, Any]],
    bucket_minutes: int = DEFAULT_ACTIVITY_BUCKET_MINUTES,
) -> dict[str, Any]:
    """Build observed consumption periods and a 24-hour activity timeline."""

    now = int(snapshot["updatedAt"])
    bucket_seconds = int(bucket_minutes) * 60
    bucket_count = ACTIVITY_WINDOW_SECONDS // bucket_seconds
    activity_end = _aligned_bucket_end(now, bucket_seconds)
    local_now = dt.datetime.fromtimestamp(now).astimezone()
    start_of_today = int(local_now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    periods = (
        ("1h", now - 60 * 60),
        ("4h", now - 4 * 60 * 60),
        ("12h", now - 12 * 60 * 60),
        ("24h", now - ACTIVITY_WINDOW_SECONDS),
        ("today", start_of_today),
    )
    history_windows = []
    tracked_since = min((int(_number(sample.get("timestamp"))) for sample in samples), default=now)
    credit_points = _credit_points(samples, now)
    credit_periods = {}
    for period_key, start_at in periods:
        consumed, complete, _ = _observed_credit_consumption(credit_points, start_at, now)
        credit_periods[period_key] = {
            "consumed": round(consumed, 2),
            "complete": complete,
        }

    credit_activity = []
    activity_start = activity_end - ACTIVITY_WINDOW_SECONDS
    for index in range(bucket_count):
        bucket_start = activity_start + index * bucket_seconds
        bucket_end = bucket_start + bucket_seconds
        consumed, has_baseline, observed = _observed_credit_consumption(
            credit_points,
            bucket_start,
            bucket_end,
        )
        credit_activity.append(
            {
                "consumed": round(consumed, 2),
                "complete": has_baseline and bucket_end <= now,
                "observed": observed,
            }
        )

    for limit in snapshot.get("limits", []):
        limit_id = str(limit.get("id") or ACCOUNT_LIMIT_ID)
        limit_label = str(limit.get("label") or limit_id)
        for window in limit.get("windows", []):
            duration = int(_number(window.get("durationMinutes")))
            if duration <= 0:
                continue
            key = _history_window_key(limit_id, duration)
            points = _window_points(samples, key, now)
            period_values = {}
            for period_key, start_at in periods:
                consumed, complete, _ = _observed_consumption(points, start_at, now)
                period_values[period_key] = {
                    "consumedPercent": round(consumed, 2),
                    "complete": complete,
                }

            activity = []
            activity_start = activity_end - ACTIVITY_WINDOW_SECONDS
            for index in range(bucket_count):
                bucket_start = activity_start + index * bucket_seconds
                bucket_end = bucket_start + bucket_seconds
                consumed, has_baseline, observed = _observed_consumption(
                    points,
                    bucket_start,
                    bucket_end,
                )
                activity.append(
                    {
                        "consumedPercent": round(consumed, 2),
                        "complete": has_baseline and bucket_end <= now,
                        "observed": observed,
                    }
                )

            history_windows.append(
                {
                    "id": limit_id,
                    "label": limit_label,
                    "durationMinutes": duration,
                    "source": limit.get("source") or "coding-plan",
                    "trackedSince": points[0][0] if points else now,
                    "periods": period_values,
                    "activity24h": activity,
                }
            )

    return {
        "trackedSince": tracked_since,
        "activityBucketMinutes": int(bucket_minutes),
        "activityEndAt": activity_end,
        "creditPeriods": credit_periods,
        "creditActivity24h": credit_activity,
        "windows": history_windows,
    }


def update_usage_history(
    snapshot: dict[str, Any],
    path: Path,
    bucket_minutes: int = DEFAULT_ACTIVITY_BUCKET_MINUTES,
) -> dict[str, Any]:
    """Append one sample atomically and attach derived history to the snapshot."""

    now = int(snapshot["updatedAt"])
    cutoff = now - HISTORY_RETENTION_SECONDS
    samples = [sample for sample in _load_history(path) if int(_number(sample.get("timestamp"))) >= cutoff]
    current = _sample_from_snapshot(snapshot)
    if current["windows"] or "creditBalance" in current:
        if samples and int(_number(samples[-1].get("timestamp"))) == now:
            samples[-1] = current
        else:
            samples.append(current)
    samples = sorted(samples, key=lambda sample: int(_number(sample.get("timestamp"))))
    samples = samples[-10000:]
    _write_history(path, samples)
    snapshot["history"] = build_usage_history(snapshot, samples, bucket_minutes)
    return snapshot


def config_key_path() -> Path:
    """Return the fallback file holding the personal Z.ai API key."""

    config_root = os.environ.get("XDG_CONFIG_HOME")
    if not config_root:
        config_root = os.path.expanduser("~/.config")
    return Path(config_root).joinpath(*KEY_FILE_RELATIVE)


def zcode_provider_key() -> str:
    """Return the Coding Plan API key cached by the ZCode app, if any."""

    providers = _zcode_providers()
    for provider_id in ("builtin:zai-coding-plan", "builtin:bigmodel-coding-plan"):
        options = _provider_options(providers, provider_id)
        key = str(options.get("apiKey") or "").strip()
        if key:
            return key
    return ""


def zcode_plan_token() -> str:
    """Return the token ZCode uses for its own plan billing endpoints."""

    candidates = (str(os.environ.get("ZAI_START_PLAN_TOKEN") or "").strip(),)
    for candidate in candidates:
        if candidate:
            return candidate
    providers = _zcode_providers()
    for provider_id in ("builtin:zai-start-plan", "builtin:bigmodel-start-plan"):
        options = _provider_options(providers, provider_id)
        key = str(options.get("apiKey") or "").strip()
        if key:
            return key
    return ""


def _zcode_providers() -> dict[str, Any]:
    cache_candidates = []
    v2_home = os.environ.get("ZCODE_HOME")
    if v2_home:
        cache_candidates.append(Path(v2_home) / "config.json")
    cache_candidates.append(Path.home() / ".zcode" / "v2" / "config.json")
    for cache_path in cache_candidates:
        try:
            config = json.loads(cache_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(config, dict) and isinstance(config.get("provider"), dict):
            return config["provider"]
    return {}


def _provider_options(providers: dict[str, Any], provider_id: str) -> dict[str, Any]:
    options = providers.get(provider_id)
    if isinstance(options, dict):
        options = options.get("options")
    return options if isinstance(options, dict) else {}


def resolve_api_key(explicit: str | None) -> str:
    """Resolve the API key like Codex resolution: explicit, then automatic."""

    candidates = (
        str(explicit or "").strip(),
        str(os.environ.get("ZAI_API_KEY") or "").strip(),
    )
    for candidate in candidates:
        if candidate:
            return candidate
    try:
        from_file = config_key_path().read_text(encoding="utf-8").strip()
    except OSError:
        from_file = ""
    return from_file or zcode_provider_key()


def fetch_quota_limits(api_key: str, base_url: str, timeout: float) -> dict[str, Any]:
    """Perform one read-only monitor-API request and return its data payload."""

    if not math.isfinite(timeout) or timeout <= 0:
        raise UsageError(_("Request timeout must be finite and positive"))
    key = str(api_key or "").strip()
    if not key:
        raise AuthenticationRequired(AUTH_REQUIRED_MESSAGE)
    base = str(base_url or DEFAULT_API_BASE).strip().rstrip("/")
    url = f"{base}{QUOTA_LIMIT_PATH}"
    request = urllib.request.Request(
        url,
        headers={
            # The monitor API expects the raw key; a Bearer prefix is rejected.
            "Authorization": key,
            "Accept-Language": "en-US,en",
            "Content-Type": "application/json",
            "User-Agent": "cinnamon-z-usage",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        detail = ""
        try:
            detail = error.read().decode("utf-8", errors="replace")[:200]
        except OSError:
            pass
        if error.code in (401, 403):
            raise AuthenticationRequired(AUTH_REQUIRED_MESSAGE) from error
        raise UsageError(
            _("Z.ai rejected the request: HTTP %(code)s %(detail)s") % {"code": error.code, "detail": detail}
        )
    except (urllib.error.URLError, OSError, TimeoutError) as error:
        raise UsageError(_("Could not reach the Z.ai usage API: %(error)s") % {"error": error}) from error

    try:
        envelope = json.loads(body)
    except json.JSONDecodeError as error:
        raise UsageError(_("Z.ai returned an unreadable usage response")) from error
    if not isinstance(envelope, dict):
        raise UsageError(_("Z.ai returned an unreadable usage response"))

    code = envelope.get("code")
    if envelope.get("success") is False or (code not in (None, 200) and not envelope.get("success")):
        message = str(envelope.get("msg") or "")
        if code in (401, 403) or is_authentication_error(message):
            raise AuthenticationRequired(AUTH_REQUIRED_MESSAGE)
        raise UsageError(_("Z.ai rejected the request: %(message)s") % {"message": message or code})

    data = envelope.get("data")
    if not isinstance(data, dict):
        raise UsageError(_("Z.ai returned no usage data"))
    return data


def zcode_source_headers(origin: str) -> dict[str, str]:
    """Mirror the client headers ZCode sends to its own plan endpoints."""

    platform_names = {"darwin": "macos", "win32": "windows"}
    platform = sys.platform
    headers = {
        "User-Agent": f"ZCode/{ZCODE_PLAN_APP_VERSION}",
        "HTTP-Referer": origin,
        "X-Title": "Z Code@electron",
        "X-ZCode-App-Version": ZCODE_PLAN_APP_VERSION,
        "X-Platform": f"{platform}-{os.uname().machine}",
        "X-Client-Language": os.environ.get("LC_ALL", "").split(".")[0] or "en-US",
        "X-Client-Timezone": time.tzname[0] if time.tzname else "UTC",
        "X-Os-Category": platform_names.get(platform, "linux"),
        "X-Os-Version": os.uname().release,
    }
    try:
        telemetry = json.loads((Path.home() / ".zcode" / "v2" / "telemetry-state.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        telemetry = None
    device_mid = telemetry.get("deviceMid") if isinstance(telemetry, dict) else None
    if isinstance(device_mid, str) and device_mid.strip():
        headers["X-Device-Mid"] = device_mid.strip()
    return headers


def fetch_plan_balances(token: str, base_url: str, timeout: float) -> dict[str, Any]:
    """Read the ZCode plan buckets (Start Plan, Global Build, ...) if available."""

    if not math.isfinite(timeout) or timeout <= 0:
        raise UsageError(_("Request timeout must be finite and positive"))
    key = str(token or "").strip()
    if not key:
        raise UsageError(_("No ZCode plan token found"))
    base = str(base_url or ZCODE_PLAN_BASE).strip().rstrip("/")
    origin = base if "://" in base else f"https://{base}"
    url = f"{origin}{ZCODE_PLAN_BALANCE_PATH}?app_version={ZCODE_PLAN_APP_VERSION}"
    request = urllib.request.Request(
        url,
        headers={
            **zcode_source_headers(origin),
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        raise UsageError(_("ZCode plan balance request failed: HTTP %(code)s") % {"code": error.code}) from error
    except (urllib.error.URLError, OSError, TimeoutError) as error:
        raise UsageError(_("Could not reach the ZCode plan balance API: %(error)s") % {"error": error}) from error
    try:
        envelope = json.loads(body)
    except json.JSONDecodeError as error:
        raise UsageError(_("ZCode returned an unreadable plan balance response")) from error
    if not isinstance(envelope, dict) or envelope.get("code") not in (0, 200):
        message = str(envelope.get("msg") or "") if isinstance(envelope, dict) else ""
        raise UsageError(_("ZCode rejected the plan balance request: %(message)s") % {"message": message or "unknown"})
    data = envelope.get("data")
    if not isinstance(data, dict):
        raise UsageError(_("ZCode returned no plan balance data"))
    return data


def normalise_plan_balances(data: Any, now: int | None = None) -> list[dict[str, Any]]:
    """Convert ZCode plan buckets into secondary applet limits (one per model)."""

    now = int(time.time()) if now is None else int(now)
    if not isinstance(data, dict):
        return []
    plans = {}
    for plan in data.get("plans") or []:
        if isinstance(plan, dict) and plan.get("plan_id"):
            plans[str(plan["plan_id"])] = plan

    limits = []
    for bucket in data.get("balances") or []:
        if not isinstance(bucket, dict):
            continue
        total = _number(bucket.get("total_units"), -1)
        if total <= 0:
            continue
        remaining = _number(bucket.get("remaining_units"), -1)
        used = _number(bucket.get("used_units"), 0)
        if remaining < 0 or used < 0:
            continue
        period_start = int(_number(bucket.get("period_start"))) or None
        period_end = int(_number(bucket.get("period_end"))) or None
        duration = 0
        if period_start and period_end and period_end > period_start:
            duration = int(round((period_end - period_start) / 60))
        if duration <= 0:
            duration = 1440

        plan = plans.get(str(bucket.get("plan_id") or ""), {})
        plan_name = str(plan.get("name") or bucket.get("plan_id") or "ZCode Plan")
        plan_short = re.sub(r"^ZCode\s+", "", plan_name).strip() or plan_name
        model = _bucket_model_name(bucket)
        label = f"{plan_short} · {model}" if model else plan_short
        limit_id = "zai-" + re.sub(r"[^a-z0-9]+", "-", f"{plan_short} {model}".lower()).strip("-")
        limits.append(
            {
                "id": limit_id,
                "label": label,
                "planType": plan_short,
                "source": ZCODE_PLAN_SOURCE,
                "priority": _number(bucket.get("plan_priority") or bucket.get("priority"), 0),
                "windows": [
                    {
                        "durationMinutes": duration,
                        "usedPercent": min(100.0, max(0.0, 100.0 * used / total)),
                        "remainingPercent": min(100.0, max(0.0, 100.0 * remaining / total)),
                        "resetsAt": period_end,
                        "lastResetAt": period_start,
                        "usedCredits": used,
                        "totalCredits": total,
                        "unit": str(bucket.get("unit_type") or "token"),
                    }
                ],
            }
        )

    limits.sort(key=lambda limit: (-limit.pop("priority", 0), limit["label"].lower()))
    return limits


def _bucket_model_name(bucket: dict[str, Any]) -> str:
    show_name = str(bucket.get("show_name") or "").strip()
    if show_name:
        return show_name
    capabilities = bucket.get("capabilities")
    if isinstance(capabilities, list):
        for capability in capabilities:
            text = str(capability or "").strip()
            if text.lower().startswith("model:"):
                return text[6:].strip()
    return ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=_("Read Z.ai GLM Coding Plan limits through the Z.ai usage monitor API.")
    )
    parser.add_argument("--api-key", help=_("Z.ai API key; defaults to ZAI_API_KEY or the key file"))
    parser.add_argument("--api-base-url", help=_("Z.ai API base URL for the monitor endpoints"))
    parser.add_argument("--timeout", type=float, default=25, help=_("Request timeout in seconds"))
    parser.add_argument("--history-file", type=Path, help=_("Override the local history path"))
    parser.add_argument(
        "--activity-bucket-minutes",
        type=int,
        choices=(60, 120),
        default=DEFAULT_ACTIVITY_BUCKET_MINUTES,
        help=_("24-hour activity bucket size"),
    )
    parser.add_argument("--no-history", action="store_true", help=_("Do not read or write history"))
    return parser.parse_args()


def _cancel_request(_signum: int, _frame: Any) -> None:
    raise InterruptedError(_("Usage request cancelled"))


def main() -> int:
    signal.signal(signal.SIGTERM, _cancel_request)
    args = parse_args()
    try:
        result = fetch_quota_limits(
            resolve_api_key(args.api_key),
            args.api_base_url or os.environ.get("ZAI_API_BASE_URL") or DEFAULT_API_BASE,
            max(1.0, args.timeout),
        )
        snapshot = normalise_quota_limits(result)
        try:
            plan_token = zcode_plan_token()
            if plan_token:
                plan_data = fetch_plan_balances(
                    plan_token,
                    os.environ.get("ZCODE_PLAN_BASE") or ZCODE_PLAN_BASE,
                    max(1.0, args.timeout),
                )
                plan_limits = normalise_plan_balances(plan_data)
                snapshot["limits"].extend(plan_limits)
                save_plan_balance_cache(plan_limits)
        except (OSError, UsageError) as plan_error:
            cached_limits = load_plan_balance_cache()
            if cached_limits:
                snapshot["limits"].extend(cached_limits)
                print(
                    _("ZCode plan quotas unavailable, showing recent values: %(error)s") % {"error": plan_error},
                    file=sys.stderr,
                )
            else:
                print(
                    _("ZCode plan quotas unavailable: %(error)s") % {"error": plan_error},
                    file=sys.stderr,
                )
        if not args.no_history:
            try:
                update_usage_history(
                    snapshot,
                    args.history_file or default_history_path(),
                    args.activity_bucket_minutes,
                )
            except OSError as error:
                snapshot["history"] = {"error": _("Could not store local history: %(error)s") % {"error": error}}
        print(json.dumps(snapshot, separators=(",", ":")))
        return 0
    except AuthenticationRequired as error:
        print(f"{AUTH_REQUIRED_PREFIX} {error}", file=sys.stderr)
        return 2
    except (OSError, UsageError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
