const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const ScreenSaver = imports.misc.screenSaver;
const Util = imports.misc.util;
const Lang = imports.lang;


let button_path, menu_item_icon_size, use_symbolic_icons;
let has_console_kit, has_upower, has_systemd, session_manager, display_manager;

let CommandDispatcher = {
    shutDown: function() {
        if ( has_console_kit ) Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Stop");
        else if ( has_systemd ) Util.spawnCommandLine("systemctl poweroff");
    },

    restart: function() {
        if ( has_console_kit ) Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Restart");
        else if ( has_systemd ) Util.spawnCommandLine("systemctl reboot");
    },

    hibernate: function() {
        if ( has_upower ) Util.spawnCommandLine("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Hibernate");
        else if ( has_systemd ) Util.spawnCommandLine("systemctl hibernate");
    },

    suspend: function() {
        if ( has_upower ) Util.spawnCommandLine("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend");
        else if ( has_systemd ) Util.spawnCommandLine("systemctl suspend");
    },

    sleep: function() {
        if ( has_systemd ) Util.spawnCommandLine("systemctl hybrid-sleep");
    },

    logOff: function() {
        Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.Logout uint32:1");
    },

    uSwitch: function() {
        switch ( display_manager ) {
            case "mdm":
                Util.spawnCommandLine("mdmflexiserver");
                break;
            case "gdm":
                Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                Util.spawnCommandLine("gdmflexiserver");
                break;
            case "lxdm":
                Util.spawnCommandLine("lxdm -c USER_SWITCH");
                break;
            case "lightdm":

        }
    },

    guest: function() {
        if ( session_manager == 0 ) {
            Util.spawnCommandLine("cinnamon-screensaver-command --lock");
            Util.spawnCommandLine("dm-tool switch-to-guest");
        }
    },

    lock: function() {
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
        let screensaver_settings = new Gio.Settings({ schema: "org.cinnamon.desktop.screensaver" });
        let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
        if ( screensaver_dialog.query_exists(null) ) {
            if ( screensaver_settings.get_boolean("ask-for-away-message") ) Util.spawnCommandLine("cinnamon-screensaver-lock-dialog");
            else Util.spawnCommandLine("cinnamon-screensaver-command --lock");
        }
        else this._screenSaverProxy.LockRemote();
    }
}


function CommandItem(commandId, title) {
    this._init(commandId, title);
}

CommandItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(commandId, title) {
        try {

            this.commandId = commandId;

            PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

            this.addActor(this.getIcon());

            let label = new St.Label({ text: title });
            this.addActor(label);

        } catch (e){
            global.logError(e);
        }
    },

    getIcon: function() {
        let iconType, iconPath;
        if ( use_symbolic_icons ) {
            iconPath = button_path + this.commandId + "-symbolic.svg";
            iconType = St.IconType.SYMBOLIC;
        }
        else {
            iconPath = button_path + this.commandId + ".svg";
            iconType = St.IconType.FULLCOLOR;
        }

        let file = Gio.file_new_for_path(iconPath);
        let gicon = new Gio.FileIcon({ file: file });
        let icon = new St.Icon({ gicon: gicon, icon_size: menu_item_icon_size, icon_type: iconType });

        return icon;
    },

    activate: function() {
        try {
            this.emit("activate", this, false);
            CommandDispatcher[this.commandId]();
        } catch (e) {
            global.logError(e);
        }
    }
}


function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        try {

            this.metadata = metadata;
            this.instanceId = instanceId;
            this.orientation = orientation;
            button_path = metadata.path + "/buttons/";

            Applet.TextIconApplet.prototype._init.call(this, this.orientation, panel_height);

            this.bindSettings();

            //set up panel
            this.setPanelIcon();
            this.setPanelText();
            this.set_applet_tooltip(_("Session"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, this.orientation);
            this.menuManager.addMenu(this.menu);

            this.checkSession();

            this.buildMenu();

        } catch(e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    checkSession: function() {
        //check if ConsoleKit is running
        let [a, output] = GLib.spawn_command_line_sync("ps -C console-kit-dae");
        if ( String(output).split("\n").length > 2 ) has_console_kit = true;

        //check if UPower is running
        let [a, output] = GLib.spawn_command_line_sync("ps -C upowerd");
        if ( String(output).split("\n").length > 2 ) has_upower = true;

        //check if systemd is being used
        let [a, output] = GLib.spawn_command_line_sync("ps -C systemd");
        if ( String(output).split("\n").length > 2 ) has_systemd = true;

        //check display manager
        if ( GLib.file_test("/etc/X11/default-display-manager", GLib.FileTest.EXISTS) ) {
            let [a, output] = GLib.spawn_command_line_sync("grep -oE \"[^/]+$\" /etc/X11/default-display-manager");
            display_manager = String(output).split("\n")[0];
        }
        else {
            let dFiles = ["/etc/systemd/system/display-manager.service", "/etc/systemd/system-display-manager.service"];
            for ( let i = 0; i < dFiles.length; i++ ) {
                if ( GLib.file_test(dFiles[i], GLib.FileTest.EXISTS) ) {
                    let [a, output] = GLib.spawn_command_line_sync("grep -e \"Exec\" " + dFiles[i]);
                    display_manager = String(output).split("/").pop().split("\n")[0];
                    break;
                }
            }
        }
        if ( !display_manager ) global.log("Unable to determine display manager");
    },

    bindSettings: function() {
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instanceId);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panelIcon", "panelIcon", this.setPanelIcon);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panelText", "panelText", this.setPanelText);
        this.settings.bindProperty(Settings.BindingDirection.IN, "iconSize", "iconSize", this.buildMenu);
        this.settings.bindProperty(Settings.BindingDirection.IN, "symbolicMenuIcons", "symbolicMenuIcons", this.buildMenu);
    },

    buildMenu: function() {
        try {

            this.menu.removeAll();

            menu_item_icon_size = this.iconSize;
            use_symbolic_icons = this.symbolicMenuIcons;

            //lock
            let lock = new CommandItem("lock", _("Lock Screen"));
            this.menu.addMenuItem(lock);

            //switch user
            let uSwitch = new CommandItem("uSwitch", _("Switch User"));
            this.menu.addMenuItem(uSwitch);

            //guest
            if ( session_manager == 0 ) {
                let guest = new CommandItem("guest", _("Guest Session"));
                this.menu.addMenuItem(guest);
            }

            //log off
            let logOff = new CommandItem("logOff", _("Log Off"));
            this.menu.addMenuItem(logOff);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            //suspend
            let suspend = new CommandItem("suspend", _("Suspend"));
            this.menu.addMenuItem(suspend);

            //sleep
            if ( has_systemd ) {
                let sleep = new CommandItem("sleep", _("Sleep"));
                this.menu.addMenuItem(sleep);
            }

            //hibernate
            let hibernate = new CommandItem("hibernate", _("Hibernate"));
            this.menu.addMenuItem(hibernate);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            //restart
            let restart = new CommandItem("restart", _("Restart"));
            this.menu.addMenuItem(restart);

            //shut down
            let shutDown = new CommandItem("shutDown", _("Shut Down"));
            this.menu.addMenuItem(shutDown);

        } catch(e) {
            global.logError(e);
        }
    },

    setPanelIcon: function() {
        if ( this.panelIcon == "" ||
           ( GLib.path_is_absolute(this.panelIcon) &&
             GLib.file_test(this.panelIcon, GLib.FileTest.EXISTS) ) ) {
            if ( this.panelIcon.search("-symbolic.svg") == -1 ) this.set_applet_icon_path(this.panelIcon);
            else this.set_applet_icon_symbolic_path(this.panelIcon);
        }
        else if ( Gtk.IconTheme.get_default().has_icon(this.panelIcon) ) {
            if ( this.panelIcon.search("-symbolic") != -1 ) this.set_applet_icon_symbolic_name(this.panelIcon);
            else this.set_applet_icon_name(this.panelIcon);
        }
        else this.set_applet_icon_symbolic_name("system-shutdown");
    },

    setPanelText: function() {
        if ( this.panelText ) this.set_applet_label(this.panelText);
        else this.set_applet_label("");
    }
}


function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
