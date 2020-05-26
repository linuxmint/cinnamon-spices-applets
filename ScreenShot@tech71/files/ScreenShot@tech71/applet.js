//ScreenShot Applet By Infektedpc
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const UUID = 'ScreenShot@tech71';
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}


function ConfirmDialog(){
    this._init();
}


function MyApplet(orientation, panelHeight, instanceId) {
    this._init(orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panelHeight, instanceId) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
        
        try {        
            this.set_applet_icon_symbolic_name("camera-photo-symbolic");
            this.set_applet_tooltip(_("Take A Screen Shot"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    
                                                    
          
		//Advanced Screenshot - opens gnome-screenshot
		this.menu.addAction(_("ScreenShot"), function(event) {
                Main.Util.spawnCommandLine("gnome-screenshot --interactive");
		}); 

		//Whole Screen - Dropdown Menu		
		this.screenshotItem = new PopupMenu.PopupSubMenuMenuItem(_("Whole Screen")); 
		//1 Sec Delay
		this.screenshotItem.menu.addAction(_("1 Second Delay"), function(actor, event) {
		Main.Util.spawnCommandLine("gnome-screenshot --delay 1");
		});
		//3 Sec Delay
		this.screenshotItem.menu.addAction(_("3 Second Delay"), function(actor, event) {
		Main.Util.spawnCommandLine("gnome-screenshot --delay 3");
		}); 
		//5 Sec Delay
		this.screenshotItem.menu.addAction(_("5 Second Delay"), function(actor, event) {
		Main.Util.spawnCommandLine("gnome-screenshot --delay 5");
		});  
                       
		this.menu.addMenuItem(this.screenshotItem); 



		//Current Window
		this.menu.addAction(_("Current Window"), function(event) {
                Main.Util.spawnCommandLine("gnome-screenshot -w");
		}); 

		//Selected Area
		this.menu.addAction(_("Selected Area"), function(event) {
                Main.Util.spawnCommandLine("gnome-screenshot -a");
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

function main(metadata, orientation, panelHeight, instanceId) {  
    let myApplet = new MyApplet(orientation, panelHeight, instanceId);
    return myApplet;      
}
