//System Shutdown and Restart Applet by Shelley, updated and translated to German by DeathMD, updated to SystemD by josh.bowyer
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const ModalDialog = imports.ui.modalDialog;
const Gettext = imports.gettext;

const UUID = "ShutdownApplet@DeathMD";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

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
            this.set_applet_tooltip(_("Shutdown"));           
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                                                                    
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);      
                                                                                       
  	    this.menu.addAction(_("Screen Lock"), function(event) {
                Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.cinnamon.desktop.screensaver /org/cinnamon/desktop/screensaver org.cinnamon.desktop.Lock");
		Util.spawnCommandLine("cinnamon-screensaver-command -l");
            });
                                                          

            this.menu.addAction(_("Suspend"), function(event) {
//                Util.spawnCommandLine("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend");
                Util.spawnCommandLine("dbus-send --system --print-reply --dest=org.freedesktop.login1 /org/freedesktop/login1 'org.freedesktop.login1.Manager.Suspend' boolean:true");
            });
	    
                          
             this.menu.addAction(_("Restart"), function(event) {
//                Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Restart");
                Util.spawnCommandLine("dbus-send --system --print-reply --dest=org.freedesktop.login1 /org/freedesktop/login1 'org.freedesktop.login1.Manager.Reboot' boolean:true");
            });  
            
        this.menu.addAction(_("Log Out"), function(event) {
//                Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.Logout uint32:1");
                Util.spawnCommandLine("dbus-send --system --print-reply --dest=org.freedesktop.login1 /org/freedesktop/login1 'org.freedesktop.login1.Manager.TerminateSession' boolean:true");
            });
            
	     this.menu.addAction(_("Shutdown"), function(event) {
//                Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Stop");
                Util.spawnCommandLine("dbus-send --system --print-reply --dest=org.freedesktop.login1 /org/freedesktop/login1 'org.freedesktop.login1.Manager.PowerOff' boolean:true");
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
