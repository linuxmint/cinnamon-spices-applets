const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Gettext = imports.gettext;
const UUID = "launchers-draggable-switch@r0p01ach";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const Meta = imports.ui.appletManager.appletMeta["launchers-draggable-switch@r0p01ach"];

function get_schema(schema) {
    if (Gio.Settings.list_schemas().indexOf(schema) == -1)
        throw _("Schema \"%s\" not found.").format(schema);
    return new Gio.Settings({schema: schema});
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation){
        Applet.Applet.prototype._init.call(this, orientation);

        try {
            this.binIco = new St.Bin();
            Gtk.IconTheme.get_default().append_search_path(Meta.path);
            this.ico_on = new St.Icon({icon_name: "launchers-draggable-on",
                icon_type: St.IconType.FULLCOLOR, icon_size: 18, style_class: "applet-icon"});
            this.ico_off = new St.Icon({icon_name: "launchers-draggable-off",
                icon_type: St.IconType.FULLCOLOR, icon_size: 18, style_class: "applet-icon"});
            this.binIco.child = this.ico_on;
            this.actor.add(this.binIco, {y_align: St.Align.MIDDLE, y_fill: false});

            this.cnmnk = get_schema('org.cinnamon');
            let lnchrsdrgbl = this.cnmnk.get_boolean('panel-launchers-draggable');
            this._reflect_state(lnchrsdrgbl);
        }
        catch (e) {
            global.logError(e);
        }
    },

    _reflect_state: function(lnchrsdrgbl) {
        this.set_applet_tooltip(_("Moving launchers by dragging is now") + " " + (lnchrsdrgbl ? _("ON") : _("OFF")));
        this.binIco.child = lnchrsdrgbl ? this.ico_on : this.ico_off;
    },

    on_applet_clicked: function(event) {
        let lnchrsdrgbl = !this.cnmnk.get_boolean('panel-launchers-draggable');
        this.cnmnk.set_boolean('panel-launchers-draggable', lnchrsdrgbl);
        this._reflect_state(lnchrsdrgbl);
    }

};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
