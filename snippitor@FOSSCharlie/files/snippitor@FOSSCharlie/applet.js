/*
 * Snippitor - Cinnamon text-snippet applet
 * Copyright (C) 2026  FOSSCharlie
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * USE AT YOUR OWN RISK: this software is provided "as is", without
 * warranty of any kind, express or implied. See the LICENSE file
 * included with this applet for the full text.
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const UUID = "snippitor@FOSSCharlie";
const APPLET_DIR = imports.ui.appletManager.appletMeta[UUID].path;
const DAEMON_SCRIPT = APPLET_DIR + "/snippitor_daemon.py";
const GUI_SCRIPT = APPLET_DIR + "/snippitor_gui.py";
// Old data location used by earlier versions of this applet, kept only so
// on_applet_removed_from_panel can mop up any leftovers - current data
// lives inside this applet's own folder instead (see snippitor_daemon.py).
const OLD_CONFIG_DIR = GLib.get_user_config_dir() + "/snippitor";

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this._running = false;

        try {
            this.set_applet_icon_symbolic_name("insert-text-symbolic");
        } catch (e) {
            global.logError("snippitor: " + e);
        }

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._toggleItem = new PopupMenu.PopupMenuItem("Start Snippitor");
        this._toggleItem.connect("activate", () => this._toggleDaemon());
        this.menu.addMenuItem(this._toggleItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let editItem = new PopupMenu.PopupMenuItem("Edit Expansions...");
        editItem.connect("activate", () => this._openEditor());
        this.menu.addMenuItem(editItem);

        // Show a sane default state immediately so the panel icon appears
        // right away, then check whether the daemon is already running
        // (e.g. from a previous session) shortly after, off the init path.
        this._updateUI();
        GLib.timeout_add(GLib.PRIORITY_LOW, 100, () => {
            this._checkStatus();
            return false; // one-shot timeout
        });
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _checkStatus: function() {
        try {
            let proc = Gio.Subprocess.new(
                ["pgrep", "-f", DAEMON_SCRIPT],
                Gio.SubprocessFlags.STDOUT_PIPE
            );
            proc.communicate_utf8_async(null, null, (source, res) => {
                let running = false;
                try {
                    let [, stdout] = source.communicate_utf8_finish(res);
                    running = !!(stdout && stdout.trim().length > 0);
                } catch (e) {
                    running = false;
                }
                this._running = running;
                this._updateUI();
                // Auto-start: Snippitor should just work without the
                // user needing to click the panel icon first. Manual
                // start/stop via the icon is still available (e.g. to
                // pause it temporarily), but isn't required.
                if (!this._running) {
                    this._startDaemon();
                }
            });
        } catch (e) {
            global.logError("snippitor: status check failed: " + e);
            this._running = false;
            this._updateUI();
        }
    },

    _updateUI: function() {
        if (this._running) {
            try {
                this.set_applet_icon_symbolic_name("input-keyboard-symbolic");
            } catch (e) {
                global.logError("snippitor: icon set failed: " + e);
            }
            this.set_applet_tooltip("Snippitor: running (click to stop)");
            this._toggleItem.label.set_text("Stop Snippitor");
        } else {
            try {
                this.set_applet_icon_symbolic_name("insert-text-symbolic");
            } catch (e) {
                global.logError("snippitor: icon set failed: " + e);
            }
            this.set_applet_tooltip("Snippitor: stopped (click to start)");
            this._toggleItem.label.set_text("Start Snippitor");
        }
    },

    _toggleDaemon: function() {
        if (this._running) {
            this._stopDaemon();
        } else {
            this._startDaemon();
        }
    },

    _startDaemon: function() {
        Util.spawn(["python3", DAEMON_SCRIPT]);
        this.set_applet_tooltip("Snippitor: starting...");
        // Give the process a moment to actually launch (or crash, e.g. a
        // missing pynput dependency) before trusting that it's running.
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700, () => {
            this._checkStatus();
            return false; // one-shot timeout
        });
    },

    _stopDaemon: function() {
        Util.spawn(["pkill", "-f", DAEMON_SCRIPT]);
        this._running = false;
        this._updateUI();
    },

    _openEditor: function() {
        Util.spawn(["python3", GUI_SCRIPT]);
    },

    on_applet_removed_from_panel: function() {
        // Leave the daemon running across applet reloads/removal is usually
        // undesirable, so stop it.
        this._stopDaemon();
        // If the editor window is open, close it too rather than leaving
        // an orphaned window with nothing left to manage it.
        Util.spawn(["pkill", "-f", GUI_SCRIPT]);
        // Expansions data now lives inside this applet's own folder (see
        // snippitor_daemon.py), so deleting the applet folder itself - via
        // any removal method, including ones that don't call this
        // function at all - naturally takes the data with it. This just
        // mops up any leftover data at the OLD location used by earlier
        // versions of this applet, in case it's still there.
        Util.spawn(["rm", "-rf", OLD_CONFIG_DIR]);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}
