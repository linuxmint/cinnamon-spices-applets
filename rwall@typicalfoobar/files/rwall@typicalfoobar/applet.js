const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const AppletDir = imports.ui.appletManager.appletMeta["rwall@typicalfoobar"].path;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "rwall@typicalfoobar";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        // Set the icon and tooltip of this applet
        this.set_applet_icon_path(AppletDir + '/icon.png');
        this.set_applet_tooltip(_('rwall'));
        
        // Setup this applet's settings
        this.initSettings(instance_id);
        
        // Setup the menu
        this.initMenu(orientation);
    },
    
    // Sets up this applet's settings
    initSettings: function(instance_id) {
        this.settings = new Settings.AppletSettings(this, "rwall@typicalfoobar", instance_id);
        
        this.settings.bindProperty(
            Settings.BindingDirection.IN,       // The binding direction - IN means we only listen for changes from this applet
            "query-string",                     // The setting key, from the setting schema file
            "queryString",                      // The property to bind the setting to - in this case it will initialize this.icon_name to the setting value
            this.onSettingsChange,              // The method to call when this.icon_name has changed, so you can update your applet
            null);                              // Any extra information you want to pass to the callback (optional - pass null or just leave out this last argument)
                                 
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "resolution-string",
            "resolutionString",
            this.onSettingsChange,
            null);
            
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "wallpaper-save-directory",
            "wallpaperSaveDirectory",
            this.onSettingsChange,
            null);
            
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "cron-frequency-string",
            "cronFrequencyString",
            this.onSettingsChange,
            null);
            
        // Start the application with the initial values
        this.onSettingsChange();
    },
    
    // Sets up this applet's menu
    initMenu: function(orientation) {
        // The menu manager closes the menu after focus has changed.
        // Without adding the menu to the menu manager, the menu would stay open
        // until the user clicked on the applet again.
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        
        // Create the menu
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        
        // Add the menu to the menu manager
        this.menuManager.addMenu(this.menu);
        
        // Create the "Use Cron" menu item
        this.useCronMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Use Cron"), this.isCronBeingUsed());
        this.useCronMenuItem.connect('toggled', Lang.bind(this, this.toggleCron));
        this.menu.addMenuItem(this.useCronMenuItem);
        
        // Create the "Next Wallpaper" menu item
        let nextWallpaperMenuItem = new PopupMenu.PopupMenuItem(_("Next Wallpaper"));
        nextWallpaperMenuItem.connect('activate', Lang.bind(this, this.runRwall));
        this.menu.addMenuItem(nextWallpaperMenuItem);
        
        // Create the "Save Wallpaper" menu item
        let saveWallpaperMenuItem = new PopupMenu.PopupMenuItem(_("Save Wallpaper"));
        saveWallpaperMenuItem.connect('activate', Lang.bind(this, this.saveWallpaper));
        this.menu.addMenuItem(saveWallpaperMenuItem);
    },
    
    onSettingsChange: function() {
        // Update the settings, then turn cron off/on as needed
        Util.spawnCommandLine(
            AppletDir + '/bin/rwall settings ' +
            '"' + this.queryString + '" ' +
            '"' + this.resolutionString + '" ' +
            '"' + this.wallpaperSaveDirectory + '" ' +
            '"' + this.cronFrequencyString + '"'
        );
    },
    
    // Returns true if the cron job is running, false otherwise
    isCronBeingUsed: function() {
        return GLib.file_test(AppletDir + '/etc/USING-CRON.lock', GLib.FileTest.EXISTS);
    },
    
    // Called when the Save Wallpaper button is clicked
    saveWallpaper: function() {
        Util.spawnCommandLine(AppletDir + '/bin/rwall save-wallpaper');
    },
    
    // Called when the Update Cron button is clicked in settings
    updateCronButtonClick: function() {
        this.updateCron();
    },
    
    // Updates the cron job, if it is running
    updateCron: function() {
        Util.spawnCommandLine(AppletDir + '/bin/rwall cron-update');
    },
    
    // Toggles the cron job off/on
    toggleCron: function() {
        Util.spawnCommandLine(AppletDir + '/bin/rwall cron-toggle');
    },
    
    // Runs rwall
    runRwall: function() {
        Util.spawnCommandLine(AppletDir + '/bin/rwall');
    },

    on_applet_clicked: function() {
        // Check if cron is in use and set the toggle state accordingly
        this.useCronMenuItem.setToggleState(this.isCronBeingUsed());
        
        this.menu.toggle();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}
