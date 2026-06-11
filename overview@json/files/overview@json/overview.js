/**
 * overview.js v12 — Fullscreen app overview for Overview applet
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
 *    Overview applet: when OFF, hovering a category selects it.
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
// Google Font download disabled — causes startup network call
// _ensureGoogleFont();

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
    }

    // ── per-tile metro colour (only used when mode === 'metro') ───────────────
    let metroColor = null;
    let metroRgb   = null;
    if (tileMode === 'metro') {
        metroColor = getMetroColor(appName);
        // Convert hex to rgb so we can use rgba() opacity — matching the frosted style
        metroRgb = {
            r: parseInt(metroColor.slice(1,3), 16),
            g: parseInt(metroColor.slice(3,5), 16),
            b: parseInt(metroColor.slice(5,7), 16),
        };
    }

    // ── inline style: geometry + frosted-glass colour for metro tiles ─────────
    // metro: rgba at 0.72 opacity (metro tile opacity)
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
        // Invalidate section/category cache when favourites change
        try {
            const favs = imports.ui.appFavorites.getAppFavorites();
            this._favSig = favs.connect('changed', () => {
                this._sections = [];
                this._catsDirty = true;
                if (this._visible) {
                    this._buildSections();
                    this._buildCategories();
                    this._catsDirty = false;
                    this._populateSection(this._sections[0]);
                }
            });
        } catch(e) {}

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
            clip_to_allocation: true,
            // overlay_scrollbars:true causes ghost tile fragments on every
            // pointer-enter because the overlay track is painted over the stage
            // in the same repaint pass as the tile grid. Disable it entirely.
            overlay_scrollbars: false,
        });
        // NEVER/AUTOMATIC: sidebar scrolls vertically but shows no visible bar
        this._catScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._catScroll.set_clip_to_allocation(true);
        this._catScroll.set_overlay_scrollbars(false);
        this._catScroll.set_mouse_scrolling(true);
        // Hide the scrollbar track — sidebar scrolls silently
        try { this._catScroll.get_vscroll_bar().hide(); } catch(e) {}
        this._catScroll.add_actor(this._catBox);
        this._sidebar.add_child(this._catScroll);

        // ── RIGHT COLUMN — covers the full root, with left margin = SIDEBAR_W
        // Also added directly to _root so it never interacts with the sidebar.
        // Background is handled by _rightPane below; _rightCol is content-only.
        this._rightCol = new St.BoxLayout({
            vertical:true, y_expand:true,
            x_align:Clutter.ActorAlign.FILL, y_align:Clutter.ActorAlign.FILL,
        });
        // ── RIGHT PANE BACKGROUND — full-height background widget ────────────
        // Carries cinnamon-overview-right-pane (gradient, border-radius, etc).
        // Sits behind _sRow, _mediaRow, and _rightCol so all three share the
        // same themed background regardless of which layout they belong to.
        // Absolutely positioned in show() — never participates in any flow.
        this._rightPane = new St.Widget({
            style_class: 'cinnamon-overview-right-pane',
            reactive: false,
        });
        this._root.add_child(this._rightPane);
        this._root.add_child(this._rightCol);

        // ── Top row layout: [weather] [flex] [entry 440px fixed] [flex] [clock] ──
        // Absolutely positioned on _root — OUTSIDE _rightCol so dict panel
        // show/hide never causes a BoxLayout reflow that shifts search/clock.
        this._sRow = new St.BoxLayout({
            x_align: Clutter.ActorAlign.FILL,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding:20px 28px 20px 20px;',
        });
        this._root.add_child(this._sRow);

        // ── LEFT: Weather panel ───────────────────────────────────────────────
        this._weatherBox = this._buildWeatherWidget();
        this._sRow.add_child(this._weatherBox);

        // Flex gap — pushes entry to centre
        this._sRow.add_child(new St.Widget({ x_expand: true }));

        // ── CENTRE: Search entry (fixed 440px, never stretches) ───────────────
        this._entry = new St.Entry({
            style_class: 'cinnamon-overview-search',
            hint_text: _('Search…'),
            can_focus: true,
            x_expand: false,
            y_align: Clutter.ActorAlign.CENTER,
            // color + caret-color set here as fallback so text is always visible
            // regardless of which palette class (or none) is active
            style: 'width:440px;min-height:0;padding:3px 14px;',
        });
        this._sRow.add_child(this._entry);
        // Apply theme colors now that _entry exists (first call at line ~353 skips entry)
        this._applyOverviewPaletteClass();
        this._entry.clutter_text.connect('text-changed', () => this._onSearch());
        this._entry.clutter_text.connect('key-press-event', (_, ev) => this._onEntryKey(ev));
        // Ctrl+Shift+C copies search bar text to clipboard
        this._entry.clutter_text.connect('key-press-event', (_, ev) => {
            try {
                const sym  = ev.get_key_symbol();
                const mods = ev.get_state();
                const CTRL  = Clutter.ModifierType.CONTROL_MASK;
                const SHIFT = Clutter.ModifierType.SHIFT_MASK;
                if ((mods & CTRL) && (mods & SHIFT) && sym === Clutter.KEY_C) {
                    const txt = this._entry.get_text();
                    if (txt) St.Clipboard.get_default()
                        .set_text(St.ClipboardType.CLIPBOARD, txt);
                    return Clutter.EVENT_STOP;
                }
            } catch(e) {}
            return Clutter.EVENT_PROPAGATE;
        });

        // Flex gap — mirrors left gap so entry stays centred
        this._sRow.add_child(new St.Widget({ x_expand: true }));

        // ── RIGHT: Clock ──────────────────────────────────────────────────────
        this._clockBox = this._buildClockWidget();
        this._sRow.add_child(this._clockBox);



        // ── Media controls row — absolutely positioned on _root, below _sRow ──
        // Also outside _rightCol so dict panel reflow never shifts it.
        this._mediaRow = this._buildMediaBar();
        this._root.add_child(this._mediaRow);

        // ── Dictionary / AI panel — ABOVE icons, max-height with scrollbar ────
        this._dictPanel = this._buildDictPanel();
        this._dictScroll = new St.ScrollView({
            reactive: true,
            x_expand: true,
            y_expand: false,
            style: 'max-height:280px;',
        });
        this._dictScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._dictScroll.set_clip_to_allocation(true);
        this._dictScroll.set_mouse_scrolling(true);
        this._dictScroll.add_actor(this._dictPanel);
        this._dictScroll.hide();
        this._rightCol.add_child(this._dictScroll);
        this._dictSearchId   = 0;
        this._retryTimer     = null;  // ENOSPC retry timer — must be cancellable
        this._newsletterCache = null; // AI newsletter text — cached for session lifetime

        // Grid scroll area — below dict panel
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
        this._powerBar  = this._buildPowerBar();
        this._sysMonBar = this._buildSysMonBar();
        this._sysmonActive = false;
        this._sysmonTimer  = null;
        this._root.add_child(this._sysMonBar);
        this._root.add_child(this._powerBar);

    }

    // ── Apply built-in palette class to overview background ─────────────────
    // Two independent axes:
    //   1. overview-color-theme  → controls sidebar + right-pane background/text
    //      Classes on _root: overview-theme-light | overview-theme-dark | (none = cinnamon-css)
    //   2. overview-tile-style   → controls ONLY tile colours and style (unchanged)
    //      Classes on _root: overview-palette-light | overview-palette-dark
    _applyOverviewPaletteClass() {
        if (!this._root) return;

        // ── Color theme (sidebar + pane backgrounds) ──────────────────────
        this._root.remove_style_class_name('overview-theme-light');
        this._root.remove_style_class_name('overview-theme-dark');
        const colorTheme = this._applet.settings.overviewColorTheme || 'light';
        if (colorTheme === 'light') {
            this._root.add_style_class_name('overview-theme-light');
        } else if (colorTheme === 'dark') {
            this._root.add_style_class_name('overview-theme-dark');
        }
        // 'cinnamon-css': neither class set — desktop theme controls it entirely

        // ── Search entry: text color + background per theme ─────────────────
        // St.Entry's inner ClutterText ignores CSS 'color' in many Cinnamon builds,
        // so we set it directly. In cinnamon-css mode we strip inline style entirely
        // so the user's cinnamon.css .cinnamon-overview-search rule wins.
        if (this._entry) {
            try {
                if (colorTheme === 'cinnamon-css') {
                    // No inline style override — let cinnamon.css fully control it.
                    // Reset ClutterText to white (readable on most dark themes).
                    this._entry.set_style('width:440px;min-height:0;padding:3px 14px;');
                    this._entry.clutter_text.set_color(
                        new Clutter.Color({ red:255, green:255, blue:255, alpha:220 }));
                } else {
                    const isLight = (colorTheme === 'light');
                    // ClutterText color: dark on light bg, white on dark bg
                    const [r, g, b, a] = isLight ? [20, 20, 20, 220] : [255, 255, 255, 235];
                    this._entry.clutter_text.set_color(
                        new Clutter.Color({ red:r, green:g, blue:b, alpha:a }));
                    // Inline style: size + bg + border only (no color — ClutterText handles it)
                    const bg     = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.09)';
                    const border = isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.14)';
                    this._entry.set_style(
                        `width:440px;min-height:0;padding:3px 14px;` +
                        `background-color:${bg};border:${border};`);
                }
            } catch(e) {}
        }

        // ── Tile palette (tile colours only) ─────────────────────────────
        this._root.remove_style_class_name('overview-palette-light');
        this._root.remove_style_class_name('overview-palette-dark');
        const useTile = this._applet.settings.useTileStyle;
        const mode    = this._applet.settings.overviewTileStyle || 'light-palette';
        if (useTile && mode === 'light-palette') {
            this._root.add_style_class_name('overview-palette-light');
        } else if (useTile && mode === 'dark-palette') {
            this._root.add_style_class_name('overview-palette-dark');
        }
    }


    // ── Dictionary panel ──────────────────────────────────────────────────────
    // Shows Oxford-style definition, phonetic, example, AI summary, and image
    // for single-word queries. Fetches from Free Dictionary API + Anthropic API.

    // ── Copy-to-clipboard button ─────────────────────────────────────────────
    _mkCopyBtn(getTextFn) {
        const btn = new St.Button({
            reactive: true, can_focus: true, track_hover: true,
            style: 'padding:2px 7px;border-radius:6px;font-size:11px;'
                 + 'background-color:rgba(255,255,255,0.10);'
                 + 'border:1px solid rgba(255,255,255,0.18);',
        });
        try {
            const lbl = new St.Label({ text: '⎘ copy' });
            try { lbl.clutter_text.set_color(new Clutter.Color({red:255,green:255,blue:255,alpha:180})); } catch(e){}
            btn.set_child(lbl);
        } catch(e) { btn.set_label('⎘ copy'); }

        btn.connect('clicked', () => {
            try {
                const text = getTextFn();
                if (text) {
                    St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
                    // Brief visual feedback
                    const lbl2 = new St.Label({ text: '✓ copied' });
                    try { lbl2.clutter_text.set_color(new Clutter.Color({red:100,green:220,blue:130,alpha:220})); } catch(e){}
                    btn.set_child(lbl2);
                    // Use a WeakRef-style guard: only update if btn still has a parent
                    imports.gi.GLib.timeout_add(imports.gi.GLib.PRIORITY_DEFAULT, 1200, () => {
                        try {
                            if (!btn.get_parent()) return false;  // widget destroyed
                            const lbl3 = new St.Label({ text: '⎘ copy' });
                            try { lbl3.clutter_text.set_color(new Clutter.Color({red:255,green:255,blue:255,alpha:180})); } catch(e2){}
                            btn.set_child(lbl3);
                        } catch(e) {}
                        return false;
                    });
                }
            } catch(e) {}
            return Clutter.EVENT_STOP;
        });
        return btn;
    }

    _buildDictPanel() {
        const WHITE  = { red:255, green:255, blue:255, alpha:255 };
        const DIM    = { red:255, green:255, blue:255, alpha:178 };
        const DIMMER = { red:255, green:255, blue:255, alpha:115 };

        const wLabel = (style, dimness) => {
            const lbl = new St.Label({ style, x_expand: true });
            try {
                const col = dimness === 'dim'    ? new Clutter.Color(DIM)
                          : dimness === 'dimmer' ? new Clutter.Color(DIMMER)
                          :                        new Clutter.Color(WHITE);
                lbl.clutter_text.set_color(col);
            } catch(e) {}
            return lbl;
        };
        this._wLabel = wLabel; // reuse in updates

        // ── OUTER panel ───────────────────────────────────────────────────────
        const panel = new St.BoxLayout({
            vertical: true, x_expand: true,
            style_class: 'cinnamon-overview-dict-panel',
            style: 'margin:0 28px 8px 28px;padding:16px 20px 16px 20px;'
                 + 'background-color:rgba(13,82,142,0.62);'
                 + 'border-radius:14px;border:1px solid rgba(255,255,255,0.13);',
        });
        panel.hide();

        // ════════ OXFORD ROW ══════════════════════════════════════════════════
        this._oxRow = new St.BoxLayout({ vertical: false, x_expand: true,
            style: 'padding-bottom:10px;' });
        panel.add_child(this._oxRow);

        const oxText = new St.BoxLayout({ vertical: true, x_expand: true,
            style: 'padding-right:14px;' });
        this._oxRow.add_child(oxText);

        const wordRow = new St.BoxLayout({ vertical: false, x_expand: true,
            style: 'padding-bottom:3px;' });
        oxText.add_child(wordRow);

        this._dictWord = wLabel('font-size:22px;font-weight:bold;padding-right:12px;', null);
        wordRow.add_child(this._dictWord);

        this._dictPhonetic = wLabel('font-size:16px;font-style:italic;padding-top:3px;', 'dim');
        wordRow.add_child(this._dictPhonetic);

        // Spacer pushes copy button to far right regardless of word length
        wordRow.add_child(new St.Widget({ x_expand: true }));
        this._dictCopyBtn = this._mkCopyBtn(() => {
            try {
                const word = this._dictWord.get_text();
                const ipa  = this._dictPhonetic.get_text();
                const kids = this._meaningsBox ? this._meaningsBox.get_children() : [];
                const defs = kids.map(k => { try { return k.clutter_text.get_text(); } catch(e){ return ''; } })
                                  .filter(Boolean).join('\n');
                return [word, ipa, defs].filter(Boolean).join('\n');
            } catch(e) { return ''; }
        });
        wordRow.add_child(this._dictCopyBtn);

        // Dynamic meanings container — rebuilt on every lookup
        this._meaningsBox = new St.BoxLayout({
            vertical: true, x_expand: true,
        });
        oxText.add_child(this._meaningsBox);
        // Keep legacy refs null so stale code doesn't crash
        this._dictPos = null;
        this._dictDef = null;
        this._dictEx  = null;



        // Oxford thumbnail (right side)
        this._dictImg = new St.Widget({
            style: 'border-radius:10px;background-size:cover;background-position:center;',
            width: 120, height: 120, y_align: Clutter.ActorAlign.START,
        });
        this._dictImg.hide();
        this._oxRow.add_child(this._dictImg);

        // ════════ SEPARATOR ═══════════════════════════════════════════════════
        this._dictSep = new St.Widget({
            style: 'height:1px;background-color:rgba(255,255,255,0.18);'
                 + 'margin-bottom:12px;',
            x_expand: true,
        });
        panel.add_child(this._dictSep);

        // ════════ AI ROW ══════════════════════════════════════════════════════
        // Image floats LEFT for Q&A, RIGHT for word definitions.
        // We'll reorder children dynamically in _showAIResult().
        this._aiSection = new St.BoxLayout({ vertical: false, x_expand: true });
        panel.add_child(this._aiSection);

        // AI text column fills full width — no image in AI section
        this._aiImg    = null;  // image removed; text fills entire row
        this._aiTextCol = new St.BoxLayout({ vertical: true, x_expand: true });
        this._aiSection.add_child(this._aiTextCol);

        // AI header row: copy btn fixed first, then label
        const aiHeaderRow = new St.BoxLayout({ vertical: false, x_expand: true,
            style: 'padding-bottom:5px;' });
        this._aiTextCol.add_child(aiHeaderRow);

        this._aiLabel = wLabel(
            'font-size:11px;letter-spacing:1px;font-weight:bold;',
            'dimmer');
        try { this._aiLabel.set_text('✦  AI Summary'); } catch(e) {}
        aiHeaderRow.add_child(this._aiLabel);

        // Spacer + copy pinned to right edge
        aiHeaderRow.add_child(new St.Widget({ x_expand: true }));
        this._aiCopyBtn = this._mkCopyBtn(() => {
            try { return this._dictAI.clutter_text.get_text(); } catch(e) { return ''; }
        });
        aiHeaderRow.add_child(this._aiCopyBtn);

        // AI text — long paragraph, full wrap
        this._dictAI = wLabel('font-size:14px;line-height:1.55;', null);
        this._dictAI.clutter_text.set_line_wrap(true);
        this._dictAI.clutter_text.set_max_length(0);
        this._dictAI.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.NONE);
        this._dictAI.clutter_text.set_single_line_mode(false);
        this._aiTextCol.add_child(this._dictAI);



        return panel;
    }


    // ── Shared Soup GET helper ────────────────────────────────────────────────
    // Reuses a single Soup.Session for the lifetime of the overview (no leak).
    _getSoupSession() {
        if (!this._soupSession) {
            try   { this._soupSession = new Soup.Session(); this._soup3 = true; }
            catch(e) { try { this._soupSession = new Soup.SessionAsync(); this._soup3 = false; }
                       catch(e2) { return null; } }
            // 8-second hard timeout — use property, not method (works on both Soup 2 and 3)
            try { this._soupSession.timeout = 8; } catch(e) {}
        }
        return this._soupSession;
    }

    _httpGet(url, headers, onText, onErr) {
        try {
            const session = this._getSoupSession();
            if (!session) { if (onErr) onErr(); return; }
            const msg = Soup.Message.new('GET', url);
            if (headers) Object.keys(headers).forEach(k => msg.request_headers.append(k, headers[k]));
            if (this._soup3) {
                session.send_and_read_async(msg, imports.gi.GLib.PRIORITY_DEFAULT, null, (s, res) => {
                    try { onText(new TextDecoder('utf-8').decode(s.send_and_read_finish(res).get_data())); }
                    catch(e) { if (onErr) onErr(); }
                });
            } else {
                session.queue_message(msg, (_, m) => {
                    try { onText(m.response_body.data); }
                    catch(e) { if (onErr) onErr(); }
                });
            }
        } catch(e) { if (onErr) onErr(); }
    }

    // ── Shared Soup POST-JSON helper ──────────────────────────────────────────
    _httpPostJson(url, headers, bodyObj, onText, onErr) {
        try {
            const session = this._getSoupSession();
            if (!session) { if (onErr) onErr(); return; }
            const msg = Soup.Message.new('POST', url);
            msg.request_headers.append('Content-Type', 'application/json');
            if (headers) Object.keys(headers).forEach(k => msg.request_headers.append(k, headers[k]));
            const enc = new TextEncoder().encode(JSON.stringify(bodyObj));
            if (this._soup3) {
                msg.set_request_body_from_bytes('application/json',
                    imports.gi.GLib.Bytes.new(Array.from(enc)));
                session.send_and_read_async(msg, imports.gi.GLib.PRIORITY_DEFAULT, null, (s, res) => {
                    try { onText(new TextDecoder('utf-8').decode(s.send_and_read_finish(res).get_data())); }
                    catch(e) { if (onErr) onErr(); }
                });
            } else {
                if (msg.set_request) msg.set_request('application/json',
                    imports.gi.Soup.MemoryUse.COPY, enc);
                session.queue_message(msg, (_, m) => {
                    try { onText(m.response_body.data); }
                    catch(e) { if (onErr) onErr(); }
                });
            }
        } catch(e) { if (onErr) onErr(); }
    }

    // ── Fetch dictionary: Free Dictionary → Wiktionary fallback ─────────────
    _fetchDictionary(word, searchId) {
        const guard = () => this._dictSearchId === searchId;
        const idle  = (fn) => imports.gi.GLib.idle_add(
            imports.gi.GLib.PRIORITY_DEFAULT_IDLE,
            () => { try { fn(); } catch(e){} return false; });
        const clean = (s) => (s||'')
            .replace(/<[^>]+>/g,'')
            .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();

        // meanings = [{pos, defs:[{def,ex}]}]
        const showAndFetch = (w, phonetic, meanings) => {
            idle(() => { if (guard()) this._showDictResult(w, phonetic, meanings); });
            // Pass first definition for AI context
            const firstDef = (meanings && meanings[0] && meanings[0].defs && meanings[0].defs[0])
                ? meanings[0].defs[0].def : '';
            const aiOn = this._applet.settings.enableAiSummary !== false;
            if (aiOn) {
                this._fetchDictAI(w, firstDef, searchId);
            } else {
                idle(() => {
                    if (!guard()) return;
                    try {
                        if (this._aiSection) this._aiSection.hide();
                        if (this._dictSep)   this._dictSep.hide();
                    } catch(e){}
                });
            }
            this._fetchDictImage(w, searchId);
        };

        // 1. Free Dictionary API
        const tryFree = () => {
            const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/'
                + encodeURIComponent(word);
            this._httpGet(url, {'Accept':'application/json'}, (txt) => {
                if (!guard()) return;
                try {
                    const d = JSON.parse(txt);
                    if (!Array.isArray(d) || !d[0] || !d[0].meanings) { tryWikt(); return; }
                    const e  = d[0];
                    const m  = e.meanings[0];
                    const df = m && m.definitions && m.definitions[0];
                    // Pick best IPA: prefer entries with audio, fall back to any with text
                    const phonetics = e.phonetics || [];
                    let bestPh = (
                        (phonetics.find(p => p.text && p.audio) ||
                         phonetics.find(p => p.text) || {}).text ||
                        e.phonetic || ''
                    ).trim();
                    // If no phonetic from Free Dict, try Wiktionary wikitext
                    if (!bestPh) {
                        const wtUrl = 'https://en.wiktionary.org/w/api.php?action=parse'
                            + '&page=' + encodeURIComponent(word)
                            + '&prop=wikitext&format=json&origin=*';
                        // Fire IPA fetch in parallel — update phonetic label when ready
                        this._httpGet(wtUrl, {'Accept':'application/json'}, (wtTxt) => {
                            if (!guard()) return;
                            try {
                                const wt  = JSON.parse(wtTxt);
                                const raw = (wt && wt.parse && wt.parse.wikitext
                                    && wt.parse.wikitext['*']) || '';
                                const m   = raw.match(/\{\{IPA(?:\|en)?\|([^}|]+)/i);
                                const ipa = m ? m[1].replace(/^[|,\s]+/,'')
                                                    .replace(/[|,\s]+$/,'').trim() : '';
                                if (ipa) imports.gi.GLib.idle_add(
                                    imports.gi.GLib.PRIORITY_DEFAULT_IDLE, () => {
                                        if (!guard()) return false;
                                        try {
                                            const ph2 = ipa.startsWith('/') ? ipa
                                                : '/' + ipa + '/';
                                            this._dictPhonetic.set_text(ph2);
                                        } catch(e2){}
                                        return false;
                                    });
                            } catch(e){}
                        }, null);
                    }
                    // Build meanings array from ALL word classes
                    const meanings = (e.meanings || []).map(mean => ({
                        pos:  mean.partOfSpeech || '',
                        defs: (mean.definitions || []).slice(0, 3).map(d => ({
                            def: d.definition || '',
                            ex:  d.example    || '',
                        })),
                    })).filter(m => m.defs.length);
                    showAndFetch(e.word||word, bestPh, meanings);
                } catch(e2) { tryWikt(); }
            }, tryWikt);
        };

        // 2. Wiktionary fallback
        const tryWikt = () => {
            if (!guard()) return;
            const url = 'https://en.wiktionary.org/api/rest_v1/page/definition/'
                + encodeURIComponent(word);
            this._httpGet(url,
                {'Accept':'application/json','User-Agent':'overview-applet/1.0'},
                (txt) => {
                    if (!guard()) return;
                    try {
                        const d    = JSON.parse(txt);
                        const secs = d && (d.en || d[Object.keys(d)[0]]);
                        if (!secs||!secs.length) {
                            idle(() => { if (guard()) { if(this._dictScroll)this._dictScroll.hide(); this._dictPanel.hide(); } });
                            return;
                        }
                        const sec = secs[0];
                        const df  = sec.definitions && sec.definitions[0];
                        // Try to extract IPA from Wiktionary parse wikitext
                        const extractIPA = (wikiTxt) => {
                            // Match {{IPA|en|/ˌkɒnstɪˈtjuːʃ(ə)n/}} or {{IPA|/ipa/}}
                            const m = (wikiTxt||'').match(
                                /\{\{IPA(?:\|en)?\|([^}|]+)/i);
                            if (!m) return '';
                            return m[1].replace(/^[|,\s]+/, '')
                                       .replace(/[|,\s]+$/, '').trim();
                        };
                        const doShow = (ipa) => {
                            // Build meanings from all Wiktionary sections
                            const wiktMeanings = (secs || []).map(s => ({
                                pos:  s.partOfSpeech || '',
                                defs: (s.definitions || []).slice(0, 3).map(d => ({
                                    def: clean(d.definition || ''),
                                    ex:  d.examples && d.examples[0]
                                            ? clean(d.examples[0]) : '',
                                })).filter(d => d.def),
                            })).filter(m => m.defs.length);
                            showAndFetch(word, ipa, wiktMeanings);
                        };
                        // Fetch wikitext for IPA, then show
                        if (!guard()) return;
                        const wtUrl = 'https://en.wiktionary.org/w/api.php?action=parse'
                            + '&page=' + encodeURIComponent(word)
                            + '&prop=wikitext&format=json&origin=*';
                        this._httpGet(wtUrl, {'Accept':'application/json'}, (wtTxt) => {
                            if (!guard()) return;
                            try {
                                const wt  = JSON.parse(wtTxt);
                                const raw = wt && wt.parse && wt.parse.wikitext
                                    && wt.parse.wikitext['*'] || '';
                                doShow(extractIPA(raw));
                            } catch(e) { doShow(''); }
                        }, () => doShow(''));
                    } catch(e) {
                        idle(() => { if (guard()) { if(this._dictScroll)this._dictScroll.hide(); this._dictPanel.hide(); } });
                    }
                },
                () => { idle(() => { if (guard()) { if(this._dictScroll)this._dictScroll.hide(); this._dictPanel.hide(); } }); });
        };

        tryFree();
    }

    // ── Show dictionary result — multiple word classes ──────────────────────
    // meanings = [{ pos:'noun', defs:[{ def:'...', ex:'...' }, ...] }, ...]
    _showDictResult(word, phonetic, meanings) {
        try {
            // Restore word-definition layout (undo Q&A mode)
            if (this._oxRow)   this._oxRow.show();
            if (this._dictSep) {
                const aiOn = this._applet.settings.enableAiSummary !== false;
                this._dictSep.visible = aiOn;
            }
            if (this._aiTextCol) this._aiTextCol.set_style('');
            if (this._aiLabel) try { this._aiLabel.set_text('\u2734  AI Summary'); } catch(e){}

            // ── Word + IPA ─────────────────────────────────────────────────
            this._dictWord.set_text(word);
            const ph  = (phonetic || '').trim();
            const ipa = ph ? (ph.startsWith('/') ? ph : '/' + ph.replace(/\//g,'') + '/') : '';
            this._dictPhonetic.set_text(ipa);

            // ── Rebuild meanings blocks ────────────────────────────────────
            if (this._meaningsBox) {
                const _old = this._meaningsBox.get_children().slice();
                _old.forEach(ch => { try { ch.destroy(); } catch(e){} });

                const WHITE  = { red:255, green:255, blue:255, alpha:255 };
                const DIM    = { red:255, green:255, blue:255, alpha:178 };
                const DIMMER = { red:255, green:255, blue:255, alpha:115 };

                // Cache color objects once — avoids GObject alloc per label
                if (!this._colWhite)  this._colWhite  = new Clutter.Color(WHITE);
                if (!this._colDim)    this._colDim    = new Clutter.Color(DIM);
                if (!this._colDimmer) this._colDimmer = new Clutter.Color(DIMMER);
                const mkLabel = (text, style, dimness) => {
                    const lbl = new St.Label({ text, style, x_expand: true });
                    try {
                        const col = dimness === 'dim'    ? this._colDim
                                  : dimness === 'dimmer' ? this._colDimmer
                                  :                        this._colWhite;
                        lbl.clutter_text.set_color(col);
                    } catch(e) {}
                    lbl.clutter_text.set_line_wrap(true);
                    lbl.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.NONE);
                    lbl.clutter_text.set_single_line_mode(false);
                    lbl.clutter_text.set_max_length(0);
                    return lbl;
                };

                const posAbbr = {
                    noun:'n.', verb:'v.', adjective:'adj.', adverb:'adv.',
                    pronoun:'pron.', preposition:'prep.', conjunction:'conj.',
                    interjection:'interj.', determiner:'det.', exclamation:'excl.',
                };

                (meanings || []).forEach((m, mi) => {
                    // ── POS badge + thin rule ─────────────────────────────
                    const posRow = new St.BoxLayout({
                        vertical: false,
                        style: mi === 0 ? 'padding-bottom:4px;'
                                        : 'padding-top:10px;padding-bottom:4px;',
                    });
                    this._meaningsBox.add_child(posRow);

                    const abbr  = posAbbr[m.pos] || m.pos || '';
                    const posLbl = mkLabel(abbr,
                        'font-size:12px;font-style:italic;font-weight:bold;'
                        + 'padding-right:8px;min-width:32px;',
                        'dimmer');
                    posRow.add_child(posLbl);

                    // Thin rule after POS label
                    const rule = new St.Widget({
                        style: 'height:1px;background-color:rgba(255,255,255,0.15);',
                        x_expand: true,
                        y_align: Clutter.ActorAlign.CENTER,
                    });
                    posRow.add_child(rule);

                    // ── Definitions (up to 3 per class) ──────────────────
                    (m.defs || []).slice(0, 3).forEach((d, di) => {
                        // Numbered definition
                        const numTxt = (m.defs.length > 1)
                            ? (di + 1) + '.\u2002' + d.def   // en-space after number
                            : d.def;
                        const defLbl = mkLabel(numTxt,
                            'font-size:15px;line-height:1.4;padding-bottom:' + (d.ex ? '2px' : '5px') + ';',
                            null);
                        this._meaningsBox.add_child(defLbl);

                        // Example sentence
                        if (d.ex) {
                            const exLbl = mkLabel('\u201c' + d.ex + '\u201d',
                                'font-size:13px;font-style:italic;padding-bottom:4px;',
                                'dim');
                            this._meaningsBox.add_child(exLbl);
                        }
                    });
                });
            }

            // ── AI + image setup ───────────────────────────────────────────
            const aiOn = this._applet.settings.enableAiSummary !== false;
            if (this._aiSection) this._aiSection.visible = aiOn;
            if (this._aiLabel)   this._aiLabel.visible    = aiOn;
            if (aiOn) try { this._dictAI.set_text('Loading\u2026'); } catch(e){}

            if (this._dictImg) {
                this._dictImg.hide();
                this._dictImg.set_style('border-radius:10px;background-size:cover;background-position:center;');
            }
            if (this._dictScroll) this._dictScroll.show(); this._dictPanel.show();
        } catch(e) {}
    }

    // ── Pollinations helper — OpenAI-compatible POST API (current, not deprecated)
    // Endpoint: https://text.pollinations.ai/openai  (Chat Completions format)
    // Completely free, no key, no signup. Falls back to Wikidata if it fails.
    // ── Pollinations GET — current working endpoint, no POST body needed ──────
    // URL: https://text.pollinations.ai/{prompt}?model=mistral&private=true
    // Returns plain text. No API key. No POST. No GLib.Bytes size issues.
    // Timeout: 12 s via a GLib timer that fires onErr if nothing arrives.
    _pollinationsGet(prompt, onText, onErr) {
        const strip = (txt) => (txt || '').trim()
            .replace(/^(Sure[,!.]?\s*|Of course[,!.]?\s*|Certainly[,!.]?\s*|Here(?:\s+is|\s+are)[^.!?\n]*[.!?]\s*)/i, '')
            .trim();

        const isBad = (txt) => {
            if (!txt || txt.trim().length < 10) return true;
            const t = txt.trim();
            if (t.startsWith('<') || t.includes('<!DOCTYPE') || t.includes('<html')) return true;
            if (t.startsWith('{') && t.includes('"error"')) return true;
            if (/unavailable|unlimited|subscribe|upgrade|rate.?limit|api.?key|deprecated|legacy.?api|model.?not.?found|bad.?gateway|ENOSPC|no space/i.test(t)) return true;
            return false;
        };

        // Three independent URL patterns — tried in sequence on any failure.
        // Different paths hit different Pollinations backend servers.
        const enc = encodeURIComponent(prompt);
        const URLS = [
            // 1. Bare GET — simplest, fastest
            { method: 'GET',  url: 'https://text.pollinations.ai/' + enc },
            // 2. GET with seed — different cache key, may hit different node
            { method: 'GET',  url: 'https://text.pollinations.ai/' + enc + '?seed=42' },
            // 3. OpenAI-compatible POST — different endpoint path
            { method: 'POST', url: 'https://text.pollinations.ai/openai',
              body: { model: 'openai', messages: [{ role: 'user', content: prompt }], private: true } },
        ];

        let idx       = 0;
        let timedOut  = false;
        let responded = false;

        // 20 s total across all attempts
        const timerId = imports.gi.GLib.timeout_add(imports.gi.GLib.PRIORITY_DEFAULT, 20000, () => {
            if (!responded) { timedOut = true; try { if (onErr) onErr(); } catch(e){} }
            return false;
        });

        const done = (txt) => {
            responded = true;
            try { imports.gi.GLib.source_remove(timerId); } catch(e){}
            if (this._retryTimer) { imports.gi.GLib.source_remove(this._retryTimer); this._retryTimer = null; }
            onText(strip(txt));
        };

        const tryNext = () => {
            if (timedOut || idx >= URLS.length) {
                responded = true;
                try { imports.gi.GLib.source_remove(timerId); } catch(e){}
                // Pollinations exhausted — try Groq if user has a key
                const groqKey = (this._applet.settings.groqApiKey || '').trim();
                if (groqKey) {
                    this._groqGet(prompt, groqKey, onText, onErr);
                } else {
                    if (onErr) onErr();
                }
                return;
            }
            const { method, url, body } = URLS[idx++];

            const onTxt = (txt) => {
                if (timedOut) return;
                const cleaned = strip(txt);
                if (isBad(cleaned)) {
                    // Brief pause before next attempt to avoid hammering
                    if (this._retryTimer) imports.gi.GLib.source_remove(this._retryTimer);
                    this._retryTimer = imports.gi.GLib.timeout_add(
                        imports.gi.GLib.PRIORITY_DEFAULT, 800, () => {
                            this._retryTimer = null;
                            tryNext();
                            return false;
                        });
                } else {
                    done(cleaned);
                }
            };

            if (method === 'GET') {
                this._httpGet(url,
                    { 'Accept': 'text/plain', 'User-Agent': 'overview-applet/1.0' },
                    onTxt, () => { if (!timedOut) tryNext(); });
            } else {
                this._httpPostJson(url,
                    { 'User-Agent': 'overview-applet/1.0' },
                    body,
                    (txt) => {
                        if (timedOut) return;
                        try {
                            const r = JSON.parse(txt);
                            const content = r.choices && r.choices[0] &&
                                            r.choices[0].message && r.choices[0].message.content;
                            if (content && !isBad(content)) { done(strip(content)); }
                            else if (!timedOut) tryNext();
                        } catch(e) { if (!timedOut) tryNext(); }
                    },
                    () => { if (!timedOut) tryNext(); });
            }
        };

        tryNext();
    }

    // ── Groq fallback — fast, free tier, needs key from console.groq.com ──────
    // Model: llama-3.1-8b-instant — very fast, generous free limits.
    _groqGet(prompt, apiKey, onText, onErr) {
        const strip = (txt) => (txt || '').trim()
            .replace(/^(Sure[,!.]?\s*|Of course[,!.]?\s*|Certainly[,!.]?\s*|Here(?:\s+is|\s+are)[^.!?\n]*[.!?]\s*)/i, '')
            .trim();

        this._httpPostJson(
            'https://api.groq.com/openai/v1/chat/completions',
            { 'Authorization': 'Bearer ' + apiKey },
            {
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
                temperature: 0.7,
            },
            (txt) => {
                try {
                    const r       = JSON.parse(txt);
                    const content = r.choices && r.choices[0] &&
                                    r.choices[0].message && r.choices[0].message.content;
                    if (content && content.trim().length > 10) {
                        onText(strip(content));
                    } else {
                        if (onErr) onErr();
                    }
                } catch(e) { if (onErr) onErr(); }
            },
            onErr
        );
    }

    // ── Wikidata short description — fallback for SINGLE WORDS only ───────────
    _wikidataDesc(word, cb) {
        // Only call this with a single word — multi-word queries return nothing useful
        if (!word || word.indexOf(' ') !== -1) { cb('\u2014'); return; }
        const url = 'https://www.wikidata.org/w/api.php?action=wbsearchentities'
            + '&search=' + encodeURIComponent(word)
            + '&language=en&format=json&limit=1&origin=*';
        this._httpGet(url, { 'Accept': 'application/json' }, (txt) => {
            try {
                const d    = JSON.parse(txt);
                const item = d && d.search && d.search[0];
                const desc = (item && item.description) || '';
                cb(desc
                    ? word.charAt(0).toUpperCase() + word.slice(1) + ': ' + desc + '.'
                    : '\u2014');
            } catch(e) { cb('\u2014'); }
        }, () => cb('\u2014'));
    }

    // ── AI word summary ───────────────────────────────────────────────────────
    _fetchDictAI(word, definition, searchId) {
        const guard = () => this._dictSearchId === searchId;
        const idle  = (fn) => imports.gi.GLib.idle_add(imports.gi.GLib.PRIORITY_DEFAULT_IDLE,
            () => { try { fn(); } catch(e){} return false; });
        const setAI = (text) => idle(() => {
            if (!guard()) return;
            try { this._dictAI.set_text((text || '\u2014').trim()); } catch(e){}
        });

        const prompt = 'Write 4 vivid sentences about the English word "' + word + '".'
            + (definition ? ' It means: ' + definition + '.' : '')
            + ' Cover its core meaning, a real-world analogy, and one example sentence.'
            + ' Plain prose. No headings. No lists.';

        this._pollinationsGet(prompt,
            (txt) => { if (guard()) setAI(txt.length > 30 ? txt : '\u2014'); },
            ()    => { this._wikidataDesc(word, (d) => { if (guard()) setAI(d); }); }
        );
    }

    // ── AI free-form answer / prompt ──────────────────────────────────────────
    _fetchAIAnswer(input, searchId) {
        const guard = () => this._dictSearchId === searchId;
        const idle  = (fn) => imports.gi.GLib.idle_add(imports.gi.GLib.PRIORITY_DEFAULT_IDLE,
            () => { try { fn(); } catch(e){} return false; });

        // Show panel immediately, hide Oxford row
        idle(() => {
            if (!guard()) return;
            try {
                if (this._oxRow)     this._oxRow.hide();
                if (this._dictSep)   this._dictSep.hide();
                if (this._aiSection) this._aiSection.show();
                if (this._aiLabel)   this._aiLabel.set_text('\u2734  AI');
                if (this._dictAI)    this._dictAI.set_text('Thinking\u2026');
                if (this._dictScroll) this._dictScroll.show(); if (this._dictPanel) this._dictPanel.show();
            } catch(e){}
        });

        // Build a prompt that handles anything — questions, translations,
        // calculations, creative requests, definitions, etc.
        const prompt = input + '\n\nRespond in 3-5 sentences. Be direct and precise.'
            + ' Plain prose. No markdown. No bullet points. No headings.';

        this._pollinationsGet(prompt,
            (txt) => {
                if (!guard()) return;
                idle(() => {
                    if (!guard()) return;
                    try {
                        this._dictAI.set_text(txt.length > 10 ? txt : 'No response received.');
                    } catch(e){}
                });
            },
            () => {
                idle(() => {
                    if (!guard()) return;
                    try {
                        this._dictAI.set_text(
                            'AI service temporarily unavailable — try again in a moment.'
                        );
                    } catch(e){}
                });
            }
        );

        // Fetch Wikipedia image for the first content word of the input
        const imgWord = input.replace(/[?!.,]/g, '').split(/\s+/)
            .filter(w => w.length > 3 &&
                !/^(what|who|where|when|why|how|which|whose|is|are|was|were|do|does|did|can|could|would|should|will|has|have|had|a|an|the|of|in|on|at|to|for|and|but|or)$/i.test(w))[0]
            || input.split(/\s+/)[0];
        if (imgWord) this._fetchDictImage(imgWord, searchId);
    }


    // ── Wikipedia thumbnail ───────────────────────────────────────────────────
    _fetchDictImage(word, searchId) {
        const guard = () => this._dictSearchId === searchId;
        const url   = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
            + encodeURIComponent(word);
        this._httpGet(url,
            {'Accept':'application/json','User-Agent':'overview-applet/1.0'},
            (txt) => {
                if (!guard()) return;
                try {
                    const data   = JSON.parse(txt);
                    const imgUrl = data && data.thumbnail && data.thumbnail.source;
                    if (!imgUrl) return;
                    // Always use Oxford thumbnail (right of definition row)
                    const target = this._dictImg;
                    if (!target) return;
                    this._loadImageIntoActor(imgUrl, target, 120, 120, false, () => {
                        imports.gi.GLib.idle_add(imports.gi.GLib.PRIORITY_DEFAULT_IDLE,
                            () => {
                                if (!guard()) return false;
                                try { target.show(); } catch(e){}
                                return false;
                            });
                    });
                } catch(e){}
            }, null);
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
            style_class: 'overview-track-title',
            style: 'font-size:12px;font-weight:600;',
        });
        this._mediaTitle.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.END);
        this._mediaTitle.clutter_text.set_single_line_mode(true);

        this._mediaArtist = new St.Label({
            text: '',
            style_class: 'overview-track-artist',
            style: 'font-size:10px;margin-top:1px;',
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

        // ── Wedge (VLC-style) Cairo slider — 0% to 150% ─────────────────────
        // Width 0→VOL_W represents 0%→150%. 100% mark at x = VOL_W*(1/1.5).
        // Section >100% has red tint (amplification zone).
        const VOL_W   = 130;
        const VOL_H   = 8;
        const VOL_MAX = 1.5;
        this._VOL_W   = VOL_W;
        this._VOL_MAX = VOL_MAX;

        const Cairo = imports.cairo;
        this._volCanvas = new St.DrawingArea({
            width: VOL_W, height: VOL_H,
            reactive: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._volCanvas.connect('repaint', (area) => {
            const cr    = area.get_context();
            const vol   = this._isMuted ? 0 : Math.max(0, this._volLevel || 0);
            const w     = VOL_W, h = VOL_H;
            const r     = h / 2;          // corner radius
            const x100  = w * (1.0 / VOL_MAX);  // pixel position of 100%
            const xFill = Math.min(w, (vol / VOL_MAX) * w);

            cr.setOperator(Cairo.Operator.CLEAR); cr.paint();
            cr.setOperator(Cairo.Operator.OVER);

            // Rounded-rect helper
            const roundRect = (x, y, rw, rh, rd) => {
                cr.newPath();
                cr.arc(x + rd,      y + rd,      rd, Math.PI,       3*Math.PI/2);
                cr.arc(x + rw - rd, y + rd,      rd, 3*Math.PI/2,   0);
                cr.arc(x + rw - rd, y + rh - rd, rd, 0,             Math.PI/2);
                cr.arc(x + rd,      y + rh - rd, rd, Math.PI/2,     Math.PI);
                cr.closePath();
            };

            // ── 3-tier palette — mirrors overview-palette-light / -dark / user-css ──
            // Reads the same _root style class that _updateTilePalette() sets, so
            // the volume bar automatically matches whichever theme is active.
            // user-css = neither class present → same colours as dark (dark is default).
            // To override in cinnamon.css add rules for .cinnamon-overview-vol-* but
            // the safest full override is the .overview-palette-* descendant pattern.
            const isLight = this._root &&
                            this._root.has_style_class_name('overview-theme-light');

            //  palette:   track              rzone                 fill              rfill (amp)           sep               dot
            //  palette:   track              rzone                 fill              rfill (amp)           sep               dot (accent, distinct from fill)
            const DARK  = { track:[1,1,1,0.15], rzone:[1,0.20,0.20,0.20], fill:[1,1,1,0.75], rfill:[1,0.25,0.25,0.92], sep:[1,1,1,0.35], dot:[0.75,0.75,0.75,1.0] };   // grey accent dot
            const LIGHT = { track:[0,0,0,0.12], rzone:[0.78,0.1,0.1,0.18], fill:[0,0,0,0.55], rfill:[0.80,0.12,0.12,0.85], sep:[0,0,0,0.28], dot:[0.45,0.45,0.45,1.0] }; // grey accent dot
            const P = isLight ? LIGHT : DARK;

            const C_TRACK = P.track;
            const C_RZONE = P.rzone;
            const C_FILL  = P.fill;
            const C_RFILL = P.rfill;
            const C_SEP   = P.sep;
            const C_DOT   = P.dot;

            // Background track (full width)
            roundRect(0, 0, w, h, r);
            cr.setSourceRGBA(...C_TRACK);
            cr.fill();

            // Red zone tint on background (100%–150%)
            cr.rectangle(x100, 0, w - x100, h);
            cr.setSourceRGBA(...C_RZONE);
            cr.fill();

            // Fill bar
            if (xFill > 0) {
                // Normal fill up to min(xFill, x100)
                const xWhite = Math.min(xFill, x100);
                if (xWhite > 0) {
                    roundRect(0, 0, xWhite, h, r);
                    cr.setSourceRGBA(...C_FILL);
                    cr.fill();
                }
                // Amplification fill from x100 to xFill
                if (xFill > x100) {
                    cr.rectangle(x100, 0, xFill - x100, h);
                    cr.setSourceRGBA(...C_RFILL);
                    cr.fill();
                }
            }

            // 100% separator line
            cr.moveTo(x100, 1);
            cr.lineTo(x100, h - 1);
            cr.setSourceRGBA(...C_SEP);
            cr.setLineWidth(1.5);
            cr.stroke();

            // Playhead dot at fill position
            if (xFill > 0 && !this._isMuted) {
                cr.arc(xFill, h / 2, h / 2 + 1, 0, 2 * Math.PI);
                cr.setSourceRGBA(...C_DOT);
                cr.fill();
                // Inner shadow dot
                cr.arc(xFill, h / 2, h / 2 - 2, 0, 2 * Math.PI);
                cr.setSourceRGBA(0, 0, 0, 0.20);
                cr.fill();
            }

            cr.$dispose();
        });

        this._volRepaint = () => { try { this._volCanvas.queue_repaint(); } catch(e) {} };
        this._volSliderBg = this._volCanvas; // alias for compat

        this._volCanvas.connect('button-press-event', (a, ev) => {
            const [cx, cy] = ev.get_coords();
            const [ok, lx] = this._volCanvas.transform_stage_point(cx, cy);
            if (ok) this._setVolume(Math.max(0, Math.min(VOL_MAX, (lx / VOL_W) * VOL_MAX)));
            return Clutter.EVENT_STOP;
        });
        this._volCanvas.connect('button-release-event', () => Clutter.EVENT_STOP);
        this._volCanvas.connect('motion-event', (a, ev) => {
            if (ev.get_state() & Clutter.ModifierType.BUTTON1_MASK) {
                const [cx, cy] = ev.get_coords();
                const [ok, lx] = this._volCanvas.transform_stage_point(cx, cy);
                if (ok) this._setVolume(Math.max(0, Math.min(VOL_MAX, (lx / VOL_W) * VOL_MAX)));
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._volCanvas.connect('scroll-event', (a, ev) => {
            const dir = ev.get_scroll_direction();
            let delta = 0;
            if      (dir === Clutter.ScrollDirection.UP    || dir === Clutter.ScrollDirection.RIGHT) delta =  0.02;
            else if (dir === Clutter.ScrollDirection.DOWN  || dir === Clutter.ScrollDirection.LEFT)  delta = -0.02;
            if (delta !== 0) this._setVolume(Math.max(0, Math.min(VOL_MAX, this._volLevel + delta)));
            return Clutter.EVENT_STOP;
        });

        this._volLabel = new St.Label({
            text: '60%',
            style_class: 'overview-volume-pct',
            style: 'font-size:10px;min-width:34px;margin-left:6px;',
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
        bar.add_child(this._volCanvas);
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
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
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
    // vol can be > 1.0 (up to 1.5 = 150%) — pactl handles this natively
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
        // Read system volume via pactl — async subprocess, no main loop blocking.
        // Supports >100% (amplification): pactl reports e.g. "150%" natively.
        try {
            let [ok, pid, , outFd] = GLib.spawn_async_with_pipes(
                null,
                ['pactl', 'get-sink-volume', '@DEFAULT_SINK@'],
                null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null);
            if (!ok) { cb(this._volLevel); return; }

            const stream = new Gio.DataInputStream({
                base_stream: new Gio.UnixInputStream({ fd: outFd, close_fd: true })
            });
            stream.read_line_async(GLib.PRIORITY_LOW, null, (s, res) => {
                try {
                    const [line] = s.read_line_finish_utf8(res);
                    // e.g. "Volume: front-left: 98304 / 150% / ..."
                    const m = line ? line.match(/(\d+)%/) : null;
                    const pct = m ? parseInt(m[1]) : Math.round(this._volLevel * 100);
                    cb(pct / 100);  // returns >1.0 for amplified volumes
                } catch(e) { cb(this._volLevel); }
                try { GLib.spawn_close_pid(pid); } catch(e) {}
            });
        } catch(e) { cb(this._volLevel); }
    }

    _updateVolDisplay(vol, muted) {
        const pct = Math.round(vol * 100);
        try { if (this._volLabel) this._volLabel.set_text(muted ? 'mute' : (pct > 100 ? pct + '%!' : pct + '%')); } catch(e) {}
        try { if (this._volRepaint) this._volRepaint(); } catch(e) {}
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
            style_class: 'overview-weather-temp',
            style: 'font-size:20px;font-weight:700;',
        });
        this._weatherTemp.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.NONE);
        this._weatherTemp.clutter_text.set_single_line_mode(true);

        this._weatherCond = new St.Label({
            text: '',
            style_class: 'overview-weather-cond',
            style: 'font-size:11px;',
        });
        this._weatherCond.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.NONE);
        this._weatherCond.clutter_text.set_single_line_mode(true);

        this._weatherCity = new St.Label({
            text: '',
            style_class: 'overview-weather-city',
            style: 'font-size:10px;',
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
            const session = this._getSoupSession(); if (!session) return;
            const soup3 = this._soup3;

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
            const session = this._getSoupSession(); if (!session) return;
            const soup3 = this._soup3;

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
            reactive: true,
            track_hover: true,
            can_focus: true,
            x_expand: false,
            style: 'padding: 0 28px 0 0; min-width:260px; max-width:260px;',
        });

        this._clockLabel = new St.Label({
            text: '00:00',
            style_class: 'overview-clock',
            style: 'font-size:64px;font-weight:200;min-width:240px;',
            x_align: Clutter.ActorAlign.END,
        });
        // Prevent Pango from ellipsizing — root cause of dots/missing characters
        this._clockLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this._clockLabel.clutter_text.set_line_wrap(false);
        this._clockLabel.clutter_text.set_single_line_mode(true);

        this._dateLabel = new St.Label({
            text: '',
            style_class: 'overview-date',
            style: 'font-size:15px;font-weight:400;min-width:240px;margin-top:4px;',
            x_align: Clutter.ActorAlign.END,
        });
        this._dateLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this._dateLabel.clutter_text.set_line_wrap(false);
        this._dateLabel.clutter_text.set_single_line_mode(true);

        box.add_child(this._clockLabel);
        box.add_child(this._dateLabel);

        // Hover: subtle opacity shift so the user knows it's clickable
        box.connect('notify::hover', () => {
            box.set_opacity(box.hover ? 200 : 255);
        });

        // Click: launch calendar app, then close overview
        box.connect('button-release-event', (_, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                const Util = imports.misc.util;
                // Try common calendar apps in order of preference
                const cmds = [
                    'gnome-calendar', 'gnome-todo', 'evolution --component=calendar',
                    'thunderbird -calendar', 'orage', 'osmo',
                ];
                let launched = false;
                for (const cmd of cmds) {
                    try {
                        const bin = cmd.split(' ')[0];
                        if (GLib.find_program_in_path(bin)) {
                            this._pendingAction = () => { try { Util.spawnCommandLine(cmd); } catch(e) {} };
                            launched = true;
                            break;
                        }
                    } catch(e) {}
                }
                if (!launched) {
                    // Fallback: xdg-open on the current date in ical format
                    this._pendingAction = () => {
                        try { Util.spawnCommandLine('xdg-open https://calendar.google.com'); } catch(e) {}
                    };
                }
                this.hide();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

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


    // ── AI Newsletter ─────────────────────────────────────────────────────────
    // Shown at top of Favourites view. Fetches headlines from 3 RSS feeds,
    // sends them to AI for a structured summary, renders category pills.
    // Refreshes once per applet session (cached in this._newsletterCache).

    _buildNewsletterPanel() {
        // Colours and label factory cached on instance so async callbacks
        // always have live references regardless of rebuild cycles.
        if (!this._nlWHITE) {
            this._nlWHITE = new Clutter.Color({ red:255, green:255, blue:255, alpha:255 });
            this._nlDIM   = new Clutter.Color({ red:255, green:255, blue:255, alpha:160 });
            this._nlBREAK = new Clutter.Color({ red:255, green:80,  blue:80,  alpha:255 });
            this._nlGOLD  = new Clutter.Color({ red:255, green:210, blue:80,  alpha:255 });
            this._nlMkLbl = (text, style, col) => {
                // Build rgba string from Clutter.Color so inline style= forces the colour.
                // Inline style= beats both CSS cascade and theme injection — most reliable.
                const c2 = col || this._nlWHITE;
                const rgba = 'rgba(' + c2.red + ',' + c2.green + ',' + c2.blue + ','
                           + (c2.alpha / 255).toFixed(2) + ')';
                const l = new St.Label({
                    text: text || '',
                    style: (style || '') + 'color:' + rgba + ';',
                    x_expand: true,
                });
                // Belt-and-suspenders: also set via ClutterText API
                try { l.clutter_text.set_color(c2); } catch(e) {}
                l.clutter_text.set_line_wrap(true);
                l.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.NONE);
                l.clutter_text.set_single_line_mode(false);
                l.clutter_text.set_max_length(0);
                return l;
            };
        }
        const WHITE = this._nlWHITE;
        const DIM   = this._nlDIM;
        const BREAK = this._nlBREAK;
        const GOLD  = this._nlGOLD;
        const mkLbl = this._nlMkLbl;

        // ── Outer panel ───────────────────────────────────────────────────────
        const panel = new St.BoxLayout({
            vertical: true, x_expand: true,
            style: 'background-color:rgba(88,86,214,0.55);'
                 + 'border-radius:14px;border:1px solid rgba(255,255,255,0.13);'
                 + 'margin:0 28px 10px 28px;padding:12px 18px 14px 18px;',
        });

        // ── Header row ────────────────────────────────────────────────────────
        const hRow = new St.BoxLayout({ vertical: false, x_expand: true,
            style: 'padding-bottom:8px;' });
        panel.add_child(hRow);

        const hLbl = mkLbl('📰  Newsletter', 'font-size:13px;font-weight:bold;letter-spacing:1px;', GOLD);
        hLbl.clutter_text.set_line_wrap(false);
        hLbl.x_expand = true;
        hRow.add_child(hLbl);

        // Refresh button
        const refreshBtn = new St.Button({
            reactive: true, can_focus: true, track_hover: true,
            style: 'padding:2px 8px;border-radius:6px;font-size:11px;'
                 + 'background-color:rgba(255,255,255,0.10);'
                 + 'border:1px solid rgba(255,255,255,0.18);',
        });
        const refreshLbl = new St.Label({
            text: '↻',
            style: 'color:rgba(255,255,255,0.63);',
        });
        try { refreshLbl.clutter_text.set_color(DIM); } catch(e) {}
        refreshBtn.set_child(refreshLbl);
        // ── Thin separator ────────────────────────────────────────────────────
        panel.add_child(new St.Widget({
            style: 'height:1px;background-color:rgba(255,255,255,0.15);margin-bottom:10px;',
            x_expand: true,
        }));

        // ── Content box — direct child of panel, no inner scroll ───────────────
        // The outer panel is placed inside a St.ScrollView in _populateSection.
        this._newsletterContentBox = new St.BoxLayout({ vertical: true, x_expand: true });
        panel.add_child(this._newsletterContentBox);

        // Wire refresh button now that contentBox exists
        refreshBtn.connect('clicked', () => {
            try {
                // Show "Loading…" immediately so user sees feedback
                this._newsletterContentBox.get_children().slice()
                    .forEach(ch => { try { ch.destroy(); } catch(e){} });
                this._newsletterContentBox.add_child(
                    mkLbl('Refreshing…', 'font-size:13px;font-style:italic;', DIM));
                this._newsletterCache = null;
                this._refreshNewsletter(this._newsletterContentBox);
            } catch(e) {}
            return Clutter.EVENT_STOP;
        });
        hRow.add_child(refreshBtn);

        // Show cached or fetch fresh
        if (this._newsletterCache) {
            this._renderNewsletter(this._newsletterContentBox, this._newsletterCache, this._newsletterHeadlines || []);
        } else {
            this._newsletterContentBox.add_child(
                this._nlMkLbl('Fetching today\'s headlines…',
                    'font-size:13px;font-style:italic;', this._nlDIM));
            // Actual fetch is deferred in _populateSection — panel shows loading text only
        }

        return panel;
    }

    // ── Fetch headlines and generate AI summary ───────────────────────────────
    _refreshNewsletter(contentBox) {
        // RSS feeds to sample: BBC (world), Reuters Science
        // Multiple feeds — if one is geo-blocked or slow, others still provide headlines
        const FEEDS = [
            'https://feeds.bbci.co.uk/news/world/rss.xml',
            'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
            'https://rss.dw.com/rdf/rss-en-top-news',
            'https://www.france24.com/en/top-stories/rss',
            'https://feeds.skynews.com/feeds/rss/world.xml',
        ];

        let done = 0;
        const headlines = [];
        this._newsletterHeadlines = []; // stored for extended list in render

        const onAllDone = () => {
            if (headlines.length === 0) {
                imports.gi.GLib.idle_add(imports.gi.GLib.PRIORITY_DEFAULT_IDLE, () => {
                    try {
                        contentBox.get_children().slice().forEach(c => { try{c.destroy();}catch(e){} });
                        contentBox.add_child(this._nlMkLbl('Could not fetch headlines. Check your connection.',
                            'font-size:13px;', this._nlDIM));
                    } catch(e) {}
                    return false;
                });
                return;
            }

            // Store all collected headlines for the extended scroll list
            this._newsletterHeadlines = headlines.slice();
            // Build a compact prompt from up to 15 headlines
            const sample = headlines.slice(0, 15);
            const prompt =
                'You are a news editor. Here are today\'s headlines:\n'
                + sample.map((h, i) => `${i+1}. ${h}`).join('\n')
                + '\n\nWrite a brief Newsletter with exactly these sections, each on its own line:\n'
                + '🔴 BREAKING: [one breaking or urgent news item, if any — else skip this line]\n'
                + '🌍 WORLD: [2-sentence summary of top world news]\n'
                + '🔬 SCIENCE: [1-sentence science highlight]\n'
                + '📊 OTHER: [1-sentence other notable story]\n'
                + 'Keep each section under 40 words. No extra commentary.';

            this._pollinationsGet(prompt,
                (txt) => {
                    this._newsletterCache = txt;
                    imports.gi.GLib.idle_add(imports.gi.GLib.PRIORITY_DEFAULT_IDLE, () => {
                        try {
                            contentBox.get_children().slice().forEach(c => { try{c.destroy();}catch(e){} });
                            this._renderNewsletter(contentBox, txt, this._newsletterHeadlines);
                        } catch(e) {}
                        return false;
                    });
                },
                () => {
                    imports.gi.GLib.idle_add(imports.gi.GLib.PRIORITY_DEFAULT_IDLE, () => {
                        try {
                            contentBox.get_children().slice().forEach(c => { try{c.destroy();}catch(e){} });
                            contentBox.add_child(this._nlMkLbl('AI summary unavailable — showing raw headlines:',
                                'font-size:12px;font-style:italic;padding-bottom:4px;', this._nlDIM));
                            headlines.slice(0, 5).forEach(h => {
                                contentBox.add_child(this._nlMkLbl('• ' + h, 'font-size:13px;padding-bottom:2px;', this._nlWHITE));
                            });
                        } catch(e) {}
                        return false;
                    });
                }
            );
        };

        FEEDS.forEach(feedUrl => {
            this._httpGet(feedUrl, {'Accept':'application/rss+xml,application/xml,text/xml',
                'User-Agent':'overview-applet/1.0'},
                (xml) => {
                    try {
                        // Extract <title> tags (skip first — it's the feed title)
                        const titles = [];
                        const re = /<title(?:\s[^>]*)?>([^<]{10,200})<\/title>/gi;
                        let m; let skip = true;
                        while ((m = re.exec(xml)) !== null) {
                            if (skip) { skip = false; continue; }
                            const t = m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<')
                                         .replace(/&gt;/g,'>').replace(/&#\d+;/g,'').trim();
                            if (t.length > 10) titles.push(t);
                            if (titles.length >= 5) break;
                        }
                        headlines.push(...titles);
                    } catch(e) {}
                    if (++done === FEEDS.length) onAllDone();
                },
                () => { if (++done === FEEDS.length) onAllDone(); }
            );
        });
    }

    // ── Render the AI text + extended scrollable headlines list ─────────────
    _renderNewsletter(contentBox, text, headlines) {
        const mkLbl = this._nlMkLbl;
        const WHITE = this._nlWHITE;
        const DIM   = this._nlDIM;
        const BREAK = this._nlBREAK;

        // Detect and reject garbage responses: JSON bleed, raw prompts, etc.
        const t = (text || '').trim();
        const isGarbage = t.startsWith('{') || t.startsWith('[')
            || t.includes('"role"') || t.includes('"reasoning"')
            || t.includes('write a brief Newsletter')
            || t.includes('Provide exactly these sections')
            || t.length < 20;
        if (isGarbage) {
            // Show raw headlines as fallback instead of garbage
            if (headlines && headlines.length) {
                contentBox.add_child(mkLbl('📰  Latest headlines', 'font-size:12px;font-weight:bold;padding-bottom:6px;', WHITE));
                headlines.slice(0, 8).forEach(h => {
                    contentBox.add_child(mkLbl('• ' + h, 'font-size:12px;padding-bottom:3px;', DIM));
                });
            } else {
                contentBox.add_child(mkLbl('Newsletter unavailable — try refreshing.', 'font-size:12px;font-style:italic;', DIM));
            }
            // Clear cache so next open retries
            this._newsletterCache = null;
            return;
        }

        // ── AI summary section ────────────────────────────────────────────────
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach(line => {
            if (/^🔴|^BREAKING/i.test(line)) {
                contentBox.add_child(mkLbl(line,
                    'font-size:13px;font-weight:bold;padding-bottom:5px;', BREAK));
            } else if (/^[🌍🔬📊💡🏛️⚡🌱🎭]/.test(line) || /^[A-Z]{3,}:/.test(line)) {
                contentBox.add_child(mkLbl(line,
                    'font-size:13px;padding-bottom:5px;', WHITE));
            } else {
                contentBox.add_child(mkLbl(line,
                    'font-size:12px;padding-bottom:3px;', DIM));
            }
        });

        // ── Extended headlines — visible by scrolling down ────────────────────
        if (headlines && headlines.length > 0) {
            // Separator with "scroll for more" hint
            contentBox.add_child(new St.Widget({
                style: 'height:1px;background-color:rgba(13,82,142,0.12);'
                     + 'margin-top:8px;margin-bottom:6px;',
                x_expand: true,
            }));
            contentBox.add_child(mkLbl('▾  Latest headlines',
                'font-size:11px;letter-spacing:1px;font-weight:bold;padding-bottom:6px;',
                this._nlGOLD));

            headlines.forEach((h, i) => {
                contentBox.add_child(mkLbl((i + 1) + '.  ' + h,
                    'font-size:12px;padding-bottom:4px;', WHITE));
            });
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
                  rss: 'https://www.france24.com/en/top-stories/rss',
                  url: 'https://www.france24.com/en/',           color: '#003F87' },
                // CNN: media:thumbnail
                { name: 'CNN',
                  rss: 'http://rss.cnn.com/rss/edition.rss',
                  url: 'https://www.cnn.com',                    color: '#CC0001' },
                // Guardian: media:thumbnail
                { name: 'The Guardian',
                  rss: 'https://www.theguardian.com/world/rss',
                  url: 'https://www.theguardian.com',            color: '#052962' },
                // Reuters: RSS and direct CDN both block bots.
                // Use their public Cloudinary thumbnail which allows hotlinking.
                { name: 'Reuters',
                  ogOnly: true,
                  staticImg: 'https://cloudfront-us-east-2.images.arcpublishing.com/reuters/LYNXMPEF8I0LJ.jpg',
                  url: 'https://www.reuters.com',                color: '#FF8000' },
                // DW: enclosure type=image/jpeg — works, but use mrss for thumbnails
                // DW: RSS feed includes <enclosure type="image/jpeg"> — parse directly
                { name: 'DW News',
                  rss: 'https://rss.dw.com/rdf/rss-en-top-news',
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
                { name: 'Deadline',
                  rss: 'https://deadline.com/feed/',
                  url: 'https://deadline.com',                   color: '#1a1a2e' },
                // The Playlist: indie/arthouse film coverage — WordPress media:thumbnail
                { name: 'The Playlist',
                  rss: 'https://theplaylist.net/feed/',
                  url: 'https://theplaylist.net',                color: '#1a3a5c' },
                // Variety Film: dedicated film section — WordPress media:thumbnail
                { name: 'Variety',
                  rss: 'https://variety.com/v/film/feed/',
                  url: 'https://variety.com/v/film/',            color: '#7B0A14' },
                // Hollywood Reporter: industry news with vivid stills
                { name: 'Deadline',
                  rss: 'https://deadline.com/feed/',
                  url: 'https://deadline.com',                   color: '#2c2c54' },
                // Roger Ebert: reviews with movie stills — WordPress enclosure
                { name: 'RogerEbert.com',
                  rss: 'https://www.rogerebert.com/feed',
                  url: 'https://www.rogerebert.com',             color: '#8B0000' },
                // Science & Tech — proven working feeds below
                // NatGeo photo of the day: media:content
                { name: 'Nat Geo',
                  rss: null,
                  url: 'https://www.nationalgeographic.com/animals',  color: '#B8860B',
                  ogOnly: true },
                // NASA: enclosure url=...jpg
                { name: 'NASA APOD',
                  rss: 'https://apod.nasa.gov/apod.rss',
                  url: 'https://apod.nasa.gov/apod/',            color: '#0B3D91' },
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

    // ── Recently used files strip ─────────────────────────────────────────────
    _buildRecentFilesRow() {
        const count   = Math.max(3, Math.min(20,
                            this._applet.settings.recentFilesCount || 10));
        const GioFile = imports.gi.Gio.File;
        let items = [];
        try {
            const bf       = new GLib.BookmarkFile();
            const xbelPath = GLib.build_filenamev([
                GLib.get_user_data_dir(), 'recently-used.xbel']);

            bf.load_from_file(xbelPath);
            const allUris = bf.get_uris();

            items = allUris
                .map(uri => {
                    try {
                        if (!uri.startsWith('file://')) {
                            return null;
                        }
                        const f = GioFile.new_for_uri(uri);
                        let name = '', gicon = null;
                        try {
                            const info = f.query_info(
                                'standard::display-name,standard::icon',
                                imports.gi.Gio.FileQueryInfoFlags.NONE, null);
                            name  = info.get_display_name() || '';
                            gicon = info.get_icon() || null;
                        } catch(e) {
                            return null;
                        }
                        let modified = 0;
                        try {
                            const raw = (typeof bf.get_modified_date_time === 'function')
                                ? bf.get_modified_date_time(uri)
                                : bf.get_modified(uri);
                            modified = (raw && typeof raw.to_unix === 'function')
                                ? raw.to_unix()
                                : (typeof raw === 'number' ? raw : 0);
                        } catch(e) {
                        }
                        if (!name) name = f.get_basename() || '';
                        return { uri, modified, name, gicon };
                    } catch(e) {
                        return null;
                    }
                })
                .filter(Boolean)
                .sort((a, b) => b.modified - a.modified)
                .slice(0, count);
        } catch(e) {
            global.logError('overview: BookmarkFile outer: ' + e);
        }

        const CARD_W = 88;
        const CARD_H = 84;
        const GAP    = 8;

        // ── Outer container ───────────────────────────────────────────────────
        const outer = new St.BoxLayout({ vertical: true, x_expand: true });

        const hdr = new St.Label({
            text: 'RECENT FILES',
            style_class: 'cinnamon-overview-news-row-label',
            style: 'padding:14px 0 6px 4px; letter-spacing:1.5px;',
        });
        outer.add_child(hdr);

        if (items.length === 0) {
            const empty = new St.Label({
                text: 'No recent files found.',
                style: 'font-size:12px;color:rgba(255,255,255,0.35);padding:8px 4px 16px 4px;',
            });
            outer.add_child(empty);
            return outer;
        }

        // ── Horizontally scrollable strip ────────────────────────────────────
        const sv = new St.ScrollView({
            x_expand: true, y_expand: false,
            clip_to_allocation: true,
            style: 'padding-bottom:8px;',
        });
        sv.set_policy(St.PolicyType.AUTOMATIC, St.PolicyType.NEVER);
        sv.set_overlay_scrollbars(true);
        sv.set_mouse_scrolling(true);

        const gridWrap = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style: `spacing:${GAP}px; padding:4px 4px 8px 4px;`,
        });

        items.forEach(item => {
            // ── Card ──────────────────────────────────────────────────────────
            const card = new St.BoxLayout({
                vertical: true,
                reactive: true,
                track_hover: true,
                can_focus: true,
                style: `width:${CARD_W}px; padding:6px 4px 4px 4px;border-radius:8px;`,
                style_class: 'cinnamon-overview-recent-card',
            });

            // ── Icon ──────────────────────────────────────────────────────────
            const icon = new St.Icon({
                gicon:     item.gicon || null,
                icon_name: item.gicon ? null : 'text-x-generic',
                icon_size: 36,
                x_align:   Clutter.ActorAlign.CENTER,
                style:     'margin-bottom:4px;',
            });
            card.add_child(icon);

            // ── Filename label ────────────────────────────────────────────────
            const lbl = new St.Label({
                text:    item.name || '?',
                x_align: Clutter.ActorAlign.CENTER,
                style:   'font-size:10px;text-align:center;',
            });
            lbl.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.END);
            lbl.clutter_text.set_single_line_mode(true);
            card.add_child(lbl);

            // ── Hover feedback ────────────────────────────────────────────────
            card.connect('notify::hover', () => {
                card.style = `width:${CARD_W}px; padding:6px 4px 4px 4px;border-radius:8px;` +
                    (card.hover ? 'background-color:rgba(255,255,255,0.10);' : '');
            });

            // ── Tooltip ───────────────────────────────────────────────────────
            const uri  = item.uri;
            const path = uri.startsWith('file://')
                ? decodeURIComponent(uri.slice(7)) : uri;
            card.connect('enter-event', () => {
                if (!this._recentTooltip) {
                    this._recentTooltip = new St.Label({
                        style_class: 'tooltip-label',
                        style: 'font-size:11px;padding:4px 8px;border-radius:5px;' +
                               'background-color:rgba(0,0,0,0.75);color:#fff;',
                    });
                    this._root.add_child(this._recentTooltip);
                }
                this._recentTooltip.set_text(path);
                this._recentTooltip.show();
            });
            card.connect('leave-event', () => {
                if (this._recentTooltip) this._recentTooltip.hide();
            });

            // ── Click: open file then close overview ──────────────────────────
            card.connect('button-release-event', (_, ev) => {
                if (ev.get_button() !== Clutter.BUTTON_PRIMARY)
                    return Clutter.EVENT_PROPAGATE;
                this._pendingAction = () => {
                    try {
                        imports.gi.Gio.AppInfo.launch_default_for_uri(uri, null);
                    } catch(e) {
                        try {
                            imports.misc.util.spawnCommandLine(
                                `xdg-open "${path.replace(/"/g, '\\"')}"`);
                        } catch(e2) {}
                    }
                };
                this.hide();
                return Clutter.EVENT_STOP;
            });

            gridWrap.add_child(card);
        });

        sv.add_actor(gridWrap);
        outer.add_child(sv);
        return outer;
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

        let _newsSlotCounter = 0;   // global index across all rows — gives each card a unique tmp slot
        for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
            const sources = allRows[rowIdx] || [];
            const rowLabel = ROW_LABELS[rowIdx] || ('ROW ' + (rowIdx + 1));

            // Row header label — themable via .cinnamon-overview-news-row-label in cinnamon.css
            outerBox.add_child(new St.Label({
                text: rowLabel,
                style_class: 'cinnamon-overview-news-row-label',
                style: 'padding: 10px ' + H_PAD + 'px 4px ' + H_PAD + 'px;',
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
            const _newsSlot = _newsSlotCounter++;   // unique slot for this card's thumbnail
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
                origStyle._newsSlot = _newsSlot;
                this._loadImageIntoActor(imgUrl, thumb, CARD_W, CARD_H, false, origStyle);
            };

            const cacheKey = src.rss || src.url;

            if (src.staticImg) {
                if (!applyCache(this._rssCache[cacheKey])) {
                    headlineLabel.set_text('');
                    fetchAndCacheImage(src.staticImg, cacheKey, '');
                }
            } else if (src.ogOnly || !src.rss) {
                if (!applyCache(this._rssCache[cacheKey])) {
                    const _ogCb = (path) => {
                        this._imgCache[cardSrcUrl] = path;
                        cacheAndApply(cacheKey, '', path);
                    };
                    _ogCb._newsSlot = _newsSlot;
                    this._loadImageIntoActor(cardSrcUrl, thumb, CARD_W, CARD_H, false, _ogCb);
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
                            const _fbCb = (path) => { cacheAndApply(cacheKey, headline, path); };
                            _fbCb._newsSlot = _newsSlot;
                            this._loadImageIntoActor(cardSrcUrl, thumb, CARD_W, CARD_H, false, _fbCb);
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
            const session = this._getSoupSession();
            if (!session) return;
            try {
                // shared session
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
            // enclosure with image mime type — both attribute orderings (DW puts url first)
            /enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"'\s>]+)/i,
            /enclosure[^>]+url=["']([^"'\s>]+)["'][^>]+type=["']image[^"']*["']/i,
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
    // Temp files use a fixed rotating pool of THUMB_POOL_SIZE slots.
    // This caps the number of open /tmp/ov_th_N.jpg files at THUMB_POOL_SIZE
    // regardless of how long the overview runs, preventing fd exhaustion.
    // Thumbnail temp-file pool.
    //
    // News sources: each source gets a DEDICATED slot (newsSlot parameter).
    // This guarantees no two news cards ever share the same /tmp file,
    // which was causing different sources to show each other's thumbnails
    // when 20+ concurrent fetches all rotated through only 10 slots.
    //
    // Search results: rotating pool of 10 slots starting at NEWS_POOL_SIZE,
    // since search results are ephemeral and don't need stable slots.
    //
    // Total pool size must cover all news sources + search slots.
    // Slots 0..(NEWS_POOL_SIZE-1) = news (one per source card)
    // Slots NEWS_POOL_SIZE..NEWS_POOL_SIZE+9 = search
    _tmpThumbPath(isSearch, newsSlot) {
        const NEWS_POOL_SIZE = 40;   // enough for all rows combined (rows×10)
        const SEARCH_BASE    = NEWS_POOL_SIZE;
        const SEARCH_SIZE    = 10;

        if (isSearch) {
            if (this._thumbPoolSearch === undefined) this._thumbPoolSearch = SEARCH_BASE;
            const slot = this._thumbPoolSearch;
            this._thumbPoolSearch = SEARCH_BASE + ((slot - SEARCH_BASE + 1) % SEARCH_SIZE);
            return GLib.build_filenamev([GLib.get_tmp_dir(), 'ov_th_' + slot + '.jpg']);
        } else {
            // newsSlot is the card's index within the flat list of all news sources
            // (0-based, assigned at card creation). Each card has a stable, unique slot.
            const slot = (newsSlot || 0) % NEWS_POOL_SIZE;
            return GLib.build_filenamev([GLib.get_tmp_dir(), 'ov_th_' + slot + '.jpg']);
        }
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
            const path = this._tmpThumbPath(cb && cb._isSearch, cb && cb._newsSlot);
            const f    = Gio.File.new_for_path(path);
            f.replace_contents(b, null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            if (cb) {
                // Let cache layer apply the style (it also stores the path)
                try { cb(path); } catch(e) { this._applyImagePath(actor, path); }
            } else {
                this._applyImagePath(actor, path);
            }
            // No per-file timer: pool slots are overwritten on next rotation.
            // All pool files are deleted in destroy().
            return true;
        } catch(e) { return false; }
    }

    // Fetch an image URL and apply it to actor.
    // cb: optional callback(savedPath) — used by news cache layer
    // _retried prevents infinite loops on og:image fallback.
    _loadImageIntoActor(url, actor, w, h, _retried, cb) {
        if (!url || !actor) return;
        const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
        try {
            const session = this._getSoupSession(); if (!session) return;
            const soup3 = this._soup3;

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
                        self._loadImageIntoActor(ogM[1], actor, w, h, true, cb);
                    }
                } catch(e) {}
            };

            const onBytes = (rawBytes) => {
                if (!rawBytes || rawBytes.length < 50) return;
                if (self._writeAndApply(actor, rawBytes, cb)) return; // it's an image — done
                tryOgFromHtml(rawBytes);                              // it's HTML — extract og:image
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


    // _loadImageIntoActorCb merged into _loadImageIntoActor(url,actor,w,h,retried,cb)

    // ── Power bar ─────────────────────────────────────────────────────────────
    // ── System Monitor Bar ────────────────────────────────────────────────────
    // Flat Material Design widgets: Network ↓↑ · RAM bar · Disk circle
    // Reads /proc/* directly — no external tools, no DBus, instant.
    // Updates every 2 s while overview is visible.
    // Clicking any widget launches system monitor.

    _buildSysMonBar() {
        const GLib  = imports.gi.GLib;
        const Gio   = imports.gi.Gio;
        // Colors set via inline style rgba() in mkLbl — CSS .cinnamon-overview-sysmon
        // StLabel rules can override. Default neutral for light/dark adaptability.
        const WHITE = new Clutter.Color({ red:30,  green:30,  blue:30,  alpha:230 });
        const DIM   = new Clutter.Color({ red:30,  green:30,  blue:30,  alpha:140 });

        // ── Material colours ──────────────────────────────────────────────────
        const COL_NET = '#29B6F6';  // Light Blue 400
        const COL_RAM = '#66BB6A';  // Green 400
        const COL_CPU = '#AB47BC';  // Purple 400

        // ── Non-blocking launch via Gio.Subprocess ────────────────────────────
        // Never blocks — Gio.Subprocess is fully async, no freeze risk.
        const launchSysMon = () => {
            const candidates = [
                'gnome-system-monitor', 'mate-system-monitor',
                'xfce4-taskmanager',    'plasma-systemmonitor',
            ];
            for (const cmd of candidates) {
                try {
                    if (GLib.find_program_in_path(cmd)) {
                        Gio.Subprocess.new([cmd], Gio.SubprocessFlags.NONE);
                        return;
                    }
                } catch(e) {}
            }
            // htop fallback — launch in a terminal without blocking
            try {
                Gio.Subprocess.new(
                    ['bash', '-c',
                     'x-terminal-emulator -e htop 2>/dev/null || gnome-terminal -- htop &'],
                    Gio.SubprocessFlags.NONE);
            } catch(e) {}
        };

        // ── Fixed-width label — prevents bar shifting on value changes ────────
        const mkLbl = (text, col, minW) => {
            const l = new St.Label({
                text,
                // min-width locks the cell so changing text never resizes the bar
                style: 'font-size:11px;font-family:"Noto Sans",sans-serif;'
                     + (minW ? 'min-width:' + minW + 'px;' : ''),
                x_align: Clutter.ActorAlign.START,
            });
            try { l.clutter_text.set_color(col); } catch(e) {}
            l.clutter_text.set_single_line_mode(true);
            return l;
        };

        // ── Progress bar ──────────────────────────────────────────────────────
        const mkBar = (bw, bh, color) => {
            const track = new St.Widget({
                style: 'width:' + bw + 'px;height:' + bh + 'px;'
                     + 'background-color:rgba(0,0,0,0.12);border-radius:4px;',
            });
            const fill = new St.Widget({
                style: 'height:' + bh + 'px;background-color:' + color
                     + ';border-radius:4px;width:0px;transition-duration:400ms;',
            });
            track.add_child(fill);
            return { track, fill };
        };

        // ── Separator ─────────────────────────────────────────────────────────
        const mkSep = () => new St.Widget({
            style: 'width:1px;height:32px;background-color:rgba(255,255,255,0.18);margin:0 6px;',
            y_align: Clutter.ActorAlign.CENTER,
        });

        // ── Clickable section wrapper ─────────────────────────────────────────
        const mkSection = (innerBox) => {
            const btn = new St.Button({
                reactive: true, can_focus: false, track_hover: true,
                style: 'background:transparent;border:none;padding:2px 14px;',
            });
            btn.set_child(innerBox);
            btn.connect('clicked', () => {
                // Use _pendingAction so launch fires AFTER hide() completes
                this._pendingAction = launchSysMon;
                this.hide();
                return Clutter.EVENT_STOP;
            });
            return btn;
        };

        // ── BAR = outer container ─────────────────────────────────────────────
        const bar = new St.BoxLayout({
        vertical: false,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'cinnamon-overview-sysmon',
        });

        // ════════ NETWORK ═════════════════════════════════════════════════════
        const netBox = new St.BoxLayout({ vertical: false,
            y_align: Clutter.ActorAlign.CENTER, style: 'spacing:2px;' });
        const nlDL = mkLbl('↓  --', new Clutter.Color({red:41, green:182, blue:246, alpha:255}), 90);
        const nlUL = mkLbl('↑  --', DIM, 90);
        netBox.add_child(nlDL);
        netBox.add_child(nlUL);
        bar.add_child(mkSection(netBox));
        bar.add_child(mkSep());

        // ════════ RAM ══════════════════════════════════════════════════════════
        const ramBox = new St.BoxLayout({ vertical: true,
            y_align: Clutter.ActorAlign.CENTER, style: 'spacing:4px;' });
        const ramHdr = new St.BoxLayout({ vertical: false });
        const ramTitleLbl = mkLbl('RAM', DIM, 32);
        const ramPct = mkLbl('-- %', WHITE, 42);
        ramHdr.add_child(ramTitleLbl);
        ramHdr.add_child(ramPct);
        const { track: ramTrack, fill: ramFill } = mkBar(80, 7, COL_RAM);
        ramBox.add_child(ramHdr);
        ramBox.add_child(ramTrack);
        bar.add_child(mkSection(ramBox));
        bar.add_child(mkSep());

        // ════════ CPU ══════════════════════════════════════════════════════════
        const cpuBox = new St.BoxLayout({ vertical: true,
            y_align: Clutter.ActorAlign.CENTER, style: 'spacing:4px;' });
        const cpuHdr = new St.BoxLayout({ vertical: false });
        const cpuTitleLbl = mkLbl('CPU', DIM, 32);
        const cpuPct = mkLbl('-- %', WHITE, 42);
        cpuHdr.add_child(cpuTitleLbl);
        cpuHdr.add_child(cpuPct);
        const { track: cpuTrack, fill: cpuFill } = mkBar(80, 7, COL_CPU);
        cpuBox.add_child(cpuHdr);
        cpuBox.add_child(cpuTrack);
        bar.add_child(mkSection(cpuBox));

        // ════════ /proc reader ════════════════════════════════════════════════
        let prevRx = 0, prevTx = 0, prevTs = 0;

        const fmtSpeed = (bps) => {
            if (bps < 1000)     return bps.toFixed(0)    + ' B/s';
            if (bps < 1000000)  return (bps/1000).toFixed(0) + ' K/s';
            return (bps/1000000).toFixed(1) + ' M/s';
        };
        const fmtPct = (n) => Math.min(100, Math.round(n)) + '%';

        const update = () => {
            try {
                // ── Network ───────────────────────────────────────────────────
                const [, netRaw] = GLib.file_get_contents('/proc/net/dev');
                const netTxt = new TextDecoder('utf-8').decode(netRaw);
                let rx = 0, tx = 0;
                netTxt.split('\n').slice(2).forEach(line => {
                    const p = line.trim().split(/\s+/);
                    if (!p[0] || p[0] === 'lo:') return;
                    rx += parseInt(p[1])  || 0;
                    tx += parseInt(p[9])  || 0;
                });
                const now = GLib.get_monotonic_time() / 1e6;
                const dt  = now - prevTs;
                if (prevTs > 0 && dt > 0) {
                    const dlBps = Math.max(0, (rx - prevRx) / dt);
                    const ulBps = Math.max(0, (tx - prevTx) / dt);
                    try {
                        nlDL.set_text('↓  ' + fmtSpeed(dlBps));
                        nlUL.set_text('↑  ' + fmtSpeed(ulBps));
                    } catch(e) {}
                }
                prevRx = rx; prevTx = tx; prevTs = now;

                // ── RAM ───────────────────────────────────────────────────────
                const [, memRaw] = GLib.file_get_contents('/proc/meminfo');
                const memTxt = new TextDecoder('utf-8').decode(memRaw);
                const memMap = {};
                memTxt.split('\n').forEach(l => {
                    const m = l.match(/^(\w+):\s+(\d+)/);
                    if (m) memMap[m[1]] = parseInt(m[2]);
                });
                const memTotal = memMap['MemTotal']     || 1;
                const memAvail = memMap['MemAvailable'] || 0;
                const ramRatio = (memTotal - memAvail) / memTotal;
                const ramColor = ramRatio > 0.85 ? '#EF5350'
                               : ramRatio > 0.70 ? '#FFA726' : COL_RAM;
                try {
                    ramFill.set_style('height:7px;background-color:' + ramColor
                        + ';border-radius:4px;width:' + Math.round(80 * ramRatio) + 'px;');
                    ramPct.set_text(fmtPct(ramRatio * 100));
                } catch(e) {}

                // ── CPU: /proc/stat (delta between samples) ───────────────
                const [, cpuRaw] = GLib.file_get_contents('/proc/stat');
                const cpuLine = new TextDecoder('utf-8').decode(cpuRaw).split('\n')[0];
                const cpuVals = cpuLine.trim().split(/\s+/).slice(1).map(Number);
                const cpuIdle  = (cpuVals[3] || 0) + (cpuVals[4] || 0);
                const cpuTotal = cpuVals.reduce((a, b) => a + b, 0);
                if (!this._cpuPrev) this._cpuPrev = { idle: cpuIdle, total: cpuTotal };
                const dIdle  = cpuIdle  - this._cpuPrev.idle;
                const dTotal = cpuTotal - this._cpuPrev.total;
                this._cpuPrev = { idle: cpuIdle, total: cpuTotal };
                const cpuRatio = dTotal > 0 ? Math.max(0, 1 - dIdle / dTotal) : 0;
                const cpuColor = cpuRatio > 0.85 ? '#EF5350'
                               : cpuRatio > 0.60 ? '#FFA726' : COL_CPU;
                try {
                    cpuFill.set_style('height:7px;background-color:' + cpuColor
                        + ';border-radius:4px;width:' + Math.round(80 * cpuRatio) + 'px;');
                    cpuPct.set_text(fmtPct(cpuRatio * 100));
                } catch(e) {}

            } catch(e) {}

            return this._sysmonActive;
        };

        this._sysmonActive = false;
        bar._startMonitor = () => {
            if (this._sysmonActive) return;
            this._sysmonActive = true;
            update();
            this._sysmonTimer = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, 2, update);
        };
        bar._stopMonitor = () => {
            this._sysmonActive = false;
            if (this._sysmonTimer) {
                GLib.source_remove(this._sysmonTimer);
                this._sysmonTimer = null;
            }
        };

        return bar;
    }

    _buildPowerBar() {
        const bar = new St.BoxLayout({ vertical:false, reactive: false });
        const makeBtn = (iconName, tooltip, action) => {
            const btn = new St.Button({ reactive:true, can_focus:true, track_hover:true,
                style_class:'cinnamon-overview-power-btn',
                style:'padding:6px 10px;' });
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

        // ── Quick-launch: Settings · Files · Terminal ─────────────────────
        const launchBtn = (iconName, tooltip, cmd) => makeBtn(iconName, tooltip,
            () => { try { Util.spawnCommandLine(cmd); } catch(e) {} });

        bar.add_child(launchBtn('preferences-system-symbolic',  _('System Settings'), 'cinnamon-settings'));
        bar.add_child(launchBtn('system-file-manager-symbolic', _('File Manager'),    'nemo'));
        bar.add_child(launchBtn('utilities-terminal-symbolic',  _('Terminal'),        'x-terminal-emulator'));

        // Separator
        const sep = new St.Widget({
            style: 'width:1px;margin:6px 4px;background-color:rgba(128,128,128,0.35);',
            y_expand: true,
        });
        bar.add_child(sep);
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
        this._catBox.get_children().slice().forEach(ch => { try{ch.destroy();}catch(e){} });

        // ── User avatar in sidebar ────────────────────────────────────────────
        const GLib2 = imports.gi.GLib;
        const AVSIZE = 52;
        const username2 = GLib2.get_user_name() || '';

        // Avatar circle
        const avCircle = new St.Widget({
            width: AVSIZE, height: AVSIZE,
            // style_class: 'cinnamon-overview-avatar' — theme ring/size via cinnamon.css
            style_class: 'cinnamon-overview-avatar',
            style: 'border-radius:' + (AVSIZE/2) + 'px;'
                 + 'background-color:rgba(255,255,255,0.15);'
                 + 'background-size:cover;background-position:center;'
                 + 'border:2px solid rgba(255,255,255,0.35);',
        });

        // Load avatar image
        const avHome = GLib2.get_home_dir();
        const avPaths = [
            avHome + '/.face',
            avHome + '/.face.icon',
            '/var/lib/AccountsService/icons/' + username2,
        ];
        let avLoaded = false;
        for (const p of avPaths) {
            if (GLib2.file_test(p, GLib2.FileTest.EXISTS)) {
                avCircle.set_style(
                    'border-radius:' + (AVSIZE/2) + 'px;'
                    + 'background-image:url("' + p + '");'
                    + 'background-size:cover;background-position:center;'
                    + 'border:2px solid rgba(255,255,255,0.35);'
                    + 'width:' + AVSIZE + 'px;height:' + AVSIZE + 'px;');
                avLoaded = true;
                break;
            }
        }
        if (!avLoaded) {
            // Initials fallback
            const init2 = (username2 || '?')[0].toUpperCase();
            const initLbl = new St.Label({
                text: init2,
                style: 'font-size:22px;font-weight:bold;'
                     + 'color:#fff;',
            });
            try {
                initLbl.set_position(
                    Math.round((AVSIZE-18)/2),
                    Math.round((AVSIZE-28)/2));
            } catch(e) {}
            avCircle.add_child(initLbl);
        }

        // Real name label
        let avRealname = username2;
        try {
            const [, pw] = GLib2.file_get_contents('/etc/passwd');
            const pwTxt = new TextDecoder('utf-8').decode(pw);
            const pwLine = pwTxt.split('\n').find(l => l.startsWith(username2 + ':'));
            if (pwLine) {
                const gecos = pwLine.split(':')[4] || '';
                const real  = gecos.split(',')[0].trim();
                if (real) avRealname = real;
            }
        } catch(e) {}

        const avNameLbl = new St.Label({
            text: avRealname,
            // Fully themable via .cinnamon-overview-avatar-name in cinnamon.css
            // No inline color or style override — stylesheet wins
            style_class: 'cinnamon-overview-avatar-name',
            x_align: Clutter.ActorAlign.CENTER,
        });

        // Avatar container — centred in sidebar, clickable
        const avBox = new St.Button({
            reactive: true, can_focus: false, track_hover: true,
            x_expand: true,
            style: 'background:transparent;border:none;'
                 + 'padding-top:14px;padding-bottom:12px;',
        });
        const avInner = new St.BoxLayout({
            vertical: true, x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        avInner.add_child(avCircle);
        avInner.add_child(avNameLbl);
        avBox.set_child(avInner);
        avBox.connect('clicked', () => {
            // Try user accounts settings — multiple fallbacks
            this._pendingAction = () => {
                const Gio2 = imports.gi.Gio;
                const GLib3 = imports.gi.GLib;
                const cmds = [
                    ['cinnamon-settings', 'user'],
                    ['gnome-control-center', 'user-accounts'],
                    ['unity-control-center', 'user-accounts'],
                    ['xfce4-settings-manager'],
                ];
                for (const cmd of cmds) {
                    try {
                        if (GLib3.find_program_in_path(cmd[0])) {
                            Gio2.Subprocess.new(cmd, Gio2.SubprocessFlags.NONE);
                            return;
                        }
                    } catch(e) {}
                }
            };
            this.hide();
            return Clutter.EVENT_STOP;
        });
        this._catBox.add_child(avBox);

        // Thin separator below avatar
        const avSep = new St.Widget({
            style: 'height:1px;background-color:rgba(255,255,255,0.12);'
                 + 'margin-bottom:6px;',
            x_expand: true,
        });
        this._catBox.add_child(avSep);

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

            // ── Interaction: categoryClick setting ────────────────────────
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
            opacity:0, duration:40, mode:Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                const sec = this._sections[i];
                this._populateSection(sec);
                this._scroll.get_vscroll_bar().get_adjustment().set_value(0);
                this._wrapper.ease({ opacity:255, duration:60, mode:Clutter.AnimationMode.EASE_IN_QUAD });
            },
        });
    }

    // ── Grid helpers ──────────────────────────────────────────────────────────
    _gridWidth() {
        const m = Main.layoutManager.primaryMonitor;
        return Math.max(200, m.width - SIDEBAR_W - H_PAD * 2);
    }

    _populateSection(sec) {
        // Hide all news scrollbar tracks before destroying actors — prevents ghost
        // scrollbar artefacts that visually linger after switching categories
        (this._newsScrollViews || []).forEach(sv => {
            try {
                const hbar = sv.get_hscroll_bar();
                if (hbar) hbar.hide();
                sv.set_mouse_scrolling(false);
                sv.hide();
            } catch(e) {}
        });
        this._wrapper.get_children().slice().forEach(ch => { try{ch.destroy();}catch(e){} });
        this._newsBox = null;
        this._newsScrollH = null;
        this._newsScrollViews = [];
        // Hide newsletter scrollview track before wrapper destroy
        if (this._nlScrollView) {
            try {
                const vb = this._nlScrollView.get_vscroll_bar();
                if (vb) vb.hide();
                this._nlScrollView.hide();
            } catch(e) {}
            this._nlScrollView = null;
        }

        if (!sec) return;

        // News feed strip — shown for the first section, if enabled in settings
        if (this._currentSec === 0 && this._applet.settings.showNewsFeed !== false) {
            try {
                const feed = this._buildNewsFeed();
                this._wrapper.add_child(feed);
            } catch(e) {}
        }

        // AI Newsletter — built synchronously (instant), fetch deferred 1.5 s
        if (this._currentSec === 0 && this._applet.settings.enableNewsletter !== false) {
            try {
                const nl   = this._buildNewsletterPanel();
                const nlSv = new St.ScrollView({
                    reactive: true, x_expand: true, y_expand: false,
                    clip_to_allocation: true,
                });
                nlSv.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
                nlSv.set_clip_to_allocation(true);
                nlSv.set_overlay_scrollbars(false);
                nlSv.set_mouse_scrolling(true);
                nlSv.set_height(160);
                // Hide the scrollbar track so it never lingers after section change
                try { nlSv.get_vscroll_bar().hide(); } catch(e) {}
                nlSv.add_actor(nl);
                this._nlScrollView = nlSv;  // track for cleanup
                this._wrapper.add_child(nlSv);

                // Defer network fetch — only start timer once per session
                if (!this._newsletterCache && !this._nlFetchPending) {
                    this._nlFetchPending = true;
                    imports.gi.GLib.timeout_add(imports.gi.GLib.PRIORITY_LOW, 1500, () => {
                        this._nlFetchPending = false;
                        try { this._refreshNewsletter(this._newsletterContentBox); }
                        catch(e) {}
                        return false;
                    });
                }
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
        // Add Clutter.Actor grid directly — St.Bin collapses height in scroll contexts
        // Set explicit left margin via layout instead of a wrapper row
        grid.set_margin_left(lpad);
        this._wrapper.add_child(grid);

        // ── Recent files strip — after fav/app tiles, Favourites section only ─
        if (this._currentSec === 0 && this._applet.settings.showRecentFiles !== false) {
            try {
                const recentRow = this._buildRecentFilesRow();
                this._wrapper.add_child(recentRow);
            } catch(e) { global.logError('overview: recent files: ' + e); }
        }
    }




    // ── Web Search Engines ────────────────────────────────────────────────────
    // Returns list of enabled engines from settings.
    // Each engine: { name, key, urlTemplate, faviconUrl, color }
    // urlTemplate: replace {Q} with encodeURIComponent(query)

    _webEngines() {
        const s = this._applet.settings;
        const all = [
            { name:'Google',        settingKey:'searchGoogle',        color:'#4285F4',
              url:'https://www.google.com/search?q={Q}',
              favicon:'https://www.google.com/favicon.ico',
              homeImg:'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png' },
            { name:'YouTube',       settingKey:'searchYoutube',       color:'#FF0000',
              url:'https://www.youtube.com/results?search_query={Q}',
              favicon:'https://www.youtube.com/favicon.ico',
              homeImg:'https://www.youtube.com' },
            { name:'DuckDuckGo',    settingKey:'searchDuckduckgo',    color:'#DE5833',
              url:'https://duckduckgo.com/?q={Q}',
              favicon:'https://duckduckgo.com/favicon.ico',
              homeImg:'https://duckduckgo.com' },
            { name:'Bing',          settingKey:'searchBing',          color:'#008373',
              url:'https://www.bing.com/search?q={Q}',
              favicon:'https://www.bing.com/favicon.ico',
              homeImg:'https://www.bing.com' },
            { name:'Wikipedia',     settingKey:'searchWikipedia',     color:'#1c1c1c',
              url:'https://en.wikipedia.org/w/index.php?search={Q}',
              favicon:'https://en.wikipedia.org/favicon.ico',
              homeImg:'https://en.wikipedia.org' },
            { name:'GitHub',        settingKey:'searchGithub',        color:'#24292e',
              url:'https://github.com/search?q={Q}',
              favicon:'https://github.com/favicon.ico',
              homeImg:'https://github.com' },
            { name:'Stack Overflow',settingKey:'searchStackoverflow', color:'#F48024',
              url:'https://stackoverflow.com/search?q={Q}',
              favicon:'https://stackoverflow.com/favicon.ico',
              homeImg:'https://stackoverflow.com' },
            { name:'Reddit',        settingKey:'searchReddit',        color:'#FF4500',
              url:'https://www.reddit.com/search/?q={Q}',
              favicon:'https://www.reddit.com/favicon.ico',
              homeImg:'https://www.reddit.com' },
            { name:'IMDb',          settingKey:'searchImdb',          color:'#1a1a1a',
              url:'https://www.imdb.com/find?q={Q}',
              favicon:'https://www.imdb.com/favicon.ico',
              homeImg:'https://www.imdb.com' },
            { name:'OpenStreetMap', settingKey:'searchOpenstreetmap', color:'#7EBC6F',
              url:'https://www.openstreetmap.org/search?query={Q}',
              favicon:'https://www.openstreetmap.org/favicon.ico',
              homeImg:'https://www.openstreetmap.org' },
        ];
        return all.filter(e => s[e.settingKey] !== false);
    }

    // Build a web-search result card (wider than an app tile, with thumbnail area)
    _makeWebSearchCard(engine, query) {
        const CARD_W = 200;
        const CARD_H = 130;
        const GAP    = 14;
        const q   = encodeURIComponent(query);
        const url = engine.url.replace('{Q}', q);

        // Wrapper with right gap (hover never touches wrapper → no wobble, no layout reflow)
        const wrapper = new St.Widget({
            width: CARD_W + GAP, height: CARD_H,
            reactive: false,
        });

        // Card button — identical structure to news thumbnail cards
        const card = new St.Button({
            reactive: true, can_focus: true, track_hover: true,
            width: CARD_W, height: CARD_H,
            style: `width:${CARD_W}px;height:${CARD_H}px;border-radius:10px;` +
                   `background-color:${engine.color};overflow:hidden;padding:0;`,
        });
        card.set_position(0, 0);

        const cardInner = new St.Widget({ width: CARD_W, height: CARD_H, clip_to_allocation: true });
        cardInner.set_position(0, 0);

        // Background thumbnail — og:image from engine homepage
        const thumb = new St.Widget({
            width: CARD_W, height: CARD_H,
            style: `background-color:${engine.color};border-radius:10px;`,
        });
        thumb.set_position(0, 0);
        cardInner.add_child(thumb);

        // Dark gradient overlay for readability
        const grad = new St.Widget({
            width: CARD_W, height: CARD_H,
            style: 'background-gradient-direction:vertical;' +
                   'background-gradient-start:rgba(0,0,0,0.0);' +
                   'background-gradient-end:rgba(0,0,0,0.78);border-radius:10px;',
            reactive: false,
        });
        grad.set_position(0, 0);
        cardInner.add_child(grad);

        // Favicon circle top-left — DuckDuckGo icon API returns PNG (not .ico)
        const favDomain = engine.favicon.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        const favPngUrl = `https://icons.duckduckgo.com/ip3/${favDomain}.ico`;
        const favIcon = new St.Widget({
            width: 28, height: 28,
            style: 'border-radius:14px;background-color:rgba(255,255,255,0.20);',
            reactive: false,
        });
        favIcon.set_position(10, 10);
        cardInner.add_child(favIcon);
        const _favCb = (path) => {
            if (favIcon) favIcon.style =
                `width:28px;height:28px;border-radius:14px;` +
                `background-image:url("${path}");background-size:cover;`;
        };
        _favCb._isSearch = true;
        this._loadImageIntoActor(favPngUrl, favIcon, 28, 28, false, _favCb);

        // Text box bottom
        const textBox = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.END,
            x_align: Clutter.ActorAlign.START,
            width: CARD_W, height: CARD_H,
        });
        textBox.set_position(0, 0);
        const nameLabel = new St.Label({
            text: engine.name,
            style: 'font-size:13px;font-weight:700;color:#ffffff;' +
                   'text-shadow:0 1px 4px rgba(0,0,0,0.8);padding:0 8px 4px 10px;',
        });
        nameLabel.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.END);
        nameLabel.clutter_text.set_single_line_mode(true);
        const qShort = query.length > 28 ? query.slice(0,28)+'\u2026' : query;
        const queryLabel = new St.Label({
            text: `Search: "${qShort}"`,
            style: 'font-size:10px;color:rgba(255,255,255,0.75);' +
                   'text-shadow:0 1px 3px rgba(0,0,0,0.7);padding:0 8px 10px 10px;',
        });
        queryLabel.clutter_text.set_ellipsize(imports.gi.Pango.EllipsizeMode.END);
        queryLabel.clutter_text.set_single_line_mode(true);
        textBox.add_child(new St.Widget({ y_expand: true }));
        textBox.add_child(nameLabel);
        textBox.add_child(queryLabel);
        cardInner.add_child(textBox);

        // Hover ring — fixed geometry, only changes border color
        const hoverRing = new St.Widget({
            width: CARD_W, height: CARD_H, style: 'border-radius:10px;', reactive: false,
        });
        hoverRing.set_position(0, 0);
        cardInner.add_child(hoverRing);
        card.connect('notify::hover', () => {
            hoverRing.style = card.hover
                ? 'border-radius:10px;border:2px solid rgba(255,255,255,0.60);'
                : 'border-radius:10px;';
        });

        card.set_child(cardInner);
        card.connect('button-press-event',   () => Clutter.EVENT_STOP);
        card.connect('button-release-event', (a, ev) => {
            if (ev.get_button() === 1) {
                this._pendingAction = () => {
                    try { Gio.app_info_launch_default_for_uri(url, null); } catch(e) {}
                };
                this.hide();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_STOP;
        });

        wrapper.add_child(card);

        // Fetch og:image from engine homepage as card background thumbnail
        const _thumbCb = (path) => {
            if (thumb) thumb.style =
                `background-image:url("${path}");` +
                `background-size:cover;background-position:center;border-radius:10px;`;
        };
        _thumbCb._isSearch = true;
        this._loadImageIntoActor(engine.homeImg || engine.favicon, thumb, CARD_W, CARD_H, false, _thumbCb);

        return wrapper;
    }


    _populateSearch(results, query) {
        this._wrapper.get_children().slice().forEach(ch => { try{ch.destroy();}catch(e){} });
        const gw   = this._gridWidth();
        const cols = Math.max(3, Math.floor((gw + CELL_GAP) / (CELL_W + CELL_GAP)));
        const rowW = cols * CELL_W + (cols-1) * CELL_GAP;
        const lpad = Math.max(0, Math.floor((gw - rowW) / 2));

        const webEnabled = this._applet.settings.searchWebEnabled !== false;
        const engines    = webEnabled && query ? this._webEngines() : [];

        if (!results.length && !engines.length) {
            this._wrapper.add_child(new St.Label({ text:_('No results'),
                style_class:'cinnamon-overview-status-label', style:`padding:40px ${lpad}px;` }));
            return;
        }

        // ── App results grid ──────────────────────────────────────────────────
        if (results.length) {
            const gl = new Clutter.GridLayout({
                column_spacing:CELL_GAP, row_spacing:CELL_GAP, column_homogeneous:true });
            const grid = new Clutter.Actor({ layout_manager:gl, width:rowW });
            results.forEach((app, idx) => {
                const tileMode = this._applet.settings.useTileStyle
                    ? (this._applet.settings.overviewTileStyle || 'metro') : false;
                gl.attach(makeTile(app, () => this._launchApp(app), ev => this._openCtxMenu(app, ev),
                    tileMode), idx%cols, Math.floor(idx/cols), 1, 1);
            });
            grid.set_margin_left(lpad);
            this._wrapper.add_child(grid);
        }

        // ── Web search engine cards ───────────────────────────────────────────
        if (engines.length && query) {
            // Section label
            this._wrapper.add_child(new St.Label({
                text: 'SEARCH THE WEB',
                style_class: 'cinnamon-overview-section-title',
                style: `padding:14px 0 6px ${lpad}px;`,
            }));

            // Split engines into rows of N (default 1 row, controlled by setting)
            const rowCount   = Math.max(1, Math.min(3, this._applet.settings.searchWebRows || 1));
            const perRow     = Math.ceil(engines.length / rowCount);
            const makeScrollRow = (rowEngines) => {
                const scrollH = new St.ScrollView({ x_expand: true });
                scrollH.set_policy(St.PolicyType.AUTOMATIC, St.PolicyType.NEVER);
                scrollH.set_overlay_scrollbars(false);
                scrollH.set_mouse_scrolling(false);
                const row = new St.BoxLayout({
                    vertical: false,
                    style: `padding: 0 0 8px ${lpad}px;`,
                });
                rowEngines.forEach(engine => row.add_child(this._makeWebSearchCard(engine, query)));
                scrollH.add_actor(row);
                scrollH.connect('scroll-event', (a, ev) => {
                    const dir  = ev.get_scroll_direction();
                    const hadj = scrollH.get_hscroll_bar().get_adjustment();
                    const step = 214;
                    if (dir === Clutter.ScrollDirection.DOWN || dir === Clutter.ScrollDirection.RIGHT)
                        hadj.set_value(Math.min(hadj.upper - hadj.page_size, hadj.value + step));
                    else if (dir === Clutter.ScrollDirection.UP || dir === Clutter.ScrollDirection.LEFT)
                        hadj.set_value(Math.max(hadj.lower, hadj.value - step));
                    return Clutter.EVENT_STOP;
                });
                return scrollH;
            };
            for (let ri = 0; ri < rowCount; ri++) {
                const slice = engines.slice(ri * perRow, (ri + 1) * perRow);
                if (slice.length) this._wrapper.add_child(makeScrollRow(slice));
            }
        }
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
        // Yield to the main loop so Clutter renders the typed character BEFORE
        // any work begins.  PRIORITY_DEFAULT_IDLE sits below Clutter redraws
        // (PRIORITY_HIGH / PRIORITY_DEFAULT), so the character is visible
        // immediately.  We cancel any pending yield and re-queue so rapid
        // typing always schedules one fresh call — no characters are dropped.
        if (this._searchYield) {
            imports.gi.GLib.source_remove(this._searchYield);
        }
        this._searchYield = imports.gi.GLib.idle_add(
            imports.gi.GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._searchYield = null;
                this._doSearch();
                return false;
            });
    }

    _doSearch() {
        const q = this._entry.get_text().toLowerCase().trim();
        if (!q) {
            this._searching = false;
            this._searchYield = null;
            if (this._retryTimer) { imports.gi.GLib.source_remove(this._retryTimer); this._retryTimer = null; }
            this._dictSearchId++;
            if (this._dictDebounce) { imports.gi.GLib.source_remove(this._dictDebounce); this._dictDebounce = null; }
            if (this._gridDebounce) { imports.gi.GLib.source_remove(this._gridDebounce); this._gridDebounce = null; }
            if (this._dictScroll) this._dictScroll.hide(); if (this._dictPanel) this._dictPanel.hide();
            this._selectCategory(this._currentSec);
            return;
        }
        this._searching = true;

        // ── Panel routing ──────────────────────────────────────────────────
        // single alphabetic word → dictionary
        // anything else (phrases, questions, sentences, prompts) → AI
        const dictEnabled  = this._applet.settings.enableDictionary !== false;
        const rawQ         = this._entry.get_text().trim();
        const isSingleWord = /^[a-zA-Z'-]{2,40}$/.test(q);
        const isAIPrompt   = !isSingleWord && rawQ.length >= 3;

        if (dictEnabled && this._dictPanel && (isSingleWord || isAIPrompt)) {
            this._dictSearchId++;
            const sid = this._dictSearchId;
            if (this._dictDebounce) imports.gi.GLib.source_remove(this._dictDebounce);
            this._dictDebounce = imports.gi.GLib.timeout_add(imports.gi.GLib.PRIORITY_DEFAULT, 280, () => {
                this._dictDebounce = null;
                if (this._dictSearchId !== sid) return false;
                if (isSingleWord) {
                    this._fetchDictionary(q, sid);
                } else {
                    this._fetchAIAnswer(rawQ, sid);
                }
                return false;
            });
        } else {
            this._dictSearchId++;
            if (this._dictScroll) this._dictScroll.hide(); if (this._dictPanel) this._dictPanel.hide();
        }

        // Debounce the grid rebuild (80 ms) so keystrokes feel instant.
        // The entry text is already visible the moment you type — only the
        // app-grid rebuild is deferred, which is the expensive Clutter work.
        if (this._gridDebounce) imports.gi.GLib.source_remove(this._gridDebounce);
        const gridQ = q;  // capture current value
        this._gridDebounce = imports.gi.GLib.timeout_add(
            imports.gi.GLib.PRIORITY_HIGH, 60, () => {
                this._gridDebounce = null;
                if (!this._searching) return false;
                const all = this._applet.apps.listApplications('all') || [];
                const res = all.filter(app => {
                    const n  = (app.get_name        ? app.get_name()        ||'' : '').toLowerCase();
                    const d  = (app.get_description ? app.get_description() ||'' : '').toLowerCase();
                    const id = (app.get_id          ? app.get_id()          ||'' : '').toLowerCase();
                    return n.includes(gridQ) || d.includes(gridQ) || id.includes(gridQ);
                });
                this._populateSearch(res, gridQ);
                this._scroll.get_vscroll_bar().get_adjustment().set_value(0);
                return false;
            });
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

        // ── TOP ROW (_sRow) + MEDIA ROW: absolutely positioned on _root ──
        // Both live on _root, not inside _rightCol.  Dict panel show/hide
        // only reflowed _rightCol's BoxLayout — these rows are completely
        // immune because they are outside that layout tree entirely.
        const SROW_H  = 140;   // sRow:  padding-top 20 + clock ~80 + padding-bottom 20 + extra
        const MEDIA_H = 46;    // mediaRow: ~46px
        const TOP_H   = SROW_H + MEDIA_H;
        const rightX  = SIDEBAR_W;
        const rightW  = ovW - SIDEBAR_W;

        // ── RIGHT PANE BACKGROUND: full height, behind all right-side widgets ─
        this._rightPane.set_position(rightX, 0);
        this._rightPane.set_size(rightW, ovH);

        this._sRow.set_position(rightX, 0);
        this._sRow.set_size(rightW, SROW_H);

        this._mediaRow.set_position(rightX, SROW_H);
        this._mediaRow.set_size(rightW, MEDIA_H);

        // ── RIGHT COLUMN: starts BELOW the fixed header rows ─────────────
        // Contains only: dictScroll + icon grid — both can grow/shrink freely
        // without ever touching _sRow or _mediaRow.
        this._rightCol.set_position(rightX, TOP_H);
        this._rightCol.set_size(rightW, ovH - TOP_H);

        // Power bar position (bottom-right, 16px inset)
        if (this._powerBar) {
            const approxPW  = 7 * 48 + 1 * 10 + 8;   // 7 btns + separator + padding
            this._powerBar.set_position(ovW - approxPW - 16, ovH - 38 - 8);
            // Sysmon aligned with the app grid left edge (sidebar + padding)
            if (this._sysMonBar) {
                this._sysMonBar.set_position(SIDEBAR_W + H_PAD, ovH - 38 - 8);
            }
        }

        global.stage.add_child(this._root);
        this._root.raise_top();
        if (this._hotCorner) this._hotCorner.raiseTop();


        // Re-apply palette class every show() so live tile-style changes take effect immediately
        this._applyOverviewPaletteClass();

        this._root.opacity = 0;
        this._root.show();

        if (Main.pushModal(this._root)) this._modal = true;

        this._entry.set_text('');
        this._searching  = false;
        this._currentSec = 0;
        this._dictSearchId++;
        try{if(this._dictScroll)this._dictScroll.hide();}catch(e){}
        try{if(this._dictPanel) this._dictPanel.hide(); }catch(e){}

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
                            (this._newsScrollViews || []).forEach(sv => {
                                try {
                                    const hadj = sv.get_hscroll_bar().get_adjustment();
                                    if (dir === Clutter.ScrollDirection.DOWN || dir === Clutter.ScrollDirection.RIGHT)
                                        hadj.set_value(Math.min(hadj.upper - hadj.page_size, hadj.value + step));
                                    else if (dir === Clutter.ScrollDirection.UP || dir === Clutter.ScrollDirection.LEFT)
                                        hadj.set_value(Math.max(hadj.lower, hadj.value - step));
                                } catch(e) {}
                            });
                            return Clutter.EVENT_STOP;
                        }
                    }
                } catch(e) {}
            }

            // Otherwise scroll the app grid vertically
            const adj = this._scroll.get_vscroll_bar().get_adjustment();
            const step = adj.step_increment || 80;
            if (dir === Clutter.ScrollDirection.UP)
                adj.set_value(Math.max(adj.lower, adj.value - step));
            if (dir === Clutter.ScrollDirection.DOWN)
                adj.set_value(Math.min(adj.upper - adj.page_size, adj.value + step));
            return Clutter.EVENT_STOP;
        });

        // Rebuild sections only when stale (app install/uninstall invalidates them)
        if (!this._sections || !this._sections.length) {
            this._buildSections();
            this._catsDirty = true;
        }
        // Rebuild category buttons only when dirty — avoids expensive
        // create_icon_texture() + actor construction on every open
        if (this._catsDirty !== false) {
            this._buildCategories();
            this._catsDirty = false;
        }
        this._populateSection(this._sections[0]);

        if (this._sysMonBar && this._sysMonBar._startMonitor)
            this._sysMonBar._startMonitor();

        this._root.ease({ opacity:255, duration:120, mode:Clutter.AnimationMode.EASE_OUT_QUAD,
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
        if (this._dictDebounce) { imports.gi.GLib.source_remove(this._dictDebounce); this._dictDebounce = null; }
        if (this._gridDebounce) { imports.gi.GLib.source_remove(this._gridDebounce); this._gridDebounce = null; }
        if (this._retryTimer)    { imports.gi.GLib.source_remove(this._retryTimer);    this._retryTimer    = null; }
        if (this._sysMonBar && this._sysMonBar._stopMonitor) this._sysMonBar._stopMonitor();
        if (this._searchYield) { imports.gi.GLib.source_remove(this._searchYield); } this._searchYield = null;
        this._dictSearchId++;
        if (this._dictScroll) this._dictScroll.hide(); if (this._dictPanel) this._dictPanel.hide();
        this._root.ease({ opacity:0, duration:100, mode:Clutter.AnimationMode.EASE_IN_QUAD,
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
        if (this._dictDebounce) { imports.gi.GLib.source_remove(this._dictDebounce);  this._dictDebounce = null; }
        if (this._gridDebounce) { imports.gi.GLib.source_remove(this._gridDebounce);  this._gridDebounce = null; }
        if (this._retryTimer)   { imports.gi.GLib.source_remove(this._retryTimer);    this._retryTimer   = null; }
        if (this._sysmonTimer)  { imports.gi.GLib.source_remove(this._sysmonTimer);  this._sysmonTimer  = null; }
        // Clean up all rotating pool temp files
        try {
            const tmpDir = imports.gi.GLib.get_tmp_dir();
            const Gio2   = imports.gi.Gio;
            const GLib2  = imports.gi.GLib;
            for (let i = 0; i < 50; i++) {
                const p = GLib2.build_filenamev([tmpDir, 'ov_th_' + i + '.jpg']);
                try { Gio2.File.new_for_path(p).delete(null); } catch(e) {}
            }
        } catch(e) {}
        this._sysmonActive = false;
        if (this._searchYield) { imports.gi.GLib.source_remove(this._searchYield); } this._searchYield = null;
        this._root.reactive = false;
        if (this._modal) { Main.popModal(this._root); this._modal = false; }
        if (this._root.get_parent()) global.stage.remove_child(this._root);
        this._visible = false; this._fading = false;
        this._pendingLaunch = null; this._pendingAction = null;
    }
}

var Overview = AppOverview;
