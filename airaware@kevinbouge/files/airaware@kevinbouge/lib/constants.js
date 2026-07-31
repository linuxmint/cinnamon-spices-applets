/* exported RISK_LEVELS, RISK_WEIGHTS, POLLEN_THRESHOLDS,
 * POLLUTANT_THRESHOLDS, IRRITANT_WEIGHTS, MOLD_WEIGHTS,
 * MOLD_NORMALIZATION */

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
    pollen: 0.5,
    particulates: 0.25,
    irritants: 0.1,
    mold: 0.15,
});

var IRRITANT_WEIGHTS = Object.freeze({
    nitrogenDioxide: 0.22,
    ozone: 0.22,
    sulfurDioxide: 0.18,
    dust: 0.13,
    aerosolOpticalDepth: 0.125,
    carbonMonoxide: 0.125,
});

var MOLD_WEIGHTS = Object.freeze({
    relativeHumidity: 0.4,
    precipitation: 0.25,
    temperature: 0.2,
    wind: 0.15,
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
    sulfurDioxide: Object.freeze({
        moderate: 20,
        high: 100,
        veryHigh: 350,
    }),
    dust: Object.freeze({
        moderate: 20,
        high: 50,
        veryHigh: 100,
    }),
    aerosolOpticalDepth: Object.freeze({
        moderate: 0.1,
        high: 0.3,
        veryHigh: 0.6,
    }),
    carbonMonoxide: Object.freeze({
        moderate: 400,
        high: 1000,
        veryHigh: 4000,
    }),
});

var MOLD_NORMALIZATION = Object.freeze({
    relativeHumidity: Object.freeze({
        low: 50,
        moderate: 65,
        high: 80,
    }),
    precipitation: Object.freeze({
        trace: 0.1,
        moderate: 2,
        high: 10,
    }),
    temperature: Object.freeze({
        minimum: 5,
        suitableLow: 15,
        suitableHigh: 30,
        maximum: 40,
    }),
    wind: Object.freeze({
        calm: 2,
        moderate: 5,
        strong: 10,
    }),
});
