const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Gtk = imports.gi.Gtk;
const Gettext = imports.gettext;
const { restartCinnamon } = imports.ui.main; // Main

// l10n/translation support
let UUID;
function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        UUID = metadata.uuid;
        Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

        Gtk.IconTheme.get_default().append_search_path(metadata.path);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        //~ this.settings.bindProperty(Settings.BindingDirection.IN, "use-symbolic-icon", "useSymbolicIcon", this._updateIcon, null);
        this.settings.bind("use-symbolic-icon", "useSymbolicIcon", this._updateIcon);
        this.settings.bind("show-osd", "showOSD");
        this._updateIcon();
        this.set_applet_tooltip(_("Click here to restart Cinnamon"));
     },

    on_applet_clicked: function(event) {
        //~ global.reexec_self();
        restartCinnamon(this.showOSD);
    },

    _updateIcon: function() {
        if (this.useSymbolicIcon)
            this.set_applet_icon_symbolic_name("restart");
        else
            this.set_applet_icon_name("system-restart");
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
