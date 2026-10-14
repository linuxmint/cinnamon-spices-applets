"""Work out roughly where the machine is, without asking the network.

Sun mode needs a latitude/longitude, and typing one in means going off to find
it somewhere. But the system already knows its timezone, and every Linux install
ships a table mapping timezones to coordinates:

    /usr/share/zoneinfo/zone1970.tab   (or the older zone.tab)
    LK	+0656+07951	Asia/Colombo

That gives a location accurate to the timezone's reference city — for
sunrise/sunset that is a couple of minutes out for most people, and far better
than the 0, 0 we would otherwise start from. It is a *starting point* the user
can correct, not a substitute for asking them.

Nothing here reaches the network, and there's no new dependency: it's a text
file the OS already has.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import NamedTuple

# Debian/Ubuntu/Mint keep the name here; /etc/localtime is a symlink into the
# zoneinfo tree on basically everything else.
_TIMEZONE_FILE = Path("/etc/timezone")
_LOCALTIME_LINK = Path("/etc/localtime")
_ZONEINFO_DIR = Path("/usr/share/zoneinfo")

# zone1970.tab is the current one; zone.tab is kept for backwards compatibility
# and is still present (and sometimes the only one) on older installs.
_ZONE_TABS = ("zone1970.tab", "zone.tab")

# ISO 6709: ±DDMM±DDDMM, optionally with seconds (±DDMMSS±DDDMMSS).
_ISO6709 = re.compile(
    r"^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$"
)


class DetectedLocation(NamedTuple):
    latitude: float
    longitude: float
    timezone: str


def system_timezone() -> str | None:
    """Return the IANA timezone name (e.g. "Asia/Colombo"), or None."""
    # TZ wins when set, matching what the C library itself does.
    tz = os.environ.get("TZ", "").strip()
    if tz and "/" in tz:
        return tz

    try:
        name = _TIMEZONE_FILE.read_text(encoding="utf-8").strip()
        if name:
            return name
    except OSError:
        pass

    # /etc/localtime -> /usr/share/zoneinfo/Asia/Colombo
    try:
        target = _LOCALTIME_LINK.resolve()
        parts = target.parts
        if "zoneinfo" in parts:
            idx = len(parts) - 1 - parts[::-1].index("zoneinfo")
            name = "/".join(parts[idx + 1:])
            if name:
                return name
    except OSError:
        pass
    return None


def _parse_iso6709(value: str) -> tuple | None:
    """Turn "+0656+07951" into (6.933…, 79.85). None if it isn't that shape."""
    match = _ISO6709.match(value.strip())
    if not match:
        return None
    lat_sign, lat_d, lat_m, lat_s, lon_sign, lon_d, lon_m, lon_s = match.groups()

    def combine(sign: str, deg: str, minute: str, second: str | None) -> float:
        total = int(deg) + int(minute) / 60 + (int(second) / 3600 if second else 0)
        return -total if sign == "-" else total

    lat = combine(lat_sign, lat_d, lat_m, lat_s)
    lon = combine(lon_sign, lon_d, lon_m, lon_s)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return lat, lon


def _zone_table_lookup(timezone: str) -> tuple | None:
    """Find a timezone's coordinates in the system's zone table."""
    for filename in _ZONE_TABS:
        path = _ZONEINFO_DIR / filename
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for line in text.splitlines():
            if not line or line.startswith("#"):
                continue
            # country codes \t coordinates \t TZ name \t optional comment
            fields = line.split("\t")
            if len(fields) < 3 or fields[2].strip() != timezone:
                continue
            coords = _parse_iso6709(fields[1])
            if coords:
                return coords
    return None


def detect_location() -> DetectedLocation | None:
    """Best-effort location from the system timezone. None if we can't tell.

    Deliberately returns None rather than a guess when anything is missing —
    a wrong location is worse than no location, because sun mode would then be
    confidently wrong instead of visibly unset.
    """
    timezone = system_timezone()
    if not timezone:
        return None
    coords = _zone_table_lookup(timezone)
    if not coords:
        return None
    latitude, longitude = coords
    return DetectedLocation(round(latitude, 4), round(longitude, 4), timezone)


__all__ = ["DetectedLocation", "detect_location", "system_timezone"]
