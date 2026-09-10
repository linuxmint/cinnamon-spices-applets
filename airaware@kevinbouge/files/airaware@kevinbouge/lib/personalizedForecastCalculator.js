/* exported calculatePersonalizedForecast */

const Constants = imports.constants;
const MoldPotentialCalculator = imports.moldPotentialCalculator;
const PersonalizedRiskCalculator = imports.personalizedRiskCalculator;
const RiskCalculator = imports.riskCalculator;

const DEFAULT_HORIZON_HOURS = 24;

function _isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _copyObject(value) {
    if (value === null || typeof value !== 'object')
        return value;

    if (Array.isArray(value))
        return value.map(_copyObject);

    let copy = {};

    for (const key in value)
        copy[key] = _copyObject(value[key]);

    return copy;
}

function _timeValue(timeText) {
    if (typeof timeText !== 'string' || timeText === '')
        return null;

    const normalized = timeText.length === 16 ? `${timeText}:00` : timeText;
    const parsed = Date.parse(normalized);

    return Number.isFinite(parsed) ? parsed : null;
}

function _recordsFromAirQuality(data) {
    if (!data)
        return [];

    if (Array.isArray(data.hourlyRecords))
        return data.hourlyRecords;

    if (!data.hourly || !Array.isArray(data.hourly.timestamps))
        return [];

    return data.hourly.timestamps.map((time, index) => ({
        time,
        timestamp: time,
        rawPollutants: _valuesAtIndex(data.hourly.rawPollutants, index),
        pollutantAqi: _valuesAtIndex(data.hourly.pollutantAqi, index),
        pollen: _valuesAtIndex(data.hourly.pollen, index),
        context: _valuesAtIndex(data.hourly.context, index),
        pollutantAqiSource: data.pollutantAqiSource || 'aqi',
        pollutantAqiLabel: data.pollutantAqiLabel || 'AQI',
    }));
}

function _recordsFromWeather(data) {
    if (!data || !data.weather)
        return [];

    if (Array.isArray(data.weather.hourlyRecords))
        return data.weather.hourlyRecords;

    if (!data.weather.hourly || !Array.isArray(data.weather.hourly.timestamps))
        return [];

    return data.weather.hourly.timestamps.map((time, index) => ({
        time,
        values: _valuesAtIndex(data.weather.hourly, index),
    }));
}

function _valuesAtIndex(series, index) {
    let values = {};

    if (!_isObject(series))
        return values;

    for (const key in series) {
        if (key === 'timestamps' || key === 'missingFields' || key === 'isPartial')
            continue;

        values[key] = Array.isArray(series[key])
            ? series[key][index]
            : null;
    }

    return values;
}

function _recordMap(records) {
    let map = {};

    for (const record of records || []) {
        const time = record && (record.time || record.timestamp);

        if (typeof time === 'string' && time !== '')
            map[time] = record;
    }

    return map;
}

function _weatherValues(record) {
    if (record && _isObject(record.values))
        return record.values;

    return {};
}

function _dateFromTime(timeText) {
    if (typeof timeText !== 'string' || timeText.length < 10)
        return null;

    return timeText.substring(0, 10);
}

function _dailyForTime(weatherData, timeText) {
    const date = _dateFromTime(timeText);

    if (!date || !weatherData || !weatherData.daily || !Array.isArray(weatherData.daily.dates))
        return null;

    const index = weatherData.daily.dates.indexOf(date);

    if (index === -1)
        return null;

    let daily = {};

    for (const key in weatherData.daily) {
        if (key === 'dates')
            continue;

        daily[key] = Array.isArray(weatherData.daily[key])
            ? weatherData.daily[key][index]
            : null;
    }

    return daily;
}

function _sampleFromRecords(time, airRecord, weatherRecord) {
    const sample = airRecord
        ? _copyObject(airRecord)
        : {
            time,
            timestamp: time,
            rawPollutants: {},
            pollutantAqi: {},
            pollen: {},
            context: {},
        };
    const weatherValues = _weatherValues(weatherRecord);

    sample.time = time;
    sample.timestamp = time;
    sample.uvIndex = _isFiniteNumber(weatherValues.uvIndex)
        ? weatherValues.uvIndex
        : null;

    return sample;
}

function _recentWeatherRecords(time, weatherRecords) {
    const targetValue = _timeValue(time);

    if (targetValue === null)
        return weatherRecords.filter(record => record && record.time === time);

    const startValue = targetValue - (23 * 60 * 60 * 1000);

    return weatherRecords.filter(record => {
        const value = _timeValue(record ? record.time : null);

        return value !== null && value >= startValue && value <= targetValue;
    });
}

function _moldForHour(time, weatherRecord, weatherRecords, weatherData) {
    if (!weatherRecord)
        return {
            score: null,
            category: null,
            isAvailable: false,
            completeness: 0,
        };

    const values = _weatherValues(weatherRecord);
    const recentRecords = _recentWeatherRecords(time, weatherRecords);

    return MoldPotentialCalculator.calculateMoldPotential({
        current: values,
        hourlyRecords: recentRecords.length > 0
            ? recentRecords
            : [{
                time,
                values,
            }],
        daily: _dailyForTime(weatherData, time),
    });
}

function _orderedTimes(airRecords, weatherRecords, currentTime, horizonHours) {
    let seen = {};
    let times = [];
    const currentValue = _timeValue(currentTime);
    const horizonMs = Math.max(1, horizonHours) * 60 * 60 * 1000;

    for (const record of airRecords.concat(weatherRecords)) {
        const time = record && (record.time || record.timestamp);
        const value = _timeValue(time);

        if (value === null || seen[time])
            continue;

        if (currentValue !== null && (value < currentValue || value >= currentValue + horizonMs))
            continue;

        seen[time] = true;
        times.push(time);
    }

    times.sort((left, right) => _timeValue(left) - _timeValue(right));

    if (currentValue === null)
        return times.slice(0, horizonHours);

    return times;
}

function _hourEntry(time, risk, moldPotential) {
    if (!risk || risk.available !== true) {
        return {
            time,
            available: false,
            reason: risk ? risk.reason : 'insufficient_data',
        };
    }

    return {
        time,
        available: true,
        score: risk.score,
        displayScore: risk.displayScore,
        category: risk.category,
        selectedGroupCount: risk.selectedGroupCount || 0,
        availableGroupCount: risk.availableGroupCount || 0,
        groupCompleteness: risk.groupCompleteness || 0,
        partial: risk.missingFactorCount > 0 ||
            (risk.availableGroupCount || 0) < (risk.selectedGroupCount || 0),
        moldPotential,
    };
}

function _isContiguous(left, right) {
    const leftValue = _timeValue(left.time);
    const rightValue = _timeValue(right.time);

    if (leftValue === null || rightValue === null)
        return false;

    return Math.abs((rightValue - leftValue) - 60 * 60 * 1000) <= 10 * 60 * 1000;
}

function _windowCompleteness(hours) {
    let total = 0;

    for (const hour of hours)
        total += _isFiniteNumber(hour.groupCompleteness) ? hour.groupCompleteness : 0;

    return hours.length > 0 ? total / hours.length : 0;
}

function _bestWindow(hours, durationHours) {
    const duration = Math.max(1, Math.min(3, Math.floor(Number(durationHours) || 2)));
    let best = null;

    for (let index = 0; index <= hours.length - duration; index++) {
        const candidate = hours.slice(index, index + duration);

        if (!candidate.every(hour => hour.available === true))
            continue;

        let contiguous = true;

        for (let offset = 1; offset < candidate.length; offset++) {
            if (!_isContiguous(candidate[offset - 1], candidate[offset])) {
                contiguous = false;
                break;
            }
        }

        if (!contiguous)
            continue;

        const completeness = _windowCompleteness(candidate);

        if (!candidate.every(hour => {
            const hourSelectedGroups = hour.selectedGroupCount || 0;
            const hourMinimum = hourSelectedGroups < 2
                ? 1
                : Constants.OUTDOOR_WINDOW_MIN_GROUP_COMPLETENESS;

            return (hour.groupCompleteness || 0) >= hourMinimum;
        }))
            continue;

        const averageScore = candidate.reduce((sum, hour) => sum + hour.score, 0) / duration;
        const maximumScore = candidate.reduce((max, hour) => Math.max(max, hour.score), 0);
        const result = {
            available: true,
            startTime: candidate[0].time,
            endTime: _endTime(candidate[candidate.length - 1].time),
            durationHours: duration,
            averageScore,
            maximumScore,
            displayScore: Math.round(averageScore),
            category: RiskCalculator.categoryFromScore(averageScore),
            completeness,
        };

        if (best === null ||
            result.averageScore < best.averageScore ||
            (result.averageScore === best.averageScore && result.maximumScore < best.maximumScore) ||
            (result.averageScore === best.averageScore &&
                result.maximumScore === best.maximumScore &&
                result.completeness > best.completeness) ||
            (result.averageScore === best.averageScore &&
                result.maximumScore === best.maximumScore &&
                result.completeness === best.completeness &&
                _timeValue(result.startTime) < _timeValue(best.startTime))) {
            best = result;
        }
    }

    return best || {
        available: false,
        reason: 'insufficient_forecast_data',
    };
}

function _endTime(startTime) {
    const value = _timeValue(startTime);

    if (value === null)
        return startTime;

    const date = new Date(value + 60 * 60 * 1000);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');

    return `${year}-${month}-${day}T${hour}:00`;
}

/**
 * Calculate hourly personalized risk needed to rank the lowest-risk outdoor window.
 *
 * @param {Object} environmentalData - Combined normalized provider data.
 * @param {Object} profile - Normalized Personal Allergy Profile.
 * @param {Object} options - Optional horizonHours and windowDurationHours.
 * @returns {Object} Hourly scores and best-window result.
 */
var calculatePersonalizedForecast = function(environmentalData, profile, options = {}) {
    const horizonHours = Math.max(1, Math.floor(options.horizonHours || DEFAULT_HORIZON_HOURS));
    const airRecords = _recordsFromAirQuality(environmentalData);
    const weatherRecords = _recordsFromWeather(environmentalData);
    const airMap = _recordMap(airRecords);
    const weatherMap = _recordMap(weatherRecords);
    const currentTime = environmentalData && environmentalData.current
        ? environmentalData.current.timestamp || environmentalData.current.time
        : null;
    const times = _orderedTimes(airRecords, weatherRecords, currentTime, horizonHours);
    let hours = [];

    for (const time of times.slice(0, horizonHours)) {
        const weatherRecord = weatherMap[time] || null;
        const moldPotential = _moldForHour(
            time,
            weatherRecord,
            weatherRecords,
            environmentalData ? environmentalData.weather : null
        );
        const sample = _sampleFromRecords(time, airMap[time] || null, weatherRecord);
        const risk = PersonalizedRiskCalculator.calculatePersonalizedRisk(
            sample,
            moldPotential,
            profile
        );

        hours.push(_hourEntry(time, risk, moldPotential));
    }

    return {
        generatedAt: currentTime,
        horizonHours,
        hours,
        bestWindow: _bestWindow(hours, options.windowDurationHours || 2),
    };
};
