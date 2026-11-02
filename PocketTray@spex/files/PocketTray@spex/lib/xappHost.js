// XApp status icons, adapted from xapp-status@cinnamon.org
// (linuxmint/cinnamon, GPL-2.0-or-later).
//
// XApp.StatusIconMonitor reports every XApp status icon on the session bus.
// StatusNotifierItems (Electron, Qt, KDE apps) arrive here too: the
// xapp-sn-watcher service turns them into XApp status icons as long as a
// monitor like this one exists. Without any monitor they fall back to
// legacy X11 icons that are all called "xapp-sn-watcher".
//
// Unlike X11 icons, these icons are drawn by PocketTray itself
// (XAppStatusIcon), so they can be moved between panel and pocket directly.
//
// Owner interface (implemented by PocketTrayApplet):
//   owner.panel, owner.orientation, owner.getPanelIconSize(), owner.isVertical()
//   owner.panelBox, owner.pocket
//   owner.placeIcon(actor, id, atStart) -> true if it went into the pocket
//   owner.iconsChanged()

const Gtk = imports.gi.Gtk;
const XApp = imports.gi.XApp;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager;
// Sibling modules are loaded through Cinnamon's per-applet importer, which
// works on Cinnamon 6.6 and later; exported are top-level `var` and `function`.
const Me = imports.ui.appletManager.applets["PocketTray@spex"];
const { XAppStatusIcon, RecorderIcon } = Me.lib.xappStatusIcon;
const { makeIconFromName } = Me.lib.iconMenu;

var XAppHost = class XAppHost {
    constructor(owner) {
        this._owner = owner;
        this._signals = new SignalManager.SignalManager(null);
        this._monitor = null;
        this._recorder = null;
        // Every proxy the monitor reported, and the icons actually shown
        // (proxies claimed by a dedicated applet have no icon). Both keyed
        // by _key(proxy).
        this._proxies = new Map();
        this._icons = new Map();
    }

    // --- Facade for XAppStatusIcon / RecorderIcon ----------------------
    get orientation() {
        return this._owner.orientation;
    }

    getPanelIconSize(type) {
        return this._owner.getPanelIconSize(type);
    }

    isVertical() {
        return this._owner.isVertical();
    }

    // --- Lifecycle -----------------------------------------------------
    start() {
        if (this._monitor) return;

        // Screen-recording indicator, part of the stock xapp-status applet
        this._recorder = new RecorderIcon(this);
        this._owner.panelBox.add_child(this._recorder.actor);

        this._monitor = new XApp.StatusIconMonitor();
        this._signals.connect(this._monitor, "icon-added", this._onProxyAdded, this);
        this._signals.connect(this._monitor, "icon-removed", this._onProxyRemoved, this);
        this._signals.connect(Gtk.IconTheme.get_default(), "changed", this.refresh, this);
        // An applet claimed or released a role (e.g. the network applet)
        this._signals.connect(Main.systrayManager, "changed", this.sync, this);
        // Like xapp-status: listen to the panel directly, the built-in
        // on_panel_icon_size_changed() only fires for one icon type.
        this._signals.connect(this._owner.panel, "icon-size-changed", this.refresh, this);
    }

    // Safe to call more than once.
    stop() {
        this._signals.disconnectAllSignals();
        for (const icon of this._icons.values()) {
            icon.destroy();
        }
        this._icons.clear();
        this._proxies.clear();
        if (this._recorder) {
            this._recorder.destroy();
            this._recorder = null;
        }
        this._monitor = null;
        this._owner.iconsChanged();
    }

    // Creates, removes and moves icons so they match the known proxies, the
    // systray roles and the hidden list.
    sync() {
        if (!this._monitor) return;

        for (const [key, proxy] of this._proxies) {
            let icon = this._icons.get(key);

            if (this._isClaimedByApplet(proxy)) {
                if (icon) {
                    global.log("PocketTray: XApp icon '" + icon.id + "' is handled by another applet");
                    this._icons.delete(key);
                    icon.destroy();
                }
                continue;
            }

            if (!icon) {
                icon = new XAppStatusIcon(this, proxy);
                this._icons.set(key, icon);
            }
            this._place(icon);
        }

        // Keep the recording indicator at the end of the panel box
        if (this._recorder) {
            this._owner.panelBox.set_child_at_index(this._recorder.actor, -1);
        }
        this._owner.iconsChanged();
    }

    // Icon theme, panel orientation or icon size changed.
    refresh() {
        for (const icon of this._icons.values()) {
            icon.refresh();
        }
        if (this._recorder) {
            this._recorder.refresh();
        }
    }

    // Icons must not react to clicks while the panel is being edited.
    setReactive(reactive) {
        for (const icon of this._icons.values()) {
            icon.actor.reactive = reactive;
        }
    }

    // Entries for the context menu: [{ id, label, makeIcon }].
    menuEntries() {
        const entries = [];
        for (const icon of this._icons.values()) {
            if (!icon.id) continue;
            const iconName = icon.proxy ? icon.proxy.icon_name : null;
            entries.push({
                id: icon.id,
                label: this._menuLabel(icon),
                makeIcon: (size) => makeIconFromName(iconName, [icon.id], size)
            });
        }
        return entries;
    }

    // --- Callbacks from XAppStatusIcon ---------------------------------
    // Name, process name or visibility changed.
    onIconChanged(icon) {
        if (this._icons.get(this._key(icon.proxy)) === icon) {
            this._place(icon);
            this._owner.iconsChanged();
        }
    }

    // A click is about to be forwarded to the application.
    onIconActivated(icon) {
        this._owner.pocket.closeIfContains(icon.actor);
    }

    // --- Internals -----------------------------------------------------
    _key(proxy) {
        return proxy.get_name() + proxy.get_object_path();
    }

    _onProxyAdded(monitor, proxy) {
        this._proxies.set(this._key(proxy), proxy);
        this.sync();
    }

    _onProxyRemoved(monitor, proxy) {
        const key = this._key(proxy);
        this._proxies.delete(key);
        const icon = this._icons.get(key);
        if (icon) {
            global.log("PocketTray: removing XApp icon '" + icon.id + "'");
            this._icons.delete(key);
            icon.destroy();
        }
        this._owner.iconsChanged();
    }

    // A dedicated applet (e.g. network, sound) shows this icon itself.
    _isClaimedByApplet(proxy) {
        return Main.systrayManager.getRoles().indexOf((proxy.name || "").toLowerCase()) !== -1;
    }

    _place(icon) {
        const parent = icon.actor.get_parent();
        const toPocket = this._owner.placeIcon(icon.actor, icon.id, false);
        if (icon.actor.get_parent() !== parent) {
            global.log("PocketTray: XApp icon '" + icon.id + "' -> " + (toPocket ? "pocket" : "panel"));
        }
    }

    // Unnamed StatusNotifierItems are listed by process name; their first
    // tooltip line is usually the application's name, so show both. Named
    // icons keep their name: their tooltip often carries status text.
    _menuLabel(icon) {
        if (!icon.anonymous || !icon.proxy) return icon.id;
        const tip = (icon.proxy.tooltip_text || "")
            .replace(/<[^>]*>/g, "")         // strip markup
            .split(/\n|\\n/)[0].trim().slice(0, 40);
        return (tip && tip.toLowerCase() !== icon.id) ? tip + "  (" + icon.id + ")" : icon.id;
    }
};
