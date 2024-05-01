const { Translator } = require('./js/translator');
const { IconTextElementGenerator } = require('./js/ui/elements/iconTextElementGenerator');
const { margin5 } = require('./js/ui/styles');
const { UiElement } = require('./js/ui/elements/uiElement');
const { RiseSetElement } = require('./js/ui/elements/riseSetElement');
const { NoRiseSetElement } = require('./js/ui/elements/noRiseSetElement');
const { Align, BoxLayout, Label } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter

class RiseSetUi extends UiElement {
    constructor(app) {
        super(app);
        this.actor = new BoxLayout({
            style_class: margin5,
            x_align: ActorAlign.CENTER,
            y_align: Align.MIDDLE
        });
        this.alwaysUp = this.app.moon.riseSetTimes.alwaysUp;
        this.alwaysDown = this.app.moon.riseSetTimes.alwaysDown;
        this.elementGenerator = new IconTextElementGenerator();
        this.translator = new Translator(this.app.metadata.uuid);
    }

    create() {
        if (!this.app.showRiseSet) return;
        if (this.alwaysUp || this.alwaysDown) {
            this._createNoRiseSetLayout();
        } else {
            this._createStandardLayout();
        }
    }

    _createNoRiseSetLayout() {
        if (this.alwaysUp) {
            this._createNoSetLayout();
        } else if (this.alwaysDown) {
            this._createNoRiseLayout();
        }
    }

    _createNoRiseLayout() {
        const noRiseElement = new NoRiseSetElement(this.app);
        noRiseElement.iconName = this.app.moon.iconSet.noMoonRise;
        noRiseElement.iconSize = 64;
        noRiseElement.label = this.translator.translate('The moon is always down and will not rise today');
        noRiseElement.create();

        this.actor.add_actor(noRiseElement.actor);
    }

    _createNoSetLayout() {
        const noSetElement = new NoRiseSetElement(this.app);
        noSetElement.iconName = this.app.moon.iconSet.noMoonSet;
        noSetElement.iconSize = 64;
        noSetElement.label = this.translator.translate('The moon is always up and will not set today');
        noSetElement.moonRise = false;
        noSetElement.create();

        this.actor.add_actor(noSetElement.actor);
    }

    _createStandardLayout() {
        const riseElement = new RiseSetElement(this.app);
        riseElement.iconName = this.app.moon.iconSet.moonRise;
        riseElement.iconSize = 64;
        riseElement.header = this.translator.translate('Moonrise');
        riseElement.dateObject = this.app.moon.riseSetTimes.rise;
        riseElement.angle = this.app.moon.riseSetTimes.riseAzimuth;

        const transitElement = new RiseSetElement(this.app);
        transitElement.iconName = this.app.moon.iconSet.nightClear;
        transitElement.iconSize = 48;
        transitElement.header = this.translator.translate('Lunar Noon');
        transitElement.dateObject = this.app.moon.riseSetTimes.transit;
        transitElement.angle = this.app.moon.riseSetTimes.transitAzimuth;

        const setElement = new RiseSetElement(this.app);
        setElement.iconName = this.app.moon.iconSet.moonSet;
        setElement.iconSize = 64;
        setElement.header = this.translator.translate('Moonset');
        setElement.dateObject = this.app.moon.riseSetTimes.set;
        setElement.angle = this.app.moon.riseSetTimes.setAzimuth;

        setElement.create();
        transitElement.create();
        riseElement.create();

        const elements = [riseElement, transitElement, setElement];
        const orderedElements = this._orderElementsByDateAsc(elements);

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