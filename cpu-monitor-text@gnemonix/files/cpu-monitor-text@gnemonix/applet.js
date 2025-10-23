const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const GTop = imports.gi.GTop;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const UUID = "cpu-monitor-text@gnemonix";
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation, panel_height, instane_id) {
	this._init(orientation, panel_height, instane_id);
}

MyApplet.prototype = {
	__proto__: Applet.TextApplet.prototype,

    _init: function(orientation, panel_height, instane_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instane_id);

		try {
			
			this.settings = new Settings.AppletSettings(this, "cpu-monitor-text@gnemonix", this.instance_id);
			
			this.settings.bindProperty(Settings.BindingDirection.IN, "cpu-label", "cpu_label", this._update, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "max-percentage", "max_percentage", this._update, null);
			this.settings.bindProperty(Settings.BindingDirection.IN, "update-interval", "update_interval", this._update, null);
			
			this.itemOpenSysMon = new PopupMenu.PopupMenuItem(_("Open System Monitor"));
			this.itemOpenSysMon.connect('activate', Lang.bind(this, this._runSysMonActivate));
			this._applet_context_menu.addMenuItem(this.itemOpenSysMon);
	
			this.gtop = new GTop.glibtop_cpu();
	
			this._applet_label.set_style('min-width: 2.5em; text-align: left');
			this.styleString = 0;
			this.minWidth = 0;
			this.minWidthMatch = 0;
			this.styleString = this._applet_label.get_style();
			this.minWidthMatch = this.styleString.match(/min-width:\s*(\d*\.?\d*)em/);
			this.minWidth = parseFloat(this.minWidthMatch[1]);
	
			this.current = 0;
			this.last = 0;
			this.usage = 0;
			this.last_total = 0;
	
			this._update();
			this._updateLoop();
			
		}
		catch (e) {
			global.logError(e);
		}
	},

	on_applet_clicked: function(event) {
		this._runSysMon();
	},
	
	on_applet_removed_from_panel: function () {
		if (this._updateLoopID) {
			Mainloop.source_remove(this._updateLoopID);
		}
		this.settings.finalize();
	},

	_runSysMonActivate: function() {
		this._runSysMon();
	},

	_pad: function(percent) {
        	let str = percent.toString();
		let str_length = this.max_percentage.toString().length;
		
        	while(str.length < str_length) {
			str = "\u2007" + str;
		}
        	return (str);
	},

	_update: function() {
		GTop.glibtop_get_cpu(this.gtop);
		this.current = this.gtop.idle;

		let delta = (this.gtop.total - this.last_total) / this.max_percentage;
		if (delta > 0) {
			this.usage = Math.round((this.current - this.last) / delta);
			this.last = this.current;

		}

		this.last_total = this.gtop.total;
		let percent = Math.round(this.max_percentage - this.usage);
		let adjusted_min_width = this.minWidth;
		if (this.cpu_label.length > 0) {
			adjusted_min_width += this.cpu_label.length * 0.6;
		}
		if (this.max_percentage.toString().length > 0) {
			adjusted_min_width += (this.max_percentage.toString().length - 3) * 0.6;
		}
		this._applet_label.set_style('min-width: ' + adjusted_min_width + 'em; text-align: left');

		this.set_applet_label(this.cpu_label + this._pad(percent) + "%");
	},

	_updateLoop: function () {
		this._update();
		this._updateLoopID = Mainloop.timeout_add(this.update_interval, Lang.bind(this, this._updateLoop));
	},

	_runSysMon: function() {
		let _appSys = Cinnamon.AppSystem.get_default();
		let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
		_gsmApp.activate();
	},
};

function main(metadata, orientation, panel_height, instance_id) {
	let myApplet = new MyApplet(orientation, panel_height, instance_id);
	return myApplet;
}
