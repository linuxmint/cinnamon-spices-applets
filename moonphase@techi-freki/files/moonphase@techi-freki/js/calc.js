const { A } = require('./lib/meeus.1.0.3.min');

class Calculator {
    constructor(lat, lon, elev) {
        this.julianDay = new A.JulianDay(new Date());
        this.observerCoords = A.EclCoord.fromWgs84(Number(lat), Number(lon), Number(elev));
        this.moonTp = A.Moon.topocentricPosition(this.julianDay, this.observerCoords, true);
        this.sunEq = A.Solar.apparentTopocentric(this.julianDay, this.observerCoords);
        this.delta = A.DeltaT.estimate(this.julianDay);
    }

    getMoonIllumination(){
        const phase = A.MoonIllum.phaseAngleEq2(this.moonTp.eq, this.sunEq);
        const fraction = A.MoonIllum.illuminated(phase);
        const angle = A.MoonIllum.positionAngle(this.moonTp.eq, this.sunEq);

        return {
            phase: 0.5 + 0.5 * phase * (angle < 0 ? -1 : 1) / Math.PI,
            fraction: fraction,
            angle: angle
        }
    }

    getRiseSetTimes() {
        return A.Moon.times(this.julianDay, this.observerCoords);
    }
}