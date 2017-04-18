
const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const ModalDialog = imports.ui.modalDialog;

const AppletMeta = imports.ui.appletManager.applets["QuitApplet@bownz"];
const AppletDir = imports.ui.appletManager.appletMeta["QuitApplet@bownz"].path;

const DEFAULT_CONFIG = {
    "SHOW_POPUPS": true, 
    "ICON_SIZE": 22
};

const CONFIG_FILE    = AppletDir + '/config.json';

const UUID = 'QuitApplet@bownz';

const Gettext = imports.gettext;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyPopupMenuItem()
{
	this._init.apply(this, arguments);
}

MyPopupMenuItem.prototype =
{
		__proto__: PopupMenu.PopupBaseMenuItem.prototype,
		_init: function(icon, text, params)
		{
			PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
			this.icon = icon;
			this.addActor(this.icon);
			this.label = new St.Label({ text: text });
			this.addActor(this.label);
		}
};

function MyContextMenuItem()
{
	this._init.apply(this, arguments);
}

MyContextMenuItem.prototype =
{
		__proto__: PopupMenu.PopupBaseMenuItem.prototype,
		_init: function(icon, text, loc, params)
		{
			PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
			this.icon = icon;

			
                        this.labeltext = text;
			this.label = new St.Label({ text: text });
			this.addActor(this.icon);
			this.addActor(this.label);
		}
};

function ShutdownDialog(){
    this._init();
}

ShutdownDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
	ModalDialog.ModalDialog.prototype._init.call(this);
	let label = new St.Label({text: _("Are you sure you want to shut down this system?\n")});
	this.contentLayout.add(label);
	let label = new St.Label({text: _("You are currently signed in as: ") + GLib.get_user_name() + ".\n"});
	this.contentLayout.add(label);

	this.setButtons([
	    {
		label: _("Suspend"),
		action: Lang.bind(this, function(){
                    Util.spawnCommandLine("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend"),
			this.close();;
		})
	    },
	    {
		label: _("Hibernate"),
		action: Lang.bind(this, function(){
                    Util.spawnCommandLine("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Hibernate"),
			this.close();;
		})
	    },
	    {
		label: _("Restart"),
		action: Lang.bind(this, function(){
                    Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Restart"),
			this.close();;
		})
	    },
	   {
		label: _("Cancel"),
		action: Lang.bind(this, function(){
		    this.close();
		})
	    },
	 {
		label: _("Shut Down"),
		action: Lang.bind(this, function(){
                    Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Stop");
		})
	    }
	]);
    },	
};


function LogoutDialog(){
    this._init();
}

LogoutDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
	ModalDialog.ModalDialog.prototype._init.call(this);
	let label = new St.Label({text: _("Log out of this system now?\n")});
	this.contentLayout.add(label);
	let label = new St.Label({text: _("You are currently signed in as: ") + GLib.get_real_name() + ".\n"});
	this.contentLayout.add(label);

	this.setButtons([
	   {
		label: _("Cancel"),
		action: Lang.bind(this, function(){
		    this.close();
		})
	    },
	 {
		label: _("Log Out"),
		action: Lang.bind(this, function(){
                    Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.Logout uint32:1");
		})
	    }
	]);
    },	
};

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {        
            this.set_applet_icon_symbolic_name("system-shutdown");
            this.set_applet_tooltip(_("Quit"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);  

	     let configFile = GLib.build_filenamev([CONFIG_FILE]);
           let  config = JSON.parse(Cinnamon.get_file_contents_utf8_sync(configFile));
                          
                                                    
          if(config.SHOW_POPUPS){
  	    let icon = new St.Icon({icon_name: "system-lock-screen", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Lock Screen"));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.ScreenSaver /org/gnome/ScreenSaver org.gnome.ScreenSaver.Lock");
			});    

	              
         
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                                              

		  let icon2 = new St.Icon({icon_name: "system-log-out", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon2, _("Log Out..."));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                 this.logout = new LogoutDialog();
                this.logout.open();
			});    


		let icon3 = new St.Icon({icon_name: "system-shutdown", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon3, _("Quit..."));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                 this.shutdown = new ShutdownDialog();
                this.shutdown.open();
			}); 
}else{


let icon6 = new St.Icon({icon_name: "system-lock-screen", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon6, _("Lock Screen"));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.ScreenSaver /org/gnome/ScreenSaver org.gnome.ScreenSaver.Lock");
			});            
         
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


	let icon3 = new St.Icon({icon_name: "media-playback-pause", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon3, _("Suspend"));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Suspend");
			});  


let icon4 = new St.Icon({icon_name: "stock_close", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon4, _("Hibernate"));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("dbus-send --print-reply --system --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower.Hibernate");
			});  

let icon5 = new St.Icon({icon_name: "view-refresh", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon5, _("Restart"));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Restart");
			});  

let icon7 = new St.Icon({icon_name: "system-log-out", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon7, _("Log Out"));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.Logout uint32:1");
			});  

	let icon8 = new St.Icon({icon_name: "system-shutdown", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon8, _("Shutdown"));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("dbus-send --system --print-reply --system --dest=org.freedesktop.ConsoleKit /org/freedesktop/ConsoleKit/Manager org.freedesktop.ConsoleKit.Manager.Stop");
			});  
 }

	//context Menu

let icon = new St.Icon({icon_name: "system-run", icon_size: config.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Quit Applet Settings"));
			
			this._applet_context_menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine(AppletDir + "/settings.py");
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
