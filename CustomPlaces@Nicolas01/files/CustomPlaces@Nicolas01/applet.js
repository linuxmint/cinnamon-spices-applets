// Custom Places Menu Cinnamon Applet
// Developed by Nicolas LLOBERA - nllobera@gmail.com
// License: GPLv3
// Copyright © 2013 Nicolas LLOBERA

/* Import */
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Gettext = imports.gettext;
const _ = Gettext.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;

const appletUUID = 'CustomPlaces@Nicolas01';
const AppletDirectory = imports.ui.appletManager.appletMeta[appletUUID].path;
const SettingsFile = AppletDirectory + "/places.json";
imports.searchPath.push(AppletDirectory);
const PopupMenuExtension = imports.popupImageLeftMenuItem;


/* startsWith method for String */
if (typeof String.prototype.startsWith != "function") {
    String.prototype.startsWith = function (str){
        return this.slice(0, str.length) == str;
    };
}


function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}
MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instanceId);

        try {
            this.set_applet_icon_name("user-home");
            this.set_applet_tooltip("Custom Places");

            // watch settings file for changes
            let file = Gio.file_new_for_path(SettingsFile);
            this._monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', Lang.bind(this, this._on_settingsfile_changed));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._readPlaces();
            this._createPlaces();
            this._createContextMenu();
        }
        catch (e) {
            global.logError(e);
        };
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    // if places.json is modified
    _on_settingsfile_changed: function() {
        this._readPlaces();
        this.menu.removeAll();
        this._createPlaces();
    },

    destroy: function() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit("destroy");
    },

    // create the menu items from the places array
    _createPlaces: function() {
        for (var i=0; i<this.places.length; i++)
        {
            var place = this.places[i];

            if (typeof(place.path) !== "string") // if path is not defined or not a string, go to the next place
            {
                global.log("The path '" + place.path + "' is not a String.");
                continue;
            }
            else if (place.path === "S")
            {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
            else
            {
                if (place.path.startsWith("smb://"))
                {
                    this._setDefaultDisplayName(place);
                    this._setDefaultIconName(place, "gnome-fs-smb");
                    // use nemo because xdg-open can't mount the samba places
                    place.command = 'nemo "' + place.path + '"';

                    this._createMenuItem(place);
                }
                else if (GLib.file_test(place.path, GLib.FileTest.EXISTS))
                {
                    this._setDefaultDisplayName(place);
                    this._setDefaultIconName(place, "folder");
                    place.command = 'xdg-open "' + place.path + '"';

                    this._createMenuItem(place);
                }
                else
                {
                    global.log("The path '" + place.path + "' is not an valid path.");
                }
            }
        }
    },

    // parse the places.json file into the places variable
    _readPlaces: function() {
        let jsonFileContent = Cinnamon.get_file_contents_utf8_sync(SettingsFile);

        jsonFileContent = jsonFileContent.replace(/\$HOME/g, GLib.get_home_dir());
        jsonFileContent = jsonFileContent.replace(/\$DOWNLOAD/g, GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD));
        jsonFileContent = jsonFileContent.replace(/\$VIDEOS/g, GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS));
        jsonFileContent = jsonFileContent.replace(/\$PICTURES/g, GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES));
        jsonFileContent = jsonFileContent.replace(/\$MUSIC/g, GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_MUSIC));

        this.places = JSON.parse(jsonFileContent);
    },

    // set a displayName value if there is not
    _setDefaultDisplayName: function(place) {
        if (typeof(place.displayName) === "undefined") {
            if (place.path === '/')
                place.displayName = '/';
            else
                place.displayName = place.path.slice(place.path.lastIndexOf("/")+1); // doesn't work with the / folder, displayName is an empty string
        }

        // another code to get the folder name
        /*var displayName = null;
        if (typeof(place.displayName) === 'undefined') {
            var directory_file = Gio.file_new_for_path(place.path);
            displayName = directory_file.query_info('standard::display-name', 0, null).get_displayName();
        }
        else {
            displayName = place.displayName;
        }*/
    },

    // set an iconName value if there is not
    _setDefaultIconName: function(place, iconName) {
        if (typeof(place.iconName) === "undefined") {
            place.iconName = iconName;
        }
    },

    _createMenuItem: function(place) {
        let menuItem = new PopupMenuExtension.PopupImageLeftMenuItem(
            place.displayName,
            place.iconName,
            place.command);
        menuItem.connect("activate", function(actor, event) { Util.spawnCommandLine(actor.command); });

        this.menu.addMenuItem(menuItem);
    },

    _createContextMenu: function () {
        this.edit_menu_item = new Applet.MenuItem(_("Edit"), Gtk.STOCK_EDIT, function() {
            //Util.spawnCommandLine("xdg-open " + GLib.build_filenamev([global.userdatadir, "applets/placescustom@nikus/applet.js"]));
            Util.spawnCommandLine("xdg-open " + SettingsFile);
        });
        this._applet_context_menu.addMenuItem(this.edit_menu_item);

        this.help_menu_item = new Applet.MenuItem(_("Help"), Gtk.STOCK_HELP, function() {
            Util.spawnCommandLine("xdg-open " + AppletDirectory + "/README.txt");
        });
        this._applet_context_menu.addMenuItem(this.help_menu_item);

        this.about_menu_item = new Applet.MenuItem(_("About"), Gtk.STOCK_ABOUT,  function() {
            Util.spawnCommandLine("xdg-open " + AppletDirectory + "/ABOUT.txt");
        });
        this._applet_context_menu.addMenuItem(this.about_menu_item);
    },
};


function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
