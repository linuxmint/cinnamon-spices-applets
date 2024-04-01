const SunCalc = require('./lib/suncalc3.js');

class Calculator {
    constructor(lat, lon) {
        this.today = new Date();
        this.observerLat = Number(lat);
        this.observerLon = Number(lon);
        this.moonData = SunCalc.getMoonData(this.today, this.observerLat, this.observerLon);
        this.times = SunCalc.getMoonTimes(this.today, this.observerLat, this.observerLon);
    }

    getMoonIllumination() {
        return this.moonData.illumination;
    }

    getRiseSetTimes() {
        const rise = isNaN(this.times.rise) ? null : this.times.rise;
        const set = isNaN(this.times.set) ? null : this.times.set;
        return {
            rise,
            set,
            alwaysUp: this.times.alwaysUp,
            alwaysDown: this.times.alwaysDown,
            highestPosition: this.times.highest,
            transit: SunCalc.moonTransit(rise, set, this.observerLat, this.observerLon).main
        }
    }
}