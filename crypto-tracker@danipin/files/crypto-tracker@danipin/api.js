const Util = imports.misc.util;
const Gio = imports.gi.Gio; // Used for notify-send icon path
const DataPersistence = imports.data_persistence.DataPersistence;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Cairo = imports.gi.cairo;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Gtk = imports.gi.Gtk;
const Utils = imports.utils.Utils;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext;
const UUID = "crypto-tracker@danipin";

function _(str) {
  return Gettext.dgettext(UUID, str);
}

let _applet = null; // Reference to the main applet instance

function init(appletInstance) {
    _applet = appletInstance;
}

let _validationTimeout = null;

function _validateKeySilently() {
    if (_validationTimeout) {
        Mainloop.source_remove(_validationTimeout);
        _validationTimeout = null;
    }

    // Debounce: Wait 1 second after the last keystroke
    _validationTimeout = Mainloop.timeout_add(1000, () => {
        _validationTimeout = null;
        let apiKey = (_applet.settings.getValue("api-key") || "").trim();
        
        if (!apiKey || apiKey.length < 5) {
            _applet.apiValid = false;
            _applet.apiError = null;
            DataPersistence.saveCallStats();
            _applet.updatePrices();
            _applet._buildMenu(); // FIX: Rebuild menu immediately to hide charts
            return false;
        }

        let wasValidBefore = _applet.apiValid;

        // The ping check also consumes a request with the API key (for exact statistics)
        _applet.keyCalls++;
        _applet.allTimeCalls = (_applet.allTimeCalls || 0) + 1;
        DataPersistence.saveCallStats();

        // We use -i and additionally check for the word "pong",
        // which CoinGecko sends in the body on success.
        Util.spawn_async(['curl', '-i', '--silent', '--max-time', '10', '-H', 'x-cg-demo-api-key: ' + apiKey, 'https://api.coingecko.com/api/v3/ping'], (stdout) => {
            try {
                // Robust check: Either "200 OK" in header or "gecko_says" in body (Ping response)
                if (stdout && (stdout.includes("200 OK") || stdout.includes("gecko_says"))) {
                    _applet.apiValid = true;
                    _applet.successfulPings = (_applet.successfulPings || 0) + 1;
                    DataPersistence.saveCallStats();
                    _applet.apiError = null;
                    if (!wasValidBefore) {
                        Utils.sendNotification("Crypto-Tracker", _("API successfully activated."), "cheerful.oga", "emblem-ok-symbolic");
                    }
                } else {
                    _applet.apiValid = false;
                    
                    if (!stdout || stdout.trim() === "") {
                        _applet.apiError = _("No internet connection");
                    } else if (stdout.includes("401")) {
                        _applet.apiError = _("Key invalid");
                    } else if (stdout.includes("403")) {
                        _applet.apiError = _("Key blocked");
                    } else if (stdout.includes("429")) {
                        _applet.apiError = _("Limit reached");
                    } else {
                        _applet.apiError = _("Server error");
                    }

                    if (wasValidBefore) {
                        Utils.sendNotification("Crypto-Tracker", _("API Error: %s").format(_applet.apiError), "suspend-error.oga", "dialog-warning");
                    }
                }
            } catch (e) { 
                _applet.apiValid = false; 
                _applet.apiError = _("System error");
            }
            _applet.updatePrices();
            _applet._buildMenu(); 
        });
        return false;
    });
}

function destroy() {
    if (_validationTimeout) {
        Mainloop.source_remove(_validationTimeout);
        _validationTimeout = null;
    }
}

function createStatsSection(maxHeight) {
    let section = new PopupMenu.PopupMenuSection();
    
    // Scrollable Container
    let scrollItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class: "popup-menu-item" });
    scrollItem.actor.style = "padding: 0px; margin: 0px; max-height: " + maxHeight + "px;";
    
    let scrollView = new St.ScrollView({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        style_class: 'vfade',
        style: "max-height: " + maxHeight + "px;",
        reactive: true
    });

    // Container
    let container = new St.BoxLayout({ vertical: true, style: "padding: 8px 40px 20px 40px;" });
    
    scrollView.add_actor(container);
    let scrollBox = Utils.addScrollArrows(scrollView);
    scrollItem.addActor(scrollBox, { expand: true, span: -1 });
    section.addMenuItem(scrollItem);

    // --- INTELLIGENT SYSTEM CHECK ---
    let healthBox = new St.BoxLayout({ vertical: true, style: "background-color: " + _applet.colors.bg_popup + "; border-radius: 5px; padding: 10px; margin-bottom: 15px;" });
    let healthTitle = new St.Label({ text: _("System Diagnosis"), style: "font-weight: bold; font-size: 13px; margin-bottom: 5px; color: " + _applet.colors.text + ";" });
    healthBox.add(healthTitle);

    let addHealthRow = (icon, text, color) => {
        let row = new St.BoxLayout({ y_align: St.Align.MIDDLE, style: "padding: 2px 0;" });
        row.add(new St.Icon({ icon_name: icon, icon_size: 14, style: "color: " + color + "; margin-right: 8px;" }));
        row.add(new St.Label({ text: text, style: "font-size: 11px; color: " + _applet.colors.text_dim + ";" }));
        healthBox.add(row);
    };

    // 1. API Key Check
    if (_applet.apiValid) {
        addHealthRow("emblem-ok-symbolic", _("API Connection: Active & Valid"), "#449d44");
    } else {
        let err = _applet.apiError || _("Not configured");
        addHealthRow("dialog-error-symbolic", _("API Status: %s").format(err), "#d9534f");
    }

    // 2. Quota Check
    let limit = 10000;
    let usage = _applet.keyCalls;
    let pct = (usage / limit) * 100;
    if (pct > 90) {
        addHealthRow("weather-storm-symbolic", _("Quota critical: %s%% used").format(pct.toFixed(1)), "#d9534f");
    } else if (pct > 75) {
        addHealthRow("weather-clouds-symbolic", _("Quota high: %s%% used").format(pct.toFixed(1)), "#e67e22");
    } else {
        addHealthRow("weather-clear-symbolic", _("Quota: %s%% (In the green)").format(pct.toFixed(1)), "#449d44");
    }

    // 2b. Days Remaining (Context for Quota)
    let now = new Date();
    let lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let daysLeft = lastDay.getDate() - now.getDate();
    addHealthRow("appointment-soon-symbolic", _("Period: %s days left in month.").format(daysLeft), "#5bc0de");

    // 3. Config Check (Free Tier Interval)
    let interval = _applet.settings.getValue("update-interval-seconds");
    let apiKey = _applet.settings.getValue("api-key");
    if ((!apiKey || apiKey.length < 5) && interval < 60) {
        addHealthRow("dialog-warning-symbolic", _("Tip: Interval (%ss) is aggressive for Free Tier.").format(interval), "#e67e22");
    }

    // 4. Error Log Check
    let logPath = Utils.getCacheDir() + "/error_log.txt";
    let logFile = Gio.file_new_for_path(logPath);
    if (logFile.query_exists(null)) {
        addHealthRow("dialog-information-symbolic", _("Note: Error log exists."), "#5bc0de");
    } else {
        addHealthRow("emblem-ok-symbolic", _("System: No crashes logged."), "#449d44");
    }

    container.add(healthBox);

    // Split View
    let splitBox = new St.BoxLayout({ style: "margin-bottom: 15px;" });
    
    // Helper for stats rows
    let createStatRow = (label, val, color) => {
        let box = new St.BoxLayout({ style: "padding: 2px 0;" });
        box.add(new St.Label({ text: label, style: "width: 100px; font-size: 12px; color: " + _applet.colors.text_dim + ";" }));
        box.add(new St.Label({ text: val.toString(), style: "font-weight: bold; font-size: 12px; color: " + color + ";" }));
        return box;
    };

    // Get data for today
    let today = new Date().toISOString().split('T')[0];
    let todayStats = (_applet.dailyHistory && _applet.dailyHistory[today]) ? _applet.dailyHistory[today] : { key: 0, basic: 0 };

    // Left: Free API
    let freeBox = new St.BoxLayout({ vertical: true, style: "width: 50%; margin-right: 10px;" });
    freeBox.add(new St.Label({ text: _("Free API (Basic)"), style: "font-weight: bold; color: " + _applet.colors.text_dim + "; margin-bottom: 8px; font-size: 13px;" }));
    freeBox.add(createStatRow(_("Today:"), todayStats.basic, _applet.colors.text_dim));
    freeBox.add(createStatRow(_("Month:"), _applet.basicCalls, _applet.colors.text_dim));
    freeBox.add(createStatRow(_("Ø per Day:"), _applet.avgBasicPerDay || 0, _applet.colors.text_dim));
    
    // Right: Key API
    let keyBox = new St.BoxLayout({ vertical: true, style: "width: 50%; margin-left: 10px;" });
    keyBox.add(new St.Label({ text: _("Key API (Pro)"), style: "font-weight: bold; color: #e67e22; margin-bottom: 8px; font-size: 13px;" }));
    keyBox.add(createStatRow(_("Today:"), todayStats.key, "#e67e22"));
    keyBox.add(createStatRow(_("Month:"), _applet.keyCalls, "#e67e22"));
    keyBox.add(createStatRow(_("Ø per Day:"), _applet.avgPerDay, "#e67e22"));

    splitBox.add(freeBox);
    splitBox.add(keyBox);
    container.add(splitBox);

    // Separator
    let sep = new St.Bin({ style: "height: 1px; background-color: " + _applet.colors.divider + "; margin-bottom: 15px;" });
    container.add(sep);

    // Breakdown Area (Verteilung)
    let breakdownHeader = new St.BoxLayout({ style: "margin-bottom: 5px; margin-top: 0px;" });
    breakdownHeader.add(new St.Label({ text: _("Distribution (Key Calls)"), style: "font-weight: bold; font-size: 13px; color: " + _applet.colors.text + ";" }));
    container.add(breakdownHeader);

    let breakdownArea = new St.DrawingArea({ style: "height: 150px; width: 100%; background-color: " + _applet.colors.bg_popup + "; border-radius: 5px;", reactive: true });
    Utils.safeRepaint(breakdownArea, (area, cr, w, h) => {
        
        let total = _applet.keyCalls || 1; // Avoid division by zero
        let charts = _applet.chartCalls || 0;
        let details = _applet.detailCalls || 0;
        let search = _applet.searchCalls || 0;
        let portfolio = _applet.portfolioCalls || 0;
        let alarms = _applet.alarmCalls || 0;
        let updates = Math.max(0, total - charts - details - search - portfolio - alarms); // Rest are normal updates

        let items = [
            { label: _("Charts"), val: charts, color: [0.2, 0.6, 1] }, // Blue
            { label: _("Details"), val: details, color: [0.8, 0.4, 1] }, // Purple
            { label: _("Search"), val: search, color: [1, 0.8, 0.2] }, // Yellow
            { label: _("Portfolio"), val: portfolio, color: [0.2, 0.8, 0.8] }, // Cyan
            { label: _("Alarms"), val: alarms, color: [1, 0.4, 0.4] }, // Red/Pink
            { label: _("Updates"), val: updates, color: [0.2, 0.8, 0.2] } // Green (Basic)
        ];

        let barH = 12;
        let gap = 10;
        let startY = 15;

        items.forEach((item, i) => {
            let y = startY + i * (barH + gap);
            let pct = (item.val / total);
            let barW = (w - 100) * pct; // 100px space for text

            // Label
            let tc = Utils.parseColorString(_applet.colors.text_dim);
            cr.setSourceRGBA(tc.r, tc.g, tc.b, tc.a);
            let layoutLabel = PangoCairo.create_layout(cr);
            layoutLabel.set_text(item.label, -1);
            layoutLabel.set_font_description(Pango.FontDescription.from_string("Sans 11"));
            let [inkL, logL] = layoutLabel.get_pixel_extents();
            cr.moveTo(10, y + (barH - logL.height) / 2);
            PangoCairo.show_layout(cr, layoutLabel);

            // Bar Background
            let divC = Utils.parseColorString(_applet.colors.divider);
            let bgAlpha = _applet.isDarkMode ? (divC.a + 0.01) : 0.08;
            cr.setSourceRGBA(divC.r, divC.g, divC.b, bgAlpha);
            cr.rectangle(80, y, w - 90, barH);
            cr.fill();

            // Bar Value
            cr.setSourceRGBA(item.color[0], item.color[1], item.color[2], 1);
            cr.rectangle(80, y, Math.max(2, barW), barH);
            cr.fill();

            // Value Text
            let tc2 = Utils.parseColorString(_applet.colors.text);
            cr.setSourceRGBA(tc2.r, tc2.g, tc2.b, tc2.a);
            let valText = item.val + " (" + (pct * 100).toFixed(1) + "%)";
            let layoutVal = PangoCairo.create_layout(cr);
            layoutVal.set_text(valText, -1);
            layoutVal.set_font_description(Pango.FontDescription.from_string("Sans 11"));
            let [inkV, logV] = layoutVal.get_pixel_extents();
            cr.moveTo(80 + Math.max(2, barW) + 5, y + (barH - logV.height) / 2);
            PangoCairo.show_layout(cr, layoutVal);
        });
    });
    container.add(breakdownArea);

    // Chart Area
    let chartHeader = new St.BoxLayout({ style: "margin-bottom: 5px; margin-top: 20px;" });
    chartHeader.add(new St.Label({ text: _("History (Last 14 Days)"), style: "font-weight: bold; font-size: 13px; color: " + _applet.colors.text + ";" }));
    container.add(chartHeader);
    
    let chartArea = new St.DrawingArea({ style: "height: 150px; width: 100%; background-color: " + _applet.colors.bg_popup + "; border-radius: 5px;", reactive: true });
    Utils.safeRepaint(chartArea, (area, cr, w, h) => {
        
        // Prepare data (last 14 days)
        let days = [];
        let maxVal = 10; // At least 10 as scale
        for (let i = 13; i >= 0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            let dateStr = d.toISOString().split('T')[0];
            let dayLabel = d.getDate().toString() + "." + (d.getMonth() + 1).toString();
            let s = (_applet.dailyHistory && _applet.dailyHistory[dateStr]) ? _applet.dailyHistory[dateStr] : { key: 0, basic: 0 };
            days.push({ label: dayLabel, key: s.key, basic: s.basic });
            if (s.key > maxVal) maxVal = s.key;
            if (s.basic > maxVal) maxVal = s.basic;
        }

        // Draw
        let padLeft = 35; // Space for Y-axis
        let padRight = 10;
        let barW = (w - padLeft - padRight) / 14;
        let gap = barW * 0.2;
        let drawW = barW - gap;
        let chartHeight = h - 35;
        let scaleH = chartHeight / maxVal;

        // Draw Grid & Y-axis
        cr.setLineWidth(1);
        let steps = 2; // 0, 50%, 100%
        for (let i = 1; i <= steps; i++) {
            let val = (maxVal / steps) * i;
            let y = (h - 20) - (val * scaleH);
            
            // Grid Line
            let gridC = Utils.parseColorString(_applet.colors.divider);
            cr.setSourceRGBA(gridC.r, gridC.g, gridC.b, gridC.a);
            cr.moveTo(padLeft, y);
            cr.lineTo(w - padRight, y);
            cr.stroke();
            
            // Label
            let labelC = Utils.parseColorString(_applet.colors.text_more_dim);
            cr.setSourceRGBA(labelC.r, labelC.g, labelC.b, labelC.a);
            let txt = Math.round(val).toString();
            let layout = PangoCairo.create_layout(cr);
            layout.set_text(txt, -1);
            layout.set_font_description(Pango.FontDescription.from_string("Sans 9"));
            let [ink, log] = layout.get_pixel_extents();
            cr.moveTo(padLeft - log.width - 5, y - log.height / 2);
            PangoCairo.show_layout(cr, layout);
        }

        days.forEach((d, i) => {
            let x = padLeft + (i * barW) + (gap / 2);
            let yBase = h - 20;
            let subBarW = drawW / 2;

            // Basic Bar (Gray, Left)
            let hBasic = d.basic * scaleH;
            if (hBasic > 0) {
                let barC = Utils.parseColorString(_applet.colors.text_more_dim);
                cr.setSourceRGBA(barC.r, barC.g, barC.b, 0.3);
                cr.rectangle(x, yBase - hBasic, subBarW - 1, hBasic);
                cr.fill();
            }

            // Key Bar (Orange, Right)
            let hKey = d.key * scaleH;
            if (hKey > 0) {
                cr.setSourceRGBA(0.9, 0.5, 0.1, 0.9); // #e67e22
                cr.rectangle(x + subBarW, yBase - hKey, subBarW - 1, hKey);
                cr.fill();
            }

            // Label (show only every 2nd day if space is tight)
            if (i % 2 === 0 || w > 400) {
                let labelC = Utils.parseColorString(_applet.colors.text_more_dim);
                cr.setSourceRGBA(labelC.r, labelC.g, labelC.b, labelC.a);
                let layout = PangoCairo.create_layout(cr);
                layout.set_text(d.label, -1);
                layout.set_font_description(Pango.FontDescription.from_string("Sans 9"));
                let [ink, log] = layout.get_pixel_extents();
                cr.moveTo(x + (drawW - log.width) / 2, h - log.height - 2);
                PangoCairo.show_layout(cr, layout);
            }
        });
    });
    
    container.add(chartArea);

    // Legend
    let legendBox = new St.BoxLayout({ style: "padding-top: 10px; padding-left: 0px;" });
    let createLegendItem = (color, text, opacity = 255) => {
        let box = new St.BoxLayout({ style: "margin-right: 15px;", y_align: St.Align.MIDDLE });
        let dot = new St.Bin({ style: "width: 10px; height: 10px; background-color: " + color + "; border-radius: 5px; margin-right: 5px;" });
        if (opacity < 255) dot.set_opacity(opacity);
        let lbl = new St.Label({ text: text, style: "font-size: 11px; color: " + _applet.colors.text_dim + ";" });
        box.add(dot); box.add(lbl);
        return box;
    };
    legendBox.add(createLegendItem(_applet.colors.text_more_dim, _("Free API (Basic)"), 128));
    legendBox.add(createLegendItem("#e67e22", _("Key API (Pro)")));
    container.add(legendBox);

    // FIX: Error Log Display and Management
    try {
        if (_applet._hideErrorLogWarning) throw "Dismissed"; // Skip if dismissed

        let logPath = Utils.getCacheDir() + "/error_log.txt";
        let logFile = Gio.file_new_for_path(logPath);
        if (logFile.query_exists(null)) {
            let info = logFile.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null);
            let size = info.get_size();
            
            // Only show if relevant data is present (> 200 bytes for header etc.)
            if (size > 200) {
                let errBox = new St.BoxLayout({ vertical: true, style: "margin-top: 20px; padding: 10px; background-color: rgba(217, 83, 79, 0.1); border: 1px solid rgba(217, 83, 79, 0.3); border-radius: 5px;" });
                
                let errHead = new St.BoxLayout({ y_align: St.Align.MIDDLE });
                errHead.add(new St.Icon({ icon_name: "dialog-warning-symbolic", style: "color: #d9534f; font-size: 16px; margin-right: 8px;" }));
                errHead.add(new St.Label({ text: _("Error Log (%s KB)").format((size / 1024).toFixed(1)), style: "color: #d9534f; font-weight: bold;" }));
                errBox.add(errHead);
                
                let errInfo = new St.Label({ text: _("The system prevented and logged crashes."), style: "color: " + _applet.colors.text_dim + "; font-size: 11px; margin: 5px 0;" });
                errBox.add(errInfo);
                
                let btnBox = new St.BoxLayout({ style: "spacing: 5px;" });

                let btnDelete = new St.Button({ 
                    label: _("Delete"), 
                    style: "width: 50%; padding: 4px; background-color: rgba(217, 83, 79, 0.2); color: #d9534f; border-radius: 4px; text-align: center; font-weight: bold; font-size: 11px;",
                    reactive: true
                });
                
                btnDelete.connect('clicked', () => {
                    try {
                        logFile.delete(null);
                        _applet._buildMenu(); // Refresh UI
                    } catch(e) {}
                });

                let btnDismiss = new St.Button({ 
                    label: _("Dismiss"), 
                    style: "width: 50%; padding: 4px; background-color: " + _applet.colors.bg_input + "; color: " + _applet.colors.text_dim + "; border-radius: 4px; text-align: center; font-size: 11px;",
                    reactive: true
                });
                btnDismiss.connect('clicked', () => {
                    _applet._hideErrorLogWarning = true;
                    _applet._buildMenu();
                });
                
                btnBox.add(btnDelete);
                btnBox.add(btnDismiss);
                errBox.add(btnBox);
                container.add(errBox);
            }
        }
    } catch(e) {}

    return section;
}

var ApiConfig = {
    init: init,
    validateKeySilently: _validateKeySilently,
    createStatsSection: createStatsSection,
    destroy: destroy
};
