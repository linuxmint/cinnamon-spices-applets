// Read the extension's exported interface; never load or patch its Core code.
const Extension = imports.ui.extension;
const ExtensionSystem = imports.ui.extensionSystem;

const EXTENSION_UUID = "display-scale-extension@rasmarc";
const API_VERSION = 1;

class ExtensionClient {
    constructor(owner, changed) {
        this._owner = owner;
        this._changed = changed;
        this._api = null;
        this._state = null;
        this._suspended = false;
        this._destroyed = false;
        this._signals = ["extension-loaded", "extension-unloaded"].map(signal =>
            Extension.Type.EXTENSION.connect(signal, (type, uuid) => {
                if (uuid === EXTENSION_UUID)
                    this._refresh(true);
            }));
        this._refresh(false);
    }

    get available() {
        return !!this._api && this._api.available === true;
    }

    _refresh(notify) {
        if (this._destroyed)
            return;
        let api = ExtensionSystem.get_object_for_uuid(EXTENSION_UUID);
        if (!api || api.apiVersion !== API_VERSION || api.available !== true)
            api = null;
        if (api === this._api)
            return;
        if (this._api)
            this._api.release(this._owner);
        this._api = api;
        if (api && !api.register(this._owner))
            this._api = null;
        if (this._api) {
            if (this._suspended)
                this._invoke("suspend");
            else if (this._state)
                this._invoke("update", this._state);
        }
        if (notify)
            this._changed(this.available);
    }

    _invoke(method, ...args) {
        if (!this.available || this._destroyed)
            return false;
        try {
            return this._api[method](this._owner, ...args);
        } catch (error) {
            global.logError(error);
            return false;
        }
    }

    prepareDesklets(enabled) {
        this._invoke("prepareDesklets", enabled);
    }

    suspend() {
        this._suspended = true;
        this._invoke("suspend");
    }

    retarget(percent) {
        this._invoke("retarget", percent);
    }

    update(state) {
        this._state = state;
        this._suspended = false;
        this._invoke("update", state);
    }

    redraw() {
        this._invoke("redraw");
    }

    destroy() {
        if (this._destroyed)
            return;
        if (this._api)
            this._api.release(this._owner);
        this._destroyed = true;
        this._api = null;
        for (const id of this._signals)
            Extension.Type.EXTENSION.disconnect(id);
        this._signals = [];
    }
}

module.exports = ExtensionClient;
