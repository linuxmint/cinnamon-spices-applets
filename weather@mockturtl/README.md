# cinnamon-weather

Adaptation of Gnome Shell's [weather extension](https://github.com/simon04/gnome-shell-extension-weather) for the Cinnamon desktop.

cinnamon-weather uses [Semantic Versioning](http://semver.org/).  For the current version number, see `metadata.json`.  

----

## Setup

### OpenWeatherMap API Key

**OpenWeatherMap does not require API key anymore! Big Thanks to them for supporting this applet!**

### OpenWeatherMap Location

The following formats are supported:

- Zipcode, Country Code (e.g. 94111,US)

- Latitude, Longitude (e.g. 37.77,122.41)
* City, Country Code (e.g. London,UK), or ZIP, Country Code

If the location you try does not work, try using [OpenWeatherMap's finder](https://openweathermap.org/find) and paste the coordinates.

------

### DarkSky API Key Setup

Go to [DarkSky](https://darksky.net/dev/register) and create an account. Then go your [Console section](https://darksky.net/dev/account) where you should find your secret key already created.

### DarkSky Location

DarkSky only supports Latitude, Longitude format! (e.g. 37.77,122.41)

---

### MET Norway Location

MET Norway only supports Latitude, Longitude format! (e.g. 37.77,122.41)

----

### Weatherbit API Key Setup

Go to [Weatherbit.io](https://www.weatherbit.io/account/create) and create an account. Then go your [Dashboard](https://www.weatherbit.io/account/dashboard) where you should find your secret key already created.

### Weatherbit Location

Weatherbit implementation only supports Latitude, Longitude format! (e.g. 37.77,122.41) Might expand the support on it later.

------

## Requirements

* [Cinnamon](https://github.com/linuxmint/Cinnamon) 1.8+

## Configuration

Right-click to access `cinnamon-settings` -> _Applets -> Configure_.

## Mailing list

[Mailing list](http://groups.google.com/group/cinnamon-weather)

## Known Issues

* Sunset/Sunrise is not displayed correctly if there is a mismatch between the Location Timezone and System Timezone when using Manual Location
* DarkSky verbose conditions are only in cm/celsius or in/fahrenheit

### Troubleshooting

###### Enabling debug mode

You can enable debug mode for more logging by creating a file named ```DEBUG``` in the folder of the applet here: ```~/.local/share/cinnamon/applets/weather@mockturtl/```

###### See the logs producing by applets

You can see Logs by opening the Cinnamon 'Looking Glass' debugger. You can open it by Right Clicking on your Panel (taskbar), then Troubleshoot->Looking Glass

Logs can be found under the ```Log``` Tab.



[Changelog](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/weather%40mockturtl/CHANGELOG.md)
