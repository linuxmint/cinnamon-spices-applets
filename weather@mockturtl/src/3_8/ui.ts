import { Config } from "./config";
import { CurrentWeather as UICurrentWeather } from "./ui_elements/uiCurrentWeather";
import { Logger } from "./lib/logger";
import { WeatherApplet } from "./main";
import { ErrorSeverity, WeatherData, WeatherProvider } from "./types";
import { ShadeHexColor, delay, _ } from "./utils";
import { UIForecasts } from "./ui_elements/uiForecasts";
import { UIHourlyForecasts } from "./ui_elements/uiHourlyForecasts";
import { UIBar } from "./ui_elements/uiBar";
import { UISeparator } from "./ui_elements/uiSeparator";
import { WeatherButton } from "./ui_elements/weatherbutton";
import { DateTime } from "luxon";

const { PopupMenuManager } = imports.ui.popupMenu;
const { BoxLayout, IconType, Label } = imports.gi.St;
const Lang: typeof imports.lang = imports.lang;
const { AppletPopupMenu } = imports.ui.applet;
const { themeManager } = imports.ui.main;
const { SignalManager } = imports.misc.signalManager;

// stylesheet.css
const STYLE_WEATHER_MENU = 'weather-menu'

/** Roll-down Popup Menu */
export class UI {
	// Separators
	private ForecastSeparator!: UISeparator;
	private BarSeparator!: UISeparator;
	private HourlySeparator!: UISeparator;

	private CurrentWeather!: UICurrentWeather;
	private FutureWeather!: UIForecasts;
	private HourlyWeather!: UIHourlyForecasts;
	private Bar!: UIBar;

	// State variables
	private lightTheme: boolean = false;

	private readonly App: WeatherApplet;

	/** Roll down menu itself */
	private readonly menu: imports.ui.applet.AppletPopupMenu;
	private readonly menuManager: imports.ui.popupMenu.PopupMenuManager;
	private readonly signals: imports.misc.signalManager.SignalManager;

	private noHourlyWeather: boolean = false;

	constructor(app: WeatherApplet, orientation: imports.gi.St.Side) {
		this.App = app;
		this.menuManager = new PopupMenuManager(this.App);
		this.menu = new AppletPopupMenu(this.App, orientation);
		// this.menu.setCustomStyleClass and
		//this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
		// Doesn't do shit, setting class on the box instead.
		this.menu.box.add_style_class_name(STYLE_WEATHER_MENU);
		Logger.Debug("Popup Menu applied classes are: " + this.menu.box.get_style_class_name());
		this.menuManager.addMenu(this.menu);
		this.menuManager._signals.connect(this.menu, "open-state-changed", this.PopupMenuToggled, this);
		this.signals = new SignalManager();
		this.lightTheme = this.IsLightTheme();
		this.BuildPopupMenu();
		// Subscriptions
		this.signals.connect(themeManager, 'theme-set', this.OnThemeChanged, this); // on theme change
		this.App.config.AlwaysShowHourlyWeatherChanged.Subscribe(this.App.AfterRefresh(this.OnConfigChanged));
	}

	private OnConfigChanged = (config: Config, confChange: any, data: WeatherData) => {
		if (this.App.Provider == null)
			return;
		this.Display(data, config, this.App.Provider);
	}

	public Toggle(): void {
		// Hourly weather is always open
		if (!this.noHourlyWeather && this.App.config._alwaysShowHourlyWeather) {
			if (this.menu.isOpen) {
				this.menu.close(true);
			}
			else {
				this.menu.open(false);
				// Showing hourly weather height calculation only works when it's visible
				// so we trigger it then, and we need it every time
				// so element width is set properly based on displayed text
				this.ShowHourlyWeather(false);
				this.menu.close(false);
				// Open it properly here
				this.menu.open(true);
			}
		}
		// Normal behaviour
		else {
			// Close hourly weather because it should always start closed.
			if (this.HourlyWeather.Toggled && !this.menu.isOpen)
				this.HideHourlyWeather(false);

			this.menu.toggle();
		}
	}

	public async ToggleHourlyWeather(): Promise<void> {
		if (this.HourlyWeather.Toggled) {
			await this.HideHourlyWeather();
		}
		else {
			await this.ShowHourlyWeather();
		}
	}

	/** Fully rebuilds UI */
	public Rebuild(config: Config): void {
		this.ShowLoadingUi();
		this.App.config.textColorStyle = this.GetTextColorStyle();
		this.CurrentWeather.Rebuild(config, this.App.config.textColorStyle);
		this.HourlyWeather.Rebuild(config, this.App.config.textColorStyle);
		this.FutureWeather.Rebuild(config, this.App.config.textColorStyle);
		this.Bar.Rebuild(config);
	}

	/** Changes all icon's type what are affected by
	 * the "use symbolic icons" setting
	 */
	public UpdateIconType(iconType: imports.gi.St.IconType): void {
		if (iconType == IconType.FULLCOLOR && this.App.config._useCustomMenuIcons) return;
		this.CurrentWeather.UpdateIconType(iconType);
		this.FutureWeather.UpdateIconType(iconType);
		this.HourlyWeather.UpdateIconType(iconType);
	}

	public DisplayErrorMessage(msg: string, errorType: ErrorSeverity) {
		this.Bar.DisplayErrorMessage(msg);
	}

	/**
	 * Displays weather info in Popup
	 * @param weather
	 * @param config
	 * @param provider
	 */
	public Display(weather: WeatherData, config: Config, provider: WeatherProvider): boolean {
		this.CurrentWeather.Display(weather, config);
		this.FutureWeather.Display(weather, config);
		const shouldShowToggle = this.HourlyWeather.Display(weather.hourlyForecasts, config, weather.location.timeZone);
		this.noHourlyWeather = !shouldShowToggle;
		// Hourly weather is not shown, make sure it's closed
		if (!shouldShowToggle)
			this.ForceHideHourlyWeather();

		this.Bar.Display(weather, provider, config, shouldShowToggle);
		return true;
	}

	// --------------------------------------------------------------------
	// Callbacks

	/**
	 * Resetting flags from Hourly scroll view when theme changed to
	 * prevent incorrect height requests, rebuild
	 * when switching between light and dark themes
	 * to recolor some of the text
	 */
	private OnThemeChanged(): void {
		this.HideHourlyWeather();
		const newThemeIsLight = this.IsLightTheme();
		// Theme changed between light and dark theme
		if (newThemeIsLight != this.lightTheme) {
			this.lightTheme = newThemeIsLight;
		}
		this.App.RefreshAndRebuild();
	}

	private async PopupMenuToggled(caller: any, data: any) {
		// data - true is opened, false is closed
		if (data == false) {
			await delay(100); // Closing after popup menu is closed
			this.HideHourlyWeather();
		}
	}

	// -------------------------------------------------------------------
	// Utils

	/**
	 *
	 * @param color Background color
	 */
	private IsLightTheme(): boolean {
		// using foreground color, more reliable than background color (more themes has it)
		const color = this.menu.actor.get_theme_node().get_color("color");
		// luminance between 0 and 1
		let luminance = (2126 * color.red + 7152 * color.green + 722 * color.blue) / 10000 / 255;
		// Inverse, we assume the background color here
		luminance = Math.abs(1 - luminance);
		Logger.Debug("Theme is Light: " + (luminance > 0.5));
		return (luminance > 0.5);
	}

	/**
	 * @returns color in hex styling
	 */
	private ForegroundColor(): string {
		// Get hex color without alpha, because it is not supported in css
		const hex = this.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
		return hex;
	}

	private GetTextColorStyle(): string {
		let hexColor: string | null = null;
		if (this.lightTheme) {
			// Darken default foreground color
			hexColor = ShadeHexColor(this.ForegroundColor(), -0.40);
		}
		return "color: " + hexColor;
	}

	/** Creates th skeleton of the popup menu */
	private BuildPopupMenu(): void {
		this.CurrentWeather = new UICurrentWeather(this.App);
		this.FutureWeather = new UIForecasts(this.App);
		this.HourlyWeather = new UIHourlyForecasts(this.App, this.menu);
		this.FutureWeather.DayClicked.Subscribe((s, e) => this.OnDayClicked(s, e));

		this.Bar = new UIBar(this.App);
		this.Bar.ToggleClicked.Subscribe(Lang.bind(this, this.ToggleHourlyWeather));

		this.ForecastSeparator = new UISeparator();
		this.HourlySeparator = new UISeparator();
		this.BarSeparator = new UISeparator();
		this.HourlySeparator.Hide();

		// Add everything to the PopupMenu
		const mainBox = new BoxLayout({ vertical: true })
		mainBox.add_actor(this.CurrentWeather.actor)
		mainBox.add_actor(this.HourlySeparator.Actor);
		mainBox.add_actor(this.HourlyWeather.actor);
		mainBox.add_actor(this.ForecastSeparator.Actor);
		mainBox.add_actor(this.FutureWeather.actor);
		mainBox.add_actor(this.BarSeparator.Actor);
		mainBox.add_actor(this.Bar.Actor);
		this.menu.addActor(mainBox);
	}

	/** Destroys UI first then shows initial UI */
	private ShowLoadingUi(): void {
		this.CurrentWeather.Destroy();
		this.FutureWeather.Destroy();
		this.Bar.Destroy()
		this.CurrentWeather.actor.set_child(new Label({
			text: _('Loading current weather ...')
		}))
		this.FutureWeather.actor.set_child(new Label({
			text: _('Loading future weather ...')
		}))
	}

	private async OnDayClicked(sender: WeatherButton, date: DateTime): Promise<void> {
		const wasOpen = this.HourlyWeather.Toggled;
		// Open hourly weather if collapsed
		if (!wasOpen)
			await this.ShowHourlyWeather();

		const newIndex = this.HourlyWeather.DateToScrollIndex(date);
		// If the same day was toggle the second time, collapse
		if (wasOpen && newIndex == this.HourlyWeather.CurrentScrollIndex) {
			await this.HideHourlyWeather();
			return;
		}

		if (newIndex != null)
			this.HourlyWeather.ScrollTo(newIndex, wasOpen);
	}

	private async ShowHourlyWeather(animate: boolean = true): Promise<void> {
		this.HourlySeparator.Show();
		this.Bar.SwitchButtonToHide();
		await this.HourlyWeather.Show(this.menu.actor.width, animate);
	}

	private async HideHourlyWeather(animate: boolean = true): Promise<void> {
		if (this.App.config._alwaysShowHourlyWeather) {
			this.HourlyWeather.ResetScroll();
			return;
		}

		await this.ForceHideHourlyWeather(animate);
	}

	private async ForceHideHourlyWeather(animate: boolean = true): Promise<void> {
		this.HourlySeparator.Hide();
		this.Bar.SwitchButtonToShow();
		await this.HourlyWeather.Hide(animate);
	}
}