const {Gio, GLib} = imports.gi;

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

/**
 * Executes a command with a timeout and transmits any error on failure.
 *
 * @async
 * @param {string} command - The shell command to execute.
 * @param {number} [timeout_seconds=10] - The delay in seconds before cancelling the command. `0` means infinity/never.
 * @returns {Promise<void>}
 * @throws {GLib.ShellError} - If the command format is invalid.
 * @throws {Gio.IOErrorEnum.TIMED_OUT} - If the command is cancelled due to a timeout.
 * @throws {Gio.IOErrorEnum.FAILED} - If the command fails with a non-zero exit code. The error message is the `stderr` output if any, otherwise the exit status.
 */
async function launch_command(command, timeout_seconds = 10) {
    const [_ok, argvp] = GLib.shell_parse_argv(command); // can throw GLib.ShellError

    const proc = new Gio.Subprocess({
        argv: argvp,
        flags: Gio.SubprocessFlags.STDERR_PIPE
    });

    const cancellable = Gio.Cancellable.new();
    const cancellable_signal_handler_id = cancellable.connect(
        () => proc.force_exit()
    );

    proc.init(cancellable);

    let timeout_event_source_id;
    if (timeout_seconds !== 0)
        timeout_event_source_id = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            timeout_seconds,
            () => {
                cancellable.cancel();
                timeout_event_source_id = undefined;
            }
        );

    try {
        const [_stdout, stderr] = await proc.communicate_utf8_async(null, null);

        if (cancellable.is_cancelled())
            throw new Gio.IOErrorEnum({
                code: Gio.IOErrorEnum.TIMED_OUT,
                message: "timed out"
            });

        const exit_status = proc.get_exit_status();
        if (exit_status !== 0) {
            throw new Gio.IOErrorEnum({
                code: Gio.IOErrorEnum.FAILED,
                message: stderr ? stderr.trim() : "exit status: " + exit_status
            });
        }
    } finally {
        cancellable.disconnect(cancellable_signal_handler_id);
        if (timeout_event_source_id)
            GLib.source_remove(timeout_event_source_id);
    }
}

module.exports = launch_command;

// // Example usage:
//
// async function main() {
//     console.error("start");
//     try {
//         await launch_command('./test', 5);
//     } catch (error) {
//         if (error instanceof GLib.ShellError)
//             console.error("command format: " + error.message);
//         else
//         if (error instanceof Gio.IOErrorEnum) {
//             if (error.code === Gio.IOErrorEnum.TIMED_OUT)
//                 console.error("command aborted due to time out");
//             else
//             if (error.code === Gio.IOErrorEnum.FAILED)
//                 console.error("command failed: " + error.message);
//         } else
//             console.error(error); // full object so we can see the stack trace
//     }
// }

// main();

// new GLib.MainLoop(null, false).run();
