function _tagProviderError(error, kind, prefix = "") {
    const tagged = error instanceof Error ? error : new Error(String(error));
    if (!tagged.kind)
        tagged.kind = kind;
    if (prefix)
        tagged.message = `${prefix}${tagged.message || tagged}`;
    return tagged;
}

var JmaProvider = class JmaProvider {
    constructor(httpClient, utils) {
        this._httpClient = httpClient;
        this._utils = utils;
    }

    buildUrl(config) {
        const areaCode = String(config.areaCode || "130000").trim();
        if (!/^\d{6}$/.test(areaCode))
            throw new Error("気象庁コードは6桁の数字で指定してください");

        const sourceCode = this._forecastSourceCode(areaCode);
        return `https://www.jma.go.jp/bosai/forecast/data/forecast/${sourceCode}.json`;
    }

    _forecastSourceCode(areaCode) {
        const aliases = {
            "014030": "014100",
            "460040": "460100"
        };
        return aliases[areaCode] || areaCode;
    }

    fetch(config, callback) {
        let url;

        try {
            url = this.buildUrl(config);
        } catch (error) {
            callback(_tagProviderError(error, "config"), null);
            return;
        }

        this._httpClient.getJson(url, (error, data) => {
            if (error) {
                callback(error, null);
                return;
            }

            try {
                callback(null, this.parse(data, config));
            } catch (parseError) {
                callback(_tagProviderError(parseError, "parse"), null);
            }
        });
    }

    parse(data, config) {
        if (!Array.isArray(data) || data.length === 0)
            throw new Error("予報JSONの形式が想定外です");

        const short = data[0];
        const weekly = data.length > 1 ? data[1] : null;
        const series = short.timeSeries || [];

        const weatherSeries = series[0] || {};
        const popSeries = series[1] || {};
        const tempSeries = series[2] || {};

        const areaName = config.areaName || "東京地方";
        const tempAreaName = config.tempAreaName || "";
        const displayName = String(config.displayName || "").replace(/[ 　]/g, "");

        const weatherArea =
            (weatherSeries.areas || []).find(a => a.area?.name === areaName) ||
            (weatherSeries.areas || [])[0];

        const popArea =
            (popSeries.areas || []).find(a => a.area?.name === areaName) ||
            (popSeries.areas || [])[0];

        const tempAreas = tempSeries.areas || [];
        const tempArea =
            tempAreas.find(a => a.area?.name === tempAreaName) ||
            tempAreas.find(a => {
                const name = String(a.area?.name || "").replace(/[ 　]/g, "");
                return name && displayName.includes(name);
            }) ||
            tempAreas[0];

        if (!weatherArea)
            throw new Error(`予報エリア「${areaName}」が見つかりません`);

        const weatherCodes = weatherArea.weatherCodes || [];
        const weatherTexts = weatherArea.weathers || [];
        const windTexts = weatherArea.winds || [];
        const weatherTimes = weatherSeries.timeDefines || [];
        const weatherCode = this._utils.firstValue(weatherCodes) || "000";
        const weatherText = this._utils.firstValue(weatherTexts) || "予報不明";
        const windText = this._utils.firstValue(windTexts) || "";

        const pops = (popArea?.pops || [])
            .map(this._utils.asNumber)
            .filter(value => value !== null);
        const maxPop = pops.length ? Math.max(...pops) : null;
        const popTimes = popSeries.timeDefines || [];
        const precipitationBlocks = [];
        for (let i = 0; i < Math.min(popTimes.length, popArea?.pops?.length || 0); i++) {
            const value = this._utils.asNumber(popArea.pops[i]);
            if (value === null)
                continue;
            precipitationBlocks.push({
                time: popTimes[i],
                pop: value
            });
        }

        const regionalRows = [];
        for (let i = 0; i < Math.min(weatherTimes.length, weatherCodes.length); i++) {
            regionalRows.push({
                time: weatherTimes[i],
                code: String(weatherCodes[i] || "000"),
                weatherText: weatherTexts[i] || "",
                windText: windTexts[i] || ""
            });
        }

        // JMA temperature values are aligned to timeDefines; classify them by
        // date instead of assuming the first two values are today's min/max.
        const tempTimes = tempSeries.timeDefines || [];
        const tempValues = tempArea?.temps || [];
        const todayKey = this._utils.dateKey(new Date());
        const todayTemps = [];

        for (let i = 0; i < Math.min(tempTimes.length, tempValues.length); i++) {
            const value = this._utils.asNumber(tempValues[i]);
            if (value === null || this._utils.dateKey(tempTimes[i]) !== todayKey)
                continue;
            todayTemps.push(value);
        }

        const minTemp = todayTemps.length ? Math.min(...todayTemps) : null;
        const maxTemp = todayTemps.length ? Math.max(...todayTemps) : null;

        const weeklyRows = [];
        if (weekly?.timeSeries?.length) {
            const weatherWeekly = weekly.timeSeries[0];
            const tempWeekly = weekly.timeSeries[1];

            const weeklyArea =
                (weatherWeekly.areas || []).find(a => a.area?.name === areaName) ||
                (weatherWeekly.areas || [])[0];

            const weeklyTempAreas = tempWeekly?.areas || [];
            const weeklyTempArea =
                weeklyTempAreas.find(a => a.area?.name === tempAreaName) ||
                weeklyTempAreas.find(a => {
                    const name = String(a.area?.name || "").replace(/[ 　]/g, "");
                    return name && displayName.includes(name);
                }) ||
                weeklyTempAreas[0];

            const times = weatherWeekly.timeDefines || [];
            const codes = weeklyArea?.weatherCodes || [];
            const weeklyPops = weeklyArea?.pops || [];
            const mins = weeklyTempArea?.tempsMin || [];
            const maxs = weeklyTempArea?.tempsMax || [];

            for (let i = 0; i < Math.min(times.length, 7); i++) {
                weeklyRows.push({
                    time: times[i],
                    code: String(codes[i] || "000"),
                    pop: this._utils.asNumber(weeklyPops[i]),
                    min: this._utils.asNumber(mins[i]),
                    max: this._utils.asNumber(maxs[i])
                });
            }
        }

        return {
            provider: "jma",
            icon: this._utils.weatherIcon(weatherCode),
            weatherCode,
            weatherText,
            windText,
            areaName: weatherArea.area?.name || areaName,
            publishingOffice: short.publishingOffice || "",
            issuedAt: short.reportDatetime || null,
            regionalRows,
            precipitationBlocks,
            maxPop,
            minTemp,
            maxTemp,
            weeklyRows,
            fetchedAt: new Date(),
            updatedAt: new Date()
        };
    }
};
