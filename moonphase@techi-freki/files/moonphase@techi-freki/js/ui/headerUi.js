const { BoxLayout } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { UiElement } = require('./js/ui/elements/uiElement');
const { IconTextElementGenerator } = require('./js/ui/elements/iconTextElementGenerator');

class HeaderUi extends UiElement {
    constructor(app) {
        super(app);
        this.actor = new BoxLayout({
            x_align: ActorAlign.CENTER,
            style_class: 'margin-bottom-5'
        });
        this.elementGenerator = new IconTextElementGenerator();
    }

    create() {
        const headerLabel = this.elementGenerator.generateLabel(`${ this.app.metadata.name } v${ this.app.metadata.version }`);
        this.actor.add_actor(headerLabel);
    }
}