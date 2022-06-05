//Resolution Switcher applet by dennis@nixdev.com
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
            this.set_applet_tooltip(_("Switch resolution on-the-fly, with HiDPI support"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    
            
		    //HiDPI 200%
		    this.menu.addAction(_("HiDPI 200%"), function(event) {
                    Main.Util.spawnCommandLine(`${__meta.path}/rswitcher -r max -s 2`);
		    });
            //HiDPI 175% Fractional scaling
		    this.menu.addAction(_("HiDPI 175%"), function(event) {
                    Main.Util.spawnCommandLine(`${__meta.path}/rswitcher -r max -s 2 -f 175`);
		    });  
            //HiDPI 150% Fractional scaling
		    this.menu.addAction(_("HiDPI 150%"), function(event) {
                    Main.Util.spawnCommandLine(`${__meta.path}/rswitcher -r max -s 2 -f 150`);
		    });
            //HiDPI 125% Fractional scaling
		    this.menu.addAction(_("HiDPI 125%"), function(event) {
                    Main.Util.spawnCommandLine(`${__meta.path}/rswitcher -r max -s 2 -f 125`);
		    });
            //2160p
		    this.menu.addAction(_("2160p"), function(event) {
                    Main.Util.spawnCommandLine(`${__meta.path}/rswitcher -r 3840x2160`);
            }); 
            //1440p
		    this.menu.addAction(_("1440p"), function(event) {
                    Main.Util.spawnCommandLine(`${__meta.path}/rswitcher -r 2560x1440`);
		    }); 
            //1080p
		    this.menu.addAction(_("1080p"), function(event) {
                    Main.Util.spawnCommandLine(`${__meta.path}/rswitcher -r 1920x1080 1`);
		    }); 
            //720p
		    this.menu.addAction(_("720p"), function(event) {
                    Main.Util.spawnCommandLine(`${__meta.path}/rswitcher -r 1280x720 1`);
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
