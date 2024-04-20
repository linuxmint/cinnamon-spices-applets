const TOLERANCE_MET = 'tolerance met';
const { Direction } = require('./js/direction');

class Compass {
    constructor(app) {
        this.app = app;
        this.compassDegrees = [
            new Direction(22.5, 'North', this.app.moon.iconSet.directionUp),
            new Direction(67.5, 'North East', this.app.moon.iconSet.directionUpRight),
            new Direction(112.5, 'East', this.app.moon.iconSet.directionRight),
            new Direction(157.5, 'South East', this.app.moon.iconSet.directionDownRight),
            new Direction(202.5, 'South', this.app.moon.iconSet.directionDown),
            new Direction(247.5, 'South West', this.app.moon.iconSet.directionDownLeft),
            new Direction(292.5, 'West', this.app.moon.iconSet.directionLeft),
            new Direction(337.5, 'North West', this.app.moon.iconSet.directionUpLeft)
        ];
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