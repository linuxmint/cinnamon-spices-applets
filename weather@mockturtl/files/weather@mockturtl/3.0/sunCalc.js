var PI = Math.PI, sin = Math.sin, cos = Math.cos, tan = Math.tan, asin = Math.asin, atan = Math.atan2, acos = Math.acos, rad = PI / 180;
var dayMs = 1000 * 60 * 60 * 24, J1970 = 2440588, J2000 = 2451545;
function toJulian(date) { return date.valueOf() / dayMs - 0.5 + J1970; }
function fromJulian(j) { return new Date((j + 0.5 - J1970) * dayMs); }
function toDays(date) { return toJulian(date) - J2000; }
var e = rad * 23.4397;
function rightAscension(l, b) { return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l)); }
function declination(l, b) { return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l)); }
function azimuth(H, phi, dec) { return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi)); }
function altitude(H, phi, dec) { return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H)); }
function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }
function astroRefraction(h) {
    if (h < 0)
        h = 0;
    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
}
function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }
function eclipticLongitude(M) {
    var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)), P = rad * 102.9372;
    return M + C + P + PI;
}
function sunCoords(d) {
    var M = solarMeanAnomaly(d), L = eclipticLongitude(M);
    return {
        dec: declination(L, 0),
        ra: rightAscension(L, 0)
    };
}
var J0 = 0.0009;
function julianCycle(d, lw) { return Math.round(d - J0 - lw / (2 * PI)); }
function approxTransit(Ht, lw, n) { return J0 + (Ht + lw) / (2 * PI) + n; }
function solarTransitJ(ds, M, L) { return J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L); }
function hourAngle(h, phi, d) { return acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d))); }
function observerAngle(height) { return -2.076 * Math.sqrt(height) / 60; }
function getSetJ(h, lw, phi, dec, n, M, L) {
    var w = hourAngle(h, phi, dec), a = approxTransit(w, lw, n);
    return solarTransitJ(a, M, L);
}
function moonCoords(d) {
    var L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.229350 * d), l = L + rad * 6.289 * sin(M), b = rad * 5.128 * sin(F), dt = 385001 - 20905 * cos(M);
    return {
        ra: rightAscension(l, b),
        dec: declination(l, b),
        dist: dt
    };
}
function hoursLater(date, h) {
    return new Date(date.valueOf() + h * dayMs / 24);
}
var SunCalc = (function () {
    function SunCalc() {
        this.times = [
            [-0.833, 'sunrise', 'sunset'],
            [-0.3, 'sunriseEnd', 'sunsetStart'],
            [-6, 'dawn', 'dusk'],
            [-12, 'nauticalDawn', 'nauticalDusk'],
            [-18, 'nightEnd', 'night'],
            [6, 'goldenHourEnd', 'goldenHour']
        ];
        this.addTime = function (angle, riseName, setName) {
            this.times.push([angle, riseName, setName]);
        };
    }
    SunCalc.prototype.getPosition = function (date, lat, lng) {
        var lw = rad * -lng, phi = rad * lat, d = toDays(date), c = sunCoords(d), H = siderealTime(d, lw) - c.ra;
        return {
            azimuth: azimuth(H, phi, c.dec),
            altitude: altitude(H, phi, c.dec)
        };
    };
    SunCalc.prototype.getTimes = function (date, lat, lng, height) {
        height = height || 0;
        var lw = rad * -lng, phi = rad * lat, dh = observerAngle(height), d = toDays(date), n = julianCycle(d, lw), ds = approxTransit(0, lw, n), M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L, 0), Jnoon = solarTransitJ(ds, M, L), i, len, time, h0, Jset, Jrise;
        var result = {
            solarNoon: fromJulian(Jnoon),
            nadir: fromJulian(Jnoon - 0.5)
        };
        for (i = 0, len = this.times.length; i < len; i += 1) {
            time = this.times[i];
            h0 = (time[0] + dh) * rad;
            Jset = getSetJ(h0, lw, phi, dec, n, M, L);
            Jrise = Jnoon - (Jset - Jnoon);
            result[time[1]] = fromJulian(Jrise);
            result[time[2]] = fromJulian(Jset);
        }
        return result;
    };
    ;
    SunCalc.prototype.getMoonPosition = function (date, lat, lng) {
        var lw = rad * -lng, phi = rad * lat, d = toDays(date), c = moonCoords(d), H = siderealTime(d, lw) - c.ra, h = altitude(H, phi, c.dec), pa = atan(sin(H), tan(phi) * cos(c.dec) - sin(c.dec) * cos(H));
        h = h + astroRefraction(h);
        return {
            azimuth: azimuth(H, phi, c.dec),
            altitude: h,
            distance: c.dist,
            parallacticAngle: pa
        };
    };
    ;
    SunCalc.prototype.getMoonIllumination = function (date) {
        var d = toDays(date || new Date()), s = sunCoords(d), m = moonCoords(d), sdist = 149598000, phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra)), inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi)), angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) -
            cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));
        return {
            fraction: (1 + cos(inc)) / 2,
            phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI,
            angle: angle
        };
    };
    ;
    SunCalc.prototype.getMoonTimes = function (date, lat, lng, inUTC) {
        var t = new Date(date);
        if (inUTC)
            t.setUTCHours(0, 0, 0, 0);
        else
            t.setHours(0, 0, 0, 0);
        var hc = 0.133 * rad, h0 = this.getMoonPosition(t, lat, lng).altitude - hc, h1, h2, rise, set, a, b, xe, ye, d, roots, x1, x2, dx;
        for (var i = 1; i <= 24; i += 2) {
            h1 = this.getMoonPosition(hoursLater(t, i), lat, lng).altitude - hc;
            h2 = this.getMoonPosition(hoursLater(t, i + 1), lat, lng).altitude - hc;
            a = (h0 + h2) / 2 - h1;
            b = (h2 - h0) / 2;
            xe = -b / (2 * a);
            ye = (a * xe + b) * xe + h1;
            d = b * b - 4 * a * h1;
            roots = 0;
            if (d >= 0) {
                dx = Math.sqrt(d) / (Math.abs(a) * 2);
                x1 = xe - dx;
                x2 = xe + dx;
                if (Math.abs(x1) <= 1)
                    roots++;
                if (Math.abs(x2) <= 1)
                    roots++;
                if (x1 < -1)
                    x1 = x2;
            }
            if (roots === 1) {
                if (h0 < 0)
                    rise = i + x1;
                else
                    set = i + x1;
            }
            else if (roots === 2) {
                rise = i + (ye < 0 ? x2 : x1);
                set = i + (ye < 0 ? x1 : x2);
            }
            if (rise && set)
                break;
            h0 = h2;
        }
        var result = {};
        if (rise)
            result.rise = hoursLater(t, rise);
        if (set)
            result.set = hoursLater(t, set);
        if (!rise && !set)
            result[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;
        return result;
    };
    ;
    return SunCalc;
}());
