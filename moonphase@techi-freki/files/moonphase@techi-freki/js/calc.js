const { A } = require('./lib/meeus.1.0.3.min');

class Calculator {
    constructor(lat, lon, elev) {
        this.gregorianDate = new Date();
        this.julianDay = new A.JulianDay(this.gregorianDate);
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
        const times = A.Moon.times(this.julianDay, this.observerCoords);
        const rise = this.julianIntToDate(times.rise);
        const set = new A.JulianDay(times.set).toDate();
        return {
            'rise': rise,
            'transit': A.Coord.secondsToHMSStr(times.transit),
            'set': set
        }
    }

    julianIntToDate(n) {
        const a = n + 32044;
        const b = Math.floor(((4 * a) + 3) / 146097);
        const c = a - Math.floor((146097 * b) / 4);
        const d = Math.floor(((4 * c) + 3) / 1461);
        const e = c - Math.floor((1461 * d) / 4);
        const f = Math.floor(((5 * e) + 2) / 153);

        const D = e + 1 - Math.floor(((153 * f) + 2) / 5);
        const M = f + 3 - 12 - Math.round(f / 10);
        const Y = (100 * b) + d - 4800 + Math.floor(f / 10);

        return new Date(Y, M, D);
    }
}