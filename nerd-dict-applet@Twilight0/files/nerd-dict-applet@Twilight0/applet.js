const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const UUID = "nerd-dict-applet@Twilight0";
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const interfaceXml = `
<node>
  <interface name="org.nerddict.daemon">
    <method name="begin"/>
    <method name="end"/>
    <method name="exit"/>
    <method name="suspend"/>
    <method name="resume"/>
    <method name="toggle"/>
  </interface>
</node>`;

class NerdDBusService {
    constructor(applet) {
        this._applet = applet;
    }

    begin() {
        this._applet.startDictation();
    }

    end() {
        this._applet.stopDictation();
    }

    exit() {
        this._applet.stopDictation();
    }

    suspend() {
        this._applet.suspendDictation();
    }

    resume() {
        this._applet.resumeDictation();
    }

    toggle() {
        this._applet.toggleDictation();
    }
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this._state = "IDLE";
            this._process = null;
            this._customMenuItems = [];
            this._installed = (GLib.find_program_in_path("nerd-dictation") !== null);

            // Read preferences
            this._directClick = true;
            this._modelRoot = GLib.get_user_config_dir() + "/nerd-dictation/model";
            this._model = "vosk-model-small-en-us-0.15";
            this._sampleRate = "44100";
            this._timeout = "0";
            this._idleTime = "100";
            this._punctuate = "0";
            this._fullSentence = false;
            this._digits = false;
            this._useSeparator = false;
            this._tool = "";
            this._keyboard = "";
            this._deviceName = "default";
            this._precommand = "";
            this._postcommand = "";
            this._freeCommand = "";
            this._env = "";

            // Bind settings
            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);
            this.settings.bind("directClick", "_directClick", this.settings_changed);
            this.settings.bind("modelRoot", "_modelRoot", this.settings_changed);
            this.settings.bind("model", "_model", this.settings_changed);
            this.settings.bind("sampleRate", "_sampleRate", this.settings_changed);
            this.settings.bind("timeout", "_timeout", this.settings_changed);
            this.settings.bind("idleTime", "_idleTime", this.settings_changed);
            this.settings.bind("punctuate", "_punctuate", this.settings_changed);
            this.settings.bind("fullSentence", "_fullSentence", this.settings_changed);
            this.settings.bind("digits", "_digits", this.settings_changed);
            this.settings.bind("useSeparator", "_useSeparator", this.settings_changed);
            this.settings.bind("tool", "_tool", this.settings_changed);
            this.settings.bind("keyboard", "_keyboard", this.settings_changed);
            this.settings.bind("deviceName", "_deviceName", this.settings_changed);
            this.settings.bind("precommand", "_precommand", this.settings_changed);
            this.settings.bind("postcommand", "_postcommand", this.settings_changed);
            this.settings.bind("freeCommand", "_freeCommand", this.settings_changed);
            this.settings.bind("env", "_env", this.settings_changed);

            this._lastModelRoot = this._modelRoot;

            // Set up UI
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._updateSchemaOptions();
            this._updateUI();

            // Setup periodic check timer to sync external state changes
            this._periodicTimeout = Mainloop.timeout_add_seconds(2, () => this._periodicCheck());

            // Export DBus interface
            this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(interfaceXml, new NerdDBusService(this));
            this._dbusImpl.export(Gio.DBus.session, '/org/nerddict/daemon');

            this._dbusOwnerId = Gio.bus_own_name(
                Gio.BusType.SESSION,
                'org.nerddict.daemon',
                Gio.BusNameOwnerFlags.REPLACE | Gio.BusNameOwnerFlags.ALLOW_REPLACEMENT,
                null,
                (connection, name) => {
                    global.log("Nerd Dictation Applet D-Bus name acquired: " + name);
                },
                (connection, name) => {
                    global.log("Nerd Dictation Applet D-Bus name lost: " + name);
                }
            );

            // Connect context menu open event
            this._applet_context_menu.connect('open-state-changed', (menu, open) => {
                if (open) {
                    this._updateContextMenu();
                }
            });
        } catch (e) {
            global.logError(e);
        }
    },

    settings_changed: function () {
        if (this._modelRoot !== this._lastModelRoot) {
            this._lastModelRoot = this._modelRoot;
            this._updateSchemaOptions();
        }
        this._updateUI();
    },

    _updateUI: function () {
        let iconName = "audio-input-microphone-symbolic";
        let tooltip = _("Nerd Dictation: Idle");
        
        if (!this._installed) {
            iconName = "dialog-error-symbolic";
            tooltip = _("Error: nerd-dictation is not installed!");
            this.set_applet_label(_("Install nerd-dictation"));
            this.set_applet_icon_symbolic_name(iconName);
            this.set_applet_tooltip(tooltip);
            return;
        }
        
        switch (this._state) {
            case "STARTING":
            case "LOADING":
                iconName = "view-refresh-symbolic";
                tooltip = _("Nerd Dictation: Loading model...");
                this.set_applet_label(_("Loading..."));
                break;
            case "READY":
                iconName = "audio-input-microphone-symbolic";
                tooltip = _("Nerd Dictation: Ready");
                this.set_applet_label(_("Ready"));
                break;
            case "DICTATING":
                iconName = "microphone-sensitivity-high-symbolic";
                tooltip = _("Nerd Dictation: Dictating...");
                this.set_applet_label(_("Listening"));
                break;
            case "SUSPENDED":
                iconName = "microphone-sensitivity-muted-symbolic";
                tooltip = _("Nerd Dictation: Suspended (Paused)");
                this.set_applet_label(_("Paused"));
                break;
            case "FAILED":
                iconName = "dialog-error-symbolic";
                tooltip = _("Nerd Dictation: Failed to start");
                this.set_applet_label(_("Failed"));
                break;
            default:
                iconName = "audio-input-microphone-symbolic";
                tooltip = _("Nerd Dictation: Idle");
                this.set_applet_label(""); // Keep panel clean when idle
                break;
        }

        this.set_applet_icon_symbolic_name(iconName);
        this.set_applet_tooltip(tooltip);
    },

    _expandPath: function (path) {
        if (!path) return "";
        if (path.startsWith("file://")) {
            try {
                let file = Gio.File.new_for_uri(path);
                let localPath = file.get_path();
                if (localPath) return localPath;
            } catch (e) {
                global.logError("Error converting URI to path: " + e);
            }
        }
        if (path.startsWith('~') && path.charAt(1) === '/') {
            return GLib.get_home_dir() + path.substring(1);
        }
        return path;
    },

    _updateSchemaOptions: function () {
        let modelDir = this._expandPath(this._modelRoot);
        if (!modelDir) {
            this._proceedUpdateSchemaOptions([]);
            return;
        }
        let file = Gio.File.new_for_path(modelDir);
        
        file.enumerate_children_async(
            "standard::name,standard::type",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (folder, res) => {
                let models = [];
                try {
                    let enumerator = folder.enumerate_children_finish(res);
                    enumerator.next_files_async(100, GLib.PRIORITY_DEFAULT, null, (enum_obj, next_res) => {
                        try {
                            let files = enum_obj.next_files_finish(next_res);
                            if (files) {
                                for (let info of files) {
                                    if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                                        models.push(info.get_name());
                                    }
                                }
                            }
                            enum_obj.close_async(GLib.PRIORITY_DEFAULT, null, null);
                        } catch (err) {
                            // Ignore enum errors
                        }
                        this._proceedUpdateSchemaOptions(models.sort());
                    });
                } catch (e) {
                    // Directory probably doesn't exist, proceed with empty models list
                    this._proceedUpdateSchemaOptions([]);
                }
            }
        );
    },

    _proceedUpdateSchemaOptions: function (models) {
        this._installedModels = models;
        
        let optionsObj = {};
        if (models.length === 0) {
            optionsObj = { "": "" };
        } else {
            for (let m of models) {
                optionsObj[m] = m;
            }
        }

        let schemaPaths = [
            GLib.get_home_dir() + "/Projects/nerd-dict-applet@Twilight0/settings-schema.json",
            GLib.get_user_data_dir() + "/cinnamon/applets/" + UUID + "/settings-schema.json"
        ];

        let configDir = GLib.get_user_config_dir() + "/cinnamon/spices/" + UUID;
        let configFolder = Gio.File.new_for_path(configDir);
        
        configFolder.enumerate_children_async(
            "standard::name,standard::type",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (folder, res) => {
                let schemaPathsCopy = [...schemaPaths];
                try {
                    let enumerator = folder.enumerate_children_finish(res);
                    enumerator.next_files_async(100, GLib.PRIORITY_DEFAULT, null, (enum_obj, next_res) => {
                        try {
                            let files = enum_obj.next_files_finish(next_res);
                            if (files) {
                                for (let info of files) {
                                    if (info.get_file_type() === Gio.FileType.REGULAR && info.get_name().endsWith(".json")) {
                                        schemaPathsCopy.push(configDir + "/" + info.get_name());
                                    }
                                }
                            }
                            enum_obj.close_async(GLib.PRIORITY_DEFAULT, null, null);
                        } catch (err) {
                            // Ignore enum errors
                        }
                        for (let schemaPath of schemaPathsCopy) {
                            this._updateSingleSchema(schemaPath, optionsObj, models);
                        }
                    });
                } catch (e) {
                    for (let schemaPath of schemaPathsCopy) {
                        this._updateSingleSchema(schemaPath, optionsObj, models);
                    }
                }
            }
        );
    },

    _updateSingleSchema: function (schemaPath, optionsObj, models) {
        let file = Gio.File.new_for_path(schemaPath);
        file.load_contents_async(null, (f, res) => {
            try {
                let [success, contents, etag] = f.load_contents_finish(res);
                if (success && contents) {
                    let decoder = new TextDecoder("utf-8");
                    let schema = JSON.parse(decoder.decode(contents));
                    
                    schema.model.options = optionsObj;
                    
                    if (schema.model.value !== undefined) {
                        if (models.length === 0 || !models.includes(schema.model.value)) {
                            schema.model.value = "";
                            try {
                                this.settings.setValue("model", "");
                            } catch (err) {}
                        }
                    }
                    
                    let newContent = JSON.stringify(schema, null, 2);
                    let bytes = GLib.Bytes.new(newContent);
                    f.replace_contents_async(
                        bytes,
                        null,
                        false,
                        Gio.FileCreateFlags.REPLACE_DESTINATION,
                        null,
                        (final_file, replace_res) => {
                            try {
                                final_file.replace_contents_finish(replace_res);
                            } catch (err) {
                                global.logError("Failed to replace schema contents: " + err);
                            }
                        }
                    );
                }
            } catch (e) {
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                    global.logError("Failed to update schema path: " + e);
                }
            }
        });
    },

    _periodicCheck: function () {
        let cookiePath = "/tmp/nerd-dictation.cookie";
        let file = Gio.File.new_for_path(cookiePath);
        
        file.load_contents_async(null, (f, res) => {
            let pid = null;
            try {
                let [success, contents, etag] = f.load_contents_finish(res);
                if (success && contents) {
                    let decoder = new TextDecoder("utf-8");
                    let content = decoder.decode(contents);
                    pid = parseInt(content.trim());
                }
            } catch (e) {
                // Cookie file missing or unreadable
            }
            
            if (pid) {
                this._isProcessRunningAsync(pid, (isRunning) => {
                    this._updateStateAfterCheck(isRunning);
                });
            } else {
                this._updateStateAfterCheck(false);
            }
        });

        return true;
    },

    _isProcessRunningAsync: function (pid, callback) {
        let statPath = "/proc/" + pid + "/stat";
        let file = Gio.File.new_for_path(statPath);
        file.load_contents_async(null, (f, res) => {
            try {
                let [success, contents, etag] = f.load_contents_finish(res);
                if (success && contents) {
                    let decoder = new TextDecoder("utf-8");
                    let statStr = decoder.decode(contents);
                    let lastParen = statStr.lastIndexOf(")");
                    if (lastParen !== -1) {
                        let rest = statStr.substring(lastParen + 2).trim();
                        let state = rest.charAt(0);
                        if (state !== 'Z' && state !== 'X') {
                            callback(true);
                            return;
                        }
                    }
                }
            } catch (e) {
                // Ignore errors
            }
            callback(false);
        });
    },

    _updateStateAfterCheck: function (isRunning) {
        if (isRunning) {
            if (!this._process) {
                // External process is running, sync state as best as we can
                if (this._state === "IDLE" || this._state === "FAILED") {
                    this._state = "READY";
                    this._updateUI();
                }
            }
        } else {
            if (this._state !== "IDLE" && this._state !== "FAILED") {
                // Process stopped externally
                this._process = null;
                this._state = "IDLE";
                this._updateUI();
            }
        }
    },

    toggleDictation: function () {
        if (!this._installed) {
            Main.notify(_("Nerd Dictation Error"), _("nerd-dictation is not installed. Please install it to use this applet."));
            return;
        }
        if (this._state === "IDLE" || this._state === "FAILED") {
            this.startDictation();
        } else {
            this.toggleSuspend();
        }
    },

    startDictation: function () {
        if (!this._installed) {
            Main.notify(_("Nerd Dictation Error"), _("nerd-dictation is not installed. Please install it to use this applet."));
            return;
        }
        if (this._process) return;

        if (this._precommand) {
            try {
                Util.spawn(["bash", "-c", this._precommand]);
            } catch (e) {
                global.logError("Precommand failed: " + e);
            }
        }

        if (!this._model) {
            Main.notify(_("Nerd Dictation Error"), _("No Vosk model is selected. Please download a model and select it in settings."));
            this._state = "FAILED";
            this._updateUI();
            return;
        }
        let modelRootPath = this._expandPath(this._modelRoot);
        if (!modelRootPath) {
            Main.notify(_("Nerd Dictation Error"), _("Model root directory is not configured."));
            this._state = "FAILED";
            this._updateUI();
            return;
        }
        let modelPath = GLib.build_filenamev([modelRootPath, this._model]);
        let modelFile = Gio.File.new_for_path(modelPath);

        modelFile.query_info_async(
            "standard::type",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (fileObj, res) => {
                let exists = false;
                try {
                    fileObj.query_info_finish(res);
                    exists = true;
                } catch (e) {
                    // File doesn't exist
                }

                if (!exists) {
                    Main.notify(_("Nerd Dictation Error"), _("The selected Vosk model is not installed. Please download a model and configure it in settings."));
                    this._state = "FAILED";
                    this._updateUI();
                    return;
                }

                let cmd = ["nerd-dictation", "begin", "--cookie=/tmp/nerd-dictation.cookie"];
                cmd.push("--vosk-model-dir=" + modelPath);
                if (this._sampleRate && this._sampleRate !== "44100") {
                    cmd.push("--sample-rate=" + this._sampleRate);
                }
                if (this._timeout && this._timeout != "0") {
                    cmd.push("--timeout=" + this._timeout);
                }
                if (this._idleTime && this._idleTime != "100") {
                    cmd.push("--idle-time=" + (parseFloat(this._idleTime) / 1000).toString());
                }
                if (this._punctuate && this._punctuate != "0") {
                    cmd.push("--punctuate-from-previous-timeout=" + this._punctuate);
                }
                if (this._fullSentence) {
                    cmd.push("--full-sentence");
                }
                if (this._digits) {
                    cmd.push("--numbers-as-digits");
                }
                if (this._useSeparator) {
                    cmd.push("--numbers-use-separator");
                }
                if (this._deviceName && this._deviceName !== "default") {
                    cmd.push("--pulse-device-name=" + this._deviceName);
                }
                if (this._tool === "DOTOOL") {
                    cmd.push("--simulate-input-tool=DOTOOL");
                }
                if (this._freeCommand) {
                    let flags = this._freeCommand.split(/\s+/);
                    for (let flag of flags) {
                        if (flag) cmd.push(flag);
                    }
                }
                cmd.push("--output=SIMULATE_INPUT");
                cmd.push("--continuous");
                if (!cmd.some(arg => arg.startsWith("--verbose"))) {
                    cmd.push("--verbose=1");
                }

                try {
                    let launcher = new Gio.SubprocessLauncher({
                        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                    });
                    
                    if (this._tool === "DOTOOL" && this._keyboard) {
                        launcher.setenv("DOTOOL_XKB_LAYOUT", this._keyboard, true);
                    }
                    
                    if (this._env) {
                        let envVars = this._env.split(/\s+/);
                        for (let envVar of envVars) {
                            if (envVar && envVar.indexOf("=") !== -1) {
                                let [key, val] = envVar.split("=", 2);
                                launcher.setenv(key, val, true);
                            }
                        }
                    }

                    this._process = launcher.spawnv(cmd);
                    this._state = "STARTING";
                    this._updateUI();

                    let stderrStream = new Gio.DataInputStream({
                        base_stream: this._process.get_stderr_pipe(),
                        close_base_stream: true,
                    });
                    
                    this._readProcessOutput(stderrStream);
                    
                    this._process.wait_async(null, (proc, result) => {
                        try {
                            proc.wait_finish(result);
                        } catch (e) {
                            global.logError("Process wait error: " + e);
                        }
                        this._process = null;
                        this._state = "IDLE";
                        this._updateUI();
                        
                        if (this._postcommand) {
                            try {
                                Util.spawn(["bash", "-c", this._postcommand]);
                            } catch (e) {
                                global.logError("Postcommand failed: " + e);
                            }
                        }
                    });
                } catch (e) {
                    global.logError("Failed to start nerd-dictation: " + e);
                    this._state = "FAILED";
                    this._updateUI();
                }
            }
        );
    },

    stopDictation: function () {
        try {
            Util.spawn(["nerd-dictation", "end", "--cookie=/tmp/nerd-dictation.cookie"]);
        } catch (e) {
            global.logError("Failed to end dictation: " + e);
        }
    },

    suspendDictation: function () {
        try {
            Util.spawn(["nerd-dictation", "suspend", "--cookie=/tmp/nerd-dictation.cookie"]);
        } catch (e) {
            global.logError("Failed to suspend dictation: " + e);
        }
    },

    resumeDictation: function () {
        try {
            Util.spawn(["nerd-dictation", "resume", "--cookie=/tmp/nerd-dictation.cookie"]);
        } catch (e) {
            global.logError("Failed to resume dictation: " + e);
        }
    },

    toggleSuspend: function () {
        if (this._state === "SUSPENDED") {
            this.resumeDictation();
        } else if (this._state === "READY" || this._state === "DICTATING") {
            this.suspendDictation();
        }
    },

    _readProcessOutput: function (stream) {
        if (!this._process) return;
        
        stream.read_line_async(GLib.PRIORITY_LOW, null, (stream, result) => {
            try {
                let [line] = stream.read_line_finish_utf8(result);
                if (line !== null) {
                    this._handleProcessOutputLine(line);
                    this._readProcessOutput(stream);
                }
            } catch (e) {
                global.logWarning("Stream closed or error in _readProcessOutput: " + e);
            }
        });
    },

    _handleProcessOutputLine: function (line) {
        global.log("Nerd Dictation: " + line);
        let lower = line.toLowerCase();
        
        if (lower.indexOf("loading model") !== -1) {
            this._state = "LOADING";
        } else if (lower.indexOf("model loaded") !== -1 || lower.indexOf("listening") !== -1 || lower.indexOf("ready") !== -1) {
            this._state = "READY";
        } else if (lower.indexOf("dictation started") !== -1) {
            this._state = "DICTATING";
        } else if (lower.indexOf("dictation ended") !== -1 || lower.indexOf("dictation stopped") !== -1) {
            this._state = "IDLE";
        } else if (lower.indexOf("suspended") !== -1) {
            this._state = "SUSPENDED";
        } else if (lower.indexOf("recording") !== -1 || lower.indexOf("resumed") !== -1) {
            this._state = "DICTATING";
        }
        
        this._updateUI();
    },

    on_applet_clicked: function (event) {
        if (this._directClick) {
            this.toggleDictation();
        } else {
            this._buildMenu(this.menu);
            this.menu.toggle();
        }
    },

    _buildMenu: function (menu) {
        menu.removeAll();

        if (!this._installed) {
            let errorItem = new PopupMenu.PopupMenuItem(_("nerd-dictation is not installed!"), { reactive: false });
            menu.addMenuItem(errorItem);
            return;
        }

        let statusText = _("Status: ") + _(this._state);
        let statusItem = new PopupMenu.PopupMenuItem(statusText, { reactive: false });
        menu.addMenuItem(statusItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let toggleLabel = (this._state === "IDLE" || this._state === "FAILED") ? _("Start Dictation") : _("Stop Dictation");
        let toggleIcon = (this._state === "IDLE" || this._state === "FAILED") ? "media-record-symbolic" : "media-playback-stop-symbolic";
        let toggleItem = new PopupMenu.PopupIconMenuItem(toggleLabel, toggleIcon, St.IconType.SYMBOLIC);
        toggleItem.connect('activate', () => {
            if (this._state === "IDLE" || this._state === "FAILED") {
                this.startDictation();
            } else {
                this.stopDictation();
            }
        });
        menu.addMenuItem(toggleItem);

        let suspendLabel = (this._state === "SUSPENDED") ? _("Resume Dictation") : _("Pause Dictation");
        let suspendIcon = (this._state === "SUSPENDED") ? "media-playback-start-symbolic" : "media-playback-pause-symbolic";
        let suspendItem = new PopupMenu.PopupIconMenuItem(suspendLabel, suspendIcon, St.IconType.SYMBOLIC);
        suspendItem.connect('activate', () => this.toggleSuspend());
        
        if (this._state === "IDLE" || this._state === "FAILED" || this._state === "STARTING" || this._state === "LOADING") {
            suspendItem.setSensitive(false);
        }
        menu.addMenuItem(suspendItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let modelSubMenu = new PopupMenu.PopupSubMenuMenuItem(_("Select Model"));
        let models = this._installedModels || [];
        if (models.length === 0) {
            let emptyItem = new PopupMenu.PopupMenuItem(_("No models found in ") + this._expandPath(this._modelRoot), { reactive: false });
            modelSubMenu.menu.addMenuItem(emptyItem);
        } else {
            for (let m of models) {
                let isActive = (this._model === m);
                let label = (isActive ? "✓ " : "  ") + m;
                let item = new PopupMenu.PopupMenuItem(label);
                item.connect('activate', () => {
                    this.settings.setValue("model", m);
                    this._model = m;
                    this._buildMenu(menu);
                });
                modelSubMenu.menu.addMenuItem(item);
            }
        }
        menu.addMenuItem(modelSubMenu);
    },

    _updateContextMenu: function () {
        for (let item of this._customMenuItems) {
            item.destroy();
        }
        this._customMenuItems = [];

        let tempMenu = {
            addMenuItem: (item, pos) => {
                if (pos === undefined) {
                    pos = this._customMenuItems.length;
                }
                this._applet_context_menu.addMenuItem(item, pos);
                this._customMenuItems.push(item);
            },
            removeAll: () => {
                for (let item of this._customMenuItems) {
                    item.destroy();
                }
                this._customMenuItems = [];
            }
        };

        this._buildMenu(tempMenu);
    },

    on_applet_removed_from_panel: function () {
        if (this._periodicTimeout) {
            Mainloop.source_remove(this._periodicTimeout);
            this._periodicTimeout = null;
        }
        if (this._process) {
            this.stopDictation();
        }
        if (this._dbusOwnerId) {
            Gio.bus_unown_name(this._dbusOwnerId);
            this._dbusOwnerId = null;
        }
        if (this._dbusImpl) {
            this._dbusImpl.unexport();
            this._dbusImpl = null;
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
