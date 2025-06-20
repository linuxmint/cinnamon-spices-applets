const Applet  = imports.ui.applet;
const Gettext = imports.gettext;
const {GLib}  = imports.gi;
const Main    = imports.ui.main;

class ThisApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        const applet_name = metadata.name;

        Gettext.bindtextdomain(
            applet_name,
            GLib.get_home_dir() + "/.local/share/locale"
        );
        const _ = text => Gettext.dgettext(applet_name, text);

        const critical_message =
            `${_("Critical error")}${_(":")}`
            + `${_("this applet is only supported by")} Cinnamon >= 5.8.`;
        Main.criticalNotify(applet_name, critical_message);
        this.set_applet_tooltip(critical_message);

        this.set_applet_icon_symbolic_name('on-error-symbolic');

        Object.assign(this, {applet_name, critical_message});
    }

    on_applet_clicked() {
        Main.criticalNotify(this.applet_name, this.critical_message);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ThisApplet(metadata, orientation, panel_height, instance_id);
}
