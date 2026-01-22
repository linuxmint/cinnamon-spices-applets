const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;

let UUID = "fade-monitors@hisovereign";

const HOME = GLib.get_home_dir();
const TOGGLE_FILE = HOME + "/.fade_mouse_enabled";
const STOP_FILE   = HOME + "/.fade_mouse_stopped";
const SCRIPT_PATH = HOME + "/.local/bin/fade-monitors-2d-time-based.sh";

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

        let settingsItem = new PopupMenu.PopupMenuItem("Open Script");
        settingsItem.connect("activate", () => {
            GLib.spawn_command_line_async(`xdg-open "${SCRIPT_PATH}"`);
        });
        this.menu.addMenuItem(settingsItem);

        this._refreshToggleLabel();
    }

    /* ---------------- Toggle logic ---------------- */

    _isDimmingEnabled() {
        return GLib.file_test(TOGGLE_FILE, GLib.FileTest.EXISTS);
    }

    _refreshToggleLabel() {
        this.toggleItem.label.text =
            this._dimmingEnabled ? "Dimming: On" : "Dimming: off";
    }

    _toggleDimming() {
        if (this._dimmingEnabled) {
            try { GLib.unlink(TOGGLE_FILE); } catch (e) {}
        } else {
            GLib.file_set_contents(TOGGLE_FILE, "");
        }

        this._dimmingEnabled = !this._dimmingEnabled;
        this._refreshToggleLabel();
    }

    /* ---------------- Script control ---------------- */

    _startScript() {
        // Remove stop gate 
        try { GLib.unlink(STOP_FILE); } catch (e) {}

        GLib.spawn_async(
            null,
            ["/usr/bin/bash", SCRIPT_PATH],
            null,
            GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            null
        );
    }

    _stopScript() {
        // Create stop gate
        GLib.file_set_contents(STOP_FILE, "");

        // Kill running instance
        try {
            GLib.spawn_command_line_async(`pkill -f "${SCRIPT_PATH}"`);
        } catch (e) {}
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new FadeMonitorsApplet(metadata, orientation, panelHeight, instanceId);
}
