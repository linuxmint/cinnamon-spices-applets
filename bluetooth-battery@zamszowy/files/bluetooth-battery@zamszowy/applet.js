const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Lang = imports.lang;

const xml ='<node>\
   <interface name="org.freedesktop.UPower.Device">\
      <property name="Type" type="u" access="read" />\
      <property name="State" type="u" access="read" />\
      <property name="Percentage" type="d" access="read" />\
      <property name="IsPresent" type="b" access="read" />\
      <property name="IconName" type="s" access="read" />\
   </interface>\
</node>';
const {Gio, UPowerGlib: UPower} = imports.gi;
const PowerManagerProxy = Gio.DBusProxy.makeProxyWrapper(xml);
const { messageTray } = imports.ui.main;
const { SystemNotificationSource, Notification, Urgency } = imports.ui.messageTray;

var dbusCon;

function BtBattery(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

BtBattery.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init_dbus: function() {

        let proxy = new	PowerManagerProxy(Gio.DBus.system,
            'org.freedesktop.UPower',
            '/org/freedesktop/UPower',
                (proxy, error) => {
                    if (error) {
                        return;
                    }
                }
            );
        dbusCon = proxy.get_connection();
        this.dbusAdd = dbusCon.signal_subscribe('org.freedesktop.UPower', 'org.freedesktop.UPower', 'DeviceAdded', null, null, 0, () => {
            this.setup();
        });
        this.dbusRemove = dbusCon.signal_subscribe('org.freedesktop.UPower', 'org.freedesktop.UPower', 'DeviceRemoved', null, null, 0, () => {
            this.setup();
        });

        this.dbus_map = new Map();
        this.dbus_map[Symbol.iterator] = function* () {
            yield* [...this.entries()].sort((a, b) => b[1].device.percentage - a[1].device.percentage);
        }
        this.monitored_devs = new Array();
    },

    _init_notifications: function() {
        this.MessageSource = new SystemNotificationSource("Bluetooth Battery");
        messageTray.add(this.MessageSource);

        this.settings.bind("notification-warn-enable", "notification_warn_enable", this._on_settings_change, null);
        this.settings.bind("notification-warn-level", "notification_warn_level", null, null);
        this.settings.bind("notification-crit-enable", "notification_crit_enable", this._on_settings_change, null);
        this.settings.bind("notification-crit-level", "notification_crit_level", null, null);
        this.settings.bind("notification-filter", "notification_filter", null, null);
        this.settings.bind("notification-applet-icon", "notification_applet_icon", this._on_settings_change, null);

        this.notified_devices = new Map();
    },

    _init: function(metadata, orientation, panel_height, instance_id) {
        this.applet_path = metadata.path;

        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("battery-100");
        this.set_applet_tooltip(_("Show devices battery levels"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("enable-keyboards", "enable_keyboards", this._on_settings_change, null);
        this.settings.bind("enable-mice", "enable_mice", this._on_settings_change, null);
        this.settings.bind("enable-headphones", "enable_headphones", this._on_settings_change, null);
        this.settings.bind("enable-others", "enable_others", this._on_settings_change, null);
        this.settings.bind("applet-icon", "applet_icon", this._on_settings_change, null);
        this.settings.bind("blacklist", "blacklist", null, null);
        this.settings.bind("override-entry", "override_entry", null, null);
        this.settings.bind("override-enable", "override_enabled", this.on_override_enable, null);

        this._init_dbus();
        this._init_notifications();

        this.setup();
    },

    _on_settings_change: function() {
        this.setup();
        this.check_override_device();
    },

    on_override_enable: function() {
        this.check_override_device();
        this.setup();
    },

    check_override_device: function() {
        if (!this.override_enabled) {
            return;
        }

        if (!this.monitored_devs.includes(this.override_entry)) {
            // entry in settings page seems to be refreshing only when external process returns after a while
            Util.spawn_async(['/usr/bin/sleep', "2"], Lang.bind(this, function(stdout){
                this.override_entry = this.monitored_devs.length > 0 ? this.monitored_devs[0] : "(no device available)";
                this.setup(false);
            }));
        }
    },

    _on_override_select: function() {
        let args = new Array();
        args.push('/usr/bin/cjs');
        args.push(this.applet_path + '/override-select.js');

        if (this.monitored_devs.length > 0) {
            for (const dev of this.monitored_devs) {
                args.push(dev);
            }
            // push active item index as last arg
            if (this.monitored_devs.includes(this.override_entry)) {
                args.push(this.monitored_devs.indexOf(this.override_entry).toString());
            } else {
                args.push("0");
            }
        } else {
            args.push('(no device available)');
        }

        Util.spawn_async(args, Lang.bind(this, function(stdout) {
            const trimmed_out = stdout.trim();

            if (trimmed_out != "") {
                this.override_entry = trimmed_out;
                this.setup();
            }
        }));
    },

    _on_notification_warn_demo: function() {
        this.notify("Test notification", "Battery dropped below " + this.notification_warn_level + "%",
            this.get_device_batt_icon(UPower.DeviceKind.KEYBOARD, this.notification_warn_level), Urgency.NORMAL);
    },

    _on_notification_crit_demo: function() {
        this.notify("Test notification", "Battery dropped below " + this.notification_crit_level + "%",
            this.get_device_batt_icon(UPower.DeviceKind.MOUSE, this.notification_crit_level), Urgency.CRITICAL);
    },

    on_applet_clicked: function() {
        this.setup();
        if (this.monitored_devs.length > 0) {
            this.menu.toggle();
        }
    },

    on_applet_removed: function() {
        this.settings.finalize();
    },

    notify: function(title, message, icon_name, urgency = Urgency.NORMAL) {
        let icon = new St.Icon({ icon_name: icon_name,
        icon_type: St.IconType.FULLCOLOR,
        icon_size: 16 });

        const notification = new Notification(this.MessageSource, title, message, {icon: icon });
        notification.setTransient(false);
        notification.setUrgency(urgency);
        this.MessageSource.notify(notification);
    },

    setup: function(check_override = true) {
        this.menu.removeAll();
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        if (check_override) {
            this.check_override_device();
        }

        this.setup_dbus();
    },

    blacklist_containes_any: function(dev) {
        return !((!dev.serial || !this.blacklist.includes(dev.serial)) && (!dev.model || !this.blacklist.includes(dev.model)));
    },

    blacklist_add: function(dev, active) {
        if (!this.blacklist_containes_any(dev)) {
            this.blacklist += (this.blacklist ? "\n" : "") + (active ? "" : "# ") + (dev.model ? dev.model : dev.serial);
        }
    },

    blacklist_containes_active: function(dev) {
        var containes = false;
        const arr = this.blacklist.split("\n");
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].startsWith("#")) {
                continue;
            } else if ((dev.serial && arr[i] == dev.serial) || (dev.model && arr[i] == dev.model)) {
                containes = true;
                break;
            }
        }

        return containes;
    },

    blacklist_containes_inactive: function(dev) {
        return this.blacklist_containes_any(dev) && !this.blacklist_containes_active(dev);
    },

    notify_if_needed: function() {
        if (!this.notification_warn_enable && !this.notification_crit_enable) {
            return;
        }

        for (const dev of this.monitored_devs) {
            if (!this.dbus_map.has(dev)) {
                continue;
            }

            const device = this.dbus_map.get(dev).device;
            let notified_warn = this.notified_devices.has(dev) ? this.notified_devices.get(dev).warn : false;
            let notified_crit = this.notified_devices.has(dev) ? this.notified_devices.get(dev).crit : false;

            if (!this.notified_devices.has(dev) && device.percentage == 0) {
                // device connected for the first time with 0% battery - seems like some kind of bug,
                // let's add it when it will report something else
                continue;
            }

            if (device.percentage >= this.notification_warn_level + this.notification_filter) {
                // device recharged, enable notification
                notified_warn = false;
            } else if (this.notification_warn_enable && !notified_warn && device.percentage < this.notification_warn_level) {
                this.notify(dev + " (" + device.percentage + "%)", "Battery dropped below " + this.notification_warn_level + "%",
                    this.get_device_batt_icon(device.kind, device.percentage));

                notified_warn = true;
            }

            if (device.percentage >= this.notification_crit_level + this.notification_filter) {
                // device recharged, enable notification
                notified_crit = false;
            } else if (this.notification_crit_enable && !notified_crit && device.percentage < this.notification_crit_level) {
                this.notify(dev + " (" + device.percentage + "%)", "Battery dropped below " + this.notification_crit_level + "%",
                    this.get_device_batt_icon(device.kind, device.percentage));

                notified_crit = true;
            }

            this.notified_devices.set(dev, {warn: notified_warn, crit: notified_crit});
        }
    },

    setup_dbus: function() {
        this.monitored_devs = new Array();

        for (let [ident, props] of this.dbus_map) {
            this.dbus_map.set(ident, {device: props.device, proxy: props.proxy, updated: false});
        }

        var upowerClient = UPower.Client.new_full(null);
        var devices = upowerClient.get_devices();
        for (let i=0; i < devices.length; i++) {
            let dev = devices[i];

            if ((!dev.model && !dev.serial) || this.blacklist_containes_active(dev)) {
                // skip entirely blacklisted devices or the ones without model and serial
                continue;
            }

            if (dev.kind != UPower.DeviceKind.MOUSE
                && dev.kind != UPower.DeviceKind.KEYBOARD
                && dev.kind != UPower.DeviceKind.GAMING_INPUT
                && dev.kind != UPower.DeviceKind.PHONE
                && dev.kind != UPower.DeviceKind.HEADPHONES
                && dev.kind != UPower.DeviceKind.MEDIA_PLAYER) {

                // blacklist by default non mouse/kb/phone/gaming input/mediaplayer/headphones devices
                // and then skip them (if not commented out of blacklist)
                if (!this.blacklist_containes_inactive(dev)) {
                    this.blacklist_add(dev, true);
                    continue;
                }
            } else {
                this.blacklist_add(dev, false);
            }

            const dev_ident = dev.model ? dev.model : dev.serial;
            if (this.dbus_map.has(dev_ident)) {
                let d = this.dbus_map.get(dev_ident);
                this.dbus_map.set(dev_ident, {device: d.device, proxy: d.proxy, updated: true});
            } else {
                try {
                    let proxy = new	PowerManagerProxy(Gio.DBus.system, 'org.freedesktop.UPower',
                        dev.get_object_path(),
                        (proxy, error) => {
                            if (error) {
                                return;
                            }
                            proxy.connect('g-properties-changed', this.setup.bind(this));
                        }
                    );
                    this.dbus_map.set(dev_ident, {device: dev, proxy: proxy, updated: true});
                } catch (err) {
                    continue;
                }
            }
        }

        for (let [ident, props] of this.dbus_map) {
            if (!props.updated) {
                this.dbus_map.delete(ident);
            }
        }

        if (this.dbus_map.size == 0) {
            this.set_applet_enabled(false);
            return;
        } else {
            this.set_applet_enabled(true);
        }

        for (let [ident, props] of this.dbus_map) {
            let dev = props.device;

            if (dev.battery_level != UPower.DeviceLevel.NONE) {
                continue;
            }

            const name = ident;
            const perc = dev.percentage;
            const type = dev.kind;

            if ((type == UPower.DeviceKind.KEYBOARD && !this.enable_keyboards)
                || (type == UPower.DeviceKind.MOUSE && !this.enable_mice)
                || (type == UPower.DeviceKind.HEADPHONES && !this.enable_headphones)
                || (type != UPower.DeviceKind.KEYBOARD && type != UPower.DeviceKind.MOUSE && type != UPower.DeviceKind.HEADPHONES && !this.enable_others))
            {
                continue;
            }

            let ii = new PopupMenu.PopupIconMenuItem(name, this.get_device_batt_icon(type, perc), St.IconType.FULLCOLOR);
            let perc_label = new St.Label({text: perc + "%"});
            ii.connect('activate', Lang.bind(this, function() { Util.spawn_async(['/usr/bin/cjs', this.applet_path + '/dev-info-window.js', ident, dev.to_text()]); }));
            ii.addActor(perc_label, {align: St.Align.END});
            this.menu.addMenuItem(ii);

            this.monitored_devs.push(name);
        }

        if (this.monitored_devs == 0) {
            this.set_applet_enabled(false);
        } else {
            const [min_name, min_kind, min_perc] = this.get_lowest_battery_device();

            if ((this.notification_applet_icon == "warn" && this.notification_warn_enable && min_perc >= this.notification_warn_level)
                || (this.notification_applet_icon == "crit" && this.notification_crit_enable && min_perc >= this.notification_crit_level)) {
                this.set_applet_enabled(false);
            } else {
                this.set_applet_enabled(true);
                if (this.override_enabled
                    && this.monitored_devs.includes(this.override_entry)
                    && this.dbus_map.has(this.override_entry)) {

                    let d = this.dbus_map.get(this.override_entry).device;
                    this.show_hide_text_icon(this.override_entry, d.kind, d.percentage);
                } else {
                    this.show_hide_text_icon(min_name, min_kind, min_perc);
                }
            }
        }

        this.notify_if_needed();
    },

    show_hide_text_icon: function(name, kind, perc) {
        this.set_applet_label(perc.toString() + "%");
        this.set_applet_icon_name(this.get_device_batt_icon(kind, perc));
        this.set_applet_tooltip(name.toString());

        if (this.applet_icon == "text") {
            this.hide_applet_icon();
        } else if (this.applet_icon == "icon") {
            this.hide_applet_label(true);
        }
    },

    get_lowest_battery_device: function() {
        if (this.monitored_devs.length == 0) {
            return null;
        }

        let lowest_bat_dev_ident = null;
        let lowest_bat_dev = null;

        this.monitored_devs.forEach((name) => {
            if (!this.dbus_map.has(name)) {
                return;
            }

            const dev = this.dbus_map.get(name).device;
            if (lowest_bat_dev == null || dev.percentage <= lowest_bat_dev.percentage) {
                lowest_bat_dev = dev;
                lowest_bat_dev_ident = name;
            }
        });

        return [lowest_bat_dev_ident, lowest_bat_dev.kind, lowest_bat_dev.percentage];
    },

    get_device_batt_icon: function(type, batt) {
        if (type == UPower.DeviceKind.KEYBOARD) {
            return "keyboard-" + this.perc_to_3_digit_str(this.perc_round_to_10(batt));
        } else if (type == UPower.DeviceKind.MOUSE) {
            return "mouse-" + this.perc_to_3_digit_str(this.perc_round_to_10(batt));
        } else if (type == UPower.DeviceKind.HEADPHONES) {
            return "headphones-" + this.perc_to_3_digit_str(this.perc_round_to_10(batt));
        } else {
            return "battery-" + this.perc_to_3_digit_str(this.perc_round_to_10(batt));
        }
    },

    perc_round_to_20: function(perc) {
        const perc_rounded = Math.floor(perc / 10) * 10;

        if (perc_rounded % 20 == 0) {
            return perc_rounded;
        }

        const up_dist = Math.abs((perc_rounded + (perc_rounded != 100 ? 10 : 0)) - perc)
        const down_dist = Math.abs(perc - (perc_rounded - (perc_rounded != 0 ? 10 : 0)))

        let plus_step = 0;
        if (down_dist < up_dist) {
            plus_step = -10;
        } else {
            plus_step = 10;
        }

        return Math.max(Math.min(perc_rounded + plus_step, 100), 0);
    },

    perc_round_to_10: function(perc) {
        return Math.round(perc / 10) * 10;
    },

    perc_to_3_digit_str: function(perc) {
        let str = "";
        if (perc == 100) {
            str = "100";
        } else if (perc < 10) {
            str = "00" + perc.toString();
        } else {
            str = "0" + perc.toString();
        }

        return str;
    },
};


function main(metadata, orientation, panel_height, instance_id) {
    return new BtBattery(metadata, orientation, panel_height, instance_id);
}
