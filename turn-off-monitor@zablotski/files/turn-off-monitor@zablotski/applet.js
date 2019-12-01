const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;
const Main = imports.ui.main;

const UUID = "turn-off-monitor@zablotski"; // version 2.0.0 made by @claudiux
const HOME_DIR = GLib.get_home_dir();
const APPLET_PATH = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const ICON_PATH = APPLET_PATH + "/icon.png";

Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale")

function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return Gettext.gettext(str);
}

/**
 * Execute a function only once after a few seconds.
 * @callback: function to execute.
 * @s: number of seconds.
 */
function setTimeoutInSeconds(callback, s) {
    return Mainloop.timeout_add_seconds(s, () => {
        callback();
        return false;
    }, null);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_tooltip(_("Turn off monitor"));

        this.settings = new Settings.AppletSettings(this, UUID, instance_id);

        this.settings.bindProperty(Settings.BindingDirection.IN,
            'mouse-deactivation-duration',
            'mouseDeactivationDuration',
            null,
            null
        );

        // Keybinding:
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "keybinding",
            "keybinding",
            this.on_shortcut_changed,
            null
        );
        Main.keybindingManager.addHotKey(UUID, this.keybinding, () => this.on_shortcut_used());

        // Icon
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "use-symbolic-icon",
            "useSymbolicIcon",
            this.on_icon_settings_changed,
            null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "icon-color",
            "iconColor",
            this.on_icon_settings_changed,
            null
        );
        this.on_icon_settings_changed();
    },

    /**
     * Turn off the monitor(s) and disable the mouse for a few seconds
     * to prevent the monitor from waking up when moving the mouse.
     */
    on_applet_clicked: function () {
        let duration = Math.trunc(this.mouseDeactivationDuration);
        Util.spawn_async(
            ['/bin/bash', '-c',
            'for m in $(xinput | grep -i Mouse | tr -d " " | tr "\t" " " | cut -d" " -f2 | cut -d"=" -f2); do \
            xinput disable $m; done'],
            null
        );
        Util.spawnCommandLine('xset dpms force off');
        setTimeoutInSeconds(
            function () {
                Util.spawn_async(
                    ['/bin/bash', '-c',
                    'for m in $(xinput | grep -i Mouse | tr -d " " | tr "\t" " " | cut -d" " -f2 | cut -d"=" -f2); do \
                    xinput enable $m; done'],
                    null);
                },
            duration
        );
    },

    /**
     * Remove old keyboard shortcut, if any. Then, install the new keyboard shortcut.
     */
    on_shortcut_changed: function () {
        try{
            Main.keybindingManager.removeHotKey(UUID);
        } catch(e) {}
        if (this.keybinding != null) {
            Main.keybindingManager.addHotKey(UUID, this.keybinding, () => this.on_shortcut_used())
        }
    },

    /**
     * Turn off the monitor(s) by disabling the keyboard for 1 second
     * to prevent the monitor(s) from waking up when the keys are released.
     */
    on_shortcut_used: function () {
        Util.spawn_async(
            ['/bin/bash', '-c',
            'for m in $(xinput | grep Keyboard | tr -d " " | tr "\t" " " | cut -d" " -f2 | cut -d"=" -f2); do \
            xinput disable $m; done'],
            null
        );
        Util.spawnCommandLine('xset dpms force off');
        setTimeoutInSeconds(
            function () {
                Util.spawn_async(
                    ['/bin/bash', '-c',
                    'for m in $(xinput | grep Keyboard | tr -d " " | tr "\t" " " | cut -d" " -f2 | cut -d"=" -f2); do \
                    xinput enable $m; done'],
                    null);
            },
            1
        );

    },

    on_icon_settings_changed: function () {
        if (this.useSymbolicIcon) {
            this.set_applet_icon_symbolic_name("video-display");
            this._applet_icon.style = "color: %s;".format(this.iconColor.toString());
        } else {
            this.set_applet_icon_path(ICON_PATH);
            this._applet_icon.style = "";
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
