const { margin5 } = require('./js/ui/styles');
const { UiElement } = require('./js/ui/elements/uiElement');
const { RiseSetElement } = require('./js/ui/elements/riseSetElement');
const { Align, BoxLayout } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;

class RiseSetUi extends UiElement {
    constructor(app) {
        super(app);
        this.actor = new BoxLayout({
            style_class: margin5,
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE
        });
    }

    create() {
        const alwaysUp = this.app.moon.riseSetTimes.alwaysUp;
        const alwaysDown = this.app.moon.riseSetTimes.alwaysDown;

        if (alwaysUp || alwaysDown) {
            this._createNoRiseSetLayout();
        } else {
            this._createStandardLayout();
        }
    }

    _createNoRiseSetLayout() {

    }

    _createStandardLayout() {
        // TODO: Handle alwaysUp, alwaysDown
        // TODO: Handle whether rise and set times are to be displayed

        const riseElement = new RiseSetElement(this.app);
        riseElement.iconName = this.app.moon.iconSet.moonRise;
        riseElement.iconSize = 64;
        riseElement.header = 'Moonrise';
        riseElement.dateObject = this.app.moon.riseSetTimes.rise;
        riseElement.angle = this.app.moon.riseSetTimes.riseAzimuth;

        const transitElement = new RiseSetElement(this.app);
        transitElement.iconName = this.app.moon.iconSet.nightClear;
        transitElement.iconSize = 48;
        transitElement.header = 'Lunar Noon';
        transitElement.dateObject = this.app.moon.riseSetTimes.transit;
        transitElement.angle = this.app.moon.riseSetTimes.transitAzimuth;

        const setElement = new RiseSetElement(this.app);
        setElement.iconName = this.app.moon.iconSet.moonSet;
        setElement.iconSize = 64;
        setElement.header = 'Moonset';
        setElement.dateObject = this.app.moon.riseSetTimes.set;
        setElement.angle = this.app.moon.riseSetTimes.setAzimuth;

        setElement.create();
        transitElement.create();
        riseElement.create();

        const elements = [riseElement, transitElement, setElement];
        const orderedElements = this._orderElementsByDateAsc(elements);

        // TODO: remove dates from the past and add upcoming dates?

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