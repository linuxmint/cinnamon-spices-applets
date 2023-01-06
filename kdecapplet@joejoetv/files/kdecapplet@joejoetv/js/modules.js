const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const Tooltips = imports.ui.tooltips;
const SignalManager = imports.misc.signalManager;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Gettext = imports.gettext;

const CommonUtils = require("./js/commonUtils.js");
const Dialogs = require("./js/dialogs.js");

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

// l10n support
Gettext.bindtextdomain(CommonUtils.UUID, GLib.get_home_dir() + "/.local/share/locale");

/*
function _(str) {
    return Gettext.dgettext(CommonUtils.UUID, str);
}
*/

// DEBUG
// TODO: Remove
function _(str) {
    return str;
}

// Type of the Module, specifies if and where it its menu items are added
var ModuleType = {
    INFO: 0,
    ACTION: 1,
    PASSIVE: 2
}

// Module base class
class KDECModule {

    static REQUIRED_KDEC_PLUGINS = [];
    static MODULE_ID = "";

    constructor(id, type, device, compatMode) {
        // Have to be set by subclass
        this.id = id;
        this.type = type;

        // Signal manager to manage singals connected in the applet
        this._signals = new SignalManager.SignalManager(null);

        this.device = device;
        this.compatMode = compatMode;

        // Get settings for module for convenience
        let applet = this.device.getApplet();
        this.options = applet.getModuleOptions(this.id);
    }

    info(msg) {
        this.device.info("[" + this.id + "] " + msg);
    }

    warn(msg) {
        this.device.warn("[" + this.id + "] " + msg);
    }

    error(msg) {
        this.device.error("[" + this.id + "] " + msg);
    }

    getID() {
        return this.id;
    }

    getType() {
        return this.type;
    }

    destroy() {
        this._signals.disconnectAllSignals();
        this.info("D E S T R O Y !");
    }

    getMenuItems() {
        return [];
    }
}

/* Module Class Template

class Module extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = [];
    static MODULE_ID = "";

    constructor(device, compatMode) {
        super(Module.MODULE_ID, ModuleType.INFO, device, compatMode);

        // TODO: Implement
    }

    destroy() {
        super.destroy();
    }

    getMenuItems() {
        return [];
    }
}

*/

class BatteryModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_battery"];
    static MODULE_ID = "battery";

    constructor(device, compatMode) {
        super(BatteryModule.MODULE_ID, ModuleType.INFO, device, compatMode);

        this.charge = 0;
        this.isCharging = false;

        try {
            this.batteryProxy = new DeviceBatteryProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.device.getID()+"/battery");
            
            this.charge = this.batteryProxy.charge;
            this.isCharging = this.batteryProxy.isCharging;

            this._onRefreshed = this.batteryProxy.connectSignal("refreshed", this.onRefreshed.bind(this));
        } catch (error) {
            this.error("Error while connecting to 'battery' DBus interface: "+error);
        }

        // Create Menu Item
        this.batteryMenuItem = new PopupMenu.PopupIconMenuItem(this._getLabelText(), this._getBatteryIconName(), St.IconType.SYMBOLIC, {reactive: false});
    }

    _getBatteryIconName() {
        let chargeLevel = (this.charge % 10)*10

        if (this.isCharging) {
            if (chargeLevel == 100) {
                return "battery-level-" + chargeLevel  + "-charged-symbolic"
            } else {
                return "battery-level-" + chargeLevel  + "-charging-symbolic"
            }
        } else {
            return "battery-level-" + chargeLevel + "-symbolic"
        }
    }

    _getLabelText() {
        if (this.isCharging) {
            return this.charge + "% (" + _("Charging") + ")";
        } else {
            return this.charge + "%"
        }
    }

    onRefreshed(isCharging, charge) {
        this.charge = charge;
        this.isCharging = isCharging;

        this.batteryMenuItem.label.set_text(this._getLabelText());
        this.batteryMenuItem.setIconSymbolicName(this._getBatteryIconName());
    }

    destroy() {
        super.destroy();
        if (this.batteryProxy && this._onRefreshed) {
            this.batteryProxy.disconnectSignal(this._onRefreshed);
        }
    }

    getMenuItems() {
        return [this.batteryMenuItem];
    }
}

class DeviceInfoModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = [];
    static MODULE_ID = "deviceinfo";

    constructor(device, compatMode) {
        super(DeviceInfoModule.MODULE_ID, ModuleType.INFO, device, compatMode);

        try {
            this._signals.connect(this.device, "type-changed",this.onTypeChanged.bind(this));
        } catch (error) {
            this.error("Error while connecting 'type-changed' signal: "+error);
        }

        // Create Menu Item
        this.deviceInfoMenuItem = new PopupMenu.PopupIconMenuItem(_("ID: ") + this.device.getID(), this._getTypeIconName(), St.IconType.SYMBOLIC, {reactive: false});
        
        // Copy ID, when clicked
        this._signals.connect(this.deviceInfoMenuItem, "activate", function(menuItem, keepMenu) {
            CommonUtils.copyAndNotify(this.device.getApplet().notificationSource, this.device.getID(), _("Device ID"));
        }, this);

        // Show tooltip on hovering
        let copyIDTooltip = new Tooltips.Tooltip(this.deviceInfoMenuItem.actor, _("Click to copy ID"));
    }

    _getTypeIconName() {
        switch(this.device.getType()) {
            case "desktop":
                return "computer-symbolic";
            case "laptop":
                return "laptop-symbolic";
            case "smartphone":
                return "smartphone-symbolic";
            case "tablet":
                return "tablet-symbolic";
            case "tv":
                return "tv-symbolic";
            default:
                return "dialog-question-symbolic";
        }
    }

    onTypeChanged() {
        this.deviceInfoMenuItem.setIconSymbolicName(this._getTypeIconName());
    }

    getMenuItems() {
        return [this.deviceInfoMenuItem];
    }
}

class ConnectivityModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_connectivity_report"];
    static MODULE_ID = "connectivity";

    constructor(device, compatMode) {
        super(ConnectivityModule.MODULE_ID, ModuleType.INFO, device, compatMode);

        this.signalStrength = 0;
        this.networkType = "";

        try {
            this.connectivityProxy = new DeviceConnectivityProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.device.getID()+"/connectivity_report");
            
            this.signalStrength = this.connectivityProxy.cellularNetworkStrength;
            this.networkType = this.connectivityProxy.cellularNetworkType;

            this._onRefreshed = this.connectivityProxy.connectSignal("refreshed", this.onRefreshed.bind(this));
        } catch (error) {
            this.error("Error while connecting to 'connectivity_report' DBus interface: "+error);
        }

        // Create Menu Item
        this.connectivityMenuItem = new PopupMenu.PopupIconMenuItem(this._getLabelText(), this._getConnectivityIconName(), St.IconType.SYMBOLIC, {reactive: false});
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

        let networkText = ""

        if (this.networkType == "Unknown") {
            networkText = _("Unknown");
        } else {
            networkText = this.networkType;
        }

        return signalStrengthText + " (" + networkText + ")";
    }

    onRefreshed(networkType, networkStrength) {
        this.networkType = networkType;
        this.signalStrength = networkStrength;

        this.connectivityMenuItem.label.set_text(this._getLabelText());
        this.connectivityMenuItem.setIconSymbolicName(this._getConnectivityIconName());
    }

    destroy() {
        super.destroy();
        if (this.connectivityProxy && this._onRefreshed) {
            this.connectivityProxy.disconnectSignal(this._onRefreshed);
        }
    }

    getMenuItems() {
        return [this.connectivityMenuItem];
    }
}
class FindMyPhoneModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_findmyphone"];
    static MODULE_ID = "findmyphone";

    constructor(device, compatMode) {
        super(FindMyPhoneModule.MODULE_ID, ModuleType.ACTION, device, compatMode);

        try {
            this.findMyPhoneProxy = new DeviceFindMyPhoneProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.device.getID()+"/findmyphone");
        } catch (error) {
            this.error("Error while connecting to 'findmyphone' DBus interface: "+error);
        }

        // Create Menu Item
        this.findMyPhoneMenuItem = new PopupMenu.PopupIconMenuItem(_("Ring device"), "audio-volume-high-symbolic", St.IconType.SYMBOLIC, {});
        let findMyPhoneMenuItemTooltip = new Tooltips.Tooltip(this.findMyPhoneMenuItem.actor, _("Click to ring the device"));
        this._signals.connect(this.findMyPhoneMenuItem, "activate", this.ringDevice.bind(this));
    }
    
    ringDevice() {
        try {
            this.findMyPhoneProxy.ringSync();
        } catch (error) {
            this.error("Error sending ring command: "+error);
        }
    }

    getMenuItems() {
        return [this.findMyPhoneMenuItem];
    }
}

class RequestPhotoModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_photo"];
    static MODULE_ID = "requestphoto";

    constructor(device, compatMode) {
        super(RequestPhotoModule.MODULE_ID, ModuleType.INFO, device, compatMode);

        try {
            this.requestPhotoProxy = new DeviceRequestPhotoProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.device.getID()+"/photo");

            this._onPhotoReceived = this.requestPhotoProxy.connectSignal("photoReceived", this.onPhotoReceived.bind(this));
        } catch (error) {
            this.error("Error while connecting to 'connectivity_report' DBus interface: "+error);
        }

        // Create Menu Item
        this.requestPhotoMenuItem = new PopupMenu.PopupIconMenuItem(_("Request Photo"), "camery-photo-symbolic", St.IconType.SYMBOLIC, {});
        let requestPhotoMenuItemTooltip = new Tooltips.Tooltip(this.requestPhotoMenuItem.actor, _("Click to request a photo from the device"));
        this._signals.connect(this.requestPhotoMenuItem, "activate", function() {
            Dialogs.openReceivePhotoDialog(this.device.getApplet().metadata, this.device.getName(), this.requestPhotoCallback.bind(this));
        });
    }

    requestPhotoCallback(status, filename, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                try {
                    this.requestPhotoProxy.requestPhotoSync(filename);
                } catch (error) {
                    this.error("Error while sending photo request to DBus service: "+error);
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this.info("Dialog for selecting photo save location was canceled.");
                break;
        
            default:
                // Error
                this.error("Error while opening photo save location dialog: "+stderr);
                break;
        }
    }

    onPhotoReceived(fileName) {
        this.info("Received Photo from device: "+fileName);
    }

    destroy() {
        super.destroy();
        if (this.requestPhotoProxy && this._onPhotoReceived) {
            this.requestPhotoProxy.disconnectSignal(this._onPhotoReceived);
        }
    }

    getMenuItems() {
        return [this.connectivityMenuItem];
    }
}




/*
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
];

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
};
*/

// Register module classes
let moduleClasses = {}

moduleClasses[BatteryModule.MODULE_ID] = BatteryModule;
moduleClasses[DeviceInfoModule.MODULE_ID] = DeviceInfoModule;
moduleClasses[ConnectivityModule.MODULE_ID] = ConnectivityModule;
moduleClasses[FindMyPhoneModule.MODULE_ID] = FindMyPhoneModule;
moduleClasses[RequestPhotoModule.MODULE_ID] = RequestPhotoModule;

// Register additional settings

let additionalSettings = {}

// TODO: actually add aditional settings

additionalSettings[BatteryModule.MODULE_ID] = [];
additionalSettings[DeviceInfoModule.MODULE_ID] = [];
additionalSettings[ConnectivityModule.MODULE_ID] = [];
additionalSettings[FindMyPhoneModule.MODULE_ID] = [];
additionalSettings[RequestPhotoModule.MODULE_ID] = [];

// Create array of module IDs
let modules = Object.keys(moduleClasses);