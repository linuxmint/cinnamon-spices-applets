const { BoxLayout, Label, Align } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { UiElement } = require('./js/ui/elements/uiElement');

class HeaderUi extends UiElement {
    constructor(app) {
        super(app);
        this.actor = new BoxLayout({
            x_align: ActorAlign.CENTER,
            style_class: 'margin-bottom-15'
        });
    }

    create() {
        const headerLabel = new Label({ text: `${ this.app.metadata.name } v${ this.app.metadata.version }`})
        this.actor.add_actor(headerLabel);
    }
}