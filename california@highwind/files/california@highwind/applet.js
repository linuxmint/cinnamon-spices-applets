const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;
const APPLET_ICON = global.userdatadir + "/applets/california@highwind/cal.svg";

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        
		  try{
          this.set_applet_icon_path(APPLET_ICON);
          this.set_applet_tooltip(_("open calendar"));
                      }
	     catch(e){
          global.logError(e);
                     }
           },
    
    on_applet_clicked: function(event) {
        GLib.spawn_command_line_async('california');
           }
};

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;
}
