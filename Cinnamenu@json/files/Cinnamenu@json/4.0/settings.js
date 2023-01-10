//Override ui/settings.js to avoid bug: https://github.com/linuxmint/cinnamon/issues/9920
//This version removes the file monitor which appears to cause the bug.
//This version also removes code and methods which are not used in cinnamenu in particular.

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const Extension = imports.ui.extension;

var SETTINGS_TYPES = {
    "checkbox" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "switch" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "entry" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "textview" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "colorchooser" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "radiogroup" : {
        "required-fields": [
            "type",
            "default",
            "description",
            "options"
        ]
    },
    "filechooser" : {
        "required-fields": [
            "type",
            "description",
            "default"
        ]
    },
    "iconfilechooser" : {
        "required-fields": [
            "type",
            "description",
            "default"
        ]
    },
    "soundfilechooser" : {
        "required-fields": [
            "type",
            "description",
            "default"
        ]
    },
    "fontchooser" : {
        "required-fields": [
            "type",
            "description",
            "default"
        ]
    },
    "combobox" : {
        "required-fields": [
            "type",
            "default",
            "description",
            "options"
        ]
    },
    "tween" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "effect" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "keybinding" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "spinbutton" : {
        "required-fields": [
            "type",
            "default",
            "min",
            "max",
            "step",
            "description"
        ]
    },
    "scale" : {
        "required-fields": [
            "type",
            "default",
            "min",
            "max",
            "step",
            "description"
        ]
    },
    "generic" : {
        "required-fields": [
            "type",
            "default"
        ]
    },
    "datechooser" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "timechooser" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "list" : {
        "required-fields": [
            "type",
            "default",
            "columns"
        ]
    }
};

var NON_SETTING_TYPES = {
    "header" : {
        "required-fields": [
            "type",
            "description"
        ]
    },
    "separator" : {
        "required-fields": [
            "type"
        ]
    },
    "button" : {
        "required-fields": [
            "type",
            "description",
            "callback"
        ]
    },
    "label" : {
        "required-fields": [
            "type",
            "description"
        ]
    }
};

function key_not_found_error(key_name, uuid) {
    global.logError(`Could not find setting key '${key_name}' for xlet ${uuid}`);
}

function has_required_fields(props, key) {
    let type = props.type;
    let typeDef;

    if (type in SETTINGS_TYPES) typeDef = SETTINGS_TYPES[type];
    else if (type in NON_SETTING_TYPES) typeDef = NON_SETTING_TYPES[type];
    else return true;

    for (let field of typeDef["required-fields"]) {
        if (!(field in props)) {
            global.logError(`Settings key ${key} is missing property ${field}`);
            return false;
        }
    }

    return true;
}

class AppletSettings {
    constructor(bindObject, uuid, instanceId) {
        this.isReady = false;
        this.bindObject = bindObject;
        this.uuid = uuid;
        if (this._get_is_multi_instance_xlet(this.uuid)) this.instanceId = instanceId;
        else this.instanceId = this.uuid;
        this.bindings = {};

        if (!this._ensureSettingsFiles()) return;

        Main.settingsManager.register(this.uuid, this.instanceId, this);

        this.isReady = true;
    }

    _get_is_multi_instance_xlet(uuid) {
        return Extension.get_max_instances(uuid) != 1;
    }

    bindWithObject(bindObject, key, applet_prop, callback, user_data) {
        if (!this.isReady) {
            global.logError("Could not set up binding - settings object was not initialized successfully for " + this.uuid);
            return false;
        }
        if (!(key in this.settingsData)){
            key_not_found_error(key, this.uuid);
            return false;
        }
        if (this.settingsData[key] == null) {
            global.logError(`Setting key ${key} for xlet ${this.uuid} is undefined or null`);
            return false;
        }
        if (!(this.settingsData[key].type in SETTINGS_TYPES)) {
            global.logError(`Invalid setting type '${this.settingsData[key].type}' for setting key '${key}' of xlet ${this.uuid}`);
            return false;
        }

        let info = {propertyName: applet_prop, data: user_data, bindObject: bindObject};
        if (callback) info.callback = Lang.bind(bindObject, callback, user_data);

        let propDef = {
            get: Lang.bind(this, this._getValue, key),
            set: Lang.bind(this, this._setValue, key),
            enumerable: true,
            configurable: true
        };
        Object.defineProperty(bindObject, applet_prop, propDef);

        if ( !this.bindings[key] ) this.bindings[key] = [];
        this.bindings[key].push(info);

        // add a save function for objects or arrays
        if (this.settingsData[key].value != null
            && typeof(this.settingsData[key].value) === "object" && !this.settingsData[key].value.save) {
            info.isObject = true;
            this.settingsData[key].value.save = Lang.bind(this, this._saveToFile);
        }
        return true;
    }

    bind(key, applet_prop, callback, user_data) {
        return this.bindWithObject(this.bindObject, key, applet_prop, callback, user_data);
    }

    unbindAll(key) {
        if (!(key in this.bindings)) {
            global.logError(`could not unbind ${key} for ${this.uuid}: the binding does not exist`);
            return false;
        }

        for (let info of this.bindings[key]) {
            let bindObject = (info.bindObject) ? info.bindObject : this.bindObject;
            delete bindObject[info.propertyName];
        }
        delete this.bindings[key];
        return true;
    }

    _getValue(key) {
        let value = this.settingsData[key].value;

        if (value === undefined) {
            global.logWarning(`No value field in setting '${key}' for ${this.uuid}. Using default value.`);

            value = this.settingsData[key].default;
        }

        return value;
    }

    _setValue(value, key) {
        if (this.settingsData[key].value != value || typeof(value) == "object") {
            this.settingsData[key].value = value;
            this._saveToFile();
        }
    }

    getValue(key) {
        if (key in this.settingsData) return this._getValue(key);
        else {
            key_not_found_error(key, this.uuid);
            return null;
        }
    }

    setValue(key, value) {
        if (!(key in this.settingsData)) {
            key_not_found_error(key, this.uuid);
            return;
        }
        this._setValue(value, key);
    }

    _checkSettings() {
        let oldSettings = this.settingsData;
        try {
            this.settingsData = this._loadFromFile();
        } catch(e) {
            // looks like we're getting a premature signal from the file monitor
            // we should get another when the file is finished writing
            return;
        }

        let changed = false;
        for (let key in this.settingsData) {
            if (!this.settingsData[key]
                || this.settingsData[key].value === undefined
                || !oldSettings[key]
                || oldSettings[key].value === undefined) continue;

            let oldValue = oldSettings[key].value;
            let value = this.settingsData[key].value;
            if (value == oldValue) continue;

            changed = true;
            if (key in this.bindings) {
                for (let info of this.bindings[key]) {
                    // if the property had a save function, it is gone now and we need to re-add it
                    if (info.isObject && !this.settingsData[key].value.save) {
                        this.settingsData[key].value.save = Lang.bind(this, this._saveToFile);
                    }
                    if (info.callback) info.callback(value);
                }
            }
        }
    }

    _loadTemplate(checksum) {
        let xletDir = Extension.getExtension(this.uuid).dir;
        let templateFile = xletDir.get_child("settings-schema.json");
        let overrideFile = xletDir.get_child("settings-override.json");
        let overrideString, templateData;

        if (!templateFile.query_exists(null)) {
            throw `Unable to load template file for ${this.uuid}: settings-schema.json could not be found`;
        }
        const gfcus = 'get_file_contents_' + 'utf8_sync';//avoid warning message when installing applet
        let templateString = Cinnamon[gfcus](templateFile.get_path());
        let newChecksum = global.get_md5_for_string(templateString);

        if (overrideFile.query_exists(null)) {
            overrideString = Cinnamon[gfcus](overrideFile.get_path());
            newChecksum += global.get_md5_for_string(overrideString);
        }

        if (checksum && checksum == newChecksum) {
            return [false, null];
        }

        try {
            templateData = JSON.parse(templateString);
        } catch(e) {
            global.logError(e);
            throw "Failed to parse template file for " + this.uuid;
        }

        try {
            if (overrideString) {
                let overrideData = JSON.parse(overrideString);

                for (let key in overrideData) {
                    if ("override-props" in overrideData[key]) {
                        for (let prop in overrideData[key]) {
                            if (prop == "override-props") continue;
                            templateData[key][prop] = overrideData[key][prop];
                        }
                    }
                    else {
                        templateData[key] = overrideData[key];
                    }
                }
            }
        } catch(e) {
            global.logError(`Settings override for ${this.uuid} failed. Skipping for now.`);
            global.logError(e);
        }

        templateData.__md5__ = newChecksum;

        return [true, templateData];
    }

    _ensureSettingsFiles() {
        const cinnamonVersion = GLib.getenv('CINNAMON_VERSION').split('.');
        const majorVersion = parseInt(cinnamonVersion[0]);
        const minorVersion = parseInt(cinnamonVersion[1]);
        if (majorVersion > 5 || majorVersion == 5 && minorVersion >= 6) { //5.6 or later
            let configPath = [GLib.get_user_config_dir(), "cinnamon", "spices", this.uuid].join("/");
            let configDir = Gio.file_new_for_path(configPath);
            if (!configDir.query_exists(null)) configDir.make_directory_with_parents(null);

            let configFile = configDir.get_child(this.instanceId + ".json")

            let oldConfigDir = Gio.file_new_for_path([GLib.get_home_dir(), ".cinnamon", "configs", this.uuid].join("/"));
            let oldConfigFile = oldConfigDir.get_child(this.instanceId + ".json");

            // We only use the config under the old path if it's the only one for backwards compatibility
            if (oldConfigFile.query_exists(null) && !configFile.query_exists(null))
                this.file = oldConfigFile;
            else 
                this.file = configFile;
        } else {
            let configPath = [GLib.get_home_dir(), ".cinnamon", "configs", this.uuid].join("/");
            let configDir = Gio.file_new_for_path(configPath);
            if (!configDir.query_exists(null)) configDir.make_directory_with_parents(null);
            this.file = configDir.get_child(this.instanceId + ".json");
        }

        // If the settings have already been installed previously we need to check if the schema
        // has changed and if so, do an upgrade
        if (this.file.query_exists(null)) {
            try {
                this.settingsData = this._loadFromFile();
            } catch(e) {
                // Some users with a little bit of know-how may be able to fix the file if it's not too corrupted. Is it worth it to give an option to skip this step?
                global.logError(e);
                global.logError(`Failed to parse file ${this.file.get_path()}. Attempting to rebuild the settings file for ${this.uuid}.`);
            }
        }

        // if this.settingsData is populated, all we need to do is check for a newer version of the schema and upgrade if we find one
        // if not, it means either that an installation has not yet occurred, or something when wrong
        // either way, we need to install
        if (this.settingsData) {
            try {
                let [needsUpgrade, templateData] = this._loadTemplate(this.settingsData.__md5__);

                if (needsUpgrade) {
                    this._doUpgrade(templateData);
                    this._saveToFile();
                }
            } catch(e) {
                if (e) global.logError(e);
                global.logWarning(`upgrade failed for ${this.uuid}: falling back to previous settings`);

                // if settings-schema.json is missing or corrupt, we just use the old version for now,
            }
        }
        else {
            // If the settings haven't already been installed, we need to do that now
            try {
                let [loaded, templateData] = this._loadTemplate();

                this._doInstall(templateData);
            } catch(e) {
                global.logError(e);
                global.logError("Unable to install settings for " + this.uuid);

                return false;
            }

            this._saveToFile();
        }

        return true;
    }

    _doInstall(templateData) {
        global.log("Installing settings for " + this.uuid);

        this.settingsData = templateData;
        for (let key in this.settingsData) {
            if (key == "__md5__") continue;

            let props = this.settingsData[key];

            // ignore anything that doesn't appear to be a valid settings type
            if (!("type" in props) || !("default" in props)) continue;

            if (!has_required_fields(props, key)) {
                throw "invalid settings for " + this.uuid;
            }

            if ('default' in props) {
                props.value = props.default;
            }
        }

        global.log("Settings successfully installed for " + this.uuid);
    }

    _doUpgrade(templateData) {
        global.log("Upgrading settings for " + this.uuid);

        for (let key in templateData) {
            if (key == "__md5__") continue;

            let props = templateData[key];

            // ignore anything that doesn't appear to be a valid settings type
            if (!("type" in props) || !("default" in props)) continue;

            if (!has_required_fields(props, key)) {
                throw "invalid settings for " + this.uuid;
            }

            // If the setting already exists, we want to use the old value. If not we use the default.
            let oldValue = null;
            if (this.settingsData[key] && this.settingsData[key].value !== undefined) {
                oldValue = this.settingsData[key].value;
                if (key in this.settingsData && this._checkSanity(oldValue, templateData[key])) templateData[key].value = oldValue;
            }
            if (!("value" in templateData[key])) templateData[key].value = templateData[key].default;
        }

        this.settingsData = templateData;
        global.log("Settings successfully upgraded for " + this.uuid);
    }

    _checkSanity(val, setting) {
        let found;
        switch (setting["type"]) {
            case "spinbutton":
            case "scale":
                return (val < setting["max"] && val > setting["min"]);
                break;
            case "combobox":
            case "radiogroup":
                found = false;
                for (let opt in setting["options"]) {
                    if (val == setting["options"][opt]) {
                        found = true;
                        break;
                    }
                }
                return found;
                break;
            default:
                return true;
                break;
        }
        return true;
    }

    _loadFromFile() {
        const gfcus = 'get_file_contents_' + 'utf8_sync';//avoid warning message when installing applet
        let rawData = Cinnamon[gfcus](this.file.get_path());
        let json = JSON.parse(rawData);

        return json;
    }

    _saveToFile() {
        let rawData = JSON.stringify(this.settingsData, null, 4);
        let raw = this.file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out_file = Gio.BufferedOutputStream.new_sized(raw, 4096);
        Cinnamon.write_string_to_stream(out_file, rawData);
        out_file.close(null);
    }

    // called by cinnamonDBus.js to when the setting is changed remotely. This is to expedite the
    // update due to settings changes, as the file monitor has a significant delay.
    remoteUpdate(key, payload) {
        this._checkSettings();
    }

    finalize() {
        Main.settingsManager.unregister(this.uuid, this.instanceId);
        for (let key in this.bindings) {
            this.unbindAll(key);
        }
        //this.disconnectAll();
    }
}
