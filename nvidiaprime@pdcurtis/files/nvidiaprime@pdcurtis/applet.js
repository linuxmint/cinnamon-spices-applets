/* This is a basic display Applet for use with NVidia Prime
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
                "displayExtra",
                "displayExtra",
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

            // Check that Nvidia drivers are installed
            if (!GLib.find_program_in_path("nvidia-settings")) {
                 let icon = new St.Icon({ icon_name: 'error',
                 icon_type: St.IconType.FULLCOLOR,
                 icon_size: 36 });
                 Main.criticalNotify("Nvidia Prime not installed", "You appear to be missing some of the required programs for Nvidia Prime to switch graphics processors using NVIDIA Optimus.\n\nPlease read the help file.", icon);
                 this.nvidiaPrimeMissing = true;
            } else {
                 this.nvidiaPrimeMissing = false;
            }

            // ++ Set up left click menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // ++ Build Context (Right Click) Menu
            this.buildContextMenu();

            // Make sure the temp file is created

             GLib.spawn_command_line_async('touch /tmp/.gpuTemperaturePrime');

            // Finally setup to start the update loop for the applet display running
            this.set_applet_label(" " ); // show nothing until system stable
            this.set_applet_tooltip(_("Waiting for nvidia"));
            Mainloop.timeout_add_seconds(2, Lang.bind(this, this.updateLoop)); // Timer to allow prime to initiate

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


        if (this.displayExtra) {
            this.menuitem2 = new PopupMenu.PopupMenuItem("Run glxspheres64 GPU Test Program");
            this.menuitem2.connect('activate', Lang.bind(this, function (event) {
            GLib.spawn_command_line_async('/opt/VirtualGL/bin/glxspheres64');
            }));
            this._applet_context_menu.addMenuItem(this.menuitem2);
        }

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


    //++ Handler for when the applet is clicked.
    on_applet_clicked: function (event) {
        this.updateLoop();
        GLib.spawn_command_line_async('nvidia-settings');
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

      // This catches error if bbswitch is not loaded
   } catch (e) {
//          global.logError(e);  // Commented out to avoid filling error log
        this.bbst = "ERROR";
   }

   try {
         if(this.bbst == "OFF") {
               this.set_applet_label("");
               if (!this.isHorizontal) { this.hide_applet_label(true) };
               this.set_applet_tooltip(_("NVidia based GPU is Off"));
               this.set_applet_icon_path(this.intel_icon);
         }
         if(this.bbst == "ON") {

	        this.nvidiagputemp1 = GLib.file_get_contents("/tmp/.gpuTemperaturePrime").toString();
                // Check we have a valid temperature returned before updating
                // in case of slow response from nvidia-settings which gives null string
                if(this.nvidiagputemp1.substr(5,2) > 0){ this.nvidiagputemp = this.nvidiagputemp1.substr(5,2)};

                if (!this.showGpuTemp ) {
	                  this.set_applet_label("");
                      if (!this.isHorizontal) { this.hide_applet_label(true) };
                 } else {
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

         if(this.bbst == "ERROR" || this.nvidiaPrimeMissing) {
	          this.set_applet_label(_("Err" ));
              this.set_applet_tooltip(_("Nvidia Prime is not set up correctly - are the nvidia drivers and nvidia-prime  installed?"));
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
Version 3.3.2

v30_3.0.0 Based on Bumblbee v20_0.9.8 but modified to use nVidia Prime.
          Changes to work with Mint 18 and Cinnamon 3.0 -gedit -> xed
          Corrected missing call to display help file
          Tested with Cinnamon 2.8.8 in Mint 17.3 and Cinnamon 3.0 in Mint 18 (nVidia drivers 352.63 and 361 respectively)
          Changed various calls to nvidia-settings to be direct (not using optirun).
v30_3.0.1 Code tidy up
          Reduce 'settling' time from 20 to 2 seconds
v30_3.0.2 Minor cosmetic changes
v30_3.1.0 Removed left click menu and replaced with call to nvidia-settings
v30_3.1.1 Removed all the bindings to settings for program configuration
v30_3.1.2 Matching changes in settings-schema.json
v30_3.1.3 Help file updated
v30_3.1.4 Help File updated further
          Uploaded as Release Candidate on 29th July 2016
v30_3.1.5 New tick box on configuration screen to access enhanced functionality through the Context Menu.
          This needs a Cinnamon Restart or log out/in before the change is visible.
          Currently this adds the glxspheres64 Graphics Processor Test to the Context menu.
          glxsheres needs the VirtualGL package needs to be installed from
          http://sourceforge.net/projects/virtualgl/files/VirtualGL/

v30_3.1.6 Corrected icon.png in applet folder which is used by Add Applets

Transition to new cinnamon-spices-applets repository from github.com/pdcurtis/cinnamon-applets

v30_3.2.0 Changed help file from help.txt to README.md -can keep copies of README.md identical.
3.2.1     Version numbering harmonised with other Cinnamon applets and added to metadata.json so it shows in 'About...'
          icon.png copied back into applet folder so it shows in 'About...'
          Add translation support to applet.js and identify strings
          Changes to remove leading and trailing spaces and replace with fixed spaces
          Changes to strings to avoid mixed use of flags as strings to ease translations.
          Add po folder to applet
          Create nvidiaprime.pot using cinnamon-json-makepot --js po/nvidiaprime.pot
          Version and changes information update in applet.js and changelog.txt
          Update README.md (2x)
### 3.3.0
Major new version to support vertical panels and to use icons instead of text to harmonise with other cinnamon applets such as nvidia-prime
              - Allow use of vertical as well as horizontal panels after version number check to see if they are supported.
              - Change to TextIcon applet
              - Addition of setting to hide temperatures on Horizontal panel.
              - Changed temporary output file to /tmp/.gpuTemperaturePrime to avoid overlap with nvidiaprime applet during testing.
              - New Translation function
              - Changes to improve translation strings
              - Recreate bumblebee.pot
              Changes to README.md changelog.txt etc
### 3.3.1
 * Add checks that Nvidia drivers and nvidia-settings are loaded
 * Allow GPU temperature to be displayed in vertical panels but shorten (by removing the degree symbol) if over 100 degrees on vertical panels.
 * Update nvidiaprime.pot to identify changes which need to be translated
### 3.3.2
 * Updates to some tooltips and README.md to reflect the latest changes better.
 * Update nvidiaprime.pot to identify changes which need to be translated.
### 3.3.3
Fix to allow use with early versions of Cinnamon
 * Inhibit use of hide_applet_label() unless Cinnamon version 3.2 or higher in use.
### 3.3.4
  * Use xdg-open in place of gedit or xed to allow use on more distros
### 3.3.5
  * Restrict to Cinnamon versions less than 3.8 using cinnamon version in metadata.json
  * Add multiversion to support future development for 3.8 and higher
*/

