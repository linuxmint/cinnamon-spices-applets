# AirAware

AirAware is a Cinnamon panel applet that shows the current environmental allergy burden from pollen, air pollution, and weather-based mold potential. It displays a compact panel indicator and a native Cinnamon popup with current conditions and a short forecast.

AirAware reports environmental conditions only. It does not predict symptoms, diagnose allergies, or provide medical advice.

## Features

- Panel icon with risk-colored line work and an optional label
- Automatic approximate location lookup through GeoClue2
- Manual latitude and longitude fallback when automatic location is unavailable
- OpenStreetMap button in settings to help choose coordinates
- Reverse-geocoded place name in the popup when available
- Open-Meteo Air Quality and Weather Forecast data with no API key required
- Current conditions from Open-Meteo `current` fields with `timezone=auto`
- Pollutant-specific European AQI scoring for regulated air pollution
- Six pollen types: alder, birch, grass, mugwort, olive, and ragweed
- Weather-based Mold potential using humidity, leaf wetness, precipitation, temperature, dew point, and wind
- Atmospheric irritant context from carbon monoxide, aerosol optical depth, dust, and optional wildfire-related PM10 where available
- Current readings for pollen, PM2.5, PM10, NO₂, O₃, SO₂, carbon monoxide, aerosol optical depth, dust, and Mold potential
- Forecast for today, tomorrow, and the next listed day
- Cache fallback for coordinates, place names, and the last successful environmental data response
- Stale data indicator when current data cannot be refreshed
- Configurable refresh interval, panel label, and notifications
- Support for horizontal panels, vertical panels, and multiple applet instances

The panel tooltip shows the current risk label and score, for example `Moderate (52%)`. When cached data is stale, the tooltip adds a stale-data note.

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
- Notifications: disabled, High + Very High, or Very High only
- Send test notification button for verifying the Cinnamon notification path

Notifications are transition-based. AirAware does not repeatedly notify for the same unchanged risk category.

## Privacy

AirAware does not use analytics and does not store personal information.

The applet requests approximate location from GeoClue2 and caches only latitude and longitude. It does not continuously track movement. Coordinates are refreshed at most every 6 hours unless the user manually refreshes.

If automatic location is unavailable, manual latitude and longitude can be entered in settings. Manual coordinates are stored only in local Cinnamon settings and the local coordinate cache.

Only latitude and longitude are sent to Open-Meteo for environmental data. The same coordinates are sent to the Open-Meteo Air Quality API and the Open-Meteo Weather Forecast API. Latitude and longitude are also sent to OpenStreetMap Nominatim to retrieve a human-readable place name for the popup. Place names are cached locally.

## Data Sources

AirAware uses the Open-Meteo Air Quality API:

https://open-meteo.com/en/docs/air-quality-api

AirAware also uses the Open-Meteo Weather Forecast API for weather variables used by Mold potential:

https://open-meteo.com/en/docs

Open-Meteo provides air quality, pollen, AQI, and weather forecast data without requiring an API key for normal public API usage. Availability varies by variable, region, model domain, and season. Pollen data is primarily available in Europe during pollen season.

Data source attribution: Open-Meteo.com.

AirAware uses OpenStreetMap Nominatim for reverse geocoding:

https://nominatim.openstreetmap.org/

Place-name attribution: OpenStreetMap contributors.

## Score

The AirAware score is an environmental burden index. It combines:

- 50% pollen burden
- 25% regulated air pollution
- 10% atmospheric irritants
- 15% Mold potential

Pollen burden uses the highest available pollen burden instead of averaging unrelated pollen types. Regulated pollution uses the highest available pollutant-specific European AQI among PM2.5, PM10, NO₂, O₃, and SO₂. Atmospheric irritants include CO, aerosol optical depth, dust, and optional wildfire-related PM10. Mold potential is inferred from humidity, leaf wetness, precipitation, temperature, dew point, and wind. Missing components are omitted and the remaining weights are renormalized. The score is not medical advice.

Panel icon line colors follow the current score category:

- Low: green
- Moderate: yellow
- High: orange
- Very High: red
- Loading or unavailable: gray

## Limitations

- Pollen variables are primarily available in Europe during pollen season.
- Forecast quality depends on the upstream air quality and weather models and region.
- Forecasts are model estimates, not exact local sensor readings.
- Mold potential is inferred from temperature, humidity, leaf wetness, precipitation, dew point, and wind.
- Mold potential is not a measured mold-spore concentration.
- Aerosol optical depth describes particles through the atmospheric column and may not exactly represent surface exposure.
- Wildfire-related PM10 may not be available in every region or model.
- Visibility can be reduced by humidity, cloud, fog, dust, or aerosols and is not a direct pollution measurement.
- Carbon monoxide, aerosol, and PM10 levels can originate from multiple sources.
- European AQI values should not be described as medical advice.
- AirAware does not account for personal sensitivity, medication, indoor exposure, masks, activity level, or clinical history.
- Place names depend on OpenStreetMap Nominatim availability and may occasionally be approximate.

## Architecture

- `applet.js`: Cinnamon panel integration, popup rendering, settings, timers, notifications, and lifecycle cleanup.
- `lib/locationService.js`: one-shot approximate GeoClue2 lookup with 6-hour coordinate cache behavior.
- `lib/openMeteoProvider.js`: Open-Meteo Air Quality URL construction, Soup async fetch, response validation, and provider mapping.
- `lib/openMeteoWeatherProvider.js`: Open-Meteo Weather Forecast URL construction, Soup async fetch, response validation, and normalized hourly weather mapping.
- `lib/moldPotentialCalculator.js`: weather-based Mold potential scoring.
- `lib/environmentAssembler.js`: combines independently refreshed air-quality, weather, cache, and mold data.
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
- Multiple providers
- Custom weighting
- Personal allergens
- Graphs

## License

AirAware is released under the MIT License.
