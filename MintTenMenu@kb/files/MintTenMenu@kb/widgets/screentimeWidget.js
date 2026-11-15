// widgets/screentimeWidget.js
'use strict';

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const WidgetBase = require('./widgets/widgetBase');

function expandPath(p) {
    const HOME = GLib.get_home_dir();
    return (p || '').replace(/^~/, HOME);
}

function decodeBytes(b) {
    if (!b || !b.length) return '';
    try { return imports.byteArray.toString(b); } catch(_) {}
    try { return new TextDecoder('utf-8').decode(b); } catch(_) {}
    return '';
}

function getLocalISODate(date) {
    let y = date.getFullYear();
    let m = String(date.getMonth() + 1).padStart(2, '0');
    let d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

class ScreentimeWidget extends WidgetBase {
    constructor(tileData, applet) {
        super(tileData, applet);
        this._daysData = null;
        this._lastFetchTime = 0;
        this._layoutBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });
        this.contentActor.add_child(this._layoutBox);
    }

    buildUI() {
        this._showLoading();
    }

    refresh(forceRefresh = false) {
        const config = this.tileData.config || {};
        const refreshRate = config.refreshIntervalSec || 60;
        const cacheTTL = Math.max(30000, refreshRate * 1000);

        if (!forceRefresh && this._daysData && (Date.now() - this._lastFetchTime < cacheTTL)) {
            this._renderUI(this._daysData);
            this._scheduleRefresh(refreshRate, () => this.refresh());
            return;
        }

        try {
            const daysData = this._loadChartData();
            this._daysData = daysData;
            this._lastFetchTime = Date.now();
            this._renderUI(daysData);
        } catch (e) {
            global.logError('[ScreentimeWidget] Refresh error: ' + e);
            this._showError('Error loading screen time');
        }

        this._scheduleRefresh(refreshRate, () => this.refresh());
    }

    _getLogicalDate(logicalMidnightStr) {
        let lm = logicalMidnightStr || "06:00";
        let parts = lm.split(':');
        let lmHour = parseInt(parts[0]) || 0;
        let lmMin = parseInt(parts[1]) || 0;
        let lmVal = lmHour + lmMin / 60;

        let now = new Date();
        let nowVal = now.getHours() + now.getMinutes() / 60;

        let targetDate = new Date(now);

        if (lmVal <= 12) {
            if (nowVal < lmVal) {
                targetDate.setDate(targetDate.getDate() - 1);
            }
        } else {
            if (nowVal >= lmVal) {
                targetDate.setDate(targetDate.getDate() + 1);
            }
        }
        return getLocalISODate(targetDate);
    }

    _loadChartData() {
        const config = this.tileData.config || {};
        let csvPath = config.csvPath || '~/.config/screentime-desklet/uptime_log.csv';
        let csv = expandPath(csvPath);
        let logicalToday = this._getLogicalDate(config.logicalMidnight || '06:00');
        
        let fileExists = GLib.file_test(csv, GLib.FileTest.EXISTS);
        let logMap = {};
        if (fileExists) {
            let [ok, raw] = GLib.file_get_contents(csv);
            if (ok) {
                let lines = decodeBytes(raw).trim().split(/\r?\n/).filter(l => l.trim().length > 0);
                for (let line of lines) {
                    let parts = line.split(',');
                    if (parts.length >= 3) {
                        let dStr = parts[0].trim();
                        let h = parseInt(parts[1]) || 0;
                        let m = parseInt(parts[2]) || 0;
                        logMap[dStr] = h * 60 + m;
                    }
                }
            }
        }
        
        let days = [];
        let parts = logicalToday.split('-');
        let todayObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        for (let i = 6; i >= 0; i--) {
            let target = new Date(todayObj);
            target.setDate(todayObj.getDate() - i);
            let iso = getLocalISODate(target);
            let label = target.toLocaleDateString('en-US', { weekday: 'short' });
            let mins = logMap[iso] || 0;
            let hours = (mins / 60).toFixed(1);
            days.push({ iso: iso, label: label, mins: mins, hours: hours });
        }
        return days;
    }

    _renderUI(daysData) {
        this._layoutBox.remove_all_children();

        const config = this.tileData.config || {};
        const limitMax = config.limitMax || 16;
        const limitWarn = config.limitWarn || 8;
        const limitCrit = config.limitCrit || 12;

        const maxMins = limitMax * 60;
        const warnMins = limitWarn * 60;
        const critMins = limitCrit * 60;

        const colorLow = config.colorLow || '#a8c7fa';
        const colorMed = config.colorMed || '#f6993f';
        const colorHigh = config.colorHigh || '#e3361f';

        // Root container
        const root = new St.BoxLayout({
            vertical: true,
            style: 'background-color: transparent; padding: 8px 10px;',
            x_expand: true,
            y_expand: true
        });
        this._layoutBox.add_child(root);

        // Today's total (last item in array)
        let todayData = daysData[daysData.length - 1];
        let todayHours = Math.floor(todayData.mins / 60);
        let todayMins = todayData.mins % 60;

        // Main Content Row (Left: 7-Day Bar Chart, Right: Used for Xh Ym Display)
        const bodyRow = new St.BoxLayout({
            vertical: false,
            style: 'padding: 0px;',
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        root.add_child(bodyRow);

        // Left Section: 7-Day Bar Chart
        const chartRow = new St.BoxLayout({
            vertical: false,
            x_expand: false
        });
        bodyRow.add_child(chartRow);

        const chartHeight = 56;

        for (let i = 0; i < daysData.length; i++) {
            let day = daysData[i];
            let isToday = (i === daysData.length - 1);

            let dayCol = new St.BoxLayout({
                vertical: true,
                style: 'margin: 0px 3px;',
                x_expand: false,
                x_align: St.Align.MIDDLE,
                opacity: isToday ? 255 : 128
            });

            // Hours label
            let hrsLabel = new St.Label({
                text: parseFloat(day.hours) + 'h',
                style: 'color: ' + (isToday ? '#ffffff' : 'rgba(255, 255, 255, 0.65)') + ';'
                     + 'font-family: "Inter", sans-serif; font-size: 8px; font-weight: 600; text-align: center;'
            });
            dayCol.add_child(hrsLabel);

            // Bar Track
            let track = new St.BoxLayout({
                vertical: true,
                style: 'min-height: ' + chartHeight + 'px; height: ' + chartHeight + 'px; min-width: 18px; width: 18px;'
                     + 'background-color: rgba(255, 255, 255, 0.06);'
                     + 'border-radius: 4px; margin: 2px 0px;',
                x_align: St.Align.MIDDLE,
                y_align: St.Align.END,
                y_expand: true
            });

            // Top spacer so bar fills from bottom
            track.add_child(new St.Widget({ y_expand: true }));

            // Bar Fill
            let fillHeight = Math.max(0, Math.min(chartHeight, Math.round((day.mins / maxMins) * chartHeight)));
            
            let barClr = colorLow;
            if (day.mins >= critMins) {
                barClr = colorHigh;
            } else if (day.mins >= warnMins) {
                barClr = colorMed;
            }

            let fill = new St.Widget({
                style: 'min-height: ' + fillHeight + 'px; height: ' + fillHeight + 'px; min-width: 18px; width: 18px;'
                     + 'background-color: ' + barClr + ';'
                     + 'border-radius: 3px 3px 0px 0px;'
            });
            track.add_child(fill);
            dayCol.add_child(track);

            // Day label
            let dayLabel = new St.Label({
                text: day.label,
                style: 'color: ' + (isToday ? '#ffffff' : 'rgba(255, 255, 255, 0.5)') + ';'
                     + 'font-family: "Inter", sans-serif; font-size: 8px; font-weight: 600; text-align: center;'
            });
            dayCol.add_child(dayLabel);

            chartRow.add_child(dayCol);
        }

        // Right Section: Current Day Screen Time (Center-Aligned Stacked Display)
        const rightBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            style: 'margin-left: 8px; padding-left: 4px; border-left: 1px solid rgba(255, 255, 255, 0.08);'
        });
        rightBox.set_x_align(Clutter.ActorAlign.CENTER);
        rightBox.set_y_align(Clutter.ActorAlign.CENTER);
        bodyRow.add_child(rightBox);

        const usedTitle = new St.Label({
            text: 'Used for',
            style: 'color: rgba(255, 255, 255, 0.6); font-size: 11px; font-weight: 700; font-family: "Inter", sans-serif; text-align: center; margin-bottom: 2px;'
        });
        usedTitle.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        usedTitle.clutter_text.set_line_wrap(false);
        usedTitle.set_x_align(Clutter.ActorAlign.CENTER);
        rightBox.add_child(usedTitle);

        let todayClr = colorLow;
        if (todayData.mins >= critMins) todayClr = colorHigh;
        else if (todayData.mins >= warnMins) todayClr = colorMed;

        const hoursLabel = new St.Label({
            text: todayHours + 'h',
            style: 'color: ' + todayClr + '; font-size: 18px; font-weight: 800; font-family: "Inter", sans-serif; text-align: center;'
        });
        hoursLabel.set_x_align(Clutter.ActorAlign.CENTER);
        rightBox.add_child(hoursLabel);

        const minsLabel = new St.Label({
            text: todayMins + 'm',
            style: 'color: ' + todayClr + '; font-size: 18px; font-weight: 800; font-family: "Inter", sans-serif; text-align: center;'
        });
        minsLabel.set_x_align(Clutter.ActorAlign.CENTER);
        rightBox.add_child(minsLabel);
    }
}

module.exports = ScreentimeWidget;
