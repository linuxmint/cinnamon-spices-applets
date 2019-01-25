const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Tweener = imports.ui.tweener;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

const SCALE_FACTOR = 0.8;
const TRANSITION_TIME = 0.2;
const NUMBER_OF_BOUNCES = 3;

let UUID;

function _(str) {
   let customTranslation = Gettext.dgettext(UUID, str);
   if(customTranslation != str) {
      return customTranslation;
   }
   return Gettext.gettext(str);
}

class MyApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        try {
            super(orientation, panelHeight);

            this.metadata = metadata;
            this.instanceId = instanceId;
            this.orientation = orientation;

            UUID = metadata.uuid;
            Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

            this._bindSettings();

            //set up panel
            this.setPanelIcon();
            this.setTooltip();
        } catch(e) {
            global.logError(e);
        }
    }

    on_applet_clicked(event) {
        this.launch();
    }

    _bindSettings() {
        this.settings = new Settings.AppletSettings(this, this.metadata["uuid"], this.instanceId);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panelIcon", "panelIcon", this.setPanelIcon);
        this.settings.bindProperty(Settings.BindingDirection.IN, "tooltipText", "tooltipText", this.setTooltip);
        this.settings.bindProperty(Settings.BindingDirection.IN, "keyLaunch", "keyLaunch", this.setKeybinding);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showNotifications", "showNotifications");
        this.settings.bindProperty(Settings.BindingDirection.IN, "command", "command");
        this.settings.bindProperty(Settings.BindingDirection.IN, "useRoot", "useRoot");
        this.settings.bindProperty(Settings.BindingDirection.IN, "useAltEnv", "useAltEnv");
        this.settings.bindProperty(Settings.BindingDirection.IN, "altEnv", "altEnv");
        this.setKeybinding();
    }

    setKeybinding() {
        if ( this.keyId ) Main.keybindingManager.removeHotKey(this.keyId);
        if ( this.keyLaunch == "" ) return;
        this.keyId = "commandLauncher-" + this.instanceId;
        Main.keybindingManager.addHotKey(this.keyId, this.keyLaunch, Lang.bind(this, this.launch));
    }

    launch() {
        this._applet_icon.scale_gravity = Clutter.Gravity.CENTER;
        this._animate(NUMBER_OF_BOUNCES);
        if ( this.command == "" ) Util.spawnCommandLine("cinnamon-settings applets " + this.metadata.uuid + " " + this.instanceId);
        else {
            let basePath = null;
            if ( this.useAltEnv && Gio.file_new_for_path(this.altEnv).query_exists(null) ) basePath = this.altEnv;

            let input = this.command.replace("~/", GLib.get_home_dir() + "/"); //replace all ~/ with path to home directory
            if ( this.useRoot ) input = "pkexec " + input;
            let [success, argv] = GLib.shell_parse_argv(input);

            if ( !success ) {
                Main.notify("Unable to parse \"" + this.command + "\"");
                return;
            }

            try {
                let flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD;
                let [result, pid] = GLib.spawn_async(basePath, argv, null, flags, null);
                if ( this.showNotifications )
                    Main.notify(_("Command Launcher") + ": " + _("Process started"), _("Command") + ": "
                                + this.command + "\n" + _("Process Id") + ": "+ pid);
                GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this.onClosed));
            } catch(e) {
                Main.notify(_("Error while trying to run \"%s\"").format(this.command), e.message);
                return;
            }
        }
    }

    _animate(count) {
        if ( count < 1 ) return;
        Tweener.addTween(this._applet_icon, {
            scale_x: SCALE_FACTOR,
            scale_y: SCALE_FACTOR,
            time: TRANSITION_TIME,
            transition: 'easeOutQuad',
            onComplete: function() {
                Tweener.addTween(this._applet_icon, {
                    scale_x: 1,
                    scale_y: 1,
                    time: TRANSITION_TIME,
                    transition: 'easeOutQuad',
                    onComplete: function() {
                        this._animate(count-1);
                    },
                    onCompleteScope: this
                });
            },
            onCompleteScope: this
        });
    }

    setPanelIcon() {
        if ( this.panelIcon == "" ||
           ( GLib.path_is_absolute(this.panelIcon) &&
             GLib.file_test(this.panelIcon, GLib.FileTest.EXISTS) ) ) {
            if ( this.panelIcon.search("-symbolic.svg") == -1 ) this.set_applet_icon_path(this.panelIcon);
            else this.set_applet_icon_symbolic_path(this.panelIcon);
        }
        else if ( Gtk.IconTheme.get_default().has_icon(this.panelIcon) ) {
            if ( this.panelIcon.search("-symbolic") != -1 ) this.set_applet_icon_symbolic_name(this.panelIcon.replace("-symbolic",""));
            else this.set_applet_icon_name(this.panelIcon);
        }
        else this.set_applet_icon_name("go-next");
    }

    setTooltip() {
        this.set_applet_tooltip(this.tooltipText);
    }

    onClosed(pid, status) {
        if ( this.showNotifications )
            Main.notify(_("Command Launcher") + ": " + _("Process ended"), _("Command") + ": "
                        + this.command + "\n" + _("Process Id") + ": " + pid);
    }
}


function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instanceId);
    return myApplet;
}
