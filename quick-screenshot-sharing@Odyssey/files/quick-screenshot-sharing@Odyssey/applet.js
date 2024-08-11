const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Lang = imports.lang;
const UUID = "quick-screenshot-sharing@Odyssey";

const APPLET_STRINGS = {
    tooltip: _("Click on the applet to make a screenshot and upload it"),
    packageCheck: _("You are missing some of the required packages.\nPlease, run the command below on a terminal:\nsudo apt install xdg-user-dirs gnome-screenshot curl xclip jq"),
    packageCheckLG: _("is missing required package(s). Please run: sudo apt install xdg-user-dirs gnome-screenshot curl xclip jq"),
    unreachableHost: _("The remote host seems to be unavailable.\nThe screenshot will still be saved locally.\nIf you do not have internet issues and the problem persists over time, you may consider opening an issue at https://github.com/linuxmint/cinnamon-spices-applets/issues and tagging @Odyssey"),
    unreachableHostLG: _("Could not establish connection with the remote file hosting service. The screenshot will not be uploaded."),
};

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {
            this.set_applet_icon_symbolic_name("camera-photo");
            this.set_applet_tooltip(APPLET_STRINGS.tooltip);
            this.actor.connect('button-release-event', Lang.bind(this, this._onIconClickEvent));
        }
        catch (e) {
            global.logError(e);
        }
    },

    _onIconClickEvent: function(actor, event) {
        if (this._applet_enabled) {
            try {
                // Handle primary click
                if (event.get_button() === 1)
                {
                    // Check and inform whether all the required packages are installed or some are missing
                    if (!passesPackageCheck())
                    {
                        GLib.spawn_command_line_async(`notify-send "${UUID}" "${APPLET_STRINGS.packageCheck}"`);
                        return true;
                    }

                    // Required packages are installed, retrieve the script to run
                    const appletPath = imports.ui.appletManager.appletMeta[UUID].path;
                    const scriptFile = `${appletPath}/quick-screenshot`;

                    // Check if the remote upload host is available
                    if (isHostAvailable())
                        GLib.spawn_command_line_async(scriptFile);
                    else
                        GLib.spawn_command_line_async(scriptFile.concat(' -noupload'));
                }
            }
            catch (e) {
                global.logError(e);            
            }
        }
        return true;
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instanceId);
    return myApplet;
}

// Checks if all the required packages required for the applet to function properly are installed
function passesPackageCheck() {
    let packages = ["xdg-user-dirs", "gnome-screenshot", "curl", "xclip", "jq"];
    for (let pkg of packages) {
        let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
            null,
            ['sh', '-c', `dpkg -l | grep -w ${pkg}`],
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null
        );

        if (success) {
            let output = GLib.IOChannel.unix_new(stdout);
            let [status, stdoutContent] = output.read_line();
            if (!stdoutContent) {
                global.logError(`${UUID} ${APPLET_STRINGS.packageCheckLG}`);
                return false;
            }
        }
    }
    return true;
}

// Checks if the remote upload host is alive
function isHostAvailable()
{
    const host = "https://kappa.lol";

    let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
        null,
        ['sh', '-c', `curl -Is ${host} | head -n 1 | grep -w "200"`],
        null,
        GLib.SpawnFlags.SEARCH_PATH,
        null
    );

    if (success) {
        let output = GLib.IOChannel.unix_new(stdout);
        let [status, stdoutContent] = output.read_line();
        if (stdoutContent)
            return true;
    }
    global.logWarning(`${UUID}: ${APPLET_STRINGS.unreachableHostLG}`);
    GLib.spawn_command_line_async(`notify-send "${UUID}" "${APPLET_STRINGS.unreachableHost}"`);
    return false;
}
