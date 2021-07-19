var weatherApplet;
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 969:
/***/ ((module) => {

/*
 (c) 2011-2015, Vladimir Agafonkin
 SunCalc is a JavaScript library for calculating sun/moon position and light phases.
 https://github.com/mourner/suncalc
*/
(function () {
  'use strict'; // shortcuts for easier to read formulas

  var PI = Math.PI,
      sin = Math.sin,
      cos = Math.cos,
      tan = Math.tan,
      asin = Math.asin,
      atan = Math.atan2,
      acos = Math.acos,
      rad = PI / 180; // sun calculations are based on http://aa.quae.nl/en/reken/zonpositie.html formulas
  // date/time constants and conversions

  var dayMs = 1000 * 60 * 60 * 24,
      J1970 = 2440588,
      J2000 = 2451545;

  function toJulian(date) {
    return date.valueOf() / dayMs - 0.5 + J1970;
  }

  function fromJulian(j) {
    return new Date((j + 0.5 - J1970) * dayMs);
  }

  function toDays(date) {
    return toJulian(date) - J2000;
  } // general calculations for position


  var e = rad * 23.4397; // obliquity of the Earth

  function rightAscension(l, b) {
    return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l));
  }

  function declination(l, b) {
    return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l));
  }

  function azimuth(H, phi, dec) {
    return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi));
  }

  function altitude(H, phi, dec) {
    return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H));
  }

  function siderealTime(d, lw) {
    return rad * (280.16 + 360.9856235 * d) - lw;
  }

  function astroRefraction(h) {
    if (h < 0) // the following formula works for positive altitudes only.
      h = 0; // if h = -0.08901179 a div/0 would occur.
    // formula 16.4 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
    // 1.02 / tan(h + 10.26 / (h + 5.10)) h in degrees, result in arc minutes -> converted to rad:

    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
  } // general sun calculations


  function solarMeanAnomaly(d) {
    return rad * (357.5291 + 0.98560028 * d);
  }

  function eclipticLongitude(M) {
    var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)),
        // equation of center
    P = rad * 102.9372; // perihelion of the Earth

    return M + C + P + PI;
  }

  function sunCoords(d) {
    var M = solarMeanAnomaly(d),
        L = eclipticLongitude(M);
    return {
      dec: declination(L, 0),
      ra: rightAscension(L, 0)
    };
  }

  var SunCalc = {}; // calculates sun position for a given date and latitude/longitude

  SunCalc.getPosition = function (date, lat, lng) {
    var lw = rad * -lng,
        phi = rad * lat,
        d = toDays(date),
        c = sunCoords(d),
        H = siderealTime(d, lw) - c.ra;
    return {
      azimuth: azimuth(H, phi, c.dec),
      altitude: altitude(H, phi, c.dec)
    };
  }; // sun times configuration (angle, morning name, evening name)


  var times = SunCalc.times = [[-0.833, 'sunrise', 'sunset'], [-0.3, 'sunriseEnd', 'sunsetStart'], [-6, 'dawn', 'dusk'], [-12, 'nauticalDawn', 'nauticalDusk'], [-18, 'nightEnd', 'night'], [6, 'goldenHourEnd', 'goldenHour']]; // adds a custom time to the times config

  SunCalc.addTime = function (angle, riseName, setName) {
    times.push([angle, riseName, setName]);
  }; // calculations for sun times


  var J0 = 0.0009;

  function julianCycle(d, lw) {
    return Math.round(d - J0 - lw / (2 * PI));
  }

  function approxTransit(Ht, lw, n) {
    return J0 + (Ht + lw) / (2 * PI) + n;
  }

  function solarTransitJ(ds, M, L) {
    return J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L);
  }

  function hourAngle(h, phi, d) {
    return acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d)));
  } // returns set time for the given sun altitude


  function getSetJ(h, lw, phi, dec, n, M, L) {
    var w = hourAngle(h, phi, dec),
        a = approxTransit(w, lw, n);
    return solarTransitJ(a, M, L);
  } // calculates sun times for a given date and latitude/longitude


  SunCalc.getTimes = function (date, lat, lng) {
    var lw = rad * -lng,
        phi = rad * lat,
        d = toDays(date),
        n = julianCycle(d, lw),
        ds = approxTransit(0, lw, n),
        M = solarMeanAnomaly(ds),
        L = eclipticLongitude(M),
        dec = declination(L, 0),
        Jnoon = solarTransitJ(ds, M, L),
        i,
        len,
        time,
        Jset,
        Jrise;
    var result = {
      solarNoon: fromJulian(Jnoon),
      nadir: fromJulian(Jnoon - 0.5)
    };

    for (i = 0, len = times.length; i < len; i += 1) {
      time = times[i];
      Jset = getSetJ(time[0] * rad, lw, phi, dec, n, M, L);
      Jrise = Jnoon - (Jset - Jnoon);
      result[time[1]] = fromJulian(Jrise);
      result[time[2]] = fromJulian(Jset);
    }

    return result;
  }; // moon calculations, based on http://aa.quae.nl/en/reken/hemelpositie.html formulas


  function moonCoords(d) {
    // geocentric ecliptic coordinates of the moon
    var L = rad * (218.316 + 13.176396 * d),
        // ecliptic longitude
    M = rad * (134.963 + 13.064993 * d),
        // mean anomaly
    F = rad * (93.272 + 13.229350 * d),
        // mean distance
    l = L + rad * 6.289 * sin(M),
        // longitude
    b = rad * 5.128 * sin(F),
        // latitude
    dt = 385001 - 20905 * cos(M); // distance to the moon in km

    return {
      ra: rightAscension(l, b),
      dec: declination(l, b),
      dist: dt
    };
  }

  SunCalc.getMoonPosition = function (date, lat, lng) {
    var lw = rad * -lng,
        phi = rad * lat,
        d = toDays(date),
        c = moonCoords(d),
        H = siderealTime(d, lw) - c.ra,
        h = altitude(H, phi, c.dec),
        // formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
    pa = atan(sin(H), tan(phi) * cos(c.dec) - sin(c.dec) * cos(H));
    h = h + astroRefraction(h); // altitude correction for refraction

    return {
      azimuth: azimuth(H, phi, c.dec),
      altitude: h,
      distance: c.dist,
      parallacticAngle: pa
    };
  }; // calculations for illumination parameters of the moon,
  // based on http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and
  // Chapter 48 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.


  SunCalc.getMoonIllumination = function (date) {
    var d = toDays(date || new Date()),
        s = sunCoords(d),
        m = moonCoords(d),
        sdist = 149598000,
        // distance from Earth to Sun in km
    phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra)),
        inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi)),
        angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) - cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));
    return {
      fraction: (1 + cos(inc)) / 2,
      phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI,
      angle: angle
    };
  };

  function hoursLater(date, h) {
    return new Date(date.valueOf() + h * dayMs / 24);
  } // calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article


  SunCalc.getMoonTimes = function (date, lat, lng, inUTC) {
    var t = new Date(date);
    if (inUTC) t.setUTCHours(0, 0, 0, 0);else t.setHours(0, 0, 0, 0);
    var hc = 0.133 * rad,
        h0 = SunCalc.getMoonPosition(t, lat, lng).altitude - hc,
        h1,
        h2,
        rise,
        set,
        a,
        b,
        xe,
        ye,
        d,
        roots,
        x1,
        x2,
        dx; // go in 2-hour chunks, each time seeing if a 3-point quadratic curve crosses zero (which means rise or set)

    for (var i = 1; i <= 24; i += 2) {
      h1 = SunCalc.getMoonPosition(hoursLater(t, i), lat, lng).altitude - hc;
      h2 = SunCalc.getMoonPosition(hoursLater(t, i + 1), lat, lng).altitude - hc;
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
        if (Math.abs(x1) <= 1) roots++;
        if (Math.abs(x2) <= 1) roots++;
        if (x1 < -1) x1 = x2;
      }

      if (roots === 1) {
        if (h0 < 0) rise = i + x1;else set = i + x1;
      } else if (roots === 2) {
        rise = i + (ye < 0 ? x2 : x1);
        set = i + (ye < 0 ? x1 : x2);
      }

      if (rise && set) break;
      h0 = h2;
    }

    var result = {};
    if (rise) result.rise = hoursLater(t, rise);
    if (set) result.set = hoursLater(t, set);
    if (!rise && !set) result[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;
    return result;
  }; // export as Node module / AMD module / browser variable


  if (true) module.exports = SunCalc;else {}
})();

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "main": () => (/* binding */ main)
});

;// CONCATENATED MODULE: ./src/3_8/consts.ts
const UUID = "weather@mockturtl";
const SIGNAL_CHANGED = 'changed::';
const SIGNAL_CLICKED = 'clicked';
const SIGNAL_REPAINT = 'repaint';
const APPLET_ICON = "view-refresh-symbolic";
const REFRESH_ICON = "view-refresh";
const BLANK = '   ';
const ELLIPSIS = '...';
const EN_DASH = '\u2013';
const FORWARD_SLASH = '\u002F';

;// CONCATENATED MODULE: ./src/3_8/lib/logger.ts

class Log {
    constructor(_instanceId) {
        this.debug = false;
        this.level = 1;
        this.ID = _instanceId;
        this.appletDir = imports.ui.appletManager.appletMeta[UUID].path;
        this.debug = this.DEBUG();
    }
    DEBUG() {
        let path = this.appletDir + "/../DEBUG";
        let _debug = imports.gi.Gio.file_new_for_path(path);
        let result = _debug.query_exists(null);
        if (result)
            this.Info("DEBUG file found in " + path + ", enabling Debug mode");
        return result;
    }
    ;
    Info(message) {
        let msg = "[" + UUID + "#" + this.ID + "]: " + message.toString();
        global.log(msg);
    }
    Error(error, e) {
        global.logError("[" + UUID + "#" + this.ID + "]: " + error.toString());
        if (!!(e === null || e === void 0 ? void 0 : e.stack))
            global.logError(e.stack);
    }
    ;
    Debug(message) {
        if (this.debug) {
            this.Info(message);
        }
    }
    Debug2(message) {
        if (this.debug && this.level > 1) {
            this.Info(message);
        }
    }
    UpdateInstanceID(instanceID) {
        this.ID = instanceID;
    }
}
const logger_Logger = new Log();

;// CONCATENATED MODULE: ./node_modules/luxon/src/errors.js
// these aren't really private, but nor are they really useful to document

/**
 * @private
 */
class LuxonError extends Error {}
/**
 * @private
 */


class InvalidDateTimeError extends LuxonError {
  constructor(reason) {
    super(`Invalid DateTime: ${reason.toMessage()}`);
  }

}
/**
 * @private
 */

class InvalidIntervalError extends LuxonError {
  constructor(reason) {
    super(`Invalid Interval: ${reason.toMessage()}`);
  }

}
/**
 * @private
 */

class InvalidDurationError extends LuxonError {
  constructor(reason) {
    super(`Invalid Duration: ${reason.toMessage()}`);
  }

}
/**
 * @private
 */

class ConflictingSpecificationError extends LuxonError {}
/**
 * @private
 */

class InvalidUnitError extends LuxonError {
  constructor(unit) {
    super(`Invalid unit ${unit}`);
  }

}
/**
 * @private
 */

class InvalidArgumentError extends LuxonError {}
/**
 * @private
 */

class ZoneIsAbstractError extends LuxonError {
  constructor() {
    super("Zone is an abstract class");
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/formats.js
/**
 * @private
 */
const n = "numeric",
      s = "short",
      l = "long";
const DATE_SHORT = {
  year: n,
  month: n,
  day: n
};
const DATE_MED = {
  year: n,
  month: s,
  day: n
};
const DATE_MED_WITH_WEEKDAY = {
  year: n,
  month: s,
  day: n,
  weekday: s
};
const DATE_FULL = {
  year: n,
  month: l,
  day: n
};
const DATE_HUGE = {
  year: n,
  month: l,
  day: n,
  weekday: l
};
const TIME_SIMPLE = {
  hour: n,
  minute: n
};
const TIME_WITH_SECONDS = {
  hour: n,
  minute: n,
  second: n
};
const TIME_WITH_SHORT_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  timeZoneName: s
};
const TIME_WITH_LONG_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  timeZoneName: l
};
const TIME_24_SIMPLE = {
  hour: n,
  minute: n,
  hour12: false
};
/**
 * {@link toLocaleString}; format like '09:30:23', always 24-hour.
 */

const TIME_24_WITH_SECONDS = {
  hour: n,
  minute: n,
  second: n,
  hour12: false
};
/**
 * {@link toLocaleString}; format like '09:30:23 EDT', always 24-hour.
 */

const TIME_24_WITH_SHORT_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  hour12: false,
  timeZoneName: s
};
/**
 * {@link toLocaleString}; format like '09:30:23 Eastern Daylight Time', always 24-hour.
 */

const TIME_24_WITH_LONG_OFFSET = {
  hour: n,
  minute: n,
  second: n,
  hour12: false,
  timeZoneName: l
};
/**
 * {@link toLocaleString}; format like '10/14/1983, 9:30 AM'. Only 12-hour if the locale is.
 */

const DATETIME_SHORT = {
  year: n,
  month: n,
  day: n,
  hour: n,
  minute: n
};
/**
 * {@link toLocaleString}; format like '10/14/1983, 9:30:33 AM'. Only 12-hour if the locale is.
 */

const DATETIME_SHORT_WITH_SECONDS = {
  year: n,
  month: n,
  day: n,
  hour: n,
  minute: n,
  second: n
};
const DATETIME_MED = {
  year: n,
  month: s,
  day: n,
  hour: n,
  minute: n
};
const DATETIME_MED_WITH_SECONDS = {
  year: n,
  month: s,
  day: n,
  hour: n,
  minute: n,
  second: n
};
const DATETIME_MED_WITH_WEEKDAY = {
  year: n,
  month: s,
  day: n,
  weekday: s,
  hour: n,
  minute: n
};
const DATETIME_FULL = {
  year: n,
  month: l,
  day: n,
  hour: n,
  minute: n,
  timeZoneName: s
};
const DATETIME_FULL_WITH_SECONDS = {
  year: n,
  month: l,
  day: n,
  hour: n,
  minute: n,
  second: n,
  timeZoneName: s
};
const DATETIME_HUGE = {
  year: n,
  month: l,
  day: n,
  weekday: l,
  hour: n,
  minute: n,
  timeZoneName: l
};
const DATETIME_HUGE_WITH_SECONDS = {
  year: n,
  month: l,
  day: n,
  weekday: l,
  hour: n,
  minute: n,
  second: n,
  timeZoneName: l
};
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/util.js
/*
  This is just a junk drawer, containing anything used across multiple classes.
  Because Luxon is small(ish), this should stay small and we won't worry about splitting
  it up into, say, parsingUtil.js and basicUtil.js and so on. But they are divided up by feature area.
*/

/**
 * @private
 */
// TYPES

function isUndefined(o) {
  return typeof o === "undefined";
}
function isNumber(o) {
  return typeof o === "number";
}
function isInteger(o) {
  return typeof o === "number" && o % 1 === 0;
}
function isString(o) {
  return typeof o === "string";
}
function isDate(o) {
  return Object.prototype.toString.call(o) === "[object Date]";
} // CAPABILITIES

function hasIntl() {
  try {
    return typeof Intl !== "undefined" && Intl.DateTimeFormat;
  } catch (e) {
    return false;
  }
}
function hasFormatToParts() {
  return !isUndefined(Intl.DateTimeFormat.prototype.formatToParts);
}
function hasRelative() {
  try {
    return typeof Intl !== "undefined" && !!Intl.RelativeTimeFormat;
  } catch (e) {
    return false;
  }
} // OBJECTS AND ARRAYS

function maybeArray(thing) {
  return Array.isArray(thing) ? thing : [thing];
}
function bestBy(arr, by, compare) {
  if (arr.length === 0) {
    return undefined;
  }

  return arr.reduce((best, next) => {
    const pair = [by(next), next];

    if (!best) {
      return pair;
    } else if (compare(best[0], pair[0]) === best[0]) {
      return best;
    } else {
      return pair;
    }
  }, null)[1];
}
function pick(obj, keys) {
  return keys.reduce((a, k) => {
    a[k] = obj[k];
    return a;
  }, {});
}
function util_hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
} // NUMBERS AND STRINGS

function integerBetween(thing, bottom, top) {
  return isInteger(thing) && thing >= bottom && thing <= top;
} // x % n but takes the sign of n instead of x

function floorMod(x, n) {
  return x - n * Math.floor(x / n);
}
function padStart(input) {
  let n = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;
  const minus = input < 0 ? "-" : "";
  const target = minus ? input * -1 : input;
  let result;

  if (target.toString().length < n) {
    result = ("0".repeat(n) + target).slice(-n);
  } else {
    result = target.toString();
  }

  return `${minus}${result}`;
}
function parseInteger(string) {
  if (isUndefined(string) || string === null || string === "") {
    return undefined;
  } else {
    return parseInt(string, 10);
  }
}
function parseMillis(fraction) {
  // Return undefined (instead of 0) in these cases, where fraction is not set
  if (isUndefined(fraction) || fraction === null || fraction === "") {
    return undefined;
  } else {
    const f = parseFloat("0." + fraction) * 1000;
    return Math.floor(f);
  }
}
function roundTo(number, digits) {
  let towardZero = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  const factor = 10 ** digits,
        rounder = towardZero ? Math.trunc : Math.round;
  return rounder(number * factor) / factor;
} // DATE BASICS

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}
function daysInMonth(year, month) {
  const modMonth = floorMod(month - 1, 12) + 1,
        modYear = year + (month - modMonth) / 12;

  if (modMonth === 2) {
    return isLeapYear(modYear) ? 29 : 28;
  } else {
    return [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][modMonth - 1];
  }
} // covert a calendar object to a local timestamp (epoch, but with the offset baked in)

function objToLocalTS(obj) {
  let d = Date.UTC(obj.year, obj.month - 1, obj.day, obj.hour, obj.minute, obj.second, obj.millisecond); // for legacy reasons, years between 0 and 99 are interpreted as 19XX; revert that

  if (obj.year < 100 && obj.year >= 0) {
    d = new Date(d);
    d.setUTCFullYear(d.getUTCFullYear() - 1900);
  }

  return +d;
}
function weeksInWeekYear(weekYear) {
  const p1 = (weekYear + Math.floor(weekYear / 4) - Math.floor(weekYear / 100) + Math.floor(weekYear / 400)) % 7,
        last = weekYear - 1,
        p2 = (last + Math.floor(last / 4) - Math.floor(last / 100) + Math.floor(last / 400)) % 7;
  return p1 === 4 || p2 === 3 ? 53 : 52;
}
function untruncateYear(year) {
  if (year > 99) {
    return year;
  } else return year > 60 ? 1900 + year : 2000 + year;
} // PARSING

function parseZoneInfo(ts, offsetFormat, locale) {
  let timeZone = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
  const date = new Date(ts),
        intlOpts = {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  };

  if (timeZone) {
    intlOpts.timeZone = timeZone;
  }

  const modified = Object.assign({
    timeZoneName: offsetFormat
  }, intlOpts),
        intl = hasIntl();

  if (intl && hasFormatToParts()) {
    const parsed = new Intl.DateTimeFormat(locale, modified).formatToParts(date).find(m => m.type.toLowerCase() === "timezonename");
    return parsed ? parsed.value : null;
  } else if (intl) {
    // this probably doesn't work for all locales
    const without = new Intl.DateTimeFormat(locale, intlOpts).format(date),
          included = new Intl.DateTimeFormat(locale, modified).format(date),
          diffed = included.substring(without.length),
          trimmed = diffed.replace(/^[, \u200e]+/, "");
    return trimmed;
  } else {
    return null;
  }
} // signedOffset('-5', '30') -> -330

function signedOffset(offHourStr, offMinuteStr) {
  let offHour = parseInt(offHourStr, 10); // don't || this because we want to preserve -0

  if (Number.isNaN(offHour)) {
    offHour = 0;
  }

  const offMin = parseInt(offMinuteStr, 10) || 0,
        offMinSigned = offHour < 0 || Object.is(offHour, -0) ? -offMin : offMin;
  return offHour * 60 + offMinSigned;
} // COERCION

function asNumber(value) {
  const numericValue = Number(value);
  if (typeof value === "boolean" || value === "" || Number.isNaN(numericValue)) throw new InvalidArgumentError(`Invalid unit value ${value}`);
  return numericValue;
}
function normalizeObject(obj, normalizer, nonUnitKeys) {
  const normalized = {};

  for (const u in obj) {
    if (util_hasOwnProperty(obj, u)) {
      if (nonUnitKeys.indexOf(u) >= 0) continue;
      const v = obj[u];
      if (v === undefined || v === null) continue;
      normalized[normalizer(u)] = asNumber(v);
    }
  }

  return normalized;
}
function formatOffset(offset, format) {
  const hours = Math.trunc(Math.abs(offset / 60)),
        minutes = Math.trunc(Math.abs(offset % 60)),
        sign = offset >= 0 ? "+" : "-";

  switch (format) {
    case "short":
      return `${sign}${padStart(hours, 2)}:${padStart(minutes, 2)}`;

    case "narrow":
      return `${sign}${hours}${minutes > 0 ? `:${minutes}` : ""}`;

    case "techie":
      return `${sign}${padStart(hours, 2)}${padStart(minutes, 2)}`;

    default:
      throw new RangeError(`Value format ${format} is out of range for property format`);
  }
}
function timeObject(obj) {
  return pick(obj, ["hour", "minute", "second", "millisecond"]);
}
const ianaRegex = /[A-Za-z_+-]{1,256}(:?\/[A-Za-z_+-]{1,256}(\/[A-Za-z_+-]{1,256})?)?/;
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/english.js



function stringify(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}
/**
 * @private
 */


const monthsLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthsNarrow = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
function months(length) {
  switch (length) {
    case "narrow":
      return [...monthsNarrow];

    case "short":
      return [...monthsShort];

    case "long":
      return [...monthsLong];

    case "numeric":
      return ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

    case "2-digit":
      return ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

    default:
      return null;
  }
}
const weekdaysLong = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const weekdaysShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdaysNarrow = ["M", "T", "W", "T", "F", "S", "S"];
function weekdays(length) {
  switch (length) {
    case "narrow":
      return [...weekdaysNarrow];

    case "short":
      return [...weekdaysShort];

    case "long":
      return [...weekdaysLong];

    case "numeric":
      return ["1", "2", "3", "4", "5", "6", "7"];

    default:
      return null;
  }
}
const meridiems = ["AM", "PM"];
const erasLong = ["Before Christ", "Anno Domini"];
const erasShort = ["BC", "AD"];
const erasNarrow = ["B", "A"];
function eras(length) {
  switch (length) {
    case "narrow":
      return [...erasNarrow];

    case "short":
      return [...erasShort];

    case "long":
      return [...erasLong];

    default:
      return null;
  }
}
function meridiemForDateTime(dt) {
  return meridiems[dt.hour < 12 ? 0 : 1];
}
function weekdayForDateTime(dt, length) {
  return weekdays(length)[dt.weekday - 1];
}
function monthForDateTime(dt, length) {
  return months(length)[dt.month - 1];
}
function eraForDateTime(dt, length) {
  return eras(length)[dt.year < 0 ? 0 : 1];
}
function formatRelativeTime(unit, count) {
  let numeric = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "always";
  let narrow = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  const units = {
    years: ["year", "yr."],
    quarters: ["quarter", "qtr."],
    months: ["month", "mo."],
    weeks: ["week", "wk."],
    days: ["day", "day", "days"],
    hours: ["hour", "hr."],
    minutes: ["minute", "min."],
    seconds: ["second", "sec."]
  };
  const lastable = ["hours", "minutes", "seconds"].indexOf(unit) === -1;

  if (numeric === "auto" && lastable) {
    const isDay = unit === "days";

    switch (count) {
      case 1:
        return isDay ? "tomorrow" : `next ${units[unit][0]}`;

      case -1:
        return isDay ? "yesterday" : `last ${units[unit][0]}`;

      case 0:
        return isDay ? "today" : `this ${units[unit][0]}`;

      default: // fall through

    }
  }

  const isInPast = Object.is(count, -0) || count < 0,
        fmtValue = Math.abs(count),
        singular = fmtValue === 1,
        lilUnits = units[unit],
        fmtUnit = narrow ? singular ? lilUnits[1] : lilUnits[2] || lilUnits[1] : singular ? units[unit][0] : unit;
  return isInPast ? `${fmtValue} ${fmtUnit} ago` : `in ${fmtValue} ${fmtUnit}`;
}
function formatString(knownFormat) {
  // these all have the offsets removed because we don't have access to them
  // without all the intl stuff this is backfilling
  const filtered = pick(knownFormat, ["weekday", "era", "year", "month", "day", "hour", "minute", "second", "timeZoneName", "hour12"]),
        key = stringify(filtered),
        dateTimeHuge = "EEEE, LLLL d, yyyy, h:mm a";

  switch (key) {
    case stringify(DATE_SHORT):
      return "M/d/yyyy";

    case stringify(DATE_MED):
      return "LLL d, yyyy";

    case stringify(DATE_MED_WITH_WEEKDAY):
      return "EEE, LLL d, yyyy";

    case stringify(DATE_FULL):
      return "LLLL d, yyyy";

    case stringify(DATE_HUGE):
      return "EEEE, LLLL d, yyyy";

    case stringify(TIME_SIMPLE):
      return "h:mm a";

    case stringify(TIME_WITH_SECONDS):
      return "h:mm:ss a";

    case stringify(TIME_WITH_SHORT_OFFSET):
      return "h:mm a";

    case stringify(TIME_WITH_LONG_OFFSET):
      return "h:mm a";

    case stringify(TIME_24_SIMPLE):
      return "HH:mm";

    case stringify(TIME_24_WITH_SECONDS):
      return "HH:mm:ss";

    case stringify(TIME_24_WITH_SHORT_OFFSET):
      return "HH:mm";

    case stringify(TIME_24_WITH_LONG_OFFSET):
      return "HH:mm";

    case stringify(DATETIME_SHORT):
      return "M/d/yyyy, h:mm a";

    case stringify(DATETIME_MED):
      return "LLL d, yyyy, h:mm a";

    case stringify(DATETIME_FULL):
      return "LLLL d, yyyy, h:mm a";

    case stringify(DATETIME_HUGE):
      return dateTimeHuge;

    case stringify(DATETIME_SHORT_WITH_SECONDS):
      return "M/d/yyyy, h:mm:ss a";

    case stringify(DATETIME_MED_WITH_SECONDS):
      return "LLL d, yyyy, h:mm:ss a";

    case stringify(DATETIME_MED_WITH_WEEKDAY):
      return "EEE, d LLL yyyy, h:mm a";

    case stringify(DATETIME_FULL_WITH_SECONDS):
      return "LLLL d, yyyy, h:mm:ss a";

    case stringify(DATETIME_HUGE_WITH_SECONDS):
      return "EEEE, LLLL d, yyyy, h:mm:ss a";

    default:
      return dateTimeHuge;
  }
}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/formatter.js
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }





function stringifyTokens(splits, tokenToString) {
  let s = "";

  var _iterator = _createForOfIteratorHelper(splits),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      const token = _step.value;

      if (token.literal) {
        s += token.val;
      } else {
        s += tokenToString(token.val);
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return s;
}

const macroTokenToFormatOpts = {
  D: DATE_SHORT,
  DD: DATE_MED,
  DDD: DATE_FULL,
  DDDD: DATE_HUGE,
  t: TIME_SIMPLE,
  tt: TIME_WITH_SECONDS,
  ttt: TIME_WITH_SHORT_OFFSET,
  tttt: TIME_WITH_LONG_OFFSET,
  T: TIME_24_SIMPLE,
  TT: TIME_24_WITH_SECONDS,
  TTT: TIME_24_WITH_SHORT_OFFSET,
  TTTT: TIME_24_WITH_LONG_OFFSET,
  f: DATETIME_SHORT,
  ff: DATETIME_MED,
  fff: DATETIME_FULL,
  ffff: DATETIME_HUGE,
  F: DATETIME_SHORT_WITH_SECONDS,
  FF: DATETIME_MED_WITH_SECONDS,
  FFF: DATETIME_FULL_WITH_SECONDS,
  FFFF: DATETIME_HUGE_WITH_SECONDS
};
/**
 * @private
 */

class Formatter {
  static create(locale) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return new Formatter(locale, opts);
  }

  static parseFormat(fmt) {
    let current = null,
        currentFull = "",
        bracketed = false;
    const splits = [];

    for (let i = 0; i < fmt.length; i++) {
      const c = fmt.charAt(i);

      if (c === "'") {
        if (currentFull.length > 0) {
          splits.push({
            literal: bracketed,
            val: currentFull
          });
        }

        current = null;
        currentFull = "";
        bracketed = !bracketed;
      } else if (bracketed) {
        currentFull += c;
      } else if (c === current) {
        currentFull += c;
      } else {
        if (currentFull.length > 0) {
          splits.push({
            literal: false,
            val: currentFull
          });
        }

        currentFull = c;
        current = c;
      }
    }

    if (currentFull.length > 0) {
      splits.push({
        literal: bracketed,
        val: currentFull
      });
    }

    return splits;
  }

  static macroTokenToFormatOpts(token) {
    return macroTokenToFormatOpts[token];
  }

  constructor(locale, formatOpts) {
    this.opts = formatOpts;
    this.loc = locale;
    this.systemLoc = null;
  }

  formatWithSystemDefault(dt, opts) {
    if (this.systemLoc === null) {
      this.systemLoc = this.loc.redefaultToSystem();
    }

    const df = this.systemLoc.dtFormatter(dt, Object.assign({}, this.opts, opts));
    return df.format();
  }

  formatDateTime(dt) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    const df = this.loc.dtFormatter(dt, Object.assign({}, this.opts, opts));
    return df.format();
  }

  formatDateTimeParts(dt) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    const df = this.loc.dtFormatter(dt, Object.assign({}, this.opts, opts));
    return df.formatToParts();
  }

  resolvedOptions(dt) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    const df = this.loc.dtFormatter(dt, Object.assign({}, this.opts, opts));
    return df.resolvedOptions();
  }

  num(n) {
    let p = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

    // we get some perf out of doing this here, annoyingly
    if (this.opts.forceSimple) {
      return padStart(n, p);
    }

    const opts = Object.assign({}, this.opts);

    if (p > 0) {
      opts.padTo = p;
    }

    return this.loc.numberFormatter(opts).format(n);
  }

  formatDateTimeFromString(dt, fmt) {
    const knownEnglish = this.loc.listingMode() === "en",
          useDateTimeFormatter = this.loc.outputCalendar && this.loc.outputCalendar !== "gregory" && hasFormatToParts(),
          string = (opts, extract) => this.loc.extract(dt, opts, extract),
          formatOffset = opts => {
      if (dt.isOffsetFixed && dt.offset === 0 && opts.allowZ) {
        return "Z";
      }

      return dt.isValid ? dt.zone.formatOffset(dt.ts, opts.format) : "";
    },
          meridiem = () => knownEnglish ? meridiemForDateTime(dt) : string({
      hour: "numeric",
      hour12: true
    }, "dayperiod"),
          month = (length, standalone) => knownEnglish ? monthForDateTime(dt, length) : string(standalone ? {
      month: length
    } : {
      month: length,
      day: "numeric"
    }, "month"),
          weekday = (length, standalone) => knownEnglish ? weekdayForDateTime(dt, length) : string(standalone ? {
      weekday: length
    } : {
      weekday: length,
      month: "long",
      day: "numeric"
    }, "weekday"),
          maybeMacro = token => {
      const formatOpts = Formatter.macroTokenToFormatOpts(token);

      if (formatOpts) {
        return this.formatWithSystemDefault(dt, formatOpts);
      } else {
        return token;
      }
    },
          era = length => knownEnglish ? eraForDateTime(dt, length) : string({
      era: length
    }, "era"),
          tokenToString = token => {
      // Where possible: http://cldr.unicode.org/translation/date-time-1/date-time#TOC-Standalone-vs.-Format-Styles
      switch (token) {
        // ms
        case "S":
          return this.num(dt.millisecond);

        case "u": // falls through

        case "SSS":
          return this.num(dt.millisecond, 3);
        // seconds

        case "s":
          return this.num(dt.second);

        case "ss":
          return this.num(dt.second, 2);
        // minutes

        case "m":
          return this.num(dt.minute);

        case "mm":
          return this.num(dt.minute, 2);
        // hours

        case "h":
          return this.num(dt.hour % 12 === 0 ? 12 : dt.hour % 12);

        case "hh":
          return this.num(dt.hour % 12 === 0 ? 12 : dt.hour % 12, 2);

        case "H":
          return this.num(dt.hour);

        case "HH":
          return this.num(dt.hour, 2);
        // offset

        case "Z":
          // like +6
          return formatOffset({
            format: "narrow",
            allowZ: this.opts.allowZ
          });

        case "ZZ":
          // like +06:00
          return formatOffset({
            format: "short",
            allowZ: this.opts.allowZ
          });

        case "ZZZ":
          // like +0600
          return formatOffset({
            format: "techie",
            allowZ: this.opts.allowZ
          });

        case "ZZZZ":
          // like EST
          return dt.zone.offsetName(dt.ts, {
            format: "short",
            locale: this.loc.locale
          });

        case "ZZZZZ":
          // like Eastern Standard Time
          return dt.zone.offsetName(dt.ts, {
            format: "long",
            locale: this.loc.locale
          });
        // zone

        case "z":
          // like America/New_York
          return dt.zoneName;
        // meridiems

        case "a":
          return meridiem();
        // dates

        case "d":
          return useDateTimeFormatter ? string({
            day: "numeric"
          }, "day") : this.num(dt.day);

        case "dd":
          return useDateTimeFormatter ? string({
            day: "2-digit"
          }, "day") : this.num(dt.day, 2);
        // weekdays - standalone

        case "c":
          // like 1
          return this.num(dt.weekday);

        case "ccc":
          // like 'Tues'
          return weekday("short", true);

        case "cccc":
          // like 'Tuesday'
          return weekday("long", true);

        case "ccccc":
          // like 'T'
          return weekday("narrow", true);
        // weekdays - format

        case "E":
          // like 1
          return this.num(dt.weekday);

        case "EEE":
          // like 'Tues'
          return weekday("short", false);

        case "EEEE":
          // like 'Tuesday'
          return weekday("long", false);

        case "EEEEE":
          // like 'T'
          return weekday("narrow", false);
        // months - standalone

        case "L":
          // like 1
          return useDateTimeFormatter ? string({
            month: "numeric",
            day: "numeric"
          }, "month") : this.num(dt.month);

        case "LL":
          // like 01, doesn't seem to work
          return useDateTimeFormatter ? string({
            month: "2-digit",
            day: "numeric"
          }, "month") : this.num(dt.month, 2);

        case "LLL":
          // like Jan
          return month("short", true);

        case "LLLL":
          // like January
          return month("long", true);

        case "LLLLL":
          // like J
          return month("narrow", true);
        // months - format

        case "M":
          // like 1
          return useDateTimeFormatter ? string({
            month: "numeric"
          }, "month") : this.num(dt.month);

        case "MM":
          // like 01
          return useDateTimeFormatter ? string({
            month: "2-digit"
          }, "month") : this.num(dt.month, 2);

        case "MMM":
          // like Jan
          return month("short", false);

        case "MMMM":
          // like January
          return month("long", false);

        case "MMMMM":
          // like J
          return month("narrow", false);
        // years

        case "y":
          // like 2014
          return useDateTimeFormatter ? string({
            year: "numeric"
          }, "year") : this.num(dt.year);

        case "yy":
          // like 14
          return useDateTimeFormatter ? string({
            year: "2-digit"
          }, "year") : this.num(dt.year.toString().slice(-2), 2);

        case "yyyy":
          // like 0012
          return useDateTimeFormatter ? string({
            year: "numeric"
          }, "year") : this.num(dt.year, 4);

        case "yyyyyy":
          // like 000012
          return useDateTimeFormatter ? string({
            year: "numeric"
          }, "year") : this.num(dt.year, 6);
        // eras

        case "G":
          // like AD
          return era("short");

        case "GG":
          // like Anno Domini
          return era("long");

        case "GGGGG":
          return era("narrow");

        case "kk":
          return this.num(dt.weekYear.toString().slice(-2), 2);

        case "kkkk":
          return this.num(dt.weekYear, 4);

        case "W":
          return this.num(dt.weekNumber);

        case "WW":
          return this.num(dt.weekNumber, 2);

        case "o":
          return this.num(dt.ordinal);

        case "ooo":
          return this.num(dt.ordinal, 3);

        case "q":
          // like 1
          return this.num(dt.quarter);

        case "qq":
          // like 01
          return this.num(dt.quarter, 2);

        case "X":
          return this.num(Math.floor(dt.ts / 1000));

        case "x":
          return this.num(dt.ts);

        default:
          return maybeMacro(token);
      }
    };

    return stringifyTokens(Formatter.parseFormat(fmt), tokenToString);
  }

  formatDurationFromString(dur, fmt) {
    const tokenToField = token => {
      switch (token[0]) {
        case "S":
          return "millisecond";

        case "s":
          return "second";

        case "m":
          return "minute";

        case "h":
          return "hour";

        case "d":
          return "day";

        case "M":
          return "month";

        case "y":
          return "year";

        default:
          return null;
      }
    },
          tokenToString = lildur => token => {
      const mapped = tokenToField(token);

      if (mapped) {
        return this.num(lildur.get(mapped), token.length);
      } else {
        return token;
      }
    },
          tokens = Formatter.parseFormat(fmt),
          realTokens = tokens.reduce((found, _ref) => {
      let literal = _ref.literal,
          val = _ref.val;
      return literal ? found : found.concat(val);
    }, []),
          collapsed = dur.shiftTo(...realTokens.map(tokenToField).filter(t => t));

    return stringifyTokens(tokens, tokenToString(collapsed));
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/invalid.js
class Invalid {
  constructor(reason, explanation) {
    this.reason = reason;
    this.explanation = explanation;
  }

  toMessage() {
    if (this.explanation) {
      return `${this.reason}: ${this.explanation}`;
    } else {
      return this.reason;
    }
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/zone.js
/* eslint no-unused-vars: "off" */

/**
 * @interface
 */

class Zone {
  /**
   * The type of zone
   * @abstract
   * @type {string}
   */
  get type() {
    throw new ZoneIsAbstractError();
  }
  /**
   * The name of this zone.
   * @abstract
   * @type {string}
   */


  get name() {
    throw new ZoneIsAbstractError();
  }
  /**
   * Returns whether the offset is known to be fixed for the whole year.
   * @abstract
   * @type {boolean}
   */


  get universal() {
    throw new ZoneIsAbstractError();
  }
  /**
   * Returns the offset's common name (such as EST) at the specified timestamp
   * @abstract
   * @param {number} ts - Epoch milliseconds for which to get the name
   * @param {Object} opts - Options to affect the format
   * @param {string} opts.format - What style of offset to return. Accepts 'long' or 'short'.
   * @param {string} opts.locale - What locale to return the offset name in.
   * @return {string}
   */


  offsetName(ts, opts) {
    throw new ZoneIsAbstractError();
  }
  /**
   * Returns the offset's value as a string
   * @abstract
   * @param {number} ts - Epoch milliseconds for which to get the offset
   * @param {string} format - What style of offset to return.
   *                          Accepts 'narrow', 'short', or 'techie'. Returning '+6', '+06:00', or '+0600' respectively
   * @return {string}
   */


  formatOffset(ts, format) {
    throw new ZoneIsAbstractError();
  }
  /**
   * Return the offset in minutes for this zone at the specified timestamp.
   * @abstract
   * @param {number} ts - Epoch milliseconds for which to compute the offset
   * @return {number}
   */


  offset(ts) {
    throw new ZoneIsAbstractError();
  }
  /**
   * Return whether this Zone is equal to another zone
   * @abstract
   * @param {Zone} otherZone - the zone to compare
   * @return {boolean}
   */


  equals(otherZone) {
    throw new ZoneIsAbstractError();
  }
  /**
   * Return whether this Zone is valid.
   * @abstract
   * @type {boolean}
   */


  get isValid() {
    throw new ZoneIsAbstractError();
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/zones/localZone.js


let singleton = null;
/**
 * Represents the local zone for this JavaScript environment.
 * @implements {Zone}
 */

class LocalZone extends Zone {
  /**
   * Get a singleton instance of the local zone
   * @return {LocalZone}
   */
  static get instance() {
    if (singleton === null) {
      singleton = new LocalZone();
    }

    return singleton;
  }
  /** @override **/


  get type() {
    return "local";
  }
  /** @override **/


  get name() {
    if (hasIntl()) {
      return new Intl.DateTimeFormat().resolvedOptions().timeZone;
    } else return "local";
  }
  /** @override **/


  get universal() {
    return false;
  }
  /** @override **/


  offsetName(ts, _ref) {
    let format = _ref.format,
        locale = _ref.locale;
    return parseZoneInfo(ts, format, locale);
  }
  /** @override **/


  formatOffset(ts, format) {
    return formatOffset(this.offset(ts), format);
  }
  /** @override **/


  offset(ts) {
    return -new Date(ts).getTimezoneOffset();
  }
  /** @override **/


  equals(otherZone) {
    return otherZone.type === "local";
  }
  /** @override **/


  get isValid() {
    return true;
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/zones/IANAZone.js
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || IANAZone_unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function IANAZone_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return IANAZone_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return IANAZone_arrayLikeToArray(o, minLen); }

function IANAZone_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function _iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }



const matchingRegex = RegExp(`^${ianaRegex.source}$`);
let dtfCache = {};

function makeDTF(zone) {
  if (!dtfCache[zone]) {
    dtfCache[zone] = new Intl.DateTimeFormat("en-US", {
      hour12: false,
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  return dtfCache[zone];
}

const typeToPos = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
  minute: 4,
  second: 5
};

function hackyOffset(dtf, date) {
  const formatted = dtf.format(date).replace(/\u200E/g, ""),
        parsed = /(\d+)\/(\d+)\/(\d+),? (\d+):(\d+):(\d+)/.exec(formatted),
        _parsed = _slicedToArray(parsed, 7),
        fMonth = _parsed[1],
        fDay = _parsed[2],
        fYear = _parsed[3],
        fHour = _parsed[4],
        fMinute = _parsed[5],
        fSecond = _parsed[6];

  return [fYear, fMonth, fDay, fHour, fMinute, fSecond];
}

function partsOffset(dtf, date) {
  const formatted = dtf.formatToParts(date),
        filled = [];

  for (let i = 0; i < formatted.length; i++) {
    const _formatted$i = formatted[i],
          type = _formatted$i.type,
          value = _formatted$i.value,
          pos = typeToPos[type];

    if (!isUndefined(pos)) {
      filled[pos] = parseInt(value, 10);
    }
  }

  return filled;
}

let ianaZoneCache = {};
/**
 * A zone identified by an IANA identifier, like America/New_York
 * @implements {Zone}
 */

class IANAZone extends Zone {
  /**
   * @param {string} name - Zone name
   * @return {IANAZone}
   */
  static create(name) {
    if (!ianaZoneCache[name]) {
      ianaZoneCache[name] = new IANAZone(name);
    }

    return ianaZoneCache[name];
  }
  /**
   * Reset local caches. Should only be necessary in testing scenarios.
   * @return {void}
   */


  static resetCache() {
    ianaZoneCache = {};
    dtfCache = {};
  }
  /**
   * Returns whether the provided string is a valid specifier. This only checks the string's format, not that the specifier identifies a known zone; see isValidZone for that.
   * @param {string} s - The string to check validity on
   * @example IANAZone.isValidSpecifier("America/New_York") //=> true
   * @example IANAZone.isValidSpecifier("Fantasia/Castle") //=> true
   * @example IANAZone.isValidSpecifier("Sport~~blorp") //=> false
   * @return {boolean}
   */


  static isValidSpecifier(s) {
    return !!(s && s.match(matchingRegex));
  }
  /**
   * Returns whether the provided string identifies a real zone
   * @param {string} zone - The string to check
   * @example IANAZone.isValidZone("America/New_York") //=> true
   * @example IANAZone.isValidZone("Fantasia/Castle") //=> false
   * @example IANAZone.isValidZone("Sport~~blorp") //=> false
   * @return {boolean}
   */


  static isValidZone(zone) {
    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone
      }).format();
      return true;
    } catch (e) {
      return false;
    }
  } // Etc/GMT+8 -> -480

  /** @ignore */


  static parseGMTOffset(specifier) {
    if (specifier) {
      const match = specifier.match(/^Etc\/GMT(0|[+-]\d{1,2})$/i);

      if (match) {
        return -60 * parseInt(match[1]);
      }
    }

    return null;
  }

  constructor(name) {
    super();
    /** @private **/

    this.zoneName = name;
    /** @private **/

    this.valid = IANAZone.isValidZone(name);
  }
  /** @override **/


  get type() {
    return "iana";
  }
  /** @override **/


  get name() {
    return this.zoneName;
  }
  /** @override **/


  get universal() {
    return false;
  }
  /** @override **/


  offsetName(ts, _ref) {
    let format = _ref.format,
        locale = _ref.locale;
    return parseZoneInfo(ts, format, locale, this.name);
  }
  /** @override **/


  formatOffset(ts, format) {
    return formatOffset(this.offset(ts), format);
  }
  /** @override **/


  offset(ts) {
    const date = new Date(ts);
    if (isNaN(date)) return NaN;

    const dtf = makeDTF(this.name),
          _ref2 = dtf.formatToParts ? partsOffset(dtf, date) : hackyOffset(dtf, date),
          _ref3 = _slicedToArray(_ref2, 6),
          year = _ref3[0],
          month = _ref3[1],
          day = _ref3[2],
          hour = _ref3[3],
          minute = _ref3[4],
          second = _ref3[5],
          adjustedHour = hour === 24 ? 0 : hour;

    const asUTC = objToLocalTS({
      year,
      month,
      day,
      hour: adjustedHour,
      minute,
      second,
      millisecond: 0
    });
    let asTS = +date;
    const over = asTS % 1000;
    asTS -= over >= 0 ? over : 1000 + over;
    return (asUTC - asTS) / (60 * 1000);
  }
  /** @override **/


  equals(otherZone) {
    return otherZone.type === "iana" && otherZone.name === this.name;
  }
  /** @override **/


  get isValid() {
    return this.valid;
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/zones/fixedOffsetZone.js


let fixedOffsetZone_singleton = null;
/**
 * A zone with a fixed offset (meaning no DST)
 * @implements {Zone}
 */

class FixedOffsetZone extends Zone {
  /**
   * Get a singleton instance of UTC
   * @return {FixedOffsetZone}
   */
  static get utcInstance() {
    if (fixedOffsetZone_singleton === null) {
      fixedOffsetZone_singleton = new FixedOffsetZone(0);
    }

    return fixedOffsetZone_singleton;
  }
  /**
   * Get an instance with a specified offset
   * @param {number} offset - The offset in minutes
   * @return {FixedOffsetZone}
   */


  static instance(offset) {
    return offset === 0 ? FixedOffsetZone.utcInstance : new FixedOffsetZone(offset);
  }
  /**
   * Get an instance of FixedOffsetZone from a UTC offset string, like "UTC+6"
   * @param {string} s - The offset string to parse
   * @example FixedOffsetZone.parseSpecifier("UTC+6")
   * @example FixedOffsetZone.parseSpecifier("UTC+06")
   * @example FixedOffsetZone.parseSpecifier("UTC-6:00")
   * @return {FixedOffsetZone}
   */


  static parseSpecifier(s) {
    if (s) {
      const r = s.match(/^utc(?:([+-]\d{1,2})(?::(\d{2}))?)?$/i);

      if (r) {
        return new FixedOffsetZone(signedOffset(r[1], r[2]));
      }
    }

    return null;
  }

  constructor(offset) {
    super();
    /** @private **/

    this.fixed = offset;
  }
  /** @override **/


  get type() {
    return "fixed";
  }
  /** @override **/


  get name() {
    return this.fixed === 0 ? "UTC" : `UTC${formatOffset(this.fixed, "narrow")}`;
  }
  /** @override **/


  offsetName() {
    return this.name;
  }
  /** @override **/


  formatOffset(ts, format) {
    return formatOffset(this.fixed, format);
  }
  /** @override **/


  get universal() {
    return true;
  }
  /** @override **/


  offset() {
    return this.fixed;
  }
  /** @override **/


  equals(otherZone) {
    return otherZone.type === "fixed" && otherZone.fixed === this.fixed;
  }
  /** @override **/


  get isValid() {
    return true;
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/zones/invalidZone.js

/**
 * A zone that failed to parse. You should never need to instantiate this.
 * @implements {Zone}
 */

class InvalidZone extends Zone {
  constructor(zoneName) {
    super();
    /**  @private */

    this.zoneName = zoneName;
  }
  /** @override **/


  get type() {
    return "invalid";
  }
  /** @override **/


  get name() {
    return this.zoneName;
  }
  /** @override **/


  get universal() {
    return false;
  }
  /** @override **/


  offsetName() {
    return null;
  }
  /** @override **/


  formatOffset() {
    return "";
  }
  /** @override **/


  offset() {
    return NaN;
  }
  /** @override **/


  equals() {
    return false;
  }
  /** @override **/


  get isValid() {
    return false;
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/zoneUtil.js
/**
 * @private
 */





function normalizeZone(input, defaultZone) {
  let offset;

  if (isUndefined(input) || input === null) {
    return defaultZone;
  } else if (input instanceof Zone) {
    return input;
  } else if (isString(input)) {
    const lowered = input.toLowerCase();
    if (lowered === "local") return defaultZone;else if (lowered === "utc" || lowered === "gmt") return FixedOffsetZone.utcInstance;else if ((offset = IANAZone.parseGMTOffset(input)) != null) {
      // handle Etc/GMT-4, which V8 chokes on
      return FixedOffsetZone.instance(offset);
    } else if (IANAZone.isValidSpecifier(lowered)) return IANAZone.create(input);else return FixedOffsetZone.parseSpecifier(lowered) || new InvalidZone(input);
  } else if (isNumber(input)) {
    return FixedOffsetZone.instance(input);
  } else if (typeof input === "object" && input.offset && typeof input.offset === "number") {
    // This is dumb, but the instanceof check above doesn't seem to really work
    // so we're duck checking it
    return input;
  } else {
    return new InvalidZone(input);
  }
}
;// CONCATENATED MODULE: ./node_modules/luxon/src/settings.js





let now = () => Date.now(),
    defaultZone = null,
    // not setting this directly to LocalZone.instance bc loading order issues
defaultLocale = null,
    defaultNumberingSystem = null,
    defaultOutputCalendar = null,
    throwOnInvalid = false;
/**
 * Settings contains static getters and setters that control Luxon's overall behavior. Luxon is a simple library with few options, but the ones it does have live here.
 */


class Settings {
  /**
   * Get the callback for returning the current timestamp.
   * @type {function}
   */
  static get now() {
    return now;
  }
  /**
   * Set the callback for returning the current timestamp.
   * The function should return a number, which will be interpreted as an Epoch millisecond count
   * @type {function}
   * @example Settings.now = () => Date.now() + 3000 // pretend it is 3 seconds in the future
   * @example Settings.now = () => 0 // always pretend it's Jan 1, 1970 at midnight in UTC time
   */


  static set now(n) {
    now = n;
  }
  /**
   * Get the default time zone to create DateTimes in.
   * @type {string}
   */


  static get defaultZoneName() {
    return Settings.defaultZone.name;
  }
  /**
   * Set the default time zone to create DateTimes in. Does not affect existing instances.
   * @type {string}
   */


  static set defaultZoneName(z) {
    if (!z) {
      defaultZone = null;
    } else {
      defaultZone = normalizeZone(z);
    }
  }
  /**
   * Get the default time zone object to create DateTimes in. Does not affect existing instances.
   * @type {Zone}
   */


  static get defaultZone() {
    return defaultZone || LocalZone.instance;
  }
  /**
   * Get the default locale to create DateTimes with. Does not affect existing instances.
   * @type {string}
   */


  static get defaultLocale() {
    return defaultLocale;
  }
  /**
   * Set the default locale to create DateTimes with. Does not affect existing instances.
   * @type {string}
   */


  static set defaultLocale(locale) {
    defaultLocale = locale;
  }
  /**
   * Get the default numbering system to create DateTimes with. Does not affect existing instances.
   * @type {string}
   */


  static get defaultNumberingSystem() {
    return defaultNumberingSystem;
  }
  /**
   * Set the default numbering system to create DateTimes with. Does not affect existing instances.
   * @type {string}
   */


  static set defaultNumberingSystem(numberingSystem) {
    defaultNumberingSystem = numberingSystem;
  }
  /**
   * Get the default output calendar to create DateTimes with. Does not affect existing instances.
   * @type {string}
   */


  static get defaultOutputCalendar() {
    return defaultOutputCalendar;
  }
  /**
   * Set the default output calendar to create DateTimes with. Does not affect existing instances.
   * @type {string}
   */


  static set defaultOutputCalendar(outputCalendar) {
    defaultOutputCalendar = outputCalendar;
  }
  /**
   * Get whether Luxon will throw when it encounters invalid DateTimes, Durations, or Intervals
   * @type {boolean}
   */


  static get throwOnInvalid() {
    return throwOnInvalid;
  }
  /**
   * Set whether Luxon will throw when it encounters invalid DateTimes, Durations, or Intervals
   * @type {boolean}
   */


  static set throwOnInvalid(t) {
    throwOnInvalid = t;
  }
  /**
   * Reset Luxon's global caches. Should only be necessary in testing scenarios.
   * @return {void}
   */


  static resetCaches() {
    Locale.resetCache();
    IANAZone.resetCache();
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/locale.js
const _excluded = ["base"];

function locale_slicedToArray(arr, i) { return locale_arrayWithHoles(arr) || locale_iterableToArrayLimit(arr, i) || locale_unsupportedIterableToArray(arr, i) || locale_nonIterableRest(); }

function locale_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function locale_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return locale_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return locale_arrayLikeToArray(o, minLen); }

function locale_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function locale_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function locale_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }







let intlDTCache = {};

function getCachedDTF(locString) {
  let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  const key = JSON.stringify([locString, opts]);
  let dtf = intlDTCache[key];

  if (!dtf) {
    dtf = new Intl.DateTimeFormat(locString, opts);
    intlDTCache[key] = dtf;
  }

  return dtf;
}

let intlNumCache = {};

function getCachedINF(locString) {
  let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  const key = JSON.stringify([locString, opts]);
  let inf = intlNumCache[key];

  if (!inf) {
    inf = new Intl.NumberFormat(locString, opts);
    intlNumCache[key] = inf;
  }

  return inf;
}

let intlRelCache = {};

function getCachedRTF(locString) {
  let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  const base = opts.base,
        cacheKeyOpts = _objectWithoutProperties(opts, _excluded); // exclude `base` from the options


  const key = JSON.stringify([locString, cacheKeyOpts]);
  let inf = intlRelCache[key];

  if (!inf) {
    inf = new Intl.RelativeTimeFormat(locString, opts);
    intlRelCache[key] = inf;
  }

  return inf;
}

let sysLocaleCache = null;

function systemLocale() {
  if (sysLocaleCache) {
    return sysLocaleCache;
  } else if (hasIntl()) {
    const computedSys = new Intl.DateTimeFormat().resolvedOptions().locale; // node sometimes defaults to "und". Override that because that is dumb

    sysLocaleCache = !computedSys || computedSys === "und" ? "en-US" : computedSys;
    return sysLocaleCache;
  } else {
    sysLocaleCache = "en-US";
    return sysLocaleCache;
  }
}

function parseLocaleString(localeStr) {
  // I really want to avoid writing a BCP 47 parser
  // see, e.g. https://github.com/wooorm/bcp-47
  // Instead, we'll do this:
  // a) if the string has no -u extensions, just leave it alone
  // b) if it does, use Intl to resolve everything
  // c) if Intl fails, try again without the -u
  const uIndex = localeStr.indexOf("-u-");

  if (uIndex === -1) {
    return [localeStr];
  } else {
    let options;
    const smaller = localeStr.substring(0, uIndex);

    try {
      options = getCachedDTF(localeStr).resolvedOptions();
    } catch (e) {
      options = getCachedDTF(smaller).resolvedOptions();
    }

    const _options = options,
          numberingSystem = _options.numberingSystem,
          calendar = _options.calendar; // return the smaller one so that we can append the calendar and numbering overrides to it

    return [smaller, numberingSystem, calendar];
  }
}

function intlConfigString(localeStr, numberingSystem, outputCalendar) {
  if (hasIntl()) {
    if (outputCalendar || numberingSystem) {
      localeStr += "-u";

      if (outputCalendar) {
        localeStr += `-ca-${outputCalendar}`;
      }

      if (numberingSystem) {
        localeStr += `-nu-${numberingSystem}`;
      }

      return localeStr;
    } else {
      return localeStr;
    }
  } else {
    return [];
  }
}

function mapMonths(f) {
  const ms = [];

  for (let i = 1; i <= 12; i++) {
    const dt = DateTime.utc(2016, i, 1);
    ms.push(f(dt));
  }

  return ms;
}

function mapWeekdays(f) {
  const ms = [];

  for (let i = 1; i <= 7; i++) {
    const dt = DateTime.utc(2016, 11, 13 + i);
    ms.push(f(dt));
  }

  return ms;
}

function listStuff(loc, length, defaultOK, englishFn, intlFn) {
  const mode = loc.listingMode(defaultOK);

  if (mode === "error") {
    return null;
  } else if (mode === "en") {
    return englishFn(length);
  } else {
    return intlFn(length);
  }
}

function supportsFastNumbers(loc) {
  if (loc.numberingSystem && loc.numberingSystem !== "latn") {
    return false;
  } else {
    return loc.numberingSystem === "latn" || !loc.locale || loc.locale.startsWith("en") || hasIntl() && new Intl.DateTimeFormat(loc.intl).resolvedOptions().numberingSystem === "latn";
  }
}
/**
 * @private
 */


class PolyNumberFormatter {
  constructor(intl, forceSimple, opts) {
    this.padTo = opts.padTo || 0;
    this.floor = opts.floor || false;

    if (!forceSimple && hasIntl()) {
      const intlOpts = {
        useGrouping: false
      };
      if (opts.padTo > 0) intlOpts.minimumIntegerDigits = opts.padTo;
      this.inf = getCachedINF(intl, intlOpts);
    }
  }

  format(i) {
    if (this.inf) {
      const fixed = this.floor ? Math.floor(i) : i;
      return this.inf.format(fixed);
    } else {
      // to match the browser's numberformatter defaults
      const fixed = this.floor ? Math.floor(i) : roundTo(i, 3);
      return padStart(fixed, this.padTo);
    }
  }

}
/**
 * @private
 */


class PolyDateFormatter {
  constructor(dt, intl, opts) {
    this.opts = opts;
    this.hasIntl = hasIntl();
    let z;

    if (dt.zone.universal && this.hasIntl) {
      // UTC-8 or Etc/UTC-8 are not part of tzdata, only Etc/GMT+8 and the like.
      // That is why fixed-offset TZ is set to that unless it is:
      // 1. Representing offset 0 when UTC is used to maintain previous behavior and does not become GMT.
      // 2. Unsupported by the browser:
      //    - some do not support Etc/
      //    - < Etc/GMT-14, > Etc/GMT+12, and 30-minute or 45-minute offsets are not part of tzdata
      const gmtOffset = -1 * (dt.offset / 60);
      const offsetZ = gmtOffset >= 0 ? `Etc/GMT+${gmtOffset}` : `Etc/GMT${gmtOffset}`;
      const isOffsetZoneSupported = IANAZone.isValidZone(offsetZ);

      if (dt.offset !== 0 && isOffsetZoneSupported) {
        z = offsetZ;
        this.dt = dt;
      } else {
        // Not all fixed-offset zones like Etc/+4:30 are present in tzdata.
        // So we have to make do. Two cases:
        // 1. The format options tell us to show the zone. We can't do that, so the best
        // we can do is format the date in UTC.
        // 2. The format options don't tell us to show the zone. Then we can adjust them
        // the time and tell the formatter to show it to us in UTC, so that the time is right
        // and the bad zone doesn't show up.
        z = "UTC";

        if (opts.timeZoneName) {
          this.dt = dt;
        } else {
          this.dt = dt.offset === 0 ? dt : DateTime.fromMillis(dt.ts + dt.offset * 60 * 1000);
        }
      }
    } else if (dt.zone.type === "local") {
      this.dt = dt;
    } else {
      this.dt = dt;
      z = dt.zone.name;
    }

    if (this.hasIntl) {
      const intlOpts = Object.assign({}, this.opts);

      if (z) {
        intlOpts.timeZone = z;
      }

      this.dtf = getCachedDTF(intl, intlOpts);
    }
  }

  format() {
    if (this.hasIntl) {
      return this.dtf.format(this.dt.toJSDate());
    } else {
      const tokenFormat = formatString(this.opts),
            loc = Locale.create("en-US");
      return Formatter.create(loc).formatDateTimeFromString(this.dt, tokenFormat);
    }
  }

  formatToParts() {
    if (this.hasIntl && hasFormatToParts()) {
      return this.dtf.formatToParts(this.dt.toJSDate());
    } else {
      // This is kind of a cop out. We actually could do this for English. However, we couldn't do it for intl strings
      // and IMO it's too weird to have an uncanny valley like that
      return [];
    }
  }

  resolvedOptions() {
    if (this.hasIntl) {
      return this.dtf.resolvedOptions();
    } else {
      return {
        locale: "en-US",
        numberingSystem: "latn",
        outputCalendar: "gregory"
      };
    }
  }

}
/**
 * @private
 */


class PolyRelFormatter {
  constructor(intl, isEnglish, opts) {
    this.opts = Object.assign({
      style: "long"
    }, opts);

    if (!isEnglish && hasRelative()) {
      this.rtf = getCachedRTF(intl, opts);
    }
  }

  format(count, unit) {
    if (this.rtf) {
      return this.rtf.format(count, unit);
    } else {
      return formatRelativeTime(unit, count, this.opts.numeric, this.opts.style !== "long");
    }
  }

  formatToParts(count, unit) {
    if (this.rtf) {
      return this.rtf.formatToParts(count, unit);
    } else {
      return [];
    }
  }

}
/**
 * @private
 */


class Locale {
  static fromOpts(opts) {
    return Locale.create(opts.locale, opts.numberingSystem, opts.outputCalendar, opts.defaultToEN);
  }

  static create(locale, numberingSystem, outputCalendar) {
    let defaultToEN = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    const specifiedLocale = locale || Settings.defaultLocale,
          // the system locale is useful for human readable strings but annoying for parsing/formatting known formats
    localeR = specifiedLocale || (defaultToEN ? "en-US" : systemLocale()),
          numberingSystemR = numberingSystem || Settings.defaultNumberingSystem,
          outputCalendarR = outputCalendar || Settings.defaultOutputCalendar;
    return new Locale(localeR, numberingSystemR, outputCalendarR, specifiedLocale);
  }

  static resetCache() {
    sysLocaleCache = null;
    intlDTCache = {};
    intlNumCache = {};
    intlRelCache = {};
  }

  static fromObject() {
    let _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        locale = _ref.locale,
        numberingSystem = _ref.numberingSystem,
        outputCalendar = _ref.outputCalendar;

    return Locale.create(locale, numberingSystem, outputCalendar);
  }

  constructor(locale, numbering, outputCalendar, specifiedLocale) {
    const _parseLocaleString = parseLocaleString(locale),
          _parseLocaleString2 = locale_slicedToArray(_parseLocaleString, 3),
          parsedLocale = _parseLocaleString2[0],
          parsedNumberingSystem = _parseLocaleString2[1],
          parsedOutputCalendar = _parseLocaleString2[2];

    this.locale = parsedLocale;
    this.numberingSystem = numbering || parsedNumberingSystem || null;
    this.outputCalendar = outputCalendar || parsedOutputCalendar || null;
    this.intl = intlConfigString(this.locale, this.numberingSystem, this.outputCalendar);
    this.weekdaysCache = {
      format: {},
      standalone: {}
    };
    this.monthsCache = {
      format: {},
      standalone: {}
    };
    this.meridiemCache = null;
    this.eraCache = {};
    this.specifiedLocale = specifiedLocale;
    this.fastNumbersCached = null;
  }

  get fastNumbers() {
    if (this.fastNumbersCached == null) {
      this.fastNumbersCached = supportsFastNumbers(this);
    }

    return this.fastNumbersCached;
  }

  listingMode() {
    let defaultOK = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    const intl = hasIntl(),
          hasFTP = intl && hasFormatToParts(),
          isActuallyEn = this.isEnglish(),
          hasNoWeirdness = (this.numberingSystem === null || this.numberingSystem === "latn") && (this.outputCalendar === null || this.outputCalendar === "gregory");

    if (!hasFTP && !(isActuallyEn && hasNoWeirdness) && !defaultOK) {
      return "error";
    } else if (!hasFTP || isActuallyEn && hasNoWeirdness) {
      return "en";
    } else {
      return "intl";
    }
  }

  clone(alts) {
    if (!alts || Object.getOwnPropertyNames(alts).length === 0) {
      return this;
    } else {
      return Locale.create(alts.locale || this.specifiedLocale, alts.numberingSystem || this.numberingSystem, alts.outputCalendar || this.outputCalendar, alts.defaultToEN || false);
    }
  }

  redefaultToEN() {
    let alts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return this.clone(Object.assign({}, alts, {
      defaultToEN: true
    }));
  }

  redefaultToSystem() {
    let alts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return this.clone(Object.assign({}, alts, {
      defaultToEN: false
    }));
  }

  months(length) {
    let format = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    let defaultOK = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    return listStuff(this, length, defaultOK, months, () => {
      const intl = format ? {
        month: length,
        day: "numeric"
      } : {
        month: length
      },
            formatStr = format ? "format" : "standalone";

      if (!this.monthsCache[formatStr][length]) {
        this.monthsCache[formatStr][length] = mapMonths(dt => this.extract(dt, intl, "month"));
      }

      return this.monthsCache[formatStr][length];
    });
  }

  weekdays(length) {
    let format = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    let defaultOK = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    return listStuff(this, length, defaultOK, weekdays, () => {
      const intl = format ? {
        weekday: length,
        year: "numeric",
        month: "long",
        day: "numeric"
      } : {
        weekday: length
      },
            formatStr = format ? "format" : "standalone";

      if (!this.weekdaysCache[formatStr][length]) {
        this.weekdaysCache[formatStr][length] = mapWeekdays(dt => this.extract(dt, intl, "weekday"));
      }

      return this.weekdaysCache[formatStr][length];
    });
  }

  meridiems() {
    let defaultOK = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    return listStuff(this, undefined, defaultOK, () => meridiems, () => {
      // In theory there could be aribitrary day periods. We're gonna assume there are exactly two
      // for AM and PM. This is probably wrong, but it's makes parsing way easier.
      if (!this.meridiemCache) {
        const intl = {
          hour: "numeric",
          hour12: true
        };
        this.meridiemCache = [DateTime.utc(2016, 11, 13, 9), DateTime.utc(2016, 11, 13, 19)].map(dt => this.extract(dt, intl, "dayperiod"));
      }

      return this.meridiemCache;
    });
  }

  eras(length) {
    let defaultOK = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    return listStuff(this, length, defaultOK, eras, () => {
      const intl = {
        era: length
      }; // This is problematic. Different calendars are going to define eras totally differently. What I need is the minimum set of dates
      // to definitely enumerate them.

      if (!this.eraCache[length]) {
        this.eraCache[length] = [DateTime.utc(-40, 1, 1), DateTime.utc(2017, 1, 1)].map(dt => this.extract(dt, intl, "era"));
      }

      return this.eraCache[length];
    });
  }

  extract(dt, intlOpts, field) {
    const df = this.dtFormatter(dt, intlOpts),
          results = df.formatToParts(),
          matching = results.find(m => m.type.toLowerCase() === field);
    return matching ? matching.value : null;
  }

  numberFormatter() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    // this forcesimple option is never used (the only caller short-circuits on it, but it seems safer to leave)
    // (in contrast, the rest of the condition is used heavily)
    return new PolyNumberFormatter(this.intl, opts.forceSimple || this.fastNumbers, opts);
  }

  dtFormatter(dt) {
    let intlOpts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return new PolyDateFormatter(dt, this.intl, intlOpts);
  }

  relFormatter() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return new PolyRelFormatter(this.intl, this.isEnglish(), opts);
  }

  isEnglish() {
    return this.locale === "en" || this.locale.toLowerCase() === "en-us" || hasIntl() && new Intl.DateTimeFormat(this.intl).resolvedOptions().locale.startsWith("en-us");
  }

  equals(other) {
    return this.locale === other.locale && this.numberingSystem === other.numberingSystem && this.outputCalendar === other.outputCalendar;
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/regexParser.js
function regexParser_slicedToArray(arr, i) { return regexParser_arrayWithHoles(arr) || regexParser_iterableToArrayLimit(arr, i) || regexParser_unsupportedIterableToArray(arr, i) || regexParser_nonIterableRest(); }

function regexParser_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function regexParser_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return regexParser_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return regexParser_arrayLikeToArray(o, minLen); }

function regexParser_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function regexParser_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function regexParser_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }





/*
 * This file handles parsing for well-specified formats. Here's how it works:
 * Two things go into parsing: a regex to match with and an extractor to take apart the groups in the match.
 * An extractor is just a function that takes a regex match array and returns a { year: ..., month: ... } object
 * parse() does the work of executing the regex and applying the extractor. It takes multiple regex/extractor pairs to try in sequence.
 * Extractors can take a "cursor" representing the offset in the match to look at. This makes it easy to combine extractors.
 * combineExtractors() does the work of combining them, keeping track of the cursor through multiple extractions.
 * Some extractions are super dumb and simpleParse and fromStrings help DRY them.
 */

function combineRegexes() {
  for (var _len = arguments.length, regexes = new Array(_len), _key = 0; _key < _len; _key++) {
    regexes[_key] = arguments[_key];
  }

  const full = regexes.reduce((f, r) => f + r.source, "");
  return RegExp(`^${full}$`);
}

function combineExtractors() {
  for (var _len2 = arguments.length, extractors = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    extractors[_key2] = arguments[_key2];
  }

  return m => extractors.reduce((_ref, ex) => {
    let _ref2 = regexParser_slicedToArray(_ref, 3),
        mergedVals = _ref2[0],
        mergedZone = _ref2[1],
        cursor = _ref2[2];

    const _ex = ex(m, cursor),
          _ex2 = regexParser_slicedToArray(_ex, 3),
          val = _ex2[0],
          zone = _ex2[1],
          next = _ex2[2];

    return [Object.assign(mergedVals, val), mergedZone || zone, next];
  }, [{}, null, 1]).slice(0, 2);
}

function parse(s) {
  if (s == null) {
    return [null, null];
  }

  for (var _len3 = arguments.length, patterns = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
    patterns[_key3 - 1] = arguments[_key3];
  }

  for (var _i2 = 0, _patterns = patterns; _i2 < _patterns.length; _i2++) {
    const _patterns$_i = regexParser_slicedToArray(_patterns[_i2], 2),
          regex = _patterns$_i[0],
          extractor = _patterns$_i[1];

    const m = regex.exec(s);

    if (m) {
      return extractor(m);
    }
  }

  return [null, null];
}

function simpleParse() {
  for (var _len4 = arguments.length, keys = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
    keys[_key4] = arguments[_key4];
  }

  return (match, cursor) => {
    const ret = {};
    let i;

    for (i = 0; i < keys.length; i++) {
      ret[keys[i]] = parseInteger(match[cursor + i]);
    }

    return [ret, null, cursor + i];
  };
} // ISO and SQL parsing


const offsetRegex = /(?:(Z)|([+-]\d\d)(?::?(\d\d))?)/,
      isoTimeBaseRegex = /(\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d{1,30}))?)?)?/,
      isoTimeRegex = RegExp(`${isoTimeBaseRegex.source}${offsetRegex.source}?`),
      isoTimeExtensionRegex = RegExp(`(?:T${isoTimeRegex.source})?`),
      isoYmdRegex = /([+-]\d{6}|\d{4})(?:-?(\d\d)(?:-?(\d\d))?)?/,
      isoWeekRegex = /(\d{4})-?W(\d\d)(?:-?(\d))?/,
      isoOrdinalRegex = /(\d{4})-?(\d{3})/,
      extractISOWeekData = simpleParse("weekYear", "weekNumber", "weekDay"),
      extractISOOrdinalData = simpleParse("year", "ordinal"),
      sqlYmdRegex = /(\d{4})-(\d\d)-(\d\d)/,
      // dumbed-down version of the ISO one
sqlTimeRegex = RegExp(`${isoTimeBaseRegex.source} ?(?:${offsetRegex.source}|(${ianaRegex.source}))?`),
      sqlTimeExtensionRegex = RegExp(`(?: ${sqlTimeRegex.source})?`);

function regexParser_int(match, pos, fallback) {
  const m = match[pos];
  return isUndefined(m) ? fallback : parseInteger(m);
}

function extractISOYmd(match, cursor) {
  const item = {
    year: regexParser_int(match, cursor),
    month: regexParser_int(match, cursor + 1, 1),
    day: regexParser_int(match, cursor + 2, 1)
  };
  return [item, null, cursor + 3];
}

function extractISOTime(match, cursor) {
  const item = {
    hours: regexParser_int(match, cursor, 0),
    minutes: regexParser_int(match, cursor + 1, 0),
    seconds: regexParser_int(match, cursor + 2, 0),
    milliseconds: parseMillis(match[cursor + 3])
  };
  return [item, null, cursor + 4];
}

function extractISOOffset(match, cursor) {
  const local = !match[cursor] && !match[cursor + 1],
        fullOffset = signedOffset(match[cursor + 1], match[cursor + 2]),
        zone = local ? null : FixedOffsetZone.instance(fullOffset);
  return [{}, zone, cursor + 3];
}

function extractIANAZone(match, cursor) {
  const zone = match[cursor] ? IANAZone.create(match[cursor]) : null;
  return [{}, zone, cursor + 1];
} // ISO time parsing


const isoTimeOnly = RegExp(`^T?${isoTimeBaseRegex.source}$`); // ISO duration parsing

const isoDuration = /^-?P(?:(?:(-?\d{1,9})Y)?(?:(-?\d{1,9})M)?(?:(-?\d{1,9})W)?(?:(-?\d{1,9})D)?(?:T(?:(-?\d{1,9})H)?(?:(-?\d{1,9})M)?(?:(-?\d{1,20})(?:[.,](-?\d{1,9}))?S)?)?)$/;

function extractISODuration(match) {
  const _match = regexParser_slicedToArray(match, 9),
        s = _match[0],
        yearStr = _match[1],
        monthStr = _match[2],
        weekStr = _match[3],
        dayStr = _match[4],
        hourStr = _match[5],
        minuteStr = _match[6],
        secondStr = _match[7],
        millisecondsStr = _match[8];

  const hasNegativePrefix = s[0] === "-";
  const negativeSeconds = secondStr && secondStr[0] === "-";

  const maybeNegate = function maybeNegate(num) {
    let force = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return num !== undefined && (force || num && hasNegativePrefix) ? -num : num;
  };

  return [{
    years: maybeNegate(parseInteger(yearStr)),
    months: maybeNegate(parseInteger(monthStr)),
    weeks: maybeNegate(parseInteger(weekStr)),
    days: maybeNegate(parseInteger(dayStr)),
    hours: maybeNegate(parseInteger(hourStr)),
    minutes: maybeNegate(parseInteger(minuteStr)),
    seconds: maybeNegate(parseInteger(secondStr), secondStr === "-0"),
    milliseconds: maybeNegate(parseMillis(millisecondsStr), negativeSeconds)
  }];
} // These are a little braindead. EDT *should* tell us that we're in, say, America/New_York
// and not just that we're in -240 *right now*. But since I don't think these are used that often
// I'm just going to ignore that


const obsOffsets = {
  GMT: 0,
  EDT: -4 * 60,
  EST: -5 * 60,
  CDT: -5 * 60,
  CST: -6 * 60,
  MDT: -6 * 60,
  MST: -7 * 60,
  PDT: -7 * 60,
  PST: -8 * 60
};

function fromStrings(weekdayStr, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
  const result = {
    year: yearStr.length === 2 ? untruncateYear(parseInteger(yearStr)) : parseInteger(yearStr),
    month: monthsShort.indexOf(monthStr) + 1,
    day: parseInteger(dayStr),
    hour: parseInteger(hourStr),
    minute: parseInteger(minuteStr)
  };
  if (secondStr) result.second = parseInteger(secondStr);

  if (weekdayStr) {
    result.weekday = weekdayStr.length > 3 ? weekdaysLong.indexOf(weekdayStr) + 1 : weekdaysShort.indexOf(weekdayStr) + 1;
  }

  return result;
} // RFC 2822/5322


const rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|(?:([+-]\d\d)(\d\d)))$/;

function extractRFC2822(match) {
  const _match2 = regexParser_slicedToArray(match, 12),
        weekdayStr = _match2[1],
        dayStr = _match2[2],
        monthStr = _match2[3],
        yearStr = _match2[4],
        hourStr = _match2[5],
        minuteStr = _match2[6],
        secondStr = _match2[7],
        obsOffset = _match2[8],
        milOffset = _match2[9],
        offHourStr = _match2[10],
        offMinuteStr = _match2[11],
        result = fromStrings(weekdayStr, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr);

  let offset;

  if (obsOffset) {
    offset = obsOffsets[obsOffset];
  } else if (milOffset) {
    offset = 0;
  } else {
    offset = signedOffset(offHourStr, offMinuteStr);
  }

  return [result, new FixedOffsetZone(offset)];
}

function preprocessRFC2822(s) {
  // Remove comments and folding whitespace and replace multiple-spaces with a single space
  return s.replace(/\([^)]*\)|[\n\t]/g, " ").replace(/(\s\s+)/g, " ").trim();
} // http date


const rfc1123 = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d\d) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d\d):(\d\d):(\d\d) GMT$/,
      rfc850 = /^(Monday|Tuesday|Wedsday|Thursday|Friday|Saturday|Sunday), (\d\d)-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d\d) (\d\d):(\d\d):(\d\d) GMT$/,
      ascii = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( \d|\d\d) (\d\d):(\d\d):(\d\d) (\d{4})$/;

function extractRFC1123Or850(match) {
  const _match3 = regexParser_slicedToArray(match, 8),
        weekdayStr = _match3[1],
        dayStr = _match3[2],
        monthStr = _match3[3],
        yearStr = _match3[4],
        hourStr = _match3[5],
        minuteStr = _match3[6],
        secondStr = _match3[7],
        result = fromStrings(weekdayStr, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr);

  return [result, FixedOffsetZone.utcInstance];
}

function extractASCII(match) {
  const _match4 = regexParser_slicedToArray(match, 8),
        weekdayStr = _match4[1],
        monthStr = _match4[2],
        dayStr = _match4[3],
        hourStr = _match4[4],
        minuteStr = _match4[5],
        secondStr = _match4[6],
        yearStr = _match4[7],
        result = fromStrings(weekdayStr, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr);

  return [result, FixedOffsetZone.utcInstance];
}

const isoYmdWithTimeExtensionRegex = combineRegexes(isoYmdRegex, isoTimeExtensionRegex);
const isoWeekWithTimeExtensionRegex = combineRegexes(isoWeekRegex, isoTimeExtensionRegex);
const isoOrdinalWithTimeExtensionRegex = combineRegexes(isoOrdinalRegex, isoTimeExtensionRegex);
const isoTimeCombinedRegex = combineRegexes(isoTimeRegex);
const extractISOYmdTimeAndOffset = combineExtractors(extractISOYmd, extractISOTime, extractISOOffset);
const extractISOWeekTimeAndOffset = combineExtractors(extractISOWeekData, extractISOTime, extractISOOffset);
const extractISOOrdinalDataAndTime = combineExtractors(extractISOOrdinalData, extractISOTime);
const extractISOTimeAndOffset = combineExtractors(extractISOTime, extractISOOffset);
/**
 * @private
 */

function parseISODate(s) {
  return parse(s, [isoYmdWithTimeExtensionRegex, extractISOYmdTimeAndOffset], [isoWeekWithTimeExtensionRegex, extractISOWeekTimeAndOffset], [isoOrdinalWithTimeExtensionRegex, extractISOOrdinalDataAndTime], [isoTimeCombinedRegex, extractISOTimeAndOffset]);
}
function parseRFC2822Date(s) {
  return parse(preprocessRFC2822(s), [rfc2822, extractRFC2822]);
}
function parseHTTPDate(s) {
  return parse(s, [rfc1123, extractRFC1123Or850], [rfc850, extractRFC1123Or850], [ascii, extractASCII]);
}
function parseISODuration(s) {
  return parse(s, [isoDuration, extractISODuration]);
}
const extractISOTimeOnly = combineExtractors(extractISOTime);
function parseISOTimeOnly(s) {
  return parse(s, [isoTimeOnly, extractISOTimeOnly]);
}
const sqlYmdWithTimeExtensionRegex = combineRegexes(sqlYmdRegex, sqlTimeExtensionRegex);
const sqlTimeCombinedRegex = combineRegexes(sqlTimeRegex);
const extractISOYmdTimeOffsetAndIANAZone = combineExtractors(extractISOYmd, extractISOTime, extractISOOffset, extractIANAZone);
const extractISOTimeOffsetAndIANAZone = combineExtractors(extractISOTime, extractISOOffset, extractIANAZone);
function parseSQL(s) {
  return parse(s, [sqlYmdWithTimeExtensionRegex, extractISOYmdTimeOffsetAndIANAZone], [sqlTimeCombinedRegex, extractISOTimeOffsetAndIANAZone]);
}
;// CONCATENATED MODULE: ./node_modules/luxon/src/duration.js
function duration_createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = duration_unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function duration_slicedToArray(arr, i) { return duration_arrayWithHoles(arr) || duration_iterableToArrayLimit(arr, i) || duration_unsupportedIterableToArray(arr, i) || duration_nonIterableRest(); }

function duration_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function duration_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return duration_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return duration_arrayLikeToArray(o, minLen); }

function duration_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function duration_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function duration_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }








const INVALID = "Invalid Duration"; // unit conversion constants

const lowOrderMatrix = {
  weeks: {
    days: 7,
    hours: 7 * 24,
    minutes: 7 * 24 * 60,
    seconds: 7 * 24 * 60 * 60,
    milliseconds: 7 * 24 * 60 * 60 * 1000
  },
  days: {
    hours: 24,
    minutes: 24 * 60,
    seconds: 24 * 60 * 60,
    milliseconds: 24 * 60 * 60 * 1000
  },
  hours: {
    minutes: 60,
    seconds: 60 * 60,
    milliseconds: 60 * 60 * 1000
  },
  minutes: {
    seconds: 60,
    milliseconds: 60 * 1000
  },
  seconds: {
    milliseconds: 1000
  }
},
      casualMatrix = Object.assign({
  years: {
    quarters: 4,
    months: 12,
    weeks: 52,
    days: 365,
    hours: 365 * 24,
    minutes: 365 * 24 * 60,
    seconds: 365 * 24 * 60 * 60,
    milliseconds: 365 * 24 * 60 * 60 * 1000
  },
  quarters: {
    months: 3,
    weeks: 13,
    days: 91,
    hours: 91 * 24,
    minutes: 91 * 24 * 60,
    seconds: 91 * 24 * 60 * 60,
    milliseconds: 91 * 24 * 60 * 60 * 1000
  },
  months: {
    weeks: 4,
    days: 30,
    hours: 30 * 24,
    minutes: 30 * 24 * 60,
    seconds: 30 * 24 * 60 * 60,
    milliseconds: 30 * 24 * 60 * 60 * 1000
  }
}, lowOrderMatrix),
      daysInYearAccurate = 146097.0 / 400,
      daysInMonthAccurate = 146097.0 / 4800,
      accurateMatrix = Object.assign({
  years: {
    quarters: 4,
    months: 12,
    weeks: daysInYearAccurate / 7,
    days: daysInYearAccurate,
    hours: daysInYearAccurate * 24,
    minutes: daysInYearAccurate * 24 * 60,
    seconds: daysInYearAccurate * 24 * 60 * 60,
    milliseconds: daysInYearAccurate * 24 * 60 * 60 * 1000
  },
  quarters: {
    months: 3,
    weeks: daysInYearAccurate / 28,
    days: daysInYearAccurate / 4,
    hours: daysInYearAccurate * 24 / 4,
    minutes: daysInYearAccurate * 24 * 60 / 4,
    seconds: daysInYearAccurate * 24 * 60 * 60 / 4,
    milliseconds: daysInYearAccurate * 24 * 60 * 60 * 1000 / 4
  },
  months: {
    weeks: daysInMonthAccurate / 7,
    days: daysInMonthAccurate,
    hours: daysInMonthAccurate * 24,
    minutes: daysInMonthAccurate * 24 * 60,
    seconds: daysInMonthAccurate * 24 * 60 * 60,
    milliseconds: daysInMonthAccurate * 24 * 60 * 60 * 1000
  }
}, lowOrderMatrix); // units ordered by size

const orderedUnits = ["years", "quarters", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds"];
const reverseUnits = orderedUnits.slice(0).reverse(); // clone really means "create another instance just like this one, but with these changes"

function clone(dur, alts) {
  let clear = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  // deep merge for vals
  const conf = {
    values: clear ? alts.values : Object.assign({}, dur.values, alts.values || {}),
    loc: dur.loc.clone(alts.loc),
    conversionAccuracy: alts.conversionAccuracy || dur.conversionAccuracy
  };
  return new Duration(conf);
}

function antiTrunc(n) {
  return n < 0 ? Math.floor(n) : Math.ceil(n);
} // NB: mutates parameters


function convert(matrix, fromMap, fromUnit, toMap, toUnit) {
  const conv = matrix[toUnit][fromUnit],
        raw = fromMap[fromUnit] / conv,
        sameSign = Math.sign(raw) === Math.sign(toMap[toUnit]),
        // ok, so this is wild, but see the matrix in the tests
  added = !sameSign && toMap[toUnit] !== 0 && Math.abs(raw) <= 1 ? antiTrunc(raw) : Math.trunc(raw);
  toMap[toUnit] += added;
  fromMap[fromUnit] -= added * conv;
} // NB: mutates parameters


function normalizeValues(matrix, vals) {
  reverseUnits.reduce((previous, current) => {
    if (!isUndefined(vals[current])) {
      if (previous) {
        convert(matrix, vals, previous, vals, current);
      }

      return current;
    } else {
      return previous;
    }
  }, null);
}
/**
 * A Duration object represents a period of time, like "2 months" or "1 day, 1 hour". Conceptually, it's just a map of units to their quantities, accompanied by some additional configuration and methods for creating, parsing, interrogating, transforming, and formatting them. They can be used on their own or in conjunction with other Luxon types; for example, you can use {@link DateTime.plus} to add a Duration object to a DateTime, producing another DateTime.
 *
 * Here is a brief overview of commonly used methods and getters in Duration:
 *
 * * **Creation** To create a Duration, use {@link Duration.fromMillis}, {@link Duration.fromObject}, or {@link Duration.fromISO}.
 * * **Unit values** See the {@link Duration.years}, {@link Duration.months}, {@link Duration.weeks}, {@link Duration.days}, {@link Duration.hours}, {@link Duration.minutes}, {@link Duration.seconds}, {@link Duration.milliseconds} accessors.
 * * **Configuration** See  {@link Duration.locale} and {@link Duration.numberingSystem} accessors.
 * * **Transformation** To create new Durations out of old ones use {@link Duration.plus}, {@link Duration.minus}, {@link Duration.normalize}, {@link Duration.set}, {@link Duration.reconfigure}, {@link Duration.shiftTo}, and {@link Duration.negate}.
 * * **Output** To convert the Duration into other representations, see {@link Duration.as}, {@link Duration.toISO}, {@link Duration.toFormat}, and {@link Duration.toJSON}
 *
 * There's are more methods documented below. In addition, for more information on subtler topics like internationalization and validity, see the external documentation.
 */


class Duration {
  /**
   * @private
   */
  constructor(config) {
    const accurate = config.conversionAccuracy === "longterm" || false;
    /**
     * @access private
     */

    this.values = config.values;
    /**
     * @access private
     */

    this.loc = config.loc || Locale.create();
    /**
     * @access private
     */

    this.conversionAccuracy = accurate ? "longterm" : "casual";
    /**
     * @access private
     */

    this.invalid = config.invalid || null;
    /**
     * @access private
     */

    this.matrix = accurate ? accurateMatrix : casualMatrix;
    /**
     * @access private
     */

    this.isLuxonDuration = true;
  }
  /**
   * Create Duration from a number of milliseconds.
   * @param {number} count of milliseconds
   * @param {Object} opts - options for parsing
   * @param {string} [opts.locale='en-US'] - the locale to use
   * @param {string} opts.numberingSystem - the numbering system to use
   * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
   * @return {Duration}
   */


  static fromMillis(count, opts) {
    return Duration.fromObject(Object.assign({
      milliseconds: count
    }, opts));
  }
  /**
   * Create a Duration from a JavaScript object with keys like 'years' and 'hours.
   * If this object is empty then a zero milliseconds duration is returned.
   * @param {Object} obj - the object to create the DateTime from
   * @param {number} obj.years
   * @param {number} obj.quarters
   * @param {number} obj.months
   * @param {number} obj.weeks
   * @param {number} obj.days
   * @param {number} obj.hours
   * @param {number} obj.minutes
   * @param {number} obj.seconds
   * @param {number} obj.milliseconds
   * @param {string} [obj.locale='en-US'] - the locale to use
   * @param {string} obj.numberingSystem - the numbering system to use
   * @param {string} [obj.conversionAccuracy='casual'] - the conversion system to use
   * @return {Duration}
   */


  static fromObject(obj) {
    if (obj == null || typeof obj !== "object") {
      throw new InvalidArgumentError(`Duration.fromObject: argument expected to be an object, got ${obj === null ? "null" : typeof obj}`);
    }

    return new Duration({
      values: normalizeObject(obj, Duration.normalizeUnit, ["locale", "numberingSystem", "conversionAccuracy", "zone" // a bit of debt; it's super inconvenient internally not to be able to blindly pass this
      ]),
      loc: Locale.fromObject(obj),
      conversionAccuracy: obj.conversionAccuracy
    });
  }
  /**
   * Create a Duration from an ISO 8601 duration string.
   * @param {string} text - text to parse
   * @param {Object} opts - options for parsing
   * @param {string} [opts.locale='en-US'] - the locale to use
   * @param {string} opts.numberingSystem - the numbering system to use
   * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
   * @see https://en.wikipedia.org/wiki/ISO_8601#Durations
   * @example Duration.fromISO('P3Y6M1W4DT12H30M5S').toObject() //=> { years: 3, months: 6, weeks: 1, days: 4, hours: 12, minutes: 30, seconds: 5 }
   * @example Duration.fromISO('PT23H').toObject() //=> { hours: 23 }
   * @example Duration.fromISO('P5Y3M').toObject() //=> { years: 5, months: 3 }
   * @return {Duration}
   */


  static fromISO(text, opts) {
    const _parseISODuration = parseISODuration(text),
          _parseISODuration2 = duration_slicedToArray(_parseISODuration, 1),
          parsed = _parseISODuration2[0];

    if (parsed) {
      const obj = Object.assign(parsed, opts);
      return Duration.fromObject(obj);
    } else {
      return Duration.invalid("unparsable", `the input "${text}" can't be parsed as ISO 8601`);
    }
  }
  /**
   * Create a Duration from an ISO 8601 time string.
   * @param {string} text - text to parse
   * @param {Object} opts - options for parsing
   * @param {string} [opts.locale='en-US'] - the locale to use
   * @param {string} opts.numberingSystem - the numbering system to use
   * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
   * @see https://en.wikipedia.org/wiki/ISO_8601#Times
   * @example Duration.fromISOTime('11:22:33.444').toObject() //=> { hours: 11, minutes: 22, seconds: 33, milliseconds: 444 }
   * @example Duration.fromISOTime('11:00').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
   * @example Duration.fromISOTime('T11:00').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
   * @example Duration.fromISOTime('1100').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
   * @example Duration.fromISOTime('T1100').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
   * @return {Duration}
   */


  static fromISOTime(text, opts) {
    const _parseISOTimeOnly = parseISOTimeOnly(text),
          _parseISOTimeOnly2 = duration_slicedToArray(_parseISOTimeOnly, 1),
          parsed = _parseISOTimeOnly2[0];

    if (parsed) {
      const obj = Object.assign(parsed, opts);
      return Duration.fromObject(obj);
    } else {
      return Duration.invalid("unparsable", `the input "${text}" can't be parsed as ISO 8601`);
    }
  }
  /**
   * Create an invalid Duration.
   * @param {string} reason - simple string of why this datetime is invalid. Should not contain parameters or anything else data-dependent
   * @param {string} [explanation=null] - longer explanation, may include parameters and other useful debugging information
   * @return {Duration}
   */


  static invalid(reason) {
    let explanation = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    if (!reason) {
      throw new InvalidArgumentError("need to specify a reason the Duration is invalid");
    }

    const invalid = reason instanceof Invalid ? reason : new Invalid(reason, explanation);

    if (Settings.throwOnInvalid) {
      throw new InvalidDurationError(invalid);
    } else {
      return new Duration({
        invalid
      });
    }
  }
  /**
   * @private
   */


  static normalizeUnit(unit) {
    const normalized = {
      year: "years",
      years: "years",
      quarter: "quarters",
      quarters: "quarters",
      month: "months",
      months: "months",
      week: "weeks",
      weeks: "weeks",
      day: "days",
      days: "days",
      hour: "hours",
      hours: "hours",
      minute: "minutes",
      minutes: "minutes",
      second: "seconds",
      seconds: "seconds",
      millisecond: "milliseconds",
      milliseconds: "milliseconds"
    }[unit ? unit.toLowerCase() : unit];
    if (!normalized) throw new InvalidUnitError(unit);
    return normalized;
  }
  /**
   * Check if an object is a Duration. Works across context boundaries
   * @param {object} o
   * @return {boolean}
   */


  static isDuration(o) {
    return o && o.isLuxonDuration || false;
  }
  /**
   * Get  the locale of a Duration, such 'en-GB'
   * @type {string}
   */


  get locale() {
    return this.isValid ? this.loc.locale : null;
  }
  /**
   * Get the numbering system of a Duration, such 'beng'. The numbering system is used when formatting the Duration
   *
   * @type {string}
   */


  get numberingSystem() {
    return this.isValid ? this.loc.numberingSystem : null;
  }
  /**
   * Returns a string representation of this Duration formatted according to the specified format string. You may use these tokens:
   * * `S` for milliseconds
   * * `s` for seconds
   * * `m` for minutes
   * * `h` for hours
   * * `d` for days
   * * `M` for months
   * * `y` for years
   * Notes:
   * * Add padding by repeating the token, e.g. "yy" pads the years to two digits, "hhhh" pads the hours out to four digits
   * * The duration will be converted to the set of units in the format string using {@link Duration.shiftTo} and the Durations's conversion accuracy setting.
   * @param {string} fmt - the format string
   * @param {Object} opts - options
   * @param {boolean} [opts.floor=true] - floor numerical values
   * @example Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toFormat("y d s") //=> "1 6 2"
   * @example Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toFormat("yy dd sss") //=> "01 06 002"
   * @example Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toFormat("M S") //=> "12 518402000"
   * @return {string}
   */


  toFormat(fmt) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    // reverse-compat since 1.2; we always round down now, never up, and we do it by default
    const fmtOpts = Object.assign({}, opts, {
      floor: opts.round !== false && opts.floor !== false
    });
    return this.isValid ? Formatter.create(this.loc, fmtOpts).formatDurationFromString(this, fmt) : INVALID;
  }
  /**
   * Returns a JavaScript object with this Duration's values.
   * @param opts - options for generating the object
   * @param {boolean} [opts.includeConfig=false] - include configuration attributes in the output
   * @example Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toObject() //=> { years: 1, days: 6, seconds: 2 }
   * @return {Object}
   */


  toObject() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    if (!this.isValid) return {};
    const base = Object.assign({}, this.values);

    if (opts.includeConfig) {
      base.conversionAccuracy = this.conversionAccuracy;
      base.numberingSystem = this.loc.numberingSystem;
      base.locale = this.loc.locale;
    }

    return base;
  }
  /**
   * Returns an ISO 8601-compliant string representation of this Duration.
   * @see https://en.wikipedia.org/wiki/ISO_8601#Durations
   * @example Duration.fromObject({ years: 3, seconds: 45 }).toISO() //=> 'P3YT45S'
   * @example Duration.fromObject({ months: 4, seconds: 45 }).toISO() //=> 'P4MT45S'
   * @example Duration.fromObject({ months: 5 }).toISO() //=> 'P5M'
   * @example Duration.fromObject({ minutes: 5 }).toISO() //=> 'PT5M'
   * @example Duration.fromObject({ milliseconds: 6 }).toISO() //=> 'PT0.006S'
   * @return {string}
   */


  toISO() {
    // we could use the formatter, but this is an easier way to get the minimum string
    if (!this.isValid) return null;
    let s = "P";
    if (this.years !== 0) s += this.years + "Y";
    if (this.months !== 0 || this.quarters !== 0) s += this.months + this.quarters * 3 + "M";
    if (this.weeks !== 0) s += this.weeks + "W";
    if (this.days !== 0) s += this.days + "D";
    if (this.hours !== 0 || this.minutes !== 0 || this.seconds !== 0 || this.milliseconds !== 0) s += "T";
    if (this.hours !== 0) s += this.hours + "H";
    if (this.minutes !== 0) s += this.minutes + "M";
    if (this.seconds !== 0 || this.milliseconds !== 0) // this will handle "floating point madness" by removing extra decimal places
      // https://stackoverflow.com/questions/588004/is-floating-point-math-broken
      s += roundTo(this.seconds + this.milliseconds / 1000, 3) + "S";
    if (s === "P") s += "T0S";
    return s;
  }
  /**
   * Returns an ISO 8601-compliant string representation of this Duration, formatted as a time of day.
   * Note that this will return null if the duration is invalid, negative, or equal to or greater than 24 hours.
   * @see https://en.wikipedia.org/wiki/ISO_8601#Times
   * @param {Object} opts - options
   * @param {boolean} [opts.suppressMilliseconds=false] - exclude milliseconds from the format if they're 0
   * @param {boolean} [opts.suppressSeconds=false] - exclude seconds from the format if they're 0
   * @param {boolean} [opts.includePrefix=false] - include the `T` prefix
   * @param {string} [opts.format='extended'] - choose between the basic and extended format
   * @example Duration.fromObject({ hours: 11 }).toISOTime() //=> '11:00:00.000'
   * @example Duration.fromObject({ hours: 11 }).toISOTime({ suppressMilliseconds: true }) //=> '11:00:00'
   * @example Duration.fromObject({ hours: 11 }).toISOTime({ suppressSeconds: true }) //=> '11:00'
   * @example Duration.fromObject({ hours: 11 }).toISOTime({ includePrefix: true }) //=> 'T11:00:00.000'
   * @example Duration.fromObject({ hours: 11 }).toISOTime({ format: 'basic' }) //=> '110000.000'
   * @return {string}
   */


  toISOTime() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    if (!this.isValid) return null;
    const millis = this.toMillis();
    if (millis < 0 || millis >= 86400000) return null;
    opts = Object.assign({
      suppressMilliseconds: false,
      suppressSeconds: false,
      includePrefix: false,
      format: "extended"
    }, opts);
    const value = this.shiftTo("hours", "minutes", "seconds", "milliseconds");
    let fmt = opts.format === "basic" ? "hhmm" : "hh:mm";

    if (!opts.suppressSeconds || value.seconds !== 0 || value.milliseconds !== 0) {
      fmt += opts.format === "basic" ? "ss" : ":ss";

      if (!opts.suppressMilliseconds || value.milliseconds !== 0) {
        fmt += ".SSS";
      }
    }

    let str = value.toFormat(fmt);

    if (opts.includePrefix) {
      str = "T" + str;
    }

    return str;
  }
  /**
   * Returns an ISO 8601 representation of this Duration appropriate for use in JSON.
   * @return {string}
   */


  toJSON() {
    return this.toISO();
  }
  /**
   * Returns an ISO 8601 representation of this Duration appropriate for use in debugging.
   * @return {string}
   */


  toString() {
    return this.toISO();
  }
  /**
   * Returns an milliseconds value of this Duration.
   * @return {number}
   */


  toMillis() {
    return this.as("milliseconds");
  }
  /**
   * Returns an milliseconds value of this Duration. Alias of {@link toMillis}
   * @return {number}
   */


  valueOf() {
    return this.toMillis();
  }
  /**
   * Make this Duration longer by the specified amount. Return a newly-constructed Duration.
   * @param {Duration|Object|number} duration - The amount to add. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
   * @return {Duration}
   */


  plus(duration) {
    if (!this.isValid) return this;
    const dur = friendlyDuration(duration),
          result = {};

    var _iterator = duration_createForOfIteratorHelper(orderedUnits),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        const k = _step.value;

        if (util_hasOwnProperty(dur.values, k) || util_hasOwnProperty(this.values, k)) {
          result[k] = dur.get(k) + this.get(k);
        }
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }

    return clone(this, {
      values: result
    }, true);
  }
  /**
   * Make this Duration shorter by the specified amount. Return a newly-constructed Duration.
   * @param {Duration|Object|number} duration - The amount to subtract. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
   * @return {Duration}
   */


  minus(duration) {
    if (!this.isValid) return this;
    const dur = friendlyDuration(duration);
    return this.plus(dur.negate());
  }
  /**
   * Scale this Duration by the specified amount. Return a newly-constructed Duration.
   * @param {function} fn - The function to apply to each unit. Arity is 1 or 2: the value of the unit and, optionally, the unit name. Must return a number.
   * @example Duration.fromObject({ hours: 1, minutes: 30 }).mapUnit(x => x * 2) //=> { hours: 2, minutes: 60 }
   * @example Duration.fromObject({ hours: 1, minutes: 30 }).mapUnit((x, u) => u === "hour" ? x * 2 : x) //=> { hours: 2, minutes: 30 }
   * @return {Duration}
   */


  mapUnits(fn) {
    if (!this.isValid) return this;
    const result = {};

    for (var _i2 = 0, _Object$keys = Object.keys(this.values); _i2 < _Object$keys.length; _i2++) {
      const k = _Object$keys[_i2];
      result[k] = asNumber(fn(this.values[k], k));
    }

    return clone(this, {
      values: result
    }, true);
  }
  /**
   * Get the value of unit.
   * @param {string} unit - a unit such as 'minute' or 'day'
   * @example Duration.fromObject({years: 2, days: 3}).get('years') //=> 2
   * @example Duration.fromObject({years: 2, days: 3}).get('months') //=> 0
   * @example Duration.fromObject({years: 2, days: 3}).get('days') //=> 3
   * @return {number}
   */


  get(unit) {
    return this[Duration.normalizeUnit(unit)];
  }
  /**
   * "Set" the values of specified units. Return a newly-constructed Duration.
   * @param {Object} values - a mapping of units to numbers
   * @example dur.set({ years: 2017 })
   * @example dur.set({ hours: 8, minutes: 30 })
   * @return {Duration}
   */


  set(values) {
    if (!this.isValid) return this;
    const mixed = Object.assign(this.values, normalizeObject(values, Duration.normalizeUnit, []));
    return clone(this, {
      values: mixed
    });
  }
  /**
   * "Set" the locale and/or numberingSystem.  Returns a newly-constructed Duration.
   * @example dur.reconfigure({ locale: 'en-GB' })
   * @return {Duration}
   */


  reconfigure() {
    let _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        locale = _ref.locale,
        numberingSystem = _ref.numberingSystem,
        conversionAccuracy = _ref.conversionAccuracy;

    const loc = this.loc.clone({
      locale,
      numberingSystem
    }),
          opts = {
      loc
    };

    if (conversionAccuracy) {
      opts.conversionAccuracy = conversionAccuracy;
    }

    return clone(this, opts);
  }
  /**
   * Return the length of the duration in the specified unit.
   * @param {string} unit - a unit such as 'minutes' or 'days'
   * @example Duration.fromObject({years: 1}).as('days') //=> 365
   * @example Duration.fromObject({years: 1}).as('months') //=> 12
   * @example Duration.fromObject({hours: 60}).as('days') //=> 2.5
   * @return {number}
   */


  as(unit) {
    return this.isValid ? this.shiftTo(unit).get(unit) : NaN;
  }
  /**
   * Reduce this Duration to its canonical representation in its current units.
   * @example Duration.fromObject({ years: 2, days: 5000 }).normalize().toObject() //=> { years: 15, days: 255 }
   * @example Duration.fromObject({ hours: 12, minutes: -45 }).normalize().toObject() //=> { hours: 11, minutes: 15 }
   * @return {Duration}
   */


  normalize() {
    if (!this.isValid) return this;
    const vals = this.toObject();
    normalizeValues(this.matrix, vals);
    return clone(this, {
      values: vals
    }, true);
  }
  /**
   * Convert this Duration into its representation in a different set of units.
   * @example Duration.fromObject({ hours: 1, seconds: 30 }).shiftTo('minutes', 'milliseconds').toObject() //=> { minutes: 60, milliseconds: 30000 }
   * @return {Duration}
   */


  shiftTo() {
    for (var _len = arguments.length, units = new Array(_len), _key = 0; _key < _len; _key++) {
      units[_key] = arguments[_key];
    }

    if (!this.isValid) return this;

    if (units.length === 0) {
      return this;
    }

    units = units.map(u => Duration.normalizeUnit(u));
    const built = {},
          accumulated = {},
          vals = this.toObject();
    let lastUnit;

    var _iterator2 = duration_createForOfIteratorHelper(orderedUnits),
        _step2;

    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        const k = _step2.value;

        if (units.indexOf(k) >= 0) {
          lastUnit = k;
          let own = 0; // anything we haven't boiled down yet should get boiled to this unit

          for (const ak in accumulated) {
            own += this.matrix[ak][k] * accumulated[ak];
            accumulated[ak] = 0;
          } // plus anything that's already in this unit


          if (isNumber(vals[k])) {
            own += vals[k];
          }

          const i = Math.trunc(own);
          built[k] = i;
          accumulated[k] = own - i; // we'd like to absorb these fractions in another unit
          // plus anything further down the chain that should be rolled up in to this

          for (const down in vals) {
            if (orderedUnits.indexOf(down) > orderedUnits.indexOf(k)) {
              convert(this.matrix, vals, down, built, k);
            }
          } // otherwise, keep it in the wings to boil it later

        } else if (isNumber(vals[k])) {
          accumulated[k] = vals[k];
        }
      } // anything leftover becomes the decimal for the last unit
      // lastUnit must be defined since units is not empty

    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
    }

    for (const key in accumulated) {
      if (accumulated[key] !== 0) {
        built[lastUnit] += key === lastUnit ? accumulated[key] : accumulated[key] / this.matrix[lastUnit][key];
      }
    }

    return clone(this, {
      values: built
    }, true).normalize();
  }
  /**
   * Return the negative of this Duration.
   * @example Duration.fromObject({ hours: 1, seconds: 30 }).negate().toObject() //=> { hours: -1, seconds: -30 }
   * @return {Duration}
   */


  negate() {
    if (!this.isValid) return this;
    const negated = {};

    for (var _i3 = 0, _Object$keys2 = Object.keys(this.values); _i3 < _Object$keys2.length; _i3++) {
      const k = _Object$keys2[_i3];
      negated[k] = -this.values[k];
    }

    return clone(this, {
      values: negated
    }, true);
  }
  /**
   * Get the years.
   * @type {number}
   */


  get years() {
    return this.isValid ? this.values.years || 0 : NaN;
  }
  /**
   * Get the quarters.
   * @type {number}
   */


  get quarters() {
    return this.isValid ? this.values.quarters || 0 : NaN;
  }
  /**
   * Get the months.
   * @type {number}
   */


  get months() {
    return this.isValid ? this.values.months || 0 : NaN;
  }
  /**
   * Get the weeks
   * @type {number}
   */


  get weeks() {
    return this.isValid ? this.values.weeks || 0 : NaN;
  }
  /**
   * Get the days.
   * @type {number}
   */


  get days() {
    return this.isValid ? this.values.days || 0 : NaN;
  }
  /**
   * Get the hours.
   * @type {number}
   */


  get hours() {
    return this.isValid ? this.values.hours || 0 : NaN;
  }
  /**
   * Get the minutes.
   * @type {number}
   */


  get minutes() {
    return this.isValid ? this.values.minutes || 0 : NaN;
  }
  /**
   * Get the seconds.
   * @return {number}
   */


  get seconds() {
    return this.isValid ? this.values.seconds || 0 : NaN;
  }
  /**
   * Get the milliseconds.
   * @return {number}
   */


  get milliseconds() {
    return this.isValid ? this.values.milliseconds || 0 : NaN;
  }
  /**
   * Returns whether the Duration is invalid. Invalid durations are returned by diff operations
   * on invalid DateTimes or Intervals.
   * @return {boolean}
   */


  get isValid() {
    return this.invalid === null;
  }
  /**
   * Returns an error code if this Duration became invalid, or null if the Duration is valid
   * @return {string}
   */


  get invalidReason() {
    return this.invalid ? this.invalid.reason : null;
  }
  /**
   * Returns an explanation of why this Duration became invalid, or null if the Duration is valid
   * @type {string}
   */


  get invalidExplanation() {
    return this.invalid ? this.invalid.explanation : null;
  }
  /**
   * Equality check
   * Two Durations are equal iff they have the same units and the same values for each unit.
   * @param {Duration} other
   * @return {boolean}
   */


  equals(other) {
    if (!this.isValid || !other.isValid) {
      return false;
    }

    if (!this.loc.equals(other.loc)) {
      return false;
    }

    function eq(v1, v2) {
      // Consider 0 and undefined as equal
      if (v1 === undefined || v1 === 0) return v2 === undefined || v2 === 0;
      return v1 === v2;
    }

    var _iterator3 = duration_createForOfIteratorHelper(orderedUnits),
        _step3;

    try {
      for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
        const u = _step3.value;

        if (!eq(this.values[u], other.values[u])) {
          return false;
        }
      }
    } catch (err) {
      _iterator3.e(err);
    } finally {
      _iterator3.f();
    }

    return true;
  }

}
/**
 * @private
 */

function friendlyDuration(durationish) {
  if (isNumber(durationish)) {
    return Duration.fromMillis(durationish);
  } else if (Duration.isDuration(durationish)) {
    return durationish;
  } else if (typeof durationish === "object") {
    return Duration.fromObject(durationish);
  } else {
    throw new InvalidArgumentError(`Unknown duration argument ${durationish} of type ${typeof durationish}`);
  }
}
;// CONCATENATED MODULE: ./node_modules/luxon/src/interval.js
function interval_createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = interval_unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function interval_slicedToArray(arr, i) { return interval_arrayWithHoles(arr) || interval_iterableToArrayLimit(arr, i) || interval_unsupportedIterableToArray(arr, i) || interval_nonIterableRest(); }

function interval_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function interval_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return interval_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return interval_arrayLikeToArray(o, minLen); }

function interval_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function interval_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function interval_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }






const interval_INVALID = "Invalid Interval"; // checks if the start is equal to or before the end

function validateStartEnd(start, end) {
  if (!start || !start.isValid) {
    return Interval.invalid("missing or invalid start");
  } else if (!end || !end.isValid) {
    return Interval.invalid("missing or invalid end");
  } else if (end < start) {
    return Interval.invalid("end before start", `The end of an interval must be after its start, but you had start=${start.toISO()} and end=${end.toISO()}`);
  } else {
    return null;
  }
}
/**
 * An Interval object represents a half-open interval of time, where each endpoint is a {@link DateTime}. Conceptually, it's a container for those two endpoints, accompanied by methods for creating, parsing, interrogating, comparing, transforming, and formatting them.
 *
 * Here is a brief overview of the most commonly used methods and getters in Interval:
 *
 * * **Creation** To create an Interval, use {@link fromDateTimes}, {@link after}, {@link before}, or {@link fromISO}.
 * * **Accessors** Use {@link start} and {@link end} to get the start and end.
 * * **Interrogation** To analyze the Interval, use {@link count}, {@link length}, {@link hasSame}, {@link contains}, {@link isAfter}, or {@link isBefore}.
 * * **Transformation** To create other Intervals out of this one, use {@link set}, {@link splitAt}, {@link splitBy}, {@link divideEqually}, {@link merge}, {@link xor}, {@link union}, {@link intersection}, or {@link difference}.
 * * **Comparison** To compare this Interval to another one, use {@link equals}, {@link overlaps}, {@link abutsStart}, {@link abutsEnd}, {@link engulfs}.
 * * **Output** To convert the Interval into other representations, see {@link toString}, {@link toISO}, {@link toISODate}, {@link toISOTime}, {@link toFormat}, and {@link toDuration}.
 */


class Interval {
  /**
   * @private
   */
  constructor(config) {
    /**
     * @access private
     */
    this.s = config.start;
    /**
     * @access private
     */

    this.e = config.end;
    /**
     * @access private
     */

    this.invalid = config.invalid || null;
    /**
     * @access private
     */

    this.isLuxonInterval = true;
  }
  /**
   * Create an invalid Interval.
   * @param {string} reason - simple string of why this Interval is invalid. Should not contain parameters or anything else data-dependent
   * @param {string} [explanation=null] - longer explanation, may include parameters and other useful debugging information
   * @return {Interval}
   */


  static invalid(reason) {
    let explanation = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    if (!reason) {
      throw new InvalidArgumentError("need to specify a reason the Interval is invalid");
    }

    const invalid = reason instanceof Invalid ? reason : new Invalid(reason, explanation);

    if (Settings.throwOnInvalid) {
      throw new InvalidIntervalError(invalid);
    } else {
      return new Interval({
        invalid
      });
    }
  }
  /**
   * Create an Interval from a start DateTime and an end DateTime. Inclusive of the start but not the end.
   * @param {DateTime|Date|Object} start
   * @param {DateTime|Date|Object} end
   * @return {Interval}
   */


  static fromDateTimes(start, end) {
    const builtStart = friendlyDateTime(start),
          builtEnd = friendlyDateTime(end);
    const validateError = validateStartEnd(builtStart, builtEnd);

    if (validateError == null) {
      return new Interval({
        start: builtStart,
        end: builtEnd
      });
    } else {
      return validateError;
    }
  }
  /**
   * Create an Interval from a start DateTime and a Duration to extend to.
   * @param {DateTime|Date|Object} start
   * @param {Duration|Object|number} duration - the length of the Interval.
   * @return {Interval}
   */


  static after(start, duration) {
    const dur = friendlyDuration(duration),
          dt = friendlyDateTime(start);
    return Interval.fromDateTimes(dt, dt.plus(dur));
  }
  /**
   * Create an Interval from an end DateTime and a Duration to extend backwards to.
   * @param {DateTime|Date|Object} end
   * @param {Duration|Object|number} duration - the length of the Interval.
   * @return {Interval}
   */


  static before(end, duration) {
    const dur = friendlyDuration(duration),
          dt = friendlyDateTime(end);
    return Interval.fromDateTimes(dt.minus(dur), dt);
  }
  /**
   * Create an Interval from an ISO 8601 string.
   * Accepts `<start>/<end>`, `<start>/<duration>`, and `<duration>/<end>` formats.
   * @param {string} text - the ISO string to parse
   * @param {Object} [opts] - options to pass {@link DateTime.fromISO} and optionally {@link Duration.fromISO}
   * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
   * @return {Interval}
   */


  static fromISO(text, opts) {
    const _split = (text || "").split("/", 2),
          _split2 = interval_slicedToArray(_split, 2),
          s = _split2[0],
          e = _split2[1];

    if (s && e) {
      let start, startIsValid;

      try {
        start = DateTime.fromISO(s, opts);
        startIsValid = start.isValid;
      } catch (e) {
        startIsValid = false;
      }

      let end, endIsValid;

      try {
        end = DateTime.fromISO(e, opts);
        endIsValid = end.isValid;
      } catch (e) {
        endIsValid = false;
      }

      if (startIsValid && endIsValid) {
        return Interval.fromDateTimes(start, end);
      }

      if (startIsValid) {
        const dur = Duration.fromISO(e, opts);

        if (dur.isValid) {
          return Interval.after(start, dur);
        }
      } else if (endIsValid) {
        const dur = Duration.fromISO(s, opts);

        if (dur.isValid) {
          return Interval.before(end, dur);
        }
      }
    }

    return Interval.invalid("unparsable", `the input "${text}" can't be parsed as ISO 8601`);
  }
  /**
   * Check if an object is an Interval. Works across context boundaries
   * @param {object} o
   * @return {boolean}
   */


  static isInterval(o) {
    return o && o.isLuxonInterval || false;
  }
  /**
   * Returns the start of the Interval
   * @type {DateTime}
   */


  get start() {
    return this.isValid ? this.s : null;
  }
  /**
   * Returns the end of the Interval
   * @type {DateTime}
   */


  get end() {
    return this.isValid ? this.e : null;
  }
  /**
   * Returns whether this Interval's end is at least its start, meaning that the Interval isn't 'backwards'.
   * @type {boolean}
   */


  get isValid() {
    return this.invalidReason === null;
  }
  /**
   * Returns an error code if this Interval is invalid, or null if the Interval is valid
   * @type {string}
   */


  get invalidReason() {
    return this.invalid ? this.invalid.reason : null;
  }
  /**
   * Returns an explanation of why this Interval became invalid, or null if the Interval is valid
   * @type {string}
   */


  get invalidExplanation() {
    return this.invalid ? this.invalid.explanation : null;
  }
  /**
   * Returns the length of the Interval in the specified unit.
   * @param {string} unit - the unit (such as 'hours' or 'days') to return the length in.
   * @return {number}
   */


  length() {
    let unit = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "milliseconds";
    return this.isValid ? this.toDuration(...[unit]).get(unit) : NaN;
  }
  /**
   * Returns the count of minutes, hours, days, months, or years included in the Interval, even in part.
   * Unlike {@link length} this counts sections of the calendar, not periods of time, e.g. specifying 'day'
   * asks 'what dates are included in this interval?', not 'how many days long is this interval?'
   * @param {string} [unit='milliseconds'] - the unit of time to count.
   * @return {number}
   */


  count() {
    let unit = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "milliseconds";
    if (!this.isValid) return NaN;
    const start = this.start.startOf(unit),
          end = this.end.startOf(unit);
    return Math.floor(end.diff(start, unit).get(unit)) + 1;
  }
  /**
   * Returns whether this Interval's start and end are both in the same unit of time
   * @param {string} unit - the unit of time to check sameness on
   * @return {boolean}
   */


  hasSame(unit) {
    return this.isValid ? this.isEmpty() || this.e.minus(1).hasSame(this.s, unit) : false;
  }
  /**
   * Return whether this Interval has the same start and end DateTimes.
   * @return {boolean}
   */


  isEmpty() {
    return this.s.valueOf() === this.e.valueOf();
  }
  /**
   * Return whether this Interval's start is after the specified DateTime.
   * @param {DateTime} dateTime
   * @return {boolean}
   */


  isAfter(dateTime) {
    if (!this.isValid) return false;
    return this.s > dateTime;
  }
  /**
   * Return whether this Interval's end is before the specified DateTime.
   * @param {DateTime} dateTime
   * @return {boolean}
   */


  isBefore(dateTime) {
    if (!this.isValid) return false;
    return this.e <= dateTime;
  }
  /**
   * Return whether this Interval contains the specified DateTime.
   * @param {DateTime} dateTime
   * @return {boolean}
   */


  contains(dateTime) {
    if (!this.isValid) return false;
    return this.s <= dateTime && this.e > dateTime;
  }
  /**
   * "Sets" the start and/or end dates. Returns a newly-constructed Interval.
   * @param {Object} values - the values to set
   * @param {DateTime} values.start - the starting DateTime
   * @param {DateTime} values.end - the ending DateTime
   * @return {Interval}
   */


  set() {
    let _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        start = _ref.start,
        end = _ref.end;

    if (!this.isValid) return this;
    return Interval.fromDateTimes(start || this.s, end || this.e);
  }
  /**
   * Split this Interval at each of the specified DateTimes
   * @param {...[DateTime]} dateTimes - the unit of time to count.
   * @return {[Interval]}
   */


  splitAt() {
    if (!this.isValid) return [];

    for (var _len = arguments.length, dateTimes = new Array(_len), _key = 0; _key < _len; _key++) {
      dateTimes[_key] = arguments[_key];
    }

    const sorted = dateTimes.map(friendlyDateTime).filter(d => this.contains(d)).sort(),
          results = [];
    let s = this.s,
        i = 0;

    while (s < this.e) {
      const added = sorted[i] || this.e,
            next = +added > +this.e ? this.e : added;
      results.push(Interval.fromDateTimes(s, next));
      s = next;
      i += 1;
    }

    return results;
  }
  /**
   * Split this Interval into smaller Intervals, each of the specified length.
   * Left over time is grouped into a smaller interval
   * @param {Duration|Object|number} duration - The length of each resulting interval.
   * @return {[Interval]}
   */


  splitBy(duration) {
    const dur = friendlyDuration(duration);

    if (!this.isValid || !dur.isValid || dur.as("milliseconds") === 0) {
      return [];
    }

    let s = this.s,
        idx = 1,
        next;
    const results = [];

    while (s < this.e) {
      const added = this.start.plus(dur.mapUnits(x => x * idx));
      next = +added > +this.e ? this.e : added;
      results.push(Interval.fromDateTimes(s, next));
      s = next;
      idx += 1;
    }

    return results;
  }
  /**
   * Split this Interval into the specified number of smaller intervals.
   * @param {number} numberOfParts - The number of Intervals to divide the Interval into.
   * @return {[Interval]}
   */


  divideEqually(numberOfParts) {
    if (!this.isValid) return [];
    return this.splitBy(this.length() / numberOfParts).slice(0, numberOfParts);
  }
  /**
   * Return whether this Interval overlaps with the specified Interval
   * @param {Interval} other
   * @return {boolean}
   */


  overlaps(other) {
    return this.e > other.s && this.s < other.e;
  }
  /**
   * Return whether this Interval's end is adjacent to the specified Interval's start.
   * @param {Interval} other
   * @return {boolean}
   */


  abutsStart(other) {
    if (!this.isValid) return false;
    return +this.e === +other.s;
  }
  /**
   * Return whether this Interval's start is adjacent to the specified Interval's end.
   * @param {Interval} other
   * @return {boolean}
   */


  abutsEnd(other) {
    if (!this.isValid) return false;
    return +other.e === +this.s;
  }
  /**
   * Return whether this Interval engulfs the start and end of the specified Interval.
   * @param {Interval} other
   * @return {boolean}
   */


  engulfs(other) {
    if (!this.isValid) return false;
    return this.s <= other.s && this.e >= other.e;
  }
  /**
   * Return whether this Interval has the same start and end as the specified Interval.
   * @param {Interval} other
   * @return {boolean}
   */


  equals(other) {
    if (!this.isValid || !other.isValid) {
      return false;
    }

    return this.s.equals(other.s) && this.e.equals(other.e);
  }
  /**
   * Return an Interval representing the intersection of this Interval and the specified Interval.
   * Specifically, the resulting Interval has the maximum start time and the minimum end time of the two Intervals.
   * Returns null if the intersection is empty, meaning, the intervals don't intersect.
   * @param {Interval} other
   * @return {Interval}
   */


  intersection(other) {
    if (!this.isValid) return this;
    const s = this.s > other.s ? this.s : other.s,
          e = this.e < other.e ? this.e : other.e;

    if (s >= e) {
      return null;
    } else {
      return Interval.fromDateTimes(s, e);
    }
  }
  /**
   * Return an Interval representing the union of this Interval and the specified Interval.
   * Specifically, the resulting Interval has the minimum start time and the maximum end time of the two Intervals.
   * @param {Interval} other
   * @return {Interval}
   */


  union(other) {
    if (!this.isValid) return this;
    const s = this.s < other.s ? this.s : other.s,
          e = this.e > other.e ? this.e : other.e;
    return Interval.fromDateTimes(s, e);
  }
  /**
   * Merge an array of Intervals into a equivalent minimal set of Intervals.
   * Combines overlapping and adjacent Intervals.
   * @param {[Interval]} intervals
   * @return {[Interval]}
   */


  static merge(intervals) {
    const _intervals$sort$reduc = intervals.sort((a, b) => a.s - b.s).reduce((_ref2, item) => {
      let _ref3 = interval_slicedToArray(_ref2, 2),
          sofar = _ref3[0],
          current = _ref3[1];

      if (!current) {
        return [sofar, item];
      } else if (current.overlaps(item) || current.abutsStart(item)) {
        return [sofar, current.union(item)];
      } else {
        return [sofar.concat([current]), item];
      }
    }, [[], null]),
          _intervals$sort$reduc2 = interval_slicedToArray(_intervals$sort$reduc, 2),
          found = _intervals$sort$reduc2[0],
          final = _intervals$sort$reduc2[1];

    if (final) {
      found.push(final);
    }

    return found;
  }
  /**
   * Return an array of Intervals representing the spans of time that only appear in one of the specified Intervals.
   * @param {[Interval]} intervals
   * @return {[Interval]}
   */


  static xor(intervals) {
    let start = null,
        currentCount = 0;
    const results = [],
          ends = intervals.map(i => [{
      time: i.s,
      type: "s"
    }, {
      time: i.e,
      type: "e"
    }]),
          flattened = Array.prototype.concat(...ends),
          arr = flattened.sort((a, b) => a.time - b.time);

    var _iterator = interval_createForOfIteratorHelper(arr),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        const i = _step.value;
        currentCount += i.type === "s" ? 1 : -1;

        if (currentCount === 1) {
          start = i.time;
        } else {
          if (start && +start !== +i.time) {
            results.push(Interval.fromDateTimes(start, i.time));
          }

          start = null;
        }
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }

    return Interval.merge(results);
  }
  /**
   * Return an Interval representing the span of time in this Interval that doesn't overlap with any of the specified Intervals.
   * @param {...Interval} intervals
   * @return {[Interval]}
   */


  difference() {
    for (var _len2 = arguments.length, intervals = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      intervals[_key2] = arguments[_key2];
    }

    return Interval.xor([this].concat(intervals)).map(i => this.intersection(i)).filter(i => i && !i.isEmpty());
  }
  /**
   * Returns a string representation of this Interval appropriate for debugging.
   * @return {string}
   */


  toString() {
    if (!this.isValid) return interval_INVALID;
    return `[${this.s.toISO()} – ${this.e.toISO()})`;
  }
  /**
   * Returns an ISO 8601-compliant string representation of this Interval.
   * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
   * @param {Object} opts - The same options as {@link DateTime.toISO}
   * @return {string}
   */


  toISO(opts) {
    if (!this.isValid) return interval_INVALID;
    return `${this.s.toISO(opts)}/${this.e.toISO(opts)}`;
  }
  /**
   * Returns an ISO 8601-compliant string representation of date of this Interval.
   * The time components are ignored.
   * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
   * @return {string}
   */


  toISODate() {
    if (!this.isValid) return interval_INVALID;
    return `${this.s.toISODate()}/${this.e.toISODate()}`;
  }
  /**
   * Returns an ISO 8601-compliant string representation of time of this Interval.
   * The date components are ignored.
   * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
   * @param {Object} opts - The same options as {@link DateTime.toISO}
   * @return {string}
   */


  toISOTime(opts) {
    if (!this.isValid) return interval_INVALID;
    return `${this.s.toISOTime(opts)}/${this.e.toISOTime(opts)}`;
  }
  /**
   * Returns a string representation of this Interval formatted according to the specified format string.
   * @param {string} dateFormat - the format string. This string formats the start and end time. See {@link DateTime.toFormat} for details.
   * @param {Object} opts - options
   * @param {string} [opts.separator =  ' – '] - a separator to place between the start and end representations
   * @return {string}
   */


  toFormat(dateFormat) {
    let _ref4 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref4$separator = _ref4.separator,
        separator = _ref4$separator === void 0 ? " – " : _ref4$separator;

    if (!this.isValid) return interval_INVALID;
    return `${this.s.toFormat(dateFormat)}${separator}${this.e.toFormat(dateFormat)}`;
  }
  /**
   * Return a Duration representing the time spanned by this interval.
   * @param {string|string[]} [unit=['milliseconds']] - the unit or units (such as 'hours' or 'days') to include in the duration.
   * @param {Object} opts - options that affect the creation of the Duration
   * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
   * @example Interval.fromDateTimes(dt1, dt2).toDuration().toObject() //=> { milliseconds: 88489257 }
   * @example Interval.fromDateTimes(dt1, dt2).toDuration('days').toObject() //=> { days: 1.0241812152777778 }
   * @example Interval.fromDateTimes(dt1, dt2).toDuration(['hours', 'minutes']).toObject() //=> { hours: 24, minutes: 34.82095 }
   * @example Interval.fromDateTimes(dt1, dt2).toDuration(['hours', 'minutes', 'seconds']).toObject() //=> { hours: 24, minutes: 34, seconds: 49.257 }
   * @example Interval.fromDateTimes(dt1, dt2).toDuration('seconds').toObject() //=> { seconds: 88489.257 }
   * @return {Duration}
   */


  toDuration(unit, opts) {
    if (!this.isValid) {
      return Duration.invalid(this.invalidReason);
    }

    return this.e.diff(this.s, unit, opts);
  }
  /**
   * Run mapFn on the interval start and end, returning a new Interval from the resulting DateTimes
   * @param {function} mapFn
   * @return {Interval}
   * @example Interval.fromDateTimes(dt1, dt2).mapEndpoints(endpoint => endpoint.toUTC())
   * @example Interval.fromDateTimes(dt1, dt2).mapEndpoints(endpoint => endpoint.plus({ hours: 2 }))
   */


  mapEndpoints(mapFn) {
    return Interval.fromDateTimes(mapFn(this.s), mapFn(this.e));
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/info.js






/**
 * The Info class contains static methods for retrieving general time and date related data. For example, it has methods for finding out if a time zone has a DST, for listing the months in any supported locale, and for discovering which of Luxon features are available in the current environment.
 */

class Info {
  /**
   * Return whether the specified zone contains a DST.
   * @param {string|Zone} [zone='local'] - Zone to check. Defaults to the environment's local zone.
   * @return {boolean}
   */
  static hasDST() {
    let zone = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Settings.defaultZone;
    const proto = DateTime.now().setZone(zone).set({
      month: 12
    });
    return !zone.universal && proto.offset !== proto.set({
      month: 6
    }).offset;
  }
  /**
   * Return whether the specified zone is a valid IANA specifier.
   * @param {string} zone - Zone to check
   * @return {boolean}
   */


  static isValidIANAZone(zone) {
    return IANAZone.isValidSpecifier(zone) && IANAZone.isValidZone(zone);
  }
  /**
   * Converts the input into a {@link Zone} instance.
   *
   * * If `input` is already a Zone instance, it is returned unchanged.
   * * If `input` is a string containing a valid time zone name, a Zone instance
   *   with that name is returned.
   * * If `input` is a string that doesn't refer to a known time zone, a Zone
   *   instance with {@link Zone.isValid} == false is returned.
   * * If `input is a number, a Zone instance with the specified fixed offset
   *   in minutes is returned.
   * * If `input` is `null` or `undefined`, the default zone is returned.
   * @param {string|Zone|number} [input] - the value to be converted
   * @return {Zone}
   */


  static normalizeZone(input) {
    return normalizeZone(input, Settings.defaultZone);
  }
  /**
   * Return an array of standalone month names.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
   * @param {string} [length='long'] - the length of the month representation, such as "numeric", "2-digit", "narrow", "short", "long"
   * @param {Object} opts - options
   * @param {string} [opts.locale] - the locale code
   * @param {string} [opts.numberingSystem=null] - the numbering system
   * @param {string} [opts.locObj=null] - an existing locale object to use
   * @param {string} [opts.outputCalendar='gregory'] - the calendar
   * @example Info.months()[0] //=> 'January'
   * @example Info.months('short')[0] //=> 'Jan'
   * @example Info.months('numeric')[0] //=> '1'
   * @example Info.months('short', { locale: 'fr-CA' } )[0] //=> 'janv.'
   * @example Info.months('numeric', { locale: 'ar' })[0] //=> '١'
   * @example Info.months('long', { outputCalendar: 'islamic' })[0] //=> 'Rabiʻ I'
   * @return {[string]}
   */


  static months() {
    let length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "long";

    let _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$locale = _ref.locale,
        locale = _ref$locale === void 0 ? null : _ref$locale,
        _ref$numberingSystem = _ref.numberingSystem,
        numberingSystem = _ref$numberingSystem === void 0 ? null : _ref$numberingSystem,
        _ref$locObj = _ref.locObj,
        locObj = _ref$locObj === void 0 ? null : _ref$locObj,
        _ref$outputCalendar = _ref.outputCalendar,
        outputCalendar = _ref$outputCalendar === void 0 ? "gregory" : _ref$outputCalendar;

    return (locObj || Locale.create(locale, numberingSystem, outputCalendar)).months(length);
  }
  /**
   * Return an array of format month names.
   * Format months differ from standalone months in that they're meant to appear next to the day of the month. In some languages, that
   * changes the string.
   * See {@link months}
   * @param {string} [length='long'] - the length of the month representation, such as "numeric", "2-digit", "narrow", "short", "long"
   * @param {Object} opts - options
   * @param {string} [opts.locale] - the locale code
   * @param {string} [opts.numberingSystem=null] - the numbering system
   * @param {string} [opts.locObj=null] - an existing locale object to use
   * @param {string} [opts.outputCalendar='gregory'] - the calendar
   * @return {[string]}
   */


  static monthsFormat() {
    let length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "long";

    let _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref2$locale = _ref2.locale,
        locale = _ref2$locale === void 0 ? null : _ref2$locale,
        _ref2$numberingSystem = _ref2.numberingSystem,
        numberingSystem = _ref2$numberingSystem === void 0 ? null : _ref2$numberingSystem,
        _ref2$locObj = _ref2.locObj,
        locObj = _ref2$locObj === void 0 ? null : _ref2$locObj,
        _ref2$outputCalendar = _ref2.outputCalendar,
        outputCalendar = _ref2$outputCalendar === void 0 ? "gregory" : _ref2$outputCalendar;

    return (locObj || Locale.create(locale, numberingSystem, outputCalendar)).months(length, true);
  }
  /**
   * Return an array of standalone week names.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
   * @param {string} [length='long'] - the length of the weekday representation, such as "narrow", "short", "long".
   * @param {Object} opts - options
   * @param {string} [opts.locale] - the locale code
   * @param {string} [opts.numberingSystem=null] - the numbering system
   * @param {string} [opts.locObj=null] - an existing locale object to use
   * @example Info.weekdays()[0] //=> 'Monday'
   * @example Info.weekdays('short')[0] //=> 'Mon'
   * @example Info.weekdays('short', { locale: 'fr-CA' })[0] //=> 'lun.'
   * @example Info.weekdays('short', { locale: 'ar' })[0] //=> 'الاثنين'
   * @return {[string]}
   */


  static weekdays() {
    let length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "long";

    let _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref3$locale = _ref3.locale,
        locale = _ref3$locale === void 0 ? null : _ref3$locale,
        _ref3$numberingSystem = _ref3.numberingSystem,
        numberingSystem = _ref3$numberingSystem === void 0 ? null : _ref3$numberingSystem,
        _ref3$locObj = _ref3.locObj,
        locObj = _ref3$locObj === void 0 ? null : _ref3$locObj;

    return (locObj || Locale.create(locale, numberingSystem, null)).weekdays(length);
  }
  /**
   * Return an array of format week names.
   * Format weekdays differ from standalone weekdays in that they're meant to appear next to more date information. In some languages, that
   * changes the string.
   * See {@link weekdays}
   * @param {string} [length='long'] - the length of the weekday representation, such as "narrow", "short", "long".
   * @param {Object} opts - options
   * @param {string} [opts.locale=null] - the locale code
   * @param {string} [opts.numberingSystem=null] - the numbering system
   * @param {string} [opts.locObj=null] - an existing locale object to use
   * @return {[string]}
   */


  static weekdaysFormat() {
    let length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "long";

    let _ref4 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref4$locale = _ref4.locale,
        locale = _ref4$locale === void 0 ? null : _ref4$locale,
        _ref4$numberingSystem = _ref4.numberingSystem,
        numberingSystem = _ref4$numberingSystem === void 0 ? null : _ref4$numberingSystem,
        _ref4$locObj = _ref4.locObj,
        locObj = _ref4$locObj === void 0 ? null : _ref4$locObj;

    return (locObj || Locale.create(locale, numberingSystem, null)).weekdays(length, true);
  }
  /**
   * Return an array of meridiems.
   * @param {Object} opts - options
   * @param {string} [opts.locale] - the locale code
   * @example Info.meridiems() //=> [ 'AM', 'PM' ]
   * @example Info.meridiems({ locale: 'my' }) //=> [ 'နံနက်', 'ညနေ' ]
   * @return {[string]}
   */


  static meridiems() {
    let _ref5 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref5$locale = _ref5.locale,
        locale = _ref5$locale === void 0 ? null : _ref5$locale;

    return Locale.create(locale).meridiems();
  }
  /**
   * Return an array of eras, such as ['BC', 'AD']. The locale can be specified, but the calendar system is always Gregorian.
   * @param {string} [length='short'] - the length of the era representation, such as "short" or "long".
   * @param {Object} opts - options
   * @param {string} [opts.locale] - the locale code
   * @example Info.eras() //=> [ 'BC', 'AD' ]
   * @example Info.eras('long') //=> [ 'Before Christ', 'Anno Domini' ]
   * @example Info.eras('long', { locale: 'fr' }) //=> [ 'avant Jésus-Christ', 'après Jésus-Christ' ]
   * @return {[string]}
   */


  static eras() {
    let length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "short";

    let _ref6 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref6$locale = _ref6.locale,
        locale = _ref6$locale === void 0 ? null : _ref6$locale;

    return Locale.create(locale, null, "gregory").eras(length);
  }
  /**
   * Return the set of available features in this environment.
   * Some features of Luxon are not available in all environments. For example, on older browsers, timezone support is not available. Use this function to figure out if that's the case.
   * Keys:
   * * `zones`: whether this environment supports IANA timezones
   * * `intlTokens`: whether this environment supports internationalized token-based formatting/parsing
   * * `intl`: whether this environment supports general internationalization
   * * `relative`: whether this environment supports relative time formatting
   * @example Info.features() //=> { intl: true, intlTokens: false, zones: true, relative: false }
   * @return {Object}
   */


  static features() {
    let intl = false,
        intlTokens = false,
        zones = false,
        relative = false;

    if (hasIntl()) {
      intl = true;
      intlTokens = hasFormatToParts();
      relative = hasRelative();

      try {
        zones = new Intl.DateTimeFormat("en", {
          timeZone: "America/New_York"
        }).resolvedOptions().timeZone === "America/New_York";
      } catch (e) {
        zones = false;
      }
    }

    return {
      intl,
      intlTokens,
      zones,
      relative
    };
  }

}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/diff.js
function diff_slicedToArray(arr, i) { return diff_arrayWithHoles(arr) || diff_iterableToArrayLimit(arr, i) || diff_unsupportedIterableToArray(arr, i) || diff_nonIterableRest(); }

function diff_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function diff_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return diff_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return diff_arrayLikeToArray(o, minLen); }

function diff_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function diff_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function diff_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }



function dayDiff(earlier, later) {
  const utcDayStart = dt => dt.toUTC(0, {
    keepLocalTime: true
  }).startOf("day").valueOf(),
        ms = utcDayStart(later) - utcDayStart(earlier);

  return Math.floor(Duration.fromMillis(ms).as("days"));
}

function highOrderDiffs(cursor, later, units) {
  const differs = [["years", (a, b) => b.year - a.year], ["quarters", (a, b) => b.quarter - a.quarter], ["months", (a, b) => b.month - a.month + (b.year - a.year) * 12], ["weeks", (a, b) => {
    const days = dayDiff(a, b);
    return (days - days % 7) / 7;
  }], ["days", dayDiff]];
  const results = {};
  let lowestOrder, highWater;

  for (var _i = 0, _differs = differs; _i < _differs.length; _i++) {
    const _differs$_i = diff_slicedToArray(_differs[_i], 2),
          unit = _differs$_i[0],
          differ = _differs$_i[1];

    if (units.indexOf(unit) >= 0) {
      lowestOrder = unit;
      let delta = differ(cursor, later);
      highWater = cursor.plus({
        [unit]: delta
      });

      if (highWater > later) {
        cursor = cursor.plus({
          [unit]: delta - 1
        });
        delta -= 1;
      } else {
        cursor = highWater;
      }

      results[unit] = delta;
    }
  }

  return [cursor, results, highWater, lowestOrder];
}

/* harmony default export */ function diff(earlier, later, units, opts) {
  let _highOrderDiffs = highOrderDiffs(earlier, later, units),
      _highOrderDiffs2 = diff_slicedToArray(_highOrderDiffs, 4),
      cursor = _highOrderDiffs2[0],
      results = _highOrderDiffs2[1],
      highWater = _highOrderDiffs2[2],
      lowestOrder = _highOrderDiffs2[3];

  const remainingMillis = later - cursor;
  const lowerOrderUnits = units.filter(u => ["hours", "minutes", "seconds", "milliseconds"].indexOf(u) >= 0);

  if (lowerOrderUnits.length === 0) {
    if (highWater < later) {
      highWater = cursor.plus({
        [lowestOrder]: 1
      });
    }

    if (highWater !== cursor) {
      results[lowestOrder] = (results[lowestOrder] || 0) + remainingMillis / (highWater - cursor);
    }
  }

  const duration = Duration.fromObject(Object.assign(results, opts));

  if (lowerOrderUnits.length > 0) {
    return Duration.fromMillis(remainingMillis, opts).shiftTo(...lowerOrderUnits).plus(duration);
  } else {
    return duration;
  }
}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/digits.js
function digits_slicedToArray(arr, i) { return digits_arrayWithHoles(arr) || digits_iterableToArrayLimit(arr, i) || digits_unsupportedIterableToArray(arr, i) || digits_nonIterableRest(); }

function digits_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function digits_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return digits_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return digits_arrayLikeToArray(o, minLen); }

function digits_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function digits_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function digits_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

const numberingSystems = {
  arab: "[\u0660-\u0669]",
  arabext: "[\u06F0-\u06F9]",
  bali: "[\u1B50-\u1B59]",
  beng: "[\u09E6-\u09EF]",
  deva: "[\u0966-\u096F]",
  fullwide: "[\uFF10-\uFF19]",
  gujr: "[\u0AE6-\u0AEF]",
  hanidec: "[〇|一|二|三|四|五|六|七|八|九]",
  khmr: "[\u17E0-\u17E9]",
  knda: "[\u0CE6-\u0CEF]",
  laoo: "[\u0ED0-\u0ED9]",
  limb: "[\u1946-\u194F]",
  mlym: "[\u0D66-\u0D6F]",
  mong: "[\u1810-\u1819]",
  mymr: "[\u1040-\u1049]",
  orya: "[\u0B66-\u0B6F]",
  tamldec: "[\u0BE6-\u0BEF]",
  telu: "[\u0C66-\u0C6F]",
  thai: "[\u0E50-\u0E59]",
  tibt: "[\u0F20-\u0F29]",
  latn: "\\d"
};
const numberingSystemsUTF16 = {
  arab: [1632, 1641],
  arabext: [1776, 1785],
  bali: [6992, 7001],
  beng: [2534, 2543],
  deva: [2406, 2415],
  fullwide: [65296, 65303],
  gujr: [2790, 2799],
  khmr: [6112, 6121],
  knda: [3302, 3311],
  laoo: [3792, 3801],
  limb: [6470, 6479],
  mlym: [3430, 3439],
  mong: [6160, 6169],
  mymr: [4160, 4169],
  orya: [2918, 2927],
  tamldec: [3046, 3055],
  telu: [3174, 3183],
  thai: [3664, 3673],
  tibt: [3872, 3881]
}; // eslint-disable-next-line

const hanidecChars = numberingSystems.hanidec.replace(/[\[|\]]/g, "").split("");
function parseDigits(str) {
  let value = parseInt(str, 10);

  if (isNaN(value)) {
    value = "";

    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);

      if (str[i].search(numberingSystems.hanidec) !== -1) {
        value += hanidecChars.indexOf(str[i]);
      } else {
        for (const key in numberingSystemsUTF16) {
          const _numberingSystemsUTF = digits_slicedToArray(numberingSystemsUTF16[key], 2),
                min = _numberingSystemsUTF[0],
                max = _numberingSystemsUTF[1];

          if (code >= min && code <= max) {
            value += code - min;
          }
        }
      }
    }

    return parseInt(value, 10);
  } else {
    return value;
  }
}
function digitRegex(_ref) {
  let numberingSystem = _ref.numberingSystem;
  let append = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";
  return new RegExp(`${numberingSystems[numberingSystem || "latn"]}${append}`);
}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/tokenParser.js
function tokenParser_slicedToArray(arr, i) { return tokenParser_arrayWithHoles(arr) || tokenParser_iterableToArrayLimit(arr, i) || tokenParser_unsupportedIterableToArray(arr, i) || tokenParser_nonIterableRest(); }

function tokenParser_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function tokenParser_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return tokenParser_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return tokenParser_arrayLikeToArray(o, minLen); }

function tokenParser_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function tokenParser_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function tokenParser_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }








const MISSING_FTP = "missing Intl.DateTimeFormat.formatToParts support";

function intUnit(regex) {
  let post = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : i => i;
  return {
    regex,
    deser: _ref => {
      let _ref2 = tokenParser_slicedToArray(_ref, 1),
          s = _ref2[0];

      return post(parseDigits(s));
    }
  };
}

const NBSP = String.fromCharCode(160);
const spaceOrNBSP = `( |${NBSP})`;
const spaceOrNBSPRegExp = new RegExp(spaceOrNBSP, "g");

function fixListRegex(s) {
  // make dots optional and also make them literal
  // make space and non breakable space characters interchangeable
  return s.replace(/\./g, "\\.?").replace(spaceOrNBSPRegExp, spaceOrNBSP);
}

function stripInsensitivities(s) {
  return s.replace(/\./g, "") // ignore dots that were made optional
  .replace(spaceOrNBSPRegExp, " ") // interchange space and nbsp
  .toLowerCase();
}

function oneOf(strings, startIndex) {
  if (strings === null) {
    return null;
  } else {
    return {
      regex: RegExp(strings.map(fixListRegex).join("|")),
      deser: _ref3 => {
        let _ref4 = tokenParser_slicedToArray(_ref3, 1),
            s = _ref4[0];

        return strings.findIndex(i => stripInsensitivities(s) === stripInsensitivities(i)) + startIndex;
      }
    };
  }
}

function offset(regex, groups) {
  return {
    regex,
    deser: _ref5 => {
      let _ref6 = tokenParser_slicedToArray(_ref5, 3),
          h = _ref6[1],
          m = _ref6[2];

      return signedOffset(h, m);
    },
    groups
  };
}

function simple(regex) {
  return {
    regex,
    deser: _ref7 => {
      let _ref8 = tokenParser_slicedToArray(_ref7, 1),
          s = _ref8[0];

      return s;
    }
  };
}

function escapeToken(value) {
  // eslint-disable-next-line no-useless-escape
  return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
}

function unitForToken(token, loc) {
  const one = digitRegex(loc),
        two = digitRegex(loc, "{2}"),
        three = digitRegex(loc, "{3}"),
        four = digitRegex(loc, "{4}"),
        six = digitRegex(loc, "{6}"),
        oneOrTwo = digitRegex(loc, "{1,2}"),
        oneToThree = digitRegex(loc, "{1,3}"),
        oneToSix = digitRegex(loc, "{1,6}"),
        oneToNine = digitRegex(loc, "{1,9}"),
        twoToFour = digitRegex(loc, "{2,4}"),
        fourToSix = digitRegex(loc, "{4,6}"),
        literal = t => ({
    regex: RegExp(escapeToken(t.val)),
    deser: _ref9 => {
      let _ref10 = tokenParser_slicedToArray(_ref9, 1),
          s = _ref10[0];

      return s;
    },
    literal: true
  }),
        unitate = t => {
    if (token.literal) {
      return literal(t);
    }

    switch (t.val) {
      // era
      case "G":
        return oneOf(loc.eras("short", false), 0);

      case "GG":
        return oneOf(loc.eras("long", false), 0);
      // years

      case "y":
        return intUnit(oneToSix);

      case "yy":
        return intUnit(twoToFour, untruncateYear);

      case "yyyy":
        return intUnit(four);

      case "yyyyy":
        return intUnit(fourToSix);

      case "yyyyyy":
        return intUnit(six);
      // months

      case "M":
        return intUnit(oneOrTwo);

      case "MM":
        return intUnit(two);

      case "MMM":
        return oneOf(loc.months("short", true, false), 1);

      case "MMMM":
        return oneOf(loc.months("long", true, false), 1);

      case "L":
        return intUnit(oneOrTwo);

      case "LL":
        return intUnit(two);

      case "LLL":
        return oneOf(loc.months("short", false, false), 1);

      case "LLLL":
        return oneOf(loc.months("long", false, false), 1);
      // dates

      case "d":
        return intUnit(oneOrTwo);

      case "dd":
        return intUnit(two);
      // ordinals

      case "o":
        return intUnit(oneToThree);

      case "ooo":
        return intUnit(three);
      // time

      case "HH":
        return intUnit(two);

      case "H":
        return intUnit(oneOrTwo);

      case "hh":
        return intUnit(two);

      case "h":
        return intUnit(oneOrTwo);

      case "mm":
        return intUnit(two);

      case "m":
        return intUnit(oneOrTwo);

      case "q":
        return intUnit(oneOrTwo);

      case "qq":
        return intUnit(two);

      case "s":
        return intUnit(oneOrTwo);

      case "ss":
        return intUnit(two);

      case "S":
        return intUnit(oneToThree);

      case "SSS":
        return intUnit(three);

      case "u":
        return simple(oneToNine);
      // meridiem

      case "a":
        return oneOf(loc.meridiems(), 0);
      // weekYear (k)

      case "kkkk":
        return intUnit(four);

      case "kk":
        return intUnit(twoToFour, untruncateYear);
      // weekNumber (W)

      case "W":
        return intUnit(oneOrTwo);

      case "WW":
        return intUnit(two);
      // weekdays

      case "E":
      case "c":
        return intUnit(one);

      case "EEE":
        return oneOf(loc.weekdays("short", false, false), 1);

      case "EEEE":
        return oneOf(loc.weekdays("long", false, false), 1);

      case "ccc":
        return oneOf(loc.weekdays("short", true, false), 1);

      case "cccc":
        return oneOf(loc.weekdays("long", true, false), 1);
      // offset/zone

      case "Z":
      case "ZZ":
        return offset(new RegExp(`([+-]${oneOrTwo.source})(?::(${two.source}))?`), 2);

      case "ZZZ":
        return offset(new RegExp(`([+-]${oneOrTwo.source})(${two.source})?`), 2);
      // we don't support ZZZZ (PST) or ZZZZZ (Pacific Standard Time) in parsing
      // because we don't have any way to figure out what they are

      case "z":
        return simple(/[a-z_+-/]{1,256}?/i);

      default:
        return literal(t);
    }
  };

  const unit = unitate(token) || {
    invalidReason: MISSING_FTP
  };
  unit.token = token;
  return unit;
}

const partTypeStyleToTokenVal = {
  year: {
    "2-digit": "yy",
    numeric: "yyyyy"
  },
  month: {
    numeric: "M",
    "2-digit": "MM",
    short: "MMM",
    long: "MMMM"
  },
  day: {
    numeric: "d",
    "2-digit": "dd"
  },
  weekday: {
    short: "EEE",
    long: "EEEE"
  },
  dayperiod: "a",
  dayPeriod: "a",
  hour: {
    numeric: "h",
    "2-digit": "hh"
  },
  minute: {
    numeric: "m",
    "2-digit": "mm"
  },
  second: {
    numeric: "s",
    "2-digit": "ss"
  }
};

function tokenForPart(part, locale, formatOpts) {
  const type = part.type,
        value = part.value;

  if (type === "literal") {
    return {
      literal: true,
      val: value
    };
  }

  const style = formatOpts[type];
  let val = partTypeStyleToTokenVal[type];

  if (typeof val === "object") {
    val = val[style];
  }

  if (val) {
    return {
      literal: false,
      val
    };
  }

  return undefined;
}

function buildRegex(units) {
  const re = units.map(u => u.regex).reduce((f, r) => `${f}(${r.source})`, "");
  return [`^${re}$`, units];
}

function match(input, regex, handlers) {
  const matches = input.match(regex);

  if (matches) {
    const all = {};
    let matchIndex = 1;

    for (const i in handlers) {
      if (util_hasOwnProperty(handlers, i)) {
        const h = handlers[i],
              groups = h.groups ? h.groups + 1 : 1;

        if (!h.literal && h.token) {
          all[h.token.val[0]] = h.deser(matches.slice(matchIndex, matchIndex + groups));
        }

        matchIndex += groups;
      }
    }

    return [matches, all];
  } else {
    return [matches, {}];
  }
}

function dateTimeFromMatches(matches) {
  const toField = token => {
    switch (token) {
      case "S":
        return "millisecond";

      case "s":
        return "second";

      case "m":
        return "minute";

      case "h":
      case "H":
        return "hour";

      case "d":
        return "day";

      case "o":
        return "ordinal";

      case "L":
      case "M":
        return "month";

      case "y":
        return "year";

      case "E":
      case "c":
        return "weekday";

      case "W":
        return "weekNumber";

      case "k":
        return "weekYear";

      case "q":
        return "quarter";

      default:
        return null;
    }
  };

  let zone;

  if (!isUndefined(matches.Z)) {
    zone = new FixedOffsetZone(matches.Z);
  } else if (!isUndefined(matches.z)) {
    zone = IANAZone.create(matches.z);
  } else {
    zone = null;
  }

  if (!isUndefined(matches.q)) {
    matches.M = (matches.q - 1) * 3 + 1;
  }

  if (!isUndefined(matches.h)) {
    if (matches.h < 12 && matches.a === 1) {
      matches.h += 12;
    } else if (matches.h === 12 && matches.a === 0) {
      matches.h = 0;
    }
  }

  if (matches.G === 0 && matches.y) {
    matches.y = -matches.y;
  }

  if (!isUndefined(matches.u)) {
    matches.S = parseMillis(matches.u);
  }

  const vals = Object.keys(matches).reduce((r, k) => {
    const f = toField(k);

    if (f) {
      r[f] = matches[k];
    }

    return r;
  }, {});
  return [vals, zone];
}

let dummyDateTimeCache = null;

function getDummyDateTime() {
  if (!dummyDateTimeCache) {
    dummyDateTimeCache = DateTime.fromMillis(1555555555555);
  }

  return dummyDateTimeCache;
}

function maybeExpandMacroToken(token, locale) {
  if (token.literal) {
    return token;
  }

  const formatOpts = Formatter.macroTokenToFormatOpts(token.val);

  if (!formatOpts) {
    return token;
  }

  const formatter = Formatter.create(locale, formatOpts);
  const parts = formatter.formatDateTimeParts(getDummyDateTime());
  const tokens = parts.map(p => tokenForPart(p, locale, formatOpts));

  if (tokens.includes(undefined)) {
    return token;
  }

  return tokens;
}

function expandMacroTokens(tokens, locale) {
  return Array.prototype.concat(...tokens.map(t => maybeExpandMacroToken(t, locale)));
}
/**
 * @private
 */


function explainFromTokens(locale, input, format) {
  const tokens = expandMacroTokens(Formatter.parseFormat(format), locale),
        units = tokens.map(t => unitForToken(t, locale)),
        disqualifyingUnit = units.find(t => t.invalidReason);

  if (disqualifyingUnit) {
    return {
      input,
      tokens,
      invalidReason: disqualifyingUnit.invalidReason
    };
  } else {
    const _buildRegex = buildRegex(units),
          _buildRegex2 = tokenParser_slicedToArray(_buildRegex, 2),
          regexString = _buildRegex2[0],
          handlers = _buildRegex2[1],
          regex = RegExp(regexString, "i"),
          _match = match(input, regex, handlers),
          _match2 = tokenParser_slicedToArray(_match, 2),
          rawMatches = _match2[0],
          matches = _match2[1],
          _ref11 = matches ? dateTimeFromMatches(matches) : [null, null],
          _ref12 = tokenParser_slicedToArray(_ref11, 2),
          result = _ref12[0],
          zone = _ref12[1];

    if (util_hasOwnProperty(matches, "a") && util_hasOwnProperty(matches, "H")) {
      throw new ConflictingSpecificationError("Can't include meridiem when specifying 24-hour format");
    }

    return {
      input,
      tokens,
      regex,
      rawMatches,
      matches,
      result,
      zone
    };
  }
}
function parseFromTokens(locale, input, format) {
  const _explainFromTokens = explainFromTokens(locale, input, format),
        result = _explainFromTokens.result,
        zone = _explainFromTokens.zone,
        invalidReason = _explainFromTokens.invalidReason;

  return [result, zone, invalidReason];
}
;// CONCATENATED MODULE: ./node_modules/luxon/src/impl/conversions.js


const nonLeapLadder = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
      leapLadder = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

function unitOutOfRange(unit, value) {
  return new Invalid("unit out of range", `you specified ${value} (of type ${typeof value}) as a ${unit}, which is invalid`);
}

function dayOfWeek(year, month, day) {
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return js === 0 ? 7 : js;
}

function computeOrdinal(year, month, day) {
  return day + (isLeapYear(year) ? leapLadder : nonLeapLadder)[month - 1];
}

function uncomputeOrdinal(year, ordinal) {
  const table = isLeapYear(year) ? leapLadder : nonLeapLadder,
        month0 = table.findIndex(i => i < ordinal),
        day = ordinal - table[month0];
  return {
    month: month0 + 1,
    day
  };
}
/**
 * @private
 */


function gregorianToWeek(gregObj) {
  const year = gregObj.year,
        month = gregObj.month,
        day = gregObj.day,
        ordinal = computeOrdinal(year, month, day),
        weekday = dayOfWeek(year, month, day);
  let weekNumber = Math.floor((ordinal - weekday + 10) / 7),
      weekYear;

  if (weekNumber < 1) {
    weekYear = year - 1;
    weekNumber = weeksInWeekYear(weekYear);
  } else if (weekNumber > weeksInWeekYear(year)) {
    weekYear = year + 1;
    weekNumber = 1;
  } else {
    weekYear = year;
  }

  return Object.assign({
    weekYear,
    weekNumber,
    weekday
  }, timeObject(gregObj));
}
function weekToGregorian(weekData) {
  const weekYear = weekData.weekYear,
        weekNumber = weekData.weekNumber,
        weekday = weekData.weekday,
        weekdayOfJan4 = dayOfWeek(weekYear, 1, 4),
        yearInDays = daysInYear(weekYear);
  let ordinal = weekNumber * 7 + weekday - weekdayOfJan4 - 3,
      year;

  if (ordinal < 1) {
    year = weekYear - 1;
    ordinal += daysInYear(year);
  } else if (ordinal > yearInDays) {
    year = weekYear + 1;
    ordinal -= daysInYear(weekYear);
  } else {
    year = weekYear;
  }

  const _uncomputeOrdinal = uncomputeOrdinal(year, ordinal),
        month = _uncomputeOrdinal.month,
        day = _uncomputeOrdinal.day;

  return Object.assign({
    year,
    month,
    day
  }, timeObject(weekData));
}
function gregorianToOrdinal(gregData) {
  const year = gregData.year,
        month = gregData.month,
        day = gregData.day,
        ordinal = computeOrdinal(year, month, day);
  return Object.assign({
    year,
    ordinal
  }, timeObject(gregData));
}
function ordinalToGregorian(ordinalData) {
  const year = ordinalData.year,
        ordinal = ordinalData.ordinal,
        _uncomputeOrdinal2 = uncomputeOrdinal(year, ordinal),
        month = _uncomputeOrdinal2.month,
        day = _uncomputeOrdinal2.day;

  return Object.assign({
    year,
    month,
    day
  }, timeObject(ordinalData));
}
function hasInvalidWeekData(obj) {
  const validYear = isInteger(obj.weekYear),
        validWeek = integerBetween(obj.weekNumber, 1, weeksInWeekYear(obj.weekYear)),
        validWeekday = integerBetween(obj.weekday, 1, 7);

  if (!validYear) {
    return unitOutOfRange("weekYear", obj.weekYear);
  } else if (!validWeek) {
    return unitOutOfRange("week", obj.week);
  } else if (!validWeekday) {
    return unitOutOfRange("weekday", obj.weekday);
  } else return false;
}
function hasInvalidOrdinalData(obj) {
  const validYear = isInteger(obj.year),
        validOrdinal = integerBetween(obj.ordinal, 1, daysInYear(obj.year));

  if (!validYear) {
    return unitOutOfRange("year", obj.year);
  } else if (!validOrdinal) {
    return unitOutOfRange("ordinal", obj.ordinal);
  } else return false;
}
function hasInvalidGregorianData(obj) {
  const validYear = isInteger(obj.year),
        validMonth = integerBetween(obj.month, 1, 12),
        validDay = integerBetween(obj.day, 1, daysInMonth(obj.year, obj.month));

  if (!validYear) {
    return unitOutOfRange("year", obj.year);
  } else if (!validMonth) {
    return unitOutOfRange("month", obj.month);
  } else if (!validDay) {
    return unitOutOfRange("day", obj.day);
  } else return false;
}
function hasInvalidTimeData(obj) {
  const hour = obj.hour,
        minute = obj.minute,
        second = obj.second,
        millisecond = obj.millisecond;
  const validHour = integerBetween(hour, 0, 23) || hour === 24 && minute === 0 && second === 0 && millisecond === 0,
        validMinute = integerBetween(minute, 0, 59),
        validSecond = integerBetween(second, 0, 59),
        validMillisecond = integerBetween(millisecond, 0, 999);

  if (!validHour) {
    return unitOutOfRange("hour", hour);
  } else if (!validMinute) {
    return unitOutOfRange("minute", minute);
  } else if (!validSecond) {
    return unitOutOfRange("second", second);
  } else if (!validMillisecond) {
    return unitOutOfRange("millisecond", millisecond);
  } else return false;
}
;// CONCATENATED MODULE: ./node_modules/luxon/src/datetime.js
function datetime_createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = datetime_unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

function datetime_slicedToArray(arr, i) { return datetime_arrayWithHoles(arr) || datetime_iterableToArrayLimit(arr, i) || datetime_unsupportedIterableToArray(arr, i) || datetime_nonIterableRest(); }

function datetime_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function datetime_unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return datetime_arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return datetime_arrayLikeToArray(o, minLen); }

function datetime_arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }

function datetime_iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function datetime_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

















const datetime_INVALID = "Invalid DateTime";
const MAX_DATE = 8.64e15;

function unsupportedZone(zone) {
  return new Invalid("unsupported zone", `the zone "${zone.name}" is not supported`);
} // we cache week data on the DT object and this intermediates the cache


function possiblyCachedWeekData(dt) {
  if (dt.weekData === null) {
    dt.weekData = gregorianToWeek(dt.c);
  }

  return dt.weekData;
} // clone really means, "make a new object with these modifications". all "setters" really use this
// to create a new object while only changing some of the properties


function datetime_clone(inst, alts) {
  const current = {
    ts: inst.ts,
    zone: inst.zone,
    c: inst.c,
    o: inst.o,
    loc: inst.loc,
    invalid: inst.invalid
  };
  return new DateTime(Object.assign({}, current, alts, {
    old: current
  }));
} // find the right offset a given local time. The o input is our guess, which determines which
// offset we'll pick in ambiguous cases (e.g. there are two 3 AMs b/c Fallback DST)


function fixOffset(localTS, o, tz) {
  // Our UTC time is just a guess because our offset is just a guess
  let utcGuess = localTS - o * 60 * 1000; // Test whether the zone matches the offset for this ts

  const o2 = tz.offset(utcGuess); // If so, offset didn't change and we're done

  if (o === o2) {
    return [utcGuess, o];
  } // If not, change the ts by the difference in the offset


  utcGuess -= (o2 - o) * 60 * 1000; // If that gives us the local time we want, we're done

  const o3 = tz.offset(utcGuess);

  if (o2 === o3) {
    return [utcGuess, o2];
  } // If it's different, we're in a hole time. The offset has changed, but the we don't adjust the time


  return [localTS - Math.min(o2, o3) * 60 * 1000, Math.max(o2, o3)];
} // convert an epoch timestamp into a calendar object with the given offset


function tsToObj(ts, offset) {
  ts += offset * 60 * 1000;
  const d = new Date(ts);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    millisecond: d.getUTCMilliseconds()
  };
} // convert a calendar object to a epoch timestamp


function objToTS(obj, offset, zone) {
  return fixOffset(objToLocalTS(obj), offset, zone);
} // create a new DT instance by adding a duration, adjusting for DSTs


function adjustTime(inst, dur) {
  const oPre = inst.o,
        year = inst.c.year + Math.trunc(dur.years),
        month = inst.c.month + Math.trunc(dur.months) + Math.trunc(dur.quarters) * 3,
        c = Object.assign({}, inst.c, {
    year,
    month,
    day: Math.min(inst.c.day, daysInMonth(year, month)) + Math.trunc(dur.days) + Math.trunc(dur.weeks) * 7
  }),
        millisToAdd = Duration.fromObject({
    years: dur.years - Math.trunc(dur.years),
    quarters: dur.quarters - Math.trunc(dur.quarters),
    months: dur.months - Math.trunc(dur.months),
    weeks: dur.weeks - Math.trunc(dur.weeks),
    days: dur.days - Math.trunc(dur.days),
    hours: dur.hours,
    minutes: dur.minutes,
    seconds: dur.seconds,
    milliseconds: dur.milliseconds
  }).as("milliseconds"),
        localTS = objToLocalTS(c);

  let _fixOffset = fixOffset(localTS, oPre, inst.zone),
      _fixOffset2 = datetime_slicedToArray(_fixOffset, 2),
      ts = _fixOffset2[0],
      o = _fixOffset2[1];

  if (millisToAdd !== 0) {
    ts += millisToAdd; // that could have changed the offset by going over a DST, but we want to keep the ts the same

    o = inst.zone.offset(ts);
  }

  return {
    ts,
    o
  };
} // helper useful in turning the results of parsing into real dates
// by handling the zone options


function parseDataToDateTime(parsed, parsedZone, opts, format, text) {
  const setZone = opts.setZone,
        zone = opts.zone;

  if (parsed && Object.keys(parsed).length !== 0) {
    const interpretationZone = parsedZone || zone,
          inst = DateTime.fromObject(Object.assign(parsed, opts, {
      zone: interpretationZone,
      // setZone is a valid option in the calling methods, but not in fromObject
      setZone: undefined
    }));
    return setZone ? inst : inst.setZone(zone);
  } else {
    return DateTime.invalid(new Invalid("unparsable", `the input "${text}" can't be parsed as ${format}`));
  }
} // if you want to output a technical format (e.g. RFC 2822), this helper
// helps handle the details


function toTechFormat(dt, format) {
  let allowZ = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  return dt.isValid ? Formatter.create(Locale.create("en-US"), {
    allowZ,
    forceSimple: true
  }).formatDateTimeFromString(dt, format) : null;
} // technical time formats (e.g. the time part of ISO 8601), take some options
// and this commonizes their handling


function toTechTimeFormat(dt, _ref) {
  let _ref$suppressSeconds = _ref.suppressSeconds,
      suppressSeconds = _ref$suppressSeconds === void 0 ? false : _ref$suppressSeconds,
      _ref$suppressMillisec = _ref.suppressMilliseconds,
      suppressMilliseconds = _ref$suppressMillisec === void 0 ? false : _ref$suppressMillisec,
      includeOffset = _ref.includeOffset,
      _ref$includePrefix = _ref.includePrefix,
      includePrefix = _ref$includePrefix === void 0 ? false : _ref$includePrefix,
      _ref$includeZone = _ref.includeZone,
      includeZone = _ref$includeZone === void 0 ? false : _ref$includeZone,
      _ref$spaceZone = _ref.spaceZone,
      spaceZone = _ref$spaceZone === void 0 ? false : _ref$spaceZone,
      _ref$format = _ref.format,
      format = _ref$format === void 0 ? "extended" : _ref$format;
  let fmt = format === "basic" ? "HHmm" : "HH:mm";

  if (!suppressSeconds || dt.second !== 0 || dt.millisecond !== 0) {
    fmt += format === "basic" ? "ss" : ":ss";

    if (!suppressMilliseconds || dt.millisecond !== 0) {
      fmt += ".SSS";
    }
  }

  if ((includeZone || includeOffset) && spaceZone) {
    fmt += " ";
  }

  if (includeZone) {
    fmt += "z";
  } else if (includeOffset) {
    fmt += format === "basic" ? "ZZZ" : "ZZ";
  }

  let str = toTechFormat(dt, fmt);

  if (includePrefix) {
    str = "T" + str;
  }

  return str;
} // defaults for unspecified units in the supported calendars


const defaultUnitValues = {
  month: 1,
  day: 1,
  hour: 0,
  minute: 0,
  second: 0,
  millisecond: 0
},
      defaultWeekUnitValues = {
  weekNumber: 1,
  weekday: 1,
  hour: 0,
  minute: 0,
  second: 0,
  millisecond: 0
},
      defaultOrdinalUnitValues = {
  ordinal: 1,
  hour: 0,
  minute: 0,
  second: 0,
  millisecond: 0
}; // Units in the supported calendars, sorted by bigness

const datetime_orderedUnits = ["year", "month", "day", "hour", "minute", "second", "millisecond"],
      orderedWeekUnits = ["weekYear", "weekNumber", "weekday", "hour", "minute", "second", "millisecond"],
      orderedOrdinalUnits = ["year", "ordinal", "hour", "minute", "second", "millisecond"]; // standardize case and plurality in units

function normalizeUnit(unit) {
  const normalized = {
    year: "year",
    years: "year",
    month: "month",
    months: "month",
    day: "day",
    days: "day",
    hour: "hour",
    hours: "hour",
    minute: "minute",
    minutes: "minute",
    quarter: "quarter",
    quarters: "quarter",
    second: "second",
    seconds: "second",
    millisecond: "millisecond",
    milliseconds: "millisecond",
    weekday: "weekday",
    weekdays: "weekday",
    weeknumber: "weekNumber",
    weeksnumber: "weekNumber",
    weeknumbers: "weekNumber",
    weekyear: "weekYear",
    weekyears: "weekYear",
    ordinal: "ordinal"
  }[unit.toLowerCase()];
  if (!normalized) throw new InvalidUnitError(unit);
  return normalized;
} // this is a dumbed down version of fromObject() that runs about 60% faster
// but doesn't do any validation, makes a bunch of assumptions about what units
// are present, and so on.


function quickDT(obj, zone) {
  // assume we have the higher-order units
  var _iterator = datetime_createForOfIteratorHelper(datetime_orderedUnits),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      const u = _step.value;

      if (isUndefined(obj[u])) {
        obj[u] = defaultUnitValues[u];
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  const invalid = hasInvalidGregorianData(obj) || hasInvalidTimeData(obj);

  if (invalid) {
    return DateTime.invalid(invalid);
  }

  const tsNow = Settings.now(),
        offsetProvis = zone.offset(tsNow),
        _objToTS = objToTS(obj, offsetProvis, zone),
        _objToTS2 = datetime_slicedToArray(_objToTS, 2),
        ts = _objToTS2[0],
        o = _objToTS2[1];

  return new DateTime({
    ts,
    zone,
    o
  });
}

function diffRelative(start, end, opts) {
  const round = isUndefined(opts.round) ? true : opts.round,
        format = (c, unit) => {
    c = roundTo(c, round || opts.calendary ? 0 : 2, true);
    const formatter = end.loc.clone(opts).relFormatter(opts);
    return formatter.format(c, unit);
  },
        differ = unit => {
    if (opts.calendary) {
      if (!end.hasSame(start, unit)) {
        return end.startOf(unit).diff(start.startOf(unit), unit).get(unit);
      } else return 0;
    } else {
      return end.diff(start, unit).get(unit);
    }
  };

  if (opts.unit) {
    return format(differ(opts.unit), opts.unit);
  }

  var _iterator2 = datetime_createForOfIteratorHelper(opts.units),
      _step2;

  try {
    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
      const unit = _step2.value;
      const count = differ(unit);

      if (Math.abs(count) >= 1) {
        return format(count, unit);
      }
    }
  } catch (err) {
    _iterator2.e(err);
  } finally {
    _iterator2.f();
  }

  return format(start > end ? -0 : 0, opts.units[opts.units.length - 1]);
}
/**
 * A DateTime is an immutable data structure representing a specific date and time and accompanying methods. It contains class and instance methods for creating, parsing, interrogating, transforming, and formatting them.
 *
 * A DateTime comprises of:
 * * A timestamp. Each DateTime instance refers to a specific millisecond of the Unix epoch.
 * * A time zone. Each instance is considered in the context of a specific zone (by default the local system's zone).
 * * Configuration properties that effect how output strings are formatted, such as `locale`, `numberingSystem`, and `outputCalendar`.
 *
 * Here is a brief overview of the most commonly used functionality it provides:
 *
 * * **Creation**: To create a DateTime from its components, use one of its factory class methods: {@link local}, {@link utc}, and (most flexibly) {@link fromObject}. To create one from a standard string format, use {@link fromISO}, {@link fromHTTP}, and {@link fromRFC2822}. To create one from a custom string format, use {@link fromFormat}. To create one from a native JS date, use {@link fromJSDate}.
 * * **Gregorian calendar and time**: To examine the Gregorian properties of a DateTime individually (i.e as opposed to collectively through {@link toObject}), use the {@link year}, {@link month},
 * {@link day}, {@link hour}, {@link minute}, {@link second}, {@link millisecond} accessors.
 * * **Week calendar**: For ISO week calendar attributes, see the {@link weekYear}, {@link weekNumber}, and {@link weekday} accessors.
 * * **Configuration** See the {@link locale} and {@link numberingSystem} accessors.
 * * **Transformation**: To transform the DateTime into other DateTimes, use {@link set}, {@link reconfigure}, {@link setZone}, {@link setLocale}, {@link plus}, {@link minus}, {@link endOf}, {@link startOf}, {@link toUTC}, and {@link toLocal}.
 * * **Output**: To convert the DateTime to other representations, use the {@link toRelative}, {@link toRelativeCalendar}, {@link toJSON}, {@link toISO}, {@link toHTTP}, {@link toObject}, {@link toRFC2822}, {@link toString}, {@link toLocaleString}, {@link toFormat}, {@link toMillis} and {@link toJSDate}.
 *
 * There's plenty others documented below. In addition, for more information on subtler topics like internationalization, time zones, alternative calendars, validity, and so on, see the external documentation.
 */


class DateTime {
  /**
   * @access private
   */
  constructor(config) {
    const zone = config.zone || Settings.defaultZone;
    let invalid = config.invalid || (Number.isNaN(config.ts) ? new Invalid("invalid input") : null) || (!zone.isValid ? unsupportedZone(zone) : null);
    /**
     * @access private
     */

    this.ts = isUndefined(config.ts) ? Settings.now() : config.ts;
    let c = null,
        o = null;

    if (!invalid) {
      const unchanged = config.old && config.old.ts === this.ts && config.old.zone.equals(zone);

      if (unchanged) {
        var _ref2 = [config.old.c, config.old.o];
        c = _ref2[0];
        o = _ref2[1];
      } else {
        const ot = zone.offset(this.ts);
        c = tsToObj(this.ts, ot);
        invalid = Number.isNaN(c.year) ? new Invalid("invalid input") : null;
        c = invalid ? null : c;
        o = invalid ? null : ot;
      }
    }
    /**
     * @access private
     */


    this._zone = zone;
    /**
     * @access private
     */

    this.loc = config.loc || Locale.create();
    /**
     * @access private
     */

    this.invalid = invalid;
    /**
     * @access private
     */

    this.weekData = null;
    /**
     * @access private
     */

    this.c = c;
    /**
     * @access private
     */

    this.o = o;
    /**
     * @access private
     */

    this.isLuxonDateTime = true;
  } // CONSTRUCT

  /**
   * Create a DateTime for the current instant, in the system's time zone.
   *
   * Use Settings to override these default values if needed.
   * @example DateTime.now().toISO() //~> now in the ISO format
   * @return {DateTime}
   */


  static now() {
    return new DateTime({});
  }
  /**
   * Create a local DateTime
   * @param {number} [year] - The calendar year. If omitted (as in, call `local()` with no arguments), the current time will be used
   * @param {number} [month=1] - The month, 1-indexed
   * @param {number} [day=1] - The day of the month, 1-indexed
   * @param {number} [hour=0] - The hour of the day, in 24-hour time
   * @param {number} [minute=0] - The minute of the hour, meaning a number between 0 and 59
   * @param {number} [second=0] - The second of the minute, meaning a number between 0 and 59
   * @param {number} [millisecond=0] - The millisecond of the second, meaning a number between 0 and 999
   * @example DateTime.local()                            //~> now
   * @example DateTime.local(2017)                        //~> 2017-01-01T00:00:00
   * @example DateTime.local(2017, 3)                     //~> 2017-03-01T00:00:00
   * @example DateTime.local(2017, 3, 12)                 //~> 2017-03-12T00:00:00
   * @example DateTime.local(2017, 3, 12, 5)              //~> 2017-03-12T05:00:00
   * @example DateTime.local(2017, 3, 12, 5, 45)          //~> 2017-03-12T05:45:00
   * @example DateTime.local(2017, 3, 12, 5, 45, 10)      //~> 2017-03-12T05:45:10
   * @example DateTime.local(2017, 3, 12, 5, 45, 10, 765) //~> 2017-03-12T05:45:10.765
   * @return {DateTime}
   */


  static local(year, month, day, hour, minute, second, millisecond) {
    if (isUndefined(year)) {
      return DateTime.now();
    } else {
      return quickDT({
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond
      }, Settings.defaultZone);
    }
  }
  /**
   * Create a DateTime in UTC
   * @param {number} [year] - The calendar year. If omitted (as in, call `utc()` with no arguments), the current time will be used
   * @param {number} [month=1] - The month, 1-indexed
   * @param {number} [day=1] - The day of the month
   * @param {number} [hour=0] - The hour of the day, in 24-hour time
   * @param {number} [minute=0] - The minute of the hour, meaning a number between 0 and 59
   * @param {number} [second=0] - The second of the minute, meaning a number between 0 and 59
   * @param {number} [millisecond=0] - The millisecond of the second, meaning a number between 0 and 999
   * @example DateTime.utc()                            //~> now
   * @example DateTime.utc(2017)                        //~> 2017-01-01T00:00:00Z
   * @example DateTime.utc(2017, 3)                     //~> 2017-03-01T00:00:00Z
   * @example DateTime.utc(2017, 3, 12)                 //~> 2017-03-12T00:00:00Z
   * @example DateTime.utc(2017, 3, 12, 5)              //~> 2017-03-12T05:00:00Z
   * @example DateTime.utc(2017, 3, 12, 5, 45)          //~> 2017-03-12T05:45:00Z
   * @example DateTime.utc(2017, 3, 12, 5, 45, 10)      //~> 2017-03-12T05:45:10Z
   * @example DateTime.utc(2017, 3, 12, 5, 45, 10, 765) //~> 2017-03-12T05:45:10.765Z
   * @return {DateTime}
   */


  static utc(year, month, day, hour, minute, second, millisecond) {
    if (isUndefined(year)) {
      return new DateTime({
        ts: Settings.now(),
        zone: FixedOffsetZone.utcInstance
      });
    } else {
      return quickDT({
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond
      }, FixedOffsetZone.utcInstance);
    }
  }
  /**
   * Create a DateTime from a JavaScript Date object. Uses the default zone.
   * @param {Date} date - a JavaScript Date object
   * @param {Object} options - configuration options for the DateTime
   * @param {string|Zone} [options.zone='local'] - the zone to place the DateTime into
   * @return {DateTime}
   */


  static fromJSDate(date) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    const ts = isDate(date) ? date.valueOf() : NaN;

    if (Number.isNaN(ts)) {
      return DateTime.invalid("invalid input");
    }

    const zoneToUse = normalizeZone(options.zone, Settings.defaultZone);

    if (!zoneToUse.isValid) {
      return DateTime.invalid(unsupportedZone(zoneToUse));
    }

    return new DateTime({
      ts: ts,
      zone: zoneToUse,
      loc: Locale.fromObject(options)
    });
  }
  /**
   * Create a DateTime from a number of milliseconds since the epoch (meaning since 1 January 1970 00:00:00 UTC). Uses the default zone.
   * @param {number} milliseconds - a number of milliseconds since 1970 UTC
   * @param {Object} options - configuration options for the DateTime
   * @param {string|Zone} [options.zone='local'] - the zone to place the DateTime into
   * @param {string} [options.locale] - a locale to set on the resulting DateTime instance
   * @param {string} options.outputCalendar - the output calendar to set on the resulting DateTime instance
   * @param {string} options.numberingSystem - the numbering system to set on the resulting DateTime instance
   * @return {DateTime}
   */


  static fromMillis(milliseconds) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    if (!isNumber(milliseconds)) {
      throw new InvalidArgumentError(`fromMillis requires a numerical input, but received a ${typeof milliseconds} with value ${milliseconds}`);
    } else if (milliseconds < -MAX_DATE || milliseconds > MAX_DATE) {
      // this isn't perfect because because we can still end up out of range because of additional shifting, but it's a start
      return DateTime.invalid("Timestamp out of range");
    } else {
      return new DateTime({
        ts: milliseconds,
        zone: normalizeZone(options.zone, Settings.defaultZone),
        loc: Locale.fromObject(options)
      });
    }
  }
  /**
   * Create a DateTime from a number of seconds since the epoch (meaning since 1 January 1970 00:00:00 UTC). Uses the default zone.
   * @param {number} seconds - a number of seconds since 1970 UTC
   * @param {Object} options - configuration options for the DateTime
   * @param {string|Zone} [options.zone='local'] - the zone to place the DateTime into
   * @param {string} [options.locale] - a locale to set on the resulting DateTime instance
   * @param {string} options.outputCalendar - the output calendar to set on the resulting DateTime instance
   * @param {string} options.numberingSystem - the numbering system to set on the resulting DateTime instance
   * @return {DateTime}
   */


  static fromSeconds(seconds) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    if (!isNumber(seconds)) {
      throw new InvalidArgumentError("fromSeconds requires a numerical input");
    } else {
      return new DateTime({
        ts: seconds * 1000,
        zone: normalizeZone(options.zone, Settings.defaultZone),
        loc: Locale.fromObject(options)
      });
    }
  }
  /**
   * Create a DateTime from a JavaScript object with keys like 'year' and 'hour' with reasonable defaults.
   * @param {Object} obj - the object to create the DateTime from
   * @param {number} obj.year - a year, such as 1987
   * @param {number} obj.month - a month, 1-12
   * @param {number} obj.day - a day of the month, 1-31, depending on the month
   * @param {number} obj.ordinal - day of the year, 1-365 or 366
   * @param {number} obj.weekYear - an ISO week year
   * @param {number} obj.weekNumber - an ISO week number, between 1 and 52 or 53, depending on the year
   * @param {number} obj.weekday - an ISO weekday, 1-7, where 1 is Monday and 7 is Sunday
   * @param {number} obj.hour - hour of the day, 0-23
   * @param {number} obj.minute - minute of the hour, 0-59
   * @param {number} obj.second - second of the minute, 0-59
   * @param {number} obj.millisecond - millisecond of the second, 0-999
   * @param {string|Zone} [obj.zone='local'] - interpret the numbers in the context of a particular zone. Can take any value taken as the first argument to setZone()
   * @param {string} [obj.locale='system's locale'] - a locale to set on the resulting DateTime instance
   * @param {string} obj.outputCalendar - the output calendar to set on the resulting DateTime instance
   * @param {string} obj.numberingSystem - the numbering system to set on the resulting DateTime instance
   * @example DateTime.fromObject({ year: 1982, month: 5, day: 25}).toISODate() //=> '1982-05-25'
   * @example DateTime.fromObject({ year: 1982 }).toISODate() //=> '1982-01-01'
   * @example DateTime.fromObject({ hour: 10, minute: 26, second: 6 }) //~> today at 10:26:06
   * @example DateTime.fromObject({ hour: 10, minute: 26, second: 6, zone: 'utc' }),
   * @example DateTime.fromObject({ hour: 10, minute: 26, second: 6, zone: 'local' })
   * @example DateTime.fromObject({ hour: 10, minute: 26, second: 6, zone: 'America/New_York' })
   * @example DateTime.fromObject({ weekYear: 2016, weekNumber: 2, weekday: 3 }).toISODate() //=> '2016-01-13'
   * @return {DateTime}
   */


  static fromObject(obj) {
    const zoneToUse = normalizeZone(obj.zone, Settings.defaultZone);

    if (!zoneToUse.isValid) {
      return DateTime.invalid(unsupportedZone(zoneToUse));
    }

    const tsNow = Settings.now(),
          offsetProvis = zoneToUse.offset(tsNow),
          normalized = normalizeObject(obj, normalizeUnit, ["zone", "locale", "outputCalendar", "numberingSystem"]),
          containsOrdinal = !isUndefined(normalized.ordinal),
          containsGregorYear = !isUndefined(normalized.year),
          containsGregorMD = !isUndefined(normalized.month) || !isUndefined(normalized.day),
          containsGregor = containsGregorYear || containsGregorMD,
          definiteWeekDef = normalized.weekYear || normalized.weekNumber,
          loc = Locale.fromObject(obj); // cases:
    // just a weekday -> this week's instance of that weekday, no worries
    // (gregorian data or ordinal) + (weekYear or weekNumber) -> error
    // (gregorian month or day) + ordinal -> error
    // otherwise just use weeks or ordinals or gregorian, depending on what's specified

    if ((containsGregor || containsOrdinal) && definiteWeekDef) {
      throw new ConflictingSpecificationError("Can't mix weekYear/weekNumber units with year/month/day or ordinals");
    }

    if (containsGregorMD && containsOrdinal) {
      throw new ConflictingSpecificationError("Can't mix ordinal dates with month/day");
    }

    const useWeekData = definiteWeekDef || normalized.weekday && !containsGregor; // configure ourselves to deal with gregorian dates or week stuff

    let units,
        defaultValues,
        objNow = tsToObj(tsNow, offsetProvis);

    if (useWeekData) {
      units = orderedWeekUnits;
      defaultValues = defaultWeekUnitValues;
      objNow = gregorianToWeek(objNow);
    } else if (containsOrdinal) {
      units = orderedOrdinalUnits;
      defaultValues = defaultOrdinalUnitValues;
      objNow = gregorianToOrdinal(objNow);
    } else {
      units = datetime_orderedUnits;
      defaultValues = defaultUnitValues;
    } // set default values for missing stuff


    let foundFirst = false;

    var _iterator3 = datetime_createForOfIteratorHelper(units),
        _step3;

    try {
      for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
        const u = _step3.value;
        const v = normalized[u];

        if (!isUndefined(v)) {
          foundFirst = true;
        } else if (foundFirst) {
          normalized[u] = defaultValues[u];
        } else {
          normalized[u] = objNow[u];
        }
      } // make sure the values we have are in range

    } catch (err) {
      _iterator3.e(err);
    } finally {
      _iterator3.f();
    }

    const higherOrderInvalid = useWeekData ? hasInvalidWeekData(normalized) : containsOrdinal ? hasInvalidOrdinalData(normalized) : hasInvalidGregorianData(normalized),
          invalid = higherOrderInvalid || hasInvalidTimeData(normalized);

    if (invalid) {
      return DateTime.invalid(invalid);
    } // compute the actual time


    const gregorian = useWeekData ? weekToGregorian(normalized) : containsOrdinal ? ordinalToGregorian(normalized) : normalized,
          _objToTS3 = objToTS(gregorian, offsetProvis, zoneToUse),
          _objToTS4 = datetime_slicedToArray(_objToTS3, 2),
          tsFinal = _objToTS4[0],
          offsetFinal = _objToTS4[1],
          inst = new DateTime({
      ts: tsFinal,
      zone: zoneToUse,
      o: offsetFinal,
      loc
    }); // gregorian data + weekday serves only to validate


    if (normalized.weekday && containsGregor && obj.weekday !== inst.weekday) {
      return DateTime.invalid("mismatched weekday", `you can't specify both a weekday of ${normalized.weekday} and a date of ${inst.toISO()}`);
    }

    return inst;
  }
  /**
   * Create a DateTime from an ISO 8601 string
   * @param {string} text - the ISO string
   * @param {Object} opts - options to affect the creation
   * @param {string|Zone} [opts.zone='local'] - use this zone if no offset is specified in the input string itself. Will also convert the time to this zone
   * @param {boolean} [opts.setZone=false] - override the zone with a fixed-offset zone specified in the string itself, if it specifies one
   * @param {string} [opts.locale='system's locale'] - a locale to set on the resulting DateTime instance
   * @param {string} [opts.outputCalendar] - the output calendar to set on the resulting DateTime instance
   * @param {string} [opts.numberingSystem] - the numbering system to set on the resulting DateTime instance
   * @example DateTime.fromISO('2016-05-25T09:08:34.123')
   * @example DateTime.fromISO('2016-05-25T09:08:34.123+06:00')
   * @example DateTime.fromISO('2016-05-25T09:08:34.123+06:00', {setZone: true})
   * @example DateTime.fromISO('2016-05-25T09:08:34.123', {zone: 'utc'})
   * @example DateTime.fromISO('2016-W05-4')
   * @return {DateTime}
   */


  static fromISO(text) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    const _parseISODate = parseISODate(text),
          _parseISODate2 = datetime_slicedToArray(_parseISODate, 2),
          vals = _parseISODate2[0],
          parsedZone = _parseISODate2[1];

    return parseDataToDateTime(vals, parsedZone, opts, "ISO 8601", text);
  }
  /**
   * Create a DateTime from an RFC 2822 string
   * @param {string} text - the RFC 2822 string
   * @param {Object} opts - options to affect the creation
   * @param {string|Zone} [opts.zone='local'] - convert the time to this zone. Since the offset is always specified in the string itself, this has no effect on the interpretation of string, merely the zone the resulting DateTime is expressed in.
   * @param {boolean} [opts.setZone=false] - override the zone with a fixed-offset zone specified in the string itself, if it specifies one
   * @param {string} [opts.locale='system's locale'] - a locale to set on the resulting DateTime instance
   * @param {string} opts.outputCalendar - the output calendar to set on the resulting DateTime instance
   * @param {string} opts.numberingSystem - the numbering system to set on the resulting DateTime instance
   * @example DateTime.fromRFC2822('25 Nov 2016 13:23:12 GMT')
   * @example DateTime.fromRFC2822('Fri, 25 Nov 2016 13:23:12 +0600')
   * @example DateTime.fromRFC2822('25 Nov 2016 13:23 Z')
   * @return {DateTime}
   */


  static fromRFC2822(text) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    const _parseRFC2822Date = parseRFC2822Date(text),
          _parseRFC2822Date2 = datetime_slicedToArray(_parseRFC2822Date, 2),
          vals = _parseRFC2822Date2[0],
          parsedZone = _parseRFC2822Date2[1];

    return parseDataToDateTime(vals, parsedZone, opts, "RFC 2822", text);
  }
  /**
   * Create a DateTime from an HTTP header date
   * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html#sec3.3.1
   * @param {string} text - the HTTP header date
   * @param {Object} opts - options to affect the creation
   * @param {string|Zone} [opts.zone='local'] - convert the time to this zone. Since HTTP dates are always in UTC, this has no effect on the interpretation of string, merely the zone the resulting DateTime is expressed in.
   * @param {boolean} [opts.setZone=false] - override the zone with the fixed-offset zone specified in the string. For HTTP dates, this is always UTC, so this option is equivalent to setting the `zone` option to 'utc', but this option is included for consistency with similar methods.
   * @param {string} [opts.locale='system's locale'] - a locale to set on the resulting DateTime instance
   * @param {string} opts.outputCalendar - the output calendar to set on the resulting DateTime instance
   * @param {string} opts.numberingSystem - the numbering system to set on the resulting DateTime instance
   * @example DateTime.fromHTTP('Sun, 06 Nov 1994 08:49:37 GMT')
   * @example DateTime.fromHTTP('Sunday, 06-Nov-94 08:49:37 GMT')
   * @example DateTime.fromHTTP('Sun Nov  6 08:49:37 1994')
   * @return {DateTime}
   */


  static fromHTTP(text) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    const _parseHTTPDate = parseHTTPDate(text),
          _parseHTTPDate2 = datetime_slicedToArray(_parseHTTPDate, 2),
          vals = _parseHTTPDate2[0],
          parsedZone = _parseHTTPDate2[1];

    return parseDataToDateTime(vals, parsedZone, opts, "HTTP", opts);
  }
  /**
   * Create a DateTime from an input string and format string.
   * Defaults to en-US if no locale has been specified, regardless of the system's locale.
   * @see https://moment.github.io/luxon/docs/manual/parsing.html#table-of-tokens
   * @param {string} text - the string to parse
   * @param {string} fmt - the format the string is expected to be in (see the link below for the formats)
   * @param {Object} opts - options to affect the creation
   * @param {string|Zone} [opts.zone='local'] - use this zone if no offset is specified in the input string itself. Will also convert the DateTime to this zone
   * @param {boolean} [opts.setZone=false] - override the zone with a zone specified in the string itself, if it specifies one
   * @param {string} [opts.locale='en-US'] - a locale string to use when parsing. Will also set the DateTime to this locale
   * @param {string} opts.numberingSystem - the numbering system to use when parsing. Will also set the resulting DateTime to this numbering system
   * @param {string} opts.outputCalendar - the output calendar to set on the resulting DateTime instance
   * @return {DateTime}
   */


  static fromFormat(text, fmt) {
    let opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    if (isUndefined(text) || isUndefined(fmt)) {
      throw new InvalidArgumentError("fromFormat requires an input string and a format");
    }

    const _opts$locale = opts.locale,
          locale = _opts$locale === void 0 ? null : _opts$locale,
          _opts$numberingSystem = opts.numberingSystem,
          numberingSystem = _opts$numberingSystem === void 0 ? null : _opts$numberingSystem,
          localeToUse = Locale.fromOpts({
      locale,
      numberingSystem,
      defaultToEN: true
    }),
          _parseFromTokens = parseFromTokens(localeToUse, text, fmt),
          _parseFromTokens2 = datetime_slicedToArray(_parseFromTokens, 3),
          vals = _parseFromTokens2[0],
          parsedZone = _parseFromTokens2[1],
          invalid = _parseFromTokens2[2];

    if (invalid) {
      return DateTime.invalid(invalid);
    } else {
      return parseDataToDateTime(vals, parsedZone, opts, `format ${fmt}`, text);
    }
  }
  /**
   * @deprecated use fromFormat instead
   */


  static fromString(text, fmt) {
    let opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    return DateTime.fromFormat(text, fmt, opts);
  }
  /**
   * Create a DateTime from a SQL date, time, or datetime
   * Defaults to en-US if no locale has been specified, regardless of the system's locale
   * @param {string} text - the string to parse
   * @param {Object} opts - options to affect the creation
   * @param {string|Zone} [opts.zone='local'] - use this zone if no offset is specified in the input string itself. Will also convert the DateTime to this zone
   * @param {boolean} [opts.setZone=false] - override the zone with a zone specified in the string itself, if it specifies one
   * @param {string} [opts.locale='en-US'] - a locale string to use when parsing. Will also set the DateTime to this locale
   * @param {string} opts.numberingSystem - the numbering system to use when parsing. Will also set the resulting DateTime to this numbering system
   * @param {string} opts.outputCalendar - the output calendar to set on the resulting DateTime instance
   * @example DateTime.fromSQL('2017-05-15')
   * @example DateTime.fromSQL('2017-05-15 09:12:34')
   * @example DateTime.fromSQL('2017-05-15 09:12:34.342')
   * @example DateTime.fromSQL('2017-05-15 09:12:34.342+06:00')
   * @example DateTime.fromSQL('2017-05-15 09:12:34.342 America/Los_Angeles')
   * @example DateTime.fromSQL('2017-05-15 09:12:34.342 America/Los_Angeles', { setZone: true })
   * @example DateTime.fromSQL('2017-05-15 09:12:34.342', { zone: 'America/Los_Angeles' })
   * @example DateTime.fromSQL('09:12:34.342')
   * @return {DateTime}
   */


  static fromSQL(text) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    const _parseSQL = parseSQL(text),
          _parseSQL2 = datetime_slicedToArray(_parseSQL, 2),
          vals = _parseSQL2[0],
          parsedZone = _parseSQL2[1];

    return parseDataToDateTime(vals, parsedZone, opts, "SQL", text);
  }
  /**
   * Create an invalid DateTime.
   * @param {string} reason - simple string of why this DateTime is invalid. Should not contain parameters or anything else data-dependent
   * @param {string} [explanation=null] - longer explanation, may include parameters and other useful debugging information
   * @return {DateTime}
   */


  static invalid(reason) {
    let explanation = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    if (!reason) {
      throw new InvalidArgumentError("need to specify a reason the DateTime is invalid");
    }

    const invalid = reason instanceof Invalid ? reason : new Invalid(reason, explanation);

    if (Settings.throwOnInvalid) {
      throw new InvalidDateTimeError(invalid);
    } else {
      return new DateTime({
        invalid
      });
    }
  }
  /**
   * Check if an object is a DateTime. Works across context boundaries
   * @param {object} o
   * @return {boolean}
   */


  static isDateTime(o) {
    return o && o.isLuxonDateTime || false;
  } // INFO

  /**
   * Get the value of unit.
   * @param {string} unit - a unit such as 'minute' or 'day'
   * @example DateTime.local(2017, 7, 4).get('month'); //=> 7
   * @example DateTime.local(2017, 7, 4).get('day'); //=> 4
   * @return {number}
   */


  get(unit) {
    return this[unit];
  }
  /**
   * Returns whether the DateTime is valid. Invalid DateTimes occur when:
   * * The DateTime was created from invalid calendar information, such as the 13th month or February 30
   * * The DateTime was created by an operation on another invalid date
   * @type {boolean}
   */


  get isValid() {
    return this.invalid === null;
  }
  /**
   * Returns an error code if this DateTime is invalid, or null if the DateTime is valid
   * @type {string}
   */


  get invalidReason() {
    return this.invalid ? this.invalid.reason : null;
  }
  /**
   * Returns an explanation of why this DateTime became invalid, or null if the DateTime is valid
   * @type {string}
   */


  get invalidExplanation() {
    return this.invalid ? this.invalid.explanation : null;
  }
  /**
   * Get the locale of a DateTime, such 'en-GB'. The locale is used when formatting the DateTime
   *
   * @type {string}
   */


  get locale() {
    return this.isValid ? this.loc.locale : null;
  }
  /**
   * Get the numbering system of a DateTime, such 'beng'. The numbering system is used when formatting the DateTime
   *
   * @type {string}
   */


  get numberingSystem() {
    return this.isValid ? this.loc.numberingSystem : null;
  }
  /**
   * Get the output calendar of a DateTime, such 'islamic'. The output calendar is used when formatting the DateTime
   *
   * @type {string}
   */


  get outputCalendar() {
    return this.isValid ? this.loc.outputCalendar : null;
  }
  /**
   * Get the time zone associated with this DateTime.
   * @type {Zone}
   */


  get zone() {
    return this._zone;
  }
  /**
   * Get the name of the time zone.
   * @type {string}
   */


  get zoneName() {
    return this.isValid ? this.zone.name : null;
  }
  /**
   * Get the year
   * @example DateTime.local(2017, 5, 25).year //=> 2017
   * @type {number}
   */


  get year() {
    return this.isValid ? this.c.year : NaN;
  }
  /**
   * Get the quarter
   * @example DateTime.local(2017, 5, 25).quarter //=> 2
   * @type {number}
   */


  get quarter() {
    return this.isValid ? Math.ceil(this.c.month / 3) : NaN;
  }
  /**
   * Get the month (1-12).
   * @example DateTime.local(2017, 5, 25).month //=> 5
   * @type {number}
   */


  get month() {
    return this.isValid ? this.c.month : NaN;
  }
  /**
   * Get the day of the month (1-30ish).
   * @example DateTime.local(2017, 5, 25).day //=> 25
   * @type {number}
   */


  get day() {
    return this.isValid ? this.c.day : NaN;
  }
  /**
   * Get the hour of the day (0-23).
   * @example DateTime.local(2017, 5, 25, 9).hour //=> 9
   * @type {number}
   */


  get hour() {
    return this.isValid ? this.c.hour : NaN;
  }
  /**
   * Get the minute of the hour (0-59).
   * @example DateTime.local(2017, 5, 25, 9, 30).minute //=> 30
   * @type {number}
   */


  get minute() {
    return this.isValid ? this.c.minute : NaN;
  }
  /**
   * Get the second of the minute (0-59).
   * @example DateTime.local(2017, 5, 25, 9, 30, 52).second //=> 52
   * @type {number}
   */


  get second() {
    return this.isValid ? this.c.second : NaN;
  }
  /**
   * Get the millisecond of the second (0-999).
   * @example DateTime.local(2017, 5, 25, 9, 30, 52, 654).millisecond //=> 654
   * @type {number}
   */


  get millisecond() {
    return this.isValid ? this.c.millisecond : NaN;
  }
  /**
   * Get the week year
   * @see https://en.wikipedia.org/wiki/ISO_week_date
   * @example DateTime.local(2014, 12, 31).weekYear //=> 2015
   * @type {number}
   */


  get weekYear() {
    return this.isValid ? possiblyCachedWeekData(this).weekYear : NaN;
  }
  /**
   * Get the week number of the week year (1-52ish).
   * @see https://en.wikipedia.org/wiki/ISO_week_date
   * @example DateTime.local(2017, 5, 25).weekNumber //=> 21
   * @type {number}
   */


  get weekNumber() {
    return this.isValid ? possiblyCachedWeekData(this).weekNumber : NaN;
  }
  /**
   * Get the day of the week.
   * 1 is Monday and 7 is Sunday
   * @see https://en.wikipedia.org/wiki/ISO_week_date
   * @example DateTime.local(2014, 11, 31).weekday //=> 4
   * @type {number}
   */


  get weekday() {
    return this.isValid ? possiblyCachedWeekData(this).weekday : NaN;
  }
  /**
   * Get the ordinal (meaning the day of the year)
   * @example DateTime.local(2017, 5, 25).ordinal //=> 145
   * @type {number|DateTime}
   */


  get ordinal() {
    return this.isValid ? gregorianToOrdinal(this.c).ordinal : NaN;
  }
  /**
   * Get the human readable short month name, such as 'Oct'.
   * Defaults to the system's locale if no locale has been specified
   * @example DateTime.local(2017, 10, 30).monthShort //=> Oct
   * @type {string}
   */


  get monthShort() {
    return this.isValid ? Info.months("short", {
      locObj: this.loc
    })[this.month - 1] : null;
  }
  /**
   * Get the human readable long month name, such as 'October'.
   * Defaults to the system's locale if no locale has been specified
   * @example DateTime.local(2017, 10, 30).monthLong //=> October
   * @type {string}
   */


  get monthLong() {
    return this.isValid ? Info.months("long", {
      locObj: this.loc
    })[this.month - 1] : null;
  }
  /**
   * Get the human readable short weekday, such as 'Mon'.
   * Defaults to the system's locale if no locale has been specified
   * @example DateTime.local(2017, 10, 30).weekdayShort //=> Mon
   * @type {string}
   */


  get weekdayShort() {
    return this.isValid ? Info.weekdays("short", {
      locObj: this.loc
    })[this.weekday - 1] : null;
  }
  /**
   * Get the human readable long weekday, such as 'Monday'.
   * Defaults to the system's locale if no locale has been specified
   * @example DateTime.local(2017, 10, 30).weekdayLong //=> Monday
   * @type {string}
   */


  get weekdayLong() {
    return this.isValid ? Info.weekdays("long", {
      locObj: this.loc
    })[this.weekday - 1] : null;
  }
  /**
   * Get the UTC offset of this DateTime in minutes
   * @example DateTime.now().offset //=> -240
   * @example DateTime.utc().offset //=> 0
   * @type {number}
   */


  get offset() {
    return this.isValid ? +this.o : NaN;
  }
  /**
   * Get the short human name for the zone's current offset, for example "EST" or "EDT".
   * Defaults to the system's locale if no locale has been specified
   * @type {string}
   */


  get offsetNameShort() {
    if (this.isValid) {
      return this.zone.offsetName(this.ts, {
        format: "short",
        locale: this.locale
      });
    } else {
      return null;
    }
  }
  /**
   * Get the long human name for the zone's current offset, for example "Eastern Standard Time" or "Eastern Daylight Time".
   * Defaults to the system's locale if no locale has been specified
   * @type {string}
   */


  get offsetNameLong() {
    if (this.isValid) {
      return this.zone.offsetName(this.ts, {
        format: "long",
        locale: this.locale
      });
    } else {
      return null;
    }
  }
  /**
   * Get whether this zone's offset ever changes, as in a DST.
   * @type {boolean}
   */


  get isOffsetFixed() {
    return this.isValid ? this.zone.universal : null;
  }
  /**
   * Get whether the DateTime is in a DST.
   * @type {boolean}
   */


  get isInDST() {
    if (this.isOffsetFixed) {
      return false;
    } else {
      return this.offset > this.set({
        month: 1
      }).offset || this.offset > this.set({
        month: 5
      }).offset;
    }
  }
  /**
   * Returns true if this DateTime is in a leap year, false otherwise
   * @example DateTime.local(2016).isInLeapYear //=> true
   * @example DateTime.local(2013).isInLeapYear //=> false
   * @type {boolean}
   */


  get isInLeapYear() {
    return isLeapYear(this.year);
  }
  /**
   * Returns the number of days in this DateTime's month
   * @example DateTime.local(2016, 2).daysInMonth //=> 29
   * @example DateTime.local(2016, 3).daysInMonth //=> 31
   * @type {number}
   */


  get daysInMonth() {
    return daysInMonth(this.year, this.month);
  }
  /**
   * Returns the number of days in this DateTime's year
   * @example DateTime.local(2016).daysInYear //=> 366
   * @example DateTime.local(2013).daysInYear //=> 365
   * @type {number}
   */


  get daysInYear() {
    return this.isValid ? daysInYear(this.year) : NaN;
  }
  /**
   * Returns the number of weeks in this DateTime's year
   * @see https://en.wikipedia.org/wiki/ISO_week_date
   * @example DateTime.local(2004).weeksInWeekYear //=> 53
   * @example DateTime.local(2013).weeksInWeekYear //=> 52
   * @type {number}
   */


  get weeksInWeekYear() {
    return this.isValid ? weeksInWeekYear(this.weekYear) : NaN;
  }
  /**
   * Returns the resolved Intl options for this DateTime.
   * This is useful in understanding the behavior of formatting methods
   * @param {Object} opts - the same options as toLocaleString
   * @return {Object}
   */


  resolvedLocaleOpts() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    const _Formatter$create$res = Formatter.create(this.loc.clone(opts), opts).resolvedOptions(this),
          locale = _Formatter$create$res.locale,
          numberingSystem = _Formatter$create$res.numberingSystem,
          calendar = _Formatter$create$res.calendar;

    return {
      locale,
      numberingSystem,
      outputCalendar: calendar
    };
  } // TRANSFORM

  /**
   * "Set" the DateTime's zone to UTC. Returns a newly-constructed DateTime.
   *
   * Equivalent to {@link setZone}('utc')
   * @param {number} [offset=0] - optionally, an offset from UTC in minutes
   * @param {Object} [opts={}] - options to pass to `setZone()`
   * @return {DateTime}
   */


  toUTC() {
    let offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return this.setZone(FixedOffsetZone.instance(offset), opts);
  }
  /**
   * "Set" the DateTime's zone to the host's local zone. Returns a newly-constructed DateTime.
   *
   * Equivalent to `setZone('local')`
   * @return {DateTime}
   */


  toLocal() {
    return this.setZone(Settings.defaultZone);
  }
  /**
   * "Set" the DateTime's zone to specified zone. Returns a newly-constructed DateTime.
   *
   * By default, the setter keeps the underlying time the same (as in, the same timestamp), but the new instance will report different local times and consider DSTs when making computations, as with {@link plus}. You may wish to use {@link toLocal} and {@link toUTC} which provide simple convenience wrappers for commonly used zones.
   * @param {string|Zone} [zone='local'] - a zone identifier. As a string, that can be any IANA zone supported by the host environment, or a fixed-offset name of the form 'UTC+3', or the strings 'local' or 'utc'. You may also supply an instance of a {@link Zone} class.
   * @param {Object} opts - options
   * @param {boolean} [opts.keepLocalTime=false] - If true, adjust the underlying time so that the local time stays the same, but in the target zone. You should rarely need this.
   * @return {DateTime}
   */


  setZone(zone) {
    let _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref3$keepLocalTime = _ref3.keepLocalTime,
        keepLocalTime = _ref3$keepLocalTime === void 0 ? false : _ref3$keepLocalTime,
        _ref3$keepCalendarTim = _ref3.keepCalendarTime,
        keepCalendarTime = _ref3$keepCalendarTim === void 0 ? false : _ref3$keepCalendarTim;

    zone = normalizeZone(zone, Settings.defaultZone);

    if (zone.equals(this.zone)) {
      return this;
    } else if (!zone.isValid) {
      return DateTime.invalid(unsupportedZone(zone));
    } else {
      let newTS = this.ts;

      if (keepLocalTime || keepCalendarTime) {
        const offsetGuess = zone.offset(this.ts);
        const asObj = this.toObject();

        var _objToTS5 = objToTS(asObj, offsetGuess, zone);

        var _objToTS6 = datetime_slicedToArray(_objToTS5, 1);

        newTS = _objToTS6[0];
      }

      return datetime_clone(this, {
        ts: newTS,
        zone
      });
    }
  }
  /**
   * "Set" the locale, numberingSystem, or outputCalendar. Returns a newly-constructed DateTime.
   * @param {Object} properties - the properties to set
   * @example DateTime.local(2017, 5, 25).reconfigure({ locale: 'en-GB' })
   * @return {DateTime}
   */


  reconfigure() {
    let _ref4 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        locale = _ref4.locale,
        numberingSystem = _ref4.numberingSystem,
        outputCalendar = _ref4.outputCalendar;

    const loc = this.loc.clone({
      locale,
      numberingSystem,
      outputCalendar
    });
    return datetime_clone(this, {
      loc
    });
  }
  /**
   * "Set" the locale. Returns a newly-constructed DateTime.
   * Just a convenient alias for reconfigure({ locale })
   * @example DateTime.local(2017, 5, 25).setLocale('en-GB')
   * @return {DateTime}
   */


  setLocale(locale) {
    return this.reconfigure({
      locale
    });
  }
  /**
   * "Set" the values of specified units. Returns a newly-constructed DateTime.
   * You can only set units with this method; for "setting" metadata, see {@link reconfigure} and {@link setZone}.
   * @param {Object} values - a mapping of units to numbers
   * @example dt.set({ year: 2017 })
   * @example dt.set({ hour: 8, minute: 30 })
   * @example dt.set({ weekday: 5 })
   * @example dt.set({ year: 2005, ordinal: 234 })
   * @return {DateTime}
   */


  set(values) {
    if (!this.isValid) return this;
    const normalized = normalizeObject(values, normalizeUnit, []),
          settingWeekStuff = !isUndefined(normalized.weekYear) || !isUndefined(normalized.weekNumber) || !isUndefined(normalized.weekday),
          containsOrdinal = !isUndefined(normalized.ordinal),
          containsGregorYear = !isUndefined(normalized.year),
          containsGregorMD = !isUndefined(normalized.month) || !isUndefined(normalized.day),
          containsGregor = containsGregorYear || containsGregorMD,
          definiteWeekDef = normalized.weekYear || normalized.weekNumber;

    if ((containsGregor || containsOrdinal) && definiteWeekDef) {
      throw new ConflictingSpecificationError("Can't mix weekYear/weekNumber units with year/month/day or ordinals");
    }

    if (containsGregorMD && containsOrdinal) {
      throw new ConflictingSpecificationError("Can't mix ordinal dates with month/day");
    }

    let mixed;

    if (settingWeekStuff) {
      mixed = weekToGregorian(Object.assign(gregorianToWeek(this.c), normalized));
    } else if (!isUndefined(normalized.ordinal)) {
      mixed = ordinalToGregorian(Object.assign(gregorianToOrdinal(this.c), normalized));
    } else {
      mixed = Object.assign(this.toObject(), normalized); // if we didn't set the day but we ended up on an overflow date,
      // use the last day of the right month

      if (isUndefined(normalized.day)) {
        mixed.day = Math.min(daysInMonth(mixed.year, mixed.month), mixed.day);
      }
    }

    const _objToTS7 = objToTS(mixed, this.o, this.zone),
          _objToTS8 = datetime_slicedToArray(_objToTS7, 2),
          ts = _objToTS8[0],
          o = _objToTS8[1];

    return datetime_clone(this, {
      ts,
      o
    });
  }
  /**
   * Add a period of time to this DateTime and return the resulting DateTime
   *
   * Adding hours, minutes, seconds, or milliseconds increases the timestamp by the right number of milliseconds. Adding days, months, or years shifts the calendar, accounting for DSTs and leap years along the way. Thus, `dt.plus({ hours: 24 })` may result in a different time than `dt.plus({ days: 1 })` if there's a DST shift in between.
   * @param {Duration|Object|number} duration - The amount to add. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
   * @example DateTime.now().plus(123) //~> in 123 milliseconds
   * @example DateTime.now().plus({ minutes: 15 }) //~> in 15 minutes
   * @example DateTime.now().plus({ days: 1 }) //~> this time tomorrow
   * @example DateTime.now().plus({ days: -1 }) //~> this time yesterday
   * @example DateTime.now().plus({ hours: 3, minutes: 13 }) //~> in 3 hr, 13 min
   * @example DateTime.now().plus(Duration.fromObject({ hours: 3, minutes: 13 })) //~> in 3 hr, 13 min
   * @return {DateTime}
   */


  plus(duration) {
    if (!this.isValid) return this;
    const dur = friendlyDuration(duration);
    return datetime_clone(this, adjustTime(this, dur));
  }
  /**
   * Subtract a period of time to this DateTime and return the resulting DateTime
   * See {@link plus}
   * @param {Duration|Object|number} duration - The amount to subtract. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
   @return {DateTime}
  */


  minus(duration) {
    if (!this.isValid) return this;
    const dur = friendlyDuration(duration).negate();
    return datetime_clone(this, adjustTime(this, dur));
  }
  /**
   * "Set" this DateTime to the beginning of a unit of time.
   * @param {string} unit - The unit to go to the beginning of. Can be 'year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', or 'millisecond'.
   * @example DateTime.local(2014, 3, 3).startOf('month').toISODate(); //=> '2014-03-01'
   * @example DateTime.local(2014, 3, 3).startOf('year').toISODate(); //=> '2014-01-01'
   * @example DateTime.local(2014, 3, 3).startOf('week').toISODate(); //=> '2014-03-03', weeks always start on Mondays
   * @example DateTime.local(2014, 3, 3, 5, 30).startOf('day').toISOTime(); //=> '00:00.000-05:00'
   * @example DateTime.local(2014, 3, 3, 5, 30).startOf('hour').toISOTime(); //=> '05:00:00.000-05:00'
   * @return {DateTime}
   */


  startOf(unit) {
    if (!this.isValid) return this;
    const o = {},
          normalizedUnit = Duration.normalizeUnit(unit);

    switch (normalizedUnit) {
      case "years":
        o.month = 1;
      // falls through

      case "quarters":
      case "months":
        o.day = 1;
      // falls through

      case "weeks":
      case "days":
        o.hour = 0;
      // falls through

      case "hours":
        o.minute = 0;
      // falls through

      case "minutes":
        o.second = 0;
      // falls through

      case "seconds":
        o.millisecond = 0;
        break;

      case "milliseconds":
        break;
      // no default, invalid units throw in normalizeUnit()
    }

    if (normalizedUnit === "weeks") {
      o.weekday = 1;
    }

    if (normalizedUnit === "quarters") {
      const q = Math.ceil(this.month / 3);
      o.month = (q - 1) * 3 + 1;
    }

    return this.set(o);
  }
  /**
   * "Set" this DateTime to the end (meaning the last millisecond) of a unit of time
   * @param {string} unit - The unit to go to the end of. Can be 'year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', or 'millisecond'.
   * @example DateTime.local(2014, 3, 3).endOf('month').toISO(); //=> '2014-03-31T23:59:59.999-05:00'
   * @example DateTime.local(2014, 3, 3).endOf('year').toISO(); //=> '2014-12-31T23:59:59.999-05:00'
   * @example DateTime.local(2014, 3, 3).endOf('week').toISO(); // => '2014-03-09T23:59:59.999-05:00', weeks start on Mondays
   * @example DateTime.local(2014, 3, 3, 5, 30).endOf('day').toISO(); //=> '2014-03-03T23:59:59.999-05:00'
   * @example DateTime.local(2014, 3, 3, 5, 30).endOf('hour').toISO(); //=> '2014-03-03T05:59:59.999-05:00'
   * @return {DateTime}
   */


  endOf(unit) {
    return this.isValid ? this.plus({
      [unit]: 1
    }).startOf(unit).minus(1) : this;
  } // OUTPUT

  /**
   * Returns a string representation of this DateTime formatted according to the specified format string.
   * **You may not want this.** See {@link toLocaleString} for a more flexible formatting tool. For a table of tokens and their interpretations, see [here](https://moment.github.io/luxon/docs/manual/formatting.html#table-of-tokens).
   * Defaults to en-US if no locale has been specified, regardless of the system's locale.
   * @see https://moment.github.io/luxon/docs/manual/formatting.html#table-of-tokens
   * @param {string} fmt - the format string
   * @param {Object} opts - opts to override the configuration options
   * @example DateTime.now().toFormat('yyyy LLL dd') //=> '2017 Apr 22'
   * @example DateTime.now().setLocale('fr').toFormat('yyyy LLL dd') //=> '2017 avr. 22'
   * @example DateTime.now().toFormat('yyyy LLL dd', { locale: "fr" }) //=> '2017 avr. 22'
   * @example DateTime.now().toFormat("HH 'hours and' mm 'minutes'") //=> '20 hours and 55 minutes'
   * @return {string}
   */


  toFormat(fmt) {
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return this.isValid ? Formatter.create(this.loc.redefaultToEN(opts)).formatDateTimeFromString(this, fmt) : datetime_INVALID;
  }
  /**
   * Returns a localized string representing this date. Accepts the same options as the Intl.DateTimeFormat constructor and any presets defined by Luxon, such as `DateTime.DATE_FULL` or `DateTime.TIME_SIMPLE`.
   * The exact behavior of this method is browser-specific, but in general it will return an appropriate representation
   * of the DateTime in the assigned locale.
   * Defaults to the system's locale if no locale has been specified
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
   * @param opts {Object} - Intl.DateTimeFormat constructor options and configuration options
   * @example DateTime.now().toLocaleString(); //=> 4/20/2017
   * @example DateTime.now().setLocale('en-gb').toLocaleString(); //=> '20/04/2017'
   * @example DateTime.now().toLocaleString({ locale: 'en-gb' }); //=> '20/04/2017'
   * @example DateTime.now().toLocaleString(DateTime.DATE_FULL); //=> 'April 20, 2017'
   * @example DateTime.now().toLocaleString(DateTime.TIME_SIMPLE); //=> '11:32 AM'
   * @example DateTime.now().toLocaleString(DateTime.DATETIME_SHORT); //=> '4/20/2017, 11:32 AM'
   * @example DateTime.now().toLocaleString({ weekday: 'long', month: 'long', day: '2-digit' }); //=> 'Thursday, April 20'
   * @example DateTime.now().toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }); //=> 'Thu, Apr 20, 11:27 AM'
   * @example DateTime.now().toLocaleString({ hour: '2-digit', minute: '2-digit', hour12: false }); //=> '11:32'
   * @return {string}
   */


  toLocaleString() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DATE_SHORT;
    return this.isValid ? Formatter.create(this.loc.clone(opts), opts).formatDateTime(this) : datetime_INVALID;
  }
  /**
   * Returns an array of format "parts", meaning individual tokens along with metadata. This is allows callers to post-process individual sections of the formatted output.
   * Defaults to the system's locale if no locale has been specified
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/formatToParts
   * @param opts {Object} - Intl.DateTimeFormat constructor options, same as `toLocaleString`.
   * @example DateTime.now().toLocaleParts(); //=> [
   *                                   //=>   { type: 'day', value: '25' },
   *                                   //=>   { type: 'literal', value: '/' },
   *                                   //=>   { type: 'month', value: '05' },
   *                                   //=>   { type: 'literal', value: '/' },
   *                                   //=>   { type: 'year', value: '1982' }
   *                                   //=> ]
   */


  toLocaleParts() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return this.isValid ? Formatter.create(this.loc.clone(opts), opts).formatDateTimeParts(this) : [];
  }
  /**
   * Returns an ISO 8601-compliant string representation of this DateTime
   * @param {Object} opts - options
   * @param {boolean} [opts.suppressMilliseconds=false] - exclude milliseconds from the format if they're 0
   * @param {boolean} [opts.suppressSeconds=false] - exclude seconds from the format if they're 0
   * @param {boolean} [opts.includeOffset=true] - include the offset, such as 'Z' or '-04:00'
   * @param {string} [opts.format='extended'] - choose between the basic and extended format
   * @example DateTime.utc(1982, 5, 25).toISO() //=> '1982-05-25T00:00:00.000Z'
   * @example DateTime.now().toISO() //=> '2017-04-22T20:47:05.335-04:00'
   * @example DateTime.now().toISO({ includeOffset: false }) //=> '2017-04-22T20:47:05.335'
   * @example DateTime.now().toISO({ format: 'basic' }) //=> '20170422T204705.335-0400'
   * @return {string}
   */


  toISO() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    if (!this.isValid) {
      return null;
    }

    return `${this.toISODate(opts)}T${this.toISOTime(opts)}`;
  }
  /**
   * Returns an ISO 8601-compliant string representation of this DateTime's date component
   * @param {Object} opts - options
   * @param {string} [opts.format='extended'] - choose between the basic and extended format
   * @example DateTime.utc(1982, 5, 25).toISODate() //=> '1982-05-25'
   * @example DateTime.utc(1982, 5, 25).toISODate({ format: 'basic' }) //=> '19820525'
   * @return {string}
   */


  toISODate() {
    let _ref5 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref5$format = _ref5.format,
        format = _ref5$format === void 0 ? "extended" : _ref5$format;

    let fmt = format === "basic" ? "yyyyMMdd" : "yyyy-MM-dd";

    if (this.year > 9999) {
      fmt = "+" + fmt;
    }

    return toTechFormat(this, fmt);
  }
  /**
   * Returns an ISO 8601-compliant string representation of this DateTime's week date
   * @example DateTime.utc(1982, 5, 25).toISOWeekDate() //=> '1982-W21-2'
   * @return {string}
   */


  toISOWeekDate() {
    return toTechFormat(this, "kkkk-'W'WW-c");
  }
  /**
   * Returns an ISO 8601-compliant string representation of this DateTime's time component
   * @param {Object} opts - options
   * @param {boolean} [opts.suppressMilliseconds=false] - exclude milliseconds from the format if they're 0
   * @param {boolean} [opts.suppressSeconds=false] - exclude seconds from the format if they're 0
   * @param {boolean} [opts.includeOffset=true] - include the offset, such as 'Z' or '-04:00'
   * @param {boolean} [opts.includePrefix=false] - include the `T` prefix
   * @param {string} [opts.format='extended'] - choose between the basic and extended format
   * @example DateTime.utc().set({ hour: 7, minute: 34 }).toISOTime() //=> '07:34:19.361Z'
   * @example DateTime.utc().set({ hour: 7, minute: 34, seconds: 0, milliseconds: 0 }).toISOTime({ suppressSeconds: true }) //=> '07:34Z'
   * @example DateTime.utc().set({ hour: 7, minute: 34 }).toISOTime({ format: 'basic' }) //=> '073419.361Z'
   * @example DateTime.utc().set({ hour: 7, minute: 34 }).toISOTime({ includePrefix: true }) //=> 'T07:34:19.361Z'
   * @return {string}
   */


  toISOTime() {
    let _ref6 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref6$suppressMillise = _ref6.suppressMilliseconds,
        suppressMilliseconds = _ref6$suppressMillise === void 0 ? false : _ref6$suppressMillise,
        _ref6$suppressSeconds = _ref6.suppressSeconds,
        suppressSeconds = _ref6$suppressSeconds === void 0 ? false : _ref6$suppressSeconds,
        _ref6$includeOffset = _ref6.includeOffset,
        includeOffset = _ref6$includeOffset === void 0 ? true : _ref6$includeOffset,
        _ref6$includePrefix = _ref6.includePrefix,
        includePrefix = _ref6$includePrefix === void 0 ? false : _ref6$includePrefix,
        _ref6$format = _ref6.format,
        format = _ref6$format === void 0 ? "extended" : _ref6$format;

    return toTechTimeFormat(this, {
      suppressSeconds,
      suppressMilliseconds,
      includeOffset,
      includePrefix,
      format
    });
  }
  /**
   * Returns an RFC 2822-compatible string representation of this DateTime, always in UTC
   * @example DateTime.utc(2014, 7, 13).toRFC2822() //=> 'Sun, 13 Jul 2014 00:00:00 +0000'
   * @example DateTime.local(2014, 7, 13).toRFC2822() //=> 'Sun, 13 Jul 2014 00:00:00 -0400'
   * @return {string}
   */


  toRFC2822() {
    return toTechFormat(this, "EEE, dd LLL yyyy HH:mm:ss ZZZ", false);
  }
  /**
   * Returns a string representation of this DateTime appropriate for use in HTTP headers.
   * Specifically, the string conforms to RFC 1123.
   * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html#sec3.3.1
   * @example DateTime.utc(2014, 7, 13).toHTTP() //=> 'Sun, 13 Jul 2014 00:00:00 GMT'
   * @example DateTime.utc(2014, 7, 13, 19).toHTTP() //=> 'Sun, 13 Jul 2014 19:00:00 GMT'
   * @return {string}
   */


  toHTTP() {
    return toTechFormat(this.toUTC(), "EEE, dd LLL yyyy HH:mm:ss 'GMT'");
  }
  /**
   * Returns a string representation of this DateTime appropriate for use in SQL Date
   * @example DateTime.utc(2014, 7, 13).toSQLDate() //=> '2014-07-13'
   * @return {string}
   */


  toSQLDate() {
    return toTechFormat(this, "yyyy-MM-dd");
  }
  /**
   * Returns a string representation of this DateTime appropriate for use in SQL Time
   * @param {Object} opts - options
   * @param {boolean} [opts.includeZone=false] - include the zone, such as 'America/New_York'. Overrides includeOffset.
   * @param {boolean} [opts.includeOffset=true] - include the offset, such as 'Z' or '-04:00'
   * @example DateTime.utc().toSQL() //=> '05:15:16.345'
   * @example DateTime.now().toSQL() //=> '05:15:16.345 -04:00'
   * @example DateTime.now().toSQL({ includeOffset: false }) //=> '05:15:16.345'
   * @example DateTime.now().toSQL({ includeZone: false }) //=> '05:15:16.345 America/New_York'
   * @return {string}
   */


  toSQLTime() {
    let _ref7 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref7$includeOffset = _ref7.includeOffset,
        includeOffset = _ref7$includeOffset === void 0 ? true : _ref7$includeOffset,
        _ref7$includeZone = _ref7.includeZone,
        includeZone = _ref7$includeZone === void 0 ? false : _ref7$includeZone;

    return toTechTimeFormat(this, {
      includeOffset,
      includeZone,
      spaceZone: true
    });
  }
  /**
   * Returns a string representation of this DateTime appropriate for use in SQL DateTime
   * @param {Object} opts - options
   * @param {boolean} [opts.includeZone=false] - include the zone, such as 'America/New_York'. Overrides includeOffset.
   * @param {boolean} [opts.includeOffset=true] - include the offset, such as 'Z' or '-04:00'
   * @example DateTime.utc(2014, 7, 13).toSQL() //=> '2014-07-13 00:00:00.000 Z'
   * @example DateTime.local(2014, 7, 13).toSQL() //=> '2014-07-13 00:00:00.000 -04:00'
   * @example DateTime.local(2014, 7, 13).toSQL({ includeOffset: false }) //=> '2014-07-13 00:00:00.000'
   * @example DateTime.local(2014, 7, 13).toSQL({ includeZone: true }) //=> '2014-07-13 00:00:00.000 America/New_York'
   * @return {string}
   */


  toSQL() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    if (!this.isValid) {
      return null;
    }

    return `${this.toSQLDate()} ${this.toSQLTime(opts)}`;
  }
  /**
   * Returns a string representation of this DateTime appropriate for debugging
   * @return {string}
   */


  toString() {
    return this.isValid ? this.toISO() : datetime_INVALID;
  }
  /**
   * Returns the epoch milliseconds of this DateTime. Alias of {@link toMillis}
   * @return {number}
   */


  valueOf() {
    return this.toMillis();
  }
  /**
   * Returns the epoch milliseconds of this DateTime.
   * @return {number}
   */


  toMillis() {
    return this.isValid ? this.ts : NaN;
  }
  /**
   * Returns the epoch seconds of this DateTime.
   * @return {number}
   */


  toSeconds() {
    return this.isValid ? this.ts / 1000 : NaN;
  }
  /**
   * Returns an ISO 8601 representation of this DateTime appropriate for use in JSON.
   * @return {string}
   */


  toJSON() {
    return this.toISO();
  }
  /**
   * Returns a BSON serializable equivalent to this DateTime.
   * @return {Date}
   */


  toBSON() {
    return this.toJSDate();
  }
  /**
   * Returns a JavaScript object with this DateTime's year, month, day, and so on.
   * @param opts - options for generating the object
   * @param {boolean} [opts.includeConfig=false] - include configuration attributes in the output
   * @example DateTime.now().toObject() //=> { year: 2017, month: 4, day: 22, hour: 20, minute: 49, second: 42, millisecond: 268 }
   * @return {Object}
   */


  toObject() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    if (!this.isValid) return {};
    const base = Object.assign({}, this.c);

    if (opts.includeConfig) {
      base.outputCalendar = this.outputCalendar;
      base.numberingSystem = this.loc.numberingSystem;
      base.locale = this.loc.locale;
    }

    return base;
  }
  /**
   * Returns a JavaScript Date equivalent to this DateTime.
   * @return {Date}
   */


  toJSDate() {
    return new Date(this.isValid ? this.ts : NaN);
  } // COMPARE

  /**
   * Return the difference between two DateTimes as a Duration.
   * @param {DateTime} otherDateTime - the DateTime to compare this one to
   * @param {string|string[]} [unit=['milliseconds']] - the unit or array of units (such as 'hours' or 'days') to include in the duration.
   * @param {Object} opts - options that affect the creation of the Duration
   * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
   * @example
   * var i1 = DateTime.fromISO('1982-05-25T09:45'),
   *     i2 = DateTime.fromISO('1983-10-14T10:30');
   * i2.diff(i1).toObject() //=> { milliseconds: 43807500000 }
   * i2.diff(i1, 'hours').toObject() //=> { hours: 12168.75 }
   * i2.diff(i1, ['months', 'days']).toObject() //=> { months: 16, days: 19.03125 }
   * i2.diff(i1, ['months', 'days', 'hours']).toObject() //=> { months: 16, days: 19, hours: 0.75 }
   * @return {Duration}
   */


  diff(otherDateTime) {
    let unit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "milliseconds";
    let opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    if (!this.isValid || !otherDateTime.isValid) {
      return Duration.invalid(this.invalid || otherDateTime.invalid, "created by diffing an invalid DateTime");
    }

    const durOpts = Object.assign({
      locale: this.locale,
      numberingSystem: this.numberingSystem
    }, opts);
    const units = maybeArray(unit).map(Duration.normalizeUnit),
          otherIsLater = otherDateTime.valueOf() > this.valueOf(),
          earlier = otherIsLater ? this : otherDateTime,
          later = otherIsLater ? otherDateTime : this,
          diffed = diff(earlier, later, units, durOpts);
    return otherIsLater ? diffed.negate() : diffed;
  }
  /**
   * Return the difference between this DateTime and right now.
   * See {@link diff}
   * @param {string|string[]} [unit=['milliseconds']] - the unit or units units (such as 'hours' or 'days') to include in the duration
   * @param {Object} opts - options that affect the creation of the Duration
   * @param {string} [opts.conversionAccuracy='casual'] - the conversion system to use
   * @return {Duration}
   */


  diffNow() {
    let unit = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "milliseconds";
    let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return this.diff(DateTime.now(), unit, opts);
  }
  /**
   * Return an Interval spanning between this DateTime and another DateTime
   * @param {DateTime} otherDateTime - the other end point of the Interval
   * @return {Interval}
   */


  until(otherDateTime) {
    return this.isValid ? Interval.fromDateTimes(this, otherDateTime) : this;
  }
  /**
   * Return whether this DateTime is in the same unit of time as another DateTime.
   * Higher-order units must also be identical for this function to return `true`.
   * Note that time zones are **ignored** in this comparison, which compares the **local** calendar time. Use {@link setZone} to convert one of the dates if needed.
   * @param {DateTime} otherDateTime - the other DateTime
   * @param {string} unit - the unit of time to check sameness on
   * @example DateTime.now().hasSame(otherDT, 'day'); //~> true if otherDT is in the same current calendar day
   * @return {boolean}
   */


  hasSame(otherDateTime, unit) {
    if (!this.isValid) return false;
    const inputMs = otherDateTime.valueOf();
    const otherZoneDateTime = this.setZone(otherDateTime.zone, {
      keepLocalTime: true
    });
    return otherZoneDateTime.startOf(unit) <= inputMs && inputMs <= otherZoneDateTime.endOf(unit);
  }
  /**
   * Equality check
   * Two DateTimes are equal iff they represent the same millisecond, have the same zone and location, and are both valid.
   * To compare just the millisecond values, use `+dt1 === +dt2`.
   * @param {DateTime} other - the other DateTime
   * @return {boolean}
   */


  equals(other) {
    return this.isValid && other.isValid && this.valueOf() === other.valueOf() && this.zone.equals(other.zone) && this.loc.equals(other.loc);
  }
  /**
   * Returns a string representation of a this time relative to now, such as "in two days". Can only internationalize if your
   * platform supports Intl.RelativeTimeFormat. Rounds down by default.
   * @param {Object} options - options that affect the output
   * @param {DateTime} [options.base=DateTime.now()] - the DateTime to use as the basis to which this time is compared. Defaults to now.
   * @param {string} [options.style="long"] - the style of units, must be "long", "short", or "narrow"
   * @param {string|string[]} options.unit - use a specific unit or array of units; if omitted, or an array, the method will pick the best unit. Use an array or one of "years", "quarters", "months", "weeks", "days", "hours", "minutes", or "seconds"
   * @param {boolean} [options.round=true] - whether to round the numbers in the output.
   * @param {number} [options.padding=0] - padding in milliseconds. This allows you to round up the result if it fits inside the threshold. Don't use in combination with {round: false} because the decimal output will include the padding.
   * @param {string} options.locale - override the locale of this DateTime
   * @param {string} options.numberingSystem - override the numberingSystem of this DateTime. The Intl system may choose not to honor this
   * @example DateTime.now().plus({ days: 1 }).toRelative() //=> "in 1 day"
   * @example DateTime.now().setLocale("es").toRelative({ days: 1 }) //=> "dentro de 1 día"
   * @example DateTime.now().plus({ days: 1 }).toRelative({ locale: "fr" }) //=> "dans 23 heures"
   * @example DateTime.now().minus({ days: 2 }).toRelative() //=> "2 days ago"
   * @example DateTime.now().minus({ days: 2 }).toRelative({ unit: "hours" }) //=> "48 hours ago"
   * @example DateTime.now().minus({ hours: 36 }).toRelative({ round: false }) //=> "1.5 days ago"
   */


  toRelative() {
    let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    if (!this.isValid) return null;
    const base = options.base || DateTime.fromObject({
      zone: this.zone
    }),
          padding = options.padding ? this < base ? -options.padding : options.padding : 0;
    let units = ["years", "months", "days", "hours", "minutes", "seconds"];
    let unit = options.unit;

    if (Array.isArray(options.unit)) {
      units = options.unit;
      unit = undefined;
    }

    return diffRelative(base, this.plus(padding), Object.assign(options, {
      numeric: "always",
      units,
      unit
    }));
  }
  /**
   * Returns a string representation of this date relative to today, such as "yesterday" or "next month".
   * Only internationalizes on platforms that supports Intl.RelativeTimeFormat.
   * @param {Object} options - options that affect the output
   * @param {DateTime} [options.base=DateTime.now()] - the DateTime to use as the basis to which this time is compared. Defaults to now.
   * @param {string} options.locale - override the locale of this DateTime
   * @param {string} options.unit - use a specific unit; if omitted, the method will pick the unit. Use one of "years", "quarters", "months", "weeks", or "days"
   * @param {string} options.numberingSystem - override the numberingSystem of this DateTime. The Intl system may choose not to honor this
   * @example DateTime.now().plus({ days: 1 }).toRelativeCalendar() //=> "tomorrow"
   * @example DateTime.now().setLocale("es").plus({ days: 1 }).toRelative() //=> ""mañana"
   * @example DateTime.now().plus({ days: 1 }).toRelativeCalendar({ locale: "fr" }) //=> "demain"
   * @example DateTime.now().minus({ days: 2 }).toRelativeCalendar() //=> "2 days ago"
   */


  toRelativeCalendar() {
    let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    if (!this.isValid) return null;
    return diffRelative(options.base || DateTime.fromObject({
      zone: this.zone
    }), this, Object.assign(options, {
      numeric: "auto",
      units: ["years", "months", "days"],
      calendary: true
    }));
  }
  /**
   * Return the min of several date times
   * @param {...DateTime} dateTimes - the DateTimes from which to choose the minimum
   * @return {DateTime} the min DateTime, or undefined if called with no argument
   */


  static min() {
    for (var _len = arguments.length, dateTimes = new Array(_len), _key = 0; _key < _len; _key++) {
      dateTimes[_key] = arguments[_key];
    }

    if (!dateTimes.every(DateTime.isDateTime)) {
      throw new InvalidArgumentError("min requires all arguments be DateTimes");
    }

    return bestBy(dateTimes, i => i.valueOf(), Math.min);
  }
  /**
   * Return the max of several date times
   * @param {...DateTime} dateTimes - the DateTimes from which to choose the maximum
   * @return {DateTime} the max DateTime, or undefined if called with no argument
   */


  static max() {
    for (var _len2 = arguments.length, dateTimes = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      dateTimes[_key2] = arguments[_key2];
    }

    if (!dateTimes.every(DateTime.isDateTime)) {
      throw new InvalidArgumentError("max requires all arguments be DateTimes");
    }

    return bestBy(dateTimes, i => i.valueOf(), Math.max);
  } // MISC

  /**
   * Explain how a string would be parsed by fromFormat()
   * @param {string} text - the string to parse
   * @param {string} fmt - the format the string is expected to be in (see description)
   * @param {Object} options - options taken by fromFormat()
   * @return {Object}
   */


  static fromFormatExplain(text, fmt) {
    let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    const _options$locale = options.locale,
          locale = _options$locale === void 0 ? null : _options$locale,
          _options$numberingSys = options.numberingSystem,
          numberingSystem = _options$numberingSys === void 0 ? null : _options$numberingSys,
          localeToUse = Locale.fromOpts({
      locale,
      numberingSystem,
      defaultToEN: true
    });
    return explainFromTokens(localeToUse, text, fmt);
  }
  /**
   * @deprecated use fromFormatExplain instead
   */


  static fromStringExplain(text, fmt) {
    let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    return DateTime.fromFormatExplain(text, fmt, options);
  } // FORMAT PRESETS

  /**
   * {@link toLocaleString} format like 10/14/1983
   * @type {Object}
   */


  static get DATE_SHORT() {
    return DATE_SHORT;
  }
  /**
   * {@link toLocaleString} format like 'Oct 14, 1983'
   * @type {Object}
   */


  static get DATE_MED() {
    return DATE_MED;
  }
  /**
   * {@link toLocaleString} format like 'Fri, Oct 14, 1983'
   * @type {Object}
   */


  static get DATE_MED_WITH_WEEKDAY() {
    return DATE_MED_WITH_WEEKDAY;
  }
  /**
   * {@link toLocaleString} format like 'October 14, 1983'
   * @type {Object}
   */


  static get DATE_FULL() {
    return DATE_FULL;
  }
  /**
   * {@link toLocaleString} format like 'Tuesday, October 14, 1983'
   * @type {Object}
   */


  static get DATE_HUGE() {
    return DATE_HUGE;
  }
  /**
   * {@link toLocaleString} format like '09:30 AM'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get TIME_SIMPLE() {
    return TIME_SIMPLE;
  }
  /**
   * {@link toLocaleString} format like '09:30:23 AM'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get TIME_WITH_SECONDS() {
    return TIME_WITH_SECONDS;
  }
  /**
   * {@link toLocaleString} format like '09:30:23 AM EDT'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get TIME_WITH_SHORT_OFFSET() {
    return TIME_WITH_SHORT_OFFSET;
  }
  /**
   * {@link toLocaleString} format like '09:30:23 AM Eastern Daylight Time'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get TIME_WITH_LONG_OFFSET() {
    return TIME_WITH_LONG_OFFSET;
  }
  /**
   * {@link toLocaleString} format like '09:30', always 24-hour.
   * @type {Object}
   */


  static get TIME_24_SIMPLE() {
    return TIME_24_SIMPLE;
  }
  /**
   * {@link toLocaleString} format like '09:30:23', always 24-hour.
   * @type {Object}
   */


  static get TIME_24_WITH_SECONDS() {
    return TIME_24_WITH_SECONDS;
  }
  /**
   * {@link toLocaleString} format like '09:30:23 EDT', always 24-hour.
   * @type {Object}
   */


  static get TIME_24_WITH_SHORT_OFFSET() {
    return TIME_24_WITH_SHORT_OFFSET;
  }
  /**
   * {@link toLocaleString} format like '09:30:23 Eastern Daylight Time', always 24-hour.
   * @type {Object}
   */


  static get TIME_24_WITH_LONG_OFFSET() {
    return TIME_24_WITH_LONG_OFFSET;
  }
  /**
   * {@link toLocaleString} format like '10/14/1983, 9:30 AM'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get DATETIME_SHORT() {
    return DATETIME_SHORT;
  }
  /**
   * {@link toLocaleString} format like '10/14/1983, 9:30:33 AM'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get DATETIME_SHORT_WITH_SECONDS() {
    return DATETIME_SHORT_WITH_SECONDS;
  }
  /**
   * {@link toLocaleString} format like 'Oct 14, 1983, 9:30 AM'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get DATETIME_MED() {
    return DATETIME_MED;
  }
  /**
   * {@link toLocaleString} format like 'Oct 14, 1983, 9:30:33 AM'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get DATETIME_MED_WITH_SECONDS() {
    return DATETIME_MED_WITH_SECONDS;
  }
  /**
   * {@link toLocaleString} format like 'Fri, 14 Oct 1983, 9:30 AM'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get DATETIME_MED_WITH_WEEKDAY() {
    return DATETIME_MED_WITH_WEEKDAY;
  }
  /**
   * {@link toLocaleString} format like 'October 14, 1983, 9:30 AM EDT'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get DATETIME_FULL() {
    return DATETIME_FULL;
  }
  /**
   * {@link toLocaleString} format like 'October 14, 1983, 9:30:33 AM EDT'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get DATETIME_FULL_WITH_SECONDS() {
    return DATETIME_FULL_WITH_SECONDS;
  }
  /**
   * {@link toLocaleString} format like 'Friday, October 14, 1983, 9:30 AM Eastern Daylight Time'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get DATETIME_HUGE() {
    return DATETIME_HUGE;
  }
  /**
   * {@link toLocaleString} format like 'Friday, October 14, 1983, 9:30:33 AM Eastern Daylight Time'. Only 12-hour if the locale is.
   * @type {Object}
   */


  static get DATETIME_HUGE_WITH_SECONDS() {
    return DATETIME_HUGE_WITH_SECONDS;
  }

}
/**
 * @private
 */

function friendlyDateTime(dateTimeish) {
  if (DateTime.isDateTime(dateTimeish)) {
    return dateTimeish;
  } else if (dateTimeish && dateTimeish.valueOf && isNumber(dateTimeish.valueOf())) {
    return DateTime.fromJSDate(dateTimeish);
  } else if (dateTimeish && typeof dateTimeish === "object") {
    return DateTime.fromObject(dateTimeish);
  } else {
    throw new InvalidArgumentError(`Unknown datetime argument: ${dateTimeish}, of type ${typeof dateTimeish}`);
  }
}
;// CONCATENATED MODULE: ./src/3_8/utils.ts


const { timeout_add, source_remove } = imports.mainloop;
const { IconType } = imports.gi.St;
const { IconTheme } = imports.gi.Gtk;
function _(str, args) {
    let result = imports.gettext.dgettext(UUID, str);
    if (result === str && result === "")
        result = imports.gettext.gettext(str);
    if (!!args)
        result = format(result, args);
    return result;
}
function format(str, args) {
    for (let key in args) {
        str = str.replace(new RegExp("\\{" + key + "\\}"), args[key]);
    }
    return str;
}
function UnitToUnicode(unit) {
    return unit == "fahrenheit" ? '\u2109' : '\u2103';
}
function GenerateLocationText(weather, config) {
    let location = "";
    if (weather.location.city != null && weather.location.country != null) {
        location = weather.location.city + ", " + weather.location.country;
    }
    else {
        location = Math.round(weather.coord.lat * 10000) / 10000 + ", " + Math.round(weather.coord.lon * 10000) / 10000;
    }
    if (NotEmpty(config._locationLabelOverride)) {
        location = config._locationLabelOverride;
    }
    return location;
}
function CapitalizeFirstLetter(description) {
    if ((description == undefined || description == null)) {
        return "";
    }
    return description.charAt(0).toUpperCase() + description.slice(1);
}
;
function CapitalizeEveryWord(description) {
    if ((description == undefined || description == null)) {
        return "";
    }
    let split = description.split(" ");
    let result = "";
    for (let index = 0; index < split.length; index++) {
        const element = split[index];
        result += CapitalizeFirstLetter(element);
        if (index != split.length - 1)
            result += " ";
    }
    return result;
}
function NormalizeTimezone(tz) {
    if (!tz || tz == "" || tz == "UTC")
        tz = undefined;
    return tz;
}
function GetDayName(date, locale, showDate = false, tz) {
    let params = {
        weekday: "long",
        timeZone: tz
    };
    params.timeZone = NormalizeTimezone(tz);
    if (showDate) {
        params.day = 'numeric';
    }
    let now = DateTime.utc();
    let tomorrow = DateTime.utc().plus({ days: 1 });
    if (!!tz) {
        now = now.setZone(tz);
        tomorrow = tomorrow.setZone(tz);
        date = date.setZone(tz);
    }
    if (date.hasSame(now, "day") || date.hasSame(tomorrow, "day"))
        delete params.weekday;
    if (!!locale)
        date = date.setLocale(locale);
    let dateString = date.toLocaleString(params);
    if (locale === null || locale === void 0 ? void 0 : locale.startsWith("fr"))
        dateString = CapitalizeFirstLetter(dateString);
    if (date.hasSame(now, "day"))
        dateString = _("Today");
    if (date.hasSame(tomorrow, "day"))
        dateString = _("Tomorrow");
    return dateString;
}
function GetHoursMinutes(date, locale, hours24Format, tz, onlyHours = false) {
    let params = {
        hour: "numeric",
        hour12: !hours24Format,
        timeZone: tz
    };
    params.timeZone = NormalizeTimezone(tz);
    if (!onlyHours)
        params.minute = "2-digit";
    if (!!tz)
        date = date.setZone(tz);
    if (!!locale)
        date = date.setLocale(locale);
    return date.toLocaleString(params);
}
function AwareDateString(date, locale, hours24Format, tz) {
    let now = DateTime.utc().setZone(tz);
    date = date.setZone(tz);
    let params = {
        hour: "numeric",
        minute: "2-digit",
        hour12: !hours24Format,
        timeZone: tz
    };
    if (!date.hasSame(now, "day")) {
        params.month = "short";
        params.day = "numeric";
    }
    if (!date.hasSame(now, "year")) {
        params.year = "numeric";
    }
    params.timeZone = NormalizeTimezone(tz);
    if (!!locale)
        date = date.setLocale(locale);
    return date.toLocaleString(params);
}
function MilitaryTime(date) {
    return date.hour * 100 + date.minute;
}
function OnSameDay(date1, date2) {
    return date1.hasSame(date2, "day");
}
function ValidTimezone(tz) {
    return DateTime.utc().setZone(tz).isValid;
}
function ProcessCondition(condition, shouldTranslate) {
    condition = CapitalizeFirstLetter(condition);
    if (shouldTranslate)
        condition = _(condition);
    return condition;
}
function LocalizedColon(locale) {
    if (locale == null)
        return ":";
    if (locale.startsWith("fr"))
        return " :";
    return ":";
}
function PrecentToLocale(humidity, locale) {
    return (humidity / 100).toLocaleString(locale !== null && locale !== void 0 ? locale : undefined, { style: "percent" });
}
const WEATHER_CONV_MPH_IN_MPS = 2.23693629;
const WEATHER_CONV_KPH_IN_MPS = 3.6;
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449;
function MPStoUserUnits(mps, units) {
    switch (units) {
        case "mph":
            return (Math.round((mps * WEATHER_CONV_MPH_IN_MPS) * 10) / 10).toString();
        case "kph":
            return (Math.round((mps * WEATHER_CONV_KPH_IN_MPS) * 10) / 10).toString();
        case "m/s":
            return (Math.round(mps * 10) / 10).toString();
        case "Knots":
            return Math.round(mps * WEATHER_CONV_KNOTS_IN_MPS).toString();
        case "Beaufort":
            if (mps < 0.5) {
                return "0 (" + _("Calm") + ")";
            }
            if (mps < 1.5) {
                return "1 (" + _("Light air") + ")";
            }
            if (mps < 3.3) {
                return "2 (" + _("Light breeze") + ")";
            }
            if (mps < 5.5) {
                return "3 (" + _("Gentle breeze") + ")";
            }
            if (mps < 7.9) {
                return "4 (" + _("Moderate breeze") + ")";
            }
            if (mps < 10.7) {
                return "5 (" + _("Fresh breeze") + ")";
            }
            if (mps < 13.8) {
                return "6 (" + _("Strong breeze") + ")";
            }
            if (mps < 17.1) {
                return "7 (" + _("Near gale") + ")";
            }
            if (mps < 20.7) {
                return "8 (" + _("Gale") + ")";
            }
            if (mps < 24.4) {
                return "9 (" + _("Strong gale") + ")";
            }
            if (mps < 28.4) {
                return "10 (" + _("Storm") + ")";
            }
            if (mps < 32.6) {
                return "11 (" + _("Violent storm") + ")";
            }
            return "12 (" + _("Hurricane") + ")";
        default:
            return (Math.round(mps * 10) / 10).toString();
    }
}
function TempToUserConfig(kelvin, config, withUnit = true) {
    if (kelvin == null)
        return null;
    let temp = (config.TemperatureUnit == "celsius") ? KelvinToCelsius(kelvin) : KelvinToFahrenheit(kelvin);
    temp = RussianTransform(temp, config._tempRussianStyle);
    if (withUnit)
        temp = `${temp} ${UnitToUnicode(config.TemperatureUnit)}`;
    if (config._showBothTempUnits) {
        let secondUnit = (config.TemperatureUnit == "celsius") ? "fahrenheit" : "celsius";
        let secondTemp = (config.TemperatureUnit == "celsius") ? KelvinToFahrenheit(kelvin) : KelvinToCelsius(kelvin);
        secondTemp = RussianTransform(secondTemp, config._tempRussianStyle);
        if (withUnit)
            temp += ` (${secondTemp.toString()} ${UnitToUnicode(secondUnit)})`;
        else
            temp += ` (${secondTemp.toString()})`;
    }
    return temp.toString();
}
function RussianTransform(temp, russianStyle) {
    if (russianStyle) {
        if (temp < 0)
            return `−${Math.abs(temp).toString()}`;
        else if (temp > 0)
            return `+${temp.toString()}`;
    }
    return temp.toString();
}
function TempRangeToUserConfig(min, max, config) {
    let t_low = TempToUserConfig(min, config, false);
    let t_high = TempToUserConfig(max, config, false);
    let first_temperature = config._temperatureHighFirst ? t_high : t_low;
    let second_temperature = config._temperatureHighFirst ? t_low : t_high;
    let result = "";
    if (first_temperature != null)
        result = first_temperature;
    result += ((config._tempRussianStyle) ? ELLIPSIS : ` ${FORWARD_SLASH} `);
    if (second_temperature != null)
        result += `${second_temperature} `;
    result += `${UnitToUnicode(config.TemperatureUnit)}`;
    if (config._showBothTempUnits) {
        let secondUnit = (config.TemperatureUnit == "celsius") ? "fahrenheit" : "celsius";
        result += ` (${UnitToUnicode(secondUnit)})`;
    }
    return result;
}
function KelvinToCelsius(k) {
    return Math.round((k - 273.15));
}
function KelvinToFahrenheit(k) {
    return Math.round((9 / 5 * (k - 273.15) + 32));
}
function PressToUserUnits(hpa, units) {
    switch (units) {
        case "hPa":
            return Math.round(hpa * 100) / 100;
        case "at":
            return Math.round((hpa * 0.001019716) * 1000) / 1000;
        case "atm":
            return Math.round((hpa * 0.0009869233) * 1000) / 1000;
        case "in Hg":
            return Math.round((hpa * 0.029529983071445) * 10) / 10;
        case "mm Hg":
            return Math.round((hpa * 0.7500638));
        case "Pa":
            return Math.round((hpa * 100));
        case "psi":
            return Math.round((hpa * 0.01450377) * 100) / 100;
    }
}
;
function MetreToUserUnits(m, distanceUnit) {
    if (distanceUnit == "metric")
        return Math.round(m / 1000 * 10) / 10;
    return Math.round(KmToM(m / 1000) * 10) / 10;
}
function MillimeterToUserUnits(mm, distanceUnit) {
    if (distanceUnit == "metric")
        return Math.round(mm * 100) / 100;
    return Math.round(mm * 0.03937 * 100) / 100;
}
function KPHtoMPS(speed) {
    if (speed == null)
        return 0;
    return speed / WEATHER_CONV_KPH_IN_MPS;
}
;
function CelsiusToKelvin(celsius) {
    if (celsius == null)
        return null;
    return (celsius + 273.15);
}
function FahrenheitToKelvin(fahrenheit) {
    if (fahrenheit == null)
        return null;
    return ((fahrenheit - 32) / 1.8 + 273.15);
}
;
function MPHtoMPS(speed) {
    if (speed == null || speed == undefined)
        return null;
    return speed * 0.44704;
}
function KmToM(km) {
    return km * 0.6213712;
}
function CompassToDeg(compass) {
    if (!compass)
        return null;
    compass = compass.toUpperCase();
    switch (compass) {
        case "N": return 0;
        case "NNE": return 22.5;
        case "NE": return 45;
        case "ENE": return 67.5;
        case "E": return 90;
        case "ESE": return 112.5;
        case "SE": return 135;
        case "SSE": return 157.5;
        case "S": return 180;
        case "SSW": return 202.5;
        case "SW": return 225;
        case "WSW": return 247.5;
        case "W": return 270;
        case "WNW": return 292.5;
        case "NW": return 315;
        case "NNW": return 337.5;
        default: return null;
    }
}
function CompassDirection(deg) {
    let directions = [
        'south-arrow-weather-symbolic',
        'south-west-arrow-weather-symbolic',
        'west-arrow-weather-symbolic',
        'north-west-arrow-weather-symbolic',
        'north-arrow-weather-symbolic',
        'north-east-arrow-weather-symbolic',
        'east-arrow-weather-symbolic',
        'south-east-arrow-weather-symbolic'
    ];
    return directions[Math.round(deg / 45) % directions.length];
}
function CompassDirectionText(deg) {
    if (!deg)
        return null;
    let directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')];
    return directions[Math.round(deg / 45) % directions.length];
}
function IsNight(sunTimes, date) {
    if (!sunTimes)
        return false;
    let time = (!!date) ? MilitaryTime(date) : MilitaryTime(DateTime.utc().setZone(sunTimes.sunset.zoneName));
    let sunrise = MilitaryTime(sunTimes.sunrise);
    let sunset = MilitaryTime(sunTimes.sunset);
    if (time >= sunrise && time < sunset)
        return false;
    return true;
}
function IsCoordinate(text) {
    text = text.trim();
    if (/^-?\d{1,3}(?:\.\d*)?,(\s)*-?\d{1,3}(?:\.\d*)?/.test(text)) {
        return true;
    }
    return false;
}
function NotEmpty(str) {
    return (str != null && str.length > 0 && str != undefined);
}
function IsLangSupported(lang, languages) {
    if (lang == null)
        return false;
    return (languages.includes(lang));
}
;
function HasIcon(icon, icon_type) {
    return IconTheme.get_default().has_icon(icon + (icon_type == IconType.SYMBOLIC ? '-symbolic' : ''));
}
function mode(arr) {
    return arr.reduce(function (current, item) {
        var val = current.numMapping[item] = (current.numMapping[item] || 0) + 1;
        if (val > current.greatestFreq) {
            current.greatestFreq = val;
            current.mode = item;
        }
        return current;
    }, { mode: null, greatestFreq: -Infinity, numMapping: {} }).mode;
}
;
function WeatherIconSafely(code, icon_type) {
    for (let i = 0; i < code.length; i++) {
        if (HasIcon(code[i], icon_type))
            return code[i];
    }
    return 'weather-severe-alert';
}
function ShadeHexColor(color, percent) {
    var f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}
function ConstructJsLocale(locale) {
    let jsLocale = locale.split(".")[0];
    let tmp = jsLocale.split("_");
    jsLocale = "";
    for (let i = 0; i < tmp.length; i++) {
        if (i != 0)
            jsLocale += "-";
        jsLocale += tmp[i].toLowerCase();
    }
    if (locale == "c" || locale == null)
        jsLocale = null;
    return jsLocale;
}
function GetDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function GetFuncName(func) {
    if (!!func.name)
        return func.name;
    var result = /^function\s+([\w\$]+)\s*\(/.exec(func.toString());
    return result ? result[1] : '';
}
function Guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function utils_setTimeout(func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = timeout_add(ms, () => {
        func.apply(null, args);
        return false;
    });
    return id;
}
;
async function delay(ms) {
    return await new Promise((resolve, reject) => {
        utils_setTimeout(() => {
            resolve();
        }, ms);
    });
}
function utils_clearTimeout(id) {
    source_remove(id);
}
;
function utils_setInterval(func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = timeout_add(ms, () => {
        func.apply(null, args);
        return true;
    });
    return id;
}
;

;// CONCATENATED MODULE: ./src/3_8/location_services/ipApi.ts


class IpApi {
    constructor(_app) {
        this.query = "http://ip-api.com/json/?fields=status,message,country,countryCode,city,lat,lon,timezone,mobile,query";
        this.app = _app;
    }
    async GetLocation() {
        let json = await this.app.LoadJsonAsync(this.query);
        if (!json) {
            return null;
        }
        if (json.status != "success") {
            this.HandleErrorResponse(json);
            return null;
        }
        return this.ParseInformation(json);
    }
    ;
    ParseInformation(json) {
        try {
            let result = {
                lat: json.lat,
                lon: json.lon,
                city: json.city,
                country: json.country,
                timeZone: json.timezone,
                entryText: json.lat + "," + json.lon,
            };
            logger_Logger.Debug("Location obtained:" + json.lat + "," + json.lon);
            return result;
        }
        catch (e) {
            logger_Logger.Error("ip-api parsing error: " + e);
            this.app.ShowError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
            return null;
        }
    }
    ;
    HandleErrorResponse(json) {
        this.app.ShowError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" });
        logger_Logger.Error("ip-api responds with Error: " + json.reason);
    }
    ;
}
;

;// CONCATENATED MODULE: ./src/3_8/lib/events.ts
class Event {
    constructor() {
        this.subscribers = [];
    }
    Subscribe(fn) {
        this.subscribers.push(fn);
    }
    Unsubscribe(fn) {
        for (let index = this.subscribers.length - 1; index >= 0; index--) {
            const element = this.subscribers[index];
            if (element == fn) {
                this.subscribers.splice(index, 1);
                return;
            }
        }
    }
    Invoke(sender, args) {
        if (this.subscribers.length == 0)
            return;
        for (let index = 0; index < this.subscribers.length; index++) {
            const element = this.subscribers[index];
            element(sender, args);
        }
    }
    UnSubscribeAll() {
        this.subscribers = [];
    }
}

;// CONCATENATED MODULE: ./src/3_8/lib/notification_service.ts

const { messageTray } = imports.ui.main;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
class NotificationService {
    constructor() {
        this.Title = _("Weather Applet");
        this.MessageSource = new SystemNotificationSource(this.Title);
        messageTray.add(this.MessageSource);
    }
    static get Instance() {
        if (this.instance == null)
            this.instance = new NotificationService();
        return this.instance;
    }
    Send(title, message, transient) {
        let notification = new Notification(this.MessageSource, this.Title + ": " + title, message);
        if (transient)
            notification.setTransient((!transient) ? false : true);
        this.MessageSource.notify(notification);
    }
}

;// CONCATENATED MODULE: ./src/3_8/location_services/locationstore.ts





class LocationStore {
    constructor(app, config) {
        this.locations = [];
        this.currentIndex = 0;
        this.StoreChanged = new Event();
        this.app = app;
        this.config = config;
        this.locations = config._locationList;
    }
    OnLocationChanged(locs) {
        var _a;
        if (this.app.Locked())
            return;
        for (let index = 0; index < locs.length; index++) {
            const element = locs[index];
            if (!element.entryText) {
                locs[index] = this.EnsureSearchEntry(element);
            }
        }
        let currentIndex = this.FindIndex(this.config.CurrentLocation);
        let newIndex = this.FindIndex(this.config.CurrentLocation, locs);
        let currentlyDisplayedChanged = false;
        let currentlyDisplayedDeleted = false;
        if (newIndex == -1 && currentIndex == -1) {
            let tmp = [];
            this.locations = locs.concat(tmp);
            this.InvokeStorageChanged();
            return;
        }
        else if (newIndex == currentIndex)
            currentlyDisplayedChanged = !this.IsEqual((_a = this.locations) === null || _a === void 0 ? void 0 : _a[currentIndex], locs === null || locs === void 0 ? void 0 : locs[currentIndex]);
        else if (newIndex == -1)
            currentlyDisplayedDeleted = true;
        else if (newIndex != currentIndex)
            this.currentIndex = newIndex;
        let tmp = [];
        this.locations = locs.concat(tmp);
        if (currentlyDisplayedChanged || currentlyDisplayedDeleted) {
            logger_Logger.Debug("Currently used location was changed or deleted from locationstore, triggering refresh.");
            this.app.RefreshAndRebuild();
        }
        this.InvokeStorageChanged();
    }
    SwitchToLocation(loc) {
        let index = this.FindIndex(loc);
        if (index == -1)
            return false;
        this.currentIndex = index;
        return true;
    }
    FindLocation(entryText) {
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.entryText == entryText)
                return {
                    country: element.country,
                    city: element.city,
                    entryText: element.entryText,
                    lat: element.lat,
                    lon: element.lon,
                    timeZone: this.NormalizeTZ(element.timeZone),
                };
        }
        return null;
    }
    NormalizeTZ(tz) {
        let valid = ValidTimezone(tz) ? tz : DateTime.local().zoneName;
        if (!valid)
            logger_Logger.Info(`Timezone '${tz}' is not valid for saved location, switching for local tz '${DateTime.local().zoneName}'`);
        return valid;
    }
    EnsureSearchEntry(loc) {
        if (!loc.entryText)
            loc.entryText = `${loc.lat},${loc.lon}`;
        return loc;
    }
    GetNextLocation(currentLoc) {
        if (currentLoc == null)
            return null;
        logger_Logger.Debug("Current location: " + JSON.stringify(currentLoc, null, 2));
        if (this.locations.length == 0)
            return currentLoc;
        let nextIndex = null;
        if (this.InStorage(currentLoc)) {
            nextIndex = this.FindIndex(currentLoc) + 1;
            logger_Logger.Debug("Current location found in storage at index " + (nextIndex - 1).toString() + ", moving to the next index");
        }
        else {
            nextIndex = this.currentIndex++;
        }
        if (nextIndex > this.locations.length - 1) {
            nextIndex = 0;
            logger_Logger.Debug("Reached end of storage, move to the beginning");
        }
        logger_Logger.Debug("Switching to index " + nextIndex.toString() + "...");
        this.currentIndex = nextIndex;
        return {
            country: this.locations[nextIndex].country,
            city: this.locations[nextIndex].city,
            entryText: this.locations[nextIndex].entryText,
            lat: this.locations[nextIndex].lat,
            lon: this.locations[nextIndex].lon,
            timeZone: this.locations[nextIndex].timeZone,
        };
    }
    GetPreviousLocation(currentLoc) {
        if (currentLoc == null)
            return null;
        if (this.locations.length == 0)
            return currentLoc;
        let previousIndex = null;
        if (this.InStorage(currentLoc)) {
            previousIndex = this.FindIndex(currentLoc) - 1;
            logger_Logger.Debug("Current location found in storage at index " + (previousIndex + 1).toString() + ", moving to the next index");
        }
        else {
            previousIndex = this.currentIndex--;
        }
        if (previousIndex < 0) {
            previousIndex = this.locations.length - 1;
            logger_Logger.Debug("Reached start of storage, move to the end");
        }
        logger_Logger.Debug("Switching to index " + previousIndex.toString() + "...");
        this.currentIndex = previousIndex;
        return {
            country: this.locations[previousIndex].country,
            city: this.locations[previousIndex].city,
            entryText: this.locations[previousIndex].entryText,
            lat: this.locations[previousIndex].lat,
            lon: this.locations[previousIndex].lon,
            timeZone: this.locations[previousIndex].timeZone,
        };
    }
    ShouldShowLocationSelectors(currentLoc) {
        if (currentLoc == null)
            return false;
        let threshold = this.InStorage(currentLoc) ? 2 : 1;
        if (this.locations.length >= threshold)
            return true;
        else
            return false;
    }
    async SaveCurrentLocation(loc) {
        if (this.app.Locked()) {
            NotificationService.Instance.Send(_("Warning") + " - " + _("Location Store"), _("You can only save correct locations when the applet is not refreshing"), true);
            return;
        }
        if (loc == null) {
            NotificationService.Instance.Send(_("Warning") + " - " + _("Location Store"), _("You can't save an incorrect location"), true);
            return;
        }
        if (this.InStorage(loc)) {
            NotificationService.Instance.Send(_("Info") + " - " + _("Location Store"), _("Location is already saved"), true);
            return;
        }
        if (this.app.config.Timezone)
            loc.timeZone = this.app.config.Timezone;
        this.locations.push(loc);
        this.currentIndex = this.locations.length - 1;
        this.InvokeStorageChanged();
        this.SaveBackLocations();
    }
    InvokeStorageChanged() {
        this.StoreChanged.Invoke(this, this.locations.length);
    }
    SaveBackLocations() {
        this.config.SetLocationList(this.locations);
    }
    InStorage(loc) {
        return this.FindIndex(loc) != -1;
    }
    FindIndex(loc, locations = null) {
        if (loc == null)
            return -1;
        if (locations == null)
            locations = this.locations;
        for (let index = 0; index < locations.length; index++) {
            const element = locations[index];
            if (element.entryText == loc.entryText)
                return index;
        }
        return -1;
    }
    IsEqual(oldLoc, newLoc) {
        if (oldLoc == null)
            return false;
        if (newLoc == null)
            return false;
        for (let key in newLoc) {
            if (oldLoc[key] != newLoc[key]) {
                return false;
            }
        }
        return true;
    }
}

;// CONCATENATED MODULE: ./src/3_8/location_services/nominatim.ts



class GeoLocation {
    constructor(app) {
        this.url = "https://nominatim.openstreetmap.org/search/";
        this.params = "?format=json&addressdetails=1&limit=1";
        this.cache = {};
        this.App = app;
    }
    async GetLocation(searchText) {
        var _a;
        try {
            searchText = searchText.trim();
            let cached = (_a = this.cache) === null || _a === void 0 ? void 0 : _a.searchText;
            if (cached != null) {
                logger_Logger.Debug("Returning cached geolocation info for '" + searchText + "'.");
                return cached;
            }
            let locationData = await this.App.LoadJsonAsync(this.url + encodeURIComponent(searchText) + this.params);
            if (locationData == null)
                return null;
            if (locationData.length == 0) {
                this.App.ShowError({
                    type: "hard",
                    detail: "bad location format",
                    message: _("Could not find location based on address, please check if it's right")
                });
                return null;
            }
            logger_Logger.Debug("Location is found, payload: " + JSON.stringify(locationData, null, 2));
            let result = {
                lat: parseFloat(locationData[0].lat),
                lon: parseFloat(locationData[0].lon),
                city: locationData[0].address.city || locationData[0].address.town || locationData[0].address.village,
                country: locationData[0].address.country,
                timeZone: DateTime.now().zoneName,
                entryText: this.BuildEntryText(locationData[0]),
            };
            this.cache[searchText] = result;
            return result;
        }
        catch (e) {
            logger_Logger.Error("Could not geo locate, error: " + JSON.stringify(e, null, 2));
            this.App.ShowError({
                type: "soft",
                detail: "bad api response",
                message: _("Failed to call Geolocation API, see Looking Glass for errors.")
            });
            return null;
        }
    }
    BuildEntryText(locationData) {
        if (locationData.address == null)
            return locationData.display_name;
        let entryText = [];
        for (let key in locationData.address) {
            if (key == "state_district")
                continue;
            if (key == "county")
                continue;
            if (key == "country_code")
                continue;
            entryText.push(locationData.address[key]);
        }
        return entryText.join(", ");
    }
}

;// CONCATENATED MODULE: ./src/3_8/config.ts







const { AppletSettings, BindingDirection } = imports.ui.settings;
const Lang = imports.lang;
const keybindingManager = imports.ui.main.keybindingManager;
const { IconType: config_IconType } = imports.gi.St;
const { get_language_names } = imports.gi.GLib;
const { Settings: config_Settings } = imports.gi.Gio;
const Keys = {
    DATA_SERVICE: "dataService",
    API_KEY: "apiKey",
    TEMPERATURE_UNIT_KEY: "temperatureUnit",
    TEMPERATURE_HIGH_FIRST: "temperatureHighFirst",
    WIND_SPEED_UNIT: "windSpeedUnit",
    DISTANCE_UNIT: "distanceUnit",
    CITY: "locationLabelOverride",
    TRANSLATE_CONDITION: "translateCondition",
    VERTICAL_ORIENTATION: "verticalOrientation",
    SHOW_TEXT_IN_PANEL: "showTextInPanel",
    TEMP_TEXT_OVERRIDE: "tempTextOverride",
    SHOW_COMMENT_IN_PANEL: "showCommentInPanel",
    SHOW_SUNRISE: "showSunrise",
    SHOW_24HOURS: "show24Hours",
    FORECAST_DAYS: "forecastDays",
    FORECAST_HOURS: "forecastHours",
    FORECAST_COLS: "forecastColumns",
    FORECAST_ROWS: "forecastRows",
    REFRESH_INTERVAL: "refreshInterval",
    PRESSURE_UNIT: "pressureUnit",
    SHORT_CONDITIONS: "shortConditions",
    MANUAL_LOCATION: "manualLocation",
    USE_CUSTOM_APPLETICONS: 'useCustomAppletIcons',
    USE_CUSTOM_MENUICONS: "useCustomMenuIcons",
    RUSSIAN_STYLE: "tempRussianStyle",
    SHORT_HOURLY_TIME: "shortHourlyTime",
    SHOW_FORECAST_DATES: "showForecastDates",
    WEATHER_USE_SYMBOLIC_ICONS_KEY: 'useSymbolicIcons',
    IMMEDIATE_PRECIP: "immediatePrecip",
    SHOW_BOTH_TEMP: "showBothTempUnits",
    DISPLAY_WIND_DIR_AS_TEXT: "displayWindAsText"
};
class Config {
    constructor(app, instanceID) {
        this.fahrenheitCountries = ["bs", "bz", "ky", "pr", "pw", "us"];
        this.windSpeedUnitLocales = {
            "fi kr no pl ru se": "m/s",
            "us gb": "mph"
        };
        this.distanceUnitLocales = {
            "us gb": "imperial"
        };
        this.WEATHER_LOCATION = "location";
        this.WEATHER_LOCATION_LIST = "locationList";
        this.doneTypingLocation = null;
        this.currentLocation = null;
        this.timezone = undefined;
        this.app = app;
        this.currentLocale = ConstructJsLocale(get_language_names()[0]);
        logger_Logger.Debug("System locale is " + this.currentLocale);
        this.autoLocProvider = new IpApi(app);
        this.geoLocationService = new GeoLocation(app);
        this.countryCode = this.GetCountryCode(this.currentLocale);
        this.settings = new AppletSettings(this, UUID, instanceID);
        this.InterfaceSettings = new config_Settings({ schema: "org.cinnamon.desktop.interface" });
        this.InterfaceSettings.connect('changed::font-name', () => this.OnFontChanged());
        this.currentFontSize = this.GetCurrentFontSize();
        this.BindSettings();
        this.LocStore = new LocationStore(this.app, this);
    }
    get Timezone() {
        return this.timezone;
    }
    set Timezone(value) {
        if (!value || value == "")
            value = undefined;
        this.timezone = value;
    }
    BindSettings() {
        let k;
        for (k in Keys) {
            let key = Keys[k];
            let keyProp = "_" + key;
            this.settings.bindProperty(BindingDirection.IN, key, keyProp, Lang.bind(this, this.OnSettingChanged), null);
        }
        this.settings.bindProperty(BindingDirection.BIDIRECTIONAL, this.WEATHER_LOCATION, ("_" + this.WEATHER_LOCATION), Lang.bind(this, this.OnLocationChanged), null);
        this.settings.bindProperty(BindingDirection.BIDIRECTIONAL, this.WEATHER_LOCATION_LIST, ("_" + this.WEATHER_LOCATION_LIST), Lang.bind(this, this.OnLocationStoreChanged), null);
        this.settings.bindProperty(BindingDirection.IN, "keybinding", "keybinding", Lang.bind(this, this.OnKeySettingsUpdated), null);
        keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this.app, this.app.on_applet_clicked));
    }
    get CurrentFontSize() {
        return this.currentFontSize;
    }
    get CurrentLocation() {
        return this.currentLocation;
    }
    get ApiKey() {
        return this._apiKey.replace(" ", "");
    }
    get Language() {
        return this.GetLanguage(this.currentLocale);
    }
    get TemperatureUnit() {
        if (this._temperatureUnit == "automatic")
            return this.GetLocaleTemperateUnit(this.countryCode);
        return this._temperatureUnit;
    }
    get WindSpeedUnit() {
        if (this._windSpeedUnit == "automatic")
            return this.GetLocaleWindSpeedUnit(this.countryCode);
        return this._windSpeedUnit;
    }
    get DistanceUnit() {
        if (this._distanceUnit == "automatic")
            return this.GetLocaleDistanceUnit(this.countryCode);
        return this._distanceUnit;
    }
    get IconType() {
        if (this._useCustomMenuIcons)
            return config_IconType.SYMBOLIC;
        return this._useSymbolicIcons ?
            config_IconType.SYMBOLIC :
            config_IconType.FULLCOLOR;
    }
    ;
    get AppletIconType() {
        if (this._useCustomAppletIcons)
            return config_IconType.SYMBOLIC;
        return this._useSymbolicIcons ?
            config_IconType.SYMBOLIC :
            config_IconType.FULLCOLOR;
    }
    SwitchToNextLocation() {
        let nextLoc = this.LocStore.GetNextLocation(this.CurrentLocation);
        if (nextLoc == null)
            return null;
        this.InjectLocationToConfig(nextLoc, true);
        return nextLoc;
    }
    SwitchToPreviousLocation() {
        let previousLoc = this.LocStore.GetPreviousLocation(this.CurrentLocation);
        if (previousLoc == null)
            return null;
        this.InjectLocationToConfig(previousLoc, true);
        return previousLoc;
    }
    NoApiKey() {
        var _a;
        let key = (_a = this._apiKey) === null || _a === void 0 ? void 0 : _a.replace(" ", "");
        return (!key || key == "");
    }
    ;
    async EnsureLocation() {
        this.currentLocation = null;
        if (!this._manualLocation) {
            let location = await this.autoLocProvider.GetLocation();
            if (!location)
                return null;
            this.InjectLocationToConfig(location);
            return location;
        }
        let loc = this._location;
        if (loc == undefined || loc.trim() == "") {
            this.app.ShowError({
                type: "hard",
                detail: "no location",
                userError: true,
                message: _("Make sure you entered a location or use Automatic location instead")
            });
            return null;
        }
        let location = this.LocStore.FindLocation(this._location);
        if (location != null) {
            logger_Logger.Debug("location exist in locationstore, retrieve");
            this.LocStore.SwitchToLocation(location);
            this.InjectLocationToConfig(location, true);
            return location;
        }
        else if (IsCoordinate(loc)) {
            loc = loc.replace(" ", "");
            let latLong = loc.split(",");
            let location = {
                lat: parseFloat(latLong[0]),
                lon: parseFloat(latLong[1]),
                timeZone: DateTime.now().zoneName,
                entryText: loc,
            };
            this.InjectLocationToConfig(location);
            return location;
        }
        logger_Logger.Debug("Location is text, geolocating...");
        let locationData = await this.geoLocationService.GetLocation(loc);
        if (locationData == null)
            return null;
        if (!!(locationData === null || locationData === void 0 ? void 0 : locationData.entryText)) {
            logger_Logger.Debug("Address found via address search");
        }
        location = this.LocStore.FindLocation(locationData.entryText);
        if (location != null) {
            logger_Logger.Debug("Found location was found in locationStore, return that instead");
            this.InjectLocationToConfig(location);
            this.LocStore.SwitchToLocation(location);
            return location;
        }
        else {
            this.InjectLocationToConfig(locationData);
            return locationData;
        }
    }
    InjectLocationToConfig(loc, switchToManual = false) {
        logger_Logger.Debug("Location setting is now: " + loc.entryText);
        let text = (loc.entryText + "");
        this.SetLocation(text);
        this.currentLocation = loc;
        if (switchToManual == true)
            this.settings.setValue(Keys.MANUAL_LOCATION, true);
    }
    OnKeySettingsUpdated() {
        if (this.keybinding != null) {
            keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this.app, this.app.on_applet_clicked));
        }
    }
    OnLocationChanged() {
        logger_Logger.Debug("User changed location, waiting 3 seconds...");
        if (this.doneTypingLocation != null)
            utils_clearTimeout(this.doneTypingLocation);
        this.doneTypingLocation = utils_setTimeout(Lang.bind(this, this.DoneTypingLocation), 3000);
    }
    OnLocationStoreChanged() {
        this.LocStore.OnLocationChanged(this._locationList);
    }
    OnFontChanged() {
        this.currentFontSize = this.GetCurrentFontSize();
        this.app.RefreshAndRebuild();
    }
    DoneTypingLocation() {
        logger_Logger.Debug("User has finished typing, beginning refresh");
        this.doneTypingLocation = null;
        this.app.RefreshAndRebuild();
    }
    OnSettingChanged() {
        this.app.RefreshAndRebuild();
    }
    SetLocation(value) {
        this.settings.setValue(this.WEATHER_LOCATION, value);
    }
    SetLocationList(list) {
        this.settings.setValue(this.WEATHER_LOCATION_LIST, list);
    }
    GetLocaleTemperateUnit(code) {
        if (code == null || !this.fahrenheitCountries.includes(code))
            return "celsius";
        return "fahrenheit";
    }
    GetLocaleWindSpeedUnit(code) {
        if (code == null)
            return "kph";
        for (const key in this.windSpeedUnitLocales) {
            if (key.includes(code))
                return this.windSpeedUnitLocales[key];
        }
        return "kph";
    }
    GetLocaleDistanceUnit(code) {
        if (code == null)
            return "metric";
        for (const key in this.distanceUnitLocales) {
            if (key.includes(code))
                return this.distanceUnitLocales[key];
        }
        return "metric";
    }
    GetCountryCode(locale) {
        if (locale == null)
            return null;
        let split = locale.split("-");
        if (split.length < 2)
            return null;
        return split[1];
    }
    GetLanguage(locale) {
        if (locale == null)
            return null;
        let split = locale.split("-");
        if (split.length < 1)
            return null;
        return split[0];
    }
    GetCurrentFontSize() {
        let nameString = this.InterfaceSettings.get_string("font-name");
        let elements = nameString.split(" ");
        let size = parseFloat(elements[elements.length - 1]);
        logger_Logger.Debug("Font size changed to " + size.toString());
        return size;
    }
}

;// CONCATENATED MODULE: ./src/3_8/loop.ts


var weatherAppletGUIDs = {};
class WeatherLoop {
    constructor(app, instanceID) {
        this.lastUpdated = new Date(0);
        this.pauseRefresh = false;
        this.LOOP_INTERVAL = 15;
        this.appletRemoved = false;
        this.errorCount = 0;
        this.app = app;
        this.instanceID = instanceID;
        this.GUID = Guid();
        weatherAppletGUIDs[instanceID] = this.GUID;
    }
    IsDataTooOld() {
        if (!this.lastUpdated)
            return true;
        let oldDate = this.lastUpdated;
        oldDate.setMinutes(oldDate.getMinutes() + (this.app.config._refreshInterval * 2));
        return (this.lastUpdated > oldDate);
    }
    async Start() {
        while (true) {
            try {
                if (this.IsStray())
                    return;
                if (this.app.encounteredError == true)
                    this.IncrementErrorCount();
                this.ValidateLastUpdate();
                if (this.pauseRefresh) {
                    logger_Logger.Debug("Configuration error, updating paused");
                    await delay(this.LoopInterval());
                    continue;
                }
                if (this.errorCount > 0 || this.NextUpdate() < new Date()) {
                    logger_Logger.Debug("Refresh triggered in main loop with these values: lastUpdated " + ((!this.lastUpdated) ? "null" : this.lastUpdated.toLocaleString())
                        + ", errorCount " + this.errorCount.toString() + " , loopInterval " + (this.LoopInterval() / 1000).toString()
                        + " seconds, refreshInterval " + this.app.config._refreshInterval + " minutes");
                    let state = await this.app.RefreshWeather(false);
                    if (state == "error")
                        logger_Logger.Info("App is currently refreshing, refresh skipped in main loop");
                    if (state == "success" || "locked")
                        this.lastUpdated = new Date();
                }
                else {
                    logger_Logger.Debug("No need to update yet, skipping");
                }
            }
            catch (e) {
                logger_Logger.Error("Error in Main loop: " + e, e);
                this.app.encounteredError = true;
            }
            await delay(this.LoopInterval());
        }
    }
    ;
    Stop() {
        this.appletRemoved = true;
    }
    Pause() {
        this.pauseRefresh = true;
    }
    Resume() {
        this.pauseRefresh = false;
    }
    ResetErrorCount() {
        this.errorCount = 0;
    }
    GetSecondsUntilNextRefresh() {
        return (this.errorCount > 0) ? (this.errorCount) * this.LOOP_INTERVAL : this.LOOP_INTERVAL;
    }
    IsStray() {
        if (this.appletRemoved == true)
            return true;
        if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
            logger_Logger.Debug("Applet GUID: " + this.GUID);
            logger_Logger.Debug("GUID stored globally: " + weatherAppletGUIDs[this.instanceID]);
            logger_Logger.Info("GUID mismatch, terminating applet");
            return true;
        }
        return false;
    }
    IncrementErrorCount() {
        this.app.encounteredError = false;
        this.errorCount++;
        logger_Logger.Debug("Encountered error in previous loop");
        if (this.errorCount > 60)
            this.errorCount = 60;
    }
    NextUpdate() {
        return new Date(this.lastUpdated.getTime() + this.app.config._refreshInterval * 60000);
    }
    ValidateLastUpdate() {
        if (this.lastUpdated > new Date())
            this.lastUpdated = new Date(0);
    }
    LoopInterval() {
        return (this.errorCount > 0) ? this.LOOP_INTERVAL * this.errorCount * 1000 : this.LOOP_INTERVAL * 1000;
    }
}

// EXTERNAL MODULE: ./node_modules/suncalc/suncalc.js
var suncalc = __webpack_require__(969);
;// CONCATENATED MODULE: ./src/3_8/providers/met_uk.ts




class MetUk {
    constructor(_app) {
        this.prettyName = _("Met Office UK");
        this.name = "Met Office UK";
        this.maxForecastSupport = 5;
        this.website = "https://www.metoffice.gov.uk/";
        this.maxHourlyForecastSupport = 36;
        this.needsApiKey = false;
        this.baseUrl = "http://datapoint.metoffice.gov.uk/public/data/val/";
        this.forecastPrefix = "wxfcs/all/json/";
        this.threeHourlyUrl = "?res=3hourly";
        this.dailyUrl = "?res=daily";
        this.currentPrefix = "wxobs/all/json/";
        this.sitesUrl = "sitelist";
        this.key = "key=05de1ee8-de70-46aa-9b41-299d4cc60219";
        this.forecastSite = null;
        this.observationSites = [];
        this.MAX_STATION_DIST = 50000;
        this.ParseForecast = (json, loc) => {
            var _a, _b;
            let forecasts = [];
            try {
                for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
                    let element = json.SiteRep.DV.Location.Period[i];
                    if (!Array.isArray(element.Rep))
                        continue;
                    let day = element.Rep[0];
                    let night = element.Rep[1];
                    let forecast = {
                        date: DateTime.fromISO(this.PartialToISOString(element.value), { zone: loc.timeZone }),
                        temp_min: CelsiusToKelvin(parseFloat((_a = night.Nm) !== null && _a !== void 0 ? _a : "0")),
                        temp_max: CelsiusToKelvin(parseFloat((_b = day.Dm) !== null && _b !== void 0 ? _b : "0")),
                        condition: this.ResolveCondition(day.W),
                    };
                    forecasts.push(forecast);
                }
                return forecasts;
            }
            catch (e) {
                logger_Logger.Error("MET UK Forecast Parsing error: " + e, e);
                this.app.ShowError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
                return null;
            }
        };
        this.ParseHourlyForecast = (json, loc) => {
            let forecasts = [];
            try {
                for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
                    let day = json.SiteRep.DV.Location.Period[i];
                    let date = DateTime.fromISO(this.PartialToISOString(day.value), { zone: loc.timeZone });
                    if (!Array.isArray(day.Rep))
                        continue;
                    for (let index = 0; index < day.Rep.length; index++) {
                        const hour = day.Rep[index];
                        let timestamp = date.plus({ hours: parseInt(hour.$) / 60 });
                        let threshold = DateTime.utc().setZone(loc.timeZone).minus({ hours: 3 });
                        if (timestamp < threshold)
                            continue;
                        let forecast = {
                            date: timestamp,
                            temp: CelsiusToKelvin(parseFloat(hour.T)),
                            condition: this.ResolveCondition(hour.W),
                            precipitation: {
                                type: "rain",
                                volume: undefined,
                                chance: parseFloat(hour.Pp)
                            }
                        };
                        forecasts.push(forecast);
                    }
                }
                return forecasts;
            }
            catch (e) {
                logger_Logger.Error("MET UK Forecast Parsing error: " + e, e);
                this.app.ShowError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
                return null;
            }
        };
        this.app = _app;
    }
    async GetWeather(newLoc) {
        let loc = newLoc.lat.toString() + "," + newLoc.lon.toString();
        if (this.currentLocID == null || this.currentLocID != loc || this.forecastSite == null || this.observationSites == null || this.observationSites.length == 0) {
            logger_Logger.Info("Downloading new site data");
            this.currentLoc = newLoc;
            this.currentLocID = loc;
            let forecastSite = await this.GetClosestForecastSite(newLoc);
            if (forecastSite == null)
                return null;
            let observationSites = await this.GetObservationSitesInRange(newLoc, this.MAX_STATION_DIST);
            if (observationSites == null)
                return null;
            this.forecastSite = forecastSite;
            this.observationSites = observationSites;
        }
        else {
            logger_Logger.Debug("Site data downloading skipped");
        }
        if (this.observationSites.length == 0 || this.forecastSite.dist > 100000) {
            logger_Logger.Error("User is probably not in UK, aborting");
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "location not covered",
                message: "MET Office UK only covers the UK, please make sure your location is in the country",
                service: "met-uk"
            });
            return null;
        }
        let forecastPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.dailyUrl + "&" + this.key, this.ParseForecast, newLoc);
        let hourlyPayload = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.threeHourlyUrl + "&" + this.key, this.ParseHourlyForecast, newLoc);
        let observations = await this.GetObservationData(this.observationSites);
        let currentResult = this.ParseCurrent(observations, newLoc);
        if (!currentResult)
            return null;
        let forecastResult = await forecastPromise;
        currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
        let threeHourlyForecast = await hourlyPayload;
        currentResult.hourlyForecasts = (!threeHourlyForecast) ? [] : threeHourlyForecast;
        return currentResult;
    }
    ;
    async GetClosestForecastSite(loc) {
        let forecastSitelist = await this.app.LoadJsonAsync(this.baseUrl + this.forecastPrefix + this.sitesUrl + "?" + this.key);
        if (forecastSitelist == null)
            return null;
        return this.GetClosestSite(forecastSitelist, loc);
    }
    async GetObservationSitesInRange(loc, range) {
        let observationSiteList = await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + this.sitesUrl + "?" + this.key);
        if (observationSiteList == null)
            return null;
        let observationSites = [];
        for (let index = 0; index < observationSiteList.Locations.Location.length; index++) {
            const element = observationSiteList.Locations.Location[index];
            element.dist = GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), loc.lat, loc.lon);
            if (element.dist > range)
                continue;
            observationSites.push(element);
        }
        observationSites = this.SortObservationSites(observationSites);
        logger_Logger.Debug("Observation sites found: " + JSON.stringify(observationSites, null, 2));
        return observationSites;
    }
    async GetObservationData(observationSites) {
        let observations = [];
        for (let index = 0; index < observationSites.length; index++) {
            const element = observationSites[index];
            logger_Logger.Debug("Getting observation data from station: " + element.id);
            let payload = await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + element.id + "?res=hourly&" + this.key);
            if (!!payload)
                observations.push(payload);
            else {
                logger_Logger.Debug("Failed to get observations from " + element.id);
            }
        }
        return observations;
    }
    async GetData(query, ParseFunction, loc) {
        if (query == null)
            return null;
        logger_Logger.Debug("Query: " + query);
        let json = await this.app.LoadJsonAsync(query);
        if (json == null)
            return null;
        return ParseFunction(json, loc);
    }
    ;
    ParseCurrent(json, loc) {
        let observation = this.MeshObservations(json, loc);
        if (!observation) {
            return null;
        }
        let dataIndex = -1;
        for (let index = 0; index < json.length; index++) {
            const element = json[index];
            if (element.SiteRep.DV.Location == null)
                continue;
            dataIndex = index;
            break;
        }
        if (dataIndex == -1) {
            this.app.ShowError({
                detail: "no api response",
                type: "hard",
                message: _("Data was not found for location"),
                service: "met-uk",
            });
            return null;
        }
        let times = (0,suncalc.getTimes)(new Date(), parseFloat(json[dataIndex].SiteRep.DV.Location.lat), parseFloat(json[dataIndex].SiteRep.DV.Location.lon), parseFloat(json[dataIndex].SiteRep.DV.Location.elevation));
        try {
            let weather = {
                coord: {
                    lat: parseFloat(json[dataIndex].SiteRep.DV.Location.lat),
                    lon: parseFloat(json[dataIndex].SiteRep.DV.Location.lon)
                },
                location: {
                    city: undefined,
                    country: undefined,
                    url: undefined,
                    timeZone: undefined,
                    distanceFrom: this.observationSites[dataIndex].dist
                },
                date: DateTime.fromISO(json[dataIndex].SiteRep.DV.dataDate, { zone: loc.timeZone }),
                sunrise: DateTime.fromJSDate(times.sunrise, { zone: loc.timeZone }),
                sunset: DateTime.fromJSDate(times.sunset, { zone: loc.timeZone }),
                wind: {
                    speed: null,
                    degree: null
                },
                temperature: null,
                pressure: null,
                humidity: null,
                condition: this.ResolveCondition(observation === null || observation === void 0 ? void 0 : observation.W),
                forecasts: []
            };
            if ((observation === null || observation === void 0 ? void 0 : observation.V) != null) {
                weather.extra_field = {
                    name: _("Visibility"),
                    value: this.VisibilityToText(observation.V),
                    type: "string"
                };
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.S) != null) {
                weather.wind.speed = MPHtoMPS(parseFloat(observation.S));
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.D) != null) {
                weather.wind.degree = CompassToDeg(observation.D);
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.T) != null) {
                weather.temperature = CelsiusToKelvin(parseFloat(observation.T));
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.P) != null) {
                weather.pressure = parseFloat(observation.P);
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.H) != null) {
                weather.humidity = parseFloat(observation.H);
            }
            return weather;
        }
        catch (e) {
            logger_Logger.Error("Met UK Weather Parsing error: " + e, e);
            this.app.ShowError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    }
    ;
    VisibilityToText(dist) {
        let distance = parseInt(dist);
        let unit = this.app.config.DistanceUnit;
        let stringFormat = {
            distanceUnit: this.DistanceUnitFor(unit)
        };
        if (distance < 1000) {
            stringFormat.distance = MetreToUserUnits(1000, unit).toString();
            return `${_("Very poor")} - ${_("Less than {distance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance >= 40000) {
            stringFormat.distance = MetreToUserUnits(40000, unit).toString();
            return `${_("Excellent")} - ${_("More than {distance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance < 4000) {
            stringFormat.smallerDistance = MetreToUserUnits(1000, unit).toString();
            stringFormat.biggerDistance = MetreToUserUnits(4000, unit).toString();
            return `${_("Poor")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance < 10000) {
            stringFormat.smallerDistance = MetreToUserUnits(4000, unit).toString();
            stringFormat.biggerDistance = MetreToUserUnits(10000, unit).toString();
            return `${_("Moderate")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance < 20000) {
            stringFormat.smallerDistance = MetreToUserUnits(10000, unit).toString();
            stringFormat.biggerDistance = MetreToUserUnits(20000, unit).toString();
            return `${_("Good")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance < 40000) {
            stringFormat.smallerDistance = MetreToUserUnits(20000, unit).toString();
            stringFormat.biggerDistance = MetreToUserUnits(40000, unit).toString();
            return `${_("Very good")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
        }
        else {
            stringFormat.smallerDistance = MetreToUserUnits(20000, unit).toString();
            stringFormat.biggerDistance = MetreToUserUnits(40000, unit).toString();
            return `${_("Very good")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
        }
    }
    DistanceUnitFor(unit) {
        if (unit == "imperial")
            return _("mi");
        return _("km");
    }
    SortObservationSites(observations) {
        observations = observations.sort((a, b) => {
            if (a.dist < b.dist)
                return -1;
            if (a.dist == b.dist)
                return 0;
            return 1;
        });
        return observations;
    }
    MeshObservations(observations, loc) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!observations)
            return null;
        if (observations.length == 0)
            return null;
        let result = this.GetLatestObservation((_d = (_c = (_b = (_a = observations[0]) === null || _a === void 0 ? void 0 : _a.SiteRep) === null || _b === void 0 ? void 0 : _b.DV) === null || _c === void 0 ? void 0 : _c.Location) === null || _d === void 0 ? void 0 : _d.Period, DateTime.utc().setZone(loc.timeZone), loc);
        if (observations.length == 1)
            return result;
        for (let index = 0; index < observations.length; index++) {
            if (((_h = (_g = (_f = (_e = observations[index]) === null || _e === void 0 ? void 0 : _e.SiteRep) === null || _f === void 0 ? void 0 : _f.DV) === null || _g === void 0 ? void 0 : _g.Location) === null || _h === void 0 ? void 0 : _h.Period) == null)
                continue;
            let nextObservation = this.GetLatestObservation(observations[index].SiteRep.DV.Location.Period, DateTime.utc().setZone(loc.timeZone), loc);
            if (result == null)
                result = nextObservation;
            let debugText = " Observation data missing, plugged in from ID " +
                observations[index].SiteRep.DV.Location.i + ", index " + index +
                ", distance "
                + Math.round(GetDistance(parseFloat(observations[index].SiteRep.DV.Location.lat), parseFloat(observations[index].SiteRep.DV.Location.lon), this.currentLoc.lat, this.currentLoc.lon))
                + " metres";
            if (result != null) {
                if ((result === null || result === void 0 ? void 0 : result.V) == null) {
                    result.V = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.V;
                    logger_Logger.Debug("Visibility" + debugText);
                }
                if ((result === null || result === void 0 ? void 0 : result.W) == null) {
                    result.W = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.W;
                    logger_Logger.Debug("Weather condition" + debugText);
                }
                if ((result === null || result === void 0 ? void 0 : result.S) == null) {
                    result.S = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.S;
                    logger_Logger.Debug("Wind Speed" + debugText);
                }
                if ((result === null || result === void 0 ? void 0 : result.D) == null) {
                    result.D = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.D;
                    logger_Logger.Debug("Wind degree" + debugText);
                }
                if ((result === null || result === void 0 ? void 0 : result.T) == null) {
                    result.T = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.T;
                    logger_Logger.Debug("Temperature" + debugText);
                }
                if ((result === null || result === void 0 ? void 0 : result.P) == null) {
                    result.P = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.P;
                    logger_Logger.Debug("Pressure" + debugText);
                }
                if ((result === null || result === void 0 ? void 0 : result.H) == null) {
                    result.H = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.H;
                    logger_Logger.Debug("Humidity" + debugText);
                }
            }
        }
        return result;
    }
    GetLatestObservation(observations, day, loc) {
        if (observations == null)
            return null;
        for (let index = 0; index < observations.length; index++) {
            const element = observations[index];
            let date = DateTime.fromISO(this.PartialToISOString(element.value), { zone: loc.timeZone });
            if (!OnSameDay(date, day))
                continue;
            if (Array.isArray(element.Rep))
                return element.Rep[element.Rep.length - 1];
            else
                return element.Rep;
        }
        return null;
    }
    PartialToISOString(date) {
        return (date.replace("Z", "")) + "T00:00:00Z";
    }
    GetClosestSite(siteList, loc) {
        let sites = siteList.Locations.Location;
        let closest = sites[0];
        closest.dist = GetDistance(parseFloat(closest.latitude), parseFloat(closest.longitude), loc.lat, loc.lon);
        for (let index = 0; index < sites.length; index++) {
            const element = sites[index];
            element.dist = GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), loc.lat, loc.lon);
            if (element.dist < closest.dist) {
                closest = element;
            }
        }
        return closest;
    }
    ResolveCondition(icon) {
        switch (icon) {
            case "NA":
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "0":
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    customIcon: "night-clear-symbolic",
                    icons: ["weather-clear-night", "weather-severe-alert"]
                };
            case "1":
                return {
                    main: _("Sunny"),
                    description: _("Sunny"),
                    customIcon: "day-sunny-symbolic",
                    icons: ["weather-clear", "weather-severe-alert"]
                };
            case "2":
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy"),
                    customIcon: "night-alt-cloudy-symbolic",
                    icons: ["weather-clouds-night", "weather-overcast", "weather-severe-alert"]
                };
            case "3":
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy"),
                    customIcon: "day-cloudy-symbolic",
                    icons: ["weather-clouds", "weather-overcast", "weather-severe-alert"]
                };
            case "4":
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "5":
                return {
                    main: _("Mist"),
                    description: _("Mist"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "6":
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "7":
                return {
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    customIcon: "cloud-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
                };
            case "8":
                return {
                    main: _("Overcast"),
                    description: _("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
                };
            case "9":
                return {
                    main: _("Light rain"),
                    description: _("Light rain shower"),
                    customIcon: "night-alt-showers-symbolic",
                    icons: ["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "10":
                return {
                    main: _("Light rain"),
                    description: _("Light rain shower"),
                    customIcon: "day-showers-symbolic",
                    icons: ["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "11":
                return {
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    customIcon: "showers-symbolic",
                    icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "12":
                return {
                    main: _("Light rain"),
                    description: _("Light rain"),
                    customIcon: "showers-symbolic",
                    icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "13":
                return {
                    main: _("Heavy rain"),
                    description: _("Heavy rain shower"),
                    customIcon: "night-alt-rain-symbolic",
                    icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "14":
                return {
                    main: _("Heavy rain"),
                    description: _("Heavy rain shower"),
                    customIcon: "day-rain-symbolic",
                    icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "15":
                return {
                    main: _("Heavy rain"),
                    description: _("Heavy rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "16":
                return {
                    main: _("Sleet"),
                    description: _("Sleet shower"),
                    customIcon: "night-alt-rain-mix-symbolic",
                    icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "17":
                return {
                    main: _("Sleet"),
                    description: _("Sleet shower"),
                    customIcon: "day-rain-mix-symbolic",
                    icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "18":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "19":
                return {
                    main: _("Hail"),
                    description: _("Hail shower"),
                    customIcon: "night-alt-hail-symbolic",
                    icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "20":
                return {
                    main: _("Hail"),
                    description: _("Hail shower"),
                    customIcon: "day-hail-symbolic",
                    icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "21":
                return {
                    main: _("Hail"),
                    description: _("Hail"),
                    customIcon: "hail-symbolic",
                    icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "22":
                return {
                    main: _("Light snow"),
                    description: _("Light snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
                };
            case "23":
                return {
                    main: _("Light snow"),
                    description: _("Light snow shower"),
                    customIcon: "day-snow-symbolic",
                    icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
                };
            case "24":
                return {
                    main: _("Light snow"),
                    description: _("Light snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
                };
            case "25":
                return {
                    main: _("Heavy snow"),
                    description: _("Heavy snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
                };
            case "26":
                return {
                    main: _("Heavy snow"),
                    description: _("Heavy snow shower"),
                    customIcon: "day-snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
                };
            case "27":
                return {
                    main: _("Heavy snow"),
                    description: _("Heavy snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
                };
            case "28":
                return {
                    main: _("Thunder"),
                    description: _("Thunder shower"),
                    customIcon: "day-storm-showers-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "29":
                return {
                    main: _("Thunder"),
                    description: _("Thunder shower"),
                    customIcon: "night-alt-storm-showers-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "30":
                return {
                    main: _("Thunder"),
                    description: _("Thunder"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            default:
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icons: ["weather-severe-alert"]
                };
        }
    }
    ;
}
;

;// CONCATENATED MODULE: ./src/3_8/lib/commandRunner.ts

const { spawnCommandLineAsyncIO } = imports.misc.util;
async function SpawnProcessJson(command) {
    let response = await SpawnProcess(command);
    if (!response.Success)
        return response;
    try {
        response.Data = JSON.parse(response.Data);
    }
    catch (e) {
        Logger.Error("Error: Command response is not JSON. The response: " + response.Data, e);
        response.Success = false;
        response.ErrorData = {
            Code: -1,
            Message: "Failed to parse JSON",
            Type: "jsonParse",
        };
    }
    finally {
        return response;
    }
}
async function SpawnProcess(command) {
    let cmd = "";
    for (let index = 0; index < command.length; index++) {
        const element = command[index];
        cmd += "'" + element + "' ";
    }
    let response = await new Promise((resolve, reject) => {
        spawnCommandLineAsyncIO(cmd, (aStdout, err, exitCode) => {
            let result = {
                Success: exitCode == 0,
                ErrorData: undefined,
                Data: aStdout !== null && aStdout !== void 0 ? aStdout : null
            };
            if (exitCode != 0) {
                result.ErrorData = {
                    Code: exitCode,
                    Message: err !== null && err !== void 0 ? err : null,
                    Type: "unknown"
                };
            }
            resolve(result);
            return result;
        });
    });
    return response;
}
function OpenUrl(element) {
    if (!element.url)
        return;
    imports.gi.Gio.app_info_launch_default_for_uri(element.url, global.create_app_launch_context());
}

;// CONCATENATED MODULE: ./src/3_8/ui_elements/weatherbutton.ts

const { Button } = imports.gi.St;
const { SignalManager } = imports.misc.signalManager;
class WeatherButton {
    constructor(options, doNotAddPadding = false) {
        this.signals = new SignalManager();
        this.disabled = false;
        this.Hovered = new Event();
        this.Clicked = new Event();
        this.actor = new Button(options);
        this.actor.add_style_class_name("popup-menu-item");
        if (doNotAddPadding)
            this.actor.set_style('padding: 0px; border-radius: 2px;');
        else
            this.actor.set_style('padding-top: 0px;padding-bottom: 0px; padding-right: 2px; padding-left: 2px; border-radius: 2px;');
        this.signals.connect(this.actor, 'enter-event', this.handleEnter, this);
        this.signals.connect(this.actor, 'leave-event', this.handleLeave, this);
        this.actor.connect("clicked", () => this.clicked());
        this.actor.connect("enter-event", (actor, event) => this.hovered(event));
    }
    handleEnter(actor) {
        if (!this.disabled)
            this.actor.add_style_pseudo_class('active');
    }
    handleLeave() {
        this.actor.remove_style_pseudo_class('active');
    }
    disable() {
        this.disabled = true;
        this.actor.reactive = false;
    }
    enable() {
        this.disabled = false;
        this.actor.reactive = true;
    }
    clicked() {
        if (!this.disabled) {
            this.actor.add_style_pseudo_class('active');
            this.Clicked.Invoke(this, null);
        }
    }
    hovered(event) {
        this.Hovered.Invoke(this, event);
    }
}

;// CONCATENATED MODULE: ./src/3_8/ui_elements/uiCurrentWeather.ts





const { Bin, BoxLayout, IconType: uiCurrentWeather_IconType, Label, Icon, Align } = imports.gi.St;
const uiCurrentWeather_Lang = imports.lang;
const STYLE_SUMMARYBOX = 'weather-current-summarybox';
const STYLE_SUMMARY = 'weather-current-summary';
const STYLE_DATABOX = 'weather-current-databox';
const STYLE_ICON = 'weather-current-icon';
const STYLE_ICONBOX = 'weather-current-iconbox';
const STYLE_DATABOX_CAPTIONS = 'weather-current-databox-captions';
const STYLE_ASTRONOMY = 'weather-current-astronomy';
const STYLE_DATABOX_VALUES = 'weather-current-databox-values';
const STYLE_CURRENT = 'current';
const STYLE_LOCATION_SELECTOR = 'location-selector';
class CurrentWeather {
    constructor(app) {
        this.app = app;
        this.actor = new Bin();
        this.actor.style_class = STYLE_CURRENT;
        this.app.config.LocStore.StoreChanged.Subscribe((s, a) => this.onLocationStorageChanged(s, a));
    }
    Display(weather, config) {
        try {
            if (this.app.config.LocStore.ShouldShowLocationSelectors(config.CurrentLocation))
                this.ShowLocationSelectors();
            else
                this.HideLocationSelectors();
            let location = GenerateLocationText(weather, config);
            this.SetLocation(location, weather.location.url);
            this.SetConditionText(weather.condition.description);
            this.SetWeatherIcon(weather.condition.icons, weather.condition.customIcon);
            this.SetTemperature(weather.temperature);
            this.SetHumidity(weather.humidity);
            this.SetWind(weather.wind.speed, weather.wind.degree);
            this.SetPressure(weather.pressure);
            this.SetAPIUniqueField(weather.extra_field);
            if (config._showSunrise)
                this.SetSunriseAndSunset(weather.sunrise, weather.sunset, weather.location.timeZone);
            this.SetImmediatePrecipitation(weather.immediatePrecipitation, config);
            return true;
        }
        catch (e) {
            logger_Logger.Error("DisplayWeatherError: " + e, e);
            return false;
        }
    }
    ;
    UpdateIconType(iconType) {
        this.weatherIcon.icon_type = iconType;
    }
    Destroy() {
        if (this.actor.get_child() != null)
            this.actor.get_child().destroy();
    }
    Rebuild(config, textColorStyle) {
        this.Destroy();
        this.weatherIcon = new Icon({
            icon_type: config.IconType,
            icon_size: 64,
            icon_name: APPLET_ICON,
            style_class: STYLE_ICON
        });
        let box = new BoxLayout({ style_class: STYLE_ICONBOX });
        box.add_actor(this.weatherIcon);
        box.add_actor(this.BuildMiddleColumn(config, textColorStyle));
        box.add_actor(this.BuildRightColumn(textColorStyle, config));
        this.actor.set_child(box);
    }
    ;
    BuildMiddleColumn(config, textColorStyle) {
        this.weatherSummary = new Label({ text: _('Loading ...'), style_class: STYLE_SUMMARY });
        let middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX });
        middleColumn.add_actor(this.BuildLocationSection());
        middleColumn.add(this.weatherSummary, { expand: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, x_fill: false, y_fill: false });
        this.immediatePrecipitationLabel = new Label({ style_class: "weather-immediate-precipitation" });
        this.immediatePrecipitationBox = new Bin();
        this.immediatePrecipitationBox.add_actor(this.immediatePrecipitationLabel);
        this.immediatePrecipitationBox.hide();
        middleColumn.add_actor(this.immediatePrecipitationBox);
        if (config._showSunrise)
            middleColumn.add_actor(this.BuildSunBox(config, textColorStyle));
        return middleColumn;
    }
    BuildRightColumn(textColorStyle, config) {
        let textOb = {
            text: ELLIPSIS
        };
        this.temperatureLabel = new Label(textOb);
        this.humidityLabel = new Label(textOb);
        this.pressureLabel = new Label(textOb);
        this.apiUniqueLabel = new Label({ text: '' });
        this.apiUniqueCaptionLabel = new Label({ text: '', style: textColorStyle });
        let rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS });
        let rb_values = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_VALUES });
        rb_captions.add_actor(new Label({ text: _('Temperature') + LocalizedColon(config.currentLocale), style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: _('Humidity') + LocalizedColon(config.currentLocale), style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: _('Pressure') + LocalizedColon(config.currentLocale), style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: _('Wind') + LocalizedColon(config.currentLocale), style: textColorStyle }));
        rb_captions.add_actor(this.apiUniqueCaptionLabel);
        rb_values.add_actor(this.temperatureLabel);
        rb_values.add_actor(this.humidityLabel);
        rb_values.add_actor(this.pressureLabel);
        rb_values.add_actor(this.BuildWind(config));
        rb_values.add_actor(this.apiUniqueLabel);
        let rightColumn = new BoxLayout({ style_class: STYLE_DATABOX });
        rightColumn.add_actor(rb_captions);
        rightColumn.add_actor(rb_values);
        return rightColumn;
    }
    BuildWind(config) {
        let windBox = new BoxLayout({ vertical: false });
        let iconPaddingBottom = Math.round(config.CurrentFontSize * 0.05);
        let iconPaddingTop = Math.round(config.CurrentFontSize * 0.15);
        let iconSize = Math.round(config.CurrentFontSize * 0.8);
        this.windLabel = new Label({ text: ELLIPSIS });
        this.windDirectionIcon = new Icon({
            icon_type: uiCurrentWeather_IconType.SYMBOLIC,
            icon_name: APPLET_ICON,
            icon_size: iconSize,
            style: "padding-right: 5px; padding-top: " + iconPaddingTop + "px; padding-bottom: " + iconPaddingBottom + "px;"
        });
        if (!config._displayWindAsText)
            windBox.add(this.windDirectionIcon, { x_fill: false, y_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: false });
        windBox.add(this.windLabel);
        return windBox;
    }
    BuildLocationSection() {
        this.locationButton = new WeatherButton({ reactive: true, label: _('Refresh'), });
        this.location = this.locationButton.actor;
        this.location.connect(SIGNAL_CLICKED, () => {
            if (this.app.encounteredError)
                this.app.RefreshWeather(true);
            else if (this.locationButton.url == null)
                return;
            else
                OpenUrl(this.locationButton);
        });
        this.nextLocationButton = new WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: uiCurrentWeather_IconType.SYMBOLIC,
                icon_size: this.app.config.CurrentFontSize,
                icon_name: "custom-right-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this.nextLocationButton.actor.connect(SIGNAL_CLICKED, uiCurrentWeather_Lang.bind(this, this.NextLocationClicked));
        this.previousLocationButton = new WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: uiCurrentWeather_IconType.SYMBOLIC,
                icon_size: this.app.config.CurrentFontSize,
                icon_name: "custom-left-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this.previousLocationButton.actor.connect(SIGNAL_CLICKED, uiCurrentWeather_Lang.bind(this, this.PreviousLocationClicked));
        let box = new BoxLayout();
        box.add(this.previousLocationButton.actor, { x_fill: false, x_align: Align.START, y_align: Align.MIDDLE, expand: false });
        box.add(this.location, { x_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: true });
        box.add(this.nextLocationButton.actor, { x_fill: false, x_align: Align.END, y_align: Align.MIDDLE, expand: false });
        return box;
    }
    BuildSunBox(config, textColorStyle) {
        let sunBin = new Bin();
        this.sunriseLabel = new Label({ text: ELLIPSIS, style: textColorStyle });
        this.sunsetLabel = new Label({ text: ELLIPSIS, style: textColorStyle });
        let sunriseBox = new BoxLayout();
        let sunsetBox = new BoxLayout();
        if (config._showSunrise) {
            let sunsetIcon = new Icon({
                icon_name: "sunset-symbolic",
                icon_type: uiCurrentWeather_IconType.SYMBOLIC,
                icon_size: 25,
                style: textColorStyle
            });
            let sunriseIcon = new Icon({
                icon_name: "sunrise-symbolic",
                icon_type: uiCurrentWeather_IconType.SYMBOLIC,
                icon_size: 25,
                style: textColorStyle
            });
            sunriseBox.add_actor(sunriseIcon);
            sunsetBox.add_actor(sunsetIcon);
        }
        let textOptions = {
            x_fill: false,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        };
        sunriseBox.add(this.sunriseLabel, textOptions);
        sunsetBox.add(this.sunsetLabel, textOptions);
        let ab_spacerLabel = new Label({ text: BLANK });
        let sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY });
        sunBox.add_actor(sunriseBox);
        sunBox.add_actor(ab_spacerLabel);
        sunBox.add_actor(sunsetBox);
        sunBin.set_child(sunBox);
        return sunBin;
    }
    SetImmediatePrecipitation(precip, config) {
        if (!config._immediatePrecip || !precip || precip.end == null || precip.start == null) {
            this.immediatePrecipitationBox.hide();
            return;
        }
        this.immediatePrecipitationBox.show();
        if (precip.start == -1) {
            this.immediatePrecipitationBox.hide();
        }
        else if (precip.start == 0) {
            if (precip.end != -1)
                this.immediatePrecipitationLabel.text = _("Precipitation will end in {precipEnd} minutes", { precipEnd: precip.end });
            else
                this.immediatePrecipitationLabel.text = _("Precipitation won't end in within an hour");
        }
        else {
            this.immediatePrecipitationLabel.text = _("Precipitation will start within {precipStart} minutes", { precipStart: precip.start });
        }
    }
    SetSunriseAndSunset(sunrise, sunset, tz) {
        let sunriseText = "";
        let sunsetText = "";
        if (sunrise != null && sunset != null && this.app.config._showSunrise) {
            sunriseText = (GetHoursMinutes(sunrise, this.app.config.currentLocale, this.app.config._show24Hours, tz));
            sunsetText = (GetHoursMinutes(sunset, this.app.config.currentLocale, this.app.config._show24Hours, tz));
        }
        this.sunriseLabel.text = sunriseText;
        this.sunsetLabel.text = sunsetText;
    }
    SetAPIUniqueField(extra_field) {
        this.apiUniqueLabel.text = "";
        this.apiUniqueCaptionLabel.text = "";
        if (!!extra_field) {
            this.apiUniqueCaptionLabel.text = _(extra_field.name) + LocalizedColon(this.app.config.currentLocale);
            let value;
            switch (extra_field.type) {
                case "percent":
                    value = PrecentToLocale(extra_field.value, this.app.config.currentLocale);
                    break;
                case "temperature":
                    value = TempToUserConfig(extra_field.value, this.app.config);
                    break;
                default:
                    value = _(extra_field.value);
                    break;
            }
            this.apiUniqueLabel.text = value !== null && value !== void 0 ? value : "";
        }
    }
    SetWeatherIcon(iconNames, customIconName) {
        if (this.app.config._useCustomMenuIcons) {
            this.weatherIcon.icon_name = customIconName;
            this.UpdateIconType(uiCurrentWeather_IconType.SYMBOLIC);
        }
        else {
            let icon = WeatherIconSafely(iconNames, this.app.config.IconType);
            this.weatherIcon.icon_name = icon;
            this.UpdateIconType(this.app.config.IconType);
        }
    }
    SetConditionText(condition) {
        this.weatherSummary.text = condition;
    }
    SetTemperature(temperature) {
        let temp = TempToUserConfig(temperature, this.app.config);
        if (temp == null)
            return;
        this.temperatureLabel.text = temp;
    }
    SetHumidity(humidity) {
        if (humidity != null) {
            this.humidityLabel.text = PrecentToLocale(humidity, this.app.config.currentLocale);
        }
    }
    async SetWind(windSpeed, windDegree) {
        if (windSpeed == null || windDegree == null)
            return;
        let wind_direction = CompassDirection(windDegree);
        this.windDirectionIcon.icon_name = wind_direction;
        if (this.app.config._displayWindAsText) {
            let dirText = CompassDirectionText(windDegree);
            this.windLabel.text = `${(dirText != null ? _(dirText) + " " : "")}${MPStoUserUnits(windSpeed, this.app.config.WindSpeedUnit)}`;
        }
        else {
            this.windLabel.text = MPStoUserUnits(windSpeed, this.app.config.WindSpeedUnit);
        }
        if (this.app.config.WindSpeedUnit != "Beaufort")
            this.windLabel.text += " " + _(this.app.config.WindSpeedUnit);
    }
    SetPressure(pressure) {
        if (pressure != null) {
            this.pressureLabel.text = PressToUserUnits(pressure, this.app.config._pressureUnit) + ' ' + _(this.app.config._pressureUnit);
        }
    }
    SetLocation(locationString, url) {
        this.location.label = locationString;
        if (!url)
            this.locationButton.disable();
        else
            this.locationButton.url = url;
    }
    NextLocationClicked() {
        let loc = this.app.config.SwitchToNextLocation();
        this.app.RefreshAndRebuild(loc);
    }
    PreviousLocationClicked() {
        let loc = this.app.config.SwitchToPreviousLocation();
        this.app.RefreshAndRebuild(loc);
    }
    onLocationStorageChanged(sender, itemCount) {
        logger_Logger.Debug("On location storage callback called, number of locations now " + itemCount.toString());
        if (this.app.config.LocStore.ShouldShowLocationSelectors(this.app.config.CurrentLocation))
            this.ShowLocationSelectors();
        else
            this.HideLocationSelectors();
    }
    ShowLocationSelectors() {
        var _a, _b, _c, _d;
        (_b = (_a = this.nextLocationButton) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.show();
        (_d = (_c = this.previousLocationButton) === null || _c === void 0 ? void 0 : _c.actor) === null || _d === void 0 ? void 0 : _d.show();
    }
    HideLocationSelectors() {
        var _a, _b, _c, _d;
        (_b = (_a = this.nextLocationButton) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.hide();
        (_d = (_c = this.previousLocationButton) === null || _c === void 0 ? void 0 : _c.actor) === null || _d === void 0 ? void 0 : _d.hide();
    }
}

;// CONCATENATED MODULE: ./src/3_8/ui_elements/uiForecasts.ts





const { Bin: uiForecasts_Bin, BoxLayout: uiForecasts_BoxLayout, Label: uiForecasts_Label, Icon: uiForecasts_Icon, Widget } = imports.gi.St;
const { GridLayout } = imports.gi.Clutter;
const STYLE_FORECAST_ICON = 'weather-forecast-icon';
const STYLE_FORECAST_DATABOX = 'weather-forecast-databox';
const STYLE_FORECAST_DAY = 'weather-forecast-day';
const STYLE_FORECAST_SUMMARY = 'weather-forecast-summary';
const STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature';
const STYLE_FORECAST_BOX = 'weather-forecast-box';
const STYLE_FORECAST_CONTAINER = 'weather-forecast-container';
const STYLE_FORECAST = 'forecast';
class UIForecasts {
    constructor(app) {
        this.DayClicked = new Event();
        this.DayHovered = new Event();
        this.app = app;
        this.actor = new uiForecasts_Bin({ style_class: STYLE_FORECAST });
        this.DayClickedCallback = (s, e) => this.OnDayClicked(s, e);
        this.DayHoveredCallback = (s, e) => this.OnDayHovered(s, e);
    }
    UpdateIconType(iconType) {
        var _a;
        if (!this.forecasts)
            return;
        for (let i = 0; i < this.forecasts.length; i++) {
            if (!((_a = this.forecasts[i]) === null || _a === void 0 ? void 0 : _a.Icon))
                continue;
            this.forecasts[i].Icon.icon_type = iconType;
        }
    }
    Display(weather, config) {
        try {
            if (!weather.forecasts)
                return false;
            let len = Math.min(this.forecasts.length, weather.forecasts.length);
            for (let i = 0; i < len; i++) {
                let forecastData = weather.forecasts[i];
                let forecastUi = this.forecasts[i];
                let comment = (config._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
                let dayName = GetDayName(forecastData.date, config.currentLocale, config._showForecastDates, weather.location.timeZone);
                forecastUi.Day.actor.label = dayName;
                forecastUi.Day.Hovered.Unsubscribe(this.DayHoveredCallback);
                forecastUi.Day.Clicked.Unsubscribe(this.DayClickedCallback);
                let hasHourlyWeather = false;
                if (weather.hourlyForecasts != null) {
                    for (let index = 0; index < this.app.GetMaxHourlyForecasts(); index++) {
                        const element = weather.hourlyForecasts[index];
                        if (!element)
                            break;
                        if (OnSameDay(element.date, forecastData.date)) {
                            hasHourlyWeather = true;
                            break;
                        }
                    }
                }
                forecastUi.Day.ID = forecastData.date;
                if (hasHourlyWeather) {
                    forecastUi.Day.enable();
                    forecastUi.Day.Hovered.Subscribe(this.DayHoveredCallback);
                    forecastUi.Day.Clicked.Subscribe(this.DayClickedCallback);
                }
                else {
                    forecastUi.Day.disable();
                }
                forecastUi.Temperature.text = TempRangeToUserConfig(forecastData.temp_min, forecastData.temp_max, config);
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = (config._useCustomMenuIcons) ? forecastData.condition.customIcon : WeatherIconSafely(forecastData.condition.icons, config.IconType);
            }
            return true;
        }
        catch (e) {
            this.app.ShowError({
                type: "hard",
                detail: "unknown",
                message: "Forecast parsing failed: " + e.toString(),
                userError: false
            });
            logger_Logger.Error("DisplayForecastError " + e, e);
            return false;
        }
    }
    ;
    Rebuild(config, textColorStyle) {
        this.Destroy();
        this.forecasts = [];
        this.grid = new GridLayout({
            orientation: config._verticalOrientation
        });
        this.grid.set_column_homogeneous(true);
        let table = new Widget({
            layout_manager: this.grid,
            style_class: STYLE_FORECAST_CONTAINER
        });
        this.actor.set_child(table);
        let maxDays = this.app.GetMaxForecastDays();
        let maxRow = config._forecastRows;
        let maxCol = config._forecastColumns;
        if (config._verticalOrientation) {
            [maxRow, maxCol] = [maxCol, maxRow];
        }
        let curRow = 0;
        let curCol = 0;
        for (let i = 0; i < maxDays; i++) {
            let forecastWeather = {};
            if (curCol >= maxCol) {
                curRow++;
                curCol = 0;
            }
            if (curRow >= maxRow)
                break;
            forecastWeather.Icon = new uiForecasts_Icon({
                icon_type: config.IconType,
                icon_size: 48,
                icon_name: APPLET_ICON,
                style_class: STYLE_FORECAST_ICON
            });
            forecastWeather.Day = new WeatherButton({
                style_class: STYLE_FORECAST_DAY,
                reactive: true,
                style: textColorStyle,
                label: ""
            }, true);
            forecastWeather.Day.disable();
            forecastWeather.Summary = new uiForecasts_Label({
                style_class: STYLE_FORECAST_SUMMARY,
                reactive: true
            });
            forecastWeather.Temperature = new uiForecasts_Label({
                style_class: STYLE_FORECAST_TEMPERATURE
            });
            let by = new uiForecasts_BoxLayout({
                vertical: true,
                style_class: STYLE_FORECAST_DATABOX
            });
            by.add(forecastWeather.Day.actor, { x_align: imports.gi.St.Align.START, expand: false, x_fill: false });
            by.add_actor(forecastWeather.Summary);
            by.add_actor(forecastWeather.Temperature);
            let bb = new uiForecasts_BoxLayout({
                style_class: STYLE_FORECAST_BOX
            });
            bb.add_actor(forecastWeather.Icon);
            bb.add_actor(by);
            this.forecasts[i] = forecastWeather;
            if (!config._verticalOrientation) {
                this.grid.attach(bb, curCol, curRow, 1, 1);
            }
            else {
                this.grid.attach(bb, curRow, curCol, 1, 1);
            }
            curCol++;
        }
    }
    Destroy() {
        if (this.actor.get_child() != null)
            this.actor.get_child().destroy();
    }
    OnDayHovered(sender, event) {
        logger_Logger.Debug("Day Hovered: " + sender.ID.toJSDate().toDateString());
        this.DayHovered.Invoke(sender, sender.ID);
    }
    OnDayClicked(sender, event) {
        logger_Logger.Debug("Day Clicked: " + sender.ID.toJSDate().toDateString());
        this.DayClicked.Invoke(sender, sender.ID);
    }
}

;// CONCATENATED MODULE: ./src/3_8/ui_elements/uiHourlyForecasts.ts



const { PolicyType } = imports.gi.Gtk;
const { addTween } = imports.ui.tweener;
const { BoxLayout: uiHourlyForecasts_BoxLayout, Side, Label: uiHourlyForecasts_Label, ScrollView, Icon: uiHourlyForecasts_Icon, Align: uiHourlyForecasts_Align } = imports.gi.St;
class UIHourlyForecasts {
    constructor(app, menu) {
        this.hourlyForecasts = [];
        this.hourlyContainers = [];
        this.hourlyToggled = false;
        this.app = app;
        this.actor = new ScrollView({
            hscrollbar_policy: PolicyType.AUTOMATIC,
            vscrollbar_policy: PolicyType.NEVER,
            x_fill: true,
            y_fill: true,
            y_align: uiHourlyForecasts_Align.MIDDLE,
            x_align: uiHourlyForecasts_Align.MIDDLE
        });
        this.actor.overlay_scrollbars = true;
        let vScroll = this.actor.get_vscroll_bar();
        vScroll.connect("scroll-start", () => { menu.passEvents = true; });
        vScroll.connect("scroll-stop", () => { menu.passEvents = false; });
        let hScroll = this.actor.get_hscroll_bar();
        hScroll.connect("scroll-start", () => { menu.passEvents = true; });
        hScroll.connect("scroll-stop", () => { menu.passEvents = false; });
        this.actor.hide();
        this.actor.set_clip_to_allocation(true);
        this.container = new uiHourlyForecasts_BoxLayout({ style_class: "hourly-box" });
        this.actor.add_actor(this.container);
    }
    get Toggled() {
        return this.hourlyToggled;
    }
    ScrollTo(date) {
        if (this.hourlyForecastDates == null)
            return;
        let itemWidth = this.GetHourlyBoxItemWidth();
        let midnightIndex = null;
        for (let index = 0; index < this.hourlyForecastDates.length; index++) {
            if (OnSameDay(this.hourlyForecastDates[index], date))
                midnightIndex = index;
            if (OnSameDay(this.hourlyForecastDates[index].minus({ hours: 6 }), date)) {
                this.actor.get_hscroll_bar().get_adjustment().set_value(index * itemWidth);
                break;
            }
        }
        if (midnightIndex != null)
            this.actor.get_hscroll_bar().get_adjustment().set_value(midnightIndex * itemWidth);
    }
    UpdateIconType(iconType) {
        var _a;
        if (!this.hourlyForecasts)
            return;
        for (let i = 0; i < this.hourlyForecasts.length; i++) {
            if (!((_a = this.hourlyForecasts[i]) === null || _a === void 0 ? void 0 : _a.Icon))
                continue;
            this.hourlyForecasts[i].Icon.icon_type = iconType;
        }
    }
    Display(forecasts, config, tz) {
        var _a;
        if (!forecasts || !this.hourlyForecasts)
            return true;
        this.hourlyForecastDates = [];
        let max = Math.min(forecasts.length, this.hourlyForecasts.length);
        for (let index = 0; index < max; index++) {
            const hour = forecasts[index];
            const ui = this.hourlyForecasts[index];
            this.hourlyForecastDates.push(hour.date);
            ui.Hour.text = GetHoursMinutes(hour.date, config.currentLocale, config._show24Hours, tz, config._shortHourlyTime);
            ui.Temperature.text = (_a = TempToUserConfig(hour.temp, config)) !== null && _a !== void 0 ? _a : "";
            ui.Icon.icon_name = (config._useCustomMenuIcons) ? hour.condition.customIcon : WeatherIconSafely(hour.condition.icons, config.IconType);
            ui.Summary.text = hour.condition.main;
            ui.Precipitation.text = this.GeneratePrecipitationText(hour.precipitation, config);
        }
        this.AdjustHourlyBoxItemWidth();
        return !(max <= 0);
    }
    async Show() {
        this.actor.show();
        this.actor.hide();
        this.AdjustHourlyBoxItemWidth();
        let [minWidth, naturalWidth] = this.actor.get_preferred_width(-1);
        let [minHeight, naturalHeight] = this.actor.get_preferred_height(minWidth);
        logger_Logger.Debug("hourlyScrollView requested height and is set to: " + naturalHeight);
        this.actor.set_width(minWidth);
        this.actor.show();
        this.actor.style = "min-height: " + naturalHeight.toString() + "px;";
        this.hourlyToggled = true;
        return new Promise((resolve, reject) => {
            if (global.settings.get_boolean("desktop-effects-on-menus")) {
                this.actor.height = 0;
                addTween(this.actor, {
                    height: naturalHeight,
                    time: 0.25,
                    onUpdate: () => { },
                    onComplete: () => {
                        this.actor.set_height(naturalHeight);
                        resolve();
                    }
                });
            }
            else {
                this.actor.set_height(naturalHeight);
                resolve();
            }
        });
    }
    async Hide() {
        let hscroll = this.actor.get_hscroll_bar();
        this.hourlyToggled = false;
        return new Promise((resolve, reject) => {
            if (global.settings.get_boolean("desktop-effects-on-menus")) {
                addTween(this.actor, {
                    height: 0,
                    time: 0.25,
                    onUpdate: () => { },
                    onComplete: () => {
                        this.actor.set_height(-1);
                        this.actor.style = "";
                        this.actor.hide();
                        hscroll.get_adjustment().set_value(0);
                        resolve();
                    }
                });
            }
            else {
                this.actor.style = "";
                this.actor.set_height(-1);
                this.actor.hide();
                resolve();
            }
        });
    }
    AdjustHourlyBoxItemWidth() {
        let requiredWidth = this.GetHourlyBoxItemWidth();
        for (let index = 0; index < this.hourlyContainers.length; index++) {
            const element = this.hourlyContainers[index];
            element.set_width(requiredWidth);
        }
    }
    GetHourlyBoxItemWidth() {
        let requiredWidth = 0;
        if (!this.hourlyForecasts)
            return requiredWidth;
        for (let index = 0; index < this.hourlyContainers.length; index++) {
            const ui = this.hourlyForecasts[index];
            let hourWidth = ui.Hour.get_preferred_width(-1)[1];
            let iconWidth = ui.Icon.get_preferred_width(-1)[1];
            let summaryWidth = ui.Summary.get_preferred_width(-1)[1];
            let temperatureWidth = ui.Temperature.get_preferred_width(-1)[1];
            let precipitationWidth = ui.Precipitation.get_preferred_width(-1)[1];
            if (precipitationWidth > iconWidth || summaryWidth > iconWidth) {
                if (precipitationWidth > summaryWidth)
                    precipitationWidth += 10;
                else
                    summaryWidth += 10;
            }
            if (requiredWidth < hourWidth)
                requiredWidth = hourWidth;
            if (requiredWidth < iconWidth)
                requiredWidth = iconWidth;
            if (requiredWidth < summaryWidth)
                requiredWidth = summaryWidth;
            if (requiredWidth < temperatureWidth)
                requiredWidth = temperatureWidth;
            if (requiredWidth < precipitationWidth)
                requiredWidth = precipitationWidth;
        }
        return requiredWidth;
    }
    Destroy() {
        this.container.destroy_all_children();
    }
    Rebuild(config, textColorStyle) {
        this.Destroy();
        let hours = this.app.GetMaxHourlyForecasts();
        this.hourlyForecasts = [];
        this.hourlyContainers = [];
        for (let index = 0; index < hours; index++) {
            let box = new uiHourlyForecasts_BoxLayout({ vertical: true, style_class: "hourly-box-item" });
            this.hourlyContainers.push(box);
            this.hourlyForecasts.push({
                Hour: new uiHourlyForecasts_Label({ text: "Hour", style_class: "hourly-time", style: textColorStyle }),
                Icon: new uiHourlyForecasts_Icon({
                    icon_type: config.IconType,
                    icon_size: 24,
                    icon_name: APPLET_ICON,
                    style_class: "hourly-icon"
                }),
                Precipitation: new uiHourlyForecasts_Label({ text: " ", style_class: "hourly-data" }),
                Summary: new uiHourlyForecasts_Label({ text: _(ELLIPSIS), style_class: "hourly-data" }),
                Temperature: new uiHourlyForecasts_Label({ text: _(ELLIPSIS), style_class: "hourly-data" })
            });
            this.hourlyForecasts[index].Summary.clutter_text.set_line_wrap(true);
            box.add_child(this.hourlyForecasts[index].Hour);
            box.add_child(this.hourlyForecasts[index].Icon);
            box.add_child(this.hourlyForecasts[index].Summary);
            box.add_child(this.hourlyForecasts[index].Temperature);
            box.add_child(this.hourlyForecasts[index].Precipitation);
            this.container.add(box, {
                x_fill: true,
                x_align: uiHourlyForecasts_Align.MIDDLE,
                y_align: uiHourlyForecasts_Align.MIDDLE,
                y_fill: true,
                expand: true
            });
        }
    }
    GeneratePrecipitationText(precip, config) {
        if (!precip)
            return "";
        let precipitationText = "";
        if (!!precip.volume && precip.volume > 0) {
            precipitationText = MillimeterToUserUnits(precip.volume, config.DistanceUnit) + " " + ((config.DistanceUnit == "metric") ? _("mm") : _("in"));
        }
        if (!!precip.chance) {
            precipitationText = (NotEmpty(precipitationText)) ? (precipitationText + ", ") : "";
            precipitationText += (Math.round(precip.chance).toString() + "%");
        }
        return precipitationText;
    }
    GetScrollViewHeight() {
        let boxItemHeight = 0;
        if (!this.hourlyForecasts)
            return boxItemHeight;
        for (let index = 0; index < this.hourlyContainers.length; index++) {
            const ui = this.hourlyForecasts[index];
            logger_Logger.Debug("Height requests of Hourly box Items: " + index);
            let hourHeight = ui.Hour.get_preferred_height(-1)[1];
            let iconHeight = ui.Icon.get_preferred_height(-1)[1];
            let summaryHeight = ui.Summary.get_preferred_height(-1)[1];
            let temperatureHeight = ui.Temperature.get_preferred_height(-1)[1];
            let precipitationHeight = ui.Precipitation.get_preferred_height(-1)[1];
            let itemHeight = hourHeight + iconHeight + summaryHeight + temperatureHeight + precipitationHeight;
            if (boxItemHeight < itemHeight)
                boxItemHeight = itemHeight;
        }
        logger_Logger.Debug("Final Hourly box item height is: " + boxItemHeight);
        let scrollBarHeight = this.actor.get_hscroll_bar().get_preferred_width(-1)[1];
        logger_Logger.Debug("Scrollbar height is " + scrollBarHeight);
        let theme = this.container.get_theme_node();
        let styling = theme.get_margin(Side.TOP) + theme.get_margin(Side.BOTTOM) + theme.get_padding(Side.TOP) + theme.get_padding(Side.BOTTOM);
        logger_Logger.Debug("ScollbarBox vertical padding and margin is: " + styling);
        return (boxItemHeight + scrollBarHeight + styling);
    }
}

;// CONCATENATED MODULE: ./src/3_8/ui_elements/uiBar.ts






const { BoxLayout: uiBar_BoxLayout, IconType: uiBar_IconType, Label: uiBar_Label, Icon: uiBar_Icon, Align: uiBar_Align, } = imports.gi.St;
const STYLE_BAR = 'bottombar';
class UIBar {
    constructor(app) {
        this.ToggleClicked = new Event();
        this.app = app;
        this.actor = new uiBar_BoxLayout({ vertical: false, style_class: STYLE_BAR });
    }
    get Actor() {
        return this.actor;
    }
    SwitchButtonToShow() {
        var _a;
        if (!!((_a = this.hourlyButton) === null || _a === void 0 ? void 0 : _a.actor.child))
            this.hourlyButton.actor.child.icon_name = "custom-down-arrow-symbolic";
    }
    SwitchButtonToHide() {
        var _a;
        if (!!((_a = this.hourlyButton) === null || _a === void 0 ? void 0 : _a.actor.child))
            this.hourlyButton.actor.child.icon_name = "custom-up-arrow-symbolic";
    }
    DisplayErrorMessage(msg) {
        this._timestamp.text = msg;
    }
    Display(weather, provider, config, shouldShowToggle) {
        this.providerCreditButton.actor.label = _("Powered by") + " " + provider.prettyName;
        this.providerCreditButton.url = provider.website;
        let lastUpdatedTime = AwareDateString(weather.date, config.currentLocale, config._show24Hours, DateTime.local().zoneName);
        this._timestamp.text = _("As of {lastUpdatedTime}", { "lastUpdatedTime": lastUpdatedTime });
        if (weather.location.distanceFrom != null) {
            let stringFormat = {
                distance: MetreToUserUnits(weather.location.distanceFrom, config.DistanceUnit).toString(),
                distanceUnit: this.BigDistanceUnitFor(config.DistanceUnit)
            };
            this._timestamp.text += `, ${_("{distance}{distanceUnit} from you", stringFormat)}`;
        }
        if (!shouldShowToggle)
            this.HideHourlyToggle();
        return true;
    }
    Destroy() {
        this.actor.destroy_all_children();
    }
    Rebuild(config) {
        this.Destroy();
        this._timestamp = new uiBar_Label({ text: "Placeholder" });
        this.actor.add(this._timestamp, {
            x_fill: false,
            x_align: uiBar_Align.START,
            y_align: uiBar_Align.MIDDLE,
            y_fill: false,
            expand: true
        });
        this.hourlyButton = new WeatherButton({
            reactive: true,
            can_focus: true,
            child: new uiBar_Icon({
                icon_type: uiBar_IconType.SYMBOLIC,
                icon_size: config.CurrentFontSize + 3,
                icon_name: "custom-down-arrow-symbolic",
                style: "margin: 2px 5px;"
            }),
        });
        this.hourlyButton.actor.connect(SIGNAL_CLICKED, () => this.ToggleClicked.Invoke(this, true));
        this.actor.add(this.hourlyButton.actor, {
            x_fill: false,
            x_align: uiBar_Align.MIDDLE,
            y_align: uiBar_Align.MIDDLE,
            y_fill: false,
            expand: true
        });
        if (this.app.GetMaxHourlyForecasts() <= 0) {
            this.HideHourlyToggle();
        }
        this.providerCreditButton = new WeatherButton({ label: _(ELLIPSIS), reactive: true });
        this.providerCreditButton.actor.connect(SIGNAL_CLICKED, () => OpenUrl(this.providerCreditButton));
        this.actor.add(this.providerCreditButton.actor, {
            x_fill: false,
            x_align: uiBar_Align.END,
            y_align: uiBar_Align.MIDDLE,
            y_fill: false,
            expand: true
        });
    }
    BigDistanceUnitFor(unit) {
        if (unit == "imperial")
            return _("mi");
        return _("km");
    }
    HideHourlyToggle() {
        if (this.hourlyButton != null)
            this.hourlyButton.actor.child = null;
    }
}

;// CONCATENATED MODULE: ./src/3_8/ui_elements/uiSeparator.ts
const { PopupSeparatorMenuItem } = imports.ui.popupMenu;
class UISeparator {
    constructor() {
        this.actor = new PopupSeparatorMenuItem();
        this.actor.actor.remove_style_class_name("popup-menu-item");
    }
    get Actor() {
        return this.actor.actor;
    }
    Show() {
        this.actor.actor.show();
    }
    Hide() {
        this.actor.actor.hide();
    }
}

;// CONCATENATED MODULE: ./src/3_8/ui.ts







const { PopupMenuManager } = imports.ui.popupMenu;
const { BoxLayout: ui_BoxLayout, IconType: ui_IconType, Label: ui_Label } = imports.gi.St;
const ui_Lang = imports.lang;
const { AppletPopupMenu } = imports.ui.applet;
const { themeManager } = imports.ui.main;
const { SignalManager: ui_SignalManager } = imports.misc.signalManager;
const STYLE_WEATHER_MENU = 'weather-menu';
class UI {
    constructor(app, orientation) {
        this.lightTheme = false;
        this.lastDateToggled = undefined;
        this.App = app;
        this.menuManager = new PopupMenuManager(this.App);
        this.menu = new AppletPopupMenu(this.App, orientation);
        this.menu.box.add_style_class_name(STYLE_WEATHER_MENU);
        logger_Logger.Debug("Popup Menu applied classes are: " + this.menu.box.get_style_class_name());
        this.menuManager.addMenu(this.menu);
        this.menuManager._signals.connect(this.menu, "open-state-changed", this.PopupMenuToggled, this);
        this.signals = new ui_SignalManager();
        this.lightTheme = this.IsLightTheme();
        this.BuildPopupMenu();
        this.signals.connect(themeManager, 'theme-set', this.OnThemeChanged, this);
    }
    Toggle() {
        this.menu.toggle();
    }
    async ToggleHourlyWeather() {
        if (this.HourlyWeather.Toggled) {
            await this.HideHourlyWeather();
        }
        else {
            await this.ShowHourlyWeather();
        }
    }
    Rebuild(config) {
        this.ShowLoadingUi();
        let textColorStyle = this.GetTextColorStyle();
        this.CurrentWeather.Rebuild(config, textColorStyle);
        this.HourlyWeather.Rebuild(config, textColorStyle);
        this.FutureWeather.Rebuild(config, textColorStyle);
        this.Bar.Rebuild(config);
    }
    UpdateIconType(iconType) {
        if (iconType == ui_IconType.FULLCOLOR && this.App.config._useCustomMenuIcons)
            return;
        this.CurrentWeather.UpdateIconType(iconType);
        this.FutureWeather.UpdateIconType(iconType);
        this.HourlyWeather.UpdateIconType(iconType);
    }
    DisplayErrorMessage(msg, errorType) {
        this.Bar.DisplayErrorMessage(msg);
    }
    Display(weather, config, provider) {
        this.CurrentWeather.Display(weather, config);
        this.FutureWeather.Display(weather, config);
        let shouldShowToggle = this.HourlyWeather.Display(weather.hourlyForecasts, config, weather.location.timeZone);
        this.Bar.Display(weather, provider, config, shouldShowToggle);
        return true;
    }
    OnThemeChanged() {
        this.HideHourlyWeather();
        let newThemeIsLight = this.IsLightTheme();
        if (newThemeIsLight != this.lightTheme) {
            this.lightTheme = newThemeIsLight;
        }
        this.App.RefreshAndRebuild();
    }
    async PopupMenuToggled(caller, data) {
        if (data == false) {
            await delay(100);
            this.HideHourlyWeather();
        }
    }
    IsLightTheme() {
        let color = this.menu.actor.get_theme_node().get_color("color");
        let luminance = (2126 * color.red + 7152 * color.green + 722 * color.blue) / 10000 / 255;
        luminance = Math.abs(1 - luminance);
        logger_Logger.Debug("Theme is Light: " + (luminance > 0.5));
        return (luminance > 0.5);
    }
    ForegroundColor() {
        let hex = this.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
        return hex;
    }
    GetTextColorStyle() {
        let hexColor = null;
        if (this.lightTheme) {
            hexColor = ShadeHexColor(this.ForegroundColor(), -0.40);
        }
        return "color: " + hexColor;
    }
    BuildPopupMenu() {
        this.CurrentWeather = new CurrentWeather(this.App);
        this.FutureWeather = new UIForecasts(this.App);
        this.HourlyWeather = new UIHourlyForecasts(this.App, this.menu);
        this.FutureWeather.DayClicked.Subscribe((s, e) => this.OnDayClicked(s, e));
        this.Bar = new UIBar(this.App);
        this.Bar.ToggleClicked.Subscribe(ui_Lang.bind(this, this.ToggleHourlyWeather));
        this.ForecastSeparator = new UISeparator();
        this.HourlySeparator = new UISeparator();
        this.BarSeparator = new UISeparator();
        this.HourlySeparator.Hide();
        let mainBox = new ui_BoxLayout({ vertical: true });
        mainBox.add_actor(this.CurrentWeather.actor);
        mainBox.add_actor(this.HourlySeparator.Actor);
        mainBox.add_actor(this.HourlyWeather.actor);
        mainBox.add_actor(this.ForecastSeparator.Actor);
        mainBox.add_actor(this.FutureWeather.actor);
        mainBox.add_actor(this.BarSeparator.Actor);
        mainBox.add_actor(this.Bar.Actor);
        this.menu.addActor(mainBox);
    }
    ShowLoadingUi() {
        this.CurrentWeather.Destroy();
        this.FutureWeather.Destroy();
        this.Bar.Destroy();
        this.CurrentWeather.actor.set_child(new ui_Label({
            text: _('Loading current weather ...')
        }));
        this.FutureWeather.actor.set_child(new ui_Label({
            text: _('Loading future weather ...')
        }));
    }
    async OnDayClicked(sender, date) {
        var _a;
        if (!this.HourlyWeather.Toggled)
            await this.ShowHourlyWeather();
        else if ((_a = this.lastDateToggled) === null || _a === void 0 ? void 0 : _a.equals(date)) {
            await this.HideHourlyWeather();
            return;
        }
        this.HourlyWeather.ScrollTo(date);
        this.lastDateToggled = date;
    }
    async ShowHourlyWeather() {
        this.HourlySeparator.Show();
        this.Bar.SwitchButtonToHide();
        await this.HourlyWeather.Show();
    }
    async HideHourlyWeather() {
        this.lastDateToggled = undefined;
        this.HourlySeparator.Hide();
        this.Bar.SwitchButtonToShow();
        await this.HourlyWeather.Hide();
    }
}

;// CONCATENATED MODULE: ./src/3_8/providers/darkSky.ts



const darkSky_Lang = imports.lang;
class DarkSky {
    constructor(_app) {
        this.prettyName = _("DarkSky");
        this.name = "DarkSky";
        this.maxForecastSupport = 8;
        this.website = "https://darksky.net/poweredby/";
        this.maxHourlyForecastSupport = 168;
        this.needsApiKey = true;
        this.descriptionLineLength = 25;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
            'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
            'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'
        ];
        this.query = "https://api.darksky.net/forecast/";
        this.DarkSkyFilterWords = [_("and"), _("until"), _("in"), _("Possible")];
        this.unit = "si";
        this.app = _app;
    }
    async GetWeather(loc) {
        let now = new Date(Date.now());
        if (now.getUTCFullYear() >= 2022) {
            this.app.ShowError({
                type: "hard",
                detail: "no api response",
                message: _("This API has ceased to function, please use another one.")
            });
            return null;
        }
        let query = this.ConstructQuery(loc);
        if (query == "" && query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query, {}, darkSky_Lang.bind(this, this.HandleError));
        if (!json)
            return null;
        if (!json.code) {
            return this.ParseWeather(json);
        }
        else {
            this.HandleResponseErrors(json);
            return null;
        }
    }
    ;
    ParseWeather(json) {
        try {
            let sunrise = DateTime.fromSeconds(json.daily.data[0].sunriseTime, { zone: json.timezone });
            let sunset = DateTime.fromSeconds(json.daily.data[0].sunsetTime, { zone: json.timezone });
            let result = {
                date: DateTime.fromSeconds(json.currently.time, { zone: json.timezone }),
                coord: {
                    lat: json.latitude,
                    lon: json.longitude
                },
                location: {
                    url: "https://darksky.net/forecast/" + json.latitude + "," + json.longitude,
                    timeZone: json.timezone,
                },
                sunrise: sunrise,
                sunset: sunset,
                wind: {
                    speed: this.ToMPS(json.currently.windSpeed),
                    degree: json.currently.windBearing
                },
                temperature: this.ToKelvin(json.currently.temperature),
                pressure: json.currently.pressure,
                humidity: json.currently.humidity * 100,
                condition: {
                    main: this.GetShortCurrentSummary(json.currently.summary),
                    description: json.currently.summary,
                    icons: this.ResolveIcon(json.currently.icon, { sunrise: sunrise, sunset: sunset }),
                    customIcon: this.ResolveCustomIcon(json.currently.icon)
                },
                extra_field: {
                    name: _("Feels Like"),
                    value: this.ToKelvin(json.currently.apparentTemperature),
                    type: "temperature"
                },
                forecasts: [],
                hourlyForecasts: []
            };
            for (let i = 0; i < json.daily.data.length; i++) {
                let day = json.daily.data[i];
                let forecast = {
                    date: DateTime.fromSeconds(day.time, { zone: json.timezone }),
                    temp_min: this.ToKelvin(day.temperatureLow),
                    temp_max: this.ToKelvin(day.temperatureHigh),
                    condition: {
                        main: this.GetShortSummary(day.summary),
                        description: this.ProcessSummary(day.summary),
                        icons: this.ResolveIcon(day.icon),
                        customIcon: this.ResolveCustomIcon(day.icon)
                    },
                };
                forecast.date = forecast.date.set({ hour: 12 });
                result.forecasts.push(forecast);
            }
            for (let i = 0; i < json.hourly.data.length; i++) {
                let hour = json.hourly.data[i];
                let forecast = {
                    date: DateTime.fromSeconds(hour.time, { zone: json.timezone }),
                    temp: this.ToKelvin(hour.temperature),
                    condition: {
                        main: this.GetShortSummary(hour.summary),
                        description: this.ProcessSummary(hour.summary),
                        icons: this.ResolveIcon(hour.icon, { sunrise: sunrise, sunset: sunset }, DateTime.fromSeconds(hour.time, { zone: json.timezone })),
                        customIcon: this.ResolveCustomIcon(hour.icon)
                    },
                    precipitation: {
                        type: hour.precipType,
                        volume: hour.precipProbability,
                        chance: hour.precipProbability * 100
                    }
                };
                result.hourlyForecasts.push(forecast);
            }
            return result;
        }
        catch (e) {
            logger_Logger.Error("DarkSky payload parsing error: " + e, e);
            this.app.ShowError({ type: "soft", detail: "unusual payload", service: "darksky", message: _("Failed to Process Weather Info") });
            return null;
        }
    }
    ;
    ConvertToAPILocale(systemLocale) {
        if (systemLocale == null)
            return "en";
        if (systemLocale == "zh-tw") {
            return systemLocale;
        }
        let lang = systemLocale.split("-")[0];
        return lang;
    }
    ConstructQuery(loc) {
        this.SetQueryUnit();
        let query = this.query + this.app.config.ApiKey + "/" + loc.lat.toString() + "," + loc.lon.toString() + "?exclude=minutely,flags" + "&units=" + this.unit;
        let locale = this.ConvertToAPILocale(this.app.config.currentLocale);
        if (IsLangSupported(locale, this.supportedLanguages) && this.app.config._translateCondition) {
            query = query + "&lang=" + locale;
        }
        return query;
    }
    HandleError(message) {
        if (message.code == 403) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "bad key",
                service: "darksky",
                message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
            });
            return false;
        }
        else if (message.code == 401) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "no key",
                service: "darksky",
                message: _("Please Make sure you\nentered the API key that you have from DarkSky")
            });
            return false;
        }
        return true;
    }
    HandleResponseErrors(json) {
        let code = json.code;
        let error = json.error;
        let errorMsg = "DarkSky API: ";
        logger_Logger.Debug("DarksSky API error payload: " + json);
        switch (code) {
            case "400":
                logger_Logger.Error(errorMsg + error);
                break;
            default:
                logger_Logger.Error(errorMsg + error);
                break;
        }
    }
    ;
    ProcessSummary(summary) {
        let processed = summary.split(" ");
        let result = "";
        let lineLength = 0;
        for (let i = 0; i < processed.length; i++) {
            if (lineLength + processed[i].length > this.descriptionLineLength) {
                result = result + "\n";
                lineLength = 0;
            }
            result = result + processed[i] + " ";
            lineLength = lineLength + processed[i].length + 1;
        }
        return result;
    }
    ;
    GetShortSummary(summary) {
        let processed = summary.split(" ");
        if (processed.length == 1)
            return processed[0];
        let result = [];
        for (let i = 0; i < processed.length; i++) {
            if (!/[\(\)]/.test(processed[i]) && !this.WordBanned(processed[i])) {
                result.push(processed[i]) + " ";
            }
            if (result.length == 2)
                break;
        }
        return result.join(" ");
    }
    ;
    GetShortCurrentSummary(summary) {
        let processed = summary.split(" ");
        let result = "";
        let maxLoop;
        (processed.length < 2) ? maxLoop = processed.length : maxLoop = 2;
        for (let i = 0; i < maxLoop; i++) {
            if (processed[i] != "and") {
                result = result + processed[i] + " ";
            }
        }
        return result;
    }
    WordBanned(word) {
        return this.DarkSkyFilterWords.includes(word);
    }
    ResolveIcon(icon, sunTimes, date) {
        switch (icon) {
            case "rain":
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case "snow":
                return ["weather-snow"];
            case "sleet":
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case "fog":
                return ["weather-fog"];
            case "wind":
                return (sunTimes && IsNight(sunTimes, date)) ? ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"];
            case "cloudy":
                return (sunTimes && IsNight(sunTimes, date)) ? ["weather-overcast", "weather-clouds", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"];
            case "partly-cloudy-night":
                return ["weather-few-clouds-night"];
            case "partly-cloudy-day":
                return ["weather-few-clouds"];
            case "clear-night":
                return ["weather-clear-night"];
            case "clear-day":
                return ["weather-clear"];
            case "storm":
                return ["weather-storm"];
            case "showers":
                return ["weather-showers", "weather-showers-scattered"];
            default:
                return ["weather-severe-alert"];
        }
    }
    ;
    ResolveCustomIcon(icon) {
        switch (icon) {
            case "rain":
                return "rain-symbolic";
            case "snow":
                return "snow-symbolic";
            case "fog":
                return "fog-symbolic";
            case "cloudy":
                return "cloudy-symbolic";
            case "partly-cloudy-night":
                return "night-alt-cloudy-symbolic";
            case "partly-cloudy-day":
                return "day-cloudy-symbolic";
            case "clear-night":
                return "night-clear-symbolic";
            case "clear-day":
                return "day-sunny-symbolic";
            case "storm":
                return "thunderstorm-symbolic";
            case "showers":
                return "showers-symbolic";
            case "wind":
                return "strong-wind-symbolic";
            default:
                return "cloud-refresh-symbolic";
        }
    }
    SetQueryUnit() {
        if (this.app.config.TemperatureUnit == "celsius") {
            if (this.app.config.WindSpeedUnit == "kph" || this.app.config.WindSpeedUnit == "m/s") {
                this.unit = 'si';
            }
            else {
                this.unit = 'uk2';
            }
        }
        else {
            this.unit = 'us';
        }
    }
    ;
    ToKelvin(temp) {
        if (this.unit == 'us') {
            return FahrenheitToKelvin(temp);
        }
        else {
            return CelsiusToKelvin(temp);
        }
    }
    ;
    ToMPS(speed) {
        if (this.unit == 'si') {
            return speed;
        }
        else {
            return MPHtoMPS(speed);
        }
    }
    ;
}
;

;// CONCATENATED MODULE: ./src/3_8/providers/openWeatherMap.ts



class OpenWeatherMap {
    constructor(_app) {
        this.prettyName = _("OpenWeatherMap");
        this.name = "OpenWeatherMap";
        this.maxForecastSupport = 8;
        this.website = "https://openweathermap.org/";
        this.maxHourlyForecastSupport = 48;
        this.needsApiKey = false;
        this.supportedLanguages = ["af", "al", "ar", "az", "bg", "ca", "cz", "da", "de", "el", "en", "eu", "fa", "fi",
            "fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "kr", "la", "lt", "mk", "no", "nl", "pl",
            "pt", "pt_br", "ro", "ru", "se", "sk", "sl", "sp", "es", "sr", "th", "tr", "ua", "uk", "vi", "zh_cn", "zh_tw", "zu"
        ];
        this.base_url = "https://api.openweathermap.org/data/2.5/onecall?";
        this.HandleError = (error) => {
            if (error.code == 404) {
                this.app.ShowError({
                    detail: "location not found",
                    message: _("Location not found, make sure location is available or it is in the correct format"),
                    userError: true,
                    type: "hard"
                });
                return false;
            }
            return true;
        };
        this.app = _app;
    }
    async GetWeather(loc) {
        let query = this.ConstructQuery(this.base_url, loc);
        if (query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query, {}, this.HandleError);
        if (!json)
            return null;
        if (this.HadErrors(json))
            return null;
        return this.ParseWeather(json, loc);
    }
    ;
    ParseWeather(json, loc) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        try {
            let weather = {
                coord: {
                    lat: json.lat,
                    lon: json.lon
                },
                location: {
                    url: "https://openweathermap.org/city/",
                    timeZone: json.timezone
                },
                date: DateTime.fromSeconds(json.current.dt, { zone: json.timezone }),
                sunrise: DateTime.fromSeconds(json.current.sunrise, { zone: json.timezone }),
                sunset: DateTime.fromSeconds(json.current.sunset, { zone: json.timezone }),
                wind: {
                    speed: json.current.wind_speed,
                    degree: json.current.wind_deg
                },
                temperature: json.current.temp,
                pressure: json.current.pressure,
                humidity: json.current.humidity,
                condition: {
                    main: (_c = (_b = (_a = json === null || json === void 0 ? void 0 : json.current) === null || _a === void 0 ? void 0 : _a.weather) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.main,
                    description: (_f = (_e = (_d = json === null || json === void 0 ? void 0 : json.current) === null || _d === void 0 ? void 0 : _d.weather) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.description,
                    icons: this.ResolveIcon((_j = (_h = (_g = json === null || json === void 0 ? void 0 : json.current) === null || _g === void 0 ? void 0 : _g.weather) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.icon),
                    customIcon: this.ResolveCustomIcon((_m = (_l = (_k = json === null || json === void 0 ? void 0 : json.current) === null || _k === void 0 ? void 0 : _k.weather) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.icon)
                },
                extra_field: {
                    name: _("Feels Like"),
                    value: json.current.feels_like,
                    type: "temperature"
                },
                forecasts: []
            };
            if (json.minutely != null) {
                let immediate = {
                    start: -1,
                    end: -1
                };
                for (let index = 0; index < json.minutely.length; index++) {
                    const element = json.minutely[index];
                    if (element.precipitation > 0 && immediate.start == -1) {
                        immediate.start = index;
                        continue;
                    }
                    else if (element.precipitation == 0 && immediate.start != -1) {
                        immediate.end = index;
                        break;
                    }
                }
                weather.immediatePrecipitation = immediate;
            }
            let forecasts = [];
            for (let i = 0; i < json.daily.length; i++) {
                let day = json.daily[i];
                let forecast = {
                    date: DateTime.fromSeconds(day.dt, { zone: json.timezone }),
                    temp_min: day.temp.min,
                    temp_max: day.temp.max,
                    condition: {
                        main: day.weather[0].main,
                        description: day.weather[0].description,
                        icons: this.ResolveIcon(day.weather[0].icon),
                        customIcon: this.ResolveCustomIcon(day.weather[0].icon)
                    },
                };
                forecasts.push(forecast);
            }
            weather.forecasts = forecasts;
            let hourly = [];
            for (let index = 0; index < json.hourly.length; index++) {
                const hour = json.hourly[index];
                let forecast = {
                    date: DateTime.fromSeconds(hour.dt, { zone: json.timezone }),
                    temp: hour.temp,
                    condition: {
                        main: hour.weather[0].main,
                        description: hour.weather[0].description,
                        icons: this.ResolveIcon(hour.weather[0].icon),
                        customIcon: this.ResolveCustomIcon(hour.weather[0].icon)
                    },
                };
                if (hour.pop >= 0.1) {
                    forecast.precipitation = {
                        chance: hour.pop * 100,
                        type: "none",
                        volume: undefined
                    };
                }
                if (!!hour.rain && forecast.precipitation != null) {
                    forecast.precipitation.volume = hour.rain["1h"];
                    forecast.precipitation.type = "rain";
                }
                if (!!hour.snow && forecast.precipitation != null) {
                    forecast.precipitation.volume = hour.snow["1h"];
                    forecast.precipitation.type = "snow";
                }
                hourly.push(forecast);
            }
            weather.hourlyForecasts = hourly;
            return weather;
        }
        catch (e) {
            logger_Logger.Error("OpenWeatherMap Weather Parsing error: " + e, e);
            this.app.ShowError({
                type: "soft",
                service: "openweathermap",
                detail: "unusual payload",
                message: _("Failed to Process Current Weather Info")
            });
            return null;
        }
    }
    ;
    ConstructQuery(baseUrl, loc) {
        let query = baseUrl;
        query = query + "lat=" + loc.lat + "&lon=" + loc.lon + "&appid=";
        query += "1c73f8259a86c6fd43c7163b543c8640";
        let locale = this.ConvertToAPILocale(this.app.config.currentLocale);
        if (this.app.config._translateCondition && IsLangSupported(locale, this.supportedLanguages)) {
            query = query + "&lang=" + locale;
        }
        return query;
    }
    ;
    ConvertToAPILocale(systemLocale) {
        if (systemLocale == null)
            return "en";
        if (systemLocale == "zh-cn" || systemLocale == "zh-cn" || systemLocale == "pt-br") {
            return systemLocale;
        }
        let lang = systemLocale.split("-")[0];
        if (lang == "sv") {
            return "se";
        }
        else if (lang == "cs") {
            return "cz";
        }
        else if (lang == "ko") {
            return "kr";
        }
        else if (lang == "lv") {
            return "la";
        }
        else if (lang == "nn" || lang == "nb") {
            return "no";
        }
        return lang;
    }
    HadErrors(json) {
        if (!this.HasReturnedError(json))
            return false;
        let errorMsg = "OpenWeatherMap Response: ";
        let error = {
            service: "openweathermap",
            type: "hard",
        };
        let errorPayload = json;
        switch (errorPayload.cod) {
            case ("400"):
                error.detail = "bad location format";
                error.message = _("Please make sure Location is in the correct format in the Settings");
                break;
            case ("401"):
                error.detail = "bad key";
                error.message = _("Make sure you entered the correct key in settings");
                break;
            case ("404"):
                error.detail = "location not found";
                error.message = _("Location not found, make sure location is available or it is in the correct format");
                break;
            case ("429"):
                error.detail = "key blocked";
                error.message = _("If this problem persists, please contact the Author of this applet");
                break;
            default:
                error.detail = "unknown";
                error.message = _("Unknown Error, please see the logs in Looking Glass");
                break;
        }
        ;
        this.app.ShowError(error);
        logger_Logger.Debug("OpenWeatherMap Error Code: " + errorPayload.cod);
        logger_Logger.Error(errorMsg + errorPayload.message);
        return true;
    }
    ;
    HasReturnedError(json) {
        return (!!(json === null || json === void 0 ? void 0 : json.cod));
    }
    ResolveIcon(icon) {
        switch (icon) {
            case "10d":
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case "10n":
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case "09n":
                return ["weather-showers"];
            case "09d":
                return ["weather-showers"];
            case "13d":
                return ["weather-snow"];
            case "13n":
                return ["weather-snow"];
            case "50d":
                return ["weather-fog"];
            case "50n":
                return ["weather-fog"];
            case "04d":
                return ["weather-overcast", "weather-clouds", "weather-few-clouds"];
            case "04n":
                return ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"];
            case "03n":
                return ['weather-clouds-night', "weather-few-clouds-night"];
            case "03d":
                return ["weather-clouds", "weather-few-clouds", "weather-overcast"];
            case "02n":
                return ["weather-few-clouds-night"];
            case "02d":
                return ["weather-few-clouds"];
            case "01n":
                return ["weather-clear-night"];
            case "01d":
                return ["weather-clear"];
            case "11d":
                return ["weather-storm"];
            case "11n":
                return ["weather-storm"];
            default:
                return ["weather-severe-alert"];
        }
    }
    ;
    ResolveCustomIcon(icon) {
        switch (icon) {
            case "10d":
                return "day-rain-symbolic";
            case "10n":
                return "night-rain-symbolic";
            case "09n":
                return "night-showers-symbolic";
            case "09d":
                return "day-showers-symbolic";
            case "13d":
                return "day-snow-symbolic";
            case "13n":
                return "night-alt-snow-symbolic";
            case "50d":
                return "day-fog-symbolic";
            case "50n":
                return "night-fog-symbolic";
            case "04d":
                return "day-cloudy-symbolic";
            case "04n":
                return "night-alt-cloudy-symbolic";
            case "03n":
                return "night-alt-cloudy-symbolic";
            case "03d":
                return "day-cloudy-symbolic";
            case "02n":
                return "night-alt-cloudy-symbolic";
            case "02d":
                return "day-cloudy-symbolic";
            case "01n":
                return "night-clear-symbolic";
            case "01d":
                return "day-sunny-symbolic";
            case "11d":
                return "day-thunderstorm-symbolic";
            case "11n":
                return "night-alt-thunderstorm-symbolic";
            default:
                return "cloud-refresh-symbolic";
        }
    }
    ;
}
;
const openWeatherMapConditionLibrary = [
    _("Thunderstorm with light rain"),
    _("Thunderstorm with rain"),
    _("Thunderstorm with heavy rain"),
    _("Light thunderstorm"),
    _("Thunderstorm"),
    _("Heavy thunderstorm"),
    _("Ragged thunderstorm"),
    _("Thunderstorm with light drizzle"),
    _("Thunderstorm with drizzle"),
    _("Thunderstorm with heavy drizzle"),
    _("Light intensity drizzle"),
    _("Drizzle"),
    _("Heavy intensity drizzle"),
    _("Light intensity drizzle rain"),
    _("Drizzle rain"),
    _("Heavy intensity drizzle rain"),
    _("Shower rain and drizzle"),
    _("Heavy shower rain and drizzle"),
    _("Shower drizzle"),
    _("Light rain"),
    _("Moderate rain"),
    _("Heavy intensity rain"),
    _("Very heavy rain"),
    _("Extreme rain"),
    _("Freezing rain"),
    _("Light intensity shower rain"),
    _("Shower rain"),
    _("Heavy intensity shower rain"),
    _("Ragged shower rain"),
    _("Light snow"),
    _("Snow"),
    _("Heavy snow"),
    _("Sleet"),
    _("Shower sleet"),
    _("Light rain and snow"),
    _("Rain and snow"),
    _("Light shower snow"),
    _("Shower snow"),
    _("Heavy shower snow"),
    _("Mist"),
    _("Smoke"),
    _("Haze"),
    _("Sand, dust whirls"),
    _("Fog"),
    _("Sand"),
    _("Dust"),
    _("Volcanic ash"),
    _("Squalls"),
    _("Tornado"),
    _("Clear"),
    _("Clear sky"),
    _("Sky is clear"),
    _("Clouds"),
    _("Few clouds"),
    _("Scattered clouds"),
    _("Broken clouds"),
    _("Overcast clouds")
];

;// CONCATENATED MODULE: ./src/3_8/providers/us_weather.ts




class USWeather {
    constructor(_app) {
        this.prettyName = _("US Weather");
        this.name = "US Weather";
        this.maxForecastSupport = 7;
        this.website = "https://www.weather.gov/";
        this.maxHourlyForecastSupport = 156;
        this.needsApiKey = false;
        this.sitesUrl = "https://api.weather.gov/points/";
        this.MAX_STATION_DIST = 50000;
        this.observationStations = [];
        this.OnObtainingGridData = (message) => {
            var _a, _b, _c, _d;
            if (message.code == 404 && ((_b = (_a = message === null || message === void 0 ? void 0 : message.response) === null || _a === void 0 ? void 0 : _a.response_body) === null || _b === void 0 ? void 0 : _b.data) != null) {
                let data = JSON.parse((_d = (_c = message === null || message === void 0 ? void 0 : message.response) === null || _c === void 0 ? void 0 : _c.response_body) === null || _d === void 0 ? void 0 : _d.data);
                if (data.title == "Data Unavailable For Requested Point") {
                    this.app.ShowError({
                        type: "hard",
                        userError: true,
                        detail: "location not covered",
                        service: "us-weather",
                        message: _("Location is outside US, please use a different provider.")
                    });
                }
                return false;
            }
            return true;
        };
        this.ParseForecast = (json) => {
            let forecasts = [];
            try {
                let startIndex = (this.CheckIfHasThreeElementsForDay(json) ? 1 : 0);
                startIndex = this.FindTodayIndex(json, startIndex);
                if (startIndex == -1)
                    return null;
                if (json.properties.periods[startIndex].isDaytime == false) {
                    startIndex++;
                    let today = json.properties.periods[0];
                    let forecast = {
                        date: DateTime.fromISO(today.startTime).setZone(this.observationStations[0].properties.timeZone),
                        temp_min: FahrenheitToKelvin(today.temperature),
                        temp_max: FahrenheitToKelvin(today.temperature),
                        condition: this.ResolveCondition(today.icon),
                    };
                    forecasts.push(forecast);
                }
                for (let i = startIndex; i < json.properties.periods.length; i += 2) {
                    let day = json.properties.periods[i];
                    let night = json.properties.periods[i + 1];
                    if (!night)
                        night = day;
                    let forecast = {
                        date: DateTime.fromISO(day.startTime).setZone(this.observationStations[0].properties.timeZone),
                        temp_min: FahrenheitToKelvin(night.temperature),
                        temp_max: FahrenheitToKelvin(day.temperature),
                        condition: this.ResolveCondition(day.icon),
                    };
                    forecasts.push(forecast);
                }
                return forecasts;
            }
            catch (e) {
                logger_Logger.Error("US Weather Forecast Parsing error: " + e, e);
                this.app.ShowError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
                return null;
            }
        };
        this.ParseHourlyForecast = (json) => {
            let forecasts = [];
            try {
                for (let i = 0; i < json.properties.periods.length; i++) {
                    let hour = json.properties.periods[i];
                    let timestamp = DateTime.fromISO(hour.startTime).setZone(this.observationStations[0].properties.timeZone);
                    let forecast = {
                        date: timestamp,
                        temp: CelsiusToKelvin(hour.temperature),
                        condition: this.ResolveCondition(hour.icon, !hour.isDaytime),
                        precipitation: undefined
                    };
                    forecasts.push(forecast);
                }
                return forecasts;
            }
            catch (e) {
                logger_Logger.Error("US Weather service Forecast Parsing error: " + e, e);
                this.app.ShowError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Hourly Forecast Info") });
                return null;
            }
        };
        this.app = _app;
    }
    async GetWeather(loc) {
        var _a, _b;
        let locID = loc.lat.toString() + "," + loc.lon.toString();
        if (!this.grid || !this.observationStations || this.currentLocID != locID) {
            logger_Logger.Info("Downloading new site data");
            this.currentLoc = loc;
            this.currentLocID = locID;
            let grid = await this.GetGridData(loc);
            if (grid == null)
                return null;
            logger_Logger.Debug("Grid found: " + JSON.stringify(grid, null, 2));
            let observationStations = await this.GetStationData(grid.properties.observationStations);
            if (observationStations == null)
                return null;
            this.grid = grid;
            this.observationStations = observationStations;
        }
        else {
            logger_Logger.Debug("Site data downloading skipped");
        }
        let observations = await this.GetObservationsInRange(this.MAX_STATION_DIST, loc, this.observationStations);
        let hourlyForecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecastHourly + "?units=si");
        let forecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecast);
        let hourly = await hourlyForecastPromise;
        let forecast = await forecastPromise;
        if (!hourly || !forecast) {
            logger_Logger.Error("Failed to obtain forecast Data");
            return null;
        }
        let weather = this.ParseCurrent(observations, hourly, loc);
        if (!!weather) {
            weather.forecasts = (_a = this.ParseForecast(forecast)) !== null && _a !== void 0 ? _a : [];
            weather.hourlyForecasts = (_b = this.ParseHourlyForecast(hourly)) !== null && _b !== void 0 ? _b : undefined;
        }
        return weather;
    }
    ;
    async GetGridData(loc) {
        let siteData = await this.app.LoadJsonAsync(this.sitesUrl + loc.lat.toString() + "," + loc.lon.toString(), {}, this.OnObtainingGridData);
        return siteData;
    }
    async GetStationData(stationListUrl) {
        let stations = await this.app.LoadJsonAsync(stationListUrl);
        return stations === null || stations === void 0 ? void 0 : stations.features;
    }
    async GetObservationsInRange(range, loc, stations) {
        let observations = [];
        for (let index = 0; index < stations.length; index++) {
            const element = stations[index];
            element.dist = GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], loc.lat, loc.lon);
            if (element.dist > range)
                break;
            let observation = await this.app.LoadJsonAsync(stations[index].id + "/observations/latest", {}, (msg) => false);
            if (observation == null) {
                logger_Logger.Debug("Failed to get observations from " + stations[index].id);
            }
            else {
                observations.push(observation);
            }
        }
        return observations;
    }
    MeshObservationData(observations) {
        if (observations.length < 1)
            return null;
        let result = observations[0];
        if (observations.length == 1)
            return result;
        for (let index = 1; index < observations.length; index++) {
            const element = observations[index];
            let debugText = " Observation data missing, plugged in from ID " +
                element.id + ", index " + index +
                ", distance "
                + Math.round(GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], this.currentLoc.lat, this.currentLoc.lon))
                + " metres";
            if (result.properties.icon == null) {
                result.properties.icon = element.properties.icon;
                result.properties.textDescription = element.properties.textDescription;
                logger_Logger.Debug("Weather condition" + debugText);
            }
            if (result.properties.temperature.value == null) {
                result.properties.temperature.value = element.properties.temperature.value;
                logger_Logger.Debug("Temperature" + debugText);
            }
            if (result.properties.windSpeed.value == null) {
                result.properties.windSpeed.value = element.properties.windSpeed.value;
                logger_Logger.Debug("Wind Speed" + debugText);
            }
            if (result.properties.windDirection.value == null) {
                result.properties.windDirection.value = element.properties.windDirection.value;
                logger_Logger.Debug("Wind degree" + debugText);
            }
            if (result.properties.barometricPressure.value == null) {
                result.properties.barometricPressure.value = element.properties.barometricPressure.value;
                logger_Logger.Debug("Pressure" + debugText);
            }
            if (result.properties.relativeHumidity.value == null) {
                result.properties.relativeHumidity.value = element.properties.relativeHumidity.value;
                logger_Logger.Debug("Humidity" + debugText);
            }
            if (result.properties.windChill.value == null) {
                result.properties.windChill.value = element.properties.windChill.value;
                logger_Logger.Debug("WindChill" + debugText);
            }
            if (result.properties.visibility.value == null) {
                result.properties.visibility.value = element.properties.visibility.value;
                logger_Logger.Debug("Visibility" + debugText);
            }
        }
        return result;
    }
    ParseCurrent(json, hourly, loc) {
        var _a, _b;
        let observation = this.MeshObservationData(json);
        if (observation == null || !this.observationStations[0]) {
            logger_Logger.Error("No observation stations/data are available");
            return null;
        }
        let timestamp = DateTime.fromISO(observation.properties.timestamp, { zone: this.observationStations[0].properties.timeZone });
        let times = (0,suncalc.getTimes)(new Date(), observation.geometry.coordinates[1], observation.geometry.coordinates[0], observation.properties.elevation.value);
        let suntimes = {
            sunrise: DateTime.fromJSDate(times.sunrise, { zone: this.observationStations[0].properties.timeZone }),
            sunset: DateTime.fromJSDate(times.sunset, { zone: this.observationStations[0].properties.timeZone })
        };
        try {
            let weather = {
                coord: {
                    lat: (_a = observation === null || observation === void 0 ? void 0 : observation.geometry) === null || _a === void 0 ? void 0 : _a.coordinates[1],
                    lon: (_b = observation === null || observation === void 0 ? void 0 : observation.geometry) === null || _b === void 0 ? void 0 : _b.coordinates[0]
                },
                location: {
                    city: undefined,
                    country: undefined,
                    url: "https://forecast.weather.gov/MapClick.php?lat=" + this.currentLoc.lat.toString() + "&lon=" + this.currentLoc.lon.toString(),
                    timeZone: this.observationStations[0].properties.timeZone,
                    distanceFrom: this.observationStations[0].dist
                },
                date: timestamp,
                sunrise: suntimes.sunrise,
                sunset: suntimes.sunset,
                wind: {
                    speed: KPHtoMPS(observation.properties.windSpeed.value),
                    degree: observation.properties.windDirection.value
                },
                temperature: CelsiusToKelvin(observation.properties.temperature.value),
                pressure: (observation.properties.barometricPressure.value == null) ? null : observation.properties.barometricPressure.value / 100,
                humidity: observation.properties.relativeHumidity.value,
                condition: this.ResolveCondition(observation.properties.icon, IsNight(suntimes)),
                forecasts: []
            };
            if (observation.properties.windChill.value != null) {
                weather.extra_field = {
                    name: _("Feels Like"),
                    value: CelsiusToKelvin(observation.properties.windChill.value),
                    type: "temperature"
                };
            }
            if (weather.condition == null && hourly != null) {
                weather.condition = this.ResolveCondition(hourly.properties.periods[0].icon);
            }
            return weather;
        }
        catch (e) {
            logger_Logger.Error("US Weather Parsing error: " + e, e);
            this.app.ShowError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    }
    ;
    CheckIfHasThreeElementsForDay(json) {
        var _a, _b, _c;
        if (((_b = (_a = json === null || json === void 0 ? void 0 : json.properties) === null || _a === void 0 ? void 0 : _a.periods) === null || _b === void 0 ? void 0 : _b.length) < 3 || ((_c = this.observationStations[0]) === null || _c === void 0 ? void 0 : _c.properties))
            return false;
        let counter = 0;
        for (let index = 1; index < 3; index++) {
            const element = json.properties.periods[index];
            const prevElement = json.properties.periods[index - 1];
            let prevDate = DateTime.fromISO(prevElement.startTime).setZone(this.observationStations[0].properties.timeZone);
            let curDate = DateTime.fromISO(element.startTime).setZone(this.observationStations[0].properties.timeZone);
            if (OnSameDay(prevDate, curDate))
                counter++;
            else
                counter = 0;
            if (counter > 1) {
                global.log("3 elements");
                return true;
            }
        }
        return false;
    }
    FindTodayIndex(json, startIndex = 0) {
        var _a;
        if (!this.observationStations[0] || !((_a = json === null || json === void 0 ? void 0 : json.properties) === null || _a === void 0 ? void 0 : _a.periods)) {
            return -1;
        }
        let today = DateTime.utc().setZone(this.observationStations[0].properties.timeZone);
        for (let index = startIndex; index < json.properties.periods.length; index++) {
            const element = json.properties.periods[index];
            let curDate = DateTime.fromISO(element.startTime).setZone(this.observationStations[0].properties.timeZone);
            if (!OnSameDay(today, curDate))
                continue;
            global.log(index);
            return index;
        }
        return -1;
    }
    ResolveCondition(icon, isNight = false) {
        if (icon == null)
            return {
                main: _("Unknown"),
                description: _("Unknown"),
                customIcon: "cloud-refresh-symbolic",
                icons: ["weather-severe-alert"]
            };
        let code = icon.match(/(?!\/)[a-z_]+(?=(\?|,))/);
        switch (code === null || code === void 0 ? void 0 : code[0]) {
            case "skc":
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    icons: (isNight) ? ["weather-clear-night", "weather-severe-alert"] : ["weather-clear", "weather-severe-alert"]
                };
            case "few":
                return {
                    main: _("Few clouds"),
                    description: _("Few clouds"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: ["weather-clear-night", "weather-severe-alert"]
                };
            case "sct":
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: ["weather-clear", "weather-severe-alert"]
                };
            case "bkn":
                return {
                    main: _("Mostly cloudy"),
                    description: _("Mostly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: ["weather-clouds-night", "weather-overcast", "weather-severe-alert"]
                };
            case "ovc":
                return {
                    main: _("Overcast"),
                    description: _("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-clouds", "weather-overcast", "weather-severe-alert"]
                };
            case "wind_skc":
                return {
                    main: _("Clear"),
                    description: _("Clear and windy"),
                    customIcon: (IsNight) ? "night-alt-wind-symbolic" : "day-windy-symbolic",
                    icons: (isNight) ? ["weather-clear-night"] : ["weather-clear"]
                };
            case "wind_few":
                return {
                    main: _("Few clouds"),
                    description: _("Few clouds and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icons: (isNight) ? ["weather-few-clouds-night"] : ["weather-few-clouds"]
                };
            case "wind_sct":
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icons: (isNight) ? ["weather-clouds-night", "weather-few-clouds-night"] : ["weather-clouds", "weather-few-clouds"]
                };
            case "wind_bkn":
                return {
                    main: _("Mostly cloudy"),
                    description: _("Mostly cloudy and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icons: (isNight) ? ["weather-clouds-night", "weather-few-clouds-night"] : ["weather-clouds", "weather-few-clouds"]
                };
            case "wind_ovc":
                return {
                    main: _("Overcast"),
                    description: _("Overcast and windy"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
                };
            case "snow":
                return {
                    main: _("Snow"),
                    description: _("Snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-severe-alert"]
                };
            case "rain_snow":
                return {
                    main: _("Rain"),
                    description: _("Snowy rain"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-snow", "weather-severe-alert"]
                };
            case "rain_sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-severe-alert"]
                };
            case "snow_sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "sleet-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                };
            case "fzra":
                return {
                    main: _("Freezing rain"),
                    description: _("Freezing rain"),
                    customIcon: "rain-wind-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                };
            case "rain_fzra":
                return {
                    main: _("Freezing rain"),
                    description: _("Freezing rain"),
                    customIcon: "rain-wind-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                };
            case "snow_fzra":
                return {
                    main: _("Freezing rain"),
                    description: _("Freezing rain and snow"),
                    customIcon: "rain-wind-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                };
            case "sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-severe-alert"]
                };
            case "rain":
                return {
                    main: _("Rain"),
                    description: _("Rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "rain_showers":
            case "rain_showers_hi":
                return {
                    main: _("Rain"),
                    description: _("Rain showers"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-showers", "weather-showers-scattered", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "tsra":
            case "tsra_sct":
            case "tsra_hi":
                return {
                    main: _("Thunderstorm"),
                    description: _("Thunderstorm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "tornado":
                return {
                    main: _("Tornado"),
                    description: _("Tornado"),
                    customIcon: "tornado-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "hurricane":
                return {
                    main: _("Hurricane"),
                    description: _("Hurricane"),
                    customIcon: "hurricane-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "tropical_storm":
                return {
                    main: _("Storm"),
                    description: _("Tropical storm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "dust":
                return {
                    main: _("Dust"),
                    description: _("Dust"),
                    customIcon: "dust-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "smoke":
                return {
                    main: _("Smoke"),
                    description: _("Smoke"),
                    customIcon: "smoke-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "haze":
                return {
                    main: _("Haze"),
                    description: _("Haze"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "hot":
                return {
                    main: _("Hot"),
                    description: _("Hot"),
                    customIcon: "hot-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "cold":
                return {
                    main: _("Cold"),
                    description: _("Cold"),
                    customIcon: "snowflake-cold-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "blizzard":
                return {
                    main: _("Blizzard"),
                    description: _("Blizzard"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "fog":
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            default:
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icons: ["weather-severe-alert"]
                };
        }
    }
    ;
}
;

;// CONCATENATED MODULE: ./src/3_8/providers/weatherbit.ts



class Weatherbit {
    constructor(_app) {
        this.prettyName = _("WeatherBit");
        this.name = "Weatherbit";
        this.maxForecastSupport = 16;
        this.website = "https://www.weatherbit.io/";
        this.maxHourlyForecastSupport = 48;
        this.needsApiKey = true;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cz', 'da', 'de', 'el', 'en',
            'et', 'fi', 'fr', 'hr', 'hu', 'id', 'is', 'it',
            'kw', 'lv', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tr', 'uk', 'zh', 'zh-tw'
        ];
        this.current_url = "https://api.weatherbit.io/v2.0/current?";
        this.daily_url = "https://api.weatherbit.io/v2.0/forecast/daily?";
        this.hourly_url = "https://api.weatherbit.io/v2.0/forecast/hourly?";
        this.hourlyAccess = true;
        this.ParseCurrent = (json) => {
            json = json.data[0];
            let hourDiff = this.HourDifference(DateTime.fromSeconds(json.ts, { zone: json.timezone }), this.ParseStringTime(json.ob_time, json.timezone));
            if (hourDiff != 0)
                logger_Logger.Debug("Weatherbit reporting incorrect time, correcting with " + (0 - hourDiff).toString() + " hours");
            try {
                let weather = {
                    coord: {
                        lat: json.lat,
                        lon: json.lon
                    },
                    location: {
                        city: json.city_name,
                        country: json.country_code,
                        url: undefined,
                        timeZone: json.timezone
                    },
                    date: DateTime.fromSeconds(json.ts, { zone: json.timezone }),
                    sunrise: this.TimeToDate(json.sunrise, hourDiff, json.timezone),
                    sunset: this.TimeToDate(json.sunset, hourDiff, json.timezone),
                    wind: {
                        speed: json.wind_spd,
                        degree: json.wind_dir
                    },
                    temperature: json.temp,
                    pressure: json.pres,
                    humidity: json.rh,
                    condition: {
                        main: json.weather.description,
                        description: json.weather.description,
                        icons: this.ResolveIcon(json.weather.icon),
                        customIcon: this.ResolveCustomIcon(json.weather.icon)
                    },
                    extra_field: {
                        name: _("Feels Like"),
                        value: json.app_temp,
                        type: "temperature"
                    },
                    forecasts: []
                };
                return weather;
            }
            catch (e) {
                logger_Logger.Error("Weatherbit Weather Parsing error: " + e, e);
                this.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Current Weather Info") });
                return null;
            }
        };
        this.ParseForecast = (json) => {
            let forecasts = [];
            try {
                for (let i = 0; i < json.data.length; i++) {
                    let day = json.data[i];
                    let forecast = {
                        date: DateTime.fromSeconds(day.ts, { zone: json.timezone }),
                        temp_min: day.min_temp,
                        temp_max: day.max_temp,
                        condition: {
                            main: day.weather.description,
                            description: day.weather.description,
                            icons: this.ResolveIcon(day.weather.icon),
                            customIcon: this.ResolveCustomIcon(day.weather.icon)
                        },
                    };
                    forecasts.push(forecast);
                }
                return forecasts;
            }
            catch (e) {
                logger_Logger.Error("Weatherbit Forecast Parsing error: " + e, e);
                this.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
                return null;
            }
        };
        this.ParseHourlyForecast = (json) => {
            let forecasts = [];
            try {
                for (let i = 0; i < json.data.length; i++) {
                    let hour = json.data[i];
                    let forecast = {
                        date: DateTime.fromSeconds(hour.ts, { zone: json.timezone }),
                        temp: hour.temp,
                        condition: {
                            main: hour.weather.description,
                            description: hour.weather.description,
                            icons: this.ResolveIcon(hour.weather.icon),
                            customIcon: this.ResolveCustomIcon(hour.weather.icon)
                        },
                        precipitation: {
                            type: "rain",
                            volume: hour.precip,
                            chance: hour.pop
                        }
                    };
                    if (!!forecast.precipitation && hour.snow != 0) {
                        forecast.precipitation.type = "snow";
                        forecast.precipitation.volume = hour.snow;
                    }
                    forecasts.push(forecast);
                }
                return forecasts;
            }
            catch (e) {
                logger_Logger.Error("Weatherbit Forecast Parsing error: " + e, e);
                this.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
                return null;
            }
        };
        this.app = _app;
    }
    async GetWeather(loc) {
        let forecastPromise = this.GetData(this.daily_url, loc, this.ParseForecast);
        let hourlyPromise = null;
        if (!!this.hourlyAccess)
            hourlyPromise = this.GetHourlyData(this.hourly_url, loc);
        let currentResult = await this.GetData(this.current_url, loc, this.ParseCurrent);
        if (!currentResult)
            return null;
        let forecastResult = await forecastPromise;
        currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
        let hourlyResult = await hourlyPromise;
        currentResult.hourlyForecasts = (!hourlyResult) ? [] : hourlyResult;
        return currentResult;
    }
    ;
    async GetData(baseUrl, loc, ParseFunction) {
        let query = this.ConstructQuery(baseUrl, loc);
        if (query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query, undefined, (e) => this.HandleError(e));
        if (json == null)
            return null;
        return ParseFunction(json);
    }
    async GetHourlyData(baseUrl, loc) {
        let query = this.ConstructQuery(baseUrl, loc);
        if (query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query, undefined, (e) => this.HandleHourlyError(e));
        if (!!(json === null || json === void 0 ? void 0 : json.error)) {
            return null;
        }
        if (json == null)
            return null;
        return this.ParseHourlyForecast(json);
    }
    ;
    TimeToDate(time, hourDiff, tz) {
        let hoursMinutes = time.split(":");
        let date = DateTime.utc().set({
            hour: parseInt(hoursMinutes[0]) - hourDiff,
            minute: parseInt(hoursMinutes[1]),
        }).setZone(tz);
        return date;
    }
    HourDifference(correctTime, incorrectTime) {
        if (incorrectTime == null)
            return 0;
        return Math.round((incorrectTime.hour - correctTime.hour) / (1000 * 60 * 60));
    }
    ParseStringTime(last_ob_time, tz) {
        let split = last_ob_time.split(/[T\-\s:]/);
        if (split.length != 5)
            return null;
        return DateTime.fromObject({
            year: parseInt(split[0]),
            month: parseInt(split[1]) - 1,
            day: parseInt(split[2]),
            hour: parseInt(split[3]),
            minute: parseInt(split[4])
        }).setZone(tz);
    }
    ConvertToAPILocale(systemLocale) {
        if (!systemLocale)
            return null;
        if (systemLocale == "zh-tw") {
            return systemLocale;
        }
        let lang = systemLocale.split("-")[0];
        if (lang == "cs") {
            return "cz";
        }
        return lang;
    }
    ConstructQuery(query, loc) {
        query = query + "key=" + this.app.config.ApiKey + "&lat=" + loc.lat + "&lon=" + loc.lon + "&units=S";
        let lang = this.ConvertToAPILocale(this.app.config.currentLocale);
        if (IsLangSupported(lang, this.supportedLanguages) && this.app.config._translateCondition) {
            query = query + "&lang=" + lang;
        }
        return query;
    }
    ;
    HandleError(message) {
        if (message.code == 403) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "bad key",
                service: "weatherbit",
                message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
            });
        }
        return true;
    }
    HandleHourlyError(message) {
        if (message.code == 403) {
            this.hourlyAccess = false;
            logger_Logger.Info("Hourly forecast is inaccessible, skipping");
            return false;
        }
        return true;
    }
    ResolveIcon(icon) {
        switch (icon) {
            case "t01n":
            case "t01d":
            case "t02n":
            case "t02d":
            case "t03n":
            case "t03d":
            case "t04n":
            case "t04d":
            case "t05n":
            case "t05d":
                return ["weather-storm"];
            case "d01d":
            case "d01n":
            case "d02d":
            case "d02n":
            case "d03d":
            case "d03n":
                return ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"];
            case "r01d":
            case "r01n":
            case "r02d":
            case "r02n":
            case "r03d":
            case "r03n":
            case "r04d":
            case "r04n":
            case "r05d":
            case "r05n":
            case "r06d":
            case "r06n":
                return ["weather-rain", "weather-freezing-rain", "weather-showers-scattered"];
            case "s01d":
            case "s01n":
            case "s02d":
            case "s02n":
            case "s03d":
            case "s03n":
            case "s04d":
            case "s04n":
            case "s06d":
            case "s06n":
                return ["weather-snow"];
            case "s05d":
            case "s05n":
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case "a01d":
            case "a01n":
            case "a02d":
            case "a02n":
            case "a03d":
            case "a03n":
            case "a04d":
            case "a04n":
            case "a05d":
            case "a05n":
            case "a06d":
            case "a06n":
                return ["weather-fog"];
            case "c02d":
                return ["weather-few-clouds"];
            case "c02n":
                return ["weather-few-clouds-night"];
            case "c01n":
                return ["weather-clear-night"];
            case "c01d":
                return ["weather-clear"];
            case "c03d":
                return ["weather-clouds", "weather-few-clouds", "weather-overcast"];
            case "c03n":
                return ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"];
            case "c04n":
                return ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"];
            case "c04d":
                return ["weather-overcast", "weather-clouds", "weather-few-clouds"];
            case "u00d":
            case "u00n":
                return ["weather-severe-alert"];
            default:
                return ["weather-severe-alert"];
        }
    }
    ;
    ResolveCustomIcon(icon) {
        switch (icon) {
            case "t01d":
            case "t02d":
            case "t03d":
                return "day-thunderstorm-symbolic";
            case "t04d":
            case "t05d":
                return "thunderstorm-symbolic";
            case "t01n":
            case "t02n":
            case "t03n":
                return "night-alt-thunderstorm-symbolic";
            case "t04n":
            case "t05n":
                return "thunderstorm-symbolic";
            case "d01d":
            case "d02d":
            case "d03d":
            case "d01n":
            case "d02n":
            case "d03n":
                return "showers-symbolic";
            case "r01d":
            case "r02d":
            case "r03d":
            case "r01n":
            case "r02n":
            case "r03n":
                return "rain-symbolic";
            case "r04d":
            case "r05d":
                return "day-rain-symbolic";
            case "r06d":
                return "rain-symbolic";
            case "r04n":
            case "r05n":
                return "night-alt-rain-symbolic";
            case "r06n":
                return "rain-symbolic";
            case "s01d":
            case "s04d":
                return "day-snow-symbolic";
            case "s02d":
            case "s03d":
            case "s06d":
                return "snow-symbolic";
            case "s01n":
            case "s04n":
                return "night-alt-snow-symbolic";
            case "s02n":
            case "s03n":
            case "s06n":
                return "snow-symbolic";
            case "s05d":
            case "s05n":
                return "sleet-symbolic";
            case "a01d":
            case "a02d":
            case "a03d":
            case "a04d":
            case "a05d":
            case "a06d":
                return "day-fog-symbolic";
            case "a01n":
            case "a02n":
            case "a03n":
            case "a04n":
            case "a05n":
            case "a06n":
                return "night-fog-symbolic";
            case "c02d":
                return "day-cloudy-symbolic";
            case "c02n":
                return "night-alt-cloudy-symbolic";
            case "c01n":
                return "night-clear-symbolic";
            case "c01d":
                return "day-sunny-symbolic";
            case "c03d":
                return "day-cloudy-symbolic";
            case "c03n":
                return "night-alt-cloudy-symbolic";
            case "c04n":
                return "cloudy-symbolic";
            case "c04d":
                return "cloudy-symbolic";
            case "u00d":
            case "u00n":
                return "cloud-refresh-symbolic";
            default:
                return "cloud-refresh-symbolic";
        }
    }
}
;

;// CONCATENATED MODULE: ./src/3_8/providers/met_norway.ts




class MetNorway {
    constructor(app) {
        this.prettyName = _("MET Norway");
        this.name = "MetNorway";
        this.maxForecastSupport = 10;
        this.website = "https://www.met.no/en";
        this.maxHourlyForecastSupport = 48;
        this.needsApiKey = false;
        this.baseUrl = "https://api.met.no/weatherapi/locationforecast/2.0/complete?";
        this.app = app;
    }
    async GetWeather(loc) {
        let query = this.GetUrl(loc);
        if (query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query);
        if (!json) {
            logger_Logger.Error("MET Norway: Empty response from API");
            return null;
        }
        return this.ParseWeather(json, loc);
    }
    RemoveEarlierElements(json, loc) {
        let now = DateTime.now().setZone(loc.timeZone);
        let startIndex = -1;
        for (let i = 0; i < json.properties.timeseries.length; i++) {
            const element = json.properties.timeseries[i];
            let timestamp = DateTime.fromISO(element.time, { zone: loc.timeZone });
            if (timestamp < now && now.hour != timestamp.hour) {
                startIndex = i;
            }
            else {
                break;
            }
        }
        if (startIndex != -1) {
            logger_Logger.Debug("Removing outdated weather information...");
            json.properties.timeseries.splice(0, startIndex + 1);
        }
        return json;
    }
    ParseWeather(json, loc) {
        var _a, _b;
        json = this.RemoveEarlierElements(json, loc);
        let times = (0,suncalc.getTimes)(new Date(), json.geometry.coordinates[1], json.geometry.coordinates[0], json.geometry.coordinates[2]);
        let suntimes = {
            sunrise: DateTime.fromJSDate(times.sunrise, { zone: loc.timeZone }),
            sunset: DateTime.fromJSDate(times.sunset, { zone: loc.timeZone })
        };
        let current = json.properties.timeseries[0];
        let result = {
            temperature: CelsiusToKelvin(current.data.instant.details.air_temperature),
            coord: {
                lat: json.geometry.coordinates[1],
                lon: json.geometry.coordinates[0]
            },
            date: DateTime.fromISO(current.time, { zone: loc.timeZone }),
            condition: this.ResolveCondition((_b = (_a = current.data.next_1_hours) === null || _a === void 0 ? void 0 : _a.summary) === null || _b === void 0 ? void 0 : _b.symbol_code, IsNight(suntimes)),
            humidity: current.data.instant.details.relative_humidity,
            pressure: current.data.instant.details.air_pressure_at_sea_level,
            extra_field: {
                name: _("Cloudiness"),
                type: "percent",
                value: current.data.instant.details.cloud_area_fraction
            },
            sunrise: suntimes.sunrise,
            sunset: suntimes.sunset,
            wind: {
                degree: current.data.instant.details.wind_from_direction,
                speed: current.data.instant.details.wind_speed
            },
            location: {
                url: undefined,
            },
            forecasts: []
        };
        let hourlyForecasts = [];
        for (let i = 0; i < json.properties.timeseries.length; i++) {
            const element = json.properties.timeseries[i];
            if (!!element.data.next_1_hours) {
                hourlyForecasts.push({
                    date: DateTime.fromISO(element.time, { zone: loc.timeZone }),
                    temp: CelsiusToKelvin(element.data.instant.details.air_temperature),
                    precipitation: {
                        type: "rain",
                        volume: element.data.next_1_hours.details.precipitation_amount
                    },
                    condition: this.ResolveCondition(element.data.next_1_hours.summary.symbol_code, IsNight(suntimes, DateTime.fromISO(element.time, { zone: loc.timeZone })))
                });
            }
        }
        result.hourlyForecasts = hourlyForecasts;
        result.forecasts = this.BuildForecasts(json.properties.timeseries, loc);
        return result;
    }
    BuildForecasts(forecastsData, loc) {
        let forecasts = [];
        let days = this.SortDataByDay(forecastsData, loc);
        for (let i = 0; i < days.length; i++) {
            let forecast = {
                condition: {
                    customIcon: "cloudy-symbolic",
                    description: "",
                    icons: [],
                    main: ""
                },
                date: null,
                temp_max: Number.NEGATIVE_INFINITY,
                temp_min: Number.POSITIVE_INFINITY
            };
            let conditionCounter = {};
            for (let j = 0; j < days[i].length; j++) {
                const element = days[i][j];
                if (!element.data.next_6_hours)
                    continue;
                forecast.date = DateTime.fromISO(element.time, { zone: loc.timeZone });
                if (element.data.next_6_hours.details.air_temperature_max > forecast.temp_max)
                    forecast.temp_max = element.data.next_6_hours.details.air_temperature_max;
                if (element.data.next_6_hours.details.air_temperature_min < forecast.temp_min)
                    forecast.temp_min = element.data.next_6_hours.details.air_temperature_min;
                let [symbol] = element.data.next_6_hours.summary.symbol_code.split("_");
                let severity = conditionSeverity[symbol];
                if (!conditionCounter[severity])
                    conditionCounter[severity] = { count: 0, name: symbol };
                conditionCounter[severity].count = conditionCounter[severity].count + 1;
            }
            forecast.temp_max = CelsiusToKelvin(forecast.temp_max);
            forecast.temp_min = CelsiusToKelvin(forecast.temp_min);
            forecast.condition = this.ResolveCondition(this.GetMostSevereCondition(conditionCounter));
            forecasts.push(forecast);
        }
        return forecasts;
    }
    GetEarliestDataForToday(events, loc) {
        let earliest = 0;
        for (let i = 0; i < events.length; i++) {
            const earliestElementTime = DateTime.fromISO(events[earliest].time, { zone: loc.timeZone });
            let timestamp = DateTime.fromISO(events[i].time, { zone: loc.timeZone });
            if (!DateTime.utc().setZone(loc.timeZone).hasSame(timestamp, "day"))
                continue;
            if (earliestElementTime < timestamp)
                continue;
            earliest = i;
        }
        return events[earliest];
    }
    SortDataByDay(data, loc) {
        let days = [];
        let currentDay = DateTime.fromISO(this.GetEarliestDataForToday(data, loc).time, { zone: loc.timeZone });
        let dayIndex = 0;
        days.push([]);
        for (let i = 0; i < data.length; i++) {
            const element = data[i];
            const timestamp = DateTime.fromISO(element.time, { zone: loc.timeZone });
            if (OnSameDay(timestamp, currentDay)) {
                days[dayIndex].push(element);
            }
            else if (!OnSameDay(timestamp, currentDay)) {
                dayIndex++;
                currentDay = timestamp;
                days.push([]);
                days[dayIndex].push(element);
            }
        }
        return days;
    }
    GetMostCommonCondition(count) {
        let result = -1;
        for (let key in count) {
            if (result == -1)
                result = parseInt(key);
            if (count[result].count < count[key].count)
                result = parseInt(key);
        }
        return count[result].name;
    }
    GetMostSevereCondition(conditions) {
        let result = -1;
        for (let key in conditions) {
            let conditionID = parseInt(key);
            let resultStripped = (result > 100) ? result - 100 : result;
            let conditionIDStripped = (conditionID > 100) ? conditionID - 100 : conditionID;
            if (conditionIDStripped > resultStripped)
                result = conditionID;
        }
        if (result <= 4) {
            return this.GetMostCommonCondition(conditions);
        }
        return conditions[result].name;
    }
    GetUrl(loc) {
        let url = this.baseUrl + "lat=";
        url += (loc.lat + "&lon=" + loc.lon);
        return url;
    }
    DeconstructCondition(icon) {
        let condition = icon.split("_");
        return {
            timeOfDay: condition[1],
            condition: condition[0]
        };
    }
    ResolveCondition(icon, isNight = false) {
        if (icon == null) {
            logger_Logger.Error("Icon was not found");
            return {
                customIcon: "cloud-refresh-symbolic",
                main: _("Unknown"),
                description: _("Unknown"),
                icons: ["weather-severe-alert"]
            };
        }
        let weather = this.DeconstructCondition(icon);
        switch (weather.condition) {
            case "clearsky":
                return {
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    main: _("Clear sky"),
                    description: _("Clear sky"),
                    icons: (isNight) ? ["weather-clear-night"] : ["weather-clear"]
                };
            case "cloudy":
                return {
                    customIcon: "cloudy-symbolic",
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    icons: (isNight) ? ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"]
                };
            case "fair":
                return {
                    customIcon: (isNight) ? "night-cloudy-symbolic" : "day-cloudy-symbolic",
                    main: _("Fair"),
                    description: _("Fair"),
                    icons: (isNight) ? ["weather-few-clouds-night", "weather-clouds-night", "weather-overcast"] : ["weather-few-clouds", "weather-clouds", "weather-overcast"]
                };
            case "fog":
                return {
                    customIcon: "fog-symbolic",
                    main: _("Fog"),
                    description: _("Fog"),
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "heavyrain":
                return {
                    customIcon: "rain-symbolic",
                    main: _("Heavy rain"),
                    description: _("Heavy rain"),
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers"]
                };
            case "heavyrainandthunder":
                return {
                    customIcon: "thunderstorm-symbolic",
                    main: _("Heavy rain"),
                    description: _("Heavy rain and thunder"),
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers"]
                };
            case "heavyrainshowers":
                return {
                    customIcon: (isNight) ? "night-alt-rain-symbolic" : "day-rain-symbolic",
                    main: _("Heavy rain"),
                    description: _("Heavy rain showers"),
                    icons: ["weather-showers", "weather-showers-scattered"]
                };
            case "heavyrainshowersandthunder":
                return {
                    customIcon: (IsNight) ? "night-alt-thunderstorm-symbolic" : "day-thunderstorm-symbolic",
                    main: _("Heavy rain"),
                    description: _("Heavy rain showers and thunder"),
                    icons: ["weather-showers", "weather-showers-scattered"]
                };
            case "heavysleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Heavy sleet"),
                    description: _("Heavy sleet"),
                    icons: ["weather-showers", "weather-freezing-rain", "weather-rain"]
                };
            case "heavysleetandthunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: _("Heavy sleet"),
                    description: _("Heavy sleet and thunder"),
                    icons: ["weather-showers", "weather-freezing-rain", "weather-rain"]
                };
            case "heavysleetshowers":
                return {
                    customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    main: _("Heavy sleet"),
                    description: _("Heavy sleet showers"),
                    icons: ["weather-showers", "weather-showers-scattered", "weather-freezing-rain"]
                };
            case "heavysleetshowersandthunder":
                return {
                    customIcon: (IsNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: _("Heavy sleet"),
                    description: _("Heavy sleet showers and thunder"),
                    icons: ["weather-showers", "weather-showers-scattered", "weather-freezing-rain"]
                };
            case "heavysnow":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Heavy snow"),
                    description: _("Heavy snow"),
                    icons: ["weather-snow"]
                };
            case "heavysnowandthunder":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Heavy snow"),
                    description: _("Heavy snow and thunder"),
                    icons: ["weather-snow"]
                };
            case "heavysnowshowers":
                return {
                    customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    main: _("Heavy snow"),
                    description: _("Heavy snow showers"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "heavysnowshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: _("Heavy snow"),
                    description: _("Heavy snow showers and thunder"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "lightrain":
                return {
                    customIcon: "rain-mix-symbolic",
                    main: _("Light rain"),
                    description: _("Light rain"),
                    icons: ["weather-showers-scattered", "weather-rain"]
                };
            case "lightrainandthunder":
                return {
                    customIcon: "rain-mix-storm-symbolic",
                    main: _("Light rain"),
                    description: _("Light rain and thunder"),
                    icons: ["weather-showers-scattered", "weather-rain"]
                };
            case "lightrainshowers":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
                    main: _("Light rain"),
                    description: _("Light rain showers"),
                    icons: ["weather-showers-scattered", "weather-rain"]
                };
            case "lightrainshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-storm-symbolic" : "day-rain-mix-storm-symbolic",
                    main: _("Light rain"),
                    description: _("Light rain showers and thunder"),
                    icons: ["weather-showers-scattered", "weather-rain"]
                };
            case "lightsleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Light sleet"),
                    description: _("Light sleet"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "lightsleetandthunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: _("Light sleet"),
                    description: _("Light sleet and thunder"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "lightsleetshowers":
                return {
                    customIcon: (IsNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    main: _("Light sleet"),
                    description: _("Light sleet showers"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "lightssleetshowersandthunder":
                return {
                    customIcon: (IsNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: _("Light sleet"),
                    description: _("Light sleet showers and thunder"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "lightsnow":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Light snow"),
                    description: _("Light snow"),
                    icons: ["weather-snow"]
                };
            case "lightsnowandthunder":
                return {
                    customIcon: "snow-storm-symbolic",
                    main: _("Light snow"),
                    description: _("Light snow and thunder"),
                    icons: ["weather-snow"]
                };
            case "lightsnowshowers":
                return {
                    customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    main: _("Light snow"),
                    description: _("Light snow showers"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "lightssnowshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: _("Light snow"),
                    description: _("Light snow showers and thunder"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "partlycloudy":
                return {
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy"),
                    icons: (isNight) ? ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"] : ["weather-clouds", "weather-few-clouds", "weather-overcast"]
                };
            case "rain":
                return {
                    customIcon: "rain-symbolic",
                    main: _("Rain"),
                    description: _("Rain"),
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case "rainandthunder":
                return {
                    customIcon: "thunderstorm-symbolic",
                    main: _("Rain"),
                    description: _("Rain and thunder"),
                    icons: ["weather-storm", "weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case "rainshowers":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
                    main: _("Rain showers"),
                    description: _("Rain showers"),
                    icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"]
                };
            case "rainshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-storm-symbolic" : "day-rain-mix-storm-symbolic",
                    main: _("Rain showers"),
                    description: _("Rain showers and thunder"),
                    icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"]
                };
            case "sleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "sleetandthunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet and thunder"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "sleetshowers":
                return {
                    customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet showers"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "sleetshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet showers and thunder"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "snow":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Snow"),
                    description: _("Snow"),
                    icons: ["weather-snow"]
                };
            case "snowandthunder":
                return {
                    customIcon: "snow-storm-symbolic",
                    main: _("Snow"),
                    description: _("Snow and thunder"),
                    icons: ["weather-snow"]
                };
            case "snowshowers":
                return {
                    customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    main: _("Snow showers"),
                    description: _("Snow showers"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "snowshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: _("Snow showers"),
                    description: _("Snow showers and thunder"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            default:
                logger_Logger.Error("condition code not found: " + weather.condition);
                return {
                    customIcon: "cloud-refresh-symbolic",
                    main: _("Unknown"),
                    description: _("Unknown"),
                    icons: ["weather-severe-alert"]
                };
        }
    }
}
const conditionSeverity = {
    clearsky: 1,
    cloudy: 4,
    fair: 2,
    fog: 15,
    heavyrain: 10,
    heavyrainandthunder: 11,
    heavyrainshowers: 41,
    heavyrainshowersandthunder: 25,
    heavysleet: 48,
    heavysleetandthunder: 32,
    heavysleetshowers: 43,
    heavysleetshowersandthunder: 27,
    heavysnow: 50,
    heavysnowandthunder: 34,
    heavysnowshowers: 45,
    heavysnowshowersandthunder: 29,
    lightrain: 46,
    lightrainandthunder: 30,
    lightrainshowers: 40,
    lightrainshowersandthunder: 24,
    lightsleet: 47,
    lightsleetandthunder: 31,
    lightsleetshowers: 42,
    lightsnow: 49,
    lightsnowandthunder: 33,
    lightsnowshowers: 44,
    lightssleetshowersandthunder: 26,
    lightssnowshowersandthunder: 28,
    partlycloudy: 3,
    rain: 9,
    rainandthunder: 22,
    rainshowers: 5,
    rainshowersandthunder: 6,
    sleet: 12,
    sleetandthunder: 23,
    sleetshowers: 7,
    sleetshowersandthunder: 20,
    snow: 13,
    snowandthunder: 14,
    snowshowers: 8,
    snowshowersandthunder: 21
};

;// CONCATENATED MODULE: ./src/3_8/lib/httpLib.ts

const { Message, ProxyResolverDefault, SessionAsync } = imports.gi.Soup;
class HttpLib {
    constructor() {
        this._httpSession = new SessionAsync();
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0";
        this._httpSession.timeout = 10;
        this._httpSession.idle_timeout = 10;
        this._httpSession.add_feature(new ProxyResolverDefault());
    }
    static get Instance() {
        if (this.instance == null)
            this.instance = new HttpLib();
        return this.instance;
    }
    async LoadJsonAsync(url, params, method = "GET") {
        let response = await this.LoadAsync(url, params, method);
        if (!response.Success)
            return response;
        try {
            let payload = JSON.parse(response.Data);
            response.Data = payload;
        }
        catch (e) {
            logger_Logger.Error("Error: API response is not JSON. The response: " + response.Data, e);
            response.Success = false;
            response.ErrorData = {
                code: -1,
                message: "bad api response - non json",
                reason_phrase: "",
            };
        }
        finally {
            return response;
        }
    }
    async LoadAsync(url, params, method = "GET") {
        var _a, _b, _c, _d, _e;
        let message = await this.Send(url, params, method);
        let error = undefined;
        if (!message) {
            error = {
                code: 0,
                message: "no network response",
                reason_phrase: "no network response",
                response: undefined
            };
        }
        else if (message.status_code < 100 && message.status_code >= 0) {
            error = {
                code: message.status_code,
                message: "no network response",
                reason_phrase: message.reason_phrase,
                response: message
            };
        }
        else if (message.status_code > 300 || message.status_code < 200) {
            error = {
                code: message.status_code,
                message: "bad status code",
                reason_phrase: message.reason_phrase,
                response: message
            };
        }
        else if (!message.response_body) {
            error = {
                code: message.status_code,
                message: "no response body",
                reason_phrase: message.reason_phrase,
                response: message
            };
        }
        else if (!message.response_body.data) {
            error = {
                code: message.status_code,
                message: "no response data",
                reason_phrase: message.reason_phrase,
                response: message
            };
        }
        if ((message === null || message === void 0 ? void 0 : message.status_code) > 200 && (message === null || message === void 0 ? void 0 : message.status_code) < 300) {
            logger_Logger.Info("Wrning: API returned non-OK status code '" + (message === null || message === void 0 ? void 0 : message.status_code) + "'");
        }
        logger_Logger.Debug2("API full response: " + ((_b = (_a = message === null || message === void 0 ? void 0 : message.response_body) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString()));
        if (error != null)
            logger_Logger.Error("Error calling URL: " + error.reason_phrase + ", " + ((_d = (_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.response_body) === null || _d === void 0 ? void 0 : _d.data));
        return {
            Success: (error == null),
            Data: (_e = message === null || message === void 0 ? void 0 : message.response_body) === null || _e === void 0 ? void 0 : _e.data,
            ErrorData: error
        };
    }
    async Send(url, params, method = "GET") {
        if (params != null) {
            let items = Object.keys(params);
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                url += (index == 0) ? "?" : "&";
                url += (item) + "=" + params[item];
            }
        }
        let query = encodeURI(url);
        logger_Logger.Debug("URL called: " + query);
        let data = await new Promise((resolve, reject) => {
            let message = Message.new(method, query);
            this._httpSession.queue_message(message, (session, message) => {
                resolve(message);
            });
        });
        return data;
    }
}

;// CONCATENATED MODULE: ./src/3_8/providers/visualcrossing.ts


class VisualCrossing {
    constructor(app) {
        this.prettyName = _("Visual Crossing");
        this.name = "Visual Crossing";
        this.maxForecastSupport = 15;
        this.maxHourlyForecastSupport = 336;
        this.website = "https://weather.visualcrossing.com/";
        this.needsApiKey = true;
        this.url = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/";
        this.params = {
            unitGroup: "metric",
            key: null,
            include: "fcst,hours,current",
            lang: "id"
        };
        this.supportedLangs = ["en", "de", "fr", "es"];
        this.app = app;
    }
    async GetWeather(loc) {
        if (loc == null)
            return null;
        this.params['key'] = this.app.config.ApiKey;
        let translate = true;
        if (IsLangSupported(this.app.config.Language, this.supportedLangs)) {
            this.params['lang'] = this.app.config.Language;
            translate = false;
        }
        let url = this.url + loc.lat + "," + loc.lon;
        let json = await this.app.LoadJsonAsync(url, this.params, (e) => this.HandleHttpError(e));
        if (!json)
            return null;
        return this.ParseWeather(json, translate);
    }
    ParseWeather(weather, translate) {
        var _a, _b, _c, _d, _e, _f;
        let currentHour = this.GetCurrentHour(weather.days, weather.timezone);
        let result = {
            date: DateTime.fromSeconds(weather.currentConditions.datetimeEpoch, { zone: weather.timezone }),
            location: {
                url: encodeURI("https://www.visualcrossing.com/weather-history/" + weather.latitude + "," + weather.longitude + "/"),
                timeZone: weather.timezone,
                tzOffset: weather.tzoffset,
            },
            coord: {
                lat: weather.latitude,
                lon: weather.longitude,
            },
            humidity: (_a = weather.currentConditions.humidity) !== null && _a !== void 0 ? _a : currentHour === null || currentHour === void 0 ? void 0 : currentHour.humidity,
            pressure: (_b = weather.currentConditions.pressure) !== null && _b !== void 0 ? _b : currentHour === null || currentHour === void 0 ? void 0 : currentHour.pressure,
            wind: {
                degree: (_c = weather.currentConditions.winddir) !== null && _c !== void 0 ? _c : currentHour === null || currentHour === void 0 ? void 0 : currentHour.winddir,
                speed: (_d = weather.currentConditions.windspeed) !== null && _d !== void 0 ? _d : currentHour === null || currentHour === void 0 ? void 0 : currentHour.windspeed,
            },
            temperature: CelsiusToKelvin((_e = weather.currentConditions.temp) !== null && _e !== void 0 ? _e : currentHour === null || currentHour === void 0 ? void 0 : currentHour.temp),
            sunrise: DateTime.fromSeconds(weather.currentConditions.sunriseEpoch, { zone: weather.timezone }),
            sunset: DateTime.fromSeconds(weather.currentConditions.sunsetEpoch, { zone: weather.timezone }),
            condition: this.GenerateCondition(weather.currentConditions.icon, weather.currentConditions.conditions, translate),
            extra_field: {
                name: _("Feels Like"),
                type: "temperature",
                value: CelsiusToKelvin((_f = currentHour === null || currentHour === void 0 ? void 0 : currentHour.feelslike) !== null && _f !== void 0 ? _f : weather.currentConditions.feelslike)
            },
            forecasts: this.ParseForecasts(weather.days, translate, weather.timezone),
            hourlyForecasts: this.ParseHourlyForecasts(weather.days, translate, weather.timezone)
        };
        return result;
    }
    ParseForecasts(forecasts, translate, tz) {
        let result = [];
        if (!!forecasts) {
            for (let index = 0; index < forecasts.length; index++) {
                const element = forecasts[index];
                result.push({
                    date: DateTime.fromSeconds(element.datetimeEpoch, { zone: tz }),
                    condition: this.GenerateCondition(element.icon, element.conditions, translate),
                    temp_max: CelsiusToKelvin(element.tempmax),
                    temp_min: CelsiusToKelvin(element.tempmin)
                });
            }
        }
        return result;
    }
    ParseHourlyForecasts(forecasts, translate, tz) {
        let currentHour = DateTime.utc().setZone(tz).set({ minute: 0, second: 0, millisecond: 0 });
        let result = [];
        if (!!forecasts) {
            for (let index = 0; index < forecasts.length; index++) {
                const element = forecasts[index];
                if (!element.hours)
                    continue;
                for (let index = 0; index < element.hours.length; index++) {
                    const hour = element.hours[index];
                    let time = DateTime.fromSeconds(hour.datetimeEpoch, { zone: tz });
                    if (time < currentHour)
                        continue;
                    let item = {
                        date: time,
                        temp: CelsiusToKelvin(hour.temp),
                        condition: this.GenerateCondition(hour.icon, hour.conditions, translate)
                    };
                    if (hour.preciptype != null) {
                        item.precipitation = {
                            type: hour.preciptype[0],
                            chance: hour.precipprob,
                            volume: hour.precip
                        };
                    }
                    result.push(item);
                }
            }
        }
        return result;
    }
    GetCurrentHour(forecasts, tz) {
        if (!forecasts || (forecasts === null || forecasts === void 0 ? void 0 : forecasts.length) < 1 || !forecasts[0].hours)
            return null;
        let currentHour = DateTime.utc().setZone(tz).set({ minute: 0, second: 0, millisecond: 0 });
        for (let index = 0; index < forecasts[0].hours.length; index++) {
            const hour = forecasts[0].hours[index];
            let time = DateTime.fromSeconds(hour.datetimeEpoch, { zone: tz });
            if (time < currentHour)
                continue;
            return hour;
        }
        return null;
    }
    GenerateCondition(icon, condition, translate) {
        let result = {
            main: (translate) ? this.ResolveTypeID(this.GetFirstCondition(condition)) : this.GetFirstCondition(condition),
            description: (translate) ? this.ResolveTypeIDs(condition) : condition,
            icons: [],
            customIcon: "refresh-symbolic"
        };
        switch (icon) {
            case "clear-day":
                result.icons = ["weather-clear"];
                result.customIcon = "day-sunny-symbolic";
                break;
            case "clear-night":
                result.icons = ["weather-clear-night"];
                result.customIcon = "night-clear-symbolic";
                break;
            case "partly-cloudy-day":
                result.icons = ["weather-few-clouds"];
                result.customIcon = "day-cloudy-symbolic";
                break;
            case "partly-cloudy-night":
                result.icons = ["weather-few-clouds-night"];
                result.customIcon = "night-alt-cloudy-symbolic";
                break;
            case "cloudy":
                result.icons = ["weather-overcast", "weather-clouds", "weather-many-clouds"];
                result.customIcon = "cloudy-symbolic";
                break;
            case "wind":
                result.icons = ["weather-windy", "weather-breeze"];
                result.customIcon = "windy-symbolic";
                break;
            case "fog":
                result.icons = ["weather-fog"];
                result.customIcon = "fog-symbolic";
                break;
            case "rain":
                result.icons = ["weather-rain", "weather-freezing-rain", "weather-snow-rain", "weather-showers"];
                result.customIcon = "rain-symbolic";
                break;
            case "snow":
                result.icons = ["weather-snow"];
                result.customIcon = "snow-symbolic";
                break;
        }
        return result;
    }
    GetFirstCondition(condition) {
        let split = condition.split(", ");
        return split[0];
    }
    ResolveTypeID(condition) {
        switch (condition.toLowerCase()) {
            case "type_1":
                return _("Blowing or drifting snow");
            case "type_2":
                return _("Drizzle");
            case "type_3":
                return _("Heavy drizzle");
            case "type_4":
                return _("Light drizzle");
            case "type_5":
                return _("Heavy drizzle/rain");
            case "type_6":
                return _("Light drizzle/rain");
            case "type_7":
                return _("Duststorm");
            case "type_8":
                return _("Fog");
            case "type_9":
                return _("Freezing drizzle/freezing rain");
            case "type_10":
                return _("Heavy freezing drizzle/freezing rain");
            case "type_11":
                return _("Light freezing drizzle/freezing rain");
            case "type_12":
                return _("Freezing fog");
            case "type_13":
                return _("Heavy freezing rain");
            case "type_14":
                return _("Light freezing rain");
            case "type_15":
                return _("Funnel cloud/tornado");
            case "type_16":
                return _("Hail showers");
            case "type_17":
                return _("Ice");
            case "type_18":
                return _("Lightning without thunder");
            case "type_19":
                return _("Mist");
            case "type_20":
                return _("Precipitation in vicinity");
            case "type_21":
                return _("Rain");
            case "type_22":
                return _("Heavy rain and snow");
            case "type_23":
                return _("Light rain And snow");
            case "type_24":
                return _("Rain showers");
            case "type_25":
                return _("Heavy rain");
            case "type_26":
                return _("Light rain");
            case "type_27":
                return _("Sky coverage decreasing");
            case "type_28":
                return _("Sky coverage increasing");
            case "type_29":
                return _("Sky unchanged");
            case "type_30":
                return _("Smoke or haze");
            case "type_31":
                return _("Snow");
            case "type_32":
                return _("Snow and rain showers");
            case "type_33":
                return _("Snow showers");
            case "type_34":
                return _("Heavy snow");
            case "type_35":
                return _("Light snow");
            case "type_36":
                return _("Squalls");
            case "type_37":
                return _("Thunderstorm");
            case "type_38":
                return _("Thunderstorm without precipitation");
            case "type_39":
                return _("Diamond dust");
            case "type_40":
                return _("Hail");
            case "type_41":
                return _("Overcast");
            case "type_42":
                return _("Partially cloudy");
            case "type_43":
                return _("Clear");
        }
        return condition;
    }
    ResolveTypeIDs(condition) {
        let result = "";
        let split = condition.split(", ");
        for (let index = 0; index < split.length; index++) {
            const element = split[index];
            result += this.ResolveTypeID(element);
            if (index < split.length - 1)
                result += ", ";
        }
        return result;
    }
    HandleHttpError(error) {
        if ((error === null || error === void 0 ? void 0 : error.code) == 401) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "bad key",
                message: _("Please make sure you entered the API key correctly")
            });
            return false;
        }
        return true;
    }
}

;// CONCATENATED MODULE: ./src/3_8/providers/climacellV4.ts


class ClimacellV4 {
    constructor(app) {
        this.needsApiKey = true;
        this.prettyName = _("Climacell");
        this.name = "ClimacellV4";
        this.maxForecastSupport = 15;
        this.maxHourlyForecastSupport = 108;
        this.website = "https://www.climacell.co/";
        this.url = "https://data.climacell.co/v4/timelines";
        this.params = {
            apikey: null,
            location: null,
            timesteps: "current,1h,1d",
            units: "metric",
            fields: "temperature,temperatureMax,temperatureMin,pressureSurfaceLevel,weatherCode,sunsetTime,sunriseTime,precipitationType,precipitationProbability,precipitationIntensity,windDirection,windSpeed,humidity,temperatureApparent"
        };
        this.app = app;
    }
    async GetWeather(loc) {
        if (loc == null)
            return null;
        this.params.apikey = this.app.config.ApiKey;
        this.params.location = loc.lat + "," + loc.lon;
        let response = await this.app.LoadJsonAsync(this.url, this.params, (m) => this.HandleHTTPError(m));
        if (response == null)
            return null;
        return this.ParseWeather(loc, response);
    }
    HandleHTTPError(message) {
        if (message.code == 401) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "no key",
                service: "climacell",
                message: _("Please Make sure you\nentered the API key that you have from Climacell")
            });
            return false;
        }
        return true;
    }
    ParseWeather(loc, data) {
        var _a, _b, _c, _d, _e;
        let current = (_b = (_a = data.data.timelines.find(x => x.timestep == "current")) === null || _a === void 0 ? void 0 : _a.intervals) === null || _b === void 0 ? void 0 : _b[0];
        let hourly = (_c = data.data.timelines.find(x => x.timestep == "1h")) === null || _c === void 0 ? void 0 : _c.intervals;
        let daily = (_d = data.data.timelines.find(x => x.timestep == "1d")) === null || _d === void 0 ? void 0 : _d.intervals;
        if (!current || !daily || !hourly || !((_e = daily[0]) === null || _e === void 0 ? void 0 : _e.values))
            return null;
        let result = {
            coord: {
                lat: loc.lat,
                lon: loc.lon
            },
            date: DateTime.fromISO(current.startTime, { zone: loc.timeZone }),
            condition: this.ResolveCondition(current.values.weatherCode),
            humidity: current.values.humidity,
            pressure: current.values.pressureSurfaceLevel,
            temperature: CelsiusToKelvin(current.values.temperature),
            wind: {
                degree: current.values.windDirection,
                speed: current.values.windSpeed
            },
            sunrise: DateTime.fromISO(daily[0].values.sunriseTime, { zone: loc.timeZone }),
            sunset: DateTime.fromISO(daily[0].values.sunsetTime, { zone: loc.timeZone }),
            location: {
                url: "https://www.climacell.co/weather"
            },
            extra_field: {
                name: _("Feels Like"),
                type: "temperature",
                value: CelsiusToKelvin(current.values.temperatureApparent)
            },
            forecasts: []
        };
        let hours = [];
        let days = [];
        for (let index = 0; index < daily.length; index++) {
            const element = daily[index];
            days.push({
                condition: this.ResolveCondition(element.values.weatherCode),
                date: DateTime.fromISO(element.startTime, { zone: loc.timeZone }),
                temp_max: CelsiusToKelvin(element.values.temperatureMax),
                temp_min: CelsiusToKelvin(element.values.temperatureMin)
            });
        }
        for (let index = 0; index < hourly.length; index++) {
            const element = hourly[index];
            let hour = {
                condition: this.ResolveCondition(element.values.weatherCode),
                date: DateTime.fromISO(element.startTime, { zone: loc.timeZone }),
                temp: CelsiusToKelvin(element.values.temperature)
            };
            hour.date = hour.date.set({ minute: 0, second: 0, millisecond: 0 });
            if (element.values.precipitationProbability > 0 && element.values.precipitationIntensity > 0) {
                hour.precipitation = {
                    chance: element.values.precipitationProbability,
                    volume: element.values.precipitationIntensity,
                    type: this.PrecipTypeToAppletType(element.values.precipitationType)
                };
            }
            hours.push(hour);
        }
        result.forecasts = days;
        result.hourlyForecasts = hours;
        return result;
    }
    ResolveCondition(weatherCode, isNight = false) {
        let result = {
            customIcon: "refresh-symbolic",
            icons: ["weather-severe-alert"],
            main: _("Unknown"),
            description: _("Unknown")
        };
        switch (weatherCode) {
            case 0:
                return result;
            case 1000:
                return {
                    main: isNight ? _("Clear") : _("Sunny"),
                    description: isNight ? _("Clear") : _("Sunny"),
                    customIcon: isNight ? "night-clear-symbolic" : "day-sunny-symbolic",
                    icons: isNight ? ["weather-clear-night"] : ["weather-clear"]
                };
            case 1001:
                return {
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", isNight ? "weather-clouds-night" : "weather-clouds"]
                };
            case 1100:
                return {
                    main: _("Mostly clear"),
                    description: _("Mostly clear"),
                    customIcon: isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: isNight ? ["weather-few-clouds-night", "weather-clouds-night"] : ["weather-few-clouds", "weather-clouds"]
                };
            case 1101:
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy"),
                    customIcon: isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: isNight ? ["weather-clouds-night", "weather-few-clouds-night"] : ["weather-clouds", "weather-few-clouds"]
                };
            case 1102:
                return {
                    main: _("Mostly cloudy"),
                    description: _("Mostly cloudy"),
                    customIcon: "cloud-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", isNight ? "weather-clouds-night" : "weather-clouds"]
                };
            case 2000:
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog"]
                };
            case 2100:
                return {
                    main: _("Fog"),
                    description: _("Light fog"),
                    customIcon: isNight ? "night-fog-symbolic" : "day-fog-symbolic",
                    icons: ["weather-fog"]
                };
            case 3000:
                return {
                    main: _("Wind"),
                    description: _("Light wind"),
                    customIcon: isNight ? "night-alt-wind-symbolic" : "day-windy-symbolic",
                    icons: ["weather-windy"]
                };
            case 3001:
                return {
                    main: _("Wind"),
                    description: _("Wind"),
                    customIcon: "windy-symbolic",
                    icons: ["weather-windy"]
                };
            case 3002:
                return {
                    main: _("Wind"),
                    description: _("Strong wind"),
                    customIcon: "windy-symbolic",
                    icons: ["weather-windy"]
                };
            case 4000:
                return {
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain"]
                };
            case 4001:
                return {
                    main: _("Rain"),
                    description: _("Rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-showers", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case 4200:
                return {
                    main: _("Rain"),
                    description: _("Light rain"),
                    customIcon: isNight ? "night-alt-rain-symbolic" : "day-rain-symbolic",
                    icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case 4201:
                return {
                    main: _("Rain"),
                    description: _("Heavy rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-showers", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case 5000:
                return {
                    main: _("Snow"),
                    description: _("Snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", isNight ? "weather-snow-night" : "weather-snow-day"]
                };
            case 5001:
                return {
                    main: _("Flurries"),
                    description: _("Flurries"),
                    customIcon: "snow-wind-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", isNight ? "weather-snow-night" : "weather-snow-day"]
                };
            case 5100:
                return {
                    main: _("Snow"),
                    description: _("Light snow"),
                    customIcon: isNight ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    icons: isNight ? ["weather-snow-scattered-night", "weather-snow-night", "weather-snow"] : ["weather-snow-scattered-day", "weather-snow-day", "weather-snow"]
                };
            case 5101:
                return {
                    main: _("Snow"),
                    description: _("Heavy snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered"]
                };
            case 6000:
                return {
                    main: _("Drizzle"),
                    description: _("Freezing drizzle"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 6001:
                return {
                    main: _("Rain"),
                    description: _("Freezing rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 6200:
                return {
                    main: _("Rain"),
                    description: _("Light freezing rain"),
                    customIcon: isNight ? "night-alt-rain-symbolic" : "day-rain-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 6201:
                return {
                    main: _("Rain"),
                    description: _("Heavy freezing rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 7000:
                return {
                    main: _("Ice pellets"),
                    description: _("Ice pellets"),
                    customIcon: "sleet-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 7101:
                return {
                    main: _("Ice pellets"),
                    description: _("Heavy ice pellets"),
                    customIcon: "sleet-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 7102:
                return {
                    main: _("Ice pellets"),
                    description: _("Light ice pellets"),
                    customIcon: isNight ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 8000:
                return {
                    main: _("Thunderstorm"),
                    description: _("Thunderstorm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm"]
                };
            default:
                return result;
        }
    }
    PrecipTypeToAppletType(type) {
        switch (type) {
            case 0:
                return "none";
            case 1:
                return "rain";
            case 2:
                return "snow";
            case 3:
                return "freezing rain";
            case 4:
                return "ice pellets";
            default:
                return "none";
        }
    }
}

;// CONCATENATED MODULE: ./src/3_8/providers/danishMI.ts


class DanishMI {
    constructor(app) {
        this.needsApiKey = false;
        this.prettyName = _("DMI Denmark");
        this.name = "DanishMI";
        this.maxForecastSupport = 10;
        this.maxHourlyForecastSupport = 48;
        this.website = "https://www.dmi.dk/";
        this.url = "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk";
        this.forecastParams = {
            cmd: "llj",
            lon: null,
            lat: null,
            tz: "UTC"
        };
        this.observationParams = {
            cmd: "obj",
            east: null,
            west: null,
            south: null,
            north: null
        };
        this.app = app;
    }
    async GetWeather(loc) {
        if (loc == null)
            return null;
        this.GetLocationBoundingBox(loc);
        let observations = this.OrderObservations(await this.app.LoadJsonAsync(this.url, this.observationParams), loc);
        this.forecastParams.lat = loc.lat;
        this.forecastParams.lon = loc.lon;
        let forecasts = await this.app.LoadJsonAsync(this.url, this.forecastParams);
        if (forecasts == null)
            return null;
        return this.ParseWeather(observations, forecasts, loc);
    }
    ParseWeather(observations, forecasts, loc) {
        var _a, _b, _c, _d, _e, _f;
        let observation = this.MergeObservations(observations);
        let result = {
            temperature: CelsiusToKelvin((_a = observation.Temperature2m) !== null && _a !== void 0 ? _a : null),
            condition: this.ResolveCondition(observation.symbol),
            humidity: observation.RelativeHumidity,
            pressure: (!observation.PressureMSL) ? null : observation.PressureMSL / 100,
            wind: {
                degree: observation.WindDirection,
                speed: observation.WindSpeed10m
            }
        };
        result.location = {
            city: forecasts.city,
            country: forecasts.country,
            timeZone: undefined,
            url: `https://www.dmi.dk/lokation/show/${forecasts.country}/${forecasts.id}`
        };
        result.coord = {
            lon: forecasts.longitude,
            lat: forecasts.latitude
        };
        result.date = DateTime.fromJSDate(this.DateStringToDate(forecasts.lastupdate), { zone: loc.timeZone });
        result.humidity = (_b = result.humidity) !== null && _b !== void 0 ? _b : forecasts.timeserie[0].humidity;
        result.pressure = (_c = result.pressure) !== null && _c !== void 0 ? _c : forecasts.timeserie[0].pressure;
        result.temperature = (_d = result.temperature) !== null && _d !== void 0 ? _d : CelsiusToKelvin(forecasts.timeserie[0].temp);
        result.wind.degree = (_e = result.wind.degree) !== null && _e !== void 0 ? _e : forecasts.timeserie[0].windDegree;
        result.wind.speed = (_f = result.wind.speed) !== null && _f !== void 0 ? _f : forecasts.timeserie[0].windSpeed;
        result.sunrise = DateTime.fromJSDate(this.DateStringToDate(forecasts.sunrise), { zone: loc.timeZone });
        result.sunset = DateTime.fromJSDate(this.DateStringToDate(forecasts.sunset), { zone: loc.timeZone });
        if (result.condition.customIcon == "alien-symbolic") {
            result.condition = this.ResolveCondition(forecasts.timeserie[0].symbol);
        }
        let forecastData = [];
        for (let index = 0; index < forecasts.aggData.length - 1; index++) {
            const element = forecasts.aggData[index];
            forecastData.push({
                date: DateTime.fromJSDate(this.DateStringToDate(element.time)).setZone(loc.timeZone, { keepLocalTime: true }),
                temp_max: CelsiusToKelvin(element.maxTemp),
                temp_min: CelsiusToKelvin(element.minTemp),
                condition: this.ResolveDailyCondition(forecasts.timeserie, DateTime.fromJSDate(this.DateStringToDate(element.time)).setZone(loc.timeZone, { keepLocalTime: true }))
            });
        }
        result.forecasts = forecastData;
        let hourlyData = [];
        for (let index = 0; index < forecasts.timeserie.length; index++) {
            const element = forecasts.timeserie[index];
            if (element.time == null)
                continue;
            let hour = {
                date: DateTime.fromJSDate(this.DateStringToDate(element.time), { zone: loc.timeZone }),
                temp: CelsiusToKelvin(element.temp),
                condition: this.ResolveCondition(element.symbol)
            };
            if (element.precip1 > 0.01 && element.precipType != null) {
                hour.precipitation = {
                    type: this.DanishPrecipToType(element.precipType),
                    volume: element.precip1
                };
            }
            hourlyData.push(hour);
        }
        result.hourlyForecasts = hourlyData;
        return result;
    }
    MergeObservations(observations) {
        var _a, _b, _c, _d, _e, _f;
        let result = {
            symbol: undefined,
            PressureMSL: undefined,
            Temperature2m: undefined,
            WindDirection: undefined,
            RelativeHumidity: undefined,
            WindSpeed10m: undefined,
        };
        for (let index = 0; index < observations.length; index++) {
            const element = observations[index];
            result.symbol = (_a = result.symbol) !== null && _a !== void 0 ? _a : element.values.symbol;
            result.PressureMSL = (_b = result.PressureMSL) !== null && _b !== void 0 ? _b : element.values.PressureMSL;
            result.Temperature2m = (_c = result.Temperature2m) !== null && _c !== void 0 ? _c : element.values.Temperature2m;
            result.WindDirection = (_d = result.WindDirection) !== null && _d !== void 0 ? _d : element.values.WindDirection;
            result.RelativeHumidity = (_e = result.RelativeHumidity) !== null && _e !== void 0 ? _e : element.values.RelativeHumidity;
            result.WindSpeed10m = (_f = result.WindSpeed10m) !== null && _f !== void 0 ? _f : element.values.WindSpeed10m;
        }
        return result;
    }
    ResolveDailyCondition(hourlyData, date) {
        let target = date.set({ hour: 6 });
        let upto = target.plus({ days: 1 });
        let relevantHours = hourlyData.filter((x) => {
            let hour = DateTime.fromJSDate(this.DateStringToDate(x.time), { zone: target.zoneName });
            if (hour >= target && hour < upto)
                return true;
            return false;
        });
        let normalizedSymbols = relevantHours.map(x => (x.symbol > 100) ? (x.symbol - 100) : x.symbol);
        let resultSymbol;
        if (!!normalizedSymbols.find(x => x > 10 && x != 45))
            resultSymbol = Math.max(...normalizedSymbols);
        else
            resultSymbol = mode(normalizedSymbols);
        return this.ResolveCondition(resultSymbol);
    }
    ResolveCondition(symbol) {
        if (symbol == null)
            return {
                main: _("NOT FOUND"),
                description: _("NOT FOUND"),
                customIcon: "alien-symbolic",
                icons: ["weather-severe-alert"]
            };
        let isNight = (symbol > 100);
        if (isNight)
            symbol = symbol - 100;
        switch (symbol) {
            case 1:
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    customIcon: isNight ? "night-clear-symbolic" : "day-sunny-symbolic",
                    icons: isNight ? ["weather-clear-night"] : ["weather-clear"]
                };
            case 2:
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy"),
                    customIcon: isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: isNight ? ["weather-few-clouds-night", "weather-clouds-night"] : ["weather-few-clouds", "weather-clouds"]
                };
            case 3:
                return {
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", "weather-clouds", "weather-few-clouds"]
                };
            case 38:
                return {
                    main: _("Snow"),
                    description: _("Blowing snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow"]
                };
            case 45:
                return {
                    main: _("Foggy"),
                    description: _("Foggy"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog"]
                };
            case 60:
                return {
                    main: _("Rain"),
                    description: _("Rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers"]
                };
            case 63:
                return {
                    main: _("Moderate rain"),
                    description: _("Moderate rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-showers", "weather-freezing-rain"]
                };
            case 68:
                return {
                    main: _("Rain and snow"),
                    description: _("Rain and snow"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-freezing-rain", "weather-rain"]
                };
            case 69:
                return {
                    main: _("Rain and snow"),
                    description: _("Heavy rain and snow"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-freezing-rain", "weather-rain"]
                };
            case 70:
                return {
                    main: _("Slight snow"),
                    description: _("Slight snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered"]
                };
            case 73:
                return {
                    main: _("Moderate snow"),
                    description: _("Moderate snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered"]
                };
            case 80:
                return {
                    main: _("Rain"),
                    description: _("Rain showers"),
                    customIcon: "showers-symbolic",
                    icons: ["weather-showers", "weather-freezing-rain", "weather-rain"]
                };
            case 81:
                return {
                    main: _("Rain showers"),
                    description: _("Moderate rain showers"),
                    customIcon: isNight ? "night-alt-showers-symbolic" : "day-showers-symbolic",
                    icons: isNight ? ["weather-showers-night", "weather-showers-scattered-night", "weather-showers-scattered", "weather-showers"] : ["weather-showers-day", "weather-showers-scattered-day", "weather-showers"]
                };
            case 83:
                return {
                    main: _("Rain and snow"),
                    description: _("Mixed rain and snow"),
                    customIcon: isNight ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-freezing-rain", "weather-snow-day", "weather-snow"]
                };
            case 84:
                return {
                    main: _("Rain and snow"),
                    description: _("Heavy mixed rain and snow"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-freezing-rain", "weather-snow-day", "weather-snow"]
                };
            case 85:
                return {
                    main: _("Snow"),
                    description: _("Snow showers"),
                    customIcon: isNight ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    icons: isNight ? ["weather-snow-night", "weather-snow"] : ["weather-snow-day", "weather-snow"]
                };
            case 86:
                return {
                    main: _("Heavy snow"),
                    description: _("Heavy snow showers"),
                    customIcon: "day-snow-symbolic",
                    icons: ["weather-snow-day", "weather-snow"]
                };
            case 95:
                return {
                    main: _("Thunderstorm"),
                    description: _("Thunderstorm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm"]
                };
            default: {
                return {
                    main: _("NOT FOUND"),
                    description: _("NOT FOUND"),
                    customIcon: "alien-symbolic",
                    icons: ["weather-severe-alert"]
                };
            }
        }
    }
    DanishPrecipToType(type) {
        switch (type) {
            case "sne":
                return "snow";
            case "regn":
                return "rain";
            case "slud":
                return "ice pellets";
            default:
                return "none";
        }
    }
    GetLocationBoundingBox(loc) {
        this.observationParams.west = loc.lon + 0.075;
        this.observationParams.east = loc.lon - 0.075;
        this.observationParams.north = loc.lat + 0.045;
        this.observationParams.south = loc.lat - 0.04;
    }
    OrderObservations(observations, loc) {
        let result = [];
        for (const key in observations) {
            const element = observations[key];
            result.push(Object.assign(Object.assign({}, element), { dist: GetDistance(loc.lat, loc.lon, element.latitude, element.longitude) }));
        }
        return this.SortObservationSites(result);
    }
    SortObservationSites(observations) {
        observations = observations.sort((a, b) => {
            if (a.dist < b.dist)
                return -1;
            if (a.dist == b.dist)
                return 0;
            return 1;
        });
        return observations;
    }
    DateStringToDate(str) {
        if (str.length == 14) {
            return new Date(Date.UTC(parseInt(str.substring(0, 4)), parseInt(str.substring(4, 6)) - 1, parseInt(str.substring(6, 8)), parseInt(str.substring(8, 10)), parseInt(str.substring(10, 12)), parseInt(str.substring(12, 14))));
        }
        else if (str.length == 8) {
            return new Date(Date.UTC(parseInt(str.substring(0, 4)), parseInt(str.substring(4, 6)) - 1, parseInt(str.substring(6, 8)), 0, 0, 0, 0));
        }
        else {
            if (str.length == 3) {
                str = ("0000" + str).substr(-4, 4);
            }
            let today = new Date();
            today.setUTCHours(parseInt(str.substring(0, 2)), parseInt(str.substring(2, 4)), 0, 0);
            return today;
        }
    }
}

;// CONCATENATED MODULE: ./src/3_8/main.ts

















const { TextIconApplet, AllowedLayout, MenuItem } = imports.ui.applet;
const { spawnCommandLine } = imports.misc.util;
const { IconType: main_IconType, Side: main_Side } = imports.gi.St;
class WeatherApplet extends TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.lock = false;
        this.refreshTriggeredWhileLocked = false;
        this.encounteredError = false;
        this.errMsg = {
            unknown: _("Error"),
            "bad api response - non json": _("Service Error"),
            "bad key": _("Incorrect API Key"),
            "bad api response": _("Service Error"),
            "bad location format": _("Incorrect Location Format"),
            "bad status code": _("Service Error"),
            "key blocked": _("Key Blocked"),
            "location not found": _("Can't find location"),
            "no api response": _("Service Error"),
            "no key": _("No Api Key"),
            "no location": _("No Location"),
            "no network response": _("Service Error"),
            "no response body": _("Service Error"),
            "no response data": _("Service Error"),
            "unusual payload": _("Service Error"),
            "import error": _("Missing Packages"),
            "location not covered": _("Location not covered"),
        };
        this.AppletDir = metadata.path;
        logger_Logger.Debug("Applet created with instanceID " + instanceId);
        logger_Logger.Debug("AppletDir is: " + this.AppletDir);
        this.SetAppletOnPanel();
        this.config = new Config(this, instanceId);
        this.AddRefreshButton();
        this.EnsureProvider();
        this.ui = new UI(this, orientation);
        this.ui.Rebuild(this.config);
        this.loop = new WeatherLoop(this, instanceId);
        this.orientation = orientation;
        try {
            this.setAllowedLayout(AllowedLayout.BOTH);
        }
        catch (e) {
        }
        this.loop.Start();
    }
    get Orientation() {
        return this.orientation;
    }
    Locked() {
        return this.lock;
    }
    RefreshAndRebuild(loc) {
        this.loop.Resume();
        if (this.Locked()) {
            this.refreshTriggeredWhileLocked = true;
            return;
        }
        this.RefreshWeather(true, loc);
    }
    ;
    async RefreshWeather(rebuild, location) {
        try {
            if (this.lock) {
                logger_Logger.Info("Refreshing in progress, refresh skipped.");
                return "locked";
            }
            this.lock = true;
            this.encounteredError = false;
            if (!location) {
                location = await this.config.EnsureLocation();
                if (!location) {
                    this.Unlock();
                    return "error";
                }
            }
            this.EnsureProvider();
            if (this.provider == null)
                return "fail";
            if (this.provider.needsApiKey && this.config.NoApiKey()) {
                logger_Logger.Error("No API Key given");
                this.ShowError({
                    type: "hard",
                    userError: true,
                    detail: "no key",
                    message: _("This provider requires an API key to operate")
                });
                return "fail";
            }
            let weatherInfo = await this.provider.GetWeather(location);
            if (weatherInfo == null) {
                this.Unlock();
                logger_Logger.Error("Could not refresh weather, data could not be obtained.");
                this.ShowError({
                    type: "hard",
                    detail: "no api response",
                    message: "API did not return data"
                });
                return "fail";
            }
            weatherInfo = this.MergeWeatherData(weatherInfo, location);
            this.config.Timezone = weatherInfo.location.timeZone;
            if (rebuild)
                this.ui.Rebuild(this.config);
            if (!this.ui.Display(weatherInfo, this.config, this.provider) ||
                !this.DisplayWeather(weatherInfo)) {
                this.Unlock();
                return "fail";
            }
            logger_Logger.Info("Weather Information refreshed");
            this.loop.ResetErrorCount();
            this.Unlock();
            return "success";
        }
        catch (e) {
            logger_Logger.Error("Generic Error while refreshing Weather info: " + e + ", ", e);
            this.ShowError({ type: "hard", detail: "unknown", message: _("Unexpected Error While Refreshing Weather, please see log in Looking Glass") });
            this.Unlock();
            return "fail";
        }
    }
    DisplayWeather(weather) {
        let location = GenerateLocationText(weather, this.config);
        let lastUpdatedTime = AwareDateString(weather.date, this.config.currentLocale, this.config._show24Hours, DateTime.local().zoneName);
        this.SetAppletTooltip(`${location} - ${_("As of {lastUpdatedTime}", { "lastUpdatedTime": lastUpdatedTime })}`);
        this.DisplayWeatherOnLabel(weather.temperature, weather.condition.description);
        this.SetAppletIcon(weather.condition.icons, weather.condition.customIcon);
        return true;
    }
    DisplayWeatherOnLabel(temperature, mainCondition) {
        var _a, _b;
        mainCondition = CapitalizeFirstLetter(mainCondition);
        let label = "";
        if (this.Orientation != main_Side.LEFT && this.Orientation != main_Side.RIGHT) {
            if (this.config._showCommentInPanel) {
                label += mainCondition;
            }
            if (this.config._showTextInPanel) {
                if (label != "") {
                    label += " ";
                }
                label += TempToUserConfig(temperature, this.config);
            }
        }
        else {
            if (this.config._showTextInPanel) {
                label = (_a = TempToUserConfig(temperature, this.config, false)) !== null && _a !== void 0 ? _a : "";
                if (this.GetPanelHeight() >= 35) {
                    label += UnitToUnicode(this.config.TemperatureUnit);
                }
            }
        }
        if (NotEmpty(this.config._tempTextOverride)) {
            label = this.config._tempTextOverride
                .replace("{t}", (_b = TempToUserConfig(temperature, this.config, false)) !== null && _b !== void 0 ? _b : "")
                .replace("{u}", UnitToUnicode(this.config.TemperatureUnit))
                .replace("{c}", mainCondition);
        }
        this.SetAppletLabel(label);
    }
    SetAppletTooltip(msg) {
        this.set_applet_tooltip(msg);
    }
    SetAppletIcon(iconNames, customIcon) {
        if (this.config._useCustomAppletIcons) {
            this.SetCustomIcon(customIcon);
        }
        else {
            let icon = WeatherIconSafely(iconNames, this.config.AppletIconType);
            this.config.AppletIconType == main_IconType.SYMBOLIC ?
                this.set_applet_icon_symbolic_name(icon) :
                this.set_applet_icon_name(icon);
        }
    }
    SetAppletLabel(label) {
        this.set_applet_label(label);
    }
    GetPanelHeight() {
        return this.panel.height;
    }
    GetMaxForecastDays() {
        if (!this.provider)
            return this.config._forecastDays;
        return Math.min(this.config._forecastDays, this.provider.maxForecastSupport);
    }
    GetMaxHourlyForecasts() {
        if (!this.provider)
            return this.config._forecastHours;
        return Math.min(this.config._forecastHours, this.provider.maxHourlyForecastSupport);
    }
    async LoadJsonAsync(url, params, HandleError, method = "GET") {
        let response = await HttpLib.Instance.LoadJsonAsync(url, params, method);
        if (!response.Success) {
            if (!!HandleError && !HandleError(response.ErrorData))
                return null;
            else {
                this.HandleHTTPError(response.ErrorData);
                return null;
            }
        }
        return response.Data;
    }
    async LoadAsync(url, params, HandleError, method = "GET") {
        let response = await HttpLib.Instance.LoadAsync(url, params, method);
        if (!response.Success) {
            if (!!HandleError && !HandleError(response.ErrorData))
                return null;
            else {
                this.HandleHTTPError(response.ErrorData);
                return null;
            }
        }
        return response.Data;
    }
    async locationLookup() {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
    }
    async submitIssue() {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://github.com/linuxmint/cinnamon-spices-applets/issues/new");
    }
    async saveCurrentLocation() {
        this.config.LocStore.SaveCurrentLocation(this.config.CurrentLocation);
    }
    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this.RefreshWeather(true);
    }
    ;
    on_applet_removed_from_panel(deleteConfig) {
        logger_Logger.Info("Removing applet instance...");
        this.loop.Stop();
    }
    on_applet_clicked(event) {
        this.ui.Toggle();
    }
    on_applet_middle_clicked(event) {
    }
    on_panel_height_changed() {
    }
    SetAppletOnPanel() {
        this.set_applet_icon_name(APPLET_ICON);
        this.set_applet_label(_("..."));
        this.set_applet_tooltip(_("Click to open"));
    }
    Unlock() {
        this.lock = false;
        if (this.refreshTriggeredWhileLocked) {
            logger_Logger.Info("Refreshing triggered by config change while refreshing, starting now...");
            this.refreshTriggeredWhileLocked = false;
            this.RefreshAndRebuild();
        }
    }
    AddRefreshButton() {
        let itemLabel = _("Refresh");
        let refreshMenuItem = new MenuItem(itemLabel, REFRESH_ICON, () => this.RefreshAndRebuild());
        this._applet_context_menu.addMenuItem(refreshMenuItem);
    }
    HandleHTTPError(error) {
        let appletError = {
            detail: error.message,
            userError: false,
            code: error.code,
            message: this.errMsg[error.message],
            type: "soft"
        };
        switch (error.message) {
            case "bad status code":
            case "unknown":
                appletError.type = "hard";
        }
        this.ShowError(appletError);
    }
    SetCustomIcon(iconName) {
        this.set_applet_icon_symbolic_name(iconName);
    }
    EnsureProvider(force = false) {
        var _a;
        let currentName = (_a = this.provider) === null || _a === void 0 ? void 0 : _a.name;
        switch (this.config._dataService) {
            case "DarkSky":
                if (currentName != "DarkSky" || force)
                    this.provider = new DarkSky(this);
                break;
            case "OpenWeatherMap":
                if (currentName != "OpenWeatherMap" || force)
                    this.provider = new OpenWeatherMap(this);
                break;
            case "MetNorway":
                if (currentName != "MetNorway" || force)
                    this.provider = new MetNorway(this);
                break;
            case "Weatherbit":
                if (currentName != "Weatherbit" || force)
                    this.provider = new Weatherbit(this);
                break;
            case "ClimacellV4":
                if (currentName != "ClimacellV4" || force)
                    this.provider = new ClimacellV4(this);
                break;
            case "Met Office UK":
                if (currentName != "Met Office UK" || force)
                    this.provider = new MetUk(this);
                break;
            case "US Weather":
                if (currentName != "US Weather" || force)
                    this.provider = new USWeather(this);
                break;
            case "Visual Crossing":
                if (currentName != "Visual Crossing" || force)
                    this.provider = new VisualCrossing(this);
                break;
            case "DanishMI":
                if (currentName != "DanishMI" || force)
                    this.provider = new DanishMI(this);
                break;
            default:
                logger_Logger.Error(`Provider string "${currentName}" from settings doesn't exist, please contact the developer!`);
                this.DisplayHardError("Critical Error", "Please see logs and contact developer");
        }
    }
    MergeWeatherData(weatherInfo, locationData) {
        if (weatherInfo.location.city == null)
            weatherInfo.location.city = locationData.city;
        if (weatherInfo.location.country == null)
            weatherInfo.location.country = locationData.country;
        if (weatherInfo.location.timeZone == null)
            weatherInfo.location.timeZone = locationData.timeZone;
        if (weatherInfo.coord.lat == null)
            weatherInfo.coord.lat = locationData.lat;
        if (weatherInfo.coord.lon == null)
            weatherInfo.coord.lon = locationData.lon;
        if (weatherInfo.hourlyForecasts == null)
            weatherInfo.hourlyForecasts = [];
        weatherInfo.condition.main = ProcessCondition(weatherInfo.condition.main, this.config._translateCondition);
        weatherInfo.condition.description = ProcessCondition(weatherInfo.condition.description, this.config._translateCondition);
        for (let index = 0; index < weatherInfo.forecasts.length; index++) {
            const condition = weatherInfo.forecasts[index].condition;
            condition.main = ProcessCondition(condition.main, this.config._translateCondition);
            condition.description = ProcessCondition(condition.description, this.config._translateCondition);
        }
        for (let index = 0; index < weatherInfo.hourlyForecasts.length; index++) {
            const condition = weatherInfo.hourlyForecasts[index].condition;
            condition.main = ProcessCondition(condition.main, this.config._translateCondition);
            condition.description = ProcessCondition(condition.description, this.config._translateCondition);
        }
        return weatherInfo;
    }
    DisplayHardError(title, msg) {
        this.set_applet_label(title);
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this.ui.DisplayErrorMessage(msg, "hard");
    }
    ;
    ShowError(error) {
        if (error == null)
            return;
        if (this.encounteredError == true)
            return;
        this.encounteredError = true;
        logger_Logger.Debug("User facing Error received, error: " + JSON.stringify(error, null, 2));
        if (error.type == "hard") {
            logger_Logger.Debug("Displaying hard error");
            this.ui.Rebuild(this.config);
            this.DisplayHardError(this.errMsg[error.detail], (!error.message) ? "" : error.message);
        }
        if (error.type == "soft") {
            if (this.loop.IsDataTooOld()) {
                this.set_applet_tooltip("Click to open");
                this.set_applet_icon_name("weather-severe-alert");
                this.ui.DisplayErrorMessage(_("Could not update weather for a while...\nare you connected to the internet?"), "soft");
            }
        }
        if (error.userError) {
            logger_Logger.Error("Error received caused by User, Pausing main loop.");
            this.loop.Pause();
            return;
        }
        let nextRefresh = this.loop.GetSecondsUntilNextRefresh();
        logger_Logger.Error("Retrying in the next " + nextRefresh.toString() + " seconds...");
    }
}

;// CONCATENATED MODULE: ./src/3_8/applet.ts



function main(metadata, orientation, panelHeight, instanceId) {
    imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
    imports.gi.Gtk.IconTheme.get_default().append_search_path(metadata.path + "/../icons");
    imports.gi.Gtk.IconTheme.get_default().append_search_path(metadata.path + "/../arrow-icons");
    logger_Logger.UpdateInstanceID(instanceId);
    return new WeatherApplet(metadata, orientation, panelHeight, instanceId);
}

})();

weatherApplet = __webpack_exports__;
/******/ })()
;