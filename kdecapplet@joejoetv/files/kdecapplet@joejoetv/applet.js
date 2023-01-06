const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const Tooltips = imports.ui.tooltips;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;
const Lang = imports.lang;
const Gettext = imports.gettext;
const Signals = imports.signals;

// Applet imports
const Modules = require("./js/modules.js");
const CommonUtils = require("./js/commonUtils.js");
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
Gettext.bindtextdomain(CommonUtils.UUID, GLib.get_home_dir() + "/.local/share/locale");

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

/**
 * #Device:
 * @short_description Device class representing a KDE Connect device
 */
class Device {
    constructor(applet, id, name, compatMode) {
        this.applet = applet;
        this.id = id;
        this.name = name;
        this.compatMode = compatMode;

        /**
         * Signal Manager for easy management of signals,
         * that are all disconnected, when the Device object is destroyed
         */
        this._signals = new SignalManager.SignalManager(null);

        // Default values
        this.type = "none"
        this.plugins = [];
        this.isReachable = false;

        // Create Device Proxy and get first values from DBus
        try {
            this.deviceProxy = new KDEConnectDeviceProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.id);

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

    /**
     * Logging functions
     */

    /**
     * @description Uses the parent applet to print an info message to the log
     * @param {string} msg 
     */
    info(msg) {
        this.applet.info("(" + this.id + ") " + msg);
    }

    /**
     * @description Uses the parent applet to print a warning message to the log
     * @param {string} msg 
     */
    warn(msg) {
        this.applet.warn("(" + this.id + ") " + msg);
    }

    /**
     * @description Uses the parent applet to print an error message to the log
     * @param {string} msg 
     */
    error(msg) {
        this.applet.error("(" + this.id + ") " + msg);
    }

    /**
     * Getter functions
     */

    /**
     * @returns The parent applet of the device object
     */
    getApplet() {
        return this.applet;
    }
    
    /**
     * @returns The ID of the device
     */
    getID() {
        return this.id;
    }

    /**
     * @returns The type of the device
     */
    getType() {
        return this.type;
    }

    /**
     * @returns The list of KDE Connect plugins supported by the device
     */
    getPlugins() {
        return this.plugins;
    }

    /**
     * @returns If the device is currently reachable
     */
    getReachableStatus() {
        return this.isReachable;
    }

    /**
     * DBus Callbacks
     */

    /**
     * Callback for the DBus 'pluginsChanged' signal
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     */
    onPluginsChanged(proxy, sender) {
        //DEBUG
        this.info("Plugins Changed!");

        if (this.deviceProxy) {
            try {
                this.plugins = this.deviceProxy.loadedPluginsSync()[0];

                this.emit("plugins-changed");
            } catch (error) {
                this.error("Error while updating list of loaded plugins!");
            }
        }
    }

    /**
     * Callback for the DBus 'reachableChanged' signal
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     * @param {[boolean]} params - List of parameters passed to the signal
     * @param {boolean} isReachable - The changed device reachable status
     */
    onReachableChanged(proxy, sender, [isReachable]) {
        //DEBUG
        this.info("isReachable Changed: " + isReachable);

        this.isReachable = isReachable;

        this.emit("reachable-changed");
    }

    /**
     * Callback for the DBus 'typeChanged' signal
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     * @param {[string]} params - List of parameters passed to the signal
     * @param {string} type - The changed device type
     */
    onTypeChanged(proxy, sender, [type]) {
        //DEBUG
        this.info("Type Changed: " + type);

        this.type = type;

        this.emit("type-changed");
    }

    /**
     * Callback for the DBus 'nameChanged' signal
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     * @param {[string]} params - List of parameters passed to the signal
     * @param {string} namer - The changed device name
     */
    onNameChanged(proxy, sender, [name]) {
        //DEBUG
        this.info("Name Changed: " + name);

        this.name = name;

        this.emit("name-changed");
    }
    
    /**
     * Module operations
     */

    /**
     * Adds a module to the device
     * @param {Modules.KDECModule} module - The module to add
     * @returns Is the module was added
     */
    addModule(module) {
        if (!(this.modules[module.getID()])) {
            this.modules[module.getID()] = module;
            return true;
        } else {
            return false;
        }
    }

    /**
     * @description Creates modules based on @param supportedModules
     * @param {list} supportedModules List of modules to try adding
     */
    createModules(supportedModules) {
        let moduleOptions = this.applet.options.modules;

        this.info("Creating Modules:");

        supportedModules.forEach(moduleID => {
            if (moduleOptions[moduleID].enabled == true) {
                let moduleClass = Modules.moduleClasses[moduleID];

                if (moduleClass.REQUIRED_KDEC_PLUGINS.every(plugin => this.plugins.includes(plugin))) {
                    this.addModule(new moduleClass(this, this.compatMode));
                    this.info(" - Added Module '" + moduleID + "'");
                } else {
                    this.info(" - Not all plugins present for module " + moduleID);
                }
            }
        });
    }

    /**
     * Remove a module from the device
     * @param {string} moduleID - The ID of the module to remove
     */
    removeModule(moduleID) {
        this.modules[moduleID].destroy();
        delete this.modules[moduleID];   
    }

    /**
     * Remove all modules from the device
     */
    removeAllModules() {
        var props = Object.getOwnPropertyNames(this.modules);
        for (let i = 0; i < props.length; i++) {
            const moduleID = props[i];
            this.removeModule(moduleID);         
        }
    }

    /**
     * Get a module from the list of modules added to the device, if present
     * @param {string} moduleID - The ID of the module
     * @returns The module object or null
     */
    getModule(moduleID) {
        return this.modules[moduleID];
    }

    /**
     * Get the map of modules of the device
     * @returns The map of modules
     */
    getModules() {
        return this.modules;
    }

    /**
     * Returns a list of modules, that match the type
     * @param {Modules.ModuleType} type
     * @returns A list of devices, whose type matches the passed type
     */
    getModulesByType(type) {
        let moduleList = [];

        // Loop over supported modules array, so the modules are in correct order
        Modules.modules.forEach(moduleID => {
            if (this.modules[moduleID]) {
                let module = this.modules[moduleID];

                if (module.getType() == type) {
                    moduleList.push(module);
                }
            }
        });
        
        return moduleList;
    }

    /**
     * Disconnects all signals and removes all applets
     */
    destroy() {
        this._signals.disconnectAllSignals();
        this.removeAllModules();

        // Disconnect DBus Signals
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
Signals.addSignalMethods(Device.prototype);


class KDEConnectApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;

        // Add notification source for applet
        this.notificationSource = new CommonUtils.AppletNotificationSource(this.metadata.name);
        Main.messageTray.add(this.notificationSource);

        // Signal Manager to store signal connections and disconnect all of them, when the applet is unloaded
        this._signals = new SignalManager.SignalManager(null);

        /**
         * Define object variables and default values
         */

        // Map of device ID's to Device Object 
        this.devices = {}

        // Comaptability Mode
        // - versionLevel: Level corresponding to KDE Connect version differences, 0 is lowest supported version(1.3)
        // - zenitySupported: Flag if zenity is installed
        this.compatMode = {versionLevel: 0, zenitySupported: false};

        // Object housing the bindings to the applet settings
        this.options = {};

        // Object housing the bindings to the module settings
        this.options.modules = {};

        // String representing the KDE Connect version
        this.KDEConnectVersionString = "";

        // String representing the ID of this device
        this.ownIDString = "";

        // Flag, if we're currently connected to the KDE Connect dbus service
        // Is ONLY to be modified by enterAvailableState and enterUnavailableState
        // We set it to undefined, so the state is undefined at first
        this.kdeconnectAvailable = undefined;

        /**
         * Initialize and bind Applet settings
         */

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
        this.registerModuleSettings(Modules.modules, Modules.additionalSettings);

        /**
         * Initialize Applet content
         */

        // Create seperate menu manager, because using this._menuManager causes weird issues
        this.menuManager = new PopupMenu.PopupMenuManager(this);

        // Main popup menu, opened by clicking the applet
        this.popupMenu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.popupMenu);

        // Menu Section for items added to the context menu of the applet
        this.contextMenuSection = new PopupMenu.PopupMenuSection();
        this._applet_context_menu.addMenuItem(this.contextMenuSection);

        // Set basic options
	    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.info("Icon Type is "+this.options.iconType+", setting icon name to: "+CommonUtils.DefaultIcons[this.options.iconType]);
        
        // Set correct icon type and name
        if (this.options.useCustomIcon == false) {
            // Use default icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(CommonUtils.DefaultIcons[this.options.iconType]);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(CommonUtils.DefaultIcons[this.options.iconType]);
            } else {
                this.error("Somehow, the icon type is not recognized: '"+this.options.iconType+"'")
            }
        } else {
            // Use custom icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(this.options.customIcon);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(this.options.customIcon);
            } else {
                this.error("Somehow, the icon type is not recognized: '"+this.options.iconType+"'")
            }
        }
        
        this.hide_applet_label(true);


        // Check if KDE Connect is already running using DBus
        let foundKDEConnect = false;
        
        try {
            this.dbusProxy = new FreedesktopDBusProxy(Gio.DBus.session, "org.freedesktop.DBus", "/org/freedesktop/DBus");
            foundKDEConnect = this.dbusProxy.NameHasOwnerSync(CommonUtils.KDECONNECT_DBUS_NAME)[0];
        } catch (error) {
            this.error("Error while checking if KDE Connect DBus service exists on the session bus: " + error);
        }

        if (foundKDEConnect == true) {
            this.info("Found KDE Connect DBus service!");

            // KDE Connect DBus service is available

            // Enter Available state and initialize main functionality
            this.enterAvailableState();
        } else {
            this.warn("KDE Connect DBus service not found on session bus!");

            // KDE Connect DBus service is not available

            // Enter Unavailable state and add infor for user
            this.enterUnavailableState();

            // Connect signal to get called, when a DBus name changes owner (detect if KDE Connect service registers)
            try {
                this._onNameOwnerChanged = this.dbusProxy.connectSignal("NameOwnerChanged", Lang.bind(this, this.onNameOwnerChanged));
            } catch (error) {
                this.error("Error while registering callback for NameOwnerChanged signal: " + error);
            }
        }
    }

    /**
     * Logging functions
     */

    /**
     * 
     * @param {string} msg - Prints the message as an info message to the log
     */
    info(msg) {
        global.log("["+this.metadata.uuid+"] "+msg);
    }

    /**
     * 
     * @param {string} msg - Prints the message as an error message to the log
     */
    error(msg) {
        global.logError("["+this.metadata.uuid+"] "+msg);
    }

    /**
     * 
     * @param {string} msg - Prints the message as a warning message to the log
     */
    warn(msg) {
        global.logWarning("["+this.metadata.uuid+"] "+msg);
    }

    /**
     * Applet function overrides
     */

    on_applet_clicked() {
        // TODO: Remove if populated
        //this.popupMenu.toggle();
    }

    on_applet_removed_from_panel() {
        // Bravo Six, Going Dark

        this._signals.disconnectAllSignals();
        this.removeAllDevices();
        this.settings.finalize();

        // Disconnect DBus signal Callbacks
        if (typeof this.kdecProxy !== "undefined") {
            if (this._onAnnouncedNameChanged) {
                this.kdecProxy.disconnectSignal(this._onAnnouncedNameChanged)
            }
            if (this._onDeviceListChanged) {
                this.kdecProxy.disconnectSignal(this._onDeviceListChanged)
            }
        }

        if (typeof this._onNameOwnerChanged !== "undefined" && typeof this.dbusProxy !== "undefined") {
            this.dbusProxy.disconnectSignal(this._onNameOwnerChanged);
        }
    }

    /**
     * State management functions
     */

    /**
     * Enters the available state and initializes the content and functionality of the applet
     */
    enterAvailableState() {
        // This shouldn't be called, if we're already in the available state,
        // but check anyways and do nothing if we're already in the available state
        if (this.kdeconnectAvailable != true) {
            // We're entering the available state, so set the flag to true
            this.kdeconnectAvailable = true;
            
            // Get KDE Connect version
            try {
                let qtCoreProxy = new QCoreApplicationProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/MainApplication");
                let kdecVersion = qtCoreProxy.applicationVersion;
                this.KDEConnectVersionString = kdecVersion;
                this.compatMode.versionLevel = this.getVersionLevel(kdecVersion.split("."));
            } catch (error) {
                this.error("Error while getting KDE Connect version: " + error);
                this.warn("Resorting to default version compat level(1.3)");
            }

            try {
                this.kdecProxy = new KDEConnectDaemonProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect");

                this.ownIDString = this.kdecProxy.selfIdSync()[0];
            } catch (error) {
                this.error("Error while creating or communicating the KDE Connect proxy: "+error);
            }

            // Build Context Menu
            this.rebuildContextMenu();

            // This is maybe not needed, but I'm doing it anyway
            // Remove all devices and disconnect signals, etc.
            this.removeAllDevices();

            // Get Device Map from KDE Connect proxy
            this.devices = this.getDeviceMap();

            // TODO: Create Modules

            // Updated Panel information
            this.updatePanel();

            // Show applet label
            this.hide_applet_label(false);

            // Build main popout menu
            this.rebuildPopupMenu();

            // Connect signals for changes
            try {
                this._onAnnouncedNameChanged = this.kdecProxy.connectSignal("announcedNameChanged", this.onAnnouncedNameChanged.bind(this));
                this._onDeviceListChanged = this.kdecProxy.connectSignal("deviceListChanged", this.onDeviceListChanged.bind(this));
            } catch (error) {
                this.error("Error while connecting DBus signal callbacks for KDE Connect: "+error);
            }
            
            this.info("Entered Available State!");
        } else {
            this.warn("enterAvailableState called from available state!");
        }
    }

    /**
     * Enters the unavailable state, removes leftovers from the previous available state
     * and adds information to the applet to notify the user
     */
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
    
            // Clear menus
    
            this.popupMenu.close();

            // Since KDE Connect is now unavailable, remove all devices from list and with them, disconnect signals, etc.
            this.removeAllDevices();
            this.popupMenu.removeAll();
    
            this.contextMenuSection.removeAll();


            // Hide applet label
            this.hide_applet_label(true);
    
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

    /**
     * Functions to update/recreate certain parts of the applet
     */

    /**
     * Clears and then rebuilds the main popup menu
     */
    rebuildPopupMenu() {

    }

    /**
     * Clears and the rebuilds the added section of the context menu
     */
    rebuildContextMenu() {
        this.contextMenuSection.removeAll();

        // Menu Item showing the KDE Connect version
        if (this.options.showKDEConnectVersion == true) {
            let kdecVersionMenuItem = new PopupMenu.PopupMenuItem(_("KDE Connect Version: ${version}").replace("${version}", this.KDEConnectVersionString));
            kdecVersionMenuItem.actor.add_style_pseudo_class("insensitive");
            this.contextMenuSection.addMenuItem(kdecVersionMenuItem);
        }

        // Menu Item showing the ID of this device
        if (this.options.showOwnID == true) {
            let ownIDMenuItem = new PopupMenu.PopupMenuItem(_("Own ID: ${own_id}").replace("${own_id}", this.ownIDString));
            ownIDMenuItem._signals.connect(ownIDMenuItem, "activate", function(menuItem, keepMenu) {
                CommonUtils.copyAndNotify(this.notificationSource, this.ownIDString, _("Own ID"));
            }, this);
            let ownIDMenuItemTooltip = new Tooltips.Tooltip(ownIDMenuItem.actor, _("Click to copy ID"));
            this.contextMenuSection.addMenuItem(ownIDMenuItem);
        }

        // Menu Item for opening the KDE Connect configuration
        let configureMenuItem = new PopupMenu.PopupIconMenuItem(_("Configure KDE Connect"), "preferences-other", St.IconType.SYMBOLIC, {});
        configureMenuItem._signals.connect(configureMenuItem, "activate", this.openKDECConfiguration.bind(this));
        let configureMenuItemTooltip = new Tooltips.Tooltip(configureMenuItem.actor, _("Click to open KDE Connect Configuration"));
        this.contextMenuSection.addMenuItem(configureMenuItem);
        
        this.info("Rebuild Context Menu called")
    }

    /**
     * Updates the panel information such as icon, tooltip and label
     */
    updatePanel() {
        // Update Applet Icon
        if (this.options.useCustomIcon == false) {
            // Use default icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(CommonUtils.DefaultIcons[this.options.iconType]);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(CommonUtils.DefaultIcons[this.options.iconType]);
            } else {
                this.error("Somehow, the icon type is not recognized: '"+this.options.iconType+"'")
            }
        } else {
            // Use custom icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(this.options.customIcon);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(this.options.customIcon);
            } else {
                this.error("Somehow, the icon type is not recognized: '"+this.options.iconType+"'")
            }
        }
    }

    /**
     * Callbacks for settings and data changes
     */

    /**
     * Callback that gets called, if the data of a device changes
     */
    onDeviceDataChanged() {
        this.info("Device Data Changed!")
        // TODO: Implement
    }

    /**
     * Callback that gets called, when a setting related to the context menu changes
     * @param {*} value - The new value
     * @param {string} option - The option that changed
     */
    onContextMenuSettingsChanged(value, option) {
        this.rebuildContextMenu();
    }

    /**
     * Callback that gets called, when a setting related to the popup menu changes
     * @param {*} value - The new value
     * @param {string} option - The option that changed
     */
    onPopupMenuSettingsChanged(value, option) {
        this.rebuildPopupMenu();
    }

    /**
     * Callback that gets called, when a setting related to a module changes
     * @param {*} value - The changed value
     * @param {string} option - The option that changed
     * @param {string} moduleID - The ID of the module
     */
    onModuleSettingsChanged(value, option, moduleID) {
        //TODO: Implement
    }

    /**
     * Callback that gets called, when a setting related to the panel changes
     * @param {*} value - The new value
     * @param {string} option - The option that changed
     */
    onPanelSettingsChanged(value, option) {
        if (option == "customIcon" && this.options.useCustomIcon != true) {
            return;
        }
        this.updatePanel();
    }

    /**
     * DBus Signal Callbacks
     */
    
    /**
     * Callback for the DBus signal 'NameOwnerChanged'
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     * @param {string[]} params - THe list of parameters passed to the signal
     * @param {string} name - The DBus name that changed owner
     * @param {string} old_owner - The previous owner of the DBus name
     * @param {string} new_owner - THe new owner of the DBus name
     */
    onNameOwnerChanged(proxy, sender, [name, old_owner, new_owner]) {
        if (name == CommonUtils.KDECONNECT_DBUS_NAME) {
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
    
    /**
     * Callback for the DBus signal 'AnnouncedNameChanged'
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     * @param {string[]} params - The list of parameters passed to the signal
     * @param {string} name - The changed name
     */
    onAnnouncedNameChanged(proxy, sender, [name]) {
        this.info("AnnouncedNameChanged: "+name);
        //TODO: Implement
    }
    
    /**
     * Callback for the DBus signal 'DeviceListChanged'
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     */
    onDeviceListChanged(proxy, sender) {
        this.info("DeviceListChanged");
        //TODO: Implement
    }

    /**
     * Other functions
     */

    /**
     * Gets the list of device ID'S and names from the KDE Connect DBus service and creates Device objects accordingly.
     * @returns A map of device ID's to device objects
     */
    getDeviceMap() {
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
            let newDevice = new Device(this, deviceID, deviceNames[deviceID]);

            // Bind signal to onDeviceDataChanged function of the applet
            newDevice._signals.connect(newDevice, "plugins-changed", this.onDeviceDataChanged, this);

            deviceMap[deviceID] = newDevice;
        });

        return deviceMap;
    }

    /**
     * @param {number[]} versionArray - Array containing the numbers, the version code consists of
     * @returns An integer representing the version level
     */
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

    /**
     * Gets the options bind object related to a module
     * @param {string} moduleID - The ID of the module
     * @returns An option bind object
     */
    getModuleOptions(moduleID) {
        if (this.options.modules[moduleID]) {
            return this.options.modules[moduleID];
        } else {
            this.error("No option entry found for module with ID '{moduleID}'!".replace("{moduleID}", moduleID));
            return undefined;
        }
    }

    /**
     * Removes all devices from the device map after cleaning each one up(disconnecting signals, etc.)
     */
    removeAllDevices() {
        for (let [deviceID, device] of Object.entries(this.devices)) {
            device.destroy();
            delete this.devices[deviceID];
        }
    }

    /**
     * Registers and binds settings for the provided modules
     * @param {string[]} modules - A list of module ID's to register settings for
     * @param {string{}[]} additionalSettings - A map of module ID's to string lists containing additional settings keys
     */
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

    /**
     * Opens the KDE Connect configuration
     */
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
}

function main(metadata, orientation, panel_height, instance_id) {
    return new KDEConnectApplet(metadata, orientation, panel_height, instance_id);
}
