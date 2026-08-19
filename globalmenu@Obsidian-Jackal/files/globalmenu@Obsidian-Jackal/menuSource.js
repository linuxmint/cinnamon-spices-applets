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
const REGISTRAR_IFACE = "com.canonical.AppMenu.Registrar";

var MenuKind = {
    NONE: 0,
    MENUMODEL: 1,
    DBUSMENU: 2
};

/** @type {Object.<number, {service: string, path: string, windowId: number}|null>} */
let _registrarCache = {};

function getWindowIds(metaWindow) {
    let ids = [];
    if (!metaWindow)
        return ids;

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

function _emptyProbe(windowIds) {
    return {
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
        windowIds: windowIds || []
    };
}

function _probeFromGtk(metaProps, windowIds) {
    let out = _emptyProbe(windowIds);
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

function _probeFromRegistrar(reg, windowIds) {
    let out = _emptyProbe(windowIds);
    out.kind = MenuKind.DBUSMENU;
    out.source = "registrar";
    out.busName = reg.service;
    out.objectPath = reg.path;
    out.menuKey = (reg.service || "") + "|" + (reg.path || "");
    return out;
}

function _cachedRegistrar(windowIds) {
    if (!windowIds || !windowIds.length)
        return undefined;
    for (let i = 0; i < windowIds.length; i++) {
        let id = windowIds[i];
        if (Object.prototype.hasOwnProperty.call(_registrarCache, id))
            return _registrarCache[id];
    }
    return undefined;
}

/**
 * Async registrar lookup. Results are cached per window id (including misses).
 * @param {number[]} windowIds
 * @param {(reg: {service: string, path: string, windowId: number}|null) => void} callback
 */
function tryRegistrarAsync(windowIds, callback) {
    if (!windowIds || !windowIds.length) {
        callback(null);
        return;
    }

    let cached = _cachedRegistrar(windowIds);
    if (cached !== undefined) {
        callback(cached);
        return;
    }

    let idx = 0;
    let tryNext = () => {
        if (idx >= windowIds.length) {
            for (let i = 0; i < windowIds.length; i++)
                _registrarCache[windowIds[i]] = null;
            callback(null);
            return;
        }
        let id = windowIds[idx++];
        Gio.DBus.session.call(
            REGISTRAR_NAME,
            REGISTRAR_PATH,
            REGISTRAR_IFACE,
            "GetMenuForWindow",
            GLib.Variant.new("(u)", [id]),
            GLib.VariantType.new("(so)"),
            Gio.DBusCallFlags.NONE,
            1000,
            null,
            (conn, res) => {
                try {
                    let reply = conn.call_finish(res);
                    let unpacked = reply.deep_unpack();
                    let service = unpacked[0];
                    let path = unpacked[1];
                    if (service && path && path !== "/") {
                        let reg = { service: service, path: path, windowId: id };
                        _registrarCache[id] = reg;
                        callback(reg);
                        return;
                    }
                } catch (err) {}
                tryNext();
            }
        );
    };
    tryNext();
}

/**
 * Lightweight identity for the focused window's menu exporter.
 * GTK path is synchronous; registrar uses cache only (call ensureProbeAsync to fill).
 * @param {any} metaWindow
 * @returns {MenuProbe}
 */
function probeWindowMenu(metaWindow) {
    let windowIds = getWindowIds(metaWindow);
    let out = _emptyProbe(windowIds);
    if (!metaWindow)
        return out;

    try {
        let metaProps = readMetaGtkProps(metaWindow);
        if (metaProps && (metaProps.menubarPath || metaProps.appMenuPath))
            return _probeFromGtk(metaProps, windowIds);
    } catch (err) {}

    try {
        let cached = _cachedRegistrar(windowIds);
        if (cached)
            return _probeFromRegistrar(cached, windowIds);
    } catch (err) {}

    return out;
}

/**
 * @param {any} metaWindow
 * @param {(probe: MenuProbe) => void} callback
 */
function ensureProbeAsync(metaWindow, callback) {
    let probe = probeWindowMenu(metaWindow);
    if (probe.kind !== MenuKind.NONE || !metaWindow) {
        callback(probe);
        return;
    }
    let windowIds = probe.windowIds;
    tryRegistrarAsync(windowIds, (reg) => {
        if (reg)
            callback(_probeFromRegistrar(reg, windowIds));
        else
            callback(_emptyProbe(windowIds));
    });
}

function bindMenuModel(result, props) {
    result.kind = MenuKind.MENUMODEL;
    result.busName = props.busName;
    result.menubarPath = props.menubarPath;
    result.appMenuPath = props.appMenuPath;
    result.applicationPath = props.applicationPath;
    result.windowPath = props.windowPath;
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
 * @param {string} service
 * @param {string} path
 * @param {(proxy: any|null) => void} callback
 */
function createDbusMenuProxyAsync(service, path, callback) {
    try {
        Gio.DBusProxy.new(
            Gio.DBus.session,
            Gio.DBusProxyFlags.NONE,
            null,
            service,
            path,
            "com.canonical.dbusmenu",
            null,
            (obj, res) => {
                try {
                    callback(Gio.DBusProxy.new_finish(res));
                } catch (err) {
                    global.logWarning("globalmenu: dbusmenu proxy failed: " + err);
                    callback(null);
                }
            }
        );
    } catch (err) {
        global.logWarning("globalmenu: dbusmenu proxy failed: " + err);
        callback(null);
    }
}

/**
 * @param {any} proxy
 * @param {number} id
 * @param {(needsUpdate: boolean) => void} callback
 */
function aboutToShowDbusMenuAsync(proxy, id, callback) {
    if (!proxy) {
        callback(false);
        return;
    }
    try {
        proxy.call(
            "AboutToShow",
            new GLib.Variant("(i)", [id || 0]),
            Gio.DBusCallFlags.NONE,
            500,
            null,
            (p, res) => {
                try {
                    let ret = p.call_finish(res);
                    callback(!!ret.deep_unpack()[0]);
                } catch (err) {
                    callback(false);
                }
            }
        );
    } catch (err) {
        callback(false);
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
            return v.deep_unpack();
        }
    } catch (err) {}
    return v;
}

function _unpackDbusNode(nodeVariant) {
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
 * @param {(layout: {rev: number, id: number, props: object, children: any[]}|null) => void} callback
 */
function fetchDbusMenuLayoutAsync(proxy, parentId, depth, callback) {
    if (!proxy) {
        callback(null);
        return;
    }

    let afterOpened = () => {
        aboutToShowDbusMenuAsync(proxy, parentId, () => {
            try {
                proxy.call(
                    "GetLayout",
                    new GLib.Variant("(iias)", [
                        parentId,
                        depth,
                        ["label", "type", "children-display", "enabled", "visible"]
                    ]),
                    Gio.DBusCallFlags.NONE,
                    2000,
                    null,
                    (p, res) => {
                        try {
                            let ret = p.call_finish(res);
                            let rev = ret.get_child_value(0).get_uint32();
                            let root = _unpackDbusNode(ret.get_child_value(1));
                            if (!root) {
                                callback(null);
                                return;
                            }
                            callback({
                                rev: rev,
                                id: root[0],
                                props: root[1] || {},
                                children: root[2] || []
                            });
                        } catch (err) {
                            global.logWarning("globalmenu GetLayout: " + err);
                            callback(null);
                        }
                    }
                );
            } catch (err) {
                global.logWarning("globalmenu GetLayout: " + err);
                callback(null);
            }
        });
    };

    try {
        proxy.call(
            "Event",
            new GLib.Variant("(isvu)", [
                parentId,
                "opened",
                GLib.Variant.new_int32(0),
                0
            ]),
            Gio.DBusCallFlags.NONE,
            300,
            null,
            (_p, res) => {
                try { _p.call_finish(res); } catch (err) {}
                afterOpened();
            }
        );
    } catch (err) {
        afterOpened();
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

/**
 * @param {ResolvedMenu} result
 * @param {string} service
 * @param {string} path
 * @param {(result: ResolvedMenu) => void} callback
 */
function bindDbusMenuAsync(result, service, path, callback) {
    result.kind = MenuKind.DBUSMENU;
    result.busName = service;
    result.objectPath = path;
    result.source = "registrar";
    result.model = null;
    result.actionGroups = {};
    createDbusMenuProxyAsync(service, path, (proxy) => {
        result._dbusProxy = proxy;
        callback(result);
    });
}

function _emptyResolved(metaWindow) {
    return {
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
}

/**
 * Resolve menus for a Meta.Window (async D-Bus for registrar / dbusmenu proxy).
 * @param {any} metaWindow
 * @param {(result: ResolvedMenu) => void} callback
 */
function resolveWindowMenuAsync(metaWindow, callback) {
    let result = _emptyResolved(metaWindow);
    if (!metaWindow) {
        callback(result);
        return;
    }

    try {
        let metaProps = readMetaGtkProps(metaWindow);
        if (metaProps && (metaProps.menubarPath || metaProps.appMenuPath)) {
            bindMenuModel(result, metaProps);
            if (result.model) {
                callback(result);
                return;
            }
        }
    } catch (err) {
        global.logWarning("globalmenu: Meta GTK props failed: " + err);
    }

    tryRegistrarAsync(result.windowIds, (reg) => {
        if (!reg) {
            callback(result);
            return;
        }
        bindDbusMenuAsync(result, reg.service, reg.path, callback);
    });
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

function invalidateRegistrarCache() {
    _registrarCache = {};
}
