const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Main = imports.ui.main;
const Gettext = imports.gettext;
const UUID = "lorem@vxstorm";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation) {
    this._init(orientation);
}

var data = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed est eros, vulputate eget sodales nec, malesuada vel ante. Quisque volutpat risus in dolor sollicitudin a commodo libero suscipit. Nunc ultrices risus ut arcu hendrerit aliquet. Integer sit amet eros eu augue porttitor dictum. Quisque vel ante est, at lacinia tortor. Curabitur lacus purus, malesuada sit amet dapibus ac, placerat id leo. Nullam vel ultrices augue. Donec posuere convallis purus, sit amet imperdiet leo laoreet at. Quisque aliquam, urna non interdum lobortis, leo diam tincidunt lectus, non ultricies quam purus eget quam."


MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

		try {
			this.set_applet_icon_symbolic_name("edit-paste");
			this.set_applet_tooltip(_("Copy Lorem Ipsum into your clipboard"));
		}
		catch (e) {
			global.logError(e);
		}
	},
		
	on_applet_clicked: function(event) {
		try {
			let clipboard = St.Clipboard.get_default()
			clipboard.set_text(data);
		}
		catch (e) {
			global.logError(e);
		}
	}
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
