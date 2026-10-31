# Airthings Wave

Shows radon, CO₂, VOC, temperature, humidity and pressure from an Airthings
Wave device in the panel, with a history graph per metric.

Supported over Bluetooth LE: Wave Plus, Wave Radon (2nd gen), Wave Mini and
the 1st generation Wave. Metrics a device doesn't measure are hidden.

## Requirements

- `python3-bleak` (Bluetooth LE)
- `python3-cairo` (already installed with Cinnamon)
- The URW Gothic font for the PDF reports (`fonts-urw-base35` on Debian,
  Ubuntu and Linux Mint, `urw-base35-gothic-fonts` on Fedora)

On Linux Mint / Debian / Ubuntu:

    sudo apt install python3-bleak fonts-urw-base35

Leave the Bluetooth address empty in the settings to use the nearest device.
The address is saved after the first successful reading. You can also pick a
device from *Find devices…* in the popup.

## How it works

The applet runs its helper, `airthings.py`, every few minutes (default 10).
The helper connects over BLE, decodes the sensor characteristic and appends
the values to `~/.local/share/airthings-applet/history.db` (SQLite). The
applet asks the helper for history averaged into about 300 points for the
selected range (6 h, 24 h, 7 d, 30 d, 1 y) and draws it with Cairo. Hover
the graph to see individual values. Click a value in the popup to graph
that metric.

Colours follow the levels used by the Airthings app. For example, radon is
good below 100 Bq/m³, fair up to 150 and poor above that.

## Fresh air estimate

When you air a room, CO₂ falls roughly exponentially towards the outdoor
level (about 420 ppm). Each time CO₂ falls from a peak to below the
fresh-air level (default 800 ppm, set under *Fresh air*), the helper
records the airing and its decay rate. These records are kept even after
the readings themselves are pruned.

While CO₂ is above the fresh-air level, the popup shows how long it will
take to get there (for example "29 min to fresh air"):

- **CO₂ already falling:** estimated from the current rate of decline.
- **CO₂ steady:** how long airing would take, using the median rate of
  your last 10 airings.

Click the line to show the CO₂ graph. On the 6 h and 24 h ranges the
forecast is drawn as a dotted curve to the fresh-air line. While CO₂ is
high the sensor is read every 5 minutes so the estimate stays current; you
can turn this off in the settings.

## Fresh-air reports (PDF)

*Fresh-air report (PDF)* in the popup creates a report for this month, last
month, this year or last year, saves it to `~/Documents/Airthings/`, and
opens it.

Each report is a one-page A4 poster in a Bauhaus style: primary colours
on paper, geometric shapes and URW Gothic type. Overlapping shapes are
multiplied like printing inks.

- **Monthly report:**
  - A blue square shows the number of airings, a red circle (sized by the
    median) the median time to fresh air, and a yellow half-disc the hours
    of stale air.
  - "Every day of the month": one line per day, black where CO₂ was above
    the fresh-air level, and a circle for each airing. The circle's size is
    the time to fresh air; its colour is morning (yellow), midday (red) or
    evening (blue).
  - Outdoor temperature vs airing time.
  - A 24-hour clock showing when you air.
- **Yearly report:**
  - The same three shapes.
  - Twelve season circles (size = median time to fresh air per month).
  - A tile for every day of the year, with a quarter-circle that grows with
    hours of stale air; red marks weekends.
  - Outdoor temperature vs airing time.

If a location is set, each airing is tagged with that hour's outdoor
temperature from Open-Meteo. The temperature is stored with the airing, so
it's fetched only once.

## Outdoor pressure

Set *Location* in the applet settings to a place name ("Oslo", or
"Oslo, NO" to narrow it down) or to coordinates ("59.91, 10.75"). The
applet looks the name up with the Open-Meteo geocoding API. When you view
the pressure graph, it draws that place's outdoor surface pressure as a
dashed line for the same range. Data from the last 92 days comes from the
forecast API; the 1 y range also uses the archive API. Results are cached
for 30 minutes in `~/.cache/airthings-applet/`. If the name matches several
places, choose the right one under *Outdoor location* in the popup.

## Helper CLI

The helper also works from a terminal:

    cd ~/.local/share/cinnamon/applets/airthings-wave@va4w
    ./airthings.py scan
    ./airthings.py poll --address 58:93:D8:xx:xx:xx
    ./airthings.py history --hours 24
    ./airthings.py report --month 2026-10
    ./airthings.py geocode "Oslo, NO"
    ./airthings.py outdoor --lat 59.91 --lon 10.75 --hours 168

To preview the reports with simulated data (a year with slower airings in
summer):

    ./airthings.py --db /tmp/demo.db demo --days 365
    ./airthings.py --db /tmp/demo.db report --year 2026 \
        --lat 59.91 --lon 10.75 --out /tmp/fresh-air-2026.pdf

## Notes

- The phone app and the applet can't both be connected at once. A reading
  fails if the app is connected at the time.
- Radon is reported as missing during the first hour after the device starts.
- If the applet misbehaves, check `~/.xsession-errors` or Looking Glass
  (Alt+F2 → `lg`).
