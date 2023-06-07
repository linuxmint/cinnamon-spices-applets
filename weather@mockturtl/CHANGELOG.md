# Changelog

## 3.2.13

* Add Pirate Weather as a provider
* Remove DarkSky
* Fix [#4716](https://github.com/linuxmint/cinnamon-spices-applets/issues/4716)
* Fix [#4719](https://github.com/linuxmint/cinnamon-spices-applets/issues/4719)
* Fix [#4762](https://github.com/linuxmint/cinnamon-spices-applets/issues/4762)
* Fix [#4765](https://github.com/linuxmint/cinnamon-spices-applets/issues/4765)

## 3.2.12

* Minor style changes
* Make "Location Label Override" behavior identical to Panel label override.
* Add option to override tooltip label for applet
* Try to make hourly weather elements slimmer by putting precipitation change and volume in different rows
* Update luxon and suncalc
* Update README
* Use user's timezone for automatic unit inference, Fixes [#4644](https://github.com/linuxmint/cinnamon-spices-applets/issues/4644)
* Fixes [#4628](https://github.com/linuxmint/cinnamon-spices-applets/issues/4628)
* Fix MET UK crash when observation stations return a single object instead of an array for it's observation
* Add support for saving config from new path and respect ENV variable for xsession-errors

## 3.2.11

* Fix issue where refresh loop wouldn't ever resume after a single configuration error  

## 3.2.10

* Add more granular control for setting changes
* Fixes [#4505](https://github.com/linuxmint/cinnamon-spices-applets/issues/4505)

## 3.2.9
* Add support for Soup v3

## 3.2.8

* Resolve [#4426](https://github.com/linuxmint/cinnamon-spices-applets/issues/4426) - Add Weather Underground as a provider

## 3.2.7

* Fix [#4390](https://github.com/linuxmint/cinnamon-spices-applets/issues/4390) - Make sure applet works with not configured Locale

## 3.2.6

* Fix [#4387](https://github.com/linuxmint/cinnamon-spices-applets/issues/4387)
* also add some more location-related entries into the applet label override

## 3.2.5

* Fix [#4378](https://github.com/linuxmint/cinnamon-spices-applets/issues/4378) - Add DWD as a weather provider

## 3.2.4

* Fix issue on Cinnamon versions where `is_finalized` is not injected into GObject

## 3.2.3

* Fix [#4306](https://github.com/linuxmint/cinnamon-spices-applets/issues/4306)

## 3.2.2

* Fix [#4292](https://github.com/linuxmint/cinnamon-spices-applets/issues/4292)
* Fix [#4285](https://github.com/linuxmint/cinnamon-spices-applets/issues/4285)

## 3.2.1

* Fix [#4255](https://github.com/linuxmint/cinnamon-spices-applets/issues/4255)
* Redact more things when generating logs

## 3.2.0

* Add requested AccuWeather as a provider
* Add ability to display remaining number of calls in the UI (where applicable)
* Fix issue where the applet would display more hourly boxes than available data
* Improve HttpLib flexibility and type checking
* Add better support for "Override label on panel" setting

## 3.1.9

* Fixes [#4184](https://github.com/linuxmint/cinnamon-spices-applets/issues/4184) - missing space in .pot file
* Fixes [#4127](https://github.com/linuxmint/cinnamon-spices-applets/issues/4127) - Text is at an abnormal height
* Fix issue in WeatherBit provider where it would break if it tries to parse a date with January for month
* Various minor syntax improvements (usage of consts and for-of loops)
* Use mapping for getting provider classes instead of a big switch statement

## 3.1.8

* Fixes [#4136](https://github.com/linuxmint/cinnamon-spices-applets/issues/4136) - Fix custom widget not applying translations
* Fixes [#4147](https://github.com/linuxmint/cinnamon-spices-applets/issues/4147)

## 3.1.7

* Switch to stricter typechecking
* Resolves [#4096](https://github.com/linuxmint/cinnamon-spices-applets/issues/4096) - Change old translated string to new version
* Resolves [#3916](https://github.com/linuxmint/cinnamon-spices-applets/issues/3916)
* Applet now detects if network is down and pauses/resumes accordingly

## 3.1.6

* Support changing logging level from settings
* Support saving logs specific to the applet into file along with the applet's settings
* Pre-fill the Github issue form on opening a new issue from the applet
* Update with new declarations

## 3.1.5

* Add Fixes to README by @jorgenqv
* Resolves [#3975](https://github.com/linuxmint/cinnamon-spices-applets/issues/3975) Add option to make hourly weather always visible #3975
* Resolves [#3976](https://github.com/linuxmint/cinnamon-spices-applets/issues/3976) Add dew point as a metric #3976

## 3.1.4

* Update translations file
* Make sure translation generation is not missed again, now included as a build step
* Add VSCode workspace

## 3.1.3

* Update DarkSky API cutoff date
* Update TS declarations
* Resolved [#3926](https://github.com/linuxmint/cinnamon-spices-applets/issues/3926) Change Climacell naming to Tomorrow.io
* Update screenshot

## 3.1.2

* Do not minify code so .pot files can be generated without missing strings.
* Add strict Typescript typechecking

## 3.1.1

* Fix issue where applet wouldn't run on Linux Mint 19-19.3, where libraries targeting higher than es2017 would be included.
* Remove Climacell V3 from Readme

## 3.1.0

* Migrate to Webpack
* Improve error logging
* Use SunCalc from npm so it can receive updates
* Use Luxon for Dates with timezones (finally) so Local timezone and requested location timezone's mismatch can be handled much better
* Fix US Weather logic on deciding where to start processing daily forecasts from. For real this time? [#3806](https://github.com/linuxmint/cinnamon-spices-applets/issues/3806)
* Hopefully it will fix [#3817](https://github.com/linuxmint/cinnamon-spices-applets/issues/3817) by the better TZ handling.
* Remove Climacell V3 as it has reached it's end of life

## 3.0.10

* Fixes [#3815](https://github.com/linuxmint/cinnamon-spices-applets/issues/3815)

## 3.0.9

* Fixes [#3806](https://github.com/linuxmint/cinnamon-spices-applets/issues/3806)
* Update applet to new declarations
* Remove yahoo weather

## 3.0.8

* Fixes [#3787](https://github.com/linuxmint/cinnamon-spices-applets/issues/3787)

## 3.0.7

* Resolves [#3783](https://github.com/linuxmint/cinnamon-spices-applets/issues/3783)
* Fixes wrong filename for declaration file (global.ts -> global.d.ts) causing all kinds of issues

## 3.0.6

* Resolves [#3694](https://github.com/linuxmint/cinnamon-spices-applets/issues/3694)
* Move Typescript declarations out of the weather applet folder to prevent update triggers from other applets making declaration changes. Please review this now if it's ok, should be in a folder with a different name or have a more thorough README etc.
* Update de.po with contribution from kipuka@eclipso.eu
* Add deprecation notices for relevant providers and their EOL date
* Make provider names translatable
* Add stack trace to errors (even if they do not seem to be correct)
* Add option to switch between textual and icon representation of wind direction
* Fixes [#3738](https://github.com/linuxmint/cinnamon-spices-applets/issues/3738)
* Fixes [#3733](https://github.com/linuxmint/cinnamon-spices-applets/issues/3733)

## 3.0.5

* Fixes [#3654](https://github.com/linuxmint/cinnamon-spices-applets/issues/3654)
* Fixes [#3659](https://github.com/linuxmint/cinnamon-spices-applets/issues/3659)

## 3.0.4

* Add declarations for some of the cinnamon js files an organizing declarations better (and add more when I feel up to it again). Technically anyone can use it if want to use Typescript by including the declarations folder into their tsconfig.json file, but whatever.
* Resolves [#3603](https://github.com/linuxmint/cinnamon-spices-applets/issues/3603)
* Add minutely precipitation under current condition, when there is any (and the setting is on)
* Add more tooltips to settings
* OpenWeatherMap can also display Precipitation chance if there is no volume specified
* Auto-format 3.8 and new declaration files
* Fixes [#3637](https://github.com/linuxmint/cinnamon-spices-applets/issues/3637)

## 3.0.3

* Fixes [#3508](https://github.com/linuxmint/cinnamon-spices-applets/issues/3508), just a minor issue with naming

* Fixes [#3539](https://github.com/linuxmint/cinnamon-spices-applets/issues/3539) - Revert capitalization of every word in the applet label.

* Fix some text in the settings-schema, they didn't make much sense or were missing some explanations

* Change Temperature units to be capitalized

* Fixes [#3556](https://github.com/linuxmint/cinnamon-spices-applets/issues/3556)

* Fixes [#3554](https://github.com/linuxmint/cinnamon-spices-applets/issues/3554)

* Fixes [#3567](https://github.com/linuxmint/cinnamon-spices-applets/issues/3567)

## 3.0.2

* Fix icons for Met Norway, some are missing

* Fixes [#3507](https://github.com/linuxmint/cinnamon-spices-applets/issues/3507) - Reorganize settings, Add help text where it belongs, to the tooltips

* Add Danish Meteorologist Institute as a Weather Provider

* Fixes [#3538](https://github.com/linuxmint/cinnamon-spices-applets/issues/3538) - Make sure French days are capitalized and Use Locale formatting for percent (humidity)

## 3.0.1

* Fix issue where Symbolic icons setting was not reflected in the app when changed

* Fix [#3486](https://github.com/linuxmint/cinnamon-spices-applets/issues/3486), now wind icons point to the right direction

* Fix wind icon color when non-symbolic icons used in the applet

* Fix [#3488](https://github.com/linuxmint/cinnamon-spices-applets/issues/3488), add Climacell V4 as a new provider because Climacell v3 is deprecated and doesn't accept new sign-ups.

* Make network and DNS related errors soft errors again

## 3.0.0

* Deprecating 3.0 in favor of refactoring 3.8 codebase to use in-build module resolution in TS
* Fix issue in 3.0 where locations were not deleted from locationstore
* Inline icons now respect the current font size
* Buttons should remain highlighted after clicked as long as the cursor is still in their area
* Change location storage to config based instead of file based
* Add Visual Crossing as an API choice
* Allow saving automatic locations
* Saved locations will be prioritized based on the search entry when getting locations for refresh
* Wind directions are now represented by icons

## 2.7.0

* Fix [#3334](https://github.com/linuxmint/cinnamon-spices-applets/issues/3334), Add missing Weather conditions localization for Yahoo
* Add Automatic options for units (based on locale)
* Improve logic to guess if a theme is light or dark
* Fix [#3421](https://github.com/linuxmint/cinnamon-spices-applets/issues/3421) IO related exceptions and improve IO code to be more async.
* Add option to show dates next to forecast days [#3364](https://github.com/linuxmint/cinnamon-spices-applets/issues/3364)
* Switch to a different function to be able to handle errors calling commands
* Add option to short display Hourly weather times
* Minor refactor
* Fix typos
* OpenWeatherMap now shows Feels Like temperature instead of Cloudiness

## 2.6.9

* Fix issue where Nominatim OpenStreetMap search broke on the next refresh cycle after it was entered. (Nominatim can't find the correct address based on their display name what they provide anymore...)
* Change Main Applet icon, for worse or better
* Add some extra debug output

## 2.6.8

* 1.8+ Applet version removed

* Fixes [#3102](https://github.com/linuxmint/cinnamon-spices-applets/issues/3102)

* Hourly Weather items are stretched to make sure summary and precipitation displays properly

## 2.6.7

* Fixes [#3257](https://github.com/linuxmint/cinnamon-spices-applets/issues/3257)

## 2.6.6

* Fixes [#3238](https://github.com/linuxmint/cinnamon-spices-applets/issues/3238)
* Adds precipitation chance for OpenWeatherMap hourly weather

## 2.6.5

* Add basic Location store, now it's easier to switch between manual locations
* Fix WeatherBit Provider as it was completely broken before
* Some styling improvement for observation summary section in the applet
* Help Tab is reorganized and refilled with different info

## 2.6.4

* Fix typos in throughout applet

## 2.6.3

* Add Met Office UK as a weather provider
* Add US National Weather Service as a weather provider
* Add support for entering manual location as an address
* During and after entering a location, the applet waits 3 seconds until user finishes typing then refreshes (prevents spamming)
* Applet locks itself during a refresh pass, any input during this period will trigger another refresh **after** the previous one finished
* Some of the custom icons were resized (to be bigger) to fit in panel and applet better
* 3.8 Settings is using tabbed layout, added help section with explanation for providers and entering manual location
* Add button for version 3.8 settings to submit issue
* Fixes issue where gray text is hard to read on light theme (grey text is changed to darker color in light themes)
* Distance unit is added to the settings, metric or imperial, precipitation, visibility and site distance uses it.
* Status bar shows observation site distance for site-based providers (Met Office UK and US National Weather Service)
* Improve handling API specific errors what need to be shown in UI (incorrect API key and such)

Fixes:

* Making sure calls and idle calls time out after 10 seconds so they don't lock the applet forever (hopefully fixes [#2874](https://github.com/linuxmint/cinnamon-spices-applets/issues/2874) as well)
* Fix issue when the applet would break if the locale is set to C

## 2.6.2

* Fixes [#3081](https://github.com/linuxmint/cinnamon-spices-applets/issues/3081)
* Add Climacell as an API choice
* Fix nighttime calculation
* Fix some icon choices for weather conditions

## 2.6.1

* Fix [#3059](https://github.com/linuxmint/cinnamon-spices-applets/issues/3059)

## 2.6.0

* Add Hourly forecast support

* Add bottom bar with credit for the provider in use (with toggle for Hourly forecast) due to legal reasons with OpenWeatherMap and DarkSky

* Custom icons changed to fit their bounding boxes

* Make Daily forecasts tile-able

* Fix [#2892](https://github.com/linuxmint/cinnamon-spices-applets/issues/2892), buttons adhere to current theme

## 2.5.0

* Fixes [#2980](https://github.com/linuxmint/cinnamon-spices-applets/issues/2980) and [#2979](https://github.com/linuxmint/cinnamon-spices-applets/issues/2979)
* Hopefully Fixes [#2977](https://github.com/linuxmint/cinnamon-spices-applets/issues/2977) in most cases. You can never know with JSs flimsy timezone support.

## 2.4.9

* Fixes [#2970](https://github.com/linuxmint/cinnamon-spices-applets/issues/2970)

## 2.4.8

* Update Openweathermap to their unified API call
* Add information on DarkSky acquisition to Readme
* Fix translation issues in files other than applet.js
* Add Yahoo Weather to the available services
* Fix issue when system time is changed backwards, the applet stops updating until time gets to the time previously set
* Change 'Updated' to 'As of' to have a clearer meaning.

## 2.4.7

* Fixes [#2929](https://github.com/linuxmint/cinnamon-spices-applets/issues/2929)
* Fix styling issues with forecasts box - There wasn't enough margin on the bottom when the icon's height were bigger than the text, neither when the forecasts were wider than the current weather box.

## 2.4.6

* Fixes [#2907](https://github.com/linuxmint/cinnamon-spices-applets/issues/2907)
* Update Hungarian translation

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
* Add ability to override applet label with injecting values (customize and fit text on horizontal and vertical panels as well)

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

* Fixed Issues with Debian, now polyfilled Promises when needed
* Reworked on how to import from other files, now in line with other applets
* Utility functions moved to other file.
* Typescript declarations reorganized now they make a little bit more sense *(generated declarations from gir files still don't work that well, although mostly working)*
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
* Forcing main loop to refresh when Weather update fails (it was not
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
