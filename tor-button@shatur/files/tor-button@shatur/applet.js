const Applet = imports.ui.applet; //Main
const St = imports.gi.St; // Needed for translations
const Gettext = imports.gettext; // Needed for translations
const GLib = imports.gi.GLib; // Needed for start programs, work with files and translations
const PopupMenu = imports.ui.popupMenu; // Needed for main applet menu
const Settings = imports.ui.settings; // Settings in applet
const Mainloop = imports.mainloop; // Needed for timer update loop
const Lang = imports.lang; // Needed for menus
const UUID = "tor-button@shatur"; // Applet UUID

var torAppletCheck; // Show information to applet from '/tmp/.torAppletCheck'
var torEnable; // Show previous information from file (off by default)
var applet_running = true; // Allow applet to be fully stopped when removed from panel
const tor_off = "Tor disabled";
const tor_on = "Tor enabled";


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
        
        // Part of l10n support;
        Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

        // Popup Menu
        // Initialize      
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        // Add items
        // Tor status toggle
        this.tor_toggle = new PopupMenu.PopupSwitchIconMenuItem( _("Tor network"), false, "tor-off", St.IconType.SYMBOLIC);
        this.tor_toggle.connect('toggled', Lang.bind(this, this.tor_launcher));
        this.menu.addMenuItem(this.tor_toggle);
        //Rebuild chain
        let rebuild_button = new PopupMenu.PopupIconMenuItem( _("Rebuild chain"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
        rebuild_button.connect('activate', Lang.bind(this, function() {
            GLib.spawn_command_line_async("pkill -1 tor"); // Send signal to rebuild chain to Tor 
        }));
        this.menu.addMenuItem(rebuild_button)
        
        
        this.setAllowedLayout(Applet.AllowedLayout.BOTH); // Make applet works with any panel orientation
        
        //Settings
        this.settings = new Settings.AppletSettings(this, UUID, instance_id); // Settings initialization
        this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
        "location", // The setting key
        "location", // The property to manage (this.location)
        function(){}); // Callback when value changes (empty function)
        this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
        "refreshInterval", // The setting key
        "refreshInterval", // The property to manage (this.refreshInterval)
        function(){}); // Callback when value changes (empty function)
        this.settings.bindProperty(Settings.BindingDirection.IN,
        "showNotifications",
        "showNotifications",
        function(){}); // Callback when value changes (empty function)
        this.settings.bindProperty(Settings.BindingDirection.IN,
        "runAsRoot",
        "runAsRoot",
        function(){}); // Callback when value changes (empty function)

        // Make sure the temp file is created
        GLib.spawn_command_line_async('touch /tmp/.torAppletCheck');        
        
        // Generate file
        GLib.spawn_command_line_async('sh ' + GLib.get_home_dir() + '/.local/share/cinnamon/applets/'+UUID+'/check.sh'); // Run check bash script to write Tor status in '/tmp/.torAppletCheck'
        torAppletCheck = GLib.file_get_contents("/tmp/.torAppletCheck").toString(); // Read information from file
        torEnable = torAppletCheck; // Set variable first value

        //Icon and tooltip
        if (torAppletCheck.substr(5,2) == "ON") {            
            this.set_applet_icon_symbolic_name('tor-on'); // Set applet icon
            this.tor_toggle.setToggleState(true); // Set toggle state
            this.tor_toggle.setIconSymbolicName("tor-on"); // Set toggle icon
            this.set_applet_tooltip(_(tor_on)); // Set tooltip
        }
        else { // Check Tor status
            this.set_applet_icon_symbolic_name('tor-off');
            this.tor_toggle.setToggleState(false);
            this.tor_toggle.setIconSymbolicName("tor-off");    
            this.set_applet_tooltip(_(tor_off));
        }

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
                                                           if (this.showNotifications) GLib.spawn_command_line_async('notify-send \'Tor\' \''+_("Tor closed.")+'\' --icon=dialog-information'); // Show notification
                                                           this.set_applet_tooltip(_(tor_off)); // Change tooltip
                                                           this.tor_toggle.setToggleState(false); // Toggle if Tor was killed not by applet
                                                           this.tor_toggle.setIconSymbolicName("tor-off"); // Change icon ip popup menu          
                                                           torEnable = torAppletCheck; // Set previous information for Tor status
                }
                else {
                    this.set_applet_icon_symbolic_name('tor-on'); 
                    if (this.showNotifications) GLib.spawn_command_line_async('notify-send \'Tor\' \''+_("Tor launched.")+'\' --icon=dialog-information'); // Show notification               
                    this.set_applet_tooltip(_(tor_on)); 
                    this.tor_toggle.setToggleState(true); 
                    this.tor_toggle.setIconSymbolicName("tor-on");                 
                    torEnable = torAppletCheck;
                }
            }
            Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.updateLoop)); // Update loop
        }
    },
    
    on_applet_clicked: function() {
        this.menu.toggle(); // Show popup menu 
    },
    
    tor_launcher: function() {
        if (torAppletCheck.substr(5,3) == "OFF") { // Check information from file without 'true,' and '\n '
                                                   if (this.runAsRoot == true) pid = GLib.spawn_command_line_async('gksu -u tor '+this.location); // Run tor from location settings with gksu
                                                   else GLib.spawn_command_line_async(this.location); // Run tor from location settings as normal user
        }
        else {
            if (this.runAsRoot == true) GLib.spawn_command_line_async('gksu pkill tor');  // Kill Tor with gksu       
            else GLib.spawn_command_line_async('pkill tor'); // Kill tor as normal user
        }
        this.menu.toggle(); // Hide popup menu 
    }
};

// Always needed
function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
