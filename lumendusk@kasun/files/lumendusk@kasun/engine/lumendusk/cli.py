"""Command-line interface.

    lumendusk                 run the daemon (loop)
    lumendusk --once          evaluate + apply current phase, then exit
    lumendusk brightness list      show monitors + backend + current level
    lumendusk brightness get       print current brightness
    lumendusk brightness set 60    set brightness to 60 %
    lumendusk brightness day       apply the day preset from config
    lumendusk brightness night     apply the night preset from config
    lumendusk auto                 let Lumendusk drive (follow the schedule)
    lumendusk manual               leave it to the user; freeze, night light off
    lumendusk nightlight on|off    warm the screen now (manual control)
    lumendusk appearance dark|light  switch the whole desktop now
    lumendusk appearance auto      apply the appearance configured for now
    lumendusk mode day             switch to full day mode now (manual override)
    lumendusk mode night           switch to full night mode now (manual override)
    lumendusk location             show the current + detected location
    lumendusk location --detect    set it from the system timezone, use sun mode
    lumendusk location 51.5 -0.13  set it explicitly and switch to sun mode
    lumendusk config show          print every setting as key=value
    lumendusk config set KEY VAL   change one setting

Most brightness commands accept ``--monitor <id>`` (default: all).

``config show``/``config set`` are the applet's settings panel talking to the
engine: the panel collects values and writes them through to config.toml here,
so the TOML file stays the one place settings actually live.
"""

from __future__ import annotations

import argparse
import dataclasses
import sys

from . import __version__, geo, log
from . import brightness as brightness_mod
from . import config as config_mod
from .daemon import run_daemon


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lumendusk",
        description="Automatic dark/light theme, night light, and brightness.",
    )
    parser.add_argument("--version", action="version",
                        version=f"%(prog)s {__version__}")
    parser.add_argument("--once", action="store_true",
                        help="Evaluate and apply once, then exit (no loop).")
    parser.add_argument("--interval", type=int, default=60,
                        help="Seconds between checks in daemon mode (default: 60).")

    sub = parser.add_subparsers(dest="command")
    b = sub.add_parser("brightness", help="Read/set monitor brightness.")
    b.add_argument("action", choices=["get", "set", "list", "day", "night"])
    b.add_argument("value", nargs="?", type=int,
                   help="Percent 0–100 (only for 'set').")
    b.add_argument("--monitor", default="all",
                   help="Monitor id (see 'brightness list'), or 'all'.")

    sub.add_parser("auto", help="Follow the schedule and snap to the current phase.")
    sub.add_parser("manual",
                   help="Leave the desktop to you (freezes it, night light off).")
    sub.add_parser("toggle", help="Switch between automatic and manual.")
    # Kept as aliases: 'pause'/'resume' are what earlier versions and the docs
    # called this, and they read naturally for the movie-night case.
    sub.add_parser("pause", help="Alias for 'manual'.")
    sub.add_parser("resume", help="Alias for 'auto'.")
    sub.add_parser("status", help="Print control, mode, and current phase.")

    m = sub.add_parser("mode", help="Manually switch to full day/night mode now.")
    m.add_argument("which", choices=["day", "night"])

    a = sub.add_parser("appearance",
                       help="Dark/light desktop switch (system UI + apps).")
    a.add_argument("which", choices=["dark", "light", "auto", "toggle", "status"])

    n = sub.add_parser("nightlight",
                       help="Warm the screen on/off right now (manual control).")
    n.add_argument("which", choices=["on", "off", "toggle", "status"])

    loc = sub.add_parser(
        "location",
        help="Show, detect, or set your latitude/longitude (and use sun mode).")
    loc.add_argument("latitude", nargs="?", type=float,
                     help="Decimal latitude, e.g. 51.5074")
    loc.add_argument("longitude", nargs="?", type=float,
                     help="Decimal longitude, e.g. -0.1278")
    loc.add_argument("--detect", action="store_true",
                     help="Take an approximate location from the system timezone.")

    cfgp = sub.add_parser("config", help="Show or change settings.")
    cfg_sub = cfgp.add_subparsers(dest="config_action")
    cfg_sub.add_parser("show", help="Print every setting as key=value.")
    cfg_sub.add_parser("path", help="Print the path to config.toml.")
    cfg_set = cfg_sub.add_parser("set", help="Change one setting.")
    cfg_set.add_argument("key", help="Setting name (see 'config show').")
    cfg_set.add_argument("value", help="New value.")
    cfg_set.add_argument(
        "--apply", action="store_true",
        help="Also show the change now, if it affects the current phase.")
    return parser


def _set_control(control: str) -> int:
    """Switch between automatic and manual, and act on it straight away.

    The daemon would reconcile this within a tick on its own, but the applet
    calls this on a click — waiting up to a minute for the screen to react
    would read as a broken button.
    """
    cfg = config_mod.load()
    cfg.control = control
    config_mod.save(cfg)
    if control == "manual":
        # The user's own dark/light choice now stands. Night light goes off so
        # colors are true; theme and brightness stay exactly where they are.
        if cfg.nightlight_enabled:
            from .apply import set_nightlight
            set_nightlight(False)
        log.info("manual; night light off, theme/brightness left alone.")
        print("manual — your dark/light choice will be left alone.")
    else:
        # Back to automatic: snap straight to the correct current phase.
        from .daemon import apply_phase, current_phase
        apply_phase(current_phase(cfg), cfg)
        log.info("automatic; applied the current phase.")
        print("automatic — following the schedule again.")
    return 0


def _set_location(latitude: float, longitude: float) -> int:
    """Store a location and switch to sun mode (the point of having one)."""
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        print("latitude must be -90..90 and longitude -180..180.", file=sys.stderr)
        return 2
    cfg = config_mod.load()
    cfg.latitude, cfg.longitude = latitude, longitude
    cfg.mode = "sun"
    config_mod.save(cfg)
    print(f"location set to {latitude}, {longitude}; mode is now 'sun'.")
    if not cfg.location_is_set():
        print("note: 0, 0 is treated as 'not set' — sun mode will use the "
              "fixed times until a real location is given.", file=sys.stderr)
    return 0


def _detect_location() -> int:
    """Set the location from the system timezone."""
    found = geo.detect_location()
    if found is None:
        print("could not work out a location from the system timezone. Set one "
              "by hand: lumendusk location <latitude> <longitude>", file=sys.stderr)
        return 1
    print(f"detected {found.timezone}.")
    return _set_location(found.latitude, found.longitude)


def _show_location() -> int:
    """Report the configured location, and what we'd detect for comparison."""
    cfg = config_mod.load()
    if cfg.location_is_set():
        print(f"location: {cfg.latitude}, {cfg.longitude}  (mode={cfg.mode})")
    else:
        print(f"location: not set  (mode={cfg.mode})")

    found = geo.detect_location()
    if found is None:
        print("detected: nothing — the system timezone gave us no coordinates.")
    else:
        print(f"detected: {found.latitude}, {found.longitude}  "
              f"(from {found.timezone})")
        print("Apply it with: lumendusk location --detect")
    return 0


def _location_command(args: argparse.Namespace) -> int:
    if args.detect:
        return _detect_location()
    if args.latitude is None and args.longitude is None:
        return _show_location()
    if args.latitude is None or args.longitude is None:
        print("give both a latitude and a longitude, or use --detect.",
              file=sys.stderr)
        return 2
    return _set_location(args.latitude, args.longitude)


# Settings that need more than a type check before we write them.
def _validate(key: str, value: object) -> str | None:
    """Return an error message for a bad value, or None if it's fine."""
    if key == "control" and value not in ("auto", "manual"):
        return "control must be 'auto' or 'manual'."
    if key == "mode" and value not in ("sun", "fixed"):
        return "mode must be 'sun' or 'fixed'."
    if key in ("theme_day", "theme_night") and value not in ("light", "dark"):
        return f"{key} must be 'light' or 'dark'."
    if key in ("dark_start", "light_start"):
        # The schedule falls back on a bad time rather than failing, so check
        # the shape here — silently storing "7pm" is worse than refusing it.
        parts = str(value).strip().split(":")
        if len(parts) != 2 or not all(p.isdigit() for p in parts):
            return f"{key} must look like \"18:00\"."
        if not (0 <= int(parts[0]) <= 23 and 0 <= int(parts[1]) <= 59):
            return f"{key} must be a real 24-hour time, e.g. \"18:00\"."
    if key == "latitude" and not -90 <= float(value) <= 90:
        return "latitude must be between -90 and 90."
    if key == "longitude" and not -180 <= float(value) <= 180:
        return "longitude must be between -180 and 180."
    if key in ("brightness_day", "brightness_night") and not 0 <= int(value) <= 100:
        return f"{key} must be a percentage between 0 and 100."
    if key == "nightlight_temperature" and not 1000 <= int(value) <= 10000:
        return "nightlight_temperature must be between 1000 and 10000 kelvin."
    return None


def _coerce(key: str, raw: str, field_type: type) -> object:
    """Turn a command-line string into the type the config field expects."""
    if field_type is bool:
        lowered = raw.strip().lower()
        if lowered in ("true", "yes", "on", "1"):
            return True
        if lowered in ("false", "no", "off", "0"):
            return False
        raise ValueError(f"{key} must be true or false.")
    if field_type is int:
        return int(float(raw))     # tolerate "80.0" from a JS slider
    if field_type is float:
        return float(raw)
    return raw


def _config_command(args: argparse.Namespace) -> int:
    action = getattr(args, "config_action", None)
    if action == "path":
        print(config_mod.config_path())
        return 0

    fields = {f.name: f.type for f in dataclasses.fields(config_mod.Config)}

    if action == "show" or action is None:
        cfg = config_mod.load()
        # Stable key=value lines: easy to parse from the applet's JS, and
        # readable enough to be useful on its own.
        for name in fields:
            value = getattr(cfg, name)
            if isinstance(value, bool):
                value = "true" if value else "false"
            print(f"{name}={value}")
        return 0

    if action == "set":
        if args.key not in fields:
            print(f"unknown setting '{args.key}'. See 'lumendusk config show'.",
                  file=sys.stderr)
            return 2
        cfg = config_mod.load()
        # The dataclass is annotated with real types, but `from __future__ import
        # annotations` leaves them as strings — map by the default's type instead.
        field_type = type(getattr(config_mod.Config(), args.key))
        try:
            value = _coerce(args.key, args.value, field_type)
        except ValueError as exc:
            print(exc, file=sys.stderr)
            return 2
        problem = _validate(args.key, value)
        if problem:
            print(problem, file=sys.stderr)
            return 2
        before = cfg
        cfg = dataclasses.replace(cfg, **{args.key: value})
        config_mod.save(cfg)
        print(f"{args.key}={args.value}")
        if getattr(args, "apply", False):
            _apply_setting_change(before, cfg)
        return 0

    print("usage: lumendusk config show | path | set KEY VALUE", file=sys.stderr)
    return 2


def _apply_setting_change(before: config_mod.Config,
                          after: config_mod.Config) -> None:
    """Show a just-stored setting on screen, if it affects the phase we're in.

    Storing a value and doing nothing with it is what makes a settings dialog
    feel broken: you drag "night brightness" at 8pm, the file is written, and the
    screen sits there. The daemon does notice within a tick, but a minute of
    nothing is long enough to conclude the control doesn't work — so the applet
    passes ``--apply`` and gets the same result immediately.

    The decision of *what* a changed setting means is not made here: it is the
    same :func:`~lumendusk.daemon.apply_changes` diff the daemon's tick runs, on
    the config before and after the write. That matters — this behaviour used to
    live in two places once before, and the bug lived in the seam between them.
    Editing the *day* brightness at night therefore changes nothing now, and a
    brightness nudged by hand this evening survives the edit.
    """
    if not after.is_auto():
        return          # manual: the desktop is the user's, settings or not.
    from .daemon import apply_changes, current_phase, phase_state
    phase = current_phase(after)
    apply_changes(phase_state(phase, before), phase_state(phase, after),
                  phase, after)


def _appearance_command(which: str) -> int:
    """Standalone dark/light switch (separate from the day/night theme path)."""
    from .apply import appearance
    if which == "status":
        appearance.status()
        return 0
    if which == "auto":
        # The appearance the schedule wants right now, and nothing else — no
        # night light, no brightness. That narrowness is the point: this is what
        # runs after someone changes "daytime appearance", and re-applying a
        # brightness preset would undo a slider tweak they made this afternoon.
        from .apply.theme import appearance_for
        from .daemon import Phase, current_phase
        cfg = config_mod.load()
        which = appearance_for(current_phase(cfg) is Phase.NIGHT, cfg)
    if which == "toggle":
        which = "light" if appearance.current_mode() == "dark" else "dark"
    return 0 if appearance.set_mode(which) else 1


def _nightlight_command(which: str) -> int:
    """Turn the warm tint on or off right now.

    Separate from ``nightlight_enabled`` in config, which only says whether the
    *automation* should use night light. This is the live switch, so manual mode
    can offer warmth without handing the schedule back to the daemon.
    """
    from .apply import nightlight_on, set_nightlight
    if which == "status":
        print("on" if nightlight_on() else "off")
        return 0
    if which == "toggle":
        which = "off" if nightlight_on() else "on"
    cfg = config_mod.load()
    set_nightlight(which == "on", cfg.nightlight_temperature)
    print(f"night light {which}"
          + (f" @ {cfg.nightlight_temperature}K" if which == "on" else ""))
    return 0


def _apply_mode(which: str) -> int:
    """Manually apply full day or night mode (theme + night light + brightness).

    A manual override: the transition-only daemon leaves it alone until the next
    scheduled day/night transition.
    """
    from .daemon import Phase, apply_phase
    cfg = config_mod.load()
    phase = Phase.NIGHT if which == "night" else Phase.DAY
    apply_phase(phase, cfg)
    log.info("switched to %s mode (manual).", which)
    return 0


def _status() -> int:
    from .daemon import current_phase  # local import avoids a cycle at import time
    cfg = config_mod.load()
    phase = current_phase(cfg).value
    print(f"control={cfg.control} mode={cfg.mode} phase={phase}")
    if not cfg.is_auto():
        print("  manual: your dark/light choice stands until you switch back "
              "with 'lumendusk auto'.")
    # Only worth saying when it isn't the obvious day=light/night=dark. Without
    # this, "phase=day" next to a dark desktop reads as a bug.
    if cfg.is_auto() and (cfg.theme_day, cfg.theme_night) != ("light", "dark"):
        if cfg.theme_day == cfg.theme_night:
            print(f"  appearance stays {cfg.theme_day} in both phases; only "
                  f"night light and brightness follow the schedule.")
        else:
            print(f"  appearance: {cfg.theme_day} by day, "
                  f"{cfg.theme_night} by night.")
    if cfg.is_auto() and cfg.mode == "sun" and not cfg.location_is_set():
        print(f"  sun mode has no location set, so the fixed times "
              f"({cfg.light_start}–{cfg.dark_start}) are in use. Set one with: "
              f"lumendusk location <lat> <lon>")
    print(f"  config: {config_mod.config_path()}")
    print(f"  log:    {log.log_path()}")
    return 0


def _brightness_command(args: argparse.Namespace) -> int:
    action = args.action
    if action == "list":
        # The diagnostic command probes for real. Someone runs this straight
        # after plugging a monitor in, or to find out why one is missing — a
        # cached answer is the wrong kind of fast.
        monitors = brightness_mod.list_monitors(refresh=True)
        if not monitors:
            print("no controllable monitors detected. For external monitors, "
                  "install ddcutil, load the i2c-dev module, and add yourself "
                  "to the 'i2c' group.", file=sys.stderr)
            return 1
        for mon in monitors:
            # Probing for real is the point of this command, so its answer is
            # also the freshest thing anyone has: a monitor being skipped for
            # not answering starts or stops being skipped right here. That is
            # what makes `brightness list` the thing to run after power-cycling
            # a display, rather than a command that agrees with a stale record.
            try:
                level = f"{mon.get()}%"
                brightness_mod.note_reachable(mon.id)
            except brightness_mod.BacklightError as exc:
                brightness_mod.note_unreachable(mon.id, exc)
                level = f"(read failed: {exc})"
            tag = "" if mon.real else "  [software dimming]"
            print(f"  {mon.id:<12} {mon.backend:<12} {level:<8} {mon.label}{tag}")
        return 0

    if action == "get":
        for mid, level in brightness_mod.get_brightness(args.monitor):
            print(f"  {mid}: {level if level is not None else '?'}%")
        return 0

    if action == "set":
        if args.value is None:
            print("'brightness set' needs a value, e.g. 'set 60'.", file=sys.stderr)
            return 2
        for mid, level in brightness_mod.set_brightness(args.value, args.monitor):
            print(f"  {mid} → {level}%")
        return 0

    # day / night presets from config
    cfg = config_mod.load()
    level = cfg.brightness_day if action == "day" else cfg.brightness_night
    for mid, applied in brightness_mod.set_brightness(level, args.monitor):
        print(f"  {mid} → {applied}% ({action} preset)")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "brightness":
        try:
            return _brightness_command(args)
        except brightness_mod.BacklightError as exc:
            print(exc, file=sys.stderr)
            return 1
    if args.command == "location":
        return _location_command(args)
    if args.command == "config":
        return _config_command(args)
    if args.command in ("manual", "pause"):
        return _set_control("manual")
    if args.command in ("auto", "resume"):
        return _set_control("auto")
    if args.command == "toggle":
        return _set_control("auto" if not config_mod.load().is_auto() else "manual")
    if args.command == "status":
        return _status()
    if args.command == "mode":
        return _apply_mode(args.which)
    if args.command == "appearance":
        return _appearance_command(args.which)
    if args.command == "nightlight":
        return _nightlight_command(args.which)
    return run_daemon(interval=args.interval, once=args.once)
