/**
 * Project IT Calendar - Day Interface & Types
 * --------------------------------------------
 * This file defines the data structures for calendar days.
 * Note: Since this file only contains types and interfaces, it 
 * produces no JavaScript output.
 */

export type DayType = 
    'WORKDAY'        | // Standard working day
    'PUBLIC_HOLIDAY' | // Statutory / Official holiday
    'OBSERVANCE'     | // Unofficial / Informal holiday
    'TODAY'          | // The current date
    'WEEKEND'        | // Saturday or Sunday
    'EMPTY';           // Placeholder for grid alignment

export interface CalendarDay {
    dayNumber: string;    // The day of the month (1-31)
    date: Date;
    type: DayType;
    description: string;  // Name of the holiday (e.g. "New Year's Day")
    isPublic: boolean;    // true = Public Holiday, false = Observance
}

/**
 * DEVELOPER NOTE:
 * We do not use (global as any) here because interfaces and types 
 * are removed during compilation. They only exist for the 
 * TypeScript compiler's type-checking phase.
 */
