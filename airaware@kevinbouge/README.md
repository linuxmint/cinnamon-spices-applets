# AirAware

AirAware is a Cinnamon panel applet that shows the current environmental allergy burden from pollen and air pollution. It displays a compact panel indicator and a native Cinnamon popup with current conditions, a short forecast, and a plain-language score legend.

AirAware reports environmental conditions only. It does not predict symptoms, diagnose allergies, or provide medical advice.

## Features

- Panel icon with risk-colored line work and an optional label
- Automatic approximate location lookup through GeoClue2
- Manual latitude and longitude fallback when automatic location is unavailable
- OpenStreetMap button in settings to help choose coordinates
- Reverse-geocoded place name in the popup when available
- Open-Meteo Air Quality data with no API key required
- Current readings for tree pollen, grass pollen, weed pollen, PM2.5, PM10, NO2, O3, and dust
- Forecast for today, tomorrow, and the next listed day
- Cache fallback for coordinates, place names, and the last successful environmental data response
- Stale data indicator when current data cannot be refreshed
- Configurable refresh interval, panel label, and notifications
- Support for horizontal panels, vertical panels, and multiple applet instances

The panel tooltip shows only the current risk label, for example `Moderate`. When cached data is stale, the tooltip adds a stale-data note.

## Installation

After AirAware is accepted into Cinnamon Spices, install it from:

1. Open Cinnamon System Settings.
2. Open Applets.
3. Use the Download tab to find AirAware.
4. Install it, then add it to the panel from the Manage tab.

For manual testing from a source checkout, copy the applet directory into Cinnamon's local applet directory:

```bash
tools/install-local.sh
```

Restart Cinnamon after installing or updating a local development copy.

## Settings

AirAware provides these Cinnamon settings:

- Refresh interval: 30, 60, 120, 240, or 360 minutes
- Location source: automatic or manual coordinates
- Manual latitude and longitude
- Show or hide the panel label
- Notifications: disabled, High only, or High + Very High
- Send test notification button for verifying the Cinnamon notification path

Notifications are transition-based. AirAware does not repeatedly notify for the same unchanged risk category.

## Privacy

AirAware does not use analytics and does not store personal information.

The applet requests approximate location from GeoClue2 and caches only latitude and longitude. It does not continuously track movement. Coordinates are refreshed at most every 6 hours unless the user manually refreshes.

If automatic location is unavailable, manual latitude and longitude can be entered in settings. Manual coordinates are stored only in local Cinnamon settings and the local coordinate cache.

Only latitude and longitude are sent to Open-Meteo for environmental data. Latitude and longitude are also sent to OpenStreetMap Nominatim to retrieve a human-readable place name for the popup. Place names are cached locally.

## Data Sources

AirAware uses the Open-Meteo Air Quality API:

https://open-meteo.com/en/docs/air-quality-api

Open-Meteo provides air quality and pollen forecast data without requiring an API key for normal public API usage. Pollen availability can vary by region and season.

Data source attribution: Open-Meteo.com.

AirAware uses OpenStreetMap Nominatim for reverse geocoding:

https://nominatim.openstreetmap.org/

Place-name attribution: OpenStreetMap contributors.

## Score

The AirAware score is an environmental burden index. The first version combines:

- 60% pollen burden
- 30% particulate pollution
- 10% gases and dust

Pollen burden uses the highest pollen category instead of averaging tree, grass, and weed pollen. The score is not a medical, regulatory, or AQI claim.

Panel icon line colors follow the current score category:

- Low: green
- Moderate: yellow
- High: orange
- Very High: red
- Loading or unavailable: gray

## Limitations

- Pollen variables are primarily available in Europe during pollen season.
- Forecast quality depends on the upstream air quality model and region.
- Forecasts are environmental estimates, not sensor readings from the user's exact location.
- AirAware does not account for personal sensitivity, medication, indoor exposure, masks, activity level, or clinical history.
- Place names depend on OpenStreetMap Nominatim availability and may occasionally be approximate.

## Architecture

- `applet.js`: Cinnamon panel integration, popup rendering, settings, timers, notifications, and lifecycle cleanup.
- `lib/locationService.js`: one-shot approximate GeoClue2 lookup with 6-hour coordinate cache behavior.
- `lib/openMeteoProvider.js`: Open-Meteo URL construction, Soup async fetch, response validation, and provider mapping.
- `lib/reverseGeocoder.js`: Nominatim reverse-geocoding URL construction, Soup async fetch, and place-name parsing.
- `lib/riskCalculator.js`: environmental burden scoring and risk category calculation.
- `lib/cache.js`: coordinate, place-name, and response cache envelopes with validation.
- `lib/formatter.js`: translated display formatting for categories, readings, timestamps, and stale status.
- `lib/notificationPolicy.js`: transition-based notification decisions.
- `tests/`: GJS unit tests for pure modules and service orchestration.
- `po/`: gettext template for translators.

Provider code is isolated so another source can be added later without rewriting the applet UI or risk calculator.

## Development

Run the GJS tests from the installed applet source directory:

```bash
tests/run-tests.sh
```

`applet.js` must be loaded by Cinnamon. Running it directly with `gjs` outside Cinnamon is expected to fail because `imports.ui` exists only in the Cinnamon runtime.

Optional live Open-Meteo smoke test:

```bash
cd files/airaware@kevinbouge
gjs ../../tests/live-openmeteo-smoke.gjs
```

## Roadmap

- Manual location search/geocoding
- Multiple saved locations
- Hourly forecast
- Wildfire smoke
- Mold spores
- Weather integration
- Multiple providers
- Custom weighting
- Personal allergens
- Graphs

## License

AirAware is released under the MIT License.
