const { DefaultIconSet, AltIconSet } = require('./js/iconSet');
const { Calculator } = require('./js/calc');

const UUID = "moonphase@techi-freki";
const { get_home_dir } = imports.gi.GLib;
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, get_home_dir() + "/.local/share/locale");

class Moon {
    constructor(moonPhaseApplet) {
        this.calc = new Calculator(moonPhaseApplet.latitude, moonPhaseApplet.longitude, moonPhaseApplet.elevation);
        this.illumination = this.calc.getMoonIllumination();
        this.riseSetTimes = this.calc.getRiseSetTimes();
        this.age = Math.trunc(this.illumination.phaseValue * 28);
        this.currentPhaseIcon = this._getCurrentPhaseIcon(moonPhaseApplet.useAltIcons);
        this.currentPhaseName = this._getCurrentPhaseName(moonPhaseApplet.showNameLabel, moonPhaseApplet.showPercentageLabel);
        this.currentTooltip = this._getCurrentPhaseName(moonPhaseApplet.showNameTooltip, moonPhaseApplet.showPercentageTooltip);
    }
    // translation
    _(str) {
        let translated = Gettext.dgettext(UUID, str);
        if (translated !== str)
            return translated;
        return str;
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

        // method to convert to percentage without rounding to keep precision
        const toPercentage = (n, fixed) => `${n * 100}`.match(new RegExp(`^-?\\d+(?:\.\\d{0,${fixed}})?`))[0] + "%";
        const percent = toPercentage(this.illumination.fraction, 2);

        if (age === 0) name = this._("New Moon");
        else if (age < 0.25) name = this._("Waxing Crescent");
        else if (age === 0.25) name = this._("First Quarter");
        else if (age < 0.5) name = this._("Waxing Gibbous");
        else if (age === 0.5) name = this._("Full Moon");
        else if (age < 0.75) name = this._("Waning Gibbous");
        else if (age === 0.75) name = this._("Last Quarter");
        else if (age <= 1) name = this._("Waning Crescent")
        else name = this._("New Moon");

        if (showName && showPercentage) return name + " (" + percent + ")";
        if (showName) return name;
        if (showPercentage) return percent;
        return _("Moon Phase");
    }
}
