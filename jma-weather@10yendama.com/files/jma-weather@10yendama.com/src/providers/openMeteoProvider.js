function _tagProviderError(error, kind, prefix = "") {
    const tagged = error instanceof Error ? error : new Error(String(error));
    if (!tagged.kind)
        tagged.kind = kind;
    if (prefix)
        tagged.message = `${prefix}${tagged.message || tagged}`;
    return tagged;
}

function _openMeteoTimeMs(value) {
    if (typeof value !== "string" || !value.trim())
        return NaN;
    const text = value.trim();
    const hasExplicitZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
    return new Date(hasExplicitZone ? text : `${text}+09:00`).getTime();
}

var OpenMeteoProvider = class OpenMeteoProvider {
    constructor(httpClient, utils) {
        this._httpClient = httpClient;
        this._utils = utils;
    }

    buildUrl(config) {
        const latitude = Number(config.latitude);
        const longitude = Number(config.longitude);

        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
            throw new Error("緯度が正しくありません");
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
            throw new Error("経度が正しくありません");

        return "https://api.open-meteo.com/v1/forecast" +
            `?latitude=${encodeURIComponent(latitude)}` +
            `&longitude=${encodeURIComponent(longitude)}` +
            "&current=temperature_2m,apparent_temperature,precipitation,rain,showers,weather_code,is_day,wind_speed_10m,wind_direction_10m" +
            "&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,weather_code,is_day,uv_index,wind_speed_10m,wind_direction_10m" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max" +
            "&timezone=Asia%2FTokyo&forecast_days=7";
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
                callback(null, this.parse(data));
            } catch (parseError) {
                callback(_tagProviderError(parseError, "parse"), null);
            }
        });
    }

    parse(data, now = new Date()) {
        if (!data || !data.hourly)
            throw new Error("時間別JSONの形式が想定外です");

        const times = data.hourly.time || [];
        const temperatures = data.hourly.temperature_2m || [];
        const feels = data.hourly.apparent_temperature || [];
        const pops = data.hourly.precipitation_probability || [];
        const precipitation = data.hourly.precipitation || [];
        const rain = data.hourly.rain || [];
        const showers = data.hourly.showers || [];
        const codes = data.hourly.weather_code || [];
        const dayFlags = data.hourly.is_day || [];
        const uvs = data.hourly.uv_index || [];
        const winds = data.hourly.wind_speed_10m || [];
        const windDirections = data.hourly.wind_direction_10m || [];

        const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
        const rows = [];

        for (let i = 0; i < times.length; i++) {
            const timeMs = _openMeteoTimeMs(times[i]);
            if (Number.isNaN(timeMs) ||
                (!Number.isNaN(nowMs) && timeMs < nowMs - 2 * 60 * 60 * 1000))
                continue;

            rows.push({
                time: times[i],
                temp: this._utils.asNumber(temperatures[i]),
                feels: this._utils.asNumber(feels[i]),
                pop: this._utils.asNumber(pops[i]),
                precipitation: this._utils.asNumber(precipitation[i]),
                rain: this._utils.asNumber(rain[i]),
                showers: this._utils.asNumber(showers[i]),
                code: this._utils.asNumber(codes[i]),
                isDay: Number(dayFlags[i]) === 1,
                uv: this._utils.asNumber(uvs[i]),
                wind: this._utils.asNumber(winds[i]),
                windDirection: this._utils.asNumber(windDirections[i])
            });

            // Retain the full current hour; the previous 30-minute cutoff could
            // remove 15:00 at 15:37 before the panel resolver saw it.
            if (rows.length >= 24)
                break;
        }

        const dailyTimes = data.daily?.time || [];
        const dailyCodes = data.daily?.weather_code || [];
        const dailyMins = data.daily?.temperature_2m_min || [];
        const dailyMaxs = data.daily?.temperature_2m_max || [];
        const dailyPops = data.daily?.precipitation_probability_max || [];
        const dailyUvs = data.daily?.uv_index_max || [];
        const dailyRows = [];

        for (let i = 0; i < Math.min(dailyTimes.length, 7); i++) {
            dailyRows.push({
                time: dailyTimes[i],
                code: this._utils.asNumber(dailyCodes[i]),
                min: this._utils.asNumber(dailyMins[i]),
                max: this._utils.asNumber(dailyMaxs[i]),
                pop: this._utils.asNumber(dailyPops[i]),
                uv: this._utils.asNumber(dailyUvs[i])
            });
        }

        return {
            provider: "open-meteo",
            current: {
                time: data.current?.time || null,
                temp: this._utils.asNumber(data.current?.temperature_2m),
                feels: this._utils.asNumber(data.current?.apparent_temperature),
                precipitation: this._utils.asNumber(data.current?.precipitation),
                rain: this._utils.asNumber(data.current?.rain),
                showers: this._utils.asNumber(data.current?.showers),
                code: this._utils.asNumber(data.current?.weather_code),
                isDay: Number(data.current?.is_day) === 1,
                wind: this._utils.asNumber(data.current?.wind_speed_10m),
                windDirection: this._utils.asNumber(
                    data.current?.wind_direction_10m
                )
            },
            rows,
            dailyRows,
            uvMax: this._utils.asNumber(dailyUvs[0]),
            fetchedAt: new Date(),
            updatedAt: new Date()
        };
    }
};
