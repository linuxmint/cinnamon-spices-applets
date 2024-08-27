const Lang = imports.lang;
const Util = imports.misc.util;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const SignalManager = imports.misc.signalManager;
const PopupMenu = imports.ui.popupMenu;

const UUID = "tapo@smiklosovic";
const TOGGLE_DEVICE_SCRIPT = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + UUID + "/devices.sh";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

/** @type QUtils */
const QUtils = require('./js/QUtils.js');

const QIcon = QUtils.QIcon;
const QPopupHeader = QUtils.QPopupHeader;
const QPopupIconBar = QUtils.QPopupIconBar;
const QPopupSlider = QUtils.QPopupSlider;
const QPopupSwitch = QUtils.QPopupSwitch;

const deviceSwitches = {};

function _(str) {
    return Gettext.dgettext(UUID, str);
}

class TapoApplet extends Applet.TextIconApplet {

    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this.opt = {
            enabled: false,
            devices: {},
            authToken: ""
        };

        // Bind Settings
        this.settings = new Settings.AppletSettings(this.opt, metadata.uuid, instanceId);
        this.settings.getDesc = function(key) {
            if (this.settingsData[key] && this.settingsData[key].description) {
                return this.settingsData[key].description;
            }
            return '';
        };

        this.settings.bind('service-url', 'service-url', this.onServiceUrlChange.bind(this));
        this.settings.bind('password', 'password', this.onPasswordChange.bind(this));
        this.settings.bind('device-names', 'device-names', this.onSettChange.bind(this));

        this.opt.serviceUrl = this.settings.getValue("service-url");
        this.opt.password = this.settings.getValue("password");

        this.performLogin();

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.signalManager = new SignalManager.SignalManager(null);

        // Icon Box to contain the icon and the count down label
        let iconSize = this.getPanelIconSize(St.IconType.SYMBOLIC);

        this._iconBox = new St.Group({
            natural_width: iconSize,
            natural_height: iconSize,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });

        // Create the icon and it's container
        this.actor.add_actor(this._iconBox);
        this._iconBin = new St.Bin();
        this._iconBin._delegate = this;
        this._iconBox.add_actor(this._iconBin);
        this.updateIcon();

        this.set_applet_tooltip(_("Tapo Control Panel"));
        this.signalManager.connect(this.settings, "changed::fullcolor-icon", this.updateIcon, this);

        // build menu

        let reload_btn = new PopupMenu.PopupIconMenuItem(_("Reload Applet"), 'view-refresh-symbolic', QIcon.SYMBOLIC, {hover: true});
        reload_btn.connect('activate', this.reloadApplet.bind(this));
        this._applet_context_menu.addMenuItem(reload_btn);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.appMenu = this.menu;
        this.createPopup();
    }

    statusCheck() {
        let numberOfDevices = Object.keys(this.opt.devices).length;
        let turnedOn = 0;
        let turnedOff = 0;
        for (let device of Object.keys(this.opt.devices)) {
            let state = this.getDeviceState(device);

            if (state === "false") {
                if (this.opt.devices[device]) {
                    deviceSwitches[device].setToggleState(false);
                    this.opt.devices[device] = false;

                }
                turnedOff = turnedOff + 1;
            } else {
                if (!this.opt.devices[device]) {
                    deviceSwitches[device].setToggleState(true);
                    this.opt.devices[device] = true;
                }
                turnedOn = turnedOn + 1;
            }
        }

        if (numberOfDevices == turnedOn) {
            this.opt.enabled = true;
            this.enabledDay.setToggleState(true);
        } else if (numberOfDevices == turnedOff) {
            this.opt.enabled = false;
            this.enabledDay.setToggleState(false);
        }
    }

    onServiceUrlChange() {
      this.opt.serviceUrl = this.settings.getValue("service-url");
    }

    onPasswordChange() {
       this.opt.password = this.settings.getValue("password");
    }

    onSettChange(value) {
        this.destroyPopup();
        this.createPopup();
    }

    performLogin() {
        let [a, stdout, c, d] = GLib.spawn_command_line_sync("/bin/bash -c '" + TOGGLE_DEVICE_SCRIPT + " login " + this.opt.serviceUrl + " " + this.opt.password + "'");
        let loginResponse = stdout.toString();
        if (loginResponse === "error") {
           return;
        }
        this.opt.authToken = loginResponse;
    }

    populateDevices() {
        
        let devicesSetting = this.settings.getValue("device-names");
        if (devicesSetting != null && devicesSetting.length != 0)
        {
          let deviceNames = devicesSetting.split(',');
          if (deviceNames.length == 1 && deviceNames[0].length == 0) {
             return;
          }
          for (let key in this.opt.devices) {
              delete this.opt.devices[key];
          }
          for (let device of deviceNames) {
              if (device.length != 0) {
                this.opt.devices[device] = false;
              }
          }
        }
    }

    destroyPopup() {
       this.menu.removeAll();
    }

    createPopup() {

        this.populateDevices();

        if (Object.keys(this.opt.devices).length == 0) {
            return;
        }

        this.enabledDay = new QPopupSwitch({
            label: _("All devices"),
            active: this.opt.enabled
        });

        this.enabledDay.connect('toggled', function(item, state) {
            this.opt.enabled = state;
            this.doGlobalToggle();
        }.bind(this));

        this.menu.addMenuItem(this.enabledDay);

        for (let device of Object.keys(this.opt.devices)) {

            deviceSwitches[device] = new QPopupSwitch({
                label: _(device),
                active: this.opt.devices[device]
            });
            deviceSwitches[device].connect('toggled', function(item, state) {
                this.opt.devices[device] = state;
                this.doUpdate();
            }.bind(this));
            this.menu.addMenuItem(deviceSwitches[device]);
        }
    }

    doGlobalToggle() {
        if (this.opt.enabled) {
            for (let device of Object.keys(this.opt.devices)) {
                this.toggleDevice(device, 'on');
                this.opt.devices[device] = true;
                deviceSwitches[device].setToggleState(true);
            }
        } else {
            for (let device of Object.keys(this.opt.devices)) {
                this.toggleDevice(device, 'off');
                this.opt.devices[device] = false;
                deviceSwitches[device].setToggleState(false);
            }
        }
    }

    doUpdate() {
        Object.keys(this.opt.devices).forEach(key => {
            if (this.opt.devices[key]) {
                this.toggleDevice(key, 'on');
            } else {
                this.toggleDevice(key, 'off');
            }
        });
    }

    // device interaction

    toggleDevice(device_name, state) {
        GLib.spawn_command_line_async("/bin/bash -c '" + TOGGLE_DEVICE_SCRIPT + " " + device_name + " " + state + " " + this.opt.serviceUrl + " " + this.opt.authToken + "'");
    }

    getDeviceState(device_name) {
        let [a, stdout, c, d] = GLib.spawn_command_line_sync("/bin/bash -c '" + TOGGLE_DEVICE_SCRIPT + " " + device_name + " status " + this.opt.serviceUrl + " " + this.opt.authToken + "'");
        return stdout.toString();
    }

    // applet specific

    on_applet_clicked(event) {
        this.statusCheck();
        this.menu.toggle();
    }

    updateIcon() {
        if (this._icon) {
            this._icon.destroy();
        }

        let iconSize = this.getPanelIconSize(St.IconType.SYMBOLIC);
        this._icon = new St.Icon({
            icon_name: "weather-clear-night",
            icon_type: St.IconType.SYMBOLIC,
            reactive: true,
            track_hover: true,
            style_class: 'applet-icon'
        });

        this._iconBin.set_child(this._icon);
        this.on_panel_icon_size_changed()
    }

    on_panel_icon_size_changed() {
        let iconSize = this.getPanelIconSize(St.IconType.SYMBOLIC);
        this._iconBox.set_size(iconSize, iconSize);
        this._icon.set_icon_size(iconSize);
    }

    reloadApplet() {
        let cmd = `/usr/bin/cinnamon-dbus-command ReloadXlet '${this.metadata.uuid}' APPLET`;
        Util.spawnCommandLine(cmd);
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new TapoApplet(metadata, orientation, panelHeight, instanceId);
}
