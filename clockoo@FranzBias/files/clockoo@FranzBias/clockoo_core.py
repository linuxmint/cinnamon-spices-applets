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
clockoo_core.py — pure logic of Clockoo 🐦⏰

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
VERSION = "0.2.0"

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
CACHE_DIR = HOME / ".cache" / (APP_NAME + _SUFFIX)
UNIT_DIR = HOME / ".config" / "systemd" / "user"
APP_DIR = Path(__file__).resolve().parent
RING_SCRIPT = APP_DIR / "clockoo_ring.py"
BUNDLED_SOUNDS = APP_DIR / "sounds"     # the CC0 set shipped with Clockoo

UNIT_PREFIX = "clockoo%s-" % _SUFFIX               # clockoo- / clockoo-applet-
OTHER_PREFIX = "clockoo-" if _SUFFIX else "clockoo-applet-"
CUCKOO_UNIT = UNIT_PREFIX + "cuckoo"
ALARM_UNIT_RE = re.compile(
    r"^%salarm-([0-9a-f]{8})\.(timer|service)$" % re.escape(UNIT_PREFIX))
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
    },
    "timer": {                         # last choices, reused by the tray
        "sound": "kitchen-timer.ogg",
        "voice": "",
        "repeat": 3,
    },
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

def cuckoo_calendar(cuckoo):
    hours = sorted({int(h) for h in cuckoo.get("hours", []) if 0 <= int(h) <= 23})
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


# ---------------------------------------------------------------- systemd

def _systemctl(*args):
    return subprocess.run(["systemctl", "--user", *args],
                          capture_output=True, text=True)


UNIT_LABEL = "Clockoo applet" if PROFILE == "applet" else "Clockoo"


def _unit_text(description, exec_args, calendar):
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
        "AccuracySec=1s\n\n"
        "[Install]\n"
        "WantedBy=timers.target\n" % (description, UNIT_LABEL, calendar)
    )
    return service, timer


def _is_own_unit(name):
    """True for the cuckoo/alarm units of *this* profile only: the app's
    prefix 'clockoo-' also matches 'clockoo-applet-*', which is not ours."""
    return name == CUCKOO_UNIT or bool(ALARM_UNIT_RE.match(name + ".timer"))


def run_transient(unit, on_active_seconds, description, ring_args):
    """systemd-run a one-shot ring (countdown, snooze) in this profile."""
    return subprocess.run([
        "systemd-run", "--user", "--unit", unit,
        "--description", "%s (%s)" % (description, UNIT_LABEL),
        "--setenv", PROFILE_ENV,
        "--on-active=%ds" % on_active_seconds,
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
    """name -> (description, exec_args, calendar) for every active timer."""
    wanted = {}
    cuckoo = cfg["cuckoo"]
    cal = cuckoo_calendar(cuckoo)
    if cuckoo.get("enabled") and cal:
        wanted[CUCKOO_UNIT] = ("Cuckoo", ["cuckoo"], cal)
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
            wanted[name] = (label, ["alarm", alarm["id"]], cal)
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
    for name, (desc, args, cal) in wanted.items():
        service, timer = _unit_text(desc, args, cal)
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
    """Seconds left (never negative)."""
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


def start_countdown(seconds, name="", sound="", text="", voice="", repeat=3):
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
    unit = COUNTDOWN_UNIT % item["id"]
    # Saved before systemd-run, so even a 1-second countdown finds its entry.
    _countdowns_rw(lambda items: items.append(item))
    res = run_transient(unit, seconds, "%s, timer" % (item["name"] or "Timer"),
                        ["countdown", item["id"]])
    if res.returncode:
        _countdowns_rw(lambda items: _drop(items, item["id"]))
        return None, res.stderr.strip() or "systemd-run failed"
    return item, None


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
            if item.get("id") in active or age < grace_seconds:
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


def player_command(path):
    """Command line that plays an audio file, or None."""
    for player in ("pw-play", "paplay"):
        if shutil.which(player):
            return [player, str(path)]
    if shutil.which("ffplay"):
        return ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet",
                str(path)]
    return None


def play(path, wait=False):
    """Play a file; returns the Popen (or None)."""
    cmd = player_command(path)
    if not cmd:
        return None
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL)
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
        "piper": bool(piper_bin(cfg)),
        "voices": [v[0] for v in list_voices(cfg)],
    }


def main(argv):
    usage = ("usage: clockoo_core.py apply | status | prune | cancel ID |\n"
             "       countdown SECONDS [NAME [SOUND [TEXT [VOICE [REPEAT]]]]]")
    if not argv:
        print(usage, file=sys.stderr)
        return 2
    command, args = argv[0], argv[1:]
    cfg = load_config()
    if command == "apply":
        out = {"errors": apply(cfg)}
    elif command == "status":
        out = status(cfg)
    elif command == "prune":
        out = {"countdowns": prune_countdowns()}
    elif command == "cancel" and args:
        cancel_countdown(args[0])
        out = {"cancelled": args[0]}
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
