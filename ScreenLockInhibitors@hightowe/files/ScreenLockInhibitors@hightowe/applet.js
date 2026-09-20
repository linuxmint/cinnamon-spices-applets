const Applet = imports.ui.applet;
const GnomeSession = imports.misc.gnomeSession;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;

const FLAG_INHIBIT_IDLE = 8;
const POLL_INTERVAL_SECONDS = 3;

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

        this.set_applet_icon_symbolic_name("changes-allow-symbolic");
        if (this._applet_icon) {
            this._applet_icon.set_icon_size(ICON_SIZE);
            this._applet_icon.set_style(COLOR_ALLOWED);
        }

        this.set_applet_tooltip("Screensaver: Allowed (No active idle inhibitors)");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Built-in Cinnamon wrapper for org.gnome.SessionManager
        this._sessionManager = new GnomeSession.SessionManager();

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
        this._sessionManager.GetInhibitorsRemote((paths, err) => {
            if (err || !paths || paths.length === 0) {
                this._renderInhibitors([]);
                return;
            }

            let pathList = paths[0];
            if (!pathList || pathList.length === 0) {
                this._renderInhibitors([]);
                return;
            }

            let active = [];
            let remaining = pathList.length;

            pathList.forEach(objPath => {
                let inhibitor = new GnomeSession.Inhibitor(objPath);
                inhibitor.GetFlagsRemote((flagsResult, fErr) => {
                    let flags = (!fErr && flagsResult) ? flagsResult[0] : 0;
                    if ((flags & FLAG_INHIBIT_IDLE) !== 0) {
                        inhibitor.GetAppIdRemote((appIdResult, aErr) => {
                            let appId = (!aErr && appIdResult) ? appIdResult[0] : "Unknown";
                            inhibitor.GetReasonRemote((reasonResult, rErr) => {
                                let reason = (!rErr && reasonResult) ? reasonResult[0] : "No reason provided";
                                active.push({ appId: appId, reason: reason });
                                remaining--;
                                if (remaining === 0) {
                                    this._renderInhibitors(active);
                                }
                            });
                        });
                    } else {
                        remaining--;
                        if (remaining === 0) {
                            this._renderInhibitors(active);
                        }
                    }
                });
            });
        });
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

