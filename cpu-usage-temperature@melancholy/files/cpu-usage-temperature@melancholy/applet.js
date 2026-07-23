const Applet = imports.ui.applet;
const ByteArray = imports.byteArray;
const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Pango = imports.gi.Pango;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

const UUID = "cpu-usage-temperature@melancholy";
const CPU_TEMP_LABELS = ["Tctl", "CPU Temperature"];

function CPUTemperatureApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

CPUTemperatureApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.TextApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        if (this.setAllowedLayout) {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        }

        this.cpuLabel = "CPU:";
        this.tempLabel = "Temp:";
        this.updateInterval = 2000;
        this.useFahrenheit = false;
        this.showDecimals = false;
        this.showUnitLetter = true;
        this.useSingleLineLayout = false;
        this.textAlign = "left";
        this.fontSize = 100;
        this.separator = " ";
        this.changeColor = true;
        this.onlyColors = false;
        this.highColor = "DarkOrange";
        this.criticalColor = "FireBrick";
        this.cpuUsage = null;
        this.lastCpu = null;
        this.temperature = null;
        this.highTemperature = null;
        this.criticalTemperature = null;
        this.temperatureItems = [];
        this.sensorsPath = GLib.find_program_in_path("sensors");
        this.waitForSensors = false;
        this.loopId = 0;

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bindProperty(Settings.BindingDirection.IN, "cpu-label", "cpuLabel", this._restartLoop, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "temp-label", "tempLabel", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "update-interval", "updateInterval", this._restartLoop, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "use-fahrenheit", "useFahrenheit", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-decimals", "showDecimals", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-unit-letter", "showUnitLetter", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "single-line-layout", "useSingleLineLayout", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "text-align", "textAlign", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "font-size", "fontSize", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "separator", "separator", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "change-color", "changeColor", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "only-colors", "onlyColors", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "high-color", "highColor", this._refreshLabel, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "critical-color", "criticalColor", this._refreshLabel, null);

        this._updateLabelStyle();
        this.set_applet_tooltip("CPU usage and temperature");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._restartLoop();
    },

    on_applet_clicked: function() {
        this._buildMenu();
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        if (this.loopId > 0) {
            Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;
        this.settings.finalize();
    },

    _restartLoop: function() {
        if (this.loopId > 0) {
            Mainloop.source_remove(this.loopId);
        }
        this.loopId = 0;
        this._update();
        this.loopId = Mainloop.timeout_add(this.updateInterval, Lang.bind(this, this._updateLoop));
    },

    _updateLoop: function() {
        this._update();
        return true;
    },

    _update: function() {
        this._updateCpuUsage();

        if (this.sensorsPath && !this.waitForSensors) {
            this.waitForSensors = true;
            Util.spawn_async([this.sensorsPath], Lang.bind(this, this._updateTemperatureFromSensors));
        } else if (!this.sensorsPath) {
            this._updateTemperatureFromFiles();
        }

        this._refreshLabel();
    },

    _updateCpuUsage: function() {
        let cpu = this._readCpuTimes();
        if (!cpu) {
            return;
        }

        if (this.lastCpu) {
            let totalDelta = cpu.total - this.lastCpu.total;
            let idleDelta = cpu.idle - this.lastCpu.idle;

            if (totalDelta > 0) {
                let usage = Math.round((1 - idleDelta / totalDelta) * 100);
                this.cpuUsage = Math.max(0, Math.min(100, usage));
            }
        }

        this.lastCpu = cpu;
    },

    _readCpuTimes: function() {
        let text = this._readFile("/proc/stat");
        if (!text) {
            return null;
        }

        let line = text.split("\n")[0];
        let fields = line.trim().split(/\s+/).slice(1).map(Number);
        if (fields.length < 4 || fields.some(isNaN)) {
            return null;
        }

        let idle = fields[3] + (fields[4] || 0);
        let total = fields.reduce(function(sum, value) {
            return sum + value;
        }, 0);

        return { idle: idle, total: total };
    },

    _updateTemperatureFromSensors: function(output) {
        let entries = this._parseSensorsOutput(output.toString());
        let selected = this._selectCpuTemperature(entries);

        if (selected !== null) {
            this.temperature = selected;
            this._updateThresholds(entries);
            this.temperatureItems = entries.map(function(entry) {
                return entry.label + ": " + this._formatTemperature(entry.value);
            }, this);
        } else {
            this._updateTemperatureFromFiles();
        }

        this.waitForSensors = false;
        this._refreshLabel();
    },

    _parseSensorsOutput: function(output) {
        let entries = [];
        let lines = output.split("\n");

        for (let i = 0; i < lines.length; i++) {
            let match = lines[i].match(/^\s*([^:]+):\s+\+?(-?\d+(?:\.\d+)?)\s*\u00b0[CF]/);
            if (!match) {
                continue;
            }

            let entry = {
                label: match[1].trim(),
                value: parseFloat(match[2])
            };

            let high = lines[i].match(/high\s*=\s*\+?(-?\d+(?:\.\d+)?)\s*\u00b0[CF]/);
            let critical = lines[i].match(/crit\s*=\s*\+?(-?\d+(?:\.\d+)?)\s*\u00b0[CF]/);
            if (high) {
                entry.high = parseFloat(high[1]);
            }
            if (critical) {
                entry.critical = parseFloat(critical[1]);
            }

            entries.push(entry);
        }

        return entries;
    },

    _selectCpuTemperature: function(entries) {
        if (entries.length === 0) {
            return null;
        }

        let packageValues = [];
        let coreValues = [];
        let preferred = null;

        for (let i = 0; i < entries.length; i++) {
            let label = entries[i].label;
            if (label.indexOf("Package") !== -1) {
                packageValues.push(entries[i].value);
            } else if (label.indexOf("Core") !== -1) {
                coreValues.push(entries[i].value);
            }

            if (CPU_TEMP_LABELS.indexOf(label) !== -1) {
                preferred = entries[i].value;
            }
        }

        if (packageValues.length > 0) {
            return this._average(packageValues);
        }
        if (preferred !== null) {
            return preferred;
        }
        if (coreValues.length > 0) {
            return this._average(coreValues);
        }
        return entries[0].value;
    },

    _updateTemperatureFromFiles: function() {
        let files = [
            "/sys/class/hwmon/hwmon0/temp1_input",
            "/sys/devices/platform/coretemp.0/temp1_input",
            "/sys/bus/acpi/devices/LNXTHERM:00/thermal_zone/temp",
            "/sys/devices/virtual/thermal/thermal_zone0/temp",
            "/sys/bus/acpi/drivers/ATK0110/ATK0110:00/hwmon/hwmon0/temp1_input",
            "/proc/acpi/thermal_zone/THM0/temperature",
            "/proc/acpi/thermal_zone/THRM/temperature",
            "/proc/acpi/thermal_zone/THR0/temperature",
            "/proc/acpi/thermal_zone/TZ0/temperature",
            "/sys/class/hwmon/hwmon0/device/temp1_input"
        ];

        for (let i = 0; i < files.length; i++) {
            let value = this._readTemperatureFile(files[i]);
            if (value !== null) {
                this.temperature = value;
                this.highTemperature = null;
                this.criticalTemperature = this._readCriticalTemperatureFromFiles();
                this.temperatureItems = ["Current temperature: " + this._formatTemperature(value)];
                return;
            }
        }
    },

    _updateThresholds: function(entries) {
        let thresholdSource = null;

        for (let i = 0; i < entries.length; i++) {
            let label = entries[i].label;
            if (label.indexOf("Package") !== -1 || CPU_TEMP_LABELS.indexOf(label) !== -1) {
                thresholdSource = entries[i];
                break;
            }
            if (!thresholdSource && (label.indexOf("Core") !== -1 || entries[i].high || entries[i].critical)) {
                thresholdSource = entries[i];
            }
        }

        this.highTemperature = thresholdSource && thresholdSource.high ? thresholdSource.high : null;
        this.criticalTemperature = thresholdSource && thresholdSource.critical ? thresholdSource.critical : null;
    },

    _readCriticalTemperatureFromFiles: function() {
        let files = [
            "/sys/devices/platform/coretemp.0/temp1_crit",
            "/sys/bus/acpi/drivers/ATK0110/ATK0110:00/hwmon/hwmon0/temp1_crit",
            "/sys/class/hwmon/hwmon0/temp1_crit",
            "/sys/class/hwmon/hwmon0/device/temp1_crit"
        ];

        for (let i = 0; i < files.length; i++) {
            let value = this._readTemperatureFile(files[i]);
            if (value !== null) {
                return value;
            }
        }
        return null;
    },

    _readTemperatureFile: function(path) {
        let text = this._readFile(path);
        if (!text) {
            return null;
        }

        let match = text.match(/-?\d+(?:\.\d+)?/);
        if (!match) {
            return null;
        }

        let value = parseFloat(match[0]);
        if (Math.abs(value) > 1000) {
            value = value / 1000;
        }
        return value;
    },

    _readFile: function(path) {
        try {
            if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
                return null;
            }

            let result = GLib.file_get_contents(path);
            if (!result[0]) {
                return null;
            }
            return ByteArray.toString(result[1]).trim();
        } catch (e) {
            return null;
        }
    },

    _refreshLabel: function() {
        let cpu = this.cpuUsage === null ? "--" : this.cpuUsage.toString();
        let temp = this.temperature === null ? "--" : this._formatTemperature(this.temperature);
        let status = this._temperatureStatus();
        let cpuLine = this.cpuLabel + " " + cpu + "%";
        let tempLine = this._valueLine(this.tempLabel, temp);
        let statusLabel = this._statusLabel(status);
        let label;

        if (!this.changeColor) {
            this.onlyColors = false;
        }

        if (this.useSingleLineLayout) {
            label = cpuLine + this.separator + tempLine;
            if (status && !this.onlyColors) {
                label = label + " " + statusLabel;
            }
        } else {
            if (status && !this.onlyColors) {
                tempLine = tempLine + " " + statusLabel;
            }
            label = cpuLine + "\n" + tempLine;
        }

        this.actor.style = this._alertStyle(status);
        this.set_applet_label(label);
        this._updateLabelStyle();
    },

    _updateLabelStyle: function() {
        this._applet_label.set_style("text-align: " + this._textAlign() + "; line-height: 1.05em; font-size: " + this._fontSize() + "%;");
        if (this._applet_label.clutter_text) {
            if (this._applet_label.clutter_text.set_line_alignment) {
                this._applet_label.clutter_text.set_line_alignment(this._pangoAlign());
            } else if ("line_alignment" in this._applet_label.clutter_text) {
                this._applet_label.clutter_text.line_alignment = this._pangoAlign();
            }
        }
    },

    _textAlign: function() {
        if (this.textAlign === "center" || this.textAlign === "right") {
            return this.textAlign;
        }
        return "left";
    },

    _pangoAlign: function() {
        if (this.textAlign === "center") {
            return Pango.Alignment.CENTER;
        }
        if (this.textAlign === "right") {
            return Pango.Alignment.RIGHT;
        }
        return Pango.Alignment.LEFT;
    },

    _fontSize: function() {
        let size = parseInt(this.fontSize);
        if (isNaN(size)) {
            return 100;
        }
        return Math.max(50, Math.min(200, size));
    },

    _statusLabel: function(status) {
        if (status === "critical") {
            return "Critical";
        }
        if (status === "high") {
            return "High";
        }
        return "";
    },

    _valueLine: function(label, value) {
        if (!label) {
            return value;
        }
        return label + " " + value;
    },

    _temperatureStatus: function() {
        if (this.temperature === null) {
            return null;
        }
        if (this.criticalTemperature !== null && this.temperature >= this.criticalTemperature) {
            return "critical";
        }
        if (this.highTemperature !== null && this.temperature >= this.highTemperature) {
            return "high";
        }
        return null;
    },

    _alertStyle: function(status) {
        if (!this.changeColor) {
            return "";
        }
        if (status === "critical") {
            return "background: " + this._colorString(this.criticalColor, "FireBrick") + ";";
        }
        if (status === "high") {
            return "background: " + this._colorString(this.highColor, "DarkOrange") + ";";
        }
        return "";
    },

    _colorString: function(color, fallback) {
        if (!color) {
            return fallback;
        }
        return color.toString();
    },

    _formatTemperature: function(value) {
        let unit = "C";
        let temp = value;
        if (this.useFahrenheit) {
            temp = value * 9 / 5 + 32;
            unit = "F";
        }

        let decimals = this.showDecimals ? 1 : 0;
        let label = temp.toFixed(decimals);
        if (this.showUnitLetter) {
            return label + "\u00b0" + unit;
        }
        return label + "\u00b0";
    },

    _average: function(values) {
        let total = values.reduce(function(sum, value) {
            return sum + value;
        }, 0);
        return total / values.length;
    },

    _buildMenu: function() {
        this.menu.removeAll();

        let section = new PopupMenu.PopupMenuSection("CPU Usage and Temperature");
        section.addMenuItem(new PopupMenu.PopupMenuItem("CPU usage: " + (this.cpuUsage === null ? "--" : this.cpuUsage + "%")));

        if (this.temperatureItems.length > 0) {
            for (let i = 0; i < this.temperatureItems.length; i++) {
                section.addMenuItem(new PopupMenu.PopupMenuItem(this.temperatureItems[i]));
            }
        } else {
            section.addMenuItem(new PopupMenu.PopupMenuItem("Temperature: --"));
        }

        if (this.highTemperature !== null || this.criticalTemperature !== null) {
            section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            section.addMenuItem(new PopupMenu.PopupMenuItem("Thresholds Info:"));
            if (this.highTemperature !== null) {
                section.addMenuItem(new PopupMenu.PopupMenuItem("  High Temp: " + this._formatTemperature(this.highTemperature)));
            }
            if (this.criticalTemperature !== null) {
                section.addMenuItem(new PopupMenu.PopupMenuItem("  Crit. Temp: " + this._formatTemperature(this.criticalTemperature)));
            }
        }

        this.menu.addMenuItem(section);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let systemMonitor = new PopupMenu.PopupMenuItem("Open System Monitor");
        systemMonitor.connect("activate", Lang.bind(this, this._openSystemMonitor));
        this.menu.addMenuItem(systemMonitor);
    },

    _openSystemMonitor: function() {
        let appSystem = Cinnamon.AppSystem.get_default();
        let app = appSystem.lookup_app("org.gnome.SystemMonitor.desktop") || appSystem.lookup_app("gnome-system-monitor.desktop");
        if (app) {
            app.activate();
        }
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new CPUTemperatureApplet(metadata, orientation, panelHeight, instanceId);
}
