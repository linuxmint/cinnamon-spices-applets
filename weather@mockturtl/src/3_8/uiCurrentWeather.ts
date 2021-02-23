import { OpenUrl } from "./commandRunner";
import { Config } from "./config";
import { ELLIPSIS, APPLET_ICON, SIGNAL_CLICKED, BLANK } from "./consts";
import { LocationStore } from "./locationstore";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { WeatherData, APIUniqueField, BuiltinIcons } from "./types";
import { _, GetHoursMinutes, TempToUserConfig, UnitToUnicode, CompassDirection, MPStoUserUnits, PressToUserUnits, GenerateLocationText, delay, WeatherIconSafely, LocalizedColon, PrecentToLocale } from "./utils";
import { WeatherButton } from "./weatherbutton";

const { Bin, BoxLayout, IconType, Label, Icon, Align } = imports.gi.St;
const Lang: typeof imports.lang = imports.lang;

// stylesheet.css
const STYLE_SUMMARYBOX = 'weather-current-summarybox'
const STYLE_SUMMARY = 'weather-current-summary'
const STYLE_DATABOX = 'weather-current-databox'
const STYLE_ICON = 'weather-current-icon'
const STYLE_ICONBOX = 'weather-current-iconbox'
const STYLE_DATABOX_CAPTIONS = 'weather-current-databox-captions'
const STYLE_ASTRONOMY = 'weather-current-astronomy'
const STYLE_DATABOX_VALUES = 'weather-current-databox-values'
const STYLE_CURRENT = 'current'
const STYLE_LOCATION_SELECTOR = 'location-selector'

export class CurrentWeather {
	public readonly actor: imports.gi.St.Bin;
	

    private weatherIcon: imports.gi.St.Icon;
    private weatherSummary: imports.gi.St.Label;

	private locationButton: WeatherButton;
	/** Actor inside locationButton */
    private location: imports.gi.St.Button;

    private previousLocationButton: WeatherButton;
    private nextLocationButton: WeatherButton;

	/** If config._showSunrise is not true this can be null|deallocated */
	private sunriseLabel: imports.gi.St.Label;
	/** If config._showSunrise is not true this can be null|deallocated */
    private sunsetLabel: imports.gi.St.Label;
    private temperatureLabel: imports.gi.St.Label;
    private humidityLabel: imports.gi.St.Label;
    private pressureLabel: imports.gi.St.Label;
	private windLabel: imports.gi.St.Label;
	private windDirectionIcon: imports.gi.St.Icon;
    private apiUniqueLabel: imports.gi.St.Label;
    private apiUniqueCaptionLabel: imports.gi.St.Label;

	private app: WeatherApplet;

    constructor(app: WeatherApplet) {
		this.app = app;
		this.actor = new Bin();
		this.actor.style_class = STYLE_CURRENT;
		this.app.config.LocStore.StoreChanged.Subscribe((s, a) => this.onLocationStorageChanged(s, a)); //on location store change
	}
	
	/** Injects data from weather object into the popupMenu */
	public Display(weather: WeatherData, config: Config): boolean {
		try {
			// Hide/show location selectors based on how many items are in storage
			if (this.app.config.LocStore.ShouldShowLocationSelectors(config.CurrentLocation)) this.ShowLocationSelectors();
			else this.HideLocationSelectors();

			let location = GenerateLocationText(weather, config);
			this.SetLocation(location, weather.location.url);
			this.SetConditionText(weather.condition.description);
			this.SetWeatherIcon(weather.condition.icons, weather.condition.customIcon);
			this.SetTemperature(weather.temperature);
			this.SetHumidity(weather.humidity);
			this.SetWind(weather.wind.speed, weather.wind.degree);
			this.SetPressure(weather.pressure);
			this.SetAPIUniqueField(weather.extra_field);
			if (config._showSunrise)
				this.SetSunriseAndSunset(weather.sunrise, weather.sunset, weather.location.timeZone);
			
			return true;
		} catch (e) {
			Log.Instance.Error("DisplayWeatherError: " + e);
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
        let box = new BoxLayout({ style_class: STYLE_ICONBOX })
		box.add_actor(this.weatherIcon)
		box.add_actor(this.BuildMiddleColumn(config, textColorStyle));
        box.add_actor(this.BuildRightColumn(textColorStyle, config))
        this.actor.set_child(box)
	};

	// Build helpers

	BuildMiddleColumn(config: Config, textColorStyle: string) {
		this.weatherSummary = new Label({ text: _('Loading ...'), style_class: STYLE_SUMMARY })

        let middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX })
        middleColumn.add_actor(this.BuildLocationSection())
        middleColumn.add(this.weatherSummary, { expand: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, x_fill: false, y_fill: false })
		
		if (config._showSunrise)
			middleColumn.add_actor(this.BuildSunBox(config, textColorStyle));
			
		return middleColumn;
	}

	/** Builds Weather Information on the right side */
	BuildRightColumn(textColorStyle: string, config: Config) {
        let textOb = {
            text: ELLIPSIS
        }
        // Current Weather Right Column
        this.temperatureLabel = new Label(textOb)
        this.humidityLabel = new Label(textOb)
        this.pressureLabel = new Label(textOb)

        this.apiUniqueLabel = new Label({ text: '' })
        // APi Unique Caption
        this.apiUniqueCaptionLabel = new Label({ text: '', style: textColorStyle });

        let rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS })
        let rb_values = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_VALUES })
        rb_captions.add_actor(new Label({ text: _('Temperature') + LocalizedColon(config.currentLocale), style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: _('Humidity') + LocalizedColon(config.currentLocale), style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: _('Pressure') + LocalizedColon(config.currentLocale), style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: _('Wind') + LocalizedColon(config.currentLocale), style: textColorStyle }));
        rb_captions.add_actor(this.apiUniqueCaptionLabel);
        rb_values.add_actor(this.temperatureLabel);
        rb_values.add_actor(this.humidityLabel);
        rb_values.add_actor(this.pressureLabel);
		rb_values.add_actor(this.BuildWind(config));
        //rb_values.add_actor(this.windLabel);
        rb_values.add_actor(this.apiUniqueLabel);

        let rightColumn = new BoxLayout({ style_class: STYLE_DATABOX });
        rightColumn.add_actor(rb_captions);
		rightColumn.add_actor(rb_values);
		return rightColumn;
	}

	BuildWind(config: Config) {
		let windBox = new BoxLayout({vertical: false});

		// We try to make sure that icon doesn't take up more vertical space than text
		// Also we position it close to the bottom to be perceived vertically centered
		let iconPaddingBottom = Math.round(config.CurrentFontSize * 0.05);
		let iconPaddingTop = Math.round(config.CurrentFontSize * 0.15);
		let iconSize = Math.round(config.CurrentFontSize * 0.8);

		this.windLabel = new Label({ text: ELLIPSIS });
		this.windDirectionIcon = new Icon({
			icon_type: IconType.SYMBOLIC,
			icon_name: APPLET_ICON,
			icon_size: iconSize,
			style: "padding-right: 5px; padding-top: " + iconPaddingTop + "px; padding-bottom: " + iconPaddingBottom + "px;"
		});
		windBox.add(this.windDirectionIcon, { x_fill: false, y_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: false });
		windBox.add(this.windLabel);

		return windBox;
	}

	BuildLocationSection() {
		this.locationButton = new WeatherButton({ reactive: true, label: _('Refresh'), });
		this.location = this.locationButton.actor;
		this.location.connect(SIGNAL_CLICKED, () => {
			if (this.app.encounteredError) this.app.RefreshWeather(true);
			else if (this.location.url == null) return;
			else OpenUrl(this.location);
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

		let box = new BoxLayout();
		box.add(this.previousLocationButton.actor, { x_fill: false, x_align: Align.START, y_align: Align.MIDDLE, expand: false });
		box.add(this.location, { x_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: true });
		box.add(this.nextLocationButton.actor, { x_fill: false, x_align: Align.END, y_align: Align.MIDDLE, expand: false });
		return box;
	}

	BuildSunBox(config: Config, textColorStyle: string) {
		// Bin is used here to horizontally center BoxLayout inside BoxLayout, normal add() function does not work here 
		let sunBin = new Bin();
		this.sunriseLabel = new Label({ text: ELLIPSIS, style: textColorStyle })
        this.sunsetLabel = new Label({ text: ELLIPSIS, style: textColorStyle })

        let sunriseBox = new BoxLayout();
        let sunsetBox = new BoxLayout();
        if (config._showSunrise) {
            let sunsetIcon = new Icon({
                icon_name: "sunset-symbolic",
                icon_type: IconType.SYMBOLIC,
                icon_size: 25,
                style: textColorStyle
            });

            let sunriseIcon = new Icon({
                icon_name: "sunrise-symbolic",
                icon_type: IconType.SYMBOLIC,
                icon_size: 25,
                style: textColorStyle
            });

            sunriseBox.add_actor(sunriseIcon);
            sunsetBox.add_actor(sunsetIcon);
        }

        let textOptions: imports.gi.St.AddOptions = {
            x_fill: false,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        }

        sunriseBox.add(this.sunriseLabel, textOptions);
        sunsetBox.add(this.sunsetLabel, textOptions);

        let ab_spacerLabel = new Label({ text: BLANK })

        let sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY })
        sunBox.add_actor(sunriseBox)
        sunBox.add_actor(ab_spacerLabel)
		sunBox.add_actor(sunsetBox);
		
		sunBin.set_child(sunBox);
		return sunBin;
	}

	// Data display helpers

    private SetSunriseAndSunset(sunrise: Date, sunset: Date, tz: string): void {
        let sunriseText = "";
        let sunsetText = "";
        if (sunrise != null && sunset != null && this.app.config._showSunrise) {
            sunriseText = (GetHoursMinutes(sunrise, this.app.config.currentLocale, this.app.config._show24Hours, tz));
            sunsetText = (GetHoursMinutes(sunset, this.app.config.currentLocale, this.app.config._show24Hours, tz));
        }

        this.sunriseLabel.text = sunriseText;
        this.sunsetLabel.text = sunsetText;
    }

    private SetAPIUniqueField(extra_field: APIUniqueField) {
        // API Unique display
        this.apiUniqueLabel.text = "";
        this.apiUniqueCaptionLabel.text = "";
        if (!!extra_field) {
            this.apiUniqueCaptionLabel.text = _(extra_field.name) + LocalizedColon(this.app.config.currentLocale);
            let value;
            switch (extra_field.type) {
                case "percent":
                    value = PrecentToLocale(extra_field.value, this.app.config.currentLocale);
                    break;
                case "temperature":
                    value = TempToUserConfig(extra_field.value, this.app.config.TemperatureUnit, this.app.config._tempRussianStyle) + " " + UnitToUnicode(this.app.config.TemperatureUnit);
                    break;
                default:
                    value = _(extra_field.value);
                    break;
            }
            this.apiUniqueLabel.text = value;
        }
    }

    private SetWeatherIcon(iconNames: BuiltinIcons[], customIconName: string) {
		if (this.app.config._useCustomMenuIcons) {
			this.weatherIcon.icon_name = customIconName;
			this.UpdateIconType(IconType.SYMBOLIC); // Hard set to symbolic as iconset is symbolic
		}
		else {
			let icon = WeatherIconSafely(iconNames, this.app.config.IconType);
			this.weatherIcon.icon_name = icon;
			this.UpdateIconType(this.app.config.IconType); // Revert to user setting
		}
	}

    private SetConditionText(condition: string) {
        this.weatherSummary.text = condition;
    }

    private SetTemperature(temperature: number) {
		let temp = TempToUserConfig(temperature, this.app.config.TemperatureUnit, this.app.config._tempRussianStyle);
		if (temp == null) return;
        this.temperatureLabel.text = temp + " " + UnitToUnicode(this.app.config.TemperatureUnit);
    }

    private SetHumidity(humidity: number) {
        if (humidity != null) {
            this.humidityLabel.text = PrecentToLocale(humidity, this.app.config.currentLocale);
        }
    }

    private async SetWind(windSpeed: number, windDegree: number) {
		let wind_direction = CompassDirection(windDegree);
		/*let arrows: ArrowIcons[] = ["north-arrow-weather-symbolic", "north-west-arrow-weather-symbolic", "west-arrow-weather-symbolic", "south-west-arrow-weather-symbolic", "south-arrow-weather-symbolic", "south-east-arrow-weather-symbolic", "east-arrow-weather-symbolic", "north-east-arrow-weather-symbolic"]
		for (let index = 0; index < arrows.length; index++) {
			const element = arrows[index];
			this.windDirectionIcon.icon_name = element;
			await delay(1000)
		}*/
		this.windDirectionIcon.icon_name = wind_direction;
		this.windLabel.text = MPStoUserUnits(windSpeed, this.app.config.WindSpeedUnit);
		// No need to display unit to Beaufort scale
		if (this.app.config.WindSpeedUnit != "Beaufort") this.windLabel.text += " " + _(this.app.config.WindSpeedUnit);
    }

    private SetPressure(pressure: number) {
        if (pressure != null) {
            this.pressureLabel.text = PressToUserUnits(pressure, this.app.config._pressureUnit) + ' ' + _(this.app.config._pressureUnit);
        }
    }
	
	private SetLocation(locationString: string, url: string) {
		this.location.label = locationString;
		this.location.url = url;
		if (!url) this.locationButton.disable();
	}

	// Callbacks
	
	private NextLocationClicked() {
		let loc = this.app.config.SwitchToNextLocation();
		this.app.RefreshAndRebuild(loc);
    }

    private PreviousLocationClicked() {
		let loc = this.app.config.SwitchToPreviousLocation();
		this.app.RefreshAndRebuild(loc);
	}

	private onLocationStorageChanged(sender: LocationStore, itemCount: number): void {
        Log.Instance.Debug("On location storage callback called, number of locations now " + itemCount.toString());
        // Hide/show location selectors based on how many items are in storage
		if (this.app.config.LocStore.ShouldShowLocationSelectors(this.app.config.CurrentLocation))
			this.ShowLocationSelectors();
		else
			this.HideLocationSelectors();
	}

	// Utils

	private ShowLocationSelectors() {
		this.nextLocationButton.actor.show();
		this.previousLocationButton.actor.show();
	}

	private HideLocationSelectors() {
		this.nextLocationButton.actor.hide();
		this.previousLocationButton.actor.hide();
	}
}