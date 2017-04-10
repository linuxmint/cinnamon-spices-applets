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

// l10n/translation support as per NikoKrause tutorial modified as UUID already used!
const Gettext = imports.gettext
const UUIDl10n = "nvidiaprime@pdcurtis"
Gettext.bindtextdomain(UUIDl10n, GLib.get_home_dir() + "/.local/share/locale")
function _(str) {
  return Gettext.dgettext(UUIDl10n, str);
}


// ++ Always needed
function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

// ++ Always needed
MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype, // Text Applet

    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id); // ++ Picks up UUID from metadata for Settings

            this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
                "refreshInterval-spinner", // The setting key
                "refreshInterval", // The property to manage (this.refreshInterval)
                this.on_settings_changed, // Callback when value changes
                null); // Optional callback data

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "displayExtra",
                "displayExtra",
                this.on_settings_changed,
                null);

            // ++ Make metadata values available within applet for context menu.
            this.cssfile = metadata.path + "/stylesheet.css"; // No longer required
            this.changelog = metadata.path + "/changelog.txt";
            this.helpfile = metadata.path + "/README.md";
            this.gputempScript= metadata.path + "/gputempscript.sh";
            this.appletPath = metadata.path;
            this.UUID = metadata.uuid;
            this.nvidiagputemp = 0;

            this.applet_running = true; //** New to allow applet to be fully stopped when removed from panel

            // Choose Text Editor depending on whether Mint 18 with Cinnamon 3.0 and latter
            // Could this be replaced by use of system editor? but "If it ain't broke don't fix it" 
            if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.0" ) <= 0 ){
               this.textEd = "gedit";
            } else { 
               this.textEd = "xed";
            }

            // ++ Set up left click menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // ++ Build Context (Right Click) Menu
            this.buildContextMenu();

            // Make sure the temp file is created

             GLib.spawn_command_line_async('touch /tmp/.gpuTemperature');

            // Finally setup to start the update loop for the applet display running
            this.set_applet_label(" " ); // show nothing until system stable
            this.set_applet_tooltip(_("Waiting for nvidia"));
            Mainloop.timeout_add_seconds(2, Lang.bind(this, this.updateLoop)); // Timer to allow prime to initiate

        } catch (e) {
            global.logError(e);
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

/*        
        let menuitem1 = new PopupMenu.PopupMenuItem("Open nVidia Settings Program");
        menuitem1.connect('activate', Lang.bind(this, function (event) {
            GLib.spawn_command_line_async('nvidia-settings');
        }));
        this._applet_context_menu.addMenuItem(menuitem1);
*/

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


        // ++ Set up sub menu for Housekeeping Items
        this.subMenu1 = new PopupMenu.PopupSubMenuMenuItem(_("Housekeeping Menu"));
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
      // This catches error if bbswitch  is not loaded                     
      } catch (e) {
//          global.logError(e);  // Comment out to avoid filling error log
          this.bbst = "ERROR"
	  this.set_applet_label(_("ERROR")); 
          this.set_applet_tooltip(_("Nvidia Prime is not installed so applet willl not work"));          
      } 
   try {
         if(this.bbst == "OFF") {
	       this.set_applet_label(_("GPU OFF") ); 
//             this.set_applet_tooltip(_("NVidia based GPU is") + " " + this.bbst);
               this.set_applet_tooltip(_("NVidia based GPU is Off"));
         }
         if(this.bbst == "ON") {

	        this.nvidiagputemp1 = GLib.file_get_contents("/tmp/.gpuTemperature").toString();
                // Check we have a valid temperature returned before updating 
                // in case of slow response from nvidia-settings which gives null string
                if(this.nvidiagputemp1.substr(5,2) > 0){ this.nvidiagputemp = this.nvidiagputemp1.substr(5,2)}; 
	        this.set_applet_label(_("GPU") + " " + this.nvidiagputemp + "\u1d3cC" );//               this.set_applet_tooltip(_("NVidia based GPU is") + " " + this.bbst + " " + _("and Core Temperature is") + " " + this.nvidiagputemp + "\u1d3cC" );
                this.set_applet_tooltip(_("NVidia based GPU is On and Core Temperature is") + " " + this.nvidiagputemp + "\u1d3cC" );
                // Get temperatures via asyncronous script ready for next cycle
                GLib.spawn_command_line_async('sh ' + this.gputempScript );
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
Version 3.2.1

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
          Create batterymonitor.pot using cinnamon-json-makepot --js po/batterymonitor.pot
          Version and changes information update in applet.js and changelog.txt
          Update README.md (2x)
*/
