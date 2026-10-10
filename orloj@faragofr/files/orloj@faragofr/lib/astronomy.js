// Astronomy helpers. Meeus-style truncated formulas. Against Skyfield/DE421
// over 2026 the sky positions are within 0.8 arcminutes for the Sun, 0.17°
// for the Moon and 0.14° for the planets. Plenty for a clock face.
//
// Rise/set times are a harsher test of the same series, because near the
// horizon an angular error buys time in proportion to how obliquely the body
// meets it. Checked against Skyfield/DE421 over 8 sites x 24 dates: sunrise
// and sunset land within 11 seconds everywhere, moonrise and moonset within
// 14 seconds at the median and 3.5 minutes at worst. See nextMoonEvent.
//
// Conventions:
//   * All exported longitude-like angles are in degrees, normalized to [0, 360).
//     moonLatitude is the exception (returns signed degrees).
//   * All times are JS Date objects (UTC internally) unless noted.
//   * Latitudes north positive, longitudes east positive.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

var norm360 = function(a) {
    a = a % 360;
    return a < 0 ? a + 360 : a;
};

var julianDay = function(date) {
    return date.getTime() / 86400000 + 2440587.5;
};

var centuriesSinceJ2000 = function(jd) {
    return (jd - 2451545.0) / 36525;
};

// Mean obliquity of the ecliptic (Meeus Ch. 21, eq. 21.2).
var obliquity = function(jd) {
    var t = centuriesSinceJ2000(jd);
    return 23.43929111 - 0.0130041667*t - 1.64e-7*t*t + 5.04e-7*t*t*t;
};

// Sun ecliptic longitude wrt mean equinox (Meeus Ch. 24). Used as true
// longitude since difference is negligible on a clock face.
var sunLongitude = function(jd) {
    var t = centuriesSinceJ2000(jd);
    var L0 = norm360(280.46645 + 36000.76983*t + 0.0003032*t*t);
    var M  = norm360(357.52910 + 35999.05030*t - 0.0001559*t*t);
    var Mr = M * D2R;
    var C = (1.914600 - 0.004817*t - 0.000014*t*t) * Math.sin(Mr)
          + (0.019993 - 0.000101*t)              * Math.sin(2*Mr)
          +  0.000290                            * Math.sin(3*Mr);
    return norm360(L0 + C);
};

// Greenwich Mean Sidereal Time, degrees (Meeus 11.4).
var gmst = function(jd) {
    var t = centuriesSinceJ2000(jd);
    var theta = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
              + 0.000387933 * t * t - (t*t*t) / 38710000;
    return norm360(theta);
};

// Local Mean Sidereal Time, degrees.
var lmst = function(jd, longitudeDeg) {
    return norm360(gmst(jd) + longitudeDeg);
};

// Moon ecliptic longitude — Meeus Ch. 45, top 13 periodic terms,
// ignoring earth eccentricity, flattening, Jupiter and Venus effects.
// Within 0.08° of DE421 over 2026, invisible at clock-face scale.
var moonLongitude = function(jd) {
    var t  = centuriesSinceJ2000(jd);
    var t2 = t*t, t3 = t2*t, t4 = t3*t;
    var L  = norm360(218.3164591 + 481267.88134236*t - 0.0013268*t2 + t3/538841 - t4/65194000);
    var D  = norm360(297.8502042 + 445267.1115168 *t - 0.0016300*t2 + t3/545868 - t4/113065000) * D2R;
    var M  = norm360(357.5291092 +  35999.0502909 *t - 0.0001536*t2 + t3/24490000) * D2R;
    var Mp = norm360(134.9634114 + 477198.8676313 *t + 0.0089970*t2 + t3/69699 - t4/14712000) * D2R;
    var F  = norm360( 93.2720993 + 483202.0175273 *t - 0.0034029*t2 - t3/3526000 + t4/863310000) * D2R;

    var dL = 6288774 * Math.sin(Mp)
           + 1274027 * Math.sin(2*D - Mp)
           +  658314 * Math.sin(2*D)
           +  213618 * Math.sin(2*Mp)
           -  185116 * Math.sin(M)
           -  114332 * Math.sin(2*F)
           +   58793 * Math.sin(2*D - 2*Mp)
           +   57066 * Math.sin(2*D - M - Mp)
           +   53322 * Math.sin(2*D + Mp)
           +   45758 * Math.sin(2*D - M)
           -   40923 * Math.sin(M - Mp)
           -   34720 * Math.sin(D)
           -   30383 * Math.sin(M + Mp);

    return norm360(L + dL * 1e-6);
};

// Moon ecliptic latitude (degrees) — Meeus Ch. 45, top 4 terms,
// ignoring earth eccentricity, flattening, Jupiter and Venus effects.
// Within 0.17° of DE421 over 2026.
var moonLatitude = function(jd) {
    var t  = centuriesSinceJ2000(jd);
    var t2 = t*t, t3 = t2*t, t4 = t3*t;
    var D  = norm360(297.8502042 + 445267.1115168 *t - 0.0016300*t2 + t3/545868 - t4/113065000) * D2R;
    var Mp = norm360(134.9634114 + 477198.8676313 *t + 0.0089970*t2 + t3/69699 - t4/14712000) * D2R;
    var F  = norm360( 93.2720993 + 483202.0175273 *t - 0.0034029*t2 - t3/3526000 + t4/863310000) * D2R;
    var dB = 5128122 * Math.sin(F)
           +  280602 * Math.sin(Mp + F)
           +  277693 * Math.sin(Mp - F)
           +  173237 * Math.sin(2*D - F);
    return dB * 1e-6;
};

// Moon phase angle (Sun→Moon elongation): 0 = new, 90 = first quarter,
// 180 = full, 270 = last quarter.
var moonPhase = function(jd) {
    return norm360(moonLongitude(jd) - sunLongitude(jd));
};


// Equation of time, in minutes (apparent − mean solar time) (Meeus eq. 27.3).
// Truncated to leading terms (up to y² and e²).
var equationOfTime = function(jd) {
    var t = centuriesSinceJ2000(jd);
    var eps = obliquity(jd) * D2R;
    var L0  = (280.46645 + 36000.76983*t) * D2R;
    var e   = 0.016708617 - 0.000042037*t;
    var M   = (357.52910 + 35999.05030*t) * D2R;
    var y = Math.pow(Math.tan(eps/2), 2);
    var Etime = y*Math.sin(2*L0)
              - 2*e*Math.sin(M)
              + 4*e*y*Math.sin(M)*Math.cos(2*L0)
              - 0.5*y*y*Math.sin(4*L0)
              - 1.25*e*e*Math.sin(2*M);
    return Etime * R2D * 4;
};

// Standard altitude of the sun's centre at rise/set: refraction plus the
// apparent semi-diameter (Meeus Ch. 15).
var SUN_H0 = -0.833;

// The same for a planet: a point source with negligible parallax, so the
// horizon refraction alone (Meeus Ch. 15). The planets' altitudes are
// geometric, and this is where they appear on the horizon.
var PLANET_H0 = -0.5667;

// Solar hour angle (degrees) at SUN_H0 for the given latitude, or null when
// the sun stays entirely above or below that altitude all day. The polar
// flags are what nextSunEvent uses to tell a real sunrise from the artefact
// of tabulating events by UTC day.
var sunHourAngle = function(jd, lat) {
    var lambda = sunLongitude(jd) * D2R;
    var eps    = obliquity(jd)    * D2R;
    var dec    = Math.asin(Math.sin(eps) * Math.sin(lambda));
    var latR   = lat * D2R;

    var cosH = (Math.sin(SUN_H0 * D2R) - Math.sin(latR) * Math.sin(dec))
             / (Math.cos(latR) * Math.cos(dec));
    if (cosH > 1)  return { H: null, alwaysDown: true };
    if (cosH < -1) return { H: null, alwaysUp:   true };
    return { H: Math.acos(cosH) * R2D, alwaysDown: false, alwaysUp: false };
};

// Sunrise / sunset for the UTC date of `date`.
// Returns { rise: Date, set: Date, alwaysUp, alwaysDown }; either time is null
// on a day the sun does not reach SUN_H0 going that way at that latitude.
//
// Note: uses UTC date, which can differ from the observer's local date (for
// several hours a day at western longitudes). The nextSunEvent scanner
// compensates by starting before the observer's day and filtering with > now.
var sunriseSunset = function(date, lat, lon) {
    var d0 = new Date(Date.UTC(date.getUTCFullYear(),
                               date.getUTCMonth(),
                               date.getUTCDate()));
    var jd0 = julianDay(d0);

    // UT minutes from d0 of local solar noon.
    var noonMin = function(jd) { return 720 - 4 * lon - equationOfTime(jd); };

    // UT minutes from d0 of the event `sign` places either side of solar noon
    // (-1 rise, +1 set), or null if the sun does not reach SUN_H0 there.
    //
    // Declination and the equation of time both move over a day, so reading
    // them at a fixed hour puts the event out by half a minute typically and
    // by 8 at 78°N. Meeus Ch. 15 answers that by re-evaluating both at the
    // approximate event time; the correction shrinks by a factor of ~300 per
    // pass, so three is well past convergence from any starting guess.
    //
    // The guess is solar midnight rather than 0h UT, because that is where a
    // marginal event sits: as the hour angle approaches 180° both rise and set
    // collapse onto it. Judging the day at the hour the event would actually
    // happen is what keeps the last day of midnight sun — which still reads as
    // polar at 0h UT, hours before its first sunset — from being written off.
    var solve = function(sign) {
        var minutes = noonMin(jd0) + sign * 720;
        for (var i = 0; i < 3; i++) {
            var jd = jd0 + minutes / 1440;
            var hh = sunHourAngle(jd, lat);
            if (hh.H === null) return null;
            minutes = noonMin(jd) + sign * 4 * hh.H;
        }
        return minutes;
    };

    var riseMin = solve(-1), setMin = solve(+1);
    if (riseMin === null && setMin === null) {
        // Neither probe found a crossing: a full polar day or night. Which one
        // is read at solar noon, the hour that settles it.
        var atNoon = sunHourAngle(jd0 + noonMin(jd0) / 1440, lat);
        return { rise: null, set: null,
                 alwaysUp:   atNoon.alwaysUp,
                 alwaysDown: atNoon.alwaysDown };
    }
    return {
        rise: riseMin === null ? null : new Date(d0.getTime() + riseMin * 60000),
        set:  setMin  === null ? null : new Date(d0.getTime() + setMin  * 60000),
        alwaysUp: false, alwaysDown: false
    };
};

// --- Planets (Mercury–Saturn) ----------------------------------------------
//
// Schlyter's truncated orbital elements (stjarnhimlen.se/comp/ppcomp.html),
// without his perturbation terms for Jupiter and Saturn. Against
// Skyfield/DE421 over 2026 the geocentric direction is within 0.03° for
// Mercury to Jupiter and 0.14° for Saturn. Further from the present the
// missing terms show: at 2149, Saturn's longitude is 0.67° out.
// Day count `d` is days since 1999-12-31 00:00 UT, i.e. JD - 2451543.5.

var PLANET_ELEMENTS = {
    Mercury: { N0:  48.3313, Nd: 3.24587e-5, i0: 7.0047, id:  5.00e-8,
               w0:  29.1241, wd: 1.01444e-5, a: 0.387098,
               e0:  0.205635, ed:  5.59e-10, M0: 168.6562, Md: 4.0923344368 },
    Venus:   { N0:  76.6799, Nd: 2.46590e-5, i0: 3.3946, id:  2.75e-8,
               w0:  54.8910, wd: 1.38374e-5, a: 0.723330,
               e0:  0.006773, ed: -1.302e-9, M0:  48.0052, Md: 1.6021302244 },
    Mars:    { N0:  49.5574, Nd: 2.11081e-5, i0: 1.8497, id: -1.78e-8,
               w0: 286.5016, wd: 2.92961e-5, a: 1.523688,
               e0:  0.093405, ed:  2.516e-9, M0:  18.6021, Md: 0.5240207766 },
    Jupiter: { N0: 100.4542, Nd: 2.76854e-5, i0: 1.3030, id: -1.557e-7,
               w0: 273.8777, wd: 1.64505e-5, a: 5.20256,
               e0:  0.048498, ed:  4.469e-9, M0:  19.8950, Md: 0.0830853001 },
    Saturn:  { N0: 113.6634, Nd: 2.38980e-5, i0: 2.4886, id: -1.081e-7,
               w0: 339.3939, wd: 2.97661e-5, a: 9.55475,
               e0:  0.055546, ed: -9.499e-9, M0: 316.9670, Md: 0.0334442282 }
};

// Schlyter publishes these as the orbital elements of the *Sun's apparent
// orbit around Earth* — same orbit shape as Earth's heliocentric orbit, but
// perihelion direction flipped 180°. Running heliocentric() on these returns
// the Sun's geocentric position (negate for Earth's true heliocentric).
var SUN_ELEMENTS = {
    N0: 0,        Nd: 0,           i0: 0,    id: 0,
    w0: 282.9404, wd: 4.70935e-5,  a: 1.000000,
    e0: 0.016709, ed: -1.151e-9,
    M0: 356.0470, Md: 0.9856002585
};

var PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

var schlyterDay = function(jd) {
    return jd - 2451543.5;
};

// Newton-Raphson solver for Kepler's equation (initial guess from
// Paul Schlyter, stjarnhimlen.se/comp/ppcomp.html).
var solveKepler = function(M_deg, e) {
    var M = M_deg * D2R;
    var E = M + e * Math.sin(M) * (1.0 + e * Math.cos(M));
    for (var k = 0; k < 12; k++) {
        var dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= dE;
        if (Math.abs(dE) < 1e-9) break;
    }
    return E;
};

var heliocentric = function(elems, d) {
    var N = (elems.N0 + elems.Nd * d) * D2R;
    var i = (elems.i0 + elems.id * d) * D2R;
    var w = (elems.w0 + elems.wd * d) * D2R;
    var a =  elems.a;
    var e =  elems.e0 + elems.ed * d;
    var M =  elems.M0 + elems.Md * d;

    var E  = solveKepler(M, e);
    var xv = a * (Math.cos(E) - e);
    var yv = a * Math.sqrt(1 - e*e) * Math.sin(E);
    var v  = Math.atan2(yv, xv);
    var r  = Math.sqrt(xv*xv + yv*yv);
    var vw = v + w;

    return {
        x: r * (Math.cos(N) * Math.cos(vw) - Math.sin(N) * Math.sin(vw) * Math.cos(i)),
        y: r * (Math.sin(N) * Math.cos(vw) + Math.cos(N) * Math.sin(vw) * Math.cos(i)),
        z: r * (Math.sin(vw) * Math.sin(i))
    };
};

// Geocentric ecliptic { lon, lat } of each planet, degrees. The latitude is
// not a refinement: Venus reaches 7.6° off the ecliptic, Mercury 4.9°, so
// placing a planet on the ecliptic misplaces it on the sky by that much.
var planetPositions = function(jd) {
    var d = schlyterDay(jd);
    var sunGeo = heliocentric(SUN_ELEMENTS, d);
    var earthHelio = { x: -sunGeo.x, y: -sunGeo.y, z: -sunGeo.z };
    var out = {};
    for (var k = 0; k < PLANETS.length; k++) {
        var name = PLANETS[k];
        var p = heliocentric(PLANET_ELEMENTS[name], d);
        var x = p.x - earthHelio.x, y = p.y - earthHelio.y, z = p.z - earthHelio.z;
        out[name] = { lon: norm360(Math.atan2(y, x) * R2D),
                      lat: Math.atan2(z, Math.sqrt(x*x + y*y)) * R2D };
    }
    return out;
};

// Ecliptic to equatorial conversion. Returns { ra, dec } in degrees,
// ra normalized to [0, 360). lonEcl, latEcl in degrees (geocentric).
var eclipticToEquatorial = function(lonEcl, latEcl, jd) {
    var lon = lonEcl * D2R;
    var bet = latEcl * D2R;
    var eps = obliquity(jd) * D2R;

    var sinDec = Math.sin(bet) * Math.cos(eps)
               + Math.cos(bet) * Math.sin(eps) * Math.sin(lon);
    var ra  = Math.atan2(
                  Math.sin(lon) * Math.cos(eps) - Math.tan(bet) * Math.sin(eps),
                  Math.cos(lon));

    return { ra: norm360(ra * R2D), dec: Math.asin(sinDec) * R2D };
};

// Altitude (deg) of a body at declination `decDeg` seen at hour angle `HDeg`
// from latitude `latDeg`. Geometric: no refraction, no parallax.
//
// This takes the hour angle rather than a time, so it also answers "where
// would the body be at hour angle H" for an H that is not now — which is what
// the dial's hour ring needs to draw a whole day's worth of sun. The clamp
// guards against floating-point overshoot at the poles, where the sum can
// exceed 1 by an ulp and turn asin into NaN.
var altitude = function(latDeg, decDeg, HDeg) {
    var latR = latDeg * D2R, decR = decDeg * D2R, H = HDeg * D2R;
    var sinAlt = Math.sin(latR) * Math.sin(decR)
               + Math.cos(latR) * Math.cos(decR) * Math.cos(H);
    return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * R2D;
};

// Apparent altitude (deg) of any body at the given ecliptic coords, for
// observer at latObs / lonObs. lonEcl, latEcl in degrees (geocentric).
var apparentAltitude = function(jd, lonEcl, latEcl, latObs, lonObs) {
    var eq = eclipticToEquatorial(lonEcl, latEcl, jd);
    return altitude(latObs, eq.dec, lmst(jd, lonObs) - eq.ra);
};

// Apparent altitude of the moon (degrees) — convenience wrapper using the
// moon's full ecliptic position.
var moonAltitude = function(date, lat, lonObs) {
    var jd = julianDay(date);
    return apparentAltitude(jd, moonLongitude(jd), moonLatitude(jd), lat, lonObs);
};

// Next sunrise or sunset after `now` for the observer at lat/lon.
// Returns { type: "rise" | "set", time: Date } or null if no event in 7 days.
//
// The scan starts two UTC days back for two reasons. sunriseSunset() tables
// events by UTC date, so west of Greenwich the remainder of the observer's
// local day (e.g. tonight's sunset once UTC has passed midnight) lives in an
// earlier UTC day's entry; the > now filter discards what is already past.
// And the extra day gives every candidate a predecessor to test against.
//
// That predecessor is what keeps a polar transition honest. On the day
// midnight sun ends, the tabulated "rise" never happens — the sun has been up
// continuously and the first real event is that day's set. `prev` carries the
// day before's polar state so such a rise can be skipped, and a set skipped
// symmetrically at the end of polar night.
var nextSunEvent = function(now, lat, lon) {
    var prev = null;
    for (var dayOffset = -2; dayOffset < 7; dayOffset++) {
        var d  = new Date(now.getTime() + dayOffset * 86400000);
        var ss = sunriseSunset(d, lat, lon);
        if (!(prev && prev.alwaysUp) && ss.rise && ss.rise > now)
            return { type: "rise", time: ss.rise };
        if (!(prev && prev.alwaysDown) && ss.set && ss.set > now)
            return { type: "set", time: ss.set };
        prev = ss;
    }
    return null;
};

// The moon's mean equatorial horizontal parallax, asin(6378.14 / 384400 km)
// — Earth's equatorial radius over the moon's mean distance. The true value
// runs from about 0.90° at apogee to 1.01° at perigee.
var MOON_PARALLAX = 0.9507;

// Standard altitude of the moon's centre at rise/set (Meeus Ch. 15):
// 0.7275·π − 0.5667°, with π = MOON_PARALLAX, which comes to 0.125°. It folds
// parallax, semi-diameter and refraction into one threshold on the
// *geocentric* altitude that moonAltitude() returns — parallax dominates, and
// it is what makes the figure positive rather than the −0.567° that applies
// to a body with no appreciable parallax.
var MOON_H0 = 0.7275 * MOON_PARALLAX - 0.5667;

// Topocentric (observer's) altitude of the moon from its geocentric one,
// both geometric. Seen from the surface rather than Earth's centre the moon
// sits lower by the parallax in altitude p, with
// tan p = sin π cos h / (1 − sin π sin h): about π at the horizon, nothing
// overhead. Using the mean π puts the result within 0.06° of the exact value;
// a spherical Earth adds less than that.
var moonTopocentricAltitude = function(geoAltDeg) {
    var h  = geoAltDeg * D2R;
    var sp = Math.sin(MOON_PARALLAX * D2R);
    return geoAltDeg - Math.atan2(sp * Math.cos(h), 1 - sp * Math.sin(h)) * R2D;
};

// Next moonrise or moonset after `now`. Samples the altitude every 10 minutes
// for 25 hours, then bisects the first crossing of MOON_H0.
// Returns { type: "rise" | "set", time: Date }, or null when the moon does not
// cross the horizon in that window (it is circumpolar, or stays down).
//
// Accuracy is set by moonLongitude/moonLatitude, not by the bisection. Against
// Skyfield/DE421 the median event is 14 seconds out and the mean 23; the tail
// runs to 3.5 minutes at 64°N, because the shallower the angle at which the
// moon meets the horizon, the more time a given angular error buys. At high
// latitudes a marginal crossing can also be missed altogether, or found where
// the true moon has none, though the test grid contains no such case.
var nextMoonEvent = function(now, lat, lonObs) {
    var stepMs  = 10 * 60 * 1000;
    var prevAlt = moonAltitude(now, lat, lonObs);
    for (var i = 1; i <= 150; i++) {
        var t   = new Date(now.getTime() + i * stepMs);
        var alt = moonAltitude(t, lat, lonObs);
        if ((prevAlt - MOON_H0) * (alt - MOON_H0) < 0) {
            var lo = new Date(t.getTime() - stepMs);
            var hi = t;
            var loAlt = prevAlt;
            for (var j = 0; j < 18; j++) {
                var mid    = new Date((lo.getTime() + hi.getTime()) / 2);
                var midAlt = moonAltitude(mid, lat, lonObs);
                if ((loAlt - MOON_H0) * (midAlt - MOON_H0) < 0) {
                    hi = mid;
                } else {
                    lo = mid; loAlt = midAlt;
                }
            }
            var crossing = new Date((lo.getTime() + hi.getTime()) / 2);
            return { type: alt > prevAlt ? "rise" : "set", time: crossing };
        }
        prevAlt = alt;
    }
    return null;
};
