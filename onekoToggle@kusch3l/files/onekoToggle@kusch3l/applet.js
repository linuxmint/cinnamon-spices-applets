const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
let home = GLib.get_home_dir();

function OnekoToggle(orientation, panelHeight, instanceId) {
    this._init(orientation, panelHeight, instanceId);
}

OnekoToggle.prototype = Object.create(Applet.TextIconApplet.prototype);
OnekoToggle.prototype.constructor = OnekoToggle;

OnekoToggle.prototype._init = function(orientation, panelHeight, instanceId) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
    log("onekoToggle is initialised");
    this.updateIcon();
    this.set_applet_tooltip("Click to toggle Oneko");
};

OnekoToggle.prototype.on_applet_clicked = function(event) {
    //log("onekoToggle is clicked");
    GLib.spawn_command_line_async(home + "/.local/share/cinnamon/applets/onekoToggle@kusch3l/oneko.sh");
    
    // Delay update to allow process start/stop
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
        this.updateIcon();
        return GLib.SOURCE_REMOVE;
    });
};

OnekoToggle.prototype.checkIfProgramRunning = function(programName) {
    // Runs pgrep synchronously, returns true/false
    try {
        let [ok, stdout, stderr, status] = GLib.spawn_command_line_sync(`pgrep -x ${programName}`);
        if (ok && status === 0 && stdout.toString().trim() !== "") {
            return true;
        }
    } catch (e) {
        logError(e);
    }
    return false;
};

OnekoToggle.prototype.updateIcon = function() {
    if (this.checkIfProgramRunning("oneko")) {
        this.set_applet_icon_name("running");
        log("oneko is running");
    } else {
        this.set_applet_icon_name("stopped");
        log("oneko is stopped");
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new OnekoToggle(orientation, panelHeight, instanceId);
}
