const Applet     = imports.ui.applet;
const PopupMenu  = imports.ui.popupMenu;
const Settings   = imports.ui.settings;
const Tooltips   = imports.ui.tooltips;
const Mainloop   = imports.mainloop;
const St         = imports.gi.St;
const GLib       = imports.gi.GLib;
const Gio        = imports.gi.Gio;
const Clutter    = imports.gi.Clutter;
let Astronomy, Dial, Theme;

const DIAL_SIZE = 320;
const GEOIP_URL = "http://ip-api.com/json/?fields=status,message,city,lat,lon";
const GEOIP_REFRESH_MS = 60 * 60 * 1000; // re-check hourly (laptops move)

class OrlojApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._uuid = metadata.uuid;
        this._instanceId = instanceId;
        this.set_applet_label("--:--");
        this.set_applet_tooltip("Orloj");

        // Per-body label columns: keeping each body in its own left-aligned
        // label keeps the ☀/☾ glyphs vertically aligned in two-line mode
        // even when entry widths differ (e.g. a "+1d" suffix on one line).
        // TextApplet wraps its built-in label in this._layoutBin — that Bin,
        // not the label, is the child of this.actor, so insert relative to
        // it. The built-in label is kept for startup and fallback text.
        this._bodyBox = new St.BoxLayout({
            style: "spacing: 6px;",
            y_align: Clutter.ActorAlign.CENTER
        });
        this._sunLabel  = new St.Label({ style_class: "applet-label" });
        this._moonLabel = new St.Label({ style_class: "applet-label" });
        this._bodyBox.add_actor(this._sunLabel);
        this._bodyBox.add_actor(this._moonLabel);
        this.actor.insert_child_below(this._bodyBox, this._layoutBin);

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
        this._cachedSunEvents = null;
        this._cachedMoonEvents = null;
        this._httpSession = null;
        this._geoipCoords = null;
        this._geoipFetchedAt = 0;
        this._geoipInFlight = false;

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
        this._settings.bind("use-geoip",       "useGeoip",       () => this._onGeoipToggled());
        this._settings.bind("latitude",        "latitude",       () => this._invalidateEvents());
        this._settings.bind("longitude",       "longitude",      () => this._invalidateEvents());
        this._settings.bind("use-lst",         "useLst",         () => this._onLstToggled());
        this._settings.bind("use-auto-timezone", "useAutoTz",    () => this._refresh());
        this._settings.bind("timezone",        "manualTz",       () => this._refresh());
        this._settings.bind("show-sunrise",    "showSunrise",    () => this._refresh());
        this._settings.bind("show-both-sun",   "showBothSun",    () => this._refresh());
        this._settings.bind("show-moonrise",   "showMoonrise",   () => this._refresh());
        this._settings.bind("show-both-moon",  "showBothMoon",   () => this._refresh());
        this._settings.bind("refresh-seconds", "refreshSeconds", () => this._scheduleRefresh());
        this._settings.bind("accent-color",    "accentColor",    () => this._refresh());
        this._settings.bind("foreground-color","foregroundColor",() => this._applyColors());
        this._settings.bind("background-color","backgroundColor",() => this._applyColors());
        this._settings.bind("dial-size",       "dialSize",       () => this._applySize());

        this._applyColors();
        this._applySize();
        this._refresh();
        this._scheduleRefresh();
        this._populateTimezones();
    }

    // Fill the time zone combobox from the system tz database. The schema
    // ships with only UTC: listing all ~600 zone names there would drag
    // every one of them into the translation template, and the system list
    // stays current with tzdata updates. Same pattern as hwmonitor@sylfurd
    // and qredshift@quintao. Async read, per spices guidance. zone1970.tab
    // is the current name of the table; zone.tab is the pre-2017 one kept
    // as a fallback for older tzdata installations.
    _populateTimezones(pathIndex) {
        const paths = ["/usr/share/zoneinfo/zone1970.tab",
                       "/usr/share/zoneinfo/zone.tab"];
        const idx = pathIndex || 0;
        if (idx >= paths.length) {
            global.logWarning(
                "Orloj: could not read the time zone database, "
                + "the time zone list stays minimal");
            return;
        }
        const file = Gio.File.new_for_path(paths[idx]);
        file.load_contents_async(null, (f, res) => {
            try {
                const [ok, bytes] = f.load_contents_finish(res);
                if (!ok) throw new Error("read failed");
                const zones = [];
                const lines = imports.byteArray.toString(bytes).split("\n");
                for (const line of lines) {
                    if (!line || line[0] === "#") continue;
                    const cols = line.split("\t");
                    if (cols.length >= 3 && cols[2]) zones.push(cols[2]);
                }
                if (!zones.length) throw new Error("no zones parsed");
                zones.push("UTC");
                // Keep the configured zone selectable even if it is an
                // alias that the table doesn't list.
                if (this.manualTz) zones.push(this.manualTz);
                zones.sort();
                const options = {};
                for (const z of zones) options[z] = z;
                this._settings.setOptions("timezone", options);
            } catch (e) {
                this._populateTimezones(idx + 1);
            }
        });
    }

    _invalidateEvents() {
        this._cachedSunEvents = null;
        this._cachedMoonEvents = null;
        this._refresh();
    }

    _onLstToggled() {
        // LST mode always uses the system zone, so re-arm the automatic
        // time zone when it is switched on. This also keeps the settings
        // dialog consistent: the "Time zone" combobox is shown on
        // !use-auto-timezone alone (the schema dependency field cannot
        // express "!use-lst AND !use-auto-timezone"), so without this it
        // would linger, ineffective, after re-checking "Use LST".
        if (this.useLst && !this.useAutoTz)
            this._settings.setValue("use-auto-timezone", true);
        this._refresh();
    }

    _onGeoipToggled() {
        this._geoipFetchedAt = 0; // force an immediate re-fetch
        this._invalidateEvents();
    }

    // Lazily import libsoup 3 the first time GeoIP is used, so the applet
    // still loads on systems without the Soup 3 typelib (GeoIP then falls
    // back to the manual coordinates, with a logged warning).
    _soup() {
        if (this._soupChecked) return this._Soup;
        this._soupChecked = true;
        try {
            imports.gi.versions.Soup = "3.0";
            this._Soup = imports.gi.Soup;
        } catch (e) {
            this._Soup = null;
            global.logWarning(
                "Orloj: libsoup 3 unavailable, GeoIP falls back to manual coordinates: "
                + e.message);
        }
        return this._Soup;
    }

    _fetchGeoip() {
        if (this._geoipInFlight) return;
        const Soup = this._soup();
        if (!Soup) {
            this._geoipFetchedAt = Date.now(); // retry no sooner than the next interval
            return;
        }
        this._geoipInFlight = true;
        if (!this._httpSession)
            this._httpSession = new Soup.Session({
                user_agent: "orloj-cinnamon-applet",
                timeout: 10
            });
        const msg = Soup.Message.new("GET", GEOIP_URL);
        this._httpSession.send_and_read_async(
            msg, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                this._geoipInFlight = false;
                this._geoipFetchedAt = Date.now();
                try {
                    const bytes = session.send_and_read_finish(result);
                    if (msg.get_status() !== Soup.Status.OK)
                        throw new Error("HTTP " + msg.get_status());
                    const data = JSON.parse(
                        imports.byteArray.toString(bytes.get_data()));
                    if (data.status !== "success"
                        || !isFinite(data.lat) || !isFinite(data.lon))
                        throw new Error(data.message || "bad response");
                    const moved = !this._geoipCoords
                        || this._geoipCoords.lat !== data.lat
                        || this._geoipCoords.lon !== data.lon;
                    this._geoipCoords =
                        { lat: data.lat, lon: data.lon, city: data.city || "?" };
                    if (moved) this._invalidateEvents();
                } catch (e) {
                    global.logWarning(
                        "Orloj: GeoIP lookup failed, using manual coordinates: "
                        + e.message);
                }
            });
    }

    // The GLib.TimeZone all displayed times are rendered in: the system zone,
    // or the manually configured one. While "Use Local Sidereal Time" is on
    // (the original behavior), the zone selection is overridden and the
    // system zone is used everywhere.
    _displayTimeZone() {
        if (!this.useLst && !this.useAutoTz && this.manualTz) {
            // new_identifier (GLib >= 2.68) returns null for unknown names;
            // the older constructor silently falls back to UTC.
            if (GLib.TimeZone.new_identifier) {
                const tz = GLib.TimeZone.new_identifier(this.manualTz);
                if (tz) return tz;
                global.logWarning(
                    `Orloj: unknown time zone "${this.manualTz}", using system zone`);
            } else {
                return GLib.TimeZone.new(this.manualTz);
            }
        }
        return GLib.TimeZone.new_local();
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

        let lat = parseFloat(this.latitude);
        let lon = parseFloat(this.longitude);
        let locNote = "";
        if (this.useGeoip) {
            if (!this._geoipInFlight
                && Date.now() - this._geoipFetchedAt > GEOIP_REFRESH_MS)
                this._fetchGeoip();
            if (this._geoipCoords) {
                lat = this._geoipCoords.lat;
                lon = this._geoipCoords.lon;
                locNote = ` — ${this._geoipCoords.city} (GeoIP)`;
            }
        }
        this.set_applet_tooltip("Orloj" + locNote);
        if (!isFinite(lat) || !isFinite(lon)) {
            this._sunLabel.hide();
            this._moonLabel.hide();
            this.set_applet_label("set lat/lon");
            this._state = null;
            this._drawingArea.queue_repaint();
            return;
        }

        // Cache rise/set until the earliest predicted event passes, then
        // re-scan.
        const cacheEvents = (cached, scan) => {
            if (cached && now < cached.retryAfter) return cached;
            const ev = scan();
            const times = [ev.rise, ev.set].filter((t) => t);
            const retryAfter = times.length
                ? new Date(Math.min.apply(null, times))
                : new Date(+now + 86400000);
            return { events: ev, retryAfter: retryAfter };
        };
        this._cachedSunEvents  = cacheEvents(this._cachedSunEvents,
            () => Astronomy.nextSunEvents(now, lat, lon));
        this._cachedMoonEvents = cacheEvents(this._cachedMoonEvents,
            () => Astronomy.nextMoonEvents(now, lat, lon));
        const sunEv  = this._cachedSunEvents.events;
        const moonEv = this._cachedMoonEvents.events;

        // All displayed times are rendered in this zone (system or manual).
        const tz = this._displayTimeZone();
        const toTz = (date) => GLib.DateTime.new_from_unix_utc(
            Math.floor(date.getTime() / 1000)).to_timezone(tz);

        const fmtTime = (time) => {
            if (!time) return "--";
            const days = Math.floor((time - now) / 86400000);
            if (days >= 7) return ">1w";
            const dt = toTz(time);
            const hh = String(dt.get_hour()).padStart(2, "0");
            const mm = String(dt.get_minute()).padStart(2, "0");
            const suffix = days >= 1 ? `+${days}d` : "";
            return `${hh}:${mm}${suffix}`;
        };
        // Per body: by default a single entry with the next event (rise or
        // set, whichever comes soonest — the original behavior); with
        // "Always show both" on, the body's rise and set are stacked in two
        // lines, rise on top, set below. Each body renders in its own
        // column label so the glyphs stay vertically aligned. The built-in
        // applet label only carries a small glyph pair when everything is
        // hidden, keeping the applet clickable.
        const nextOf = (ev) => {
            if (ev.rise && (!ev.set || ev.rise < ev.set))
                return { arrow: "↑", time: ev.rise };
            if (ev.set) return { arrow: "↓", time: ev.set };
            return null;
        };
        const bodyText = (glyph, show, both, ev) => {
            if (!show) return "";
            if (both)
                return `${glyph}↑${fmtTime(ev.rise)}\n${glyph}↓${fmtTime(ev.set)}`;
            const nx = nextOf(ev);
            return nx ? `${glyph}${nx.arrow}${fmtTime(nx.time)}` : `${glyph}>1d`;
        };
        const sunText  = bodyText("☀", this.showSunrise,  this.showBothSun,  sunEv);
        const moonText = bodyText("☾", this.showMoonrise, this.showBothMoon, moonEv);
        this._sunLabel.set_text(sunText);
        this._sunLabel.visible = !!sunText;
        this._moonLabel.set_text(moonText);
        this._moonLabel.visible = !!moonText;
        this.set_applet_label(sunText || moonText ? "" : "☀☾");

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

        const nowTz = toTz(now);
        const civilHour = nowTz.get_hour() + nowTz.get_minute() / 60
                        + nowTz.get_second() / 3600;

        const ss = Astronomy.sunriseSunset(now, lat, lon);
        // Clock hour → dial degrees: noon = 0°, 15°/hr clockwise.
        const dialFromCivil = (date) => {
            if (!date) return null;
            const dt = toTz(date);
            const h = dt.get_hour() + dt.get_minute() / 60;
            return (h - 12) * 15;
        };

        // Dial center readout: local sidereal time by default (the original
        // behavior), or civil time in the display zone when "Use Local
        // Sidereal Time" is off.
        let centerText, centerSub;
        if (this.useLst) {
            const lstHours = lstDeg / 15;
            const lh = Math.floor(lstHours);
            const lm = Math.floor((lstHours - lh) * 60);
            centerText = String(lh).padStart(2, "0") + ":"
                       + String(lm).padStart(2, "0");
            centerSub = "LST";
        } else {
            centerText = nowTz.format("%H:%M");
            centerSub = nowTz.get_timezone_abbreviation();
        }

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
            civilText:         nowTz.format("%H:%M"),
            tzAbbrev:          nowTz.get_timezone_abbreviation(),
            centerText:        centerText,
            centerSub:         centerSub,
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
        // Use the logical allocation, not get_surface_size(): the surface is
        // sized in device pixels (× the HiDPI resource scale), whereas the
        // pointer coords above are logical. hitTest must see the same space.
        const [w, h] = actor.get_size();
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
        if (this._httpSession) {
            this._httpSession.abort();
            this._httpSession = null;
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
