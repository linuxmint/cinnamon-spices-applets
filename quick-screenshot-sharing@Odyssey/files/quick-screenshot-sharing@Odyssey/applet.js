const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Lang = imports.lang;
const UUID = "quick-screenshot-sharing@Odyssey";

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
            this.set_applet_tooltip(_("Make a screenshot, save it and upload it.\nScreenshots are saved in ~/Pictures/Screenshots/year-month\nWhen uploaded, the link gets copied to your clipboard.\nA log of your screenshots is kept at ~/quick-screenshot-sharing.history"));
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
                    // Check user distribution
                    let distribution = checkDistro(false);

                    // Check and inform whether all the required packages are installed or some are missing
                    if (!passesPackageCheck(distribution))
                    {
                        let msg = getMissingPackageMsgFor(distribution);
                        GLib.spawn_command_line_async(`notify-send "${UUID}" "${msg}"`);
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

// Checks if all the required packages required for the applet to function properly are installed in the user's distro
function passesPackageCheck(distro)
{
    let cmd;

    let packages = ["xdg-user-dirs", "gnome-screenshot", "curl", "xclip", "jq"];
    for (let pkg of packages)
    {
        // Prepare command based on distro
        if (distro === "ubuntu" || distro === "debian")
            cmd = `dpkg -l | grep -w ${pkg}`;
        else if (distro === "arch")
            cmd = `pacman -Q | grep ${pkg}`;
        else if (distro === "rhel" || distro === "fedora")
            cmd = `rpm -qa | grep ${pkg}`;
        else if (distro === "suse")
            cmd = `zypper search -i ${pkg}`;
        else if (distro === "gentoo")
            cmd = `equery list ${pkg}`;
        else if (distro === "unknown")
            cmd = `which ${pkg}`;

        // Check if the package is installed for the right distro
        let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
            null,
            ['sh', '-c', `${cmd}`],
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null
        );

        if (success)
        {
            let output = GLib.IOChannel.unix_new(stdout);
            let [status, stdoutContent] = output.read_line();
            if (!stdoutContent)
            {
                let packageCheckLG = _("is missing required package(s). Please ensure the following packages are installed by using your distribution's 'package manager: xdg-user-dirs gnome-screenshot curl xclip jq");
                global.logError(`${UUID} ${packageCheckLG}`);
                return false;
            }
        }
        else
        {
            // Unexpected command failure, handle it
            let errorCheckingNotif = _("Unexpected error while checking for the installation of required packages. Check Melange logs for more details.");
            let errorCheckingLog = _("There has been an unexpected error while executing a command to check if required packages are installed. If you are on a not so popular linux distribution, install the package 'which' and try again. If the problem persists or you are on a widely known linux distribution, you may consider opening an issue at https://github.com/linuxmint/cinnamon-spices-applets/issues and tagging @Odyssey");
            GLib.spawn_command_line_async(`notify-send "${UUID}" "${errorCheckingNotif}"`);
            global.logError(`${UUID}: ${errorCheckingLog}`);
            return false;
        }
    }
    return true;
}

// Checks which distro is the system based on
function checkDistro(tryOlderFile)
{
    let output;
    let cmd;

    // If the param is false, attempts to parse /etc/os-release
    // If true, it falls back to trying /etc/*release
    if (!tryOlderFile)
        cmd = `cat /etc/os-release`;
    else
        cmd = `cat /etc/*release`;

    let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
        null,
        ['sh', '-c', `${cmd} | grep ID`],
        null,
        GLib.SpawnFlags.SEARCH_PATH,
        null
    );

    if (success)
    {
        output = GLib.IOChannel.unix_new(stdout);
        let [status, stdoutContent] = output.read_line();

        if (stdoutContent)
        {
            // got the line
            output = stdoutContent;
        }
        else if (!stdoutContent && !tryOlderFile)
        {
            // cat /etc/os-release failed. try the older file
            checkDistro(true);
        }
        else if (!stdoutContent && tryOlderFile)
        {
            // cat /etc/*release failed too
            return "unknown";
        }
    }

    // check which distro the output mentioned
    output = output.toLowerCase();

    if (output.includes("ubuntu") || output.includes("debian") || output.includes("mint"))
        return "debian";
    else if (output.includes("arch") || output.includes("manjaro"))
        return "arch";
    else if (output.includes("rhel") || output.includes("fedora"))
        return "fedora";
    else if (output.includes("suse"))
        return "suse";
    else if (output.includes("gentoo"))
        return "gentoo";

    return "unknown";
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

    if (success)
    {
        let output = GLib.IOChannel.unix_new(stdout);
        let [status, stdoutContent] = output.read_line();
        if (stdoutContent)
            return true;
    }

    let unreachableHost = _("The remote hosting service is not responding, so the screenshot will not be uploaded. Check Melange logs for more details.");
    let unreachableHostLG = _("The remote hosting server did not return code 200. If you do not have internet issues and the problem persists over time, you may consider opening an issue at https://github.com/linuxmint/cinnamon-spices-applets/issues and tagging @Odyssey");
    global.logWarning(`${UUID}: ${unreachableHostLG}`);
    GLib.spawn_command_line_async(`notify-send "${UUID}" "${unreachableHost}"`);
    return false;
}

// Builds a missing packages notification depending on the user distro
function getMissingPackageMsgFor(distro)
{
    let msg = _("You are missing some of the required packages for this applet to work.\nPlease open a terminal and follow the instructions:");
    switch (distro)
    {
        case "ubuntu":
        case "debian":
            msg += _("\n\nFor Debian/Ubuntu based systems, run:\n\nsudo apt install xdg-user-dirs gnome-screenshot curl jq xclip");
            break;
        case "fedora":
            msg +=_("\n\nFor Fedora based systems, run:\n\nsudo dnf install xdg-user-dirs gnome-screenshot curl jq xclip");
            break;
        case "arch":
            msg += _("\n\nFor Arch based systems, run:\n\nsudo pacman -S xdg-user-dirs gnome-screenshot curl jq xclip");
            break;
        case "suse":
            msg += _("\n\nFor SUSE based systems, run:\n\nsudo zypper install xdg-user-dirs gnome-screenshot curl jq xclip");
            break;
        case "gentoo":
            msg += _("\n\nFor Gentoo based systems, run:\n\nsudo emerge x11-misc/xdg-user-dirs gnome-extra/gnome-screenshot net-misc/curl app-misc/jq x11-misc/xclip");
        default:
            msg += _("\n\nInstall the following packages:\n\nxdg-user-dirs gnome-screenshot curl jq xclip");
            break;
    }
    return msg;
}
