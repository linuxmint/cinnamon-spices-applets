const AlertByteArray = imports.byteArray;
const AlertGLib = imports.gi.GLib;
const AlertGio = imports.gi.Gio;

const ALERT_CACHE_SCHEMA_VERSION = 1;
const DEFAULT_ALERT_MAX_AGE_MS = 10 * 60 * 1000;

function _safeAlertComponent(value) {
    const safe = String(value ?? "default").trim()
        .replace(/[^A-Za-z0-9_.-]/g, "_");
    return safe || "default";
}

function _isAlertNotFound(error) {
    return error && typeof error.matches === "function" &&
        error.matches(AlertGio.IOErrorEnum, AlertGio.IOErrorEnum.NOT_FOUND);
}

var AlertFileCacheStorage = class AlertFileCacheStorage {
    constructor(path) {
        this.path = path;
    }

    readAsync(callback) {
        const file = AlertGio.File.new_for_path(this.path);
        file.load_contents_async(null, (source, result) => {
            try {
                const [ok, bytes] = source.load_contents_finish(result);
                callback(null, ok ? AlertByteArray.toString(bytes) : null);
            } catch (error) {
                if (_isAlertNotFound(error)) {
                    callback(null, null);
                    return;
                }
                callback(new Error(`alert cache read: ${error.message || error}`));
            }
        });
    }

    write(value) {
        AlertGLib.mkdir_with_parents(AlertGLib.path_get_dirname(this.path), 0o700);
        AlertGLib.file_set_contents(this.path, value);
    }

    removeAsync(callback) {
        const file = AlertGio.File.new_for_path(this.path);
        file.delete_async(AlertGLib.PRIORITY_DEFAULT, null, (source, result) => {
            try {
                source.delete_finish(result);
                callback(null);
            } catch (error) {
                callback(_isAlertNotFound(error)
                    ? null
                    : new Error(`alert cache remove: ${error.message || error}`));
            }
        });
    }
};

var AlertCacheService = class AlertCacheService {
    constructor(options = {}) {
        const uuid = _safeAlertComponent(options.uuid || "jma-weather");
        const instanceId = _safeAlertComponent(options.instanceId ?? "default");
        const cacheDir = options.cacheDir ||
            `${AlertGLib.get_user_cache_dir()}/${uuid}`;
        this._clock = typeof options.clock === "function"
            ? options.clock
            : () => Date.now();
        this._maxAgeMs = Number.isFinite(Number(options.maxAgeMs))
            ? Math.max(0, Number(options.maxAgeMs))
            : DEFAULT_ALERT_MAX_AGE_MS;
        this._storage = options.storage || new AlertFileCacheStorage(
            `${cacheDir}/alerts-${instanceId}.json`
        );
        this.lastError = null;
    }

    signature(config) {
        return JSON.stringify({
            officeCode: String(config?.officeCode || "").trim(),
            municipalityCode: String(config?.municipalityCode || "").trim()
        });
    }

    save(config, data) {
        this.lastError = null;
        if (!data || !Array.isArray(data.alerts))
            return false;

        const payload = {
            schemaVersion: ALERT_CACHE_SCHEMA_VERSION,
            signature: this.signature(config),
            savedAt: new Date(this._clock()).toISOString(),
            data
        };
        try {
            this._storage.write(JSON.stringify(payload));
            return true;
        } catch (error) {
            this.lastError = error;
            return false;
        }
    }

    loadAsync(config, callback) {
        this.lastError = null;
        this._storage.readAsync((readError, text) => {
            if (readError) {
                this.lastError = readError;
                callback(null);
                return;
            }
            if (!text) {
                callback(null);
                return;
            }
            try {
                const payload = JSON.parse(text);
                if (payload?.schemaVersion !== ALERT_CACHE_SCHEMA_VERSION ||
                    payload.signature !== this.signature(config) ||
                    !payload.data || !Array.isArray(payload.data.alerts)) {
                    callback(null);
                    return;
                }

                const ageMs = Math.max(
                    0,
                    this._clock() - new Date(payload.savedAt).getTime()
                );
                if (!Number.isFinite(ageMs) || ageMs > this._maxAgeMs) {
                    this._removeQuietly();
                    callback(null);
                    return;
                }
                callback({ data: payload.data, savedAt: payload.savedAt, ageMs });
            } catch (error) {
                this.lastError = error;
                this._removeQuietly();
                callback(null);
            }
        });
    }

    _removeQuietly() {
        this._storage.removeAsync(() => {
            // Alert cache failures must not affect weather startup.
        });
    }
};
