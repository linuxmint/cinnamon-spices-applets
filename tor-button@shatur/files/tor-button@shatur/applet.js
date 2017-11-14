const Applet = imports.ui.applet; // Main
const St = imports.gi.St; // Needed for translations
const Gettext = imports.gettext; // Needed for translations
const GLib = imports.gi.GLib; // Needed for start programs and translations
const PopupMenu = imports.ui.popupMenu; // Needed for main applet menu
const Settings = imports.ui.settings; // Settings in applet
const Lang = imports.lang; // Needed for menus
const UUID = "tor-button@shatur"; // Applet UUID

const FLAGS = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD; // Default running flags

var pid = null; // pid of Tor

//var torrc = new GLib.KeyFile();


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
        this.tor_toggle.connect('toggled', Lang.bind(this, this.launch_tor));
        this.menu.addMenuItem(this.tor_toggle);
        // Rebuild chain
        let rebuild_button = new PopupMenu.PopupIconMenuItem( _("Rebuild chain"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
        rebuild_button.connect('activate', Lang.bind(this, this.rebuild_chain));
        this.menu.addMenuItem(rebuild_button)

        this.setAllowedLayout(Applet.AllowedLayout.BOTH); // Make applet works with any panel orientation

        // Bind settings to variables
        this.settings = new Settings.AppletSettings(this, UUID, instance_id); // Settings initialization

        this.settings.bindProperty(Settings.BindingDirection.IN, // Setting type
        "torPath", // The setting key
        "torPath", // The property to manage (this.torPath)
        function(){}); // Callback when value changes (empty function)

        this.settings.bindProperty(Settings.BindingDirection.IN,
        "showNotifications",
        "showNotifications",
        function(){});

        this.settings.bindProperty(Settings.BindingDirection.IN,
        "runAsRoot",
        "runAsRoot",
        function(){});

        this.settings.bindProperty(Settings.BindingDirection.IN,
        "configPath",
        "configPath",
        function(){});

        // Icon and tooltip
        this.set_applet_icon_symbolic_name('tor-off');
        this.tor_toggle.setIconSymbolicName("tor-off");
        this.set_applet_tooltip(_("Tor disabled"));
    },

    parse_command: function(command) {
        let [success, argv] = GLib.shell_parse_argv(command); // Parse this command to make it executable (without this don't work)
            if ( !success ) {
                GLib.spawn_command_line_async('notify-send "' + _('Error') + '" "' + _('Unable to parse ') + command + '" --icon=error'); // Show error
        		this.tor_toggle.setToggleState((this.pid == null)? true : false); // Switch toggle in menu back
                return;
            }
            return argv;
    },

    // Fully close applet
    on_applet_removed_from_panel: function () {
        this.settings.finalize();
    },

    on_applet_clicked: function() {
        this.menu.toggle(); // Show popup menu
    },

    launch_tor: function() {
        if (this.pid == null) { // Check if Tor is running
            if (!GLib.file_test(this.configPath, GLib.FileTest.IS_REGULAR)) { // Check if config file doesn't exist
                GLib.spawn_command_line_async('notify-send "' + _('Error') + '" "' + _('Unable to open configuration file ') + this.configPath + '" --icon=error'); // Show error
                this.tor_toggle.setToggleState(false); // Switch toggle in menu
                return;
            }
            let command = this.torPath.replace("~/", GLib.get_home_dir() + "/") + " -f " + this.configPath; // Replace all ~/ with path to home directory and add config as argument
            if (this.runAsRoot == true) command = "pkexec -u tor " + command; // If "run as root" enabled in applet settings add to aforementioned command "pkexec -u tor " to run as tor user

            try {
                [result, pid] = GLib.spawn_async(null, this.parse_command(command), null, FLAGS, null); // Run tor from location settings
                GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this.on_closed)); // Run Tor and function on_closed
                this.pid = pid; // Set pid as global variable

                // Change status of applet
                this.set_applet_icon_symbolic_name('tor-on'); // Set applet icon on panel
                if (this.showNotifications) GLib.spawn_command_line_async('notify-send "Tor" "' + _('Process launched.') + '" --icon=dialog-information'); // Show notification
                this.set_applet_tooltip(_("Tor enabled")); // Set applet tooltip
                this.tor_toggle.setToggleState(true); // Switch toggle in menu
                this.tor_toggle.setIconSymbolicName("tor-on"); // Change icon in menu
            } catch(e) {
                GLib.spawn_command_line_async('notify-send "' + _('Error') + '" "' + _('Unable to start Tor: ') + e + '" --icon=error'); // Show notification
                this.tor_toggle.setToggleState(false); // Switch toggle in menu
                return;
            }
        }
        else {
            let command = "kill " + this.pid; // Command to kill Tor
            if (this.runAsRoot == true)  command = "pkexec " + command; // If "run as root" enabled in applet settings add to aforementioned command "pkexec " to run as root
            GLib.spawn_async(null, this.parse_command(command), null, FLAGS, null); // Kill Tor
        }
        this.menu.toggle(); // Hide popup menu
    },

    on_closed: function(pid, status) {
        this.pid = null; // Reset Tor pid value
        this.set_applet_icon_symbolic_name('tor-off'); // Change icon
        if (this.showNotifications) GLib.spawn_command_line_async('notify-send "Tor" "' + _('Process closed.') + '" --icon=dialog-information'); // Show notification
        this.set_applet_tooltip(_("Tor disabled")); // Change tooltip
        this.tor_toggle.setToggleState(false); // Switch toggle in menu
        this.tor_toggle.setIconSymbolicName("tor-off"); // Change icon ip popup menu
    },

    rebuild_chain: function() {
        if (this.pid != null) { // Check if Tor is running
            let command = "kill -1 " + this.pid; // Command to rebuild chain
            if (this.runAsRoot == true)  command = "pkexec " + command; // If "run as root" enabled in applet settings add to aforementioned command "pkexec " to run as root
            GLib.spawn_async(null, this.parse_command(command), null, FLAGS, null); // Rebuild Tor chain
        }
        else GLib.spawn_command_line_async('notify-send "' + _('Error') + '" "' + _('Tor is not running.') + '" --icon=error'); // Show error
    }
};

// Always needed
function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
