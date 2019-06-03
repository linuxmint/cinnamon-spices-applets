const DEBUG = false;
const Cairo = imports.cairo;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Cinnamon = imports.gi.Cinnamon;
const Soup = imports.gi.Soup;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const Config = imports.misc.config;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const UUID = "weather@mockturtl";
const APPLET_ICON = "view-refresh-symbolic";
const REFRESH_ICON = "view-refresh";
const CMD_SETTINGS = "cinnamon-settings applets " + UUID;
const WEATHER_CONV_MPH_IN_MPS = 2.23693629;
const WEATHER_CONV_KPH_IN_MPS = 3.6;
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449;
const BLANK = '   ';
const ELLIPSIS = '...';
const EN_DASH = '\u2013';
const DATA_SERVICE = {
    OPEN_WEATHER_MAP: "OpenWeatherMap",
    DARK_SKY: "DarkSky",
};
const WEATHER_LOCATION = "location";
const WEATHER_DATA_SERVICE = "dataService";
const WEATHER_API_KEY = "apiKey";
const WEATHER_CITY_KEY = 'locationLabelOverride';
const WEATHER_REFRESH_INTERVAL = 'refreshInterval';
const WEATHER_SHOW_COMMENT_IN_PANEL_KEY = 'showCommentInPanel';
const WEATHER_VERTICAL_ORIENTATION_KEY = 'verticalOrientation';
const WEATHER_SHOW_SUNRISE_KEY = 'showSunrise';
const WEATHER_SHOW_24HOURS_KEY = 'show24Hours';
const WEATHER_FORECAST_DAYS = 'forecastDays';
const WEATHER_SHOW_TEXT_IN_PANEL_KEY = 'showTextInPanel';
const WEATHER_TRANSLATE_CONDITION_KEY = 'translateCondition';
const WEATHER_TEMPERATURE_UNIT_KEY = 'temperatureUnit';
const WEATHER_TEMPERATURE_HIGH_FIRST_KEY = 'temperatureHighFirst';
const WEATHER_PRESSURE_UNIT_KEY = 'pressureUnit';
const WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons';
const WEATHER_WIND_SPEED_UNIT_KEY = 'windSpeedUnit';
const WEATHER_SHORT_CONDITIONS_KEY = 'shortConditions';
const WEATHER_MANUAL_LOCATION = "manualLocation";
const KEYS = [,
    WEATHER_DATA_SERVICE,
    WEATHER_API_KEY,
    WEATHER_TEMPERATURE_UNIT_KEY,
    WEATHER_TEMPERATURE_HIGH_FIRST_KEY,
    WEATHER_WIND_SPEED_UNIT_KEY,
    WEATHER_CITY_KEY,
    WEATHER_TRANSLATE_CONDITION_KEY,
    WEATHER_VERTICAL_ORIENTATION_KEY,
    WEATHER_SHOW_TEXT_IN_PANEL_KEY,
    WEATHER_SHOW_COMMENT_IN_PANEL_KEY,
    WEATHER_SHOW_SUNRISE_KEY,
    WEATHER_SHOW_24HOURS_KEY,
    WEATHER_FORECAST_DAYS,
    WEATHER_REFRESH_INTERVAL,
    WEATHER_PRESSURE_UNIT_KEY,
    WEATHER_SHORT_CONDITIONS_KEY,
    WEATHER_MANUAL_LOCATION
];
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
const STYLE_PANEL_BUTTON = 'panel-button';
const STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item';
const STYLE_CURRENT = 'current';
const STYLE_FORECAST = 'forecast';
const STYLE_WEATHER_MENU = 'weather-menu';
const WeatherPressureUnits = {
    HPA: 'hPa',
    MMHG: 'mm Hg',
    INHG: 'in Hg',
    PA: 'Pa',
    PSI: 'psi',
    ATM: 'atm',
    AT: 'at'
};
class Log {
    constructor(_instanceId) {
        this.debug = false;
        this.ID = _instanceId;
        this.debug = DEBUG;
    }
    Print(message) {
        let msg = UUID + "#" + this.ID + ": " + message.toString();
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
        global.logError(UUID + "#" + this.ID + ": " + error.toString(), '\n', "On Line:", this.GetErrorLine());
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
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return Gettext.dgettext(UUID, str);
}
var darkSky;
var openWeatherMap;
const ipApi = require('./ipApi');
class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.weather = {
            dateTime: null,
            location: {
                city: null,
                country: null,
                id: null,
                tzOffset: null,
                timeZone: null
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
            main: {
                temperature: null,
                pressure: null,
                humidity: null,
                temp_min: null,
                temp_max: null,
                feelsLike: null
            },
            condition: {
                id: null,
                main: null,
                description: null,
                icon: null,
            },
            cloudiness: null,
        };
        this.forecasts = [];
        this.WeatherUnits = {
            CELSIUS: 'celsius',
            FAHRENHEIT: 'fahrenheit'
        };
        this.WeatherWindSpeedUnits = {
            KPH: 'kph',
            MPH: 'mph',
            MPS: 'm/s',
            KNOTS: 'Knots'
        };
        this.errMsg = {
            label: {
                generic: _("Error"),
                service: _("Service Error"),
                noKey: _("No Api key"),
                noLoc: _("No Location"),
            },
            desc: {
                keyBad: _("Wrong API Key"),
                locBad: _("Wrong Location"),
                locNotFound: _("Location Not found"),
                parse: _("Parsing weather information failed :("),
                keyBlock: _("Key Temp. Blocked"),
                cantGetLoc: _("Could not get location"),
                unknown: _("Unknown Error"),
                noResponse: _("No/Bad response from Data Service")
            }
        };
        this.DarkSkyFilterWords = [_("and"), _("until"), _("in")];
        this.currentLocale = null;
        this.systemLanguage = null;
        this._httpSession = new Soup.SessionAsync();
        this.locProvider = new ipApi.IpApi(this);
        this.lastUpdated = null;
        this.currentLocale = GLib.get_language_names()[0];
        this.systemLanguage = this.currentLocale.split('_')[0];
        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.log = new Log(instanceId);
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0";
        Soup.Session.prototype.add_feature.call(this._httpSession, new Soup.ProxyResolverDefault());
        this.set_applet_icon_name(APPLET_ICON);
        this.set_applet_label(_("..."));
        this.set_applet_tooltip(_("Click to open"));
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        if (typeof this.menu.setCustomStyleClass === "function")
            this.menu.setCustomStyleClass(STYLE_WEATHER_MENU);
        else
            this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
        this.menuManager.addMenu(this.menu);
        for (let k in KEYS) {
            let key = KEYS[k];
            let keyProp = "_" + key;
            this.settings.bindProperty(Settings.BindingDirection.IN, key, keyProp, this.refreshAndRebuild, null);
        }
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, WEATHER_LOCATION, ("_" + WEATHER_LOCATION), this.refreshAndRebuild, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "keybinding", "keybinding", this._onKeySettingsUpdated, null);
        Main.keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));
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
        let itemLabel = _("Refresh");
        let refreshMenuItem = new Applet.MenuItem(itemLabel, REFRESH_ICON, Lang.bind(this, function () {
            this.refreshWeather();
        }));
        this._applet_context_menu.addMenuItem(refreshMenuItem);
        let mainBox = new St.BoxLayout({ vertical: true });
        this.menu.addActor(mainBox);
        this._currentWeather = new St.Bin({ style_class: STYLE_CURRENT });
        mainBox.add_actor(this._currentWeather);
        this._separatorArea = new St.DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM });
        this._separatorArea.width = 200;
        this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(this, this._onSeparatorAreaRepaint));
        mainBox.add_actor(this._separatorArea);
        this._futureWeather = new St.Bin({ style_class: STYLE_FORECAST });
        mainBox.add_actor(this._futureWeather);
        this.rebuild();
        this.refreshLoop();
        this.orientation = orientation;
        try {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            this.update_label_visible();
        }
        catch (e) {
        }
    }
    refreshAndRebuild() {
        this.refreshWeather();
    }
    ;
    async LoadJsonAsync(query) {
        let json = await new Promise((resolve, reject) => {
            let message = Soup.Message.new('GET', query);
            this._httpSession.queue_message(message, (session, message) => {
                if (message) {
                    try {
                        if (message.status_code != 200) {
                            reject("http response Code: " + message.status_code + ", reason: " + message.reason_phrase);
                            return;
                        }
                        this.log.Debug("API full response: " + message.response_body.data.toString());
                        let payload = JSON.parse(message.response_body.data);
                        resolve(payload);
                    }
                    catch (e) {
                        this.log.Error("Error: API response is not JSON. The response: " + message.response_body.data);
                        reject(e);
                    }
                }
                else {
                    this.log.Error("Error: No Response from API");
                    reject(null);
                }
            });
        });
        return json;
    }
    ;
    async locationLookup() {
        let command = "xdg-open ";
        Util.spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
    }
    refreshLoop() {
        try {
            if (this.lastUpdated == null || new Date(this.lastUpdated.getTime() + this._refreshInterval * 60000) < new Date()) {
                this.refreshWeather();
            }
        }
        catch (e) {
            this.log.Error("Error in Main loop: " + e);
            this.lastUpdated = null;
        }
        Mainloop.timeout_add_seconds(15, Lang.bind(this, function mainloopTimeout() {
            this.refreshLoop();
        }));
    }
    ;
    update_label_visible() {
        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    }
    ;
    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this.refreshWeather();
    }
    ;
    _onKeySettingsUpdated() {
        if (this.keybinding != null) {
            Main.keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));
        }
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
        let pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
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
            St.IconType.SYMBOLIC :
            St.IconType.FULLCOLOR;
    }
    ;
    showError(title, msg) {
        this.set_applet_label(title);
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this._currentWeatherSunrise.text = msg;
    }
    ;
    async refreshWeather() {
        this.wipeCurrentData();
        this.wipeForecastData();
        try {
            if (!this._manualLocation) {
                let haveLocation = await this.locProvider.GetLocation();
                if (!haveLocation) {
                    this.log.Error("Couldn't obtain location, retry in 15 seconds...");
                    this.showError(this.errMsg.label.noLoc, this.errMsg.desc.cantGetLoc);
                    this.lastUpdated = null;
                    return;
                }
            }
            else {
                let loc = this._location.replace(" ", "");
                if (loc == undefined || loc == "") {
                    this.showError(this.errMsg.label.noLoc, "");
                    this.log.Error("No location given when setting is on Manual Location");
                    return;
                }
            }
            let refreshResult;
            switch (this._dataService) {
                case DATA_SERVICE.DARK_SKY:
                    if (darkSky == null) {
                        darkSky = require('./darkSky');
                    }
                    this.provider = new darkSky.DarkSky(this);
                    refreshResult = await this.provider.GetWeather();
                    break;
                case DATA_SERVICE.OPEN_WEATHER_MAP:
                    if (openWeatherMap == null) {
                        openWeatherMap = require('./openWeatherMap');
                    }
                    this.provider = new openWeatherMap.OpenWeatherMap(this);
                    refreshResult = await this.provider.GetWeather();
                    break;
                default:
                    return;
            }
            if (!refreshResult) {
                this.log.Error("Unable to obtain Weather Information");
                this.lastUpdated = null;
                return;
            }
            this.rebuild();
            if (await this.displayWeather() && await this.displayForecast()) {
                this.log.Print("Weather Information refreshed");
            }
        }
        catch (e) {
            this.log.Error("Error while refreshing Weather info: " + e);
            this.lastUpdated = null;
            return;
        }
        this.lastUpdated = new Date();
        return;
    }
    ;
    displayWeather() {
        try {
            let mainCondition = "";
            let descriptionCondition = "";
            if (this.weather.condition.main != null) {
                mainCondition = this.weather.condition.main;
                if (this._translateCondition) {
                    mainCondition = this.capitalizeFirstLetter(_(mainCondition));
                }
            }
            if (this.weather.condition.description != null) {
                descriptionCondition = this.capitalizeFirstLetter(this.weather.condition.description);
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
            if (this.nonempty(this._locationLabelOverride)) {
                location = this._locationLabelOverride;
            }
            this.set_applet_tooltip(location);
            this._currentWeatherSummary.text = descriptionCondition;
            let iconname = this.weather.condition.icon;
            if (iconname == null) {
                iconname = "weather-severe-alert";
            }
            this._currentWeatherIcon.icon_name = iconname;
            this._icon_type == St.IconType.SYMBOLIC ?
                this.set_applet_icon_symbolic_name(iconname) :
                this.set_applet_icon_name(iconname);
            let temp = "";
            if (this.weather.main.temperature != null) {
                temp = this.TempToUserUnits(this.weather.main.temperature).toString();
                this._currentWeatherTemperature.text = temp + ' ' + this.unitToUnicode();
            }
            let label = "";
            if (this._showCommentInPanel) {
                label += mainCondition;
            }
            if (this._showTextInPanel) {
                if (label != "") {
                    label += " ";
                }
                label += (temp + ' ' + this.unitToUnicode());
            }
            this.set_applet_label(label);
            try {
                this.update_label_visible();
            }
            catch (e) {
            }
            if (this.weather.main.humidity != null) {
                this._currentWeatherHumidity.text = Math.round(this.weather.main.humidity) + "%";
            }
            let wind_direction = this.compassDirection(this.weather.wind.degree);
            this._currentWeatherWind.text = ((wind_direction != undefined) ? wind_direction + ' ' : '') + this.MPStoUserUnits(this.weather.wind.speed) + ' ' + this._windSpeedUnit;
            switch (this._dataService) {
                case DATA_SERVICE.OPEN_WEATHER_MAP:
                    if (this.weather.cloudiness != null) {
                        this._currentWeatherApiUnique.text = this.weather.cloudiness + "%";
                        this._currentWeatherApiUniqueCap.text = _("Cloudiness:");
                    }
                    break;
                case DATA_SERVICE.DARK_SKY:
                    if (this.weather.main.feelsLike != null) {
                        this._currentWeatherApiUnique.text = this.TempToUserUnits(this.weather.main.feelsLike) + this.unitToUnicode();
                        this._currentWeatherApiUniqueCap.text = _("Feels like:");
                    }
                    break;
                default:
                    this._currentWeatherApiUnique.text = "";
                    this._currentWeatherApiUniqueCap.text = "";
            }
            if (this.weather.main.pressure != null) {
                this._currentWeatherPressure.text = this.PressToUserUnits(this.weather.main.pressure) + ' ' + _(this._pressureUnit);
            }
            this._currentWeatherLocation.label = location;
            switch (this._dataService) {
                case DATA_SERVICE.OPEN_WEATHER_MAP:
                    this._currentWeatherLocation.url = "https://openweathermap.org/city/" + this.weather.location.id;
                    break;
                case DATA_SERVICE.DARK_SKY:
                    this._currentWeatherLocation.url = "https://darksky.net/forecast/" + this.weather.coord.lat + "," + this.weather.coord.lon;
                    break;
                default:
                    this._currentWeatherLocation.url = null;
            }
            let sunriseText = "";
            let sunsetText = "";
            if (this.weather.sunrise != null && this.weather.sunset != null) {
                if (this._showSunrise) {
                    sunriseText = _('Sunrise');
                    sunsetText = _('Sunset');
                    if (this.weather.location.timeZone != null) {
                        let sunrise = this.weather.sunrise.toLocaleString("en-GB", { timeZone: this.weather.location.timeZone, hour: "2-digit", minute: "2-digit" });
                        let sunset = this.weather.sunset.toLocaleString("en-GB", { timeZone: this.weather.location.timeZone, hour: "2-digit", minute: "2-digit" });
                        sunriseText = (sunriseText + ': ' + this.timeToUserUnits(sunrise));
                        sunsetText = (sunsetText + ': ' + this.timeToUserUnits(sunset));
                    }
                    else {
                        sunriseText = (sunriseText + ': ' + this.timeToUserUnits(this.toLocaleFormat(this.weather.sunrise, '%H:%M')));
                        sunsetText = (sunsetText + ': ' + this.timeToUserUnits(this.toLocaleFormat(this.weather.sunset, '%H:%M')));
                    }
                }
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
                let t_low = this.TempToUserUnits(forecastData.main.temp_min);
                let t_high = this.TempToUserUnits(forecastData.main.temp_max);
                let first_temperature = this._temperatureHighFirst ? t_high : t_low;
                let second_temperature = this._temperatureHighFirst ? t_low : t_high;
                let comment = "";
                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                    if (this._shortConditions) {
                        comment = this.capitalizeFirstLetter(forecastData.condition.main);
                        if (this._translateCondition) {
                            comment = _(this.capitalizeFirstLetter(forecastData.condition.main));
                        }
                    }
                    else {
                        comment = this.capitalizeFirstLetter(forecastData.condition.description);
                        if (this._translateCondition) {
                            comment = _(this.capitalizeFirstLetter(forecastData.condition.description));
                        }
                    }
                }
                let dayName = "";
                if (this.weather.location.timeZone != null) {
                    this.log.Debug(forecastData.dateTime.toLocaleString("en-GB", { timeZone: this.weather.location.timeZone }));
                    dayName = _(forecastData.dateTime.toLocaleString("en-GB", { timeZone: this.weather.location.timeZone, weekday: "long" }));
                }
                else {
                    forecastData.dateTime.setMilliseconds(forecastData.dateTime.getMilliseconds() + (this.weather.location.tzOffset * 1000));
                    dayName = _(this.getDayName(forecastData.dateTime.getUTCDay()));
                }
                if (forecastData.dateTime) {
                    let now = new Date();
                    if (forecastData.dateTime.getDate() == now.getDate())
                        dayName = _("Today");
                    if (forecastData.dateTime.getDate() == new Date(now.setDate(now.getDate() + 1)).getDate())
                        dayName = _("Tomorrow");
                }
                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature + ' ' + '\u002F' + ' ' + second_temperature + ' ' + this.unitToUnicode();
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = forecastData.condition.icon;
            }
            return true;
        }
        catch (e) {
            this.log.Error("DisplayForecastError" + e);
            return false;
        }
    }
    ;
    wipeCurrentData() {
        this.weather.dateTime = null;
        this.weather.location.city = null;
        this.weather.location.country = null;
        this.weather.location.id = null;
        this.weather.location.timeZone = null;
        this.weather.location.tzOffset = null;
        this.weather.coord.lat = null;
        this.weather.coord.lon = null;
        this.weather.sunrise = null;
        this.weather.sunset = null;
        this.weather.wind.degree = null;
        this.weather.wind.speed = null;
        this.weather.main.temperature = null;
        this.weather.main.pressure = null;
        this.weather.main.humidity = null;
        this.weather.main.temp_max = null;
        this.weather.main.temp_min = null;
        this.weather.condition.id = null;
        this.weather.condition.main = null;
        this.weather.condition.description = null;
        this.weather.condition.icon = null;
        this.weather.cloudiness = null;
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
        this._currentWeather.set_child(new St.Label({ text: _('Loading current weather ...') }));
        this._futureWeather.set_child(new St.Label({ text: _('Loading future weather ...') }));
    }
    rebuild() {
        this.showLoadingUi();
        this.rebuildCurrentWeatherUi();
        this.rebuildFutureWeatherUi();
    }
    rebuildCurrentWeatherUi() {
        this.destroyCurrentWeather();
        this._currentWeatherIcon = new St.Icon({
            icon_type: this._icon_type,
            icon_size: 64,
            icon_name: APPLET_ICON,
            style_class: STYLE_ICON
        });
        this._currentWeatherSummary = new St.Label({
            text: _('Loading ...'),
            style_class: STYLE_SUMMARY
        });
        this._currentWeatherLocation = new St.Button({
            reactive: true,
            label: _('Refresh'),
        });
        this._currentWeatherLocation.style_class = STYLE_LOCATION_LINK;
        this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function () {
            if (this._currentWeatherLocation.url == null) {
                this.refreshWeather();
            }
            else {
                Gio.app_info_launch_default_for_uri(this._currentWeatherLocation.url, global.create_app_launch_context());
            }
        }));
        let bb = new St.BoxLayout({
            vertical: true,
            style_class: STYLE_SUMMARYBOX
        });
        bb.add_actor(this._currentWeatherLocation);
        bb.add_actor(this._currentWeatherSummary);
        let textOb = { text: ELLIPSIS };
        this._currentWeatherSunrise = new St.Label(textOb);
        this._currentWeatherSunset = new St.Label(textOb);
        let ab = new St.BoxLayout({
            style_class: STYLE_ASTRONOMY
        });
        ab.add_actor(this._currentWeatherSunrise);
        let ab_spacerlabel = new St.Label({ text: BLANK });
        ab.add_actor(ab_spacerlabel);
        ab.add_actor(this._currentWeatherSunset);
        let bb_spacerlabel = new St.Label({ text: BLANK });
        bb.add_actor(bb_spacerlabel);
        bb.add_actor(ab);
        this._currentWeatherTemperature = new St.Label(textOb);
        this._currentWeatherHumidity = new St.Label(textOb);
        this._currentWeatherPressure = new St.Label(textOb);
        this._currentWeatherWind = new St.Label(textOb);
        this._currentWeatherApiUnique = new St.Label({ text: '' });
        this._currentWeatherApiUniqueCap = new St.Label({ text: '' });
        let rb = new St.BoxLayout({
            style_class: STYLE_DATABOX
        });
        let rb_captions = new St.BoxLayout({
            vertical: true,
            style_class: STYLE_DATABOX_CAPTIONS
        });
        let rb_values = new St.BoxLayout({
            vertical: true,
            style_class: STYLE_DATABOX_VALUES
        });
        rb.add_actor(rb_captions);
        rb.add_actor(rb_values);
        rb_captions.add_actor(new St.Label({ text: _('Temperature:') }));
        rb_values.add_actor(this._currentWeatherTemperature);
        rb_captions.add_actor(new St.Label({ text: _('Humidity:') }));
        rb_values.add_actor(this._currentWeatherHumidity);
        rb_captions.add_actor(new St.Label({ text: _('Pressure:') }));
        rb_values.add_actor(this._currentWeatherPressure);
        rb_captions.add_actor(new St.Label({ text: _('Wind:') }));
        rb_values.add_actor(this._currentWeatherWind);
        rb_captions.add_actor(this._currentWeatherApiUniqueCap);
        rb_values.add_actor(this._currentWeatherApiUnique);
        let xb = new St.BoxLayout();
        xb.add_actor(bb);
        xb.add_actor(rb);
        let box = new St.BoxLayout({
            style_class: STYLE_ICONBOX
        });
        box.add_actor(this._currentWeatherIcon);
        box.add_actor(xb);
        this._currentWeather.set_child(box);
    }
    ;
    rebuildFutureWeatherUi() {
        this.destroyFutureWeather();
        this._forecast = [];
        this._forecastBox = new St.BoxLayout({ vertical: this._verticalOrientation });
        this._futureWeather.set_child(this._forecastBox);
        for (let i = 0; i < this._forecastDays; i++) {
            let forecastWeather = {
                Icon: new St.Icon,
                Day: new St.Label,
                Summary: new St.Label,
                Temperature: new St.Label,
            };
            forecastWeather.Icon = new St.Icon({
                icon_type: this._icon_type,
                icon_size: 48,
                icon_name: APPLET_ICON,
                style_class: STYLE_FORECAST_ICON
            });
            forecastWeather.Day = new St.Label({
                style_class: STYLE_FORECAST_DAY
            });
            forecastWeather.Summary = new St.Label({
                style_class: STYLE_FORECAST_SUMMARY
            });
            forecastWeather.Temperature = new St.Label({
                style_class: STYLE_FORECAST_TEMPERATURE
            });
            let by = new St.BoxLayout({
                vertical: true,
                style_class: STYLE_FORECAST_DATABOX
            });
            by.add_actor(forecastWeather.Day);
            by.add_actor(forecastWeather.Summary);
            by.add_actor(forecastWeather.Temperature);
            let bb = new St.BoxLayout({
                style_class: STYLE_FORECAST_BOX
            });
            bb.add_actor(forecastWeather.Icon);
            bb.add_actor(by);
            this._forecast[i] = forecastWeather;
            this._forecastBox.add_actor(bb);
        }
    }
    toLocaleFormat(date, format) {
        return Cinnamon.util_format_date(format, date.getTime());
    }
    ;
    noApiKey() {
        if (this._apiKey == undefined || this._apiKey == "") {
            return true;
        }
        return false;
    }
    ;
    capitalizeFirstLetter(description) {
        if ((description == undefined || description == null)) {
            return "";
        }
        return description.charAt(0).toUpperCase() + description.slice(1);
    }
    ;
    timeToUserUnits(timeStr) {
        let time = timeStr.split(':');
        if (time[0].charAt(0) == "0") {
            time[0] = time[0].substr(1);
        }
        if (this._show24Hours) {
            return time[0] + ":" + time[1];
        }
        else {
            if (parseInt(time[0]) > 12) {
                return (parseInt(time[0]) - 12) + ":" + time[1] + " pm";
            }
            else {
                return time[0] + ":" + time[1] + " am";
            }
        }
    }
    KPHtoMPS(speed) {
        return speed / WEATHER_CONV_KPH_IN_MPS;
    }
    ;
    MPStoUserUnits(mps) {
        switch (this._windSpeedUnit) {
            case this.WeatherWindSpeedUnits.MPH:
                return Math.round((mps * WEATHER_CONV_MPH_IN_MPS) * 10) / 10;
            case this.WeatherWindSpeedUnits.KPH:
                return Math.round((mps * WEATHER_CONV_KPH_IN_MPS) * 10) / 10;
            case this.WeatherWindSpeedUnits.MPS:
                return Math.round(mps * 10) / 10;
            case this.WeatherWindSpeedUnits.KNOTS:
                return Math.round(mps * WEATHER_CONV_KNOTS_IN_MPS);
        }
    }
    TempToUserUnits(kelvin) {
        if (this._temperatureUnit == this.WeatherUnits.CELSIUS) {
            return Math.round((kelvin - 273.15));
        }
        if (this._temperatureUnit == this.WeatherUnits.FAHRENHEIT) {
            return Math.round((9 / 5 * (kelvin - 273.15) + 32));
        }
    }
    CelsiusToKelvin(celsius) {
        return (celsius + 273.15);
    }
    FahrenheitToKelvin(fahr) {
        return ((fahr - 32) / 1.8 + 273.15);
    }
    ;
    MPHtoMPS(speed) {
        return speed * 0.44704;
    }
    PressToUserUnits(hpa) {
        switch (this._pressureUnit) {
            case WeatherPressureUnits.HPA:
                return hpa;
            case WeatherPressureUnits.AT:
                return Math.round((hpa * 0.001019716) * 1000) / 1000;
            case WeatherPressureUnits.ATM:
                return Math.round((hpa * 0.0009869233) * 1000) / 1000;
            case WeatherPressureUnits.INHG:
                return Math.round((hpa * 0.029529983071445) * 10) / 10;
            case WeatherPressureUnits.MMHG:
                return Math.round((hpa * 0.7500638));
            case WeatherPressureUnits.PA:
                return Math.round((hpa * 100));
            case WeatherPressureUnits.PSI:
                return Math.round((hpa * 0.01450377) * 100) / 100;
        }
    }
    ;
    isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
    isString(text) {
        if (typeof text == 'string' || text instanceof String) {
            return true;
        }
        return false;
    }
    isID(text) {
        if (text.length == 7 && this.isNumeric(text)) {
            return true;
        }
        return false;
    }
    ;
    isCoordinate(text) {
        if (/^-?\d{1,3}(?:\.\d*)?,-?\d{1,3}(?:\.\d*)?/.test(text)) {
            return true;
        }
        return false;
    }
    unitToUnicode() {
        return this._temperatureUnit == this.WeatherUnits.FAHRENHEIT ? '\u2109' : '\u2103';
    }
    weatherIconSafely(code, iconResolver) {
        let iconname = iconResolver(code);
        for (let i = 0; i < iconname.length; i++) {
            if (this.hasIcon(iconname[i]))
                return iconname[i];
        }
        return 'weather-severe-alert';
    }
    hasIcon(icon) {
        return Gtk.IconTheme.get_default().has_icon(icon + (this._icon_type == St.IconType.SYMBOLIC ? '-symbolic' : ''));
    }
    nonempty(str) {
        return (str != null && str.length > 0);
    }
    getDayName(dayNum) {
        let days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')];
        return days[dayNum];
    }
    compassDirection(deg) {
        let directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')];
        return directions[Math.round(deg / 45) % directions.length];
    }
    isLangSupported(lang, languages) {
        if (languages.indexOf(lang) != -1) {
            return true;
        }
        return false;
    }
    ;
}
const openWeatherMapConditionLibrary = [
    _("Thunderstorm with light rain"),
    _("Thunderstorm with rain"),
    _("Thunderstorm with heavy rain"),
    _("Light thunderstorm"),
    _("Thunderstorm"),
    _("Heavy thunderstorm"),
    _("Ragged thunderstorm"),
    _("Thunderstorm with light drizzle"),
    _("Thunderstorm with drizzle"),
    _("Thunderstorm with heavy drizzle"),
    _("Light intensity drizzle"),
    _("Drizzle"),
    _("Heavy intensity drizzle"),
    _("Light intensity drizzle rain"),
    _("Drizzle rain"),
    _("Heavy intensity drizzle rain"),
    _("Shower rain and drizzle"),
    _("Heavy shower rain and drizzle"),
    _("Shower drizzle"),
    _("Light rain"),
    _("Moderate rain"),
    _("Heavy intensity rain"),
    _("Very heavy rain"),
    _("Extreme rain"),
    _("Freezing rain"),
    _("Light intensity shower rain"),
    _("Shower rain"),
    _("Heavy intensity shower rain"),
    _("Ragged shower rain"),
    _("Light snow"),
    _("Snow"),
    _("Heavy snow"),
    _("Sleet"),
    _("Shower sleet"),
    _("Light rain and snow"),
    _("Rain and snow"),
    _("Light shower snow"),
    _("Shower snow"),
    _("Heavy shower snow"),
    _("Mist"),
    _("Smoke"),
    _("Haze"),
    _("Sand, dust whirls"),
    _("Fog"),
    _("Sand"),
    _("Dust"),
    _("Volcanic ash"),
    _("Squalls"),
    _("Tornado"),
    _("Clear"),
    _("Clear sky"),
    _("Sky is clear"),
    _("Few clouds"),
    _("Scattered clouds"),
    _("Broken clouds"),
    _("Overcast clouds")
];
const icons = {
    clear_day: 'weather-clear',
    clear_night: 'weather-clear-night',
    few_clouds_day: 'weather-few-clouds',
    few_clouds_night: 'weather-few-clouds-night',
    clouds: 'weather-clouds',
    overcast: 'weather_overcast',
    showers_scattered: 'weather-showers-scattered',
    showers: 'weather-showers',
    rain: 'weather-rain',
    rain_freezing: 'weather-freezing-rain',
    snow: 'weather-snow',
    storm: 'weather-storm',
    fog: 'weather-fog',
    alert: 'weather-severe-alert'
};
function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
