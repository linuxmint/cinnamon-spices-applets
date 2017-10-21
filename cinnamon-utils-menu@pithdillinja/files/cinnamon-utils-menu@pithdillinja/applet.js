//Inpired by original uuid: restart-cinnamon@kolle,
//	from URL http://cinnamon-spices.linuxmint.com/applets/view/14
//
//Kudos to Clement Lefebvre & the Mint team for all of their incredible work.
//
//Send questions to pithdillinja@gmail.com
//	last updated 3-14-2012
//v0.1: 	Initial release									(3.14.12)
//v0.2:		Added quick & dirty fix for 'gnome-screenshot -a'/'xkill' popup menu problems	(3.14.12)
//v0.2.1:	Added "Reload Theme" functionality, updated icon to system-run as per user
//			billynick's suggestion, as well as generality				(3.14.12)

const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;

let ICON_SIZE = 16;
//---------------------------------------------------------------------
function MyPopupMenuItem()
{
	this._init.apply(this, arguments);
}
//---------------------------------------------------------------------
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
//---------------------------------------------------------------------
function MyMenu(launcher, orientation) {
	this._init(launcher, orientation);
}
//---------------------------------------------------------------------
MyMenu.prototype = {
		__proto__: PopupMenu.PopupMenu.prototype,

		_init: function(launcher, orientation) {
			this._launcher = launcher;

			PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
			Main.uiGroup.add_actor(this.actor);
			this.actor.hide();
		}
};
//---------------------------------------------------------------------
function MyApplet(orientation) {
	this._init(orientation);
}
//---------------------------------------------------------------------
MyApplet.prototype = {
	__proto__: Applet.IconApplet.prototype,

	_init: function(orientation) {
		Applet.IconApplet.prototype._init.call(this, orientation);

		try {
			this.set_applet_icon_name("system-run");
			this.set_applet_tooltip(_("Click here to briefly & quickly manage your desktop"));

			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new MyMenu(this, orientation);
			this.menuManager.addMenu(this.menu);

			//to allow gnome-screenshot to work (bug):
			Main.createLookingGlass().open();
			Main.createLookingGlass().close();

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
		//Gnome-screenshot
		//FIXME: There is a persistent bug with executing 'gnome-screenshot' -a and 'xkill'.
		//		In order to get either command to work, looking glass is quickly toggled in the _init function.
		let icon = new St.Icon({icon_name: "insert-image", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
		this._itemScreenie = new MyPopupMenuItem(icon, _("Screenshot of a specific area"));

		this.menu.addMenuItem(this._itemScreenie);
		this._itemScreenie.connect('activate', function(actor, event) {
//			Main.Util.spawnCommandLine('gnome-screenshot -a');
			GLib.spawn_command_line_async('gnome-screenshot -a');
		});
		//Separator
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		//Gnome-terminal
		icon = new St.Icon({icon_name: "gnome-terminal", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
		this._itemTerminal = new MyPopupMenuItem(icon, _("Launch gnome-terminal"));

		this.menu.addMenuItem(this._itemTerminal);
		this._itemTerminal.connect('activate', function(actor, event) {
			GLib.spawn_command_line_async('gnome-terminal');
		});
		//Looking Glass
		icon = new St.Icon({icon_name: "search", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
		this._itemLookingGlass = new MyPopupMenuItem(icon, _("Looking Glass"));

		this.menu.addMenuItem(this._itemLookingGlass);
		this._itemLookingGlass.connect('activate', function(actor, event) {
			Mainloop.idle_add(function() { Main.createLookingGlass().toggle(); });
		});
		//Cinnamon-settings
		icon = new St.Icon({icon_name: "system-run", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
		this._itemCinSettings = new MyPopupMenuItem(icon, _("Cinnamon Settings"));

		this.menu.addMenuItem(this._itemCinSettings);
		this._itemCinSettings.connect('activate', function(actor, event) {
			GLib.spawn_command_line_async('cinnamon-settings');
		});
		//Seperator
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		//Reload Theme
		icon = new St.Icon({icon_name: "gnome-settings-theme", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
		this._itemCinReloadTheme = new MyPopupMenuItem(icon, _("Reload Theme"));

		this.menu.addMenuItem(this._itemCinReloadTheme);
		this._itemCinReloadTheme.connect('activate', function(actor, event) {
			Main.loadTheme();
		});
		//Restart Cinnamon
		icon = new St.Icon({icon_name: "reload", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
		this._itemCinRestart = new MyPopupMenuItem(icon, _("Restart Cinnamon"));

		this.menu.addMenuItem(this._itemCinRestart);
		this._itemCinRestart.connect('activate', function(actor, event) {
			global.reexec_self();
		});
	}
};
//---------------------------------------------------------------------
function main(metadata, orientation) {
	let myApplet = new MyApplet(orientation);
	return myApplet;
};
