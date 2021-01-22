import { Config, DistanceUnits } from "./config";
import { ELLIPSIS, FORWARD_SLASH, APPLET_ICON, SIGNAL_CLICKED } from "./consts";
import { CurrentWeather } from "./uiCurrentWeather";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { WeatherData, WeatherProvider, HourlyForecastData } from "./types";
import { shadeHexColor, delay, capitalizeFirstLetter, _, AwareDateString, TempToUserConfig, GetHoursMinutes, GetDayName, MetreToUserUnits, MillimeterToUserUnits, UnitToUnicode } from "./utils";
import { WeatherButton } from "./weatherbutton";
import { UIForecasts } from "./uiForecasts";
import { UIHourlyForecasts } from "./uiHourlyForecasts";

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
    private FutureWeather: UIForecasts;

    // Bottom Bar
    private _providerCredit: imports.gi.St.Button;
    private _bar: imports.gi.St.BoxLayout;
    private _hourlyButton: imports.gi.St.Button;
    private _timestamp: imports.gi.St.Label;

    // Hourly Weather
    private HourlyWeather: UIHourlyForecasts;

    // State variables
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

    public ShowHourlyWeather(): void {
        this.HourlyWeather.Show();
        this._separatorAreaHourly.actor.show();
        if (!!this._hourlyButton.child) this._hourlyButton.child.icon_name = "custom-up-arrow-symbolic";
    }

    public HideHourlyWeather(): void {
        this.HourlyWeather.Hide();
        this._separatorAreaHourly.actor.hide();
        if (!!this._hourlyButton.child) this._hourlyButton.child.icon_name = "custom-down-arrow-symbolic";
    }

    public ToggleHourlyWeather(): void {
        if (this.HourlyWeather.Toggled) {
            this.HideHourlyWeather();
        }
        else {
            this.ShowHourlyWeather();
        }
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

    /** Creates th skeleton of the popup menu */
    private BuildPopupMenu(): void {
        //  Current Weather
        this.CurrentWeather = new CurrentWeather(this.App, this);
        //  Daily Weather
        this.FutureWeather = new UIForecasts(this.App);

        this.HourlyWeather = new UIHourlyForecasts(this.App, this.menu);

        // Separators and removing styling to make them span full width 
        this._separatorArea = new PopupSeparatorMenuItem()
        this._separatorAreaHourly = new PopupSeparatorMenuItem();
        this._separatorArea2 = new PopupSeparatorMenuItem()
        this._separatorArea.actor.remove_style_class_name("popup-menu-item");
        this._separatorAreaHourly.actor.remove_style_class_name("popup-menu-item");
        this._separatorArea2.actor.remove_style_class_name("popup-menu-item");

        
        this._separatorAreaHourly.actor.hide();

        // Bottom bar
        this._bar = new BoxLayout({ vertical: false, style_class: STYLE_BAR });

        // Add everything to the PopupMenu
        let mainBox = new BoxLayout({ vertical: true })
        mainBox.add_actor(this.CurrentWeather.actor)
        mainBox.add_actor(this._separatorAreaHourly.actor);
        mainBox.add_actor(this.HourlyWeather.actor);
        mainBox.add_actor(this._separatorArea.actor)
        mainBox.add_actor(this.FutureWeather.actor)
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
        this.HourlyWeather.Rebuild(config, this.GetTextColorStyle());
        this.FutureWeather.Rebuild(config, this.GetTextColorStyle());
        this.rebuildBar(config);
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

    public DisplayErrorMessage(msg: string) {
        this._timestamp.text = msg;
	}

	public Display(weather: WeatherData, config: Config, provider: WeatherProvider): boolean {
		this.CurrentWeather.Display(weather, config);
		this.FutureWeather.Display(weather, config);
        let shouldShowToggle = this.HourlyWeather.Display(weather.hourlyForecasts, config, weather.location.timeZone);
        if (!shouldShowToggle)
            this.HideHourlyToggle();
		this.DisplayBar(weather, provider, config);
		return true;
	}

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

	/**
	 * 
	 * @param unit 
	 * @return km or mi, based on unit
	 */
    private BigDistanceUnitFor(unit: DistanceUnits) {
        if (unit == "imperial") return _("mi");
        return _("km");
    }

    private destroyBar(): void {
        this._bar.destroy_all_children();
    }

    /** Destroys UI first then shows initial UI */
    private showLoadingUi(): void {
        this.CurrentWeather.Destroy();
        this.FutureWeather.Destroy();
        this.destroyBar()
        this.CurrentWeather.actor.set_child(new Label({
            text: _('Loading current weather ...')
        }))
        this.FutureWeather.actor.set_child(new Label({
            text: _('Loading future weather ...')
        }))
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
}