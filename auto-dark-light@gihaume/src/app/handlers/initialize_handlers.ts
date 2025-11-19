const { GLib } = imports.gi;

import * as mobx from 'mobx';

import { _ } from '../../globals';
import { Appearance_handler } from './Appearance_handler';
import type { Applet } from '../ui/Applet';
import { Background_handler } from './Background_handler';
import { Commands_handler } from './Commands_handler';
import { Event_scheduler } from "../../lib/sys/Event_scheduler/Event_scheduler";
import { Keybinding_handler } from '../../lib/sys/Keybinding_handler';
import { Location_handler } from './Location_handler';
import { logger } from '../../globals';
import type { Settings } from '../ui/Settings';
import { sleep } from '../../lib/utils';
import { Sleep_events_listener } from '../../lib/sys/Sleep_events_listener/Sleep_events_listener';
import { System_color_scheme } from '../../lib/sys/System_color_scheme';
import { Themes_handler } from './Themes_handler';
import { Time_change_listener } from '../../lib/sys/Time_change_listener';
import { Time_of_day } from '../../lib/core/Time_of_day';
import { Twilights_handler } from './Twilights_handler';

const DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING = 2000; // milliseconds (ms)

export function initialize_handlers(applet: Applet, settings: Settings): void {
    const location_handler = new Location_handler({
        manual_location: {
            latitude: settings.manual_latitude,
            longitude: settings.manual_longitude
        },
        is_location_auto: settings.is_location_auto
    });

    // Controls
    settings.bind('manual_latitude', null, value => {
        location_handler.manual_location.latitude = value;
    });
    settings.bind('manual_longitude', null, value => {
        location_handler.manual_location.longitude = value;
    });
    settings.bind('is_location_auto', null, value => {
        location_handler.is_location_auto = value;
    });

    // Views
    mobx.autorun(() => {
        settings.setValue('system_timezone', location_handler.timezone); // https://github.com/linuxmint/cinnamon/issues/9336
    });
    mobx.autorun(() => {
        settings.setValue( // https://github.com/linuxmint/cinnamon/issues/9336
            'auto_latitude', location_handler.auto_location.latitude
        );
        settings.setValue( // https://github.com/linuxmint/cinnamon/issues/9336
            'auto_longitude', location_handler.auto_location.longitude
        );
    });

    const twilights_handler = new Twilights_handler({
        location: location_handler.location,
        auto_sunrise_offset: settings.auto_sunrise_offset,
        auto_sunset_offset: settings.auto_sunset_offset,
        manual_sunrise: new Time_of_day(settings.manual_sunrise),
        manual_sunset: new Time_of_day(settings.manual_sunset),
        is_sunrise_auto: settings.is_sunrise_auto,
        is_sunset_auto: settings.is_sunset_auto
    });

    // Controls
    mobx.autorun(() => {
        twilights_handler.location = location_handler.location;
    });
    settings.bind('auto_sunrise_offset', null, value => {
        twilights_handler.auto_sunrise_offset = value;
    });
    settings.bind('auto_sunset_offset', null, value => {
        twilights_handler.auto_sunset_offset = value;
    });
    settings.bind('manual_sunrise', null, value => {
        twilights_handler.manual_sunrise = new Time_of_day(value);
    });
    settings.bind('manual_sunset', null, value => {
        twilights_handler.manual_sunset = new Time_of_day(value);
    });
    settings.bind('is_sunrise_auto', null, value => {
        twilights_handler.is_sunrise_auto = value;
    });
    settings.bind('is_sunset_auto', null, value => {
        twilights_handler.is_sunset_auto = value;
    });

    // Views
    mobx.reaction(() => twilights_handler.auto_sunrise, async () => { // `autorun` doesn't track in an async execution context
        await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING); // https://github.com/linuxmint/cinnamon/issues/12362#issuecomment-3195498976
        settings.setValue( // https://github.com/linuxmint/cinnamon/issues/9336
            'auto_sunrise', twilights_handler.auto_sunrise.get_as_string_hhmm()
        );
    }, { fireImmediately: true });
    mobx.reaction(() => twilights_handler.auto_sunset, async () => { // `autorun` doesn't track in an async execution context
        await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING); // https://github.com/linuxmint/cinnamon/issues/12362#issuecomment-3195498976
        settings.setValue( // https://github.com/linuxmint/cinnamon/issues/9336
            'auto_sunset', twilights_handler.auto_sunset.get_as_string_hhmm()
        );
    }, { fireImmediately: true });

    const appearance_handler = new Appearance_handler({
        twilights: twilights_handler.twilights,
        manual_is_dark: System_color_scheme.value === 'prefer-dark',
        is_auto: settings.is_appearance_auto
    });

    // Controls
    mobx.autorun(() => {
        appearance_handler.twilights = twilights_handler.twilights;
    });
    // @ts-ignore: wrong return type in @ci-types/cjs 6.0.2-5
    applet.on_applet_clicked = () => {
        appearance_handler.toggle_is_dark();
    };
    // @ts-ignore: wrong return type in @ci-types/cjs 6.0.2-5
    applet.on_applet_middle_clicked = () => {
        appearance_handler.toggle_is_auto();
    };
    settings.bind('is_appearance_dark', null, value => {
        appearance_handler.manual_is_dark = value
    });
    settings.bind('is_appearance_auto', null, value => {
        appearance_handler.is_auto = value
    });

    // Views
    mobx.reaction(() => appearance_handler.manual_is_dark, async () => { // `autorun` doesn't track in an async execution context
        await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING); // https://github.com/linuxmint/cinnamon/issues/12362#issuecomment-3195498976
        settings.is_appearance_dark = appearance_handler.manual_is_dark;
    }, { fireImmediately: true });
    mobx.reaction(() => appearance_handler.is_auto, () => {
        settings.is_appearance_auto = appearance_handler.is_auto;
    });
    mobx.reaction(() => appearance_handler.is_unsynced, async () => { // `autorun` doesn't track in an async execution context
        await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING); // https://github.com/linuxmint/cinnamon/issues/12362#issuecomment-3195498976
        settings.setValue( // https://github.com/linuxmint/cinnamon/issues/9336
            'is_appearance_unsynced', appearance_handler.is_unsynced
        );
    }, { fireImmediately: true });
    mobx.reaction(() => appearance_handler.next_twilight, async () => { // `autorun` doesn't track in an async execution context
        await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING); // https://github.com/linuxmint/cinnamon/issues/12362#issuecomment-3195498976
        settings.setValue( // https://github.com/linuxmint/cinnamon/issues/9336
            'next_update', appearance_handler.next_twilight.get_as_string_hhmm()
        );
    }, { fireImmediately: true });
    mobx.autorun(() => {
        applet.set_applet_icon_symbolic_name(
            appearance_handler.is_auto
                ? appearance_handler.is_unsynced
                    ? 'auto-inverted-symbolic'
                    : 'auto-symbolic'
                : appearance_handler.manual_is_dark
                    ? 'dark-symbolic'
                    : 'light-symbolic'
        );
    });

    const keybinding_handler = new Keybinding_handler(() => {
        appearance_handler.toggle_is_dark();
    });
    keybinding_handler.keybinding = settings.appearance_keybinding;
    settings.bind('appearance_keybinding', null, value => {
        keybinding_handler.keybinding = value;
    });

    const themes_handler = new Themes_handler(applet, settings);

    if (System_color_scheme.value === 'prefer-dark') { // TODO: clear this idea so the user if not confused
        if (settings.dark_themes_have_been_detected)
            themes_handler.detect_dark_themes();
    } else {
        if (settings.light_themes_have_been_detected)
            themes_handler.detect_light_themes();
    }
    const color_scheme = mobx.makeAutoObservable({
        value: System_color_scheme.value
    });
    const system_color_scheme = new System_color_scheme(new_color_scheme => {
        color_scheme.value = new_color_scheme;
    });
    let is_update_from_system = false; // Temporary fix // TODO: improve the model
    mobx.autorun(() => {
        appearance_handler.manual_is_dark =
            color_scheme.value === 'prefer-dark';
        is_update_from_system = true;
    });

    const background_handler = new Background_handler(applet, settings);
    const commands_handler = new Commands_handler(applet, settings);

    mobx.reaction(() => appearance_handler.manual_is_dark, () => {
        if (is_update_from_system === true) {
            is_update_from_system = false;
            return;
        }
        if (appearance_handler.manual_is_dark) {
            system_color_scheme.disable();
            themes_handler.apply_dark_themes();
            system_color_scheme.enable();
            if (settings.enable_background)
                background_handler.apply_dark_background();
            if (settings.dark_commands_is_enabled)
                commands_handler.launch_dark_commands();
        } else {
            system_color_scheme.disable();
            themes_handler.apply_light_themes();
            system_color_scheme.enable();
            if (settings.enable_background)
                background_handler.apply_light_background();
            if (settings.light_commands_is_enabled)
                commands_handler.launch_light_commands();
        }
    }, { fireImmediately: true });
    mobx.autorun(() => {
        if (!appearance_handler.is_auto)
            return;
        appearance_handler.manual_is_dark = appearance_handler.is_dark;
    });

    const time_change_listener = new Time_change_listener( // Throws
        () => mobx.runInAction(() => {
            twilights_handler.update();
            appearance_handler.update_time();
            if (scheduler.is_set && scheduler.get_if_should_be_expired()) // TODO: need of the same logic at startup ?
                appearance_handler.sync_is_dark();
        })
    );

    const sleep_events_listener = new Sleep_events_listener(
        // on sleep entries:
        () => {
            time_change_listener.disable();
        },
        // on wake-up unlocked:
        () => mobx.runInAction(() => {
            twilights_handler.update();
            appearance_handler.update_time();
            if (scheduler.is_set && scheduler.get_if_should_be_expired()) // TODO: need of the same logic at startup ?
                appearance_handler.sync_is_dark();
            time_change_listener.enable();
        })
    );

    const scheduler = new Event_scheduler();
    const schedule_the_event = () => {
        // logger.info(`Next change at ${appearance_handler.next_twilight.get_as_string_hmmss()}`); // Debug
        scheduler.set_the_event(appearance_handler.next_twilight, () => {
            twilights_handler.update();
            appearance_handler.update_time();
            appearance_handler.sync_is_dark();
        });
    };
    mobx.reaction(() => appearance_handler.is_auto, () => {
        if (appearance_handler.is_auto) {
            appearance_handler.update_time();
            appearance_handler.sync_is_dark();
            schedule_the_event();
            time_change_listener.enable();
            sleep_events_listener.enable();
        } else {
            scheduler.unset_the_event();
            time_change_listener.disable();
            sleep_events_listener.disable();
        }
    });
    mobx.reaction(() => appearance_handler.next_twilight, () => {
        if (appearance_handler.is_auto)
            schedule_the_event();
    }, { fireImmediately: true });

    applet.set_applet_tooltip(
        `<b>${_("Click")}</b>${_(":")} ${_("toggle dark/light appearance")}\n`
        + `<b>${_("Middle-click")}</b>${_(":")} ${_("toggle automatic switch")}`,
        true // use_markup
    );
    applet.on_button_open_os_timezone_settings =
        () => GLib.spawn_command_line_async("cinnamon-settings calendar");
    applet.on_button_open_os_themes_settings =
        () => GLib.spawn_command_line_async('cinnamon-settings themes');
    applet.on_button_open_os_background_settings =
        () => GLib.spawn_command_line_async('cinnamon-settings background');

    // applet.on_applet_instances_changed = () => {};
    // applet.on_applet_added_to_panel = () => {};
    // applet.on_applet_reloaded = () => {};
    // applet.on_orientation_changed = (orientation: imports.gi.St.Side) => {};
    // // @ts-ignore: wrong return type in @ci-types/cjs 6.0.2-5
    // applet.on_panel_height_changed = () => {};
    // applet.on_panel_icon_size_changed = () => {};

    applet.on_applet_removed_from_panel = () => {
        keybinding_handler.dispose();
        location_handler.dispose();
        scheduler.dispose();
        sleep_events_listener.dispose();
        system_color_scheme.dispose();
        time_change_listener.dispose();
        settings.finalize();
    };

    system_color_scheme.enable();
    time_change_listener.enable();
    sleep_events_listener.enable();
}
