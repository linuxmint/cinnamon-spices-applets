#!/usr/bin/env python3
# -*- coding: utf-8 -*-
##########################################################
##                       Clockoo                        ##
##        Core logic: config and systemd timers         ##
##                 written in Python 3                  ##
##                          🌞                          ##
##       by FranzBias 2026 · github.com/FranzBias       ##
##            Licensed under the MIT License            ##
##          See LICENSE file for full license.          ##
##########################################################
# SPDX-License-Identifier: MIT
"""
clockoo_core.py — pure logic of Clockoo 🕰️

Why this file exists: Clockoo must keep ringing even when its window is
closed or Cinnamon restarts. So the GUI never schedules anything itself:
it edits a JSON config and calls apply(), which turns the config into
systemd *user* timers. systemd then starts clockoo_ring.py at the right
moment. No GTK here, so this module can be tested and reused.

The same file also drives the Cinnamon applet (clockoo@FranzBias): with
CLOCKOO_PROFILE=applet it uses its own config folder and its own unit
prefix (clockoo-applet-*), so the app and the applet never touch each
other's timers. The applet talks to it through the small command line
at the bottom (apply / status / countdown / cancel).

by Franz & Aldus
"""

import fcntl
import json
import os
import re
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

APP_NAME = "Clockoo"
APP_ID = "clockoo"
VERSION = "0.7.0"

# "app" = the GTK app, "applet" = the Cinnamon applet. Every timer unit
# carries the profile in its environment, so clockoo_ring.py reads the
# right config.
PROFILE = "applet" if os.environ.get("CLOCKOO_PROFILE") == "applet" else "app"
PROFILE_ENV = "CLOCKOO_PROFILE=" + PROFILE
_SUFFIX = "-applet" if PROFILE == "applet" else ""

HOME = Path.home()
CONFIG_DIR = HOME / ".config" / (APP_NAME + _SUFFIX)
CONFIG_FILE = CONFIG_DIR / "config.json"
COUNTDOWNS_FILE = CONFIG_DIR / "countdowns.json"
STOPWATCH_FILE = CONFIG_DIR / "stopwatch.json"
POMODORO_LOG = CONFIG_DIR / "pomodoro-log.json"
POMODORO_LOG_DAYS = 400              # older entries are dropped
CACHE_DIR = HOME / ".cache" / (APP_NAME + _SUFFIX)
UNIT_DIR = HOME / ".config" / "systemd" / "user"
APP_DIR = Path(__file__).resolve().parent
RING_SCRIPT = APP_DIR / "clockoo_ring.py"
BUNDLED_SOUNDS = APP_DIR / "sounds"     # the CC0 set shipped with Clockoo

UNIT_PREFIX = "clockoo%s-" % _SUFFIX               # clockoo- / clockoo-applet-
OTHER_PREFIX = "clockoo-" if _SUFFIX else "clockoo-applet-"
CUCKOO_UNIT = UNIT_PREFIX + "cuckoo"
ALARM_UNIT_RE = re.compile(
    r"^%salarm-([0-9a-f]{8})(-warn)?\.(timer|service)$" % re.escape(UNIT_PREFIX))
COUNTDOWN_UNIT = UNIT_PREFIX + "countdown-%s"
COUNTDOWN_UNIT_RE = re.compile(
    r"^%scountdown-([0-9a-f]{8})\.(timer|service)$" % re.escape(UNIT_PREFIX))
SNOOZE_UNIT = UNIT_PREFIX + "snooze-%s-%d"
COUNTDOWN_PRESETS = (1, 3, 5, 10, 15, 30)   # minutes

# systemd weekday names, Monday = 0
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

DEFAULT_CONFIG = {
    "version": 1,
    "ui_lang": "auto",
    "sounds_dir": "",                  # "" = the bundled sounds/ folder
    "piper_dir": "~/.local/share/Clockoo/piper",   # see get-voices.sh
    "snooze_minutes": 5,
    "cuckoo": {
        "enabled": True,
        "hours": list(range(7, 22)),   # 07..21: quiet at night
        "minute": 0,
        "sound": "cuckoo-clock.ogg",
        "count_hours": False,          # call N times, like a real cuckoo clock
        "quiet": False,                # quiet night: no cuckoo between...
        "quiet_from": 22,              # ...this hour (included)
        "quiet_to": 7,                 # ...and this one (excluded)
    },
    "timer": {                         # last choices, reused by the tray
        "sound": "kitchen-timer.ogg",
        "voice": "",
        "repeat": 3,
        "saved": [],                   # saved timers, in the user's order
    },
    "pomodoro": {                      # minutes; rounds = work sessions,
        "work": 25,                    # 0 = go on until cancelled
        "short": 5,
        "long": 15,
        "every": 4,                    # a long break after this many works
        "rounds": 4,
    },
    "icon_style": "auto",              # auto | light (wood) | dark (brass)
    "alarms": [],
}

DEFAULT_ALARM = {
    "id": "",
    "name": "",
    "enabled": True,
    "time": "07:00",
    "days": [0, 1, 2, 3, 4],   # empty list = ring once, on "date"
    "date": None,
    "sound": "alarm-clock-bell.ogg",
    "text": "",
    "voice": "",
    "repeat": 3,
    "crescendo": False,        # volume grows from soft to full
    "warn": False,             # a heads-up notification before ringing...
    "warn_minutes": 10,        # ...this many minutes before
    "snooze_minutes": 0,       # 0 = the general snooze setting
}


# ---------------------------------------------------------------- config

def _merge(default, data):
    """Fill missing keys of data from default (one level deep for dicts)."""
    out = dict(default)
    for key, value in (data or {}).items():
        if isinstance(out.get(key), dict) and isinstance(value, dict):
            inner = dict(out[key])
            inner.update(value)
            out[key] = inner
        else:
            out[key] = value
    return out


def load_config():
    """Read the config, creating it with defaults on first run."""
    if not CONFIG_FILE.exists():
        cfg = json.loads(json.dumps(DEFAULT_CONFIG))
        save_config(cfg)
        return cfg
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        # Keep the broken file for inspection, start again from defaults.
        broken = CONFIG_FILE.with_suffix(
            ".broken-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
        CONFIG_FILE.rename(broken)
        return load_config()
    cfg = _merge(DEFAULT_CONFIG, data)
    cfg["alarms"] = [_merge(DEFAULT_ALARM, a) for a in cfg.get("alarms", [])]
    return cfg


def save_config(cfg):
    """Write atomically, so a crash never leaves half a JSON file."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = CONFIG_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    os.replace(tmp, CONFIG_FILE)


def expand(path_str):
    return Path(os.path.expanduser(path_str))


# ---------------------------------------------------------------- alarms

def new_alarm(**fields):
    alarm = json.loads(json.dumps(DEFAULT_ALARM))
    alarm.update(fields)
    alarm["id"] = uuid.uuid4().hex[:8]
    return alarm


def find_alarm(cfg, alarm_id):
    for alarm in cfg["alarms"]:
        if alarm["id"] == alarm_id:
            return alarm
    return None


def parse_time(text):
    """'7:5' or '07:05' -> (7, 5). Raises ValueError on nonsense."""
    match = re.fullmatch(r"\s*(\d{1,2})[:.](\d{2})\s*", text or "")
    if not match:
        raise ValueError(text)
    hour, minute = int(match.group(1)), int(match.group(2))
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(text)
    return hour, minute


def next_once_date(time_str, now=None):
    """Date (YYYY-MM-DD) of the next occurrence of time_str."""
    now = now or datetime.now()
    hour, minute = parse_time(time_str)
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return target.strftime("%Y-%m-%d")


def next_ring(alarm, now=None):
    """datetime of the next ring of an enabled alarm, or None."""
    if not alarm.get("enabled"):
        return None
    now = now or datetime.now()
    try:
        hour, minute = parse_time(alarm["time"])
    except ValueError:
        return None
    if not alarm.get("days"):
        if not alarm.get("date"):
            return None
        target = datetime.strptime(alarm["date"], "%Y-%m-%d").replace(
            hour=hour, minute=minute)
        return target if target > now else None
    for offset in range(8):
        day = now + timedelta(days=offset)
        if day.weekday() in alarm["days"]:
            target = day.replace(hour=hour, minute=minute, second=0,
                                 microsecond=0)
            if target > now:
                return target
    return None


def next_alarm(cfg, now=None):
    """(alarm, datetime) of the soonest alarm, or (None, None)."""
    best = (None, None)
    for alarm in cfg["alarms"]:
        when = next_ring(alarm, now)
        if when and (best[1] is None or when < best[1]):
            best = (alarm, when)
    return best


# ---------------------------------------------------------------- calendar

def quiet_hours(cuckoo):
    """Hours silenced by the quiet night (empty set when it is off).
    22 -> 7 means 22, 23, 0, ..., 6: the hour 'to' itself calls again."""
    if not cuckoo.get("quiet"):
        return set()
    start = int(cuckoo.get("quiet_from", 22)) % 24
    end = int(cuckoo.get("quiet_to", 7)) % 24
    hours, hour = set(), start
    while hour != end:
        hours.add(hour)
        hour = (hour + 1) % 24
    return hours


def cuckoo_calendar(cuckoo):
    hours = sorted({int(h) for h in cuckoo.get("hours", []) if 0 <= int(h) <= 23}
                   - quiet_hours(cuckoo))
    if not hours:
        return None
    minute = int(cuckoo.get("minute", 0)) % 60
    return "*-*-* %s:%02d:00" % (",".join("%02d" % h for h in hours), minute)


def alarm_calendar(alarm):
    hour, minute = parse_time(alarm["time"])
    clock = "%02d:%02d:00" % (hour, minute)
    days = sorted({int(d) for d in alarm.get("days", []) if 0 <= int(d) <= 6})
    if days:
        return "%s *-*-* %s" % (",".join(WEEKDAYS[d] for d in days), clock)
    if alarm.get("date"):
        return "%s %s" % (alarm["date"], clock)
    return None


def warn_calendar(alarm):
    """Calendar of the heads-up, warn_minutes before the alarm. Going back
    past midnight moves every weekday (or the date) one day back."""
    if not alarm.get("warn"):
        return None
    minutes = max(1, min(int(alarm.get("warn_minutes", 10)), 720))
    hour, minute = parse_time(alarm["time"])
    total = hour * 60 + minute - minutes
    shift = -1 if total < 0 else 0
    total %= 1440
    clock = "%02d:%02d:00" % divmod(total, 60)
    days = sorted({(int(d) + shift) % 7 for d in alarm.get("days", [])
                   if 0 <= int(d) <= 6})
    if days:
        return "%s *-*-* %s" % (",".join(WEEKDAYS[d] for d in days), clock)
    if alarm.get("date"):
        day = datetime.strptime(alarm["date"], "%Y-%m-%d") + timedelta(days=shift)
        return "%s %s" % (day.strftime("%Y-%m-%d"), clock)
    return None


# ---------------------------------------------------------------- systemd

def _systemctl(*args):
    return subprocess.run(["systemctl", "--user", *args],
                          capture_output=True, text=True)


UNIT_LABEL = "Clockoo applet" if PROFILE == "applet" else "Clockoo"


def _unit_text(description, exec_args, calendar, persistent=False):
    # The app's units stay exactly as in 0.1.0 (no Environment line), so an
    # update does not rewrite and restart every timer.
    env = "Environment=%s\n" % PROFILE_ENV if PROFILE == "applet" else ""
    service = (
        "[Unit]\n"
        "Description=%s (%s)\n\n"
        "[Service]\n"
        "Type=oneshot\n"
        "%s"
        "ExecStart=/usr/bin/python3 %s %s\n" % (
            description, UNIT_LABEL, env, RING_SCRIPT, " ".join(exec_args))
    )
    timer = (
        "[Unit]\n"
        "Description=%s (%s)\n\n"
        "[Timer]\n"
        "OnCalendar=%s\n"
        "AccuracySec=1s\n"
        "%s\n"
        "[Install]\n"
        "WantedBy=timers.target\n" % (
            description, UNIT_LABEL, calendar,
            # Persistent: an alarm missed while the computer was off rings
            # at the next login. (One missed during suspend rings anyway,
            # as soon as the computer wakes up.)
            "Persistent=true\n" if persistent else "")
    )
    return service, timer


def _is_own_unit(name):
    """True for the cuckoo/alarm units of *this* profile only: the app's
    prefix 'clockoo-' also matches 'clockoo-applet-*', which is not ours."""
    return name == CUCKOO_UNIT or bool(ALARM_UNIT_RE.match(name + ".timer"))


def run_transient(unit, on_active_seconds, description, ring_args):
    """systemd-run a one-shot ring (countdown, snooze) in this profile.

    The end is a wall-clock time (--on-calendar), not --on-active: the
    monotonic clock stops during suspend, so a 10-minute timer with half an
    hour of suspend in between would ring 10 minutes *after* waking up.
    A calendar time that passed during suspend rings right at wake-up."""
    end = datetime.now() + timedelta(seconds=max(1, int(on_active_seconds)))
    return subprocess.run([
        "systemd-run", "--user", "--unit", unit,
        "--description", "%s (%s)" % (description, UNIT_LABEL),
        "--setenv", PROFILE_ENV,
        "--on-calendar=%s" % end.strftime("%Y-%m-%d %H:%M:%S"),
        "--timer-property=AccuracySec=1s",
        "/usr/bin/python3", str(RING_SCRIPT), *ring_args],
        capture_output=True, text=True)


def other_profile_cuckoo():
    """True when the *other* Clockoo (app vs applet) has its cuckoo on:
    both together would call twice every hour."""
    return (UNIT_DIR / (OTHER_PREFIX + "cuckoo.timer")).exists()


def _write_if_changed(path, text):
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def _wanted_units(cfg):
    """name -> (description, exec_args, calendar, persistent) for every
    active timer. A missed cuckoo or heads-up is not worth ringing late."""
    wanted = {}
    cuckoo = cfg["cuckoo"]
    cal = cuckoo_calendar(cuckoo)
    if cuckoo.get("enabled") and cal:
        wanted[CUCKOO_UNIT] = ("Cuckoo", ["cuckoo"], cal, False)
    for alarm in cfg["alarms"]:
        if not alarm.get("enabled"):
            continue
        try:
            cal = alarm_calendar(alarm)
        except ValueError:
            continue
        if cal and (alarm.get("days") or next_ring(alarm)):
            name = "%salarm-%s" % (UNIT_PREFIX, alarm["id"])
            label = (alarm.get("name") or "Alarm").replace("\n", " ")
            wanted[name] = (label, ["alarm", alarm["id"]], cal, True)
            try:
                warn_cal = warn_calendar(alarm)
            except ValueError:
                warn_cal = None
            if warn_cal:
                wanted[name + "-warn"] = (label + ", heads-up",
                                          ["warn", alarm["id"]], warn_cal, False)
    return wanted


def apply(cfg):
    """Save cfg and make systemd match it. Returns a list of error strings."""
    save_config(cfg)
    UNIT_DIR.mkdir(parents=True, exist_ok=True)
    wanted = _wanted_units(cfg)
    errors = []

    # Remove timers that are no longer wanted (only our own files).
    for path in sorted(UNIT_DIR.glob(UNIT_PREFIX + "*.timer")):
        name = path.stem
        if name not in wanted and _is_own_unit(name):
            _systemctl("disable", "--now", path.name)
            path.unlink(missing_ok=True)
            (UNIT_DIR / (name + ".service")).unlink(missing_ok=True)

    changed = []
    for name, (desc, args, cal, persistent) in wanted.items():
        service, timer = _unit_text(desc, args, cal, persistent)
        a = _write_if_changed(UNIT_DIR / (name + ".service"), service)
        b = _write_if_changed(UNIT_DIR / (name + ".timer"), timer)
        if a or b:
            changed.append(name)

    res = _systemctl("daemon-reload")
    if res.returncode:
        errors.append(res.stderr.strip())
    for name in wanted:
        if name in changed:
            res = _systemctl("enable", name + ".timer")
            if res.returncode:
                errors.append(res.stderr.strip())
            res = _systemctl("restart", name + ".timer")
        else:
            res = _systemctl("start", name + ".timer")
        if res.returncode:
            errors.append(res.stderr.strip())
    return [e for e in errors if e]


# ---------------------------------------------------------------- countdowns
#
# A countdown is a *transient* systemd unit (systemd-run --on-active), so it
# rings even with the window closed and survives a Cinnamon restart, but not
# a reboot. countdowns.json only remembers what the GUI needs to show
# (name, end time) and what clockoo_ring.py needs to ring (sound, text...).

def _countdowns_rw(change=None):
    """Read countdowns.json under a lock; if change is given, it receives
    the list, edits it in place, and the result is written back."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_DIR / ".countdowns.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            items = json.loads(COUNTDOWNS_FILE.read_text(encoding="utf-8"))
            if not isinstance(items, list):
                items = []
        except (OSError, ValueError):
            items = []
        if change is not None:
            change(items)
            tmp = COUNTDOWNS_FILE.with_suffix(".tmp")
            tmp.write_text(json.dumps(items, indent=2, ensure_ascii=False)
                           + "\n", encoding="utf-8")
            os.replace(tmp, COUNTDOWNS_FILE)
        return items


def list_countdowns():
    """Running countdowns, soonest first."""
    return sorted(_countdowns_rw(), key=lambda c: c.get("end", ""))


def find_countdown(countdown_id):
    for item in _countdowns_rw():
        if item.get("id") == countdown_id:
            return item
    return None


def countdown_remaining(item, now=None):
    """Seconds left (never negative). A paused countdown keeps its own."""
    if item.get("paused"):
        return max(0, int(item.get("left", 0)))
    now = now or datetime.now()
    try:
        end = datetime.fromisoformat(item["end"])
    except (KeyError, ValueError):
        return 0
    return max(0, int(round((end - now).total_seconds())))


def format_duration(seconds):
    """3725 -> '1:02:05', 300 -> '05:00'."""
    hours, rest = divmod(max(0, int(seconds)), 3600)
    minutes, secs = divmod(rest, 60)
    if hours:
        return "%d:%02d:%02d" % (hours, minutes, secs)
    return "%02d:%02d" % (minutes, secs)


# ---------------------------------------------------------------- stopwatch
#
# The stopwatch keeps wall-clock times (epoch seconds), not a monotonic
# clock, so it survives a restart of the app (or of Cinnamon) and keeps
# counting while the computer sleeps, like a real stopwatch on a desk.

def load_stopwatch():
    state = {"running": False, "base": 0.0, "since": 0.0, "laps": []}
    try:
        data = json.loads(STOPWATCH_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            state.update(data)
    except (OSError, ValueError):
        pass
    return state


def save_stopwatch(state):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STOPWATCH_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state) + "\n", encoding="utf-8")
    os.replace(tmp, STOPWATCH_FILE)


def snooze_for(cfg, alarm):
    """Snooze minutes of one alarm: its own, else the general setting."""
    return int(alarm.get("snooze_minutes") or cfg.get("snooze_minutes", 5))


# ---------------------------------------------------------------- pomodoro
#
# A pomodoro is a chain of countdowns: work, short break, work, ...,
# long break. Each countdown carries the state of the chain, and when it
# rings clockoo_ring.py starts the next one right away. Cancelling the
# running countdown ends the chain.

def pomodoro_name(state):
    from clockoo_i18n import _
    if state["phase"] == "work":
        total = int(state.get("rounds", 0))
        count = ("%d/%d" % (state["n"], total)) if total else str(state["n"])
        return "🍅 %s %s" % (_("Work"), count)
    return "☕ " + (_("Long break") if state["phase"] == "long" else _("Break"))


def next_pomodoro(state):
    """State of the phase after `state`, or None when the chain is over."""
    nxt = dict(state)
    if state["phase"] == "work":
        every = max(1, int(state.get("every", 4)))
        nxt["phase"] = "long" if state["n"] % every == 0 else "short"
    else:
        rounds = int(state.get("rounds", 0))
        if rounds and state["n"] >= rounds:
            return None
        nxt["phase"] = "work"
        nxt["n"] = state["n"] + 1
    return nxt


def log_pomodoro(minutes, when=None):
    """Remember one completed work session (called when it rings)."""
    when = when or datetime.now()
    try:
        log = json.loads(POMODORO_LOG.read_text(encoding="utf-8"))
        if not isinstance(log, list):
            log = []
    except (OSError, ValueError):
        log = []
    oldest = (when - timedelta(days=POMODORO_LOG_DAYS)).strftime("%Y-%m-%d")
    log = [e for e in log if e.get("date", "") >= oldest]
    log.append({"date": when.strftime("%Y-%m-%d"),
                "time": when.strftime("%H:%M"), "minutes": int(minutes)})
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    tmp = POMODORO_LOG.with_suffix(".tmp")
    tmp.write_text(json.dumps(log, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp, POMODORO_LOG)


def pomodoro_stats(now=None):
    """Completed work sessions: today, this week (from Monday), the last
    7 days one by one (oldest first) and in all, with their minutes."""
    now = now or datetime.now()
    try:
        log = json.loads(POMODORO_LOG.read_text(encoding="utf-8"))
        if not isinstance(log, list):
            log = []
    except (OSError, ValueError):
        log = []
    today = now.date()
    monday = today - timedelta(days=today.weekday())
    stats = {"today": 0, "today_minutes": 0, "week": 0, "week_minutes": 0,
             "total": 0, "total_minutes": 0, "days": []}
    per_day = {}
    for entry in log:
        try:
            day = datetime.strptime(entry["date"], "%Y-%m-%d").date()
        except (KeyError, ValueError):
            continue
        minutes = int(entry.get("minutes", 0))
        stats["total"] += 1
        stats["total_minutes"] += minutes
        if day == today:
            stats["today"] += 1
            stats["today_minutes"] += minutes
        if monday <= day <= today:
            stats["week"] += 1
            stats["week_minutes"] += minutes
        per_day[day] = per_day.get(day, 0) + 1
    for back in range(6, -1, -1):
        day = today - timedelta(days=back)
        stats["days"].append([day.isoformat(), day.weekday(),
                              per_day.get(day, 0)])
    return stats


def start_pomodoro_phase(cfg, state):
    minutes = max(1, int(state.get(state["phase"], 1)))
    tcfg = cfg.get("timer", {})
    return start_countdown(minutes * 60, pomodoro_name(state),
                           tcfg.get("sound", ""), "", tcfg.get("voice", ""),
                           tcfg.get("repeat", 3), pomodoro=state)


def start_pomodoro(cfg):
    """Start a new chain with the pomodoro settings of cfg."""
    state = dict(cfg.get("pomodoro") or DEFAULT_CONFIG["pomodoro"])
    state.update(phase="work", n=1)
    return start_pomodoro_phase(cfg, state)


def start_countdown(seconds, name="", sound="", text="", voice="", repeat=3,
                    pomodoro=None):
    """Start a countdown. Returns (item, error string or None)."""
    seconds = int(seconds)
    if seconds < 1:
        return None, "duration must be at least one second"
    item = {
        "id": uuid.uuid4().hex[:8],
        "name": (name or "").replace("\n", " ").strip(),
        "seconds": seconds,
        "end": (datetime.now() + timedelta(seconds=seconds))
        .isoformat(timespec="seconds"),
        "sound": sound or "",
        "text": text or "",
        "voice": voice or "",
        "repeat": max(1, int(repeat)),
    }
    if pomodoro:
        item["pomodoro"] = pomodoro
    unit = COUNTDOWN_UNIT % item["id"]
    # Saved before systemd-run, so even a 1-second countdown finds its entry.
    _countdowns_rw(lambda items: items.append(item))
    res = run_transient(unit, seconds, "%s, timer" % (item["name"] or "Timer"),
                        ["countdown", item["id"]])
    if res.returncode:
        _countdowns_rw(lambda items: _drop(items, item["id"]))
        return None, res.stderr.strip() or "systemd-run failed"
    return item, None


def pause_countdown(countdown_id):
    """Stop the timer unit but keep the entry, with the seconds left."""
    item = find_countdown(countdown_id)
    if not item or item.get("paused"):
        return item
    left = countdown_remaining(item)
    unit = COUNTDOWN_UNIT % countdown_id
    _systemctl("stop", unit + ".timer")

    def change(items):
        for entry in items:
            if entry.get("id") == countdown_id:
                entry["paused"] = True
                entry["left"] = left
    _countdowns_rw(change)
    return find_countdown(countdown_id)


def resume_countdown(countdown_id):
    """Start a new timer unit for the seconds that were left.
    Returns an error string or None."""
    item = find_countdown(countdown_id)
    if not item or not item.get("paused"):
        return None
    left = max(1, int(item.get("left", 1)))
    end = (datetime.now() + timedelta(seconds=left)).isoformat(timespec="seconds")

    def change(items):
        for entry in items:
            if entry.get("id") == countdown_id:
                entry.pop("paused", None)
                entry.pop("left", None)
                entry["end"] = end
    _countdowns_rw(change)
    unit = COUNTDOWN_UNIT % countdown_id
    _systemctl("reset-failed", unit + ".timer", unit + ".service")
    res = run_transient(unit, left, "%s, timer" % (item.get("name") or "Timer"),
                        ["countdown", countdown_id])
    if res.returncode:
        return res.stderr.strip() or "systemd-run failed"
    return None


def _drop(items, countdown_id):
    items[:] = [c for c in items if c.get("id") != countdown_id]


def forget_countdown(countdown_id):
    """Remove the entry only (used by clockoo_ring.py once it has rung)."""
    _countdowns_rw(lambda items: _drop(items, countdown_id))


def cancel_countdown(countdown_id):
    """Stop the transient timer (and a ring in progress), drop the entry."""
    unit = COUNTDOWN_UNIT % countdown_id
    _systemctl("stop", unit + ".timer", unit + ".service")
    forget_countdown(countdown_id)


def _active_countdown_ids():
    res = _systemctl("list-units", "--all", "--plain", "--no-legend",
                     "--no-pager", UNIT_PREFIX + "countdown-*")
    ids = set()
    for line in res.stdout.splitlines():
        fields = line.split()
        if len(fields) >= 3 and fields[2] in ("active", "activating", "reloading"):
            match = COUNTDOWN_UNIT_RE.match(fields[0])
            if match:
                ids.add(match.group(1))
    return ids


def prune_countdowns(grace_seconds=5):
    """Drop entries whose unit is gone (after a reboot, a crash, or a stop
    from outside). Brand-new entries get a few seconds of grace, because
    start_countdown() saves them before systemd-run returns."""
    active = _active_countdown_ids()
    now = datetime.now()

    def change(items):
        keep = []
        for item in items:
            age = item.get("seconds", 0) - countdown_remaining(item, now)
            if (item.get("id") in active or age < grace_seconds
                    or item.get("paused")):       # a paused one has no unit
                keep.append(item)
        items[:] = keep

    return _countdowns_rw(change)


# ---------------------------------------------------------------- sounds

SOUND_EXTS = {".ogg", ".oga", ".wav", ".mp3", ".flac", ".opus"}


def sounds_folder(cfg):
    """The folder chosen in the settings, or the bundled one."""
    chosen = (cfg.get("sounds_dir") or "").strip()
    return expand(chosen) if chosen else BUNDLED_SOUNDS


def list_sounds(cfg):
    folder = sounds_folder(cfg)
    if not folder.is_dir():
        return []
    return sorted(p.name for p in folder.iterdir()
                  if p.suffix.lower() in SOUND_EXTS)


def sound_path(cfg, name):
    """Path of a sound: chosen folder first, then the bundled set, so a
    default name like cuckoo-clock.ogg always rings."""
    if not name:
        return None
    for folder in (sounds_folder(cfg), BUNDLED_SOUNDS):
        path = folder / name
        if path.is_file():
            return path
    return None


def player_command(path, volume=None):
    """Command line that plays an audio file, or None.
    volume: None = full, else 0.0 .. 1.0 (used by the crescendo)."""
    if shutil.which("pw-play"):
        cmd = ["pw-play"]
        if volume is not None:
            cmd.append("--volume=%.2f" % volume)
        return cmd + [str(path)]
    if shutil.which("paplay"):
        cmd = ["paplay"]
        if volume is not None:
            cmd.append("--volume=%d" % int(65536 * volume))
        return cmd + [str(path)]
    if shutil.which("ffplay"):
        cmd = ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet"]
        if volume is not None:
            cmd += ["-volume", str(int(100 * volume))]
        return cmd + [str(path)]
    return None


def play(path, wait=False, volume=None):
    """Play a file; returns the Popen (or None)."""
    cmd = player_command(path, volume)
    if not cmd:
        return None
    # pw-play reads --volume with the locale: in Italian or German "0.20"
    # would mean 0 (silence). The C locale makes the dot a decimal point.
    env = dict(os.environ, LC_NUMERIC="C.UTF-8")
    if env.get("LC_ALL"):             # LC_ALL would override LC_NUMERIC
        env["LC_ALL"] = "C.UTF-8"
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, env=env)
    if wait:
        proc.wait()
    return proc


# ---------------------------------------------------------------- voices

def piper_root(cfg):
    """The piper folder (with piper/piper and voices/), or None if unset."""
    chosen = (cfg.get("piper_dir") or "").strip()
    return expand(chosen) if chosen else None


def piper_bin(cfg):
    root = piper_root(cfg)
    if not root:
        return None
    path = root / "piper" / "piper"
    return path if path.is_file() and os.access(path, os.X_OK) else None


def list_voices(cfg):
    """[(voice_id, label, lang_code)] for every piper voice installed."""
    root = piper_root(cfg)
    voices = []
    if not root or not (root / "voices").is_dir():
        return voices
    folder = root / "voices"
    for model in sorted(folder.glob("*.onnx")):
        voice_id = model.stem                     # it_IT-paola-medium
        lang = voice_id.split("-")[0]
        meta = model.with_suffix(".onnx.json")
        try:
            data = json.loads(meta.read_text(encoding="utf-8"))
            lang = data.get("language", {}).get("code", lang)
        except (OSError, ValueError):
            pass
        parts = voice_id.split("-")
        speaker = parts[1].replace("_", " ").title() if len(parts) > 1 else voice_id
        voices.append((voice_id, "%s — %s" % (lang, speaker), lang))
    return voices


def _lang_of(voice):
    """'it_IT-paola-medium' / 'it' / '' -> 'it' (empty: the system language)."""
    code = (voice or "").split("-")[0].split("_")[0].lower()
    if not code:
        code = (os.environ.get("LANGUAGE") or os.environ.get("LANG")
                or "en")[:2].lower()
    return code


def resolve_voice(cfg, voice):
    """The piper voice to use for `voice` (a piper id, a language code like
    'it', or '' for the system language), or None to fall back to spd-say."""
    voices = list_voices(cfg)
    if not voices or not piper_bin(cfg):
        return None
    if any(v[0] == voice for v in voices):
        return voice
    lang = _lang_of(voice)
    for voice_id, _label, code in voices:
        if code.lower().startswith(lang):
            return voice_id
    return None


def speech_file(cfg, text, voice):
    """WAV file with text spoken by piper (cached). None on failure."""
    text = (text or "").strip()
    voice_id = resolve_voice(cfg, voice)
    if not text or not voice_id:
        return None
    binary = piper_bin(cfg)
    model = piper_root(cfg) / "voices" / (voice_id + ".onnx")
    if not model.is_file():
        return None
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = uuid.uuid5(uuid.NAMESPACE_URL, voice_id + "\n" + text).hex[:16]
    out = CACHE_DIR / ("tts-%s.wav" % key)
    if out.is_file() and out.stat().st_size > 0:
        return out
    res = subprocess.run([str(binary), "-m", str(model), "-f", str(out)],
                         input=text, text=True, capture_output=True)
    if res.returncode or not out.is_file():
        return None
    return out


def speak(cfg, text, voice_id, wait=True):
    """Say text aloud: piper first, spd-say as fallback."""
    wav = speech_file(cfg, text, voice_id)
    if wav:
        return play(wav, wait=wait)
    if shutil.which("spd-say") and (text or "").strip():
        args = ["spd-say", "-l", _lang_of(voice_id), text]
        if wait:
            args.insert(1, "-w")
        return subprocess.Popen(args)
    return None


# ---------------------------------------------------------------- command line
#
# Used by the Cinnamon applet (applet.js), which cannot import Python.
# Every command prints one JSON object on stdout.

def status(cfg):
    alarm, when = next_alarm(cfg)
    return {
        "profile": PROFILE,
        "next": {"name": alarm.get("name", ""), "time": alarm.get("time", ""),
                 "when": when.isoformat(timespec="minutes")} if when else None,
        "countdowns": [dict(c, remaining=countdown_remaining(c))
                       for c in prune_countdowns()],
        "other_cuckoo": other_profile_cuckoo(),
        "pomodoro": pomodoro_stats(),
        "piper": bool(piper_bin(cfg)),
        "voices": [v[0] for v in list_voices(cfg)],
    }


def main(argv):
    usage = ("usage: clockoo_core.py apply | status | prune | cancel|pause|resume ID |\n"
             "       pomodoro | countdown SECONDS [NAME [SOUND [TEXT [VOICE [REPEAT]]]]]")
    if not argv:
        print(usage, file=sys.stderr)
        return 2
    command, args = argv[0], argv[1:]
    cfg = load_config()
    from clockoo_i18n import set_lang      # names like "🍅 Lavoro 1/4"
    set_lang(cfg.get("ui_lang"))
    if command == "apply":
        out = {"errors": apply(cfg)}
    elif command == "status":
        out = status(cfg)
    elif command == "prune":
        out = {"countdowns": prune_countdowns()}
    elif command == "pause" and args:
        out = {"paused": bool(pause_countdown(args[0]))}
    elif command == "resume" and args:
        out = {"error": resume_countdown(args[0])}
    elif command == "cancel" and args:
        cancel_countdown(args[0])
        out = {"cancelled": args[0]}
    elif command == "pomodoro":
        item, error = start_pomodoro(cfg)
        out = {"error": error} if error else item
    elif command == "countdown" and args:
        fields = (args + [""] * 5)[:6]
        tcfg = cfg.get("timer", {})
        item, error = start_countdown(
            int(fields[0]), fields[1], fields[2] or tcfg.get("sound", ""),
            fields[3], fields[4] or tcfg.get("voice", ""),
            int(fields[5] or tcfg.get("repeat", 3)))
        out = {"error": error} if error else item
    else:
        print(usage, file=sys.stderr)
        return 2
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
