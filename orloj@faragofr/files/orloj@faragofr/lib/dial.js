// Cairo renderer for the orloj dial.
//
// Coordinate convention used throughout:
//   "dial angle" = degrees clockwise from the top of the dial.
//   (cx + r*sin(θ), cy - r*cos(θ)) maps a dial angle to canvas coords.
//
// Celestial bodies and zodiac divisions are placed by hour angle (LST − RA),
// so they sit at their true equatorial positions on the hour ring. Right
// ascension increases counter-clockwise on the dial (opposite daily motion).

const Cairo      = imports.cairo;
const Pango      = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;

const Theme = imports.theme;

// U+FE0E (text presentation selector) forces monochrome rendering.
const ZODIAC_GLYPHS = ["♈\uFE0E","♉\uFE0E","♊\uFE0E","♋\uFE0E","♌\uFE0E","♍\uFE0E",
                       "♎\uFE0E","♏\uFE0E","♐\uFE0E","♑\uFE0E","♒\uFE0E","♓\uFE0E"];
const ZODIAC_NAMES  = ["Aries","Taurus","Gemini","Cancer",
                       "Leo","Virgo","Libra","Scorpio",
                       "Sagittarius","Capricorn","Aquarius","Pisces"];
const PLANET_GLYPHS = {
    Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄"
};
const PLANET_ORDER = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

// The dial is designed against this logical size. At runtime the Cairo
// context is scaled by (actual size / REFERENCE_SIZE), so geometry, fonts,
// line widths and marker radii all scale uniformly from a single knob.
const REFERENCE_SIZE = 320;

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
        R_zod:      R * 0.84,
        R_zod_in:   R_body_out,
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

function drawText(cr, x, y, text, size, color, anchor) {
    setColor(cr, color);
    var layout = PangoCairo.create_layout(cr);
    layout.set_text(text, -1);
    var desc = Pango.FontDescription.from_string(Theme.FONT_FAMILY + " " + size);
    layout.set_font_description(desc);
    var [w, h] = layout.get_pixel_size();
    var dx = -w / 2;
    if (anchor === "left")  dx = 0;
    if (anchor === "right") dx = -w;
    cr.moveTo(x + dx, y - h / 2);
    PangoCairo.show_layout(cr, layout);
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

function drawHourRing(cr, cx, cy, ro, ri, s) {
    // Night part of hour ring: BACKGROUND (matches zodiac / below-horizon).
    setColor(cr, Theme.BACKGROUND);
    cr.arc(cx, cy, ro, 0, 2 * Math.PI);
    cr.arcNegative(cx, cy, ri, 2 * Math.PI, 0);
    cr.fill();

    // Daytime arc: SURFACE (matches above-horizon / center).
    if (s.sunriseDialAngle != null && s.sunsetDialAngle != null) {
        var a1 = (s.sunriseDialAngle - 90) * Math.PI / 180;
        var a2 = (s.sunsetDialAngle  - 90) * Math.PI / 180;
        setColor(cr, Theme.SURFACE);
        cr.arc(cx, cy, ro, a1, a2);
        cr.arcNegative(cx, cy, ri, a2, a1);
        cr.closePath();
        cr.fill();
    }

    strokeCircle(cr, cx, cy, ro, Theme.FAINT, Theme.HAIRLINE);
    strokeCircle(cr, cx, cy, ri, Theme.FAINT, Theme.HAIRLINE);

    var labelR = (ro + ri) / 2;
    for (var h = 0; h < 24; h++) {
        var angle = (h - 12) * 15;
        var major = (h % 6 === 0);
        var lit = s.sunriseDialAngle != null && s.sunsetDialAngle != null
               && angle > s.sunriseDialAngle && angle < s.sunsetDialAngle;
        radialTick(cr, cx, cy, ri, ro, angle,
                   lit ? Theme.BACKGROUND : (major ? Theme.DIM : Theme.FAINT),
                   Theme.HAIRLINE);
        var [lx, ly] = angleToXY(cx, cy, labelR, angle);
        var label = String(h === 0 ? 24 : h);
        drawText(cr, lx, ly, label, 8,
                 major ? Theme.FOREGROUND : Theme.DIM, "center");
    }
}


function drawZodiacRing(cr, cx, cy, ro, ri, s) {
    setColor(cr, Theme.BACKGROUND);
    cr.arc(cx, cy, ro, 0, 2 * Math.PI);
    cr.arcNegative(cx, cy, ri, 2 * Math.PI, 0);
    cr.fill();
    strokeCircle(cr, cx, cy, ro, Theme.FAINT, Theme.HAIRLINE);
    strokeCircle(cr, cx, cy, ri, Theme.FAINT, Theme.HAIRLINE);

    var labelR = (ro + ri) / 2;
    for (var i = 0; i < 12; i++) {
        var angBoundary = hourAngle(s.lstDeg, s.zodiacBoundaryRAs[i]);
        var angMid      = hourAngle(s.lstDeg, s.zodiacMidRAs[i]);

        radialTick(cr, cx, cy, ri, ro, angBoundary, Theme.FAINT, Theme.HAIRLINE);

        var [lx, ly] = angleToXY(cx, cy, labelR, angMid);
        drawText(cr, lx, ly, ZODIAC_GLYPHS[i], 11, Theme.DIM, "center");
    }

    // Vernal equinox (RA = 0°) on outer edge, near the hour ring.
    var eqAng = hourAngle(s.lstDeg, 0);
    var [ex, ey] = angleToXY(cx, cy, ro + 4, eqAng);
    drawStar(cr, ex, ey, 3.5, s.accent);

    // Anti-vernal point (RA = 180°) — coincides with LST on the hour ring.
    var antiAng = hourAngle(s.lstDeg, 180);
    var [ax, ay] = angleToXY(cx, cy, ro + 4, antiAng);
    drawStar(cr, ax, ay, 3.5, s.accent);
}


function drawCenter(cr, cx, cy, ri, s) {
    setColor(cr, Theme.SURFACE);
    cr.arc(cx, cy, ri, 0, 2 * Math.PI);
    cr.fill();
    strokeCircle(cr, cx, cy, ri, Theme.FAINT, Theme.HAIRLINE);

    // Local sidereal time by default, or civil time in the applet's display
    // zone; assembled in applet.js so the whole clock shares one zone.
    drawText(cr, cx, cy - 4, s.centerText || "--:--", 11, Theme.FOREGROUND, "center");
    drawText(cr, cx, cy + 9, s.centerSub  || "",       6, Theme.DIM,        "center");
}

// --- Celestial bodies ------------------------------------------------------

function drawMoonGlyph(cr, x, y, r, phaseAngle) {
    setColor(cr, Theme.SURFACE);
    cr.arc(x, y, r, 0, 2 * Math.PI);
    cr.fill();

    var a = r * Math.cos(phaseAngle * Math.PI / 180); // terminator x-offset
    var waxing = phaseAngle < 180;

    setColor(cr, Theme.FOREGROUND);
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

    strokeCircle(cr, x, y, r, Theme.DIM, Theme.HAIRLINE);
}

function bodyRadius(L, alt) {
    var t = Math.tanh((alt || 0) / 3);
    return L.R_horizon + t * L.halfLane / 2;
}

function drawCelestials(cr, L, s) {
    function opacity(name) {
        if (!s.altitudes || s.altitudes[name] == null) return 1.0;
        return s.altitudes[name] > 0 ? 1.0 : 0.35;
    }
    function dim(c, op) { return [c[0], c[1], c[2], c[3] * op]; }

    for (var i = 0; i < PLANET_ORDER.length; i++) {
        var name = PLANET_ORDER[i];
        var ra = s.planetRAs ? s.planetRAs[name] : null;
        if (ra == null) continue;
        var ang = hourAngle(s.lstDeg, ra);
        var r = bodyRadius(L, s.altitudes ? s.altitudes[name] : 0);
        var [px, py] = angleToXY(L.cx, L.cy, r, ang);
        drawText(cr, px, py, PLANET_GLYPHS[name], 12,
                 dim(Theme.FOREGROUND, opacity(name)), "center");
    }

    var moonAng = hourAngle(s.lstDeg, s.moonRA);
    var moonR = bodyRadius(L, s.altitudes.Moon);
    var [mx, my] = angleToXY(L.cx, L.cy, moonR, moonAng);
    var moonOp = opacity("Moon");
    if (moonOp < 1.0) {
        cr.pushGroup();
        drawMoonGlyph(cr, mx, my, 6.5, s.moonPhaseAngle);
        cr.popGroupToSource();
        cr.paintWithAlpha(moonOp);
    } else {
        drawMoonGlyph(cr, mx, my, 6.5, s.moonPhaseAngle);
    }

    // Sun glyph sits at its hour angle position, NOT on the time hand.
    // The gap between them visualizes the EoT + longitude/DST offset.
    var sunAng = hourAngle(s.lstDeg, s.sunRA);
    var sunR = bodyRadius(L, s.altitudes.Sun);
    var [sx, sy] = angleToXY(L.cx, L.cy, sunR, sunAng);
    setColor(cr, dim(s.accent, opacity("Sun")));
    cr.arc(sx, sy, 6, 0, 2 * Math.PI);
    cr.fill();
}

function drawHands(cr, cx, cy, ro, ri, s) {
    // Time hand: shows civil time on the hour ring (always fully visible).
    cr.setLineWidth(Theme.HAND);
    cr.setSourceRGBA(s.accent[0], s.accent[1], s.accent[2], s.accent[3]);
    var [s1x, s1y] = angleToXY(cx, cy, ri, s.timeHandAngle);
    var [s2x, s2y] = angleToXY(cx, cy, ro, s.timeHandAngle);
    cr.moveTo(s1x, s1y); cr.lineTo(s2x, s2y); cr.stroke();
}

// --- Top-level entry -------------------------------------------------------

var draw = function(cr, width, height, s) {
    // Draw in the fixed reference coordinate system; the transform scales
    // everything (including text and stroke widths) to the actual size.
    var f = Math.min(width, height) / REFERENCE_SIZE;
    if (f !== 1) cr.scale(f, f);
    var L = layout(REFERENCE_SIZE, REFERENCE_SIZE);

    setColor(cr, Theme.BACKGROUND);
    cr.rectangle(0, 0, REFERENCE_SIZE, REFERENCE_SIZE);
    cr.fill();

    setColor(cr, Theme.SURFACE);
    cr.arc(L.cx, L.cy, L.R, 0, 2 * Math.PI);
    cr.fill();

    drawHourRing    (cr, L.cx, L.cy, L.R_24, L.R_24_in, s);
    drawHands       (cr, L.cx, L.cy, L.R_24, L.R_24_in, s);
    drawZodiacRing  (cr, L.cx, L.cy, L.R_zod, L.R_zod_in, s);
    // Below-horizon lane: darker fill to distinguish from above-horizon.
    setColor(cr, Theme.BACKGROUND);
    cr.arc(L.cx, L.cy, L.R_horizon, 0, 2 * Math.PI);
    cr.arcNegative(L.cx, L.cy, L.R_body_in, 2 * Math.PI, 0);
    cr.fill();
    strokeCircle    (cr, L.cx, L.cy, L.R_horizon, Theme.FAINT, Theme.HAIRLINE);
    drawCenter      (cr, L.cx, L.cy, L.R_body_in, s);
    drawCelestials  (cr, L, s);
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

    var bestDist = 14;
    var bestLabel = null;
    function tryBody(ra, lon, name, extra) {
        var ang = hourAngle(s.lstDeg, ra);
        var br = bodyRadius(L, s.altitudes ? s.altitudes[name] : 0);
        var [bx, by] = angleToXY(L.cx, L.cy, br, ang);
        var d = Math.sqrt((x - bx) * (x - bx) + (y - by) * (y - by));
        if (d >= bestDist) return;
        var parts = [name + " in " + lonInfo(lon)];
        if (extra) parts.push(extra);
        if (s.altitudes && s.altitudes[name] != null) {
            var a = s.altitudes[name];
            parts.push((a > 0 ? "+" : "") + a.toFixed(0) + "°");
        }
        bestDist = d;
        bestLabel = parts.join(" — ");
    }

    tryBody(s.sunRA, s.sunLon, "Sun");
    var illum = (1 - Math.cos(s.moonPhaseAngle * Math.PI / 180)) / 2;
    tryBody(s.moonRA, s.moonLon, "Moon", Math.round(illum * 100) + "% illum.");
    if (s.planetRAs) {
        for (var i = 0; i < PLANET_ORDER.length; i++) {
            var p = PLANET_ORDER[i];
            if (s.planetRAs[p] != null) tryBody(s.planetRAs[p], s.planets[p], p);
        }
    }
    if (bestLabel) return bestLabel;

    // Time hand: check if pointer is within the hour ring and close to the hand angle.
    if (r >= L.R_24_in && r <= L.R_24) {
        var handDiff = ((angle - s.timeHandAngle) % 360 + 360) % 360;
        if (handDiff > 180) handDiff = 360 - handDiff;
        if (handDiff < 3) {
            var when = s.civilText || "--:--";
            var zone = s.tzAbbrev ? " " + s.tzAbbrev : "";
            return "Civil time " + when + zone;
        }
    }

    if (r >= L.R_zod_in && r <= L.R_zod) {
        // RA at this dial angle: RA = LST - hourAngle, hourAngle = angle on dial.
        var ra = ((s.lstDeg - angle) % 360 + 360) % 360;
        // Find which zodiac sector this RA falls in.
        for (var i = 11; i >= 0; i--) {
            if (ra >= s.zodiacBoundaryRAs[i]) return ZODIAC_NAMES[i];
        }
        return ZODIAC_NAMES[11]; // wrap: RA < boundary[0] means Pisces
    }

    return null;
};
