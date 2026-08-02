import { launch_command } from '../launch_command.js';

/** @typedef {import('../ui/Applet.js').Applet} Applet */
/** @typedef {import('../ui/Settings.js').Settings} Settings */

export class Commands_handler {
    /** @private @readonly @type {Settings} */
    _settings;

    /**
     * @param {Applet} applet
     * @param {Settings} settings
     */
    constructor(applet, settings) {
        this._settings = settings;

        applet.on_button_launch_commands_light =
            () => this.launch_light_commands();
        applet.on_button_launch_commands_dark =
            () => this.launch_dark_commands();
    }

    /** @returns {void} */
    launch_dark_commands() {
        this._launch_commands(this._settings.dark_commands_list);
    }

    /** @returns {void} */
    launch_light_commands() {
        this._launch_commands(this._settings.light_commands_list);
    }

    /**
     * @private
     * @param {Settings['light_commands_list']
     *     | Settings['dark_commands_list']} commands_list
     * @returns {void}
     */
    _launch_commands(commands_list) {
        for (const command of commands_list) {
            if (!command.active)
                continue;
            launch_command(command.name, command.expiry, command.command);
        }
    }
}
