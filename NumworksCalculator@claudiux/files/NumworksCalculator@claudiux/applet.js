const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;

const UUID = "NumworksCalculator@claudiux";
const SIM_PATH = GLib.get_home_dir() + "/.local/share/cinnamon/applets/"+UUID+"/simulator/simulator.html";

class NumworksApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.instanceId = instance_id;
        this.orientation = orientation;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.set_applet_icon_name("numworks");

    }

    on_applet_clicked(event) {
        Util.spawnCommandLineAsync("firefox --private-window "+SIM_PATH);
    }

}

function main(metadata, orientation, panel_height, instance_id) {
    return new NumworksApplet(metadata, orientation, panel_height, instance_id);
}
