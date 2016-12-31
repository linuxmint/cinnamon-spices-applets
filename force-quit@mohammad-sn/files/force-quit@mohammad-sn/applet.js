const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const AppletManager = imports.ui.appletManager;


function MyApplet(metadata, orientation, panel_height) {
    this._init(metadata, orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        this.metadata=metadata;
        try {        
            this.set_applet_icon_symbolic_name("window-close");
            this.set_applet_tooltip(_("Click here to kill a window"));    
            this.AppletDir = AppletManager.appletMeta[this.metadata.uuid].path;                                         
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        GLib.spawn_command_line_async(this.AppletDir + "//xkill.py");
    }
   
};

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(metadata, orientation, panel_height);
    return myApplet;
}
