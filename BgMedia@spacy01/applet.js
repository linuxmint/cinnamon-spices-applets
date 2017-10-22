const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const UUID = 'BgMedia@spacy01';
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function _(text) {
  let locText = Gettext.dgettext(UUID, text);
  if (locText == text) {
    locText = window._(text);
  }
  return locText;
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
            this.set_applet_icon_symbolic_name("folder-videos-symbolic");
            this.set_applet_tooltip(_("Bulgarian Radio and TV Streams"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                                                                        

		//radio - dropdown menu		
		this.RadioItem = new PopupMenu.PopupSubMenuMenuItem(_("Radio")); 
		
		//bg radio
		this.RadioItem.menu.addAction(_("Bg Radio"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/bg-radio.sh");
		});
		
		//btv radio
		this.RadioItem.menu.addAction(_("bTV Radio"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/btv-radio.sh");
		});
		
		//city radio
		this.RadioItem.menu.addAction(_("City Radio"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/city-radio.sh");
		});
		
		//classicfm radio
		this.RadioItem.menu.addAction(_("Classic FM"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/classicfm-radio.sh");
		});
		
		//darik radio
		this.RadioItem.menu.addAction(_("Darik"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/darik-radio.sh");
		});
		
		//energy radio
		this.RadioItem.menu.addAction(_("Energy"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/energy-radio.sh");
		});
		
		//fmplus radio
		this.RadioItem.menu.addAction(_("FM+"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/fmplus-radio.sh");
		});
		
		//fresh radio
		this.RadioItem.menu.addAction(_("Fresh"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/fresh-radio.sh");
		});
		
		//jazzfm radio
		this.RadioItem.menu.addAction(_("Jazz FM"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/jazzfm-radio.sh");
		});
		
		//k2 radio
		this.RadioItem.menu.addAction(_("K2"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/k2-radio.sh");
		});
		
		//melody radio
		this.RadioItem.menu.addAction(_("Melody"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/melody-radio.sh");
		});
		
		//njoy radio
		this.RadioItem.menu.addAction(_("N-Joy"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/njoy-radio.sh");
		});
		
		//nova radio
		this.RadioItem.menu.addAction(_("Nova Radio"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/nova-radio.sh");
		});
		
		//radio1 radio
		this.RadioItem.menu.addAction(_("Radio 1"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/radio1-radio.sh");
		});
		
		//radio1rock radio
		this.RadioItem.menu.addAction(_("Radio 1 Rock"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/radio1rock-radio.sh");
		});
		
		//thevoice radio
		this.RadioItem.menu.addAction(_("The Voice Radio"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/thevoice-radio.sh");
		});
		
		//zrock radio
		this.RadioItem.menu.addAction(_("Z-Rock"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/zrock-radio.sh");
		});
        
        //end radio drop down menu               
		this.menu.addMenuItem(this.RadioItem); 
		
		
		//tv - dropdown menu		
		this.TvItem = new PopupMenu.PopupSubMenuMenuItem(_("TV")); 
		
		//bnt
		this.TvItem.menu.addAction(_("BNT"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/TvStreams/bnt.sh");
		});
		
		//bnt2
		this.TvItem.menu.addAction(_("BNT 2"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/TvStreams/bnt2.sh");
		});
		
		//bnthd
		this.TvItem.menu.addAction(_("BNT HD"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/TvStreams/bnthd.sh");
		});
		
		//bntsat
		this.TvItem.menu.addAction(_("BNT World"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/TvStreams/bntsat.sh");
		});
		
		//btv
		this.TvItem.menu.addAction(_("bTV"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/TvStreams/btv.sh");
		});
		
		//city
		this.TvItem.menu.addAction(_("City"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/TvStreams/city.sh");
		});
		
		//nova
		this.TvItem.menu.addAction(_("Nova"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/TvStreams/nova.sh");
		});
		
		//onair
		this.TvItem.menu.addAction(_("On Air"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/TvStreams/onair.sh");
		});
		
		//thevoice
		this.TvItem.menu.addAction(_("The Voice"), function(event) {
		Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/TvStreams/thevoice.sh");
		});

        //end tv drop down menu                
		this.menu.addMenuItem(this.TvItem); 



		//kill
		this.menu.addAction(_("Stop"), function(event) {
                Main.Util.spawnCommandLine(GLib.get_home_dir() + "/.local/share/cinnamon/applets/BgMedia@spacy01/RadioStreams/kill.sh");
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
