const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;

const Gettext = imports.gettext;
const _ = Gettext.gettext;

let ICON_SIZE = 16;


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
		__proto__: Applet.IconApplet.prototype,

		_init: function(orientation) {
			Applet.IconApplet.prototype._init.call(this, orientation);

			try {
				this.set_applet_tooltip(_("System menu"));
				this.set_applet_icon_name("avatar-default");

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

		_detect_user_name: function() {
			return GLib.get_user_name().toString();
		},

		_detect_distr: function() {
			let distr = GLib.spawn_command_line_sync("uname -r");
			if (distr[0])
				//return distr[1].toString().trim();
				return GLib.get_user_name().toString();
			else
				return "";
		},
		_display: function() {

			let _session = new GnomeSession.SessionManager();
			let _screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
			this.defaultPlaces = Main.placesManager.getDefaultPlaces();
			this.bookmarks     = Main.placesManager.getBookmarks();
//Gnome-terminal
		let icon = new St.Icon({icon_name: "gnome-terminal", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this._itemCinSettings = new MyPopupMenuItem(icon, _("Launch gnome-terminal"));

			this.menu.addMenuItem(this._itemCinSettings);
			this._itemCinSettings.connect('activate', function(actor, event) {
				GLib.spawn_command_line_async('gnome-terminal');
			});
//System Settings
		icon = new St.Icon({icon_name: "preferences-system", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this._itemCinSettings = new MyPopupMenuItem(icon, _("System Settings"));

			this.menu.addMenuItem(this._itemCinSettings);
			this._itemCinSettings.connect('activate', function(actor, event) {
				GLib.spawn_command_line_async('gnome-control-center');
			});
//Separator
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
//Restart Cinnamon
		icon = new St.Icon({icon_name: "reload", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this._itemCinRestart = new MyPopupMenuItem(icon, _("Restart Cinnamon"));

			this.menu.addMenuItem(this._itemCinRestart);
			this._itemCinRestart.connect('activate', function(actor, event) {
				global.reexec_self();
			});
//Cinnamon-settings
		icon = new St.Icon({icon_name: "system-run", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this._itemCinSettings = new MyPopupMenuItem(icon, _("Cinnamon Settings"));

			this.menu.addMenuItem(this._itemCinSettings);
			this._itemCinSettings.connect('activate', function(actor, event) {
				GLib.spawn_command_line_async('cinnamon-settings');
			});
//Separator
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
//Lock screen
		icon = new St.Icon({icon_name: "gnome-lockscreen", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.filesystemItem = new MyPopupMenuItem(icon, _("Lock screen"));

			this.menu.addMenuItem(this.filesystemItem);
			this.filesystemItem.connect('activate', function(actor, event) {
                _screenSaverProxy.LockRemote();
			});
// Logout session
		icon = new St.Icon({icon_name: "gnome-logout", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.filesystemItem = new MyPopupMenuItem(icon, _("Logout"));

			this.menu.addMenuItem(this.filesystemItem);
			this.filesystemItem.connect('activate', function(actor, event) {
                _session.LogoutRemote(0);
			});
// Shutdown computer
		icon = new St.Icon({icon_name: "gnome-shutdown", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
			this.filesystemItem = new MyPopupMenuItem(icon, _("Shutdown the computer"));

			this.menu.addMenuItem(this.filesystemItem);
			this.filesystemItem.connect('activate', function(actor, event) {
                _session.ShutdownRemote();
			});

		}
};

function main(metadata, orientation) {
	let myApplet = new MyApplet(orientation);
	return myApplet;
};
