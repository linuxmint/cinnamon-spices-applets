// Production stub - CalendarView is bundled in applet.js
if (typeof global !== 'undefined' && global.CalendarView) {
    module.exports = { CalendarView: global.CalendarView };
} else {
    throw new Error('CalendarView not available in production bundle');
}
