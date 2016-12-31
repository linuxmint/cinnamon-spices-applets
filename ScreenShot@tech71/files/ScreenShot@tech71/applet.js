//ScreenShot Applet By Infektedpc
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

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

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
