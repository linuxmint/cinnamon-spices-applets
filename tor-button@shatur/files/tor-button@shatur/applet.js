const Applet = imports.ui.applet; //Main
const St = imports.gi.St; // Needed for translations
const Gettext = imports.gettext; // Needed for translations
const GLib = imports.gi.GLib; // Needed for starting programs and translations
const Settings = imports.ui.settings; // Settings in applet
const Mainloop = imports.mainloop; // Needed for timer update loop
const Lang = imports.lang; // Needed for menus
const UUID = "tor-button@shatur"; // Applet UUID

torAppletCheck = "OFF"; // Show information to applet from '/tmp/.torAppletCheck'
torEnable = "true,OFF\n"; // Show previous information from file (off by default)
applet_running = true; //** Allow applet to be fully stopped when removed from panel
press_on = "Press to enable Tor";
press_off = "Press to disable Tor";


// Needed for translations
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans !== str && customTrans !== "")
        return customTrans;
    return Gettext.gettext(str);
}

// Always needed
function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}
// Always needed
MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype, // Now TextIcon Applet
    
    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        
        //Settings
        this.settings = new Settings.AppletSettings(this, UUID, instance_id); // Settings initialization
        this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
        "location", // The setting key
        "location", // The property to manage (this.location)
        this.on_settings_changed, // Callback when value changes
        null); // Optional callback data
        this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
        "refreshInterval", // The setting key
        "refreshInterval", // The property to manage (this.refreshInterval)
        this.on_settings_changed, // Callback when value changes
        null); // Optional callback data
        this.settings.bindProperty(Settings.BindingDirection.IN,
        "showNotifications",
        "showNotifications",
        this.on_settings_changed,
        null);
        
        // Part of l10n support;
        Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
        
        //Icon and tooltip
        this.set_applet_icon_symbolic_name('tor-off');
        this.set_applet_tooltip(_(press_on));;
        
        //Create loop
        Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.updateLoop));
    },
    
    // Inhibit the update timer when applet removed from panel
    on_applet_removed_from_panel: function () {
        applet_running = false;
        this.settings.finalize();
    },
    
    // Update loop timer and check status of Tor
    updateLoop: function () {
        if ( applet_running == true) {
            GLib.spawn_command_line_async('sh ' + GLib.get_home_dir() + '/.local/share/cinnamon/applets/'+UUID+'/check.sh'); // Run check bash script to write Tor status in '/tmp/.torAppletCheck'
            torAppletCheck = GLib.file_get_contents("/tmp/.torAppletCheck").toString(); // Read information from file
            if ( torEnable != torAppletCheck ) // Check status change
            {
                if (torAppletCheck.substr(5,3) == "OFF") { // Check information from file without 'true,' and '\n '
                                                           this.set_applet_icon_symbolic_name('tor-off'); // Change icon
                                                           if (this.showNotifications == 1) { GLib.spawn_command_line_async('notify-send \'Tor\' \'Tor closed.\' --icon=dialog-information'); } // Show notification                 
                                                           this.set_applet_tooltip(_(press_on)); // Change tooltip
                                                           torEnable = torAppletCheck; // Set previous information for Tor status
                }
                else {
                    this.set_applet_icon_symbolic_name('tor-on');
                    if (this.showNotifications == 1) { GLib.spawn_command_line_async('notify-send \'Tor\' \'Tor launched.\' --icon=dialog-information'); }                    
                    this.set_applet_tooltip(_(press_off));
                    torEnable = torAppletCheck;
                }
            }
            Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.updateLoop)); // Update loop
        }
    },
    
    on_applet_clicked: function() {
        if (torAppletCheck.substr(5,3) == "OFF") { // Check information from file without 'true,' and '\n '
                                                   GLib.spawn_command_line_async(this.location); // Run tor from location settings        
        }
        else {
            GLib.spawn_command_line_async('pkill tor');  // Kill Tor                 
        }
    }
};

// Always needed
function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
