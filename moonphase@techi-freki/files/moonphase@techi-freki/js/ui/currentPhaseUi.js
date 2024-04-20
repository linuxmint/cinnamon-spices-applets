const { Align, BoxLayout, IconType, Icon, Label } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { Compass } = require('./js/compass');
const { UiElement } = require('./js/ui/uiElement');

class CurrentPhaseUi extends UiElement {
    constructor (app) {
        super(app);
    }

    create() {
        const parent = new BoxLayout();

        this.actor.add_actor(parent);
    }
}