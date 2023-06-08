// Simplified System Monitor Applet

const AppletUUID = "ssm@Severga";

const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Gettext = imports.gettext; // Needed for translations

const HOME_DIR = GLib.get_home_dir();
// l10n support
Gettext.bindtextdomain(AppletUUID, HOME_DIR + "/.local/share/locale");
Gettext.bindtextdomain("cinnamon-control-center", "/usr/share/locale");

// Localisation/translation support
function _(str, uuid=AppletUUID) {
	var customTrans = Gettext.dgettext(uuid, str);
	if (customTrans !== str && customTrans !== "") return customTrans;
	return Gettext.gettext(str);
}

let GTop, failed = false;
try {
	GTop = imports.gi.GTop;
}
catch (e) {
	global.logError(_("Required GTop package missing!"));
	failed = true;
}

function align(str, size) {
	str = String(str);
	return (str.length < size ? " ".repeat(size - str.length) + str : str);
}


// <SSMApplet>
function SSMApplet(metadata, orientation, panel_height, instance_id) {
	this._init(metadata, orientation, panel_height, instance_id);
}

SSMApplet.prototype = {
	__proto__: Applet.Applet.prototype,
	
	_init: function(metadata, orientation, panel_height, instance_id) {
		Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
		
		this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);
		if (failed) {
			this.errorLabel = new St.Label();
			this.errorLabel.set_text(_("Error!"));
			this.actor.add(this.errorLabel, { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
			this._applet_tooltip.set_text(_("Required GTop package missing!"));
		} else {
			this._applet_tooltip._tooltip.set_style('text-align: left; font-family: monospace; font-size: 9pt');
			this._applet_context_menu.addMenuItem(new Applet.MenuItem(_("Clear Cache"), "user-trash", () => {
				let [success, argv] = GLib.shell_parse_argv("pkexec sh -c 'echo 1 >/proc/sys/vm/drop_caches'");
				let flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD;
				let [result, pid] = GLib.spawn_async(null, argv, null, flags, null);
			}));
			
			this.waitingForSensors = false;
			this.sensorsFailed = false;
			this.currentTemp = -283;
			this._netBlackList = [];
			
			//this.sensorsPath = "/usr/bin/sensors";
			//this.refresh = 2;
			//this.tempRefresh = 5;
			this.coldTemp = 45;
			this.hotTemp = 70;
			//this.coldColor = "#FFF38D";
			//this.hotColor = "#FF0000";
			//this.cpuMemWidth = 40;
			//this.netWidth = 40;
			//this.netStyle = "text-align: left; margin-left: 10px; font-size: 8pt;"
			//this.netBlackList = "lo";
			this.settings = new Settings.AppletSettings(this, AppletUUID, instance_id);
			this._bind_settings();
			this.on_temp_settings_changed();
			this.on_blacklist_setting_changed();
			
			this.cpuLabel = new St.Label();
			this.memLabel = new St.Label();
			this.netLabel = new St.Label();
			for (let label of [this.cpuLabel, this.memLabel]) {
				label.set_width(this.cpuMemWidth);
				label.set_style("text-align: right");
				label.set_text("---%");
				this.actor.add(label, { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
			}
			this.netLabel.set_width(this.netWidth);
			this.netLabel.set_style(this.netStyle);
			this.netLabel.set_text("↑-.--k\n↓-.--k");
			this.actor.add(this.netLabel, { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE, y_fill: false });
			
			this.cpuDataProvider = new MultiCPUDataProvider();
			this.memDataProvider = new MemDataProvider();
			this.netDataProvider = new NetDataProvider();
			
			this.timeoutR = 0;
			this.timeout = Mainloop.timeout_add_seconds(1, () => this._update());
			this.timeout2 = Mainloop.timeout_add_seconds(0.5, () => this._update2());
		}
	},
	
	_remove_timeout: function() {
		if (this.timeout) {
			Mainloop.source_remove(this.timeout);
			this.timeout = 0;
		}
	},
	
	_remove_timeout2: function() {
		if (this.timeout2) {
			Mainloop.source_remove(this.timeout2);
			this.timeout2 = 0;
		}
	},
	
	_remove_timeoutR: function() {
		if (this.timeoutR) {
			Mainloop.source_remove(this.timeoutR);
			this.timeoutR = 0;
		}
	},
	
	_fetch_cpu_temp: function(output) {
		this._remove_timeoutR();
		if (typeof output !== "undefined" && output != "") {
			let lines = output.split("\n");
			let maxTemp = 0;
			for (let temp, i = 0; i < lines.length; i++) {
				if (lines[i].indexOf("Package") > -1) {
					temp = parseInt(lines[i].split(":", 2)[1].split(".", 1)[0]);
					if (temp > maxTemp) maxTemp = temp;
				}
			}
			this.currentTemp = maxTemp;
		} else {
			this.currentTemp = -283;
		}
		this.waitingForSensors = false;
	},
	
	_update: function() {
		let shortInfo, shortInfo2, longInfo, tooltip;
		[shortInfo, longInfo] = this.cpuDataProvider.data();
		this.cpuLabel.set_text(shortInfo);
		tooltip = "<b>" + _("CPUs") + "</b>   " + (this.sensorsFailed || this.currentTemp == -283 ? "" : "(<i>" + this.currentTemp + "°C max</i>)") + "\n" + longInfo + "\n\n";
		[shortInfo, longInfo] = this.memDataProvider.data();
		this.memLabel.set_text(shortInfo);
		tooltip += "<b>" + _("Memory") + "</b> (<i>" + (this.memDataProvider.memSize / 1000000000).toFixed(1) + _("GB") + (this.memDataProvider.swapSize ? "; " + (this.memDataProvider.swapSize / 1000000000).toFixed(1) + _("GB swap") : "") + "</i>)\n" + longInfo +"\n\n";
		[shortInfo, shortInfo2, longInfo] = this.netDataProvider.data(this._netBlackList);
		this.netLabel.set_text("↑" + shortInfo + "\n↓" + shortInfo2);
		tooltip += "<b>" + _("Network") + "</b>" + longInfo;
		this._applet_tooltip.set_markup(tooltip);
		let coldColor = Clutter.Color.from_string(this.coldColor); if (coldColor[0]) coldColor = coldColor[1];
		let hotColor = Clutter.Color.from_string(this.hotColor); if (hotColor[0]) hotColor = hotColor[1];
		let color = coldColor.interpolate(hotColor, (this.currentTemp <= this.coldTemp ? 0 : (this.currentTemp >= this.hotTemp ? 1 : (this.currentTemp - this.coldTemp) / (this.hotTemp - this.coldTemp))));
		let r = color.red.toString(16); if (r.length == 1) r = "0" + r;
		let g = color.green.toString(16); if (g.length == 1) g = "0" + g;
		let b = color.blue.toString(16); if (b.length == 1) b = "0" + b;
		this.cpuLabel.set_style("text-align: right; color: #" + r + g + b);
		this._remove_timeout();
		this.timeout = Mainloop.timeout_add_seconds(this.refresh, () => this._update());
	},
	
	_update2: function() {
		if (this.sensorsPath && !this.waitingForSensors && !this.sensorsFailed) {
			this.waitingForSensors = true;
			Util.spawn_async([this.sensorsPath], Lang.bind(this, this._fetch_cpu_temp));
			this.timeoutR = Mainloop.timeout_add_seconds(60, () => {
				this._remove_timeoutR();
				this.sensorsFailed = true;
				this.waitingForSensors = false;
			});
		}
		this._remove_timeout2();
		this.timeout2 = Mainloop.timeout_add_seconds(this.tempRefresh, () => this._update2());
	},
	
	_bind_settings: function() {
		this.settings.bindProperty(Settings.BindingDirection.IN,			"refresh",			"refresh",		null, null);
		this.settings.bindProperty(Settings.BindingDirection.IN,			"temp_refresh",		"tempRefresh",	null, null);
		this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,	"cold_temp",		"coldTemp",		this.on_temp_settings_changed, null);
		this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,	"hot_temp",			"hotTemp",		this.on_temp_settings_changed, null);
		this.settings.bindProperty(Settings.BindingDirection.IN,			"color_cold",		"coldColor",	null, null);
		this.settings.bindProperty(Settings.BindingDirection.IN,			"color_hot",		"hotColor",		null, null);
		this.settings.bindProperty(Settings.BindingDirection.IN,			"sensors_cmd",		"sensorsPath",	this.on_sensors_setting_changed, null);
		this.settings.bindProperty(Settings.BindingDirection.IN,			"size",				"cpuMemWidth",	this.on_labels_settings_changed, null);
		this.settings.bindProperty(Settings.BindingDirection.IN,			"net_size",			"netWidth",		this.on_labels_settings_changed, null);
		this.settings.bindProperty(Settings.BindingDirection.IN,			"net_style",		"netStyle",		this.on_labels_settings_changed, null);
		this.settings.bindProperty(Settings.BindingDirection.IN,			"net_black_list",	"netBlackList", this.on_blacklist_setting_changed, null);
	},
	
	on_temp_settings_changed: function() {
		if (this.coldTemp > this.hotTemp) this.coldTemp = 0;
	},
	
	on_labels_settings_changed: function() {
		this.cpuLabel.set_width(this.cpuMemWidth);
		this.memLabel.set_width(this.cpuMemWidth);
		this.netLabel.set_width(this.netWidth);
		this.netLabel.set_style(this.netStyle);
	},
	
	on_sensors_setting_changed: function() {
		this._remove_timeout2();
		this._remove_timeoutR();
		this.sensorsFailed = false;
		this.waitingForSensors = false;
		this.currentTemp = -283;
		this._update2();
	},
	
	on_blacklist_setting_changed: function() {
		this._netBlackList = this.netBlackList.split(";");
		for (let i = 0; i < this._netBlackList.length; i++) {
			this._netBlackList[i] = this._netBlackList[i].trim();
		}
	},
	
	on_applet_clicked: function() {
		if (!failed) {
			let [success, argv] = GLib.shell_parse_argv("gnome-system-monitor");
			let flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD;
			let [result, pid] = GLib.spawn_async(null, argv, null, flags, null);
		}
	},
	
	on_applet_removed_from_panel: function() {
		if (!failed) {
			this._remove_timeout();
			this._remove_timeout2();
			this._remove_timeoutR();
			this.cpuLabel.destroy();
			this.memLabel.destroy();
			this.netDataProvider.disconnectFromNM();
			this.netLabel.destroy();
		} else {
			this.errorLabel.destroy();
		}
	}
}
// </SSMApplet>


// <MultiCPUDataProvider> (based on Multi-Core System Monitor applet... thanks!)
function MultiCPUDataProvider() {
	this._init();
}

MultiCPUDataProvider.prototype = {
	_init: function() {
		this.gtop = new GTop.glibtop_cpu();
		this.CPUCount = 0;
		
		this.current = 0;
		this.last = 0;
		this.usage = 0;
		this.last_total = 0;
		
		this.CPUListTotal = [];
		this.CPUListNice = [];
		this.CPUListSys = [];
		this.CPUListUser = [];
		
		this.currentReadings = [];
		
		this._fetch_data();
	},
	
	_fetch_data: function() {
		GTop.glibtop_get_cpu(this.gtop);
		if (this.CPUCount <= 0) {
			for (let i = 0; i < this.gtop.xcpu_total.length; i++) {
				if (this.gtop.xcpu_total[i] > 0) {
					this.CPUListTotal[this.CPUCount] = 0;
					this.CPUListNice[this.CPUCount] = 0;
					this.CPUListSys[this.CPUCount] = 0;
					this.CPUListUser[this.CPUCount] = 0;
					this.currentReadings[this.CPUCount] = 0;
					this.CPUCount++;
				}
			}
		}
		let xcpu_total = this.gtop.xcpu_total.slice();
		let xcpu_nice = this.gtop.xcpu_nice.slice();
		let xcpu_sys = this.gtop.xcpu_sys.slice();
		let xcpu_user = this.gtop.xcpu_user.slice();
		for (let i = 0; i < this.CPUCount; i++) {
			let dtotal = xcpu_total[i] - this.CPUListTotal[i];
			let dnice = xcpu_nice[i] - this.CPUListNice[i];
			let dsys = xcpu_sys[i] - this.CPUListSys[i];
			let duser = xcpu_user[i] - this.CPUListUser[i];
			this.currentReadings[i] = (duser + dnice + dsys) / dtotal;
		}
		this.CPUListTotal = xcpu_total;
		this.CPUListNice = xcpu_nice;
		this.CPUListSys = xcpu_sys;
		this.CPUListUser = xcpu_user;
	},
	
	data: function(longInfoTab = 2, longInfoSize = 5) {
		this._fetch_data();
		let overall = 0, longInfo = "";
		for (let i = 0; i < this.CPUCount; i++) {
			overall += this.currentReadings[i];
			longInfo += " ".repeat(longInfoTab) + _("Core ") + (i + 1) + ": " + align((this.currentReadings[i] * 100).toFixed(1), longInfoSize) + "%" + (i < this.CPUCount - 1 ? "\n" : "");
		}
		return [(overall / this.CPUCount * 100).toFixed(0) + "%", longInfo];
	}
}
// </MultiCPUDataProvider>


// <MemDataProvider> (based on Multi-Core System Monitor applet... thanks!)
function MemDataProvider() {
	this._init();
}

MemDataProvider.prototype = {
	_init: function() {
		this.gtopMem = new GTop.glibtop_mem();
		this.gtopSwap = new GTop.glibtop_swap();
		this.memSize = 0;
		this.swapSize = 0;
		
		this.currentReadings = [0, 0, 0, 0, 0];
		
		this._fetch_size();
	},
	
	_fetch_size: function() {
		GTop.glibtop_get_mem(this.gtopMem);
		this.memSize = this.gtopMem.total;
	},
	
	_fetch_data: function() {
		GTop.glibtop_get_mem(this.gtopMem);
		GTop.glibtop_get_swap(this.gtopSwap);
		let unavailableForUse = (this.gtopMem.used - this.gtopMem.buffer - this.gtopMem.cached) / this.gtopMem.total;
		let cached = this.gtopMem.cached / this.gtopMem.total;
		let buffer = this.gtopMem.buffer / this.gtopMem.total;
		let free = this.gtopMem.free / this.gtopMem.total;
		let swap = this.gtopSwap.used / this.gtopSwap.total;
		if (isNaN(swap)) this.swapSize = 0; else this.swapSize = this.gtopSwap.total;
		this.currentReadings = [unavailableForUse, cached, buffer, free, swap];
	},
	
	data: function(longInfoTab = 2, longInfoSize = 5) {
		this._fetch_data();
		let overall = this.currentReadings[0] + this.currentReadings[1] + this.currentReadings[2];
		let longInfo =	" ".repeat(longInfoTab) + _("Used:   ") + align((this.currentReadings[0] * 100).toFixed(1), longInfoSize) + "%\n" +
						" ".repeat(longInfoTab) + _("Cache:  ") + align((this.currentReadings[1] * 100).toFixed(1), longInfoSize) + "%\n" +
						" ".repeat(longInfoTab) + _("Buffer: ") + align((this.currentReadings[2] * 100).toFixed(1), longInfoSize) + /*"%\n" +
						" ".repeat(longInfoTab) + _("Free:   ") + align((this.currentReadings[3] * 100).toFixed(1), longInfoSize) + */"%";
		if (this.swapSize) {
			longInfo += "\n" +
						" ".repeat(longInfoTab) + _("Swap:   ") + align((this.currentReadings[4] * 100).toFixed(1), longInfoSize) + "%";
		}
		return [(overall * 100).toFixed(0) + "%", longInfo];
	}
}
// </MemDataProvider>


//<NetDataProvider (based on Multi-Core System Monitor applet... thanks!)>
let new_NMClient = imports.gi.NM.Client.new;
//let CONNECTED_STATE = imports.gi.NM.DeviceState.ACTIVATED;

function NetDataProvider() {
	this._init();
}

NetDataProvider.prototype = {
	_init: function() {
		this.gtop = new GTop.glibtop_netload();
		this.nmClient = new_NMClient(null);
		this.signals = [
			this.nmClient.connect("device-added", () => this._get_devices()),
			this.nmClient.connect("device-removed", () => this._get_devices())
		];
		this.currentReadings = [];
		this.lastUpdatedTime = Date.now();
		this._get_devices();
	},
	
	_fetch_data: function() {
		const newUpdateTime = Date.now();
		const secondsSinceLastUpdate = (newUpdateTime - this.lastUpdatedTime) / 1000;
		for (let i = 0, len = this.currentReadings.length; i < len; i++) {
			GTop.glibtop_get_netload(this.gtop, this.currentReadings[i].id);
			this.currentReadings[i].down = this.gtop.bytes_in;
			this.currentReadings[i].up = this.gtop.bytes_out;
			this.currentReadings[i].downSpeed = (this.currentReadings[i].down - this.currentReadings[i].lastReading[0]) / secondsSinceLastUpdate;
			this.currentReadings[i].upSpeed = (this.currentReadings[i].up - this.currentReadings[i].lastReading[1]) / secondsSinceLastUpdate;
			this.currentReadings[i].lastReading[0] = this.currentReadings[i].down;
			this.currentReadings[i].lastReading[1] = this.currentReadings[i].up;
		}
		this.lastUpdatedTime = newUpdateTime;
	},
	
	_get_devices: function() {
		this.currentReadings = [];
		let devices = this.nmClient.get_devices();
		for (let i = 0, len = devices.length; i < len; i++) {
			devices[i] = devices[i].get_iface();
			GTop.glibtop_get_netload(this.gtop, devices[i]);
			this.currentReadings.push({
				id: devices[i],
				down: 0,
				up: 0,
				downSpeed: 0,
				upSpeed: 0,
				lastReading: [this.gtop.bytes_in, this.gtop.bytes_out]
			});
		}
		devices = null;
	},
	
	data: function(blackList = [], longInfoTab = 2, longInfoSize = 5) {
		this._fetch_data();
		let overallUpSpeed = 0, overallDownSpeed = 0, longInfo = "";
		idsLoop: for (let i = 0, len = this.currentReadings.length; i < len; i++) {
			for (let j = 0; j < blackList.length; j++) {
				if (blackList[j] == this.currentReadings[i].id.trim()) continue idsLoop;
			}
			longInfo += "\n<i>'" + this.currentReadings[i].id + "'</i>";
			longInfo += "\n" + " ".repeat(longInfoTab) + _("Up:      ") + align(this.format(this.currentReadings[i].upSpeed), longInfoSize) + _("B/s");
			longInfo += "\n" + " ".repeat(longInfoTab) + _("Down:    ") + align(this.format(this.currentReadings[i].downSpeed), longInfoSize) + _("B/s");
			longInfo += "\n" + " ".repeat(longInfoTab) + _("Data:    ") + align(this.format(this.currentReadings[i].up + this.currentReadings[i].down), longInfoSize) + _("B");
			overallUpSpeed += this.currentReadings[i].upSpeed;
			overallDownSpeed += this.currentReadings[i].downSpeed;
		}
		if (longInfo == "") longInfo = "\n(<i>" + _("no interfaces to show") + "</i>)";
		return [this.format(overallUpSpeed), this.format(overallDownSpeed), longInfo];
	},
	
	format: function(value) {
		const pref = [" ", _("k"), _("M"), _("G"), _("T")];
		let i = 0;
		while (i < 4 && value >= 10) {
			value /= 1000;
			i++;
		}
		return value.toFixed(2) + pref[i];
	},
	
	disconnectFromNM: function() {
		for (let i = 0; i < this.signals.length; i++) this.nmClient.disconnect(this.signals[i]);
	}
}
//</NetDataProvider>


function main(metadata, orientation, panel_height, instance_id) {
	return new SSMApplet(metadata, orientation, panel_height, instance_id);
}
