const AlertByteArray = imports.byteArray;
const AlertGLib = imports.gi.GLib;

const ALERT_CACHE_SCHEMA_VERSION = 1;
const DEFAULT_ALERT_MAX_AGE_MS = 10 * 60 * 1000;

function _safeAlertComponent(value) {
    const safe = String(value ?? "default").trim()
        .replace(/[^A-Za-z0-9_.-]/g, "_");
    return safe || "default";
}

var AlertFileCacheStorage = class AlertFileCacheStorage {
    constructor(path) {
        this.path = path;
    }

    read() {
        if (!AlertGLib.file_test(this.path, AlertGLib.FileTest.EXISTS))
            return null;
        const [ok, bytes] = AlertGLib.file_get_contents(this.path);
        return ok ? AlertByteArray.toString(bytes) : null;
    }

    write(value) {
        AlertGLib.mkdir_with_parents(AlertGLib.path_get_dirname(this.path), 0o700);
        AlertGLib.file_set_contents(this.path, value);
    }

    remove() {
        if (AlertGLib.file_test(this.path, AlertGLib.FileTest.EXISTS))
            AlertGLib.unlink(this.path);
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

    load(config) {
        this.lastError = null;
        try {
            const text = this._storage.read();
            if (!text)
                return null;
            const payload = JSON.parse(text);
            if (payload?.schemaVersion !== ALERT_CACHE_SCHEMA_VERSION ||
                payload.signature !== this.signature(config) ||
                !payload.data || !Array.isArray(payload.data.alerts))
                return null;

            const ageMs = Math.max(
                0,
                this._clock() - new Date(payload.savedAt).getTime()
            );
            if (!Number.isFinite(ageMs) || ageMs > this._maxAgeMs) {
                this._removeQuietly();
                return null;
            }
            return { data: payload.data, savedAt: payload.savedAt, ageMs };
        } catch (error) {
            this.lastError = error;
            this._removeQuietly();
            return null;
        }
    }

    _removeQuietly() {
        try {
            this._storage.remove();
        } catch (_) {
            // Alert cache failures must not affect weather startup.
        }
    }
};
