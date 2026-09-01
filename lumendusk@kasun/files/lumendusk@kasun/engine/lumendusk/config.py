"""Load and save Lumendusk configuration.

Config lives at ``~/.config/lumendusk/config.toml``.

Reading uses the stdlib ``tomllib`` on Python 3.11+, falling back to the
``tomli`` package on 3.9/3.10 (Linux Mint 21 ships Python 3.10). Writing uses a
tiny purpose-built serializer so we don't need a third-party TOML *writer* —
our schema is small and known.

Loading never raises: a broken or half-written config falls back to the last
values we read successfully, or to defaults. The daemon reloads this file every
tick, so a typo made while editing must not be able to kill it.
"""

from __future__ import annotations

import os
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path

from . import log

try:  # Python 3.11+
    import tomllib as _toml
except ModuleNotFoundError:  # pragma: no cover - exercised on 3.9/3.10 only
    try:
        import tomli as _toml  # type: ignore[no-redef]
    except ModuleNotFoundError:  # pragma: no cover
        _toml = None  # type: ignore[assignment]


def config_dir() -> Path:
    base = os.environ.get("XDG_CONFIG_HOME") or (Path.home() / ".config")
    return Path(base) / "lumendusk"


def config_path() -> Path:
    return config_dir() / "config.toml"


@dataclass
class Config:
    """All user-tunable settings, flattened for easy access.

    Nested TOML tables (``[location]``, ``[theme]``, ``[brightness]`` …) are
    mapped to/from these flat fields by :func:`load` and :func:`save`.
    """

    # Who is driving the desktop:
    #   "auto"   — Lumendusk follows the schedule below.
    #   "manual" — you pick dark or light; nothing changes it on its own.
    # One field on purpose. This used to be two booleans (``enabled`` and
    # ``paused``) that a user could not tell apart, because both of them just
    # meant "stop automating".
    control: str = "auto"            # "auto" or "manual"

    # How "auto" decides day from night. The default is "fixed" on purpose:
    # "sun" needs a real latitude/longitude, and we have no way to guess one
    # offline. Fixed times are sensible everywhere; the user switches to sun
    # mode once they've set their location. Ignored while control = "manual".
    mode: str = "fixed"              # "sun" (astral) or "fixed"
    latitude: float = 0.0
    longitude: float = 0.0
    dark_start: str = "19:00"        # fixed mode: when night begins
    light_start: str = "07:00"       # fixed mode: when day begins

    # theme / appearance. The dark/light switch applies a whole-desktop Mint
    # style (system UI + apps). ``theme_accent`` blank = auto-detect the current
    # accent and keep it; set e.g. "yaru"/"orange"/"aqua" to force one.
    theme_accent: str = ""

    # Which appearance each phase wears. Day → light and night → dark are the
    # defaults and what most people want, but they are a preference, not a law:
    # plenty of people want dark at their desk all day and still want the screen
    # warmed and dimmed after sunset. Setting both to the same value turns theme
    # switching off while leaving night light and brightness on the schedule.
    theme_day: str = "light"         # "light" or "dark"
    theme_night: str = "dark"

    # night light
    nightlight_enabled: bool = True
    nightlight_temperature: int = 4000

    # brightness (feature track B1–B3)
    brightness_enabled: bool = False
    brightness_day: int = 80
    brightness_night: int = 35

    def is_auto(self) -> bool:
        """True if Lumendusk should be driving the desktop itself.

        Anything other than an explicit "auto" counts as manual: a config file
        holding a typo should leave the user's desktop alone rather than start
        changing it under them.
        """
        return self.control == "auto"

    def location_is_set(self) -> bool:
        """True if a real latitude/longitude has been configured.

        (0, 0) is in the Gulf of Guinea — it is the "never configured" marker,
        not a location anyone runs a desktop from.
        """
        return not (abs(self.latitude) < 0.001 and abs(self.longitude) < 0.001)


def _from_toml(data: dict) -> Config:
    """Build a Config from parsed TOML, coercing each value to its field type.

    A hand-edited file can hold anything (``latitude = "north"``); a wrong type
    falls back to the default for that field rather than blowing up somewhere
    far away, like inside astral.

    Keys we don't recognise are ignored rather than rejected, which is what
    makes a file written by an older version still load: ``theme.light``,
    ``theme.dark`` and ``brightness.fade_minutes`` were all read here once and
    are simply passed over now. They disappear the next time the file is
    rewritten. (The one key that is *not* just ignored is the pre-``control``
    pair — see :func:`_control` — because forgetting those would start
    automating a desktop the user had deliberately stopped.)
    """
    if not isinstance(data, dict):
        raise ValueError("config root is not a table")

    def _table(name: str) -> dict:
        value = data.get(name, {})
        return value if isinstance(value, dict) else {}

    loc, fixed = _table("location"), _table("fixed")
    theme, night, bright = _table("theme"), _table("nightlight"), _table("brightness")
    d = Config()

    def _str(src: dict, key: str, default: str) -> str:
        value = src.get(key, default)
        return value if isinstance(value, str) else default

    def _bool(src: dict, key: str, default: bool) -> bool:
        value = src.get(key, default)
        return value if isinstance(value, bool) else default

    def _num(src: dict, key: str, default: float) -> float:
        value = src.get(key, default)
        # bool is a subclass of int — don't let `latitude = true` become 1.0.
        return float(value) if isinstance(value, (int, float)) \
            and not isinstance(value, bool) else default

    def _int(src: dict, key: str, default: int) -> int:
        return int(_num(src, key, default))

    def _appearance(src: dict, key: str, default: str) -> str:
        """Read a per-phase appearance, ignoring anything that isn't light/dark.

        Unlike the free-text fields, a typo here has a visible consequence — an
        unrecognised value would have to mean *something* at apply time, and
        guessing is worse than falling back to the default for that phase.
        """
        value = src.get(key, default)
        return value if value in ("light", "dark") else default

    def _control(src: dict, default: str) -> str:
        """Read ``control``, migrating config files written before it existed.

        Older versions had two separate booleans that both meant "don't
        automate": ``enabled = false`` (leave the desktop alone entirely) and
        ``paused = true`` (freeze where it is). Either one becomes "manual", so
        someone who had paused automation and then upgraded doesn't get their
        theme yanked out from under them on the next tick.

        The old keys are only consulted when ``control`` is absent, so a file we
        have already rewritten is never second-guessed by leftovers.
        """
        value = src.get("control")
        if isinstance(value, str) and value in ("auto", "manual"):
            return value
        if value is not None:
            return default  # present but nonsense — don't fall through to legacy
        if _bool(src, "paused", False) or not _bool(src, "enabled", True):
            return "manual"
        return default

    return Config(
        control=_control(data, d.control),
        mode=_str(data, "mode", d.mode),
        latitude=_num(loc, "latitude", d.latitude),
        longitude=_num(loc, "longitude", d.longitude),
        dark_start=_str(fixed, "dark_start", d.dark_start),
        light_start=_str(fixed, "light_start", d.light_start),
        theme_accent=_str(theme, "accent", d.theme_accent),
        theme_day=_appearance(theme, "day", d.theme_day),
        theme_night=_appearance(theme, "night", d.theme_night),
        nightlight_enabled=_bool(night, "enabled", d.nightlight_enabled),
        nightlight_temperature=_int(night, "temperature", d.nightlight_temperature),
        brightness_enabled=_bool(bright, "enabled", d.brightness_enabled),
        brightness_day=_int(bright, "day", d.brightness_day),
        brightness_night=_int(bright, "night", d.brightness_night),
    )


def _to_toml(c: Config) -> str:
    """Render the config as TOML, laid out to be read at a glance.

    One short comment per group, values aligned under it, and a clear gap
    between sections. The previous version explained every option in full
    prose, which made a twelve-setting file look like documentation you had to
    read before touching anything — the settings panel is where explanations
    belong, and ``lumendusk config show`` prints the values with no comments
    at all.
    """
    def s(v: str) -> str:
        return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"'

    def b(v: bool) -> str:
        return "true" if v else "false"

    return (
        "# Lumendusk settings. Edit freely — but comments you add are lost\n"
        "# when Lumendusk rewrites this file.\n"
        "\n"
        "# auto = follow the schedule below. manual = you decide, nothing moves.\n"
        f"control = {s(c.control)}\n"
        "\n"
        "# How auto tells day from night: fixed (times below) or sun (location).\n"
        f"mode = {s(c.mode)}\n"
        "\n"
        "\n"
        "[location]\n"
        "# For mode = sun. Decimal degrees; London is 51.5074 / -0.1278.\n"
        f"latitude  = {c.latitude}\n"
        f"longitude = {c.longitude}\n"
        "\n"
        "\n"
        "[fixed]\n"
        "# For mode = fixed. 24-hour times.\n"
        f"dark_start  = {s(c.dark_start)}\n"
        f"light_start = {s(c.light_start)}\n"
        "\n"
        "\n"
        "[theme]\n"
        "# How each half of the day looks: light or dark. Both dark = dark all day.\n"
        f"day   = {s(c.theme_day)}\n"
        f"night = {s(c.theme_night)}\n"
        "\n"
        "# Empty keeps your current accent. Or name one: yaru, orange, aqua,\n"
        "# teal, blue, grey, sand, red, pink, purple, navy, cyan, green.\n"
        f"accent = {s(c.theme_accent)}\n"
        "\n"
        "\n"
        "[nightlight]\n"
        "# Warm tint after dark. 1000 = deep amber, 6500 = plain daylight.\n"
        f"enabled     = {b(c.nightlight_enabled)}\n"
        f"temperature = {c.nightlight_temperature}\n"
        "\n"
        "\n"
        "[brightness]\n"
        "# Screen brightness per phase, 0-100%.\n"
        f"enabled = {b(c.brightness_enabled)}\n"
        f"day     = {c.brightness_day}\n"
        f"night   = {c.brightness_night}\n"
    )


# Last config we parsed successfully. If a later read fails (typo, or a read
# that caught a half-written file), we keep running on these values instead of
# dying or silently reverting the user's settings to defaults.
_last_good: Config | None = None
_warned_bad_config = False


def load() -> Config:
    """Load config, falling back to the last good values. Never raises.

    Creates the file with defaults if it does not exist yet.
    """
    global _last_good, _warned_bad_config
    path = config_path()

    if not path.exists():
        cfg = Config()
        save(cfg)
        _last_good = cfg
        return cfg

    if _toml is None:  # pragma: no cover - only on 3.9/3.10 without tomli
        if not _warned_bad_config:
            log.error(
                "no TOML parser available. Install it with "
                "'pip install tomli', or use Python 3.11+. Using defaults."
            )
            _warned_bad_config = True
        return _last_good or Config()

    try:
        with path.open("rb") as fh:
            data = _toml.load(fh)
        cfg = _from_toml(data)
    except (OSError, ValueError) as exc:
        # ValueError covers TOMLDecodeError (a subclass) and any wrong-typed
        # value that trips the dataclass up.
        if not _warned_bad_config:
            log.error(
                "could not read %s: %s. Using %s. Fix the file and the next "
                "check will pick it up.",
                path, exc, "the last good settings" if _last_good else "defaults",
            )
            _warned_bad_config = True
        return _last_good or Config()

    if _warned_bad_config:
        log.info("%s is readable again.", path)
        _warned_bad_config = False
    _last_good = cfg
    return cfg


def save(config: Config) -> None:
    """Write config to disk atomically, creating the directory if needed.

    Atomic because the daemon re-reads this file every tick while the applet
    and CLI write to it — a plain write can be caught half-finished.
    """
    global _last_good
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".config.", suffix=".toml")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(_to_toml(config))
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except OSError:
        Path(tmp).unlink(missing_ok=True)
        raise
    _last_good = config


# Silence "asdict imported but unused" for tooling; it's part of the public
# surface people reach for when serializing Config elsewhere.
__all__ = ["Config", "asdict", "config_dir", "config_path", "load", "save"]
