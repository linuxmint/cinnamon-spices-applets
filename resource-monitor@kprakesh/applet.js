const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const St = imports.gi.St; 

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_tooltip("System Resource Usage");
        
        // set the icon (will display when all setting turned off)
        this.set_applet_icon_name("utilities-system-monitor-symbolic");

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-cpu", "show_cpu", this._refresh_stats, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-ram", "show_ram", this._refresh_stats, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-swap", "show_swap", this._refresh_stats, null);

        // State for CPU calculation
        this._last_total = 0;
        this._last_idle = 0;

        this._update_loop();
    },

    _update_loop: function() {
        this._refresh_stats();
        this._timeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._update_loop));
    },

    _refresh_stats: function() {
        try {
            let cpu_string = "0%";
            let mem_string = "0%";
            let swap_string = "0%";

            // --- CPU (/proc/stat) ---
            let [ok_cpu, statContent] = GLib.file_get_contents("/proc/stat");
            if (ok_cpu) {
                let line = statContent.toString().split('\n')[0];
                let parts = line.split(/\s+/).filter(String).slice(1).map(Number);
                let total = parts.reduce((a, b) => a + b, 0);
                let idle = parts[3]; 

                let diff_total = total - this._last_total;
                let diff_idle = idle - this._last_idle;
                let cpu_perc = diff_total > 0 ? Math.round(100 * (diff_total - diff_idle) / diff_total) : 0;

                this._last_total = total;
                this._last_idle = idle;
                cpu_string = cpu_perc.toString().padStart(2, ' ') + "%";
            }

            //  --- RAM & SWAP (/proc/meminfo) ---
            let [ok_mem, memContent] = GLib.file_get_contents("/proc/meminfo");
            if (ok_mem) {
                let lines = memContent.toString().split('\n');
                let info = {};
                lines.forEach(l => {
                    let parts = l.split(':');
                    if (parts.length === 2) info[parts[0].trim()] = parseInt(parts[1].trim());
                });

                let mem_used = info['MemTotal'] - info['MemAvailable'];
                let mem_perc = Math.round((mem_used / info['MemTotal']) * 100);
                mem_string = mem_perc.toString().padStart(2, ' ') + "%";

                let swap_used = info['SwapTotal'] - info['SwapFree'];
                let swap_perc = info['SwapTotal'] > 0 ? Math.round((swap_used / info['SwapTotal']) * 100) : 0;
                swap_string = swap_perc.toString().padStart(2, ' ') + "%";
            }

            //  --- Final Display Logic ---
            let labelParts = [];
            if (this.show_cpu) labelParts.push(`CPU: ${cpu_string}`);
            if (this.show_ram) labelParts.push(`RAM: ${mem_string}`);
            if (this.show_swap) labelParts.push(`SWAP: ${swap_string}`);

            if (labelParts.length > 0) {
                this.set_applet_label(labelParts.join(" | "));
                this._hide_icon();
            } else {
                this.set_applet_label(""); 
                this._show_icon();
            }

        } catch (e) {
            global.log("Resource Monitor Error: " + e.message);
        }
    },

    // Helper functions to safely toggle icon visibility
    _show_icon: function() {
        if (this._applet_icon) this._applet_icon.show();
    },

    _hide_icon: function() {
        if (this._applet_icon) this._applet_icon.hide();
    },

    on_applet_removed_from_panel: function() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}