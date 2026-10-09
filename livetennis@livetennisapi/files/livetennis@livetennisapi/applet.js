const UUID = "livetennis@livetennisapi";

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;
const Gettext = imports.gettext;
const Mainloop = imports.mainloop;
const ByteArray = imports.byteArray;

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

function _n(singular, plural, count) {
    return Gettext.dngettext(UUID, singular, plural, count);
}

// ---------------------------------------------------------------------------
// Service constants
// ---------------------------------------------------------------------------

// Live Tennis API, public v1. Only the two FREE-tier reads are used, and only
// the first one is ever called by this applet:
//   GET /matches?status=live   -> list of matches in play (FREE)
// Documented at https://docs.livetennisapi.com/openapi.yaml (spec 1.12.0).
const API_MATCHES_URL = "https://api.livetennisapi.com/api/public/v1/matches";

// The key travels in the X-API-Key request header, never in the query string,
// so it cannot end up in a URL that is logged, shown in an error, or shared.
const API_KEY_HEADER = "X-API-Key";

// Free-tier budget, from the plan table in the API reference: 30 requests per
// minute and 100 requests per DAY. This applet spends exactly ONE request per
// refresh (a single unpaged list read), so the daily cap sets the floor:
//
//     86400 s/day / 100 req/day = 864 s per request at the hard limit
//     86400 s/day /   900 s     =  96 requests/day  <- 15 minutes, 4 spare
//     86400 s/day /   600 s     = 144 requests/day  <- 10 minutes, over cap
//
// 15 minutes is therefore the fastest cadence a free key can sustain for a
// whole day, and it is clamped HERE rather than only in settings-schema.json:
// a hand-edited settings file or an imported configuration cannot poll faster.
const MIN_REFRESH_SECONDS = 900;

// A 429 means the minute rate or the daily quota is already spent. Backing off
// to an hour stops the applet from compounding a breach it has already caused.
const RATE_LIMIT_BACKOFF_SECONDS = 3600;

// One page, no paging: 200 is the documented maximum for limit. If more than
// 200 matches are somehow in play, the applet shows the first page rather than
// spending a second request - this is a panel scoreboard, not an exporter.
//
// The tour and draw settings are applied to this page locally rather than as
// ?tour= / ?draw= query parameters. Same result, and changing either filter
// then costs no request at all, which matters on a 100-a-day key.
const MATCH_PAGE_LIMIT = 200;

// Panel marker for the player currently serving.
const SERVE_MARKER = "•";

// Panel markers for a break point and a tiebreak. Left untranslated on the
// panel on purpose: these are the standard scoreboard abbreviations, and the
// menu tooltip spells the break point out in full.
const BREAK_POINT_MARKER = "BP";
const TIEBREAK_MARKER = "TB";

// ---------------------------------------------------------------------------
// Pure helpers (no Cinnamon imports below this line until the applet section;
// everything here is plain data in, string or boolean out, and null-safe)
// ---------------------------------------------------------------------------

// Panel-sized form of a player name. The API documents Player.name only as a
// string, so this must not assume a word order: it drops a trailing initial
// ("Alcaraz C." -> "Alcaraz") and otherwise keeps the last word
// ("Carlos Alcaraz" -> "Alcaraz"). A doubles pair separated by "/" is
// shortened on each side.
function shortName(name) {
    if (typeof name !== "string") {
        return "?";
    }

    const trimmed = name.trim();
    if (trimmed === "") {
        return "?";
    }

    if (trimmed.indexOf("/") !== -1) {
        return trimmed.split("/").map(shortName).join("/");
    }

    const words = trimmed.split(/\s+/);
    if (words.length === 1) {
        return words[0];
    }

    const last = words[words.length - 1];
    // A trailing initial ("C." or "C") is not a surname; the surname precedes it.
    if (/^[^\s.]\.?$/.test(last)) {
        return words[words.length - 2];
    }

    return last;
}

// Score.games is PLAYER-MAJOR: [[6, 3], [4, 4]] is player 1's games per set
// then player 2's, and reads "6-4 3-4". Completed matches are documented to
// carry empty games arrays, so an empty result is normal, not an error.
function formatSets(games) {
    if (!Array.isArray(games) || games.length < 2) {
        return "";
    }

    const p1 = games[0];
    const p2 = games[1];
    if (!Array.isArray(p1) || !Array.isArray(p2)) {
        return "";
    }

    const sets = [];
    const played = Math.min(p1.length, p2.length);
    for (let i = 0; i < played; i++) {
        if (!Number.isFinite(p1[i]) || !Number.isFinite(p2[i])) {
            continue;
        }
        sets.push("%d-%d".format(p1[i], p2[i]));
    }

    return sets.join(" ");
}

// Score.points is ["0", "15", "30", "40", "AD"] in a normal game and the
// running tiebreak count as plain integer strings in a tiebreak. Entries can
// be NULL - observed live on completed matches - so both are checked.
function formatPoints(score) {
    if (!score || !Array.isArray(score.points) || score.points.length < 2) {
        return "";
    }

    const p1 = score.points[0];
    const p2 = score.points[1];
    if (typeof p1 !== "string" || typeof p2 !== "string") {
        return "";
    }

    return "%s-%s".format(p1, p2);
}

// Break point: the RECEIVER is one point from taking the server's game.
// That is the receiver holding advantage, or the receiver on 40 while the
// server is still on 0, 15 or 30. Never in a tiebreak, where there is no
// server's game to break and the notation means something else entirely.
function isBreakPoint(score) {
    if (!score || score.is_tiebreak === true) {
        return false;
    }

    const server = score.server;
    if (server !== 1 && server !== 2) {
        return false;
    }

    if (!Array.isArray(score.points) || score.points.length < 2) {
        return false;
    }

    const serverPoint = score.points[server - 1];
    const receiverPoint = score.points[server === 1 ? 1 : 0];
    if (typeof serverPoint !== "string" || typeof receiverPoint !== "string") {
        return false;
    }

    if (receiverPoint === "AD") {
        return true;
    }

    if (receiverPoint === "40") {
        return serverPoint === "0" || serverPoint === "15" || serverPoint === "30";
    }

    return false;
}

// One line of scoreboard for one match, e.g.
//   "@Alcaraz - Sinner  6-4 3-4  40-30  BP"   (@ stands in for the serve dot)
function formatMatchLine(match) {
    if (!match || !match.players) {
        return "";
    }

    const p1 = match.players.p1 ? shortName(match.players.p1.name) : "?";
    const p2 = match.players.p2 ? shortName(match.players.p2.name) : "?";
    const score = match.score;
    const server = score ? score.server : null;

    let names;
    if (server === 1) {
        names = "%s%s - %s".format(SERVE_MARKER, p1, p2);
    } else if (server === 2) {
        names = "%s - %s%s".format(p1, SERVE_MARKER, p2);
    } else {
        names = "%s - %s".format(p1, p2);
    }

    const parts = [names];

    const sets = formatSets(score ? score.games : null);
    if (sets !== "") {
        parts.push(sets);
    }

    const points = formatPoints(score);
    if (points !== "") {
        // In a tiebreak the same two numbers mean the tiebreak count, not
        // 0/15/30/40, so say which is being shown rather than let it be misread.
        parts.push(score && score.is_tiebreak === true
            ? "%s %s".format(TIEBREAK_MARKER, points)
            : points);
    }

    if (isBreakPoint(score)) {
        parts.push(BREAK_POINT_MARKER);
    }

    return parts.join("  ");
}

// Secondary menu line: which tournament and round this match belongs to.
function formatMatchContext(match) {
    if (!match) {
        return "";
    }

    const parts = [];
    if (typeof match.tournament === "string" && match.tournament !== "") {
        parts.push(match.tournament);
    }
    if (typeof match.round === "string" && match.round !== "") {
        parts.push(match.round);
    }

    return parts.join(" - ");
}

// The tour/draw filter, done locally with the API's own semantics: `tour` and
// `draw` both use the vocabulary of the matching query parameters, and a row
// whose value is NULL matches NEITHER choice - null is an answer, not a
// wildcard. An empty setting means "no filter" and keeps everything.
function matchesFilters(match, tour, draw) {
    if (!match) {
        return false;
    }

    if (tour && match.tour !== tour) {
        return false;
    }

    if (draw && match.draw !== draw) {
        return false;
    }

    return true;
}

// List endpoints answer {data, meta}. Anything else - a bare array, a missing
// key, a JSON string - yields an empty list rather than throwing.
function extractMatches(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (payload && Array.isArray(payload.data)) {
        return payload.data;
    }
    return [];
}

// Minutes from settings -> seconds actually used. Non-numeric or missing
// values fall back to the floor, and nothing can go below it.
function clampRefreshSeconds(minutes) {
    const asNumber = Number(minutes);
    if (!Number.isFinite(asNumber)) {
        return MIN_REFRESH_SECONDS;
    }

    return Math.max(MIN_REFRESH_SECONDS, Math.round(asNumber * 60));
}

// Every failure becomes ONE short panel label. No status codes the user cannot
// act on, no exception text, no URL, and never the key.
function describeFailure(kind, statusCode) {
    if (kind === "rate_limited") {
        return _("Tennis: rate limited");
    }
    if (kind === "unauthorized") {
        return _("Tennis: key rejected");
    }
    if (kind === "http") {
        return _("Tennis: service error (%d)").format(statusCode);
    }
    if (kind === "parse") {
        return _("Tennis: bad response");
    }

    return _("Tennis: offline");
}

// HTTP status -> failure kind, so the caller does not branch on numbers.
function classifyStatus(statusCode) {
    if (statusCode === 429) {
        return "rate_limited";
    }
    if (statusCode === 401 || statusCode === 403) {
        return "unauthorized";
    }
    if (statusCode >= 200 && statusCode < 300) {
        return null;
    }

    return "http";
}

// ---------------------------------------------------------------------------
// Applet
// ---------------------------------------------------------------------------

function LiveTennisApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

LiveTennisApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        // The panel label is a wide line of score text, so only a horizontal
        // panel can show it without clipping.
        this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);

        this._fetched = [];   // everything the last successful read returned
        this._matches = [];   // the tour/draw filtered view of it
        this._displayIndex = 0;
        this._statusLabel = null;
        this._lastRefresh = null;
        this._nextRefresh = null;
        this._refreshTimerId = null;
        this._cycleTimerId = null;
        this._destroyed = false;
        this._cancellable = new Gio.Cancellable();

        this._httpSession = this._createSession();

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("api-key", "apiKey", () => this._onCredentialChanged());
        this.settings.bind("refresh-minutes", "refreshMinutes", () => this._onCadenceChanged());
        this.settings.bind("tour", "tour", () => this._applyFilters());
        this.settings.bind("draw", "draw", () => this._applyFilters());
        this.settings.bind("cycle-seconds", "cycleSeconds", () => this._startCycleTimer());
        this.settings.bind("menu-limit", "menuLimit", () => this._renderMenu());
        this.settings.bind("show-icon", "showIcon", () => this._applyIcon());

        this._applyIcon();
        this._refresh();
        this._startCycleTimer();
    },

    _applyIcon: function () {
        if (this.showIcon) {
            this.set_applet_icon_symbolic_name("applications-games-symbolic");
        } else {
            this.hide_applet_icon();
        }
    },

    _createSession: function () {
        // libsoup 2 ships on Mint 20/21, libsoup 3 on Mint 22 and later.
        if (Soup.MAJOR_VERSION === 2) {
            const session = new Soup.SessionAsync();
            Soup.Session.prototype.add_feature.call(session, new Soup.ProxyResolverDefault());
            return session;
        }

        return new Soup.Session();
    },

    // -- settings callbacks -------------------------------------------------

    _onCredentialChanged: function () {
        // A new key deserves an immediate read: the previous one may have been
        // rejected, and this is a user action rather than a poll.
        this._refresh();
    },

    _onCadenceChanged: function () {
        // Reschedule against the new interval without spending a request.
        this._scheduleRefresh(this._secondsUntilNextRefresh());
        this._render();
    },

    // Changing the tour or draw re-filters what is already in hand. No request,
    // so a user trying each tour in turn cannot burn through a day's quota.
    _applyFilters: function () {
        this._matches = this._fetched.filter(
            (match) => matchesFilters(match, this.tour, this.draw)
        );
        this._displayIndex = 0;

        if (this._fetched.length > 0 && this._matches.length === 0) {
            this._statusLabel = _("No live tennis in this selection");
        } else if (this._fetched.length > 0) {
            this._statusLabel = null;
        }

        this._render();
    },

    // -- scheduling ---------------------------------------------------------

    _refreshSeconds: function () {
        return clampRefreshSeconds(this.refreshMinutes);
    },

    // Time left of the current interval, so changing the cadence cannot be
    // used - accidentally or otherwise - to trigger extra requests.
    _secondsUntilNextRefresh: function () {
        const interval = this._refreshSeconds();
        if (this._lastRefresh === null) {
            return interval;
        }

        const elapsed = (GLib.get_monotonic_time() - this._lastRefresh) / 1000000;
        return Math.max(1, Math.round(interval - elapsed));
    },

    _scheduleRefresh: function (seconds) {
        this._clearRefreshTimer();
        if (this._destroyed) {
            return;
        }

        this._nextRefresh = GLib.DateTime.new_now_local().add_seconds(seconds);
        this._refreshTimerId = Mainloop.timeout_add_seconds(seconds, () => {
            this._refreshTimerId = null;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    },

    _clearRefreshTimer: function () {
        if (this._refreshTimerId !== null) {
            Mainloop.source_remove(this._refreshTimerId);
            this._refreshTimerId = null;
        }
    },

    _startCycleTimer: function () {
        if (this._cycleTimerId !== null) {
            Mainloop.source_remove(this._cycleTimerId);
            this._cycleTimerId = null;
        }
        if (this._destroyed) {
            return;
        }

        // Local rotation of already-fetched matches. This timer never makes a
        // request, so it is free to run as often as the user likes.
        const seconds = Math.max(3, Number(this.cycleSeconds) || 8);
        this._cycleTimerId = Mainloop.timeout_add_seconds(seconds, () => {
            if (this._matches.length > 1) {
                this._displayIndex = (this._displayIndex + 1) % this._matches.length;
                this._renderPanel();
            }
            return GLib.SOURCE_CONTINUE;
        });
    },

    // -- fetching -----------------------------------------------------------

    _buildUrl: function () {
        // A fixed URL: no user-supplied text reaches it, and the tour/draw
        // choices are applied to the answer instead (see MATCH_PAGE_LIMIT).
        return "%s?status=live&limit=%d".format(API_MATCHES_URL, MATCH_PAGE_LIMIT);
    },

    _refresh: function () {
        this._clearRefreshTimer();
        if (this._destroyed) {
            return;
        }

        const key = typeof this.apiKey === "string" ? this.apiKey.trim() : "";
        if (key === "") {
            // No key: show what to do and make no request at all.
            this._fetched = [];
            this._matches = [];
            this._statusLabel = _("Tennis: set API key");
            this._render();
            this._scheduleRefresh(this._refreshSeconds());
            return;
        }

        if (this._lastRefresh === null) {
            // First read of the session: say so rather than sit blank while the
            // request is in flight.
            this.set_applet_label(_("Tennis: loading"));
        }

        const message = Soup.Message.new("GET", this._buildUrl());
        if (message === null) {
            this._onFailure("network", 0);
            return;
        }

        if (Soup.MAJOR_VERSION === 2) {
            message.request_headers.append(API_KEY_HEADER, key);
            this._httpSession.queue_message(message, (session, response) => {
                if (this._destroyed) {
                    return;
                }

                const status = response.status_code;
                const kind = classifyStatus(status);
                if (kind !== null) {
                    this._onFailure(kind, status);
                    return;
                }

                this._onBody(response.response_body.data);
            });
            return;
        }

        message.get_request_headers().append(API_KEY_HEADER, key);
        this._httpSession.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            this._cancellable,
            (session, result) => {
                if (this._destroyed) {
                    return;
                }

                let bytes;
                try {
                    bytes = session.send_and_read_finish(result);
                } catch (error) {
                    // Cancelled, DNS failure, TLS failure, no route. One label.
                    this._onFailure("network", 0);
                    return;
                }

                const status = message.get_status();
                const kind = classifyStatus(status);
                if (kind !== null) {
                    this._onFailure(kind, status);
                    return;
                }

                this._onBody(bytes === null ? null : ByteArray.toString(bytes.get_data()));
            }
        );
    },

    _onBody: function (body) {
        this._lastRefresh = GLib.get_monotonic_time();

        let payload;
        try {
            payload = JSON.parse(body);
        } catch (error) {
            this._onFailure("parse", 0);
            return;
        }

        this._fetched = extractMatches(payload).filter((match) => match && match.players);

        if (this._fetched.length === 0) {
            this._matches = [];
            this._displayIndex = 0;
            this._statusLabel = _("No live tennis");
            this._render();
        } else {
            // _applyFilters renders, and decides between "nothing in play" and
            // "nothing in play that matches your tour/draw choice".
            this._statusLabel = null;
            this._applyFilters();
        }

        this._scheduleRefresh(this._refreshSeconds());
    },

    _onFailure: function (kind, statusCode) {
        this._lastRefresh = GLib.get_monotonic_time();
        this._fetched = [];
        this._matches = [];
        this._statusLabel = describeFailure(kind, statusCode);

        // One line, no stack trace, no URL, and no key. The panel label already
        // told the user; the log line exists so a bug report can name the kind.
        global.logWarning("%s: live match read failed (%s)".format(UUID, kind));

        this._render();

        // A rate-limited key must not be retried on the normal cadence: the
        // budget is already spent, so wait out a full backoff window.
        const delay = kind === "rate_limited"
            ? Math.max(RATE_LIMIT_BACKOFF_SECONDS, this._refreshSeconds())
            : this._refreshSeconds();
        this._scheduleRefresh(delay);
    },

    // -- rendering ----------------------------------------------------------

    _render: function () {
        this._renderPanel();
        this._renderMenu();
    },

    _renderPanel: function () {
        if (this._matches.length === 0) {
            this.set_applet_label(this._statusLabel || _("No live tennis"));
            this.set_applet_tooltip(this._tooltipText());
            return;
        }

        if (this._displayIndex >= this._matches.length) {
            this._displayIndex = 0;
        }

        this.set_applet_label(formatMatchLine(this._matches[this._displayIndex]));
        this.set_applet_tooltip(this._tooltipText());
    },

    _tooltipText: function () {
        const lines = [];

        if (this._matches.length > 0) {
            const match = this._matches[this._displayIndex];
            const context = formatMatchContext(match);
            if (context !== "") {
                lines.push(context);
            }
            if (isBreakPoint(match.score)) {
                lines.push(_("Break point"));
            }
            lines.push(_n("%d match in play. Click for the full list.",
                          "%d matches in play. Click for the full list.",
                          this._matches.length).format(this._matches.length));
        } else if (this._statusLabel !== null) {
            lines.push(this._statusLabel);
        }

        const next = this._nextRefreshText();
        if (next !== null) {
            lines.push(next);
        }

        return lines.join("\n");
    },

    _nextRefreshText: function () {
        if (this._nextRefresh === null) {
            return null;
        }

        return _("Next update at %s.").format(this._nextRefresh.format("%H:%M"));
    },

    _renderMenu: function () {
        this.menu.removeAll();

        if (this._matches.length === 0) {
            const key = typeof this.apiKey === "string" ? this.apiKey.trim() : "";
            const text = key === ""
                ? _("Enter your Live Tennis API key in this applet's settings.")
                : (this._statusLabel || _("No live tennis"));
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(text, { reactive: false }));
            this._addFooter();
            return;
        }

        const limit = Math.max(1, Number(this.menuLimit) || 12);
        const shown = this._matches.slice(0, limit);

        for (const match of shown) {
            this.menu.addMenuItem(this._buildMatchItem(match));
        }

        if (this._matches.length > shown.length) {
            const hidden = this._matches.length - shown.length;
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
                _n("%d more match in play.", "%d more matches in play.", hidden).format(hidden),
                { reactive: false }
            ));
        }

        this._addFooter();
    },

    _buildMatchItem: function (match) {
        const item = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const box = new St.BoxLayout({ vertical: true, style_class: "livetennis-match" });

        box.add_child(new St.Label({
            text: formatMatchLine(match),
            style_class: isBreakPoint(match.score)
                ? "livetennis-score livetennis-break-point"
                : "livetennis-score"
        }));

        const context = formatMatchContext(match);
        if (context !== "") {
            box.add_child(new St.Label({
                text: context,
                style_class: "livetennis-context"
            }));
        }

        item.addActor(box, { expand: true, span: -1, align: St.Align.START });
        return item;
    },

    _addFooter: function () {
        const next = this._nextRefreshText();
        if (next === null) {
            return;
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(next, { reactive: false }));
    },

    // -- lifecycle ----------------------------------------------------------

    on_applet_clicked: function () {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function () {
        this._destroyed = true;

        this._clearRefreshTimer();
        if (this._cycleTimerId !== null) {
            Mainloop.source_remove(this._cycleTimerId);
            this._cycleTimerId = null;
        }

        this._cancellable.cancel();
        if (Soup.MAJOR_VERSION === 2) {
            this._httpSession.abort();
        }

        this.settings.finalize();
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new LiveTennisApplet(metadata, orientation, panelHeight, instanceId);
}
