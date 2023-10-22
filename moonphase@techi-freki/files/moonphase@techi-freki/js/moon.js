const SunCalc = require('./lib/suncalc');
const { DefaultIconSet, AltIconSet } = require('./js/iconSet');

class Moon {
    constructor(currentDate, useAltIcons) {
        this.currentDate = currentDate;
        this.age = this._getAge();
        this.currentPhaseIcon = this._getCurrentPhaseIcon(useAltIcons);
        this.currentPhaseName = this._getCurrentPhaseName();
    }
    _getAge() {
        return SunCalc.getMoonIllumination(this.currentDate).phase;
    }
    _getCurrentPhaseIcon(useAltIcons = false) {
        const iconSet = useAltIcons ?
            new AltIconSet().getSet() :
            new DefaultIconSet().getSet();

        const age = Math.round(this.age * 28);

        return iconSet[age];
    }
    _getCurrentPhaseName() {
        const age = Math.round(this.age * 28) / 28;

        if (age === 0) return 'New Moon';
        if (age < 0.25) return 'Waxing Crescent';
        if (age === 0.25) return 'First Quarter';
        if (age < 0.5) return 'Waxing Gibbous';
        if (age === 0.5) return 'Full Moon';
        if (age < 0.75) return 'Waning Gibbous';
        if (age === 0.75) return 'Last Quarter';
        if (age <= 1) return 'Waning Crescent';
        return 'New Moon';
    }
}
