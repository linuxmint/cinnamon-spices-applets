const { marginBottom5 } = require('./js/ui/styles');
const { BoxLayout } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { UiElement } = require('./js/ui/elements/uiElement');
const { IconTextElementGenerator } = require('./js/ui/elements/iconTextElementGenerator');
const { Translator } = require('./js/translator');

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

    create() {
        const headerLabel = this.elementGenerator.generateLabel(`${ this.translator.translate(this.app.metadata.name) } v${ this.app.metadata.version }`);
        this.actor.add_actor(headerLabel);
    }
}