const { Compass } = require('./js/compass');
const { Translator } = require('./js/translator');
const { UiElement } = require('./js/ui/uiElement');
const { Align, BoxLayout, Icon, IconType, Label } = imports.gi.St;

class MoonTimesUi extends UiElement {
    constructor(app) {
        super(app);
        this.compass = new Compass(this.app);
    }

    create() {
        // const parent = new BoxLayout({ style_class: 'margin-5' });
        // const iconParent = new BoxLayout({ style_class: 'margin-5' });
        // const labelParent = new BoxLayout({ vertical: true, style_class: 'padding-top-3' });
        // const angleParent = new BoxLayout({ vertical: false, style_class: 'padding-top-5-strict' });
        //
        // angleParent.add(this.info.angleDirection);
        // angleParent.add(this.info.angleIcon);
        // angleParent.add(this.info.angleDegrees);
        //
        // iconParent.add(this.icon);
        //
        // labelParent.add(this.header);
        // labelParent.add(this.info.date);
        // labelParent.add(this.info.time);
        // labelParent.add(angleParent);
        //
        // parent.add(iconParent);
        // parent.add(labelParent);
        //
        // this.actor.add_actor(parent);

        const riseUiElement = this._createRiseSetElement(
            this.app.moon.iconSet.moonRise,
            IconType.SYMBOLIC,
            64,
            'Moonrise',
            {
                date: this.app.moon.riseSetTimes.rise.toLocaleDateString(),
                time: this.app.moon.riseSetTimes.rise.toLocaleTimeString(),
                angle: this.app.moon.riseSetTimes.riseAzimuth
            }
        );

        const lunarNoonElement = this._createRiseSetElement(
            this.app.moon.iconSet.nightClear,
            IconType.SYMBOLIC,
            48,
            'Lunar Noon',
            {
                date: this.app.moon.riseSetTimes.transit.toLocaleDateString(),
                time: this.app.moon.riseSetTimes.transit.toLocaleTimeString(),
                angle: this.app.moon.riseSetTimes.transitAzimuth
            }
        );

        const setUiElement = this._createRiseSetElement(
            this.app.moon.iconSet.moonSet,
            IconType.SYMBOLIC,
            64,
            'Moonset',
            {
                date: this.app.moon.riseSetTimes.set.toLocaleDateString(),
                time: this.app.moon.riseSetTimes.set.toLocaleTimeString(),
                angle: this.app.moon.riseSetTimes.setAzimuth
            }
        );
    }

    rebuild() {
        this.destroy();
        this.create();
    }

    _createRiseSetElement(icon_name, icon_type, icon_size, header, info) {
        const mainIcon = new Icon({
            icon_name,
            icon_type,
            icon_size
        });

        const direction = this.compass.getCardinalDirection(info.angle);

        const headerLabel = new Label({ text: this.translator.translate(header), style_class: 'margin-bottom-5' });
        const dateLabel = new Label({ text: info.date });
        const timeLabel = new Label({ text: info.time });
        const angleDegrees = new Label();
        const angleDirection = new Label();
        const angleIcon = new Icon({
            icon_name: direction.icon_name,
            icon_type: IconType.SYMBOLIC,
            icon_size: 18
        });
        const parent = new BoxLayout();
        parent.add(headerLabel);
        parent.add(dateLabel);
        parent.add(timeLabel);

        if (info.showAngle) {
            angleDegrees.set_text(`(${Math.floor(info.angle)}°)`);
            angleDirection.set_text(this.translator.translate(direction.name));

            const angleParent = new BoxLayout();
            angleParent.add(angleDirection);
            angleParent.add(angleIcon);
            angleParent.add(angleDegrees);
            parent.add(angleParent);
        }

        return parent;
    }
}