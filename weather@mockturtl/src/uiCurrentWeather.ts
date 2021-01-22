import { Config } from "./config";
import { ELLIPSIS, APPLET_ICON, SIGNAL_CLICKED, BLANK } from "./consts";
import { LocationStore } from "./locationstore";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { WeatherData, APIUniqueField } from "./types";
import { UI } from "./ui";
import { _, AwareDateString, nonempty, GetHoursMinutes, TempToUserConfig, UnitToUnicode, compassDirection, MPStoUserUnits, PressToUserUnits } from "./utils";
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
    private _currentWeatherIcon: imports.gi.St.Icon;
    private _currentWeatherSummary: imports.gi.St.Label;

    private _locationBox: imports.gi.St.BoxLayout;

    private _locationButton: WeatherButton;
    private _currentWeatherLocation: imports.gi.St.Button;

    private _previousLocationButton: WeatherButton;
    private _nextLocationButton: WeatherButton;

    private _currentWeatherSunrise: imports.gi.St.Label;
    private _currentWeatherSunset: imports.gi.St.Label;
    private _currentWeatherTemperature: imports.gi.St.Label;
    private _currentWeatherHumidity: imports.gi.St.Label;
    private _currentWeatherPressure: imports.gi.St.Label;
    private _currentWeatherWind: imports.gi.St.Label;
    private _currentWeatherApiUnique: imports.gi.St.Label;
    private _currentWeatherApiUniqueCap: imports.gi.St.Label;

	private app: WeatherApplet;
	//private ui: UI;

    constructor(app: WeatherApplet, ui: UI) {
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

			let location = this.GenerateLocationText(weather);

			this.app.SetAppletTooltip(location + " - " + _("As of") + " " + AwareDateString(weather.date, this.app.config.currentLocale, config._show24Hours));
			this.app.DisplayWeatherOnLabel(weather.temperature, weather.condition.description);
			this.app.SetAppletIcon(weather.condition.icon, weather.condition.customIcon);

			this.SetLocation(location, weather.location.url);
			this.SetConditionText(weather.condition.description);
			this.SetWeatherIcon(weather.condition.icon, weather.condition.customIcon);
			this.SetTemperature(weather.temperature);
			this.SetHumidity(weather.humidity);
			this.SetWind(weather.wind.speed, weather.wind.degree);
			this.SetPressure(weather.pressure);
			this.SetAPIUniqueField(weather.extra_field);
			this.SetSunriseAndSunset(weather.sunrise, weather.sunset, weather.location.timeZone);
			
			return true;
		} catch (e) {
			Log.Instance.Error("DisplayWeatherError: " + e);
			return false;
		}
	};

    public UpdateIconType(iconType: imports.gi.St.IconType) {
        this._currentWeatherIcon.icon_type = iconType;
	}

	/** Destroys current weather UI box */
    public Destroy(): void {
        if (this.actor.get_child() != null)
            this.actor.get_child().destroy()
    }

    public Rebuild(config: Config, textColorStyle: string): void {
        this.Destroy()
        let textOb = {
            text: ELLIPSIS
        }

        // This will hold the icon for the current weather
        this._currentWeatherIcon = new Icon({
            icon_type: config.IconType,
            icon_size: 64,
            icon_name: APPLET_ICON,
            style_class: STYLE_ICON
        })

        // Current Weather Middle Column
        this._locationButton = new WeatherButton({ reactive: true, label: _('Refresh'), });
        this._currentWeatherLocation = this._locationButton.actor;
        this._currentWeatherLocation.connect(SIGNAL_CLICKED, () => {
            if (this.app.encounteredError) this.app.RefreshWeather(true);
            else if (this._currentWeatherLocation.url == null) return;
            else this.app.OpenUrl(this._currentWeatherLocation);
        });

        this._nextLocationButton = new WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: 10,
                icon_name: "custom-right-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this._nextLocationButton.actor.connect(SIGNAL_CLICKED, Lang.bind(this, this.NextLocationClicked));

        this._previousLocationButton = new WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: 10,
                icon_name: "custom-left-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this._previousLocationButton.actor.connect(SIGNAL_CLICKED, Lang.bind(this, this.PreviousLocationClicked));

        this._locationBox = new BoxLayout();
        this._locationBox.add(this._previousLocationButton.actor, { x_fill: false, x_align: Align.START, y_align: Align.MIDDLE, expand: false });
        this._locationBox.add(this._currentWeatherLocation, { x_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: true });
        this._locationBox.add(this._nextLocationButton.actor, { x_fill: false, x_align: Align.END, y_align: Align.MIDDLE, expand: false });

        // Sunset/sunrise
        this._currentWeatherSummary = new Label({ text: _('Loading ...'), style_class: STYLE_SUMMARY })
        this._currentWeatherSunrise = new Label({ text: ELLIPSIS, style: textColorStyle })
        this._currentWeatherSunset = new Label({ text: ELLIPSIS, style: textColorStyle })

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

        sunriseBox.add(this._currentWeatherSunrise, textOptions);
        sunsetBox.add(this._currentWeatherSunset, textOptions);

        let ab_spacerLabel = new Label({ text: BLANK })

        let sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY })
        sunBox.add_actor(sunriseBox)
        sunBox.add_actor(ab_spacerLabel)
        sunBox.add_actor(sunsetBox);

        let middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX })
        middleColumn.add_actor(this._locationBox)
        middleColumn.add(this._currentWeatherSummary, { expand: true, x_align: Align.START, y_align: Align.MIDDLE, x_fill: false, y_fill: false })

        // Bin is used here to horizontally center BoxLayout inside BoxLayout, normal add() function does not work here 
        let sunBin = new Bin();
        sunBin.set_child(sunBox);
        middleColumn.add_actor(sunBin);

        // Current Weather Right Column
        this._currentWeatherTemperature = new Label(textOb)
        this._currentWeatherHumidity = new Label(textOb)
        this._currentWeatherPressure = new Label(textOb)
        this._currentWeatherWind = new Label(textOb)
        this._currentWeatherApiUnique = new Label({ text: '' })
        // APi Unique Caption
        this._currentWeatherApiUniqueCap = new Label({ text: '', style: textColorStyle });

        let rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS })
        let rb_values = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_VALUES })
        rb_captions.add_actor(new Label({ text: _('Temperature') + ":", style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: _('Humidity') + ":", style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: _('Pressure') + ":", style: textColorStyle }));
        rb_captions.add_actor(new Label({ text: _('Wind') + ":", style: textColorStyle }));
        rb_captions.add_actor(this._currentWeatherApiUniqueCap);
        rb_values.add_actor(this._currentWeatherTemperature);
        rb_values.add_actor(this._currentWeatherHumidity);
        rb_values.add_actor(this._currentWeatherPressure);
		/*let windBox = new BoxLayout({vertical: false});
		let windIcon = new Icon({icon_type: IconType.SYMBOLIC, icon_name: "wind-symbolic", icon_size: 15});
		windBox.add_actor(windIcon);
		windBox.add_actor(this._currentWeatherWind);
		rb_values.add_actor(windBox);*/
        rb_values.add_actor(this._currentWeatherWind);
        rb_values.add_actor(this._currentWeatherApiUnique);

        let rightColumn = new BoxLayout({ style_class: STYLE_DATABOX });
        rightColumn.add_actor(rb_captions);
        rightColumn.add_actor(rb_values);

        // Current Weather Main Boxes
        let weatherBox = new BoxLayout();
        weatherBox.add_actor(middleColumn)
        weatherBox.add_actor(rightColumn)

        let box = new BoxLayout({ style_class: STYLE_ICONBOX })
        box.add_actor(this._currentWeatherIcon)
        box.add_actor(weatherBox)
        this.actor.set_child(box)
	};

	// Data display helpers

    private SetSunriseAndSunset(sunrise: Date, sunset: Date, tz: string): void {
        let sunriseText = "";
        let sunsetText = "";
        if (sunrise != null && sunset != null && this.app.config._showSunrise) {
            sunriseText = (GetHoursMinutes(sunrise, this.app.config.currentLocale, this.app.config._show24Hours, tz));
            sunsetText = (GetHoursMinutes(sunset, this.app.config.currentLocale, this.app.config._show24Hours, tz));
        }

        this._currentWeatherSunrise.text = sunriseText;
        this._currentWeatherSunset.text = sunsetText;
    }

    private SetAPIUniqueField(extra_field: APIUniqueField) {
        // API Unique display
        this._currentWeatherApiUnique.text = "";
        this._currentWeatherApiUniqueCap.text = "";
        if (!!extra_field) {
            this._currentWeatherApiUniqueCap.text = _(extra_field.name) + ":";
            let value;
            switch (extra_field.type) {
                case "percent":
                    value = extra_field.value.toString() + "%";
                    break;
                case "temperature":
                    value = TempToUserConfig(extra_field.value, this.app.config.TemperatureUnit, this.app.config._tempRussianStyle) + " " + UnitToUnicode(this.app.config.TemperatureUnit);
                    break;
                default:
                    value = _(extra_field.value);
                    break;
            }
            this._currentWeatherApiUnique.text = value;
        }
    }

    private SetWeatherIcon(iconName: string, customIconName: string) {
		if (this.app.config._useCustomMenuIcons) {
			this._currentWeatherIcon.icon_name = customIconName;
			this.UpdateIconType(IconType.SYMBOLIC); // Hard set to symbolic as iconset is symbolic
		}
		else {
			if (iconName == null) {
				iconName = "weather-severe-alert";
			}
			this._currentWeatherIcon.icon_name = iconName;
			this.UpdateIconType(this.app.config.IconType); // Revert to user setting
		}
	}

    private SetConditionText(condition: string) {
        this._currentWeatherSummary.text = condition;
    }

    private SetTemperature(temperature: number) {
		let temp = TempToUserConfig(temperature, this.app.config.TemperatureUnit, this.app.config._tempRussianStyle);
		if (temp == null) return;
        this._currentWeatherTemperature.text = temp + " " + UnitToUnicode(this.app.config.TemperatureUnit);
    }

    private SetHumidity(humidity: number) {
        if (humidity != null) {
            this._currentWeatherHumidity.text = Math.round(humidity) + "%";
        }
    }

    private SetWind(windSpeed: number, windDegree: number) {
        let wind_direction = compassDirection(windDegree);
            this._currentWeatherWind.text =
                (wind_direction != undefined ? _(wind_direction) + " " : "") +
                MPStoUserUnits(windSpeed, this.app.config.WindSpeedUnit);
            // No need to display unit to Beaufort scale
            if (this.app.config.WindSpeedUnit != "Beaufort") this._currentWeatherWind.text += " " + _(this.app.config.WindSpeedUnit);
    }

    private SetPressure(pressure: number) {
        if (pressure != null) {
            this._currentWeatherPressure.text = PressToUserUnits(pressure, this.app.config._pressureUnit) + ' ' + _(this.app.config._pressureUnit);
        }
    }
	
	private SetLocation(locationString: string, url: string) {
		this._currentWeatherLocation.label = locationString;
		this._currentWeatherLocation.url = url;
		if (!url) this._locationButton.disable();
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

	private GenerateLocationText(weather: WeatherData) { 
		let location = "";
		if (weather.location.city != null && weather.location.country != null) {
			location = weather.location.city + ", " + weather.location.country;
		} else {
			location = Math.round(weather.coord.lat * 10000) / 10000 + ", " + Math.round(weather.coord.lon * 10000) / 10000;
		}

		// Overriding Location
		if (nonempty(this.app.config._locationLabelOverride)) {
			location = this.app.config._locationLabelOverride;
		}

		return location;
	}

	private ShowLocationSelectors() {
		this._nextLocationButton.actor.show();
		this._previousLocationButton.actor.show();
	}

	private HideLocationSelectors() {
		this._nextLocationButton.actor.hide();
		this._previousLocationButton.actor.hide();
	}
}