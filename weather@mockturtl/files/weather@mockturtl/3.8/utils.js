const UUID = "weather@mockturtl";
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return imports.gettext.dgettext(UUID, str);
}
var { timeout_add, source_remove } = imports.mainloop;
const { util_format_date } = imports.gi.Cinnamon;
const { IconType } = imports.gi.St;
const { IconTheme } = imports.gi.Gtk;
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
var delay = async (ms) => {
    return await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};
const clearTimeout = (id) => {
    source_remove(id);
};
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
const clearInterval = (id) => {
    source_remove(id);
};
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
var GetDayName = (date, locale, tz) => {
    let support = isLocaleStringSupported();
    if (locale == "c" || locale == null)
        locale = undefined;
    if (!tz && support == "full")
        support = "notz";
    switch (support) {
        case "full":
            return date.toLocaleString(locale, { timeZone: tz, weekday: "long" });
        case "notz":
            return date.toLocaleString(locale, { timeZone: "UTC", weekday: "long" });
        case "none":
            return getDayName(date.getUTCDay());
            ;
    }
};
var GetHoursMinutes = (date, locale, hours24Format, tz) => {
    let support = isLocaleStringSupported();
    if (locale == "c" || locale == null)
        locale = undefined;
    if (!tz && support == "full")
        support = "notz";
    switch (support) {
        case "full":
            return date.toLocaleString(locale, { timeZone: tz, hour: "numeric", minute: "numeric", hour12: !hours24Format });
        case "notz":
            return date.toLocaleString(locale, { hour: "numeric", minute: "numeric", hour12: !hours24Format });
        case "none":
            return timeToUserUnits(date, hours24Format);
    }
};
var AwareDateString = (date, locale, hours24Format, tz) => {
    let support = isLocaleStringSupported();
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
            return date.toLocaleString(locale, { timeZone: tz, hour: "numeric", minute: "numeric", hour12: !hours24Format });
        case "notz":
            return date.toLocaleString(locale, { hour: "numeric", minute: "numeric", hour12: !hours24Format });
        case "none":
            return timeToUserUnits(date, hours24Format);
    }
};
var getDayName = (dayNum) => {
    let days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')];
    return days[dayNum];
};
var MilitaryTime = (date) => {
    return date.getHours() * 100 + date.getMinutes();
};
var IsNight = (sunTimes, date) => {
    if (!sunTimes)
        return false;
    let time = (!!date) ? MilitaryTime(date) : MilitaryTime(new Date());
    let sunrise = MilitaryTime(sunTimes.sunrise);
    let sunset = MilitaryTime(sunTimes.sunset);
    if (time >= sunrise && time < sunset)
        return false;
    return true;
};
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
const WEATHER_CONV_MPH_IN_MPS = 2.23693629;
const WEATHER_CONV_KPH_IN_MPS = 3.6;
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449;
var capitalizeFirstLetter = (description) => {
    if ((description == undefined || description == null)) {
        return "";
    }
    return description.charAt(0).toUpperCase() + description.slice(1);
};
var KPHtoMPS = (speed) => {
    if (speed == null)
        return null;
    return speed / WEATHER_CONV_KPH_IN_MPS;
};
const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o);
var GetFuncName = (func) => {
    if (!!func.name)
        return func.name;
    var result = /^function\s+([\w\$]+)\s*\(/.exec(func.toString());
    return result ? result[1] : '';
};
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
var CelsiusToKelvin = (celsius) => {
    if (celsius == null)
        return null;
    return (celsius + 273.15);
};
var FahrenheitToKelvin = (fahr) => {
    if (fahr == null)
        return null;
    return ((fahr - 32) / 1.8 + 273.15);
};
var MPHtoMPS = (speed) => {
    if (speed == null || speed == undefined)
        return null;
    return speed * 0.44704;
};
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
var KmToM = (km) => {
    if (km == null)
        return null;
    return km * 0.6213712;
};
var MetreToUserUnits = (m, distanceUnit) => {
    if (distanceUnit == "metric")
        return Math.round(m / 1000 * 10) / 10;
    return Math.round(KmToM(m / 1000) * 10) / 10;
};
var MillimeterToUserUnits = (mm, distanceUnit) => {
    if (distanceUnit == "metric")
        return Math.round(mm * 100) / 100;
    return Math.round(mm * 0.03937 * 100) / 100;
};
var isNumeric = (n) => {
    return !isNaN(parseFloat(n)) && isFinite(n);
};
var isString = (text) => {
    if (typeof text == 'string' || text instanceof String) {
        return true;
    }
    return false;
};
var isID = (text) => {
    if (text.length == 7 && isNumeric(text)) {
        return true;
    }
    return false;
};
var isCoordinate = (text) => {
    text = text.trim();
    if (/^-?\d{1,3}(?:\.\d*)?,(\s)*-?\d{1,3}(?:\.\d*)?/.test(text)) {
        return true;
    }
    return false;
};
var nonempty = (str) => {
    return (str != null && str.length > 0 && str != undefined);
};
var compassDirection = (deg) => {
    let directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')];
    return directions[Math.round(deg / 45) % directions.length];
};
var isLangSupported = (lang, languages) => {
    if (languages.indexOf(lang) != -1) {
        return true;
    }
    return false;
};
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
var weatherIconSafely = (code, icon_type) => {
    for (let i = 0; i < code.length; i++) {
        if (hasIcon(code[i], icon_type))
            return code[i];
    }
    return 'weather-severe-alert';
};
var hasIcon = (icon, icon_type) => {
    return IconTheme.get_default().has_icon(icon + (icon_type == IconType.SYMBOLIC ? '-symbolic' : ''));
};
var shadeHexColor = (color, percent) => {
    var f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
};
