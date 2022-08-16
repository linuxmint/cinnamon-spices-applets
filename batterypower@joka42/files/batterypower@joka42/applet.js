const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;

const UUID = "batterypower@joka42";

function BatteryPowerApplet(metadata, orientation, instance_id) {
	this._init(metadata, orientation, instance_id);
}

BatteryPowerApplet.prototype = {
	__proto__: Applet.TextApplet.prototype,

	_init: function (metadata, orientation, instance_id) {
		Applet.TextApplet.prototype._init.call(this, orientation, instance_id);

		if (orientation == St.Side.LEFT || orientation == St.Side.RIGHT) {
			this.isHorizontal = false;
		} else {
			this.isHorizontal = true;
		}
		this.state = {};
		this.settings = new Settings.AppletSettings(this.state, metadata.uuid, instance_id);
		this.settings.bindProperty(Settings.BindingDirection.IN, 'show-unit', 'showunit', () => this.on_settings_changed(), null);
		this.settings.bindProperty(Settings.BindingDirection.IN, 'interval', 'interval', () => this.on_settings_changed(), null);
		this.UPowerRefreshed = false;

		this.loopId = Mainloop.timeout_add(this.state.interval, () => this.update());
	},

	update: function() {
		this.UPowerRefreshed = false;
		const power = this._getBatteryPower();
		if (isNaN(power)){
			this.set_applet_label("ERROR");
			this.set_applet_tooltip("ERROR: Your system is not supported, yet.\nConsider reporting an issue on github: https://github.com/linuxmint/cinnamon-spices-applets");
			return false;
		}

		const value = ((Math.round(power * 10) / 10)
			.toFixed(1)
			.toString()
		);
		const separator = (this.isHorizontal) ? " " : "\n";
		const unit_string = (this.state.showunit) ? separator + "W" : "";
		const charging_indicator = "⚡";
		
		const status = this._getBatteryStatus().toLowerCase();
			
		switch (status){
			case "charging":
				this.set_applet_tooltip('Battery is charging. Battery charging power is displayed.\nThis is not the power consumption of the system!');
				this.set_applet_label(charging_indicator + separator + value + unit_string);
				break;
			case "discharging":
				this.set_applet_tooltip('Battery is discharging. Power drawn from battery is displayed.');
				this.set_applet_label(value + unit_string);
				break;
			case "unknown":
				this.set_applet_tooltip('Battery is fully charged. AC is plugged in.');
				this.set_applet_label(charging_indicator);
				break;
			default:
				this.set_applet_tooltip('Status unknown, please contact the maintainer https://github.com/linuxmint/cinnamon-spices-applets/issues');
				this.set_applet_label(charging_indicator);
		}
		return true;
	},

	_getBatteryStatus: function () {
		const statusFile = "/sys/class/power_supply/BAT0/status";
		if (GLib.file_test(statusFile, 1 << 4)) {
			try {
				return String(GLib.file_get_contents(statusFile)[1]).trim();
			} catch (error) {
				// do nothing
			}
		}

		if (!this.UPowerRefreshed){
			Main.Util.spawnCommandLine(`python3 ${__meta.path}/update_upower.py`);
			this.UPowerRefreshed = true;
		}
		const stateFile = ".batterystate";
		//Main.Util.spawnCommandLine(`upower -i $(upower -e | grep BAT) | grep state | rev | cut -d ' ' -f 1 | rev > ${__meta.path}/${stateFile}`);
		if (GLib.file_test(stateFile, 1 << 4)) {
			try{
				return String(GLib.file_get_contents(stateFile)[1]).trim();
			} catch (error) {
				// do nothing
			}
		}
		return "";
	},

	_getBatteryPower: function () {
		// Return: Currently drawn power from the battery, or charging rate. NaN on failure

		// Depending on the System setup files from /sys/class/power_supply/ can be used.
		// I assume that reading these files is the most efficient way to get the energy rate.
		// If the files cannot be found, upower is used to update the power draw from the 
		// battery.

		const powerDrawFile = "/sys/class/power_supply/BAT0/power_now";
		if(GLib.file_test(powerDrawFile, 1 << 4)) {
			try{
				return parseInt(GLib.file_get_contents(powerDrawFile)[1]) / 1000000.0;
			} catch (error) {
				return 0.0;
			}
		}
		
		const currentDrawFile = "/sys/class/power_supply/BAT0/current_now";
		const voltageDrawFile = "/sys/class/power_supply/BAT0/voltage_now";
		if (GLib.file_test(currentDrawFile, 1 << 4) && GLib.file_test(voltageDrawFile, 1 << 4)) {
			try {
				const current = parseInt(GLib.file_get_contents(currentDrawFile)[1]) / 1000000.0;
				const voltage = parseInt(GLib.file_get_contents(voltageDrawFile)[1]) / 1000000.0;
				return current * voltage;
			} catch (error) {
				return 0.0;
			}
		}

		// If the files could not be used, we need to update upower information and use info
		// from there.
		if (!this.UPowerRefreshed){
			Main.Util.spawnCommandLine(`python3 ${__meta.path}/update_upower.py`);
			this.UPowerRefreshed = true;
		}
		const upowerEnergyRateFile = ".energyrate"
		if(GLib.file_test(upowerEnergyRateFile, 1 << 4)) {
			try {
				return parseFloat(GLib.file_get_contents(upowerEnergyRateFile)[1]);
			} catch (error) {
				return 0.0;
			}
		}
		
		return NaN;
	},

	on_settings_changed: function() {
		if (this.loopId > 0) {
			Mainloop.source_remove(this.loopId);
		}
		this.loopId = 0;
		this.loopId = Mainloop.timeout_add(this.state.interval, () => this.mainloop());
	},
};

function main(metadata, orientation, instance_id) {
	return new BatteryPowerApplet(metadata, orientation, instance_id);
}
