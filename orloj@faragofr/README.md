# Orloj — Cinnamon astronomical clock applet

A panel applet for the Cinnamon desktop inspired by the Prague astronomical
clock, with modern minimal aesthetics. All positions are computed locally
from your configured latitude and longitude — no network calls, unless you
opt in to automatic location, which queries [ip-api.com](https://ip-api.com)
(city-level GeoIP, plain HTTP, at most once per hour).

![Screenshot](screenshot.png)

## Panel

The panel label shows one entry each for the sun and the moon: the body's
next horizon event, i.e. whichever of its rise or set comes soonest. In
this example the sun's next event is a set and the moon's is a rise:

```
☀↓21:18 ☾↑15:42
```

Arrows indicate rise (↑) or set (↓). A `+Nd` suffix appears for events
more than a day away. Either body's entry can be hidden in the settings.

By default the clock behaves as it always has: the dial center shows local
sidereal time and all civil times use the system time zone. Unchecking
*Use Local Sidereal Time* in the settings switches the dial center to civil
time and reveals the time zone options — automatic (system) or a manually
selected zone — which then apply to all displayed times (panel and dial).

## Dial

Clicking the panel label opens a 320px popup dial with concentric rings:

- **24-hour ring** — Arabic numerals reading civil (wall-clock) time.
  The daytime arc between sunrise and sunset is highlighted.
- **Zodiac ring** — twelve sign glyphs positioned at their true equatorial
  coordinates, rotating with sidereal time. Vernal and autumnal equinox
  points are marked with small stars.
- **Celestial bodies** — Sun, Moon (with phase shading), Mercury, Venus,
  Mars, Jupiter, and Saturn placed at their true sky positions. Bodies
  below the horizon are dimmed.
- **Time hand** — accent-colored hand on the hour ring showing current
  civil time.
- **Center** — local sidereal time (LST) readout by default; switchable in
  the settings to civil time with the time zone abbreviation.

Hover over any body for a tooltip showing its zodiac position, altitude,
and (for the Moon) illumination percentage.

## Settings

Right-click the applet and choose *Configure*:

| Setting | Description |
|---------|-------------|
| Automatic location (GeoIP) | Determine coordinates from your IP address (default off); hover the panel label to see the detected city |
| Latitude / Longitude | Observer position in decimal degrees, used when GeoIP is off or unavailable |
| Use Local Sidereal Time | Dial center shows LST (default on, the original behavior); unchecking reveals the time zone options |
| Automatic time zone | Use the system time zone for all displayed times (default on) |
| Time zone | Manual time zone selection, shown when automatic is off |
| Show the sun's / moon's next rise/set | Toggle each body's entry (whichever of rise or set comes soonest) in the panel label |
| Refresh interval | How often positions are recomputed (default 30s) |
| Accent color | Color of the time hand and sun glyph |
| Foreground color | Text, hands and glyphs; intermediate tones are derived from it |
| Background color | Dial background; intermediate tones are derived from it |
| Dial size | Diameter of the dial in the popup; larger values improve readability |

Defaults to Prague (50.09°N, 14.42°E).

## Project structure

```
orloj@faragofr/
├── metadata.json          Cinnamon applet manifest
├── applet.js              Entry point: panel label, popup, settings, refresh loop
├── settings-schema.json   Settings UI definition
├── icon.png               Panel and applet-picker icon
├── po/
│   └── orloj@faragofr.pot Translation template
└── lib/
    ├── astronomy.js       Celestial math (Meeus/Schlyter formulas)
    ├── dial.js            Cairo/Pango dial renderer and hit-testing
    └── theme.js           Color palette and stroke constants
```
