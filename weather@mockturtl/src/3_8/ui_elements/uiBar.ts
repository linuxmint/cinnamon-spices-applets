import { OpenUrl } from "../lib/commandRunner";
import { Config, DistanceUnits } from "../config";
import { SIGNAL_CLICKED, ELLIPSIS } from "../consts";
import { Event } from "../lib/events";
import { WeatherApplet } from "../main";
import { CustomIcons, WeatherData, WeatherProvider } from "../types";
import { _, AwareDateString, MetreToUserUnits } from "../utils";
import { WeatherButton } from "../ui_elements/weatherbutton";
import { DateTime } from "luxon";

const { BoxLayout, IconType, Label, Icon, Align, Button } = imports.gi.St;
const { Tooltip } = imports.ui.tooltips;

const STYLE_BAR = 'bottombar'

/** Bottom bar with timestamp, button and credits */
export class UIBar {
	private actor: imports.gi.St.BoxLayout;
	public get Actor() {
		return this.actor;
	}

	public ToggleClicked: Event<UIBar, boolean> = new Event();

	// TODO: assert these properly
	private providerCreditButton: WeatherButton | null = null;
	private hourlyButton: WeatherButton | null = null;
	private _timestamp: imports.gi.St.Button | null = null;
	private timestampTooltip: imports.ui.tooltips.Tooltip<imports.gi.St.Button> | null = null;

	private app: WeatherApplet;

	constructor(app: WeatherApplet) {
		this.app = app;
		this.actor = new BoxLayout({ vertical: false, style_class: STYLE_BAR });
	}

	public SwitchButtonToShow() {
		if (!!this.hourlyButton?.actor.child) (this.hourlyButton.actor.child as imports.gi.St.Icon).icon_name = "custom-down-arrow-symbolic";
	}

	public SwitchButtonToHide() {
		if (!!this.hourlyButton?.actor.child) (this.hourlyButton.actor.child as imports.gi.St.Icon).icon_name = "custom-up-arrow-symbolic";
	}

	public DisplayErrorMessage(msg: string) {
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
		const lastUpdatedTime = AwareDateString(weather.date, config.currentLocale, config._show24Hours, DateTime.local().zoneName);
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
		return true;
	}

	public Destroy(): void {
		this.actor.destroy_all_children();
		this.timestampTooltip?.destroy();
	}

	public Rebuild(config: Config) {
		this.Destroy();
		this._timestamp = new Button({ label: "Placeholder" });
		this.timestampTooltip = new Tooltip(this._timestamp, "");

		this.actor.add(this._timestamp, {
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
				icon_name: "custom-down-arrow-symbolic" as CustomIcons,
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

		this.actor.add(this.providerCreditButton.actor, {
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

	private HideHourlyToggle() {
		this.hourlyButton?.actor.hide();
	}

	private ShowHourlyToggle() {
		this.hourlyButton?.actor.show();
	}

}