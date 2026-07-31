/* exported RISK_LEVELS, RISK_WEIGHTS, POLLEN_THRESHOLDS, POLLUTANT_THRESHOLDS */

/*
 * AirAware shared constants.
 *
 * Threshold values are intentionally centralized so the first risk model can be
 * tuned without changing provider, cache, or UI code.
 */

var RISK_LEVELS = Object.freeze({
    LOW: Object.freeze({
        id: 'low',
        label: 'Low',
        minScore: 0,
        representativeScore: 15,
    }),
    MODERATE: Object.freeze({
        id: 'moderate',
        label: 'Moderate',
        minScore: 25,
        representativeScore: 45,
    }),
    HIGH: Object.freeze({
        id: 'high',
        label: 'High',
        minScore: 55,
        representativeScore: 72,
    }),
    VERY_HIGH: Object.freeze({
        id: 'very-high',
        label: 'Very High',
        minScore: 80,
        representativeScore: 95,
    }),
});

var RISK_WEIGHTS = Object.freeze({
    pollen: 0.6,
    particulates: 0.3,
    gasesAndDust: 0.1,
});

/*
 * Generic pollen thresholds in grains/m³. Provider-specific aggregation should
 * normalize tree, grass, and weed pollen into these canonical readings.
 */
var POLLEN_THRESHOLDS = Object.freeze({
    treePollen: Object.freeze({
        moderate: 30,
        high: 100,
        veryHigh: 200,
    }),
    grassPollen: Object.freeze({
        moderate: 20,
        high: 50,
        veryHigh: 100,
    }),
    weedPollen: Object.freeze({
        moderate: 20,
        high: 50,
        veryHigh: 100,
    }),
});

/*
 * Air pollutant thresholds in µg/m³. They are environmental burden bands, not
 * medical guidance or regulatory AQI claims.
 */
var POLLUTANT_THRESHOLDS = Object.freeze({
    pm25: Object.freeze({
        moderate: 10,
        high: 25,
        veryHigh: 50,
    }),
    pm10: Object.freeze({
        moderate: 20,
        high: 50,
        veryHigh: 100,
    }),
    nitrogenDioxide: Object.freeze({
        moderate: 40,
        high: 100,
        veryHigh: 200,
    }),
    ozone: Object.freeze({
        moderate: 60,
        high: 120,
        veryHigh: 180,
    }),
    dust: Object.freeze({
        moderate: 20,
        high: 50,
        veryHigh: 100,
    }),
});
