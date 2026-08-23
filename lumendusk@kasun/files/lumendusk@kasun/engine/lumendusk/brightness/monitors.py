"""Enumerate monitors and pick the right brightness backend for each.

Detection order:
  1. Internal panels from ``/sys/class/backlight/*``.
  2. External monitors from ``ddcutil detect``.
  3. If neither is found, fall back to ``xrandr`` connected outputs (software).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import time
from pathlib import Path

from .backends import (
    Backlight,
    BacklightError,
    DdcutilBacklight,
    SysfsBacklight,
    XrandrBacklight,
    cache_dir,
    ddc_lock,
)

_SYS_BACKLIGHT = Path("/sys/class/backlight")


def _internal_monitors() -> list[Backlight]:
    mons: list[Backlight] = []
    if _SYS_BACKLIGHT.is_dir():
        for entry in sorted(_SYS_BACKLIGHT.iterdir()):
            if (entry / "max_brightness").exists():
                try:
                    mons.append(SysfsBacklight(entry.name, entry))
                except (OSError, ValueError):
                    continue
    return mons


def _external_monitors() -> list[Backlight]:
    if not shutil.which("ddcutil"):
        return []
    try:
        # Under the same lock as getvcp/setvcp: detect walks every I²C bus, so
        # it is the call most likely to collide with a read on another process.
        # Longer timeout than a per-monitor call for the same reason — probing
        # every bus is legitimately slower than reading one display.
        with ddc_lock():
            out = subprocess.run(
                ["ddcutil", "detect", "--brief"],
                check=True, capture_output=True, text=True, timeout=15,
            ).stdout
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return []
    mons: list[Backlight] = []
    display: int | None = None
    model = ""
    for line in out.splitlines():
        stripped = line.strip()
        if stripped.startswith("Display "):
            try:
                number = int(stripped.split()[1])
            except (IndexError, ValueError):
                continue  # e.g. "Display not found" — not a display block
            if display is not None:
                mons.append(DdcutilBacklight(display, model))
            display = number
            model = ""
        elif stripped.startswith("Monitor:") and display is not None:
            # "Monitor: <mfg>:<model>:<serial>"
            parts = stripped.split(":")
            model = parts[2].strip() if len(parts) > 2 else ""
    if display is not None:
        mons.append(DdcutilBacklight(display, model))
    return mons


def _xrandr_monitors() -> list[Backlight]:
    if not shutil.which("xrandr"):
        return []
    try:
        out = subprocess.run(
            ["xrandr", "--query"], check=True, capture_output=True, text=True,
            timeout=10,
        ).stdout
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return []
    mons: list[Backlight] = []
    for line in out.splitlines():
        if " connected" in line:
            mons.append(XrandrBacklight(line.split()[0]))
    return mons


# ---- discovery cache --------------------------------------------------------
# `ddcutil detect` costs ~0.5 s because it probes every I²C bus, and discovery
# runs on every brightness operation. That would be a cheap in-memory cache if
# the daemon were the only caller — but it isn't. The applet shells out to the
# CLI, so each slider move and each menu open is a *fresh process* that pays
# the cost again. Only an on-disk cache is shared across those.
#
# The interesting part is invalidation. A plain TTL is a guess in both
# directions: too short and it never hits, too long and a monitor you just
# plugged in stays invisible. The kernel already publishes the answer —
# /sys/class/drm/*/status flips to "connected" on hotplug — and reading it is
# free (measured at 0.00 s against ddcutil's 0.56 s). So the fingerprint is the
# real guard, and the age limit is only a backstop for machines that expose no
# DRM connectors at all, where the fingerprint is constant and useless.
_CACHE_MAX_AGE = 300.0
_DRM = Path("/sys/class/drm")


def connector_fingerprint() -> str:
    """A cheap signature of which displays are physically attached."""
    try:
        parts = []
        for status in sorted(_DRM.glob("card*-*/status")):
            parts.append(f"{status.parent.name}:{status.read_text().strip()}")
        return "|".join(parts)
    except OSError:
        return ""


def _cache_path() -> Path:
    return cache_dir() / "monitors.json"


def _to_spec(mon: Backlight) -> dict | None:
    """Describe a monitor well enough to rebuild it without re-detecting."""
    if isinstance(mon, DdcutilBacklight):
        return {"kind": "ddc", "display": int(mon.id[3:]),
                "model": mon.label.split(" (")[0]}
    if isinstance(mon, SysfsBacklight):
        return {"kind": "sysfs", "name": mon.id, "path": str(mon._path)}
    if isinstance(mon, XrandrBacklight):
        return {"kind": "xrandr", "output": mon.id}
    return None


def _from_spec(spec: dict) -> Backlight:
    kind = spec.get("kind")
    if kind == "ddc":
        return DdcutilBacklight(int(spec["display"]), spec.get("model", ""))
    if kind == "sysfs":
        # Re-reads max_brightness, which is a file read, not a probe.
        return SysfsBacklight(spec["name"], Path(spec["path"]))
    if kind == "xrandr":
        return XrandrBacklight(spec["output"])
    raise ValueError(f"unknown monitor kind {kind!r}")


def _read_cache() -> list[Backlight] | None:
    try:
        data = json.loads(_cache_path().read_text(encoding="utf-8"))
        if data.get("fingerprint") != connector_fingerprint():
            return None
        if time.time() - float(data["created"]) > _CACHE_MAX_AGE:
            return None
        mons = [_from_spec(s) for s in data["monitors"]]
    except (OSError, ValueError, KeyError, TypeError):
        # A missing, truncated, or stale-format cache is not an error — it just
        # means we detect. Never let the cache be the thing that breaks.
        return None
    return mons or None


def _write_cache(monitors: list[Backlight]) -> None:
    specs = [s for s in (_to_spec(m) for m in monitors) if s]
    if not specs:
        return
    payload = {
        "created": time.time(),
        "fingerprint": connector_fingerprint(),
        "monitors": specs,
    }
    try:
        path = _cache_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        # Write-then-rename so a killed process can't leave a half-written file
        # that every later run has to fail on.
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload), encoding="utf-8")
        tmp.replace(path)
    except OSError:
        pass  # a read-only cache dir costs speed, never correctness


def list_monitors(refresh: bool = False) -> list[Backlight]:
    """Return all controllable monitors, real backlights preferred.

    Results are cached on disk, keyed on which displays are attached — see the
    note above. Pass ``refresh=True`` to force a real probe; ``brightness
    list`` does, because someone running the diagnostic command right after
    plugging a monitor in wants the truth, not a fast answer.
    """
    if not refresh:
        cached = _read_cache()
        if cached is not None:
            return cached

    mons = _internal_monitors() + _external_monitors()
    if not mons:
        mons = _xrandr_monitors()
    _write_cache(mons)
    return mons


def select(monitors: list[Backlight], selector: str) -> list[Backlight]:
    """Filter monitors by id, or return all for the "all" selector.

    Raises :class:`BacklightError` for an unknown id — never ``SystemExit``,
    which would take the daemon down from library code.
    """
    if selector == "all":
        return monitors
    chosen = [m for m in monitors if m.id == selector]
    if not chosen:
        known = ", ".join(m.id for m in monitors) or "(none detected)"
        raise BacklightError(f"no monitor '{selector}'. Known: {known}")
    return chosen
