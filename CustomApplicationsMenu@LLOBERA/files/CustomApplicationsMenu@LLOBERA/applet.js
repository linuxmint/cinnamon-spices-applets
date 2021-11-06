// Custom Applications Menu Cinnamon Applet
// Developed by Nicolas LLOBERA - nllobera@gmail.com
// License: GPLv3
// Copyright © 2012 Nicolas LLOBERA

/* Import */
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const appletUUID = 'CustomApplicationsMenu@LLOBERA';
const AppletDirectory = imports.ui.appletManager.appletMeta[appletUUID].path;

const SettingsFile = AppletDirectory + "/applications.json";
const AppSys = Cinnamon.AppSystem.get_default();

// l10n/translation support
Gettext.bindtextdomain(appletUUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(appletUUID, str);
}

// Manage theme icons and image files
function CreateIcon(iconName) {
    // if the iconName is a path to an icon
    if (iconName[0] === '/') {
        var file = Gio.file_new_for_path(iconName);
        var iconFile = new Gio.FileIcon({ file: file });

        return new St.Icon({
            gicon: iconFile,
            icon_size: 24,
            style_class: 'popup-menu-icon'
        });
    }
    else // use a themed icon
        return new St.Icon({
            icon_name: iconName,
            icon_size: 24,
            icon_type: St.IconType.FULLCOLOR,
            style_class: 'popup-menu-icon'
        });
}

/**********  PopupIconSubMenuMenuItem  **********/
// Inherits from PopupSubMenuMenuItem to add a colored image to the left side
function PopupIconSubMenuMenuItem() {
    this._init.apply(this, arguments);
}
PopupIconSubMenuMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(text, iconName) {
        PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, text);

        // remove previous added actor in PopupSubMenuMenuItem _init
        // because the add order is important
        this.removeActor(this.label);
        this.removeActor(this._triangleBin);

        this._icon = CreateIcon(iconName);
        this.addActor(this._icon);

        this.addActor(this.label);
        this.addActor(this._triangleBin);
    }
};

/**********  PopupIconCommandMenuItem  **********/
// Inherits from PopupIconMenuItem to launch a command on click
function PopupIconCommandMenuItem() {
    this._init.apply(this, arguments);
}
PopupIconCommandMenuItem.prototype = {
    __proto__: PopupMenu.PopupIconMenuItem.prototype,

    _init: function(text, iconName, command, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({text: text});
        this._icon = CreateIcon(iconName);
        this.addActor(this._icon);
        this.addActor(this.label);

        // useful to use application in the connect method
        this.command = command;
    }
};

/**********  MyApplet  **********/
function MyApplet(orientation) {
    this._init(orientation);
}
MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            this.set_applet_icon_symbolic_name("help-about-symbolic");
            this.set_applet_tooltip(_("Custom Applications Menu"));

            // watch settings file for changes
            let file = Gio.file_new_for_path(SettingsFile);
            this._monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', Lang.bind(this, this._on_settingsfile_changed));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._readSettings();
            this._createMenuRecursive(this.menu, this.applications);
            this._createContextMenu();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    // if applications.json is modified
    _on_settingsfile_changed: function() {
        this._readSettings();
        this.menu.removeAll();
        this._createMenuRecursive(this.menu, this.applications);
    },

    // create the menu items from the applications array
    _createMenuRecursive: function(parentMenuItem, applications) {
        for (var i=0; i<applications.length; i++) {
            var application = applications[i];

            // if the current application has been unactivated
            if ("active" in application && !application.active)
                continue;

            // get command, displayName and icon from the desktop file
            // only fill empty values
            if (typeof(application.desktopFile) === "string") // if desktopFile is defined and a string
                this._getInfoFromDesktopFile(application);

            // if it's a menu
            if ("menu" in application) {
                if (typeof(application.displayName) === "undefined")
                    application.displayName = "Sub-menu";

                var menuItem;
                if (typeof(application.iconName) === "undefined")
                    menuItem = new PopupMenu.PopupSubMenuMenuItem(application.displayName);
                else
                    menuItem = new PopupIconSubMenuMenuItem(application.displayName, application.iconName);

                this._createMenuRecursive(menuItem.menu, application.menu);

                parentMenuItem.addMenuItem(menuItem);
            }
            else {
                // default icon name
                if (typeof(application.iconName) === "undefined")
                    application.iconName = "image-missing";

                if (typeof(application.command) !== "string") { // if command is not defined or not a string, go to the next application
                    global.logError("Undefined or unvalid command for item " + (i+1) + ".");
                    continue;
                }
                else if (application.command === "S")
                    parentMenuItem.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                else {
                    // default display name
                    if (typeof(application.displayName) === "undefined")
                        application.displayName = application.command.split(" ")[0];

                    this._createMenuItem(parentMenuItem, application);
                }
            }
        }
    },

    // extract the command, the name and the icone name from the desktop file
    _getInfoFromDesktopFile: function(application) {
        let appInfo = null;
        let desktopFile = application.desktopFile + ".desktop";
        let app = AppSys.lookup_app(desktopFile);
        if (app)
            appInfo = app.get_app_info();
        else {
            global.logError("Desktop file " + application.desktopFile + " not found.");
            return;
        }

        if (typeof(application.command) === "undefined")
            application.command = appInfo.get_commandline();

        if (typeof(application.displayName) === "undefined")
            application.displayName = appInfo.get_name();

        if (typeof(application.iconName) === "undefined") {
            let icon = appInfo.get_icon();
            if (icon) {
                if (icon instanceof(Gio.FileIcon))
                    application.iconName = icon.get_file().get_path();
                else
                    application.iconName = icon.get_names()[0];
            }
            else {
                global.logError("appInfo.get_icon() returns null.");
            }
        }
    },

    // parse the applications.json file into the applications variable
    _readSettings: function() {
        let jsonFileContent = Cinnamon.get_file_contents_utf8_sync(SettingsFile);
        this.applications = JSON.parse(jsonFileContent);
    },

    _createMenuItem: function(parentMenuItem, application) {
        var menuItem = new PopupIconCommandMenuItem(application.displayName, application.iconName, application.command);
        menuItem.connect("activate", function(actor, event) {
            // As application variable is not accessible here,
            // the application variable is passed to the PopupImageLeftMenuItem ctor to be accessible throw the actor argument
            // which is the menuItem itself
            let commands = actor.command.split(";");
            for (var i=0; i<commands.length; i++)
            {
                Main.Util.spawnCommandLine(commands[i]);
            }
        });
        parentMenuItem.addMenuItem(menuItem);
    },

    _createContextMenu: function() {
        this.edit_menu_item = new Applet.MenuItem(_("Edit"), "document-edit-symbolic", function() {
            Main.Util.spawnCommandLine("xdg-open " + SettingsFile);
        });
        this._applet_context_menu.addMenuItem(this.edit_menu_item);

        this.help_menu_item = new Applet.MenuItem(_("Help"), "help-faq-symbolic", function() {
            Main.Util.spawnCommandLine("xdg-open " + AppletDirectory + "/README.md");
        });
        this._applet_context_menu.addMenuItem(this.help_menu_item);

        this.about_menu_item = new Applet.MenuItem(_("About"), "dialog-information-symbolic",  function() {
            Main.Util.spawnCommandLine("xdg-open " + AppletDirectory + "/ABOUT.txt");
        });
        this._applet_context_menu.addMenuItem(this.about_menu_item);
    }
};


function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
