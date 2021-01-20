"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UI = void 0;
const consts_1 = require("./consts");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const weatherbutton_1 = require("./weatherbutton");
const { PopupMenuManager, PopupSeparatorMenuItem } = imports.ui.popupMenu;
const { Bin, BoxLayout, Side, IconType, Label, ScrollView, Icon, Align, Widget } = imports.gi.St;
const { PolicyType } = imports.gi.Gtk;
const { addTween } = imports.ui.tweener;
const Lang = imports.lang;
const { GridLayout } = imports.gi.Clutter;
const { AppletPopupMenu } = imports.ui.applet;
const { themeManager } = imports.ui.main;
const { SignalManager } = imports.misc.signalManager;
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
const STYLE_DATABOX_VALUES = 'weather-current-databox-values';
const STYLE_FORECAST_SUMMARY = 'weather-forecast-summary';
const STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature';
const STYLE_FORECAST_BOX = 'weather-forecast-box';
const STYLE_FORECAST_CONTAINER = 'weather-forecast-container';
const STYLE_CURRENT = 'current';
const STYLE_FORECAST = 'forecast';
const STYLE_WEATHER_MENU = 'weather-menu';
const STYLE_BAR = 'bottombar';
const STYLE_LOCATION_SELECTOR = 'location-selector';
class UI {
    constructor(app, orientation) {
        this.hourlyToggled = false;
        this.lightTheme = false;
        this.App = app;
        this.menuManager = new PopupMenuManager(this.App);
        this.menu = new AppletPopupMenu(this.App, orientation);
        this.menu.box.add_style_class_name(STYLE_WEATHER_MENU);
        logger_1.Log.Instance.Debug("Popup Menu applied classes are: " + this.menu.box.get_style_class_name());
        this.menuManager.addMenu(this.menu);
        this.menuManager._signals.connect(this.menu, "open-state-changed", this.PopupMenuToggled, this);
        this.signals = new SignalManager();
        this.lightTheme = this.IsLightTheme();
        this.BuildPopupMenu();
        this.signals.connect(themeManager, 'theme-set', this.OnThemeChanged, this);
        this.App.config.locationStore.StoreChanged.Subscribe(Lang.bind(this, this.onLocationStorageChanged));
    }
    OnThemeChanged() {
        this.HideHourlyWeather();
        let newThemeIsLight = this.IsLightTheme();
        if (newThemeIsLight != this.lightTheme) {
            this.lightTheme = newThemeIsLight;
        }
        this.App.refreshAndRebuild();
    }
    IsLightTheme() {
        let color = this.menu.actor.get_theme_node().get_color("color");
        let luminance = (2126 * color.red + 7152 * color.green + 722 * color.blue) / 10000 / 255;
        luminance = Math.abs(1 - luminance);
        logger_1.Log.Instance.Debug("Theme is Light: " + (luminance > 0.5));
        return (luminance > 0.5);
    }
    ForegroundColor() {
        let hex = this.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
        return hex;
    }
    GetTextColorStyle() {
        let hexColor = null;
        if (this.lightTheme) {
            hexColor = utils_1.shadeHexColor(this.ForegroundColor(), -0.40);
        }
        return "color: " + hexColor;
    }
    async PopupMenuToggled(caller, data) {
        if (data == false) {
            await utils_1.delay(100);
            this.HideHourlyWeather();
        }
    }
    onLocationStorageChanged(sender, itemCount) {
        logger_1.Log.Instance.Debug("On location storage callback called, number of locations now " + itemCount.toString());
        if (this.App.config.locationStore.ShouldShowLocationSelectors(this.App.config.CurrentLocation))
            this.ShowLocationSelectors();
        else
            this.HideLocationSelectors();
    }
    BuildPopupMenu() {
        this._currentWeather = new Bin({ style_class: STYLE_CURRENT });
        this._futureWeather = new Bin({ style_class: STYLE_FORECAST });
        this._separatorArea = new PopupSeparatorMenuItem();
        this._separatorAreaHourly = new PopupSeparatorMenuItem();
        this._separatorArea2 = new PopupSeparatorMenuItem();
        this._separatorArea.actor.remove_style_class_name("popup-menu-item");
        this._separatorAreaHourly.actor.remove_style_class_name("popup-menu-item");
        this._separatorArea2.actor.remove_style_class_name("popup-menu-item");
        this._hourlyScrollView = new ScrollView({
            hscrollbar_policy: PolicyType.AUTOMATIC,
            vscrollbar_policy: PolicyType.NEVER,
            x_fill: true,
            y_fill: true,
            y_align: Align.MIDDLE,
            x_align: Align.MIDDLE
        });
        this._hourlyScrollView.overlay_scrollbars = true;
        let vScroll = this._hourlyScrollView.get_vscroll_bar();
        vScroll.connect("scroll-start", () => { this.menu.passEvents = true; });
        vScroll.connect("scroll-stop", () => { this.menu.passEvents = false; });
        let hScroll = this._hourlyScrollView.get_hscroll_bar();
        hScroll.connect("scroll-start", () => { this.menu.passEvents = true; });
        hScroll.connect("scroll-stop", () => { this.menu.passEvents = false; });
        this._separatorAreaHourly.actor.hide();
        this._hourlyScrollView.hide();
        this._hourlyScrollView.set_clip_to_allocation(true);
        this._hourlyBox = new BoxLayout({ style_class: "hourly-box" });
        this._hourlyScrollView.add_actor(this._hourlyBox);
        this._bar = new BoxLayout({ vertical: false, style_class: STYLE_BAR });
        let mainBox = new BoxLayout({ vertical: true });
        mainBox.add_actor(this._currentWeather);
        mainBox.add_actor(this._separatorAreaHourly.actor);
        mainBox.add_actor(this._hourlyScrollView);
        mainBox.add_actor(this._separatorArea.actor);
        mainBox.add_actor(this._futureWeather);
        mainBox.add_actor(this._separatorArea2.actor);
        mainBox.add_actor(this._bar);
        this.menu.addActor(mainBox);
    }
    Toggle() {
        this.menu.toggle();
    }
    Rebuild(config) {
        this.showLoadingUi();
        this.rebuildCurrentWeatherUi(config);
        this.rebuildHourlyWeatherUi(config);
        this.rebuildFutureWeatherUi(config);
        this.rebuildBar(config);
    }
    UpdateIconType(iconType) {
        if (iconType == IconType.FULLCOLOR && this.App.config._useCustomMenuIcons)
            return;
        this._currentWeatherIcon.icon_type = iconType;
        for (let i = 0; i < this._forecast.length; i++) {
            this._forecast[i].Icon.icon_type = iconType;
        }
        for (let i = 0; i < this._hourlyForecasts.length; i++) {
            this._hourlyForecasts[i].Icon.icon_type = iconType;
        }
    }
    DisplayErrorMessage(msg) {
        this._timestamp.text = msg;
    }
    DisplayWeather(weather, config) {
        try {
            if (this.App.config.locationStore.ShouldShowLocationSelectors(config.CurrentLocation))
                this.ShowLocationSelectors();
            else
                this.HideLocationSelectors();
            let mainCondition = "";
            let descriptionCondition = "";
            if (weather.condition.main != null) {
                mainCondition = weather.condition.main;
                if (config._translateCondition) {
                    mainCondition = utils_1.capitalizeFirstLetter(utils_1._(mainCondition));
                }
            }
            if (weather.condition.description != null) {
                descriptionCondition = utils_1.capitalizeFirstLetter(weather.condition.description);
                if (config._translateCondition) {
                    descriptionCondition = utils_1.capitalizeFirstLetter(utils_1._(weather.condition.description));
                }
            }
            let location = "";
            if (weather.location.city != null && weather.location.country != null) {
                location = weather.location.city + ", " + weather.location.country;
            }
            else {
                location = Math.round(weather.coord.lat * 10000) / 10000 + ", " + Math.round(weather.coord.lon * 10000) / 10000;
            }
            if (utils_1.nonempty(config._locationLabelOverride)) {
                location = config._locationLabelOverride;
            }
            this.App.SetAppletTooltip(location + " - " + utils_1._("As of") + " " + utils_1.AwareDateString(weather.date, this.App.currentLocale, config._show24Hours));
            this._currentWeatherSummary.text = descriptionCondition;
            let iconName = weather.condition.icon;
            if (iconName == null) {
                iconName = "weather-severe-alert";
            }
            if (config._useCustomMenuIcons) {
                this._currentWeatherIcon.icon_name = weather.condition.customIcon;
                this.UpdateIconType(IconType.SYMBOLIC);
            }
            else {
                this._currentWeatherIcon.icon_name = iconName;
                this.UpdateIconType(config.IconType);
            }
            this.App.SetAppletIcon(iconName, weather.condition.customIcon);
            let temp = "";
            if (weather.temperature != null) {
                temp = utils_1.TempToUserConfig(weather.temperature, config.TemperatureUnit, config._tempRussianStyle);
                this._currentWeatherTemperature.text = temp + " " + this.unitToUnicode(config.TemperatureUnit);
            }
            let label = "";
            if (this.App.orientation != Side.LEFT && this.App.orientation != Side.RIGHT) {
                if (config._showCommentInPanel) {
                    label += mainCondition;
                }
                if (config._showTextInPanel) {
                    if (label != "") {
                        label += " ";
                    }
                    label += (temp + ' ' + this.unitToUnicode(config.TemperatureUnit));
                }
            }
            else {
                if (config._showTextInPanel) {
                    label = temp;
                    if (this.App.GetPanelHeight() >= 35) {
                        label += this.unitToUnicode(config.TemperatureUnit);
                    }
                }
            }
            if (utils_1.nonempty(config._tempTextOverride)) {
                label = config._tempTextOverride
                    .replace("{t}", temp)
                    .replace("{u}", this.unitToUnicode(config.TemperatureUnit))
                    .replace("{c}", mainCondition);
            }
            this.App.SetAppletLabel(label);
            if (weather.humidity != null) {
                this._currentWeatherHumidity.text = Math.round(weather.humidity) + "%";
            }
            let wind_direction = utils_1.compassDirection(weather.wind.degree);
            this._currentWeatherWind.text =
                (wind_direction != undefined ? utils_1._(wind_direction) + " " : "") +
                    utils_1.MPStoUserUnits(weather.wind.speed, config.WindSpeedUnit);
            if (config.WindSpeedUnit != "Beaufort")
                this._currentWeatherWind.text += " " + utils_1._(config.WindSpeedUnit);
            this._currentWeatherApiUnique.text = "";
            this._currentWeatherApiUniqueCap.text = "";
            if (!!weather.extra_field) {
                this._currentWeatherApiUniqueCap.text = utils_1._(weather.extra_field.name) + ":";
                let value;
                switch (weather.extra_field.type) {
                    case "percent":
                        value = weather.extra_field.value.toString() + "%";
                        break;
                    case "temperature":
                        value = utils_1.TempToUserConfig(weather.extra_field.value, config.TemperatureUnit, config._tempRussianStyle) + " " + this.unitToUnicode(config.TemperatureUnit);
                        break;
                    default:
                        value = utils_1._(weather.extra_field.value);
                        break;
                }
                this._currentWeatherApiUnique.text = value;
            }
            if (weather.pressure != null) {
                this._currentWeatherPressure.text = utils_1.PressToUserUnits(weather.pressure, config._pressureUnit) + ' ' + utils_1._(config._pressureUnit);
            }
            this._currentWeatherLocation.label = location;
            this._currentWeatherLocation.url = weather.location.url;
            if (!weather.location.url)
                this._locationButton.disable();
            let sunriseText = "";
            let sunsetText = "";
            if (weather.sunrise != null && weather.sunset != null && config._showSunrise) {
                sunriseText = (utils_1.GetHoursMinutes(weather.sunrise, this.App.currentLocale, config._show24Hours, weather.location.timeZone));
                sunsetText = (utils_1.GetHoursMinutes(weather.sunset, this.App.currentLocale, config._show24Hours, weather.location.timeZone));
            }
            this._currentWeatherSunrise.text = sunriseText;
            this._currentWeatherSunset.text = sunsetText;
            return true;
        }
        catch (e) {
            logger_1.Log.Instance.Error("DisplayWeatherError: " + e);
            return false;
        }
    }
    ;
    DisplayForecast(weather, config) {
        try {
            if (!weather.forecasts)
                return false;
            let len = Math.min(this._forecast.length, weather.forecasts.length);
            for (let i = 0; i < len; i++) {
                let forecastData = weather.forecasts[i];
                let forecastUi = this._forecast[i];
                let t_low = utils_1.TempToUserConfig(forecastData.temp_min, config.TemperatureUnit, config._tempRussianStyle);
                let t_high = utils_1.TempToUserConfig(forecastData.temp_max, config.TemperatureUnit, config._tempRussianStyle);
                let first_temperature = config._temperatureHighFirst ? t_high : t_low;
                let second_temperature = config._temperatureHighFirst ? t_low : t_high;
                let comment = "";
                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                    comment = (config._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
                    comment = utils_1.capitalizeFirstLetter(comment);
                    if (config._translateCondition)
                        comment = utils_1._(comment);
                }
                let dayName = utils_1.GetDayName(forecastData.date, this.App.currentLocale, this.App.config._showForecastDates, weather.location.timeZone);
                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature;
                forecastUi.Temperature.text += ((config._tempRussianStyle) ? consts_1.ELLIPSIS : " " + consts_1.FORWARD_SLASH + " ");
                forecastUi.Temperature.text += second_temperature + ' ' + this.unitToUnicode(config.TemperatureUnit);
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = (config._useCustomMenuIcons) ? forecastData.condition.customIcon : forecastData.condition.icon;
            }
            return true;
        }
        catch (e) {
            this.App.ShowError({
                type: "hard",
                detail: "unknown",
                message: "Forecast parsing failed: " + e.toString(),
                userError: false
            });
            logger_1.Log.Instance.Error("DisplayForecastError " + e);
            return false;
        }
    }
    ;
    DisplayBar(weather, provider, config) {
        this._providerCredit.label = utils_1._("Powered by") + " " + provider.prettyName;
        this._providerCredit.url = provider.website;
        this._timestamp.text = utils_1._("As of") + " " + utils_1.AwareDateString(weather.date, this.App.currentLocale, config._show24Hours);
        if (weather.location.distanceFrom != null) {
            this._timestamp.text += (", " + utils_1.MetreToUserUnits(weather.location.distanceFrom, this.App.config.DistanceUnit)
                + this.BigDistanceUnitFor(this.App.config.DistanceUnit) + " " + utils_1._("from you"));
        }
        return true;
    }
    DisplayHourlyForecast(forecasts, config, tz) {
        let max = Math.min(forecasts.length, this._hourlyForecasts.length);
        for (let index = 0; index < max; index++) {
            const hour = forecasts[index];
            const ui = this._hourlyForecasts[index];
            ui.Hour.text = utils_1.GetHoursMinutes(hour.date, this.App.currentLocale, config._show24Hours, tz, this.App.config._shortHourlyTime);
            ui.Temperature.text = utils_1.TempToUserConfig(hour.temp, config.TemperatureUnit, config._tempRussianStyle) + " " + this.unitToUnicode(config.TemperatureUnit);
            ui.Icon.icon_name = (config._useCustomMenuIcons) ? hour.condition.customIcon : hour.condition.icon;
            hour.condition.main = utils_1.capitalizeFirstLetter(hour.condition.main);
            if (config._translateCondition)
                hour.condition.main = utils_1._(hour.condition.main);
            ui.Summary.text = hour.condition.main;
            if (!!hour.precipitation && hour.precipitation.type != "none") {
                let precipitationText = null;
                if (!!hour.precipitation.volume && hour.precipitation.volume > 0) {
                    precipitationText = utils_1.MillimeterToUserUnits(hour.precipitation.volume, this.App.config.DistanceUnit) + " " + ((this.App.config.DistanceUnit == "metric") ? utils_1._("mm") : utils_1._("in"));
                }
                if (!!hour.precipitation.chance) {
                    precipitationText = (precipitationText == null) ? "" : (precipitationText + ", ");
                    precipitationText += (Math.round(hour.precipitation.chance).toString() + "%");
                }
                if (precipitationText != null)
                    ui.Precipitation.text = precipitationText;
            }
        }
        this.AdjustHourlyBoxItemWidth();
        if (max <= 0)
            this.HideHourlyToggle();
        return true;
    }
    ShowHourlyWeather() {
        this._hourlyScrollView.show();
        this._hourlyScrollView.hide();
        this.AdjustHourlyBoxItemWidth();
        let [minWidth, naturalWidth] = this._hourlyScrollView.get_preferred_width(-1);
        let [minHeight, naturalHeight] = this._hourlyScrollView.get_preferred_height(minWidth);
        logger_1.Log.Instance.Debug("hourlyScrollView requested height and is set to: " + naturalHeight);
        this._hourlyScrollView.set_width(minWidth);
        this._separatorAreaHourly.actor.show();
        if (!!this._hourlyButton.child)
            this._hourlyButton.child.icon_name = "custom-up-arrow-symbolic";
        this._hourlyScrollView.show();
        this._hourlyScrollView.style = "min-height: " + naturalHeight.toString() + "px;";
        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            this._hourlyScrollView.height = 0;
            addTween(this._hourlyScrollView, {
                height: naturalHeight,
                time: 0.25,
                onUpdate: () => { },
                onComplete: () => {
                    this._hourlyScrollView.set_height(naturalHeight);
                }
            });
        }
        this.hourlyToggled = true;
    }
    HideHourlyWeather() {
        this._separatorAreaHourly.actor.hide();
        let hscroll = this._hourlyScrollView.get_hscroll_bar();
        if (!!this._hourlyButton.child)
            this._hourlyButton.child.icon_name = "custom-down-arrow-symbolic";
        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            addTween(this._hourlyScrollView, {
                height: 0,
                time: 0.25,
                onUpdate: () => { },
                onComplete: () => {
                    this._hourlyScrollView.set_height(-1);
                    this._hourlyScrollView.hide();
                    hscroll.get_adjustment().set_value(0);
                }
            });
        }
        else {
            this._hourlyScrollView.set_height(-1);
            this._hourlyScrollView.hide();
        }
        this.hourlyToggled = false;
    }
    ToggleHourlyWeather() {
        if (this.hourlyToggled) {
            this.HideHourlyWeather();
        }
        else {
            this.ShowHourlyWeather();
        }
    }
    ShowLocationSelectors() {
        this._nextLocationButton.actor.show();
        this._previousLocationButton.actor.show();
    }
    HideLocationSelectors() {
        this._nextLocationButton.actor.hide();
        this._previousLocationButton.actor.hide();
    }
    AdjustHourlyBoxItemWidth() {
        let requiredWidth = 0;
        for (let index = 0; index < this._hourlyForecastBoxes.length; index++) {
            const ui = this._hourlyForecasts[index];
            let hourWidth = ui.Hour.get_preferred_width(-1)[1];
            let iconWidth = ui.Icon.get_preferred_width(-1)[1];
            let summaryWidth = ui.Summary.get_preferred_width(-1)[1];
            let temperatureWidth = ui.Temperature.get_preferred_width(-1)[1];
            let precipitationWidth = ui.Precipitation.get_preferred_width(-1)[1];
            if (precipitationWidth > iconWidth || summaryWidth > iconWidth) {
                if (precipitationWidth > summaryWidth)
                    precipitationWidth += 10;
                else
                    summaryWidth += 10;
            }
            if (requiredWidth < hourWidth)
                requiredWidth = hourWidth;
            if (requiredWidth < iconWidth)
                requiredWidth = iconWidth;
            if (requiredWidth < summaryWidth)
                requiredWidth = summaryWidth;
            if (requiredWidth < temperatureWidth)
                requiredWidth = temperatureWidth;
            if (requiredWidth < precipitationWidth)
                requiredWidth = precipitationWidth;
        }
        for (let index = 0; index < this._hourlyForecastBoxes.length; index++) {
            const element = this._hourlyForecastBoxes[index];
            element.set_width(requiredWidth);
        }
    }
    GetScrollViewHeight() {
        let boxItemHeight = 0;
        for (let index = 0; index < this._hourlyForecastBoxes.length; index++) {
            const ui = this._hourlyForecasts[index];
            logger_1.Log.Instance.Debug("Height requests of Hourly box Items: " + index);
            let hourHeight = ui.Hour.get_preferred_height(-1)[1];
            let iconHeight = ui.Icon.get_preferred_height(-1)[1];
            let summaryHeight = ui.Summary.get_preferred_height(-1)[1];
            let temperatureHeight = ui.Temperature.get_preferred_height(-1)[1];
            let precipitationHeight = ui.Precipitation.get_preferred_height(-1)[1];
            let itemHeight = hourHeight + iconHeight + summaryHeight + temperatureHeight + precipitationHeight;
            if (boxItemHeight < itemHeight)
                boxItemHeight = itemHeight;
        }
        logger_1.Log.Instance.Debug("Final Hourly box item height is: " + boxItemHeight);
        let scrollBarHeight = this._hourlyScrollView.get_hscroll_bar().get_preferred_width(-1)[1];
        logger_1.Log.Instance.Debug("Scrollbar height is " + scrollBarHeight);
        let theme = this._hourlyBox.get_theme_node();
        let styling = theme.get_margin(Side.TOP) + theme.get_margin(Side.BOTTOM) + theme.get_padding(Side.TOP) + theme.get_padding(Side.BOTTOM);
        logger_1.Log.Instance.Debug("ScollbarBox vertical padding and margin is: " + styling);
        return (boxItemHeight + scrollBarHeight + styling);
    }
    unitToUnicode(unit) {
        return unit == "fahrenheit" ? '\u2109' : '\u2103';
    }
    BigDistanceUnitFor(unit) {
        if (unit == "imperial")
            return utils_1._("mi");
        return utils_1._("km");
    }
    destroyCurrentWeather() {
        if (this._currentWeather.get_child() != null)
            this._currentWeather.get_child().destroy();
    }
    destroyFutureWeather() {
        if (this._futureWeather.get_child() != null)
            this._futureWeather.get_child().destroy();
    }
    destroyBar() {
        this._bar.destroy_all_children();
    }
    destroyHourlyWeather() {
        this._hourlyBox.destroy_all_children();
    }
    showLoadingUi() {
        this.destroyCurrentWeather();
        this.destroyFutureWeather();
        this.destroyBar();
        this._currentWeather.set_child(new Label({
            text: utils_1._('Loading current weather ...')
        }));
        this._futureWeather.set_child(new Label({
            text: utils_1._('Loading future weather ...')
        }));
    }
    rebuildCurrentWeatherUi(config) {
        this.destroyCurrentWeather();
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
        this._currentWeatherLocation.connect(consts_1.SIGNAL_CLICKED, Lang.bind(this, function () {
            if (this.app.encounteredError)
                this.app.refreshWeather(true);
            else if (this._currentWeatherLocation.url == null)
                return;
            else
                this.app.OpenUrl(this._currentWeatherLocation);
        }));
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
        this._nextLocationButton.actor.connect(consts_1.SIGNAL_CLICKED, Lang.bind(this.App, this.App.NextLocationClicked));
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
        this._previousLocationButton.actor.connect(consts_1.SIGNAL_CLICKED, Lang.bind(this.App, this.App.PreviousLocationClicked));
        this._locationBox = new BoxLayout();
        this._locationBox.add(this._previousLocationButton.actor, { x_fill: false, x_align: Align.START, y_align: Align.MIDDLE, expand: false });
        this._locationBox.add(this._currentWeatherLocation, { x_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: true });
        this._locationBox.add(this._nextLocationButton.actor, { x_fill: false, x_align: Align.END, y_align: Align.MIDDLE, expand: false });
        this._currentWeatherSummary = new Label({ text: utils_1._('Loading ...'), style_class: STYLE_SUMMARY });
        this._currentWeatherSunrise = new Label({ text: consts_1.ELLIPSIS, style: this.GetTextColorStyle() });
        this._currentWeatherSunset = new Label({ text: consts_1.ELLIPSIS, style: this.GetTextColorStyle() });
        let sunriseBox = new BoxLayout();
        let sunsetBox = new BoxLayout();
        if (config._showSunrise) {
            let sunsetIcon = new Icon({
                icon_name: "sunset-symbolic",
                icon_type: IconType.SYMBOLIC,
                icon_size: 25,
                style: this.GetTextColorStyle()
            });
            let sunriseIcon = new Icon({
                icon_name: "sunrise-symbolic",
                icon_type: IconType.SYMBOLIC,
                icon_size: 25,
                style: this.GetTextColorStyle()
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
        this._currentWeatherApiUniqueCap = new Label({ text: '', style: this.GetTextColorStyle() });
        let rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS });
        let rb_values = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_VALUES });
        rb_captions.add_actor(new Label({ text: utils_1._('Temperature') + ":", style: this.GetTextColorStyle() }));
        rb_captions.add_actor(new Label({ text: utils_1._('Humidity') + ":", style: this.GetTextColorStyle() }));
        rb_captions.add_actor(new Label({ text: utils_1._('Pressure') + ":", style: this.GetTextColorStyle() }));
        rb_captions.add_actor(new Label({ text: utils_1._('Wind') + ":", style: this.GetTextColorStyle() }));
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
        this._forecastBox = new GridLayout({
            orientation: config._verticalOrientation
        });
        this._forecastBox.set_column_homogeneous(true);
        let table = new Widget({
            layout_manager: this._forecastBox,
            style_class: STYLE_FORECAST_CONTAINER
        });
        this._futureWeather.set_child(table);
        let maxDays = this.App.GetMaxForecastDays();
        let maxRow = config._forecastRows;
        let maxCol = config._forecastColumns;
        if (config._verticalOrientation) {
            [maxRow, maxCol] = [maxCol, maxRow];
        }
        let curRow = 0;
        let curCol = 0;
        for (let i = 0; i < maxDays; i++) {
            let forecastWeather = {};
            if (curCol >= maxCol) {
                curRow++;
                curCol = 0;
            }
            if (curRow >= maxRow)
                break;
            forecastWeather.Icon = new Icon({
                icon_type: config.IconType,
                icon_size: 48,
                icon_name: consts_1.APPLET_ICON,
                style_class: STYLE_FORECAST_ICON
            });
            forecastWeather.Day = new Label({
                style_class: STYLE_FORECAST_DAY,
                reactive: true,
                style: this.GetTextColorStyle()
            });
            forecastWeather.Summary = new Label({
                style_class: STYLE_FORECAST_SUMMARY,
                reactive: true
            });
            forecastWeather.Temperature = new Label({
                style_class: STYLE_FORECAST_TEMPERATURE
            });
            let by = new BoxLayout({
                vertical: true,
                style_class: STYLE_FORECAST_DATABOX
            });
            by.add_actor(forecastWeather.Day);
            by.add_actor(forecastWeather.Summary);
            by.add_actor(forecastWeather.Temperature);
            let bb = new BoxLayout({
                style_class: STYLE_FORECAST_BOX
            });
            bb.add_actor(forecastWeather.Icon);
            bb.add_actor(by);
            this._forecast[i] = forecastWeather;
            if (!config._verticalOrientation) {
                this._forecastBox.attach(bb, curCol, curRow, 1, 1);
            }
            else {
                this._forecastBox.attach(bb, curRow, curCol, 1, 1);
            }
            curCol++;
        }
    }
    rebuildBar(config) {
        this.destroyBar();
        this._timestamp = new Label({ text: "Placeholder" });
        this._bar.add(this._timestamp, {
            x_fill: false,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        });
        this._hourlyButton = new weatherbutton_1.WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: 12,
                icon_name: "custom-down-arrow-symbolic"
            }),
        }).actor;
        this._hourlyButton.connect(consts_1.SIGNAL_CLICKED, Lang.bind(this, this.ToggleHourlyWeather));
        this._bar.add(this._hourlyButton, {
            x_fill: false,
            x_align: Align.MIDDLE,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        });
        if (this.App.GetMaxHourlyForecasts() <= 0) {
            this.HideHourlyToggle();
        }
        this._providerCredit = new weatherbutton_1.WeatherButton({ label: utils_1._(consts_1.ELLIPSIS), reactive: true }).actor;
        this._providerCredit.connect(consts_1.SIGNAL_CLICKED, Lang.bind(this, this.App.OpenUrl));
        this._bar.add(this._providerCredit, {
            x_fill: false,
            x_align: Align.END,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        });
    }
    HideHourlyToggle() {
        this._hourlyButton.child = null;
    }
    rebuildHourlyWeatherUi(config) {
        this.destroyHourlyWeather();
        let hours = this.App.GetMaxHourlyForecasts();
        this._hourlyForecasts = [];
        this._hourlyForecastBoxes = [];
        for (let index = 0; index < hours; index++) {
            let box = new BoxLayout({ vertical: true, style_class: "hourly-box-item" });
            this._hourlyForecastBoxes.push(box);
            this._hourlyForecasts.push({
                Hour: new Label({ text: "Hour", style_class: "hourly-time", style: this.GetTextColorStyle() }),
                Icon: new Icon({
                    icon_type: config.IconType,
                    icon_size: 24,
                    icon_name: consts_1.APPLET_ICON,
                    style_class: "hourly-icon"
                }),
                Precipitation: new Label({ text: " ", style_class: "hourly-data" }),
                Summary: new Label({ text: utils_1._(consts_1.ELLIPSIS), style_class: "hourly-data" }),
                Temperature: new Label({ text: utils_1._(consts_1.ELLIPSIS), style_class: "hourly-data" })
            });
            this._hourlyForecasts[index].Summary.clutter_text.set_line_wrap(true);
            box.add_child(this._hourlyForecasts[index].Hour);
            box.add_child(this._hourlyForecasts[index].Icon);
            box.add_child(this._hourlyForecasts[index].Summary);
            box.add_child(this._hourlyForecasts[index].Temperature);
            box.add_child(this._hourlyForecasts[index].Precipitation);
            this._hourlyBox.add(box, {
                x_fill: true,
                x_align: Align.MIDDLE,
                y_align: Align.MIDDLE,
                y_fill: true,
                expand: true
            });
        }
    }
}
exports.UI = UI;
