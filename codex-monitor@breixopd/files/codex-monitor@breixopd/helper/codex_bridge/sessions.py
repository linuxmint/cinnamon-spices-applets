"""Normalize Codex thread-list responses for the Cinnamon dashboard."""

from __future__ import annotations

import os
import uuid


_STATUS_LABELS = {
    "active": "Active",
    "idle": "Idle",
    "notLoaded": "Ready to resume",
    "systemError": "System error",
}
_SOURCE_LABELS = {
    "cli": "CLI",
    "vscode": "VS Code",
    "exec": "Codex exec",
    "appServer": "Codex app",
    "unknown": "Unknown",
}
_ATTENTION_FLAGS = {"waitingOnApproval", "waitingOnUserInput"}


def _bounded_text(value, *, maximum=160):
    if not isinstance(value, str):
        return None
    normalized = " ".join(value.split()).strip()
    if not normalized:
        return None
    return normalized[:maximum]


def _canonical_uuid(value):
    if not isinstance(value, str):
        return None
    try:
        normalized = str(uuid.UUID(value))
    except (ValueError, AttributeError):
        return None
    return normalized if normalized == value.lower() else None


def _timestamp(value):
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _source_label(value):
    if isinstance(value, str):
        return _SOURCE_LABELS.get(value, "Unknown")
    if isinstance(value, dict) and isinstance(value.get("custom"), str):
        return "Custom"
    if isinstance(value, dict) and "subAgent" in value:
        return "Sub-agent"
    return "Unknown"


def _normalize_row(raw):
    if not isinstance(raw, dict):
        return None
    thread_id = _canonical_uuid(raw.get("id"))
    if thread_id is None:
        return None

    status_value = raw.get("status")
    raw_status = status_value if isinstance(status_value, dict) else {}
    status = raw_status.get("type")
    if status not in _STATUS_LABELS:
        status = "unavailable"
    raw_flags = raw_status.get("activeFlags")
    if not isinstance(raw_flags, list):
        raw_flags = []
    attention = [
        flag for flag in raw_flags if isinstance(flag, str) and flag in _ATTENTION_FLAGS
    ]
    preview = raw.get("preview")
    preview_line = preview.splitlines()[0] if isinstance(preview, str) and preview else None
    title = _bounded_text(raw.get("name")) or _bounded_text(preview_line)
    cwd = raw.get("cwd")
    if not isinstance(cwd, str) or not os.path.isabs(cwd) or len(cwd) > 4096:
        cwd = None

    return {
        "id": thread_id,
        "title": title or "Untitled session",
        "cwd": cwd,
        "project": os.path.basename(cwd.rstrip(os.sep)) if cwd else "Unknown project",
        "sourceLabel": _source_label(raw.get("source")),
        "status": status,
        "statusLabel": _STATUS_LABELS.get(status, "Unavailable"),
        "attention": attention,
        "createdAt": _timestamp(raw.get("createdAt")),
        "updatedAt": _timestamp(raw.get("updatedAt")),
    }


def normalize_session_list(response, *, limit=12):
    """Return bounded active and recent rows, discarding all unknown fields."""

    data = response.get("data") if isinstance(response, dict) else None
    if not isinstance(data, list):
        return {"active": [], "recent": []}
    bounded_limit = max(1, min(50, int(limit)))
    rows = []
    for raw in data:
        row = _normalize_row(raw)
        if row is not None:
            rows.append(row)
        if len(rows) >= bounded_limit:
            break
    rows.sort(key=lambda row: row["updatedAt"] or 0, reverse=True)
    return {
        "active": [row for row in rows if row["status"] == "active"],
        "recent": [row for row in rows if row["status"] != "active"],
    }
