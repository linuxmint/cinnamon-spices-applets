import GLib from 'gi://GLib';

import { _, logger } from '../globals.js';
import * as cmd_launching from '../lib/gnome/command_launching.js';

/**
 * Launches a command with a timeout and logs any error on failure.
 * @param {string} name - The name of the command to display in case of error. If empty, the command itself is used.
 * @param {number} expiry - The delay in seconds before cancelling the command with a SIGTERM, then 10 seconds later with a SIGKILL. `0` means infinity/never.
 * @param {string} command - The shell command to execute.
 * @returns {Promise<void>} Resolves when the command has been executed or rejects if an error occurs.
 */
export async function launch_command(name, expiry, command) {
    try {
        await cmd_launching.launch_command(command, expiry);
    } catch (error) {
        const name_for_error = name !== '' ? name : command;
        let msg = `${_("Failed to run command")} '${name_for_error}'.\n`;

        if (error instanceof cmd_launching.Error_failed)
            msg += `${_("Reason")}${_(":")} ${_("command error")}.\n`
                + `${_("Detail")}${_(":")} ${error.message}`;
        else
        if (error instanceof cmd_launching.Error_timed_out_by_sigterm)
            msg += `${_("Reason")}${_(":")} ${_("command timeout")}.\n`
                + `${_("Detail")}${_(":")} ${error.message}`;
        else
        if (error instanceof cmd_launching.Error_timed_out_by_sigkill)
            msg += `${_("Reason")}${_(":")} ${_("command timeout (killed)")}.\n`
                + `${_("Detail")}${_(":")} ${error.message}`;
        else
        if (error instanceof GLib.Error)
            msg += `${_("Reason")}${_(":")} GLib error.\n`
                + `${_("Detail")}${_(":")}\n`
                + `Domain: ${error.domain}\n`
                + `Code: ${error.code}\n`
                + `Message: ${error.message}`;
        else
        // Fallbacks
        if (error instanceof Error)
            msg += `${_("Reason")}${_(":")} ${_("Other error")}\n`
                + `${_("Detail")}${_(":")}\n`
                + `Name: ${error.name}\n`
                + `Message: ${error.message}\n`
                + `Stack?:\n`
                + `${error?.stack}`;
        else
            msg += `${_("Unknown error type")}${_(":")} ${error}`;

        logger.warn(msg);
    }
}
