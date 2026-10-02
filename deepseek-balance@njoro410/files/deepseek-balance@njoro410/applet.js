// SPDX-License-Identifier: GPL-2.0-or-later
// DeepSeek Balance — Cinnamon applet
//
// Shows the DeepSeek API account balance in the panel (percentage, bar, or
// plain amount) with spend details on hover. The logo is tinted while
// DeepSeek's peak-rate billing hours are active.
//
// The only documented API-key endpoint is the balance one, so token counts are
// not available; "spent" figures are derived from balance changes the applet
// records over time (top-ups are ignored, never counted as negative spend).

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;

imports.gi.versions.Soup = '3.0';
const Soup = imports.gi.Soup;

const UUID = 'deepseek-balance@njoro410';
const BALANCE_URL = 'https://api.deepseek.com/user/balance';
const PLATFORM_URL = 'https://platform.deepseek.com/usage';

const BAR_WIDTH_PX = 60;
const BAR_HEIGHT_PX = 10;
const WARN_COLOR = 'color: #e01b24;';

const HISTORY_DIR = GLib.build_filenamev([GLib.get_user_state_dir(), UUID]);
const HISTORY_PATH = GLib.build_filenamev([HISTORY_DIR, 'history.json']);
// Pre-release builds kept the history under ~/.config/deepseek-balance; migrate it.
const LEGACY_HISTORY_PATH = GLib.build_filenamev([GLib.get_user_config_dir(), 'deepseek-balance', 'history.json']);

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');
function _(str) {
    return Gettext.dgettext(UUID, str);
}

// ===== pure-logic:start =====
// Plain JS helpers with no GJS globals, so test/history-test.js can run them
// under Node.

const HISTORY_KEEP_DAYS = 60;
const SAMPLE_HEARTBEAT_SECONDS = 12 * 3600;
const MAX_SAMPLES = 5000;
const CENTS = 0.005; // balance deltas smaller than this count as "unchanged"
const DEFAULT_BAR_COLOR = '#4d6bfe'; // DeepSeek blue; kept in sync with settings-schema.json
// The peak-logo-color options from settings-schema.json. A pre-rendered tinted
// variant (icon-peak-<hex>.svg) is shipped in the applet directory for each.
const PEAK_ICON_COLORS = [
    '#ff7800', '#4d6bfe', '#3584e4', '#009688', '#33d17a',
    '#f6d32d', '#e01b24', '#e91e63', '#9141ac', '#9a9996',
];

const CURRENCY_SYMBOLS = { CNY: '¥', USD: '$' };
const DAY_SECONDS = 86400;

function formatAmount(value, currency) {
    const symbol = CURRENCY_SYMBOLS[currency] || (currency ? currency + ' ' : '');
    return symbol + value.toFixed(2);
}

function parseBalanceResponse(data, preferredCurrency) {
    if (!data || !Array.isArray(data.balance_infos) || data.balance_infos.length === 0) return null;

    const infos = data.balance_infos.filter(function (info) {
        return info && info.currency && info.total_balance !== undefined;
    });
    if (infos.length === 0) return null;

    let info = null;
    if (preferredCurrency && preferredCurrency !== 'auto') {
        info = infos.find(function (i) { return i.currency === preferredCurrency; }) || null;
    }
    if (!info) {
        info = infos.find(function (i) { return parseFloat(i.total_balance) > 0; }) || infos[0];
    }

    function num(value) {
        const n = parseFloat(value);
        return isFinite(n) ? n : 0;
    }
    return {
        currency: info.currency,
        total: num(info.total_balance),
        granted: num(info.granted_balance),
        toppedUp: num(info.topped_up_balance),
        available: data.is_available === true,
    };
}

// Records a balance sample when it changed or the series went stale, so the
// history stays small while still bracketing every change in time.
function appendSample(samples, nowSec, balance) {
    const last = samples.length > 0 ? samples[samples.length - 1] : null;
    const changed = !last || Math.abs(balance - last.b) >= CENTS;
    const stale = !last || (nowSec - last.t) >= SAMPLE_HEARTBEAT_SECONDS;
    if (changed || stale) {
        samples.push({ t: nowSec, b: balance });
        return true;
    }
    return false;
}

function pruneSamples(samples, nowSec) {
    const cutoff = nowSec - HISTORY_KEEP_DAYS * DAY_SECONDS;
    let firstKept = 0;
    while (firstKept < samples.length && samples[firstKept].t < cutoff) firstKept++;
    // Keep one sample before the cutoff so windows straddling it have a baseline.
    if (firstKept > 1) samples.splice(0, firstKept - 1);
    if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
    return samples;
}

// Sum of balance decreases whose end sample falls inside the window.
function spentSince(samples, sinceSec) {
    let spend = 0;
    for (let i = 1; i < samples.length; i++) {
        const prev = samples[i - 1];
        const cur = samples[i];
        if (cur.t < sinceSec) continue;
        if (cur.b < prev.b) spend += prev.b - cur.b;
    }
    return spend;
}

function startOfToday(nowSec) {
    const d = new Date(nowSec * 1000);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
}

function clampPercent(value) {
    if (!isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

// "#rrggbb" -> {r, g, b} in 0..1; null when the value is malformed.
function parseHexColor(value) {
    if (typeof value !== 'string') return null;
    const match = /^#([0-9a-fA-F]{6})$/.exec(value.trim());
    if (!match) return null;
    const n = parseInt(match[1], 16);
    return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}

// File name of the shipped tinted logo for a peak-logo-color value, or null
// when the value is not one of the palette colors.
function peakIconFile(color) {
    const hex = typeof color === 'string' ? color.trim().toLowerCase() : '';
    if (PEAK_ICON_COLORS.indexOf(hex) === -1) return null;
    return 'icon-peak-' + hex.slice(1) + '.svg';
}

// DeepSeek bills API usage at 2× during peak hours — Monday to Friday,
// 09:00–12:00 and 14:00–18:00 Beijing time (UTC+8), i.e. 01:00–04:00 and
// 06:00–10:00 UTC. Everything else is off-peak at half price; weekends are
// always off-peak. Chinese statutory holidays are off-peak too, but the
// applet can't detect those.
const PEAK_WINDOWS_UTC_MINUTES = [[60, 240], [360, 600]]; // [start, end) in UTC minutes
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isPeakTime(date) {
    const day = date.getUTCDay();
    if (day === 0 || day === 6) return false;
    const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    return PEAK_WINDOWS_UTC_MINUTES.some(function (w) {
        return minutes >= w[0] && minutes < w[1];
    });
}

// The next moment the peak/off-peak state flips: {t: epoch seconds, peak: bool}.
function nextPricingChange(date) {
    const nowSec = date.getTime() / 1000;
    for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
        const dayStartMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + dayOffset);
        const day = new Date(dayStartMs).getUTCDay();
        if (day === 0 || day === 6) continue; // weekends have no transitions
        for (const window of PEAK_WINDOWS_UTC_MINUTES) {
            const edges = [[window[0], true], [window[1], false]];
            for (const edge of edges) {
                const t = dayStartMs / 1000 + edge[0] * 60;
                if (t > nowSec) return { t: t, peak: edge[1] };
            }
        }
    }
    return null;
}

// Local "HH:MM", prefixed with a short weekday when not today.
function formatClock(timestampSec, now) {
    const d = new Date(timestampSec * 1000);
    const time = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() !== now.toDateString()) return WEEKDAY_NAMES[d.getDay()] + ' ' + time;
    return time;
}

// "2d 14h", "1h 23m", "45m" — countdown to the next rate change.
function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds));
    if (s >= DAY_SECONDS) {
        let days = Math.floor(s / DAY_SECONDS);
        let hours = Math.round((s % DAY_SECONDS) / 3600);
        if (hours === 24) { days += 1; hours = 0; }
        return hours ? days + 'd ' + hours + 'h' : days + 'd';
    }
    if (s >= 3600) {
        const hours = Math.floor(s / 3600);
        const minutes = Math.round((s % 3600) / 60);
        if (minutes === 60) return (hours + 1) + 'h';
        return minutes ? hours + 'h ' + minutes + 'm' : hours + 'h';
    }
    return Math.max(1, Math.round(s / 60)) + 'm';
}

function roundedRect(cr, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    cr.newSubPath();
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
    cr.arc(x + w - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI);
    cr.arc(x + w - r, y + h - r, r, 0, 0.5 * Math.PI);
    cr.arc(x + r, y + h - r, r, 0.5 * Math.PI, Math.PI);
    cr.closePath();
}
// ===== pure-logic:end =====

// ===== history-io:start =====
// Asynchronous read/write of the spend-history JSON file, kept free of applet
// state so test/history-io-test.js can exercise it under cjs.

// Reads a JSON file; the callback gets the parsed object, or null when the
// file is missing, unreadable or invalid.
function readJsonFile(path, callback) {
    Gio.File.new_for_path(path).load_contents_async(null, (file, result) => {
        let contents = null;
        try {
            const [ok, data] = file.load_contents_finish(result);
            if (ok) contents = data;
        } catch (e) { /* missing or unreadable */ }
        if (!contents) {
            callback(null);
            return;
        }
        let parsed = null;
        try {
            parsed = JSON.parse(new TextDecoder().decode(contents));
        } catch (e) {
            global.logWarning('[' + UUID + '] could not parse ' + path + ': ' + e.message);
        }
        callback(parsed && typeof parsed === 'object' ? parsed : null);
    });
}

// Creates a directory and any missing parents, asynchronously (GIO only has
// an async single-level make_directory).
function ensureDirAsync(dir, callback) {
    const file = Gio.File.new_for_path(dir);
    file.make_directory_async(GLib.PRIORITY_DEFAULT, null, (f, result) => {
        try {
            f.make_directory_finish(result);
            callback();
        } catch (e) {
            if (e && e.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                callback();
                return;
            }
            const parent = f.get_parent();
            if (parent && e && e.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                ensureDirAsync(parent.get_path(), () => ensureDirAsync(dir, callback));
                return;
            }
            global.logWarning('[' + UUID + '] could not create ' + dir + ': ' + e.message);
            callback();
        }
    });
}

// Writes data as JSON, creating the directory on first use. Writes are
// coalesced: data handed over while a write is in flight replaces whatever is
// waiting, so one final write carries the latest state instead of racing the
// current one. `state` is a plain object owned by the caller
// ({inFlight, pending, dirReady}).
function writeJsonFile(path, dir, data, state, callback) {
    if (state.inFlight) {
        state.pending = data;
        return;
    }
    state.inFlight = true;
    const write = (payload) => {
        const bytes = new GLib.Bytes(JSON.stringify(payload));
        Gio.File.new_for_path(path).replace_contents_bytes_async(
            bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null,
            (file, result) => {
                try {
                    file.replace_contents_finish(result);
                } catch (e) {
                    global.logWarning('[' + UUID + '] could not save history: ' + e.message);
                }
                if (state.pending) {
                    const again = state.pending;
                    state.pending = null;
                    write(again);
                    return;
                }
                state.inFlight = false;
                if (callback) callback();
            });
    };
    if (state.dirReady) {
        write(data);
        return;
    }
    ensureDirAsync(dir, () => {
        state.dirReady = true;
        write(data);
    });
}
// ===== history-io:end =====

function DeepSeekBalanceApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

DeepSeekBalanceApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        // Cinnamon 6.x base classes take (orientation, panel_height, instance_id)
        // — metadata is only passed to main().
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        // DeepSeek logo in the panel, to the left of the label/bar. During
        // peak-rate hours a tinted copy replaces it (see _updatePricing).
        this._appletDir = metadata.path;
        this._iconNormalPath = metadata.path + '/icon.svg';
        this._lastIconPath = this._iconNormalPath;
        this._peakTimer = 0;
        this.set_applet_icon_path(this._iconNormalPath);

        this._ready = false;
        this._destroyed = false;
        this._fetching = false;
        this._timeoutId = 0;
        this._result = null;   // last parsed balance
        this._error = null;    // last error message
        this._updated = null;  // Date of last successful fetch
        this._barPercent = 0;
        this._barLow = false;
        this._history = {};
        this._historyLoaded = false;
        this._saveState = { inFlight: false, pending: null, dirReady: false };

        this._session = new Soup.Session();
        this._session.timeout = 30;

        this._buildBar();
        this._buildMenu();

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        const bindings = [
            ['api-key', 'apiKey'],
            ['currency', 'currency'],
            ['refresh-interval', 'refreshInterval'],
            ['display-mode', 'displayMode'],
            ['reference-amount', 'referenceAmount'],
            ['warn-threshold', 'warnThreshold'],
            ['bar-color', 'barColor'],
            ['peak-indicator', 'peakIndicator'],
            ['peak-logo-color', 'peakColor'],
        ];
        for (const [key, prop] of bindings) {
            this.settings.bind(key, prop, this._onSettingsChanged.bind(this));
        }
        // bind() normally initialises the properties, but don't depend on it.
        for (const [key, prop] of bindings) {
            if (this[prop] === undefined) {
                try {
                    this[prop] = this.settings.getValue(key);
                } catch (e) {
                    global.logWarning('[' + UUID + '] could not read setting ' + key + ': ' + e.message);
                }
            }
        }
        this._lastApiKey = this.apiKey;
        this._lastCurrency = this.currency;
        this._ready = true;

        this._render();
        this._loadHistory(() => {
            this._historyLoaded = true;
            this._restartTimer();
            this._refresh();
            this._render();
        });
        global.log('[' + UUID + '] loaded instance ' + instance_id);
    },

    _buildBar: function () {
        this._barArea = new St.DrawingArea({ width: BAR_WIDTH_PX, height: BAR_HEIGHT_PX, style_class: 'ds-bar' });
        this._barArea.connect('repaint', this._drawBar.bind(this));
        this._barArea.hide();
        // The applet box fills children vertically by default; without
        // y_fill:false the bar is stretched to panel height and the rounded
        // fill turns into a blob.
        this.actor.add(this._barArea, { y_align: St.Align.MIDDLE, y_fill: false });
    },

    _buildMenu: function () {
        this._menuStatus = new PopupMenu.PopupMenuItem('…', { reactive: false });
        this._menuSpent = new PopupMenu.PopupMenuItem('…', { reactive: false });
        this._menuPricing = new PopupMenu.PopupMenuItem('…', { reactive: false });
        this._applet_context_menu.addMenuItem(this._menuStatus);
        this._applet_context_menu.addMenuItem(this._menuSpent);
        this._applet_context_menu.addMenuItem(this._menuPricing);
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._applet_context_menu.addAction(_('Refresh now'), () => this._refresh());
        this._applet_context_menu.addAction(_('Open DeepSeek platform'), () => {
            Gio.AppInfo.launch_default_for_uri(PLATFORM_URL, null);
        });
    },

    _drawBar: function () {
        const [surfaceW, surfaceH] = this._barArea.get_surface_size();
        const cr = this._barArea.get_context();

        // Draw at the intended size, centered, so the bar still looks right if
        // the surface is ever larger than requested.
        const w = Math.min(surfaceW, BAR_WIDTH_PX);
        const h = Math.min(surfaceH, BAR_HEIGHT_PX);
        const x = Math.round((surfaceW - w) / 2);
        const y = Math.round((surfaceH - h) / 2);

        cr.setSourceRGBA(0.5, 0.5, 0.5, 0.35);
        roundedRect(cr, x, y, w, h, h / 2);
        cr.fill();

        const fillW = w * clampPercent(this._barPercent) / 100;
        if (fillW > 0.5) {
            if (this._barLow) {
                cr.setSourceRGB(0.88, 0.11, 0.14);                    // warning red
            } else {
                const rgb = parseHexColor(this.barColor) || parseHexColor(DEFAULT_BAR_COLOR);
                cr.setSourceRGB(rgb.r, rgb.g, rgb.b);
            }
            roundedRect(cr, x, y, fillW, h, h / 2);
            cr.fill();
        }
        cr.$dispose();
    },

    // Peak-hour billing: tint the panel logo during DeepSeek's peak-rate
    // windows and schedule a one-shot timer to flip it back at the boundary.
    _updatePricing: function () {
        let path = this._iconNormalPath;
        if (this.peakIndicator && isPeakTime(new Date())) {
            const tinted = this._peakIconPath(this.peakColor);
            if (tinted) path = tinted;
        }
        if (path !== this._lastIconPath) {
            this._lastIconPath = path;
            this.set_applet_icon_path(path);
        }

        if (this._peakTimer) {
            GLib.source_remove(this._peakTimer);
            this._peakTimer = 0;
        }
        if (this._destroyed || !this.peakIndicator) return;
        const next = nextPricingChange(new Date());
        if (!next) return;
        const seconds = Math.max(1, Math.ceil(next.t - Date.now() / 1000) + 5);
        this._peakTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._peakTimer = 0;
            this._render(); // re-tints the icon and refreshes tooltip and menu
            return GLib.SOURCE_REMOVE;
        });
    },

    _pricingText: function () {
        const now = new Date();
        const state = isPeakTime(now)
            ? _('Peak hours — 2× the off-peak price')
            : _('Off-peak — half price');
        const next = nextPricingChange(now);
        if (!next) return state;
        return _('%s until %s (in %s)').format(
            state, formatClock(next.t, now), formatDuration(next.t - now.getTime() / 1000));
    },

    // Path of the pre-rendered tinted logo for a peak color, or null when the
    // color is not one of the shipped variants.
    _peakIconPath: function (color) {
        const file = peakIconFile(color);
        return file ? GLib.build_filenamev([this._appletDir, file]) : null;
    },

    _onSettingsChanged: function () {
        if (!this._ready) return;
        const credsChanged = this.apiKey !== this._lastApiKey || this.currency !== this._lastCurrency;
        this._lastApiKey = this.apiKey;
        this._lastCurrency = this.currency;
        this._restartTimer();
        this._render();
        if (credsChanged) this._refresh();
    },

    _restartTimer: function () {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._destroyed) return;
        const minutes = Math.max(1, parseInt(this.refreshInterval, 10) || 5);
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, minutes * 60, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    },

    _refresh: function () {
        if (this._destroyed || this._fetching || !this._historyLoaded) return;

        const key = (this.apiKey || '').trim();
        if (!key) {
            this._error = _('No API key configured (right-click → Configure…)');
            this._render();
            return;
        }

        this._fetching = true;
        const message = Soup.Message.new('GET', BALANCE_URL);
        message.request_headers.append('Authorization', 'Bearer ' + key);
        message.request_headers.append('Accept', 'application/json');

        this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            this._fetching = false;
            if (this._destroyed) return;

            let bytes;
            try {
                bytes = session.send_and_read_finish(result);
            } catch (e) {
                this._fail(_('Network error: %s').format(e.message));
                return;
            }

            const status = message.get_status();
            if (status === 401 || status === 403) {
                this._fail(_('Invalid API key (HTTP %s)').format(status));
                return;
            }
            if (status === 429) {
                this._fail(_('Rate limited (HTTP 429) — try a longer refresh interval'));
                return;
            }
            if (status !== Soup.Status.OK) {
                this._fail(_('API error: HTTP %s').format(status));
                return;
            }

            let data;
            try {
                data = JSON.parse(new TextDecoder().decode(bytes.get_data()));
            } catch (e) {
                this._fail(_('Could not parse the API response'));
                return;
            }
            this._succeed(data);
        });
    },

    _succeed: function (data) {
        const parsed = parseBalanceResponse(data, this.currency);
        if (!parsed) {
            this._fail(_('Unexpected response from the balance endpoint'));
            return;
        }

        this._result = parsed;
        this._error = null;
        this._updated = new Date();

        const nowSec = Math.floor(Date.now() / 1000);
        let series = this._history[parsed.currency];
        if (!Array.isArray(series)) series = [];
        const dirty = appendSample(series, nowSec, parsed.total);
        this._history[parsed.currency] = series;
        if (dirty) {
            pruneSamples(series, nowSec);
            this._saveHistory();
        }

        this._render();
    },

    _fail: function (message) {
        this._error = message;
        // Log real failures (but not the "no API key yet" state) for troubleshooting.
        if ((this.apiKey || '').trim()) global.logWarning('[' + UUID + '] ' + message);
        this._render();
    },

    _percentLeft: function () {
        const reference = parseFloat(this.referenceAmount) || 0;
        if (!this._result || reference <= 0) return null;
        return (this._result.total / reference) * 100;
    },

    _render: function () {
        const mode = this.displayMode || 'percent';
        const result = this._result;
        const percent = this._percentLeft();
        const warnBelow = parseFloat(this.warnThreshold);
        const low = percent !== null && percent < (isFinite(warnBelow) ? warnBelow : 20);

        let label = '—';
        if (result) {
            if (mode === 'balance') {
                label = formatAmount(result.total, result.currency);
            } else if (mode === 'bar') {
                label = '';
            } else {
                label = percent !== null
                    ? Math.round(percent) + '%'
                    : formatAmount(result.total, result.currency);
            }
        }
        this.set_applet_label(label);
        this._applet_label.set_style(result && low ? WARN_COLOR : null);

        this._barPercent = percent === null ? 0 : clampPercent(percent);
        this._barLow = !!(result && low);
        if (result && (mode === 'bar' || mode === 'bar-percent')) {
            this._barArea.show();
            this._barArea.queue_repaint();
        } else {
            this._barArea.hide();
        }

        this._updatePricing();
        this.set_applet_tooltip(this._tooltipText());
        this._updateMenu();
    },

    _tooltipText: function () {
        const lines = [_('DeepSeek API balance')];
        const result = this._result;

        if (this._error) lines.push('⚠ ' + this._error);

        if (result) {
            lines.push(_('Balance: %s %s').format(formatAmount(result.total, result.currency), result.currency));
            // toppedUp/granted describe the current balance (paid vs free
            // credits), not the original top-up total — the API has no such field.
            lines.push(_('Of which paid: %s · granted: %s').format(
                formatAmount(result.toppedUp, result.currency),
                formatAmount(result.granted, result.currency)));
            lines.push(result.available ? _('Available for API calls: yes') : _('Available for API calls: NO'));
            lines.push(this._pricingText());

            const reference = parseFloat(this.referenceAmount) || 0;
            lines.push('');
            if (reference > 0) {
                const percent = (result.total / reference) * 100;
                lines.push(_('%s of %s reference remaining').format(
                    percent.toFixed(1) + '%', formatAmount(reference, result.currency)));
            } else {
                lines.push(_('Set a reference amount in Configure… to show a percentage.'));
            }

            const series = this._history[result.currency];
            if (Array.isArray(series) && series.length > 1) {
                const nowSec = Math.floor(Date.now() / 1000);
                const today = spentSince(series, startOfToday(nowSec));
                const week = spentSince(series, nowSec - 7 * DAY_SECONDS);
                const month = spentSince(series, nowSec - 30 * DAY_SECONDS);
                lines.push(_('Spent today: %s').format(formatAmount(today, result.currency)));
                lines.push(_('Spent last 7 days: %s').format(formatAmount(week, result.currency)));
                lines.push(_('Spent last 30 days: %s').format(formatAmount(month, result.currency)));

                const rate = week / 7;
                if (rate > 0.001 && result.total > 0) {
                    const daysLeft = result.total / rate;
                    if (daysLeft > 365) {
                        lines.push(_('More than a year of balance left at the last 7 days\' rate'));
                    } else {
                        lines.push(_('≈ %s days left at the last 7 days\' rate').format(
                            daysLeft >= 10 ? Math.round(daysLeft) : daysLeft.toFixed(1)));
                    }
                } else if (week === 0) {
                    lines.push(_('No spend recorded in the last 7 days'));
                }
                lines.push(_('(inferred from balance changes; the API does not expose token counts)'));
            } else {
                lines.push('');
                lines.push(_('Spend tracking starts once a few balance samples are in.'));
            }
        } else if (!this._error) {
            lines.push(_('No data yet.'));
        }

        const minutes = Math.max(1, parseInt(this.refreshInterval, 10) || 5);
        const when = this._updated
            ? this._updated.getHours() + ':' + String(this._updated.getMinutes()).padStart(2, '0')
            : _('never');
        lines.push('');
        lines.push(_('Updated %s · refreshes every %s min').format(when, minutes));
        return lines.join('\n');
    },

    _updateMenu: function () {
        const result = this._result;
        this._menuStatus.label.text = result
            ? _('Balance: %s %s').format(formatAmount(result.total, result.currency), result.currency)
            : _('Balance: —');

        const series = result && Array.isArray(this._history[result.currency]) ? this._history[result.currency] : null;
        if (series && series.length > 1) {
            const nowSec = Math.floor(Date.now() / 1000);
            this._menuSpent.label.text = _('Spent today: %s   ·   7 days: %s').format(
                formatAmount(spentSince(series, startOfToday(nowSec)), result.currency),
                formatAmount(spentSince(series, nowSec - 7 * DAY_SECONDS), result.currency));
        } else {
            this._menuSpent.label.text = this._error ? this._error : _('Gathering spend data…');
        }

        this._menuPricing.label.text = this._pricingText();
    },

    // ===== history-io-methods:start =====
    _loadHistory: function (callback) {
        readJsonFile(HISTORY_PATH, (data) => {
            if (data) {
                this._history = data;
                callback();
                return;
            }
            readJsonFile(LEGACY_HISTORY_PATH, (legacy) => {
                // Pre-release builds kept the history in the config dir; move it.
                if (legacy) {
                    this._history = legacy;
                    this._saveHistory();
                }
                callback();
            });
        });
    },

    _saveHistory: function () {
        writeJsonFile(HISTORY_PATH, HISTORY_DIR, this._history, this._saveState);
    },
    // ===== history-io-methods:end =====

    on_applet_clicked: function (event) {
        this._applet_context_menu.toggle();
    },

    on_applet_removed_from_panel: function () {
        this._destroyed = true;
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._peakTimer) {
            GLib.source_remove(this._peakTimer);
            this._peakTimer = 0;
        }
        if (this.settings) this.settings.finalize();
        if (this._session) this._session.abort();
    },
};

function main(metadata, orientation, panel_height, instance_id) {
    return new DeepSeekBalanceApplet(metadata, orientation, panel_height, instance_id);
}
