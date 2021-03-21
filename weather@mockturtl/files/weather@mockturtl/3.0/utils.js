var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a = imports.mainloop, timeout_add = _a.timeout_add, source_remove = _a.source_remove;
var util_format_date = imports.gi.Cinnamon.util_format_date;
var IconType = imports.gi.St.IconType;
var IconTheme = imports.gi.Gtk.IconTheme;
var UUID = "weather@mockturtl";
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
var _ = function (str) {
    var customTrans = imports.gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return imports.gettext.gettext(str);
};
var setTimeout = function (func, ms) {
    var args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    var id = timeout_add(ms, function () {
        func.apply(null, args);
        return false;
    }, null);
    return id;
};
var delay = function (ms) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4, new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        resolve();
                    }, ms);
                })];
            case 1: return [2, _a.sent()];
        }
    });
}); };
var clearTimeout = function (id) {
    source_remove(id);
};
var setInterval = function (func, ms) {
    var args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    var id = timeout_add(ms, function () {
        func.apply(null, args);
        return true;
    }, null);
    return id;
};
var GetDistance = function (lat1, lon1, lat2, lon2) {
    var R = 6371e3;
    var φ1 = lat1 * Math.PI / 180;
    var φ2 = lat2 * Math.PI / 180;
    var Δφ = (lat2 - lat1) * Math.PI / 180;
    var Δλ = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
var clearInterval = function (id) {
    source_remove(id);
};
var isLocaleStringSupported = function () {
    var date = new Date(1565548657987);
    try {
        var output = date.toLocaleString('en-GB', { timeZone: 'Europe/London', hour: "numeric" });
        if (output !== "19")
            return "none";
        return "full";
    }
    catch (e) {
        return "notz";
    }
};
var GetDayName = function (date, locale, showDate, tz) {
    if (showDate === void 0) { showDate = false; }
    var support = isLocaleStringSupported();
    if (locale == "c" || locale == null)
        locale = undefined;
    if (!tz && support == "full")
        support = "notz";
    var params = {
        weekday: "long"
    };
    if (showDate) {
        params["day"] = 'numeric';
    }
    var now = new Date();
    var tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    if (date.getDate() == now.getDate() || date.getDate() == tomorrow.getDate())
        delete params.weekday;
    var dateString = "";
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
            dateString = getDayName(date.getUTCDay());
            break;
    }
    if (date.getDate() == now.getDate())
        dateString = _("Today");
    if (date.getDate() == tomorrow.getDate())
        dateString = _("Tomorrow");
    return dateString;
};
var GetHoursMinutes = function (date, locale, hours24Format, tz, onlyHours) {
    if (onlyHours === void 0) { onlyHours = false; }
    var support = isLocaleStringSupported();
    if (locale == "c" || locale == null)
        locale = undefined;
    if (!tz && support == "full")
        support = "notz";
    var params = {
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
            return timeToUserUnits(date, hours24Format);
    }
};
var AwareDateString = function (date, locale, hours24Format, tz) {
    var support = isLocaleStringSupported();
    if (locale == "c" || locale == null)
        locale = undefined;
    var now = new Date();
    var params = {
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
            return timeToUserUnits(date, hours24Format);
    }
};
var getDayName = function (dayNum) {
    var days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')];
    return days[dayNum];
};
var MilitaryTime = function (date) {
    return date.getHours() * 100 + date.getMinutes();
};
var IsNight = function (sunTimes, date) {
    if (!sunTimes)
        return false;
    var time = (!!date) ? MilitaryTime(date) : MilitaryTime(new Date());
    var sunrise = MilitaryTime(sunTimes.sunrise);
    var sunset = MilitaryTime(sunTimes.sunset);
    if (time >= sunrise && time < sunset)
        return false;
    return true;
};
var compassToDeg = function (compass) {
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
var timeToUserUnits = function (date, show24Hours) {
    var timeStr = util_format_date('%H:%M', date.getTime());
    var time = timeStr.split(':');
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
var WEATHER_CONV_MPH_IN_MPS = 2.23693629;
var WEATHER_CONV_KPH_IN_MPS = 3.6;
var WEATHER_CONV_KNOTS_IN_MPS = 1.94384449;
var capitalizeFirstLetter = function (description) {
    if ((description == undefined || description == null)) {
        return "";
    }
    return description.charAt(0).toUpperCase() + description.slice(1);
};
var KPHtoMPS = function (speed) {
    if (speed == null)
        return null;
    return speed / WEATHER_CONV_KPH_IN_MPS;
};
var get = function (p, o) {
    return p.reduce(function (xs, x) {
        return (xs && xs[x]) ? xs[x] : null;
    }, o);
};
var GetFuncName = function (func) {
    if (!!func.name)
        return func.name;
    var result = /^function\s+([\w\$]+)\s*\(/.exec(func.toString());
    return result ? result[1] : '';
};
var MPStoUserUnits = function (mps, units) {
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
};
var TempToUserConfig = function (kelvin, units, russianStyle) {
    var temp;
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
var CelsiusToKelvin = function (celsius) {
    if (celsius == null)
        return null;
    return (celsius + 273.15);
};
var FahrenheitToKelvin = function (fahr) {
    if (fahr == null)
        return null;
    return ((fahr - 32) / 1.8 + 273.15);
};
var MPHtoMPS = function (speed) {
    if (speed == null || speed == undefined)
        return null;
    return speed * 0.44704;
};
var PressToUserUnits = function (hpa, units) {
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
var KmToM = function (km) {
    if (km == null)
        return null;
    return km * 0.6213712;
};
var MetreToUserUnits = function (m, distanceUnit) {
    if (distanceUnit == "metric")
        return Math.round(m / 1000 * 10) / 10;
    return Math.round(KmToM(m / 1000) * 10) / 10;
};
var MillimeterToUserUnits = function (mm, distanceUnit) {
    if (distanceUnit == "metric")
        return Math.round(mm * 100) / 100;
    return Math.round(mm * 0.03937 * 100) / 100;
};
var isNumeric = function (n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
};
var isString = function (text) {
    if (typeof text == 'string' || text instanceof String) {
        return true;
    }
    return false;
};
var isID = function (text) {
    if (text.length == 7 && isNumeric(text)) {
        return true;
    }
    return false;
};
var isCoordinate = function (text) {
    text = text.trim();
    if (/^-?\d{1,3}(?:\.\d*)?,(\s)*-?\d{1,3}(?:\.\d*)?/.test(text)) {
        return true;
    }
    return false;
};
var nonempty = function (str) {
    return (str != null && str.length > 0 && str != undefined);
};
var compassDirection = function (deg) {
    var directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')];
    return directions[Math.round(deg / 45) % directions.length];
};
var isLangSupported = function (lang, languages) {
    if (languages.indexOf(lang) != -1) {
        return true;
    }
    return false;
};
var Sentencify = function (words) {
    var result = "";
    for (var index = 0; index < words.length; index++) {
        var element = words[index];
        if (index != 0)
            result += " ";
        result += element;
    }
    return result;
};
var weatherIconSafely = function (code, icon_type) {
    for (var i = 0; i < code.length; i++) {
        if (hasIcon(code[i], icon_type))
            return code[i];
    }
    return 'weather-severe-alert';
};
var hasIcon = function (icon, icon_type) {
    return IconTheme.get_default().has_icon(icon + (icon_type == IconType.SYMBOLIC ? '-symbolic' : ''));
};
var shadeHexColor = function (color, percent) {
    var f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
};
var constructJsLocale = function (locale) {
    var jsLocale = locale.split(".")[0];
    var tmp = jsLocale.split("_");
    jsLocale = "";
    for (var i = 0; i < tmp.length; i++) {
        if (i != 0)
            jsLocale += "-";
        jsLocale += tmp[i].toLowerCase();
    }
    return jsLocale;
};
