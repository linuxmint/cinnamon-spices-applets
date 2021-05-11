const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,
    
    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        this.cinn_ver = GLib.getenv('CINNAMON_VERSION');
        this.cinn_ver = parseFloat(this.cinn_ver.substring(0, this.cinn_ver.lastIndexOf(".")));
        
        try{
            this.set_applet_icon_name("edit-bomb");
            this.set_applet_tooltip(_("Click here to erase your clipboard contents"));
        }
        catch(e)
        {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function() {
        try {
            let clipboard = St.Clipboard.get_default();
            if(this.cinn_ver <= 3.4)
            {
                clipboard.set_text("");
            }
            else
            {
                clipboard.set_text(St.ClipboardType.CLIPBOARD, "");
            }
        }
        catch(e)
        {
            global.logError(e);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}
