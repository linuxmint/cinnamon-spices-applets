#!/usr/bin/env python3
"""Airthings Wave BLE reader and history store for the Cinnamon applet.

Every subcommand prints exactly one JSON document on stdout, so the applet
can parse the result without caring about log output on stderr.

    airthings.py scan                      list Airthings devices in range
    airthings.py poll [--address MAC]      read the sensor and store the values
    airthings.py history --hours 24        aggregated history for the graphs
    airthings.py geocode "Oslo, NO"        look up a place with Open-Meteo
    airthings.py outdoor --lat .. --lon .. outdoor pressure history (Open-Meteo)
    airthings.py report --month 2026-10    fresh-air report as PDF (or --year 2026)
    airthings.py demo --days 30            fill a database with fake readings
"""

import argparse
import asyncio
import datetime
import json
import math
import os
import random
import re
import sqlite3
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

MANUFACTURER_ID = 0x0334  # Airthings AS

CHAR_WAVE_PLUS = "b42e2a68-ade7-11e4-89d3-123b93f75cba"
CHAR_WAVE_2 = "b42e4dcc-ade7-11e4-89d3-123b93f75cba"
CHAR_WAVE_MINI = "b42e3b98-ade7-11e4-89d3-123b93f75cba"
CHAR_WAVE1_TEMP = "00002a6e-0000-1000-8000-00805f9b34fb"
CHAR_WAVE1_HUMIDITY = "00002a6f-0000-1000-8000-00805f9b34fb"
CHAR_WAVE1_RADON_ST = "b42e01aa-ade7-11e4-89d3-123b93f75cba"
CHAR_WAVE1_RADON_LT = "b42e0a4c-ade7-11e4-89d3-123b93f75cba"

# First four digits of the serial number identify the model.
MODELS = {
    "2900": "Wave",
    "2920": "Wave Mini",
    "2930": "Wave Plus",
    "2950": "Wave Radon",
}

METRICS = ("temperature", "humidity", "radon_st", "radon_lt", "co2", "voc", "pressure")

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_MAX_PAST_DAYS = 92
OUTDOOR_CACHE_SECONDS = 1800

CACHE_DIR = os.path.join(
    os.environ.get("XDG_CACHE_HOME") or os.path.expanduser("~/.cache"),
    "airthings-applet",
)

DEFAULT_DB = os.path.join(
    os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"),
    "airthings-applet",
    "history.db",
)


class HelperError(Exception):
    pass


# --- decoding -------------------------------------------------------------

def _radon(value):
    # The sensor reports values above 16383 while it has no valid reading yet
    # (first hour after power-up).
    return value if 0 <= value <= 16383 else None


def _u16(value):
    return None if value == 0xFFFF else value


def decode_wave_plus(raw):
    d = struct.unpack_from("<4B8H", raw)
    if d[0] != 1:
        raise HelperError(f"Unsupported Wave Plus data version {d[0]}")
    return {
        "humidity": d[1] / 2.0,
        "radon_st": _radon(d[4]),
        "radon_lt": _radon(d[5]),
        "temperature": d[6] / 100.0,
        "pressure": d[7] / 50.0,
        "co2": _u16(d[8]),
        "voc": _u16(d[9]),
    }


def decode_wave_2(raw):
    d = struct.unpack_from("<4B8H", raw)
    if d[0] != 1:
        raise HelperError(f"Unsupported Wave data version {d[0]}")
    return {
        "humidity": d[1] / 2.0,
        "radon_st": _radon(d[4]),
        "radon_lt": _radon(d[5]),
        "temperature": d[6] / 100.0,
    }


def decode_wave_mini(raw):
    d = struct.unpack_from("<6H", raw)
    return {
        "temperature": round(d[1] / 100.0 - 273.15, 2),
        "pressure": d[2] / 50.0,
        "humidity": d[3] / 100.0,
        "voc": _u16(d[4]),
    }


async def read_values(client):
    services = client.services

    def has(uuid):
        return services.get_characteristic(uuid) is not None

    if has(CHAR_WAVE_PLUS):
        return "Wave Plus", decode_wave_plus(await client.read_gatt_char(CHAR_WAVE_PLUS))
    if has(CHAR_WAVE_2):
        return "Wave Radon", decode_wave_2(await client.read_gatt_char(CHAR_WAVE_2))
    if has(CHAR_WAVE_MINI):
        return "Wave Mini", decode_wave_mini(await client.read_gatt_char(CHAR_WAVE_MINI))
    if has(CHAR_WAVE1_RADON_ST):
        temp = struct.unpack("<h", await client.read_gatt_char(CHAR_WAVE1_TEMP))[0]
        hum = struct.unpack("<H", await client.read_gatt_char(CHAR_WAVE1_HUMIDITY))[0]
        rst = struct.unpack("<H", await client.read_gatt_char(CHAR_WAVE1_RADON_ST))[0]
        rlt = struct.unpack("<H", await client.read_gatt_char(CHAR_WAVE1_RADON_LT))[0]
        return "Wave", {
            "temperature": temp / 100.0,
            "humidity": hum / 100.0,
            "radon_st": _radon(rst),
            "radon_lt": _radon(rlt),
        }
    raise HelperError("Connected, but this does not look like a supported Airthings Wave")


# --- bluetooth ------------------------------------------------------------

def _bleak():
    try:
        import bleak
    except ImportError:
        raise HelperError(
            "python3-bleak is not installed (sudo dnf install python3-bleak, "
            "or pip install --user bleak)"
        )
    return bleak


async def scan_devices(timeout):
    bleak = _bleak()
    found = await bleak.BleakScanner.discover(timeout=timeout, return_adv=True)
    devices = []
    for device, adv in found.values():
        data = adv.manufacturer_data.get(MANUFACTURER_ID)
        if not data or len(data) < 4:
            continue
        serial = str(int.from_bytes(data[:4], "little"))
        devices.append({
            "address": device.address,
            "name": device.name or "",
            "serial": serial,
            "model": MODELS.get(serial[:4], f"Airthings {serial[:4]}"),
            "rssi": adv.rssi,
            "_device": device,
        })
    devices.sort(key=lambda d: d["rssi"] if d["rssi"] is not None else -999, reverse=True)
    return devices


async def poll_device(address, timeout):
    bleak = _bleak()
    serial = None
    target = address
    if not address:
        devices = await scan_devices(timeout)
        if not devices:
            raise HelperError("No Airthings device found nearby")
        target = devices[0]["_device"]
        address = devices[0]["address"]
        serial = devices[0]["serial"]

    last_error = None
    for attempt in range(2):  # BLE connections are flaky; retry once
        try:
            async with bleak.BleakClient(target, timeout=timeout) as client:
                model, values = await read_values(client)
            return {"address": address, "serial": serial, "model": model, "values": values}
        except HelperError:
            raise
        except Exception as e:  # bleak raises a variety of dbus/timeout errors
            last_error = e
            await asyncio.sleep(2)
    raise HelperError(f"Could not read {address}: {last_error or 'timeout'}")


# --- storage --------------------------------------------------------------

def open_db(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS readings ("
        " ts INTEGER NOT NULL, address TEXT NOT NULL,"
        + ",".join(f" {m} REAL" for m in METRICS)
        + ")"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS readings_addr_ts ON readings(address, ts)")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS devices ("
        " address TEXT PRIMARY KEY, model TEXT, serial TEXT, last_seen INTEGER)"
    )
    # Past airings: CO2 falling from a peak to the healthy level. `rate` is the
    # fitted air exchange rate (1/s), which lets us predict future airings.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS co2_airings ("
        " address TEXT NOT NULL, start_ts INTEGER NOT NULL, end_ts INTEGER NOT NULL,"
        " peak REAL NOT NULL, target REAL NOT NULL, rate REAL NOT NULL,"
        " PRIMARY KEY (address, start_ts))"
    )
    columns = {r[1] for r in conn.execute("PRAGMA table_info(co2_airings)")}
    if "outdoor_temp" not in columns:
        conn.execute("ALTER TABLE co2_airings ADD COLUMN outdoor_temp REAL")
    return conn


def store(conn, ts, result, retention_days):
    v = result["values"]
    conn.execute(
        f"INSERT INTO readings (ts, address, {', '.join(METRICS)})"
        f" VALUES (?, ?, {', '.join('?' * len(METRICS))})",
        [ts, result["address"]] + [v.get(m) for m in METRICS],
    )
    conn.execute(
        "INSERT INTO devices (address, model, serial, last_seen) VALUES (?, ?, ?, ?)"
        " ON CONFLICT(address) DO UPDATE SET model = excluded.model,"
        " serial = COALESCE(excluded.serial, devices.serial), last_seen = excluded.last_seen",
        (result["address"], result["model"], result["serial"], ts),
    )
    if retention_days > 0:
        conn.execute("DELETE FROM readings WHERE ts < ?", (ts - retention_days * 86400,))
    conn.commit()


# --- co2 airing estimate --------------------------------------------------
#
# When a room is aired, CO2 decays exponentially towards the outdoor level:
#     C(t) = B + (C0 - B) * exp(-rate * t)
# Each past decline from a peak down through the healthy level gives a rate.
# The median of recent rates predicts how long the next airing will take.

CO2_BASELINE = 420.0       # outdoor CO2, ppm
CO2_NOISE = 15             # ppm of jitter tolerated within a decline
AIRING_MIN_DROP = 150      # ppm; smaller dips are not airings
AIRING_MAX_SECONDS = 3 * 3600
MAX_GAP = 1800             # seconds without readings that breaks a series


def _decline_start(series, i):
    """Index where the (noisy) decline that ends at series[i] began."""
    j = i
    while (j > 0 and series[j][0] - series[j - 1][0] <= MAX_GAP
           and series[j - 1][1] >= series[j][1] - CO2_NOISE):
        j -= 1
    peak = max(range(j, i + 1), key=lambda k: series[k][1])
    # Skip a plateau at the peak so the duration covers only the decline.
    while peak < i and series[peak + 1][1] >= series[peak][1] - CO2_NOISE:
        peak += 1
    return peak


def _rate(c_from, c_to, seconds):
    if seconds <= 0 or c_to <= CO2_BASELINE or c_from <= c_to:
        return None
    return math.log((c_from - CO2_BASELINE) / (c_to - CO2_BASELINE)) / seconds


def detect_airings(series, target):
    airings = []
    for i in range(1, len(series)):
        (t0, c0), (t1, c1) = series[i - 1], series[i]
        if not (c0 >= target > c1) or t1 - t0 > MAX_GAP:
            continue
        s = _decline_start(series, i)
        ts, peak = series[s]
        # Time the level was crossed, interpolated between the two readings.
        end = t0 + (c0 - target) / (c0 - c1) * (t1 - t0)
        if peak - target < AIRING_MIN_DROP or not 0 < end - ts <= AIRING_MAX_SECONDS:
            continue
        rate = _rate(peak, target, end - ts)
        if rate:
            airings.append((ts, int(end), peak, rate))
    return airings


def _co2_series(conn, address, since):
    return conn.execute(
        "SELECT ts, co2 FROM readings WHERE address = ? AND ts >= ? AND co2 IS NOT NULL ORDER BY ts",
        (address, since),
    ).fetchall()


def update_airings(conn, address, target):
    last = conn.execute(
        "SELECT MAX(end_ts) FROM co2_airings WHERE address = ?", (address,)
    ).fetchone()[0]
    since = last - AIRING_MAX_SECONDS if last else 0
    for ts, end, peak, rate in detect_airings(_co2_series(conn, address, since), target):
        conn.execute(
            "INSERT OR IGNORE INTO co2_airings (address, start_ts, end_ts, peak, target, rate)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (address, ts, end, peak, target, rate),
        )
    conn.commit()


def _median(values):
    v = sorted(values)
    n = len(v)
    return None if not n else (v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2)


def co2_insight(conn, address, target):
    update_airings(conn, address, target)
    now = int(time.time())
    past = conn.execute(
        "SELECT start_ts, end_ts, peak, target, rate FROM co2_airings WHERE address = ?"
        " ORDER BY start_ts DESC LIMIT 10",
        (address,),
    ).fetchall()
    count = conn.execute(
        "SELECT COUNT(*) FROM co2_airings WHERE address = ?", (address,)
    ).fetchone()[0]
    typical_rate = _median([r[4] for r in past])

    info = {"target": target, "baseline": CO2_BASELINE, "airings": count,
            "typical_rate": typical_rate,
            "typical_minutes": _median([(r[1] - r[0]) / 60 for r in past]),
            "last": None, "current": None, "current_ts": None,
            "mode": None, "rate": None, "eta_seconds": None, "decline_start": None}
    if past:
        r = past[0]
        info["last"] = {"start": r[0], "end": r[1], "peak": r[2], "target": r[3],
                        "minutes": round((r[1] - r[0]) / 60)}

    recent = _co2_series(conn, address, now - 6 * 3600)
    if not recent:
        return info
    cur_ts, cur = recent[-1]
    info["current"], info["current_ts"] = cur, cur_ts
    if cur <= target or now - cur_ts > MAX_GAP:
        return info

    # Already falling? Then the observed rate beats the historical one.
    rate = None
    s = _decline_start(recent, len(recent) - 1)
    start_ts, start_c = recent[s]
    if start_c - cur >= 50 and cur_ts - start_ts >= 600:
        rate = _rate(start_c, cur, cur_ts - start_ts)
    if rate:
        info["mode"] = "falling"
        info["decline_start"] = {"ts": start_ts, "co2": start_c}
    elif typical_rate:
        info["mode"] = "if_aired"
        rate = typical_rate
    else:
        info["mode"] = "unknown"
        return info
    info["rate"] = rate
    needed = math.log((cur - CO2_BASELINE) / (target - CO2_BASELINE)) / rate
    if info["mode"] == "falling":
        needed -= now - cur_ts
    info["eta_seconds"] = max(0, int(needed))
    return info


# --- reports --------------------------------------------------------------

def fill_outdoor_temps(conn, address, lat, lon, start_ts, end_ts):
    """Attach the outdoor temperature at the start of each airing that lacks one."""
    missing = [r[0] for r in conn.execute(
        "SELECT start_ts FROM co2_airings WHERE address = ? AND start_ts >= ? AND start_ts < ?"
        " AND outdoor_temp IS NULL", (address, start_ts, end_ts))]
    if not missing:
        return
    series = hourly_weather(lat, lon, "temperature_2m", min(missing) - 3600, max(missing) + 3600)
    for ts in missing:
        hour = ts - ts % 3600
        value = series.get(hour, series.get(hour + 3600))
        if value is not None:
            conn.execute("UPDATE co2_airings SET outdoor_temp = ? WHERE address = ? AND start_ts = ?",
                         (value, address, ts))
    conn.commit()


def hours_above(conn, address, target, start_ts, end_ts):
    """Per local day: hours with CO2 above target, the stretches (start/end hour) when
    it was, and the set of days that have readings at all."""
    hours, spans, covered = {}, {}, set()

    def add(day, h0, h1):
        key = day.isoformat()
        hours[key] = hours.get(key, 0) + h1 - h0
        day_spans = spans.setdefault(key, [])
        if day_spans and h0 - day_spans[-1][1] < 0.02:
            day_spans[-1][1] = h1
        else:
            day_spans.append([h0, h1])

    prev = None
    for ts, c in conn.execute(
            "SELECT ts, co2 FROM readings WHERE address = ? AND ts >= ? AND ts < ?"
            " AND co2 IS NOT NULL ORDER BY ts", (address, start_ts, end_ts)):
        covered.add(datetime.date.fromtimestamp(ts).isoformat())
        if prev and ts - prev[0] <= MAX_GAP and prev[1] > target:
            t0 = datetime.datetime.fromtimestamp(prev[0])
            h0 = t0.hour + t0.minute / 60 + t0.second / 3600
            h1 = h0 + (ts - prev[0]) / 3600
            if h1 <= 24:
                add(t0.date(), h0, h1)
            else:  # crosses midnight
                add(t0.date(), h0, 24)
                add(t0.date() + datetime.timedelta(days=1), 0, h1 - 24)
        prev = (ts, c)
    return hours, spans, covered


def default_report_dir():
    try:
        import subprocess
        docs = subprocess.run(["xdg-user-dir", "DOCUMENTS"], capture_output=True, text=True).stdout.strip()
    except OSError:
        docs = ""
    return os.path.join(docs or os.path.expanduser("~/Documents"), "Airthings")


def make_report(conn, address, period, target, lat, lon, out):
    import report

    m = re.fullmatch(r"(\d{4})(?:-(\d{1,2}))?", period)
    if not m:
        raise HelperError(f"Period must look like 2026 or 2026-10, not {period!r}")
    year, month = int(m.group(1)), int(m.group(2)) if m.group(2) else None
    start = datetime.datetime(year, month or 1, 1)
    end = (datetime.datetime(year + (month == 12), month % 12 + 1, 1) if month
           else datetime.datetime(year + 1, 1, 1))
    start_ts, end_ts = int(start.timestamp()), int(end.timestamp())
    if not address:
        raise HelperError("No device data yet")

    update_airings(conn, address, target)
    location_note = None
    if lat is None or lon is None:
        location_note = "Set a location in the applet settings to compare with outdoor temperature"
    else:
        try:
            fill_outdoor_temps(conn, address, lat, lon, start_ts, end_ts)
        except HelperError as e:
            location_note = f"Outdoor temperature unavailable: {e}"

    airings = [
        {"start": r[0], "end": r[1], "peak": r[2], "minutes": (r[1] - r[0]) / 60, "outdoor_temp": r[3]}
        for r in conn.execute(
            "SELECT start_ts, end_ts, peak, outdoor_temp FROM co2_airings"
            " WHERE address = ? AND start_ts >= ? AND start_ts < ? ORDER BY start_ts",
            (address, start_ts, end_ts))
    ]
    hours, spans, covered = hours_above(conn, address, target, start_ts, end_ts)
    dev = conn.execute("SELECT model FROM devices WHERE address = ?", (address,)).fetchone()
    subtitle = " · ".join(p for p in (
        f"Airthings {dev[0]}" if dev and dev[0] else "Airthings Wave",
        f"fresh air = CO₂ below {target:.0f} ppm") if p)
    data = {"year": year, "month": month, "target": target, "airings": airings,
            "hours": hours, "spans": spans, "covered": covered, "subtitle": subtitle,
            "location_note": location_note,
            "footer": f"Created {datetime.date.today():%d %B %Y} · Airthings Wave applet"}

    if not out:
        name = f"fresh-air-{year}-{month:02d}.pdf" if month else f"fresh-air-{year}.pdf"
        out = os.path.join(default_report_dir(), name)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    (report.render_month if month else report.render_year)(out, data)
    return {"ok": True, "path": os.path.abspath(out), "airings": len(airings)}


def resolve_address(conn, address):
    if address:
        return address
    row = conn.execute("SELECT address FROM devices ORDER BY last_seen DESC LIMIT 1").fetchone()
    return row[0] if row else None


def history(conn, address, hours, points, co2_target=800):
    now = int(time.time())
    since = now - int(hours * 3600)
    bucket = max(60, int(hours * 3600) // max(1, points))
    out = {"ok": True, "address": address, "since": since, "until": now,
           "bucket": bucket, "metrics": list(METRICS), "rows": [], "latest": None,
           "device": None}
    if not address:
        return out

    avgs = ", ".join(f"AVG({m})" for m in METRICS)
    rows = conn.execute(
        f"SELECT MIN(ts), {avgs} FROM readings WHERE address = ? AND ts >= ?"
        " GROUP BY ts / ? ORDER BY 1",
        (address, since, bucket),
    ).fetchall()
    out["rows"] = [[r[0]] + [None if x is None else round(x, 2) for x in r[1:]] for r in rows]

    latest = conn.execute(
        f"SELECT ts, {', '.join(METRICS)} FROM readings WHERE address = ?"
        " ORDER BY ts DESC LIMIT 1",
        (address,),
    ).fetchone()
    if latest:
        out["latest"] = {"ts": latest[0], "values": dict(zip(METRICS, latest[1:]))}

    dev = conn.execute(
        "SELECT model, serial FROM devices WHERE address = ?", (address,)
    ).fetchone()
    if dev:
        out["device"] = {"model": dev[0], "serial": dev[1]}
    out["co2"] = co2_insight(conn, address, co2_target)
    return out


def _demo_co2(start, end, rng):
    """Occupied home: CO2 builds up, a few airings a day, slower when warm outside."""
    co2, airing, tau, plan = 600.0, False, 0, {}
    for ts in range(start, end, 300):
        now = datetime.datetime.fromtimestamp(ts)
        weekend = now.weekday() >= 5
        if now.date() not in plan:
            times = [7.3 + rng.gauss(0, 0.3), 19 + rng.gauss(0, 0.8), 22.4 + rng.gauss(0, 0.3)]
            if weekend:
                times.append(13 + rng.gauss(0, 1))
            plan[now.date()] = times
        hour = now.hour + now.minute / 60
        if airing:
            co2 = CO2_BASELINE + (co2 - CO2_BASELINE) * math.exp(-300 / tau)
            airing = co2 > 650 + rng.uniform(-40, 60)
        else:
            if any(hour <= t < hour + 300 / 3600 for t in plan[now.date()]):
                summer = (1 - math.cos(2 * math.pi * (now.timetuple().tm_yday - 20) / 365.25)) / 2
                tau = (6 + 18 * summer) * 60 * rng.lognormvariate(0, 0.2)
                airing = True
            if hour >= 23 or hour < 7:
                rise = 120
            elif 7 <= hour < 8.5 or 17.5 <= hour < 23:
                rise = 260
            else:
                rise = 180 if weekend else 0
            co2 += rise * 300 / 3600 - (co2 - CO2_BASELINE) * (1 - math.exp(-300 / (6 * 3600)))
        yield ts, round(co2 + rng.gauss(0, 8))


def demo(conn, days, address):
    """Fill the database with plausible fake data, for previewing the applet and reports."""
    rng = random.Random(7)
    now = int(time.time())
    rows = []
    for ts, co2 in _demo_co2(now - days * 86400, now, rng):
        h = (ts % 86400) / 3600.0
        day = math.sin(2 * math.pi * (h - 9) / 24)
        rows.append([
            ts, address,
            round(21 + 1.5 * day + rng.gauss(0, 0.15), 2),
            round(45 - 6 * day + rng.gauss(0, 1), 1),
            max(0, round(85 + 40 * math.sin(ts / 200000.0) + rng.gauss(0, 8))),
            round(80 + 10 * math.sin(ts / 900000.0)),
            co2,
            max(0, round(120 + 80 * max(0, day) + rng.gauss(0, 15))),
            round(1012 + 6 * math.sin(ts / 300000.0), 1),
        ])
    conn.executemany(
        f"INSERT INTO readings (ts, address, {', '.join(METRICS)})"
        f" VALUES (?, ?, {', '.join('?' * len(METRICS))})",
        rows,
    )
    conn.execute(
        "INSERT OR REPLACE INTO devices (address, model, serial, last_seen) VALUES (?, ?, ?, ?)",
        (address, "Wave Plus", "2930000000", now),
    )
    conn.commit()
    return {"ok": True, "inserted": len(rows), "address": address}


# --- open-meteo ----------------------------------------------------------

def _get_json(url, params):
    req = urllib.request.Request(
        url + "?" + urllib.parse.urlencode(params),
        headers={"User-Agent": "airthings-cinnamon-applet"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        try:
            reason = json.load(e).get("reason", e.reason)
        except Exception:
            reason = e.reason
        raise HelperError(f"Open-Meteo: {reason}")
    except (urllib.error.URLError, TimeoutError) as e:
        raise HelperError(f"Could not reach Open-Meteo: {getattr(e, 'reason', e)}")


def geocode(query):
    """Resolve "Name", "Name, Country/Region" or "lat, lon" to coordinates."""
    m = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*", query)
    if m:
        lat, lon = float(m.group(1)), float(m.group(2))
        return [{"label": f"{lat:.4f}, {lon:.4f}", "latitude": lat, "longitude": lon}]

    name, _, qualifier = query.partition(",")
    if not name.strip():
        return []
    data = _get_json(GEOCODE_URL, {"name": name.strip(), "count": 10, "language": "en", "format": "json"})
    results = data.get("results") or []
    qualifier = qualifier.strip().lower()
    if qualifier:
        results = [
            r for r in results
            if any(str(r.get(k, "")).lower().startswith(qualifier)
                   for k in ("country", "country_code", "admin1", "admin2"))
        ]
    out = []
    for r in results:
        parts = [r.get("name"), r.get("admin1"), r.get("country")]
        out.append({
            "label": ", ".join(dict.fromkeys(p for p in parts if p)),
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "elevation": r.get("elevation"),
        })
    return out


def _collect_hourly(data, series, variable="surface_pressure"):
    hourly = data.get("hourly") or {}
    for t, v in zip(hourly.get("time", []), hourly.get(variable, [])):
        if v is not None:
            series[int(t)] = v


def hourly_weather(lat, lon, variable, start_ts, end_ts):
    """Hourly values between two times: archive for older days, forecast for recent ones."""
    common = {"latitude": lat, "longitude": lon, "hourly": variable,
              "timeformat": "unixtime", "timezone": "UTC"}
    today = datetime.date.today()
    start = datetime.date.fromtimestamp(start_ts)
    end = min(datetime.date.fromtimestamp(end_ts), today)
    series = {}
    # The archive lags a few days behind; the forecast API covers the last 92 days.
    archive_end = min(end, today - datetime.timedelta(days=6))
    if start <= archive_end:
        _collect_hourly(_get_json(ARCHIVE_URL, {**common, "start_date": start.isoformat(),
                                                "end_date": archive_end.isoformat()}), series, variable)
    if end > today - datetime.timedelta(days=8):
        past = min(FORECAST_MAX_PAST_DAYS, (today - start).days + 1)
        _collect_hourly(_get_json(FORECAST_URL, {**common, "past_days": past, "forecast_days": 1}),
                        series, variable)
    return series


def outdoor_pressure(lat, lon, hours, points):
    """Hourly surface pressure for the last `hours`, averaged into ~`points` buckets."""
    now = int(time.time())
    since = now - int(hours * 3600)
    cache = os.path.join(CACHE_DIR, f"outdoor_{lat:.3f}_{lon:.3f}_{int(hours)}.json")
    try:
        with open(cache) as f:
            cached = json.load(f)
        if now - cached["fetched"] < OUTDOOR_CACHE_SECONDS:
            return cached["result"]
    except (OSError, ValueError, KeyError):
        pass

    common = {"latitude": lat, "longitude": lon, "hourly": "surface_pressure",
              "timeformat": "unixtime", "timezone": "UTC"}
    days = math.ceil(hours / 24) + 1
    series = {}
    if days > FORECAST_MAX_PAST_DAYS:
        # The forecast API only goes back 92 days; older data comes from the archive.
        start = datetime.date.fromtimestamp(since)
        end = datetime.date.today() - datetime.timedelta(days=FORECAST_MAX_PAST_DAYS - 2)
        archive = _get_json(ARCHIVE_URL, {**common, "start_date": start.isoformat(),
                                          "end_date": end.isoformat()})
        _collect_hourly(archive, series)
    recent = _get_json(FORECAST_URL, {**common, "past_days": min(days, FORECAST_MAX_PAST_DAYS),
                                      "forecast_days": 1})
    _collect_hourly(recent, series)
    elevation = recent.get("elevation")

    bucket = max(3600, int(hours * 3600) // max(1, points))
    buckets = {}
    for t, v in series.items():
        if since <= t <= now:
            buckets.setdefault(t // bucket, []).append((t, v))
    rows = [[min(t for t, _ in b), round(sum(v for _, v in b) / len(b), 2)]
            for _, b in sorted(buckets.items())]

    result = {"ok": True, "latitude": lat, "longitude": lon, "hours": hours,
              "elevation": elevation, "rows": rows}
    os.makedirs(CACHE_DIR, exist_ok=True)
    tmp = cache + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"fetched": now, "result": result}, f)
    os.replace(tmp, cache)
    return result


# --- main -----------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db", default=DEFAULT_DB, help="history database (default: %(default)s)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scan", help="list Airthings devices in range")
    s.add_argument("--timeout", type=float, default=10)

    s = sub.add_parser("poll", help="read the sensor and store the values")
    s.add_argument("--address", default="", help="Bluetooth address; empty = nearest device")
    s.add_argument("--timeout", type=float, default=20)
    s.add_argument("--retention-days", type=int, default=365)

    s = sub.add_parser("history", help="aggregated history as JSON")
    s.add_argument("--address", default="")
    s.add_argument("--hours", type=float, default=24)
    s.add_argument("--points", type=int, default=300)
    s.add_argument("--co2-target", type=float, default=800,
                   help="CO2 level (ppm) that counts as fresh air")

    s = sub.add_parser("geocode", help="look up a place name with Open-Meteo")
    s.add_argument("query")

    s = sub.add_parser("outdoor", help="outdoor pressure history from Open-Meteo")
    s.add_argument("--lat", type=float, required=True)
    s.add_argument("--lon", type=float, required=True)
    s.add_argument("--hours", type=float, default=24)
    s.add_argument("--points", type=int, default=300)

    s = sub.add_parser("report", help="fresh-air report as PDF")
    g = s.add_mutually_exclusive_group(required=True)
    g.add_argument("--month", help="e.g. 2026-10")
    g.add_argument("--year", help="e.g. 2026")
    s.add_argument("--address", default="")
    s.add_argument("--co2-target", type=float, default=800)
    s.add_argument("--lat", type=float)
    s.add_argument("--lon", type=float)
    s.add_argument("--out", default="", help="PDF path (default: Documents/Airthings/)")

    s = sub.add_parser("demo", help="insert fake readings (use with a separate --db)")
    s.add_argument("--days", type=int, default=30)
    s.add_argument("--address", default="00:00:00:00:00:00")

    args = p.parse_args()

    try:
        if args.cmd == "scan":
            devices = asyncio.run(asyncio.wait_for(scan_devices(args.timeout), args.timeout + 20))
            for d in devices:
                d.pop("_device")
            result = {"ok": True, "devices": devices}
        elif args.cmd == "poll":
            budget = args.timeout * 3 + 30
            data = asyncio.run(asyncio.wait_for(poll_device(args.address.strip(), args.timeout), budget))
            ts = int(time.time())
            with open_db(args.db) as conn:
                store(conn, ts, data, args.retention_days)
            result = {"ok": True, "ts": ts, **data}
        elif args.cmd == "history":
            conn = open_db(args.db)
            result = history(conn, resolve_address(conn, args.address.strip()), args.hours, args.points,
                             args.co2_target)
        elif args.cmd == "geocode":
            result = {"ok": True, "results": geocode(args.query)}
        elif args.cmd == "outdoor":
            result = outdoor_pressure(args.lat, args.lon, args.hours, args.points)
        elif args.cmd == "report":
            conn = open_db(args.db)
            result = make_report(conn, resolve_address(conn, args.address.strip()),
                                 args.month or args.year, args.co2_target,
                                 args.lat, args.lon, args.out)
        elif args.cmd == "demo":
            result = demo(open_db(args.db), args.days, args.address)
    except asyncio.TimeoutError:
        result = {"ok": False, "error": "Timed out talking to the device"}
    except HelperError as e:
        result = {"ok": False, "error": str(e)}
    except Exception as e:
        result = {"ok": False, "error": f"{type(e).__name__}: {e}"}

    json.dump(result, sys.stdout)
    sys.stdout.write("\n")
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
