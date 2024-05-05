const TOLERANCE_MET = 'tolerance met';
const { Direction } = require('./js/direction');

// translations
const UUID = 'moonphase@techi-freki';
const GetText = imports.gettext;
const { get_home_dir } = imports.gi.GLib;
GetText.bindtextdomain(UUID, get_home_dir() + "/.local/share/locale");

class Compass {
    constructor(app) {
        this.app = app;
        this.compassDegrees = [
            new Direction(22.5, this._('North'), this.app.moon.iconSet.directionUp),
            new Direction(67.5, this._('North East'), this.app.moon.iconSet.directionUpRight),
            new Direction(112.5, this._('East'), this.app.moon.iconSet.directionRight),
            new Direction(157.5, this._('South East'), this.app.moon.iconSet.directionDownRight),
            new Direction(202.5, this._('South'), this.app.moon.iconSet.directionDown),
            new Direction(247.5, this._('South West'), this.app.moon.iconSet.directionDownLeft),
            new Direction(292.5, this._('West'), this.app.moon.iconSet.directionLeft),
            new Direction(337.5, this._('North West'), this.app.moon.iconSet.directionUpLeft)
        ];
    }

    _(str) {
        const translated = GetText.dgettext(UUID, str);
        if (translated !== str) return translated;
        return str;
    }

    getCardinalDirection(degree) {
        try {
            this.compassDegrees.forEach((direction) => {
                const fixedDegree = Math.floor(degree * 100);
                const fixedTolerance = Math.floor(direction.tolerance * 100);

                if (fixedDegree <= fixedTolerance) {
                    this.direction = direction;
                    throw new Error(TOLERANCE_MET);
                }
            });
        } catch (e) {
            if (e.message !== TOLERANCE_MET) {
                throw e;
            }
        }
        return this.direction;
    }
}