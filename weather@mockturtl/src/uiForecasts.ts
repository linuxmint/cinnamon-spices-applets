import { Config } from "./config";
import { APPLET_ICON, ELLIPSIS, FORWARD_SLASH } from "./consts";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { WeatherData } from "./types";
import { TempToUserConfig, _, GetDayName, UnitToUnicode, WeatherIconSafely } from "./utils";

const { Bin, BoxLayout, Label, Icon, Widget } = imports.gi.St;
const { GridLayout } = imports.gi.Clutter;

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
    private forecasts: ForecastUI[];
	private grid: imports.gi.Clutter.GridLayout;

	private app: WeatherApplet;

	constructor(app: WeatherApplet) {
		this.app = app;
		this.actor = new Bin({ style_class: STYLE_FORECAST });
	}

	public UpdateIconType(iconType: imports.gi.St.IconType): void {
        if (!this.forecasts)
            return;

		for (let i = 0; i < this.forecasts.length; i++) {
            if (!this.forecasts[i]?.Icon)
                continue;
            
            this.forecasts[i].Icon.icon_type = iconType;
        }
	}

	/** Injects data from forecasts array into popupMenu */
    public Display(weather: WeatherData, config: Config): boolean {
        try {
            if (!weather.forecasts) return false;
            let len = Math.min(this.forecasts.length, weather.forecasts.length);
            for (let i = 0; i < len; i++) {
                let forecastData = weather.forecasts[i];
                let forecastUi = this.forecasts[i];

                let t_low = TempToUserConfig(forecastData.temp_min, config.TemperatureUnit, config._tempRussianStyle);
                let t_high = TempToUserConfig(forecastData.temp_max, config.TemperatureUnit, config._tempRussianStyle);

                let first_temperature = config._temperatureHighFirst ? t_high : t_low;
                let second_temperature = config._temperatureHighFirst ? t_low : t_high;

                // Weather Condition
                let comment = (config._shortConditions) ? forecastData.condition.main : forecastData.condition.description;

                // Day Names
                let dayName: string = GetDayName(forecastData.date, config.currentLocale, config._showForecastDates, weather.location.timeZone);

                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature;
                // As Russian Tradition, -temp...+temp
                // See https://github.com/linuxmint/cinnamon-spices-applets/issues/618
                forecastUi.Temperature.text += ((config._tempRussianStyle) ? ELLIPSIS : " " + FORWARD_SLASH + " ");
                forecastUi.Temperature.text += second_temperature + ' ' + UnitToUnicode(config.TemperatureUnit);
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = (config._useCustomMenuIcons) ? forecastData.condition.customIcon : WeatherIconSafely(forecastData.condition.icons, config.IconType);
            }
            return true;
        } catch (e) {
            this.app.ShowError({
                type: "hard",
                detail: "unknown",
                message: "Forecast parsing failed: " + e.toString(),
                userError: false
            })
            Log.Instance.Error("DisplayForecastError " + e);
            return false;
        }
	};
	
	public Rebuild(config: Config, textColorStyle: string): void {
        this.Destroy();

        this.forecasts = [];
        this.grid = new GridLayout({
            orientation: config._verticalOrientation
        });
        this.grid.set_column_homogeneous(true);

        let table = new Widget({
            layout_manager: this.grid,
            style_class: STYLE_FORECAST_CONTAINER
        });

        this.actor.set_child(table);

        let maxDays = this.app.GetMaxForecastDays();
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
            let forecastWeather: ForecastUI = {} as ForecastUI;

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

            forecastWeather.Day = new Label({
                style_class: STYLE_FORECAST_DAY,
                reactive: true,
                style: textColorStyle
            });

            forecastWeather.Summary = new Label({
                /*text: Placeholders.LOADING,*/
                style_class: STYLE_FORECAST_SUMMARY,
                reactive: true
            });

            forecastWeather.Temperature = new Label({
                /*text: Placeholders.LOADING,*/
                style_class: STYLE_FORECAST_TEMPERATURE
            });

            let by = new BoxLayout({
                vertical: true,
                style_class: STYLE_FORECAST_DATABOX
            });
            by.add_actor(forecastWeather.Day);
            by.add_actor(forecastWeather.Summary);
            by.add_actor(forecastWeather.Temperature);

            let bb = new BoxLayout({
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
}

interface ForecastUI {
    Icon: imports.gi.St.Icon,
    Day: imports.gi.St.Label,
    Summary: imports.gi.St.Label,
    Temperature: imports.gi.St.Label,
}