const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const UUID = "uptime@vatanuki.kun";
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
	_timeout: null,

	_init: function(orientation, panel_height, instane_id) {
		Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instane_id);

		try {
			this._applet_label.set_style('text-align: left');
			this._refresh();
			this._timeout = Mainloop.timeout_add_seconds(60, Lang.bind(this, this._refresh));
		}
		catch (e) {
			global.logError(e);
		}
	},

	_refresh: function()
	{
		let timestamps_s=Cinnamon.get_file_contents_utf8_sync('/proc/uptime').split(" ")[0];
		let minutes=Math.floor((timestamps_s/60)%60);
		let hours=Math.floor((timestamps_s/3600)%24);
		let days=Math.floor((timestamps_s/86400)%365);
		let years=Math.floor(timestamps_s/31536000);
		let label_text="?";
		if(years>0)
			label_text=years+_("Y")+days+"D";
		else if(days>99)
			label_text=days+_("D");
		else if(days>0){
			if(hours < 10)
				hours="0" + hours;
			label_text=days+_("D")+hours+_("h");
		}
		else{
			if(minutes < 10)
				minutes="0" + minutes;
			label_text=hours+":"+minutes;
		}
		this.set_applet_label(label_text);
		return true;
	},

	on_applet_removed_from_panel: function(){
		if(this._timeout){
			Mainloop.source_remove(this._timeout);
			this._timeout=null;
		}
	},
};

function main(metadata, orientation, panel_height, instance_id){
	let myApplet = new MyApplet(orientation, panel_height, instance_id);
	return myApplet;
}
