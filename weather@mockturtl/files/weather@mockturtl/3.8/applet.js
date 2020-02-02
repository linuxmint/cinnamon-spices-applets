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
var TempToUserUnits = utils.TempToUserUnits;
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
    WEATHERBIT: "Weatherbit"
};
const WEATHER_LOCATION = "location";
const WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons';
const KEYS = {
    WEATHER_DATA_SERVICE: "dataService",
    WEATHER_API_KEY: "apiKey",
    WEATHER_TEMPERATURE_UNIT_KEY: "temperatureUnit",
    WEATHER_TEMPERATURE_HIGH_FIRST_KEY: "temperatureHighFirst",
    WEATHER_WIND_SPEED_UNIT_KEY: "windSpeedUnit",
    WEATHER_CITY_KEY: "locationLabelOverride",
    WEATHER_TRANSLATE_CONDITION_KEY: "translateCondition",
    WEATHER_VERTICAL_ORIENTATION_KEY: "verticalOrientation",
    WEATHER_SHOW_TEXT_IN_PANEL_KEY: "showTextInPanel",
    WEATHER_SHOW_COMMENT_IN_PANEL_KEY: "showCommentInPanel",
    WEATHER_SHOW_SUNRISE_KEY: "showSunrise",
    WEATHER_SHOW_24HOURS_KEY: "show24Hours",
    WEATHER_FORECAST_DAYS: "forecastDays",
    WEATHER_REFRESH_INTERVAL: "refreshInterval",
    WEATHER_PRESSURE_UNIT_KEY: "pressureUnit",
    WEATHER_SHORT_CONDITIONS_KEY: "shortConditions",
    WEATHER_MANUAL_LOCATION: "manualLocation",
    WEATHER_USE_CCUSTOM_APPLETICONS_KEY: 'useCustomAppletIcons'
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
        this.forecasts = [];
        this.currentLocale = null;
        this.systemLanguage = null;
        this._httpSession = new SessionAsync();
        this.appletDir = imports.ui.appletManager.appletMeta[UUID].path;
        this.locProvider = new ipApi.IpApi(this);
        this.lastUpdated = new Date(0);
        this.encounteredError = false;
        this.pauseRefresh = false;
        this.errorCount = 0;
        this.LOOP_INTERVAL = 15;
        this.appletRemoved = false;
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
        this.instanceID = instanceId;
        this.currentLocale = this.constructJsLocale(get_language_names()[0]);
        this.systemLanguage = this.currentLocale.split('-')[0];
        this.settings = new AppletSettings(this, UUID, instanceId);
        this.log = new Log(instanceId);
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0";
        this.msgSource = new SystemNotificationSource(_("Weather Applet"));
        messageTray.add(this.msgSource);
        Session.prototype.add_feature.call(this._httpSession, new ProxyResolverDefault());
        imports.gi.Gtk.IconTheme.get_default().append_search_path(this.appletDir + "/../icons");
        this.SetAppletOnPanel();
        this.AddPopupMenu(orientation);
        this.BindSettings();
        this.AddRefreshButton();
        this.BuildPopupMenu();
        this.GUID = uuidv4();
        weatherAppletGUIDs[instanceId] = this.GUID;
        this.rebuild();
        this.RefreshLoop();
        this.orientation = orientation;
        try {
            this.setAllowedLayout(AllowedLayout.BOTH);
            this.update_label_visible();
        }
        catch (e) {
        }
    }
    SetAppletOnPanel() {
        this.set_applet_icon_name(APPLET_ICON);
        this.set_applet_label(_("..."));
        this.set_applet_tooltip(_("Click to open"));
    }
    AddPopupMenu(orientation) {
        this.menuManager = new PopupMenuManager(this);
        this.menu = new AppletPopupMenu(this, orientation);
        if (typeof this.menu.setCustomStyleClass === "function")
            this.menu.setCustomStyleClass(STYLE_WEATHER_MENU);
        else {
            this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
        }
        this.menuManager.addMenu(this.menu);
    }
    BindSettings() {
        for (let k in KEYS) {
            let key = KEYS[k];
            let keyProp = "_" + key;
            this.settings.bindProperty(BindingDirection.IN, key, keyProp, this.refreshAndRebuild, null);
        }
        this.settings.bindProperty(BindingDirection.BIDIRECTIONAL, WEATHER_LOCATION, ("_" + WEATHER_LOCATION), this.refreshAndRebuild, null);
        this.settings.bindProperty(BindingDirection.IN, "keybinding", "keybinding", this._onKeySettingsUpdated, null);
        keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));
        this.updateIconType();
        this.settings.connect(SIGNAL_CHANGED + WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, function () {
            this.updateIconType();
            this._applet_icon.icon_type = this._icon_type;
            this._currentWeatherIcon.icon_type = this._icon_type;
            for (let i = 0; i < this._forecastDays; i++) {
                this._forecast[i].Icon.icon_type = this._icon_type;
            }
            this.refreshWeather();
        }));
    }
    AddRefreshButton() {
        let itemLabel = _("Refresh");
        let refreshMenuItem = new MenuItem(itemLabel, REFRESH_ICON, Lang.bind(this, function () {
            this.refreshAndRebuild();
        }));
        this._applet_context_menu.addMenuItem(refreshMenuItem);
    }
    BuildPopupMenu() {
        this._currentWeather = new Bin({ style_class: STYLE_CURRENT });
        this._futureWeather = new Bin({ style_class: STYLE_FORECAST });
        this._separatorArea = new DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM });
        this._separatorArea.width = 200;
        this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(this, this._onSeparatorAreaRepaint));
        let mainBox = new BoxLayout({ vertical: true });
        mainBox.add_actor(this._currentWeather);
        mainBox.add_actor(this._separatorArea);
        mainBox.add_actor(this._futureWeather);
        this.menu.addActor(mainBox);
    }
    refreshAndRebuild() {
        this.pauseRefresh = false;
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
        let notification = new Notification(this.msgSource, title, message);
        if (transient)
            notification.setTransient(true);
        this.msgSource.notify(notification);
    }
    async locationLookup() {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
    }
    IsDataTooOld() {
        if (!this.lastUpdated)
            return true;
        let oldDate = this.lastUpdated;
        oldDate.setMinutes(oldDate.getMinutes() + (this._refreshInterval * 2));
        return (this.lastUpdated > oldDate);
    }
    async RefreshLoop() {
        let loopInterval = this.LOOP_INTERVAL;
        while (true) {
            try {
                this.log.Debug("Loop began");
                if (this.appletRemoved == true)
                    return;
                this.log.Debug("Applet GUID: " + this.GUID);
                this.log.Debug("GUID stored globally: " + weatherAppletGUIDs[this.instanceID]);
                if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
                    this.log.Print("GUID mismatch, terminating applet");
                    return;
                }
                if (this.encounteredError) {
                    this.encounteredError = false;
                    this.errorCount++;
                    this.log.Debug("Encountered error in previous loop");
                }
                if (this.errorCount > 60)
                    this.errorCount = 60;
                loopInterval = (this.errorCount > 0) ? loopInterval * this.errorCount : this.LOOP_INTERVAL;
                if (this.pauseRefresh == true) {
                    this.log.Debug("Configuration error, updating paused");
                    await delay(loopInterval * 1000);
                    continue;
                }
                let nextUpdate = new Date(this.lastUpdated.getTime() + this._refreshInterval * 60000);
                if (this.errorCount > 0 || nextUpdate < new Date()) {
                    this.log.Debug("Refresh triggered in mainloop with these values: lastUpdated " + ((!this.lastUpdated) ? "null" : this.lastUpdated.toLocaleString()) + ", errorCount " + this.errorCount.toString() + " , loopInterval " + loopInterval.toString() + " seconds, refreshInterval " + this._refreshInterval + " minutes");
                    let state = await this.refreshWeather(false);
                    if (state == "success") {
                        this.lastUpdated = new Date();
                    }
                }
                else {
                    this.log.Debug("No need to update yet, skipping");
                }
            }
            catch (e) {
                this.log.Error("Error in Main loop: " + e);
                this.encounteredError = true;
            }
            await delay(loopInterval * 1000);
        }
    }
    ;
    update_label_visible() {
        if (this.orientation == Side.LEFT || this.orientation == Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    }
    ;
    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this.refreshWeather(true);
    }
    ;
    _onKeySettingsUpdated() {
        if (this.keybinding != null) {
            keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));
        }
    }
    on_applet_removed_from_panel(deleteConfig) {
        this.log.Print("Removing applet instance...");
        this.appletRemoved = true;
    }
    on_applet_clicked(event) {
        this.menu.toggle();
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
    updateIconType() {
        this._icon_type = this.settings.getValue(WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
            IconType.SYMBOLIC :
            IconType.FULLCOLOR;
    }
    ;
    constructJsLocale(locale) {
        let jsLocale = locale.split(".")[0];
        let tmp = jsLocale.split("_");
        jsLocale = "";
        for (let i = 0; i < tmp.length; i++) {
            if (i != 0)
                jsLocale += "-";
            jsLocale += tmp[i];
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
            switch (this._dataService) {
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
                default:
                    return "error";
            }
            let weatherInfo = await this.provider.GetWeather();
            if (!weatherInfo) {
                this.log.Error("Unable to obtain Weather Information");
                return "failure";
            }
            this.wipeCurrentData();
            this.wipeForecastData();
            this.ProcessWeatherData(weatherInfo, locationData);
            if (rebuild)
                this.rebuild();
            if (!await this.displayWeather() || !await this.displayForecast())
                return;
            this.log.Print("Weather Information refreshed");
            this.errorCount = 0;
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
        if (!this._manualLocation) {
            location = await this.locProvider.GetLocation();
            if (!location)
                throw new Error(null);
            let loc = location.lat + "," + location.lon;
            this.settings.setValue('location', loc);
            return location;
        }
        else {
            let loc = this._location.replace(" ", "");
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
    displayWeather() {
        try {
            let mainCondition = "";
            let descriptionCondition = "";
            if (this.weather.condition.main != null) {
                mainCondition = this.weather.condition.main;
                if (this._translateCondition) {
                    mainCondition = capitalizeFirstLetter(_(mainCondition));
                }
            }
            if (this.weather.condition.description != null) {
                descriptionCondition = capitalizeFirstLetter(this.weather.condition.description);
                if (this._translateCondition) {
                    descriptionCondition = _(descriptionCondition);
                }
            }
            let location = "";
            if (this.weather.location.city != null && this.weather.location.country != null) {
                location = this.weather.location.city + ", " + this.weather.location.country;
            }
            else {
                location = Math.round(this.weather.coord.lat * 10000) / 10000 + ", " + Math.round(this.weather.coord.lon * 10000) / 10000;
            }
            if (nonempty(this._locationLabelOverride)) {
                location = this._locationLabelOverride;
            }
            this.set_applet_tooltip(location + " - " + _("Updated") + " " + AwareDateString(this.weather.date, this.currentLocale, this._show24Hours));
            this._currentWeatherSummary.text = descriptionCondition;
            let iconname = this.weather.condition.icon;
            if (iconname == null) {
                iconname = "weather-severe-alert";
            }
            this._currentWeatherIcon.icon_name = iconname;
            this._icon_type == IconType.SYMBOLIC ?
                this.set_applet_icon_symbolic_name(iconname) :
                this.set_applet_icon_name(iconname);
            if (this._useCustomAppletIcons)
                this.SetCustomIcon(this.weather.condition.customIcon);
            let temp = "";
            if (this.weather.temperature != null) {
                temp = TempToUserUnits(this.weather.temperature, this._temperatureUnit).toString();
                this._currentWeatherTemperature.text = temp + ' ' + this.unitToUnicode(this._temperatureUnit);
            }
            let label = "";
            if (this._showCommentInPanel) {
                label += mainCondition;
            }
            if (this._showTextInPanel) {
                if (label != "") {
                    label += " ";
                }
                label += (temp + ' ' + this.unitToUnicode(this._temperatureUnit));
            }
            this.set_applet_label(label);
            try {
                this.update_label_visible();
            }
            catch (e) {
            }
            if (this.weather.humidity != null) {
                this._currentWeatherHumidity.text = Math.round(this.weather.humidity) + "%";
            }
            let wind_direction = compassDirection(this.weather.wind.degree);
            this._currentWeatherWind.text =
                (wind_direction != undefined ? _(wind_direction) + " " : "") +
                    MPStoUserUnits(this.weather.wind.speed, this._windSpeedUnit) +
                    " " +
                    _(this._windSpeedUnit);
            this._currentWeatherApiUnique.text = "";
            this._currentWeatherApiUniqueCap.text = "";
            if (!!this.weather.extra_field) {
                this._currentWeatherApiUniqueCap.text = _(this.weather.extra_field.name) + ":";
                let value;
                switch (this.weather.extra_field.type) {
                    case "percent":
                        value = this.weather.extra_field.value.toString() + "%";
                        break;
                    case "temperature":
                        value = TempToUserUnits(this.weather.extra_field.value, this._temperatureUnit) + this.unitToUnicode(this._temperatureUnit);
                        break;
                    default:
                        value = _(this.weather.extra_field.value);
                        break;
                }
                this._currentWeatherApiUnique.text = value;
            }
            if (this.weather.pressure != null) {
                this._currentWeatherPressure.text = PressToUserUnits(this.weather.pressure, this._pressureUnit) + ' ' + _(this._pressureUnit);
            }
            this._currentWeatherLocation.label = location;
            this._currentWeatherLocation.url = this.weather.location.url;
            let sunriseText = "";
            let sunsetText = "";
            if (this.weather.sunrise != null && this.weather.sunset != null && this._showSunrise) {
                sunriseText = (_('Sunrise') + ': ' + GetHoursMinutes(this.weather.sunrise, this.currentLocale, this._show24Hours, this.weather.location.timeZone));
                sunsetText = (_('Sunset') + ': ' + GetHoursMinutes(this.weather.sunset, this.currentLocale, this._show24Hours, this.weather.location.timeZone));
            }
            this._currentWeatherSunrise.text = sunriseText;
            this._currentWeatherSunset.text = sunsetText;
            return true;
        }
        catch (e) {
            this.log.Error("DisplayWeatherError: " + e);
            return false;
        }
    }
    ;
    displayForecast() {
        try {
            for (let i = 0; i < this._forecast.length; i++) {
                let forecastData = this.forecasts[i];
                let forecastUi = this._forecast[i];
                let t_low = TempToUserUnits(forecastData.temp_min, this._temperatureUnit);
                let t_high = TempToUserUnits(forecastData.temp_max, this._temperatureUnit);
                let first_temperature = this._temperatureHighFirst ? t_high : t_low;
                let second_temperature = this._temperatureHighFirst ? t_low : t_high;
                let comment = "";
                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                    comment = (this._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
                    comment = capitalizeFirstLetter(comment);
                    if (this._translateCondition)
                        comment = _(comment);
                }
                if (this.weather.location.timeZone == null)
                    forecastData.date.setMilliseconds(forecastData.date.getMilliseconds() + (this.weather.location.tzOffset * 1000));
                let dayName = GetDayName(forecastData.date, this.currentLocale, this.weather.location.timeZone);
                if (forecastData.date) {
                    let now = new Date();
                    if (forecastData.date.getDate() == now.getDate())
                        dayName = _("Today");
                    if (forecastData.date.getDate() == new Date(now.setDate(now.getDate() + 1)).getDate())
                        dayName = _("Tomorrow");
                }
                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature + ' ' + '\u002F' + ' ' + second_temperature + ' ' + this.unitToUnicode(this._temperatureUnit);
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = forecastData.condition.icon;
            }
            return true;
        }
        catch (e) {
            this.log.Error("DisplayForecastError " + e);
            return false;
        }
    }
    ;
    wipeCurrentData() {
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
    }
    ;
    wipeForecastData() {
        this.forecasts = [];
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
    rebuild() {
        this.showLoadingUi();
        this.rebuildCurrentWeatherUi();
        this.rebuildFutureWeatherUi();
    }
    rebuildCurrentWeatherUi() {
        this.destroyCurrentWeather();
        let textOb = {
            text: ELLIPSIS
        };
        this._currentWeatherIcon = new Icon({
            icon_type: this._icon_type,
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
        let ab_spacerlabel = new Label({ text: BLANK });
        let bb_spacerlabel = new Label({ text: BLANK });
        let sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY });
        sunBox.add_actor(this._currentWeatherSunrise);
        sunBox.add_actor(ab_spacerlabel);
        sunBox.add_actor(this._currentWeatherSunset);
        let middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX });
        middleColumn.add_actor(this._currentWeatherLocation);
        middleColumn.add_actor(this._currentWeatherSummary);
        middleColumn.add_actor(bb_spacerlabel);
        middleColumn.add_actor(sunBox);
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
    rebuildFutureWeatherUi() {
        this.destroyFutureWeather();
        this._forecast = [];
        this._forecastBox = new BoxLayout({
            vertical: this._verticalOrientation,
            style_class: STYLE_FORECAST_CONTAINER
        });
        this._futureWeather.set_child(this._forecastBox);
        for (let i = 0; i < this._forecastDays; i++) {
            let forecastWeather = {
                Icon: new Icon,
                Day: new Label,
                Summary: new Label,
                Temperature: new Label,
            };
            forecastWeather.Icon = new Icon({
                icon_type: this._icon_type,
                icon_size: 48,
                icon_name: APPLET_ICON,
                style_class: STYLE_FORECAST_ICON
            });
            forecastWeather.Day = new Label({ style_class: STYLE_FORECAST_DAY });
            forecastWeather.Summary = new Label({ style_class: STYLE_FORECAST_SUMMARY });
            forecastWeather.Temperature = new Label({ style_class: STYLE_FORECAST_TEMPERATURE });
            let dataBox = new BoxLayout({ vertical: true, style_class: STYLE_FORECAST_DATABOX });
            dataBox.add_actor(forecastWeather.Day);
            dataBox.add_actor(forecastWeather.Summary);
            dataBox.add_actor(forecastWeather.Temperature);
            let forecastBox = new BoxLayout({
                style_class: STYLE_FORECAST_BOX
            });
            forecastBox.add_actor(forecastWeather.Icon);
            forecastBox.add_actor(dataBox);
            this._forecast[i] = forecastWeather;
            this._forecastBox.add_actor(forecastBox);
        }
    }
    noApiKey() {
        if (this._apiKey == undefined || this._apiKey == "") {
            return true;
        }
        return false;
    }
    ;
    SetCustomIcon(iconName) {
        this.set_applet_icon_symbolic_name(iconName + "-symbolic");
    }
    unitToUnicode(unit) {
        return unit == "fahrenheit" ? '\u2109' : '\u2103';
    }
    DisplayError(title, msg) {
        this.set_applet_label(title);
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this._currentWeatherSunset.text = msg;
    }
    ;
    HandleError(error) {
        if (this.encounteredError)
            return;
        this.encounteredError = true;
        if (error.type == "hard") {
            this.rebuild();
            this.DisplayError(this.errMsg[error.detail], (!error.message) ? "" : error.message);
        }
        if (error.type == "soft") {
            if (this.IsDataTooOld()) {
                this.set_applet_tooltip("Click to open");
                this.set_applet_icon_name("weather-severe-alert");
                this._currentWeatherSunset.text = _("Could not update weather for a while...\nare you connected to the internet?");
            }
        }
        if (error.userError) {
            this.pauseRefresh = true;
            return;
        }
        let nextRefresh = (this.errorCount > 0) ? this.errorCount++ * this.LOOP_INTERVAL : this.LOOP_INTERVAL;
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
function main(metadata, orientation, panelHeight, instanceId) {
    return new WeatherApplet(metadata, orientation, panelHeight, instanceId);
}
