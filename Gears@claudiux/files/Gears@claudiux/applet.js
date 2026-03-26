//!/usr/bin/cjs
const Gettext = imports.gettext;
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const appSystem = imports.gi.Cinnamon.AppSystem.get_default();
const Util = imports.misc.util;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const { WindowTracker } = imports.gi.Cinnamon;
const {
  timeout_add_seconds,
  setTimeout,
  clearTimeout,
  source_exists,
  source_remove,
  remove_all_sources
} = require("./lib/mainloopTools");

const UUID = "Gears@claudiux";
const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const ICON = APPLET_DIR + "/icon.png";
const PATH2SCRIPTS = APPLET_DIR + "/scripts";
const XDG_RUNTIME_DIR = GLib.getenv("XDG_RUNTIME_DIR");

Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans.length > 0 && customTrans !== str)
        return customTrans;
    return Gettext.gettext(str);
}

class GearsApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.orientation = orientation;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;
        this.instance_id = instance_id;

        Util.spawnCommandLineAsync("/usr/bin/env bash -c 'cd %s && chmod 755 *.sh'".format(PATH2SCRIPTS));

        this.tracker = WindowTracker.get_default();

        this.mainLoopId = null;
        this.isActive = false;
        this.pathToLogs = "/dev/null";
        this._removeAllLogs();

        this.settings = new AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("useSymbolicIcon", "useSymbolicIcon", () => { this.setIcon() });
        this.settings.bind("activeColor", "activeColor", () => { this.setIcon() });
        this.settings.bind("alwaysOnTop", "alwaysOnTop", () => {
            if (this.contextMenuItem_AlwaysOnTop)
                this.contextMenuItem_AlwaysOnTop._switch.setToggleState(this.alwaysOnTop);
            this._loop();
        });
        this.settings.bind("fullscreenMode", "fullscreenMode");
        this.settings.bind("loopEvery", "loopEvery", () => { this.run_main_loop() });
        this.settings.bind("typeOfLogging", "typeOfLogging", () => { this.changeLogging() });
        this.changeLogging();

        this.contextMenuItem_Refresh = null;
        this.contextMenuItem_Refresh = this._applet_context_menu.addAction(_("Refresh"), () => {
            this._loop();
        });
        this.contextMenuItem_AlwaysOnTop = new PopupMenu.PopupSwitchMenuItem(_("Always on top"),
            this.alwaysOnTop,
            null
        );
        this.contextMenuItem_AlwaysOnTop.connect("toggled", () => {
          this._on_contextMenuItem_AlwaysOnTop_toggled();
        });

        this._applet_context_menu.addMenuItem(this.contextMenuItem_AlwaysOnTop);

        this.contextMenuItem_ViewLogs = null;
        this.contextMenuItem_ViewLogs = this._applet_context_menu.addAction(_("View logs"), () => {
            this._viewLogs();
        });
        this.contextMenuItem_ViewLogs.actor.visible = this.pathToLogs != "/dev/null";

        this.setIcon();
    }

    _on_contextMenuItem_AlwaysOnTop_toggled() {
        this.alwaysOnTop = !this.alwaysOnTop;
        //~ this._loop();
    }

    setIcon() {
        if (this.useSymbolicIcon) {
            this.set_applet_icon_symbolic_name("gears-symbolic");
            if (this.isActive) {
                this._applet_icon.style = `color: ${this.activeColor};`;
            } else {
                this._applet_icon.style = null;
            }
        } else {
            if (this._applet_icon.style)
                this._applet_icon.style = null;
            if (this.isActive) {
                this.set_applet_icon_name("gears-active");
            } else {
                this.set_applet_icon_name("gears-inactive");
            }
        }
    }

    on_applet_clicked(event) {
        if (this.isActive) {
            Util.spawnCommandLineAsync("killall glxgears");
            this.isActive = false;
        } else {
            let option = "";
            if (this.fullscreenMode)
                option += "-fullscreen ";
            Util.spawnCommandLineAsync(`/usr/bin/env bash -c 'glxgears ${option} > ${this.pathToLogs}'`);
            this.isActive = true;
        }
        this.setIcon();
    }

    run_main_loop() {
        if (this.mainLoopId != null && source_exists(this.mainLoopId)) {
            this.isRunning = false;
            source_remove(this.mainLoopId);
            this.mainLoopId = null;
            this.isRunning = true;
        }
        if (this.loopEvery === 99999999) {
            this.isRunning = false;
            return;
        }
        this.mainLoopId = timeout_add_seconds(this.loopEvery, () => {
            this._loop();
            return this.isRunning;
        });
    }

    _loop() {
        const state = this.isActive;
        let windows = global.get_window_actors();
        var found = false;
        for (let i = 0; i < windows.length; i++) {
            if (found) break;
            let metaWindow = windows[i].metaWindow;
            let title = "" + metaWindow.title;
            if (title.includes("glxgears") && !title.includes("log")) {
                if (this.alwaysOnTop) {
                    if (!metaWindow.is_above())
                        metaWindow.make_above();
                } else {
                    if (metaWindow.is_above())
                        metaWindow.unmake_above();
                }
                found = true;
            }
        }
        this.isActive = found;
        if (state !== this.isActive)
            this.setIcon();
    }

    changeLogging() {
        let pathToLogs = this.typeOfLogging;
        pathToLogs = pathToLogs.replace("HOME", HOME_DIR).replace("UUID", UUID).replace("XDG_RUNTIME_DIR", XDG_RUNTIME_DIR);
        this.pathToLogs = pathToLogs;
        if (this.contextMenuItem_ViewLogs) {
            this.contextMenuItem_ViewLogs.actor.visible = pathToLogs != "/dev/null";
        }
        if (this.pathToLogs == "/dev/null") {
            this._removeAllLogs();
        }
    }

    _viewLogs() {
        if (this.pathToLogs === "/dev/null") return;
        let command = PATH2SCRIPTS + "/showlogs.sh " + this.pathToLogs;
        Util.spawnCommandLineAsync(command);
    }

    _removeAllLogs() {
        let logFile = "HOME/.config/cinnamon/spices/UUID/glxgears.log".replace("HOME", HOME_DIR).replace("UUID", UUID);
        Util.spawnCommandLineAsync(`/usr/bin/env bash -c 'rm -f ${logFile}'`);
        logFile = "XDG_RUNTIME_DIR/glxgears.log".replace("HOME", HOME_DIR).replace("XDG_RUNTIME_DIR", XDG_RUNTIME_DIR);
        Util.spawnCommandLineAsync(`/usr/bin/env bash -c 'rm -f ${logFile}'`);
    }

    on_applet_added_to_panel() {
        this.isRunning = true;
        this.run_main_loop();
        this._loop();
    }

    on_applet_removed_from_panel() {
        this.isRunning = false;
        remove_all_sources();
    }
}


function main(metadata, orientation, panel_height, instance_id) {
    return new GearsApplet(metadata, orientation, panel_height, instance_id);
}
