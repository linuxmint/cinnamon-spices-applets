const { DefaultIconSet, AltIconSet } = require('./js/iconSet');
const { Calculator } = require('./js/calc');
const { Translator } = require('./js/translator');

class Moon {
    constructor(app) {
        this.app = app;
        this.calc = new Calculator(app.latitude, app.longitude);
        this.translator = new Translator(this.app.metadata.uuid);
        this.illumination = this.calc.getMoonIllumination();
        this.age = Math.trunc(this.illumination.phaseValue * 28);
        this.iconSet = app.useAltIcons ? new AltIconSet() : new DefaultIconSet();
        this.riseSetTimes = this.calc.getRiseSetTimes();
        this.currentPhaseIcon = this.iconSet.getPhaseIcons()[this.age];
        this.currentPhaseName = this._getCurrentPhaseName();
    }
    _getCurrentPhaseName() {
        let name = "";
        const age = this.age / 28;

        if (age === 0) name = this.translator.translate('New Moon');
        else if (age < 0.25) name = this.translator.translate('Waxing Crescent');
        else if (age === 0.25) name = this.translator.translate('First Quarter');
        else if (age < 0.5) name = this.translator.translate('Waxing Gibbous');
        else if (age === 0.5) name = this.translator.translate('Full Moon');
        else if (age < 0.75) name = this.translator.translate('Waning Gibbous');
        else if (age === 0.75) name = this.translator.translate('Last Quarter');
        else if (age <= 1) name = this.translator.translate('Waning Crescent');
        else name = this.translator.translate('New Moon');

        return name;
    }
}