const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "suspend@janax";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {
            this.set_applet_icon_name("gnome-session-suspend");
            this.set_applet_tooltip(_("suspend"));                                                
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {      
        GLib.spawn_command_line_async('systemctl suspend -i');
    }
   
};



function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
