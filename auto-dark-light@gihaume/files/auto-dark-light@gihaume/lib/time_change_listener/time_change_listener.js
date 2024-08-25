const { _ }       = require('./lib/translator.js');

const {Gio, GLib} = imports.gi;

/**
 * A passive listener for system time changes. It interfaces the C++ program
 * which API is in `time_change_listener.hpp`.
 */
class Time_change_listener {
    #callback;
    #subprocess;
    #input;
    #input_error;
    #output;
    #end_listen = false;

    /**
     * @param {string} path - The absolute path where the C++ files are located.
     * @param {function(): void} callback - The function to be called when the system time changes.
     * @throws {Error} If the `make` and `gcc` commands are not found in the system.
     *
     */
    constructor(path, callback) {
        this.#callback = callback;

        if (!(GLib.find_program_in_path('make') && GLib.find_program_in_path('gcc')))
            throw new Error(_("Missing dependencies `make` and `gcc`. Install them, in e.g. on Debian-based system with `sudo apt install build-essential`, then reload the applet (in e.g. in restarting Cinnamon)."));

        const compilation = new Gio.Subprocess({
            argv: ['make', '-C', path],
            flags: Gio.SubprocessFlags.STDERR_PIPE
        });
        compilation.init(null);
        try {
            const [, , stderr] = compilation.communicate_utf8(null, null);
            if (!compilation.get_successful())
                throw new Error(stderr);
        } catch (error) {
            throw new Error(
                "Compilation of `time_change_listener` failed.\n\n"
                + error.message
            );
        }

        const executable_path = `${path}/time_change_listener`;
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
            this.#callback();
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
                            global.logError(error);
                            resolve([null, 0]);
                        }
                    }
                )
            );
            if (line !== null && length > 0)
                global.logError("time_change_listener process error: " + line);
        } while (!this.#end_listen);
    }

    /**
     * Enable listening for the system time changes.
     */
    enable() { this.#output.write('enable\n', null); }

    /**
     * Disable listening for the system time changes.
     */
    disable() { this.#output.write('disable\n', null); }

    /**
     * Declare the object as finished to release any ressource acquired.
     */
    finalize() {
        this.#callback = () => {};
        this.#end_listen = true;
        this.#output.write('exit\n', null);
        this.#subprocess.wait(null);
    }
}

module.exports = Time_change_listener;
