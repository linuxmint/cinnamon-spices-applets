const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cairo = imports.cairo;
const Mainloop = imports.mainloop;

const UUID = "chatgpt-limits@wertos97";

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

const THEMES = {
    dark_blue: {
        color_good: "#236b8f", color_warning: "#996417",
        color_critical: "#9c3036", color_time: "#6654a3",
        color_empty: "#5e5e5e", color_panel_text: "#ffffff",
        popup_card_color: "#3a3a3a", popup_track_color: "#5e5e5e",
        popup_text_color: "#f4f7fb"
    },
    dark_green: {
        color_good: "#2e7d4f", color_warning: "#96711a",
        color_critical: "#9c3036", color_time: "#3f7d8c",
        color_empty: "#3a414c", color_panel_text: "#ffffff",
        popup_card_color: "#2b3138", popup_track_color: "#3a414c",
        popup_text_color: "#eef3f0"
    },
    dark_violet: {
        color_good: "#6d5aa8", color_warning: "#96711a",
        color_critical: "#a83a44", color_time: "#2f7d6d",
        color_empty: "#444b58", color_panel_text: "#ffffff",
        popup_card_color: "#322e3d", popup_track_color: "#444b58",
        popup_text_color: "#f1edfb"
    },
    light_gray: {
        color_good: "#3f8fc4", color_warning: "#a87b12",
        color_critical: "#b03a40", color_time: "#6a5fc0",
        color_empty: "#cfd5dc", color_panel_text: "#1a1d22",
        popup_card_color: "#eef1f5", popup_track_color: "#cfd5dc",
        popup_text_color: "#1a1d22"
    },
    light_sand: {
        color_good: "#2f8ea6", color_warning: "#966d0e",
        color_critical: "#a83a44", color_time: "#6a5fc0",
        color_empty: "#ddd3bd", color_panel_text: "#2a2620",
        popup_card_color: "#f5f0e4", popup_track_color: "#ddd3bd",
        popup_text_color: "#2a2620"
    },
    high_contrast: {
        color_good: "#00c000", color_warning: "#ffaa00",
        color_critical: "#ff4040", color_time: "#00aaff",
        color_empty: "#333333", color_panel_text: "#ffffff",
        popup_card_color: "#000000", popup_track_color: "#333333",
        popup_text_color: "#ffffff"
    }
};

class ChatGPTLimitsApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_show_label_in_vertical_panels(false);

        this.metadata = metadata;
        this._destroyed = false;
        this._loading = false;
        this._process = null;
        this._refreshTimer = 0;
        this._requestTimeoutTimer = 0;
        this._retryTimer = 0;
        this._killTimer = 0;
        this._windows = [];
        this._error = null;
        this._updatedAt = 0;
        this._loadCachedWindows();
        this._initialPanelHeight = panelHeight;

        let gaugeHeight = Math.max(24, Math.min(36, panelHeight - 4));
        this._panelGauge = new St.DrawingArea({ style_class: "chatgpt-limits-panel-gauge" });
        this._panelGauge.set_size(38, gaugeHeight);
        this._panelGauge.connect("repaint", area => this._drawPanelGauge(area));
        this._applet_icon_box.set_child(this._panelGauge);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        let titleSection = new PopupMenu.PopupMenuSection();
        let titleBox = new St.BoxLayout({ vertical: true, style_class: "chatgpt-limits-pad" });
        this._contentBox = titleBox;
        this._titleLabel = new St.Label({
            style_class: "chatgpt-limits-title",
            text: _("ChatGPT limits")
        });
        this._messageLabel = new St.Label({ style_class: "chatgpt-limits-message", text: "" });
        titleBox.add_actor(this._titleLabel);
        titleBox.add_actor(this._messageLabel);
        this._cards = [];
        for (let i = 0; i < 2; i++) {
            let card = new St.BoxLayout({ vertical: true, style_class: "chatgpt-limits-card" });
            let header = new St.BoxLayout({ style_class: "chatgpt-limits-card-header" });
            let name = new St.Label({ style_class: "chatgpt-limits-card-name", text: "" });
            let percent = new St.Label({ style_class: "chatgpt-limits-card-percent", text: "" });
            header.add(name, { expand: true, x_fill: true });
            header.add_actor(percent);
            let progress = new St.DrawingArea({ style_class: "chatgpt-limits-progress" });
            progress.connect("repaint", area => this._drawProgress(area, i));
            let reset = new St.Label({ style_class: "chatgpt-limits-card-reset", text: "" });
            let exact = new St.Label({ style_class: "chatgpt-limits-card-exact", text: "" });
            card.add_actor(header);
            card.add_actor(progress);
            card.add_actor(reset);
            card.add_actor(exact);
            titleBox.add_actor(card);
            this._cards.push({ actor: card, name: name, percent: percent,
                progress: progress, reset: reset, exact: exact });
        }
        titleSection.addActor(titleBox);
        this.menu.addMenuItem(titleSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._refreshItem = new PopupMenu.PopupMenuItem(_("Refresh"));
        this._refreshItem.connect("activate", () => this._forceRefresh());
        this.menu.addMenuItem(this._refreshItem);

        let statusSection = new PopupMenu.PopupMenuSection();
        let statusBox = new St.BoxLayout({ style_class: "chatgpt-limits-pad" });
        this._statusLabel = new St.Label({ style_class: "chatgpt-limits-status", text: "" });
        statusBox.add_actor(this._statusLabel);
        statusSection.addActor(statusBox);
        this.menu.addMenuItem(statusSection);

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bind("codex_path", "codex_path", () => this._refresh());
        this.settings.bind("refresh_minutes", "refresh_minutes", () => this._restartRefreshTimer());
        for (let key of ["bar_width", "bar_gap", "bar_margin", "bar_vertical_margin",
                         "panel_outer_margin", "panel_font_size", "text_rotation",
                         "show_quota_text", "show_time_text", "critical_threshold",
                         "warning_threshold", "color_good", "color_warning",
                         "color_critical", "color_time", "color_empty", "color_panel_text",
                         "popup_card_color", "popup_track_color", "popup_text_color",
                         "popup_bar_height", "popup_card_padding", "popup_card_radius",
                         "popup_card_spacing", "popup_width", "theme_preset",
                         "panel_show_q5", "panel_show_t5", "panel_show_q7", "panel_show_t7",
                         "panel_bar_order", "bar_radius", "panel_bold_text",
                         "panel_font_family", "popup_show_5h", "popup_show_7d"])
            this.settings.bind(key, key, () => this._applyAppearance());

        this._applyAppearance();
        this._restartRefreshTimer();
        this._updateDisplay();
        this._refresh();
    }

    on_applet_clicked() {
        this.menu.toggle();
        if (this.menu.isOpen)
            this._refresh();
    }

    on_applet_removed_from_panel() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        if (this._refreshTimer)
            Mainloop.source_remove(this._refreshTimer);
        if (this._requestTimeoutTimer)
            Mainloop.source_remove(this._requestTimeoutTimer);
        if (this._retryTimer)
            Mainloop.source_remove(this._retryTimer);
        if (this._killTimer)
            Mainloop.source_remove(this._killTimer);
        this._refreshTimer = 0;
        this._requestTimeoutTimer = 0;
        this._retryTimer = 0;
        this._killTimer = 0;
        if (this._process) {
            try { this._process.force_exit(); } catch (e) {
                try { this._process.send_signal(15); } catch (e2) {}
            }
            this._process = null;
        }
        this.settings.finalize();
    }

    _restartRefreshTimer() {
        if (this._refreshTimer) {
            Mainloop.source_remove(this._refreshTimer);
            this._refreshTimer = 0;
        }
        let minutes = Math.max(1, parseInt(this.refresh_minutes, 10) || 3);
        this._refreshTimer = Mainloop.timeout_add_seconds(minutes * 60, () => {
            this._refresh();
            return true;
        });
    }

    _cachePath() {
        try {
            let dir = GLib.get_user_cache_dir() + "/chatgpt-limits@wertos97";
            GLib.mkdir_with_parents(dir, 448);
            return dir + "/last.json";
        } catch (e) {
            return null;
        }
    }

    _loadCachedWindows() {
        try {
            let path = this._cachePath();
            if (!path)
                return;
            let file = Gio.File.new_for_path(path);
            if (!file.query_exists(null))
                return;
            let [ok, contents] = file.load_contents(null);
            if (!ok)
                return;
            let payload = JSON.parse(imports.byteArray.toString(contents));
            if (Array.isArray(payload.windows) && payload.windows.length) {
                this._windows = payload.windows
                    .filter(window => Number.isFinite(Number(window.durationMinutes)) &&
                        Number.isFinite(Number(window.usedPercent)) &&
                        Number.isFinite(Number(window.resetsAt)))
                    .sort((a, b) => a.durationMinutes - b.durationMinutes)
                    .slice(0, 2);
                this._updatedAt = Number(payload.updatedAt) || 0;
                if (this._windows.length)
                    this._error = "stale";
            }
        } catch (e) {}
    }

    _saveCachedWindows() {
        try {
            let path = this._cachePath();
            if (!path || !this._windows.length)
                return;
            let payload = JSON.stringify({
                updatedAt: this._updatedAt,
                windows: this._windows
            });
            Gio.File.new_for_path(path).replace_contents(payload, null,
                false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (e) {}
    }

    _isStale() {
        return !!this._error && this._windows.length > 0;
    }

    _clearRetryTimer() {
        if (this._retryTimer) {
            Mainloop.source_remove(this._retryTimer);
            this._retryTimer = 0;
        }
    }

    _scheduleQuickRetry() {
        if (this._destroyed || !this._error)
            return;
        this._clearRetryTimer();
        this._retryTimer = Mainloop.timeout_add_seconds(30, () => {
            this._retryTimer = 0;
            if (!this._destroyed && !this._loading && this._error)
                this._refresh();
            return false;
        });
    }

    _forceRefresh() {
        if (this._destroyed)
            return;
        if (this._loading && this._process) {
            try { this._process.force_exit(); } catch (e) {
                try { this._process.send_signal(15); } catch (e2) {}
            }
            this._process = null;
            this._loading = false;
            if (this._requestTimeoutTimer) {
                Mainloop.source_remove(this._requestTimeoutTimer);
                this._requestTimeoutTimer = 0;
            }
            if (this._killTimer) {
                Mainloop.source_remove(this._killTimer);
                this._killTimer = 0;
            }
        }
        if (!this._loading)
            this._refresh();
        else
            this._updateDisplay();
    }

    _refresh() {
        if (this._destroyed || this._loading)
            return;
        this._loading = true;
        if (!this._windows.length)
            this._error = null;
        this._updateDisplay();

        let argv = ["/usr/bin/python3", this.metadata.path + "/chatgpt_limits.py"];
        let path = String(this.codex_path || "").trim();
        if (path)
            argv.push("--codex", path);

        let process;
        try {
            process = Gio.Subprocess.new(argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (e) {
            this._loading = false;
            if (!this._windows.length)
                this._error = "backend";
            else if (!this._error)
                this._error = "backend";
            this._updateDisplay();
            this._scheduleQuickRetry();
            return;
        }

        this._process = process;
        if (this._killTimer) {
            Mainloop.source_remove(this._killTimer);
            this._killTimer = 0;
        }
        this._requestTimeoutTimer = Mainloop.timeout_add_seconds(20, () => {
            this._requestTimeoutTimer = 0;
            if (this._destroyed || process !== this._process)
                return false;
            try { process.send_signal(15); } catch (e) {}
            this._killTimer = Mainloop.timeout_add_seconds(2, () => {
                this._killTimer = 0;
                if (!this._destroyed && process === this._process) {
                    try { process.force_exit(); } catch (e) {}
                    this._process = null;
                    this._loading = false;
                    if (!this._error)
                        this._error = "timeout";
                    this._updateDisplay();
                    this._scheduleQuickRetry();
                }
                return false;
            });
            this._process = null;
            this._loading = false;
            if (!this._error)
                this._error = "timeout";
            this._updateDisplay();
            this._scheduleQuickRetry();
            return false;
        });
        process.communicate_utf8_async(null, null, (source, result) => {
            if (this._destroyed || source !== this._process)
                return;
            if (this._requestTimeoutTimer) {
                Mainloop.source_remove(this._requestTimeoutTimer);
                this._requestTimeoutTimer = 0;
            }
            if (this._killTimer) {
                Mainloop.source_remove(this._killTimer);
                this._killTimer = 0;
            }
            this._process = null;
            this._loading = false;
            try {
                let [, stdout] = source.communicate_utf8_finish(result);
                let payload = JSON.parse(stdout);
                if (payload.error) {
                    if (!this._windows.length)
                        this._error = String(payload.error);
                    else if (!this._error || this._error === "stale")
                        this._error = String(payload.error);
                } else if (Array.isArray(payload.windows)) {
                    let windows = payload.windows
                        .filter(window => Number.isFinite(Number(window.durationMinutes)) &&
                            Number.isFinite(Number(window.usedPercent)) &&
                            Number.isFinite(Number(window.resetsAt)))
                        .sort((a, b) => a.durationMinutes - b.durationMinutes)
                        .slice(0, 2);
                    if (windows.length) {
                        this._windows = windows;
                        this._updatedAt = Number(payload.updatedAt) || Math.floor(Date.now() / 1000);
                        this._error = null;
                        this._saveCachedWindows();
                        this._clearRetryTimer();
                    } else if (!this._windows.length) {
                        this._error = "data";
                    }
                } else if (!this._windows.length) {
                    this._error = "data";
                }
            } catch (e) {
                if (!this._windows.length)
                    this._error = "backend";
                else if (!this._error || this._error === "stale")
                    this._error = "backend";
            }
            this._updateDisplay();
            if (this._error)
                this._scheduleQuickRetry();
        });
    }

    _windowName(minutes) {
        let value = Math.round(Number(minutes));
        if (value % 1440 === 0)
            return _("%d d").format(value / 1440);
        if (value % 60 === 0)
            return _("%d h").format(value / 60);
        return _("%d min").format(value);
    }

    _resetExact(resetsAt) {
        let date = new Date(Number(resetsAt) * 1000);
        let now = new Date();
        let sameDay = date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();
        let time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (sameDay)
            return time;
        return time + ", " + date.toLocaleDateString([], { day: "numeric", month: "short" });
    }

    _frozenRemainingSeconds(resetsAt, capSeconds = 0) {
        let ref = Number(this._updatedAt) || Math.floor(Date.now() / 1000);
        let seconds = Math.max(0, Math.ceil(Number(resetsAt) - ref));
        let cap = Number(capSeconds);
        if (Number.isFinite(cap) && cap > 0)
            seconds = Math.min(seconds, Math.ceil(cap));
        return seconds;
    }

    _countdown(resetsAt, compact = false, capSeconds = 0) {
        let seconds = this._frozenRemainingSeconds(resetsAt, capSeconds);
        let days = Math.floor(seconds / 86400);
        let hours = Math.floor((seconds % 86400) / 3600);
        let minutes = Math.floor((seconds % 3600) / 60);
        if (days > 0)
            return compact ? days + "d " + hours + "h" : _("%d d %d h").format(days, hours);
        if (hours > 0)
            return compact ? hours + "h " + minutes + "m" : _("%d h %d min").format(hours, minutes);
        return compact ? minutes + "m" : _("%d min").format(minutes);
    }

    _errorText() {
        switch (this._error) {
            case "auth": return _("Sign in with Codex CLI, then refresh.");
            case "not-found": return _("Codex CLI was not found.");
            case "timeout": return _("Reading limits timed out.");
            case "data": return _("No supported usage limits were returned.");
            case "stale": return _("Showing last saved data.");
            default: return _("Could not read ChatGPT limits.");
        }
    }

    _numberSetting(value, fallback, minimum, maximum) {
        let number = parseInt(value, 10);
        if (!Number.isFinite(number))
            number = fallback;
        return Math.max(minimum, Math.min(maximum, number));
    }

    _themeColor(key, fallback) {
        let preset = THEMES[String(this.theme_preset || "dark_blue")];
        if (preset && preset[key])
            return preset[key];
        return this[key] || fallback;
    }

    _windowByDuration(minutes) {
        let target = Number(minutes);
        let best = null;
        let bestDiff = Infinity;
        for (let window of this._windows) {
            let diff = Math.abs(Number(window.durationMinutes) - target);
            if (diff < bestDiff) {
                bestDiff = diff;
                best = window;
            }
        }
        if (best && bestDiff <= Math.max(60, target * 0.2))
            return best;
        return null;
    }

    _panelBars() {
        let order = String(this.panel_bar_order || "q5,t5,q7,t7")
            .split(",").map(token => token.trim().toLowerCase()).filter(Boolean);
        if (!order.length)
            order = ["q5", "t5", "q7", "t7"];
        let visibility = {
            q5: this.panel_show_q5 !== false,
            t5: this.panel_show_t5 !== false,
            q7: this.panel_show_q7 === true,
            t7: this.panel_show_t7 === true
        };
        let bars = [];
        for (let token of order) {
            let key = null;
            if (["q5", "quota5", "quota5h", "5hq", "5hquota"].includes(token))
                key = "q5";
            else if (["t5", "time5", "time5h", "5ht", "5htime"].includes(token))
                key = "t5";
            else if (["q7", "quota7", "quota7d", "7dq", "7dquota", "qw", "quotaweek"].includes(token))
                key = "q7";
            else if (["t7", "time7", "time7d", "7dt", "7dtime", "tw", "timeweek"].includes(token))
                key = "t7";
            if (key && visibility[key] && !bars.includes(key))
                bars.push(key);
        }
        if (!bars.length) {
            for (let key of ["q5", "t5", "q7", "t7"]) {
                if (visibility[key])
                    bars.push(key);
            }
        }
        if (!bars.length)
            bars = ["q5"];
        return bars;
    }

    _applyAppearance() {
        if (!this._panelGauge || !this._cards)
            return;
        let bars = this._panelBars();
        let barWidth = this._numberSetting(this.bar_width, 16, 8, 32);
        let gap = this._numberSetting(this.bar_gap, 3, 0, 16);
        let margin = this._numberSetting(this.bar_margin, 1, 0, 12);
        let outerMargin = this._numberSetting(this.panel_outer_margin, 2, 0, 16);
        let totalWidth = bars.length * barWidth + (bars.length - 1) * gap + margin * 2;
        this._panelGauge.set_width(Math.max(totalWidth, barWidth + margin * 2));
        this._panelGauge.set_style("margin: 0px " + outerMargin + "px;");

        let popupWidth = this._numberSetting(this.popup_width, 260, 160, 500);
        this._contentBox.set_width(popupWidth);
        let cardColor = colorToCss(this._themeColor("popup_card_color", "#3a3a3a"), "#3a3a3a");
        let textColor = colorToCss(this._themeColor("popup_text_color", "#f4f7fb"), "#f4f7fb");
        let padding = this._numberSetting(this.popup_card_padding, 10, 2, 24);
        let radius = this._numberSetting(this.popup_card_radius, 8, 0, 24);
        let spacing = this._numberSetting(this.popup_card_spacing, 8, 0, 24);
        let barHeight = this._numberSetting(this.popup_bar_height, 7, 2, 24);
        for (let card of this._cards) {
            card.actor.set_style("background-color: " + cardColor + "; " +
                "border-radius: " + radius + "px; padding: " + padding +
                "px; margin-bottom: " + spacing + "px;");
            card.progress.set_height(barHeight);
            for (let label of [card.name, card.percent, card.reset, card.exact])
                label.set_style("color: " + textColor + ";");
            card.progress.queue_repaint();
        }
        for (let label of [this._titleLabel, this._messageLabel, this._statusLabel])
            label.set_style("color: " + textColor + ";");
        this._panelGauge.queue_repaint();
    }

    _remainingColor(remaining) {
        let critical = this._numberSetting(this.critical_threshold, 20, 1, 90);
        let warning = Math.max(critical,
            this._numberSetting(this.warning_threshold, 50, 1, 99));
        if (remaining <= critical)
            return parseColor(this._themeColor("color_critical", "#9c3036"), "#9c3036");
        if (remaining <= warning)
            return parseColor(this._themeColor("color_warning", "#996417"), "#996417");
        return parseColor(this._themeColor("color_good", "#236b8f"), "#236b8f");
    }

    _panelCountdown(resetsAt, showDays = false, capSeconds = 0) {
        let totalSeconds = this._frozenRemainingSeconds(resetsAt, capSeconds);
        let pad = number => (number < 10 ? "0" + number : "" + number);
        if (showDays) {
            let days = Math.floor(totalSeconds / 86400);
            let hours = Math.floor((totalSeconds % 86400) / 3600);
            let minutes = Math.floor((totalSeconds % 3600) / 60);
            if (days > 0)
                return days + ":" + pad(hours) + ":" + pad(minutes);
        }
        let totalMinutes = Math.floor(totalSeconds / 60);
        let hours = Math.floor(totalMinutes / 60);
        let minutes = totalMinutes % 60;
        return hours + ":" + pad(minutes);
    }

    _parsePanelFont() {
        let desc = String(this.panel_font_family || "Sans").trim() || "Sans";
        let tokens = desc.split(/\s+/);
        if (tokens.length > 1 && /^[\d.]+$/.test(tokens[tokens.length - 1]))
            tokens.pop();
        let slant = Cairo.FontSlant.NORMAL;
        let weight = this.panel_bold_text === false
            ? Cairo.FontWeight.NORMAL : Cairo.FontWeight.BOLD;
        let familyTokens = [];
        for (let token of tokens) {
            let lower = token.toLowerCase();
            if (lower === "italic" || lower === "oblique")
                slant = Cairo.FontSlant.ITALIC;
            else if (lower === "bold")
                weight = Cairo.FontWeight.BOLD;
            else if (lower === "light")
                weight = Cairo.FontWeight.NORMAL;
            else
                familyTokens.push(token);
        }
        return {
            family: familyTokens.join(" ") || "Sans",
            slant: slant,
            weight: weight
        };
    }

    _drawVerticalText(cr, text, centerX, centerY) {
        cr.save();
        cr.translate(centerX, centerY);
        cr.rotate(this.text_rotation === "right" ? Math.PI / 2 : -Math.PI / 2);
        let font = this._parsePanelFont();
        cr.selectFontFace(font.family, font.slant, font.weight);
        cr.setFontSize(this._numberSetting(this.panel_font_size, 8, 6, 14));
        let extents = cr.textExtents(text);
        cr.setSourceRGBA(...parseColor(this._themeColor("color_panel_text", "#ffffff"), "#ffffff"));
        cr.moveTo(-extents.width / 2 - extents.xBearing,
            -extents.height / 2 - extents.yBearing);
        cr.showText(text);
        cr.restore();
    }

    _roundedBar(cr, x, y, w, h, radius) {
        let r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
        if (r <= 0) {
            cr.rectangle(x, y, w, h);
            return;
        }
        cr.moveTo(x + r, y);
        cr.lineTo(x + w - r, y);
        cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
        cr.lineTo(x + w, y + h - r);
        cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        cr.lineTo(x + r, y + h);
        cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        cr.lineTo(x, y + r);
        cr.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
        cr.closePath();
    }

    _barData(key) {
        let isWeekly = key === "q7" || key === "t7";
        let isTime = key === "t5" || key === "t7";
        let window = this._windowByDuration(isWeekly ? 10080 : 300) ||
            (this._windows.length ? this._windows[isWeekly ? 1 : 0] || null : null);
        if (!window)
            return { value: 0, color: parseColor(this._themeColor("color_empty", "#5e5e5e"), "#5e5e5e"), label: "--", show: true };
        let stale = this._isStale();
        let suffix = stale ? "!" : "";
        if (isTime) {
            let value = Math.max(0, Math.min(1,
                this._frozenRemainingSeconds(window.resetsAt) /
                (Number(window.durationMinutes) * 60)));
            return {
                value: value,
                color: parseColor(this._themeColor("color_time", "#6654a3"), "#6654a3"),
                label: this._panelCountdown(window.resetsAt, isWeekly,
                    Number(window.durationMinutes) * 60) + suffix,
                show: this.show_time_text !== false
            };
        }
        let remaining = Math.max(0, Math.min(100, 100 - Number(window.usedPercent)));
        return {
            value: remaining / 100,
            color: this._remainingColor(remaining),
            label: Math.round(remaining) + "%" + suffix,
            show: this.show_quota_text !== false
        };
    }

    _drawPanelGauge(area) {
        let cr = area.get_context();
        let [width, height] = area.get_surface_size();
        let gap = this._numberSetting(this.bar_gap, 3, 0, 16);
        let margin = this._numberSetting(this.bar_margin, 1, 0, 12);
        let verticalMargin = this._numberSetting(this.bar_vertical_margin, 1, 0, 12);
        let barWidth = this._numberSetting(this.bar_width, 16, 8, 32);
        let radius = this._numberSetting(this.bar_radius, 0, 0, 8);
        let barHeight = Math.max(10, height - verticalMargin * 2);
        let leftX = margin;
        let top = Math.floor((height - barHeight) / 2);
        let bars = this._panelBars();
        let emptyColor = parseColor(this._themeColor("color_empty", "#5e5e5e"), "#5e5e5e");
        let hasData = this._windows.length > 0;

        for (let i = 0; i < bars.length; i++) {
            let x = leftX + i * (barWidth + gap);
            cr.setSourceRGBA(...emptyColor);
            this._roundedBar(cr, x, top, barWidth, barHeight, radius);
            cr.fill();
            if (hasData) {
                let bar = this._barData(bars[i]);
                let fillHeight = Math.round(barHeight * bar.value);
                if (fillHeight > 0) {
                    cr.setSourceRGBA(...bar.color);
                    cr.save();
                    this._roundedBar(cr, x, top, barWidth, barHeight, radius);
                    cr.clip();
                    cr.rectangle(x, top + barHeight - fillHeight, barWidth, fillHeight);
                    cr.fill();
                    cr.restore();
                }
                if (bar.show)
                    this._drawVerticalText(cr, bar.label, x + barWidth / 2, height / 2);
            } else if (i < 2) {
                this._drawVerticalText(cr, "--", x + barWidth / 2, height / 2);
            }
        }
        cr.$dispose();
    }

    _drawProgress(area, index) {
        let cr = area.get_context();
        let [width, height] = area.get_surface_size();
        let window = this._windows[index];
        let remaining = window
            ? Math.max(0, Math.min(100, 100 - Number(window.usedPercent))) : 0;
        cr.setSourceRGBA(...parseColor(this._themeColor("popup_track_color", "#5e5e5e"), "#5e5e5e"));
        cr.rectangle(0, 0, width, height);
        cr.fill();
        if (remaining > 0) {
            cr.setSourceRGBA(...this._remainingColor(remaining));
            cr.rectangle(0, 0, width * remaining / 100, height);
            cr.fill();
        }
        cr.$dispose();
    }

    _updateDisplay() {
        if (this._panelGauge)
            this._panelGauge.queue_repaint();
        if (!this._windows.length) {
            let text = this._loading ? _("Refreshing...")
                : this._error ? this._errorText() : _("Waiting for usage data...");
            this.set_applet_label("");
            this.set_applet_tooltip(text);
            this._messageLabel.set_text(text);
            this._messageLabel.show();
            for (let card of this._cards)
                card.actor.hide();
            this._statusLabel.set_text("");
            return;
        }

        if (this._isStale()) {
            this._messageLabel.set_text(this._errorText());
            this._messageLabel.show();
        } else {
            this._messageLabel.hide();
        }
        this.set_applet_label("");
        let stale = this._isStale();
        let tooltip = [_("ChatGPT usage")];
        let popupVisible = [
            this.popup_show_5h !== false,
            this.popup_show_7d !== false
        ];
        for (let i = 0; i < this._cards.length; i++) {
            let card = this._cards[i];
            let window = this._windows[i];
            if (!window || !popupVisible[i]) {
                card.actor.hide();
                continue;
            }
            let name = this._windowName(window.durationMinutes);
            let remaining = Math.round(100 - Number(window.usedPercent));
            let cycle = Number(window.durationMinutes) * 60;
            let reset = this._countdown(window.resetsAt, false, cycle);
            card.name.set_text(name);
            card.percent.set_text(_("%d%% left").format(remaining));
            card.reset.set_text(_("Reset in %s").format(
                this._countdown(window.resetsAt, true, cycle)));
            card.exact.set_text(_("Resets at %s").format(
                this._resetExact(window.resetsAt)));
            card.actor.show();
            card.progress.queue_repaint();
            tooltip.push(_("%s: %d%% left, resets in %s (%s)").format(
                name, remaining, reset, this._resetExact(window.resetsAt)));
        }
        if (stale)
            tooltip.push(this._errorText());
        this.set_applet_tooltip(tooltip.join("\n"));
        let updated = new Date(this._updatedAt * 1000);
        let updatedText = this._updatedAt ? updated.toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit"
        }) : "--";
        if (this._loading)
            this._statusLabel.set_text(_("Refreshing..."));
        else if (stale)
            this._statusLabel.set_text(this._errorText() + " " +
                _("Updated at %s").format(updatedText));
        else
            this._statusLabel.set_text(_("Updated at %s").format(updatedText));
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new ChatGPTLimitsApplet(metadata, orientation, panelHeight, instanceId);
}
