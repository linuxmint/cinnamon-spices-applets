/* This is a basic Battery Applet with Monitoring and Shutdown (BAMS)
It is not only useful in its own right
but is also provides a 'tutorial' framework for other more
complex applets - for example it provides a settings screen
and a 'standard' right click (context) menu which opens
the settings panel and a Housekeeping submenu accessing
help and a version/update files and also the nVidia settings program,
the gnome system monitor program and the Power monitor
in case you want to find out how much resources this applet is
using at various update rates.
Items with a ++ in the comment are useful for re-use
*/
const Applet = imports.ui.applet; // ++
const Settings = imports.ui.settings; // ++ Needed if you use Settings Screen
const St = imports.gi.St; // ++
const PopupMenu = imports.ui.popupMenu; // ++ Needed for menus
const Lang = imports.lang; //  ++ Needed for menus
const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Util = imports.misc.util; // ++ Needed for spawn_async() with callback
const Mainloop = imports.mainloop; // Needed for timer update loop
const ModalDialog = imports.ui.modalDialog; // Needed for Modal Dialog used in Alert
const Gettext = imports.gettext; // ++ Needed for translations
const Main = imports.ui.main; // ++ Needed for criticalNotify()

// ++ Always needed if you want localisation/translation support
// New l10n support thanks to ideas from @Odyseus, @lestcape and @NikoKrause

var UUID;
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return Gettext.gettext(str);
}



// ++ Always needed
function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

// ++ Always needed
MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype, // Now TextIcon Applet

    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id); // ++ Picks up UUID from metadata for Settings

            if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "3.2") >= 0) {
                this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            }
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


            // ++ Make metadata values available within applet for context menu.

            this.appletPath = metadata.path;
            this.cssfile = metadata.path + "/stylesheet.css"; // No longer required
            this.changelog = metadata.path + "/../CHANGELOG.md";
            this.helpfile = metadata.path + "/../README.md";
            this.wait4cmd = false;
            this.batteryPath = "";
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

            // ++ Part of new l10n support
            UUID = metadata.uuid;
            Gettext.bindtextdomain(metadata.uuid, GLib.get_home_dir() + "/.local/share/locale");

            this.set_applet_label(_("--%"));
            this.set_applet_tooltip(_("Waiting"));

            this.nvidiagputemp = 0;
            this.flashFlag = true; // flag for flashing background
            this.flashFlag2 = true; // flag for second flashing background
            this.lastBatteryPercentage = 50; // Initialise lastBatteryPercentage
            this.batteryStateOld = "invalid";
            this.alertFlag = false; // Flag says alert has been tripped to avoid repeat notifications

            this.on_orientation_changed(orientation); // Initialise for panel orientation

            this.applet_running = true; //** New to allow applet to be fully stopped when removed from panel

            // Choose Text Editor depending on whether Mint 18 with Cinnamon 3.0 and latter
            if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "3.0") <= 0) {
                this.textEd = "gedit";
            } else {
                this.textEd = "xdg-open";
            }

            // Check that all Dependencies Met by presence of upower, sox and zenity
            if (GLib.find_program_in_path("upower") && GLib.find_program_in_path("sox") && GLib.find_program_in_path("zenity")) {
                this.dependenciesMet = true;
            } else {
                let icon = new St.Icon({
                    icon_name: 'error',
                    icon_type: St.IconType.FULLCOLOR,
                    icon_size: 36
                });
                Main.criticalNotify(_("Some Dependencies not Installed"), _("'upower', 'sox' and 'zenity' are required for this applet to have all its facilities including notifications and audible alerts .\n\nPlease read the help file on how to install them."), icon);
                this.dependenciesMet = false;
            }

            // Determine upower's path to battery
            this.wait4cmd = true;
            Util.spawn_async(["upower", "--enumerate"], Lang.bind(this, function (out) {
                out = out.split("\n");
                for (var n = 0; n < out.length - 1; n++) {
                    let line = out[n].trim();
                    if (line.indexOf("BAT") !== -1) {
                        this.batteryPath = line;
                        this.wait4cmd = false;
                        break;
                    }
                }
            }));

            /*
                        // Set sound file locations as used in versions < 3.2
                        this.batteryLowSound = GLib.get_home_dir() + "/batterymonitorwarning.mp3"; // path to sound file in user's home folder
                        if (GLib.file_test(this.batteryLowSound, GLib.FileTest.EXISTS)) {
                              Main.warningNotify(_("Battery Monitor Applet"), _("A User Defined Sound File has been Specified for low Battery\n\nPlease ensure the volume is set sensibly in public places\nespecially if a long loud file is specifed\n"));
                        } else {
                              this.batteryLowSound = "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga" // path to default sound file
                        }
            */
            if (!this.chooseBatteryLowSound) {
                // paths to default sound files
                this.batteryLowSound = "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga";
                this.batteryShutdownSound = "/usr/share/sounds/freedesktop/stereo/complete.oga";
            } else {
                if (this.notifyBatteryLowSound && this.useBatteryLowSound) {
                    Main.warningNotify(_("Battery Monitor Applet"), _("A User Defined Sound File has been Specified for Low Battery\n\nPlease ensure the volume is set sensibly in public places\nespecially if a long loud file is specifed\n"));
                }
                this.batteryLowSound = this.batteryLowSound1;
                this.batteryShutdownSound = this.batteryShutdownSound1;
            }

            // Check stylesheet file over-ride location and use
            this.ccsfilePersistent = GLib.get_home_dir() + "/" + UUID + "/stylesheet.css"; // path to stylesheet file placed in user's home folder.
            if (GLib.file_test(this.ccsfilePersistent, GLib.FileTest.EXISTS)) {
                // Main.warningNotify(_("Battery Applet with Monitoring and Shutdown - Stylesheet persistence active"));
                // Over-ride code - currently a copy which needs an extra cinnamon restarts after any change
                GLib.spawn_command_line_async("cp  " + this.ccsfilePersistent + " " + metadata.path + "/stylesheet.css");
            }



            // ++ Set up left click menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // ++ Build Context (Right Click) Menu
            this.buildContextMenu();
            this.makeMenu();

            // Finally setup to start the update loop for the applet display running

            this.on_settings_changed(); // This starts the MainLoop timer loop

        } catch (e) {
            global.logError(e);
        }
    },


    on_orientation_changed: function (orientation) {
        this.orientation = orientation;
        if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "3.2") >= 0) {
            if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
                // vertical
                this.isHorizontal = false;
            } else {
                // horizontal
                this.isHorizontal = true;
            }
        } else {
            this.isHorizontal = true;  // Do not check unless >= 3.2
        }
    },


    // Compare two version numbers (strings) based on code by Alexey Bass (albass)
    // Takes account of many variations of version numers including cinnamon.
    versionCompare: function (left, right) {
        if (typeof left + typeof right != 'stringstring')
            return false;
        var a = left.split('.'),
            b = right.split('.'),
            i = 0,
            len = Math.max(a.length, b.length);
        for (; i < len; i++) {
            if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
                return 1;
            } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
                return -1;
            }
        }
        return 0;
    },

    // ++ Function called when settings are changed
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

    // ++ Null function called when Generic (internal) Setting changed
    on_generic_changed: function () { },

    on_slider_changed: function (slider, value) {
        this.alertPercentage = (value * 30) + 10; // This is our BIDIRECTIONAL setting - by updating our configuration file will also be updated

    },

    // ++ Build the Right Click Context Menu
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

            // ++ Set up sub menu for Housekeeping and System Items
            this.subMenu1 = new PopupMenu.PopupSubMenuMenuItem(_("Housekeeping and System Sub Menu"));
            this._applet_context_menu.addMenuItem(this.subMenu1);

            this.subMenuItem1 = new PopupMenu.PopupMenuItem(_("View the Changelog"));
            this.subMenuItem1.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.changelog);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem1); // Note this has subMenu1.menu not subMenu1._applet_context_menu as one might expect

            this.subMenuItem2 = new PopupMenu.PopupMenuItem(_("Open the Help file"));
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

    //++ Build left click menu
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

    //++ Handler for when the applet is clicked.
    on_applet_clicked: function (event) {
        this.updateLoop();
        this.menu.toggle();
    },

    //++ Call-back for the delete temporary files button.
    deleteTemporaryFiles: function () {
        GLib.spawn_command_line_async('rm --force .batteryPercentage');
        GLib.spawn_command_line_async('rm --force .batteryState');
    },

    // This updates the numerical display in the applet and in the tooltip
    updateUI: function (out) {

        try {
            // Parse the upower command output
            out = out.split("\n");
            for (var n = 0; n < out.length - 1; n++) {
                let tokens = out[n].split(":");
                switch (tokens[0].trim()) {
                    case "percentage":
                        this.batteryPercentage = tokens[1].trim(); //.trimRight("%");
                        this.batteryPercentage = this.batteryPercentage.substring(0, this.batteryPercentage.length - 1)
                        break;
                    case "state":
                        this.batteryState = tokens[1].trim();
                        break;
                }
            }
            this.batteryPercentage = Math.floor(this.batteryPercentage);
            // now check we have a genuine number otherwise use last value
            if (!(this.batteryPercentage > 0 && this.batteryPercentage <= 100)) {
                this.batteryPercentage = this.lastBatteryPercentage;
            }
            if (this.batteryState.length > 6) {
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
                    this.batteryMessage = _("Battery Low - turn off or connect to mains") + " ";
                    if (!this.alertFlag) {
                        this.alertFlag = true; // Reset above when out of warning range
                        // Audible alert - type set earlier
                        if (this.useBatteryLowSound) { GLib.spawn_command_line_async('play ' + this.batteryLowSound) };

                        // Choose Alert type depending on whether Cinnamon 2.6 or higher when modal alerts available
                        if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "2.6") <= 0) {
                            Main.criticalNotify(_("Battery Monitor Applet Alert"), _("The Battery Level has fallen to your alert level\n\neither reconnect to a power source,\n\nclose down your work and suspend or shutdown the machine\n\n"));
                        } else {
                            new ModalDialog.NotifyDialog(_("The Battery Level has fallen to your alert level\n\n either reconnect to a power source,\n\nclose down your work and suspend or shutdown the machine\n\n")).open();
                        }
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
                    this.batteryMessage = _("Battery Critical will Suspend unless connected to mains") + " ";
                    if (this.batteryPercentage < this.lastBatteryPercentage) {
                        // Audible alert moved from suspendScript in v32_1.0.0
                        if (this.useBatteryLowSound) { GLib.spawn_command_line_async('play ' + this.batteryShutdownSound) };
                        GLib.spawn_command_line_async('sh ' + this.appletPath + '/suspendScript');
                    }
                }
            }

            this.lastBatteryPercentage = this.batteryPercentage;
            /*
            If less than 4% then shutdown completely immediately.
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

        this.wait4cmd = false;

    },

    // This is the loop run at refreshInterval rate to call updateUI() to update the display in the applet and tooltip
    updateLoop: function () {
        // Also inhibit when applet after has been removed from panel
        if (this.applet_running == true) {
            if (!this.wait4cmd) {
                this.wait4cmd = true;
                Util.spawn_async(["upower", "--show-info", this.batteryPath], Lang.bind(this, this.updateUI));
            }
            Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.updateLoop));
        }
    },

    // ++ This finalises the settings when the applet is removed from the panel
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
/*
Version   1.3.0
v30_1.0.0 Developed using code from NUMA, Bumblebee and Timer Applets
          Includes changes to work with Mint 18 and Cinnamon 3.0 -gedit -> xed
          Tested with Cinnamon 3.0 in Mint 18
          TEST CODE IN PLACE namely batteryPercentage divided by 4 to allow testing
          Test Version without call to suspendScript
          Beautified
v30_1.0.1 Code added to ensure valid readings of batteryPercentage
          Code added to 'flash' messages  and extend width with messages but only when discharging.
          Code added to call Suspend script but only when percentage has fallen
             ie it will be called every 1% fall so it is re-enabled after returning from suspend
          Suspendscript active
          TEST CODE STILL IN PLACE so levels incorrect
v30_1.1.2 Some changes in how test appplied to make it easier to take them out
          Extra flag added for flashing
          Range changed to 10 - 40 for Alert Percentage.
          Tests look good and suspendscript works.
          TEST CODE STILL IN PLACE
          Should I add a forced shutdown if level drops to say 5% because taken out of suspend with
          level dropped too far or suspend cancelled too many times?
v30_1.1.3 Added Modal Dialog triped once at Alert Level and reset by going back above alert level
          Shutdown (Suspend) now at 2/3 of Alert Level.
          Suspend level added to tooltip and left click menu
          TEST CODE REMOVED
v30_1.1.4 Old call removed from batterytempscript.sh which was filling error log
          Error checks on status to ensure valid
          Spelling corrections
          Help File extended
v30_1.1.5 Minor text changes to improve consistency. First Release 16-07-2016
v30_1.1.7 NOTE 1.1.6 was not a separate version - it was a mechanism to overwrite a faulty zip upload of 1.1.5 to the cinnamon-spices web site
v30_1.1.8 Corrected icon.png in applet folder which is used by Add Applets - Released 01-08-2016
v30_1.1.9 Added ability to edit stylesheet.css to context menu. Released 17-09-2016
          Added warnings about editing to stylesheet.css

Transition to new cinnamon-spices-applets repository from github.com/pdcurtis/cinnamon-applets

v30_1.2.0 Changed help file from help.txt to README.md with update to README.md
v32_1.2.1 First major update following transition to cinnamon-spices-applets repository under Cinnamon 3.2
          Add fixed audible warning at alert stage
          Update documentation
               In Applet
               In README.md (2x)
               In changelog.txt
          Minor tidy-up of comments in applet
          Add extra Discharging indication via border colour
          Move audible alert from suspendScript to applet
          Add translation support to applet.js and identify strings
          Add po folder to applet
          Create batterymonitor.pot using cinnamon-json-makepot --js po/batterymonitor.pot
1.2.2     Changes to text strings to remove spaces from start and end of strings for translation
          Some extra strings marked for translation
          Replaced batterymonitor.pot
          Version numbering harmonised with other Cinnamon applets and added to metadata.json so it shows in 'About...'
          icon.png copied back into applet folder so it shows in 'About...'
          Version information updated in applet.js, changelog.txt and README.md
### 1.2.3
 * Added CHANGELOG.md to applet folder with symbolic link to it in UUID so it shows on latest cinnamon spices web site.
 * CHANGELOG.md is a simplified and reformatted version of changelog.txt.
 * Changed 'view changelog' in context menu to use CHANGELOG.md
### 1.3.0
Now includes support for Vertical Panels, Battery icons and 5 display modes
 * Renamed batterytempscript to batteryscript - cosmetic
 * Change to improved form of l10n support function
 * Code added to allow display on vertical panels and added on_orientation_changed function with call to initialise.
 * Options of display of icon and shortening message text with prime aim of support of vertical panels
 * Display Modes added to Configuration as Dropdown with 5 types (modes) and implemented. Includes a Classic mode which is the same as version 1.2.3 of applet.
 * Removed some redundant code still present by mistake from earlier versions which affected vertical display
 * Code comments improved and some commented out code removed.
 * Update README.md, CHANGELOG.md and metadata.json
 * Recreate batterymonitor.pot to allow translation support to be updated.
### 1.3.1
Bug Fix for use with early versions of Cinnamon
 * Inhibited use of hide_applet_label() to Cinnamon version 3.2 or higher in vertical panels.
 * Corrected Icon Only display mode
### 1.3.2
 * Add checks that sox and zenity are installed and warn that full facilities are not available without them.
 * Improve handling of completely empty batteries.
 * Update README.md, CHANGELOG.md and metadata.json
 * Update batterymonitor.pot so translations can be updated.
### 1.3.2.1
 * Revert change on handling empty battery
### 1.3.2.2
 * Remove instance of depreciated code giving a harmless warning in .xsession-errors.
### 1.3.3
  * Use xdg-open in place of gedit or xed to allow use on more distros
### 1.3.4
  * Use ModalDialog.NotifyDialog or main.criticalNotify in place of internal code for Alerts
  * Provide option of users sound file called batterymonitorwarning.mp3 in home folder
   - Checks for presence and uses if found otherwises uses default
   - puts up warning about high volumes and times in public spaces.
### 1.3.5
  * Update stylesheet to better match Cinnamon 4.0 System Styles - less rounded.
  * Add an initial mechanism to provide persistence for user edits of the stylesheet.
### 1.3.6
  * Translation File update
### 1.3.7
  * Change to allow Multiversion 3.2
  * Change to selection of audible alert file in Applet Settings for 3.2 and higher instead of mechanism introduced in 1.3.4.
### 1.3.7.1
  * Change to cinnamon-version in metadata.json to add use under Cinnamon 4.2
### 1.3.8
  * Change location of temporary files to home folder to avoid permissions problem when switching users
  * Fixes #2502
### 1.3.9
  * Adds events-sounds property to soundfilechoser widget to allow any sound file to be selected under Cinnamon 4.2
  * Adds additional option to inhibit notifications when user selected audible alert is in use
   - closes feature request #2511
### 1.4.0
  * Removes dependency on 'batteryscript.sh'. This script writes two files on every update, maybe wearing out
    the harddisk. Now it uses asyncronous calls to execute the 'upower' command directly and captures its output.
  * Checks for dependency on 'upower'.
  * Increases maximum refresh interval to 5 min (300 s).
  * Simplification of the logic to select the icon to display.
  * Removes (outdated) changelog.txt.
### 1.4.1
  * Updates README.md to stress audio file must be .oga mime type audio/x-vorbis+ogg - the mime type is crucial to it being recognised by the soundfilechoser widget
  * Cinnamon versions up to 5.2
*/
