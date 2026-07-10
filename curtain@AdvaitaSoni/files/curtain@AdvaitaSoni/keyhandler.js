const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const { MAP, setEventMgr, destroyEventMgr } = require("./keyMap")
const { EVENT_GAP, UUID } = require("./constants") //Constants

class KeyHandler {
    keyMap; //has keys to event mapping
    settingsMap;
    constructor() {
        setEventMgr()
        this.keyMap = MAP;
        this.settingsMap = {};
        for (const [key, _] of Object.entries(MAP)) {
            this.settingsMap[key] = null;
        }
        let settings = new Settings.AppletSettings(this.settingsMap, UUID);
        for (const [key, _] of Object.entries(this.settingsMap)) {
            settings.bindProperty(Settings.BindingDirection.IN, key, key, () => this.updateKeybinding(key), null);
        }
        this.updateAllKeyBindings();
    }
    updateKeybinding(key) {
        if (this.keyMap[key] && this.settingsMap[key].length > 0 && this.keyMap[key].kind == "binding") {
            try {
                this.destroyKey(key)
            } catch (e) {
                global.log('no prior key')
            }
            Main.keybindingManager.addHotKey(
                this.keyMap[key].id,
                this.settingsMap[key],
                () => {
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, EVENT_GAP, () => {
                        this.keyMap[key].event();
                        return GLib.SOURCE_REMOVE;
                    });
                },
            );
        }
    }

    updateAllKeyBindings() {
        for (const [key, _] of Object.entries(this.settingsMap)) {
            this.updateKeybinding(key);
        }
    }

    //todo: remove all debug from repos for main branch

    destroyKey(key) {
        if (!this.keyMap[key]) { return }
        Main.keybindingManager.removeHotKey(this.keyMap[key].id);
    }
    destroy() {
        for (const [key, _] of Object.entries(this.keyMap)) {
            this.destroyKey(key);
        }
        destroyEventMgr()
        this.keyMap = null
        this.settingsMap = null
    }
}