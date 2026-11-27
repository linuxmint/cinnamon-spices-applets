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
 * Project IT Calendar - Day Interface & Type Definitions
 * =======================================================
 *
 * This file contains TypeScript type definitions and interfaces
 * used throughout the calendar application for type-safe date handling.
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 * -----------------------------
 * This file contains ONLY type definitions - it produces NO JavaScript
 * output when compiled. These types exist purely for TypeScript's
 * static type checking and development-time tooling.
 *
 * Why separate type definitions?
 * 1. Centralized type management: All date-related types in one place
 * 2. Reusability: Multiple components can import the same types
 * 3. Consistency: Ensures all components use the same type definitions
 * 4. Documentation: Serves as living documentation of the data model
 *
 * ------------------------------------------------------------------
 * TYPE SYSTEM IN CINNAMON/GJS CONTEXT:
 * ------------------------------------------------------------------
 * TypeScript types are STRIPPED at compile time when using:
 * - Module: "None" in tsconfig.json
 * - OutFile: Single-file bundling for Cinnamon applets
 *
 * This means:
 * - These interfaces EXIST only during development
 * - They provide IDE autocompletion and error checking
 * - They are REMOVED in production (no runtime overhead)
 * - No global export needed (types don't exist at runtime)
 *
 * ------------------------------------------------------------------
 * USAGE BY OTHER COMPONENTS:
 * ------------------------------------------------------------------
 * 1. CalendarLogic.ts (Primary Consumer):
 *    - Uses DayType enum to categorize days
 *    - Uses CalendarDay interface for structured date information
 *    - Provides type-safe holiday calculations
 *
 * 2. CalendarView.ts (Potential Consumer):
 *    - Could use these types for day cell rendering
 *    - Ensures consistency between logic and view layers
 *
 * 3. EventManager.ts (Potential Consumer):
 *    - Could use CalendarDay for event-date associations
 *
 * ------------------------------------------------------------------
 * @author Arnold Schiller <calendar@projektit.de>
 * @link https://github.com/ArnoldSchiller/calendar
 * @link https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */
define("CalendarDay", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
/* ================================================================
 * TYPE GUARD FUNCTIONS (Potential Future Enhancement)
 * ================================================================
 *
 * These functions don't exist yet but show how types could be used:
 *
 * function isWorkDay(day: CalendarDay): boolean {
 *     return day.type === 'WORKDAY';
 * }
 *
 * function isHoliday(day: CalendarDay): boolean {
 *     return day.type === 'PUBLIC_HOLIDAY' || day.type === 'OBSERVANCE';
 * }
 *
 * function isWeekend(day: CalendarDay): boolean {
 *     return day.type === 'WEEKEND';
 * }
 */
/* ================================================================
 * DEVELOPER NOTES
 * ================================================================
 *
 * NO GLOBAL EXPORT NEEDED:
 * ------------------------
 * Unlike other files in this project, we DO NOT use:
 *   (global as any).CalendarDay = CalendarDay;
 *
 * Reason: These are TypeScript-only type definitions that are
 * completely removed during compilation. They don't exist at
 * runtime in the GJS/Cinnamon environment.
 *
 * COMPILATION BEHAVIOR:
 * ---------------------
 * With tsconfig.json setting: "module": "none"
 * - TypeScript interfaces and type aliases produce NO JavaScript
 * - They exist only for type checking during development
 * - No runtime code is generated for this file
 *
 * This is intentional and correct for type definition files.
 */
/* ================================================================
 * EXAMPLE USAGE IN OTHER FILES
 * ================================================================
 *
 * // In CalendarLogic.ts:
 * import { CalendarDay, DayType } from './CalendarDay';
 *
 * function createCalendarDay(date: Date, holidayName: string): CalendarDay {
 *     return {
 *         dayNumber: date.getDate().toString(),
 *         date: date,
 *         type: holidayName ? 'PUBLIC_HOLIDAY' : 'WORKDAY',
 *         description: holidayName,
 *         isPublic: !!holidayName
 *     };
 * }
 *
 * // In CalendarView.ts (if using TypeScript strictly):
 * function renderDayCell(day: CalendarDay) {
 *     // TypeScript knows day has dayNumber, type, description, etc.
 *     applyStyle(day.type);  // Type-safe access
 *     setText(day.dayNumber);
 * }
 */
/* ================================================================
 * TODOs AND FUTURE ENHANCEMENTS
 * ================================================================
 *
 * TODO: Add DayColor interface for theming support
 * TODO: Add CalendarWeek type for week-based operations
 * TODO: Add DateRange type for event span calculations
 * TODO: Add type guard functions for runtime type checking
 * TODO: Consider adding i18n keys to descriptions for translation
 */ 
/**
 * @file CalendarLogic.ts
 * @brief Business logic for holiday and date calculations
 *
 * @details Pure logic component for date mathematics and holiday detection with regional rules.
 *
 * @author Arnold Schiller <calendar@projektit.de>
 * @date 2023-2026
 * @copyright GPL-3.0-or-later
 */
/*
 * Project IT Calendar - Business Logic Core (Holiday & Date Calculations)
 * =======================================================================
 *
 * This module handles all date-related business logic, primarily focusing on:
 * 1. Holiday calculation and regional holiday rules
 * 2. Date mathematics and calendar algorithms
 * 3. Pure business logic without UI or I/O dependencies
 *
 * IMPORTANT ARCHITECTURAL CONTEXT:
 * ---------------------------------
 * CalendarLogic is intentionally designed as a PURE LOGIC component:
 * - NO UI dependencies (doesn't import St, Clutter, etc.)
 * - NO I/O operations (except initial holiday data loading)
 * - NO side effects (deterministic calculations only)
 *
 * This makes it:
 * - Easily testable (all methods are deterministic)
 * - Reusable across different UI implementations
 * - Independent of Cinnamon/GJS environment
 *
 * ------------------------------------------------------------------
 * DATA SOURCES AND REGIONALIZATION:
 * ------------------------------------------------------------------
 * Holiday data is stored in JSON files in the holidays/ directory:
 *
 * Structure:
 * holidays/
 *   de.json     - Base German holidays (national)
 *   de-BY.json  - Bavaria-specific holidays (regional)
 *   de-BE.json  - Berlin-specific holidays
 *   en.json     - English/International holidays
 *   (etc.)
 *
 * Each JSON file follows this structure:
 * {
 *   "regions": {
 *     "de": [ ...holiday rules... ],
 *     "de-BY": [ ...regional rules... ]
 *   }
 * }
 *
 * Holiday rules use a compact format:
 * {
 *   "k": "f",        // Type: 'f'=fixed, 'e'=easter-based, 'r'=relative
 *   "m": 1,          // Month (1-12) for fixed dates
 *   "d": 1,          // Day for fixed dates
 *   "o": -2,         // Offset from Easter (for easter-based)
 *   "n": "New Year", // Holiday name
 *   "p": true,       // Public holiday (true) or observance (false)
 *   "c": "year<=1994" // Optional condition for historical changes
 * }
 *
 * ------------------------------------------------------------------
 * HOW REGIONS WORK:
 * ------------------------------------------------------------------
 * The system supports hierarchical regional holiday resolution:
 *
 * Example: User in Munich (Bavaria, Germany)
 * 1. First checks "de-BY" (Bavaria-specific holidays)
 * 2. Then checks "de" (German national holidays)
 * 3. Combines both lists, removing duplicates
 *
 * This allows:
 * - Regional specificity (Bavaria has different holidays than Berlin)
 * - Fallback to national holidays
 * - No code changes needed for new regions (just add JSON files)
 *
 * ------------------------------------------------------------------
 * USAGE BY OTHER COMPONENTS:
 * ------------------------------------------------------------------
 * CalendarLogic is used by:
 *
 * 1. applet.ts (Header Display):
 *    - setHeaderDate() calls getHolidaysForDate() to show holiday names
 *    - Displays holidays in the popup header
 *
 * 2. CalendarView.ts (Month Grid):
 *    - renderMonthView() calls getHolidaysForDate() for each cell
 *    - Highlights holiday cells with special CSS classes
 *    - Shows holiday tooltips on hover
 *
 * 3. CalendarDay.ts (Type Definitions):
 *    - Provides TypeScript interfaces used here
 *    - Ensures type safety across date calculations
 *
 * ------------------------------------------------------------------
 * DESIGN DECISIONS:
 * ------------------------------------------------------------------
 * 1. HYBRID MODULE SYSTEM:
 *    Uses 'export' for AMD/UMD compatibility and 'global' assignment for
 *    monolithic bundling (outFile). This satisfies both Cinnamon's
 *    internal requireModule and tsc's 'None' module setting.
 *
 * 2. GJS COMPATIBILITY:
 *    Uses native GLib for file operations instead of Node.js 'fs',
 *    ensuring it runs inside the Cinnamon/SpiderMonkey environment.
 *
 * 3. TYPE SAFETY:
 *    Imports types from CalendarDay.ts. Note that in 'None' mode,
 *    these imports are purely for the compiler and emit no JS code.
 *
 * ------------------------------------------------------------------
 * @author Arnold Schiller <calendar@projektit.de>
 * @link https://github.com/ArnoldSchiller/calendar
 * @link https://projektit.de/kalender
 * @license GPL-3.0-or-later
 */
define("CalendarLogic", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CalendarLogic = void 0;
    /* ================================================================
     * GJS / CINNAMON IMPORTS
     * ================================================================
     *
     * GLib is used for file operations and system locale detection.
     * This is the ONLY external dependency, making CalendarLogic mostly
     * environment-agnostic.
     */
    const GLib = imports.gi.GLib;
    /* ================================================================
     * CALENDAR LOGIC CLASS
     * ================================================================
     *
     * Main business logic class for all date and holiday calculations.
     *
     * PERFORMANCE CHARACTERISTICS:
     * - Holiday data loaded ONCE at initialization
     * - All calculations are O(1) or O(n) where n is small (< 100 rules)
     * - No network calls or blocking I/O after initialization
     */
    /**
     * @class CalendarLogic
     * @brief Main calendarlogic class
     *
     * @details For detailed documentation see the main class documentation.
     */
    /**
     * @class CalendarLogic
     * @brief Main calendarlogic class
     *
     * @details For detailed documentation see the main class documentation.
     */
    class CalendarLogic {
        /* ============================================================
         * CONSTRUCTOR
         * ============================================================
         *
         * Initializes the logic component and loads holiday data.
         *
         * @param appletDir - Absolute path to applet directory (from metadata.path)
         */
        constructor(appletDir) {
            /**
             * In-memory cache of holiday rules by region.
             * Structure: { "de": [Holiday...], "de-BY": [Holiday...], ... }
             *
             * WHY CACHE IN MEMORY?
             * - JSON files are small (< 10KB each)
             * - Eliminates disk I/O during calendar navigation
             * - Fast random access for date lookups
             */
            this.holidayData = {};
            this.appletDir = appletDir;
            this.loadHolidays();
        }
        /* ============================================================
         * HOLIDAY DATA LOADING
         * ============================================================
         *
         * Loads holiday definitions based on system locale.
         *
         * LOCALE RESOLUTION LOGIC:
         * 1. Get system locale (e.g., "de_DE.UTF-8")
         * 2. Extract language code (e.g., "de")
         * 3. Look for holidays/{lang}.json
         * 4. Fallback: No holidays if file not found
         *
         * WHY AUTO-DETECT LOCALE?
         * - Users don't need to configure their region
         * - Works out-of-the-box for common locales
         * - Can be extended with manual region selection
         */
        loadHolidays() {
            try {
                // Get system locale - GLib provides reliable locale detection
                let locale = GLib.get_language_names()[0] || "en";
                // Extract base language code (e.g., "de_DE" → "de")
                let lang = locale.split('_')[0].split('.')[0].toLowerCase();
                // Construct path to holiday definitions file
                let filePath = `${this.appletDir}/holidays/${lang}.json`;
                // Check if holiday file exists for this language
                if (GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
                    // Read file contents (synchronous - only done once at startup)
                    let [success, content] = GLib.file_get_contents(filePath);
                    if (success) {
                        // Parse JSON and extract regions data
                        let json = JSON.parse(content.toString());
                        this.holidayData = json.regions || {};
                    }
                }
            }
            catch (e) {
                // Log error but don't crash - applet works without holidays
                if (typeof global !== 'undefined') {
                    global.log(`[CalendarLogic] Error loading holidays: ${e}`);
                }
            }
        }
        /* ============================================================
         * PUBLIC API: GET HOLIDAYS FOR DATE
         * ============================================================
         *
         * Primary public method used by UI components.
         * Returns all holidays for a specific date and region.
         *
         * REGIONAL RESOLUTION LOGIC:
         * 1. Get region-specific rules (e.g., "de-BY" for Bavaria)
         * 2. Get base language rules (e.g., "de" for Germany)
         * 3. Combine both lists, removing duplicates
         *
         * @param date - JavaScript Date object to check
         * @param region - Regional code (e.g., "de-BY"). Defaults to "de"
         * @returns Array of unique holiday names (empty if no holidays)
         *
         * USAGE EXAMPLES:
         * - getHolidaysForDate(new Date(2026-01-01), "de") → ["New Year"]
         * - getHolidaysForDate(new Date(2026-10-03), "de") → ["German Unity Day"]
         * - getHolidaysForDate(new Date(2026-12-25), "de") → ["Christmas Day"]
         */
        getHolidaysForDate(date, region = "de") {
            let dayHolidays = [];
            // Get regional rules (e.g., Bavaria-specific)
            let rules = this.holidayData[region] || [];
            // Get base language rules (e.g., German national)
            let baseRegion = region.split('-')[0];
            let baseRules = this.holidayData[baseRegion] || [];
            // Combine regional + base rules (regional takes precedence)
            let allRules = rules.concat(baseRules);
            // Check each rule against the target date
            for (let rule of allRules) {
                if (this.isHolidayMatch(rule, date)) {
                    dayHolidays.push(rule.n);
                }
            }
            /**
             * REMOVE DUPLICATES:
             * Using a Set ensures that if a holiday (like "New Year") is defined in
             * both the base and regional rules, it only appears once in the UI.
             *
             * WHY USE SET INSTEAD OF ARRAY CHECKS?
             * - Simpler code
             * - Better performance for small arrays
             * - Maintains insertion order
             */
            return [...new Set(dayHolidays)];
        }
        /* ============================================================
         * HOLIDAY RULE MATCHING ENGINE
         * ============================================================
         *
         * Core matching logic for different holiday types.
         *
         * SUPPORTED HOLIDAY TYPES:
         * 1. Fixed dates (k='f'): Christmas, New Year, etc.
         * 2. Easter-based (k='e'): Good Friday, Pentecost, etc.
         * 3. Relative dates (k='r'): Not implemented in current version
         *
         * @param rule - Holiday rule definition from JSON
         * @param date - Date to check against
         * @returns true if date matches the holiday rule
         */
        isHolidayMatch(rule, date) {
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // Convert JS 0-index to 1-index
            const day = date.getDate();
            // Check year-based conditions first (e.g., historical changes)
            if (rule.c && !this.checkCondition(rule.c, year)) {
                return false;
            }
            // Fixed date holiday (e.g., Christmas on Dec 25)
            if (rule.k === 'f') {
                return rule.m === month && rule.d === day;
            }
            // Easter-based holiday (e.g., Good Friday = Easter - 2)
            if (rule.k === 'e') {
                let easter = this.getEaster(year);
                let target = new Date(easter);
                target.setDate(easter.getDate() + (rule.o || 0));
                return target.getMonth() + 1 === month && target.getDate() === day;
            }
            // Relative date holiday (not yet implemented)
            if (rule.k === 'r') {
                // Future enhancement: "first Monday in September" etc.
                return false;
            }
            return false;
        }
        /* ============================================================
         * CONDITION PARSER
         * ============================================================
         *
         * Parses simple year-based conditions for historical accuracy.
         *
         * SUPPORTED FORMATS:
         * - "year<=1994" (holiday existed until 1994)
         * - "year>=2000" (holiday started in 2000)
         * - "year==1990" (holiday only in 1990)
         *
         * WHY NEED CONDITIONS?
         * - Holidays change over time (political/religious)
         * - German reunification (1990) changed many holidays
         * - Some holidays were added/removed by law
         *
         * @param cond - Condition string from JSON
         * @param year - Year to check
         * @returns true if condition is satisfied
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
        /* ============================================================
         * EASTER CALCULATION ALGORITHM
         * ============================================================
         *
         * Calculates Easter Sunday date using the Meeus/Jones/Butcher algorithm.
         * This is a refinement of Gauss's original algorithm.
         *
         * WHY IS EASTER COMPLICATED?
         * - Based on lunar calendar (first Sunday after first full moon after vernal equinox)
         * - Different churches use different calculations
         * - This algorithm works for Gregorian calendar years 1583-4099
         *
         * ALGORITHM SOURCE:
         * Jean Meeus, "Astronomical Algorithms", 2nd edition, 1998
         *
         * @param year - Gregorian calendar year
         * @returns Date object for Easter Sunday
         */
        getEaster(year) {
            // Step 1: Golden number - position in 19-year Metonic cycle
            let a = year % 19;
            // Step 2: Century number
            let b = Math.floor(year / 100);
            // Step 3: Years within century
            let c = year % 100;
            // Step 4: Leap year corrections
            let d = Math.floor(b / 4);
            let e = b % 4;
            // Step 5: Correction for 30-year cycle
            let f = Math.floor((b + 8) / 25);
            // Step 6: Moon orbit correction
            let g = Math.floor((b - f + 1) / 3);
            // Step 7: Epact (age of moon on Jan 1)
            let h = (19 * a + b - d - g + 15) % 30;
            // Step 8: Weekday corrections
            let i = Math.floor(c / 4);
            let k = c % 4;
            // Step 9: Correction for 7-day week
            let l = (32 + 2 * e + 2 * i - h - k) % 7;
            // Step 10: Final calculation for full moon
            let m = Math.floor((a + 11 * h + 22 * l) / 451);
            // Step 11: Month and day calculation
            let n = h + l - 7 * m + 114;
            let month = Math.floor(n / 31);
            let day = (n % 31) + 1;
            // Return Easter Sunday date (month is 1-indexed in algorithm)
            return new Date(year, month - 1, day);
        }
    }
    exports.CalendarLogic = CalendarLogic;
    /* ================================================================
     * HYBRID EXPORT SYSTEM
     * ================================================================
     *
     * CRITICAL DUAL EXPORT PATTERN:
     *
     * Cinnamon applets require BOTH export styles:
     *
     * 1. CommonJS/ES6 Export (Development):
     *    - Used by TypeScript compiler
     *    - Used by module bundlers
     *    - Enables IDE auto-completion
     *
     * 2. Global Export (Production):
     *    - Cinnamon uses requireModule() which expects global assignment
     *    - No module system at runtime in GJS
     *    - Other files access via global.CalendarLogic
     *
     * WARNING: Removing either export will break the applet!
     */
    /* ----------------------------------------------------------------
     * CommonJS/ES6 Export (Development & TypeScript)
     * ----------------------------------------------------------------
     */
    if (typeof exports !== 'undefined') {
        exports.CalendarLogic = CalendarLogic;
    }
    /* ----------------------------------------------------------------
     * Global Export (Cinnamon Runtime)
     * ----------------------------------------------------------------
     */
    global.CalendarLogic = CalendarLogic;
});
/* ================================================================
 * TODOs AND FUTURE ENHANCEMENTS
 * ================================================================
 *
 * TODO: Add support for relative date holidays (k='r'):
 *       - "first Monday in September" (Labor Day in US)
 *       - "last Monday in May" (Memorial Day in US)
 *
 * TODO: Add lunar calendar calculations for:
 *       - Islamic holidays (Hijri calendar)
 *       - Hebrew holidays (Jewish calendar)
 *       - Chinese holidays (Lunisolar calendar)
 *
 * TODO: Implement holiday caching by year for performance:
 *       - Pre-calculate all holidays for current year
 *       - Cache results for frequently accessed dates
 *
 * TODO: Add support for user-defined holiday regions:
 *       - Allow users to select region in settings
 *       - Support custom holiday JSON files
 *
 * TODO: Extend condition system with logical operators:
 *       - Support AND/OR in condition strings
 *       - Add support for day-of-week conditions
 */
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
define("CalendarView", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CalendarView = void 0;
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
    const UUID = typeof __meta !== "undefined"
        ? __meta.uuid
        : "calendar@projektit.de";
    const AppletDir = typeof __meta !== "undefined"
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
    function _(str) {
        let translated = Gettext.dgettext(UUID, str);
        if (translated !== str)
            return translated;
        translated = Gettext.dgettext("cinnamon", str);
        if (translated !== str)
            return translated;
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
    class CalendarView {
        /**
         * Constructor
         *
         * Creates the root actor, sets up input handlers,
         * initializes state, and performs the first render.
         */
        constructor(applet, uuid = "calendar@projektit.de") {
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
            this.currentView = "MONTH";
            /**
             * Selected day within the current month.
             * `null` means no specific day is selected.
             */
            this.selectedDay = null;
            /**
             * Day view sub-mode.
             * VIEW = read-only
             * ADD  = show add-event form
             * EDIT = show edit-event form
             */
            this.dayMode = "VIEW";
            this.dayModeDate = null;
            /**
             * Event currently being edited (if any).
             */
            this.editingEvent = null;
            /**
             * Locale used for date formatting.
             * Undefined means: use system locale.
             */
            this.LOCALE = undefined;
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
            this.actor.connect("scroll-event", (_, event) => {
                const dir = event.get_scroll_direction();
                if (dir === Clutter.ScrollDirection.UP)
                    this.scrollMonth(-1);
                if (dir === Clutter.ScrollDirection.DOWN)
                    this.scrollMonth(1);
                return Clutter.EVENT_STOP;
            });
            // Keyboard navigation
            this.actor.connect("key-press-event", (_, event) => {
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
        resetToToday() {
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
        getCurrentlyDisplayedDate() {
            return new Date(this.displayedYear, this.displayedMonth, this.selectedDay || 1);
        }
        /**
         * Helper used by the applet to retrieve holiday information.
         *
         * CalendarView itself does not calculate holidays.
         */
        getHolidayForDate(date) {
            if (!this.applet.CalendarLogic)
                return null;
            const holidays = this.applet.CalendarLogic.getHolidaysForDate(date, "de");
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
        renderNav() {
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
                label: new Date(this.displayedYear, this.displayedMonth).toLocaleString(this.LOCALE, { month: "long" }),
                style_class: "calendar-month-label",
                reactive: true,
                x_expand: true,
                x_fill: true,
                // We explicitly force transparency and remove default
                // button padding to visually behave like a label.
                style: "padding: 2px 0; " +
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
                text: "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0" +
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
        scrollYear(delta) {
            this.displayedYear += delta;
            this.selectedDay = null;
            this.render();
        }
        scrollMonth(delta) {
            const d = new Date(this.displayedYear, this.displayedMonth + delta, 1);
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
        _updateExternalViews() {
            if (!this.applet.showEvents || !this.applet.eventListView)
                return;
            const elv = this.applet.eventListView;
            if (this.currentView === "DAY" || this.selectedDay !== null) {
                // A specific day is selected → show day details
                const targetDate = new Date(this.displayedYear, this.displayedMonth, this.selectedDay || 1);
                const events = this.applet.eventManager.getEventsForDate(targetDate);
                elv.updateForDate(targetDate, events);
            }
            else {
                // No specific day → show month overview
                const events = this.applet.eventManager.getEventsForMonth(this.displayedYear, this.displayedMonth);
                elv.updateForMonth(this.displayedYear, this.displayedMonth, events);
            }
        }
        /* ============================================================
         * EXTERNAL NAVIGATION ENTRY POINT
         * ============================================================
         *
         * Allows external components (e.g. EventListView)
         * to request navigation to a specific date.
         */
        jumpToDate(date) {
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
        render() {
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
        renderMonthView() {
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
                grid.add(new St.Label({
                    text: name,
                    style_class: "calendar-day-base",
                }), { row: 0, col: i + colOffset });
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
                    grid.add(new St.Label({
                        text: this.getWeekNumber(kwDate).toString(),
                        style_class: "calendar-week-number",
                    }), { row, col: 0 });
                }
                /* ----------------------------------------------------
                 * DAY CELLS (MONDAY → SUNDAY)
                 * ----------------------------------------------------
                 */
                for (let col = 0; col < 7; col++) {
                    const isOtherMonth = iter.getMonth() !== this.displayedMonth;
                    const isToday = iter.getTime() === today.getTime();
                    const hasEvents = !isOtherMonth &&
                        this.applet.eventManager.hasEvents(iter);
                    /* --------------------------------------------
                     * HOLIDAY HANDLING (OPTIONAL)
                     * --------------------------------------------
                     */
                    const holidays = !isOtherMonth && this.applet.CalendarLogic
                        ? this.applet.CalendarLogic.getHolidaysForDate(iter, "de")
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
                    content.add_actor(new St.Label({
                        text: iter.getDate().toString(),
                        style_class: "calendar-day-label",
                    }));
                    content.add_actor(new St.Label({
                        text: hasEvents ? "•" : " ",
                        style_class: "calendar-day-event-dot-label",
                    }));
                    btn.set_child(content);
                    /* --------------------------------------------
                     * TOOLTIP (OPTIONAL)
                     * --------------------------------------------
                     *
                     * Shows holidays and event summaries on hover.
                     */
                    if (Tooltips.Tooltip) {
                        const tooltipLines = [];
                        holidays.forEach(h => tooltipLines.push(h));
                        if (hasEvents) {
                            const events = this.applet.eventManager.getEventsForDate(iter);
                            events.forEach((e) => tooltipLines.push(`• ${e.summary}`));
                        }
                        if (tooltipLines.length > 0) {
                            new Tooltips.Tooltip(btn, tooltipLines.join("\n"));
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
        renderYearView() {
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
                    label: new Date(this.displayedYear, m).toLocaleString(this.LOCALE, {
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
        renderDayView() {
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
            const selectedDate = new Date(this.displayedYear, this.displayedMonth, this.selectedDay || 1);
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
            if (this.dayMode !== "VIEW" &&
                (!this.dayModeDate ||
                    this.dayModeDate.toDateString() !== selectedDate.toDateString())) {
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
            box.add_actor(new St.Label({
                text: selectedDate.toLocaleString(this.LOCALE, {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                }),
                style_class: "day-details-title",
            }));
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
                const holidays = this.applet.CalendarLogic.getHolidaysForDate(selectedDate, "de");
                holidays.forEach(h => {
                    const row = new St.BoxLayout({
                        style_class: "calendar-event-button",
                        style: "background-color: rgba(255,0,0,0.1);",
                    });
                    row.add_actor(new St.Label({
                        text: h,
                        style_class: "calendar-event-summary",
                    }));
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
            const events = this.applet.eventManager.getEventsForDate(selectedDate);
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
                events.forEach((ev) => {
                    const row = new St.BoxLayout({
                        style_class: "calendar-event-button",
                    });
                    /* Event summary */
                    row.add_actor(new St.Label({
                        text: ev.summary,
                        style_class: "calendar-event-summary",
                    }));
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
                box.add_actor(new St.Label({
                    text: _("No events"),
                    style_class: "calendar-events-no-events-label",
                }));
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
                box.add_actor(this.createTerminForm(selectedDate));
            }
            else if (this.dayMode === "EDIT" && this.editingEvent) {
                box.add_actor(this.createTerminForm(selectedDate, this.editingEvent));
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
        createTerminForm(date, editingEvent) {
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
            const formatTime = (d) => {
                return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            };
            const startTimeStr = editingEvent
                ? formatTime(editingEvent.start)
                : this._getCurrentTime();
            const endTimeStr = editingEvent
                ? formatTime(editingEvent.end)
                : this._calculateDefaultEnd(startTimeStr);
            const descriptionStr = (editingEvent && typeof editingEvent.description === 'string')
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
                allDayCheckbox.set_label(isFullDay ? "☑ " + _("All Day") : "☐ " + _("All Day"));
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
                if (!title)
                    return;
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
        getDayNames() {
            const formatter = new Intl.DateTimeFormat(this.LOCALE, {
                weekday: "short",
            });
            return [1, 2, 3, 4, 5, 6, 7].map(d => formatter.format(new Date(2024, 0, d)));
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
        getWeekNumber(date) {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            // Move to Thursday of the current week
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil(((d.getTime() - yearStart.getTime()) /
                86400000 +
                1) / 7);
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
        _getCurrentTime() {
            const now = new Date();
            return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
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
        _calculateDefaultEnd(startTime) {
            const [h, m] = startTime.split(":").map(Number);
            const d = new Date();
            d.setHours(h + 1, m, 0, 0);
            return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
        _buildDateTime(date, time) {
            const [h, m] = time.split(":").map(Number);
            const d = new Date(date);
            d.setHours(h, m, 0, 0);
            return d;
        }
    }
    exports.CalendarView = CalendarView;
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
    global.CalendarView = CalendarView;
});
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
define("EventListView", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EventListView = void 0;
    /* === GJS Imports - Shell Toolkit and Clutter for UI === */
    const { St, Clutter } = imports.gi;
    const Signals = imports.signals;
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
    class EventListView {
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
        update(date, events) {
            this.updateForDate(date, events);
        }
        /**
         * Update the list for a specific day.
         * @param date - The specific day to display.
         * @param events - Array of events for this day.
         */
        updateForDate(date, events = []) {
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
        updateForMonth(year, month, events) {
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
        updateForRange(range, events) {
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
        _formatRangeLabel(range) {
            const opts = {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            };
            return `${range.from.toLocaleDateString(undefined, opts)} – ${range.to.toLocaleDateString(undefined, opts)}`;
        }
        /**
         * Renders a placeholder state when no events are present.
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
        _addEventRow(ev, showDate = false) {
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
    exports.EventListView = EventListView;
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
    global.EventListView = EventListView;
});
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
define("EventManager", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EventManager = void 0;
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
    const Gio = imports.gi.Gio; // File I/O and DBus
    const Cinnamon = imports.gi.Cinnamon; // Cinnamon-specific APIs
    const GLib = imports.gi.GLib; // Low-level utilities
    const Signals = imports.signals; // Event/signal system
    const Mainloop = imports.mainloop; // Timer and main loop
    const ECal = imports.gi.ECal; // Evolution Calendar library
    const ICal = imports.gi.ICalGLib; // iCalendar format handling
    const EDataServer = imports.gi.EDataServer; // Evolution Data Server
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
    class EventManager {
        /* ============================================================
         * CONSTRUCTOR
         * ============================================================
         *
         * Initializes the EventManager with placeholder data and establishes
         * DBus connection to Cinnamon CalendarServer.
         *
         * @param uuid - Unique identifier for logging (typically applet UUID)
         */
        constructor(uuid = "EventManager@default") {
            /* ============================================================
             * PRIVATE PROPERTIES
             * ============================================================
             */
            /**
             * DBus proxy to Cinnamon.CalendarServer.
             * Used for READ-ONLY event retrieval.
             */
            this._server = null;
            /**
             * In-memory cache of calendar events.
             * Structure: Flat array of EventData objects, filtered on demand.
             */
            this._events = [];
            /**
             * Flag indicating if DBus connection is established.
             */
            this._isReady = false;
            /**
             * EDS source registry for write operations.
             * Null until first write operation is attempted.
             */
            this._registry = null;
            /**
             * Cache of ECal.Client connections by source UID.
             * Improves performance for multiple operations on same calendar.
             */
            this._clientCache = new Map();
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
        _loadInitialData() {
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
        _initProxy() {
            Cinnamon.CalendarServerProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, "org.cinnamon.CalendarServer", "/org/cinnamon/CalendarServer", null, (obj, res) => {
                try {
                    this._server = Cinnamon.CalendarServerProxy.new_for_bus_finish(res);
                    // Listen for server-side event changes
                    this._server.connect('events-added-or-updated', this._onEventsChanged.bind(this));
                    this._server.connect('events-removed', this._onEventsChanged.bind(this));
                    this._isReady = true;
                    this.emit('manager-ready');
                    // Initial data fetch for current month
                    this.refresh();
                }
                catch (e) {
                    if (typeof global !== 'undefined') {
                        global.logError(`${this._uuid}: DBus Connection Error: ${e}`);
                    }
                }
            });
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
        selectDate(date) {
            this._selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        }
        /**
         * Gets events for the currently selected date.
         * Convenience method for common UI pattern.
         */
        getEventsForSelectedDate() {
            return this.getEventsForDate(this._selectedDate);
        }
        /**
         * Checks if any events exist for a specific date.
         *
         * @param date - Date to check
         * @returns true if at least one event exists
         */
        hasEvents(date) {
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
        getEventsForDate(date) {
            const from = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const to = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
            return this.getEventsForRange({ from, to });
        }
        /**
         * Gets all events for a specific month.
         *
         * @param year - Year (e.g., 2026)
         * @param month - Month (0-11, JavaScript convention)
         * @returns Array of events in this month
         */
        getEventsForMonth(year, month) {
            const from = new Date(year, month, 1);
            const to = new Date(year, month + 1, 0, 23, 59, 59);
            return this.getEventsForRange({ from, to });
        }
        /**
         * Gets all events for a specific year.
         *
         * @param year - Year (e.g., 2026)
         * @returns Array of events in this year
         */
        getEventsForYear(year) {
            const from = new Date(year, 0, 1);
            const to = new Date(year, 11, 31, 23, 59, 59);
            return this.getEventsForRange({ from, to });
        }
        /**
         * Gets events within a date range.
         *
         * @param range - Date range (inclusive start, exclusive end)
         * @returns Array of events overlapping the range, sorted by start time
         */
        getEventsForRange(range) {
            const from = range.from.getTime();
            const to = range.to.getTime();
            return this._events
                .filter(ev => {
                const start = ev.start.getTime();
                const end = ev.end.getTime();
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
        fetchRange(start, end) {
            if (!this._server)
                return;
            let startUnix = Math.floor(start.getTime() / 1000);
            let endUnix = Math.floor(end.getTime() / 1000);
            this._server.call_set_time_range(startUnix, endUnix, true, null, (server, res) => {
                try {
                    this._server.call_set_time_range_finish(res);
                }
                catch (e) {
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
        refresh() {
            if (!this._server)
                return;
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
        _onEventsChanged(server, varray) {
            const rawEvents = varray.unpack();
            this._events = rawEvents.map((e) => {
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
                const icsText = contents.toString();
                // Extract VEVENT blocks from ICS file
                const veventMatches = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
                if (!veventMatches)
                    return;
                let importedCount = 0;
                for (const veventBlock of veventMatches) {
                    try {
                        const summary = (veventBlock.match(/SUMMARY:(.*)/i)?.[1] || 'Unnamed').trim();
                        const description = (veventBlock.match(/DESCRIPTION:(.*)/i)?.[1] || '').trim();
                        const dtstartMatch = veventBlock.match(/DTSTART(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                        const dtendMatch = veventBlock.match(/DTEND(?:;VALUE=DATE)?[:;]([^:\n\r]+)/i);
                        if (!dtstartMatch)
                            continue;
                        const startStr = dtstartMatch[1].trim();
                        const endStr = dtendMatch ? dtendMatch[1].trim() : startStr;
                        const start = this._parseICSDate(startStr);
                        const end = this._parseICSDate(endStr);
                        const allDay = startStr.length === 8;
                        const eventToImport = {
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
         * Parses ICS date strings into JavaScript Date objects.
         *
         * Supports both:
         * - Basic format: 20231231 (all-day events)
         * - Extended format: 20231231T120000Z (timed events)
         *
         * @param icsDate - ICS date string
         * @returns JavaScript Date object
         */
        _parseICSDate(icsDate) {
            if (icsDate.length === 8) {
                // Basic format: YYYYMMDD
                return new Date(parseInt(icsDate.substr(0, 4)), parseInt(icsDate.substr(4, 2)) - 1, parseInt(icsDate.substr(6, 2)));
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
        addEvent(ev) {
            if (ev.id && ev.sourceUid) {
                // Existing event - modify via EDS
                this._modifyExistingEvent(ev);
            }
            else {
                // New event - create via EDS
                this._createNewEvent(ev);
            }
        }
        /**
         * Creates a new event in Evolution Data Server.
         *
         * @param ev - Event data
         */
        _createNewEvent(ev) {
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
            const summaryText = ECal.ComponentText.new(ev.summary || "New Event", null);
            comp.set_summary(summaryText);
            // Set description (optional)
            if (ev.description && ev.description.trim() !== "") {
                const descText = ECal.ComponentText.new(ev.description, null);
                comp.set_description(descText);
            }
            // Set times
            const tz = ICal.Timezone.get_utc_timezone();
            const start = ICal.Time.new_from_timet_with_zone(Math.floor(ev.start.getTime() / 1000), 0, tz);
            const end = ICal.Time.new_from_timet_with_zone(Math.floor(ev.end.getTime() / 1000), 0, tz);
            comp.set_dtstart(start);
            comp.set_dtend(end);
            // Connect to EDS and create event
            ECal.Client.connect(source, ECal.ClientSourceType.EVENTS, 30, null, (_o, res) => {
                try {
                    const client = ECal.Client.connect_finish(res);
                    client.create_object(comp, null, null, (_c, cres) => {
                        try {
                            client.create_object_finish(cres);
                            global.log("✅ CREATE OK");
                            this.refresh();
                        }
                        catch (e) {
                            global.logError("❌ create_object_finish failed: " + e);
                        }
                    });
                }
                catch (e) {
                    global.logError("❌ EDS connection failed: " + e);
                }
            });
        }
        /**
         * Modifies an existing event in Evolution Data Server.
         *
         * Uses "smart merge" to preserve fields not being modified.
         *
         * @param ev - Updated event data
         */
        _modifyExistingEvent(ev) {
            const source = this._resolveSource(ev.sourceUid);
            if (!source)
                return;
            ECal.Client.connect(source, ECal.ClientSourceType.EVENTS, 30, null, (_obj, res) => {
                try {
                    const client = ECal.Client.connect_finish(res);
                    if (ev.id && ev.id !== "" && !ev.id.startsWith("ics_")) {
                        // Fetch existing event for smart merge
                        client.get_object(ev.id, null, null, (_obj2, getRes) => {
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
                                                if (ev.isFullDay)
                                                    newStart.set_is_date(true);
                                                // Calculate new end time preserving duration
                                                let newEnd = ICal.Time.new_from_timet_with_zone(newStartSeconds + durationSeconds, 0, tz);
                                                if (ev.isFullDay)
                                                    newEnd.set_is_date(true);
                                                icalComp.set_dtstart(newStart);
                                                icalComp.set_dtend(newEnd);
                                                anyChange = true;
                                                global.log(`${this._uuid}: Update Times (preserved ${durationSeconds / 3600}h duration)`);
                                            }
                                        }
                                    }
                                    catch (e) {
                                        global.logWarning(`${this._uuid}: Time merge failed: ${e}`);
                                    }
                                    // 4. Save changes if any were made
                                    if (anyChange) {
                                        client.modify_object(icalComp, ECal.ObjModType.THIS, 0, null, (_c, mRes) => {
                                            try {
                                                client.modify_object_finish(mRes);
                                                global.log(`${this._uuid}: Smart merge successful`);
                                                this.refresh();
                                            }
                                            catch (err) {
                                                global.logError("Modify finish failed: " + err);
                                            }
                                        });
                                    }
                                    else {
                                        global.log(`${this._uuid}: No changes needed - master data unchanged`);
                                    }
                                }
                            }
                            catch (e) {
                                // Event not found - create as new
                                global.logWarning(`${this._uuid}: Smart merge failed (ID not found), creating new: ${e}`);
                                // Build component for new event
                                let fallbackComp = ECal.Component.new();
                                fallbackComp.set_new_vtype(ECal.ComponentVType.EVENT);
                                fallbackComp.set_uid(ev.id || GLib.uuid_string_random());
                                this._createAsNew(client, ev, fallbackComp);
                            }
                        });
                    }
                    else {
                        // Invalid ID - create as new event
                        this._createNewEvent(ev);
                    }
                }
                catch (e) {
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
        _resolveSource(sUid) {
            if (!this._registry) {
                this._registry = EDataServer.SourceRegistry.new_sync(null);
            }
            if (sUid) {
                try {
                    let s = this._registry.ref_source(sUid);
                    if (s)
                        return s;
                }
                catch (e) { }
            }
            const sources = this._registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR);
            // 1. Prefer sources with specific names
            let bestSource = sources.find((s) => {
                try {
                    const ext = s.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR);
                    // Check if writable
                    const ro = (typeof ext.get_readonly === 'function') ? ext.get_readonly() : ext.readonly;
                    if (ro === true)
                        return false;
                    const name = s.get_display_name().toLowerCase();
                    return name.includes("system") || name.includes("personal") || name.includes("local");
                }
                catch (e) {
                    return false;
                }
            });
            if (bestSource)
                return bestSource;
            // 2. Fallback: any writable source
            return sources.find((s) => {
                try {
                    const ext = s.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR);
                    const ro = (typeof ext.get_readonly === 'function') ? ext.get_readonly() : ext.readonly;
                    return ro !== true;
                }
                catch (e) {
                    return false;
                }
            });
        }
        /**
         * Finds a default writable calendar source.
         *
         * CRITICAL: Must have a parent source (not a top-level aggregate).
         * Some aggregate sources appear writable but fail on write operations.
         */
        _getDefaultWritableSource() {
            if (!this._registry) {
                this._registry = EDataServer.SourceRegistry.new_sync(null);
            }
            const sources = this._registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR);
            return sources.find((s) => {
                try {
                    const ext = s.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR);
                    if (ext.get_readonly && ext.get_readonly())
                        return false;
                    // Must have a parent (exclude top-level aggregates)
                    return s.get_parent() !== null;
                }
                catch {
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
        _applyEventToComponent(ecalComp, ev) {
            // Get underlying iCalendar component
            const ical = ecalComp.get_icalcomponent();
            // Set UID (required)
            ical.set_uid(ev.id);
            // Set timestamp (current time)
            ical.set_dtstamp(ICal.Time.new_current_with_zone(ICal.Timezone.get_utc_timezone()));
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
            let start;
            let end;
            if (ev.isFullDay) {
                // All-day events use DATE format (no time component)
                start = ICal.Time.new_null_time();
                start.set_date(ev.start.getFullYear(), ev.start.getMonth() + 1, ev.start.getDate());
                start.set_is_date(true);
                end = ICal.Time.new_null_time();
                const endDate = new Date(ev.end);
                if (endDate.getTime() <= ev.start.getTime()) {
                    endDate.setDate(ev.start.getDate() + 1);
                }
                end.set_date(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate());
                end.set_is_date(true);
            }
            else {
                // Timed events
                start = ICal.Time.new_from_timet_with_zone(Math.floor(ev.start.getTime() / 1000), 0, tz);
                end = ICal.Time.new_from_timet_with_zone(Math.floor(ev.end.getTime() / 1000), 0, tz);
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
        _createAsNew(client, ev, icalComp) {
            try {
                // Use provided component or create new one
                let comp = icalComp;
                if (!comp) {
                    comp = this._buildIcalComponent(ev);
                }
                else {
                    // Ensure component has latest data
                    this._applyEventToComponent(comp, ev);
                }
                // Save to EDS (4 arguments required by GJS bindings)
                client.create_object(comp, null, null, (_obj, res) => {
                    try {
                        client.create_object_finish(res);
                        global.log(`${this._uuid}: Event successfully created`);
                        this.refresh();
                    }
                    catch (e) {
                        global.logError(`${this._uuid}: create_object_finish failed: ${e}`);
                    }
                });
            }
            catch (e) {
                global.logError(`${this._uuid}: _createAsNew failed: ${e}`);
            }
        }
        /**
         * Factory method to build an iCalendar component from event data.
         *
         * @param ev - Event data
         * @returns ECal.Component ready for EDS storage
         */
        _buildIcalComponent(ev) {
            const icalComp = ECal.Component.new();
            icalComp.set_new_vtype(ECal.ComponentVType.EVENT);
            icalComp.set_uid(ev.id || GLib.uuid_string_random());
            // Apply all event data
            this._applyEventToComponent(icalComp, ev);
            return icalComp;
        }
    }
    exports.EventManager = EventManager;
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
    global.EventManager = EventManager;
});
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
define("applet", ["require", "exports", "EventManager", "EventListView", "CalendarLogic"], function (require, exports, EventManager_1, EventListView_1, CalendarLogic_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /* ================================================================
     * CINNAMON / GJS IMPORTS
     * ================================================================
     *
     * GJS (GNOME JavaScript) provides bindings to Cinnamon's native APIs.
     * These are NOT npm packages - they're loaded at runtime by Cinnamon.
     */
    const GLib = imports.gi.GLib; // Low-level GLib utilities (timers, file ops)
    const St = imports.gi.St; // Shell Toolkit (UI widgets)
    const Applet = imports.ui.applet; // Base applet classes
    const PopupMenu = imports.ui.popupMenu; // Popup menu system
    const Settings = imports.ui.settings; // User settings persistence
    const Main = imports.ui.main; // Main Cinnamon UI manager
    const Util = imports.misc.util; // Utility functions (spawn commands)
    const FileUtils = imports.misc.fileUtils; // File system utilities
    const Gettext = imports.gettext; // Internationalization (i18n)
    const Gtk = imports.gi.Gtk; // GTK for file dialogs (ICS import)
    const Gio = imports.gi.Gio; // GIO for file operations
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
    let _;
    /**
     * Initializes the translation system for this applet instance.
     *
     * @param uuid - Unique identifier of the applet (e.g., "calendar@projektit.de")
     * @param path - Filesystem path to the applet directory
     */
    function setupLocalization(uuid, path) {
        // Bind the applet's translation domain
        Gettext.bindtextdomain(uuid, path + "/locale");
        // Create translation function with fallback chain
        _ = function (str) {
            // 1. Try applet-specific translations
            let custom = Gettext.dgettext(uuid, str);
            if (custom !== str)
                return custom;
            // 2. Try Cinnamon core translations
            let cinnamon = Gettext.dgettext("cinnamon", str);
            if (cinnamon !== str)
                return cinnamon;
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
        constructor(metadata, orientation, panel_height, instance_id) {
            // Call parent constructor (TextIconApplet)
            super(orientation, panel_height, instance_id);
            /**
             * ID of the periodic update timer. Used for cleanup.
             */
            this._updateId = 0;
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
            this.showIcon = false;
            /**
             * Whether to show the event list sidebar.
             */
            this.showEvents = true;
            /**
             * Whether to display ISO week numbers in the month grid.
             */
            this.showWeekNumbers = false;
            /**
             * Whether to use custom date/time formats.
             */
            this.useCustomFormat = false;
            /**
             * Custom format string for panel label (uses GLib.DateTime format).
             */
            this.customFormat = "";
            /**
             * Custom format string for panel tooltip.
             */
            this.customTooltipFormat = "";
            /**
             * Global hotkey to open the calendar popup.
             */
            this.keyOpen = "";
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
                this.eventManager = new EventManager_1.EventManager();
                this.eventListView = new EventListView_1.EventListView();
                this.CalendarLogic = new CalendarLogic_1.CalendarLogic(metadata.path);
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
                    reactive: true // Makes it clickable
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
                this.eventListView.connect('event-clicked', (actor, ev) => {
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
                    }
                    catch (e) {
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
                    vertical: false, // Side-by-side layout
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
                this.menu.connect("open-state-changed", (menu, isOpen) => {
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
                    return true; // Continue timer
                });
            }
            catch (e) {
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
                if (this._applet_icon_box)
                    this._applet_icon_box.show();
            }
            else {
                this._hide_icon();
            }
            // Toggle event list visibility (left sidebar)
            if (this.eventListView) {
                if (this.showEvents) {
                    this.eventListView.actor.show();
                }
                else {
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
        on_applet_clicked(event) {
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
        setHeaderDate(date) {
            if (!this._dayLabel || !this.CalendarView)
                return;
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
            }
            else {
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
        _openICSFileChooser() {
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
            dialog.connect("response", (_dlg, response) => {
                if (response === Gtk.ResponseType.OK) {
                    const file = dialog.get_file();
                    if (file) {
                        const path = file.get_path();
                        if (path) {
                            this.eventManager.importICSFile(path)
                                .catch(e => {
                                global.logError(`${this.uuid}: ICS import failed: ${e}`);
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
    function main(metadata, orientation, panel_height, instance_id) {
        try {
            return new UniversalCalendarApplet(metadata, orientation, panel_height, instance_id);
        }
        catch (e) {
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
        global.main = main;
        if (typeof Applet !== 'undefined') {
            global.Applet = Applet;
            global.Applet = Applet;
        }
    }
});
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
