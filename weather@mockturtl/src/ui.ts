import { Config, DistanceUnits } from "./config";
import { ELLIPSIS, FORWARD_SLASH, APPLET_ICON, SIGNAL_CLICKED } from "./consts";
import { CurrentWeather } from "./uiCurrentWeather";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { WeatherData, WeatherProvider, HourlyForecastData } from "./types";
import { shadeHexColor, delay, capitalizeFirstLetter, _, AwareDateString, TempToUserConfig, GetHoursMinutes, GetDayName, MetreToUserUnits, MillimeterToUserUnits, UnitToUnicode } from "./utils";
import { WeatherButton } from "./weatherbutton";

const { PopupMenuManager, PopupSeparatorMenuItem } = imports.ui.popupMenu;
const { Bin, BoxLayout, Side, IconType, Label, ScrollView, Icon, Align, Widget } = imports.gi.St;
const { PolicyType } = imports.gi.Gtk;
const { addTween } = imports.ui.tweener;
const Lang: typeof imports.lang = imports.lang;
const { GridLayout } = imports.gi.Clutter;
const { AppletPopupMenu } = imports.ui.applet;
const { themeManager } = imports.ui.main;
const { SignalManager } = imports.misc.signalManager;

// stylesheet.css
const STYLE_FORECAST_ICON = 'weather-forecast-icon'
const STYLE_FORECAST_DATABOX = 'weather-forecast-databox'
const STYLE_FORECAST_DAY = 'weather-forecast-day'
const STYLE_FORECAST_SUMMARY = 'weather-forecast-summary'
const STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature'
const STYLE_FORECAST_BOX = 'weather-forecast-box'
const STYLE_FORECAST_CONTAINER = 'weather-forecast-container'
const STYLE_FORECAST = 'forecast'
const STYLE_WEATHER_MENU = 'weather-menu'
const STYLE_BAR = 'bottombar'

/** Roll-down Popup Menu */
export class UI {
    // Separators
    private _separatorArea: imports.ui.popupMenu.PopupSeparatorMenuItem;
    private _separatorArea2: imports.ui.popupMenu.PopupSeparatorMenuItem;
    private _separatorAreaHourly: imports.ui.popupMenu.PopupSeparatorMenuItem;

    private CurrentWeather: CurrentWeather;

    // Daily Weather
    private _futureWeather: imports.gi.St.Bin;
    private _forecast: ForecastUI[];
    private _forecastBox: imports.gi.Clutter.GridLayout;

    // Bottom Bar
    private _providerCredit: imports.gi.St.Button;
    private _bar: imports.gi.St.BoxLayout;
    private _hourlyButton: imports.gi.St.Button;
    private _timestamp: imports.gi.St.Label;

    // Hourly Weather
    private _hourlyScrollView: imports.gi.St.ScrollView;
    private _hourlyBox: imports.gi.St.BoxLayout;
    private _hourlyForecasts: HourlyForecastUI[];
    private _hourlyForecastBoxes: imports.gi.St.BoxLayout[];

    // State variables
    private hourlyToggled: boolean = false;
    private lightTheme: boolean = false;

    private readonly App: WeatherApplet;

    /** Roll down menu itself */
    private readonly menu: imports.ui.applet.AppletPopupMenu;
    private readonly menuManager: imports.ui.popupMenu.PopupMenuManager;
    private readonly signals: imports.misc.signalManager.SignalManager;

    constructor(app: WeatherApplet, orientation: imports.gi.St.Side) {
        this.App = app;
        this.menuManager = new PopupMenuManager(this.App);
        this.menu = new AppletPopupMenu(this.App, orientation);
        // this.menu.setCustomStyleClass and 
        //this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
        // Doesn't do shit, setting class on the box instead.
        this.menu.box.add_style_class_name(STYLE_WEATHER_MENU);
        Log.Instance.Debug("Popup Menu applied classes are: " + this.menu.box.get_style_class_name());
        this.menuManager.addMenu(this.menu);
        this.menuManager._signals.connect(this.menu, "open-state-changed", this.PopupMenuToggled, this);
        this.signals = new SignalManager();
        this.lightTheme = this.IsLightTheme();
        this.BuildPopupMenu();
        // Subscriptions
		this.signals.connect(themeManager, 'theme-set', this.OnThemeChanged, this); // on theme change
    }

	/**
	 * Resetting flags from Hourly scrollview when theme changed to 
	 * prevent incorrect height requests, rebuild 
	 * when switching between light and dark themes
	 * to recolor some of the text
	 */
    private OnThemeChanged(): void {
        this.HideHourlyWeather();
        let newThemeIsLight = this.IsLightTheme();
        // Theme changed between light and dark theme
        if (newThemeIsLight != this.lightTheme) {
            this.lightTheme = newThemeIsLight;
        }
        this.App.RefreshAndRebuild();
    }

	/**
	 * 
	 * @param color Background color
	 */
    private IsLightTheme(): boolean {
        // using foreground color, more reliable than background color (more themes has it)
		let color = this.menu.actor.get_theme_node().get_color("color");
        // luminance between 0 and 1
		let luminance = (2126 * color.red + 7152 * color.green + 722 * color.blue) / 10000 / 255;
		// Inverse, we assume the background color here
		luminance = Math.abs(1 - luminance);
        Log.Instance.Debug("Theme is Light: " + (luminance > 0.5));
        return (luminance > 0.5);
    }

	/**
	 * @returns color in hex styling
	 */
    private ForegroundColor(): string {
        // Get hex color without alpha, because it is not supported in css
        let hex = this.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
        return hex;
    }

    private GetTextColorStyle(): string {
        let hexColor = null;
        if (this.lightTheme) {
            // Darken default foreground color
            hexColor = shadeHexColor(this.ForegroundColor(), -0.40);
        }
        return "color: " + hexColor;
    }

    private async PopupMenuToggled(caller: any, data: any) {
        // data - true is opened, false is closed
        if (data == false) {
            await delay(100); // Closing after popup menu is closed 
            this.HideHourlyWeather();
        }
	}

    /** Creates the skeleton of the popup menu */
    private BuildPopupMenu(): void {
        //  Current Weather
        this.CurrentWeather = new CurrentWeather(this.App, this);
        //  Daily Weather
        this._futureWeather = new Bin({ style_class: STYLE_FORECAST });

        // Separators and removing styling to make them span full width 
        this._separatorArea = new PopupSeparatorMenuItem()
        this._separatorAreaHourly = new PopupSeparatorMenuItem();
        this._separatorArea2 = new PopupSeparatorMenuItem()
        this._separatorArea.actor.remove_style_class_name("popup-menu-item");
        this._separatorAreaHourly.actor.remove_style_class_name("popup-menu-item");
        this._separatorArea2.actor.remove_style_class_name("popup-menu-item");

        // Hourly Weather
        this._hourlyScrollView = new ScrollView(
            {
                hscrollbar_policy: PolicyType.AUTOMATIC,
                vscrollbar_policy: PolicyType.NEVER,
                x_fill: true,
                y_fill: true,
                y_align: Align.MIDDLE,
                x_align: Align.MIDDLE
            }
        );
        this._hourlyScrollView.overlay_scrollbars = true;
        // Stop event passing while scrolling to allow scrolling
        let vScroll = this._hourlyScrollView.get_vscroll_bar();
        vScroll.connect("scroll-start", () => { this.menu.passEvents = true; });
        vScroll.connect("scroll-stop", () => { this.menu.passEvents = false; });
        let hScroll = this._hourlyScrollView.get_hscroll_bar();
        hScroll.connect("scroll-start", () => { this.menu.passEvents = true; });
        hScroll.connect("scroll-stop", () => { this.menu.passEvents = false; });
        this._separatorAreaHourly.actor.hide();
        this._hourlyScrollView.hide();
        this._hourlyScrollView.set_clip_to_allocation(true);
        this._hourlyBox = new BoxLayout({ style_class: "hourly-box" });
        // Only add_actor works with ScrollView for some reason, not add_child
        // and only BoxLayout results in drawn stuff inside the ScrollView.
        // (Only Boxlayout and Viewport implements St.Scrollable needed inside a scrollview)
        this._hourlyScrollView.add_actor(this._hourlyBox)

        // Bottom bar
        this._bar = new BoxLayout({ vertical: false, style_class: STYLE_BAR });

        // Add everything to the PopupMenu
        let mainBox = new BoxLayout({ vertical: true })
        mainBox.add_actor(this.CurrentWeather.actor)
        mainBox.add_actor(this._separatorAreaHourly.actor);
        mainBox.add_actor(this._hourlyScrollView);
        mainBox.add_actor(this._separatorArea.actor)
        mainBox.add_actor(this._futureWeather)
        mainBox.add_actor(this._separatorArea2.actor)
        mainBox.add_actor(this._bar)
        this.menu.addActor(mainBox)
	}
	
	public Toggle(): void {
		this.menu.toggle();
	}

    /** Fully rebuilds UI */
    public Rebuild(config: Config): void {
        this.showLoadingUi();
        this.CurrentWeather.Rebuild(config, this.GetTextColorStyle());
        this.rebuildHourlyWeatherUi(config);
        this.rebuildFutureWeatherUi(config);
        this.rebuildBar(config);
    }

	/** Changes all icon's type what are affected by
	 * the "use symbolic icons" setting
	 */
    public UpdateIconType(iconType: imports.gi.St.IconType): void {
		if (iconType == IconType.FULLCOLOR && this.App.config._useCustomMenuIcons) return;
		this.CurrentWeather.ChangeIconType(iconType);
        for (let i = 0; i < this._forecast.length; i++) {
            this._forecast[i].Icon.icon_type = iconType;
        }
        for (let i = 0; i < this._hourlyForecasts.length; i++) {
            this._hourlyForecasts[i].Icon.icon_type = iconType;
        }
    }

    public DisplayErrorMessage(msg: string) {
        this._timestamp.text = msg;
	}

	public Display(weather: WeatherData, config: Config, provider: WeatherProvider): boolean {
		this.CurrentWeather.DisplayWeather(weather, config);
		this.DisplayForecast(weather, config);
		this.DisplayHourlyForecast(weather.hourlyForecasts, config, weather.location.timeZone);
		this.DisplayBar(weather, provider, config);
		return true;
	}

    /** Injects data from forecasts array into popupMenu */
    private DisplayForecast(weather: WeatherData, config: Config): boolean {
        try {
            if (!weather.forecasts) return false;
            let len = Math.min(this._forecast.length, weather.forecasts.length);
            for (let i = 0; i < len; i++) {
                let forecastData = weather.forecasts[i];
                let forecastUi = this._forecast[i];

                let t_low = TempToUserConfig(forecastData.temp_min, config.TemperatureUnit, config._tempRussianStyle);
                let t_high = TempToUserConfig(forecastData.temp_max, config.TemperatureUnit, config._tempRussianStyle);

                let first_temperature = config._temperatureHighFirst ? t_high : t_low;
                let second_temperature = config._temperatureHighFirst ? t_low : t_high;

                // Weather Condition
                let comment = "";
                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                    comment = (config._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
                    comment = capitalizeFirstLetter(comment);
                    if (config._translateCondition) comment = _(comment);
                }

                // Day Names
                let dayName: string = GetDayName(forecastData.date, this.App.config.currentLocale, this.App.config._showForecastDates, weather.location.timeZone);

                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature;
                // As Russian Tradition, -temp...+temp
                // See https://github.com/linuxmint/cinnamon-spices-applets/issues/618
                forecastUi.Temperature.text += ((config._tempRussianStyle) ? ELLIPSIS : " " + FORWARD_SLASH + " ");
                forecastUi.Temperature.text += second_temperature + ' ' + UnitToUnicode(config.TemperatureUnit);
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = (config._useCustomMenuIcons) ? forecastData.condition.customIcon : forecastData.condition.icon;
            }
            return true;
        } catch (e) {
            this.App.ShowError({
                type: "hard",
                detail: "unknown",
                message: "Forecast parsing failed: " + e.toString(),
                userError: false
            })
            Log.Instance.Error("DisplayForecastError " + e);
            return false;
        }
    };

    private DisplayBar(weather: WeatherData, provider: WeatherProvider, config: Config): boolean {
        this._providerCredit.label = _("Powered by") + " " + provider.prettyName;
        this._providerCredit.url = provider.website;
        this._timestamp.text = _("As of") + " " + AwareDateString(weather.date, this.App.config.currentLocale, config._show24Hours);
        if (weather.location.distanceFrom != null) {
            this._timestamp.text += (
                ", " + MetreToUserUnits(weather.location.distanceFrom, this.App.config.DistanceUnit)
                + this.BigDistanceUnitFor(this.App.config.DistanceUnit) + " " + _("from you")
            );
        }
        return true;
    }

    private DisplayHourlyForecast(forecasts: HourlyForecastData[], config: Config, tz: string): boolean {
        let max = Math.min(forecasts.length, this._hourlyForecasts.length);
        for (let index = 0; index < max; index++) {
            const hour = forecasts[index];
            const ui = this._hourlyForecasts[index];

            ui.Hour.text = GetHoursMinutes(hour.date, this.App.config.currentLocale, config._show24Hours, tz, this.App.config._shortHourlyTime);
            ui.Temperature.text = TempToUserConfig(hour.temp, config.TemperatureUnit, config._tempRussianStyle) + " " + UnitToUnicode(config.TemperatureUnit);
            ui.Icon.icon_name = (config._useCustomMenuIcons) ? hour.condition.customIcon : hour.condition.icon;

            hour.condition.main = capitalizeFirstLetter(hour.condition.main);
            if (config._translateCondition) hour.condition.main = _(hour.condition.main);
            ui.Summary.text = hour.condition.main;
            if (!!hour.precipitation && hour.precipitation.type != "none") {
                let precipitationText = null;
                if (!!hour.precipitation.volume && hour.precipitation.volume > 0) {
                    precipitationText = MillimeterToUserUnits(hour.precipitation.volume, this.App.config.DistanceUnit) + " " + ((this.App.config.DistanceUnit == "metric") ? _("mm") : _("in"));
                }
                if (!!hour.precipitation.chance) {
                    precipitationText = (precipitationText == null) ? "" : (precipitationText + ", ")
                    precipitationText += (Math.round(hour.precipitation.chance).toString() + "%")
                }
                if (precipitationText != null) ui.Precipitation.text = precipitationText;
            }
        }

        this.AdjustHourlyBoxItemWidth();

        if (max <= 0) this.HideHourlyToggle();

        return true;
	}
	
	private ShowHourlyWeather(): void {
        // In some cases the preferred height is not calculated
        // properly for the first time, so we work around by opening and closing it once
        this._hourlyScrollView.show();
        this._hourlyScrollView.hide();

        this.AdjustHourlyBoxItemWidth();

        let [minWidth, naturalWidth] = this._hourlyScrollView.get_preferred_width(-1);
        let [minHeight, naturalHeight] = this._hourlyScrollView.get_preferred_height(minWidth);
        Log.Instance.Debug("hourlyScrollView requested height and is set to: " + naturalHeight);
        this._hourlyScrollView.set_width(minWidth);
        this._separatorAreaHourly.actor.show();
        if (!!this._hourlyButton.child) this._hourlyButton.child.icon_name = "custom-up-arrow-symbolic";
		this._hourlyScrollView.show();
		// When the scrollView is shown without animation and there is not enough vertical space
		// (or cinnamon does not think there is enough), the text gets superimposed on top of
		// each other.
		// setting the min-height forces to draw with the view's requested height without
		// interfering with animations.
		this._hourlyScrollView.style = "min-height: " + naturalHeight.toString() + "px;";

        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            this._hourlyScrollView.height = 0;
            addTween(this._hourlyScrollView,
                {
                    height: naturalHeight,
                    time: 0.25,
                    onUpdate: () => { },
                    onComplete: () => {
                        this._hourlyScrollView.set_height(naturalHeight);
                    }
                });
        }

        this.hourlyToggled = true;
    }

    private HideHourlyWeather(): void {
        this._separatorAreaHourly.actor.hide();
        let hscroll = this._hourlyScrollView.get_hscroll_bar();
        if (!!this._hourlyButton.child) this._hourlyButton.child.icon_name = "custom-down-arrow-symbolic";
        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            // TODO: eliminate Clutter Warnings on collapse in logs
            addTween(this._hourlyScrollView,
                {
                    height: 0,
                    time: 0.25,
                    onUpdate: () => { },
                    onComplete: () => {
                        this._hourlyScrollView.set_height(-1);
                        this._hourlyScrollView.hide();
                        // Scroll back to the start
                        hscroll.get_adjustment().set_value(0);
                    }
                }
            );
        }
        else {
            this._hourlyScrollView.set_height(-1);
            this._hourlyScrollView.hide();
        }
        this.hourlyToggled = false;
    }

    private ToggleHourlyWeather(): void {
        if (this.hourlyToggled) {
            this.HideHourlyWeather();
        }
        else {
            this.ShowHourlyWeather();
        }
    }	

	/** Calculates incorrect width the first time, make sure to call this
	 * after a show/hide iteration as well when the Hourly box is shown
	 */
    private AdjustHourlyBoxItemWidth(): void {
        let requiredWidth = 0;
        for (let index = 0; index < this._hourlyForecastBoxes.length; index++) {
            const ui = this._hourlyForecasts[index];
            let hourWidth = ui.Hour.get_preferred_width(-1)[1];
            let iconWidth = ui.Icon.get_preferred_width(-1)[1];
            let summaryWidth = ui.Summary.get_preferred_width(-1)[1];
            let temperatureWidth = ui.Temperature.get_preferred_width(-1)[1];
			let precipitationWidth = ui.Precipitation.get_preferred_width(-1)[1];

			// If text is bigger than icon we add some artificial padding
			// so text doesn't look too close
			if (precipitationWidth > iconWidth || summaryWidth > iconWidth) {
				if (precipitationWidth > summaryWidth) 
					precipitationWidth += 10;
				else
					summaryWidth += 10;
			}
            if (requiredWidth < hourWidth) requiredWidth = hourWidth;
            if (requiredWidth < iconWidth) requiredWidth = iconWidth;
            if (requiredWidth < summaryWidth) requiredWidth = summaryWidth;
            if (requiredWidth < temperatureWidth) requiredWidth = temperatureWidth;
            if (requiredWidth < precipitationWidth) requiredWidth = precipitationWidth;
        }

        for (let index = 0; index < this._hourlyForecastBoxes.length; index++) {
            const element = this._hourlyForecastBoxes[index];
            element.set_width(requiredWidth);
        }
    }

    private GetScrollViewHeight(): number {
        let boxItemHeight = 0;
        for (let index = 0; index < this._hourlyForecastBoxes.length; index++) {
            const ui = this._hourlyForecasts[index];

            Log.Instance.Debug("Height requests of Hourly box Items: " + index);
            let hourHeight = ui.Hour.get_preferred_height(-1)[1];
            let iconHeight = ui.Icon.get_preferred_height(-1)[1];
            let summaryHeight = ui.Summary.get_preferred_height(-1)[1];
            let temperatureHeight = ui.Temperature.get_preferred_height(-1)[1];
            let precipitationHeight = ui.Precipitation.get_preferred_height(-1)[1];
            let itemHeight = hourHeight + iconHeight + summaryHeight + temperatureHeight + precipitationHeight;
            if (boxItemHeight < itemHeight) boxItemHeight = itemHeight;
        }
        Log.Instance.Debug("Final Hourly box item height is: " + boxItemHeight)
        let scrollBarHeight = this._hourlyScrollView.get_hscroll_bar().get_preferred_width(-1)[1];
        Log.Instance.Debug("Scrollbar height is " + scrollBarHeight);
        let theme = this._hourlyBox.get_theme_node();
        let styling = theme.get_margin(Side.TOP) + theme.get_margin(Side.BOTTOM) + theme.get_padding(Side.TOP) + theme.get_padding(Side.BOTTOM);
        Log.Instance.Debug("ScollbarBox vertical padding and margin is: " + styling);

        return (boxItemHeight + scrollBarHeight + styling);
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

    /** Destroys forecast UI box */
    private destroyFutureWeather(): void {
        if (this._futureWeather.get_child() != null)
            this._futureWeather.get_child().destroy()
    }

    private destroyBar(): void {
        this._bar.destroy_all_children();
    }

    private destroyHourlyWeather(): void {
        this._hourlyBox.destroy_all_children();
    }

    /** Destroys UI first then shows initial UI */
    private showLoadingUi(): void {
        this.CurrentWeather.Destroy();
        this.destroyFutureWeather()
        this.destroyBar()
        this.CurrentWeather.actor.set_child(new Label({
            text: _('Loading current weather ...')
        }))
        this._futureWeather.set_child(new Label({
            text: _('Loading future weather ...')
        }))
    }

    private rebuildFutureWeatherUi(config: Config): void {
        this.destroyFutureWeather();

        this._forecast = [];
        this._forecastBox = new GridLayout({
            /*style_class: STYLE_FORECAST_CONTAINER,*/
            orientation: config._verticalOrientation
        });
        this._forecastBox.set_column_homogeneous(true);

        let table = new Widget({
            layout_manager: this._forecastBox,
            style_class: STYLE_FORECAST_CONTAINER
        });

        this._futureWeather.set_child(table);

        let maxDays = this.App.GetMaxForecastDays();
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
                style: this.GetTextColorStyle()
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

            this._forecast[i] = forecastWeather;
            if (!config._verticalOrientation) {
                this._forecastBox.attach(bb, curCol, curRow, 1, 1);
            }
            else {
                // flip back column and row variables for correct display
                this._forecastBox.attach(bb, curRow, curCol, 1, 1);
            }

            curCol++;
        }
    }

    private rebuildBar(config: Config) {
        this.destroyBar();
        this._timestamp = new Label({ text: "Placeholder" });
        this._bar.add(this._timestamp, {
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
                icon_size: 12,
                icon_name: "custom-down-arrow-symbolic"
            }),
        }).actor;
        this._hourlyButton.connect(SIGNAL_CLICKED, Lang.bind(this, this.ToggleHourlyWeather));
        this._bar.add(this._hourlyButton, {
            x_fill: false,
            x_align: Align.MIDDLE,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        })

        // Hide if Hourly forecasts are not supported
        if (this.App.GetMaxHourlyForecasts() <= 0) {
            this.HideHourlyToggle();
        }

        this._providerCredit = new WeatherButton({ label: _(ELLIPSIS), reactive: true }).actor;
        this._providerCredit.connect(SIGNAL_CLICKED, Lang.bind(this, this.App.OpenUrl));

        this._bar.add(this._providerCredit, {
            x_fill: false,
            x_align: Align.END,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        });
    }

    private HideHourlyToggle() {
        this._hourlyButton.child = null;
    }

    private rebuildHourlyWeatherUi(config: Config) {
        this.destroyHourlyWeather();
        let hours = this.App.GetMaxHourlyForecasts();
        this._hourlyForecasts = [];
        this._hourlyForecastBoxes = [];

        for (let index = 0; index < hours; index++) {
            let box = new BoxLayout({ vertical: true, style_class: "hourly-box-item" });
            this._hourlyForecastBoxes.push(box);

            this._hourlyForecasts.push({
                // Override color on light theme for grey text
                Hour: new Label({ text: "Hour", style_class: "hourly-time", style: this.GetTextColorStyle() }),
                Icon: new Icon({
                    icon_type: config.IconType,
                    icon_size: 24,
                    icon_name: APPLET_ICON,
                    style_class: "hourly-icon"
                }),
                Precipitation: new Label({ text: " ", style_class: "hourly-data" }),
                Summary: new Label({ text: _(ELLIPSIS), style_class: "hourly-data" }),
                Temperature: new Label({ text: _(ELLIPSIS), style_class: "hourly-data" })
            })

            this._hourlyForecasts[index].Summary.clutter_text.set_line_wrap(true);
            box.add_child(this._hourlyForecasts[index].Hour);
            box.add_child(this._hourlyForecasts[index].Icon);
            box.add_child(this._hourlyForecasts[index].Summary);
            box.add_child(this._hourlyForecasts[index].Temperature);
            box.add_child(this._hourlyForecasts[index].Precipitation);

            this._hourlyBox.add(box, {
                x_fill: true,
                x_align: Align.MIDDLE,
                y_align: Align.MIDDLE,
                y_fill: true,
                expand: true
            });
        }
    }
}
interface ForecastUI {
    Icon: imports.gi.St.Icon,
    Day: imports.gi.St.Label,
    Summary: imports.gi.St.Label,
    Temperature: imports.gi.St.Label,
}

interface HourlyForecastUI {
    Icon: imports.gi.St.Icon,
    Hour: imports.gi.St.Label,
    Summary: imports.gi.St.Label,
    Temperature: imports.gi.St.Label,
    Precipitation: imports.gi.St.Label
}