const { Gio, GLib } = imports.gi;

import { _, logger, metadata } from '../../globals';

const EXECUTABLE_NAME = 'auto-dark-light-time-change-listener'; // From the Makefile
const EXECUTABLE_TARGET_FOLDER_PATH = 'Time_change_listener'; // Relative to transpiled `applet.js` // TODO: find a cleaner way?

/**
 * A passive listener for system time changes.
 *
 * It interfaces the C++ program whose API is in `backend/Time_change_listener.hpp`.
 */
export class Time_change_listener {
    private _callback_when_changes: () => void;

    /**
     * @param callback_when_changes - The function to be called when the system time changes.
     * @throws {Error} If the `make` or `g++` command is not found in the system.
     * @throws {Error} If the compilation of the C++ program fails.
     */
    constructor(callback_when_changes: () => void) {
        this._callback_when_changes = callback_when_changes;

        const executable_folder_path =
            `${metadata.path}/${EXECUTABLE_TARGET_FOLDER_PATH}`;
        const executable_path = `${executable_folder_path}/${EXECUTABLE_NAME}`;

        if (!GLib.file_test(executable_path, GLib.FileTest.EXISTS))
            Time_change_listener._compile(executable_folder_path);

        this._run(executable_path);
    }

    private static _compile(executable_folder_path: string) {
        if (
            !GLib.find_program_in_path('make') ||
            !GLib.find_program_in_path('g++')
        )
            throw new Error(_("Missing dependencies 'make' and/or 'g++'. Install them, in e.g. on Debian-based system with 'sudo apt install make g++', then restart Cinnamon (Ctrl+Alt+Esc)."));

        const process = new Gio.Subprocess({
            argv: ['make', '-C', executable_folder_path],
            flags: Gio.SubprocessFlags.STDERR_PIPE
        });
        process.init(null);

        try {
            const [_ok, _stdout, stderr] =
                process.communicate_utf8(null, null);
            if (!process.get_successful())
                throw new Error(stderr || _("Unknown compilation error"));
        } catch (error) {
            throw new Error(
                `${_("Failed compilation of")} '${EXECUTABLE_NAME}'.\n`
                + "\n"
                + error.message
            );
        } finally {
            GLib.spawn_command_line_async(
                `make -C ${executable_folder_path} clean`
            );
        }
    }

    private _input: imports.gi.Gio.DataInputStream;
    private _input_error: imports.gi.Gio.DataInputStream;
    private _output: imports.gi.Gio.OutputStream;
    private _subprocess: imports.gi.Gio.Subprocess;
    private _should_run = true;

    private _run(executable_path: string) {
        this._subprocess = new Gio.Subprocess({
            argv: [executable_path],
            flags:
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDIN_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE
        });
        this._subprocess.init(null);

        this._output = this._subprocess.get_stdin_pipe();
        this._input = new Gio.DataInputStream({
            base_stream: this._subprocess.get_stdout_pipe()
        });
        this._input_error = new Gio.DataInputStream({
            base_stream: this._subprocess.get_stderr_pipe()
        });

        this._listen_input();
        this._listen_error();
    }

    private async _listen_input() { // thread-like
        do {
            await new Promise(
                resolve => this._input.read_line_async(
                    GLib.PRIORITY_DEFAULT, null, resolve
                )
            );
            this._callback_when_changes();
        } while (this._should_run);
    }

    private async _listen_error() { // thread-like
        do {
            const [line, length] = await new Promise(resolve =>
                this._input_error.read_line_async(
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (
                        source: imports.gi.Gio.DataInputStream,
                        result: imports.gi.Gio.AsyncResult
                    ) => {
                        try {
                            resolve(source.read_line_finish(result));
                        } catch (error) {
                            logger.warn(error);
                            resolve([null, 0]);
                        }
                    }
                )
            );
            if (line !== null && length > 0)
                logger.warn(
                    `${_("the subprocess")} \`${EXECUTABLE_NAME}\` ${_("has written on its error output")}${_(":")} ${line}`
                );
        } while (this._should_run);
    }

    /** Enables listening for the system time changes. */
    enable() {
        this._output.write('enable\n', null);
    }

    /** Disables listening for the system time changes. */
    disable() {
        this._output.write('disable\n', null);
    }

    /** Releases acquired resources */
    dispose() {
        this._callback_when_changes = () => {};
        this._should_run = false;
        this._output.write('exit\n', null);
        this._subprocess.wait(null);
    }
}
