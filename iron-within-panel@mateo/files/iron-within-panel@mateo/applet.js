/* Panel icon. Click toggles the grade, same gesture as Desaturate All.
 * The shaders and the muffin key live in gradeEngine.js.
 */

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Logic = require("./gradeLogic").GradeLogic;
const Engine = require("./gradeEngine");

const UUID = "iron-within-panel@mateo";
const HOTKEY_NAME = "cinematic-grade-panel-toggle";

function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this._engine = null;
        this._settingsReady = false;
        this._removed = false;
        this._readyAction = null;
        this._iconEpoch = 0;
        this._applyIcon(false);
        this.set_applet_tooltip("Cinematic grade: off. Click to turn the grade on.");

        Logic.resolveProjectRoot(metadata.path, (root) => this._startEngine(root));
    },

    _startEngine: function(root) {
        if (this._removed)
            return;
        this._engine = Engine.getEngine(root);
        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("preset", "preset", this._onSettingsChanged);
        this.settings.bind("intensity", "intensity", this._onSettingsChanged);
        this.settings.bind("keybinding", "keybinding", this._onKeybindingChanged);
        this.settings.bind("composite-fullscreen", "composite_fullscreen", this._onSettingsChanged);
        this._settingsReady = true;

        this._engine.register("applet", "applet", (state) => this._onEngineState(state));
        this._engine.configure("applet", this._config());
        this._onKeybindingChanged();
        if (this._readyAction === "toggle")
            this._engine.toggle("applet");
        else if (this._readyAction === true || this._readyAction === false)
            this._engine.setActive("applet", this._readyAction);
        this._readyAction = null;
    },

    on_applet_clicked: function() {
        this.toggle();
    },

    toggle: function() {
        if (!this._engine) {
            this._readyAction = "toggle";
            return;
        }
        this._engine.toggle("applet");
    },

    setActive: function(active) {
        if (!this._engine) {
            this._readyAction = !!active;
            return;
        }
        this._engine.setActive("applet", !!active);
    },

    status: function() {
        if (!this._engine || !this._settingsReady) {
            return {
                active: false,
                preset: "iron_within",
                intensity: 1,
                session: "x11",
                desktop: "cinnamon",
                effects: 0,
                shaders: false,
                root: null,
                owner: null,
                error: null,
                passes: 0,
                workingSpace: Logic.WORKING_SPACE,
                kind: "applet",
                shortcut: ""
            };
        }
        let state = this._engine.status();
        state.kind = "applet";
        state.shortcut = this.settings.getValue("keybinding") || "";
        return state;
    },

    on_applet_removed_from_panel: function() {
        this._removed = true;
        Main.keybindingManager.removeHotKey(HOTKEY_NAME);
        if (this._engine)
            this._engine.unregister("applet");
        if (this.settings)
            this.settings.finalize();
    },

    _config: function() {
        return {
            preset: this.settings.getValue("preset"),
            intensity: this.settings.getValue("intensity"),
            compositeFullscreen: this.settings.getValue("composite-fullscreen")
        };
    },

    _onSettingsChanged: function() {
        if (!this._engine.isOwner("applet"))
            return;
        this._engine.configure("applet", this._config());
    },

    _onKeybindingChanged: function() {
        Main.keybindingManager.removeHotKey(HOTKEY_NAME);
        if (!this._engine.isOwner("applet"))
            return;
        let key = this.settings.getValue("keybinding") || "";
        if (!key)
            return;
        let ok = Main.keybindingManager.addHotKey(HOTKEY_NAME, key, () => this._engine.toggle("applet"));
        if (!ok)
            global.logError("[" + UUID + "] could not bind " + key);
    },

    _onEngineState: function(state) {
        if (state.active) {
            let text = "Cinematic grade: on (" + state.preset + "). Click to turn the grade off.";
            if (state.error)
                text += " " + state.error;
            this.set_applet_tooltip(text);
            this._applyIcon(true);
        } else if (state.error) {
            this.set_applet_tooltip("Cinematic grade: off. " + state.error);
            this._applyIcon(false);
        } else {
            this.set_applet_tooltip("Cinematic grade: off. Click to turn the grade on.");
            this._applyIcon(false);
        }
    },

    _applyIcon: function(active) {
        this._iconEpoch += 1;
        let epoch = this._iconEpoch;
        this._setIconColor(active ? "#3da9a0" : null);
        let names = active ? ["icon-active.png", "icon.png"] : ["icon.png"];
        this._tryIcon(names, 0, epoch);
    },

    _tryIcon: function(names, index, epoch) {
        if (epoch !== this._iconEpoch)
            return;
        if (index >= names.length) {
            this.set_applet_icon_symbolic_name("applications-graphics-symbolic");
            return;
        }
        let path = GLib.build_filenamev([this.metadata.path, names[index]]);
        Gio.File.new_for_path(path).query_info_async(
            "standard::type",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (obj, res) => {
                if (epoch !== this._iconEpoch)
                    return;
                try {
                    obj.query_info_finish(res);
                } catch (e) {
                    this._tryIcon(names, index + 1, epoch);
                    return;
                }
                this.set_applet_icon_path(path);
            }
        );
    },

    _setIconColor: function(color) {
        if (!this._applet_icon)
            return;
        this._applet_icon.style = color ? ("color: " + color + ";") : "";
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
