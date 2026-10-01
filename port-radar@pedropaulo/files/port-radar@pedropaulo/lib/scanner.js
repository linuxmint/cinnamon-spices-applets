const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Parser = typeof require === "function"
    ? require("./lib/parser")
    : imports.parser;

// Pass arguments directly to ss; no shell or name lookups are needed.
function createScanArgv(executable, family) {
    return [executable || "/usr/bin/ss", "-H", "-lntup", "-n", family === "IPv6" ? "-6" : "-4"];
}

var TcpScanner = class {
    constructor() {
        this._subprocess = null;
        this._cancellable = null;
        this._timeout = null;
    }

    scan(callback) {
        if (this._cancellable)
            return false;
        let executable = GLib.find_program_in_path("ss");
        if (!executable) {
            callback([], { code: "missing-dependency" });
            return true;
        }

        let cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        let records = [];
        // Ignore replies from a cancelled scan, including replies after a timeout.
        const finish = (error) => {
            if (this._cancellable !== cancellable)
                return;
            if (this._timeout !== null)
                GLib.source_remove(this._timeout);
            this._timeout = null;
            this._cancellable = null;
            this._subprocess = null;
            callback(error ? [] : records, error);
        };

        // Both address families share this deadline.
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._timeout = null;
            if (this._subprocess)
                this._subprocess.force_exit();
            cancellable.cancel();
            finish({ code: "timeout" });
            return GLib.SOURCE_REMOVE;
        });

        const readFamily = (family) => {
            try {
                let process = Gio.Subprocess.new(createScanArgv(executable, family),
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
                this._subprocess = process;
                process.communicate_utf8_async(null, cancellable, (child, result) => {
                    try {
                        let [, stdout, stderr] = child.communicate_utf8_finish(result);
                        if (this._cancellable !== cancellable)
                            return;
                        if (!child.get_successful()) {
                            finish({ code: "scan-failed", message: stderr.trim() });
                            return;
                        }
                        records = records.concat(Parser.parseSsOutput(stdout || "", family));
                        // Query each family separately: a wildcard address alone cannot tell us which it is.
                        if (family === "IPv4")
                            readFamily("IPv6");
                        else
                            finish(null);
                    } catch (error) {
                        finish({ code: "scan-failed", message: error.message });
                    }
                });
            } catch (error) {
                finish({ code: "scan-failed", message: error.message });
            }
        };
        readFamily("IPv4");
        return true;
    }

    cancel() {
        if (this._timeout !== null)
            GLib.source_remove(this._timeout);
        this._timeout = null;
        if (this._cancellable)
            this._cancellable.cancel();
        if (this._subprocess)
            this._subprocess.force_exit();
        this._cancellable = null;
        this._subprocess = null;
    }
};
