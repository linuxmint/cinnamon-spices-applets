const Gettext = imports.gettext;
const { GLib } = imports.gi;
const Main = imports.ui.main;
const { St } = imports.gi;

export const metadata: imports.ui.applet.AppletMetadata = {
    uuid: "",
    name: "",
    description: "",
    path: "",
    force_loaded: false
};

export function _(text: string): string {
    return Gettext.dgettext(metadata.uuid, text);
}

let translated_applet_name = "";

export function initialize_globals(applet_metadata: imports.ui.applet.AppletMetadata) {
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
    info(msg: string) {
        global.log(translated_applet_name + `${_(":")} ` + msg);
        Main.notify(translated_applet_name, msg);
    },
    warn(msg: string) {
        global.logWarning(translated_applet_name + `${_(":")} ` + msg);
        Main.warningNotify(translated_applet_name, msg, warning_icon);
    },
    error(msg: string) {
        global.logError(translated_applet_name + `${_(":")} ` + msg);
        Main.criticalNotify(translated_applet_name, msg, error_icon);
    }
};
