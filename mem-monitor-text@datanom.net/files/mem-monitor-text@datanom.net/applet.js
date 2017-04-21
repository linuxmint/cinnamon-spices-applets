const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const GTop = imports.gi.GTop;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gettext = imports.gettext;
const UUID = "mem-monitor-text@datanom.net";
const GLib = imports.gi.GLib;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation) {
	this._init(orientation);
}

MyApplet.prototype = {
	__proto__: Applet.TextApplet.prototype,

    _init: function(orientation) {
        Applet.TextApplet.prototype._init.call(this, orientation);

		try {
			this.itemOpenSysMon = new PopupMenu.PopupMenuItem(_("Open System Monitor"));
			this.itemOpenSysMon.connect('activate', Lang.bind(this, this._runSysMonActivate));
			this._applet_context_menu.addMenuItem(this.itemOpenSysMon);

			this.gtop = new GTop.glibtop_mem();

			this._applet_label.set_style('min-width: 6.5em; text-align: left');

			this.usage = 0;
			this.maxmem = 0;
			this.buffer = 0;
			this.cached = 0;

			this._update();
		}
		catch (e) {
			global.logError(e);
		}
	},

	on_applet_clicked: function(event) {
		this._runSysMon();
	},

	_runSysMonActivate: function() {
		this._runSysMon();
	},

	_update: function() {
		try {
			GTop.glibtop_get_mem(this.gtop);
			this.usage = this.gtop.used;
			this.buffer = this.gtop.buffer;
			this.cached = this.gtop.cached;
			this.maxmem = this.gtop.total;
		
			this.realuse = this.usage - this.buffer - this.cached;
			let percent = Math.round((this.realuse * 100) / this.maxmem);
			this.set_applet_label(_("  Mem: ") + ("   " + percent.toString()).slice(-3) + "%");
			this.set_applet_tooltip(_("Click to open Gnome system monitor"));
		}
		catch (e) {
			global.logError(e);
		}

		Mainloop.timeout_add(2000, Lang.bind(this, this._update));
	},

	_runSysMon: function() {
		let _appSys = Cinnamon.AppSystem.get_default();
		let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
		_gsmApp.activate();
	},
};

function main(metadata, orientation) {
	let myApplet = new MyApplet(orientation);
	return myApplet;
}
