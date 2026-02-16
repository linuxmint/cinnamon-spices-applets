const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

let UUID = "fade-monitors@hisovereign";

const HOME = GLib.get_home_dir();
const MOUSE_TOGGLE_FILE = HOME + "/.fade_mouse_enabled";
const IDLE_TOGGLE_FILE = HOME + "/.idle_dim_enabled";
const STOP_FILE = HOME + "/.fade_mouse_stopped";
const SCRIPT_NAME = "fade-monitors-enhanced-dimming.sh";
const SCRIPT_PATH = HOME + "/.local/bin/" + SCRIPT_NAME;
const GITHUB_URL = "https://github.com/hisovereign/Fade-Monitors";

class FadeMonitorsApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.set_applet_icon_symbolic_name("video-display-symbolic");
        this.set_applet_tooltip("Enhanced Fade Monitors");

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this._mouseDimmingEnabled = this._isMouseDimmingEnabled();
        this._idleDimmingEnabled = this._isIdleDimmingEnabled();

        this._buildMenu();
    }

    /* ---------------- Cinnamon lifecycle ---------------- */

    on_applet_added_to_panel() {
        this._startScript();
    }

    on_applet_removed_from_panel() {
        this._stopScript();
    }

    on_applet_clicked() {
        this._mouseDimmingEnabled = this._isMouseDimmingEnabled();
        this._idleDimmingEnabled = this._isIdleDimmingEnabled();
        this._refreshMenuLabels();
        this.menu.toggle();
    }

    /* ---------------- Menu ---------------- */

    _buildMenu() {
        // Mouse dimming toggle
        this.mouseToggleItem = new PopupMenu.PopupMenuItem("");
        this.menu.addMenuItem(this.mouseToggleItem);
        this.mouseToggleItem.connect("activate", () => {
            this._toggleMouseDimming();
        });

        // Idle dimming toggle
        this.idleToggleItem = new PopupMenu.PopupMenuItem("");
        this.menu.addMenuItem(this.idleToggleItem);
        this.idleToggleItem.connect("activate", () => {
            this._toggleIdleDimming();
        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Script control section
        let startItem = new PopupMenu.PopupMenuItem("Start Script");
        startItem.connect("activate", () => {
            this._startScript();
        });
        this.menu.addMenuItem(startItem);

        let stopItem = new PopupMenu.PopupMenuItem("Stop Script");
        stopItem.connect("activate", () => {
            this._stopScript();
        });
        this.menu.addMenuItem(stopItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Configuration section
        let settingsItem = new PopupMenu.PopupMenuItem("Open Script");
        settingsItem.connect("activate", () => {
            this._openScriptFile();
        });
        this.menu.addMenuItem(settingsItem);

        this._refreshMenuLabels();
    }

    _refreshMenuLabels() {
        this.mouseToggleItem.label.text = 
            this._mouseDimmingEnabled ? 
            "Mouse Dimming: On" : 
            "Mouse Dimming: off";
        
        this.idleToggleItem.label.text = 
            this._idleDimmingEnabled ? 
            "Idle Dimming: On" : 
            "Idle Dimming: off";
    }

    /* ---------------- File Operations ---------------- */

    _openScriptFile() {
        try {
            if (!GLib.file_test(SCRIPT_PATH, GLib.FileTest.EXISTS)) {
                this._showMissingScriptMessage();
                return;
            }

            let file = Gio.File.new_for_path(SCRIPT_PATH);
            let launcher = Gio.AppInfo.create_from_commandline(
                "xdg-open",
                "xdg-open",
                Gio.AppInfoCreateFlags.NONE
            );
            launcher.launch([file], null);
        } catch (e) {
            this._showError("Failed to open script: " + e.message);
        }
    }

    _openConfigFolder() {
        try {
            let configDir = HOME + "/.local/bin/";
            let file = Gio.File.new_for_path(configDir);
            let launcher = Gio.AppInfo.create_from_commandline(
                "xdg-open",
                "xdg-open",
                Gio.AppInfoCreateFlags.NONE
            );
            launcher.launch([file], null);
        } catch (e) {
            this._showError("Failed to open config folder: " + e.message);
        }
    }

    _showMissingScriptMessage() {
        let message = "Missing Enhanced Fade Monitors script\n\n" +
                      "Get it from:\n" + GITHUB_URL;
        
        let Main = imports.ui.main;
        Main.notify("Script Not Found", message);
        
        // Copy URL to clipboard
        try {
            let St = imports.gi.St;
            let Clipboard = St.Clipboard.get_default();
            Clipboard.set_text(St.ClipboardType.CLIPBOARD, GITHUB_URL);
        } catch (e) {
            // Ignore clipboard errors
        }
    }

    _showError(message) {
        let Main = imports.ui.main;
        Main.notifyError("Fade Monitors Error", message);
    }

    /* ---------------- Toggle logic ---------------- */

    _isMouseDimmingEnabled() {
        return GLib.file_test(MOUSE_TOGGLE_FILE, GLib.FileTest.EXISTS);
    }

    _isIdleDimmingEnabled() {
        // Note: In our script, idle dimming is ON when file DOESN'T exist
        // (inverted logic: file exists = idle dimming OFF)
        return !GLib.file_test(IDLE_TOGGLE_FILE, GLib.FileTest.EXISTS);
    }

    _toggleMouseDimming() {
        try {
            if (this._mouseDimmingEnabled) {
                GLib.unlink(MOUSE_TOGGLE_FILE);
            } else {
                GLib.file_set_contents(MOUSE_TOGGLE_FILE, "");
            }
            this._mouseDimmingEnabled = !this._mouseDimmingEnabled;
            this._refreshMenuLabels();
        } catch (e) {
            this._showError("Failed to toggle mouse dimming: " + e.message);
        }
    }

    _toggleIdleDimming() {
        try {
            if (this._idleDimmingEnabled) {
                // Enable idle dimming = remove the file
                GLib.file_set_contents(IDLE_TOGGLE_FILE, "");
            } else {
                // Disable idle dimming = create the file
                GLib.unlink(IDLE_TOGGLE_FILE);
            }
            this._idleDimmingEnabled = !this._idleDimmingEnabled;
            this._refreshMenuLabels();
        } catch (e) {
            this._showError("Failed to toggle idle dimming: " + e.message);
        }
    }

    /* ---------------- Script control ---------------- */

    _startScript() {
        // Remove stop gate
        try { 
            GLib.unlink(STOP_FILE); 
        } catch (e) {}

        // Check if script exists before starting
        if (!GLib.file_test(SCRIPT_PATH, GLib.FileTest.EXISTS)) {
            this._showMissingScriptMessage();
            return;
        }

        try {
            GLib.spawn_async(
                HOME,
                ["bash", SCRIPT_PATH],
                null,
                GLib.SpawnFlags.SEARCH_PATH | 
                GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null
            );
        } catch (e) {
            this._showError("Failed to start script: " + e.message);
        }
    }

    _stopScript() {
        // Create stop gate
        try {
            GLib.file_set_contents(STOP_FILE, "");
        } catch (e) {
            // Continue anyway
        }

        // Kill any running instance by exact name match
        try {
            GLib.spawn_async(
                null,
                ["pkill", "-f", SCRIPT_NAME + "$"],
                null,
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );
        } catch (e) {
            // Ignore pkill errors (no process to kill is fine)
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new FadeMonitorsApplet(
        metadata, 
        orientation, 
        panelHeight, 
        instanceId
    );
}
