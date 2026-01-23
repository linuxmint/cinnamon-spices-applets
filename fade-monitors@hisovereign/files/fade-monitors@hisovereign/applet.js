const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

let UUID = "fade-monitors@hisovereign";

const HOME = GLib.get_home_dir();
const TOGGLE_FILE = HOME + "/.fade_mouse_enabled";
const STOP_FILE = HOME + "/.fade_mouse_stopped";
const SCRIPT_NAME = "fade-monitors-2d-time-based.sh";
const SCRIPT_PATH = HOME + "/.local/bin/" + SCRIPT_NAME;
const GITHUB_URL = "https://github.com/hisovereign/Fade-Monitors";

class FadeMonitorsApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.set_applet_icon_symbolic_name("video-display-symbolic");
        this.set_applet_tooltip("Fade Monitors");

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this._dimmingEnabled = this._isDimmingEnabled();

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
        this._dimmingEnabled = this._isDimmingEnabled();
        this._refreshToggleLabel();
        this.menu.toggle();
    }

    /* ---------------- Menu ---------------- */

    _buildMenu() {
        this.toggleItem = new PopupMenu.PopupMenuItem("");
        this.menu.addMenuItem(this.toggleItem);

        this.toggleItem.connect("activate", () => {
            this._toggleDimming();
        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

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

        let settingsItem = new PopupMenu.PopupMenuItem("Open Script");
        settingsItem.connect("activate", () => {
            this._openScriptFile();
        });
        this.menu.addMenuItem(settingsItem);

        this._refreshToggleLabel();
    }

    _refreshToggleLabel() {
        this.toggleItem.label.text =
            this._dimmingEnabled ? "Dimming: On" : "Dimming: off";
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

    _showMissingScriptMessage() {
        let message = "Missing Fade Monitors time-based script\n\n" +
                      "Get it from:\n" + GITHUB_URL;
        
        let Main = imports.ui.main;
        Main.notify("Script Not Found", message);
        
        // Optional: Copy URL to clipboard
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

    _isDimmingEnabled() {
        return GLib.file_test(TOGGLE_FILE, GLib.FileTest.EXISTS);
    }

    _toggleDimming() {
        try {
            if (this._dimmingEnabled) {
                GLib.unlink(TOGGLE_FILE);
            } else {
                GLib.file_set_contents(TOGGLE_FILE, "");
            }
            this._dimmingEnabled = !this._dimmingEnabled;
            this._refreshToggleLabel();
        } catch (e) {
            this._showError("Failed to toggle dimming: " + e.message);
        }
    }

    /* ---------------- Script control ---------------- */

    _startScript() {
        // Remove stop gate
        try { GLib.unlink(STOP_FILE); } catch (e) {}

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
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
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
                ["pkill", "-f", SCRIPT_NAME + "$"],  // $ ensures exact match
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
    return new FadeMonitorsApplet(metadata, orientation, panelHeight, instanceId);
}
