const { Align, BoxLayout } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { UiElement } = require('./js/ui/elements/uiElement');
const { ElementGenerator } = require('./js/ui/elements/elementGenerator');

class CurrentPhaseUi extends UiElement {
    constructor (app) {
        super(app);
        this.actor = new BoxLayout({
            style_class: 'padding-15',
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE
        });
        this.elementGenerator = new ElementGenerator();
    }

    create() {
        const illumLabel = this.elementGenerator.generateLabel(`${ Math.floor(this.app.moon.illumination.fraction * 100 * 100) / 100 }%`);
        const illumLayout = this.elementGenerator.generateLayout([illumLabel], false, 'padding-top-5-strict');

        const phaseLabel = this.elementGenerator.generateLabel(this.app.moon.currentPhaseName, 'margin-bottom-5');
        const dateLabel = this.elementGenerator.generateLabel(new Date().toLocaleDateString());
        const timeLabel = this.elementGenerator.generateLabel(new Date().toLocaleTimeString());
        const infoLayout = this.elementGenerator.generateLayout([phaseLabel, dateLabel, timeLabel, illumLayout], true, 'margin-5; text-align-left');

        this.actor.add_actor(this.elementGenerator.generateElement(this.app.moon.currentPhaseIcon, 64, [infoLayout], 'margin-5'));
    }
}