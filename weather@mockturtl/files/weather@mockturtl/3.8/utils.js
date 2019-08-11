var Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
var setTimeout = function (func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = Mainloop.timeout_add(ms, () => {
        func.apply(null, args);
        return false;
    }, null);
    return id;
};
const clearTimeout = function (id) {
    Mainloop.source_remove(id);
};
const setInterval = function (func, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    let id = Mainloop.timeout_add(ms, () => {
        func.apply(null, args);
        return true;
    }, null);
    return id;
};
const clearInterval = function (id) {
    Mainloop.source_remove(id);
};
var isLocaleStringSupported = function () {
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
var GetDayName = function (date, locale, tz) {
    let support = isLocaleStringSupported();
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
var GetHoursMinutes = function (date, locale, hours24Format, tz) {
    let support = isLocaleStringSupported();
    if (!tz && support == "full")
        support = "notz";
    switch (support) {
        case "full":
            return date.toLocaleString(locale, { timeZone: tz, hour: "numeric", minute: "numeric", hour12: !hours24Format });
        case "notz":
            return date.toLocaleString(locale, { hour: "numeric", minute: "numeric", hour12: !hours24Format });
            ;
        case "none":
            return timeToUserUnits(date, hours24Format);
    }
};
var getDayName = function (dayNum) {
    let days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')];
    return days[dayNum];
};
var timeToUserUnits = function (date, show24Hours) {
    let timeStr = Cinnamon.util_format_date('%H:%M', date.getTime());
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
