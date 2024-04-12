const { DefaultIconSet, AltIconSet } = require('./js/iconSet');
const { Calculator } = require('./js/calc');
const { Translator } = require('./js/translator');

class Moon {
    constructor(moonPhaseApplet) {
        this.uuid = moonPhaseApplet.metadata.uuid;
        this.translator = new Translator(this.uuid);
        this.calc = new Calculator(moonPhaseApplet.latitude, moonPhaseApplet.longitude);
        this.illumination = this.calc.getMoonIllumination();
        this.riseSetTimes = this.calc.getRiseSetTimes();
        this.age = Math.trunc(this.illumination.phaseValue * 28);
        this.currentPhaseIcon = this._getCurrentPhaseIcon(moonPhaseApplet.useAltIcons);
        this.currentPhaseName = this._getCurrentPhaseName(moonPhaseApplet.showNameLabel, moonPhaseApplet.showPercentageLabel);
        this.currentTooltip = this._getCurrentPhaseName(moonPhaseApplet.showNameTooltip, moonPhaseApplet.showPercentageTooltip);
    }
    _getCurrentPhaseIcon(useAltIcons = false) {
        const iconSet = useAltIcons ?
            new AltIconSet().getSet() :
            new DefaultIconSet().getSet();

        return iconSet[this.age];
    }
    _getCurrentPhaseName(showName = true, showPercentage = true) {
        let name = "";
        const age = this.age / 28;
        const percent = `${Math.floor((this.illumination.fraction * 100) * 100) / 100}%`;

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