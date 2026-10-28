#!/usr/bin/env python3
# -*- coding: utf-8 -*-
##########################################################
##                       Clockoo                        ##
##           Rings the cuckoo and the alarms            ##
##                 written in Python 3                  ##
##                          🌞                          ##
##       by FranzBias 2026 · github.com/FranzBias       ##
##            Licensed under the MIT License            ##
##          See LICENSE file for full license.          ##
##########################################################
# SPDX-License-Identifier: MIT
"""
clockoo_ring.py — the part of Clockoo 🕰️ that actually rings

Why this file exists: systemd user timers (written by clockoo_core.apply)
start this script at the right minute, whether or not the Clockoo window
is open. It plays the cuckoo, or an alarm / a countdown with its sound
and its spoken text, and shows a notification with Stop / Snooze.

Usage:
    clockoo_ring.py cuckoo
    clockoo_ring.py alarm <id> [--snooze]
    clockoo_ring.py warn <id>          heads-up before an alarm
    clockoo_ring.py countdown <id>

by Franz & Aldus
"""

import os
import sys
import threading
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import clockoo_core as core          # noqa: E402
from clockoo_i18n import _, set_lang  # noqa: E402

# A service started by systemd may lack the session bus address.
os.environ.setdefault("DBUS_SESSION_BUS_ADDRESS",
                      "unix:path=/run/user/%d/bus" % os.getuid())

GRACE_SECONDS = 45   # how long the notification waits for a click after ringing
CRESCENDO_STEPS = 5  # a crescendo rings at least this many times...
CRESCENDO_START = 0.2  # ...starting at this volume (1.0 = full)
WARN_VOLUME = 0.35   # the heads-up plays the alarm sound once, softly


def ring_cuckoo(cfg):
    cuckoo = cfg["cuckoo"]
    if not cuckoo.get("enabled"):
        return
    path = core.sound_path(cfg, cuckoo.get("sound")) or \
        core.sound_path(cfg, "cuckoo-clock.ogg")
    if not path:
        return
    calls = 1
    if cuckoo.get("count_hours"):
        calls = datetime.now().hour % 12 or 12
    for _i in range(calls):
        core.play(path, wait=True)


class AlarmRinger:
    """Plays sound + speech `repeat` times; can be stopped from outside.
    `alarm` is an alarm or a countdown: both have sound/text/voice/repeat."""

    def __init__(self, cfg, alarm):
        self.cfg = cfg
        self.alarm = alarm
        self.stop_event = threading.Event()
        self.proc = None
        self.lock = threading.Lock()

    def _run(self, proc):
        with self.lock:
            self.proc = proc
        if proc:
            proc.wait()
        with self.lock:
            self.proc = None

    def ring(self):
        # A sound that has been moved or deleted must not mean silence.
        sound = core.sound_path(self.cfg, self.alarm.get("sound")) or \
            core.sound_path(self.cfg, core.DEFAULT_ALARM["sound"])
        text = self.alarm.get("text", "")
        voice = self.alarm.get("voice", "")
        # Synthesize before the first ring, so speech follows without a gap.
        core.speech_file(self.cfg, text, voice)
        times = max(1, int(self.alarm.get("repeat", 1)))
        crescendo = bool(self.alarm.get("crescendo"))
        if crescendo:
            times = max(times, CRESCENDO_STEPS)   # room for the volume to grow
        for i in range(times):
            if self.stop_event.is_set():
                break
            if sound:
                # Crescendo: from soft to full volume, step by step.
                volume = (CRESCENDO_START + (1 - CRESCENDO_START) * i / (times - 1)
                          if crescendo else None)
                self._run(core.play(sound, volume=volume))
            if self.stop_event.is_set():
                break
            if text.strip():
                self._run(core.speak(self.cfg, text, voice, wait=False))

    def stop(self):
        self.stop_event.set()
        with self.lock:
            if self.proc and self.proc.poll() is None:
                self.proc.terminate()


def schedule_snooze(cfg, alarm_id):
    alarm = core.find_alarm(cfg, alarm_id) or {}
    minutes = core.snooze_for(cfg, alarm)
    unit = core.SNOOZE_UNIT % (alarm_id, int(time.time()))
    core.run_transient(unit, minutes * 60, "Snooze",
                       ["alarm", alarm_id, "--snooze"])
    return datetime.now() + timedelta(minutes=minutes)


def ring_alarm(cfg, alarm_id, snoozed):
    alarm = core.find_alarm(cfg, alarm_id)
    if not alarm or (not alarm.get("enabled") and not snoozed):
        return
    # A one-time alarm switches itself off before ringing.
    if not alarm.get("days") and not snoozed:
        alarm["enabled"] = False
        core.apply(cfg)

    body = alarm["time"]
    if alarm.get("text"):
        body += " — " + alarm["text"]
    ring_with_notification(
        cfg, alarm, "⏰ " + (alarm.get("name") or _("Alarm")), body,
        lambda: schedule_snooze(cfg, alarm_id),
        snooze_minutes=core.snooze_for(cfg, alarm))


def ring_warn(cfg, alarm_id):
    """Heads-up some minutes before an alarm: a soft sound and a quiet
    notification, no Stop/Snooze (the alarm itself will ring later)."""
    alarm = core.find_alarm(cfg, alarm_id)
    if not alarm or not alarm.get("enabled") or not alarm.get("warn"):
        return
    minutes = int(alarm.get("warn_minutes", 10))
    title = "🔔 " + (_("In %d min") % minutes) + ": " + \
        (alarm.get("name") or _("Alarm"))
    body = _("Alarm at %s") % alarm["time"]
    try:
        import gi
        gi.require_version("Notify", "0.7")
        from gi.repository import GLib, Notify
        if Notify.init(core.APP_NAME):
            note = Notify.Notification.new(title, body, "alarm-symbolic")
            note.set_hint("desktop-entry", GLib.Variant("s", core.APP_ID))
            note.show()
    except (ImportError, ValueError):
        pass
    sound = core.sound_path(cfg, alarm.get("sound")) or \
        core.sound_path(cfg, core.DEFAULT_ALARM["sound"])
    if sound:
        core.play(sound, wait=True, volume=WARN_VOLUME)


def ring_countdown(cfg, countdown_id):
    item = core.find_countdown(countdown_id)
    if not item:
        return
    core.forget_countdown(countdown_id)
    if item.get("pomodoro"):
        ring_pomodoro(cfg, item)
        return
    body = _("Timer finished") + " — " + core.format_duration(item["seconds"])
    if item.get("text"):
        body += " — " + item["text"]
    minutes = int(cfg.get("snooze_minutes", 5))

    def snooze():
        core.start_countdown(minutes * 60, item.get("name"), item.get("sound"),
                             item.get("text"), item.get("voice"),
                             item.get("repeat", 3))
        return datetime.now() + timedelta(minutes=minutes)

    ring_with_notification(
        cfg, item, "⏳ " + (item.get("name") or _("Timer")), body, snooze)


def ring_pomodoro(cfg, item):
    """End of a pomodoro phase: start the next one at once (so the chain
    keeps its rhythm), then ring. The second button stops the chain."""
    state = item["pomodoro"]
    if state.get("phase") == "work":
        core.log_pomodoro(round(item.get("seconds", 0) / 60))
    nxt = core.next_pomodoro(state)
    started = None
    if nxt:
        started, _error = core.start_pomodoro_phase(cfg, nxt)
    if started:
        body = _("Now: %s, %s") % (
            started["name"], core.format_duration(started["seconds"]))
    else:
        body = _("Pomodoro finished")

    def stop_chain():
        if started:
            core.cancel_countdown(started["id"])
        return None

    ring_with_notification(
        cfg, item, item.get("name") or "🍅", body, stop_chain,
        snooze_label=_("Stop pomodoro") if started else False)


def ring_with_notification(cfg, alarm, title, body, snooze,
                           snooze_minutes=None, snooze_label=None):
    """Ring `alarm` and show a notification with Stop / Snooze.
    snooze() schedules the next ring and returns its datetime (or None).
    snooze_label replaces the "Snooze N min" button text."""
    ringer = AlarmRinger(cfg, alarm)
    worker = threading.Thread(target=ringer.ring, daemon=True)

    notify = None
    try:
        import gi
        gi.require_version("Notify", "0.7")
        from gi.repository import GLib, Notify
        if Notify.init(core.APP_NAME):
            notify = (GLib, Notify)
    except (ImportError, ValueError):
        notify = None

    if not notify:
        worker.start()
        worker.join()
        return

    GLib, Notify = notify
    loop = GLib.MainLoop()
    note = Notify.Notification.new(title, body, "alarm-symbolic")
    note.set_urgency(Notify.Urgency.CRITICAL)
    note.set_hint("desktop-entry", GLib.Variant("s", core.APP_ID))

    def on_stop(*_args):
        ringer.stop()
        loop.quit()

    def on_snooze(*_args):
        ringer.stop()
        when = snooze()
        if when:
            info = Notify.Notification.new(
                title, _("Snoozed until %s") % when.strftime("%H:%M"),
                "alarm-symbolic")
            info.show()
        loop.quit()

    caps = Notify.get_server_caps() or []
    if "actions" in caps:
        note.add_action("stop", _("Stop"), on_stop)
        minutes = snooze_minutes or int(cfg.get("snooze_minutes", 5))
        label = snooze_label or (_("Snooze %d min") % minutes)
        if snooze_label is not False:
            note.add_action("snooze", label, on_snooze)
    note.connect("closed", lambda *_a: on_stop())
    note.show()

    def watch():
        worker.join()
        time.sleep(GRACE_SECONDS)
        GLib.idle_add(loop.quit)

    worker.start()
    threading.Thread(target=watch, daemon=True).start()
    loop.run()
    ringer.stop()
    try:
        note.close()
    except GLib.Error:
        pass


def main(argv):
    if not argv or argv[0] not in ("cuckoo", "alarm", "warn", "countdown"):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    cfg = core.load_config()
    set_lang(cfg.get("ui_lang"))
    if argv[0] == "cuckoo":
        ring_cuckoo(cfg)
    elif len(argv) < 2:
        return 2
    elif argv[0] == "alarm":
        ring_alarm(cfg, argv[1], "--snooze" in argv[2:])
    elif argv[0] == "warn":
        ring_warn(cfg, argv[1])
    else:
        ring_countdown(cfg, argv[1])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
