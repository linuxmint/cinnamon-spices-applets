const { BaseUi } = require('./baseUi');
const { Label } = imports.gi.St;

class LabelUi extends BaseUi {
    constructor(text, style = null) {
        super();

        this.text = text;
        this.styles = style;
    }

    create() {
        return new Label({
            text: this.text,
            style: this.styles
        });
    }
}