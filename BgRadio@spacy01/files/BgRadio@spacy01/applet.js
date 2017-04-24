const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;
const St = imports.gi.St;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext.domain('bgradio');
const _ = Gettext.gettext;

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
            this.set_applet_icon_symbolic_name("audio-x-generic-symbolic");
            this.set_applet_tooltip(_("Bulgarian radio streams"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    
                                                    
          
		//Bg Radio
		this.menu.addAction(_("Bg Radio"), function(event) {
                Main.Util.spawnCommandLine('mocp -c -a -p http://149.13.0.81:80/bgradio.ogg');
                 Main.notify(_("Listening Bg Radio"));
		}); 
		
		//bTV Radio
		this.menu.addAction(_("bTV Radio"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://live.btvradio.bg/btv-radio.mp3");
                 Main.notify(_("Listening bTV Radio"));
		}); 
		
		//City Radio
		this.menu.addAction(_("City Radio"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://149.13.0.81:8000/city.ogg");
                 Main.notify(_("Listening Radio City"));
		}); 
		
		//Classic FM
		this.menu.addAction(_("Classic FM"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://live.btvradio.bg/classic-fm.mp3");
                 Main.notify(_("Listening Radio Classic FM"));
		}); 
		
		//Darik
		this.menu.addAction(_("Darik"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://darikradio.by.host.bg:8000/S2-128");
                 Main.notify(_("Listening Darik Radio"));
		}); 
		
		//Energy
		this.menu.addAction(_("Energy"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://149.13.0.80/nrj_low.ogg");
                 Main.notify(_("Listening Radio Energy"));
		}); 
		
		//FM+
		this.menu.addAction(_("FM+"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://193.108.24.21:8000/fmplus");
                 Main.notify(_("Listening Radio FM+"));
		}); 
		
		//Fresh
		this.menu.addAction(_("Fresh"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://193.108.24.21:8000/fresh");
                 Main.notify(_("Listening Radio Fresh"));
		}); 
		
		//Jazz FM
		this.menu.addAction(_("Jazz FM"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://live.btvradio.bg/jazz-fm.mp3");
                 Main.notify(_("Listening Radio Jazz FM"));
		}); 
		
		//Melody
		this.menu.addAction(_("Melody"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://live.btvradio.bg/melody.mp3");
                 Main.notify(_("Listening Radio Melody"));
		}); 
		
		//N-Joy
		this.menu.addAction(_("N-Joy"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://live.btvradio.bg/njoy.mp3");
                 Main.notify(_("Listening Radio N-Joy"));
		}); 
		
		//Nova
		this.menu.addAction(_("Nova"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://149.13.0.80/nova128");
                 Main.notify(_("Listening Radio Nova"));
		}); 
		
		//Radio 1
		this.menu.addAction(_("Radio One"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://149.13.0.81/radio1.ogg");
                 Main.notify(_("Listening Radio One"));
		}); 
		
		//Radio 1 Rock
		this.menu.addAction(_("Radio One Rock"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://149.13.0.81/radio1rock.ogg");
                 Main.notify(_("Listening Radio One Rock"));
		}); 
		
		//Z-Rock
		this.menu.addAction(_("Z-Rock"), function(event) {
                Main.Util.spawnCommandLine("mocp -c -a -p http://live.btvradio.bg/z-rock.mp3");
                Main.notify(_("Listening Radio Z-Rock"));
		}); 
		
		//Separator
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		
		//Kill Radio
		this.menu.addAction(_("Stop Radio"), function(event) {
                Main.Util.spawnCommandLine("mocp -s");
                 Main.notify(_("Bye-bye"));
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
