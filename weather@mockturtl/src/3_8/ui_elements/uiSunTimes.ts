import type { DateTime } from "luxon";
import type { Config } from "../config";
import { BLANK, ELLIPSIS } from "../consts";
import type { WeatherApplet } from "../main";
import type { WeatherData } from "../weather-data";
import { GetHoursMinutes, Label } from "../utils";

const { BoxLayout, IconType, Icon, Align } = imports.gi.St;
const { ActorAlign } = imports.gi.Clutter;

const STYLE_ASTRONOMY = 'weather-current-astronomy'

export class SunTimesUI {
    private _actor!: imports.gi.St.BoxLayout;
    private app: WeatherApplet;

    public get actor(): imports.gi.St.BoxLayout {
        return this._actor;
    }

    private get config(): Config {
        return this.app.config;
    }

    public constructor(app: WeatherApplet) {
        this.app = app;
        this.config.ShowSunriseChanged.Subscribe(this.app.AfterRefresh(this.OnConfigChanged));
    }

	private sunriseLabel!: imports.gi.St.Label;
	private sunsetLabel!: imports.gi.St.Label;

    private OnConfigChanged = (config: Config, showSunrise: boolean, data: WeatherData) => {
        this.Display(data.sunrise, data.sunset, data.location.timeZone);
    }

    public Rebuild(config: Config, textColorStyle: string): imports.gi.St.BoxLayout {
        this.sunriseLabel = Label({ text: ELLIPSIS, style: textColorStyle })
        this.sunsetLabel = Label({ text: ELLIPSIS, style: textColorStyle })

        const sunriseBox = new BoxLayout();
        const sunsetBox = new BoxLayout();
        const sunsetIcon = new Icon({
            icon_name: "sunset-symbolic",
            icon_type: IconType.SYMBOLIC,
            icon_size: 24,
            style: textColorStyle
        });

        const sunriseIcon = new Icon({
            icon_name: "sunrise-symbolic",
            icon_type: IconType.SYMBOLIC,
            icon_size: 24,
            style: textColorStyle
        });

        sunriseBox.add(sunriseIcon);
        sunsetBox.add(sunsetIcon);

        const textOptions: Partial<imports.gi.St.BoxLayoutChildInitOptions> = {
            x_fill: true,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        }

        sunriseBox.add(this.sunriseLabel, textOptions);
        sunsetBox.add(this.sunsetLabel, textOptions);

        const spacer = Label({ text: BLANK })

        const sunBox = new BoxLayout({
			style_class: STYLE_ASTRONOMY,
			x_align: ActorAlign.CENTER,
			x_expand: true,
			y_expand: true,
		})
        sunBox.add_actor(sunriseBox);
        sunBox.add_actor(spacer);
        sunBox.add_actor(sunsetBox);

        this._actor = sunBox;
        return sunBox;
    }

    public Display(sunrise: DateTime | null, sunset: DateTime | null, tz?: string): void {
        if (!this.app.config._showSunrise || sunrise == null || sunset == null) {
            this.actor.hide();
			return;
		}

		this.sunriseLabel.text = (GetHoursMinutes(sunrise, this.app.config._show24Hours, tz));
		this.sunsetLabel.text = (GetHoursMinutes(sunset, this.app.config._show24Hours, tz));
        this.actor.show();
    }
}
