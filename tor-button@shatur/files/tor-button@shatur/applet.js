const Applet = imports.ui.applet; // Main
const St = imports.gi.St; // Needed for translations
const Gettext = imports.gettext; // Needed for translations
const GLib = imports.gi.GLib; // Needed for start programs and translations
const PopupMenu = imports.ui.popupMenu; // Needed for main applet menu
const Settings = imports.ui.settings; // Settings in applet
const Lang = imports.lang; // Needed for menus
const UUID = "tor-button@shatur"; // Applet UUID

var Pid = null; // Pid of Tor
var flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD; // Default running flags


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
        this.tor_toggle.connect('toggled', Lang.bind(this, this.torLauncher));
        this.menu.addMenuItem(this.tor_toggle);
        //Rebuild chain
        let rebuild_button = new PopupMenu.PopupIconMenuItem( _("Rebuild chain"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
        rebuild_button.connect('activate', Lang.bind(this, this.rebuildChain));
        this.menu.addMenuItem(rebuild_button)
        
        this.setAllowedLayout(Applet.AllowedLayout.BOTH); // Make applet works with any panel orientation
        
        //Settings
        this.settings = new Settings.AppletSettings(this, UUID, instance_id); // Settings initialization
        this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
        "location", // The setting key
        "location", // The property to manage (this.location)
        function(){}); // Callback when value changes (empty function)
        this.settings.bindProperty(Settings.BindingDirection.IN,
        "showNotifications",
        "showNotifications",
        function(){}); // Callback when value changes (empty function)
        this.settings.bindProperty(Settings.BindingDirection.IN,
        "runAsRoot",
        "runAsRoot",
        function(){}); // Callback when value changes (empty function)
        
        //Icon and tooltip
        this.set_applet_icon_symbolic_name('tor-off');
        this.tor_toggle.setToggleState(false);
        this.tor_toggle.setIconSymbolicName("tor-off");
        this.set_applet_tooltip(_("Tor disabled"));
    },
    
    // Fully close applet
    on_applet_removed_from_panel: function () {
        this.settings.finalize();
    },
    
    on_applet_clicked: function() {
        this.menu.toggle(); // Show popup menu
    },
    
    torLauncher: function() {
        if (this.Pid == null) {
            let command = this.location.replace("~/", GLib.get_home_dir() + "/"); //replace all ~/ with path to home directoryion
            if (this.runAsRoot == true) command = "pkexec -u tor " + command; // If "run as root" enabled in applet settings add to aforementioned command "pkexec -u tor " to run as tor user
            let [success, argv] = GLib.shell_parse_argv(command); // Parse this command to make it executable (without this don't work)
            if ( !success ) {
                GLib.spawn_command_line_async('notify-send "'+_('Error')+'" "'+_('Unable to parse ')+this.command+'" --icon=error'); // Show error on unsuccessful parsing
                return;
            }
            try {
                [result, pid] = GLib.spawn_async(null, argv, null, flags, null); // Run tor from location settings with gksu
                GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this.onClosed)); // Run Tor and function onClosed
                this.Pid = pid; // Set Pid as global variable
                this.set_applet_icon_symbolic_name('tor-on'); // Set applet icon on panel
                if (this.showNotifications) GLib.spawn_command_line_async('notify-send "Tor" "'+_('Process launched.')+'" --icon=dialog-information'); // Show notification
                this.set_applet_tooltip(_("Tor enabled")); // Set applet tooltip
                this.tor_toggle.setToggleState(true); // Switch toggle in menu
                this.tor_toggle.setIconSymbolicName("tor-on"); // Change icon in menu
            } catch(e) {
                GLib.spawn_command_line_async('notify-send "'+_('Error')+'" "'+_('Can\'t start Tor.')+'" --icon=error'); // Show notification
                return;
            }
        }
        else {
            let command = "kill " + this.Pid; // Command to kill Tor
            if (this.runAsRoot == true)  command = "pkexec " + command; // If "run as root" enabled in applet settings add to aforementioned command "pkexec " to run as root
            let [success, argv] = GLib.shell_parse_argv(command); // Parse this command to make it executable (without this don't work)
            if ( !success ) {
                GLib.spawn_command_line_async('notify-send "'+_('Error')+'" "'+_('Unable to parse ')+this.command+'" --icon=error'); // Show error on unsuccessful parsing
                return;
            }
            GLib.spawn_async(null, argv, null, flags, null); // Run tor from location settings with gksu
        }
        this.menu.toggle(); // Hide popup menu
    },
    
    onClosed: function(pid, status) {
        this.Pid = null; // Reset Tor Pid value
        this.set_applet_icon_symbolic_name('tor-off'); // Change icon
        if (this.showNotifications) GLib.spawn_command_line_async('notify-send "Tor" "'+_('Process closed.')+'" --icon=dialog-information'); // Show notification
        this.set_applet_tooltip(_("Tor disabled")); // Change tooltip
        
        this.tor_toggle.setToggleState(false); // Switch toggle in menu
        this.tor_toggle.setIconSymbolicName("tor-off"); // Change icon ip popup menu
    },
    
    rebuildChain: function() {
    let command = "kill -1 " + this.Pid; // Command to rebuild chain
            if (this.runAsRoot == true)  command = "pkexec " + command; // If "run as root" enabled in applet settings add to aforementioned command "pkexec " to run as root
            let [success, argv] = GLib.shell_parse_argv(command); // Parse this command to make it executable (without this don't work)
            if ( !success ) {
                GLib.spawn_command_line_async('notify-send "'+_('Error')+'" "'+_('Unable to parse ')+this.command+'" --icon=error'); // Show error on unsuccessful parsing
                return;
            }
            GLib.spawn_async(null, argv, null, flags, null); // Run tor from location settings with gksu
    }
};

// Always needed
function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
