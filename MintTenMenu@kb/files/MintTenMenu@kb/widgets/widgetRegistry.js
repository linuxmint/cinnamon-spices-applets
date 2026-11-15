// widgets/widgetRegistry.js
'use strict';

const Weather2Widget   = require('./widgets/weather2Widget');
const FinanceWidget    = require('./widgets/financeWidget');
const CalendarWidget   = require('./widgets/calendarWidget');
const TodoWidget       = require('./widgets/todoWidget');
const ScreentimeWidget = require('./widgets/screentimeWidget');
const QuoteWidget      = require('./widgets/quoteWidget');

const REGISTRY = {
    weather:    Weather2Widget,
    weather2:   Weather2Widget,
    finance:    FinanceWidget,
    forex:      FinanceWidget,
    calendar:   CalendarWidget,
    todo:       TodoWidget,
    tasks:      TodoWidget,
    screentime: ScreentimeWidget,
    quote:      QuoteWidget,
};

function create(tileData, applet) {
    const Cls = REGISTRY[tileData.widgetKind];
    if (!Cls) {
        throw new Error('Unknown widget kind: ' + tileData.widgetKind);
    }
    return new Cls(tileData, applet);
}

module.exports = { create, REGISTRY };
