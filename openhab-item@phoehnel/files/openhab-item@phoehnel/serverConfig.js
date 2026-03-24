const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const CONFIG_DIR_NAME = "openhab-item@phoehnel";
const CONFIG_FILE_NAME = "server.json";

var ServerConfig = class ServerConfig {
    constructor() {
        this._configDir = GLib.build_filenamev([
            GLib.get_user_config_dir(), CONFIG_DIR_NAME
        ]);
        this._configPath = GLib.build_filenamev([
            this._configDir, CONFIG_FILE_NAME
        ]);
        this._monitor = null;
        this._changeCallbacks = [];
    }

    read() {
        try {
            let file = Gio.File.new_for_path(this._configPath);
            if (!file.query_exists(null)) {
                return null;
            }
            let [ok, contents] = GLib.file_get_contents(this._configPath);
            if (ok) {
                let text = imports.byteArray.toString(contents);
                return JSON.parse(text);
            }
        } catch (e) {
            global.logError("OpenHAB: Failed to read server config: " + e.message);
        }
        return null;
    }

    write(config) {
        try {
            GLib.mkdir_with_parents(this._configDir, 0o755);
            let data = JSON.stringify(config, null, 2);
            GLib.file_set_contents(this._configPath, data);
            return true;
        } catch (e) {
            global.logError("OpenHAB: Failed to write server config: " + e.message);
            return false;
        }
    }

    startMonitor(callback) {
        this._changeCallbacks.push(callback);

        if (this._monitor) {
            return;
        }

        try {
            // Ensure the config directory and file exist so we can monitor
            GLib.mkdir_with_parents(this._configDir, 0o755);
            let file = Gio.File.new_for_path(this._configPath);
            if (!file.query_exists(null)) {
                // Create empty config so the file exists for monitoring
                this.write({ serverUrl: "", apiToken: "", pollInterval: 30 });
            }

            this._monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect("changed", (monitor, file, otherFile, eventType) => {
                if (eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT ||
                    eventType === Gio.FileMonitorEvent.CHANGED) {
                    let config = this.read();
                    if (config) {
                        for (let cb of this._changeCallbacks) {
                            try {
                                cb(config);
                            } catch (e) {
                                global.logError("OpenHAB: Config change callback error: " + e.message);
                            }
                        }
                    }
                }
            });
        } catch (e) {
            global.logError("OpenHAB: Failed to start config monitor: " + e.message);
        }
    }

    stopMonitor() {
        if (this._monitor) {
            this._monitor.cancel();
            this._monitor = null;
        }
        this._changeCallbacks = [];
    }
};
