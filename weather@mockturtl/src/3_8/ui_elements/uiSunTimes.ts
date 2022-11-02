import { DateTime } from "luxon";
import { Config } from "../config";
import { BLANK, ELLIPSIS } from "../consts";
import { type WeatherApplet } from "../main";
import { WeatherData } from "../types";
import { GetHoursMinutes } from "../utils";

const { Bin, BoxLayout, IconType, Label, Icon, Align } = imports.gi.St;

const STYLE_ASTRONOMY = 'weather-current-astronomy'

export class SunTimesUI {
    private _actor!: imports.gi.St.Bin;
    private app: WeatherApplet;

    public get actor(): imports.gi.St.Bin {
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

    private OnConfigChanged = async (config: Config, showSunrise: boolean, data: WeatherData) => {
        this.Display(data.sunrise, data.sunset, data.location.timeZone);
    }

    public Rebuild(config: Config, textColorStyle: string): imports.gi.St.Bin {
        // Bin is used here to horizontally center BoxLayout inside BoxLayout, normal add() function does not work here 
        const sunBin = new Bin();
        this.sunriseLabel = new Label({ text: ELLIPSIS, style: textColorStyle })
        this.sunsetLabel = new Label({ text: ELLIPSIS, style: textColorStyle })

        const sunriseBox = new BoxLayout();
        const sunsetBox = new BoxLayout();
        const sunsetIcon = new Icon({
            icon_name: "sunset-symbolic",
            icon_type: IconType.SYMBOLIC,
            icon_size: 25,
            style: textColorStyle
        });

        const sunriseIcon = new Icon({
            icon_name: "sunrise-symbolic",
            icon_type: IconType.SYMBOLIC,
            icon_size: 25,
            style: textColorStyle
        });

        sunriseBox.add_actor(sunriseIcon);
        sunsetBox.add_actor(sunsetIcon);

        const textOptions: Partial<imports.gi.St.BoxLayoutChildInitOptions> = {
            x_fill: false,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        }

        sunriseBox.add(this.sunriseLabel, textOptions);
        sunsetBox.add(this.sunsetLabel, textOptions);

        const spacer = new Label({ text: BLANK })

        const sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY })
        sunBox.add_actor(sunriseBox);
        sunBox.add_actor(spacer);
        sunBox.add_actor(sunsetBox);

        sunBin.set_child(sunBox);
        this._actor = sunBin;
        return sunBin;
    }

    public Display(sunrise: DateTime | null, sunset: DateTime | null, tz?: string): void {
        if (!this.app.config._showSunrise || sunrise == null || sunset == null) {
            this.actor.hide();
			return;
		}

		this.sunriseLabel.text = (GetHoursMinutes(sunrise, this.app.config.currentLocale, this.app.config._show24Hours, tz));
		this.sunsetLabel.text = (GetHoursMinutes(sunset, this.app.config.currentLocale, this.app.config._show24Hours, tz));
        this.actor.show();
    }
}