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
        this.metadata = metadata;
        this.set_applet_icon_symbolic_name("applets-screenshooter-symbolic");
        this.set_applet_tooltip(_("Mint Screenshot — Click to capture"));

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("default-save-directory", "save_directory");
    }

    _takeScreenshot() {
        let pythonScript = GLib.build_filenamev([this.metadata.path, "main.py"]);

        // Resolve the save directory, respecting the user's locale for ~/Pictures
        let picturesDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) || GLib.get_home_dir();
        let defaultSaveDir = GLib.build_filenamev([picturesDir, "Screenshots"]);

        let saveDir = this.save_directory || defaultSaveDir;
        if (saveDir.startsWith("~")) {
            saveDir = saveDir.replace("~", GLib.get_home_dir());
        }

        Util.spawn(["python3", pythonScript, saveDir]);
    }

    on_applet_clicked(event) {
        this._takeScreenshot();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MintScreenshotApplet(metadata, orientation, panel_height, instance_id);
}
