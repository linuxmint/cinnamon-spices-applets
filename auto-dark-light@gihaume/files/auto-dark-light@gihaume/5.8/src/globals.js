import GLib from 'gi://GLib';

const Gettext = imports.gettext;
const Main = imports.ui.main;
const { St } = imports.gi;

/** @type {imports.ui.applet.AppletMetadata} */
export const metadata = {
    uuid: "",
    name: "",
    description: "",
    path: "",
    force_loaded: false
};

/**
 * @param {string} text
 * @returns {string}
 */
export function _(text) {
    return Gettext.dgettext(metadata.uuid, text);
}

let translated_applet_name = "";

/** @param {imports.ui.applet.AppletMetadata} applet_metadata */
export function initialize_globals(applet_metadata) {
    Object.assign(metadata, applet_metadata);

    const translations_dir_path = GLib.get_home_dir() + '/.local/share/locale';
    Gettext.bindtextdomain(metadata.uuid, translations_dir_path);

    translated_applet_name = _(metadata.name);
}

const icon_size = 24;
const warning_icon = new St.Icon({
    icon_name: 'dialog-warning', icon_type: St.IconType.SYMBOLIC, icon_size
});
const error_icon = new St.Icon({
    icon_name: 'dialog-error', icon_type: St.IconType.SYMBOLIC, icon_size
});

export const logger = {
    /** @param {string} msg */
    info(msg) {
        global.log(translated_applet_name + `${_(":")} ` + msg);
        Main.notify(translated_applet_name, msg);
    },
    /** @param {string} msg */
    warn(msg) {
        global.logWarning(translated_applet_name + `${_(":")} ` + msg);
        Main.warningNotify(translated_applet_name, msg, warning_icon);
    },
    /** @param {string} msg */
    error(msg) {
        global.logError(translated_applet_name + `${_(":")} ` + msg);
        Main.criticalNotify(translated_applet_name, msg, error_icon);
    }
};
