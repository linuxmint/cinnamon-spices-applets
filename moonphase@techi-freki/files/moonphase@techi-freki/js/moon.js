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

        if (age === 0) name = 'New Moon';
        else if (age < 0.25) name = 'Waxing Crescent';
        else if (age === 0.25) name = 'First Quarter';
        else if (age < 0.5) name = 'Waxing Gibbous';
        else if (age === 0.5) name = 'Full Moon';
        else if (age < 0.75) name = 'Waning Gibbous';
        else if (age === 0.75) name = 'Last Quarter';
        else if (age <= 1) name = 'Waning Crescent';
        else name = 'New Moon';

        if (showName && showPercentage) return `${name} (${percent})`;
        if (showName) return name;
        if (showPercentage) return percent;
        return 'Moon Phase';
    }
}