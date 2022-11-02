import { Config, WeatherWindSpeedUnits } from "../config";
import { APPLET_ICON, ELLIPSIS } from "../consts";
import { type WeatherApplet } from "../main";
import { WeatherData } from "../types";
import { CompassDirection, CompassDirectionText, LocalizedColon, MPStoUserUnits, _ } from "../utils";
const { BoxLayout, IconType, Label, Icon, Align } = imports.gi.St;

export class WindBox {
    private _caption!: imports.gi.St.Label;
    private _label!: imports.gi.St.BoxLayout;
    private app: WeatherApplet;

    private labelText!: imports.gi.St.Label;
	private windDirectionIcon!: imports.gi.St.Icon;

    public constructor(app: WeatherApplet) {
        this.app = app;
        this.app.config.DisplayWindAsTextChanged.Subscribe(this.app.AfterRefresh(this.OnDisplayWindAsTextChanged));
        this.app.config.WindSpeedUnitChanged.Subscribe(this.app.AfterRefresh(this.OnConfigChanged));
    }

    private OnConfigChanged = (config: Config, unit: WeatherWindSpeedUnits, data: WeatherData) => {
        this.Display(data.wind.speed, data.wind.degree);
    }

    private OnDisplayWindAsTextChanged = (config: Config, displayWindAsText: boolean, data: WeatherData) => {
        this._label.remove_all_children();

        if (!displayWindAsText)
            this._label.add(this.windDirectionIcon, { x_fill: false, y_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: false });

        this._label.add(this.labelText);

        this.Display(data.wind.speed, data.wind.degree);
    }

    public Rebuild(config: Config, textColorStyle: string): [ caption: imports.gi.St.Label, label: imports.gi.St.BoxLayout ] {
        this._caption = new Label({ text: _('Wind') + LocalizedColon(config.currentLocale), style: textColorStyle });
        this._label = this.BuildLabel(config);

        return [ this._caption, this._label ];
    }

    private BuildLabel(config: Config) {
        const windBox = new BoxLayout({ vertical: false });

		// We try to make sure that icon doesn't take up more vertical space than text
		// Also we position it close to the bottom to be perceived vertically centered
		const iconPaddingBottom = Math.round(config.CurrentFontSize * 0.05);
		const iconPaddingTop = Math.round(config.CurrentFontSize * 0.15);
		const iconSize = Math.round(config.CurrentFontSize * 0.8);

		this.labelText = new Label({ text: ELLIPSIS });
		this.windDirectionIcon = new Icon({
			icon_type: IconType.SYMBOLIC,
			icon_name: APPLET_ICON,
			icon_size: iconSize,
			style: "padding-right: 5px; padding-top: " + iconPaddingTop + "px; padding-bottom: " + iconPaddingBottom + "px;"
		});
		if (!config._displayWindAsText)
			windBox.add(this.windDirectionIcon, { x_fill: false, y_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: false });
		windBox.add(this.labelText);

		return windBox;
    }

    public Display(windSpeed: number | null, windDegree: number | null) {
		if (windSpeed == null || windDegree == null) {
			this._caption.hide();
			this._label.hide();
			return;
		}

		const wind_direction = CompassDirection(windDegree);
		this.windDirectionIcon.icon_name = wind_direction;
		if (this.app.config._displayWindAsText) {
			const dirText = CompassDirectionText(windDegree);
			this.labelText.text = `${(dirText != null ? _(dirText) + " " : "")}${MPStoUserUnits(windSpeed, this.app.config.WindSpeedUnit)}`;
		}
		else {
			this.labelText.text = MPStoUserUnits(windSpeed, this.app.config.WindSpeedUnit);
		}

		// No need to display unit to Beaufort scale
		if (this.app.config.WindSpeedUnit != "Beaufort") this.labelText.text += " " + _(this.app.config.WindSpeedUnit);
		this._caption.show();
		this._label.show();
    }
}