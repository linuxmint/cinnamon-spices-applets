"""Brightness backends. Every backend reads/writes a 0–100 % value.

Two kinds, both of them real backlight control:

* :class:`SysfsBacklight` / brightnessctl — internal laptop panel.
* :class:`DdcutilBacklight` — external monitors over DDC/CI.

There is deliberately no software-dimming fallback. Lumendusk used to fall back
to `xrandr --brightness`, which is not brightness at all: it scales the gamma
ramp, so the backlight stays where it was and every pixel is multiplied down
instead. On a display that already had a real backend it stacked on top of the
real backlight, and the two together looked like fog — blacks lifted to grey,
contrast flattened, dark content simply gone. Worse, the ramp is display state
rather than ours, so nothing reset it: one dim from a moment when DDC/CI
happened to be unreachable stayed on the screen after DDC/CI recovered.

If no real backend is available for a monitor, Lumendusk now leaves that monitor
alone and says so. Doing nothing is the honest answer; faking it is not.
"""

from __future__ import annotations

import contextlib
import os
import shutil
import subprocess
import time
from pathlib import Path

from .. import log

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows, where Phase 3 will differ
    fcntl = None  # type: ignore[assignment]


class BacklightError(RuntimeError):
    """Raised when a backend cannot read or set brightness."""


# Every backend shells out, and the daemon has exactly one thread. A command
# that *hangs* rather than fails takes the whole daemon with it: no more ticks,
# no more transitions, and a log that simply stops — which reads identically to
# a healthy idle daemon, so nobody notices until a theme fails to change hours
# later.
#
# DDC/CI is the realistic offender. ddcutil talks to the monitor over the I²C
# bus, and a display that is asleep, switched to another input, or just flaky
# can leave it waiting with no error to catch. A normal getvcp/setvcp on this
# hardware takes well under a second, so ten is generous enough never to fire
# on a healthy call and short enough that a wedged one is survivable.
_TIMEOUT = 10


def cache_dir() -> Path:
    """Where Lumendusk keeps disposable state (the DDC lock, the monitor cache)."""
    base = os.environ.get("XDG_CACHE_HOME") or os.path.expanduser("~/.cache")
    return Path(base) / "lumendusk"


# How long to queue behind another ddcutil call before giving up on the lock.
# A single operation is bounded by _TIMEOUT above, so 20 s covers a full queue
# with room to spare; past that, something is wedged rather than busy.
_LOCK_WAIT = 20.0


@contextlib.contextmanager
def ddc_lock():
    """Serialise ddcutil across every Lumendusk process.

    DDC/CI is a bus, not a set of independent devices, and ddcutil does not
    tolerate being run against two displays at once: measured on this hardware,
    concurrent `getvcp` calls failed roughly one run in five with "Display not
    found", while the same calls in sequence never failed. Concurrency also
    made it *slower* — there is no parallelism to win here, only contention.

    Nothing in one process is enough, because the callers are separate
    processes: the daemon applies a preset at a transition while the applet,
    which shells out to the CLI, may be reading the same monitors to draw its
    slider. A file lock is the only thing both can see.

    Failing to take the lock is never fatal. A read-only cache directory, a
    platform without fcntl, or a wedged holder all fall through to running
    unlocked — which is exactly today's behaviour, so the worst case is no
    worse than before.
    """
    if fcntl is None:
        yield
        return

    handle = None
    try:
        path = cache_dir() / "ddc.lock"
        path.parent.mkdir(parents=True, exist_ok=True)
        handle = open(path, "w")
    except OSError:
        yield
        return

    held = False
    deadline = time.monotonic() + _LOCK_WAIT
    try:
        while True:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                held = True
                break
            except OSError:
                if time.monotonic() >= deadline:
                    log.warning(
                        "waited %ss for the ddcutil lock; proceeding without it.",
                        int(_LOCK_WAIT))
                    break
                time.sleep(0.05)
        yield
    finally:
        if held:
            fcntl.flock(handle, fcntl.LOCK_UN)
        handle.close()


def _run(argv: list[str], what: str) -> subprocess.CompletedProcess[str]:
    """Run a backend command, converting every failure into BacklightError.

    Callers already handle BacklightError per monitor, so folding timeouts and
    a missing executable into it means one bad display can't escalate past the
    monitor it belongs to.
    """
    try:
        return subprocess.run(argv, check=True, capture_output=True, text=True,
                              timeout=_TIMEOUT)
    except subprocess.TimeoutExpired as exc:
        raise BacklightError(f"{what} timed out after {_TIMEOUT}s") from exc
    except subprocess.CalledProcessError as exc:
        raise BacklightError((exc.stderr or "").strip() or f"{what} failed") from exc
    except OSError as exc:
        raise BacklightError(f"{what}: {exc}") from exc


def _run_ddc(argv: list[str], what: str) -> subprocess.CompletedProcess[str]:
    """Run a ddcutil command with the bus to itself. See :func:`ddc_lock`."""
    with ddc_lock():
        return _run(argv, what)


class Backlight:
    """Base interface. ``id`` is how the CLI/config addresses this monitor."""

    id: str
    label: str
    backend: str

    def get(self) -> int:  # pragma: no cover - interface
        raise NotImplementedError

    def set(self, percent: int) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    @staticmethod
    def _clamp(percent: float) -> int:
        # float, not int: backends divide to normalise (raw / max * 100), so a
        # non-integer arrives here routinely. round() already returns an int.
        return max(0, min(100, round(percent)))


class SysfsBacklight(Backlight):
    """Internal panel via ``brightnessctl`` if present, else raw sysfs."""

    backend = "sysfs"

    def __init__(self, name: str, path: Path):
        self.id = name
        self.label = f"{name} (internal panel)"
        self._path = path
        self._max = int((path / "max_brightness").read_text().strip())
        self._use_ctl = shutil.which("brightnessctl") is not None
        if self._use_ctl:
            self.backend = "brightnessctl"

    def get(self) -> int:
        raw = int((self._path / "brightness").read_text().strip())
        return self._clamp(raw / self._max * 100)

    def set(self, percent: int) -> None:
        percent = self._clamp(percent)
        if self._use_ctl:
            _run(["brightnessctl", "--device", self.id, "set", f"{percent}%"],
                 "brightnessctl")
            return
        raw = round(percent / 100 * self._max)
        try:
            (self._path / "brightness").write_text(str(raw))
        except PermissionError as exc:
            raise BacklightError(
                f"cannot write {self._path/'brightness'} (need the 'video' group "
                "or a udev rule, or install brightnessctl)"
            ) from exc


class DdcutilBacklight(Backlight):
    """External monitor over DDC/CI. VCP feature 0x10 is luminance (0–100)."""

    backend = "ddcutil"

    def __init__(self, display: int, model: str = ""):
        self.id = f"ddc{display}"
        self.label = f"{model or 'external'} (ddcutil display {display})"
        self._display = str(display)

    def get(self) -> int:
        out = _run_ddc(
            ["ddcutil", "--display", self._display, "--brief", "getvcp", "10"],
            "ddcutil getvcp",
        ).stdout
        # Brief format: "VCP 10 C <current> <max>"
        parts = out.split()
        try:
            return self._clamp(int(parts[3]))
        except (IndexError, ValueError) as exc:
            raise BacklightError(f"unexpected ddcutil output: {out!r}") from exc

    def set(self, percent: int) -> None:
        percent = self._clamp(percent)
        _run_ddc(["ddcutil", "--display", self._display, "setvcp", "10", str(percent)],
                 "ddcutil setvcp")
