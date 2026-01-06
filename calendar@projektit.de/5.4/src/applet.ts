/**
 * Universal Calendar Applet Core
 * ==============================
 * 
 * This is the main entry point for the Cinnamon Calendar Applet.
 * It orchestrates all components and manages the complete UI lifecycle.
 * 
 * IMPORTANT: This file is COMPLETELY DIFFERENT from the simplified
 * documentation version previously created. This is the ACTUAL production code.
 * 
 * ------------------------------------------------------------------
 * ARCHITECTURE OVERVIEW:
 * ------------------------------------------------------------------
 * This applet follows a composite MVC architecture:
 * 
 * 1. MODEL LAYER:
 *    - EventManager: Fetches calendar data from Evolution Data Server (EDS)
 *    - CalendarLogic: Calculates dates, holidays, and business logic
 * 
 * 2. VIEW LAYER:
 *    - CalendarView: Main calendar grid (month/year/day views)
 *    - EventListView: Sidebar event list with scrollable agenda
 *    - Header/Footer: Additional UI components for navigation
 * 
 * 3. CONTROLLER LAYER:
 *    - This class (UniversalCalendarApplet): Coordinates everything
 *    - Settings system, hotkeys, UI layout, signal routing
 * 
 * ------------------------------------------------------------------
 * VISUAL LAYOUT STRUCTURE:
 * ------------------------------------------------------------------
 * The applet uses a sophisticated two-column layout:
 * 
 * ┌─────────────────────────────────────────────────────────────┐
 * │ [Event List View]      │ [Calendar View + Header + Footer]  │
 * │ (Left Column)          │ (Right Column)                     │
 * │ • Scrollable event list│ • Date header                      │
 * │ • Clickable events     │ • Month grid                       │
 * │ • Date navigation      │ • Year view                        │
 * │                        │ • Day details                      │
 * │                        │ • Footer buttons                   │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @link https://github.com/ArnoldSchiller/calendar
 * @link https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */
/**
 * @file applet.ts
 * @brief Main entry point for the Cinnamon Calendar Applet
 * 
 * @details This file implements the UniversalCalendarApplet class which acts as the 
 * central controller in the MVC architecture. It orchestrates all components and 
 * manages the complete UI lifecycle.
 * 
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2026
 * @copyright GPL-3.0-or-later
 * 
 * @see CalendarView
 * @see EventManager
 * @see CalendarLogic
 * @see EventListView
 */

/* ================================================================
 * CINNAMON / GJS IMPORTS
 * ================================================================
 * 
 * GJS (GNOME JavaScript) provides bindings to Cinnamon's native APIs.
 * These are NOT npm packages - they're loaded at runtime by Cinnamon.
 */

const GLib = imports.gi.GLib;       // Low-level GLib utilities (timers, file ops)
const St = imports.gi.St;           // Shell Toolkit (UI widgets)
const Applet = imports.ui.applet;   // Base applet classes
const PopupMenu = imports.ui.popupMenu; // Popup menu system
const Settings = imports.ui.settings;   // User settings persistence
const Main = imports.ui.main;       // Main Cinnamon UI manager
const Util = imports.misc.util;     // Utility functions (spawn commands)
const FileUtils = imports.misc.fileUtils; // File system utilities
const Gettext = imports.gettext;    // Internationalization (i18n)
const Gtk = imports.gi.Gtk;         // GTK for file dialogs (ICS import)
const Gio = imports.gi.Gio;         // GIO for file operations

/* ================================================================
 * MODULE IMPORTS (TypeScript/ES6 style)
 * ================================================================
 * 
 * These are local project modules. During TypeScript compilation,
 * they're bundled together. At runtime, they're available globally.
 */

import { EventManager } from './EventManager';
import { EventListView } from './EventListView';
import { CalendarLogic } from './CalendarLogic';

/* ================================================================
 * INTERNATIONALIZATION (i18n) SETUP
 * ================================================================
 * 
 * Cinnamon applets use Gettext for translations. This system:
 * 1. Looks for translations in the applet's locale/ directory
 * 2. Falls back to Cinnamon's system translations
 * 3. Falls back to GNOME Calendar translations
 * 
 * This maximizes translation coverage with minimal effort.
 */

/**
 * Global translation function.
 * Must be initialized by setupLocalization() before use.
 */
let _: (str: string) => string;

/**
 * Initializes the translation system for this applet instance.
 * 
 * @param uuid - Unique identifier of the applet (e.g., "calendar@projektit.de")
 * @param path - Filesystem path to the applet directory
 */
function setupLocalization(uuid: string, path: string) {
    // Bind the applet's translation domain
    Gettext.bindtextdomain(uuid, path + "/locale");
    
    // Create translation function with fallback chain
    _ = function(str: string) {
        // 1. Try applet-specific translations
        let custom = Gettext.dgettext(uuid, str);
        if (custom !== str) return custom;
        
        // 2. Try Cinnamon core translations
        let cinnamon = Gettext.dgettext("cinnamon", str);
        if (cinnamon !== str) return cinnamon;
        
        // 3. Fall back to GNOME Calendar translations
        return Gettext.dgettext("gnome-calendar", str);
    };
}

/* ================================================================
 * MAIN APPLET CLASS
 * ================================================================
 * 
 * This is the central controller class that Cinnamon instantiates.
 * One instance exists for each panel placement of the applet.
 * 
 * Extends TextIconApplet which supports both text label and icon
 * in the Cinnamon panel.
 */
/**
 * @class UniversalCalendarApplet
 * @extends Applet.TextIconApplet
 * @brief Main applet controller class
 *
 * @details This class is instantiated by Cinnamon when the applet is loaded.
 * It handles:
 * - Component initialization and wiring
 * - Settings management
 * - UI layout assembly
 * - Signal routing between components
 * - Hotkey and panel integration
 */

class UniversalCalendarApplet extends Applet.TextIconApplet {
    /* ============================================================
     * PUBLIC PROPERTIES (Accessed by other components)
     * ============================================================
     */
    
    /**
     * Reference to the main calendar grid UI component.
     * CalendarView is loaded dynamically at runtime.
     */
    public CalendarView: any;
    
    /**
     * Manages all calendar event data (fetching, filtering, caching).
     * Connected to Evolution Data Server (EDS) via DBus.
     */
    public eventManager: EventManager;
    
    /**
     * Displays events in a list/agenda format (left sidebar).
     */
    public eventListView: EventListView;
    
    /**
     * Pure business logic for date calculations and holiday detection.
     * No UI dependencies, no I/O operations.
     */
    public CalendarLogic: CalendarLogic;
    
    /**
     * The popup menu that contains the entire calendar UI.
     * TypeScript declaration - actual initialization is in constructor.
     */
    declare public menu: any;

    /* ============================================================
     * PRIVATE PROPERTIES (Internal implementation)
     * ============================================================
     */
    
    /**
     * Manages the popup menu lifecycle and state.
     */
    private menuManager: any;
    
    /**
     * Handles persistence of user settings (panel icon, formats, etc.).
     */
    private settings: any;
    
    /**
     * ID of the periodic update timer. Used for cleanup.
     */
    private _updateId: number = 0;
    
    /**
     * Unique identifier for this applet instance.
     * Used for settings keys and hotkey registration.
     */
    private uuid: string;

    /* ============================================================
     * UI ELEMENTS (Header Section)
     * ============================================================
     * 
     * The header displays current date information and acts as a
     * "home" button to return to today's date.
     */
    
    /**
     * Main vertical container for the entire popup UI.
     */
    private _mainBox: any;
    
    /**
     * Horizontal layout bridge that holds left (events) and right (calendar) columns.
     */
    private _contentLayout: any;
    
    /**
     * Day of week label (e.g., "Monday").
     */
    private _dayLabel: any;
    
    /**
     * Date label (e.g., "1. January 2026").
     */
    private _dateLabel: any;
    
    /**
     * Holiday label (shows holiday names when applicable).
     */
    private _holidayLabel: any;

    /* ============================================================
     * SETTINGS PROPERTIES (Bound to UI settings)
     * ============================================================
     * 
     * These properties are automatically synchronized with the
     * Cinnamon settings system via bind() calls.
     */
    
    /**
     * Whether to show the calendar icon in the panel.
     */
    public showIcon: boolean = false;
    
    /**
     * Whether to show the event list sidebar.
     */
    public showEvents: boolean = true;
    
    /**
     * Whether to display ISO week numbers in the month grid.
     */
    public showWeekNumbers: boolean = false;
    
    /**
     * Whether to use custom date/time formats.
     */
    public useCustomFormat: boolean = false;
    
    /**
     * Custom format string for panel label (uses GLib.DateTime format).
     */
    public customFormat: string = "";
    
    /**
     * Custom format string for panel tooltip.
     */
    public customTooltipFormat: string = "";
    
    /**
     * Global hotkey to open the calendar popup.
     */
    public keyOpen: string = "";

    /* ============================================================
     * CONSTRUCTOR
     * ============================================================
     * 
     * Called by Cinnamon when the applet is loaded into the panel.
     * Initializes ALL components and builds the complete UI hierarchy.
     * 
     * The constructor is organized in clear phases:
     * 1. Backend initialization (settings, managers, logic)
     * 2. UI construction (layout, components, wiring)
     * 3. Signal connections and final setup
     */
     /**
     * @brief Constructs the UniversalCalendarApplet
     * 
     * @param metadata Applet metadata from Cinnamon
     * @param orientation Panel orientation (horizontal/vertical)
     * @param panelHeight Height of the panel in pixels
     * @param instanceId Unique instance identifier
     * 
     * @note Called automatically by Cinnamon when the applet is loaded.
     * The constructor is organized in clear phases:
     * 1. Backend initialization
     * 2. UI construction
     * 3. Signal connections
     */

    constructor(metadata: any, orientation: any, panel_height: number, instance_id: number) {
        // Call parent constructor (TextIconApplet)
        super(orientation, panel_height, instance_id);
        
        // Store applet identifier for settings and hotkeys
        this.uuid = metadata.uuid;
        
        // Initialize translation system
        setupLocalization(this.uuid, metadata.path);

        try {
            /* ====================================================
             * PHASE 1: BACKEND INITIALIZATION
             * ==================================================== */
            
            // 1.1 Settings system - persists user preferences
            this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
            
            // 1.2 Menu manager - handles popup menu lifecycle
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            
            // 1.3 Core business components
            this.eventManager = new EventManager();
            this.eventListView = new EventListView();
            this.CalendarLogic = new CalendarLogic(metadata.path);

            // 1.4 Dynamic component loading
            // CalendarView is loaded from a separate file at runtime
            const CalendarModule = FileUtils.requireModule(metadata.path + '/CalendarView');

            /* ====================================================
             * PHASE 2: SETTINGS BINDING
             * ====================================================
             * 
             * Connect settings UI to internal properties.
             * When a setting changes, the corresponding callback is triggered.
             */
            
            this.settings.bind("show-icon", "showIcon", this.on_settings_changed);
            this.settings.bind("show-events", "showEvents", this.on_settings_changed);
            this.settings.bind("show-week-numbers", "showWeekNumbers", this.on_settings_changed);
            this.settings.bind("use-custom-format", "useCustomFormat", this.on_settings_changed);
            this.settings.bind("custom-format", "customFormat", this.on_settings_changed);
            this.settings.bind("custom-tooltip-format", "customTooltipFormat", this.on_settings_changed);
            this.settings.bind("keyOpen", "keyOpen", this.on_hotkey_changed);

            /* ====================================================
             * PHASE 3: POPUP MENU CONSTRUCTION
             * ==================================================== */
            
            // Create the popup menu that will host our calendar UI
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            /* ====================================================
             * PHASE 4: UI CONSTRUCTION
             * ====================================================
             * 
             * The UI is built as a hierarchical tree of St widgets.
             * This is the most complex part of the constructor.
             */

            // 4.1 Main vertical container (root of our UI)
            this._mainBox = new St.BoxLayout({
                vertical: true,
                style_class: 'calendar-main-box'
            });

            /**
             * HEADER SECTION
             * --------------
             * Displays current day/date and acts as a "Home" button.
             * Clicking it returns to today's date in the calendar.
             * 
             * Visual structure:
             * ┌─────────────────────────────┐
             * │ Monday                      │ ← Day label
             * │ 1. January 2026            │ ← Date label  
             * │ New Year's Day             │ ← Holiday (optional)
             * └─────────────────────────────┘
             */
    
            let headerBox = new St.BoxLayout({
                vertical: true,
                style_class: 'calendar-today-home-button',
                reactive: true  // Makes it clickable
            });
            
            // Click handler: Return to today's date
            headerBox.connect("button-release-event", () => {
                this.CalendarView.resetToToday();
                this.setHeaderDate(new Date());
            });

            // Create header labels
            this._dayLabel = new St.Label({ style_class: 'calendar-today-day-label' });
            this._dateLabel = new St.Label({ style_class: 'calendar-today-date-label' });
            this._holidayLabel = new St.Label({ style_class: 'calendar-today-holiday' });

            // Add labels to header
            headerBox.add_actor(this._dayLabel);
            headerBox.add_actor(this._dateLabel);
            headerBox.add_actor(this._holidayLabel);

            /**
             * CALENDAR GRID
             * -------------
             * The main calendar component (month/year/day views).
             * Loaded dynamically from CalendarView module.
             */
            this.CalendarView = new CalendarModule.CalendarView(this);

            /**
             * SIGNAL CONNECTION: Event List → Calendar Navigation
             * ----------------------------------------------------
             * When a user clicks an event in the list view,
             * the calendar should jump to that event's date.
             * 
             * This creates navigation flow between components.
             */
            this.eventListView.connect('event-clicked', (actor: any, ev: any) => {
                if (ev && ev.start) {
                    // 1. Jump calendar to the event's date
                    this.CalendarView.jumpToDate(ev.start);
                    
                    // 2. Update header to show the event's date
                    this.setHeaderDate(ev.start);
                }
            });

            /**
             * FOOTER SECTION
             * ---------------
             * System management buttons at the bottom.
             */
            let footerBox = new St.BoxLayout({ style_class: 'calendar-footer' });
            
            // Button: Open Cinnamon's date/time settings
            let settingsBtn = new St.Button({
                label: _("Date and Time Settings"),
                style_class: 'calendar-footer-button',
                x_expand: true
            });
            settingsBtn.connect("clicked", () => {
                this.menu.close();
                Util.spawnCommandLine("cinnamon-settings calendar");
            });

            // Button: Open calendar management
            let calendarBtn = new St.Button({
                label: _("Manage Calendars"),
                style_class: 'calendar-footer-button',
                x_expand: true
            });
            calendarBtn.connect("clicked", () => {
                this.menu.close();
                
                const currentDate = this.CalendarView.getCurrentlyDisplayedDate();
                const epoch = Math.floor(currentDate.getTime() / 1000);
                
                // Try to open via calendar:// URI (XDG standard)
                try {
                    Util.spawnCommandLine(`xdg-open calendar:///?startdate=${epoch}`);
                } catch (e) {
                    // Fallback to GNOME Calendar if URI fails
                    Util.spawnCommandLine(`gnome-calendar --date=${epoch}`);
                }
            });

            // Add buttons to footer
            footerBox.add_actor(settingsBtn);
            footerBox.add_actor(calendarBtn);

            /**
             * LAYOUT COMPOSITION
             * ------------------
             * Assemble the two-column layout:
             * 
             * ┌─────────────────────────────────────────────┐
             * │ EventListView │ Header + Calendar + Footer  │
             * │ (Left Column) │ (Right Column)              │
             * └─────────────────────────────────────────────┘
             */
            
            // 1. Create right column (traditional calendar view)
            let rightColumn = new St.BoxLayout({
                vertical: true,
                style_class: 'calendar-right-column'
            });
            rightColumn.add_actor(headerBox);
            rightColumn.add_actor(this.CalendarView.actor);
            rightColumn.add_actor(footerBox);

            // 2. Create horizontal bridge container
            this._contentLayout = new St.BoxLayout({
                vertical: false,  // Side-by-side layout
                style_class: 'calendar-content-layout'
            });

            // 3. Add left wing (events) and right column (calendar)
            this._contentLayout.add_actor(this.eventListView.actor);
            this._contentLayout.add_actor(rightColumn);

            // 4. Final assembly: Add everything to main container
            this._mainBox.add_actor(this._contentLayout);
            
            // 5. Add main container to popup menu
            this.menu.addActor(this._mainBox);

            /* ====================================================
             * PHASE 5: INITIALIZATION AND SIGNAL SETUP
             * ==================================================== */
            
            // Apply initial settings
            this.on_settings_changed();
            this.on_hotkey_changed();

            /**
             * MENU OPEN/CLOSE HANDLING
             * -------------------------
             * When menu opens:
             * 1. Refresh calendar display
             * 2. Update header to current date
             * 3. Focus calendar for keyboard navigation
             */
            this.menu.connect("open-state-changed", (menu: any, isOpen: boolean) => {
                if (isOpen) {
                    this.CalendarView.render();
                    this.setHeaderDate(new Date());
                    
                    // Small delay to ensure UI is ready before focusing
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                        this.CalendarView.actor.grab_key_focus();
                        return false;
                    });
                }
            });

            // Initial panel label/tooltip update
            this.update_label_and_tooltip();
            
            // Start periodic updates (every 10 seconds)
            this._updateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
                this.update_label_and_tooltip();
                return true;  // Continue timer
            });

        } catch (e) {
            // Log critical initialization failures
            global.log(`[${this.uuid}] CRITICAL: Initialization failed: ${e}`);
        }
    }

    /* ============================================================
     * SETTINGS CHANGE HANDLER
     * ============================================================
     * 
     * Called automatically when ANY bound setting changes.
     * Updates UI elements to reflect new settings.
     */

    on_settings_changed() {
        // Toggle panel icon visibility
        if (this.showIcon) {
            this.set_applet_icon_name("office-calendar");
            if (this._applet_icon_box) this._applet_icon_box.show();
        } else {
            this._hide_icon();
        }

        // Toggle event list visibility (left sidebar)
        if (this.eventListView) {
            if (this.showEvents) {
                this.eventListView.actor.show();
            } else {
                this.eventListView.actor.hide();
            }
        }

        // Update panel label and tooltip
        this.update_label_and_tooltip();
        
        // If menu is open, re-render to reflect format changes
        if (this.menu && this.menu.isOpen) {
            this.CalendarView.render();
        }
    }

    /* ============================================================
     * HELPER: HIDE PANEL ICON
     * ============================================================
     * 
     * Cleanly hides the icon from the panel.
     * Different Cinnamon versions handle empty icons differently.
     */

    _hide_icon() {
        this.set_applet_icon_name("");
        if (this._applet_icon_box) {
            this._applet_icon_box.hide();
        }
    }

    /* ============================================================
     * PANEL CLICK HANDLER
     * ============================================================
     * 
     * Called by Cinnamon when user clicks the applet in the panel.
     */
    /**
     * @brief Handles panel icon clicks
     * 
     * @param event The click event from Cinnamon
     * 
     * @note Called automatically by Cinnamon when user clicks the panel icon.
     * Toggles the popup menu and refreshes events if opening.
     */

    on_applet_clicked(event: any): void {
        // Refresh events if opening the menu
        if (!this.menu.isOpen) {
            this.eventManager.refresh();
        }
        // Toggle menu open/close
        this.menu.toggle();
    }

    /* ============================================================
     * HOTKEY CHANGE HANDLER
     * ============================================================
     * 
     * Updates global keyboard shortcut when setting changes.
     */

    on_hotkey_changed() {
        // Remove old hotkey
        Main.keybindingManager.removeHotKey(`${this.uuid}-open`);
        
        // Register new hotkey if set
        if (this.keyOpen) {
            Main.keybindingManager.addHotKey(`${this.uuid}-open`, this.keyOpen, () => {
                this.on_applet_clicked(null);
            });
        }
    }

    /* ============================================================
     * PANEL LABEL AND TOOLTIP UPDATER
     * ============================================================
     * 
     * Updates the text shown in the Cinnamon panel and its tooltip.
     * Runs periodically (every 10 seconds) to keep time accurate.
     */

    update_label_and_tooltip() {
        const now = new Date();
        const gNow = GLib.DateTime.new_now_local();
        
        // Panel label (time display)
        let timeLabel = this.useCustomFormat 
            ? gNow.format(this.customFormat) 
            : now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Tooltip (date display)
        let dateTooltip = this.useCustomFormat 
            ? gNow.format(this.customTooltipFormat) 
            : now.toLocaleDateString([], { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

        this.set_applet_label(timeLabel || "");
        this.set_applet_tooltip(dateTooltip || "");
    }

    /* ============================================================
     * HEADER DATE UPDATER
     * ============================================================
     * 
     * Updates the header section in the popup menu.
     * Shows day, date, and holiday information.
     * 
     * @param date - The date to display in the header
     */

    public setHeaderDate(date: Date) {
        if (!this._dayLabel || !this.CalendarView) return;
        
        const gDate = GLib.DateTime.new_from_unix_local(date.getTime() / 1000);
        
        // Format: "Monday"
        this._dayLabel.set_text(gDate.format("%A"));
        
        // Format: "1. January 2026"
        this._dateLabel.set_text(gDate.format("%e. %B %Y"));

        // Check for holidays
        const tagInfo = this.CalendarView.getHolidayForDate(date);
        if (tagInfo && tagInfo.beschreibung) {
            this._holidayLabel.set_text(tagInfo.beschreibung);
            this._holidayLabel.show();
        } else {
            this._holidayLabel.hide();
        }
    }

    /* ============================================================
     * CLEANUP HANDLER
     * ============================================================
     * 
     * Called when applet is removed from panel or Cinnamon restarts.
     * Essential to prevent memory leaks and dangling resources.
     */

    on_applet_removed_from_panel() {
        // Remove global hotkey
        Main.keybindingManager.removeHotKey(`${this.uuid}-open`);
        
        // Stop periodic update timer
        if (this._updateId > 0) {
            GLib.source_remove(this._updateId);
        }
        
        // Destroy menu and all UI elements
        this.menu.destroy();
    }

    /* ============================================================
     * ICS FILE IMPORT DIALOG
     * ============================================================
     * 
     * Opens a GTK file chooser to import .ics calendar files.
     * Currently not connected in UI (commented out in CalendarView).
     * 
     * TODO: This feature is disabled due to EDS import limitations.
     */

    private _openICSFileChooser(): void {
        const dialog = new Gtk.FileChooserDialog({
            title: _("Import Calendar (.ics)"),
            action: Gtk.FileChooserAction.OPEN,
            modal: true,
        });
        
        dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
        dialog.add_button(_("Import"), Gtk.ResponseType.OK);
        
        const filter = new Gtk.FileFilter();
        filter.set_name("iCalendar (*.ics)");
        filter.add_pattern("*.ics");
        dialog.add_filter(filter);

        dialog.connect("response", (_dlg: any, response: number) => {
            if (response === Gtk.ResponseType.OK) {
                const file = dialog.get_file();
                if (file) {
                    const path = file.get_path();
                    if (path) {
                        this.eventManager.importICSFile(path)
                            .catch(e => {
                                global.logError(
                                    `${this.uuid}: ICS import failed: ${e}`
                                );
                            });
                    }
                }
            }
            dialog.destroy();
        });

        dialog.show_all();
    }
}

/* ================================================================
 * CINNAMON ENTRY POINT
 * ================================================================
 * 
 * Cinnamon calls this function to create the applet instance.
 * Must be named 'main' exactly.
 */

function main(metadata: any, orientation: any, panel_height: number, instance_id: number) {
    try {
        return new UniversalCalendarApplet(metadata, orientation, panel_height, instance_id);
    } catch (e) {
        // Log initialization errors to Cinnamon's global log
        if (typeof global !== 'undefined') {
            global.log(metadata.uuid + " CRITICAL: Initialization error: " + e);
        }
        return null;
    }
}

/* ================================================================
 * GLOBAL EXPORT (CINNAMON RUNTIME REQUIREMENT)
 * ================================================================
 * 
 * CRITICAL: Cinnamon loads applets by evaluating JS files.
 * There is NO module system at runtime - everything must be global.
 * 
 * This dual export pattern supports:
 * 1. TypeScript/development environment (exports)
 * 2. Cinnamon production runtime (global assignment)
 */

if (typeof global !== 'undefined') {
    global.main = main; 
    (global as any).main = main; 
    if (typeof Applet !== 'undefined') {
        global.Applet = Applet;
        (global as any).Applet = Applet;
    }
}

/* ================================================================
 * TODOs (DOCUMENTATION ONLY - NO CODE CHANGES)
 * ================================================================
 * 
 * TODO: Add lazy loading for CalendarView to improve startup performance.
 * 
 * TODO: Implement proper error boundaries for component initialization failures.
 * 
 * TODO: Add comprehensive keyboard navigation between EventListView and CalendarView.
 * 
 * TODO: Consider extracting the two-column layout into a reusable LayoutManager class.
 * 
 * TODO: Add support for calendar color theme synchronization with system theme.
 * 
 * TODO: Implement drag-and-drop event creation in month view.
 * 
 * TODO: Add export functionality (current month events to .ics).
 */
