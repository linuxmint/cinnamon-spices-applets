const { DefaultIconSet, AltIconSet } = require('./js/iconSet');
const { Calculator } = require('./js/calc');
const { Translator } = require('./js/translator');

class Moon {
    constructor(app) {
        this.translator = new Translator(app.metadata.uuid);
        this.calc = new Calculator(app.latitude, app.longitude);
        this.illumination = this.calc.getMoonIllumination();
        this.riseSetTimes = this.calc.getRiseSetTimes();
        this.age = Math.trunc(this.illumination.phaseValue * 28);
        this.iconSet = app.useAltIcons ? new AltIconSet().getSet() : new DefaultIconSet().getSet();
        this.currentPhaseIcon = this.iconSet[this.age];
        this.currentPhaseName = this._getCurrentPhaseName(app.showNameLabel, app.showPercentageLabel);
        this.currentTooltip = this._getCurrentPhaseName(app.showNameTooltip, app.showPercentageTooltip);
    }
    _getCurrentPhaseName(showName = true, showPercentage = true) {
        let name = "";
        const age = this.age / 28;
        const percent = `${ Math.floor((this.illumination.fraction * 100) * 100) / 100 }%`;

        if (age === 0) name = this.translator.translate('New Moon');
        else if (age < 0.25) name = this.translator.translate('Waxing Crescent');
        else if (age === 0.25) name = this.translator.translate('First Quarter');
        else if (age < 0.5) name = this.translator.translate('Waxing Gibbous');
        else if (age === 0.5) name = this.translator.translate('Full Moon');
        else if (age < 0.75) name = this.translator.translate('Waning Gibbous');
        else if (age === 0.75) name = this.translator.translate('Last Quarter');
        else if (age <= 1) name = this.translator.translate('Waning Crescent');
        else name = this.translator.translate('New Moon');

        if (showName && showPercentage) return `${name} (${percent})`;
        if (showName) return name;
        if (showPercentage) return percent;
        return this.translator.translate("Moon Phase");
    }
}