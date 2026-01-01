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

/* === GJS / Cinnamon Imports === */
declare const imports: any;
declare const global: any;
declare const __meta: any; 

const { St, Clutter, Gio } = imports.gi;
const { fileUtils: FileUtils } = imports.misc;
const Gettext = imports.gettext;
const Tooltips = imports.ui.tooltips;

/* === Dynamic Environment Detection === */
const UUID = typeof __meta !== "undefined" ? __meta.uuid : "calendar@projektit.de";
const AppletDir = typeof __meta !== "undefined" ? __meta.path : imports.ui.appletManager.appletMeta[UUID].path;

Gettext.bindtextdomain(UUID, AppletDir + "/locale");

function _(str: string): string {
    let custom = Gettext.dgettext(UUID, str);
    if (custom !== str) return custom;
    let cinnamon = Gettext.dgettext("cinnamon", str);
    if (cinnamon !== str) return cinnamon;
    return Gettext.dgettext("gnome-calendar", str);
}

export class CalendarView {
    public applet: any;
    public actor: any;             
    private _uuid: string;
    private navBox: any;           
    private contentBox: any;       

    private displayedYear: number;
    private displayedMonth: number;
    private currentView: "MONTH" | "YEAR" | "DAY" = "MONTH";
    private selectedDay: number | null = null;

    private readonly LOCALE = undefined; 

    public onImportRequested?: () => void;

    constructor(applet: any, uuid: string = "calendar@projektit.de") {
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
        this.actor.connect("scroll-event", (_: any, event: any) => {
            const dir = event.get_scroll_direction();
            if (dir === Clutter.ScrollDirection.UP) this.scrollMonth(-1);
            if (dir === Clutter.ScrollDirection.DOWN) this.scrollMonth(1);
            return Clutter.EVENT_STOP;
        });

        // Keyboard Navigation (Arrows)
        this.actor.connect("key-press-event", (_: any, event: any) => {
            const sym = event.get_key_symbol();
            switch (sym) {
                case Clutter.KEY_Left:  this.scrollMonth(-1); return Clutter.EVENT_STOP;
                case Clutter.KEY_Right: this.scrollMonth(1);  return Clutter.EVENT_STOP;
                case Clutter.KEY_Up:    this.scrollYear(-1);  return Clutter.EVENT_STOP;
                case Clutter.KEY_Down:  this.scrollYear(1);   return Clutter.EVENT_STOP;
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
    public resetToToday() {
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
    public getHolidayForDate(date: Date): { beschreibung: string } | null {
        if (!this.applet.CalendarLogic) return null;
        // Defaulting to "de" for now, ideally fetched from system locale or settings
        const holidays = this.applet.CalendarLogic.getHolidaysForDate(date, "de");
        return holidays.length > 0 ? { beschreibung: holidays.join(", ") } : null;
    }

    private renderNav() {
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

    private scrollYear(delta: number) {
        this.displayedYear += delta;
        this.render();
    }

    private scrollMonth(delta: number) {
        const d = new Date(this.displayedYear, this.displayedMonth + delta, 1);
        this.displayedYear = d.getFullYear();
        this.displayedMonth = d.getMonth();
        this.render();
    }

    public render() {
        this.renderNav();
        this.contentBox.destroy_children();

        // LOGIC UPDATE: We no longer fetch monthDays via a static call.
        // Instead, we query this.applet.CalendarLogic per day in the loop.

        switch (this.currentView) {
            case "DAY":  this.renderDayView();   break;
            case "YEAR": this.renderYearView();  break;
            default:     this.renderMonthView(); break;
        }

        const footer = new St.BoxLayout({ style_class: "calendar-footer" });
        this.contentBox.add_actor(footer);
    }

    private renderMonthView() {
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
                const kwDate = new Date(iter); kwDate.setDate(kwDate.getDate() + 3);
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
                if (isOtherMonth) btnClasses.push("calendar-other-month-day");
                if (isToday) btnClasses.push("calendar-today");
                
                // Highlight Sundays and Holidays in red (via calendar-nonwork-day CSS)
                if (iter.getDay() === 0 || isHoliday) btnClasses.push("calendar-nonwork-day");

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
		    let tooltipLines: string[] = [];

                    holidays.forEach((h: string) => tooltipLines.push(h));
                    
                    if (hasEvents) {
                        const events = this.applet.eventManager.getEventsForDate(iter);
                        events.forEach((e: any) => tooltipLines.push(`• ${e.summary}`));
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

    private renderYearView() {
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

    private renderDayView() {
        const box = new St.BoxLayout({ vertical: true, style_class: "calendar-events-main-box" });
        const selectedDate = new Date(this.displayedYear, this.displayedMonth, this.selectedDay || 1);
        
        box.add_actor(new St.Label({
            text: selectedDate.toLocaleString(this.LOCALE, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
            style_class: "day-details-title"
        }));

        // Show holidays in day view list
        if (this.applet.CalendarLogic) {
            const holidays = this.applet.CalendarLogic.getHolidaysForDate(selectedDate, "de");
            holidays.forEach((h: string) => {
                const hRow = new St.BoxLayout({ style_class: "calendar-event-button", style: "background-color: rgba(255,0,0,0.1);" });
                hRow.add_actor(new St.Label({ text: h, style_class: "calendar-event-summary" }));
                box.add_actor(hRow);
            });
        }

        const events = this.applet.eventManager.getEventsForDate(selectedDate);
        if (events.length > 0) {
            events.forEach((ev: any) => {
                const row = new St.BoxLayout({ style_class: "calendar-event-button" });
                row.add_actor(new St.Label({ text: ev.summary, style_class: "calendar-event-summary" }));
                box.add_actor(row);
            });
        } else if (box.get_n_children() === 1) { // Only title present
            box.add_actor(new St.Label({ text: _("No events"), style_class: "calendar-events-no-events-label" }));
        }
        /* label Month view - no Back to Month or something like that because others are not translated */
        const backBtn = new St.Button({ label: _("Month view"), style_class: "nav-button", style: "margin-top: 15px;" });
        backBtn.connect("clicked", () => { this.currentView = "MONTH"; this.render(); });
        box.add_actor(backBtn);

        this.contentBox.add_actor(box);
    }

    /* --- Localization & Date Helpers --- */

    private getDayNames(): string[] {
        const formatter = new Intl.DateTimeFormat(this.LOCALE, { weekday: 'short' });
        return [1, 2, 3, 4, 5, 6, 7].map(d => formatter.format(new Date(2024, 0, d)));
    }

    private getWeekNumber(date: Date): number {
        let d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        let yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }
}

/**
 * HYBRID EXPORT for Cinnamon environment
 */
if (typeof exports !== 'undefined') {
    exports.CalendarView = CalendarView;
}
(global as any).CalendarView = CalendarView;
