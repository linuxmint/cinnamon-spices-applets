/*
 * Resource Monitor
 * A Cinnamon applet to monitor CPU, RAM, and Swap usage.
 * Copyright (C) 2026 kprakesh
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const Settings = imports.ui.settings;

const UPDATE_INTERVAL_SECONDS = 2;

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_tooltip("Resource Usage");

        // Initialize Settings
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
            this.settings.bind("show-cpu", "show_cpu", this._update_labels);
            this.settings.bind("show-ram", "show_ram", this._update_labels);
            this.settings.bind("show-swap", "show_swap", this._update_labels);
        } catch (e) {
            global.logError("Resource Monitor Settings Error: " + e.message);
        }

        this.set_applet_icon_name("utilities-system-monitor");
        this.set_applet_label("...");

        // State tracking
        this._last_total = 0;
        this._last_idle = 0;
        
        this._cpu_string = " ...";
        this._mem_string = " ...";
        this._swap_string = " ...";

        this._update_loop();
    },

    _update_loop: function() {
        this._refresh_stats();
        // Fixed: Use modern arrow function instead of deprecated Lang.bind
        this._timeoutId = Mainloop.timeout_add_seconds(UPDATE_INTERVAL_SECONDS, () => {
            this._update_loop();
            return false; // Prevent Mainloop from firing multiple times if not intended
        });
    },

    _refresh_stats: function() {
        try {
            // CPU Asynchronous Read to prevent Mainloop blocking
            let statFile = Gio.File.new_for_path("/proc/stat");
            statFile.load_contents_async(null, (file, res) => {
                try {
                    let [success, contents] = file.load_contents_finish(res);
                    if (success) {
                        let statContent = ByteArray.toString(contents);
                        this._process_cpu_data(statContent);
                    }
                } catch (e) {
                    global.logError("Resource Monitor CPU Async Error: " + e.message);
                }
            });

            // MEM Asynchronous Read to prevent Mainloop blocking
            let memFile = Gio.File.new_for_path("/proc/meminfo");
            memFile.load_contents_async(null, (file, res) => {
                try {
                    let [success, contents] = file.load_contents_finish(res);
                    if (success) {
                        let memContent = ByteArray.toString(contents);
                        this._process_mem_data(memContent);
                    }
                } catch (e) {
                    global.logError("Resource Monitor MEM Async Error: " + e.message);
                }
            });
        } catch (e) {
            global.logError("Resource Monitor Error: " + e.message);
        }
    },

    _process_cpu_data: function(statContent) {
        let line = statContent.split('\n')[0];
        let parts = line.split(/\s+/).filter(String).slice(1).map(Number);
        
        // Defensive bounds checking
        if (parts.length >= 5) {
            let total = parts.reduce((a, b) => a + b, 0);
            let idlePlusWait = parts[3] + parts[4]; 

            // Prevent incorrect first-cycle calculation
            if (this._last_total === 0) {
                this._last_total = total;
                this._last_idle = idlePlusWait;
                this._cpu_string = "...";
            } else {
                let diff_total = total - this._last_total;
                let diff_idle = idlePlusWait - this._last_idle;
                let cpu_perc = diff_total > 0 ? Math.round(100 * (diff_total - diff_idle) / diff_total) : 0;

                this._last_total = total;
                this._last_idle = idlePlusWait;
                this._cpu_string = cpu_perc.toString().padStart(2, ' ') + "%";
            }
        }
        this._update_labels();
    },

    _process_mem_data: function(memContent) {
        let lines = memContent.split('\n');
        let info = {};
        lines.forEach(l => {
            let parts = l.split(':');
            if (parts.length === 2) info[parts[0].trim()] = parseInt(parts[1].trim());
        });

        // Defensive checks for memory values
        if ('MemTotal' in info && 'MemAvailable' in info && info['MemTotal'] > 0) {
            let mem_used = info['MemTotal'] - info['MemAvailable'];
            let mem_perc = Math.round((mem_used / info['MemTotal']) * 100);
            this._mem_string = mem_perc.toString().padStart(2, ' ') + "%";
        }

        if ('SwapTotal' in info && 'SwapFree' in info) {
            if (info['SwapTotal'] > 0) {
                let swap_used = info['SwapTotal'] - info['SwapFree'];
                let swap_perc = Math.round((swap_used / info['SwapTotal']) * 100);
                this._swap_string = swap_perc.toString().padStart(2, ' ') + "%";
            } else {
                this._swap_string = " 0%"; 
            }
        }
        this._update_labels();
    },

    _update_labels: function() {
        let labelParts = [];
        if (this.show_cpu) labelParts.push(`CPU: ${this._cpu_string}`);
        if (this.show_ram) labelParts.push(`RAM: ${this._mem_string}`);
        if (this.show_swap) labelParts.push(`SWAP: ${this._swap_string}`);

        if (labelParts.length > 0) {
            this.set_applet_label(labelParts.join(" | "));
            if (this._applet_icon) this._applet_icon.hide(); 
        } else {
            this.set_applet_label(""); 
            if (this._applet_icon) this._applet_icon.show(); 
        }
    },

    on_applet_removed_from_panel: function() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
        }
        // Settings cleanup memory leak fix
        if (this.settings) {
            this.settings.finalize();
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
