"""Decide whether it is currently day or night.

Two modes, both pure-Python and offline:

* ``sun``   — sunrise/sunset for the user's latitude/longitude, via ``astral``.
* ``fixed`` — user-set clock times (``dark_start`` / ``light_start``).

Sun mode falls back to fixed times (warning once) when it can't be trusted:
``astral`` isn't installed, no location has been set, or astral itself fails.
Fixed times are always available, so there is no configuration a user can land
in where we don't know what to do.
"""

from __future__ import annotations

from datetime import datetime, timezone

from . import log
from .config import Config, config_path

# Warn-once flags, so a per-minute daemon loop doesn't spam the log.
_warned_no_astral = False
_warned_no_location = False
_warned_bad_times = False
_warned_astral_failed = False
_warned_bad_mode = False

_DEFAULT_DARK = "19:00"
_DEFAULT_LIGHT = "07:00"

# The sun's apparent elevation at sunrise and sunset, in degrees.
#
# Not zero. Sunrise is defined as the moment the sun's *upper limb* touches the
# horizon, so its centre — which is what elevation() reports — is still below.
# astral applies refraction, which lifts the apparent centre back up somewhat,
# and what's left is this: measured across four latitudes from the equator to
# the Arctic and across the solstices and an equinox, astral's own sunrise and
# sunset land at -0.3703° ± 0.005°. Steady enough to compare against directly.
#
# Using 0.0 here is the obvious mistake, and it's a quiet one: the sun crosses
# these last few tenths of a degree slowly, so a threshold that looks off by
# nothing puts the switch up to four minutes late at sunrise and the same early
# at sunset, widening with latitude. Nobody notices that on a desktop, which is
# exactly why it would have stayed wrong.
_SUNRISE_ELEVATION = -0.37


def _hhmm_to_minutes(value: str, default: str) -> int:
    """Parse a 24-hour "HH:MM" string into minutes past midnight.

    Falls back to ``default`` for anything unparseable, so one typo in the
    config can't take the daemon down.
    """
    global _warned_bad_times
    for candidate, is_fallback in ((value, False), (default, True)):
        try:
            hh, mm = str(candidate).strip().split(":")
            hours, minutes = int(hh), int(mm)
        except (AttributeError, TypeError, ValueError):
            continue
        if 0 <= hours <= 23 and 0 <= minutes <= 59:
            if is_fallback and not _warned_bad_times:
                log.warning(
                    "'%s' is not a valid HH:MM time; using %s instead.",
                    value, default,
                )
                _warned_bad_times = True
            return hours * 60 + minutes
    return 0  # unreachable while the defaults above stay valid


def _fixed_is_night(config: Config, now: datetime) -> bool:
    now_min = now.hour * 60 + now.minute
    dark = _hhmm_to_minutes(config.dark_start, _DEFAULT_DARK)
    light = _hhmm_to_minutes(config.light_start, _DEFAULT_LIGHT)
    if dark == light:
        # Degenerate config (identical times): treat as always day rather than
        # flapping every minute.
        return False
    if dark <= light:
        # Unusual ordering (dark before light on the same day): night is the
        # window between them.
        return dark <= now_min < light
    # Normal case: night wraps past midnight (e.g. 19:00 → 07:00).
    return now_min >= dark or now_min < light


def _sun_is_night(config: Config, now: datetime) -> bool:
    global _warned_no_astral, _warned_no_location, _warned_astral_failed

    # A latitude/longitude of 0, 0 is the Gulf of Guinea — i.e. nobody's
    # desktop. Without a real location, sun times would be confidently wrong
    # (dark all morning several timezones away), so use fixed times instead.
    if not config.location_is_set():
        if not _warned_no_location:
            log.warning(
                "sun mode needs a location: set [location] latitude/longitude "
                "in %s. Using fixed times (%s–%s) until then.",
                config_path(), config.light_start, config.dark_start,
            )
            _warned_no_location = True
        return _fixed_is_night(config, now)

    try:
        from astral import Observer
        from astral.sun import elevation
    except ImportError:
        if not _warned_no_astral:
            log.warning(
                "astral not installed; sun mode unavailable, falling back to "
                "fixed times. Install with: pip install 'lumendusk[sun]'"
            )
            _warned_no_astral = True
        return _fixed_is_night(config, now)

    # Ask "where is the sun right now" rather than "when are today's sunrise and
    # sunset". Comparing against sunrise/sunset means picking a *date* to compute
    # them for, and a solar day doesn't line up with a calendar day: across the
    # Americas and the Pacific, sunset falls on the next UTC date, and astral
    # pins both events to the date you asked for rather than rolling over — so
    # it hands back a sunset that lands before its own sunrise. Solar elevation
    # has no date in it at all. It also behaves inside the polar circles, where
    # sunrise/sunset simply don't exist and astral raises instead.
    try:
        angle = elevation(
            Observer(latitude=config.latitude, longitude=config.longitude),
            now.astimezone(timezone.utc),
        )
    except Exception as exc:
        if not _warned_astral_failed:
            log.warning(
                "could not compute the sun's position for %s, %s (%s); using "
                "fixed times.", config.latitude, config.longitude, exc,
            )
            _warned_astral_failed = True
        return _fixed_is_night(config, now)
    # Below the horizon is night. Within a minute of astral's own sunrise and
    # sunset — see _SUNRISE_ELEVATION — which is inside the daemon's tick, so
    # the schedule agrees with whatever else the user checks sunset against.
    return angle < _SUNRISE_ELEVATION


def is_night(config: Config, now: datetime | None = None) -> bool:
    """Return True if it is currently night under the configured mode."""
    global _warned_bad_mode
    now = now or datetime.now().astimezone()
    if config.mode == "sun":
        return _sun_is_night(config, now)
    if config.mode != "fixed" and not _warned_bad_mode:
        log.warning("unknown mode '%s' (expected 'sun' or 'fixed'); using fixed "
                    "times.", config.mode)
        _warned_bad_mode = True
    return _fixed_is_night(config, now)
