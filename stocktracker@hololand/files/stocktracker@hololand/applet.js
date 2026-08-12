/*
 * Stock Tracker - a clean, configurable, minimalist stock ticker applet for Cinnamon.
 *
 * Data source: Yahoo Finance chart endpoint (no API key required). Yahoo's API
 * blocks non-browser TLS fingerprints and requires a session cookie + crumb, so
 * requests are made via `curl` with a browser-matched cipher order and a cached
 * cookie/crumb handshake. This is an unofficial endpoint and may change; the
 * applet degrades gracefully (cached values, clear status) when a request fails.
 *
 * Requires: curl (preinstalled on most distributions).
 *
 * Licensed under the GNU GPL v2 or later. See LICENSE.
 */

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;

const UUID = "stocktracker@hololand";
const USER_AGENT =
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

// ---------------------------------------------------------------------------
// Networking. Yahoo's API hosts (query1/query2.finance.yahoo.com) block
// non-browser TLS fingerprints, so plain libsoup requests get HTTP 429. We use
// `curl` with a browser-matched cipher order instead — the approach the
// community "Yahoo Finance Quotes" desklet settled on after Yahoo's 2025
// anti-bot changes. Access also requires a session cookie + crumb token.
// ---------------------------------------------------------------------------
const YF_COOKIE_URL = "https://finance.yahoo.com/";
const YF_CONSENT_URL = "https://consent.yahoo.com/v2/collectConsent";
const YF_CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb";
const YF_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";

// Browser Accept header for the cookie/consent requests; Yahoo only hands back
// a session cookie when the request looks like it came from a browser.
const ACCEPT_HTML =
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

const AUTH_COOKIE = "A1";       // the cookie that proves we have a session
const CONSENT_COOKIE = "GUCS";  // set when an EU-style consent step is required
const MAX_AUTH_ATTEMPTS = 3;
const HTTP_CODE_MARKER = "HTTP_CODE=";

// Browser-matched TLS cipher order. Without this, Yahoo's API returns 429.
const CURL_CIPHERS =
    "TLS_AES_128_GCM_SHA256,TLS_AES_256_GCM_SHA384,TLS_CHACHA20_POLY1305_SHA256," +
    "TLS_AES_128_CCM_SHA256,TLS_AES_128_CCM_8_SHA256,ECDHE-ECDSA-AES128-GCM-SHA256," +
    "ECDHE-RSA-AES128-GCM-SHA256,ECDHE-ECDSA-AES256-GCM-SHA384,ECDHE-RSA-AES256-GCM-SHA384," +
    "ECDHE-ECDSA-CHACHA20-POLY1305,ECDHE-RSA-CHACHA20-POLY1305,ECDHE-ECDSA-AES128-SHA256," +
    "ECDHE-RSA-AES128-SHA256,ECDHE-ECDSA-AES128-SHA,ECDHE-RSA-AES128-SHA," +
    "ECDHE-ECDSA-AES256-SHA384,ECDHE-RSA-AES256-SHA384,ECDHE-ECDSA-AES256-SHA," +
    "ECDHE-RSA-AES256-SHA,AES128-GCM-SHA256,AES256-GCM-SHA384";

// ---------------------------------------------------------------------------
// Translation helper (gettext); falls back to identity if unavailable.
// ---------------------------------------------------------------------------
let _;
try {
    const Gettext = imports.gettext;
    Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
    _ = function (str) {
        let t = Gettext.dgettext(UUID, str);
        return t === str ? str : t;
    };
} catch (e) {
    _ = function (str) { return str; };
}

// Run curl asynchronously. `argv` is the array of arguments AFTER "curl".
// Calls onDone({ ok, status, body, error }):
//   ok     - false if curl could not be launched at all (e.g. not installed)
//   status - the HTTP status code (from -w "HTTP_CODE=%{http_code}")
//   body   - the response body with the status marker stripped off
//   error  - stderr text, if any
function runCurl(argv, onDone) {
    let proc;
    try {
        proc = new Gio.Subprocess({
            argv: ["curl"].concat(argv),
            flags:
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE,
        });
        proc.init(null);
    } catch (e) {
        onDone({ ok: false, status: 0, body: "", error: "" + e });
        return;
    }
    proc.communicate_utf8_async(null, null, function (p, res) {
        let success = false;
        let stdout = "";
        let stderr = "";
        try {
            [success, stdout, stderr] = p.communicate_utf8_finish(res);
        } catch (e) {
            onDone({ ok: false, status: 0, body: "", error: "" + e });
            return;
        }
        let exitOk = false;
        try {
            exitOk = p.get_exit_status() === 0;
        } catch (e) {}

        // -w "HTTP_CODE=%{http_code}" appends the status code after the body.
        let body = stdout || "";
        let status = 0;
        let idx = body.lastIndexOf(HTTP_CODE_MARKER);
        if (idx >= 0) {
            status =
                parseInt(body.substring(idx + HTTP_CODE_MARKER.length), 10) || 0;
            body = body.substring(0, idx);
        }
        onDone({ ok: exitOk, status: status, body: body, error: stderr || "" });
    });
}

// ---------------------------------------------------------------------------
// Map a UI range to Yahoo (range, interval).
// ---------------------------------------------------------------------------
function rangeParams(range) {
    switch (range) {
        case "5d":
            return { range: "5d", interval: "15m" };
        case "1mo":
            return { range: "1mo", interval: "1d" };
        case "6mo":
            return { range: "6mo", interval: "1d" };
        case "1y":
            return { range: "1y", interval: "1d" };
        case "1d":
        default:
            return { range: "1d", interval: "5m" };
    }
}

// ---------------------------------------------------------------------------
// Applet
// ---------------------------------------------------------------------------
function StockTrackerApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

StockTrackerApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instanceId) {
        Applet.TextApplet.prototype._init.call(
            this,
            orientation,
            panelHeight,
            instanceId
        );

        try {
            this.metadata = metadata;
            this.orientation = orientation;
            this.instanceId = instanceId;

            this._quotes = {};        // symbol -> quote object
            this._symbols = [];         // ordered list of symbols
            this._rotateIndex = 0;
            this._lastUpdated = null;
            this._refreshLoopId = 0;
            this._rotateLoopId = 0;
            this._gapId = 0;
            this._menuRows = {};       // symbol -> { ... menu widgets }
            this._fetching = false;

            // Yahoo authorization state. We store the cookie jar (curl Netscape
            // format) and crumb token in a cache dir, and reuse them across
            // refreshes/sessions until they stop working.
            this._crumb = null;
            this._authAttempts = 0;
            let cacheDir =
                GLib.get_user_cache_dir() + "/" + UUID;
            try {
                GLib.mkdir_with_parents(cacheDir, 0o755);
            } catch (e) {
                global.logError("[" + UUID + "] cannot create cache dir: " + e);
            }
            this._cookieFile = cacheDir + "/cookies-" + instanceId + ".txt";

            // Settings.
            this.settings = new Settings.AppletSettings(
                this,
                metadata.uuid,
                instanceId
            );
            this._bindSettings();

            // Popup menu.
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Panel display. We do NOT colour by poking markup onto the single
            // base St.Label: St.Label caches its plain text and re-applies it on
            // every restyle/relayout, dropping our markup but keeping the colour
            // attributes — so the colours end up on the wrong characters. Instead
            // we use two St.Labels (symbol + value) and colour the value via the
            // St `.style` (CSS) API — the same reliable approach the popup rows
            // use. The base _applet_label is replaced as the layout bin's child.
            this._panelSym = new St.Label({ style_class: "applet-label" });
            this._panelVal = new St.Label({ style_class: "applet-label" });
            this._panelSym.set_y_align(Clutter.ActorAlign.CENTER);
            this._panelVal.set_y_align(Clutter.ActorAlign.CENTER);
            this._panelBox = new St.BoxLayout();
            this._panelBox.add_child(this._panelSym);
            this._panelBox.add_child(this._panelVal);
            this._layoutBin.set_child(this._panelBox);

            this._panelSym.set_text("");
            this._panelVal.set_text("…");
            this.set_applet_tooltip(_("Stock Tracker"));

            // Order matters: build the symbol list *before* the menu, so the
            // popup is constructed with the watchlist already populated. (When
            // these ran the other way round, a fresh start/restart built the
            // menu while _symbols was still empty — the popup showed "No stocks
            // yet" until a settings change rebuilt it. The panel was unaffected
            // because it reads _symbols, which _rebuildOrder fills in.)
            this._rebuildOrder();
            this._buildMenu();
            this._startRotation();

            // Initial fetch (slightly delayed so the panel paints first).
            this._initialTimeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    this._initialTimeout = 0;
                    this._refresh();
                    this._startRefreshLoop();
                    return GLib.SOURCE_REMOVE;
                }
            );
        } catch (e) {
            global.logError("[" + UUID + "] init error: " + e);
        }
    },

    _bindSettings: function () {
        const keys = [
            ["watchlist", this._onWatchlistChanged],
            ["show-symbol-in-panel", this._onDisplayChanged],
            ["change-mode", this._onDisplayChanged],
            ["color-enabled", this._onDisplayChanged],
            ["decimals", this._onDisplayChanged],
            ["rotation-interval", this._onRotationChanged],
            ["refresh-interval", this._onRefreshIntervalChanged],
            ["chart-range", this._onRangeChanged],
            ["show-charts", this._onWatchlistChanged],
            ["debug-logging", function () {}],
        ];
        for (let i = 0; i < keys.length; i++) {
            let prop = keys[i][0].replace(/-/g, "_");
            this.settings.bind(keys[i][0], prop, keys[i][1].bind(this));
        }
    },

    // --- Settings callbacks --------------------------------------------------

    _onWatchlistChanged: function () {
        this._rebuildOrder();
        this._buildMenu();
        this._rotateIndex = 0;
        this._authAttempts = 0; // give auth a fresh chance when the list changes
        this._updatePanel();
        this._refresh();
    },

    _onDisplayChanged: function () {
        this._updatePanel();
        this._updateMenuData();
    },

    _onRotationChanged: function () {
        this._startRotation();
    },

    _onRefreshIntervalChanged: function () {
        this._startRefreshLoop();
    },

    _onRangeChanged: function () {
        this._refresh();
    },

    // --- Helpers -------------------------------------------------------------

    _rebuildOrder: function () {
        this._symbols = [];
        let list = this.watchlist || [];
        for (let i = 0; i < list.length; i++) {
            let sym = (list[i].symbol || "").trim().toUpperCase();
            if (sym && this._symbols.indexOf(sym) === -1) {
                this._symbols.push(sym);
            }
        }
    },

    _labelFor: function (symbol) {
        let list = this.watchlist || [];
        for (let i = 0; i < list.length; i++) {
            if ((list[i].symbol || "").trim().toUpperCase() === symbol) {
                let lbl = (list[i].label || "").trim();
                if (lbl) return lbl;
            }
        }
        return symbol;
    },

    _fmtNumber: function (n) {
        let d = this.decimals;
        if (typeof d !== "number" || d < 0) d = 2;
        return Number(n).toFixed(d);
    },

    _fmtChange: function (q) {
        let arrow = q.change > 0 ? "▲" : q.change < 0 ? "▼" : "■";
        let sign = q.change > 0 ? "+" : "";
        let pct = sign + q.changePct.toFixed(2) + "%";
        let abs = sign + this._fmtNumber(q.change);
        switch (this.change_mode) {
            case "absolute":
                return arrow + " " + abs;
            case "both":
                return arrow + " " + abs + "  " + pct;
            case "percent":
            default:
                return arrow + " " + pct;
        }
    },

    _colorFor: function (change) {
        if (!this.color_enabled) return null;
        if (change > 0) return "#26a269";
        if (change < 0) return "#c01c28";
        return null;
    },

    // Escape text for use inside Pango markup (panel label + tooltip).
    _escapeMarkup: function (s) {
        return ("" + s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    },

    // --- Panel ---------------------------------------------------------------

    // The panel shows the symbol in the default text colour (left label) and the
    // price + change + arrow tinted green/red (right label, coloured via the St
    // `.style` API). Two separate St.Labels avoid the markup-on-a-single-label
    // pitfall described in _init.
    _updatePanel: function () {
        if (this._symbols.length === 0) {
            this._panelSym.set_text("");
            this._panelVal.set_text(_("No stocks"));
            this._panelVal.style = "";
            this.set_applet_tooltip(
                this._escapeMarkup(_("Add symbols in this applet's settings.")),
                true
            );
            return;
        }

        if (this._rotateIndex >= this._symbols.length) this._rotateIndex = 0;
        let symbol = this._symbols[this._rotateIndex];
        let q = this._quotes[symbol];
        let symText = this.show_symbol_in_panel ? symbol + " " : "";

        if (!q || !q.ok) {
            this._panelSym.set_text(symText);
            this._panelVal.set_text("—");
            this._panelVal.style = "";
        } else {
            let valText = this._fmtNumber(q.price) + " " + this._fmtChange(q);
            let color = this._colorFor(q.change);
            this._panelSym.set_text(symText);
            this._panelVal.set_text(valText);
            this._panelVal.style = color ? "color: " + color + ";" : "";
        }
        this.set_applet_tooltip(this._tooltipText(), true);
    },

    // Returns Pango markup (consumed with use_markup=true): symbol in the
    // default colour, price+change tinted green/red to match the panel.
    _tooltipText: function () {
        let lines = [];
        for (let i = 0; i < this._symbols.length; i++) {
            let s = this._symbols[i];
            let q = this._quotes[s];
            if (q && q.ok) {
                let valText = this._escapeMarkup(
                    this._fmtNumber(q.price) + "  " + this._fmtChange(q)
                );
                let color = this._colorFor(q.change);
                let valPart = color
                    ? '<span color="' + color + '">' + valText + "</span>"
                    : valText;
                lines.push(this._escapeMarkup(s) + "  " + valPart);
            } else {
                lines.push(this._escapeMarkup(s) + "  —");
            }
        }
        if (this._lastUpdated) {
            lines.push("");
            lines.push(
                this._escapeMarkup(_("Updated %s").format(this._lastUpdated))
            );
        }
        return lines.join("\n");
    },

    _startRotation: function () {
        if (this._rotateLoopId) {
            GLib.source_remove(this._rotateLoopId);
            this._rotateLoopId = 0;
        }
        let secs = this.rotation_interval;
        if (typeof secs !== "number" || secs < 1) secs = 5;
        this._rotateLoopId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            secs,
            () => {
                if (this._symbols.length > 1) {
                    this._rotateIndex =
                        (this._rotateIndex + 1) % this._symbols.length;
                    this._updatePanel();
                }
                return GLib.SOURCE_CONTINUE;
            }
        );
    },

    // --- Refresh loop --------------------------------------------------------

    _startRefreshLoop: function () {
        if (this._refreshLoopId) {
            GLib.source_remove(this._refreshLoopId);
            this._refreshLoopId = 0;
        }
        let secs = this.refresh_interval;
        if (typeof secs !== "number" || secs < 15) secs = 60;
        this._refreshLoopId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            secs,
            () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            }
        );
    },

    // Common curl arguments. Uses curl's own cookie jar (-c writes, -b reads)
    // so the session cookie persists across the auth steps and between refreshes.
    _curlBase: function () {
        return [
            "-sSL",
            "--connect-timeout", "5",
            "-m", "15",
            "--ciphers", CURL_CIPHERS,
            "-A", USER_AGENT,
            "-w", HTTP_CODE_MARKER + "%{http_code}",
            "-c", this._cookieFile,
            "-b", this._cookieFile,
        ];
    },

    // Check the (Netscape-format) curl cookie jar for a named cookie.
    _jarHasCookie: function (name) {
        let contents;
        try {
            let res = GLib.file_get_contents(this._cookieFile);
            if (!res[0]) return false;
            contents = res[1];
        } catch (e) {
            return false;
        }
        let text;
        try {
            text = new TextDecoder().decode(contents);
        } catch (e) {
            try {
                text = imports.byteArray.toString(contents);
            } catch (e2) {
                return false;
            }
        }
        let lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
            // domain \t flag \t path \t secure \t expiry \t name \t value
            let cols = lines[i].split("\t");
            if (cols.length >= 6 && cols[5] === name) return true;
        }
        return false;
    },

    // Ensure we hold a valid session cookie + crumb, doing the cookie ->
    // (consent) -> crumb handshake if needed. onReady(true|false).
    _ensureAuth: function (onReady) {
        if (this._crumb && this._jarHasCookie(AUTH_COOKIE)) {
            onReady(true);
            return;
        }
        if (this._authAttempts >= MAX_AUTH_ATTEMPTS) {
            onReady(false);
            return;
        }
        this._authAttempts++;

        // Step 1: fetch a page that sets the session cookie.
        runCurl(
            this._curlBase().concat(["-H", "Accept: " + ACCEPT_HTML, YF_COOKIE_URL]),
            (r) => {
            if (this._jarHasCookie(AUTH_COOKIE)) {
                this._fetchCrumb(onReady);
            } else if (
                this._jarHasCookie(CONSENT_COOKIE) &&
                /<form method="post"/.test(r.body || "")
            ) {
                // EU-style consent screen: submit the hidden form (reject all)
                // to obtain the real session cookie.
                let form = this._buildConsentForm(r.body);
                runCurl(
                    this._curlBase().concat([
                        "-H", "Accept: " + ACCEPT_HTML,
                        "-d", form, YF_CONSENT_URL,
                    ]),
                    () => {
                        if (this._jarHasCookie(AUTH_COOKIE)) {
                            this._fetchCrumb(onReady);
                        } else {
                            this._logDebug(
                                "[" + UUID + "] auth: consent did not yield cookie"
                            );
                            onReady(false);
                        }
                    }
                );
            } else {
                this._logDebug(
                    "[" + UUID + "] auth: no cookie (curlOk=" + r.ok +
                        " status=" + r.status +
                        " err=" + ("" + r.error).trim() +
                        " jar=[" + this._jarCookieNames().join(",") + "]" +
                        " bodyLen=" + (r.body ? r.body.length : 0) + ")"
                );
                onReady(false);
            }
        });
    },

    // List the names of all cookies currently in the jar (for diagnostics).
    _jarCookieNames: function () {
        let names = [];
        let contents;
        try {
            let res = GLib.file_get_contents(this._cookieFile);
            if (!res[0]) return names;
            contents = res[1];
        } catch (e) {
            return names;
        }
        let text;
        try {
            text = new TextDecoder().decode(contents);
        } catch (e) {
            return names;
        }
        let lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
            let cols = lines[i].split("\t");
            if (cols.length >= 6 && cols[5]) names.push(cols[5]);
        }
        return names;
    },

    _fetchCrumb: function (onReady) {
        runCurl(this._curlBase().concat([YF_CRUMB_URL]), (r) => {
            let crumb = ("" + r.body).trim();
            // A valid crumb is a short token with no whitespace.
            if (r.status === 200 && crumb && !/\s/.test(crumb)) {
                this._crumb = crumb;
                this._authAttempts = 0;
                this._logDebug("[" + UUID + "] auth: crumb acquired");
                onReady(true);
            } else {
                this._logDebug(
                    "[" + UUID + "] auth: crumb failed (status=" + r.status + ")"
                );
                onReady(false);
            }
        });
    },

    _buildConsentForm: function (html) {
        let fields = "";
        let re = /<input type="hidden" name="(.*?)" value="(.*?)">/g;
        let m;
        let count = 0;
        while (count < 20 && (m = re.exec(html)) !== null) {
            fields += m[1] + "=" + m[2] + "&";
            count++;
        }
        fields += "reject=reject";
        return fields;
    },

    _refresh: function () {
        if (this._symbols.length === 0) {
            this._updatePanel();
            return;
        }
        if (this._fetching) return; // a refresh pass is already running
        this._fetching = true;
        this._ensureAuth((ok) => {
            if (!ok) {
                let msg =
                    this._authAttempts >= MAX_AUTH_ATTEMPTS
                        ? _("Yahoo sign-in failed")
                        : _("Connecting…");
                for (let i = 0; i < this._symbols.length; i++) {
                    this._markError(this._symbols[i], msg);
                }
                this._fetching = false;
                return;
            }
            this._runFetchQueue();
        });
    },

    // Fetch symbols one at a time with a small gap, to stay gentle on the API.
    _runFetchQueue: function () {
        let params = rangeParams(this.chart_range);
        let queue = this._symbols.slice();

        let next = () => {
            if (queue.length === 0) {
                this._fetching = false;
                return;
            }
            let symbol = queue.shift();
            this._fetchSymbol(symbol, params, () => {
                if (queue.length === 0) {
                    this._fetching = false;
                    return;
                }
                this._gapId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    400,
                    () => {
                        this._gapId = 0;
                        next();
                        return GLib.SOURCE_REMOVE;
                    }
                );
            });
        };
        next();
    },

    _fetchSymbol: function (symbol, params, done) {
        let finish = () => {
            if (typeof done === "function") done();
        };
        let url =
            YF_CHART_BASE +
            encodeURIComponent(symbol) +
            "?range=" + params.range +
            "&interval=" + params.interval +
            "&includePrePost=false" +
            (this._crumb ? "&crumb=" + encodeURIComponent(this._crumb) : "");

        runCurl(this._curlBase().concat([url]), (r) => {
            this._logDebug(
                "[" + UUID + "] " + symbol + ": curlOk=" + r.ok +
                    " status=" + r.status +
                    " bodyLen=" + (r.body ? r.body.length : 0)
            );
            if (!r.ok) {
                this._markError(symbol, _("curl not available"));
                finish();
                return;
            }
            // A rejected crumb/cookie: drop the crumb so we re-auth next pass.
            if (r.status === 401 || r.status === 403) {
                this._crumb = null;
            }
            if (r.status !== 200 || !r.body) {
                let msg;
                if (r.status === 429) msg = _("Rate limited");
                else if (r.status === 401 || r.status === 403)
                    msg = _("Auth expired — will retry");
                else if (r.status) msg = "HTTP " + r.status;
                else msg = _("No data");
                this._markError(symbol, msg);
                finish();
                return;
            }
            try {
                let json = JSON.parse(r.body);
                let q = this._parseQuote(symbol, json);
                if (q) {
                    this._quotes[symbol] = q;
                    this._lastUpdated = this._nowString();
                    this._updatePanel();
                    this._updateMenuData();
                } else {
                    this._markError(symbol, _("Unrecognized symbol"));
                }
            } catch (e) {
                this._markError(symbol, _("Parse error"));
            }
            finish();
        });
    },

    _parseQuote: function (symbol, json) {
        if (
            !json ||
            !json.chart ||
            json.chart.error ||
            !json.chart.result ||
            !json.chart.result[0]
        ) {
            return null;
        }
        let result = json.chart.result[0];
        let meta = result.meta || {};
        let price = meta.regularMarketPrice;
        if (typeof price !== "number") return null;

        let prevClose =
            typeof meta.previousClose === "number"
                ? meta.previousClose
                : typeof meta.chartPreviousClose === "number"
                ? meta.chartPreviousClose
                : price;

        let change = price - prevClose;
        let changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0;

        // Series for the sparkline.
        let series = [];
        try {
            let closes =
                result.indicators &&
                result.indicators.quote &&
                result.indicators.quote[0] &&
                result.indicators.quote[0].close
                    ? result.indicators.quote[0].close
                    : [];
            for (let i = 0; i < closes.length; i++) {
                if (typeof closes[i] === "number") series.push(closes[i]);
            }
        } catch (e) {
            series = [];
        }

        return {
            ok: true,
            symbol: symbol,
            name: meta.shortName || meta.longName || symbol,
            price: price,
            prevClose: prevClose,
            change: change,
            changePct: changePct,
            currency: meta.currency || "",
            dayHigh:
                typeof meta.regularMarketDayHigh === "number"
                    ? meta.regularMarketDayHigh
                    : null,
            dayLow:
                typeof meta.regularMarketDayLow === "number"
                    ? meta.regularMarketDayLow
                    : null,
            series: series,
            error: null,
        };
    },

    _markError: function (symbol, msg) {
        let existing = this._quotes[symbol];
        if (existing) {
            existing.error = msg;
            existing.ok = existing.ok && true; // keep last good values if any
        } else {
            this._quotes[symbol] = {
                ok: false,
                symbol: symbol,
                error: msg,
                change: 0,
                changePct: 0,
                series: [],
            };
        }
        this._updatePanel();
        this._updateMenuData();
    },

    _nowString: function () {
        let now = GLib.DateTime.new_now_local();
        return now.format("%H:%M:%S");
    },

    // Verbose tracing, off by default. Enable "Debug logging" in settings to
    // print auth/fetch details to ~/.xsession-errors (or Looking Glass) when
    // diagnosing a Yahoo-side change.
    _logDebug: function (msg) {
        if (this.debug_logging) {
            global.log(msg);
        }
    },

    // --- Menu ----------------------------------------------------------------

    _buildMenu: function () {
        this.menu.removeAll();
        this._menuRows = {};

        // Header.
        let header = new PopupMenu.PopupMenuItem(_("Stock Tracker"), {
            reactive: false,
        });
        header.actor.add_style_class_name("stock-header");
        this.menu.addMenuItem(header);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (this._symbols.length === 0) {
            let empty = new PopupMenu.PopupMenuItem(
                _("No stocks yet — add some in Settings."),
                { reactive: false }
            );
            this.menu.addMenuItem(empty);
        }

        for (let i = 0; i < this._symbols.length; i++) {
            this._addSymbolRow(this._symbols[i]);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Updated line.
        this._updatedItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.menu.addMenuItem(this._updatedItem);

        // Refresh now.
        let refreshItem = new PopupMenu.PopupIconMenuItem(
            _("Refresh now"),
            "view-refresh-symbolic",
            St.IconType.SYMBOLIC
        );
        refreshItem.connect("activate", () => {
            // A manual refresh is also the user's "try again" — reset the auth
            // attempt counter and force a fresh cookie/crumb handshake.
            this._authAttempts = 0;
            this._crumb = null;
            this._refresh();
        });
        this.menu.addMenuItem(refreshItem);

        // No "Settings" item here on purpose: Cinnamon already provides a
        // "Configure..." entry in the applet's right-click context menu (it
        // calls configureApplet() for us), so a duplicate in the left-click
        // popup is redundant.

        this._updateMenuData();
    },

    _addSymbolRow: function (symbol) {
        let item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            hover: false,
        });

        let column = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: "stock-row",
        });

        // Top line: name/symbol  ...  price + change.
        let topRow = new St.BoxLayout({ vertical: false, x_expand: true });

        let nameBox = new St.BoxLayout({ vertical: true });
        let nameLabel = new St.Label({
            text: this._labelFor(symbol),
            style_class: "stock-name",
        });
        let symLabel = new St.Label({
            text: symbol,
            style_class: "stock-symbol",
        });
        nameBox.add_child(nameLabel);
        nameBox.add_child(symLabel);

        let spacer = new St.Bin({ x_expand: true });

        let valueBox = new St.BoxLayout({ vertical: true });
        let priceLabel = new St.Label({
            text: "—",
            style_class: "stock-price",
        });
        let changeLabel = new St.Label({
            text: "",
            style_class: "stock-change",
        });
        valueBox.add_child(priceLabel);
        valueBox.add_child(changeLabel);

        topRow.add_child(nameBox);
        topRow.add_child(spacer);
        topRow.add_child(valueBox);

        column.add_child(topRow);

        // Sparkline.
        let chart = null;
        if (this.show_charts) {
            chart = new St.DrawingArea({ style_class: "stock-chart" });
            chart.set_width(240);
            chart.set_height(46);
            chart._series = [];
            chart._up = true;
            chart.connect("repaint", (area) => {
                this._drawSparkline(area);
            });
            column.add_child(chart);
        }

        // Cinnamon's PopupBaseMenuItem historically exposes addActor(); fall
        // back to adding directly to the item's actor on builds that don't.
        if (typeof item.addActor === "function") {
            item.addActor(column, { expand: true, span: -1 });
        } else {
            item.actor.add_child(column);
        }
        this.menu.addMenuItem(item);

        this._menuRows[symbol] = {
            item: item,
            priceLabel: priceLabel,
            changeLabel: changeLabel,
            chart: chart,
        };
    },

    _drawSparkline: function (area) {
        let cr = area.get_context();
        let [w, h] = area.get_surface_size();
        let data = area._series || [];

        if (data.length < 2) {
            cr.$dispose();
            return;
        }

        let min = data[0];
        let max = data[0];
        for (let i = 1; i < data.length; i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }
        let range = max - min;
        if (range === 0) range = 1;

        let pad = 3;
        let usableH = h - pad * 2;
        let usableW = w - pad * 2;
        let step = usableW / (data.length - 1);

        let up = area._up;
        let r = up ? 0.149 : 0.753;
        let g = up ? 0.635 : 0.110;
        let b = up ? 0.412 : 0.157;

        // Fill under the line (subtle).
        cr.moveTo(pad, h - pad);
        for (let i = 0; i < data.length; i++) {
            let x = pad + step * i;
            let y = pad + usableH - ((data[i] - min) / range) * usableH;
            cr.lineTo(x, y);
        }
        cr.lineTo(pad + step * (data.length - 1), h - pad);
        cr.closePath();
        cr.setSourceRGBA(r, g, b, 0.12);
        cr.fill();

        // The line itself.
        cr.setLineWidth(1.5);
        cr.setSourceRGBA(r, g, b, 1.0);
        for (let i = 0; i < data.length; i++) {
            let x = pad + step * i;
            let y = pad + usableH - ((data[i] - min) / range) * usableH;
            if (i === 0) cr.moveTo(x, y);
            else cr.lineTo(x, y);
        }
        cr.stroke();

        cr.$dispose();
    },

    _updateMenuData: function () {
        if (this._updatedItem) {
            this._updatedItem.label.text = this._lastUpdated
                ? _("Updated %s").format(this._lastUpdated)
                : _("Waiting for data…");
        }

        for (let symbol in this._menuRows) {
            let row = this._menuRows[symbol];
            let q = this._quotes[symbol];
            if (!row) continue;

            if (q && q.ok) {
                let priceText = this._fmtNumber(q.price);
                if (q.currency) priceText += " " + q.currency;
                row.priceLabel.text = priceText;
                row.changeLabel.text = this._fmtChange(q);
                let color = this._colorFor(q.change);
                row.changeLabel.style = color ? "color: " + color + ";" : "";
                if (row.chart) {
                    row.chart._series = q.series || [];
                    row.chart._up = q.change >= 0;
                    row.chart.queue_repaint();
                }
            } else {
                row.priceLabel.text = "—";
                row.changeLabel.text =
                    q && q.error ? q.error : _("No data");
                row.changeLabel.style = "";
                if (row.chart) {
                    row.chart._series = [];
                    row.chart.queue_repaint();
                }
            }
        }
    },

    // --- Applet API ----------------------------------------------------------

    on_applet_clicked: function (event) {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function () {
        if (this._refreshLoopId) {
            GLib.source_remove(this._refreshLoopId);
            this._refreshLoopId = 0;
        }
        if (this._rotateLoopId) {
            GLib.source_remove(this._rotateLoopId);
            this._rotateLoopId = 0;
        }
        if (this._gapId) {
            GLib.source_remove(this._gapId);
            this._gapId = 0;
        }
        if (this._initialTimeout) {
            GLib.source_remove(this._initialTimeout);
            this._initialTimeout = 0;
        }
        if (this.settings) {
            this.settings.finalize();
        }
    },
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new StockTrackerApplet(metadata, orientation, panelHeight, instanceId);
}
