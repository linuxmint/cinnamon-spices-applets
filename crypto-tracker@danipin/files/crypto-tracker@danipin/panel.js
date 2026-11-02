const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const Utils = imports.utils.Utils;

var _applet;

function init(applet) {
    _applet = applet;
}

function updateMetricDisplay(idx, alphaMultiplier) {
    let m = _applet.metrics[idx];
    let cur = (_applet.settings.getValue(m.key_cur) || "usd").toLowerCase();
    let syms = { "usd": "$", "eur": "€", "gbp": "£" };
    let showSym = _applet.settings.getValue(m.key_show_sym);
    let currencyDisplay = showSym ? (syms[cur] || cur.toUpperCase()) : cur.toUpperCase();
    let hasIcon = false;

    // Check if alarm is active (for icon color)
    let alertPrice = parseFloat(_applet.settings.getValue("metric" + idx + "-alert-price")) || 0;
    let alertPercent = parseFloat(_applet.settings.getValue("metric" + idx + "-alert-percent")) || 0;
    let isAlarm = (alertPrice > 0 && m.last_alert_price === alertPrice) || (alertPercent > 0 && m.last_alert_percent === alertPercent);

    // Apply styles first
    applyPanelStyles(idx);

    if (_applet.settings.getValue(m.key_show_icon)) {
        let possibleNames = [m.ticker, (_applet.settings.getValue(m.key_sym) || "").toLowerCase().trim(), _applet._getId(idx), "emblem-money"];
        let foundFile = null;
        for (let name of possibleNames) {
            if (!name) continue;
            let path = _applet.metadata.path + "/icons/" + name + "-symbolic.svg";
            if (Gio.file_new_for_path(path).query_exists(null)) { foundFile = path; break; }
        }
        if (foundFile) {
            let style = ""; // Alarm color is now controlled by animation
            let icon = new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(foundFile) }), 
                icon_size: 20, 
                style_class: 'applet-icon',
                style: style
            });
            icon.set_opacity(isAlarm ? 255 : 255 * alphaMultiplier);
            m.icon_bin.set_child(icon); m.icon_bin.show(); hasIcon = true;
        } else m.icon_bin.hide();
    } else m.icon_bin.hide();

    // Control alarm animation (Pulsing)
    if (m.updateAlarmState) {
        m.updateAlarmState(isAlarm);
        if (!isAlarm && m.stopAnim) m.stopAnim(); // Force style reset
    }

    let displaySymbol = (hasIcon) ? "" : (_applet.settings.getValue(m.key_sym) || "");
    if (displaySymbol) {
        m.ticker_label.set_text(displaySymbol);
        m.ticker_label.show();
    } else {
        m.ticker_label.hide();
    }

    let pricePart = " " + currencyDisplay + Utils.formatPrice(m.current_price_val, idx);
    m.text_label.set_text(pricePart);
    
    if (isAlarm && displaySymbol) {
        m.ticker_label.set_style("margin-top: 1px; font-family: 'Ubuntu Mono', 'Monospace'; font-weight: bold; color: #e67e22;");
    }
}

function applyPanelStyles(idx) {
    let m = _applet.metrics[idx];
    if (!m) return;

    // FIX: Panel color ALWAYS based on 24h trend, as this is updated in background.
    // The timeframe trend is only displayed in the menu where chart data is loaded.
    let currentChange = m.change_pct;

    let trendColor = (currentChange < 0) ? 
        (_applet.settings.getValue(m.key_down) || "#d9534f") : 
        (_applet.settings.getValue(m.key_up) || "#449d44");

    let showArrowsGlobal = _applet.settings.getValue("global-show-arrows") ?? true;

    if (showArrowsGlobal) {
        m.arrow_label.set_text(currentChange < 0 ? "▼" : "▲"); 
        m.arrow_label.set_style("color: " + trendColor + "; padding-right: 3px; font-size: 12px; margin-top: 1px;");
        m.arrow_label.show();
    } else { 
        m.arrow_label.hide(); 
    }

    let baseStyle = "margin-top: 1px; font-family: 'Ubuntu Mono', 'Monospace'; font-weight: bold; color: #ffffff;"; 
    let style = _applet.settings.getValue(m.key_color_arrow_only) ? 
        baseStyle : baseStyle + " color: " + trendColor + ";";
    
    m.text_label.set_style(style);
    if (m.ticker_label) m.ticker_label.set_style(style);
}

var Panel = {
    init: init,
    updateMetricDisplay: updateMetricDisplay,
    applyPanelStyles: applyPanelStyles
};