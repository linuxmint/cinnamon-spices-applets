var Mainloop = imports.mainloop;
var Cinnamon = imports.gi.Cinnamon;
var setTimeout = function (func, ms) {
    var args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    var id = Mainloop.timeout_add(ms, function () {
        func.apply(null, args);
        return false;
    }, null);
    return id;
};
var clearTimeout = function (id) {
    Mainloop.source_remove(id);
};
var setInterval = function (func, ms) {
    var args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }
    var id = Mainloop.timeout_add(ms, function () {
        func.apply(null, args);
        return true;
    }, null);
    return id;
};
var clearInterval = function (id) {
    Mainloop.source_remove(id);
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
var GetDayName = function (date, locale, tz) {
    var support = isLocaleStringSupported();
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
    var support = isLocaleStringSupported();
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
    var days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')];
    return days[dayNum];
};
var timeToUserUnits = function (date, show24Hours) {
    var timeStr = Cinnamon.util_format_date('%H:%M', date.getTime());
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
