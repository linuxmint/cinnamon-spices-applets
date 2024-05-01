const { margin5 } = require('./js/ui/styles');
const { IconTextElementGenerator } = require('./js/ui/elements/iconTextElementGenerator');
const { UiElement } = require('./js/ui/elements/uiElement');
const { RiseSetElement } = require('./js/ui/elements/riseSetElement');
const { Calculator } = require('./js/calc');
const { Translator } = require('./js/translator');

class NoRiseSetElement extends UiElement {
    constructor(app) {
        super(app);

        const calc = new Calculator(this.app.latitude, this.app.longitude, this._addDays(new Date(), 1));

        this.elementGenerator = new IconTextElementGenerator();
        this.label = '';
        this.iconName = '';
        this.iconSize = 0;
        this.moonRise = true;
        this.tomorrowsRiseSet = calc.getRiseSetTimes();
        this.translator = new Translator(app.metadata.uuid);
    }

    create() {
        const icon = this.elementGenerator.generateIcon(this.iconName, this.iconSize);
        const label = this.elementGenerator.generateLabel(this.label, margin5);
        const layout = this.elementGenerator.generateLayout([icon, label], true, margin5);
        const rootLayout = this.elementGenerator.generateLayout([layout, this.moonRise ? this._createRiseElement() : this._createSetElement()], false, margin5);

        this.actor.add_actor(rootLayout);
    }

    _addDays(date, days) {
        return new Date(date).setDate(date.getDate() + days);
    }

    _createRiseElement() {
        const riseElement = new RiseSetElement(this.app);
        riseElement.iconName = this.app.moon.iconSet.moonRise;
        riseElement.iconSize = 64;
        riseElement.header = this.translator.translate('Next Moonrise');
        riseElement.dateObject = this.tomorrowsRiseSet.rise;
        riseElement.angle = this.tomorrowsRiseSet.riseAzimuth;
        riseElement.create();

        return riseElement.actor;
    }

    _createSetElement() {
        const setElement = new RiseSetElement(this.app);
        setElement.iconName = this.app.moon.iconSet.moonSet;
        setElement.iconSize = 64;
        setElement.header = this.translator.translate('Next Moonset');
        setElement.dateObject = this.tomorrowsRiseSet.set;
        setElement.angle = this.tomorrowsRiseSet.setAzimuth;
        setElement.create();

        return setElement.actor;
    }
}