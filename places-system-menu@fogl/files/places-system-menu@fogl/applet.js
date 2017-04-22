const UUID = "places-system-menu@fogl";
const SHOW_SETTINGS = "cinnamon-settings applets " + UUID;
const ICON_SIZE = 16;

const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const Gtk = imports.gi.Gtk;
const Gettext = imports.gettext;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const Settings = imports.ui.settings;
const ModalDialog = imports.ui.modalDialog;

const AppletMeta = imports.ui.appletManager.applets[UUID];
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;

//Add/remove Entries
// ["command", "icon", "Display Name"]
var PreferencesEntries = [
	["cinnamon-settings", "gtk-execute", _("Cinnamon Settings")],
	["cinnamon-settings themes", "gnome-settings-themes", _("Appearance")],
	["cinnamon-settings applets", "gnome-settings-themes", _("Applets")],
	["cinnamon-settings desklets", "gnome-settings-themes", _("Desklets")],
	["cinnamon-settings extensions", "gnome-settings-themes", _("Extensions")],
	["cinnamon-settings display", "display", _("Displays")],
	["cinnamon-settings keyboard", "keyboard", _("Keyboard")],
	["cinnamon-settings region", "gnome-character-map", _("Keyboard Layout")],
	["/usr/bin/gnome-language-selector", "config-language", _("Language Support")],
	["cinnamon-settings mouse", "mouse", _("Mouse")],
	["nm-connection-editor", "network-wireless", _("Network Connections")]
];

// To add/remove Entries
// ["command", "icon", "Display Name"]
var AdministrationEntries = [
	["gnome-system-monitor", "gnome-system-monitor", _("Systemmonitor")],
	["deja-dup-preferences", "deja-dup", _("Backup")],
	["mintbackup", "system-software-install", _("Mint Backup")],
	["mintnanny", "network-workgroup", _("Domain Blocker")],
	["gufw", "gufw", _("Firewall")],
	["gnome-system-log", "gnome-system-log", _("Log File Viewer")],
	//["gnome-nettool", "gnome-nettool", "Network Tools"],
	["/usr/bin/aptoncd", "aptoncd", _("APTonCD")],
	["gnome-control-center printers", "printer", _("Printing")],
	["gksu mintinstall", "emblem-package", _("Software Manager")],
	["usb-creator-gtk", "usb-creator-gtk", _("Startup Disk Creator")],
	["gksudo synaptic", "synaptic", _("Synaptic Manager")],
	["mintupdate", "system-software-update", _("Update Manager")],
	["gksu /usr/sbin/ndisgtk", "network-wireless", _("Wireless Drivers")]
];

function ShutdownDialog(){
    this._init();
}

ShutdownDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
	ModalDialog.ModalDialog.prototype._init.call(this);
	let label = new St.Label({text: _("Are you sure you want to shut down this system?\n")});
	this.contentLayout.add(label);
	let label = new St.Label({text: _("You are currently signed in as: ") + GLib.get_real_name() + " (" + GLib.get_user_name() + ").\n"});
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
	let label = new St.Label({text: _("Cinnamon Desktop Environment\n"), style_class: 'largeBold'});
	this.contentLayout.add(label);
	let label = new St.Label({text: _("Cinnamon is a desktop environment for those who\n\ndislike Gnome 3, and Unity desktop environments.\n"), style_class: 'small'});
	this.contentLayout.add(label);
	let label = new St.Label({text: " \xA9 " + new Date().getFullYear() + " Cinnamon, http://www.cinnamon.linuxmint.com/\n", style_class: 'smallItalics'});
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

function LogOutDialog(){
    this._init();
}

LogOutDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
		ModalDialog.ModalDialog.prototype._init.call(this);
		let label = new St.Label({text: _("Are you sure you want to logout from this session?\n")});
		this.contentLayout.add(label);
		let label = new St.Label({text: _("You are currently signed in as: ") + GLib.get_real_name() + " (" + GLib.get_user_name() + ").\n"});
		this.contentLayout.add(label);

		this.setButtons([
			{
			label: _("Logout"),
			action: Lang.bind(this, function(){
				Util.spawnCommandLine("dbus-send --session --type=method_call --print-reply --dest=org.gnome.SessionManager /org/gnome/SessionManager org.gnome.SessionManager.Logout uint32:1"),
				this.close();;
			})
			},
			{
			label: _("Cancel"),
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

function PsmMenu(launcher, orientation) {
	this._init(launcher, orientation);
}

PsmMenu.prototype = {
	__proto__: PopupMenu.PopupMenu.prototype,

	_init: function(launcher, orientation) {
		this._launcher = launcher;

		PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
		Main.uiGroup.add_actor(this.actor);
		this.actor.hide();
	}
};

function PsmApplet(metadata, orientation, panel_height, instanceId) {
	this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    this._init(metadata, orientation, panel_height, instanceId);
}
					
PsmApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
			Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instanceId);

			try {
				this.settings.bindProperty(Settings.BindingDirection.IN, "show_icon", "show_icon", function () {this["property_changed"]("show_icon")}, null);
				this.settings.bindProperty(Settings.BindingDirection.IN, "show_text", "show_text", function () {this["property_changed"]("show_text")}, null);
				this.settings.bindProperty(Settings.BindingDirection.IN, "panel_text", "panel_text", function () {this["property_changed"]("panel_text")}, null);
				this.settings.bindProperty(Settings.BindingDirection.IN, "menu_type", "menu_type", function () {this["property_changed"]("menu_type")}, null);
				
				if(this["show_icon"] === true) {
					this.set_applet_icon_symbolic_name("user-home");
				}
				if(this["show_text"] === true) {
					if(this["panel_text"].length > 0)
						this.set_applet_label(this["panel_text"]);
					else
						this.set_applet_label("");
				}
				
				let settingsMenuItemAppletSettings = new Applet.MenuItem(_("Settings"), Gtk.STOCK_EDIT, Lang.bind(this, function() {
					Util.spawnCommandLine(SHOW_SETTINGS);
				}));
				this._applet_context_menu.addMenuItem(settingsMenuItemAppletSettings);
			
				this.menuManager = new PopupMenu.PopupMenuManager(this);
				this.menu = new PsmMenu(this, orientation);
				this.menuManager.addMenu(this.menu);
				
				if(this["menu_type"] === "places") {
					this._display_places();
				}
				else {
					this._display_system();
				}
			}
			catch (e) {
				global.logError(e);
			};
		},
		
		property_changed: function(key) {
			if(key === "show_text")  {
				if(this["show_text"] === true) {
					this.set_applet_label(this["panel_text"]);
				}
				else {
					this.set_applet_label("");
					this["show_icon"] = true;
					this.set_applet_icon_symbolic_name("user-home");
				}
			}
			else if(key === "show_icon")  {
				if(this["show_icon"] === true) {
					this.set_applet_icon_symbolic_name("user-home");
				}
				else {
					this.set_applet_icon_symbolic_name("");
				}
			}
			else if(key === "panel_text")  {
				if(this["show_icon"] === true) {
					this.set_applet_label(this["panel_text"]);
				}
				else {
					this.set_applet_label("");
				}
			}
			else if(key === "menu_type")  {
				if(this["menu_type"] === "places") {
					this._display_places();
				}
				else {
					this._display_system();
				}
			}
		},
		
		on_applet_clicked: function(event) {
			this.menu.toggle();
		},

		_display_places: function() {
			this.menu.removeAll();
			let placeid = 0;
			this.placeItems = [];

			this.defaultPlaces = Main.placesManager.getDefaultPlaces();
			this.bookmarks     = Main.placesManager.getBookmarks();

			// Display default places
			for ( placeid; placeid < this.defaultPlaces.length; placeid++) {
				let icon = this.defaultPlaces[placeid].iconFactory(ICON_SIZE);
				this.placeItems[placeid] = new MyPopupMenuItem(icon, _(this.defaultPlaces[placeid].name));
				this.placeItems[placeid].place = this.defaultPlaces[placeid];

				this.menu.addMenuItem(this.placeItems[placeid]);
				this.placeItems[placeid].connect('activate', function(actor, event) {
					actor.place.launch();
				});
			}

			// Display Computer / Filesystem
			let icon = new St.Icon({icon_name: "computer", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyPopupMenuItem(icon, _("Computer"));

			this.menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("xdg-open computer://");
			});

			let icon = new St.Icon({icon_name: "harddrive", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.filesystemItem = new MyPopupMenuItem(icon, _("File System"));

			this.menu.addMenuItem(this.filesystemItem);
			this.filesystemItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine("xdg-open /");
			});

			// Separator
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			let bookmarkid = 0;
			// Display default bookmarks
			for ( bookmarkid; bookmarkid < this.bookmarks.length; bookmarkid++, placeid++) {
				let icon = this.bookmarks[bookmarkid].iconFactory(ICON_SIZE);
				this.placeItems[placeid] = new MyPopupMenuItem(icon, _(this.bookmarks[bookmarkid].name));
				this.placeItems[placeid].place = this.bookmarks[bookmarkid];

				this.menu.addMenuItem(this.placeItems[placeid]);
				this.placeItems[placeid].connect('activate', function(actor, event) {
					actor.place.launch();
				});
			};
		},
		//NEW
		_display_system: function() {
				this.menu.removeAll();
				
				/*==============================PREFERENCES===============================*/
				
				this.preferencesItem = new PopupMenu.PopupSubMenuMenuItem(_("Preferences"));            
				
				let prefId = 0;
				this.computerItem = [];
				
				for (var i in PreferencesEntries) {
					let icon = new St.Icon({icon_name: PreferencesEntries[i][1], icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
						this.computerItem[prefId] = new MyPopupMenuItem(icon, _(PreferencesEntries[i][2]));
						this.computerItem[prefId].launcher = PreferencesEntries[i][0];
						
						this.preferencesItem.menu.addMenuItem(this.computerItem[prefId]);
						this.computerItem[prefId].connect('activate', function(actor, event) {
							Main.Util.spawnCommandLine(actor.launcher);
						});
						
						prefId++;
				};
				
				this.menu.addMenuItem(this.preferencesItem);
				
				/*==============================ADMINISTRATION===============================*/
				
				this.administrationItem = new PopupMenu.PopupSubMenuMenuItem(_("Administration")); 
				
				let adminId = 0;
				this.computerItem = [];
				
				for (var i in AdministrationEntries) {
					let icon = new St.Icon({icon_name: AdministrationEntries[i][1], icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
						this.computerItem[adminId] = new MyPopupMenuItem(icon, _(AdministrationEntries[i][2]));
						this.computerItem[adminId].launcher = AdministrationEntries[i][0];
						
						this.administrationItem.menu.addMenuItem(this.computerItem[adminId]);
						this.computerItem[adminId].connect('activate', function(actor, event) {
							Main.Util.spawnCommandLine(actor.launcher);
						});
						
						adminId++;
				};
				
				this.menu.addMenuItem(this.administrationItem); 
				
				//Separator
				this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
				
				let icon = new St.Icon({icon_name: "computer", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
					this.computerItem = new MyPopupMenuItem(icon, _("Computer"));

					this.menu.addMenuItem(this.computerItem);
					this.computerItem.connect('activate', function(actor, event) {
						Main.Util.spawnCommandLine("xdg-open computer://");
					});
				//Help
				let icon = new St.Icon({icon_name: "help-contents", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
					this.computerItem = new MyPopupMenuItem(icon, _("Help"));

					this.menu.addMenuItem(this.computerItem);
					this.computerItem.connect('activate', function(actor, event) {
						Main.Util.spawnCommandLine("yelp");
					});

				//About Cinnamon
				let icon = new St.Icon({icon_name: "info", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
					this.computerItem = new MyPopupMenuItem(icon, _("About Cinnamon"));

					this.menu.addMenuItem(this.computerItem);
					this.computerItem.connect('activate', function(actor, event) {
						this.about = new AboutDialog();
						this.about.open();
					});

				//Separator
				this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

				//Log out "user"...
				let icon = new St.Icon({icon_name: "system-log-out", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
					this.computerItem = new MyPopupMenuItem(icon, _("Log out " + GLib.get_user_name() + "..."));

					this.menu.addMenuItem(this.computerItem);
					this.computerItem.connect('activate', function(actor, event) {
						this.logout = new LogOutDialog();
						this.logout.open();
					});

				//Shut Down...
				let icon = new St.Icon({icon_name: "system-shutdown", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
					this.computerItem = new MyPopupMenuItem(icon, _("Shut Down..."));

					this.menu.addMenuItem(this.computerItem);
					this.computerItem.connect('activate', function(event) {
						this.shutdown = new ShutdownDialog();
						this.shutdown.open();
					});
			}
		//END NEW
};

function main(metadata, orientation, panel_height, instanceId) {
    let psmApplet = new PsmApplet(metadata, orientation, panel_height, instanceId);
    return psmApplet;
}
