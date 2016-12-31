const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const PanelMenu = imports.ui.panelMenu;
const ModalDialog = imports.ui.modalDialog;
const Util = imports.misc.util;

const Gettext = imports.gettext;
const _ = Gettext.gettext;
const AppletMeta = imports.ui.appletManager.applets["GnomeSystem@bownz"];
const AppletDir = imports.ui.appletManager.appletMeta["GnomeSystem@bownz"].path;

const MENU_SCHEMAS = "org.cinnamon.applets.GnomeMenu";
let menuSettings = new Gio.Settings({schema: MENU_SCHEMAS});

let MAIN_ICON_SIZE = menuSettings.get_int("icon-size");
let ICON_SIZE = menuSettings.get_int("sub-icon-size");

function ShutdownDialog(){
    this._init();
}

ShutdownDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
	ModalDialog.ModalDialog.prototype._init.call(this);
	let label = new St.Label({text: "Are you sure you want to shut down this system?\n"});
	this.contentLayout.add(label);
	let label = new St.Label({text: "You are currently signed in as: " + GLib.get_user_name() + ".\n"});
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
function AboutDialog(){
    this._init();
}

AboutDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
	ModalDialog.ModalDialog.prototype._init.call(this);
	let label = new St.Label({text: "Cinnamon Desktop Environment\n", style_class: 'largeBold'});
	this.contentLayout.add(label);
	let label = new St.Label({text: "Cinnamon is a desktop environment\n\nfor those who dislike Gnome 3, and\n\nUnity desktop environments.\n", style_class: 'small'});
	this.contentLayout.add(label);
	let label = new St.Label({text: " \xA9 2012 Cinnamon, http://www.cinnamon.linuxmint.com/\n", style_class: 'smallItalics'});
	this.contentLayout.add(label);

	this.setButtons([
	   {
		label: _("Close"),
		action: Lang.bind(this, function(){
		    this.close();
		})
	    },
	
	]);
    },	
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
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item' });
        this.icon = icon;
        this.box.add(this.icon);
        this.label = new St.Label({ text: text });
        this.box.add(this.label);
        this.addActor(this.box);
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
		},

                _onButtonReleaseEvent: function (actor, event)
                {
                        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
                            this.activate(event);
                        } else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK) {
                            if (this.loc) {
                                if (this.loc == "special:home") {
                                    this.loc = Gio.file_new_for_path(GLib.get_home_dir()).get_uri().replace('file://','');
                                } else if (this.loc == "special:desktop") {
                                    this.loc = Gio.file_new_for_path(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP)).get_uri().replace('file://','');
                                } else if (this.loc == "root") {
                                    this.loc = "/";
                                } else if (this.loc == "special:connect") {
                                    return true;
                                }
                                Main.Util.spawnCommandLine("gnome-terminal --working-directory="+this.loc);
                            }
                        }
                        return true;
                }
};

function MyMenu(launcher, orientation) {
	this._init(launcher, orientation);
}

MyMenu.prototype = {
		__proto__: PopupMenu.PopupMenu.prototype,

		_init: function(launcher, orientation) {
			this._launcher = launcher;        

			PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
			Main.uiGroup.add_actor(this.actor);
			this.actor.hide();            
		}
};

function MyApplet(orientation) {
	this._init(orientation);
}

MyApplet.prototype = {
		__proto__: Applet.TextApplet.prototype,

		_init: function(orientation) {
			Applet.TextApplet.prototype._init.call(this, orientation);

			try {        
				this.set_applet_label("System");

				this.menuManager = new PopupMenu.PopupMenuManager(this);
				this.menu = new MyMenu(this, orientation);
				this.menuManager.addMenu(this.menu);

				this._display();
			}
			catch (e) {
				global.logError(e);
			};
		},

		on_applet_clicked: function(event) {
			this.menu.toggle();        
		},

		_display: function() {
	/*==============================PREFERENCES===============================*/
 
	this.preferencesItem = new PopupMenu.PopupSubMenuMenuItem(_("Preferences"));            

		//Additional Drivers

			let icon = new St.Icon({icon_name: "applications-other", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Additional Drivers"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("/usr/bin/jockey-gtk");
			}); 

		//Appearance           

let icon = new St.Icon({icon_name: "gnome-settings-themes", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Appearance"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-control-center background");
			}); 

            
		//Assistive Technologies

let icon = new St.Icon({icon_name: "access", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Universal Access"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-control-center universal-access");
			}); 

		// Cinnamon Settings

let icon = new St.Icon({icon_name: "gtk-execute", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Cinnamon Settings"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("cinnamon-settings");
			});
 
                // Disk Utility

let icon = new St.Icon({icon_name: "harddrive", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Disk Utility"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("palimpsest");
			});

		//Displays

let icon = new St.Icon({icon_name: "display", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Displays"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-control-center display");
			});

                //IM Switcher
	    
let icon = new St.Icon({icon_name: "key_bindings", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Input Method Switcher"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("im-switch");
			});

		//Keyboard
            
     let icon = new St.Icon({icon_name: "keyboard", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Keyboard"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-control-center keyboard");
			});
               
		//Kb layout

	  let icon = new St.Icon({icon_name: "gnome-character-map", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Keyboard Layout"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-control-center region");
			});

		//Lang Support

	  let icon = new St.Icon({icon_name: "config-language", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Language Support"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("/usr/bin/gnome-language-selector");
			});

		//Mouse

	  let icon = new St.Icon({icon_name: "mouse", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Mouse"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-control-center mouse");
			});
            
		//NM Connect

	  let icon = new St.Icon({icon_name: "network-wireless", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Network Connections"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("nm-connection-editor");
			});

		//Pw and K

  let icon = new St.Icon({icon_name: "preferences-desktop-font", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Passwords and Keys"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("seahorse");
			});

		//SS
	
	let icon = new St.Icon({icon_name: "system-software-update", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Software Sources"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("software-properties-gtk");
			});

		//Volume

	let icon = new St.Icon({icon_name: "volume-knob", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Volume Control"));
			
			this.preferencesItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-control-center volume");
			});
	    
	     //add Preferences
            this.menu.addMenuItem(this.preferencesItem);  

	/*==============================ADMINISTRATION===============================*/

	    this.administrationItem = new PopupMenu.PopupSubMenuMenuItem(_("Administration")); 

	let icon = new St.Icon({icon_name: "aptoncd", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("APTonCD"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("/usr/bin/aptoncd");
			});

		//backup

	let icon = new St.Icon({icon_name: "deja-dup", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Backup"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-control-center deja-dup");
			});
            
		//Backup tool

let icon = new St.Icon({icon_name: "system-software-install", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Backup Tool"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("mintbackup");
			});

            
		//Blocker

let icon = new St.Icon({icon_name: "network-workgroup", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Domain Blocker"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("mintnanny");
			});

		//firewall

let icon = new St.Icon({icon_name: "gufw", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Firewall"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gufw");
			});

		//logfile

let icon = new St.Icon({icon_name: "gnome-system-log", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Log File Viewer"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-system-log");
			});
            
		//network tools

let icon = new St.Icon({icon_name: "gnome-nettool", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Network Tools"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-nettool");
			});
            
		//printing

let icon = new St.Icon({icon_name: "printer", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Printing"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gnome-control-center printers");
			});

		//SM

let icon = new St.Icon({icon_name: "emblem-package", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Software Manager"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("mintinstall");
			});

		
		//SDC

let icon = new St.Icon({icon_name: "usb-creator-gtk", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Startup Disk Creator"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("usb-creator-gtk");
			});

            
		//SPM

let icon = new St.Icon({icon_name: "synaptic", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Synaptic Manager"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gksudo synaptic");
			});
            
		//SP/B

let icon = new St.Icon({icon_name: "hardinfo", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("System Profiler"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("hardinfo");
			});


		//Update

let icon = new St.Icon({icon_name: "system-software-update", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Update Manager"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("mintupdatex");
			});


		//upload

let icon = new St.Icon({icon_name: "go-up", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Upload Manager"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("mintupload-manager");
			});
            
		//WWD


let icon = new St.Icon({icon_name: "network-wireless", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Wireless Drivers"));
			
			this.administrationItem.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("gksu /usr/sbin/ndisgtk");
			});

            
            this.menu.addMenuItem(this.administrationItem); 

			
// Separator
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			// Help
			
    let icon = new St.Icon({icon_name: "help-contents", icon_size: MAIN_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.filesystemItem = new MyPopupMenuItem(icon, _("Help"));
			
			this.menu.addMenuItem(this.filesystemItem);
			this.filesystemItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("yelp");
			});

			// About Cinnamon

		let icon = new St.Icon({icon_name: "info", icon_size: MAIN_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.filesystemItem = new MyPopupMenuItem(icon, _("About Cinnamon"));
			
			this.menu.addMenuItem(this.filesystemItem);
			this.filesystemItem.connect('activate', function(actor, event) {
                this.about = new AboutDialog();
                this.about.open();
			});

			// Separator

			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			//Log out "user"...

	let icon = new St.Icon({icon_name: "system-log-out", icon_size: MAIN_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Log out " + GLib.get_user_name() + "..."));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.Logout uint32:1");
			});

			//Shut Down...

	let icon = new St.Icon({icon_name: "system-shutdown", icon_size: MAIN_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Shut Down..."));
			
			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(event) {
                this.shutdown = new ShutdownDialog();
                this.shutdown.open();
			});

			//context Menu
let icon = new St.Icon({icon_name: "gnome-settings", icon_size: MAIN_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyContextMenuItem(icon, _("Gnome Menu Settings"));
			
			this._applet_context_menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine(AppletDir + "/GnomeMenuSettings.py");
			});
}


  
	
};

function main(metadata, orientation) {  
	let myApplet = new MyApplet(orientation);
	return myApplet;      
};
