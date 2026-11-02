/* =========================================================
 * Project IT Calendar - TypeScript Declaration File
 * =========================================================
 * 
 * CRITICAL ARCHITECTURAL FILE - DO NOT DELETE OR MODIFY LIGHTLY
 * 
 * This file provides TypeScript type declarations for the Cinnamon/GJS
 * runtime environment. It serves as the bridge between TypeScript's
 * static type system and Cinnamon's dynamic JavaScript environment.
 * 
 * IMPORTANCE LEVEL: HIGHEST - REQUIRED FOR COMPILATION
 * ------------------------------------------------------------------
 * 
 * WHY THIS FILE IS ABSOLUTELY NECESSARY:
 * 
 * 1. TypeScript Compiler Requirement:
 *    - TypeScript knows NOTHING about Cinnamon/GJS APIs
 *    - Without these declarations, TypeScript would report hundreds of errors
 *    - Compilation would fail entirely
 * 
 * 2. Hybrid Development Environment:
 *    - Development: TypeScript with full type checking
 *    - Production: GJS runtime with no TypeScript system
 *    - This file enables development-time safety while producing runtime code
 * 
 * 3. IDE Support:
 *    - Provides IntelliSense, auto-completion, and documentation in VS Code/IDEs
 *    - Enables "Go to Definition" for Cinnamon APIs
 *    - Shows parameter types and return values
 * 
 * 4. Type Safety Across Boundaries:
 *    - Ensures our code correctly uses Cinnamon APIs
 *    - Catches type mismatches at compile time, not runtime
 *    - Documents the expected shape of Cinnamon objects
 * 
 * WARNING TO FUTURE DEVELOPERS:
 * ----------------
 * DO NOT DELETE THIS FILE thinking "it's just types" or "TypeScript can infer".
 * Cinnamon/GJS APIs are NOT standard JavaScript - they're injected at runtime
 * and TypeScript has NO WAY to know about them without these declarations.
 * 
 * Removing this file will:
 * 1. Break TypeScript compilation immediately
 * 2. Remove all IDE support for Cinnamon APIs
 * 3. Make refactoring dangerous and error-prone
 * 4. Introduce runtime errors that could have been caught at compile time
 */

/* =========================================================
 * GLOBAL RUNTIME OBJECT DECLARATIONS
 * =========================================================
 * 
 * These objects exist in the GJS (GNOME JavaScript) runtime environment.
 * They are injected by Cinnamon when applets are loaded.
 */

/**
 * The global object in GJS environment.
 * 
 * In Cinnamon applets, this is where:
 * - Applet classes are registered for Cinnamon to find
 * - Logging functions (global.log, global.logError) are available
 * - Shared state between applet instances can be stored
 * 
 * TypeScript needs to know this exists and has certain properties.
 */
declare const global: any;

/**
 * The imports object provides access to Cinnamon's module system.
 * 
 * This is GJS's equivalent of Node.js's require() but for Cinnamon modules.
 * Structure: imports.ui.applet, imports.gi.St, imports.misc.util, etc.
 * 
 * Without this declaration, TypeScript would think `imports` is undefined.
 */
declare const imports: any;

/* =========================================================
 * MODULE SYSTEM DECLARATIONS
 * =========================================================
 * 
 * These declarations support the hybrid module system used by this project:
 * - TypeScript/ES6 modules during development
 * - No modules (global scope) in production GJS environment
 */

/**
 * CommonJS exports object.
 * 
 * Used when TypeScript compiles in CommonJS mode (for testing/tooling).
 * In production, we use global assignments, but TypeScript needs to know
 * `exports` might exist during compilation.
 */
declare const exports: any;

/**
 * CommonJS require function.
 * 
 * Used by some build tools and test runners. Not used in production Cinnamon
 * environment where imports.* is used instead.
 */
declare function require(path: string): any;

/* =========================================================
 * CINNAMON SIGNAL SYSTEM DECLARATIONS
 * =========================================================
 * 
 * Cinnamon uses a custom signal system (different from DOM events).
 * This namespace provides TypeScript with the interface for signal handling.
 */

declare namespace Signals {
    /**
     * Signal interface for GJS objects that emit events.
     * 
     * Used by EventManager, CalendarView, and other components that need
     * to communicate via events without tight coupling.
     * 
     * Example usage:
     * ```typescript
     * this.connect('events-updated', () => this.render());
     * this.emit('events-updated');
     * ```
     */
    interface Signals {
        /**
         * Connect a callback function to a signal.
         * @param name - Signal name (e.g., 'events-updated')
         * @param callback - Function to call when signal is emitted
         * @returns Connection ID that can be used to disconnect
         */
        connect(name: string, callback: Function): number;
        
        /**
         * Disconnect a previously connected signal handler.
         * @param id - Connection ID returned by connect()
         */
        disconnect(id: number): void;
        
        /**
         * Emit a signal, calling all connected callbacks.
         * @param name - Signal name to emit
         * @param args - Arguments to pass to callbacks
         */
        emit(name: string, ...args: any[]): void;
    }
}

/* =========================================================
 * CINNAMON APPLET BASE CLASS DECLARATIONS
 * =========================================================
 * 
 * These declarations describe the base applet classes provided by Cinnamon.
 * Our applet classes extend these, so TypeScript needs to know their shape.
 */

declare namespace imports.ui.applet {
    /**
     * Base class for Cinnamon applets that support both text and icon in panel.
     * 
     * Our UniversalCalendarApplet extends this class to get:
     * - Panel integration
     * - Tooltip support
     * - Icon/text display methods
     * - Built-in popup menu handling
     */
    class TextIconApplet {
        /**
         * Constructor called by Cinnamon when applet is loaded.
         * @param orientation - Panel orientation (horizontal/vertical)
         * @param panelHeight - Height of the panel in pixels
         * @param instanceId - Unique instance identifier
         */
        constructor(orientation: any, panelHeight: number, instanceId: number);
        
        /**
         * Sets the text label displayed in the panel.
         * Used by our update_label_and_tooltip() method.
         */
        set_applet_label(label: string): void;
        
        /**
         * Sets the tooltip shown when hovering over the applet.
         */
        set_applet_tooltip(text: string): void;
        
        /**
         * Sets the icon displayed in the panel.
         * Used by our on_settings_changed() method.
         */
        set_applet_icon_name(name: string): void;
    }
}

/* =========================================================
 * CINNAMON / GNOME GI (GOBJECT INTROSPECTION) DECLARATIONS
 * =========================================================
 * 
 * These are GObject Introspection bindings that expose C/C++ libraries
 * to JavaScript. They are the foundation of Cinnamon's API.
 * 
 * IMPORTANT: These are NOT TypeScript types for our code - they're
 * declarations that these modules exist in the GJS runtime.
 */

declare namespace imports.gi {
    /**
     * Shell Toolkit (St) - Cinnamon's UI widget library.
     * 
     * Used for ALL UI rendering in the applet:
     * - Buttons, labels, containers
     * - Layout management (BoxLayout, Table)
     * - Styling and theming
     */
    const St: any;
    
    /**
     * Clutter - 2D graphics library (lower-level than St).
     * 
     * St is built on Clutter. We use it for:
     * - Event handling (scroll, keyboard)
     * - Actor transformations
     * - Animation (though not used in current implementation)
     */
    const Clutter: any;
    
    /**
     * GIO - GNOME Input/Output library.
     * 
     * Used for:
     * - File operations (ICS import)
     * - DBus communication (CalendarServer)
     * - Async I/O operations
     */
    const Gio: any;
    
    /**
     * GLib - Low-level utility library.
     * 
     * Used for:
     * - Date/time formatting
     * - Locale detection
     * - Timeout/scheduling (periodic updates)
     * - UUID generation
     */
    const GLib: any;
    
    /**
     * Cinnamon - Cinnamon-specific APIs.
     * 
     * Contains CalendarServerProxy for calendar data access.
     * This is the primary interface to system calendar data.
     */
    const Cinnamon: any;
}

/* =========================================================
 * CINNAMON HELPER MODULE DECLARATIONS
 * =========================================================
 * 
 * These are Cinnamon-specific utility modules not exposed via GI.
 * They provide essential applet functionality.
 */

/**
 * Signal system module.
 * 
 * Provides Signals.addSignalMethods() which adds signal capabilities
 * to our classes at runtime.
 */
declare namespace imports.signals {}

/**
 * Main loop/timer module.
 * 
 * Provides timeout_add_seconds() for periodic updates (like refreshing events).
 */
declare namespace imports.mainloop {}

/**
 * Popup menu system.
 * 
 * Used to create the calendar popup menu attached to the panel applet.
 */
declare namespace imports.ui.popupMenu {}

/**
 * Settings system.
 * 
 * Provides AppletSettings for persisting user preferences.
 */
declare namespace imports.ui.settings {}

/**
 * Main Cinnamon UI manager.
 * 
 * Provides keybindingManager for global hotkey support.
 */
declare namespace imports.ui.main {}

/**
 * Utility functions.
 * 
 * Provides spawnCommandLine() for opening external applications
 * (like cinnamon-settings calendar).
 */
declare namespace imports.misc.util {}

/**
 * File utility functions.
 * 
 * Provides requireModule() for dynamic module loading (CalendarView).
 */
declare namespace imports.misc.fileUtils {}

/**
 * Internationalization (i18n) module.
 * 
 * Provides Gettext functions for translation support.
 */
declare namespace imports.gettext {}

/* =========================================================
 * APPLICATION-SPECIFIC TYPE DECLARATIONS
 * =========================================================
 * 
 * These interfaces define data structures used throughout our application.
 * They are NOT Cinnamon types - they're OUR types that TypeScript needs
 * to know about across different files.
 */

/**
 * EventData interface - Core event representation.
 * 
 * This interface defines the shape of calendar events throughout the app.
 * Used by EventManager, CalendarView, and EventListView.
 * 
 * Note: This MUST match the structure returned by Cinnamon.CalendarServer
 * and the structure expected by ECal for write operations.
 */
declare interface EventData {
    /**
     * Unique event identifier.
     * For events from Cinnamon.CalendarServer: "sourceUid:eventId"
     * For new events: GLib-generated UUID
     */
    id?: string;
    
    /**
     * Calendar source identifier.
     * Maps to Evolution Data Server source UID.
     * Used for write operations (which calendar to modify).
     */
    sourceUid?: string;
    
    /**
     * Pure event ID without source prefix.
     * Used internally for some operations.
     */
    pureId?: string;
    
    /**
     * Event start time.
     */
    start: Date;
    
    /**
     * Event end time.
     * For all-day events: next day at 00:00 (per iCalendar spec).
     */
    end: Date;
    
    /**
     * Event title/summary.
     */
    summary: string;
    
    /**
     * Event description (optional).
     * WARNING: Cinnamon.CalendarServer often doesn't provide this field.
     */
    description?: string;
    
    /**
     * Calendar color for visual distinction.
     * Hex format (e.g., "#3498db").
     */
    color: string;
    
    /**
     * All-day event flag.
     * When true, times should be ignored in display.
     */
    isFullDay: boolean;
}

/**
 * DateRange interface - For event filtering.
 * 
 * Used by EventManager.getEventsForRange() and EventListView.updateForRange().
 */
declare interface DateRange {
    /**
     * Range start date (inclusive).
     */
    from: Date;
    
    /**
     * Range end date (exclusive).
     */
    to: Date;
}

/**
 * Holiday interface - For holiday rule definitions.
 * 
 * Used by CalendarLogic for parsing holiday JSON files.
 * Each holiday file contains arrays of these objects.
 */
declare interface Holiday {
    /**
     * Rule type key:
     * - 'f': Fixed date (e.g., Christmas on Dec 25)
     * - 'e': Easter-based (e.g., Good Friday = Easter - 2)
     * - 'r': Relative (e.g., "first Monday in September")
     */
    k: string;
    
    /**
     * Day of month (1-31) for fixed dates.
     */
    d?: number;
    
    /**
     * Month of year (1-12) for fixed dates.
     */
    m?: number;
    
    /**
     * Offset in days from Easter (for easter-based holidays).
     * Example: -2 = Good Friday, +49 = Pentecost Monday
     */
    o?: number;
    
    /**
     * Holiday name in local language.
     */
    n: string;
    
    /**
     * Public holiday flag:
     * - true: Official public holiday (banks/schools closed)
     * - false: Observance or traditional holiday
     */
    p: boolean;
    
    /**
     * Optional condition for historical rule changes.
     * Format: "year<=1994" or "year>=2000"
     */
    c?: string;
}

/* =========================================================
 * COMPILATION NOTES AND WARNINGS
 * =========================================================
 * 
 * WHY WE USE `any` FOR MOST DECLARATIONS:
 * 
 * 1. Cinnamon APIs are dynamic and change between versions
 * 2. GJS bindings are generated at runtime, not known at compile time
 * 3. Exact type definitions would be massive and fragile
 * 4. The alternative is no type checking at all
 * 
 * The `any` type tells TypeScript:
 * - "This exists at runtime, trust me"
 * - "Don't complain about missing properties"
 * - "But still let me use TypeScript for OUR code"
 * 
 * This is a practical compromise that gives us:
 * - Type safety for OUR application logic
 * - Flexibility for Cinnamon's runtime APIs
 * - Working code that compiles and runs
 */

/* =========================================================
 * WHAT HAPPENS IF THIS FILE IS REMOVED?
 * =========================================================
 * 
 * 1. TypeScript compilation fails immediately with errors like:
 *    - "Cannot find name 'global'"
 *    - "Cannot find name 'imports'"
 *    - "Cannot find namespace 'Signals'"
 * 
 * 2. IDE features stop working:
 *    - No auto-completion for Cinnamon APIs
 *    - No type checking for function parameters
 *    - "Go to Definition" breaks for Cinnamon objects
 * 
 * 3. Development becomes error-prone:
 *    - Typos in API calls won't be caught until runtime
 *    - Wrong parameter types cause silent failures
 *    - Refactoring becomes dangerous
 * 
 * 4. The project becomes unmaintainable:
 *    - New developers can't understand what APIs are available
 *    - Code reviews can't catch type-related bugs
 *    - Upgrades to new Cinnamon versions become guesswork
 */

/* =========================================================
 * BEST PRACTICES FOR MODIFYING THIS FILE
 * =========================================================
 * 
 * 1. ADD, DON'T REMOVE:
 *    - If you add a new Cinnamon API usage, add its declaration here
 *    - Never remove declarations "because they're not used"
 *    - Old declarations don't hurt and might be needed later
 * 
 * 2. BE PRECISE WHEN POSSIBLE:
 *    - If you know the exact type signature, declare it
 *    - Use `any` only when you don't know or can't document
 *    - Add JSDoc comments for complex APIs
 * 
 * 3. KEEP IT ORGANIZED:
 *    - Group related declarations together
 *    - Use sections and comments
 *    - Follow the existing structure
 * 
 * 4. TEST COMPILATION:
 *    - After any change, run `tsc` to ensure it still compiles
 *    - Check that IDE auto-completion still works
 *    - Verify no new TypeScript errors appear
 */

/* =========================================================
 * LEGACY AND COMPATIBILITY NOTES
 * =========================================================
 * 
 * Some of these declarations exist for historical reasons:
 * 
 * 1. Multiple module systems:
 *    - We support both TypeScript modules and GJS global scope
 *    - This is why we have both `exports` and `global` declarations
 * 
 * 2. Cinnamon version differences:
 *    - Different Cinnamon versions expose different APIs
 *    - We declare only what we use, not everything available
 * 
 * 3. Evolution Data Server complexity:
 *    - ECal/ICal declarations are minimal because they're complex
 *    - We use these APIs through careful, tested patterns
 * 
 * This file represents YEARS of accumulated knowledge about
 * Cinnamon applet development. Treat it with respect.
 */