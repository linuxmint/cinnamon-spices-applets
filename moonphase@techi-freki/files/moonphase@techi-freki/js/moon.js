const SunCalc = require('./lib/suncalc');
const { DefaultIconSet, AltIconSet } = require('./js/iconSet');

const UUID = "moonphase@techi-freki";
const { get_home_dir } = imports.gi.GLib;
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, get_home_dir() + "/.local/share/locale")

class Moon {
    constructor(currentDate, useAltIcons, showNameLabel, showPercentageLabel, showNameTooltip, showPercentageTooltip) {
        this.currentDate = currentDate;
        this.age = this._getAge();
        this.currentPhaseIcon = this._getCurrentPhaseIcon(useAltIcons);
        this.currentPhaseName = this._getCurrentPhaseName(showNameLabel, showPercentageLabel);
        this.currentTooltip = this._getCurrentPhaseName(showNameTooltip, showPercentageTooltip);
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

        const age = Math.trunc(this.age * 28); // trunc instead of round ?

        return iconSet[age];
    }
    _getCurrentPhaseName(showName = true, showPercentage = true) {
        var name = "";
        const age = Math.trunc(this.age * 28) / 28; // trunc instead of round ?
        const percent = Math.trunc((age < 0.5 ? 2*age : 2 - 2*age) * 100) + "%";  // trunc instead of round ?

        if (age === 0) name = this._("New Moon");
        else if (age < 0.25) name = this._("Waxing Crescent");
        else if (age === 0.25) name = this._("First Quarter");
        else if (age < 0.5) name = this._("Waxing Gibbous");
        else if (age === 0.5) name = this._("Full Moon");
        else if (age < 0.75) name = this._("Waning Gibbous");
        else if (age === 0.75) name = this._("Last Quarter");
        else if (age <= 1) name = this._("Waning Crescent")
        else name = this._("New Moon");

        if (showName & showPercentage) return name + " (" + percent + ")";
        if (showName) return name;
        if (showPercentage) return percent;
        return _("Moon Phase");
    }
}
