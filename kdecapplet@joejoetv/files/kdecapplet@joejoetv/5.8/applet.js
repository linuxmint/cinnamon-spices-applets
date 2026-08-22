const Applet = require("ui.applet");
const Main = require("ui.main");
const Settings = require("ui.settings");
const PopupMenu = require("ui.popupMenu");
const Tooltips = require("ui.tooltips");
const Gio = require("gi.Gio");
const St = require("gi.St");
const GLib = require("gi.GLib");
const Util = require("misc.util");
const SignalManager = require("misc.signalManager");
const Lang = require("lang");
const Gettext = require("gettext");
const Signals = require("signals");
const Extension = require("ui.extension");

// Applet imports
const Modules = require("./js/modules.js");
const Utils = require("./js/utils.js");
const Ui = require("./js/ui.js");
const Dialogs = require("./js/dialogs.js");
const Logging = require("./js/logging.js");

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
Gettext.bindtextdomain(Utils.UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(Utils.UUID, str);
}


/**
 * #Device:
 * @short_description Device class representing a KDE Connect device
 */
class Device {
    #logger;

    constructor(applet, id, name, compatMode, moduleOrders) {
        this.applet = applet;
        this.id = id;
        this.name = name;
        this.compatMode = compatMode;
        this.moduleOrders = moduleOrders;

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

        // Setup logging
        this.#logger = new Logging.Logger(Utils.UUID, `dev:${id}`);

        // Create Device Proxy and get first values from DBus
        try {
            this.deviceProxy = new KDEConnectDeviceProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${this.id}`);

            // Get device parameters
            this.type = this.deviceProxy.type;
            this.isReachable = this.deviceProxy.isReachable;
            this.plugins = this.deviceProxy.loadedPluginsSync()[0];
            this.statusIconName = this.deviceProxy.statusIconName;
        } catch (error) {
            this.#logger.error("Error while getting device parameters, falling back to default parameters", error);
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
                this.#logger.error("Error while connecting DBus signal callbacks", error);
            }
        }

        // Map of module ID's to module objects, so an object can only be added once
        this.modules = {};

        // Initialize values to null and then create modules and menu item
        this.menuItem = null;
        this.menuItemIcon = null;

        try {
            this.createModules();
            this.createMenuItem();

        } catch (error) {
            this.#logger.error("Error while creating modules and menu item", error);
        }

        this.#logger.debug(`Created new Device object for '${this.name}' with ID: ${this.id}`);
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
        this.#logger.debug("Plugin list changed!");

        if (this.deviceProxy) {
            try {
                this.plugins = this.deviceProxy.loadedPluginsSync()[0];

                this.emit("plugins-changed");
            } catch (error) {
                this.#logger.error("Error while updating list of loaded plugins", error);
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
        this.#logger.debug(`Reachable status changed! New status: ${isReachable}`);

        if (isReachable !== this.isReachable) {
            this.isReachable = isReachable;

            this.emit("reachable-changed", isReachable);
        }

    }

    /**
     * Callback for the DBus 'typeChanged' signal
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     * @param {[string]} params - List of parameters passed to the signal
     * @param {string} type - The changed device type
     */
    onTypeChanged(proxy, sender, [type]) {
        this.#logger.debug(`Device type changed! New type: ${type}`);

        this.type = type;

        this.emit("type-changed", type);
    }

    /**
     * Callback for the DBus 'nameChanged' signal
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     * @param {[string]} params - List of parameters passed to the signal
     * @param {string} name - The changed device name
     */
    onNameChanged(proxy, sender, [name]) {
        this.#logger.debug(`Device name changed! New name: ${name}`);

        this.name = name;

        // Change text of menu item, if it exists
        if (this.menuItem !== null) {
            this.menuItem.label.set_text(self.name);
        }

        this.emit("name-changed", name);
    }

    /**
     * Callback for the DBus 'statusIconNameChanged' signal
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     */
    onStatusIconNameChanged(proxy, sender) {
        this.#logger.debug(`Status icon changed! New icon: ${this.statusIconName}`);

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
     * Creates modules
     */
    createModules() {
        // Only create modules, if device is reachable
        if (this.isReachable == true) {
            let moduleOptions = this.applet.options.modules;

            this.#logger.debug(`Loaded Device Plugins: ${this.plugins.toString()}`);

            this.#logger.debug("Creating Modules:");

            let supportedModules = this.moduleOrders[Modules.ModuleType.INFO].concat(this.moduleOrders[Modules.ModuleType.ACTION]);

            supportedModules.forEach(moduleID => {
                if (moduleOptions[moduleID].enabled == true) {
                    let moduleClass = Modules.moduleClasses[moduleID];

                    this.#logger.debug(`Required Plugins for module '${moduleID}': ${moduleClass.REQUIRED_KDEC_PLUGINS.toString()}`);

                    if (moduleClass.REQUIRED_KDEC_PLUGINS.every(plugin => this.plugins.includes(plugin))) {
                        try {
                            this.addModule(new moduleClass(this, this.compatMode));
                        } catch (error) {
                            this.#logger.error(`Error while creating module with ID '${moduleID}'`, error);
                        }

                        this.#logger.debug(` + '${moduleID}'`);
                    } else {
                        this.#logger.debug(` - '${moduleID}': Not all KDE Connect plugins present`);
                    }
                } else {
                    this.#logger.debug(` - '${moduleID}': Module disabled`);
                }
            });
        } else {
            this.#logger.debug("Device is not reachable, not creating modules!");
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
     * Recreates the module list
     */
    recreateModules() {
        try {
            this.removeAllModules();
            this.createModules();
        } catch (error) {
            this.#logger.error("Error while recreating modules", error);
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
        this.moduleOrders[type].forEach(moduleID => {
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
        return this.menuItem;
    }

    createMenuItem() {
        if (this.isReachable == true) {
            this.menuItem = new PopupMenu.PopupSubMenuMenuItem(this.name);

            // Workaround to add icon, because Cinnamon didn't like me making a PopupMenu class in another file
            this.menuItemIcon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: this.statusIconName, icon_type: St.IconType.SYMBOLIC });

            this.menuItem.addActor(this.menuItemIcon, {span: 0, position: 0});

            // Add info modules
            let infoModules = this.getModulesByType(Modules.ModuleType.INFO);

            infoModules.forEach(infoModule => {
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
                this.noModulesInfoItem = new PopupMenu.PopupMenuItem(_("No Modules available"));
                this.noModulesInfoItem.actor.add_style_pseudo_class("insensitive");
                this.menuItem.menu.addMenuItem(this.noModulesInfoItem);
            }
        } else {
            // Create inactive menu item
            this.menuItem = new PopupMenu.PopupIconMenuItem(this.name, this.statusIconName, St.IconType.SYMBOLIC, { reactive: false });
            this.menuItem.actor.add_style_pseudo_class("insensitive");
        }
    }

    destroyMenuItem() {
        try {
            if (this.menuItem !== null) {
                if (this.isReachable == true) {
                    this.menuItem.menu.removeAll();
                }

                this.menuItem.destroy();
                this.menuItem = null;
            }

        } catch (error) {
            this.#logger.error("Error while destroying menu item", error);
        }
    }

    rebuildMenuItem() {
        // We have to remove and recreate the module menu items, or the menu items get destroyed by destroying the submenu menu item
        for (let [moduleID, module] of Object.entries(this.modules)) {
            module.destroyMenuItem();
        }

        // Now, destroy the device menu item and recreate the module menu items as well as the device menu item
        this.destroyMenuItem();

        if (this.isReachable == true) {
            for (let [moduleID, module] of Object.entries(this.modules)) {
                module.createMenuItem();
            }
        } else {
            this.removeAllModules();
        }

        this.createMenuItem();
    }

    /**
     * Disconnects all signals and removes all applets
     */
    destroy() {
        this._signals.disconnectAllSignals();
        this.removeAllModules();
        this.destroyMenuItem();

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

        this.#logger.debug("Destroyed!");
    }
}
Signals.addSignalMethods(Device.prototype);


class KDEConnectApplet extends Applet.TextIconApplet {
    static LOGGER = new Logging.Logger(Utils.UUID);

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.instance_id = instance_id;

        // Add notification source for applet
        this.notificationSource = new Ui.AppletNotificationSource();
        Main.messageTray.add(this.notificationSource);

        // Signal Manager to store signal connections and disconnect all of them, when the applet is unloaded
        this._signals = new SignalManager.SignalManager(null);

        // Tracking values for available conditions
        this.serviceOnBus = false;
        this.validVersion = false;

        /**
         * Define object variables and default values
         */

        // Map of device ID's to Device Object
        this.devices = {};

        // Array that store an ordered list of IDs
        this.deviceOrder = [];
        this.moduleOrders = {
            [Modules.ModuleType.INFO]: [],
            [Modules.ModuleType.ACTION]: [],
        };

        // Wether to run the callbacks for the settings order lists
        this.doOrderCallback = false;

        this.orderValueCache = {
            "deviceOrder": [],
            "infoModules": [],
            "actionModules": []
        };

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

        // Try to migrate old (single-instance) config file _before_ loading it
        if (Utils.migrateSettings(metadata.uuid, instance_id)) {
            KDEConnectApplet.LOGGER.info("Succesfully migrated old (single-instance) settings file to instance settings file.");
        } else {
            KDEConnectApplet.LOGGER.info("No settings file migration was performed.");
        }

        // Create Settings Provider
        this.settings = new Settings.AppletSettings(this.options, metadata.uuid, instance_id);

        // Bind settings
        this.settings.bind("switch_show-own-id", "showOwnID", this.onContextMenuSettingsChanged.bind(this), "showOwnID");
        this.settings.bind("switch_show-kdec-version", "showKDEConnectVersion", this.onContextMenuSettingsChanged.bind(this), "showKDEConnectVersion");
        this.settings.bind("switch_show-device-count", "showDeviceCount", this.onPanelSettingsChanged.bind(this), "showDeviceCount");
        this.settings.bind("switch_show-device-count-tooltip", "tooltipDeviceCount", this.onPanelSettingsChanged.bind(this), "tooltipDeviceCount");
        this.settings.bind("combobox_icon-type", "iconType", this.onPanelSettingsChanged.bind(this), "iconType");
        this.settings.bind("switch_use-custom-icon", "useCustomIcon", this.onPanelSettingsChanged.bind(this), "useCustomIcon");
        this.settings.bind("icon_custom-icon", "customIcon", this.onPanelSettingsChanged.bind(this), "customIcon");
        this.settings.bind("switch_expand-only-device", "expandOnlyDevice", function () { });

        this.settings.bind("generic_device-order", "deviceOrder", this.onDeviceOrderChanged.bind(this), "deviceOrder");
        this.settings.bind("generic_info-modules", "infoModules", this.onModulesOrderChanged.bind(this), "infoModules");
        this.settings.bind("generic_action-modules", "actionModules", this.onModulesOrderChanged.bind(this), "actionModules");

        this.doOrderCallback = false;

        // Cleans moudules settings OrderLists
        this.options.infoModules = this.cleanModuleList(this.options.infoModules, Modules.modulesByType(Modules.ModuleType.INFO));
        this.options.actionModules = this.cleanModuleList(this.options.actionModules, Modules.modulesByType(Modules.ModuleType.ACTION));

        this.updateModuleOrderArrays();

        this.orderValueCache["deviceOrder"] = this.options.deviceOrder
        this.orderValueCache["infoModules"] = this.options.infoModules
        this.orderValueCache["actionModules"] = this.options.actionModules

        this.doOrderCallback = true;

        // Register Module Settings Callbacks
        this.registerModuleSettings(Modules.modules);

        this.options.infoModules.forEach(entry => {
            this.options.modules[entry["id"]].enabled = entry["enabled"]
        });

        this.options.actionModules.forEach(entry => {
            this.options.modules[entry["id"]].enabled = entry["enabled"]
        });

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

        KDEConnectApplet.LOGGER.debug(`Icon Type is ${this.options.iconType}, setting icon name to: ${Utils.DefaultIcons[this.options.iconType]}`);

        // Set correct icon type and name
        if (this.options.useCustomIcon == false) {
            // Use default icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(Utils.DefaultIcons[this.options.iconType]);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(Utils.DefaultIcons[this.options.iconType]);
            } else {
                KDEConnectApplet.LOGGER.error(`Invalid icon type: '${this.options.iconType}'`);
            }
        } else {
            // Use custom icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(this.options.customIcon);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(this.options.customIcon);
            } else {
                KDEConnectApplet.LOGGER.error(`Invalid icon type: '${this.options.iconType}'`);
            }
        }

        this.hide_applet_label(true);

        try {
            this.dbusProxy = new FreedesktopDBusProxy(Gio.DBus.session, "org.freedesktop.DBus", "/org/freedesktop/DBus");
            this.dbusProxy.NameHasOwnerRemote(Utils.KDECONNECT_DBUS_NAME, this._onNameOwnerFound.bind(this));
        } catch (error) {
            KDEConnectApplet.LOGGER.error("Error while connecting to DBus", error);
        }
    }

    /**
     * Function to finish initialization, so it doesn't all happen in the constructor
     */
    _onNameOwnerFound([foundKDEConnect], errorObject) {
        try {
            KDEConnectApplet.LOGGER.debug("NameHasOwner Callback called!");

            if (foundKDEConnect == true) {
                KDEConnectApplet.LOGGER.debug("Found KDE Connect DBus service!");

                this.serviceOnBus = true;

                // KDE Connect DBus service is available

                // Enter Available state and initialize main functionality
                this.enterAvailableState();
            } else {
                KDEConnectApplet.LOGGER.warn("KDE Connect DBus service not found on session bus!");

                this.serviceOnBus = false;

                // KDE Connect DBus service is not available

                // Enter Unavailable state and add infor for user
                this.enterUnavailableState();

                // Connect signal to get called, when a DBus name changes owner (detect if KDE Connect service registers)
                try {
                    this._onNameOwnerChanged = this.dbusProxy.connectSignal("NameOwnerChanged", this.onNameOwnerChanged.bind(this));
                } catch (error) {
                    KDEConnectApplet.LOGGER.error("Error while registering DBUS callback for 'NameOwnerChanged' signal", error);
                }
            }
    
            KDEConnectApplet.LOGGER.info(`${this.metadata.name} v${this.metadata.version} loaded (instance ${this.instance_id})!`);
            KDEConnectApplet.LOGGER.info("Hello there!");

        } catch (error) {
            KDEConnectApplet.LOGGER.error("Error while initializing applet", error);
        }
    }

    /**
     * Applet function overrides
     */

    on_applet_clicked() {
        let unavailableDevices = []
        let availableDevices = []

        this.deviceOrder.forEach(element => {
            if (this.devices[element["id"]].getReachableStatus() == true) {
                availableDevices.push(element["id"]);
            } else {
                unavailableDevices.push(element["id"]);
            }
        });

        if (availableDevices.length == 1 && this.options.expandOnlyDevice == true) {
            let device = this.devices[availableDevices[0]];

            device.getMenuItem().menu.open(false);
        } else {
            this.deviceOrder.forEach(element => {
                let device = this.devices[element["id"]];

                if (element["expand"] == true && device.getReachableStatus() == true) {
                    device.getMenuItem().menu.open(false);
                }
            });
        }

        this.popupMenu.toggle();
    }

    on_applet_removed_from_panel() {
        KDEConnectApplet.LOGGER.info("Goodbye cruel world!");

        this._signals.disconnectAllSignals();
        this.removeAllDevices();
        this.settings.finalize();

        // Disconnect DBus signal Callbacks
        if (typeof this.kdecProxy !== "undefined") {
            if (this._onAnnouncedNameChanged) {
                this.kdecProxy.disconnectSignal(this._onAnnouncedNameChanged);
            }
            if (this._onDeviceListChanged) {
                this.kdecProxy.disconnectSignal(this._onDeviceListChanged);
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
                let qtCoreProxy = new QCoreApplicationProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, "/MainApplication");
                let kdecVersion = qtCoreProxy.applicationVersion;

                if (kdecVersion == null) {
                    // The KDE Connect version is null, so it isn't properly initialized (yet)
                    this.validVersion = false;

                    KDEConnectApplet.LOGGER.warn(`Invalid KDE Connect version returned, please try reloading the Applet and/or restarting KDE Connect! Returned version: ${kdecVersion}`);

                    // Go into unavailable state
                    this.enterUnavailableState();
                    return;
                }

                this.validVersion = true;

                this.KDEConnectVersionString = kdecVersion;
                this.compatMode.versionLevel = this.getVersionLevel(kdecVersion.split("."));
                KDEConnectApplet.LOGGER.info(`Compatability level: ${this.compatMode.versionLevel}`);
            } catch (error) {
                KDEConnectApplet.LOGGER.error("Error while getting KDE Connect version", error);
                KDEConnectApplet.LOGGER.warn("Resorting to default version compat level(v1.3)");
            }

            try {
                this.kdecProxy = new KDEConnectDaemonProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect");

                this.ownIDString = this.kdecProxy.selfIdSync()[0];
            } catch (error) {
                KDEConnectApplet.LOGGER.error("Error while communicating with the KDE Connect DBus service", error);
            }

            // Build Context Menu
            this.rebuildContextMenu();

            // This is maybe not needed, but I'm doing it anyway
            // Remove all devices and disconnect signals, etc.
            this.removeAllDevices();

            try {
                // Get Device Map from KDE Connect proxy
                this.devices = this.getDeviceMap();
            } catch (error) {
                KDEConnectApplet.LOGGER.error("Error while building device list", error);
            }

            this.doOrderCallback = false;

            this.cleanDeviceOrder();
            this.updateDevicesOrderArray();

            this.doOrderCallback = true;

            // Updated Panel information
            this.updatePanel();

            // Build main popout menu
            this.rebuildPopupMenu();

            // Connect signals for changes
            try {
                this._onAnnouncedNameChanged = this.kdecProxy.connectSignal("announcedNameChanged", this.onAnnouncedNameChanged.bind(this));
                this._onDeviceListChanged = this.kdecProxy.connectSignal("deviceListChanged", this.onDeviceListChanged.bind(this));
            } catch (error) {
                KDEConnectApplet.LOGGER.error("Error while connecting callbacks for DBus signals", error);
            }

            KDEConnectApplet.LOGGER.debug("Entered Available State!");
        } else {
            KDEConnectApplet.LOGGER.warn("enterAvailableState called from available state, this shouldn't happen!");
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

            this.doOrderCallback = false;

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

            if (this.serviceOnBus == false) {
                // Add menu item to tell the user, that KDE Connect is currently unavailable to the applet
                let kdecNotFoundMenuItem = new PopupMenu.PopupMenuItem(_("KDE Connect not available, make sure it's installed and running."), { reactive: false });
                kdecNotFoundMenuItem.actor.add_style_pseudo_class('insensitive');
                this.popupMenu.addMenuItem(kdecNotFoundMenuItem);
                this.set_applet_tooltip(_("KDE Connect not available, make sure it's installed and running."), false);
                this.set_applet_label("");

                // Reload Applet button
                let reloadAppletMenuItem = new PopupMenu.PopupIconMenuItem(_("Reload Applet"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
                reloadAppletMenuItem._signals.connect(reloadAppletMenuItem, "activate", this.reloadApplet.bind(this));
                this.contextMenuSection.addMenuItem(reloadAppletMenuItem);
            } else if (this.validVersion == false) {
                // Add menu item to tell the user, that KDE Connect is currently unavailable to the applet
                let kdecVersionInvalidMenuItem = new PopupMenu.PopupMenuItem(_("Invalid KDE Connect version returned!"), { reactive: false });
                let kdecVersionInvalidMenuItemTooltip = new Tooltips.Tooltip(kdecVersionInvalidMenuItem.actor, _("The KDE Connect DBus service returned an invalid version, please try reloading the Applet!"));
                kdecVersionInvalidMenuItem.actor.add_style_pseudo_class('insensitive');
                this.popupMenu.addMenuItem(kdecVersionInvalidMenuItem);
                this.set_applet_tooltip(_("The KDE Connect DBus service returned an invalid version, please try reloading the Applet!"), false);
                this.set_applet_label("");

                // Reload Applet button
                let reloadAppletMenuItem = new PopupMenu.PopupIconMenuItem(_("Reload Applet"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
                reloadAppletMenuItem._signals.connect(reloadAppletMenuItem, "activate", this.reloadApplet.bind(this));
                this.popupMenu.addMenuItem(reloadAppletMenuItem);
            }

            KDEConnectApplet.LOGGER.debug("Enterted Unavailable State!");
        } else {
            KDEConnectApplet.LOGGER.warn("enterUnavailableState called from unavailable state, this shouldn't happen!");
        }
    }

    /**
     * Functions to update/recreate certain parts of the applet
     */

    /**
     * Rebuilds the main popup menu, but doesn't clear it beforehand
     */
    rebuildPopupMenu() {
        try {
            // If there is at least one device
            let noDevices = true;

            // Get new menu items from device objects
            for (let [deviceID, device] of Object.entries(this.devices)) {
                device.rebuildMenuItem();
                noDevices = false;
            }

            // Remove leftover menu items from e.g. unavailable state
            this.popupMenu.removeAll();

            if (noDevices == true) {
                // We don't have any devices to show, so we add a placeholder menu item
                let noDevicesMenuItem = new PopupMenu.PopupMenuItem(_("No connected Devices!") + "\n" + _("Add them in the KDE Connect settings"), { reactive: false });
                noDevicesMenuItem.actor.add_style_pseudo_class('insensitive');
                this.popupMenu.addMenuItem(noDevicesMenuItem);
                return;
            }

            let unavailableDevices = []
            let availableDevices = []

            this.deviceOrder.forEach(element => {
                KDEConnectApplet.LOGGER.debug(`Checking device with ID '${element["id"]}'...`);
                if (this.devices[element["id"]].getReachableStatus() == true) {
                    availableDevices.push(element["id"]);
                } else {
                    unavailableDevices.push(element["id"]);
                }
            });

            unavailableDevices.forEach(deviceID => {
                KDEConnectApplet.LOGGER.debug(`Device with ID '${deviceID}' is not reachable.`);
                this.popupMenu.addMenuItem(this.devices[deviceID].getMenuItem());
            });

            availableDevices.forEach(deviceID => {
                KDEConnectApplet.LOGGER.debug(`Device with ID '${deviceID}' is reachable.`);
                this.popupMenu.addMenuItem(this.devices[deviceID].getMenuItem());
            });
        } catch (error) {
            KDEConnectApplet.LOGGER.error("Error while rebuilding popup menu", error);
        }
    }

    /**
     * Clears and the rebuilds the added section of the context menu
     */
    rebuildContextMenu() {
        KDEConnectApplet.LOGGER.debug("Rebuilding Context Menu Section...");

        // Remove all previously present items from context menu section
        this.contextMenuSection.removeAll();

        // DEBUG: Debug/Test menu items
        try {
            if (Utils.DEBUG_FEATURES == true) {
                // Debug Menu Items
                let debugMenuItemParent = new PopupMenu.PopupSubMenuMenuItem(_("Debug Stuff, don't touch!"));

                let debugIcon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'tools-symbolic', icon_type: St.IconType.SYMBOLIC });

                debugMenuItemParent.addActor(debugIcon, {span: 0, position: 0});

                // Simulate plugins changed signal
                let debugMenuitem1 = new PopupMenu.PopupMenuItem("Manually call 'onDevicePluginsChanged'");
                debugMenuitem1._signals.connect(debugMenuitem1, "activate", () => {
                    try {
                        this.onDevicePluginsChanged();
                    } catch (error) {
                        KDEConnectApplet.LOGGER.error("Error in debug button callback", error);
                    }
                });
                debugMenuItemParent.menu.addMenuItem(debugMenuitem1);

                // Simulate rechable status changed signal
                let debugMenuItem2 = new PopupMenu.PopupMenuItem("Manually call 'onDeviceReachableChanged'");
                debugMenuItem2._signals.connect(debugMenuItem2, "activate", () => {
                    try {
                        this.onDeviceReachableChanged();
                    } catch (error) {
                        KDEConnectApplet.LOGGER.error("Error in debug button callback", error);
                    }
                });
                debugMenuItemParent.menu.addMenuItem(debugMenuItem2);

                // Simulate context menu settings changed signal
                let debugMenuItem3 = new PopupMenu.PopupMenuItem("Manually call 'onContextMenuSettingsChanged'");
                debugMenuItem3._signals.connect(debugMenuItem3, "activate", () => {
                    try {
                        this.onContextMenuSettingsChanged();
                    } catch (error) {
                        KDEConnectApplet.LOGGER.error("Rrror in debug button callback", error);
                    }
                });
                debugMenuItemParent.menu.addMenuItem(debugMenuItem3);

                // Simulate pupup menu settings changed signal
                let debugMenuItem4 = new PopupMenu.PopupMenuItem("Manually call 'onPopupMenuSettingsChanged'");
                debugMenuItem4._signals.connect(debugMenuItem4, "activate", () => {
                    try {
                        this.onPopupMenuSettingsChanged();
                    } catch (error) {
                        KDEConnectApplet.LOGGER.error("Error in debug button callback", error);
                    }
                });
                debugMenuItemParent.menu.addMenuItem(debugMenuItem4);

                // Simulate module settings changed signal
                let debugMenuItem5 = new PopupMenu.PopupMenuItem("Manually call 'onModuleSettingsChanged'");
                debugMenuItem5._signals.connect(debugMenuItem5, "activate", () => {
                    try {
                        this.onModuleSettingsChanged();
                    } catch (error) {
                        KDEConnectApplet.LOGGER.error("Error in debug button callback", error);
                    }
                });
                debugMenuItemParent.menu.addMenuItem(debugMenuItem5);

                // Simulate panel settings changed signal
                let debugMenuItem6 = new PopupMenu.PopupMenuItem("Manually call 'onPanelSettingsChanged'");
                debugMenuItem6._signals.connect(debugMenuItem6, "activate", () => {
                    try {
                        this.onPanelSettingsChanged();
                    } catch (error) {
                        KDEConnectApplet.LOGGER.error("Error in debug button callback", error);
                    }
                });
                debugMenuItemParent.menu.addMenuItem(debugMenuItem6);

                // Simulate device list changed signal
                let debugMenuItem7 = new PopupMenu.PopupMenuItem("Manually call 'onDeviceListChanged'");
                debugMenuItem7._signals.connect(debugMenuItem7, "activate", () => {
                    this.onDeviceListChanged();
                });
                debugMenuItemParent.menu.addMenuItem(debugMenuItem7);

                this.contextMenuSection.addMenuItem(debugMenuItemParent);

            }
        } catch (error) {
            KDEConnectApplet.LOGGER.error("Error while creating debug menu items", error);
        }

        // Menu Item showing the KDE Connect version
        if (this.options.showKDEConnectVersion == true) {
            this.kdecVersionMenuItem = new PopupMenu.PopupIconMenuItem(
                _("KDE Connect Version: {version}").replace("{version}", this.KDEConnectVersionString),
                "help-info-symbolic",
                St.IconType.SYMBOLIC,
                {
                    sensitive: false,
                }
            );
            this.contextMenuSection.addMenuItem(this.kdecVersionMenuItem);
        }

        // Menu Item showing the ID of this device
        if (this.options.showOwnID == true) {
            let ownIDMenuItem = new PopupMenu.PopupIconMenuItem(_("Own ID: {own_id}").replace("{own_id}", this.ownIDString), "tag-symbolic", St.IconType.SYMBOLIC);
            ownIDMenuItem._signals.connect(ownIDMenuItem, "activate", function (menuItem, keepMenu) {
                Utils.copyAndNotify(this.notificationSource, this.ownIDString, _("own ID"));
            }, this);
            let ownIDMenuItemTooltip = new Tooltips.Tooltip(ownIDMenuItem.actor, _("Click to copy own ID"));
            this.contextMenuSection.addMenuItem(ownIDMenuItem);
        }

        // Reload Applet button
        let reloadAppletMenuItem = new PopupMenu.PopupIconMenuItem(_("Reload Applet"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
        reloadAppletMenuItem._signals.connect(reloadAppletMenuItem, "activate", this.reloadApplet.bind(this));
        this.contextMenuSection.addMenuItem(reloadAppletMenuItem);

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
        KDEConnectApplet.LOGGER.debug("Updating panel information...");

        // Update Applet Icon
        if (this.options.useCustomIcon == false) {
            // Use default icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(Utils.DefaultIcons[this.options.iconType]);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(Utils.DefaultIcons[this.options.iconType]);
            } else {
                KDEConnectApplet.LOGGER.error(`Invalid icon type: '${this.options.iconType}'`);
            }
        } else {
            // Use custom icon
            if (this.options.iconType == "COLOR") {
                this.set_applet_icon_name(this.options.customIcon);
            } else if (this.options.iconType == "SYMBOLIC") {
                this.set_applet_icon_symbolic_name(this.options.customIcon);
            } else {
                KDEConnectApplet.LOGGER.error(`Invalid icon type: '${this.options.iconType}'`);
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
                this.set_applet_tooltip(this.metadata.name + "\n" + _("No available devices"));
            } else if (deviceCount == 1) {
                this.set_applet_tooltip(this.metadata.name + "\n" + _("{deviceCount} available device").replace("{deviceCount}", 1));
            } else {
                this.set_applet_tooltip(this.metadata.name + "\n" + _("{deviceCount} available devices").replace("{deviceCount}", deviceCount));
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
        KDEConnectApplet.LOGGER.debug("Plugin list of a device changed!");

        // Plugins of a device changed, we need to recreate the modules and rebuilt the popup menu

        for (let [deviceID, device] of Object.entries(this.devices)) {
            device.removeAllModules();
            device.createModules();
        }

        this.rebuildPopupMenu();
    }

    /**
     * Callback that gets called, if the reachable state of a device change
     */
    onDeviceReachableChanged() {
        KDEConnectApplet.LOGGER.debug("Reachable status of a device changed!");

        // Reachable state of a device changed, we need to rebuilt the popup menu
        this.rebuildPopupMenu();
    }

    /**
     * Callback that gets called, if the name of a device change
     */
    onDeviceNameChanged() {
        KDEConnectApplet.LOGGER.debug("Name of a device changed!");

        // Update settings order list
        this.doOrderCallback = false;

        // Clean settings device list, we don't(shouldn't) need to regenerate the order array,
        // as we only have a name change, so the cleaning procedure will only update the name in the settings
        this.cleanDeviceOrder();

        this.doOrderCallback = true;
    }

    /**
     * Callback that gets called, when a setting related to the context menu changes
     * @param {*} value - The new value
     * @param {string} option - The option that changed
     */
    onContextMenuSettingsChanged(value, option) {
        KDEConnectApplet.LOGGER.debug("Settings related to the context menu changed!");

        this.rebuildContextMenu();
    }

    /**
     * Callback that gets called, when a setting related to the popup menu changes
     * @param {*} value - The new value
     * @param {string} option - The option that changed
     */
    onPopupMenuSettingsChanged(value, option) {
        KDEConnectApplet.LOGGER.debug("Settings related to the main popup menu changed!");

        this.rebuildPopupMenu();
    }

    /**
     * Callback that gets called, when a setting related to a module changes
     * @param {*} value - The changed value
     * @param {string} option - The option that changed
     * @param {string} moduleID - The ID of the module
     */
    onModuleSettingsChanged(value, option, moduleID) {
        KDEConnectApplet.LOGGER.debug("Settings related to modules changed!");

        // Settings for a module changed, for simplicity, we simply recreate the modules and rebuilt the popup menu

        for (let [deviceID, device] of Object.entries(this.devices)) {
            device.removeAllModules();
            device.createModules();
        }

        KDEConnectApplet.LOGGER.trace("After recreating devices!");

        this.rebuildPopupMenu();
    }

    /**
     * Callback that gets called, when a setting related to the panel changes
     * @param {*} value - The new value
     * @param {string} option - The option that changed
     */
    onPanelSettingsChanged(value, option) {
        KDEConnectApplet.LOGGER.debug("Settings related to the panel changed!");

        if (option == "customIcon" && this.options.useCustomIcon != true) {
            return;
        }
        this.updatePanel();
    }

    onModulesOrderChanged(new_value, optionName) {
        if (this.doOrderCallback == true && (JSON.stringify(new_value) !== JSON.stringify(this.orderValueCache[optionName]))) {
            KDEConnectApplet.LOGGER.debug(`Module Order '${optionName}' has changed, updating everything...`);

            // Update cache
            this.orderValueCache[optionName] = new_value;

            // Update enabled state from the list widgets
            this.options.infoModules.forEach(entry => {
                this.options.modules[entry["id"]].enabled = entry["enabled"]
            });

            this.options.actionModules.forEach(entry => {
                this.options.modules[entry["id"]].enabled = entry["enabled"]
            });

            // Update order arrays, since the order of the modules could have changed
            this.updateModuleOrderArrays();

            KDEConnectApplet.LOGGER.trace(`Info Module Order Array: ${JSON.stringify(this.moduleOrders[Modules.ModuleType.INFO])}`);

            // Since the enabled state may have changed, we need to call the onModuleSettingsChanged callback, so the modules get recreated
            this.onModuleSettingsChanged();
        }
    }

    onDeviceOrderChanged(new_value, optionName) {
        if (this.doOrderCallback == true && (JSON.stringify(new_value) !== JSON.stringify(this.orderValueCache[optionName]))) {
            KDEConnectApplet.LOGGER.debug("Device Order has changed, updating everything...");

            // Update cache
            this.orderValueCache[optionName] = new_value;

            this.updateDevicesOrderArray();

            KDEConnectApplet.LOGGER.trace(`Device Order Array: ${JSON.stringify(this.deviceOrder)}`);

            // Update popup menu, since the order of devices could have chaanged, so the order of menu items need to be changed
            this.rebuildPopupMenu();
        }
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
        KDEConnectApplet.LOGGER.debug("NameOwnerChanged Callback called!");

        if (name == Utils.KDECONNECT_DBUS_NAME) {
            KDEConnectApplet.LOGGER.info(`NameOwnerChanged Signal: ${name} | ${old_owner} -> ${new_owner}`);
            if (new_owner != "") {
                // Found KDE Connect DBus service

                KDEConnectApplet.LOGGER.debug("KDE Connect DBus service found on session bus!");

                this.serviceOnBus = true;

                // Enter Available State
                this.enterAvailableState();
            } else if (old_owner != "" && new_owner == "") {
                // KDE Connect DBus service unregistered from DBus
                KDEConnectApplet.LOGGER.debug("KDE Connect DBus service unregistered from session bus!");

                this.serviceOnBus = false;

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
        KDEConnectApplet.LOGGER.debug(`AnnouncedNameChanged Signal: ${name}`);
    }

    /**
     * Callback for the DBus signal 'DeviceListChanged'
     * @param {Gio.DBusProxy} proxy 
     * @param {*} sender 
     */
    onDeviceListChanged(proxy, sender) {
        KDEConnectApplet.LOGGER.debug("Device list changed!");

        // Device List changed, we need to recreate the internal device list

        // Remove all devices and disconnect signals, etc.
        this.removeAllDevices();

        // Get Device Map from KDE Connect proxy
        this.devices = this.getDeviceMap();

        this.doOrderCallback = false;

        // Clean settings device list and regenerate order array
        this.cleanDeviceOrder();
        this.updateDevicesOrderArray();

        this.doOrderCallback = true;

        // Updated Panel information
        this.updatePanel();

        // Build main popout menu
        this.rebuildPopupMenu();
    }

    /**
     * Other functions
     */

    /**
     * Cleans a specified OrderList of Modules from unwated modules and adds missing ones at the end with default values
     * @param {object[]} settingsList 
     * @param {string[]} modulesList 
     * @returns The cleaned settingsList
     */
    cleanModuleList(settingsList, modulesList) {
        let cleanedSettingsList = []
        let containsModule = {}

        // Initialize the contains flag to false for all module IDs
        modulesList.forEach(moduleID => {
            containsModule[moduleID] = false;
        });

        // Remove all unwanted modules
        settingsList.forEach(entry => {
            if (modulesList.includes(entry["id"])) {
                // The module is valid, so we keep it
                entry["name"] = Modules.moduleClasses[entry["id"]].DISPLAY_NAME
                cleanedSettingsList.push(entry);
                containsModule[entry["id"]] = true;
            }
        });

        // Add missing modules
        modulesList.forEach(moduleID => {
            if (containsModule[moduleID] == false) {
                KDEConnectApplet.LOGGER.debug(`Dsiplay Name for ${moduleID}: ${Modules.moduleClasses[moduleID].DISPLAY_NAME}`);
                let entry = {
                    "enabled": true,
                    "id": moduleID,
                    "name": Modules.moduleClasses[moduleID].DISPLAY_NAME
                };

                cleanedSettingsList.push(entry);
            }
        });

        return cleanedSettingsList;
    }

    /**
     * Cleans the settings OrderList by removing unknown devices, adding missing ones and updating the names
     */
    cleanDeviceOrder() {
        let cleanedDeviceSettingsList = [];
        let containsDevice = {};

        let deviceIDs = Object.keys(this.devices);

        // Initialize the contains flag to false for all module IDs
        deviceIDs.forEach(deviceID => {
            containsDevice[deviceID] = false;
        });

        // Filter out bad devices
        this.options.deviceOrder.forEach(entry => {
            if (deviceIDs.includes(entry["uuid"]) == true) {
                entry["name"] = this.devices[entry["uuid"]].getName()
                cleanedDeviceSettingsList.push(entry);
                containsDevice[entry["uuid"]] = true;
            }
        });

        // Add missing devices with default values
        deviceIDs.forEach(deviceID => {
            if (containsDevice[deviceID] == false) {
                let entry = {
                    "expand": false,
                    "uuid": deviceID,
                    "name": this.devices[deviceID].getName()
                };

                cleanedDeviceSettingsList.push(entry);
            }
        });

        this.options.deviceOrder = cleanedDeviceSettingsList;
    }

    updateModuleOrderArrays() {
        this.moduleOrders[Modules.ModuleType.INFO] = []
        this.moduleOrders[Modules.ModuleType.ACTION] = []

        this.options.infoModules.forEach(entry => {
            this.moduleOrders[Modules.ModuleType.INFO].push(entry["id"])
        });

        this.options.actionModules.forEach(entry => {
            this.moduleOrders[Modules.ModuleType.ACTION].push(entry["id"])
        });
    }

    updateDevicesOrderArray() {
        this.deviceOrder = []

        this.options.deviceOrder.forEach(entry => {
            this.deviceOrder.push({
                "expand": entry["expand"],
                "id": entry["uuid"]
            })
        });
    }

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
            KDEConnectApplet.LOGGER.error("Error while getting list of devices", error);
        }

        deviceIDs.forEach(deviceID => {
            let newDevice = new Device(this, deviceID, deviceNames[deviceID], this.compatMode, this.moduleOrders);

            // Bind signal to onDeviceDataChanged function of the applet
            newDevice._signals.connect(newDevice, "plugins-changed", this.onDevicePluginsChanged, this);
            newDevice._signals.connect(newDevice, "reachable-changed", this.onDeviceReachableChanged, this);
            newDevice._signals.connect(newDevice, "name-changed", this.onDeviceNameChanged, this);

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
                    // Version == 1.3
                    return 0;
                } else if (versionArray[1] > 3) {
                    // Version >= 1.4
                    return 1;
                }
            } else if (versionArray[0] == 21) {
                // Version == 21.x.x
                return 2;
            } else if (versionArray[0] > 21) {
                // Version > 21.x.x
                return 3;
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
            KDEConnectApplet.LOGGER.warn(`No option entry found for module with ID '${moduleID}'!`);
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
     */
    registerModuleSettings(modules) {
        modules.forEach(moduleID => {
            this.options.modules[moduleID] = {};

            // Register any additional settings to also call onModuleSettingsChanged,
            // since we need to rebuild the context manu anyway and the user shouldn't have the popup menu open when changing settings
            if (Modules.moduleClasses[moduleID].ADDITIONAL_SETTINGS) {
                Modules.moduleClasses[moduleID].ADDITIONAL_SETTINGS.forEach(key => {
                    this.settings.bindWithObject(this.options.modules[moduleID], `module_${moduleID}_${key}`, key, this.onModuleSettingsChanged.bind(this), moduleID);
                })
            }
        });
    }

    /**
     * Opens the KDE Connect configuration
     */
    openKDECConfiguration() {
        // Try to open the KDE Connect settings via different commands
        const tryOpenCommands = () => {
            const commands = ["kdeconnect-settings", "kcmshell5 kcm_kdeconnect", "kcmshell6 kcm_kdeconnect"]
            for (const command of commands) {
                KDEConnectApplet.LOGGER.trace(`Trying command '${command}' to open KDE Connect Configuration...`);
                try {
                    Util.trySpawnCommandLine(command);
                    KDEConnectApplet.LOGGER.debug("Opened KDE Connect Configuration via command!");
                    return;
                } catch (error) {
                    KDEConnectApplet.LOGGER.warn("Spawning command failed with error: " + error);
                    continue;
                }
            }
            KDEConnectApplet.LOGGER.error("Could not open the KDE Connect Configuration!");
        }

        try {
            // Depending on KDE Connect version and environment, different methods for opening the setting are required
            if (1 < this.compatMode.versionLevel/*  && this.compatMode.versionLevel < 3 */) {
                if (this.kdecProxy) {
                    this.kdecProxy.openConfigurationRemote((returnValue, errorObj) => {
                        if (errorObj === null) {
                            KDEConnectApplet.LOGGER.debug("Opened KDE Connect Configuration via DBus!");
                        } else {
                            KDEConnectApplet.LOGGER.warn("Count not open the KDE Connect Configuration using DBus, trying commands...");
                            tryOpenCommands();
                        }
                    });
                }
            } else {
                tryOpenCommands();
            }
        } catch (error) {
            KDEConnectApplet.LOGGER.error("Error while opening KDE Connect configuration", error);
        }
    }

    /**
     * Reloads the Applet
     */
    reloadApplet() {
        KDEConnectApplet.LOGGER.info("Reloading Applet...");

        if (this.popupMenu) {
            this.popupMenu.close();
        }

        try {
            Extension.reloadExtension(this.metadata["uuid"], Extension.Type.APPLET);
        } catch (error) {
            KDEConnectApplet.LOGGER.error("Error while reloading extension", error);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new KDEConnectApplet(metadata, orientation, panel_height, instance_id);
}
