const AccountsService = imports.gi.AccountsService;
const Applet = imports.ui.applet;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Signals = imports.signals;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const ModalDialog = imports.ui.modalDialog;
const UUID = "UserMenuV2@bownz";
const Gettext = imports.gettext;
const ICON_SIZE = 48;	//<-----Size Of the FACE Icon.
const MyFaceIcon = "avatar-default"	//<-----FACE Icon Name. What I do is go to my home Directory, press CTRL+H and copy the file ".face" and move it to the folder "~/.icons/" and rename the file to "face.png" and put "face" in the quotations here.

const AppletMeta = imports.ui.appletManager.applets["UserMenuV2@bownz"];
const AppletDir = imports.ui.appletManager.appletMeta["UserMenuV2@bownz"].path;

let appsys = Cinnamon.AppSystem.get_default();
let session = new GnomeSession.SessionManager();
let screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

//===================================Shutdown==========================================================
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
}

//===================================Naming the Labels/Icon============================================
function NameItem(label, icon, func, menu){
    this._init(label, icon, func, menu);
}

NameItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(icon, func, menu){
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

	this.menu = menu;
        this.func = func;
        this.actor.style_class = 'menu-category-button';
		
	this.icon = new St.Icon({style_class: 'popup-menu-icon', icon_type: St.IconType.FULLCOLOR, icon_name: icon, icon_size: ICON_SIZE,  });
	this.addActor(this.icon);

    },

    setActive: function(active){
        if (active)
            this.actor.style_class = 'menu-category-button-selected';
        else
	    this.actor.style_class = 'menu-category-button';
    },

    activate: function(event){
        if (event.get_button() == 1){
            eval(this.func);
	    this.menu.close();
        }
    }
}
//====================EVERYTHING THAT'S ACTUALLY VISABLE====================
function EverythingBox(menu){
    this._init(menu);
}

EverythingBox.prototype = {
    _init: function(menu){
        this.actor = new St.BoxLayout({vertical: true});
        this.buttons = new St.BoxLayout({vertical: false});
	this.actor2 =new St.BoxLayout({vertical: true});
	this.menu = menu;
        this.addButtons();
	
    },
//===================ButtonIcon/Label=====================================
    addButtons: function(){
	this.label = new St.Label({text: GLib.get_real_name(), style_class: 'smallBold'});
	this.label2 = new St.Label({text: "(" + GLib.get_user_name() + ")", style_class: 'normal'})
	this.seperator = new St.Label()

	

        this.packageItem = new NameItem(MyFaceIcon, "Util.spawnCommandLine('gnome-control-center user-accounts')", this.menu) 
	
	
        this.actor.add(this.buttons);
        this.buttons.add(this.packageItem.actor);
	this.buttons.add(this.actor2)	
this.actor2.add(this.seperator);	
this.actor2.add(this.label);
this.actor2.add(this.label2);
	


	
	
//================Actions================================
	
this.menu.addAction(_("Online Accounts"), function(event) {
                Util.spawnCommandLine("gnome-control-center online-accounts");
            });			

this.menu.addAction(_("System Settings"), function(event) {
                Util.spawnCommandLine("gnome-control-center");
            });

this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

this.menu.addAction(_("Lock Screen"), function(event) {
                Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.ScreenSaver /org/gnome/ScreenSaver org.gnome.ScreenSaver.Lock");
            });


this.menu.addAction(_("Log Out..."), function(event) {
                Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.Logout uint32:1");
            });

this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

this.menu.addAction(_("Shut Down..."), function(event) {
               this.shutdown = new ShutdownDialog();
               this.shutdown.open();
            });


    }

}
	
	




//=====================MyApplet==================================

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation) {        
        Applet.TextApplet.prototype._init.call(this, orientation);
        
        try {
            this.right_app = true;

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

        
                        
            this.menu.actor.add_style_class_name('menu-background');
            
            this.set_applet_label(_(GLib.get_real_name()));
                this.set_applet_tooltip(GLib.get_user_name());
         

            this._display();

            global.display.connect('overlay-key', Lang.bind(this, function(){
                try{
                    this.menu.toggle();
                }
                catch(e) {
                    global.logError(e);
                }
            }));           
        }
        catch (e) {
            global.logError(e);
        }
    },
    
   
    
    on_applet_clicked: function(event) {
        this.menu.toggle();     
    },

//========================Display=================================================

    _display : function() {
        this._activeContainer = null;

        section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);
        
	let onlyPane = new St.BoxLayout({ vertical: true });
       this.onlyBox = new St.BoxLayout({ vertical: true});
        
	this.EverythingBox = new EverythingBox(this.menu);
        this.onlyBox.add_actor(this.EverythingBox.actor);

        onlyPane.add_actor(this.onlyBox);

        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-box'});
        this.mainBox.add_actor(onlyPane, { span: 1 });

        section.actor.add_actor(this.mainBox);
        this._changeRight();
	
    },
};


function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
