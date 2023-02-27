import { OpenUrl } from "../lib/commandRunner";
import { Config } from "../config";
import { ELLIPSIS, APPLET_ICON, SIGNAL_CLICKED, BLANK, STYLE_HIDDEN } from "../consts";
import { LocationStore } from "../location_services/locationstore";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { WeatherData, APIUniqueField, BuiltinIcons, ImmediatePrecipitation } from "../types";
import { _, TempToUserConfig, CompassDirection, MPStoUserUnits, PressToUserUnits, GenerateLocationText, WeatherIconSafely, LocalizedColon, PercentToLocale, CompassDirectionText } from "../utils";
import { WeatherButton } from "../ui_elements/weatherbutton";
import { SunTimesUI } from "./uiSunTimes";
import { WindBox } from "./windBox";

const { Bin, BoxLayout, IconType, Label, Icon, Align } = imports.gi.St;
const Lang: typeof imports.lang = imports.lang;

// stylesheet.css
const STYLE_SUMMARYBOX = 'weather-current-summarybox'
const STYLE_SUMMARY = 'weather-current-summary'
const STYLE_DATABOX = 'weather-current-databox'
const STYLE_ICON = 'weather-current-icon'
const STYLE_ICONBOX = 'weather-current-iconbox'
const STYLE_DATABOX_CAPTIONS = 'weather-current-databox-captions'
const STYLE_DATABOX_VALUES = 'weather-current-databox-values'
const STYLE_CURRENT = 'current'
const STYLE_LOCATION_SELECTOR = 'location-selector';

export class CurrentWeather {
	public readonly actor: imports.gi.St.Bin;

	// TODO: assert these properly
	private weatherIcon!: imports.gi.St.Icon;
	private weatherSummary!: imports.gi.St.Label;

	private locationButton!: WeatherButton;
	/** Actor inside locationButton */
	private location!: imports.gi.St.Button;

	private previousLocationButton!: WeatherButton;
	private nextLocationButton!: WeatherButton;

	private temperatureCaption!: imports.gi.St.Label;
	private humidityCaption!: imports.gi.St.Label;
	private pressureCaption!: imports.gi.St.Label;
	private dewPointCaption!: imports.gi.St.Label;
	private apiUniqueCaption!: imports.gi.St.Label;

	private temperatureLabel!: imports.gi.St.Label;
	private humidityLabel!: imports.gi.St.Label;
	private pressureLabel!: imports.gi.St.Label;
	private dewPointLabel!: imports.gi.St.Label;
	private apiUniqueLabel!: imports.gi.St.Label;

	private immediatePrecipitationBox!: imports.gi.St.Bin;
	private immediatePrecipitationLabel!: imports.gi.St.Label;

	private app: WeatherApplet;

	private sunTimesUI: SunTimesUI;
	private windBox: WindBox;

	constructor(app: WeatherApplet) {
		this.app = app;
		this.actor = new Bin();
		this.actor.style_class = STYLE_CURRENT;
		this.sunTimesUI = new SunTimesUI(app);
		this.windBox = new WindBox(app);
		this.app.config.LocStore.StoreChanged.Subscribe((s, a) => this.onLocationStorageChanged(s, a)); //on location store change
		this.app.config.ImmediatePrecipChanged.Subscribe(this.app.AfterRefresh((config, precip, data) => this.SetImmediatePrecipitation(data.immediatePrecipitation, config)));
		this.app.config.LocationLabelOverrideChanged.Subscribe(this.app.AfterRefresh(this.OnLocationOverrideChanged));
		this.app.config.PressureUnitChanged.Subscribe(this.app.AfterRefresh((config, pressure, data) => this.SetPressure(data.pressure)));
	}

	private OnLocationOverrideChanged = async (config: Config, label: string, data: WeatherData) => {
		const location = GenerateLocationText(data, config);
		this.SetLocation(location, data.location.url);
	}

	/** Injects data from weather object into the popupMenu */
	public Display(weather: WeatherData, config: Config): boolean {
		try {
			// Hide/show location selectors based on how many items are in storage
			if (this.app.config.LocStore.ShouldShowLocationSelectors(config.CurrentLocation)) this.ShowLocationSelectors();
			else this.HideLocationSelectors();

			const location = GenerateLocationText(weather, config);
			this.SetLocation(location, weather.location.url);
			this.SetConditionText(weather.condition.description);
			this.SetWeatherIcon(weather.condition.icons, weather.condition.customIcon);
			this.SetTemperature(weather.temperature);
			this.SetHumidity(weather.humidity);
			this.windBox.Display(weather.wind.speed, weather.wind.degree);
			this.SetPressure(weather.pressure);
			this.SetDewPointField(weather.dewPoint);
			this.SetAPIUniqueField(weather.extra_field);
			this.sunTimesUI.Display(weather.sunrise, weather.sunset, weather.location.timeZone);

			this.SetImmediatePrecipitation(weather.immediatePrecipitation, config);
			return true;
		} catch (e) {
			if (e instanceof Error)
				Logger.Error("DisplayWeatherError: " + e, e);
			return false;
		}
	};

	public UpdateIconType(iconType: imports.gi.St.IconType) {
		this.weatherIcon.icon_type = iconType;
	}

	/** Destroys current weather UI box */
	public Destroy(): void {
		if (this.actor.get_child() != null)
			this.actor.get_child().destroy()
	}

	public Rebuild(config: Config, textColorStyle: string): void {
		this.Destroy()

		// This will hold the icon for the current weather
		this.weatherIcon = new Icon({
			icon_type: config.IconType,
			icon_size: 64,
			icon_name: APPLET_ICON,
			style_class: STYLE_ICON
		})

		// Main box
		const box = new BoxLayout({ style_class: STYLE_ICONBOX })
		box.add_actor(this.weatherIcon)
		box.add_actor(this.BuildMiddleColumn(config, textColorStyle));
		box.add_actor(this.BuildRightColumn(textColorStyle, config))
		this.actor.set_child(box)
	};

	// Build helpers

	private BuildMiddleColumn(config: Config, textColorStyle: string) {
		this.weatherSummary = new Label({ text: _('Loading ...'), style_class: STYLE_SUMMARY })

		const middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX })
		middleColumn.add_actor(this.BuildLocationSection())
		middleColumn.add(this.weatherSummary, { expand: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, x_fill: false, y_fill: false })

		this.immediatePrecipitationLabel = new Label({ style_class: "weather-immediate-precipitation" });
		this.immediatePrecipitationBox = new Bin();
		this.immediatePrecipitationBox.add_actor(this.immediatePrecipitationLabel)
		this.immediatePrecipitationBox.hide();
		middleColumn.add_actor(this.immediatePrecipitationBox);
		middleColumn.add_actor(this.sunTimesUI.Rebuild(config, textColorStyle));

		return middleColumn;
	}

	/** Builds Weather Information on the right side */
	private BuildRightColumn(textColorStyle: string, config: Config) {
		const textOb = {
			text: ELLIPSIS
		}
		// Current Weather Right Column
		this.temperatureLabel = new Label(textOb)
		this.humidityLabel = new Label(textOb)
		this.pressureLabel = new Label(textOb)
		this.dewPointLabel = new Label({ text: '' });

		this.apiUniqueLabel = new Label({ text: '' })
		this.temperatureCaption = new Label({ text: _('Temperature') + LocalizedColon(config.currentLocale), style: textColorStyle });
		this.humidityCaption = new Label({ text: _('Humidity') + LocalizedColon(config.currentLocale), style: textColorStyle });
		this.pressureCaption = new Label({ text: _('Pressure') + LocalizedColon(config.currentLocale), style: textColorStyle });
		this.dewPointCaption = new Label({ text: _("Dew Point") + LocalizedColon(config.currentLocale), style: textColorStyle });
		// APi Unique Caption
		this.apiUniqueCaption = new Label({ text: '', style: textColorStyle });

		const [windCaption, windLabel] = this.windBox.Rebuild(config, textColorStyle);

		const rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS })
		const rb_values = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_VALUES })
		rb_captions.add_actor(this.temperatureCaption);
		rb_captions.add_actor(this.humidityCaption);
		rb_captions.add_actor(this.pressureCaption);
		rb_captions.add_actor(windCaption);
		rb_captions.add_actor(this.dewPointCaption);
		rb_captions.add_actor(this.apiUniqueCaption);
		rb_values.add_actor(this.temperatureLabel);
		rb_values.add_actor(this.humidityLabel);
		rb_values.add_actor(this.pressureLabel);
		rb_values.add_actor(windLabel);
		rb_values.add_actor(this.dewPointLabel);
		rb_values.add_actor(this.apiUniqueLabel);

		const rightColumn = new BoxLayout({ style_class: STYLE_DATABOX });
		rightColumn.add_actor(rb_captions);
		rightColumn.add_actor(rb_values);
		return rightColumn;
	}

	private BuildLocationSection() {
		this.locationButton = new WeatherButton({ reactive: true, label: _('Refresh'), });
		this.location = this.locationButton.actor;
		this.location.connect(SIGNAL_CLICKED, () => {
			if (this.app.encounteredError) this.app.RefreshWeather(true);
			else if (this.locationButton.url == null) return;
			else OpenUrl(this.locationButton);
		});

		this.nextLocationButton = new WeatherButton({
			reactive: true,
			can_focus: true,
			child: new Icon({
				icon_type: IconType.SYMBOLIC,
				icon_size: this.app.config.CurrentFontSize,
				icon_name: "custom-right-arrow-symbolic",
				style_class: STYLE_LOCATION_SELECTOR
			}),
		});
		this.nextLocationButton.actor.connect(SIGNAL_CLICKED, Lang.bind(this, this.NextLocationClicked));

		this.previousLocationButton = new WeatherButton({
			reactive: true,
			can_focus: true,
			child: new Icon({
				icon_type: IconType.SYMBOLIC,
				icon_size: this.app.config.CurrentFontSize,
				icon_name: "custom-left-arrow-symbolic",
				style_class: STYLE_LOCATION_SELECTOR
			}),
		});
		this.previousLocationButton.actor.connect(SIGNAL_CLICKED, Lang.bind(this, this.PreviousLocationClicked));

		const box = new BoxLayout();
		box.add(this.previousLocationButton.actor, { x_fill: false, x_align: Align.START, y_align: Align.MIDDLE, expand: false });
		box.add(this.location, { x_fill: false, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: true });
		box.add(this.nextLocationButton.actor, { x_fill: false, x_align: Align.END, y_align: Align.MIDDLE, expand: false });
		return box;
	}

	// Data display helpers

	private SetImmediatePrecipitation(precip: ImmediatePrecipitation | undefined, config: Config): void {
		if (!config._immediatePrecip || !precip || precip.end == null || precip.start == null) {
			this.immediatePrecipitationBox.hide();
			return;
		}

		this.immediatePrecipitationBox.show()
		if (precip.start == -1) {
			this.immediatePrecipitationBox.hide()
		}
		else if (precip.start == 0) {
			if (precip.end != -1)
				this.immediatePrecipitationLabel.text = _("Precipitation will end in {precipEnd} minutes", { precipEnd: precip.end });
			else
				this.immediatePrecipitationLabel.text = _("Precipitation won't end in within an hour");
		}
		else {
			this.immediatePrecipitationLabel.text = _("Precipitation will start within {precipStart} minutes", { precipStart: precip.start });
		}
	}

	private SetAPIUniqueField(extra_field?: APIUniqueField) {
		if (extra_field == null) {
			this.apiUniqueCaption.set_style_class_name(STYLE_HIDDEN);
			this.apiUniqueLabel.set_style_class_name(STYLE_HIDDEN);
			return;
		}

		this.apiUniqueCaption.text = _(extra_field.name) + LocalizedColon(this.app.config.currentLocale);
		let value: string | null = null;
		switch (extra_field.type) {
			case "percent":
				value = PercentToLocale(extra_field.value, this.app.config.currentLocale);
				break;
			case "temperature":
				value = TempToUserConfig(extra_field.value, this.app.config);
				break;
			default:
				value = _(extra_field.value);
				break;
		}
		this.apiUniqueLabel.text = value ?? "";
		this.apiUniqueCaption.remove_style_class_name(STYLE_HIDDEN);
		this.apiUniqueLabel.remove_style_class_name(STYLE_HIDDEN);
	}

	private SetDewPointField(dewPoint: number | null): void {
		if (dewPoint == null) {
			this.dewPointCaption.set_style_class_name(STYLE_HIDDEN);
			this.dewPointLabel.set_style_class_name(STYLE_HIDDEN);
			return;
		}

		const temp = TempToUserConfig(dewPoint, this.app.config);
		this.dewPointCaption.remove_style_class_name(STYLE_HIDDEN);
		this.dewPointLabel.remove_style_class_name(STYLE_HIDDEN);
		this.dewPointLabel.text = temp;
	}

	private SetWeatherIcon(iconNames: BuiltinIcons[], customIconName: string) {
		if (this.app.config._useCustomMenuIcons) {
			this.weatherIcon.icon_name = customIconName;
			this.UpdateIconType(IconType.SYMBOLIC); // Hard set to symbolic as IconSet is symbolic
		}
		else {
			const icon = WeatherIconSafely(iconNames, this.app.config.IconType);
			this.weatherIcon.icon_name = icon;
			this.UpdateIconType(this.app.config.IconType); // Revert to user setting
		}
	}

	private SetConditionText(condition: string) {
		this.weatherSummary.text = condition;
	}

	private SetTemperature(temperature: number | null) {
		if (temperature == null) {
			this.temperatureCaption.set_style_class_name(STYLE_HIDDEN);
			this.temperatureLabel.set_style_class_name(STYLE_HIDDEN);
			return;
		}

		const temp = TempToUserConfig(temperature, this.app.config);
		this.temperatureLabel.text = temp;
		this.temperatureCaption.remove_style_class_name(STYLE_HIDDEN);
		this.temperatureLabel.remove_style_class_name(STYLE_HIDDEN);
	}

	private SetHumidity(humidity: number | null) {
		if (humidity == null) {
			this.humidityCaption.set_style_class_name(STYLE_HIDDEN);
			this.humidityLabel.set_style_class_name(STYLE_HIDDEN);
			return;
		}

		this.humidityLabel.text = PercentToLocale(humidity, this.app.config.currentLocale);
		this.humidityCaption.remove_style_class_name(STYLE_HIDDEN);
		this.humidityLabel.remove_style_class_name(STYLE_HIDDEN);
	}

	private SetPressure(pressure: number | null) {
		if (pressure == null) {
			this.pressureCaption.set_style_class_name(STYLE_HIDDEN);
			this.pressureLabel.set_style_class_name(STYLE_HIDDEN);
			return;
		}

		this.pressureLabel.text = PressToUserUnits(pressure, this.app.config._pressureUnit) + ' ' + _(this.app.config._pressureUnit);
		this.pressureCaption.remove_style_class_name(STYLE_HIDDEN);
		this.pressureLabel.remove_style_class_name(STYLE_HIDDEN);
	}

	private SetLocation(locationString: string, url?: string) {
		this.location.label = locationString;
		if (!url)
			this.locationButton.disable();
		else
			this.locationButton.url = url;
	}

	// Callbacks

	private NextLocationClicked() {
		const loc = this.app.config.SwitchToNextLocation();
		this.app.Refresh(loc);
	}

	private PreviousLocationClicked() {
		const loc = this.app.config.SwitchToPreviousLocation();
		this.app.Refresh(loc);
	}

	private onLocationStorageChanged(sender: LocationStore, itemCount: number): void {
		Logger.Debug("On location storage callback called, number of locations now " + itemCount.toString());
		// Hide/show location selectors based on how many items are in storage
		if (this.app.config.LocStore.ShouldShowLocationSelectors(this.app.config.CurrentLocation))
			this.ShowLocationSelectors();
		else
			this.HideLocationSelectors();
	}

	// Utils

	private ShowLocationSelectors() {
		this.nextLocationButton?.actor?.show();
		this.previousLocationButton?.actor?.show();
	}

	private HideLocationSelectors() {
		this.nextLocationButton?.actor?.hide();
		this.previousLocationButton?.actor?.hide();
	}
}