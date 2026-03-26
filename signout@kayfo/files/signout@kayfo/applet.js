const Applet = imports.ui.applet;
const Util = imports.misc.util;

class SignoutApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        
        this.set_applet_icon_name('system-log-out');
        this.set_applet_tooltip(_("Sign Out"));
        this.set_applet_label(_("Sign Out"));
    }

    on_applet_clicked() {
        Util.spawnCommandLine("cinnamon-session-quit --logout --no-prompt");
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new SignoutApplet(metadata, orientation, panel_height, instance_id);
}