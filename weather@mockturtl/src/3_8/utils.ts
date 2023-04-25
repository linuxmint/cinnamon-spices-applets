import { WeatherWindSpeedUnits, WeatherUnits, WeatherPressureUnits, DistanceUnits, Config } from "./config";
import { ELLIPSIS, FORWARD_SLASH, UUID } from "./consts";
import { APIUniqueField, ArrowIcons, BuiltinIcons, SunTime, WeatherData } from "./types";
import { DateTime } from "luxon";
const { timeout_add, source_remove } = imports.mainloop;
const { IconType } = imports.gi.St;
const { IconTheme } = imports.gi.Gtk;
const { Object } = imports.gi.GObject;

// --------------------------------------------------------------
// Text Generators

export function _(str: string, args?: KeysValuePairs): string {
	let result = imports.gettext.dgettext(UUID, str);

	if (result === str && result === "")
		result = imports.gettext.gettext(str);

	if (!!args)
		result = format(result, args);
	return result;
}

interface KeysValuePairs {
	[key: string]: any
}

export function format(str: string, args: KeysValuePairs) {
	for (const key in args) {
		str = str.replace(new RegExp("\\{" + key + "\\}"), args[key]);
	}
	return str;
}

export function UnitToUnicode(unit: Exclude<WeatherUnits, "automatic">): string {
	//return unit == "fahrenheit" ? '\u2109' : '\u2103';
	// Use the not dedicated characters, it exists in more fonts fixing some alignment issues with
	// fallbacks
	return unit == "fahrenheit" ? '°F' : '°C';
}

/** Generates text for the LocationButton on to of the popup menu and tooltip */
export function GenerateLocationText(weather: WeatherData, config: Config) {
	let location = "";
	if (weather.location.city != null && weather.location.country != null) {
		location = weather.location.city + ", " + weather.location.country;
	} else {
		location = Math.round(weather.coord.lat * 10000) / 10000 + ", " + Math.round(weather.coord.lon * 10000) / 10000;
	}

	// Overriding Location
	if (NotEmpty(config._locationLabelOverride)) {
		location = InjectValues(config._locationLabelOverride, weather, config);
	}

	return location;
}

export function InjectValues(text: string, weather: WeatherData, config: Config): string {
	const lastUpdatedTime = AwareDateString(weather.date, config.currentLocale, config._show24Hours, DateTime.local().zoneName);
	return text.replace(/{t}/g, TempToUserConfig(weather.temperature, config, false) ?? "")
			   .replace(/{u}/g, UnitToUnicode(config.TemperatureUnit))
			   .replace(/{c}/g, weather.condition.main)
			   .replace(/{c_long}/g, weather.condition.description)
			   .replace(/{dew_point}/g, TempToUserConfig(weather.dewPoint, config, false) ?? "")
			   .replace(/{humidity}/g, weather.humidity?.toString() ?? "")
			   .replace(/{pressure}/g, weather.pressure != null ? PressToUserUnits(weather.pressure, config._pressureUnit).toString() : "")
			   .replace(/{pressure_unit}/g, config._pressureUnit)
			   .replace(/{extra_value}/g, weather.extra_field ? ExtraFieldToUserUnits(weather.extra_field, config) : "")
			   .replace(/{extra_name}/g, weather.extra_field ? weather.extra_field.name : "")
			   .replace(/{wind_speed}/g, weather.wind.speed != null ? MPStoUserUnits(weather.wind.speed, config.WindSpeedUnit) : "")
			   .replace(/{wind_dir}/g, weather.wind.degree != null ? CompassDirectionText(weather.wind.degree) : "")
			   .replace(/{city}/g, weather.location.city ?? "")
			   .replace(/{country}/g, weather.location.country ?? "")
			   .replace(/{search_entry}/g, config.CurrentLocation?.entryText ?? "")
			   .replace(/{last_updated}/g, lastUpdatedTime);
}

export function CapitalizeFirstLetter(description: string): string {
	if ((description == undefined || description == null)) {
		return "";
	}
	return description.charAt(0).toUpperCase() + description.slice(1);
};

export function CapitalizeEveryWord(description: string): string {
	if ((description == undefined || description == null)) {
		return "";
	}
	const split = description.split(" ");
	let result = "";
	for (const [index, element] of split.entries()) {
		result += CapitalizeFirstLetter(element);
		if (index != split.length - 1)
			result += " ";
	}
	return result;
}

// ---------------------------------------------------------------------------------
// TimeString generators

function NormalizeTimezone(tz?: string | undefined) {
	if (!tz || tz == "" || tz == "UTC")
		tz = undefined;
	return tz;
}

export function GetDayName(date: DateTime, locale: string | null, showDate: boolean = false, tz?: string | undefined): string {
	const params: Intl.DateTimeFormatOptions = {
		weekday: "long",
	}

	params.timeZone = <string>NormalizeTimezone(tz);

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

	// today or tomorrow, no need to include date
	if (date.hasSame(now, "day") || date.hasSame(tomorrow, "day"))
		delete params.weekday;

	if (!!locale)
		date = date.setLocale(locale);

	let dateString = date.toLocaleString(params);
	dateString = CapitalizeFirstLetter(dateString);

	if (date.hasSame(now, "day")) dateString = _("Today");
	if (date.hasSame(tomorrow, "day")) dateString = _("Tomorrow");

	return dateString;
}

export function GetHoursMinutes(date: DateTime, locale: string | null, hours24Format: boolean, tz?: string, onlyHours: boolean = false): string {
	const params: Intl.DateTimeFormatOptions = {
		hour: "numeric",
		hour12: !hours24Format,
	}

	params.timeZone = NormalizeTimezone(tz);

	if (!onlyHours)
		params.minute = "2-digit";
	if (!!tz)
		date = date.setZone(tz);
	if (!!locale)
		date = date.setLocale(locale);
	return date.toLocaleString(params);
}

export function AwareDateString(date: DateTime, locale: string | null, hours24Format: boolean, tz: string): string {
	const now = DateTime.utc().setZone(tz);
	date = date.setZone(tz)
	const params: Intl.DateTimeFormatOptions = {
		hour: "numeric",
		minute: "2-digit",
		hour12: !hours24Format,
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
/**
 *
 * @param date
 * @returns number in format HHMM, can be compared directly
 */
export function MilitaryTime(date: DateTime): number {
	return date.hour * 100 + date.minute;
}

export function OnSameDay(date1: DateTime, date2: DateTime): boolean {
	return date1.hasSame(date2, "day");
}

export function ValidTimezone(tz: string): boolean {
	return DateTime.utc().setZone(tz).isValid;
}

// ------------------------------------------------------------------------------
// To UserConfig converters

/** Capitalizes first letter and translates if needed */
export function ProcessCondition(condition: string, shouldTranslate: boolean) {
	condition = CapitalizeFirstLetter(condition);
	if (shouldTranslate)
		condition = _(condition);
	return condition;
}

export function LocalizedColon(locale: string | null): string {
	if (locale == null)
		return ":"

	if (locale.startsWith("fr"))
		return " :"

	return ":"
}

export function PercentToLocale(humidity: number, locale: string | null, withUnit: boolean = true): string {
	if (withUnit)
		return (humidity / 100).toLocaleString(locale ?? undefined, { style: "percent" });
	else
		return Math.round(humidity).toString();
}

// Conversion Factors
const WEATHER_CONV_MPH_IN_MPS = 2.23693629
const WEATHER_CONV_KPH_IN_MPS = 3.6
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449

export function ExtraFieldToUserUnits(extra_field: APIUniqueField, config: Config, withUnit: boolean = false): string {
	switch (extra_field.type) {
		case "percent":
			return PercentToLocale(extra_field.value, config.currentLocale, withUnit);
		case "temperature":
			return TempToUserConfig(extra_field.value, config, withUnit);
		default:
			return _(extra_field.value);
	}
}

export function MPStoUserUnits(mps: number, units: WeatherWindSpeedUnits): string {
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
		default:
			return (Math.round(mps * 10) / 10).toString();
	}
}

// Conversion from Kelvin
export function TempToUserConfig(kelvin: number, config: Config, withUnit?: boolean): string;
export function TempToUserConfig(kelvin: number | null, config: Config, withUnit?: boolean): string | null;
export function TempToUserConfig(kelvin: number | null, config: Config, withUnit: boolean = true): string | null {
	if (kelvin == null)
		return null;

	let temp: number | string = (config.TemperatureUnit == "celsius") ? KelvinToCelsius(kelvin) : KelvinToFahrenheit(kelvin);
	temp = RussianTransform(temp, config._tempRussianStyle);

	if (withUnit)
		temp = `${temp} ${UnitToUnicode(config.TemperatureUnit)}`;

	if (config._showBothTempUnits) {
		const secondUnit: WeatherUnits = (config.TemperatureUnit == "celsius") ? "fahrenheit" : "celsius";
		let secondTemp: number | string = (config.TemperatureUnit == "celsius") ? KelvinToFahrenheit(kelvin) : KelvinToCelsius(kelvin);
		secondTemp = RussianTransform(secondTemp, config._tempRussianStyle);
		if (withUnit)
			temp += ` (${secondTemp.toString()} ${UnitToUnicode(secondUnit)})`;
		else
			temp += ` (${secondTemp.toString()})`;
	}

	return temp.toString();
}

export function RussianTransform(temp: number, russianStyle: boolean): string {
	if (russianStyle) {
		if (temp < 0) return `−${Math.abs(temp).toString()}`;
		else if (temp > 0) return `+${temp.toString()}`;
	}

	return temp.toString();
}

export function TempRangeToUserConfig(min: number | null, max: number | null, config: Config): string {
	const t_low = TempToUserConfig(min, config, false);
	const t_high = TempToUserConfig(max, config, false);

	const first_temperature = config._temperatureHighFirst ? t_high : t_low;
	const second_temperature = config._temperatureHighFirst ? t_low : t_high;

	let result = "";
	if (first_temperature != null)
		result = first_temperature;
	// As Russian Tradition, -temp...+temp
	// See https://github.com/linuxmint/cinnamon-spices-applets/issues/618
	result += ((config._tempRussianStyle) ? ELLIPSIS : ` ${FORWARD_SLASH} `);
	if (second_temperature != null)
		result += `${second_temperature} `;
	result += `${UnitToUnicode(config.TemperatureUnit)}`;
	if (config._showBothTempUnits) {
		const secondUnit: WeatherUnits = (config.TemperatureUnit == "celsius") ? "fahrenheit" : "celsius";
		result += ` (${UnitToUnicode(secondUnit)})`;
	}
	return result;
}

function KelvinToCelsius(k: number): number {
	return Math.round((k - 273.15));
}

function KelvinToFahrenheit(k: number): number {
	return Math.round((9 / 5 * (k - 273.15) + 32));
}

/**
 * Converts from hpa to use's chose unit
 * @param hpa
 * @param units
 */
export function PressToUserUnits(hpa: number, units: WeatherPressureUnits): number {
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
};

export function MetreToUserUnits(m: number, distanceUnit: DistanceUnits): number {
	if (distanceUnit == "metric") return Math.round(m / 1000 * 10) / 10;
	return Math.round(KmToM(m / 1000) * 10) / 10;
}

export function MillimeterToUserUnits(mm: number, distanceUnit: DistanceUnits): number {
	if (distanceUnit == "metric") return Math.round(mm * 10) / 10;
	return Math.round(mm * 0.03937 * 100) / 100;
}

// --------------------------------------------------------------
// Converters

export function KPHtoMPS(speed: number | null): number {
	if (speed == null) return 0;
	return speed / WEATHER_CONV_KPH_IN_MPS;
};

export function CelsiusToKelvin(celsius: number): number;
export function CelsiusToKelvin(celsius: number | null): number | null;
export function CelsiusToKelvin(celsius: number | null): number | null {
	if (celsius == null) return null;
	return (celsius + 273.15);
}

export function FahrenheitToKelvin(fahrenheit: number): number;
export function FahrenheitToKelvin(fahrenheit: number | null): number | null;
export function FahrenheitToKelvin(fahrenheit: number | null): number | null {
	if (fahrenheit == null) return null;
	return ((fahrenheit - 32) / 1.8 + 273.15);
};

export function MPHtoMPS(speed: number): number;
export function MPHtoMPS(speed: number | null): number | null;
export function MPHtoMPS(speed: number | null): number | null {
	if (speed == null || speed == undefined) return null;
	return speed * 0.44704;
}

export function KmToM(km: number): number {
	return km * 0.6213712;
}

export function CompassToDeg(compass: string): number;
export function CompassToDeg(compass: string | null): number | null;
export function CompassToDeg(compass: string | null): number | null {
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

export function CompassDirection(deg: number): ArrowIcons {
	const directions: ArrowIcons[] = [
		'south-arrow-weather-symbolic',
		'south-west-arrow-weather-symbolic',
		'west-arrow-weather-symbolic',
		'north-west-arrow-weather-symbolic',
		'north-arrow-weather-symbolic',
		'north-east-arrow-weather-symbolic',
		'east-arrow-weather-symbolic',
		'south-east-arrow-weather-symbolic'
	];
	return directions[Math.round(deg / 45) % directions.length]
}

export function CompassDirectionText(deg: number): string {
	const directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')]
	return directions[Math.round(deg / 45) % directions.length]
}


// -----------------------------------------------------------------
// Testers

/**
 * Checks if a date is inside between sunrise and sunset.
 * @param sunTimes sunrise and sunset is used
 * @param date
 */
export function IsNight(sunTimes: SunTime, date?: DateTime): boolean {
	if (!sunTimes) return false;
	const time = (!!date) ? MilitaryTime(date) : MilitaryTime(DateTime.utc().setZone(sunTimes.sunset.zoneName));
	const sunrise = MilitaryTime(sunTimes.sunrise);
	const sunset = MilitaryTime(sunTimes.sunset);
	if (time >= sunrise && time < sunset) return false;
	return true;
}

export function IsCoordinate(text: string): boolean {
	text = text.trim();
	if (/^-?\d{1,3}(?:\.\d*)?,(\s)*-?\d{1,3}(?:\.\d*)?/.test(text)) {
		return true;
	}
	return false;
}

export function NotEmpty(str: string): boolean {
	return (str != null && str.length > 0 && str != undefined)
}

export function IsLangSupported(lang: string | null, languages: Array<string>): boolean {
	if (lang == null)
		return false;

	return (languages.includes(lang))
};

function HasIcon(icon: string, icon_type: imports.gi.St.IconType): boolean {
	return IconTheme.get_default().has_icon(icon + (icon_type == IconType.SYMBOLIC ? '-symbolic' : ''))
}

// --------------------------------------------------------
// ETC

export function mode<T>(arr: T[]): T | null {
	return arr.reduce(function (current, item) {
		var val = current.numMapping[item] = (current.numMapping[item] || 0) + 1;
		if (val > current.greatestFreq) {
			current.greatestFreq = val;
			current.mode = item;
		}
		return current;
	}, { mode: null, greatestFreq: -Infinity, numMapping: {} as any } as { mode: T | null, greatestFreq: number, numMapping: any }).mode;
};

// Passing appropriate resolver function for the API, and the code
export function WeatherIconSafely(icons: BuiltinIcons[], icon_type: imports.gi.St.IconType): BuiltinIcons {
	for (const icon of icons) {
		if (HasIcon(icon, icon_type))
			return icon;
	}
	return 'weather-severe-alert';
}

/**
 * https://github.com/PimpTrizkit/PJs/wiki/12.-Shade,-Blend-and-Convert-a-Web-Color-(pSBC.js)#--version-2-hex--
 * @param color like "#ffffff"
 * @param percent between -1.0 and 1.0
 */
export function ShadeHexColor(color: string, percent: number): string {
	var f = parseInt(color.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent, R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
	return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

/**
 * Convert Linux locale to JS locale format
 * @param locale Linux locale string
 */
export function ConstructJsLocale(locale: string): string | null {
	if (locale == null)
		return null;

	// we only need lan_country section of locale, if we have space, @ or . we need to remove everything after
	const jsLocale: string = locale.split(/[.\s@]/)[0].trim();
	const tmp: string[] = jsLocale.split("_");

	let result: string = "";
	// Add back country code if we have it
	for (const [i, item] of tmp.entries()) {
		if (i != 0)
			result += "-";
		result += item.toLowerCase();
	}

	// Ignore C
	if (result == "c")
		return null;

	return result;
}

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

export function GetFuncName(func: Function): string {
	return func.name;
}

export function Guid() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

export const isFinalized = function (obj: any) {
	return obj && Object.prototype.toString.call(obj).indexOf('FINALIZED') > -1;
}

interface CompareVersionOptions {
	/**
	 * Changes the result if one version string has less parts than the other. In
 	 * this case the shorter string will be padded with "zero" parts instead of being considered smaller.
	 */
	zeroExtend: boolean;
}
/**
 * Compares two software version numbers (e.g. "1.7.1" or "1.2b").
 * @param v1 The first version to be compared.
 * @param v2 The second version to be compared.
 * @param options Optional flags that affect comparison behavior:
 * @returns
 *   - 0 if the versions are equal
 *   - a negative integer iff v1 < v2
 *   - a positive integer iff v1 > v2
 *   - NaN if either version string is in the wrong format
 */
export function CompareVersion(v1: string, v2: string, options?: CompareVersionOptions) {
	const zeroExtend = options && options.zeroExtend,
		v1parts = v1.split('.'),
		v2parts = v2.split('.');

	function isValidPart(x: string) {
		return (/^\d+$/).test(x);
	}

	if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
		return NaN;
	}

	if (zeroExtend) {
		while (v1parts.length < v2parts.length) v1parts.push("0");
		while (v2parts.length < v1parts.length) v2parts.push("0");
	}

	for (var i = 0; i < v1parts.length; ++i) {
		if (v2parts.length == i) {
			return 1;
		}

		if (v1parts[i] == v2parts[i]) {
			continue;
		}
		else if (v1parts[i] > v2parts[i]) {
			return 1;
		}
		else {
			return -1;
		}
	}

	if (v1parts.length != v2parts.length) {
		return -1;
	}

	return 0;
}

// -----------------------------------------------------------
// Timeout polyfill

export function setTimeout(func: Function, ms: number) {
	let args: any[] = [];
	if (arguments.length > 2) {
		args = args.slice.call(arguments, 2);
	}

	const id = timeout_add(ms, () => {
		func.apply(null, args);
		return false; // Stop repeating
	});

	return id;
};

export async function delay(ms: number): Promise<void> {
	return await new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve();
		}, ms);
	});
}

export function clearTimeout(id: number) {
	source_remove(id);
};

export function setInterval(func: Function, ms: number) {
	let args: any[] = [];
	if (arguments.length > 2) {
		args = args.slice.call(arguments, 2);
	}

	const id = timeout_add(ms, () => {
		func.apply(null, args);
		return true; // Repeat
	});

	return id;
};