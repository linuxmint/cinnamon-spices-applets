const Themes_handler               = require('./lib/themes_handler.js');
const Background_handler           = require('./lib/background_handler.js');
const Twilights_calculator         = require('./lib/twilights_calculator.js');
const Event_scheduler              = require('./lib/event_scheduler.js');
const Timer_absolute               = require('./lib/timer_absolute.js');
const Time_of_day                  = require('./lib/time_of_day.js');
const Time_change_listener         = require('./lib/time_change_listener/time_change_listener.js');
const Timezone_change_listener     = require('./lib/timezone_change_listener.js');
const Timezone_coordinates_finder  = require('./lib/timezones_coordinates/timezone_coordinates_finder.js');
const Sleep_wakeup_listener        = require('./lib/sleep_wakeup_listener.js');
const Color_scheme_change_listener = require('./lib/color_scheme_change_listener.js');
const { _ }                        = require('./lib/translator.js');

const Applet   = imports.ui.applet;
const GLib     = imports.gi.GLib;
const Settings = imports.ui.settings;
const Main     = imports.ui.main;
const Util     = imports.misc.util;

class ThisApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        this.set_applet_tooltip(
            _("Click: toggle dark/light mode") + "\n"
          + _("Middle-click: toggle automatic switch mode")
        );

        this._init_libs();
        this._bind_ui();

        switch (Themes_handler.get_system_color_scheme()) {
            case 'prefer-dark':
                this.ui_switch_dark_mode = true;
                if (!this.themes_dark.get_if_has_detected())
                    this.themes_dark.detect();
                break;
            case 'prefer-light': default:
                this.ui_switch_dark_mode = false;
                if (!this.themes_light.get_if_has_detected())
                    this.themes_light.detect();
        }

        this.color_scheme_change_listener.enable();
        if (this.ui_switch_auto_mode) {
            this.time_change_listener.enable();
            this.sleep_wakeup_listener.enable();
        }

        this.apply_ui_switch_sync_from_timezone();
        this._update();
    }

    _init_libs() {
        this.scheduler = new Event_scheduler();

        this.timer_abs = new Timer_absolute();
        this.settings.bindWithObject(
            this.timer_abs, 'timer-absolute-set-timeout', "timeout"
        );

        this.themes_light = new Themes_handler(this.settings, false, {
            mouse_pointer: 'light-mode_themes_entry_mouse-pointer',
            applications:  'light-mode_themes_entry_applications',
            icons:         'light-mode_themes_entry_icons',
            desktop:       'light-mode_themes_entry_desktop',
            has_detected:  'has-detected-themes-light'
        });
        this.themes_dark = new Themes_handler(this.settings, true, {
            mouse_pointer: 'dark-mode_themes_entry_mouse-pointer',
            applications:  'dark-mode_themes_entry_applications',
            icons:         'dark-mode_themes_entry_icons',
            desktop:       'dark-mode_themes_entry_desktop',
            has_detected:  'has-detected-themes-dark'
        });

        this.color_scheme_change_listener =
            new Color_scheme_change_listener(() => {
                this.ui_switch_dark_mode =
                    Themes_handler.get_system_color_scheme() === 'prefer-dark';
                this._update_state();
            });

        this.background_light = new Background_handler(
            this.settings,
            {
                is_slideshow:     'light-mode_background_switch_slideshow',
                background_file:  'light-mode_background_filechooser_file',
                slideshow_folder: 'light-mode_background_filechooser_folder'
            }
        );
        this.background_dark = new Background_handler(
            this.settings,
            {
                is_slideshow:     'dark-mode_background_switch_slideshow',
                background_file:  'dark-mode_background_filechooser_file',
                slideshow_folder: 'dark-mode_background_filechooser_folder'
            }
        );

        try {
            this.time_change_listener = new Time_change_listener(
                `${this.metadata.path}/lib/time_change_listener`,
                this._update.bind(this)
            );
        } catch (error) {
            this._notify_critical(error.message);
            this.settings.finalize(); // somewhat crash cleanly
            return;                   // ''
        }

        this.timezone_change_listener = new Timezone_change_listener(() => {
            this.apply_coordinates_from_system_timezone();
            this._update();
        });

        this.timezone_coordinates_finder = new Timezone_coordinates_finder(
            `${this.metadata.path}/lib/timezones_coordinates`
        );

        this.sleep_wakeup_listener = new Sleep_wakeup_listener(
            () => {
                this.time_change_listener.disable();
                this.scheduler.unset_the_event();
            },
            () => {
                this._update();
                this.time_change_listener.enable();
            }
        );
    }

    _bind_ui() {
        this.settings.bind(
                  'settings_state_switch_dark-mode',
                              "ui_switch_dark_mode",
            () => { this.apply_ui_switch_dark_mode(); this._update_state(); }
        );
        this.settings.bind(
            'settings_state_is-auto-mode-inverted',
                           "is_auto_mode_inverted"
        );
        this.settings.bind(
               'settings_control_switch_auto-mode',
                             "ui_switch_auto_mode",
           () => { this.apply_ui_switch_auto_mode(); this._update(); }
        );
        this.settings.bind(
               'settings_location_switch_sync-from-timezone',
                              "ui_switch_sync_from_timezone",
            () => { this.apply_ui_switch_sync_from_timezone(); this._update(); }
        );
        this.settings.bind(
               'settings_location_entry_latitude',
                              "ui_entry_latitude",
            () => { this.apply_ui_entry_coordinates(); this._update(); }
        );
        this.settings.bind(
               'settings_location_entry_longitude',
                              "ui_entry_longitude",
            () => { this.apply_ui_entry_coordinates(); this._update(); }
        );
        this.settings.bind(
            'both-modes_background_switch_enable',
                                "ui_switch_enable_background"
        )
    }

    apply_ui_switch_dark_mode() {
        this.color_scheme_change_listener.disable();
        this.ui_switch_dark_mode ? this.themes_dark. apply()
                                 : this.themes_light.apply();
        this.color_scheme_change_listener.enable();

        if (this.ui_switch_enable_background)
            this.ui_switch_dark_mode ? this.background_dark.apply()
                                     : this.background_light.apply();

        this._update_applet_icon();
    }

    apply_ui_switch_auto_mode() {
        if (this.ui_switch_auto_mode) {
            this.is_auto_mode_inverted = false;
            this.time_change_listener.enable();
            this.sleep_wakeup_listener.enable();
        } else {
            this.time_change_listener.disable();
            this.sleep_wakeup_listener.disable();
            this.scheduler.unset_the_event();
        }
    }

    apply_ui_switch_sync_from_timezone() {
        if (this.ui_switch_sync_from_timezone) {
            this.apply_coordinates_from_system_timezone();
            this.timezone_change_listener.enable();
        } else {
            this.timezone_change_listener.disable();
            this.apply_ui_entry_coordinates();
        }
    }

    apply_ui_entry_coordinates() {
        this.latitude  = this.ui_entry_latitude;
        this.longitude = this.ui_entry_longitude;
    }

    apply_coordinates_from_system_timezone() {
        const timezone = GLib.TimeZone.new_local().get_identifier();
        [this.latitude, this.longitude] =
            this.timezone_coordinates_finder.find_coordinates(timezone);
    }

    _update_state() {
        if (this.ui_switch_auto_mode && this._update_twilights()) {
            this._update_is_auto_mode_inverted();
            this._schedule_auto_switch();
        }
        this._update_applet_icon();
    }

    _update() {
        if (this.ui_switch_auto_mode && this._update_twilights()) {
            if (!this.is_auto_mode_inverted || this.timer_abs.has_expired())
                this._update_mode();
            this._update_is_auto_mode_inverted();
            this._schedule_auto_switch();
        }
        this._update_applet_icon();
    }

    _update_mode() {
        this.ui_switch_dark_mode = !this._is_now_day();
        this.apply_ui_switch_dark_mode();
        this.is_auto_mode_inverted = false;
    }

    _update_is_auto_mode_inverted() {
        this.is_auto_mode_inverted =
                this.ui_switch_dark_mode === this._is_now_day();
    }

    _is_now_day() {
        return Time_of_day.now().is_between(this.sunrise, this.sunset);
    }

    /**
     * @returns {boolean} Whether the twilights have been successfully updated.
     */
    _update_twilights() {
        let sunrise, sunset;
        try { ({sunrise, sunset} =
            Twilights_calculator.get_today(this.latitude, this.longitude));
        }
        catch (error) {
            this._notify_error(error.message);
            return false;
        }
        this.sunrise = sunrise;
        this.sunset  = sunset;
        return true;
    }

    _update_applet_icon() {
        this.set_applet_icon_symbolic_name(
            this.ui_switch_auto_mode
                ? this.is_auto_mode_inverted
                    ? 'auto-inverted-symbolic'
                    : 'auto-symbolic'
                : this.ui_switch_dark_mode
                    ? 'dark-symbolic'
                    : 'light-symbolic'
        );
    }

    _schedule_auto_switch() {
        const callback = this.is_auto_mode_inverted ?
              () => {}
            : this.ui_switch_dark_mode ?
                  this._apply_light_mode.bind(this)
                : this._apply_dark_mode .bind(this);

        const time = this.ui_switch_dark_mode ?
              (this.is_auto_mode_inverted ? this.sunset  : this.sunrise)
            : (this.is_auto_mode_inverted ? this.sunrise : this.sunset);

        this.timer_abs.set(time);

        this.scheduler.set_the_event(time, () => {
            this.is_auto_mode_inverted = false;
            callback();
            if (!this._update_twilights())
                return;
            this._schedule_auto_switch();
            this._update_applet_icon();
        });
    }

    _apply_light_mode() {
        this.ui_switch_dark_mode = false;
        this.apply_ui_switch_dark_mode();
    }

    _apply_dark_mode() {
        this.ui_switch_dark_mode = true;
        this.apply_ui_switch_dark_mode();
    }

    on_applet_clicked() { // built-in method
        if (this.ui_switch_auto_mode)
            this.is_auto_mode_inverted = !this.is_auto_mode_inverted;
        this.ui_switch_dark_mode = !this.ui_switch_dark_mode;
        this.apply_ui_switch_dark_mode();
        this._update_state();
    }

    on_applet_middle_clicked() { // built-in method
        this.ui_switch_auto_mode = !this.ui_switch_auto_mode;
        this.apply_ui_switch_auto_mode();
        this._update();
    }

    on_button_open_os_date_time_settings() {
        Util.spawnCommandLine("cinnamon-settings calendar");
    }

    on_button_show_start_times() {
        if (!this._update_twilights())
            return;
        this._notify(
            _("Today's automatic mode switch times:") + '\n'
            + `- ${_("Light mode:")} ${this.sunrise.as_string()}` + '\n'
            + `- ${_("Dark mode:") } ${this.sunset .as_string()}`
        );
    }

    on_button_open_os_themes_settings() {
        Util.spawnCommandLineAsync('cinnamon-settings themes', null, null);
    }

    on_button_detect_themes_light() {
        this.themes_light.detect();
        this.ui_switch_dark_mode = false;
        this._update_state();
    }

    on_button_apply_themes_light() { this.themes_light.apply(); }

    on_button_detect_themes_dark() {
        this.themes_dark.detect();
        this.ui_switch_dark_mode = true;
        this._update_state();
    }

    on_button_apply_themes_dark() { this.themes_dark.apply(); }

    on_button_open_os_background_settings() {
        Util.spawnCommandLineAsync('cinnamon-settings background', null, null);
    }

    on_button_detect_background_light() { this.background_light.detect(); }

    on_button_apply_background_light() { this.background_light.apply(); }

    on_button_detect_background_dark() { this.background_dark.detect(); }

    on_button_apply_background_dark() { this.background_dark.apply(); }

    _notify(msg) { Main.notify(this.metadata.name, msg); }

    _notify_error(msg) {
        Main.notifyError(this.metadata.name, _("Error:") + " " + msg);
    }

    _notify_critical(msg) {
        Main.criticalNotify(
            this.metadata.name,
            _("Critical error:") + " " + msg
        );
    }

    on_applet_removed_from_panel() { // built-in method
        this.scheduler                   .finalize();
        this.time_change_listener        .finalize();
        this.sleep_wakeup_listener       .finalize();
        this.timezone_change_listener    .finalize();
        this.timezone_coordinates_finder .finalize();
        this.color_scheme_change_listener.finalize();
        this.settings                    .finalize();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ThisApplet(metadata, orientation, panel_height, instance_id);
}
