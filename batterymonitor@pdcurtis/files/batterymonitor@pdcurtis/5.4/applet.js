/* This is a basic Battery Applet with Monitoring and Shutdown (BAMS)
It is not only useful in its own right
but is also provides a 'tutorial' framework for other more
complex applets - for example it provides a settings screen
and a 'standard' right click (context) menu which opens
the settings panel and a Housekeeping submenu accessing
changelog and readme files, the gnome system monitor program,
and the Power monitor in case you want to find out the total
amount of resources this applet is using at various update rates.
*/
const Applet = imports.ui.applet;
const Settings = imports.ui.settings; // Needed if you use Settings Screen
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu; // Needed for menus
const Lang = imports.lang; // Needed for menus
const GLib = imports.gi.GLib; // Needed for starting programs and translations
const Mainloop = imports.mainloop; // Needed for timer update loop
const ModalDialog = imports.ui.modalDialog; // Needed for Modal Dialog used in Alert
const Gettext = imports.gettext; // Needed for translations
const Main = imports.ui.main; // Needed for criticalNotify()
const ByteArray = imports.byteArray; // Needed for battery value conversions

// l10n/translation support thanks to ideas from @Odyseus, @lestcape and @NikoKrause
var UUID = "batterymonitor@pdcurtis";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        try {
            // Picks up UUID from metadata for Settings
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

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
                "displayType",
                "displayType",
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

            // Make metadata values available within applet for context menu.

            this.appletPath = metadata.path;
            this.changelog = metadata.path + "/../CHANGELOG.md";
            this.helpfile = metadata.path + "/../README.md";
            this.cssfile = metadata.path + "/stylesheet.css";
            this.batteryPath = "/sys/class/power_supply/BAT0";
            this.battery100 = metadata.path + "/icons/battery-100.png";
            this.battery080 = metadata.path + "/icons/battery-080.png";
            this.battery060 = metadata.path + "/icons/battery-060.png";
            this.battery040 = metadata.path + "/icons/battery-040.png";
            this.batteryCaution = metadata.path + "/icons/battery-caution.png";
            this.batteryLow = metadata.path + "/icons/battery-low.png";
            this.batteryCharging100 = metadata.path + "/icons/battery-charging.png";
            this.batteryCharging080 = metadata.path + "/icons/battery-charging-080.png";
            this.batteryCharging060 = metadata.path + "/icons/battery-charging-060.png";
            this.batteryCharging040 = metadata.path + "/icons/battery-charging-040.png";
            this.batteryChargingCaution = metadata.path + "/icons/battery-charging-caution.png";
            this.batteryChargingLow = metadata.path + "/icons/battery-charging-low.png";

            // Set initial value
            this.set_applet_icon_path(this.batteryCharging100);

            // l10n/translation support
            UUID = metadata.uuid;
            Gettext.bindtextdomain(metadata.uuid, GLib.get_home_dir() + "/.local/share/locale");

            this.set_applet_label(_("--%"));
            this.set_applet_tooltip(_("Waiting"));

            this.flashFlag = true; // flag for flashing background
            this.flashFlag2 = true; // flag for second flashing background
            this.lastBatteryPercentage = 50; // Initialise lastBatteryPercentage
            this.batteryStateOld = "invalid";
            this.alertFlag = false; // Flag says alert has been tripped to avoid repeat notifications

            this.on_orientation_changed(orientation); // Initialise for panel orientation

            this.applet_running = true; // Allow applet to be fully stopped when removed from panel

            // Set text editor
            this.textEd = "xdg-open";

            // Check that all Dependencies Met by presence of sox and zenity
            if (GLib.find_program_in_path("sox") && GLib.find_program_in_path("zenity")) {
                this.dependenciesMet = true;
            } else {
                let icon = new St.Icon({
                    icon_name: 'error',
                    icon_type: St.IconType.FULLCOLOR,
                    icon_size: 36
                });
                Main.criticalNotify(_("Some Dependencies not Installed"), _("Both 'sox' and 'zenity' are required for this applet to have all of its functionality including notifications and audible alerts .\n\nPlease view the README for help on installing them."), icon);
                this.dependenciesMet = false;
            }

            if (!this.chooseBatteryLowSound) {
                // paths to default sound files
                this.batteryLowSound = "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga";
                this.batteryShutdownSound = "/usr/share/sounds/freedesktop/stereo/complete.oga";
            } else {
                if (this.notifyBatteryLowSound && this.useBatteryLowSound) {
                    Main.warningNotify(_("Battery Monitor Applet"), _("A user-defined sound file has been specified for Low Battery.\n\nPlease ensure the volume is set sensibly in public places,\nespecially if a long or loud file is specified.\n"));
                }
                this.batteryLowSound = this.batteryLowSound1;
                this.batteryShutdownSound = this.batteryShutdownSound1;
            }

            // Check stylesheet file over-ride location and use
            this.cssfilePersistent = GLib.get_home_dir() + "/" + UUID + "/stylesheet.css"; // path to stylesheet file placed in user's home folder.
            if (GLib.file_test(this.cssfilePersistent, GLib.FileTest.EXISTS)) {
                // Main.warningNotify(_("Battery Applet with Monitoring and Shutdown - Stylesheet persistence active"));
                // Over-ride code - currently a copy which needs an extra cinnamon restarts after any change
                GLib.spawn_command_line_async("cp  " + this.cssfilePersistent + " " + metadata.path + "/stylesheet.css");
            }

            // Set up left click menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
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
        this.slider_demo.setValue((this.alertPercentage - 10) / 30);
        if (!this.chooseBatteryLowSound) {
            // paths to default sound files
            this.batteryLowSound = "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga";
            this.batteryShutdownSound = "/usr/share/sounds/freedesktop/stereo/complete.oga";
        } else {
            this.batteryLowSound = this.batteryLowSound1;
            this.batteryShutdownSound = this.batteryShutdownSound1
        }
        this.updateLoop();
    },

    // Null function called when Generic (internal) Setting changed
    on_generic_changed: function () { },

    on_slider_changed: function (slider, value) {
        this.alertPercentage = (value * 30) + 10; // This is our BIDIRECTIONAL setting - by updating our configuration file will also be updated

    },

    // Build the Right Click Context Menu
    buildContextMenu: function () {
        try {
            this._applet_context_menu.removeAll();

            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let menuitem2 = new PopupMenu.PopupMenuItem(_("Open Power Statistics"));
            menuitem2.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async('gnome-power-statistics');
            }));
            this._applet_context_menu.addMenuItem(menuitem2);

            this.menuitem3 = new PopupMenu.PopupMenuItem(_("Open System Monitor"));
            this.menuitem3.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async('gnome-system-monitor');
            }));
            this._applet_context_menu.addMenuItem(this.menuitem3);

            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Set up submenu for Housekeeping and System Items
            this.subMenu1 = new PopupMenu.PopupSubMenuMenuItem(_("Housekeeping and System Submenu"));
            this._applet_context_menu.addMenuItem(this.subMenu1);

            this.subMenuItem1 = new PopupMenu.PopupMenuItem(_("View the Changelog"));
            this.subMenuItem1.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.changelog);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem1); // Note this has subMenu1.menu not subMenu1._applet_context_menu as one might expect

            this.subMenuItem2 = new PopupMenu.PopupMenuItem(_("Open the README"));
            this.subMenuItem2.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.helpfile);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem2);

            this.subMenuItem4 = new PopupMenu.PopupMenuItem(_("Open stylesheet.css (Advanced Function)"));
            this.subMenuItem4.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.cssfile);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem4);

        } catch (e) {
            global.logError(e);
        }
    },

    // Build left click menu
    makeMenu: function () {
        try {
            this.menu.removeAll();

            this.menuitemHead1 = new PopupMenu.PopupMenuItem(_("Battery Applet with Monitoring and Shutdown (BAMS)"), {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemHead1);

            this.menuitemInfo2 = new PopupMenu.PopupMenuItem("     " + _("Waiting for battery information"), {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo2);

            this.slider_demo = new PopupMenu.PopupSliderMenuItem(0);
            this.slider_demo.connect("value-changed", Lang.bind(this, this.on_slider_changed));
            this.menu.addMenuItem(this.slider_demo);
        } catch (e) {
            global.logError(e);
        }
    },

    // Handler for when the applet is clicked.
    on_applet_clicked: function (event) {
        this.updateLoop();
        this.menu.toggle();
    },

    // Call-back for the delete temporary files button
    deleteTemporaryFiles: function () {
        GLib.spawn_command_line_async('rm --force .batteryPercentage');
        GLib.spawn_command_line_async('rm --force .batteryState');
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
            // now check we have a genuine number otherwise use last value
            if (!(this.batteryPercentage > 0 && this.batteryPercentage <= 100)) {
                this.batteryPercentage = this.lastBatteryPercentage;
            }
            if (this.batteryState.length > 3) {
                this.batteryStateOld = this.batteryState;
            } else {
                this.batteryState = this.batteryStateOld;
            }

            this.batteryMessage = " "
            if (Math.floor(this.batteryPercentage) >= Math.floor(this.alertPercentage)) {
                this.actor.style_class = 'bam-normal';
                if (this.batteryState.indexOf("discharg") > -1) {
                    this.actor.style_class = 'bam-discharging';
                }
                this.alertFlag = false;
            }

            if (Math.floor(this.batteryPercentage) < Math.floor(this.alertPercentage)) {
                if (this.flashFlag) {
                    this.actor.style_class = 'bam-alert';
                    this.flashFlag = false;
                } else {
                    if (this.batteryState.indexOf("discharg") > -1) {
                        this.actor.style_class = 'bam-alert-discharging';
                        this.flashFlag = true; // Corrected placement
                    }
                }

                if (this.batteryState.indexOf("discharg") > -1) {
                    this.batteryMessage = _("Battery Low - turn off or connect to power supply") + " ";
                    if (!this.alertFlag) {
                        this.alertFlag = true; // Reset above when out of warning range
                        // Audible alert - type set earlier
                        if (this.useBatteryLowSound) { GLib.spawn_command_line_async('play ' + this.batteryLowSound) };
                        new ModalDialog.NotifyDialog(_("The Battery Level has fallen to your alert level\n\n either reconnect to a power source,\n\nclose down your work and suspend or shutdown the machine\n\n")).open();
                    }
                }
            }

            if (Math.floor(this.batteryPercentage) < Math.floor(this.alertPercentage) / 1.5) {
                if (this.flashFlag2) {
                    this.actor.style_class = 'bam-limit-exceeded2';
                    this.flashFlag2 = false;
                } else {
                    this.actor.style_class = 'bam-limit-exceeded';
                    this.flashFlag2 = true;
                }

                if (this.batteryState.indexOf("discharg") > -1) {
                    this.batteryMessage = _("Battery Critical - will suspend unless connected to power supply") + " ";
                    if (this.batteryPercentage < this.lastBatteryPercentage) {
                        // Audible alert moved from suspendScript in v32_1.0.0
                        if (this.useBatteryLowSound) {
                            GLib.spawn_command_line_async('play ' + this.batteryShutdownSound)
                        };
                        GLib.spawn_command_line_async('sh ' + this.appletPath + '/suspendScript');
                    }
                }
            }

            this.lastBatteryPercentage = this.batteryPercentage;
            /*
            If less than 4%, then shutdown completely immediately.
            May be implemented in future version
            */
            // set Tooltip
            this.set_applet_tooltip(_("Charge:") + " " + this.batteryPercentage + "% (" + this.batteryState + ")\n" + _("Alert:") + " " + Math.floor(this.alertPercentage) + "%\n" + _("Suspend:") + " " + Math.floor(this.alertPercentage / 1.5) + "%");
            // Now select icon to display
            if (this.batteryPercentage == 100) {
                if (this.batteryState.indexOf("discharg") > -1) this.batteryIcon = this.battery100;
                else this.batteryIcon = this.batteryCharging100;
            } else if (this.batteryPercentage >= 80) {
                if (this.batteryState.indexOf("discharg") > -1) this.batteryIcon = this.battery080;
                else this.batteryIcon = this.batteryCharging080;
            } else if (this.batteryPercentage >= 60) {
                if (this.batteryState.indexOf("discharg") > -1) this.batteryIcon = this.battery060;
                else this.batteryIcon = this.batteryCharging060;
            } else if (this.batteryPercentage >= Math.floor(this.alertPercentage)) {
                if (this.batteryState.indexOf("discharg") > -1) this.batteryIcon = this.battery040;
                else this.batteryIcon = this.batteryCharging040;
            } else if (this.batteryPercentage >= Math.floor(this.alertPercentage / 1.5)) {
                if (this.batteryState.indexOf("discharg") > -1) this.batteryIcon = this.batteryCaution;
                else this.batteryIcon = this.batteryChargingCaution;
            } else {
                if (this.batteryState.indexOf("discharg") > -1) this.batteryIcon = this.batteryLow;
                else this.batteryIcon = this.batteryChargingLow;
            }

            // Choose what to display based on Display Type from settings dropdown
            if (this.displayType == "classicPlus" || this.displayType == "compactPlus" || this.displayType == "icon") {
                this.set_applet_icon_path(this.batteryIcon);
            } else {
                this.hide_applet_icon();
            }
            if (!(this.displayType == "classic" || this.displayType == "classicPlus") || !this.isHorizontal) {
                this.batteryMessage = "";
            }

            if (this.batteryPercentage == 100 && !this.isHorizontal) {
                this.set_applet_label(this.batteryMessage + this.batteryPercentage + "");
            } else {
                this.set_applet_label(this.batteryMessage + this.batteryPercentage + "%");
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
            this.menuitemInfo2.label.text = _("Percentage Charge:") + " " + this.batteryPercentage + "% " + "(" + this.batteryState + ")" + " " + _("Alert at:") + " " + Math.floor(this.alertPercentage) + "% " + _("Suspend at:") + " " + Math.floor(this.alertPercentage / 1.5) + "%";

        } catch (e) {
            global.logError(e);
        }
    },

    // This is the loop run at refreshInterval rate to call updateUI() to update the display in the applet and tooltip
    updateLoop: function () {
        // Also inhibit when applet after has been removed from panel
        if (this.applet_running == true) {
            this.updateUI();
            Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.updateLoop));
        }
    },

    // This finalises the settings when the applet is removed from the panel
    on_applet_removed_from_panel: function () {
        // inhibit the update timer when applet removed from panel
        this.applet_running = false;
        this.settings.finalize();
    }

};

function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
