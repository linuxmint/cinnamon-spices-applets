const { BoxLayout, IconType, Label, Icon, Align } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;

class IconLabel {
    constructor(iconName, iconType, iconSize, topLabelText = null, bottomLabelText = null, iconStyle = null, labelStyle = null, layoutClass = null) {
        this.iconName = iconName;
        this.iconSize = iconSize;
        this.topLabelText = topLabelText;
        this.bottomLabelText = bottomLabelText;
        this.iconStyle = iconStyle;
        this.labelStyle = labelStyle;
        this.layoutClass = layoutClass;
        this.textOptions = {
            x_file: true,
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        };
    }

    create() {
        const layout = new BoxLayout({ style_class: this.layoutClass });
        layout.add(this._createLabel(this.topLabelText, this.labelStyle), this.textOptions);
        layout.add(this._createIcon());
        layout.add(this._createLabel(this.bottomLabelText, this.labelStyle), this.textOptions);

        return layout;
    }

    _createIcon() {
        return new Icon({
            icon_name: this.iconName,
            icon_type: IconType.SYMBOLIC,
            icon_size: this.iconSize,
            style: this.iconStyle
        });
    }

    _createLabel(text, style) {
        return new Label({
            text: text,
            style: style,
        });
    }
}