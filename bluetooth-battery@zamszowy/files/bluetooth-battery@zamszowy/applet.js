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
        this.settings.bindProperty(Settings.BindingDirection.IN, "enable-keyboards", "enable_keyboards", this._on_settings_change, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "enable-mice", "enable_mice", this._on_settings_change, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "enable-headphones", "enable_headphones", this._on_settings_change, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "enable-others", "enable_others", this._on_settings_change, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "applet-icon", "applet_icon", this._on_settings_change, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "blacklist", "blacklist", null, null);

        this._init_dbus();

        this.setup();
    },

    _on_settings_change: function() {
        this.setup();
    },

    on_applet_clicked: function() {
        this.setup();
        if (this.added_count > 0) {
            this.menu.toggle();
        }
    },

    setup: function() {
        this.menu.removeAll();
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        this.setup_dbus();
    },

    blacklist_add: function(dev, active) {
        if ((!dev.serial || !this.blacklist.includes(dev.serial)) && (!dev.model || !this.blacklist.includes(dev.model))) {
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

    setup_dbus: function() {
        for (let [ident, props] of this.dbus_map) {
            this.dbus_map.set(ident, {device: props.device, proxy: props.proxy, updated: false});
        }

        var upowerClient = UPower.Client.new_full(null);
        var devices = upowerClient.get_devices();
        for (let i=0; i < devices.length; i++) {
            let dev = devices[i]
            if (dev.kind != UPower.DeviceKind.MOUSE
                && dev.kind != UPower.DeviceKind.KEYBOARD
                && dev.kind != UPower.DeviceKind.GAMING_INPUT
                && dev.kind != UPower.DeviceKind.PHONE
                && dev.kind != UPower.DeviceKind.HEADPHONES
                && dev.kind != UPower.DeviceKind.MEDIA_PLAYER) {

                if (dev.model || dev.serial) {
                    // blacklist by default non mouse/kb/phone/gaming input/mediaplayer devices
                    this.blacklist_add(dev, true);
                } else {
                    // skip entirely devices without model and serial
                    continue;
                }
            }

            if (this.blacklist_containes_active(dev)) {
                continue;
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

        let bat_min_perc = "100";
        let bat_min_type = UPower.DeviceKind.UNKNOWN;
        let bat_min_name = "unknown";
        this.added_count = 0;

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

            if (perc <= bat_min_perc) {
                bat_min_perc = perc;
                bat_min_name = name;
                bat_min_type = type;
            }

            this.added_count += 1;
        }

        if (this.added_count > 0) {
            this.set_applet_label(bat_min_perc.toString() + "%");
            this.set_applet_icon_name(this.get_device_batt_icon(bat_min_type, bat_min_perc));
            this.set_applet_tooltip(bat_min_name.toString());

            if (this.applet_icon == "text") {
                this.hide_applet_icon();
            } else if (this.applet_icon == "icon") {
                this.hide_applet_label(true);
            } else {

            }
        } else {
            this.set_applet_label("");
            this.set_applet_tooltip("all BT devices has been disabled");
            this.set_applet_icon_name("bluetooth-disabled");
        }
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
