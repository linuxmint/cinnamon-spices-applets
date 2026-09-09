#!/usr/bin/env python3
"""Read ChatGPT Work and Codex limits through the local Codex app-server."""

from __future__ import annotations

import argparse
import datetime as dt
import gettext
import json
import math
import os
import select
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from typing import Any

_data_home = os.environ.get("XDG_DATA_HOME")
_locale_dir = Path(_data_home) / "locale" if _data_home else Path.home() / ".local" / "share" / "locale"
_ = gettext.translation("chatgpt-usage@oss-singularity", localedir=str(_locale_dir), fallback=True).gettext


CLIENT_INFO = {
    "name": "cinnamon_chatgpt_usage",
    "title": "ChatGPT Usage Monitor for Cinnamon",
    "version": json.loads(Path(__file__).with_name("metadata.json").read_text(encoding="utf-8"))["version"],
}

HISTORY_VERSION = 1
HISTORY_RETENTION_SECONDS = 8 * 24 * 60 * 60
ACTIVITY_WINDOW_SECONDS = 24 * 60 * 60
DEFAULT_ACTIVITY_BUCKET_MINUTES = 60
RESET_TIMESTAMP_JITTER_SECONDS = 60
AUTH_REQUIRED_PREFIX = "AUTH_REQUIRED:"
AUTH_REQUIRED_MESSAGE = _("Sign in to ChatGPT with the ChatGPT App or Codex CLI, then refresh this applet.")


class UsageError(RuntimeError):
    """A user-facing usage retrieval error."""


class AuthenticationRequired(UsageError):
    """The Codex app-server cannot read usage without a ChatGPT login."""


def is_authentication_error(detail: Any) -> bool:
    """Recognise stable Codex authentication failures without exposing raw errors."""

    message = str(detail or "").casefold()
    markers = (
        "authentication required",
        "login required",
        "not logged in",
        "not signed in",
        "failed to refresh token",
        "oauth refresh token was rejected",
        "refresh token was rejected",
        "token refresh not possible",
        "unauthenticated",
        "unauthorized",
    )
    return any(marker in message for marker in markers)


def _number(value: Any, default: float = 0) -> float:
    try:
        number = float(value) if not isinstance(value, bool) else float("nan")
        return number if math.isfinite(number) else default
    except (TypeError, ValueError, OverflowError):
        return default


def _normalise_window(window: Any) -> dict[str, Any] | None:
    if not isinstance(window, dict):
        return None
    duration = int(_number(window.get("windowDurationMins")))
    if duration <= 0:
        return None
    used = _number(window.get("usedPercent"), -1)
    if used < 0 or used > 100:
        return None
    resets_at = int(_number(window.get("resetsAt"))) or None
    return {
        "durationMinutes": duration,
        "usedPercent": used,
        "remainingPercent": 100.0 - used,
        "resetsAt": resets_at,
    }


def _next_reset_expiry(resets: Any) -> int | None:
    """Return the earliest expiry among available reset-credit details."""

    if not isinstance(resets, dict) or not isinstance(resets.get("credits"), list):
        return None

    expiries = []
    for credit in resets["credits"]:
        if not isinstance(credit, dict):
            continue
        status = str(credit.get("status") or "").casefold()
        if status and status != "available":
            continue
        expires_at = _number(credit.get("expiresAt"), -1)
        if math.isfinite(expires_at) and expires_at > 0:
            expiries.append(int(expires_at))
    return min(expiries, default=None)


def _reset_credit_details(resets: Any) -> list[dict[str, Any]] | None:
    """Return selectable available reset details without persisting them."""

    if not isinstance(resets, dict) or not isinstance(resets.get("credits"), list):
        return None

    details = []
    for credit in resets["credits"]:
        if not isinstance(credit, dict) or str(credit.get("status") or "").casefold() != "available":
            continue
        credit_id = str(credit.get("id") or "").strip()
        if not credit_id:
            continue
        expires_at = _number(credit.get("expiresAt"), -1)
        details.append(
            {
                "id": credit_id,
                "expiresAt": int(expires_at) if math.isfinite(expires_at) and expires_at > 0 else None,
            }
        )

    details.sort(
        key=lambda credit: (
            credit["expiresAt"] is None,
            credit["expiresAt"] or 0,
        )
    )
    return details


def normalise_rate_limits(result: dict[str, Any], now: int | None = None) -> dict[str, Any]:
    """Convert user-facing account and named model limits into an applet snapshot."""

    single = result.get("rateLimits")
    buckets_by_id = result.get("rateLimitsByLimitId")
    buckets: dict[str, dict[str, Any]] = {}
    if isinstance(buckets_by_id, dict):
        for bucket_id, bucket in buckets_by_id.items():
            if not isinstance(bucket, dict):
                continue
            limit_id = str(bucket.get("limitId") or bucket_id)
            if limit_id == "codex" or bucket.get("limitName"):
                buckets[limit_id] = bucket
    if isinstance(single, dict):
        limit_id = str(single.get("limitId") or "codex")
        buckets.setdefault(limit_id, single)

    limits = []
    codex_bucket = buckets.get("codex")
    credit_details = codex_bucket.get("credits") if isinstance(codex_bucket, dict) else None
    if not isinstance(credit_details, dict) and isinstance(single, dict):
        credit_details = single.get("credits")
    for bucket_id, bucket in buckets.items():
        if not isinstance(bucket, dict):
            continue
        windows = []
        for field in ("primary", "secondary"):
            normalised = _normalise_window(bucket.get(field))
            if normalised:
                windows.append(normalised)
        if not windows:
            continue

        limit_id = str(bucket.get("limitId") or bucket_id)
        label = bucket.get("limitName") or ("Codex" if limit_id == "codex" else limit_id)
        limits.append(
            {
                "id": limit_id,
                "label": str(label),
                "planType": bucket.get("planType"),
                "rateLimitReachedType": bucket.get("rateLimitReachedType"),
                "windows": windows,
            }
        )

    limits.sort(key=lambda item: (item["id"] != "codex", item["label"].lower()))
    resets = result.get("rateLimitResetCredits")
    available_resets = 0
    if isinstance(resets, dict):
        available_resets = max(0, int(_number(resets.get("availableCount"))))

    credits = {
        "availableResetCount": available_resets,
        "nextResetExpiresAt": _next_reset_expiry(resets),
        "resetCredits": _reset_credit_details(resets),
        "balance": None,
        "hasCredits": False,
        "unlimited": False,
    }
    if isinstance(credit_details, dict):
        balance = credit_details.get("balance")
        credits.update(
            {
                "balance": None if balance is None else str(balance),
                "hasCredits": bool(credit_details.get("hasCredits")),
                "unlimited": bool(credit_details.get("unlimited")),
            }
        )

    return {
        "updatedAt": int(time.time()) if now is None else int(now),
        "limits": limits,
        "credits": credits,
    }


def default_history_path() -> Path:
    """Return the XDG state path for credential-free usage samples."""

    state_root = os.environ.get("XDG_STATE_HOME")
    if not state_root:
        state_root = os.path.expanduser("~/.local/state")
    return Path(state_root) / "cinnamon-chatgpt-usage" / "history.json"


def _history_window_key(limit_id: str, duration: int) -> str:
    return f"{limit_id}:{duration}"


def _sample_from_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    windows: dict[str, dict[str, Any]] = {}
    for limit in snapshot.get("limits", []):
        limit_id = str(limit.get("id") or "codex")
        for window in limit.get("windows", []):
            duration = int(_number(window.get("durationMinutes")))
            used = _number(window.get("usedPercent"), -1)
            if duration <= 0 or used < 0:
                continue
            windows[_history_window_key(limit_id, duration)] = {
                "usedPercent": min(100.0, max(0.0, used)),
                "resetsAt": int(_number(window.get("resetsAt"))) or None,
            }
    return {"timestamp": int(snapshot["updatedAt"]), "windows": windows}


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
                windows[key] = {"usedPercent": used, "resetsAt": int(_number(window.get("resetsAt"))) or None}
        if windows:
            clean.append({"timestamp": timestamp, "windows": windows})
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


def _positive_delta(previous: dict[str, Any], current: dict[str, Any]) -> float:
    previous_reset = previous.get("resetsAt")
    current_reset = current.get("resetsAt")
    current_used = _number(current.get("usedPercent"))
    reset_shift = abs(_number(current_reset) - _number(previous_reset))
    if previous_reset and current_reset and reset_shift > RESET_TIMESTAMP_JITTER_SECONDS:
        return max(0.0, current_used)
    return max(0.0, current_used - _number(previous.get("usedPercent")))


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

    for limit in snapshot.get("limits", []):
        limit_id = str(limit.get("id") or "codex")
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
                    "trackedSince": points[0][0] if points else now,
                    "periods": period_values,
                    "activity24h": activity,
                }
            )

    return {
        "trackedSince": tracked_since,
        "activityBucketMinutes": int(bucket_minutes),
        "activityEndAt": activity_end,
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
    if current["windows"]:
        if samples and int(_number(samples[-1].get("timestamp"))) == now:
            samples[-1] = current
        else:
            samples.append(current)
    samples = sorted(samples, key=lambda sample: int(_number(sample.get("timestamp"))))
    samples = samples[-10000:]
    _write_history(path, samples)
    snapshot["history"] = build_usage_history(snapshot, samples, bucket_minutes)
    return snapshot


def _resolve_chatgpt_launcher(explicit: str | None = None) -> str | None:
    if explicit:
        candidate = os.path.expanduser(explicit)
        if os.path.isabs(candidate) and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
        return None
    return shutil.which("chatgpt")


def _resolve_bundled_chatgpt_codex(chatgpt_app: str | None = None) -> str | None:
    """Find the app-server binary shipped beside the ChatGPT desktop launcher."""

    launcher = _resolve_chatgpt_launcher(chatgpt_app)
    if not launcher:
        return None

    resolved_launcher = Path(launcher).resolve()
    candidates = (
        resolved_launcher.parent / "resources" / "codex",
        resolved_launcher.parent.parent / "resources" / "codex",
    )
    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def resolve_codex(explicit: str | None, chatgpt_app: str | None = None) -> str:
    """Resolve an explicit, installed, or ChatGPT-bundled app-server binary."""

    if explicit:
        candidate = os.path.abspath(os.path.expanduser(explicit))
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
        raise UsageError(_("Codex CLI is not executable: %(path)s") % {"path": candidate})

    candidate = shutil.which("codex")
    if candidate:
        return candidate
    local_candidate = os.path.expanduser("~/.local/bin/codex")
    if os.path.isfile(local_candidate) and os.access(local_candidate, os.X_OK):
        return local_candidate
    bundled_candidate = _resolve_bundled_chatgpt_codex(chatgpt_app)
    if bundled_candidate:
        return bundled_candidate
    if chatgpt_app:
        raise UsageError(
            _("No Codex CLI or bundled backend found; check the ChatGPT app path and its resources/codex file")
        )
    raise UsageError(_("Codex CLI or ChatGPT App backend was not found"))


def _command_version(executable: str | None, timeout: float = 2) -> str | None:
    """Bound both time and output for an optional local version probe."""
    if not executable:
        return None
    process = None
    try:
        process = subprocess.Popen(
            [executable, "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
            bufsize=0,
        )
        deadline = time.monotonic() + timeout
        output = bytearray()
        while time.monotonic() < deadline:
            ready, _, _ = select.select([process.stdout], [], [], max(0, deadline - time.monotonic()))
            if not ready:
                return None
            chunk = os.read(process.stdout.fileno(), 4096)
            output.extend(chunk)
            if len(output) > 16384:
                return None
            if not chunk:
                process.wait(timeout=max(0.001, deadline - time.monotonic()))
                lines = output.decode("utf-8", errors="replace").strip().splitlines()
                return lines[0][:120] if process.returncode == 0 and lines else None
    except (OSError, subprocess.TimeoutExpired):
        return None
    finally:
        if process is not None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
            process.stdout.close()
    return None


def detect_automatic_paths() -> dict[str, str | None]:
    """Read automatic installation paths without running commands or accessing an account."""
    try:
        codex = resolve_codex(None)
    except (UsageError, OSError, RuntimeError):
        codex = None
    return {"codex": codex, "chatgpt": _resolve_chatgpt_launcher()}


def describe_backend(explicit: str | None, chatgpt_app: str | None = None) -> dict[str, Any]:
    """Discover commands without authentication, history access or backend RPCs."""
    error = None
    try:
        codex = resolve_codex(explicit, chatgpt_app)
    except (UsageError, OSError, RuntimeError) as exception:
        codex = None
        error = str(exception)
    chatgpt = _resolve_chatgpt_launcher(chatgpt_app)
    modified = None
    if chatgpt:
        try:
            modified = int(Path(chatgpt).stat().st_mtime)
        except OSError:
            pass
    return {
        "codex": codex,
        "codexVersion": _command_version(codex),
        "chatgpt": chatgpt,
        "chatgptVersion": _command_version(chatgpt),
        "chatgptModifiedAt": modified,
        "error": error,
    }


def _run_app_server_request(
    codex: str,
    timeout: float,
    request: dict[str, Any],
    empty_result_message: str,
    timeout_message: str,
) -> dict[str, Any]:
    """Perform one initialized app-server request and return its result."""

    if not math.isfinite(timeout) or timeout <= 0:
        raise UsageError(_("Request timeout must be finite and positive"))
    deadline = time.monotonic() + timeout
    process = subprocess.Popen(
        [codex, "app-server", "--listen", "stdio://"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        bufsize=0,
        start_new_session=True,
    )
    try:
        if process.stdin is None or process.stdout is None:
            raise UsageError(_("Could not open Codex app-server pipes"))
        os.set_blocking(process.stdin.fileno(), False)
        os.set_blocking(process.stdout.fileno(), False)
        messages = (
            {"method": "initialize", "id": 1, "params": {"clientInfo": CLIENT_INFO}},
            {"method": "initialized", "params": {}},
            request,
        )
        outgoing = memoryview(
            "".join(json.dumps(message, separators=(",", ":")) + "\n" for message in messages).encode("utf-8")
        )
        pending = bytearray()
        while time.monotonic() < deadline:
            readable, writable, _exceptional = select.select(
                [process.stdout],
                [process.stdin] if outgoing else [],
                [],
                max(0.0, deadline - time.monotonic()),
            )
            if writable:
                try:
                    outgoing = outgoing[os.write(process.stdin.fileno(), outgoing) :]
                except BlockingIOError:
                    pass
            if not readable:
                continue
            try:
                chunk = os.read(process.stdout.fileno(), 65536)
            except BlockingIOError:
                continue
            if not chunk:
                raise UsageError(_("Codex app-server closed its output before replying"))
            pending.extend(chunk)
            if len(pending) > 4 * 1024 * 1024:
                raise UsageError(_("Codex app-server response exceeded the size limit"))
            lines = pending.split(b"\n")
            pending = lines.pop()
            for line in lines:
                if time.monotonic() >= deadline:
                    raise UsageError(timeout_message)
                try:
                    message = json.loads(line)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                if not isinstance(message, dict):
                    continue
                if message.get("id") not in (1, request.get("id")):
                    continue
                if "error" in message:
                    error = message["error"]
                    detail = error.get("message") if isinstance(error, dict) else error
                    if is_authentication_error(detail):
                        raise AuthenticationRequired(AUTH_REQUIRED_MESSAGE)
                    raise UsageError(_("Codex app-server rejected the request: %(detail)s") % {"detail": detail})
                if message.get("id") != request.get("id"):
                    continue
                result = message.get("result")
                if not isinstance(result, dict):
                    raise UsageError(empty_result_message)
                return result
        raise UsageError(timeout_message)
    finally:
        # The backend owns a separate group, so helpers it starts cannot outlive
        # this request. Reap even after a failed write, EOF or cancellation.
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=0.2)
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
        for stream in (process.stdin, process.stdout):
            if stream is not None:
                stream.close()


def fetch_rate_limits(codex: str, timeout: float) -> dict[str, Any]:
    """Perform one initialized, read-only app-server request."""

    return _run_app_server_request(
        codex,
        timeout,
        {"method": "account/rateLimits/read", "id": 2},
        _("Codex app-server returned no usage data"),
        _("Timed out while reading ChatGPT usage limits"),
    )


def consume_rate_limit_reset(
    codex: str,
    timeout: float,
    idempotency_key: str,
    credit_id: str | None = None,
) -> dict[str, Any]:
    """Consume one reset credit through an explicitly requested app-server action."""

    key = str(idempotency_key or "").strip()
    if not key:
        raise UsageError(_("Reset consume requires a non-empty idempotency key"))

    params: dict[str, str] = {"idempotencyKey": key}
    selected_credit_id = str(credit_id or "").strip()
    if selected_credit_id:
        params["creditId"] = selected_credit_id

    result = _run_app_server_request(
        codex,
        timeout,
        {
            "method": "account/rateLimitResetCredit/consume",
            "id": 2,
            "params": params,
        },
        _("Codex app-server returned no reset outcome"),
        _("Timed out while consuming a rate-limit reset"),
    )
    if not isinstance(result.get("outcome"), str) or not result["outcome"]:
        raise UsageError(_("Codex app-server returned an invalid reset outcome"))
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=_("Read ChatGPT Work and Codex limits through the local Codex app-server.")
    )
    parser.add_argument(
        "--detect-paths", action="store_true", help=_("Find automatic paths without executing commands")
    )
    parser.add_argument("--codex", help=_("Path to the Codex app-server executable"))
    parser.add_argument("--chatgpt-app", help=_("ChatGPT app executable used for bundled-backend fallback"))
    parser.add_argument(
        "--describe-backend", action="store_true", help=_("Discover local commands without account access")
    )
    parser.add_argument("--timeout", type=float, default=25, help=_("Request timeout in seconds"))
    parser.add_argument(
        "--consume-reset",
        action="store_true",
        help=_("Explicitly consume one earned rate-limit reset credit"),
    )
    parser.add_argument(
        "--idempotency-key",
        help=_("Stable key for one explicit reset-redemption attempt"),
    )
    parser.add_argument("--credit-id", help=_("Optional opaque reset-credit ID"))
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
        if args.detect_paths:
            print(json.dumps(detect_automatic_paths()))
            return 0
        if args.describe_backend:
            print(json.dumps(describe_backend(args.codex, args.chatgpt_app)))
            return 0
        codex = resolve_codex(args.codex, args.chatgpt_app)
        if args.consume_reset:
            result = consume_rate_limit_reset(
                codex,
                max(1.0, args.timeout),
                args.idempotency_key or "",
                args.credit_id,
            )
            print(json.dumps(result, separators=(",", ":")))
            return 0

        result = fetch_rate_limits(codex, max(1.0, args.timeout))
        snapshot = normalise_rate_limits(result)
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
