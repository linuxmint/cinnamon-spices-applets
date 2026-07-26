// Shared weather parsing and icon helpers.
// Exported with `var` for Cinnamon/GJS legacy module compatibility.

var firstValue = function(values) {
    if (!Array.isArray(values))
        return null;

    for (const value of values) {
        if (value !== null && value !== undefined && String(value).trim() !== "")
            return String(value);
    }
    return null;
};

var asNumber = function(value) {
    if (value === null || value === undefined || value === "")
        return null;

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

var dateKey = function(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

var weatherIcon = function(code) {
    const n = Number(code);

    if ([100, 101, 110, 111].includes(n))
        return "☀";
    if ([200, 201, 202, 203, 209, 210, 211, 212, 213, 214,
         218, 219, 220, 221, 222, 223, 224, 225, 226].includes(n))
        return "☁";
    if ([102, 103, 106, 107, 108, 112, 113, 114, 118, 119,
         120, 121, 122, 125, 126, 127, 128, 130, 131, 132,
         140, 160, 170, 181, 204, 205, 206, 207, 208, 215,
         216, 217, 228, 229, 230, 231, 240, 250, 260, 270,
         281].includes(n))
        return "🌦";
    if ([300, 301, 302, 303, 304, 306, 308, 309, 311,
         313, 314, 315, 316, 317, 320, 321, 322, 323,
         324, 325, 326, 327, 328, 329, 340, 350, 361,
         371].includes(n))
        return "🌧";
    if ([400, 401, 402, 403, 405, 406, 407, 409, 411,
         413, 414, 420, 421, 422, 423, 425, 426, 427,
         450].includes(n))
        return "❄";

    return "☁";
};

var openMeteoIcon = function(code, isDay) {
    const n = Number(code);

    if (n === 0)
        return isDay ? "☀" : "🌙";
    if ([1, 2].includes(n))
        return isDay ? "🌤" : "☁";
    if (n === 3)
        return "☁";
    if ([45, 48].includes(n))
        return "🌫";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(n))
        return "🌧";
    if ([71, 73, 75, 77, 85, 86].includes(n))
        return "❄";
    if ([95, 96, 99].includes(n))
        return "⛈";

    return "☁";
};
