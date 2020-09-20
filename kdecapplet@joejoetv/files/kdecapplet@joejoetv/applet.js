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

// DBus Interfaces and Proxies

const FreedesktopDBusInterface = '\
<node> \
    <interface name="org.freedesktop.DBus"> \
        <method name="ListNames"> \
            <arg type="as" direction="out"/> \
        </method> \
    </interface> \
</node>';
const FreedesktopDBusProxy = Gio.DBusProxy.makeProxyWrapper(FreedesktopDBusInterface);

const Qt5CoreApplicationInterface = '\
<node> \
    <interface name="org.qtproject.Qt.QCoreApplication"> \
        <property name="applicationVersion" type="s" access="read"/> \
        <property name="applicationName" type="s" access="read"/> \
    </interface> \
</node>';
const Qt5CoreApplicationProxy = Gio.DBusProxy.makeProxyWrapper(Qt5CoreApplicationInterface);

const KDEConnectInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.daemon"> \
        <method name="announcedName"> \
            <arg type="s" direction="out"/> \
        </method> \
        <method name="deviceNames"> \
            <arg name="onlyReachable" type="b" direction="in"/> \
            <arg name="onlyPaired" type="b" direction="in"/> \
            <arg type="a{ss}" direction="out"/> \
        </method> \
        <method name="devices"> \
            <arg name="onlyReachable" type="b" direction="in"/> \
            <arg name="onlyPaired" type="b" direction="in"/> \
            <arg type="as" direction="out"/> \
        </method> \
        <signal name="deviceListChanged"> \
        </signal> \
    </interface> \
</node>';
const KDEConnectProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectInterface);

const KDEConnectDeviceInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device"> \
        <property name="isReachable" type="b" access="read"/> \
        <property name="isTrusted" type="b" access="read"/> \
        <property name="supportedPlugins" type="as" access="read"/> \
        <property name="type" type="s" access="read"/> \
        <method name="acceptPairing"> \
        </method> \
        <method name="isPluginEnabled"> \
            <arg name="pluginName" type="s" direction="in"/> \
            <arg type="b" direction="out"/> \
        </method> \
        <method name="isTrusted"> \
            <arg type="b" direction="out"/> \
        </method> \
        <method name="loadedPlugins"> \
            <arg type="as" direction="out"/> \
        </method> \
        <method name="unpair"> \
        </method> \
    </interface> \
</node>';
const KDEConnectDeviceProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDeviceInterface);

const KDEConnectDeviceBatteryInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.battery"> \
        <method name="charge"> \
            <arg type="i" direction="out"/> \
        </method> \
        <method name="isCharging"> \
            <arg type="b" direction="out"/> \
        </method> \
        <signal name="chargeChanged"> \
            <arg name="charge" type="i" direction="out"/> \
        </signal> \
        <signal name="stateChanged"> \
            <arg name="charging" type="b" direction="out"/> \
        </signal> \
    </interface> \
</node>';
const KDEConnectDeviceBatteryProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDeviceBatteryInterface);

const KDEConnectDevicePingInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.ping"> \
        <method name="sendPing"> \
        </method> \
    </interface> \
</node>';
const KDEConnectDevicePingProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDevicePingInterface);

const KDEConnectDeviceOldTelephonyInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.telephony"> \
        <method name="sendSms"> \
            <arg name="phoneNumber" type="s" direction="in"/> \
            <arg name="messageBody" type="s" direction="in"/> \
        </method> \
    </interface> \
</node>';
const KDEConnectDeviceOldTelephonyProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDeviceOldTelephonyInterface);

const KDEConnectDeviceSMSInterface = '\
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
const KDEConnectDeviceSMSProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDeviceSMSInterface);

const KDEConnectDeviceShareInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.share"> \
        <method name="shareUrl"> \
            <arg name="url" type="s" direction="in"/> \
        </method> \
    </interface> \
</node>';
const KDEConnectDeviceShareProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDeviceShareInterface);

const KDEConnectDeviceSFTPInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.sftp"> \
        <method name="isMounted"> \
            <arg type="b" direction="out"/> \
        </method> \
        <method name="mount"> \
        </method> \
        <method name="mountAndWait"> \
            <arg type="b" direction="out"/> \
        </method> \
        <method name="mountPoint"> \
            <arg type="s" direction="out"/> \
        </method> \
        <method name="getMountError"> \
            <arg type="s" direction="out"/> \
        </method> \
        <method name="unmount"> \
        </method> \
        <signal name="mounted"> \
        </signal> \
        <signal name="unmounted"> \
        </signal> \
    </interface> \
</node>';
const KDEConnectDeviceSFTPProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDeviceSFTPInterface);

const KDEConnectDeviceFMPInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.findmyphone"> \
        <method name="ring"> \
        </method> \
    </interface> \
</node>';
const KDEConnectDeviceFMPProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDeviceFMPInterface);

const KDEConnectDevicePhotoInterface = '\
<node> \
    <interface name="org.kde.kdeconnect.device.photo"> \
        <method name="requestPhoto"> \
            <arg name="fileName" type="s" direction="in"/> \
        </method> \
        <signal name="photoReceived"> \
            <arg name="fileName" type="s" direction="out"/> \
        </signal> \
    </interface> \
</node>';
const KDEConnectDevicePhotoProxy = Gio.DBusProxy.makeProxyWrapper(KDEConnectDevicePhotoInterface);

//Misc functions

function getBatteryIcon(charge, isCharging) {
    let iconName = "battery-symbolic";
    
    if (isCharging == true) {
        switch (true) {
            case (charge <= 10):
                iconName = "battery-empty-charging-symbolic";
                break;
            case (charge > 10 && charge <= 25):
                iconName = "battery-caution-charging-symbolic";
                break;
            case (charge > 25 && charge <= 50):
                iconName = "battery-low-charging-symbolic";
                break;
            case (charge > 50 && charge <= 75):
                iconName = "battery-medium-charging-symbolic";
                break;
            case (charge > 75 && charge <= 99):
                iconName = "battery-good-charging-symbolic";
                break;
            case (charge > 99 && charge <= 100):
                iconName = "battery-full-charging-symbolic";
                break;
        }
    }
    else {
        switch (true) {
            case (charge <= 10):
                iconName = "battery-empty-symbolic";
                break;
            case (charge > 10 && charge <= 25):
                iconName = "battery-caution-symbolic";
                break;
            case (charge > 25 && charge <= 50):
                iconName = "battery-low-symbolic";
                break;
            case (charge > 50 && charge <= 75):
                iconName = "battery-medium-symbolic";
                break;
            case (charge > 75 && charge <= 99):
                iconName = "battery-good-symbolic";
                break;
            case (charge > 99 && charge <= 100):
                iconName = "battery-full-symbolic";
                break;
        }
    }
    return iconName;
}

function getDeviceIcon(type) {
    let iconName;

    switch(type) {
        case "desktop":
            iconName = "computer-symbolic";
            break;
        case "laptop":
            iconName = "laptop-symbolic";
            break;
        case "smartphone":
            iconName = "smartphone-symbolic";
            break;
        case "tablet":
            iconName = "tablet-symbolic";
            break;
        case "tv":
            iconName = "tv-symbolic";
            break;
        default:
            iconName = "dialog-question-symbolic";
    }

    return iconName;
}

// l10n/translation support
const UUID = "kdecapplet@joejoetv";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

// Zenity Commands with translation
const KDEConnectTelephonyZenityArgV = ['zenity','--forms','--title='+_("Send SMS"),'--ok-label='+_("Send"),'--window-icon=kdeconnect','--text='+_("Enter Phone Number and Message to Send."),'--add-entry='+_("Phone Number"),'--add-entry='+_("Message"),'2> /dev/null'];
const KDEConnectShareURLArgV = ['zenity','--forms','--title='+_("Share URL"),'--ok-label='+_("Share"),'--window-icon=kdeconnect','--text='+_("Enter URL to Share."),'--add-entry='+_("URL"),'2> /dev/null'];

// Main Applet class
function KDEConnectApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

KDEConnectApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.metadata = metadata;

        this.set_applet_icon_name("kdeconnect");
	    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        
        let dbusNameList = [];

        this.KDEConnectVersion = [];

        this.SignalCallbackObjects = {};
        this.SignalCallbackObjects["battery"] = []; //List of Objects that contain a d-bus proxy, the signal object and the menu item, that has to be updated
        this.SignalCallbackObjects["sftp"] = []; //List of objects that contain two menu items for mounting and unmounting, a d-bus proxy and two signal objects for mounting and unmounting signals
        this.SignalCallbackObjects["photo"] = [];

        //Check if zenity is installed and print warning to log if not
        this.zenitySupported = this.checkZenity();

        if (this.zenitySupported == false) {
            global.logWarning("["+this.metadata.uuid+"] Zenity is not installed! Install it to use the 'Send SMS' and 'Send URL' features.");
        }

        //Check if KDE Connect is available on the DBus
        try {
            let dbproxy = new FreedesktopDBusProxy(Gio.DBus.session, "org.freedesktop.DBus", "/org/freedesktop/DBus");
            dbusNameList = dbproxy.ListNamesSync()[0];
        }
        catch (error) {
            global.logError(error);
        }
        
        if (dbusNameList.includes("org.kde.kdeconnect")) {
            try {
                //Get KDE Connect Version
                let qtCoreAppProxy = new Qt5CoreApplicationProxy(Gio.DBus.session, "org.kde.kdeconnect", "/MainApplication");
                let versionStringArray = qtCoreAppProxy.applicationVersion.split(".");
                
                for (let i = 0; i<versionStringArray.length; i++) {
                    this.KDEConnectVersion.push(Number(versionStringArray[i]));
                }

                //Connect DBus Signal
                this.kdecProxy = new KDEConnectProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect");
                this._onDeviceListChanged = this.kdecProxy.connectSignal("deviceListChanged", Lang.bind(this, this.onDeviceListChanged));
            }
            catch (error) {
                global.logError(error);
            }
            
            let kdecVersionMenuItem = new PopupMenu.PopupMenuItem(_("KDE Connect Version")+": "+this.KDEConnectVersion.join("."), {reactive: false});
            kdecVersionMenuItem.actor.add_style_pseudo_class('insensitive');
            this._applet_context_menu.addMenuItem(kdecVersionMenuItem);
            this._applet_context_menu.addCommandlineAction(_("Configure KDEConnect"), "kcmshell5 kcm_kdeconnect");
            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            this.updateMenu();
        }
        else {
            //KDE Connect not available
            try{
                let noKDEConnectMenuItem = new PopupMenu.PopupMenuItem(_("KDEConnect is not running!"), {});
                this.menu.addMenuItem(noKDEConnectMenuItem);
                noKDEConnectMenuItem.setSensitive(false);
                this.set_applet_tooltip(_("KDEConnect is not running!"));
                this.set_applet_label("");
                this._applet_context_menu.addAction(_("Reload Applet"), Lang.bind(this, this.reloadApplet));

            }
            catch (error) {
                global.logError(error);
            }
        }
    },

    //Main update method
    updateMenu: function() {
        //Reset Menu
        this.menu.close();
        this.menu.removeAll();
        //Reset Signals
        this.disconnectSignals();
        this.SignalCallbackObjects["battery"].length = 0;
        this.SignalCallbackObjects["sftp"].length = 0;
        this.SignalCallbackObjects["photo"].length = 0;

        let deviceIDs = [];
        let deviceNames = {};

        //Get Device ID's
        try {
            deviceIDs = this.kdecProxy.devicesSync(true, true)[0];
            deviceNames = this.kdecProxy.deviceNamesSync(true, true)[0];
            this.onlyOneDevice = deviceIDs.length == 1;
        }
        catch (error) {
            global.logError(error);
        }

        if (deviceIDs.length == 0) {
            let noReachableDevicesMenuItem = new PopupMenu.PopupMenuItem(_("No reachable paired devices!"), {reactive: false});
            noReachableDevicesMenuItem.actor.add_style_pseudo_class('insensitive');
            this.menu.addMenuItem(noReachableDevicesMenuItem);
            this.set_applet_tooltip(_("No reachable paired devices!"));
            this.set_applet_label("");
        } else {
            this.set_applet_label(deviceIDs.length.toString());
            if (deviceIDs.length > 1) {
                this.set_applet_tooltip(deviceIDs.length+" "+_("Devices"));
            }
            else {
                this.set_applet_tooltip(deviceIDs.length+" "+_("Device"));
            }

            for (let i = 0; i < deviceIDs.length; i++) {
                let id = deviceIDs[i];
                let name = deviceNames[id];
                let deviceMenuItem = new PopupMenu.PopupSubMenuMenuItem(name);
                this.menu.addMenuItem(deviceMenuItem);

                let type = "";
                let loadedPlugins = [];

                try {
                    let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
                    let kdecDevProxy = new KDEConnectDeviceProxy(bus, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id);

                    type = kdecDevProxy.type;
                    loadedPlugins = kdecDevProxy.loadedPluginsSync()[0];
                } 
                catch (error) {
                    global.logError(error);
                }

                let deviceTypeIDMenuItem = new PopupMenu.PopupIconMenuItem(_("ID")+": "+id, getDeviceIcon(type), St.IconType.SYMBOLIC, {});
                deviceTypeIDMenuItem._signals.connect(deviceTypeIDMenuItem, 'activate', function() {
                    let clipboard = St.Clipboard.get_default();
                    clipboard.set_text(St.ClipboardType.CLIPBOARD, id);
                    Main.notify(_("Copied Device ID to the clipboard"));
                });
                deviceMenuItem.menu.addMenuItem(deviceTypeIDMenuItem);

                if (loadedPlugins.includes("kdeconnect_battery")) {
                    let charge = 0;
                    let isCharging = false;

                    let deviceBatteryMenuItem = new PopupMenu.PopupIconMenuItem("", "", St.IconType.SYMBOLIC, {reactive: false});
                    deviceMenuItem.menu.addMenuItem(deviceBatteryMenuItem);
                    
                    try {
                        let batteryProxySignal = {};

                        batteryProxySignal.Proxy = new KDEConnectDeviceBatteryProxy(Gio.bus_get_sync(Gio.BusType.SESSION, null), "org.kde.kdeconnect","/modules/kdeconnect/devices/"+id);
                        batteryProxySignal._onStateChanged = batteryProxySignal.Proxy.connectSignal("stateChanged", Lang.bind(batteryProxySignal, this.onStateChanged));
                        batteryProxySignal.MenuItem = deviceBatteryMenuItem;
            
                        charge = batteryProxySignal.Proxy.chargeSync();
                        isCharging = batteryProxySignal.Proxy.isChargingSync();

                        this.SignalCallbackObjects["battery"].push(batteryProxySignal);
                    }
                    catch (error) {
                        global.logError(error);
                    }
                    
                    deviceBatteryMenuItem.label.set_text(charge+"%");
                    deviceBatteryMenuItem.setIconSymbolicName(getBatteryIcon(charge,isCharging));

                }

                deviceMenuItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                if (loadedPlugins.includes("kdeconnect_ping")) {
                    deviceMenuItem.menu.addAction(_("Send Ping"), function() {
                        try {
                            let kdecDevPingProxy = KDEConnectDevicePingProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/ping");
                            kdecDevPingProxy.sendPingSync();
                        }
                        catch (error) {
                            global.logError(error);
                        }
                    });
                }

                if (this.KDEConnectVersion[0] == 1 && this.KDEConnectVersion[1] == 3) {
                    if (loadedPlugins.includes("kdeconnect_telephony")) {
                        if (this.zenitySupported == true) {
                            deviceMenuItem.menu.addAction(_("Send SMS"), function() {
                                try {
                                    Util.spawnCommandLineAsyncIO("zenity", function(stdout, stderr, exitCode) {
                                        if (exitCode == 0) {
                                            let regex = /^(.*)\|(.*)\n/m;
                                            let regexresult = regex.exec(stdout);
                                            let phonenumber = regexresult[1];
                                            let message = regexresult[2];
        
                                            try {
                                                let kdecDevTeleProxy = new KDEConnectDeviceOldTelephonyProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/telephony");
                                                kdecDevTeleProxy.sendSmsSync(phonenumber, message);
                                                Main.notify(_("Sent SMS to ${phonenumber}").replace("${phonenumber}",phonenumber));
                                            }
                                            catch (error) {
                                                global.logError(error);
                                            }
                                        }
                                    }, 
                                    {argv: KDEConnectTelephonyZenityArgV});
                                }
                                catch (error) {
                                    global.logError(error);
                                }
                            });
                        }
                    }
                }
                else {
                    if (loadedPlugins.includes("kdeconnect_sms")) {
                        deviceMenuItem.menu.addAction(_("Launch SMS App"), function() {
                            try {
                                let kdecDevSMSProxy = new KDEConnectDeviceSMSProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/sms");
                                kdecDevSMSProxy.launchAppSync();
                            }
                            catch (error) {
                                global.logError(error);
                            }
                        });
                        if (this.zenitySupported == true) {
                            deviceMenuItem.menu.addAction(_("Send SMS"), function() {
                                try {
                                    Util.spawnCommandLineAsyncIO("zenity", function(stdout, stderr, exitCode) {
                                        if (exitCode == 0) {
                                            let regex = /^(.*)\|(.*)\n/m;
                                            let regexresult = regex.exec(stdout);
                                            let phonenumber = regexresult[1];
                                            let message = regexresult[2];
        
                                            try {
                                                let kdecDevSMSProxy = new KDEConnectDeviceSMSProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/sms");
                                                kdecDevSMSProxy.sendSmsSync(phonenumber, message);
                                                Main.notify(_("Sent SMS to ${phonenumber}").replace("${phonenumber}",phonenumber));
                                            }
                                            catch (error) {
                                                global.logError(error);
                                            }
                                        }
                                    }, 
                                    {argv: KDEConnectTelephonyZenityArgV});
                                }
                                catch (error) {
                                    global.logError(error);
                                }
                            });
                        }
                    }
                }

                if (loadedPlugins.includes("kdeconnect_share")) {
                    deviceMenuItem.menu.addAction(_("Share File"),function() {
                        FileDialog.open(function(selection) {
                            let filePath = selection.replace(/\n$/, "");
                            if (filePath !== "") {
                                try {
                                    let kdecDevShareProxy = new KDEConnectDeviceShareProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/share");
                                    kdecDevShareProxy.shareUrlSync("file://"+filePath);
                                    Main.notify(_("Shared file with ${name}").replace("${name}",name), filePath);
                                }
                                catch (error) {
                                    global.logError(error);
                                }
                            }
                        }, {});
                    });
                    if (this.zenitySupported == true) {
                        deviceMenuItem.menu.addAction(_("Share URL"), function() {
                            try {
                                Util.spawnCommandLineAsyncIO("zenity", function(stdout, stderr, exitCode) {
                                    if (exitCode == 0) {
                                        let regex = /^(.*)\n*/;
                                        let shareurl = regex.exec(stdout)[1];
    
                                        try {
                                            let kdecDevShareProxy = new KDEConnectDeviceShareProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/share");
                                            kdecDevShareProxy.shareUrlSync(shareurl);
                                            Main.notify(_("Shared URL with ${name}").replace("${name}",name), shareurl);
                                        }
                                        catch (error) {
                                            global.logError(error);
                                        }
                                    }
                                }, {argv: KDEConnectShareURLArgV});
                            }
                            catch (error) {
                                global.logError(error);
                            }
                        });
                    }
                    
                }

                if (loadedPlugins.includes("kdeconnect_sftp")) {
                    let sftpProxySignal = {};

                    try {
                        let kdecDevSFTPProxy = new KDEConnectDeviceSFTPProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/sftp");

                        let mountMenuItem = deviceMenuItem.menu.addAction(_("Mount and Browse"), function() {

                            let isMounted = kdecDevSFTPProxy.isMountedSync()[0];
                            let mountSuccessful;

                            if (isMounted == true) {
                                let mountPoint = kdecDevSFTPProxy.mountPointSync()[0];
                                if (mountPoint !== "") {
                                    imports.misc.util.spawnCommandLine("xdg-open "+mountPoint);
                                }
                            }
                            else {
                                mountSuccessful = kdecDevSFTPProxy.mountAndWaitSync()[0];
                                if (mountSuccessful == true) {
                                    let mountPoint = kdecDevSFTPProxy.mountPointSync()[0];
                                    if (mountPoint !== "") {
                                        imports.misc.util.spawnCommandLine("xdg-open "+mountPoint);
                                    }
                                }
                                else {
                                    let mountError = kdecDevSFTPProxy.getMountErrorSync()[0];
                                    Main.notify(_("The Device couldn't be mounted!"), mountError);
                                }
                            }
                            
                        });
    
                        let unmountMenuItem = deviceMenuItem.menu.addAction(_("Unmount"), function() {
                            let isMounted = kdecDevSFTPProxy.isMountedSync()[0];

                            if (isMounted == true) {
                                kdecDevSFTPProxy.unmountSync();
                            }
                        });

                        if (kdecDevSFTPProxy.isMountedSync()[0] == true) {
                            mountMenuItem.label.set_text(_("Browse"));
                        }
                        else {
                            unmountMenuItem.setSensitive(false);
                        }
    
                        sftpProxySignal.Proxy = kdecDevSFTPProxy;
                        sftpProxySignal.MountMenuItem =  mountMenuItem;
                        sftpProxySignal.UnmountMenuItem = unmountMenuItem;
                        sftpProxySignal._onMounted = sftpProxySignal.Proxy.connectSignal("mounted", Lang.bind(sftpProxySignal, this.onMounted));
                        sftpProxySignal._onUnmounted = sftpProxySignal.Proxy.connectSignal("unmounted", Lang.bind(sftpProxySignal, this.onUnmounted));

                        this.SignalCallbackObjects["sftp"].push(sftpProxySignal);
                    }
                    catch (error) {
                        global.logError(error);
                    }
                }

                if (loadedPlugins.includes("kdeconnect_findmyphone")) {
                    deviceMenuItem.menu.addAction(_("Find My Device"), function() {
                        try {
                            let kdecDevFMPProxy = new KDEConnectDeviceFMPProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/findmyphone");
                            kdecDevFMPProxy.ringSync();
                        }
                        catch (error) {
                            global.logError(error);
                        }
                    });
                }

                if (loadedPlugins.includes("kdeconnect_photo")) {
                    let imageFilter = new FileDialog.Filter("jpeg");
                    imageFilter.addMimeType("image/jpeg");

                    deviceMenuItem.menu.addAction(_("Request Photo"), function() {
                        FileDialog.save(function(selection) {
                            let filePath = selection.replace(/\n$/, "");
                            if (filePath !== "") {
                                try {
                                    let kdecDevPhotoProxy = new KDEConnectDevicePhotoProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/photo");
                                    kdecDevPhotoProxy.requestPhotoSync(filePath);
                                    Main.notify(_("Requested photo from ${name}").replace("${name}",name), filePath);
                                }
                                catch (error) {
                                    global.logError(error);
                                }
                            }
                        }, {name: "image.jpg", filters: [imageFilter]});
                    });

                    try {
                        let signalObject = {};
                        signalObject.Proxy = new KDEConnectDevicePhotoProxy(Gio.DBus.session, "org.kde.kdeconnect", "/modules/kdeconnect/devices/"+id+"/photo");
                        signalObject._onPhotoReceived = signalObject.Proxy.connectSignal("photoReceived", Lang.bind(signalObject, this.onPhotoReceived));

                        this.SignalCallbackObjects["photo"].push(signalObject);
                    }
                    catch (error) {
                        global.logError(error);
                    }
                }

                //TODO: (MAYBE) FINDTHISDEVICE
                //TODO: (MAYBE) REMOTECONTROL
            }
        }
    },

    //Applet Callbacks
    on_applet_clicked: function() {
        if (this.onlyOneDevice) {
            this.menu.firstMenuItem.menu.open(false);
        }
		this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
		if (typeof this._onDeviceListChanged !== "undefined")
		{
			this.kdecProxy.disconnectSignal(this._onDeviceListChanged);
			delete this._onDeviceListChanged;
		}
        this.disconnectSignals();
    },

    //DBus Signal callbacks
    onDeviceListChanged: function() {
        this.updateMenu();
        global.log("["+this.metadata.uuid+"] Device list updated!");
    },

    onStateChanged: function(proxy, sender, [charging]) {
        try {
            let charge = proxy.chargeSync()[0];
            let isCharging = proxy.isChargingSync()[0];

            this.MenuItem.setIconSymbolicName(getBatteryIcon(charge, isCharging));
            this.MenuItem.label.set_text(charge+"%");
        }
        catch (error) {
            global.logError(error);
        }
    },

    onMounted: function(proxy, sender) {
        this.MountMenuItem.label.set_text(_("Browse"));
        this.UnmountMenuItem.setSensitive(true);
    },

    onUnmounted: function(proxy, sender) {
        this.MountMenuItem.label.set_text(_("Mount and Browse"));
        this.UnmountMenuItem.setSensitive(false);
    },

    onPhotoReceived: function(proxy, sender, [fileName]) {
        Main.notify(_("Photo received"), fileName);
    },

    //Reset Signals
    disconnectSignals: function() {
        for (let i = 0; i < this.SignalCallbackObjects["battery"].length; i++) {
            if (typeof this.SignalCallbackObjects["battery"][i]._onStateChanged !== "undefined") {
                this.SignalCallbackObjects["battery"][i].Proxy.disconnectSignal(this.SignalCallbackObjects["battery"][i]._onStateChanged);
                delete this.SignalCallbackObjects["battery"][i]._onStateChanged;
            }
        }

        for (let i = 0; i < this.SignalCallbackObjects["sftp"].length; i++) {
            if (typeof this.SignalCallbackObjects["sftp"][i]._onMounted !== "undefined") {
                this.SignalCallbackObjects["sftp"][i].Proxy.disconnectSignal(this.SignalCallbackObjects["sftp"][i]._onMounted);
                delete this.SignalCallbackObjects["sftp"][i]._onMounted;
            }
            if (typeof this.SignalCallbackObjects["sftp"][i]._onUnmounted !== "undefined") {
                this.SignalCallbackObjects["sftp"][i].Proxy.disconnectSignal(this.SignalCallbackObjects["sftp"][i]._onUnmounted);
                delete this.SignalCallbackObjects["sftp"][i]._onUnmounted;
            }
        }

        for (let i = 0; i < this.SignalCallbackObjects["photo"].length; i++) {
            if (typeof this.SignalCallbackObjects["photo"][i]._onPhotoReceived !== "undefined") {
                this.SignalCallbackObjects["photo"][i].Proxy.disconnectSignal(this.SignalCallbackObjects["photo"][i]._onPhotoReceived);
                delete this.SignalCallbackObjects["photo"][i]._onPhotoReceived;
            }
        }
    },

    //Misc methods
    reloadApplet: function() {
        Extension.reloadExtension(this.metadata["uuid"], Extension.Type.APPLET);
    },

    checkZenity: function() {
        try {
            let regex = /^(.+\..+\..+)\n*/;
            let [success, stdout] = GLib.spawn_command_line_sync("zenity --version");

            if (success && stdout) {
                return true;
            }
            else {
                return false;
            }
        }
        catch (error) {
            global.logError(error);
            return false;
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new KDEConnectApplet(metadata, orientation, panel_height, instance_id);
}
