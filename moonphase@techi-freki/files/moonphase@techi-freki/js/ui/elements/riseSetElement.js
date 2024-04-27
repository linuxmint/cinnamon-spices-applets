const { BoxLayout, Icon, IconType, Label } = imports.gi.St;
const { UiElement } = require('./js/ui/elements/uiElement');
const { Compass } = require('./js/compass');

class RiseSetElement extends UiElement {
    constructor(app) {
        super(app);
        this.compass = new Compass(this.app);
        this.iconName = null;
        this.iconType = IconType.SYMBOLIC;
        this.iconSize = 0;
        this.header = null;
        this.dateObject = null;
        this.date = null;
        this.time = null;
        this.angle = 0;

    }

    create() {
        const root = new BoxLayout({ style_class: 'margin-5' });
        const direction = this.compass.getCardinalDirection(this.angle);
        const iconParent = new BoxLayout({ style_class: 'margin-5' });
        const dateTimeParent = new BoxLayout({ vertical: true, style_class: 'padding-top-3' });
        const angleParent = new BoxLayout({ vertical: false, style_class: 'padding-top-5-strict' });
        const mainIcon = new Icon({
            icon_name: this.iconName,
            icon_type: this.iconType,
            icon_size: this.iconSize
        });

        angleParent.add(new Label({ text: direction.name }));
        angleParent.add(new Icon({ icon_name : direction.icon_name, icon_type: IconType.SYMBOLIC, icon_size: 18 }));
        angleParent.add(new Label({ text: `(${Math.floor(this.angle)}°)` }));

        iconParent.add(mainIcon);

        dateTimeParent.add(new Label({ text: this.header, style_class: 'margin-bottom-5' }));
        dateTimeParent.add(new Label({ text: this.date }));
        dateTimeParent.add(new Label({ text: this.time }));
        dateTimeParent.add(angleParent);

        root.add(iconParent);
        root.add(dateTimeParent);

        this.actor.add_actor(root);
    }
}