# cinnamon-weather

Adaptation of Gnome Shell's [weather extension](https://github.com/simon04/gnome-shell-extension-weather) for the [Cinnamon](http://cinnamon.linuxmint.com) desktop.

cinnamon-weather uses [Semantic Versioning](http://semver.org/).  For the current version number, see `metadata.json`.  

----
## Setup
### OpenWeatherMap API Key Setup
Go to [OpenWeatherMap](https://openweathermap.org/) and create an account. Select their free tier. Then go your [API keys section](https://home.openweathermap.org/api_keys) where you should find one key already created.

![openweathermap_api_guide_screenshot](https://user-images.githubusercontent.com/3834659/51523797-48ef4c00-1de1-11e9-9e5b-39d0116b1468.png)

Copy this key and paste it into the "API Key" field in the applet configuration window.

### OpenWeatherMap Location
The following formats are supported:

* City, Country Code (e.g. London,UK)
* Zipcode, Country Code (e.g. 94111,US)
* Latitude, Longitude (e.g. 37.77,122.41)

If the location you try does not work, try using [OpenWeatherMap's finder](https://openweathermap.org/find) and paste the coordinates.

### DarkSky API Key Setup

### DarkSky Location

## Requirements

* [Cinnamon](https://github.com/linuxmint/Cinnamon) 1.8+ 

For compatibility with Cinnamon 1.7 or earlier, use an [archived](https://github.com/mockturtl/cinnamon-weather/tags) version.

## Configuration

Right-click to access `cinnamon-settings` -> _Applets -> Configure_.

## Mailing list
[Mailing list](http://groups.google.com/group/cinnamon-weather)

## Known Issues
* Translations in general and are in bad shape after the rework, contribute if you can, it is always much appreciated.
* Sunset/Sunrise is not displayed correctly if there is a mismatch between the Location and system timezone
* DarkSky verbose conditions are only in cm/celsius

###### Fedora 19 "Schrödinger's Cat" 

A [bug](https://github.com/mockturtl/cinnamon-weather/issues/43) in this release prevents the applet from loading.  See the link for the fix.
