"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherApplet = void 0;
const climacell_1 = require("./climacell");
const config_1 = require("./config");
const loop_1 = require("./loop");
const met_uk_1 = require("./met_uk");
const ui_1 = require("./ui");
const utils_1 = require("./utils");
const darkSky_1 = require("./darkSky");
const nominatim_1 = require("./nominatim");
const openWeatherMap_1 = require("./openWeatherMap");
const us_weather_1 = require("./us_weather");
const weatherbit_1 = require("./weatherbit");
const yahoo_1 = require("./yahoo");
const met_norway_1 = require("./met_norway");
const httpLib_1 = require("./httpLib");
const logger_1 = require("./logger");
const consts_1 = require("./consts");
const notification_service_1 = require("./notification_service");
const { TextIconApplet, AllowedLayout, MenuItem } = imports.ui.applet;
const { get_language_names } = imports.gi.GLib;
const Lang = imports.lang;
const { spawnCommandLine, spawnCommandLineAsyncIO } = imports.misc.util;
const { IconType } = imports.gi.St;
class WeatherApplet extends TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.currentLocale = null;
        this.lock = false;
        this.refreshTriggeredWhileLocked = false;
        this.geoLocationService = new nominatim_1.GeoLocation(this);
        this.encounteredError = false;
        this.errMsg = {
            unknown: utils_1._("Error"),
            "bad api response - non json": utils_1._("Service Error"),
            "bad key": utils_1._("Incorrect API Key"),
            "bad api response": utils_1._("Service Error"),
            "bad location format": utils_1._("Incorrect Location Format"),
            "bad status code": utils_1._("Service Error"),
            "key blocked": utils_1._("Key Blocked"),
            "location not found": utils_1._("Can't find location"),
            "no api response": utils_1._("Service Error"),
            "no key": utils_1._("No Api Key"),
            "no location": utils_1._("No Location"),
            "no network response": utils_1._("Service Error"),
            "no response body": utils_1._("Service Error"),
            "no response data": utils_1._("Service Error"),
            "unusual payload": utils_1._("Service Error"),
            "import error": utils_1._("Missing Packages"),
            "location not covered": utils_1._("Location not covered"),
        };
        this.appletDir = metadata.path;
        this.currentLocale = utils_1.constructJsLocale(get_language_names()[0]);
        logger_1.Log.Instance.Debug("Applet created with instanceID " + instanceId);
        logger_1.Log.Instance.Debug("System locale is " + this.currentLocale);
        logger_1.Log.Instance.Debug("AppletDir is: " + this.appletDir);
        imports.gettext.bindtextdomain(consts_1.UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
        imports.gi.Gtk.IconTheme.get_default().append_search_path(this.appletDir + "/../icons");
        this.SetAppletOnPanel();
        this.config = new config_1.Config(this, instanceId, this.currentLocale);
        this.AddRefreshButton();
        this.EnsureProvider();
        this.ui = new ui_1.UI(this, orientation);
        this.ui.Rebuild(this.config);
        this.loop = new loop_1.WeatherLoop(this, instanceId);
        this.orientation = orientation;
        try {
            this.setAllowedLayout(AllowedLayout.BOTH);
        }
        catch (e) {
        }
        this.loop.Start();
    }
    SetAppletOnPanel() {
        this.set_applet_icon_name(consts_1.APPLET_ICON);
        this.set_applet_label(utils_1._("..."));
        this.set_applet_tooltip(utils_1._("Click to open"));
    }
    Locked() {
        return this.lock;
    }
    Unlock() {
        this.lock = false;
        if (this.refreshTriggeredWhileLocked) {
            logger_1.Log.Instance.Print("Refreshing triggered by config change while refreshing, starting now...");
            this.refreshTriggeredWhileLocked = false;
            this.refreshAndRebuild();
        }
    }
    AddRefreshButton() {
        let itemLabel = utils_1._("Refresh");
        let refreshMenuItem = new MenuItem(itemLabel, consts_1.REFRESH_ICON, Lang.bind(this, function () {
            this.refreshAndRebuild();
        }));
        this._applet_context_menu.addMenuItem(refreshMenuItem);
    }
    refreshAndRebuild(loc) {
        this.loop.Resume();
        if (this.Locked()) {
            this.refreshTriggeredWhileLocked = true;
            return;
        }
        this.refreshWeather(true, loc);
    }
    ;
    async LoadJsonAsync(url, params, HandleError, method = "GET") {
        let response = await httpLib_1.HttpLib.Instance.LoadJsonAsync(url, params, method);
        if (!response.Success) {
            if (!!HandleError && !HandleError(response.ErrorData))
                return null;
            else {
                this.HandleHTTPError(response.ErrorData);
                return null;
            }
        }
        return response.Data;
    }
    HandleHTTPError(error) {
        let appletError = {
            detail: error.message,
            userError: false,
            code: error.code,
            message: this.errMsg[error.message],
            type: "soft"
        };
        switch (error.message) {
            case "bad status code":
            case "unknown":
                appletError.type = "hard";
        }
        this.ShowError(appletError);
    }
    async SpawnProcess(command) {
        let cmd = "";
        for (let index = 0; index < command.length; index++) {
            const element = command[index];
            cmd += "'" + element + "' ";
        }
        try {
            let json = await new Promise((resolve, reject) => {
                spawnCommandLineAsyncIO(cmd, (aStdout, err, exitCode) => {
                    if (exitCode != 0) {
                        reject(err);
                    }
                    else {
                        resolve(aStdout);
                    }
                });
            });
            return json;
        }
        catch (e) {
            logger_1.Log.Instance.Error("Error calling command " + cmd + ", error: ");
            global.log(e);
            return null;
        }
    }
    SetAppletTooltip(msg) {
        this.set_applet_tooltip(msg);
    }
    SetAppletIcon(iconName, customIcon) {
        this.config.IconType == IconType.SYMBOLIC ?
            this.set_applet_icon_symbolic_name(iconName) :
            this.set_applet_icon_name(iconName);
        if (this.config._useCustomAppletIcons)
            this.SetCustomIcon(customIcon);
    }
    SetCustomIcon(iconName) {
        this.set_applet_icon_symbolic_name(iconName);
    }
    SetAppletLabel(label) {
        this.set_applet_label(label);
    }
    GetPanelHeight() {
        return this.panel._getScaledPanelHeight();
    }
    async locationLookup() {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
    }
    async submitIssue() {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://github.com/linuxmint/cinnamon-spices-applets/issues/new");
    }
    async saveCurrentLocation() {
        if (this.config.CurrentLocation.locationSource == "ip-api") {
            notification_service_1.NotificationService.Instance.Send(utils_1._("Error") + " - " + utils_1._("Location Store"), utils_1._("You can't save a location obtained automatically, sorry"));
        }
        this.config.locationStore.SaveCurrentLocation(this.config.CurrentLocation);
    }
    async deleteCurrentLocation() {
        this.config.locationStore.DeleteCurrentLocation(this.config.CurrentLocation);
    }
    NextLocationClicked() {
        let nextLoc = this.config.locationStore.NextLocation(this.config.CurrentLocation);
        if (nextLoc == null)
            return;
        this.refreshAndRebuild(nextLoc);
    }
    PreviousLocationClicked() {
        let previousLoc = this.config.locationStore.PreviousLocation(this.config.CurrentLocation);
        if (previousLoc == null)
            return;
        this.refreshAndRebuild(previousLoc);
    }
    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this.refreshWeather(true);
    }
    ;
    on_applet_removed_from_panel(deleteConfig) {
        logger_1.Log.Instance.Print("Removing applet instance...");
        this.loop.Stop();
    }
    on_applet_clicked(event) {
        this.ui.Toggle();
    }
    on_applet_middle_clicked(event) {
    }
    on_panel_height_changed() {
    }
    EnsureProvider(force = false) {
        var _a;
        let currentName = (_a = this.provider) === null || _a === void 0 ? void 0 : _a.name;
        switch (this.config._dataService) {
            case "DarkSky":
                if (currentName != "DarkSky" || force)
                    this.provider = new darkSky_1.DarkSky(this);
                break;
            case "OpenWeatherMap":
                if (currentName != "OpenWeatherMap" || force)
                    this.provider = new openWeatherMap_1.OpenWeatherMap(this);
                break;
            case "MetNorway":
                if (currentName != "MetNorway" || force)
                    this.provider = new met_norway_1.MetNorway(this);
                break;
            case "Weatherbit":
                if (currentName != "Weatherbit" || force)
                    this.provider = new weatherbit_1.Weatherbit(this);
                break;
            case "Yahoo":
                if (currentName != "Yahoo" || force)
                    this.provider = new yahoo_1.Yahoo(this);
                break;
            case "Climacell":
                if (currentName != "Climacell" || force)
                    this.provider = new climacell_1.Climacell(this);
                break;
            case "Met Office UK":
                if (currentName != "Met Office UK" || force)
                    this.provider = new met_uk_1.MetUk(this);
                break;
            case "US Weather":
                if (currentName != "US Weather" || force)
                    this.provider = new us_weather_1.USWeather(this);
                break;
            default:
                return null;
        }
    }
    async refreshWeather(rebuild, location) {
        try {
            if (this.lock) {
                logger_1.Log.Instance.Print("Refreshing in progress, refresh skipped.");
                return "locked";
            }
            this.lock = true;
            this.encounteredError = false;
            if (!location) {
                location = await this.config.EnsureLocation();
                if (!location) {
                    this.Unlock();
                    return "error";
                }
            }
            else {
                this.config.InjectLocationToConfig(location, true);
            }
            this.EnsureProvider();
            let weatherInfo = await this.provider.GetWeather(location);
            if (weatherInfo == null) {
                this.Unlock();
                return "failure";
            }
            weatherInfo = this.MergeWeatherData(weatherInfo, location);
            if (rebuild)
                this.ui.Rebuild(this.config);
            if (!this.ui.DisplayWeather(weatherInfo, this.config)
                || !this.ui.DisplayForecast(weatherInfo, this.config)
                || !this.ui.DisplayHourlyForecast(weatherInfo.hourlyForecasts, this.config, weatherInfo.location.timeZone)
                || !this.ui.DisplayBar(weatherInfo, this.provider, this.config)) {
                this.Unlock();
                return "failure";
            }
            logger_1.Log.Instance.Print("Weather Information refreshed");
            this.loop.ResetErrorCount();
            this.Unlock();
            return "success";
        }
        catch (e) {
            logger_1.Log.Instance.Error("Generic Error while refreshing Weather info: " + e);
            this.ShowError({ type: "hard", detail: "unknown", message: utils_1._("Unexpected Error While Refreshing Weather, please see log in Looking Glass") });
            this.Unlock();
            return "failure";
        }
    }
    ;
    OpenUrl(element) {
        if (!element.url)
            return;
        imports.gi.Gio.app_info_launch_default_for_uri(element.url, global.create_app_launch_context());
    }
    GetMaxForecastDays() {
        if (!this.provider)
            return this.config._forecastDays;
        return Math.min(this.config._forecastDays, this.provider.maxForecastSupport);
    }
    GetMaxHourlyForecasts() {
        if (!this.provider)
            return this.config._forecastHours;
        return Math.min(this.config._forecastHours, this.provider.maxHourlyForecastSupport);
    }
    MergeWeatherData(weatherInfo, locationData) {
        if (!weatherInfo.location.city)
            weatherInfo.location.city = locationData.city;
        if (!weatherInfo.location.country)
            weatherInfo.location.country = locationData.country;
        if (!weatherInfo.location.timeZone)
            weatherInfo.location.timeZone = locationData.timeZone;
        if (weatherInfo.coord.lat == null)
            weatherInfo.coord.lat = locationData.lat;
        if (weatherInfo.coord.lon == null)
            weatherInfo.coord.lon = locationData.lon;
        weatherInfo.hourlyForecasts = (!weatherInfo.hourlyForecasts) ? [] : weatherInfo.hourlyForecasts;
        return weatherInfo;
    }
    DisplayError(title, msg) {
        this.set_applet_label(title);
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this.ui.DisplayErrorMessage(msg);
    }
    ;
    ShowError(error) {
        if (error == null)
            return;
        if (this.encounteredError == true)
            return;
        this.encounteredError = true;
        logger_1.Log.Instance.Debug("User facing Error received, error: " + JSON.stringify(error, null, 2));
        if (error.type == "hard") {
            logger_1.Log.Instance.Debug("Displaying hard error");
            this.ui.Rebuild(this.config);
            this.DisplayError(this.errMsg[error.detail], (!error.message) ? "" : error.message);
        }
        if (error.type == "soft") {
            if (this.loop.IsDataTooOld()) {
                this.set_applet_tooltip("Click to open");
                this.set_applet_icon_name("weather-severe-alert");
                this.ui.DisplayErrorMessage(utils_1._("Could not update weather for a while...\nare you connected to the internet?"));
            }
        }
        if (error.userError) {
            this.loop.Pause();
            return;
        }
        let nextRefresh = this.loop.GetSecondsUntilNextRefresh();
        logger_1.Log.Instance.Error("Retrying in the next " + nextRefresh.toString() + " seconds...");
    }
}
exports.WeatherApplet = WeatherApplet;
