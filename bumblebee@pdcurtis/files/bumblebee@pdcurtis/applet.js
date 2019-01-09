/* This is a basic Bumblebee and nVidia Display (BAND) Applet
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
const Mainloop = imports.mainloop; // Needed for timer update loop
const Gettext = imports.gettext; // ++ Needed for translations
const Main = imports.ui.main; // ++ Needed for criticalNotify()

// ++ Always needed for localisation/translation support
// l10n support thanks to ideas from @Odyseus, @lestcape and @NikoKrause
// UUID is set in MyApplet _init: below and before function called

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

            if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){
                 this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            }
            this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
                "refreshInterval-spinner", // The setting key
                "refreshInterval", // The property to manage (this.refreshInterval)
                this.on_settings_changed, // Callback when value changes
                null); // Optional callback data

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "showGpuTemp",
                "showGpuTemp",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "description1",
                "description1",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "commandString1",
                "commandString1",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "description2",
                "description2",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "commandString2",
                "commandString2",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "description3",
                "description3",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "commandString3",
                "commandString3",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "description4",
                "description4",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "commandString4",
                "commandString4",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "description5",
                "description5",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "commandString5",
                "commandString5",
                this.on_settings_changed,
                null);

            // ++ Make metadata values available within applet for context menu.
            this.cssfile = metadata.path + "/stylesheet.css"; // No longer required
            this.changelog = metadata.path + "/CHANGELOG.md";
            this.helpfile = metadata.path + "/README.md";
            this.gputempScript= metadata.path + "/gputempscript.sh";
            this.appletPath = metadata.path;

            // ++ Part of l10n support;
            UUID = metadata.uuid;
            Gettext.bindtextdomain(metadata.uuid, GLib.get_home_dir() + "/.local/share/locale");

            this.nvidiagputemp = 0;

            this.nvidea_icon = metadata.path + "/icons/nvidia.png"
            this.intel_icon = metadata.path + "/icons/prime-tray-intel.png"

            this.on_orientation_changed(orientation); // ++ Initialise for panel orientation

            this.applet_running = true; //** Allow applet to be fully stopped when removed from panel

            // Choose Text Editor depending on whether Mint 18 with Cinnamon 3.0 and latter
            // This could be replaced by use of system editor? but "If it ain't broke don't fix it"
            if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.0" ) <= 0 ){
               this.textEd = "gedit";
            } else {
                this.textEd = "xdg-open";
            }

            // Check that Bumblebee is installed by presence of optirun
            if (!GLib.find_program_in_path("optirun")) {
                 let icon = new St.Icon({ icon_name: 'error',
                 icon_type: St.IconType.FULLCOLOR,
                 icon_size: 36 });
                 Main.criticalNotify(_("Bumblebee program not installed"), _("You appear to be missing some of the required programs for 'bumblebee' to switch graphics processors using NVIDIA Optimus.") + "\n\n" + _("Please read the help file."), icon);
                 this.bumblebeeMissing = true;
            } else {
                 this.bumblebeeMissing = false;
            }

            // ++ Set up left click menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // ++ Build Context (Right Click) Menu
            this.buildContextMenu();
            this.makeMenu();

            // Make sure the temp file is created
             GLib.spawn_command_line_async('touch /tmp/.gpuTemperatureBB');

            // Finally setup to start the update loop for the applet display running
            this.set_applet_label(" " ); // show nothing until system stable
            this.set_applet_tooltip(_("Waiting for Bumblebee"));
            Mainloop.timeout_add_seconds(5, Lang.bind(this, this.updateLoop)); // Timer to allow bumbleebee to initiate

        } catch (e) {
            global.logError(e);
        }
    },

    on_orientation_changed: function (orientation) {
        this.orientation = orientation;
        if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){
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
         i = 0, len = Math.max(a.length, b.length);
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
        this.makeMenu();
        this.updateLoop();
    },

    // ++ Null function called when Generic (internal) Setting changed
    on_generic_changed: function () {
    },

    // ++ Build the Right Click Context Menu
    buildContextMenu: function () {
      try {
        this._applet_context_menu.removeAll();

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


        let menuitem1 = new PopupMenu.PopupMenuItem(_("Open nVidia Settings Program"));
        menuitem1.connect('activate', Lang.bind(this, function (event) {
            GLib.spawn_command_line_async('optirun -b none nvidia-settings -c :8 ');
        }));
        this._applet_context_menu.addMenuItem(menuitem1);

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

      } catch (e) {
          global.logError(e);
      }
    },

    //++ Build left click menu
    makeMenu: function () {
  try {
        this.menu.removeAll();

        this.menuitemHead1 = new PopupMenu.PopupMenuItem(_("Launch programs using the nVidia Graphics Processor"), {
            reactive: false
        });
        this.menu.addMenuItem(this.menuitemHead1);


        if (this.description1 != "null" && this.description1 != "") {
            this.MenuItem2 = new PopupMenu.PopupMenuItem("    " + this.description1 + " ( " + this.commandString1 + " ) ");
            this.MenuItem2.connect('activate', Lang.bind(this, function (event) {
             GLib.spawn_command_line_async(this.commandString1);

            }));
            this.menu.addMenuItem(this.MenuItem2);
        }

        if (this.description2 != "null" && this.description2 != "") {
            this.MenuItem2 = new PopupMenu.PopupMenuItem("    " + this.description2 + " ( " + this.commandString2 + " ) ");
            this.MenuItem2.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.commandString2);
            }));
            this.menu.addMenuItem(this.MenuItem2);
        }

        if (this.description3 != "null" && this.description3 != "") {
            this.MenuItem3 = new PopupMenu.PopupMenuItem("    " + this.description3 + " ( " + this.commandString3 + " ) ");
            this.MenuItem3.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.commandString3);
            }));
            this.menu.addMenuItem(this.MenuItem3);
        }

        if (this.description4 != "null" && this.description4 != "") {
            this.MenuItem4 = new PopupMenu.PopupMenuItem("    " + this.description4 + " ( " + this.commandString4 + " ) ");
            this.MenuItem4.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.commandString4);
            }));
            this.menu.addMenuItem(this.MenuItem4);
        }

        if (this.description5 != "null" && this.description5 != "") {
            this.MenuItem5 = new PopupMenu.PopupMenuItem("    " + this.description5 + " ( " + this.commandString5 + " ) ");
            this.MenuItem5.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.commandString5);
            }));
            this.menu.addMenuItem(this.MenuItem5);
        }
      } catch (e) {
          global.logError(e);
      }
    },

    //++ Handler for when the applet is clicked.
    on_applet_clicked: function (event) {
        this.updateLoop();
        this.menu.toggle();
    },

    // This updates the numerical display in the applet and in the tooltip
    updateUI: function () {
   try {
	this.bbswitchStatus = GLib.file_get_contents("/proc/acpi/bbswitch").toString();
	this.bbswitchStatus2 = this.bbswitchStatus.substr(  (this.bbswitchStatus.length - 2 ),1 );
        //  Checking for N as last character in string ensures bbswitch is present and ON before nvidia-settings run
        //  The setting up of strings which are used as flags is probably redundant due to changes made for translations but "if it aint broke dont fix it"
        if (this.bbswitchStatus2 == "N") {
             this.bbst = "ON";
         }
         else {
              this.bbst = "OFF";
         }
      // This catches error if bbswitch and hence bumblebee is not loaded
   } catch (e) {
//          global.logError(e);  // Commented out to avoid filling error log
        this.bbst = "ERROR";
   }

   try {
         if(this.bbst == "OFF") {
               this.set_applet_label("");
//               this.hide_applet_label(true);
               if (!this.isHorizontal) { this.hide_applet_label(true) };
               this.set_applet_tooltip(_("NVidia based GPU is Off"));
               this.set_applet_icon_path(this.intel_icon);
         }
         if(this.bbst == "ON") {

	        this.nvidiagputemp1 = GLib.file_get_contents("/tmp/.gpuTemperatureBB").toString();
                // Check we have a valid temperature returned before updating
                // in case of slow response from nvidia-settings which gives null string
                if(this.nvidiagputemp1.substr(5,2) > 0){ this.nvidiagputemp = this.nvidiagputemp1.substr(5,2)};

                if (!this.showGpuTemp ) {
	                  this.set_applet_label("");
//                      this.hide_applet_label(true);
                      if (!this.isHorizontal) { this.hide_applet_label(true) };
                 } else {
//                      this.hide_applet_label(false);
                      if (!this.isHorizontal) { this.hide_applet_label(false) };
                      if ( this.nvidiagputemp < 100 || this.isHorizontal )  {
                           this.set_applet_label(this.nvidiagputemp + "\u1d3c" );
                      } else {
                           this.set_applet_label(this.nvidiagputemp + "" ); // Needs empty string for typing
                      }

                 }

                this.set_applet_tooltip(_("NVidia based GPU is On and Core Temperature is") + " " + this.nvidiagputemp + "\u1d3cC" );
                this.set_applet_icon_path(this.nvidea_icon);

                // Get temperatures via asyncronous script ready for next cycle
                GLib.spawn_command_line_async('sh ' + this.gputempScript );
         }

         if(this.bbst == "ERROR" || this.bumblebeeMissing) {
	          this.set_applet_label(_("Err" ));
              this.set_applet_tooltip(_("Bumblebee is not set up correctly - are bbswitch, bumblebee and nvidia drivers installed?"));
//              this.hide_applet_label(false);
                 if (!this.isHorizontal) { this.hide_applet_label(false) };
         }
      } catch (e) {
          global.logError(e);
      }
    },

    // This is the loop run at refreshInterval rate to call updateUI() to update the display in the applet and tooltip
    updateLoop: function () {
        this.updateUI();
        // Also inhibit when applet after has been removed from panel
        if (this.applet_running == true) {
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
Version 3.2.2
v20_0.9.0 Beta 12-12-2013
v20_0.9.1 Added System Monitor and Power Statistics to right click menu
v20_0.9.2 Added Left Click Menu with 5 Program Launch Items with configuration in Settings - Release Candidate 14-12-2013
v20_0.9.3 Slight tidy up
v20_0.9.4 Changes to trap errors if bbstatus is not loaded and /proc/acpi/bbstat does not exist
          and also to trap errors in makeMenu and buildContextMenu and correction of buildContextMenu
v20_0.9.5 Tested, Error Message changed and some tidying up and commenting
v20_0.9.6 Replaced Clever Code from gputemperature@silentage with
          a call to a script and output written to /tmp/.gpuTempperature.
          Needed extra call to initialise at the start.
v20_0.9.7 Inhibit counter updates after counter removed from panel
v20_0.9.8 Check we have a valid temperature returned in case of the occasional slow response from nvidia
          which gave an empty display for one update period.
          Checked with Cinnamon 2.4.0 ready for Mint 17.1 - 11-11-2014
v30_3.0.0 Changes to work with Mint 18 and Cinnamon 3.0 -gedit -> xed
          corrected missing call to display help file
v30_3.0.2  NOTE 3.0.1 was not a separate version - it was a mechanism to overwrite a faulty zip upload of 3.0.0 to the cinnamon-spices web site
v30_3.0.3  Corrected icon.png in applet folder which is used by Add Applets
v30_3.0.4  Corrected gputempscript to have correct option commented out
v30_3.1.0  Changed help file from help.txt to README.md
    3.1.1  Version numbering harmonised with other Cinnamon applets and added to metadata.json so it can show in 'About...'
           icon.png copied back into applet folder so it can show in 'About...'
           Add translation support to applet.js
           Identify strings for translation and remove leading and trailing spaces and replace with separate spaces where required.
           Add po folder to applet
           Create bumblebee.pot using cinnamon-json-makepot --js po/bumblebee.pot
           Version and changes information update in applet.js and changelog.txt
    3.1.2  Changes to README.md to:
             - Strengthen Rationale for Applet
             - Add Status section noting testing under Mint 17.3 and 18.1 with Cinnamon 3.2
             - Acknowledge first translations.
           Set up default programs on left click menu
    3.2.0  Major new version to support vertical panels and to use icons instead of text to harmonise with other cinnamon applets such as nvidia-prime
              - Allow use of vertical as well as horizontal panels after version number check to see if they are supported.
              - Change to TextIcon applet
              - Addition of setting to hide temperatures on Horizontal panel.
              - Changed temporary output file to /tmp/.gpuTemperatureBB to avoid overlap with nvidiaprime applet.
              - New Translation function
              - Changes to improve translation strings
              - Recreate bumblebee.pot
              Changes to README.md changelog.txt etc
### 3.2.1
 * Use CHANGELOG.md instead of changelog.txt in context menu
 * Add symbolic link from UUID folder to applet folder so it is displayed on latest spices web site.
 * Add check that bumblebee daemon is installed.
### 3.2.2
 * Allow GPU temperature to be displayed in vertical panels but shorten (by removing the degree symbol) if over 100 degrees on vertical panels.
 * Update bumblebee.pot to identify changes which need to be translated
### 3.2.3
 * Change to the check added in 3.2.1 that bumblebee is installed. This solves an issue reported when applet used with LMDE (issue #1136).
### 3.2.4
Fix to allow use with early versions of Cinnamon
 * Inhibit use of hide_applet_label() unless Cinnamon version 3.2 or higher in use.
### 3.2.5
  * Use xdg-open in place of gedit or xed to allow use on more distros
*/
