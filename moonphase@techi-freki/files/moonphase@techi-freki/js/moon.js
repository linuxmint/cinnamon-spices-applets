const SunCalc = require('./lib/suncalc');
const { DefaultIconSet, AltIconSet } = require('./js/iconSet');

const UUID = "moonphase@techi-freki";
const { get_home_dir } = imports.gi.GLib;
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, get_home_dir() + "/.local/share/locale")

class Moon {
    constructor(currentDate, useAltIcons) {
        this.currentDate = currentDate;
        this.age = this._getAge();
        this.currentPhaseIcon = this._getCurrentPhaseIcon(useAltIcons);
        this.currentPhaseName = this._getCurrentPhaseName();
    }
    // translation
    _(str) {
        let translated = Gettext.dgettext(UUID, str);
        if (translated !== str)
            return translated;
        return str;
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

        if (age === 0) return this._("New Moon");
        if (age < 0.25) return this._("Waxing Crescent");
        if (age === 0.25) return this._("First Quarter");
        if (age < 0.5) return this._("Waxing Gibbous");
        if (age === 0.5) return this._("Full Moon");
        if (age < 0.75) return this._("Waning Gibbous");
        if (age === 0.75) return this._("Last Quarter");
        if (age <= 1) return this._("Waning Crescent");
        return this._("New Moon");
    }
}
