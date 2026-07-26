# JMA Weather Japan

JMA Weather Japan is a Cinnamon panel applet for weather forecasts in Japan. It combines regional and weekly forecasts from the Japan Meteorological Agency (JMA) with estimated current conditions and hourly data from Open-Meteo.

## Features

- Current estimated temperature, apparent temperature, wind, precipitation and UV
- Hourly forecasts including precipitation probability and amount
- JMA regional and weekly forecasts
- Prefecture and municipality selection
- Configurable panel display and weather notifications
- Last-good cache and partial-provider fallback during temporary service failures

Current conditions are estimates provided by Open-Meteo. A high precipitation probability alone does not change the weather icon to rain; the icon follows the provider's weather condition data.

## Data sources

- [Japan Meteorological Agency](https://www.jma.go.jp/) for regional and weekly forecasts
- [Open-Meteo](https://open-meteo.com/) for estimated current conditions, hourly forecasts and municipality geocoding

## Configuration

Open the applet configuration from Cinnamon's applet settings or from the applet menu. Select a Japanese prefecture and municipality, or enter coordinates manually.

The external configuration window requires Python 3, PyGObject and GTK 3. These are normally available in Linux Mint's Cinnamon environment.

## Privacy and local storage

No account is required. The applet contains no advertising, analytics or tracking.

Forecast requests send a JMA area code to JMA and coordinates to Open-Meteo. Weather data is cached under the user's XDG cache directory for up to 24 hours. Cinnamon stores applet settings under the user's XDG configuration directory.

## Known limitations

- The interface and JMA forecast text are currently Japanese.
- The applet targets Cinnamon 6.6.
- Availability and update times depend on the external data providers.

## Reporting issues

Report problems in the [JMA Weather Widget issue tracker](https://github.com/ultrasukiyaki/jma-weather-widget-for-cinnamon/issues).

## License

JMA Weather Japan is released under the MIT License.
