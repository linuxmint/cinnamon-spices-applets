const Applet = imports.ui.applet;
const Settings = imports.ui.settings; // Needed if you use Settings Screen
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu; // Needed for menus
const Lang = imports.lang; // Needed for menus
const GLib = imports.gi.GLib; // Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for path/file checks
const Mainloop = imports.mainloop; // Needed for timer update loop
const ModalDialog = imports.ui.modalDialog; // Needed for Modal Dialog used in Alert
const Gettext = imports.gettext; // Needed for translations
const Main = imports.ui.main; // Needed for criticalNotify()
const ByteArray = imports.byteArray; // Needed for battery value conversions

// l10n/translation support thanks to ideas from @Odyseus, @lestcape and @NikoKrause
const UUID = "batterymonitor@pdcurtis";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function titleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

const UPowerInterface = `<node>
  <interface name="org.freedesktop.UPower.Device">
    <property name="TimeToEmpty" type="x" access="read" />
    <property name="TimeToFull" type="x" access="read" />
  </interface>
</node>`;

const UPowerProxy = Gio.DBusProxy.makeProxyWrapper(UPowerInterface);

function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        this.instance_id = instance_id;
        this.metadata = metadata;
        this.orientation = orientation;
        this.setupUI();
    },

    setupIconPaths: function () {
        this.battery100 = this.metadata.path + `/icons/${this.iconTheme}/battery-100.png`;
        this.battery080 = this.metadata.path + `/icons/${this.iconTheme}/battery-080.png`;
        this.battery060 = this.metadata.path + `/icons/${this.iconTheme}/battery-060.png`;
        this.battery040 = this.metadata.path + `/icons/${this.iconTheme}/battery-040.png`;
        this.batteryCaution = this.metadata.path + `/icons/${this.iconTheme}/battery-caution.png`;
        this.batteryLow = this.metadata.path + `/icons/${this.iconTheme}/battery-low.png`;
        this.batteryCharging100 = this.metadata.path + `/icons/${this.iconTheme}/battery-charging.png`;
        this.batteryCharging080 = this.metadata.path + `/icons/${this.iconTheme}/battery-charging-080.png`;
        this.batteryCharging060 = this.metadata.path + `/icons/${this.iconTheme}/battery-charging-060.png`;
        this.batteryCharging040 = this.metadata.path + `/icons/${this.iconTheme}/battery-charging-040.png`;
        this.batteryChargingCaution = this.metadata.path + `/icons/${this.iconTheme}/battery-charging-caution.png`;
        this.batteryChargingLow = this.metadata.path + `/icons/${this.iconTheme}/battery-charging-low.png`;
    },

    setupUI: function () {
        try {
            // Picks up UUID from metadata for Settings
            this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);

            this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
                "refreshInterval-spinner", // The setting key
                "refreshInterval", // The property to manage (this.refreshInterval)
                this.on_settings_changed, // Callback when value changes
                null); // Optional callback data

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "alertPercentage",
                "alertPercentage",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "recharged_alert",
                "recharged_alert",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "recharged_alert_percentage",
                "recharged_alert_percentage",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "displayType",
                "displayType",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "iconTheme",
                "iconTheme",
                this.on_settings_changed,
                null)

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "time_remaining_display",
                "time_remaining_display",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "time_remaining_toolbar",
                "time_remaining_toolbar",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "time_remaining_tooltip",
                "time_remaining_tooltip",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useBatteryLowSound",
                "useBatteryLowSound",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "chooseBatteryLowSound",
                "chooseBatteryLowSound",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "batteryLowSound",
                "batteryLowSound1",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "batteryShutdownSound",
                "batteryShutdownSound1",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "notifyBatteryLowSound",
                "notifyBatteryLowSound",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "customBatteryPath",
                "customBatteryPath",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "normal_background_color",
                "normal_background_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "normal_border_color",
                "normal_border_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "normal_font_size",
                "normal_font_size",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "discharging_background_color",
                "discharging_background_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "discharging_border_color",
                "discharging_border_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "discharging_font_size",
                "discharging_font_size",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "alert_background_color",
                "alert_background_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "alert_border_color",
                "alert_border_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "alert_font_size",
                "alert_font_size",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "alert_discharging_background_color",
                "alert_discharging_background_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "alert_discharging_border_color",
                "alert_discharging_border_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "alert_discharging_font_size",
                "alert_discharging_font_size",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "limit_exceeded_background_color",
                "limit_exceeded_background_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "limit_exceeded_border_color",
                "limit_exceeded_border_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "limit_exceeded_font_size",
                "limit_exceeded_font_size",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "limit_exceeded2_background_color",
                "limit_exceeded2_background_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "limit_exceeded2_border_color",
                "limit_exceeded2_border_color",
                this.setupUI,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "limit_exceeded2_font_size",
                "limit_exceeded2_font_size",
                this.setupUI,
                null);

            // Define a subprocess launcher
            this.launcher = new Gio.SubprocessLauncher({
                flags: (Gio.SubprocessFlags.STDIN_PIPE |
                    Gio.SubprocessFlags.STDOUT_PIPE |
                    Gio.Subprocess.STDERR_PIPE)
            });

            // Make metadata values available within applet for context menu.
            this.appletPath = this.metadata.path;
            this.changelog = this.metadata.path + "/../CHANGELOG.md";
            this.helpfile = this.metadata.path + "/../README.md";
            this.setupIconPaths();

            // Determine best default battery path if possible
            let batteryBasePath = "/sys/class/power_supply";
            let batteryCapacityFile, batteryStatusFile;

            this.BUS_NAME = "org.freedesktop.UPower";
            for (let i = 0; i < 10; i++) {
                this.batteryObjectDir = "BAT" + i.toString();
                this.batteryPath = batteryBasePath + '/' + this.batteryObjectDir;
                batteryCapacityFile = Gio.File.new_for_path(this.batteryPath + '/capacity');
                batteryStatusFile = Gio.File.new_for_path(this.batteryPath + '/status');
                if (batteryCapacityFile.query_exists(null) && batteryStatusFile.query_exists(null))
                    break;
            }

            // Set initial value
            this.set_applet_icon_path(this.batteryCharging100);

            this.set_applet_label(_("--%"));
            this.set_applet_tooltip(_("Waiting"));

            if (this.recharged_alert)
                this.showRechargedAlert = false; // flag for flashing recharged alert
            this.flashFlag = true; // flag for flashing background
            this.flashFlag2 = true; // flag for second flashing background
            this.lastBatteryPercentage = 50; // Initialise lastBatteryPercentage
            this.batteryStateOld = "invalid";
            this.alertFlag = false; // Flag says alert has been tripped to avoid repeat notifications

            this.on_orientation_changed(this.orientation); // Initialise for panel orientation

            this.applet_running = true; // Allow applet to be fully stopped when removed from panel

            // Set text editor
            this.textEd = '/usr/bin/open';

            // Check that all Dependencies Met by presence of sox and zenity
            if (GLib.find_program_in_path("sox") && GLib.find_program_in_path("zenity")) {
                this.dependenciesMet = true;
            } else {
                let icon = new St.Icon({
                    icon_name: 'error',
                    icon_type: St.IconType.FULLCOLOR,
                    icon_size: 36
                });
                Main.criticalNotify(_("Some dependencies not installed."), _("Both 'sox' and 'zenity' are required for this applet to have all of its functionality including notifications and audible alerts.\n\nPlease view the README for help on installing them.\n"), icon);
                this.dependenciesMet = false;
            }

            if (!this.chooseBatteryLowSound) {
                // paths to default sound files
                this.batteryLowSound = "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga";
                this.batteryShutdownSound = "/usr/share/sounds/freedesktop/stereo/complete.oga";
            } else {
                if (this.notifyBatteryLowSound && this.useBatteryLowSound)
                    Main.warningNotify(_("Battery Monitor Applet"), _("A user-defined sound file has been specified for Low Battery.\n\nPlease ensure the volume is set sensibly in public places,\nespecially if a long or loud file is specified.\n"));
                this.batteryLowSound = this.batteryLowSound1;
                this.batteryShutdownSound = this.batteryShutdownSound1;
            }

            // Set up left click menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, this.orientation);
            this.menuManager.addMenu(this.menu);

            // Build Context (Right Click) Menu
            this.buildContextMenu();
            this.makeMenu();

            // Finally setup to start the update loop for the applet display running
            this.on_settings_changed();

        } catch (e) {
            global.logError(e);
        }
    },

    on_orientation_changed: function (orientation) {
        this.orientation = orientation;
        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
            // vertical
            this.isHorizontal = false;
        } else {
            // horizontal
            this.isHorizontal = true;
        }
    },

    // Function called when settings are changed
    on_settings_changed: function () {
        this.slider.setValue((this.alertPercentage - 10) / 30);
        if (this.recharged_alert)
            this.showRechargedAlert = false;
        if (!this.chooseBatteryLowSound) {
            // paths to default sound files
            this.batteryLowSound = "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga";
            this.batteryShutdownSound = "/usr/share/sounds/freedesktop/stereo/complete.oga";
        } else {
            this.batteryLowSound = this.batteryLowSound1;
            this.batteryShutdownSound = this.batteryShutdownSound1
        }
        this.setupIconPaths();
        this.updateLoop();
    },

    on_slider_changed: function (slider, value) {
        this.alertPercentage = Math.round((value * 30) + 10); // This is our BIDIRECTIONAL setting - by updating our configuration file will also be updated
        this.updateUI();
    },

    // Build the Right Click Context Menu
    buildContextMenu: function () {
        try {
            this._applet_context_menu.removeAll();

            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let menuitem2 = new PopupMenu.PopupMenuItem(_("Open Power Statistics"));
            menuitem2.connect('activate', Lang.bind(this, function (event) {
                this.launcher.spawnv(['/usr/bin/gnome-power-statistics']);
            }));
            this._applet_context_menu.addMenuItem(menuitem2);

            this.menuitem3 = new PopupMenu.PopupMenuItem(_("Open System Monitor"));
            this.menuitem3.connect('activate', Lang.bind(this, function (event) {
                this.launcher.spawnv(['/usr/bin/gnome-system-monitor']);
            }));
            this._applet_context_menu.addMenuItem(this.menuitem3);

            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Set up submenu for Housekeeping and System Items
            this.subMenu1 = new PopupMenu.PopupSubMenuMenuItem(_("Housekeeping and System Submenu"));
            this._applet_context_menu.addMenuItem(this.subMenu1);

            this.subMenuItem1 = new PopupMenu.PopupMenuItem(_("View the Changelog"));
            this.subMenuItem1.connect('activate', Lang.bind(this, function (event) {
                this.launcher.spawnv([this.textEd, this.changelog]);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem1); // Note this has subMenu1.menu not subMenu1._applet_context_menu as one might expect

            this.subMenuItem2 = new PopupMenu.PopupMenuItem(_("Open the README"));
            this.subMenuItem2.connect('activate', Lang.bind(this, function (event) {
                this.launcher.spawnv([this.textEd, this.helpfile]);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem2);

        } catch (e) {
            global.logError(e);
        }
    },

    // Build left click menu
    makeMenu: function () {
        try {
            this.menu.removeAll();

            this.menuitemInfo1 = new PopupMenu.PopupMenuItem("     " + _("Waiting for battery information"), {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo1);

            this.sliderLabel = new PopupMenu.PopupMenuItem(_('Alert/Suspend:'), {
                reactive: false
            });
            this.slider = new PopupMenu.PopupSliderMenuItem(0);
            this.slider.connect("value-changed", Lang.bind(this, this.on_slider_changed));
            this.menu.addMenuItem(this.sliderLabel);
            this.menu.addMenuItem(this.slider);
        } catch (e) {
            global.logError(e);
        }
    },

    // Handler for when the applet is clicked.
    on_applet_clicked: function (event) {
        this.updateLoop();
        this.menu.toggle();
    },

    // Refresh values from battery
    refreshBattery: function () {
        try {
            // Try to get the battery capacity as an int
            let capacityPath = this.batteryPath + '/capacity';
            let capacityValue = GLib.file_get_contents(capacityPath)[1];
            let capacityValueString = ByteArray.toString(capacityValue);
            this.batteryPercentage = parseInt(capacityValueString);

            // Try to get the battery state as a lowercase string
            let statePath = this.batteryPath + '/status';
            let stateValue = GLib.file_get_contents(statePath)[1];
            let stateValueString = ByteArray.toString(stateValue);
            this.batteryState = stateValueString.toLowerCase().trim();
        } catch (err) {
            global.logError(err);
        }
    },

    // This updates the numerical display in the applet and in the tooltip
    updateUI: function () {
        try {
            // Update path to battery and verify customBatteryPath
            // contains the correct files before using it
            let customPath = this.customBatteryPath.substring(this.customBatteryPath.lastIndexOf('//') + 1);
            if (GLib.file_test(customPath, GLib.FileTest.EXISTS)
                && GLib.file_test(customPath, GLib.FileTest.IS_DIR)) {
                if (GLib.file_test(customPath + '/capacity', GLib.FileTest.EXISTS)
                    && GLib.file_test(customPath + '/status', GLib.FileTest.EXISTS)) {
                    this.batteryPath = customPath;
                }
            }

            // Read the battery status
            this.refreshBattery();

            // Read the battery time properties if we need to display anywhere
            if (this.time_remaining_display || this.time_remaining_toolbar || this.time_remaining_tooltip) {
                this.BUS_PATH = `/org/freedesktop/UPower/devices/battery_${this.batteryObjectDir}`;

                try {
                    this._upowerProxy = new UPowerProxy(Gio.DBus.system, this.BUS_NAME, this.BUS_PATH);
                    this._timeToFull = this._upowerProxy.TimeToFull;
                    this._timeToEmpty = this._upowerProxy.TimeToEmpty;
                } catch { };
            }

            // now check we have a genuine number otherwise use last value
            if (!(this.batteryPercentage > 0 && this.batteryPercentage <= 100))
                this.batteryPercentage = this.lastBatteryPercentage;
            if (this.batteryState.length > 3) {
                this.batteryStateOld = this.batteryState;
            } else {
                this.batteryState = this.batteryStateOld;
            }

            // Define CSS styles for the applet appearance
            this._base_style = " margin: 2px, 1px, 0px, 1px; border-radius: 4px, 4px, 1px, 1px;";
            this._normal = `border: 1px; background-color: ${this.normal_background_color}; border-color: ${this.normal_border_color}; font-size: ${this.normal_font_size}%;${this._base_style}`;
            this._discharging = `border: 2px; background-color: ${this.discharging_background_color}; border-color: ${this.discharging_border_color}; font-size: ${this.discharging_font_size}%;${this._base_style}`;
            this._alert = `border: 2px; background-color: ${this.alert_background_color}; border-color: ${this.alert_border_color}; font-size: ${this.alert_font_size}%;${this._base_style}`;
            this._alert_discharging = `border: 2px; background-color: ${this.alert_discharging_background_color}; border-color: ${this.alert_discharging_border_color}; font-size: ${this.alert_discharging_font_size}%;${this._base_style}`;
            this._limit_exceeded = `border: 1px; background-color: ${this.limit_exceeded_background_color}; border-color: ${this.limit_exceeded_border_color}; font-size: ${this.limit_exceeded_font_size}%;${this._base_style}`;
            this._limit_exceeded2 = `border: 1px; background-color: ${this.limit_exceeded2_background_color}; border-color: ${this.limit_exceeded2_border_color}; font-size: ${this.limit_exceeded2_font_size}%;${this._base_style}`;

            this.batteryMessage = " ";
            let is_discharging = this.batteryState.indexOf("discharg") > -1;

            if (Math.floor(this.batteryPercentage) >= Math.floor(this.alertPercentage)) {
                this.actor.style = this._normal;
                if (is_discharging)
                    this.actor.style = this._discharging;
                this.alertFlag = false;
            }

            if (Math.floor(this.batteryPercentage) < Math.floor(this.alertPercentage)) {
                if (this.flashFlag) {
                    this.actor.style = this._alert;
                    this.flashFlag = false;
                } else {
                    if (is_discharging) {
                        this.actor.style = this._alert_discharging;
                        this.flashFlag = true; // Corrected placement
                    }
                }

                if (is_discharging) {
                    this.batteryMessage = _("Battery Low - turn off or connect to power supply") + " ";
                    if (!this.alertFlag) {
                        this.alertFlag = true; // Reset above when out of warning range
                        // Audible alert - type set earlier
                        if (this.useBatteryLowSound)
                            this.launcher.spawnv(['/usr/bin/play', this.batteryLowSound]);
                        new ModalDialog.NotifyDialog(_("The battery level has fallen to your alert level.\n\nEither connect to a power source or save or close down\nyour work and suspend or shutdown the machine.\n")).open();
                    }
                }
            }

            if (Math.floor(this.batteryPercentage) < Math.floor(this.alertPercentage) / 1.5) {
                if (this.flashFlag2) {
                    this.actor.style = this._limit_exceeded2;
                    this.flashFlag2 = false;
                } else {
                    this.actor.style = this._limit_exceeded;
                    this.flashFlag2 = true;
                }

                if (is_discharging) {
                    this.batteryMessage = _("Battery Critical - will suspend unless connected to power supply") + " ";
                    if (this.batteryPercentage < this.lastBatteryPercentage) {
                        // Audible alert moved from suspendScript in v32_1.0.0
                        if (this.useBatteryLowSound)
                            this.launcher.spawnv(['/usr/bin/play', this.batteryShutdownSound]);
                        this.launcher.spawnv(['/usr/bin/bash', `${this.appletPath}/suspendScript.sh`]);
                    }
                }
            }

            this.lastBatteryPercentage = this.batteryPercentage;
            /*
            If less than 4%, then shutdown completely immediately.
            May be implemented in future version
            */
            // set Tooltip

            this.time_string = (this.time_remaining_display || this.time_remaining_tooltip || this.time_remaining_toolbar) && this.batteryPercentage != 100 ?
                (is_discharging ?
                    (this._timeToEmpty != 0 ? "\n" + _("Time to Empty:") + " (" + this.timeToString(this._timeToEmpty) + ")" : "") :
                    (this._timeToFull != 0 ? "\n" + _("Time to Full:") + " (" + this.timeToString(this._timeToFull) + ")" : "")) :
                "";
            this.time_tooltip = this.time_remaining_tooltip ? this.time_string : "";
            this.set_applet_tooltip(_("Current Charge:") + " " + this.batteryPercentage + "% (" + titleCase(this.batteryState) + `)${this.time_tooltip}\n` + _("Alert:") + " " + Math.floor(this.alertPercentage) + "%\n" + _("Suspend:") + " " + Math.floor(this.alertPercentage / 1.5) + "%");
            // Now select icon to display
            if (this.batteryPercentage == 100) {
                this.batteryIcon = is_discharging ? this.battery100 : this.batteryCharging100;
            } else if (this.batteryPercentage >= 80) {
                this.batteryIcon = is_discharging ? this.battery080 : this.batteryCharging080;
            } else if (this.batteryPercentage >= 60) {
                this.batteryIcon = is_discharging ? this.battery060 : this.batteryCharging060;
            } else if (this.batteryPercentage >= Math.floor(this.alertPercentage)) {
                this.batteryIcon = is_discharging ? this.battery040 : this.batteryCharging040;
            } else if (this.batteryPercentage >= Math.floor(this.alertPercentage / 1.5)) {
                this.batteryIcon = is_discharging ? this.batteryCaution : this.batteryChargingCaution;
            } else {
                this.batteryIcon = is_discharging ? this.batteryLow : this.batteryChargingLow;
            }

            // Choose what to display based on Display Type from settings dropdown
            if (this.displayType == "classicPlus" || this.displayType == "compactPlus" || this.displayType == "icon") {
                this.set_applet_icon_path(this.batteryIcon);
            } else {
                this.hide_applet_icon();
            }
            if (!(this.displayType == "classic" || this.displayType == "classicPlus") || !this.isHorizontal)
                this.batteryMessage = "";

            this.time_display = this.time_remaining_display && this.batteryPercentage != 100 ?
                (is_discharging ?
                    (this._timeToEmpty != 0 ? ` (${this.timeToString(this._timeToEmpty)})` : "") :
                    (this._timeToFull != 0 ? ` (${this.timeToString(this._timeToFull)})` : "")) :
                "";
            if (this.batteryPercentage == 100 && !this.isHorizontal) {
                this.set_applet_label(this.batteryMessage + this.batteryPercentage + `${this.time_display}`);
            } else {
                this.set_applet_label(this.batteryMessage + this.batteryPercentage + `%${this.time_display}`);
            }

            if (this.displayType == "icon") {
                this.set_applet_label("");
                if (!this.isHorizontal)
                    this.hide_applet_label(true);
            } else {
                if (!this.isHorizontal)
                    this.hide_applet_label(false);
            }

            // Set left click menu item 'label' for slider
            this.time_label = this.time_remaining_toolbar ? this.time_string : "";
            this.menuitemInfo1.label.text = _("Current Charge:") + " " + this.batteryPercentage + "% " + "(" + titleCase(this.batteryState) + `)${this.time_label}\n` + _("Alert at:") + " " + Math.floor(this.alertPercentage) + "%\n" + _("Suspend at:") + " " + Math.floor(this.alertPercentage / 1.5) + "%";

            // Check if a recharged alert needs to be shown, flip the switch under the right conditions otherwise
            if (!is_discharging && this.recharged_alert) {
                if (this.showRechargedAlert && this.recharged_alert_percentage <= this.batteryPercentage) {
                    this.showRechargedAlert = false;
                    new ModalDialog.NotifyDialog(_("The battery level has been recharged to") + ` ${this.batteryPercentage}%.`).open();
                } else if (!this.showRechargedAlert && this.recharged_alert_percentage > this.batteryPercentage) {
                    this.showRechargedAlert = true;
                }
            }
        } catch (e) {
            global.logError(e);
        }
    },

    // This is the loop run at refreshInterval rate to call updateUI() to update the display in the applet and tooltip
    updateLoop: function () {
        // Also inhibit when applet after has been removed from panel
        if (this.applet_running == true) {
            this.updateUI();
            this.timeout = Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.updateLoop));
        }
    },

    // This takes an int value of seconds and returns a string formatted with hours and minutes
    timeToString: function (time_in_seconds) {
        let totalTime = Math.round(time_in_seconds / 60);
        let minutes = Math.floor(totalTime % 60);
        let minutesToString = String(minutes).padStart(2, '0');
        let hours = Math.floor(totalTime / 60);
        return `${hours}:${minutesToString}`;
    },

    // This finalizes the settings when the applet is removed from the panel
    on_applet_removed_from_panel: function () {
        // inhibit the update timer when applet removed from panel
        this.applet_running = false;
        Mainloop.source_remove(this.timeout);
        this.settings.finalize();
    }
};

function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
