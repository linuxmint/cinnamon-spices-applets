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
- Current conditions from Open-Meteo `current` fields with `timezone=auto`
- Location-aware pollutant-specific AQI scoring
- Six pollen types: alder, birch, grass, mugwort, olive, and ragweed
- Weather-based Mold potential using humidity, leaf wetness, precipitation, temperature, dew point, and wind
- UV index from Open-Meteo, optionally included in personalized scoring
- Atmospheric irritant context from carbon monoxide, aerosol optical depth, dust, and optional wildfire-related PM10 where available
- Optional nearby vegetation context from OpenStreetMap mapped vegetation and land-use data, with popup details hidden by default
- Optional Personal Allergy Profile for a separate personalized environmental risk score
- Best outdoor window based on the next 24 hours of selected Personal Allergy Profile factors
- Share Daily Summary action that copies a compact 😷 AirAware plain-text summary to the clipboard
- Panel icon with risk-colored line work and an optional Low, Moderate, High, or Very High label
- Short panel tooltip showing the current risk label and score
- Popup with current score, location, pollen, PM2.5, PM10, NO₂, O₃, SO₂, carbon monoxide, aerosol optical depth, dust, Mold potential, nearby vegetation context, last update time, and compact forecast
- Cache fallback for coordinates, place name, nearby vegetation context, and last successful data response
- Stale data indicator when current data cannot be refreshed
- Configurable refresh interval, panel label, and notifications
- Configurable popup sections for pollen, regulated pollution, atmospheric irritants, Mold potential, UV index, personalized risk, and vegetation details
- UV index display in the popup is disabled by default
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
- `lib/openStreetMapVegetationProvider.js`: Overpass query construction, Soup async fetch, and normalized nearby vegetation context.
- `lib/personalAllergyProfile.js`: local Personal Allergy Profile schema, defaults, and settings normalization.
- `lib/personalizedRiskCalculator.js`: personalized environmental risk scoring from selected available factors.
- `lib/personalizedForecastCalculator.js`: hourly personalized scoring used for best outdoor-window calculation.
- `lib/dailySummaryBuilder.js`: canonical local model selection for shareable daily summaries.
- `lib/dailySummaryFormatter.js`: compact plain-text summary formatting and emoji mapping.
- `lib/moldPotentialCalculator.js`: weather-based Mold potential scoring.
- `lib/environmentAssembler.js`: combines independently refreshed air-quality, weather, vegetation, cache, and mold data.
- `lib/reverseGeocoder.js`: Nominatim reverse-geocoding URL construction, Soup async fetch, and place-name parsing.
- `lib/riskCalculator.js`: environmental burden scoring and risk category calculation.
- `lib/cache.js`: coordinate, place-name, vegetation, and response cache envelopes with validation.
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

The tooltip shows the current category and score, for example `Moderate (52%)`. If cached data is stale, it adds a stale-data note.

## Score

The AirAware score is an environmental burden index. It combines:

- 50% pollen burden
- 25% regulated air pollution
- 10% atmospheric irritants
- 15% Mold potential

Pollen burden uses the highest available pollen burden instead of averaging unrelated pollen types. Regulated pollution uses the highest available pollutant-specific AQI among PM2.5, PM10, NO₂, O₃, and SO₂. AirAware uses US AQI for coordinates in the United States and European AQI elsewhere when available; if selected AQI values are unavailable, it falls back to raw-concentration burden scoring. Atmospheric irritants include CO, aerosol optical depth, dust, and optional wildfire-related PM10. Mold potential is inferred from humidity, leaf wetness, precipitation, temperature, dew point, and wind. Missing components are omitted and the remaining weights are renormalized. The score is not medical advice.

Nearby vegetation context is displayed separately and does not modify the AirAware score.

## Personal Allergy Profile

AirAware can optionally calculate a personalized environmental risk score using only the environmental factors selected in settings.

The profile can include individual pollen types, Mold potential, regulated pollutants, carbon monoxide, aerosol optical depth, atmospheric dust, and smoke-related particulate context when available. The original AirAware environmental burden score remains available and is not changed by the profile.

The personalized score reuses the same burden calculations as the environmental score, but only for selected factors. Selected pollen and regulated-pollution factors use the highest available burden in their group, atmospheric irritants keep their internal weighting, and selected top-level groups are renormalized when data is unavailable. Disabled factors are not treated as environmentally absent.

Profile selections are stored only in local Cinnamon settings and are not sent to environmental data providers.

The personalized score reflects selected environmental conditions only. It does not predict symptoms, diagnose allergies, or provide medical advice.

UV index can optionally be included in the personalized score. UV does not modify the original AirAware environmental burden score.

AirAware can identify the lowest-risk outdoor window during the next 24 hours based on the environmental factors selected in the Personal Allergy Profile.

## Share Daily Summary

AirAware can generate a compact, emoji-formatted daily summary suitable for messaging apps and social media.

The summary can include the selected score, main environmental factor, best outdoor window, UV peak, and location. The summary uses the 😷 mask emoji as the AirAware plain-text identifier.

Summaries are generated locally and copied directly to the system clipboard. AirAware does not upload shared summaries.

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

When nearby vegetation context is enabled, latitude and longitude are sent to
the configured OpenStreetMap Overpass API. The query requests mapped vegetation
and land-use features near the coordinates, including broad vegetation
categories and explicitly mapped birch, alder, or olive taxonomy where
available. Results are cached locally. OpenStreetMap coverage may be incomplete,
and the absence of mapped features must not be interpreted as evidence that
vegetation is absent.

Personal Allergy Profile selections are stored only in local Cinnamon settings.
They are not sent to Open-Meteo, OpenStreetMap, or any other data provider.

Best outdoor-window selection is calculated locally. AirAware does not send
Personal Allergy Profile selections, personalized scores, or outdoor-window
preferences to any provider.

Daily summaries are generated locally and copied directly to the system
clipboard. AirAware does not upload shared summaries, coordinates, or Personal
Allergy Profile settings.

## Data Source

AirAware uses the Open-Meteo Air Quality API:

https://open-meteo.com/en/docs/air-quality-api

AirAware also uses the Open-Meteo Weather Forecast API for weather variables
used by Mold potential and UV index:

https://open-meteo.com/en/docs

Open-Meteo provides air quality, pollen, AQI, and weather forecast data without requiring an API key for normal public API usage. Availability varies by variable, region, model domain, and season. Pollen data is primarily available in Europe during pollen season.

Data source attribution: Open-Meteo.com.

AirAware uses OpenStreetMap Nominatim for reverse geocoding:

https://nominatim.openstreetmap.org/

Place-name attribution: OpenStreetMap contributors.

AirAware uses the OpenStreetMap Overpass API for optional nearby vegetation
context:

https://overpass-api.de/

Vegetation and land-use data: OpenStreetMap contributors.

## Limitations

- Pollen variables are primarily available in Europe during pollen season.
- Forecast quality depends on the upstream air quality and weather models and region.
- Forecasts are model estimates, not exact local sensor readings.
- The risk score is an environmental burden index specific to AirAware, not a medical, regulatory, or AQI claim.
- Mold potential is inferred from temperature, humidity, leaf wetness, precipitation, dew point, and wind.
- Mold potential is not a measured mold-spore concentration.
- Aerosol optical depth describes particles through the atmospheric column and may not exactly represent surface exposure.
- Wildfire-related PM10 may not be available in every region or model.
- Visibility can be reduced by humidity, cloud, fog, dust, or aerosols and is not a direct pollution measurement.
- Carbon monoxide, aerosol, and PM10 levels can originate from multiple sources.
- AQI values should not be described as medical advice.
- AirAware does not account for personal sensitivity, medication, indoor exposure, masks, activity level, or clinical history.
- A selected Personal Allergy Profile factor may be unavailable because of region, season, model coverage, or upstream data availability. Missing values are omitted rather than treated as zero.
- The Personal Allergy Profile uses AirAware's environmental burden weighting across selected factors. It does not model clinical sensitivity or reaction severity.
- The outdoor-window recommendation is based only on available selected environmental variables. It does not guarantee safe or symptom-free conditions.
- Shared summaries reflect model-based environmental conditions available when the summary is generated. They do not predict symptoms or guarantee safe conditions.
- Nearby vegetation context depends on OpenStreetMap mapping coverage and Overpass availability.
- OpenStreetMap vegetation coverage varies by region. Missing mapped features do not mean that the vegetation is absent.
- Mapped birch, alder, and olive entries require explicit taxonomy tags in OpenStreetMap and do not imply current flowering or pollen production.

## Roadmap

- Manual location search/geocoding
- Multiple saved locations
- Multiple providers
- Custom weighting
- Graphs

## Development

Development scripts and tests are intentionally kept outside the installable Cinnamon payload. In a full source checkout, use the root-level README for local testing and validation instructions.
