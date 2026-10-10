const Applet     = imports.ui.applet;
const PopupMenu  = imports.ui.popupMenu;
const Settings   = imports.ui.settings;
const Tooltips   = imports.ui.tooltips;
const Mainloop   = imports.mainloop;
const St         = imports.gi.St;
const GLib       = imports.gi.GLib;
const Clutter    = imports.gi.Clutter;
let Astronomy, Dial, Theme;

// Floor for the dial size, matching settings-schema.json's minimum; it only
// bites on a hand-edited config.
const MIN_DIAL_SIZE = 240;

// Decimal degrees from a settings entry, or NaN. parseFloat alone would read
// "50,0875" as 50 and "14.42 W" as +14.42: a silently wrong position, which
// is worse than none. So the whole string must be a number, a decimal comma
// is accepted for locales that write one, and the value must lie within
// ±limit.
function parseDegrees(text, limit) {
    const str = String(text).trim().replace(",", ".");
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(str)) return NaN;
    const value = parseFloat(str);
    return Math.abs(value) <= limit ? value : NaN;
}

class OrlojApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._uuid = metadata.uuid;
        this._instanceId = instanceId;
        this.set_applet_label("--:--");
        this.set_applet_tooltip("Orloj");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        // The dial is only computed while it can be seen: on opening, then at
        // every tick until it closes. Opening never shows a stale dial, however
        // long the refresh interval.
        this.menu.connect("open-state-changed", (menu, open) => {
            if (open) this._refresh();
        });

        this._dialItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this._drawingArea = new St.DrawingArea({
            width:  Dial.REFERENCE_SIZE,
            height: Dial.REFERENCE_SIZE,
            reactive: true,
            track_hover: true
        });
        this._drawingArea.connect("repaint", this._onRepaint.bind(this));
        this._drawingArea.connect("motion-event", this._onMotion.bind(this));
        this._drawingArea.connect("leave-event", this._onLeave.bind(this));
        this._dialItem.addActor(this._drawingArea, { expand: true });
        this.menu.addMenuItem(this._dialItem);

        this._tooltip = new Tooltips.Tooltip(this._drawingArea, "");
        this._tooltip.preventShow = true;
        this._lastHoverLabel = null;

        this._state = null;
        this._timer = null;
        this._cachedSunEvent = null;
        this._cachedMoonEvent = null;

        // Zodiac boundary/midpoint RAs: fixed geometry (depends only on
        // obliquity, which drifts ~0.013°/century), computed once at startup.
        const jd0 = Astronomy.julianDay(new Date());
        this._zodiacBoundaryRAs = [];
        this._zodiacMidRAs = [];
        for (let i = 0; i < 12; i++) {
            this._zodiacBoundaryRAs.push(
                Astronomy.eclipticToEquatorial(i * 30, 0, jd0).ra);
            this._zodiacMidRAs.push(
                Astronomy.eclipticToEquatorial(i * 30 + 15, 0, jd0).ra);
        }

        this._settings = new Settings.AppletSettings(this, this._uuid, instanceId);
        this._settings.bind("latitude",        "latitude",       () => this._invalidateEvents());
        this._settings.bind("longitude",       "longitude",      () => this._invalidateEvents());
        this._settings.bind("refresh-seconds", "refreshSeconds", () => this._scheduleRefresh());
        this._settings.bind("accent-color",    "accentColor",    () => this._applyColors());
        this._settings.bind("foreground-color","foregroundColor",() => this._applyColors());
        this._settings.bind("background-color","backgroundColor",() => this._applyColors());
        this._settings.bind("day-color",       "dayColor",       () => this._applyColors());
        this._settings.bind("dial-size",       "dialSize",       () => this._applySize());

        this._applyColors();
        this._applySize();
        this._refresh();
        this._scheduleRefresh();
    }

    _invalidateEvents() {
        this._cachedSunEvent = null;
        this._cachedMoonEvent = null;
        this._refresh();
        this._scheduleRefresh();
    }

    // Colors are a property of this instance, not of the Theme module: several
    // Orloj applets can share a panel, and they share one imported Theme. The
    // palette therefore travels in the state object rather than in module
    // globals, and changing a color needs no astronomy, only a repaint.
    _applyColors() {
        this._palette = Theme.makePalette(
            Theme.parseColor(this.backgroundColor, Theme.BACKGROUND_DEFAULT),
            Theme.parseColor(this.foregroundColor, Theme.FOREGROUND_DEFAULT),
            Theme.parseColor(this.dayColor, null));
        this._accent = Theme.parseColor(this.accentColor, Theme.ACCENT_DEFAULT);
        if (this._state) {
            this._state.palette = this._palette;
            this._state.accent  = this._accent;
        }
        this._drawingArea.queue_repaint();
    }

    _applySize() {
        const size = Math.max(MIN_DIAL_SIZE,
                              parseInt(this.dialSize) || Dial.REFERENCE_SIZE);
        this._drawingArea.width = size;
        this._drawingArea.height = size;
        this._drawingArea.queue_repaint();
    }

    // One-shot timer that re-arms itself. It fires at the refresh interval or
    // at the next rise/set, whichever comes first: with the interval at its
    // 600s maximum a periodic timer could otherwise sleep straight past an
    // event and leave the panel showing it ten minutes after it happened.
    _scheduleRefresh() {
        if (this._timer) {
            Mainloop.source_remove(this._timer);
            this._timer = null;
        }
        const interval = Math.max(1, parseInt(this.refreshSeconds) || 30);
        let delay = interval;
        for (const cached of [this._cachedSunEvent, this._cachedMoonEvent]) {
            if (!cached || !cached.event) continue;
            const untilEvent = Math.ceil((cached.event.time - Date.now()) / 1000);
            delay = Math.min(delay, Math.max(1, untilEvent));
        }
        this._timer = Mainloop.timeout_add_seconds(delay, () => {
            this._timer = null;
            this._refresh();
            this._scheduleRefresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _refresh() {
        const now = new Date();

        const lat = parseDegrees(this.latitude,  90);
        const lon = parseDegrees(this.longitude, 180);
        if (isNaN(lat) || isNaN(lon)) {
            this.set_applet_label("set lat/lon");
            this._state = null;
            this._drawingArea.queue_repaint();
            return;
        }

        // Cache rise/set until the predicted event passes, then re-scan.
        if (!this._cachedSunEvent || now >= this._cachedSunEvent.retryAfter) {
            const ev = Astronomy.nextSunEvent(now, lat, lon);
            const retryAfter = ev ? ev.time : new Date(+now + 86400000);
            this._cachedSunEvent = { event: ev, retryAfter: retryAfter };
        }
        if (!this._cachedMoonEvent || now >= this._cachedMoonEvent.retryAfter) {
            const ev = Astronomy.nextMoonEvent(now, lat, lon);
            const retryAfter = ev ? ev.time : new Date(+now + 86400000);
            this._cachedMoonEvent = { event: ev, retryAfter: retryAfter };
        }
        const fmtEv = (ev) => {
            // Null means the scan found no event in its window — 7 days for
            // the sun, 25 hours for the moon. That is polar day or night, or a
            // circumpolar moon: not "soon", and not a time we can name.
            if (!ev) return "—";
            const arrow = ev.type === "rise" ? "↑" : "↓";
            // Whole 24-hour periods away, deliberately not calendar days. The
            // label always names the *next* event, so a bare "00:22" can only
            // be the coming one and needs no date to disambiguate it. The
            // suffix exists to flag an event that is unusually far off — a
            // polar sunrise, a circumpolar moon — which is a question about
            // elapsed time, not about which date it lands on.
            const days = Math.floor((ev.time - now) / 86400000);
            if (days >= 7) return `${arrow}>1w`;
            const hh = String(ev.time.getHours()).padStart(2, "0");
            const mm = String(ev.time.getMinutes()).padStart(2, "0");
            const suffix = days >= 1 ? `+${days}d` : "";
            return `${arrow}${hh}:${mm}${suffix}`;
        };
        this.set_applet_label(
            `☀${fmtEv(this._cachedSunEvent.event)} ☾${fmtEv(this._cachedMoonEvent.event)}`);

        // A closed dial keeps its last state; it is rebuilt when it opens.
        if (!this.menu.isOpen) return;

        const jd      = Astronomy.julianDay(now);
        const sunLon  = Astronomy.sunLongitude(jd);
        const moonLon = Astronomy.moonLongitude(jd);
        const moonLat = Astronomy.moonLatitude(jd);
        const planetPos = Astronomy.planetPositions(jd);

        const sunEq  = Astronomy.eclipticToEquatorial(sunLon, 0, jd);
        const planets   = {};
        const planetRAs = {};
        const altitudes = {
            Sun:  Astronomy.apparentAltitude(jd, sunLon,  0,       lat, lon),
            Moon: Astronomy.moonTopocentricAltitude(
                      Astronomy.apparentAltitude(jd, moonLon, moonLat, lat, lon))
        };
        for (const name of Astronomy.PLANETS) {
            const pos = planetPos[name];
            planets[name]   = pos.lon;
            planetRAs[name] = Astronomy.eclipticToEquatorial(pos.lon, pos.lat, jd).ra;
            altitudes[name] = Astronomy.apparentAltitude(jd, pos.lon, pos.lat, lat, lon);
        }

        const civilHour = now.getHours() + now.getMinutes() / 60
                        + now.getSeconds() / 3600;

        this._state = {
            now:               now,
            latitude:          lat,        // the hour ring solves the day's
                                           // solar altitudes from this plus
                                           // sunDec
            palette:           this._palette,
            accent:            this._accent,
            sunLon:            sunLon,
            moonLon:           moonLon,
            moonPhaseAngle:    Astronomy.moonPhase(jd),
            planets:           planets,
            sunRA:             sunEq.ra,
            sunDec:            sunEq.dec,
            moonRA:            Astronomy.eclipticToEquatorial(moonLon, moonLat, jd).ra,
            planetRAs:         planetRAs,
            zodiacBoundaryRAs: this._zodiacBoundaryRAs,
            zodiacMidRAs:      this._zodiacMidRAs,
            timeHandAngle:     (civilHour - 12) * 15, // civil time
            lstDeg:            Astronomy.lmst(jd, lon),
            altitudes:         altitudes
        };

        this._drawingArea.queue_repaint();
    }

    _onMotion(actor, event) {
        if (!this._state) return Clutter.EVENT_PROPAGATE;
        const [sx, sy] = event.get_coords();
        const [ax, ay] = actor.get_transformed_position();
        // Use the logical allocation, not get_surface_size(): the surface is
        // sized in device pixels (× the HiDPI resource scale), whereas the
        // pointer coords above are logical. hitTest must see the same space.
        const [w, h] = actor.get_size();
        const label = Dial.hitTest(w, h, this._state, sx - ax, sy - ay);
        if (label !== this._lastHoverLabel) {
            this._lastHoverLabel = label;
            if (label) {
                this._tooltip.set_text(label);
                this._tooltip.preventShow = false;
                this._tooltip.show();
            } else {
                this._tooltip.preventShow = true;
                this._tooltip.hide();
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onLeave() {
        this._lastHoverLabel = null;
        this._tooltip.preventShow = true;
        this._tooltip.hide();
        return Clutter.EVENT_PROPAGATE;
    }

    _onRepaint(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        try {
            if (this._state) {
                Dial.draw(cr, w, h, this._state);
            } else {
                const bg = this._palette.BACKGROUND;
                cr.setSourceRGBA(bg[0], bg[1], bg[2], bg[3]);
                cr.rectangle(0, 0, w, h);
                cr.fill();
            }
        } finally {
            cr.$dispose();
        }
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this._timer) {
            Mainloop.source_remove(this._timer);
            this._timer = null;
        }
        if (this._tooltip) this._tooltip.destroy();
        // AppletPopupMenu parents itself to Main.uiGroup, and nothing in
        // Cinnamon's applet teardown removes it from there.
        this.menu.destroy();
        if (this._settings) this._settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    // main() runs once per panel instance, but the search path is global and
    // the modules it resolves are shared, so add the entry only once.
    const libPath = metadata.path + "/lib";
    if (imports.searchPath.indexOf(libPath) === -1)
        imports.searchPath.unshift(libPath);
    Astronomy = imports.astronomy;
    Dial      = imports.dial;
    Theme     = imports.theme;
    return new OrlojApplet(metadata, orientation, panelHeight, instanceId);
}
