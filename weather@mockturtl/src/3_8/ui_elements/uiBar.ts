import { Literal, OpenUrl, SpawnProcess } from "../lib/commandRunner";
import type { Config, DistanceUnits } from "../config";
import { SIGNAL_CLICKED, ELLIPSIS } from "../consts";
import { Event } from "../lib/events";
import type { WeatherApplet } from "../main";
import type { CustomIcons, WeatherData, AlertData, AlertLevel } from "../weather-data";
import type { WeatherProvider } from "../types";
import { _, AwareDateString, GetAlertColor, Label, MetreToUserUnits } from "../utils";
import { WeatherButton } from "../ui_elements/weatherbutton";
import { DateTime } from "luxon";
import { Logger } from "../lib/services/logger";

const { BoxLayout, IconType, Bin, Icon, Align, Button, Side, Widget } = imports.gi.St;
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
	private refreshSuccess: imports.gi.St.Label | null = null;
	private refreshProgress: imports.gi.St.Label | null = null;
	private refreshError: imports.gi.St.Label | null = null;
	private refreshStatus: "progress" | "success" | "error" = "progress";

	private app: WeatherApplet;

	constructor(app: WeatherApplet) {
		this.app = app;
		this.actor = new BoxLayout({ vertical: false, style_class: STYLE_BAR });
		(this.actor.get_layout_manager() as imports.gi.Clutter.BoxLayout).set_homogeneous(true);
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

		const statusStyle = `font-size: ${config.CurrentFontSize + 6}px;`;

		this.refreshSuccess = Label({
			text: "✓",
			style: statusStyle
		});
		this.refreshProgress = Label({
			text: "⟳",
			style: statusStyle
		});
		this.refreshError = Label({
			text: "✕",
			style: statusStyle
		});
		this.refreshError.translation_y = 1;

		// Keep all states in the layout so its preferred width never
		// changes when the refresh state changes.
		this.ApplyRefreshStatus();

		const statusSlot = new Widget({
			layout_manager: new imports.gi.Clutter.BinLayout()
		});
		statusSlot.add_child(this.refreshSuccess);
		statusSlot.add_child(this.refreshProgress);
		statusSlot.add_child(this.refreshError);

		const rightBox = new BoxLayout({ vertical: false, y_align: Align.MIDDLE });
		rightBox.add_actor(this.providerCreditButton.actor);
		rightBox.add_actor(statusSlot);

		this.actor.add(rightBox, {
			x_fill: false,
			x_align: Align.END,
			y_align: Align.MIDDLE,
			y_fill: false,
			expand: true
		});
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

	public ShowRefreshProgress(): void {
		this.refreshStatus = "progress";
		this.ApplyRefreshStatus();
	}

	public ShowRefreshResult(success: boolean): void {
		this.refreshStatus = success ? "success" : "error";
		this.ApplyRefreshStatus();
	}

	private ApplyRefreshStatus(): void {
		if (this.refreshSuccess == null || this.refreshProgress == null || this.refreshError == null)
			return;

		this.refreshSuccess.opacity = this.refreshStatus == "success" ? 255 : 0;
		this.refreshProgress.opacity = this.refreshStatus == "progress" ? 255 : 0;
		this.refreshError.opacity = this.refreshStatus == "error" ? 255 : 0;
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
