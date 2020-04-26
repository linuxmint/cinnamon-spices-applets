export {}; // Declaring as a Module

// Add this so translation works in utils as well
const UUID = "weather@mockturtl";
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
function _(str: string): string {
  return imports.gettext.dgettext(UUID, str)
}

var { timeout_add, source_remove } = imports.mainloop;
const { util_format_date } = imports.gi.Cinnamon;
const { IconType } = imports.gi.St;
const { IconTheme } = imports.gi.Gtk;

var setTimeout = function(func: any, ms: number) {
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

var delay = async function(ms: number) : Promise<void> {
  return await new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const clearTimeout = function(id: any) {
  source_remove(id);
};

const setInterval = function(func: any, ms: number) {
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

const clearInterval = function(id: any) {
  source_remove(id);
};

var isLocaleStringSupported = function(): localeStringSupport {
    let date  = new Date(1565548657987); // Set Date to test support
    try {
        let output = date.toLocaleString('en-GB', {timeZone: 'Europe/London', hour: "numeric"});
        if (output !== "19" ) return "none"; // Does not match expected ouptut with full support | mozjs < 24
        return "full"; // | 52 < mozjs
    }
    catch(e) { // Including Europe/London tz throws error | 24 < mozjs < 52
        return "notz";
    }
}

type localeStringSupport = "none" | "notz" | "full";

var GetDayName = function(date: Date, locale:string, tz?: string): string {
    let support: localeStringSupport = isLocaleStringSupported();
    // No timezone, Date passed in corrected with offset
    if (!tz && support == "full") support = "notz";

    switch(support) {
        case "full":
            return date.toLocaleString(locale, {timeZone: tz, weekday: "long"}); 
        case "notz":
            return date.toLocaleString(locale, {timeZone: "UTC", weekday: "long"});
        case "none":
            return getDayName(date.getUTCDay()); ;
    }
}

var GetHoursMinutes = function(date: Date, locale: string, hours24Format: boolean, tz?: string): string {
    let support: localeStringSupport = isLocaleStringSupported();
    // No timezone, Date passed in corrected with offset
    if (!tz && support == "full") support = "notz";

    switch(support) {
        case "full":
            return date.toLocaleString(locale, {timeZone: tz, hour: "numeric", minute: "numeric", hour12: !hours24Format});
        case "notz":
            return date.toLocaleString(locale, {hour: "numeric", minute: "numeric", hour12: !hours24Format});
        case "none":
            return timeToUserUnits(date, hours24Format);
    }
}

var AwareDateString = function(date: Date, locale: string, hours24Format: boolean): string {
    let support: localeStringSupport = isLocaleStringSupported();
    let now = new Date();
    let params: any = {
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

    switch(support) {
      case "full":
      case "notz":
          return date.toLocaleString(locale, {hour: "numeric", minute: "numeric", hour12: !hours24Format});
      case "none":
          return timeToUserUnits(date, hours24Format);  // Displaying only time
  }
}

var getDayName = function(dayNum: number): string {
    let days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')]
    return days[dayNum];
}

// Takes Time in %H:%M string format
var timeToUserUnits = function(date: Date, show24Hours: boolean) {
    let timeStr = util_format_date('%H:%M', date.getTime());
    let time = timeStr.split(':');
    //Remove Leading 0
    if (time[0].charAt(0) == "0") {
      time[0] = time[0].substr(1);
    }
    //Return Time based on user preference
    if(show24Hours) {
      return time[0] + ":" + time[1];
    }
    else {
      if (parseInt(time[0]) > 12) { // PM
        return (parseInt(time[0]) - 12) + ":" + time[1] + " pm";
      }
      else { //AM
        return time[0] + ":" + time[1] + " am";
      }
    }
}

// Conversion Factors
const WEATHER_CONV_MPH_IN_MPS = 2.23693629
const WEATHER_CONV_KPH_IN_MPS = 3.6
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449

var capitalizeFirstLetter = function (description: string): string {
    if ((description == undefined || description == null)) {
      return "";
    }
    return description.charAt(0).toUpperCase() + description.slice(1);
  };

var KPHtoMPS = function(speed: number): number {
    return speed / WEATHER_CONV_KPH_IN_MPS;
  };

const get = (p: string[], o: any) =>
  p.reduce((xs, x) =>
    (xs && xs[x]) ? xs[x] : null, o);

var MPStoUserUnits = function(mps: number, units: WeatherWindSpeedUnits): string {
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
var TempToUserConfig = function(kelvin: number, units: WeatherUnits, russianStyle: boolean): string {
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

var CelsiusToKelvin = function(celsius: number): number {
    return (celsius + 273.15);
  }

var FahrenheitToKelvin = function(fahr: number): number {
    return ((fahr - 32) / 1.8 + 273.15);
  };

var MPHtoMPS = function(speed: number): number {
    return speed * 0.44704;
  }

  // Conversion from hPa
var PressToUserUnits = function(hpa: number, units: WeatherPressureUnits): number {
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

var isNumeric = function(n: any): boolean {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

var isString = function(text: any): boolean {
    if (typeof text == 'string' || text instanceof String) {
      return true;
    }
    return false;
  }

var isID = function(text: any): boolean {
    if (text.length == 7 && isNumeric(text)) {
      return true;
    }
    return false;
  };

var isCoordinate = function(text: any): boolean {
    if (/^-?\d{1,3}(?:\.\d*)?,-?\d{1,3}(?:\.\d*)?/.test(text)) {
      return true;
    }
    return false;
  }

var nonempty = function(str: string): boolean {
    return (str != null && str.length > 0 && str != undefined)
  }

var compassDirection = function(deg: number): string {
    let directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')]
    //let directions = [_('⬇'), _('⬋'), _('⬅'), _('⬉'), _('⬆'), _('⬈'), _('➞'), _('⬊')]
    return directions[Math.round(deg / 45) % directions.length]
  }

var isLangSupported = function(lang: string, languages: Array < string > ): boolean {
    if (languages.indexOf(lang) != -1) {
      return true;
    }
    return false;
};

const icons = {
  clear_day: 'weather-clear',
  clear_night: 'weather-clear-night',
  few_clouds_day: 'weather-few-clouds',
  few_clouds_night: 'weather-few-clouds-night',
  clouds: 'weather-clouds',
  overcast: 'weather_overcast',
  showers_scattered: 'weather-showers-scattered',
  showers: 'weather-showers',
  rain: 'weather-rain',
  rain_freezing: 'weather-freezing-rain',
  snow: 'weather-snow',
  storm: 'weather-storm',
  fog: 'weather-fog',
  alert: 'weather-severe-alert'
}

  // Passing appropriate resolver function for the API, and the code
var weatherIconSafely = function (code: string[], icon_type: imports.gi.St.IconType): string {
    for (let i = 0; i < code.length; i++) {
      if (hasIcon(code[i], icon_type))
        return code[i]
    }
    return 'weather-severe-alert'
  }

var hasIcon = function (icon: string, icon_type: imports.gi.St.IconType): boolean {
  return IconTheme.get_default().has_icon(icon + (icon_type == IconType.SYMBOLIC ? '-symbolic' : ''))
}