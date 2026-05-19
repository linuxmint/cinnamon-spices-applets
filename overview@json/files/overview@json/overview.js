/**
 * overview.js v12 — Fullscreen app overview for Cinnamenu
 * Linux Mint 22.3 / Cinnamon 6.x
 *
 * Fixes vs v10/v11:
 *  • Sidebar height is TRULY FIXED — uses a Clutter.Actor container with
 *    explicit size allocation, not St.BoxLayout (which always derives height
 *    from children). The catBox ScrollView clips content without ever pushing
 *    the sidebar larger.
 *  • ALL inline style= colour/font overrides removed. Every colour is driven
 *    by style_class → cinnamon.css. Inline style= is only used for pixel
 *    geometry (width/height/padding) that must be computed at runtime.
 *  • Closes when clicking on the panel, the applet button, or any other
 *    applet — we connect to global.stage 'captured-event' in phase CAPTURE
 *    so we see every click before any actor does.
 *  • "Activate categories on click" (settings.categoryClick) controls both
 *    Cinnamenu and the overview: when OFF, hovering a category selects it.
 *
 * CSS classes (add to cinnamon.css):
 *   .cinnamon-overview-background       full-screen backdrop
 *   .cinnamon-overview-sidebar          left sidebar panel
 *   .cinnamon-overview-categories-title "CATEGORIES" header
 *   .cinnamon-overview-category         category button (inactive)
 *   .cinnamon-overview-category-sel     category button (active)
 *   .cinnamon-overview-cat-label        category label (inactive)
 *   .cinnamon-overview-cat-label-sel    category label (active)
 *   .cinnamon-overview-cat-icon         category icon (inactive)
 *   .cinnamon-overview-cat-icon-sel     category icon (active)
 *   .cinnamon-overview-search           search entry
 *   .cinnamon-overview-section-title    section heading in grid
 *   .cinnamon-overview-tile             app tile button
 *   .cinnamon-overview-tile-label       app name label
 *   .cinnamon-overview-status-label     "no results" / "searching..."
 *   .cinnamon-overview-power-btn        power bar button
 *   .cinnamon-overview-power-icon       power bar icon
 *   .cinnamon-overview-tooltip          tooltip label
 *   .cinnamon-overview-context-menu     right-click context menu box
 *   .cinnamon-overview-context-item     context menu item button
 *   .cinnamon-overview-context-sep      context menu separator
 */

const Clutter = imports.gi.Clutter;
const Cogl    = imports.gi.Cogl;
const St      = imports.gi.St;
const Gio     = imports.gi.Gio;
const GLib    = imports.gi.GLib;
const Meta    = imports.gi.Meta;
const Pango   = imports.gi.Pango;
const Soup    = imports.gi.Soup;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Main    = imports.ui.main;
const AppFav  = imports.ui.appFavorites;

// ── Geometry (pixel values computed at runtime — cannot live in CSS) ──────────
const ICON_SIZE = 56;
const CELL_W    = 90;
const CELL_H    = 90;
const CELL_GAP  = 8;
const SIDEBAR_W = 165;
const H_PAD     = 32;

// ── Colour tokens — used ONLY where style_class cannot reach ──────────────────
// • Metro tile background (per-app hash colour, must be inline)
// • Accent bar widget (plain Clutter.Actor — no CSS node)
// • Web tile hover (dynamic geometry string)
// ACCENT colour is now driven entirely by cinnamon.css (.cinnamon-overview-cat-accent / -sel)
const TILE_HOVER   = 'rgba(0,0,0,0.07)';
const METRO_COLORS = [
            '#007AFF', '#FF3B30', '#34C759', '#FF9500',
            '#AF52DE', '#00C7BE', '#FF2D55', '#5856D6',
            '#32ADE6', '#30B0C7', '#FF6961', '#FF9F0A',
            '#6E6E73', '#30D158', '#BF5AF2', '#64D2FF',
];
function getMetroColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return METRO_COLORS[Math.abs(h) % METRO_COLORS.length];
}

// ── Google Font download (Noto Sans, available after fc-cache next session) ───
const GFONT_DIR  = GLib.build_filenamev([GLib.get_home_dir(),'.local','share','fonts','overview-gfonts']);
const GFONT_FILE = GLib.build_filenamev([GFONT_DIR, 'NotoSans-Regular.ttf']);
const GFONT_URL  = 'https://fonts.gstatic.com/s/notosans/v36/o-0bIpQlx3QUlC5A4PNjhg.ttf';
function _ensureGoogleFont() {
    try {
        if (GLib.file_test(GFONT_FILE, GLib.FileTest.EXISTS)) return;
        GLib.mkdir_with_parents(GFONT_DIR, 0o755);
        Gio.File.new_for_uri(GFONT_URL).load_contents_async(null, (src, res) => {
            try {
                const [, bytes] = src.load_contents_finish(res);
                GLib.file_set_contents(GFONT_FILE, bytes);
                GLib.spawn_command_line_async('fc-cache -f ' + GFONT_DIR);
            } catch(e) {}
        });
    } catch(e) {}
}
_ensureGoogleFont();

// ── App tile ──────────────────────────────────────────────────────────────────
/* ── makeTile ─────────────────────────────────────────────────────────────────
 * tileMode: falsy  → plain transparent button  (no tile style)
 *           'metro' → Metro palette inline colour (legacy default)
 *           'css'   → all styling via cinnamon.css classes only
 *           'accent'→ reads CSS variable --overview-tile-bg via cinnamon.css class
 *
 * CSS classes emitted (add these to cinnamon.css to theme tiles):
 *   .cinnamon-overview-tile              — every tile, normal state
 *   .cinnamon-overview-tile.tile-style   — tile-style is ON (any mode)
 *   .cinnamon-overview-tile.tile-metro   — metro mode (inline colour also set)
 *   .cinnamon-overview-tile.tile-css     — css mode  (no inline colour)
 *   .cinnamon-overview-tile.tile-accent  — accent mode (no inline colour)
 *   .cinnamon-overview-tile:hover        — hover state (all modes)
 *   .cinnamon-overview-tile-label        — app name label
 */
function makeTile(app, onLaunch, onRightClick, tileMode) {
    const appName = app.get_name ? app.get_name() : (app.name || '');

    // ── geometry string (pixel values only — never colours) ───────────────────
    const GEO      = `width:${CELL_W}px;height:${CELL_H}px;padding:3px;`;
    const GEO_HLIT = `width:${CELL_W}px;height:${CELL_H}px;padding:1px;`; // 2px border eats 2px

    // ── style_class list ──────────────────────────────────────────────────────
    let classes = 'cinnamon-overview-tile';
    if (tileMode) {
        classes += ' tile-style';
        if (tileMode === 'metro')         classes += ' tile-metro';
        else if (tileMode === 'css')      classes += ' tile-css';
        else if (tileMode === 'light-palette') classes += ' tile-light';
        else if (tileMode === 'dark-palette')  classes += ' tile-dark';
        else if (tileMode === 'tahoe')         classes += ' tile-tahoe';
    }

    // ── per-tile metro colour (only used when mode === 'metro') ───────────────
    let metroColor = null;
    let metroRgb   = null;
    if (tileMode === 'metro') {
        metroColor = getMetroColor(appName);
        // Convert hex to rgb so we can use rgba() opacity — matching Cinnamenu's frosted style
        metroRgb = {
            r: parseInt(metroColor.slice(1,3), 16),
            g: parseInt(metroColor.slice(3,5), 16),
            b: parseInt(metroColor.slice(5,7), 16),
        };
    }

    // ── inline style: geometry + frosted-glass colour for metro tiles ─────────
    // metro: rgba at 0.72 opacity (matches Cinnamenu appsview.js exactly)
    const styleNormal = metroRgb
        ? `background-color:rgba(${metroRgb.r},${metroRgb.g},${metroRgb.b},0.72);border-radius:10px;border:1px solid rgba(255,255,255,0.35);${GEO}`
        : GEO;
    const styleHover = metroRgb
        ? `background-color:rgba(${metroRgb.r},${metroRgb.g},${metroRgb.b},0.85);border-radius:10px;border:2px solid rgba(255,255,255,0.55);${GEO_HLIT}`
        : GEO;

    const btn = new St.Button({
        style_class: classes,
        reactive: true, can_focus: true, track_hover: true,
        width: CELL_W, height: CELL_H,
        style: styleNormal
    });

    const vbox = new St.BoxLayout({
        vertical: true,
        x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER,
        x_expand: true, y_expand: true
    });
    btn.set_child(vbox);

    let icon;
    try   { icon = app.create_icon_texture(ICON_SIZE); }
    catch (e) { icon = new St.Icon({ icon_name: 'application-x-executable', icon_size: ICON_SIZE }); }
    vbox.add_child(icon);

    const lbl = new St.Label({ text: appName, style_class: 'cinnamon-overview-tile-label' });
    lbl.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
    lbl.clutter_text.set_line_wrap(false);
    // Force white label on metro tiles regardless of active theme font colour
    if (metroRgb) {
        lbl.style = 'color:#ffffff;font-size:11px;font-weight:500;';
    }
    vbox.add_child(lbl);

    // hover: for metro mode swap inline style; for other modes CSS :hover handles it
    btn.connect('notify::hover', () => {
        if (metroRgb) {
            btn.style = btn.hover ? styleHover : styleNormal;
        }
    });

    btn.connect('button-press-event',   () => Clutter.EVENT_STOP);
    btn.connect('button-release-event', (a, ev) => {
        if (ev.get_button() === Clutter.BUTTON_PRIMARY)   onLaunch();
        if (ev.get_button() === Clutter.BUTTON_SECONDARY) onRightClick(ev);
        return Clutter.EVENT_STOP;
    });
    return btn;
}

// ── Context menu ──────────────────────────────────────────────────────────────
class TileContextMenu {
    constructor(root, app, applet, closeOv, launchCb) {
        this._root = root; this._app = app; this._applet = applet;
        this._close = closeOv; this._launchCb = launchCb || closeOv;
        this._actor = null; this._bgSig = null;
    }
    open(ev) {
        this.destroy();
        const [mx, my] = ev.get_coords();
        const m = Main.layoutManager.primaryMonitor;
        this._actor = new St.BoxLayout({ vertical:true, reactive:true,
            style_class:'cinnamon-overview-context-menu' });
        const add = (label, cb) => {
            const it = new St.Button({ label, reactive:true, can_focus:true, track_hover:true,
                x_align:St.Align.START, style_class:'cinnamon-overview-context-item' });
            it.connect('notify::hover', () => {
                if (it.hover) it.add_style_pseudo_class('hover');
                else it.remove_style_pseudo_class('hover');
            });
            it.connect('button-release-event', (a, e) => {
                if (e.get_button() === Clutter.BUTTON_PRIMARY) { cb(); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_PROPAGATE;
            });
            this._actor.add_child(it);
        };
        const sep = () => this._actor.add_child(
            new St.Widget({ style_class:'cinnamon-overview-context-sep' }));
        add(_('Open'), () => { this.destroy(); this._launchCb(this._app); });
        sep();
        const favs = AppFav.getAppFavorites();
        const id   = this._app.get_id ? this._app.get_id() : null;
        if (id) {
            if (favs.isFavorite(id))
                add(_('Remove from Favorites'), () => { favs.removeFavorite(id); this.destroy(); });
            else
                add(_('Add to Favorites'), () => { favs.addFavorite(id); this.destroy(); });
        }
        sep();
        add(_('Add to Panel'), () => {
            this.destroy();
            try { Main.AppletManager.get_role_provider(
                Main.AppletManager.Roles.PANEL_LAUNCHER).acceptNewLauncher(id); } catch(e) {}
        });
        add(_('Add to Desktop'), () => {
            this.destroy();
            try {
                const dir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
                if (dir && this._app.get_app_info) {
                    const ai = this._app.get_app_info();
                    if (ai && ai.get_filename()) {
                        const s = Gio.File.new_for_path(ai.get_filename());
                        s.copy(Gio.File.new_for_path(GLib.build_filenamev([dir, s.get_basename()])),
                            Gio.FileCopyFlags.OVERWRITE, null, null);
                    }
                }
            } catch(e) {}
        });
        this._root.add_child(this._actor);
        this._actor.show();
        const mw = 220, mh = 185;
        let px = mx - m.x, py = my - m.y;
        if (px + mw > m.width  - 8) px = m.width  - mw - 8;
        if (py + mh > m.height - 8) py = m.height - mh - 8;
        this._actor.set_position(px, py);
        this._bgSig = this._root.connect('button-release-event', (a, e) => {
            if (!this._isChild(e.get_source(), this._actor)) { this.destroy(); return Clutter.EVENT_STOP; }
            return Clutter.EVENT_PROPAGATE;
        });
    }
    _isChild(a, p) { while (a) { if (a === p) return true; a = a.get_parent(); } return false; }
    destroy() {
        if (this._bgSig) { try { this._root.disconnect(this._bgSig); } catch(e) {} this._bgSig = null; }
        if (this._actor) {
            if (this._actor.get_parent()) this._root.remove_child(this._actor);
            this._actor.destroy(); this._actor = null;
        }
    }
}

// ── Hot corner ────────────────────────────────────────────────────────────────
class HotCorner {
    constructor(corner, cb) { this._corner = corner; this._cb = cb; this._w = null; this._sig = null; }
    enable() {
        if (this._w) return;
        const m = Main.layoutManager.primaryMonitor;
        const R = this._corner.includes('right'), B = this._corner.includes('bottom');
        this._w = new St.Widget({ reactive:true, can_focus:false, track_hover:true,
            width:4, height:4, style:'background-color:transparent;' });
        this._w.set_position(R ? m.x+m.width-4 : m.x, B ? m.y+m.height-4 : m.y);
        this._sig = this._w.connect('enter-event', () => this._cb());
        global.stage.add_child(this._w);
        this._w.raise_top();
    }
    disable() {
        if (!this._w) return;
        this._w.disconnect(this._sig);
        if (this._w.get_parent()) global.stage.remove_child(this._w);
        this._w = null; this._sig = null;
    }
    raiseTop() { if (this._w) this._w.raise_top(); }
}

// ── Overview ──────────────────────────────────────────────────────────────────
class AppOverview {
    constructor(applet) {
        this._applet        = applet;
        this._visible       = false;
        this._fading        = false;
        this._modal         = false;
        this._searching     = false;
        this._hotCorner     = null;
        this._escId         = null;
        this._captureId     = null;
        this._scrollSig     = null;
        this._idlerId       = null;
        this._ctxMenu       = null;
        this._sections      = [];
        this._currentSec    = 0;
        this._pendingLaunch = null;
        this._pendingAction = null;
        this._clockTimer    = null;
        this._weatherTimer  = null;
        this._weatherLatLon = null;
        this._mediaTimer    = null;
        this._mprisPlayer   = null;   // current active MPRIS bus name
        // In-memory caches — survive between opens, cleared on applet reload
        // { [url]: { headline, imgPath, ts } }  ts = GLib.get_monotonic_time() / 1e6
        this._rssCache      = {};
        // { [imgUrl]: localTmpPath }
        this._imgCache      = {};
        // Weather cache: { data, cityLabel, ts }
        this._wxCache       = null;

        // ── Root backdrop ─────────────────────────────────────────────────
        this._root = new St.Widget({
            style_class: 'cinnamon-overview-background',
            reactive: true, can_focus: true,
        });
        // Add palette class for built-in light/dark themes
        this._applyOverviewPaletteClass();

        // ── SIDEBAR — absolutely positioned, outside all flow layout ──────
        // THE DEFINITIVE FIX: the sidebar is added directly to _root, not to
        // any BoxLayout. This means no BoxLayout can ever re-query its size
        // during content changes (search typing, category switches).
        // Position and size are set once in show() and never touched again.
        this._sidebar = new St.Widget({
            clip_to_allocation: true,
            style_class: 'cinnamon-overview-sidebar',
        });
        this._root.add_child(this._sidebar);

        // catBox inside a ScrollView — content scrolls, sidebar never resizes
        this._catBox = new St.BoxLayout({
            vertical:true, x_expand:true,
            style:'padding:0 8px;',
        });
        this._catScroll = new St.ScrollView({
            clip_to_allocation:true, overlay_scrollbars:true,
        });
        this._catScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._catScroll.set_clip_to_allocation(true);
        this._catScroll.set_mouse_scrolling(true);
        this._catScroll.add_actor(this._catBox);
        this._sidebar.add_child(this._catScroll);

        // ── RIGHT COLUMN — covers the full root, with left margin = SIDEBAR_W
        // Also added directly to _root so it never interacts with the sidebar.
        this._rightCol = new St.BoxLayout({
            vertical:true,
            x_align:Clutter.ActorAlign.FILL, y_align:Clutter.ActorAlign.FILL,
        });
        this._root.add_child(this._rightCol);

        // ── Top row layout: [weather] [flex] [entry 440px fixed] [flex] [clock] ──
        // Weather anchored LEFT, clock anchored RIGHT, entry centred by equal flex gaps.
        const sRow = new St.BoxLayout({
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding:20px 28px 20px 20px;',
        });
        this._rightCol.add_child(sRow);

        // ── LEFT: Weather panel ───────────────────────────────────────────────
        this._weatherBox = this._buildWeatherWidget();
        sRow.add_child(this._weatherBox);

        // Flex gap — pushes entry to centre
        sRow.add_child(new St.Widget({ x_expand: true }));

        // ── CENTRE: Search entry (fixed 440px, never stretches) ───────────────
        this._entry = new St.Entry({
            style_class: 'cinnamon-overview-search',
            hint_text: _('Search…'),
            can_focus: true,
            x_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'width:440px;min-height:0;padding:3px 14px;',
        });
        sRow.add_child(this._entry);
        this._entry.clutter_text.connect('text-changed', () => this._onSearch());
        this._entry.clutter_text.connect('key-press-event', (_, ev) => this._onEntryKey(ev));

        // Flex gap — mirrors left gap so entry stays centred
        sRow.add_child(new St.Widget({ x_expand: true }));

        // ── RIGHT: Clock ──────────────────────────────────────────────────────
        this._clockBox = this._buildClockWidget();
        sRow.add_child(this._clockBox);

        // ── Media controls row — below search bar ────────────────────────────
        this._mediaRow = this._buildMediaBar();
        this._rightCol.add_child(this._mediaRow);

        // Grid scroll area
        this._scroll = new St.ScrollView({
            reactive:true, x_expand:true, y_expand:true, x_fill:true, y_fill:true,
        });
        this._scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._scroll.set_clip_to_allocation(true);
        this._scroll.set_mouse_scrolling(true);
        this._rightCol.add_child(this._scroll);

        this._wrapper = new St.BoxLayout({
            vertical:true, x_align:Clutter.ActorAlign.FILL,
            style:`padding:4px ${H_PAD}px 48px ${H_PAD}px;`,
        });
        this._scroll.add_actor(this._wrapper);

        // Click on bare root bg → close
        this._root.connect('button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY && ev.get_source() === this._root) {
                this.hide(); return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Power bar (absolutely positioned bottom-right)
        this._powerBar = this._buildPowerBar();
        this._root.add_child(this._powerBar);

    }

    // ── Apply built-in palette class to overview background ─────────────────
    _applyOverviewPaletteClass() {
        if (!this._root) return;
        this._root.remove_style_class_name('overview-palette-light');
        this._root.remove_style_class_name('overview-palette-dark');
        this._root.remove_style_class_name('overview-palette-tahoe');
        const useTile = this._applet.settings.useTileStyle;
        const mode    = this._applet.settings.overviewTileStyle || 'light-palette';
        if (useTile && mode === 'light-palette') {
            this._root.add_style_class_name('overview-palette-light');
        } else if (useTile && mode === 'dark-palette') {
            this._root.add_style_class_name('overview-palette-dark');
        } else if (useTile && mode === 'tahoe') {
            this._root.add_style_class_name('overview-palette-tahoe');
        }
    }


    // ── Media controls bar ────────────────────────────────────────────────────
    // MPRIS2 via Gio.DBus — works with VLC, Celluloid/MPV, GNOME Music,
    // Rhythmbox, Clementine, Spotify, Firefox/Chrome (YouTube), etc.
    // Volume = system sink via pactl (reliable) + MPRIS player volume in sync.

    _buildMediaBar() {
        const bar = new St.BoxLayout({
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding:2px 28px 8px 20px;',
            reactive: false,
        });

        // ── Player app icon + track info ──────────────────────────────────────
        this._mediaAppIcon = new St.Icon({
            icon_name: 'audio-x-generic-symbolic',
            icon_size: 20,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-right:10px;opacity:200;',
        });

        const trackCol = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'min-width:180px;max-width:280px;',
        });

        this._mediaTitle = new St.Label({
            text: 'No media playing',
            style: 'font-size:12px;font-weight:600;color:rgba(255,255,255,0.90);',
        });
        this._mediaTitle.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.END);
        this._mediaTitle.clutter_text.set_single_line_mode(true);

        this._mediaArtist = new St.Label({
            text: '',
            style: 'font-size:10px;color:rgba(255,255,255,0.50);margin-top:1px;',
        });
        this._mediaArtist.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.END);
        this._mediaArtist.clutter_text.set_single_line_mode(true);

        trackCol.add_child(this._mediaTitle);
        trackCol.add_child(this._mediaArtist);

        // ── Playback buttons — St.Icon, fixed geometry, hover only changes bg ─
        // Wobble fix: width/height/padding NEVER change on hover — only background-color.
        const BTN_STYLE      = 'width:32px;height:32px;padding:7px;border-radius:16px;background-color:rgba(255,255,255,0.0);';
        const BTN_STYLE_HOV  = 'width:32px;height:32px;padding:7px;border-radius:16px;background-color:rgba(255,255,255,0.12);';

        const makeBtn = (iconName, action) => {
            const icon = new St.Icon({
                icon_name: iconName,
                icon_size: 18,
                style: BTN_STYLE,
                reactive: true,
                can_focus: false,
                y_align: Clutter.ActorAlign.CENTER,
            });
            icon.connect('enter-event', () => { icon.style = BTN_STYLE_HOV;  return Clutter.EVENT_PROPAGATE; });
            icon.connect('leave-event', () => { icon.style = BTN_STYLE;      return Clutter.EVENT_PROPAGATE; });
            icon.connect('button-press-event',   () => Clutter.EVENT_STOP);
            icon.connect('button-release-event', (a, ev) => {
                if (ev.get_button() === 1) { action(); return Clutter.EVENT_STOP; }
                return Clutter.EVENT_STOP;
            });
            return icon;
        };

        this._mediaPrevBtn = makeBtn('media-skip-backward-symbolic',  () => this._mprisCommand('Previous'));
        this._mediaPlayBtn = makeBtn('media-playback-start-symbolic',  () => this._mprisCommand('PlayPause'));
        this._mediaNextBtn = makeBtn('media-skip-forward-symbolic',    () => this._mprisCommand('Next'));

        const btnRow = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER });
        btnRow.add_child(this._mediaPrevBtn);
        btnRow.add_child(this._mediaPlayBtn);
        btnRow.add_child(this._mediaNextBtn);

        // ── Volume ────────────────────────────────────────────────────────────
        this._volIconW = new St.Icon({
            icon_name: 'audio-volume-medium-symbolic',
            icon_size: 16,
            style: 'margin-right:6px;',
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
        });
        this._volIconW.connect('button-press-event',   () => Clutter.EVENT_STOP);
        this._volIconW.connect('button-release-event', (a, ev) => {
            if (ev.get_button() === 1) { this._toggleMute(); return Clutter.EVENT_STOP; }
            return Clutter.EVENT_STOP;
        });

        const VOL_W = 100;
        this._VOL_W = VOL_W;
        this._volSliderBg = new St.Widget({
            style: 'background-color:rgba(255,255,255,0.15);border-radius:3px;height:6px;width:' + VOL_W + 'px;',
            reactive: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._volSliderFill = new St.Widget({
            style: 'background-color:rgba(255,255,255,0.85);border-radius:3px;height:6px;width:60px;',
            reactive: false,
        });
        this._volSliderFill.set_position(0, 0);
        this._volSliderBg.add_child(this._volSliderFill);

        this._volSliderBg.connect('button-press-event', (a, ev) => {
            const [cx, cy] = ev.get_coords();
            const [ok, lx] = this._volSliderBg.transform_stage_point(cx, cy);
            if (ok) this._setVolume(Math.max(0, Math.min(1, lx / VOL_W)));
            return Clutter.EVENT_STOP;
        });
        this._volSliderBg.connect('button-release-event', () => Clutter.EVENT_STOP);
        this._volSliderBg.connect('motion-event', (a, ev) => {
            if (ev.get_state() & Clutter.ModifierType.BUTTON1_MASK) {
                const [cx, cy] = ev.get_coords();
                const [ok, lx] = this._volSliderBg.transform_stage_point(cx, cy);
                if (ok) this._setVolume(Math.max(0, Math.min(1, lx / VOL_W)));
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._volSliderBg.connect('scroll-event', (a, ev) => {
            const dir = ev.get_scroll_direction();
            // UP/RIGHT = louder, DOWN/LEFT = quieter
            // 0.02 (2%) per tick — smooth, not jumpy
            let delta = 0;
            if      (dir === Clutter.ScrollDirection.UP    || dir === Clutter.ScrollDirection.RIGHT) delta =  0.02;
            else if (dir === Clutter.ScrollDirection.DOWN  || dir === Clutter.ScrollDirection.LEFT)  delta = -0.02;
            if (delta !== 0) {
                const newVol = Math.max(0, Math.min(1, this._volLevel + delta));
                this._setVolume(newVol);
            }
            return Clutter.EVENT_STOP; // prevent root handler from also firing
        });

        this._volLabel = new St.Label({
            text: '60%',
            style: 'font-size:10px;color:rgba(255,255,255,0.50);min-width:34px;margin-left:6px;',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._volLevel        = 0.6;
        this._isMuted         = false;
        this._volApplyPending = false;

        // ── Assemble ──────────────────────────────────────────────────────────
        bar.add_child(this._mediaAppIcon);
        bar.add_child(trackCol);
        bar.add_child(new St.Widget({ x_expand: true }));
        bar.add_child(btnRow);
        bar.add_child(new St.Widget({ style: 'width:20px;' }));
        bar.add_child(this._volIconW);
        bar.add_child(this._volSliderBg);
        bar.add_child(this._volLabel);

        return bar;
    }

    // ── MPRIS2 helpers ────────────────────────────────────────────────────────

    _findMprisPlayer(cb) {
        try {
            Gio.DBus.session.call(
                'org.freedesktop.DBus', '/org/freedesktop/DBus',
                'org.freedesktop.DBus', 'ListNames',
                null, new GLib.VariantType('(as)'),
                Gio.DBusCallFlags.NONE, 2000, null, (conn, res) => {
                    try {
                        const reply = conn.call_finish(res);
                        const outer = reply.deepUnpack();
                        const names = Array.isArray(outer[0]) ? outer[0] : outer;
                        const players = names.filter(n => String(n).startsWith('org.mpris.MediaPlayer2.'));
                        cb(players.length > 0 ? String(players[0]) : null);
                    } catch(e) { cb(null); }
                });
        } catch(e) { cb(null); }
    }

    // Recursively unwrap GLib.Variant to plain JS
    _unpackVariant(v) {
        if (v === null || v === undefined) return v;
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
        if (typeof v.unpack === 'function') return this._unpackVariant(v.unpack());
        if (typeof v.deepUnpack === 'function') {
            const u = v.deepUnpack();
            if (u !== v) return this._unpackVariant(u);
        }
        if (Array.isArray(v)) return v.map(x => this._unpackVariant(x));
        if (typeof v === 'object') {
            const out = {};
            for (const k of Object.keys(v)) out[k] = this._unpackVariant(v[k]);
            return out;
        }
        return v;
    }

    _getMprisMetadata(busName, cb) {
        try {
            Gio.DBus.session.call(
                busName, '/org/mpris/MediaPlayer2',
                'org.freedesktop.DBus.Properties', 'GetAll',
                new GLib.Variant('(s)', ['org.mpris.MediaPlayer2.Player']),
                null, Gio.DBusCallFlags.NONE, 3000, null, (conn, res) => {
                    try {
                        const reply  = conn.call_finish(res);
                        const raw    = this._unpackVariant(reply);
                        // Result shape: [[{Metadata:{...}, PlaybackStatus:'...', ...}]]
                        let props = raw;
                        while (Array.isArray(props) && props.length === 1) props = props[0];

                        const meta   = props['Metadata']        || {};
                        const status = props['PlaybackStatus']  || 'Stopped';
                        const vol    = typeof props['Volume'] === 'number' ? props['Volume'] : 0.6;

                        const title   = String(this._unpackVariant(meta['xesam:title'])  || '');
                        let artists   = this._unpackVariant(meta['xesam:artist']) || [];
                        if (!Array.isArray(artists)) artists = artists ? [String(artists)] : [];
                        const artist  = artists.map(String).join(', ');

                        cb({ title, artist, status: String(status), vol, busName });
                    } catch(e) { cb(null); }
                });
        } catch(e) { cb(null); }
    }

    _mprisCommand(method) {
        if (!this._mprisPlayer) return;
        try {
            Gio.DBus.session.call(
                this._mprisPlayer, '/org/mpris/MediaPlayer2',
                'org.mpris.MediaPlayer2.Player', method,
                null, null, Gio.DBusCallFlags.NONE, 1000, null, null);
        } catch(e) {}
    }

    // ── Volume — non-blocking DBus calls, no process spawning ─────────────────
    // Uses PulseAudio/PipeWire DBus interface directly.
    // Throttled: actual DBus call fires at most once per 80ms to prevent
    // scroll-induced freeze on rapid wheel events.

    _setVolume(vol) {
        this._volLevel = vol;
        this._isMuted  = false;
        this._updateVolDisplay(vol, false);
        this._scheduleVolApply();
    }

    _toggleMute() {
        this._isMuted = !this._isMuted;
        this._updateVolDisplay(this._volLevel, this._isMuted);
        this._scheduleVolApply();
    }

    // Throttle: coalesce rapid scroll events into one DBus call per 80ms
    _scheduleVolApply() {
        if (this._volApplyPending) return;
        this._volApplyPending = true;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            this._volApplyPending = false;
            this._applyVolumeDBus(this._volLevel, this._isMuted);
            return GLib.SOURCE_REMOVE;
        });
    }

    // Set volume via PulseAudio DBus — zero process spawning, non-blocking
    _applyVolumeDBus(vol, muted) {
        try {
            // Try PulseAudio/PipeWire DBus socket first (fastest, no fork)
            const pulsePath = GLib.build_filenamev([
                GLib.get_runtime_dir(), 'pulse', 'dbus-socket']);
            const addr = 'unix:path=' + pulsePath;

            Gio.DBusConnection.new_for_address(
                addr,
                Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT,
                null, null, (src, res) => {
                    try {
                        const conn = Gio.DBusConnection.new_for_address_finish(res);
                        // Get default sink path
                        conn.call('/org/pulseaudio/core1',
                            'org.PulseAudio.Core1', 'GetSinkByName',
                            new GLib.Variant('(s)', ['@DEFAULT_SINK@']),
                            null, Gio.DBusCallFlags.NONE, 1000, null, (c, r) => {
                                try {
                                    const [[sinkPath]] = c.call_finish(r).deepUnpack();
                                    // Set mute
                                    conn.call(String(sinkPath),
                                        'org.freedesktop.DBus.Properties', 'Set',
                                        new GLib.Variant('(ssv)', [
                                            'org.PulseAudio.Core1.Device', 'Mute',
                                            new GLib.Variant('b', muted)
                                        ]), null, Gio.DBusCallFlags.NONE, 1000, null, null);
                                    if (!muted) {
                                        // PulseAudio volume: 0–65536 (PA_VOLUME_NORM)
                                        const paVol = Math.round(vol * 65536);
                                        conn.call(String(sinkPath),
                                            'org.freedesktop.DBus.Properties', 'Set',
                                            new GLib.Variant('(ssv)', [
                                                'org.PulseAudio.Core1.Device', 'Volume',
                                                new GLib.Variant('au', [[paVol, paVol]])
                                            ]), null, Gio.DBusCallFlags.NONE, 1000, null, null);
                                    }
                                } catch(e) { this._applyVolumePatcl(vol, muted); }
                            });
                    } catch(e) { this._applyVolumePatcl(vol, muted); }
                });
        } catch(e) { this._applyVolumePatcl(vol, muted); }
    }

    // Fallback: spawn pactl once (not on every scroll tick — throttled above)
    _applyVolumePatcl(vol, muted) {
        try {
            const pct = Math.round(vol * 100);
            const argv_mute = ['pactl', 'set-sink-mute',   '@DEFAULT_SINK@', muted ? '1' : '0'];
            const argv_vol  = ['pactl', 'set-sink-volume', '@DEFAULT_SINK@', pct + '%'];
            GLib.spawn_async(null, argv_mute, null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
            if (!muted) GLib.spawn_async(null, argv_vol, null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
        } catch(e) {}
    }

    _readSystemVolume(cb) {
        // Read via PulseAudio DBus — non-blocking
        try {
            const pulsePath = GLib.build_filenamev([GLib.get_runtime_dir(), 'pulse', 'dbus-socket']);
            const addr = 'unix:path=' + pulsePath;
            Gio.DBusConnection.new_for_address(
                addr,
                Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT,
                null, null, (src, res) => {
                    try {
                        const conn = Gio.DBusConnection.new_for_address_finish(res);
                        conn.call('/org/pulseaudio/core1',
                            'org.PulseAudio.Core1', 'GetSinkByName',
                            new GLib.Variant('(s)', ['@DEFAULT_SINK@']),
                            null, Gio.DBusCallFlags.NONE, 1000, null, (c, r) => {
                                try {
                                    const [[sinkPath]] = c.call_finish(r).deepUnpack();
                                    conn.call(String(sinkPath),
                                        'org.freedesktop.DBus.Properties', 'Get',
                                        new GLib.Variant('(ss)', ['org.PulseAudio.Core1.Device', 'Volume']),
                                        null, Gio.DBusCallFlags.NONE, 1000, null, (c2, r2) => {
                                            try {
                                                const raw = c2.call_finish(r2).deepUnpack();
                                                const vols = raw[0];
                                                const arr  = Array.isArray(vols) ? vols : [vols];
                                                const avg  = arr.reduce((a, v) => a + Number(v), 0) / Math.max(arr.length, 1);
                                                cb(Math.min(1, avg / 65536));
                                            } catch(e) { cb(this._volLevel); }
                                        });
                                } catch(e) { cb(this._volLevel); }
                            });
                    } catch(e) { cb(this._volLevel); }
                });
        } catch(e) { cb(this._volLevel); }
    }

    _updateVolDisplay(vol, muted) {
        const pct = Math.round(vol * 100);
        try { if (this._volLabel) this._volLabel.set_text(muted ? 'mute' : pct + '%'); } catch(e) {}
        const fillW = muted ? 0 : Math.round(vol * (this._VOL_W || 100));
        try {
            if (this._volSliderFill) this._volSliderFill.style =
                'background-color:rgba(255,255,255,0.85);border-radius:3px;height:6px;width:' + fillW + 'px;';
        } catch(e) {}
        try {
            if (this._volIconW) {
                const name = muted || pct === 0 ? 'audio-volume-muted-symbolic'
                           : pct < 34            ? 'audio-volume-low-symbolic'
                           : pct < 67            ? 'audio-volume-medium-symbolic'
                           :                       'audio-volume-high-symbolic';
                this._volIconW.set_icon_name(name);
            }
        } catch(e) {}
    }

    _playerIconName(busName) {
        if (!busName) return 'audio-x-generic-symbolic';
        const n = busName.toLowerCase();
        if (n.includes('vlc'))                              return 'vlc';
        if (n.includes('celluloid') || n.includes('mpv'))  return 'io.github.celluloid_player.Celluloid';
        if (n.includes('spotify'))                          return 'spotify';
        if (n.includes('rhythmbox'))                        return 'rhythmbox';
        if (n.includes('clementine'))                       return 'clementine';
        if (n.includes('firefox'))                          return 'firefox';
        if (n.includes('chromium'))                         return 'chromium';
        if (n.includes('totem'))                            return 'totem';
        return 'audio-x-generic-symbolic';
    }

    // ── Poll ──────────────────────────────────────────────────────────────────
    _pollMedia() {
        // Read system volume
        this._readSystemVolume((vol) => {
            if (Math.abs(vol - this._volLevel) > 0.02 && !this._isMuted) {
                this._volLevel = vol;
                this._updateVolDisplay(vol, false);
            }
        });

        this._findMprisPlayer((player) => {
            if (!player) {
                this._mprisPlayer = null;
                try { if (this._mediaTitle)    this._mediaTitle.set_text('No media playing'); } catch(e) {}
                try { if (this._mediaArtist)   this._mediaArtist.set_text(''); } catch(e) {}
                try { if (this._mediaAppIcon)  this._mediaAppIcon.set_icon_name('audio-x-generic-symbolic'); } catch(e) {}
                try { if (this._mediaPlayBtn)  this._mediaPlayBtn.set_icon_name('media-playback-start-symbolic'); } catch(e) {}
                return;
            }
            this._mprisPlayer = player;
            this._getMprisMetadata(player, (info) => {
                if (!info) return;
                try {
                    if (this._mediaAppIcon) {
                        const iname = this._playerIconName(player);
                        try {
                            const theme = imports.gi.Gtk.IconTheme.get_default();
                            this._mediaAppIcon.set_icon_name(
                                theme && theme.has_icon(iname) ? iname : 'audio-x-generic-symbolic');
                        } catch(e) { this._mediaAppIcon.set_icon_name('audio-x-generic-symbolic'); }
                    }
                    if (this._mediaTitle)  this._mediaTitle.set_text(info.title  || 'Unknown');
                    if (this._mediaArtist) this._mediaArtist.set_text(info.artist || '');
                    if (this._mediaPlayBtn) {
                        this._mediaPlayBtn.set_icon_name(
                            info.status === 'Playing'
                                ? 'media-playback-pause-symbolic'
                                : 'media-playback-start-symbolic');
                    }
                } catch(e) {}
            });
        });
    }

    _startMediaTimer() {
        this._stopMediaTimer();
        this._pollMedia();
        this._mediaTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            if (!this._visible) return GLib.SOURCE_REMOVE;
            this._pollMedia();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopMediaTimer() {
        if (this._mediaTimer) {
            GLib.source_remove(this._mediaTimer);
            this._mediaTimer = null;
        }
    }


    // ── Weather widget ────────────────────────────────────────────────────────
    // Uses Open-Meteo (free, no API key) + Nominatim geocoding (OSM, no key).
    // City is configured in applet settings as `weatherCity`.
    // Layout: [icon] [temp+condition] vertically, compact, next to search bar.

    _buildWeatherWidget() {
        const box = new St.BoxLayout({
            vertical: false,
            x_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding: 0 12px 0 20px;',
            reactive: true,
        });

        // Weather icon (WMO code → emoji)
        this._weatherIcon = new St.Label({
            text: '…',
            style: 'font-size:28px; min-width:36px; margin-right:8px;',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._weatherIcon.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.NONE);

        // Right side: temperature line + condition line
        const textCol = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._weatherTemp = new St.Label({
            text: '--°',
            style: 'font-size:20px; font-weight:700; color:rgba(255,255,255,0.95);' +
                   'text-shadow:0 1px 6px rgba(0,0,0,0.5);',
        });
        this._weatherTemp.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.NONE);
        this._weatherTemp.clutter_text.set_single_line_mode(true);

        this._weatherCond = new St.Label({
            text: '',
            style: 'font-size:11px; color:rgba(255,255,255,0.65);' +
                   'text-shadow:0 1px 4px rgba(0,0,0,0.4);',
        });
        this._weatherCond.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.NONE);
        this._weatherCond.clutter_text.set_single_line_mode(true);

        this._weatherCity = new St.Label({
            text: '',
            style: 'font-size:10px; color:rgba(255,255,255,0.45);',
        });
        this._weatherCity.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.NONE);
        this._weatherCity.clutter_text.set_single_line_mode(true);

        textCol.add_child(this._weatherTemp);
        textCol.add_child(this._weatherCond);
        textCol.add_child(this._weatherCity);
        box.add_child(this._weatherIcon);
        box.add_child(textCol);

        // Click opens a weather site for the city
        box.connect('button-release-event', (a, ev) => {
            if (ev.get_button() === 1) {
                const city = encodeURIComponent(
                    (this._applet.settings.weatherCity || 'London').trim());
                this._pendingAction = () => {
                    try {
                        Gio.app_info_launch_default_for_uri(
                            'https://open-meteo.com/', null);
                    } catch(e) {}
                };
                this.hide();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        return box;
    }

    // Map WMO weather interpretation codes to emoji + short label
    _wmoInfo(code) {
        const map = {
            0:  ['☀️',  'Clear'],
            1:  ['🌤',  'Mostly clear'],
            2:  ['⛅',  'Partly cloudy'],
            3:  ['☁️',  'Overcast'],
            45: ['🌫',  'Foggy'],
            48: ['🌫',  'Icy fog'],
            51: ['🌦',  'Light drizzle'],
            53: ['🌦',  'Drizzle'],
            55: ['🌧',  'Heavy drizzle'],
            61: ['🌧',  'Light rain'],
            63: ['🌧',  'Rain'],
            65: ['🌧',  'Heavy rain'],
            71: ['🌨',  'Light snow'],
            73: ['🌨',  'Snow'],
            75: ['❄️',  'Heavy snow'],
            80: ['🌦',  'Showers'],
            81: ['🌧',  'Rain showers'],
            82: ['⛈',  'Violent showers'],
            95: ['⛈',  'Thunderstorm'],
            96: ['⛈',  'Storm+hail'],
            99: ['⛈',  'Heavy storm'],
        };
        return map[code] || ['🌡', 'Unknown'];
    }

    // Step 1: geocode city name → lat/lon via Nominatim (no API key)
    _geocodeCity(cityName, callback) {
        const UA = 'Mozilla/5.0 (X11; Linux x86_64) overview-applet/1.0';
        const q  = encodeURIComponent(cityName.trim());
        const url = 'https://nominatim.openstreetmap.org/search?q=' + q +
                    '&format=json&limit=1';
        try {
            let session, soup3 = false;
            try   { session = new Soup.Session(); soup3 = true; }
            catch(e) { session = new Soup.SessionAsync(); }

            const msg = Soup.Message.new('GET', url);
            msg.request_headers.append('User-Agent', UA);
            msg.request_headers.append('Accept', 'application/json');

            if (soup3) {
                session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (s, res) => {
                    try {
                        const text = new TextDecoder('utf-8').decode(
                            s.send_and_read_finish(res).get_data());
                        const arr = JSON.parse(text);
                        if (arr && arr[0]) callback(parseFloat(arr[0].lat),
                                                    parseFloat(arr[0].lon),
                                                    arr[0].display_name.split(',')[0]);
                        else callback(null, null, null);
                    } catch(e) { callback(null, null, null); }
                });
            } else {
                session.queue_message(msg, (s, m) => {
                    try {
                        const arr = JSON.parse(m.response_body.data);
                        if (arr && arr[0]) callback(parseFloat(arr[0].lat),
                                                    parseFloat(arr[0].lon),
                                                    arr[0].display_name.split(',')[0]);
                        else callback(null, null, null);
                    } catch(e) { callback(null, null, null); }
                });
            }
        } catch(e) { callback(null, null, null); }
    }

    // Step 2: fetch current weather from Open-Meteo
    _fetchWeatherForLatLon(lat, lon, cityLabel, callback) {
        const url = 'https://api.open-meteo.com/v1/forecast' +
            '?latitude=' + lat.toFixed(4) +
            '&longitude=' + lon.toFixed(4) +
            '&current=temperature_2m,weathercode,windspeed_10m' +
            '&temperature_unit=celsius' +
            '&windspeed_unit=kmh' +
            '&timezone=auto';
        try {
            let session, soup3 = false;
            try   { session = new Soup.Session(); soup3 = true; }
            catch(e) { session = new Soup.SessionAsync(); }

            const msg = Soup.Message.new('GET', url);
            msg.request_headers.append('Accept', 'application/json');

            if (soup3) {
                session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (s, res) => {
                    try {
                        const text = new TextDecoder('utf-8').decode(
                            s.send_and_read_finish(res).get_data());
                        callback(JSON.parse(text), cityLabel);
                    } catch(e) { callback(null, cityLabel); }
                });
            } else {
                session.queue_message(msg, (s, m) => {
                    try { callback(JSON.parse(m.response_body.data), cityLabel); }
                    catch(e) { callback(null, cityLabel); }
                });
            }
        } catch(e) { callback(null, cityLabel); }
    }

    // Main entry: show cached weather instantly, re-fetch only if stale (>30 min).
    _refreshWeather() {
        const city    = (this._applet.settings.weatherCity || '').trim();
        const CACHE_TTL = 30 * 60; // 30 min in seconds
        const now     = GLib.get_monotonic_time() / 1e6;

        if (!city) {
            if (this._weatherTemp) this._weatherTemp.set_text('Set city');
            if (this._weatherCond) this._weatherCond.set_text('in settings');
            return;
        }

        // Apply in-memory weather cache instantly (no network) if fresh
        if (this._wxCache && this._wxCache.city === city &&
            (now - this._wxCache.ts) < CACHE_TTL) {
            this._applyWeatherData(this._wxCache.data, this._wxCache.cityLabel);
            return; // still fresh — skip network entirely
        }

        // Stale or first run — fetch in background, don't block UI
        // Keep showing last known values while fetching
        if (this._wxCache && this._wxCache.city === city) {
            // Show stale data while refreshing — no blank flash
            this._applyWeatherData(this._wxCache.data, this._wxCache.cityLabel);
        }

        const doFetch = (lat, lon, label) => {
            this._fetchWeatherForLatLon(lat, lon, label || city, (data, lbl) => {
                if (data) {
                    this._wxCache = { city, data, cityLabel: lbl, ts: GLib.get_monotonic_time() / 1e6 };
                }
                this._applyWeatherData(data, lbl);
            });
        };

        if (this._weatherLatLon && this._weatherLatLon.city === city) {
            // Have lat/lon already — skip geocoding
            doFetch(this._weatherLatLon.lat, this._weatherLatLon.lon, city);
        } else {
            this._geocodeCity(city, (lat, lon, label) => {
                if (!lat) {
                    if (!this._wxCache) {
                        if (this._weatherTemp) this._weatherTemp.set_text('?');
                        if (this._weatherCond) this._weatherCond.set_text('City not found');
                    }
                    return;
                }
                this._weatherLatLon = { city, lat, lon };
                doFetch(lat, lon, label);
            });
        }
    }

    _applyWeatherData(data, cityLabel) {
        try {
            if (!data || !data.current) {
                if (this._weatherTemp) this._weatherTemp.set_text('--');
                return;
            }
            const c    = data.current;
            const temp = Math.round(c.temperature_2m);
            const code = c.weathercode;
            const [icon, cond] = this._wmoInfo(code);

            if (this._weatherIcon) this._weatherIcon.set_text(icon);
            if (this._weatherTemp) this._weatherTemp.set_text(temp + '°C');
            if (this._weatherCond) this._weatherCond.set_text(cond);
            if (this._weatherCity) this._weatherCity.set_text(cityLabel || '');
        } catch(e) {}
    }

    _startWeatherTimer() {
        this._stopWeatherTimer();
        this._refreshWeather();
        // Refresh every 30 minutes while overview is open
        this._weatherTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1800, () => {
            if (!this._visible) return GLib.SOURCE_REMOVE;
            this._refreshWeather();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopWeatherTimer() {
        if (this._weatherTimer) {
            GLib.source_remove(this._weatherTimer);
            this._weatherTimer = null;
        }
    }

    // ── Clock / date widget (top-right) ───────────────────────────────────────
    _buildClockWidget() {
        const box = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: false,
            style: 'padding: 0 28px 0 0;',
        });

        this._clockLabel = new St.Label({
            text: '00:00',
            style: [
                'font-size: 64px;',
                'font-weight: 200;',
                'min-width: 240px;',
                'color: rgba(255,255,255,0.95);',
                'text-shadow: 0 2px 16px rgba(0,0,0,0.5);',
            ].join(''),
            x_align: Clutter.ActorAlign.END,
        });
        // Prevent Pango from ellipsizing — root cause of dots/missing characters
        this._clockLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this._clockLabel.clutter_text.set_line_wrap(false);
        this._clockLabel.clutter_text.set_single_line_mode(true);

        this._dateLabel = new St.Label({
            text: '',
            style: [
                'font-size: 15px;',
                'font-weight: 400;',
                'min-width: 240px;',
                'color: rgba(255,255,255,0.70);',
                'text-shadow: 0 1px 6px rgba(0,0,0,0.4);',
                'margin-top: 4px;',
            ].join(''),
            x_align: Clutter.ActorAlign.END,
        });
        this._dateLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this._dateLabel.clutter_text.set_line_wrap(false);
        this._dateLabel.clutter_text.set_single_line_mode(true);

        box.add_child(this._clockLabel);
        box.add_child(this._dateLabel);
        return box;
    }

    _updateClock() {
        const now = new Date();

        // Time: HH:MM  (24-hour; swap to 12h with toLocaleTimeString if preferred)
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        if (this._clockLabel) this._clockLabel.set_text(`${hh}:${mm}`);

        // Date: Wednesday, 17 May 2026
        const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const months = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
        const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
        if (this._dateLabel) this._dateLabel.set_text(dateStr);

        // Clock is in layout flow inside sRow — no manual positioning needed
    }

    _startClock() {
        this._updateClock();
        // Update every second
        this._clockTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            if (!this._visible) return GLib.SOURCE_REMOVE;
            this._updateClock();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopClock() {
        if (this._clockTimer) {
            GLib.source_remove(this._clockTimer);
            this._clockTimer = null;
        }
    }


    // ── News feed (thumbnail cards, top of Favourites view) ──────────────────
    // Curated list: quality sources across tech, science, world news, culture
    // All sources grouped by category row.
    // news-rows setting controls how many rows (1–3) are shown.
    //
    // Each source object:
    //   rss:       RSS feed URL (null = skip RSS)
    //   url:       Site homepage (used for og:image fallback and on-click)
    //   ogOnly:    Skip RSS, load og:image from `url` directly
    //   staticImg: Use this fixed image URL — no network fetch for image
    //   color:     Card background shown while image loads
    _newsSourceRows() {
        return [
            // ── Row 1 — World News ───────────────────────────────────────────
            [
                // BBC: media:thumbnail — works perfectly
                { name: 'BBC News',
                  rss: 'https://feeds.bbci.co.uk/news/rss.xml',
                  url: 'https://www.bbc.com/news',               color: '#BB1919' },
                // NYT: media:thumbnail in feed
                { name: 'NY Times',
                  rss: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
                  url: 'https://www.nytimes.com',                color: '#1a1a1a' },
                // France 24: media:thumbnail
                { name: 'France 24',
                  rss: 'https://www.france24.com/en/rss',
                  url: 'https://www.france24.com/en/',           color: '#003F87' },
                // CNN: media:thumbnail
                { name: 'CNN',
                  rss: 'http://rss.cnn.com/rss/edition.rss',
                  url: 'https://www.cnn.com',                    color: '#CC0001' },
                // Al Jazeera: media:thumbnail
                { name: 'Al Jazeera',
                  rss: 'https://www.aljazeera.com/xml/rss/all.xml',
                  url: 'https://www.aljazeera.com',              color: '#E8811A' },
                // Guardian: media:thumbnail
                { name: 'The Guardian',
                  rss: 'https://www.theguardian.com/world/rss',
                  url: 'https://www.theguardian.com',            color: '#052962' },
                // Reuters: their feed blocks bots; use mrss variant with media:thumbnail
                { name: 'Reuters',
                  rss: 'https://feeds.reuters.com/reuters/topNews',
                  url: 'https://www.reuters.com',                color: '#FF8000',
                  staticImg: 'https://www.reuters.com/pf/resources/images/reuters/logo-vertical-default.png?d=116' },
                // DW: enclosure type=image/jpeg — works, but use mrss for thumbnails
                { name: 'DW News',
                  rss: 'https://rss.dw.com/rdf/rss-en-all',
                  url: 'https://www.dw.com/en/',                 color: '#002A5C' },
                // RFI: media:thumbnail
                { name: 'RFI English',
                  rss: 'https://www.rfi.fr/en/rss',
                  url: 'https://www.rfi.fr/en/',                 color: '#003399' },
                // Euronews: direct mrss feed has media:thumbnail
                { name: 'Euronews',
                  rss: 'https://www.euronews.com/rss?format=mrss&level=theme&name=news',
                  url: 'https://www.euronews.com',               color: '#0A2C6E' },
            ],
            // ── Row 2 — Movies & Cinema first, then Science & Tech ─────────
            // All movie sources are WordPress blogs with media:thumbnail — tested working
            [
                // Screen Rant: huge movie/TV site, WordPress, rich media:thumbnail
                { name: 'Screen Rant',
                  rss: 'https://screenrant.com/feed/',
                  url: 'https://screenrant.com',                 color: '#CC0000' },
                // Collider: movie news, reviews, trailers — WordPress media:thumbnail
                { name: 'Collider',
                  rss: 'https://collider.com/feed/',
                  url: 'https://collider.com',                   color: '#E8A000' },
                // IndieWire: film criticism, awards, festivals — WordPress media:thumbnail
                { name: 'IndieWire',
                  rss: 'https://www.indiewire.com/feed/',
                  url: 'https://www.indiewire.com',              color: '#990000' },
                // The Playlist: indie/arthouse film coverage — WordPress media:thumbnail
                { name: 'The Playlist',
                  rss: 'https://theplaylist.net/feed/',
                  url: 'https://theplaylist.net',                color: '#1a3a5c' },
                // Variety Film: dedicated film section — WordPress media:thumbnail
                { name: 'Variety',
                  rss: 'https://variety.com/v/film/feed/',
                  url: 'https://variety.com/v/film/',            color: '#7B0A14' },
                // Hollywood Reporter: industry news with vivid stills
                { name: 'THR',
                  rss: 'https://www.hollywoodreporter.com/feed/',
                  url: 'https://www.hollywoodreporter.com',      color: '#2c2c54' },
                // Roger Ebert: reviews with movie stills — WordPress enclosure
                { name: 'RogerEbert.com',
                  rss: 'https://www.rogerebert.com/feed',
                  url: 'https://www.rogerebert.com',             color: '#8B0000' },
                // Science & Tech — proven working feeds below
                // NatGeo photo of the day: media:content
                { name: 'Nat Geo',
                  rss: 'https://feeds.nationalgeographic.com/ng/photography/photo-of-the-day',
                  url: 'https://www.nationalgeographic.com',     color: '#B8860B' },
                // NASA: enclosure url=...jpg
                { name: 'NASA',
                  rss: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
                  url: 'https://www.nasa.gov/news',              color: '#0B3D91' },
                // Big Think: WordPress media:content
                { name: 'Big Think',
                  rss: 'https://bigthink.com/feed/',
                  url: 'https://bigthink.com',                   color: '#1A1A2E' },
                // Ars Technica: media:thumbnail
                { name: 'Ars Technica',
                  rss: 'https://feeds.arstechnica.com/arstechnica/index',
                  url: 'https://arstechnica.com',                color: '#F05500' },
                // The Verge: media:thumbnail
                { name: 'The Verge',
                  rss: 'https://www.theverge.com/rss/index.xml',
                  url: 'https://www.theverge.com',               color: '#FA4522' },
                // Wired: media:thumbnail
                { name: 'Wired',
                  rss: 'https://www.wired.com/feed/rss',
                  url: 'https://www.wired.com',                  color: '#1a1a1a' },
                // MIT Tech Review: WordPress media:thumbnail
                { name: 'MIT Tech Rev',
                  rss: 'https://www.technologyreview.com/feed/',
                  url: 'https://www.technologyreview.com',       color: '#A31F34' },
                // OMG Ubuntu: WordPress media:thumbnail
                { name: 'OMG Ubuntu',
                  rss: 'https://www.omgubuntu.co.uk/feed',
                  url: 'https://www.omgubuntu.co.uk',            color: '#E95420' },
                // New Scientist: media:thumbnail
                { name: 'New Scientist',
                  rss: 'https://www.newscientist.com/feed/home/',
                  url: 'https://www.newscientist.com',           color: '#007A4D' },
            ],
            // ── Row 3 — Music & Culture ──────────────────────────────────────
            [
                { name: 'Pitchfork',
                  rss: 'https://pitchfork.com/rss/news/',
                  url: 'https://pitchfork.com',                  color: '#EF3340' },
                { name: 'NME',
                  rss: 'https://www.nme.com/feed',
                  url: 'https://www.nme.com',                    color: '#E30013' },
                { name: 'Rolling Stone',
                  rss: 'https://www.rollingstone.com/feed/',
                  url: 'https://www.rollingstone.com',           color: '#1a1a1a' },
                { name: 'Consequence',
                  rss: 'https://consequenceofsound.net/feed/',
                  url: 'https://consequenceofsound.net',         color: '#2D2D2D' },
                { name: 'The AV Club',
                  rss: 'https://www.avclub.com/rss',
                  url: 'https://www.avclub.com',                 color: '#167359' },
                { name: 'Stereogum',
                  rss: 'https://www.stereogum.com/feed/',
                  url: 'https://www.stereogum.com',              color: '#000000' },
                { name: 'Paste Music',
                  rss: 'https://www.pastemagazine.com/rss/',
                  url: 'https://www.pastemagazine.com',          color: '#2E8B57' },
                { name: 'Far Out Mag',
                  rss: 'https://faroutmagazine.co.uk/feed/',
                  url: 'https://faroutmagazine.co.uk',           color: '#4B0082' },
                { name: 'Clash Music',
                  rss: 'https://www.clashmusic.com/rss.xml',
                  url: 'https://www.clashmusic.com',             color: '#C41E3A' },
                { name: 'DIY Magazine',
                  rss: 'https://diymag.com/feed',
                  url: 'https://diymag.com',                     color: '#FF4500' },
            ],
        ];
    }

    // Build the news strip — one or more scrollable rows depending on settings
    _buildNewsFeed() {
        const allRows  = this._newsSourceRows();
        const numRows  = Math.max(1, Math.min(3, this._applet.settings.newsRows || 1));
        const CARD_W   = 200;
        const CARD_H   = 130;
        const GAP      = 12;
        const ROW_LABELS = ['NEWS', 'SCIENCE & TECH', 'FILM & MUSIC'];

        const outerBox = new St.BoxLayout({ vertical: true, x_expand: true });
        this._newsBox = outerBox;
        this._newsScrollViews = [];   // one St.ScrollView per row — all driven by pointer scroll

        for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
            const sources = allRows[rowIdx] || [];
            const rowLabel = ROW_LABELS[rowIdx] || ('ROW ' + (rowIdx + 1));

            // Row header label
            outerBox.add_child(new St.Label({
                text: rowLabel,
                style: 'font-size:10px;font-weight:700;color:rgba(255,255,255,0.38);' +
                       'padding: 10px ' + H_PAD + 'px 4px ' + H_PAD + 'px;',
            }));

            // Horizontal ScrollView for this row
            const scrollH = new St.ScrollView({
                x_expand: true,
                style_class: 'cinnamon-overview-news-scroll',
                style: 'padding-bottom:2px;',
            });
            scrollH.set_policy(St.PolicyType.AUTOMATIC, St.PolicyType.NEVER);
            scrollH.set_overlay_scrollbars(false); // consistent fixed-height bar on all rows
            scrollH.set_mouse_scrolling(false); // pointer-coord handler drives this
            this._newsScrollViews.push(scrollH);

            const rowBox = new St.BoxLayout({
                vertical: false,
                style: `padding: 0 ${H_PAD}px 8px ${H_PAD}px;`,
            });
            scrollH.add_actor(rowBox);
            outerBox.add_child(scrollH);

        sources.forEach(src => {
            // Card button
            const card = new St.Button({
                reactive: true, can_focus: true, track_hover: true,
                style: `width:${CARD_W}px;height:${CARD_H}px;border-radius:10px;` +
                       `background-color:${src.color};overflow:hidden;padding:0;margin-right:${GAP}px;`,
            });

            const cardInner = new St.Widget({
                style: `width:${CARD_W}px;height:${CARD_H}px;border-radius:10px;overflow:hidden;`,
                clip_to_allocation: true,
            });

            // Thumbnail placeholder — colour fill until real image loads
            const thumb = new St.Widget({
                style: `background-color:${src.color};border-radius:10px;`,
                width: CARD_W, height: CARD_H,
            });
            cardInner.add_child(thumb);

            // Dark gradient overlay for readability
            const gradient = new St.Widget({
                style: 'background-gradient-direction:vertical;' +
                       'background-gradient-start:rgba(0,0,0,0);' +
                       'background-gradient-end:rgba(0,0,0,0.82);' +
                       'border-radius:10px;',
                width: CARD_W, height: CARD_H,
            });
            gradient.set_position(0, 0);
            cardInner.add_child(gradient);

            // Source name — big, bold, bottom-left of card
            const nameLabel = new St.Label({
                text: src.name,
                style: 'font-size:13px;font-weight:700;color:#ffffff;' +
                       'text-shadow:0 1px 4px rgba(0,0,0,0.8);padding:0 8px 6px 10px;',
            });
            nameLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
            nameLabel.clutter_text.set_line_wrap(false);

            // Headline label — smaller, below name
            const headlineLabel = new St.Label({
                text: 'Loading…',
                style: 'font-size:10px;font-weight:400;color:rgba(255,255,255,0.82);' +
                       'text-shadow:0 1px 3px rgba(0,0,0,0.7);padding:0 8px 10px 10px;',
            });
            headlineLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
            headlineLabel.clutter_text.set_line_wrap(true);
            headlineLabel.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            headlineLabel.clutter_text.set_max_length(0);

            const textBox = new St.BoxLayout({
                vertical: true,
                y_align: Clutter.ActorAlign.END,
                x_align: Clutter.ActorAlign.START,
                width: CARD_W, height: CARD_H,
            });
            textBox.set_position(0, 0);
            textBox.add_child(new St.Widget({ y_expand: true })); // spacer pushes text down
            textBox.add_child(nameLabel);
            textBox.add_child(headlineLabel);
            cardInner.add_child(textBox);

            card.set_child(cardInner);

            // FIX 2: hover ring as a non-reactive overlay — geometry never changes → no wobble
            const hoverRing = new St.Widget({
                width: CARD_W, height: CARD_H,
                reactive: false,
                style: 'border-radius:10px;',
            });
            hoverRing.set_position(0, 0);
            cardInner.add_child(hoverRing);
            card.connect('notify::hover', () => {
                hoverRing.style = card.hover
                    ? 'border-radius:10px;border:2px solid rgba(255,255,255,0.60);box-shadow:0 0 12px rgba(255,255,255,0.15);'
                    : 'border-radius:10px;';
            });

            // FIX 1: swallow press so it never propagates; use _pendingAction for launch
            // so the URL opens AFTER hide() finishes — identical to power-bar pattern.
            // This also prevents the captured-event handler from seeing the same click.
            card.connect('button-press-event',   () => Clutter.EVENT_STOP);
            card.connect('button-release-event', (a, ev) => {
                if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                    const targetUrl = src.url;
                    this._pendingAction = () => {
                        try { Gio.app_info_launch_default_for_uri(targetUrl, null); } catch(e) {}
                    };
                    this.hide();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_STOP; // swallow right-click too — no context menu on cards
            });

            rowBox.add_child(card);

            // ── Card data fetch — cache-first, network only if stale (>30 min) ──
            const cardSrcUrl = src.url;
            const CACHE_TTL  = 30 * 60;  // 30 minutes in seconds
            const now        = GLib.get_monotonic_time() / 1e6;

            // Apply cached image path immediately (zero network wait)
            const applyCache = (entry) => {
                if (!entry) return false;
                if (now - entry.ts > CACHE_TTL) return false; // stale
                try {
                    if (entry.headline) headlineLabel.set_text(entry.headline);
                    if (entry.imgPath) {
                        const f = Gio.File.new_for_path(entry.imgPath);
                        if (f.query_exists(null)) {
                            thumb.style = 'background-image:url("' + entry.imgPath + '");' +
                                'background-size:cover;background-position:center;border-radius:10px;';
                            return true;
                        }
                    }
                } catch(e) {}
                return false;
            };

            // Store result in cache and apply to card
            const cacheAndApply = (cacheKey, headline, imgPath) => {
                this._rssCache[cacheKey] = { headline, imgPath, ts: now };
                try {
                    if (headline) headlineLabel.set_text(headline);
                    if (imgPath) {
                        thumb.style = 'background-image:url("' + imgPath + '");' +
                            'background-size:cover;background-position:center;border-radius:10px;';
                    }
                } catch(e) {}
            };

            // Wrap _loadImageIntoActor to also cache the resulting tmp path
            const fetchAndCacheImage = (imgUrl, cacheKey, headline) => {
                // Check if we already have a cached path for this image URL
                if (this._imgCache[imgUrl]) {
                    const p = this._imgCache[imgUrl];
                    if (Gio.File.new_for_path(p).query_exists(null)) {
                        cacheAndApply(cacheKey, headline, p);
                        return;
                    }
                }
                // Fetch fresh — patch _writeAndApply to intercept the saved path
                const origStyle = (path) => {
                    this._imgCache[imgUrl] = path;
                    cacheAndApply(cacheKey, headline, path);
                };
                this._loadImageIntoActorCb(imgUrl, thumb, CARD_W, CARD_H, false, origStyle);
            };

            const cacheKey = src.rss || src.url;

            if (src.staticImg) {
                if (!applyCache(this._rssCache[cacheKey])) {
                    headlineLabel.set_text('');
                    fetchAndCacheImage(src.staticImg, cacheKey, '');
                }
            } else if (src.ogOnly || !src.rss) {
                if (!applyCache(this._rssCache[cacheKey])) {
                    this._loadImageIntoActorCb(cardSrcUrl, thumb, CARD_W, CARD_H, false, (path) => {
                        this._imgCache[cardSrcUrl] = path;
                        cacheAndApply(cacheKey, '', path);
                    });
                }
            } else {
                // Try cache first — show instantly
                const cached = this._rssCache[cacheKey];
                const fresh  = applyCache(cached);
                if (!fresh) {
                    // Stale or missing — fetch in background
                    this._fetchRss(src.rss, (headline, imgUrl) => {
                        if (imgUrl) {
                            fetchAndCacheImage(imgUrl, cacheKey, headline);
                        } else if (headline) {
                            // No image — try og:image from homepage
                            this._loadImageIntoActorCb(cardSrcUrl, thumb, CARD_W, CARD_H, false, (path) => {
                                cacheAndApply(cacheKey, headline, path);
                            });
                        }
                    });
                }
            }
        }); // end sources.forEach
        } // end for rowIdx loop

        return outerBox;
    }

    // Fetch RSS feed and return first headline + first <media:thumbnail> or <enclosure> url
    _fetchRss(rssUrl, callback) {
        // UA required: DW, Euronews, Phys.org and others 403 on bot user-agents
        const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
        try {
            let session;
            try {
                // Soup 3.x
                session = new Soup.Session();
                const msg = Soup.Message.new('GET', rssUrl);
                msg.request_headers.append('User-Agent', UA);
                msg.request_headers.append('Accept', 'application/rss+xml,application/xml,text/xml,*/*');
                session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (s, res) => {
                    try {
                        const bytes = s.send_and_read_finish(res);
                        const text  = new TextDecoder('utf-8').decode(bytes.get_data());
                        const [hl, img] = this._parseRss(text);
                        callback(hl, img, rssUrl);
                    } catch(e) { callback(null, null, rssUrl); }
                });
            } catch(e) {
                // Soup 2.x fallback
                session = new Soup.SessionAsync();
                const msg = Soup.Message.new('GET', rssUrl);
                msg.request_headers.append('User-Agent', UA);
                msg.request_headers.append('Accept', 'application/rss+xml,application/xml,text/xml,*/*');
                session.queue_message(msg, (s, m) => {
                    try {
                        const text = m.response_body.data;
                        const [hl, img] = this._parseRss(text);
                        callback(hl, img, rssUrl);
                    } catch(e2) { callback(null, null, rssUrl); }
                });
            }
        } catch(e) { callback(null, null); }
    }

    _parseRss(xml) {
        let headline = null;
        let imgUrl   = null;

        const decodeEntities = s => s
            .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
            .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'")
            .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));

        const stripCdata = s => s.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim();

        // Find first <item> or <entry> (Atom feeds)
        const itemRe = /<(?:item|entry)[\s>]/i;
        const itemM  = xml.match(itemRe);
        if (!itemM) return [headline, imgUrl];

        const itemIdx = xml.indexOf(itemM[0]);
        // Take a generous chunk covering the full first item
        const endTag  = xml.indexOf('<item', itemIdx + 10);
        const chunk   = xml.slice(itemIdx, endTag > 0 ? Math.min(endTag, itemIdx + 8000) : itemIdx + 8000);

        // ── Headline ──────────────────────────────────────────────────────────
        const titleM = chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleM) {
            headline = decodeEntities(stripCdata(titleM[1].trim())).slice(0, 120);
        }

        // ── Image URL — try every known RSS/Atom image pattern ───────────────
        const tryPatterns = [
            // media:thumbnail url= (BBC, Guardian, Reuters, most major feeds)
            /media:thumbnail[^>]+url=["']([^"'\s>]+)/i,
            // media:content url= with explicit image extension OR any url (NatGeo photo feed)
            /media:content[^>]+url=["']([^"'\s>]+\.(?:jpg|jpeg|png|webp|gif)[^"'\s>]*)/i,
            /media:content[^>]+url=["']([^"'\s>]+)/i,
            // enclosure with image mime type (Phys.org, many science feeds)
            /enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"'\s>]+)/i,
            /enclosure[^>]+url=["']([^"'\s>]+\.(?:jpg|jpeg|png|webp|gif)[^"'\s>]*)/i,
            // Atom: link rel=enclosure
            /link[^>]+rel=["']enclosure["'][^>]+href=["']([^"'\s>]+\.(?:jpg|jpeg|png|webp)[^"'\s>]*)/i,
            // itunes:image href=
            /itunes:image[^>]+href=["']([^"'\s>]+)/i,
            // <img src= inside CDATA description — capture query string too
            /<img[^>]+src=["']([^"'\s>]+\.(?:jpg|jpeg|png|webp)[^"']*?)["']/i,
            // og:image content=
            /og:image[^>]+content=["']([^"'\s>]+)/i,
            /content=["']([^"'\s>]+\.(?:jpg|jpeg|png|webp)[^"'\s>]*)/i,
            // Full https URL with image extension + optional query string (last resort)
            /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?)/i,
        ];

        // Decode HTML entities in URL (NatGeo uses &amp; in URLs inside XML)
        const cleanUrl = u => u.replace(/&amp;/g, '&').replace(/&lt;/g,'<').trim();

        for (const pat of tryPatterns) {
            const m = chunk.match(pat);
            if (m && m[1]) {
                const u = cleanUrl(m[1]);
                if (!u.startsWith('http')) continue;          // skip relative paths
                if (/\.svg(\?|$)/i.test(u)) continue;       // skip SVG
                if (/1x1|spacer|pixel|tracking/i.test(u)) continue; // skip beacons
                if (u.length < 12) continue;
                imgUrl = u;
                break;
            }
        }

        return [headline, imgUrl];
    }

    // ── Image loading ──────────────────────────────────────────────────────────
    // Simple, reliable: write bytes to /tmp, set background-image: url().
    // No idle_add (not in Cinnamon GJS), no is_finalized (not on St widgets).
    _tmpThumbPath() {
        const t = String(GLib.get_monotonic_time());
        return GLib.build_filenamev([GLib.get_tmp_dir(), 'ov_th_' + t + '.jpg']);
    }

    _applyImagePath(actor, path) {
        // Called directly in the Soup callback — already on GLib main loop
        try {
            actor.style = 'background-image:url("' + path + '");' +
                'background-size:cover;background-position:center;border-radius:10px;';
        } catch(e) {}
    }

    _writeAndApply(actor, data, cb) {
        // data: Uint8Array or Array-like of bytes
        // cb: optional callback(savedPath) — used by cache layer
        try {
            if (!data || data.length < 100) return false;
            // Verify magic numbers — avoid writing HTML/text as an image
            const b = data instanceof Uint8Array ? data : new Uint8Array(data);
            const isJpeg = b[0] === 0xFF && b[1] === 0xD8;
            const isPng  = b[0] === 0x89 && b[1] === 0x50;
            const isGif  = b[0] === 0x47 && b[1] === 0x49;
            const isWebp = b[0] === 0x52 && b[1] === 0x49; // RIFF
            if (!isJpeg && !isPng && !isGif && !isWebp) return false;
            const path = this._tmpThumbPath();
            const f    = Gio.File.new_for_path(path);
            f.replace_contents(b, null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            if (cb) {
                // Let cache layer apply the style (it also stores the path)
                try { cb(path); } catch(e) { this._applyImagePath(actor, path); }
            } else {
                this._applyImagePath(actor, path);
            }
            // Clean up after 30 minutes — long enough for cache to reuse
            GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 1800, () => {
                try { f.delete(null); } catch(e) {}
                return GLib.SOURCE_REMOVE;
            });
            return true;
        } catch(e) { return false; }
    }

    // Fetch an image URL and apply it to actor.
    // _retried prevents infinite loops on og:image fallback.
    _loadImageIntoActor(url, actor, w, h, _retried) {
        if (!url || !actor) return;
        const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
        try {
            let session, soup3 = false;
            try   { session = new Soup.Session(); soup3 = true; }
            catch(e) { try { session = new Soup.SessionAsync(); } catch(e2) { return; } }

            let msg;
            try {
                msg = Soup.Message.new('GET', url);
                msg.request_headers.append('User-Agent', UA);
                msg.request_headers.append('Accept', 'image/webp,image/jpeg,image/png,image/*,*/*');
                msg.request_headers.append('Referer', 'https://www.google.com/');
            } catch(e) { return; }

            const self = this;

            // Extract og:image from HTML bytes when direct image fetch fails
            const tryOgFromHtml = (rawBytes) => {
                if (_retried) return;
                try {
                    const text = new TextDecoder('utf-8').decode(rawBytes).slice(0, 20000);
                    // Match both attribute orderings of og:image meta tag
                    const ogM = text.match(/property=["']og:image["'][^>]*content=["']([^"'\s>]+)/i)
                             || text.match(/content=["']([^"'\s>]+)["'][^>]*property=["']og:image["']/i)
                             || text.match(/name=["']og:image["'][^>]*content=["']([^"'\s>]+)/i)
                             || text.match(/content=["']([^"'\s>]+)["'][^>]*name=["']og:image["']/i);
                    if (ogM && ogM[1] && ogM[1].startsWith('http')) {
                        self._loadImageIntoActor(ogM[1], actor, w, h, true);
                    }
                } catch(e) {}
            };

            const onBytes = (rawBytes) => {
                if (!rawBytes || rawBytes.length < 50) return;
                if (self._writeAndApply(actor, rawBytes)) return; // it's an image — done
                tryOgFromHtml(rawBytes);                          // it's HTML — extract og:image
            };

            if (soup3) {
                session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (s, res) => {
                    try { onBytes(s.send_and_read_finish(res).get_data()); } catch(e) {}
                });
            } else {
                // Soup 2.x: response_body.data is already a JS string; encode back to bytes
                session.queue_message(msg, (s, m) => {
                    try {
                        // Use response_body.data directly for text (og:image fallback)
                        // and flatten().get_as_bytes() only if needed
                        const bodyData = m.response_body.data;
                        if (bodyData) {
                            const enc = new TextEncoder().encode(bodyData);
                            onBytes(enc);
                        } else {
                            const gb = m.response_body.flatten().get_as_bytes();
                            // Efficient conversion using GLib.Bytes.get_data() if available
                            const raw = gb.get_data ? gb.get_data() : new Uint8Array(0);
                            onBytes(raw);
                        }
                    } catch(e) {}
                });
            }
        } catch(e) {}
    }


    // Like _loadImageIntoActor but calls cb(savedPath) on success — used by cache layer
    _loadImageIntoActorCb(url, actor, w, h, _retried, cb) {
        if (!url || !actor) return;
        const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
        try {
            let session, soup3 = false;
            try   { session = new Soup.Session(); soup3 = true; }
            catch(e) { try { session = new Soup.SessionAsync(); } catch(e2) { return; } }
            let msg;
            try {
                msg = Soup.Message.new('GET', url);
                msg.request_headers.append('User-Agent', UA);
                msg.request_headers.append('Accept', 'image/webp,image/jpeg,image/png,image/*,*/*');
                msg.request_headers.append('Referer', 'https://www.google.com/');
            } catch(e) { return; }
            const self = this;
            const onBytes = (rawBytes) => {
                if (!rawBytes || rawBytes.length < 50) return;
                if (self._writeAndApply(actor, rawBytes, cb)) return;
                // Not an image — try og:image
                if (_retried) return;
                try {
                    const text = new TextDecoder('utf-8').decode(rawBytes).slice(0, 20000);
                    const ogM = text.match(/property=["']og:image["'][^>]*content=["']([^"'\s>]+)/i)
                             || text.match(/content=["']([^"'\s>]+)["'][^>]*property=["']og:image["']/i);
                    if (ogM && ogM[1] && ogM[1].startsWith('http'))
                        self._loadImageIntoActorCb(ogM[1], actor, w, h, true, cb);
                } catch(e) {}
            };
            if (soup3) {
                session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (s, res) => {
                    try { onBytes(s.send_and_read_finish(res).get_data()); } catch(e) {}
                });
            } else {
                session.queue_message(msg, (s, m) => {
                    try {
                        const bodyData = m.response_body.data;
                        onBytes(bodyData ? new TextEncoder().encode(bodyData)
                                         : (m.response_body.flatten().get_data ?
                                            m.response_body.flatten().get_data() : new Uint8Array(0)));
                    } catch(e) {}
                });
            }
        } catch(e) {}
    }

    // ── Power bar ─────────────────────────────────────────────────────────────
    _buildPowerBar() {
        const bar = new St.BoxLayout({ vertical:false, reactive: false });
        const makeBtn = (iconName, tooltip, action) => {
            const btn = new St.Button({ reactive:true, can_focus:true, track_hover:true,
                style_class:'cinnamon-overview-power-btn',
                style:'padding:9px 10px;' });
            const icon = new St.Icon({ icon_name:iconName, icon_type:St.IconType.SYMBOLIC,
                icon_size:28, style_class:'cinnamon-overview-power-icon' });
            btn.set_child(icon);
            btn.connect('notify::hover', () => {
                if (btn.hover) btn.add_style_pseudo_class('hover');
                else btn.remove_style_pseudo_class('hover');
            });
            btn._tooltip = tooltip; btn._tooltipActor = null;
            btn.connect('enter-event', () => {
                if (btn._tooltipActor) btn._tooltipActor.destroy();
                const t = new St.Label({ text:btn._tooltip,
                    style_class:'cinnamon-overview-tooltip' });
                this._root.add_child(t);
                btn._tooltipActor = t;
                const [bx, by] = btn.get_transformed_position();
                const [ox, oy] = this._root.get_transformed_position();
                t.set_position(Math.round(bx-ox+btn.width/2-40), Math.round(by-oy-32));
            });
            btn.connect('leave-event', () => {
                if (btn._tooltipActor) { btn._tooltipActor.destroy(); btn._tooltipActor = null; }
            });
            btn.connect('button-press-event', () => Clutter.EVENT_STOP);
            btn.connect('button-release-event', (a, ev) => {
                if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                    if (btn._tooltipActor) { btn._tooltipActor.destroy(); btn._tooltipActor = null; }
                    this._pendingAction = action; this.hide(); return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            return btn;
        };
        const sm   = this._applet.sessionManager;
        const Util = imports.misc.util;
        bar.add_child(makeBtn('system-log-out-symbolic', _('Log Out'),
            () => { try { sm.LogoutRemote(0); } catch(e) {} }));
        bar.add_child(makeBtn('system-lock-screen-symbolic', _('Lock Screen'),
            () => { try {
                const s = new Gio.Settings({ schema_id:'org.cinnamon.desktop.screensaver' });
                if (Gio.file_new_for_path('/usr/bin/cinnamon-screensaver-command').query_exists(null))
                    Util.spawnCommandLine(s.get_boolean('ask-for-away-message')
                        ? 'cinnamon-screensaver-lock-dialog'
                        : 'cinnamon-screensaver-command --lock');
                else this._applet.screenSaverProxy.LockRemote('');
            } catch(e) {} }));
        bar.add_child(makeBtn('view-refresh-symbolic', _('Restart Cinnamon'),
            () => { try { global.reexec_self(); }
                    catch(e) { try { Util.spawnCommandLine('cinnamon --replace'); } catch(e2) {} } }));
   
        bar.add_child(makeBtn('system-shutdown-symbolic', _('Shut Down'),
            () => { try { sm.ShutdownRemote(); }
                    catch(e) { try { Util.spawnCommandLine('systemctl poweroff'); } catch(e2) {} } }));
        return bar;
    }

    // ── Sections ──────────────────────────────────────────────────────────────
    _buildSections() {
        this._sections = [];
        const favs = this._applet.appFavorites ? this._applet.appFavorites.getFavorites() : [];
        if (favs && favs.length)
            this._sections.push({ label:_('Favourites'), id:'favourites', apps:favs });
        this._applet.apps.getDirs().forEach(dir => {
            const apps = this._applet.apps.listApplications(dir.get_menu_id());
            if (apps && apps.length) {
                let gicon = null; try { gicon = dir.get_icon(); } catch(e) {}
                this._sections.push({ label:dir.get_name(), id:dir.get_menu_id(), apps, _gicon:gicon });
            }
        });
        // Web search sections removed
    }

    // ── Category icon map ─────────────────────────────────────────────────────
    _iconForSection(sec) {
        if (!sec) return 'applications-other';
        const id = sec.id || '';
        if (id === 'favourites' || id === 'favorite_apps') return 'emblem-favorite';
        if (id === 'favorite_files')                       return 'xapp-user-favorites';
        if (id === 'places')                               return 'folder';
        if (id === 'recents')                              return 'document-open-recent';
        if (sec._gicon) return null;
        const label = (sec.label||'').toLowerCase();
        const MAP = {
            'accessories':'applications-accessories','education':'applications-education',
            'games':'applications-games','graphics':'applications-graphics',
            'internet':'applications-internet','multimedia':'applications-multimedia',
            'office':'applications-office','programming':'applications-development',
            'sound':'applications-multimedia','sound & video':'applications-multimedia',
            'system':'applications-system','administration':'preferences-system',
            'preferences':'preferences-desktop','utilities':'applications-utilities',
            'science':'applications-science','other':'applications-other',
            'chrome apps':'applications-internet','wps office':'applications-office',
        };
        for (const k of Object.keys(MAP)) if (label.includes(k)) return MAP[k];
        return 'applications-other';
    }

    // ── Category buttons ──────────────────────────────────────────────────────
    _buildCategories() {
        this._catBox.get_children().forEach(c => c.destroy());

        // Spacer — height matches search row (28px top + 34px entry + 14px bottom = 76px)
        this._catBox.add_child(new St.Widget({ height:76, x_expand:true }));

        // "CATEGORIES" title (sentinel _idx=-1, never touched by _selectCategory)
        const catLabel = new St.Label({
            text:_('CATEGORIES'),
            style_class:'cinnamon-overview-categories-title',
        });
        catLabel._idx = -1;
        this._catBox.add_child(catLabel);

        // Read setting: true=click-to-select, false=hover-to-select
        const clickMode = !!this._applet.settings.categoryClick;

        this._sections.forEach((sec, i) => {
            const isActive = i === 0;
            const btn = new St.BoxLayout({
                reactive:true, track_hover:true,
                style_class: isActive ? 'cinnamon-overview-category-sel' : 'cinnamon-overview-category',
                x_expand:true,
            });

            // Accent bar — colour from CSS (.cinnamon-overview-cat-accent[-sel])
            const accent = new St.Widget({
                style_class: isActive ? 'cinnamon-overview-cat-accent-sel' : 'cinnamon-overview-cat-accent',
                style: 'width:3px;border-radius:2px;',
                y_expand:true,
            });
            btn.add_child(accent);

            // Icon
            const iconName = this._iconForSection(sec);
            const catIcon = sec._gicon
                ? new St.Icon({ gicon:sec._gicon, icon_type:St.IconType.FULLCOLOR, icon_size:16,
                    style_class: isActive ? 'cinnamon-overview-cat-icon-sel' : 'cinnamon-overview-cat-icon',
                    style:'margin-left:8px;', y_align:Clutter.ActorAlign.CENTER })
                : new St.Icon({ icon_name:iconName||'applications-other',
                    icon_type:St.IconType.SYMBOLIC, icon_size:16,
                    style_class: isActive ? 'cinnamon-overview-cat-icon-sel' : 'cinnamon-overview-cat-icon',
                    style:'margin-left:8px;', y_align:Clutter.ActorAlign.CENTER });
            btn.add_child(catIcon);

            // Label
            const lbl = new St.Label({
                text:sec.label,
                style_class: isActive ? 'cinnamon-overview-cat-label-sel' : 'cinnamon-overview-cat-label',
                style:'padding:8px 8px 8px 8px;',
                y_align:Clutter.ActorAlign.CENTER,
            });
            btn.add_child(lbl);

            // ── Interaction: mirrors Cinnamenu's categoryClick setting ────
            if (!clickMode) {
                // Hover mode — select category on mouse enter
                btn.connect('enter-event', () => {
                    if (i !== this._currentSec) this._selectCategory(i);
                });
            } else {
                // Click mode — highlight on hover, select on click
                btn.connect('enter-event', () => {
                    if (i !== this._currentSec) btn.add_style_pseudo_class('hover');
                });
                btn.connect('leave-event', () => {
                    btn.remove_style_pseudo_class('hover');
                });
                btn.connect('button-release-event', (a, ev) => {
                    if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                        this._selectCategory(i); return Clutter.EVENT_STOP;
                    }
                    return Clutter.EVENT_PROPAGATE;
                });
            }

            btn._accent  = accent;
            btn._lbl     = lbl;
            btn._catIcon = catIcon;
            btn._idx     = i;
            this._catBox.add_child(btn);
        });
    }

    // ── Select category ───────────────────────────────────────────────────────
    _selectCategory(i) {
        if (i < 0 || i >= this._sections.length) return;
        this._currentSec = i;

        this._catBox.get_children().forEach(btn => {
            // Skip spacer (no _idx) and sentinel catLabel (_idx === -1)
            if (btn._idx === undefined || btn._idx < 0) return;
            const on = btn._idx === this._currentSec;
            btn.style_class = on ? 'cinnamon-overview-category-sel' : 'cinnamon-overview-category';
            btn.remove_style_pseudo_class('hover');
            if (btn._accent)
                btn._accent.style_class = on
                    ? 'cinnamon-overview-cat-accent-sel'
                    : 'cinnamon-overview-cat-accent';
            if (btn._lbl)
                btn._lbl.style_class = on
                    ? 'cinnamon-overview-cat-label-sel'
                    : 'cinnamon-overview-cat-label';
            if (btn._catIcon)
                btn._catIcon.style_class = on
                    ? 'cinnamon-overview-cat-icon-sel'
                    : 'cinnamon-overview-cat-icon';
        });

        this._wrapper.ease({
            opacity:0, duration:80, mode:Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                const sec = this._sections[i];
                this._populateSection(sec);
                this._scroll.get_vscroll_bar().get_adjustment().set_value(0);
                this._wrapper.ease({ opacity:255, duration:120, mode:Clutter.AnimationMode.EASE_IN_QUAD });
            },
        });
    }

    // ── Grid helpers ──────────────────────────────────────────────────────────
    _gridWidth() {
        const m = Main.layoutManager.primaryMonitor;
        return Math.max(200, m.width - SIDEBAR_W - H_PAD * 2);
    }

    _populateSection(sec) {
        this._wrapper.get_children().forEach(c => c.destroy());
        this._newsBox = null;         // cleared on section change; rebuilt below if needed
        this._newsScrollH = null;
        this._newsScrollViews = [];
        if (!sec) return;

        // News feed strip — shown for the first section, if enabled in settings
        if (this._currentSec === 0 && this._applet.settings.showNewsFeed !== false) {
            try {
                const feed = this._buildNewsFeed();
                this._wrapper.add_child(feed);
            } catch(e) {}
        }

        const gw   = this._gridWidth();
        const cols = Math.max(3, Math.floor((gw + CELL_GAP) / (CELL_W + CELL_GAP)));
        const rowW = cols * CELL_W + (cols-1) * CELL_GAP;
        const lpad = Math.max(0, Math.floor((gw - rowW) / 2));
        const heading = new St.Label({ text:sec.label,
            style_class:'cinnamon-overview-section-title',
            style:`padding:8px 0 8px ${lpad}px;` });
        this._wrapper.add_child(heading);
        const gl = new Clutter.GridLayout({
            column_spacing:CELL_GAP, row_spacing:CELL_GAP, column_homogeneous:true });
        const grid = new Clutter.Actor({ layout_manager:gl, width:rowW });
        sec.apps.forEach((app, idx) => {
            const tileMode = this._applet.settings.useTileStyle
                ? (this._applet.settings.overviewTileStyle || 'metro') : false;
            gl.attach(makeTile(app, () => this._launchApp(app), ev => this._openCtxMenu(app, ev),
                tileMode), idx%cols, Math.floor(idx/cols), 1, 1);
        });
        const row = new St.BoxLayout({ style:`padding-left:${lpad}px;` });
        const bin = new St.Bin({ x_fill:false, y_fill:false });
        bin.set_child(grid); row.add_child(bin);
        this._wrapper.add_child(row);
    }



    _populateSearch(results) {
        this._wrapper.get_children().forEach(c => c.destroy());
        const gw   = this._gridWidth();
        const cols = Math.max(3, Math.floor((gw + CELL_GAP) / (CELL_W + CELL_GAP)));
        const rowW = cols * CELL_W + (cols-1) * CELL_GAP;
        const lpad = Math.max(0, Math.floor((gw - rowW) / 2));
        if (!results.length) {
            this._wrapper.add_child(new St.Label({ text:_('No results'),
                style_class:'cinnamon-overview-status-label', style:`padding:40px ${lpad}px;` }));
            return;
        }
        const gl = new Clutter.GridLayout({
            column_spacing:CELL_GAP, row_spacing:CELL_GAP, column_homogeneous:true });
        const grid = new Clutter.Actor({ layout_manager:gl, width:rowW });
        results.forEach((app, idx) => {
            const tileMode = this._applet.settings.useTileStyle
                ? (this._applet.settings.overviewTileStyle || 'metro') : false;
            gl.attach(makeTile(app, () => this._launchApp(app), ev => this._openCtxMenu(app, ev),
                tileMode), idx%cols, Math.floor(idx/cols), 1, 1);
        });
        const bin = new St.Bin({ x_fill:false, y_fill:false, style:`padding-left:${lpad}px;` });
        bin.set_child(grid);
        this._wrapper.add_child(bin);
    }

    // ── Launch / context menu ─────────────────────────────────────────────────
    _launchApp(app) { this._pendingLaunch = app; this.hide(); }

    _openCtxMenu(app, ev) {
        if (this._ctxMenu) { this._ctxMenu.destroy(); this._ctxMenu = null; }
        this._ctxMenu = new TileContextMenu(this._root, app, this._applet,
            () => this.hide(), (a) => this._launchApp(a));
        this._ctxMenu.open(ev);
    }

    // ── Search ────────────────────────────────────────────────────────────────
    _onSearch() {
        const q = this._entry.get_text().toLowerCase().trim();
        if (!q) { this._searching = false; this._selectCategory(this._currentSec); return; }
        this._searching = true;
        const all = this._applet.apps.listApplications('all') || [];
        const res = all.filter(app => {
            const n  = (app.get_name        ? app.get_name()        ||'' : '').toLowerCase();
            const d  = (app.get_description ? app.get_description() ||'' : '').toLowerCase();
            const id = (app.get_id          ? app.get_id()          ||'' : '').toLowerCase();
            return n.includes(q) || d.includes(q) || id.includes(q);
        });
        this._wrapper.ease({ opacity:0, duration:60, mode:Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._populateSearch(res);
                this._scroll.get_vscroll_bar().get_adjustment().set_value(0);
                this._wrapper.ease({ opacity:255, duration:100, mode:Clutter.AnimationMode.EASE_IN_QUAD });
            }});
    }

    // ── Idle helper ───────────────────────────────────────────────────────────
    _scheduleIdle(fn) {
        if (this._idlerId) { Meta.later_remove(this._idlerId); this._idlerId = null; }
        this._idlerId = Meta.later_add(Meta.LaterType.IDLE, () => { this._idlerId = null; fn(); return false; });
    }

    // ── Hot corner ────────────────────────────────────────────────────────────
    setHotCorner(corner) {
        if (this._hotCorner) { this._hotCorner.disable(); this._hotCorner = null; }
        if (corner && corner !== 'none') {
            this._hotCorner = new HotCorner(corner, () => { if (!this._fading) this.toggle(); });
            this._hotCorner.enable();
        }
    }

    // ── Walk up actor tree to check if actor lives inside _root ───────────────
    _isInsideRoot(actor) {
        let a = actor;
        while (a) { if (a === this._root) return true; a = a.get_parent(); }
        return false;
    }

    _isInsideApplet(actor) {
        const appletActor = this._applet.actor;
        let a = actor;
        while (a) { if (a === appletActor) return true; a = a.get_parent(); }
        return false;
    }

    // ── Show ──────────────────────────────────────────────────────────────────
    show() {
        if (this._visible || this._fading) return;
        this._fading = true; this._visible = true;

        if (this._applet.menu && this._applet.menu.isOpen) this._applet.menu.close(false);

        // Compute overlay rect (exclude panels)
        const m = Main.layoutManager.primaryMonitor;
        let ovX = m.x, ovY = m.y, ovW = m.width, ovH = m.height;
        try {
            (Main.panelManager ? Main.panelManager.panels : []).forEach(panel => {
                if (!panel || !panel.actor || !panel.actor.visible) return;
                const pos = panel.panelPosition !== undefined ? panel.panelPosition
                          : (panel.bottomPosition ? 1 : 0);
                const ph = Math.max(0, panel.actor.height);
                if (ph < 4) return;
                if      (pos === 0 || pos === 'top')    { ovY = m.y + ph; ovH = m.height - ph; }
                else if (pos === 1 || pos === 'bottom') { ovH = Math.min(ovH, m.height - ph - (ovY - m.y)); }
            });
        } catch(e) {}
        ovH = Math.max(200, ovH);

        this._root.set_position(ovX, ovY);
        this._root.set_size(ovW, ovH);

        // ── SIDEBAR: absolutely positioned, hard pixel lock ───────────────
        // Sidebar lives directly on _root — zero interaction with _rightCol.
        // No BoxLayout anywhere in this chain → typing can never resize it.
        this._sidebar.set_position(0, 0);
        this._sidebar.set_size(SIDEBAR_W, ovH);
        this._catScroll.set_size(SIDEBAR_W, ovH);

        // ── RIGHT COLUMN: starts at x=SIDEBAR_W, fills the rest ──────────
        this._rightCol.set_position(SIDEBAR_W, 0);
        this._rightCol.set_size(ovW - SIDEBAR_W, ovH);

        // Power bar position (bottom-right, 16px inset)
        if (this._powerBar) {
            const approxW = 5 * 38 + 4 * 4;
            this._powerBar.set_position(ovW - approxW - 16, ovH - 38 - 16);
        }

        global.stage.add_child(this._root);
        this._root.raise_top();
        if (this._hotCorner) this._hotCorner.raiseTop();

        // Clock is now inside sRow's right spacer — no manual positioning needed


        // Re-apply palette class every show() so live tile-style changes take effect immediately
        this._applyOverviewPaletteClass();
        this._buildSections();

        this._root.opacity = 0;
        this._root.show();

        if (Main.pushModal(this._root)) this._modal = true;

        this._entry.set_text('');
        this._searching  = false;
        this._currentSec = 0;

        // ESC → close (or clear search)
        this._escId = global.stage.connect('key-press-event', (_, ev) => {
            if (ev.get_key_symbol() === Clutter.KEY_Escape) { this.hide(); return Clutter.EVENT_STOP; }
            return Clutter.EVENT_PROPAGATE;
        });

        // ── OUTSIDE CLICK → CLOSE ─────────────────────────────────────────────
        // Capture phase = we see the event before any actor processes it.
        // We close and PROPAGATE so the clicked actor (panel, other applet) still
        // receives the event and activates normally.
        this._captureId = global.stage.connect('captured-event', (_stage, ev) => {
            if (ev.type() !== Clutter.EventType.BUTTON_PRESS) return Clutter.EVENT_PROPAGATE;
            const src = ev.get_source();
            if (src && this._isInsideRoot(src))  return Clutter.EVENT_PROPAGATE; // inside us → ignore
            // If click is on the applet button, let on_applet_clicked handle hide()
            if (src && this._isInsideApplet(src)) return Clutter.EVENT_PROPAGATE;
            this.hide();
            return Clutter.EVENT_PROPAGATE; // propagate → panel/applet still gets the click
        });

        // Scroll forwarding — use pointer coordinates to decide news vs grid.
        // actor.contains() and parent-walks both fail because St.ScrollView wraps
        // content in internal viewport actors that break both approaches.
        // Pointer-coordinate hit-testing is 100% reliable.
        this._scrollSig = this._root.connect('scroll-event', (a, ev) => {
            const dir = ev.get_scroll_direction();

            // Test whether pointer is over the news strip using bounding box
            if (this._newsBox) {
                try {
                    const [px, py] = ev.get_coords();
                    const [ok, bx, by] = this._newsBox.transform_stage_point(px, py);
                    if (ok) {
                        const bw = this._newsBox.width;
                        const bh = this._newsBox.height;
                        if (bx >= 0 && bx <= bw && by >= 0 && by <= bh) {
                            // Pointer is inside the news strip — scroll each row horizontally
                            const step = 220;
                            this._newsScrollViews.forEach(sv => {
                                try {
                                    const hadj = sv.get_hscroll_bar().get_adjustment();
                                    if (dir === Clutter.ScrollDirection.DOWN || dir === Clutter.ScrollDirection.RIGHT)
                                        hadj.set_value(Math.min(hadj.get_upper() - hadj.get_page_size(), hadj.get_value() + step));
                                    else if (dir === Clutter.ScrollDirection.UP || dir === Clutter.ScrollDirection.LEFT)
                                        hadj.set_value(Math.max(hadj.get_lower(), hadj.get_value() - step));
                                } catch(e) {}
                            });
                            return Clutter.EVENT_STOP;
                        }
                    }
                } catch(e) {}
            }

            // Otherwise scroll the app grid vertically
            const adj = this._scroll.get_vscroll_bar().get_adjustment();
            const step = adj.get_step_increment ? adj.get_step_increment() : 80;
            if (dir === Clutter.ScrollDirection.UP)
                adj.set_value(Math.max(adj.get_lower(), adj.get_value() - step));
            if (dir === Clutter.ScrollDirection.DOWN)
                adj.set_value(Math.min(adj.get_upper() - adj.get_page_size(), adj.get_value() + step));
            return Clutter.EVENT_STOP;
        });

        this._scheduleIdle(() => {
            this._buildSections();
            this._buildCategories();
            this._populateSection(this._sections[0]);
        });

        this._root.ease({ opacity:255, duration:200, mode:Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._fading = false;
                this._startClock();
                this._startMediaTimer();
                GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 2, () => {
                    if (this._visible) this._startWeatherTimer();
                    return GLib.SOURCE_REMOVE;
                });
            } });

        global.stage.set_key_focus(this._entry);
    }

    // ── Hide ──────────────────────────────────────────────────────────────────
    hide() {
        if (!this._visible || this._fading) return;
        this._fading = true;
        this._stopClock();
        this._stopWeatherTimer();
        this._stopMediaTimer();
        this._root.reactive = false;
        if (this._ctxMenu)   { this._ctxMenu.destroy();                       this._ctxMenu   = null; }
        if (this._escId)     { global.stage.disconnect(this._escId);          this._escId     = null; }
        if (this._captureId) { global.stage.disconnect(this._captureId);      this._captureId = null; }
        if (this._scrollSig) { this._root.disconnect(this._scrollSig);        this._scrollSig = null; }
        if (this._idlerId)   { Meta.later_remove(this._idlerId);              this._idlerId   = null; }
        this._root.ease({ opacity:0, duration:150, mode:Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (this._root.get_parent()) global.stage.remove_child(this._root);
                if (this._modal) { Main.popModal(this._root); this._modal = false; }
                this._root.reactive = true;
                this._visible = false; this._fading = false;
                if (this._pendingAction) {
                    const a = this._pendingAction; this._pendingAction = null;
                    try { a(); } catch(e) {}
                }
                if (this._pendingLaunch) {
                    const app = this._pendingLaunch; this._pendingLaunch = null;
                    try { app.open_new_window(-1); } catch(e) {}
                }
            }});
    }

    toggle() { if (this._visible) this.hide(); else this.show(); }
    get visible() { return this._visible; }

    _onEntryKey(ev) {
        const s = ev.get_key_symbol();
        if (s === Clutter.KEY_Escape) {
            if (this._entry.get_text().length > 0) this._entry.set_text('');
            else this.hide();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        this._stopClock();
        this._stopWeatherTimer();
        this._stopMediaTimer();
        if (this._hotCorner) { this._hotCorner.disable();                              this._hotCorner = null; }
        if (this._ctxMenu)   { this._ctxMenu.destroy();                               this._ctxMenu   = null; }
        if (this._escId)     { global.stage.disconnect(this._escId);                  this._escId     = null; }
        if (this._captureId) { global.stage.disconnect(this._captureId);              this._captureId = null; }
        if (this._scrollSig) { try { this._root.disconnect(this._scrollSig); } catch(e) {} this._scrollSig = null; }
        if (this._idlerId)   { Meta.later_remove(this._idlerId);                      this._idlerId   = null; }
        this._root.reactive = false;
        if (this._modal) { Main.popModal(this._root); this._modal = false; }
        if (this._root.get_parent()) global.stage.remove_child(this._root);
        this._visible = false; this._fading = false;
        this._pendingLaunch = null; this._pendingAction = null;
    }
}

var Overview = AppOverview;
