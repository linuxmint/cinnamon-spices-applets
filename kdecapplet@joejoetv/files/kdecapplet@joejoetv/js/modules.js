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
        <method name="isMounted"> \
            <arg type="b" direction="out" /> \
        </method> \
        <method name="getMountError"> \
            <arg type="s" direction="out" /> \
        </method> \
        <method name="startBrowsing"> \
            <arg type="b" direction="out" /> \
        </method> \
        <method name="mountPoint"> \
            <arg type="s" direction="out" /> \
        </method> \
        <method name="getDirectories"> \
            <arg type="a{sv}" direction="out" /> \
            <annotation name="org.qtproject.QtDBus.QtTypeName.Out0" value="QVariantMap" /> \
        </method> \
    </interface> \
</node>';
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

    getMenuItem() {
        return null;
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

    getMenuItem() {
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

            this.warn("RAW CHARGE: "+this.charge);

            this._onRefreshed = this.batteryProxy.connectSignal("refreshed", this.onRefreshed.bind(this));
        } catch (error) {
            this.error("Error while connecting to 'battery' DBus interface: "+error);
        }

        // Create Menu Item
        this.batteryMenuItem = new PopupMenu.PopupIconMenuItem(this._getLabelText(), this._getBatteryIconName(), St.IconType.SYMBOLIC, {reactive: false});
    }

    _getBatteryIconName() {
        if (this.charge >= 0 && this.charge <= 100) {
            let chargeLevel = Math.floor(this.charge / 10) * 10;
    
            if (this.isCharging) {
                if (chargeLevel == 100) {
    
                    return "battery-level-" + chargeLevel.toString()  + "-charged-symbolic";
                } else {
                    return "battery-level-" + chargeLevel.toString()  + "-charging-symbolic";
                }
            } else {
                return "battery-level-" + chargeLevel + "-symbolic";
            }
        } else {
            return "battery-missing-symbolic";
        }
    }

    _getLabelText() {
        if (this.isCharging) {
            return this.charge.toString() + "% (" + _("Charging") + ")";
        } else {
            return this.charge.toString() + "%"
        }
    }

    onRefreshed(proxy, sender, [isCharging, charge]) {
        this.charge = charge;
        this.isCharging = isCharging;

        this.warn("RAW CHARGE: "+this.charge);

        this.batteryMenuItem.label.set_text(this._getLabelText());
        this.batteryMenuItem.setIconSymbolicName(this._getBatteryIconName());
    }

    destroy() {
        super.destroy();
        if (this.batteryProxy && this._onRefreshed) {
            this.batteryProxy.disconnectSignal(this._onRefreshed);
        }
    }

    getMenuItem() {
        return this.batteryMenuItem;
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
        this.deviceInfoMenuItem = new PopupMenu.PopupIconMenuItem(_("ID: ") + this.device.getID(), this._getTypeIconName(), St.IconType.SYMBOLIC);
        
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

    getMenuItem() {
        return this.deviceInfoMenuItem;
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

        if (this.options.showNetworkType == true && this.signalStrength > 0) {
            let networkText = ""
    
            if (this.networkType == "Unknown") {
                networkText = _("Unknown");
            } else {
                networkText = this.networkType;
            }
    
            return signalStrengthText + " (" + networkText + ")";
        } else {
            return signalStrengthText;
        }

    }

    onRefreshed(proxy, sender, [networkType, networkStrength]) {
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

    getMenuItem() {
        return this.connectivityMenuItem;
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

    getMenuItem() {
        return this.findMyPhoneMenuItem;
    }
}

class RequestPhotoModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_photo"];
    static MODULE_ID = "requestphoto";

    constructor(device, compatMode) {
        super(RequestPhotoModule.MODULE_ID, ModuleType.ACTION, device, compatMode);

        try {
            this.requestPhotoProxy = new DeviceRequestPhotoProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.device.getID()+"/photo");

            this._onPhotoReceived = this.requestPhotoProxy.connectSignal("photoReceived", this.onPhotoReceived.bind(this));
        } catch (error) {
            this.error("Error while connecting to 'connectivity_report' DBus interface: "+error);
        }

        // Create Menu Item
        this.requestPhotoMenuItem = new PopupMenu.PopupIconMenuItem(_("Request Photo"), "camera-photo-symbolic", St.IconType.SYMBOLIC, {});
        let requestPhotoMenuItemTooltip = new Tooltips.Tooltip(this.requestPhotoMenuItem.actor, _("Click to request a photo from the device"));
        this._signals.connect(this.requestPhotoMenuItem, "activate", function() {
            try {
                Dialogs.openReceivePhotoDialog(this.device.getApplet().metadata, this.device.getName(), this.requestPhotoCallback.bind(this));
            } catch (error) {
                global.logError("Error while opening Dialog: "+error);
            }
        }, this);
    }

    requestPhoto() {
        if (this.options.saveToDir == false) {
            Dialogs.openReceivePhotoDialog(this.device.getApplet().metadata, this.device.getName(), this.requestPhotoCallback.bind(this));
        } else {
            // Save directly to directory

            // Build filename from date and time
            let cdate = new Date();
            let filename = "photo_"+cdate.toLocaleDateString().replaceAll(".","-").replaceAll("/","-")+"_"+cdate.toLocaleTimeString().replaceAll(":","-").replaceAll("/","-");
            let filepath = CommonUtils.getAvailableFilename(this.options.saveDirectory, filename, "jpg");

            if (filepath !== null) {
                try {
                    this.requestPhotoProxy.requestPhotoSync(filepath);
                } catch (error) {
                    this.error("Error while sending photo request to DBus service: "+error);
                }
            } else {
                this.error("Save Path doesn't exist or isn't a directory!");
            }
        }
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

    onPhotoReceived(proxy, sender, [fileName]) {
        this.info("Received Photo from device: "+fileName);

        let notificationSource = this.device.getApplet().notificationSource;
        let notification = new MessageTray.Notification(notificationSource, "KDE Connect Applet", _("Photo received from '{deviceName}'\nClick to open in default application").replace("{deviceName}", this.device.getName()));
        notification.setTransient(true);
        this._signals.connect(notification, "clicked", function() {
            CommonUtils.openURL("file://"+fileName);
        })
        notificationSource.notify(notification);
    }

    destroy() {
        super.destroy();
        if (this.requestPhotoProxy && this._onPhotoReceived) {
            this.requestPhotoProxy.disconnectSignal(this._onPhotoReceived);
        }
    }

    getMenuItem() {
        return this.requestPhotoMenuItem;
    }
}

class PingModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_ping"];
    static MODULE_ID = "ping";

    constructor(device, compatMode) {
        super(PingModule.MODULE_ID, ModuleType.ACTION, device, compatMode);

        try {
            this.pingProxy = new DevicePingProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.device.getID()+"/ping");
        } catch (error) {
            this.error("Error while creating DBus proxy: "+error);
        }

        // Create Menu Item
        this.pingMenuItem = new PopupMenu.PopupIconMenuItem(_("Ping Device"), "network-transmit-symbolic", St.IconType.SYMBOLIC, {});
        let pingMenuItemTooltip = new Tooltips.Tooltip(this.pingMenuItem.actor, _("Click to send a ping to the device"));
        this._signals.connect(this.pingMenuItem, "activate", this.ping.bind(this));
    }

    ping() {
        if (this.options.useCustomMessage == true) {
            try {
                this.pingProxy.sendPingSync(this.options.customMessage);
            } catch (error) {
                this.error("Error while sending ping: "+error);
            }
        } else {
            try {
                this.pingProxy.sendPingSync(_("Ping!"));
            } catch (error) {
                this.error("Error while sending ping: "+error);
            }
        }

        let notificationSource = this.device.getApplet().notificationSource;
        let notification = new MessageTray.Notification(notificationSource, "KDE Connect Applet", _("Sent ping to device '{deviceName}'").replace("{deviceName}", this.device.getName()));
        notification.setTransient(true);
        notificationSource.notify(notification);
    }

    getMenuItem() {
        return this.pingMenuItem;
    }
}

class ShareModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_share"];
    static MODULE_ID = "share";

    constructor(device, compatMode) {
        super(ShareModule.MODULE_ID, ModuleType.ACTION, device, compatMode);

        try {
            this.shareProxy = new DeviceShareProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.device.getID()+"/share");

            this._onShareReceived = this.shareProxy.connectSignal("shareReceived", this.onShareReceived.bind(this));
        } catch (error) {
            this.error("Error while connecting to 'share' DBus interface: "+error);
        }

        if (this.options.useSubMenu == true) {
            this.menuItemContainer = new PopupMenu.PopupSubMenuMenuItem(_("Share"));

            // Workaround to add icon, because Cinnamon didn't like me making a PopupMenu class in another file
            let menuIcon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: "send-to-symbolic", icon_type: St.IconType.SYMBOLIC});
            this.menuItemContainer.addActor(menuIcon, {span: 0, position: 0});
        } else {
            this.menuItemContainer = new PopupMenu.PopupMenuSection();
        }

        // Create Menu Items
        if (this.options.enableSendURL == true) {
            this.sendURLMenuItem = new PopupMenu.PopupIconMenuItem(_("Send URL"), "link-symbolic", St.IconType.SYMBOLIC, {});
            let sendURLMenuItemTooltip = new Tooltips.Tooltip(this.sendURLMenuItem.actor, _("Click to send a URL to the device"));
            this._signals.connect(this.sendURLMenuItem, "activate", function() {
                Dialogs.openSendURLDialog(this.device.getApplet().metadata, this.device.getName(), this.sendURLCallback.bind(this));
            }, this);
            this.menuItemContainer.menu.addMenuItem(this.sendURLMenuItem);
        }

        if (this.options.enableSendText == true) {
            this.sendTextMenuItem = new PopupMenu.PopupIconMenuItem(_("Send Text"), "tool-text-symbolic", St.IconType.SYMBOLIC, {});
            let sendTextMenuItemTooltip = new Tooltips.Tooltip(this.sendTextMenuItem.actor, _("Click to send text to the device"));
            this._signals.connect(this.sendTextMenuItem, "activate", function() {
                Dialogs.openSendTextDialog(this.device.getApplet().metadata, this.device.getName(), this.sendTextCallback.bind(this));
            }, this);
            this.menuItemContainer.menu.addMenuItem(this.sendTextMenuItem);
        }

        if (this.options.enableSendFiles == true) {
            this.sendFilesMenuItem = new PopupMenu.PopupIconMenuItem(_("Send File(s)"), "emblem-documents-symbolic", St.IconType.SYMBOLIC, {});
            let sendFilesMenuItemTooltip = new Tooltips.Tooltip(this.sendFilesMenuItem.actor, _("Click to send file(s) to the device"));
            this._signals.connect(this.sendFilesMenuItem, "activate", function() {
                Dialogs.openSendFilesDialog(this.device.getApplet().metadata, this.device.getName(), this.sendFilesCallback.bind(this));
            }, this);
            this.menuItemContainer.menu.addMenuItem(this.sendFilesMenuItem);
        }
    }

    sendURLCallback(status, urlText, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                try {
                    this.shareProxy.shareUrlSync(urlText);
                } catch (error) {
                    this.error("Error while sending url: "+error);
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this.info("Dialog for entering URL to send was canceled.");
                break;
        
            default:
                // Error
                this.error("Error while opening URL dialog: "+stderr);
                break;
        }
    }

    sendTextCallback(status, text, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                try {
                    this.shareProxy.shareTextSync(text);
                } catch (error) {
                    this.error("Error while sending text: "+error);
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this.info("Dialog for entering text to send was canceled.");
                break;
        
            default:
                // Error
                this.error("Error while opening text dialog: "+stderr);
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
                    this.shareProxy.shareUrlsSync(filenameArray);
                } catch (error) {
                    this.error("Error while sending files: "+error);
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this.info("Dialog for selecting files to send was canceled.");
                break;
        
            default:
                // Error
                this.error("Error while opening file chooser dialog: "+stderr);
                break;
        }
    }

    onShareReceived(proxy, sender, [url]) {
        this.info("Received Share from device: "+url);
        // TODO: Implement
    }

    destroy() {
        super.destroy();
        if (this.shareProxy && this._onShareReceived) {
            this.shareProxy.disconnectSignal(this._onShareReceived);
        }
    }

    getMenuItem() {
        return this.menuItemContainer;
    }
}

class SFTPModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_sftp"];
    static MODULE_ID = "sftp";

    constructor(device, compatMode) {
        super(SFTPModule.MODULE_ID, ModuleType.ACTION, device, compatMode);

        this.mounted = false;
        this.mountPoint = "";

        try {
            this.sftpProxy = new DeviceSFTPProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.device.getID()+"/sftp");

            this.mounted = this.sftpProxy.isMountedSync()[0];

            if (this.mounted == true) {
                this.mountPoint = this.sftpProxy.mountPointSync()[0];
            }

            this._onMounted = this.sftpProxy.connectSignal("mounted", this.onMounted.bind(this));
            this._onUnmounted = this.sftpProxy.connectSignal("unmounted", this.onUnmounted.bind(this));
        } catch (error) {
            this.error("Error while connecting to 'sftp' DBus interface: "+error);
        }

        // Create Menu Item
        this.sftpMenuItem = new CommonUtils.PopupButtonIconMenuItem(this._getLabelText(), "network-server-symbolic", St.IconType.SYMBOLIC, "folder-symbolic", St.IconType.SYMBOLIC);
        
        // Set text for menu item tooltip and enable it
        this.sftpMenuItem.tooltip.set_text(this._getItemTooltipText());
        this.sftpMenuItem.tooltip.preventShow = false;

        // set text for button tooltip and enable it
        this.sftpMenuItem.button.tooltip.set_text(_("Click to browse files"));
        this.sftpMenuItem.button.tooltip.preventShow = false;

        // Disable or enable button based upon read mounted state
        this.sftpMenuItem.button.setEnabled(this.mounted);

        this._signals.connect(this.sftpMenuItem, "activate", Lang.bind(this, function(menuItem, event, keepMenu, activationType) {
            if (activationType == CommonUtils.ActivateType.ITEM) {
                this.mountOrUnmount();
            } else if (activationType == CommonUtils.ActivateType.BUTTON) {
                this.startBrowsing();
            }
        }));
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
                this.sftpProxy.unmountSync();
            } catch (error) {
                this.error("Error while unmounting: "+error);
            }
        } else {
            try {
                this.sftpProxy.mountSync();
            } catch (error) {
                this.error("Error while mounting: "+error);
            }
        }
    }

    onMounted(proxy, sender) {
        this.mounted = true;
        this.sftpMenuItem.label.set_text(this._getLabelText());
        this.sftpMenuItem.tooltip.set_text(this._getItemTooltipText());
        this.sftpMenuItem.button.setEnabled(true);
        
        try {
            this.mountPoint = this.sftpProxy.mountPointSync()[0];

        } catch (error) {
            this.error("Error while getting information about mount: "+error);
        }
    }

    onUnmounted(proxy, sender) {
        this.mounted = false;
        this.sftpMenuItem.label.set_text(this._getLabelText());
        this.sftpMenuItem.tooltip.set_text(this._getItemTooltipText());
        this.sftpMenuItem.button.setEnabled(false);

        try {
            let mountError = this.sftpProxy.getMountErrorSync()[0];

            if (mountError != "") {
                this.error("Error while mounting: "+mountError);
            }

        } catch (error) {
            this.error("Error while getting information about mount: "+error);
        }
    }

    startBrowsing() {
        // NOTE: There is also a DBus method to open the file manager at the mount point, but that is currently broken, at least for me

        if (this.mounted == true) {
            CommonUtils.openURL("file://"+this.mountPoint);
        }
    }

    destroy() {
        super.destroy();
        if (this.sftpProxy) {
            if (this._onMounted) {
                this.sftpProxy.disconnectSignal(this._onMounted);
            }
            if (this._onUnmounted) {
                this.sftpProxy.disconnectSignal(this._onUnmounted);
            }
        }
    }

    getMenuItem() {
        return this.sftpMenuItem;
    }
}

class SMSModule extends KDECModule {

    static REQUIRED_KDEC_PLUGINS = ["kdeconnect_sms"];
    static MODULE_ID = "sms";

    constructor(device, compatMode) {
        super(SMSModule.MODULE_ID, ModuleType.ACTION, device, compatMode);

        try {
            this.smsProxy = new DeviceSMSProxy(Gio.DBus.session, CommonUtils.KDECONNECT_DBUS_NAME, "/modules/kdeconnect/devices/"+this.device.getID()+"/sms");
        } catch (error) {
            this.error("Error while connecting to 'sms' DBus interface: "+error);
        }

        if (this.options.useSubMenu == true) {
            this.menuItemContainer = new PopupMenu.PopupSubMenuMenuItem(_("SMS"));

            // Workaround to add icon, because Cinnamon didn't like me making a PopupMenu class in another file
            let menuIcon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: "dialog-messages", icon_type: St.IconType.SYMBOLIC});
            this.menuItemContainer.addActor(menuIcon, {span: 0, position: 0});
        } else {
            this.menuItemContainer = new PopupMenu.PopupMenuSection();
        }

        // Create Menu Items
        if (this.options.enableLaunchSMSApp == true) {
            this.launchSMSAppMenuItem = new PopupMenu.PopupIconMenuItem(_("Launch SMS App"), "dialog-messages", St.IconType.SYMBOLIC, {});
            let launchSMSAppMenuItemTooltip = new Tooltips.Tooltip(this.launchSMSAppMenuItem.actor, _("Click to open the KDE Connect SMS App"));
            this._signals.connect(this.launchSMSAppMenuItem, "activate", this.launchSMSApp.bind(this));
            this.menuItemContainer.menu.addMenuItem(this.launchSMSAppMenuItem);
        }

        if (this.options.enableSendSMS== true) {
            this.sendSMSMenuItem = new PopupMenu.PopupIconMenuItem(_("Send SMS"), "chat-message-new-symbolic", St.IconType.SYMBOLIC, {});
            let sendSMSMenuItemTooltip = new Tooltips.Tooltip(this.sendSMSMenuItem.actor, _("Click to send text to the device"));
            this._signals.connect(this.sendSMSMenuItem, "activate", function() {
                Dialogs.openSendSMSDialog(this.device.getApplet().metadata, this.device.getName(), this.sendSMSCallback.bind(this));
            }, this);
            this.menuItemContainer.menu.addMenuItem(this.sendSMSMenuItem);
        }
    }

    launchSMSApp() {
        try {
            this.smsProxy.launchAppSync();
        } catch (error) {
            this.error("Error while launching KDE Connect SMS App: "+error);
        }
    }

    sendSMSCallback(status, SMSObject, stderr) {
        switch (status) {
            case Dialogs.DialogStatus.SUCCESS:
                if (SMSObject["phone_number"] && SMSObject["message"]) {
                    let phoneNumber = SMSObject["phone_number"].replace(" ", "");

                    try {
                        let addressVariant = new GLib.Variant('(s)', [phoneNumber]);

                        this.smsProxy.sendSmsSync([addressVariant], SMSObject["message"], []);

                        this.info("Sent SMS to '" + phoneNumber.toString() + "' with message: "+SMSObject["message"].toString());
                    } catch (error) {
                        this.error("Error while sending SMS: "+error);
                    }

                } else {
                    this.error("Got malformed response from dialog. Either 'phone_number' or 'message' is missing!");
                }
                break;

            case Dialogs.DialogStatus.CANCEL:
                this.info("Dialog for entering SMS to send was canceled.");
                break;
        
            default:
                // Error
                this.error("Error while opening SMS dialog: "+stderr);
                break;
        }
    }

    getMenuItem() {
        return this.menuItemContainer;
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
moduleClasses[PingModule.MODULE_ID] = PingModule;
moduleClasses[ShareModule.MODULE_ID] = ShareModule;
moduleClasses[SFTPModule.MODULE_ID] = SFTPModule;
moduleClasses[SMSModule.MODULE_ID] = SMSModule;

// Register additional settings

let additionalSettings = {}

// TODO: actually add aditional settings

additionalSettings[BatteryModule.MODULE_ID] = [];
additionalSettings[DeviceInfoModule.MODULE_ID] = [];
additionalSettings[ConnectivityModule.MODULE_ID] = ["showNetworkType"];
additionalSettings[FindMyPhoneModule.MODULE_ID] = [];
additionalSettings[RequestPhotoModule.MODULE_ID] = ["saveToDir", "saveDirectory"];
additionalSettings[PingModule.MODULE_ID] = ["useCustomMessage", "customMessage"];
additionalSettings[ShareModule.MODULE_ID] = ["useSubMenu", "enableSendURL", "enableSendText", "enableSendFiles"];
additionalSettings[SFTPModule.MODULE_ID] = [];
additionalSettings[SMSModule.MODULE_ID] = ["useSubMenu", "enableSendSMS", "enableLaunchSMSApp"];

// Create array of module IDs
let modules = Object.keys(moduleClasses);