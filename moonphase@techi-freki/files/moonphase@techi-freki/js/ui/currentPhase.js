const { Align, BoxLayout, IconType, Icon, Label } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { Translator } = require('./js/translator');
const { Compass } = require('./js/compass');

class CurrentPhase {
    constructor (app) {
        this.app = app
        this.translator = new Translator(this.app.metadata.uuid);
    }

    _createActor() {

    }

    _createUiElements(uiData) {
        const headerLabel = new Label({ text: `${ this.translator.translate(uiData.header) } ${ this.app.metadata.version }`, style_class: 'margin-bottom-5, font-20' });
    }
}