# cinnamon-weather

Adaptation of Gnome Shell's [weather extension](https://github.com/simon04/gnome-shell-extension-weather) for the Cinnamon desktop.

cinnamon-weather uses [Semantic Versioning](http://semver.org/).  For the current version number, see `metadata.json`.  

## Versions

Versions are automatically selected based on you Cinnamon's version.

- [Cinnamon](https://github.com/linuxmint/Cinnamon) **3.0+ is End-of-Life, won't receive more updates**
- [Cinnamon](https://github.com/linuxmint/Cinnamon) 3.8+ is the currently supported version.

----

## Configuration

Right-click to access `cinnamon-settings` -> *Applets -> Configure*.

### Location

The applet obtains the location automatically. If the automatic location not adequate for you, you can use the **Manual Location** mode where the applet either accepts:

* **Coordinates** in Latitude, Longitude format (e.g. 37.77,122.41). You can use [OpenWeatherMap's finder](https://openweathermap.org/find) and paste the coordinates in from there.
* or an **Address** (it can be just a city and country, it is pretty flexible). After 3 seconds, the applet will replace the text that you entered with the full address it finds so you can verify if it's correct. You can also get your exact address to enter from [OpenStreetMap's Nominatim search](https://nominatim.openstreetmap.org/), the service the applet uses.

You can also save locations what you entered manually and switch between them in the applet *(arrows will appear on both sides of the location in the applet if you have more than two saved)*. 

### Weather providers to choose from

| Weather Providers          | Needs API key | Maximum Forecast Days | Maximum Forecast Hours | Immediate Forecast | Other information             |
| -------------------------- | ------------- | --------------------- | ---------------------- | ------------------ | ----------------------------- |
| **OpenWeatherMap**         | No            | 8                     | 48                     | Yes                | Default provider              |
| **MET Norway**             | No            | 10                    | 48                     | Depends            | --                            |
| **DMI Denmark**            | No            | 10                    | 48                     | No                 | --                            |
| **Deutscher Wetterdienst** | No            | 10                    | 240                    | No                 | --                            |
| **Met Office UK**          | No            | 5                     | 36                     | No                 | --                            |
| **US National Weather**    | No            | 7                     | 156                    | No                 | --                            |
| **WeatherBit**             | Yes           | 16                    | 0**                    | No                 | --                            |
| **Visual Crossing**        | Yes           | 15                    | 336                    | No                 | --                            |
| **Tomorrow.io**            | Yes           | 15                    | 108                    | No                 | Previously known as Climacell |
| **AccuWeather**            | Yes           | 5***                  | 12                     | No                 | Limited free calls            |
| **Weather Underground**    | Yes           | 5                     | 0                      | No                 | --                            |
| **Pirate Weather**         | Yes           | 7                     | 168                    | Yes                |                               |

### OpenWeatherMap

Worldwide Online Weather service by OpenWeather Ltd founded in 2012 with headquarters in London UK. [OpenWeatherMap Website](https://openweathermap.org/). Read more about the service [here](https://en.wikipedia.org/wiki/OpenWeatherMap).

* This is the default provider that works out of the box. Big Thanks to them supporting free open source projects, like this!

### MET Norway

Free meteorological data and forecasts from the Norwegian Meteorological Institute founded in 1866. [MET Norway Website](https://www.met.no/en). Read more about the institute [here](https://en.wikipedia.org/wiki/Norwegian_Meteorological_Institute).

* Nowcast (Immediate precipitation and granular observations) is not available outside Norway. In that case, observations are shown for the next hour.

* Daily forecasts are generated from 6 hour forecasts (for every hour), so there is a possibility that they are inaccurate sometimes.

### DMI Denmark

The Danish Meteorological Institute formed in 1872 and makes weather forecasts and observations for Denmark, Greenland, and the Faroe Islands. [DMI Denmark Website](https://www.dmi.dk) Read more about the institute [here](https://en.wikipedia.org/wiki/Danish_Meteorological_Institute).

* The service is global with open weather data.

### Deutscher Wetterdienst

German National Weather Provider. [Deutsche Wetterdienst Website](https://www.dwd.de/DE/Home/home_node.html). Read more about the institute [here](https://en.wikipedia.org/wiki/Deutscher_Wetterdienst).

* **Only covers Germany**.

### Met Office UK

The Meteorological Office, abbreviated as the Met Office, is the UK's national weather service founded in 1854. [Met Office UK Website](https://www.metoffice.gov.uk/). Read more about the agency [here](https://en.wikipedia.org/wiki/Met_Office).

* **Only covers the UK.**

* Sometimes it takes like 5-10 seconds to obtain weather, please be patient when it loads up the first time.

* It uses the nearest forecast site and observation sites in an 50km area, it displays an error if it does not find any. Please open a new issue if this happens and you live in the UK! (There are much less observation sites than forecast sites.)

### US National Weather

The National Weather Service in the USA is a federal government agency formed in 1861. [US National Weather Website](https://www.weather.gov/). Read more about the agency [here](https://en.wikipedia.org/wiki/National_Weather_Service).

* **Only covers the US**

* Sometimes it takes 10-15 seconds to obtain weather, please be patient when it loads up the first time.

* Observations are quite spotty so it combines multiple observation stations if needed in a 50km area.

### Weatherbit.io

Historical and Forecast Weather data service provided by Weatherbit LLC in the USA. [Weatherbit.io Website](https://www.weatherbit.io). Read more about the service [here](https://www.weatherbit.io/about).

* To get an API key, go to [Weatherbit.io](https://www.weatherbit.io/account/create) and create an account. Then go your [Dashboard](https://www.weatherbit.io/account/dashboard) where you should find your secret key already created.

* At least 10 minutes as refresh rate is recommended, since otherwise you might exceed you daily quota, the Free API subscription is limited to 500 calls per day.

* **Hourly Weather forecast requires a non-free account

### Visual Crossing

Weather service from Visual Crossing Corporation founded in 2003 with headquarters in USA and Germany. [Visual Crossing Website](https://www.visualcrossing.com/). Read more about the service [here](https://www.visualcrossing.com/about). 

* Needs an API key, you can [Sign Up here](https://www.visualcrossing.com/weather/weather-data-services#/signup) and grab one

* Provides 1000 Free calls a day

### Tomorrow.io

Meteorological data from American weather technology company with headquarters in Boston since 2016. Changed name from Climacell to Tomorrow.io in March 2021. [Tomorrow.io Website](https://www.tomowrrow.io/). Read more about the company [here](https://en.wikipedia.org/wiki/Tomorrow.io).

* Please note that old ClimacellV4 keys are not working anymore. You need to re-register and get a new key.

* API key can be obtained [here](https://app.tomorrow.io/signup?planid=5fa4047f4acee993fbd7399d&vid=153ef940-c389-41d4-847e-d83d632059d0). Register and the API key will be shown in the [Develpment section](https://app.tomorrow.io/development/keys). Free plan comes with 1000 free calls per day.

### AccuWeather

Online Service from company AccuWeather Inc, founded in 1962 with headquarters in the US, provides a global weather source. [AccuWeather Website](https://www.accuweather.com/). Read more about the company [here](https://en.wikipedia.org/wiki/AccuWeather)

* With the free plan, there are only a very limited number of calls for a day, which will be displayed in the applet menu. Please lower your Update interval setting in Configuration or you may run out of calls and then the service will stop with an error message until the next day.

* ***Number of available hours and days are specified for the free plan, [paid plans allow more](https://developer.accuweather.com/packages).

* API keys can be obtained [here](https://developer.accuweather.com/user/register). Register, then you must add a new App. When it's created Click on the App and the key will be displayed.

### Weather Underground

Weather Underground is a privately owned, web-based weather information company. It provides weather observations and forecasts in a large number of locations around the world. It was founded by Jeff Masters in 1995 with headquarters in Ann Arbor United States. [Weather Underground website](https://www.wunderground.com/). Read more about the service [here](https://en.wikipedia.org/wiki/Weather_Underground_(weather_service)).

- Only allows 1500 calls a day, so 15min refresh cycle is recommended.
- Weather Underground is a global community of people connecting data from environmental sensors like weather stations (250.000) and air quality monitors so they can provide the rich, hyperlocal data you need.
- You need an API key. If you don't have a weather station to share data with WU, you can't have an API key. However, you can add a Raspberry Pi as a device for the weather station choice when [registering](https://www.wunderground.com/signup), even if you don't have one, and it will get you the API key.
- Disclaimer: Observations don't provide weather conditions so the forecast one for the day is used.

### Pirate Weather

Direct replacement to DarkSky. Run by one guy, it's also open source. If you like the accuracy of the data or you want to keep the project going, subscribe to a paid plan. 10000 calls free. You can get an API key [here](https://pirate-weather.apiable.io/products/weather-data).

You can read about the project [here](http://pirateweather.net/en/latest/).

### Usage of "Override label on panel", "Override location label" and "Override tooltip on panel" setting

The setting allows you to make the applet display basically anything in the form of text in the panel (and other places). In addition, it exposes a number of values for you to use as you like, these will be replaced with actual data values. The full text-to-value mapping can be found below.

| Text to enter     | Mapped value                                              |
| ----------------- | --------------------------------------------------------- |
| `{t}`             | Temperature value                                         |
| `{u}`             | Temperature unit                                          |
| `{c}`             | Short condition text                                      |
| `{c_long}`        | Long condition text (same as short if not available)      |
| `{dew_point}`     | Dew point value                                           |
| `{humidity}`      | Humidity value (always as percent)                        |
| `{pressure}`      | Pressure value                                            |
| `{pressure_unit}` | Pressure unit                                             |
| `{extra_value}`   | API specific value (usually "Feels Like" or "Cloudiness") |
| `{extra_name}`    | API specific value's name                                 |
| `{wind_speed}`    | Wind speed with unit                                      |
| `{wind_dir}`      | Wind direction in text format (NW, etc)                   |
| `{city}`          | City name shown in the popup                              |
| `{country}`       | Country name shown in the popup                           |
| `{search_entry}`  | Search entry text in manual location (or location store)  |
| `{last_updated}`  | Formatted last updated time                               |

## Future Plans

* Add special formatting options (like padded temperature) for values in panel in the "Override label on panel" setting 

## Language Translations

If you want to update or change the translation in your language other than English, here are some steps to get you started. Keep in mind that your local changes will be overwritten when an update of the applets language is installed. Feel free to share your translation, which is very much appreciated, 
by making a PR (pull request) on Github or contact the current maintainer of the applet.

1. Install the translation editor **poedit** with your package manager and download your language PO file e. g. *xx.po* where xx is your ISO language code, and the template POT file *[weather@mockturtl.pot](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/weather%40mockturtl/files/weather%40mockturtl/po/weather@mockturtl.pot)* from the *files/weather@mockturtl/po/* sub directory on the [Github website](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/weather%40mockturtl/files/weather%40mockturtl/po/)

2. Start **poedit** and open your downloaded PO file *xx.po*, then go to menu *Catalogue* or *Translate* depending on version, choose *"Update from POT file…"* and open the POT file *[weather@mockturtl.pot](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/weather%40mockturtl/files/weather%40mockturtl/po/weather@mockturtl.pot)*. Start your editing and try to use previously contributed translations as much as possible and get familiar with the correct technical weather terms for things in your language.

3. When done translating, click on *Validate* and *Save*. This creates a new MO file that you can use locally in your system by overwriting the file *~/.local/share/locale/xx/LC_MESSAGES/weather@mockturtl.mo* and restart your system to check how your translation works.

## Known Issues

* Hourly forecast toggle button is not centered to the middle of the popup menu

* Sunset/Sunrise is not displayed correctly if there is a mismatch between the Location Timezone and System Timezone when using Manual Location with some of the weather providers

* DarkSky verbose conditions are only in cm/Celsius or in/Fahrenheit

### Report a new issue

You need a Github login to make a issue report. Please first check if the issue already is reported [here](https://github.com/linuxmint/cinnamon-spices-applets/issues?q=is%3Aissue+is%3Aopen+weather). You will find more information about reporting in the Configuration under the Help Tab, accessible by right clicking on the applet. Here you can save logs to file with debug level that is much appreciated. By using the *Submit an Issue* Button under this Tab, useful system information will be generated for your report form in your default web browser at Github.com. 

### Troubleshooting

#### Enabling debug mode

You can enable debug mode for more logging by creating a file named ```DEBUG``` in the folder of the applet here: ```~/.local/share/cinnamon/applets/weather@mockturtl/```, then restart Cinnamon.

#### See the logs producing by applets

You can see Logs by opening the Cinnamon 'Looking Glass' debugger. You can open it by Right Clicking on your Panel (taskbar), then Troubleshoot->Looking Glass

Logs can be found under the ```Log``` Tab.

[Changelog](https://github.com/linuxmint/cinnamon-spices-applets/blob/master/weather%40mockturtl/CHANGELOG.md)
