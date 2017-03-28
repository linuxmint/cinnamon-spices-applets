/* This is a basic Battery  Applet with Monitoring and Shutdown (BAMS)
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
const ModalDialog = imports.ui.modalDialog; // Needed for Modal Dialog used in Alert

// l10n/translation support as per NikoKrause tutorial modified as UUID already used!
const Gettext = imports.gettext
const UUIDl10n = "batterymonitor@pdcurtis"
Gettext.bindtextdomain(UUIDl10n, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUIDl10n, str);
}


/* 
Function to provide a Modal Dialog. This approach is thanks to Mark Bolin
It works, even if I do not fully understand it, and has done for years in NUMA! 
*/

function AlertDialog(value) {
    this._init(value);
};

AlertDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    _init: function (value) {
        ModalDialog.ModalDialog.prototype._init.call(this);
        let label = new St.Label({
            text: value ,
            style_class: "centered"
        });
        this.contentLayout.add(label);
        this.setButtons([{
            style_class: "centered",
            label: "Ok",
            action: Lang.bind(this, function () {
                this.close();
            })
        }]);
    }
};



// ++ Always needed
function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

// ++ Always needed
MyApplet.prototype = {
    __proto__: Applet.Applet.prototype, // Text Applet

    _init: function(metadata, orientation, panelHeight, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id); // ++ Picks up UUID from metadata for Settings

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

            // ++ Make metadata values available within applet for context menu.
            this.cssfile = metadata.path + "/stylesheet.css"; 
            this.changelog = metadata.path + "/changelog.txt";
            this.helpfile = metadata.path + "/README.md";

            this.batterytempscript = metadata.path + "/batterytempscript.sh";
            this.appletPath = metadata.path;
            this.UUID = metadata.uuid;
            this.nvidiagputemp = 0;
            this.flashFlag = true; // flag for flashing background 
            this.flashFlag2 = true; // flag for second flashing background 
            this.lastBatteryPercentage = 50; // Initialise lastBatteryPercentage
            this.batteryStateOld = "invalid"
            this.alertFlag = false; // Flag says alert has been tripped to avoid repeat notifications

            this.applet_running = true; //** New to allow applet to be fully stopped when removed from panel

            // Choose Text Editor depending on whether Mint 18 with Cinnamon 3.0 and latter
            if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "3.0") <= 0) {
                this.textEd = "gedit";
            } else {
                this.textEd = "xed";
            }

            // Set up Modal Alert Box
 //          alertModalDataWarning = new AlertDialog("The Battery Level has fallen to your alert level\n\n either reconnect to a power source\n\or close down your work and suspend or shutdown the machine");

            // ++ Set up left click menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // ++ Add text actor to Applet
            this.appletLabel = new St.Label({
                reactive: true,
                track_hover: true,
                //           style_class: "spacer-applet"
            });
            this.actor.add(this.appletLabel, {
                y_align: St.Align.MIDDLE,
                y_fill: false
            });

            // ++ Set initial value of text
            this.appletLabel.set_text(_("  Wait  "));

            // ++ Build Context (Right Click) Menu
            this.buildContextMenu();
            this.makeMenu();

            // Make sure the temp files are created

            GLib.spawn_command_line_async('touch /tmp/.batteryPercentage');
            GLib.spawn_command_line_async('touch /tmp/.batteryState');

            // Finally setup to start the update loop for the applet display running
            this.set_applet_tooltip(_("Waiting"));
            this.on_settings_changed()   // This starts the MainLoop timer loop

        } catch (e) {
            global.logError(e);
        }
    },


    // Compare two version numbers (strings) based on code by Alexey Bass (albass)
    // Takes account of many variations of version numers including cinnamon.
    versionCompare: function(left, right) {
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
    on_settings_changed: function() {
        this.slider_demo.setValue((this.alertPercentage - 10) / 30);

        this.updateLoop();
    },

    // ++ Null function called when Generic (internal) Setting changed
    on_generic_changed: function() {},

    on_slider_changed: function(slider, value) {
        this.alertPercentage = (value * 30) + 10; // This is our BIDIRECTIONAL setting - by updating this.scale_val,
        // Our configuration file will also be updated

    },

    // ++ Build the Right Click Context Menu
    buildContextMenu: function() {
        try {
            this._applet_context_menu.removeAll();

            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let menuitem2 = new PopupMenu.PopupMenuItem(_("Open Power Statistics"));
            menuitem2.connect('activate', Lang.bind(this, function(event) {
                GLib.spawn_command_line_async('gnome-power-statistics');
            }));
            this._applet_context_menu.addMenuItem(menuitem2);

            this.menuitem3 = new PopupMenu.PopupMenuItem(_("Open System Monitor"));
            this.menuitem3.connect('activate', Lang.bind(this, function(event) {
                GLib.spawn_command_line_async('gnome-system-monitor');
            }));
            this._applet_context_menu.addMenuItem(this.menuitem3);

            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // ++ Set up sub menu for Housekeeping and System Items
            this.subMenu1 = new PopupMenu.PopupSubMenuMenuItem(_("Housekeeping and System Sub Menu"));
            this._applet_context_menu.addMenuItem(this.subMenu1);

            this.subMenuItem1 = new PopupMenu.PopupMenuItem(_("View the Changelog"));
            this.subMenuItem1.connect('activate', Lang.bind(this, function(event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.changelog);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem1); // Note this has subMenu1.menu not subMenu1._applet_context_menu as one might expect

            this.subMenuItem2 = new PopupMenu.PopupMenuItem(_("Open the Help file"));
            this.subMenuItem2.connect('activate', Lang.bind(this, function(event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.helpfile);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem2);

            this.subMenuItem4 = new PopupMenu.PopupMenuItem(_("Open stylesheet.css  (Advanced Function)"));
            this.subMenuItem4.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.cssfile);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem4);

        } catch (e) {
            global.logError(e);
        }
    },

    //++ Build left click menu 
    makeMenu: function() {
        try {
            this.menu.removeAll();

            this.menuitemHead1 = new PopupMenu.PopupMenuItem(_("Battery  Applet with Monitoring and Shutdown (BAMS)"), {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemHead1);

            this.menuitemInfo2 = new PopupMenu.PopupMenuItem(_("     Note: Alerts not enabled in Settings"), {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo2);

            this.slider_demo = new PopupMenu.PopupSliderMenuItem(0);
            this.slider_demo.connect("value-changed", Lang.bind(this, this.on_slider_changed));
            this.menu.addMenuItem(this.slider_demo);
            //        this.on_settings_changed();
        } catch (e) {
            global.logError(e);
        }
    },

    //++ Handler for when the applet is clicked. 
    on_applet_clicked: function(event) {
        this.updateLoop();
        this.menu.toggle();
    },

    // This updates the numerical display in the applet and in the tooltip
    updateUI: function() {

        try {
            this.batteryPercentage = GLib.file_get_contents("/tmp/.batteryPercentage").toString();
            this.batteryPercentage = this.batteryPercentage.trim().substr(5);
            this.batteryPercentage = Math.floor(this.batteryPercentage); 
             // now check we have a genuine number otherwise use last value
            if ( ! ( this.batteryPercentage > 0 && this.batteryPercentage <= 100 )) {             
                this.batteryPercentage = this.lastBatteryPercentage;
            }
//          Comment out following line when tests are complete
//          this.batteryPercentage = this.batteryPercentage / 5 ;   
            this.batteryState = GLib.file_get_contents("/tmp/.batteryState").toString();
            if ( this.batteryState.trim().length > 6 ) { 
                 this.batteryState = this.batteryState.trim().substr(5);
                 this.batteryStateOld = this.batteryState;
            } else { 
                 this.batteryState =  this.batteryStateOld;
            }
 
            this.batteryMessage = " "
            if (Math.floor(this.batteryPercentage)  >= Math.floor(this.alertPercentage)) {
                this.actor.style_class = 'bam-normal';
                 if (this.batteryState.indexOf("discharg") > -1) {
                     this.actor.style_class = 'bam-discharging';
                    }
                this.alertFlag = false;
            }
       
               if (Math.floor(this.batteryPercentage)  < Math.floor(this.alertPercentage)) {
                if (this.flashFlag) {
                    this.actor.style_class = 'bam-alert';
                    this.flashFlag = false;
                } else {
                 if (this.batteryState.indexOf("discharg") > -1) {
                     this.actor.style_class = 'bam-alert-discharging';
                    this.flashFlag = true; // Corrected placement
                    }
//                    this.flashFlag = true;
                }

                  
                if (this.batteryState.indexOf("discharg") > -1) {
                    this.batteryMessage = _("Battery Low - turn off or connect to mains ");
                    if ( !this.alertFlag) {
                       this.alertFlag = true;  // Reset above when out of warning range
                       // Audible alert (added in v32_1.0.0)
                       GLib.spawn_command_line_async('play "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga"'); 
                       alertModalDataWarning = new AlertDialog(_("The Battery Level has fallen to your alert level\n\n either reconnect to a power source\n\or close down your work and suspend or shutdown the machine"));
                       alertModalDataWarning.open();
                    } 
                }           
            }


  
             if (Math.floor(this.batteryPercentage) < Math.floor(this.alertPercentage)  / 1.5 ) {
                if (this.flashFlag2) {
                    this.actor.style_class = 'bam-limit-exceeded2';
                    this.flashFlag2 = false;
                } else {
                    this.actor.style_class = 'bam-limit-exceeded';
                    this.flashFlag2 = true;
                }
                 
                if (this.batteryState.indexOf("discharg") > -1) {
                    this.batteryMessage = _("Battery Critical will Suspend unless connected to mains ")
                    if ( this.batteryPercentage < this.lastBatteryPercentage ) {
                       // Audible alert moved from suspendScript in v32_1.0.0
                       GLib.spawn_command_line_async('play "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga"');
                       GLib.spawn_command_line_async('sh ' + this.appletPath + '/suspendScript');

                    }
                }    
            }
  
                if ( !this.batteryState.indexOf("discharg") > -1) {
 //                      this.alertFlag = false;
                }

                this.lastBatteryPercentage = this.batteryPercentage
/*  
 
If less than 4% then shutdown completely immediately. 
May be implemented in future version

*/
            this.appletLabel.set_text(this.batteryMessage + this.batteryPercentage + "%");

            this.set_applet_tooltip("Charge: " + this.batteryPercentage + "% " + "(" + this.batteryState + ")" + " Alert: " + Math.floor(this.alertPercentage) + "% "  + "Suspend: " + Math.floor(this.alertPercentage / 1.5)+ "%"                    );
            this.menuitemInfo2.label.text = "Percentage Charge: " + this.batteryPercentage + "% " + "(" + this.batteryState + ")" + " Alert at: "    + Math.floor(this.alertPercentage)+ "% " + "Suspend at: " + Math.floor(this.alertPercentage / 1.5)+ "%";

            // Get temperatures via asyncronous script ready for next cycle
            GLib.spawn_command_line_async('sh ' + this.batterytempscript);

        } catch (e) {
            global.logError(e);
        }
    },

    // This is the loop run at refreshInterval rate to call updateUI() to update the display in the applet and tooltip
    updateLoop: function() {
        this.updateUI();
        // Also inhibit when applet after has been removed from panel
        if (this.applet_running == true) {
            Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.updateLoop));
        }
    },

    // ++ This finalises the settings when the applet is removed from the panel
    on_applet_removed_from_panel: function() {
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
Version v32_1.0.0
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
v30_1.1.5 Minor text changes to improve consistency
v30_1.1.7 NOTE 1.1.6 was not a separate version - it was a mechanism to overwrite a faulty zip upload of 1.1.5 to the cinnamon-spices web site
v30_1.1.8 Corrected icon.png in applet folder which is used by Add Applets
v30_1.1.9 Added ability to edit stylesheet.css to context menu.
          Added warnings about editing to stylesheet.css

Transition to new cinnamon-spices-applets repository from github.com/pdcurtis/cinnamon-applets

v30_1.2.0 Changed help file from help.txt to README.md with update to README.md
v32_1.0.0 First major update following transition to cinnamon-spices-applets repository
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
*/

