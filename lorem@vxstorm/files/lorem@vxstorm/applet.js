const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gettext = imports.gettext;
const UUID = "lorem@vxstorm";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed est eros, vulputate eget sodales nec, malesuada vel ante. Quisque volutpat risus in dolor sollicitudin a commodo libero suscipit. Nunc ultrices risus ut arcu hendrerit aliquet. Integer sit amet eros eu augue porttitor dictum. Quisque vel ante est, at lacinia tortor. Curabitur lacus purus, malesuada sit amet dapibus ac, placerat id leo. Nullam vel ultrices augue. Donec posuere convallis purus, sit amet imperdiet leo laoreet at. Quisque aliquam, urna non interdum lobortis, leo diam tincidunt lectus, non ultricies quam purus eget quam."

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this.cinn_ver = GLib.getenv('CINNAMON_VERSION');
        this.cinn_ver = parseFloat(this.cinn_ver.substring(0, this.cinn_ver.lastIndexOf(".")));

        try {
            this.set_applet_icon_symbolic_name("edit-paste");
            this.set_applet_tooltip(_("Copy Lorem Ipsum into your clipboard"));
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        try {
            let clipboard = St.Clipboard.get_default();
            if (this.cinn_ver <= 3.4) {
                clipboard.set_text(LOREM);
            } else {
                clipboard.set_text(St.ClipboardType.CLIPBOARD, LOREM);
            }
        }
        catch (e) {
            global.logError(e);
        }
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instanceId);
    return myApplet;
}
