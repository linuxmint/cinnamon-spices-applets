"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const ipApi_1 = require("./ipApi");
const utils_1 = require("./utils");
const { AppletSettings, BindingDirection } = imports.ui.settings;
const Lang = imports.lang;
const keybindingManager = imports.ui.main.keybindingManager;
const UUID = "weather@mockturtl";
const { IconType } = imports.gi.St;
const SIGNAL_CHANGED = 'changed::';
class Config {
    constructor(app, instanceID, locale) {
        this.fahrenheitCountries = ["bs", "bz", "ky", "pr", "pw", "us"];
        this.windSpeedUnitLocales = {
            "fi kr no pl ru se": "m/s",
            "us gb": "mph"
        };
        this.distanceUnitLocales = {
            "us gb": "imperial"
        };
        this.WEATHER_LOCATION = "location";
        this.WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons';
        this.KEYS = {
            DATA_SERVICE: "dataService",
            API_KEY: "apiKey",
            TEMPERATURE_UNIT_KEY: "temperatureUnit",
            TEMPERATURE_HIGH_FIRST: "temperatureHighFirst",
            WIND_SPEED_UNIT: "windSpeedUnit",
            DISTANCE_UNIT: "distanceUnit",
            CITY: "locationLabelOverride",
            TRANSLATE_CONDITION: "translateCondition",
            VERTICAL_ORIENTATION: "verticalOrientation",
            SHOW_TEXT_IN_PANEL: "showTextInPanel",
            TEMP_TEXT_OVERRIDE: "tempTextOverride",
            SHOW_COMMENT_IN_PANEL: "showCommentInPanel",
            SHOW_SUNRISE: "showSunrise",
            SHOW_24HOURS: "show24Hours",
            FORECAST_DAYS: "forecastDays",
            FORECAST_HOURS: "forecastHours",
            FORECAST_COLS: "forecastColumns",
            FORECAST_ROWS: "forecastRows",
            REFRESH_INTERVAL: "refreshInterval",
            PRESSURE_UNIT: "pressureUnit",
            SHORT_CONDITIONS: "shortConditions",
            MANUAL_LOCATION: "manualLocation",
            USE_CUSTOM_APPLETICONS: 'useCustomAppletIcons',
            USE_CUSTOM_MENUICONS: "useCustomMenuIcons",
            RUSSIAN_STYLE: "tempRussianStyle",
            SHORT_HOURLY_TIME: "shortHourlyTime",
            SHOW_FORECAST_DATES: "showForecastDates"
        };
        this.doneTypingLocation = null;
        this.currentLocation = null;
        this.app = app;
        this.autoLocProvider = new ipApi_1.IpApi(app);
        this.countryCode = this.GetCountryCode(locale);
        this.settings = new AppletSettings(this, UUID, instanceID);
        this.BindSettings();
    }
    BindSettings() {
        for (let k in this.KEYS) {
            let key = this.KEYS[k];
            let keyProp = "_" + key;
            this.settings.bindProperty(BindingDirection.IN, key, keyProp, Lang.bind(this, this.OnSettingChanged), null);
        }
        this.settings.bindProperty(BindingDirection.BIDIRECTIONAL, this.WEATHER_LOCATION, ("_" + this.WEATHER_LOCATION), Lang.bind(this, this.OnLocationChanged), null);
        this.settings.bindProperty(BindingDirection.IN, "keybinding", "keybinding", Lang.bind(this.app, this.app._onKeySettingsUpdated), null);
        keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this.app, this.app.on_applet_clicked));
        this.settings.connect(SIGNAL_CHANGED + this.WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, this.IconTypeChanged));
    }
    IconTypeChanged() {
        this.app.ui.UpdateIconType(this.IconType());
        this.app.log.Debug("Symbolic icon setting changed");
    }
    TemperatureUnit() {
        if (this._temperatureUnit == "automatic")
            return this.GetLocaleTemperateUnit(this.countryCode);
        return this._temperatureUnit;
    }
    WindSpeedUnit() {
        if (this._windSpeedUnit == "automatic")
            return this.GetLocaleWindSpeedUnit(this.countryCode);
        return this._windSpeedUnit;
    }
    DistanceUnit() {
        if (this._distanceUnit == "automatic")
            return this.GetLocaleDistanceUnit(this.countryCode);
        return this._distanceUnit;
    }
    IconType() {
        return this.settings.getValue(this.WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
            IconType.SYMBOLIC :
            IconType.FULLCOLOR;
    }
    ;
    OnLocationChanged() {
        this.app.log.Debug("User changed location, waiting 3 seconds...");
        if (this.doneTypingLocation != null)
            utils_1.clearTimeout(this.doneTypingLocation);
        this.doneTypingLocation = utils_1.setTimeout(Lang.bind(this, this.DoneTypingLocation), 3000);
    }
    DoneTypingLocation() {
        this.app.log.Debug("User has finished typing, beginning refresh");
        this.doneTypingLocation = null;
        this.app.refreshAndRebuild();
    }
    OnSettingChanged() {
        this.app.refreshAndRebuild();
    }
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
    InjectLocationToConfig(loc, switchToManual = false) {
        this.app.log.Debug("Location setting is now: " + loc.entryText);
        let text = loc.entryText + "";
        this.SetLocation(text);
        this.currentLocation = loc;
        if (switchToManual == true)
            this.settings.setValue(this.KEYS.MANUAL_LOCATION, true);
    }
    async EnsureLocation() {
        this.currentLocation = null;
        if (!this._manualLocation) {
            let location = await this.autoLocProvider.GetLocation();
            if (!location)
                return null;
            this.InjectLocationToConfig(location);
            return location;
        }
        let loc = this._location;
        if (loc == undefined || loc.trim() == "") {
            this.app.HandleError({
                type: "hard",
                detail: "no location",
                userError: true,
                message: utils_1._("Make sure you entered a location or use Automatic location instead")
            });
            return null;
        }
        if (utils_1.isCoordinate(loc)) {
            loc = loc.replace(" ", "");
            let latlong = loc.split(",");
            let location = {
                lat: parseFloat(latlong[0]),
                lon: parseFloat(latlong[1]),
                city: null,
                country: null,
                mobile: null,
                timeZone: null,
                entryText: loc,
                locationSource: "manual"
            };
            this.InjectLocationToConfig(location);
            return location;
        }
        this.app.log.Debug("Location is text, geolocating...");
        let locationData = await this.app.geoLocationService.GetLocation(loc);
        if (locationData == null)
            return null;
        if (!!locationData.address_string) {
            this.app.log.Debug("Address found via address search, placing found full address '" + locationData.address_string + "' back to location entry");
        }
        this.InjectLocationToConfig(locationData);
        return locationData;
    }
    GetLocaleTemperateUnit(code) {
        if (code == null || this.fahrenheitCountries.indexOf(code) == -1)
            return "celsius";
        return "fahrenheit";
    }
    GetLocaleWindSpeedUnit(code) {
        if (code == null)
            return "kph";
        for (const key in this.windSpeedUnitLocales) {
            if (key.indexOf(code) != -1)
                return this.windSpeedUnitLocales[key];
        }
        return "kph";
    }
    GetLocaleDistanceUnit(code) {
        if (code == null)
            return "metric";
        for (const key in this.distanceUnitLocales) {
            if (key.indexOf(code) != -1)
                return this.distanceUnitLocales[key];
        }
        return "metric";
    }
    GetCountryCode(locale) {
        let splitted = locale.split("-");
        if (splitted.length < 2)
            return null;
        return splitted[1];
    }
}
exports.Config = Config;
