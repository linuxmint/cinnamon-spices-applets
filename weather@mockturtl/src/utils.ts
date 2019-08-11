var Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;

var setTimeout = function(func: any, ms: number) {
  let args: any[] = [];
  if (arguments.length > 2) {
    args = args.slice.call(arguments, 2);
  }

  let id = Mainloop.timeout_add(ms, () => {
    func.apply(null, args);
    return false; // Stop repeating
  }, null);

  return id;
};

const clearTimeout = function(id: any) {
  Mainloop.source_remove(id);
};

const setInterval = function(func: any, ms: number) {
  let args: any[] = [];
  if (arguments.length > 2) {
    args = args.slice.call(arguments, 2);
  }

  let id = Mainloop.timeout_add(ms, () => {
    func.apply(null, args);
    return true; // Repeat
  }, null);

  return id;
};

const clearInterval = function(id: any) {
  Mainloop.source_remove(id);
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
            return date.toLocaleString(locale, {hour: "numeric", minute: "numeric", hour12: !hours24Format});;
        case "none":
            return timeToUserUnits(date, hours24Format);
    }
}

var getDayName = function(dayNum: number): string {
    let days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')]
    return days[dayNum];
}

// Takes Time in %H:%M string format
var timeToUserUnits = function(date: Date, show24Hours: boolean) {
    let timeStr = Cinnamon.util_format_date('%H:%M', date.getTime());
    let time = timeStr.split(':');
    //Remove Leading 0
    if (time[0].charAt(0) == "0") {
      time[0] = time[0].substr(1);
    }
    //Returnt Time based on user preference
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