"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherApplet = void 0;
const climacell_1 = require("./climacell");
const config_1 = require("./config");
const locationstore_1 = require("./locationstore");
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
const services_1 = require("./services");
const { TextIconApplet, AllowedLayout, MenuItem } = imports.ui.applet;
const { Message, Session, ProxyResolverDefault, SessionAsync } = imports.gi.Soup;
const { get_language_names } = imports.gi.GLib;
const { messageTray } = imports.ui.main;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const { spawnCommandLine, spawnCommandLineAsyncIO } = imports.misc.util;
const { IconType } = imports.gi.St;
const keybindingManager = imports.ui.main.keybindingManager;
const UUID = "weather@mockturtl";
const APPLET_ICON = "view-refresh-symbolic";
const REFRESH_ICON = "view-refresh";
const DATA_SERVICE = {
    OPEN_WEATHER_MAP: "OpenWeatherMap",
    DARK_SKY: "DarkSky",
    MET_NORWAY: "MetNorway",
    WEATHERBIT: "Weatherbit",
    YAHOO: "Yahoo",
    CLIMACELL: "Climacell",
    MET_UK: "Met Office UK",
    US_WEATHER: "US Weather"
};
class WeatherApplet extends TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.weather = null;
        this._httpSession = new SessionAsync();
        this.appletDir = imports.ui.appletManager.appletMeta[UUID].path;
        this.currentLocale = null;
        this.lock = false;
        this.refreshTriggeredWhileLocked = false;
        this.geoLocationService = new nominatim_1.GeoLocation(this);
        this.locationStore = null;
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
        this.currentLocale = utils_1.constructJsLocale(get_language_names()[0]);
        services_1.Logger.Debug("Applet created with instanceID " + instanceId);
        services_1.Logger.Debug("System locale is " + this.currentLocale);
        services_1.Logger.Debug("Appletdir is: " + this.appletDir);
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0";
        this._httpSession.timeout = 10;
        this._httpSession.idle_timeout = 10;
        imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
        this.msgSource = new SystemNotificationSource(utils_1._("Weather Applet"));
        messageTray.add(this.msgSource);
        Session.prototype.add_feature.call(this._httpSession, new ProxyResolverDefault());
        imports.gi.Gtk.IconTheme.get_default().append_search_path(this.appletDir + "/../icons");
        this.SetAppletOnPanel();
        this.config = new config_1.Config(this, instanceId, this.currentLocale);
        this.AddRefreshButton();
        this.EnsureProvider();
        this.ui = new ui_1.UI(this, orientation);
        this.ui.rebuild(this.config);
        this.loop = new loop_1.WeatherLoop(this, instanceId);
        GLib.getenv('XDG_CONFIG_HOME');
        this.locationStore = new locationstore_1.LocationStore(this, Lang.bind(this, this.onLocationStorageChanged));
        this.orientation = orientation;
        try {
            this.setAllowedLayout(AllowedLayout.BOTH);
        }
        catch (e) {
        }
        this.loop.Start();
    }
    SetAppletOnPanel() {
        this.set_applet_icon_name(APPLET_ICON);
        this.set_applet_label(utils_1._("..."));
        this.set_applet_tooltip(utils_1._("Click to open"));
    }
    Locked() {
        return this.lock;
    }
    Unlock() {
        this.lock = false;
        if (this.refreshTriggeredWhileLocked) {
            services_1.Logger.Print("Refreshing triggered by config change while refreshing, starting now...");
            this.refreshTriggeredWhileLocked = false;
            this.refreshAndRebuild();
        }
    }
    AddRefreshButton() {
        let itemLabel = utils_1._("Refresh");
        let refreshMenuItem = new MenuItem(itemLabel, REFRESH_ICON, Lang.bind(this, function () {
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
    async LoadJsonAsync(query, errorCallback, triggerUIError = true) {
        let json = await new Promise((resolve, reject) => {
            let message = Message.new('GET', query);
            services_1.Logger.Debug("URL called: " + query);
            this._httpSession.queue_message(message, (session, message) => {
                let error = (errorCallback != null) ? errorCallback(message) : null;
                if (error != null) {
                    services_1.Logger.Error("there is an error, " + JSON.stringify(error, null, 2));
                    this.HandleError(error);
                    reject({ code: -1, message: "bad api response", data: null, reason_phrase: "" });
                    return;
                }
                if (!message) {
                    reject({ code: 0, message: "no network response", reason_phrase: "no network response", data: utils_1.get(["response_body", "data"], message) });
                    return;
                }
                if (message.status_code >= 400 && message.status_code < 500) {
                    reject({ code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase, data: utils_1.get(["response_body", "data"], message) });
                    if (triggerUIError == true)
                        this.HandleError({ detail: "bad api response", type: "hard", message: utils_1._("API returned status code between 400 and 500") });
                    return;
                }
                if (message.status_code > 300 || message.status_code < 200) {
                    reject({ code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase, data: utils_1.get(["response_body", "data"], message) });
                    return;
                }
                if (utils_1.get(["response_body", "data"], message) == null) {
                    reject({ code: message.status_code, message: "no response data", reason_phrase: message.reason_phrase, data: utils_1.get(["response_body", "data"], message) });
                    return;
                }
                try {
                    services_1.Logger.Debug2("API full response: " + message.response_body.data.toString());
                    let payload = JSON.parse(message.response_body.data);
                    resolve(payload);
                }
                catch (e) {
                    services_1.Logger.Error("Error: API response is not JSON. The response: " + message.response_body.data);
                    reject({ code: message.status_code, message: "bad api response - non json", reason_phrase: e });
                }
            });
        });
        return json;
    }
    ;
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
            services_1.Logger.Error("Error calling command " + cmd + ", error: ");
            global.log(e);
            return null;
        }
    }
    async LoadAsync(query) {
        let data = await new Promise((resolve, reject) => {
            let message = Message.new('GET', query);
            this._httpSession.queue_message(message, (session, message) => {
                if (!message) {
                    reject({ code: 0, message: "no network response", reason_phrase: "no network response" });
                    return;
                }
                if (message.status_code > 300 || message.status_code < 200) {
                    reject({ code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase });
                    return;
                }
                if (!message.response_body) {
                    reject({ code: message.status_code, message: "no response body", reason_phrase: message.reason_phrase });
                    return;
                }
                if (!message.response_body.data) {
                    reject({ code: message.status_code, message: "no response data", reason_phrase: message.reason_phrase });
                    return;
                }
                services_1.Logger.Debug2("API full response: " + message.response_body.data.toString());
                let payload = message.response_body.data;
                resolve(payload);
            });
        });
        return data;
    }
    ;
    sendNotification(title, message, transient) {
        let notification = new Notification(this.msgSource, utils_1._("Weather Applet") + ": " + title, message);
        if (transient)
            notification.setTransient((!transient) ? false : true);
        this.msgSource.notify(notification);
    }
    SetAppletTooltip(msg) {
        this.set_applet_tooltip(msg);
    }
    SetAppletIcon(iconName, customIcon) {
        this.config.IconType() == IconType.SYMBOLIC ?
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
        if (this.config.currentLocation.locationSource == "ip-api") {
            this.sendNotification(utils_1._("Error") + " - " + utils_1._("Location Store"), utils_1._("You can't save a location obtained automatically, sorry"));
        }
        this.locationStore.SaveCurrentLocation(this.config.currentLocation);
    }
    async deleteCurrentLocation() {
        this.locationStore.DeleteCurrentLocation(this.config.currentLocation);
    }
    onLocationStorageChanged(itemCount) {
        services_1.Logger.Debug("On location storage callback called, number of locations now " + itemCount.toString());
        if (this.locationStore.ShouldShowLocationSelectors(this.config.currentLocation))
            this.ui.ShowLocationSelectors();
        else
            this.ui.HideLocationSelectors();
    }
    NextLocationClicked() {
        let nextLoc = this.locationStore.NextLocation(this.config.currentLocation);
        if (nextLoc == null)
            return;
        this.refreshAndRebuild(nextLoc);
    }
    PreviousLocationClicked() {
        let previousLoc = this.locationStore.PreviousLocation(this.config.currentLocation);
        if (previousLoc == null)
            return;
        this.refreshAndRebuild(previousLoc);
    }
    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this.refreshWeather(true);
    }
    ;
    _onKeySettingsUpdated() {
        if (this.config.keybinding != null) {
            keybindingManager.addHotKey(UUID, this.config.keybinding, Lang.bind(this, this.on_applet_clicked));
        }
    }
    on_applet_removed_from_panel(deleteConfig) {
        services_1.Logger.Print("Removing applet instance...");
        this.loop.Stop();
    }
    on_applet_clicked(event) {
        this.ui.menu.toggle();
    }
    on_applet_middle_clicked(event) {
    }
    on_panel_height_changed() {
    }
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
    EnsureProvider(force = false) {
        let currentName = utils_1.get(["name"], this.provider);
        switch (this.config._dataService) {
            case DATA_SERVICE.DARK_SKY:
                if (currentName != "DarkSky" || force)
                    this.provider = new darkSky_1.DarkSky(this);
                break;
            case DATA_SERVICE.OPEN_WEATHER_MAP:
                if (currentName != "OpenWeatherMap" || force)
                    this.provider = new openWeatherMap_1.OpenWeatherMap(this);
                break;
            case DATA_SERVICE.MET_NORWAY:
                if (currentName != "MetNorway" || force)
                    this.provider = new met_norway_1.MetNorway(this);
                break;
            case DATA_SERVICE.WEATHERBIT:
                if (currentName != "Weatherbit" || force)
                    this.provider = new weatherbit_1.Weatherbit(this);
                break;
            case DATA_SERVICE.YAHOO:
                if (currentName != "Yahoo" || force)
                    this.provider = new yahoo_1.Yahoo(this);
                break;
            case DATA_SERVICE.CLIMACELL:
                if (currentName != "Climacell" || force)
                    this.provider = new climacell_1.Climacell(this);
                break;
            case DATA_SERVICE.MET_UK:
                if (currentName != "Met Office UK" || force)
                    this.provider = new met_uk_1.MetUk(this);
                break;
            case DATA_SERVICE.US_WEATHER:
                if (currentName != "US Weather" || force)
                    this.provider = new us_weather_1.USWeather(this);
                break;
            default:
                return null;
        }
    }
    async refreshWeather(rebuild, location) {
        if (this.lock) {
            services_1.Logger.Print("Refreshing in progress, refresh skipped.");
            return "locked";
        }
        this.lock = true;
        this.encounteredError = false;
        let locationData = null;
        if (location == null) {
            try {
                locationData = await this.config.EnsureLocation();
            }
            catch (e) {
                services_1.Logger.Error(e);
                this.Unlock();
                return "error";
            }
        }
        else {
            locationData = location;
            this.config.InjectLocationToConfig(location, true);
        }
        if (locationData == null) {
            this.Unlock();
            return "failure";
        }
        try {
            this.EnsureProvider();
            this.weather = null;
            let weatherInfo = await this.provider.GetWeather({ lat: locationData.lat, lon: locationData.lon, text: locationData.lat.toString() + "," + locationData.lon.toString() });
            if (weatherInfo == null) {
                services_1.Logger.Error("Unable to obtain Weather Information");
                this.HandleError({
                    type: "hard",
                    detail: "unknown",
                    message: utils_1._("Could not get weather information"),
                });
                this.Unlock();
                return "failure";
            }
            weatherInfo = this.FillInWeatherData(weatherInfo, locationData);
            this.weather = weatherInfo;
            if (rebuild)
                this.ui.rebuild(this.config);
            if (!this.ui.displayWeather(weatherInfo, this.config)
                || !this.ui.displayForecast(weatherInfo, this.config)
                || !this.ui.displayHourlyForecast(weatherInfo.hourlyForecasts, this.config, weatherInfo.location.timeZone)
                || !this.ui.displayBar(weatherInfo, this.provider, this.config)) {
                this.Unlock();
                return "failure";
            }
            services_1.Logger.Print("Weather Information refreshed");
            this.loop.ResetErrorCount();
            this.Unlock();
            return "success";
        }
        catch (e) {
            services_1.Logger.Error("Generic Error while refreshing Weather info: " + e);
            this.HandleError({ type: "hard", detail: "unknown", message: utils_1._("Unexpected Error While Refreshing Weather, please see log in Looking Glass") });
            this.Unlock();
            return "failure";
        }
    }
    ;
    FillInWeatherData(weatherInfo, locationData) {
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
    HandleError(error) {
        if (error == null)
            return;
        if (this.encounteredError == true)
            return;
        this.encounteredError = true;
        services_1.Logger.Debug("User facing Error received, error: " + JSON.stringify(error, null, 2));
        if (error.type == "hard") {
            services_1.Logger.Debug("Displaying hard error");
            this.ui.rebuild(this.config);
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
        services_1.Logger.Error("Retrying in the next " + nextRefresh.toString() + " seconds...");
    }
    HandleHTTPError(service, error, ctx, override) {
        let uiError = {
            type: "soft",
            detail: "unknown",
            message: utils_1._("Network Error, please check logs in Looking Glass"),
            service: service
        };
        if (typeof error === 'string' || error instanceof String) {
            services_1.Logger.Error("Error calling " + service + ": " + error.toString());
        }
        else {
            services_1.Logger.Error("Error calling " + service + " '" + error.message.toString() + "' Reason: " + error.reason_phrase.toString());
            uiError.detail = error.message;
            uiError.code = error.code;
            if (error.message == "bad api response - non json")
                uiError.type = "hard";
            if (!!override && override instanceof Function) {
                uiError = override(error, uiError);
            }
        }
        ctx.HandleError(uiError);
    }
}
exports.WeatherApplet = WeatherApplet;
