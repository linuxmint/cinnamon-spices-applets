"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentWeather = void 0;
const consts_1 = require("./consts");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const weatherbutton_1 = require("./weatherbutton");
const { Bin, BoxLayout, IconType, Label, Icon, Align } = imports.gi.St;
const Lang = imports.lang;
const STYLE_SUMMARYBOX = 'weather-current-summarybox';
const STYLE_SUMMARY = 'weather-current-summary';
const STYLE_DATABOX = 'weather-current-databox';
const STYLE_ICON = 'weather-current-icon';
const STYLE_ICONBOX = 'weather-current-iconbox';
const STYLE_DATABOX_CAPTIONS = 'weather-current-databox-captions';
const STYLE_ASTRONOMY = 'weather-current-astronomy';
const STYLE_DATABOX_VALUES = 'weather-current-databox-values';
const STYLE_CURRENT = 'current';
const STYLE_LOCATION_SELECTOR = 'location-selector';
class CurrentWeather {
    constructor(app, ui) {
        this.app = app;
        this.actor = new Bin();
        this.actor.style_class = STYLE_CURRENT;
        this.app.config.LocStore.StoreChanged.Subscribe((s, a) => this.onLocationStorageChanged(s, a));
    }
    Display(weather, config) {
        try {
            if (this.app.config.LocStore.ShouldShowLocationSelectors(config.CurrentLocation))
                this.ShowLocationSelectors();
            else
                this.HideLocationSelectors();
            let location = this.GenerateLocationText(weather);
            this.app.SetAppletTooltip(location + " - " + utils_1._("As of") + " " + utils_1.AwareDateString(weather.date, this.app.config.currentLocale, config._show24Hours));
            this.app.DisplayWeatherOnLabel(weather.temperature, weather.condition.description);
            this.app.SetAppletIcon(weather.condition.icon, weather.condition.customIcon);
            this.SetLocation(location, weather.location.url);
            this.SetConditionText(weather.condition.description);
            this.SetWeatherIcon(weather.condition.icon, weather.condition.customIcon);
            this.SetTemperature(weather.temperature);
            this.SetHumidity(weather.humidity);
            this.SetWind(weather.wind.speed, weather.wind.degree);
            this.SetPressure(weather.pressure);
            this.SetAPIUniqueField(weather.extra_field);
            this.SetSunriseAndSunset(weather.sunrise, weather.sunset, weather.location.timeZone);
            return true;
        }
        catch (e) {
            logger_1.Log.Instance.Error("DisplayWeatherError: " + e);
            return false;
        }
    }
    ;
    ChangeIconType(iconType) {
        this._currentWeatherIcon.icon_type = iconType;
    }
    Destroy() {
        if (this.actor.get_child() != null)
            this.actor.get_child().destroy();
    }
    Rebuild(config, textColorStyle) {
        this.Destroy();
        let textOb = {
            text: consts_1.ELLIPSIS
        };
        this._currentWeatherIcon = new Icon({
            icon_type: config.IconType,
            icon_size: 64,
            icon_name: consts_1.APPLET_ICON,
            style_class: STYLE_ICON
        });
        this._locationButton = new weatherbutton_1.WeatherButton({ reactive: true, label: utils_1._('Refresh'), });
        this._currentWeatherLocation = this._locationButton.actor;
        this._currentWeatherLocation.connect(consts_1.SIGNAL_CLICKED, () => {
            if (this.app.encounteredError)
                this.app.RefreshWeather(true);
            else if (this._currentWeatherLocation.url == null)
                return;
            else
                this.app.OpenUrl(this._currentWeatherLocation);
        });
        this._nextLocationButton = new weatherbutton_1.WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: 10,
                icon_name: "custom-right-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this._nextLocationButton.actor.connect(consts_1.SIGNAL_CLICKED, Lang.bind(this, this.NextLocationClicked));
        this._previousLocationButton = new weatherbutton_1.WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: 10,
                icon_name: "custom-left-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this._previousLocationButton.actor.connect(consts_1.SIGNAL_CLICKED, Lang.bind(this, this.PreviousLocationClicked));
        this._locationBox = new BoxLayout();
        this._locationBox.add(this._previousLocationButton.actor, { x_fill: false, x_align: Align.START, y_align: Align.MIDDLE, expand: false });
        this._locationBox.add(this._currentWeatherLocation, { x_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: true });
        this._locationBox.add(this._nextLocationButton.actor, { x_fill: false, x_align: Align.END, y_align: Align.MIDDLE, expand: false });
        this._currentWeatherSummary = new Label({ text: utils_1._('Loading ...'), style_class: STYLE_SUMMARY });
        this._currentWeatherSunrise = new Label({ text: consts_1.ELLIPSIS, style: textColorStyle });
        this._currentWeatherSunset = new Label({ text: consts_1.ELLIPSIS, style: textColorStyle });
        let sunriseBox = new BoxLayout();
        let sunsetBox = new BoxLayout();
        if (config._showSunrise) {
            let sunsetIcon = new Icon({
                icon_name: "sunset-symbolic",
                icon_type: IconType.SYMBOLIC,
                icon_size: 25,
                style: textColorStyle
            });
            let sunriseIcon = new Icon({
                icon_name: "sunrise-symbolic",
                icon_type: IconType.SYMBOLIC,
                icon_size: 25,
                style: textColorStyle
            });
            sunriseBox.add_actor(sunriseIcon);
            sunsetBox.add_actor(sunsetIcon);
        }
        let textOptions = {
            x_fill: false,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        };
        sunriseBox.add(this._currentWeatherSunrise, textOptions);
        sunsetBox.add(this._currentWeatherSunset, textOptions);
        let ab_spacerLabel = new Label({ text: consts_1.BLANK });
        let sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY });
        sunBox.add_actor(sunriseBox);
        sunBox.add_actor(ab_spacerLabel);
        sunBox.add_actor(sunsetBox);
        let middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX });
        middleColumn.add_actor(this._locationBox);
        middleColumn.add(this._currentWeatherSummary, { expand: true, x_align: Align.START, y_align: Align.MIDDLE, x_fill: false, y_fill: false });
        let sunBin = new Bin();
        sunBin.set_child(sunBox);
        middleColumn.add_actor(sunBin);
        this._currentWeatherTemperature = new Label(textOb);
        this._currentWeatherHumidity = new Label(textOb);
        this._currentWeatherPressure = new Label(textOb);
        this._currentWeatherWind = new Label(textOb);
        this._currentWeatherApiUnique = new Label({ text: '' });
        this._currentWeatherApiUniqueCap = new Label({ text: '', style: textColorStyle });
        let rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS });
        let rb_values = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_VALUES });
        rb_captions.add_actor(new Label({ text: utils_1._('Temperature') + ":", style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: utils_1._('Humidity') + ":", style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: utils_1._('Pressure') + ":", style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: utils_1._('Wind') + ":", style: textColorStyle }));
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
        this.actor.set_child(box);
    }
    ;
    SetSunriseAndSunset(sunrise, sunset, tz) {
        let sunriseText = "";
        let sunsetText = "";
        if (sunrise != null && sunset != null && this.app.config._showSunrise) {
            sunriseText = (utils_1.GetHoursMinutes(sunrise, this.app.config.currentLocale, this.app.config._show24Hours, tz));
            sunsetText = (utils_1.GetHoursMinutes(sunset, this.app.config.currentLocale, this.app.config._show24Hours, tz));
        }
        this._currentWeatherSunrise.text = sunriseText;
        this._currentWeatherSunset.text = sunsetText;
    }
    SetAPIUniqueField(extra_field) {
        this._currentWeatherApiUnique.text = "";
        this._currentWeatherApiUniqueCap.text = "";
        if (!!extra_field) {
            this._currentWeatherApiUniqueCap.text = utils_1._(extra_field.name) + ":";
            let value;
            switch (extra_field.type) {
                case "percent":
                    value = extra_field.value.toString() + "%";
                    break;
                case "temperature":
                    value = utils_1.TempToUserConfig(extra_field.value, this.app.config.TemperatureUnit, this.app.config._tempRussianStyle) + " " + utils_1.UnitToUnicode(this.app.config.TemperatureUnit);
                    break;
                default:
                    value = utils_1._(extra_field.value);
                    break;
            }
            this._currentWeatherApiUnique.text = value;
        }
    }
    SetWeatherIcon(iconName, customIconName) {
        if (this.app.config._useCustomMenuIcons) {
            this._currentWeatherIcon.icon_name = customIconName;
            this.ChangeIconType(IconType.SYMBOLIC);
        }
        else {
            if (iconName == null) {
                iconName = "weather-severe-alert";
            }
            this._currentWeatherIcon.icon_name = iconName;
            this.ChangeIconType(this.app.config.IconType);
        }
    }
    SetConditionText(condition) {
        this._currentWeatherSummary.text = condition;
    }
    SetTemperature(temperature) {
        let temp = utils_1.TempToUserConfig(temperature, this.app.config.TemperatureUnit, this.app.config._tempRussianStyle);
        if (temp == null)
            return;
        this._currentWeatherTemperature.text = temp + " " + utils_1.UnitToUnicode(this.app.config.TemperatureUnit);
    }
    SetHumidity(humidity) {
        if (humidity != null) {
            this._currentWeatherHumidity.text = Math.round(humidity) + "%";
        }
    }
    SetWind(windSpeed, windDegree) {
        let wind_direction = utils_1.compassDirection(windDegree);
        this._currentWeatherWind.text =
            (wind_direction != undefined ? utils_1._(wind_direction) + " " : "") +
                utils_1.MPStoUserUnits(windSpeed, this.app.config.WindSpeedUnit);
        if (this.app.config.WindSpeedUnit != "Beaufort")
            this._currentWeatherWind.text += " " + utils_1._(this.app.config.WindSpeedUnit);
    }
    SetPressure(pressure) {
        if (pressure != null) {
            this._currentWeatherPressure.text = utils_1.PressToUserUnits(pressure, this.app.config._pressureUnit) + ' ' + utils_1._(this.app.config._pressureUnit);
        }
    }
    SetLocation(locationString, url) {
        this._currentWeatherLocation.label = locationString;
        this._currentWeatherLocation.url = url;
        if (!url)
            this._locationButton.disable();
    }
    NextLocationClicked() {
        let loc = this.app.config.SwitchToNextLocation();
        this.app.RefreshAndRebuild(loc);
    }
    PreviousLocationClicked() {
        let loc = this.app.config.SwitchToPreviousLocation();
        this.app.RefreshAndRebuild(loc);
    }
    onLocationStorageChanged(sender, itemCount) {
        logger_1.Log.Instance.Debug("On location storage callback called, number of locations now " + itemCount.toString());
        if (this.app.config.LocStore.ShouldShowLocationSelectors(this.app.config.CurrentLocation))
            this.ShowLocationSelectors();
        else
            this.HideLocationSelectors();
    }
    GenerateLocationText(weather) {
        let location = "";
        if (weather.location.city != null && weather.location.country != null) {
            location = weather.location.city + ", " + weather.location.country;
        }
        else {
            location = Math.round(weather.coord.lat * 10000) / 10000 + ", " + Math.round(weather.coord.lon * 10000) / 10000;
        }
        if (utils_1.nonempty(this.app.config._locationLabelOverride)) {
            location = this.app.config._locationLabelOverride;
        }
        return location;
    }
    ShowLocationSelectors() {
        this._nextLocationButton.actor.show();
        this._previousLocationButton.actor.show();
    }
    HideLocationSelectors() {
        this._nextLocationButton.actor.hide();
        this._previousLocationButton.actor.hide();
    }
}
exports.CurrentWeather = CurrentWeather;
