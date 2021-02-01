"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setInterval = exports.clearTimeout = exports.delay = exports.setTimeout = exports.Guid = exports.GetFuncName = exports.GetDistance = exports.ConstructJsLocale = exports.ShadeHexColor = exports.WeatherIconSafely = exports.IsLangSupported = exports.NotEmpty = exports.IsCoordinate = exports.IsNight = exports.CompassDirection = exports.CompassToDeg = exports.KmToM = exports.MPHtoMPS = exports.FahrenheitToKelvin = exports.CelsiusToKelvin = exports.KPHtoMPS = exports.MillimeterToUserUnits = exports.MetreToUserUnits = exports.PressToUserUnits = exports.TempToUserConfig = exports.MPStoUserUnits = exports.ProcessCondition = exports.MilitaryTime = exports.AwareDateString = exports.GetHoursMinutes = exports.GetDayName = exports.CapitalizeEveryLetter = exports.CapitalizeFirstLetter = exports.GenerateLocationText = exports.UnitToUnicode = exports.format = exports._ = void 0;
const consts_1 = require("./consts");
const { timeout_add, source_remove } = imports.mainloop;
const { IconType } = imports.gi.St;
const { IconTheme } = imports.gi.Gtk;
function _(str, args) {
    let result = imports.gettext.dgettext(consts_1.UUID, str);
    if (result === str && result === "")
        result = imports.gettext.gettext(str);
    if (!!args)
        result = format(result, args);
    return result;
}
exports._ = _;
function format(str, args) {
    for (let key in args) {
        str = str.replace(new RegExp("\\{" + key + "\\}"), args[key]);
    }
    return str;
}
exports.format = format;
function UnitToUnicode(unit) {
    return unit == "fahrenheit" ? '\u2109' : '\u2103';
}
exports.UnitToUnicode = UnitToUnicode;
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
exports.GenerateLocationText = GenerateLocationText;
function CapitalizeFirstLetter(description) {
    if ((description == undefined || description == null)) {
        return "";
    }
    return description.charAt(0).toUpperCase() + description.slice(1);
}
exports.CapitalizeFirstLetter = CapitalizeFirstLetter;
;
function CapitalizeEveryLetter(description) {
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
exports.CapitalizeEveryLetter = CapitalizeEveryLetter;
function GetDayName(date, locale, showDate = false, tz) {
    if (locale == "c" || locale == null)
        locale = undefined;
    let params = {
        weekday: "long",
        timeZone: tz
    };
    if (!tz || tz == "")
        params.timeZone = undefined;
    if (showDate) {
        params.day = 'numeric';
    }
    let now = new Date();
    let tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    if (date.getDate() == now.getDate() || date.getDate() == tomorrow.getDate())
        delete params.weekday;
    let dateString = date.toLocaleString(locale, params);
    if (date.getDate() == now.getDate())
        dateString = _("Today");
    if (date.getDate() == tomorrow.getDate())
        dateString = _("Tomorrow");
    return dateString;
}
exports.GetDayName = GetDayName;
function GetHoursMinutes(date, locale, hours24Format, tz, onlyHours = false) {
    if (locale == "c" || locale == null)
        locale = undefined;
    let params = {
        hour: "numeric",
        hour12: !hours24Format,
        timeZone: tz
    };
    if (!tz || tz == "")
        params.timeZone = undefined;
    if (!onlyHours)
        params.minute = "2-digit";
    return date.toLocaleString(locale, params);
}
exports.GetHoursMinutes = GetHoursMinutes;
function AwareDateString(date, locale, hours24Format, tz) {
    if (locale == "c" || locale == null)
        locale = undefined;
    let now = new Date();
    let params = {
        hour: "numeric",
        minute: "2-digit",
        hour12: !hours24Format,
        timeZone: tz
    };
    if (date.toDateString() != now.toDateString()) {
        params.month = "short";
        params.day = "numeric";
    }
    if (date.getFullYear() != now.getFullYear()) {
        params.year = "numeric";
    }
    if (!tz || tz == "")
        params.timeZone = tz;
    return date.toLocaleString(locale, params);
}
exports.AwareDateString = AwareDateString;
function MilitaryTime(date) {
    return date.getHours() * 100 + date.getMinutes();
}
exports.MilitaryTime = MilitaryTime;
function ProcessCondition(condition, shouldTranslate) {
    if (condition == null)
        return null;
    condition = CapitalizeFirstLetter(condition);
    if (shouldTranslate)
        condition = _(condition);
    return condition;
}
exports.ProcessCondition = ProcessCondition;
const WEATHER_CONV_MPH_IN_MPS = 2.23693629;
const WEATHER_CONV_KPH_IN_MPS = 3.6;
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449;
function MPStoUserUnits(mps, units) {
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
    }
}
exports.MPStoUserUnits = MPStoUserUnits;
function TempToUserConfig(kelvin, units, russianStyle) {
    if (kelvin == null)
        return null;
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
}
exports.TempToUserConfig = TempToUserConfig;
function PressToUserUnits(hpa, units) {
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
}
exports.PressToUserUnits = PressToUserUnits;
;
function MetreToUserUnits(m, distanceUnit) {
    if (distanceUnit == "metric")
        return Math.round(m / 1000 * 10) / 10;
    return Math.round(KmToM(m / 1000) * 10) / 10;
}
exports.MetreToUserUnits = MetreToUserUnits;
function MillimeterToUserUnits(mm, distanceUnit) {
    if (distanceUnit == "metric")
        return Math.round(mm * 100) / 100;
    return Math.round(mm * 0.03937 * 100) / 100;
}
exports.MillimeterToUserUnits = MillimeterToUserUnits;
function KPHtoMPS(speed) {
    if (speed == null)
        return null;
    return speed / WEATHER_CONV_KPH_IN_MPS;
}
exports.KPHtoMPS = KPHtoMPS;
;
function CelsiusToKelvin(celsius) {
    if (celsius == null)
        return null;
    return (celsius + 273.15);
}
exports.CelsiusToKelvin = CelsiusToKelvin;
function FahrenheitToKelvin(fahrenheit) {
    if (fahrenheit == null)
        return null;
    return ((fahrenheit - 32) / 1.8 + 273.15);
}
exports.FahrenheitToKelvin = FahrenheitToKelvin;
;
function MPHtoMPS(speed) {
    if (speed == null || speed == undefined)
        return null;
    return speed * 0.44704;
}
exports.MPHtoMPS = MPHtoMPS;
function KmToM(km) {
    if (km == null)
        return null;
    return km * 0.6213712;
}
exports.KmToM = KmToM;
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
exports.CompassToDeg = CompassToDeg;
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
exports.CompassDirection = CompassDirection;
function IsNight(sunTimes, date) {
    if (!sunTimes)
        return false;
    let time = (!!date) ? MilitaryTime(date) : MilitaryTime(new Date());
    let sunrise = MilitaryTime(sunTimes.sunrise);
    let sunset = MilitaryTime(sunTimes.sunset);
    if (time >= sunrise && time < sunset)
        return false;
    return true;
}
exports.IsNight = IsNight;
function IsCoordinate(text) {
    text = text.trim();
    if (/^-?\d{1,3}(?:\.\d*)?,(\s)*-?\d{1,3}(?:\.\d*)?/.test(text)) {
        return true;
    }
    return false;
}
exports.IsCoordinate = IsCoordinate;
function NotEmpty(str) {
    return (str != null && str.length > 0 && str != undefined);
}
exports.NotEmpty = NotEmpty;
function IsLangSupported(lang, languages) {
    return (languages.includes(lang));
}
exports.IsLangSupported = IsLangSupported;
;
function HasIcon(icon, icon_type) {
    return IconTheme.get_default().has_icon(icon + (icon_type == IconType.SYMBOLIC ? '-symbolic' : ''));
}
function WeatherIconSafely(code, icon_type) {
    for (let i = 0; i < code.length; i++) {
        if (HasIcon(code[i], icon_type))
            return code[i];
    }
    return 'weather-severe-alert';
}
exports.WeatherIconSafely = WeatherIconSafely;
function ShadeHexColor(color, percent) {
    var f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}
exports.ShadeHexColor = ShadeHexColor;
function ConstructJsLocale(locale) {
    let jsLocale = locale.split(".")[0];
    let tmp = jsLocale.split("_");
    jsLocale = "";
    for (let i = 0; i < tmp.length; i++) {
        if (i != 0)
            jsLocale += "-";
        jsLocale += tmp[i].toLowerCase();
    }
    return jsLocale;
}
exports.ConstructJsLocale = ConstructJsLocale;
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
exports.GetDistance = GetDistance;
function GetFuncName(func) {
    if (!!func.name)
        return func.name;
    var result = /^function\s+([\w\$]+)\s*\(/.exec(func.toString());
    return result ? result[1] : '';
}
exports.GetFuncName = GetFuncName;
function Guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
exports.Guid = Guid;
function setTimeout(func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = timeout_add(ms, () => {
        func.apply(null, args);
        return false;
    }, null);
    return id;
}
exports.setTimeout = setTimeout;
;
async function delay(ms) {
    return await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}
exports.delay = delay;
function clearTimeout(id) {
    source_remove(id);
}
exports.clearTimeout = clearTimeout;
;
function setInterval(func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = timeout_add(ms, () => {
        func.apply(null, args);
        return true;
    }, null);
    return id;
}
exports.setInterval = setInterval;
;
