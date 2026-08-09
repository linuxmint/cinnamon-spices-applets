// @ts-check
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;

/**
 * @typedef {object} GtkActionDbusPaths
 * @property {string} busName
 * @property {string|null} appPath
 * @property {string|null} winPath
 * @property {string|null} unityPath
 */

/**
 * @typedef {object} ActionGroups
 * @property {any} [app]
 * @property {any} [win]
 * @property {any} [unity]
 * @property {any} [dbusmenu]
 * @property {GtkActionDbusPaths} [_gtk]
 */

/**
 * @typedef {object} MenuProbe
 * @property {string|null} menuKey
 * @property {number} kind
 * @property {string|null} source
 * @property {string|null} busName
 * @property {string|null} objectPath
 * @property {string|null} menubarPath
 * @property {string|null} appMenuPath
 * @property {string|null} applicationPath
 * @property {string|null} windowPath
 * @property {string|null} unityPath
 * @property {number[]} windowIds
 */

/**
 * @typedef {object} ResolvedMenu
 * @property {number} kind
 * @property {string|null} busName
 * @property {string|null} objectPath
 * @property {string|null} menubarPath
 * @property {string|null} appMenuPath
 * @property {string|null} applicationPath
 * @property {string|null} windowPath
 * @property {string|null} unityPath
 * @property {any|null} model
 * @property {ActionGroups} actionGroups
 * @property {string|null} source
 * @property {number[]} windowIds
 * @property {any} clientType
 * @property {any} [_dbusProxy]
 */

const REGISTRAR_NAME = "com.canonical.AppMenu.Registrar";
const REGISTRAR_PATH = "/com/canonical/AppMenu/Registrar";

const RegistrarIface = `
<node>
  <interface name="com.canonical.AppMenu.Registrar">
    <method name="GetMenuForWindow">
      <arg type="u" name="windowId" direction="in"/>
      <arg type="s" name="service" direction="out"/>
      <arg type="o" name="menuObjectPath" direction="out"/>
    </method>
    <method name="GetMenus">
      <arg type="a(uso)" name="menus" direction="out"/>
    </method>
  </interface>
</node>`;

const RegistrarProxy = Gio.DBusProxy.makeProxyWrapper(RegistrarIface);

var MenuKind = {
    NONE: 0,
    MENUMODEL: 1,
    DBUSMENU: 2
};

function getWindowIds(metaWindow) {
    let ids = [];
    if (!metaWindow)
        return ids;

    // Prefer X11 XID first: Qt's QDBusMenuBar registers with QWindow::winId(),
    // which is the XID on xcb. Mutter's compositor get_id() is a different value.
    try {
        if (metaWindow.get_xwindow) {
            let xid = metaWindow.get_xwindow();
            if (xid)
                ids.push(xid >>> 0);
        }
    } catch (err) {}

    try {
        if (metaWindow.get_id) {
            let id = metaWindow.get_id() >>> 0;
            if (id && ids.indexOf(id) < 0)
                ids.push(id);
        }
    } catch (err) {}

    return ids;
}

function getClientType(metaWindow) {
    try {
        if (metaWindow.get_client_type)
            return metaWindow.get_client_type();
    } catch (err) {}
    return null;
}

/**
 * Read GTK menu export info from Meta.Window.
 * Muffin fills these from X11 atoms and from the Wayland gtk-shell
 * set_dbus_properties request — dual-protocol, no subprocesses.
 */
function readMetaGtkProps(metaWindow) {
    if (!metaWindow)
        return null;

    let busName = null;
    let menubarPath = null;
    let appMenuPath = null;
    let applicationPath = null;
    let windowPath = null;

    try { busName = metaWindow.get_gtk_unique_bus_name(); } catch (err) {}
    try { menubarPath = metaWindow.get_gtk_menubar_object_path(); } catch (err) {}
    try { appMenuPath = metaWindow.get_gtk_app_menu_object_path(); } catch (err) {}
    try { applicationPath = metaWindow.get_gtk_application_object_path(); } catch (err) {}
    try { windowPath = metaWindow.get_gtk_window_object_path(); } catch (err) {}

    if (!busName)
        return null;

    return {
        busName: busName,
        menubarPath: menubarPath || null,
        appMenuPath: appMenuPath || null,
        applicationPath: applicationPath || null,
        windowPath: windowPath || null,
        unityPath: null,
        source: "meta"
    };
}

function tryRegistrar(windowIds) {
    if (!windowIds || !windowIds.length)
        return null;

    try {
        let proxy = new RegistrarProxy(
            Gio.DBus.session, REGISTRAR_NAME, REGISTRAR_PATH
        );

        for (let i = 0; i < windowIds.length; i++) {
            let id = windowIds[i];
            try {
                let [service, path] = proxy.GetMenuForWindowSync(id);
                if (service && path && path !== "/")
                    return { service: service, path: path, windowId: id };
            } catch (err) {}
        }
    } catch (err) {}

    return null;
}

/**
 * Lightweight identity for the focused window's menu exporter.
 * Does not create GMenuModel / dbusmenu proxies (avoids GObject churn).
 * @param {any} metaWindow
 * @returns {MenuProbe}
 */
function probeWindowMenu(metaWindow) {
    let out = {
        menuKey: null,
        kind: MenuKind.NONE,
        source: null,
        busName: null,
        objectPath: null,
        menubarPath: null,
        appMenuPath: null,
        applicationPath: null,
        windowPath: null,
        unityPath: null,
        windowIds: getWindowIds(metaWindow)
    };
    if (!metaWindow)
        return out;

    try {
        let metaProps = readMetaGtkProps(metaWindow);
        if (metaProps && (metaProps.menubarPath || metaProps.appMenuPath)) {
            out.kind = MenuKind.MENUMODEL;
            out.source = "meta";
            out.busName = metaProps.busName;
            out.menubarPath = metaProps.menubarPath;
            out.appMenuPath = metaProps.appMenuPath;
            out.applicationPath = metaProps.applicationPath;
            out.windowPath = metaProps.windowPath;
            out.unityPath = metaProps.unityPath;
            out.objectPath = metaProps.menubarPath || metaProps.appMenuPath;
            out.menuKey = (out.busName || "") + "|" + (out.objectPath || "");
            return out;
        }
    } catch (err) {}

    try {
        let reg = tryRegistrar(out.windowIds);
        if (reg) {
            out.kind = MenuKind.DBUSMENU;
            out.source = "registrar";
            out.busName = reg.service;
            out.objectPath = reg.path;
            out.menuKey = (reg.service || "") + "|" + (reg.path || "");
            return out;
        }
    } catch (err) {}

    return out;
}

function bindMenuModel(result, props) {
    result.kind = MenuKind.MENUMODEL;
    result.busName = props.busName;
    result.menubarPath = props.menubarPath;
    result.appMenuPath = props.appMenuPath;
    result.applicationPath = props.applicationPath;
    result.windowPath = props.windowPath;
    // appmenu-gtk-module exports unity actions on _UNITY_OBJECT_PATH, which is
    // often the same as the menubar path (xed). GtkApplication apps may differ.
    result.unityPath = props.unityPath || props.menubarPath || null;
    result.source = props.source || "unknown";

    if (props.applicationPath) {
        result.actionGroups["app"] = Gio.DBusActionGroup.get(
            Gio.DBus.session, props.busName, props.applicationPath
        );
    }
    if (props.windowPath) {
        result.actionGroups["win"] = Gio.DBusActionGroup.get(
            Gio.DBus.session, props.busName, props.windowPath
        );
    }
    if (result.unityPath) {
        result.actionGroups["unity"] = Gio.DBusActionGroup.get(
            Gio.DBus.session, props.busName, result.unityPath
        );
    }
    // Direct org.gtk.Actions Activate fallback — DBusActionGroup fills async (~250ms)
    // and silently no-ops activate_action until then (Transmission win.*).
    result.actionGroups._gtk = {
        busName: props.busName,
        appPath: props.applicationPath || null,
        winPath: props.windowPath || null,
        unityPath: result.unityPath || null
    };

    let modelPath = props.menubarPath || props.appMenuPath;
    if (modelPath) {
        result.model = Gio.DBusMenuModel.get(
            Gio.DBus.session, props.busName, modelPath
        );
        result.objectPath = modelPath;
    }
}

/**
 * Read _UNITY_OBJECT_PATH asynchronously (no spawn_sync).
 * @param {number} xid
 * @param {(path: string|null) => void} callback
 */
function fetchUnityObjectPath(xid, callback) {
    if (!xid) {
        callback(null);
        return;
    }
    try {
        let proc = Gio.Subprocess.new(
            ["xprop", "-id", String(xid >>> 0), "_UNITY_OBJECT_PATH"],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
        );
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                let [, stdout] = p.communicate_utf8_finish(res);
                let m = stdout && stdout.match(/=\s*"([^"]+)"/);
                if (!m)
                    m = stdout && stdout.match(/=\s*(\/\S+)/);
                callback(m ? m[1] : null);
            } catch (err) {
                callback(null);
            }
        });
    } catch (err) {
        callback(null);
    }
}

/**
 * Use com.canonical.dbusmenu GetLayout / Event directly.
 * AppmenuGLibTranslator's DBusMenuSectionModel SEGVs under GJS when walked
 * or GC-finalized — do not create Importer/GMenuModel for registrar menus.
 * @param {string} service
 * @param {string} path
 * @returns {any}
 */
function createDbusMenuProxy(service, path) {
    return Gio.DBusProxy.new_sync(
        Gio.DBus.session,
        Gio.DBusProxyFlags.NONE,
        null,
        service,
        path,
        "com.canonical.dbusmenu",
        null
    );
}

function aboutToShowDbusMenu(proxyOrService, pathOrId, maybeId) {
    let proxy = proxyOrService;
    let id = 0;
    if (typeof pathOrId === "string") {
        try {
            proxy = createDbusMenuProxy(proxyOrService, pathOrId);
        } catch (err) {
            return false;
        }
        id = maybeId || 0;
    } else {
        id = pathOrId || 0;
    }
    try {
        let ret = proxy.call_sync(
            "AboutToShow",
            new GLib.Variant("(i)", [id]),
            Gio.DBusCallFlags.NONE,
            500,
            null
        );
        return ret.deep_unpack()[0];
    } catch (err) {
        return false;
    }
}

function _variantToPlain(v) {
    if (v === null || v === undefined)
        return v;
    try {
        if (v instanceof GLib.Variant) {
            let t = v.get_type_string();
            if (t === "v")
                return _variantToPlain(v.get_variant());
            if (t === "s")
                return v.get_string()[0];
            if (t === "b")
                return v.get_boolean();
            if (t === "i" || t === "u")
                return v.get_int32();
            if (t.indexOf("a{sv}") === 0 || t === "a{sv}") {
                let out = {};
                let n = v.n_children();
                for (let i = 0; i < n; i++) {
                    let entry = v.get_child_value(i);
                    let key = entry.get_child_value(0).get_string()[0];
                    out[key] = _variantToPlain(entry.get_child_value(1));
                }
                return out;
            }
            // Fall back
            return v.deep_unpack();
        }
    } catch (err) {}
    return v;
}

function _unpackDbusNode(nodeVariant) {
    // Children arrive as type "v" wrapping "(ia{sv}av)". deep_unpack() loses props in GJS.
    let v = nodeVariant;
    if (v instanceof GLib.Variant) {
        if (v.get_type_string() === "v")
            v = v.get_variant();
        let id = v.get_child_value(0).get_int32();
        let props = _variantToPlain(v.get_child_value(1)) || {};
        let kidsV = v.get_child_value(2);
        let children = [];
        let kn = kidsV.n_children();
        for (let i = 0; i < kn; i++)
            children.push(_unpackDbusNode(kidsV.get_child_value(i)));
        return [id, props, children];
    }
    if (nodeVariant && nodeVariant.length >= 2)
        return nodeVariant;
    return null;
}

/**
 * @param {any} proxy
 * @param {number} parentId
 * @param {number} depth
 * @returns {{rev: number, id: number, props: object, children: any[]}|null}
 */
function fetchDbusMenuLayout(proxy, parentId, depth) {
    if (!proxy)
        return null;
    try {
        // Some peers only populate after an "opened" event + AboutToShow.
        try {
            proxy.call_sync(
                "Event",
                new GLib.Variant("(isvu)", [
                    parentId,
                    "opened",
                    GLib.Variant.new_int32(0),
                    0
                ]),
                Gio.DBusCallFlags.NONE,
                300,
                null
            );
        } catch (err) {}
        aboutToShowDbusMenu(proxy, parentId);
        let ret = proxy.call_sync(
            "GetLayout",
            new GLib.Variant("(iias)", [
                parentId,
                depth,
                ["label", "type", "children-display", "enabled", "visible"]
            ]),
            Gio.DBusCallFlags.NONE,
            2000,
            null
        );
        // ret: (u(ia{sv}av))
        let rev = ret.get_child_value(0).get_uint32();
        let root = _unpackDbusNode(ret.get_child_value(1));
        if (!root)
            return null;
        return { rev: rev, id: root[0], props: root[1] || {}, children: root[2] || [] };
    } catch (err) {
        global.logWarning("globalmenu GetLayout: " + err);
        return null;
    }
}

function dbusMenuEvent(proxy, id) {
    if (!proxy || id === undefined || id === null)
        return;
    try {
        proxy.call(
            "Event",
            new GLib.Variant("(isvu)", [
                id,
                "clicked",
                GLib.Variant.new_int32(0),
                0
            ]),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            null
        );
    } catch (err) {
        global.logWarning("globalmenu dbusmenu Event: " + err);
    }
}

function bindDbusMenu(result, service, path) {
    result.kind = MenuKind.DBUSMENU;
    result.busName = service;
    result.objectPath = path;
    result.source = "registrar";
    result.model = null;
    result.actionGroups = {};

    try {
        result._dbusProxy = createDbusMenuProxy(service, path);
    } catch (err) {
        global.logWarning("globalmenu: dbusmenu proxy failed: " + err);
    }
}

/**
 * Resolve menus for a Meta.Window on X11 or Wayland.
 *
 * 1. Meta.Window GTK D-Bus properties (X11 + Wayland gtk-shell)
 * 2. AppMenu registrar (Qt / Electron / classic dbusmenu)
 * @param {any} metaWindow
 * @returns {ResolvedMenu}
 */
function resolveWindowMenu(metaWindow) {
    let result = {
        kind: MenuKind.NONE,
        busName: null,
        objectPath: null,
        menubarPath: null,
        appMenuPath: null,
        applicationPath: null,
        windowPath: null,
        unityPath: null,
        model: null,
        actionGroups: {},
        source: null,
        windowIds: getWindowIds(metaWindow),
        clientType: getClientType(metaWindow)
    };

    if (!metaWindow)
        return result;

    try {
        let metaProps = readMetaGtkProps(metaWindow);
        if (metaProps && (metaProps.menubarPath || metaProps.appMenuPath)) {
            bindMenuModel(result, metaProps);
            if (result.model)
                return result;
        }
    } catch (err) {
        global.logWarning("globalmenu: Meta GTK props failed: " + err);
    }

    try {
        let reg = tryRegistrar(result.windowIds);
        if (reg) {
            bindDbusMenu(result, reg.service, reg.path);
            if (result.model)
                return result;
        }
    } catch (err) {
        global.logWarning("globalmenu: registrar lookup failed: " + err);
    }

    return result;
}

function guessXid(metaWindow) {
    if (!metaWindow)
        return 0;
    try {
        if (metaWindow.get_xwindow)
            return metaWindow.get_xwindow();
    } catch (err) {}
    try {
        if (metaWindow.get_id)
            return metaWindow.get_id();
    } catch (err) {}
    return 0;
}

module.exports = {
    MenuKind,
    getWindowIds,
    getClientType,
    readMetaGtkProps,
    tryRegistrar,
    probeWindowMenu,
    fetchUnityObjectPath,
    createDbusMenuProxy,
    aboutToShowDbusMenu,
    fetchDbusMenuLayout,
    dbusMenuEvent,
    bindDbusMenu,
    resolveWindowMenu,
    guessXid
};
