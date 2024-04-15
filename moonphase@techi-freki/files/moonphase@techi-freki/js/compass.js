const { Icon, IconType } = imports.gi.St;

class Compass {
    constructor(app) {
        this.app = app;
        this.compassDegrees = [
            new Direction(22.5, 'North', this.app.moon.iconSet.directionUp, 18),
            new Direction(67.5, 'North East', this.app.moon.iconSet.directionUpRight, 18),
            new Direction(112.5, 'East', this.app.moon.iconSet.directionRight, 18),
            new Direction(157.5, 'South East', this.app.moon.iconSet.directionDownRight, 18),
            new Direction(202.5, 'South', this.app.moon.iconSet.directionDown, 18),
            new Direction(247.5, 'South West', this.app.moon.iconSet.directionDownLeft, 18),
            new Direction(292.5, 'West', this.app.moon.iconSet.directionLeft, 18),
            new Direction(337.5, 'North West', this.app.moon.iconSet.directionUpLeft, 18)
        ];
    }

    getCardinalDirection(degree) {
        try {
            this.compassDegrees.forEach((direction) => {
                const fixedDegree = Math.floor(degree * 100);
                const fixedTolerance = Math.floor(direction.tolerance * 100);

                if (fixedDegree <= fixedTolerance) {
                    direction.icon.set_icon_size(18);
                    this.direction = direction;
                    global.log(direction.icon.get_size());
                    throw new Error('tolerance met');
                }
            });
        } catch (e) {
            if (e.message !== 'tolerance met') {
                throw e;
            }
        }

        return this.direction;
    }
}

class Direction {
    // TODO: Fix icon size, it is decreasing each time for some reason
    constructor(tolerance, direction_name, icon_name, icon_size) {
        this.tolerance = tolerance;
        this.name = direction_name;
        this.icon = new Icon({
            icon_name,
            icon_type: IconType.SYMBOLIC,
            icon_size
        });
    }
}