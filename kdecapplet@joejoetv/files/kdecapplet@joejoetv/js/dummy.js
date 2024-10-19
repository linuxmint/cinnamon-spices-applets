const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const CommonUtils = require("./js/commonUtils.js");

// l10n support
Gettext.bindtextdomain(CommonUtils.UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(CommonUtils.UUID, str);
}

class Dummy {
    // This dummy file is used to make sure that some strings get picked up for
    // translation and doesn't have any other usecase in the project currently.
    let mod01 = _("Battery Module");
    let mod02 = _("Connectivity Module");
    let mod03 = _("Device-Info Module");
    let mod04 = _("FindMyPhone Module");
    let mod05 = _("Module");
    let mod06 = _("Ping Module");
    let mod07 = _("Request Photo Module");
    let mod08 = _("SFTP Module");
    let mod09 = _("SMS Module");
    let mod10 = _("Share Module");
}
