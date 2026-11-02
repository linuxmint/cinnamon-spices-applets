// Translation helper shared by all PocketTray modules.
//
// Usage in a module:
//     const { _ } = require('./lib/i18n');
//     label.text = _("Show in panel:");
//
// The .po files live in po/. `cinnamon-xlet-makepot <applet dir>` collects
// every _("...") string from all modules into the .pot template.

const Gettext = imports.gettext;
const GLib = imports.gi.GLib;

const UUID = "PocketTray@spex";

// Cinnamon installs xlet translations to <user data dir>/locale.
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

module.exports = { UUID, _ };
