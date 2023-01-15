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
        this.statusIconName = ""

        // Create Device Proxy and get first values from DBus
        try {
            this.deviceProxy = new KDEConnectDeviceProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.id);

            // Get device parameters
            this.type = this.deviceProxy.type;
            this.isReachable = this.deviceProxy.isReachable;
            this.plugins = this.deviceProxy.loadedPluginsSync()[0];
            this.statusIconName = this.deviceProxy.statusIconName;
        } catch (error) {
            this.error("Error while getting device parameters, falling back to default parameters: "+error, CommonUtils.LogLevel.MINIMAL);
        }

        // Connect Signals
        if (this.deviceProxy) {
            try {
                this._onPluginsChanged = this.deviceProxy.connectSignal("pluginsChanged", this.onPluginsChanged.bind(this));
                this._onReachableChanged = this.deviceProxy.connectSignal("reachableChanged", this.onReachableChanged.bind(this));
                this._onTypeChanged = this.deviceProxy.connectSignal("typeChanged", this.onTypeChanged.bind(this));
                this._onNameChanged = this.deviceProxy.connectSignal("nameChanged", this.onNameChanged.bind(this));
                this._onStatusIconNameChanged = this.deviceProxy.connectSignal("statusIconNameChanged", this.onStatusIconNameChanged.bind(this));
            } catch (error) {
                this.error("Error while connecting DBus signal callbacks: "+error, CommonUtils.LogLevel.MINIMAL);
            }
        }

        // Map of module ID's to module objects, so an object can only be added once
        this.modules = {};

        this.info("Created new Device object for '"+this.name+"' with ID: "+this.id, CommonUtils.LogLevel.INFO);
    }

    /**
     * Logging functions
     */

    /**
     * Uses the parent applet to print an info message to the log
     * @param {string} msg - The message to log
     * @param {CommonUtils.LogLevel} level - The level to log the message at
     */
    info(msg, level) {
        this.applet.info("(" + this.id + ") " + msg, level);
    }

    /**
     * Uses the parent applet to print an warning message to the log
     * @param {string} msg - The message to log
     * @param {CommonUtils.LogLevel} level - The level to log the message at
     */
    warn(msg, level) {
        this.applet.warn("(" + this.id + ") " + msg, level);
    }

    /**
     * Uses the parent applet to print an error message to the log
     * @param {string} msg - The message to log
     * @param {CommonUtils.LogLevel} level - The level to log the message at
     */
    error(msg, level) {
        this.applet.error("(" + this.id + ") " + msg, level);
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
     * @returns The name of the device
     */
    getName() {
        return this.name;
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
     * @returns The current status icon name
     */
    getStatusIconName() {
        return this.statusIconName;
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
        this.info("Plugin list changed!", CommonUtils.LogLevel.VERBOSE);

        if (this.deviceProxy) {
            try {
                this.plugins = this.deviceProxy.loadedPluginsSync()[0];

                this.emit("plugins-changed");
            } catch (error) {
                this.error("Error while updating list of loaded plugins: "+error, CommonUtils.LogLevel.MINIMAL);
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
        this.info("Reachable status changed! New status: "+isReachable, CommonUtils.LogLevel.VERBOSE);

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
        this.info("Device type changed! New type: "+type, CommonUtils.LogLevel.VERBOSE);

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
        this.info("Device name changed! New name: "+name, CommonUtils.LogLevel.VERBOSE);

        this.name = name;

        // Change text of menu item, if it exists
        if (this.menuItem) {
            this.menuItem.label.set_text(self.name);
        }

        this.emit("name-changed");
    }

    /**
     * Callback for the DBus 'statusIconNameChanged' signal
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     */
    onStatusIconNameChanged(proxy, sender) {
        this.info("Status icon changed! New icon: "+this.statusIconName, CommonUtils.LogLevel.DEBUG);

        if (this.deviceProxy) {
            this.statusIconName = this.deviceProxy.statusIconName;

            // Change icon name of the menu item icon, if it exists
            if (this.menuItemIcon) {
                this.menuItemIcon.set_icon_name(this.statusIconName);
                this.menuItemIcon.set_icon_type(St.IconType.SYMBOLIC);
            }

            this.emit("statusiconname-changed");
        }
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

        this.info("Creating Modules:", CommonUtils.LogLevel.VERBOSE);

        supportedModules.forEach(moduleID => {
            if (moduleOptions[moduleID].enabled == true) {
                let moduleClass = Modules.moduleClasses[moduleID];

                if (moduleClass.REQUIRED_KDEC_PLUGINS.every(plugin => this.plugins.includes(plugin))) {
                    this.addModule(new moduleClass(this, this.compatMode));

                    this.info(" + '"+moduleID+"'", CommonUtils.LogLevel.VERBOSE);
                } else {
                    this.info(" - '"+moduleID+"': Not all KDE Connect plugins present", CommonUtils.LogLevel.VERBOSE);
                }
            }
        });
    }

    /**
     * Remove a module from the device
     * @param {string} moduleID - The ID of the module to remove
     */
    removeModule(moduleID) {
        if (this.modules[moduleID]) {
            this.modules[moduleID].destroy();
            delete this.modules[moduleID];   
        }
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

    getMenuItem() {
        if (this.menuItem) {
            return this.menuItem;
        } else {
            this.rebuildMenuItem();
            return this.menuItem;
        }
    }

    rebuildMenuItem() {
        // Destroy old menu item, if it exists
        if (this.menuItem) {
            this.menuItem.destroy();
        }

        if (this.menuItemIcon) {
            this.menuItemIcon.destroy();
        }

        // Create new menu item based on rechable state
        if (this.isReachable == true) {
            // Create normal menu item with sub menu
            this.menuItem = new PopupMenu.PopupSubMenuMenuItem(this.name);

            // Workaround to add icon, because Cinnamon didn't like me making a PopupMenu class in another file
            this.menuItemIcon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: this.statusIconName, icon_type: St.IconType.SYMBOLIC});
            this.menuItem.addActor(this.menuItemIcon, {span: 0, position: 0});

            // Add info modules
            let infoModules = this.getModulesByType(Modules.ModuleType.INFO);

            infoModules.forEach(infoModule => {
                this.warn(infoModule.getID());
                this.menuItem.menu.addMenuItem(infoModule.getMenuItem());
            });

            // If there is at least 1 info modules, add seperator
            if (infoModules.length > 0) {
                this.menuItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            // Add action modules
            let actionModules = this.getModulesByType(Modules.ModuleType.ACTION);

            actionModules.forEach(actionModule => {
                this.menuItem.menu.addMenuItem(actionModule.getMenuItem());
            });

            // If no modules are selected/available, add menu item informing user
            if ((infoModules.length + actionModules.length) == 0) {
                let noModulesInfoItem = new PopupMenu.PopupMenuItem(_("No Modules available"));
                noModulesInfoItem.actor.add_style_pseudo_class("insensitive");
                this.menuItem.menu.addMenuItem(noModulesInfoItem);
            }
        } else {
            // Create inactive menu item
            this.menuItem = new PopupMenu.PopupIconMenuItem(this.name, this.statusIconName, St.IconType.SYMBOLIC, {reactive: false});
            this.menuItem.actor.add_style_pseudo_class("insensitive");
        }

        return this.menuItem;
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

        this.info("Destroyed!", CommonUtils.LogLevel.VERBOSE);
    }
}
Signals.addSignalMethods(Device.prototype);


class KDEConnectApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;

        // Add notification source for applet
        this.notificationSource = new CommonUtils.AppletNotificationSource();
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
        this.compatMode = {
            versionLevel: 0
        };

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
        this.settings.bind("expandfirst", "expandFirst", function() {});
        this.settings.bind("tooltipdevicecount", "tooltipDeviceCount", this.onPanelSettingsChanged.bind(this), "tooltipDeviceCount");

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

        this.info("Icon Type is "+this.options.iconType+", setting icon name to: "+CommonUtils.DefaultIcons[this.options.iconType], CommonUtils.LogLevel.DEBUG);
        
        // Set correct icon type and name
        if (this.options.useCustomIcon == false) {
            // Use default icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(CommonUtils.DefaultIcons[this.options.iconType]);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(CommonUtils.DefaultIcons[this.options.iconType]);
            } else {
                this.error("Error: Invalid icon type: '"+this.options.iconType+"'", CommonUtils.LogLevel.MINIMAL);
            }
        } else {
            // Use custom icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(this.options.customIcon);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(this.options.customIcon);
            } else {
                this.error("Error: Invalid icon type: '"+this.options.iconType+"'", CommonUtils.LogLevel.MINIMAL);
            }
        }
        
        this.hide_applet_label(true);


        // Check if KDE Connect is already running using DBus
        let foundKDEConnect = false;
        
        try {
            this.dbusProxy = new FreedesktopDBusProxy(Gio.DBus.session, "org.freedesktop.DBus", "/org/freedesktop/DBus");
            foundKDEConnect = this.dbusProxy.NameHasOwnerSync(CommonUtils.KDECONNECT_DBUS_NAME)[0];
        } catch (error) {
            this.error("Error while checking if KDE Connect DBus service exists on the session bus: " + error, CommonUtils.LogLevel.MINIMAL);
        }

        if (foundKDEConnect == true) {
            this.info("Found KDE Connect DBus service!", CommonUtils.LogLevel.VERBOSE);

            // KDE Connect DBus service is available

            // Enter Available state and initialize main functionality
            this.enterAvailableState();
        } else {
            this.warn("KDE Connect DBus service not found on session bus!", CommonUtils.LogLevel.NORMAL);

            // KDE Connect DBus service is not available

            // Enter Unavailable state and add infor for user
            this.enterUnavailableState();

            // Connect signal to get called, when a DBus name changes owner (detect if KDE Connect service registers)
            try {
                this._onNameOwnerChanged = this.dbusProxy.connectSignal("NameOwnerChanged", Lang.bind(this, this.onNameOwnerChanged));
            } catch (error) {
                this.error("Error while registering DBUS callback for 'NameOwnerChanged' signal: " + error, CommonUtils.LogLevel.MINIMAL);
            }
        }

        this.info("Hello there!", CommonUtils.LogLevel.NORMAL);
    }

    /**
     * Logging functions
     */

    /**
     * Logging function for the applet class
     * @param {string} msg - The message to log as 'info'
     * @param {CommonUtils.LogLevel} level - The level to log the message at
     */
    info(msg, level) {
        CommonUtils.logInfo(msg, level);
    }

    /**
     * Logging function for the applet class
     * @param {string} msg - The message to log as 'warn'
     * @param {CommonUtils.LogLevel} level - The level to log the message at
     */
    warn(msg, level) {
        CommonUtils.logWarn(msg, level);
    }

    /**
     * Logging function for the applet class
     * @param {string} msg - The message to log as 'error'
     * @param {CommonUtils.LogLevel} level - The level to log the message at
     */
    error(msg, level) {
        CommonUtils.logError(msg, level);
    }

    /**
     * Applet function overrides
     */

    on_applet_clicked() {
        // First, get reachable device count and bottom menu item
        let deviceCount = 0;
        let bottomDevice = null;

        for (let [deviceID, device] of Object.entries(this.devices)) {
            if (device.getReachableStatus() == true) {
                deviceCount += 1;
                bottomDevice = device;
            }
        }

        // If only 1 device is present or there are more and the setting is true, open the bottom reachable device menu
        if (deviceCount == 1) {
            bottomDevice.getMenuItem().menu.open(false);
        } else if (deviceCount > 1) {
            if (this.options.expandFirst == true) {
                bottomDevice.getMenuItem().menu.open(false);
            }
        }

        this.popupMenu.toggle();
    }

    on_applet_removed_from_panel() {
        this.info("That's all, folks!", CommonUtils.LogLevel.NORMAL);

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
                this.info("Compatability level: "+this.compatMode.versionLevel, CommonUtils.LogLevel.INFO);
            } catch (error) {
                this.error("Error while getting KDE Connect version: " + error, CommonUtils.LogLevel.MINIMAL);
                this.warn("Resorting to default version compat level(v1.3)", CommonUtils.LogLevel.NORMAL);
            }

            try {
                this.kdecProxy = new KDEConnectDaemonProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect");

                this.ownIDString = this.kdecProxy.selfIdSync()[0];
            } catch (error) {
                this.error("Error while communicating with the KDE Connect DBus service: "+error, CommonUtils.LogLevel.MINIMAL);
            }

            // Build Context Menu
            this.rebuildContextMenu();

            // This is maybe not needed, but I'm doing it anyway
            // Remove all devices and disconnect signals, etc.
            this.removeAllDevices();

            // Get Device Map from KDE Connect proxy
            this.devices = this.getDeviceMap();

            // Updated Panel information
            this.updatePanel();

            // Create modules for each device
            for (let [deviceID, device] of Object.entries(this.devices)) {
                device.createModules(Modules.modules)
            }

            // Build main popout menu
            this.rebuildPopupMenu();

            // Connect signals for changes
            try {
                this._onAnnouncedNameChanged = this.kdecProxy.connectSignal("announcedNameChanged", this.onAnnouncedNameChanged.bind(this));
                this._onDeviceListChanged = this.kdecProxy.connectSignal("deviceListChanged", this.onDeviceListChanged.bind(this));
            } catch (error) {
                this.error("Error while connecting callbacks for DBus signals: "+error, CommonUtils.LogLevel.MINIMAL);
            }
            
            this.info("Entered Available State!", CommonUtils.LogLevel.VERBOSE);
        } else {
            this.warn("enterAvailableState called from available state, this shouldn't happen!", CommonUtils.LogLevel.INFO);
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
    
            this.info("Enterted Unavailable State!", CommonUtils.LogLevel.VERBOSE);
        } else {
            this.warn("enterUnavailableState called from unavailable state, this shouldn't happen!", CommonUtils.LogLevel.INFO);
        }
    }

    /**
     * Functions to update/recreate certain parts of the applet
     */

    /**
     * Clears and then rebuilds the main popup menu
     */
    rebuildPopupMenu() {
        this.info("Rebuilding Popup Menu...", CommonUtils.LogLevel.DEBUG);

        // Remove all previous items from popup menu
        this.popupMenu.removeAll();

        // Get new menu items from device objects
        for (let [deviceID, device] of Object.entries(this.devices)) {
            device.rebuildMenuItem();
            let deviceMenuItem = device.getMenuItem();
            if (device.getReachableStatus() == false) {
                this.popupMenu.addMenuItem(deviceMenuItem, 0);
            } else {
                this.popupMenu.addMenuItem(deviceMenuItem);
            }
        }
    }

    /**
     * Clears and the rebuilds the added section of the context menu
     */
    rebuildContextMenu() {
        this.info("Rebuilding Context Menu Section...", CommonUtils.LogLevel.DEBUG);

        // Remove all previously present items from context menu section
        this.contextMenuSection.removeAll();

        // Menu Item showing the KDE Connect version
        if (this.options.showKDEConnectVersion == true) {
            let kdecVersionMenuItem = new PopupMenu.PopupIconMenuItem(_("KDE Connect Version: ${version}").replace("${version}", this.KDEConnectVersionString), "help-info-symbolic", St.IconType.SYMBOLIC);
            kdecVersionMenuItem.actor.add_style_pseudo_class("insensitive");
            this.contextMenuSection.addMenuItem(kdecVersionMenuItem);
        }

        // Menu Item showing the ID of this device
        if (this.options.showOwnID == true) {
            let ownIDMenuItem = new PopupMenu.PopupIconMenuItem(_("Own ID: ${own_id}").replace("${own_id}", this.ownIDString), "tag-symbolic", St.IconType.SYMBOLIC);
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
    }

    /**
     * Updates the panel information such as icon, tooltip and label
     */
    updatePanel() {
        this.info("Updating panel information...", CommonUtils.LogLevel.DEBUG);

        // Update Applet Icon
        if (this.options.useCustomIcon == false) {
            // Use default icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(CommonUtils.DefaultIcons[this.options.iconType]);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(CommonUtils.DefaultIcons[this.options.iconType]);
            } else {
                this.error("Invalid icon type: '"+this.options.iconType+"'", CommonUtils.LogLevel.MINIMAL);
            }
        } else {
            // Use custom icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(this.options.customIcon);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(this.options.customIcon);
            } else {
                this.error("Invalid icon type: '"+this.options.iconType+"'", CommonUtils.LogLevel.MINIMAL);
            }
        }

        // Get number of rechable devices
        let deviceCount = 0;

        for (let [deviceID, device] of Object.entries(this.devices)) {
            if (device.getReachableStatus() == true) {
                deviceCount += 1;
            }
        }

        // Set Tooltip
        if (this.options.tooltipDeviceCount == true) {

            if (deviceCount == 0) {
                this.set_applet_tooltip(this.metadata.name+"\n"+_("No Devices"));
            } else if (deviceCount == 1) {
                this.set_applet_tooltip(this.metadata.name+"\n"+_("1 Device"));
            } else {
                this.set_applet_tooltip(this.metadata.name+"\n"+_("{deviceCount} Devices").replace("{deviceCount}", deviceCount));
            }
        } else {
            this.set_applet_tooltip(this.metadata.name);
        }

        // Set Label
        if (this.options.showDeviceCount == true) {
            this.hide_applet_label(false);
            this.set_applet_label(deviceCount.toString());
        } else {
            this.hide_applet_label(true);
        }
    }

    /**
     * Callbacks for settings and data changes
     */

    /**
     * Callback that gets called, if the plugins of a device change
     */
    onDevicePluginsChanged() {
        this.info("Plugin list of a device changed!", CommonUtils.LogLevel.DEBUG);

        // Plugins of a device changed, we need to recreate the modules and rebuilt the popup menu

        for (let [deviceID, device] of Object.entries(this.devices)) {
            device.removeAllModules();
            device.createModules(Modules.modules)
        }

        this.rebuildPopupMenu();
    }

    /**
     * Callback that gets called, if the reachable state of a device change
     */
    onDeviceReachableChanged() {
        this.info("Reachable status of a device changed!", CommonUtils.LogLevel.DEBUG);

        // Reachable state of a device changed, we need to rebuilt the popup menu
        this.rebuildPopupMenu();
    }

    /**
     * Callback that gets called, when a setting related to the context menu changes
     * @param {*} value - The new value
     * @param {string} option - The option that changed
     */
    onContextMenuSettingsChanged(value, option) {
        this.info("Settings related to the context menu changed!", CommonUtils.LogLevel.DEBUG);

        this.rebuildContextMenu();
    }

    /**
     * Callback that gets called, when a setting related to the popup menu changes
     * @param {*} value - The new value
     * @param {string} option - The option that changed
     */
    onPopupMenuSettingsChanged(value, option) {
        this.info("Settings related to the main popup menu changed!", CommonUtils.LogLevel.DEBUG);

        this.rebuildPopupMenu();
    }

    /**
     * Callback that gets called, when a setting related to a module changes
     * @param {*} value - The changed value
     * @param {string} option - The option that changed
     * @param {string} moduleID - The ID of the module
     */
    onModuleSettingsChanged(value, option, moduleID) {
        this.info("Settings related to modules changed!", CommonUtils.LogLevel.DEBUG);

        // Settings for a module changed, for simplicity, we simply recreate the modules and rebuilt the popup menu

        for (let [deviceID, device] of Object.entries(this.devices)) {
            device.removeAllModules();
            device.createModules(Modules.modules)
        }

        this.rebuildPopupMenu();
    }

    /**
     * Callback that gets called, when a setting related to the panel changes
     * @param {*} value - The new value
     * @param {string} option - The option that changed
     */
    onPanelSettingsChanged(value, option) {
        this.info("Settings related to the panel changed!", CommonUtils.LogLevel.DEBUG);

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
            this.info("NameOwnerAcquired Signal: "+name+" | "+old_owner+" -> "+new_owner, CommonUtils.LogLevel.DEBUG);
            if (new_owner != "") {
                // Found KDE Connect DBus service
    
                this.info("KDE Connect DBus service found on session bus!", CommonUtils.LogLevel.VERBOSE);
    
                // Enter Available State
                this.enterAvailableState();
            } else if (old_owner != "" && new_owner == "") {
                // KDE Connect DBus service unregistered from DBus
                this.warn("KDE Connect DBus service unregistered from session bus!", CommonUtils.LogLevel.VERBOSE);

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
        this.info("AnnouncedNameChanged Signal: "+name, CommonUtils.LogLevel.DEBUG);
        //TODO: Implement
    }
    
    /**
     * Callback for the DBus signal 'DeviceListChanged'
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     */
    onDeviceListChanged(proxy, sender) {
        this.info("Device list changed!", CommonUtils.LogLevel.INFO);

        // Device List changed, we need to recreate the internal device list

        // Remove all devices and disconnect signals, etc.
        this.removeAllDevices();

        // Get Device Map from KDE Connect proxy
        this.devices = this.getDeviceMap();

        // Updated Panel information
        this.updatePanel();

        // Create modules for each device
        for (let [deviceID, device] of Object.entries(this.devices)) {
            device.createModules(Modules.modules)
        }

        // Build main popout menu
        this.rebuildPopupMenu();
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
            this.error("Error while getting list of devices: " + error, CommonUtils.LogLevel.MINIMAL);
        }

        deviceIDs.forEach(deviceID => {
            let newDevice = new Device(this, deviceID, deviceNames[deviceID]);

            // Bind signal to onDeviceDataChanged function of the applet
            newDevice._signals.connect(newDevice, "plugins-changed", this.onDevicePluginsChanged, this);
            newDevice._signals.connect(newDevice, "reachable-changed", this.onDeviceReachableChanged, this);

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
            this.error("No option entry found for module with ID '"+moduleID+"'!", CommonUtils.LogLevel.NORMAL);
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
                    this.info("Opened KDE Connect Configuration!", CommonUtils.LogLevel.INFO)
                }));
            }
        } catch (error) {
            this.error("Error while opening KDE Connect configuration: " + error, CommonUtils.LogLevel.MINIMAL);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new KDEConnectApplet(metadata, orientation, panel_height, instance_id);
}
