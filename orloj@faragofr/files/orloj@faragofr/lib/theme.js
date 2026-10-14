// Palette and stroke constants.
//
// Background, foreground and daylight derive every tone below; skyColor()
// also blends in the accent.
//   SURFACE   plate under the rings, a subtle lift of background
//   FAINT     hairlines and zodiac boundaries
//   DIM       dimmed foreground for minor labels and below-horizon glyphs
//   GROUND    below-horizon fill — the darkest value on the dial
//   DAY       fully-lit sky
//   BRIGHT    lifted foreground, for the few marks that must lead
//   SHADOW    translucent GROUND, under ring numerals and the time hand
//   skyColor() maps a solar altitude to a sky value

var HAIRLINE = 1.0;
var HAND     = 1.5;

var FONT_FAMILY = "sans-serif";

// Fallbacks for parseColor, matching settings-schema.json's defaults.
var BACKGROUND_DEFAULT = [0.059, 0.067, 0.086, 1.0];
var FOREGROUND_DEFAULT = [0.745, 0.643, 0.431, 1.0];
var ACCENT_DEFAULT     = [0.961, 0.620, 0.043, 1.0];

var WHITE = [1.0, 1.0, 1.0, 1.0];

var parseColor = function(str, fallback) {
    if (!str) return fallback;
    var m = str.match(/rgba?\(([^)]+)\)/i);
    if (!m) return fallback;
    var parts = m[1].split(",").map(function(s) { return parseFloat(s.trim()); });
    if (parts.length < 3) return fallback;
    return [parts[0]/255, parts[1]/255, parts[2]/255, parts.length >= 4 ? parts[3] : 1.0];
};

var lerp = function(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
            a[3] + (b[3] - a[3]) * t];
};

var clamp = function(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };

// Build a palette from the user-facing base colors. The intermediate tones are
// background→foreground blends, so any custom pair stays internally
// consistent. `day` is the fully-lit sky; null falls back to a lift of the
// background.
var makePalette = function(bg, fg, day) {
    var P = {
        BACKGROUND: bg,
        SURFACE:    lerp(bg, fg, 0.06), // plate under the rings
        FAINT:      lerp(bg, fg, 0.20), // hairlines and zodiac boundaries
        DIM:        lerp(bg, fg, 0.70)  // dimmed foreground for minor labels
    };

    // Background darkened: the darkest value on the dial.
    P.GROUND = [bg[0] * 0.66, bg[1] * 0.70, bg[2] * 0.78, 1.0];
    P.SHADOW = [P.GROUND[0], P.GROUND[1], P.GROUND[2], 0.55];

    // Fallback: the background lifted along its own hue.
    P.DAY = day ? [day[0], day[1], day[2], 1.0]
                : [clamp(bg[0] * 3.2 + 0.012, 0, 1),
                   clamp(bg[1] * 3.1 + 0.014, 0, 1),
                   clamp(bg[2] * 3.2 + 0.014, 0, 1),
                   1.0];

    P.BRIGHT = lerp(fg, WHITE, 0.35);

    return P;
};

// Sky value for a given solar altitude, in degrees.
//
//   L  ramps 0 → 1 between −18° (astronomical night) and +6°.
//   w  is a bell centred just under the horizon: the golden hour.
var skyColor = function(P, altDeg, accent) {
    var L = clamp((altDeg + 18) / 24, 0, 1);
    var base = lerp(P.BACKGROUND, P.DAY, L);
    var w = Math.exp(-Math.pow((altDeg + 1) / 7, 2));
    return lerp(base, accent || ACCENT_DEFAULT, 0.22 * w);
};
