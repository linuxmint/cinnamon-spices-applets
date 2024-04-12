const { BaseUi } = require('./baseUi');
const { Icon } = imports.gi.St;

class IconUi extends BaseUi {
    constructor(name, type, size, styles) {
        super();

        this.name = name;
        this.type = type;
        this.size = size;
        this.styles = styles;
    }

    create() {
        return new Icon({
            icon_name: this.name,
            icon_type: this.type,
            icon_size: this.size,
            style: this.styles
        });
    }
}