const { GLib } = imports.gi;

import { _, logger } from '../globals';
import * as cmd_launching from '../lib/sys/gnome/command_launching';

/**
 * Launches a command with a timeout and logs any error on failure.
 * @param name - The name of the command to display in case of error. If empty, the command itself is used.
 * @param expiry - The delay in seconds before cancelling the command with a SIGTERM, then 10 seconds later with a SIGKILL. `0` means infinity/never.
 * @param command - The shell command to execute.
 * @returns Resolves when the command has been executed or rejects if an error occurs.
 */
export async function launch_command(name: string, expiry: number, command: string): Promise<void> {
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
