"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UI = void 0;
const consts_1 = require("./consts");
const uiCurrentWeather_1 = require("./uiCurrentWeather");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const weatherbutton_1 = require("./weatherbutton");
const uiForecasts_1 = require("./uiForecasts");
const uiHourlyForecasts_1 = require("./uiHourlyForecasts");
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
    ShowHourlyWeather() {
        this.HourlyWeather.Show();
        this._separatorAreaHourly.actor.show();
        if (!!this._hourlyButton.child)
            this._hourlyButton.child.icon_name = "custom-up-arrow-symbolic";
    }
    HideHourlyWeather() {
        this.HourlyWeather.Hide();
        this._separatorAreaHourly.actor.hide();
        if (!!this._hourlyButton.child)
            this._hourlyButton.child.icon_name = "custom-down-arrow-symbolic";
    }
    ToggleHourlyWeather() {
        if (this.HourlyWeather.Toggled) {
            this.HideHourlyWeather();
        }
        else {
            this.ShowHourlyWeather();
        }
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
        this.HourlyWeather = new uiHourlyForecasts_1.UIHourlyForecasts(this.App, this.menu);
        this._separatorArea = new PopupSeparatorMenuItem();
        this._separatorAreaHourly = new PopupSeparatorMenuItem();
        this._separatorArea2 = new PopupSeparatorMenuItem();
        this._separatorArea.actor.remove_style_class_name("popup-menu-item");
        this._separatorAreaHourly.actor.remove_style_class_name("popup-menu-item");
        this._separatorArea2.actor.remove_style_class_name("popup-menu-item");
        this._separatorAreaHourly.actor.hide();
        this._bar = new BoxLayout({ vertical: false, style_class: STYLE_BAR });
        let mainBox = new BoxLayout({ vertical: true });
        mainBox.add_actor(this.CurrentWeather.actor);
        mainBox.add_actor(this._separatorAreaHourly.actor);
        mainBox.add_actor(this.HourlyWeather.actor);
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
        this.HourlyWeather.Rebuild(config, this.GetTextColorStyle());
        this.FutureWeather.Rebuild(config, this.GetTextColorStyle());
        this.rebuildBar(config);
    }
    UpdateIconType(iconType) {
        if (iconType == IconType.FULLCOLOR && this.App.config._useCustomMenuIcons)
            return;
        this.CurrentWeather.UpdateIconType(iconType);
        this.FutureWeather.UpdateIconType(iconType);
        this.HourlyWeather.UpdateIconType(iconType);
    }
    DisplayErrorMessage(msg) {
        this._timestamp.text = msg;
    }
    Display(weather, config, provider) {
        this.CurrentWeather.Display(weather, config);
        this.FutureWeather.Display(weather, config);
        let shouldShowToggle = this.HourlyWeather.Display(weather.hourlyForecasts, config, weather.location.timeZone);
        if (!shouldShowToggle)
            this.HideHourlyToggle();
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
    BigDistanceUnitFor(unit) {
        if (unit == "imperial")
            return utils_1._("mi");
        return utils_1._("km");
    }
    destroyBar() {
        this._bar.destroy_all_children();
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
}
exports.UI = UI;
