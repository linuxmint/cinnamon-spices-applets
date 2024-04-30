const SunCalc = require('./lib/suncalc3.js');

class Calculator {
    constructor(lat, lon, date = new Date()) {
        this.moonDate = date;
        this.observerLat = Number(lat);
        this.observerLon = Number(lon);
        this.moonData = SunCalc.getMoonData(this.moonDate, this.observerLat, this.observerLon);
        this.times = SunCalc.getMoonTimes(this.moonDate, this.observerLat, this.observerLon);
        this.transit = SunCalc.moonTransit(this.times.rise, this.times.set, this.observerLat, this.observerLon).main;
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
            transit: this.transit,
            riseAzimuth: SunCalc.getMoonPosition(this.times.rise, this.observerLat, this.observerLon).azimuthDegrees,
            transitAzimuth: SunCalc.getMoonPosition(this.transit, this.observerLat, this.observerLon).azimuthDegrees,
            setAzimuth: SunCalc.getMoonPosition(this.times.set, this.observerLat, this.observerLon).azimuthDegrees
        }
    }
}