const { UiElement } = require('./uiElement');
const { BoxLayout } = imports.gi.St;

class MoonTimesUi extends UiElement {
    constructor(app) {
        super(app);
    }

    create() {
        const parent = new BoxLayout({ style_class: 'margin-5' });
        const iconParent = new BoxLayout({ style_class: 'margin-5' });
        const labelParent = new BoxLayout({ vertical: true, style_class: 'padding-top-3' });
        const angleParent = new BoxLayout({ vertical: false, style_class: 'padding-top-5-strict' });

        angleParent.add(this.info.angleDirection);
        angleParent.add(this.info.angleIcon);
        angleParent.add(this.info.angleDegrees);

        iconParent.add(this.icon);

        labelParent.add(this.header);
        labelParent.add(this.info.date);
        labelParent.add(this.info.time);
        labelParent.add(angleParent);

        parent.add(iconParent);
        parent.add(labelParent);

        this.actor.add_actor(parent);
    }

    rebuild() {
        this.destroy();
        this.create();
    }
}