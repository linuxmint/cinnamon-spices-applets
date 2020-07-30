/* global imports, C_ */
/* eslint camelcase: "off" */

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const Signals = imports.signals;
const Pango = imports.gi.Pango;
const Gettext_gtk30 = imports.gettext.domain("gtk30");
const Cinnamon = imports.gi.Cinnamon;
const Utils = require("./utils");

const MSECS_IN_DAY = 24 * 60 * 60 * 1000;
const WEEKDATE_HEADER_WIDTH_DIGITS = 3;
const SHOW_WEEKDATE_KEY = "show-week-numbers";
const WEEKEND_LENGHTE_KEY = "weekend-length";
const FIRST_WEEKDAY_KEY = "first-day-of-week";
const DESKTOP_SCHEMA = "org.cinnamon.desktop.interface";

const timeinfo = Utils.getInfo("LC_TIME");
const LC_ABDAY = timeinfo.abday.split(";");
const LC_FIRST_WORKDAY = (timeinfo.first_workday + 6) % 7;

const Langinfo = Utils.getInfo("LC_ADDRESS");
const LC_AB3 = Langinfo.country_ab3.toLowerCase();

const Holidays = require("./holidays");

// in org.cinnamon.desktop.interface
const CLOCK_FORMAT_KEY = "clock-format";

function _sameDay(dateA, dateB) {
    return (dateA.getDate() === dateB.getDate() &&
            dateA.getMonth() === dateB.getMonth() &&
            dateA.getFullYear() === dateB.getFullYear());
}

function _sameYear(dateA, dateB) {
    return (dateA.getFullYear() === dateB.getFullYear());
}

/* TODO: maybe needs config - right now we assume that Saturday and
 * Sunday are non-work days (not true in e.g. Israel, it"s Sunday and
 * Monday there)
 */
function _isWorkDay(date, weekend_length) {
    return date.getDay() !== (LC_FIRST_WORKDAY + 7 - weekend_length) % 7 &&
    date.getDay() !== (LC_FIRST_WORKDAY + 6) % 7;
}

function _getBeginningOfDay(date) {
    let ret = new Date(date.getTime());
    ret.setHours(0);
    ret.setMinutes(0);
    ret.setSeconds(0);
    ret.setMilliseconds(0);
    return ret;
}

function _getEndOfDay(date) {
    let ret = new Date(date.getTime());
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
        case "24h":
            /* Translators: Shown in calendar event list, if 24h format */
            ret = event.date.toLocaleFormat(C_("event list time", "%H:%M"));
            break;

        default:
            /* falls through */
        case "12h":
            /* Transators: Shown in calendar event list, if 12h format */
            ret = event.date.toLocaleFormat(C_("event list time", "%l:%M %p"));
            break;
        }
    }
    return ret;
}

function _getDigitWidth(actor){
    let context = actor.get_pango_context();
    let themeNode = actor.get_theme_node();
    let font = themeNode.get_font();
    let metrics = context.get_metrics(font, context.get_language());
    let width = metrics.get_approximate_digit_width();
    return width;
}

function _getCalendarDayAbbreviation(dayNumber) {
    return LC_ABDAY[dayNumber];
}

// Abstraction for an appointment/event in a calendar

class CalendarEvent {
    constructor(date, end, summary, allDay) {
        this.date = date;
        this.end = end;
        this.summary = summary;
        this.allDay = allDay;
    }
}

function _datesEqual(a, b) {
    if (a < b) {
        return false;
    } else if (a > b) {
        return false;
    }
    return true;
}

function _dateIntervalsOverlap(a0, a1, b0, b1)
{
    if (a1 <= b0) {
        return false;
    } else if (b1 <= a0) {
        return false;
    } else {
        return true;
    }
}

class Calendar {
    constructor(settings) {
        this._weekStart = Cinnamon.util_get_week_start();
        this._weekdate = NaN;
        this._digitWidth = NaN;
        this.settings = settings;

        this.settings.bindWithObject(this, SHOW_WEEKDATE_KEY, "show_week_numbers", this._onSettingsChange);
        this.settings.bindWithObject(this, WEEKEND_LENGHTE_KEY, "weekend_length", this._onSettingsChange);
        this.desktop_settings = new Gio.Settings({ schema_id: DESKTOP_SCHEMA });
        this.desktop_settings.connect("changed::" + FIRST_WEEKDAY_KEY, this._onSettingsChange.bind(this));

        // Find the ordering for month/year in the calendar heading

        let var_name = "calendar:MY";
        switch (Gettext_gtk30.gettext(var_name)) {
        case "calendar:MY":
            this._headerMonthFirst = true;
            break;
        case "calendar:YM":
            this._headerMonthFirst = false;
            break;
        default:
            global.log("Translation of 'calendar:MY' in GTK+ is not correct");
            this._headerMonthFirst = true;
            break;
        }

        this.holiday = new Holidays.HolidayData().getProvider();

        this.settings.bind("country", "country", this._onPlaceChanged.bind(this));
        this.regions = {};

        for (let country of this.settings.getValue("has_region")) {
            this.settings.bindWithObject(this.regions, "region_" + country, country,
                this._onPlaceChanged.bind(this));
        }

        if (this.settings.getValue("country") == null) {
            this.settings.setValue("country", LC_AB3);
        }
        // must be called once inside constructor, see issues/3063
        this._onPlaceChanged();

        // Start off with the current date
        this._selectedDate = new Date();

        this.actor = new St.Table({ homogeneous: false,
                                    style_class: "calendar",
                                    reactive: true });

        this.actor.connect("scroll-event", this._onScroll.bind(this));

        this._buildHeader ();
    }

    _onSettingsChange(object, key, old_val, new_val) {
        if (key === FIRST_WEEKDAY_KEY) {
            this._weekStart = Cinnamon.util_get_week_start();
        }
        this._buildHeader();
        this._update(false);
    }

    _onPlaceChanged() {
        const country = this.settings.getValue('country') || LC_AB3;
        this.holiday.setPlace(country, this.regions[country]);
    }

    // Sets the calendar to show a specific date
    setDate(date, forceReload) {
        if (!_sameDay(date, this._selectedDate)) {
            this._selectedDate = date;
            this._update(forceReload);
            this.emit("selected-date-changed", new Date(this._selectedDate));
        } else {
            if (forceReload) {
                this._update(forceReload);
            }
        }
    }

    _buildHeader() {
        let offsetCols = this.show_week_numbers ? 1 : 0;
        this.actor.destroy_all_children();

        // Top line of the calendar "<| September |> <| 2009 |>"
        this._topBoxMonth = new St.BoxLayout();
        this._topBoxYear = new St.BoxLayout();

        if (this._headerMonthFirst) {
            this.actor.add(this._topBoxMonth,
                       {row: 0, col: 0, col_span: offsetCols + 4});
            this.actor.add(this._topBoxYear,
                       {row: 0, col: offsetCols + 4, col_span: 3});
        } else {
            this.actor.add(this._topBoxMonth,
                       {row: 0, col: offsetCols + 3, col_span: 4});
            this.actor.add(this._topBoxYear,
                       {row: 0, col: 0, col_span: offsetCols + 3});
        }

        this.actor.connect("style-changed", this._onStyleChange.bind(this));

        let back = new St.Button({ style_class: "calendar-change-month-back" });
        this._topBoxMonth.add(back);
        back.connect("clicked", this._onPrevMonthButtonClicked.bind(this));

        this._monthLabel = new St.Label({style_class: "calendar-month-label"});
        this._topBoxMonth.add(this._monthLabel, { expand: true, x_fill: false, x_align: St.Align.MIDDLE });

        let forward = new St.Button({ style_class: "calendar-change-month-forward" });
        this._topBoxMonth.add(forward);
        forward.connect("clicked", this._onNextMonthButtonClicked.bind(this));

        back = new St.Button({style_class: "calendar-change-month-back"});
        this._topBoxYear.add(back);
        back.connect("clicked", this._onPrevYearButtonClicked.bind(this));

        this._yearLabel = new St.Label({style_class: "calendar-month-label"});
        this._topBoxYear.add(this._yearLabel, {expand: true, x_fill: false, x_align: St.Align.MIDDLE});

        forward = new St.Button({style_class: "calendar-change-month-forward"});
        this._topBoxYear.add(forward);
        forward.connect("clicked", this._onNextYearButtonClicked.bind(this));

        // Add weekday labels...
        //
        // We need to figure out the abbreviated localized names for the days of the week;
        // we do this by just getting the next 7 days starting from right now and then putting
        // them in the right cell in the table. It doesn"t matter if we add them in order
        let iter = new Date(this._selectedDate);
        iter.setSeconds(0); // Leap second protection. Hah!
        iter.setHours(12);
        for (let i = 0; i < 7; i++) {
            let customDayAbbrev = _getCalendarDayAbbreviation(iter.getDay());
            let label = new St.Label({ style_class: "calendar-day-base calendar-day-heading",
                                       text: customDayAbbrev });
            this.actor.add(label,
                           { row: 1,
                             col: offsetCols + (7 + iter.getDay() - this._weekStart) % 7,
                             x_fill: false, x_align: St.Align.MIDDLE });
            iter.setTime(iter.getTime() + MSECS_IN_DAY);
        }

        // All the children after this are days, and get removed when we update the calendar
        this._firstDayIndex = this.actor.get_n_children();
    }

    _onStyleChange(actor, event) {
        // width of a digit in pango units
        this._digitWidth = _getDigitWidth(this.actor) / Pango.SCALE;
        this._setWeekdateHeaderWidth();
    }

    _setWeekdateHeaderWidth() {
        if (!isNaN(this._digitWidth) && this.show_week_numbers && this._weekdateHeader) {
            this._weekdateHeader.set_width (this._digitWidth * WEEKDATE_HEADER_WIDTH_DIGITS);
        }
    }

    _onScroll (actor, event) {
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
    }

    _applyDateBrowseAction(yearChange, monthChange) {
        let oldDate = this._selectedDate;
        let newMonth = oldDate.getMonth() + monthChange;

        if (newMonth> 11) {
            yearChange = yearChange + 1;
            newMonth = 0;
        } else if (newMonth < 0) {
            yearChange = yearChange - 1;
            newMonth = 11;
        }
        let newYear = oldDate.getFullYear() + yearChange;

        let newDayOfMonth = oldDate.getDate();
        let daysInMonth = 32 - new Date(newYear, newMonth, 32).getDate();
        if (newDayOfMonth > daysInMonth) {
            newDayOfMonth = daysInMonth;
        }

        let newDate = new Date();
        newDate.setFullYear(newYear, newMonth, newDayOfMonth);
        this.setDate(newDate, false);
    }

    _onPrevYearButtonClicked() {
        this._applyDateBrowseAction(-1, 0);
    }

    _onNextYearButtonClicked() {
        this._applyDateBrowseAction(+1, 0);
    }

    _onPrevMonthButtonClicked() {
        this._applyDateBrowseAction(0, -1);
    }

    _onNextMonthButtonClicked() {
        this._applyDateBrowseAction(0, +1);
    }

    _update(forceReload) {
        let now = new Date();

        this._monthLabel.text = this._selectedDate.toLocaleFormat("%OB").capitalize();
        this._yearLabel.text = this._selectedDate.toLocaleFormat("%Y");

        // Remove everything but the topBox and the weekday labels
        let children = this.actor.get_children();
        for (let i = this._firstDayIndex; i < children.length; i++) {
            children[i].destroy();
        }

        // Start at the beginning of the week before the start of the month
        let beginDate = new Date(this._selectedDate);
        beginDate.setDate(1);
        beginDate.setSeconds(0);
        beginDate.setHours(12);
        let daysToWeekStart = (7 + beginDate.getDay() - this._weekStart) % 7;
        beginDate.setTime(beginDate.getTime() - daysToWeekStart * MSECS_IN_DAY);

        const buttons = new Map();

        let iter = new Date(beginDate);
        let row = 2;
        do {
            let button = new St.Button({ label: iter.getDate().toString() });

            //only same month dates are eligable for holiday
            if (iter.getMonth() === this._selectedDate.getMonth()) {
                buttons.set(iter.getDate(), button);
            }

            //button.reactive = false;

            const newlySelectedDate = new Date(iter.getTime());
            button.connect("clicked", this.setDate.bind(this, newlySelectedDate, false));

            let styleClass = ["calendar-day-base", "calendar-day"];
            if (_isWorkDay(iter, this.weekend_length)) {
                styleClass.push("calendar-work-day");
            } else {
                styleClass.push("calendar-nonwork-day");
            }

            // Hack used in lieu of border-collapse - see cinnamon.css
            if (row === 2) {
                styleClass.push("calendar-day-top");
            }
            if (iter.getDay() === this._weekStart) {
                styleClass.push("calendar-day-left");
            }

            if (_sameDay(now, iter)) {
                styleClass.push("calendar-today");
            } else if (iter.getMonth() !== this._selectedDate.getMonth()) {
                styleClass.push("calendar-other-month-day");
            }

            if (_sameDay(this._selectedDate, iter)) {
                button.add_style_pseudo_class("active");
            }

            button.style_class = styleClass.join(" ");

            let offsetCols = this.show_week_numbers ? 1 : 0;
            this.actor.add(button,
                           { row, col: offsetCols + (7 + iter.getDay() - this._weekStart) % 7 });

            if (this.show_week_numbers && iter.getDay() === 4) {
                let label = new St.Label({ text: iter.toLocaleFormat("%V"),
                                           style_class: "calendar-day-base calendar-week-number"});
                this.actor.add(label,
                               { row, col: 0, y_align: St.Align.MIDDLE });
            }

            iter.setTime(iter.getTime() + MSECS_IN_DAY);
            if (iter.getDay() === this._weekStart) {
                row++;
            }
        // We always stop after placing 6 rows, even if month fits in 4
        // to prevent issues with jumping controls, see #226
        } while (row <= 7 );

        this.holiday.getHolidays(this._selectedDate.getFullYear(), this._selectedDate.getMonth() + 1, (dates) => {
            for (const [day, name] of dates.entries()) {
                const button = buttons.get(day);

                const tooltip = new Tooltips.Tooltip(button);
                tooltip.set_text(name);

                button.remove_style_class_name("calendar-work-day");
                button.add_style_class_name("calendar-nonwork-day");
                //button.queue_redraw();
            }
        });
    }
}

Signals.addSignalMethods(Calendar.prototype);