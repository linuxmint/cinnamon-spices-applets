// @ts-check
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

const menuSource = require("./menuSource");
const menuBuilder = require("./menuBuilder");

const GTK_PROP_SIGNALS = [
    "notify::gtk-unique-bus-name",
    "notify::gtk-menubar-object-path",
    "notify::gtk-app-menu-object-path",
    "notify::gtk-application-object-path",
    "notify::gtk-window-object-path"
];

// Registrar dbusmenu menus use GetLayout (not AppmenuGLibTranslator): walking
// translator GMenuModels SEGVs under GJS GC. Keep stable model/proxy refs across
// focus changes where possible to avoid teardown churn.
class CinnamonGlobalMenuApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);

        this.metadata = metadata;
        this.orientation = orientation;
        this._menuEntries = [];
        this._currentWindow = null;
        this._currentWindowId = 0;
        this._rebuildTimeout = 0;
        this._focusWait = 0;
        this._itemsChangedId = 0;
        this._sectionSignalIds = [];
        this._currentModel = null;
        this._currentDbusProxy = null;
        this._dbusSignalId = 0;
        this._currentMenuKey = null;
        this._currentActionGroups = {};
        this._modelSig = null;
        this._pendingRebuild = false;
        this._unityPath = null;
        this._unityPathCache = {};
        this._windowSignalIds = [];
        this._retryTimeout = 0;
        this._retryCount = 0;
        this._rebuilding = false;
        this._ssProxy = null;
        this._ssSignalId = 0;

        this.box = new St.BoxLayout({
            style_class: "globalmenu-box",
            reactive: false
        });
        this.actor.add(this.box, {
            y_align: St.Align.MIDDLE,
            y_fill: false,
            expand: true
        });

        this.appLabel = new St.Label({
            style_class: "applet-label globalmenu-app-label",
            y_align: Clutter.ActorAlign.CENTER
        });
        this.box.add_actor(this.appLabel);

        this.placeholder = new St.Label({
            style_class: "applet-label globalmenu-placeholder",
            text: "",
            y_align: Clutter.ActorAlign.CENTER
        });
        this.box.add_actor(this.placeholder);

        this.menuManager = new PopupMenu.PopupMenuManager(this);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("show-app-name", "showAppName", this._onSettingsChanged);
        this.settings.bind("desaturate-app-name", "boldAppName", this._onSettingsChanged);
        this.settings.bind("max-app-name-length", "maxAppNameLength", this._onSettingsChanged);

        this._ensureBackend();
        this._onSettingsChanged();

        this._focusId = global.display.connect("notify::focus-window", () => {
            this._queueRebuild();
        });
        this._tracker = Cinnamon.WindowTracker.get_default();
        this._watchScreensaver();

        this._focusWait = Mainloop.timeout_add(300, () => {
            this._focusWait = 0;
            this._rebuild();
            return false;
        });
    }

    _watchScreensaver() {
        try {
            this._ssProxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                null,
                "org.cinnamon.ScreenSaver",
                "/org/cinnamon/ScreenSaver",
                "org.cinnamon.ScreenSaver",
                null
            );
            this._ssSignalId = this._ssProxy.connect("g-signal", (proxy, senderName, signalName, parameters) => {
                if (signalName !== "ActiveChanged")
                    return;
                let active = false;
                try {
                    active = parameters.deep_unpack()[0];
                } catch (err) {}
                this._detachCurrentMenu(active ? "screensaver-on" : "screensaver-off");
                if (!active)
                    this._queueRebuild();
            });
        } catch (err) {
            global.logWarning("globalmenu: screensaver watch failed: " + err);
        }
    }

    _disconnectDbusProxy() {
        if (this._currentDbusProxy && this._dbusSignalId) {
            try { this._currentDbusProxy.disconnect(this._dbusSignalId); } catch (err) {}
        }
        this._dbusSignalId = 0;
    }

    _watchDbusProxy(proxy) {
        this._disconnectDbusProxy();
        this._currentDbusProxy = proxy;
        if (!proxy)
            return;
        try {
            this._dbusSignalId = proxy.connect("g-signal", (p, sender, signalName, params) => {
                if (signalName === "LayoutUpdated" || signalName === "ItemsPropertiesUpdated")
                    this._queueRebuild();
            });
        } catch (err) {}
    }

    _detachCurrentMenu(reason) {
        try { this._disconnectModelSignals(); } catch (err) {}
        try { this._disconnectDbusProxy(); } catch (err) {}
        try { this._clearMenus(); } catch (err) {}
        this._currentModel = null;
        this._currentDbusProxy = null;
        this._currentMenuKey = null;
        this._modelSig = null;
    }

    _ensureBackend() {
        try {
            Util.spawnCommandLineAsync("pkill -f /usr/bin/cinnamon-appmenu-bar");
        } catch (err) {}

        try {
            let xsettings = new Gio.Settings({
                schema_id: "org.cinnamon.settings-daemon.plugins.xsettings"
            });
            let modules = xsettings.get_strv("enabled-gtk-modules");
            if (modules.indexOf("appmenu-gtk-module") < 0) {
                modules = modules.concat(["appmenu-gtk-module"]);
                xsettings.set_strv("enabled-gtk-modules", modules);
            }
            let overrides = GLib.Variant.new("a{sv}", {
                "Gtk/ShellShowsAppMenu": GLib.Variant.new_int32(0),
                "Gtk/ShellShowsMenubar": GLib.Variant.new_int32(1)
            });
            xsettings.set_value("overrides", overrides);
        } catch (err) {
            global.logWarning("globalmenu: could not update xsettings: " + err);
        }

        // Allow appmenu-gtk-module on Wayland sessions (off by default upstream).
        try {
            let appmenu = new Gio.Settings({ schema_id: "org.appmenu.gtk-module" });
            if (appmenu.list_keys().indexOf("run-on-wayland") >= 0)
                appmenu.set_boolean("run-on-wayland", true);
        } catch (err) {
            global.logWarning("globalmenu: could not enable run-on-wayland: " + err);
        }

        try {
            Gio.DBus.session.call(
                "org.freedesktop.DBus",
                "/org/freedesktop/DBus",
                "org.freedesktop.DBus",
                "StartServiceByName",
                GLib.Variant.new("(su)", ["com.canonical.AppMenu.Registrar", 0]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                null
            );
        } catch (err) {}
    }

    _onSettingsChanged() {
        this.appLabel.visible = !!this.showAppName;
        this._rebuild();
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this._rebuild();
    }

    on_applet_removed_from_panel() {
        this._unbindWindow();
        this._detachCurrentMenu("applet-removed");
        if (this._ssProxy && this._ssSignalId) {
            try { this._ssProxy.disconnect(this._ssSignalId); } catch (err) {}
            this._ssSignalId = 0;
            this._ssProxy = null;
        }
        if (this._focusId) {
            global.display.disconnect(this._focusId);
            this._focusId = 0;
        }
        if (this._rebuildTimeout) {
            Mainloop.source_remove(this._rebuildTimeout);
            this._rebuildTimeout = 0;
        }
        if (this._focusWait) {
            Mainloop.source_remove(this._focusWait);
            this._focusWait = 0;
        }
        if (this._retryTimeout) {
            Mainloop.source_remove(this._retryTimeout);
            this._retryTimeout = 0;
        }
        this.settings.finalize();
    }

    _queueRebuild() {
        if (this._rebuildTimeout)
            Mainloop.source_remove(this._rebuildTimeout);
        // Debounce hard: focus/title/items-changed can fire dozens of times/sec;
        // tearing down St/PopupMenu that often is unstable in muffin/cogl.
        this._rebuildTimeout = Mainloop.timeout_add(450, () => {
            this._rebuildTimeout = 0;
            if (this._isAnyMenuOpen()) {
                this._pendingRebuild = true;
                return false;
            }
            this._rebuild();
            return false;
        });
    }

    _isAnyMenuOpen() {
        for (let i = 0; i < this._menuEntries.length; i++) {
            try {
                if (this._menuEntries[i].menu && this._menuEntries[i].menu.isOpen)
                    return true;
            } catch (err) {}
        }
        return false;
    }

    _modelSignature(model) {
        if (!model)
            return "";
        try {
            let parts = [];
            let n = model.get_n_items();
            for (let i = 0; i < n; i++) {
                let section = model.get_item_link(i, Gio.MENU_LINK_SECTION);
                if (section) {
                    parts.push("S:" + this._modelSignature(section));
                    continue;
                }
                let labelVar = model.get_item_attribute_value(
                    i, Gio.MENU_ATTRIBUTE_LABEL, GLib.VariantType.new("s")
                );
                let label = labelVar ? labelVar.get_string()[0] : "";
                parts.push(label || "#");
            }
            return parts.join("|");
        } catch (err) {
            return "err";
        }
    }

    _unbindWindow() {
        // Only detach window signals. Keep the current GTK model / dbusmenu
        // proxy across rapid alt-tab when the exporter key is unchanged.
        if (this._currentWindow && this._windowSignalIds.length) {
            for (let i = 0; i < this._windowSignalIds.length; i++) {
                try {
                    this._currentWindow.disconnect(this._windowSignalIds[i]);
                } catch (err) {}
            }
        }
        this._windowSignalIds = [];
        this._currentWindow = null;
        this._currentWindowId = 0;
        this._unityPath = null;
        this._retryCount = 0;
        if (this._retryTimeout) {
            Mainloop.source_remove(this._retryTimeout);
            this._retryTimeout = 0;
        }
    }

    _resolveForFocus(focus, probe) {
        let menuKey = probe.menuKey;
        if (menuKey && menuKey === this._currentMenuKey &&
            (this._currentModel || this._currentDbusProxy)) {
            return {
                kind: probe.kind,
                source: probe.source,
                busName: probe.busName,
                objectPath: probe.objectPath,
                model: this._currentModel,
                _dbusProxy: this._currentDbusProxy,
                actionGroups: this._currentActionGroups || {}
            };
        }

        let resolved = menuSource.resolveWindowMenu(focus);
        if (this._unityPath && resolved.kind === menuSource.MenuKind.MENUMODEL &&
            resolved.busName && !resolved.actionGroups["unity"]) {
            try {
                resolved.actionGroups["unity"] = Gio.DBusActionGroup.get(
                    Gio.DBus.session, resolved.busName, this._unityPath
                );
            } catch (err) {}
        }
        return resolved;
    }

    _bindWindow(metaWindow) {
        if (this._currentWindow === metaWindow)
            return;

        this._unbindWindow();
        this._currentWindow = metaWindow;
        this._unityPath = null;
        if (!metaWindow)
            return;

        try {
            if (metaWindow.get_id)
                this._currentWindowId = metaWindow.get_id();
        } catch (err) {
            this._currentWindowId = menuSource.guessXid(metaWindow);
        }

        // Resolve _UNITY_OBJECT_PATH (async xprop, cached per XID).
        try {
            let xid = metaWindow.get_xwindow ? metaWindow.get_xwindow() : 0;
            let busName = null;
            try { busName = metaWindow.get_gtk_unique_bus_name(); } catch (err) {}
            let cached = xid ? this._unityPathCache[xid >>> 0] : undefined;
            let applyUnity = (unityPath) => {
                if (this._currentWindow !== metaWindow)
                    return;
                if (!unityPath || !busName)
                    return;
                this._unityPath = unityPath;
                try {
                    this._currentActionGroups = this._currentActionGroups || {};
                    this._currentActionGroups["unity"] = Gio.DBusActionGroup.get(
                        Gio.DBus.session, busName, unityPath
                    );
                    this._insertActionGroups(this._currentActionGroups);
                } catch (err) {}
            };
            if (cached !== undefined) {
                applyUnity(cached);
            } else {
                menuSource.fetchUnityObjectPath(xid, (unityPath) => {
                    if (xid)
                        this._unityPathCache[xid >>> 0] = unityPath;
                    applyUnity(unityPath);
                });
            }
        } catch (err) {}

        // Wayland (and some X11 apps) publish GTK dbus props after map/focus.
        for (let i = 0; i < GTK_PROP_SIGNALS.length; i++) {
            try {
                let sid = metaWindow.connect(GTK_PROP_SIGNALS[i], () => {
                    this._queueRebuild();
                });
                this._windowSignalIds.push(sid);
            } catch (err) {}
        }

        try {
            let sid = metaWindow.connect("unmanaged", () => {
                if (this._currentWindow === metaWindow) {
                    this._unbindWindow();
                    this._detachCurrentMenu("window-unmanaged");
                    this._setAppName("");
                }
            });
            this._windowSignalIds.push(sid);
        } catch (err) {}
    }

    _scheduleRetry() {
        // Only used when no model/proxy yet (exporter not registered). Empty
        // layouts should fill via items-changed / LayoutUpdated — do not recreate
        // exporters on a timer.
        if (this._retryCount >= 8)
            return;
        if (this._retryTimeout)
            return;
        this._retryTimeout = Mainloop.timeout_add(250, () => {
            this._retryTimeout = 0;
            this._retryCount++;
            this._rebuild(true);
            return false;
        });
    }

    _insertActionGroups(actionGroups) {
        let keys = ["app", "win", "unity", "dbusmenu"];
        for (let i = 0; i < keys.length; i++) {
            let ns = keys[i];
            try {
                this.actor.remove_action_group(ns);
            } catch (err) {}
            if (actionGroups && actionGroups[ns]) {
                try {
                    this.actor.insert_action_group(ns, actionGroups[ns]);
                } catch (err) {}
            }
        }
        this._currentActionGroups = actionGroups || {};
    }

    _disconnectModelSignals() {
        if (this._currentModel && this._itemsChangedId) {
            try {
                this._currentModel.disconnect(this._itemsChangedId);
            } catch (err) {}
        }
        this._itemsChangedId = 0;
        for (let i = 0; i < this._sectionSignalIds.length; i++) {
            try {
                this._sectionSignalIds[i].model.disconnect(this._sectionSignalIds[i].id);
            } catch (err) {}
        }
        this._sectionSignalIds = [];
    }

    _clearMenus() {
        for (let i = 0; i < this._menuEntries.length; i++) {
            try {
                let entry = this._menuEntries[i];
                if (entry.menu) {
                    try { entry.menu.close(false); } catch (closeErr) {}
                }
                entry.destroy();
            } catch (err) {
            }
        }
        this._menuEntries = [];
        // Do not drop model/proxy here — callers re-watch or replace explicitly.
    }

    _watchModel(model) {
        if (model && model === this._currentModel && this._itemsChangedId)
            return;
        this._disconnectModelSignals();
        this._currentModel = model;
        if (!model)
            return;

        this._itemsChangedId = model.connect("items-changed", () => {
            this._queueRebuild();
        });

        // Qt menus often arrive as a root section that fills in later.
        try {
            let n = model.get_n_items();
            for (let i = 0; i < n; i++) {
                let section = model.get_item_link(i, Gio.MENU_LINK_SECTION);
                if (!section)
                    continue;
                let id = section.connect("items-changed", () => {
                    this._queueRebuild();
                });
                this._sectionSignalIds.push({ model: section, id: id });
            }
        } catch (err) {}
    }

    _setAppName(text) {
        if (!this.showAppName) {
            this.appLabel.set_text("");
            return;
        }
        let name = text || "";
        let max = this.maxAppNameLength || 24;
        if (name.length > max)
            name = name.substring(0, max - 1) + "…";
        this.appLabel.set_text(name);
    }

    _isIgnoredWindow(focus) {
        if (!focus)
            return true;
        try {
            let wt = focus.get_window_type();
            if (wt === Meta.WindowType.DESKTOP ||
                wt === Meta.WindowType.DOCK ||
                wt === Meta.WindowType.TOOLBAR ||
                wt === Meta.WindowType.MENU ||
                wt === Meta.WindowType.POPUP_MENU ||
                wt === Meta.WindowType.DROPDOWN_MENU ||
                wt === Meta.WindowType.TOOLTIP) {
                return true;
            }
        } catch (err) {}
        return false;
    }

    _rebuild(isRetry) {
        let focus = global.display.get_focus_window();
        let title = "";
        try { title = focus ? (focus.get_title() || "") : ""; } catch (err) {}

        if (this._isIgnoredWindow(focus)) {
            if (!this._menuEntries.length)
                this._setAppName("");
            return;
        }

        if (!isRetry)
            this._retryCount = 0;

        if (this._rebuilding)
            return;

        // Never tear down / switch menus while a popup is open.
        if (this._isAnyMenuOpen()) {
            this._pendingRebuild = true;
            return;
        }

        this._rebuilding = true;
        this._pendingRebuild = false;

        try {
            let sameWindow = (this._currentWindow === focus);
            this._bindWindow(focus);

            let appName = "";
            try {
                if (focus && this._tracker) {
                    let app = this._tracker.get_window_app(focus);
                    if (app)
                        appName = app.get_name();
                }
                if (!appName && focus)
                    appName = focus.get_title() || "";
            } catch (err) {}
            this._setAppName(appName);

            let probe = menuSource.probeWindowMenu(focus);
            let menuKey = probe.menuKey;

            // Same window + same GTK exporter: skip unless the model signature changed.
            if (sameWindow && menuKey && menuKey === this._currentMenuKey && this._currentModel &&
                probe.kind !== menuSource.MenuKind.DBUSMENU) {
                let sig = this._modelSignature(this._currentModel);
                if (sig === this._modelSig) {
                    return;
                }
                this._clearMenus();
                this._modelSig = sig;
                this._watchModel(this._currentModel);
                this._menuEntries = menuBuilder.buildPanelMenus(
                    this.box,
                    this.menuManager,
                    this.orientation,
                    this._currentModel,
                    this._currentActionGroups || {}
                );
                this._armMenuCloseHandler();
                return;
            }

            let resolved = this._resolveForFocus(focus, probe);
            this._currentMenuKey = (resolved.busName || "") + "|" +
                (resolved.objectPath || resolved.menubarPath || menuKey || "");
            menuKey = this._currentMenuKey;
            if (!(this._currentModel && resolved.model === this._currentModel))
                this._modelSig = null;

            this._clearMenus();

            // Registrar / Qt / Electron: GetLayout path — never walk GMenuModel.
            if (resolved.kind === menuSource.MenuKind.DBUSMENU) {
                this.placeholder.set_text("");
                this._disconnectModelSignals();
                this._currentModel = null;
                this._insertActionGroups({});
                let proxy = resolved._dbusProxy || this._currentDbusProxy;
                if (!proxy && resolved.busName && resolved.objectPath) {
                    try {
                        proxy = menuSource.createDbusMenuProxy(resolved.busName, resolved.objectPath);
                        resolved._dbusProxy = proxy;
                    } catch (err) {}
                }
                this._watchDbusProxy(proxy);
                this._menuEntries = menuBuilder.buildPanelFromDbusmenu(
                    this.box,
                    this.menuManager,
                    this.orientation,
                    proxy
                );
                this._modelSig = "dm:" + this._menuEntries.length;
                this._armMenuCloseHandler();
                if (!this._menuEntries.length)
                    this._scheduleRetry();
                return;
            }

            if (!resolved.model) {
                this.placeholder.set_text("");
                this._disconnectModelSignals();
                this._disconnectDbusProxy();
                this._currentModel = null;
                this._modelSig = null;
                this._insertActionGroups({});
                this._scheduleRetry();
                return;
            }

            this.placeholder.set_text("");
            this._disconnectDbusProxy();
            this._insertActionGroups(resolved.actionGroups);
            this._watchModel(resolved.model);
            this._modelSig = this._modelSignature(resolved.model);

            this._menuEntries = menuBuilder.buildPanelMenus(
                this.box,
                this.menuManager,
                this.orientation,
                resolved.model,
                resolved.actionGroups || this._currentActionGroups
            );
            this._armMenuCloseHandler();

        } catch (err) {
            global.logError("globalmenu rebuild: " + err);
        } finally {
            this._rebuilding = false;
            if (this._pendingRebuild)
                this._queueRebuild();
        }
    }

    _armMenuCloseHandler() {
        for (let i = 0; i < this._menuEntries.length; i++) {
            let entry = this._menuEntries[i];
            if (!entry.menu || entry._closeArmed)
                continue;
            entry._closeArmed = true;
            try {
                entry.menu.connect("open-state-changed", (menu, open) => {
                    if (!open && this._pendingRebuild)
                        this._queueRebuild();
                });
            } catch (err) {}
        }
    }
}

/**
 * Cinnamon applet entry point.
 * @param {object} metadata
 * @param {number} orientation
 * @param {number} panelHeight
 * @param {number} instanceId
 * @returns {CinnamonGlobalMenuApplet}
 */
function main(metadata, orientation, panelHeight, instanceId) {
    return new CinnamonGlobalMenuApplet(metadata, orientation, panelHeight, instanceId);
}
