const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const Tooltips = imports.ui.tooltips;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Gettext = imports.gettext;

const AppletUtils = require("./utils.js");
const Dialogs = require("./dialogs.js");

const UUID = "kdecapplet@joejoetv";
const KDEConnectDBusName = "org.kde.kdeconnect";

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

// Module base class
class KDECModule {
    constructor(id, requiredKDECModules, device, compatMode) {
        // Have to be set by subclass
        this.id = id;
        this.requiredKDECModules = requiredKDECModules;

        this.device = device;
        this.compatMode = compatMode;

        let applet = this.device.getApplet();

        this.settings = applet.getModuleSettings(this.id);
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

    getRequiredKDECModules() {
        return this.requiredKDECModules;
    }

    remove() {
        // Do nothing in base class
    }

    getMenuItems() {
        // Do nothing in base class
    }
}

class BatteryModule extends KDECModule {
    constructor(device, compatMode) {
        super("battery", ["kdeconnect_battery"], device, compatMode);

        this.charge = 0;
        this.isCharging = false;

        try {
            this.batteryProxy = new DeviceBatteryProxy(Gio.DBus.session, KDEConnectDBusName, "/modules/kdeconnect/devices/"+this.device.getID()+"/battery");
            
            this.charge = this.batteryProxy.charge;
            this.isCharging = this.batteryProxy.isCharging;

            this._onRefreshed = this.batteryProxy.connectSignal("refreshed", this.onRefreshed.bind(this));
        } catch (error) {
            this.error("Error while connecting to battery interface: "+error);
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

    remove() {
        if (this.batteryProxy && this._onRefreshed) {
            this.batteryProxy.disconnectSignal(this._onRefreshed);
        }
    }

    getMenuItems() {
        return [this.batteryMenuItem];
    }
}