# Changelog

## 2.4.8

* Update Openweathermap to their unified API call
* Add information on DarkSky aquisition to Readme
* Fix translation issues in files other than applet.js
* Add Yahoo Weather to the available services
* Fix issue when system time is changed backwards, the applet stops updating until time gets to the time previously set
* Change 'Updated' to 'As of' to have a clearer meaning.

## 2.4.7

* Fixes [#2929](https://github.com/linuxmint/cinnamon-spices-applets/issues/2929)
* Fix styling issues with forecasts box - There wasn't enough margin on the bottom when the icon's height were bigger than the text, neither when the forecasts were wider than the current weather box.

## 2.4.6

* Fixes [#2907](https://github.com/linuxmint/cinnamon-spices-applets/issues/2907)
* Update Hungraian translation

## 2.4.5

* Fixes [#618](https://github.com/linuxmint/cinnamon-spices-applets/issues/618)
* Fixes [#2885](https://github.com/linuxmint/cinnamon-spices-applets/issues/2885)
* Fixes [#2890](https://github.com/linuxmint/cinnamon-spices-applets/issues/2890)
* Center Sunrise and Sunset Label, and use icons instead of text.
* Use weather-icons from [Erik Flowers](https://github.com/erikflowers/weather-icons) instead of Climaicons as it has more icons for conditions.
* Add Python-JS Yahoo bridge, preparation to add Yahoo back as an option.
* Add option to use the Custom icon set in the popup menu, not just on the panel.
* Maximum number of forecasts displayed increased from 5 to 7.
* Code refactor in preparation for adding Hourly forecasts on middle click (Config, Main Loop and PopupMenu has its own class now)
* Amend styling to be more consistent across themes

## 2.4.4

* Fixes [#2782](https://github.com/linuxmint/cinnamon-spices-applets/issues/2872)
* Add ability to override applet label with injecting values (customise and fit text on horizontal and vertical panels as well)

## 2.4.3

* Fixes [#2861](https://github.com/linuxmint/cinnamon-spices-applets/issues/2861)
* Fixes [#2860](https://github.com/linuxmint/cinnamon-spices-applets/issues/2860)

## 2.4.2

* Fixes [#2853](https://github.com/linuxmint/cinnamon-spices-applets/issues/2853)

## 2.4.1

* Add weatherbit.io as a weather provider.
* Fix fast looping when there is a settings error (wrong api key, wrong location), 15ms loop instead of 15s
* Fix [#2835](https://github.com/linuxmint/cinnamon-spices-applets/issues/2835) again?!

## 2.4.0

* Fixes [#2835](https://github.com/linuxmint/cinnamon-spices-applets/issues/2835)
* Fixes [#2831](https://github.com/linuxmint/cinnamon-spices-applets/issues/2831)
* Fixes [#2305](https://github.com/linuxmint/cinnamon-spices-applets/issues/2305) and [#780](https://github.com/linuxmint/cinnamon-spices-applets/issues/780) I guess?
* Add Met Norway as a weather provider
* Add sunrise/sunset calculator to support Met Norway.

## 2.3.7

* Fixes [#2816](https://github.com/linuxmint/cinnamon-spices-applets/issues/2816), changed to different geolocation API
* Fixes [#2808](https://github.com/linuxmint/cinnamon-spices-applets/issues/2808)
* Debug can be enabled by placing a file named DEBUG to the applet folder
* Added complete TS declaration files for some import modules (the easy ones...)
* Only import whats needed (hopefully it speeds loading the applet the first time, but I don't really know)

## 2.3.6

* Configuration page reorganized, hopefully it makes more sense now
* Custom iconset (Climaicons) can be used on the panel
* Added lock to the main loop what hopefully fixes some weird issues what I see coming up from people
* Also a few more debug lines

## 2.3.4

* Various small bugfixes
* Change repeated error handling (increases time between retries, tops up at 15 mins)
* Add last refreshed time to the tool-tip next to location.

## 2.3.2

* Add Serbian Translation

## 2.3.1

Fixes:

* DarkSky Conditions logic was inverted, it filtered out almost every word.
* SystemLanguage string was processed incorrectly (split by the wrong char)
* Updating French Translation to include Today and Tomorrow

## 2.3.0

* Fixed Issues with Debian, now Polyfilling Promises when needed
* Reworked on how to import from other files, now in line with other applets
* Utility functions moved to other file.
* Typescript declarations reorganised now they make a little bit more sense *(generated declarations from gir files still don't work that well, although mostly working)*
* Can now build from same source down to Cinnamon Version 3.0
* Fixed some styling issues with some themes (Adapta, etc) where the Forecast box did not have enough padding
* Sunset/Sunrise and Day names are using the system locale *(3.4+)*

## 2.2.0

General changes:

* Source converted to Typescript.
* Added some basic Typescript declarations of Cinnamon js libraries (minimum needed for the applet)
* Added Build scripts and Build guide
* Text 'Today' and 'Tomorrow' is used for forecasts in 3.8+
* Version 3.6 changed to 3.4 and using the Typescript source compiled to es5 with some extra changes after:
  * All files moved into One file
  * code regarding importing other files was removed
  * .ToLocaleString() does not support Timezones, removed
  * Array.includes polyfill added (it is used in DarkSky)

Fixes:

* !!! the panel was not rebuilding at the correct time on refresh (I 
  honestly don't know how the app was working before at all), now 
  rebuilding is part of the data refresh function.
* Applet was crashing when there was no internet (Debug line was outside try/catch)
* Big performance increase in version 3.4, plus DarkSky support
* OpenWeatherMap forecast conditions were always translated, fixed.
* Several fixes where undefined variables were referred to, now fixed (found while converting to TS)

New stuff:

* 3.8+: Added Refresh button to context menu.

## 2.1.7

* Fixed issue that OpenWeatherMap forecast conditions were always translated
* Updated Hungarian translation
* Version bump

## 2.1.6

* Fixed regression when location label override did not work if no City information was available

## 2.1.5

* DarkSky short conditions contained words like 'and', 'until' at the end (used wrong function), this is now fixed
* Day names are now properly translated
* Update Translation template

## 2.1.4

* Applet did not load on Cinnamon version 3.6, it seems it needs the separate folder named 3.6.  
  So now we have 3.8 for 3.8+, 3.6 for 3.6, and everything below uses the version in root. All working for real now..
* DarkSky was not using TimeZone information for displaying times and forecast days

## 2.1.3

* Multiversion fix. Everything below 3.8 should use the previous 
  version now (3.6 version moved to the root folder), because it does not 
  even work with version 3.2 at the moment.
* Small addition for DarkSky condition processing for shorter conditions.

## 2.1.2

**3.6**

* OpenWeatherMap using FOSS key and proper daily forecasts.

**3.8**

* Removed "require"-s, swapped them to imports
* Fixed bug when Cinnamon froze when the taskbar was manipulated when the applet was enabled on it.
* DarkSky was Getting the Forecast day names from sunrise time, fixed
* Humidity is rounded now.
* Location element is a button again, opens Data services webpages 
  with more weather, or it can trigger a refresh if there was an error 
  (there is no need anymore, but still).

## 2.1.1

* Openweathermap no longer requires key
* Forcing mainloop to refresh when Weather update fails (it was not 
  updating for a whole refresh interval when we had a successful update 
  then the settings was changed right after and update failed)
* Using Regex against Location setting
* DarkSky error messages are displayed properly to the users now
* Fixed some OpenWeatherMap json response error handling (it was matching strings to numbers)
* Removed obsolete code
* Edited Readme
* Added some thanks to OpenWeatherMap at the bottom of the settings

## 2.0.1

* Fixed issue where sunset/sunrise displayed twice
* Forecast compiling uses timezone calculation to separate forecasts to the correct days now
* Fixed issue where days were displayed incorrectly, now are 
  calculated displayed with timezone offset (was bad with people near the 
  day boundary i guess)
* using HTTPS to call OpenWeather

## 2.0.0

* Pull request to make the weather applet functional again after Yahoo API changes

* Added capability to support more than 1 API, but only OpenWeatherMap is implemented at the moment.
