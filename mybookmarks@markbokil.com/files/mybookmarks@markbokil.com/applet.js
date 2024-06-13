// Mark Bokil 5/12/12
// mybookmarks Cinnamon Applet

const UUID = 'mybookmarks@markbokil.com';
const Version = "1.0.4";
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio; // file monitor
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const AppletDir = imports.ui.appletManager.appletMeta['mybookmarks@markbokil.com'].path;

// When no configuration exists
// Save all changes to this location, load this if the file exists
const LegacyPropertiesFile = GLib.get_home_dir() + '/.cinnamon/configs/' + UUID;
const DefaultPropertiesFile = GLib.build_filenamev([global.userdatadir, 'applets/mybookmarks@markbokil.com/mybookmarks.properties']);
const ConfigFilePath = GLib.get_home_dir() + '/.config/cinnamon/spices/' + UUID;
const PropertiesFile = ConfigFilePath + '/mybookmarks.properties';

const HelpURL = "http://markbokil.com/downloads/mybookmarks/help.php?appname=mybookmarks&version=" + Version;
const AboutURL = "http://markbokil.com/downloads/mybookmarks/about.php?appname=mybookmarks&version=" + Version;
const AppIcon = 'mybookmarks.svg';

// external JS library options
let AppOptions, DebugMode, OpenFileCmd, OpenFTPCmd, AppIconType, config;
if (typeof require !== 'undefined') {
    config = require('./config');
}

if (Object.entries(config).length !== 0) {
    AppOptions = config.Options;
    DebugMode = config.Options.DebugMode;
    OpenFileCmd = config.Options.OpenFileCmd;
    OpenFTPCmd = config.Options.OpenFTPCmd;
    AppIconType = config.Options.AppIconType;
} else {
    const AppletMeta = imports.ui.appletManager.applets['mybookmarks@markbokil.com'];
    AppOptions = AppletMeta.config.Options;
    DebugMode = AppletMeta.config.Options.DebugMode;
    OpenFileCmd = AppletMeta.config.Options.OpenFileCmd;
    OpenFTPCmd = AppletMeta.config.Options.OpenFTPCmd;
    AppIconType = AppletMeta.config.Options.AppIconType;
}

function PopupMenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            // set app icon svg or symbolic
            this.console(AppletDir + "/" + AppIcon);
            if (AppOptions.AppIconType == "SVG") {
                this.set_applet_icon_path(AppletDir + "/" + AppIcon);
            } else {
                this.set_applet_icon_symbolic_name(AppOptions.AppIconType);
            }

            this.set_applet_tooltip(_("My Bookmarks"));

            // Check to see if the config directory exists
            let configFile = Gio.file_new_for_path(ConfigFilePath);
            if (!configFile.query_exists(null)) {
                // Make the directory
                configFile.make_directory_with_parents(null);
            }
            // watch props file for changes
            let file = Gio.file_new_for_path(PropertiesFile);
            if (!file.query_exists(null)) {
                // Is there a legacy configuration file?
                let legacyFile = Gio.file_new_for_path(LegacyPropertiesFile);
                if (legacyFile.query_exists(null)) {
                    // Use the legacy configuration file to the new location
                    legacyFile.copy(file, Gio.FileCopyFlags.OVERWRITE, null, null);
                } else {
                    // If not, duplicate the default file and monitor it for changes
                    let defaultFile = Gio.file_new_for_path(DefaultPropertiesFile);
                    defaultFile.copy(file, Gio.FileCopyFlags.OVERWRITE, null, null);
                }
            }

            this._monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', Lang.bind(this, this._on_file_changed));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._orientation = orientation;
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);

            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            this.createMenu();
            this.createContextMenu();
         } catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _on_file_changed: function() {
        this.doRefresh();
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    },

    // build dynamic menu items
    createMenu: function () {
        let propLines = this.getProperties();

        for (let i = 0; i < propLines.length; i++) {
            let line = propLines[i];
            if (line.substring(0,1) == '#')
                continue;
            if (line.trim(' ') == '')
                continue;
            if (line.indexOf('---') != -1 || line.indexOf('[MS]') != -1) { // --- is legacy support
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // draw seperator
                continue;
            }

            let prop = line.split(/=(.*)/);
            if (prop.length < 2) continue;

            let propName = prop[0].trim(' ');
            let propVal = prop[1].trim(' ');

            if (propVal.indexOf('ftp://') != -1 || propVal.indexOf('ftps://') != -1) {
                propVal = OpenFTPCmd + " " + propVal;
            } else {
                propVal = OpenFileCmd + " " + propVal;
            }

            if (propVal.indexOf('[EE]') != -1) { // ?
                propVal = "xdg-open http://markbokil.com/downloads/mylauncher/mycat.jpg";
            }

            this.console(propName + ", " + propVal); //debug
            this.menu.addAction(_(propName), function(event) {
                Util.spawnCommandLine(propVal);
            });
        }
    },


    createContextMenu: function () {
        // reload
        //this.refresh_menu_item = new Applet.MenuItem(_('Reload'), Gtk.STOCK_REFRESH,
           // Lang.bind(this, this.doRefresh));
       // this._applet_context_menu.addMenuItem(this.refresh_menu_item);
        //edit
        this.edit_menu_item = new Applet.MenuItem(_("Edit bookmarks menu"), Gtk.STOCK_EDIT,
            Lang.bind(this, this.editProperties));
        this._applet_context_menu.addMenuItem(this.edit_menu_item);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); //separator

        //help
        this.help_menu_item = new Applet.MenuItem(_("Help"), Gtk.STOCK_HELP,
            Lang.bind(this, this.doHelp));
        this._applet_context_menu.addMenuItem(this.help_menu_item);
        //about
        this.about_menu_item = new Applet.MenuItem(_("About"), Gtk.STOCK_ABOUT,
            Lang.bind(this, this.doAbout));
        this._applet_context_menu.addMenuItem(this.about_menu_item);
    },

    getProperties: function () {
        let prop = Cinnamon.get_file_contents_utf8_sync(PropertiesFile);
        let lines = prop.split('\n');

        return lines;
    },

    editProperties: function () {
        Util.spawnCommandLine(OpenFileCmd + " " + PropertiesFile);
    },

    doRefresh: function () {
        this.menu.removeAll();
        this.createMenu();
    },

    doHelp: function () {
        Util.spawnCommandLine(OpenFileCmd + " " + HelpURL);
    },

    doAbout: function () {
        Util.spawnCommandLine(OpenFileCmd + " " + AboutURL);
    },

    // wrapper for global.log()
    console: function(str) {
        if (!DebugMode) return;
        global.log(str);
    }
}

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);

    return myApplet;
}
