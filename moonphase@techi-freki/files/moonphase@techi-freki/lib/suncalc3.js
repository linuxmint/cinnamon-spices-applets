// @ts-check
/*
 (c) 2011-2015, Vladimir Agafonkin
 SunCalc is a JavaScript library for calculating sun/moon position and light phases.
 https://github.com/mourner/suncalc

 Reworked and enhanced by Robert Gester
 Additional Copyright (c) 2022 Robert Gester
 https://github.com/hypnos3/suncalc3
*/

/**
 * @typedef {Object} ISunTimeDef
 * @property {string} name - The Name of the time
 * @property {Date} value - Date object with the calculated sun-time
 * @property {number} ts - The time as timestamp
 * @property {number} pos - The position of the sun on the time
 * @property {number} [elevation] - Angle of the sun on the time (except for solarNoon / nadir)
 * @property {number} julian - The time as Julian calendar
 * @property {boolean} valid - indicates if the time is valid or not
 * @property {boolean} [deprecated] - indicates if the time is a deprecated time name
 * @property {string} [nameOrg] - if it is a deprecated name, the original property name
 * @property {number} [posOrg] - if it is a deprecated name, the original position
 */

/**
 * @typedef {Object} ISunTimeSingle
 * @property {ISunTimeDef} rise - sun-time for sun rise
 * @property {ISunTimeDef} set - sun-time for sun set
 * @property {string} [error] - string of an error message if an error occurs
 */

/**
 * @typedef {Object} ISunTimeList
 * @property {ISunTimeDef} solarNoon - The sun-time for the solar noon (sun is in the highest position)
 * @property {ISunTimeDef} nadir - The sun-time for nadir (darkest moment of the night, sun is in the lowest position)
 * @property {ISunTimeDef} goldenHourDawnStart - The sun-time for morning golden hour (soft light, best time for photography)
 * @property {ISunTimeDef} goldenHourDawnEnd - The sun-time for morning golden hour (soft light, best time for photography)
 * @property {ISunTimeDef} goldenHourDuskStart - The sun-time for evening golden hour starts
 * @property {ISunTimeDef} goldenHourDuskEnd - The sun-time for evening golden hour starts
 * @property {ISunTimeDef} sunriseStart - The sun-time for sunrise starts (top edge of the sun appears on the horizon)
 * @property {ISunTimeDef} sunriseEnd - The sun-time for sunrise ends (bottom edge of the sun touches the horizon)
 * @property {ISunTimeDef} sunsetStart - The sun-time for sunset starts (bottom edge of the sun touches the horizon)
 * @property {ISunTimeDef} sunsetEnd - The sun-time for sunset ends (sun disappears below the horizon, evening civil twilight starts)
 * @property {ISunTimeDef} blueHourDawnStart - The sun-time for blue Hour start (time for special photography photos starts)
 * @property {ISunTimeDef} blueHourDawnEnd - The sun-time for blue Hour end (time for special photography photos end)
 * @property {ISunTimeDef} blueHourDuskStart - The sun-time for blue Hour start (time for special photography photos starts)
 * @property {ISunTimeDef} blueHourDuskEnd - The sun-time for blue Hour end (time for special photography photos end)
 * @property {ISunTimeDef} civilDawn - The sun-time for dawn (morning nautical twilight ends, morning civil twilight starts)
 * @property {ISunTimeDef} civilDusk - The sun-time for dusk (evening nautical twilight starts)
 * @property {ISunTimeDef} nauticalDawn - The sun-time for nautical dawn (morning nautical twilight starts)
 * @property {ISunTimeDef} nauticalDusk - The sun-time for nautical dusk end (evening astronomical twilight starts)
 * @property {ISunTimeDef} amateurDawn - The sun-time for amateur astronomical dawn (sun at 12° before sunrise)
 * @property {ISunTimeDef} amateurDusk - The sun-time for amateur astronomical dusk (sun at 12° after sunrise)
 * @property {ISunTimeDef} astronomicalDawn - The sun-time for night ends (morning astronomical twilight starts)
 * @property {ISunTimeDef} astronomicalDusk - The sun-time for night starts (dark enough for astronomical observations)
 * @property {ISunTimeDef} [dawn] - Deprecated: alternate for civilDawn
 * @property {ISunTimeDef} [dusk] - Deprecated: alternate for civilDusk
 * @property {ISunTimeDef} [nightEnd] - Deprecated: alternate for astronomicalDawn
 * @property {ISunTimeDef} [night] - Deprecated: alternate for astronomicalDusk
 * @property {ISunTimeDef} [nightStart] - Deprecated: alternate for astronomicalDusk
 * @property {ISunTimeDef} [goldenHour] - Deprecated: alternate for goldenHourDuskStart
 * @property {ISunTimeDef} [sunset] - Deprecated: alternate for sunsetEnd
 * @property {ISunTimeDef} [sunrise] - Deprecated: alternate for sunriseStart
 * @property {ISunTimeDef} [goldenHourEnd] - Deprecated: alternate for goldenHourDawnEnd
 * @property {ISunTimeDef} [goldenHourStart] - Deprecated: alternate for goldenHourDuskStart
 */

/**
 * @typedef ISunTimeNames
 * @type {Object}
 * @property {number} angle     -   angle of the sun position in degrees
 * @property {string} riseName  -   name of sun rise (morning name)
 * @property {string} setName   -   name of sun set (evening name)
 * @property {number} [risePos] -   (optional) position at rise
 * @property {number} [setPos]  -   (optional) position at set
 */


/**
 * @typedef {Object} ISunCoordinates
 * @property {number} dec - The declination of the sun
 * @property {number} ra - The right ascension of the sun
 */

/**
 * @typedef {Object} ISunPosition
 * @property {number} azimuth - The azimuth above the horizon of the sun in radians
 * @property {number} altitude - The altitude of the sun in radians
 * @property {number} zenith - The zenith of the sun in radians
 * @property {number} azimuthDegrees - The azimuth of the sun in decimal degree
 * @property {number} altitudeDegrees - The altitude of the sun in decimal degree
 * @property {number} zenithDegrees - The zenith of the sun in decimal degree
 * @property {number} declination - The declination of the sun
 */

/**
 * @typedef {Object} IMoonPosition
 * @property {number} azimuth - The moon azimuth in radians
 * @property {number} altitude - The moon altitude above the horizon in radians
 * @property {number} azimuthDegrees - The moon azimuth in degree
 * @property {number} altitudeDegrees - The moon altitude above the horizon in degree
 * @property {number} distance - The distance of the moon to the earth in kilometers
 * @property {number} parallacticAngle - The parallactic angle of the moon
 * @property {number} parallacticAngleDegrees - The parallactic angle of the moon in degree
 */


/**
 * @typedef {Object} IDateObj
 * @property {string} date - The Date as a ISO String YYYY-MM-TTTHH:MM:SS.mmmmZ
 * @property {number} value - The Date as the milliseconds since 1.1.1970 0:00 UTC
 */

/**
 * @typedef {Object} IPhaseObj
 * @property {number} from - The phase start
 * @property {number} to - The phase end
 * @property {('newMoon'|'waxingCrescentMoon'|'firstQuarterMoon'|'waxingGibbousMoon'|'fullMoon'|'waningGibbousMoon'|'thirdQuarterMoon'|'waningCrescentMoon')} id - id of the phase
 * @property {string} emoji - unicode symbol of the phase
 * @property {string} name - name of the phase
 * @property {string} id - phase name
 * @property {number} weight - weight of the phase
 * @property {string} css - a css value of the phase
 * @property {string} [nameAlt] - an alernate name (not used by this library)
 * @property {string} [tag] - additional tag (not used by this library)
 */

/**
 * @typedef {Object} IMoonIlluminationNext
 * @property {string} date - The Date as a ISO String YYYY-MM-TTTHH:MM:SS.mmmmZ of the next phase
 * @property {number} value - The Date as the milliseconds since 1.1.1970 0:00 UTC of the next phase
 * @property {string} type - The name of the next phase [newMoon, fullMoon, firstQuarter, thirdQuarter]
 * @property {IDateObj} newMoon - Date of the next new moon
 * @property {IDateObj} fullMoon - Date of the next full moon
 * @property {IDateObj} firstQuarter - Date of the next first quater of the moon
 * @property {IDateObj} thirdQuarter - Date of the next third/last quater of the moon
 */

/**
 * @typedef {Object} IMoonIllumination
 * @property {number} fraction - illuminated fraction of the moon; varies from `0.0` (new moon) to `1.0` (full moon)
 * @property {IPhaseObj} phase - moon phase as object
 * @property {number} phaseValue - The phase of the moon in the current cycle; varies from `0.0` to `1.0`
 * @property {number} angle - The midpoint angle in radians of the illuminated limb of the moon reckoned eastward from the north point of the disk;
 * @property {IMoonIlluminationNext} next - object containing information about the next phases of the moon
 * @remarks the moon is waxing if the angle is negative, and waning if positive
 */

/**
 * @typedef {Object} IMoonDataInst
 * @property {number} zenithAngle - The zenith angle of the moon
 * @property {IMoonIllumination} illumination - object containing information about the next phases of the moon
 *
 * @typedef {IMoonPosition & IMoonDataInst} IMoonData
 */

/**
 * @typedef {Object} IMoonTimes
 * @property {Date|NaN} rise - a Date object if the moon is rising on the given Date, otherwise NaN
 * @property {Date|NaN} set - a Date object if the moon is setting on the given Date, otherwise NaN
 * @property {boolean} alwaysUp - is true if the moon never rises/sets and is always _above_ the horizon during the day
 * @property {boolean} alwaysDown - is true if the moon is always _below_ the horizon
 * @property {Date} [highest] - Date of the highest position, only avalílable if set and rise is not NaN
 */

(function () {
    'use strict';
    // sun calculations are based on http://aa.quae.nl/en/reken/zonpositie.html formulas

    // shortcuts for easier to read formulas
    const sin = Math.sin;
    const cos = Math.cos;
    const tan = Math.tan;
    const asin = Math.asin;
    const atan = Math.atan2;
    const acos = Math.acos;
    const rad = Math.PI / 180;
    const degr = 180 / Math.PI;

    // date/time constants and conversions
    const dayMs = 86400000; // 1000 * 60 * 60 * 24;
    const J1970 = 2440587.5;
    const J2000 = 2451545;

    const lunarDaysMs = 2551442778; // The duration in days of a lunar cycle is 29.53058770576
    const firstNewMoon2000 = 947178840000; // first newMoon in the year 2000 2000-01-06 18:14

    /**
     * convert date from Julian calendar
     * @param {number} j    -    day number in Julian calendar to convert
     * @return {number} result date as timestamp
     */
    function fromJulianDay(j) {
        return (j - J1970) * dayMs;
    }

    /**
     * get number of days for a dateValue since 2000
     * @param {number} dateValue date as timestamp to get days
     * @return {number} count of days
     */
    function toDays(dateValue) {
        return ((dateValue / dayMs) + J1970) - J2000;
    }

    // general calculations for position

    const e = rad * 23.4397; // obliquity of the Earth

    /**
     * get right ascension
     * @param {number} l
     * @param {number} b
     * @returns {number}
     */
    function rightAscension(l, b) {
        return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l));
    }

    /**
     * get declination
     * @param {number} l
     * @param {number} b
     * @returns {number}
     */
    function declination(l, b) {
        return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l));
    }

    /**
     * get azimuth
     * @param {number} H - siderealTime
     * @param {number} phi - PI constant
     * @param {number} dec - The declination of the sun
     * @returns {number} azimuth in rad
     */
    function azimuthCalc(H, phi, dec) {
        return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi)) + Math.PI;
    }

    /**
     * get altitude
     * @param {number} H - siderealTime
     * @param {number} phi - PI constant
     * @param {number} dec - The declination of the sun
     * @returns {number}
     */
    function altitudeCalc(H, phi, dec) {
        return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H));
    }

    /**
     * side real time
     * @param {number} d
     * @param {number} lw
     * @returns {number}
     */
    function siderealTime(d, lw) {
        return rad * (280.16 + 360.9856235 * d) - lw;
    }

    /**
     * get astro refraction
     * @param {number} h
     * @returns {number}
     */
    function astroRefraction(h) {
        if (h < 0) { // the following formula works for positive altitudes only.
            h = 0;
        } // if h = -0.08901179 a div/0 would occur.

        // formula 16.4 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
        // 1.02 / tan(h + 10.26 / (h + 5.10)) h in degrees, result in arc minutes -> converted to rad:
        return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
    }
    // general sun calculations
    /**
     * get solar mean anomaly
     * @param {number} d
     * @returns {number}
     */
    function solarMeanAnomaly(d) {
        return rad * (357.5291 + 0.98560028 * d);
    }

    /**
     * ecliptic longitude
     * @param {number} M
     * @returns {number}
     */
    function eclipticLongitude(M) {
        const C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M));
        // equation of center
        const P = rad * 102.9372; // perihelion of the Earth
        return M + C + P + Math.PI;
    }

    /**
     * sun coordinates
     * @param {number} d days in Julian calendar
     * @returns {ISunCoordinates}
     */
    function sunCoords(d) {
        const M = solarMeanAnomaly(d);
        const L = eclipticLongitude(M);

        return {
            dec: declination(L, 0),
            ra: rightAscension(L, 0)
        };
    }

    const SunCalc = {};

    /**
     * calculates sun position for a given date and latitude/longitude
     * @param {number|Date} dateValue Date object or timestamp for calculating sun-position
     * @param {number} lat latitude for calculating sun-position
     * @param {number} lng longitude for calculating sun-position
     * @return {ISunPosition} result object of sun-position
     */
    SunCalc.getPosition = function (dateValue, lat, lng) {
        // console.log(`getPosition dateValue=${dateValue}  lat=${lat}, lng=${lng}`);
        if (isNaN(lat)) {
            throw new Error('latitude missing');
        }
        if (isNaN(lng)) {
            throw new Error('longitude missing');
        }
        if (dateValue instanceof Date) {
            dateValue = dateValue.valueOf();
        }
        const lw = rad * -lng;
        const phi = rad * lat;
        const d = toDays(dateValue);
        const c = sunCoords(d);
        const H = siderealTime(d, lw) - c.ra;
        const azimuth = azimuthCalc(H, phi, c.dec);
        const altitude = altitudeCalc(H, phi, c.dec);
        // console.log(`getPosition date=${date}, M=${H}, L=${H}, c=${JSON.stringify(c)}, d=${d}, lw=${lw}, phi=${phi}`);

        return {
            azimuth,
            altitude,
            zenith: (90*Math.PI/180) - altitude,
            azimuthDegrees: degr * azimuth,
            altitudeDegrees: degr * altitude,
            zenithDegrees: 90 - (degr * altitude),
            declination: c.dec
        };
    };

    /** sun times configuration
     * @type {Array.<ISunTimeNames>}
     */
    const sunTimes = SunCalc.times = [
        { angle: 6, riseName: 'goldenHourDawnEnd', setName: 'goldenHourDuskStart'}, // GOLDEN_HOUR_2
        { angle: -0.3, riseName: 'sunriseEnd', setName: 'sunsetStart'}, // SUNRISE_END
        { angle: -0.833, riseName: 'sunriseStart', setName: 'sunsetEnd'}, // SUNRISE
        { angle: -1, riseName: 'goldenHourDawnStart', setName: 'goldenHourDuskEnd'}, // GOLDEN_HOUR_1
        { angle: -4, riseName: 'blueHourDawnEnd', setName: 'blueHourDuskStart'}, // BLUE_HOUR
        { angle: -6, riseName: 'civilDawn', setName: 'civilDusk'}, // DAWN
        { angle: -8, riseName: 'blueHourDawnStart', setName: 'blueHourDuskEnd'}, // BLUE_HOUR
        { angle: -12, riseName: 'nauticalDawn', setName: 'nauticalDusk'}, // NAUTIC_DAWN
        { angle: -15, riseName: 'amateurDawn', setName: 'amateurDusk'},
        { angle: -18, riseName: 'astronomicalDawn', setName: 'astronomicalDusk'} // ASTRO_DAWN
    ];

    /** alternate time names for backward compatibility
     * @type {Array.<[string, string]>}
     */
    const suntimesDeprecated = SunCalc.timesDeprecated = [
        ['dawn', 'civilDawn'],
        ['dusk', 'civilDusk'],
        ['nightEnd', 'astronomicalDawn'],
        ['night', 'astronomicalDusk'],
        ['nightStart', 'astronomicalDusk'],
        ['goldenHour', 'goldenHourDuskStart'],
        ['sunrise', 'sunriseStart'],
        ['sunset', 'sunsetEnd'],
        ['goldenHourEnd', 'goldenHourDawnEnd'],
        ['goldenHourStart', 'goldenHourDuskStart']
    ];

    /** adds a custom time to the times config
     * @param {number} angleAltitude - angle of Altitude/elevation above the horizont of the sun in degrees
     * @param {string} riseName - name of sun rise (morning name)
     * @param {string} setName  - name of sun set (evening name)
     * @param {number} [risePos]  - (optional) position at rise (morning)
     * @param {number} [setPos]  - (optional) position at set (evening)
     * @param {boolean} [degree=true] defines if the elevationAngle is in degree not in radians
     * @return {Boolean} true if new time could be added, false if not (parameter missing; riseName or setName already existing)
     */
    SunCalc.addTime = function (angleAltitude, riseName, setName, risePos, setPos, degree) {
        let isValid = (typeof riseName === 'string') && (riseName.length > 0) &&
            (typeof setName === 'string') && (setName.length > 0) &&
            (typeof angleAltitude === 'number');
        if (isValid) {
            const EXP = /^(?![0-9])[a-zA-Z0-9$_]+$/;
            // check for invalid names
            for (let i=0; i<sunTimes.length; ++i) {
                if (!EXP.test(riseName) ||
                    riseName === sunTimes[i].riseName ||
                    riseName === sunTimes[i].setName) {
                    isValid = false;
                    break;
                }
                if (!EXP.test(setName) ||
                    setName === sunTimes[i].riseName ||
                    setName === sunTimes[i].setName) {
                    isValid = false;
                    break;
                }
            }
            if (isValid) {
                const angleDeg = (degree === false ?  (angleAltitude  * ( 180 / Math.PI )) : angleAltitude);
                sunTimes.push({angle: angleDeg, riseName, setName, risePos, setPos});
                for (let i = suntimesDeprecated.length -1; i >= 0; i--) {
                    if (suntimesDeprecated[i][0] === riseName || suntimesDeprecated[i][0] === setName) {
                        suntimesDeprecated.splice(i, 1);
                    }
                }
                return true;
            }
        }
        return false;
    };

    /**
     * add an alternate name for a sun time
     * @param {string} alternameName    - alternate or deprecated time name
     * @param {string} originalName     - original time name from SunCalc.times array
     * @return {Boolean} true if could be added, false if not (parameter missing; originalName does not exists; alternameName already existis)
     */
    SunCalc.addDeprecatedTimeName = function (alternameName, originalName) {
        let isValid = (typeof alternameName === 'string') && (alternameName.length > 0) &&
            (typeof originalName === 'string') && (originalName.length > 0);
        if (isValid) {
            let hasOrg = false;
            const EXP = /^(?![0-9])[a-zA-Z0-9$_]+$/;
            // check for invalid names
            for (let i=0; i<sunTimes.length; ++i) {
                if (!EXP.test(alternameName) ||
                    alternameName === sunTimes[i].riseName ||
                    alternameName === sunTimes[i].setName) {
                    isValid = false;
                    break;
                }
                if (originalName === sunTimes[i].riseName ||
                    originalName === sunTimes[i].setName) {
                    hasOrg = true;
                }
            }
            if (isValid && hasOrg) {
                suntimesDeprecated.push([alternameName, originalName]);
                return true;
            }
        }
        return false;
    };
    // calculations for sun times

    const J0 = 0.0009;

    /**
     * Julian cycle
     * @param {number} d - number of days
     * @param {number} lw - rad * -lng;
     * @returns {number}
     */
    function julianCycle(d, lw) {
        return Math.round(d - J0 - lw / (2 * Math.PI));
    }

    /**
     * approx transit
     * @param {number} Ht - hourAngle
     * @param {number} lw - rad * -lng
     * @param {number} n - Julian cycle
     * @returns {number} approx transit
     */
    function approxTransit(Ht, lw, n) {
        return J0 + (Ht + lw) / (2 * Math.PI) + n;
    }

    /**
     * solar transit in Julian
     * @param {number} ds - approxTransit
     * @param {number} M - solar mean anomal
     * @param {number} L - ecliptic longitude
     * @returns {number} solar transit in Julian
     */
    function solarTransitJ(ds, M, L) {
        return J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L);
    }

    /**
     * hour angle
     * @param {number} h - heigh at 0
     * @param {number} phi -  rad * lat;
     * @param {number} dec - declination
     * @returns {number} hour angle
     */
    function hourAngle(h, phi, dec) {
        return acos((sin(h) - sin(phi) * sin(dec)) / (cos(phi) * cos(dec)));
    }

    /**
     * calculates the obderver angle
     * @param {number} height  the observer height (in meters) relative to the horizon
     * @returns {number} height for further calculations
     */
    function observerAngle(height) {
        return -2.076 * Math.sqrt(height) / 60;
    }

    /**
     * returns set time for the given sun altitude
     * @param {number} h - heigh at 0
     * @param {number} lw - rad * -lng
     * @param {number} phi -  rad * lat;
     * @param {number} dec - declination
     * @param {number} n - Julian cycle
     * @param {number} M - solar mean anomal
     * @param {number} L - ecliptic longitude
     * @returns
     */
    function getSetJ(h, lw, phi, dec, n, M, L) {
        const w = hourAngle(h, phi, dec);
        const a = approxTransit(w, lw, n);
        // console.log(`h=${h} lw=${lw} phi=${phi} dec=${dec} n=${n} M=${M} L=${L} w=${w} a=${a}`);
        return solarTransitJ(a, M, L);
    }

    /**
     * calculates sun times for a given date and latitude/longitude
     * @param {number|Date} dateValue Date object or timestamp for calculating sun-times
     * @param {number} lat latitude for calculating sun-times
     * @param {number} lng longitude for calculating sun-times
     * @param {number} [height=0]  the observer height (in meters) relative to the horizon
     * @param {boolean} [addDeprecated=false] if true to times from timesDeprecated array will be added to the object
     * @param {boolean} [inUTC=false] defines if the calculation should be in utc or local time (default is local)
     * @return {ISunTimeList} result object of sunTime
     */
    SunCalc.getSunTimes = function (dateValue, lat, lng, height, addDeprecated, inUTC) {
        // console.log(`getSunTimes dateValue=${dateValue}  lat=${lat}, lng=${lng}, height={height}, noDeprecated=${noDeprecated}`);
        if (isNaN(lat)) {
            throw new Error('latitude missing');
        }
        if (isNaN(lng)) {
            throw new Error('longitude missing');
        }
        // @ts-ignore
        const t = new Date(dateValue);
        if (inUTC) {
            t.setUTCHours(12, 0, 0, 0);
        } else {
            t.setHours(12, 0, 0, 0);
        }

        const lw = rad * -lng;
        const phi = rad * lat;
        const dh = observerAngle(height || 0);
        const d = toDays(t.valueOf());
        const n = julianCycle(d, lw);
        const ds = approxTransit(0, lw, n);
        const M = solarMeanAnomaly(ds);
        const L = eclipticLongitude(M);
        const dec = declination(L, 0);

        const Jnoon = solarTransitJ(ds, M, L);
        const noonVal = fromJulianDay(Jnoon);
        const nadirVal = fromJulianDay(Jnoon + 0.5);

        const result = {
            solarNoon: {
                value: new Date(noonVal),
                ts: noonVal,
                name: 'solarNoon',
                // elevation: 90,
                julian: Jnoon,
                valid: !isNaN(Jnoon),
                pos: sunTimes.length
            },
            nadir: {
                value: new Date(nadirVal),
                ts: nadirVal,
                name: 'nadir',
                // elevation: 270,
                julian: Jnoon + 0.5,
                valid: !isNaN(Jnoon),
                pos: (sunTimes.length * 2) + 1
            }
        };
        for (let i = 0, len = sunTimes.length; i < len; i += 1) {
            const time = sunTimes[i];
            const sa = time.angle;
            const h0 = (sa + dh) * rad;
            let valid = true;

            let Jset = getSetJ(h0, lw, phi, dec, n, M, L);
            if (isNaN(Jset)) {
                Jset = (Jnoon + 0.5);
                valid = false;
                /* Näherung an Wert
                const b = Math.abs(time[0]);
                while (isNaN(Jset) && ((Math.abs(sa) - b) < 2)) {
                    sa += 0.005;
                    Jset = getSetJ(sa * rad, lw, phi, dec, n, M, L);
                } /* */
            }

            const Jrise = Jnoon - (Jset - Jnoon);
            const v1 = fromJulianDay(Jset);
            const v2 = fromJulianDay(Jrise);

            result[time.setName] = {
                value: new Date(v1),
                ts: v1,
                name: time.setName,
                elevation: sa,
                julian: Jset,
                valid,
                pos: len + i + 1
            };
            result[time.riseName] = {
                value: new Date(v2),
                ts: v2,
                name: time.riseName,
                elevation: sa, // (180 + (sa * -1)),
                julian: Jrise,
                valid,
                pos: len - i - 1
            };
        }

        if (addDeprecated) {
            // for backward compatibility
            for (let i = 0, len = suntimesDeprecated.length; i < len; i += 1) {
                const time = suntimesDeprecated[i];
                result[time[0]] = Object.assign({}, result[time[1]]);
                result[time[0]].deprecated = true;
                result[time[0]].nameOrg = result[time[1]].pos;
                result[time[0]].posOrg = result[time[0]].pos;
                result[time[0]].pos = -2;
            }
        }
        // @ts-ignore
        return result;
    };

    /**
     * calculates the time at which the sun will have a given elevation angle when rising and when setting for a given date and latitude/longitude.
     * @param {number|Date} dateValue Date object or timestamp for calculating sun-times
     * @param {number} lat latitude for calculating sun-times
     * @param {number} lng longitude for calculating sun-times
     * @param {number} elevationAngle sun angle for calculating sun-time
     * @param {number} [height=0]  the observer height (in meters) relative to the horizon
     * @param {boolean} [degree] defines if the elevationAngle is in degree not in radians
     * @param {boolean} [inUTC] defines if the calculation should be in utc or local time (default is local)
     * @return {ISunTimeSingle} result object of single sunTime
     */
    SunCalc.getSunTime = function (dateValue, lat, lng, elevationAngle, height, degree, inUTC) {
        // console.log(`getSunTime dateValue=${dateValue}  lat=${lat}, lng=${lng}, elevationAngle=${elevationAngle}`);
        if (isNaN(lat)) {
            throw new Error('latitude missing');
        }
        if (isNaN(lng)) {
            throw new Error('longitude missing');
        }
        if (isNaN(elevationAngle)) {
            throw new Error('elevationAngle missing');
        }
        if (degree) {
            elevationAngle = elevationAngle * rad;
        }
        const t = new Date(dateValue);
        if (inUTC) {
            t.setUTCHours(12, 0, 0, 0);
        } else {
            t.setHours(12, 0, 0, 0);
        }
        const lw = rad * -lng;
        const phi = rad * lat;
        const dh = observerAngle(height || 0);
        const d = toDays(t.valueOf());
        const n = julianCycle(d, lw);
        const ds = approxTransit(0, lw, n);
        const M = solarMeanAnomaly(ds);
        const L = eclipticLongitude(M);
        const dec = declination(L, 0);
        const Jnoon = solarTransitJ(ds, M, L);

        const h0 = (elevationAngle - 0.833 + dh) * rad;

        const Jset = getSetJ(h0, lw, phi, dec, n, M, L);
        const Jrise = Jnoon - (Jset - Jnoon);
        const v1 = fromJulianDay(Jset);
        const v2 = fromJulianDay(Jrise);

        return {
            set: {
                name: 'set',
                value: new Date(v1),
                ts: v1,
                elevation: elevationAngle,
                julian: Jset,
                valid: !isNaN(Jset),
                pos: 0
            },
            rise: {
                name: 'rise',
                value: new Date(v2),
                ts: v2,
                elevation: elevationAngle, // (180 + (elevationAngle * -1)),
                julian: Jrise,
                valid: !isNaN(Jrise),
                pos: 1
            }
        };
    };

    /**
     * calculates time for a given azimuth angle for a given date and latitude/longitude
     * @param {number|Date} dateValue Date object or timestamp for calculating sun-time
     * @param {number} nazimuth azimuth for calculating sun-time
     * @param {number} lat latitude for calculating sun-time
     * @param {number} lng longitude for calculating sun-time
     * @param {boolean} [degree] true if the angle is in degree and not in rad
     * @return {Date} result time of sun-time
     */
    SunCalc.getSunTimeByAzimuth = function (dateValue, lat, lng, nazimuth, degree) {
        if (isNaN(nazimuth)) {
            throw new Error('azimuth missing');
        }
        if (isNaN(lat)) {
            throw new Error('latitude missing');
        }
        if (isNaN(lng)) {
            throw new Error('longitude missing');
        }
        if (degree) {
            nazimuth = nazimuth * rad;
        }
        const date = new Date(dateValue);
        const lw = rad * -lng;
        const phi = rad * lat;

        let dateVal = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).valueOf();
        let addval = dayMs; // / 2);
        dateVal += addval;

        while (addval > 200) {
            // let nazi = this.getPosition(dateVal, lat, lng).azimuth;
            const d = toDays(dateVal);
            const c = sunCoords(d);
            const H = siderealTime(d, lw) - c.ra;
            const nazim = azimuthCalc(H, phi, c.dec);

            addval /= 2;
            if (nazim < nazimuth) {
                dateVal += addval;
            } else {
                dateVal -= addval;
            }
        }
        return new Date(Math.floor(dateVal));
    };

    // calculation for solar time based on https://www.pveducation.org/pvcdrom/properties-of-sunlight/solar-time

    /**
     * Calculaes the solar time of the given date in the given latitude and UTC offset.
     * @param {number|Date} dateValue Date object or timestamp for calculating solar time
     * @param {number} lng longitude for calculating sun-time
     * @param {number} utcOffset offset to the utc time
     * @returns {Date} Returns the solar time of the given date in the given latitude and UTC offset.
     */
    SunCalc.getSolarTime = function (dateValue, lng, utcOffset) {
        // @ts-ignore
        const date = new Date(dateValue);
        // calculate the day of year
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
        const dayOfYear = Math.floor(diff / dayMs);

        const b = 360 / 365 * (dayOfYear - 81) * rad;
        const equationOfTime = 9.87 * sin(2 * b) - 7.53 * cos(b) - 1.5 * sin(b);
        const localSolarTimeMeridian = 15 * utcOffset;
        const timeCorrection = equationOfTime + 4 * (lng - localSolarTimeMeridian);
        const localSolarTime = date.getHours() + timeCorrection / 60 + date.getMinutes() / 60;

        const solarDate = new Date(0, 0);
        solarDate.setMinutes(+localSolarTime * 60);
        return solarDate;
    };

    // moon calculations, based on http://aa.quae.nl/en/reken/hemelpositie.html formulas

    /**
     * calculate the geocentric ecliptic coordinates of the moon
     * @param {number} d number of days
     */
    function moonCoords(d) {
        const L = rad * (218.316 + 13.176396 * d); // ecliptic longitude
        const M = rad * (134.963 + 13.064993 * d); // mean anomaly
        const F = rad * (93.272 + 13.229350 * d); // mean distance
        const l = L + rad * 6.289 * sin(M); // longitude
        const b = rad * 5.128 * sin(F); // latitude
        const dt = 385001 - 20905 * cos(M); // distance to the moon in km

        return {
            ra: rightAscension(l, b),
            dec: declination(l, b),
            dist: dt
        };
    }

    /**
     * calculates moon position for a given date and latitude/longitude
     * @param {number|Date} dateValue Date object or timestamp for calculating moon-position
     * @param {number} lat latitude for calculating moon-position
     * @param {number} lng longitude for calculating moon-position
     * @return {IMoonPosition} result object of moon-position
     */
    SunCalc.getMoonPosition = function (dateValue, lat, lng) {
        // console.log(`getMoonPosition dateValue=${dateValue}  lat=${lat}, lng=${lng}`);
        if (isNaN(lat)) {
            throw new Error('latitude missing');
        }
        if (isNaN(lng)) {
            throw new Error('longitude missing');
        }
        if (dateValue instanceof Date) {
            dateValue = dateValue.valueOf();
        }
        const lw = rad * -lng;
        const phi = rad * lat;
        const d = toDays(dateValue);
        const c = moonCoords(d);
        const H = siderealTime(d, lw) - c.ra;
        let altitude = altitudeCalc(H, phi, c.dec);
        altitude += astroRefraction(altitude); // altitude correction for refraction

        // formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
        const pa = atan(sin(H), tan(phi) * cos(c.dec) - sin(c.dec) * cos(H));

        const azimuth = azimuthCalc(H, phi, c.dec);

        return {
            azimuth,
            altitude,
            azimuthDegrees: degr * azimuth,
            altitudeDegrees: degr * altitude,
            distance: c.dist,
            parallacticAngle: pa,
            parallacticAngleDegrees: degr * pa
        };
    };

    const fractionOfTheMoonCycle = SunCalc.moonCycles = [{
        from: 0,
        to: 0.033863193308711,
        id: 'newMoon',
        emoji: '🌚',
        code: ':new_moon_with_face:',
        name: 'New Moon',
        weight: 1,
        css: 'wi-moon-new'
    },
        {
            from: 0.033863193308711,
            to: 0.216136806691289,
            id: 'waxingCrescentMoon',
            emoji: '🌒',
            code: ':waxing_crescent_moon:',
            name: 'Waxing Crescent',
            weight: 6.3825,
            css: 'wi-moon-wax-cres'
        },
        {
            from: 0.216136806691289,
            to: 0.283863193308711,
            id: 'firstQuarterMoon',
            emoji: '🌓',
            code: ':first_quarter_moon:',
            name: 'First Quarter',
            weight: 1,
            css: 'wi-moon-first-quart'
        },
        {
            from: 0.283863193308711,
            to: 0.466136806691289,
            id: 'waxingGibbousMoon',
            emoji: '🌔',
            code: ':waxing_gibbous_moon:',
            name: 'Waxing Gibbous',
            weight: 6.3825,
            css: 'wi-moon-wax-gibb'
        },
        {
            from: 0.466136806691289,
            to: 0.533863193308711,
            id: 'fullMoon',
            emoji: '🌝',
            code: ':full_moon_with_face:',
            name: 'Full Moon',
            weight: 1,
            css: 'wi-moon-full'
        },
        {
            from: 0.533863193308711,
            to: 0.716136806691289,
            id: 'waningGibbousMoon',
            emoji: '🌖',
            code: ':waning_gibbous_moon:',
            name: 'Waning Gibbous',
            weight: 6.3825,
            css: 'wi-moon-wan-gibb'
        },
        {
            from: 0.716136806691289,
            to: 0.783863193308711,
            id: 'thirdQuarterMoon',
            emoji: '🌗',
            code: ':last_quarter_moon:',
            name: 'third Quarter',
            weight: 1,
            css: 'wi-moon-third-quart'
        },
        {
            from: 0.783863193308711,
            to: 0.966136806691289,
            id: 'waningCrescentMoon',
            emoji: '🌘',
            code: ':waning_crescent_moon:',
            name: 'Waning Crescent',
            weight: 6.3825,
            css: 'wi-moon-wan-cres'
        },
        {
            from: 0.966136806691289,
            to: 1,
            id: 'newMoon',
            emoji: '🌚',
            code: ':new_moon_with_face:',
            name: 'New Moon',
            weight: 1,
            css: 'wi-moon-new'
        }];

    /**
     * calculations for illumination parameters of the moon,
     * based on http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and
     * Chapter 48 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
     * @param {number|Date} dateValue Date object or timestamp for calculating moon-illumination
     * @return {IMoonIllumination} result object of moon-illumination
     */
    SunCalc.getMoonIllumination = function (dateValue) {
        // console.log(`getMoonIllumination dateValue=${dateValue}`);
        if (dateValue instanceof Date) {
            dateValue = dateValue.valueOf();
        }
        const d = toDays(dateValue);
        const s = sunCoords(d);
        const m = moonCoords(d);
        const sdist = 149598000;  // distance from Earth to Sun in km
        const phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra));
        const inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi));
        const angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) -
            cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));
        const phaseValue = 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI;

        // calculates the difference in ms between the sirst fullMoon 2000 and given Date
        const diffBase = dateValue - firstNewMoon2000;
        // Calculate modulus to drop completed cycles
        let cycleModMs = diffBase % lunarDaysMs;
        // If negative number (date before new moon 2000) add lunarDaysMs
        if ( cycleModMs < 0 ) { cycleModMs += lunarDaysMs; }
        const nextNewMoon = (lunarDaysMs - cycleModMs) + dateValue;
        let nextFullMoon = ((lunarDaysMs/2) - cycleModMs) + dateValue;
        if (nextFullMoon < dateValue) { nextFullMoon += lunarDaysMs; }
        const quater = (lunarDaysMs/4);
        let nextFirstQuarter = (quater - cycleModMs) + dateValue;
        if (nextFirstQuarter < dateValue) { nextFirstQuarter += lunarDaysMs; }
        let nextThirdQuarter = (lunarDaysMs - quater - cycleModMs) + dateValue;
        if (nextThirdQuarter < dateValue) { nextThirdQuarter += lunarDaysMs; }
        // Calculate the fraction of the moon cycle
        // const currentfrac = cycleModMs / lunarDaysMs;
        const next = Math.min(nextNewMoon, nextFirstQuarter, nextFullMoon, nextThirdQuarter);
        let phase;

        for (let index = 0; index < fractionOfTheMoonCycle.length; index++) {
            const element = fractionOfTheMoonCycle[index];
            if ( (phaseValue >= element.from) && (phaseValue <= element.to) ) {
                phase = element;
                break;
            }
        }

        return {
            fraction: (1 + cos(inc)) / 2,
            // fraction2: cycleModMs / lunarDaysMs,
            // @ts-ignore
            phase,
            phaseValue,
            angle,
            next : {
                value: next,
                date: (new Date(next)).toISOString(),
                type: (next === nextNewMoon) ? 'newMoon' : ((next === nextFirstQuarter) ? 'firstQuarter' : ((next === nextFullMoon) ? 'fullMoon' : 'thirdQuarter')),
                newMoon: {
                    value: nextNewMoon,
                    date: (new Date(nextNewMoon)).toISOString()
                },
                fullMoon: {
                    value: nextFullMoon,
                    date: (new Date(nextFullMoon)).toISOString()
                },
                firstQuarter: {
                    value: nextFirstQuarter,
                    date: (new Date(nextFirstQuarter)).toISOString()
                },
                thirdQuarter: {
                    value: nextThirdQuarter,
                    date: (new Date(nextThirdQuarter)).toISOString()
                }
            }
        };
    };

    /**
     * calculations moon position and illumination for a given date and latitude/longitude of the moon,
     * @param {number|Date} dateValue Date object or timestamp for calculating moon-illumination
     * @param {number} lat latitude for calculating moon-position
     * @param {number} lng longitude for calculating moon-position
     * @return {IMoonData} result object of moon-illumination
     */
    SunCalc.getMoonData = function (dateValue, lat, lng) {
        const pos = SunCalc.getMoonPosition(dateValue, lat, lng);
        const illum = SunCalc.getMoonIllumination(dateValue);
        return Object.assign({
            illumination : illum,
            zenithAngle : illum.angle - pos.parallacticAngle
        }, pos);
    };

    /**
     * add hours to a date
     * @param {number} dateValue timestamp to add hours
     * @param {number} h - hours to add
     * @returns {number} new timestamp with added hours
     */
    function hoursLater(dateValue, h) {
        return dateValue + h * dayMs / 24;
    }

    /**
     * calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article
     * @param {number|Date} dateValue Date object or timestamp for calculating moon-times
     * @param {number} lat latitude for calculating moon-times
     * @param {number} lng longitude for calculating moon-times
     * @param {boolean} [inUTC] defines if the calculation should be in utc or local time (default is local)
     * @return {IMoonTimes} result object of sunTime
     */
    SunCalc.getMoonTimes = function (dateValue, lat, lng, inUTC) {
        if (isNaN(lat)) {
            throw new Error('latitude missing');
        }
        if (isNaN(lng)) {
            throw new Error('longitude missing');
        }
        const t = new Date(dateValue);
        if (inUTC) {
            t.setUTCHours(0, 0, 0, 0);
        } else {
            t.setHours(0, 0, 0, 0);
        }
        dateValue = t.valueOf();
        // console.log(`getMoonTimes lat=${lat} lng=${lng} dateValue=${dateValue} t=${t}`);

        const hc = 0.133 * rad;
        let h0 = SunCalc.getMoonPosition(dateValue, lat, lng).altitude - hc;
        let rise; let set; let ye; let d; let roots; let x1; let x2; let dx;

        // go in 2-hour chunks, each time seeing if a 3-point quadratic curve crosses zero (which means rise or set)
        for (let i = 1; i <= 26; i += 2) {
            const h1 = SunCalc.getMoonPosition(hoursLater(dateValue, i), lat, lng).altitude - hc;
            const h2 = SunCalc.getMoonPosition(hoursLater(dateValue, i + 1), lat, lng).altitude - hc;

            const a = (h0 + h2) / 2 - h1;
            const b = (h2 - h0) / 2;
            const xe = -b / (2 * a);
            ye = (a * xe + b) * xe + h1;
            d = b * b - 4 * a * h1;
            roots = 0;

            if (d >= 0) {
                dx = Math.sqrt(d) / (Math.abs(a) * 2);
                x1 = xe - dx;
                x2 = xe + dx;
                if (Math.abs(x1) <= 1) {
                    roots++;
                }

                if (Math.abs(x2) <= 1) {
                    roots++;
                }

                if (x1 < -1) {
                    x1 = x2;
                }
            }

            if (roots === 1) {
                if (h0 < 0) {
                    rise = i + x1;
                } else {
                    set = i + x1;
                }
            } else if (roots === 2) {
                rise = i + (ye < 0 ? x2 : x1);
                set = i + (ye < 0 ? x1 : x2);
            }

            if (rise && set) {
                break;
            }

            h0 = h2;
        }

        const result = {};
        if (rise) {
            result.rise = new Date(hoursLater(dateValue, rise));
        } else {
            result.rise = NaN;
        }

        if (set) {
            result.set = new Date(hoursLater(dateValue, set));
        } else {
            result.set = NaN;
        }

        if (!rise && !set) {
            if (ye > 0) {
                result.alwaysUp = true;
                result.alwaysDown = false;
            } else {
                result.alwaysUp = false;
                result.alwaysDown = true;
            }
        } else if (rise && set) {
            result.alwaysUp = false;
            result.alwaysDown = false;
            result.highest = new Date(hoursLater(dateValue, Math.min(rise, set) + (Math.abs(set - rise) / 2)));
        } else {
            result.alwaysUp = false;
            result.alwaysDown = false;
        }
        return result;
    };

    /**
     * calc moon transit
     * @param {number} rize timestamp for rise
     * @param {number} set timestamp for set time
     * @returns {Date} new moon transit
     */
    function calcMoonTransit(rize, set) {
        if (rize > set) {
            return new Date(set + (rize - set) / 2);
        }
        return new Date(rize + (set - rize) / 2);
    }

    /**
     * calculated the moon transit
     * @param {number|Date} rise rise time as Date object or timestamp for calculating moon-transit
     * @param {number|Date} set set time as Date object or timestamp for calculating moon-transit
     * @param {number} lat latitude for calculating moon-times
     * @param {number} lng longitude for calculating moon-times
     * @returns {{main: (Date|null), invert: (Date|null)}}
     */
    SunCalc.moonTransit = function (rise, set, lat, lng) {
        /** @type {Date|null} */ let main = null;
        /** @type {Date|null} */ let invert = null;
        const riseDate = new Date(rise);
        const setDate = new Date(set);
        const riseValue = riseDate.getTime();
        const setValue = setDate.getTime();
        const day = setDate.getDate();
        let tempTransitBefore;
        let tempTransitAfter;

        if (rise && set) {
            if  (rise < set) {
                main = calcMoonTransit(riseValue, setValue);
            } else {
                invert = calcMoonTransit(riseValue, setValue);
            }
        }

        if (rise) {
            tempTransitAfter = calcMoonTransit(riseValue, SunCalc.getMoonTimes(new Date(riseDate).setDate(day + 1), lat, lng).set.valueOf());
            if (tempTransitAfter.getDate() === day) {
                if (main) {
                    invert = tempTransitAfter;
                } else {
                    main = tempTransitAfter;
                }
            }
        }

        if (set) {
            tempTransitBefore = calcMoonTransit(setValue, SunCalc.getMoonTimes(new Date(setDate).setDate(day - 1), lat, lng).rise.valueOf());
            if (tempTransitBefore.getDate() === day) {
                main = tempTransitBefore;
            }
        }
        return {
            main,
            invert
        };
    };

    // export as Node module / AMD module / browser variable
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = SunCalc;
        // @ts-ignore
    } else if (typeof define === 'function' && define.amd) {
        // @ts-ignore
        define(SunCalc);
    } else {
        // @ts-ignore
        window.SunCalc = SunCalc;
    }

})();