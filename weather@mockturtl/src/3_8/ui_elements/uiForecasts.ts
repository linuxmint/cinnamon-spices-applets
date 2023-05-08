import { Config } from "../config";
import { APPLET_ICON } from "../consts";
import { Event } from "../lib/events";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { WeatherData } from "../types";
import { _, GetDayName, WeatherIconSafely, OnSameDay, TempRangeToUserConfig } from "../utils";
import { WeatherButton } from "../ui_elements/weatherbutton";
import { DateTime } from "luxon";

const { Bin, BoxLayout, Label, Icon, Widget } = imports.gi.St;
const { GridLayout, Orientation } = imports.gi.Clutter;

// stylesheet.css
const STYLE_FORECAST_ICON = 'weather-forecast-icon'
const STYLE_FORECAST_DATABOX = 'weather-forecast-databox'
const STYLE_FORECAST_DAY = 'weather-forecast-day'
const STYLE_FORECAST_SUMMARY = 'weather-forecast-summary'
const STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature'
const STYLE_FORECAST_BOX = 'weather-forecast-box'
const STYLE_FORECAST_CONTAINER = 'weather-forecast-container'
const STYLE_FORECAST = 'forecast'

export class UIForecasts {
	public actor: imports.gi.St.Bin;
	// TODO: Assert these properly
	private forecasts!: ForecastUI[];
	private grid!: imports.gi.Clutter.GridLayout;

	private app: WeatherApplet;

	public DayClicked: Event<WeatherButton, DateTime> = new Event();
	public DayHovered: Event<WeatherButton, DateTime> = new Event();

	// Callbacks with bound context, which has constant signature for event Subscription/unSubscription
	public DayClickedCallback: (sender: WeatherButton, event: imports.gi.Clutter.CrossingEvent | null) => void;
	public DayHoveredCallback: (sender: WeatherButton, event: imports.gi.Clutter.CrossingEvent) => void;

	constructor(app: WeatherApplet) {
		this.app = app;
		this.actor = new Bin({ style_class: STYLE_FORECAST });

		this.DayClickedCallback = (s, e) => this.OnDayClicked(s, e);
		this.DayHoveredCallback = (s, e) => this.OnDayHovered(s, e);
		this.app.config.ShowForecastDatesChanged.Subscribe(this.app.AfterRefresh(this.OnConfigChanged));
		this.app.config.TemperatureHighFirstChanged.Subscribe(this.app.AfterRefresh(this.OnConfigChanged));
		this.app.config.ForecastDaysChanged.Subscribe(this.app.AfterRefresh(this.OnForecastDaysChanged));
	}

	private OnConfigChanged = async (config: Config, showForecastDates: boolean, data: WeatherData) => {
		this.Display(data, config);
	}

	private OnForecastDaysChanged = async (config: Config, forecastDays: number, data: WeatherData) => {
		if (config.textColorStyle == null)
			return;
		this.Rebuild(config, config.textColorStyle);
		this.Display(data, config);
	}

	public UpdateIconType(iconType: imports.gi.St.IconType): void {
		if (!this.forecasts)
			return;

		for (const forecast of this.forecasts) {
			if (!forecast?.Icon)
				continue;

			forecast.Icon.icon_type = iconType;
		}
	}

	/** Injects data from forecasts array into popupMenu */
	public Display(weather: WeatherData, config: Config): boolean {
		try {
			if (!weather.forecasts)
				return false;

			if (this.forecasts.length > weather.forecasts.length)
				this.Rebuild(this.app.config, this.app.config.textColorStyle!, weather.forecasts.length);

			const len = Math.min(this.forecasts.length, weather.forecasts.length);
			for (let i = 0; i < len; i++) {
				const forecastData = weather.forecasts[i];
				const forecastUi = this.forecasts[i];

				// Weather Condition
				const comment = (config._shortConditions) ? forecastData.condition.main : forecastData.condition.description;

				// Day Names
				const dayName: string = GetDayName(forecastData.date, config.currentLocale, config._showForecastDates, weather.location.timeZone);
				forecastUi.Day.actor.label = dayName;

				forecastUi.Day.Hovered.Unsubscribe(this.DayHoveredCallback);
				forecastUi.Day.Clicked.Unsubscribe(this.DayClickedCallback);

				// Enable and subscribe to buttons what has hourly weathers
				let hasHourlyWeather: boolean = false;

				if (weather.hourlyForecasts != null) {
					for (let index = 0; index < this.app.GetMaxHourlyForecasts(); index++) {
						const element = weather.hourlyForecasts[index];
						if (!element)
							break;
						if (OnSameDay(element.date, forecastData.date)) {
							hasHourlyWeather = true;
							break;
						}
					}
				}

				// We set ID to the buttons as date so we can use them later on
				forecastUi.Day.ID = forecastData.date;

				if (hasHourlyWeather) {
					forecastUi.Day.enable();
					forecastUi.Day.Hovered.Subscribe(this.DayHoveredCallback);
					forecastUi.Day.Clicked.Subscribe(this.DayClickedCallback);
				}
				else {
					forecastUi.Day.disable();
				}

				forecastUi.Temperature.text = TempRangeToUserConfig(forecastData.temp_min, forecastData.temp_max, config);
				forecastUi.Summary.text = comment;
				forecastUi.Icon.icon_name = (config._useCustomMenuIcons) ? forecastData.condition.customIcon : WeatherIconSafely(forecastData.condition.icons, config.IconType);
			}
			return true;
		} catch (e) {
			this.app.ShowError({
				type: "hard",
				detail: "unknown",
				message: _("Forecast parsing failed, see logs for more details."),
				userError: false
			})
			if (e instanceof Error)
				Logger.Error("DisplayForecastError: " + e, e);
			return false;
		}
	};

	public Rebuild(config: Config, textColorStyle: string, availableHours: number | null = null): void {
		this.Destroy();

		this.forecasts = [];
		this.grid = new GridLayout({
			orientation: config._verticalOrientation ? Orientation.VERTICAL : Orientation.VERTICAL
		});
		this.grid.set_column_homogeneous(true);

		const table = new Widget({
			layout_manager: this.grid,
			style_class: STYLE_FORECAST_CONTAINER
		});

		this.actor.set_child(table);

		const maxDays = availableHours ?? this.app.GetMaxForecastDays();
		// User settings
		let maxRow = config._forecastRows;
		let maxCol = config._forecastColumns;

		// Fill vertically first by swapping max rows and max columns,
		// calculating correctly with the same code below
		if (config._verticalOrientation) {
			[maxRow, maxCol] = [maxCol, maxRow];
		}
		let curRow = 0;
		let curCol = 0;

		for (let i = 0; i < maxDays; i++) {
			const forecastWeather: ForecastUI = {} as ForecastUI;

			// proceed to next row
			if (curCol >= maxCol) {
				curRow++;
				curCol = 0;
			}

			// Reached the maximum number of rows
			if (curRow >= maxRow) break;

			forecastWeather.Icon = new Icon({
				icon_type: config.IconType,
				icon_size: 48,
				icon_name: APPLET_ICON,
				style_class: STYLE_FORECAST_ICON
			});

			forecastWeather.Day = new WeatherButton({
				style_class: STYLE_FORECAST_DAY,
				reactive: true,
				style: textColorStyle,
				/** Need the empty string here because when we change it later from null it can lose it's color */
				label: ""
			}, true);

			forecastWeather.Day.disable();

			forecastWeather.Summary = new Label({
				/*text: Placeholders.LOADING,*/
				style_class: STYLE_FORECAST_SUMMARY,
				reactive: true
			});

			forecastWeather.Temperature = new Label({
				/*text: Placeholders.LOADING,*/
				style_class: STYLE_FORECAST_TEMPERATURE
			});

			const by = new BoxLayout({
				vertical: true,
				style_class: STYLE_FORECAST_DATABOX
			});
			by.add(forecastWeather.Day.actor, { x_align: imports.gi.St.Align.START, expand: false, x_fill: false });
			by.add_actor(forecastWeather.Summary);
			by.add(forecastWeather.Temperature, {expand: true, x_fill: true});

			const bb = new BoxLayout({
				style_class: STYLE_FORECAST_BOX
			});

			bb.add_actor(forecastWeather.Icon);
			bb.add_actor(by);

			this.forecasts[i] = forecastWeather;
			if (!config._verticalOrientation) {
				this.grid.attach(bb, curCol, curRow, 1, 1);
			}
			else {
				// flip back column and row variables for correct display
				this.grid.attach(bb, curRow, curCol, 1, 1);
			}

			curCol++;
		}
	}

	/** Destroys forecast UI box */
	public Destroy(): void {
		if (this.actor.get_child() != null)
			this.actor.get_child().destroy()
	}

	private OnDayHovered(sender: WeatherButton, event: imports.gi.Clutter.CrossingEvent): void {
		Logger.Debug("Day Hovered: " + (sender.ID as DateTime).toJSDate().toDateString());
		this.DayHovered.Invoke(sender, sender.ID as DateTime);
	}

	private OnDayClicked(sender: WeatherButton, event: imports.gi.Clutter.CrossingEvent | null): void {
		Logger.Debug("Day Clicked: " + (sender.ID as DateTime).toJSDate().toDateString());
		this.DayClicked.Invoke(sender, sender.ID as DateTime);
	}
}

interface ForecastUI {
	Icon: imports.gi.St.Icon,
	Day: WeatherButton,
	Summary: imports.gi.St.Label,
	Temperature: imports.gi.St.Label,
}