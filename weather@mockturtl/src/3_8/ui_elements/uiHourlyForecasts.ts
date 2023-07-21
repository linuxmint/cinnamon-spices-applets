import { DateTime } from "luxon";
import { Config } from "../config";
import { APPLET_ICON, ELLIPSIS } from "../consts";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { HourlyForecastData, Precipitation, WeatherData } from "../types";
import { GetHoursMinutes, TempToUserConfig, _, MillimeterToUserUnits, NotEmpty, WeatherIconSafely, OnSameDay, GetDayName } from "../utils";

const { PolicyType } = imports.gi.Gtk;
const { ScrollDirection } = imports.gi.Clutter;
const { addTween } = imports.ui.tweener;
const { BoxLayout, Side, Label, ScrollView, Icon, Align } = imports.gi.St;

export class UIHourlyForecasts {
	private app: WeatherApplet;
	private readonly tempGraphHeight = 45;
	private readonly volumeGraphWidth = 20;
	// Hourly Weather
	public actor: imports.gi.St.ScrollView;
	private container: imports.gi.St.BoxLayout;
	private hourlyForecasts: HourlyForecastUI[] = [];
	private hourlyForecastData: HourlyForecastData[] = [];
	private hourlyContainers: imports.gi.St.BoxLayout[] = [];

	/**
	 * Stores the dates for each displayed hour, so we can scroll to them later.
	 * Populated in the Display function.
	 */
	private hourlyForecastDates?: DateTime[];

	private hourlyToggled: boolean = false;
	private availableWidth: number | null = null;
	private hourlyBoxHorizontalPadding: number = 10;

	public get Toggled() {
		return this.hourlyToggled;
	}

	/** Current position in the horizontal plane. */
	public get CurrentScrollIndex(): number {
		return this.actor.get_hscroll_bar().get_adjustment().get_value();
	}

	private onPaintSignal: number | null = null;
	private canvas: imports.gi.St.DrawingArea | null = null;

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
		this.hourlyForecastData = [];
		const max = Math.min(forecasts.length, this.hourlyForecasts.length);
		for (let index = 0; index < max; index++) {
			const hour = forecasts[index];
			const ui = this.hourlyForecasts[index];

			this.hourlyForecastDates.push(hour.date);
			this.hourlyForecastData.push(hour);

			const temp = TempToUserConfig(hour.temp, config, false);

			if (hour.date.hour == 0)
				ui.Hour.text = GetDayName(hour.date, {
					locale: config.currentLocale,
					tz: tz,
					useTodayTomorrow: false,
					short: true
				});
			else
				ui.Hour.text = GetHoursMinutes(hour.date, config.currentLocale, config._show24Hours, tz, config._shortHourlyTime);
			ui.Temperature.text = temp ? `${temp}°` : "";
			ui.Icon.icon_name = (config._useCustomMenuIcons) ? hour.condition.customIcon : WeatherIconSafely(hour.condition.icons, config.IconType);
			// ui.Summary.text = hour.condition.main;
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

	public async Show(width: number, animate: boolean = true): Promise<void> {
		// In some cases the preferred height is not calculated
		// properly for the first time, so we work around by opening and closing it once
		this.actor.show();
		this.actor.hide();

		this.AdjustHourlyBoxItemWidth(width);

		const [minHeight, naturalHeight] = this.actor.get_preferred_height(width);

		if (naturalHeight == null)
			return;

		Logger.Debug("hourlyScrollView requested height and is set to: " + naturalHeight);
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
	private AdjustHourlyBoxItemWidth(availableWidth?: number): number {
		const requiredWidth = this.GetHourlyBoxItemWidth();

		for (const element of this.hourlyContainers) {
			element.set_width(requiredWidth);
		}

		availableWidth ??= this.availableWidth ?? undefined;

		if (availableWidth != null) {
			if (availableWidth - (this.hourlyBoxHorizontalPadding * 2) >= this.hourlyContainers.length * requiredWidth) {
				this.actor.hscrollbar_policy = PolicyType.NEVER;
			}
			else {
				this.actor.hscrollbar_policy = PolicyType.AUTOMATIC;
			}
			this.actor.set_width(availableWidth);

			this.availableWidth = availableWidth;
		}

		return requiredWidth;
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
			// if (requiredWidth < summaryWidth) requiredWidth = summaryWidth;
			if (requiredWidth < temperatureWidth) requiredWidth = temperatureWidth;
			if (requiredWidth < precipitationWidth) requiredWidth = precipitationWidth;
		}
		return requiredWidth;
	}

	public Destroy(): void {
		this.container.destroy_all_children();
		if (this.onPaintSignal)
			this.canvas?.disconnect(this.onPaintSignal);
	}

	public Rebuild(config: Config, textColorStyle: string, availableHours: number | null = null) {
		this.Destroy();
		const hours = availableHours ?? this.app.GetMaxHourlyForecasts();
		this.hourlyForecasts = [];
		this.hourlyContainers = [];

		const canvas = new imports.gi.St.DrawingArea()

		const grid = new imports.gi.Clutter.GridLayout();
		const gridActor = new imports.gi.Clutter.Actor({ layout_manager: grid });

		grid.attach(canvas, 1, 1, 1, 1);
		const forecastContainer = new BoxLayout();
		grid.attach(forecastContainer, 1, 1, 1, 1);

		this.container.add(gridActor, {expand: true, x_fill: true, y_fill: true});

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
				PrecipPercent: new Label({ text: " ", style_class: "hourly-data", style: "padding-top: 5px;" }),
				PrecipVolume: new Label({ text: _(ELLIPSIS), style_class: "hourly-data", style: `font-size: 80%; min-width: ${this.volumeGraphWidth}px;` }),
				Temperature: new Label({ text: _(ELLIPSIS), style_class: "hourly-data", style: `padding-top: ${this.tempGraphHeight}px`})
			})

			this.hourlyForecasts[index].PrecipVolume.clutter_text.set_line_wrap(true);
			box.add_child(this.hourlyForecasts[index].Hour);
			box.add_child(this.hourlyForecasts[index].Icon);
			// box.add(this.hourlyForecasts[index].Summary, {expand: true, x_fill: true});
			box.add_child(this.hourlyForecasts[index].Temperature);
			if (this.app.Provider?.supportHourlyPrecipChance)
				box.add_child(this.hourlyForecasts[index].PrecipPercent);
			if (this.app.Provider?.supportHourlyPrecipVolume)
				box.add_child(this.hourlyForecasts[index].PrecipVolume);

			forecastContainer.add(box, {
				x_fill: true,
				x_align: Align.MIDDLE,
				y_align: Align.MIDDLE,
				y_fill: true,
				expand: true
			});
		}

		this.onPaintSignal = canvas.connect("repaint", this.OnPaint);
		this.canvas = canvas;
	}

	private OnPaint = (owner: imports.gi.St.DrawingArea) => {
		if (this.availableWidth == null)
			return;

		const ctx = owner.get_context();

		const maxTemp: number = this.hourlyForecastData.map(x => x.temp).reduce((p, c) => Math.max(p ?? 0, c ?? 0)) as number;
		const minTemp: number = this.hourlyForecastData.map(x => x.temp).reduce((p, c) => Math.min(p ?? 0, c ?? 0)) as number;
		const maxPrecipVolume = this.hourlyForecastData.map(x => x.precipitation?.volume).reduce((p, c) => Math.max(p ?? 0, c ?? 0)) as number;
		const totalHeight = this.hourlyContainers[0].height;
		const itemWidth = this.hourlyContainers[0].width;
		const totalWidth = this.hourlyContainers.length * itemWidth;
		const tempHeightOffset = this.hourlyForecasts[0].Hour.get_height() + this.hourlyForecasts[0].Icon.get_height();
		const precipitationHeight = this.hourlyForecasts[0].PrecipPercent.get_height() + this.hourlyForecasts[0].PrecipVolume.get_height();
		const tempPadding = 6;

		let points: Array<{x: number, y: number}> = [];
		let precipitation: number[] = []
		for (let i = 0; i < this.hourlyContainers.length; i++) {
			const data = this.hourlyForecastData[i];
			const items = this.hourlyForecasts[i];

			if (data.temp == null)
				continue;

			const ratio = ((data.temp - minTemp) / (maxTemp - minTemp)) * (this.tempGraphHeight - (tempPadding * 2));

			const height = this.tempGraphHeight - tempPadding - ratio + tempHeightOffset;

			const midX = itemWidth * i + (itemWidth/2);
			const midY = (totalHeight / 2);
			points.push({x: midX, y: height});
			precipitation.push((data.precipitation?.volume ?? 0))
		}

		ctx.setLineWidth(3);
		if (this.app.config.ForegroundColor == null)
			ctx.setSourceRGBA(1,1,1,0.5);
		else
			ctx.setSourceRGBA(this.app.config.ForegroundColor.red, this.app.config.ForegroundColor.green, this.app.config.ForegroundColor.blue, this.app.config.ForegroundColor.alpha);
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 0; i < points.length; i++) {
			const p = points[i]
			ctx.lineTo(p.x, p.y + 2);
		}
		ctx.stroke();

		ctx.setSourceRGBA(0,0.5,1,0.5);
		for (let i = 0; i < precipitation.length; i++) {
			const element = precipitation[i];
			const point = points[i];
			// Normalize the precipitation height to the max precipitation volume, but make sure it's at least 2 mm
			const normalized = precipitationHeight * (element / Math.max(maxPrecipVolume, 2));
			ctx.rectangle(point.x - this.volumeGraphWidth / 2, totalHeight - normalized, this.volumeGraphWidth, normalized);
			ctx.fill();
		}
		return true;
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
		if (!!precip.volume && precip.volume >= 0.1) {
			precipitationText = `${MillimeterToUserUnits(precip.volume, config.DistanceUnit)}${config.DistanceUnit == "metric" ? _("mm") : _("in")}`;
		}

		return precipitationText;
	}

	private GeneratePrecipitationChance(precip: Precipitation | undefined, config: Config): string {
		if (!precip) return "";

		let precipitationText = "";
		if (!!precip.chance) {
			precipitationText = (NotEmpty(precipitationText)) ? (precipitationText + ", ") : "";
			precipitationText += ((Math.round(precip.chance / 10) * 10).toString() + "%")
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
