// Cairo renderer for the orloj dial.
//
// Coordinate convention used throughout:
//   "dial angle" = degrees clockwise from the top of the dial.
//   (cx + r*sin(θ), cy - r*cos(θ)) maps a dial angle to canvas coords.
//
// Celestial bodies and zodiac divisions are placed by hour angle (LST − RA),
// so they sit at their true equatorial positions on the hour ring. Right
// ascension increases counter-clockwise on the dial (opposite daily motion).
//
// The state object `s` that draw() and hitTest() take is built in one place,
// applet.js `_refresh()`, and every field is required:
//   now                Date, civil time, for the time-hand tooltip
//   latitude           observer latitude, degrees north positive
//   palette            a Theme.makePalette() result
//   accent             accent color, [r,g,b,a]
//   sunLon, moonLon    ecliptic longitude, degrees
//   planets            { name: ecliptic longitude } for Astronomy.PLANETS
//   sunRA, moonRA      right ascension, degrees
//   sunDec             solar declination, degrees
//   planetRAs          { name: right ascension }
//   moonPhaseAngle     0 new, 90 first quarter, 180 full, 270 last
//   zodiacBoundaryRAs  RA of each 30° ecliptic boundary, ascending from 0
//   zodiacMidRAs       RA of each sign's midpoint
//   timeHandAngle      dial angle of civil time
//   lstDeg             local mean sidereal time, degrees
//   altitudes          { name: altitude in degrees } for the Sun, Moon and
//                      every planet; geometric (no refraction)

const Pango      = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;

const Theme     = require("./lib/theme");
const Astronomy = require("./lib/astronomy");

// U+FE0E (text presentation selector) forces monochrome rendering.
const ZODIAC_GLYPHS = ["♈\uFE0E","♉\uFE0E","♊\uFE0E","♋\uFE0E","♌\uFE0E","♍\uFE0E",
                       "♎\uFE0E","♏\uFE0E","♐\uFE0E","♑\uFE0E","♒\uFE0E","♓\uFE0E"];
const ZODIAC_NAMES  = ["Aries","Taurus","Gemini","Cancer",
                       "Leo","Virgo","Libra","Scorpio",
                       "Sagittarius","Capricorn","Aquarius","Pisces"];
const PLANET_GLYPHS = {
    Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄"
};
const PLANETS = Astronomy.PLANETS;

// The dial is designed against this logical size. At runtime the Cairo
// context is scaled by (actual size / REFERENCE_SIZE), so geometry, fonts,
// line widths and marker radii all scale uniformly from a single knob.
var REFERENCE_SIZE = 320;

// Hour-ring resolution; segments overlap slightly so no seam shows.
const RING_SEGMENTS = 144;
const RING_OVERLAP  = 0.18;   // fraction of a segment, each side

// Altitude scale, in degrees, of the tanh mapping in bodyRadius().
const ALT_SCALE = 30;

// Largest marker half-extent (Venus at 12pt) and a margin, which bodyRadius()
// keeps clear of the lane edges.
const GLYPH_R  = 8.5;
const LANE_PAD = 1.5;

// Concentric ring radii as fractions of R, the inscribed dial radius.
// `layout(w, h)` resolves these to pixels for both drawing and hit-testing.
function layout(width, height) {
    var R = Math.min(width, height) / 2 - 6;
    var R_body_out = R * 0.70;
    var R_body_in  = R * 0.28;
    var halfLane   = (R_body_out - R_body_in) / 2;
    return {
        cx:         width  / 2,
        cy:         height / 2,
        R:          R,
        R_24:       R * 0.97,
        R_24_in:    R * 0.86,
        R_body_out: R_body_out,
        R_body_in:  R_body_in,
        R_horizon:  R_body_in + halfLane,
        halfLane:   halfLane
    };
}

function setColor(cr, c) {
    cr.setSourceRGBA(c[0], c[1], c[2], c[3]);
}

function angleToXY(cx, cy, r, angleDeg) {
    var a = angleDeg * Math.PI / 180;
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

// Hour angle on the dial: LST − RA, in degrees.
function hourAngle(lstDeg, raDeg) {
    return lstDeg - raDeg;
}

function drawText(cr, x, y, text, size, color, anchor, weight) {
    setColor(cr, color);
    var layout = textLayout(cr, text, size, weight);
    var [w, h] = layout.get_pixel_size();
    var dx = -w / 2;
    if (anchor === "left")  dx = 0;
    if (anchor === "right") dx = -w;
    cr.moveTo(x + dx, y - h / 2);
    PangoCairo.show_layout(cr, layout);
}

function measureText(cr, text, size) {
    var [ink, log] = textLayout(cr, text, size).get_pixel_extents();
    return { w: log.width, h: log.height, inkTop: ink.y, inkH: ink.height };
}

// `weight` is an optional Pango style word such as "Bold".
function textLayout(cr, text, size, weight) {
    var layout = PangoCairo.create_layout(cr);
    layout.set_text(text, -1);
    layout.set_font_description(Pango.FontDescription.from_string(
        Theme.FONT_FAMILY + (weight ? " " + weight : "") + " " + size));
    return layout;
}

// Five-pointed star centered at (x, y) with given outer radius.
function drawStar(cr, x, y, r, color) {
    setColor(cr, color);
    var inner = r * 0.38;
    cr.moveTo(x, y - r);
    for (var i = 1; i < 10; i++) {
        var a = i * Math.PI / 5 - Math.PI / 2;
        var rad = (i % 2 === 0) ? r : inner;
        cr.lineTo(x + rad * Math.cos(a), y + rad * Math.sin(a));
    }
    cr.closePath();
    cr.fill();
}

function strokeCircle(cr, cx, cy, r, color, width) {
    setColor(cr, color);
    cr.setLineWidth(width);
    cr.newPath();
    cr.arc(cx, cy, r, 0, 2 * Math.PI);
    cr.stroke();
}

function radialTick(cr, cx, cy, r1, r2, angleDeg, color, width) {
    var [x1, y1] = angleToXY(cx, cy, r1, angleDeg);
    var [x2, y2] = angleToXY(cx, cy, r2, angleDeg);
    setColor(cr, color);
    cr.setLineWidth(width);
    cr.moveTo(x1, y1);
    cr.lineTo(x2, y2);
    cr.stroke();
}


// --- Ring renderers --------------------------------------------------------

// The hour ring, painted with the sky color of each hour of the day.
function drawHourRing(cr, cx, cy, ro, ri, s, P) {
    // Solar noon in the ring's civil-time coordinates: the offset between the
    // time hand and the sun's hour angle (EoT + longitude + DST).
    var noon = s.timeHandAngle - hourAngle(s.lstDeg, s.sunRA);
    var step = 360 / RING_SEGMENTS;
    var ov   = step * RING_OVERLAP;

    for (var i = 0; i < RING_SEGMENTS; i++) {
        var ang = -180 + i * step + step / 2;
        var alt = Astronomy.altitude(s.latitude, s.sunDec, ang - noon);
        setColor(cr, Theme.skyColor(P, alt, s.accent));
        var a1 = (ang - step / 2 - ov - 90) * Math.PI / 180;
        var a2 = (ang + step / 2 + ov - 90) * Math.PI / 180;
        cr.arc(cx, cy, ro, a1, a2);
        cr.arcNegative(cx, cy, ri, a2, a1);
        cr.closePath();
        cr.fill();
    }

    strokeCircle(cr, cx, cy, ro, P.FAINT, Theme.HAIRLINE);
    strokeCircle(cr, cx, cy, ri, P.FAINT, Theme.HAIRLINE);

    // Numerals every third hour, BRIGHT over an offset shadow; major hours bold.
    var labelR = (ro + ri) / 2;
    for (var h = 0; h < 24; h += 3) {
        var angle = (h - 12) * 15;
        var weight = (h % 6 === 0) ? "Bold" : null;
        var [lx, ly] = angleToXY(cx, cy, labelR, angle);
        var label = String(h === 0 ? 24 : h);
        drawText(cr, lx + 0.6, ly + 0.6, label, 8, P.SHADOW, "center", weight);
        drawText(cr, lx, ly, label, 8, P.BRIGHT, "center", weight);
    }
}


// Zodiac band: boundary rules and sign glyphs.
function drawZodiacRing(cr, cx, cy, ro, ri, s, P) {
    var labelR = (ro + ri) / 2;
    for (var i = 0; i < 12; i++) {
        var angBoundary = hourAngle(s.lstDeg, s.zodiacBoundaryRAs[i]);
        var angMid      = hourAngle(s.lstDeg, s.zodiacMidRAs[i]);

        radialTick(cr, cx, cy, ri, ro, angBoundary, P.FAINT, Theme.HAIRLINE);

        var [lx, ly] = angleToXY(cx, cy, labelR, angMid);
        drawText(cr, lx, ly, ZODIAC_GLYPHS[i], 11, P.DIM, "center");
    }
}

// Vernal equinox (RA 0°) and the anti-vernal point (RA 180°), where LST is
// read, on the hour ring's inner edge.
function drawEquinoxStars(cr, cx, cy, edgeR, s) {
    var r = edgeR - 0.6;
    var [ex, ey] = angleToXY(cx, cy, r, hourAngle(s.lstDeg, 0));
    drawStar(cr, ex, ey, 3.5, s.accent);
    var [ax, ay] = angleToXY(cx, cy, r, hourAngle(s.lstDeg, 180));
    drawStar(cr, ax, ay, 3.5, s.accent);
}


// Sky band in the current sky color, ground below the horizon.
function drawSkyAndGround(cr, L, s, P) {
    setColor(cr, Theme.skyColor(P, s.altitudes.Sun, s.accent));
    cr.arc(L.cx, L.cy, L.R_body_out, 0, 2 * Math.PI);
    cr.fill();

    setColor(cr, P.GROUND);
    cr.arc(L.cx, L.cy, L.R_horizon, 0, 2 * Math.PI);
    cr.fill();

    // Civil (−6°) and astronomical (−18°) twilight marks.
    strokeCircle(cr, L.cx, L.cy, bodyRadius(L, -6),  P.FAINT, Theme.HAIRLINE);
    strokeCircle(cr, L.cx, L.cy, bodyRadius(L, -18), P.FAINT, Theme.HAIRLINE);

    strokeCircle(cr, L.cx, L.cy, L.R_horizon, P.DIM, Theme.HAIRLINE);
}


function drawCenter(cr, cx, cy, ri, s, P) {
    setColor(cr, P.GROUND);
    cr.arc(cx, cy, ri, 0, 2 * Math.PI);
    cr.fill();
    strokeCircle(cr, cx, cy, ri, P.FAINT, Theme.HAIRLINE);

    var hours = s.lstDeg / 15;
    var hh = Math.floor(hours);
    var mm = Math.floor((hours - hh) * 60);
    var lst = String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");

    var TIME = 17.5, LABEL = 8, STAR_R = 3.5, GAP = 4, INK_GAP = 8;
    var LABEL_TEXT = "L\u2002S\u2002T";

    var t =measureText(cr, lst,        TIME);
    var l = measureText(cr, LABEL_TEXT, LABEL);

    var tInkY = cy - (t.inkH + INK_GAP + l.inkH) / 2; // top of the digits' ink
    var lInkY = tInkY + t.inkH + INK_GAP;             // top of the label's ink

    drawText(cr, cx, tInkY - t.inkTop + t.h / 2, lst, TIME, P.BRIGHT, "center");

    var total = STAR_R * 2 + GAP + l.w;
    var x0    = cx - total / 2;
    drawStar(cr, x0 + STAR_R, lInkY + l.inkH / 2, STAR_R, s.accent);
    drawText(cr, x0 + STAR_R * 2 + GAP, lInkY - l.inkTop + l.h / 2,
             LABEL_TEXT, LABEL, P.DIM, "left");
}

// --- Celestial bodies ------------------------------------------------------

function drawMoonGlyph(cr, x, y, r, phaseAngle, P) {
    setColor(cr, P.GROUND);
    cr.arc(x, y, r, 0, 2 * Math.PI);
    cr.fill();

    var a = r * Math.cos(phaseAngle * Math.PI / 180); // terminator x-offset
    var waxing = phaseAngle < 180;

    setColor(cr, P.BRIGHT);
    cr.save();
    cr.translate(x, y);

    cr.moveTo(0, -r);
    if (waxing) {
        cr.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    } else {
        cr.arcNegative(0, 0, r, -Math.PI / 2, Math.PI / 2);
    }
    var sign = waxing ? 1 : -1;
    var steps = 32;
    for (var i = 1; i <= steps; i++) {
        var t = Math.PI / 2 - Math.PI * (i / steps);
        cr.lineTo(sign * a * Math.cos(t), r * Math.sin(t));
    }
    cr.closePath();
    cr.fill();
    cr.restore();

    strokeCircle(cr, x, y, r, P.DIM, Theme.HAIRLINE);
}

function bodyRadius(L, alt) {
    var t = Math.tanh(alt / ALT_SCALE);
    return L.R_horizon + t * (L.halfLane - GLYPH_R - LANE_PAD);
}

function drawCelestials(cr, L, s, P) {
    // Planets below the horizon are drawn in DIM rather than faded.
    for (var i = 0; i < PLANETS.length; i++) {
        var name = PLANETS[i];
        var ang = hourAngle(s.lstDeg, s.planetRAs[name]);
        var r = bodyRadius(L, s.altitudes[name]);
        var [px, py] = angleToXY(L.cx, L.cy, r, ang);
        drawText(cr, px, py, PLANET_GLYPHS[name], 12,
                 s.altitudes[name] > Astronomy.PLANET_H0 ? P.BRIGHT : P.DIM,
                 "center");
    }

    var moonAng = hourAngle(s.lstDeg, s.moonRA);
    var moonR = bodyRadius(L, s.altitudes.Moon);
    var [mx, my] = angleToXY(L.cx, L.cy, moonR, moonAng);
    drawMoonGlyph(cr, mx, my, 6.5, s.moonPhaseAngle, P);

    // Sun glyph sits at its hour angle position, NOT on the time hand.
    // The gap between them visualizes the EoT + longitude/DST offset.
    // Filled above SUN_H0, the altitude the panel's sunrise and sunset use,
    // hollow below.
    var sunAng = hourAngle(s.lstDeg, s.sunRA);
    var sunR = bodyRadius(L, s.altitudes.Sun);
    var [sx, sy] = angleToXY(L.cx, L.cy, sunR, sunAng);
    setColor(cr, s.accent);
    if (s.altitudes.Sun > Astronomy.SUN_H0) {
        cr.arc(sx, sy, 6, 0, 2 * Math.PI);
        cr.fill();
    } else {
        cr.setLineWidth(Theme.HAND);
        cr.newPath();
        cr.arc(sx, sy, 5.5, 0, 2 * Math.PI);
        cr.stroke();
    }
}

function drawHands(cr, cx, cy, ro, ri, s, P) {
    // Time hand: shows civil time on the hour ring (always fully visible).
    var [s1x, s1y] = angleToXY(cx, cy, ri, s.timeHandAngle);
    var [s2x, s2y] = angleToXY(cx, cy, ro, s.timeHandAngle);

    cr.setLineWidth(Theme.HAND * 2.2);
    setColor(cr, P.SHADOW);
    cr.moveTo(s1x, s1y); cr.lineTo(s2x, s2y); cr.stroke();

    cr.setLineWidth(Theme.HAND);
    setColor(cr, s.accent);
    cr.moveTo(s1x, s1y); cr.lineTo(s2x, s2y); cr.stroke();

    setColor(cr, s.accent);
    cr.arc(s2x, s2y, Theme.HAND * 1.4, 0, 2 * Math.PI);
    cr.fill();
}

// --- Top-level entry -------------------------------------------------------

var draw = function(cr, width, height, s) {
    // Draw in the fixed reference coordinate system; the transform scales
    // everything (including text and stroke widths) to the actual size.
    var f = Math.min(width, height) / REFERENCE_SIZE;
    if (f !== 1) cr.scale(f, f);
    var L = layout(REFERENCE_SIZE, REFERENCE_SIZE);
    var P = s.palette;

    setColor(cr, P.BACKGROUND);
    cr.rectangle(0, 0, REFERENCE_SIZE, REFERENCE_SIZE);
    cr.fill();

    setColor(cr, P.SURFACE);
    cr.arc(L.cx, L.cy, L.R, 0, 2 * Math.PI);
    cr.fill();

    drawHourRing      (cr, L.cx, L.cy, L.R_24, L.R_24_in, s, P);
    drawZodiacRing    (cr, L.cx, L.cy, L.R_24_in, L.R_body_out, s, P);
    drawEquinoxStars  (cr, L.cx, L.cy, L.R_24_in, s);
    drawSkyAndGround  (cr, L, s, P);
    drawHands         (cr, L.cx, L.cy, L.R_24, L.R_24_in, s, P);
    drawCenter        (cr, L.cx, L.cy, L.R_body_in, s, P);
    drawCelestials    (cr, L, s, P);
};

// Returns a label string for the body or zodiac region under (x, y),
// or null if nothing identifiable is there.
var hitTest = function(width, height, s, x, y) {
    if (!s) return null;
    // Map the pointer back into the reference coordinate system the dial is
    // drawn in, so hit radii stay consistent at any dial size.
    var f = Math.min(width, height) / REFERENCE_SIZE;
    var L = layout(REFERENCE_SIZE, REFERENCE_SIZE);
    x /= f; y /= f;
    var dx = x - L.cx, dy = y - L.cy;
    var r = Math.sqrt(dx * dx + dy * dy);
    var angle = ((Math.atan2(dx, -dy) * 180 / Math.PI) % 360 + 360) % 360;

    function lonInfo(lon) {
        var n = ((lon % 360) + 360) % 360;
        var idx = Math.floor(n / 30);
        return ZODIAC_NAMES[idx] + " " + (n - idx * 30).toFixed(1) + "°";
    }

    // The tooltip lists every body within the hit radius, nearest first.
    var HIT = 14;
    var found = [];
    function tryBody(ra, lon, name, extra) {
        var ang = hourAngle(s.lstDeg, ra);
        var br = bodyRadius(L, s.altitudes[name]);
        var [bx, by] = angleToXY(L.cx, L.cy, br, ang);
        var d = Math.sqrt((x - bx) * (x - bx) + (y - by) * (y - by));
        if (d >= HIT) return;
        var parts = [name + " in " + lonInfo(lon)];
        if (extra) parts.push(extra);
        // Math.round, not toFixed(0), which would print "-0°".
        var a = Math.round(s.altitudes[name]);
        parts.push((a > 0 ? "+" : "") + a + "°");
        found.push({ d: d, label: parts.join(" — ") });
    }

    tryBody(s.sunRA, s.sunLon, "Sun");
    var illum = (1 - Math.cos(s.moonPhaseAngle * Math.PI / 180)) / 2;
    tryBody(s.moonRA, s.moonLon, "Moon", Math.round(illum * 100) + "% illum.");
    for (var i = 0; i < PLANETS.length; i++)
        tryBody(s.planetRAs[PLANETS[i]], s.planets[PLANETS[i]], PLANETS[i]);

    if (found.length) {
        found.sort(function(a, b) { return a.d - b.d; });
        return found.map(function(f) { return f.label; }).join("\n");
    }

    // Time hand: check if pointer is within the hour ring and close to the hand angle.
    if (r >= L.R_24_in && r <= L.R_24) {
        var handDiff = ((angle - s.timeHandAngle) % 360 + 360) % 360;
        if (handDiff > 180) handDiff = 360 - handDiff;
        if (handDiff < 3) {
            var hh = String(s.now.getHours()).padStart(2, "0");
            var mm = String(s.now.getMinutes()).padStart(2, "0");
            return "Civil time " + hh + ":" + mm;
        }
    }

    if (r >= L.R_body_out && r <= L.R_24_in) {
        // RA at this dial angle: RA = LST - hourAngle, hourAngle = angle on dial.
        var ra = ((s.lstDeg - angle) % 360 + 360) % 360;
        // zodiacBoundaryRAs ascends from exactly 0 — the vernal equinox is the
        // Aries boundary by definition — so a descending scan over a
        // normalized RA always finds its sector.
        for (var z = 11; z >= 0; z--)
            if (ra >= s.zodiacBoundaryRAs[z]) return ZODIAC_NAMES[z];
    }

    return null;
};
