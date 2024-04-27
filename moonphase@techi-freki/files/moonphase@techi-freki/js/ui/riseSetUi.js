const { UiElement } = require('./js/ui/elements/uiElement');
const { RiseSetElement } = require('./js/ui/elements/riseSetElement');
const { Align, BoxLayout } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;

class RiseSetUi extends UiElement {
    constructor(app) {
        super(app);
        this.actor = new BoxLayout({
            style_class: 'padding-15',
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE
        });
    }

    create() {
        // TODO: Handle alwaysUp, alwaysDown
        // TODO: Handle whether rise and set times are to be displayed
        // TODO: Handle order of rise, set and transit boxes

        const riseElement = new RiseSetElement(this.app);
        riseElement.iconName = this.app.moon.iconSet.moonRise;
        riseElement.iconSize = 64;
        riseElement.header = 'Moonrise';
        riseElement.date = this.app.moon.riseSetTimes.rise.toLocaleDateString();
        riseElement.time = this.app.moon.riseSetTimes.rise.toLocaleTimeString();
        riseElement.angle = this.app.moon.riseSetTimes.riseAzimuth;

        const transitElement = new RiseSetElement(this.app);
        transitElement.iconName = this.app.moon.iconSet.nightClear;
        transitElement.iconSize = 48;
        transitElement.header = 'Lunar Noon';
        transitElement.date = this.app.moon.riseSetTimes.transit.toLocaleDateString();
        transitElement.time = this.app.moon.riseSetTimes.transit.toLocaleTimeString();
        transitElement.angle = this.app.moon.riseSetTimes.transitAzimuth;

        const setElement = new RiseSetElement(this.app);
        setElement.iconName = this.app.moon.iconSet.moonSet;
        setElement.iconSize = 64;
        setElement.header = 'Moonset';
        setElement.date = this.app.moon.riseSetTimes.set.toLocaleDateString();
        setElement.time = this.app.moon.riseSetTimes.set.toLocaleTimeString();
        setElement.angle = this.app.moon.riseSetTimes.setAzimuth;

        setElement.create();
        transitElement.create();
        riseElement.create();

        // TODO: Handle element order depending on time

        this.actor.add_actor(riseElement.actor);
        this.actor.add_actor(transitElement.actor);
        this.actor.add_actor(setElement.actor);
    }
}