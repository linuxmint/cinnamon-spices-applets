// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 random.kiapps
// Cinnamon applet for the native EasyEffects 7.2.3 package.
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const ByteArray = imports.byteArray;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;

const UUID = "easy-effects-selector@random.kiapps";
// Cinnamon's xlet installer and settings dialog use this locale directory.
// Keep the domain aligned with cinnamon-xlet-makepot, including custom XDG paths.
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

const SCHEMA_ID = "com.github.wwmm.easyeffects";
const OUTPUT_PRESET_KEY = "last-loaded-output-preset";
const DEFAULT_PRESET_KEY = "default-preset";
const SHUTDOWN_KEY = "shutdown-on-window-close";
const AUTOSTART_OPTION = "ee-autostart";
const SHUTDOWN_OPTION = "ee-shutdown-on-window-close";
const STATE_UPDATE_DELAY = 180;
const SELECTION_TRACKER_KEY = "selection-tracker";
const AUTOSTART_CONTENT = "[Desktop Entry]\nName=Easy Effects\nComment=Easy Effects Service\n" +
    "Exec=easyeffects --gapplication-service\nIcon=com.github.wwmm.easyeffects\n" +
    "StartupNotify=false\nTerminal=false\nType=Application\n";

// Wrap only our calls; do not change Gio prototypes shared by other applets.
function fileOperation(object, start, finish, args) {
    return new Promise((resolve, reject) => {
        try {
            object[start](...args, (source, result) => {
                try {
                    resolve(source[finish](result));
                } catch (error) {
                    reject(error);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

function ioError(error, code) {
    return error.matches && error.matches(Gio.io_error_quark(), code);
}

async function fileInfo(file, cancellable) {
    try {
        return await fileOperation(file, "query_info_async", "query_info_finish", [
            "standard::type", Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, cancellable
        ]);
    } catch (error) {
        if (ioError(error, Gio.IOErrorEnum.NOT_FOUND))
            return null;
        throw error;
    }
}

async function makeDirectory(file, cancellable) {
    try {
        await fileOperation(file, "make_directory_async", "make_directory_finish", [
            GLib.PRIORITY_DEFAULT, cancellable
        ]);
        const permissions = new Gio.FileInfo();
        permissions.set_attribute_uint32("unix::mode", 0o700);
        await fileOperation(file, "set_attributes_async", "set_attributes_finish", [
            permissions, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, cancellable
        ]);
    } catch (error) {
        if (ioError(error, Gio.IOErrorEnum.EXISTS)) {
            const info = await fileInfo(file, cancellable);
            if (info && info.get_file_type() === Gio.FileType.DIRECTORY)
                return;
        } else if (ioError(error, Gio.IOErrorEnum.NOT_FOUND) && file.get_parent()) {
            await makeDirectory(file.get_parent(), cancellable);
            await makeDirectory(file, cancellable);
            return;
        }
        throw error;
    }
}

class SelectorSettings extends Settings.AppletSettings {
    _doUpgrade(templateData) {
        // Cinnamon validates combobox values against the new schema's options.
        // Preserve the saved reference while its dynamic list is reconstructed.
        const saved = this.settingsData[DEFAULT_PRESET_KEY];
        if (saved && typeof saved.value === "string" && saved.value) {
            const options = Object.assign(Object.create(null), templateData[DEFAULT_PRESET_KEY].options);
            options[saved.value] = saved.value;
            templateData[DEFAULT_PRESET_KEY].options = options;
        }
        super._doUpgrade(templateData);
    }
}

// Read-only access to the same GSettings instances used by EasyEffects 7.2.3.
// preset-map.json contains paths extracted from its original preset serializers.
class PresetStateReader {
    constructor(map, onChange) {
        this.map = map;
        this.source = Gio.SettingsSchemaSource.get_default();
        this.onChange = onChange;
        this.groups = new Map();
        this.reference = null;
        this.expected = new Map();
        this.needsRefresh = true;
        this.output = this._group(this.map.outputSchema, null);
        try {
            this.refresh();
        } catch (error) {
            this.destroy();
            throw error;
        }
    }

    static equal(a, b) {
        if (Array.isArray(a) && Array.isArray(b))
            return a.length === b.length && a.every((value, i) => PresetStateReader.equal(value, b[i]));
        return a === b;
    }

    _group(schemaId, path) {
        const id = schemaId + "|" + (path || "");
        if (!this.groups.has(id)) {
            const schema = this.source ? this.source.lookup(schemaId, true) : null;
            if (!schema)
                throw new Error(_("The EasyEffects settings schema is missing: %s").format(schemaId));
            this.groups.set(id, {id, schema, settings: Gio.Settings.new_full(schema, null, path),
                signal: 0, keys: new Set(), values: new Map()});
        }
        return this.groups.get(id);
    }

    _watch(group, keys) {
        const previousKeys = group.keys;
        group.keys = new Set(keys);
        if (!group.signal) {
            group.signal = group.settings.connect("changed", (settings, key) => {
                if (!group.keys.has(key))
                    return;
                const value = settings.get_value(key).deep_unpack();
                const old = group.values.get(key);
                group.values.set(key, value);
                // GSettings signals potentially changed values, including repeated writes.
                if (!PresetStateReader.equal(old, value)) {
                    if (key === "plugins" || key === "num-bands")
                        this.needsRefresh = true;
                    this.onChange();
                }
            });
        }
        for (const key of keys) {
            if (!group.schema.has_key(key))
                throw new Error(_("The EasyEffects effect parameter is missing: %s").format(key));
            // Read after connecting: Gio only reports keys primed this way.
            if (!previousKeys.has(key) || !group.values.has(key))
                group.values.set(key, group.settings.get_value(key).deep_unpack());
        }
    }

    _plugin(name) {
        const match = /^(\w+)#(\d+)$/.exec(name);
        if (!match || !Object.prototype.hasOwnProperty.call(this.map.plugins, match[1]))
            throw new Error(_("Unknown EasyEffects effect: %s").format(name));
        const definition = this.map.plugins[match[1]];
        return {name, base: match[1], definition, path: definition.path + match[2] + "/"};
    }

    _channel(plugin, channel) {
        return this._group(this.map.equalizerChannel.schema, plugin.path + channel + "channel/");
    }

    refresh() {
        if (!this.needsRefresh)
            return;
        this.needsRefresh = false;
        const used = new Set([this.output.id]);
        this._watch(this.output, ["plugins", "blocklist"]);
        const names = this.output.settings.get_strv("plugins");
        for (const name of names) {
            const plugin = this._plugin(name);
            const group = this._group(plugin.definition.schema, plugin.path);
            used.add(group.id);
            this._watch(group, plugin.definition.fields.map(field => field[0]));
            if (plugin.base === "equalizer") {
                const bands = group.settings.get_int("num-bands");
                const channelKeys = [];
                for (let n = 0; n < bands; n++) {
                    for (const key of this.map.equalizerChannel.fields)
                        channelKeys.push("band" + n + "-" + key);
                }
                for (const side of ["left", "right"]) {
                    const channel = this._channel(plugin, side);
                    used.add(channel.id);
                    this._watch(channel, channelKeys);
                }
            }
        }
        for (const [id, group] of this.groups) {
            if (!used.has(id)) {
                if (group.signal)
                    group.settings.disconnect(group.signal);
                this.groups.delete(id);
            }
        }
    }

    _wanted(group, field, object) {
        const cacheKey = group.id + "|" + field[0];
        if (this.expected.has(cacheKey))
            return this.expected.get(cacheKey);
        let value = object;
        for (let i = 1; i < field.length; i++) {
            if (value === null || typeof value !== "object" || Array.isArray(value))
                throw new Error(_("Invalid structure in the default preset."));
            if (!Object.prototype.hasOwnProperty.call(value, field[i])) {
                if (i !== field.length - 1)
                    throw new Error(_("Incomplete structure in the default preset."));
                value = undefined;
                break;
            }
            value = value[field[i]];
        }
        if (value === undefined)
            value = group.settings.get_default_value(field[0]).deep_unpack();
        // Match 7.2.3's compatibility handling for older IR/model presets.
        const legacyKey = field[0] === "kernel-name" ? "kernel-path"
            : field[0] === "model-name" ? "model-path" : null;
        if (legacyKey && value === "" && typeof object[legacyKey] === "string" && object[legacyKey]) {
            const filename = object[legacyKey].split("/").pop();
            const dot = filename.lastIndexOf(".");
            value = dot > 0 ? filename.slice(0, dot) : filename;
        }
        this.expected.set(cacheKey, value);
        return value;
    }

    _matchesFields(group, fields, object) {
        for (const field of fields) {
            const wanted = this._wanted(group, field, object);
            const actual = group.settings.get_value(field[0]).deep_unpack();
            if (!PresetStateReader.equal(actual, wanted))
                return false;
        }
        return true;
    }

    matches(preset) {
        const section = preset && preset.output;
        if (!section || !Array.isArray(section.plugins_order))
            throw new Error(_("The default preset does not contain a valid output effect list."));
        const order = section.plugins_order.map(name => {
            if (typeof name !== "string")
                throw new Error(_("Invalid effect name in the default preset."));
            return name.includes("#") ? name : name + "#0";
        });
        // The cheap pipeline comparison precedes all effect parameter reads.
        if (!PresetStateReader.equal(order, this.output.settings.get_strv("plugins")))
            return false;
        if (this.reference !== preset) {
            this.reference = preset;
            this.expected.clear();
        }
        const blocklist = section.blocklist === undefined
            ? this.output.settings.get_default_value("blocklist").deep_unpack() : section.blocklist;
        if (!PresetStateReader.equal(blocklist, this.output.settings.get_strv("blocklist")))
            return false;
        for (const name of order) {
            const plugin = this._plugin(name);
            const object = Object.prototype.hasOwnProperty.call(section, name)
                ? section[name] : section[plugin.base];
            if (!object || typeof object !== "object" || Array.isArray(object))
                throw new Error(_("The effect configuration is missing from the default preset: %s").format(name));
            const group = this._group(plugin.definition.schema, plugin.path);
            // Flags, number of bands and mode precede remaining main/band fields.
            if (!this._matchesFields(group, plugin.definition.fields, object))
                return false;
            if (plugin.base === "equalizer") {
                const bands = group.settings.get_int("num-bands");
                for (const side of ["left", "right"]) {
                    const fields = [];
                    for (let n = 0; n < bands; n++) {
                        for (const key of this.map.equalizerChannel.fields)
                            fields.push(["band" + n + "-" + key, side, "band" + n, key]);
                    }
                    if (!this._matchesFields(this._channel(plugin, side), fields, object))
                        return false;
                }
            }
        }
        return true;
    }

    destroy() {
        for (const group of this.groups.values()) {
            if (group.signal)
                group.settings.disconnect(group.signal);
        }
        this.groups.clear();
        this.expected.clear();
    }
}

class EasyEffectsPresetSelector extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._loading = false;
        this._removed = false;
        this._presetItems = [];
        this._settings = null;
        this._settingsSignal = 0;
        this._shutdownSettingsSignal = 0;
        this._bypassSettingsSignal = 0;
        this._shutdownAvailable = false;
        this._appletSettings = null;
        this._defaultPreset = "";
        this._appletPath = metadata.path;
        this._fileCancellable = new Gio.Cancellable();
        this._parameterMap = null;
        this._readerPromise = null;
        this._stateUpdateRevision = 0;
        this._menuRevision = 0;
        this._defaultOptionsRevision = 0;
        this._nativeOptionsRevision = 0;
        this._autostartRevision = 0;
        this._autostartWrite = null;
        this._autostartMonitorRevision = 0;
        this._stateReader = null;
        this._stateTimeout = 0;
        this._externalLoadPending = false;
        this._selectionDirty = false;
        this._referencePreset = null;
        this._referenceDirty = true;
        this._referenceRevision = 0;
        this._referenceRequest = null;
        this._comparisonError = "";
        this._presetMonitor = null;
        this._presetMonitorSignal = 0;
        this._temporaryPresetName = null;
        this._requestedPresetName = null;
        this._autostartMonitor = null;
        this._autostartMonitorSignal = 0;
        this._autostartMonitorPath = null;
        this._autostartDirectory = GLib.build_filenamev([GLib.get_user_config_dir(), "autostart"]);
        this._autostartFile = Gio.File.new_for_path(
            GLib.build_filenamev([this._autostartDirectory, "easyeffects-service.desktop"])
        );
        this._outputDirectory = GLib.build_filenamev([
            GLib.get_user_config_dir(), "easyeffects", "output"
        ]);

        this.set_applet_icon_symbolic_name("com.github.wwmm.easyeffects-symbolic");
        this._createIconOverlay(metadata.path);

        // AppletPopupMenu passes this.actor to Cinnamon and follows panel orientation.
        // The context menu keeps its base-class manager. Sharing that manager
        // would switch between both menus on hover over their common source actor.
        this._presetMenuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this._presetMenuManager.addMenu(this.menu);

        try {
            const source = Gio.SettingsSchemaSource.get_default();
            const schema = source ? source.lookup(SCHEMA_ID, true) : null;
            if (schema && schema.has_key(OUTPUT_PRESET_KEY)) {
                this._settings = Gio.Settings.new_full(schema, null, null);
                this._settingsSignal = this._settings.connect(
                    "changed::" + OUTPUT_PRESET_KEY, () => this._onLoadedPresetChanged()
                );
                if (schema.has_key("bypass")) {
                    this._lastBypass = this._settings.get_boolean("bypass");
                    this._bypassSettingsSignal = this._settings.connect("changed::bypass", () => {
                        const bypass = this._settings.get_boolean("bypass");
                        if (this._defaultPreset && bypass !== this._lastBypass) {
                            this._selectionDirty = true;
                            this._saveSelectionTracker();
                            this._queueStateUpdate();
                        }
                        this._lastBypass = bypass;
                    });
                    this._settings.get_boolean("bypass");
                }
                this._shutdownAvailable = schema.has_key(SHUTDOWN_KEY);
                if (this._shutdownAvailable) {
                    this._shutdownSettingsSignal = this._settings.connect(
                        "changed::" + SHUTDOWN_KEY, () => this._syncEasyEffectsOptions()
                    );
                }
            }
        } catch (error) {
            global.logError(error, UUID);
        }

        try {
            this._appletSettings = new SelectorSettings(this, UUID, instanceId);
            if (!this._appletSettings.isReady)
                throw new Error(_("The Cinnamon applet settings could not be initialized."));
            this._appletSettings.bind(DEFAULT_PRESET_KEY, "_defaultPreset", this._onDefaultPresetChanged);
            this._appletSettings.bind(AUTOSTART_OPTION, "_startService", this._onAutostartChanged);
            this._appletSettings.bind(SHUTDOWN_OPTION, "_shutdownOnClose", this._onShutdownChanged);
            this._restoreSelectionTracker();
            this._syncDefaultOptions();
            this._monitorPresetDirectory();
            this._syncEasyEffectsOptions();
            this._monitorAutostart();
        } catch (error) {
            global.logError(error, UUID);
            Main.notify("EasyEffects", error.message);
        }

        this._updateSelection();
    }

    _createIconOverlay(appletPath) {
        this._iconOverlay = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: false,
            y_expand: false,
            reactive: false
        });
        this._deviationDot = new St.Icon({
            gicon: new Gio.FileIcon({file: Gio.File.new_for_path(
                GLib.build_filenamev([appletPath, "deviation-dot.svg"])
            )}),
            icon_type: St.IconType.FULLCOLOR,
            icon_size: 9 * global.ui_scale,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
            // BinLayout uses ActorAlign only for children marked as expanding.
            x_expand: true,
            y_expand: true,
            reactive: false,
            visible: false
        });
        this._applet_icon_box.set_child(null);
        this._iconOverlay.add_child(this._applet_icon);
        this._iconOverlay.add_child(this._deviationDot);
        // Center the overlay at the icon's natural size rather than stretching
        // it to the full panel height. The badge stays inside the icon bounds.
        this._applet_icon_box.set_fill(false, false);
        this._applet_icon_box.set_child(this._iconOverlay);
    }

    async _syncDefaultOptions(names = null) {
        if (this._removed || !this._appletSettings || !this._appletSettings.isReady)
            return;
        const revision = ++this._defaultOptionsRevision;
        try {
            const available = names || await this._readPresets();
            if (this._removed || revision !== this._defaultOptionsRevision)
                return;
            const options = Object.create(null);
            let emptyLabel = _("No default preset");
            while (available.includes(emptyLabel) || this._defaultPreset === emptyLabel)
                emptyLabel += " ";
            options[emptyLabel] = "";
            available.forEach(name => { options[name] = name; });
            if (this._defaultPreset && !available.includes(this._defaultPreset)) {
                let missingLabel = _("%s (no longer available)").format(this._defaultPreset);
                while (Object.prototype.hasOwnProperty.call(options, missingLabel))
                    missingLabel += " ";
                options[missingLabel] = this._defaultPreset;
            }
            if (JSON.stringify(options) !== JSON.stringify(this._appletSettings.getOptions(DEFAULT_PRESET_KEY)))
                this._appletSettings.setOptions(DEFAULT_PRESET_KEY, options);
        } catch (error) {
            if (!this._removed)
                global.logError(error, UUID);
        }
    }

    async _readAutostart() {
        // Match the native EasyEffects 7.2.3 preferences, including symlinks to files.
        const info = await fileInfo(this._autostartFile, this._fileCancellable);
        return Boolean(info && info.get_file_type() === Gio.FileType.REGULAR);
    }

    async _syncEasyEffectsOptions() {
        if (this._removed || !this._appletSettings || !this._appletSettings.isReady)
            return;
        const revision = ++this._nativeOptionsRevision;
        const writeRevision = this._autostartRevision;
        try {
            // setValue updates Cinnamon's settings dialog without invoking the
            // bound change callbacks. EasyEffects remains authoritative at startup.
            this._appletSettings.setValue(SHUTDOWN_OPTION,
                this._shutdownAvailable ? this._settings.get_boolean(SHUTDOWN_KEY) : false);
            if (this._autostartWrite)
                await this._autostartWrite;
            const enabled = await this._readAutostart();
            if (!this._removed && revision === this._nativeOptionsRevision &&
                writeRevision === this._autostartRevision)
                this._appletSettings.setValue(AUTOSTART_OPTION, enabled);
        } catch (error) {
            if (!this._removed)
                global.logError(error, UUID);
        }
    }

    _onAutostartChanged() {
        if (this._removed)
            return;
        const enabled = Boolean(this._startService);
        const revision = ++this._autostartRevision;
        const previous = this._autostartWrite || Promise.resolve();
        const operation = previous.then(async () => {
            if (this._removed || revision !== this._autostartRevision)
                return;
            const info = await fileInfo(this._autostartFile, this._fileCancellable);
            if (this._removed || revision !== this._autostartRevision)
                return;
            const actual = Boolean(info && info.get_file_type() === Gio.FileType.REGULAR);
            if (enabled !== actual) {
                if (enabled) {
                    if (info)
                        throw new Error(_("The EasyEffects autostart path is not a regular file."));
                    try {
                        await makeDirectory(Gio.File.new_for_path(this._autostartDirectory), this._fileCancellable);
                    } catch (error) {
                        throw new Error(_("The autostart directory could not be created."));
                    }
                    // GBytes owns its buffer for the full asynchronous write.
                    await fileOperation(this._autostartFile, "replace_contents_bytes_async", "replace_contents_finish", [
                        new GLib.Bytes(ByteArray.fromString(AUTOSTART_CONTENT)), null, false,
                        Gio.FileCreateFlags.PRIVATE, this._fileCancellable
                    ]);
                } else {
                    try {
                        await fileOperation(this._autostartFile, "delete_async", "delete_finish", [
                            GLib.PRIORITY_DEFAULT, this._fileCancellable
                        ]);
                    } catch (error) {
                        if (!ioError(error, Gio.IOErrorEnum.NOT_FOUND))
                            throw error;
                    }
                }
            }
        }).catch(error => {
            if (!this._removed) {
                global.logError(error, UUID);
                Main.notify("EasyEffects", _("Autostart could not be changed: %s").format(error.message));
            }
        });
        this._autostartWrite = operation;
        operation.then(() => {
            if (this._autostartWrite === operation) {
                this._autostartWrite = null;
                if (!this._removed) {
                    this._monitorAutostart();
                    this._syncEasyEffectsOptions();
                }
            }
        });
        return operation;
    }

    _onShutdownChanged() {
        if (this._removed)
            return;
        try {
            if (!this._shutdownAvailable)
                throw new Error(_("The EasyEffects setting is not available."));
            if (this._settings.get_boolean(SHUTDOWN_KEY) !== this._shutdownOnClose) {
                if (!this._settings.set_boolean(SHUTDOWN_KEY, this._shutdownOnClose))
                    throw new Error(_("The EasyEffects setting could not be saved."));
                Gio.Settings.sync();
            }
        } catch (error) {
            global.logError(error, UUID);
            Main.notify("EasyEffects", error.message);
        }
        this._syncEasyEffectsOptions();
    }

    _clearAutostartMonitor() {
        if (this._autostartMonitor) {
            this._autostartMonitor.disconnect(this._autostartMonitorSignal);
            this._autostartMonitor.cancel();
            this._autostartMonitor = null;
        }
        this._autostartMonitorSignal = 0;
        this._autostartMonitorPath = null;
    }

    async _monitorAutostart() {
        if (this._removed)
            return;
        const revision = ++this._autostartMonitorRevision;
        try {
            // Watch the parent until EasyEffects (or the user) creates autostart.
            const directory = Gio.File.new_for_path(this._autostartDirectory);
            const info = await fileInfo(directory, this._fileCancellable);
            if (this._removed || revision !== this._autostartMonitorRevision)
                return;
            const target = info && info.get_file_type() === Gio.FileType.DIRECTORY
                ? directory : Gio.File.new_for_path(GLib.get_user_config_dir());
            const path = target.get_path();
            if (this._autostartMonitorPath === path)
                return;
            this._clearAutostartMonitor();
            this._autostartMonitor = target.monitor_directory(Gio.FileMonitorFlags.NONE, null);
            this._autostartMonitorPath = path;
            this._autostartMonitorSignal = this._autostartMonitor.connect("changed", () => {
                if (!this._removed) {
                    this._syncEasyEffectsOptions();
                    this._monitorAutostart();
                }
            });
        } catch (error) {
            if (!this._removed)
                global.logError(error, UUID);
        }
    }

    _monitorPresetDirectory() {
        if (this._presetMonitor || !this._appletSettings || !this._appletSettings.isReady)
            return;
        try {
            const directory = Gio.File.new_for_path(this._outputDirectory);
            this._presetMonitor = directory.monitor_directory(Gio.FileMonitorFlags.NONE, null);
            this._presetMonitorSignal = this._presetMonitor.connect("changed", (monitor, file, otherFile) => {
                if (!this._removed) {
                    const referencePath = GLib.build_filenamev([this._outputDirectory, this._defaultPreset + ".json"]);
                    if (this._defaultPreset && (!file || file.get_path() === referencePath ||
                        (otherFile && otherFile.get_path() === referencePath))) {
                        this._invalidateReference();
                        this._queueStateUpdate();
                    }
                    this._syncDefaultOptions();
                    if (this.menu.isOpen)
                        this._populateMenu();
                }
            });
        } catch (error) {
            if (!ioError(error, Gio.IOErrorEnum.NOT_FOUND))
                global.logError(error, UUID);
        }
    }

    _onDefaultPresetChanged() {
        if (this._removed)
            return;
        this._invalidateReference();
        if (!this._defaultPreset) {
            this._cancelStateUpdate();
            this._externalLoadPending = false;
            this._selectionDirty = false;
            if (this._stateReader) {
                this._stateReader.destroy();
                this._stateReader = null;
            }
        }
        this._syncDefaultOptions();
        if (this.menu.isOpen)
            this._populateMenu();
        else
            this._updateSelection();
    }

    configureApplet(tab = 0) {
        this._syncDefaultOptions();
        this._monitorPresetDirectory();
        this._syncEasyEffectsOptions();
        this._monitorAutostart();
        super.configureApplet(tab);
    }

    // Cinnamon's base class consumes the button event and invokes this hook.
    on_applet_clicked() {
        if (!this.menu.isOpen)
            this._populateMenu();
        this.menu.toggle();
    }

    async _readPresets() {
        const directory = Gio.File.new_for_path(this._outputDirectory);
        let enumerator;
        try {
            enumerator = await fileOperation(directory, "enumerate_children_async", "enumerate_children_finish", [
                "standard::name,standard::type", Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT, this._fileCancellable
            ]);
        } catch (error) {
            if (ioError(error, Gio.IOErrorEnum.NOT_FOUND))
                return [];
            throw error;
        }
        const names = [];
        try {
            while (true) {
                const batch = await fileOperation(enumerator, "next_files_async", "next_files_finish", [
                    64, GLib.PRIORITY_DEFAULT, this._fileCancellable
                ]);
                if (batch.length === 0)
                    break;
                for (const info of batch) {
                    const filename = info.get_name();
                    if (info.get_file_type() === Gio.FileType.REGULAR && filename.endsWith(".json") &&
                        filename.slice(0, -5) !== this._temporaryPresetName)
                        names.push(filename.slice(0, -5));
                }
            }
        } finally {
            await fileOperation(enumerator, "close_async", "close_finish", [GLib.PRIORITY_DEFAULT, null]);
        }
        return names.sort((a, b) => a.localeCompare(b));
    }

    async _populateMenu() {
        if (this._removed)
            return;
        const revision = ++this._menuRevision;
        this.menu.removeAll();
        this._presetItems = [];
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Easy Effects", {reactive: false}));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        try {
            const names = await this._readPresets();
            if (this._removed || revision !== this._menuRevision)
                return;
            this._syncDefaultOptions(names);
            this._monitorPresetDirectory();
            const ordered = names.filter(name => name !== this._defaultPreset);
            if (names.includes(this._defaultPreset))
                ordered.push(this._defaultPreset);
            if (names.length === 0) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
                    _("No output presets saved"), {reactive: false}
                ));
            }
            ordered.forEach(name => {
                const item = new PopupMenu.PopupMenuItem(name);
                item.setSensitive(!this._loading);
                item.connect("activate", () => this._loadPreset(name));
                this._presetItems.push({name, item});
                this.menu.addMenuItem(item);
            });
        } catch (error) {
            if (this._removed || revision !== this._menuRevision)
                return;
            global.logError(error, UUID);
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
                _("Presets could not be read"), {reactive: false}
            ));
        }
        this._updateSelection();
    }

    _cancelStateUpdate() {
        if (this._stateTimeout) {
            Mainloop.source_remove(this._stateTimeout);
            this._stateTimeout = 0;
        }
    }

    _queueStateUpdate() {
        if (this._removed)
            return;
        // Manual slider movement is sampled at most once per window, so the
        // indicator updates even while dragging. Loads wait for a quiet window.
        if (this._stateTimeout && !this._externalLoadPending && !this._loading)
            return;
        this._cancelStateUpdate();
        this._stateTimeout = Mainloop.timeout_add(STATE_UPDATE_DELAY, () => {
            this._stateTimeout = 0;
            this._externalLoadPending = false;
            this._updateSelection();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onLoadedPresetChanged() {
        if (this._removed)
            return;
        if (!this._defaultPreset) {
            this._updateSelection();
            return;
        }
        // EasyEffects writes this key before applying the pipeline and its values.
        // Treat the following coalesced changes as loading, not manual editing.
        this._selectionDirty = false;
        this._saveSelectionTracker();
        this._externalLoadPending = true;
        this._queueStateUpdate();
    }

    _onEffectStateChanged() {
        if (this._removed)
            return;
        if (!this._loading && !this._externalLoadPending && !this._selectionDirty) {
            this._selectionDirty = true;
            this._saveSelectionTracker();
        }
        this._queueStateUpdate();
    }

    _restoreSelectionTracker() {
        if (!this._defaultPreset || !this._appletSettings || !this._appletSettings.isReady)
            return;
        try {
            const saved = JSON.parse(this._appletSettings.getValue(SELECTION_TRACKER_KEY) || "null");
            if (saved && saved.name === this._currentPresetName() && typeof saved.dirty === "boolean")
                this._selectionDirty = saved.dirty;
        } catch (error) {
            // A damaged historical marker must not affect preset selection.
            this._selectionDirty = true;
        }
    }

    _saveSelectionTracker() {
        if (this._removed || this._loading || !this._defaultPreset ||
            !this._appletSettings || !this._appletSettings.isReady)
            return;
        try {
            const value = JSON.stringify({name: this._currentPresetName(), dirty: this._selectionDirty});
            if (this._appletSettings.getValue(SELECTION_TRACKER_KEY) !== value)
                this._appletSettings.setValue(SELECTION_TRACKER_KEY, value);
        } catch (error) {
            global.logError(error, UUID);
        }
    }

    _invalidateReference() {
        this._referenceRevision++;
        this._referenceDirty = true;
        this._referencePreset = null;
        this._referenceReadError = "";
    }

    _ensureStateReader() {
        if (this._stateReader)
            return Promise.resolve(this._stateReader);
        if (this._readerPromise)
            return this._readerPromise;
        const operation = (async () => {
            if (!this._parameterMap) {
                const file = Gio.File.new_for_path(GLib.build_filenamev([this._appletPath, "preset-map.json"]));
                const [ok, contents] = await fileOperation(file, "load_contents_async", "load_contents_finish", [
                    this._fileCancellable
                ]);
                if (!ok)
                    throw new Error(_("The effect parameter map could not be read."));
                this._parameterMap = JSON.parse(ByteArray.toString(contents));
            }
            if (this._removed || !this._defaultPreset)
                return null;
            this._stateReader = new PresetStateReader(this._parameterMap, () => this._onEffectStateChanged());
            return this._stateReader;
        })();
        this._readerPromise = operation;
        const clear = () => {
            if (this._readerPromise === operation)
                this._readerPromise = null;
        };
        operation.then(clear, clear);
        return operation;
    }

    async _readReferencePreset() {
        if (!this._referenceDirty)
            return this._referencePreset;
        const revision = this._referenceRevision;
        let request = this._referenceRequest;
        if (!request || request.revision !== revision) {
            const name = this._defaultPreset;
            request = {revision, promise: null};
            request.promise = (async () => {
                let preset = null;
                let readError = "";
                try {
                    const file = Gio.File.new_for_path(GLib.build_filenamev([
                        this._outputDirectory, name + ".json"
                    ]));
                    const [ok, contents] = await fileOperation(file, "load_contents_async", "load_contents_finish", [
                        this._fileCancellable
                    ]);
                    if (!ok)
                        throw new Error(_("The default preset could not be read."));
                    preset = JSON.parse(ByteArray.toString(contents));
                } catch (error) {
                    readError = _("The default preset cannot be read: %s").format(error.message);
                }
                if (!this._removed && revision === this._referenceRevision && name === this._defaultPreset) {
                    this._referencePreset = preset;
                    this._referenceReadError = readError;
                    this._referenceDirty = false;
                }
            })();
            this._referenceRequest = request;
        }
        await request.promise;
        return revision === this._referenceRevision ? this._referencePreset : null;
    }

    _currentPresetName() {
        let name = this._settings ? this._settings.get_string(OUTPUT_PRESET_KEY) : "";
        if (this._temporaryPresetName && name === this._temporaryPresetName)
            name = this._requestedPresetName;
        return name;
    }

    async _updateSelection() {
        if (this._removed)
            return;
        const revision = ++this._stateUpdateRevision;
        if (this._loading) {
            this.set_applet_tooltip(_("EasyEffects: loading preset…"));
            return;
        }
        const name = this._currentPresetName();
        const defaultName = this._defaultPreset;
        let markerName = name;
        let deviates = false;
        let bypass = false;
        let comparisonError = "";
        if (this._settings && defaultName) {
            deviates = true;
            markerName = "";
            bypass = this._settings.get_boolean("bypass");
            try {
                const reader = await this._ensureStateReader();
                if (this._removed || revision !== this._stateUpdateRevision || !reader)
                    return;
                try {
                    reader.refresh();
                } catch (error) {
                    reader.needsRefresh = true;
                    throw error;
                }
                // Do not even read the reference file for another name or bypass.
                if (name === defaultName && !bypass) {
                    const reference = await this._readReferencePreset();
                    if (this._removed || revision !== this._stateUpdateRevision || this._referenceDirty)
                        return;
                    if (!reference)
                        throw new Error(this._referenceReadError);
                    reader.refresh();
                    deviates = !reader.matches(reference);
                }
                if (!deviates)
                    markerName = defaultName;
                else if (name !== defaultName && !bypass && !this._selectionDirty)
                    markerName = name;
            } catch (error) {
                comparisonError = error.message;
            }
        }
        // A later menu/default change, load or removal supersedes an earlier read.
        if (this._removed || revision !== this._stateUpdateRevision || this._loading ||
            defaultName !== this._defaultPreset || name !== this._currentPresetName() ||
            (this._settings && defaultName && bypass !== this._settings.get_boolean("bypass")))
            return;
        this._comparisonError = comparisonError;
        this._presetItems.forEach(entry => entry.item.setShowDot(entry.name === markerName));
        this._deviationDot.visible = deviates;
        const lines = [name
            ? _("EasyEffects output preset: %s").format(name)
            : _("EasyEffects output preset")];
        if (this._defaultPreset)
            lines.push(_("Default preset: %s").format(this._defaultPreset));
        if (this._defaultPreset && this._selectionDirty && markerName !== this._defaultPreset)
            lines.push(_("Effect settings changed"));
        if (this._defaultPreset && bypass)
            lines.push(_("Global bypass enabled"));
        if (this._comparisonError)
            lines.push(_("Comparison unavailable: %s").format(this._comparisonError));
        this.set_applet_tooltip(lines.join("\n"));
    }

    _runCommand(argv, callback) {
        try {
            // argv avoids shell interpretation of preset names, including quotes and spaces.
            const process = Gio.Subprocess.new(argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            process.communicate_utf8_async(null, null, (proc, result) => {
                let output;
                try {
                    const [ok, stdout, stderr] = proc.communicate_utf8_finish(result);
                    if (!ok || !proc.get_successful())
                        throw new Error(stderr || _("The EasyEffects command failed."));
                    output = stdout || "";
                } catch (error) {
                    callback(error, "");
                    return;
                }
                callback(null, output);
            });
        } catch (error) {
            callback(error, "");
        }
    }

    async _loadPreset(name) {
        if (this._loading || this._removed)
            return;
        this._loading = true;
        this._requestedPresetName = name;
        this._presetItems.forEach(entry => entry.item.setSensitive(false));
        this._updateSelection();

        let commandName = name;
        let temporaryFile = null;
        const finish = async error => {
            if (temporaryFile) {
                try {
                    // Cleanup must finish even if removing the applet cancelled its I/O.
                    await fileOperation(temporaryFile, "delete_async", "delete_finish", [GLib.PRIORITY_DEFAULT, null]);
                } catch (cleanupError) {
                    if (!ioError(cleanupError, Gio.IOErrorEnum.NOT_FOUND))
                        global.logError(cleanupError, UUID);
                }
            }
            this._temporaryPresetName = null;
            this._requestedPresetName = null;
            this._loading = false;
            this._cancelStateUpdate();
            this._externalLoadPending = false;
            this._selectionDirty = Boolean(error);
            this._saveSelectionTracker();
            if (!this._removed) {
                this._presetItems.forEach(entry => entry.item.setSensitive(true));
                this._updateSelection();
                if (error) {
                    global.logError(error, UUID);
                    Main.notify("EasyEffects", _("Preset “%s” could not be loaded.\n%s").format(name, error.message));
                }
            }
        };

        try {
            const presetFile = Gio.File.new_for_path(GLib.build_filenamev([
                this._outputDirectory, name + ".json"
            ]));
            if (!await fileInfo(presetFile, this._fileCancellable))
                throw new Error(_("The preset file was moved or deleted."));

            const inputFile = Gio.File.new_for_path(GLib.build_filenamev([
                GLib.get_user_config_dir(), "easyeffects", "input", name + ".json"
            ]));
            // 7.2.3's -l tries input first. A unique temporary output alias ensures
            // an identically named microphone preset cannot intercept the request.
            if (await fileInfo(inputFile, this._fileCancellable)) {
                if (!this._settings)
                    throw new Error(_("The EasyEffects settings schema was not found."));
                commandName = "__ee_panel_" + GLib.uuid_string_random();
                const aliasFile = Gio.File.new_for_path(GLib.build_filenamev([
                    this._outputDirectory, commandName + ".json"
                ]));
                temporaryFile = aliasFile;
                this._temporaryPresetName = commandName;
                try {
                    await fileOperation(presetFile, "copy_async", "copy_finish", [
                        aliasFile, Gio.FileCopyFlags.NONE, GLib.PRIORITY_DEFAULT, this._fileCancellable, null
                    ]);
                } catch (error) {
                    if (ioError(error, Gio.IOErrorEnum.EXISTS))
                        temporaryFile = null;
                    throw error;
                }
            }
            if (this._removed) {
                await finish(null);
                return;
            }
            const run = argv => new Promise((resolve, reject) => {
                this._runCommand(argv, (error, output) => error ? reject(error) : resolve(output));
            });
            await run(["easyeffects", "--load-preset=" + commandName]);
            // 7.2.3 can return success even for a malformed preset. Query a fresh
            // process to verify output selection without relying on cached settings.
            const output = await run(["easyeffects", "--active-preset=output"]);
            if (output.replace(/\r?\n$/, "") !== commandName)
                throw new Error(_("EasyEffects did not load the output preset. Please check the preset file."));
            if (temporaryFile) {
                if (!this._settings.set_string(OUTPUT_PRESET_KEY, name))
                    throw new Error(_("The original preset name could not be restored."));
                Gio.Settings.sync();
            }
            await finish(null);
        } catch (error) {
            await finish(error);
        }
    }

    on_applet_removed_from_panel() {
        this._removed = true;
        this._fileCancellable.cancel();
        this._stateUpdateRevision++;
        this._menuRevision++;
        this._defaultOptionsRevision++;
        this._nativeOptionsRevision++;
        this._autostartMonitorRevision++;
        this._autostartRevision++;
        this._invalidateReference();
        this._cancelStateUpdate();
        if (this._stateReader) {
            this._stateReader.destroy();
            this._stateReader = null;
        }
        if (this._settingsSignal) {
            this._settings.disconnect(this._settingsSignal);
            this._settingsSignal = 0;
        }
        if (this._shutdownSettingsSignal) {
            this._settings.disconnect(this._shutdownSettingsSignal);
            this._shutdownSettingsSignal = 0;
        }
        if (this._bypassSettingsSignal) {
            this._settings.disconnect(this._bypassSettingsSignal);
            this._bypassSettingsSignal = 0;
        }
        this._clearAutostartMonitor();
        if (this._presetMonitor) {
            if (this._presetMonitorSignal)
                this._presetMonitor.disconnect(this._presetMonitorSignal);
            this._presetMonitor.cancel();
            this._presetMonitor = null;
        }
        if (this._appletSettings && this._appletSettings.isReady)
            this._appletSettings.finalize();
        this.menu.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new EasyEffectsPresetSelector(metadata, orientation, panelHeight, instanceId);
}
