/**
 * MINIMAL AMD LOADER FOR CINNAMON JS ENVIRONMENT
 */
var modules = {};
var define = function(id, deps, factory) {
    var moduleId = id.split('/').pop();
    var resolvedDeps = deps.map(function(dep) {
        var depId = dep.split('/').pop();
        if (depId === 'require') {
            return function(moduleName) {
                return modules[moduleName.split('/').pop()];
            };
        }
        if (depId === 'exports') {
            return (modules[moduleId] = modules[moduleId] || {});
        }
        return modules[depId] || {};
    });
    var moduleExports = factory.apply(null, resolvedDeps);
    if (moduleExports !== undefined) {
        modules[moduleId] = moduleExports;
    }
};
/**
 * Project IT Calendar - Day Interface & Types
 * --------------------------------------------
 * This file defines the data structures for calendar days.
 * Note: Since this file only contains types and interfaces, it
 * produces no JavaScript output.
 */
define("CalendarDay", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
/**
 * DEVELOPER NOTE:
 * We do not use (global as any) here because interfaces and types
 * are removed during compilation. They only exist for the
 * TypeScript compiler's type-checking phase.
 */
/**
 * Project IT Calendar - Business Logic (Holiday & Date Handling)
 * -----------------------------------------------------------
 * This component manages holiday data loading and calculation.
 * * DESIGN DECISIONS:
 * 1. HYBRID MODULE SYSTEM:
 * Uses 'export' for AMD/UMD compatibility and 'global' assignment for
 * monolithic bundling (outFile). This satisfies both Cinnamon's
 * internal requireModule and tsc's 'None' module setting.
 * * 2. GJS COMPATIBILITY:
 * Uses native GLib for file operations instead of Node.js 'fs',
 * ensuring it runs inside the Cinnamon/SpiderMonkey environment.
 * * 3. TYPE SAFETY:
 * Imports types from CalendarDay.ts. Note that in 'None' mode,
 * these imports are purely for the compiler and emit no JS code.
 */
define("CalendarLogic", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CalendarLogic = void 0;
    // GJS Imports - Standard way to access GNOME/Cinnamon APIs
    const GLib = imports.gi.GLib;
    class CalendarLogic {
        /**
         * @param appletDir The absolute path to the applet folder (metadata.path).
         */
        constructor(appletDir) {
            this.holidayData = {};
            this.appletDir = appletDir;
            this.loadHolidays();
        }
        /**
         * Loads holiday data from local JSON files.
         * Logic: Detects system locale and tries to find a matching {lang}.json.
         */
        loadHolidays() {
            try {
                // Determine system language (e.g., "de_DE" -> "de")
                let locale = GLib.get_language_names()[0] || "en";
                let lang = locale.split('_')[0].split('.')[0].toLowerCase();
                // Construct path to holiday definitions
                let filePath = `${this.appletDir}/holidays/${lang}.json`;
                if (GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
                    let [success, content] = GLib.file_get_contents(filePath);
                    if (success) {
                        let json = JSON.parse(content.toString());
                        this.holidayData = json.regions || {};
                    }
                }
            }
            catch (e) {
                // Use global.log as it's the standard way to log in Cinnamon Applets
                if (typeof global !== 'undefined') {
                    global.log(`[CalendarLogic] Error loading holidays: ${e}`);
                }
            }
        }
        /**
         * getHolidaysForDate: Returns all holidays for a specific date and region.
         * Used by:
         * - applet.ts: via setHeaderDate() to update the popup header.
         * - CalendarView.ts: during renderMonthView() to mark holiday cells and tooltips.
         * * @param date - The Date object to check.
         * @param region - Regional code (e.g., "de-BY"). Defaults to "de".
         * @returns An array of unique holiday names.
         */
        getHolidaysForDate(date, region = "de") {
            let dayHolidays = [];
            let rules = this.holidayData[region] || [];
            // Combine specific regional rules with base language rules (e.g., de-BY + de)
            let baseRules = this.holidayData[region.split('-')[0]] || [];
            let allRules = rules.concat(baseRules);
            for (let rule of allRules) {
                if (this.isHolidayMatch(rule, date)) {
                    dayHolidays.push(rule.n);
                }
            }
            /**
             * REMOVE DUPLICATES:
             * Using a Set ensures that if a holiday (like "New Year") is defined in
             * both the base and regional rules, it only appears once in the UI.
             */
            return [...new Set(dayHolidays)];
        }
        /**
         * Internal matching logic for different holiday types.
         */
        isHolidayMatch(rule, date) {
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // JS months are 0-indexed
            const day = date.getDate();
            // Check if there is a year-based condition (e.g., historical changes)
            if (rule.c && !this.checkCondition(rule.c, year)) {
                return false;
            }
            // Fixed date holiday (e.g., Christmas)
            if (rule.k === 'f') {
                return rule.m === month && rule.d === day;
            }
            // Easter-based holiday (e.g., Pentecost)
            if (rule.k === 'e') {
                let easter = this.getEaster(year);
                let target = new Date(easter);
                target.setDate(easter.getDate() + (rule.o || 0));
                return target.getMonth() + 1 === month && target.getDate() === day;
            }
            return false;
        }
        /**
         * Parses simple condition strings like "year<=1994".
         */
        checkCondition(cond, year) {
            const match = cond.match(/year([<>=!]+)(\d+)/);
            if (!match || !match[1] || !match[2])
                return true;
            const operator = match[1];
            const val = parseInt(match[2]);
            switch (operator) {
                case "<=": return year <= val;
                case ">=": return year >= val;
                case "==": return year === val;
                case "<": return year < val;
                case ">": return year > val;
                default: return true;
            }
        }
        /**
         * Calculates Easter Sunday using Meeus/Jones/Butcher algorithm (Gauss-based).
         */
        getEaster(year) {
            let a = year % 19;
            let b = Math.floor(year / 100);
            let c = year % 100;
            let d = Math.floor(b / 4);
            let e = b % 4;
            let f = Math.floor((b + 8) / 25);
            let g = Math.floor((b - f + 1) / 3);
            let h = (19 * a + b - d - g + 15) % 30;
            let i = Math.floor(c / 4);
            let k = c % 4;
            let l = (32 + 2 * e + 2 * i - h - k) % 7;
            let m = Math.floor((a + 11 * h + 22 * l) / 451);
            let n = h + l - 7 * m + 114;
            let month = Math.floor(n / 31);
            let day = (n % 31) + 1;
            return new Date(year, month - 1, day);
        }
    }
    exports.CalendarLogic = CalendarLogic;
    /**
     * HYBRID EXPORT
     * -------------
     * 1. For 'AMD' mode: We use the 'exports' object.
     * 2. For 'None' mode: We assign to 'global' to make it available
     * across the concatenated outFile (applet.js).
     */
    if (typeof exports !== 'undefined') {
        exports.CalendarLogic = CalendarLogic;
    }
    global.CalendarLogic = CalendarLogic;
});
/**
 * Project IT Calendar - Main Calendar View Component
 * --------------------------------------------------
 * This class handles the complex grid rendering, user navigation,
 * and event interaction for the Cinnamon Applet.
 * * ARCHITECTURAL DESIGN REWRITE:
 * 1. INSTANCE-BASED LOGIC:
 * Switched from static 'KalenderLogik' to instance-based 'CalendarLogic'.
 * This allows the logic component to maintain state (like loaded holiday JSONs)
 * and access the specific applet directory via its constructor.
 * * 2. COMPLIANCE WITH UNIFIED NAMING:
 * Refactored all references to use 'CalendarLogic' to match EventManager
 * and EventListView, ensuring a professional, English-only codebase.
 * * 3. STATE-DRIVEN UI:
 * The view uses a central .render() method. Any change in state (scrolling,
 * view switching) triggers a redraw.
 * * 4. TODO: ICS IMPORT REFACTORING:
 * !!! WARNING: The current ICS import trigger in YearView is a placeholder.
 * The integration with EventManager for local file parsing is NOT yet
 * fully implemented and requires a FileChooserDialog implementation.
 * * @author Arnold Schiller
 * @link https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */
define("CalendarView", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CalendarView = void 0;
    const { St, Clutter, Gio } = imports.gi;
    const { fileUtils: FileUtils } = imports.misc;
    const Gettext = imports.gettext;
    const Tooltips = imports.ui.tooltips;
    /* === Dynamic Environment Detection === */
    const UUID = typeof __meta !== "undefined" ? __meta.uuid : "calendar@projektit.de";
    const AppletDir = typeof __meta !== "undefined" ? __meta.path : imports.ui.appletManager.appletMeta[UUID].path;
    Gettext.bindtextdomain(UUID, AppletDir + "/locale");
    function _(str) {
        let custom = Gettext.dgettext(UUID, str);
        if (custom !== str)
            return custom;
        let cinnamon = Gettext.dgettext("cinnamon", str);
        if (cinnamon !== str)
            return cinnamon;
        return Gettext.dgettext("gnome-calendar", str);
    }
    class CalendarView {
        constructor(applet, uuid = "calendar@projektit.de") {
            this.currentView = "MONTH";
            this.selectedDay = null;
            this.LOCALE = undefined;
            this.applet = applet;
            this._uuid = uuid;
            const today = new Date();
            this.displayedYear = today.getFullYear();
            this.displayedMonth = today.getMonth();
            this.actor = new St.BoxLayout({
                vertical: true,
                style_class: "calendar-main-box",
                reactive: true,
                can_focus: true,
                track_hover: true
            });
            this.actor.set_clip_to_allocation(false);
            // Scroll Handling: UP/DOWN for month navigation
            this.actor.connect("scroll-event", (_, event) => {
                const dir = event.get_scroll_direction();
                if (dir === Clutter.ScrollDirection.UP)
                    this.scrollMonth(-1);
                if (dir === Clutter.ScrollDirection.DOWN)
                    this.scrollMonth(1);
                return Clutter.EVENT_STOP;
            });
            // Keyboard Navigation (Arrows)
            this.actor.connect("key-press-event", (_, event) => {
                const sym = event.get_key_symbol();
                switch (sym) {
                    case Clutter.KEY_Left:
                        this.scrollMonth(-1);
                        return Clutter.EVENT_STOP;
                    case Clutter.KEY_Right:
                        this.scrollMonth(1);
                        return Clutter.EVENT_STOP;
                    case Clutter.KEY_Up:
                        this.scrollYear(-1);
                        return Clutter.EVENT_STOP;
                    case Clutter.KEY_Down:
                        this.scrollYear(1);
                        return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            this.navBox = new St.BoxLayout({ style_class: "calendar-nav-box" });
            this.contentBox = new St.BoxLayout({ vertical: true });
            this.actor.add_actor(this.navBox);
            this.actor.add_actor(this.contentBox);
            this.render();
        }
        /**
         * Resets the view to the current system date.
         * Called by the "Home" button in applet.ts header.
         */
        resetToToday() {
            const today = new Date();
            this.displayedYear = today.getFullYear();
            this.displayedMonth = today.getMonth();
            this.currentView = "MONTH";
            this.render();
        }
        /**
         * Holiday Helper: Interfaces with the new CalendarLogic instance.
         * Used by applet.ts to display holiday names in the main header.
         */
        getHolidayForDate(date) {
            if (!this.applet.CalendarLogic)
                return null;
            // Defaulting to "de" for now, ideally fetched from system locale or settings
            const holidays = this.applet.CalendarLogic.getHolidaysForDate(date, "de");
            return holidays.length > 0 ? { beschreibung: holidays.join(", ") } : null;
        }
        renderNav() {
            this.navBox.destroy_children();
            const navContainer = new St.BoxLayout({
                style_class: "calendar-nav-box",
                x_align: St.Align.MIDDLE
            });
            // Month Selector
            const monthBox = new St.BoxLayout({ style: "margin: 0 10px;" });
            const btnPrevM = new St.Button({ label: "‹", style_class: "calendar-change-month-back" });
            btnPrevM.connect("clicked", () => this.scrollMonth(-1));
            const monthLabel = new St.Label({
                text: new Date(this.displayedYear, this.displayedMonth).toLocaleString(this.LOCALE, { month: "long" }),
                style_class: "calendar-month-label",
                style: "min-width: 100px; text-align: center;"
            });
            const btnNextM = new St.Button({ label: "›", style_class: "calendar-change-month-forward" });
            btnNextM.connect("clicked", () => this.scrollMonth(1));
            monthBox.add_actor(btnPrevM);
            monthBox.add_actor(monthLabel);
            monthBox.add_actor(btnNextM);
            // Year Selector
            const yearBox = new St.BoxLayout({ style: "margin: 0 10px; margin-left: 20px;" });
            const btnPrevY = new St.Button({ label: "‹", style_class: "calendar-change-month-back" });
            btnPrevY.connect("clicked", () => this.scrollYear(-1));
            const yearBtn = new St.Button({
                label: this.displayedYear.toString(),
                style_class: "calendar-month-label",
                reactive: true
            });
            yearBtn.connect("clicked", () => {
                this.currentView = "YEAR";
                this.render();
            });
            const btnNextY = new St.Button({ label: "›", style_class: "calendar-change-month-forward" });
            btnNextY.connect("clicked", () => this.scrollYear(1));
            yearBox.add_actor(btnPrevY);
            yearBox.add_actor(yearBtn);
            yearBox.add_actor(btnNextY);
            navContainer.add_actor(monthBox);
            navContainer.add_actor(yearBox);
            this.navBox.add_actor(navContainer);
        }
        scrollYear(delta) {
            this.displayedYear += delta;
            this.render();
        }
        scrollMonth(delta) {
            const d = new Date(this.displayedYear, this.displayedMonth + delta, 1);
            this.displayedYear = d.getFullYear();
            this.displayedMonth = d.getMonth();
            this.render();
        }
        render() {
            this.renderNav();
            this.contentBox.destroy_children();
            // LOGIC UPDATE: We no longer fetch monthDays via a static call.
            // Instead, we query this.applet.CalendarLogic per day in the loop.
            switch (this.currentView) {
                case "DAY":
                    this.renderDayView();
                    break;
                case "YEAR":
                    this.renderYearView();
                    break;
                default:
                    this.renderMonthView();
                    break;
            }
            const footer = new St.BoxLayout({ style_class: "calendar-footer" });
            this.contentBox.add_actor(footer);
        }
        renderMonthView() {
            const grid = new St.Table({ homogeneous: true, style_class: "calendar" });
            const colOffset = this.applet.showWeekNumbers ? 1 : 0;
            this.getDayNames().forEach((name, i) => {
                grid.add(new St.Label({ text: name, style_class: "calendar-day-base" }), { row: 0, col: i + colOffset });
            });
            let iter = new Date(this.displayedYear, this.displayedMonth, 1);
            const firstWeekday = (iter.getDay() + 6) % 7;
            iter.setDate(iter.getDate() - firstWeekday);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            for (let row = 1; row <= 6; row++) {
                if (this.applet.showWeekNumbers) {
                    const kwDate = new Date(iter);
                    kwDate.setDate(kwDate.getDate() + 3);
                    grid.add(new St.Label({
                        text: this.getWeekNumber(kwDate).toString(),
                        style_class: "calendar-week-number"
                    }), { row, col: 0 });
                }
                for (let col = 0; col < 7; col++) {
                    const isOtherMonth = iter.getMonth() !== this.displayedMonth;
                    const isToday = iter.getTime() === today.getTime();
                    // Fetch data from modular managers
                    const hasEvents = !isOtherMonth && this.applet.eventManager.hasEvents(iter);
                    const holidays = (!isOtherMonth && this.applet.CalendarLogic) ?
                        this.applet.CalendarLogic.getHolidaysForDate(iter, "de") : [];
                    const isHoliday = holidays.length > 0;
                    const btnClasses = ["calendar-day"];
                    if (isOtherMonth)
                        btnClasses.push("calendar-other-month-day");
                    if (isToday)
                        btnClasses.push("calendar-today");
                    // Highlight Sundays and Holidays in red (via calendar-nonwork-day CSS)
                    if (iter.getDay() === 0 || isHoliday)
                        btnClasses.push("calendar-nonwork-day");
                    const btn = new St.Button({
                        reactive: true,
                        can_focus: true,
                        style_class: btnClasses.join(" ")
                    });
                    const content = new St.BoxLayout({ vertical: true, x_align: St.Align.MIDDLE });
                    content.add_actor(new St.Label({ text: iter.getDate().toString(), style_class: "calendar-day-label" }));
                    // Event Indicator
                    content.add_actor(new St.Label({
                        text: hasEvents ? "•" : " ",
                        style_class: "calendar-day-event-dot-label"
                    }));
                    btn.set_child(content);
                    // Tooltip construction (Combining Holidays and Events)
                    if (Tooltips.Tooltip) {
                        let tooltipLines = [];
                        holidays.forEach((h) => tooltipLines.push(h));
                        if (hasEvents) {
                            const events = this.applet.eventManager.getEventsForDate(iter);
                            events.forEach((e) => tooltipLines.push(`• ${e.summary}`));
                        }
                        if (tooltipLines.length > 0) {
                            new Tooltips.Tooltip(btn, tooltipLines.join("\n"));
                        }
                    }
                    const d = iter.getDate(), m = iter.getMonth(), y = iter.getFullYear();
                    btn.connect("clicked", () => {
                        this.selectedDay = d;
                        this.displayedMonth = m;
                        this.displayedYear = y;
                        this.currentView = "DAY";
                        this.render();
                    });
                    grid.add(btn, { row, col: col + colOffset });
                    iter.setDate(iter.getDate() + 1);
                }
            }
            this.contentBox.add_actor(grid);
        }
        renderYearView() {
            const yearBox = new St.BoxLayout({ vertical: true, style_class: "year-view-container" });
            /**
             * TODO: ICS IMPORT SYSTEM
             * The following button triggers 'onImportRequested'.
             * Currently, this only serves as a hook for future file-dialog implementation.
             * The logic to parse .ics files via GLib is still pending.
             */
            const actionArea = new St.BoxLayout({ x_align: St.Align.MIDDLE, style: "padding: 10px;" });
            const importBtn = new St.Button({ label: _("Import a Calendar"), style_class: "calendar-event-button" });
            importBtn.connect("clicked", () => {
                global.log("[CalendarView] ICS Import requested - TODO: Implement FileChooser");
                this.onImportRequested?.();
            });
            actionArea.add_actor(importBtn);
            yearBox.add_actor(actionArea);
            const grid = new St.Table({ homogeneous: true, style_class: "calendar" });
            for (let m = 0; m < 12; m++) {
                const btn = new St.Button({
                    label: new Date(this.displayedYear, m).toLocaleString(this.LOCALE, { month: 'short' }),
                    style_class: "calendar-month-label"
                });
                btn.connect("clicked", () => {
                    this.displayedMonth = m;
                    this.currentView = "MONTH";
                    this.render();
                });
                grid.add(btn, { row: Math.floor(m / 3), col: m % 3 });
            }
            yearBox.add_actor(grid);
            this.contentBox.add_actor(yearBox);
        }
        renderDayView() {
            const box = new St.BoxLayout({ vertical: true, style_class: "calendar-events-main-box" });
            const selectedDate = new Date(this.displayedYear, this.displayedMonth, this.selectedDay || 1);
            box.add_actor(new St.Label({
                text: selectedDate.toLocaleString(this.LOCALE, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
                style_class: "day-details-title"
            }));
            // Show holidays in day view list
            if (this.applet.CalendarLogic) {
                const holidays = this.applet.CalendarLogic.getHolidaysForDate(selectedDate, "de");
                holidays.forEach((h) => {
                    const hRow = new St.BoxLayout({ style_class: "calendar-event-button", style: "background-color: rgba(255,0,0,0.1);" });
                    hRow.add_actor(new St.Label({ text: h, style_class: "calendar-event-summary" }));
                    box.add_actor(hRow);
                });
            }
            const events = this.applet.eventManager.getEventsForDate(selectedDate);
            if (events.length > 0) {
                events.forEach((ev) => {
                    const row = new St.BoxLayout({ style_class: "calendar-event-button" });
                    row.add_actor(new St.Label({ text: ev.summary, style_class: "calendar-event-summary" }));
                    box.add_actor(row);
                });
            }
            else if (box.get_n_children() === 1) { // Only title present
                box.add_actor(new St.Label({ text: _("No events"), style_class: "calendar-events-no-events-label" }));
            }
            /* label Month view - no Back to Month or something like that because others are not translated */
            const backBtn = new St.Button({ label: _("Month view"), style_class: "nav-button", style: "margin-top: 15px;" });
            backBtn.connect("clicked", () => { this.currentView = "MONTH"; this.render(); });
            box.add_actor(backBtn);
            this.contentBox.add_actor(box);
        }
        /* --- Localization & Date Helpers --- */
        getDayNames() {
            const formatter = new Intl.DateTimeFormat(this.LOCALE, { weekday: 'short' });
            return [1, 2, 3, 4, 5, 6, 7].map(d => formatter.format(new Date(2024, 0, d)));
        }
        getWeekNumber(date) {
            let d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            let yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        }
    }
    exports.CalendarView = CalendarView;
    /**
     * HYBRID EXPORT for Cinnamon environment
     */
    if (typeof exports !== 'undefined') {
        exports.CalendarView = CalendarView;
    }
    global.CalendarView = CalendarView;
});
/**
 * Project IT Calendar - Event List View Component
 * ----------------------------------------------
 * This component handles the rendering of the event list shown next to or
 * below the calendar grid.
 * * * ARCHITECTURAL DESIGN:
 * 1. SEPARATION OF CONCERNS (SoC):
 * This class knows nothing about DBus or ICS parsing. It only receives a Date
 * and an array of EventData objects and renders them using St (Shell Toolkit).
 * * 2. GJS UI INTEGRATION:
 * Uses St.BoxLayout and St.ScrollView for layouts. This ensures the applet
 * remains scrollable even if a day has dozens of entries (e.g., imported ICS).
 * * 3. DYNAMIC RENDERING:
 * The .update() method clears the previous view and rebuilds the UI tree.
 * This is the standard pattern for GJS applets to ensure the UI stays in sync
 * with the underlying data model.
 * * 4. HYBRID MODULE SYSTEM:
 * Like the logic components, this uses 'export' for AMD/IDE support and
 * 'global' assignment for the monolithic 'applet.js' bundle.
 */
define("EventListView", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EventListView = void 0;
    /* === GJS Imports - Shell Toolkit and Clutter for UI === */
    const { St, Clutter } = imports.gi;
    class EventListView {
        constructor() {
            // Main layout: vertical box containing the header and the scrollable list
            this.actor = new St.BoxLayout({
                style_class: "calendar-events-main-box",
                vertical: true,
                x_expand: true
            });
            // Header Label: Shows "Monday, January 1, 2026" etc.
            this._selectedDateLabel = new St.Label({
                style_class: "calendar-events-date-label"
            });
            this.actor.add_actor(this._selectedDateLabel);
            /**
             * ScrollView: Essential for UI usability.
             * Policy 1 (NEVER) for horizontal: We want text to wrap or clip, not scroll sideways.
             * Policy 2 (AUTOMATIC) for vertical: Shows scrollbar only if content exceeds height.
             */
            let scrollBox = new St.ScrollView({
                style_class: 'calendar-events-scrollbox vfade',
                hscrollbar_policy: 1,
                vscrollbar_policy: 2
            });
            // Internal box for the actual event entries
            this._eventsBox = new St.BoxLayout({
                style_class: 'calendar-events-event-container',
                vertical: true
            });
            scrollBox.add_actor(this._eventsBox);
            this.actor.add_actor(scrollBox);
        }
        /**
         * Refreshes the view with new data.
         * @param date - The date to display in the header.
         * @param events - Array of event objects (id, summary, color, etc.).
         */
        update(date, events) {
            /**
             * Localization: Using 'undefined' as the first argument defaults to
             * the user's system locale. This makes the applet instantly
             * internationalized without extra configuration.
             */
            this._selectedDateLabel.set_text(date.toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            }));
            // Clean up the previous UI state to prevent memory leaks and visual overlapping
            this._eventsBox.destroy_children();
            if (!events || events.length === 0) {
                this._showNoEvents();
                return;
            }
            // Create a row for each event
            events.forEach((ev) => this._addEventRow(ev));
        }
        /**
         * Renders a placeholder state when no events are present.
         * Improves User Experience (UX) by providing visual feedback.
         */
        _showNoEvents() {
            let box = new St.BoxLayout({
                style_class: "calendar-events-no-events-box",
                vertical: true,
                x_align: 2 // Clutter.ActorAlign.CENTER
            });
            box.add_actor(new St.Icon({
                icon_name: 'office-calendar',
                icon_size: 48
            }));
            box.add_actor(new St.Label({
                text: "No Events", // Future: Wrap in _() for gettext translation
                style_class: "calendar-events-no-events-label"
            }));
            this._eventsBox.add_actor(box);
        }
        /**
         * Creates a stylized row for a single event.
         * Logic: A colored strip on the left, followed by summary and description.
         */
        _addEventRow(ev) {
            let row = new St.BoxLayout({
                style_class: "calendar-event-button",
                reactive: true // Makes the row hoverable/clickable
            });
            // Visual indicator: Color strip matching the source calendar color
            let colorStrip = new St.Bin({
                style_class: "calendar-event-color-strip",
                style: `background-color: ${ev.color || '#3498db'}; width: 4px;`
            });
            row.add_actor(colorStrip);
            let contentVBox = new St.BoxLayout({
                style_class: "calendar-event-row-content",
                vertical: true,
                x_expand: true
            });
            // Event Title
            contentVBox.add_actor(new St.Label({
                text: ev.summary || "Unnamed Event",
                style_class: "calendar-event-summary"
            }));
            // Optional: Sub-text (e.g., location or description)
            if (ev.description) {
                contentVBox.add_actor(new St.Label({
                    text: ev.description,
                    style_class: "calendar-event-time-future"
                }));
            }
            row.add_actor(contentVBox);
            this._eventsBox.add_actor(row);
        }
    }
    exports.EventListView = EventListView;
    /**
     * HYBRID EXPORT SYSTEM
     * --------------------
     * Ensures compatibility between Cinnamon's internal module loader (AMD)
     * and the 'module: None' bundling approach used for the final applet.js.
     */
    if (typeof exports !== 'undefined') {
        exports.EventListView = EventListView;
    }
    global.EventListView = EventListView;
});
/**
 * Project IT Calendar - Event Manager Component
 * --------------------------------------------
 * Handles synchronization with the system calendar server (Cinnamon.CalendarServer)
 * and provides ICS file import capabilities.
 * * * ARCHITECTURAL DESIGN:
 * 1. HYBRID MODULE SYSTEM:
 * Uses 'export' for IDE/AMD support and 'global' assignment for monolithic
 * bundling. This ensures compatibility with both 'module: None' and 'module: AMD'.
 * * 2. GJS SIGNALS INTEGRATION:
 * Uses 'imports.signals' to add event-emitter capabilities. This allows the
 * View to react to 'events-updated' signals without tight coupling.
 * * 3. ASYNCHRONOUS DBUS COMMUNICATION:
 * Communicates with 'org.cinnamon.CalendarServer' via DBus. All calls are
 * handled asynchronously to keep the UI responsive.
 * * 4. MODERN GJS STANDARDS:
 * Uses TextDecoder or .toString() for data conversion instead of legacy
 * byte-array wrappers where possible.
 */
define("EventManager", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EventManager = void 0;
    // GJS Imports - Accessing native system APIs
    const Gio = imports.gi.Gio;
    const Cinnamon = imports.gi.Cinnamon;
    const GLib = imports.gi.GLib;
    const Signals = imports.signals;
    const Mainloop = imports.mainloop;
    class EventManager {
        /**
         * @param uuid - The unique identifier of the applet for logging purposes.
         */
        constructor(uuid = "EventManager@default") {
            this._server = null;
            this._events = [];
            this._isReady = false;
            this._uuid = uuid;
            this._selectedDate = new Date();
            this._loadInitialData();
            this._initProxy();
            // Refresh loop: Synchronize with system calendar every 60 seconds
            Mainloop.timeout_add_seconds(60, () => {
                this.refresh();
                return true; // Keep the timer running
            });
        }
        /**
         * Loads placeholder data during startup to ensure the UI is never empty.
         */
        _loadInitialData() {
            const today = new Date();
            this._events = [
                {
                    id: "init-state",
                    date: today,
                    summary: "Calendar Manager Active",
                    description: "Synchronizing with system calendar...",
                    color: "#3498db",
                    isFullDay: false
                }
            ];
        }
        /**
         * Initializes the DBus Proxy for Cinnamon's Calendar Server.
         * This is the bridge to GNOME Evolution / Google Calendar / Local calendars.
         */
        _initProxy() {
            Cinnamon.CalendarServerProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, "org.cinnamon.CalendarServer", "/org/cinnamon/CalendarServer", null, (obj, res) => {
                try {
                    this._server = Cinnamon.CalendarServerProxy.new_for_bus_finish(res);
                    // Listen for server-side updates (e.g., user adds event in Evolution)
                    this._server.connect('events-added-or-updated', this._onEventsChanged.bind(this));
                    this._server.connect('events-removed', this._onEventsChanged.bind(this));
                    this._isReady = true;
                    this.emit('manager-ready');
                    // Initial fetch for the current month view
                    this.refresh();
                }
                catch (e) {
                    if (typeof global !== 'undefined') {
                        global.logError(`${this._uuid}: DBus Connection Error: ${e}`);
                    }
                }
            });
        }
        selectDate(date) {
            this._selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        }
        getEventsForSelectedDate() {
            return this.getEventsForDate(this._selectedDate);
        }
        hasEvents(date) {
            return this.getEventsForDate(date).length > 0;
        }
        /**
         * Fetches events for a specific Unix timestamp range from the server.
         */
        fetchRange(start, end) {
            if (!this._server)
                return;
            let startUnix = Math.floor(start.getTime() / 1000);
            let endUnix = Math.floor(end.getTime() / 1000);
            // Tell the server which time window we are interested in
            this._server.call_set_time_range(startUnix, endUnix, true, null, (server, res) => {
                try {
                    this._server.call_set_time_range_finish(res);
                }
                catch (e) {
                    // Ignore finish errors if the applet is closing
                }
            });
        }
        /**
         * Refreshes the event cache by requesting data for a 9-month window.
         */
        refresh() {
            if (!this._server)
                return;
            const now = new Date();
            // Window: 2 months back, 7 months ahead
            const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 7, 0);
            this.fetchRange(start, end);
        }
        /**
         * Callback triggered by DBus when the calendar server emits new data.
         */
        _onEventsChanged(server, varray) {
            const rawEvents = varray.unpack();
            this._events = rawEvents.map((e) => {
                const [id, color, summary, allDay, start, end] = e.deep_unpack();
                return {
                    id: id,
                    summary: summary,
                    color: color,
                    date: new Date(start * 1000),
                    isFullDay: allDay
                };
            });
            // Notify the UI to re-render
            this.emit('events-updated');
        }
        /**
         * Filters cached events by a specific calendar day.
         */
        getEventsForDate(date) {
            return this._events.filter(e => e.date.getDate() === date.getDate() &&
                e.date.getMonth() === date.getMonth() &&
                e.date.getFullYear() === date.getFullYear());
        }
        /**
         * ICS IMPORT LOGIC
         * Parses a local .ics file and pushes events to the system calendar via DBus.
         */
        async importICSFile(icsPath, color = "#ff6b6b") {
            if (!this._server) {
                global.logError(this._uuid + ": CalendarServer not ready for ICS-Import");
                return;
            }
            try {
                const file = Gio.File.new_for_path(icsPath);
                const [ok, contents] = await new Promise(resolve => {
                    file.load_contents_async(null, (f, res) => {
                        try {
                            const [success, data] = f.load_contents_finish(res);
                            resolve([success, data]);
                        }
                        catch (e) {
                            resolve([false, new Uint8Array()]);
                        }
                    });
                });
                if (!ok)
                    throw new Error("Can't read ICS file.");
                // Convert Uint8Array to string (Standard GJS/Cinnamon way)
                const icsText = contents.toString();
                // Simple Regex based VEVENT extraction
                const veventMatches = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
                if (!veventMatches)
                    return;
                let importedCount = 0;
                for (const veventBlock of veventMatches) {
                    try {
                        const summary = (veventBlock.match(/SUMMARY:(.*)/i)?.[1] || 'Unnamed').trim();
                        const dtstartMatch = veventBlock.match(/DTSTART(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                        const dtendMatch = veventBlock.match(/DTEND(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                        if (!dtstartMatch)
                            continue;
                        const startStr = dtstartMatch[1].trim();
                        const endStr = dtendMatch ? dtendMatch[1].trim() : startStr;
                        const start = this._parseICSDate(startStr);
                        const end = this._parseICSDate(endStr);
                        const allDay = startStr.length === 8;
                        // Generate a unique ID using monotonic time
                        const eventId = `ics_${GLib.get_monotonic_time().toString(16)}_${importedCount++}`;
                        const startUnix = Math.floor(start.getTime() / 1000);
                        const endUnix = Math.floor(end.getTime() / 1000);
                        // Push to the actual system calendar server
                        this._server.call_add_event(eventId, color, summary, allDay, startUnix, endUnix, null, (server, res) => {
                            try {
                                server.call_add_event_finish(res);
                                global.log(this._uuid + `: "${summary}" imported successfully`);
                            }
                            catch (e) {
                                global.logError(this._uuid + `: Event import failed: ${e}`);
                            }
                        });
                    }
                    catch (e) {
                        global.logError(this._uuid + ": VEVENT parsing error: " + e);
                    }
                }
                global.log(this._uuid + `: ${importedCount} Events imported from ${icsPath}`);
            }
            catch (e) {
                global.logError(this._uuid + `: ICS Import Error ${icsPath}: ${e}`);
            }
        }
        /**
         * Parses ICS Date strings (YYYYMMDD or YYYYMMDDTHHMMSS[Z])
         */
        _parseICSDate(icsDate) {
            if (icsDate.length === 8) {
                // Format: YYYYMMDD
                return new Date(parseInt(icsDate.substr(0, 4)), parseInt(icsDate.substr(4, 2)) - 1, // Month is 0-indexed
                parseInt(icsDate.substr(6, 2)));
            }
            // Format with time: YYYYMMDDTHHMMSS
            return new Date(icsDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/, '$1-$2-$3T$4:$5:$6$7'));
        }
    }
    exports.EventManager = EventManager;
    /**
     * GJS SIGNAL MIXIN
     * This injects the Signal emitter methods into the EventManager prototype.
     * Essential for the 'events-updated' notification system.
     */
    Signals.addSignalMethods(EventManager.prototype);
    /**
     * HYBRID EXPORT
     * 1. For AMD (Development/Modular mode)
     * 2. For Global (Bundled/Production mode)
     */
    if (typeof exports !== 'undefined') {
        exports.EventManager = EventManager;
    }
    global.EventManager = EventManager;
});
/**
 * Universal Calendar Applet Core
 * ------------------------------
 * This is the entry point for the Cinnamon Applet. It acts as the Controller
 * in an MVC-like architecture, connecting the Cinnamon Panel with the
 * underlying Logic and UI components.
 * * * ARCHITECTURE OVERVIEW:
 * 1. EventManager: Handles data fetching (ICS/Evolution/System).
 * 2. CalendarLogic: Pure JS logic for date calculations and holiday parsing.
 * 3. CalendarView: The complex St.Table based UI grid.
 * 4. EventListView: Specialized view for displaying event details.
 * * * SYSTEM INTEGRATION:
 * - Uses 'Settings' for user-defined date formats and behavior.
 * - Uses 'AppletPopupMenu' to host the calendar UI.
 * - Uses 'KeybindingManager' for global hotkey support.
 * * @author Arnold Schiller <calendar@projektit.de>
 * @link https://github.com/ArnoldSchiller/calendar
 * @link https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */
define("applet", ["require", "exports", "EventManager", "EventListView", "CalendarLogic"], function (require, exports, EventManager_1, EventListView_1, CalendarLogic_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /* === GJS / Cinnamon Imports === */
    const GLib = imports.gi.GLib;
    const St = imports.gi.St;
    const Applet = imports.ui.applet;
    const PopupMenu = imports.ui.popupMenu;
    const Settings = imports.ui.settings;
    const Main = imports.ui.main;
    const Util = imports.misc.util;
    const FileUtils = imports.misc.fileUtils;
    const Gettext = imports.gettext;
    /**
     * Global Localization helper.
     * Initialized in setupLocalization() to support multiple applet instances.
     */
    let _;
    /**
     * Setup internationalization for the applet.
     * It establishes a priority chain for translations to minimize missing strings:
     * Priority: 1. Applet Context, 2. Cinnamon Core, 3. Gnome Calendar
     */
    function setupLocalization(uuid, path) {
        Gettext.bindtextdomain(uuid, path + "/locale");
        _ = function (str) {
            let custom = Gettext.dgettext(uuid, str);
            if (custom !== str)
                return custom;
            let cinnamon = Gettext.dgettext("cinnamon", str);
            if (cinnamon !== str)
                return cinnamon;
            return Gettext.dgettext("gnome-calendar", str);
        };
    }
    class UniversalCalendarApplet extends Applet.TextIconApplet {
        constructor(metadata, orientation, panel_height, instance_id) {
            super(orientation, panel_height, instance_id);
            this._updateId = 0;
            // Bound Settings
            this.showIcon = false;
            this.showEvents = true;
            this.showWeekNumbers = false;
            this.useCustomFormat = false;
            this.customFormat = "";
            this.customTooltipFormat = "";
            this.keyOpen = "";
            this.uuid = metadata.uuid;
            setupLocalization(this.uuid, metadata.path);
            try {
                // 1. Backend Initialization
                this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
                this.menuManager = new PopupMenu.PopupMenuManager(this);
                this.eventManager = new EventManager_1.EventManager();
                this.eventListView = new EventListView_1.EventListView();
                // CalendarLogic Instance (path is needed for /holidays/*.json)
                this.CalendarLogic = new CalendarLogic_1.CalendarLogic(metadata.path);
                // 2. Dynamic Component Loading
                // Using requireModule for the View allows for a decoupled UI layer
                const CalendarModule = FileUtils.requireModule(metadata.path + '/CalendarView');
                // 3. Settings Binding
                this.settings.bind("show-icon", "showIcon", this.on_settings_changed);
                this.settings.bind("show-events", "showEvents", this.on_settings_changed);
                this.settings.bind("show-week-numbers", "showWeekNumbers", this.on_settings_changed);
                this.settings.bind("use-custom-format", "useCustomFormat", this.on_settings_changed);
                this.settings.bind("custom-format", "customFormat", this.on_settings_changed);
                this.settings.bind("custom-tooltip-format", "customTooltipFormat", this.on_settings_changed);
                this.settings.bind("keyOpen", "keyOpen", this.on_hotkey_changed);
                // 4. Popup Menu Construction
                this.menu = new Applet.AppletPopupMenu(this, orientation);
                this.menuManager.addMenu(this.menu);
                // Main UI container with vertical layout
                this._mainBox = new St.BoxLayout({
                    vertical: true,
                    style_class: 'calendar-main-box'
                });
                /**
                 * Header Box: Displays current day/date.
                 * Acts as a "Home" button to return to today's date in the grid.
                 */
                let headerBox = new St.BoxLayout({
                    vertical: true,
                    style_class: 'calendar-today-home-button',
                    reactive: true
                });
                headerBox.connect("button-release-event", () => {
                    this.CalendarView.resetToToday();
                    this.setHeaderDate(new Date());
                });
                this._dayLabel = new St.Label({ style_class: 'calendar-today-day' });
                this._dateLabel = new St.Label({ style_class: 'calendar-today-date' });
                this._holidayLabel = new St.Label({ style_class: 'calendar-today-holiday' });
                headerBox.add_actor(this._dayLabel);
                headerBox.add_actor(this._dateLabel);
                headerBox.add_actor(this._holidayLabel);
                this._mainBox.add_actor(headerBox);
                // 5. Calendar Grid Initialization
                this.CalendarView = new CalendarModule.CalendarView(this);
                this._mainBox.add_actor(this.CalendarView.actor);
                /**
                 * Footer Section:
                 * Provides quick access to system-wide date settings and external calendar apps.
                 */
                let footerBox = new St.BoxLayout({ style_class: 'calendar-footer' });
                let settingsBtn = new St.Button({
                    label: _("Date and Time Settings"),
                    style_class: 'calendar-footer-button',
                    x_expand: true
                });
                settingsBtn.connect("clicked", () => {
                    this.menu.close();
                    Util.spawnCommandLine("cinnamon-settings calendar");
                });
                let calendarBtn = new St.Button({
                    label: _("Manage Calendars"),
                    style_class: 'calendar-footer-button',
                    x_expand: true
                });
                calendarBtn.connect("clicked", () => {
                    this.menu.close();
                    Util.spawnCommandLine("gnome-calendar");
                });
                footerBox.add_actor(settingsBtn);
                footerBox.add_actor(calendarBtn);
                this._mainBox.add_actor(footerBox);
                this.menu.addActor(this._mainBox);
                // 6. Signal Handling & Lifecycle
                this.on_settings_changed();
                this.on_hotkey_changed();
                this.menu.connect("open-state-changed", (menu, isOpen) => {
                    if (isOpen) {
                        this.CalendarView.render();
                        this.setHeaderDate(new Date());
                        // Deferred focus handling to ensure UI is fully mapped before grabbing focus
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                            this.CalendarView.actor.grab_key_focus();
                            return false;
                        });
                    }
                });
                // Periodic refresh of panel clock and tooltip (every 10 seconds)
                this.update_label_and_tooltip();
                this._updateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
                    this.update_label_and_tooltip();
                    return true;
                });
            }
            catch (e) {
                global.log(`[${this.uuid}] CRITICAL: Initialization failed: ${e}`);
            }
        }
        /**
         * Unified handler for settings changes.
         * Manages Icon visibility and UI re-rendering.
         */
        on_settings_changed() {
            // Toggle Panel Icon visibility
            if (this.showIcon) {
                this.set_applet_icon_name("office-calendar");
                if (this._applet_icon_box)
                    this._applet_icon_box.show();
            }
            else {
                this._hide_icon();
            }
            this.update_label_and_tooltip();
            // If the menu is open, we need to re-render to reflect format changes
            if (this.menu && this.menu.isOpen) {
                this.CalendarView.render();
            }
        }
        /**
         * Helper to cleanly remove the icon from the panel.
         * Different Cinnamon versions handle empty icons differently; this ensures it's hidden.
         */
        _hide_icon() {
            this.set_applet_icon_name("");
            if (this._applet_icon_box) {
                this._applet_icon_box.hide();
            }
        }
        /**
         * Triggered when user clicks the panel applet.
         */
        on_applet_clicked(event) {
            if (!this.menu.isOpen) {
                this.eventManager.refresh(); // Sync latest events before opening
            }
            this.menu.toggle();
        }
        /**
         * Updates the global hotkey based on user settings.
         */
        on_hotkey_changed() {
            Main.keybindingManager.removeHotKey(`${this.uuid}-open`);
            if (this.keyOpen) {
                Main.keybindingManager.addHotKey(`${this.uuid}-open`, this.keyOpen, () => {
                    this.on_applet_clicked(null);
                });
            }
        }
        /**
         * Core Panel Logic:
         * Sets the text (Clock) displayed on the Cinnamon panel and its tooltip.
         * Supports both system locale and user-defined custom formats.
         */
        update_label_and_tooltip() {
            const now = new Date();
            const gNow = GLib.DateTime.new_now_local();
            let timeLabel = this.useCustomFormat ? gNow.format(this.customFormat) :
                now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let dateTooltip = this.useCustomFormat ? gNow.format(this.customTooltipFormat) :
                now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            this.set_applet_label(timeLabel || "");
            this.set_applet_tooltip(dateTooltip || "");
        }
        /**
         * Updates the UI Header inside the popup menu.
         * Shows Day, Date, and specific holiday descriptions if available.
         */
        setHeaderDate(date) {
            if (!this._dayLabel)
                return;
            const gDate = GLib.DateTime.new_from_unix_local(date.getTime() / 1000);
            this._dayLabel.set_text(gDate.format("%A"));
            this._dateLabel.set_text(gDate.format("%e. %B %Y"));
            // Ask the view's data provider (CalendarLogic) for holiday info
            const tagInfo = this.CalendarView.getHolidayForDate(date);
            if (tagInfo && tagInfo.beschreibung) {
                this._holidayLabel.set_text(tagInfo.beschreibung);
                this._holidayLabel.show();
            }
            else {
                this._holidayLabel.hide();
            }
        }
        /**
         * Cleanup: Called when applet is removed or Cinnamon restarts.
         * Essential to prevent memory leaks and dangling signals/hotkeys.
         */
        on_applet_removed_from_panel() {
            Main.keybindingManager.removeHotKey(`${this.uuid}-open`);
            if (this._updateId > 0) {
                GLib.source_remove(this._updateId);
            }
            this.menu.destroy();
        }
    }
    /**
     * CINNAMON ENTRY POINT
     * --------------------
     * This function is the primary entry point called by the Cinnamon applet manager.
     */
    function main(metadata, orientation, panel_height, instance_id) {
        try {
            return new UniversalCalendarApplet(metadata, orientation, panel_height, instance_id);
        }
        catch (e) {
            if (typeof global !== 'undefined') {
                global.log(metadata.uuid + " CRITICAL: Initialization error: " + e);
            }
            return null;
        }
    }
    /**
     * EXPORT FOR CINNAMON
     * We bridge the modular code to Cinnamon's global scope.
     * The 'as any' cast is used to prevent TypeScript compiler errors.
     */
    if (typeof global !== 'undefined') {
        // Legacy/Production bridge
        global.main = main;
        // Your specific fallback export
        global.main = main;
        if (typeof Applet !== 'undefined') {
            global.Applet = Applet;
            global.Applet = Applet;
        }
    }
});

/**
 * GLOBAL EXPORTS FOR CINNAMON ENVIRONMENT
 * ---------------------------------------
 * In production mode, we need to export all modules globally so that
 * applet.ts can find them via global.CalendarView, global.CalendarLogic, etc.
 * This is the counterpart to the hybrid export pattern in the source TypeScript.
 */

// Wait for all modules to be loaded, then export them globally
if (typeof global !== 'undefined') {
    // Export CalendarLogic
    if (modules['CalendarLogic'] && modules['CalendarLogic'].CalendarLogic) {
        global.CalendarLogic = modules['CalendarLogic'].CalendarLogic;
    }
    
    // Export CalendarView  
    if (modules['CalendarView'] && modules['CalendarView'].CalendarView) {
        global.CalendarView = modules['CalendarView'].CalendarView;
    }
    
    // Export EventListView
    if (modules['EventListView'] && modules['EventListView'].EventListView) {
        global.EventListView = modules['EventListView'].EventListView;
    }
    
    // Export EventManager
    if (modules['EventManager'] && modules['EventManager'].EventManager) {
        global.EventManager = modules['EventManager'].EventManager;
    }
    
    // Also make sure the main applet module is globally accessible
    if (modules['applet'] && modules['applet'].main) {
        global.main = modules['applet'].main;
    }
}

/**
 * CINNAMON ENTRY POINT
 * --------------------
 * This function is called by Cinnamon when loading the applet.
 * IMPORTANT: This must be a global function named 'main'.
 */
function main(metadata, orientation, panel_height, instance_id) {
    // Strategy 1: Use the AMD module if available
    if (modules['applet'] && modules['applet'].main) {
        return modules['applet'].main(metadata, orientation, panel_height, instance_id);
    }
    
    // Strategy 2: Use the global main function (set by applet.ts)
    if (typeof global !== 'undefined' && global.main) {
        return global.main(metadata, orientation, panel_height, instance_id);
    }
    
    // Strategy 3: Last resort - create a basic applet
    if (typeof Applet !== 'undefined') {
        global.logError('[Calendar] Falling back to basic Applet instance');
        return new Applet.TextIconApplet(orientation, panel_height, instance_id);
    }
    
    throw new Error('Calendar applet initialization failed: Could not find main function.');
}
