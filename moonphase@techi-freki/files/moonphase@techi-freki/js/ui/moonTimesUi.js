const { UiBase } = require('./js/ui/uiBase');

const { BoxLayout, IconType, Label, Icon, Align } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;

class MoonTimesUi extends UiBase {
    constructor(app) {
        super(app);
    }

    create() {
        const uiObjects = this._buildElements();

        uiObjects.moonRiseBox.add(uiObjects.moonRiseIcon);
        uiObjects.moonRiseBox.add(uiObjects.moonRiseLabel, uiObjects.textOptions);

        uiObjects.moonTransitBox.add(uiObjects.moonTransitIcon);
        uiObjects.moonTransitBox.add(uiObjects.moonTransitLabel, uiObjects.textOptions);

        uiObjects.moonSetBox.add(uiObjects.moonSetIcon);
        uiObjects.moonSetBox.add(uiObjects.moonSetLabel, uiObjects.textOptions);

        uiObjects.moonTimesBox.add_actor(uiObjects.moonRiseBox);
        uiObjects.moonTimesBox.add_actor(uiObjects.moonTransitBox);
        uiObjects.moonTimesBox.add_actor(uiObjects.moonSetBox);

        this.actor = uiObjects.moonTimesBox;
        return this.actor;
    }

    _buildElements() {
        const spacer = new Label({ text: '&nbsp;' });
        const moonTimesBox = new BoxLayout({
            style_class: 'padded-box',
            x_align: ActorAlign.CENTER,
            x_expand: true,
            y_expand: true
        });
        const moonRiseBox = new BoxLayout();
        const moonTransitBox = new BoxLayout();
        const moonSetBox = new BoxLayout();
        const moonRiseIcon = new Icon({
            icon_name: 'moonrise-symbolic',
            icon_type: IconType.SYMBOLIC,
            icon_size: 64,
            style: ''
        });
        const moonTransitIcon = new Icon({
            icon_name: 'night-clear-symbolic',
            icon_type: IconType.SYMBOLIC,
            icon_size: 54,
            style: ''
        });
        const moonSetIcon = new Icon({
            icon_name: 'moonset-symbolic',
            icon_type: IconType.SYMBOLIC,
            icon_size: 64,
            style: ''
        });
        const textOptions = {
            x_fill: true,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        };
        const moonRiseLabel = new Label({ text: 'Rise', style: '' });
        const moonTransitLabel = new Label({ text: 'Transit', style: '' });
        const moonSetLabel = new Label({ text: 'Set', style: '' });

        return {
            moonTimesBox,
            moonRiseBox,
            moonTransitBox,
            moonSetBox,
            moonRiseIcon,
            moonTransitIcon,
            moonSetIcon,
            textOptions,
            moonRiseLabel,
            moonTransitLabel,
            moonSetLabel
        };
    }
}