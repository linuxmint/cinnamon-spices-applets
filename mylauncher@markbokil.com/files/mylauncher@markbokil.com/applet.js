// This extension was developed by :
// * Mark Bokil http://markbokil.com
// * http://markbokil.com/downloads/mylauncher
// version: 1.0.7
// date: 9-1-12
// License: GPLv2+
// Copyright (C) 2012-2013 M D Bokil
// Mylauncher Cinnamon Applet

const UUID = "mylauncher@markbokil.com";
const Version = "1.0.7";
const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk; //needed for context menu
const Gio = imports.gi.Gio; // file monitor
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const AppletMeta = imports.ui.appletManager.applets['mylauncher@markbokil.com'];
const AppletDir = imports.ui.appletManager.appletMeta['mylauncher@markbokil.com'].path;

// When no configuration exists
const LegacyPropertiesFile = GLib.get_home_dir() + '/.cinnamon/configs/' + UUID;
const DefaultPropertiesFile = GLib.build_filenamev([global.userdatadir, 'applets/mylauncher@markbokil.com/mylauncher.properties']);
// Save all changes to this location, load this if the file exists
const ConfigFilePath = GLib.get_home_dir() + '/.config/cinnamon/spices/' + UUID;
const PropertiesFile = ConfigFilePath + '/mylauncher.properties';

const SettingsJSON = GLib.build_filenamev([global.userdatadir, 'applets/mylauncher@markbokil.com/settings.js']);
const HelpURL = "http://markbokil.com/downloads/mylauncher/help.php?appname=mylauncher&version=" + Version;
const AboutURL = "http://markbokil.com/downloads/mylauncher/about.php?appname=mylauncher&version=" + Version;

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
            this._json = this._getSettings();
            
            // safe fallback if json data file missing
            if (!this._json) {
                this._json = {"toolTips":false,"icon":"mylauncher.svg","OpenFileCmd":"xdg-open"};
            }

            if (this._json.icon.indexOf(".") != -1) {
                this.set_applet_icon_path(AppletDir + "/" + this._json.icon);
            } else {
                this.set_applet_icon_symbolic_name(this._json.icon);
            }
            
            this.set_applet_tooltip(_("My Launcher"));

            // Check to see if the config directory exists
            let configFile = Gio.file_new_for_path(ConfigFilePath);
            if (!configFile.query_exists(null)) {
                // Make the directory
                configFile.make_directory_with_parents(null);
            }
            // Does the configuration file exist in the user applet config directory?
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

            // watch props file for changes
            this._monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', Lang.bind(this, this._on_file_changed));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._orientation = orientation;
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);       
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);  
                             
            // get mylauncher.properties data
            this._propLines = this._getProperties();  

            this._createMenu();
            this._createContextMenu();

            this._setUIStates();
        } catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },

    _on_file_changed: function() {
        // get altered mylauncher.properties data
        this._propLines = this._getProperties();  
        this._doRefresh();
    },

    // build dynamic menu items
    _createMenu: function () {

        // flags for executable type
        var lg,rt,rc,sc;

        for (let i = 0; i < this._propLines.length; i++) {
            let line = this._propLines[i];
            if (line.substring(0,1) == '#')
                continue;
            if (line.trim(' ') == '')
                continue;
            if (line.indexOf('---') != -1 || line.indexOf('[MS]') != -1) { // '---' is legacy support
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // draw seperator
                continue;
            }  
                   
            let prop = line.split(/=(.*)/); //split only first = char
            if (prop.length < 2) continue;
            
            let propName = prop[0].trim(' ');
            let propVal =  prop[1].trim(' '); 
            
            lg = false;
            rt = false;
            rc = false;
            sc = false;
                      
            if (propVal.indexOf('[TD]') != -1) { // toggle desktop  
                propVal = "sh " + AppletDir + "/show-desktop.sh";
                sc = true;
            } else if (propVal.indexOf('[LG]') != -1) { //looking glass
                propVal = "Main.createLookingGlass().toggle()";
                lg = true;
            } else if (propVal.indexOf('[RT]') != -1) { //reload theme
                propVal = "Main.loadTheme()";
                rt = true;
            } else if (propVal.indexOf('[RC]') != -1) { //restart Cinnamon
                propVal = "global.reexec_self()";
                rc = true;
            } else if (propVal.indexOf('[CSA]') != -1) { //add/remove applets 
                propVal = "cinnamon-settings applets";
                sc = true;
            } else if (propVal.indexOf('[MC]') != -1) { //add/remove applets 
                propVal = "sh " + AppletDir + "/run-minecraft.sh";
                sc = true;
            } else if (propVal.indexOf('[EE]') != -1) { // ?
                propVal = "xdg-open http://markbokil.com/downloads/mylauncher/mycat.jpg";
            } else {
                 sc = true;
            }

            this.item = new PopupMenu.PopupMenuItem(_(propName));
            if (this._json.toolTips) {
                this.item.actor.tooltip_text = propVal;
            }

            
            if (lg) {
                this.item.connect('activate', Lang.bind(this, function() { Main.createLookingGlass().toggle(); } ));  
            } 
            else if (rc) {
                this.item.connect('activate', Lang.bind(this, function() { global.reexec_self(); } ));
            }
            else if (rt) {
                this.item.connect('activate', Lang.bind(this, function() { Main.loadTheme(); } ));
            } 
            else if (sc) {
                this.item.connect('activate', Lang.bind(this, function() { Util.spawnCommandLine(propVal); } ));
            }
            this.menu.addMenuItem(this.item);
        }
    },
   
    callback: function () {
        //global.log(this.cmd);  
        Util.spawnCommandLine(this.cmd);
    },

    _createContextMenu: function () {    
        //edit 
        this.edit_menu_item = new Applet.MenuItem(_("Edit launcher menu"), Gtk.STOCK_EDIT, 
            Lang.bind(this, this._editProperties));     
        this._applet_context_menu.addMenuItem(this.edit_menu_item);
        
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); //separator
       
        //help
        this.help_menu_item = new Applet.MenuItem(_("Help"), Gtk.STOCK_HELP, 
            Lang.bind(this, this._doHelp));     
        this._applet_context_menu.addMenuItem(this.help_menu_item); 
        //about
        this.about_menu_item = new Applet.MenuItem(_("About"), Gtk.STOCK_ABOUT, 
            Lang.bind(this, this._doAbout));     
        this._applet_context_menu.addMenuItem(this.about_menu_item); 

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); //separator

        //tooltips
        this.toolTipsSwitch = new PopupMenu.PopupSwitchMenuItem(_("Tooltips"));
        this.toolTipsSwitch.connect('toggled', Lang.bind(this, this._doToolTips));
        this._applet_context_menu.addMenuItem(this.toolTipsSwitch);
    },

    _setUIStates: function () {
        this.toolTipsSwitch.setToggleState(this._json.toolTips);

    },

    _doToolTips: function (item) {
        if (item.state) {
            this._json.toolTips = true;
            
        } else {
            this._json.toolTips = false;
           
        }
        this._doRefresh();
        this._setSettings();
    },

    _getSettings: function () {
        try {
            let prop = Cinnamon.get_file_contents_utf8_sync(SettingsJSON);
            let json = JSON.parse(prop);
            return json;
        } catch(e) {
            global.logError(e);
            return false;
        }
    },

    _setSettings: function () {
        try {
            let f = Gio.file_new_for_path(SettingsJSON);
            let raw = f.replace(null, false,
                            Gio.FileCreateFlags.NONE,
                            null);
            let out = Gio.BufferedOutputStream.new_sized (raw, 4096);
            Cinnamon.write_string_to_stream(out, JSON.stringify(this._json));
            out.close(null);
        } catch(e) {
            global.logError(e);
        }

        //Read more: http://blog.fpmurphy.com/2012/02/gnome-shellcinnamon-extension-preferences-persistence.html#ixzz25D0Cx2VQ
    },

    
    _getProperties: function () {
        let prop = Cinnamon.get_file_contents_utf8_sync(PropertiesFile);
        let lines = prop.split('\n');

        return lines;
    },

    _editProperties: function () {
        Util.spawnCommandLine(this._json.OpenFileCmd + " " + PropertiesFile);
    },
        
    _doRefresh: function () {
        this.menu.removeAll();
        this._createMenu();
    },
    
    _doHelp: function () {
        Util.spawnCommandLine(this._json.OpenFileCmd + " " + HelpURL);
    },
    
    _doAbout: function () {
        Util.spawnCommandLine(this._json.OpenFileCmd + " " + AboutURL);
    },
        
};

function main(metadata, orientation) {   
    let myApplet = new MyApplet(orientation);
    
    return myApplet;      
}
