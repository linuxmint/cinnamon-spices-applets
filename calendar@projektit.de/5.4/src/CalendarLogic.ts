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

/* ================================================================
 * TYPE IMPORTS (TypeScript Only - Stripped at Runtime)
 * ================================================================
 * 
 * These imports are ONLY for TypeScript type checking and development.
 * In production (GJS runtime), they don't exist - hence the 'None' module mode.
 * 
 * CalendarDay.ts defines interfaces for type-safe date handling.
 */

import { CalendarDay, DayType } from './CalendarDay';

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
 * HOLIDAY INTERFACE DEFINITION
 * ================================================================
 * 
 * Defines the structure of holiday rules in JSON files.
 * 
 * WHY THIS COMPACT FORMAT?
 * - Minimizes file size (important for applet performance)
 * - Easy to parse and process
 * - Human-readable for manual editing
 */

export interface Holiday {
    /**
     * Rule type key:
     * - 'f': Fixed date (e.g., Christmas on Dec 25)
     * - 'e': Easter-based (e.g., Good Friday = Easter - 2)
     * - 'r': Relative (e.g., "first Monday in September")
     */
    k: string;
    
    /**
     * Day of month (1-31) for fixed dates.
     * Optional for non-fixed holidays.
     */
    d?: number;
    
    /**
     * Month of year (1-12) for fixed dates.
     * Optional for non-fixed holidays.
     */
    m?: number;
    
    /**
     * Offset in days from Easter (for easter-based holidays).
     * Example: -2 = Good Friday, +49 = Pentecost Monday
     */
    o?: number;
    
    /**
     * Holiday name in local language.
     * Displayed in UI headers and tooltips.
     */
    n: string;
    
    /**
     * Public holiday flag:
     * - true: Official public holiday (banks/schools closed)
     * - false: Observance or traditional holiday (normal work day)
     */
    p: boolean;
    
    /**
     * Optional condition for historical rule changes.
     * Format: "year<=1994" or "year>=2000"
     * Used for holidays that changed over time.
     */
    c?: string;
}

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
export class CalendarLogic {
    /**
     * In-memory cache of holiday rules by region.
     * Structure: { "de": [Holiday...], "de-BY": [Holiday...], ... }
     * 
     * WHY CACHE IN MEMORY?
     * - JSON files are small (< 10KB each)
     * - Eliminates disk I/O during calendar navigation
     * - Fast random access for date lookups
     */
    private holidayData: { [region: string]: Holiday[] } = {};
    
    /**
     * Filesystem path to the applet directory.
     * Used to locate holiday JSON files in holidays/ subdirectory.
     */
    private appletDir: string;

    /* ============================================================
     * CONSTRUCTOR
     * ============================================================
     * 
     * Initializes the logic component and loads holiday data.
     * 
     * @param appletDir - Absolute path to applet directory (from metadata.path)
     */

    constructor(appletDir: string) {
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

    private loadHolidays() {
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
        } catch (e) {
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

    public getHolidaysForDate(date: Date, region: string = "de"): string[] {
        let dayHolidays: string[] = [];
        
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

    private isHolidayMatch(rule: Holiday, date: Date): boolean {
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

    private checkCondition(cond: string, year: number): boolean {
        const match = cond.match(/year([<>=!]+)(\d+)/);
        if (!match || !match[1] || !match[2]) return true;
        
        const operator = match[1];
        const val = parseInt(match[2]);

        switch (operator) {
            case "<=": return year <= val;
            case ">=": return year >= val;
            case "==": return year === val;
            case "<":  return year < val;
            case ">":  return year > val;
            default:   return true;
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

    private getEaster(year: number): Date {
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
(global as any).CalendarLogic = CalendarLogic;

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
