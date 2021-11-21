const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio; // Needed for file infos
const Util = imports.misc.util;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

const UUID = "temperature@fevimu";

const HOME_DIR = GLib.get_home_dir();
// ++ DEBUG is true only if the DEBUG file is present in this applet directory ($ touch DEBUG)
var _debug = Gio.file_new_for_path(HOME_DIR + "/.local/share/cinnamon/applets/" + UUID + "/DEBUG");
const DEBUG = _debug.query_exists(null);

const sensorRegex = /^([\sA-z\w]+[\s|:|\d]{1,4})(?:\s+\+)(\d+\.\d+)°[FC]|(?:\s+\()([a-z]+)(?:[\s=+]+)(\d+\.\d)°[FC],\s([a-z]+)(?:[\s=+]+)(\d+\.\d)/gm;
const cpuIdentifiers = ['Tctl', 'CPU Temperature'];

const _ = function (str) {
	let translation = Gettext.gettext(str);
	if (translation !== str) {
		return translation;
	}
	return Gettext.dgettext(UUID, str);
}

function CPUTemperatureApplet(metadata, orientation, instance_id) {
	this._init(metadata, orientation, instance_id);
}

CPUTemperatureApplet.prototype = {
	__proto__: Applet.TextApplet.prototype,

	_init: function (metadata, orientation, instance_id) {
		Applet.TextApplet.prototype._init.call(this, orientation, instance_id);

		this.orientation = orientation;
		if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "3.2") >= 0) {
			this.setAllowedLayout(Applet.AllowedLayout.BOTH);
		}
		this.on_orientation_changed(orientation); // Initializes for panel orientation

		this.isLooping = true;
		this.waitForCmd = false;
		this.menuItems = [];
		this.state = {};
		this.settings = new Settings.AppletSettings(this.state, metadata.uuid, instance_id);

		this.settings.bindProperty(Settings.BindingDirection.IN, 'only-integer-part', 'onlyIntegerPart', () => this.on_settings_changed(), null);
		this.settings.bindProperty(Settings.BindingDirection.IN, 'show-unit', 'showUnit', () => this.on_settings_changed(), null);
		this.settings.bindProperty(Settings.BindingDirection.IN, 'show-unit-letter', 'showUnitLetter', () => this.on_settings_changed(), null);
		this.settings.bindProperty(Settings.BindingDirection.IN, 'show-label-prefix', 'showLabelPrefix', () => this.on_settings_changed(), null);
		this.settings.bindProperty(Settings.BindingDirection.IN, 'label-prefix', 'labelPrefix', () => this.on_settings_changed(), null);
		this.settings.bindProperty(Settings.BindingDirection.IN, 'interval', 'interval');

		this.lang = {
			acpi: 'ACPI Adapter',
			pci: 'PCI Adapter',
			virt: 'Virtual Thermal Zone'
		};
		this.statusLabel = new St.Label({
			text: '--',
			style_class: 'temperature-label'
		});

		// Create the popup menu
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

		this.sensorsPath = null;
		Util.spawn_async(['which', 'sensors'], Lang.bind(this, this._detectSensors));

		this.set_applet_tooltip(_('Temperature'));

		this.updateWattUsage();
		this.loopId = Mainloop.timeout_add(this.state.interval, () => this.updateWattUsage());
	},

	on_settings_changed: function () {
		if (this.loopId > 0) {
			Mainloop.source_remove(this.loopId);
		}
		this.loopId = 0;
		this.updateWattUsage();
		this.loopId = Mainloop.timeout_add(this.state.interval, () => this.updateWattUsage());
	},

	on_orientation_changed: function (orientation) {
		this.orientation = orientation;
		if (this.versionCompare(GLib.getenv('CINNAMON_VERSION'), "3.2") >= 0) {
			if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
				// vertical
				this.isHorizontal = false;
			} else {
				// horizontal
				this.isHorizontal = true;
			}
		} else {
			this.isHorizontal = true;  // Do not check unless >= 3.2
		}
	}, // End of on_orientation_changed

	versionCompare: function (left, right) {
		if (typeof left + typeof right != 'stringstring')
			return false;
		var a = left.split('.'),
			b = right.split('.'),
			i = 0,
			len = Math.max(a.length, b.length);
		for (; i < len; i++) {
			if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
				return 1;
			} else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
				return -1;
			}
		}
		return 0;
	}, // End of versionCompare

	on_applet_clicked: function () {
		this.buildMenu(this.menuItems);
		this.menu.toggle();
	},

	on_applet_removed_from_panel: function () {
		Mainloop.source_remove(this.loopId);
		this.loopId = 0;
		this.isLooping = false;
		this.settings.finalize();
	},

	_detectSensors: function (ret) {
		// detect if sensors is installed
		if (ret != "") {
			this.sensorsPath = ret.toString().split('\n', 1)[0]; // find the path of the sensors
		} else {
			this.sensorsPath = null;
		}

		if (this.sensorsPath) {
			this.title = _('Error');
			this.content = _('Run sensors-detect as root. If it doesn\'t help, click here to report with your sensors output!');
		} else {
			this.title = _('Warning');
			this.content = _('Please install lm_sensors. If it doesn\'t help, click here to report with your sensors output!');
		}
	},

	buildMenu: function (items) {
		this.menu.removeAll();
		let isOpen = this.menu.isOpen;
		let section = new PopupMenu.PopupMenuSection(_('Temperature'));
		if (items.length > 0) {
			for (let i = 0; i < items.length; i++) {
				section.addMenuItem(new PopupMenu.PopupMenuItem(items[i]));
			}
		} else {
			let item = new PopupMenu.PopupMenuItem(this.content);
			item.connect('activate', function () {
				Util.trySpawn(['xdg-open', 'https://github.com/linuxmint/cinnamon-spices-applets/issues?utf8=%E2%9C%93&q=is%3Aissue+temperature%40fevimu+']);
			});
			section.addMenuItem(item);
		}
		this.menu.addMenuItem(section);
		if (isOpen) {
			this.menu.open();
		}
	},

	updateWattUsage: function () {
		if (!this.isLooping) {
			return false;
		}

		if (this.sensorsPath && !this.waitForCmd) {
			this.waitForCmd = true;
			Util.spawn_async([this.sensorsPath], Lang.bind(this, this._updateWattUsage));
		}

		return true;
	},


	_updateWattUsage: function (sensorsOutput) {
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
		let wattUsage = Math.round(current * voltage * 10) / 10;


		let items = [];
		let tempInfo = null;
		let temp = 0;


		if (this.state.showLabelPrefix) {
			this.title = "%s %s".format(this.state.labelPrefix, this.title);
		}

		if (wattUsage !== 0) {
			// this.set_applet_label(this.title);
			this.set_applet_label(this._formatText(wattUsage));
		} else {
			this.set_applet_label("");
		}

		if (this.menu.isOpen) {
			this.buildMenu(items);
		} else {
			this.menuItems = items;
		}

		this.waitForCmd = false;

		return true;
	},

	_formatText: function (value_raw) {
		let precisionDigits;
		precisionDigits = this.state.onlyIntegerPart ? 0 : 1;
		let value;
		let unit = "";
		let separator = "";
		if (this.state.showUnit) {
			unit = "W";
			separator = (this.isHorizontal) ? " " : "\n";
		}

		value = ((Math.round(value_raw * 10) / 10)
			.toFixed(precisionDigits)
			.toString()
		);

		return '%s%s%s'.format(value, separator, unit)
	}
};

function main(metadata, orientation, instance_id) {
	return new CPUTemperatureApplet(metadata, orientation, instance_id);
}
