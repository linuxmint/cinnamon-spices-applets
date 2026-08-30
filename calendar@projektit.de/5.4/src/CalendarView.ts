/**
 * Project IT Calendar – CalendarView
 * =================================
 *
 * This file implements the main visual calendar component of the applet.
 * It is responsible for rendering and managing all calendar-related UI
 * views (Month, Year, Day) using Cinnamon’s St toolkit.
 *
 * IMPORTANT DOCUMENTATION NOTE
 * ----------------------------
 * This file is intentionally *not* refactored or modified functionally.
 * No logic, structure, or behavior has been changed.
 *
 * The purpose of this pass is **documentation only**:
 * - Translate remaining German comments to English
 * - Add explanatory comments for readers unfamiliar with:
 *   - TypeScript
 *   - GJS (GNOME JavaScript)
 *   - Cinnamon applet development
 * - Preserve commented-out code exactly as-is
 * - Add TODO comments where improvement opportunities are visible
 *
 * This ensures the file doubles as:
 * - Source code
 * - Architectural documentation
 *
 * License is preserved as requested.
 *
 * ------------------------------------------------------------------
 * TARGET AUDIENCE
 * ------------------------------------------------------------------
 * This documentation assumes the reader:
 * - May never have seen TypeScript before
 * - Does not know Cinnamon, GNOME, or GJS
 * - Wants to understand *why* this code exists and how it fits together
 *
 * ------------------------------------------------------------------
 * @author Arnold Schiller
 * @license GPL-3.0-or-later
 */
/**
 * @file CalendarView.ts
 * @brief Main calendar UI component
 * 
 * @details Implements the visual calendar grid with month/year/day views.
 * Uses Cinnamon's St toolkit for rendering and Clutter for input handling.
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2023-2026
 * @copyright GPL-3.0-or-later
 */

/**
 * @class CalendarView
 * @brief State-driven UI component for calendar display
 * 
 * @details This class manages all calendar UI rendering including:
 * - Month grid view with navigation
 * - Year overview
 * - Day detail view
 * - Event highlighting and tooltips
 * 
 * @note Does NOT store event data itself. Relies on EventManager for data
 * and CalendarLogic for date calculations.
 */


/* ================================================================
 * GJS / CINNAMON IMPORTS
 * ================================================================
 *
 * GJS uses a dynamic import system provided by GNOME.
 * `imports.gi` exposes GObject Introspection bindings.
 * `St` is Cinnamon’s UI toolkit (Shell Toolkit).
 */

declare const imports: any;
declare const global: any;
declare const __meta: any;

const { St, Clutter, Gio } = imports.gi;
const { fileUtils: FileUtils } = imports.misc;
const Gettext = imports.gettext;
const Tooltips = imports.ui.tooltips;

/* ================================================================
 * APPLET METADATA RESOLUTION
 * ================================================================
 *
 * Cinnamon applets can run in different environments:
 * - Normal applet runtime
 * - Development / test environment
 *
 * This logic ensures translation and path resolution works in both.
 */

const UUID =
    typeof __meta !== "undefined"
        ? __meta.uuid
        : "calendar@projektit.de";

const AppletDir =
    typeof __meta !== "undefined"
        ? __meta.path
        : imports.ui.appletManager.appletMeta[UUID].path;

Gettext.bindtextdomain(UUID, AppletDir + "/locale");

/**
 * Translation helper.
 *
 * Resolution order:
 * 1. Applet translation domain
 * 2. Cinnamon system translations
 * 3. GNOME Calendar translations (fallback)
 *
 * This allows reuse of existing translations where possible.
 */
function _(str: string): string {
    let translated = Gettext.dgettext(UUID, str);
    if (translated !== str) return translated;

    translated = Gettext.dgettext("cinnamon", str);
    if (translated !== str) return translated;

    return Gettext.dgettext("gnome-calendar", str);
}

/* ================================================================
 * CALENDAR VIEW CLASS
 * ================================================================
 *
 * CalendarView is a *state-driven* UI component.
 *
 * It does NOT store event data itself.
 * It relies on:
 * - EventManager (data source)
 * - CalendarLogic (date / holiday calculations)
 *
 * Any state change triggers a full re-render.
 */

/**
 * @class CalendarView
 * @brief Main calendar view class
 * 
 * @details For detailed documentation see the main class documentation.
 */
/**
 * @class CalendarView
 * @brief Main calendar view class
 * 
 * @details For detailed documentation see the main class documentation.
 */
export class CalendarView {
    public applet: any;
    public actor: any;

    private _uuid: string;
    private navBox: any;
    private contentBox: any;

    /**
     * Currently displayed year/month in the UI.
     * These define the navigation context.
     */
    private displayedYear: number;
    private displayedMonth: number;

    /**
     * Active view mode:
     * - MONTH: default grid view
     * - YEAR: year overview
     * - DAY: single-day detail view
     */
       /**
     * @enum ViewMode
     * @brief Available view modes
     */
    private currentView: "MONTH" | "YEAR" | "DAY" = "MONTH";

    /**
     * Selected day within the current month.
     * `null` means no specific day is selected.
     */
    private selectedDay: number | null = null;

    /**
     * Day view sub-mode.
     * VIEW = read-only
     * ADD  = show add-event form
     * EDIT = show edit-event form
     */
    private dayMode: "VIEW" | "ADD" | "EDIT" = "VIEW";
    private dayModeDate: Date | null = null; 


    /**
     * Event currently being edited (if any).
     */
    private editingEvent: any | null = null;

    /**
     * Locale used for date formatting.
     * Undefined means: use system locale.
     */
    private readonly LOCALE = undefined;

    /**
     * Optional callback triggered from the Year View
     * when the user requests an ICS import.
     *
     * The actual import logic lives elsewhere.
     */
    public onImportRequested?: () => void;

    /**
     * Constructor
     *
     * Creates the root actor, sets up input handlers,
     * initializes state, and performs the first render.
     */
    constructor(applet: any, uuid: string = "calendar@projektit.de") {
        this.applet = applet;
        this._uuid = uuid;

        const today = new Date();
        this.displayedYear = today.getFullYear();
        this.displayedMonth = today.getMonth();

        /* --------------------------------------------------------
         * ROOT ACTOR
         * --------------------------------------------------------
         *
         * St.BoxLayout is a vertical container.
         * This is the main entry point added to the popup menu.
         */

        this.actor = new St.BoxLayout({
            vertical: true,
            style_class: "calendar-main-box",
            reactive: true,
            can_focus: true,
            track_hover: true,
        });

        // Allow children (e.g. tooltips) to overflow their bounds
        this.actor.set_clip_to_allocation(false);

        /* --------------------------------------------------------
         * INPUT HANDLING
         * --------------------------------------------------------
         *
         * Mouse wheel and keyboard navigation are handled here.
         * This keeps navigation logic centralized.
         */

        // Mouse wheel: scroll months
        this.actor.connect("scroll-event", (_: any, event: any) => {
            const dir = event.get_scroll_direction();
            if (dir === Clutter.ScrollDirection.UP) this.scrollMonth(-1);
            if (dir === Clutter.ScrollDirection.DOWN) this.scrollMonth(1);
            return Clutter.EVENT_STOP;
        });

        // Keyboard navigation
        this.actor.connect("key-press-event", (_: any, event: any) => {
            switch (event.get_key_symbol()) {
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

        /* --------------------------------------------------------
         * LAYOUT CONTAINERS
         * --------------------------------------------------------
         *
         * navBox   = month/year navigation
         * contentBox = active view (month/year/day)
         */

        this.navBox = new St.BoxLayout({ style_class: "calendar-nav-box" });
        this.contentBox = new St.BoxLayout({ vertical: true });

        this.actor.add_actor(this.navBox);
        this.actor.add_actor(this.contentBox);

        // Initial render
        this.render();
    }

    /**
     * Reset calendar state to today and switch to month view.
     *
     * Used by external controls (e.g. “Today” button).
     */
    public resetToToday(): void {
        const today = new Date();
        this.displayedYear = today.getFullYear();
        this.displayedMonth = today.getMonth();
        this.currentView = "MONTH";

        const todayEvents = this.applet.eventManager.getEventsForDate(today);
        this.applet.eventListView.updateForDate(today, todayEvents);

        this.render();
    }

    /**
     * Returns the date currently represented by the navigation state.
     *
     * If no specific day is selected, the first day of the month is used.
     */
    public getCurrentlyDisplayedDate(): Date {
        return new Date(
            this.displayedYear,
            this.displayedMonth,
            this.selectedDay || 1
        );
    }

    /**
     * Helper used by the applet to retrieve holiday information.
     *
     * CalendarView itself does not calculate holidays.
     */
    public getHolidayForDate(date: Date): { beschreibung: string } | null {
        if (!this.applet.CalendarLogic) return null;

        const holidays =
            this.applet.CalendarLogic.getHolidaysForDate(date, "de");

        return holidays.length > 0
            ? { beschreibung: holidays.join(", ") }
            : null;
    }

    /* ============================================================
     * NOTE
     * ============================================================
     *
     * The remainder of this file contains:
     * - Navigation rendering
     * - Month / Year / Day view rendering
     * - Event list synchronization
     * - Date helper utilities
     *
     * All logic below is unchanged.
     * Only comments were translated and clarified.
     *
     * TODO (Documentation):
     * - Extract view modes into dedicated sub-classes
     * - Add explicit state diagram to project documentation
     */




    /* ============================================================
     * NAVIGATION BAR – MONTH / YEAR SELECTOR
     * ============================================================
     *
     * This section renders the top navigation bar of the calendar.
     *
     * ────────────────────────────────────────────────────────────
     * CONTEXT / PRECONDITIONS
     * ────────────────────────────────────────────────────────────
     *
     * At this point in execution, the following is already true:
     *
     * 1. This class is a Cinnamon applet view written in TypeScript,
     *    compiled to GJS-compatible JavaScript.
     *
     * 2. `this.navBox` is a St.BoxLayout that already exists and is
     *    dedicated exclusively to holding the navigation bar UI.
     *
     * 3. The following state variables are already initialized and valid:
     *    - this.displayedYear   (number)
     *    - this.displayedMonth  (0–11, JavaScript Date convention)
     *    - this.selectedDay    (number | null)
     *    - this.currentView    ("MONTH" | "DAY" | "YEAR")
     *
     * 4. The following helper methods already exist and work:
     *    - scrollMonth(delta)
     *    - scrollYear(delta)
     *    - render()
     *
     * 5. Cinnamon's St (Shell Toolkit) namespace is available and imported,
     *    providing BoxLayout, Button, Label, alignment constants, etc.
     *
     * The navigation bar itself is stateless UI: it does NOT store state,
     * it only manipulates the existing calendar state and triggers re-rendering.
     *
     * ────────────────────────────────────────────────────────────
     * VISUAL STRUCTURE
     * ────────────────────────────────────────────────────────────
     *
     * [ < ]  [ Month Name ]  [ > ]     [ spacer ]     [ < ] [ Year ] [ > ]
     *
     * - Left side:   Month navigation
     * - Center:      Reserved space (future messages / indicators)
     * - Right side:  Year navigation
     *
     * ────────────────────────────────────────────────────────────
     */

    private renderNav(): void {
        // Remove all previously rendered navigation elements.
        // This ensures a clean rebuild on every render() call.
        this.navBox.destroy_children();

        // Root container for the navigation bar.
        // All sub-components (month, spacer, year) are placed inside.
        const navContainer = new St.BoxLayout({
            style_class: "calendar",
            x_align: St.Align.MIDDLE,
        });

        /* ========================================================
         * MONTH SELECTOR (LEFT SIDE)
         * ========================================================
         *
         * Allows navigating backward / forward by one month.
         * The month name itself is clickable and switches to
         * MONTH view when clicked.
         */

        const monthBox = new St.BoxLayout({ style: "margin-right: 5px;" });

        // Button: previous month
        const btnPrevM = new St.Button({
            label: "‹",
            style_class: "calendar-change-month-back",
        });

        // Decrease month by one and re-render
        btnPrevM.connect("clicked", () => this.scrollMonth(-1));

        // Button displaying the current month name
        const monthBtn = new St.Button({
            label: new Date(
                this.displayedYear,
                this.displayedMonth
            ).toLocaleString(this.LOCALE, { month: "long" }),

            style_class: "calendar-month-label",
            reactive: true,
            x_expand: true,
            x_fill: true,

            // We explicitly force transparency and remove default
            // button padding to visually behave like a label.
            style:
                "padding: 2px 0; " +
                "background-color: transparent; " +
                "border: none; " +
                "min-width: 140px; " +
                "text-align: center;",
        });

        // Clicking the month name switches explicitly to MONTH view.
        // This is useful when coming from DAY or YEAR view.
        monthBtn.connect("clicked", () => {
            this.currentView = "MONTH";
            this.render();
        });

        // Button: next month
        const btnNextM = new St.Button({
            label: "›",
            style_class: "calendar-change-month-forward",
        });

        // Increase month by one and re-render
        btnNextM.connect("clicked", () => this.scrollMonth(1));

        // Assemble month selector
        monthBox.add_actor(btnPrevM);
        monthBox.add_actor(monthBtn);
        monthBox.add_actor(btnNextM);

        /* ========================================================
         * MIDDLE SPACER (CENTER)
         * ========================================================
         *
         * Currently unused.
         * This spacer keeps the layout visually balanced and
         * allows future extensions (messages, sync status, etc.)
         * without redesigning the navigation bar.
         *
         * TODO: Replace with meaningful status indicators
         */

        const middleBox = new St.BoxLayout({
            x_expand: true,
        });

        // Non-breaking spaces used to enforce minimum width.
        const middleLabel = new St.Label({
            text:
                "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0" +
                "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0" +
                "\u00A0\u00A0\u00A0\u00A0",
            style_class: "calendar-month-label",
            style: "min-width: 50px; text-align: center;",
        });

        middleBox.add_actor(middleLabel);

        /* ========================================================
         * YEAR SELECTOR (RIGHT SIDE)
         * ========================================================
         *
         * Allows navigating backward / forward by one year.
         * Clicking the year switches to YEAR overview.
         */

        const yearBox = new St.BoxLayout({
            style: "margin-left: 5px;",
        });

        // Button: previous year
        const btnPrevY = new St.Button({
            label: "‹",
            style_class: "calendar-change-month-back",
        });

        btnPrevY.connect("clicked", () => this.scrollYear(-1));

        // Button displaying the current year
        const yearBtn = new St.Button({
            label: this.displayedYear.toString(),
            style_class: "calendar-month-label",
            x_expand: true,
            reactive: true,
        });

        // Switch to YEAR view
        yearBtn.connect("clicked", () => {
            this.currentView = "YEAR";
            this.render();
        });

        // Button: next year
        const btnNextY = new St.Button({
            label: "›",
            style_class: "calendar-change-month-forward",
        });

        btnNextY.connect("clicked", () => this.scrollYear(1));

        // Assemble year selector
        yearBox.add_actor(btnPrevY);
        yearBox.add_actor(yearBtn);
        yearBox.add_actor(btnNextY);

        // Assemble full navigation bar
        navContainer.add_actor(monthBox);
        navContainer.add_actor(middleBox);
        navContainer.add_actor(yearBox);

        this.navBox.add_actor(navContainer);
    }

    /* ============================================================
     * YEAR / MONTH SCROLL HELPERS
     * ============================================================
     *
     * These helpers modify the calendar's temporal context
     * and immediately trigger a re-render.
     *
     * They also reset selectedDay to avoid invalid state
     * when switching months or years.
     */

    private scrollYear(delta: number): void {
        this.displayedYear += delta;
        this.selectedDay = null;
        this.render();
    }

    private scrollMonth(delta: number): void {
        const d = new Date(
            this.displayedYear,
            this.displayedMonth + delta,
            1
        );

        this.selectedDay = null;
        this.displayedYear = d.getFullYear();
        this.displayedMonth = d.getMonth();
        this.render();
    }

    /* ============================================================
     * EXTERNAL VIEW SYNCHRONIZATION
     * ============================================================
     *
     * Keeps the EventListView (if enabled) in sync with the
     * currently displayed calendar context.
     *
     * This method acts as a bridge between:
     * - CalendarView (date navigation)
     * - EventListView (list-based representation)
     */

    private _updateExternalViews() {
        if (!this.applet.showEvents || !this.applet.eventListView) return;

        const elv = this.applet.eventListView;

        if (this.currentView === "DAY" || this.selectedDay !== null) {
            // A specific day is selected → show day details
            const targetDate = new Date(
                this.displayedYear,
                this.displayedMonth,
                this.selectedDay || 1
            );

            const events =
                this.applet.eventManager.getEventsForDate(targetDate);

            elv.updateForDate(targetDate, events);
        } else {
            // No specific day → show month overview
            const events =
                this.applet.eventManager.getEventsForMonth(
                    this.displayedYear,
                    this.displayedMonth
                );

            elv.updateForMonth(
                this.displayedYear,
                this.displayedMonth,
                events
            );
        }
    }

    /* ============================================================
     * EXTERNAL NAVIGATION ENTRY POINT
     * ============================================================
     *
     * Allows external components (e.g. EventListView)
     * to request navigation to a specific date.
     */

    public jumpToDate(date: Date): void {
        this.displayedYear = date.getFullYear();
        this.displayedMonth = date.getMonth();
        this.selectedDay = date.getDate();
        this.currentView = "DAY";
        this.render();
    }

    /* ============================================================
     * CENTRAL RENDER DISPATCHER
     * ============================================================
     *
     * This is the single entry point for rendering.
     * It rebuilds navigation, content, footer and
     * synchronizes external views.
     */

     /**
     * @brief Renders the complete calendar UI
     *
     * @details This is the central render dispatcher that:
     * 1. Rebuilds navigation bar
     * 2. Renders appropriate view based on currentView
     * 3. Updates external views (EventListView)
     * 4. Adds footer
     *
     * post UI is completely updated to reflect current state
     */
    public render(): void {
        this.renderNav();
        this.contentBox.destroy_children();

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

        const footer = new St.BoxLayout({
            style_class: "calendar-footer",
        });

        this.contentBox.add_actor(footer);

        this._updateExternalViews();
    }

    /* ============================================================
     * MONTH VIEW
     * ============================================================
     *
     * This method renders the classic month grid view.
     *
     * ────────────────────────────────────────────────────────────
     * CONTEXT / PRECONDITIONS
     * ────────────────────────────────────────────────────────────
     *
     * At the time this method is called, the following is already true:
     *
     * 1. The CalendarView instance exists and is fully initialized.
     *
     * 2. Global calendar state is valid:
     *    - this.displayedYear   → year currently shown
     *    - this.displayedMonth  → month currently shown (0–11)
     *    - this.selectedDay    → null or a specific day number
     *
     * 3. Navigation has already been rendered via renderNav().
     *
     * 4. this.contentBox is empty and ready to receive new UI elements.
     *
     * 5. The EventManager is active and provides:
     *    - hasEvents(date)
     *    - getEventsForDate(date)
     *
     * 6. Optional helpers may be available:
     *    - CalendarLogic (for holidays)
     *    - Tooltips.Tooltip (for hover details)
     *
     * This method does NOT persist state.
     * It only reads state and builds UI accordingly.
     *
     * ────────────────────────────────────────────────────────────
     * DESIGN OVERVIEW
     * ────────────────────────────────────────────────────────────
     *
     * The month view consists of:
     *
     * - A 7-column grid (Monday → Sunday)
     * - Optional week-number column on the left
     * - Always 6 rows (maximum weeks a month can span)
     *
     * Each cell:
     * - Represents a single calendar day
     * - Is clickable
     * - Can show:
     *   • day number
     *   • event indicator dot
     *   • holiday styling
     *   • tooltip with details
     *
     * TODO (Architectural):
     * If CalendarView is ever split into multiple files,
     * this method would need:
     * - Access to shared state (displayedYear, displayedMonth, selectedDay)
     * - Access to EventManager and CalendarLogic
     * Therefore it currently must remain a method of this class.
     */

    private renderMonthView(): void {
        /* --------------------------------------------------------
         * GRID INITIALIZATION
         * --------------------------------------------------------
         *
         * St.Table is used instead of BoxLayout because:
         * - We need a strict row/column layout
         * - All cells should have equal size
         */

        const grid = new St.Table({
            homogeneous: true,
            style_class: "calendar",
        });

        /* --------------------------------------------------------
         * WEEK NUMBER COLUMN OFFSET
         * --------------------------------------------------------
         *
         * If week numbers are enabled, column 0 is reserved
         * for them and all weekday columns shift by +1.
         */

        const colOffset = this.applet.showWeekNumbers ? 1 : 0;

        /* --------------------------------------------------------
         * WEEKDAY HEADER ROW
         * --------------------------------------------------------
         *
         * Adds localized weekday names (Mon–Sun) as the first row.
         */

        this.getDayNames().forEach((name, i) => {
            grid.add(
                new St.Label({
                    text: name,
                    style_class: "calendar-day-base",
                }),
                { row: 0, col: i + colOffset }
            );
        });

        /* --------------------------------------------------------
         * DATE ITERATION SETUP
         * --------------------------------------------------------
         *
         * We start at the first visible cell of the grid,
         * which may belong to the previous month.
         *
         * The calendar uses Monday as the first weekday.
         */

        let iter = new Date(this.displayedYear, this.displayedMonth, 1);

        // Convert JS Sunday-based index to Monday-based index
        const firstWeekday = (iter.getDay() + 6) % 7;

        // Move iterator back to the Monday of the first visible week
        iter.setDate(iter.getDate() - firstWeekday);

        /* --------------------------------------------------------
         * NORMALIZED "TODAY" DATE
         * --------------------------------------------------------
         *
         * Used for visual highlighting of the current day.
         */

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        /* --------------------------------------------------------
         * MAIN GRID LOOP (6 WEEKS × 7 DAYS)
         * --------------------------------------------------------
         *
         * We always render 6 rows to keep layout stable,
         * even for short months.
         */

        for (let row = 1; row <= 6; row++) {

            /* ----------------------------------------------------
             * WEEK NUMBER COLUMN (OPTIONAL)
             * ----------------------------------------------------
             *
             * ISO week number calculation:
             * - Thursday determines the week number
             */

            if (this.applet.showWeekNumbers) {
                const kwDate = new Date(iter);
                kwDate.setDate(kwDate.getDate() + 3);

                grid.add(
                    new St.Label({
                        text: this.getWeekNumber(kwDate).toString(),
                        style_class: "calendar-week-number",
                    }),
                    { row, col: 0 }
                );
            }

            /* ----------------------------------------------------
             * DAY CELLS (MONDAY → SUNDAY)
             * ----------------------------------------------------
             */

            for (let col = 0; col < 7; col++) {
                const isOtherMonth =
                    iter.getMonth() !== this.displayedMonth;

                const isToday =
                    iter.getTime() === today.getTime();

                const hasEvents =
                    !isOtherMonth &&
                    this.applet.eventManager.hasEvents(iter);

                /* --------------------------------------------
                 * HOLIDAY HANDLING (OPTIONAL)
                 * --------------------------------------------
                 */

                const holidays =
                    !isOtherMonth && this.applet.CalendarLogic
                        ? this.applet.CalendarLogic.getHolidaysForDate(
                              iter,
                              "de"
                          )
                        : [];

                const isHoliday = holidays.length > 0;

                /* --------------------------------------------
                 * CSS CLASS COMPOSITION
                 * --------------------------------------------
                 *
                 * Styling is entirely CSS-driven.
                 * Logic here only decides which classes apply.
                 */

                const btnClasses = ["calendar-day"];

                if (isOtherMonth)
                    btnClasses.push("calendar-other-month-day");

                if (isToday)
                    btnClasses.push("calendar-today");

                if (iter.getDay() === 0 || isHoliday)
                    btnClasses.push("calendar-nonwork-day");

                /* --------------------------------------------
                 * DAY BUTTON
                 * --------------------------------------------
                 *
                 * Each day is a button so it can:
                 * - Receive focus
                 * - Be clicked
                 * - Host a tooltip
                 */

                const btn = new St.Button({
                    reactive: true,
                    can_focus: true,
                    style_class: btnClasses.join(" "),
                });

                /* --------------------------------------------
                 * DAY CELL CONTENT
                 * --------------------------------------------
                 *
                 * Vertical layout:
                 * - Day number
                 * - Event indicator dot
                 */

                const content = new St.BoxLayout({
                    vertical: true,
                    x_align: St.Align.MIDDLE,
                });

                content.add_actor(
                    new St.Label({
                        text: iter.getDate().toString(),
                        style_class: "calendar-day-label",
                    })
                );

                content.add_actor(
                    new St.Label({
                        text: hasEvents ? "•" : " ",
                        style_class: "calendar-day-event-dot-label",
                    })
                );

                btn.set_child(content);

                /* --------------------------------------------
                 * TOOLTIP (OPTIONAL)
                 * --------------------------------------------
                 *
                 * Shows holidays and event summaries on hover.
                 */

                if (Tooltips.Tooltip) {
                    const tooltipLines: string[] = [];

                    holidays.forEach(h => tooltipLines.push(h));

                    if (hasEvents) {
                        const events =
                            this.applet.eventManager.getEventsForDate(
                                iter
                            );
                        events.forEach((e: any) =>
                            tooltipLines.push(`• ${e.summary}`)
                        );
                    }

                    if (tooltipLines.length > 0) {
                        new Tooltips.Tooltip(
                            btn,
                            tooltipLines.join("\n")
                        );
                    }
                }

                /* --------------------------------------------
                 * CLICK HANDLER
                 * --------------------------------------------
                 *
                 * Clicking a day:
                 * - Updates global calendar state
                 * - Switches to DAY view
                 * - Triggers full re-render
                 */

                const d = iter.getDate();
                const m = iter.getMonth();
                const y = iter.getFullYear();

                btn.connect("clicked", () => {
                    this.selectedDay = d;
                    this.displayedMonth = m;
                    this.displayedYear = y;
                    this.currentView = "DAY";
                    this.render();
                });

                /* --------------------------------------------
                 * ADD CELL TO GRID
                 * --------------------------------------------
                 */

                grid.add(btn, {
                    row,
                    col: col + colOffset,
                });

                // Advance iterator to next day
                iter.setDate(iter.getDate() + 1);
            }
        }

        /* --------------------------------------------------------
         * FINALIZE VIEW
         * --------------------------------------------------------
         *
         * Add the fully constructed grid to the content area.
         */

        this.contentBox.add_actor(grid);
    }

    /* ============================================================
     * YEAR VIEW
     * ============================================================
     *
     * This view provides a high-level overview of an entire year.
     *
     * ────────────────────────────────────────────────────────────
     * PURPOSE OF THE YEAR VIEW
     * ────────────────────────────────────────────────────────────
     *
     * The Year View is intentionally minimalistic.
     * Its main purpose is NOT to display events directly,
     * but to act as a fast navigation hub:
     *
     *   YEAR  →  MONTH  →  DAY
     *
     * In the current architecture, this view allows the user to:
     * - See all months of the selected year at once
     * - Quickly jump into a specific month
     *
     * It does NOT:
     * - Render individual days
     * - Show event dots or counts
     * - Display mini calendars
     *
     * ────────────────────────────────────────────────────────────
     * DESIGN DECISION (IMPORTANT)
     * ────────────────────────────────────────────────────────────
     *
     * The original design idea included:
     * - A "mini month grid" for each month
     * - Possibly event dots per month
     *
     * This was deliberately NOT implemented (yet), because:
     *
     * 1. Cinnamon applets have strict performance constraints.
     *    Rendering 12 full mini-calendars would significantly
     *    increase UI complexity and redraw cost.
     *
     * 2. Event data retrieval in Cinnamon is asynchronous and
     *    limited by the Cinnamon.CalendarServer API.
     *
     * 3. There is no clean, officially supported way to request
     *    aggregated per-month event summaries without fetching
     *    full event ranges.
     *
     * TODO (Future Enhancement):
     * Implement optional mini month grids per month, but ONLY if:
     * - EventManager provides cached per-month summaries
     * - Rendering can be done lazily or on-demand
     */

    private renderYearView(): void {
        /* --------------------------------------------------------
         * ROOT CONTAINER
         * --------------------------------------------------------
         *
         * Vertical layout:
         * 1. Action area (currently mostly unused)
         * 2. Month selection grid
         */

        const yearBox = new St.BoxLayout({
            vertical: true,
            style_class: "year-view-container",
        });

        /* --------------------------------------------------------
         * ACTION AREA (TOP OF YEAR VIEW)
         * --------------------------------------------------------
         *
         * This area was intended for global year-level actions,
         * such as importing calendars or bulk operations.
         *
         * At the moment it only acts as a spacer.
         */

        const actionArea = new St.BoxLayout({
            x_align: St.Align.MIDDLE,
            style: "padding: 10px;",
        });

        /* --------------------------------------------------------
         * ICS IMPORT BUTTON (DISABLED / TODO)
         * --------------------------------------------------------
         *
         * This button is intentionally commented out.
         *
         * REASONING:
         *
         * While importing ICS files sounds trivial, it is NOT
         * reliably solvable within the constraints of:
         *
         * - Cinnamon.CalendarServer (mostly read-only via DBus)
         * - Evolution Data Server (EDS) permissions and sources
         * - GJS / GIR API inconsistencies
         *
         * In practice:
         * - "Modify existing events" often works
         * - "Create new events" is highly source-dependent
         * - Bulk ICS imports introduce complex edge cases:
         *   • missing or duplicate UIDs
         *   • read-only calendar sources
         *   • partial failures without rollback
         *
         * Therefore, this feature is currently disabled to avoid
         * misleading users with a broken or unreliable workflow.
         *
         * TODO (Architectural):
         * If ICS import is ever re-enabled, the following must exist:
         * - A fully robust EventManager.create() implementation
         * - Proper source resolution and permission checks
         * - Clear user feedback for partial import failures
         */

        /*const importBtn = new St.Button({
            label: _("Import a Calendar"),
            style_class: "calendar-event-button",
            x_expand: true,
        });

        importBtn.connect("clicked", () => {
            global.log(
                "[CalendarView] ICS import requested (not yet implemented)"
            );
            this.onImportRequested?.();
        });
        */

        /* actionArea.add_actor(importBtn); */

        yearBox.add_actor(actionArea);

        /* --------------------------------------------------------
         * MONTH SELECTION GRID
         * --------------------------------------------------------
         *
         * A simple grid of 12 buttons (3 columns × 4 rows),
         * each representing one month of the year.
         *
         * This grid does NOT depend on event data.
         */

        const grid = new St.Table({
            homogeneous: true,
            style_class: "calendar",
        });

        /* --------------------------------------------------------
         * MONTH BUTTON CREATION
         * --------------------------------------------------------
         *
         * We iterate over all 12 months (0–11).
         *
         * Each button:
         * - Displays the localized short month name
         * - Switches the view to MONTH when clicked
         */

        for (let m = 0; m < 12; m++) {
            const btn = new St.Button({
                label: new Date(
                    this.displayedYear,
                    m
                ).toLocaleString(this.LOCALE, {
                    month: "short",
                }),
                style_class: "calendar-month-label",
            });

            /* ----------------------------------------------------
             * CLICK HANDLER
             * ----------------------------------------------------
             *
             * Clicking a month:
             * - Updates displayedMonth
             * - Switches view mode to MONTH
             * - Triggers a full re-render
             */

            btn.connect("clicked", () => {
                this.displayedMonth = m;
                this.currentView = "MONTH";
                this.render();
            });

            /* ----------------------------------------------------
             * GRID POSITIONING
             * ----------------------------------------------------
             *
             * Layout:
             *   Row = monthIndex / 3
             *   Col = monthIndex % 3
             */

            grid.add(btn, {
                row: Math.floor(m / 3),
                col: m % 3,
            });
        }

        /* --------------------------------------------------------
         * FINAL ASSEMBLY
         * --------------------------------------------------------
         *
         * Add the month grid to the year container,
         * then attach everything to the main content box.
         */

        yearBox.add_actor(grid);
        this.contentBox.add_actor(yearBox);
    }

    /* ============================================================
     * DAY VIEW
     * ============================================================
     *
     * The Day View is the most interaction-heavy part of CalendarView.
     *
     * It is responsible for:
     * - Displaying details for a single selected calendar day
     * - Showing holidays for that day
     * - Listing all events occurring on that date
     * - Handling UI state transitions for:
     *     • Viewing events
     *     • Editing an existing event
     *     • (Optionally) adding a new event
     *
     * IMPORTANT CONTEXT (What must already be true before this runs):
     *
     * - `this.displayedYear`, `this.displayedMonth` are set
     * - `this.selectedDay` is set (usually via:
     *      • click in Month View
     *      • jumpToDate() from EventListView)
     * - `this.currentView === "DAY"`
     * - EventManager is initialized and has cached events
     *
     * This method MUST be called only from within CalendarView.render().
     * It relies heavily on internal class state and cannot be used
     * as a standalone component without refactoring.
     */

	private renderDayView(): void {

	    /* --------------------------------------------------------
	     * ROOT CONTAINER FOR DAY VIEW
	     * --------------------------------------------------------
	     *
	     * This vertical box contains:
	     * 1. Date header (weekday + date)
	     * 2. Holiday rows (if any)
	     * 3. Event list OR "No events"
	     * 4. Add/Edit form (optional, depending on mode)
	     * 5. Action bar
	     * 6. Navigation back to Month View
	     */

	    const box = new St.BoxLayout({
	        vertical: true,
	        style_class: "calendar-events-main-box",
	    });

	    /* --------------------------------------------------------
	     * RESOLVE SELECTED DATE
	     * --------------------------------------------------------
	     *
	     * selectedDay should normally be set.
	     * Fallback to day "1" is a defensive safeguard and should
	     * normally never be hit during regular operation.
	     */

	    const selectedDate = new Date(
	        this.displayedYear,
	        this.displayedMonth,
	        this.selectedDay || 1
	    );
	
	    /* --------------------------------------------------------
	     * DAY MODE GUARD (VERY IMPORTANT)
	     * --------------------------------------------------------
	     *
	     * dayMode controls the internal UI sub-state:
	     *   - "VIEW" → show events only
	     *   - "ADD"  → show create form
	     *   - "EDIT" → show edit form for a specific event
	     *
	     * This guard ensures:
	     * - ADD / EDIT modes are ONLY valid for the exact date
	     *   they were initiated on.
	     *
	     * Example problem without this guard:
	     * - User clicks "Edit" on Jan 5
	     * - Then navigates to Jan 6
	     * - Edit form would still be shown for the wrong day
	     *
	     * Therefore:
	     * If the date changes → reset to VIEW mode.
	     */

	    if (
	        this.dayMode !== "VIEW" &&
	        (
	            !this.dayModeDate ||
	            this.dayModeDate.toDateString() !== selectedDate.toDateString()
	        )
	    ) {
	        this.dayMode = "VIEW";
	        this.editingEvent = null;
	        this.dayModeDate = null;
	    }

	    /* --------------------------------------------------------
	     * DATE HEADER
	     * --------------------------------------------------------
	     *
	     * Displays the full localized date:
	     * e.g. "Tuesday, 05 January 2026"
	     */

	    box.add_actor(
	        new St.Label({
	            text: selectedDate.toLocaleString(this.LOCALE, {
	                weekday: "long",
	                day: "2-digit",
	                month: "long",
	                year: "numeric",
	            }),
	            style_class: "day-details-title",
	        })
	    );

	    /* --------------------------------------------------------
	     * HOLIDAYS SECTION (OPTIONAL)
	     * --------------------------------------------------------
	     *
	     * Holidays are resolved via CalendarLogic (if present).
	     *
	     * This is completely independent from events.
	     * Holidays are rendered as visual info rows only.
	     */

	    if (this.applet.CalendarLogic) {
	        const holidays =
	            this.applet.CalendarLogic.getHolidaysForDate(
	                selectedDate,
	                "de"
	            );

	        holidays.forEach(h => {
	            const row = new St.BoxLayout({
        	        style_class: "calendar-event-button",
        	        style:
        	            "background-color: rgba(255,0,0,0.1);",
        	    });
	            row.add_actor(
 	               new St.Label({
	                    text: h,
	                    style_class:
	                        "calendar-event-summary",
	                })
	            );
	            box.add_actor(row);
	        });
        }

	    /* --------------------------------------------------------
	     * FETCH EVENTS FOR SELECTED DATE
	     * --------------------------------------------------------
	     *
	     * EventManager is responsible for all date filtering.
	     * CalendarView never interprets start/end times itself.
	     */

	    const events =
	        this.applet.eventManager.getEventsForDate(
       		    selectedDate
        	);

	    /* --------------------------------------------------------
	     * EVENT LIST RENDERING
	     * --------------------------------------------------------
	     *
	     * Each event is rendered as:
	     * - Summary label
	     * - Edit button
	     *
	     * No delete button exists here by design.
	     * (Deletion semantics are non-trivial with EDS.)
	     */

	    if (events.length > 0) {
	        events.forEach((ev: any) => {
	            const row = new St.BoxLayout({
	                style_class: "calendar-event-button",
	            });
	            
	            /* Event summary */
	            row.add_actor(
	                new St.Label({	
	                    text: ev.summary,
	                    style_class: "calendar-event-summary",
	                })
	            );
            
	            /* Edit button */
	            const editBtn = new St.Button({
	                label: _("Edit"),
	                style_class: "calendar-event-edit-button",
	            });
	            
	            editBtn.connect("clicked", () => {
	                this.dayMode = "EDIT";
	                this.editingEvent = ev;
	                this.dayModeDate = selectedDate;
	                this.render();
	            });
	            
	            row.add_actor(editBtn);
	            box.add_actor(row);
	        });
	    }

	    /* --------------------------------------------------------
	     * NO EVENTS PLACEHOLDER
	     * --------------------------------------------------------
	     *
	     * Only shown in VIEW mode.
	     * Not shown when ADD or EDIT form is active.
	     */

	    if (events.length === 0 && this.dayMode === "VIEW") {
	        box.add_actor(
	            new St.Label({
	                text: _("No events"),
	                style_class: "calendar-events-no-events-label",
	            })
	        );
	    }
	    
	    /* --------------------------------------------------------
	     * ADD / EDIT FORM INJECTION
	     * --------------------------------------------------------
	     *
	     * createTerminForm() dynamically builds a form UI.
	     *
	     * IMPORTANT ARCHITECTURAL NOTE:
	     *
	     * This tightly couples:
	     * - Day View
	     * - Event creation/editing UI
	     *
	     * TODO (Refactor Idea):
	     * - Extract createTerminForm into a separate component
	     * - Or move all form logic into EventListView or a Dialog
	     *
	     * WHY THIS IS CURRENTLY PROBLEMATIC:
	     *
	     * - Cinnamon CalendarServer + EDS via GJS/GIR is unreliable
	     *   for CREATE operations (especially description fields).
	     * - Description handling is partially broken / inconsistent.
	     * - Because of this, ADD functionality is currently limited.
	     */

	    if (this.dayMode === "ADD") {
	        box.add_actor(
	            this.createTerminForm(selectedDate)
	        );
	    }
	    else if (this.dayMode === "EDIT" && this.editingEvent) {
	        box.add_actor(
	            this.createTerminForm(selectedDate, this.editingEvent)
	        );
	    }

	    /* --------------------------------------------------------
	     * NAVIGATION BACK TO MONTH VIEW
	     * --------------------------------------------------------
	     *
	     * Always resets Day View state.
	     */

	    const backBtn = new St.Button({
	        label: _("Month view"),
	        style_class: "nav-button",
	        style: "margin-top: 15px;",
	    });
	
	    backBtn.connect("clicked", () => {
	        this.currentView = "MONTH";
	        this.dayMode = "VIEW";
	        this.editingEvent = null;
	        this.dayModeDate = null;
	        this.render();
	    });

	    /* --------------------------------------------------------
	     * ACTION BAR (CURRENTLY MOSTLY UNUSED)
	     * --------------------------------------------------------
	     *
	     * Originally planned to host the "Add event" button.
	     *
	     * WHY IT IS COMMENTED OUT:
	     *
	     * - Event creation via GJS / GIR / EDS is currently unstable
	     * - Description fields are buggy or missing
	     * - Creating events may silently fail depending on source
	     *
	     * TODO:
	     * Re-enable ONLY when:
	     * - EventManager.create() is fully reliable
	     * - Description roundtrips correctly via CalendarServer
	     */

	    const actionBar = new St.BoxLayout({
	        style_class: "calendar-day-actions",
	        x_align: St.Align.END
	    });
	
	    /* 
	    if (this.dayMode === "VIEW") {
	        const addBtn = new St.Button({
	            label: _("Add event"),
	            style_class: "calendar-event-button"
	        });
	
	        addBtn.connect("clicked", () => {
	            this.dayMode = "ADD";
	            this.editingEvent = null;
	            this.dayModeDate = selectedDate;
	            this.render();
	        });
	
	        actionBar.add_actor(addBtn);
	    }
	    */
	    
	    /* --------------------------------------------------------
	     * FINAL ASSEMBLY
	     * --------------------------------------------------------
	     */

	    box.add_actor(actionBar);
	    box.add_actor(backBtn);
	    this.contentBox.add_actor(box);
	}

    /* ============================================================
     * CREATE / EDIT FORM
     * ============================================================
     *
     * This method builds the inline form used to:
     * - Create a new calendar event
     * - Edit an existing calendar event
     *
     * IMPORTANT CONTEXT (How we get here):
     *
     * - This form is ONLY rendered from renderDayView()
     * - It is injected into the Day View depending on `dayMode`
     *   ("ADD" or "EDIT")
     * - The surrounding popup is NOT a dialog but part of the
     *   Cinnamon applet popup UI
     *
     * WHY THIS IS INLINE (and not a dialog):
     *
     * - Cinnamon applets have limited dialog APIs
     * - Keeping everything inside the popup avoids focus issues
     * - Rendering inline allows full reuse of CalendarView state
     *
     * TODO (Architectural Improvement):
     * - Extract this form into a dedicated component or dialog
     * - Decouple UI logic from CalendarView
     * - Allow asynchronous validation / error feedback
     */

    private createTerminForm(date: Date, editingEvent?: any): any {

        /* --------------------------------------------------------
         * ROOT CONTAINER
         * --------------------------------------------------------
         *
         * Vertical layout that contains:
         * - All-day toggle
         * - Title input
         * - Time inputs
         * - (Optional) description input (currently disabled)
         * - Save button
         */

        const box = new St.BoxLayout({
            vertical: true,
            style_class: "calendar-main-box",
            x_expand: true
        });

        /* --------------------------------------------------------
         * EVENT ID HANDLING
         * --------------------------------------------------------
         *
         * - If editing an existing event:
         *   → reuse its UUID
         * - If creating a new event:
         *   → do NOT generate a UUID here
         *
         * WHY NOT GENERATE UUID HERE?
         *
         * - EDS (Evolution Data Server) is able to generate IDs
         * - Manual UUID handling is error-prone with EDS sources
         * - Let EventManager / backend decide when necessary
         */

        const currentId = editingEvent ? editingEvent.id : undefined;

        /* --------------------------------------------------------
         * ALL-DAY TOGGLE
         * --------------------------------------------------------
         *
         * This replaces a traditional checkbox.
         *
         * Reason:
         * - St does not have a native checkbox widget
         * - Button with toggle_mode is more consistent visually
         *
         * Behavior:
         * - When enabled:
         *   → Time fields become visually disabled
         *   → Time fields are non-interactive
         */

        const isInitialFullDay = editingEvent ? editingEvent.isFullDay : false;
        const allDayCheckbox = new St.Button({
            label: isInitialFullDay ? "☑ " + _("All Day") : "☐ " + _("All Day"),
            style_class: "calendar-event-button",
            toggle_mode: true,
            checked: isInitialFullDay,
            x_align: St.Align.START
        });

        /* --------------------------------------------------------
         * TITLE / SUMMARY ENTRY
         * --------------------------------------------------------
         *
         * This maps directly to the VEVENT SUMMARY field.
         * It is the ONLY required field for saving.
         */

        const titleEntry = new St.Entry({
            hint_text: _("What? (Nice event)"),
            style_class: "calendar-event-summary",
            text: editingEvent ? editingEvent.summary : ""
        });

        /* --------------------------------------------------------
         * TIME HANDLING
         * --------------------------------------------------------
         *
         * Time values are handled as strings (HH:MM) in the UI.
         * Conversion to Date objects happens only on Save.
         */

        const formatTime = (d: Date) => {
            return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        };

        const startTimeStr = editingEvent
            ? formatTime(editingEvent.start)
            : this._getCurrentTime();

        const endTimeStr = editingEvent
            ? formatTime(editingEvent.end)
            : this._calculateDefaultEnd(startTimeStr);

        const descriptionStr =
            (editingEvent && typeof editingEvent.description === 'string')
                ? editingEvent.description
                : "";

        const timeBox = new St.BoxLayout({
            vertical: false,
            style: "margin: 5px 0;"
        });

        const startEntry = new St.Entry({
            text: startTimeStr,
            style_class: "calendar-event-time-present",
            can_focus: true,
            reactive: true
        });

        const endEntry = new St.Entry({
            text: endTimeStr,
            style_class: "calendar-event-time-present",
            can_focus: true,
            reactive: true
        });

        /* --------------------------------------------------------
         * TIME FIELD VISIBILITY / ENABLE LOGIC
         * --------------------------------------------------------
         *
         * Centralized logic to enable / disable time fields
         * depending on the All-Day toggle.
         *
         * Visual feedback:
         * - Reduced opacity when disabled
         * - Input and focus disabled
         */

        const updateVisibility = () => {
            const isFullDay = allDayCheckbox.checked;

            allDayCheckbox.set_label(
                isFullDay ? "☑ " + _("All Day") : "☐ " + _("All Day")
            );
            
            const opacity = isFullDay ? 128 : 255;
            startEntry.set_opacity(opacity);
            endEntry.set_opacity(opacity);
            startEntry.set_reactive(!isFullDay);
            endEntry.set_reactive(!isFullDay);
            startEntry.can_focus = !isFullDay;
            endEntry.can_focus = !isFullDay;
        };

        allDayCheckbox.connect("clicked", () => {
            updateVisibility();
        });

        timeBox.add_actor(new St.Label({
            text: _("From:"),
            style: "margin-right: 5px;"
        }));
        timeBox.add_actor(startEntry);
        timeBox.add_actor(new St.Label({
            text: _("To:"),
            style: "margin: 0 5px;"
        }));
        timeBox.add_actor(endEntry);

        /* --------------------------------------------------------
         * DESCRIPTION FIELD (DISABLED / COMMENTED OUT)
         * --------------------------------------------------------
         *
         * WHY THIS IS DISABLED:
         *
         * - Cinnamon CalendarServer + GJS/GIR has known issues
         *   with VEVENT DESCRIPTION handling
         * - set_description / set_description_list behave
         *   inconsistently across environments
         * - Description data may be silently dropped or break
         *   CREATE operations
         *
         * CURRENT DECISION:
         * - Keep the UI code commented for future reference
         * - Do NOT expose broken functionality to users
         *
         * TODO:
         * - Re-enable when EDS + CalendarServer reliably
         *   supports description roundtrips
         */

        /*
        const descEntry = new St.Entry({
            hint_text: _("Description"),
            style_class: "calendar-event-row-content", 
            x_expand: true,
            text: descriptionStr
        });
        */

        /*
        descEntry.clutter_text.single_line_mode = false;
        descEntry.clutter_text.line_wrap = true;
        descEntry.clutter_text.set_activatable(false);
        */

        /* --------------------------------------------------------
         * SAVE BUTTON
         * --------------------------------------------------------
         *
         * On click:
         * - Validate title
         * - Build Date objects
         * - Delegate persistence to EventManager
         *
         * IMPORTANT UX NOTE:
         *
         * After Save:
         * - The form closes immediately
         * - The popup re-renders
         *
         * This feels abrupt for users.
         *
         * TODO (UX Improvement):
         * - Keep form open until backend confirms success
         * - Show error feedback on failure
         */

        const buttonBox = new St.BoxLayout({
            style: "margin-top: 10px;"
        });

        const saveBtn = new St.Button({
            label: editingEvent ? _("Update") : _("Save"),
            style_class: "calendar-event-button",
            x_expand: true
        });

        saveBtn.connect("clicked", () => {
            const title = titleEntry.get_text().trim();
            if (!title) return;

            const isFullDay = allDayCheckbox.checked;
            const start = this._buildDateTime(date, startEntry.get_text());
            const end = this._buildDateTime(date, endEntry.get_text());

            this.applet.eventManager.addEvent({
                id: currentId,
                sourceUid: editingEvent ? editingEvent.sourceUid : undefined,
                summary: title,
                // Description intentionally disabled due to EDS limitations
                description: "",
                start: start,
                end: end,
                isFullDay: isFullDay,
                color: editingEvent ? editingEvent.color : "#3498db"
            });

            /* Reset Day View state */
            this.dayMode = "VIEW";
            this.editingEvent = null;
            this.render();
        });

        /* --------------------------------------------------------
         * FINAL ASSEMBLY
         * --------------------------------------------------------
         */

        box.add_actor(allDayCheckbox);
        box.add_actor(titleEntry);
        box.add_actor(timeBox);
        /* box.add_actor(descEntry); */
        buttonBox.add_actor(saveBtn);
        box.add_actor(buttonBox);

        /* Ensure correct initial state */
        updateVisibility();

        return box;
    }

    /* ============================================================
     * DATE HELPERS
     * ============================================================
     *
     * The following helper methods are pure utility functions
     * used throughout CalendarView.
     *
     * They are intentionally kept INSIDE the class instead of
     * being moved to a shared utils module.
     *
     * WHY?
     * - They depend on this.LOCALE
     * - They are tightly coupled to calendar rendering logic
     * - Keeping them here improves readability for new developers
     *
     * TODO (Refactoring Option):
     * - These helpers could be extracted into a separate
     *   DateUtils module if CalendarView ever gets split
     *   into multiple files.
     */

    /**
     * Returns localized short weekday names.
     *
     * Example (de_DE):
     * ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
     *
     * IMPORTANT:
     * - Uses Intl.DateTimeFormat for proper localization
     * - Avoids hardcoding weekday strings
     *
     * Implementation detail:
     * - We generate arbitrary dates (Jan 1–7, 2024)
     * - Only the weekday part is relevant
     */
    private getDayNames(): string[] {
        const formatter = new Intl.DateTimeFormat(this.LOCALE, {
            weekday: "short",
        });

        return [1, 2, 3, 4, 5, 6, 7].map(d =>
            formatter.format(new Date(2024, 0, d))
        );
    }

    /**
     * Calculates ISO-8601 week number for a given date.
     *
     * WHY THIS EXISTS:
     * - JavaScript does NOT provide a native week number API
     * - Cinnamon calendar optionally displays week numbers
     *
     * Implementation notes:
     * - Uses UTC to avoid timezone-related off-by-one errors
     * - Thursday-based week calculation per ISO standard
     *
     * Reference:
     * - ISO 8601 defines week 1 as the week containing Jan 4th
     */
    private getWeekNumber(date: Date): number {
        const d = new Date(
            Date.UTC(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            )
        );

        // Move to Thursday of the current week
        d.setUTCDate(
            d.getUTCDate() + 4 - (d.getUTCDay() || 7)
        );

        const yearStart = new Date(
            Date.UTC(d.getUTCFullYear(), 0, 1)
        );

        return Math.ceil(
            (
                (d.getTime() - yearStart.getTime()) /
                86400000 +
                1
            ) / 7
        );
    }

    /* ============================================================
     * TIME / DATE HELPERS FOR DAY VIEW FORMS
     * ============================================================
     *
     * These helpers are used exclusively by:
     * - createTerminForm()
     * - Day View time handling
     *
     * They convert between:
     * - UI-friendly strings (HH:MM)
     * - JavaScript Date objects
     *
     * WHY THIS IS NECESSARY:
     * - St.Entry widgets only handle strings
     * - EventManager requires Date objects
     * - Keeping conversion logic centralized avoids bugs
     */

    /**
     * Returns current local time formatted as HH:MM.
     *
     * Used when creating a NEW event to pre-fill
     * the start time field.
     */
    private _getCurrentTime(): string {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, "0")}:${String(
            now.getMinutes()
        ).padStart(2, "0")}`;
    }

    /**
     * Calculates a default end time (+1 hour)
     * based on a given start time string.
     *
     * Example:
     * startTime = "14:30" → endTime = "15:30"
     *
     * Used for:
     * - New events
     * - Improving UX by avoiding empty end fields
     */
    private _calculateDefaultEnd(startTime: string): string {
        const [h, m] = startTime.split(":").map(Number);
        const d = new Date();
        d.setHours(h + 1, m, 0, 0);

        return `${String(d.getHours()).padStart(2, "0")}:${String(
            d.getMinutes()
        ).padStart(2, "0")}`;
    }

    /**
     * Builds a Date object from:
     * - A base calendar date
     * - A time string (HH:MM)
     *
     * This is the final step before sending
     * data to EventManager / EDS.
     *
     * Example:
     * date = 2026-01-05
     * time = "09:15"
     * → Date(2026-01-05T09:15:00)
     */
    private _buildDateTime(date: Date, time: string): Date {
        const [h, m] = time.split(":").map(Number);
        const d = new Date(date);
        d.setHours(h, m, 0, 0);
        return d;
    }

}

/* ================================================================
 * HYBRID EXPORT STRATEGY (DEVELOPMENT vs PRODUCTION)
 * ================================================================
 *
 * This section is EXTREMELY IMPORTANT.
 *
 * DO NOT REMOVE unless you fully understand Cinnamon's
 * loading mechanisms.
 *
 * WHY THIS EXISTS:
 *
 * Cinnamon applets run in a hybrid environment:
 *
 * 1) DEVELOPMENT / BUILD TIME
 *    - TypeScript
 *    - Modular imports
 *    - Bundlers / transpilers
 *
 * 2) PRODUCTION / RUNTIME
 *    - GJS (GNOME JavaScript)
 *    - No real module loader
 *    - Global namespace access
 *
 * To support BOTH environments, we export the class in
 * two different ways.
 */

/* ---------------------------------------------------------------
 * CommonJS-style export (build / tooling environments)
 * ---------------------------------------------------------------
 *
 * This allows:
 * - Unit testing
 * - TypeScript compilation
 * - IDE tooling
 */

if (typeof exports !== "undefined") {
    exports.CalendarView = CalendarView;
}

/* ---------------------------------------------------------------
 * Global export (Cinnamon runtime)
 * ---------------------------------------------------------------
 *
 * Cinnamon loads applets by evaluating a single JS file.
 * There is NO module system at runtime.
 *
 * Therefore:
 * - Classes MUST be attached to the global object
 * - Other files access them via global.CalendarView
 *
 * The `(global as any)` cast:
 * - Is required to silence TypeScript
 * - Reflects the dynamic nature of GJS
 *
 * WARNING TO FUTURE DEVELOPERS:
 *
 * Removing this WILL:
 * - Work in development
 * - FAIL in production
 * - Break runtime imports silently
 */

(global as any).CalendarView = CalendarView;

