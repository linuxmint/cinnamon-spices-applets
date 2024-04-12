const { Align, BoxLayout, IconType, Icon, Label } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;
const { Translator } = require('./js/translator');

class MoonTimes {
    constructor(app) {
        this.app = app;
        this.translator = new Translator(this.app.metadata.uuid);
        this.textOptions = {
            x_fill: true,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        };
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

    _createUiBox(icon = null, upperLabel = null, lowerLabel = null) {
        const layout = new BoxLayout();

        if (upperLabel) layout.add(upperLabel, this.textOptions);
        if (icon) layout.add(icon);
        if (lowerLabel) layout.add(lowerLabel, this.textOptions);

        return layout;
    }

    _createUiElements(icon_name, icon_type, icon_size, upperText, lowerText) {
        const icon = new Icon({
            icon_name,
            icon_type,
            icon_size
        });

        const upperLabel = new Label({ text: this.translator.translate(upperText) });
        const lowerLabel = new Label({ text: lowerText });

        return this._createUiBox(icon, upperLabel, lowerLabel);
    }

    _createRiseUi() {
        return this._createUiElements('moonrise-symbolic',
            IconType.SYMBOLIC,
            64,
            'Rise',
            `${this.app.moon.riseSetTimes.rise.toLocaleDateString()} ${this.app.moon.riseSetTimes.rise.toLocaleTimeString()}`);
    }

    _createTransitUi() {
        return this._createUiElements('night-clear-symbolic',
            IconType.SYMBOLIC,
            50,
            'Transit',
            `${this.app.moon.riseSetTimes.transit.toLocaleDateString()} ${this.app.moon.riseSetTimes.transit.toLocaleTimeString()}`);
    }

    _createSetUi() {
        return this._createUiElements('moonset-symbolic',
            IconType.SYMBOLIC,
            64,
            'Set',
            `${this.app.moon.riseSetTimes.set.toLocaleDateString()} ${this.app.moon.riseSetTimes.set.toLocaleTimeString()}`);
    }
}