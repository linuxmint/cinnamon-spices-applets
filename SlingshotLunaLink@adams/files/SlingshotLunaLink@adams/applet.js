/**
 * @author Adam Crockett
 */
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
this.set_applet_label("Applications");
this.set_applet_tooltip(_(""));
}
catch (e) {
global.logError(e);
}
},
on_applet_clicked: function(event) {
GLib.spawn_command_line_async('slingshot-launcher');
}
};
function main(metadata, orientation) {
let myApplet = new MyApplet(orientation);
return myApplet;
}
