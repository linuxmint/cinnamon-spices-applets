// Traydeck: a clean, customizable home for tray icons.
//
// Hosts both kinds of tray icon Cinnamon knows about (XApp status icons and
// legacy XEmbed/"systray" icons) in a single applet, so it replaces the stock
// "System Tray" and "XApp Status" applets. Each icon can be shown, tucked into
// an overflow popup, or hidden, and icons can be reordered and resized.

const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const XApp = imports.gi.XApp;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;
const SignalManager = imports.misc.signalManager;
const Gettext = imports.gettext;

const UUID = 'traydeck@gianfj';
Gettext.bindtextdomain(UUID, GLib.build_filenamev([GLib.get_user_data_dir(), 'locale']));

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function ngettext(singular, plural, n) {
    return Gettext.dngettext(UUID, singular, plural, n);
}

const MODES = ['show', 'overflow', 'hide'];
const MODE_LABELS = { show: _('Show'), overflow: _('Overflow'), hide: _('Hide') };

function isHorizontal(orientation) {
    return orientation == St.Side.TOP || orientation == St.Side.BOTTOM;
}

// "org.x.StatusIcon.Foo-bar" -> "Foo bar", "discord" -> "Discord"
function prettyName(raw) {
    let s = String(raw || '').replace(/^org\.x\.StatusIcon\./, '');
    if (s.includes('.')) {
        const parts = s.split('.').filter(p => p.length);
        if (parts.length) s = parts[parts.length - 1];
    }
    s = s.replace(/[-_]+/g, ' ').trim();
    if (!s) return _('Unknown');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Build an St.Icon from an icon name or an absolute file path.
function makeIcon(iconName, size) {
    const symbolic = /symbolic/.test(iconName);
    const type = symbolic ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR;
    if (iconName.includes('/')) {
        const gicon = new Gio.FileIcon({ file: Gio.File.new_for_path(iconName) });
        return new St.Icon({ icon_type: type, icon_size: size, gicon: gicon });
    }
    return new St.Icon({ icon_type: type, icon_size: size, icon_name: iconName });
}

// Stable identity for an XApp icon. Its bus name (":1.123") changes every launch,
// so ask the bus for the owning process and name the icon after the program.
function readFileAsync(path) {
    return new Promise((resolve, reject) => {
        Gio.File.new_for_path(path).load_contents_async(null, (file, res) => {
            try { resolve(file.load_contents_finish(res)[1]); }
            catch (e) { reject(e); }
        });
    });
}

async function appKeyFromPid(pid) {
    try {
        const bytes = await readFileAsync(`/proc/${pid}/cmdline`);
        const args = new TextDecoder().decode(bytes).split('\0').filter(a => a.length);
        const base = a => a.split('/').pop();
        let name = base(args[0] || '');
        if (/^python[\d.]*$/.test(name) || /^(node|java|bash|sh)$/.test(name)) {
            const mi = args.indexOf('-m');
            if (mi >= 0 && args[mi + 1]) name = args[mi + 1].split('.')[0];
            else {
                const script = args.slice(1).find(a => !a.startsWith('-'));
                if (script) name = base(script).replace(/\.(py|js|jar)$/, '');
            }
        }
        return name || null;
    } catch (e) {
        return null;
    }
}

function resolveAppKey(proxy, callback) {
    const name = proxy.get_name() || '';
    if (!name.startsWith(':')) { callback(name); return; }
    try {
        Gio.DBus.session.call('org.freedesktop.DBus', '/org/freedesktop/DBus',
            'org.freedesktop.DBus', 'GetConnectionUnixProcessID',
            new imports.gi.GLib.Variant('(s)', [name]), null,
            Gio.DBusCallFlags.NONE, 2000, null, async (conn, res) => {
                let key = null;
                try {
                    const [pid] = conn.call_finish(res).deep_unpack();
                    key = await appKeyFromPid(pid);
                } catch (e) { /* fall through */ }
                callback(key || name);
            });
    } catch (e) {
        callback(name);
    }
}

function dbusCall(bus, path, iface, method, params, type) {
    return new Promise((resolve, reject) => {
        Gio.DBus.session.call(bus, path, iface, method, params,
            type ? new GLib.VariantType(type) : null, Gio.DBusCallFlags.NONE, 2000, null,
            (conn, res) => {
                try { resolve(conn.call_finish(res).deep_unpack()); }
                catch (e) { reject(e); }
            });
    });
}

async function dbusProp(bus, path, iface, prop) {
    try {
        const [v] = await dbusCall(bus, path, 'org.freedesktop.DBus.Properties', 'Get',
            new GLib.Variant('(ss)', [iface, prop]), '(v)');
        return v.deep_unpack();
    } catch (e) {
        return null;
    }
}

// The old naming for bridged icons, kept only to carry settings over to the new ids.
function slugify(s) {
    return String(s || '').toLowerCase().trim().replace(/\s+/g, '-');
}

function legacyBridgedKey(tip, icon) {
    tip = String(tip || '').replace(/<[^>]*>/g, '').split('\n')[0].trim();
    icon = String(icon || '').split('/').pop();
    const usable = tip && tip.length <= 24 && !tip.includes('@');
    return slugify(usable ? tip : (icon.startsWith('xapp-tmp') ? '' : icon) || 'tray-app');
}

// StatusNotifier apps all reach us through xapp-sn-watcher, which names each bridged
// icon after the item's Title, or its bus name when there is no title. Find the
// StatusNotifier item behind `proxy` and name the icon after the program that owns
// it, which (unlike tooltips and titles) stays the same across restarts.
// Resolves to { key, title, aliases } or null when no item matches.
async function resolveBridged(proxy) {
    const want = String(proxy.name || '').toLowerCase();
    if (!want) return null;
    let entries;
    try {
        [entries] = await dbusCall('org.kde.StatusNotifierWatcher', '/StatusNotifierWatcher',
            'org.freedesktop.DBus.Properties', 'Get',
            new GLib.Variant('(ss)', ['org.kde.StatusNotifierWatcher', 'RegisteredStatusNotifierItems']),
            '(v)');
        entries = entries.deep_unpack();
    } catch (e) {
        return null;
    }
    for (const entry of entries) {
        const slash = entry.indexOf('/');
        const bus = slash >= 0 ? entry.slice(0, slash) : entry;
        const path = slash >= 0 ? entry.slice(slash) : '/StatusNotifierItem';
        const iface = 'org.kde.StatusNotifierItem';
        const [title, id] = await Promise.all([
            dbusProp(bus, path, iface, 'Title'), dbusProp(bus, path, iface, 'Id')]);
        const names = [title, bus, id].filter(n => n).map(n => String(n).toLowerCase());
        if (!names.includes(want)) continue;
        let key = null;
        try {
            const [pid] = await dbusCall('org.freedesktop.DBus', '/org/freedesktop/DBus',
                'org.freedesktop.DBus', 'GetConnectionUnixProcessID',
                new GLib.Variant('(s)', [bus]), '(u)');
            key = await appKeyFromPid(pid);
        } catch (e) { /* no pid */ }
        if (!key) continue;
        // Electron apps rewrite their argv into one string ("claude-desktop --startup").
        key = key.split(' ')[0].toLowerCase();
        const nice = t => t && t.length <= 24 && !t.includes('@') && !/^[:\d]/.test(t);
        const tip = String(proxy.tooltip_text || '').replace(/<[^>]*>/g, '').split('\n')[0].trim();
        return {
            key: key,
            title: nice(tip) ? tip : nice(title) ? title.charAt(0).toUpperCase() + title.slice(1) : prettyName(key),
            aliases: [slugify(title), slugify(id)].filter(a => a),
        };
    }
    return null;
}

/* ------------------------------------------------------------------ */
/* Screen recording indicator (the stock XApp applet shows this too)   */
/* ------------------------------------------------------------------ */

class RecorderIcon {
    constructor(applet) {
        this.applet = applet;
        this.actor = new St.BoxLayout({
            style_class: 'traydeck-item',
            reactive: false,
            visible: false,
            x_expand: true,
            y_expand: true,
        });
        this._indicator = new St.DrawingArea();
        this._indicator.connect('repaint', area => this._paint(area));
        this.actor.add_actor(new St.Bin({ child: this._indicator }));

        this._listenerId = Main.screenRecorder.connect('recording', () => this._stateChanged());
        this._stateChanged();
        this.refresh();
    }

    _stateChanged() {
        this.actor.visible = Main.screenRecorder.recording;
        this._indicator.queue_repaint();
    }

    _paint(area) {
        const [width, height] = area.get_surface_size();
        const size = Math.max(width, height);
        const border = area.get_theme_node().get_foreground_color();
        const cr = area.get_context();

        Clutter.cairo_set_source_color(cr, new Clutter.Color({ red: 255, green: 0, blue: 0, alpha: 255 }));
        cr.arc(width / 2, height / 2, size / 4.0, 0.0, 2.0 * Math.PI);
        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, border);
        cr.stroke();
        cr.$dispose();
    }

    refresh() {
        this.actor.vertical = !isHorizontal(this.applet.orientation);
        const s = this.applet.iconSize(St.IconType.FULLCOLOR) * global.ui_scale;
        this._indicator.set_size(s, s);
        this._indicator.queue_repaint();
    }

    destroy() {
        if (this._listenerId) {
            Main.screenRecorder.disconnect(this._listenerId);
            this._listenerId = 0;
        }
        this.actor.destroy();
    }
}

/* ------------------------------------------------------------------ */
/* XApp status icon                                                    */
/* ------------------------------------------------------------------ */

class XAppItem {
    constructor(applet, proxy, appKey, bridgedTitle) {
        this.kind = 'xapp';
        this.applet = applet;
        this.proxy = proxy;
        this.appKey = appKey;
        this.bridgedTitle = bridgedTitle;
        this.id = 'xapp:' + appKey;
        this.iconName = null;
        this.wantVisible = true;
        this.placementVisible = true;
        this._iconLoaderHandle = null;
        this._imageResourceScale = null;

        this.actor = new St.BoxLayout({
            style_class: 'traydeck-item',
            reactive: !global.settings.get_boolean('panel-edit-mode'),
            track_hover: true,
            x_expand: true,
            y_expand: true,
        });

        this.iconHolder = new St.Bin();
        this.label = new St.Label({ y_align: Clutter.ActorAlign.CENTER });
        this.actor.add_actor(this.iconHolder);
        this.actor.add_actor(this.label);

        this._tooltip = new Tooltips.PanelItemTooltip(this, '', applet.orientation);

        this.actor.connect('button-press-event', (a, e) => this._onPress(a, e));
        this.actor.connect('button-release-event', (a, e) => this._onRelease(a, e));
        this.actor.connect('scroll-event', (a, e) => this._onScroll(a, e));
        this.actor.connect('enter-event', () => { this._tooltip.preventShow = false; });
        this.actor.connect('resource-scale-changed', () => this._onResourceScaleChanged());

        this._propsId = this.proxy.connect('g-properties-changed', (p, changed) => this._onProps(changed));
        this.refresh();
    }

    _onProps(changed) {
        const names = changed.deep_unpack();
        if ('IconName' in names) this.setIconName(this.proxy.icon_name);
        if ('TooltipText' in names) this.setTooltipText(this.proxy.tooltip_text);
        if ('Label' in names) this.setLabel(this.proxy.label);
        if ('Visible' in names) { this.wantVisible = !!this.proxy.visible; this.applet.relayout(); }
        if ('Name' in names) this.applet.relayout();
        if ('PrimaryMenuIsOpen' in names && !this.proxy.primary_menu_is_open) this.actor.sync_hover();
        if ('SecondaryMenuIsOpen' in names && !this.proxy.secondary_menu_is_open) this.actor.sync_hover();
    }

    refresh() {
        this.setIconName(this.proxy.icon_name);
        this.setLabel(this.proxy.label);
        this.setTooltipText(this.proxy.tooltip_text);
        this.wantVisible = !!this.proxy.visible;
        this.actor.vertical = !isHorizontal(this.applet.orientation);
        this.actor.queue_relayout();
    }

    // Some apps register under a bare number; fall back to the tooltip or icon name.
    get title() {
        if (this.bridgedTitle) return this.bridgedTitle;
        const name = this.appKey || '';
        if (!/^[\d._:-]*$/.test(name)) return prettyName(name);
        const tip = (this.proxy.tooltip_text || '').replace(/<[^>]*>/g, '').split('\n')[0].trim();
        if (tip) return tip.length > 32 ? tip.slice(0, 31) + '…' : tip;
        if (this.iconName) {
            const base = this.iconName.split('/').pop().replace(/\.(png|svg|xpm)$/, '').replace(/-symbolic$/, '');
            return prettyName(base);
        }
        // TRANSLATORS: fallback name for an unidentified tray icon; %s is its id
        return _('App %s').format(name);
    }

    get sortName() {
        return (this.proxy.name || '').replace('org.x.StatusIcon.', '').toLowerCase();
    }

    get symbolic() {
        return (this.proxy.icon_name || '').includes('-symbolic');
    }

    setPlacementVisible(v) {
        this.placementVisible = v;
        this.actor.visible = v && this.wantVisible;
    }

    get shown() {
        return this.wantVisible;
    }

    setIconName(iconName) {
        if (!iconName) {
            this.iconName = null;
            this._iconLoaderHandle = null;
            this._imageResourceScale = null;
            this.iconHolder.hide();
            return;
        }

        this.iconName = iconName;
        const symbolic = /symbolic/.test(iconName);
        const type = symbolic ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR;
        const size = this.applet.iconSize(type);
        this.proxy.icon_size = size;

        if (iconName.includes('/') && !symbolic) {
            // Image file: load asynchronously, keeping aspect ratio on horizontal panels.
            this._imageResourceScale = this.actor.get_resource_scale();
            const scaled = size * global.ui_scale * this._imageResourceScale;
            this._iconLoaderHandle = St.TextureCache.get_default().load_image_from_file_async(
                iconName,
                this.actor.vertical ? scaled : -1,
                scaled,
                (cache, handle, actor) => this._onImageLoaded(handle, actor));
            return;
        }

        this._iconLoaderHandle = null;
        this._imageResourceScale = null;
        this.iconHolder.child = makeIcon(iconName, size);
        this.iconHolder.show();
    }

    _onResourceScaleChanged() {
        if (this._imageResourceScale !== null &&
            this.actor.get_resource_scale() !== this._imageResourceScale)
            this.setIconName(this.iconName);
    }

    _onImageLoaded(handle, actor) {
        if (handle !== this._iconLoaderHandle) return;
        this._iconLoaderHandle = null;
        actor.set_size(actor.width / this._imageResourceScale, actor.height / this._imageResourceScale);
        this.iconHolder.child = actor;
        this.iconHolder.show();
    }

    setTooltipText(text) {
        this._tooltip.preventShow = !text;
        this._tooltip.set_markup(text || '');
        if (this._tooltip.visible) {
            this._tooltip.hide();
            this._tooltip.show();
        }
    }

    setLabel(label) {
        this.label.set_text(label || '');
        this.label.visible = this.applet.showLabels && isHorizontal(this.applet.orientation) &&
            !!label && label.length > 0;
    }

    _positionInfo(actor) {
        const a = Cinnamon.util_get_transformed_allocation(actor);
        const x = Math.round(a.x1 / global.ui_scale);
        const y = Math.round(a.y1 / global.ui_scale);
        const w = Math.round((a.x2 - a.x1) / global.ui_scale);
        const h = Math.round((a.y2 - a.y1) / global.ui_scale);

        switch (this.applet.orientation) {
            case St.Side.TOP: return [x, y + h, Gtk.PositionType.TOP];
            case St.Side.LEFT: return [x + w, y, Gtk.PositionType.LEFT];
            case St.Side.RIGHT: return [x, y, Gtk.PositionType.RIGHT];
            default: return [x, y, Gtk.PositionType.BOTTOM];
        }
    }

    _serverTime() {
        try {
            const t = global.display.get_current_time_roundtrip();
            if (t) return t;
        } catch (e) { /* fall through */ }
        return global.get_current_time();
    }

    _onPress(actor, event) {
        this._tooltip.hide();
        this._tooltip.preventShow = true;

        if (event.get_button() == Clutter.BUTTON_SECONDARY &&
            event.get_state() & Clutter.ModifierType.CONTROL_MASK)
            return Clutter.EVENT_PROPAGATE;

        const [x, y, o] = this._positionInfo(actor);
        const button = event.get_button();
        // Inside the overflow popup our own grab would stop the app's menu from
        // receiving input, and closing it hands key focus back to another window,
        // which would dismiss a menu opened at the same moment. So close the popup
        // first, let focus settle, then forward the click ourselves.
        if (this.applet.closeOverflowFor(this)) {
            this._pendingClick = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
                this._pendingClick = 0;
                if (this.actor.is_finalized()) return GLib.SOURCE_REMOVE;
                global.stage.set_key_focus(null);
                const time = this._serverTime();   // a real X timestamp; get_current_time() is 0 outside an event
                this.proxy.call_button_press(x, y, button, time, o, null, null);
                // The real release already happened (on nothing), so send it ourselves:
                // apps act on press for some clicks and on release for others.
                this._pendingClick = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
                    this._pendingClick = 0;
                    if (!this.actor.is_finalized())
                        this.proxy.call_button_release(x, y, button, this._serverTime(), o, null, null);
                    return GLib.SOURCE_REMOVE;
                });
                return GLib.SOURCE_REMOVE;
            });
            return Clutter.EVENT_STOP;
        }

        // The click is handled in another process; drop key focus so any open
        // Cinnamon menu closes before it is forwarded.
        global.stage.set_key_focus(null);
        this.proxy.call_button_press(x, y, button, event.get_time(), o, null, null);
        return Clutter.EVENT_STOP;
    }

    _onRelease(actor, event) {
        const [x, y, o] = this._positionInfo(actor);
        this.proxy.call_button_release(x, y, event.get_button(), event.get_time(), o, null, null);
        return Clutter.EVENT_STOP;
    }

    _onScroll(actor, event) {
        const d = event.get_scroll_direction();
        if (d == Clutter.ScrollDirection.SMOOTH) return Clutter.EVENT_STOP;

        let dir = XApp.ScrollDirection.UP;
        let delta = 0;
        if (d == Clutter.ScrollDirection.UP) { dir = XApp.ScrollDirection.UP; delta = -1; }
        else if (d == Clutter.ScrollDirection.DOWN) { dir = XApp.ScrollDirection.DOWN; delta = 1; }
        else if (d == Clutter.ScrollDirection.LEFT) { dir = XApp.ScrollDirection.LEFT; delta = -1; }
        else if (d == Clutter.ScrollDirection.RIGHT) { dir = XApp.ScrollDirection.RIGHT; delta = 1; }

        this.proxy.call_scroll(delta, dir, event.get_time(), null, null);
        return Clutter.EVENT_STOP;
    }

    destroy() {
        if (this._propsId) {
            this.proxy.disconnect(this._propsId);
            this._propsId = 0;
        }
        this._iconLoaderHandle = null;
        if (this._pendingClick) { GLib.source_remove(this._pendingClick); this._pendingClick = 0; }
        this._tooltip.destroy();
        this.actor.destroy();
    }
}

/* ------------------------------------------------------------------ */
/* Legacy (XEmbed) tray icon                                           */
/* ------------------------------------------------------------------ */

class LegacyItem {
    constructor(applet, icon, role) {
        this.kind = 'legacy';
        this.applet = applet;
        this.icon = icon;
        this.role = role.toLowerCase();
        this.id = 'tray:' + this.role;
        this.title = prettyName(role);
        this.iconName = null;
        this.wantVisible = true;
        this.placementVisible = true;
        this._showId = 0;
        this.destroyed = false;

        this.actor = new St.Bin({ style_class: 'traydeck-item', child: icon });
        icon.set_x_align(Clutter.ActorAlign.CENTER);
        icon.set_y_align(Clutter.ActorAlign.FILL);
        this.actor.set_y_align(Clutter.ActorAlign.FILL);

        // Give the client a moment to paint before revealing it.
        icon.visible = false;
        icon.opacity = 0;
        this._showId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._showId = 0;
            if (icon.is_finalized()) {
                this.actor.destroy();
                return GLib.SOURCE_REMOVE;
            }
            icon.reactive = true;
            icon.visible = true;
            const px = applet.iconSize() * global.ui_scale;
            icon.set_size(px, px);
            icon.ease({ opacity: 255, duration: 400, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
            icon.connect('event', (a, e) => this._onEvent(a, e));
            return GLib.SOURCE_REMOVE;
        });
    }

    get sortName() { return this.role; }
    get symbolic() { return false; }
    get shown() { return true; }

    setPlacementVisible(v) {
        this.placementVisible = v;
        this.actor.visible = v;
    }

    resize() {
        const s = this.applet.iconSize() * global.ui_scale;   // legacy icons are sized in device pixels
        if (!this.icon.is_finalized() && this.icon.visible) this.icon.set_size(s, s);
    }

    refresh() {
        this.resize();
    }

    _onEvent(icon, event) {
        const type = event.type();
        if (this.actor == null || icon.get_parent() == null) return GLib.SOURCE_REMOVE;

        if (type === Clutter.EventType.BUTTON_PRESS) this.applet.closeOverflowFor(this);

        if (type === Clutter.EventType.ENTER) this.actor.add_style_pseudo_class('hover');
        else if (type === Clutter.EventType.LEAVE) this.actor.remove_style_pseudo_class('hover');

        // Same as the stock systray applet: briefly go modal on a press so the
        // panel's implicit pointer grab is released and the tray app's own menu
        // can take the pointer. The modal is always ended before returning.
        const dropGrab = type === Clutter.EventType.BUTTON_PRESS &&
            global.begin_modal(global.get_current_time(), 0);
        try {
            return icon.handle_event(type, event);
        } finally {
            if (dropGrab) global.end_modal(Meta.CURRENT_TIME);
        }
    }

    destroy() {
        this.destroyed = true;
        if (this._showId) {
            GLib.source_remove(this._showId);
            this._showId = 0;
        }
        const parent = this.actor.get_parent();
        if (parent) parent.remove_child(this.actor);
        if (this.icon.get_parent() === this.actor && !this.icon.is_finalized())
            this.actor.remove_actor(this.icon);
        this.actor.destroy();
    }
}

/* ------------------------------------------------------------------ */
/* The applet                                                          */
/* ------------------------------------------------------------------ */

class TraydeckApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this.orientation = orientation;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.actor.remove_style_class_name('applet-box');
        this.actor.add_style_class_name('traydeck');
        this.actor.set_important(true);

        this.items = new Map();       // id -> item
        this.signals = new SignalManager.SignalManager(null);
        this.ignoredProxies = {};
        this._pendingProxies = new Set();
        this._scaleUpdateId = 0;
        this._relayoutId = 0;

        this._bindSettings(instanceId);

        // Layout: [chevron?] [main icons] [chevron?]
        this.root = new St.BoxLayout({ vertical: !isHorizontal(orientation) });
        this.actor.add_actor(this.root);

        this.mainBox = new St.BoxLayout({ vertical: !isHorizontal(orientation) });
        this.recorder = new RecorderIcon(this);
        this.mainBox.add_actor(this.recorder.actor);

        this.chevron = new St.Button({
            style_class: 'traydeck-chevron',
            reactive: true,
            can_focus: true,
            toggle_mode: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.chevronIcon = null;
        this.chevronTooltip = new Tooltips.PanelItemTooltip({ actor: this.chevron }, '', orientation);
        this.chevron.connect('clicked', () => {
            if (this.managerMenu.isOpen) this.managerMenu.close();
            this.overflowMenu.toggle();
        });

        this.root.add_actor(this.chevron);
        this.root.add_actor(this.mainBox);

        // Our popups get their own manager. The applet's manager also holds the
        // right-click menu, and sharing it made hovering the applet while the
        // overflow popup was open jump to the right-click or manager menu.
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this._buildOverflowMenu();
        this._buildManagerMenu();
        this._buildContextMenu();

        this._applyStyle();
        this._updateChevron();
    }

    /* ---- settings ---------------------------------------------------- */

    _bindSettings(instanceId) {
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, instanceId);
        const b = (key, prop, cb) =>
            this.settings.bind(key, prop, cb ? () => cb.call(this) : null);
        b('icon-size-auto', 'sizeAuto', this._onLookChanged);
        b('icon-size', 'customSize', this._onLookChanged);
        b('spacing', 'spacing', this._onLookChanged);
        b('hover-highlight', 'hoverHighlight', this._onLookChanged);
        b('show-labels', 'showLabels', this._onLookChanged);
        b('overflow-position', 'overflowPosition', this._onLookChanged);
        b('icon-config', 'config', this._onConfigChanged);
        this._dropJunkIds();
    }

    // Older versions named bridged icons that appeared with a blank tooltip "-", "-#2"...
    // Those ids never come back, so forget them.
    _dropJunkIds() {
        const cfg = this.cfg;
        const junk = id => /^xapp:-(#\d+)?$/.test(id);
        const ids = [...Object.keys(cfg.items), ...Object.keys(cfg.seen), ...cfg.order].filter(junk);
        if (!ids.length) return;
        for (const id of ids) { delete cfg.items[id]; delete cfg.seen[id]; }
        cfg.order = cfg.order.filter(id => !junk(id));
        this.config = cfg;
        this.settings.setValue('icon-config', cfg);
    }

    on_manage_clicked() {
        // The settings window is still in front; let the click settle first.
        Mainloop.timeout_add(150, () => {
            this.openManager();
            return GLib.SOURCE_REMOVE;
        });
    }

    on_reset_clicked() {
        // Keep the previous layout so a reset is never destructive.
        try {
            const dir = GLib.build_filenamev([GLib.get_user_state_dir(), this.metadata.uuid]);
            GLib.mkdir_with_parents(dir, 0o755);
            const data = new TextEncoder().encode(JSON.stringify(this.cfg, null, 2));
            Gio.File.new_for_path(GLib.build_filenamev([dir, 'icon-config.backup.json'])).replace_contents_bytes_async(
                new GLib.Bytes(data), null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null,
                (file, res) => {
                    try { file.replace_contents_finish(res); } catch (e) { global.logError(e); }
                });
        } catch (e) {
            global.logError(e);
        }
        this.saveConfig({ items: {}, order: [], seen: {} });
    }

    _onLookChanged() {
        this._applyStyle();
        this.refreshIcons();
    }

    _onConfigChanged() {
        this.relayout();
        if (this.managerMenu.isOpen) this._buildManagerRows();
    }

    get cfg() {
        const c = this.config || {};
        return { items: c.items || {}, order: c.order || [], seen: c.seen || {} };
    }

    saveConfig(cfg) {
        this.config = cfg;                              // triggers the settings write
        this.settings.setValue('icon-config', cfg);
        this._onConfigChanged();
    }

    modeOf(id) {
        const entry = this.cfg.items[id];
        return entry && MODES.includes(entry.mode) ? entry.mode : 'show';
    }

    iconSize(type) {
        if (!this.sizeAuto) return this.customSize;
        return this.getPanelIconSize(type === undefined ? St.IconType.FULLCOLOR : type);
    }

    _applyStyle() {
        const gap = this.spacing;
        this.mainBox.style = `spacing: ${gap}px;`;
        this.root.style = `spacing: ${gap}px;`;
        if (this.overflowBox) this.overflowBox.style = `spacing: ${gap}px;`;
        if (this.hoverHighlight) this.actor.add_style_class_name('traydeck-hover');
        else this.actor.remove_style_class_name('traydeck-hover');
    }

    /* ---- lifecycle --------------------------------------------------- */

    on_applet_added_to_panel() {
        // Start the legacy tray dispatcher unless we are just being reloaded.
        if (!global.trayReloading)
            Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());

        this._updateTrayOrientation();

        const sd = Main.statusIconDispatcher;
        this.signals.connect(sd, 'status-icon-added', this._onLegacyAdded, this);
        this.signals.connect(sd, 'status-icon-removed', this._onLegacyRemoved, this);
        this.signals.connect(sd, 'before-redisplay', this._onBeforeRedisplay, this);
        this.signals.connect(Main.systrayManager, 'changed', this._onSystrayRolesChanged, this);
        this.signals.connect(global, 'scale-changed', this._onScaleChanged, this);
        this.signals.connect(global.settings, 'changed::panel-edit-mode', this._onEditModeChanged, this);
        this.signals.connect(Gtk.IconTheme.get_default(), 'changed', this.refreshIcons, this);
        // Applets can hold both symbolic and full-colour icons, so listen to the panel directly.
        this.signals.connect(this.panel, 'icon-size-changed', this.refreshIcons, this);

        this.monitor = new XApp.StatusIconMonitor();
        this.signals.connect(this.monitor, 'icon-added', this._onXAppAdded, this);
        this.signals.connect(this.monitor, 'icon-removed', this._onXAppRemoved, this);

        // Either we were reloaded, or another tray applet already started the
        // dispatcher: ask it to re-send every legacy icon so we pick them up.
        global.trayReloading = false;
        sd.redisplay();
    }

    on_applet_reloaded() {
        global.trayReloading = true;
    }

    on_applet_removed_from_panel() {
        if (this._scaleUpdateId) { Mainloop.source_remove(this._scaleUpdateId); this._scaleUpdateId = 0; }
        if (this._relayoutId) { Mainloop.source_remove(this._relayoutId); this._relayoutId = 0; }
        this.signals.disconnectAllSignals();
        this.settings.finalize();

        for (const item of this.items.values()) item.destroy();
        this.items.clear();
        this.ignoredProxies = {};
        this._pendingProxies.clear();

        this.recorder.destroy();
        this.monitor = null;
        this.menuManager.removeMenu(this.overflowMenu);
        this.menuManager.removeMenu(this.managerMenu);
        this.overflowMenu.destroy();
        this.managerMenu.destroy();
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        const vertical = !isHorizontal(orientation);
        this.root.vertical = vertical;
        this.mainBox.vertical = vertical;
        if (this.overflowBox) this.overflowBox.vertical = vertical;
        this._updateTrayOrientation();
        this._updateChevron();
        this.refreshIcons();
    }

    on_panel_icon_size_changed() {
        this.refreshIcons();
    }

    _updateTrayOrientation() {
        Main.statusIconDispatcher.set_tray_orientation(isHorizontal(this.orientation)
            ? Clutter.Orientation.HORIZONTAL : Clutter.Orientation.VERTICAL);
    }

    _onScaleChanged() {
        if (this._scaleUpdateId) Mainloop.source_remove(this._scaleUpdateId);
        this._scaleUpdateId = Mainloop.timeout_add(1500, () => {
            this._scaleUpdateId = 0;
            this.refreshIcons();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onEditModeChanged() {
        const reactive = !global.settings.get_boolean('panel-edit-mode');
        for (const item of this.items.values())
            if (item.kind === 'xapp') item.actor.reactive = reactive;
        this.refreshIcons();
    }

    refreshIcons() {
        for (const item of this.items.values()) item.refresh();
        this.recorder.refresh();
        this._updateChevron();
        this.relayout();
    }

    /* ---- XApp status icons ------------------------------------------ */

    _proxyKey(proxy) {
        return proxy.get_name() + proxy.get_object_path();
    }

    _shouldIgnoreProxy(proxy) {
        return Main.systrayManager.getRoles().indexOf((proxy.name || '').toLowerCase()) != -1;
    }

    _onXAppAdded(monitor, proxy) {
        const key = this._proxyKey(proxy);
        if (this._pendingProxies.has(key)) return;
        for (const item of this.items.values())
            if (item.proxy === proxy) return;
        if (this._shouldIgnoreProxy(proxy)) {
            this.ignoredProxies[key] = proxy;
            return;
        }
        this._addXApp(proxy);
    }

    _addXApp(proxy) {
        const key = this._proxyKey(proxy);
        this._pendingProxies.add(key);
        resolveAppKey(proxy, async appKey => {
            if (!this._pendingProxies.has(key) || !this.signals) return;
            let bridgedTitle = null;
            let aliases = [];
            // StatusNotifier apps are all bridged through one helper process, so look
            // through it to the app that really owns the icon.
            if (appKey === 'xapp-sn-watcher') {
                const legacy = legacyBridgedKey(proxy.tooltip_text, proxy.icon_name);
                let found = null;
                try { found = await resolveBridged(proxy); } catch (e) { global.logError(e); }
                if (found) {
                    appKey = found.key;
                    bridgedTitle = found.title;
                    aliases = [legacy, ...found.aliases];
                } else {
                    // No match: xapp-sn-watcher's name for it is set once, when the icon
                    // is created, so it is steadier than the tooltip.
                    const name = String(proxy.name || '');
                    const clean = /^[a-z][\w.-]*$/i.test(name) && !/statusnotifieritem/i.test(name);
                    appKey = clean ? name.toLowerCase() : legacy;
                    bridgedTitle = clean ? prettyName(name) : (legacy === 'tray-app' ? 'tray-app' : prettyName(legacy));
                    aliases = [legacy];
                }
            }
            if (!this._pendingProxies.delete(key) || !this.signals) return;   // removed meanwhile
            // Two icons from the same program get distinct, stable ids.
            let id = appKey, n = 2;
            while (this.items.has('xapp:' + id)) id = `${appKey}#${n++}`;
            if (id === appKey) this._adoptLegacySettings('xapp:' + id, aliases.map(a => 'xapp:' + a));
            this._addItem(new XAppItem(this, proxy, id, bridgedTitle));
        });
    }

    // Bridged icons used to be named after their tooltip, which changes (and is often
    // blank when the icon first appears). Carry the mode and position of the old id
    // over to the new one the first time the new one shows up.
    _adoptLegacySettings(id, oldIds) {
        const cfg = this.cfg;
        if (cfg.items[id] || cfg.seen[id]) return;
        const old = oldIds.find(o => o !== id && (cfg.items[o] || cfg.order.includes(o)));
        if (!old) return;
        if (cfg.items[old]) cfg.items[id] = cfg.items[old];
        delete cfg.items[old];
        const i = cfg.order.indexOf(old);
        if (i >= 0 && !cfg.order.includes(id)) cfg.order[i] = id;
        else if (i >= 0) cfg.order.splice(i, 1);
        delete cfg.seen[old];
        global.log(`Traydeck: moved settings of ${old} to ${id}`);
        this.config = cfg;
        this.settings.setValue('icon-config', cfg);
    }

    _onXAppRemoved(monitor, proxy) {
        const key = this._proxyKey(proxy);
        delete this.ignoredProxies[key];
        this._pendingProxies.delete(key);
        for (const item of [...this.items.values()])
            if (item.kind === 'xapp' && item.proxy === proxy) this._removeItem(item.id);
    }

    _onSystrayRolesChanged() {
        for (const item of [...this.items.values()]) {
            if (item.kind === 'xapp' && this._shouldIgnoreProxy(item.proxy)) {
                this.ignoredProxies[this._proxyKey(item.proxy)] = item.proxy;
                this._removeItem(item.id);
            }
        }
        for (const key of Object.keys(this.ignoredProxies)) {
            const proxy = this.ignoredProxies[key];
            if (!this._shouldIgnoreProxy(proxy)) {
                delete this.ignoredProxies[key];
                this._addXApp(proxy);
            }
        }
    }

    /* ---- legacy tray icons ------------------------------------------ */

    _onLegacyAdded(o, icon, role) {
        try {
            if (Main.systrayManager.getRoles().indexOf(role.toLowerCase()) != -1) {
                global.log('Traydeck: hiding systray ' + role + ' (a native applet handles it)');
                return;
            }
            this._addItem(new LegacyItem(this, icon, role));
        } catch (e) {
            global.logError(e);
        }
    }

    _onLegacyRemoved(o, icon) {
        for (const item of [...this.items.values()])
            if (item.kind === 'legacy' && item.icon === icon) this._removeItem(item.id);
    }

    _onBeforeRedisplay() {
        // The dispatcher re-sends every legacy icon, so drop ours first.
        for (const item of [...this.items.values()])
            if (item.kind === 'legacy') this._removeItem(item.id);
    }

    /* ---- item bookkeeping ------------------------------------------- */

    _addItem(item) {
        const old = this.items.get(item.id);
        if (old) { old.destroy(); this.items.delete(item.id); }
        this.items.set(item.id, item);
        this.mainBox.add_actor(item.actor);
        this._remember(item);
        this.relayout();
    }

    _removeItem(id) {
        const item = this.items.get(id);
        if (!item) return;
        this.items.delete(id);
        item.destroy();
        this.relayout();
        if (this.managerMenu.isOpen) this._buildManagerRows();
    }

    // Remember what an icon looked like so it can still be managed while it isn't running.
    _remember(item) {
        const cfg = this.cfg;
        const prev = cfg.seen[item.id];
        const icon = item.iconName || (prev && prev.icon) || null;
        if (prev && prev.title === item.title && prev.icon === icon) return;
        cfg.seen[item.id] = { title: item.title, icon: icon };
        this.config = cfg;
        this.settings.setValue('icon-config', cfg);
    }

    // If `item` lives in the open overflow popup, close the popup right now.
    // Returns true when it did.
    closeOverflowFor(item) {
        if (!this.overflowMenu.isOpen || this.modeOf(item.id) !== 'overflow') return false;
        this.overflowMenu.close();
        return true;
    }

    // Default order: alphabetical, with symbolic icons last (matches the stock applet).
    _defaultCompare(a, b) {
        if (a.symbolic !== b.symbolic) return a.symbolic ? 1 : -1;
        return GLib.utf8_collate(a.sortName, b.sortName);
    }

    // Ids in display order. `liveOnly` excludes remembered-but-not-running icons.
    orderedIds(liveOnly) {
        const cfg = this.cfg;
        const ids = new Set(this.items.keys());
        if (!liveOnly) for (const id of Object.keys(cfg.seen)) ids.add(id);

        const rank = new Map(cfg.order.map((id, i) => [id, i]));
        const known = [...ids].filter(id => rank.has(id)).sort((a, b) => rank.get(a) - rank.get(b));
        const fresh = [...ids].filter(id => !rank.has(id));
        fresh.sort((a, b) => {
            const ia = this.items.get(a), ib = this.items.get(b);
            if (ia && ib) return this._defaultCompare(ia, ib);
            if (ia) return -1;
            if (ib) return 1;
            return GLib.utf8_collate(a, b);
        });
        return known.concat(fresh);
    }

    /* ---- layout ------------------------------------------------------ */

    relayout() {
        if (!this.mainBox || this._relayoutId) return;
        // Coalesce bursts (apps often add several icons at once).
        this._relayoutId = Mainloop.idle_add(() => {
            this._relayoutId = 0;
            this._doLayout();
            return GLib.SOURCE_REMOVE;
        });
    }

    _doLayout() {
        if (!this.overflowBox) return;
        let mainIdx = 0, ovIdx = 0, ovCount = 0;

        for (const id of this.orderedIds(true)) {
            const item = this.items.get(id);
            if (!item) continue;
            const mode = this.modeOf(id);
            const target = mode === 'overflow' ? this.overflowBox : this.mainBox;

            const parent = item.actor.get_parent();
            if (parent !== target) {
                if (parent) parent.remove_child(item.actor);
                target.add_child(item.actor);
            }
            target.set_child_at_index(item.actor, mode === 'overflow' ? ovIdx++ : mainIdx++);
            item.setPlacementVisible(mode !== 'hide');
            if (mode === 'overflow' && item.shown) ovCount++;
        }

        this.mainBox.set_child_at_index(this.recorder.actor, -1);
        this.overflowCount = ovCount;
        this._updateChevron();
    }

    // Register a menu without Cinnamon's "hover another menu's source to switch to it".
    _addMenuNoHover(menu) {
        const src = menu.sourceActor;
        menu.sourceActor = null;
        this.menuManager.addMenu(menu);
        menu.sourceActor = src;
    }

    /* ---- overflow popup --------------------------------------------- */

    _buildOverflowMenu() {
        this.overflowMenu = new PopupMenu.PopupMenu(this.chevron, this.orientation);
        Main.uiGroup.add_actor(this.overflowMenu.actor);
        this.overflowMenu.actor.hide();
        this._addMenuNoHover(this.overflowMenu);
        this.overflowMenu.connect('open-state-changed', (m, open) => {
            try { this.chevron.checked = open; } catch (e) { global.logError(e); }
        });

        this.overflowBox = new St.BoxLayout({
            style_class: 'traydeck-overflow',
            vertical: !isHorizontal(this.orientation),
        });
        this.overflowEmpty = new St.Label({
            text: _('Nothing tucked away'),
            style_class: 'traydeck-subtitle',
            style: 'padding: 8px 10px 4px 10px;',
        });

        const footer = new St.BoxLayout({ style_class: 'traydeck-footer', vertical: !isHorizontal(this.orientation) });
        const mk = (label, cb) => {
            const b = new St.Button({ label: label, style_class: 'traydeck-link', reactive: true, x_expand: true });
            b.connect('clicked', () => {
                this.overflowMenu.close();
                Mainloop.idle_add(() => { cb(); return GLib.SOURCE_REMOVE; });
            });
            return b;
        };
        footer.add_actor(mk(_('Manage icons…'), () => this.openManager()));
        footer.add_actor(mk(_('Settings'), () => this.configureApplet()));
        this.overflowFooter = footer;

        const card = new St.BoxLayout({ vertical: true });
        card.add_actor(this.overflowBox);
        card.add_actor(this.overflowEmpty);
        card.add_actor(footer);
        this.overflowMenu.addActor(card);
        this.overflowCount = 0;
    }

    _updateChevron() {
        const icons = {
            [St.Side.TOP]: 'pan-down-symbolic',
            [St.Side.BOTTOM]: 'pan-up-symbolic',
            [St.Side.LEFT]: 'pan-end-symbolic',
            [St.Side.RIGHT]: 'pan-start-symbolic',
        };
        const name = icons[this.orientation] || 'pan-down-symbolic';
        const size = Math.max(12, Math.round(this.iconSize(St.IconType.SYMBOLIC) * 0.7));
        if (this._chevronName !== name || this._chevronSize !== size) {
            this._chevronName = name;
            this._chevronSize = size;
            this.chevron.set_child(new St.Icon({
                icon_name: name, icon_type: St.IconType.SYMBOLIC, icon_size: size,
            }));
        }
        const n = this.overflowCount || 0;
        this.chevron.visible = true;       // always reachable: it is the way to the manager
        this.overflowEmpty.visible = n === 0;
        this.overflowBox.visible = n > 0;
        this.chevronTooltip.set_markup(n === 0 ? _('Tray icons')
            : ngettext('Tray icons · %d tucked away', 'Tray icons · %d tucked away', n).format(n));

        // Chevron before or after the icons.
        this.root.set_child_at_index(this.chevron, this.overflowPosition === 'end' ? -1 : 0);
    }

    /* ---- context menu ------------------------------------------------ */

    _buildContextMenu() {
        const item = new PopupMenu.PopupMenuItem(_('Manage tray icons…'));
        item.connect('activate', () => {
            // Let the context menu finish closing before taking the grab.
            Mainloop.idle_add(() => { this.openManager(); return GLib.SOURCE_REMOVE; });
        });
        this._applet_context_menu.addMenuItem(item, 0);
    }

    /* ---- manager popup ---------------------------------------------- */

    _buildManagerMenu() {
        this.managerMenu = new Applet.AppletPopupMenu(this, this.orientation);
        this._addMenuNoHover(this.managerMenu);

        const card = new St.BoxLayout({ style_class: 'traydeck-manager', vertical: true });

        const header = new St.BoxLayout({ style: 'spacing: 8px; padding-bottom: 8px;' });
        const titles = new St.BoxLayout({ vertical: true, x_expand: true });
        titles.add_actor(new St.Label({ text: _('Tray icons'), style_class: 'traydeck-title' }));
        titles.add_actor(new St.Label({
            text: _('Choose what shows, what tucks away, and the order.'),
            style_class: 'traydeck-subtitle',
        }));
        header.add_actor(titles);

        const settingsBtn = new St.Button({ label: _('Settings'), style_class: 'traydeck-link', reactive: true });
        settingsBtn.connect('clicked', () => {
            this.managerMenu.close();
            this.configureApplet();
        });
        const resetBtn = new St.Button({ label: _('Reset'), style_class: 'traydeck-link', reactive: true });
        resetBtn.connect('clicked', () => {
            // Two clicks: the first arms it, the second confirms.
            if (!this._resetArmed) {
                this._resetArmed = true;
                resetBtn.label = _('Click again to reset');
                this._resetTimer = Mainloop.timeout_add(3000, () => {
                    this._resetArmed = false;
                    this._resetTimer = 0;
                    if (!resetBtn.is_finalized()) resetBtn.label = _('Reset');
                    return GLib.SOURCE_REMOVE;
                });
                return;
            }
            if (this._resetTimer) { Mainloop.source_remove(this._resetTimer); this._resetTimer = 0; }
            this._resetArmed = false;
            resetBtn.label = _('Reset');
            this.on_reset_clicked();
        });
        header.add_actor(settingsBtn);
        header.add_actor(resetBtn);
        card.add_actor(header);

        this.managerList = new St.BoxLayout({ vertical: true, style: 'spacing: 2px;' });
        this.managerScroll = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            style: 'max-height: 460px;',
        });
        this.managerScroll.add_actor(this.managerList);
        card.add_actor(this.managerScroll);

        this.managerMenu.addActor(card);
        this.managerMenu.connect('open-state-changed', (m, open) => {
            try { if (open) this._buildManagerRows(); } catch (e) { global.logError(e); }
        });
    }

    openManager() {
        if (this.overflowMenu.isOpen) this.overflowMenu.close();
        if (this._applet_context_menu.isOpen) this._applet_context_menu.close();
        this._buildManagerRows();
        this.managerMenu.open();
    }

    _buildManagerRows() {
        this.managerList.destroy_all_children();
        const cfg = this.cfg;
        const ids = this.orderedIds(false);

        // Refresh remembered looks for icons that are running now.
        let changed = false;
        for (const item of this.items.values()) {
            const icon = item.iconName || (cfg.seen[item.id] && cfg.seen[item.id].icon) || null;
            const prev = cfg.seen[item.id];
            if (!prev || prev.icon !== icon || prev.title !== item.title) {
                cfg.seen[item.id] = { title: item.title, icon: icon };
                changed = true;
            }
        }
        if (changed) { this.config = cfg; this.settings.setValue('icon-config', cfg); }

        if (ids.length === 0) {
            this.managerList.add_actor(new St.Label({
                text: _('No tray icons yet. They will appear here as apps start.'),
                style_class: 'traydeck-subtitle',
                style: 'padding: 24px 8px;',
            }));
            return;
        }

        ids.forEach((id, index) => {
            const live = this.items.get(id);
            const seen = cfg.seen[id] || {};
            const title = live ? live.title : (seen.title || prettyName(id.split(':')[1]));
            const iconName = (live && live.iconName) || seen.icon || 'application-x-executable';
            this.managerList.add_actor(this._buildRow(id, title, iconName, !!live, index, ids.length));
        });
    }

    _buildRow(id, title, iconName, live, index, total) {
        const row = new St.BoxLayout({
            style_class: 'traydeck-row' + (live ? '' : ' traydeck-row-dim'),
            reactive: true,
            track_hover: true,
        });
        if (!live) row.opacity = 140;

        let icon;
        try { icon = makeIcon(iconName, 24); }
        catch (e) { icon = new St.Icon({ icon_name: 'application-x-executable', icon_size: 24 }); }
        row.add_actor(new St.Bin({ child: icon, y_align: Clutter.ActorAlign.CENTER }));

        const names = new St.BoxLayout({ vertical: true, x_expand: true, y_align: Clutter.ActorAlign.CENTER });
        names.add_actor(new St.Label({ text: title, style_class: 'traydeck-row-name' }));
        names.add_actor(new St.Label({
            text: live ? (id.startsWith('xapp:') ? _('Status icon') : _('System tray icon')) : _('Not running'),
            style_class: 'traydeck-subtitle',
        }));
        row.add_actor(names);

        // Show / Overflow / Hide
        const seg = new St.BoxLayout({ style_class: 'traydeck-seg', y_align: Clutter.ActorAlign.CENTER });
        const current = this.modeOf(id);
        for (const mode of MODES) {
            const btn = new St.Button({
                label: MODE_LABELS[mode],
                style_class: 'traydeck-seg-btn' + (mode === current ? ' active' : ''),
                reactive: true,
            });
            btn.connect('clicked', () => this.setMode(id, mode));
            seg.add_actor(btn);
        }
        row.add_actor(seg);

        // Reorder
        const moves = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER, style: 'spacing: 2px;' });
        for (const [dir, iconN] of [[-1, 'go-up-symbolic'], [1, 'go-down-symbolic']]) {
            const btn = new St.Button({
                style_class: 'traydeck-move',
                child: new St.Icon({ icon_name: iconN, icon_type: St.IconType.SYMBOLIC, icon_size: 14 }),
                reactive: true,
                can_focus: true,
            });
            const edge = dir < 0 ? index === 0 : index === total - 1;
            if (edge) btn.reactive = false, btn.add_style_pseudo_class('insensitive');
            else btn.connect('clicked', () => this.moveItem(id, dir));
            moves.add_actor(btn);
        }
        row.add_actor(moves);
        return row;
    }

    setMode(id, mode) {
        const cfg = this.cfg;
        cfg.items[id] = Object.assign({}, cfg.items[id], { mode: mode });
        this.saveConfig(cfg);
    }

    moveItem(id, dir) {
        const cfg = this.cfg;
        const order = this.orderedIds(false);   // materialize the full visible order
        const i = order.indexOf(id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= order.length) return;
        [order[i], order[j]] = [order[j], order[i]];
        cfg.order = order;
        this.saveConfig(cfg);
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new TraydeckApplet(metadata, orientation, panelHeight, instanceId);
}
