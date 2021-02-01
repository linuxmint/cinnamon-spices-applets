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
const openWeatherMap_1 = require("./openWeatherMap");
const us_weather_1 = require("./us_weather");
const weatherbit_1 = require("./weatherbit");
const yahoo_1 = require("./yahoo");
const met_norway_1 = require("./met_norway");
const httpLib_1 = require("./httpLib");
const logger_1 = require("./logger");
const consts_1 = require("./consts");
const visualcrossing_1 = require("./visualcrossing");
const climacellV4_1 = require("./climacellV4");
const { TextIconApplet, AllowedLayout, MenuItem } = imports.ui.applet;
const { spawnCommandLine } = imports.misc.util;
const { IconType, Side } = imports.gi.St;
class WeatherApplet extends TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.lock = false;
        this.refreshTriggeredWhileLocked = false;
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
        this.AppletDir = metadata.path;
        logger_1.Log.Instance.Debug("Applet created with instanceID " + instanceId);
        logger_1.Log.Instance.Debug("AppletDir is: " + this.AppletDir);
        this.SetAppletOnPanel();
        this.config = new config_1.Config(this, instanceId);
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
    get Orientation() {
        return this.orientation;
    }
    Locked() {
        return this.lock;
    }
    RefreshAndRebuild(loc) {
        this.loop.Resume();
        if (this.Locked()) {
            this.refreshTriggeredWhileLocked = true;
            return;
        }
        this.RefreshWeather(true, loc);
    }
    ;
    async RefreshWeather(rebuild, location) {
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
            this.EnsureProvider();
            if (this.provider.needsApiKey && this.config.NoApiKey()) {
                logger_1.Log.Instance.Error("No API Key given");
                this.ShowError({
                    type: "hard",
                    userError: true,
                    detail: "no key",
                    message: utils_1._("This provider requires an API key to operate")
                });
                return null;
            }
            let weatherInfo = await this.provider.GetWeather(location);
            if (weatherInfo == null) {
                this.Unlock();
                return "fail";
            }
            weatherInfo = this.MergeWeatherData(weatherInfo, location);
            if (rebuild)
                this.ui.Rebuild(this.config);
            if (!this.ui.Display(weatherInfo, this.config, this.provider) ||
                !this.DisplayWeather(weatherInfo)) {
                this.Unlock();
                return "fail";
            }
            logger_1.Log.Instance.Print("Weather Information refreshed");
            this.loop.ResetErrorCount();
            this.Unlock();
            return "success";
        }
        catch (e) {
            logger_1.Log.Instance.Error("Generic Error while refreshing Weather info: " + e + ", ");
            this.ShowError({ type: "hard", detail: "unknown", message: utils_1._("Unexpected Error While Refreshing Weather, please see log in Looking Glass") });
            this.Unlock();
            return "fail";
        }
    }
    ;
    DisplayWeather(weather) {
        let location = utils_1.GenerateLocationText(weather, this.config);
        let lastUpdatedTime = utils_1.AwareDateString(weather.date, this.config.currentLocale, this.config._show24Hours);
        this.SetAppletTooltip(`${location} - ${utils_1._("As of {lastUpdatedTime}", { "lastUpdatedTime": lastUpdatedTime })}`);
        this.DisplayWeatherOnLabel(weather.temperature, weather.condition.description);
        this.SetAppletIcon(weather.condition.icons, weather.condition.customIcon);
        return true;
    }
    DisplayWeatherOnLabel(temperature, mainCondition) {
        mainCondition = utils_1.CapitalizeEveryLetter(mainCondition);
        let temp = utils_1.TempToUserConfig(temperature, this.config.TemperatureUnit, this.config._tempRussianStyle);
        let label = "";
        if (this.Orientation != Side.LEFT && this.Orientation != Side.RIGHT) {
            if (this.config._showCommentInPanel) {
                label += mainCondition;
            }
            if (this.config._showTextInPanel) {
                if (label != "") {
                    label += " ";
                }
                label += (temp + ' ' + utils_1.UnitToUnicode(this.config.TemperatureUnit));
            }
        }
        else {
            if (this.config._showTextInPanel) {
                label = temp;
                if (this.GetPanelHeight() >= 35) {
                    label += utils_1.UnitToUnicode(this.config.TemperatureUnit);
                }
            }
        }
        if (utils_1.NotEmpty(this.config._tempTextOverride)) {
            label = this.config._tempTextOverride
                .replace("{t}", temp)
                .replace("{u}", utils_1.UnitToUnicode(this.config.TemperatureUnit))
                .replace("{c}", mainCondition);
        }
        this.SetAppletLabel(label);
    }
    SetAppletTooltip(msg) {
        this.set_applet_tooltip(msg);
    }
    SetAppletIcon(iconNames, customIcon) {
        if (this.config._useCustomAppletIcons) {
            this.SetCustomIcon(customIcon);
        }
        else {
            let icon = utils_1.WeatherIconSafely(iconNames, this.config.AppletIconType);
            this.config.AppletIconType == IconType.SYMBOLIC ?
                this.set_applet_icon_symbolic_name(icon) :
                this.set_applet_icon_name(icon);
        }
    }
    SetAppletLabel(label) {
        this.set_applet_label(label);
    }
    GetPanelHeight() {
        return this.panel._getScaledPanelHeight();
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
    async locationLookup() {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
    }
    async submitIssue() {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://github.com/linuxmint/cinnamon-spices-applets/issues/new");
    }
    async saveCurrentLocation() {
        this.config.LocStore.SaveCurrentLocation(this.config.CurrentLocation);
    }
    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this.RefreshWeather(true);
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
    SetAppletOnPanel() {
        this.set_applet_icon_name(consts_1.APPLET_ICON);
        this.set_applet_label(utils_1._("..."));
        this.set_applet_tooltip(utils_1._("Click to open"));
    }
    Unlock() {
        this.lock = false;
        if (this.refreshTriggeredWhileLocked) {
            logger_1.Log.Instance.Print("Refreshing triggered by config change while refreshing, starting now...");
            this.refreshTriggeredWhileLocked = false;
            this.RefreshAndRebuild();
        }
    }
    AddRefreshButton() {
        let itemLabel = utils_1._("Refresh");
        let refreshMenuItem = new MenuItem(itemLabel, consts_1.REFRESH_ICON, () => this.RefreshAndRebuild());
        this._applet_context_menu.addMenuItem(refreshMenuItem);
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
    SetCustomIcon(iconName) {
        this.set_applet_icon_symbolic_name(iconName);
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
            case "ClimacellV4":
                if (currentName != "ClimacellV4" || force)
                    this.provider = new climacellV4_1.ClimacellV4(this);
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
            case "Visual Crossing":
                if (currentName != "Visual Crossing" || force)
                    this.provider = new visualcrossing_1.VisualCrossing(this);
                break;
            default:
                return null;
        }
    }
    MergeWeatherData(weatherInfo, locationData) {
        if (weatherInfo.location.city == null)
            weatherInfo.location.city = locationData.city;
        if (weatherInfo.location.country == null)
            weatherInfo.location.country = locationData.country;
        if (weatherInfo.location.timeZone == null)
            weatherInfo.location.timeZone = locationData.timeZone;
        if (weatherInfo.coord.lat == null)
            weatherInfo.coord.lat = locationData.lat;
        if (weatherInfo.coord.lon == null)
            weatherInfo.coord.lon = locationData.lon;
        if (weatherInfo.hourlyForecasts == null)
            weatherInfo.hourlyForecasts = [];
        weatherInfo.condition.main = utils_1.ProcessCondition(weatherInfo.condition.main, this.config._translateCondition);
        weatherInfo.condition.description = utils_1.ProcessCondition(weatherInfo.condition.description, this.config._translateCondition);
        for (let index = 0; index < weatherInfo.forecasts.length; index++) {
            const condition = weatherInfo.forecasts[index].condition;
            condition.main = utils_1.ProcessCondition(condition.main, this.config._translateCondition);
            condition.description = utils_1.ProcessCondition(condition.description, this.config._translateCondition);
        }
        for (let index = 0; index < weatherInfo.hourlyForecasts.length; index++) {
            const condition = weatherInfo.hourlyForecasts[index].condition;
            condition.main = utils_1.ProcessCondition(condition.main, this.config._translateCondition);
            condition.description = utils_1.ProcessCondition(condition.description, this.config._translateCondition);
        }
        return weatherInfo;
    }
    DisplayHardError(title, msg) {
        this.set_applet_label(title);
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this.ui.DisplayErrorMessage(msg, "hard");
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
            this.DisplayHardError(this.errMsg[error.detail], (!error.message) ? "" : error.message);
        }
        if (error.type == "soft") {
            if (this.loop.IsDataTooOld()) {
                this.set_applet_tooltip("Click to open");
                this.set_applet_icon_name("weather-severe-alert");
                this.ui.DisplayErrorMessage(utils_1._("Could not update weather for a while...\nare you connected to the internet?"), "soft");
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
