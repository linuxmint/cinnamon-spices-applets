const { DefaultIconSet, AltIconSet } = require('./js/iconSet');
const { Calculator } = require('./js/calc');

class Moon {
    constructor(app) {
        this.app = app;
        this.calc = new Calculator(app.latitude, app.longitude);
        this.illumination = this.calc.getMoonIllumination();
        this.age = Math.trunc(this.illumination.phaseValue * 28);
        this.iconSet = app.useAltIcons ? new AltIconSet() : new DefaultIconSet();
        this.riseSetTimes = this.calc.getRiseSetTimes();
        this.currentPhaseIcon = this.iconSet.getPhaseIcons()[this.age];
        this.currentPhaseName = this._getCurrentPhaseName(app.showNameLabel, app.showPercentageLabel);
        this.currentTooltip = this._getCurrentPhaseName(app.showNameTooltip, app.showPercentageTooltip);
    }
    _getCurrentPhaseName(showName = true, showPercentage = true) {
        let name = "";
        const age = this.age / 28;
        const percent = `${ Math.floor((this.illumination.fraction * 100) * 100) / 100 }%`;

        if (age === 0) name = this.app.localization.translate('New Moon');
        else if (age < 0.25) name = this.app.localization.translate('Waxing Crescent');
        else if (age === 0.25) name = this.app.localization.translate('First Quarter');
        else if (age < 0.5) name = this.app.localization.translate('Waxing Gibbous');
        else if (age === 0.5) name = this.app.localization.translate('Full Moon');
        else if (age < 0.75) name = this.app.localization.translate('Waning Gibbous');
        else if (age === 0.75) name = this.app.localization.translate('Last Quarter');
        else if (age <= 1) name = this.app.localization.translate('Waning Crescent');
        else name = this.app.localization.translate('New Moon');

        if (showName && showPercentage) return `${name} (${percent})`;
        if (showName) return name;
        if (showPercentage) return percent;
        return this.app.localization.translate("Moon Phase");
    }
}