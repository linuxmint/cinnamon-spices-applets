import type { Applet } from "../ui/Applet";
import type { Settings } from "../ui/Settings";
import { System_color_scheme } from "../../lib/sys/System_color_scheme";
import { System_themes } from "../../lib/sys/System_themes";

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
        this._settings.setValue('light_themes_mouse',   System_themes.mouse);
        this._settings.setValue('light_themes_apps',    System_themes.apps);
        this._settings.setValue('light_themes_icons',   System_themes.icons);
        this._settings.setValue('light_themes_desktop', System_themes.desktop);
        this._settings.light_themes_have_been_detected = true;
    }

    detect_dark_themes(): void {
        this._settings.setValue('dark_themes_mouse',   System_themes.mouse);
        this._settings.setValue('dark_themes_apps',    System_themes.apps);
        this._settings.setValue('dark_themes_icons',   System_themes.icons);
        this._settings.setValue('dark_themes_desktop', System_themes.desktop);
        this._settings.dark_themes_have_been_detected = true;
    }

    apply_light_themes(): void {
        System_themes.mouse   = this._settings.getValue('light_themes_mouse');
        System_themes.apps    = this._settings.getValue('light_themes_apps');
        System_themes.icons   = this._settings.getValue('light_themes_icons');
        System_themes.desktop = this._settings.getValue('light_themes_desktop');
        System_color_scheme.value = 'prefer-light';
    }

    apply_dark_themes(): void {
        System_themes.mouse   = this._settings.getValue('dark_themes_mouse');
        System_themes.apps    = this._settings.getValue('dark_themes_apps');
        System_themes.icons   = this._settings.getValue('dark_themes_icons');
        System_themes.desktop = this._settings.getValue('dark_themes_desktop');
        System_color_scheme.value = 'prefer-dark';
    }
}
