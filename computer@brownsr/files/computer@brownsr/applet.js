const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gettext = imports.gettext.domain('cinnamon');
const _ = Gettext.gettext;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        try {
            this.set_applet_icon_name("computer");
            this.set_applet_tooltip(_("Computer"));
            this.computer_path = 'computer:///';
            this.computer_directory =  Gio.file_new_for_uri(this.computer_path);
            this.set_applet_icon_symbolic_name("computer");
        }
        catch (e) {
            global.logError(e);
        }
    },
    

    on_applet_clicked: function(event) {
        this._openComputer();
    },

    _openComputer: function() {
        Gio.app_info_launch_default_for_uri(this.computer_directory.get_uri(), null);
    },

};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
