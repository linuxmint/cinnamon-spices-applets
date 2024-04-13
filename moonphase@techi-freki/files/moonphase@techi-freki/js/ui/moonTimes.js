const { Align, BoxLayout, IconType, Icon, Label } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { Translator } = require('./js/translator');
const { TimeBox } = require('./js/ui/timeBox');

class MoonTimes {
    constructor(app) {
        this.app = app;
        this.translator = new Translator(this.app.metadata.uuid);
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

        const headerLabel = new Label({ text: this.translator.translate(header), style_class: 'margin-bottom-5' });
        const dateLabel = new Label({ text: info.date });
        const timeLabel = new Label({ text: info.time });
        const angleDegrees = new Label();
        const angleDirection = new Label();
        const angleIcon = this._createDirectionIcon(info.angle);

        if (info.showAngle) {
            angleDegrees.set_text(`(${Math.floor(info.angle * 100) / 100}°)`);
            angleDirection.set_text(this._degreesToDirection(info.angle));
        }

        return new TimeBox(mainIcon, headerLabel, {
            date: dateLabel,
            time: timeLabel,
            angleDegrees: angleDegrees,
            angleDirection: angleDirection,
            angleIcon: angleIcon
        }).actor;
    }

    _createRiseUi() {
        return this._createUiElements('moonrise-symbolic',
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
        return this._createUiElements('night-clear-symbolic',
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
        return this._createUiElements('moonset-symbolic',
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

    _createDirectionIcon(degrees) {
        // TODO: This isn't working
        let degreeIconName = '';

        switch (degrees) {
            case degrees <= 22.5:
                degreeIconName = 'direction-up-symbolic';
                break;
            case degrees <= 67.5:
                degreeIconName = 'direction-up-right-symbolic';
                break;
            case degrees <= 112.5:
                degreeIconName = 'direction-right-symbolic';
                break;
            case degrees <= 157.5:
                degreeIconName = 'direction-down-right-symbolic';
                break;
            case degrees <= 202.5:
                degreeIconName = 'direction-down-symbolic';
                break;
            case degrees <= 247.5:
                degreeIconName = 'direction-down-left-symbolic';
                break;
            case degrees <= 292.5:
                degreeIconName = 'direction-left-symbolic';
                break;
            case degrees <= 337.5:
                degreeIconName = 'direction-up-left-symbolic';
                break;
            default:
                degreeIconName = 'direction-up-symbolic';
                break;
        }

        return new Icon({
            icon_name: degreeIconName,
            icon_size: 18,
            icon_type: IconType.SYMBOLIC
        });
    }

    _degreesToDirection(degrees) {
        // TODO: This isn't working
        let direction = ''

        switch (degrees) {
            case degrees <= 22.5:
                direction = 'North';
                break;
            case degrees <= 67.5:
                direction = 'North East';
                break;
            case degrees <= 112.5:
                direction = 'East';
                break;
            case degrees <= 157.5:
                direction = 'South East';
                break;
            case degrees <= 202.5:
                direction = 'South';
                break;
            case degrees <= 247.5:
                direction = 'South West';
                break;
            case degrees <= 292.5:
                direction = 'West';
                break;
            case degrees <= 337.5:
                direction = 'North West';
                break;
            default:
                direction = 'North';
                break;
        }

        return direction;
    }
}