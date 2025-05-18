const launch_command = require('lib/commands_launcher/launch_command.js');
const _              = require('lib/translator.js');

const {XletSettingsBase} = imports.ui.settings;
const {Gio, GLib} = imports.gi;

/** A launcher for the commands of the settings list. */
module.exports = class Commands_launcher {
    #callback_for_errors;

    /**
     * @param {XletSettingsBase} settings - The settings of the desk/applet.
     * @param {object} key_of_list - The keys of the settings' commands list.
     * @param {(message: string) => void} callback_for_errors - The function to call with a message for when an error occurs.
     */
    constructor(settings, key_of_list, callback_for_errors) {
        settings.bindWithObject(this, key_of_list, "list");
        this.#callback_for_errors = callback_for_errors;
    }

    /** @type {Array<{name: string, active: boolean, expiry: number, command: string}>} */
    list;

    async launch_commands() {
        for (const item of this.list) {
            const { name, active, expiry, command } = item;
            if (!active)
                continue;

            try { await launch_command(command, expiry); }
            catch (error) {
                const name_for_error = name !== '' ? name : command;
                let msg = `${_("the command")} '${name_for_error}' ${_("failed")}`;
                if (error instanceof GLib.ShellError)
                    msg += ` ${_("due to a wrong format")}.\n`
                        + "\n"
                        + `${_("Detail")}${_(":")}\n`
                        + error.message;
                else
                if (error instanceof Gio.IOErrorEnum) {
                    if (error.code === Gio.IOErrorEnum.TIMED_OUT)
                        msg += ` ${_("due to time expiration")}.\n`
                            + "\n"
                            + `${_("Detail")}${_(":")}\n`
                            + error.message;
                    else
                    if (error.code === Gio.IOErrorEnum.FAILED)
                        msg += ` ${_("due to an error")}.\n`
                            + "\n"
                            + `${_("Detail")}${_(":")}\n`
                            + error.message;
                } else
                    msg += `${_(":")} ${error}` // last resort: full `error` object so we may see the stack trace

                this.#callback_for_errors(msg);
            }
        }
    }
}
