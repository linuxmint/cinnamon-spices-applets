const { paddingTop5Strict, margin5, textAlignLeft, padding15 } = require('./js/ui/styles');
const { Align, BoxLayout } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { UiElement } = require('./js/ui/elements/uiElement');
const { IconTextElementGenerator } = require('./js/ui/elements/iconTextElementGenerator');

class CurrentPhaseUi extends UiElement {
    constructor (app) {
        super(app);
        this.actor = new BoxLayout({
            style_class: padding15,
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE
        });
        this.elementGenerator = new IconTextElementGenerator();
    }

    create() {
        const illumLabel = this.elementGenerator.generateLabel(`${ Math.floor(this.app.moon.illumination.fraction * 100 * 100) / 100 }%`);
        const illumLayout = this.elementGenerator.generateLayout([illumLabel], false, paddingTop5Strict);

        const phaseLabel = this.elementGenerator.generateLabel(this.app.moon.currentPhaseName, margin5);
        const dateLabel = this.elementGenerator.generateLabel(new Date().toLocaleDateString());
        const timeLabel = this.elementGenerator.generateLabel(new Date().toLocaleTimeString());
        const infoLayout = this.elementGenerator.generateLayout([phaseLabel, dateLabel, timeLabel, illumLayout], true, `${ margin5 };${ textAlignLeft }`);

        this.actor.add_actor(this.elementGenerator.generateElement(this.app.moon.currentPhaseIcon, 64, [infoLayout], margin5));
    }
}