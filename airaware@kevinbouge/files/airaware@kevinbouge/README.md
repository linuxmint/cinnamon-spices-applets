# AirAware

AirAware is a Cinnamon panel applet that reports the current environmental allergy burden from pollen, air pollution, and weather-based mold potential. It shows a compact panel indicator and a detailed forecast popup using Open-Meteo environmental data.

AirAware reports environmental conditions only. It does not predict symptoms, diagnose allergies, or provide medical advice.

## Features

- Automatic approximate location lookup through GeoClue2
- Manual latitude/longitude fallback when automatic location is unavailable, with a map button for choosing coordinates
- Reverse-geocoded place name in the popup when available
- No API key required
- Open-Meteo Air Quality provider isolated in `lib/openMeteoProvider.js`
- Open-Meteo Weather Forecast provider isolated in `lib/openMeteoWeatherProvider.js`
- Weather-based Mold potential from temperature, humidity, precipitation, and wind
- Aerosol optical depth and carbon monoxide included in the environmental-risk score
- Sulfur dioxide (SO₂) included in the environmental-risk score
- Panel icon with risk-colored line work and an optional Low, Moderate, High, or Very High label
- Short panel tooltip showing only the current risk label
- Popup with current score, location, tree pollen, grass pollen, weed pollen, PM2.5, PM10, NO₂, O₃, SO₂, carbon monoxide, aerosol optical depth, dust, Mold potential, last update time, forecast, and score legend
- Cache fallback for coordinates, place name, and last successful data response
- Stale data indicator when current data cannot be refreshed
- Configurable refresh interval, panel label, and notifications
- Test notification button for local verification
- Multiple panel instances
- Horizontal and vertical panel support
- gettext-ready visible strings

## Installation

Install AirAware from Cinnamon System Settings after it is available in Cinnamon Spices:

1. Open Cinnamon System Settings.
2. Open Applets.
3. Use the Download tab to find AirAware.
4. Install it, then add it to the panel from the Manage tab.

## Architecture

- `applet.js`: Cinnamon panel integration, popup rendering, settings, timers, notifications, and lifecycle cleanup.
- `lib/locationService.js`: one-shot approximate GeoClue2 lookup with 6-hour coordinate cache behavior.
- `lib/openMeteoProvider.js`: Open-Meteo Air Quality URL construction, Soup async fetch, response validation, and canonical provider mapping.
- `lib/openMeteoWeatherProvider.js`: Open-Meteo Weather Forecast URL construction, Soup async fetch, response validation, and normalized hourly weather mapping.
- `lib/moldPotentialCalculator.js`: weather-based Mold potential scoring.
- `lib/environmentAssembler.js`: combines independently refreshed air-quality, weather, cache, and mold data.
- `lib/reverseGeocoder.js`: Nominatim reverse-geocoding URL construction, Soup async fetch, and place-name parsing.
- `lib/riskCalculator.js`: environmental burden scoring and risk category calculation.
- `lib/cache.js`: coordinate, place-name, and response cache envelopes with validation.
- `lib/formatter.js`: translated display formatting for categories, readings, timestamps, and stale status.
- `lib/notificationPolicy.js`: transition-based notification decisions.
- `lib/constants.js`: shared risk weights and thresholds.
- `tests/`: GJS unit tests for pure modules and service orchestration.
- `po/`: gettext template for translators.

Provider code is isolated so another source can be added later without rewriting the applet UI or risk calculator.

## Panel Indicator

The panel label can be hidden from settings while keeping the icon visible. The icon line color follows the current score category:

- Low: green
- Moderate: yellow
- High: orange
- Very High: red
- Loading or unavailable: gray

The tooltip shows only the current category, for example `Moderate`. If cached data is stale, it adds a stale-data note.

## Score

The AirAware score is an environmental burden index. It combines:

- 50% pollen burden
- 25% particulate pollution
- 10% gases and atmospheric irritants
- 15% Mold potential

Pollen burden uses the highest pollen category instead of averaging tree, grass,
and weed pollen. Particulate pollution uses PM2.5 and PM10. Gases and
atmospheric irritants use NO₂, O₃, SO₂, dust, carbon monoxide, and aerosol optical
depth. Mold potential is inferred from weather conditions; it is not a
measured mold-spore concentration. The score is not a medical, regulatory, or
AQI claim.

## Privacy

AirAware does not use analytics and does not store personal information.

The applet requests approximate location from GeoClue2 and caches only latitude/longitude. It does not continuously track movement. Coordinates are refreshed at most every 6 hours unless the user manually refreshes.

If automatic location is unavailable, the settings page can use manual latitude
and longitude instead. The settings page includes an OpenStreetMap button to
help choose coordinates; the selected latitude and longitude are stored only in
the local Cinnamon settings and coordinate cache.

Only latitude and longitude are sent to Open-Meteo for environmental data.
The same coordinates are sent to the Open-Meteo Air Quality API and the
Open-Meteo Weather Forecast API.
Latitude and longitude are also sent to OpenStreetMap Nominatim to retrieve a
human-readable place name for the popup. Place names are cached locally.

## Data Source

AirAware uses the Open-Meteo Air Quality API:

https://open-meteo.com/en/docs/air-quality-api

AirAware also uses the Open-Meteo Weather Forecast API for weather variables
used by Mold potential:

https://open-meteo.com/en/docs

Open-Meteo provides air quality and pollen forecast data without requiring an API key for normal public API usage. Pollen availability can vary by region and season; Open-Meteo documents pollen as Europe-only during pollen season with a 4-day forecast.

Data source attribution: Open-Meteo.com.

AirAware uses OpenStreetMap Nominatim for reverse geocoding:

https://nominatim.openstreetmap.org/

Place-name attribution: OpenStreetMap contributors.

## Limitations

- Pollen variables are primarily available in Europe during pollen season.
- Forecast quality depends on the upstream air quality model and region.
- Current forecasts are environmental estimates, not sensor readings from the user's exact location.
- The risk score is an environmental burden index specific to AirAware, not a medical, regulatory, or AQI claim.
- Mold potential is inferred from temperature, humidity, precipitation, and wind.
- Mold potential is not a measured mold-spore concentration.
- Aerosol optical depth describes particles through the atmospheric column and may not exactly represent surface exposure.
- Carbon monoxide and aerosol levels can originate from multiple sources.
- AirAware does not account for personal sensitivity, medication, indoor exposure, masks, activity level, or clinical history.

## Roadmap

- Manual location search/geocoding
- Multiple saved locations
- Hourly forecast
- Multiple providers
- Custom weighting
- Personal allergens
- Graphs

## Development

Development scripts and tests are intentionally kept outside the installable Cinnamon payload. In a full source checkout, use the root-level README for local testing and validation instructions.
