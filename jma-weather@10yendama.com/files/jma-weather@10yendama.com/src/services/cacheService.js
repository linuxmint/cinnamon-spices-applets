const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

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

var FileCacheStorage = class FileCacheStorage {
    constructor(path) {
        this.path = path;
    }

    read() {
        try {
            if (!GLib.file_test(this.path, GLib.FileTest.EXISTS))
                return null;

            const [ok, bytes] = GLib.file_get_contents(this.path);
            if (!ok)
                return null;
            return ByteArray.toString(bytes);
        } catch (error) {
            throw new Error(`cache read: ${error.message || error}`);
        }
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

    remove() {
        try {
            if (GLib.file_test(this.path, GLib.FileTest.EXISTS))
                GLib.unlink(this.path);
        } catch (error) {
            throw new Error(`cache remove: ${error.message || error}`);
        }
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

    load(config) {
        this.lastError = null;

        let text;
        try {
            text = this._storage.read();
        } catch (error) {
            this.lastError = error;
            return null;
        }

        if (!text)
            return null;

        try {
            const payload = JSON.parse(text);
            this._validatePayload(payload);

            if (payload.signature !== this.signature(config))
                return null;

            const savedAtMs = new Date(payload.savedAt).getTime();
            const ageMs = Math.max(0, this._clock() - savedAtMs);
            if (ageMs > this._maxAgeMs) {
                this._removeQuietly();
                return null;
            }

            const jma = this._cacheableProvider(payload.snapshot.jma);
            const openMeteo = this._cacheableProvider(payload.snapshot.openMeteo);
            if (!jma && !openMeteo) {
                this._removeQuietly();
                return null;
            }

            return {
                jma,
                openMeteo,
                savedAt: payload.savedAt,
                ageMs
            };
        } catch (error) {
            this.lastError = new Error(`cache parse: ${error.message || error}`);
            this._removeQuietly();
            return null;
        }
    }

    clear() {
        this.lastError = null;
        try {
            this._storage.remove();
            return true;
        } catch (error) {
            this.lastError = error;
            return false;
        }
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
        try {
            this._storage.remove();
        } catch (_) {
            // A broken cache must never prevent the applet from starting.
        }
    }
};
