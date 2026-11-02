const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Cairo = imports.cairo;
const Mainloop = imports.mainloop;

const UUID = "internet-quality@wertos97";

function parseColor(value, fallback) {
    let text = String(value || "").trim();
    let match = text.match(/^#([0-9a-f]{6})$/i);
    if (match) {
        let hex = match[1];
        return [parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255, 1];
    }
    match = text.match(/^rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (match)
        return [Number(match[1]) / 255, Number(match[2]) / 255,
            Number(match[3]) / 255, 1];
    return fallback ? parseColor(fallback) : [1, 1, 1, 1];
}

function colorToCss(value, fallback) {
    let color = parseColor(value, fallback);
    return "rgb(" + color.slice(0, 3).map(channel =>
        Math.round(channel * 255)).join(",") + ")";
}

function colorToRgbaCss(value, fallback, opacity) {
    let color = parseColor(value, fallback);
    let alpha = Math.max(0, Math.min(100, Number(opacity) || 0)) / 100;
    return "rgba(" + color.slice(0, 3).map(channel =>
        Math.round(channel * 255)).join(",") + "," + alpha + ")";
}

const THEMES = {
    traffic_dark: {
        color_excellent: "#35a854", color_good: "#76b947",
        color_fair: "#d29a2e", color_poor: "#d16b32",
        color_very_poor: "#c84b50", color_offline: "#8f3338",
        color_inactive: "#5e5e5e", color_border: "#202020",
        color_glow: "#ffffff", popup_background: "#303030",
        popup_text: "#f5f5f5", popup_muted: "#b8b8b8",
        popup_accent: "#76b947"
    },
    ocean_dark: {
        color_excellent: "#32b8b0", color_good: "#3c9fd1",
        color_fair: "#557fd1", color_poor: "#7765c2",
        color_very_poor: "#b65377", color_offline: "#8f3c54",
        color_inactive: "#46505a", color_border: "#17212a",
        color_glow: "#65d9ff", popup_background: "#26313a",
        popup_text: "#eef8ff", popup_muted: "#a9bac6",
        popup_accent: "#55bde8"
    },
    violet_dark: {
        color_excellent: "#8c72d9", color_good: "#a084df",
        color_fair: "#d39a42", color_poor: "#d26f57",
        color_very_poor: "#ca5368", color_offline: "#8e3c50",
        color_inactive: "#514b5c", color_border: "#211c2b",
        color_glow: "#bb9cff", popup_background: "#312b3a",
        popup_text: "#f7f1ff", popup_muted: "#c0b4cc",
        popup_accent: "#a98be8"
    },
    graphite_light: {
        color_excellent: "#258653", color_good: "#4c9141",
        color_fair: "#a67518", color_poor: "#b65d2c",
        color_very_poor: "#b43d49", color_offline: "#8f3540",
        color_inactive: "#c6c9cd", color_border: "#73777c",
        color_glow: "#ffffff", popup_background: "#eceeef",
        popup_text: "#202326", popup_muted: "#666b70",
        popup_accent: "#258653"
    },
    pastel_light: {
        color_excellent: "#55a681", color_good: "#7eaf6a",
        color_fair: "#c49b54", color_poor: "#c77b62",
        color_very_poor: "#bd6375", color_offline: "#9b5260",
        color_inactive: "#d8d0c7", color_border: "#8f867d",
        color_glow: "#ffffff", popup_background: "#f4eee7",
        popup_text: "#322d29", popup_muted: "#746b64",
        popup_accent: "#4c9877"
    },
    high_contrast: {
        color_excellent: "#00ff48", color_good: "#73ff00",
        color_fair: "#ffe600", color_poor: "#ff8a00",
        color_very_poor: "#ff3030", color_offline: "#ff0000",
        color_inactive: "#444444", color_border: "#ffffff",
        color_glow: "#ffffff", popup_background: "#000000",
        popup_text: "#ffffff", popup_muted: "#cfcfcf",
        popup_accent: "#00ff48"
    },
    monochrome: {
        color_excellent: "#e6e6e6", color_good: "#d0d0d0",
        color_fair: "#b8b8b8", color_poor: "#989898",
        color_very_poor: "#787878", color_offline: "#606060",
        color_inactive: "#404040", color_border: "#1c1c1c",
        color_glow: "#ffffff", popup_background: "#303030",
        popup_text: "#f2f2f2", popup_muted: "#b0b0b0",
        popup_accent: "#e6e6e6"
    }
};

class InternetQualityApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_show_label_in_vertical_panels(false);

        this.metadata = metadata;
        this._destroyed = false;
        this._process = null;
        this._probeTimer = 0;
        this._watchdogTimer = 0;
        this._networkChangedTimer = 0;
        this._samples = [];
        this._score = 0;
        this._latency = null;
        this._jitter = null;
        this._loss = 100;
        this._dnsLatency = null;
        this._dnsOk = null;
        this._method = null;
        this._lastCheck = 0;
        this._probeCount = 0;
        this._offlineStreak = 0;
        this._error = null;

        this._dots = new St.DrawingArea();
        this._dots.connect("repaint", area => this._drawDots(area));
        this._applet_icon_box.set_child(this._dots);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        let section = new PopupMenu.PopupMenuSection();
        this._content = new St.BoxLayout({ vertical: true, style_class: "internet-quality-popup" });
        this._title = new St.Label({ style_class: "internet-quality-title", text: _("Internet quality") });
        this._summary = new St.Label({ style_class: "internet-quality-summary", text: _("Measuring...") });
        this._content.add_actor(this._title);
        this._content.add_actor(this._summary);
        this._rows = {};
        this._rowActors = {};
        this._rowKeys = {};
        for (let item of [["latency", _("Latency")], ["jitter", _("Jitter")],
                          ["loss", _("Packet loss")], ["dns", _("DNS")],
                          ["method", _("Probe")]]) {
            let row = new St.BoxLayout({ style_class: "internet-quality-row" });
            let key = new St.Label({ style_class: "internet-quality-key", text: item[1] });
            let value = new St.Label({ style_class: "internet-quality-value", text: "--" });
            row.add(key, { expand: true, x_fill: true });
            row.add_actor(value);
            this._content.add_actor(row);
            this._rows[item[0]] = value;
            this._rowActors[item[0]] = row;
            this._rowKeys[item[0]] = key;
        }
        this._status = new St.Label({ style_class: "internet-quality-status", text: "" });
        this._content.add_actor(this._status);
        section.addActor(this._content);
        this.menu.addMenuItem(section);
        this._separator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._separator);
        this._testItem = new PopupMenu.PopupMenuItem(_("Test now"));
        this._testItem.connect("activate", () => this._startProbe(true));
        this.menu.addMenuItem(this._testItem);

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        for (let key of ["probe_interval", "probe_timeout", "sample_window",
                         "probe_host", "tcp_host", "dns_host"])
            this.settings.bind(key, key, () => this._restartProbing());
        for (let key of ["excellent_latency", "good_latency", "fair_latency",
                         "poor_latency", "indicator_style", "theme_preset", "color_mode",
                         "dot_orientation", "active_direction", "dot_shape",
                         "dot_width", "dot_height", "dot_gap", "horizontal_margin",
                         "vertical_margin", "panel_outer_margin", "dot_offset_x",
                         "dot_offset_y", "dot_corner_radius", "dot_border_width",
                         "dot_glow_width", "dot_glow_opacity", "active_opacity",
                         "inactive_opacity", "inactive_style", "offline_style",
                         "bar_length", "bar_thickness", "bar_corner_radius",
                         "bar_border_width", "bar_segment_lines", "bar_segment_width",
                         "bar_segment_color",
                         "panel_background", "panel_background_color",
                         "panel_background_opacity", "panel_background_radius",
                         "color_active", "color_excellent", "color_good", "color_fair", "color_poor",
                         "color_very_poor", "color_offline", "color_inactive",
                         "color_border", "color_glow", "popup_width", "popup_padding_x",
                         "popup_padding_y", "popup_row_gap", "popup_corner_radius",
                         "popup_title_size", "popup_summary_size", "popup_text_size",
                         "popup_background", "popup_text", "popup_muted", "popup_accent",
                         "popup_bold_values", "popup_show_title", "popup_show_summary",
                         "popup_show_latency", "popup_show_jitter", "popup_show_loss",
                         "popup_show_dns", "popup_show_method", "popup_show_status",
                         "popup_show_test"])
            this.settings.bind(key, key, () => this._applyAppearance());

        this._networkMonitor = Gio.NetworkMonitor.get_default();
        this._networkSignal = this._networkMonitor.connect("network-changed", () => {
            if (this._networkChangedTimer)
                Mainloop.source_remove(this._networkChangedTimer);
            this._networkChangedTimer = Mainloop.timeout_add(500, () => {
                this._networkChangedTimer = 0;
                this._samples = [];
                this._offlineStreak = 0;
                this._startProbe(true);
                return false;
            });
        });

        this._applyAppearance();
        this._updateDisplay();
        this._restartProbing();
    }

    on_applet_clicked() {
        this.menu.toggle();
        if (this.menu.isOpen)
            this._startProbe(true);
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        for (let timer of [this._probeTimer, this._watchdogTimer, this._networkChangedTimer]) {
            if (timer)
                Mainloop.source_remove(timer);
        }
        if (this._process) {
            try { this._process.force_exit(); } catch (e) {}
            this._process = null;
        }
        if (this._networkSignal)
            this._networkMonitor.disconnect(this._networkSignal);
        this.settings.finalize();
    }

    _number(value, fallback, minimum, maximum) {
        let number = Number(value);
        if (!Number.isFinite(number))
            number = fallback;
        return Math.max(minimum, Math.min(maximum, number));
    }

    _themeValue(key, fallback) {
        let theme = THEMES[String(this.theme_preset || "custom")];
        if (theme && theme[key])
            return theme[key];
        return this[key] || fallback;
    }

    _color(key, fallback, opacity = 100) {
        let color = parseColor(this._themeValue(key, fallback), fallback);
        color[3] *= this._number(opacity, 100, 0, 100) / 100;
        return color;
    }

    _setVisible(actor, visible) {
        if (!actor)
            return;
        if (visible)
            actor.show();
        else
            actor.hide();
    }

    _applyAppearance() {
        let dotWidth = this._number(this.dot_width, 4, 2, 16);
        let dotHeight = this._number(this.dot_height, 4, 2, 16);
        let gap = this._number(this.dot_gap, 2, 0, 6);
        let horizontal = this._number(this.horizontal_margin, 1, 0, 12);
        let vertical = this._number(this.vertical_margin, 0, 0, 12);
        let outer = this._number(this.panel_outer_margin, 0, 0, 12);
        let offsetX = Math.abs(this._number(this.dot_offset_x, 0, -10, 10));
        let offsetY = Math.abs(this._number(this.dot_offset_y, 0, -10, 10));
        let isBar = this.indicator_style === "bar";
        let borderWidth = isBar
            ? this._number(this.bar_border_width, 0, 0, 4)
            : this._number(this.dot_border_width, 0, 0, 4);
        let decoration = Math.max(this._number(this.dot_glow_width, 0, 0, 6),
            borderWidth / 2);
        let isHorizontal = this.dot_orientation === "horizontal";
        let barLength = this._number(this.bar_length, 28, 10, 100);
        let barThickness = this._number(this.bar_thickness, 4, 2, 20);
        let indicatorWidth = isBar ? (isHorizontal ? barLength : barThickness)
            : (isHorizontal ? dotWidth * 5 + gap * 4 : dotWidth);
        let indicatorHeight = isBar ? (isHorizontal ? barThickness : barLength)
            : (isHorizontal ? dotHeight : dotHeight * 5 + gap * 4);
        let width = indicatorWidth + horizontal * 2 + decoration * 2 + offsetX * 2;
        let height = indicatorHeight + vertical * 2 + decoration * 2 + offsetY * 2;
        this._dots.set_size(Math.ceil(width), Math.ceil(height));
        let panelStyle = "margin: 0px " + outer + "px;";
        if (this.panel_background === true) {
            panelStyle += " background-color: " + colorToRgbaCss(
                this.panel_background_color, "#202020", this.panel_background_opacity) +
                "; border-radius: " + this._number(
                    this.panel_background_radius, 4, 0, 16) + "px;";
        }
        this._dots.set_style(panelStyle);

        this._content.set_width(this._number(this.popup_width, 230, 180, 400));
        let paddingX = this._number(this.popup_padding_x, 14, 0, 32);
        let paddingY = this._number(this.popup_padding_y, 10, 0, 32);
        let corner = this._number(this.popup_corner_radius, 0, 0, 24);
        let rowGap = this._number(this.popup_row_gap, 2, 0, 12);
        let titleSize = this._number(this.popup_title_size, 11, 7, 24);
        let summarySize = this._number(this.popup_summary_size, 10, 7, 24);
        let textSize = this._number(this.popup_text_size, 9, 7, 20);
        let background = colorToCss(this._themeValue("popup_background", "#303030"), "#303030");
        let text = colorToCss(this._themeValue("popup_text", "#f5f5f5"), "#f5f5f5");
        let muted = colorToCss(this._themeValue("popup_muted", "#b8b8b8"), "#b8b8b8");
        let accent = colorToCss(this._themeValue("popup_accent", "#35a854"), "#35a854");
        this._content.set_style("background-color: " + background + "; color: " + text +
            "; border-radius: " + corner + "px; padding: " + paddingY + "px " +
            paddingX + "px;");
        this._title.set_style("color: " + text + "; font-size: " + titleSize +
            "pt; font-weight: bold; padding-bottom: " + Math.max(0, rowGap + 5) + "px;");
        this._summary.set_style("color: " + accent + "; font-size: " + summarySize +
            "pt; font-weight: bold; padding-bottom: " + Math.max(0, rowGap + 4) + "px;");
        for (let key of Object.keys(this._rows)) {
            this._rowActors[key].set_style("padding: " + rowGap + "px 0px;");
            this._rowKeys[key].set_style("color: " + muted + "; font-size: " + textSize + "pt;");
            this._rows[key].set_style("color: " + text + "; font-size: " + textSize +
                "pt; font-weight: " + (this.popup_bold_values === false ? "normal" : "bold") + ";");
        }
        this._status.set_style("color: " + muted + "; font-size: " +
            Math.max(7, textSize - 1) + "pt; padding-top: " + Math.max(0, rowGap + 4) + "px;");
        this._setVisible(this._title, this.popup_show_title !== false);
        this._setVisible(this._summary, this.popup_show_summary !== false);
        this._setVisible(this._rowActors.latency, this.popup_show_latency !== false);
        this._setVisible(this._rowActors.jitter, this.popup_show_jitter !== false);
        this._setVisible(this._rowActors.loss, this.popup_show_loss !== false);
        this._setVisible(this._rowActors.dns, this.popup_show_dns !== false);
        this._setVisible(this._rowActors.method, this.popup_show_method !== false);
        this._setVisible(this._status, this.popup_show_status !== false);
        this._setVisible(this._testItem.actor, this.popup_show_test !== false);
        this._setVisible(this._separator.actor, this.popup_show_test !== false);
        this._recalculate();
    }

    _restartProbing() {
        if (this._probeTimer) {
            Mainloop.source_remove(this._probeTimer);
            this._probeTimer = 0;
        }
        this._startProbe(true);
    }

    _scheduleNextProbe() {
        if (this._destroyed)
            return;
        if (this._probeTimer)
            Mainloop.source_remove(this._probeTimer);
        let seconds = this._number(this.probe_interval, 3, 2, 60);
        if (this._score > 0 && this._score <= 3)
            seconds = Math.min(seconds, 2);
        else if (this._score === 0) {
            let backoff = [2, 5, 10, 30];
            seconds = backoff[Math.min(backoff.length - 1,
                Math.max(0, this._offlineStreak - 1))];
        }
        this._probeTimer = Mainloop.timeout_add_seconds(seconds, () => {
            this._probeTimer = 0;
            this._startProbe(false);
            return false;
        });
    }

    _startProbe(force) {
        if (this._destroyed)
            return;
        if (force && this._probeTimer) {
            Mainloop.source_remove(this._probeTimer);
            this._probeTimer = 0;
        }
        if (this._process) {
            if (!force)
                return;
            try { this._process.force_exit(); } catch (e) {}
            this._process = null;
            if (this._watchdogTimer) {
                Mainloop.source_remove(this._watchdogTimer);
                this._watchdogTimer = 0;
            }
        }
        this._probeCount++;
        let argv = ["/usr/bin/python3", this.metadata.path + "/internet_probe.py",
            "--target", String(this.probe_host || "8.8.8.8"),
            "--tcp-host", String(this.tcp_host || "1.1.1.1"),
            "--timeout", String(this._number(this.probe_timeout, 2, 1, 5))];
        if (this._probeCount === 1 || this._probeCount % 10 === 0)
            argv.push("--dns-host", String(this.dns_host || "example.com"));
        let process;
        try {
            process = Gio.Subprocess.new(argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (e) {
            this._recordFailure();
            this._scheduleNextProbe();
            return;
        }
        this._process = process;
        this._watchdogTimer = Mainloop.timeout_add_seconds(8, () => {
            this._watchdogTimer = 0;
            if (process === this._process) {
                try { process.force_exit(); } catch (e) {}
                this._process = null;
                this._recordFailure();
                this._scheduleNextProbe();
            }
            return false;
        });
        process.communicate_utf8_async(null, null, (source, result) => {
            if (this._destroyed || source !== this._process)
                return;
            this._process = null;
            if (this._watchdogTimer) {
                Mainloop.source_remove(this._watchdogTimer);
                this._watchdogTimer = 0;
            }
            try {
                let [, stdout] = source.communicate_utf8_finish(result);
                let payload = JSON.parse(stdout);
                if (payload.error)
                    throw new Error(payload.error);
                this._recordSample(payload);
            } catch (e) {
                this._recordFailure();
            }
            this._scheduleNextProbe();
        });
    }

    _recordSample(payload) {
        let reachable = payload.reachable === true;
        let latency = Number(payload.latencyMs);
        this._samples.push({ ok: reachable, latency: reachable && Number.isFinite(latency) ? latency : null });
        let limit = Math.round(this._number(this.sample_window, 10, 3, 30));
        while (this._samples.length > limit)
            this._samples.shift();
        if (payload.dnsChecked === true) {
            this._dnsOk = payload.dnsMs !== null && Number.isFinite(Number(payload.dnsMs));
            this._dnsLatency = this._dnsOk ? Number(payload.dnsMs) : null;
        }
        this._method = reachable ? String(payload.method || "--").toUpperCase() : null;
        this._lastCheck = Number(payload.checkedAt) || Math.floor(Date.now() / 1000);
        this._error = reachable ? null : "offline";
        this._offlineStreak = reachable ? 0 : this._offlineStreak + 1;
        this._recalculate();
    }

    _recordFailure() {
        this._recordSample({ reachable: false, latencyMs: null,
            method: null, dnsMs: null, checkedAt: Math.floor(Date.now() / 1000) });
    }

    _recalculate() {
        if (!this._samples.length) {
            this._score = 0;
            this._updateDisplay();
            return;
        }
        let successful = this._samples.filter(sample => sample.ok && sample.latency !== null);
        this._loss = Math.round((1 - successful.length / this._samples.length) * 100);
        if (!successful.length) {
            this._latency = null;
            this._jitter = null;
            this._score = 0;
            this._updateDisplay();
            return;
        }
        let latencies = successful.map(sample => sample.latency);
        this._latency = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
        let changes = [];
        for (let i = 1; i < latencies.length; i++)
            changes.push(Math.abs(latencies[i] - latencies[i - 1]));
        this._jitter = changes.length
            ? changes.reduce((sum, value) => sum + value, 0) / changes.length : 0;

        let excellent = this._number(this.excellent_latency, 50, 10, 200);
        let good = Math.max(excellent, this._number(this.good_latency, 100, 20, 400));
        let fair = Math.max(good, this._number(this.fair_latency, 200, 50, 800));
        let poor = Math.max(fair, this._number(this.poor_latency, 500, 100, 2000));
        let score = this._latency <= excellent ? 5 : this._latency <= good ? 4
            : this._latency <= fair ? 3 : this._latency <= poor ? 2 : 1;
        if (this._jitter > 80)
            score -= 2;
        else if (this._jitter > 30)
            score -= 1;
        if (this._loss > 40)
            score -= 2;
        else if (this._loss > 10)
            score -= 1;
        if (this._dnsOk === false)
            score = Math.min(score, 1);
        this._score = Math.max(1, Math.min(5, score));
        this._updateDisplay();
    }

    _qualityText() {
        return [_("Offline"), _("Very poor"), _("Poor"), _("Fair"),
            _("Good"), _("Excellent")][this._score];
    }

    _qualityColor(score) {
        let keys = ["color_offline", "color_very_poor", "color_poor",
            "color_fair", "color_good", "color_excellent"];
        let fallbacks = ["#8f3338", "#c84b50", "#d16b32",
            "#d29a2e", "#76b947", "#35a854"];
        let index = Math.max(0, Math.min(5, Number(score) || 0));
        return this._color(keys[index], fallbacks[index], this.active_opacity);
    }

    _levelColor(level) {
        return this._qualityColor(Math.max(1, Math.min(5, level)));
    }

    _roundedRectangle(cr, x, y, width, height, radius) {
        let r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
        if (r <= 0) {
            cr.rectangle(x, y, width, height);
            return;
        }
        cr.moveTo(x + r, y);
        cr.lineTo(x + width - r, y);
        cr.arc(x + width - r, y + r, r, -Math.PI / 2, 0);
        cr.lineTo(x + width, y + height - r);
        cr.arc(x + width - r, y + height - r, r, 0, Math.PI / 2);
        cr.lineTo(x + r, y + height);
        cr.arc(x + r, y + height - r, r, Math.PI / 2, Math.PI);
        cr.lineTo(x, y + r);
        cr.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
        cr.closePath();
    }

    _dotPath(cr, x, y, width, height, shape, radius) {
        if (shape === "diamond") {
            cr.moveTo(x + width / 2, y);
            cr.lineTo(x + width, y + height / 2);
            cr.lineTo(x + width / 2, y + height);
            cr.lineTo(x, y + height / 2);
            cr.closePath();
        } else if (shape === "square") {
            cr.rectangle(x, y, width, height);
        } else if (shape === "rounded") {
            this._roundedRectangle(cr, x, y, width, height, radius);
        } else if (shape === "capsule") {
            this._roundedRectangle(cr, x, y, width, height, Math.min(width, height) / 2);
        } else {
            cr.save();
            cr.translate(x + width / 2, y + height / 2);
            cr.scale(width / 2, height / 2);
            cr.arc(0, 0, 1, 0, Math.PI * 2);
            cr.restore();
        }
    }

    _drawBar(cr, surfaceWidth, surfaceHeight) {
        let horizontal = this.dot_orientation === "horizontal";
        let length = this._number(this.bar_length, 28, 10, 100);
        let thickness = this._number(this.bar_thickness, 4, 2, 20);
        let width = horizontal ? length : thickness;
        let height = horizontal ? thickness : length;
        let x = (surfaceWidth - width) / 2 + this._number(this.dot_offset_x, 0, -10, 10);
        let y = (surfaceHeight - height) / 2 + this._number(this.dot_offset_y, 0, -10, 10);
        let radius = this._number(this.bar_corner_radius, 2, 0, 10);
        let borderWidth = this._number(this.bar_border_width, 0, 0, 4);
        let glowWidth = this._number(this.dot_glow_width, 0, 0, 6);
        let inactive = this._color("color_inactive", "#5e5e5e", this.inactive_opacity);
        let border = this._color("color_border", "#202020", 100);
        let glow = this._color("color_glow", "#ffffff",
            this._number(this.dot_glow_opacity, 28, 0, 100));
        let activeCount = this._score;
        let offlineSpecial = this._score === 0 && this.offline_style !== "inactive";
        if (offlineSpecial)
            activeCount = this.offline_style === "all" ? 5 : 1;

        if (activeCount > 0 && glowWidth > 0) {
            cr.setSourceRGBA(...glow);
            this._roundedRectangle(cr, x - glowWidth, y - glowWidth,
                width + glowWidth * 2, height + glowWidth * 2,
                radius + glowWidth);
            cr.fill();
        }

        let outlineOnly = this.inactive_style === "outline";
        if (this.inactive_style !== "hidden") {
            this._roundedRectangle(cr, x, y, width, height, radius);
            if (!outlineOnly) {
                cr.setSourceRGBA(...inactive);
                cr.fill();
            } else {
                cr.setLineWidth(Math.max(1, borderWidth));
                cr.setSourceRGBA(...inactive);
                cr.stroke();
            }
        }

        if (activeCount > 0) {
            cr.save();
            this._roundedRectangle(cr, x, y, width, height, radius);
            cr.clip();
            if (this.color_mode === "level" && !offlineSpecial) {
                for (let level = 1; level <= activeCount; level++) {
                    cr.setSourceRGBA(...this._levelColor(level));
                    if (horizontal) {
                        let segmentX = this.active_direction === "start"
                            ? x + (level - 1) * width / 5 : x + width - level * width / 5;
                        cr.rectangle(segmentX, y, width / 5, height);
                    } else {
                        let segmentY = this.active_direction === "start"
                            ? y + (level - 1) * height / 5 : y + height - level * height / 5;
                        cr.rectangle(x, segmentY, width, height / 5);
                    }
                    cr.fill();
                }
            } else {
                let color = offlineSpecial ? this._qualityColor(0)
                    : this.color_mode === "single"
                        ? this._color("color_active", "#35a854", this.active_opacity)
                        : this._qualityColor(this._score);
                let ratio = activeCount / 5;
                cr.setSourceRGBA(...color);
                if (horizontal) {
                    let fillWidth = width * ratio;
                    let fillX = this.active_direction === "start" ? x : x + width - fillWidth;
                    cr.rectangle(fillX, y, fillWidth, height);
                } else {
                    let fillHeight = height * ratio;
                    let fillY = this.active_direction === "start" ? y : y + height - fillHeight;
                    cr.rectangle(x, fillY, width, fillHeight);
                }
                cr.fill();
            }
            cr.restore();
        }

        if (this.bar_segment_lines === true) {
            cr.setLineWidth(this._number(this.bar_segment_width, 1, 1, 4));
            cr.setSourceRGBA(...this._color("bar_segment_color", "#202020", 100));
            for (let i = 1; i < 5; i++) {
                if (horizontal) {
                    cr.moveTo(x + width * i / 5, y);
                    cr.lineTo(x + width * i / 5, y + height);
                } else {
                    cr.moveTo(x, y + height * i / 5);
                    cr.lineTo(x + width, y + height * i / 5);
                }
            }
            cr.stroke();
        }
        if (borderWidth > 0) {
            this._roundedRectangle(cr, x, y, width, height, radius);
            cr.setLineWidth(borderWidth);
            cr.setSourceRGBA(...border);
            cr.stroke();
        }
    }

    _drawDots(area) {
        let cr = area.get_context();
        let [surfaceWidth, surfaceHeight] = area.get_surface_size();
        if (this.indicator_style === "bar") {
            this._drawBar(cr, surfaceWidth, surfaceHeight);
            cr.$dispose();
            return;
        }
        let dotWidth = this._number(this.dot_width, 4, 2, 16);
        let dotHeight = this._number(this.dot_height, 4, 2, 16);
        let gap = this._number(this.dot_gap, 2, 0, 6);
        let radius = this._number(this.dot_corner_radius, 2, 0, 8);
        let borderWidth = this._number(this.dot_border_width, 0, 0, 4);
        let glowWidth = this._number(this.dot_glow_width, 0, 0, 6);
        let isHorizontal = this.dot_orientation === "horizontal";
        let sequenceLength = (isHorizontal ? dotWidth : dotHeight) * 5 + gap * 4;
        let startX = (isHorizontal ? (surfaceWidth - sequenceLength) / 2
            : (surfaceWidth - dotWidth) / 2) +
            this._number(this.dot_offset_x, 0, -10, 10);
        let startY = (isHorizontal ? (surfaceHeight - dotHeight) / 2
            : (surfaceHeight - sequenceLength) / 2) +
            this._number(this.dot_offset_y, 0, -10, 10);
        let inactive = this._color("color_inactive", "#5e5e5e", this.inactive_opacity);
        let border = this._color("color_border", "#202020", 100);
        let glow = this._color("color_glow", "#ffffff",
            this._number(this.dot_glow_opacity, 28, 0, 100));
        let activeCount = this._score;
        let offlineSpecial = this._score === 0 && this.offline_style !== "inactive";
        if (offlineSpecial)
            activeCount = this.offline_style === "all" ? 5 : 1;

        for (let i = 0; i < 5; i++) {
            let rank = this.active_direction === "start" ? i + 1 : 5 - i;
            let activeDot = rank <= activeCount;
            let x = startX + (isHorizontal ? i * (dotWidth + gap) : 0);
            let y = startY + (isHorizontal ? 0 : i * (dotHeight + gap));
            if (!activeDot && this.inactive_style === "hidden")
                continue;
            let fill = offlineSpecial && activeDot ? this._qualityColor(0)
                : this.color_mode === "level" ? this._levelColor(rank)
                : this.color_mode === "single"
                    ? this._color("color_active", "#35a854", this.active_opacity)
                    : this._qualityColor(this._score);
            let outlineOnly = !activeDot && this.inactive_style === "outline";

            if (activeDot && glowWidth > 0) {
                cr.setSourceRGBA(...glow);
                this._dotPath(cr, x - glowWidth, y - glowWidth,
                    dotWidth + glowWidth * 2, dotHeight + glowWidth * 2,
                    String(this.dot_shape || "circle"), radius + glowWidth);
                cr.fill();
            }
            this._dotPath(cr, x, y, dotWidth, dotHeight,
                String(this.dot_shape || "circle"), radius);
            if (!outlineOnly) {
                cr.setSourceRGBA(...(activeDot ? fill : inactive));
                if (borderWidth > 0)
                    cr.fillPreserve();
                else
                    cr.fill();
            }
            let strokeWidth = outlineOnly ? Math.max(1, borderWidth) : borderWidth;
            if (strokeWidth > 0) {
                cr.setLineWidth(strokeWidth);
                cr.setSourceRGBA(...(outlineOnly ? inactive : border));
                cr.stroke();
            } else if (outlineOnly) {
                cr.newPath();
            }
        }
        cr.$dispose();
    }

    _formatMs(value) {
        return Number.isFinite(value) ? Math.round(value) + " ms" : "--";
    }

    _updateDisplay() {
        if (!this._dots || !this._rows)
            return;
        this._dots.queue_repaint();
        let quality = this._qualityText();
        this.set_applet_label("");
        this.set_applet_tooltip(_("Internet quality: %s (%d/5)").format(quality, this._score));
        this._summary.set_text(quality + "  " + this._score + "/5");
        this._rows.latency.set_text(this._formatMs(this._latency));
        this._rows.jitter.set_text(this._formatMs(this._jitter));
        this._rows.loss.set_text(this._loss + "%");
        this._rows.dns.set_text(this._dnsOk === false ? _("Failed")
            : this._formatMs(this._dnsLatency));
        this._rows.method.set_text(this._method || "--");
        if (this._lastCheck) {
            let date = new Date(this._lastCheck * 1000);
            this._status.set_text(_("Last check: %s").format(date.toLocaleTimeString([], {
                hour: "2-digit", minute: "2-digit", second: "2-digit"
            })));
        } else {
            this._status.set_text(_("Waiting for the first measurement..."));
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new InternetQualityApplet(metadata, orientation, panelHeight, instanceId);
}
