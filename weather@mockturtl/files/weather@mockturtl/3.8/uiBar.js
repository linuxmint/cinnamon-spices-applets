"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIBar = void 0;
const commandRunner_1 = require("./commandRunner");
const consts_1 = require("./consts");
const events_1 = require("./events");
const utils_1 = require("./utils");
const weatherbutton_1 = require("./weatherbutton");
const { BoxLayout, IconType, Label, Icon, Align, } = imports.gi.St;
const Lang = imports.lang;
const STYLE_BAR = 'bottombar';
class UIBar {
    constructor(app) {
        this.ToggleClicked = new events_1.Event();
        this.app = app;
        this.actor = new BoxLayout({ vertical: false, style_class: STYLE_BAR });
    }
    get Actor() {
        return this.actor;
    }
    SwitchButtonToShow() {
        if (!!this._hourlyButton.child)
            this._hourlyButton.child.icon_name = "custom-down-arrow-symbolic";
    }
    SwitchButtonToHide() {
        if (!!this._hourlyButton.child)
            this._hourlyButton.child.icon_name = "custom-up-arrow-symbolic";
    }
    DisplayErrorMessage(msg) {
        this._timestamp.text = msg;
    }
    Display(weather, provider, config, shouldShowToggle) {
        this._providerCredit.label = utils_1._("Powered by") + " " + provider.prettyName;
        this._providerCredit.url = provider.website;
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
        this._hourlyButton = new weatherbutton_1.WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: config.CurrentFontSize + 3,
                icon_name: "custom-down-arrow-symbolic",
                style: "margin: 2px 5px;"
            }),
        }).actor;
        this._hourlyButton.connect(consts_1.SIGNAL_CLICKED, () => this.ToggleClicked.Invoke(this, true));
        this.actor.add(this._hourlyButton, {
            x_fill: false,
            x_align: Align.MIDDLE,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        });
        if (this.app.GetMaxHourlyForecasts() <= 0) {
            this.HideHourlyToggle();
        }
        this._providerCredit = new weatherbutton_1.WeatherButton({ label: utils_1._(consts_1.ELLIPSIS), reactive: true }).actor;
        this._providerCredit.connect(consts_1.SIGNAL_CLICKED, commandRunner_1.OpenUrl);
        this.actor.add(this._providerCredit, {
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
        this._hourlyButton.child = null;
    }
}
exports.UIBar = UIBar;
