const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;

let UUID = "fade-monitors@hisovereign";
let TOGGLE_FILE = GLib.get_home_dir() + "/.fade_mouse_enabled";
let SCRIPT_PATH = GLib.get_home_dir() + "/.local/bin/fade-monitors-2d-time-based.sh";

class FadeMonitorsApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // Set icon and tooltip
        this.set_applet_icon_symbolic_name("video-display-symbolic");
        this.set_applet_tooltip("Fade Monitors");

        // Create the menu
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        // Cache dimming state
        this._dimmingEnabled = this._isDimmingEnabled();

        // Build menu items and start script
        this._buildMenu();
        this._startScript();
    }

    on_applet_clicked() {
        // Sync the toggle state every time menu opens
        this._dimmingEnabled = this._isDimmingEnabled();
        this._refreshToggleLabel();
        this.menu.toggle();
    }

    _buildMenu() {
        // Dimming toggle item
        this.toggleItem = new PopupMenu.PopupMenuItem("", { reactive: true });
        this.menu.addMenuItem(this.toggleItem);

        this.toggleItem.connect("activate", () => {
            this._toggleDimming();
        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings item → opens the script
        let settingsItem = new PopupMenu.PopupMenuItem("Settings");
        settingsItem.connect("activate", () => {
            GLib.spawn_command_line_async(`xdg-open "${SCRIPT_PATH}"`);
        });
        this.menu.addMenuItem(settingsItem);

        // Initial label update
        this._refreshToggleLabel();
    }

    _isDimmingEnabled() {
        return GLib.file_test(TOGGLE_FILE, GLib.FileTest.EXISTS);
    }

    _refreshToggleLabel() {
        this.toggleItem.label.text = this._dimmingEnabled ? "Dimming: On" : "Dimming: Off";
    }

    _toggleDimming() {
        if (this._dimmingEnabled) {
            GLib.unlink(TOGGLE_FILE);
        } else {
            GLib.file_set_contents(TOGGLE_FILE, "");
        }

        // Flip state
        this._dimmingEnabled = !this._dimmingEnabled;

        // Update menu label immediately
        this._refreshToggleLabel();

        // Force repaint if menu is open
        if (this.menu.isOpen) {
            this.toggleItem.actor.queue_repaint();
        }
    }

    _startScript() {
        GLib.spawn_async(
            null,
            ["/usr/bin/bash", SCRIPT_PATH],
            null,
            GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            null
        );
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new FadeMonitorsApplet(metadata, orientation, panelHeight, instanceId);
}
