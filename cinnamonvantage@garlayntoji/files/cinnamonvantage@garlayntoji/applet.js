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
const St = imports.gi.St;

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
const CHARGE_LIMIT_ENABLED = 'chargeLimitEnabled';
const CHARGE_LIMIT = 'chargeLimit';

// Charge limit constants
const CHARGE_LIMIT_MIN = 60;
const CHARGE_LIMIT_MAX = 100;
const CHARGE_LIMIT_HYSTERESIS = 5;
const CHARGE_LIMIT_POLL_SECONDS = 20;
const CHARGE_LIMIT_COMMIT_MS = 300;

// File paths
const FILE_PATHS = {
    [FN_LOCK]: "/sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/fn_lock",
    [CONSERVATION_MODE]: "/sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/conservation_mode",
    [USB_CHARGING]: "/sys/bus/platform/drivers/ideapad_acpi/VPC2004:00/usb_charging",
    [WINKEY]: "/sys/devices/platform/legion/winkey",
    [TOUCHPAD]: "/sys/devices/platform/legion/touchpad",
    [RAPID_CHARGE]: "/sys/devices/platform/legion/rapidcharge",
    [OVERDRIVE]: "/sys/devices/platform/legion/overdrive",
    [GSYNC]: "/sys/devices/platform/legion/gsync"
};

function findBatteryPath() {
    let fallback = null;
    for (let i = 0; i < 10; i++) {
        let path = "/sys/class/power_supply/BAT" + i;
        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) continue;
        if (fallback === null) fallback = path;
        if (GLib.file_test(path + "/charge_types", GLib.FileTest.EXISTS)) return path;
    }
    return fallback || "/sys/class/power_supply/BAT1";
}

function findAcPath() {
    let names = ["ACAD", "AC", "ADP1", "ADP0"];
    for (let i = 0; i < names.length; i++) {
        let path = "/sys/class/power_supply/" + names[i];
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) return path;
    }
    return "/sys/class/power_supply/ACAD";
}

const BATTERY_PATH = findBatteryPath();
const AC_PATH = findAcPath();
const BATTERY_CAPACITY = BATTERY_PATH + "/capacity";
const CHARGE_TYPES = BATTERY_PATH + "/charge_types";

const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    return Gettext.dgettext(UUID, str);
  }

// Define Applet and Applet settings
function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    this._fileMonitors = {};
    this._chargeLimitTimer = 0;
    this._chargeLimitCommitTimeout = 0;
    this._chargeLimitWriting = false;
    this._chargeLimitForce = false;
    this._chargeLimitSyncing = false;
    this._chargeLimitErrorShown = false;
    this._chargeLimitPermissionNoticeShown = false;
    this._chargeLimitEnabled = false;
    this._chargeLimit = 80;
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

            this.contentSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.chargeLimitSwitch = new PopupMenu.PopupSwitchMenuItem(_("Limit battery charge"));
            this.chargeLimitSwitch.connect('toggled', Lang.bind(this, this._onChargeLimitToggled));
            this.contentSection.addMenuItem(this.chargeLimitSwitch);

            this.chargeLimitStatus = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.contentSection.addMenuItem(this.chargeLimitStatus);

            this.chargeLimitLabel = new PopupMenu.PopupMenuItem("", { reactive: false });
            this.contentSection.addMenuItem(this.chargeLimitLabel);

            this.chargeLimitSlider = new PopupMenu.PopupSliderMenuItem(0);
            this.chargeLimitSlider.connect('value-changed', Lang.bind(this, this._onChargeLimitSliderChanged));
            this.contentSection.addMenuItem(this.chargeLimitSlider);

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

            this._readChargeLimitSettings();
            this._syncChargeLimitUI();
            this._updateChargeLimitStatus();
            this._chargeLimitForce = this._chargeLimitEnabled;
            this._applyChargeLimit();

            this._chargeLimitTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, CHARGE_LIMIT_POLL_SECONDS, Lang.bind(this, function() {
                this._updateChargeLimitStatus();
                this._applyChargeLimit();
                return true;
            }));

            //Add listeners for settings changes
            this.settings.connect(`changed::${FN_LOCK}`, Lang.bind(this, this._onSettingsChanged, FN_LOCK));
            this.settings.connect(`changed::${WINKEY}`, Lang.bind(this, this._onSettingsChanged, WINKEY));
            this.settings.connect(`changed::${TOUCHPAD}`, Lang.bind(this, this._onSettingsChanged, TOUCHPAD));
            this.settings.connect(`changed::${CONSERVATION_MODE}`, Lang.bind(this, this._onSettingsChanged, CONSERVATION_MODE));
            this.settings.connect(`changed::${RAPID_CHARGE}`, Lang.bind(this, this._onSettingsChanged, RAPID_CHARGE));
            this.settings.connect(`changed::${USB_CHARGING}`, Lang.bind(this, this._onSettingsChanged, USB_CHARGING));
            this.settings.connect(`changed::${OVERDRIVE}`, Lang.bind(this, this._onSettingsChanged, OVERDRIVE));
            this.settings.connect(`changed::${GSYNC}`, Lang.bind(this, this._onSettingsChanged, GSYNC));
            this.settings.connect(`changed::${CHARGE_LIMIT_ENABLED}`, Lang.bind(this, this._onChargeLimitSettingsChanged));
            this.settings.connect(`changed::${CHARGE_LIMIT}`, Lang.bind(this, this._onChargeLimitSettingsChanged));

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
            globalThis.logError(e, `Error reading file ${filePath}`);
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
        if (key === CONSERVATION_MODE && this._chargeLimitEnabled) {
            this._updateSwitchState(key, this._readChargeMode() === "Long_Life");
            return;
        }

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
                globalThis.logError(new Error(stderr), `Failed to write to file ${filePath}`);
            }
        });
    },

    // Changing driver file's content upon switch toggle event from settings page
    _onSettingsChanged: function(settings, key) {
        if (key === CONSERVATION_MODE && this._chargeLimitEnabled) {
            // The custom charge limit drives the conservation mode.
            return;
        }

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
                globalThis.logError(new Error(stderr), `Failed to write to file ${filePath}`);
            }
        });
    },

    _readFile: function(path) {
        try {
            let [ok, contents] = GLib.file_get_contents(path);
            if (!ok) return null;
            try {
                return new TextDecoder().decode(contents).trim();
            } catch (e) {
                return contents.toString().trim();
            }
        } catch (e) {
            return null;
        }
    },

    _readChargeMode: function() {
        let types = this._readFile(CHARGE_TYPES);
        if (types !== null) {
            if (types.indexOf("[Long_Life]") !== -1) return "Long_Life";
            if (types.indexOf("[Standard]") !== -1) return "Standard";
        }

        let conservation = this._readFile(FILE_PATHS[CONSERVATION_MODE]);
        if (conservation === "1") return "Long_Life";
        if (conservation === "0") return "Standard";
        return null;
    },

    _chargeModeWritable: function() {
        let useChargeTypes = GLib.file_test(CHARGE_TYPES, GLib.FileTest.EXISTS);
        let path = useChargeTypes ? CHARGE_TYPES : FILE_PATHS[CONSERVATION_MODE];
        return this._isWritable(path);
    },

    _isWritable: function(path) {
        try {
            let info = Gio.File.new_for_path(path).query_info("access::can-write", Gio.FileQueryInfoFlags.NONE, null);
            return info.get_attribute_boolean("access::can-write");
        } catch (e) {
            return false;
        }
    },

    _writeChargeMode: function(enable, callback) {
        let useChargeTypes = GLib.file_test(CHARGE_TYPES, GLib.FileTest.EXISTS);
        let path = useChargeTypes ? CHARGE_TYPES : FILE_PATHS[CONSERVATION_MODE];
        let value = useChargeTypes ? (enable ? "Long_Life" : "Standard") : (enable ? "1" : "0");

        let command = `/bin/sh -c "printf '%s\\n' '${value}' > '${path}'"`;
        if (!this._isWritable(path)) {
            command = `pkexec ${command}`;
        }

        Util.spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            callback(exitCode === 0, stderr);
        });
    },

    _readChargeLimitSettings: function() {
        this._chargeLimitEnabled = !!this.settings.getValue(CHARGE_LIMIT_ENABLED);

        let limit = Math.round(Number(this.settings.getValue(CHARGE_LIMIT)));
        if (!isFinite(limit)) limit = 80;
        limit = Math.max(CHARGE_LIMIT_MIN, Math.min(CHARGE_LIMIT_MAX, limit));

        if (limit !== Number(this.settings.getValue(CHARGE_LIMIT))) {
            this.settings.setValue(CHARGE_LIMIT, limit);
        }
        this._chargeLimit = limit;
    },

    _syncChargeLimitUI: function() {
        if (!this.chargeLimitSwitch) return;

        this.chargeLimitSwitch.setToggleState(this._chargeLimitEnabled);

        this._chargeLimitSyncing = true;
        this.chargeLimitSlider.setValue((this._chargeLimit - CHARGE_LIMIT_MIN) / (CHARGE_LIMIT_MAX - CHARGE_LIMIT_MIN));
        this._chargeLimitSyncing = false;

        this.chargeLimitLabel.label.set_text(_("Charge limit: ") + this._chargeLimit + "%");
        this.conservationModeSwitch.setSensitive(!this._chargeLimitEnabled);

        if (this._chargeLimitEnabled && !this._chargeModeWritable() && !this._chargeLimitPermissionNoticeShown) {
            this._chargeLimitPermissionNoticeShown = true;
            this._showNotification(
                _("Charge limit: password prompts"),
                _("Install the optional udev rule from the applet's udev folder to change the charge mode without a password prompt.")
            );
        }

        this._updateChargeLimitStatus();
    },

    _onChargeLimitToggled: function(item, state) {
        if (state !== this._chargeLimitEnabled) {
            this.settings.setValue(CHARGE_LIMIT_ENABLED, state);
        }
    },

    _onChargeLimitSliderChanged: function(item, value) {
        if (this._chargeLimitSyncing) return;

        let limit = Math.round(CHARGE_LIMIT_MIN + value * (CHARGE_LIMIT_MAX - CHARGE_LIMIT_MIN));
        this.chargeLimitLabel.label.set_text(_("Charge limit: ") + limit + "%");
        this._scheduleChargeLimitCommit(limit);
    },

    _scheduleChargeLimitCommit: function(limit) {
        if (this._chargeLimitCommitTimeout) {
            GLib.source_remove(this._chargeLimitCommitTimeout);
            this._chargeLimitCommitTimeout = 0;
        }

        this._chargeLimitCommitTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CHARGE_LIMIT_COMMIT_MS, Lang.bind(this, function() {
            this._chargeLimitCommitTimeout = 0;
            if (limit !== this._chargeLimit) {
                this.settings.setValue(CHARGE_LIMIT, limit);
            } else {
                this._syncChargeLimitUI();
            }
            return false;
        }));
    },

    _onChargeLimitSettingsChanged: function() {
        let wasEnabled = this._chargeLimitEnabled;
        let oldLimit = this._chargeLimit;
        this._readChargeLimitSettings();

        if (this._chargeLimit !== oldLimit) {
            this._chargeLimitForce = true;
        }

        if (wasEnabled && !this._chargeLimitEnabled) {
            this._chargeLimitForce = false;
            this._writeChargeMode(false, Lang.bind(this, function(ok, stderr) {
                if (!ok) {
                    this._showChargeLimitError(stderr);
                }
                this._updateChargeLimitStatus();
            }));
        } else if (!wasEnabled && this._chargeLimitEnabled) {
            this._chargeLimitForce = true;
        }

        this._syncChargeLimitUI();
        this._applyChargeLimit();
    },

    _updateChargeLimitStatus: function() {
        if (!this.chargeLimitStatus) return;

        let capacityText = this._readFile(BATTERY_CAPACITY);
        let capacity = parseInt(capacityText, 10);
        let acOnline = this._readFile(AC_PATH + "/online") === "1";
        let mode = this._readChargeMode();

        let line1 = isNaN(capacity) ? _("Battery: unknown") : _("Battery: ") + capacity + "%";
        line1 += " — " + (acOnline ? _("AC power") : _("on battery"));

        let line2;
        if (mode === "Long_Life") {
            line2 = _("Mode: charging stopped");
        } else if (mode === "Standard") {
            line2 = _("Mode: charging allowed");
        } else {
            line2 = _("Mode: unknown");
        }
        if (!this._chargeLimitEnabled) {
            line2 += " — " + _("limit disabled");
        }

        this.chargeLimitStatus.label.set_text(line1 + "\n" + line2);

        if (mode !== null) {
            this._updateSwitchState(CONSERVATION_MODE, mode === "Long_Life");
            if (this._chargeLimitEnabled && this.settings.getValue(CONSERVATION_MODE) !== (mode === "Long_Life")) {
                this.settings.setValue(CONSERVATION_MODE, mode === "Long_Life");
            }
        }
    },

    _applyChargeLimit: function() {
        if (this._chargeLimitWriting) return;
        if (!this._chargeLimitEnabled) return;

        let capacity = parseInt(this._readFile(BATTERY_CAPACITY), 10);
        if (isNaN(capacity)) return;

        let acOnline = this._readFile(AC_PATH + "/online") === "1";
        if (!acOnline) return;

        let mode = this._readChargeMode();
        if (mode === null) return;

        let desired = mode;
        if (capacity >= this._chargeLimit) {
            desired = "Long_Life";
        } else if (capacity <= this._chargeLimit - CHARGE_LIMIT_HYSTERESIS) {
            desired = "Standard";
        } else if (this._chargeLimitForce) {
            desired = "Standard";
        }

        this._chargeLimitForce = false;

        if (desired === mode) return;

        this._chargeLimitWriting = true;
        this._writeChargeMode(desired === "Long_Life", Lang.bind(this, function(ok, stderr) {
            this._chargeLimitWriting = false;
            if (!ok) {
                this._showChargeLimitError(stderr);
                return;
            }

            this._chargeLimitErrorShown = false;
            this._updateChargeLimitStatus();
            this._applyChargeLimit();
        }));
    },

    _showChargeLimitError: function(details) {
        if (this._chargeLimitErrorShown) return;
        this._chargeLimitErrorShown = true;
        globalThis.logError(new Error(details), "Failed to set the battery charge mode");
        this._showNotification(
            _("Charge limit error"),
            _("Could not change the battery charge mode. Check permissions or install the optional udev rule.")
        );
    },

    _showNotification: function(title, message) {
        try {
            // Create notification source if it doesn't exist
            if (!this._source) {
                this._source = new MessageTray.Source(_("CinnamonVantage"), "dialog-information");
                this._source.createNotificationIcon = function() {
                    return new St.Icon({
                        icon_name: "dialog-information", // Icône standard
                        icon_type: St.IconType.SYMBOLIC,
                        icon_size: 24
                    });
                };
                // Add source to message tray
                Main.messageTray.add(this._source);
            }
            // Create notification
            let notification = new MessageTray.Notification(
                this._source,
                title,
                message
            );
            // Make notification temporary
            notification.setTransient(true);
            notification.setUrgency(MessageTray.Urgency.NORMAL);

            // Show notification
            this._source.notify(notification);

        } catch (e) {
            console.log("Error in _showNotification:");
            console.log(e);
            globalThis.logError(e, "Error showing notification");
        }
    },

    _showRestartNotification: function() {
        this._showNotification(
            _("System reboot required"),
            _("A system reboot is required for this change to take effect.")
        );
    },

    on_applet_removed_from_panel: function() {
        if (this._chargeLimitTimer) {
            GLib.source_remove(this._chargeLimitTimer);
            this._chargeLimitTimer = 0;
        }
        if (this._chargeLimitCommitTimeout) {
            GLib.source_remove(this._chargeLimitCommitTimeout);
            this._chargeLimitCommitTimeout = 0;
        }
    }
};

// Initialize applet
function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
