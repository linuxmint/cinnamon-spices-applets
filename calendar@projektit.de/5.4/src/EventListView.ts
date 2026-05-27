/**
/**
 * @file EventListView.ts
 * @brief Event sidebar UI component
 * 
 * @details Displays events in list format with scrollable container and navigation support.
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2023-2026
 * @copyright GPL-3.0-or-later
 */
/*
 * Project IT Calendar - Event List View Component
 * ----------------------------------------------
 * This component handles the rendering of the event list shown next to or 
 * below the calendar grid. It supports single-day views, range views, and 
 * full-month overviews with clickable event rows for navigation.
 * * * * ARCHITECTURE OVERVIEW:
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

/* === GJS Imports - Shell Toolkit and Clutter for UI === */
const { St, Clutter } = imports.gi;
const Signals = imports.signals;

/**
 * Interface Merging for Signals
 * This tells TypeScript that EventListView will have the methods
 * from the Signals.Signals interface (connect, disconnect, emit).
 */
export interface EventListView extends Signals.Signals {}



/**
 * EventListView Class
 * Manages the UI for the event sidebar/agenda.
 */
/**
 * @class EventListView
 * @brief Main eventlist view class
 * 
 * @details For detailed documentation see the main class documentation.
 */
/**
 * @class EventListView
 * @brief Main eventlist view class
 * 
 * @details For detailed documentation see the main class documentation.
 */
export class EventListView {
    public actor: any;             // The main container (St.BoxLayout)
    private _eventsBox: any;       // Container for the list of event rows
    private _selectedDateLabel: any; // Header showing the current date or range

    constructor() {
        // Main layout: vertical box containing the header and the scrollable list
        this.actor = new St.BoxLayout({
            style_class: "calendar-events-main-box",
            vertical: true,
            x_expand: true
        });

        // Header Label: Shows "Monday, January 1, 2026" or "January 2026"
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
     * Legacy/Generic Update Method
     * This remains as a central entry point. By default, it treats
     * the input as a single day update.
     * @param date - The date to display in the header.
     * @param events - Array of events.
     */
    public update(date: Date, events: any[]): void {
        this.updateForDate(date, events);
     }

    /**
     * Update the list for a specific day.
     * @param date - The specific day to display.
     * @param events - Array of events for this day.
     */
    public updateForDate(date: Date, events: any[] = []): void {
        this._selectedDateLabel.set_text(date.toLocaleDateString(undefined, { 
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
        }));

        this._eventsBox.destroy_children();

        if (!events || events.length === 0) {
            this._showNoEvents();
            return;
        }

        // Render rows without showing the date (redundant in single day view)
        events.forEach((ev) => this._addEventRow(ev, false));
    }

    /**
     * Update the list for a specific month overview.
     * @param year - The year of the month.
     * @param month - The month index (0-11).
     * @param events - All events within this month.
     */
    public updateForMonth(year: number, month: number, events: any[]): void {
        const date = new Date(year, month, 1);
        this._selectedDateLabel.set_text(date.toLocaleDateString(undefined, {
            month: 'long', year: 'numeric'
        }));

        this._eventsBox.destroy_children();

        if (!events.length) {
            this._showNoEvents();
            return;
        }

        // Render rows with dates enabled so users can see which day the event belongs to
        events.forEach(ev => this._addEventRow(ev, true));
    }

    /**
     * Update the list for a specific date range.
     * @param range - Object with from and to dates.
     * @param events - Events within this range.
     */
    public updateForRange(range: DateRange, events: any[]): void {
        this._selectedDateLabel.set_text(this._formatRangeLabel(range));
        this._eventsBox.destroy_children();

        if (!events.length) {
            this._showNoEvents();
            return;
        }

        // Range views usually benefit from seeing the date per row
        events.forEach(ev => this._addEventRow(ev, true));
    }

    /**
     * Helper to format a DateRange into a readable string.
     */
    private _formatRangeLabel(range: DateRange): string {
        const opts: Intl.DateTimeFormatOptions = {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        };
        return `${range.from.toLocaleDateString(undefined, opts)} – ${range.to.toLocaleDateString(undefined, opts)}`;
    }

    /**
     * Renders a placeholder state when no events are present.
     */
    private _showNoEvents() {
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
            text: "No Events",
            style_class: "calendar-events-no-events-label"
        }));

        this._eventsBox.add_actor(box);
    }

    /**
     * Creates a stylized row for a single event.
     * @param ev - The event data object.
     * @param showDate - Whether to display the day/month prefix.
     */
    private _addEventRow(ev: any, showDate: boolean = false) {
        let row = new St.BoxLayout({
            style_class: "calendar-event-button",
            reactive: true,
            can_focus: true,
            track_hover: true
        });

        // Event listener to trigger navigation when a row is clicked
        row.connect('button-press-event', () => {
            if (ev.start) {
                // Emit signal so CalendarView can jump to this specific date
                this.emit('event-clicked', ev);
            }
            return Clutter.EVENT_STOP;
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

        // Date Label: Only shown in month/range overviews for orientation
        if (showDate && ev.start) {
            let dateStr = ev.start.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
            contentVBox.add_actor(new St.Label({
                text: dateStr,
                style_class: "calendar-event-date-small" 
            }));
        }

        // Event Title
        contentVBox.add_actor(new St.Label({
            text: ev.summary || "Unnamed Event",
            style_class: "calendar-event-summary"
        }));

        // Optional: Sub-text (e.g., location or description)
        if (ev.description) {
            contentVBox.add_actor(new St.Label({
                text: ev.description || "",
                style_class: "calendar-event-time-future"
            }));
        }

        row.add_actor(contentVBox);
        this._eventsBox.add_actor(row);
    }
}

/**
 * Add GJS Signal support to the prototype.
 * This allows the view to emit the 'event-clicked' signal.
 */
Signals.addSignalMethods(EventListView.prototype);

/**
 * HYBRID EXPORT SYSTEM
 */
if (typeof exports !== 'undefined') {
    exports.EventListView = EventListView;
}
(global as any).EventListView = EventListView;
