"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIBar = void 0;
const commandRunner_1 = require("lib/commandRunner");
const consts_1 = require("consts");
const events_1 = require("lib/events");
const utils_1 = require("utils");
const weatherbutton_1 = require("ui_elements/weatherbutton");
const { BoxLayout, IconType, Label, Icon, Align, } = imports.gi.St;
const STYLE_BAR = 'bottombar';
class UIBar {
    constructor(app) {
        this.ToggleClicked = new events_1.Event();
        this.providerCreditButton = null;
        this.hourlyButton = null;
        this._timestamp = null;
        this.app = app;
        this.actor = new BoxLayout({ vertical: false, style_class: STYLE_BAR });
    }
    get Actor() {
        return this.actor;
    }
    SwitchButtonToShow() {
        var _a;
        if (!!((_a = this.hourlyButton) === null || _a === void 0 ? void 0 : _a.actor.child))
            this.hourlyButton.actor.child.icon_name = "custom-down-arrow-symbolic";
    }
    SwitchButtonToHide() {
        var _a;
        if (!!((_a = this.hourlyButton) === null || _a === void 0 ? void 0 : _a.actor.child))
            this.hourlyButton.actor.child.icon_name = "custom-up-arrow-symbolic";
    }
    DisplayErrorMessage(msg) {
        this._timestamp.text = msg;
    }
    Display(weather, provider, config, shouldShowToggle) {
        this.providerCreditButton.actor.label = utils_1._("Powered by") + " " + provider.prettyName;
        this.providerCreditButton.url = provider.website;
        let lastUpdatedTime = utils_1.AwareDateString(weather.date, config.currentLocale, config._show24Hours);
        this._timestamp.text = utils_1._("As of {lastUpdatedTime}", { "lastUpdatedTime": lastUpdatedTime });
        if (weather.location.distanceFrom != null) {
            let stringFormat = {
                distance: utils_1.MetreToUserUnits(weather.location.distanceFrom, config.DistanceUnit).toString(),
                distanceUnit: this.BigDistanceUnitFor(config.DistanceUnit)
            };
            this._timestamp.text += `, ${utils_1._("{distance}{distanceUnit} from you", stringFormat)}`;
        }
        if (!shouldShowToggle)
            this.HideHourlyToggle();
        return true;
    }
    Destroy() {
        this.actor.destroy_all_children();
    }
    Rebuild(config) {
        this.Destroy();
        this._timestamp = new Label({ text: "Placeholder" });
        this.actor.add(this._timestamp, {
            x_fill: false,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        });
        this.hourlyButton = new weatherbutton_1.WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: config.CurrentFontSize + 3,
                icon_name: "custom-down-arrow-symbolic",
                style: "margin: 2px 5px;"
            }),
        });
        this.hourlyButton.actor.connect(consts_1.SIGNAL_CLICKED, () => this.ToggleClicked.Invoke(this, true));
        this.actor.add(this.hourlyButton.actor, {
            x_fill: false,
            x_align: Align.MIDDLE,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        });
        if (this.app.GetMaxHourlyForecasts() <= 0) {
            this.HideHourlyToggle();
        }
        this.providerCreditButton = new weatherbutton_1.WeatherButton({ label: utils_1._(consts_1.ELLIPSIS), reactive: true });
        this.providerCreditButton.actor.connect(consts_1.SIGNAL_CLICKED, () => commandRunner_1.OpenUrl(this.providerCreditButton));
        this.actor.add(this.providerCreditButton.actor, {
            x_fill: false,
            x_align: Align.END,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        });
    }
    BigDistanceUnitFor(unit) {
        if (unit == "imperial")
            return utils_1._("mi");
        return utils_1._("km");
    }
    HideHourlyToggle() {
        if (this.hourlyButton != null)
            this.hourlyButton.actor.child = null;
    }
}
exports.UIBar = UIBar;
