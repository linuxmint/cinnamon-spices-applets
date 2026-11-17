const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;

const HELPER = "/usr/local/bin/mouse-power-saver";
const GUI_HELPER = "/usr/local/bin/mouse-power-saver-gui";

const TOUCHPAD_SCHEMA = "org.cinnamon.desktop.peripherals.touchpad";
const TOUCHPAD_KEY = "send-events";

function MousePowerSaverApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MousePowerSaverApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.iconDir = GLib.build_filenamev([
            GLib.get_user_data_dir(),
            "cinnamon",
            "applets",
            "mouse-power-saver@doctorshoe",
            "icons"
        ]);

        this.iconOn = GLib.build_filenamev([this.iconDir, "mouse-on.svg"]);
        this.iconOff = GLib.build_filenamev([this.iconDir, "mouse-off.svg"]);

        this.mouseStatusText = "Status unbekannt";

        this.touchpadSettings = null;
        this.touchpadAvailable = this._touchpadSchemaAvailable();

        this.set_applet_tooltip("Mouse Power Saver");

        this._buildMenu();
        this._status();
        this._updateMenuLabels();
    },

    _buildMenu: function() {
        this._applet_context_menu.addMenuItem(
            new PopupMenu.PopupMenuItem("Maus Power Saver", { reactive: false })
        );

        this.mouseOffItem = this._addMenuItem("Ausschalten / Normalbetrieb", () => {
            this._run("off", true);
        });

        this.mouse10Item = this._addMenuItem("10 Sekunden", () => {
            this._run("on 10000", true);
        });

        this.mouse20Item = this._addMenuItem("20 Sekunden", () => {
            this._run("on 20000", true);
        });

        this.mouse30Item = this._addMenuItem("30 Sekunden", () => {
            this._run("on 30000", true);
        });

        this.mouse60Item = this._addMenuItem("1 Minute", () => {
            this._run("on 60000", true);
        });

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._applet_context_menu.addMenuItem(
            new PopupMenu.PopupMenuItem("Touchpad Guard", { reactive: false })
        );

        if (this.touchpadAvailable) {
            this.touchpadEnabledItem = this._addMenuItem("Touchpad einschalten", () => {
                this._setTouchpad("enabled");
            });

            this.touchpadDisabledItem = this._addMenuItem("Touchpad ausschalten", () => {
                this._setTouchpad("disabled");
            });

            this.touchpadExternalMouseItem = this._addMenuItem("Touchpad aus bei externer Maus", () => {
                this._setTouchpad("disabled-on-external-mouse");
            });
        } else {
            this._applet_context_menu.addMenuItem(
                new PopupMenu.PopupMenuItem("Touchpad-Steuerung nicht verfügbar", { reactive: false })
            );
        }
    },

    _addMenuItem: function(label, callback) {
        let item = new PopupMenu.PopupMenuItem(label);
        item.connect("activate", callback);
        this._applet_context_menu.addMenuItem(item);
        return item;
    },

    on_applet_clicked: function(event) {
        this._run("toggle", true);
    },

    _run: function(command, showNotification) {
        this.set_applet_tooltip("Mouse Power Saver: Änderung wird ausgeführt ...");

        try {
            let args = command.split(" ");
            GLib.spawn_async(null, [GUI_HELPER].concat(args), null, GLib.SpawnFlags.SEARCH_PATH, null);
        } catch (e) {
            this.set_applet_tooltip("Mouse Power Saver: Fehler beim Ausführen");
            Main.notify("Mouse Power Saver", "Fehler beim Ausführen");
            return;
        }

        Mainloop.timeout_add_seconds(1, () => {
            this._refreshMouseStatus(showNotification);
            return false;
        });

        Mainloop.timeout_add_seconds(3, () => {
            this._refreshMouseStatus(false);
            return false;
        });
    },

    _readMouseStatusAsync: function(callback) {
        try {
            let proc = new Gio.Subprocess({
                argv: [HELPER, "status"],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });

            proc.init(null);

            proc.communicate_utf8_async(null, null, (subprocess, result) => {
                try {
                    let [, stdout, stderr] = subprocess.communicate_utf8_finish(result);
                    let text = stdout ? stdout.trim() : "Status unbekannt";

                    if (text.length === 0 && stderr) {
                        text = stderr.trim();
                    }

                    callback(text.length > 0 ? text : "Status unbekannt");
                } catch (e) {
                    callback("Helfer nicht gefunden");
                }
            });
        } catch (e) {
            callback("Helfer nicht gefunden");
        }
    },

    _currentMouseMode: function() {
        let text = this.mouseStatusText;

        if (text.indexOf("Ein: 10000") === 0) {
            return "10000";
        } else if (text.indexOf("Ein: 20000") === 0) {
            return "20000";
        } else if (text.indexOf("Ein: 30000") === 0) {
            return "30000";
        } else if (text.indexOf("Ein: 60000") === 0) {
            return "60000";
        } else if (text.indexOf("Aus") === 0) {
            return "off";
        }

        return "unknown";
    },

    _applyMouseStatus: function(text) {
        this.mouseStatusText = text;

        this.set_applet_tooltip("Mouse Power Saver: " + text);

        let iconPath = text.indexOf("Ein:") === 0 ? this.iconOn : this.iconOff;

        try {
            this.set_applet_icon_path(iconPath);
        } catch (e) {
            this.set_applet_icon_name("input-mouse");
        }

        return text;
    },

    _refreshMouseStatus: function(showNotification) {
        this._readMouseStatusAsync((text) => {
            this._applyMouseStatus(text);
            this._updateMenuLabels();

            if (showNotification) {
                this._notifyMouseStatus(text);
            }
        });
    },

    _status: function() {
        this._refreshMouseStatus(false);
        return this.mouseStatusText;
    },

    _notifyMouseStatus: function(text) {
        let message = text;

        if (text.indexOf("Aus") === 0) {
            message = "Aus / Normalbetrieb";
        } else if (text.indexOf("Ein: 10000") === 0) {
            message = "Ein – 10 Sekunden";
        } else if (text.indexOf("Ein: 20000") === 0) {
            message = "Ein – 20 Sekunden";
        } else if (text.indexOf("Ein: 30000") === 0) {
            message = "Ein – 30 Sekunden";
        } else if (text.indexOf("Ein: 60000") === 0) {
            message = "Ein – 1 Minute";
        }

        Main.notify("Mouse Power Saver", message);
    },

    _touchpadSchemaAvailable: function() {
        try {
            this.touchpadSettings = new Gio.Settings({ schema_id: TOUCHPAD_SCHEMA });
            return true;
        } catch (e) {
            this.touchpadSettings = null;
            return false;
        }
    },

    _setTouchpad: function(value) {
        if (!this.touchpadAvailable || this.touchpadSettings === null) {
            Main.notify("Touchpad Guard", "Touchpad-Steuerung nicht verfügbar");
            return;
        }

        try {
            this.touchpadSettings.set_string(TOUCHPAD_KEY, value);
            this._updateMenuLabels();
            Main.notify("Touchpad Guard", this._touchpadStatus());
        } catch (e) {
            Main.notify("Touchpad Guard", "Fehler beim Setzen");
        }
    },

    _touchpadRaw: function() {
        if (!this.touchpadAvailable || this.touchpadSettings === null) {
            return "unavailable";
        }

        try {
            return this.touchpadSettings.get_string(TOUCHPAD_KEY);
        } catch (e) {
            return "unavailable";
        }
    },

    _touchpadStatus: function() {
        let raw = this._touchpadRaw();

        if (raw === "enabled") {
            return "ein";
        } else if (raw === "disabled") {
            return "aus";
        } else if (raw === "disabled-on-external-mouse") {
            return "aus bei externer Maus";
        } else if (raw === "unavailable") {
            return "nicht verfügbar";
        }

        return raw;
    },

    _mark: function(active, label) {
        return active ? "✓ " + label : "   " + label;
    },

    _updateMenuLabels: function() {
        let mouseMode = this._currentMouseMode();

        if (this.mouseOffItem) {
            this.mouseOffItem.label.set_text(this._mark(mouseMode === "off", "Ausschalten / Normalbetrieb"));
        }
        if (this.mouse10Item) {
            this.mouse10Item.label.set_text(this._mark(mouseMode === "10000", "10 Sekunden"));
        }
        if (this.mouse20Item) {
            this.mouse20Item.label.set_text(this._mark(mouseMode === "20000", "20 Sekunden"));
        }
        if (this.mouse30Item) {
            this.mouse30Item.label.set_text(this._mark(mouseMode === "30000", "30 Sekunden"));
        }
        if (this.mouse60Item) {
            this.mouse60Item.label.set_text(this._mark(mouseMode === "60000", "1 Minute"));
        }

        if (!this.touchpadAvailable) {
            return;
        }

        let touchpadMode = this._touchpadRaw();

        if (this.touchpadEnabledItem) {
            this.touchpadEnabledItem.label.set_text(this._mark(touchpadMode === "enabled", "Touchpad einschalten"));
        }
        if (this.touchpadDisabledItem) {
            this.touchpadDisabledItem.label.set_text(this._mark(touchpadMode === "disabled", "Touchpad ausschalten"));
        }
        if (this.touchpadExternalMouseItem) {
            this.touchpadExternalMouseItem.label.set_text(this._mark(touchpadMode === "disabled-on-external-mouse", "Touchpad aus bei externer Maus"));
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MousePowerSaverApplet(orientation, panel_height, instance_id);
}
