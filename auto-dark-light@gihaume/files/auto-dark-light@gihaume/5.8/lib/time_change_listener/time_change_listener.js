const _ = require('lib/translator.js');

const {Gio, GLib} = imports.gi;

const EXECUTABLE_NAME = "auto-dark-light-time-change-listener";

/** A passive listener for system time changes. It interfaces the C++ program whose API is in `time_change_listener.hpp`. */
module.exports = class Time_change_listener {
    #callback_when_changes;
    #callback_for_errors;
    #subprocess;
    #input;
    #input_error;
    #output;
    #end_listen = false;

    /**
     * @param {string} path - The absolute path where the C++ files are located.
     * @param {() => void} callback_when_changes - The function to be called when the system time changes.
     * @param {(message: string) => void} callback_for_errors - The function to call with a message for when an error occurs.
     * @throws {Error} If the `make` and `gcc` commands are not found in the system or if the compilation of the C++ program fails.
     */
    constructor(path, callback_when_changes, callback_for_errors) {
        this.#callback_when_changes = callback_when_changes;
        this.#callback_for_errors = callback_for_errors;

        if (!(GLib.find_program_in_path('make') && GLib.find_program_in_path('g++')))
            throw new Error(_("Missing dependencies `make` and/or `g++`. Install them, in e.g. on Debian-based system with `sudo apt install make g++`, then reload the applet in restarting Cinnamon."));

        const compilation = new Gio.Subprocess({
            argv: ['make', '-C', path],
            flags: Gio.SubprocessFlags.STDERR_PIPE
        });
        compilation.init(null);
        try {
            const [_ok, _stdout, stderr] = compilation.communicate_utf8(null, null);
            if (!compilation.get_successful())
                throw new Error(stderr);
        } catch (error) {
            throw new Error(
                `${_("Compilation of")} \`${EXECUTABLE_NAME}\` ${_("failed")}.\n`
                + "\n"
                + error.message
            );
        }

        const executable_path = `${path}/${EXECUTABLE_NAME}`;
        this.#subprocess = new Gio.Subprocess({
            argv: [executable_path],
            flags:
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDIN_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE
        });
        this.#subprocess.init(null);

        this.#output = this.#subprocess.get_stdin_pipe();
        this.#input = new Gio.DataInputStream({
            base_stream: this.#subprocess.get_stdout_pipe()
        });
        this.#input_error = new Gio.DataInputStream({
            base_stream: this.#subprocess.get_stderr_pipe()
        });

        this.#listen_input();
        this.#listen_error();
    }

    async #listen_input() { // thread-like
        do {
            await new Promise(resolve =>
                this.#input.read_line_async(GLib.PRIORITY_DEFAULT, null, resolve)
            );
            this.#callback_when_changes();
        } while (!this.#end_listen);
    }

    async #listen_error() { // thread-like
        do {
            let [line, length] = await new Promise(resolve =>
                this.#input_error.read_line_async(
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (source, result) => {
                        try { resolve(source.read_line_finish(result)); }
                        catch (error) {
                            this.#callback_for_errors(error);
                            resolve([null, 0]);
                        }
                    }
                )
            );
            if (line !== null && length > 0)
                this.#callback_for_errors(
                    `${_("the subprocess")} \`${EXECUTABLE_NAME}\` ${_("wrote on its error output")}${_(":")} ${line}`
                );
        } while (!this.#end_listen);
    }

    /** Enables listening for the system time changes. */
    enable() {
        this.#output.write('enable\n', null);
    }

    /** Disables listening for the system time changes. */
    disable() {
        this.#output.write('disable\n', null);
    }

    /** Declares the object as finished to release any ressource acquired. */
    finalize() {
        this.#callback_when_changes = () => {};  // Be sure to not call it again
        this.#end_listen = true;
        this.#output.write('exit\n', null);
        this.#subprocess.wait(null);
    }
}
