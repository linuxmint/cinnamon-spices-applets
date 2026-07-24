/**
 * A minified and optimized version of the SunCalc library containing only the part needed for the `auto-dark-light` applet.
 */

/*
LICENSE

Copyright (c) 2014, Vladimir Agafonkin
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this list of
      conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice, this list
      of conditions and the following disclaimer in the documentation and/or other materials
      provided with the distribution

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*
(c) 2011-2015, Vladimir Agafonkin
SunCalc is a JavaScript library for calculating sun/moon position and light phases.
https://github.com/mourner/suncalc
*/

const { PI, sin, cos, asin, acos, round } = Math;
const TWO_PI = 2 * PI;
const RADIANS_PER_DEGREE = PI / 180;
const SECONDS_PER_DAY = 60 * 60 * 24;
const J0 = 0.0009;
const J1970 = 2_440_587.5;
const J2000 = 2_451_545;

/** @returns (seconds) */
function _to_unix(julian_date: number) {
    return (julian_date - J1970) * SECONDS_PER_DAY;
}

function _approximate_transit(Ht: number, lw: number, n: number): number {
    return J0 + (Ht + lw) / TWO_PI + n;
}

function _solar_transit(ds: number, M: number, L: number): number {
    return J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L);
}

const EARTH_OBLIQUITY = RADIANS_PER_DEGREE * 23.4397;
const SIN_OF_EARTH_OBLIQUITY = sin(EARTH_OBLIQUITY);
const EARTH_PERIHELION_PLUS_PI = RADIANS_PER_DEGREE * 102.9372 + PI;
const J1970_MINUS_J2000 = J1970 - J2000;

/**
 * Calculates the sunrise and sunset times for a given date and location.
 * @param unix_time - seconds (s)
 * @param latitude - degrees (°)
 * @param longitude - degrees (°)
 * @returns Unix time, seconds (s)
 */
export function compute_twilights(
    unix_time: number, latitude: number, longitude: number
): [sunrise: number, sunset: number] {
    const lw = RADIANS_PER_DEGREE * -longitude;
    const phi = RADIANS_PER_DEGREE * latitude;
    const d = unix_time / SECONDS_PER_DAY + J1970_MINUS_J2000; // Julian date
    const n = round(d - J0 - lw / TWO_PI); // "Julian cycle"
    const ds = _approximate_transit(0, lw, n);
    const M = RADIANS_PER_DEGREE * (0.98560028 * ds + 357.5291); // Solar mean anomaly
    const center = RADIANS_PER_DEGREE * (
        1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)
    );
    const L = M + center + EARTH_PERIHELION_PLUS_PI; // Ecliptic longitude
    const dec = asin(SIN_OF_EARTH_OBLIQUITY * sin(L)); // Declination
    const julian_noon = _solar_transit(ds, M, L);
    const h0 = -0.833 * RADIANS_PER_DEGREE;
    const w = acos( // "hour angle"
        (sin(h0) - sin(phi) * sin(dec)) / (cos(phi) * cos(dec))
    );
    const a = _approximate_transit(w, lw, n);
    const julian_sunset = _solar_transit(a, M, L);
    const julian_sunrise = 2 * julian_noon - julian_sunset;
    return [
        _to_unix(julian_sunrise),
        _to_unix(julian_sunset)
    ];
}
