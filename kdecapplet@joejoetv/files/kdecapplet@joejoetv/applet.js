const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const FileDialog = imports.misc.fileDialog;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Extension = imports.ui.extension;

const UUID = "kdecapplet@joejoetv";

const KDEConnectDBusName = "org.kde.kdeconnect";
//const KDEConnectDBusName = "org.mpris.MediaPlayer2.youtube-music";

// Applet imports
const Modules = require("./modules.js");
const AppletUtils = require("./utils.js");

// DBus Interfaces/Proxies

const FreedesktopDBusInterface = '\
<node> \
    <interface name="org.freedesktop.DBus"> \
        <method name="NameHasOwner"> \
            <arg direction="in" type="s"/> \
            <arg direction="out" type="b"/> \
        </method> \
        <signal name="NameAcquired"> \
            <arg name="name" direction="out" type="s"/> \
        </signal> \
        <signal name="NameOwnerChanged"> \
            <arg type="s"/> \
            <arg type="s"/> \
            <arg type="s"/> \
        </signal> \
    </interface> \
</node>';
const FreedesktopDBusProxy = Gio.DBusProxy.makeProxyWrapper(FreedesktopDBusInterface);

// l10n support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

/*
function _(str) {
    return Gettext.dgettext(UUID, str);
}
*/

// DEBUG
// TODO: Remove
function _(str) {
    return str;
}

class Device {
    constructor(applet, id, name, type) {
        this.applet = applet;
        this.id = id;
        this.name = name;
        this.type = type;

        // Map of module ID's to module objects, so an object can only be added once
        this.modules = {};
    }

    getApplet() {
        return this.applet;
    }

    addModule(module) {
        if (this.modules[module.moduleID] == undefined) {
            this.modules[module.moduleID] = module;
            return true;
        } else {
            return false;
        }
    }

    clearModules() {
        var props = Object.getOwnPropertyNames(this.modules);
        for (let i = 0; i < props.length; i++) {
            const moduleID = props[i];
            this.removeModule(moduleID);         
        }
    }

    getModules() {
        return this.modules;
    }

    getModule(moduleID) {
        return this.modules[moduleID];
    }

    removeModule(moduleID) {
        this.modules[moduleID].remove();
        delete this.modules[moduleID];   
    }

    remove() {
        this.clearModules();
    }
}

class KDEConnectApplet extends Applet.TextIconApplet {

    info(msg) {
        global.log("["+this.metadata.uuid+"] "+msg);
    }

    error(msg) {
        global.logError("["+this.metadata.uuid+"] "+msg);
    }

    warn(msg) {
        global.logWarning("["+this.metadata.uuid+"] "+msg);
    }

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;

        // Map of device ID's to Device Object 
        this.devices = {}

        // Comaptability Mode
        // - versionLevel: Level corresponding to KDE Connect version differences, 0 is lowest supported version(1.3)
        // - zenitySupported: Flag if zenity is installed
        this.compatMode = {versionLevel: 0, zenitySupported: false};

        // Create menu manager and popup menu
        this.popupMenu = new Applet.AppletPopupMenu(this, orientation);
        this._menuManager.addMenu(this.popupMenu);

        // Flag, if we're currently connected to the KDE Connect dbus service
        this.kdeconnectAvailable = false;

        // Set basic options
	    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_icon_name("kdeconnect");

        // Check if KDE Connect is running        
        try {
            this.dbusProxy = new FreedesktopDBusProxy(Gio.DBus.session, "org.freedesktop.DBus", "/org/freedesktop/DBus");
            this.kdeconnectAvailable = this.dbusProxy.NameHasOwnerSync(KDEConnectDBusName)[0];
        }
        catch (error) {
            this.error("Error while checking if KDE Connect DBus service exists on the session bus: " + error);
        }

        if (this.kdeconnectAvailable == true) {
            this.info("Connected to the KDE Connect DBus service!");

            // KDE Connect DBus service available

            // Enter Connected state and initialize main functionality
            this.enterAvailableState();
        } else {
            this.warn("KDE Connect DBus service not found on session bus!");

            // KDE Connect DBus service not available

            // Enter Not Connected state
            this.enterUnavailableState();

            // Connect signal to get called, when a dbus name changes owner (detect if KDE Connect service registers)
            try {
                this._onNameOwnerChanged = this.dbusProxy.connectSignal("NameOwnerChanged", Lang.bind(this, this.onNameOwnerChanged));
            } catch (error) {
                this.error("Error while registering callback for NameOwnerChanged signal: " + error);
            }
        }
    }

    on_applet_clicked() {
        this.popupMenu.toggle();
    }

    removeAllDevices() {

    }

    enterUnavailableState() {
        // Set Flag
        this.kdeconnectAvailable = false;

        // Close popup menu and remove all content
        this.popupMenu.close();
        this.removeAllDevices();
        this.popupMenu.removeAll();

        // Close and clear context menu
        this._applet_context_menu.close();
        this._applet_context_menu.removeAll();

        // Add content for KDE Connect not available state
        let kdecNotFoundMenuItem = new PopupMenu.PopupMenuItem(_("KDE Connect not available!"), {reactive: false});
        kdecNotFoundMenuItem.actor.add_style_pseudo_class('insensitive');
        this.popupMenu.addMenuItem(kdecNotFoundMenuItem);
        this.set_applet_tooltip(_("KDE Connect not available, make sure it's installed and running."), false);
        this.set_applet_label("");

        this.info("Enterted Unavailable State!");
    }

    enterAvailableState() {
        // We only want to enter if we're not already in the state
        if (this.kdeconnectAvailable == false) {
            // Set Flag
            this.kdeconnectAvailable = true;
                
            
            this.info("Entered Available State!");
        }

    }

    updateMenu() {

    }
    
    onNameOwnerChanged(proxy, sender, [name, old_owner, new_owner]) {
        if (name == KDEConnectDBusName) {
            this.info("NameOwnerAcquired: "+name+" | "+old_owner+" -> "+new_owner);
            if (new_owner != "") {
                // Found KDE Connect DBus service
    
                this.info("KDE Connect DBus service found!");
    
                // Enter Available State
                this.enterAvailableState();
            } else if (old_owner != "" && new_owner == "") {
                // KDE Connect DBus service unregistered from DBus
                this.warn("KDE Connect DBus service unregistered from session bus!");

                // Enter Unavailable State
                this.enterUnavailableState();
            }
        }
    }

    on_applet_removed_from_panel() {
        // Bravo Six, Going Dark

        // TODO: Disconnect other signals

        // Disconnect signal callback for NameAcquired
        if (typeof this._onNameOwnerChanged !== "undefined" && typeof this.dbusProxy !== "undefined") {
            this.dbusProxy.disconnectSignal(this._onNameOwnerChanged);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new KDEConnectApplet(metadata, orientation, panel_height, instance_id);
}