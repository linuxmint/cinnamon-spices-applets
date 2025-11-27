import type { Applet } from "../ui/Applet";
import { Color_scheme_handler as Color_scheme } from "../../lib/sys/cinnamon/Color_scheme_handler";
import type { Settings } from "../ui/Settings";
import { Themes_accessor as Themes } from "../../lib/sys/cinnamon/Themes_accessor";

export class Themes_handler {
    private readonly _settings: Settings;

    constructor(applet: Applet, settings: Settings) {
        this._settings = settings;

        applet.on_button_detect_themes_light = () => this.detect_light_themes();
        applet.on_button_detect_themes_dark = () => this.detect_dark_themes();
        applet.on_button_apply_themes_light = () => this.apply_light_themes();
        applet.on_button_apply_themes_dark = () => this.apply_dark_themes();
    }

    detect_light_themes(): void {
        this._settings.setValue('light_themes_mouse',   Themes.mouse);
        this._settings.setValue('light_themes_apps',    Themes.apps);
        this._settings.setValue('light_themes_icons',   Themes.icons);
        this._settings.setValue('light_themes_desktop', Themes.desktop);
        this._settings.light_themes_have_been_detected = true;
    }

    detect_dark_themes(): void {
        this._settings.setValue('dark_themes_mouse',   Themes.mouse);
        this._settings.setValue('dark_themes_apps',    Themes.apps);
        this._settings.setValue('dark_themes_icons',   Themes.icons);
        this._settings.setValue('dark_themes_desktop', Themes.desktop);
        this._settings.dark_themes_have_been_detected = true;
    }

    apply_light_themes(): void {
        Themes.mouse   = this._settings.getValue('light_themes_mouse');
        Themes.apps    = this._settings.getValue('light_themes_apps');
        Themes.icons   = this._settings.getValue('light_themes_icons');
        Themes.desktop = this._settings.getValue('light_themes_desktop');
        Color_scheme.value = 'prefer-light';
    }

    apply_dark_themes(): void {
        Themes.mouse   = this._settings.getValue('dark_themes_mouse');
        Themes.apps    = this._settings.getValue('dark_themes_apps');
        Themes.icons   = this._settings.getValue('dark_themes_icons');
        Themes.desktop = this._settings.getValue('dark_themes_desktop');
        Color_scheme.value = 'prefer-dark';
    }
}
