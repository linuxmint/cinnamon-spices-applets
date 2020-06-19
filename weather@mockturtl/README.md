# cinnamon-weather

Adaptation of Gnome Shell's [weather extension](https://github.com/simon04/gnome-shell-extension-weather) for the Cinnamon desktop.

cinnamon-weather uses [Semantic Versioning](http://semver.org/).  For the current version number, see `metadata.json`.  

----

## Setup

**The applet obtains the location automatically, see below how to obtain API keys if your chosen weather provider needs one.**

In **Manual Location** mode the applet **only** **accepts Coordinates** in Latitude, Longitude format (e.g. 37.77,122.41). You can use [OpenWeatherMap's finder](https://openweathermap.org/find) and paste the coordinates in from there.

## Weather providers to choose from

| Weather Providers  | Needs API key | **Maximum Forecast Days** | **Maximum Forecast Hours** | Required Packages         |
| ------------------ | ------------- | ------------------------- | -------------------------- | ------------------------- |
| **OpenWeatherMap** | No            | 7                         | 48                         | --                        |
| **DarkSky**        | Yes*          | 8                         | 168                        | --                        |
| **MET Norway**     | No            | 10                        | 48                         | --                        |
| **WeatherBit**     | Yes           | 16                        | 0**                        | --                        |
| **Yahoo**          | No            | 10                        | 0                          | --                        |
| **Climacell**      | Yes           | 16                        | 96                         | python3-requests-oauthlib |

### OpenWeatherMap

OpenWeatherMap does not require API key anymore! Big Thanks to them for supporting this applet!

### DarkSky

***[DarkSky has been aquired by Apple](https://blog.darksky.net/dark-sky-has-a-new-home/)** as of March 31, 2020. It does not allow new signups, and it will cease to function at the end of 2021.

### MET Norway

* Current weather is shown for the next hour

* Daily forecasts are generated from 6 hour forecasts, so it can look incorrect sometimes (did my best).

### Weatherbit.io

* **Needs API key.** Go to [Weatherbit.io](https://www.weatherbit.io/account/create) and create an account. Then go your [Dashboard](https://www.weatherbit.io/account/dashboard) where you should find your secret key already created.

* At least 10 minutes as refresh rate is recommended, since otherwise you might exceed you daily quota.

* **Hourly Weather forecast requires a non-free account

### Yahoo

* Current weather refreshes every 2 hours.

### Climacell

* API key can be obtained [here](https://developer.climacell.co/sign-up). Register and the API key will be shown in the Overview section.



## Requirements

* [Cinnamon](https://github.com/linuxmint/Cinnamon) 1.8+, 

## Configuration

Right-click to access `cinnamon-settings` -> _Applets -> Configure_.

## Mailing list

[Mailing list](http://groups.google.com/group/cinnamon-weather)

## Future Plans

* Switch to MET Norway API v2.0 when it comes out (has a better iconnaming scheme for conditions)

## Known Issues

* Hourly weather forecast does not fit if it's too long and elided, e.g.: "Mostly Clou..."

* Hourly forecast toggle button is not centered to the middle of the popup menu

* Sunset/Sunrise is not displayed correctly if there is a mismatch between the Location Timezone and System Timezone when using Manual Location

* DarkSky verbose conditions are only in cm/celsius or in/fahrenheit

### Troubleshooting

###### Enabling debug mode

You can enable debug mode for more logging by creating a file named ```DEBUG``` in the folder of the applet here: ```~/.local/share/cinnamon/applets/weather@mockturtl/```

###### See the logs producing by applets

You can see Logs by opening the Cinnamon 'Looking Glass' debugger. You can open it by Right Clicking on your Panel (taskbar), then Troubleshoot->Looking Glass

Logs can be found under the ```Log``` Tab.

[Changelog](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/weather%40mockturtl/CHANGELOG.md)
