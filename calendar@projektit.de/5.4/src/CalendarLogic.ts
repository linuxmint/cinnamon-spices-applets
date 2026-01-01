/**
 * Project IT Calendar - Business Logic (Holiday & Date Handling)
 * -----------------------------------------------------------
 * This component manages holiday data loading and calculation.
 * * DESIGN DECISIONS:
 * 1. HYBRID MODULE SYSTEM: 
 * Uses 'export' for AMD/UMD compatibility and 'global' assignment for 
 * monolithic bundling (outFile). This satisfies both Cinnamon's 
 * internal requireModule and tsc's 'None' module setting.
 * * 2. GJS COMPATIBILITY:
 * Uses native GLib for file operations instead of Node.js 'fs', 
 * ensuring it runs inside the Cinnamon/SpiderMonkey environment.
 * * 3. TYPE SAFETY:
 * Imports types from CalendarDay.ts. Note that in 'None' mode, 
 * these imports are purely for the compiler and emit no JS code.
 */

import { CalendarDay, DayType } from './CalendarDay';

// GJS Imports - Standard way to access GNOME/Cinnamon APIs
const GLib = imports.gi.GLib;

/**
 * Interface representing the structure of a holiday definition in JSON.
 */
export interface Holiday {
    k: string;    // Key type: 'f' (fixed), 'e' (easter-based), 'r' (relative)
    d?: number;   // Day of month
    m?: number;   // Month of year
    o?: number;   // Offset in days (usually for easter, e.g., -2 for Good Friday)
    n: string;    // Name/Description of the holiday
    p: boolean;   // Public: true if statutory holiday, false if observance
    c?: string;   // Condition string (e.g., "year<=1994")
}

export class CalendarLogic {
    private holidayData: { [region: string]: Holiday[] } = {};
    private appletDir: string;

    /**
     * @param appletDir The absolute path to the applet folder (metadata.path).
     */
    constructor(appletDir: string) {
        this.appletDir = appletDir;
        this.loadHolidays();
    }

    /**
     * Loads holiday data from local JSON files.
     * Logic: Detects system locale and tries to find a matching {lang}.json.
     */
    private loadHolidays() {
        try {
            // Determine system language (e.g., "de_DE" -> "de")
            let locale = GLib.get_language_names()[0] || "en";
            let lang = locale.split('_')[0].split('.')[0].toLowerCase();

            // Construct path to holiday definitions
            let filePath = `${this.appletDir}/holidays/${lang}.json`;

            if (GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
                let [success, content] = GLib.file_get_contents(filePath);
                if (success) {
                    let json = JSON.parse(content.toString());
                    this.holidayData = json.regions || {};
                }
            }
        } catch (e) {
            // Use global.log as it's the standard way to log in Cinnamon Applets
            if (typeof global !== 'undefined') {
                global.log(`[CalendarLogic] Error loading holidays: ${e}`);
            }
        }
    }



    /**
     * getHolidaysForDate: Returns all holidays for a specific date and region.
     * Used by: 
     * - applet.ts: via setHeaderDate() to update the popup header.
     * - CalendarView.ts: during renderMonthView() to mark holiday cells and tooltips.
     * * @param date - The Date object to check.
     * @param region - Regional code (e.g., "de-BY"). Defaults to "de".
     * @returns An array of unique holiday names.
     */
    public getHolidaysForDate(date: Date, region: string = "de"): string[] {
        let dayHolidays: string[] = [];
        let rules = this.holidayData[region] || [];

        // Combine specific regional rules with base language rules (e.g., de-BY + de)
        let baseRules = this.holidayData[region.split('-')[0]] || [];
        let allRules = rules.concat(baseRules);

        for (let rule of allRules) {
            if (this.isHolidayMatch(rule, date)) {
                dayHolidays.push(rule.n);
            }
        }

        /**
         * REMOVE DUPLICATES:
         * Using a Set ensures that if a holiday (like "New Year") is defined in 
         * both the base and regional rules, it only appears once in the UI.
         */
        return [...new Set(dayHolidays)];
    }

    /**
     * Internal matching logic for different holiday types.
     */
    private isHolidayMatch(rule: Holiday, date: Date): boolean {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // JS months are 0-indexed
        const day = date.getDate();

        // Check if there is a year-based condition (e.g., historical changes)
        if (rule.c && !this.checkCondition(rule.c, year)) {
            return false;
        }

        // Fixed date holiday (e.g., Christmas)
        if (rule.k === 'f') {
            return rule.m === month && rule.d === day;
        }

        // Easter-based holiday (e.g., Pentecost)
        if (rule.k === 'e') {
            let easter = this.getEaster(year);
            let target = new Date(easter);
            target.setDate(easter.getDate() + (rule.o || 0));
            return target.getMonth() + 1 === month && target.getDate() === day;
        }

        return false; 
    }

    /**
     * Parses simple condition strings like "year<=1994".
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

    /**
     * Calculates Easter Sunday using Meeus/Jones/Butcher algorithm (Gauss-based).
     */
    private getEaster(year: number): Date {
        let a = year % 19;
        let b = Math.floor(year / 100);
        let c = year % 100;
        let d = Math.floor(b / 4);
        let e = b % 4;
        let f = Math.floor((b + 8) / 25);
        let g = Math.floor((b - f + 1) / 3);
        let h = (19 * a + b - d - g + 15) % 30;
        let i = Math.floor(c / 4);
        let k = c % 4;
        let l = (32 + 2 * e + 2 * i - h - k) % 7;
        let m = Math.floor((a + 11 * h + 22 * l) / 451);
        let n = h + l - 7 * m + 114;
        let month = Math.floor(n / 31);
        let day = (n % 31) + 1;
        return new Date(year, month - 1, day);
    }
}

/**
 * HYBRID EXPORT
 * -------------
 * 1. For 'AMD' mode: We use the 'exports' object.
 * 2. For 'None' mode: We assign to 'global' to make it available 
 * across the concatenated outFile (applet.js).
 */
if (typeof exports !== 'undefined') {
    exports.CalendarLogic = CalendarLogic;
}
(global as any).CalendarLogic = CalendarLogic;
