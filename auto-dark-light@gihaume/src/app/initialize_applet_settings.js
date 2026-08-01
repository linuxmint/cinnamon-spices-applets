const { AppletSettings } = imports.ui.settings;

/** @typedef {import('./ui/Settings.js').Settings} Settings */

/**
 * @param {string} uuid
 * @param {number} instance_id
 * @returns {Settings}
 */
export function initialize_applet_settings(uuid, instance_id) {
    const settings = /** @type {Settings} */ (/** @type {unknown} */ (
        new AppletSettings({}, uuid, instance_id)
    ));

    /** @type {const} */ ([
        'is_appearance_dark',
        'appearance_keybinding',
        'is_appearance_auto',
        // 'is_appearance_unsynced',
        // 'next_update',

        'auto_sunrise_offset', 'auto_sunset_offset',
        // 'auto_sunrise', 'auto_sunset',
        'manual_sunrise', 'manual_sunset',
        'is_sunrise_auto', 'is_sunset_auto',

        'manual_latitude', 'manual_longitude',
        'is_location_auto',
        // 'system_timezone',
        // 'auto_latitude', 'auto_longitude',

        // 'light_themes_mouse',
        // 'light_themes_apps',
        // 'light_themes_icons',
        // 'light_themes_desktop',

        // 'dark_themes_mouse',
        // 'dark_themes_apps',
        // 'dark_themes_icons',
        // 'dark_themes_desktop',

        'enable_background',

        'light_background_is_slideshow',
        'light_background_file',
        'light_background_slideshow_folder',

        'dark_background_is_slideshow',
        'dark_background_file',
        'dark_background_slideshow_folder',

        'light_commands_is_enabled',
        'light_commands_list',
        'dark_commands_is_enabled',
        'dark_commands_list',

        'scheduler_timer_absolute_time', // TODO: use to get the unsynced appearance state properly restored?

        'light_themes_have_been_detected',
        'dark_themes_have_been_detected'
        // Commented entries because: https://github.com/linuxmint/cinnamon/issues/9336
    ]).forEach(key => settings.bindWithObject(settings, key, key));

    return settings;
}
