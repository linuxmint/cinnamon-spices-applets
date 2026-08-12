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

/* ================================================================
 * DAY TYPE ENUMERATION
 * ================================================================
 * 
 * Defines all possible classifications for calendar days.
 * Used for visual styling, behavior rules, and holiday logic.
 * 
 * IMPORTANT: These values are used in:
 * 1. CSS class selection (calendar-workday, calendar-holiday, etc.)
 * 2. Business logic (is this a work day?)
 * 3. UI rendering (different colors/styles per type)
 */

export type DayType = 
    /**
     * Standard working day (Monday-Friday, not a holiday).
     * Default styling, no special behavior.
     */
    'WORKDAY'        |
    
    /**
     * Official statutory holiday.
     * Banks/schools closed, legal holiday in the region.
     * Styled with holiday colors, may have special behavior.
     */
    'PUBLIC_HOLIDAY' |
    
    /**
     * Unofficial observance or traditional holiday.
     * Normal work day but culturally significant.
     * May have subtle visual indication.
     */
    'OBSERVANCE'     |
    
    /**
     * The current system date (today).
     * Always highlighted regardless of day type.
     * Special "today" styling applied.
     */
    'TODAY'          |
    
    /**
     * Saturday or Sunday (in most regions).
     * Weekend styling applied, may affect business logic.
     */
    'WEEKEND'        |
    
    /**
     * Placeholder cell for calendar grid alignment.
     * Days from previous/next month in current month view.
     * Typically grayed out or visually distinct.
     */
    'EMPTY';

/* ================================================================
 * CALENDAR DAY INTERFACE
 * ================================================================
 * 
 * Complete structured representation of a single calendar day.
 * Used when passing day information between components.
 * 
 * DESIGN DECISION: Why not just use Date objects?
 * - Dates alone don't carry classification information
 * - Need to associate metadata (holiday names, day types)
 * - Allows consistent data structure across the application
 */

export interface CalendarDay {
    /**
     * The day number as displayed in the calendar (1-31).
     * String type allows for special cases like "31*" or formatting.
     */
    dayNumber: string;
    
    /**
     * Full JavaScript Date object for this day.
     * Used for calculations, comparisons, and time-based operations.
     */
    date: Date;
    
    /**
     * Classification of this day (workday, holiday, weekend, etc.).
     * Determines visual styling and business logic behavior.
     */
    type: DayType;
    
    /**
     * Human-readable description, typically holiday names.
     * Examples: "New Year's Day", "Christmas", "German Unity Day"
     * Empty string for normal days.
     */
    description: string;
    
    /**
     * Flag indicating if this is an official public holiday.
     * true: Banks/schools closed, legal holiday
     * false: Normal work day (even if it's an observance)
     * 
     * Different from type='PUBLIC_HOLIDAY' because:
     * - A day can be both TODAY and PUBLIC_HOLIDAY
     * - This flag focuses on legal status, not classification
     */
    isPublic: boolean;
}

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