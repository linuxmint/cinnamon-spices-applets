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
const GLib = imports.gi.GLib; // ++ Needed for starting programs
const Mainloop = imports.mainloop; // Needed for timer update loop


// ++ Always needed
function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

// ++ Always needed
MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id); // ++ Picks up UUID from metadata for Settings

            this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
                "refreshInterval-spinner", // The setting key
                "refreshInterval", // The property to manage (this.refreshInterval)
                this.on_settings_changed, // Callback when value changes
                null); // Optional callback data

            this.settings.bindProperty(Settings.BindingDirection.IN, "icon-gpu", "icon_gpu", this.on_settings_changed, null);

            // ++ Make metadata values available within applet for context menu.
            this.appletPath = metadata.path;
            this.UUID = metadata.uuid;

            this.NV_ICON = metadata.path + "/icons/nvidia.svg"
            this.INTEL_ICON = metadata.path + "/icons/intel.svg"

            this.applet_running = true; //** New to allow applet to be fully stopped when removed from panel

            // Finally setup to start the update loop for the applet display running
            this.set_applet_label(" "); // show nothing until system stable
            this.set_applet_tooltip("Waiting for Bumblebee");
            Mainloop.timeout_add_seconds(20, Lang.bind(this, this.updateLoop)); // Timer to allow bumbleebee to initiate

        } catch (e) {
            global.logError(e);
        }
    },

    // ++ Function called when settings are changed
    on_settings_changed: function () {
        this.updateLoop();
    },

    // ++ Null function called when Generic (internal) Setting changed
    on_generic_changed: function () {
    },

    //++ Handler for when the applet is clicked. 
    on_applet_clicked: function (event) {
        this.updateLoop();
    },

    // This updates the numerical display in the applet and in the tooltip
    updateUI: function () {
   try {
	this.bbswitchStatus = GLib.file_get_contents("/proc/acpi/bbswitch").toString();	
	this.bbswitchStatus2 = this.bbswitchStatus.substr(  (this.bbswitchStatus.length - 2 ),1 );
        //  Checking for N as last character in string ensures bbswitch is present and ON before nvidia-settings run 
        if (this.bbswitchStatus2 == "N") {
             this.bbst = "ON";
         }
         else {
              this.bbst = "OFF";
         }
      // This catches error if bbswitch and hence bumblebee is not loaded                     
      } catch (e) {
//          global.logError(e);  // Comment out to avoid filling error log
          this.bbst = "ERROR"
	        this.set_applet_label("ERROR" ); 
          this.set_applet_tooltip("Bumblebee is not installed so applet willl not work");          
      } 
   try {
         if(this.bbst == "OFF") {
	          this.set_applet_label(""); 
            if (this.icon_gpu == "intel" || this.icon_gpu == "any") 
                this.set_applet_icon_path(this.INTEL_ICON);
            else
                this.hide_applet_icon();
            this.set_applet_tooltip("NVidia based GPU is " + this.bbst);
         }
         if(this.bbst == "ON") {
	          this.set_applet_label(""); 
            if (this.icon_gpu == "nvidia" || this.icon_gpu == "any") 
                this.set_applet_icon_path(this.NV_ICON);
            else
                this.hide_applet_icon();
            this.set_applet_tooltip("NVidia based GPU is " + this.bbst);
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
Version 0.1 - rebase on top of bumblebee@pdcurtis
*/
