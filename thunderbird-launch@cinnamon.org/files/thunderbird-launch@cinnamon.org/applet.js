const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
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
            this.set_applet_icon_name("thunderbird");
            this.set_applet_tooltip(_("Launch Thunderbird mailclient"));
        }
        catch (e) {
            global.logError(e);
        }
     },
 
    on_applet_clicked: function(event) {
        GLib.spawn_command_line_async('thunderbird');
    }
};
 
function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}