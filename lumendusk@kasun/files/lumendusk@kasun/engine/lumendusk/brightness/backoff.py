"""Stop paying for a monitor that isn't answering.

A dead DDC/CI monitor is not free to talk to: ddcutil retries, then waits out
its timeout, and every brightness change pays that before touching the displays
that do work. On the machine this was written for, one wedged HP over
DisplayPort turned a two-second brightness change into a six-second one — and it
stayed wedged for hours, so every transition, every slider move and every menu
open paid it again.

So a monitor that fails sits out the next few minutes. The record lives on disk
next to the monitor cache, for the same reason that one does: the applet shells
out to the CLI, so each slider move is a fresh process, and anything held in
memory would be forgotten between them.

Two things end the sit-out early, both meaning "the situation has changed":
the connector fingerprint moves (a display was plugged in, or a power-cycled
monitor dropped and re-established its link), or the user names the monitor
explicitly — ``brightness set 60 ddc2`` is someone asking about *that* monitor,
which is exactly what you do after power-cycling it, and making them wait out a
timer they can't see would be its own bug.

Deliberately not a failure *count*: the point is to stop repeating an expensive
question for a while, not to judge a monitor unreliable. When the period is up
it gets asked again, at the cost of one slow call.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from .. import log
from . import monitors
from .backends import cache_dir

# Long enough that a wedged monitor stops costing anything measurable, short
# enough that walking over and power-cycling it is noticed without having to
# run anything by hand. Matches the monitor cache's own backstop age.
_PERIOD = 300.0


def _path() -> Path:
    return cache_dir() / "unreachable.json"


def _read() -> dict[str, float]:
    """Monitor id → when it may be tried again. Empty on anything unexpected."""
    try:
        data = json.loads(_path().read_text(encoding="utf-8"))
        if data.get("fingerprint") != monitors.connector_fingerprint():
            return {}       # displays moved; whatever we knew is about someone else
        now = time.time()
        return {mid: float(until) for mid, until in data["until"].items()
                if float(until) > now}
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        # Missing, truncated, or written by an older version. Never let this
        # file be the thing that stops a brightness change.
        return {}


def _write(records: dict[str, float]) -> None:
    payload = {"fingerprint": monitors.connector_fingerprint(), "until": records}
    try:
        path = _path()
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload), encoding="utf-8")
        tmp.replace(path)
    except OSError:
        pass    # a read-only cache dir costs speed, never correctness


def sulking(monitor_id: str) -> bool:
    """Is this monitor sitting out, i.e. should a bulk operation skip it?"""
    return monitor_id in _read()


def note_unreachable(monitor_id: str, error: object) -> None:
    """Record that a monitor just failed, and say so once."""
    records = _read()
    records[monitor_id] = time.time() + _PERIOD
    _write(records)
    log.warning("%s: %s — not asking again for %d minutes.",
                monitor_id, error, int(_PERIOD // 60))


def note_reachable(monitor_id: str) -> None:
    """Record that a monitor answered. Only says anything if it had stopped."""
    records = _read()
    if records.pop(monitor_id, None) is None:
        return
    _write(records)
    log.info("%s is answering again.", monitor_id)
