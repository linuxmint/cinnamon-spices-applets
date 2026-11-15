// widgets/calendarWidget.js
'use strict';

const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const WidgetBase = require('./widgets/widgetBase');

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS_SUN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAYS_MON = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayOfYear(d) {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function getWeekOfYear(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

class CalendarWidget extends WidgetBase {
    constructor(tileData, applet) {
        super(tileData, applet);
        const today = new Date();
        this._viewYear = today.getFullYear();
        this._viewMonth = today.getMonth();
        this._selectedYear = today.getFullYear();
        this._selectedMonth = today.getMonth();
        this._selectedDay = today.getDate();

        this._layoutBox = new St.BoxLayout({
            vertical: true,
            x_expand: true
        });
        this.contentActor.add_child(this._layoutBox);
    }

    buildUI() {
        this._renderUI();
    }

    refresh() {
        const config = this.tileData.config || {};
        const refreshRate = (config.refreshInterval || 300);

        this._renderUI();
        this._scheduleRefresh(refreshRate, () => this.refresh());
    }

    _getCalendarMatrix(year, month, firstDayOfWeek) {
        const firstDayDate = new Date(year, month, 1);
        const lastDayDate = new Date(year, month + 1, 0);
        const daysInMonth = lastDayDate.getDate();

        let startDayIdx = firstDayDate.getDay(); // 0=Sun..6=Sat
        if (firstDayOfWeek === 1) { // Mon start
            startDayIdx = (startDayIdx + 6) % 7;
        }

        const prevMonthLastDay = new Date(year, month, 0).getDate();
        const cells = [];

        // Prev month padding
        for (let i = startDayIdx - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const prevM = month === 0 ? 11 : month - 1;
            const prevY = month === 0 ? year - 1 : year;
            cells.push({ year: prevY, month: prevM, day: d, isCurrentMonth: false });
        }

        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ year, month, day: d, isCurrentMonth: true });
        }

        // Next month padding
        const targetLength = cells.length > 35 ? 42 : 35;
        const remaining = targetLength - cells.length;
        for (let d = 1; d <= remaining; d++) {
            const nextM = month === 11 ? 0 : month + 1;
            const nextY = month === 11 ? year + 1 : year;
            cells.push({ year: nextY, month: nextM, day: d, isCurrentMonth: false });
        }

        return cells;
    }

    _renderUI() {
        this._layoutBox.remove_all_children();

        const size = this._getSize();
        this._layoutBox.set_size(size.w - 16, -1);

        const config = this.tileData.config || {};
        const firstDayOfWeek = (config.firstDayOfWeek === 1) ? 1 : 0;
        const weekdays = (firstDayOfWeek === 1) ? WEEKDAYS_MON : WEEKDAYS_SUN;

        const root = new St.BoxLayout({
            vertical: true,
            style: 'background-color: transparent; padding: 6px 8px;',
            x_expand: true,
            y_expand: true
        });
        this._layoutBox.add_child(root);

        // ── Header Navigation Row ──────────────────────────────────────────
        const header = new St.BoxLayout({
            vertical: false,
            style: 'margin-bottom: 8px;',
            y_align: Clutter.ActorAlign.CENTER
        });
        root.add_child(header);

        // Month & Year title (clickable to reset to current real month)
        const titleText = `${MONTH_NAMES[this._viewMonth]} ${this._viewYear}`;
        const titleBtn = new St.Button({
            label: titleText,
            reactive: true,
            style: 'color: #ffffff; font-size: 13px; font-weight: bold; font-family: "Inter", sans-serif; background-color: transparent; padding: 2px 4px; border-radius: 4px;'
        });
        titleBtn.connect('enter-event', () => { titleBtn.style = 'color: #60cdff; font-size: 13px; font-weight: bold; font-family: "Inter", sans-serif; background-color: rgba(255,255,255,0.06); padding: 2px 4px; border-radius: 4px;'; });
        titleBtn.connect('leave-event', () => { titleBtn.style = 'color: #ffffff; font-size: 13px; font-weight: bold; font-family: "Inter", sans-serif; background-color: transparent; padding: 2px 4px; border-radius: 4px;'; });
        titleBtn.connect('clicked', () => {
            const now = new Date();
            this._viewYear = now.getFullYear();
            this._viewMonth = now.getMonth();
            this._selectedYear = now.getFullYear();
            this._selectedMonth = now.getMonth();
            this._selectedDay = now.getDate();
            this._renderUI();
        });
        header.add_child(titleBtn);

        header.add_child(new St.Widget({ x_expand: true }));

        // Nav buttons: ‹, Today, ›
        const navBox = new St.BoxLayout({ vertical: false, style: 'spacing: 4px;' });
        header.add_child(navBox);

        const prevBtn = new St.Button({
            label: '‹',
            reactive: true,
            style: 'color: #e0e0e0; font-size: 13px; font-weight: bold; background-color: rgba(255,255,255,0.08); padding: 1px 7px; border-radius: 4px;'
        });
        prevBtn.connect('clicked', () => {
            if (this._viewMonth === 0) {
                this._viewMonth = 11;
                this._viewYear--;
            } else {
                this._viewMonth--;
            }
            this._renderUI();
        });
        navBox.add_child(prevBtn);

        const nextBtn = new St.Button({
            label: '›',
            reactive: true,
            style: 'color: #e0e0e0; font-size: 13px; font-weight: bold; background-color: rgba(255,255,255,0.08); padding: 1px 7px; border-radius: 4px;'
        });
        nextBtn.connect('clicked', () => {
            if (this._viewMonth === 11) {
                this._viewMonth = 0;
                this._viewYear++;
            } else {
                this._viewMonth++;
            }
            this._renderUI();
        });
        navBox.add_child(nextBtn);

        // ── Weekday Headers ────────────────────────────────────────────────
        const weekdayRow = new St.BoxLayout({ vertical: false, style: 'margin-bottom: 6px;', x_expand: true });
        root.add_child(weekdayRow);

        weekdays.forEach(dayName => {
            const colBox = new St.BoxLayout({
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER
            });
            const lbl = new St.Label({
                text: dayName,
                style: 'color: rgba(255, 255, 255, 0.45); font-size: 10px; font-weight: bold; font-family: "Inter", sans-serif; text-align: center;',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER
            });
            colBox.add_child(lbl);
            weekdayRow.add_child(colBox);
        });

        // ── Monthly Grid ───────────────────────────────────────────────────
        const gridBox = new St.BoxLayout({ vertical: true, style: 'margin-bottom: 8px;', x_expand: true });
        root.add_child(gridBox);

        const cells = this._getCalendarMatrix(this._viewYear, this._viewMonth, firstDayOfWeek);
        const today = new Date();
        const todayY = today.getFullYear();
        const todayM = today.getMonth();
        const todayD = today.getDate();

        for (let r = 0; r < cells.length; r += 7) {
            const rowBox = new St.BoxLayout({ vertical: false, style: 'margin-bottom: 3px;', x_expand: true });
            gridBox.add_child(rowBox);

            for (let c = 0; c < 7; c++) {
                const cell = cells[r + c];
                const isToday = (cell.year === todayY && cell.month === todayM && cell.day === todayD);
                const isSelected = (cell.year === this._selectedYear && cell.month === this._selectedMonth && cell.day === this._selectedDay);

                const colCell = new St.BoxLayout({
                    x_expand: true,
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER
                });

                let bgStyle = '';
                if (isToday) {
                    bgStyle = 'background-color: #0078D4; color: #ffffff; font-weight: bold; border-radius: 13px;';
                } else if (isSelected) {
                    bgStyle = 'background-color: rgba(255, 255, 255, 0.22); border: 1px solid rgba(255, 255, 255, 0.4); color: #ffffff; font-weight: bold; border-radius: 13px;';
                } else if (cell.isCurrentMonth) {
                    bgStyle = 'background-color: transparent; color: #e8e8e8; border-radius: 13px;';
                } else {
                    bgStyle = 'background-color: transparent; color: rgba(255, 255, 255, 0.25); border-radius: 13px;';
                }

                const cellBtn = new St.Button({
                    label: String(cell.day),
                    reactive: true,
                    style: 'width: 26px; height: 26px; min-width: 26px; min-height: 26px; max-width: 26px; max-height: 26px; ' +
                           'font-size: 11px; font-family: "Inter", sans-serif; text-align: center; ' + bgStyle
                });

                const btnLabel = cellBtn.get_child();
                if (btnLabel) {
                    btnLabel.set_x_align(Clutter.ActorAlign.CENTER);
                    btnLabel.set_y_align(Clutter.ActorAlign.CENTER);
                }

                cellBtn.connect('enter-event', () => {
                    if (!isToday && !isSelected) {
                        cellBtn.style = 'width: 26px; height: 26px; min-width: 26px; min-height: 26px; max-width: 26px; max-height: 26px; ' +
                                        'font-size: 11px; font-family: "Inter", sans-serif; text-align: center; border-radius: 13px; background-color: rgba(255,255,255,0.12); color: #ffffff;';
                    }
                });
                cellBtn.connect('leave-event', () => {
                    if (!isToday && !isSelected) {
                        cellBtn.style = 'width: 26px; height: 26px; min-width: 26px; min-height: 26px; max-width: 26px; max-height: 26px; ' +
                                        'font-size: 11px; font-family: "Inter", sans-serif; text-align: center; ' + bgStyle;
                    }
                });

                cellBtn.connect('clicked', () => {
                    this._selectedYear = cell.year;
                    this._selectedMonth = cell.month;
                    this._selectedDay = cell.day;
                    if (!cell.isCurrentMonth) {
                        this._viewYear = cell.year;
                        this._viewMonth = cell.month;
                    }
                    this._renderUI();
                });

                colCell.add_child(cellBtn);
                rowBox.add_child(colCell);
            }
        }

        // ── Card container for Selected Date & Details ───────────────────────
        const selDateObj = new Date(this._selectedYear, this._selectedMonth, this._selectedDay);
        const dayNameFull = DAY_NAMES_FULL[selDateObj.getDay()];
        const monthShort = MONTH_NAMES[this._selectedMonth].slice(0, 3);
        const isSelToday = (this._selectedYear === todayY && this._selectedMonth === todayM && this._selectedDay === todayD);

        const cardBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style: 'background-color: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 12px; margin-top: 4px;'
        });
        root.add_child(cardBox);

        // Header inside card
        const cardHeader = new St.BoxLayout({ vertical: false, style: 'margin-bottom: 4px;', y_align: Clutter.ActorAlign.CENTER });
        cardBox.add_child(cardHeader);

        cardHeader.add_child(new St.Label({
            text: `${dayNameFull}, ${monthShort} ${this._selectedDay}, ${this._selectedYear}`,
            x_expand: true,
            style: 'color: #ffffff; font-size: 12px; font-weight: bold; font-family: "Inter", sans-serif;'
        }));

        if (isSelToday) {
            cardHeader.add_child(new St.Label({
                text: 'Today',
                style: 'color: #ffffff; background-color: #0078D4; font-size: 9px; font-weight: bold; border-radius: 8px; padding: 1px 6px; font-family: "Inter", sans-serif;'
            }));
        }

        // Subtitle / Date Metrics row
        const dayOfYear = getDayOfYear(selDateObj);
        const weekOfYear = getWeekOfYear(selDateObj);

        const metricsRow = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
        cardBox.add_child(metricsRow);

        metricsRow.add_child(new St.Label({
            text: `Week ${weekOfYear}  •  Day ${dayOfYear} of 365`,
            x_expand: true,
            style: 'color: rgba(255, 255, 255, 0.45); font-size: 10px; font-family: "Inter", sans-serif;'
        }));

        const isViewingToday = (this._viewYear === todayY && this._viewMonth === todayM);
        if (!isViewingToday || !isSelToday) {
            const goTodayBtn = new St.Button({
                label: 'Go to Today',
                reactive: true,
                style: 'color: #e0e0e0; font-size: 10px; font-weight: bold; background-color: rgba(255,255,255,0.08); padding: 3px 7px; border-radius: 4px; font-family: "Inter", sans-serif;'
            });
            goTodayBtn.connect('clicked', () => {
                const now = new Date();
                this._viewYear = now.getFullYear();
                this._viewMonth = now.getMonth();
                this._selectedYear = now.getFullYear();
                this._selectedMonth = now.getMonth();
                this._selectedDay = now.getDate();
                this._renderUI();
            });
            metricsRow.add_child(goTodayBtn);
        }
    }
}

module.exports = CalendarWidget;
