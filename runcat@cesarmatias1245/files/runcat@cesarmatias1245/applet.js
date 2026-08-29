const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        let metadata = imports.ui.appletManager.appletMeta[instance_id];
        this.applet_path = metadata ? metadata.path + "/" : GLib.get_home_dir() + "/.local/share/cinnamon/applets/runcat@cesarmatias1245/";

        this.frame = 1;
        this.total_frames = 5;
        this.last_total = 0;
        this.last_idle = 0;

        this.set_applet_tooltip("RunCat CPU");
        this._update();
    },

    _get_cpu_usage: function() {
        try {
            let [success, content] = GLib.file_get_contents('/proc/stat');
            if (!success) return 0;
            
            let line = imports.byteArray.toString(content).split('\n')[0];
            let fields = line.trim().split(/\s+/).slice(1).map(Number);
            
            let idle = fields[3] + fields[4];
            let total = fields.reduce((a, b) => a + b, 0);

            let total_diff = total - this.last_total;
            let idle_diff = idle - this.last_idle;

            this.last_total = total;
            this.last_idle = idle;

            if (total_diff <= 0) return 0;
            let usage = ((total_diff - idle_diff) / total_diff) * 100;
            return Math.min(Math.max(usage, 0), 100);
        } catch (e) {
            return 0;
        }
    },

_update: function() {
        let cpu = this._get_cpu_usage();
        let delay = Math.max(30, Math.floor(250 - (cpu * 2.2)));

        this.set_applet_tooltip("CPU: " + Math.round(cpu) + "%");

        let icon_file = this.applet_path + "cat" + this.frame + ".png";
        this.set_applet_icon_path(icon_file);

        this.frame = (this.frame % this.total_frames) + 1;

        if (this._timeout) Mainloop.source_remove(this._timeout);
        this._timeout = Mainloop.timeout_add(delay, () => this._update());
    },

    on_applet_removed_from_panel: function() {
        if (this._timeout) Mainloop.source_remove(this._timeout);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}
