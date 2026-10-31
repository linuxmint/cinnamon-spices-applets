"""Monthly and yearly fresh-air reports: one-page A4 posters in a Bauhaus style.

`airthings.py report` collects the data and calls render_month() or
render_year(). Everything is drawn with Cairo: primary colours on paper,
geometric shapes carrying the data, URW Gothic for type. Overlapping shapes
are multiplied like printing inks.
"""

import calendar
import datetime as dt
import math
import statistics

import cairo

W, H = 595.28, 841.89  # A4 in points
M = 40                  # page margin
FONT = "URW Gothic"     # geometric sans; bold selects the Demi weight

PAPER = "#f3eee4"
TILE = "#e7e0d2"
INK = "#151515"
GREY = "#7a746a"
RED = "#d63a2a"
BLUE = "#1f4fa0"
YELLOW = "#f2b600"
WHITE = "#ffffff"


# --- primitives -----------------------------------------------------------

def _rgb(hexcolor):
    return tuple(int(hexcolor[i:i + 2], 16) / 255 for i in (1, 3, 5))


def color(cr, hexcolor, alpha=1.0):
    cr.set_source_rgba(*_rgb(hexcolor), alpha)


def font(cr, size, bold=False):
    cr.select_font_face(FONT, cairo.FONT_SLANT_NORMAL,
                        cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    cr.set_font_size(size)


def _runs(s):
    """Split text into (run, is_subscript); the toy font API has no subscript glyphs."""
    parts = s.split("₂")
    for i, part in enumerate(parts):
        if part:
            yield part, False
        if i < len(parts) - 1:
            yield "2", True


def width(cr, s, size, bold=False, tracking=0):
    total = 0
    for run, sub in _runs(s):
        font(cr, size * 0.7 if sub else size, bold)
        total += cr.text_extents(run).x_advance
    return total + tracking * size * max(0, len(s) - 1)


def text(cr, x, y, s, size=9, fill=INK, bold=False, align="left", tracking=0):
    """Draw text; `tracking` adds letter spacing as a fraction of the size."""
    w = width(cr, s, size, bold, tracking)
    if align == "center":
        x -= w / 2
    elif align == "right":
        x -= w
    color(cr, fill)
    for run, sub in _runs(s):
        font(cr, size * 0.7 if sub else size, bold)
        dy = size * 0.22 if sub else 0
        if tracking:
            for ch in run:
                cr.move_to(x, y + dy)
                cr.show_text(ch)
                x += cr.text_extents(ch).x_advance + tracking * size
        else:
            cr.move_to(x, y + dy)
            cr.show_text(run)
            x += cr.text_extents(run).x_advance
    return w


def label(cr, x, y, s, size=6.5, fill=INK, align="left"):
    """Small uppercase, letter-spaced label."""
    return text(cr, x, y, s.upper(), size, fill, bold=True, align=align, tracking=0.14)


def fit(cr, s, size, max_width, bold=True):
    while size > 6 and width(cr, s, size, bold) > max_width:
        size -= 1
    return size


def wrap(cr, s, size, max_width):
    lines, line = [], ""
    for word in s.split():
        trial = f"{line} {word}".strip()
        if line and width(cr, trial, size) > max_width:
            lines.append(line)
            line = word
        else:
            line = trial
    return lines + ([line] if line else [])


def circle(cr, x, y, r, fill, alpha=1.0):
    cr.new_path()
    color(cr, fill, alpha)
    cr.arc(x, y, r, 0, 2 * math.pi)
    cr.fill()


def rule(cr, x0, x1, y, lw=1, fill=INK):
    cr.new_path()
    color(cr, fill)
    cr.set_line_width(lw)
    cr.move_to(x0, y)
    cr.line_to(x1, y)
    cr.stroke()


def multiply(cr, on=True):
    cr.set_operator(cairo.OPERATOR_MULTIPLY if on else cairo.OPERATOR_OVER)


def nice_scale(lo, hi, ticks=4):
    if hi - lo < 1e-9:
        hi = lo + 1
    raw = (hi - lo) / ticks
    mag = 10 ** math.floor(math.log10(raw))
    step = next(s * mag for s in (1, 2, 2.5, 5, 10) if raw / mag <= s)
    return math.floor(lo / step) * step, math.ceil(hi / step) * step, step


def cap_value(values):
    """A scale maximum that ignores rare extremes, so they don't shrink everything else."""
    v = sorted(values)
    if len(v) >= 10:
        return min(v[-1], v[int(0.98 * (len(v) - 1))] * 2)
    return v[-1]


def fmt_minutes(m):
    if m is None:
        return "–"
    m = round(m)
    return f"{m} min" if m < 90 else f"{m // 60} h {m % 60:02d}"


def fmt_hours(h):
    return f"{h:.0f}" if h >= 10 else f"{h:.1f}"


def time_colour(hour):
    """Morning yellow, midday red, evening and night blue."""
    if 4 <= hour < 11:
        return YELLOW
    if 11 <= hour < 17:
        return RED
    return BLUE


def temp_colour(t):
    return BLUE if t < 8 else YELLOW if t < 18 else RED


def season_colour(month):
    return {12: BLUE, 1: BLUE, 2: BLUE, 3: YELLOW, 4: YELLOW, 5: YELLOW,
            6: RED, 7: RED, 8: RED}.get(month, INK)


# --- page -----------------------------------------------------------------

def page(path):
    surface = cairo.PDFSurface(path, W, H)
    cr = cairo.Context(surface)
    color(cr, PAPER)
    cr.paint()
    return surface, cr


def footer(cr, data, note):
    rule(cr, M, W - M, H - 36, 0.8)
    text(cr, M, H - 24, note, 6.5, GREY)
    text(cr, W - M, H - 24, data["footer"], 6.5, GREY, align="right")


def masthead(cr, title, title2, subtitle, title_size):
    label(cr, M, M + 12, "Fresh air", 7.5, RED)
    size = fit(cr, title, title_size, 300)
    y = M + 18 + size * 0.86
    text(cr, M - 2, y, title, size, INK, bold=True)
    if title2:
        y += size * 0.95
        text(cr, M - 2, y, title2, size, RED, bold=True)
    for i, line in enumerate(subtitle.split(" · ")):
        text(cr, M, y + 22 + i * 11, line, 8, GREY)


def composition(cr, x, y, airings, median, hours, target, hour_scale):
    """Three shapes, three numbers: airings (square), median time (circle), stale hours (half disc)."""
    sq = 100
    color(cr, BLUE)
    cr.rectangle(x, y, sq, sq)
    cr.fill()

    r = 40 + min(median or 0, 40) / 40 * 26
    cx, cy = x + 120, y + 72
    multiply(cr)
    circle(cr, cx, cy, r, RED)
    hr = 18 + min(hours / hour_scale, 1) ** 0.5 * 24
    hx, hy = x + 30, y + 182
    cr.new_path()
    color(cr, YELLOW)
    cr.arc(hx, hy, hr, math.pi, 2 * math.pi)
    cr.close_path()
    cr.fill()
    multiply(cr, False)

    text(cr, x + 10, y + 40, f"{airings:,}", fit(cr, f"{airings:,}", 34, 80), WHITE, bold=True)
    label(cr, x + 11, y + 54, "airings", 6, WHITE)
    value = f"{median:.0f}" if median is not None else "–"
    text(cr, cx, cy + 10, value, 44, WHITE, bold=True, align="center")
    label(cr, cx, cy + 26, "min to fresh air", 5.5, WHITE, align="center")
    label(cr, cx, cy + 34, "median", 5.5, WHITE, align="center")
    text(cr, hx + hr + 8, hy - 8, f"{fmt_hours(hours)} h", 17, INK, bold=True)
    label(cr, hx + hr + 9, hy + 1, f"CO₂ above {target:.0f} ppm", 5.5, INK)


def section(cr, x, y, title, note=None):
    label(cr, x, y, title, 7.5, INK)
    if note:
        text(cr, x, y + 11, note, 7, GREY)


# --- pieces ---------------------------------------------------------------

def weaving(cr, x, y, w, h, year, month, airings, spans, covered):
    """One line per day. Black: CO2 above target. Circles: airings, sized by time to fresh air."""
    days = calendar.monthrange(year, month)[1]
    lab = 22
    x0, x1 = x + lab, x + w
    row = h / days
    X = lambda hour: x0 + hour / 24 * (x1 - x0)

    for hour in range(0, 25, 6):
        cr.new_path()
        color(cr, INK, 0.18)
        cr.set_line_width(0.5)
        cr.move_to(X(hour), y - 2)
        cr.line_to(X(hour), y + h)
        cr.stroke()
        text(cr, X(hour), y - 7, f"{hour:02d}", 6.5, GREY, bold=True, align="center")

    cr.set_line_cap(cairo.LINE_CAP_ROUND)
    for d in range(1, days + 1):
        cy = y + (d - 0.5) * row
        date = dt.date(year, month, d)
        key = date.isoformat()
        has = key in covered
        text(cr, x + lab - 8, cy + 2.5, str(d), 7, (RED if date.weekday() >= 5 else INK) if has else GREY,
             bold=True, align="right")
        if not has:
            continue
        rule(cr, x0, x1, cy, 0.4, GREY)
        for h0, h1 in spans.get(key, []):
            if h1 - h0 >= 0.05:
                rule(cr, X(h0), X(h1), cy, 2.4)
    cr.set_line_cap(cairo.LINE_CAP_BUTT)

    if not airings:
        return None
    top = cap_value([a["minutes"] for a in airings])
    multiply(cr)
    for a in airings:
        s = dt.datetime.fromtimestamp(a["start"])
        hour = s.hour + s.minute / 60
        r = 1.8 + math.sqrt(min(a["minutes"], top) / top) * row * 0.95
        circle(cr, X(hour), y + (s.day - 0.5) * row, r, time_colour(hour), 0.92)
    multiply(cr, False)
    return top


def weaving_legend(cr, x, y, top, row, target):
    cr.set_line_cap(cairo.LINE_CAP_ROUND)
    rule(cr, x, x + 16, y - 2.5, 2.4)
    cr.set_line_cap(cairo.LINE_CAP_BUTT)
    lx = x + 22 + text(cr, x + 22, y, f"CO₂ above {target:.0f} ppm", 6.5, INK) + 14
    for fill, name in ((YELLOW, "morning"), (RED, "midday"), (BLUE, "evening")):
        circle(cr, lx + 4, y - 2.5, 4, fill)
        lx += 10 + text(cr, lx + 10, y, name, 6.5, INK) + 12
    if top:
        lx += 6
        for m in sorted({5, 15, round(top)}):
            if m <= top:
                r = 1.8 + math.sqrt(m / top) * row * 0.95
                circle(cr, lx + r, y - 2.5, r, INK, 0.85)
                lx += 2 * r + 3 + text(cr, lx + 2 * r + 3, y, f"{m} min", 6.5, GREY) + 9
        text(cr, lx, y, "to fresh air", 6.5, GREY)


def weather(cr, x, y, w, h, airings, note):
    """Outdoor temperature against time to fresh air."""
    pts = [(a["outdoor_temp"], a["minutes"]) for a in airings if a.get("outdoor_temp") is not None]
    if len(pts) < 3:
        color(cr, TILE)
        cr.rectangle(x, y, w, h)
        cr.fill()
        lines = wrap(cr, note or "Not enough airings with outdoor temperature yet", 7.5, w - 30)
        for i, line in enumerate(lines):
            text(cr, x + w / 2, y + h / 2 + 3 + (i - (len(lines) - 1) / 2) * 11, line, 7.5, GREY, align="center")
        return None
    left, bottom = x + 18, y + h - 12
    temps = [p[0] for p in pts]
    mins = [p[1] for p in pts]
    tmin, tmax, tstep = nice_scale(min(temps) - 1, max(temps) + 1, 5)
    v = sorted(mins)
    top = nice_scale(0, max(v[int(0.95 * (len(v) - 1))] * 1.5, v[len(v) // 2] * 2), 2)[1]
    X = lambda t: left + (t - tmin) / (tmax - tmin) * (x + w - left)
    Y = lambda v: bottom - min(v, top) / top * (bottom - y)

    cr.new_path()
    color(cr, INK)
    cr.set_line_width(1.4)
    cr.move_to(left, y)
    cr.line_to(left, bottom)
    cr.line_to(x + w, bottom)
    cr.stroke()
    t = tmin
    while t <= tmax + tstep / 2:
        text(cr, X(t), bottom + 9, f"{t:.0f}°", 6, GREY, bold=True, align="center")
        t += tstep
    text(cr, left - 4, y + 5, f"{top:.0f}", 6, GREY, bold=True, align="right")
    text(cr, left - 4, bottom, "0", 6, GREY, bold=True, align="right")
    label(cr, left + 4, y + 4, "min", 5, GREY)

    r = 3.2 if len(pts) < 150 else 2.2
    multiply(cr)
    for t, v in pts:
        if v <= top:
            circle(cr, X(t), Y(v), r, temp_colour(t), 0.8)
    multiply(cr, False)
    for t, v in pts:
        if v > top:  # beyond the scale: hollow marker on the top edge
            cr.new_path()
            color(cr, temp_colour(t))
            cr.set_line_width(1)
            cr.arc(X(t), y, r, 0, 2 * math.pi)
            cr.stroke()

    if len(pts) < 5 or max(temps) - min(temps) < 3:
        return None
    mt, mv = statistics.fmean(temps), statistics.fmean(mins)
    slope = sum((t - mt) * (v - mv) for t, v in pts) / sum((t - mt) ** 2 for t in temps)
    a, b = min(temps), max(temps)
    cr.new_path()
    color(cr, INK)
    cr.set_line_width(2.2)
    cr.set_line_cap(cairo.LINE_CAP_ROUND)
    cr.move_to(X(a), Y(mv + slope * (a - mt)))
    cr.line_to(X(b), Y(mv + slope * (b - mt)))
    cr.stroke()
    cr.set_line_cap(cairo.LINE_CAP_BUTT)
    return slope


def weather_verdict(cr, x, y, slope, w):
    if slope is None:
        return
    per10 = slope * 10
    if abs(per10) < 1:
        big, small = "≈ 0", "outdoor temperature made little difference to airing time"
    else:
        big = f"{'+' if per10 > 0 else '−'}{abs(per10):.0f} min"
        small = f"{'longer' if per10 > 0 else 'less'} to fresh air for every 10 °C warmer outside"
    text(cr, x, y, big, 22, INK, bold=True)
    for i, line in enumerate(wrap(cr, small, 7, w)):
        text(cr, x, y + 13 + i * 9, line, 7, GREY)


def clock(cr, cx, cy, r_in, r_out, counts):
    """24-hour dial: one wedge per hour, length = airings started in that hour."""
    peak = max(range(24), key=lambda h: counts[h])
    top = max(counts) or 1
    cr.new_path()
    color(cr, INK, 0.25)
    cr.set_line_width(0.5)
    cr.arc(cx, cy, r_out, 0, 2 * math.pi)
    cr.stroke()
    gap = 0.02
    for h in range(24):
        a0 = -math.pi / 2 + h / 24 * 2 * math.pi + gap
        a1 = -math.pi / 2 + (h + 1) / 24 * 2 * math.pi - gap
        rr = r_in + (counts[h] / top) * (r_out - r_in) if counts[h] else r_in + 1
        cr.new_path()
        color(cr, RED if h == peak and counts[h] else INK)
        cr.arc(cx, cy, rr, a0, a1)
        cr.arc_negative(cx, cy, r_in, a1, a0)
        cr.close_path()
        cr.fill()
    for h, (dx, dy) in ((0, (0, -1)), (6, (1, 0)), (12, (0, 1)), (18, (-1, 0))):
        text(cr, cx + dx * (r_out + 10), cy + dy * (r_out + 10) + 2.5, f"{h:02d}", 6.5, GREY,
             bold=True, align="center")
    if counts[peak]:
        text(cr, cx, cy + 1, f"{peak:02d}:00", 8.5, INK, bold=True, align="center")
        label(cr, cx, cy + 8, "peak", 4.2, GREY, align="center")


def seasons(cr, x, y, w, by_month):
    """Twelve circles in a row: area = median time to fresh air, colour = season."""
    medians = {m: statistics.median(v) for m, v in by_month.items() if v}
    top = max(medians.values(), default=1)
    slot = w / 12
    for m in range(1, 13):
        cx = x + slot * (m - 0.5)
        med = medians.get(m)
        if med is None:
            cr.new_path()
            color(cr, GREY)
            cr.set_line_width(0.8)
            cr.arc(cx, y, 4, 0, 2 * math.pi)
            cr.stroke()
        else:
            r = 5 + math.sqrt(med / top) * 16
            fill = season_colour(m)
            circle(cr, cx, y, r, fill)
            if r >= 11:
                text(cr, cx, y + 4, f"{med:.0f}", 11 if r < 17 else 13, INK if fill == YELLOW else WHITE,
                     bold=True, align="center")
            else:
                text(cr, cx, y - r - 4, f"{med:.0f}", 8, INK, bold=True, align="center")
        label(cr, cx, y + 34, calendar.month_abbr[m], 6.5, INK, align="center")
        n = len(by_month[m])
        text(cr, cx, y + 44, str(n) if n else "–", 6, GREY, align="center")


def tiles(cr, x, y, w, year, hours, covered):
    """Every day of the year as a tile; the quarter circle grows with hours of stale air."""
    lab = 26
    step = (w - lab) / 31
    s = step - 1.6
    top = max(hours.values(), default=0) or 1
    for m in range(1, 13):
        ty = y + (m - 1) * step
        label(cr, x, ty + s - 3, calendar.month_abbr[m], 5.5, INK)
        for d in range(1, calendar.monthrange(year, m)[1] + 1):
            tx = x + lab + (d - 1) * step
            date = dt.date(year, m, d)
            key = date.isoformat()
            if key not in covered:
                circle(cr, tx + s / 2, ty + s / 2, 0.8, GREY)
                continue
            color(cr, TILE)
            cr.rectangle(tx, ty, s, s)
            cr.fill()
            v = hours.get(key, 0)
            if v > 0:
                r = s * math.sqrt(v / top)
                cr.new_path()
                color(cr, RED if date.weekday() >= 5 else INK)
                cr.move_to(tx, ty + s)
                cr.arc(tx, ty + s, r, -math.pi / 2, 0)
                cr.close_path()
                cr.fill()
    return y + 12 * step


def tiles_legend(cr, x, y, top, target):
    s = 10
    lx = x
    for frac in (0.25, 1):
        color(cr, TILE)
        cr.rectangle(lx, y - s + 2, s, s)
        cr.fill()
        cr.new_path()
        color(cr, INK)
        cr.move_to(lx, y + 2)
        cr.arc(lx, y + 2, s * math.sqrt(frac), -math.pi / 2, 0)
        cr.close_path()
        cr.fill()
        lx += s + 4 + text(cr, lx + s + 4, y, f"{fmt_hours(top * frac)} h", 6.5, GREY) + 12
    text(cr, lx, y, f"a day's hours with CO₂ above {target:.0f} ppm · red: weekend · dot: no readings",
         6.5, GREY)


# --- reports --------------------------------------------------------------

def render_month(path, data):
    year, month, target = data["year"], data["month"], data["target"]
    airings = data["airings"]
    minutes = [a["minutes"] for a in airings]
    median = statistics.median(minutes) if minutes else None
    days = calendar.monthrange(year, month)[1]
    surface, cr = page(path)

    masthead(cr, calendar.month_name[month].upper(), str(year), data["subtitle"], 52)
    composition(cr, W - M - 190, M + 4, len(airings), median, sum(data["hours"].values()),
                target, hour_scale=24 * days * 0.6)
    rule(cr, M, W - M, 236, 3)

    section(cr, M, 258, "Every day of the month",
            "Each line is a day from midnight to midnight. Each circle is an airing: "
            "the bigger it is, the longer it took until the air was fresh.")
    top = weaving(cr, M, 296, W - 2 * M, 318, year, month, airings,
                  data.get("spans", {}), data["covered"])
    weaving_legend(cr, M + 22, 632, top, 318 / days, target)

    rule(cr, M, W - M, 650, 1)
    section(cr, M, 668, "Weather")
    slope = weather(cr, M, 680, 220, 104, airings, data.get("location_note"))
    weather_verdict(cr, M + 236, 712, slope, 110)

    counts = [0] * 24
    for a in airings:
        counts[dt.datetime.fromtimestamp(a["start"]).hour] += 1
    section(cr, W - M - 140, 668, "Rhythm")
    clock(cr, W - M - 60, 738, 20, 46, counts)

    extremes = (f"Fastest airing {fmt_minutes(min(minutes))}, slowest {fmt_minutes(max(minutes))}"
                if minutes else "No airings recorded")
    footer(cr, data, extremes)
    surface.finish()


def render_year(path, data):
    year, target = data["year"], data["target"]
    airings = data["airings"]
    minutes = [a["minutes"] for a in airings]
    median = statistics.median(minutes) if minutes else None
    by_month = {m: [a["minutes"] for a in airings if dt.datetime.fromtimestamp(a["start"]).month == m]
                for m in range(1, 13)}
    surface, cr = page(path)

    masthead(cr, str(year), None, data["subtitle"], 104)
    composition(cr, W - M - 190, M + 4, len(airings), median, sum(data["hours"].values()),
                target, hour_scale=24 * 365 * 0.6)
    rule(cr, M, W - M, 236, 3)

    section(cr, M, 258, "The seasons",
            "Median minutes to fresh air per month, airings below. "
            "Winter blue, spring yellow, summer red, autumn black.")
    seasons(cr, M, 316, W - 2 * M, by_month)

    rule(cr, M, W - M, 384, 1)
    section(cr, M, 402, "Day by day")
    bottom = tiles(cr, M, 414, W - 2 * M, year, data["hours"], data["covered"])
    tiles_legend(cr, M + 26, bottom + 12, max(data["hours"].values(), default=0), target)

    rule(cr, M, W - M, 640, 1)
    section(cr, M, 658, "Weather")
    slope = weather(cr, M + 170, 656, W - 2 * M - 170, 136, airings, data.get("location_note"))
    weather_verdict(cr, M, 712, slope, 140)

    known = {m: statistics.median(v) for m, v in by_month.items() if v}
    if known:
        q = min(known, key=known.get)
        s = max(known, key=known.get)
        note = (f"Quickest month {calendar.month_name[q]} ({fmt_minutes(known[q])}), "
                f"slowest {calendar.month_name[s]} ({fmt_minutes(known[s])})")
    else:
        note = "No airings recorded this year"
    footer(cr, data, note)
    surface.finish()
