const {Gio, GLib} = imports.gi;

const TIMEOUT_EXIT_STATUS_SIGTERM = 124;
const TIMEOUT_EXIT_STATUS_SIGKILL = 137;
const SIGKILL_TIMEOUT = 10;  // [s] the time to wait after 'timeout' sends SIGTERM so it sends SIGKILL

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

/**
 * Executes a command with a timeout and transmits any error on failure.
 * @async
 * @param {string} command - The shell command to execute.
 * @param {number} [timeout=10] - The delay in seconds before cancelling the command with a SIGTERM, then a few seconds later with a SIGKILL. `0` means infinity/never.
 * @returns {Promise<void>}
 * @throws {GLib.ShellError} - If the command format is invalid.
 * @throws {Gio.IOErrorEnum.TIMED_OUT} - If the command is cancelled due to a timeout.
 * @throws {Gio.IOErrorEnum.FAILED} - If the command fails with a non-zero exit code. The error message is the `stderr` output if any, otherwise the exit status.
 */
module.exports = async function launch_command(command, timeout = 10) {
    const wrapped_command =
        `timeout --kill-after=${SIGKILL_TIMEOUT} ${timeout}s sh -c ${GLib.shell_quote(command)}`;
    const [_ok, argvp] = GLib.shell_parse_argv(wrapped_command); // can throw GLib.ShellError

    const process = new Gio.Subprocess({
        argv: argvp,
        flags: Gio.SubprocessFlags.STDERR_PIPE
    });

    const start_time = Date.now();  // [ms]
    process.init(null);
    const [_stdout, stderr] = await process.communicate_utf8_async(null, null);
    const elapsed_time = (Date.now() - start_time) / 1000;  // [s]

    const exit_status = process.get_exit_status();
    switch (exit_status) {
        case 0:
            break;
        case TIMEOUT_EXIT_STATUS_SIGTERM:
            throw new Gio.IOErrorEnum({
                code: Gio.IOErrorEnum.TIMED_OUT,
                message: `may have been timed out by SIGTERM (GNU 'timeout' exit status ${TIMEOUT_EXIT_STATUS_SIGTERM})`
            });
        case TIMEOUT_EXIT_STATUS_SIGKILL:
            throw new Gio.IOErrorEnum({
                code: Gio.IOErrorEnum.TIMED_OUT,
                message: `probably killed by an external SIGKILL (GNU 'timeout' exit status ${TIMEOUT_EXIT_STATUS_SIGKILL})`
            });
        case 1:  // workaround for 'timeout' sending SIGKILL not reported with the intended 137 exit status
            if (timeout > 0 && elapsed_time >= timeout + SIGKILL_TIMEOUT)
                throw new Gio.IOErrorEnum({
                    code: Gio.IOErrorEnum.TIMED_OUT,
                    message: `probably timed out by SIGKILL`
                });
            // no break, needs to stay directly above the default case
        default:
            throw new Gio.IOErrorEnum({
                code: Gio.IOErrorEnum.FAILED,
                message: stderr ? stderr.trim() : "exit status: " + exit_status
            });
    }
}
