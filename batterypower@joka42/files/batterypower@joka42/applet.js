const St = imports.gi.St;
const GLib = imports.gi.GLib;
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

		this.set_applet_tooltip(_('Current power drawn from battery'));
		this.loopId = Mainloop.timeout_add(1000, () => this.mainloop());
	},

	mainloop: function() {
		let power = this._getBatteryPower();
		let value = ((Math.round(power * 10) / 10)
			.toFixed(1)
			.toString()
		);
		let separator = (this.isHorizontal) ? " " : "\n"
		this.set_applet_label(value + separator + "W");
		return true;
	},

	_getBatteryPower: function () {
		let current = 0;
		let voltage = 0;

		let currentDrawFile = "/sys/class/power_supply/BAT0/current_now";
		let voltageDrawFile = "/sys/class/power_supply/BAT0/voltage_now";
		if (GLib.file_test(currentDrawFile, 1 << 4)) {
			let content = GLib.file_get_contents(currentDrawFile);
			current = parseInt(content[1]) / 1000000.0;
		}
		if (GLib.file_test(voltageDrawFile, 1 << 4)) {
			let content = GLib.file_get_contents(voltageDrawFile);
			voltage = parseInt(content[1]) / 1000000.0;
		}
		return Math.round(current * voltage * 10) / 10;
	},
};

function main(metadata, orientation, instance_id) {
	// return new CPUTemperatureApplet(metadata, orientation, instance_id);
	return new BatteryPowerApplet(metadata, orientation, instance_id);
}
