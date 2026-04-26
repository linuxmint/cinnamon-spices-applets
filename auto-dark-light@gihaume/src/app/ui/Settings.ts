/** The names and types must match `settings-schema.json`.  */

import type { Time_hms, Command } from "../../types";

export interface Settings extends imports.ui.settings.AppletSettings {
    is_appearance_dark: boolean;
    appearance_keybinding: string;
    is_appearance_auto: boolean;
    is_appearance_unsynced: boolean;
    next_update: string;

    auto_sunrise_offset: number, auto_sunset_offset: number;
    auto_sunrise: string, auto_sunset: string;
    manual_sunrise: Time_hms, manual_sunset: Time_hms;
    is_sunrise_auto: boolean, is_sunset_auto: boolean;

    manual_latitude: number, manual_longitude: number;
    is_location_auto: boolean;
    system_timezone: string;
    auto_latitude: number, auto_longitude: number;

    light_themes_mouse: string;
    light_themes_apps: string;
    light_themes_icons: string;
    light_themes_desktop: string;

    dark_themes_mouse: string;
    dark_themes_apps: string;
    dark_themes_icons: string;
    dark_themes_desktop: string;

    enable_background: boolean;

    light_background_is_slideshow: boolean;
    light_background_file: string;
    light_background_slideshow_folder: string;

    dark_background_is_slideshow: boolean;
    dark_background_file: string;
    dark_background_slideshow_folder: string;

    light_commands_is_enabled: boolean;
    light_commands_list: Array<Command>;

    dark_commands_is_enabled: boolean;
    dark_commands_list: Array<Command>;

    scheduler_timer_absolute_time: number;

    light_themes_have_been_detected: boolean;
    dark_themes_have_been_detected: boolean;

    bindWithObject(
        object: object,
        key: keyof Settings,
        obj_property: string
    ): boolean;

    bind<Key extends keyof Settings>(
        key: Key,
        applet_prop: null,
        callback: (new_value: Settings[Key]) => void
    ): boolean;

    getValue<Key extends keyof Settings>(key: Key): Settings[Key];

    setValue<Key extends keyof Settings>(
        key: Key,
        value: Settings[Key]
    ): void;
}
