const Gettext = imports.gettext;
const GLib    = imports.gi.GLib;

const UUID = 'auto-dark-light@gihaume';  // TODO: SSOT

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

/** @param {string} string - The string to translate. */
module.exports = function _(string) {
    return Gettext.dgettext(UUID, string);
}
