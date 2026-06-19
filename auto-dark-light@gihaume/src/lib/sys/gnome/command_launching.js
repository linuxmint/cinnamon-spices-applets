const { Gio, GLib } = imports.gi;

export class Error_timed_out_by_sigterm extends Error {};
export class Error_timed_out_by_sigkill extends Error {};
export class Error_failed extends Error {};

const GNU_TIMEOUT_EXIT_STATUS_WHEN_SIGTERM = 124;
const GNU_TIMEOUT_EXIT_STATUS_WHEN_SIGKILL = 137;

/**
 * Executes a command with a timeout and transmits any error on failure.
 * @param {string} command - The shell command to execute.
 * @param {number} sigterm_timeout - The delay in seconds (s) before cancelling the command with a SIGTERM. 0 means infinity/never. Defaults to 0.
 * @param {number} sigkill_timeout - The delay in seconds (s) after SIGTERM before cancelling the command with a SIGKILL. 0 means infinity/never. `sigterm_timeout` at 0 disables this. Defaults to 10.
 * @returns {Promise<void>} Resolves when the command has been executed or rejects if an error occurs.
 * @throws {GLib.Error} - If an error occurs during communication with the subprocess running the command.
 * @throws {Error_timed_out_by_sigterm} - If the command is cancelled due to a timeout by SIGTERM.
 * @throws {Error_timed_out_by_sigkill} - If the command is cancelled due to a timeout by SIGKILL.
 * @throws {Error_failed} - If the command fails with a non-zero exit code. The error message is the `stderr` output if any, otherwise the exit status.
 */
export async function launch_command(
    command, sigterm_timeout = 0, sigkill_timeout = 10
) {
    const wrapped_command =
        `timeout --kill-after=${sigkill_timeout}s ${sigterm_timeout}s sh -c ${GLib.shell_quote(command)}`;
    const [_ok, argvp] = GLib.shell_parse_argv(wrapped_command); // Can throw `GLib.Error` with domain `GLib.ShellError`

    const process = new Gio.Subprocess({
        argv: argvp,
        flags: Gio.SubprocessFlags.STDERR_PIPE
    });

    const start_time = Date.now(); // milliseconds (ms)
    process.init(null);
    const [_stdout, stderr] = await new Promise((resolve, reject) => {
        process.communicate_utf8_async(null, null, (source, result) => {
            try {
                const [_ok, stdout, stderr] =
                    /** @type {imports.gi.Gio.Subprocess} */ (source)
                        .communicate_utf8_finish(result);
                resolve([stdout, stderr]);
            } catch (error) {
                reject(error);
            }
        });
    });
    const elapsed_time = (Date.now() - start_time) / 1000; // seconds (s)

    const exit_status = process.get_exit_status();
    switch (exit_status) {
        case 0:
            break;
        case GNU_TIMEOUT_EXIT_STATUS_WHEN_SIGTERM:
            throw new Error_timed_out_by_sigterm(
                "The command may have been timed out by SIGTERM"
            );
        case GNU_TIMEOUT_EXIT_STATUS_WHEN_SIGKILL:
            throw new Error_timed_out_by_sigkill(
                "The command was probably killed by an external SIGKILL"
            );
        case 1:  // Workaround for 'timeout' sending SIGKILL not reported with the intended above exit status
            if (
                sigterm_timeout > 0 &&
                elapsed_time >= sigterm_timeout + sigkill_timeout
            )
                throw new Error_timed_out_by_sigkill(
                    "The command was probably timed out by SIGKILL"
                );
            // No break in order to fall through, and so also needs to stay directly above the default case
        default:
            throw new Error_failed(
                stderr ? stderr.trim() : "exit status: " + exit_status
            );
    }
}
