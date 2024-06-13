import { Literal, OpenUrl, SpawnProcess } from "../lib/commandRunner";
import type { Config, DistanceUnits } from "../config";
import { SIGNAL_CLICKED, ELLIPSIS } from "../consts";
import { Event } from "../lib/events";
import type { WeatherApplet } from "../main";
import type { CustomIcons, WeatherData, AlertData, AlertLevel, BuiltinIcons } from "../weather-data";
import type { WeatherProvider } from "../types";
import { _, AwareDateString, GetAlertColor, MetreToUserUnits } from "../utils";
import { WeatherButton } from "../ui_elements/weatherbutton";
import { DateTime } from "luxon";
import { Logger } from "../lib/services/logger";

const { BoxLayout, IconType, Bin, Icon, Align, Button, Side } = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;

const STYLE_BAR = 'bottombar'

interface AlertWindowAlert extends AlertData {
	color: string;
}

/** Bottom bar with timestamp, button and credits */
export class UIBar {
	private actor: imports.gi.St.BoxLayout;
	public get Actor(): imports.gi.St.BoxLayout {
		return this.actor;
	}

	public ToggleClicked: Event<UIBar, boolean> = new Event();

	// TODO: assert these properly
	private providerCreditButton: WeatherButton | null = null;
	private hourlyButton: WeatherButton | null = null;
	private _timestamp: imports.gi.St.Button | null = null;
	private timestampTooltip: imports.ui.tooltips.Tooltip<imports.gi.St.Button> | null = null;
	private warningButtonIcon: imports.gi.St.Icon | null = null;
	private warningButton: WeatherButton | null = null;
	private warningButtonTooltip: imports.ui.tooltips.Tooltip<imports.gi.St.Button> | null = null;
	private refreshIcon: imports.gi.St.Icon | null = null;

	private app: WeatherApplet;

	constructor(app: WeatherApplet) {
		this.app = app;
		this.actor = new BoxLayout({ vertical: false, style_class: STYLE_BAR });
	}

	public SwitchButtonToShow(): void {
		const icon: CustomIcons = this.app.Orientation == Side.BOTTOM ? "custom-up-arrow-symbolic" : "custom-down-arrow-symbolic";
		if (this.hourlyButton?.actor.child)
			(this.hourlyButton.actor.child as imports.gi.St.Icon).icon_name = icon;
	}

	public SwitchButtonToHide(): void {
		const icon: CustomIcons = this.app.Orientation == Side.BOTTOM ? "custom-down-arrow-symbolic" : "custom-up-arrow-symbolic";
		if (this.hourlyButton?.actor.child)
			(this.hourlyButton.actor.child as imports.gi.St.Icon).icon_name = icon;
	}

	public DisplayErrorMessage(msg: string): void {
		if (this._timestamp == null)
			return;

		this._timestamp.label = msg;
	}

	public Display(weather: WeatherData, provider: WeatherProvider, config: Config, shouldShowToggle: boolean): boolean {
		if (this._timestamp == null || this.providerCreditButton == null || this.providerCreditButton?.actor.is_finalized?.())
			return false;

		let creditLabel = `${_("Powered by")} ${provider.prettyName}`;
		if (provider.remainingCalls != null) {
			creditLabel+= ` (${provider.remainingCalls})`;
		}

		this.providerCreditButton.actor.label = creditLabel;
		this.providerCreditButton.url = provider.website;
		const lastUpdatedTime = AwareDateString(weather.date, config._show24Hours, DateTime.local().zoneName);
		this._timestamp.label = _("As of {lastUpdatedTime}", { "lastUpdatedTime": lastUpdatedTime });

		if (weather?.stationInfo?.distanceFrom != null) {
			const stringFormat = {
				distance: MetreToUserUnits(weather.stationInfo.distanceFrom, config.DistanceUnit).toString(),
				distanceUnit: this.BigDistanceUnitFor(config.DistanceUnit)
			}
			this._timestamp.label += `, ${_("{distance} {distanceUnit} from you", stringFormat)}`;
		}

		let tooltipText = "";
		if (weather?.stationInfo?.name != null)
			tooltipText = _("Station Name: {stationName}", { stationName: weather.stationInfo.name });

		if (weather?.stationInfo?.area != null) {
			tooltipText += ", ";
			tooltipText += _("Area: {stationArea}", {stationArea: weather.stationInfo.area});
		}

		this.timestampTooltip?.set_text(tooltipText);

		if (!shouldShowToggle || config._alwaysShowHourlyWeather)
			this.HideHourlyToggle();
		else
			this.ShowHourlyToggle();

		const levelOrder: AlertLevel[] = ["unknown", "minor", "moderate", "severe", "extreme"];
		if (config._showAlerts && weather.alerts && weather.alerts.length > 0) {
			const highestLevel = weather.alerts.reduce((prev, current) => (levelOrder.indexOf(prev.level) > levelOrder.indexOf(current.level)) ? prev : current);
			this.warningButtonTooltip?.set_text(_("{count} weather alert(s)", { count: weather.alerts.length.toString() }));
			this.warningButtonIcon?.set_style("color: " + GetAlertColor(highestLevel.level, this.app.ui.LightTheme));
			this.warningButton?.actor.show();
		}
		else {
			this.warningButton?.actor.hide();
		}
		return true;
	}

	public Destroy(): void {
		this.actor.destroy_all_children();
		this.timestampTooltip?.destroy();
	}

	public Rebuild(config: Config): void {
		this.Destroy();
		const leftBox = new BoxLayout({ vertical: false, y_align: Align.MIDDLE   });
		this.warningButtonIcon = new Icon({
			icon_type: IconType.SYMBOLIC,
			icon_size: config.CurrentFontSize + 3,
			icon_name: "dialog-warning-symbolic",
		});

		this.warningButton = new WeatherButton({
			reactive: true,
			can_focus: true,
			child: this.warningButtonIcon
		});

		this.warningButtonTooltip = new Tooltip(this.warningButton.actor, "");
		this.warningButton.actor.hide();
		this.warningButton.actor.connect(SIGNAL_CLICKED, this.WarningClicked);

		leftBox.add_actor(this.warningButton.actor);
		leftBox.add_actor(new Bin({ width: 5 }));
		this._timestamp = new Button({ label: "Placeholder" });
		leftBox.add_actor(this._timestamp);
		this.timestampTooltip = new Tooltip(this._timestamp, "");

		this.actor.add(leftBox, {
			x_fill: false,
			x_align: Align.START,
			y_align: Align.MIDDLE,
			y_fill: false,
			expand: true
		})

		this.hourlyButton = new WeatherButton({
			reactive: true,
			can_focus: true,
			child: new Icon({
				icon_type: IconType.SYMBOLIC,
				// always want it a bit bigger due to the icons's horizontal nature
				icon_size: config.CurrentFontSize + 3,
				icon_name: this.app.Orientation == Side.BOTTOM ? "custom-up-arrow-symbolic" as CustomIcons : "custom-down-arrow-symbolic" as CustomIcons,
				style: "margin: 2px 5px;"
			}),
		});
		this.hourlyButton.actor.connect(SIGNAL_CLICKED, () => this.ToggleClicked.Invoke(this, true));
		this.actor.add(this.hourlyButton.actor, {
			x_fill: false,
			x_align: Align.MIDDLE,
			y_align: Align.MIDDLE,
			y_fill: false,
			expand: true
		})

		// Hide if Hourly forecasts are not supported
		if (this.app.GetMaxHourlyForecasts() <= 0) {
			this.HideHourlyToggle();
		}

		this.providerCreditButton = new WeatherButton({ label: _(ELLIPSIS), reactive: true });
		this.providerCreditButton.actor.connect(SIGNAL_CLICKED, () => OpenUrl(this.providerCreditButton!));
		this.refreshIcon = new Icon({
			icon_name: "refresh-symbolic" as BuiltinIcons,
			icon_type: IconType.SYMBOLIC,
			icon_size: 24,
		});
		this.refreshIcon.hide();

		this.actor.add(this.providerCreditButton.actor, {
			x_fill: false,
			x_align: Align.END,
			y_align: Align.MIDDLE,
			y_fill: false,
			expand: true
		});
		this.actor.add(this.refreshIcon, {
			x_fill: false,
			x_align: Align.END,
			y_align: Align.MIDDLE,
			y_fill: false,
		})
	}

	/**
	 *
	 * @param unit
	 * @return km or mi, based on unit
	 */
	private BigDistanceUnitFor(unit: DistanceUnits) {
		if (unit == "imperial") return _("mi");
		return _("km");
	}

	public ShowRefreshIcon(): void {
		this.refreshIcon?.show();
	}

	public HideRefreshIcon(): void {
		this.refreshIcon?.hide();
	}

	private HideHourlyToggle() {
		this.hourlyButton?.actor.hide();
	}

	private ShowHourlyToggle() {
		this.hourlyButton?.actor.show();
	}

	private WarningClicked = async () => {
		if (this.app.CurrentData?.alerts == null)
			return;

		await this.PushAlertWindow(this.app.CurrentData.alerts.map(alert => ({
			...alert,
			color: GetAlertColor(alert.level, this.app.ui.LightTheme)
		})));
	}

	private async PushAlertWindow(alerts: AlertWindowAlert[]) {
		const alertWindowPath = this.app.AppletDir + "/AlertsWindow.py";

		Logger.Info("Alerts Window opened.");
		const result = await SpawnProcess([alertWindowPath, Literal(JSON.stringify(alerts))]);
		Logger.Info("Alerts Window closed.");
		if (!result.Success)
			Logger.Error(`Error occurred while opening Alerts Window: ${JSON.stringify(result.ErrorData)}`);
		else
			Logger.Debug(`Alerts Window output: ${JSON.stringify(result.Data)}`);
	}

}
