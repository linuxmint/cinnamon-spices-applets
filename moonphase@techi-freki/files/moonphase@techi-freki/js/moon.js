const { DefaultIconSet, AltIconSet } = require('./js/iconSet');
const { Calculator } = require('./js/calc');
const { Translator } = require('./js/translator');

class Moon {
    constructor(moonPhaseApplet) {
        this.uuid = moonPhaseApplet.metadata.uuid;
        this.calc = new Calculator(moonPhaseApplet.latitude, moonPhaseApplet.longitude, moonPhaseApplet.elevation);
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
        const translator = new Translator(this.uuid);

        // method to convert to percentage without rounding to keep precision
        const toPercentage = (n, fixed) => `${n * 100}`.match(new RegExp(`^-?\\d+(?:\.\\d{0,${fixed}})?`))[0] + "%";
        const percent = toPercentage(this.illumination.fraction, 2);

        if (age === 0) name = translator.translate("New Moon");
        else if (age < 0.25) name = translator.translate("Waxing Crescent");
        else if (age === 0.25) name = translator.translate("First Quarter");
        else if (age < 0.5) name = translator.translate("Waxing Gibbous");
        else if (age === 0.5) name = translator.translate("Full Moon");
        else if (age < 0.75) name = translator.translate("Waning Gibbous");
        else if (age === 0.75) name = translator.translate("Last Quarter");
        else if (age <= 1) name = translator.translate("Waning Crescent")
        else name = translator.translate("New Moon");

        if (showName && showPercentage) return name + " (" + percent + ")";
        if (showName) return name;
        if (showPercentage) return percent;
        return translator.translate("Moon Phase");
    }
}
