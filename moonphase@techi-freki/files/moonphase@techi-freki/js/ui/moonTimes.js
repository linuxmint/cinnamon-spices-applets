const { Align, BoxLayout, IconType, Icon, Label } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { Translator } = require('./js/translator');
const { TimeBox } = require('./js/ui/timeBox');

class MoonTimes {
    constructor(app) {
        this.app = app;
        this.translator = new Translator(this.app.metadata.uuid);

        // TODO: Fix time formating for international with Luxon?
        this.riseUi = this._createRiseUi();
        this.transitUi = this._createTransitUi();
        this.setUi = this._createSetUi();
        this.actor = this._createActor();
    }

    _createActor() {
        const moonTimesBox = new BoxLayout({
            style_class: 'padded-box',
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE,
            x_expand: true,
            y_expand: true
        });

        moonTimesBox.add_actor(this.riseUi);
        moonTimesBox.add_actor(this.transitUi);
        moonTimesBox.add_actor(this.setUi);

        return moonTimesBox;
    }

    _createUiElements(icon_name, icon_type, icon_size, header, info) {
        const icon = new Icon({
            icon_name,
            icon_type,
            icon_size
        });

        const headerLabel = new Label({ text: this.translator.translate(header), style: 'text-align: center' });
        const dateLabel = new Label({ text: info.date });
        const timeLabel = new Label({ text: info.time });

        return new TimeBox(icon, headerLabel, { date: dateLabel, time: timeLabel }).actor;
    }

    _createRiseUi() {
        return this._createUiElements('moonrise-symbolic',
            IconType.SYMBOLIC,
            64,
            'Moon rising time',
            {
                date: this.app.moon.riseSetTimes.rise.toLocaleDateString(),
                time: this.app.moon.riseSetTimes.rise.toLocaleTimeString()
            });
    }

    _createTransitUi() {
        return this._createUiElements('night-clear-symbolic',
            IconType.SYMBOLIC,
            64,
            'Moon transit time',
            {
                date: this.app.moon.riseSetTimes.transit.toLocaleDateString(),
                time: this.app.moon.riseSetTimes.transit.toLocaleTimeString()
            });
    }

    _createSetUi() {
        return this._createUiElements('moonset-symbolic',
            IconType.SYMBOLIC,
            64,
            'Moon setting time',
            {
                date: this.app.moon.riseSetTimes.set.toLocaleDateString(),
                time: this.app.moon.riseSetTimes.set.toLocaleTimeString()
            });
    }
}