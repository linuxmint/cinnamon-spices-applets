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

        const riseElement = new RiseSetElement(this.app);
        riseElement.iconName = this.app.moon.iconSet.moonRise;
        riseElement.iconSize = 64;
        riseElement.header = 'Moonrise';
        riseElement.dateObject = this.app.moon.riseSetTimes.rise;
        riseElement.date = riseElement.dateObject.toLocaleDateString();
        riseElement.time = riseElement.dateObject.toLocaleTimeString();
        riseElement.angle = this.app.moon.riseSetTimes.riseAzimuth;

        const transitElement = new RiseSetElement(this.app);
        transitElement.iconName = this.app.moon.iconSet.nightClear;
        transitElement.iconSize = 48;
        transitElement.header = 'Lunar Noon';
        transitElement.dateObject = this.app.moon.riseSetTimes.transit;
        transitElement.date = transitElement.dateObject.toLocaleDateString();
        transitElement.time = transitElement.dateObject.toLocaleTimeString();
        transitElement.angle = this.app.moon.riseSetTimes.transitAzimuth;

        const setElement = new RiseSetElement(this.app);
        setElement.iconName = this.app.moon.iconSet.moonSet;
        setElement.iconSize = 64;
        setElement.header = 'Moonset';
        setElement.dateObject = this.app.moon.riseSetTimes.set;
        setElement.date = setElement.dateObject.toLocaleDateString();
        setElement.time = setElement.dateObject.toLocaleTimeString();
        setElement.angle = this.app.moon.riseSetTimes.setAzimuth;

        setElement.create();
        transitElement.create();
        riseElement.create();

        const elements = [riseElement, transitElement, setElement];
        const orderedElements = this._orderElementsByDateAsc(elements);

        // TODO: remove dates from the past and add upcoming dates

        orderedElements.forEach((element) => {
            this.actor.add_actor(element.actor);
        });
    }

    _orderElementsByDateAsc(elements) {
        return elements.sort((a, b) => {
            return a.dateObject - b.dateObject;
        });
    }
}