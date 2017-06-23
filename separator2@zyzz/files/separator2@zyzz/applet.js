const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "separator2@zyzz";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation) {
	this._init(metadata, orientation);
}

MyApplet.prototype = {
	__proto__: Applet.IconApplet.prototype,

	_init: function(metadata, orientation) {
		Applet.IconApplet.prototype._init.call(this, orientation);

		try {
			this.set_applet_icon_path(metadata.path + "/icon.png");
			this.set_applet_tooltip(_("Click here to move the applet where you want it."));	// Add "//" to this line to deactivate the tooltips
		}
		catch (e) {
			global.logError(e);
		}
	},
}; 

function main(metadata, orientation) {
	let myApplet = new MyApplet(metadata, orientation);
	return myApplet;
}
