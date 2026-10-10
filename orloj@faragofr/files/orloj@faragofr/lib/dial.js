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
// The dial has one governing idea: a single sky function, Theme.skyColor(),
// is painted onto two surfaces.
//   - the hour ring, evaluated at all 24 hours   → the whole day's light
//   - the sky band, evaluated at the current sun → what it looks like now
// Sunrise and sunset are therefore not drawn; they emerge as the two places
// the ring turns gold, and they are correct at any date and latitude.
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
//                      every planet; geometric (no refraction), and
//                      topocentric for the Moon

const Cairo      = imports.cairo;
const Pango      = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;

const Theme     = imports.theme;
// The dial samples the sky at its own choice of hour angles, so it needs the
// altitude formula itself, not a precomputed value. Astronomy is stateless and
// toolkit-free, so depending on it here keeps the ring's resolution a
// rendering decision instead of leaking it into applet.js.
const Astronomy = imports.astronomy;

// U+FE0E (text presentation selector) forces monochrome rendering.
const ZODIAC_GLYPHS = ["♈\uFE0E","♉\uFE0E","♊\uFE0E","♋\uFE0E","♌\uFE0E","♍\uFE0E",
                       "♎\uFE0E","♏\uFE0E","♐\uFE0E","♑\uFE0E","♒\uFE0E","♓\uFE0E"];
const ZODIAC_NAMES  = ["Aries","Taurus","Gemini","Cancer",
                       "Leo","Virgo","Libra","Scorpio",
                       "Sagittarius","Capricorn","Aquarius","Pisces"];
// Planet glyphs carry U+FE0E for the same reason the zodiac ones do: without
// it several of these fall through to a colour emoji font.
const PLANET_GLYPHS = {
    Mercury: "☿\uFE0E", Venus: "♀\uFE0E", Mars: "♂\uFE0E",
    Jupiter: "♃\uFE0E", Saturn: "♄\uFE0E"
};
// Drawing and hit-testing order, taken from the ephemeris so the set of
// bodies is defined in exactly one place.
const PLANETS = Astronomy.PLANETS;

// The dial is designed against this logical size. At runtime the Cairo
// context is scaled by (actual size / REFERENCE_SIZE), so geometry, fonts,
// line widths and marker radii all scale uniformly from a single knob.
var REFERENCE_SIZE = 320;

// Hour-ring resolution. Segments overlap slightly so no seam is visible:
// the ring must read as one continuous sweep, not as 24 ticks in disguise.
const RING_SEGMENTS = 144;
const RING_OVERLAP  = 0.18;   // fraction of a segment, each side

// Altitude, in degrees, that fills one hemisphere of the body lane. tanh
// saturates gently, so ±30° uses most of the lane while the ±60° the Sun and
// planets actually reach still resolves.
const ALT_SCALE = 30;

// The lane positions a marker's *centre*, so its usable half-height is the
// lane's half-height minus the marker's own half-extent. GLYPH_R is the
// largest half-extent: Venus at 12pt measures 8.5 about its centre, against
// 6.5 for the moon and 6 for the sun disc. One shared value keeps radius
// comparable between bodies, so two objects at the same altitude still sit on
// the same circle; subtracting it exactly is what keeps the largest glyph
// clear of the zodiac ring at full altitude and of the centre disc at full
// depth.
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
        // The zodiac ring's inner edge and the body lane's outer edge are the
        // same circle, and stay so by construction rather than by agreement.
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

function drawText(cr, x, y, text, size, color, anchor, track, weight) {
    setColor(cr, color);
    var layout = textLayout(cr, text, size, track, weight);
    var [w, h] = layout.get_pixel_size();
    var dx = -w / 2;
    if (anchor === "left")  dx = 0;
    if (anchor === "right") dx = -w;
    cr.moveTo(x + dx, y - h / 2);
    PangoCairo.show_layout(cr, layout);
}

// Pango metrics for a string, without drawing it. drawText both measures and
// draws, which is no use when a group has to be laid out before anything is
// put down. The ink extents come back alongside the logical box because the
// box carries ascent/descent padding — for "16:10" at 17pt that is 8px above
// and 7px below — so spacing that should read as blank space has to be
// measured on the ink, not on the box.
function measureText(cr, text, size, track) {
    var [ink, log] = textLayout(cr, text, size, track).get_pixel_extents();
    return { w: log.width, h: log.height,
             inkLeft: ink.x, inkTop: ink.y, inkH: ink.height };
}

// `track` is extra letter spacing in reference pixels. Pango puts it between
// glyphs only — a 3-letter string grows by twice the value, and the ink still
// starts where it did — so a tracked string needs no centring compensation.
// `weight` is an optional Pango style word such as "Bold".
function textLayout(cr, text, size, track, weight) {
    var layout = PangoCairo.create_layout(cr);
    layout.set_text(text, -1);
    layout.set_font_description(Pango.FontDescription.from_string(
        Theme.FONT_FAMILY + (weight ? " " + weight : "") + " " + size));
    if (track) {
        var attrs = new Pango.AttrList();
        attrs.insert(Pango.attr_letter_spacing_new(
            Math.round(track * Pango.SCALE)));
        layout.set_attributes(attrs);
    }
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

// The hour ring, painted with the sky function evaluated hour by hour. The
// daytime arc, the twilight seams and the night are all one gradient; there
// is nothing left to highlight separately.
function drawHourRing(cr, cx, cy, ro, ri, s, P) {
    // Solar noon, in the ring's civil-time coordinates. Dial angle doubles as
    // hour angle (hourAngle() returns it directly), so the sun is on the
    // meridian when the dial angle is 0; the hand marks the civil moment that
    // is happening now. The gap between them is the whole EoT + longitude +
    // DST offset, and subtracting it converts any civil hour on the ring into
    // the sun's hour angle at that moment.
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

    // The ring carries a continuous value, so it takes numerals every third
    // hour and nothing else: tick marks would interrupt the gradient to mark
    // divisions the numerals already give. A 1px offset shadow keeps them
    // legible where the band changes value underneath them.
    //
    // Every numeral is BRIGHT, because the band under them runs from night
    // through the golden hour to full day, and only BRIGHT holds 4.5:1 across
    // all of it (5.25:1 at worst with the defaults; DIM falls to 2.1:1 at the
    // golden hour). The major hours are set apart by weight instead, which
    // also does not depend on telling two tones apart.
    var labelR = (ro + ri) / 2;
    for (var h = 0; h < 24; h += 3) {
        var angle = (h - 12) * 15;
        var weight = (h % 6 === 0) ? "Bold" : null;
        var [lx, ly] = angleToXY(cx, cy, labelR, angle);
        var label = String(h === 0 ? 24 : h);
        drawText(cr, lx + 0.6, ly + 0.6, label, 8, P.SHADOW, "center", 0, weight);
        drawText(cr, lx, ly, label, 8, P.BRIGHT, "center", 0, weight);
    }
}


// The zodiac band is defined by its own boundaries: twelve rules running the
// full depth of the ring, edge to edge. The rules alone carry the division,
// so the band takes neither a fill nor an outline — three marks for one job
// would read as three signals.
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

// Vernal equinox (RA 0°) and the anti-vernal point (RA 180°), which is where
// LST is read. They sit ON the hour ring's inner edge, because what they mark
// is an hour.
function drawEquinoxStars(cr, cx, cy, edgeR, s) {
    var r = edgeR - 0.6;
    var [ex, ey] = angleToXY(cx, cy, r, hourAngle(s.lstDeg, 0));
    drawStar(cr, ex, ey, 3.5, s.accent);
    var [ax, ay] = angleToXY(cx, cy, r, hourAngle(s.lstDeg, 180));
    drawStar(cr, ax, ay, 3.5, s.accent);
}


// Sky band and ground. The band takes the current sky value; the ground is
// flat and always the darkest value on the dial. Once the sky carries the
// continuous variable, the ground only has to carry a binary one.
function drawSkyAndGround(cr, L, s, P) {
    setColor(cr, Theme.skyColor(P, s.altitudes.Sun, s.accent));
    cr.arc(L.cx, L.cy, L.R_body_out, 0, 2 * Math.PI);
    cr.fill();

    setColor(cr, P.GROUND);
    cr.arc(L.cx, L.cy, L.R_horizon, 0, 2 * Math.PI);
    cr.fill();

    // Depth marks kept as hairlines rather than fills. The Sun is the one
    // body whose exact depth matters, and it is the one that crosses them.
    strokeCircle(cr, L.cx, L.cy, bodyRadius(L, -6),  P.FAINT, Theme.HAIRLINE);
    strokeCircle(cr, L.cx, L.cy, bodyRadius(L, -18), P.FAINT, Theme.HAIRLINE);

    // The one line on the dial that means something physical.
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

    // Civil time is not repeated here: the system clock has it, and the hand
    // carries it on the ring. LST is what this dial is for, so it is sized to
    // the disc it sits in rather than to the ring labels: the disc's radius in
    // reference space is 43.1, and 17.5pt leaves 11px of clearance even for
    // the widest reading.
    //
    // TIME is 17.5 rather than a round number because the hinted font
    // quantizes here: 17 and 17.5 give digit ink 55 and 56px wide, while 17.75
    // and 18 both give 59, so 17.5 is the only genuine step between the two.
    // The digits' ink height is grid-fitted to 17px across that whole range,
    // so a larger TIME widens the block without making it any taller.
    //
    // LABEL matches the ring numerals, so the dial has one small-text size
    // instead of two, and STAR_R matches drawEquinoxStars — that equality is
    // what makes the star read as a reference to the ring marker rather than
    // as decoration. INK_GAP is blank space between the digits and the label,
    // measured on the ink, so it is the gap the eye actually sees.
    var TIME = 17.5, LABEL = 8, STAR_R = 3.5, GAP = 5, INK_GAP = 8;

    // Measure first, then place, so the row's gap, the block's centring and
    // the space between the two lines are all real values rather than tuned
    // offsets. The block is centred on its ink: the middle of the disc is the
    // middle of what is actually drawn, not of Pango's padded boxes.
    //
    // TRACK spaces the letters by the same blank the star leaves before the L,
    // so the row reads as four evenly spaced marks. Two corrections to get the
    // gap the eye actually sees: the star's widest points are at
    // ±cos(18°)·STAR_R rather than ±STAR_R, and Pango's "L" carries a left
    // side bearing. L, S and T all have zero bearing on the facing sides, so
    // the tracking value is the inter-letter blank directly.
    var t  = measureText(cr, lst,   TIME);
    var l0 = measureText(cr, "LST", LABEL);
    var starEdge = STAR_R + STAR_R * Math.cos(Math.PI / 10);
    var TRACK = GAP + l0.inkLeft + (STAR_R * 2 - starEdge);
    var l = measureText(cr, "LST", LABEL, TRACK);

    var tInkY = cy - (t.inkH + INK_GAP + l.inkH) / 2; // top of the digits' ink
    var lInkY = tInkY + t.inkH + INK_GAP;             // top of the label's ink

    drawText(cr, cx, tInkY - t.inkTop + t.h / 2, lst, TIME, P.BRIGHT, "center");

    // The star repeats the ring marker LST is read from, so the number names
    // the mark it comes from. It sits on the label's ink centre, not the box
    // centre, so the two line up optically.
    var total = STAR_R * 2 + GAP + l.w;
    var x0    = cx - total / 2;
    drawStar(cr, x0 + STAR_R, lInkY + l.inkH / 2, STAR_R, s.accent);
    drawText(cr, x0 + STAR_R * 2 + GAP, lInkY - l.inkTop + l.h / 2,
             "LST", LABEL, P.DIM, "left", TRACK);
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
    // Below the horizon is expressed by position and by weight, never by
    // alpha: DIM on the near-black ground measures 4.6:1 and reads as quiet,
    // where the same color at 35% alpha over that ground falls to 1.5:1 and
    // is simply lost.
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
    // Filled means above the horizon, hollow means below — a binary the eye
    // reads instantly, at full contrast either way. "Above" is judged at
    // SUN_H0, the altitude the panel's sunrise and sunset are computed for,
    // so the glyph fills at the moment the panel names. The drawn horizon
    // line is at 0°, so the switch happens 0.6 reference pixels below it.
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
    // A dark underlay first — the ring changes value under the hand, and this
    // is the trick that keeps a watch hand legible over any dial.
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

    // Bodies in conjunction really are in the same place, so the dial does
    // not spread them apart. The tooltip does the separating instead:
    // collect EVERY body inside the hit radius, nearest first, and name them
    // all. Costs nothing to draw and resolves the ambiguity at exactly the
    // moment the user asks about it.
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
        // Rounded before formatting: toFixed(0) keeps the sign of a value
        // that rounds to zero, printing −0.3° as "-0°". Math.round gives −0
        // there, which converts to "0".
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
