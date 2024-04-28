const { UiElement } = require('./js/ui/elements/uiElement');

class NoRiseSetElement extends UiElement {
    constructor(app) {
        super(app);
    }

    create() {
        throw new Error('Not implemented');
    }
}