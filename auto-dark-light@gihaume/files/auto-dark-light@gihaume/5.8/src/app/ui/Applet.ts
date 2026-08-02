/** The names must match `settings-schema.json`. */

export interface Applet extends imports.ui.applet.IconApplet {
    on_button_open_os_timezone_settings: () => void;
    on_button_open_os_themes_settings: () => void;
    on_button_detect_themes_light: () => void;
    on_button_apply_themes_light: () => void;
    on_button_open_os_background_settings: () => void;
    on_button_detect_background_light: () => void;
    on_button_apply_background_light: () => void;
    on_button_launch_commands_light: () => void;
    on_button_detect_themes_dark: () => void;
    on_button_apply_themes_dark: () => void;
    on_button_detect_background_dark: () => void;
    on_button_apply_background_dark: () => void;
    on_button_launch_commands_dark: () => void;
}
