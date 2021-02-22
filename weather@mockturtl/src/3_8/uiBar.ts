import { OpenUrl } from "./commandRunner";
import { Config, DistanceUnits } from "./config";
import { SIGNAL_CLICKED, ELLIPSIS } from "./consts";
import { Event } from "./events";
import { WeatherApplet } from "./main";
import { CustomIcons, WeatherData, WeatherProvider } from "./types";
import { _, AwareDateString, MetreToUserUnits } from "./utils";
import { WeatherButton } from "./weatherbutton";

const { BoxLayout, IconType, Label, Icon, Align, } = imports.gi.St;

const STYLE_BAR = 'bottombar'

/** Bottom bar with timestamp, button and credits */
export class UIBar {
	private actor: imports.gi.St.BoxLayout;
	public get Actor() {
		return this.actor;
	}

	public ToggleClicked: Event<UIBar, boolean> = new Event();

	private _providerCredit: imports.gi.St.Button;
	private _hourlyButton: imports.gi.St.Button;
	private _timestamp: imports.gi.St.Label;

	private app: WeatherApplet;

	constructor(app: WeatherApplet) {
		this.app = app;
		this.actor = new BoxLayout({ vertical: false, style_class: STYLE_BAR });
	}

	public SwitchButtonToShow() {
		if (!!this._hourlyButton.child) this._hourlyButton.child.icon_name = "custom-down-arrow-symbolic";
	}

	public SwitchButtonToHide() {
		if (!!this._hourlyButton.child) this._hourlyButton.child.icon_name = "custom-up-arrow-symbolic";
	}

	public DisplayErrorMessage(msg: string) {
		this._timestamp.text = msg;
	}

	public Display(weather: WeatherData, provider: WeatherProvider, config: Config, shouldShowToggle: boolean): boolean {
		this._providerCredit.label = _("Powered by") + " " + provider.prettyName;
		this._providerCredit.url = provider.website;
		let lastUpdatedTime = AwareDateString(weather.date, config.currentLocale, config._show24Hours);
		this._timestamp.text = _("As of {lastUpdatedTime}", { "lastUpdatedTime": lastUpdatedTime });

		if (weather.location.distanceFrom != null) {
			let stringFormat = {
				distance: MetreToUserUnits(weather.location.distanceFrom, config.DistanceUnit).toString(),
				distanceUnit: this.BigDistanceUnitFor(config.DistanceUnit)
			}
			this._timestamp.text += `, ${_("{distance}{distanceUnit} from you", stringFormat)}`;
		}

		if (!shouldShowToggle)
			this.HideHourlyToggle();
		return true;
	}

	public Destroy(): void {
		this.actor.destroy_all_children();
	}

	public Rebuild(config: Config) {
		this.Destroy();
		this._timestamp = new Label({ text: "Placeholder" });
		this.actor.add(this._timestamp, {
			x_fill: false,
			x_align: Align.START,
			y_align: Align.MIDDLE,
			y_fill: false,
			expand: true
		})

		this._hourlyButton = new WeatherButton({
			reactive: true,
			can_focus: true,
			child: new Icon({
				icon_type: IconType.SYMBOLIC,
				// always want it a bit bigger due to the icons's horizontal nature
				icon_size: config.CurrentFontSize + 3,
				icon_name: "custom-down-arrow-symbolic" as CustomIcons,
				style: "margin: 2px 5px;"
			}),
		}).actor;
		this._hourlyButton.connect(SIGNAL_CLICKED, () => this.ToggleClicked.Invoke(this, true));
		this.actor.add(this._hourlyButton, {
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

		this._providerCredit = new WeatherButton({ label: _(ELLIPSIS), reactive: true }).actor;
		this._providerCredit.connect(SIGNAL_CLICKED, OpenUrl);

		this.actor.add(this._providerCredit, {
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
		this._hourlyButton.child = null;
	}

}