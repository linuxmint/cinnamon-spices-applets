const { IconType } = imports.gi.St;
const { IconLabel } = require('./iconLabel');
const { BaseUi } = require('./components/baseUi');
const { Translator } = require('./js/translator');

class MoonTimes extends UiBase {
    constructor(app) {
        super(app);
        const translator = new Translator(app.uuid);
        this.riseUi = new IconLabel(
            'moonrise-symbolic',
            IconType.SYMBOLIC,
            64,
            translator.translate('Rise'),
            `${app.moon.rise.toLocaleDateString()} ${app.moon.riseSetTimes.rise.toLocaleTimeString()}`
        ).create();
        this.transitUi = new IconLabel(
            'night-clear-symbolic',
            IconType.SYMBOLIC,
            64,
            translator.translate('Transit'),
            `${app.moon.transit.toLocaleDateString()} ${app.moon.riseSetTimes.transit.toLocaleTimeString()}`
        ).create();
        this.setUi = new IconLabel(
            'moonset-symbolic',
            IconType.SYMBOLIC,
            64,
            translator.translate('Set'),
            `${app.moon.set.toLocaleDateString()} ${app.moon.toLocaleTimeString()}`
        ).create();
    }

    create() {
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
}