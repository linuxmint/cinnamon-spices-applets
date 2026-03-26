const { marginBottom5 } = require('./js/ui/styles');
const { BoxLayout } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { UiElement } = require('./js/ui/elements/uiElement');
const { IconTextElementGenerator } = require('./js/ui/elements/iconTextElementGenerator');
const { Translator } = require('./js/translator');

// translations
const UUID = 'moonphase@techi-freki';
const GetText = imports.gettext;
const { get_home_dir } = imports.gi.GLib;
GetText.bindtextdomain(UUID, get_home_dir() + "/.local/share/locale");

class HeaderUi extends UiElement {
    constructor(app) {
        super(app);
        this.actor = new BoxLayout({
            x_align: ActorAlign.CENTER,
            style_class: marginBottom5
        });
        this.elementGenerator = new IconTextElementGenerator();
        this.translator = new Translator(this.app.metadata.uuid);
    }

    _(str) {
        const translated = GetText.dgettext(UUID, str);
        if (translated !== str) return translated;
        return str;
    }

    create() {
        const headerLabel = this.elementGenerator.generateLabel(`${ this._(this.app.metadata.name) } v${ this.app.metadata.version }`);
        this.actor.add_actor(headerLabel);
    }
}