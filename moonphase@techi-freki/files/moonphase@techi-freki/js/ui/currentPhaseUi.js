const { paddingTop5Strict, margin5, textAlignLeft } = require('./js/ui/styles');
const { Align, BoxLayout } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { UiElement } = require('./js/ui/elements/uiElement');
const { IconTextElementGenerator } = require('./js/ui/elements/iconTextElementGenerator');

// translations
const UUID = 'moonphase@techi-freki';
const GetText = imports.gettext;
const { get_home_dir } = imports.gi.GLib;
GetText.bindtextdomain(UUID, get_home_dir() + "/.local/share/locale");

class CurrentPhaseUi extends UiElement {
    constructor (app) {
        super(app);
        this.actor = new BoxLayout({
            style_class: margin5,
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE
        });
        this.elementGenerator = new IconTextElementGenerator();
    }

    _(str) {
        const translated = GetText.dgettext(UUID, str);
        if (translated !== str) return translated;
        return str;
    }

    create() {
        if (!this.app.showCurrentPhaseInfo) return;
        const illumLabel = this.elementGenerator.generateLabel(`${ Math.floor(this.app.moon.illumination.fraction * 100 * 100) / 100 }% ` + this._('illumination'));
        const illumLayout = this.elementGenerator.generateLayout([illumLabel], false);

        const phaseLabel = this.elementGenerator.generateLabel(this.app.moon.currentPhaseName);
        const dateLabel = this.elementGenerator.generateLabel(new Date().toLocaleDateString(), paddingTop5Strict);
        const timeLabel = this.elementGenerator.generateLabel(new Date().toLocaleTimeString());
        const infoLayout = this.elementGenerator.generateLayout([phaseLabel, illumLayout, dateLabel, timeLabel], true, `${ margin5 };${ textAlignLeft }`);

        this.actor.add_actor(this.elementGenerator.generateElement(this.app.moon.currentPhaseIcon, 80, [infoLayout], margin5));
    }
}