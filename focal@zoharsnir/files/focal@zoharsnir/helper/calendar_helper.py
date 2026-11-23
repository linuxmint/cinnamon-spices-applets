#!/usr/bin/env python3
"""
Focal calendar helper

Queries the system calendar (Evolution Data Server) and prints JSON describing
the event currently in progress, and/or the next upcoming one.

This is a v0.1 starting point, not a finished implementation. It assumes
EDS + gobject-introspection bindings are installed (python3-gi,
gir1.2-edataserver-1.2, gir1.2-ecal-2.0 on Debian/Ubuntu-based systems,
which Cinnamon/Linux Mint ship by default since the built-in calendar
applet depends on the same stack).

Usage:
    calendar_helper.py --list-calendars
        -> [{"uid": "...", "name": "...", "is_default": true | false}]

    calendar_helper.py --current-or-next [--calendar uid]
        -> {"current": {...} | null, "next": {...} | null}
        Uses the system's default calendar (via EDS's registered default,
        not a name/UID guess) unless --calendar overrides it. Only ever
        queries a single calendar - no multi-calendar support, by design.

Event object shape:
    {
        "summary": "Team sync",
        "start_iso": "2026-08-06T11:00:00",
        "end_iso": "2026-08-06T11:30:00",
        "color": "#3584e4" | null   (whatever format EDS's ESourceSelectable
                                     returns - passed straight through to the
                                     applet's CSS "color:" style, untested
                                     against a real colored calendar yet)
    }

TODO (left for the follow-up build in Claude Code):
    - Caching / error resilience if EDS is slow to answer.
    - Recurrence expansion edge cases (this draft relies on libecal's
      generate-instances, which should handle most of it, but hasn't
      been tested against real recurring events yet).
"""

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone

try:
    import gi
    gi.require_version("EDataServer", "1.2")
    gi.require_version("ECal", "2.0")
    gi.require_version("ICalGLib", "3.0")
    from gi.repository import EDataServer, ECal, ICalGLib, GLib
except Exception as e:  # pragma: no cover - environment-dependent
    print(json.dumps({"error": "eds-bindings-unavailable", "detail": str(e)}), file=sys.stdout)
    sys.exit(0)


def list_calendars():
    registry = EDataServer.SourceRegistry.new_sync(None)
    sources = registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR)
    default_source = registry.ref_default_calendar()
    default_uid = default_source.get_uid() if default_source else None
    result = []
    for source in sources:
        result.append({
            "uid": source.get_uid(),
            "name": source.get_display_name(),
            "is_default": source.get_uid() == default_uid,
        })
    return result


def _open_client(source):
    # ECal.Client.new()/open_sync() is the old, deprecated two-step API and
    # isn't even present in this binding version - connect_sync() replaces
    # both steps with one call.
    return ECal.Client.connect_sync(source, ECal.ClientSourceType.EVENTS, 5, None)


def _events_in_window(client, start_dt, end_dt):
    # start_dt/end_dt are naive local wall-clock datetimes (so window_end's
    # "same calendar day" logic in current_or_next() means the user's local
    # day, not UTC's). EDS's "Z"-suffixed query syntax means real UTC though -
    # convert properly instead of relabeling local time as UTC (that bug
    # shifted the whole query window by the local UTC offset, which could
    # put "now" entirely outside the window depending on timezone).
    start_str = start_dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    end_str = end_dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    query = f"(occur-in-time-range? (make-time \"{start_str}\") (make-time \"{end_str}\"))"
    _, components = client.get_object_list_as_comps_sync(query, None)
    return components


def _ical_time_to_local_datetime(t, tzid):
    dt = datetime(t.get_year(), t.get_month(), t.get_day(), t.get_hour(), t.get_minute())
    if t.is_date():
        return dt
    try:
        if t.is_utc():
            # Events from synced calendars (e.g. Google Calendar via GNOME
            # Online Accounts) are commonly stored in UTC - if we don't
            # convert, we'd treat the UTC hour/minute as if it were already
            # local.
            dt = dt.replace(tzinfo=timezone.utc).astimezone().replace(tzinfo=None)
        elif tzid:
            # Named timezone (e.g. "America/New_York") - the tzid lives on
            # the property, not on t itself (t.get_tzid() is always None).
            # Resolved against libical's builtin tzdata rather than the
            # calendar client's get_timezone_sync(), which only knows about
            # zones already registered on that connection (empty on a
            # fresh one) and silently falls back to UTC instead of failing.
            tz = ICalGLib.Timezone.get_builtin_timezone(tzid)
            if tz:
                offset_seconds, _is_daylight = tz.get_utc_offset(t)
                utc_dt = dt.replace(tzinfo=timezone.utc) - timedelta(seconds=offset_seconds)
                dt = utc_dt.astimezone().replace(tzinfo=None)
        # else: floating time (no TZID, not UTC) - raw digits are already
        # correct, no conversion needed.
    except AttributeError:
        pass  # relevant methods unavailable on this binding - leave as-is
    return dt


def _get_calendar_color(source):
    # ESourceCalendar implements the ESourceSelectable interface, which is
    # where the color lives (the same color EDS-aware apps like GNOME
    # Calendar show next to a calendar's name). Defensive: color is a nice-
    # to-have, not essential, so any failure here should silently fall back
    # to the configured default-event-color rather than breaking the poll.
    try:
        ext = source.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR)
        color = ext.get_color()
        return color if color else None
    except Exception:
        return None


def _comp_to_event(comp, color=None):
    summary = comp.get_summary().get_value() if comp.get_summary() else ""
    dtstart = comp.get_dtstart()
    dtend = comp.get_dtend()

    start_iso = None
    end_iso = None
    # .get_value(), not .value - this binding doesn't expose it as a plain
    # attribute (same method-call convention already used above for summary).
    start_value = dtstart.get_value() if dtstart else None
    end_value = dtend.get_value() if dtend else None
    if start_value:
        start_iso = _ical_time_to_local_datetime(start_value, dtstart.get_tzid()).isoformat()
    if end_value:
        end_iso = _ical_time_to_local_datetime(end_value, dtend.get_tzid()).isoformat()

    return {
        "summary": summary,
        "start_iso": start_iso,
        "end_iso": end_iso,
        "color": color,
    }


def current_or_next(calendar_uid):
    registry = EDataServer.SourceRegistry.new_sync(None)

    if calendar_uid:
        source = registry.ref_source(calendar_uid)
    else:
        # The user's actual configured default calendar (a real EDS concept,
        # not a naming guess like assuming uid "system-calendar") - what you
        # get unless a specific calendar is explicitly selected.
        source = registry.ref_default_calendar()

    if source is None:
        return {"current": None, "next": None}

    try:
        client = _open_client(source)
    except GLib.Error:
        return {"current": None, "next": None}

    calendar_color = _get_calendar_color(source)

    now = datetime.now()
    window_end = now.replace(hour=23, minute=59, second=59)

    current = None
    upcoming = None

    comps = _events_in_window(client, now, window_end)
    for comp in comps:
        ev = _comp_to_event(comp, calendar_color)
        if not ev["start_iso"] or not ev["end_iso"]:
            continue
        start_dt = datetime.fromisoformat(ev["start_iso"])
        end_dt = datetime.fromisoformat(ev["end_iso"])

        if start_dt <= now < end_dt:
            if current is None or start_dt < datetime.fromisoformat(current["start_iso"]):
                current = ev
        elif start_dt > now:
            if upcoming is None or start_dt < datetime.fromisoformat(upcoming["start_iso"]):
                upcoming = ev

    return {"current": current, "next": upcoming}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--list-calendars", action="store_true")
    parser.add_argument("--current-or-next", action="store_true")
    parser.add_argument("--calendar", type=str, default="")
    args = parser.parse_args()

    if args.list_calendars:
        print(json.dumps(list_calendars()))
        return

    if args.current_or_next:
        print(json.dumps(current_or_next(args.calendar or None)))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
