const { BoxLayout, Icon, IconType, Label } = imports.gi.St;

class IconTextElementGenerator {
    constructor() {}

    generateElement(iconName, iconSize, layouts, rootStyleClass = '', iconStyleClass = '') {
        const icon = this.generateIcon(iconName, iconSize);
        const root = new BoxLayout({ style_class: rootStyleClass });
        const iconParent = new BoxLayout({ style_class: iconStyleClass });

        iconParent.add(icon);
        root.add(iconParent);

        layouts.forEach((layout) => {
            root.add(layout);
        });

        return root;
    }

    generateLabel(text, styleClass = '') {
        return new Label({ text: text, style_class: styleClass });
    }

    generateIcon(iconName, iconSize) {
        return new Icon({
            icon_name: iconName,
            icon_size: iconSize,
            icon_type: IconType.SYMBOLIC
        });
    }

    generateLayout(labels, vertical, styleClass = '') {
        const parent = new BoxLayout({ vertical: vertical, style_class: styleClass });

        labels.forEach((label) => {
            parent.add(label);
        });

        return parent;
    }
}