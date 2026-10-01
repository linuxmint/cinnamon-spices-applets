// Palette and stroke constants.
//
// Three user-facing colors (background, foreground, daylight) derive every
// tone the dial paints:
//   SURFACE   plate under the rings, a subtle lift of background
//   FAINT     hairlines and minor ticks
//   DIM       dimmed foreground for minor labels and below-horizon glyphs
//   GROUND    below-horizon fill — the darkest value on the dial
//   DAY       fully-lit sky
//   BRIGHT    lifted foreground, for the few marks that must lead; kept at
//             4.5:1 against DAY so custom palettes stay legible
//   SHADOW    near-black, for the 1px offset under ring numerals
//   skyColor() maps a solar altitude to a sky value
//
// makePalette() returns these as a plain object rather than mutating module
// state, because the applet allows several panel instances and each one
// carries its own colors. Only the values that no setting can change —
// stroke widths, the font, and the parse fallbacks — live at module scope.

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

// WCAG 2.1 relative luminance and contrast ratio. Used only to keep BRIGHT
// legible against the daylight sky once the user is free to pick both.
var relLuminance = function(c) {
    var f = function(u) {
        return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};

var contrastRatio = function(a, b) {
    var la = relLuminance(a), lb = relLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// Build a palette from the user-facing base colors. The intermediate tones are
// background→foreground blends, so any custom pair stays internally
// consistent: every tone moves with the pair instead of being pinned to the
// values the bundled defaults happen to produce.
//
// `day` is the fully-lit sky. Unlike the tones above it does not track the
// background, so a custom background wants a matching daylight color chosen
// with it. Passing null falls back to a lift of the background.
//
// The foreground itself is never painted — BRIGHT and DIM cover every mark —
// so it is not part of the result.
var makePalette = function(bg, fg, day) {
    var P = {
        BACKGROUND: bg,
        SURFACE:    lerp(bg, fg, 0.06), // panel/center: a subtle lift of background
        FAINT:      lerp(bg, fg, 0.20), // hairlines and minor ticks
        DIM:        lerp(bg, fg, 0.70)  // dimmed foreground for minor labels
    };

    // The ground is background pushed further down, never toward the
    // foreground: it has to stay the darkest thing on the dial so that DIM
    // glyphs sitting on it keep their contrast.
    P.GROUND = [bg[0] * 0.66, bg[1] * 0.70, bg[2] * 0.78, 1.0];
    P.SHADOW = [P.GROUND[0], P.GROUND[1], P.GROUND[2], 0.55];

    // The fallback lifts the background along its own hue — NOT toward the
    // foreground. Blending toward a warm foreground lands the daytime sky
    // between the two poles of the palette, where it reads as mud.
    P.DAY = day ? [day[0], day[1], day[2], 1.0]
                : [clamp(bg[0] * 3.2 + 0.012, 0, 1),
                   clamp(bg[1] * 3.1 + 0.014, 0, 1),
                   clamp(bg[2] * 3.2 + 0.014, 0, 1),
                   1.0];

    // BRIGHT lifts the foreground toward white rather than toward a fixed
    // warm off-white, so a cool or saturated foreground keeps its character
    // instead of being tinted. Then the legibility guard: BRIGHT draws the
    // 8px ring numerals over the daylight sky, and a dark saturated
    // foreground (deep red, deep blue) lands short of the 4.5:1 that small
    // text needs, so keep lifting until it clears. Hue is what gives way,
    // because on a dark plate the only way to raise contrast is to raise
    // luminance. Skipped when the daylight sky is itself light, where lifting
    // would make things worse — the palette assumes the dark plate the Orloj
    // is built on. With the schema defaults BRIGHT clears the guard on its
    // own, at 6.8:1.
    P.BRIGHT = lerp(fg, WHITE, 0.35);
    for (var i = 0; i < 20 && relLuminance(P.DAY) < 0.5 &&
                    contrastRatio(P.BRIGHT, P.DAY) < 4.5; i++)
        P.BRIGHT = lerp(P.BRIGHT, WHITE, 0.10);

    return P;
};

// Sky value for a given solar altitude, in degrees.
//
//   L  ramps 0 → 1 between −18° (astronomical night) and +6°, so the sky
//      equals the plate through the night and is fully lit after sunrise.
//   w  is a bell centred just under the horizon: the golden hour, and the
//      only place the accent enters the sky at all.
var skyColor = function(P, altDeg, accent) {
    var L = clamp((altDeg + 18) / 24, 0, 1);
    var base = lerp(P.BACKGROUND, P.DAY, L);
    var w = Math.exp(-Math.pow((altDeg + 1) / 7, 2));
    return lerp(base, accent || ACCENT_DEFAULT, 0.22 * w);
};
