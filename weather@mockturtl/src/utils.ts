import { WeatherWindSpeedUnits, WeatherUnits, WeatherPressureUnits, DistanceUnits } from "./config";
import { SunTimes } from "./sunCalc";
import { BuiltinIcons } from "./types";
const { timeout_add, source_remove } = imports.mainloop;
const { IconType } = imports.gi.St;
const { IconTheme } = imports.gi.Gtk;

const UUID = "weather@mockturtl";

imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
export function _(str: string): string {
    let customTrans = imports.gettext.dgettext(UUID, str);
     if (customTrans !== str && customTrans !== "")
        return customTrans;
    return imports.gettext.gettext(str);
}

export function setTimeout(func: any, ms: number) {
    let args: any[] = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }

    let id = timeout_add(ms, () => {
        func.apply(null, args);
        return false; // Stop repeating
    }, null);

    return id;
};

export async function delay(ms: number): Promise<void> {
    return await new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export function clearTimeout(id: any) {
    source_remove(id);
};

export function setInterval(func: any, ms: number) {
    let args: any[] = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }

    let id = timeout_add(ms, () => {
        func.apply(null, args);
        return true; // Repeat
    }, null);

    return id;
};

/**
 * https://www.movable-type.co.uk/scripts/latlong.html
 * @param lat1 
 * @param lon1 
 * @param lat2 
 * @param lon2 
 * @returns distance in metres
 */
export function GetDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}

export function clearInterval(id: any) {
    source_remove(id);
};

export function GetDayName(date: Date, locale: string, showDate: boolean = false, tz?: string): string {
    // No timezone, Date passed in corrected with offset
    if (locale == "c" || locale == null) locale = undefined;

    let params: Intl.DateTimeFormatOptions = {
        weekday: "long",
        timeZone: tz
    }

    if (!tz || tz == "")
        params.timeZone = undefined;

    if (showDate) {
        params.day = 'numeric';
    }


    let now = new Date();
    let tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    // today or tomorrow, no need to include date
    if (date.getDate() == now.getDate() || date.getDate() == tomorrow.getDate())
        delete params.weekday;

    let dateString = date.toLocaleString(locale, params);

    if (date.getDate() == now.getDate()) dateString = _("Today");
    if (date.getDate() == tomorrow.getDate()) dateString = _("Tomorrow");

    return dateString;
}

export function GetHoursMinutes(date: Date, locale: string, hours24Format: boolean, tz?: string, onlyHours: boolean = false): string {
    if (locale == "c" || locale == null) locale = undefined;
    // No timezone, Date passed in corrected with offset

    let params: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        hour12: !hours24Format,
        timeZone: tz
    }

    if (!tz || tz == "")
        params.timeZone = undefined;

    if (!onlyHours)
        params.minute = "2-digit";

    return date.toLocaleString(locale, params);
}

export function AwareDateString(date: Date, locale: string, hours24Format: boolean, tz?: string): string {
    if (locale == "c" || locale == null) locale = undefined; // Ignore unset locales
    let now = new Date();
    let params: Intl.DateTimeFormatOptions = {
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
/**
 * 
 * @param date 
 * @returns number in format HHMM, can be compared directly
 */
export function MilitaryTime(date: Date): number {
    return date.getHours() * 100 + date.getMinutes();
}

export function IsNight(sunTimes: SunTimes, date?: Date): boolean {
    if (!sunTimes) return false;
    let time = (!!date) ? MilitaryTime(date) : MilitaryTime(new Date());
    let sunrise = MilitaryTime(sunTimes.sunrise);
    let sunset = MilitaryTime(sunTimes.sunset);
    if (time >= sunrise && time < sunset) return false;
    return true;
}

export function compassToDeg(compass: string): number {
    if (!compass) return null;
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
// Conversion Factors
const WEATHER_CONV_MPH_IN_MPS = 2.23693629
const WEATHER_CONV_KPH_IN_MPS = 3.6
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449

export function capitalizeFirstLetter(description: string): string {
    if ((description == undefined || description == null)) {
        return "";
    }
    return description.charAt(0).toUpperCase() + description.slice(1);
};

export function KPHtoMPS(speed: number): number {
    if (speed == null) return null;
    return speed / WEATHER_CONV_KPH_IN_MPS;
};

export function get(p: string[], o: any): any {
    return p.reduce((xs, x) =>
        (xs && xs[x]) ? xs[x] : null, o);
}

export function GetFuncName(func: Function): string {
    // ES6
    if (!!func.name) return func.name;
    // ES5
    // https://stackoverflow.com/a/17923727
    var result = /^function\s+([\w\$]+)\s*\(/.exec(func.toString())
    return result ? result[1] : '' // for an anonymous function there won't be a match
}

export function MPStoUserUnits(mps: number, units: WeatherWindSpeedUnits): string {
    if (mps == null) return null;
    // Override wind units with our preference, takes Meter/Second wind speed
    switch (units) {
        case "mph":
            //Rounding to 1 decimal
            return (Math.round((mps * WEATHER_CONV_MPH_IN_MPS) * 10) / 10).toString();
        case "kph":
            //Rounding to 1 decimal
            return (Math.round((mps * WEATHER_CONV_KPH_IN_MPS) * 10) / 10).toString();
        case "m/s":
            // Rounding to 1 decimal just in case API does not return it in the same format
            return (Math.round(mps * 10) / 10).toString();
        case "Knots":
            //Rounding to whole units
            return Math.round(mps * WEATHER_CONV_KNOTS_IN_MPS).toString();
        case "Beaufort":
            //https://en.m.wikipedia.org/wiki/Beaufort_scale
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

// Conversion from Kelvin
export function TempToUserConfig(kelvin: number, units: WeatherUnits, russianStyle: boolean): string {
    let temp;
    if (units == "celsius") {
        temp = Math.round((kelvin - 273.15));
    }
    if (units == "fahrenheit") {
        temp = Math.round((9 / 5 * (kelvin - 273.15) + 32));
    }

    if (!russianStyle) return temp.toString();

    if (temp < 0) temp = "−" + Math.abs(temp).toString();
    else if (temp > 0) temp = "+" + temp.toString();
    return temp.toString();
}

export function CelsiusToKelvin(celsius: number): number {
    if (celsius == null) return null;
    return (celsius + 273.15);
}

export function FahrenheitToKelvin(fahr: number): number {
    if (fahr == null) return null;
    return ((fahr - 32) / 1.8 + 273.15);
};

export function MPHtoMPS(speed: number): number {
    if (speed == null || speed == undefined) return null;
    return speed * 0.44704;
}

/**
 * Converts from hpa to use's chose unit
 * @param hpa 
 * @param units 
 */
export function PressToUserUnits(hpa: number, units: WeatherPressureUnits): number {
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

export function KmToM(km: number): number {
    if (km == null) return null;
    return km * 0.6213712;
}

export function MetreToUserUnits(m: number, distanceUnit: DistanceUnits): number {
    if (distanceUnit == "metric") return Math.round(m / 1000 * 10) / 10;
    return Math.round(KmToM(m / 1000) * 10) / 10;
}

export function MillimeterToUserUnits (mm: number, distanceUnit: DistanceUnits): number {
    if (distanceUnit == "metric") return Math.round(mm * 100) / 100;
    return Math.round(mm * 0.03937 * 100) / 100;
}

export function isNumeric(n: any): boolean {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

export function isString(text: any): boolean {
    if (typeof text == 'string' || text instanceof String) {
        return true;
    }
    return false;
}

export function isID(text: any): boolean {
    if (text.length == 7 && isNumeric(text)) {
        return true;
    }
    return false;
};

export function isCoordinate(text: string): boolean {
    text = text.trim();
    if (/^-?\d{1,3}(?:\.\d*)?,(\s)*-?\d{1,3}(?:\.\d*)?/.test(text)) {
        return true;
    }
    return false;
}

export function nonempty(str: string): boolean {
    return (str != null && str.length > 0 && str != undefined)
}

export function compassDirection(deg: number): string {
    let directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')]
    //let directions = [_('⬇'), _('⬋'), _('⬅'), _('⬉'), _('⬆'), _('⬈'), _('➞'), _('⬊')]
    return directions[Math.round(deg / 45) % directions.length]
}

export function isLangSupported(lang: string, languages: Array<string>): boolean {
    if (languages.indexOf(lang) != -1) {
        return true;
    }
    return false;
};

export function Sentencify(words: string[]): string {
    let result = "";
    for (let index = 0; index < words.length; index++) {
        const element = words[index];
        if (index != 0) result += " ";
        result += element;
    }
    return result;
}

// Passing appropriate resolver function for the API, and the code
export function weatherIconSafely(code: BuiltinIcons[], icon_type: imports.gi.St.IconType): BuiltinIcons {
    for (let i = 0; i < code.length; i++) {
        if (hasIcon(code[i], icon_type))
            return code[i]
    }
    return 'weather-severe-alert'
}

export function hasIcon(icon: string, icon_type: imports.gi.St.IconType): boolean {
    return IconTheme.get_default().has_icon(icon + (icon_type == IconType.SYMBOLIC ? '-symbolic' : ''))
}

/**
 * https://github.com/PimpTrizkit/PJs/wiki/12.-Shade,-Blend-and-Convert-a-Web-Color-(pSBC.js)#--version-2-hex--
 * @param color like "#ffffff"
 * @param percent between -1.0 and 1.0
 */
export function shadeHexColor(color: string, percent: number): string {
    var f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

/**
 * Convert Linux locale to JS locale format
 * @param locale Linux locale string
 */
export function constructJsLocale(locale: string): string {
	let jsLocale = locale.split(".")[0];
	let tmp: string[] = jsLocale.split("_");
	jsLocale = "";
	for (let i = 0; i < tmp.length; i++) {
		if (i != 0) jsLocale += "-";
		jsLocale += tmp[i].toLowerCase();
	}
	return jsLocale;
}