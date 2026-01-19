const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;

class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);

        this.last_reads = 0;
        this.last_writes = 0;

        this.icons = {
            idle: "⚫",
            read: "🟢",
            write: "🔴",
            both: "🟤"
        };

        this._update_loop();
    }

    _get_disk_stats() {
        try {
            let [success, content] = GLib.file_get_contents("/proc/diskstats");
            if (!success) return { r: 0, w: 0 };

            let total_r = 0;
            let total_w = 0;
            let lines = content.toString().split('\n');

            for (let line of lines) {
                let parts = line.trim().split(/\s+/);
                if (parts.length >= 7) {
                    total_r += parseInt(parts[3]);
                    total_w += parseInt(parts[7]);
                }
            }
            return { r: total_r, w: total_w };
        } catch (e) {
            return { r: 0, w: 0 };
        }
    }

    _update_loop() {
        let stats = this._get_disk_stats();

        let has_read = stats.r > this.last_reads;
        let has_write = stats.w > this.last_writes;

        if (has_read && has_write) {
            this.set_applet_label(this.icons.both);
        } else if (has_read) {
            this.set_applet_label(this.icons.read);
        } else if (has_write) {
            this.set_applet_label(this.icons.write);
        } else {
            this.set_applet_label(this.icons.idle);
        }

        this.last_reads = stats.r;
        this.last_writes = stats.w;

        // 100ms update time setting
        this._timer_id = Mainloop.timeout_add(100, () => {
            this._update_loop();
            return false;
        });
    }

    on_applet_removed_from_panel() {
        if (this._timer_id) {
            Mainloop.source_remove(this._timer_id);
        }
    }
}

function main(metadata, orientation, panelHeight, instance_id) {
    return new MyApplet(metadata, orientation, panelHeight, instance_id);
}
