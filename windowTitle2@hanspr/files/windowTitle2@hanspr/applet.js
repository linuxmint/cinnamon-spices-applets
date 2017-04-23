const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const UUID = "windowTitle2@hanspr";

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
            this.set_applet_label(_("Desktop"));
			let tracker = Cinnamon.WindowTracker.get_default();
			global.screen.get_display().connect('notify::focus-window',Lang.bind(this,function(){
				  let w=global.display.focus_window;
				  if(w){
				      w.connect('notify::title',Lang.bind(this,function(){this._onTitleChange();}));
				  }
				  this._onTitleChange();
		   }));
		}
        catch (e) {
            global.logError(e);
        }
    },

    _onTitleChange: function() {
        this.set_applet_label(global.display.focus_window.get_title().substring(0,50));
    }

}

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
