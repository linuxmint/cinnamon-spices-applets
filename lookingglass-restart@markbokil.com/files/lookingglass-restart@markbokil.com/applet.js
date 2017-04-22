// Lookingglass-restart Cinnamon applet
// Mark Bokil
// 6/2/12
// Version 1.0.4

const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const AppletMeta = imports.ui.appletManager.applets['lookingglass-restart@markbokil.com'];
const AppletDir = imports.ui.appletManager.appletMeta["lookingglass-restart@markbokil.com"].path;
const Gettext = imports.gettext;
const UUID = "lookingglass-restart@markbokil.com";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function PopupMenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            this.set_applet_icon_symbolic_name("utilities-terminal-symbolic");
            this.set_applet_tooltip(_("Looking Glass"));
          
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._orientation = orientation;
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);       
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    

            this.createContextMenu();
        }
        catch (e) {
            global.logError(e);
        }
     },

    on_applet_clicked: function(event) {   
        Main.createLookingGlass().toggle();
    },
   
    
    createContextMenu: function () {
        this.restart_menu_item = new Applet.MenuItem(_("Restart Cinnamon"), Gtk.STOCK_REFRESH, 
            Lang.bind(this, this.doRestart));     
        this._applet_context_menu.addMenuItem(this.restart_menu_item);
        
        this.reload_menu_item = new Applet.MenuItem(_("Reload Theme"), Gtk.STOCK_REFRESH, 
            Lang.bind(this, this.doReloadTheme));     
        this._applet_context_menu.addMenuItem(this.reload_menu_item); 
        

        
        this.log_menu_item = new Applet.MenuItem(_("View Log"), Gtk.STOCK_EDIT, 
            Lang.bind(this, this.doLog));     
        this._applet_context_menu.addMenuItem(this.log_menu_item);
       
    },
    
    
    
    doRestart: function() {
        Util.spawnCommandLine(global.reexec_self());
    },
    
    doLog: function() {
    let logFile = GLib.get_home_dir() + "/.cinnamon/glass.log";
        Util.spawnCommandLine("xdg-open " + logFile);
    },
    
    doReloadTheme: function() {
        Util.spawnCommandLine(Main.loadTheme());
    }
    
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
