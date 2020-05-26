const Gettext = imports.gettext;
const GLib = imports.gi.GLib;

var GTop;
try {
    GTop = imports.gi.GTop;
}
catch (e) {
    global.log(e)
    GTop = null;
}

const UUID = "sysmonitor@orcus";

function _(str) {
  return Gettext.dgettext(UUID, str);
}

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")
