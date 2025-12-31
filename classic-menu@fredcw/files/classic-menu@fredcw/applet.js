const GLib = imports.gi.GLib;
const Main = imports.ui.main;


const Gettext = imports.gettext;
Gettext.bindtextdomain(__meta.uuid, GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
    let cinnamonTranslation = Gettext.gettext(str);
    if (cinnamonTranslation !== str) {
        return cinnamonTranslation;
    }
    return Gettext.dgettext('classic-menu@fredcw', str);
}

Main.warningNotify(_("Classic Menu"), _("Classic Menu is for cinnamon versions 6.6 and later only."));

function main(metadata, orientation, panel_height, instance_id) {
    throw new Error("Classic Menu is for cinnamon versions 6.6 and later only.");
}
