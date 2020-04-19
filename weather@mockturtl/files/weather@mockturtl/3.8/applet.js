function importModule(path) {
    if (typeof require !== 'undefined') {
        return require('./' + path);
    }
    else {
        if (!AppletDir)
            var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
        return AppletDir[path];
    }
}
const { LinearGradient } = imports.cairo;
const Lang = imports.lang;
const keybindingManager = imports.ui.main.keybindingManager;
const { timeout_add_seconds } = imports.mainloop;
const { Message, Session, ProxyResolverDefault, SessionAsync } = imports.gi.Soup;
const { Bin, DrawingArea, BoxLayout, Side, IconType, Label, Icon, Button } = imports.gi.St;
const { get_language_names } = imports.gi.GLib;
const { TextIconApplet, AllowedLayout, AppletPopupMenu, MenuItem } = imports.ui.applet;
const { PopupMenuManager } = imports.ui.popupMenu;
const { AppletSettings, BindingDirection } = imports.ui.settings;
const { spawnCommandLine, spawn_async } = imports.misc.util;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
const { messageTray } = imports.ui.main;
var utils = importModule("utils");
var GetDayName = utils.GetDayName;
var GetHoursMinutes = utils.GetHoursMinutes;
var capitalizeFirstLetter = utils.capitalizeFirstLetter;
var TempToUserConfig = utils.TempToUserConfig;
var PressToUserUnits = utils.PressToUserUnits;
var compassDirection = utils.compassDirection;
var MPStoUserUnits = utils.MPStoUserUnits;
var nonempty = utils.nonempty;
var AwareDateString = utils.AwareDateString;
const delay = utils.delay;
if (typeof Promise != "function") {
    var promisePoly = importModule("promise-polyfill");
    var finallyConstructor = promisePoly.finallyConstructor;
    var setTimeout = promisePoly.setTimeout;
    var setTimeoutFunc = promisePoly.setTimeoutFunc;
    var isArray = promisePoly.isArray;
    var noop = promisePoly.noop;
    var bind = promisePoly.bind;
    var Promise = promisePoly.Promise;
    var handle = promisePoly.handle;
    var resolve = promisePoly.resolve;
    var reject = promisePoly.reject;
    var finale = promisePoly.finale;
    var Handler = promisePoly.Handler;
    var doResolve = promisePoly.doResolve;
    Promise.prototype['catch'] = promisePoly.Promise.prototype['catch'];
    Promise.prototype.then = promisePoly.Promise.prototype.then;
    Promise.all = promisePoly.Promise.all;
    Promise.resolve = promisePoly.Promise.resolve;
    Promise.reject = promisePoly.Promise.reject;
    Promise.race = promisePoly.Promise.race;
    var globalNS = promisePoly.globalNS;
    if (!('Promise' in globalNS)) {
        globalNS['Promise'] = Promise;
    }
    else if (!globalNS.Promise.prototype['finally']) {
        globalNS.Promise.prototype['finally'] = finallyConstructor;
    }
}
const ipApi = importModule('ipApi');
const UUID = "weather@mockturtl";
const APPLET_ICON = "view-refresh-symbolic";
const REFRESH_ICON = "view-refresh";
const CMD_SETTINGS = "cinnamon-settings applets " + UUID;
const DATA_SERVICE = {
    OPEN_WEATHER_MAP: "OpenWeatherMap",
    DARK_SKY: "DarkSky",
    MET_NORWAY: "MetNorway",
    WEATHERBIT: "Weatherbit",
    YAHOO: "Yahoo"
};
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return imports.gettext.dgettext(UUID, str);
}
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
var weatherAppletGUIDs = {};
class WeatherApplet extends TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.weather = null;
        this.forecasts = [];
        this.currentLocale = null;
        this._httpSession = new SessionAsync();
        this.appletDir = imports.ui.appletManager.appletMeta[UUID].path;
        this.locProvider = new ipApi.IpApi(this);
        this.encounteredError = false;
        this.errMsg = {
            unknown: _("Error"),
            "bad api response - non json": _("Service Error"),
            "bad key": _("Incorrect API Key"),
            "bad api response": _("Service Error"),
            "bad location format": _("Incorrect Location Format"),
            "bad status code": _("Service Error"),
            "key blocked": _("Key Blocked"),
            "location not found": _("Can't find location"),
            "no api response": _("Service Error"),
            "no key": _("No Api Key"),
            "no location": _("No Location"),
            "no network response": _("Service Error"),
            "no reponse body": _("Service Error"),
            "no respone data": _("Service Error"),
            "unusal payload": _("Service Error"),
            "import error": _("Missing Packages")
        };
        this.log = new Log(instanceId);
        this.currentLocale = this.constructJsLocale(get_language_names()[0]);
        this.log.Debug("System locale is " + this.currentLocale);
        this.log.Debug("Appletdir is: " + this.appletDir);
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0";
        this.msgSource = new SystemNotificationSource(_("Weather Applet"));
        messageTray.add(this.msgSource);
        Session.prototype.add_feature.call(this._httpSession, new ProxyResolverDefault());
        imports.gi.Gtk.IconTheme.get_default().append_search_path(this.appletDir + "/../icons");
        this.SetAppletOnPanel();
        this.config = new Config(this, instanceId);
        this.AddRefreshButton();
        this.ui = new UI(this, orientation);
        this.ui.rebuild(this.config);
        this.loop = new WeatherLoop(this, instanceId);
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
        this.set_applet_label(_("..."));
        this.set_applet_tooltip(_("Click to open"));
    }
    AddRefreshButton() {
        let itemLabel = _("Refresh");
        let refreshMenuItem = new MenuItem(itemLabel, REFRESH_ICON, Lang.bind(this, function () {
            this.refreshAndRebuild();
        }));
        this._applet_context_menu.addMenuItem(refreshMenuItem);
    }
    refreshAndRebuild() {
        this.loop.Resume();
        this.refreshWeather(true);
    }
    ;
    async LoadJsonAsync(query) {
        let json = await new Promise((resolve, reject) => {
            let message = Message.new('GET', query);
            this._httpSession.queue_message(message, (session, message) => {
                if (!message)
                    reject({ code: 0, message: "no network response", reason_phrase: "no network response" });
                if (message.status_code != 200)
                    reject({ code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase });
                if (!message.response_body)
                    reject({ code: message.status_code, message: "no reponse body", reason_phrase: message.reason_phrase });
                if (!message.response_body.data)
                    reject({ code: message.status_code, message: "no respone data", reason_phrase: message.reason_phrase });
                try {
                    this.log.Debug("API full response: " + message.response_body.data.toString());
                    let payload = JSON.parse(message.response_body.data);
                    resolve(payload);
                }
                catch (e) {
                    this.log.Error("Error: API response is not JSON. The response: " + message.response_body.data);
                    reject({ code: message.status_code, message: "bad api response - non json", reason_phrase: e });
                }
            });
        });
        return json;
    }
    ;
    async SpawnProcess(command) {
        let json = await new Promise((resolve, reject) => {
            spawn_async(command, (aStdout) => {
                resolve(aStdout);
            });
        });
        return json;
    }
    async LoadAsync(query) {
        let data = await new Promise((resolve, reject) => {
            let message = Message.new('GET', query);
            this._httpSession.queue_message(message, (session, message) => {
                if (!message)
                    reject({ code: 0, message: "no network response", reason_phrase: "no network response" });
                if (message.status_code != 200)
                    reject({ code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase });
                if (!message.response_body)
                    reject({ code: message.status_code, message: "no reponse body", reason_phrase: message.reason_phrase });
                if (!message.response_body.data)
                    reject({ code: message.status_code, message: "no respone data", reason_phrase: message.reason_phrase });
                this.log.Debug("API full response: " + message.response_body.data.toString());
                let payload = message.response_body.data;
                resolve(payload);
            });
        });
        return data;
    }
    ;
    sendNotification(title, message, transient) {
        let notification = new Notification(this.msgSource, "WeatherApplet: " + title, message);
        if (transient)
            notification.setTransient((!transient) ? false : true);
        this.msgSource.notify(notification);
    }
    SetAppletTooltip(msg) {
        this.set_applet_tooltip(msg);
    }
    SetAppletIcon(iconname) {
        this.config.IconType() == IconType.SYMBOLIC ?
            this.set_applet_icon_symbolic_name(iconname) :
            this.set_applet_icon_name(iconname);
        if (this.config._useCustomAppletIcons)
            this.SetCustomIcon(this.weather.condition.customIcon);
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
        this.log.Print("Removing applet instance...");
        this.loop.Stop();
    }
    on_applet_clicked(event) {
        this.ui.menu.toggle();
    }
    on_applet_middle_clicked(event) {
    }
    on_panel_height_changed() {
    }
    constructJsLocale(locale) {
        let jsLocale = locale.split(".")[0];
        let tmp = jsLocale.split("_");
        jsLocale = "";
        for (let i = 0; i < tmp.length; i++) {
            if (i != 0)
                jsLocale += "-";
            jsLocale += tmp[i].toLowerCase();
        }
        return jsLocale;
    }
    async refreshWeather(rebuild) {
        this.encounteredError = false;
        let locationData = null;
        try {
            locationData = await this.ValidateLocation();
        }
        catch (e) {
            this.log.Error(e);
            return "error";
        }
        try {
            switch (this.config._dataService) {
                case DATA_SERVICE.DARK_SKY:
                    if (darkSky == null)
                        var darkSky = importModule('darkSky');
                    this.provider = new darkSky.DarkSky(this);
                    break;
                case DATA_SERVICE.OPEN_WEATHER_MAP:
                    if (openWeatherMap == null)
                        var openWeatherMap = importModule("openWeatherMap");
                    this.provider = new openWeatherMap.OpenWeatherMap(this);
                    break;
                case DATA_SERVICE.MET_NORWAY:
                    if (metNorway == null)
                        var metNorway = importModule("met_norway");
                    this.provider = new metNorway.MetNorway(this);
                    break;
                case DATA_SERVICE.WEATHERBIT:
                    if (weatherbit == null)
                        var weatherbit = importModule("weatherbit");
                    this.provider = new weatherbit.Weatherbit(this);
                    break;
                case DATA_SERVICE.YAHOO:
                    if (yahoo == null)
                        var yahoo = importModule("yahoo");
                    this.provider = new yahoo.Yahoo(this);
                    break;
                default:
                    return "error";
            }
            let weatherInfo = await this.provider.GetWeather();
            if (!weatherInfo) {
                this.log.Error("Unable to obtain Weather Information");
                return "failure";
            }
            this.wipeData();
            this.ProcessWeatherData(weatherInfo, locationData);
            if (rebuild)
                this.ui.rebuild(this.config);
            if (!await this.ui.displayWeather(this.weather, this.config) || !await this.ui.displayForecast(this.weather, this.forecasts, this.config))
                return;
            this.log.Print("Weather Information refreshed");
            this.loop.ResetErrorCount();
            return "success";
        }
        catch (e) {
            this.log.Error("Generic Error while refreshing Weather info: " + e);
            this.HandleError({ type: "hard", detail: "unknown", message: _("Unexpected Error While Refreshing Weather, please see log in Looking Glass") });
            return "failure";
        }
    }
    ;
    async ValidateLocation() {
        let location = null;
        if (!this.config._manualLocation) {
            location = await this.locProvider.GetLocation();
            if (!location)
                throw new Error(null);
            let loc = location.lat + "," + location.lon;
            this.config.SetLocation(loc);
            return location;
        }
        else {
            let loc = this.config._location.replace(" ", "");
            if (loc == undefined || loc == "") {
                this.HandleError({
                    type: "hard",
                    detail: "no location",
                    userError: true,
                    message: _("Make sure you entered a location or use Automatic location instead")
                });
                throw new Error("No location given when setting is on Manual Location");
            }
        }
        return null;
    }
    ProcessWeatherData(weatherInfo, locationData) {
        if (!!locationData) {
            this.weather.location.city = locationData.city;
            this.weather.location.country = locationData.country;
            this.weather.location.timeZone = locationData.timeZone;
            this.weather.coord.lat = locationData.lat;
            this.weather.coord.lon = locationData.lon;
        }
        this.weather.condition = weatherInfo.condition;
        this.weather.wind = weatherInfo.wind;
        this.weather.temperature = weatherInfo.temperature,
            this.weather.date = weatherInfo.date;
        this.weather.sunrise = weatherInfo.sunrise;
        this.weather.sunset = weatherInfo.sunset;
        this.weather.coord = weatherInfo.coord;
        this.weather.humidity = weatherInfo.humidity;
        this.weather.pressure = weatherInfo.pressure;
        if (!!weatherInfo.location.city)
            this.weather.location.city = weatherInfo.location.city;
        if (!!weatherInfo.location.country)
            this.weather.location.country = weatherInfo.location.country;
        if (!!weatherInfo.location.timeZone)
            this.weather.location.timeZone = weatherInfo.location.timeZone;
        if (!!weatherInfo.location.url)
            this.weather.location.url = weatherInfo.location.url;
        if (!!weatherInfo.extra_field)
            this.weather.extra_field = weatherInfo.extra_field;
        this.forecasts = weatherInfo.forecasts;
    }
    wipeData() {
        if (this.weather == null) {
            this.weather = {
                date: null,
                location: {
                    city: null,
                    country: null,
                    tzOffset: null,
                    timeZone: null,
                    url: null
                },
                coord: {
                    lat: null,
                    lon: null,
                },
                sunrise: null,
                sunset: null,
                wind: {
                    speed: null,
                    degree: null,
                },
                temperature: null,
                pressure: null,
                humidity: null,
                condition: {
                    main: null,
                    description: null,
                    icon: null,
                    customIcon: null
                },
            };
        }
        this.weather.date = null;
        this.weather.location.city = null;
        this.weather.location.country = null;
        this.weather.location.timeZone = null;
        this.weather.location.tzOffset = null;
        this.weather.location.url = null;
        this.weather.coord.lat = null;
        this.weather.coord.lon = null;
        this.weather.sunrise = null;
        this.weather.sunset = null;
        this.weather.wind.degree = null;
        this.weather.wind.speed = null;
        this.weather.temperature = null;
        this.weather.pressure = null;
        this.weather.humidity = null;
        this.weather.condition.main = null;
        this.weather.condition.description = null;
        this.weather.condition.icon = null;
        this.weather.extra_field = null;
        this.forecasts = [];
    }
    ;
    DisplayError(title, msg) {
        this.set_applet_label(title);
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this.ui.DisplayErrorMessage(msg);
    }
    ;
    HandleError(error) {
        if (this.encounteredError)
            return;
        this.encounteredError = true;
        if (error.type == "hard") {
            this.ui.rebuild(this.config);
            this.DisplayError(this.errMsg[error.detail], (!error.message) ? "" : error.message);
        }
        if (error.type == "soft") {
            if (this.loop.IsDataTooOld()) {
                this.set_applet_tooltip("Click to open");
                this.set_applet_icon_name("weather-severe-alert");
                this.ui.DisplayErrorMessage(_("Could not update weather for a while...\nare you connected to the internet?"));
            }
        }
        if (error.userError) {
            this.loop.Pause();
            return;
        }
        let nextRefresh = this.loop.GetSecondsUntilNextRefresh();
        this.log.Error("Retrying in the next " + nextRefresh.toString() + " seconds...");
    }
    HandleHTTPError(service, error, ctx, callback) {
        let uiError = {
            type: "soft",
            detail: "unknown",
            message: _("Network Error, please check logs in Looking Glass"),
            service: service
        };
        if (typeof error === 'string' || error instanceof String) {
            ctx.log.Error("Error calling " + service + ": " + error.toString());
        }
        else {
            ctx.log.Error("Error calling " + service + " '" + error.message.toString() + "' Reason: " + error.reason_phrase.toString());
            uiError.detail = error.message;
            uiError.code = error.code;
            if (error.message == "bad api response - non json")
                uiError.type = "hard";
            if (!!callback && callback instanceof Function)
                uiError = callback(error, uiError);
        }
        ctx.HandleError(uiError);
    }
}
class Log {
    constructor(_instanceId) {
        this.debug = false;
        this.ID = _instanceId;
        this.appletDir = imports.ui.appletManager.appletMeta[UUID].path;
        this.debug = this.DEBUG();
    }
    DEBUG() {
        let path = this.appletDir + "/../DEBUG";
        let _debug = imports.gi.Gio.file_new_for_path(path);
        let result = _debug.query_exists(null);
        if (result)
            this.Print("DEBUG file found in " + path + ", enabling Debug mode");
        return result;
    }
    ;
    Print(message) {
        let msg = "[" + UUID + "#" + this.ID + "]: " + message.toString();
        let debug = "";
        if (this.debug) {
            debug = this.GetErrorLine();
            global.log(msg, '\n', "On Line:", debug);
        }
        else {
            global.log(msg);
        }
    }
    Error(error) {
        global.logError("[" + UUID + "#" + this.ID + "]: " + error.toString(), '\n', "On Line:", this.GetErrorLine());
    }
    ;
    Debug(message) {
        if (this.debug) {
            this.Print(message);
        }
    }
    GetErrorLine() {
        let arr = (new Error).stack.split("\n").slice(-2)[0].split('/').slice(-1)[0];
        return arr;
    }
}
class UI {
    constructor(app, orientation) {
        this.app = app;
        this.menuManager = new PopupMenuManager(this.app);
        this.menu = new AppletPopupMenu(this.app, orientation);
        this.menu.box.add_style_class_name(STYLE_WEATHER_MENU);
        this.app.log.Debug("Popup Menu applied classes are: " + this.menu.box.get_style_class_name());
        this.menuManager.addMenu(this.menu);
        this.BuildPopupMenu();
    }
    BuildPopupMenu() {
        this._currentWeather = new Bin({ style_class: STYLE_CURRENT });
        this._futureWeather = new Bin({ style_class: STYLE_FORECAST });
        this._separatorArea = new DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM });
        this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(this, this._onSeparatorAreaRepaint));
        let mainBox = new BoxLayout({ vertical: true });
        mainBox.add_actor(this._currentWeather);
        mainBox.add_actor(this._separatorArea);
        mainBox.add_actor(this._futureWeather);
        this.menu.addActor(mainBox);
    }
    rebuild(config) {
        this.showLoadingUi();
        this.rebuildCurrentWeatherUi(config);
        this.rebuildFutureWeatherUi(config);
    }
    UpdateIconType(iconType) {
        this._currentWeatherIcon.icon_type = iconType;
        for (let i = 0; i < this._forecast.length; i++) {
            this._forecast[i].Icon.icon_type = iconType;
        }
    }
    DisplayErrorMessage(msg) {
        this._currentWeatherSunset.text = msg;
    }
    displayWeather(weather, config) {
        try {
            let mainCondition = "";
            let descriptionCondition = "";
            if (weather.condition.main != null) {
                mainCondition = weather.condition.main;
                if (config._translateCondition) {
                    mainCondition = capitalizeFirstLetter(_(mainCondition));
                }
            }
            if (weather.condition.description != null) {
                descriptionCondition = capitalizeFirstLetter(weather.condition.description);
                if (config._translateCondition) {
                    descriptionCondition = capitalizeFirstLetter(_(weather.condition.description));
                }
            }
            let location = "";
            if (weather.location.city != null && weather.location.country != null) {
                location = weather.location.city + ", " + weather.location.country;
            }
            else {
                location = Math.round(weather.coord.lat * 10000) / 10000 + ", " + Math.round(weather.coord.lon * 10000) / 10000;
            }
            if (nonempty(config._locationLabelOverride)) {
                location = config._locationLabelOverride;
            }
            this.app.SetAppletTooltip(location + " - " + _("As of") + " " + AwareDateString(weather.date, this.app.currentLocale, config._show24Hours));
            this._currentWeatherSummary.text = descriptionCondition;
            let iconname = weather.condition.icon;
            if (iconname == null) {
                iconname = "weather-severe-alert";
            }
            if (config._useCustomMenuIcons) {
                this._currentWeatherIcon.icon_name = weather.condition.customIcon;
                this.UpdateIconType(IconType.SYMBOLIC);
            }
            else {
                this._currentWeatherIcon.icon_name = iconname;
                this.UpdateIconType(config.IconType());
            }
            this.app.SetAppletIcon(iconname);
            let temp = "";
            if (weather.temperature != null) {
                temp = TempToUserConfig(weather.temperature, config._temperatureUnit, config._tempRussianStyle);
                this._currentWeatherTemperature.text = temp + " " + this.unitToUnicode(config._temperatureUnit);
            }
            let label = "";
            if (this.app.orientation != Side.LEFT && this.app.orientation != Side.RIGHT) {
                if (config._showCommentInPanel) {
                    label += mainCondition;
                }
                if (config._showTextInPanel) {
                    if (label != "") {
                        label += " ";
                    }
                    label += (temp + ' ' + this.unitToUnicode(config._temperatureUnit));
                }
            }
            else {
                if (config._showTextInPanel) {
                    label = temp;
                }
                if (this.app.GetPanelHeight() >= 35) {
                    label += this.unitToUnicode(config._temperatureUnit);
                }
            }
            if (nonempty(config._tempTextOverride)) {
                label = config._tempTextOverride
                    .replace("{t}", temp)
                    .replace("{u}", this.unitToUnicode(config._temperatureUnit))
                    .replace("{c}", mainCondition);
            }
            this.app.SetAppletLabel(label);
            if (weather.humidity != null) {
                this._currentWeatherHumidity.text = Math.round(weather.humidity) + "%";
            }
            let wind_direction = compassDirection(weather.wind.degree);
            this._currentWeatherWind.text =
                (wind_direction != undefined ? _(wind_direction) + " " : "") +
                    MPStoUserUnits(weather.wind.speed, config._windSpeedUnit);
            if (config._windSpeedUnit != "Beaufort")
                this._currentWeatherWind.text += " " + _(config._windSpeedUnit);
            this._currentWeatherApiUnique.text = "";
            this._currentWeatherApiUniqueCap.text = "";
            if (!!weather.extra_field) {
                this._currentWeatherApiUniqueCap.text = _(weather.extra_field.name) + ":";
                let value;
                switch (weather.extra_field.type) {
                    case "percent":
                        value = weather.extra_field.value.toString() + "%";
                        break;
                    case "temperature":
                        value = TempToUserConfig(weather.extra_field.value, config._temperatureUnit, config._tempRussianStyle) + " " + this.unitToUnicode(config._temperatureUnit);
                        break;
                    default:
                        value = _(weather.extra_field.value);
                        break;
                }
                this._currentWeatherApiUnique.text = value;
            }
            if (weather.pressure != null) {
                this._currentWeatherPressure.text = PressToUserUnits(weather.pressure, config._pressureUnit) + ' ' + _(config._pressureUnit);
            }
            this._currentWeatherLocation.label = location;
            this._currentWeatherLocation.url = weather.location.url;
            let sunriseText = "";
            let sunsetText = "";
            if (weather.sunrise != null && weather.sunset != null && config._showSunrise) {
                sunriseText = (GetHoursMinutes(weather.sunrise, this.app.currentLocale, config._show24Hours, weather.location.timeZone));
                sunsetText = (GetHoursMinutes(weather.sunset, this.app.currentLocale, config._show24Hours, weather.location.timeZone));
            }
            this._currentWeatherSunrise.text = sunriseText;
            this._currentWeatherSunset.text = sunsetText;
            return true;
        }
        catch (e) {
            this.app.log.Error("DisplayWeatherError: " + e);
            return false;
        }
    }
    ;
    displayForecast(weather, forecasts, config) {
        try {
            for (let i = 0; i < this._forecast.length; i++) {
                let forecastData = forecasts[i];
                let forecastUi = this._forecast[i];
                let t_low = TempToUserConfig(forecastData.temp_min, config._temperatureUnit, config._tempRussianStyle);
                let t_high = TempToUserConfig(forecastData.temp_max, config._temperatureUnit, config._tempRussianStyle);
                let first_temperature = config._temperatureHighFirst ? t_high : t_low;
                let second_temperature = config._temperatureHighFirst ? t_low : t_high;
                let comment = "";
                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                    comment = (config._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
                    comment = capitalizeFirstLetter(comment);
                    if (config._translateCondition)
                        comment = _(comment);
                }
                if (weather.location.timeZone == null)
                    forecastData.date.setMilliseconds(forecastData.date.getMilliseconds() + (weather.location.tzOffset * 1000));
                let dayName = GetDayName(forecastData.date, this.app.currentLocale, weather.location.timeZone);
                if (forecastData.date) {
                    let now = new Date();
                    if (forecastData.date.getDate() == now.getDate())
                        dayName = _("Today");
                    if (forecastData.date.getDate() == new Date(now.setDate(now.getDate() + 1)).getDate())
                        dayName = _("Tomorrow");
                }
                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature;
                forecastUi.Temperature.text += ((config._tempRussianStyle) ? ELLIPSIS : " " + FORWARD_SLASH + " ");
                forecastUi.Temperature.text += second_temperature + ' ' + this.unitToUnicode(config._temperatureUnit);
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = (config._useCustomMenuIcons) ? forecastData.condition.customIcon : forecastData.condition.icon;
            }
            return true;
        }
        catch (e) {
            this.app.log.Error("DisplayForecastError " + e);
            return false;
        }
    }
    ;
    unitToUnicode(unit) {
        return unit == "fahrenheit" ? '\u2109' : '\u2103';
    }
    _onSeparatorAreaRepaint(area) {
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();
        let margin = themeNode.get_length('-margin-horizontal');
        let gradientHeight = themeNode.get_length('-gradient-height');
        let startColor = themeNode.get_color('-gradient-start');
        let endColor = themeNode.get_color('-gradient-end');
        let gradientWidth = (width - margin * 2);
        let gradientOffset = (height - gradientHeight) / 2;
        let pattern = new LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
        pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
        pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        cr.setSource(pattern);
        cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();
    }
    ;
    destroyCurrentWeather() {
        if (this._currentWeather.get_child() != null)
            this._currentWeather.get_child().destroy();
    }
    destroyFutureWeather() {
        if (this._futureWeather.get_child() != null)
            this._futureWeather.get_child().destroy();
    }
    showLoadingUi() {
        this.destroyCurrentWeather();
        this.destroyFutureWeather();
        this._currentWeather.set_child(new Label({
            text: _('Loading current weather ...')
        }));
        this._futureWeather.set_child(new Label({
            text: _('Loading future weather ...')
        }));
    }
    rebuildCurrentWeatherUi(config) {
        this.destroyCurrentWeather();
        let textOb = {
            text: ELLIPSIS
        };
        this._currentWeatherIcon = new Icon({
            icon_type: config.IconType(),
            icon_size: 64,
            icon_name: APPLET_ICON,
            style_class: STYLE_ICON
        });
        this._currentWeatherLocation = new Button({ reactive: true, label: _('Refresh'), });
        this._currentWeatherLocation.style_class = STYLE_LOCATION_LINK;
        this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function () {
            if (this._currentWeatherLocation.url == null) {
                this.refreshWeather();
            }
            else {
                imports.gi.Gio.app_info_launch_default_for_uri(this._currentWeatherLocation.url, global.create_app_launch_context());
            }
        }));
        this._currentWeatherSummary = new Label({ text: _('Loading ...'), style_class: STYLE_SUMMARY });
        this._currentWeatherSunrise = new Label(textOb);
        this._currentWeatherSunset = new Label(textOb);
        let sunriseBox = new BoxLayout();
        let sunriseTextBin = new Bin();
        sunriseTextBin.set_child(this._currentWeatherSunrise);
        let sunriseIcon = new Icon({
            icon_name: "sunrise-symbolic",
            icon_type: IconType.SYMBOLIC,
            icon_size: 25
        });
        if (config._showSunrise)
            sunriseBox.add_actor(sunriseIcon);
        sunriseBox.add_actor(sunriseTextBin);
        let sunsetBox = new BoxLayout();
        let sunsetTextBin = new Bin();
        sunsetTextBin.set_child(this._currentWeatherSunset);
        let sunsetIcon = new Icon({
            icon_name: "sunset-symbolic",
            icon_type: IconType.SYMBOLIC,
            icon_size: 25
        });
        if (config._showSunrise)
            sunsetBox.add_actor(sunsetIcon);
        sunsetBox.add_actor(sunsetTextBin);
        let ab_spacerlabel = new Label({ text: BLANK });
        let bb_spacerlabel = new Label({ text: BLANK });
        let sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY });
        sunBox.add_actor(sunriseBox);
        sunBox.add_actor(ab_spacerlabel);
        sunBox.add_actor(sunsetBox);
        let middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX });
        middleColumn.add_actor(this._currentWeatherLocation);
        middleColumn.add_actor(this._currentWeatherSummary);
        middleColumn.add_actor(bb_spacerlabel);
        let sunBin = new Bin();
        sunBin.set_child(sunBox);
        middleColumn.add_actor(sunBin);
        this._currentWeatherTemperature = new Label(textOb);
        this._currentWeatherHumidity = new Label(textOb);
        this._currentWeatherPressure = new Label(textOb);
        this._currentWeatherWind = new Label(textOb);
        this._currentWeatherApiUnique = new Label({ text: '' });
        this._currentWeatherApiUniqueCap = new Label({ text: '' });
        let rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS });
        let rb_values = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_VALUES });
        rb_captions.add_actor(new Label({ text: _('Temperature:') }));
        rb_captions.add_actor(new Label({ text: _('Humidity:') }));
        rb_captions.add_actor(new Label({ text: _('Pressure:') }));
        rb_captions.add_actor(new Label({ text: _('Wind:') }));
        rb_captions.add_actor(this._currentWeatherApiUniqueCap);
        rb_values.add_actor(this._currentWeatherTemperature);
        rb_values.add_actor(this._currentWeatherHumidity);
        rb_values.add_actor(this._currentWeatherPressure);
        rb_values.add_actor(this._currentWeatherWind);
        rb_values.add_actor(this._currentWeatherApiUnique);
        let rightColumn = new BoxLayout({ style_class: STYLE_DATABOX });
        rightColumn.add_actor(rb_captions);
        rightColumn.add_actor(rb_values);
        let weatherBox = new BoxLayout();
        weatherBox.add_actor(middleColumn);
        weatherBox.add_actor(rightColumn);
        let box = new BoxLayout({ style_class: STYLE_ICONBOX });
        box.add_actor(this._currentWeatherIcon);
        box.add_actor(weatherBox);
        this._currentWeather.set_child(box);
    }
    ;
    rebuildFutureWeatherUi(config) {
        this.destroyFutureWeather();
        this._forecast = [];
        this._forecastBox = new BoxLayout({
            vertical: config._verticalOrientation,
            style_class: STYLE_FORECAST_CONTAINER
        });
        this._futureWeather.set_child(this._forecastBox);
        for (let i = 0; i < config._forecastDays; i++) {
            let forecastWeather = {
                Icon: new Icon,
                Day: new Label,
                Summary: new Label,
                Temperature: new Label,
            };
            forecastWeather.Icon = new Icon({
                icon_type: config.IconType(),
                icon_size: 48,
                icon_name: APPLET_ICON,
                style_class: STYLE_FORECAST_ICON
            });
            forecastWeather.Day = new Label({ style_class: STYLE_FORECAST_DAY });
            forecastWeather.Summary = new Label({ style_class: STYLE_FORECAST_SUMMARY });
            forecastWeather.Temperature = new Label({ style_class: STYLE_FORECAST_TEMPERATURE });
            let dataBin = new Bin();
            let dataBox = new BoxLayout({ vertical: true, style_class: STYLE_FORECAST_DATABOX });
            dataBox.add_actor(forecastWeather.Day);
            dataBox.add_actor(forecastWeather.Summary);
            dataBox.add_actor(forecastWeather.Temperature);
            dataBin.set_child(dataBox);
            let forecastBox = new BoxLayout({
                style_class: STYLE_FORECAST_BOX
            });
            forecastBox.add_actor(forecastWeather.Icon);
            forecastBox.add_actor(dataBin);
            this._forecast[i] = forecastWeather;
            this._forecastBox.add_actor(forecastBox);
        }
    }
}
class Config {
    constructor(app, instanceID) {
        this.WEATHER_LOCATION = "location";
        this.WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons';
        this.KEYS = {
            WEATHER_DATA_SERVICE: "dataService",
            WEATHER_API_KEY: "apiKey",
            WEATHER_TEMPERATURE_UNIT_KEY: "temperatureUnit",
            WEATHER_TEMPERATURE_HIGH_FIRST_KEY: "temperatureHighFirst",
            WEATHER_WIND_SPEED_UNIT_KEY: "windSpeedUnit",
            WEATHER_CITY_KEY: "locationLabelOverride",
            WEATHER_TRANSLATE_CONDITION_KEY: "translateCondition",
            WEATHER_VERTICAL_ORIENTATION_KEY: "verticalOrientation",
            WEATHER_SHOW_TEXT_IN_PANEL_KEY: "showTextInPanel",
            WEATHER_TEMP_TEXT_OVERRIDE: "tempTextOverride",
            WEATHER_SHOW_COMMENT_IN_PANEL_KEY: "showCommentInPanel",
            WEATHER_SHOW_SUNRISE_KEY: "showSunrise",
            WEATHER_SHOW_24HOURS_KEY: "show24Hours",
            WEATHER_FORECAST_DAYS: "forecastDays",
            WEATHER_REFRESH_INTERVAL: "refreshInterval",
            WEATHER_PRESSURE_UNIT_KEY: "pressureUnit",
            WEATHER_SHORT_CONDITIONS_KEY: "shortConditions",
            WEATHER_MANUAL_LOCATION: "manualLocation",
            WEATHER_USE_CUSTOM_APPLETICONS_KEY: 'useCustomAppletIcons',
            WEATHER_USE_CUSTOM_MENUICONS_KEY: "useCustomMenuIcons",
            WEATHER_RUSSIAN_STYLE: "tempRussianStyle"
        };
        this.app = app;
        this.settings = new AppletSettings(this, UUID, instanceID);
        this.BindSettings();
    }
    BindSettings() {
        for (let k in this.KEYS) {
            let key = this.KEYS[k];
            let keyProp = "_" + key;
            this.settings.bindProperty(BindingDirection.IN, key, keyProp, Lang.bind(this.app, this.app.refreshAndRebuild), null);
        }
        this.settings.bindProperty(BindingDirection.BIDIRECTIONAL, this.WEATHER_LOCATION, ("_" + this.WEATHER_LOCATION), Lang.bind(this.app, this.app.refreshAndRebuild), null);
        this.settings.bindProperty(BindingDirection.IN, "keybinding", "keybinding", Lang.bind(this.app, this.app._onKeySettingsUpdated), null);
        keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this.app, this.app.on_applet_clicked));
        this.settings.connect(SIGNAL_CHANGED + this.WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, function () {
            this.app.ui.UpdateIconType(this.IconType());
            this.app.refreshWeather();
            this.app.log.Debug("Symbolic icon setting changed");
        }));
    }
    IconType() {
        return this.settings.getValue(this.WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
            IconType.SYMBOLIC :
            IconType.FULLCOLOR;
    }
    ;
    SetLocation(value) {
        this.settings.setValue(this.WEATHER_LOCATION, value);
    }
    noApiKey() {
        if (this._apiKey == undefined || this._apiKey == "") {
            return true;
        }
        return false;
    }
    ;
}
class WeatherLoop {
    constructor(app, instanceID) {
        this.lastUpdated = new Date(0);
        this.pauseRefresh = false;
        this.LOOP_INTERVAL = 15;
        this.appletRemoved = false;
        this.errorCount = 0;
        this.app = app;
        this.instanceID = instanceID;
        this.GUID = uuidv4();
        weatherAppletGUIDs[instanceID] = this.GUID;
    }
    IsDataTooOld() {
        if (!this.lastUpdated)
            return true;
        let oldDate = this.lastUpdated;
        oldDate.setMinutes(oldDate.getMinutes() + (this.app.config._refreshInterval * 2));
        return (this.lastUpdated > oldDate);
    }
    async Start() {
        while (true) {
            try {
                if (this.IsStray())
                    return;
                if (this.app.encounteredError)
                    this.IncrementErrorCount();
                this.ValidateLastUpdate();
                if (this.pauseRefresh) {
                    this.app.log.Debug("Configuration error, updating paused");
                    await delay(this.LoopInterval());
                    continue;
                }
                if (this.errorCount > 0 || this.NextUpdate() < new Date()) {
                    this.app.log.Debug("Refresh triggered in mainloop with these values: lastUpdated " + ((!this.lastUpdated) ? "null" : this.lastUpdated.toLocaleString())
                        + ", errorCount " + this.errorCount.toString() + " , loopInterval " + (this.LoopInterval() / 1000).toString()
                        + " seconds, refreshInterval " + this.app.config._refreshInterval + " minutes");
                    let state = await this.app.refreshWeather(false);
                    if (state == "success") {
                        this.lastUpdated = new Date();
                    }
                }
                else {
                    this.app.log.Debug("No need to update yet, skipping");
                }
            }
            catch (e) {
                this.app.log.Error("Error in Main loop: " + e);
                this.app.encounteredError = true;
            }
            await delay(this.LoopInterval());
        }
    }
    ;
    IsStray() {
        if (this.appletRemoved == true)
            return true;
        if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
            this.app.log.Debug("Applet GUID: " + this.GUID);
            this.app.log.Debug("GUID stored globally: " + weatherAppletGUIDs[this.instanceID]);
            this.app.log.Print("GUID mismatch, terminating applet");
            return true;
        }
        return false;
    }
    IncrementErrorCount() {
        this.app.encounteredError = false;
        this.errorCount++;
        this.app.log.Debug("Encountered error in previous loop");
        if (this.errorCount > 60)
            this.errorCount = 60;
    }
    NextUpdate() {
        return new Date(this.lastUpdated.getTime() + this.app.config._refreshInterval * 60000);
    }
    ValidateLastUpdate() {
        if (this.lastUpdated > new Date())
            this.lastUpdated = new Date(0);
    }
    LoopInterval() {
        return (this.errorCount > 0) ? this.LOOP_INTERVAL * this.errorCount * 1000 : this.LOOP_INTERVAL * 1000;
    }
    Stop() {
        this.appletRemoved = true;
    }
    Pause() {
        this.pauseRefresh = true;
    }
    Resume() {
        this.pauseRefresh = false;
    }
    ResetErrorCount() {
        this.errorCount = 0;
    }
    GetSecondsUntilNextRefresh() {
        return (this.errorCount > 0) ? (this.errorCount) * this.LOOP_INTERVAL : this.LOOP_INTERVAL;
    }
}
const SIGNAL_CHANGED = 'changed::';
const SIGNAL_CLICKED = 'clicked';
const SIGNAL_REPAINT = 'repaint';
const STYLE_LOCATION_LINK = 'weather-current-location-link';
const STYLE_SUMMARYBOX = 'weather-current-summarybox';
const STYLE_SUMMARY = 'weather-current-summary';
const STYLE_DATABOX = 'weather-current-databox';
const STYLE_ICON = 'weather-current-icon';
const STYLE_ICONBOX = 'weather-current-iconbox';
const STYLE_DATABOX_CAPTIONS = 'weather-current-databox-captions';
const STYLE_ASTRONOMY = 'weather-current-astronomy';
const STYLE_FORECAST_ICON = 'weather-forecast-icon';
const STYLE_FORECAST_DATABOX = 'weather-forecast-databox';
const STYLE_FORECAST_DAY = 'weather-forecast-day';
const STYLE_CONFIG = 'weather-config';
const STYLE_DATABOX_VALUES = 'weather-current-databox-values';
const STYLE_FORECAST_SUMMARY = 'weather-forecast-summary';
const STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature';
const STYLE_FORECAST_BOX = 'weather-forecast-box';
const STYLE_FORECAST_CONTAINER = 'weather-forecast-container';
const STYLE_PANEL_BUTTON = 'panel-button';
const STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item';
const STYLE_CURRENT = 'current';
const STYLE_FORECAST = 'forecast';
const STYLE_WEATHER_MENU = 'weather-menu';
const BLANK = '   ';
const ELLIPSIS = '...';
const EN_DASH = '\u2013';
const FORWARD_SLASH = '\u002F';
function main(metadata, orientation, panelHeight, instanceId) {
    return new WeatherApplet(metadata, orientation, panelHeight, instanceId);
}
