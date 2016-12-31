const GLib    = imports.gi.GLib;
const Gettext = imports.gettext;

const uuid    = "collapsible-systray@feuerfuchs.eu";

Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale");

function _(str){
    return Gettext.dgettext(uuid, str);
}
