'use strict';

// Pure calendar/date helpers shared by the applet (Cinnamon/GJS) and the unit
// tests (Node). No Cinnamon imports, so tests can require() it directly.
//
// The key invariant: day-to-day stepping uses calendar arithmetic, never
// subtraction of 86400000 ms, so it stays exact across DST transitions (a 23h
// or 25h local day must not make a date skip or repeat).

// Local "YYYY-MM-DD" key for a Date.
function dayKey(d) {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

// Whole calendar days from key `a` to key `b` (b - a). Parsing at local midnight
// and rounding keeps it correct even when a DST day in between is 23h or 25h.
function daysBetween(a, b) {
    let da = new Date(a + "T00:00:00");
    let db = new Date(b + "T00:00:00");
    return Math.round((db - da) / 86400000);
}

// The Date at local midnight N calendar days before `now`. Uses the Date
// constructor's date normalization (handling negative days across month/year
// boundaries) rather than millisecond subtraction, so it never drifts at DST.
function dateDaysAgo(now, n) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
}

// Node / CommonJS export for the unit tests (tests/js/datemath.test.js). In the
// Cinnamon (GJS) runtime `module` is undefined, so this is a no-op there.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { dayKey, daysBetween, dateDaysAgo };
}
