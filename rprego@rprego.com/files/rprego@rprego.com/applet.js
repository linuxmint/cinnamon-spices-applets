//Display Switcher applet by rprego@rprego.com
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
            this.set_applet_icon_symbolic_name("video-display-symbolic");
            this.set_applet_tooltip(_("Switch display configuration on-the-fly"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    
                                                    
          
            //Menu - uses Disper for all functions (http://willem.engen.nl/projects/disper/)

		    //Single display ONLY
		    this.menu.addAction(_("Primary Display Only"), function(event) {
                    Main.Util.spawnCommandLine("disper --single");
		    }); 

            //Secondary display ONLY
		    this.menu.addAction(_("Secondary Display Only"), function(event) {
                    Main.Util.spawnCommandLine("disper --secondary");
		    }); 

            //Clone displays
		    this.menu.addAction(_("Clone Displays"), function(event) {
                    Main.Util.spawnCommandLine("disper --clone");
		    }); 

		
            //Extend - Submenu (left, right, top, bottom)		
		    this.extendMenu = new PopupMenu.PopupSubMenuMenuItem(_("Extend Displays")); 
		    //Left
		    this.extendMenu.menu.addAction(_("Left"), function(actor, event) {
		    Main.Util.spawnCommandLine("disper --extend --direction=left");
		    });
            //Right
		    this.extendMenu.menu.addAction(_("Right"), function(actor, event) {
		    Main.Util.spawnCommandLine("disper --extend --direction=right");
		    });
            //Top
		    this.extendMenu.menu.addAction(_("Top"), function(actor, event) {
		    Main.Util.spawnCommandLine("disper --extend --direction=top");
		    });
            //Bottom
		    this.extendMenu.menu.addAction(_("Bottom"), function(actor, event) {
		    Main.Util.spawnCommandLine("disper --extend --direction=bottom");
		    });
		          
		    this.menu.addMenuItem(this.extendMenu);     
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
