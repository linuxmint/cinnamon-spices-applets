/**
 * Project IT Calendar - Event Manager Component
 * =============================================
 * 
 * This is the core data management layer of the calendar applet.
 * It handles all calendar event operations including:
 * - Synchronization with the system calendar (Evolution Data Server via Cinnamon CalendarServer)
 * - ICS file import and parsing
 * - Event creation, modification, and deletion
 * - In-memory event caching and filtering
 * 
 * IMPORTANT ARCHITECTURAL CONTEXT:
 * ---------------------------------
 * EventManager is a PURE DATA LAYER component:
 * - NO UI elements or visual rendering
 * - NO direct user interactions
 * - All communication is via signals/events
 * 
 * This strict separation ensures:
 * - Testability (data operations isolated from UI)
 * - Reusability (same data layer for different UIs)
 * - Maintainability (clear separation of concerns)
 * 
 * ------------------------------------------------------------------
 * SYSTEM INTEGRATION CHALLENGES:
 * ------------------------------------------------------------------
 * This component works around several Cinnamon/GJS limitations:
 * 
 * 1. Cinnamon CalendarServer (DBus):
 *    - READ-ONLY for event data retrieval
 *    - Cannot create or modify events
 *    - Limited description field support
 *    - Event IDs in "source:event" format
 * 
 * 2. Evolution Data Server (EDS) via libecal:
 *    - Required for write operations (create/modify/delete)
 *    - Complex API with GJS binding issues
 *    - Permission and source management complexity
 * 
 * 3. ICS Import Limitations:
 *    - Cinnamon CalendarServer doesn't support bulk imports
 *    - EDS write operations are source-dependent
 *    - Description fields often get lost in translation
 *    - Partial failure handling is complex
 * 
 * ------------------------------------------------------------------
 * DATA FLOW ARCHITECTURE:
 * ------------------------------------------------------------------
 * 
 * ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
 * │   UI Layer  │    │ EventManager │    │  Data Source │
 * │ (Calendar-  │◄──►│   (THIS)     │◄──►│   (EDS/ICS)  │
 * │   View)     │    │              │    │              │
 * └─────────────┘    └──────────────┘    └──────────────┘
 *        │                    │                    │
 *        │                    │                    │
 *        ▼                    ▼                    ▼
 *    Renders UI         Caches events        Persistent
 *    from events        Signals updates      storage
 * 
 * ------------------------------------------------------------------
 * CRITICAL DESIGN DECISIONS:
 * ------------------------------------------------------------------
 * 1. HYBRID MODULE SYSTEM:
 *    Uses 'export' for IDE/AMD support and 'global' assignment for monolithic 
 *    bundling. This ensures compatibility with both 'module: None' and 'module: AMD'.
 * 
 * 2. GJS SIGNALS INTEGRATION:
 *    Uses 'imports.signals' to add event-emitter capabilities. This allows the 
 *    View to react to 'events-updated' signals without tight coupling.
 * 
 * 3. ASYNCHRONOUS DBUS COMMUNICATION:
 *    Communicates with 'org.cinnamon.CalendarServer' via DBus. All calls are 
 *    handled asynchronously to keep the UI responsive.
 * 
 * 4. MODERN GJS STANDARDS:
 *    Uses TextDecoder or .toString() for data conversion instead of legacy 
 *    byte-array wrappers where possible.
 * 
 * ------------------------------------------------------------------
 * @author Arnold Schiller <calendar@projektit.de>
 * @link https://github.com/ArnoldSchiller/calendar
 * @link https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */
/**
 * @file EventManager.ts
 * @brief Core data management layer for calendar events
 * 
 * @details Handles all calendar event operations including synchronization
 * with Evolution Data Server, ICS import, and event caching.
 * 
 * @warning This component works around several Cinnamon/GJS limitations
 * including read-only CalendarServer and complex EDS write operations.
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2023-2026
 * @copyright GPL-3.0-or-later
 */

/**
 * interface EventData
 * @brief Internal representation of a calendar event
 * 
 * @note This structure is optimized for the applet's internal use
 * and may not map 1:1 with EDS/ICS representations.
 */


/* ================================================================
 * GJS / CINNAMON IMPORTS
 * ================================================================
 * 
 * These are native GNOME/Cinnamon APIs exposed to JavaScript via GJS.
 * 
 * IMPORTANT: These are NOT npm packages - they're provided by the
 * runtime environment (Cinnamon/GNOME Shell).
 */

const Gio = imports.gi.Gio;           // File I/O and DBus
const Cinnamon = imports.gi.Cinnamon; // Cinnamon-specific APIs
const GLib = imports.gi.GLib;         // Low-level utilities
const Signals = imports.signals;      // Event/signal system
const Mainloop = imports.mainloop;    // Timer and main loop
const ECal = imports.gi.ECal;         // Evolution Calendar library
const ICal = imports.gi.ICalGLib;     // iCalendar format handling
const EDataServer = imports.gi.EDataServer; // Evolution Data Server

/* ================================================================
 * TYPE DEFINITIONS
 * ================================================================
 * 
 * These interfaces define the data structures used throughout the
 * EventManager. They provide TypeScript type safety during development.
 */

/**
 * Internal representation of a calendar event.
 * 
 * Note: This structure is optimized for the applet's internal use
 * and may not map 1:1 with EDS/ICS representations.
 */
/* Event Data
    /** @brief Unique event identifier */
    /** @brief Calendar source identifier (EDS source UID) */
    /** @brief Event start time */
    /** @brief Event end time (for all-day: next day 00:00) */
    /** @brief Event title/summary */
    /** @brief Event description (optional) */
    /** @brief Calendar color in hex format */
    /** @brief All-day event flag */

/**
 * @class EventManager
 * @extends Signals.Signals
 * @brief Manages all calendar event operations
 * 
 * @details Primary responsibilities:
 * - DBus communication with Cinnamon.CalendarServer (read)
 * - EDS write operations via libecal (create/modify)
 * - Event caching and filtering
 * - ICS file import (experimental)
 * 
 * @note This is a PURE DATA LAYER component with no UI dependencies.
 */



export interface EventData {
    id: string;           // Unique event identifier
    sourceUid: string;    // Calendar source identifier (EDS source UID)
    start: Date;          // Event start time
    end: Date;            // Event end time (for all-day: next day 00:00)
    summary: string;      // Event title/description
    description?: string; // Detailed description (optional)
    color: string;        // Calendar color for visual distinction
    isFullDay: boolean;   // All-day event flag
}

/**
 * Date range for event filtering.
 */
export interface DateRange {
    from: Date;  // Start of range (inclusive)
    to: Date;    // End of range (exclusive)
}

/**
 * TypeScript interface merging for GJS signals.
 * 
 * This tells TypeScript that EventManager will have signal methods
 * (connect, disconnect, emit) added at runtime via Signals.addSignalMethods.
 */
export interface EventManager extends Signals.Signals {}

/* ================================================================
 * EVENT MANAGER CLASS
 * ================================================================
 * 
 * Main class handling all calendar event operations.
 * 
 * LIFECYCLE:
 * 1. Constructor: Initializes DBus connection and loads placeholder data
 * 2. Ready State: DBus proxy connected, ready for operations
 * 3. Active: Regular sync with system calendar (60-second intervals)
 * 4. Cleanup: Automatically handled by Cinnamon
 */

/**
 * @class EventManager
 * @brief Main event manager class
 * 
 * @details For detailed documentation see the main class documentation.
 */
/**
 * @class EventManager
 * @brief Main event manager class
 * 
 * @details For detailed documentation see the main class documentation.
 */
export class EventManager {
    /* ============================================================
     * PRIVATE PROPERTIES
     * ============================================================
     */
    
    /**
     * DBus proxy to Cinnamon.CalendarServer.
     * Used for READ-ONLY event retrieval.
     */
    private _server: any = null;
    
    /**
     * In-memory cache of calendar events.
     * Structure: Flat array of EventData objects, filtered on demand.
     */
    private _events: EventData[] = [];
    
    /**
     * Flag indicating if DBus connection is established.
     */
    private _isReady: boolean = false;
    
    /**
     * Currently selected date for quick access patterns.
     */
    private _selectedDate: Date;
    
    /**
     * Applet UUID for logging and identification.
     */
    private _uuid: string;
    
    /**
     * EDS source registry for write operations.
     * Null until first write operation is attempted.
     */
    private _registry: any | null = null;
    
    /**
     * Cache of ECal.Client connections by source UID.
     * Improves performance for multiple operations on same calendar.
     */
    private _clientCache = new Map<string, any>();

    /* ============================================================
     * CONSTRUCTOR
     * ============================================================
     * 
     * Initializes the EventManager with placeholder data and establishes
     * DBus connection to Cinnamon CalendarServer.
     * 
     * @param uuid - Unique identifier for logging (typically applet UUID)
     */

    constructor(uuid: string = "EventManager@default") {
        this._uuid = uuid;
        this._selectedDate = new Date();
        
        // Load placeholder data so UI is never empty
        this._loadInitialData();
        
        // Initialize DBus connection (async)
        this._initProxy();

        // Start periodic sync (every 60 seconds)
        Mainloop.timeout_add_seconds(60, () => {
            this.refresh();
            return true; // Keep timer active
        });
    }

    /* ============================================================
     * INITIALIZATION METHODS
     * ============================================================
     */

    /**
     * Loads placeholder data during startup.
     * 
     * IMPORTANT UX DECISION:
     * The UI should NEVER be empty, even during initial loading.
     * This placeholder gives users immediate visual feedback.
     */
    private _loadInitialData(): void {
        const today = new Date();
        this._events = [
            {
                id: "init-state",
                sourceUid: "Teststring",
                start: today,
                end: today,
                summary: "Calendar Manager Active",
                description: "Synchronizing with system calendar...",
                color: "#3498db",
                isFullDay: false
            }
        ];
    }

    /**
     * Initializes DBus proxy connection to Cinnamon CalendarServer.
     * 
     * This is the PRIMARY data source for READ operations.
     * The proxy provides:
     * - System calendar events (Evolution, Google Calendar, etc.)
     * - Real-time updates via DBus signals
     * - Filtered event retrieval by date range
     * 
     * LIMITATION: This proxy is READ-ONLY.
     */
    private _initProxy(): void {
        Cinnamon.CalendarServerProxy.new_for_bus(
            Gio.BusType.SESSION,
            Gio.DBusProxyFlags.NONE,
            "org.cinnamon.CalendarServer",
            "/org/cinnamon/CalendarServer",
            null,
            (obj, res) => {
                try {
                    this._server = Cinnamon.CalendarServerProxy.new_for_bus_finish(res);
                    
                    // Listen for server-side event changes
                    this._server.connect('events-added-or-updated', this._onEventsChanged.bind(this));
                    this._server.connect('events-removed', this._onEventsChanged.bind(this));
                    
                    this._isReady = true;
                    this.emit('manager-ready');
                    
                    // Initial data fetch for current month
                    this.refresh();
                } catch (e) {
                    if (typeof global !== 'undefined') {
                        global.logError(`${this._uuid}: DBus Connection Error: ${e}`);
                    }
                }
            }
        );
    }

    /* ============================================================
     * PUBLIC API - DATE SELECTION AND FILTERING
     * ============================================================
     */

    /**
     * Sets the currently selected date for quick access patterns.
     * 
     * @param date - Date to select
     */
    public selectDate(date: Date): void {
        this._selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    /**
     * Gets events for the currently selected date.
     * Convenience method for common UI pattern.
     */
    public getEventsForSelectedDate(): EventData[] {
        return this.getEventsForDate(this._selectedDate);
    }

    /**
     * Checks if any events exist for a specific date.
     * 
     * @param date - Date to check
     * @returns true if at least one event exists
     */
    public hasEvents(date: Date): boolean {
        return this.getEventsForDate(date).length > 0;
    }

    /* ============================================================
     * PUBLIC API - EVENT RETRIEVAL
     * ============================================================
     * 
     * All methods filter the in-memory event cache.
     * No DBus calls are made here - data is already cached.
     */

    /**
     * Gets all events for a specific date.
     * 
     * @param date - Target date
     * @returns Array of events occurring on this date
     */
    public getEventsForDate(date: Date): EventData[] {
        const from = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const to   = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        return this.getEventsForRange({ from, to });
    }

    /**
     * Gets all events for a specific month.
     * 
     * @param year - Year (e.g., 2026)
     * @param month - Month (0-11, JavaScript convention)
     * @returns Array of events in this month
     */
    public getEventsForMonth(year: number, month: number): EventData[] {
        const from = new Date(year, month, 1);
        const to   = new Date(year, month + 1, 0, 23, 59, 59);
        return this.getEventsForRange({ from, to });
    }

    /**
     * Gets all events for a specific year.
     * 
     * @param year - Year (e.g., 2026)
     * @returns Array of events in this year
     */
    public getEventsForYear(year: number): EventData[] {
        const from = new Date(year, 0, 1);
        const to   = new Date(year, 11, 31, 23, 59, 59);
        return this.getEventsForRange({ from, to });
    }

    /**
     * Gets events within a date range.
     * 
     * @param range - Date range (inclusive start, exclusive end)
     * @returns Array of events overlapping the range, sorted by start time
     */
    public getEventsForRange(range: DateRange): EventData[] {
        const from = range.from.getTime();
        const to   = range.to.getTime();

        return this._events
            .filter(ev => {
                    const start = ev.start.getTime();
                    const end   = ev.end.getTime();
                    return end >= from && start <= to;
            })
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    /* ============================================================
     * PUBLIC API - DATA SYNCHRONIZATION
     * ============================================================
     */

    /**
     * Fetches events for a specific date range from the server.
     * 
     * This tells Cinnamon CalendarServer which time window we're interested in.
     * The server will send events via DBus signals.
     * 
     * @param start - Start of range
     * @param end - End of range
     */
    public fetchRange(start: Date, end: Date): void {
        if (!this._server) return;
        let startUnix = Math.floor(start.getTime() / 1000);
        let endUnix = Math.floor(end.getTime() / 1000);

        this._server.call_set_time_range(startUnix, endUnix, true, null, (server, res) => {
            try { 
                this._server.call_set_time_range_finish(res); 
            } catch (e) {
                // Ignore errors during applet shutdown
            }
        });
    }

    /**
     * Refreshes the event cache for a 9-month window around current date.
     * 
     * Window: 2 months back, current month, 6 months forward
     * This provides smooth scrolling experience.
     */
    public refresh(): void {
        if (!this._server) return;
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 7, 0);
        this.fetchRange(start, end);
    }

    /* ============================================================
     * DBUS EVENT HANDLING
     * ============================================================
     */

    /**
     * Callback for DBus event updates.
     * 
     * Converts raw DBus data to internal EventData format and updates cache.
     * Emits 'events-updated' signal to notify UI components.
     * 
     * @param server - DBus proxy (unused)
     * @param varray - DBus variant array containing event data
     */
    private _onEventsChanged(server: any, varray: any): void {
        const rawEvents = varray.unpack();
        this._events = rawEvents.map((e: any) => {
            const [fullId, color, summary, allDay, start, end] = e.deep_unpack();
            
            let sourceUid = "";
            let eventId = fullId;
            
            // Parse "source:event" ID format
            if (fullId.includes(':')) {
                const parts = fullId.split(':');
                sourceUid = parts[0];
                eventId = parts.slice(1).join(':');
            }

            return {
                id: eventId,
                sourceUid: sourceUid,
                summary: summary,
                color: color,
                start: new Date(start * 1000),
                end: new Date(end * 1000),
                isFullDay: allDay
            };
        });
        this.emit('events-updated');
    }

    /* ============================================================
     * ICS IMPORT FUNCTIONALITY
     * ============================================================
     * 
     * WARNING: This feature has significant limitations:
     * 
     * 1. Cinnamon CalendarServer doesn't support bulk ICS import
     * 2. EDS write operations are source-dependent and may fail
     * 3. Description fields often get lost between ICS and EDS
     * 4. No rollback for partial import failures
     * 
     * This is provided as EXPERIMENTAL functionality only.
     */

    /**
     * Imports events from an ICS file.
     * 
     * @param icsPath - Path to .ics file
     * @param color - Color for imported events (default: "#ff6b6b")
     * @returns Promise that resolves when import completes
     */
    public async importICSFile(icsPath: string, color: string = "#ff6b6b"): Promise<void> {
        if (!this._server) {
            global.logError(this._uuid + ": CalendarServer not ready for ICS-Import");
            return;
        }

        try {
            const file = Gio.File.new_for_path(icsPath);
            const [ok, contents] = await new Promise<[boolean, Uint8Array]>(resolve => {
                file.load_contents_async(null, (f, res) => {
                    try {
                        const [success, data] = f!.load_contents_finish(res);
                        resolve([success, data]);
                    } catch (e) {
                        resolve([false, new Uint8Array()]);
                    }
                });
            });

            if (!ok) throw new Error("Can't read ICS file.");
            const icsText = contents.toString(); 

            // Extract VEVENT blocks from ICS file
            const veventMatches = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
            if (!veventMatches) return;

            let importedCount = 0;
            for (const veventBlock of veventMatches) {
                try {
                    const summary = (veventBlock.match(/SUMMARY:(.*)/i)?.[1] || 'Unnamed').trim();
                    const description = (veventBlock.match(/DESCRIPTION:(.*)/i)?.[1] || '').trim();
                    const dtstartMatch = veventBlock.match(/DTSTART(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                    const dtendMatch = veventBlock.match(/DTEND(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
            
                    if (!dtstartMatch) continue;
            
                    const startStr = dtstartMatch[1].trim();
                    const endStr = dtendMatch ? dtendMatch[1].trim() : startStr;

                    const start = this._parseICSDate(startStr);
                    const end = this._parseICSDate(endStr);
                    const allDay = startStr.length === 8; 
            
                    const eventToImport: EventData = {
                        id: "", 
                        sourceUid: "", 
                        summary: summary,
                        description: description,
                        start: start,
                        end: end,
                        isFullDay: allDay,
                        color: "#3498db"
                    };
            
                    this.addEvent(eventToImport);
                    importedCount++;
                } catch (e) {
                    global.logError(this._uuid + ": VEVENT parsing error: " + e);
                }
            }
            global.log(this._uuid + `: ${importedCount} Events imported from ${icsPath}`);
        } catch (e) {
            global.logError(this._uuid + `: ICS Import Error ${icsPath}: ${e}`);
        }
    }

    /**
     * Parses ICS date strings into JavaScript Date objects.
     * 
     * Supports both:
     * - Basic format: 20231231 (all-day events)
     * - Extended format: 20231231T120000Z (timed events)
     * 
     * @param icsDate - ICS date string
     * @returns JavaScript Date object
     */
    private _parseICSDate(icsDate: string): Date {
        if (icsDate.length === 8) {
            // Basic format: YYYYMMDD
            return new Date(
                parseInt(icsDate.substr(0,4)),
                parseInt(icsDate.substr(4,2))-1,
                parseInt(icsDate.substr(6,2))
            );
        }
        // Extended format: YYYYMMDDTHHMMSSZ
        return new Date(icsDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/, '$1-$2-$3T$4:$5:$6$7'));
    }

    /* ============================================================
     * EVENT CREATION AND MODIFICATION
     * ============================================================
     * 
     * IMPORTANT ARCHITECTURAL NOTE:
     * 
     * Cinnamon CalendarServer (DBus) is READ-ONLY for event data.
     * To support event creation/modification, we must use:
     * 
     * 1. Evolution Data Server (EDS) via libecal
     * 2. Direct GObject Introspection (GIR) bindings
     * 3. iCalendar (RFC 5545) component manipulation
     * 
     * This bypasses Cinnamon's limited API but introduces complexity
     * and potential compatibility issues across GNOME/Cinnamon versions.
     */

    /**
     * Public entry point for adding or updating events.
     * 
     * Decides whether to create new event or modify existing one.
     * 
     * @param ev - Event data
     */
    public addEvent(ev: EventData): void {
        if (ev.id && ev.sourceUid) {
            // Existing event - modify via EDS
            this._modifyExistingEvent(ev);
        } else {
            // New event - create via EDS
            this._createNewEvent(ev);
        }
    }

    /**
     * Creates a new event in Evolution Data Server.
     * 
     * @param ev - Event data
     */
    private _createNewEvent(ev: EventData): void {
        const source = this._getDefaultWritableSource();
        if (!source) {
            global.logError("Create: No writable calendar source found");
            return;
        }

        // Create iCalendar component
        const comp = ECal.Component.new();
        comp.set_new_vtype(ECal.ComponentVType.EVENT);

        // UID is REQUIRED for iCalendar compliance
        comp.set_uid(ev.id || GLib.uuid_string_random());

        // Set summary (title)
        const summaryText = ECal.ComponentText.new(
            ev.summary || "New Event",
            null
        );
        comp.set_summary(summaryText);

        // Set description (optional)
        if (ev.description && ev.description.trim() !== "") {
            const descText = ECal.ComponentText.new(ev.description, null);
            comp.set_description(descText);
        }

        // Set times
        const tz = ICal.Timezone.get_utc_timezone();
        const start = ICal.Time.new_from_timet_with_zone(
            Math.floor(ev.start.getTime() / 1000),
            0,
            tz
        );
        const end = ICal.Time.new_from_timet_with_zone(
            Math.floor(ev.end.getTime() / 1000),
            0,
            tz
        );
        comp.set_dtstart(start);
        comp.set_dtend(end);

        // Connect to EDS and create event
        ECal.Client.connect(
            source,
            ECal.ClientSourceType.EVENTS,
            30,
            null,
            (_o, res) => {
                try {
                    const client = ECal.Client.connect_finish(res);

                    client.create_object(comp, null, null, (_c, cres) => {
                        try {
                            client.create_object_finish(cres);
                            global.log("✅ CREATE OK");
                            this.refresh();
                        } catch (e) {
                            global.logError("❌ create_object_finish failed: " + e);
                        }
                    });
                } catch (e) {
                    global.logError("❌ EDS connection failed: " + e);
                }
            }
        );
    }

    /**
     * Modifies an existing event in Evolution Data Server.
     * 
     * Uses "smart merge" to preserve fields not being modified.
     * 
     * @param ev - Updated event data
     */
    private _modifyExistingEvent(ev: EventData): void {
        const source = this._resolveSource(ev.sourceUid);
        if (!source) return;

        ECal.Client.connect(source, ECal.ClientSourceType.EVENTS, 30, null, (_obj, res) => {
            try {
                const client = ECal.Client.connect_finish(res);

                if (ev.id && ev.id !== "" && !ev.id.startsWith("ics_")) {
                    // Fetch existing event for smart merge
                    client.get_object(ev.id, null, null, (_obj2: any, getRes: any) => {
                        try {
                            const result = client.get_object_finish(getRes);
                            const icalComp = Array.isArray(result) ? result[1] : result;

                            if (icalComp) {
                                let anyChange = false;

                                // 1. SUMMARY - only update if changed and not empty
                                const oldSummary = icalComp.get_summary() || "";
                                if (ev.summary && ev.summary.trim() !== "" && ev.summary !== oldSummary) {
                                    icalComp.set_summary(ev.summary);
                                    anyChange = true;
                                    global.log(`${this._uuid}: Update Summary`);
                                }

                                // 2. DESCRIPTION - only update if changed and not empty
                                const oldDesc = icalComp.get_description() || "";
                                if (ev.description && ev.description.trim() !== "" && ev.description !== oldDesc) {
                                    icalComp.set_description(ev.description);
                                    anyChange = true;
                                    global.log(`${this._uuid}: Update Description`);
                                }
                                
                                // 3. TIMES - preserve duration when changing start time
                                try {
                                    const oldStartComp = icalComp.get_dtstart();
                                    const oldEndComp = icalComp.get_dtend();
                                        
                                    if (oldStartComp && oldEndComp) {
                                        const oldStartTimeObj = (typeof oldStartComp.get_value === 'function') ? oldStartComp.get_value() : oldStartComp;
                                        const oldEndTimeObj = (typeof oldEndComp.get_value === 'function') ? oldEndComp.get_value() : oldEndComp;
                
                                        const newStartSeconds = Math.floor(ev.start.getTime() / 1000);
                
                                        if (oldStartTimeObj.as_timet() !== newStartSeconds) {
                                            // Start time changed - preserve original duration
                                            const durationSeconds = oldEndTimeObj.as_timet() - oldStartTimeObj.as_timet();
                    
                                            // Create new start time
                                            const tz = ICal.Timezone.get_utc_timezone();
                                            let newStart = ICal.Time.new_from_timet_with_zone(newStartSeconds, 0, tz);
                                            if (ev.isFullDay) newStart.set_is_date(true);
                    
                                            // Calculate new end time preserving duration
                                            let newEnd = ICal.Time.new_from_timet_with_zone(newStartSeconds + durationSeconds, 0, tz);
                                            if (ev.isFullDay) newEnd.set_is_date(true);

                                            icalComp.set_dtstart(newStart);
                                            icalComp.set_dtend(newEnd);
                    
                                            anyChange = true;
                                            global.log(`${this._uuid}: Update Times (preserved ${durationSeconds/3600}h duration)`);
                                        }
                                    }
                                } catch (e) {
                                    global.logWarning(`${this._uuid}: Time merge failed: ${e}`);
                                }

                                // 4. Save changes if any were made
                                if (anyChange) {
                                    client.modify_object(icalComp, ECal.ObjModType.THIS, 0, null, (_c: any, mRes: any) => {
                                        try {
                                            client.modify_object_finish(mRes);
                                            global.log(`${this._uuid}: Smart merge successful`);
                                            this.refresh();
                                        } catch (err) { 
                                            global.logError("Modify finish failed: " + err); 
                                        }
                                    });
                                } else {
                                    global.log(`${this._uuid}: No changes needed - master data unchanged`);
                                }
                            }
                        } catch (e) {
                            // Event not found - create as new
                            global.logWarning(`${this._uuid}: Smart merge failed (ID not found), creating new: ${e}`);
    
                            // Build component for new event
                            let fallbackComp = ECal.Component.new();
                            fallbackComp.set_new_vtype(ECal.ComponentVType.EVENT);
                            fallbackComp.set_uid(ev.id || GLib.uuid_string_random());
    
                            this._createAsNew(client, ev, fallbackComp);
                        }
                    });
                } else {
                    // Invalid ID - create as new event
                    this._createNewEvent(ev);
                }
            } catch (e) {
                global.logError("EDS connection failed: " + e);
            }
        });
    }

    /* ============================================================
     * EDS SOURCE MANAGEMENT
     * ============================================================
     * 
     * Evolution Data Server uses a hierarchical source system:
     * - Each calendar (Google, Local, Exchange) is a "source"
     * - Sources can be read-only or writable
     * - Some sources are aggregates (like "Personal" which may include multiple)
     */

    /**
     * Resolves an EDS source by UID.
     * 
     * @param sUid - Source UID (optional)
     * @returns EDS source or null if not found/not writable
     */
    private _resolveSource(sUid?: string): any {
        if (!this._registry) {
            this._registry = EDataServer.SourceRegistry.new_sync(null);
        }

        if (sUid) {
            try { 
                let s = this._registry.ref_source(sUid); 
                if (s) return s;
            } catch (e) {}
        }

        const sources = this._registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR);
        
        // 1. Prefer sources with specific names
        let bestSource = sources.find((s: any) => {
            try {
                const ext = s.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR);
                // Check if writable
                const ro = (typeof ext.get_readonly === 'function') ? ext.get_readonly() : ext.readonly;
                if (ro === true) return false;

                const name = s.get_display_name().toLowerCase();
                return name.includes("system") || name.includes("personal") || name.includes("local");
            } catch(e) { return false; }
        });

        if (bestSource) return bestSource;

        // 2. Fallback: any writable source
        return sources.find((s: any) => {
            try {
                const ext = s.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR);
                const ro = (typeof ext.get_readonly === 'function') ? ext.get_readonly() : ext.readonly;
                return ro !== true;
            } catch(e) { return false; }
        });
    }

    /**
     * Finds a default writable calendar source.
     * 
     * CRITICAL: Must have a parent source (not a top-level aggregate).
     * Some aggregate sources appear writable but fail on write operations.
     */
    private _getDefaultWritableSource(): any {
        if (!this._registry) {
            this._registry = EDataServer.SourceRegistry.new_sync(null);
        }

        const sources = this._registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR);

        return sources.find((s: any) => {
            try {
                const ext = s.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR);
                if (ext.get_readonly && ext.get_readonly()) return false;

                // Must have a parent (exclude top-level aggregates)
                return s.get_parent() !== null;
            } catch {
                return false;
            }
        });
    }

    /* ============================================================
     * HELPER METHODS
     * ============================================================
     */

    /**
     * Applies event data to an iCalendar component.
     * 
     * @param ecalComp - ECal component to modify
     * @param ev - Event data to apply
     */
    private _applyEventToComponent(ecalComp: any, ev: EventData): void {
        // Get underlying iCalendar component
        const ical = ecalComp.get_icalcomponent();

        // Set UID (required)
        ical.set_uid(ev.id);

        // Set timestamp (current time)
        ical.set_dtstamp(
            ICal.Time.new_current_with_zone(
                ICal.Timezone.get_utc_timezone()
            )
        );

        // Set summary/title
        if (ev.summary) {
            const sumProp = ICal.Property.new_summary(ev.summary);
            ical.add_property(sumProp);
        }

        // Set description
        if (ev.description && ev.description.trim() !== "") {
            const descProp = ICal.Property.new_description(ev.description);
            ical.add_property(descProp);
        }

        // Set times
        const tz = ICal.Timezone.get_utc_timezone();
    
        let start: any;
        let end: any;
    
        if (ev.isFullDay) {
            // All-day events use DATE format (no time component)
            start = ICal.Time.new_null_time();
            start.set_date(
                ev.start.getFullYear(),
                ev.start.getMonth() + 1,
                ev.start.getDate()
            );
            start.set_is_date(true);
    
            end = ICal.Time.new_null_time();
            const endDate = new Date(ev.end);
            if (endDate.getTime() <= ev.start.getTime()) {
                endDate.setDate(ev.start.getDate() + 1);
            }
            end.set_date(
                endDate.getFullYear(),
                endDate.getMonth() + 1,
                endDate.getDate()
            );
            end.set_is_date(true);
        } else {
            // Timed events
            start = ICal.Time.new_from_timet_with_zone(
                Math.floor(ev.start.getTime() / 1000), 0, tz
            );
            end = ICal.Time.new_from_timet_with_zone(
                Math.floor(ev.end.getTime() / 1000), 0, tz
            );
        }

        ical.set_dtstart(start);
        ical.set_dtend(end);
    }

    /**
     * Creates a new event in EDS (fallback method).
     * 
     * @param client - ECal.Client connection
     * @param ev - Event data
     * @param icalComp - iCalendar component (optional)
     */
    private _createAsNew(client: any, ev: EventData, icalComp: any): void {
        try {
            // Use provided component or create new one
            let comp = icalComp;
            if (!comp) {
                comp = this._buildIcalComponent(ev);
            } else {
                // Ensure component has latest data
                this._applyEventToComponent(comp, ev);
            }

            // Save to EDS (4 arguments required by GJS bindings)
            client.create_object(comp, null, null, (_obj: any, res: any) => {
                try {
                    client.create_object_finish(res);
                    global.log(`${this._uuid}: Event successfully created`);
                    this.refresh();
                } catch (e) {
                    global.logError(`${this._uuid}: create_object_finish failed: ${e}`);
                }
            });
        } catch (e) {
            global.logError(`${this._uuid}: _createAsNew failed: ${e}`);
        }
    }

    /**
     * Factory method to build an iCalendar component from event data.
     * 
     * @param ev - Event data
     * @returns ECal.Component ready for EDS storage
     */
    private _buildIcalComponent(ev: EventData): any {
        const icalComp = ECal.Component.new();
        icalComp.set_new_vtype(ECal.ComponentVType.EVENT);
        icalComp.set_uid(ev.id || GLib.uuid_string_random());
    
        // Apply all event data
        this._applyEventToComponent(icalComp, ev);

        return icalComp;
    }
}

/* ================================================================
 * GJS SIGNAL SYSTEM INTEGRATION
 * ================================================================
 * 
 * Injects signal methods (connect, disconnect, emit) into EventManager prototype.
 * This enables the observer pattern used throughout the applet.
 */
Signals.addSignalMethods(EventManager.prototype);

/* ================================================================
 * HYBRID EXPORT SYSTEM
 * ================================================================
 * 
 * Dual export pattern required for Cinnamon applet environment:
 * 
 * 1. CommonJS export: For TypeScript/development tools
 * 2. Global export: For Cinnamon runtime (no module system)
 */

/* ----------------------------------------------------------------
 * CommonJS Export (Development & TypeScript)
 * ----------------------------------------------------------------
 */
if (typeof exports !== 'undefined') {
    exports.EventManager = EventManager;
}

/* ----------------------------------------------------------------
 * Global Export (Cinnamon Runtime)
 * ----------------------------------------------------------------
 */
(global as any).EventManager = EventManager;

/* ================================================================
 * TODOs AND FUTURE ENHANCEMENTS
 * ================================================================
 * 
 * TODO: Implement event deletion functionality
 * TODO: Add support for recurring event patterns
 * TODO: Improve ICS import with conflict resolution
 * TODO: Add event search/filter capabilities
 * TODO: Implement calendar source selection UI
 * TODO: Add support for event categories/tags
 * TODO: Improve error handling for EDS write operations
 * TODO: Add support for event attachments
 * TODO: Implement event export functionality
 */
