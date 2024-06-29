const { DefaultIconSet, AltIconSet } = require('./js/iconSet');
const { Calculator } = require('./js/calc');

// translations
const UUID = 'moonphase@techi-freki';
const GetText = imports.gettext;
const { get_home_dir } = imports.gi.GLib;
GetText.bindtextdomain(UUID, get_home_dir() + "/.local/share/locale");

class Moon {
    constructor(app) {
        this.app = app;
        this.calc = new Calculator(app.latitude, app.longitude);
        this.illumination = this.calc.getMoonIllumination();
        this.age = Math.trunc(this.illumination.phaseValue * 28);
        this.iconSet = app.useAltIcons ? new AltIconSet() : new DefaultIconSet();
        this.riseSetTimes = this.calc.getRiseSetTimes();
        this.currentPhaseIcon = this.iconSet.getPhaseIcons()[this.age];
        this.currentPhaseName = this._getCurrentPhaseName();
    }

    _(str) {
        const translated = GetText.dgettext(UUID, str);
        if (translated !== str) return translated;
        return str;
    }

    _getCurrentPhaseName() {
        let name = "";
        const age = this.age / 28;

        if (age === 0) name = this._('New Moon');
        else if (age < 0.25) name = this._('Waxing Crescent');
        else if (age === 0.25) name = this._('First Quarter');
        else if (age < 0.5) name = this._('Waxing Gibbous');
        else if (age === 0.5) name = this._('Full Moon');
        else if (age < 0.75) name = this._('Waning Gibbous');
        else if (age === 0.75) name = this._('Last Quarter');
        else if (age <= 1) name = this._('Waning Crescent');
        else name = this._('New Moon');

        return name;
    }
}