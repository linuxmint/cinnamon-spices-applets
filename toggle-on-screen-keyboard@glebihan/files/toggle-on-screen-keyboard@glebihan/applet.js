const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {        
            this.set_applet_icon_name("keyboard");
            this.set_applet_tooltip(_("Toggle on-screen keyboard"));         
            
            this._schema = new Gio.Settings({ schema: "org.gnome.desktop.a11y.applications" });                               
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(){
        var enabled = this._schema.get_boolean("screen-keyboard-enabled");
        this._schema.set_boolean("screen-keyboard-enabled", !enabled);
    }
}

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
