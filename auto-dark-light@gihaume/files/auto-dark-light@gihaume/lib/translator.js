const Gettext = imports.gettext;
const GLib    = imports.gi.GLib;

const UUID = 'auto-dark-light@gihaume';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) { return Gettext.dgettext(UUID, str); }

module.exports = { _ };
