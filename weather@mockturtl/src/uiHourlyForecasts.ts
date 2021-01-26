import { Config } from "./config";
import { APPLET_ICON, ELLIPSIS } from "./consts";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { HourlyForecastData, Precipitation } from "./types";
import { GetHoursMinutes, TempToUserConfig, UnitToUnicode, _, MillimeterToUserUnits, NotEmpty, WeatherIconSafely } from "./utils";

const { PolicyType } = imports.gi.Gtk;
const { addTween } = imports.ui.tweener;
const { BoxLayout, Side, Label, ScrollView, Icon, Align } = imports.gi.St;

export class UIHourlyForecasts {
    private app: WeatherApplet;
    // Hourly Weather
    public actor: imports.gi.St.ScrollView;
    private container: imports.gi.St.BoxLayout;
    private hourlyForecasts: HourlyForecastUI[];
    private hourlyContainers: imports.gi.St.BoxLayout[];

    private hourlyToggled: boolean = false;

    public get Toggled() {
        return this.hourlyToggled;
    }

    constructor(app: WeatherApplet, menu: imports.ui.applet.AppletPopupMenu) {
        this.app = app;
        // Hourly Weather
        this.actor = new ScrollView(
            {
                hscrollbar_policy: PolicyType.AUTOMATIC,
                vscrollbar_policy: PolicyType.NEVER,
                x_fill: true,
                y_fill: true,
                y_align: Align.MIDDLE,
                x_align: Align.MIDDLE
            }
        );
        this.actor.overlay_scrollbars = true;

        // Stop event passing while scrolling to allow scrolling
        let vScroll = this.actor.get_vscroll_bar();
        vScroll.connect("scroll-start", () => { menu.passEvents = true; });
        vScroll.connect("scroll-stop", () => { menu.passEvents = false; });
        let hScroll = this.actor.get_hscroll_bar();
        hScroll.connect("scroll-start", () => { menu.passEvents = true; });
        hScroll.connect("scroll-stop", () => { menu.passEvents = false; });

        this.actor.hide();
        this.actor.set_clip_to_allocation(true);
        this.container = new BoxLayout({ style_class: "hourly-box" });
        // Only add_actor works with ScrollView for some reason, not add_child
        // and only BoxLayout results in drawn stuff inside the ScrollView.
        // (Only Boxlayout and Viewport implements St.Scrollable needed inside a scrollview)
        this.actor.add_actor(this.container)
    }

    /** Changes all icon's type what are affected by
	 * the "use symbolic icons" setting
	 */
    public UpdateIconType(iconType: imports.gi.St.IconType): void {
        if (!this.hourlyForecasts)
            return;

        for (let i = 0; i < this.hourlyForecasts.length; i++) {
            if (!this.hourlyForecasts[i]?.Icon)
                continue;

            this.hourlyForecasts[i].Icon.icon_type = iconType;
        }
    }

    public Display(forecasts: HourlyForecastData[], config: Config, tz: string): boolean {
        let max = Math.min(forecasts.length, this.hourlyForecasts.length);
        for (let index = 0; index < max; index++) {
            const hour = forecasts[index];
            const ui = this.hourlyForecasts[index];

            ui.Hour.text = GetHoursMinutes(hour.date, config.currentLocale, config._show24Hours, tz, config._shortHourlyTime);
            ui.Temperature.text = TempToUserConfig(hour.temp, config.TemperatureUnit, config._tempRussianStyle) + " " + UnitToUnicode(config.TemperatureUnit);
            ui.Icon.icon_name = (config._useCustomMenuIcons) ? hour.condition.customIcon : WeatherIconSafely(hour.condition.icons, config.IconType);
            ui.Summary.text = hour.condition.main;
            ui.Precipitation.text = this.GeneratePrecipitationText(hour.precipitation, config);
        }

        this.AdjustHourlyBoxItemWidth();

        return !(max <= 0);
    }
    
    public Show(): void {
        // In some cases the preferred height is not calculated
        // properly for the first time, so we work around by opening and closing it once
        this.actor.show();
        this.actor.hide();

        this.AdjustHourlyBoxItemWidth();

        let [minWidth, naturalWidth] = this.actor.get_preferred_width(-1);
        let [minHeight, naturalHeight] = this.actor.get_preferred_height(minWidth);
        Log.Instance.Debug("hourlyScrollView requested height and is set to: " + naturalHeight);
        this.actor.set_width(minWidth);
		this.actor.show();
		// When the scrollView is shown without animation and there is not enough vertical space
		// (or cinnamon does not think there is enough), the text gets superimposed on top of
		// each other.
		// setting the min-height forces to draw with the view's requested height without
		// interfering with animations.
		this.actor.style = "min-height: " + naturalHeight.toString() + "px;";

        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            this.actor.height = 0;
            addTween(this.actor,
                {
                    height: naturalHeight,
                    time: 0.25,
                    onUpdate: () => { },
                    onComplete: () => {
                        this.actor.set_height(naturalHeight);
                    }
                });
        }

        this.hourlyToggled = true;
    }

    public Hide(): void {
        let hscroll = this.actor.get_hscroll_bar();
        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            // TODO: eliminate Clutter Warnings on collapse in logs
            addTween(this.actor,
                {
                    height: 0,
                    time: 0.25,
                    onUpdate: () => { },
                    onComplete: () => {
                        this.actor.set_height(-1);
                        this.actor.hide();
                        // Scroll back to the start
                        hscroll.get_adjustment().set_value(0);
                    }
                }
            );
        }
        else {
            this.actor.set_height(-1);
            this.actor.hide();
        }
        this.hourlyToggled = false;
    }

    /** Calculates incorrect width the first time, make sure to call this
	 * after a show/hide iteration as well when the Hourly box is shown
	 */
    private AdjustHourlyBoxItemWidth(): void {
        let requiredWidth = 0;
        for (let index = 0; index < this.hourlyContainers.length; index++) {
            const ui = this.hourlyForecasts[index];
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

        for (let index = 0; index < this.hourlyContainers.length; index++) {
            const element = this.hourlyContainers[index];
            element.set_width(requiredWidth);
        }
    }

    public Destroy(): void {
        this.container.destroy_all_children();
    }

    public Rebuild(config: Config, textColorStyle: string) {
        this.Destroy();
        let hours = this.app.GetMaxHourlyForecasts();
        this.hourlyForecasts = [];
        this.hourlyContainers = [];

        for (let index = 0; index < hours; index++) {
            let box = new BoxLayout({ vertical: true, style_class: "hourly-box-item" });
            this.hourlyContainers.push(box);

            this.hourlyForecasts.push({
                // Override color on light theme for grey text
                Hour: new Label({ text: "Hour", style_class: "hourly-time", style: textColorStyle }),
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

            this.hourlyForecasts[index].Summary.clutter_text.set_line_wrap(true);
            box.add_child(this.hourlyForecasts[index].Hour);
            box.add_child(this.hourlyForecasts[index].Icon);
            box.add_child(this.hourlyForecasts[index].Summary);
            box.add_child(this.hourlyForecasts[index].Temperature);
            box.add_child(this.hourlyForecasts[index].Precipitation);

            this.container.add(box, {
                x_fill: true,
                x_align: Align.MIDDLE,
                y_align: Align.MIDDLE,
                y_fill: true,
                expand: true
            });
        }
    }

    // DisplayUtils

    /**
     * 
     * @param precip 
     * @returns Always returns text 
     */
    private GeneratePrecipitationText(precip: Precipitation, config: Config): string {
		if (!precip || precip.type == "none") return "";
		
		let precipitationText = "";
        if (!!precip.volume && precip.volume > 0) {
            precipitationText = MillimeterToUserUnits(precip.volume, config.DistanceUnit) + " " + ((config.DistanceUnit == "metric") ? _("mm") : _("in"));
        }
        if (!!precip.chance) {
            precipitationText = (NotEmpty(precipitationText)) ? (precipitationText + ", ") : ""; 
            precipitationText += (Math.round(precip.chance).toString() + "%")
        }
        return precipitationText;
    }

    /** Helper function for debugging, currently not used */
    private GetScrollViewHeight(): number {
        let boxItemHeight = 0;
        for (let index = 0; index < this.hourlyContainers.length; index++) {
            const ui = this.hourlyForecasts[index];

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
        let scrollBarHeight = this.actor.get_hscroll_bar().get_preferred_width(-1)[1];
        Log.Instance.Debug("Scrollbar height is " + scrollBarHeight);
        let theme = this.container.get_theme_node();
        let styling = theme.get_margin(Side.TOP) + theme.get_margin(Side.BOTTOM) + theme.get_padding(Side.TOP) + theme.get_padding(Side.BOTTOM);
        Log.Instance.Debug("ScollbarBox vertical padding and margin is: " + styling);

        return (boxItemHeight + scrollBarHeight + styling);
    }
}

interface HourlyForecastUI {
    Icon: imports.gi.St.Icon,
    Hour: imports.gi.St.Label,
    Summary: imports.gi.St.Label,
    Temperature: imports.gi.St.Label,
    Precipitation: imports.gi.St.Label
}