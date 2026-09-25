const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;

function CinnaQuick(orientation, panelHeight, instanceId) {
    this._init(orientation, panelHeight, instanceId);
}

CinnaQuick.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panelHeight, instanceId) {
        Applet.TextIconApplet.prototype._init.call(
            this,
            orientation,
            panelHeight,
            instanceId
        );

        this.set_applet_icon_name("preferences-system");
        this.set_applet_tooltip("Quick Settings");

        this.menuManager =
            new PopupMenu.PopupMenuManager(this);

        this.menu =
            new Applet.AppletPopupMenu(
                this,
                orientation
            );

        this.menuManager.addMenu(this.menu);

        // =========================
        // OROLOGIO
        // =========================

        this.clockItem =
            new PopupMenu.PopupMenuItem("");

        this.clockItem.setSensitive(false);

        this.menu.addMenuItem(
            this.clockItem
        );

        this.updateClock();

        this.clockTimeout =
            GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                1,
                () => {
                    this.updateClock();
                    return true;
                }
            );

        // =========================
        // TITOLO
        // =========================

        let title =
            new PopupMenu.PopupMenuItem(
                "Quick Settings"
            );

        title.setSensitive(false);

        this.menu.addMenuItem(title);

        // =========================
        // WI-FI
        // =========================

        this.wifi =
            new PopupMenu.PopupSwitchMenuItem(
                "Wi-Fi",
                this.getWifiState()
            );

        this.wifi.connect(
            "toggled",
            (item, state) => {
                this.setWifiState(state);
            }
        );

        this.menu.addMenuItem(
            this.wifi
        );

        // =========================
        // IMPOSTAZIONI DI RETE
        // =========================

        this.networkSettings =
            new PopupMenu.PopupMenuItem(
                "⚙ Impostazioni di rete"
            );

        this.menu.addMenuItem(
            this.networkSettings
        );

        this.networkSettings.connect(
            "activate",
            () => {
                this.openNetworkSettings();
            }
        );

        // =========================
        // BLUETOOTH
        // =========================

        this.bluetooth =
            new PopupMenu.PopupSwitchMenuItem(
                "Bluetooth",
                this.getBluetoothState()
            );

        this.bluetooth.connect(
            "toggled",
            (item, state) => {
                this.setBluetoothState(state);
            }
        );

        this.menu.addMenuItem(
            this.bluetooth
        );

        // =========================
        // VOLUME
        // =========================

        let volume =
            this.getVolume();

        this.volumeSlider =
            new PopupMenu.PopupSliderMenuItem(
                volume / 100
            );

        this.menu.addMenuItem(
            this.volumeSlider
        );

        this.volumeSlider.connect(
            "value-changed",
            (item, value) => {
                this.setVolume(value);
            }
        );

        // =========================
        // LUMINOSITÀ
        // =========================

        let brightness =
            this.getBrightness();

        this.brightnessSlider =
            new PopupMenu.PopupSliderMenuItem(
                brightness
            );

        this.menu.addMenuItem(
            this.brightnessSlider
        );

        this.brightnessSlider.connect(
            "value-changed",
            (item, value) => {
                this.setBrightness(value);
            }
        );

        // =========================
        // NOTIFICHE
        // =========================

        this.menu.addMenuItem(
            new PopupMenu.PopupSeparatorMenuItem()
        );

        this.notificationItem =
            new PopupMenu.PopupMenuItem(
                "🔔 Notifiche"
            );

        this.menu.addMenuItem(
            this.notificationItem
        );

        this.notificationItem.connect(
            "activate",
            () => {
                this.openNotifications();
            }
        );

        // =========================
        // AGGIORNAMENTI
        // =========================

        this.updateItem =
            new PopupMenu.PopupMenuItem(
                "🔄 Aggiornamenti di sistema"
            );

        this.menu.addMenuItem(
            this.updateItem
        );

        this.updateItem.connect(
            "activate",
            () => {
                this.openUpdateManager();
            }
        );
    },

    // =========================
    // OROLOGIO
    // =========================

    updateClock: function() {
        let now = new Date();

        let time =
            now.toLocaleTimeString(
                "it-IT",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }
            );

        let date =
            now.toLocaleDateString(
                "it-IT",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long"
                }
            );

        this.clockItem.label.text =
            time + "\n" + date;
    },

    // =========================
    // WI-FI
    // =========================

    getWifiState: function() {
        try {
            let [success, output] =
                GLib.spawn_command_line_sync(
                    "nmcli radio wifi"
                );

            if (!success)
                return false;

            return output
                .toString()
                .trim() === "enabled";

        } catch (e) {
            global.logError(
                "CinnaQuick Wi-Fi: " + e
            );

            return false;
        }
    },

    setWifiState: function(enabled) {
        let command = enabled
            ? "nmcli radio wifi on"
            : "nmcli radio wifi off";

        GLib.spawn_command_line_async(
            command
        );
    },

    // =========================
    // IMPOSTAZIONI DI RETE
    // =========================

    openNetworkSettings: function() {
        try {
            GLib.spawn_command_line_async(
                "cinnamon-settings network"
            );

            this.menu.close();

        } catch (e) {
            global.logError(
                "CinnaQuick Network Settings: " +
                e
            );
        }
    },

    // =========================
    // BLUETOOTH
    // =========================

    getBluetoothState: function() {
        try {
            let [success, output] =
                GLib.spawn_command_line_sync(
                    "bluetoothctl show"
                );

            if (!success)
                return false;

            return output
                .toString()
                .indexOf(
                    "Powered: yes"
                ) !== -1;

        } catch (e) {
            global.logError(
                "CinnaQuick Bluetooth: " +
                e
            );

            return false;
        }
    },

    setBluetoothState: function(enabled) {
        let command = enabled
            ? "bluetoothctl power on"
            : "bluetoothctl power off";

        GLib.spawn_command_line_async(
            command
        );
    },

    // =========================
    // VOLUME
    // =========================

    getVolume: function() {
        try {
            let [success, output] =
                GLib.spawn_command_line_sync(
                    "pactl get-sink-volume @DEFAULT_SINK@"
                );

            if (!success)
                return 0;

            let match =
                output
                    .toString()
                    .match(/(\d+)%/);

            if (match)
                return parseInt(
                    match[1]
                );

        } catch (e) {
            global.logError(
                "CinnaQuick Volume: " +
                e
            );
        }

        return 0;
    },

    setVolume: function(value) {
        let percent =
            Math.round(value * 100);

        if (percent < 0)
            percent = 0;

        if (percent > 100)
            percent = 100;

        let command =
            "pactl set-sink-volume " +
            "@DEFAULT_SINK@ " +
            percent +
            "%";

        GLib.spawn_command_line_async(
            command
        );
    },

    // =========================
    // DISPLAY
    // =========================

    getDisplay: function() {
        try {
            let [success, output] =
                GLib.spawn_command_line_sync(
                    "xrandr --query"
                );

            if (!success)
                return null;

            let lines =
                output.toString().split("\n");

            for (let i = 0; i < lines.length; i++) {
                if (
                    lines[i].indexOf(" connected") !== -1 &&
                    lines[i].indexOf(" disconnected") === -1
                ) {
                    return lines[i]
                        .trim()
                        .split(/\s+/)[0];
                }
            }

        } catch (e) {
            global.logError(
                "CinnaQuick Display: " + e
            );
        }

        return null;
    },

    // =========================
    // LUMINOSITÀ
    // =========================

    getBrightness: function() {
        return 1.0;
    },

    setBrightness: function(value) {
        if (value < 0.1)
            value = 0.1;

        if (value > 1.0)
            value = 1.0;

        let display =
            this.getDisplay();

        if (!display)
            return;

        let command =
            "xrandr --output " +
            display +
            " --brightness " +
            value.toFixed(2);

        GLib.spawn_command_line_async(
            command
        );
    },

    // =========================
    // NOTIFICHE
    // =========================

    openNotifications: function() {
        try {
            GLib.spawn_command_line_async(
                "cinnamon-settings notifications"
            );

            this.menu.close();

        } catch (e) {
            global.logError(
                "CinnaQuick Notifications: " +
                e
            );
        }
    },

    // =========================
    // AGGIORNAMENTI
    // =========================

    openUpdateManager: function() {
        try {
            GLib.spawn_command_line_async(
                "mintupdate"
            );

            this.menu.close();

        } catch (e) {
            global.logError(
                "CinnaQuick Updates: " +
                e
            );
        }
    },

    // =========================
    // DISTRUZIONE
    // =========================

    on_applet_removed_from_panel: function() {
        if (this.clockTimeout) {
            GLib.source_remove(
                this.clockTimeout
            );

            this.clockTimeout = null;
        }
    },

    // =========================
    // CLICK
    // =========================

    on_applet_clicked: function() {
        this.menu.toggle();
    }
};

function main(
    metadata,
    orientation,
    panelHeight,
    instanceId
) {
    return new CinnaQuick(
        orientation,
        panelHeight,
        instanceId
    );
}
