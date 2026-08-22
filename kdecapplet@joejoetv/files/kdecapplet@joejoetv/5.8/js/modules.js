const PopupMenu = require("ui.popupMenu");
const MessageTray = require("ui.messageTray");
const Tooltips = require("ui.tooltips");
const SignalManager = require("misc.signalManager");
const Gio = require("gi.Gio");
const St = require("gi.St");
const GLib = require("gi.GLib");
const Lang = require("lang");
const Gettext = require("gettext");
const Signals = require("signals");

const Utils = require("./js/utils.js");
const Dialogs = require("./js/dialogs.js");
const Logging = require("./js/logging.js");
const Ui = require("./js/ui.js");

const LOGGER = new Logging.Logger(Utils.UUID);

const DeviceOldBatteryInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.battery"> \
        <signal name="stateChanged"> \
            <arg name="charging" type="b" direction="out" /> \
        </signal> \
        <signal name="chargeChanged"> \
            <arg name="charge" type="i" direction="out" /> \
        </signal> \
        <method name="charge"> \
            <arg type="i" direction="out" /> \
        </method> \
        <method name="isCharging"> \
            <arg type="b" direction="out" /> \
        </method> \
    </interface> \
</node>';
const DeviceOldBatteryProxy = Gio.DBusProxy.makeProxyWrapper(DeviceOldBatteryInterface);

const DeviceBatteryInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.battery"> \
        <property name="charge" type="i" access="read" /> \
        <property name="isCharging" type="b" access="read" /> \
        <signal name="refreshed"> \
            <arg name="isCharging" type="b" direction="out" /> \
            <arg name="charge" type="i" direction="out" /> \
        </signal> \
    </interface> \
</node>';
const DeviceBatteryProxy = Gio.DBusProxy.makeProxyWrapper(DeviceBatteryInterface);


/**
 * Utility classes for modules
 */

/**
 * Class for translating different dbus interfaces for the battery module to one common interface
 */
class BatteryUniversalProxy {
    static LOGGER = new Logging.Logger(Utils.UUID, "BatteryUniversalProxy");

    constructor(deviceID, compatMode) {

        this.compatMode = compatMode

        BatteryUniversalProxy.LOGGER.debug("Creating new Object of proxy class");

        try {
            switch (this.compatMode.versionLevel) {
                case 0: // Version 1.3
                case 1: // Version 1.4
                    this.proxy = new DeviceOldBatteryProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${deviceID}`);
                    this._onChargeChanged = this.proxy.connectSignal("chargeChanged", this.onChargeChanged.bind(this));
                    this._onStateChanged = this.proxy.connectSignal("stateChanged", this.onStateChanged.bind(this));
                    break;

                default: // Newer Versions
                    this.proxy = new DeviceBatteryProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${deviceID}/battery`);
                    this._onRefreshed = this.proxy.connectSignal("refreshed", this.onRefreshed.bind(this));
                    break;
            }
        } catch (error) {
            BatteryUniversalProxy.LOGGER.error("Error while creating DBus proxy for the battery module", error);
        }
    }

    getCharge() {
        switch (this.compatMode.versionLevel) {
            case 0: // Version 1.3
            case 1: // Version 1.4
                let charge = -1;

                try {
                    charge = this.proxy.chargeSync()[0];
                } catch (error) {
                    BatteryUniversalProxy.LOGGER.error("Error while getting charge from DBus service", error);
                }

                return charge;

            default: // Newer Versions
                return this.proxy.charge;
        }
    }

    getChargingState() {
        switch (this.compatMode.versionLevel) {
            case 0: // Version 1.3
            case 1: // Version 1.4
                let isCharging = false;

                try {
                    isCharging = this.proxy.isChargingSync()[0];
                } catch (error) {
                    BatteryUniversalProxy.LOGGER.error("Error while getting charging state from DBus service", error);
                }

                return isCharging;

            default: // Newer Versions
                return this.proxy.isCharging;
        }
    }

    /**
     * Callbacks for old interface
     */

    onStateChanged(proxy, sender, [isCharging]) {
        let charge = this.getCharge();

        this.emit("refreshed", isCharging, charge);
    }

    onChargeChanged(proxy, sender, [charge]) {
        let isCharging = this.getChargingState();

        this.emit("refreshed", isCharging, charge);
    }

    /**
     * Callbacks for new interface
     */

    onRefreshed(proxy, sender, [isCharging, charge]) {
        BatteryUniversalProxy.LOGGER.debug(`Refresh! charge=${charge} isCharging=${isCharging}`);
        this.emit("refreshed", isCharging, charge);
    }

    destroy() {
        // Emit desctory signal to inform other classes
        this.emit("destroy");

        if (this.proxy) {
            switch (this.compatMode.versionLevel) {
                case 0: // Version 1.3
                case 1: // Version 1.4
                    if (this._onChargeChanged) {
                        this.proxy.disconnectSignal(this._onChargeChanged);
                    }

                    if (this._onStateChanged) {
                        this.proxy.disconnectSignal(this._onStateChanged);
                    }
                    
                default: // Newer Versions
                    if (this._onRefreshed) {
                        this.proxy.disconnectSignal(this._onRefreshed);
                    }
                    break;
            }

            // Delete reference
            this.proxy = null
        }
    }
}
Signals.addSignalMethods(BatteryUniversalProxy.prototype);

const DeviceConnectivityInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.connectivity_report"> \
        <property name="cellularNetworkType" type="s" access="read" /> \
        <property name="cellularNetworkStrength" type="i" access="read" /> \
        <signal name="refreshed"> \
            <arg name="cellularNetworkType" type="s" direction="out" /> \
            <arg name="cellularNetworkStrength" type="i" direction="out" /> \
        </signal> \
    </interface> \
</node>';
const DeviceConnectivityProxy = Gio.DBusProxy.makeProxyWrapper(DeviceConnectivityInterface);

const DeviceFindMyPhoneInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.findmyphone"> \
        <method name="ring"> \
        </method> \
    </interface> \
</node>';
const DeviceFindMyPhoneProxy = Gio.DBusProxy.makeProxyWrapper(DeviceFindMyPhoneInterface);

const DeviceRequestPhotoInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.photo"> \
        <signal name="photoReceived"> \
            <arg name="fileName" type="s" direction="out" /> \
        </signal> \
        <method name="requestPhoto"> \
            <arg name="fileName" type="s" direction="in" /> \
        </method> \
    </interface> \
</node>';
const DeviceRequestPhotoProxy = Gio.DBusProxy.makeProxyWrapper(DeviceRequestPhotoInterface);

const DevicePingInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.ping"> \
        <method name="sendPing"> \
        </method> \
        <method name="sendPing"> \
            <arg name="customMessage" type="s" direction="in" /> \
        </method> \
    </interface> \
</node>';
const DevicePingProxy = Gio.DBusProxy.makeProxyWrapper(DevicePingInterface);

const DeviceShareInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.share"> \
        <signal name="shareReceived"> \
            <arg name="url" type="s" direction="out" /> \
        </signal> \
        <method name="shareUrl"> \
            <arg name="url" type="s" direction="in" /> \
        </method> \
        <method name="shareUrls"> \
            <arg name="urls" type="as" direction="in" /> \
        </method> \
        <method name="shareText"> \
            <arg name="text" type="s" direction="in" /> \
        </method> \
        <method name="openFile"> \
            <arg name="file" type="s" direction="in" /> \
        </method> \
    </interface> \
</node>';
const DeviceShareProxy = Gio.DBusProxy.makeProxyWrapper(DeviceShareInterface);

const DeviceSFTPInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.sftp"> \
        <signal name="mounted"> \
        </signal> \
        <signal name="unmounted"> \
        </signal> \
        <method name="mount"> \
        </method> \
        <method name="unmount"> \
        </method> \
        <method name="mountAndWait"> \
            <arg type="b" direction="out"/> \
        </method> \
        <method name="isMounted"> \
            <arg type="b" direction="out"/> \
        </method> \
        <method name="getMountError"> \
            <arg type="s" direction="out"/> \
        </method> \
        <method name="startBrowsing"> \
            <arg type="b" direction="out"/> \
        </method> \
        <method name="mountPoint"> \
            <arg type="s" direction="out"/> \
        </method> \
        <method name="getDirectories"> \
            <arg type="a{sv}" direction="out"/> \
            <annotation name="org.qtproject.QtDBus.QtTypeName.Out0" value="QVariantMap"/> \
        </method> \
    </interface> \
</node> \
';
const DeviceSFTPProxy = Gio.DBusProxy.makeProxyWrapper(DeviceSFTPInterface);

const DeviceSMSInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.sms"> \
        <method name="sendSms"> \
            <arg name="addresses" type="av" direction="in" /> \
            <arg name="textMessage" type="s" direction="in" /> \
            <arg name="attachmentUrls" type="av" direction="in" /> \
        </method> \
        <method name="launchApp"> \
        </method> \
        <method name="requestAttachment"> \
            <arg name="partID" type="x" direction="in" /> \
            <arg name="uniqueIdentifier" type="s" direction="in" /> \
        </method> \
        <method name="getAttachment"> \
            <arg name="partID" type="x" direction="in" /> \
            <arg name="uniqueIdentifier" type="s" direction="in" /> \
        </method> \
    </interface> \
</node>';
const DeviceSMSProxy = Gio.DBusProxy.makeProxyWrapper(DeviceSMSInterface);


const DeviceOldTelephonyInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.telephony"> \
        <method name="sendSms"> \
            <arg name="phoneNumber" type="s" direction="in"/> \
            <arg name="messageBody" type="s" direction="in"/> \
        </method> \
    </interface> \
</node>';
const DeviceOldTelephonyProxy = Gio.DBusProxy.makeProxyWrapper(DeviceOldTelephonyInterface);

const DeviceOldSMSInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.sms"> \
        <method name="launchApp"> \
        </method> \
        <method name="requestAllConversations"> \
        </method> \
        <method name="sendSms"> \
            <arg name="phoneNumber" type="s" direction="in"/> \
            <arg name="messageBody" type="s" direction="in"/> \
        </method> \
    </interface> \
</node>';
const DeviceOldSMSProxy = Gio.DBusProxy.makeProxyWrapper(DeviceOldSMSInterface);

/**
 * Class for translating different dbus interfaces for the sms module to one common interface
 */
class SMSUniversalProxy {
    static LOGGER = new Logging.Logger(Utils.UUID, "SMSUniversalProxy");

    constructor(deviceID, compatMode) {

        this.compatMode = compatMode

        try {
            switch (this.compatMode.versionLevel) {
                case 0: // Version 1.3
                    this.proxy = new DeviceOldTelephonyProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${deviceID}/telephony`);
                    break;
                case 1: // Version 1.4
                    this.proxy = new DeviceOldSMSProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${deviceID}/sms`);
                    break;

                default: // Newer Versions
                    this.proxy = new DeviceSMSProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${deviceID}/sms`);
                    break;
            }
        } catch (error) {
            SMSUniversalProxy.LOGGER.error("Error while creating DBus proxy for the battery module", error);
        }
    }

    getAppSupported() {
        if (this.compatMode.versionLevel == 0) {
            // Version 1.3
            return false;
        } else {
            // Newer Versions
            return true;
        }
    }

    launchApp() {
        try {
            switch (this.compatMode.versionLevel) {
                case 0: // Version 1.3, Launching App is not supported
                    SMSUniversalProxy.LOGGER.warn("Tried launching the SMS app with a KDE Connect version, that doesn't support it!");
                    return false;
                default: // Version 1.4 and up
                    this.proxy.launchAppSync();
                    return true;
            }
        } catch (error) {
            SMSUniversalProxy.LOGGER.error("Error while launching KDE Connect SMS App", error);
            return false;
        }
    }

    sendSMS(phoneNumber, message) {
        try {
            switch (this.compatMode.versionLevel) {
                case 0: // Version 1.3
                case 1: // Version 1.4
                    this.proxy.sendSmsSync(phoneNumber, message);
                    return true;
            
                default: // Newer versions
                    let addressVariant = new GLib.Variant('(s)', [phoneNumber]);
    
                    this.proxy.sendSmsSync([addressVariant], message, []);
                    return true;
            }
        } catch (error) {
            SMSUniversalProxy.LOGGER.error("Error while sending SMS", error);
            return false;
        }
    }

    destroy() {
        // Emit desctory signal to inform other classes
        this.emit("destroy");

        if (this.proxy) {
            // Delete reference
            this.proxy = null
        }
    }
}
Signals.addSignalMethods(SMSUniversalProxy.prototype);

// l10n support
Gettext.bindtextdomain(Utils.UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(Utils.UUID, str);
}


// Type of the Module, specifies if and where it its menu items are added
var ModuleType = {
    INFO: 0,
    ACTION: 1,
    PASSIVE: 2
}

/**
 * Module base class
 */
class KDECModule {

    // KDE Connect plugins required to be loaded, that the applet is created
    static REQUIRED_KDEC_PLUGINS = [];

    // ID that identifies the module
    static MODULE_ID = "";

    // Display name to display in settings
    static DISPLAY_NAME = "Module";

    // This field is not directly used, but is here, such that the `cinnamon-xlet-makepot` can pick up
    // the display names to translate. It should always use the same string as DISPLAY_NAME
    static _DUMMY_TRANSLATED_NAME = _("Module");

    // Array of additional settings keys to bind
    static ADDITIONAL_SETTINGS = [];

    // Type of the module (ModuleType)
    static TYPE = ModuleType.PASSIVE;

    constructor(id, type, device, compatMode) {
        // Have to be set by subclass
        this.id = id;
        this.type = type;

        // Signal manager to manage singals connected in the applet
        this._signals = new SignalManager.SignalManager(null);

        this._logger = new Logging.Logger(Utils.UUID, `dev:${device.getID()}|${id}`);

        this.device = device;
        this.compatMode = compatMode;

        // To be overwritten in derivative class
        /// Menu Item to add to the popup menu
        this.menuItem = null;
        /// Proxy used to get data that the module needs(e.g. DBus proxy, wrapper proxy, etc.)
        this.proxy = null;

        // Get settings for module for convenience
        this.options = this.device.getApplet().getModuleOptions(this.id);

        this._initValues();
        this._createProxy();
        this._createMenuItem();
    }

    /**
     * @returns The ID of the module
     */
    getID() {
        return this.id;
    }

    /**
     * @returns The type of the module
     */
    getType() {
        return this.type;
    }

    /**
     * Initializes default values
     */
    _initValues() {
        // Placeholder for derivative classes
    }

    /**
     * Creates and connects to the proxy
     */
    _createProxy() {
        // Placeholder for derivative classes
    }

    /**
     * Destroys other objects used in/with the menu item
     */
    _destroyMenuItemContent() {
        // Placeholder for derivative classes
    }

    /**
     * Destroys the menu item and related objects and sets it to `null`
     */
    destroyMenuItem() {
        if (this.menuItem !== null) {
            this._destroyMenuItemContent();

            this.menuItem.destroy();
            this.menuItem = null;
        }
    }

    _createMenuItem() {
        // Placeholder for derivative classes
    }

    /**
     * Creates the menu item and returns the new menu item
     * @returns The newly created menu item
     */
    createMenuItem() {
        this._createMenuItem();
        return this.getMenuItem();
    }

    /**
     * Destroys and then recreates the menu item
     * @returns The recreated menu item
     */
    recreateMenuItem() {
        this.destroyMenuItem();
        return this.createMenuItem();
    }

    /**
     * Destroys other objects, etc. related to the module object, like connected signals from the proxy
     */
    _destroyContent() {
        // Placeholder for derivative classes
        this.proxy = null;
    }

    /**
     * Destroys the Module object and all related object
     */
    destroy() {
        // Emit desctory signal to inform other classes
        this.emit("destroy");

        this._logger.debug("Destroy called!");
        this._signals.disconnectAllSignals();

        this._destroyContent();
        this.destroyMenuItem();
    }

    /**
     * Return the menu item of the module or `null` 
     */
    getMenuItem() {
        return this.menuItem;
    }
}
Signals.addSignalMethods(KDECModule.prototype);

/**
 * Modules
 */

/**
 * Module for displaying battery information of the device
 */
class BatteryModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_battery"];
    static MODULE_ID = "battery";
    static DISPLAY_NAME = "Battery Module";
    static _DUMMY_TRANSLATED_NAME = _("Battery Module");
    static ADDITIONAL_SETTINGS = [];
    static TYPE = ModuleType.INFO;

    constructor(device, compatMode) {
        super(BatteryModule.MODULE_ID, BatteryModule.TYPE, device, compatMode);
    }

    _initValues() {
        // Default values
        this.charge = 0;
        this.isCharging = false;
    }

    _createProxy() {
        try {
            this.proxy = new BatteryUniversalProxy(this.device.getID(), this.compatMode);
            
            this.charge = this.proxy.getCharge();
            this.isCharging = this.proxy.getChargingState();

            this._signals.connect(this.proxy, "refreshed",this._onRefreshed.bind(this));
        } catch (error) {
            this._logger.error("Error while connecting to the DBus interface, using default values", error);
        }
    }

    _getBatteryIconName() {
        if (this.charge >= 0 && this.charge <= 100) {
            let chargeLevel = Math.floor(this.charge / 10) * 10;
    
            if (this.isCharging) {
                if (chargeLevel == 100) {
    
                    return `battery-level-${chargeLevel.toString()}-charged-symbolic`;
                } else {
                    return `battery-level-${chargeLevel.toString()}-charging-symbolic`;
                }
            } else {
                return `battery-level-${chargeLevel}-symbolic`;
            }
        } else {
            return "battery-missing-symbolic";
        }
    }

    _getLabelText() {
        if (this.charge >= 0 && this.charge <= 100) {
            if (this.isCharging) {
                return `${this.charge.toString()}% (${_("Charging")})`;
            } else {
                return `${this.charge.toString()}%`
            }
        } else {
            return "?";
        }
    }

    _onRefreshed(sender, isCharging, charge) {
        this.charge = charge;
        this.isCharging = isCharging;

        if (this.menuItem !== null) {
            this.menuItem.label.set_text(this._getLabelText());
            this.menuItem.setIconSymbolicName(this._getBatteryIconName());
        }
    }

    _createMenuItem() {
        this.menuItem = new PopupMenu.PopupIconMenuItem(this._getLabelText(), this._getBatteryIconName(), St.IconType.SYMBOLIC, {reactive: false});
    }

    _destroyContent() {
        this.proxy.destroy();
    }
}

/**
 * Module for displaying general information about the device
 */
class DeviceInfoModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = [];
    static MODULE_ID = "deviceinfo";
    static DISPLAY_NAME = "Device-Info Module";
    static _DUMMY_TRANSLATED_NAME = _("Device-Info Module");
    static ADDITIONAL_SETTINGS = [];
    static TYPE = ModuleType.INFO;

    constructor(device, compatMode) {
        super(DeviceInfoModule.MODULE_ID, DeviceInfoModule.TYPE, device, compatMode);
    }

    _initValues() {
        // Default values
        this.deviceType = "unknown";
    }
    
    _createProxy() {
        try {
            this._signals.connect(this.device, "type-changed",this._onTypeChanged.bind(this));
        } catch (error) {
            this._logger.error("Error while connecting 'type-changed' signal", error);
        }
    }

    _onTypeChanged(deviceType) {
        this.deviceType = deviceType;

        if (this.menuItem !== null) {
            this.menuItem.setIconSymbolicName(this._getTypeIconName());
        }
    }

    _getTypeIconName() {
        switch(this.device.getType()) {
            case "desktop":
                return "computer-symbolic";
            case "laptop":
                return "laptop-symbolic";
            case "smartphone":
            case "phone":
                return "phone-symbolic";
            case "tablet":
                return "tablet-symbolic";
            case "tv":
                return "tv-symbolic";
            default:
                return "dialog-question-symbolic";
        }
    }

    _createMenuItem() {
        // Create Menu Item
        this.menuItem = new PopupMenu.PopupIconMenuItem(_("ID: {id}").replace("{id}", this.device.getID().toString()), this._getTypeIconName(), St.IconType.SYMBOLIC);
        
        // Copy ID, when clicked
        this.menuItem._signals.connect(this.menuItem, "activate", function(menuItem, keepMenu) {
            Utils.copyAndNotify(this.device.getApplet().notificationSource, this.device.getID(), _("Device ID"));
        }, this);

        // Show tooltip on hovering
        this.copyIDTooltip = new Tooltips.Tooltip(this.menuItem.actor, _("Click to copy ID"));
    }
}

/**
 * Module for displaying mobile connectivity information of the device
 */
class ConnectivityModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_connectivity_report"];
    static MODULE_ID = "connectivity";
    static DISPLAY_NAME = "Connectivity Module";
    static _DUMMY_TRANSLATED_NAME = _("Connectivity Module");
    static ADDITIONAL_SETTINGS = ["showNetworkType"];
    static TYPE = ModuleType.INFO;

    constructor(device, compatMode) {
        super(ConnectivityModule.MODULE_ID, ConnectivityModule.TYPE, device, compatMode);
    }

    _initValues() {
        // Default values
        this.signalStrength = 0;
        this.networkType = "";
    }

    _createProxy() {
        try {
            this.proxy = new DeviceConnectivityProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${this.device.getID()}/connectivity_report`);
            
            this.signalStrength = this.proxy.cellularNetworkStrength;
            this.networkType = this.proxy.cellularNetworkType;

            this._onRefreshed = this.proxy.connectSignal("refreshed", this.onRefreshed.bind(this));
        } catch (error) {
            this._logger.error("Error while connecting to the DBus interface, using default values", error);
        }
    }

    onRefreshed(proxy, sender, [networkType, networkStrength]) {
        this.networkType = networkType;
        this.signalStrength = networkStrength;

        if (this.menuItem !== null) {
            this.menuItem.label.set_text(this._getLabelText());
            this.menuItem.setIconSymbolicName(this._getConnectivityIconName());
        }
    }

    _getConnectivityIconName() {
        // Signal strength is in range 0 - 4

        switch (this.signalStrength) {
            case 0:
                return "network-cellular-signal-none-symbolic";
            case 1:
                return "network-cellular-signal-low-symbolic";
            case 2:
                return "network-cellular-signal-ok-symbolic";
            case 3:
                return "network-cellular-signal-good-symbolic";
            case 4:
                return "network-cellular-signal-excellent-symbolic";
        
            default:
                return "network-cellular-no-route-symbolic";
        }
    }

    _getLabelText() {
        let signalStrengthText = "";

        switch (this.signalStrength) {
            case 0:
                signalStrengthText = _("No Signal");
                break;
            case 1:
                signalStrengthText = _("Low");
                break;
            case 2:
                signalStrengthText = _("Ok");
                break;
            case 3:
                signalStrengthText = _("Good");
                break;
            case 4:
                signalStrengthText = _("Excellent");
                break;
        
            default:
                signalStrengthText = "?";
                break;
        }

        if (this.options.showNetworkType == true && this.signalStrength > 0) {
            let networkText = ""
    
            if (this.networkType == "Unknown") {
                networkText = _("Unknown");
            } else {
                networkText = this.networkType;
            }
    
            return `${signalStrengthText} (${networkText})`;
        } else {
            return signalStrengthText;
        }
    }

    _createMenuItem() {
        this.menuItem = new PopupMenu.PopupIconMenuItem(this._getLabelText(), this._getConnectivityIconName(), St.IconType.SYMBOLIC, {reactive: false});
    }

    _destroyContent() {
        if (this.proxy && this._onRefreshed) {
            this.proxy.disconnectSignal(this._onRefreshed);
        }
    }
}

/**
 * Module that enables letting the device ring, so one can find it if misplaced
 */
class FindMyPhoneModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_findmyphone"];
    static MODULE_ID = "findmyphone";
    static DISPLAY_NAME = "FindMyPhone Module";
    static _DUMMY_TRANSLATED_NAME = _("FindMyPhone Module");
    static ADDITIONAL_SETTINGS = [];
    static TYPE = ModuleType.ACTION;

    constructor(device, compatMode) {
        super(FindMyPhoneModule.MODULE_ID, FindMyPhoneModule.TYPE, device, compatMode);
    }

    _createProxy() {
        try {
            this.proxy = new DeviceFindMyPhoneProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${this.device.getID()}/findmyphone`);
        } catch (error) {
            this._logger.error("Error while connecting to the DBus interface, using default values", error);
        }
    }

    ringDevice() {
        try {
            this.proxy.ringSync();
        } catch (error) {
            this._logger.error("Error calling 'ring' DBus method", error);
        }
    }

    _createMenuItem() {
        this.menuItem = new PopupMenu.PopupIconMenuItem(_("Ring device"), "audio-volume-high-symbolic", St.IconType.SYMBOLIC, {});
        this.menuItemTooltip = new Tooltips.Tooltip(this.menuItem.actor, _("Click to ring the device"));

        this.menuItem._signals.connect(this.menuItem, "activate", this.ringDevice.bind(this));
    }
}

/**
 * Module that allows requesting a photo from the device and save it directly to this device
 */
class RequestPhotoModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_photo"];
    static MODULE_ID = "requestphoto";
    static DISPLAY_NAME = "Request Photo Module";
    static _DUMMY_TRANSLATED_NAME = _("Request Photo Module");
    static ADDITIONAL_SETTINGS = ["saveToDir", "saveDirectory"];
    static TYPE = ModuleType.ACTION;

    constructor(device, compatMode) {
        super(RequestPhotoModule.MODULE_ID, RequestPhotoModule.TYPE, device, compatMode);
    }

    _createProxy() {
        try {
            this.proxy = new DeviceRequestPhotoProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${this.device.getID()}/photo`);

            this._onPhotoReceived = this.proxy.connectSignal("photoReceived", this.onPhotoReceived.bind(this));
        } catch (error) {
            this._logger.error("Error while connecting to the DBus interface, using default values", error);
        }
    }

    requestPhoto() {
        if (this.options.saveToDir == false) {
            Dialogs.openReceivePhotoDialog(this.device.getApplet().metadata, this.device.getName(), this.requestPhotoCallback.bind(this));
        } else {
            // Save directly to directory

            // Build filename from date and time
            let cdate = new Date();
            let filename = "photo_"+cdate.toLocaleDateString().replaceAll(".","-").replaceAll("/","-")+"_"+cdate.toLocaleTimeString().replaceAll(":","-").replaceAll("/","-");
            let filepath = Utils.getAvailableFilename(this.options.saveDirectory, filename, "jpg");

            if (filepath !== null) {
                try {
                    this.proxy.requestPhotoSync(filepath);
                } catch (error) {
                    this._logger.error("Error while calling 'requestPhoto' DBus method", error);
                }
            } else {
                this._logger.error(`Save Path doesn't exist or isn't a directory: ${filepath}`);
            }
        }
    }

    requestPhotoCallback(status, filename, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                try {
                    this.proxy.requestPhotoSync(filename);
                } catch (error) {
                    this._logger.error("Error while calling 'requestPhoto' DBus method", error);
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this._logger.debug("Dialog for selecting photo save location was canceled.");
                break;
        
            default:
                // Error
                this._logger.error("Photo request dialog returned error: "+stderr);
                break;
        }
    }

    onPhotoReceived(proxy, sender, [fileName]) {
        this._logger.debug(`Received Photo from device: ${fileName}`);

        let notificationSource = this.device.getApplet().notificationSource;
        let notification = new MessageTray.Notification(notificationSource, _("Photo received from '{deviceName}'").replace("{deviceName}", this.device.getName()), fileName+"\n"+_("Click to open in default application"));
        notification.setTransient(true);
        this._signals.connect(notification, "clicked", function() {
            Utils.openURL(`file://${fileName}`);
        })
        notificationSource.notify(notification);
    }

    _createMenuItem() {
        this.menuItem = new PopupMenu.PopupIconMenuItem(_("Request Photo"), "camera-photo-symbolic", St.IconType.SYMBOLIC, {});
        this.menuItemTooltip = new Tooltips.Tooltip(this.menuItem.actor, _("Click to request a photo from the device"));

        this.menuItem._signals.connect(this.menuItem, "activate", function() {
            try {
                Dialogs.openReceivePhotoDialog(this.device.getApplet().metadata, this.device.getName(), this.requestPhotoCallback.bind(this));
            } catch (error) {
                this._logger.error("Error while opening photo request dialog", error);
            }
        }, this);
    }

    _destroyContent() {
        if (this.proxy && this._onPhotoReceived) {
            this.proxy.disconnectSignal(this._onPhotoReceived);
        }
    }
}

/**
 * Module that enables sending a ping message to the device
 */
class PingModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_ping"];
    static MODULE_ID = "ping";
    static DISPLAY_NAME = "Ping Module";
    static _DUMMY_TRANSLATED_NAME = _("Ping Module");
    static ADDITIONAL_SETTINGS = ["useCustomMessage", "customMessage"];
    static TYPE = ModuleType.ACTION;

    constructor(device, compatMode) {
        super(PingModule.MODULE_ID, PingModule.TYPE, device, compatMode);
    }

    _createProxy() {
        try {
            this.proxy = new DevicePingProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${this.device.getID()}/ping`);
        } catch (error) {
            this._logger.error("Error while connecting to the DBus interface, using default values", error);
        }
    }

    ping() {
        if (this.options.useCustomMessage == true) {
            try {
                this.proxy.sendPingSync(this.options.customMessage);
            } catch (error) {
                this._logger.error("Error while sending ping message", error);
            }
        } else {
            try {
                this.proxy.sendPingSync(_("Ping!"));
            } catch (error) {
                this._logger.error("Error while sending ping message", error);
            }
        }

        let notificationSource = this.device.getApplet().notificationSource;
        let notification = new MessageTray.Notification(notificationSource, _("Sent ping to device '{deviceName}'").replace("{deviceName}", this.device.getName()));
        notification.setTransient(true);
        notificationSource.notify(notification);
    }

    _createMenuItem() {
        this.menuItem = new PopupMenu.PopupIconMenuItem(_("Ping Device"), "network-transmit-symbolic", St.IconType.SYMBOLIC, {});
        this.menuItemTooltip = new Tooltips.Tooltip(this.menuItem.actor, _("Click to send a ping to the device"));

        this.menuItem._signals.connect(this.menuItem, "activate", this.ping.bind(this));
    }
}

/**
 * Module that allows sharing different kind of media(URLs, Text, File(s)) to the device
 */
class ShareModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_share"];
    static MODULE_ID = "share";
    static DISPLAY_NAME = "Share Module";
    static _DUMMY_TRANSLATED_NAME = _("Share Module");
    static ADDITIONAL_SETTINGS = ["useSubMenu", "enableSendURL", "enableSendText", "enableSendFiles"];
    static TYPE = ModuleType.ACTION;

    constructor(device, compatMode) {
        super(ShareModule.MODULE_ID, ShareModule.TYPE, device, compatMode);
    }

    _createProxy() {
        try {
            this.proxy = new DeviceShareProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${this.device.getID()}/share`);

            this._onShareReceived = this.proxy.connectSignal("shareReceived", this.onShareReceived.bind(this));
        } catch (error) {
            this._logger.error("Error while connecting to the DBus interface, using default values", error);
        }
    }

    sendURLCallback(status, urlText, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                try {
                    this.proxy.shareUrlSync(urlText);
                } catch (error) {
                    this._logger.error("Error while calling 'shareUrl' DBus method", error);
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this._logger.debug("Dialog for entering URL to send was canceled.");
                break;
        
            default:
                // Error
                this._logger.error("Dialog for entering URL to send returned error: "+stderr);
                break;
        }
    }

    sendTextCallback(status, text, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                try {
                    this.proxy.shareTextSync(text);
                } catch (error) {
                    this._logger.error("Error while calling 'shareText' DBus method", error);
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this._logger.debug("Dialog for entering text to send was canceled.");
                break;
        
            default:
                // Error
                this._logger.error("Error while opening dialog for entering text to send: "+stderr);
                break;
        }
    }

    sendFilesCallback(status, filenameArray, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                filenameArray = filenameArray.map(function(filename) {
                    return "file://"+filename
                });

                try {
                    this.proxy.shareUrlsSync(filenameArray);
                } catch (error) {
                    this._logger.error("Error while calling 'shareUrls' DBus method", error);
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this._logger.debug("Dialog for selecting files to send was canceled.");
                break;
        
            default:
                // Error
                this._logger.error("Error while opening dialog for selecting files to send: "+stderr);
                break;
        }
    }

    onShareReceived(proxy, sender, [url]) {
        this._logger.debug(`Received Share from device: ${url}`);

        let notificationSource = this.device.getApplet().notificationSource;
        let notification = new MessageTray.Notification(notificationSource, _("Share received from '{deviceName}'").replace("{deviceName}", this.device.getName()), url+"\n"+_("Click to open in default application"));
        notification.setTransient(true);
        this._signals.connect(notification, "clicked", function() {
            Utils.openURL(url);
        })
        notificationSource.notify(notification);
    }

    _destroyMenuItemContent() {
        if (this.sendURLMenuItem) {
            this.sendURLMenuItem.destroy();
            this.sendURLMenuItem = null;
        }

        if (this.sendTextMenuItem) {
            this.sendTextMenuItem.destroy();
            this.sendTextMenuItem = null;
        }

        if (this.sendFilesMenuItem) {
            this.sendFilesMenuItem.destroy();
            this.sendFilesMenuItem = null;
        }
    }

    _addMenuItem(menuItem) {
        if (this.options.useSubMenu == true) {
            this.menuItem.menu.addMenuItem(menuItem)
        } else {
            this.menuItem.addMenuItem(menuItem)
        }
    }

    _createMenuItem() {
        if (this.options.useSubMenu == true) {
            this.menuItem = new PopupMenu.PopupSubMenuMenuItem(_("Share"));

            // Workaround to add icon, because Cinnamon didn't like me making a PopupMenu class in another file
            this.menuIcon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: "send-to-symbolic", icon_type: St.IconType.SYMBOLIC});
            
            this.menuItem.addActor(this.menuIcon, {span: 0, position: 0});
        } else {
            this.menuItem = new PopupMenu.PopupMenuSection();
        }

        // Create Menu Items
        if (this.options.enableSendURL == true) {
            this.sendURLMenuItem = new PopupMenu.PopupIconMenuItem(_("Send URL"), "link-symbolic", St.IconType.SYMBOLIC, {});
            this.sendURLMenuItemTooltip = new Tooltips.Tooltip(this.sendURLMenuItem.actor, _("Click to send a URL to the device"));

            this.sendURLMenuItem._signals.connect(this.sendURLMenuItem, "activate", function() {
                Dialogs.openSendURLDialog(this.device.getApplet().metadata, this.device.getName(), this.sendURLCallback.bind(this));
            }, this);
            this._addMenuItem(this.sendURLMenuItem);
        }

        if (this.options.enableSendText == true) {
            this.sendTextMenuItem = new PopupMenu.PopupIconMenuItem(_("Send Text"), "text-field", St.IconType.SYMBOLIC, {});
            this.sendTextMenuItemTooltip = new Tooltips.Tooltip(this.sendTextMenuItem.actor, _("Click to send text to the device"));

            this.sendTextMenuItem._signals.connect(this.sendTextMenuItem, "activate", function() {
                Dialogs.openSendTextDialog(this.device.getApplet().metadata, this.device.getName(), this.sendTextCallback.bind(this));
            }, this);
            this._addMenuItem(this.sendTextMenuItem);
        }

        if (this.options.enableSendFiles == true) {
            this.sendFilesMenuItem = new PopupMenu.PopupIconMenuItem(_("Send File(s)"), "emblem-documents-symbolic", St.IconType.SYMBOLIC, {});
            this.sendFilesMenuItemTooltip = new Tooltips.Tooltip(this.sendFilesMenuItem.actor, _("Click to send file(s) to the device"));

            this.sendFilesMenuItem._signals.connect(this.sendFilesMenuItem, "activate", function() {
                Dialogs.openSendFilesDialog(this.device.getApplet().metadata, this.device.getName(), this.sendFilesCallback.bind(this));
            }, this);
            this._addMenuItem(this.sendFilesMenuItem);
        }
    }

    _destroyContent() {
        if (this.proxy && this._onShareReceived) {
            this.proxy.disconnectSignal(this._onShareReceived);
        }
    }
}

/**
 * Module that allows controlling the mounting/unmounting of the remote directories set up on the device
 */
class SFTPModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_sftp"];
    static MODULE_ID = "sftp";
    static DISPLAY_NAME = "SFTP Module";
    static _DUMMY_TRANSLATED_NAME = _("SFTP Module");
    static ADDITIONAL_SETTINGS = ["selectFirstDirectory"];
    static TYPE = ModuleType.ACTION;

    constructor(device, compatMode) {
        super(SFTPModule.MODULE_ID, SFTPModule.TYPE, device, compatMode);
    }

    _initValues() {
        // Default values
        this.mounted = false;
        this.mountPoint = "";
        this.directories = []
    }

    _createProxy() {
        try {
            this.proxy = new DeviceSFTPProxy(Gio.DBus.session, Utils.KDECONNECT_DBUS_NAME, `/modules/kdeconnect/devices/${this.device.getID()}/sftp`);

            this.mounted = this.proxy.isMountedSync()[0];

            if (this.mounted == true) {
                this.mountPoint = this.proxy.mountPointSync()[0];
                try {
                    let dirs = this.proxy.getDirectoriesSync()[0];
                    this.directories = Object.entries(dirs).map(([dir,v]) => [dir, v.get_string()[0]]);
                } catch (error) {
                    this._logger.warn("Available directiories could not be fetched! Falling back to mount point.");
                    this.directories = []
                }
            }

            this._onMounted = this.proxy.connectSignal("mounted", this.onMounted.bind(this));
            this._onUnmounted = this.proxy.connectSignal("unmounted", this.onUnmounted.bind(this));
        } catch (error) {
            this._logger.error("Error while connecting to the DBus interface, using default values", error);
        }
    }

    _getLabelText() {
        if (this.mounted == true) {
            return _("Unmount");
        } else {
            return _("Mount");
        }
    }

    _getItemTooltipText() {
        if (this.mounted == true) {
            return _("Click to unmount");
        } else {
            return _("Click to mount");
        }
    }

    mountOrUnmount() {
        if (this.mounted == true) {
            try {
                this.proxy.unmountSync();
            } catch (error) {
                this._logger.error("Error while calling 'unmount' DBus method", error);
            }
        } else {
            try {
                this.proxy.mountSync();
            } catch (error) {
                this._logger.error("Error while calling 'mount' DBus method", error);
            }
        }
    }

    onMounted(proxy, sender) {
        this.mounted = true;

        if (this.menuItem !== null) {
            this.menuItem.label = this._getLabelText();
            this.menuItem.setTooltipText(this._getItemTooltipText());
            this.menuItem.button_enabled = true;
        }

        try {
            this.mountPoint = this.proxy.mountPointSync()[0];
                try {
                    let dirs = this.proxy.getDirectoriesSync()[0];
                    this.directories = Object.entries(dirs).map(([dir,v]) => [dir, v.get_string()[0]]);
                } catch (error) {
                    this._logger.warn("Available directiories could not be fetched! Falling back to mount point.");
                    this.directories = []
                }
        } catch (error) {
            this._logger.error("Error while getting mount point", error);
        }
    }

    onUnmounted(proxy, sender) {
        this.mounted = false;

        if (this.menuItem !== null) {
            this.menuItem.label = this._getLabelText();
            this.menuItem.setTooltipText(this._getItemTooltipText());
            this.menuItem.button_enabled = false;
        }

        try {
            let mountError = this.proxy.getMountErrorSync()[0];

            if (mountError != "") {
                this._logger.error(`Error while mounting: ${mountError}`);
            }
        } catch (error) {
            this._logger.error("Error while getting error information about mount", error);
        }
    }

    startBrowsing() {
        // NOTE: There is also a DBus method to open the file manager at the mount point, but that is currently broken, at least for me

        if (this.mounted == true) {
            switch (this.directories.length) {
                // If there are no available directories, just open the mount point
                case 0:
                    this._logger.debug(`Opening at mount point (${this.mountPoint})`);
                    Utils.openURL(`file://${this.mountPoint}`);
                    return;
                // If there is one directory, just open that directly
                case 1:
                    this._logger.debug(`Opening only directory (${this.directories[0][0]})`);
                    Utils.openURL(`file://${this.directories[0][0]}`);
                    return;
                // If there are multiple, either ask the user or open the first one (if selected in settings)
                default:
                    if (this.options.selectFirstDirectory) {
                    this._logger.debug(`Opening first directory (${this.directories[0][0]})`);
                        Utils.openURL(`file://${this.directories[0][0]}`);
                        return;
                    }

                    Dialogs.openSelectRemoteDirectoryDialog(
                        this.device.getApplet().metadata,
                        this.device.getName(),
                        this.mountPoint,
                        this.directories,
                        this.openDirectoryCallback.bind(this)
                    );
                    return;
            }
        }
    }

    openDirectoryCallback(status, dirPath, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                try {
                    this._logger.debug(`Opening selected directory (${dirPath})`);
                    Utils.openURL(`file://${dirPath}`);
                } catch (error) {
                    this._logger.error("Error while calling 'shareUrls' DBus method", error);
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this._logger.debug("Dialog for selecting remote directory to open was canceled.");
                break;
        
            default:
                // Error
                this._logger.error("Error while opening dialog for selecting remote directory to open: "+stderr);
                break;
        }
    }

    _createMenuItem() {
        // Create Menu Item
        this.menuItem = new Ui.PopupMenuIconButtonItem(
            this._getLabelText(),
            "network-server-symbolic",
            St.IconType.SYMBOLIC,
            "folder-symbolic",
            St.IconType.SYMBOLIC,
            {
                tooltip_text: this._getItemTooltipText(),
                button_tooltip_text: _("Click to browse files"),
                keep_menu_item_click: true,
            }
        )

        // Disable or enable button based upon read mounted state
        this.menuItem.button_enabled = this.mounted;

        this.menuItem._signals.connect(this.menuItem, "activate", this._onMenuItemActivate.bind(this));
    }

    _onMenuItemActivate(menuItem, event, keepMenu, activationType) {
        if (activationType == Ui.PopupMenuIconButtonItem.ActivateType.ITEM) {
            this.mountOrUnmount();
        } else if (activationType == Ui.PopupMenuIconButtonItem.ActivateType.BUTTON) {
            this.startBrowsing();
        }
    }

    _destroyContent() {
        if (this.proxy) {
            if (this._onMounted) {
                this.proxy.disconnectSignal(this._onMounted);
            }
            if (this._onUnmounted) {
                this.proxy.disconnectSignal(this._onUnmounted);
            }
        }
    }
}

/**
 * Module that allows sending SMS messages using the device and opening the KDE Connect SMS application
 */
class SMSModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_sms"];
    static MODULE_ID = "sms";
    static DISPLAY_NAME = "SMS Module";
    static _DUMMY_TRANSLATED_NAME = _("SMS Module");
    static ADDITIONAL_SETTINGS = ["useSubMenu", "enableSendSMS", "enableLaunchSMSApp"];
    static TYPE = ModuleType.ACTION;

    constructor(device, compatMode) {
        super(SMSModule.MODULE_ID, SMSModule.TYPE, device, compatMode);
    }

    _createProxy() {
        try {
            this.proxy = new SMSUniversalProxy(this.device.getID(), this.compatMode);
        } catch (error) {
            this._logger.error("Error while connecting to the DBus interface, using default values", error);
        }
    }

    _addMenuItem(menuItem) {
        if (this.options.useSubMenu == true) {
            this.menuItem.menu.addMenuItem(menuItem)
        } else {
            this.menuItem.addMenuItem(menuItem)
        }
    }

    launchSMSApp() {
        let successs = this.proxy.launchApp();
    }

    sendSMSCallback(status, SMSObject, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                if (SMSObject["phone_number"] && SMSObject["message"]) {
                    let phoneNumber = SMSObject["phone_number"].replace(" ", "");

                    let success = this.proxy.sendSMS(phoneNumber, SMSObject["message"]);

                    if (success == true) {
                        this._logger.debug(`Sent SMS to '${phoneNumber.toString()}' with message: ${SMSObject["message"].toString()}`);
                    }
                } else {
                    this._logger.error("Got malformed response from dialog. Either 'phone_number' or 'message' is missing!");
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this._logger.debug("Dialog for entering SMS to send was canceled.");
                break;
        
            default:
                // Error
                this._logger.error("SMS dialog reported error: "+stderr);
                break;
        }
    }

    _destroyMenuItemContent() {
        if (this.launchSMSAppMenuItem) {
            this.launchSMSAppMenuItem.destroy();
            this.launchSMSAppMenuItem = null;
        }

        if (this.launchSMSAppMenuItem) {
            this.sendSMSMenuItem.destroy();
            this.sendSMSMenuItem = null;
        }
    }

    _createMenuItem() {
        if (this.options.useSubMenu == true) {
            this.menuItem = new PopupMenu.PopupSubMenuMenuItem(_("SMS"));

            // Workaround to add icon, because Cinnamon didn't like me making a PopupMenu class in another file
            let menuIcon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: "dialog-messages", icon_type: St.IconType.SYMBOLIC});
            
            this.menuItem.addActor(menuIcon, {span: 0, position: 0});
        } else {
            this.menuItem = new PopupMenu.PopupMenuSection();
        }

        // Create Menu Items
        if (this.options.enableLaunchSMSApp == true && this.proxy.getAppSupported() == true) {
            this.launchSMSAppMenuItem = new PopupMenu.PopupIconMenuItem(_("Launch SMS App"), "dialog-messages", St.IconType.SYMBOLIC, {});
            this.launchSMSAppMenuItemTooltip = new Tooltips.Tooltip(this.launchSMSAppMenuItem.actor, _("Click to open the KDE Connect SMS App"));

            this.launchSMSAppMenuItem._signals.connect(this.launchSMSAppMenuItem, "activate", this.launchSMSApp.bind(this));
            this._addMenuItem(this.launchSMSAppMenuItem);
        }

        if (this.options.enableSendSMS == true) {
            this.sendSMSMenuItem = new PopupMenu.PopupIconMenuItem(_("Send SMS"), "chat-message-new-symbolic", St.IconType.SYMBOLIC, {});
            this.sendSMSMenuItemTooltip = new Tooltips.Tooltip(this.sendSMSMenuItem.actor, _("Click to send text to the device"));

            this.sendSMSMenuItem._signals.connect(this.sendSMSMenuItem, "activate", function() {
                Dialogs.openSendSMSDialog(this.device.getApplet().metadata, this.device.getName(), this.sendSMSCallback.bind(this));
            }, this);
            this._addMenuItem(this.sendSMSMenuItem);
        }
    }

    _destroyContent() {
        if (this.proxy) {
            this.proxy.destroy();
        }
    }
}

// Register module classes
let moduleClasses = {}

moduleClasses[BatteryModule.MODULE_ID] = BatteryModule;
moduleClasses[DeviceInfoModule.MODULE_ID] = DeviceInfoModule;
moduleClasses[ConnectivityModule.MODULE_ID] = ConnectivityModule;
moduleClasses[FindMyPhoneModule.MODULE_ID] = FindMyPhoneModule;
moduleClasses[RequestPhotoModule.MODULE_ID] = RequestPhotoModule;
moduleClasses[PingModule.MODULE_ID] = PingModule;
moduleClasses[ShareModule.MODULE_ID] = ShareModule;
moduleClasses[SFTPModule.MODULE_ID] = SFTPModule;
moduleClasses[SMSModule.MODULE_ID] = SMSModule;

// Create array of supported module IDs
// NOTE: Not necessarily sorted correctly
let modules = Object.keys(moduleClasses);

/**
 * Return the subarray of "modules", which fit the type
 * @param {ModuleType} moduleType - The ModuleType to filter
 */
function modulesByType(moduleType) {
    let filteredModules = [];

    LOGGER.trace(`ModuleType: ${moduleType.toString()}`, "modulesByType");

    modules.forEach(moduleID => {
        if (moduleClasses[moduleID].TYPE == moduleType) {
            filteredModules.push(moduleID);
        }
    });

    return filteredModules;
}