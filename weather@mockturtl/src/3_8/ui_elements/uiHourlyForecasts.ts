import { DateTime } from "luxon";
import { Config } from "../config";
import { APPLET_ICON, ELLIPSIS } from "../consts";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { HourlyForecastData, Precipitation, WeatherData } from "../types";
import { GetHoursMinutes, TempToUserConfig, _, MillimeterToUserUnits, NotEmpty, WeatherIconSafely, OnSameDay } from "../utils";

const { PolicyType } = imports.gi.Gtk;
const { ScrollDirection } = imports.gi.Clutter;
const { addTween } = imports.ui.tweener;
const { BoxLayout, Side, Label, ScrollView, Icon, Align } = imports.gi.St;

export class UIHourlyForecasts {
	private app: WeatherApplet;
	// Hourly Weather
	public actor: imports.gi.St.ScrollView;
	private container: imports.gi.St.BoxLayout;
	private hourlyForecasts: HourlyForecastUI[] = [];
	private hourlyContainers: imports.gi.St.BoxLayout[] = [];

	/**
	 * Stores the dates for each displayed hour, so we can scroll to them later.
	 * Populated in the Display function.
	 */
	private hourlyForecastDates?: DateTime[];

	private hourlyToggled: boolean = false;

	public get Toggled() {
		return this.hourlyToggled;
	}

	/** Current position in the horizontal plane. */
	public get CurrentScrollIndex(): number {
		return this.actor.get_hscroll_bar().get_adjustment().get_value();
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

		// Stop event passing while scrolling to allow scrolling
		const hScroll = this.actor.get_hscroll_bar();
		hScroll.connect("scroll-start", () => { menu.passEvents = true; });
		hScroll.connect("scroll-stop", () => { menu.passEvents = false; });
		const vScroll = this.actor.get_vscroll_bar();
		vScroll.connect("scroll-start", () => { menu.passEvents = true; });
		vScroll.connect("scroll-stop", () => { menu.passEvents = false; });
		// Add scroll capabilities to hourly ScrollView
		this.actor.connect("scroll-event", (owner, event) => {
			const adjustment = hScroll.get_adjustment();
			const direction = event.get_scroll_direction();
			const newVal = adjustment.get_value() +
				(direction === ScrollDirection.UP ? -adjustment.step_increment : adjustment.step_increment);

			if (global.settings.get_boolean("desktop-effects-on-menus"))
				addTween(adjustment, { value: newVal, time: 0.25});
			else
				adjustment.set_value(newVal);
			return false;
		})

		this.actor.hide();
		this.actor.set_clip_to_allocation(true);
		this.container = new BoxLayout({ style_class: "hourly-box" });
		// Only add_actor works with ScrollView for some reason, not add_child
		// and only BoxLayout results in drawn stuff inside the ScrollView.
		// (Only BoxLayout and Viewport implements St.Scrollable needed inside a ScrollView)
		this.actor.add_actor(this.container);

		this.app.config.ShortHourlyTimeChanged.Subscribe(this.app.AfterRefresh(this.OnShortHourlyTimeChanged));
	}

	private OnShortHourlyTimeChanged = (config: Config, shortTime: boolean, data: WeatherData) => {
		this.Display(data.hourlyForecasts, config, config.Timezone);
	}

	/**
	 * Make sure to call this after the hourly weather was shown at least once,
	 * otherwise the calculation will not be accurate!
	 *
	 * @param date
	 */
	public DateToScrollIndex(date: DateTime): number | null {
		if (this.hourlyForecastDates == null)
			return null;

		const itemWidth = this.GetHourlyBoxItemWidth();
		let midnightIndex: number | null = null;
		for (let index = 0; index < this.hourlyForecastDates.length; index++) {
			if (OnSameDay(this.hourlyForecastDates[index], date))
				midnightIndex = index;

			// Adjust dates so we jump to 6 in the morning, not midnight when we scroll to a date
			if (OnSameDay(this.hourlyForecastDates[index].minus({ hours: 6 }), date)) {
				return index * itemWidth;
			}
		}
		// Day has hourly forecasts earlier than 6 but not later than 6, scroll to midnight
		if (midnightIndex != null)
			return midnightIndex * itemWidth;

		return null;
	}

	public ScrollTo(index: number, animate: boolean = true) {
		const adjustment = this.actor.get_hscroll_bar().get_adjustment();
		const [, lower, upper, , , page_size] = adjustment.get_values();
		index = Math.max(Math.min(index, upper - page_size), lower);
		if (global.settings.get_boolean("desktop-effects-on-menus") && animate)
			addTween(adjustment, { value: index, time: 0.25});
		else
			adjustment.set_value(index);
	}

	/** Changes all icon's type what are affected by
	 * the "use symbolic icons" setting
	 */
	public UpdateIconType(iconType: imports.gi.St.IconType): void {
		if (!this.hourlyForecasts)
			return;

		for (const hourly of this.hourlyForecasts) {
			if (!hourly?.Icon)
				continue;

			hourly.Icon.icon_type = iconType;
		}
	}

	public Display(forecasts: HourlyForecastData[] | undefined, config: Config, tz?: string): boolean {
		if (!forecasts || !this.hourlyForecasts)
			return true;

		if (this.hourlyForecasts.length > forecasts.length) {
			this.Rebuild(this.app.config, this.app.config.textColorStyle!, forecasts.length);
		}

		this.hourlyForecastDates = [];
		const max = Math.min(forecasts.length, this.hourlyForecasts.length);
		for (let index = 0; index < max; index++) {
			const hour = forecasts[index];
			const ui = this.hourlyForecasts[index];

			this.hourlyForecastDates.push(hour.date);

			ui.Hour.text = GetHoursMinutes(hour.date, config.currentLocale, config._show24Hours, tz, config._shortHourlyTime);
			ui.Temperature.text = TempToUserConfig(hour.temp, config) ?? "";
			ui.Icon.icon_name = (config._useCustomMenuIcons) ? hour.condition.customIcon : WeatherIconSafely(hour.condition.icons, config.IconType);
			ui.Summary.text = hour.condition.main;
			ui.PrecipPercent.text = this.GeneratePrecipitationChance(hour.precipitation, config);
			ui.PrecipVolume.text = this.GeneratePrecipitationVolume(hour.precipitation, config);
		}

		this.AdjustHourlyBoxItemWidth();

		return !(max <= 0);
	}

	public ResetScroll() {
		const hscroll = this.actor.get_hscroll_bar();
		hscroll.get_adjustment().set_value(0);
	}

	public async Show(animate: boolean = true): Promise<void> {
		// In some cases the preferred height is not calculated
		// properly for the first time, so we work around by opening and closing it once
		this.actor.show();
		this.actor.hide();

		this.AdjustHourlyBoxItemWidth();

		const [minWidth, naturalWidth] = this.actor.get_preferred_width(-1);

		if (minWidth == null)
			return;

		const [minHeight, naturalHeight] = this.actor.get_preferred_height(minWidth);

		if (naturalHeight == null)
			return;

		Logger.Debug("hourlyScrollView requested height and is set to: " + naturalHeight);
		this.actor.set_width(minWidth);
		this.actor.show();
		// When the scrollView is shown without animation and there is not enough vertical space
		// (or cinnamon does not think there is enough), the text gets superimposed on top of
		// each other.
		// setting the min-height forces to draw with the view's requested height without
		// interfering with animations.
		this.actor.style = "min-height: " + naturalHeight.toString() + "px;";
		this.hourlyToggled = true;
		return new Promise((resolve, reject) => {
			if (naturalHeight == null)
				return;

			const height = naturalHeight;
			if (global.settings.get_boolean("desktop-effects-on-menus") && animate) {
				this.actor.height = 0;
				addTween(this.actor,
					{
						height: height,
						time: 0.25,
						onUpdate: () => { },
						onComplete: () => {
							this.actor.set_height(height);
							resolve();
						}
					});
			}
			else {
				// We must set naturalHeight here as well because integer
				// scaling doesn't work properly.
				this.actor.set_height(height);
				resolve();
			}
		});
	}

	public async Hide(animate: boolean = true): Promise<void> {
		this.hourlyToggled = false;
		return new Promise((resolve, reject) => {
			if (global.settings.get_boolean("desktop-effects-on-menus") && animate) {
				// TODO: eliminate Clutter Warnings on collapse in logs
				addTween(this.actor,
					{
						height: 0,
						time: 0.25,
						onUpdate: () => { },
						onComplete: () => {
							this.actor.set_height(-1);
							// We must unset min-height style else
							// we get issues with integer scaling
							// when we request preferred height again
							// See Issue : https://github.com/linuxmint/cinnamon-spices-applets/issues/3787
							this.actor.style = "";
							this.actor.hide();
							// Scroll back to the start
							this.ResetScroll();
							resolve();
						}
					}
				);
			}
			else {
				this.actor.style = "";
				this.actor.set_height(-1);
				this.ResetScroll();
				this.actor.hide();
				resolve();
			}
		});
	}

	/** Sets the correct width for the hourly boxes, make
	 * sure to call this whn the hourly ScrollView is shown
	 */
	private AdjustHourlyBoxItemWidth(): void {
		const requiredWidth = this.GetHourlyBoxItemWidth();

		for (const element of this.hourlyContainers) {
			element.set_width(requiredWidth);
		}
	}

	/**
	 * Calculates incorrect width the first time, make sure to call this after a show/hide iteration.
	 */
	private GetHourlyBoxItemWidth(): number {
		let requiredWidth = 0;
		if (!this.hourlyForecasts)
			return requiredWidth;

		for (let index = 0; index < this.hourlyContainers.length; index++) {
			const ui = this.hourlyForecasts[index];
			const hourWidth = ui.Hour.get_preferred_width(-1)[1];
			const iconWidth = ui.Icon.get_preferred_width(-1)[1];
			const percipVolumeWidth = ui.PrecipVolume.get_preferred_width(-1)[1];
			const percipChanceWidth = ui.PrecipPercent.get_preferred_width(-1)[1];
			const summaryWidth = ui.Summary.get_preferred_width(-1)[1];
			const temperatureWidth = ui.Temperature.get_preferred_width(-1)[1];
			const precipitationWidth = ui.PrecipPercent.get_preferred_width(-1)[1];

			if (precipitationWidth == null || temperatureWidth == null ||
				hourWidth == null || iconWidth == null || summaryWidth == null ||
				percipVolumeWidth == null || percipChanceWidth == null)
				continue;

			if (requiredWidth < hourWidth) requiredWidth = hourWidth;
			if (requiredWidth < iconWidth) requiredWidth = iconWidth;
			if (requiredWidth < summaryWidth) requiredWidth = summaryWidth;
			if (requiredWidth < temperatureWidth) requiredWidth = temperatureWidth;
			if (requiredWidth < precipitationWidth) requiredWidth = precipitationWidth;
		}
		return requiredWidth;
	}

	public Destroy(): void {
		this.container.destroy_all_children();
	}

	public Rebuild(config: Config, textColorStyle: string, availableHours: number | null = null) {
		this.Destroy();
		const hours = availableHours ?? this.app.GetMaxHourlyForecasts();
		this.hourlyForecasts = [];
		this.hourlyContainers = [];

		for (let index = 0; index < hours; index++) {
			const box = new BoxLayout({ vertical: true, style_class: "hourly-box-item" });
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
				Summary: new Label({ text: _(ELLIPSIS), style_class: "hourly-data" }),
				PrecipPercent: new Label({ text: " ", style_class: "hourly-data" }),
				PrecipVolume: new Label({ text: _(ELLIPSIS), style_class: "hourly-data" }),
				Temperature: new Label({ text: _(ELLIPSIS), style_class: "hourly-data" })
			})

			this.hourlyForecasts[index].PrecipVolume.clutter_text.set_line_wrap(true);
			box.add_child(this.hourlyForecasts[index].Hour);
			box.add_child(this.hourlyForecasts[index].Icon);
			box.add(this.hourlyForecasts[index].Summary, {expand: true, x_fill: true});
			box.add_child(this.hourlyForecasts[index].Temperature);
			if (this.app.Provider?.supportHourlyPrecipChance)
				box.add_child(this.hourlyForecasts[index].PrecipPercent);
			if (this.app.Provider?.supportHourlyPrecipVolume)
				box.add_child(this.hourlyForecasts[index].PrecipVolume);

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
	private GeneratePrecipitationVolume(precip: Precipitation | undefined, config: Config): string {
		if (!precip) return "";

		let precipitationText = "";
		if (!!precip.volume && precip.volume > 0) {
			precipitationText = `${MillimeterToUserUnits(precip.volume, config.DistanceUnit)}${config.DistanceUnit == "metric" ? _("mm") : _("in")}`;
		}

		return precipitationText;
	}

	private GeneratePrecipitationChance(precip: Precipitation | undefined, config: Config): string {
		if (!precip) return "";

		let precipitationText = "";
		if (!!precip.chance) {
			precipitationText = (NotEmpty(precipitationText)) ? (precipitationText + ", ") : "";
			precipitationText += (Math.round(precip.chance).toString() + "%")
		}
		return precipitationText;
	}

	/** Helper function for debugging, currently not used */
	private GetScrollViewHeight(): number {
		let boxItemHeight = 0;
		if (!this.hourlyForecasts)
			return boxItemHeight;

		for (let index = 0; index < this.hourlyContainers.length; index++) {
			const ui = this.hourlyForecasts[index];

			Logger.Debug("Height requests of Hourly box Items: " + index);
			const hourHeight = ui.Hour.get_preferred_height(-1)[1];
			const iconHeight = ui.Icon.get_preferred_height(-1)[1];
			const summaryHeight = ui.PrecipVolume.get_preferred_height(-1)[1];
			const temperatureHeight = ui.Temperature.get_preferred_height(-1)[1];
			const precipitationHeight = ui.PrecipPercent.get_preferred_height(-1)[1];

			if (precipitationHeight == null || temperatureHeight == null ||
				hourHeight == null || iconHeight == null || summaryHeight == null)
				continue;

			const itemHeight = hourHeight + iconHeight + summaryHeight + temperatureHeight + precipitationHeight;
			if (boxItemHeight < itemHeight) boxItemHeight = itemHeight;
		}
		Logger.Debug("Final Hourly box item height is: " + boxItemHeight)
		const scrollBarHeight = this.actor.get_hscroll_bar().get_preferred_width(-1)[1];

		Logger.Debug("Scrollbar height is " + scrollBarHeight);
		const theme = this.container.get_theme_node();
		const styling = theme.get_margin(Side.TOP) + theme.get_margin(Side.BOTTOM) + theme.get_padding(Side.TOP) + theme.get_padding(Side.BOTTOM);
		Logger.Debug("ScrollbarBox vertical padding and margin is: " + styling);

		return (boxItemHeight + (scrollBarHeight ?? 0) + styling);
	}
}

interface HourlyForecastUI {
	Icon: imports.gi.St.Icon,
	Hour: imports.gi.St.Label,
	Summary: imports.gi.St.Label,
	PrecipVolume: imports.gi.St.Label,
	Temperature: imports.gi.St.Label,
	PrecipPercent: imports.gi.St.Label
}