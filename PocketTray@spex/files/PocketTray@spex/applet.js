// PocketTray - based on systray@cinnamon.org and xapp-status@cinnamon.org
// (linuxmint/cinnamon, GPL-2.0+).
// Hosts both kinds of tray icons:
//  - XEmbed icons (legacy X11 tray), identified by their role / WM_CLASS
//  - XApp status icons (incl. StatusNotifierItems bridged by xapp-sn-watcher),
//    identified by their name or, for anonymous SNIs, their process name
// Icons whose identifier is on the "hidden-apps" list go into a collapsible
// pocket instead of the main panel box.

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;
const Gettext = imports.gettext;
const AppletManager = imports.ui.appletManager;
const Extension = imports.ui.extension;
const Cinnamon = imports.gi.Cinnamon;
const XApp = imports.gi.XApp;
const XAppIcons = require('./xappStatusIcon');

const UUID = "PocketTray@spex";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return Gettext.dgettext(UUID, str);
}

// Applets that show tray icons but do not declare "role": "tray".
// Applets that do declare the role are detected via their metadata.json.
const KNOWN_TRAY_APPLETS = [
    "systray@cinnamon.org",
    "collapsible-systray@feuerfuchs.eu",
    "xapp-status@cinnamon.org"
];
// Bundled pocket icons (icons/pockettray-<key>-symbolic.svg). All of them
// are drawn for a bottom panel; directional ones get rotated to point to
// where the pocket opens.
const POCKET_ICONS = {
    arrow:  { directional: true,  flipWhenOpen: true  },
    drawer: { directional: true,  flipWhenOpen: false },
    pocket: { directional: false, flipWhenOpen: false },
    dots:   { directional: false, flipWhenOpen: false },
    grid:   { directional: false, flipWhenOpen: false },
    circles:   { directional: false, flipWhenOpen: false },
    triangles: { directional: false, flipWhenOpen: false },
    "triangles-down": { directional: false, flipWhenOpen: false }
};


const MENU_ICON_SIZE = 16;

// Context-menu row: [app icon] [name] .......... [switch]
// Same behaviour as PopupSwitchMenuItem (keeps the menu open on toggle),
// with an icon in front of the label.
class IconSwitchMenuItem extends PopupMenu.PopupSwitchMenuItem {
    _init(text, active, iconActor, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({ text: text });
        this._statusLabel = new St.Label({ text: '', style_class: 'popup-inactive-menu-item' });
        this.actor.label_actor = this.label;
        this._switch = new PopupMenu.Switch(active);

        if (iconActor) {
            this.addActor(iconActor, { span: 0 });
        }
        this.addActor(this.label);
        this.addActor(this._statusLabel);

        this._statusBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._statusBin, { expand: true, span: -1, align: St.Align.END });
        this._statusBin.child = this._switch.actor;
    }
}

class PocketTrayApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.remove_style_class_name('applet-box');
        this.actor.set_style_class_name('systray');
        this.actor.set_important(true);

        this._uuid_ = metadata.uuid;
        this._instanceId = instance_id;
        this._shuttingDown = false;

        // XApp status icons: every proxy the monitor reports, and the icons
        // we actually show (proxies claimed by a dedicated applet are left out)
        this._monitor = null;
        this._xappProxies = {};
        this._xappIcons = {};
        this._recorder = null;

        this._signalManager = new SignalManager.SignalManager(null);
        this._scaleUpdateId = 0;
        this._redisplayIdleId = 0;
        this._hoverOpenId = 0;
        this._hoverCloseId = 0;

        this.orientation = orientation;
        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR) * global.ui_scale;

        // --- Settings ---------------------------------------------------
        this.hiddenApps = [];
        this.openTrigger = "click";
        this.hoverDelay = 300;
        this.closeDelay = 500;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("hidden-apps", "hiddenApps", this._onHiddenAppsChanged.bind(this));
        this.settings.bind("open-trigger", "openTrigger");
        this.settings.bind("hover-delay", "hoverDelay");
        this.settings.bind("close-delay", "closeDelay");
        this.pocketIcon = "triangles";
        this.customIcon = "";
        this.settings.bind("pocket-icon", "pocketIcon", () => this._updateToggleIcon());
        this.settings.bind("custom-icon", "customIcon", () => this._updateToggleIcon());
        this.pocketPosition = "right";
        this.settings.bind("pocket-position", "pocketPosition", () => this._updateTogglePosition());

        // Make the bundled SVGs available as themed (recolourable) icons.
        const iconTheme = Gtk.IconTheme.get_default();
        const iconDir = metadata.path + "/icons";
        if (!iconTheme.get_search_path().includes(iconDir)) {
            iconTheme.append_search_path(iconDir);
        }

        // --- Main box: icons that stay permanently visible ---------------
        this.button_box = new St.BoxLayout({ vertical: this._isVertical() });
        this.actor.add_actor(this.button_box);
        this.button_box.show();

        // --- Pocket toggle button (only visible when the pocket has icons)
        this.pocket_toggle = new St.Button({
            style_class: 'applet-box',
            reactive: true,
            track_hover: true,
            can_focus: true,
            visible: false
        });
        this.pocket_toggle_icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            icon_size: this.getPanelIconSize(St.IconType.SYMBOLIC)
        });
        this.pocket_toggle_icon.set_pivot_point(0.5, 0.5);  // rotate around centre
        this.pocket_toggle.set_child(this.pocket_toggle_icon);
        this._updateToggleIcon();
        this.pocket_toggle.connect('clicked', () => this._onToggleClicked());
        this.pocket_toggle.connect('enter-event', () => this._onToggleEnter());
        this.pocket_toggle.connect('leave-event', () => this._onPocketLeave());
        this.actor.add_actor(this.pocket_toggle);
        this._updateTogglePosition();

        // --- Pocket container: popup that holds the hidden icons ---------
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        // Anchor the pocket to the toggle button instead of the whole applet:
        // PopupMenu centres itself on sourceActor and clamps to the monitor.
        this.menu.sourceActor = this.pocket_toggle;
        this.menuManager.addMenu(this.menu);
        this.menu.connect('open-state-changed', (menu, open) => {
            this._updateToggleIcon();
            this.pocket_toggle.change_style_pseudo_class("checked", open);
        });
        this.menu.actor.connect('enter-event', () => this._cancelHoverClose());
        this.menu.actor.connect('leave-event', () => this._onPocketLeave());

        this.pocket_box = new St.BoxLayout({ vertical: this._isVertical() });
        let pocketItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, activate: false });
        pocketItem.addActor(this.pocket_box, { expand: true });
        this.menu.addMenuItem(pocketItem);

        // --- Context menu: one switch per tray icon ("keep in pocket") ---
        // Added before Cinnamon appends its own items (About, Configure...).
        this._iconsSection = new PopupMenu.PopupMenuSection();
        this._applet_context_menu.addMenuItem(this._iconsSection, 0);
        this._applet_context_menu.connect('open-state-changed', (menu, open) => {
            if (open) this._buildIconsSection();
        });
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    _isVertical() {
        return [St.Side.LEFT, St.Side.RIGHT].includes(this.orientation);
    }

    // used by xappStatusIcon.js
    isVertical() {
        return this._isVertical();
    }

    _toggleIconName(open) {
        switch (this.orientation) {
            case St.Side.TOP:    return open ? "pan-up-symbolic"    : "pan-down-symbolic";
            case St.Side.BOTTOM: return open ? "pan-down-symbolic"  : "pan-up-symbolic";
            case St.Side.LEFT:   return open ? "pan-start-symbolic" : "pan-end-symbolic";
            default:             return open ? "pan-end-symbolic"   : "pan-start-symbolic";
        }
    }

    // Pocket button before (left/top) or after (right/bottom) the icons.
    _updateTogglePosition() {
        if (!this.pocket_toggle) return;  // settings callback before construction finished
        const index = this.pocketPosition === "left" ? 0 : this.actor.get_n_children() - 1;
        this.actor.set_child_at_index(this.pocket_toggle, index);
    }

    // Rotation that turns an upward-pointing icon towards the pocket.
    _openDirectionAngle() {
        switch (this.orientation) {
            case St.Side.TOP:   return 180;   // pocket opens downwards
            case St.Side.LEFT:  return 90;    // ... to the right
            case St.Side.RIGHT: return 270;   // ... to the left
            default:            return 0;     // bottom panel: upwards
        }
    }

    _updateToggleIcon() {
        const icon = this.pocket_toggle_icon;
        if (!icon) return;  // settings callback before construction finished

        const open = this.menu ? this.menu.isOpen : false;
        let angle = 0;

        icon.set_icon_size(this.getPanelIconSize(St.IconType.SYMBOLIC));

        if (this.pocketIcon === "custom" && this.customIcon) {
            // iconfilechooser gives either an absolute path or an icon name
            if (this.customIcon.startsWith("/")) {
                icon.set_gicon(new Gio.FileIcon({ file: Gio.File.new_for_path(this.customIcon) }));
            } else {
                icon.set_icon_name(this.customIcon);
            }
        } else if (POCKET_ICONS[this.pocketIcon]) {
            const def = POCKET_ICONS[this.pocketIcon];
            icon.set_icon_name("pockettray-" + this.pocketIcon + "-symbolic");
            if (def.directional) angle = this._openDirectionAngle();
            if (def.flipWhenOpen && open) angle += 180;
        } else {
            // "theme" or custom without a file: theme arrow
            icon.set_icon_name(this._toggleIconName(open));
        }

        icon.rotation_angle_z = angle % 360;
    }

    _isHidden(role) {
        const r = String(role).toLowerCase().trim();
        return (this.hiddenApps || []).some(
            (entry) => entry && entry.name && entry.name.toLowerCase().trim() === r);
    }

    // ------------------------------------------------------------------
    // Context menu: pick icons for the pocket by clicking
    // ------------------------------------------------------------------
    // All icons PocketTray currently hosts, as [{ id, label }], sorted.
    _collectIcons() {
        const byId = new Map();

        [this.button_box, this.pocket_box].forEach((box) => {
            box.get_children()
                .filter((button) => button._pocketTrayXEmbed && button._pocketTrayId)
                .forEach((button) => {
                    const id = button._pocketTrayId;
                    const wmClass = button._pocketTrayWmClass;
                    byId.set(id, { label: id, makeIcon: () => this._makeAppIcon([wmClass, id]) });
                });
        });

        for (const key in this._xappIcons) {
            const icon = this._xappIcons[key];
            if (!icon.id || byId.has(icon.id)) continue;
            // Anonymous SNIs (id = process name): the first tooltip line is
            // usually the application name. Named icons keep their name,
            // their tooltip often carries changing status text.
            const tip = (icon.anonymous && icon.proxy && icon.proxy.tooltip_text || "")
                .replace(/<[^>]*>/g, "").split(/\n|\\n/)[0].trim().slice(0, 40);
            const label = (tip && tip.toLowerCase() !== icon.id) ? tip + "  (" + icon.id + ")" : icon.id;
            const iconName = icon.proxy ? icon.proxy.icon_name : null;
            byId.set(icon.id, { label: label, makeIcon: () => this._makeXAppMenuIcon(iconName, icon.id) });
        }

        return [...byId].map(([id, entry]) => ({ id, label: entry.label, makeIcon: entry.makeIcon }))
            .sort((a, b) => GLib.utf8_collate(a.label.toLowerCase(), b.label.toLowerCase()));
    }

    // Icon the application itself reports (theme name or image file),
    // falling back to its launcher icon.
    _makeXAppMenuIcon(iconName, id) {
        try {
            if (iconName && iconName.trim()) {
                if (iconName.includes("/")) {
                    return new St.Icon({
                        gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(iconName) }),
                        icon_size: MENU_ICON_SIZE
                    });
                } else {
                    return new St.Icon({
                        icon_name: iconName,
                        icon_type: iconName.includes("symbolic") ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR,
                        icon_size: MENU_ICON_SIZE
                    });
                }
            }
        } catch (e) {
            global.logWarning("PocketTray: menu icon for '" + id + "': " + e);
        }
        return this._makeAppIcon([id]);
    }

    // Launcher (.desktop) icon of the first matching application, or a
    // generic placeholder. Legacy XEmbed icons have no icon name of their own.
    _makeAppIcon(candidates) {
        const appSys = Cinnamon.AppSystem.get_default();
        for (const name of candidates) {
            if (!name) continue;
            const app = appSys.lookup_desktop_wmclass(name) || appSys.lookup_app(name.toLowerCase() + ".desktop");
            if (app) return app.create_icon_texture(MENU_ICON_SIZE);
        }
        return new St.Icon({
            icon_name: "application-x-executable-symbolic",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: MENU_ICON_SIZE
        });
    }

    _buildIconsSection() {
        this._iconsSection.removeAll();

        const icons = this._collectIcons();
        this._iconsSection.addMenuItem(new PopupMenu.PopupMenuItem(
            icons.length ? _("Show in panel:") : _("No tray icons"), { reactive: false }));

        for (const { id, label, makeIcon } of icons) {
            // Switch on = visible in the panel, off = tucked into the pocket.
            const item = new IconSwitchMenuItem(label, !this._isHidden(id), makeIcon());
            // PopupSwitchMenuItem keeps the menu open, so several icons can
            // be switched in one go.
            item.connect('toggled', (it, state) => this._setHidden(id, !state));
            this._iconsSection.addMenuItem(item);
        }
        this._iconsSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _setHidden(id, hidden) {
        const list = (this.hiddenApps || []).filter(
            (entry) => entry && entry.name && entry.name.toLowerCase().trim() !== id);
        if (hidden) list.push({ name: id });

        this.hiddenApps = list;
        this.settings.setValue("hidden-apps", list);
        this._onHiddenAppsChanged();
    }

    _updatePocketToggle() {
        // XApp icons can be invisible (proxy "Visible" = false)
        const count = this.pocket_box.get_children().filter((c) => c.visible).length;
        this.pocket_toggle.visible = count > 0;
        if (count === 0 && this.menu.isOpen) {
            this.menu.close();
        }
    }

    _onHiddenAppsChanged() {
        // XEmbed: the dispatcher re-emits status-icon-added for each icon,
        // so _onTrayIconAdded picks the right container.
        Main.statusIconDispatcher.redisplay();
        // XApp: just move the existing actors.
        this._syncXAppIcons();
    }

    // ------------------------------------------------------------------
    // XApp status icons
    // ------------------------------------------------------------------
    _startXApp() {
        if (this._monitor) return;

        this._recorder = new XAppIcons.RecorderIcon(this);
        this.button_box.add_child(this._recorder.actor);

        this._monitor = new XApp.StatusIconMonitor();
        this._signalManager.connect(this._monitor, "icon-added", this._onXAppIconAdded, this);
        this._signalManager.connect(this._monitor, "icon-removed", this._onXAppIconRemoved, this);
        this._signalManager.connect(Gtk.IconTheme.get_default(), "changed", this._refreshXAppIcons, this);
        // Like xapp-status: listen to the panel directly, the built-in
        // on_panel_icon_size_changed() only fires for one icon type.
        this._signalManager.connect(this.panel, "icon-size-changed", this._refreshXAppIcons, this);
    }

    _stopXApp() {
        for (const key in this._xappIcons) {
            this._xappIcons[key].destroy();
        }
        this._xappIcons = {};
        this._xappProxies = {};
        if (this._recorder) {
            this._recorder.destroy();
            this._recorder = null;
        }
        // Signals are disconnected by the caller via _signalManager.
        this._monitor = null;
        this._updatePocketToggle();
    }

    _xappKey(proxy) {
        return proxy.get_name() + proxy.get_object_path();
    }

    _onXAppIconAdded(monitor, proxy) {
        this._xappProxies[this._xappKey(proxy)] = proxy;
        this._syncXAppIcons();
    }

    _onXAppIconRemoved(monitor, proxy) {
        const key = this._xappKey(proxy);
        delete this._xappProxies[key];
        const icon = this._xappIcons[key];
        if (icon) {
            global.log("PocketTray: removing XApp icon '" + icon.id + "'");
            delete this._xappIcons[key];
            icon.destroy();
        }
        this._updatePocketToggle();
    }

    // A dedicated applet (e.g. network, sound) claimed this icon.
    _isClaimedByApplet(proxy) {
        return Main.systrayManager.getRoles().indexOf((proxy.name || "").toLowerCase()) !== -1;
    }

    // Create/destroy/move XApp icons so they match the proxies, the systray
    // roles and the hidden-apps list.
    _syncXAppIcons() {
        if (!this._monitor) return;

        for (const key in this._xappProxies) {
            const proxy = this._xappProxies[key];
            let icon = this._xappIcons[key];

            if (this._isClaimedByApplet(proxy)) {
                if (icon) {
                    global.log("PocketTray: XApp icon '" + icon.id + "' claimed by an applet");
                    delete this._xappIcons[key];
                    icon.destroy();
                }
                continue;
            }

            if (!icon) {
                icon = new XAppIcons.XAppStatusIcon(this, proxy);
                this._xappIcons[key] = icon;
            }
            this._placeXAppIcon(icon);
        }

        // Keep the recording indicator at the end of the panel box
        if (this._recorder) {
            this.button_box.set_child_at_index(this._recorder.actor, -1);
        }
        this._updatePocketToggle();
    }

    _placeXAppIcon(icon) {
        const toPocket = this._isHidden(icon.id);
        const target = toPocket ? this.pocket_box : this.button_box;
        const parent = icon.actor.get_parent();
        if (parent === target) return;

        global.log("PocketTray: XApp icon '" + icon.id + "' -> " + (toPocket ? "pocket" : "panel"));
        if (parent) parent.remove_child(icon.actor);
        target.add_child(icon.actor);
    }

    _refreshXAppIcons() {
        for (const key in this._xappIcons) {
            this._xappIcons[key].refresh();
        }
        if (this._recorder) this._recorder.refresh();
    }

    // Called by XAppStatusIcon when its name or visibility changed.
    onXAppIconChanged(icon) {
        if (this._xappIcons[this._xappKey(icon.proxy)] === icon) {
            this._placeXAppIcon(icon);
            this._updatePocketToggle();
        }
    }

    // Called by XAppStatusIcon right before it forwards a click to its
    // application: close the pocket so its modal grab cannot block the
    // menu the application opens.
    onXAppIconActivated(icon) {
        if (this.menu.isOpen && icon.actor.get_parent() === this.pocket_box) {
            this._cancelHoverClose();
            this.menu.close(false);
        }
    }

    // ------------------------------------------------------------------
    // Pocket open/close
    // ------------------------------------------------------------------
    _onToggleClicked() {
        this._cancelHoverOpen();
        this.menu.toggle();
    }

    _onToggleEnter() {
        if (this.openTrigger !== "hover") return;
        this._cancelHoverClose();
        if (this.menu.isOpen || this._hoverOpenId > 0) return;
        this._hoverOpenId = Mainloop.timeout_add(this.hoverDelay, () => {
            this._hoverOpenId = 0;
            this.menu.open();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onPocketLeave() {
        this._cancelHoverOpen();
        if (this.openTrigger !== "hover" || !this.menu.isOpen) return;
        this._cancelHoverClose();
        this._hoverCloseId = Mainloop.timeout_add(this.closeDelay, () => {
            this._hoverCloseId = 0;
            this.menu.close();
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelHoverOpen() {
        if (this._hoverOpenId > 0) {
            Mainloop.source_remove(this._hoverOpenId);
            this._hoverOpenId = 0;
        }
    }

    _cancelHoverClose() {
        if (this._hoverCloseId > 0) {
            Mainloop.source_remove(this._hoverCloseId);
            this._hoverCloseId = 0;
        }
    }

    // ------------------------------------------------------------------
    // Applet lifecycle (adapted from systray@cinnamon.org)
    // ------------------------------------------------------------------
    on_applet_clicked(event) {
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;
        this.button_box.set_vertical(this._isVertical());
        this.pocket_box.set_vertical(this._isVertical());
        this._updateToggleIcon();
        this._refreshXAppIcons();
        this.update_na_tray_orientation();
    }

    update_na_tray_orientation() {
        switch (this.orientation) {
            case St.Side.LEFT:
            case St.Side.RIGHT:
                Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.VERTICAL);
                break;
            default:
                Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.HORIZONTAL);
                break;
        }
    }

    on_applet_reloaded() {
        global.trayReloading = true;
    }

    on_applet_removed_from_panel() {
        this._cancelHoverOpen();
        this._cancelHoverClose();
        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
            this._scaleUpdateId = 0;
        }
        if (this._redisplayIdleId > 0) {
            Mainloop.source_remove(this._redisplayIdleId);
            this._redisplayIdleId = 0;
        }
        this._signalManager.disconnectAllSignals();
        this.settings.finalize();
        this._clearIcons();
        this._stopXApp();
        this.menu.destroy();
    }

    // ------------------------------------------------------------------
    // Conflict guard: only one applet may own the XEmbed tray icons
    // ------------------------------------------------------------------
    // Returns [{ uuid, name }, ...] of other enabled tray applets, or null.
    // Known tray applets are matched by UUID; any other applet counts once
    // Cinnamon has loaded it and it declares "role": "tray". No file I/O.
    _findRivalTray() {
        const enabled = global.settings.get_strv("enabled-applets");
        const rivals = [];
        for (const entry of enabled) {
            const uuid = entry.split(":")[3];
            if (!uuid || uuid === this._uuid_ || rivals.some((r) => r.uuid === uuid)) continue;

            const ext = Extension.getExtension(uuid);
            const meta = ext ? ext.meta : null;
            const roles = (meta && meta.role) ? meta.role.replace(/ /g, "").split(",") : [];
            if (KNOWN_TRAY_APPLETS.includes(uuid) || roles.includes("tray")) {
                rivals.push({ uuid: uuid, name: (meta && meta.name) ? meta.name : uuid });
            }
        }
        return rivals.length ? rivals : null;
    }

    _onEnabledAppletsChanged() {
        const rival = this._findRivalTray();
        if (rival) this._shutdownBecauseOf(rival, true);
    }

    // Hand the icons back, tell the user, and remove this instance from the
    // panel. The settings file is kept, so re-adding PocketTray restores them.
    _shutdownBecauseOf(rivals, wasRunning) {
        if (this._shuttingDown) return;
        this._shuttingDown = true;

        const rivalNames = rivals.map((r) => "\"" + r.name + "\"").join(", ");
        global.logWarning("PocketTray: other tray applets are active (" + rivalNames + "), shutting down");

        if (wasRunning) {
            this._signalManager.disconnectAllSignals();
            this._cancelHoverOpen();
            this._cancelHoverClose();
            this._clearIcons();
            this._stopXApp();
            PocketTrayApplet._handOverIcons(rivals.map((r) => r.uuid));
        }

        Main.warningNotify(
            _("PocketTray has been removed from the panel"),
            _("PocketTray replaces these applets, which already show tray icons: %s. Running them side by side shows icons twice and can crash Cinnamon. Remove them from the panel first, then add PocketTray again.")
                .format(rivalNames),
            new St.Icon({ icon_name: "dialog-warning-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: 24 })
        );

        // Defer: never change enabled-applets while the applet manager is
        // still busy adding or reacting to a change. Not tracked on purpose:
        // it removes this very instance, so it must outlive it.
        Mainloop.idle_add(() => {
            const id = String(this._instanceId);
            const list = global.settings.get_strv("enabled-applets").filter((entry) => {
                const info = entry.split(":");
                return !(info[3] === this._uuid_ && info[4] === id);
            });
            global.settings.set_strv("enabled-applets", list);
            return GLib.SOURCE_REMOVE;
        });
    }

    // The rival applet is usually loaded *after* this change notification,
    // so wait until it runs, then re-emit all icons for it. Static on
    // purpose: this instance is gone by the time the timer fires.
    static _handOverIcons(rivalUuids) {
        let tries = 0;
        Mainloop.timeout_add(250, () => {
            tries++;
            let running = false;
            try {
                running = rivalUuids.every((uuid) => AppletManager.getRunningInstancesForUuid(uuid).length > 0);
            } catch (e) {
                global.logWarning("PocketTray: cannot query " + rivalUuids + ": " + e);
            }
            if (running || tries >= 20) {
                Main.statusIconDispatcher.redisplay();
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    on_applet_added_to_panel() {
        const rival = this._findRivalTray();
        if (rival) {
            // Do not touch the status icon dispatcher at all.
            this._shutdownBecauseOf(rival, false);
            return;
        }

        if (!global.trayReloading) {
            Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());
        }

        this.update_na_tray_orientation();

        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-added', this._onTrayIconAdded, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-removed', this._onTrayIconRemoved, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'before-redisplay', this._onBeforeRedisplay, this);
        this._signalManager.connect(Main.systrayManager, "changed", Main.statusIconDispatcher.redisplay, Main.statusIconDispatcher);
        this._signalManager.connect(Main.systrayManager, "changed", this._syncXAppIcons, this);
        this._signalManager.connect(global, "scale-changed", this.uiScaleChanged, this);
        this._signalManager.connect(global.settings, 'changed::panel-edit-mode', this.on_panel_edit_mode_changed, this);
        this._signalManager.connect(global.settings, 'changed::enabled-applets', this._onEnabledAppletsChanged, this);

        this._startXApp();

        // Always ask for the icons again. When PocketTray is added while the
        // tray manager already runs (e.g. replacing the stock systray), the
        // dispatcher does not re-emit existing icons on its own. Deferred so
        // that a tray applet removed in the same change has cleaned up first.
        global.trayReloading = false;
        this._redisplayIdleId = Mainloop.idle_add(() => {
            this._redisplayIdleId = 0;
            if (!this._shuttingDown) {
                Main.statusIconDispatcher.redisplay();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    // XEmbed buttons only; XApp icons and the recorder are managed separately.
    _clearIcons() {
        [this.button_box, this.pocket_box].forEach((box) => {
            box.get_children()
                .filter((button) => button._pocketTrayXEmbed)
                .forEach((button) => this._destroyButton(button));
        });
        this._updatePocketToggle();
    }

    // St.Bin asserts (and kills Cinnamon) if it is destroyed while it still
    // references a child. Always detach the icon first; never touch a child
    // that is already gone or that another container has taken over.
    _destroyButton(button) {
        if (!button || button.is_finalized()) return;
        try {
            const child = button.get_child();
            if (child) {
                button.set_child(null);
            }
        } catch (e) {
            global.logError("PocketTray: detaching icon failed: " + e);
        }
        button.destroy();
    }

    _isOurButton(actor) {
        if (!actor) return false;
        const box = actor.get_parent();
        return box === this.button_box || box === this.pocket_box;
    }

    resizeIcons() {
        this.icon_size = this.getPanelIconSize() * global.ui_scale;
        this._updateToggleIcon();
        this._refreshXAppIcons();
        Main.statusIconDispatcher.redisplay();
    }

    on_panel_icon_size_changed(size) {
        this.resizeIcons();
    }

    on_panel_edit_mode_changed() {
        const reactive = !global.settings.get_boolean('panel-edit-mode');
        for (const key in this._xappIcons) {
            this._xappIcons[key].actor.reactive = reactive;
        }
        this.resizeIcons();
    }

    uiScaleChanged() {
        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
        }

        this._scaleUpdateId = Mainloop.timeout_add(1500, () => {
            this.resizeIcons();
            this._scaleUpdateId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _onBeforeRedisplay() {
        this._clearIcons();
    }

    // ------------------------------------------------------------------
    // Icon handling: the one place where the tray is split in two
    // ------------------------------------------------------------------
    _onTrayIconAdded(o, icon, role) {
        try {
            let hiddenIcons = Main.systrayManager.getRoles();

            if (hiddenIcons.indexOf(role.toLowerCase()) != -1) {
                // A dedicated applet handles that one
                global.log("Hiding systray: " + role);
                return;
            }

            if (icon.get_parent()) {
                // Another tray applet (e.g. the stock systray) already holds
                // this icon. Stealing it would leave that applet with a stale
                // St.Bin and crash Cinnamon on its next cleanup.
                global.logWarning("PocketTray: icon '" + role + "' already has a parent - is a second tray applet running?");
                return;
            }

            const toPocket = this._isHidden(role);
            global.log("PocketTray: icon role '" + role + "' -> " + (toPocket ? "pocket" : "panel"));

            let button = new St.Bin({
                style_class: "applet-box",
                child: icon
            });
            button._pocketTrayXEmbed = true;
            button._pocketTrayId = String(role).toLowerCase().trim();
            button._pocketTrayWmClass = icon.wm_class || role;

            icon.set_x_align(Clutter.ActorAlign.CENTER);
            icon.set_y_align(Clutter.ActorAlign.FILL);
            button.set_y_align(Clutter.ActorAlign.FILL);

            icon.visible = false;
            icon.opacity = 0;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                if (button.is_finalized()) {
                    return GLib.SOURCE_REMOVE;
                }
                if (icon.is_finalized()) {
                    this._destroyButton(button);
                    this._updatePocketToggle();
                    return GLib.SOURCE_REMOVE;
                }

                icon.reactive = true;
                icon.visible = true;
                icon.set_size(this.icon_size, this.icon_size);
                icon.ease({
                    opacity: 255,
                    duration: 400,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });

                icon.connect("event", (actor, event) => this._onEvent(actor, event));
                return GLib.SOURCE_REMOVE;
            });

            if (toPocket) {
                this.pocket_box.insert_child_at_index(button, 0);
            } else {
                this.button_box.insert_child_at_index(button, 0);
            }
            this._updatePocketToggle();
        } catch (e) {
            global.logError(e);
        }
    }

    _onEvent(icon, event) {
        let etype = event.type();
        const button = icon.get_parent();

        if (button == null) {
            return Clutter.EVENT_PROPAGATE;
        }

        if (etype === Clutter.EventType.BUTTON_PRESS) {
            global.begin_modal(Meta.ModalOptions.POINTER_ALREADY_GRABBED, event.time);
        } else if (etype === Clutter.EventType.ENTER) {
            button.add_style_pseudo_class("hover");
        } else if (etype === Clutter.EventType.LEAVE) {
            button.remove_style_pseudo_class("hover");
        }

        let ret = icon.handle_event(etype, event);

        if (etype === Clutter.EventType.BUTTON_PRESS) {
            global.end_modal(event.time);
        }

        return ret;
    }

    _onTrayIconRemoved(o, icon) {
        const parent = icon.get_parent();

        if (!this._isOurButton(parent)) {
            // Not ours (hidden role, other applet, or already cleared)
            return;
        }
        this._destroyButton(parent);
        this._updatePocketToggle();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new PocketTrayApplet(metadata, orientation, panel_height, instance_id);
}
