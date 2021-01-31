"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const ipApi_1 = require("./ipApi");
const utils_1 = require("./utils");
const logger_1 = require("./logger");
const consts_1 = require("./consts");
const locationstore_1 = require("./locationstore");
const nominatim_1 = require("./nominatim");
const { AppletSettings, BindingDirection } = imports.ui.settings;
const Lang = imports.lang;
const keybindingManager = imports.ui.main.keybindingManager;
const { IconType } = imports.gi.St;
const { get_language_names } = imports.gi.GLib;
const { Settings } = imports.gi.Gio;
const Keys = {
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
    SHOW_FORECAST_DATES: "showForecastDates",
    WEATHER_USE_SYMBOLIC_ICONS_KEY: 'useSymbolicIcons'
};
class Config {
    constructor(app, instanceID) {
        this.fahrenheitCountries = ["bs", "bz", "ky", "pr", "pw", "us"];
        this.windSpeedUnitLocales = {
            "fi kr no pl ru se": "m/s",
            "us gb": "mph"
        };
        this.distanceUnitLocales = {
            "us gb": "imperial"
        };
        this.WEATHER_LOCATION = "location";
        this.WEATHER_LOCATION_LIST = "locationList";
        this.doneTypingLocation = null;
        this.currentLocation = null;
        this.app = app;
        this.currentLocale = utils_1.ConstructJsLocale(get_language_names()[0]);
        logger_1.Log.Instance.Debug("System locale is " + this.currentLocale);
        this.autoLocProvider = new ipApi_1.IpApi(app);
        this.geoLocationService = new nominatim_1.GeoLocation(app);
        this.countryCode = this.GetCountryCode(this.currentLocale);
        this.settings = new AppletSettings(this, consts_1.UUID, instanceID);
        this.InterfaceSettings = new Settings({ schema: "org.cinnamon.desktop.interface" });
        this.InterfaceSettings.connect('changed::font-name', () => this.OnFontChanged());
        this.currentFontSize = this.GetCurrentFontSize();
        this.BindSettings();
        this.LocStore = new locationstore_1.LocationStore(this.app, this);
    }
    BindSettings() {
        let k;
        for (k in Keys) {
            let key = Keys[k];
            let keyProp = "_" + key;
            this.settings.bindProperty(BindingDirection.IN, key, keyProp, Lang.bind(this, this.OnSettingChanged), null);
        }
        this.settings.bindProperty(BindingDirection.BIDIRECTIONAL, this.WEATHER_LOCATION, ("_" + this.WEATHER_LOCATION), Lang.bind(this, this.OnLocationChanged), null);
        this.settings.bindProperty(BindingDirection.BIDIRECTIONAL, this.WEATHER_LOCATION_LIST, ("_" + this.WEATHER_LOCATION_LIST), Lang.bind(this, this.OnLocationStoreChanged), null);
        this.settings.bindProperty(BindingDirection.IN, "keybinding", "keybinding", Lang.bind(this, this.OnKeySettingsUpdated), null);
        keybindingManager.addHotKey(consts_1.UUID, this.keybinding, Lang.bind(this.app, this.app.on_applet_clicked));
    }
    get CurrentFontSize() {
        return this.currentFontSize;
    }
    get CurrentLocation() {
        return this.currentLocation;
    }
    get ApiKey() {
        return this._apiKey.replace(" ", "");
    }
    get Language() {
        return this.GetLanguage(this.currentLocale);
    }
    get TemperatureUnit() {
        if (this._temperatureUnit == "automatic")
            return this.GetLocaleTemperateUnit(this.countryCode);
        return this._temperatureUnit;
    }
    get WindSpeedUnit() {
        if (this._windSpeedUnit == "automatic")
            return this.GetLocaleWindSpeedUnit(this.countryCode);
        return this._windSpeedUnit;
    }
    get DistanceUnit() {
        if (this._distanceUnit == "automatic")
            return this.GetLocaleDistanceUnit(this.countryCode);
        return this._distanceUnit;
    }
    get IconType() {
        if (this._useCustomMenuIcons)
            return IconType.SYMBOLIC;
        return this._useSymbolicIcons ?
            IconType.SYMBOLIC :
            IconType.FULLCOLOR;
    }
    ;
    get AppletIconType() {
        if (this._useCustomAppletIcons)
            return IconType.SYMBOLIC;
        return this._useSymbolicIcons ?
            IconType.SYMBOLIC :
            IconType.FULLCOLOR;
    }
    SwitchToNextLocation() {
        let nextLoc = this.LocStore.GetNextLocation(this.CurrentLocation);
        if (nextLoc == null)
            return null;
        this.InjectLocationToConfig(nextLoc, true);
        return nextLoc;
    }
    SwitchToPreviousLocation() {
        let previousLoc = this.LocStore.GetPreviousLocation(this.CurrentLocation);
        if (previousLoc == null)
            return null;
        this.InjectLocationToConfig(previousLoc, true);
        return previousLoc;
    }
    NoApiKey() {
        var _a;
        let key = (_a = this._apiKey) === null || _a === void 0 ? void 0 : _a.replace(" ", "");
        return (!key || key == "");
    }
    ;
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
            this.app.ShowError({
                type: "hard",
                detail: "no location",
                userError: true,
                message: utils_1._("Make sure you entered a location or use Automatic location instead")
            });
            return null;
        }
        let location = this.LocStore.FindLocation(this._location);
        if (location != null) {
            logger_1.Log.Instance.Debug("location exist in locationstore, retrieve");
            this.LocStore.SwitchToLocation(location);
            this.InjectLocationToConfig(location, true);
            return location;
        }
        else if (utils_1.IsCoordinate(loc)) {
            loc = loc.replace(" ", "");
            let latLong = loc.split(",");
            let location = {
                lat: parseFloat(latLong[0]),
                lon: parseFloat(latLong[1]),
                city: null,
                country: null,
                timeZone: null,
                entryText: loc,
            };
            this.InjectLocationToConfig(location);
            return location;
        }
        logger_1.Log.Instance.Debug("Location is text, geolocating...");
        let locationData = await this.geoLocationService.GetLocation(loc);
        if (locationData == null)
            return null;
        if (!!(locationData === null || locationData === void 0 ? void 0 : locationData.entryText)) {
            logger_1.Log.Instance.Debug("Address found via address search");
        }
        location = this.LocStore.FindLocation(locationData.entryText);
        if (location != null) {
            logger_1.Log.Instance.Debug("Found location was found in locationStore, return that instead");
            this.InjectLocationToConfig(location);
            this.LocStore.SwitchToLocation(location);
            return location;
        }
        else {
            this.InjectLocationToConfig(locationData);
            return locationData;
        }
    }
    InjectLocationToConfig(loc, switchToManual = false) {
        logger_1.Log.Instance.Debug("Location setting is now: " + loc.entryText);
        let text = (loc.entryText + "");
        this.SetLocation(text);
        this.currentLocation = loc;
        if (switchToManual == true)
            this.settings.setValue(Keys.MANUAL_LOCATION, true);
    }
    OnKeySettingsUpdated() {
        if (this.keybinding != null) {
            keybindingManager.addHotKey(consts_1.UUID, this.keybinding, Lang.bind(this.app, this.app.on_applet_clicked));
        }
    }
    OnLocationChanged() {
        logger_1.Log.Instance.Debug("User changed location, waiting 3 seconds...");
        if (this.doneTypingLocation != null)
            utils_1.clearTimeout(this.doneTypingLocation);
        this.doneTypingLocation = utils_1.setTimeout(Lang.bind(this, this.DoneTypingLocation), 3000);
    }
    OnLocationStoreChanged() {
        this.LocStore.OnLocationChanged(this._locationList);
    }
    OnFontChanged() {
        this.currentFontSize = this.GetCurrentFontSize();
        this.app.RefreshAndRebuild();
    }
    DoneTypingLocation() {
        logger_1.Log.Instance.Debug("User has finished typing, beginning refresh");
        this.doneTypingLocation = null;
        this.app.RefreshAndRebuild();
    }
    OnSettingChanged() {
        this.app.RefreshAndRebuild();
    }
    SetLocation(value) {
        this.settings.setValue(this.WEATHER_LOCATION, value);
    }
    SetLocationList(list) {
        this.settings.setValue(this.WEATHER_LOCATION_LIST, list);
    }
    GetLocaleTemperateUnit(code) {
        if (code == null || !this.fahrenheitCountries.includes(code))
            return "celsius";
        return "fahrenheit";
    }
    GetLocaleWindSpeedUnit(code) {
        if (code == null)
            return "kph";
        for (const key in this.windSpeedUnitLocales) {
            if (key.includes(code))
                return this.windSpeedUnitLocales[key];
        }
        return "kph";
    }
    GetLocaleDistanceUnit(code) {
        if (code == null)
            return "metric";
        for (const key in this.distanceUnitLocales) {
            if (key.includes(code))
                return this.distanceUnitLocales[key];
        }
        return "metric";
    }
    GetCountryCode(locale) {
        let split = locale.split("-");
        if (split.length < 2)
            return null;
        return split[1];
    }
    GetLanguage(locale) {
        let split = locale.split("-");
        if (split.length < 1)
            return null;
        return split[0];
    }
    GetCurrentFontSize() {
        let nameString = this.InterfaceSettings.get_string("font-name");
        let elements = nameString.split(" ");
        let size = parseFloat(elements[elements.length - 1]);
        logger_1.Log.Instance.Debug("Font size changed to " + size.toString());
        return size;
    }
}
exports.Config = Config;
