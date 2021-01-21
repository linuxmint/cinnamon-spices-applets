"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UI = void 0;
const consts_1 = require("./consts");
const uiCurrentWeather_1 = require("./uiCurrentWeather");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const weatherbutton_1 = require("./weatherbutton");
const uiForecasts_1 = require("./uiForecasts");
const { PopupMenuManager, PopupSeparatorMenuItem } = imports.ui.popupMenu;
const { Bin, BoxLayout, Side, IconType, Label, ScrollView, Icon, Align, Widget } = imports.gi.St;
const { PolicyType } = imports.gi.Gtk;
const { addTween } = imports.ui.tweener;
const Lang = imports.lang;
const { GridLayout } = imports.gi.Clutter;
const { AppletPopupMenu } = imports.ui.applet;
const { themeManager } = imports.ui.main;
const { SignalManager } = imports.misc.signalManager;
const STYLE_WEATHER_MENU = 'weather-menu';
const STYLE_BAR = 'bottombar';
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
    }
    OnThemeChanged() {
        this.HideHourlyWeather();
        let newThemeIsLight = this.IsLightTheme();
        if (newThemeIsLight != this.lightTheme) {
            this.lightTheme = newThemeIsLight;
        }
        this.App.RefreshAndRebuild();
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
    BuildPopupMenu() {
        this.CurrentWeather = new uiCurrentWeather_1.CurrentWeather(this.App, this);
        this.FutureWeather = new uiForecasts_1.UIForecasts(this.App);
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
        mainBox.add_actor(this.CurrentWeather.actor);
        mainBox.add_actor(this._separatorAreaHourly.actor);
        mainBox.add_actor(this._hourlyScrollView);
        mainBox.add_actor(this._separatorArea.actor);
        mainBox.add_actor(this.FutureWeather.actor);
        mainBox.add_actor(this._separatorArea2.actor);
        mainBox.add_actor(this._bar);
        this.menu.addActor(mainBox);
    }
    Toggle() {
        this.menu.toggle();
    }
    Rebuild(config) {
        this.showLoadingUi();
        this.CurrentWeather.Rebuild(config, this.GetTextColorStyle());
        this.rebuildHourlyWeatherUi(config);
        this.FutureWeather.Rebuild(config, this.GetTextColorStyle());
        this.rebuildBar(config);
    }
    UpdateIconType(iconType) {
        if (iconType == IconType.FULLCOLOR && this.App.config._useCustomMenuIcons)
            return;
        this.CurrentWeather.ChangeIconType(iconType);
        this.FutureWeather.UpdateIconType(iconType);
        for (let i = 0; i < this._hourlyForecasts.length; i++) {
            this._hourlyForecasts[i].Icon.icon_type = iconType;
        }
    }
    DisplayErrorMessage(msg) {
        this._timestamp.text = msg;
    }
    Display(weather, config, provider) {
        this.CurrentWeather.Display(weather, config);
        this.FutureWeather.Display(weather, config);
        this.DisplayHourlyForecast(weather.hourlyForecasts, config, weather.location.timeZone);
        this.DisplayBar(weather, provider, config);
        return true;
    }
    DisplayBar(weather, provider, config) {
        this._providerCredit.label = utils_1._("Powered by") + " " + provider.prettyName;
        this._providerCredit.url = provider.website;
        this._timestamp.text = utils_1._("As of") + " " + utils_1.AwareDateString(weather.date, this.App.config.currentLocale, config._show24Hours);
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
            ui.Hour.text = utils_1.GetHoursMinutes(hour.date, this.App.config.currentLocale, config._show24Hours, tz, this.App.config._shortHourlyTime);
            ui.Temperature.text = utils_1.TempToUserConfig(hour.temp, config.TemperatureUnit, config._tempRussianStyle) + " " + utils_1.UnitToUnicode(config.TemperatureUnit);
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
    BigDistanceUnitFor(unit) {
        if (unit == "imperial")
            return utils_1._("mi");
        return utils_1._("km");
    }
    destroyBar() {
        this._bar.destroy_all_children();
    }
    destroyHourlyWeather() {
        this._hourlyBox.destroy_all_children();
    }
    showLoadingUi() {
        this.CurrentWeather.Destroy();
        this.FutureWeather.Destroy();
        this.destroyBar();
        this.CurrentWeather.actor.set_child(new Label({
            text: utils_1._('Loading current weather ...')
        }));
        this.FutureWeather.actor.set_child(new Label({
            text: utils_1._('Loading future weather ...')
        }));
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
