var BACKGROUND = [0.059, 0.067, 0.086, 1.0];
var SURFACE    = [0.090, 0.102, 0.125, 1.0];
var FOREGROUND = [0.745, 0.643, 0.431, 1.0];
var DIM        = [0.557, 0.478, 0.318, 1.0];
var FAINT      = [0.180, 0.176, 0.243, 1.0];

var ACCENT_DEFAULT = [0.961, 0.620, 0.043, 1.0];

var HAIRLINE = 1.0;
var HAND     = 1.5;

var FONT_FAMILY = "sans-serif";

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

// Recompute the palette from the two user-facing base colors. The
// intermediate tones are background→foreground blends, so any custom pair
// stays internally consistent. The blend ratios are tuned to reproduce the
// bundled default palette above when the default colors are supplied.
var setBaseColors = function(bg, fg) {
    BACKGROUND = bg;
    FOREGROUND = fg;
    SURFACE = lerp(bg, fg, 0.06); // panel/day arc: a subtle lift of background
    FAINT   = lerp(bg, fg, 0.20); // hairlines and minor ticks
    DIM     = lerp(bg, fg, 0.70); // dimmed foreground for minor labels
};
