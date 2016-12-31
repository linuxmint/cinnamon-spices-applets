//System Shutdown and Restart Applet by Shelley, updated and translated to German by DeathMD
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const ModalDialog = imports.ui.modalDialog;

function ConfirmDialog(){
    this._init();
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {        
            this.set_applet_icon_symbolic_name("system-shutdown");
            this.set_applet_tooltip(_("Beenden"));           
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                                                                    
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);      
                                                                                       
  	    this.menu.addAction(_("Bildschirm sperren"), function(event) {
                Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.ScreenSaver /org/gnome/ScreenSaver org.gnome.ScreenSaver.Lock");
		Util.spawnCommandLine("gnome-screensaver-command -l");
            });
                                                          

            this.menu.addAction(_("Bereitschaft"), function(event) {
                Util.spawnCommandLine("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend");
            });
	    
                          
             this.menu.addAction(_("Neu starten"), function(event) {
                Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Restart");
            });  
            
        this.menu.addAction(_("Abmelden"), function(event) {
                Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.Logout uint32:1");
            });
            
	     this.menu.addAction(_("Rechner ausschalten"), function(event) {
                Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Stop");
            });                        
        }
        catch (e) {
            global.logError(e);
        }
    },
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    }, 
};
function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
