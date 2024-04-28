const { BoxLayout, Icon, IconType } = imports.gi.St;
const { UiElement } = require('./js/ui/elements/uiElement');

class IconTextElement extends UiElement {
    constructor(app) {
        super(app);
    }

    create(iconName, iconSize, layouts) {
        const icon = new Icon({
            icon_name: iconName,
            icon_size: iconSize,
            icon_type: IconType.SYMBOLIC
        });
        const root = new BoxLayout({ style_class: 'margin-5' });
        const iconParent = new BoxLayout({ style_class: 'margin-5' });

        iconParent.add(icon);
        root.add(iconParent);

        layouts.forEach((layout) => {
            root.add(layout);
        });

        this.actor.add_actor(root);
    }
}