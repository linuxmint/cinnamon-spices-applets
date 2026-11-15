# -*- coding: utf-8 -*-

# Copyright 2009-2021, Simon Kennedy, sffjunkie+code@gmail.com

#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

"""Calculations for the position of the sun and moon.

The :mod:`astral` package provides the means to calculate the following times of the sun

* dawn
* sunrise
* noon
* midnight
* sunset
* dusk
* daylight
* night
* twilight
* blue hour
* golden hour
* rahukaalam
* moon rise, set, azimuth and zenith

plus solar azimuth and elevation at a specific latitude/longitude.
It can also calculate the moon phase for a specific date.

The package also provides a self contained geocoder to turn a small set of
location names into timezone, latitude and longitude. The lookups
can be perfomed using the :func:`~astral.geocoder.lookup` function defined in
:mod:`astral.geocoder`
"""

import datetime
import re
from dataclasses import dataclass, field
from enum import Enum
from math import radians, tan
from typing import Optional, Tuple, Union

try:
    import zoneinfo
except ImportError:
    from backports import zoneinfo


__all__ = [
    "Depression",
    "SunDirection",
    "Observer",
    "LocationInfo",
    "AstralBodyPosition",
    "now",
    "today",
    "dms_to_float",
    "refraction_at_zenith",
]

__version__ = "3.2"
__author__ = "Simon Kennedy <sffjunkie+code@gmail.com>"


TimePeriod = Tuple[datetime.datetime, datetime.datetime]
Elevation = Union[float, Tuple[float, float]]
Degrees = float
Radians = float
Minutes = float


def now(tz: Optional[datetime.tzinfo] = None) -> datetime.datetime:
    """Returns the current time in the specified time zone"""
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    if tz is None:
        return now_utc

    return now_utc.astimezone(tz)


def today(tz: Optional[datetime.tzinfo] = None) -> datetime.date:
    """Returns the current date in the specified time zone"""
    return now(tz).date()


def dms_to_float(
    dms: Union[str, float, Elevation], limit: Optional[float] = None
) -> float:
    """Converts as string of the form `degrees°minutes'seconds"[N|S|E|W]`,
    or a float encoded as a string, to a float

    N and E return positive values
    S and W return negative values

    Args:
        dms: string to convert
        limit: Limit the value between ± `limit`

    Returns:
        The number of degrees as a float
    """

    try:
        res = float(dms)  # type: ignore
    except (ValueError, TypeError) as exc:
        _dms_re = r"(?P<deg>\d{1,3})[°]((?P<min>\d{1,2})[′'])?((?P<sec>\d{1,2})[″\"])?(?P<dir>[NSEW])?"  # noqa
        dms_match = re.match(_dms_re, str(dms), flags=re.IGNORECASE)
        if dms_match:
            deg = dms_match.group("deg") or 0.0
            min_ = dms_match.group("min") or 0.0
            sec = dms_match.group("sec") or 0.0
            dir_ = dms_match.group("dir") or "E"

            res = float(deg)
            if min_:
                res += float(min_) / 60
            if sec:
                res += float(sec) / 3600

            if dir_.upper() in ["S", "W"]:
                res = -res
        else:
            raise ValueError(
                "Unable to convert degrees/minutes/seconds to float"
            ) from exc

    if limit is not None:
        if res > limit:
            res = limit
        elif res < -limit:
            res = -limit

    return res


def hours_to_time(value: float) -> datetime.time:
    """Convert a floating point number of hours to a datetime.time"""

    hour = int(value)
    value -= hour
    value *= 60
    minute = int(value)
    value -= minute
    value *= 60
    second = int(value)
    value -= second
    microsecond = int(value * 1000000)

    return datetime.time(hour, minute, second, microsecond)


def time_to_hours(value: datetime.time) -> float:
    """Convert a datetime.time to a floating point number of hours"""

    hours = 0.0
    hours += value.hour
    hours += value.minute / 60
    hours += value.second / 3600
    hours += value.microsecond / 1000000

    return hours


def time_to_seconds(value: datetime.time) -> float:
    """Convert a datetime.time to a floating point number of seconds"""

    hours = time_to_hours(value)
    return hours * 3600


def refraction_at_zenith(zenith: float) -> float:
    """Calculate the degrees of refraction of the sun due to the sun's elevation."""

    elevation = 90 - zenith
    if elevation >= 85.0:
        return 0

    refraction_correction = 0.0
    te = tan(radians(elevation))
    if elevation > 5.0:
        refraction_correction = (
            58.1 / te - 0.07 / (te * te * te) + 0.000086 / (te * te * te * te * te)
        )
    elif elevation > -0.575:
        step1 = -12.79 + elevation * 0.711
        step2 = 103.4 + elevation * step1
        step3 = -518.2 + elevation * step2
        refraction_correction = 1735.0 + elevation * step3
    else:
        refraction_correction = -20.774 / te

    refraction_correction = refraction_correction / 3600.0

    return refraction_correction


class Depression(Enum):
    """The depression angle in degrees for the dawn/dusk calculations"""

    CIVIL = 6
    NAUTICAL = 12
    ASTRONOMICAL = 18


class SunDirection(Enum):
    """Direction of the sun either RISING or SETTING"""

    RISING = 1
    SETTING = -1


@dataclass
class AstralBodyPosition:
    """The position of an astral body as seen from earth"""

    right_ascension: Radians = field(default_factory=float)
    declination: Radians = field(default_factory=float)
    distance: Radians = field(default_factory=float)


@dataclass
class Observer:
    """Defines the location of an observer on Earth.

    Latitude and longitude can be set either as a float or as a string.
    For strings they must be of the form

        degrees°minutes'seconds"[N|S|E|W] e.g. 51°31'N

    `minutes’` & `seconds”` are optional.

    Elevations are either

    * A float that is the elevation in metres above a location, if the nearest
      obscuring feature is the horizon
    * or a tuple of the elevation in metres and the distance in metres to the
      nearest obscuring feature.

    Args:
        latitude:   Latitude - Northern latitudes should be positive
        longitude:  Longitude - Eastern longitudes should be positive
        elevation:  Elevation and/or distance to nearest obscuring feature
                    in metres above/below the location.
    """

    latitude: Degrees = 51.4733
    longitude: Degrees = -0.0008333
    elevation: Elevation = 0.0

    def __setattr__(self, name: str, value: Union[str, float, Elevation]):
        if name == "latitude":
            value = dms_to_float(value, 90.0)
        elif name == "longitude":
            value = dms_to_float(value, 180.0)
        elif name == "elevation":
            if isinstance(value, tuple):
                value = (float(value[0]), float(value[1]))
            else:
                value = float(value)
        super().__setattr__(name, value)


@dataclass
class LocationInfo:
    """Defines a location on Earth.

    Latitude and longitude can be set either as a float or as a string.
    For strings they must be of the form

        degrees°minutes'seconds"[N|S|E|W] e.g. 51°31'N

    `minutes’` & `seconds”` are optional.

    Args:
        name:       Location name (can be any string)
        region:     Region location is in (can be any string)
        timezone:   The location's time zone (a list of time zone names can be
                    obtained from `zoneinfo.available_timezones`)
        latitude:   Latitude - Northern latitudes should be positive
        longitude:  Longitude - Eastern longitudes should be positive
    """

    name: str = "Greenwich"
    region: str = "England"
    timezone: str = "Europe/London"
    latitude: Degrees = 51.4733
    longitude: Degrees = -0.0008333

    def __setattr__(self, name: str, value: Union[Degrees, str]):
        if name == "latitude":
            value = dms_to_float(value, 90.0)
        elif name == "longitude":
            value = dms_to_float(value, 180.0)
        super().__setattr__(name, value)

    @property
    def observer(self):
        """Return an Observer at this location"""
        return Observer(self.latitude, self.longitude, 0.0)

    @property
    def tzinfo(self):  # type: ignore
        """Return a zoneinfo.ZoneInfo for this location"""
        return zoneinfo.ZoneInfo(self.timezone)  # type: ignore

    @property
    def timezone_group(self):
        """Return the group a timezone is in"""
        return self.timezone.split("/", maxsplit=1)[0]
