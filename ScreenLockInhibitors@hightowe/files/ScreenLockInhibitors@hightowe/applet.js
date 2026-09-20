const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;

const FLAG_INHIBIT_IDLE = 8;
const POLL_INTERVAL_SECONDS = 3;

// Match standard compact panel icon sizing
const ICON_SIZE = 16;
const COLOR_ALLOWED = "color: #2ecc71;";   // Green
const COLOR_INHIBITED = "color: #e74c3c;"; // Red

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("changes-allow-symbolic");
        this.set_applet_icon_symbolic_name("changes-allow-symbolic");
        
        // Force explicit icon size to match neighboring tray icons
        if (this._applet_icon) {
            this._applet_icon.set_icon_size(ICON_SIZE);
            this._applet_icon.set_style(COLOR_ALLOWED);
        }

        this.set_applet_tooltip("Screensaver: Allowed (No active idle inhibitors)");

        // Setup dropdown popup menu for inhibitor list
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._dbus = Gio.DBus.session;
        this._updateLoop();
    },

    on_applet_clicked: function(event) {
        if (global.settings.get_boolean("panel-edit-mode")) {
            return false;
        }
        this.menu.toggle();
    },

    on_applet_middle_clicked: function(event) {
        if (global.settings.get_boolean("panel-edit-mode")) {
            return false;
        }
        return false;
    },

    _updateLoop: function() {
        this._checkInhibitors();
        this._timeoutId = Mainloop.timeout_add_seconds(
            POLL_INTERVAL_SECONDS,
            () => {
                this._checkInhibitors();
                return true;
            }
        );
    },

    _checkInhibitors: function() {
        this._dbus.call(
            "org.gnome.SessionManager",
            "/org/gnome/SessionManager",
            "org.gnome.SessionManager",
            "GetInhibitors",
            null,
            new GLib.VariantType("(ao)"),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (conn, res) => {
                try {
                    let reply = conn.call_finish(res);
                    let [paths] = reply.deepUnpack();

                    if (!paths || paths.length === 0) {
                        this._renderInhibitors([]);
                        return;
                    }

                    this._inspectInhibitorPaths(paths);
                } catch (e) {
                    this._renderInhibitors([]);
                }
            }
        );
    },

    _inspectInhibitorPaths: function(paths) {
        let active = [];
        let remaining = paths.length;

        paths.forEach(objPath => {
            this._dbus.call(
                "org.gnome.SessionManager",
                objPath,
                "org.gnome.SessionManager.Inhibitor",
                "GetFlags",
                null,
                new GLib.VariantType("(u)"),
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (conn, resFlags) => {
                    let flags = 0;
                    try {
                        let reply = conn.call_finish(resFlags);
                        [flags] = reply.deepUnpack();
                    } catch (e) {}

                    if ((flags & FLAG_INHIBIT_IDLE) !== 0) {
                        this._getInhibitorDetails(objPath, (details) => {
                            if (details) {
                                active.push(details);
                            }
                            remaining--;
                            if (remaining === 0) {
                                this._renderInhibitors(active);
                            }
                        });
                    } else {
                        remaining--;
                        if (remaining === 0) {
                            this._renderInhibitors(active);
                        }
                    }
                }
            );
        });
    },

    _getInhibitorDetails: function(objPath, callback) {
        this._dbus.call(
            "org.gnome.SessionManager",
            objPath,
            "org.gnome.SessionManager.Inhibitor",
            "GetAppId",
            null,
            new GLib.VariantType("(s)"),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (conn, resApp) => {
                let appId = "Unknown";
                try {
                    let reply = conn.call_finish(resApp);
                    [appId] = reply.deepUnpack();
                } catch (e) {}

                this._dbus.call(
                    "org.gnome.SessionManager",
                    objPath,
                    "org.gnome.SessionManager.Inhibitor",
                    "GetReason",
                    null,
                    new GLib.VariantType("(s)"),
                    Gio.DBusCallFlags.NONE,
                    -1,
                    null,
                    (conn2, resReason) => {
                        let reason = "No reason provided";
                        try {
                            let reply = conn2.call_finish(resReason);
                            [reason] = reply.deepUnpack();
                        } catch (e) {}

                        callback({ appId: appId, reason: reason });
                    }
                );
            }
        );
    },

    _renderInhibitors: function(inhibitors) {
        this.menu.removeAll();

        if (inhibitors.length === 0) {
            this.set_applet_icon_symbolic_name("changes-allow-symbolic");
            if (this._applet_icon) {
                this._applet_icon.set_icon_size(ICON_SIZE);
                this._applet_icon.set_style(COLOR_ALLOWED);
            }
            this.set_applet_tooltip("Screensaver: Allowed (No active idle inhibitors)");

            let item = new PopupMenu.PopupMenuItem("No active screensaver inhibitors", { reactive: false });
            this.menu.addMenuItem(item);
        } else {
            this.set_applet_icon_symbolic_name("changes-prevent-symbolic");
            if (this._applet_icon) {
                this._applet_icon.set_icon_size(ICON_SIZE);
                this._applet_icon.set_style(COLOR_INHIBITED);
            }

            let summary = inhibitors.map(i => `${i.appId} (${i.reason})`).join(", ");
            this.set_applet_tooltip(`Screensaver INHIBITED by:\n${summary}`);

            let header = new PopupMenu.PopupMenuItem("Active Screensaver Inhibitors:", { reactive: false });
            this.menu.addMenuItem(header);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            for (let item of inhibitors) {
                let text = `• ${item.appId}: "${item.reason}"`;
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem(text, { reactive: false }));
            }
        }
    },

    on_applet_removed_from_panel: function() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
