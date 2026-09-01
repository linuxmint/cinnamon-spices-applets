import datetime
from enum import Enum
from typing import Union


class Calendar(Enum):
    GREGORIAN = 1
    JULIAN = 2


def day_fraction_to_time(fraction: float) -> datetime.time:
    s = fraction * (24 * 60 * 60)
    h = int(s / (60 * 60))
    s -= h * 60 * 60
    m = int(s / 60)
    s -= m * 60
    s = int(s)
    return datetime.time(h, m, s)


def julianday(
    at: Union[datetime.datetime, datetime.date], calendar: Calendar = Calendar.GREGORIAN
) -> float:
    """Calculate the Julian Day (number) for the specified date/time

    julian day numbers for dates are calculated for the start of the day
    """

    def _time_to_seconds(t: datetime.time) -> int:
        return int(t.hour * 3600 + t.minute * 60 + t.second)

    year = at.year
    month = at.month
    day = at.day
    day_fraction = 0
    if isinstance(at, datetime.datetime):
        t = _time_to_seconds(at.time())
        day_fraction = t / (24 * 60 * 60)
    else:
        day_fraction = 0

    if month <= 2:
        year -= 1
        month += 12

    a = int(year / 100)
    if calendar == Calendar.GREGORIAN:
        b = 2 - a + int(a / 4)
    else:
        b = 0
    jd = (
        int(365.25 * (year + 4716))
        + int(30.6001 * (month + 1))
        + day
        + day_fraction
        + b
        - 1524.5
    )

    return jd


def julianday_modified(at: datetime.datetime) -> float:
    """Calculate the Modified Julian Date number"""

    year = at.year
    month = at.month
    day = at.day

    a = 10000 * year + 100 * month + day

    if year < 0:
        year += 1

    if month <= 2:
        month += 12
        year -= 1

    if a <= 15821004.1:
        b = -2 + (year + 4716) / 4 - 1179
    else:
        b = (year / 400) - (year / 100) + (year / 4)

    a = 365 * year - 679004
    mjd = a + b + int(30.6001 * (month + 1)) + day + at.hour / 24
    return mjd


def julianday_to_datetime(jd: float) -> datetime.datetime:
    """Convert a Julian Day number to a datetime"""
    jd += 0.5
    z = int(jd)
    f = jd - z
    if z < 2299161:
        a = z
    else:
        alpha = int((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha + int(alpha / 4.0)

    b = a + 1524
    c = int((b - 122.1) / 365.25)
    d = int(365.25 * c)
    e = int((b - d) / 30.6001)

    d = b - d - int(30.6001 * e) + f
    day = int(d)
    t = d - day
    total_seconds = t * (24 * 60 * 60)
    hour = int(total_seconds / 3600)
    total_seconds -= hour * 3600
    minute = int(total_seconds / 60)
    total_seconds -= minute * 60
    seconds = int(total_seconds)

    if e < 14:
        month = e - 1
    else:
        month = e - 13

    if month > 2:
        year = c - 4716
    else:
        year = c - 4715

    return datetime.datetime(year, month, day, hour, minute, seconds)


def julianday_to_juliancentury(julianday: float) -> float:
    """Convert a Julian Day number to a Julian Century"""
    return (julianday - 2451545.0) / 36525.0


def juliancentury_to_julianday(juliancentury: float) -> float:
    """Convert a Julian Century number to a Julian Day"""
    return (juliancentury * 36525.0) + 2451545.0


def julianday_2000(at: Union[datetime.datetime, datetime.date]) -> float:
    """Calculate the numer of Julian Days since Jan 1.5, 2000"""
    return julianday(at) - 2451545.0
