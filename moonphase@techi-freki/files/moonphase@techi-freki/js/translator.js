const { get_home_dir } = imports.gi.GLib;
const GetText = imports.gettext;

class Translator {
    constructor(uuid) {
        this.uuid = uuid;
    }

    translate(str) {
        GetText.bindtextdomain(this.uuid, `${get_home_dir()}/.local/share/locale`);
        let translated = GetText.dgettext(this.uuid, str);
        if (translated !== str) return translated;
        return str;
    }
}