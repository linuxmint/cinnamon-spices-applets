// Production stub - CalendarLogic is bundled in applet.js
if (typeof global !== 'undefined' && global.CalendarLogic) {
    module.exports = { CalendarLogic: global.CalendarLogic };
} else {
    throw new Error('CalendarLogic not available in production bundle');
}
