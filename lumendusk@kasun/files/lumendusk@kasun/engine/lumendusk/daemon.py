"""Core loop: decide day vs. night, then apply theme + night light + brightness.

Key behaviours from the plan:

* **Transition-only apply** — we apply on startup, then only when the phase
  actually changes. This is what makes manual overrides stick: if you tweak the
  theme or brightness by hand mid-period, the daemon leaves it alone until the
  next real day↔night transition. The one exception is a *setting* change: a
  value the user just edited is a request, not drift, so it lands on the next
  tick (see :class:`PhaseState`).
* **Suspend/resume safety** — every tick re-evaluates the phase, so if the clock
  jumped across a transition while asleep, the change is caught on the next tick
  rather than waiting a full period. Large wall-clock jumps are logged.
* **Applying is reconciliation** — the backends skip settings that already hold
  the right value, so the applies that find nothing to do (startup, resume,
  switching back to automatic) cost a few reads instead of a theme reload. The
  explicit "apply now" passes ``force`` to rewrite regardless.
* **Cheap** — sleeps ``interval`` seconds between ticks; near-zero CPU otherwise.
* **Unkillable by config** — a bad config or a failing backend logs and is
  retried next tick. The loop is the one thing that must not stop; it is often
  running detached with no console attached (see :mod:`lumendusk.log`).
"""

from __future__ import annotations

import contextlib
import signal
import time
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from . import brightness as brightness_mod
from . import config as config_mod
from . import log
from .apply import appearance_for, set_nightlight, set_theme
from .brightness.backends import cache_dir
from .schedule import is_night

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows, where Phase 3 will differ
    fcntl = None  # type: ignore[assignment]


class Phase(str, Enum):
    DAY = "day"
    NIGHT = "night"


def current_phase(cfg: config_mod.Config, now: datetime | None = None) -> Phase:
    return Phase.NIGHT if is_night(cfg, now) else Phase.DAY


@dataclass(frozen=True)
class PhaseState:
    """What the settings ask the desktop to look like *in one phase*.

    Transition-only apply assumes the target for a phase never moves, which was
    true when the only question was day or night. It stopped being true once the
    settings panel could change the appearance, the warmth, and the brightness of
    the phase you are standing in: editing "night brightness" at 8pm has to show
    up at 8pm, or the slider reads as broken.

    Comparing two of these is what tells the two apart. Drift — a theme or a
    brightness the user nudged by hand — leaves the settings alone, so the state
    is unchanged and nothing fights back. An edit changes it, and only the parts
    that actually differ are re-applied.

    Deliberately narrow: it holds what is *visible in this phase*, not every
    setting. Night light is off all day at every temperature, so a temperature
    edit at noon compares equal and the screen doesn't flicker; likewise the
    day preset is not part of the night's state.
    """

    appearance: str
    nightlight: tuple[bool, int]
    brightness: int | None       # None = brightness automation is switched off


def phase_state(phase: Phase, cfg: config_mod.Config) -> PhaseState:
    dark = phase is Phase.NIGHT
    warm = dark and cfg.nightlight_enabled
    return PhaseState(
        appearance=appearance_for(dark, cfg),
        # Temperature only counts while the warmth is actually on, so it is
        # zeroed out otherwise rather than carried along invisibly.
        nightlight=(warm, cfg.nightlight_temperature if warm else 0),
        brightness=(cfg.brightness_night if dark else cfg.brightness_day)
        if cfg.brightness_enabled else None,
    )


def apply_changes(before: PhaseState, after: PhaseState, phase: Phase,
                  cfg: config_mod.Config) -> None:
    """Apply only the parts of the phase whose settings have changed.

    Each part is independent and failure-tolerant, the same as
    :func:`apply_phase` — the difference is that this touches nothing it wasn't
    asked to. Re-applying a brightness preset because the *night light* changed
    would undo a slider tweak from earlier in the same period, which is exactly
    what transition-only apply is there to prevent.

    Both the daemon's tick and ``config set --apply`` call this, so the panel and
    the schedule can't drift apart on what a changed setting means.
    """
    if after.appearance != before.appearance:
        log.info("%s appearance is now %s; applying.", phase.value,
                 after.appearance)
        try:
            set_theme(phase is Phase.NIGHT, cfg)
        except Exception:
            log.exception("failed to apply the %s appearance.", after.appearance)

    if after.nightlight != before.nightlight:
        on, _ = after.nightlight
        try:
            set_nightlight(on, cfg.nightlight_temperature)
        except Exception:
            log.exception("failed to set night light.")

    # `is not None` and not just a truth test: 0% is a legitimate setting, and
    # turning the automation *off* can't un-apply a brightness that's already on
    # the screen — there is nothing to restore it to.
    if after.brightness is not None and after.brightness != before.brightness:
        try:
            brightness_mod.set_brightness(after.brightness, "all")
        except Exception:
            log.exception("failed to set brightness.")


def apply_phase(phase: Phase, cfg: config_mod.Config,
                force: bool = False) -> None:
    """Apply theme, night light, and brightness for the given phase.

    Each step is independent: a backend that fails (no ddcutil permissions, a
    missing gsettings schema) is logged and the rest still run.

    By default the backends skip settings that already hold the right value,
    because most calls here are reconciliation rather than change — startup,
    resume, and switching back to automatic all apply a phase the desktop is
    usually already in. ``force`` rewrites regardless, for the explicit
    "apply day/night now".
    """
    if not cfg.is_auto():
        log.info("manual mode; leaving the desktop as the user set it.")
        return
    dark = phase is Phase.NIGHT

    try:
        set_theme(dark, cfg, force=force)
    except Exception:
        log.exception("failed to apply the %s theme.", phase.value)

    if cfg.nightlight_enabled:
        try:
            set_nightlight(dark, cfg.nightlight_temperature, force=force)
        except Exception:
            log.exception("failed to set night light.")

    if cfg.brightness_enabled:
        level = cfg.brightness_night if dark else cfg.brightness_day
        try:
            # No log line here: set_brightness reports what it actually applied,
            # per monitor. This used to log the level we asked for regardless of
            # whether any backend accepted it.
            brightness_mod.set_brightness(level, "all")
        except Exception:
            log.exception("failed to set brightness.")


def run_once() -> int:
    """Evaluate the current phase and apply it, then return. Used by ``--once``.

    Forced: this is the applet's "Apply day/night now" and the CLI's ``--once``,
    which someone reaches for *because* the desktop looks wrong. Skipping keys
    that already read correct is exactly the wrong behaviour for a repair
    button — the value may be right while the desktop isn't.
    """
    cfg = config_mod.load()
    phase = current_phase(cfg)
    log.info("phase now: %s", phase.value)
    apply_phase(phase, cfg, force=True)
    return 0


@contextlib.contextmanager
def _sole_daemon():
    """Hold the daemon lock, or yield False so the caller can bow out.

    Two daemons is a real configuration, not a hypothetical: install.sh starts
    one, the autostart entry starts another at the next login, and someone
    debugging runs a third in a terminal. They don't corrupt anything — applying
    a phase is reconciliation — but they double every gsettings write and every
    DDC/CI conversation, and they interleave in the log, which makes the log
    lie about what happened.

    The lock is advisory and deliberately toothless: no fcntl, no writable
    cache directory, or anything else unexpected means the daemon runs anyway.
    A tool that refuses to start because it could not create a lock file is
    worse than two of it running.

    Not taken by ``--once``. That is the applet's "Apply now" and the CLI's
    one-shot, which people run *while* the daemon is up; that is the point of
    them.
    """
    if fcntl is None:
        yield True
        return
    try:
        path = cache_dir() / "daemon.lock"
        path.parent.mkdir(parents=True, exist_ok=True)
        handle = open(path, "w")
    except OSError:
        yield True
        return

    try:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            yield False
            return
        yield True
    finally:
        handle.close()


def _stop_on_sigterm() -> None:
    """Make SIGTERM end the loop the same way Ctrl-C does.

    The daemon is normally killed by something that sends SIGTERM — a logout, a
    ``pkill``, ``uninstall.sh``. Without this it dies at whatever line it was
    on, with the log simply stopping; with it, the loop unwinds through the
    path it already has and says so. Signals can only be installed from the
    main thread, and the tests drive the loop directly, so failing to install
    one is not worth an error.
    """
    def stop(_signum: int, _frame: object) -> None:
        raise KeyboardInterrupt

    with contextlib.suppress(ValueError, OSError):
        signal.signal(signal.SIGTERM, stop)


def run_daemon(interval: int = 60, once: bool = False) -> int:
    """Run the main loop. Applies on startup, then only on phase changes."""
    if once:
        return run_once()

    with _sole_daemon() as sole:
        if not sole:
            log.info("another lumendusk daemon is already running; leaving it to it.")
            return 0
        _stop_on_sigterm()
        return _loop(interval)


def _loop(interval: int) -> int:
    interval = max(1, interval)
    cfg = config_mod.load()
    last: Phase | None = None
    # What we last asked the desktop for, so an edited setting can be told apart
    # from a hand-made tweak on the next tick. See PhaseState.
    last_state: PhaseState | None = None
    was_manual = not cfg.is_auto()
    last_wall = time.time()

    log.info("logging to %s", log.log_path())

    # Startup: apply once so the desktop matches the current phase — unless the
    # user has put us in manual.
    if was_manual:
        # Manual: touch nothing at all. Not even night light — in manual that's
        # the user's own toggle, and forcing it off here would silently undo it
        # every login. The one-time drop happens when *switching* into manual
        # (below), which is the movie-night case; after that it's theirs.
        log.info("started in manual; leaving the desktop as it is.")
    else:
        phase = current_phase(cfg)
        apply_phase(phase, cfg)
        last = phase
        last_state = phase_state(phase, cfg)
        log.info("started (%s mode); phase=%s, checking every %ss.",
                 cfg.mode, phase.value, interval)

    while True:
        try:
            time.sleep(interval)
        except KeyboardInterrupt:
            log.info("stopping.")
            return 0

        try:
            # Detect a suspend/resume clock jump (elapsed >> interval).
            now_wall = time.time()
            if now_wall - last_wall > interval * 3:
                log.info("clock jump detected (resume?); re-evaluating.")
            last_wall = now_wall

            cfg = config_mod.load()  # cheap; lets applet/config edits take effect

            # Manual: touch nothing at all, the same as startup-in-manual above.
            #
            # Dropping the night light on the way in is `lumendusk manual`'s
            # job, and only its job. Repeating it here looked harmless but this
            # tick can land up to `interval` seconds after the switch, so it
            # would undo a night light the user had turned back on in between —
            # which is precisely the thing manual mode promises not to do.
            if not cfg.is_auto():
                if not was_manual:
                    log.info("switched to manual; leaving the desktop alone.")
                was_manual = True
                continue

            phase = current_phase(cfg)

            # Just switched back to automatic: snap to the correct current state.
            if was_manual:
                log.info("switched to automatic; applying the current phase.")
                apply_phase(phase, cfg)
                last = phase
                last_state = phase_state(phase, cfg)
                was_manual = False
                continue

            if phase != last:
                log.info("transition %s → %s", last.value if last else "?",
                         phase.value)
                apply_phase(phase, cfg)
                last = phase
                last_state = phase_state(phase, cfg)
                continue

            # Same phase, but a setting for it has changed since we applied it —
            # the user edited it, so this is a change they just asked for rather
            # than one to sit on until the next transition. Only what actually
            # differs moves; the rest of the desktop is left where it is.
            state = phase_state(phase, cfg)
            if state != last_state:
                apply_changes(last_state, state, phase, cfg)
                last_state = state
        except KeyboardInterrupt:
            log.info("stopping.")
            return 0
        except Exception:
            # Never let one bad tick end the daemon — log it and try again.
            log.exception("unexpected error during tick; continuing.")
