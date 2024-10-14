// This extension was developed by:
// * Garlayn Toji
// Version: 1.0.0
// Date: 2024-08-07
// License: GPLv2+
// Copyright (C) 2024-2025 Garlayn Toji
// Cinnamon Vantage Cinnamon Applet

const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;

const UUID = "cinnamonvantage@garlayntoji";

// Schema keys
const FN_LOCK = 'fnLock';
const WINKEY = 'winkey';
const TOUCHPAD = 'touchpad';
const CONSERVATION_MODE = 'conservationMode';
const RAPID_CHARGE = 'rapidCharge';
const USB_CHARGING = 'usbCharging';
const OVERDRIVE = 'overdrive';
const GSYNC = 'gsync';

// File paths
const FILE_PATHS = {
    [FN_LOCK]: "/sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/fn_lock",
    [CONSERVATION_MODE]: "/sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/conservation_mode",
    [USB_CHARGING]: "/sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/usb_charging",
    [WINKEY]: "/sys/bus/platform/drivers/legion/PNP0C09:00/winkey",
    [TOUCHPAD]: "/sys/bus/platform/drivers/legion/PNP0C09:00/touchpad",
    [RAPID_CHARGE]: "/sys/bus/platform/drivers/legion/PNP0C09:00/rapidcharge",
    [OVERDRIVE]: "/sys/bus/platform/drivers/legion/PNP0C09:00/overdrive",
    [GSYNC]: "/sys/bus/platform/drivers/legion/PNP0C09:00/gsync"
};

const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    return Gettext.dgettext(UUID, str);
  }

// Define Applet and Applet settings
function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    this._fileMonitors = {};
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {
            this.set_applet_icon_symbolic_name("legion-white");
            this.set_applet_tooltip(_("Cinnamon Vantage"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Create content section
            this.contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this.contentSection);

            // Add all switches to the content section
            this.fnLockSwitch = new PopupMenu.PopupSwitchMenuItem(_("Fn Lock"));
            this.fnLockSwitch.connect('toggled', Lang.bind(this, this._onSwitchToggled, FN_LOCK));
            this.contentSection.addMenuItem(this.fnLockSwitch);

            this.winkeySwitch = new PopupMenu.PopupSwitchMenuItem(_("Super/Windows key"));
            this.winkeySwitch.connect('toggled', Lang.bind(this, this._onSwitchToggled, WINKEY));
            this.contentSection.addMenuItem(this.winkeySwitch);

            this.touchpadSwitch = new PopupMenu.PopupSwitchMenuItem(_("Touchpad"));
            this.touchpadSwitch.connect('toggled', Lang.bind(this, this._onSwitchToggled, TOUCHPAD));
            this.contentSection.addMenuItem(this.touchpadSwitch);

            this.conservationModeSwitch = new PopupMenu.PopupSwitchMenuItem(_("Battery conservation mode"));
            this.conservationModeSwitch.connect('toggled', Lang.bind(this, this._onSwitchToggled, CONSERVATION_MODE));
            this.contentSection.addMenuItem(this.conservationModeSwitch);

            this.rapidChargeSwitch = new PopupMenu.PopupSwitchMenuItem(_("Battery fast charge mode"));
            this.rapidChargeSwitch.connect('toggled', Lang.bind(this, this._onSwitchToggled, RAPID_CHARGE));
            this.contentSection.addMenuItem(this.rapidChargeSwitch);

            this.usbChargingSwitch = new PopupMenu.PopupSwitchMenuItem(_("Always On USB"));
            this.usbChargingSwitch.connect('toggled', Lang.bind(this, this._onSwitchToggled, USB_CHARGING));
            this.contentSection.addMenuItem(this.usbChargingSwitch);

            this.overdriveSwitch = new PopupMenu.PopupSwitchMenuItem(_("Display Overdrive"));
            this.overdriveSwitch.connect('toggled', Lang.bind(this, this._onSwitchToggled, OVERDRIVE));
            this.contentSection.addMenuItem(this.overdriveSwitch);

            this.gsyncSwitch = new PopupMenu.PopupSwitchMenuItem(_("Hybrid graphics mode"));
            this.gsyncSwitch.connect('toggled', Lang.bind(this, this._onSwitchToggled, GSYNC));
            this.contentSection.addMenuItem(this.gsyncSwitch);

            // Read initial states from files
            this._loadInitialStates();

            // Start file monitoring
            this._monitorFiles();

            //Add listeners for settings changes
            this.settings.connect(`changed::${FN_LOCK}`, Lang.bind(this, this._onSettingsChanged, FN_LOCK));
            this.settings.connect(`changed::${WINKEY}`, Lang.bind(this, this._onSettingsChanged, WINKEY));
            this.settings.connect(`changed::${TOUCHPAD}`, Lang.bind(this, this._onSettingsChanged, TOUCHPAD));
            this.settings.connect(`changed::${CONSERVATION_MODE}`, Lang.bind(this, this._onSettingsChanged, CONSERVATION_MODE));
            this.settings.connect(`changed::${RAPID_CHARGE}`, Lang.bind(this, this._onSettingsChanged, RAPID_CHARGE));
            this.settings.connect(`changed::${USB_CHARGING}`, Lang.bind(this, this._onSettingsChanged, USB_CHARGING));
            this.settings.connect(`changed::${OVERDRIVE}`, Lang.bind(this, this._onSettingsChanged, OVERDRIVE));
            this.settings.connect(`changed::${GSYNC}`, Lang.bind(this, this._onSettingsChanged, GSYNC));

        } catch (e) {
            globalThis.logError(e);
        }
    },

    // Applet clicked event, shows dropdown menu
    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    // Reads initial states of hardware settings and applies to applet switches
    _loadInitialStates: function() {
        for (let key in FILE_PATHS) {
            this._readFileStateAndUpdate(key);
        }
    },

    // Reads the state from a file and updates the corresponding switch
    _readFileStateAndUpdate: function(key) {
        let filePath = FILE_PATHS[key];
        try {
            let content = GLib.file_get_contents(filePath)[1].toString().trim();
            let value = content === "1";
            this.settings.setValue(key, value);
            this._updateSwitchState(key, value);
        } catch (e) {
            globalThis.logError(`Error reading file ${filePath}: ${e}`);
        }
    },

    // Monitors the files for changes
    _monitorFiles: function() {
        for (let key in FILE_PATHS) {
            let filePath = FILE_PATHS[key];
            let file = Gio.File.new_for_path(filePath);
            this._fileMonitors[key] = file.monitor_file(Gio.FileMonitorFlags.NONE, null);

            this._fileMonitors[key].connect('changed', Lang.bind(this, function(monitor, file, other_file, event_type) {
                if (event_type === Gio.FileMonitorEvent.CHANGES_DONE_HINT) {
                    this._readFileStateAndUpdate(key);
                }
            }));
        }
    },

    // Update switch state for every switch
    _updateSwitchState: function(key, state) {
        switch (key) {
            case FN_LOCK:
                this.fnLockSwitch.setToggleState(state);
                break;
            case WINKEY:
                this.winkeySwitch.setToggleState(state);
                break;
            case TOUCHPAD:
                this.touchpadSwitch.setToggleState(state);
                break;
            case CONSERVATION_MODE:
                this.conservationModeSwitch.setToggleState(state);
                break;
            case RAPID_CHARGE:
                this.rapidChargeSwitch.setToggleState(state);
                break;
            case USB_CHARGING:
                this.usbChargingSwitch.setToggleState(state);
                break;
            case OVERDRIVE:
                this.overdriveSwitch.setToggleState(state);
                break;
            case GSYNC:
                this.gsyncSwitch.setToggleState(state);
                break;
        }
    },

    // Changing driver file's content upon switch toggle event from dropdown menu
    _onSwitchToggled: function(item, state, key) {
        let previousState = this.settings.getValue(key);
        let filePath = FILE_PATHS[key];
        let value = state ? "1" : "0";
        let command = `pkexec sh -c "echo '${value}' > ${filePath}"`;

        Util.spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                // Command succeeded, update the state in settings
                this.settings.setValue(key, state);
                if (key === GSYNC) {
                    this._showRestartNotification();
                }
            } else {
                // Command failed, revert the switch state
                this._updateSwitchState(key, previousState);
                globalThis.logError(`Failed to write to file ${filePath}: ${stderr}`);
            }
        });
    },

    // Changing driver file's content upon switch toggle event from settings page
    _onSettingsChanged: function(settings, key) {
        let state = this.settings.getValue(key);
        let filePath = FILE_PATHS[key];
        let value = state ? "1" : "0";
        let command = `pkexec sh -c "echo '${value}' > ${filePath}"`;

        Util.spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                // Command succeeded, update the state in the applet
                this._updateSwitchState(key, state);
                if (key === GSYNC) {
                    this._showRestartNotification();
                }
            } else {
                // Command failed, revert the switch state
                let previousState = !state;
                this.settings.setValue(key, previousState);
                globalThis.logError(`Failed to write to file ${filePath}: ${stderr}`);
            }
        });
    },

    _showRestartNotification: function() {
        try {
            let notification = new MessageTray.Notification(
                new MessageTray.Source(_("CinnamonVantage"), "legion-white"),
                _("System reboot required"),
                _("A system reboot is required for this change to take effect.")
            );
            notification.setTransient(true);  // This makes the notification auto-dismiss after a short time
            Main.messageTray.add(notification);
            notification.show();
        } catch (e) {
            globalThis.logError(`Error showing restart notification: ${e}`);
        }
    }
    
};

// Initialize applet
function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
