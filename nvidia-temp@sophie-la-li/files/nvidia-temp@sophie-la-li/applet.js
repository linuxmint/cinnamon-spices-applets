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
        this.set_applet_label("?");

        this.state = {};
        this.settings = new Settings.AppletSettings(this.state, metadata.uuid, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'interval', 'interval', () => this.refresh(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-unit', 'showUnit', () => this.refresh(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'show-unit-letter', 'showUnitLetter', () => this.refresh(), null);
        this.settings.bindProperty(Settings.BindingDirection.IN, 'use-fahrenheit', 'useFahrenheit', () => this.refresh(), null);

        this.refresh();
    },

    refresh: function() {
        if (this.loopId > 0) {
            Mainloop.source_remove(this.loopId);
            this.loopId = 0;
        }

        this.updateTemperatureUnit();
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
        let value = stdout.toString().trim();
        if (this.state.useFahrenheit) value = Math.round((value * 1.8) + 32);
        this.set_applet_label(value + this.tempUnit); 
        return true;
    },

    updateTemperatureUnit: function() {
        this.tempUnit = '';
        if (!this.state.showUnit) return;
        this.tempUnit += ' °';
        if (!this.state.showUnitLetter) return;
        this.tempUnit += this.state.useFahrenheit ? 'F' : 'C';
    }
};

function main(metadata, orientation, instance_id) {
    return new NvGpuTempApplet(metadata, orientation, instance_id);
};

