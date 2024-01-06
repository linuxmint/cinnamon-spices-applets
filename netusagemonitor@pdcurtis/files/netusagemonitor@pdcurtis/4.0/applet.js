const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;// ++ Needed for starting programs and translations
// const GTop = imports.gi.GTop; //Moved to be within try...catch below
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Main = imports.ui.main;
const Settings = imports.ui.settings; // Needed for settings API
const Clutter = imports.gi.Clutter; // Needed for vnstat addition
const ModalDialog = imports.ui.modalDialog; // Needed for Modal Dialog used in Alert
const Gettext = imports.gettext; // ++ Needed for translations

// Code for selecting network manager thanks to Jason Hicks - Not currently utilised
let tryFn = function(fn, errCb) {
  try {
    return fn();
  } catch (e) {
    if (typeof errCb === 'function') {
      errCb(e);
    }
  }
}

let CONNECTED_STATE, NMClient_new, newNM;
// Just remove use of try-catch function to force used of new NM - much of what remains can be rationised when Cinnamon 4.0 is available to allow full testing.

  const NM = imports.gi.NM;
  CONNECTED_STATE = NM.DeviceState.ACTIVATED;
  NMClient_new = NM.Client.new;
  newNM = true;


// Localisation/translation support - moved up and slightly non standard due to GTOP test which follows.
var UUID = "netusagemonitor@pdcurtis";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return Gettext.gettext(str);
}

// Check that GTOP library is installed as applet will not run without it
// Based on method used in applet hwmonitor@sylfurd
// All functions wusing GTop have an if (!GTopInstalled) {return}; added at start
let GTopInstalled = true;
try {
  var GTop = imports.gi.GTop;
} catch(e){
                 let icon = new St.Icon({ icon_name: 'error',
                 icon_type: St.IconType.FULLCOLOR,
                 icon_size: 36 });
                 Main.criticalNotify(_("Some Dependencies not Installed"), _("You appear to be missing some of the programs or libraries required for this applet to run.\n\nPlease read the help file on how to install them."), icon);
  GTopInstalled = false;
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
};

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,
    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        try {
			if (!GTopInstalled) {return};
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "refreshInterval-spinner",
                "refreshIntervalIn",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "decimalsToShow-spinner",
                "decimalsToShowIn",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "monitored-interface",
                "monitoredIinterfaceBi",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useDefaultInterface",
                "useDefaultInterfaceIn",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "defaultInterface",
                "defaultInterfaceIn",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "dataUnit",
                "dataUnit",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useTotalLimit",
                "useTotalLimit",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "totalLimit",
                "totalLimit1",
                this.on_alert_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "alertPercentage",
                "alertPercentage",
                this.on_alert_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "cumulativeInterface1",
                "cumulativeInterface1",
                this.on_interface_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "cumulativeComment1",
                "cumulativeComment1",
                this.on_interface_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "cumulativeTotal1",
                "cumulativeTotal1",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "cumulativeOffset1",
                "cumulativeOffsetA",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "cumulativeInterface2",
                "cumulativeInterface2",
                this.on_interface_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "cumulativeComment2",
                "cumulativeComment2",
                this.on_interface_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "cumulativeTotal2",
                "cumulativeTotal2",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "cumulativeOffset2",
                "cumulativeOffsetB",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "cumulativeInterface3",
                "cumulativeInterface3",
                this.on_interface_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "cumulativeComment3",
                "cumulativeComment3",
                this.on_interface_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "cumulativeTotal3",
                "cumulativeTotal3",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "cumulativeOffset3",
                "cumulativeOffsetC",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useVnstat",
                "useVnstat",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                "compactDisplay",
                "compactDisplay",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "appletWidthSetting",
                "appletWidthSetting",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useCrisisManagement",
                "useCrisisManagement",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "crisisManagement",
                "crisisManagement",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "disconnectDelay",
                "disconnectDelay",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useAlertSound",
                "useAlertSound",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "alertSound",
                "alertSound",
                this.on_settings_changed,
                null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                "displayExtraHousekeeping",
                "displayExtraHousekeeping",
                this.on_options_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useExtendedDisplay",
                "useExtendedDisplay",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "extendedDisplay",
                "extendedDisplay",
                this.on_settings_changed,
                null);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                "useVnstatiCommandString",
                "useVnstatiCommandString",
                this.on_settings_changed,
                null);


            this.settings.bindProperty(Settings.BindingDirection.IN,
                "vnstatiCommandString",
                "vnstatiCommandString",
                this.on_settings_changed,
                null);

            this.cssfile = metadata.path + "/stylesheet.css";
            this.changelog = metadata.path + "/CHANGELOG.md";
            this.helpfile = metadata.path + "/README.md";
            this.crisisScript = metadata.path + "/crisisScript";
            this.appletPath = metadata.path;

            // Check stylesheet file over-ride location and use
            this.ccsfilePersistent = GLib.get_home_dir() + "/" + UUID + "/stylesheet.css"; // path to stylesheet file placed in user's home folder.
            if (GLib.file_test(this.ccsfilePersistent, GLib.FileTest.EXISTS)) {
                  Main.warningNotify(_("Network Usage Monitor with Alerts - Stylesheet persistence active"));
                  //Over-ride code - currently a copy which needs an extra cinnamon restarts after any change
                  GLib.spawn_command_line_async("cp  " + this.ccsfilePersistent + " " + metadata.path + "/stylesheet.css");
            }

            this.applet_running = true; //** New

//          More code for selecting network manager thanks to Jason Hicks
            let args = newNM ? [null] : [];
            this._client = NMClient_new.apply(this, args);
//          global.logError("Test output - Loaded from default position");   // Comment out unless testing

            if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.0" ) <= 0 ){
               this.textEd = "gedit";
            } else {
//               this.textEd = "xed";
               this.textEd = "xdg-open";
            }

            this.abortFlag = true;

            // Set up display in applet
            if (!this.compactDisplay) {
                this.appletWidth = this.appletWidthSetting;
            } else {
                this.appletWidth = (this.appletWidthSetting / 2) + 11;
            }

            this.labelOne = new St.Label({
                reactive: true,
                track_hover: true,
                style_class: "numa-left"
            });
            this.labelTwo = new St.Label({
                reactive: true,
                track_hover: true,
                style_class: "numa-right"
            });


            this.actor.add(this.labelOne, {
                y_align: St.Align.MIDDLE,
                y_fill: false
            });
            this.actor.add(this.labelTwo, {
                y_align: St.Align.MIDDLE,
                y_fill: false
            });

            // Set up left click menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Add code for vnstat display as per Clem's code
            this.imageWidget = new St.Bin({
                x_align: St.Align.MIDDLE
            });
            this.textWidget = new St.Label(); // Only used to display error message if vnstat not loaded
			this.menu.addActor(this.imageWidget);     // Actor added directly to menu
//			this.menu.addActor(this.textWidget);      // Actor added directly to menu
//          this.vnstatImage = metadata.path + "/vnstatImage.png"; // path to image file in applet's folder
            this.vnstatImage = GLib.get_home_dir() + "/vnstatImage.png"; // path to image file in home folder
            this.nullImage = metadata.path + "/transdot.gif"

           // Initial conditions
            this.monitoredInterfaceName = null;
            let lastUsedInterface = this.monitoredIinterfaceBi;
            if (this.dataUnit == 'gbytes') {
                this.totalLimit = this.totalLimit1 * 1024;
                this.cumulativeOffset1 = this.cumulativeOffsetA * 1024;
                this.cumulativeOffset2 = this.cumulativeOffsetB * 1024;
                this.cumulativeOffset3 = this.cumulativeOffsetC * 1024;
            } else {
                this.totalLimit = this.totalLimit1;
                this.cumulativeOffset1 = this.cumulativeOffsetA;
                this.cumulativeOffset2 = this.cumulativeOffsetB;
                this.cumulativeOffset3 = this.cumulativeOffsetC;
            }
            this.gtop = new GTop.glibtop_netload();
            this.timeOld = GLib.get_monotonic_time();
            this.upOld = 0;
            this.downOld = 0;
            this.upOldC1 = 0;
            this.downOldC1 = 0;
            this.upOldC2 = 0;
            this.downOldC2 = 0;
            this.upOldC3 = 0;
            this.downOldC3 = 0;
            this.numa_style = 'numa-not-connected';
            this.last_numa_style = 'numa-not-connected';

            this.set_applet_tooltip(_("No Interface being Monitored - right click to select"));
            if (this.useDefaultInterfaceIn) {
                this.setMonitoredInterface(this.defaultInterfaceIn);
            }
            if (this.isInterfaceAvailable(lastUsedInterface) || lastUsedInterface == "ppp0" || lastUsedInterface == "bnep0") {
                this.setMonitoredInterface(lastUsedInterface);
            }

            this.rebuildFlag = true;
            this.firstTimeFlag  = true;

            this.makeMenu();
            this.update();
        } catch (e) {
            global.logError(e);
        }
    },

    on_settings_changed: function () {
        if (this.useTotalLimit) {
            this.slider_demo.setValue(this.alertPercentage / 100);
        }
        if (!this.compactDisplay) {
            this.appletWidth = this.appletWidthSetting;
        } else {
            this.appletWidth = (this.appletWidthSetting / 2) + 11;
        }

    // Code to change from Mbytes to Gbytes added here
        if (this.dataUnit == 'gbytes') {
            this.totalLimit = this.totalLimit1 * 1024;
            this.cumulativeOffset1 = this.cumulativeOffsetA * 1024;
            this.cumulativeOffset2 = this.cumulativeOffsetB * 1024;
            this.cumulativeOffset3 = this.cumulativeOffsetC * 1024;
        } else {
            this.totalLimit = this.totalLimit1;
            this.cumulativeOffset1 = this.cumulativeOffsetA;
            this.cumulativeOffset2 = this.cumulativeOffsetB;
            this.cumulativeOffset3 = this.cumulativeOffsetC;
        }
        this.updateLeftMenu();
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

    on_alert_settings_changed: function () {
        this.makeMenu();
        this.on_settings_changed
    },

    on_interface_settings_changed: function () {
        this.makeMenu();
        this.rebuildFlag = true;
        this.on_settings_changed
    },

    on_options_changed: function () {
        this.buildContextMenu();
        this.makeMenu();
        this.on_settings_changed
    },
    on_slider_changed: function (slider, value) {
        this.alertPercentage = value * 100;
        this.updateLeftMenu();
    },

    getInterfaces: function () {
        return this._client.get_devices(); //++
    },

    isInterfaceAvailable: function (name) {
        let interfaces = this.getInterfaces();
        if (interfaces != null) {
            for (let i = 0; i < interfaces.length; i++) {
                let iname = interfaces[i].get_iface();
                if (iname == name && interfaces[i].state == CONNECTED_STATE) {
                    return true;
                }
            }
        }
        return false;
    },

    // Build or rebuild left click menu - some menu items are placeholders which are updated on changes, some are conditional and some are Widgets.
    makeMenu: function () {
        this.isVnstatInstalled = true;
        try {
            this.menu.removeAll(); // NOTE: Does not remove the Widgets only PopupMenuItems.
            if (this.useVnstat) {
               if ( this.monitoredInterfaceName != null) {
if (this.useExtendedDisplay) {
                         if(this.extendedDisplay == "classic" ) {
                                GLib.spawn_command_line_sync('vnstati -s -ne -i ' + this.monitoredInterfaceName + ' -o ' + this.vnstatImage );
                         }
                         if(this.extendedDisplay == "classicPlus" ) {
                               GLib.spawn_command_line_sync('vnstati -vs -ne -i ' + this.monitoredInterfaceName + ' -o ' + this.vnstatImage );
                         }
                         if(this.extendedDisplay == "userDefined" ) {
                               if (this.useVnstatiCommandString) {
                                     GLib.spawn_command_line_sync('vnstati ' + this.vnstatiCommandString + ' -ne -i ' + this.monitoredInterfaceName + ' -o ' + this.vnstatImage );
                               } else {
                                     GLib.spawn_command_line_sync('vnstati -s -ne -i ' + this.monitoredInterfaceName + ' -o ' +  this.vnstatImage );
                               }
                         }
                   } else {
                        GLib.spawn_command_line_sync('vnstati -s -ne -i ' + this.monitoredInterfaceName + ' -o ' +  this.vnstatImage );
                   }
                this.displayImage = this.vnstatImage
                }
             } else {
                 this.displayImage = this.nullImage // Use 1x1 image instead of vnstati generated image
             }

             let l = new Clutter.BinLayout();
             let b = new Clutter.Box();
             let c = new Clutter.Texture({
                 keep_aspect_ratio: true,
                 filter_quality: 2,
                 filename: this.displayImage
             });
             b.set_layout_manager(l);
             b.add_actor(c);
             this.imageWidget.set_child(b);
        } catch (e) {
           this.isVnstatInstalled = false;
           // NOTE: Do not write errors to global log as usual with global.logError(e) as it would fill up!
        }
        if (this.useVnstat) {
           if (this.isVnstatInstalled) {

               this.menuitemHead0 = new PopupMenu.PopupMenuItem(_("NOTE: The last time the network traffic statistics were updated by vnStat is at the top right"), {
               reactive: false
               });
               this.menu.addMenuItem(this.menuitemHead0);

               this.menuitemHead1 = new PopupMenu.PopupMenuItem("          " + _("If no Interface is Active, the last available information has been displayed"), {
               reactive: false
               });
               this.menu.addMenuItem(this.menuitemHead1)

            } else {

               this.menuitemHead2 = new PopupMenu.PopupMenuItem(_("ERROR: Please make sure vnstat and vnstati are installed and that the vnstat daemon is running!"), {
               reactive: false
               });

                  this.menu.addMenuItem(this.menuitemHead2);
            }

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        // Now write the Cumulative Usage monitors
        // Inhibit header if no interface monitored.
        if (this.cumulativeInterface1 != "null" && this.cumulativeInterface1 != "" || this.cumulativeInterface2 != "null" && this.cumulativeInterface2 != ""  || this.cumulativeInterface3 != "null" && this.cumulativeInterface3 != "") {
            this.menuitemHead3 = new PopupMenu.PopupMenuItem(_("Cumulative Data Usage Information:"), {
            reactive: false
        });
            this.menu.addMenuItem(this.menuitemHead3);
        }

        if (this.cumulativeInterface1 != "null" && this.cumulativeInterface1 != "") {
            this.menuitemInfo1 = new PopupMenu.PopupMenuItem("Cumulative data placeholder 1", {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo1);

        }
        if (this.cumulativeInterface2 != "null" && this.cumulativeInterface2 != "") {
            this.menuitemInfo4 = new PopupMenu.PopupMenuItem("Cumulative data placeholder 2", {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo4);
        }
        if (this.cumulativeInterface3 != "null" && this.cumulativeInterface3 != "") {
            this.menuitemInfo6 = new PopupMenu.PopupMenuItem("Cumulative data placeholder 3", {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo6);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem())
        this.menuitemHead4 = new PopupMenu.PopupMenuItem(_("Current Connection and Interface Information"), {
            reactive: false
        });
        this.menu.addMenuItem(this.menuitemHead4);

        if (this.monitoredInterfaceName != null) {
            this.menuitemInfo = new PopupMenu.PopupMenuItem("placeholder", {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo);
            this.menuitemInfo.label.text = "    " + this.monitoredInterfaceName + " " + "- Downloaded:" + " " + this.formatSentReceived(this.downOld) + " " + "- Uploaded:" + " " + this.formatSentReceived(this.upOld);
        } else {
            this.menuitemInfo = new PopupMenu.PopupMenuItem(_("No network monitored. Please select one right-clicking the applet."), {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo);
        }
        //	Slider only if Alerts enabled
        if (this.useTotalLimit) {
            this.menuitemInfo2 = new PopupMenu.PopupMenuItem("     " + _("Note: Alerts not enabled in Settings"), {
                reactive: false
            });
            this.menu.addMenuItem(this.menuitemInfo2);
            this.slider_demo = new PopupMenu.PopupSliderMenuItem(0);
            this.slider_demo.connect("value-changed", Lang.bind(this, this.on_slider_changed));
            this.menu.addMenuItem(this.slider_demo);
        }
        this.updateLeftMenu(); // Updates values where placeholder used.
        this.on_settings_changed();
    },

    // Update left menu
    updateLeftMenu: function () {


        if (this.useTotalLimit) {
            this.menuitemInfo2.label.text = "    " + _("Alert level (Orange):") + " " + Math.round(this.alertPercentage) + _("% of Data Limit of") + " " + this.formatSentReceived((this.totalLimit* 1024 * 1024 )) ;
        }

        if (this.cumulativeInterface1 != "null" && this.cumulativeInterface1 != "") {
            if (this.cumulativeOffset1 != 0) {
                this.menuitemInfo1.label.text = "   " + this.cumulativeInterface1 + " - " + _("Cumulative Data Use")  + " " + this.cumulativeComment1 + " " + _("with offset of") + " " + this.formatSentReceived((this.cumulativeOffset1) * 1024 * 1024) + " = " + this.formatSentReceived((this.cumulativeTotal1  - this.cumulativeOffset1) * 1024 * 1024);
            } else {
                this.menuitemInfo1.label.text = "   " + this.cumulativeInterface1 + " - " + _("Cumulative Data Use") + " " + this.cumulativeComment1 + " = " + this.formatSentReceived(this.cumulativeTotal1 * 1024 * 1024);
            }
        }

        if (this.cumulativeInterface2 != "null" && this.cumulativeInterface2 != "") {
            if (this.cumulativeOffset2 != 0) {
                this.menuitemInfo4.label.text = "   " + this.cumulativeInterface2 + " - " + _("Cumulative Data Use") + " " + this.cumulativeComment2 + " " + _("with offset of") + " " + this.formatSentReceived((this.cumulativeOffset2) * 1024 * 1024 ) + " = " + this.formatSentReceived((this.cumulativeTotal2  - this.cumulativeOffset2) * 1024 * 1024);
            } else {
                this.menuitemInfo4.label.text = "   " + this.cumulativeInterface2 + " - " + _("Cumulative Data Use") + " " + this.cumulativeComment2 + " = " + this.formatSentReceived(this.cumulativeTotal2 * 1024 * 1024);
            }
        }

        if (this.cumulativeInterface3 != "null" && this.cumulativeInterface3 != "") {
            if (this.cumulativeOffset3 != 0) {
               this.menuitemInfo6.label.text = "   " + this.cumulativeInterface3 + " - " + _("Cumulative Data Use") + " " + this.cumulativeComment3 + " " + _("with offset of") + " " + this.formatSentReceived((this.cumulativeOffset3) * 1024 * 1024 ) + " = " + this.formatSentReceived((this.cumulativeTotal3  - this.cumulativeOffset3) * 1024 * 1024);
            } else {
               this.menuitemInfo6.label.text = "   " + this.cumulativeInterface3 + " - " + "Cumulative Data Use " + this.cumulativeComment3 + " = " + this.formatSentReceived(this.cumulativeTotal3 * 1024 * 1024 );
            }
        }
    },

    // Build right click context menu
    buildContextMenu: function () {

/*
The code following allows me to retain the 'standard' additions of 'About...' 'Configure...' and 'Remove' when rebuilding the Context menu.
The use of a PopupMenu.PopupMenuSection was suggested @collinss with implementation provided by @Odyseus in a way that allowed me to keep your code almost exactly as it was with a minimum number of tweaks.
Note Odysius has used the index 0 (zero) to insert the menu section to position items in the correct order and avoid the menu section being added after all the default items.
*/

        if (this.myMenuSection)
            this.myMenuSection.destroy();
        this.myMenuSection = new PopupMenu.PopupMenuSection();
        this._applet_context_menu.addMenuItem(this.myMenuSection, 0);

// Old code continues

        this.myMenuSection.addMenuItem(new PopupMenu.PopupMenuItem(_("Select a network manager interface to be monitored:"), {
            reactive: false
        }));

        let interfaces = this.getInterfaces();
        if (interfaces != null) {
            for (let i = 0; i < interfaces.length; i++) {
                let name = interfaces[i].get_iface();
                let displayname = "\t" + name;
                if (this.isInterfaceAvailable(name)) {
                    if (this.monitoredInterfaceName != name && this.monitoredInterfaceName != "ppp0"  && this.monitoredInterfaceName != "bnep0" && !this.useDefaultInterfaceIn) {
                          this.setMonitoredInterface(name);
                    }
                    displayname = displayname + " " + _("(Active)");
                }
                if (this.monitoredInterfaceName == name) {
                    displayname = "\u2714" + displayname;
                }
                let menuitemdisp = new PopupMenu.PopupMenuItem(displayname);
                menuitemdisp.connect('activate', Lang.bind(this, function () {
                    this.setMonitoredInterface(name);
                }));
                this.myMenuSection.addMenuItem(menuitemdisp);
//                this._applet_context_menu.addMenuItem(menuitemdisp);
            }
        }
        this.myMenuSection.addMenuItem(new PopupMenu.PopupMenuItem(_("or Select an independent interface to be monitored:"), {
            reactive: false
        }));

       let displayname2 = "\t" + "ppp0   (" + _("for most USB Mobile Internet Modems)");
        if (this.monitoredInterfaceName == "ppp0") {
            displayname2 = "\u2714" + displayname2;
        }
        let menuitem = new PopupMenu.PopupMenuItem(displayname2);
        menuitem.connect('activate', Lang.bind(this, function () {
            this.setMonitoredInterface("ppp0");
        }));
        this.myMenuSection.addMenuItem(menuitem)

        // New Code to handle Android Bluetooth conections which use bnep0

        let displayname3 = "\t" + "bnep0  (" + _("for Android Bluetooth PAN Connections)");
        if (this.monitoredInterfaceName == "bnep0") {
            displayname3 = "\u2714" + displayname3;
        }
        menuitem = new PopupMenu.PopupMenuItem(displayname3);
        menuitem.connect('activate', Lang.bind(this, function () {
            this.setMonitoredInterface("bnep0");
        }));
        this.myMenuSection.addMenuItem(menuitem)

        menuitem = new PopupMenu.PopupMenuItem(_("Check for Changes in Devices and Display Options"));
        menuitem.connect('activate', Lang.bind(this, function (event) {
            this.rebuildFlag = true;
        }));
        this.myMenuSection.addMenuItem(menuitem);

        this.myMenuSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        menuitem = new PopupMenu.PopupMenuItem(_("Toggle Display from \u2193 and \u2191 to \u21f5"));
        menuitem.connect('activate', Lang.bind(this, function (event) {
            if (this.compactDisplay) {
                this.compactDisplay = false;
                this.appletWidth = this.appletWidthSetting;
            } else {
                this.compactDisplay = true;
                this.appletWidth = (this.appletWidthSetting / 2) + 11;
            }
        }));
        this.myMenuSection.addMenuItem(menuitem);

        // Code to reset Cumulative Data Usage and set their comments to the current date and time

        menuitem = new PopupMenu.PopupMenuItem(_("Reset Cumulative Data Usage") + " 1 (" + this.cumulativeInterface1 + ")");
        menuitem.connect('activate', Lang.bind(this, function (event) {
        let d1 = new Date();
        this.cT1 = 0;
        this.cumulativeTotal1 = 0;
        this.cumulativeComment1 = "from " + d1.toLocaleString();
        this.cumulativeOffsetA = 0;
        }));
        this.myMenuSection.addMenuItem(menuitem);

        menuitem = new PopupMenu.PopupMenuItem(_("Reset Cumulative Data Usage") + " 2 (" + this.cumulativeInterface2 + ")");
        menuitem.connect('activate', Lang.bind(this, function (event) {
        let d2 = new Date();
        this.cT2 = 0;
        this.cumulativeTotal2 = 0;
        this.cumulativeComment2 = "from " + d2.toLocaleString();
        this.cumulativeOffsetB = 0;
        }));
        this.myMenuSection.addMenuItem(menuitem);

        menuitem = new PopupMenu.PopupMenuItem(_("Reset Cumulative Data Usage") + " 3 (" + this.cumulativeInterface3 + ")");
        menuitem.connect('activate', Lang.bind(this, function (event) {
        let d3 = new Date();
        this.cT3 = 0;
        this.cumulativeTotal3 = 0;
        this.cumulativeComment3 = "from " + d3.toLocaleString();
        this.cumulativeOffsetC = 0;
        }));
        this.myMenuSection.addMenuItem(menuitem);

        this.myMenuSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Set up sub menu for Housekeeping and System Items
        this.subMenu1 = new PopupMenu.PopupSubMenuMenuItem(_("Housekeeping and System Sub Menu"));
        this.myMenuSection.addMenuItem(this.subMenu1);

        this.subMenuItem1 = new PopupMenu.PopupMenuItem(_("Open System Monitor"));
        this.subMenuItem1.connect('activate', Lang.bind(this, function (event) {
            GLib.spawn_command_line_async('gnome-system-monitor');
        }));
        this.subMenu1.menu.addMenuItem(this.subMenuItem1); // Note this has subMenu1.menu not subMenu1._applet_context_menu

        this.subMenuItem2 = new PopupMenu.PopupMenuItem(_("View the Changelog"));
        this.subMenuItem2.connect('activate', Lang.bind(this, function (event) {
           GLib.spawn_command_line_async(this.textEd + ' ' + this.changelog);
        }));
        this.subMenu1.menu.addMenuItem(this.subMenuItem2);

      this.subMenuItem3 = new PopupMenu.PopupMenuItem(_("View the Help File"));
        this.subMenuItem3.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.helpfile);
        }));
        this.subMenu1.menu.addMenuItem(this.subMenuItem3);

        this.subMenu1.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (this.displayExtraHousekeeping) {
            this.subMenuItem4 = new PopupMenu.PopupMenuItem(_("Open stylesheet.css  (Advanced Function)"));
            this.subMenuItem4.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.cssfile);
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem4);

            this.subMenuItem8 = new PopupMenu.PopupMenuItem(_("Open alertScript  (Advanced Function)"));
            this.subMenuItem8.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.appletPath + '/alertScript');
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem8);

            this.subMenuItem5 = new PopupMenu.PopupMenuItem(_("Open suspendScript  (Advanced Function)"));
            this.subMenuItem5.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async(this.textEd + ' ' + this.appletPath + '/suspendScript.sh');
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem5);

            this.subMenu1.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.subMenuItem9 = new PopupMenu.PopupMenuItem(_("Test alertScript  (Advanced Test Function)"));
            this.subMenuItem9.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async('sh ' + this.appletPath + '/alertScript');
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem9);

            this.subMenuItem6 = new PopupMenu.PopupMenuItem(_("Test suspendScript  (Advanced Test Function)"));
            this.subMenuItem6.connect('activate', Lang.bind(this, function (event) {
                GLib.spawn_command_line_async('/usr/bin/bash ' + this.appletPath + '/suspendScript.sh');
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem6);

            this.subMenuItem7 = new PopupMenu.PopupMenuItem(_("Test Crisis Management Function (Advanced Test Function)"));
            this.subMenuItem7.connect('activate', Lang.bind(this, function (event) {
                this.crisis();
            }));
            this.subMenu1.menu.addMenuItem(this.subMenuItem7);
         }
    },

    setMonitoredInterface: function (name) {
		if (!GTopInstalled) {return};
        this.monitoredInterfaceName = name;
        this.rebuildFlag = true;
        // This is a convenient place to ensure upOld and downOld are reset after change of interface or start-up
        GTop.glibtop_get_netload(this.gtop, this.monitoredInterfaceName);
        this.upOld = this.gtop.bytes_out;
        this.downOld = this.gtop.bytes_in;
        // Also set up the working values of the Cumulative totals.
	this.cT1 = this.cumulativeTotal1;
	this.cT2 = this.cumulativeTotal2;
	this.cT3 = this.cumulativeTotal3;

        this.monitoredIinterfaceBi = name; // save using cinnamon settings
    },

    on_applet_clicked: function (event) {
        if (!this.abortFlag) {
            this.abortFlag = true;   // Set flag to abort any delayed activities and do not pop up menu
        } else {
            this.buildContextMenu();
               if (!this.menu.isOpen) {
                     this.makeMenu();
                }
               this.menu.toggle();
        }
    },

    playAlert: function(){
        if(this.useAlertSound) {
            GLib.spawn_command_line_async('play ' + this.alertSound);
        }
    },

     delayedNetworkingDisable: function (delay) {
            GLib.spawn_command_line_async('zenity --warning --text="THE DATA USAGE LIMIT HAS BEEN EXCEEDED\n\nAll network connections Managed by the Network Manager will be Disabled shortly\n\nYou can click The Applet (NOT this OK button) to abort disabling the network" --timeout='+ delay);
            this.playAlert();
            this.abortFlag = false;
            Mainloop.timeout_add_seconds(delay, Lang.bind(this, this.networkingDisable));

    },

     networkingDisable: function () {
          if(!this.abortFlag) {
               this._client.networking_enabled = false; // Need to check with NM library
              new ModalDialog.NotifyDialog(_("THE DATA USAGE LIMIT HAS BEEN EXCEEDED\n\nAll Network connections managed by the Network Manager have been Disabled\n\nYou will need to use the Network Manager Applet to Re-enable them\nwhen the data usage problem has been resolved\n\n Some connections using ppp0 may not have been disabled or may need to be restarted manually")).open();

          } else {
                GLib.spawn_command_line_async('zenity --info --text=_("You have aborted network disconnection despite the data usage limit being exceeded") --timeout=30');
          }
      },


    // Called when the total limit has just been exceeded.
    crisis: function () {

        if (this.crisisManagement == "notify") {
            // built in notify does not seem to work so use command line call
            // this.notify("The Limit has been exceeded", "Reset or turn off networking");
            GLib.spawn_command_line_async('notify-send _("Current Network Usage Limit Exceeded" "You need to change the Data Limit for the current connection\n    Right Click -> Settings and adjust the Spin Wheel \n\n or disconnect using the Network Manager Applet") --urgency=critical');

        } else if (this.crisisManagement == "alertmodal") {
              new ModalDialog.NotifyDialog(_("THE DATA USAGE LIMIT HAS BEEN EXCEEDED\n\n Either set a new limit using \n\na right click on The Network Data Management Applet -> Settings \n\nor disconnect using the Network Manager Applet\n\n")).open();
        } else if (this.crisisManagement == "alertscript") {
            GLib.spawn_command_line_async('sh ' + this.appletPath + '/alertScript');

        } else if (this.crisisManagement == "suspendscript") {
            GLib.spawn_command_line_async('/usr/bin/bash ' + this.appletPath + '/suspendScript.sh');

        } else if (this.crisisManagement == "disablenetworking") {
              this.delayedNetworkingDisable(this.disconnectDelay);

        } else {
            GLib.spawn_command_line_async('notify-send _("Current Network Usage Limit exceeded"  "You need to change the Data Limit for the current connection\n    Right Click -> Settings and adjust the Spin Wheel \n\n or disconnect using the Network Manager Applet") ');
        }
    },

    // This is the main update run in a loop with a timer
    // The displays are made fixed width of 15 characters using padstring()
    update: function () {
		if (!GTopInstalled) {return};
        if (this.monitoredInterfaceName != null) {
            let timeNow = GLib.get_monotonic_time();
            let deltaTime = (timeNow - this.timeOld) / 1000000;
            GTop.glibtop_get_netload(this.gtop, this.monitoredInterfaceName);
            let upNow = this.gtop.bytes_out;
            let downNow = this.gtop.bytes_in;
            if (deltaTime != 0) {
                if (!this.compactDisplay) {
                   this.labelOne.set_text("\u2193" + this.padString (this.formatSpeed((downNow - this.downOld) / deltaTime), 10 + this.decimalsToShowIn));
                    this.labelTwo.set_text("\u2191" + this.padString (this.formatSpeed((upNow - this.upOld) / deltaTime), 10 + this.decimalsToShowIn));
                } else {
                    this.labelOne.set_text("\u21f5" + this.padString(this.formatSpeed((upNow - this.upOld + downNow - this.downOld) / deltaTime), 10 + this.decimalsToShowIn));
                    this.labelTwo.set_text("");
                }
                //Code for ultra compact display when not connected and a compact display
                //Better integration posible??
                if (this.numa_style == 'numa-not-connected' &&  this.compactDisplay) {
                     this.labelOne.set_text(" \u21f5");
                     this.labelTwo.set_text("");
                }
            }

            // Now check if we have just exceeded the total limit and need crisis action
            if ((upNow + downNow) / 1048576 > this.totalLimit && this.useTotalLimit && this.useCrisisManagement && (this.upOld + this.downOld) / 1048576 < this.totalLimit) {
                this.crisis();
            }

	    // Collect the three sets of cumulative usage data
            // and set a flag to update cinnamon-settings with new value at a latter time
            this.update_ct1 = ((downNow > this.downOld) || (downNow > this.downOld)) && (this.cumulativeInterface1 == this.monitoredInterfaceName);
            if (this.update_ct1) {
	        this.cT1 = this.cT1 + (downNow - this.downOld + upNow -this.upOld)/1048576;
            }
            this.update_ct2 = ((downNow > this.downOld) || (downNow > this.downOld)) && (this.cumulativeInterface2 == this.monitoredInterfaceName);
            if (this.update_ct2) {
	        this.cT2 = this.cT2 + (downNow - this.downOld + upNow -this.upOld)/1048576;
            }
            this.update_ct3 = ((downNow > this.downOld) || (downNow > this.downOld)) && (this.cumulativeInterface3 == this.monitoredInterfaceName);
            if (this.update_ct3) {
	        this.cT3 = this.cT3 + (downNow - this.downOld + upNow -this.upOld)/1048576;
            }


            // Update Old values
            this.upOld = upNow;
            this.downOld = downNow;
            this.timeOld = timeNow;
        }


        // Now set up tooltip every cycle
        if (this.monitoredInterfaceName != null) {
            this.set_applet_tooltip(_("Interface:") + " " + this.monitoredInterfaceName + " - " + _("Downloaded:") + " " + this.formatSentReceived(this.downOld) + " - " + _("Uploaded:")  + " " + this.formatSentReceived(this.upOld));
        }
        // Update selected items in left click menu every cycle
        this.menuitemInfo.label.text = "    " + this.monitoredInterfaceName + " - " + _("Downloaded:") + " " + this.formatSentReceived(this.downOld) + " - " + _("Uploaded:") + " " + this.formatSentReceived(this.upOld);

        //  rebuild Right Click menu but only when required and after changes flagged as it is a slow activity
        if (this.rebuildFlag) {
            this.rebuildFlag = false;
            this.buildContextMenu();
        }
        // Fix for Cinnamon 2.0 to remove Context Menu Items by running build context menu again next loop - note delay needed
        // No longer required thanks to alternative solution thanks to @Odyseus
        if (this.firstTimeFlag) {
           this.rebuildFlag = true;
            this.firstTimeFlag = false;
        }

        // Set background colour - green when data has flowed, orange when alert level reached and red when data limit reached

       this.numa_style = 'numa-not-connected';
        if ((this.downOld + this.upOld) > 0) {
           this.numa_style = 'numa-connected';
        }
        if (this.useTotalLimit) {
            if ((this.downOld + this.upOld) / 1048576 > this.totalLimit * this.alertPercentage / 100) {
                this.numa_style = 'numa-alert';
            }
            if ((this.downOld + this.upOld) / 1048576 > this.totalLimit) {
                this.numa_style = 'numa-limit-exceeded'
            }
        }

        // Now set the style for the Applet using styles from a stylesheet.csswidth and width from Settings
        this.actor.remove_style_class_name(this.last_numa_style); // We need to clear previous style
        this.actor.add_style_class_name(this.numa_style); // Now add the new style
        this.actor.set_style('width:' + this.appletWidth + 'px');

         // New Code for ultra compact display when not connected
         if (this.numa_style == 'numa-not-connected' &&  this.compactDisplay) {
             this.actor.set_style('width:' + 20 + 'px');
         }

        this.last_numa_style = this.numa_style;

        // Loop update timer - inibit when applet not running
        if (this.applet_running) {
            let timer = this.refreshIntervalIn * 500;
            Mainloop.timeout_add((timer), Lang.bind(this, this.updateCumulative));
        }
    },

    // Delays cumulative updates into cinnamon-settings by using two mainloop timers of half the refresh interval
    updateCumulative: function() {
        if (this.update_ct1) {
            this.cumulativeTotal1 = this.cT1;
        }
        if (this.update_ct2) {
            this.cumulativeTotal2 = this.cT2;
        }
        if (this.update_ct3) {
            this.cumulativeTotal3 = this.cT3;
        }
        let timer2 = this.refreshIntervalIn * 500;
        Mainloop.timeout_add((timer2), Lang.bind(this, this.update));
    },

formatSpeed: function (value) {
        return this.formatSentReceived(value) + "/s";
    },

    formatSentReceived: function (value) {
        // Note changes at 1000 rather than1024 are deliberate to avoid 'jitter' in display
        // Absolute value used because of potential for negative numbers now offset is included

    	let suffix = " KB";
    	if (Math.abs(value) >= 0) {
    	        value = value / 1024;
    		suffix = " KB";
    	}
    	if (Math.abs(value) >= 1000) {
    		value = value / 1024;
    		suffix = " MB";
    	}
    	if (Math.abs(value) >= 1000) {
    		value = value / 1024;
    		suffix = " GB";
    	}
    	if (Math.abs(value) >= 1000) {
    		value = value / 1024;
    		suffix = " TB";
    	}
    	let decimalAdjust = Math.pow(10, (this.decimalsToShowIn));
    	return (Math.floor(value * decimalAdjust) / decimalAdjust) + suffix;
    },


    // Pad string to length padto symetrically starting from left - can also use unicode
    // figure space which is equivalent to the digit width of fonts with fixed-width digits
    padString: function (string1 , padto ) {
       while (string1.length < padto) {
              string1 =  ' ' + string1;
              if (string1.length  <  padto) {
                 string1  = string1 + ' ' ;
              }
       }
        return string1;
    },


    on_applet_removed_from_panel: function () {
    	// Prepare to stop the update timer
        this.applet_running = false;
        this.settings.finalize();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}

/*
Version 3.2.1
1.0 Applet Settings now used for Update Rate, Resolution and Interface.
    Built in function used for left click menu.
1.1 Right click menu item added to open Settings Screen.
1.2 Default connection added. Warning on data limit exceeded added.
1.3 Slider and information lines added to left click menu to set Alarm level.
1.4 Three cumulative data monitors added.
1.5 Check for changed devices added to Right Click menu.
1.6  Alert display slider etc inhibited when inactive.
1.7 Add const UUID, Rebuild left on various settings changes.
1.7.1 Errors corrected
1.7.2 Beautified at http://jsbeautifier.org/
1.8.0 Added green background when data has flowed on selected interface.
1.8.1 Added more comments
1.9.0 Cumulative Usage now independent of interface being monitored
1.9.1 Indentation corrections
1.9.2 Reordering to make more clear
1.9.3 Beautify to spaces not tabs
1.10.0 Corrected error in handling tooltip at start-up  - V18_1 - as uploaded
2.0.0 New version with addition of vnstat statistics
2.0.1 Minor label and layout changes 03-07-2013
2.0.2 mainBox added so I can use remove_actor to avoid the need for restart when vnstati is not used.
2.0.3 Error checking for installation of vnstat and vnstati and change of location of temp file to applet folder in applet
2.0.4 U: and D: replaced by unicode up and down arrows to save space.
2.0.5 New option of Compact Display of total only rather than Up and Down loads
2.0.6 Test version - needs cinnamon restart
2.0.7 Compact Display and Width set in settings and implemented fully without restart required.
2.0.8 Added access to stylesheet.css and changelog.txt 09-07-2013
2.0.9 Compact Display can be changed in Context menu 10-07-2013
2.1.0 Uses tick \u2714 for selected interface - UPLOADED as development version on 11-07-2013
2.1.1 Picks up UUID from metadata.uuid
2.1.2 Puts Housekeeping and System items in a sub-menu 13-07-2013
2.1.3 Minor correction in initialisation of cumulative data and layout/comments improved 14-07-2013
2.2.0 Start of implementing some form of response to exceeding data limits - termed crisis management
2.2.1 Crisis Management flag and 'terminal command' to be run now in Settings Panel.
2.2.2 Facility for two preset scripts in addition to string added. Right click menu has additional housekeeping functions to edit and test these scripts added.
2.2.3 Addition documentation
2.2.4 Changed 'crisis' to 'suspend' for preset script and tested. Reorder advanced functions and added separators.
2.2.5 Three special cases now in use - suspendscript, alertscript and modalalert. Function added to implement the modal dialog used by modal alert. Testing functions still 'exposed' to users on right click function submenu.
To think about - do we need the ability to have a terminal command option as any terminal command can be put into the alertScript file, in fact it can be a series of commands run asynchronously by ending them with a $ so a sound file could be played and a notification put up using zenity at the same time. This is a safer way ahead whilst leaving a huge flexibility for customisation. Should a different selection mechanism be used?
Conclusion - change to a drop down selection of options, initially the three currently in use but consider adding sound and notification options. remove terminal string option as it can be in a script file.
2.2.6 Implemented drop down alert handling plus change back to KB from kB and replace round with floor
2.2.7 Scripts commented and checked. Extra options of notify and do nothing added. Use now made of Sox to play audio warnings and notify-send to add notifications. sox needs to be installed
2.2.8 Beautified at http://jsbeautifier.org/
2.2.9 Help changed to open http:www.pcurtis.com/spices.htm#numa until I get time to write a help file - UPLOADED TO WEB SITE on 08-08-2013
2.3.0 Modified call to modalDialog to have parameter with the text string to display
      Added option to Disable Networking using NMClient (Does not disable ppp0 connections not initiated by network manager)
2.3.1 Adjustable Delay time when disabling added to Settings
      Various bits of code tidied up
2.3.2 Added extra Settings - displayExtraHousekeeping, useAlertSound and alertSound (sound file to play)
      and code to implement
2.3.3 Quick fix to background colours to use transparency so they work with light and dark themes 02-09-2013
2.3.4 Addition of radiused borders to background to improve appearance
2.3.5 Major change in use of css styles for the background colours which show connection and alert status.
      This allows the user to match colours etc to a particular theme.
2.3.6 Minor bug fix - Context Menu not always rebuilt after adding or removing advanced functions submenu.
2.3.7 Bug fix - Cumulative counters 1 and 3 not being saved correctly
2.3.8  Anomoly fix - Avoid calling  GTop.glibtop_get_netload() without valid interface -
       possible latest versions can segfault if interface not valid.
2.3.9  Add fix for Applet not being fully halted when removed from panel (from dansie)
2.3.10 Fudge to make NUMA behave the same for Cinnamon 1.8 and 2.0 by removing the
       automatically added items from the context menu by calling rebuilding menu a second
       time during startup sequence after a one cycle delay. Long term solution is to use
       dansie's method of building everything as a submenu.
2.3.11 Default settings changed to start with cumulative monitoring off for all interfaces
       (null) in settings file.
2.3.12 Revert to the old method of handling cumulative data and only update cumulative totals
       for the monitored interface. Slightly less flexible but intended to reduce the chances
       of segfaults until the problem is understood and resolved.
2.3.13 Changes to Settings File to explicitly use real numbers for Cumulative Data
2.3.14 Test of reset function including setting reset date and time
       and avoid use of updating a Cinnamon Settings within a single expression
       NB Interface 1 only
       TEST at 10x speed - remember to reset!!!
2.3.15 Now reset function on all 3 interfaces which also avoids use of updating a Cinnamon Settings
       within a single expression on all interfaces.
       Display simplified in left click menu to format of: interface - reset date and time - Cumulative data
       ie now a single line for each interface.
       Settings file changed to use generic bidirectional where interfaces are set from applet and defaults changed
       Reset to run at correct speed
       UPLOADED VERSION 10 March 2014.
2.3.16 Try delaying cumulative updates into cinnamon-settings by using two mainloop timers.
       Bug fix for when no default interface specified and default unchecked in settings.
       Some default settings changed in settings-schema
2.3.17 Some changes so cinnamon-settings values of cumulative total are only updated when changed in second part of loop
       Added interface name to reset menu item and rebuildFlag to on_interface_settings_changed()
       Changed 'Settings' to 'Configure' in Context Menu for consistency with Cinnamon 2.0
2.4.0  Changes to automatically select first active interface at start-up But Only If a default interface was not specified
       and the last interface was not PPP0.
       Added explanatory text to settings-schema.json comment for the useDefaultInterface flag
2.4.1  Moved Configure to bottom of context menu
       Tried multiple instances - useful but automatic update fails and hand crafting of .cinnamon/configs/netusagemonitor@pdcurtis required
       Checked with Cinnamon 2.2 via LiveUSB
2.4.2  Display of Header inhibited when no Cumulative Data being displayed.
2.4.3.0   Multiple instances in metadata.json
          Changes to minimise width of applet when not connected to go with multiple instances.
          Change to width in stylesheet.css to match
          New function to pad and center output to remove jitter rather use styles.
2.4.3.1   General tidy up of commented out code
2.4.3.2   Add an offset which is set in settings but is also cleared by reset of usage
          Display includes offset when in use.
          Currently only available on Cumulative Data Usage 1
          Continue tidy up
2.4.3.3   Width padding corrected for display resolution
          Offsets on all available Cumulative Data Usage channels
2.4.3.4   Changed space character to \u2007 which has an equivalent width to a number
2.4.3.5   Added a call to buildContextMenu on left click to set up after a connection has changed.
2.4.3  Above all compressed into a single commit from above branch created in development branch
2.4.4  Removal of some commented out text and change log updated
2.4.4.1   Changes in padding and in width calculation for compact display
2.4.4.2   Modified functions for formatSpeed and formatSentReceived to extend to [B,] GB and TB and make consistent
2.5.0  Version with single instance but all other enhancements in preparation for upload
          max-instance changed in metadata.json to 1 to hopefully avoid need for hand crafting of
          .cinnamon/configs/netusagemonitor@pdcurtis
          Changes to totalLimit and alertPercentage in settings-schema.json.
          Tested with Cinnamon 2.4.0
          Updates to changelog.
2.6.0  Added support for Android Bluetooth tethered connections which use device bnep1 under Mint 17
          Duplicated code for ppp0 using bnep0 in three places
          Required because selecting the active bluetooth connection which looks like 12:34:56:78:90:12
          in the network manager does not work
          It ought to be possible to use bnep0 whenever the active interface contains semicolons
          but if it aint broke don't fix it!
          Corrected formatSentReceiver to handle negative numbers resulting from offsets
3.0.0     Modifications for Mint 18 and higher with Cinnamon 3.0 and higher
          Changes to Suspend Script to work with SystemD as well as Dbus for suspend and changes to allow immediate suspend option in box.
          Addition of version test to chose between xed for Mint 18 with Cinnamon 3.0 and gedit for earlier versions.
3.0.2     NOTE 3.0.1 was not a separate version - it was a mechanism to overwrite a faulty zip upload of 3.0.0 to the cinnamon-spices web site
3.0.3     Corrected icon.png in applet folder which is used by Add Applets and removed incorrect icon from metadata.json
3.0.4     Increased maximum from 5000 mbytes to 100000 mbytes for totalLimit and cumulative offsets
3.0.5     Made much more use of formatSentReceived() because of increase in limits
          Removed a number of commented out blocks to do with cumulative totals and formatting.
3.0.6     Choice of units for limits and offsets to be Mbytes or Gbytes by drop down widget in settings (configuration) window
          Maximum Limits and Offsets set to 200000 Mbytes/Gbytes as appropriate

Transition to new cinnamon-spices-applets repository from github.com/pdcurtis/cinnamon-applets

3.0.7     Change from call to firefox to opening README.md on Context submenu.
          Delete helpfile.txt from applet folder and update changelog.txt
3.1.0     Version numbering harmonised with other Cinnamon applets and added to metadata.json so it can show in 'About...'
          icon.png copied back into applet folder so it can show in 'About...'
          Add translation support to applet.js
          Identify strings for translation and remove leading and trailing spaces and replace with separate spaces where required.
          Add po folder to applet
          Create netusagemonitor.pot using cinnamon-json-makepot --js po/netusagemonitor.pot
          Version and changes information update in applet.js and changelog.txt
          Update README.md (2x) for contributions.
3.1.1     Additional PopupMenu.PopupMenuSection added as per an easy and elegant suggestion from @collinss and @Odyseus so 'standard' context menu items are retained when the menu is refreshed.
          Update netusagemonitor.pot using cinnamon-json-makepot --js po/netusagemonitor.pot
          Version and changes information update in applet.js and changelog.txt
          Update README.md (2x) for contributions from @collinss and @Odyseus.
3.1.2     Change spawn_command_line_sync to spawn_command_line_async to remove one reason for 'dangerous' classification.
          Correct several spelling errors in comments and .md files.
3.2.0     Remove duplicate let declarations occurances in common coding for Cinnamon 3.4 thanks to @NikoKraus  [#604]
3.2.1     Harmonise with code writen by author for vnstat@cinnamon.org and revert 3.1.2 until further testing.
          Updated netusagemonitor.pot using cinnamon-json-makepot --js po/netusagemonitor.pot as string added.
          Tidy up comments in applet.js
          Update README.md to remove a couple of references to Ubuntu from early days.
          Usual updates to new version in applet.js, changelog and metadata.json
3.2.2     Removed unused this.UUID = metadata.uuid
          Improved l10n translation support.
          Added CHANGELOG.md to applet folder and use it instead of changelog.txt in right click menu
          CHANGELOG.md based on recent entries to changelog.txt with last changes at the top. changelog.txt currently remains in applet folder but is not used.
          Use symbolic links for README.md and CHANGELOG.md instead of copies from the applet folder to UUID folder for the Cinnamon Web Site to pick up
## 3.2.3
 * Add check that GTop library is installed using a try and catch(e) technique
 * Remove some additional duplicate let declarations occurances which could give difficulties in Cinnamon 3.4
 * Changes to l10n translation support to bring ahead of GTop test.
 * Update CHANGELOG.md, README.md, settings-schema.json and metadata.json
 * Update netusagemonitor.pot so translations can be updated.
## 3.2.3.1
 * Changes in intialisation to remove some CJS warnings
## 3.2.4
 * Change method of inhibiting display of vnstati image when vnstati not installed or enabled in settings by substituting a tiny image instead of use of an extra mainBox which led to CJS warnings.
 * Improved notification when vnstat and vnstati not installed
 * Tidy up code
 * Better formatting of CHANGELOG.md
## 3.2.4.1
  * Changes to README.md to alert users to problems on Fedora 27 with changes in network manager libraries - issue #1647
## 3.2.5
  * Changes to check which network manager libraries are in use and choose which to use - addresses/solves issue #1647 with Fedora versions 27 and higher.
  * Note that there may be problems with option of disconnecting the network manager when data usage limit is exceeded so checks are needed under NM before the issue can be marked as closed.
  * Use xdg-open in place of gedit or xed to allow use on more distros
## 3.2.6
  * Changes for Cinnamon 4.0 and higher to avoid segfaults when old Network Manager Library is no longer available by using multiversion with folder 4.0
  * Remove Try-Catch as no longer required in 4.0 and associated changes.
  * It is believed that all Distributions packaging Cinnamon 4.0 have changed to the new Network Manager Libraries
  * Add cinnamon-version to metadata.json (Provides information on which Cinnamon versions can load it)
  * Update README.md and CHANGELOG.md
## 3.2.7
  * Add multiversion 2.6 folder
  * Use ModalDialog.NotifyDialog instead of internal function for 2.6+
  * Change location of vnstatImage to home folder rather than applet folder.
  * Tidy us some of text in Notifications and trailing spaces
## 3.2.8
  * Provide options to choose different vnstati formats including a user specified format (2.6 and 4.0)
  * Update CHANGELOG.md and README.md
## 3.2.9
  * Update stylesheet to better match Cinnamon 4.0 System Styles - less rounded and less intrusive.
  * Add an initial mechanism to provide persistence for user edits of the stylesheet.
## 3.3.0
  * Correct code for style .numa-not-connected in applet.js
  * Further enhancement in styles to match Cinnamon 4.0
  * Change selection of audible warning to use soundfilechooser widget in settings-schema.json for 3.2 and 4.0
*/
