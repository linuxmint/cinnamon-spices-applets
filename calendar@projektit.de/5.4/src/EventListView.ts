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

/* === GJS Imports - Shell Toolkit and Clutter for UI === */
const { St, Clutter } = imports.gi;

export class EventListView {
    public actor: any;             // The main container (St.BoxLayout)
    private _eventsBox: any;       // Container for the list of event rows
    private _selectedDateLabel: any; // Header showing the current date

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
    public update(date: Date, events: any[]): void {
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
            text: "No Events", // Future: Wrap in _() for gettext translation
            style_class: "calendar-events-no-events-label"
        }));

        this._eventsBox.add_actor(box);
    }

    /**
     * Creates a stylized row for a single event.
     * Logic: A colored strip on the left, followed by summary and description.
     */
    private _addEventRow(ev: any) {
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

/**
 * HYBRID EXPORT SYSTEM
 * --------------------
 * Ensures compatibility between Cinnamon's internal module loader (AMD)
 * and the 'module: None' bundling approach used for the final applet.js.
 */
if (typeof exports !== 'undefined') {
    exports.EventListView = EventListView;
}
(global as any).EventListView = EventListView;
