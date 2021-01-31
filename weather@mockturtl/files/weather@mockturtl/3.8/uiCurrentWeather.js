"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentWeather = void 0;
const commandRunner_1 = require("./commandRunner");
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
    constructor(app) {
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
            let location = utils_1.GenerateLocationText(weather, config);
            this.SetLocation(location, weather.location.url);
            this.SetConditionText(weather.condition.description);
            this.SetWeatherIcon(weather.condition.icons, weather.condition.customIcon);
            this.SetTemperature(weather.temperature);
            this.SetHumidity(weather.humidity);
            this.SetWind(weather.wind.speed, weather.wind.degree);
            this.SetPressure(weather.pressure);
            this.SetAPIUniqueField(weather.extra_field);
            if (config._showSunrise)
                this.SetSunriseAndSunset(weather.sunrise, weather.sunset, weather.location.timeZone);
            return true;
        }
        catch (e) {
            logger_1.Log.Instance.Error("DisplayWeatherError: " + e);
            return false;
        }
    }
    ;
    UpdateIconType(iconType) {
        this.weatherIcon.icon_type = iconType;
    }
    Destroy() {
        if (this.actor.get_child() != null)
            this.actor.get_child().destroy();
    }
    Rebuild(config, textColorStyle) {
        this.Destroy();
        this.weatherIcon = new Icon({
            icon_type: config.IconType,
            icon_size: 64,
            icon_name: consts_1.APPLET_ICON,
            style_class: STYLE_ICON
        });
        let box = new BoxLayout({ style_class: STYLE_ICONBOX });
        box.add_actor(this.weatherIcon);
        box.add_actor(this.BuildMiddleColumn(config, textColorStyle));
        box.add_actor(this.BuildRightColumn(textColorStyle, config));
        this.actor.set_child(box);
    }
    ;
    BuildMiddleColumn(config, textColorStyle) {
        this.weatherSummary = new Label({ text: utils_1._('Loading ...'), style_class: STYLE_SUMMARY });
        let middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX });
        middleColumn.add_actor(this.BuildLocationSection());
        middleColumn.add(this.weatherSummary, { expand: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, x_fill: false, y_fill: false });
        if (config._showSunrise)
            middleColumn.add_actor(this.BuildSunBox(config, textColorStyle));
        return middleColumn;
    }
    BuildRightColumn(textColorStyle, config) {
        let textOb = {
            text: consts_1.ELLIPSIS
        };
        this.temperatureLabel = new Label(textOb);
        this.humidityLabel = new Label(textOb);
        this.pressureLabel = new Label(textOb);
        this.apiUniqueLabel = new Label({ text: '' });
        this.apiUniqueCaptionLabel = new Label({ text: '', style: textColorStyle });
        let rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS });
        let rb_values = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_VALUES });
        rb_captions.add_actor(new Label({ text: utils_1._('Temperature') + ":", style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: utils_1._('Humidity') + ":", style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: utils_1._('Pressure') + ":", style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: utils_1._('Wind') + ":", style: textColorStyle }));
        rb_captions.add_actor(this.apiUniqueCaptionLabel);
        rb_values.add_actor(this.temperatureLabel);
        rb_values.add_actor(this.humidityLabel);
        rb_values.add_actor(this.pressureLabel);
        rb_values.add_actor(this.BuildWind(config));
        rb_values.add_actor(this.apiUniqueLabel);
        let rightColumn = new BoxLayout({ style_class: STYLE_DATABOX });
        rightColumn.add_actor(rb_captions);
        rightColumn.add_actor(rb_values);
        return rightColumn;
    }
    BuildWind(config) {
        let windBox = new BoxLayout({ vertical: false });
        let iconPaddingBottom = Math.round(config.CurrentFontSize * 0.05);
        let iconPaddingTop = Math.round(config.CurrentFontSize * 0.15);
        let iconSize = Math.round(config.CurrentFontSize * 0.8);
        this.windLabel = new Label({ text: consts_1.ELLIPSIS });
        this.windDirectionIcon = new Icon({
            icon_type: IconType.SYMBOLIC,
            icon_name: consts_1.APPLET_ICON,
            icon_size: iconSize,
            style: "padding-right: 5px; padding-top: " + iconPaddingTop + "px; padding-bottom: " + iconPaddingBottom + "px;"
        });
        windBox.add(this.windDirectionIcon, { x_fill: false, y_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: false });
        windBox.add(this.windLabel);
        return windBox;
    }
    BuildLocationSection() {
        this.locationButton = new weatherbutton_1.WeatherButton({ reactive: true, label: utils_1._('Refresh'), });
        this.location = this.locationButton.actor;
        this.location.connect(consts_1.SIGNAL_CLICKED, () => {
            if (this.app.encounteredError)
                this.app.RefreshWeather(true);
            else if (this.location.url == null)
                return;
            else
                commandRunner_1.OpenUrl(this.location);
        });
        this.nextLocationButton = new weatherbutton_1.WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: this.app.config.CurrentFontSize,
                icon_name: "custom-right-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this.nextLocationButton.actor.connect(consts_1.SIGNAL_CLICKED, Lang.bind(this, this.NextLocationClicked));
        this.previousLocationButton = new weatherbutton_1.WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: this.app.config.CurrentFontSize,
                icon_name: "custom-left-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this.previousLocationButton.actor.connect(consts_1.SIGNAL_CLICKED, Lang.bind(this, this.PreviousLocationClicked));
        let box = new BoxLayout();
        box.add(this.previousLocationButton.actor, { x_fill: false, x_align: Align.START, y_align: Align.MIDDLE, expand: false });
        box.add(this.location, { x_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: true });
        box.add(this.nextLocationButton.actor, { x_fill: false, x_align: Align.END, y_align: Align.MIDDLE, expand: false });
        return box;
    }
    BuildSunBox(config, textColorStyle) {
        let sunBin = new Bin();
        this.sunriseLabel = new Label({ text: consts_1.ELLIPSIS, style: textColorStyle });
        this.sunsetLabel = new Label({ text: consts_1.ELLIPSIS, style: textColorStyle });
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
        sunriseBox.add(this.sunriseLabel, textOptions);
        sunsetBox.add(this.sunsetLabel, textOptions);
        let ab_spacerLabel = new Label({ text: consts_1.BLANK });
        let sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY });
        sunBox.add_actor(sunriseBox);
        sunBox.add_actor(ab_spacerLabel);
        sunBox.add_actor(sunsetBox);
        sunBin.set_child(sunBox);
        return sunBin;
    }
    SetSunriseAndSunset(sunrise, sunset, tz) {
        let sunriseText = "";
        let sunsetText = "";
        if (sunrise != null && sunset != null && this.app.config._showSunrise) {
            sunriseText = (utils_1.GetHoursMinutes(sunrise, this.app.config.currentLocale, this.app.config._show24Hours, tz));
            sunsetText = (utils_1.GetHoursMinutes(sunset, this.app.config.currentLocale, this.app.config._show24Hours, tz));
        }
        this.sunriseLabel.text = sunriseText;
        this.sunsetLabel.text = sunsetText;
    }
    SetAPIUniqueField(extra_field) {
        this.apiUniqueLabel.text = "";
        this.apiUniqueCaptionLabel.text = "";
        if (!!extra_field) {
            this.apiUniqueCaptionLabel.text = utils_1._(extra_field.name) + ":";
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
            this.apiUniqueLabel.text = value;
        }
    }
    SetWeatherIcon(iconNames, customIconName) {
        if (this.app.config._useCustomMenuIcons) {
            this.weatherIcon.icon_name = customIconName;
            this.UpdateIconType(IconType.SYMBOLIC);
        }
        else {
            let icon = utils_1.WeatherIconSafely(iconNames, this.app.config.IconType);
            this.weatherIcon.icon_name = icon;
            this.UpdateIconType(this.app.config.IconType);
        }
    }
    SetConditionText(condition) {
        this.weatherSummary.text = condition;
    }
    SetTemperature(temperature) {
        let temp = utils_1.TempToUserConfig(temperature, this.app.config.TemperatureUnit, this.app.config._tempRussianStyle);
        if (temp == null)
            return;
        this.temperatureLabel.text = temp + " " + utils_1.UnitToUnicode(this.app.config.TemperatureUnit);
    }
    SetHumidity(humidity) {
        if (humidity != null) {
            this.humidityLabel.text = Math.round(humidity) + "%";
        }
    }
    async SetWind(windSpeed, windDegree) {
        let wind_direction = utils_1.CompassDirection(windDegree);
        this.windDirectionIcon.icon_name = wind_direction;
        this.windLabel.text = utils_1.MPStoUserUnits(windSpeed, this.app.config.WindSpeedUnit);
        if (this.app.config.WindSpeedUnit != "Beaufort")
            this.windLabel.text += " " + utils_1._(this.app.config.WindSpeedUnit);
    }
    SetPressure(pressure) {
        if (pressure != null) {
            this.pressureLabel.text = utils_1.PressToUserUnits(pressure, this.app.config._pressureUnit) + ' ' + utils_1._(this.app.config._pressureUnit);
        }
    }
    SetLocation(locationString, url) {
        this.location.label = locationString;
        this.location.url = url;
        if (!url)
            this.locationButton.disable();
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
    ShowLocationSelectors() {
        this.nextLocationButton.actor.show();
        this.previousLocationButton.actor.show();
    }
    HideLocationSelectors() {
        this.nextLocationButton.actor.hide();
        this.previousLocationButton.actor.hide();
    }
}
exports.CurrentWeather = CurrentWeather;
