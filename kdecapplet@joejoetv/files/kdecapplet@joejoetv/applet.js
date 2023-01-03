const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Extension = imports.ui.extension;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const Tooltips = imports.ui.tooltips;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const FileDialog = imports.misc.fileDialog;
const Lang = imports.lang;
const Gettext = imports.gettext;
const Signals = imports.signals;

const Gtk = imports.gi.Gtk;


const UUID = "kdecapplet@joejoetv";

const KDEConnectDBusName = "org.kde.kdeconnect";
//const KDEConnectDBusName = "org.mpris.MediaPlayer2.youtube-music";
const SUPPORTED_MODULES = [
    "battery",
    "deviceinfo",
    "connectivity",
    "mpris",
    "findmyphone",
    "requestphoto",
    "ping",
    "share",
    "sftp",
    "sms",
    "telephony"
]

const ADDITIONAL_MODULE_SETTING = {
    "battery": [],
    "deviceinfo": [],
    "connectivity": [],
    "mpris": [],
    "findmyphone": [],
    "requestphoto": [],
    "ping": [],
    "share": [],
    "sftp": [],
    "sms": [],
    "telephony": []
}

// Applet imports
const Modules = require("./js/modules.js");
const AppletUtils = require("./js/utils.js");
const Dialogs = require("./js/dialogs.js");

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
        <method name="deviceNames"> \
            <arg type="a{ss}" direction="out" /> \
            <arg name="onlyReachable" type="b" direction="in" /> \
            <arg name="onlyPaired" type="b" direction="in" /> \
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

const KDEConnectDeviceInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device"> \
        <property name="type" type="s" access="read" /> \
        <property name="name" type="s" access="read" /> \
        <property name="iconName" type="s" access="read" /> \
        <property name="statusIconName" type="s" access="read" /> \
        <property name="isReachable" type="b" access="read" /> \
        <property name="supportedPlugins" type="as" access="read" /> \
        <signal name="pluginsChanged"> \
        </signal> \
        <signal name="reachableChanged"> \
            <arg name="reachable" type="b" direction="out" /> \
        </signal> \
        <signal name="nameChanged"> \
            <arg name="name" type="s" direction="out" /> \
        </signal> \
        <signal name="typeChanged"> \
            <arg name="type" type="s" direction="out" /> \
        </signal> \
        <signal name="statusIconNameChanged"> \
        </signal> \
        <method name="reloadPlugins"> \
        </method> \
        <method name="pluginIconName"> \
            <arg type="s" direction="out" /> \
            <arg name="pluginName" type="s" direction="in" /> \
        </method> \
        <method name="availableLinks"> \
            <arg type="as" direction="out" /> \
        </method> \
        <method name="loadedPlugins"> \
            <arg type="as" direction="out" /> \
        </method> \
        <method name="hasPlugin"> \
            <arg type="b" direction="out" /> \
            <arg name="name" type="s" direction="in" /> \
        </method> \
        <method name="isPluginEnabled"> \
            <arg type="b" direction="out" /> \
            <arg name="pluginName" type="s" direction="in" /> \
        </method> \
    </interface> \
</node>';
const KDEConnectDeviceProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDeviceInterface);

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

function copyAndNotify(notificationSource, text, typestring) {
    try {
        let clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    
        let notification = new MessageTray.Notification(notificationSource, "KDE Connect Applet", _("Copied {typestring} to the clipboard").replace("{typestring}", typestring));
        notification.setTransient(true);
        notificationSource.notify(notification);
    } catch (error) {
        global.logError("[Notification] Error while sending notification: " + error);
    }
}

class AppletNotificationSource extends MessageTray.Source {
    constructor(appletName) {
        super(appletName);

        this._setSummaryIcon(this.createNotificationIcon());
    }

    createNotificationIcon() {
        return new St.Icon({
            icon_name: "kdeconnect",
            icon_type: St.IconType.APPLICATION,
            icon_size: this.ICON_SIZE
        });
    }

    open() {
        this.destroy();
    }
}

class Device {
    constructor(applet, id, name) {
        this.applet = applet;
        this.id = id;
        this.name = name;

        // Default values
        this.type = "none"
        this.plugins = [];
        this.isReachable = false;

        // Create Device Proxy
        try {
            this.deviceProxy = new KDEConnectDeviceProxy(Gio.DBus.session, KDEConnectDBusName, "/modules/kdeconnect/devices/"+this.id);

            // Get device parameters
            this.type = this.deviceProxy.type;
            this.isReachable = this.deviceProxy.isReachable;
            this.plugins = this.deviceProxy.loadedPluginsSync()[0];
        } catch (error) {
            this.error("Error while getting device parameters. Falling back to default parameters!");
        }

        // Connect Signals
        if (this.deviceProxy) {
            this.info("Device Proxy exists!");
            try {
                this._onPluginsChanged = this.deviceProxy.connectSignal("pluginsChanged", this.onPluginsChanged.bind(this));
                this._onReachableChanged = this.deviceProxy.connectSignal("reachableChanged", this.onReachableChanged.bind(this));
                this._onTypeChanged = this.deviceProxy.connectSignal("typeChanged", this.onTypeChanged.bind(this));
                this._onNameChanged = this.deviceProxy.connectSignal("nameChanged", this.onNameChanged.bind(this));
            } catch (error) {
                this.error("Error while connecting callbacks for changing of device parameters!");
            }
        }

        // Map of module ID's to module objects, so an object can only be added once
        this.modules = {};

        this.info("Created new Device!");
    }

    info(msg) {
        this.applet.info("(" + this.id + ") " + msg);
    }

    warn(msg) {
        this.applet.warn("(" + this.id + ") " + msg);
    }

    error(msg) {
        this.applet.error("(" + this.id + ") " + msg);
    }

    getApplet() {
        return this.applet;
    }
    
    getID() {
        return this.id;
    }

    onPluginsChanged(proxy, sender) {
        //DEBUG
        this.info("Plugins Changed!");

        if (this.deviceProxy) {
            try {
                this.plugins = this.deviceProxy.loadedPluginsSync()[0];

                // TODO: Replace with signals (MAYBE)
                this.applet.onDeviceDataChanged();
            } catch (error) {
                this.error("Error while updating list of loaded plugins!");
            }
        }
    }

    onReachableChanged(proxy, sender, [isReachable]) {
        //DEBUG
        this.info("isReachable Changed: " + isReachable);

        this.isReachable = isReachable;

        this.applet.onDeviceDataChanged();
    }

    onTypeChanged(proxy, sender, [type]) {
        //DEBUG
        this.info("Type Changed: " + type);

        this.type = type;

        this.applet.onDeviceDataChanged();
    }

    onNameChanged(proxy, sender, [name]) {
        //DEBUG
        this.info("Name Changed: " + name);

        this.name = name;

        this.applet.onDeviceDataChanged();
    }

    addModule(module) {
        if (this.modules[module.moduleID] == undefined) {
            this.modules[module.moduleID] = module;
            return true;
        } else {
            return false;
        }
    }

    removeAllModules() {
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

        // Disconnect Signals
        if (typeof this.deviceProxy !== "undefined") {
            if (this._onPluginsChanged) {
                this.deviceProxy.disconnectSignal(this._onPluginsChanged)
            }
            if (this._onReachableChanged) {
                this.deviceProxy.disconnectSignal(this._onReachableChanged)
            }
            if (this._onTypeChanged) {
                this.deviceProxy.disconnectSignal(this._onTypeChanged)
            }
            if (this._onNameChanged) {
                this.deviceProxy.disconnectSignal(this._onNameChanged)
            }
        }
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

        this.notificationSource = new AppletNotificationSource(this.metadata.name);
        Main.messageTray.add(this.notificationSource);

        // Object housing the bindings to the applet settings
        this.options = {};

        // Object housing module settings
        this.options.modules = {};

        // String representing the KDE Connect version
        this.KDEConnectVersionString = "";

        // String representing the ID of this device
        this.ownIDString = "";

        // Create Settings Provider
        this.settings = new Settings.AppletSettings(this.options, metadata.uuid, instance_id);

        // Bind settings
        this.settings.bind("showownid", "showOwnID", this.onContextMenuSettingsChanged.bind(this), "showOwnID");
        this.settings.bind("showkdecver", "showKDEConnectVersion", this.onContextMenuSettingsChanged.bind(this), "showKDEConnectVersion");
        this.settings.bind("shownumdevices", "showDeviceCount", this.onPanelSettingsChanged.bind(this), "showDeviceCount");
        this.settings.bind("icontype", "iconType", this.onPanelSettingsChanged.bind(this), "iconType");
        this.settings.bind("usecustomicon", "useCustomIcon", this.onPanelSettingsChanged.bind(this), "useCustomIcon");
        this.settings.bind("customicon", "customIcon", this.onPanelSettingsChanged.bind(this), "customIcon");

        // Register Module Settings Callbacks
        this.registerModuleSettings(SUPPORTED_MODULES, ADDITIONAL_MODULE_SETTING);

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
        // Is ONLY to be modified by enterAvailableState and enterUnavailableState
        // We set it to undefined, so the state is undefined at first
        this.kdeconnectAvailable = undefined;
        
        // Set basic options
	    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_icon_name("kdeconnect");

        let foundKDEConnect = false;

        // Check if KDE Connect is running        
        try {
            this.dbusProxy = new FreedesktopDBusProxy(Gio.DBus.session, "org.freedesktop.DBus", "/org/freedesktop/DBus");
            foundKDEConnect = this.dbusProxy.NameHasOwnerSync(KDEConnectDBusName)[0];
        }
        catch (error) {
            this.error("Error while checking if KDE Connect DBus service exists on the session bus: " + error);
        }

        if (foundKDEConnect == true) {
            this.info("Found KDE Connect DBus service!");

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
        // TODO: Remove if populated
        //this.popupMenu.toggle();
    }

    removeAllDevices() {
        for (let [deviceID, device] of Object.entries(this.devices)) {
            device.remove();
            delete this.devices[deviceID];
        }
    }

    registerModuleSettings(modules, additionalSettings) {
        modules.forEach(moduleID => {
            this.options.modules[moduleID] = {};
            this.settings.bindWithObject(this.options.modules[moduleID], moduleID+"-module-enabled", "enabled", this.onModuleSettingsChanged.bind(this), moduleID);

            // Register any additional settings to also call onModuleSettingsChanged,
            // since we need to rebuild the context manu anyway and the user shouldn't have the popup menu open when changing settings
            if (additionalSettings[moduleID]) {
                additionalSettings[moduleID].forEach(setting => {
                    this.settings.bindWithObject(this.options.modules[moduleID], moduleID+"-module-"+setting, setting, this.onModuleSettingsChanged.bind(this), moduleID);
                });
            }
        });
    }

    onModuleSettingsChanged(moduleID) {
        // TODO: Implement
    }

    // Gets called by a device, if it's data changed
    onDeviceDataChanged() {
        this.info("Device Data Changed!")
        // TODO: Implement
    }

    enterUnavailableState() {
        // This shouldn't be called, if we're already in the unavailable state,
        // but check anyways and do nothing if we're already in the unavailable state
        if (this.kdeconnectAvailable != false) {
            // We're entering the unavailable state, so set flag to false
            this.kdeconnectAvailable = false;

            // Disconnect global signals if present
            if (typeof this.kdecProxy !== "undefined") {
                if (this._onAnnouncedNameChanged) {
                    this.kdecProxy.disconnectSignal(this._onAnnouncedNameChanged)
                }
                if (this._onDeviceListChanged) {
                    this.kdecProxy.disconnectSignal(this._onDeviceListChanged)
                }
            }
    
            /// Empty menus
    
            this.popupMenu.close();
            // Since KDE Connect is now unavailable, remove all devices from list and with them, disconnect signals, etc.
            this.removeAllDevices();
            this.popupMenu.removeAll();
    
            // Close and clear context menu
            this._applet_context_menu.close();
            this._applet_context_menu.removeAll();
    
            // Add menu item to tell the user, that KDE Connect is currently unavailable to the applet
            let kdecNotFoundMenuItem = new PopupMenu.PopupMenuItem(_("KDE Connect not available!"), {reactive: false});
            kdecNotFoundMenuItem.actor.add_style_pseudo_class('insensitive');
            this.popupMenu.addMenuItem(kdecNotFoundMenuItem);
            this.set_applet_tooltip(_("KDE Connect not available, make sure it's installed and running."), false);
            this.set_applet_label("");
    
            this.info("Enterted Unavailable State!");
        } else {
            this.warn("enterUnavailableState called from unavailable state!");
        }
    }

    enterAvailableState() {
        // This shouldn't be called, if we're already in the available state,
        // but check anyways and do nothing if we're already in the available state
        if (this.kdeconnectAvailable != true) {
            // We're entering the available state, so set the flag to true
            this.kdeconnectAvailable = true;
            
            // Get KDE Connect version
            try {
                let qtCoreProxy = new QCoreApplicationProxy(Gio.DBus.session, KDEConnectDBusName, "/MainApplication");
                let kdecVersion = qtCoreProxy.applicationVersion;
                this.KDEConnectVersionString = kdecVersion;
                this.compatMode.versionLevel = this.getVersionLevel(kdecVersion.split("."));
            } catch (error) {
                this.error("Error while getting KDE Connect version: " + error);
                this.warn("Resorting to default version compat level(1.3)");
            }
    
            try {
                this.kdecProxy = new KDEConnectDaemonProxy(Gio.DBus.session, KDEConnectDBusName, "/modules/kdeconnect");

                this.ownIDString = this.kdecProxy.selfIdSync()[0];

                // Build Context Menu
                this.rebuildContextMenu();

                // This is maybe not needed, but I'm doing it anyway
                // Remove all devices and disconnect signals, etc.
                this.removeAllDevices();

                // Get Devices
                this.devices = this.getDeviceList();

                // Update Panel features
                this.updatePanel();

                // Build main popout menu
                this.rebuildPopupMenu();
    
                // TODO: Impelent first update logic
                // TODO: Think about if the signals should be connected after or before the first content update
    
                // Connect Signals
                this._onAnnouncedNameChanged = this.kdecProxy.connectSignal("announcedNameChanged", this.onAnnouncedNameChanged.bind(this));
                this._onDeviceListChanged = this.kdecProxy.connectSignal("deviceListChanged", this.onDeviceListChanged.bind(this));
    
    
            } catch (error) {
                this.error("Error while communicating with the KDE Connect DBus service: " + error);
            }
            
            
            this.info("Entered Available State!");
        } else {
            this.warn("enterAvailableState called from available state!");
        }
    }

    getDeviceList() {
        let deviceMap = {};

        // Get array of device IDs and map of device IDs to names
        let deviceIDs = [];
        let deviceNames = {};

        try {
            deviceIDs = this.kdecProxy.devicesSync(false, true)[0];
            deviceNames = this.kdecProxy.deviceNamesSync(false, true)[0];
        } catch (error) {
            this.error("Error while getting list of devices: " + error);
        }

        deviceIDs.forEach(deviceID => {
            this.info("New Device " + deviceNames[deviceID] + " with ID " + deviceID);
            deviceMap[deviceID] = new Device(this, deviceID, deviceNames[deviceID]);
        });

        return deviceMap;
    }

    getVersionLevel(versionArray) {
        if (versionArray.length >= 2) {
            if (versionArray[0] == 1) {
                if (versionArray[1] == 3) {
                    // Version 1.3
                    return 0;
                } else if (versionArray > 3) {
                    // Version >= 1.4
                    return 1;
                }
            } else if (versionArray[0] > 1) {
                // Version > 21.x.x
                return 2;
            }
        }
        // Default Compatability Level
        return 0;
    }

    getModuleSettings(moduleID) {
        if (this.options.modules[moduleID]) {
            return this.options.modules[moduleID];
        } else {
            this.error("No option entry found for module with ID '{moduleID}'!".replace("{moduleID}", moduleID));
            return undefined;
        }
    }

    rebuildPopupMenu() {

    }

    rebuildContextMenu() {
        // Menu Item showing the KDE Connect version
        if (this.options.showKDEConnectVersion == true) {
            let kdecVersionMenuItem = new PopupMenu.PopupMenuItem(_("KDE Connect Version: ${version}").replace("${version}", this.KDEConnectVersionString));
            kdecVersionMenuItem.actor.add_style_pseudo_class("insensitive");
            this._applet_context_menu.addMenuItem(kdecVersionMenuItem);
        }

        // Menu Item showing the ID of this device
        if (this.options.showOwnID == true) {
            let ownIDMenuItem = new PopupMenu.PopupMenuItem(_("Own ID: ${own_id}").replace("${own_id}", this.ownIDString));
            ownIDMenuItem._signals.connect(ownIDMenuItem, "activate", function(menuItem, keepMenu) {
                copyAndNotify(this.notificationSource, this.ownIDString, _("Own ID"));
            }, this);
            let ownIDMenuItemTooltip = new Tooltips.Tooltip(ownIDMenuItem.actor, _("Click to copy ID"));
            this._applet_context_menu.addMenuItem(ownIDMenuItem);
        }

        // Menu Item for opening the KDE Connect configuration
        let configureMenuItem = new PopupMenu.PopupIconMenuItem(_("Configure KDE Connect"), "preferences-other", St.IconType.SYMBOLIC, {});
        configureMenuItem._signals.connect(configureMenuItem, "activate", this.openKDECConfiguration.bind(this));
        let configureMenuItemTooltip = new Tooltips.Tooltip(configureMenuItem.actor, _("Click to open KDE Connect Configuration"));
        this._applet_context_menu.addMenuItem(configureMenuItem);
        
        
        this.info("Rebuild Context Menu called")
    }

    openKDECConfiguration() {
        try {
            if (this.kdecProxy) {
                this.kdecProxy.openConfigurationRemote(Lang.bind(this, function() {
                    this.info("Opened KDE Connect Configuration")
                }));
            }
        } catch (error) {
            this.error("Error while opening KDE Connect configuration: " + error);
        }
    }


    updatePanel() {
    }

    onContextMenuSettingsChanged(value, option) {
        this.rebuildContextMenu();
    }

    onPopupMenuSettingsChanged(value, option) {
        this.rebuildPopupMenu();
    }

    onModuleSettingsChanged(value, option) {
        //TODO: Implement
    }

    onPanelSettingsChanged(value, option) {
        if (option == "customIcon" && this.options.useCustomIcon != true) {
            return;
        }
        this.updatePanel();
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

        this.removeAllDevices();

        this.settings.finalize();

        // TODO: Disconnect more callbacks and stuff

        if (typeof this.kdecProxy !== "undefined") {
            if (this._onAnnouncedNameChanged) {
                this.kdecProxy.disconnectSignal(this._onAnnouncedNameChanged)
            }
            if (this._onDeviceListChanged) {
                this.kdecProxy.disconnectSignal(this._onDeviceListChanged)
            }
        }

        // Disconnect signal callback for NameOwnerChanged
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
