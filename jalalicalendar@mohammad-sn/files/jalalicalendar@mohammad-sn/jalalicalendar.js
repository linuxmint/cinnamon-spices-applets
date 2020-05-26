// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
const Signals = imports.signals;
const Pango = imports.gi.Pango;
const Gettext_gtk30 = imports.gettext.domain('gtk30');
const Cinnamon = imports.gi.Cinnamon;
const Settings = imports.ui.settings;

const Tooltips = imports.ui.tooltips;
const Tweener = imports.ui.tweener;
const Mainloop = imports.mainloop;

const MSECS_IN_DAY = 24 * 60 * 60 * 1000;
const WEEKDATE_HEADER_WIDTH_DIGITS = 3;
const SHOW_WEEKDATE_KEY = 'show-weekdate';

const AppletDir = imports.ui.appletManager.appletMeta['jalalicalendar@mohammad-sn'].path;
//const EventsFile = AppletDir + "/e.json";
const EventsFile = AppletDir + "/sevents.json";
const EventsFile2 = AppletDir + "/mevents.json";

////



/*
JavaScript functions for the Fourmilab Calendar Converter
by John Walker -- September, MIM
http://www.fourmilab.ch/documents/calendar/
This program is in the public domain.
*/
/* MOD -- Modulus function which works for non-integers. */
function mod(a, b) {
    return a - (b * Math.floor(a / b));
}
// LEAP_GREGORIAN -- Is a given year in the Gregorian calendar a leap year ?
function leap_gregorian(year) {
    return ((year % 4) == 0) &&
        (!(((year % 100) == 0) && ((year % 400) != 0)));
}
// GREGORIAN_TO_JD -- Determine Julian day number from Gregorian calendar date
var GREGORIAN_EPOCH = 1721425.5;

function gregorian_to_jd(year, month, day) {
    return (GREGORIAN_EPOCH - 1) +
        (365 * (year - 1)) +
        Math.floor((year - 1) / 4) +
        (-Math.floor((year - 1) / 100)) +
        Math.floor((year - 1) / 400) +
        Math.floor((((367 * month) - 362) / 12) +
            ((month <= 2) ? 0 :
                (leap_gregorian(year) ? -1 : -2)
            ) +
            day);
}
// JD_TO_GREGORIAN -- Calculate Gregorian calendar date from Julian day
function jd_to_gregorian(jd) {
    var wjd, depoch, quadricent, dqc, cent, dcent, quad, dquad,
        yindex, year, yearday, leapadj;
    wjd = Math.floor(jd - 0.5) + 0.5;
    depoch = wjd - GREGORIAN_EPOCH;
    quadricent = Math.floor(depoch / 146097);
    dqc = mod(depoch, 146097);
    cent = Math.floor(dqc / 36524);
    dcent = mod(dqc, 36524);
    quad = Math.floor(dcent / 1461);
    dquad = mod(dcent, 1461);
    yindex = Math.floor(dquad / 365);
    year = (quadricent * 400) + (cent * 100) + (quad * 4) + yindex;
    if (!((cent == 4) || (yindex == 4))) {
        year++;
    }
    yearday = wjd - gregorian_to_jd(year, 1, 1);
    leapadj = ((wjd < gregorian_to_jd(year, 3, 1)) ? 0 :
        (leap_gregorian(year) ? 1 : 2)
    );
    var month = Math.floor((((yearday + leapadj) * 12) + 373) / 367),
        day = (wjd - gregorian_to_jd(year, month, 1)) + 1;
    return [year, month, day];
}
var PERSIAN_EPOCH = 1948320.5;
// PERSIAN_TO_JD -- Determine Julian day from Persian date
function persian_to_jd(year, month, day) {
    var epbase, epyear;
    epbase = year - ((year >= 0) ? 474 : 473);
    epyear = 474 + mod(epbase, 2820);
    return day +
        ((month <= 7) ?
            ((month - 1) * 31) :
            (((month - 1) * 30) + 6)
        ) +
        Math.floor(((epyear * 682) - 110) / 2816) +
        (epyear - 1) * 365 +
        Math.floor(epbase / 2820) * 1029983 +
        (PERSIAN_EPOCH - 1);
}
// JD_TO_PERSIAN -- Calculate Persian date from Julian day
function jd_to_persian(jd) {
    var year, month, day, depoch, cycle, cyear, ycycle,
        aux1, aux2, yday;
    jd = Math.floor(jd) + 0.5;
    depoch = jd - persian_to_jd(475, 1, 1);
    cycle = Math.floor(depoch / 1029983);
    cyear = mod(depoch, 1029983);
    if (cyear == 1029982) {
        ycycle = 2820;
    } else {
        aux1 = Math.floor(cyear / 366);
        aux2 = mod(cyear, 366);
        ycycle = Math.floor(((2134 * aux1) + (2816 * aux2) + 2815) / 1028522) +
            aux1 + 1;
    }
    year = ycycle + (2820 * cycle) + 474;
    if (year <= 0) {
        year--;
    }
    yday = (jd - persian_to_jd(year, 1, 1)) + 1;
    month = (yday <= 186) ? Math.ceil(yday / 31) : Math.ceil((yday - 6) / 30);
    day = (jd - persian_to_jd(year, month, 1)) + 1;
    return [year, month, day];
}


// Cache original `Date` class. User may set window.Date = JDate
var Date = window['Date'];

function digits_fa2en(text) {
    return text.replace(/[۰-۹]/g, function(d) {
        return String.fromCharCode(d.charCodeAt(0) - 1728);
    });
}

function pad2(number) {
    return number < 10 ? '0' + number : number;
}

function persian_to_jd_fixed(year, month, day) {
    /*
    Fix `persian_to_jd` so we can use negative or large values for month, e.g:
    persian_to_jd_fixed(1393, 26, 1) == persian_to_jd_fixed(1395, 2, 1)
    persian_to_jd_fixed(1393, -2, 1) == persian_to_jd_fixed(1392, 10, 1)
     */
    if (month > 12 || month <= 0) {
        var yearDiff = Math.floor((month - 1) / 12);
        year += yearDiff;
        month = month - yearDiff * 12;
    }
    return persian_to_jd(year, month, day);
}

function parseDate(string, convertToPersian) {
    /*
     http://en.wikipedia.org/wiki/ISO_8601
     http://dygraphs.com/date-formats.html
     https://github.com/arshaw/xdate/blob/master/src/xdate.js#L414
     https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
     tests:
     +parseDate('2014') == +new Date('2014')
     +parseDate('2014-2') == +new Date('2014-02')
     +parseDate('2014-2-3') == +new Date('2014-02-03')
     +parseDate('2014-02-03 12:11') == +new Date('2014/02/03 12:11')
     +parseDate('2014-02-03T12:11') == +new Date('2014/02/03 12:11')
     parseDate('2014/02/03T12:11') == undefined
     +parseDate('2014/02/03 12:11:10.2') == +new Date('2014/02/03 12:11:10') + 200
     +parseDate('2014/02/03 12:11:10.02') == +new Date('2014/02/03 12:11:10') + 20
     parseDate('2014/02/03 12:11:10Z') == undefined
     +parseDate('2014-02-03T12:11:10Z') == +new Date('2014-02-03T12:11:10Z')
     +parseDate('2014-02-03T12:11:10+0000') == +new Date('2014-02-03T12:11:10Z')
     +parseDate('2014-02-03T10:41:10+0130') == +new Date('2014-02-03T12:11:10Z')
     */
    var re = /^(\d|\d\d|\d\d\d\d)(?:([-\/])(\d{1,2})(?:\2(\d|\d\d|\d\d\d\d))?)?(([ T])(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2})(?::?(\d{2}))?)?)?$/,
        match = re.exec(string);
    // re.exec('2012-4-5 01:23:10.1111+0130')
    //  0                              1       2    3    4    5                      6    7     8     9     10      11       12   13    14
    // ["2012-4-5 01:23:10.1111+0330", "2012", "-", "4", "5", " 01:23:10.1111+0130", " ", "01", "23", "10", "1111", "+0330", "+", "03", "30"]
    if (!match) return;
    var separator = match[2],
        timeSeparator = match[6],
        year = +match[1],
        month = +match[3] || 1,
        day = +match[4] || 1,
        isISO = (separator != '/') && (match[6] != ' '),
        hour = +match[7] || 0,
        minute = +match[8] || 0,
        seconds = +match[9] || 0,
        millis = +('0.' + (match[10] || '0')) * 1000,
        tz = match[11],
        isNonLocal = isISO && (tz || !match[5]),
        tzOffset = (match[12] == '-' ? -1 : 1) * ((+match[13] || 0) * 60 + (+match[14] || 0));
    // timezone should be empty if dates are with / (2012/1/10)
    if ((tz || timeSeparator == 'T') && !isISO) return;
    // one and only-one of year/day should be 4-chars (2012/1/10 vs 10/1/2012)
    if ((day >= 1000) == (year >= 1000)) return;
    if (day >= 1000) {
        // year and day only can be swapped if using '/' as separator
        if (separator == '-') return;
        day = +match[1];
        year = day;
    }
    if (convertToPersian) {
        var persian = jd_to_gregorian(persian_to_jd_fixed(year, month, day));
        year = persian[0];
        month = persian[1];
        day = persian[2];
    }
    var date = new Date(year, month - 1, day, hour, minute, seconds, millis);
    console.log(date);
    if (isNonLocal) {
        date.setUTCMinutes(date.getUTCMinutes() - date.getTimezoneOffset() + tzOffset);
    }
    return date;
}

/**
 * @param {Object=} a
 * @param {Number=} month
 * @param {Number=} day
 * @param {Number=} hour
 * @param {Number=} minute
 * @param {Number=} second
 * @param {Number=} millisecond
 * @constructor
 * @extends {Date}
 */
function JDate(a, month, day, hour, minute, second, millisecond) {
    if (typeof a == 'string') {
        this._d = parseDate(digits_fa2en(a), true);
        if (!this._d) throw 'Cannot parse date string'
    } else if (arguments.length == 0)
        this._d = new Date();
    else if (arguments.length == 1) {
        this._d = new Date((a instanceof JDate) ? a._d : a);
    } else {
        var persian = jd_to_gregorian(persian_to_jd_fixed(a, (month || 0) + 1, day || 1));
        this._d = new Date(persian[0], persian[1] - 1, persian[2], hour || 0, minute || 0, second || 0, millisecond || 0);
    }
    this['_date'] = this._d;
    this._cached_date_ts = null;
    this._cached_date = [0, 0, 0];
    this._cached_utc_date_ts = null;
    this._cached_utc_date = [0, 0, 0];

}

JDate.prototype = {
    _persianDate: function() {
        if (this._cached_date_ts != +this._d) {
            this._cached_date_ts = +this._d;
            this._cached_date = jd_to_persian(gregorian_to_jd(this._d.getFullYear(), this._d.getMonth() + 1, this._d.getDate()));
        }
        return this._cached_date
    },
    _persianUTCDate: function() {
        if (this._cached_utc_date_ts != +this._d) {
            this._cached_utc_date_ts = +this._d;
            this._cached_utc_date = jd_to_persian(gregorian_to_jd(this._d.getUTCFullYear(), this._d.getUTCMonth() + 1, this._d.getUTCDate()));
        }
        return this._cached_utc_date
    },
    _setPersianDate: function(which, value) {
        var persian = this._persianDate();
        persian[which] = value;
        var new_date = jd_to_gregorian(persian_to_jd_fixed(persian[0], persian[1], persian[2]));
        this._d.setFullYear(new_date[0]);
        this._d.setMonth(new_date[1] - 1);
        this._d.setDate(new_date[2]);
    },
    _setUTCPersianDate: function(which, value) {
        var persian = this._persianUTCDate();
        persian[which] = value;
        var new_date = jd_to_gregorian(persian_to_jd_fixed(persian[0], persian[1], persian[2]));
        this._d.setUTCFullYear(new_date[0]);
        this._d.setUTCMonth(new_date[1] - 1);
        this._d.setUTCDate(new_date[2]);
    }
};
JDate.prototype['getDate'] = function() {
    return this._persianDate()[2]
};
JDate.prototype['getMonth'] = function() {
    return this._persianDate()[1] - 1
};
JDate.prototype['getFullYear'] = function() {
    return this._persianDate()[0]
};
JDate.prototype['getUTCDate'] = function() {
    return this._persianUTCDate()[2]
};
JDate.prototype['getUTCMonth'] = function() {
    return this._persianUTCDate()[1] - 1
};
JDate.prototype['getUTCFullYear'] = function() {
    return this._persianUTCDate()[0]
};
JDate.prototype['setDate'] = function(v) {
    this._setPersianDate(2, v)
};
JDate.prototype['setFullYear'] = function(v) {
    this._setPersianDate(0, v)
};
JDate.prototype['setMonth'] = function(v) {
    this._setPersianDate(1, v + 1)
};
JDate.prototype['setUTCDate'] = function(v) {
    this._setUTCPersianDate(2, v)
};
JDate.prototype['setUTCFullYear'] = function(v) {
    this._setUTCPersianDate(0, v)
};
JDate.prototype['toLocaleString'] = function(v) {
    return this.getFullYear() + '/' + pad2(this.getMonth() + 1) + '/' + pad2(this.getDate()) + ' ' +
        pad2(this.getHours()) + ':' + pad2(this.getMinutes()) + ':' + pad2(this.getSeconds());
};
JDate.prototype['setUTCMonth'] = function(v) {
    this._setUTCPersianDate(1, v + 1)
};
JDate['now'] = Date.now;
JDate['parse'] = function(string) {
    new JDate(string)['getTime']()
};
JDate['UTC'] = function(year, month, date, hours, minutes, seconds, milliseconds) {
    var d = jd_to_gregorian(persian_to_jd_fixed(year, month + 1, date || 1));
    return Date.UTC(d[0], d[1] - 1, d[2], hours || 0, minutes || 0, seconds || 0, milliseconds || 0);
};
var i, dateProps = ('getHours getMilliseconds getMinutes getSeconds getTime getUTCDay getUTCHours ' +
        'getTimezoneOffset getUTCMilliseconds getUTCMinutes getUTCSeconds setHours setMilliseconds setMinutes ' +
        'setSeconds setTime setUTCHours setUTCMilliseconds setUTCMinutes setUTCSeconds toDateString toISOString ' +
        'toJSON toString toLocaleDateString toLocaleTimeString toTimeString toUTCString valueOf getDay getYear toLocaleFormat')
    .split(' '),
    createWrapper = function(k) {
        return function(v) {
            return this._d[k](v)
        }
    };

for (i = 0; i < dateProps.length; i++)
    JDate.prototype[dateProps[i]] = createWrapper(dateProps[i]);
window['JDate'] = JDate;



function _sameDay(dateA, dateB) {
    return (dateA.getDate() == dateB.getDate() &&
        dateA.getMonth() == dateB.getMonth() &&
        dateA.getYear() == dateB.getYear());
}

function _sameYear(dateA, dateB) {
    return (dateA.getYear() == dateB.getYear());
}

/* TODO: maybe needs config - right now we assume that Saturday and
 * Sunday are non-work days (not true in e.g. Israel, it's Sunday and
 * Monday there)
 */
function _isWorkDay(date) {
    return date.getDay() != 5; // && date.getDay() != 6;
}

function _getBeginningOfDay(date) {
    let ret = new JDate(date.getTime());
    ret.setHours(0);
    ret.setMinutes(0);
    ret.setSeconds(0);
    ret.setMilliseconds(0);
    return ret;
}

function _getEndOfDay(date) {
    let ret = new JDate(date.getTime());
    ret.setHours(23);
    ret.setMinutes(59);
    ret.setSeconds(59);
    ret.setMilliseconds(999);
    return ret;
}

function _formatEventTime(event, clockFormat) {
    let ret;
    if (event.allDay) {
        /* Translators: Shown in calendar event list for all day events
         * Keep it short, best if you can use less then 10 characters
         */
        ret = C_("event list time", "All Day");
    } else {
        switch (clockFormat) {
            case '24h':
                /* Translators: Shown in calendar event list, if 24h format */
                ret = event.date.toLocaleFormat(C_("event list time", "%H:%M"));
                break;

            default:
                /* explicit fall-through */
            case '12h':
                /* Transators: Shown in calendar event list, if 12h format */
                ret = event.date.toLocaleFormat(C_("event list time", "%l:%M %p"));
                break;
        }
    }
    return ret;
}

function _getCalendarWeekForDate(date) {
    // Based on the algorithms found here:
    // http://en.wikipedia.org/wiki/Talk:ISO_week_date
    let midnightDate = new JDate(date.getFullYear(), date.getMonth(), date.getDate());
    // Need to get Monday to be 1 ... Sunday to be 7
    let dayOfWeek = 1 + ((midnightDate.getDay() + 6) % 7);
    let nearestThursday = new JDate(midnightDate.getFullYear(), midnightDate.getMonth(),
        midnightDate.getDate() + (4 - dayOfWeek));

    let jan1st = new JDate(nearestThursday.getFullYear(), 0, 1);
    let diffDate = nearestThursday - jan1st;
    let dayNumber = Math.floor(Math.abs(diffDate) / MSECS_IN_DAY);
    let weekNumber = Math.floor(dayNumber / 7) + 1;

    return weekNumber;
}

function _getDigitWidth(actor) {
    let context = actor.get_pango_context();
    let themeNode = actor.get_theme_node();
    let font = themeNode.get_font();
    let metrics = context.get_metrics(font, context.get_language());
    let width = metrics.get_approximate_digit_width();
    return width;
}

function _getCalendarDayAbbreviation(dayNumber) {

    // This returns an array of abbreviated day names, starting with Sunday.
    // We use 2014/03/02 (months are zero-based in JS) because it was a Sunday

    let abbreviations = [
        toLocaleFormat(new JDate(2014, 3, 7), '%a'),
        toLocaleFormat(new JDate(2014, 3, 8), '%a'),
        toLocaleFormat(new JDate(2014, 3, 2), '%a'),
        toLocaleFormat(new JDate(2014, 3, 3), '%a'),
        toLocaleFormat(new JDate(2014, 3, 4), '%a'),
        toLocaleFormat(new JDate(2014, 3, 5), '%a'),
        toLocaleFormat(new JDate(2014, 3, 6), '%a')
    ];

    return abbreviations[dayNumber];
}

// Abstraction for an appointment/event in a calendar

function CalendarEvent(date, end, summary, allDay) {
    this._init(date, end, summary, allDay);
}

CalendarEvent.prototype = {
    _init: function(date, end, summary, allDay) {
        this.date = date;
        this.end = end;
        this.summary = summary;
        this.allDay = allDay;
    }
};

function _datesEqual(a, b) {
    if (a < b)
        return false;
    else if (a > b)
        return false;
    return true;
}

function _dateIntervalsOverlap(a0, a1, b0, b1) {
    if (a1 <= b0)
        return false;
    else if (b1 <= a0)
        return false;
    else
        return true;
}

function Calendar(settings) {
    this._init(settings);
}

Calendar.prototype = {
    _init: function(settings) {
        this._weekStart = 6; //Cinnamon.util_get_week_start();
        this._weekdate = NaN;
        this._digitWidth = NaN;
        this.settings = settings;

        //this.settings.connect("changed::show-week-numbers", Lang.bind(this, this._onSettingsChange));
        this.show_week_numbers = false;

        // Get events
        let jsonFileContent = Cinnamon.get_file_contents_utf8_sync(EventsFile);
        let obj = JSON.parse(jsonFileContent);
        this.events = obj.events;

        let jsonFileContent2 = Cinnamon.get_file_contents_utf8_sync(EventsFile2);
        let obj2 = JSON.parse(jsonFileContent2);
        this.events2 = obj2.events;

        // Find the ordering for month/year in the calendar heading

        switch (Gettext_gtk30.gettext('calendar:MY')) {
            case 'calendar:MY':
                this._headerMonthFirst = true;
                break;
            case 'calendar:YM':
                this._headerMonthFirst = false;
                break;
            default:
                log('Translation of "calendar:MY" in GTK+ is not correct');
                this._headerMonthFirst = true;
                break;
        }

        // Start off with the current date
        this._selectedDate = new JDate();

        this.actor = new St.Table({
            homogeneous: false,
            style_class: 'calendar',
            reactive: true
        });

        this.actor.connect('scroll-event',
            Lang.bind(this, this._onScroll));

        this._buildHeader();
    },

    _onSettingsChange: function(object, key, old_val, new_val) {
        this.show_week_numbers = new_val;
        this._buildHeader();
        this._update(false);
    },

    // Sets the calendar to show a specific date
    setDate: function(date, forceReload) {
        if (!_sameDay(date, this._selectedDate)) {
            this._selectedDate = new JDate(date);
            this._update(forceReload);
            this.emit('selected-date-changed', new Date(this._selectedDate.valueOf()));
        } else {
            if (forceReload)
                this._update(forceReload);
        }
    },

    _buildHeader: function() {
        let offsetCols = this.show_week_numbers ? 1 : 0;
        this.actor.destroy_children();

        // Top line of the calendar '<| September |> <| 2009 |>'
        this._topBoxMonth = new St.BoxLayout();
        this._topBoxYear = new St.BoxLayout();

        if (this._headerMonthFirst) {
            this.actor.add(this._topBoxMonth, {
                row: 0,
                col: 0,
                col_span: offsetCols + 4
            });
            this.actor.add(this._topBoxYear, {
                row: 0,
                col: offsetCols + 4,
                col_span: 3
            });
        } else {
            this.actor.add(this._topBoxMonth, {
                row: 0,
                col: offsetCols + 3,
                col_span: 4
            });
            this.actor.add(this._topBoxYear, {
                row: 0,
                col: 0,
                col_span: offsetCols + 3
            });
        }

        this.actor.connect('style-changed', Lang.bind(this, this._onStyleChange));

        let forward = new St.Button({
            style_class: 'calendar-change-month-forward'
        });
        forward.set_direction(Clutter.TextDirection.RTL);
        this._topBoxMonth.add(forward);
        forward.connect('clicked', Lang.bind(this, this._onNextMonthButtonClicked));

        this._monthLabel = new St.Label({
            style_class: 'calendar-month-label'
        });
        this._topBoxMonth.add(this._monthLabel, {
            expand: true,
            x_fill: false,
            x_align: St.Align.MIDDLE
        });

        let back = new St.Button({
            style_class: 'calendar-change-month-back'
        });
        back.set_direction(Clutter.TextDirection.RTL);
        this._topBoxMonth.add(back);
        back.connect('clicked', Lang.bind(this, this._onPrevMonthButtonClicked));

        forward = new St.Button({
            style_class: 'calendar-change-month-forward'
        });
        forward.set_direction(Clutter.TextDirection.RTL);
        this._topBoxYear.add(forward);
        forward.connect('clicked', Lang.bind(this, this._onNextYearButtonClicked));

        this._yearLabel = new St.Label({
            style_class: 'calendar-month-label'
        });
        this._topBoxYear.add(this._yearLabel, {
            expand: true,
            x_fill: false,
            x_align: St.Align.MIDDLE
        });

        back = new St.Button({
            style_class: 'calendar-change-month-back'
        });
        back.set_direction(Clutter.TextDirection.RTL);
        this._topBoxYear.add(back);
        back.connect('clicked', Lang.bind(this, this._onPrevYearButtonClicked));

        // Add weekday labels...
        //
        // We need to figure out the abbreviated localized names for the days of the week;
        // we do this by just getting the next 7 days starting from right now and then putting
        // them in the right cell in the table. It doesn't matter if we add them in order
        let iter = new JDate(this._selectedDate);
        iter.setSeconds(0); // Leap second protection. Hah!
        iter.setHours(12);
        for (let i = 0; i < 7; i++) {
            // Could use iter.toLocaleFormat('%a') but that normally gives three characters
            // and we want, ideally, a single character for e.g. S M T W T F S
            let customDayAbbrev = _getCalendarDayAbbreviation(iter.getDay());
            let label = new St.Label({
                style_class: 'calendar-day-base calendar-day-heading',
                text: customDayAbbrev
            });
            this.actor.add(label, {
                row: 1,
                col: offsetCols + (7 + iter.getDay() - this._weekStart) % 7,
                x_fill: false,
                x_align: St.Align.MIDDLE
            });
            iter.setTime(iter.getTime() + MSECS_IN_DAY);
        }

        // All the children after this are days, and get removed when we update the calendar
        this._firstDayIndex = this.actor.get_children().length;

        this.actor.set_direction(Clutter.TextDirection.RTL);
    },

    _onStyleChange: function(actor, event) {
        // width of a digit in pango units
        this._digitWidth = _getDigitWidth(this.actor) / Pango.SCALE;
        this._setWeekdateHeaderWidth();
    },

    _setWeekdateHeaderWidth: function() {
        if (this.digitWidth != NaN && this.show_week_numbers && this._weekdateHeader) {
            this._weekdateHeader.set_width(this._digitWidth * WEEKDATE_HEADER_WIDTH_DIGITS);
        }
    },

    _onScroll: function(actor, event) {
        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
            case Clutter.ScrollDirection.LEFT:
                this._onPrevMonthButtonClicked();
                break;
            case Clutter.ScrollDirection.DOWN:
            case Clutter.ScrollDirection.RIGHT:
                this._onNextMonthButtonClicked();
                break;
        }
    },

    _applyDateBrowseAction: function(yearChange, monthChange) {
        let oldDate = this._selectedDate;
        let newMonth = oldDate.getMonth() + monthChange;

        if (newMonth > 11) {
            yearChange = yearChange + 1;
            newMonth = 0;
        } else if (newMonth < 0) {
            yearChange = yearChange - 1;
            newMonth = 11;
        }
        let newYear = oldDate.getFullYear() + yearChange;

        let newDayOfMonth = oldDate.getDate();
        let daysInMonth = 32 - new JDate(newYear, newMonth, 32).getDate();
        if (newDayOfMonth > daysInMonth) {
            newDayOfMonth = daysInMonth;
        }

        let newDate = new JDate();
        newDate.setDate(newDayOfMonth);
        newDate.setMonth(newMonth);
        newDate.setFullYear(newYear);
        this.setDate(newDate, false);
    },

    _onPrevYearButtonClicked: function() {
        // this._applyDateBrowseAction(-1, 0);
        this.actor.set_pivot_point(2, 0);
        Tweener.addTween(this.actor, {
            opacity: 0,
            scale_x: 1.3,
            time: 0.300,
            transition: "easeOutExpo"
        });
        Mainloop.timeout_add(300, Lang.bind(this, function() {
            this._applyDateBrowseAction(-1, 0);
            this.actor.set_pivot_point(-1, 0);
            Tweener.addTween(this.actor, {
                opacity: 255,
                scale_x: 1,
                time: 0.300,
                transition: "easeOutExpo"
            });
        }));
    },

    _onNextYearButtonClicked: function() {
        // this._applyDateBrowseAction(+1, 0);
        this.actor.set_pivot_point(-1, 0);
        Tweener.addTween(this.actor, {
            opacity: 0,
            scale_x: 1.2,
            time: 0.300,
            transition: "easeOutExpo"
        });
        Mainloop.timeout_add(300, Lang.bind(this, function() {
            this._applyDateBrowseAction(+1, 0);
            this.actor.set_pivot_point(2, 0);
            Tweener.addTween(this.actor, {
                opacity: 255,
                scale_x: 1,
                time: 0.300,
                transition: "easeOutExpo"
            });
        }));
    },

    _onPrevMonthButtonClicked: function() {
        //this._applyDateBrowseAction(0, -1);
        this.actor.set_pivot_point(1.33, 0);
        Tweener.addTween(this.actor, {
            opacity: 0,
            scale_x: 1.1,
            time: 0.150,
            transition: "easeOutExpo"
        });
        Mainloop.timeout_add(150, Lang.bind(this, function() {
            this._applyDateBrowseAction(0, -1);
            this.actor.set_pivot_point(-0.33, 0);
            Tweener.addTween(this.actor, {
                opacity: 255,
                scale_x: 1,
                time: 0.150,
                transition: "easeOutExpo"
            });
        }));
    },

    _onNextMonthButtonClicked: function() {
        //this.actor(0)
        this.actor.set_pivot_point(-0.33, 0);
        Tweener.addTween(this.actor, {
            opacity: 0,
            scale_x: 1.1,
            time: 0.150,
            transition: "easeOutExpo"
        });
        Mainloop.timeout_add(200, Lang.bind(this, function() {
            this._applyDateBrowseAction(0, +1);
            this.actor.set_pivot_point(1.33, 0);
            Tweener.addTween(this.actor, {
                opacity: 255,
                scale_x: 1,
                time: 0.150,
                transition: "easeOutExpo"
            });
        }));

    },

    _isHollyDay: function(now) {
        let ny = new JDate(now.getFullYear(), 0, 0);
        let i = Math.floor((now - ny) / 24 / 3600000);
        if (this.events[i].ishollyday)
            return true;
        if (now.getFullYear() == 1396 && this.events2[i].ishollyday)
            return true;
        return false;
    },

    _addEventsTooltip: function(now, actor) {
        let ny = new JDate(now.getFullYear(), 0, 0);
        let i = Math.floor((now - ny) / 24 / 3600000);
        if (this.events[i].description || now.getFullYear() == 1396 && this.events2[i].description) {
            let tt_text = "";
            if (this.events[i].description) {
                tt_text += this.events[i].description;
                if (now.getFullYear() == 1396 && this.events2[i].description)
                    tt_text += " - " + this.events2[i].description;
            } else if (now.getFullYear() == 1396 && this.events2[i].description) {
                tt_text += this.events2[i].description;
            }
            new Tooltips.Tooltip(actor, tt_text);
            //actor.style = "text-decoration: underline;";
        }
    },

    _update: function(forceReload) {
        let now = new JDate();
        let j = new JDate(now.valueOf());
        this._monthLabel.text = farsimonth[this._selectedDate.getMonth()];
        this._yearLabel.text = FarsiNumbers(this._selectedDate.getFullYear().toString());

        // Remove everything but the topBox and the weekday labels
        let children = this.actor.get_children();
        for (let i = this._firstDayIndex; i < children.length; i++)
            children[i].destroy();

        // Start at the beginning of the week before the start of the month
        let beginDate = new JDate(this._selectedDate);
        beginDate.setDate(1);
        beginDate.setSeconds(0);
        beginDate.setHours(12);
        let daysToWeekStart = (7 + beginDate.getDay() - this._weekStart) % 7;
        beginDate.setTime(beginDate.getTime() - daysToWeekStart * MSECS_IN_DAY);

        let iter = new JDate(beginDate);
        let row = 2;
        while (true) {
            let button = new St.Button({
                label: FarsiNumbers(iter.getDate().toString())
            });

            button.reactive = true;

            let iterStr = iter.toUTCString();
            /*button.connect('clicked', Lang.bind(this, function() {
                let newlySelectedDate = new JDate(new Date(iterStr));
                this.setDate(newlySelectedDate, false);
            }));*/

            let styleClass = 'calendar-day-base calendar-day';
            if (_isWorkDay(iter) && !this._isHollyDay(iter))
                styleClass += ' calendar-work-day'
            else
                styleClass += ' calendar-nonwork-day'

            this._addEventsTooltip(iter, button);

            // Hack used in lieu of border-collapse - see cinnamon.css
            if (row == 2)
                styleClass = 'calendar-day-top ' + styleClass;
            if (iter.getDay() == (this._weekStart + 6) % 7)
                styleClass = 'calendar-day-left ' + styleClass;

            if (_sameDay(now, iter))
                styleClass += ' calendar-today';
            else if (iter.getMonth() != this._selectedDate.getMonth())
                styleClass += ' calendar-other-month-day';

            if (_sameDay(this._selectedDate, iter))
                button.add_style_pseudo_class('active');

            button.style_class = styleClass;

            let offsetCols = this.show_week_numbers ? 1 : 0;
            this.actor.add(button, {
                row: row,
                col: offsetCols + (7 + iter.getDay() - this._weekStart) % 7
            });

            if (this.show_week_numbers && iter.getDay() == 4) {
                let label = new St.Label({
                    text: _getCalendarWeekForDate(iter).toString(),
                    style_class: 'calendar-day-base calendar-week-number'
                });
                this.actor.add(label, {
                    row: row,
                    col: 0,
                    y_align: St.Align.MIDDLE
                });
            }

            iter.setTime(iter.getTime() + MSECS_IN_DAY);
            if (iter.getDay() == this._weekStart) {
                row++;
                // We always stop after placing 6 rows, even if month fits in 4
                // to prevent issues with jumping controls, see #226
                if (row > 7) {
                    break;
                }
            }
        }
    }
};

String.prototype.charRefToUnicode = function() {
    return this.replace(
        /&#(([0-9]{1,7})|(x[0-9a-f]{1,6}));?/gi,
        function(match, p1, p2, p3, offset, s) {
            return String.fromCharCode(p2 || ("0" + p3));
        });
};

String.prototype.replaceAll = function(find, replace) {
    var str = this;
    return str.replace(new RegExp(find, 'g'), replace);
};

function FarsiNumbers(strText) {
    let engNum = new Array("0", "1", "2", "3", "4", "5", "6", "7", "8", "9");
    let farNum = new Array("&#1776;", "&#1777;", "&#1778;", "&#1779;", "&#1780;", "&#1781;", "&#1782;", "&#1783;", "&#1784;", "&#1785;");
    for (let i = 0; i < engNum.length; i++)
        strText = strText.replaceAll(engNum[i], farNum[i].charRefToUnicode());
    return strText;
};

let farsimonth = [
    ("&#1601;&#1585;&#1608;&#1585;&#1583;&#1740;&#1606;").charRefToUnicode(),
    ("&#1575;&#1585;&#1583;&#1740;&#1576;&#1607;&#1588;&#1578;").charRefToUnicode(),
    ("&#1582;&#1585;&#1583;&#1575;&#1583;").charRefToUnicode(),
    ("&#1578;&#1740;&#1585;").charRefToUnicode(),
    ("&#1605;&#1585;&#1583;&#1575;&#1583;").charRefToUnicode(),
    ("&#1588;&#1607;&#1585;&#1740;&#1608;&#1585;").charRefToUnicode(),
    ("&#1605;&#1607;&#1585;").charRefToUnicode(),
    ("&#1570;&#1576;&#1575;&#1606;").charRefToUnicode(),
    ("&#1570;&#1584;&#1585;").charRefToUnicode(),
    ("&#1583;&#1740;").charRefToUnicode(),
    ("&#1576;&#1607;&#1605;&#1606;").charRefToUnicode(),
    ("&#1575;&#1587;&#1601;&#1606;&#1583;").charRefToUnicode()
];

function toLocaleFormat(jdate, strFormat) {
    let FarsiDayNamesFull = new Array(
        "&#1740;&#1705;&#1588;&#1606;&#1576;&#1607;",
        "&#1583;&#1608;&#1588;&#1606;&#1576;&#1607;",
        "&#1587;&#1607;&#8204;&#1588;&#1606;&#1576;&#1607;",
        "&#1670;&#1607;&#1575;&#1585;&#1588;&#1606;&#1576;&#1607;",
        "&#1662;&#1606;&#1580;&#8204;&#1588;&#1606;&#1576;&#1607;",
        "&#1580;&#1605;&#1593;&#1607;",
        "&#1588;&#1606;&#1576;&#1607;");
    let FarsiMonthNames = new Array(
        "&#1601;&#1585;&#1608;&#1585;&#1583;&#1740;&#1606;",
        "&#1575;&#1585;&#1583;&#1740;&#1576;&#1607;&#1588;&#1578;",
        "&#1582;&#1585;&#1583;&#1575;&#1583;",
        "&#1578;&#1740;&#1585;",
        "&#1605;&#1585;&#1583;&#1575;&#1583;",
        "&#1588;&#1607;&#1585;&#1740;&#1608;&#1585;",
        "&#1605;&#1607;&#1585;",
        "&#1570;&#1576;&#1575;&#1606;",
        "&#1570;&#1584;&#1585;",
        "&#1583;&#1740;",
        "&#1576;&#1607;&#1605;&#1606;",
        "&#1575;&#1587;&#1601;&#1606;&#1583;");
    let FarsiMonthNamesShort = new Array(
        "&#1601;&#1585;&#1608;",
        "&#1575;&#1585;&#1583;",
        "&#1582;&#1585;&#1583;",
        "&#1578;&#1740;&#1585;",
        "&#1605;&#1585;&#1583;",
        "&#1588;&#1607;&#1585;",
        "&#1605;&#1607;&#1585;",
        "&#1570;&#1576;&#1575;",
        "&#1570;&#1584;&#1585;",
        "&#1583;&#1740;",
        "&#1576;&#1607;&#1605;",
        "&#1575;&#1587;&#1601;");

    let dateResult = strFormat;
    dateResult = dateResult.replace("%Y", jdate.getFullYear().toString());
    dateResult = dateResult.replace("%y", jdate.getFullYear().toString().substr(2));
    dateResult = dateResult.replace("%d", jdate.getDate().toString());
    dateResult = dateResult.replace("%e", FarsiNumbers(jdate.getDate().toString()));
    dateResult = dateResult.replace("%m", (jdate.getMonth() + 1).toString());
    dateResult = dateResult.replace("%B", FarsiMonthNames[jdate.getMonth()].charRefToUnicode());
    dateResult = dateResult.replace("%b", FarsiMonthNamesShort[jdate.getMonth()].charRefToUnicode());
    dateResult = dateResult.replace("%A", FarsiDayNamesFull[jdate.getDay()].charRefToUnicode());
    dateResult = dateResult.replace("%a", FarsiDayNamesFull[jdate.getDay()].charRefToUnicode());
    dateResult = jdate.toLocaleFormat(dateResult);

    return dateResult;
};

Signals.addSignalMethods(Calendar.prototype);

