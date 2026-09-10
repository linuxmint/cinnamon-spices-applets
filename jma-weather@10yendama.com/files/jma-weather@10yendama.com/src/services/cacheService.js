const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const CACHE_SCHEMA_VERSION = 1;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function _safeComponent(value) {
    const text = String(value ?? "default").trim();
    const safe = text.replace(/[^A-Za-z0-9_.-]/g, "_");
    return safe || "default";
}

function _normaliseConfig(config) {
    return {
        jma: {
            areaCode: String(config?.jma?.areaCode || "").trim(),
            areaName: String(config?.jma?.areaName || "").trim(),
            tempAreaName: String(config?.jma?.tempAreaName || "").trim(),
            displayName: String(config?.jma?.displayName || "").trim()
        },
        openMeteo: {
            latitude: Number(config?.openMeteo?.latitude),
            longitude: Number(config?.openMeteo?.longitude)
        }
    };
}

function _isNotFound(error) {
    return error && typeof error.matches === "function" &&
        error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND);
}

var FileCacheStorage = class FileCacheStorage {
    constructor(path) {
        this.path = path;
    }

    readAsync(callback) {
        const file = Gio.File.new_for_path(this.path);
        file.load_contents_async(null, (source, result) => {
            try {
                const [ok, bytes] = source.load_contents_finish(result);
                callback(null, ok ? ByteArray.toString(bytes) : null);
            } catch (error) {
                if (_isNotFound(error)) {
                    callback(null, null);
                    return;
                }
                callback(new Error(`cache read: ${error.message || error}`));
            }
        });
    }

    write(text) {
        try {
            const parent = GLib.path_get_dirname(this.path);
            GLib.mkdir_with_parents(parent, 0o700);
            GLib.file_set_contents(this.path, text);
        } catch (error) {
            throw new Error(`cache write: ${error.message || error}`);
        }
    }

    removeAsync(callback) {
        const file = Gio.File.new_for_path(this.path);
        file.delete_async(GLib.PRIORITY_DEFAULT, null, (source, result) => {
            try {
                source.delete_finish(result);
                callback(null);
            } catch (error) {
                callback(_isNotFound(error)
                    ? null
                    : new Error(`cache remove: ${error.message || error}`));
            }
        });
    }
};

var CacheService = class CacheService {
    constructor(options = {}) {
        const uuid = _safeComponent(options.uuid || "jma-weather");
        const instanceId = _safeComponent(options.instanceId ?? "default");
        const cacheDir = options.cacheDir || `${GLib.get_user_cache_dir()}/${uuid}`;

        this._clock = typeof options.clock === "function"
            ? options.clock
            : () => Date.now();
        this._maxAgeMs = Number.isFinite(Number(options.maxAgeMs))
            ? Math.max(0, Number(options.maxAgeMs))
            : DEFAULT_MAX_AGE_MS;
        this._storage = options.storage || new FileCacheStorage(
            `${cacheDir}/weather-${instanceId}.json`
        );
        this.lastError = null;
    }

    signature(config) {
        return JSON.stringify(_normaliseConfig(config));
    }

    save(config, snapshot) {
        this.lastError = null;

        if (!snapshot || typeof snapshot.hasData !== "function" || !snapshot.hasData())
            return false;

        const cacheableJma = this._cacheableProvider(snapshot.jma);
        const cacheableOpenMeteo = this._cacheableProvider(snapshot.openMeteo);
        if (!cacheableJma && !cacheableOpenMeteo)
            return false;

        const payload = {
            schemaVersion: CACHE_SCHEMA_VERSION,
            signature: this.signature(config),
            savedAt: new Date(this._clock()).toISOString(),
            snapshot: {
                jma: cacheableJma,
                openMeteo: cacheableOpenMeteo
            }
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
                this._validatePayload(payload);

                if (payload.signature !== this.signature(config)) {
                    callback(null);
                    return;
                }

                const savedAtMs = new Date(payload.savedAt).getTime();
                const ageMs = Math.max(0, this._clock() - savedAtMs);
                if (ageMs > this._maxAgeMs) {
                    this._removeQuietly();
                    callback(null);
                    return;
                }

                const jma = this._cacheableProvider(payload.snapshot.jma);
                const openMeteo = this._cacheableProvider(payload.snapshot.openMeteo);
                if (!jma && !openMeteo) {
                    this._removeQuietly();
                    callback(null);
                    return;
                }

                callback({
                    jma,
                    openMeteo,
                    savedAt: payload.savedAt,
                    ageMs
                });
            } catch (error) {
                this.lastError = new Error(`cache parse: ${error.message || error}`);
                this._removeQuietly();
                callback(null);
            }
        });
    }

    clearAsync(callback = () => {}) {
        this.lastError = null;
        this._storage.removeAsync(error => {
            if (error)
                this.lastError = error;
            callback(!error);
        });
    }

    _cacheableProvider(data) {
        if (!data || typeof data !== "object")
            return null;

        const updatedAtMs = new Date(data.updatedAt).getTime();
        if (Number.isNaN(updatedAtMs))
            return null;

        const ageMs = Math.max(0, this._clock() - updatedAtMs);
        return ageMs <= this._maxAgeMs ? data : null;
    }

    _validatePayload(payload) {
        if (!payload || typeof payload !== "object")
            throw new Error("payload is not an object");
        if (payload.schemaVersion !== CACHE_SCHEMA_VERSION)
            throw new Error("unsupported schema version");
        if (typeof payload.signature !== "string")
            throw new Error("signature is missing");
        if (Number.isNaN(new Date(payload.savedAt).getTime()))
            throw new Error("savedAt is invalid");
        if (!payload.snapshot || typeof payload.snapshot !== "object")
            throw new Error("snapshot is missing");
        if (!payload.snapshot.jma && !payload.snapshot.openMeteo)
            throw new Error("snapshot has no provider data");
    }

    _removeQuietly() {
        this._storage.removeAsync(() => {
            // A broken cache must never prevent the applet from starting.
        });
    }
};
