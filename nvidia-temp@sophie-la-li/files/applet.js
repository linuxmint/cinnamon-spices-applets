const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;

function NvGpuTempApplet(metadata, orientation, instance_id) {
    this._init(metadata, orientation, instance_id);
};

NvGpuTempApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, instance_id);

        this.set_applet_tooltip(_("GPU Temperature"));
        this.set_applet_label("?°");

        this.state = {};
        this.settings = new Settings.AppletSettings(this.state, metadata.uuid, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'interval', 'interval');

        this.updateTemperature();
        this.loopId = Mainloop.timeout_add(this.state.interval, () => this.updateTemperature());
    },

    on_settings_changed: function() {
        if (this.loopId > 0) {
            Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;
        this.updateTemperature();
        this.loopId = Mainloop.timeout_add(this.state.interval, () => this.updateTemperature());
    },

    on_applet_clicked: function() {
        GLib.spawn_command_line_async('nvidia-settings');
    },

    on_applet_removed_from_panel: function() {
        Mainloop.source_remove(this.loopId);
        this.loopId = 0;
    },

    updateTemperature: function() {
        let [result, stdout, stderr] = GLib.spawn_command_line_sync('nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits');
        this.set_applet_label(stdout.toString().trim() + " °"); 
        return true;
    }
};

function main(metadata, orientation, instance_id) {
    return new NvGpuTempApplet(metadata, orientation, instance_id);
};

