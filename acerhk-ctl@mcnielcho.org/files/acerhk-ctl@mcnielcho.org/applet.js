/**
 * AcerHK Control Applet
 * 
 * DEPENDS ON:  acerhk.ko
 * 
 * FAIL:  This applet will have "no effect" if the acerhk.ko driver
 * is not loaded.
 * 
 * This applet serves as an interface with the acerhk.ko driver necessary
 * to activate some hardware and utilize special keys on older Acer
 * computers.  This application only provides a means to turn-on and
 * turn-off the wireless and bluetooth hardware IF the acerhk.ko driver
 * module is loaded.
 * 
 * AUTHOR:  Arick McNiel-Cho [arickmcniel <at> yahoo <dot> c o m]
 * 
 * I will post information and links on my sourceforge page.  This page
 * includes downloads for acerhk-gui (a stand-alone app to interface with
 * acerhk.ko, links to latest working source code for acerhk.ko, installation
 * scripts, and associated information.
 * 
 * Reference Page:  http://sourceforge.net/projects/acerhkgui/
**/

const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const UUID = "acerhk-ctl@mcnielcho.org";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height);
        
        try {
            
            //setup the icon for the applet.
            Gtk.IconTheme.get_default().append_search_path(metadata.path);
            this.set_applet_icon_name("acerhk-applet");
			this.set_applet_tooltip(_("Acer Hardware Control"));  
            
            //Setup Menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
            
            //build menu and actions        
            this._fullMenuItems = [new PopupMenu.PopupMenuItem(_("Activate Wireless Hardware")),
                                   new PopupMenu.PopupMenuItem(_("Deactivate Wireless Hardware")),
                                   new PopupMenu.PopupSeparatorMenuItem(),
                                   new PopupMenu.PopupMenuItem(_("Activate Bluetooth Hardware")),
                                   new PopupMenu.PopupMenuItem(_("Deactivate Bluetooth Hardware")),
                                   new PopupMenu.PopupSeparatorMenuItem()];

            this._fullMenuItems[0].connect('activate', function() {
                GLib.spawn_command_line_async("/bin/sh -c 'echo 1 > /proc/driver/acerhk/wirelessled'");
            });
            this._fullMenuItems[1].connect('activate', function() {
                GLib.spawn_command_line_async("/bin/sh -c 'echo 0 > /proc/driver/acerhk/wirelessled'");
            });
            
			this._fullMenuItems[3].connect('activate', function() {
                GLib.spawn_command_line_async("/bin/sh -c 'echo 1 > /proc/driver/acerhk/blueled'");
            });
            this._fullMenuItems[4].connect('activate', function() {
                GLib.spawn_command_line_async("/bin/sh -c 'echo 0 > /proc/driver/acerhk/blueled'");
            });
            
            for (let i = 0; i < this._fullMenuItems.length; i++) {
                let item = this._fullMenuItems[i];
                this.menu.addMenuItem(item);
            }
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },

};

function main(metadata, orientation, panel_height, instanceId) {  
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;      
}				
