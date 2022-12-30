const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Extension = imports.ui.extension;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const FileDialog = imports.misc.fileDialog;
const Lang = imports.lang;
const Gettext = imports.gettext;

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

const QCoreApplicationInterface = '\
<node> \
    <interface name="org.qtproject.Qt.QCoreApplication"> \
        <property name="applicationVersion" type="s" access="readwrite" />\
    </interface> \
</node>';
const QCoreApplicationProxy = Gio.DBusProxy.makeProxyWrapper(QCoreApplicationInterface);

const KDEConnectDaemonInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.daemon"> \
        <signal name="deviceAdded"> \
            <arg name="id" type="s" direction="out" /> \
        </signal> \
        <signal name="deviceRemoved"> \
            <arg name="id" type="s" direction="out" /> \
        </signal> \
        <signal name="deviceVisibilityChanged"> \
            <arg name="id" type="s" direction="out" /> \
            <arg name="isVisible" type="b" direction="out" /> \
        </signal> \
        <signal name="deviceListChanged"> \
        </signal> \
        <signal name="announcedNameChanged"> \
            <arg name="announcedName" type="s" direction="out" /> \
        </signal> \
        <method name="forceOnNetworkChange"> \
        </method> \
        <method name="announcedName"> \
            <arg type="s" direction="out" /> \
        </method> \
        <method name="devices"> \
            <arg type="as" direction="out" /> \
            <arg name="onlyReachable" type="b" direction="in" /> \
            <arg name="onlyPaired" type="b" direction="in" /> \
        </method> \
        <method name="devices"> \
            <arg type="as" direction="out" /> \
            <arg name="onlyReachable" type="b" direction="in" /> \
        </method> \
        <method name="devices"> \
            <arg type="as" direction="out" /> \
        </method> \
        <method name="deviceNames"> \
            <arg type="a{ss}" direction="out" /> \
            <arg name="onlyReachable" type="b" direction="in" /> \
            <arg name="onlyPaired" type="b" direction="in" /> \
        </method> \
        <method name="deviceNames"> \
            <arg type="a{ss}" direction="out" /> \
            <arg name="onlyReachable" type="b" direction="in" /> \
        </method> \
        <method name="deviceNames"> \
            <arg type="a{ss}" direction="out" /> \
        </method> \
        <method name="deviceIdByName"> \
            <arg type="s" direction="out" /> \
            <arg name="name" type="s" direction="in" /> \
        </method> \
        <method name="openConfiguration"> \
            <arg name="deviceId" type="s" direction="in" /> \
            <arg name="pluginId" type="s" direction="in" /> \
        </method> \
        <method name="openConfiguration"> \
            <arg name="deviceId" type="s" direction="in" /> \
        </method> \
        <method name="openConfiguration"> \
        </method> \
        <method name="selfId"> \
            <arg type="s" direction="out" /> \
        </method> \
    </interface> \
</node>';
const KDEConnectDaemonProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDaemonInterface);

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

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        // Map of device ID's to Device Object 
        this.devices = {}

        // Comaptability Mode
        // - versionLevel: Level corresponding to KDE Connect version differences, 0 is lowest supported version(1.3)
        // - zenitySupported: Flag if zenity is installed
        this.compatMode = {versionLevel: 0, zenitySupported: false};

        // Check if zenity is installed
        this.compatMode.zenitySupported = this.checkZenity();

        if (this.compatMode.zenitySupported == false) {
            this.warn(_("Zenity is not available, some features might not be (fully) available!"))
        }

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
        // This should only be called when entering for the first time or when we were previously in the unavailable state
        // Set Flag
        this.kdeconnectAvailable = true;
        
        // Get KDE Connect version
        try {
            let qtCoreProxy = new QCoreApplicationProxy(Gio.DBus.session, KDEConnectDBusName, "/MainApplication");
            let versionArray = qtCoreProxy.applicationVersion.split(".");
            this.compatMode.versionLevel = this.getVersionLevel(versionArray);
        } catch (error) {
            this.error("Error while getting KDE Connect version: " + error);
            this.warn("Resorting to default version compat level(1.3)");
        }

        try {
            this.kdecProxy = new KDEConnectDaemonProxy(Gio.DBus.session, KDEConnectDBusName, "/modules/kdeconnect");

            // TODO: Impelent first update logic
            // TODO: Think about if the signals should be connected after or before the first content update

            // Connect Signals
            this._onAnnouncedNameChanged = this.kdecProxy.connectSignal("announcedNameChanged", this.onAnnouncedNameChanged.bind(this));
            this._onDeviceListChanged = this.kdecProxy.connectSignal("deviceListChanged", this.onDeviceListChanged.bind(this));


        } catch (error) {
            this.error("Error while communicating with the KDE Connect DBus service: " + error);
        }
        
        
        this.info("Entered Available State!");

    }

    getVersionLevel(versionArray) {
        //TODO: Implement
        return 0;
    }

    updateContent() {

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

    onAnnouncedNameChanged(proxy, sender, [name]) {
        this.info("AnnouncedNameChanged: "+name);
        //TODO: Implement
    }

    onDeviceListChanged(proxy, sender) {
        this.info("DeviceListChanged");
        //TODO: Implement
    }

    on_applet_removed_from_panel() {
        // Bravo Six, Going Dark

        // TODO: Disconnect more callbacks and stuff

        if (typeof this.kdecProxy !== "undefined") {
            if (this._onAnnouncedNameChanged) {
                this.kdecProxy.disconnectSignal(this._onAnnouncedNameChanged)
            }
            if (this._onDeviceListChanged) {
                this.kdecProxy.disconnectSignal(this._onDeviceListChanged)
            }
        }

        // Disconnect signal callback for NameAcquired
        if (typeof this._onNameOwnerChanged !== "undefined" && typeof this.dbusProxy !== "undefined") {
            this.dbusProxy.disconnectSignal(this._onNameOwnerChanged);
        }
    }

    checkZenity() {
        try {
            let [success, stdout] = GLib.spawn_command_line_sync("zenity --version");

            if (success && stdout) {
                return true;
            }
            else {
                return false;
            }
        }
        catch (error) {
            this.error(error);
            return false;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new KDEConnectApplet(metadata, orientation, panel_height, instance_id);
}