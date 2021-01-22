"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIHourlyForecasts = void 0;
const consts_1 = require("./consts");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const { PolicyType } = imports.gi.Gtk;
const { addTween } = imports.ui.tweener;
const { BoxLayout, Side, Label, ScrollView, Icon, Align } = imports.gi.St;
class UIHourlyForecasts {
    constructor(app, menu) {
        this.hourlyToggled = false;
        this.app = app;
        this.actor = new ScrollView({
            hscrollbar_policy: PolicyType.AUTOMATIC,
            vscrollbar_policy: PolicyType.NEVER,
            x_fill: true,
            y_fill: true,
            y_align: Align.MIDDLE,
            x_align: Align.MIDDLE
        });
        this.actor.overlay_scrollbars = true;
        let vScroll = this.actor.get_vscroll_bar();
        vScroll.connect("scroll-start", () => { menu.passEvents = true; });
        vScroll.connect("scroll-stop", () => { menu.passEvents = false; });
        let hScroll = this.actor.get_hscroll_bar();
        hScroll.connect("scroll-start", () => { menu.passEvents = true; });
        hScroll.connect("scroll-stop", () => { menu.passEvents = false; });
        this.actor.hide();
        this.actor.set_clip_to_allocation(true);
        this._hourlyBox = new BoxLayout({ style_class: "hourly-box" });
        this.actor.add_actor(this._hourlyBox);
    }
    get Toggled() {
        return this.hourlyToggled;
    }
    UpdateIconType(iconType) {
        for (let i = 0; i < this._hourlyForecasts.length; i++) {
            this._hourlyForecasts[i].Icon.icon_type = iconType;
        }
    }
    Display(forecasts, config, tz) {
        let max = Math.min(forecasts.length, this._hourlyForecasts.length);
        for (let index = 0; index < max; index++) {
            const hour = forecasts[index];
            const ui = this._hourlyForecasts[index];
            ui.Hour.text = utils_1.GetHoursMinutes(hour.date, config.currentLocale, config._show24Hours, tz, config._shortHourlyTime);
            ui.Temperature.text = utils_1.TempToUserConfig(hour.temp, config.TemperatureUnit, config._tempRussianStyle) + " " + utils_1.UnitToUnicode(config.TemperatureUnit);
            ui.Icon.icon_name = (config._useCustomMenuIcons) ? hour.condition.customIcon : hour.condition.icon;
            hour.condition.main = utils_1.capitalizeFirstLetter(hour.condition.main);
            if (config._translateCondition)
                hour.condition.main = utils_1._(hour.condition.main);
            ui.Summary.text = hour.condition.main;
            if (!!hour.precipitation && hour.precipitation.type != "none") {
                let precipitationText = null;
                if (!!hour.precipitation.volume && hour.precipitation.volume > 0) {
                    precipitationText = utils_1.MillimeterToUserUnits(hour.precipitation.volume, config.DistanceUnit) + " " + ((config.DistanceUnit == "metric") ? utils_1._("mm") : utils_1._("in"));
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
        return !(max <= 0);
    }
    Show() {
        this.actor.show();
        this.actor.hide();
        this.AdjustHourlyBoxItemWidth();
        let [minWidth, naturalWidth] = this.actor.get_preferred_width(-1);
        let [minHeight, naturalHeight] = this.actor.get_preferred_height(minWidth);
        logger_1.Log.Instance.Debug("hourlyScrollView requested height and is set to: " + naturalHeight);
        this.actor.set_width(minWidth);
        this.actor.show();
        this.actor.style = "min-height: " + naturalHeight.toString() + "px;";
        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            this.actor.height = 0;
            addTween(this.actor, {
                height: naturalHeight,
                time: 0.25,
                onUpdate: () => { },
                onComplete: () => {
                    this.actor.set_height(naturalHeight);
                }
            });
        }
        this.hourlyToggled = true;
    }
    Hide() {
        let hscroll = this.actor.get_hscroll_bar();
        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            addTween(this.actor, {
                height: 0,
                time: 0.25,
                onUpdate: () => { },
                onComplete: () => {
                    this.actor.set_height(-1);
                    this.actor.hide();
                    hscroll.get_adjustment().set_value(0);
                }
            });
        }
        else {
            this.actor.set_height(-1);
            this.actor.hide();
        }
        this.hourlyToggled = false;
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
        let scrollBarHeight = this.actor.get_hscroll_bar().get_preferred_width(-1)[1];
        logger_1.Log.Instance.Debug("Scrollbar height is " + scrollBarHeight);
        let theme = this._hourlyBox.get_theme_node();
        let styling = theme.get_margin(Side.TOP) + theme.get_margin(Side.BOTTOM) + theme.get_padding(Side.TOP) + theme.get_padding(Side.BOTTOM);
        logger_1.Log.Instance.Debug("ScollbarBox vertical padding and margin is: " + styling);
        return (boxItemHeight + scrollBarHeight + styling);
    }
    Destroy() {
        this._hourlyBox.destroy_all_children();
    }
    Rebuild(config, textColorStyle) {
        this.Destroy();
        let hours = this.app.GetMaxHourlyForecasts();
        this._hourlyForecasts = [];
        this._hourlyForecastBoxes = [];
        for (let index = 0; index < hours; index++) {
            let box = new BoxLayout({ vertical: true, style_class: "hourly-box-item" });
            this._hourlyForecastBoxes.push(box);
            this._hourlyForecasts.push({
                Hour: new Label({ text: "Hour", style_class: "hourly-time", style: textColorStyle }),
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
exports.UIHourlyForecasts = UIHourlyForecasts;
