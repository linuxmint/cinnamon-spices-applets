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

// GJS Imports - Accessing native system APIs
const Gio = imports.gi.Gio;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Mainloop = imports.mainloop;

/**
 * EventData Interface
 * Defines the internal representation of a calendar event.
 */
export interface EventData {
    id: string;
    date: Date;
    summary: string;
    description?: string;
    color: string;
    isFullDay: boolean;
}

/**
 * EventManager Interface for Signals
 * This allows TypeScript to recognize the .connect() and .emit() methods 
 * added via Signals.addSignalMethods.
 */
export interface EventManager extends Signals.Signals {}

export class EventManager {
    private _server: any = null;
    private _events: EventData[] = [];
    private _isReady: boolean = false;
    private _selectedDate: Date;
    private _uuid: string;

    /**
     * @param uuid - The unique identifier of the applet for logging purposes.
     */
    constructor(uuid: string = "EventManager@default") {
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
    private _loadInitialData(): void {
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
                    
                    // Listen for server-side updates (e.g., user adds event in Evolution)
                    this._server.connect('events-added-or-updated', this._onEventsChanged.bind(this));
                    this._server.connect('events-removed', this._onEventsChanged.bind(this));
                    
                    this._isReady = true;
                    this.emit('manager-ready');
                    
                    // Initial fetch for the current month view
                    this.refresh();
                } catch (e) {
                    if (typeof global !== 'undefined') {
                        global.logError(`${this._uuid}: DBus Connection Error: ${e}`);
                    }
                }
            }
        );
    }

    public selectDate(date: Date): void {
        this._selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    public getEventsForSelectedDate(): EventData[] {
        return this.getEventsForDate(this._selectedDate);
    }

    public hasEvents(date: Date): boolean {
        return this.getEventsForDate(date).length > 0;
    }

    /**
     * Fetches events for a specific Unix timestamp range from the server.
     */
    public fetchRange(start: Date, end: Date): void {
        if (!this._server) return;
        let startUnix = Math.floor(start.getTime() / 1000);
        let endUnix = Math.floor(end.getTime() / 1000);

        // Tell the server which time window we are interested in
        this._server.call_set_time_range(startUnix, endUnix, true, null, (server, res) => {
            try { 
                this._server.call_set_time_range_finish(res); 
            } catch (e) {
                // Ignore finish errors if the applet is closing
            }
        });
    }

    /**
     * Refreshes the event cache by requesting data for a 9-month window.
     */
    public refresh(): void {
        if (!this._server) return;
        const now = new Date();
        // Window: 2 months back, 7 months ahead
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 7, 0);
        this.fetchRange(start, end);
    }

    /**
     * Callback triggered by DBus when the calendar server emits new data.
     */
    private _onEventsChanged(server: any, varray: any): void {
        const rawEvents = varray.unpack();
        this._events = rawEvents.map((e: any) => {
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
    public getEventsForDate(date: Date): EventData[] {
        return this._events.filter(e => 
            e.date.getDate() === date.getDate() &&
            e.date.getMonth() === date.getMonth() &&
            e.date.getFullYear() === date.getFullYear()
        );
    }

    /**
     * ICS IMPORT LOGIC
     * Parses a local .ics file and pushes events to the system calendar via DBus.
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

            // Convert Uint8Array to string (Standard GJS/Cinnamon way)
            const icsText = contents.toString(); 

            // Simple Regex based VEVENT extraction
            const veventMatches = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
            if (!veventMatches) return;

            let importedCount = 0;
            for (const veventBlock of veventMatches) {
                try {
                    const summary = (veventBlock.match(/SUMMARY:(.*)/i)?.[1] || 'Unnamed').trim();
                    const dtstartMatch = veventBlock.match(/DTSTART(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                    const dtendMatch = veventBlock.match(/DTEND(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);

                    if (!dtstartMatch) continue;

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
                    this._server.call_add_event(
                        eventId, color, summary, allDay, startUnix, endUnix,
                        null,
                        (server: any, res: any) => {
                            try {
                                server.call_add_event_finish(res);
                                global.log(this._uuid + `: "${summary}" imported successfully`);
                            } catch (e) {
                                global.logError(this._uuid + `: Event import failed: ${e}`);
                            }
                        }
                    );
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
     * Parses ICS Date strings (YYYYMMDD or YYYYMMDDTHHMMSS[Z])
     */
    private _parseICSDate(icsDate: string): Date {
        if (icsDate.length === 8) {
            // Format: YYYYMMDD
            return new Date(
                parseInt(icsDate.substr(0,4)),
                parseInt(icsDate.substr(4,2))-1, // Month is 0-indexed
                parseInt(icsDate.substr(6,2))
            );
        }
        // Format with time: YYYYMMDDTHHMMSS
        return new Date(icsDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/, '$1-$2-$3T$4:$5:$6$7'));
    }
}

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
(global as any).EventManager = EventManager;
