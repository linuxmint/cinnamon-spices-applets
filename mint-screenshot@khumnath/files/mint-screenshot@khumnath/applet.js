const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

function _(str) {
    return Gettext.dgettext("mint-screenshot", str);
}

const Settings = imports.ui.settings;

class MintScreenshotApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.set_applet_icon_symbolic_name("applets-screenshooter-symbolic");
        this.set_applet_tooltip(_("Mint Screenshot — Click to capture"));

        // Settings setup
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("default-save-directory", "save_directory");
    }

    _takeScreenshot() {
        let pythonScript = GLib.get_home_dir() + "/projects/mint-screenshot/main.py";
        let saveDir = this.save_directory || "~/Pictures/Screenshots";
        saveDir = saveDir.replace("~", GLib.get_home_dir());

        let command = `python3 "${pythonScript}" "${saveDir}" > /tmp/mint-screenshot.log 2>&1`;
        Util.spawnCommandLine(command);
    }

    on_applet_clicked(event) {
        this._takeScreenshot();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MintScreenshotApplet(metadata, orientation, panel_height, instance_id);
}
