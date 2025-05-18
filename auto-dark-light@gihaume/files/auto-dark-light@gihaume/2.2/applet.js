const Applet  = imports.ui.applet;
const Main    = imports.ui.main;
const Gettext = imports.gettext;
const {GLib}  = imports.gi;

class ThisApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name('on-error-symbolic');

        Gettext.bindtextdomain(metadata.name, GLib.get_home_dir() + "/.local/share/locale");
        function _(string) {
            return Gettext.dgettext(metadata.name, string);
        }

        Main.criticalNotify(
            metadata.name,
            `${_("Critical error")}${_(":")} ${_("this applet is only supported for")} Cinnamon >= 5.8.`
        );
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ThisApplet(metadata, orientation, panel_height, instance_id);
}
