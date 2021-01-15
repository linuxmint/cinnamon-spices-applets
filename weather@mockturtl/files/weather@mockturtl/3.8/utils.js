"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constructJsLocale = exports.shadeHexColor = exports.hasIcon = exports.weatherIconSafely = exports.Sentencify = exports.isLangSupported = exports.compassDirection = exports.nonempty = exports.isCoordinate = exports.isID = exports.isString = exports.isNumeric = exports.MillimeterToUserUnits = exports.MetreToUserUnits = exports.KmToM = exports.PressToUserUnits = exports.MPHtoMPS = exports.FahrenheitToKelvin = exports.CelsiusToKelvin = exports.TempToUserConfig = exports.MPStoUserUnits = exports.GetFuncName = exports.get = exports.KPHtoMPS = exports.capitalizeFirstLetter = exports.timeToUserUnits = exports.compassToDeg = exports.IsNight = exports.MilitaryTime = exports.getDayName = exports.AwareDateString = exports.GetHoursMinutes = exports.GetDayName = exports.isLocaleStringSupported = exports.clearInterval = exports.GetDistance = exports.setInterval = exports.clearTimeout = exports.delay = exports.setTimeout = exports._ = void 0;
const { timeout_add, source_remove } = imports.mainloop;
const { util_format_date } = imports.gi.Cinnamon;
const { IconType } = imports.gi.St;
const { IconTheme } = imports.gi.Gtk;
const UUID = "weather@mockturtl";
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
var _ = (str) => {
    let customTrans = imports.gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return imports.gettext.gettext(str);
};
exports._ = _;
var setTimeout = function (func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = timeout_add(ms, () => {
        func.apply(null, args);
        return false;
    }, null);
    return id;
};
exports.setTimeout = setTimeout;
var delay = async (ms) => {
    return await new Promise((resolve, reject) => {
        exports.setTimeout(() => {
            resolve();
        }, ms);
    });
};
exports.delay = delay;
const clearTimeout = (id) => {
    source_remove(id);
};
exports.clearTimeout = clearTimeout;
const setInterval = function (func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = timeout_add(ms, () => {
        func.apply(null, args);
        return true;
    }, null);
    return id;
};
exports.setInterval = setInterval;
var GetDistance = (lat1, lon1, lat2, lon2) => {
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
};
exports.GetDistance = GetDistance;
const clearInterval = (id) => {
    source_remove(id);
};
exports.clearInterval = clearInterval;
var isLocaleStringSupported = () => {
    let date = new Date(1565548657987);
    try {
        let output = date.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: "numeric" });
        if (output !== "19")
            return "none";
        return "full";
    }
    catch (e) {
        return "notz";
    }
};
exports.isLocaleStringSupported = isLocaleStringSupported;
var GetDayName = (date, locale, showDate = false, tz) => {
    let support = exports.isLocaleStringSupported();
    if (locale == "c" || locale == null)
        locale = undefined;
    if (!tz && support == "full")
        support = "notz";
    let params = {
        weekday: "long"
    };
    if (showDate) {
        params["day"] = 'numeric';
    }
    let now = new Date();
    let tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    if (date.getDate() == now.getDate() || date.getDate() == tomorrow.getDate())
        delete params.weekday;
    let dateString = "";
    switch (support) {
        case "full":
            params.timeZone = tz;
            dateString = date.toLocaleString(locale, params);
            break;
        case "notz":
            params.timeZone = "UTC";
            dateString = date.toLocaleString(locale, params);
            break;
        case "none":
            dateString = exports.getDayName(date.getUTCDay());
            break;
    }
    if (date.getDate() == now.getDate())
        dateString = exports._("Today");
    if (date.getDate() == tomorrow.getDate())
        dateString = exports._("Tomorrow");
    return dateString;
};
exports.GetDayName = GetDayName;
var GetHoursMinutes = (date, locale, hours24Format, tz, onlyHours = false) => {
    let support = exports.isLocaleStringSupported();
    if (locale == "c" || locale == null)
        locale = undefined;
    if (!tz && support == "full")
        support = "notz";
    let params = {
        hour: "numeric",
        hour12: !hours24Format
    };
    if (!onlyHours)
        params.minute = "numeric";
    switch (support) {
        case "full":
            params.timeZone = tz;
            return date.toLocaleString(locale, params);
        case "notz":
            return date.toLocaleString(locale, params);
        case "none":
            return exports.timeToUserUnits(date, hours24Format);
    }
};
exports.GetHoursMinutes = GetHoursMinutes;
var AwareDateString = (date, locale, hours24Format, tz) => {
    let support = exports.isLocaleStringSupported();
    if (locale == "c" || locale == null)
        locale = undefined;
    let now = new Date();
    let params = {
        hour: "numeric",
        minute: "numeric",
        hour12: !hours24Format
    };
    if (date.toDateString() != now.toDateString()) {
        params.month = "short";
        params.day = "numeric";
    }
    if (date.getFullYear() != now.getFullYear()) {
        params.year = "numeric";
    }
    switch (support) {
        case "full":
            if (tz == null || tz == "")
                tz = undefined;
            params.timeZone = tz;
            return date.toLocaleString(locale, params);
        case "notz":
            return date.toLocaleString(locale, params);
        case "none":
            return exports.timeToUserUnits(date, hours24Format);
    }
};
exports.AwareDateString = AwareDateString;
var getDayName = (dayNum) => {
    let days = [exports._('Sunday'), exports._('Monday'), exports._('Tuesday'), exports._('Wednesday'), exports._('Thursday'), exports._('Friday'), exports._('Saturday')];
    return days[dayNum];
};
exports.getDayName = getDayName;
var MilitaryTime = (date) => {
    return date.getHours() * 100 + date.getMinutes();
};
exports.MilitaryTime = MilitaryTime;
var IsNight = (sunTimes, date) => {
    if (!sunTimes)
        return false;
    let time = (!!date) ? exports.MilitaryTime(date) : exports.MilitaryTime(new Date());
    let sunrise = exports.MilitaryTime(sunTimes.sunrise);
    let sunset = exports.MilitaryTime(sunTimes.sunset);
    if (time >= sunrise && time < sunset)
        return false;
    return true;
};
exports.IsNight = IsNight;
var compassToDeg = (compass) => {
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
};
exports.compassToDeg = compassToDeg;
var timeToUserUnits = (date, show24Hours) => {
    let timeStr = util_format_date('%H:%M', date.getTime());
    let time = timeStr.split(':');
    if (time[0].charAt(0) == "0") {
        time[0] = time[0].substr(1);
    }
    if (show24Hours) {
        return time[0] + ":" + time[1];
    }
    else {
        if (parseInt(time[0]) > 12) {
            return (parseInt(time[0]) - 12) + ":" + time[1] + " pm";
        }
        else {
            return time[0] + ":" + time[1] + " am";
        }
    }
};
exports.timeToUserUnits = timeToUserUnits;
const WEATHER_CONV_MPH_IN_MPS = 2.23693629;
const WEATHER_CONV_KPH_IN_MPS = 3.6;
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449;
var capitalizeFirstLetter = (description) => {
    if ((description == undefined || description == null)) {
        return "";
    }
    return description.charAt(0).toUpperCase() + description.slice(1);
};
exports.capitalizeFirstLetter = capitalizeFirstLetter;
var KPHtoMPS = (speed) => {
    if (speed == null)
        return null;
    return speed / WEATHER_CONV_KPH_IN_MPS;
};
exports.KPHtoMPS = KPHtoMPS;
const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
exports.get = get;
var GetFuncName = (func) => {
    if (!!func.name)
        return func.name;
    var result = /^function\s+([\w\$]+)\s*\(/.exec(func.toString());
    return result ? result[1] : '';
};
exports.GetFuncName = GetFuncName;
var MPStoUserUnits = (mps, units) => {
    if (mps == null)
        return null;
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
                return "0 (" + exports._("Calm") + ")";
            }
            if (mps < 1.5) {
                return "1 (" + exports._("Light air") + ")";
            }
            if (mps < 3.3) {
                return "2 (" + exports._("Light breeze") + ")";
            }
            if (mps < 5.5) {
                return "3 (" + exports._("Gentle breeze") + ")";
            }
            if (mps < 7.9) {
                return "4 (" + exports._("Moderate breeze") + ")";
            }
            if (mps < 10.7) {
                return "5 (" + exports._("Fresh breeze") + ")";
            }
            if (mps < 13.8) {
                return "6 (" + exports._("Strong breeze") + ")";
            }
            if (mps < 17.1) {
                return "7 (" + exports._("Near gale") + ")";
            }
            if (mps < 20.7) {
                return "8 (" + exports._("Gale") + ")";
            }
            if (mps < 24.4) {
                return "9 (" + exports._("Strong gale") + ")";
            }
            if (mps < 28.4) {
                return "10 (" + exports._("Storm") + ")";
            }
            if (mps < 32.6) {
                return "11 (" + exports._("Violent storm") + ")";
            }
            return "12 (" + exports._("Hurricane") + ")";
    }
};
exports.MPStoUserUnits = MPStoUserUnits;
var TempToUserConfig = (kelvin, units, russianStyle) => {
    let temp;
    if (units == "celsius") {
        temp = Math.round((kelvin - 273.15));
    }
    if (units == "fahrenheit") {
        temp = Math.round((9 / 5 * (kelvin - 273.15) + 32));
    }
    if (!russianStyle)
        return temp.toString();
    if (temp < 0)
        temp = "−" + Math.abs(temp).toString();
    else if (temp > 0)
        temp = "+" + temp.toString();
    return temp.toString();
};
exports.TempToUserConfig = TempToUserConfig;
var CelsiusToKelvin = (celsius) => {
    if (celsius == null)
        return null;
    return (celsius + 273.15);
};
exports.CelsiusToKelvin = CelsiusToKelvin;
var FahrenheitToKelvin = (fahr) => {
    if (fahr == null)
        return null;
    return ((fahr - 32) / 1.8 + 273.15);
};
exports.FahrenheitToKelvin = FahrenheitToKelvin;
var MPHtoMPS = (speed) => {
    if (speed == null || speed == undefined)
        return null;
    return speed * 0.44704;
};
exports.MPHtoMPS = MPHtoMPS;
var PressToUserUnits = (hpa, units) => {
    switch (units) {
        case "hPa":
            return hpa;
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
};
exports.PressToUserUnits = PressToUserUnits;
var KmToM = (km) => {
    if (km == null)
        return null;
    return km * 0.6213712;
};
exports.KmToM = KmToM;
var MetreToUserUnits = (m, distanceUnit) => {
    if (distanceUnit == "metric")
        return Math.round(m / 1000 * 10) / 10;
    return Math.round(exports.KmToM(m / 1000) * 10) / 10;
};
exports.MetreToUserUnits = MetreToUserUnits;
var MillimeterToUserUnits = (mm, distanceUnit) => {
    if (distanceUnit == "metric")
        return Math.round(mm * 100) / 100;
    return Math.round(mm * 0.03937 * 100) / 100;
};
exports.MillimeterToUserUnits = MillimeterToUserUnits;
var isNumeric = (n) => {
    return !isNaN(parseFloat(n)) && isFinite(n);
};
exports.isNumeric = isNumeric;
var isString = (text) => {
    if (typeof text == 'string' || text instanceof String) {
        return true;
    }
    return false;
};
exports.isString = isString;
var isID = (text) => {
    if (text.length == 7 && exports.isNumeric(text)) {
        return true;
    }
    return false;
};
exports.isID = isID;
var isCoordinate = (text) => {
    text = text.trim();
    if (/^-?\d{1,3}(?:\.\d*)?,(\s)*-?\d{1,3}(?:\.\d*)?/.test(text)) {
        return true;
    }
    return false;
};
exports.isCoordinate = isCoordinate;
var nonempty = (str) => {
    return (str != null && str.length > 0 && str != undefined);
};
exports.nonempty = nonempty;
var compassDirection = (deg) => {
    let directions = [exports._('N'), exports._('NE'), exports._('E'), exports._('SE'), exports._('S'), exports._('SW'), exports._('W'), exports._('NW')];
    return directions[Math.round(deg / 45) % directions.length];
};
exports.compassDirection = compassDirection;
var isLangSupported = (lang, languages) => {
    if (languages.indexOf(lang) != -1) {
        return true;
    }
    return false;
};
exports.isLangSupported = isLangSupported;
var Sentencify = (words) => {
    let result = "";
    for (let index = 0; index < words.length; index++) {
        const element = words[index];
        if (index != 0)
            result += " ";
        result += element;
    }
    return result;
};
exports.Sentencify = Sentencify;
var weatherIconSafely = (code, icon_type) => {
    for (let i = 0; i < code.length; i++) {
        if (exports.hasIcon(code[i], icon_type))
            return code[i];
    }
    return 'weather-severe-alert';
};
exports.weatherIconSafely = weatherIconSafely;
var hasIcon = (icon, icon_type) => {
    return IconTheme.get_default().has_icon(icon + (icon_type == IconType.SYMBOLIC ? '-symbolic' : ''));
};
exports.hasIcon = hasIcon;
var shadeHexColor = (color, percent) => {
    var f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
};
exports.shadeHexColor = shadeHexColor;
var constructJsLocale = (locale) => {
    let jsLocale = locale.split(".")[0];
    let tmp = jsLocale.split("_");
    jsLocale = "";
    for (let i = 0; i < tmp.length; i++) {
        if (i != 0)
            jsLocale += "-";
        jsLocale += tmp[i].toLowerCase();
    }
    return jsLocale;
};
exports.constructJsLocale = constructJsLocale;
