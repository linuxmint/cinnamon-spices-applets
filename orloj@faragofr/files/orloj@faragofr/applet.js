const Applet     = imports.ui.applet;
const PopupMenu  = imports.ui.popupMenu;
const Settings   = imports.ui.settings;
const Tooltips   = imports.ui.tooltips;
const Mainloop   = imports.mainloop;
const St         = imports.gi.St;
const GLib       = imports.gi.GLib;
const Clutter    = imports.gi.Clutter;
let Astronomy, Dial, Theme;

const DIAL_SIZE = 320;

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

        this._dialItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this._drawingArea = new St.DrawingArea({
            width:  DIAL_SIZE,
            height: DIAL_SIZE,
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
        this._settings.bind("accent-color",    "accentColor",    () => this._refresh());
        this._settings.bind("foreground-color","foregroundColor",() => this._applyColors());
        this._settings.bind("background-color","backgroundColor",() => this._applyColors());
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
    }

    _applyColors() {
        Theme.setBaseColors(
            Theme.parseColor(this.backgroundColor, Theme.BACKGROUND),
            Theme.parseColor(this.foregroundColor, Theme.FOREGROUND));
        this._drawingArea.queue_repaint();
    }

    _applySize() {
        const size = Math.max(160, parseInt(this.dialSize) || DIAL_SIZE);
        this._drawingArea.width = size;
        this._drawingArea.height = size;
        this._drawingArea.queue_repaint();
    }

    _scheduleRefresh() {
        if (this._timer) {
            Mainloop.source_remove(this._timer);
            this._timer = null;
        }
        const interval = Math.max(1, parseInt(this.refreshSeconds) || 30);
        this._timer = Mainloop.timeout_add_seconds(interval, () => {
            this._refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _refresh() {
        const now = new Date();

        const lat = parseFloat(this.latitude);
        const lon = parseFloat(this.longitude);
        if (!isFinite(lat) || !isFinite(lon)) {
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
        const sunEv  = this._cachedSunEvent.event;
        const moonEv = this._cachedMoonEvent.event;
        const fmtEv  = (ev) => {
            if (!ev) return ">1d";
            const arrow = ev.type === "rise" ? "↑" : "↓";
            const days = Math.floor((ev.time - now) / 86400000);
            if (days >= 7) return `${arrow}>1w`;
            const hh = String(ev.time.getHours()).padStart(2, "0");
            const mm = String(ev.time.getMinutes()).padStart(2, "0");
            const suffix = days >= 1 ? `+${days}d` : "";
            return `${arrow}${hh}:${mm}${suffix}`;
        };
        this.set_applet_label(`☀${fmtEv(sunEv)} ☾${fmtEv(moonEv)}`);

        const jd      = Astronomy.julianDay(now);
        const sunLon  = Astronomy.sunLongitude(jd);
        const moonLon = Astronomy.moonLongitude(jd);
        const moonLat = Astronomy.moonLatitude(jd);
        const moonPh  = Astronomy.moonPhase(jd);
        const planets = Astronomy.planetLongitudes(jd);
        const lstDeg  = Astronomy.lmst(jd, lon);

        const sunRA  = Astronomy.eclipticToEquatorial(sunLon, 0, jd).ra;
        const moonRA = Astronomy.eclipticToEquatorial(moonLon, moonLat, jd).ra;
        const planetRAs = {};
        for (const name of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"])
            planetRAs[name] = Astronomy.eclipticToEquatorial(planets[name], 0, jd).ra;

        const civilHour = now.getHours() + now.getMinutes() / 60
                        + now.getSeconds() / 3600;

        const ss = Astronomy.sunriseSunset(now, lat, lon);
        // Clock hour → dial degrees: noon = 0°, 15°/hr clockwise.
        const dialFromCivil = (date) => {
            if (!date) return null;
            const h = date.getHours() + date.getMinutes() / 60;
            return (h - 12) * 15;
        };

        const altitudes = {
            Sun:     Astronomy.apparentAltitude(jd, sunLon,           0, lat, lon),
            Moon:    Astronomy.apparentAltitude(jd, moonLon,    moonLat, lat, lon),
            Mercury: Astronomy.apparentAltitude(jd, planets.Mercury, 0, lat, lon),
            Venus:   Astronomy.apparentAltitude(jd, planets.Venus,   0, lat, lon),
            Mars:    Astronomy.apparentAltitude(jd, planets.Mars,    0, lat, lon),
            Jupiter: Astronomy.apparentAltitude(jd, planets.Jupiter, 0, lat, lon),
            Saturn:  Astronomy.apparentAltitude(jd, planets.Saturn,  0, lat, lon)
        };

        this._state = {
            now:               now,
            sunLon:            sunLon,
            moonLon:           moonLon,
            moonPhaseAngle:    moonPh,
            planets:           planets,
            sunRA:             sunRA,
            moonRA:            moonRA,
            planetRAs:         planetRAs,
            zodiacBoundaryRAs: this._zodiacBoundaryRAs,
            zodiacMidRAs:      this._zodiacMidRAs,
            timeHandAngle:     (civilHour - 12) * 15, // civil time
            sunriseDialAngle:  dialFromCivil(ss && ss.rise),
            sunsetDialAngle:   dialFromCivil(ss && ss.set),
            lstDeg:            lstDeg,
            accent:            Theme.parseColor(this.accentColor, Theme.ACCENT_DEFAULT),
            altitudes:         altitudes
        };

        this._drawingArea.queue_repaint();
    }

    _onMotion(actor, event) {
        if (!this._state) return false;
        const [sx, sy] = event.get_coords();
        const [ax, ay] = actor.get_transformed_position();
        const [w, h] = actor.get_surface_size();
        const label = Dial.hitTest(w, h, this._state, sx - ax, sy - ay);
        if (label === this._lastHoverLabel) return false;
        this._lastHoverLabel = label;
        if (label) {
            this._tooltip.set_text(label);
            this._tooltip.preventShow = false;
            this._tooltip.show();
        } else {
            this._tooltip.preventShow = true;
            this._tooltip.hide();
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
                cr.setSourceRGBA(Theme.BACKGROUND[0], Theme.BACKGROUND[1],
                                 Theme.BACKGROUND[2], Theme.BACKGROUND[3]);
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
        if (this._settings) this._settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    imports.searchPath.unshift(metadata.path + "/lib");
    Astronomy = imports.astronomy;
    Dial      = imports.dial;
    Theme     = imports.theme;
    return new OrlojApplet(metadata, orientation, panelHeight, instanceId);
}
