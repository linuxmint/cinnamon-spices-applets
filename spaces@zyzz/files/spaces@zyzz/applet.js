// Edit line 24 to adjust the gap you want.
// Not a very nice method but it works for now.
// Naturally you can't see the applet but it's right of the icons you can see by the Menu.
// Just position your mouse curser above it and you see the tooltip (can be deactivated by adding "//" before line 25).
// Every change in here requires a restart of Cinnamon. Just press Alt + F2 and enter "r".

const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;

function MyApplet(orientation) {
	this._init(orientation);
}

MyApplet.prototype = {
	__proto__: Applet.TextApplet.prototype,

	_init: function(orientation) {
		Applet.TextApplet.prototype._init.call(this, orientation);

		try {
			this.set_applet_label("                             "); // The more "spaces" the bigger the space
			this.set_applet_tooltip(_("Click here to move the applet where you want it.")); // Add "//" to this line to deactivate the tooltips
		}
		catch (e) {
			global.logError(e);
		}
	},
}; 

function main(metadata, orientation) {
	let myApplet = new MyApplet(orientation);
	return myApplet;
}
