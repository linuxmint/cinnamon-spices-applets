const { Align, BoxLayout, IconType, Icon, Label } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { Translator } = require('./js/translator');
const { TimeBox } = require('./js/ui/timeBox');
const { Compass } = require('./js/compass');

class MoonTimes {
    // TODO: Handle alwaysUp and alwaysDown on the gui
    constructor(app) {
        this.app = app;
        this.translator = new Translator(this.app.metadata.uuid);
        this.compass = new Compass(this.app);
        this.riseUi = this._createRiseUi();
        this.transitUi = this._createTransitUi();
        this.setUi = this._createSetUi();
        this.actor = this._createActor();
    }

    _createActor() {
        const moonTimesBox = new BoxLayout({
            style_class: 'padding-15',
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE
        });

        moonTimesBox.add_actor(this.riseUi);
        moonTimesBox.add_actor(this.transitUi);
        moonTimesBox.add_actor(this.setUi);

        return moonTimesBox;
    }

    _createUiElements(icon_name, icon_type, icon_size, header, info) {
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

        if (info.showAngle) {
            angleDegrees.set_text(`(${Math.floor(info.angle)}°)`);
            angleDirection.set_text(this.translator.translate(direction.name));
        }

        return new TimeBox(mainIcon, headerLabel, {
            date: dateLabel,
            time: timeLabel,
            angleDegrees,
            angleDirection,
            angleIcon
        }).actor;
    }

    _createRiseUi() {
        return this._createUiElements(this.app.moon.iconSet.moonRise,
            IconType.SYMBOLIC,
            64,
            'Moonrise',
            {
                date: this.app.moon.riseSetTimes.rise.toLocaleDateString(),
                time: this.app.moon.riseSetTimes.rise.toLocaleTimeString(),
                showAngle: true,
                angle: this.app.moon.riseSetTimes.riseAzimuth
            });
    }

    _createTransitUi() {
        return this._createUiElements(this.app.moon.iconSet.nightClear,
            IconType.SYMBOLIC,
            48,
            'Moon transit',
            {
                date: this.app.moon.riseSetTimes.transit.toLocaleDateString(),
                time: this.app.moon.riseSetTimes.transit.toLocaleTimeString(),
                showAngle: true,
                angle: this.app.moon.riseSetTimes.transitAzimuth
            });
    }

    _createSetUi() {
        return this._createUiElements(this.app.moon.iconSet.moonSet,
            IconType.SYMBOLIC,
            64,
            'Moonset',
            {
                date: this.app.moon.riseSetTimes.set.toLocaleDateString(),
                time: this.app.moon.riseSetTimes.set.toLocaleTimeString(),
                showAngle: true,
                angle: this.app.moon.riseSetTimes.setAzimuth
            });
    }
}