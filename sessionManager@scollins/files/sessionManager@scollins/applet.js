const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const ModalDialog = imports.ui.modalDialog;
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
        let screensaver_settings = new Gio.Settings({ schema: "org.cinnamon.screensaver" });
        let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
        if ( screensaver_dialog.query_exists(null) ) {
            if ( screensaver_settings.get_boolean("ask-for-away-message") ) Util.spawnCommandLine("cinnamon-screensaver-lock-dialog");
            else Util.spawnCommandLine("cinnamon-screensaver-command --lock");
        }
        else this._screenSaverProxy.LockRemote();
    }
}


function AboutDialog(metadata) {
    this._init(metadata);
}

AboutDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    
    _init: function(metadata) {
        try {
            ModalDialog.ModalDialog.prototype._init.call(this, {  });
            
            let contentBox = new St.BoxLayout({ vertical: true, style_class: "about-content" });
            this.contentLayout.add_actor(contentBox);
            
            let topBox = new St.BoxLayout();
            contentBox.add_actor(topBox);
            
            //icon
            let icon;
            if ( metadata.icon ) icon = new St.Icon({ icon_name: metadata.icon, icon_size: 48, icon_type: St.IconType.FULLCOLOR, style_class: "about-icon" });
            else {
                let file = Gio.file_new_for_path(metadata.path + "/icon.png");
                if ( file.query_exists(null) ) {
                    let gicon = new Gio.FileIcon({ file: file });
                    icon = new St.Icon({ gicon: gicon, icon_size: 48, icon_type: St.IconType.FULLCOLOR, style_class: "about-icon" });
                }
                else {
                    icon = new St.Icon({ icon_name: "applets", icon_size: 48, icon_type: St.IconType.FULLCOLOR, style_class: "about-icon" });
                }
            }
            topBox.add_actor(icon);
            
            let topTextBox = new St.BoxLayout({ vertical: true });
            topBox.add_actor(topTextBox);
            
            /*title*/
            let titleBox = new St.BoxLayout();
            topTextBox.add_actor(titleBox);
            
            let title = new St.Label({ text: metadata.name, style_class: "about-title" });
            titleBox.add_actor(title);
            
            if ( metadata.version ) {
                let versionBin = new St.Bin({ x_align: St.Align.START, y_align: St.Align.END});
                titleBox.add_actor(versionBin);
                let version = new St.Label({ text: "v " + metadata.version, style_class: "about-version" });
                versionBin.add_actor(version);
            }
            
            //uuid
            let uuid = new St.Label({ text: metadata.uuid, style_class: "about-uuid" });
            topTextBox.add_actor(uuid);
            
            //description
            let desc = new St.Label({ text: metadata.description, style_class: "about-description" });
            let dText = desc.clutter_text;
            topTextBox.add_actor(desc);
            
            /*optional content*/
            let scrollBox = new St.ScrollView({ style_class: "about-scrollBox" });
            contentBox.add_actor(scrollBox);
            let infoBox = new St.BoxLayout({ vertical: true, style_class: "about-scrollBox-innerBox" });
            scrollBox.add_actor(infoBox);
            
            //comments
            if ( metadata.comments ) {
                let comments = new St.Label({ text: "Comments:\n\t" + metadata.comments });
                let cText = comments.clutter_text;
                cText.ellipsize = Pango.EllipsizeMode.NONE;
                cText.line_wrap = true;
                cText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
                infoBox.add_actor(comments);
            }
            
            //website
            if ( metadata.website ) {
                let wsBox = new St.BoxLayout({ vertical: true });
                infoBox.add_actor(wsBox);
                
                let wLabel = new St.Label({ text: "Website:" });
                wsBox.add_actor(wLabel);
                
                let wsButton = new St.Button({ x_align: St.Align.START, style_class: "cinnamon-link", name: "about-website" });
                wsBox.add_actor(wsButton);
                let website = new St.Label({ text: metadata.website });
                let wtext = website.clutter_text;
                wtext.ellipsize = Pango.EllipsizeMode.NONE;
                wtext.line_wrap = true;
                wtext.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
                wsButton.add_actor(website);
                wsButton.connect("clicked", Lang.bind(this, this.launchSite, metadata.website));
            }
            
            //contributors
            if ( metadata.contributors ) {
                let list = metadata.contributors.split(",").join("\n\t");
                let contributors = new St.Label({ text: "Contributors:\n\t" + list });
                infoBox.add_actor(contributors);
            }
            
            //dialog close button
            this.setButtons([
                { label: "Close", key: "", focus: true, action: Lang.bind(this, this._onOk) }
            ]);
            
            this.open(global.get_current_time());
        } catch(e) {
            global.log(e);
        }
    },
    
    _onOk: function() {
        this.close(global.get_current_time());
    },
    
    launchSite: function(a, b, site) {
        Util.spawnCommandLine("xdg-open " + site);
        this.close(global.get_current_time());
    }
}


function MenuItem(menu, info, params) {
    this._init(menu, info, params);
}

MenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(menu, info, params) {
        try {
            
            this.menu = menu;
            this.id = info.id;
            
            PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
            
            this.addActor(this.getIcon());
            
            let label = new St.Label({ text: info.title });
            this.addActor(label);
            this.actor._delegate = this;
            
        } catch (e){
            global.logError(e);
        }
    },
    
    getIcon: function() {
        let iconType, iconPath;
        if ( use_symbolic_icons ) {
            iconPath = button_path + this.id + "-symbolic.svg";
            iconType = St.IconType.SYMBOLIC;
        }
        else {
            iconPath = button_path + this.id + ".svg";
            iconType = St.IconType.FULLCOLOR;
        }
        
        let file = Gio.file_new_for_path(iconPath);
        let gicon = new Gio.FileIcon({ file: file });
        let icon = new St.Icon({ gicon: gicon, icon_size: menu_item_icon_size, icon_type: iconType });
        
        return icon;
    },
    
    activate: function() {
        try {
            this.menu.close();
            CommandDispatcher[this.id]();
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
            
            this._applet_context_menu.addMenuItem(new Applet.MenuItem(_("About..."), "dialog-question", Lang.bind(this, this.openAbout)));
            
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
    
    openAbout: function() {
        new AboutDialog(this.metadata);
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
            let lock = new MenuItem(this.menu, { id: "lock", title: "Lock Screen" });
            this.menu.addMenuItem(lock);
            
            //switch user
            let uSwitch = new MenuItem(this.menu, { id: "uSwitch", title: "Switch User" });
            this.menu.addMenuItem(uSwitch);
            
            //guest
            if ( session_manager == 0 ) {
                let guest = new MenuItem(this.menu, { id: "guest", title: "Guest Session" });
                this.menu.addMenuItem(guest);
            }
            
            //log off
            let logOff = new MenuItem(this.menu, { id: "logOff", title: "Log Off" });
            this.menu.addMenuItem(logOff);
            
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            //suspend
            let suspend = new MenuItem(this.menu, { id: "suspend", title: "Suspend" });
            this.menu.addMenuItem(suspend);
            
            //sleep
            if ( has_systemd ) {
                let sleep = new MenuItem(this.menu, { id: "sleep", title: "Sleep" });
                this.menu.addMenuItem(sleep);
            }
            
            //hibernate
            let hibernate = new MenuItem(this.menu, { id: "hibernate", title: "Hibernate" });
            this.menu.addMenuItem(hibernate);
            
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            //restart
            let restart = new MenuItem(this.menu, { id: "restart", title: "Restart" });
            this.menu.addMenuItem(restart);
            
            //shut down
            let shutDown = new MenuItem(this.menu, { id: "shutDown", title: "Shut Down" });
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