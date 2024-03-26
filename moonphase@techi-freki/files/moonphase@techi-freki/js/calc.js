const { A } = require('./lib/meeus');

class Calculator {
    constructor(lat, lon, elev) {
        this.julianDay = new A.JulianDay(new Date());
        this.coord = A.EclCoord.fromWgs84(Number(lat), Number(lon), Number(elev));
        this.tp = A.Moon.topocentricPosition(this.julianDay, this.coord, true);
        this.sunEq = A.Solar.apparentTopocentric(this.julianDay, this.coord);
        this.delta = A.DeltaT.estimate(this.julianDay);
    }

    getMoonIllumination(){
        const phase = A.MoonIllum.phaseAngleEq2(this.tp.eq, this.sunEq);
        const fraction = A.MoonIllum.illuminated(phase);
        const angle = A.MoonIllum.positionAngle(this.tp.eq, this.sunEq);

        return {
            phase: 0.5 + 0.5 * phase * (angle < 0 ? -1 : 1) / Math.PI,
            fraction: fraction,
            angle: angle
        }
    }

    getRiseSet() {
        const times = A.Moon.times(this.julianDay, this.coord);

        return {
            rise: A.Coord.secondsToHMSStr(times.rise),
            transit: A.Coord.secondsToHMSStr(times.transit),
            set: A.Coord.secondsToHMSStr(times.set)
        }
    }
}