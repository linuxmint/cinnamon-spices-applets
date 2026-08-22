// Maps provider weather codes to bundled SVG icon names and paths.
// This module intentionally has no Cinnamon/GJS dependencies so its mapping
// logic can be tested with Node.js.

const JMA_CLEAR_CODES = new Set([100, 101, 110, 111]);
const JMA_CLOUD_CODES = new Set([
    200, 201, 202, 203, 209, 210, 211, 212, 213, 214,
    218, 219, 220, 221, 222, 223, 224, 225, 226
]);
const JMA_MIXED_CODES = new Set([
    102, 103, 106, 107, 108, 112, 113, 114, 118, 119,
    120, 121, 122, 125, 126, 127, 128, 130, 131, 132,
    140, 160, 170, 181, 204, 205, 206, 207, 208, 215,
    216, 217, 228, 229, 230, 231, 240, 250, 260, 270,
    281
]);
const JMA_RAIN_CODES = new Set([
    300, 301, 302, 303, 304, 306, 308, 309, 311,
    313, 314, 315, 316, 317, 320, 321, 322, 323,
    324, 325, 326, 327, 328, 329, 340, 350, 361,
    371
]);
const JMA_SNOW_CODES = new Set([
    400, 401, 402, 403, 405, 406, 407, 409, 411,
    413, 414, 420, 421, 422, 423, 425, 426, 427,
    450
]);

var IconService = class IconService {
    constructor(rootPath) {
        this._rootPath = String(rootPath || "").replace(/\/$/, "");
    }

    iconPath(name) {
        const safeName = /^[a-z0-9-]+$/.test(String(name || ""))
            ? String(name)
            : "unknown";
        return `${this._rootPath}/icons/${safeName}.svg`;
    }

    jmaIconName(code) {
        const value = Number(code);
        if (JMA_CLEAR_CODES.has(value))
            return "clear-day";
        if (JMA_CLOUD_CODES.has(value))
            return "cloudy";
        if (JMA_MIXED_CODES.has(value))
            return "partly-cloudy-day";
        if (JMA_RAIN_CODES.has(value))
            return "rain";
        if (JMA_SNOW_CODES.has(value))
            return "snow";
        return "unknown";
    }

    openMeteoIconName(code, isDay = true) {
        const value = Number(code);
        const daytime = isDay !== false && Number(isDay) !== 0;

        if (value === 0)
            return daytime ? "clear-day" : "clear-night";
        if ([1, 2].includes(value))
            return daytime ? "partly-cloudy-day" : "partly-cloudy-night";
        if (value === 3)
            return "cloudy";
        if ([45, 48].includes(value))
            return "fog";
        if ([51, 53, 55].includes(value))
            return "drizzle";
        if ([56, 57, 66, 67].includes(value))
            return "sleet";
        if ([61, 63, 80, 81].includes(value))
            return "rain";
        if ([65, 82].includes(value))
            return "heavy-rain";
        if ([71, 73, 75, 77, 85, 86].includes(value))
            return "snow";
        if ([95, 96, 99].includes(value))
            return "thunderstorm";
        return "unknown";
    }

    openMeteoForecastIconName(row) {
        const codeName = this.openMeteoIconName(row?.code, row?.isDay);
        if (codeName !== "unknown" && [
            "drizzle", "sleet", "rain", "heavy-rain",
            "snow", "thunderstorm"
        ].includes(codeName))
            return codeName;

        const amounts = [row?.precipitation, row?.rain, row?.showers]
            .map(Number)
            .filter(Number.isFinite);
        if (amounts.some(value => value > 0))
            return "rain";

        return codeName;
    }

    currentIconName(jmaCode, openMeteoCode, isDay = true) {
        // Open-Meteo supplies a current-condition code and day/night flag,
        // while JMA supplies the official daily forecast. Prefer the current
        // condition for the live icon and use JMA as a reliable fallback.
        if (openMeteoCode !== null && openMeteoCode !== undefined && openMeteoCode !== "") {
            const currentName = this.openMeteoIconName(openMeteoCode, isDay);
            if (currentName !== "unknown")
                return currentName;
        }
        return this.jmaIconName(jmaCode);
    }

    dailyIconName(code) {
        const value = Number(code);
        return value >= 100
            ? this.jmaIconName(value)
            : this.openMeteoIconName(value, true);
    }
};
