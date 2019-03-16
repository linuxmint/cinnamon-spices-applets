# cinnamon-weather

Adaptation of Gnome Shell's [weather extension](https://github.com/simon04/gnome-shell-extension-weather) for the [Cinnamon](http://cinnamon.linuxmint.com) desktop.

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

------



## Requirements

* [Cinnamon](https://github.com/linuxmint/Cinnamon) 1.8+

## Configuration

Right-click to access `cinnamon-settings` -> _Applets -> Configure_.

## Mailing list
[Mailing list](http://groups.google.com/group/cinnamon-weather)

## Known Issues
* Translations in general and are in bad shape after the rework, contribute if you can, it is always much appreciated.
* Sunset/Sunrise is not displayed correctly if there is a mismatch between the Location Timezone and System Timezone
* DarkSky verbose conditions are only in cm/celsius or in/fahrenheit

###### Fedora 19 "Schrödinger's Cat" 

A [bug](https://github.com/mockturtl/cinnamon-weather/issues/43) in this release prevents the applet from loading.  See the link for the fix.
