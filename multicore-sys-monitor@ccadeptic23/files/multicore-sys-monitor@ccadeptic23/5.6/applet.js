//!/usr/bin/cjs
const DEBUG = false;
const TESTING = false;
const nb_colors = 32;

const Gettext = imports.gettext;
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const appSystem = imports.gi.Cinnamon.AppSystem.get_default();
const windowTracker = imports.gi.Cinnamon.WindowTracker.get_default();
const Util = imports.misc.util;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const {
  reloadExtension,
  Type
} = imports.ui.extension; //Extension

const { to_string } = require("./lib/tostring");
const { readFileAsync } = require("./lib/readFileAsync");
const Graphs = require('./lib/Graphs');
const {
  timeout_add,
  setTimeout,
  clearTimeout,
  source_exists,
  source_remove,
  remove_all_sources } = require("./lib/mainloopTools");

const UUID = 'multicore-sys-monitor@ccadeptic23';
const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const PATH2SCRIPTS = APPLET_DIR + "/scripts";
const XDG_RUNTIME_DIR = GLib.getenv("XDG_RUNTIME_DIR");
const NETWORK_DEVICES_STATUS_PATH = XDG_RUNTIME_DIR + "/network_devices";

const POWER_SUPPLY_PATH = "/sys/class/power_supply";

const rate = _('/s');
var spaces = 16;
const translated_strings = [
    _("Core 128:"),
    _("Unrecoverable:"),
    _("Recoverable:"),
    _("Used:"),
    _("Usedup:"),
    _("Free:"),
    _("Swap"),
    _("Swap:"),
    _("Down:"),
    _("Up:"),
    _("Read:"),
    _("Write:"),
    _("Load:"),
    _("Unload:")
];
for (let s of translated_strings) {
    let l = s.length + 1;
    if (l > spaces)
        spaces = l;
}

const properties = [
    {graph: "multiCpuGraph", provider: "multiCpuProvider", abbrev: "CPU"},
    {graph: "memoryGraph", provider: "memoryProvider", abbrev: "Mem"},
    {graph: "swapGraph", provider: "swapProvider", abbrev: "Swap"},
    {graph: "networkGraph", provider: "networkProvider", abbrev: "Net"},
    {graph: "diskGraph", provider: "diskProvider", abbrev: "Disk"},
    {graph: "diskUsageGraph", provider: "diskUsageProvider", abbrev: "DiskUsage"},
    //~ {graph: "diskUsageGraph", provider: "diskUsageProvider", abbrev: "DiskUsage"} //,
    {graph: "batteryGraph", provider: "batteryProvider", abbrev: "Battery"}
];

const orig_names = [
    _("CPU"),
    _("MEM"),
    _("NET"),
    _("DISK"),
    _("DISK USAGE"),
    _("BATTERY")
];
const orig_charts = [
    [properties[0]],
    [properties[1], properties[2]],
    [properties[3]],
    [properties[4]],
    [properties[5]],
    [properties[6]]
];

function conf2json(str) {
    var _json = {};
    var lines = str.split("\n");
    for (let line of lines) {
        let [varName, varValue] = line.split("=");
        _json[varName] = varValue;
    }
    return _json;
}

function get_nemo_size_prefixes() {
    let _SETTINGS_SCHEMA='org.nemo.preferences';
    let _SETTINGS_KEY = 'size-prefixes';
    let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
    return _interface_settings.get_string(_SETTINGS_KEY)
}

const _get_lang = () => {
    if (GLib.getenv("LC_NUMERIC")) {
        return GLib.getenv("LC_NUMERIC").split(".")[0].replace("_", "-")
    } else if (GLib.getenv("LANG")) {
        return GLib.getenv("LANG").split(".")[0].replace("_", "-")
    } else if (GLib.getenv("LANGUAGE")) {
        return GLib.getenv("LANGUAGE").replace("_", "-")
    }
    return "en-US"
}

const formatNumber = (value, decimals=2) => {
    if (typeof(value) === "string")
        value = parseFloat(value, decimals);
    if (typeof(value) === "number") {
        if (_get_lang() === "C") return ""+value.toFixed(decimals);

        return ""+new Intl.NumberFormat(
            _get_lang(),
            { minimumIntegerDigits: 1, minimumFractionDigits: decimals, maximumFractionDigits: decimals },
        ).format(value.toFixed(decimals));
    } else {
        return ""+value.toFixed(decimals);
    }
}


const formatBytesValueUnit = (bytes, decimals=2, withRate=true) => {
    let _rate = (withRate === true) ? rate : "";
    if (bytes < 1) {
        return '0'.padStart(spaces/2 - 1) + '.00'.padEnd(spaces/2 - 1) + 'B'.padStart(3, ' ') + _rate;
    }
    let dm = (decimals + 1) || 3;
    let isBinary = get_nemo_size_prefixes().startsWith('base-2');
    let k, sizes, i;
    if (!isBinary) {
        k = 1000;
        sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        i = Math.min(Math.max(0, Math.trunc(Math.log10(bytes) / 3)), 8); // Math.log10(k) = 3.
    } else {
        k = 1024;
        sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
        i = Math.min(Math.max(0, Math.trunc(Math.log2(bytes) / 10)), 8); // Math.log2(k) = 10.
    }
    let value;
    if (isNaN(i)) {
        i = 0;
        value = "0";
    } else {
        value = (bytes / Math.pow(k, i)).toPrecision(dm).toString();
    }

    return [value, sizes[i] + _rate];
}



Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans.length > 0 && customTrans !== str)
        return customTrans;
    return Gettext.gettext(str);
}

class MCSM extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.orientation = orientation;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;
        this.instance_id = instance_id;

        this.hyperThreadingIsOn = false;
        readFileAsync("/sys/devices/system/cpu/smt/control").then( (status) => {
            let _status = status.trim();
            // _status yields: on|off|forceoff|notsupported|notimplemented
            this.hyperThreadingIsOn = _status.includes("on");
        });

        Util.spawnCommandLineAsync("/usr/bin/env bash -c 'cd %s && chmod 755 *.sh'".format(PATH2SCRIPTS));

        this.monitors = [];
        this.netMonitor = null;
        this.isCurrentlyCheckingStatus = false;

        this.mainLoopId = null;

        this.settings = new AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("isHighlighted", "isHighlighted");
        this.settings.bind("percentFontFactor", "percentFontFactor");
        this.settings.bind("flowFontFactor", "flowFontFactor");
        this.settings.bind("CPU_useProgressiveColors", "CPU_useProgressiveColors");
        this.settings.bind("CPU_byActivity", "CPU_byActivity", () => { this.on_CPU_byActivity_changed(); });
        this.settings.bind("Net_devicesList", "Net_devicesList");
        this.settings.bind("Disk_devicesList", "Disk_devicesList");
        this.settings.bind("labelsOn", "labelsOn");
        this.settings.bind("borderOn", "borderOn");
        this.settings.bind("borderRadius", "borderRadius");
        this.settings.bind("graphStep", "graphStep");
        this.settings.bind("graphSpacing", "graphSpacing");
        this.settings.bind("percentAtEndOfLine", "percentAtEndOfLine");
        this.settings.bind("tooltipFontSize", "tooltipFontSize", () => { this.setTooltipStyle(); });
        this.setTooltipStyle();
        this.settings.bind("CPU_labelOn", "CPU_labelOn");
        this.settings.bind("CPU_labelForeground", "CPU_labelForeground");
        this.settings.bind("Mem_labelOn", "Mem_labelOn");
        this.settings.bind("Mem_labelForeground", "Mem_labelForeground");
        this.settings.bind("Net_labelOn", "Net_labelOn");
        this.settings.bind("Net_labelForeground", "Net_labelForeground");
        this.settings.bind("Disk_labelOn", "Disk_labelOn");
        this.settings.bind("Disk_labelForeground", "Disk_labelForeground");
        this.settings.bind("CPU_labelPos", "CPU_labelPos");
        this.settings.bind("CPU_labelZoom", "CPU_labelZoom");
        this.settings.bind("Mem_labelPos", "Mem_labelPos");
        this.settings.bind("Mem_labelZoom", "Mem_labelZoom");
        this.settings.bind("Net_labelPos", "Net_labelPos");
        this.settings.bind("Net_labelZoom", "Net_labelZoom");
        this.settings.bind("Disk_labelPos", "Disk_labelPos");
        this.settings.bind("Disk_labelZoom", "Disk_labelZoom");
        this.settings.bind("CPU_labelCustomized", "CPU_labelCustomized");
        this.settings.bind("Mem_labelCustomized", "Mem_labelCustomized");
        this.settings.bind("Net_labelCustomized", "Net_labelCustomized");
        this.settings.bind("Disk_labelCustomized", "Disk_labelCustomized");
        this.settings.bind("CPU_labelCustom", "CPU_labelCustom");
        this.settings.bind("Mem_labelCustom", "Mem_labelCustom");
        this.settings.bind("Net_labelCustom", "Net_labelCustom");
        this.settings.bind("Disk_labelCustom", "Disk_labelCustom");
        this.settings.bind("thickness", "thickness");
        this.settings.bind("ledForCurves", "led");
        this.settings.bind("ledLocation", "ledLocation");
        this.settings.bind("useIconSize", "useIconSize", () => { this.set_panelHeight(); });
        this.settings.bind("graphHeightPercent", "graphHeightPercent", () => { this.set_panelHeight(); });
        this.settings.bind("graphHeight", "graphHeight");
        this.settings.bind("refreshRate", "refreshRate", () => { this.run_main_loop(); });
        this.settings.bind("labelColor", "labelColor");
        this.settings.bind("borderColor", "borderColor");
        this.settings.bind("backgroundColor", "backgroundColor");
        this.settings.bind("displayOrder", "displayOrder");
        this.controlDisplayOrder();
        this.settings.bind("CPU_enabled", "CPU_enabled");
        this.settings.bind("CPU_enabledTooltip", "CPU_enabledTooltip");
        this.settings.bind("CPU_squared", "CPU_squared");
        this.settings.bind("CPU_showTemp", "CPU_showTemp");
        this.settings.bind("CPU_temp_hovering_only", "CPU_temp_hovering_only");
        this.settings.bind("CPU_tempInFahrenheit", "CPU_tempInFahrenheit");
        this.settings.bind("CPU_tempPath", "CPU_tempPath");
        this.settings.bind("CPU_tempHigh", "CPU_tempHigh");
        this.settings.bind("CPU_tempCrit", "CPU_tempCrit");
        this.settings.bind("CPU_tempColor", "CPU_tempColor");
        this.settings.bind("CPU_tempColorHigh", "CPU_tempColorHigh");
        this.settings.bind("CPU_tempColorCrit", "CPU_tempColorCrit");
        this.settings.bind("CPU_tempCorner", "CPU_tempCorner");
        this.settings.bind("CPU_tempFontFactor", "CPU_tempFontFactor");
        this.settings.bind("CPU_width", "CPU_width", () => { this.adjust_CPU_width() });
        this.settings.bind("CPU_mergeAll", "CPU_mergeAll", (value) => {
            if (value === false) {
                this.CPU_showLoadOverTime = false;
                this.CPU_ignoreHyperthreading = false;
            }
        });
        this.settings.bind("CPU_ignoreHyperthreading", "CPU_ignoreHyperthreading", (value) => {
            if (value === false) this.CPU_showLoadOverTime = false;
        });
        this.settings.bind("CPU_showLoadOverTime", "CPU_showLoadOverTime", (value) => {
            if (value === true) {
                this.CPU_ignoreHyperthreading = true;
                this.CPU_byActivity = true;
            }
        });
        this.settings.bind("CPU_showLoadOverTimeHowManyBars", "CPU_showLoadOverTimeHowManyBars", () => { this.refreshAll() });
        this.settings.bind("CPU_color0", "CPU_color0");
        this.settings.bind("CPU_color1", "CPU_color1");
        this.settings.bind("CPU_color2", "CPU_color2");
        this.settings.bind("CPU_color3", "CPU_color3");
        this.settings.bind("CPU_activity_0_20", "CPU_activity_0_20");
        this.settings.bind("CPU_activity_20_40", "CPU_activity_20_40");
        this.settings.bind("CPU_activity_40_60", "CPU_activity_40_60");
        this.settings.bind("CPU_activity_60_80", "CPU_activity_60_80");
        this.settings.bind("CPU_activity_80_100", "CPU_activity_80_100");
        this.settings.bind("Mem_enabled", "Mem_enabled");
        this.settings.bind("Mem_onlyUsedAvailable", "Mem_onlyUsedAvailable");
        this.settings.bind("Mem_enabledTooltip", "Mem_enabledTooltip");
        this.settings.bind("Mem_enabledBufferCacheSharedTooltip", "Mem_enabledBufferCacheSharedTooltip");
        this.settings.bind("Swap_enabled", "Swap_enabled");
        this.settings.bind("Swap_enabledTooltip", "Swap_enabledTooltip");
        this.settings.bind("Mem_chartType", "Mem_chartType");
        this.settings.bind("Mem_squared", "Mem_squared");
        this.settings.bind("Mem_method", "Mem_method");
        this.settings.bind("Mem_width", "Mem_width", () => { this.adjust_Mem_width() });
        this.settings.bind("Mem_startAt12Oclock", "Mem_startAt12Oclock");
        this.settings.bind("Mem_showBytesInTooltip", "Mem_showBytesInTooltip");
        this.settings.bind("Mem_value_display", "Mem_value_display");
        this.settings.bind("Mem_valueCorner", "Mem_valueCorner");
        this.settings.bind("Mem_colorUsedup", "Mem_colorUsedup");
        this.settings.bind("Mem_colorCache", "Mem_colorCache");
        this.settings.bind("Mem_colorBuffers", "Mem_colorBuffers");
        this.settings.bind("Mem_colorFree", "Mem_colorFree");
        this.settings.bind("Mem_colorSwap", "Mem_colorSwap");
        this.settings.bind("Mem_swapWidth", "Mem_swapWidth");
        this.settings.bind("Net_enabled", "Net_enabled");
        this.settings.bind("Net_enabledTooltip", "Net_enabledTooltip");
        this.settings.bind("Net_squared", "Net_squared", (value) => {
            if (value === true) this.Net_total_display = false;
        });
        this.settings.bind("Net_width", "Net_width", () => { this.adjust_Net_width() });
        this.settings.bind("Net_mergeAll", "Net_mergeAll");
        this.settings.bind("Net_typeOfGraph", "Net_typeOfGraph");
        this.settings.bind("Net_autoscale", "Net_autoscale");
        this.settings.bind("Net_logscale", "Net_logscale");
        this.settings.bind("Net_total_type", "Net_total_type");
        this.settings.bind("Net_total_display", "Net_total_display", () => { this.adjust_Net_width() });
        this.settings.bind("Net_total_hovering_only", "Net_total_hovering_only");
        this.settings.bind("Net_totalCorner", "Net_totalCorner", () => { this.adjust_Net_width() });
        this.settings.bind("Net_symbolsInTooltip", "Net_symbolsInTooltip");
        this.settings.bind("Disk_enabled", "Disk_enabled");
        this.settings.bind("Disk_enabledTooltip", "Disk_enabledTooltip");
        this.settings.bind("Disk_squared", "Disk_squared", (value) => {
            if (value === true) this.Disk_speed_display = false;
        });
        this.settings.bind("Disk_width", "Disk_width", () => { this.adjust_Disk_width() });
        this.settings.bind("Disk_mergeAll", "Disk_mergeAll");
        this.settings.bind("Disk_typeOfGraph", "Disk_typeOfGraph");
        this.settings.bind("Disk_autoscale", "Disk_autoscale");
        this.settings.bind("Disk_logscale", "Disk_logscale");
        this.settings.bind("Disk_symbolsInTooltip", "Disk_symbolsInTooltip");
        this.settings.bind("Disk_speed_display", "Disk_speed_display");
        this.settings.bind("Disk_speed_hovering_only", "Disk_speed_hovering_only");
        this.settings.bind("Disk_speedCorner", "Disk_speedCorner", () => { this.adjust_Disk_width() });
        this.settings.bind("DiskUsage_enabled", "DiskUsage_enabled");
        this.settings.bind("DiskUsage_enabledTooltip", "DiskUsage_enabledTooltip");
        this.settings.bind("DiskUsage_labelOn", "DiskUsage_labelOn");
        this.settings.bind("DiskUsage_labelForeground", "DiskUsage_labelForeground");
        this.settings.bind("DiskUsage_labelPos", "DiskUsage_labelPos");
        this.settings.bind("DiskUsage_labelZoom", "DiskUsage_labelZoom");
        this.settings.bind("DiskUsage_labelCustomized", "DiskUsage_labelCustomized");
        this.settings.bind("DiskUsage_labelCustom", "DiskUsage_labelCustom");
        this.settings.bind("DiskUsage_squared", "DiskUsage_squared");
        this.settings.bind("DiskUsage_width", "DiskUsage_width", () => { this.adjust_DiskUsage_width() });
        this.settings.bind("DiskUsage_mergeAll", "DiskUsage_mergeAll");
        this.settings.bind("DiskUsage_value_display", "DiskUsage_value_display");
        this.settings.bind("DiskUsage_valueCorner", "DiskUsage_valueCorner");
        this.settings.bind("DiskUsage_colorUsed", "DiskUsage_colorUsed");
        this.settings.bind("DiskUsage_colorFree", "DiskUsage_colorFree");
        this.settings.bind("DiskUsage_colorAlert", "DiskUsage_colorAlert");
        this.settings.bind("DiskUsage_pathList", "DiskUsage_pathList");
        this.settings.bind("Battery_enabled", "Battery_enabled");
        this.settings.bind("Battery_enabledTooltip", "Battery_enabledTooltip");
        this.settings.bind("Battery_labelOn", "Battery_labelOn");
        this.settings.bind("Battery_labelForeground", "Battery_labelForeground");
        this.settings.bind("Battery_labelPos", "Battery_labelPos");
        this.settings.bind("Battery_labelZoom", "Battery_labelZoom");
        this.settings.bind("Battery_labelCustomized", "Battery_labelCustomized");
        this.settings.bind("Battery_labelCustom", "Battery_labelCustom");
        this.settings.bind("Battery_squared", "Battery_squared");
        this.settings.bind("Battery_width", "Battery_width", () => { this.adjust_Battery_width() });
        this.settings.bind("Battery_mergeAll", "Battery_mergeAll");
        this.settings.bind("Battery_value_display", "Battery_value_display");
        this.settings.bind("Battery_valueCorner", "Battery_valueCorner");
        this.settings.bind("Battery_colorLoad", "Battery_colorLoad");
        this.settings.bind("Battery_colorUnload", "Battery_colorUnload");
        this.settings.bind("Battery_colorAlert", "Battery_colorAlert");
        this.settings.bind("Battery_devicesList", "Battery_devicesList");

        for (let i=0; i<nb_colors; i++)
            this.settings.bind(`color${i}`, `color${i}`, () => { this.on_color_changed() });

        var nb_battery = 0;
        for (let b of this.Battery_devicesList) nb_battery += 1;
        if (nb_battery === 0) this.on_Battery_getdevlist_btn_clicked();

        var nb_diskusage = 0;
        for (let d of this.DiskUsage_pathList) nb_diskusage += 1;
        if (nb_diskusage === 0) this.on_DiskUsage_getpathlist_btn_clicked();

        var nb_diskdev = 0;
        for (let d of this.Disk_devicesList) nb_diskdev += 1;
        if (nb_diskdev === 0) this.on_Disk_getdevlist_btn_clicked();

        var nb_netdev = 0;
        for (let d of this.Net_devicesList) nb_netdev += 1;
        if (nb_netdev === 0) this.on_Net_getdevlist_btn_clicked();

        this.battery_energy = {};
        this.battery_capacity = {};
        for (let b of this.Battery_devicesList) {
            let _id = b["id"];
            if (_id.length === 0) continue;
            this.battery_energy[_id] = [100, 50];
            this.battery_usage(_id);
            this.battery_capacity[_id] = [100, 50];
            this.battery_health(_id);
        }

        this.on_color_changed();
        this.useSymbolicIcon = true;
        if (this.without_any_graph)
            this.setIcon();

        this.set_panelHeight();


        // Is the user a sudoer?
        var user = GLib.get_user_name();
        let command = PATH2SCRIPTS + "/get-sudoers.sh";
        this.is_sudoer = false;
        let sudoersProcess = Util.spawnCommandLineAsyncIO(command, (stdout, stderr, exitCode) => {
            if (exitCode == 0) {
                let list = stdout.trim().split(",");
                if (list.indexOf(user) > -1) {
                    this.is_sudoer = true;
                }
                this._initContextMenu();
            } else {
                this._initContextMenu();
            }
            sudoersProcess.send_signal(9);
        });

        this.oldCPUvalues = [];
        this.oldCPU_Total_Values = [];
        this.oldCPU_Idle_Values = [];

        this.hovered = false;
        this.actor.connect('enter-event', (actor, event) => {
            this.hovered = true;
            // Work around hovering over a PangoCairo canvas instance triggering a false positive panel leave event
            if (this.panel._autohideSettings !== 'false') {
                this.originalAutoHideSetting = this.panel._autohideSettings;
                this.panel._autohideSettings = 'true';
                this.panel._updatePanelVisibility();
            }
        });
        this.actor.connect('leave-event', (actor, event) => {
            this.hovered = false;
            if (this.originalAutoHideSetting) {
                this.panel._autohideSettings = this.originalAutoHideSetting;
                this.originalAutoHideSetting = null;
            }
        });

        this.isRunning = false;

        this.memoryProvider = new MemDataProvider(this);
        this.multiCpuProvider = new MultiCpuDataProvider(this);
        this.swapProvider = new SwapDataProvider(this);
        this.buffcachesharedProvider = new BufferCacheSharedDataProvider(this);
        this.lastDataNet = {};
        this.networkProvider = new NetDataProvider(this);
        this.diskProvider = new DiskDataProvider(this);
        this.diskUsageProvider = new DiskUsageDataProvider(this);
        this.batteryProvider = new BatteryDataProvider(this);

        this._initContextMenu();

        this.graphArea = new St.DrawingArea();
        this.graphArea.width = 1;
        this.graphArea.height = this.panelHeight;

        this.multiCpuGraph = new Graphs.GraphVBars(this.graphArea, this);
        this.memoryGraph = new Graphs.GraphPieChart(this.graphArea, this);
        this.swapGraph = new Graphs.GraphVBars(this.graphArea, this);

        this.networkGraph = new Graphs.GraphLineChart(this.graphArea, this.Net_width, this);
        //For us this means the heighest point wont represent a valuelower than 1Kb/s
        this.networkGraph.autoScale = this.Net_autoscale;
        this.networkGraph.logScale = this.Net_logscale;

        this.diskGraph = new Graphs.GraphLineChart(this.graphArea, this.Disk_width, this);
        this.diskGraph.autoScale = this.Disk_autoscale;
        this.diskGraph.logScale = this.Disk_logscale;

        this.diskUsageGraph = new Graphs.GraphVBars100(this.graphArea, this);

        this.batteryGraph = new Graphs.GraphVBars100(this.graphArea, this);

        this.actor.add_actor(this.graphArea);
        this.graphArea.connect('repaint', (area) => this.onGraphRepaint(area));
    }

    setTooltipStyle() {
        const fontSize = (this.tooltipFontSize != null) ? this.tooltipFontSize : 16;
        if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
            this._applet_tooltip._tooltip.set_style(`text-align: right; font-family: monospace; font-size: ${fontSize}px;`);
        } else {
            this._applet_tooltip._tooltip.set_style(`text-align: left; font-family: monospace; font-size: ${fontSize}px;`);
        }
    }

    controlDisplayOrder(reinit=false) {
        var displayOrder = [];
        var order = [];
        if (!reinit) {
            for (let d of this.displayOrder) {
                let section = d["id"];
                if (order.indexOf(section) < 0 && orig_names.indexOf(section) >= 0) order.push(section);
            }
            if (order.length < orig_names.length) {
                for (let name of orig_names) {
                    if (order.indexOf(name) < 0 ) order.push(name);
                }
            }
        } else {
            order = orig_names;
        }

        for (let name of order)
            displayOrder.push({"id": name});

        let _to = setTimeout( () => {
            clearTimeout(_to);
            this.displayOrder = displayOrder;
        }, 0);
    }

    reinitDisplayOrder() {
        this.controlDisplayOrder(true);
    }

    adjust_CPU_width() {
        if (this.graphStep === 1) return;
        let CPU_width = Math.max(
            //~ Math.min(this.graphStep, 16),
            1,
            Math.round(this.CPU_width / this.graphStep) * this.graphStep
        );
        this.CPU_width = CPU_width;
    }

    adjust_Mem_width() {
        if (this.graphStep === 1) return;
        let Mem_width = Math.max(
            //~ Math.min(this.graphStep, 16),
            1,
            Math.round(this.Mem_width / this.graphStep) * this.graphStep
        );
        this.Mem_width = Mem_width;
    }

    adjust_Net_width() {
        let Net_width = this.Net_width;
        if (this.graphStep !== 1) {
            Net_width = Math.max(
                1,
                Math.round(this.Net_width / this.graphStep) * this.graphStep
            );
        }
        if (this.Net_total_display && this.Net_totalCorner.includes("O") && Net_width < 80)
            Net_width = 80;
        if (this.Net_total_display && !this.Net_totalCorner.includes("O") && Net_width < 160)
            Net_width = 160;
        this.Net_width = Net_width;
    }

    adjust_Disk_width() {
        let Disk_width = this.Disk_width;
        if (this.graphStep !== 1) {
            Disk_width = Math.max(
                1,
                Math.round(this.Disk_width / this.graphStep) * this.graphStep
            );
        }
        if (this.Disk_speed_display && this.Disk_speedCorner.includes("O") && Disk_width < 80)
            Disk_width = 80;
        if (this.Disk_speed_display && !this.Disk_speedCorner.includes("O") && Disk_width < 160)
            Disk_width = 160;
        this.Disk_width = Disk_width;
    }

    adjust_DiskUsage_width() {
        if (this.graphStep === 1) return;
        let DiskUsage_width = Math.max(
            //~ Math.min(this.graphStep, 16),
            1,
            Math.round(this.DiskUsage_width / this.graphStep) * this.graphStep
        );
        this.DiskUsage_width = DiskUsage_width;
    }

    adjust_Battery_width() {
        if (this.graphStep === 1) return;
        let Battery_width = Math.max(
            //~ Math.min(this.graphStep, 16),
            1,
            Math.round(this.Battery_width / this.graphStep) * this.graphStep
        );
        this.Battery_width = Battery_width;
    }

    on_apply_width_multiple() {
        this.adjust_CPU_width();
        this.adjust_Mem_width();
        this.adjust_Net_width();
        this.adjust_Disk_width();
        this.adjust_DiskUsage_width();
    }

    set_panelHeight() {
        this.iconSize = this.getPanelIconSize(St.IconType.FULLCOLOR);
        if (this.useIconSize) {
            this.panelHeight = this.iconSize * global.ui_scale;
        } else if (this.graphHeightPercent) {
            this.graphHeight = Math.ceil(this._panelHeight * this.graphHeightPercent / 100);

            this.panelHeight = this.graphHeight; // * global.ui_scale
        } else {
            this.panelHeight = this._panelHeight;
        }
        if (this.graphArea) {
            this.graphArea.height = this.panelHeight;
            this.graphArea.queue_repaint();
        }
    }

    run_main_loop() {
        if (this.mainLoopId != null && source_exists(this.mainLoopId)) {
            this.isRunning = false;
            if (source_exists(this.mainLoopId))
                source_remove(this.mainLoopId);
            this.mainLoopId = null;
        }
        this.isRunning = true;
        const rate = 1 * this.refreshRate;
        this.mainLoopId = timeout_add(rate, () => {
            this.get_mem_info();
            this.get_cpu_info();
            this.get_net_info();
            this.get_disk_info();
            this.get_disk_usage();
            this.get_battery_usage();
            this._setTooltip();
            try {
                if (this.graphArea && this.graphArea.queue_repaint)
                    this.graphArea.queue_repaint();
                else
                    this.refreshAll();
            } catch(e) {
                this.refreshAll();
            }
            return this.isRunning;
        });
    }

    onGraphRepaint(area) {
        this._isHighlighted;
        if (this.without_any_graph) return;
        let xOffset = 0;
        let yOffset = Math.max(0, Math.trunc((this._panelHeight - this.panelHeight) / 2));
        var order = [];
        var _properties = [];
        for (let o of this.displayOrder){
            let box = o["id"];
            if (order.indexOf(box) < 0 && orig_names.indexOf(box) >= 0) {
                order.push(box);
                let index = orig_names.indexOf(box);
                _properties = _properties.concat(orig_charts[index]);
            }
        };

        for (let i = 0, len = _properties.length; i < len; i++) {
            if (_properties[i].abbrev === 'Swap') {
                continue;
            }
            if (this[_properties[i].provider].isEnabled) {
                // translate origin to the new location for the graph
                let areaContext = area.get_context();
                areaContext.translate(xOffset, yOffset);
                let width = (this[`${_properties[i].abbrev}_squared`] === true) ? this.panelHeight : this[`${_properties[i].abbrev}_width`] * global.ui_scale;
                if (_properties[i].abbrev === 'Mem') {
                    // paint the "swap" backdrop
                    this.swapGraph.paint(
                        this.swapProvider.name,
                        this.swapProvider.currentReadings,
                        area,
                        areaContext,
                        // no label for the backdrop
                        false,
                        (this.Swap_enabled) ? Math.round(width * this.Mem_swapWidth / 100) - 2 * global.ui_scale : 0,
                        this.panelHeight - 2 * global.ui_scale,
                        [0, 0, 0, 0],
                        // clear background so that it doesn't mess up the other one
                        [0, 0, 0, 0],
                        [this.Mem_colorSwap]
                    );
                }
                let labelOn = this[`${_properties[i].abbrev}_labelOn`];
                let labelForeground = this[`${_properties[i].abbrev}_labelForeground`];
                let labelPos = this[`${_properties[i].abbrev}_labelPos`];
                let labelZoom = this[`${_properties[i].abbrev}_labelZoom`];
                let labelCustomized = this[`${_properties[i].abbrev}_labelCustomized`];
                let labelCustom = this[`${_properties[i].abbrev}_labelCustom`];
                let labelProps = {
                    on: this.labelsOn && labelOn,
                    fg: labelForeground,
                    pos: labelPos,
                    zoom: labelZoom,
                    labelStr: (labelCustomized && labelCustom.length > 0) ? labelCustom : this[_properties[i].provider].name
                };
                this[_properties[i].graph].paint(
                    this[_properties[i].provider].name,
                    this[_properties[i].provider].currentReadings,
                    area,
                    areaContext,
                    labelProps,
                    width,
                    this.panelHeight - 2 * global.ui_scale,
                    this.labelColor,
                    this.backgroundColor,
                    this[_properties[i].provider].getColorList()
                );
                // return translation to origin
                areaContext.translate(-xOffset, -yOffset);
                // update xOffset for next translation
                if (i === len - 1)
                    xOffset += width;
                else
                    xOffset += width + 1 + this.graphSpacing;
            }
        }
        area.set_width(xOffset > 1 ? xOffset : 1);
        area.set_height(this.panelHeight);
    }

    _initContextMenu() {
        if (this.restart_menu_item) {
            let children = this._applet_context_menu._getMenuItems();
            children[0].destroy();
        }
        this.restart_menu_item = new Applet.MenuItem(_('Refresh All'), "view-refresh", () => {
            this.refreshAll()
        });
        this._applet_context_menu.addMenuItem(this.restart_menu_item, 0);

        if (this.wo_graphs_item || this.w_graphs_item) {
            let children = this._applet_context_menu._getMenuItems();
            children[1].destroy();
        }
        if (!this.without_any_graph) {
            this.wo_graphs_item = new Applet.MenuItem(_('Without any graphics'), "list-remove", () => {
                GLib.file_set_contents(this.metadata.path+"/WOGRAPH", "");
                this.refreshAll()
            });
            this._applet_context_menu.addMenuItem(this.wo_graphs_item, 1);
        } else {
            this.w_graphs_item = new Applet.MenuItem(_('With graphics'), "list-remove", () => {
                let file = Gio.file_new_for_path(this.metadata.path+"/WOGRAPH");
                file.delete(null);
                this.refreshAll()
            });
            this._applet_context_menu.addMenuItem(this.w_graphs_item, 1);
        }

        if (this.is_sudoer && GLib.find_program_in_path("pkexec") && GLib.find_program_in_path("sysctl")) {
            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let drop_cache_item = new Applet.MenuItem(
                _("Drop Memory Cache (needs root rights)"),
                "go-bottom", //"view-bottom-pane",
                () => { Util.spawnCommandLineAsync('pkexec sysctl vm.drop_caches=3') }
            );
            this._applet_context_menu.addMenuItem(drop_cache_item, 2);
        }

        let menuChildren = this._applet_context_menu._getMenuItems();
        var posConfigure = -1;
        for (let i=0; i<menuChildren.length; i++) {
            if (menuChildren[i] == this.context_menu_item_configure) {
                posConfigure = i;
            }
        }
        if (posConfigure != -1) {
            menuChildren[posConfigure].destroy();
            this.context_menu_item_configure = new PopupMenu.PopupSubMenuMenuItem(_("Configure..."));
            this.context_menu_item_configure.menu.addAction(_("General"), () => { this.configureApplet(0) });
            this.context_menu_item_configure.menu.addAction(_("CPU"), () => { this.configureApplet(1) });
            this.context_menu_item_configure.menu.addAction(_("Memory"), () => { this.configureApplet(2) });
            this.context_menu_item_configure.menu.addAction(_("Network"), () => { this.configureApplet(3) });
            this.context_menu_item_configure.menu.addAction(_("Disk IO"), () => { this.configureApplet(4) });
            this.context_menu_item_configure.menu.addAction(_("Disk Usage"), () => { this.configureApplet(5) });
            this.context_menu_item_configure.menu.addAction(_("Battery"), () => { this.configureApplet(6) });
            this.context_menu_item_configure.menu.addAction(_("Colors"), () => { this.configureApplet(7) });
            this._applet_context_menu.addMenuItem(this.context_menu_item_configure, posConfigure);
        }
    }

    closeSettingsWindow() {
        if (this.settingsWindow) {
            try {
                this.settingsWindow.delete(300);
            } catch(e) {}
        }
        this.settingsWindow = undefined;
    }

    configureApplet(tab=0) {
        const maximize_vertically = true;
        const VERTICAL = 2;
        this._applet_context_menu.close(false);

        this.closeSettingsWindow();

        let pid = Util.spawnCommandLine(`xlet-settings applet ${UUID} -i ${this.instance_id} -t ${tab}`);

        if (maximize_vertically) {
          var app = null;
          var intervalId = null;
          intervalId = setTimeout(() => {
                clearTimeout(intervalId);
                app = windowTracker.get_app_from_pid(pid);
                if (app != null) {
                    let window = app.get_windows()[0];
                    this.settingsTab = tab;

                    window.maximize(VERTICAL);
                    window.activate(300);
                    this.settingsWindow = window;
                    app.connect("windows-changed", () => { this.settingsWindow = undefined; });
                    this._removeEnlightenment();
                }
            }, 600);
        }
        // Returns the pid:
        return pid;
  }

    get without_any_graph() {
        return GLib.file_test(this.metadata.path + "/WOGRAPH", GLib.FileTest.EXISTS)
    }

    setIcon() {
        if (this.useSymbolicIcon)
            this.set_applet_icon_symbolic_name("MCSM");
        else
            this.set_applet_icon_name("MCSM");
    }

    on_CPU_byActivity_changed() {
        let to = setTimeout( () => {
            clearTimeout(to);
            this.CPU_useProgressiveColors = !this.CPU_byActivity;
        }, 2100);
    }

    _renew_network_devices_status() {
        if (!GLib.file_test(NETWORK_DEVICES_STATUS_PATH, GLib.FileTest.EXISTS))
            this.isCurrentlyCheckingStatus = false;
        if (this.isCurrentlyCheckingStatus === true) return;
        this.isCurrentlyCheckingStatus = true;
        Util.spawnCommandLine(PATH2SCRIPTS + "/get-network-devices.sh");
        this.isCurrentlyCheckingStatus = false;
    }

    on_Net_getdevlist_btn_clicked() {
        this._renew_network_devices_status();
        var knownDevices = [];
        var new_Net_devicesList = this.Net_devicesList;
        for (let d of this.Net_devicesList) {
            if (d["id"].length === 0) continue; // Prevents user mistakes.
            knownDevices.push(d["id"]);
        }
        var ret = "";
        var returnedDevices = [];
        try {
            if (GLib.file_test(NETWORK_DEVICES_STATUS_PATH, GLib.FileTest.EXISTS)) {
                readFileAsync(NETWORK_DEVICES_STATUS_PATH).then((status) => {
                    ret += status.trim();
                });
            } else {
                const net_dir_path = "/sys/class/net";
                const net_dir = Gio.file_new_for_path(net_dir_path);
                const children = net_dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null);
                for (let child of children) {
                    let name = child.get_name();
                    let operstate_file_path = `${net_dir_path}/${name}/operstate`;

                    readFileAsync(operstate_file_path).then( (net_status) => {
                        net_status = net_status.trim();
                        ret += `${name}:${net_status} `;
                    });
                }
            }
            let idto = setTimeout( () => {
                clearTimeout(idto);
                returnedDevices = ret.trim().split(" ");
                for (let d of returnedDevices) {
                    let [dev, status] = d.split(":");
                    if (knownDevices.indexOf(dev) < 0) {
                        if (status === "up" || status === "down") {
                            new_Net_devicesList.push({
                                "enabled": status === "up",
                                "id": dev,
                                "name": dev,
                                "colorDown": (knownDevices.length * 2) % nb_colors,
                                "colorUp": (knownDevices.length * 2 + 1) % nb_colors
                            });
                            knownDevices.push(dev);
                        }
                    }
                }
                this.Net_devicesList = new_Net_devicesList;
            }, 2100);
        } catch(e) {
            global.logError("Unable to detect any network device!", e);
        }
    }

    on_Net_cleardevlist_btn_clicked() {
        this.Net_devicesList = [];
    }

    on_Disk_getdevlist_btn_clicked() {
        let subProcess = Util.spawnCommandLineAsyncIO(PATH2SCRIPTS + "/get-disk-info.sh", (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                var knownDevices = [];
                var new_Disk_devicesList = this.Disk_devicesList;
                for (let d of this.Disk_devicesList) {
                    if (d["id"].length === 0) continue;
                    knownDevices.push(d["id"]);
                }
                this.DISK_INFO = JSON.parse(stdout);
                for (let dev of this.DISK_INFO["blockdevices"]) {
                    if (!dev["children"]) continue;
                    for (let child of dev["children"]) {
                        if (! child["mountpoint"]) continue;
                        let mntPoint = child["mountpoint"];
                        if (mntPoint == null || mntPoint.includes("SWAP")) continue;
                        if (mntPoint === "/") {
                            mntPoint = _("root");
                        } else {
                            let _mntPoint = mntPoint.split("/");
                            mntPoint = _mntPoint.pop();
                        }
                        let mntName = child["kname"];
                        let discGran = child["disc-gran"] ? child["disc-gran"] : child["log-sec"];
                        if (knownDevices.indexOf(mntName) < 0) {
                            new_Disk_devicesList.push({
                                "enabled": true,
                                "id": mntName,
                                "name": (mntPoint.length > 0) ? mntPoint : mntName,
                                "discGran": discGran,
                                "colorRead": (knownDevices.length * 2) % 32,
                                "colorWrite": (knownDevices.length * 2 + 1) % 32
                            });
                            knownDevices.push(mntName);
                        }
                    }
                }
                this.Disk_devicesList = new_Disk_devicesList;
            }
            subProcess.send_signal(9);
        })
    }

    on_DiskUsage_getpathlist_btn_clicked() {
        let subProcess = Util.spawnCommandLineAsyncIO(PATH2SCRIPTS + "/get-disk-mounts.sh", (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                var knownPaths = [];
                var new_pathList = this.DiskUsage_pathList;
                for (let p of this.DiskUsage_pathList) {
                    if (p["path"].length === 0) continue;
                    knownPaths.push(p["path"]);
                }
                var mounts = stdout.trim().replace(/\ +/g, " ").split(" ");
                for (let m of mounts) {
                    if (m.trim().length === 0 && knownPaths.indexOf("/") < 0)
                        m = "/";
                    if (!m.startsWith("/")) continue;
                    if (knownPaths.indexOf(m) < 0) {
                        let name = GLib.basename(m);
                        if (name.length === 0)
                            name = _("root");
                        new_pathList.push({
                            "enabled": true,
                            "maxvalue": 80,
                            "name": name,
                            "path": m
                        });
                        knownPaths.push(m);
                    }
                }
                if (knownPaths.indexOf("/") < 0) {
                    new_pathList.push({
                        "enabled": true,
                        "maxvalue": 80,
                        "name": _("root"),
                        "path": "/"
                    });
                    knownPaths.push("/");
                }
                this.DiskUsage_pathList = new_pathList;
            }
            subProcess.send_signal(9);
        })
    }

    on_Disk_cleardevlist_btn_clicked() {
        this.Disk_devicesList = [];
    }

    on_Battery_getdevlist_btn_clicked() {
        //~ const POWER_SUPPLY_PATH = "/sys/class/power_supply";
        const POWER_SUPPLY = Gio.file_new_for_path(POWER_SUPPLY_PATH);
        const children = POWER_SUPPLY.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null);
        var knownDevices = [];
        var new_Battery_devicesList = this.Battery_devicesList;
        for (let d of this.Battery_devicesList) {
            if (d["id"].length === 0) continue; // Prevents user mistakes.
            knownDevices.push(d["id"]);
        }

        var ret = "";
        var returnedDevices = [];
        try {
            for (let child of children) {
                let name = child.get_name();
                global.log("name: " + name);
                let uevent_file_path = `${POWER_SUPPLY_PATH}/${name}/uevent`;
                if (!GLib.file_test(uevent_file_path, GLib.FileTest.EXISTS)) continue;
                readFileAsync(uevent_file_path).then( (status) => {
                    status = status.trim();
                    let _json = conf2json(status);
                    if (_json["POWER_SUPPLY_TYPE"] === "Battery" && parseInt(_json["POWER_SUPPLY_PRESENT"]) === 1)
                    ret += `${name} `;
                });
            }
            children.close(null);

            let idto = setTimeout( () => {
                clearTimeout(idto);
                returnedDevices = ret.trim().split(" ");
                for (let dev of returnedDevices) {
                    if (dev.length < 2) continue;
                    if (knownDevices.indexOf(dev) < 0) {
                        new_Battery_devicesList.push({
                                "enabled": true,
                                "id": dev,
                                "minvalue": 40,
                                "name": dev
                            });
                            knownDevices.push(dev);
                    }
                }
                this.Battery_devicesList = new_Battery_devicesList;
            }, 2100);
        } catch(e) {
            global.logError("Unable to detect any battery!", e);
        }
    }

    on_Battery_cleardevlist_btn_clicked() {
        this.Battery_devicesList = [];
    }

    _runSysMon() {
        let systemMonitoringCenter = appSystem.lookup_flatpak_app_id('io.github.hakandundar34coding.system-monitoring-center');
        if (systemMonitoringCenter) {
            systemMonitoringCenter.activate();
            return
        }
        systemMonitoringCenter = appSystem.lookup_app('io.github.hakandundar34coding.system-monitoring-center.desktop');
        if (systemMonitoringCenter) {
            systemMonitoringCenter.activate();
            return
        }
        let gnomeSystemMonitor = appSystem.lookup_app('gnome-system-monitor.desktop');
        if (gnomeSystemMonitor) {
            gnomeSystemMonitor.activate();
            return
        }
        gnomeSystemMonitor = appSystem.lookup_app('org.gnome.SystemMonitor.desktop');
        if (gnomeSystemMonitor) {
            gnomeSystemMonitor.activate();
        }
    }

    on_color_changed() {
        let colors = [];
        for (let i=0; i<nb_colors; i++) {
            let color = this[`color${i}`];
            let color_array = color.split(",");
            color_array[0] = color_array[0].replace(/rgba\(/g, "").replace(/rgb\(/g, "");
            color_array[color_array.length - 1] = color_array[color_array.length - 1].replace(/\)/g, "");
            let len = color_array.length;
            for (let c=0; c<len; c++)
                color_array[c] = parseFloat(color_array[c]);
            if (len === 3)
                color_array.push(1.0);
            colors.push([color_array[0] / 255, color_array[1] / 255, color_array[2] / 255, color_array[3]]);
        }
        this.colors = colors;
    }

    get_mem_info() {
        if (!this.isRunning) return;
        if (!this.Mem_enabled && !this.Mem_enabledTooltip) return;
        let old, duration;
        if (DEBUG) old = Date.now();

        readFileAsync("/proc/meminfo").then((contents) => {
            var data = [];
            const lines = contents.split("\n");
            const p = 1024;
            var memInfo = {};
            for (let line of lines) {
                line = line.trim().replace(/\ +/g, " ");
                let [name, value, unit] = line.split(" ");
                value = 1 * value;
                if (name.startsWith("SUnreclaim")) break;
                if (name.startsWith("MemTotal")) memInfo["MemTotal"] = p * value;
                if (name.startsWith("MemFree")) memInfo["MemFree"] = p * value;
                if (name.startsWith("MemAvailable")) memInfo["MemAvailable"] = p * value;
                if (name.startsWith("Buffers")) memInfo["Buffers"] = p * value;
                if (name.startsWith("Cached")) memInfo["Cached"] = p * value;
                if (name.startsWith("SwapTotal")) memInfo["SwapTotal"] = p * value;
                if (name.startsWith("SwapFree")) memInfo["SwapFree"] = p * value;
                if (name.startsWith("Shmem")) memInfo["Shmem"] = p * value;
                if (name.startsWith("SReclaimable")) memInfo["SReclaimable"] = p * value;
            }

            // From htop author:
            // Total used memory = MemTotal - MemFree
            // Non cache/buffer memory (green) = Total used memory - (Buffers + Cached memory)
            // Buffers (blue) = Buffers
            // Cached memory (yellow) = Cached + SReclaimable - Shmem
            // Swap = SwapTotal - SwapFree

            memInfo["MemUsed"] = memInfo["MemTotal"] - memInfo["MemFree"];
            memInfo["Cached"] =  memInfo["Cached"] + memInfo["SReclaimable"] - memInfo["Shmem"];
            memInfo["SwapUsed"] = memInfo["SwapTotal"] - memInfo["SwapFree"];

            this.memoryProvider.setData(memInfo["MemTotal"], memInfo["MemTotal"] - memInfo["MemAvailable"], memInfo);
            this.swapProvider.setData(memInfo["SwapTotal"], memInfo["SwapUsed"] / memInfo["SwapTotal"]);
            this.buffcachesharedProvider.setData(memInfo["Buffers"], memInfo["Cached"], memInfo["Shmem"]);
            if (DEBUG) {
                duration = Date.now() - old;
                global.log(UUID + " - get_mem_info Duration: " + duration + " ms.");
            }
        });
    }

    get_cpu_info() {
        if (!this.isRunning) return;
        if (!this.CPU_enabled && !this.CPU_enabledTooltip) return;
        let old, duration;
        if (DEBUG) old = Date.now();

        if (
            this.CPU_showTemp &&
            this.CPU_tempPath.length > 0 &&
            GLib.file_test(this.CPU_tempPath, GLib.FileTest.EXISTS)
        ) {
            readFileAsync(this.CPU_tempPath).then((contents) => {
                let _temp = contents.trim();
                _temp = parseInt(_temp);
                if (!isNaN(_temp)) {
                    _temp = Math.round(1 * _temp / 1000);
                    if (this.CPU_tempInFahrenheit)
                        _temp = Math.round(1.8 * _temp + 32);
                    this.CPU_temperature = _temp;
                }
            }); //.catch(null)
        }

        readFileAsync("/proc/stat").then((contents) => {
            var data = [];
            const lines = contents.split("\n");
            var ret = "";
            for (let line of lines) {
                line = line.trim();
                line = line.replace();
                if (line.startsWith("cpu")) {
                    let [cpu, user, nice, system, idle, iowait, irq, softirq, steal, guest, guest_nice, rest] = line.split(" ");
                    let Idle = 1 * idle + 1 * iowait;
                    let NonIdle = 1 * user + 1 * nice + 1 * system + 1 * irq + 1 * softirq + 1 * steal;
                    let Total = Idle + NonIdle;
                    ret = ret + ` ${Total},${Idle}`;
                } else {
                    break
                }
            }
            let cpuString = ret.trim();
            let values = cpuString.split(" ");
            if (this.oldCPU_Total_Values.length === 0) { // first execution
                if (this.CPU_mergeAll) {
                    if (this.CPU_showLoadOverTime) {
                        for (let i=0; i<this.CPU_showLoadOverTimeHowManyBars; i++) {
                            data.push(0);
                            let v = values [0];
                            let [total, idle] = v.split(",");
                            this.oldCPU_Total_Values.push(1 * total);
                            this.oldCPU_Idle_Values.push(1 * idle);
                        }
                    } else {
                        data.push(0);
                        for (let v of values) {
                            let [total, idle] = v.split(",");
                            this.oldCPU_Total_Values.push(1 * total);
                            this.oldCPU_Idle_Values.push(1 * idle);
                        }
                    }
                } else {
                    for (let i=0, len=values.length; i<len; i++) {
                        data.push(0);
                        let [total, idle] = values[i].split(",");
                        total = 1 * total;
                        idle = 1 * idle;
                        this.oldCPU_Total_Values.push(total);
                        this.oldCPU_Idle_Values.push(idle);
                    }
                }
            } else { // next executions
                if (this.CPU_mergeAll) {
                    if (this.CPU_showLoadOverTime) {
                        data = this.multiCpuProvider.getData();
                        let [totalValue, idleValue] = values[0].split(",");
                        totalValue = 1 * totalValue;
                        idleValue = 1 * idleValue;

                        data.splice(0, 1);
                        let total = totalValue - this.oldCPU_Total_Values[0];
                        let idle = idleValue - this.oldCPU_Idle_Values[0];
                        if (total != 0)
                            data.push(2 * (total - idle) / total);
                        else
                            data.push(0);
                        this.oldCPU_Total_Values.splice(0, 1);
                        this.oldCPU_Total_Values.push(totalValue);
                        this.oldCPU_Idle_Values.splice(0, 1);
                        this.oldCPU_Idle_Values.push(idleValue);
                    } else {
                        let [totalValue, idleValue] = values[0].split(",");
                        totalValue = 1 * totalValue;
                        idleValue = 1 * idleValue;
                        let total = totalValue - this.oldCPU_Total_Values[0];
                        let idle = idleValue - this.oldCPU_Idle_Values[0];
                        if (total != 0)
                            data.push((total - idle) / total);
                        this.oldCPU_Total_Values[0] = totalValue;
                        this.oldCPU_Idle_Values[0] = idleValue;
                        for (let i=1, len=values.length; i < len; i++) {
                            let [totalValue, idleValue] = values[i].split(",");
                            this.oldCPU_Total_Values[i] = 1 * totalValue;
                            this.oldCPU_Idle_Values[i] = 1 * idleValue;
                        }
                    }
                } else {
                    let i = 0;
                    for (let v of values) {
                        let [totalValue, idleValue] = v.split(",");
                        totalValue = 1 * totalValue;
                        idleValue = 1 * idleValue;
                        let total = totalValue - this.oldCPU_Total_Values[i];
                        let idle = idleValue - this.oldCPU_Idle_Values[i];
                        this.oldCPU_Total_Values[i] = totalValue;
                        this.oldCPU_Idle_Values[i] = idleValue;
                        if (i === 0) {
                            i++;
                            continue;
                        }
                        if (total != 0)
                            data.push((total - idle) / total);
                        i++;
                    }
                }
            }
            this.oldCPUvalues = values;

            this.multiCpuProvider.setData(data);

            if (DEBUG) {
                duration = Date.now() - old;
                global.log(UUID + " - get_cpu_info Duration: " + duration + " ms.");
            }
        });
    }

    set_net_devices_data() {
        let dataNet = JSON.parse(JSON.stringify(this.lastDataNet, null, 4));
        var datastring = "";
        for (let name of Object.keys(dataNet)) {
            let rx = dataNet[name]["rx"];
            let tx = dataNet[name]["tx"];
            datastring += `${name}:${rx}:${tx} `;
        }
        datastring = datastring.trim();
        var allowedInterfaces = [];
        var names = {};
        for (let dev of this.Net_devicesList) {
            if (dev["enabled"] === true) {
                allowedInterfaces.push(dev["id"]);
                names[dev["id"]] = dev["name"];
            }
        }
        var data = [];
        var disabledDevices = [];
        let netInfo = datastring.split(" ");
        var sum_rx = 0;
        var sum_tx = 0;
        for (let info of netInfo) {
            let [iface, rx, tx] = info.split(":");
            if (allowedInterfaces.indexOf(iface) < 0) {
                disabledDevices.push(iface);
                continue;
            }
            if (this.Net_mergeAll) {
                sum_rx = sum_rx + 1 * rx;
                sum_tx = sum_tx + 1 * tx;
            } else {
                data.push({
                    "id": iface,
                    "name": names[iface],
                    "up": 1 * tx,
                    "down": 1 * rx
                });
            }
        }
        if (this.Net_mergeAll) {
            data.push({
                "id": "Net",
                "name": _("Network"),
                "up": sum_tx,
                "down": sum_rx
            });
            disabledDevices = [];
        }
        this.networkProvider.setData(data, disabledDevices);
    }

    _read_rx_tx_bytes(name, status) {
        if (status != "up") return;
        const net_dir_path = "/sys/class/net";
        var rx_bytes = "", tx_bytes = "";
        const rx_bytes_path = `${net_dir_path}/${name}/statistics/rx_bytes`;
        const tx_bytes_path = `${net_dir_path}/${name}/statistics/tx_bytes`;
        readFileAsync(rx_bytes_path).then( (outputR) => {
            rx_bytes = outputR.trim();
            readFileAsync(tx_bytes_path).then( (outputT) => {
                tx_bytes = outputT.trim();
                this.lastDataNet[""+name] = {"rx": parseInt(rx_bytes), "tx": parseInt(tx_bytes)};
            });
        });
    }

    get_net_info() {
        if (!this.isRunning) return;
        if (!this.Net_enabled && !this.Net_enabledTooltip) return;
        const net_dir_path = "/sys/class/net";
        let old, duration;
        if (DEBUG) old = Date.now();
        if (GLib.file_test(NETWORK_DEVICES_STATUS_PATH, GLib.FileTest.EXISTS)) {
            readFileAsync(NETWORK_DEVICES_STATUS_PATH).then( (result) => {
                let names_status = result.trim().split(" ");
                for (let name_status of names_status) {
                    let [name, status] = name_status.split(":");
                    this._read_rx_tx_bytes(name, status);
                }
            });
        } else {
            const net_dir = Gio.file_new_for_path(net_dir_path);
            const children = net_dir.enumerate_children("standard::name,standard::type", Gio.FileQueryInfoFlags.NONE, null);
            for (let child of children) {
                let name = child.get_name();
                let operstate_file_path = `${net_dir_path}/${name}/operstate`;
                readFileAsync(operstate_file_path).then( (output) => {
                    let net_status = output.trim();
                    this._read_rx_tx_bytes(name, net_status);
                });

            }
            children.close(null);
        }
        this.set_net_devices_data();

        if (DEBUG) {
            duration = Date.now() - old;
            global.log(UUID + " - get_net_info Duration: " + duration + " ms.");
        }
    }

    get_disk_info() {
        if (!this.isRunning) return;
        if (!this.Disk_enabled && !this.Disk_enabledTooltip) return;
        let old, duration;
        if (DEBUG) old = Date.now();
        var usedDevices = [];
        var deviceNames = {};
        var deviceGrans = {};
        for (let d of this.Disk_devicesList) {
            if (! d["enabled"]) continue;
            usedDevices.push(d["id"]);
            if (d["name"].length === 0)
                deviceNames[d["id"]] = d["id"];
            else
                deviceNames[d["id"]] = d["name"];
            deviceGrans[d["id"]] = d["discGran"];
        }
        var data = [];
        readFileAsync("/proc/diskstats").then( (result) => {
            let diskstats = result.trim().split("\n");

            var sum_read = 0;
            var sum_write = 0;
            for (let line of diskstats) {
                if (line.includes("loop")) continue;
                line = line.trim();
                line = line.replace(/\ +/g, " ");
                let infos = line.split(" ");
                let _dev = infos[2];
                if (usedDevices.indexOf(_dev) < 0) continue;
                let discGran = 1 * deviceGrans[_dev];
                let [_read, _write] = [1 * infos[5] * discGran, 1 * infos[9] * discGran];
                if (this.Disk_mergeAll) {
                    sum_read = 1 * sum_read + _read;
                    sum_write = 1 * sum_write + _write;
                } else {
                    data.push({
                        "id": _dev,
                        "name": deviceNames[_dev],
                        "read": _read,
                        "write": _write
                    });
                }

            }
            if (this.Disk_mergeAll) {
                data.push({
                    "id": "Disks",
                    "name": _("Disks"),
                    "read": sum_read,
                    "write": sum_write
                });
            }
            this.diskProvider.setData(data);
            if (DEBUG) {
                duration = Date.now() - old;
                global.log(UUID + " - get_disk_info Duration: " + duration + " ms.");
            }
        });
    }

    get_disk_usage() {
        if (!this.isRunning) return;
        if (!this.DiskUsage_enabled && !this.DiskUsage_enabledTooltip) return;
        var usedPaths = [];
        var sumSize = 0;
        var sumUsed = 0;
        var data = [];
        for (let p of this.DiskUsage_pathList) {
            if (!p["enabled"]) continue;
            let path = "" + p["path"];
            let maxValue = 0.8;
            if (p["maxvalue"] != null)
                maxValue = 1 * p["maxvalue"] / 100;
            if (! GLib.file_test(path, GLib.FileTest.EXISTS)) continue;
            usedPaths.push(path);
            let [size, used] = this.disk_usage(path);
            if (this.DiskUsage_mergeAll) {
                sumSize = sumSize + size;
                sumUsed = sumUsed + used;
            } else {
                data.push({
                    "value": 1.0 * used / size,
                    "maxvalue": maxValue
                });
            }
        }
        if (this.DiskUsage_mergeAll) {
            data.push({
                "value": 1.0 * sumUsed / sumSize,
                "maxvalue": 0.8
            });
        }
        this.diskUsageProvider.setData(data);
    }

    disk_usage(path) {
        if (!this.isRunning) return [0, 0];
        if (!this.DiskUsage_enabled && !this.DiskUsage_enabledTooltip) return [0, 0];
        try {
            let dir = Gio.file_new_for_path(""+path);
            let info = dir.query_filesystem_info('filesystem::used,filesystem::size', null);
            if (info == null) return [0, 0];
            let used = info.get_attribute_as_string('filesystem::used');
            let size = info.get_attribute_as_string('filesystem::size');
            return [parseInt(size), parseInt(used)];
        } catch(e) {
            global.log(UUID + " - disk_usage("+path+"): "+e);
            return [0, 0];
        }
    }

    get_battery_usage() {
        if (!this.isRunning) return;
        if (!this.Battery_enabled && !this.Battery_enabledTooltip) return;
        //~ const POWER_SUPPLY_PATH = "/sys/class/power_supply";
        //~ const POWER_SUPPLY = Gio.file_new_for_path(POWER_SUPPLY_PATH);

        var usedPaths = [];
        var sumSize = 0;
        var sumUsed = 0;
        var data = [];
        for (let b of this.Battery_devicesList) {
            if (!b["enabled"] || b["id"].length === 0) continue;
            let path = POWER_SUPPLY_PATH + "/" + b["id"] + "/uevent";
            let minValue = 0.4;
            if (b["minValue"] != null)
                minValue = 0.01 * parseFloat(b["minValue"]);
            if (! GLib.file_test(path, GLib.FileTest.EXISTS)) continue;
            usedPaths.push(path);
            let [size, used] = this.battery_usage(b["id"]);
            if (this.Battery_mergeAll) {
                sumSize = sumSize + size;
                sumUsed = sumUsed + used;
            } else {
                data.push({
                    "value": 1.0 * used / size,
                    "minvalue": minValue
                });
            }
        }
        if (this.Battery_mergeAll) {
            data.push({
                "value": 1.0 * sumUsed / sumSize,
                "minvalue": 0.4
            });
        }
        this.batteryProvider.setData(data);
    }

    battery_usage(id) {
        let path = `${POWER_SUPPLY_PATH}/${id}/uevent`;
        readFileAsync(path).then( (status) => {
            status = status.trim();
            let _json = conf2json(status);
            try {
                if (_json["POWER_SUPPLY_TYPE"] === "Battery" && parseInt(_json["POWER_SUPPLY_PRESENT"]) === 1) {
                    if (_json["POWER_SUPPLY_ENERGY_FULL"] && _json["POWER_SUPPLY_ENERGY_NOW"])
                        this.battery_energy[id] = [1 * _json["POWER_SUPPLY_ENERGY_FULL"], 1 * _json["POWER_SUPPLY_ENERGY_NOW"]];
                    else
                        this.battery_energy[id] = [1 * _json["POWER_SUPPLY_CHARGE_FULL"], 1 * _json["POWER_SUPPLY_CHARGE_NOW"]];
                } else {
                    this.battery_energy[id] = [100, 0];
                }
            } catch(e) {
                this.battery_energy[id] = [100, 0];
            }
        });
        return this.battery_energy[id];
    }

    battery_health(id) {
        let path = `${POWER_SUPPLY_PATH}/${id}/uevent`;
        readFileAsync(path).then( (status) => {
            status = status.trim();
            let _json = conf2json(status);
            try {
                if (_json["POWER_SUPPLY_TYPE"] === "Battery" && parseInt(_json["POWER_SUPPLY_PRESENT"]) === 1) {
                    if (_json["POWER_SUPPLY_ENERGY_FULL_DESIGN"] && _json["POWER_SUPPLY_ENERGY_FULL"])
                        this.battery_capacity[id] = [1 * _json["POWER_SUPPLY_ENERGY_FULL_DESIGN"], 1 * _json["POWER_SUPPLY_ENERGY_FULL"]];
                    else
                        this.battery_capacity[id] = [1 * _json["POWER_SUPPLY_CHARGE_FULL_DESIGN"], 1 * _json["POWER_SUPPLY_CHARGE_FULL"]];
                } else {
                    this.battery_capacity[id] = [100, 0];
                }
            } catch(e) {
                this.battery_capacity[id] = [100, 0];
            }
        });
        return this.battery_energy[id];
    }

    _setTooltip() {
        if (!this.isRunning) return;
        if (!this.hovered) {
            this.set_applet_tooltip("");
            return;
        }
        var appletTooltipString = "";
        for (let provider of [
            "multiCpuProvider",
            "memoryProvider",
            "swapProvider",
            "buffcachesharedProvider",
            "networkProvider",
            "diskProvider",
            "diskUsageProvider",
            "batteryProvider"
        ]) {
            appletTooltipString += this[provider].getTooltipString();
        }
        if (this.hovered)
            this.set_applet_tooltip(appletTooltipString.trimEnd(), true);
    }

    /** Network
    */
    monitor_interfaces() {
        if (this.netMonitor != null || !this.isRunning) return;
        try {
            this.netMonitor = Gio.network_monitor_get_default();
            let netMonitorId = this.netMonitor.connect(
                'network-changed',
                (monitor, network_available) => this.on_network_changed()
            );
            this.monitors.push([this.netMonitor, netMonitorId]);
        } catch(e) {
            global.logError("Unable to monitor the network interfaces!", e)
        }
    } // End of monitor_interfaces

    disconnect_monitors() {
        while (this.monitors.length > 0) {
            let [mon, Id] = this.monitors.pop();
            mon.disconnect(Id)
        }
    } // End of disconnect_monitors

    on_network_changed() {
        if (!this.isRunning) return;
        this._renew_network_devices_status();
    }

    _removeEnlightenment() {
        this.highlight(false);
    }

    refreshAll() {
        reloadExtension(UUID, Type.APPLET);
    }

    on_panel_height_changed() {
        this.set_panelHeight();
    }

    on_applet_clicked(event) {
        this._runSysMon();
    }

    on_applet_middle_clicked(event) {
        this.configureApplet(0);
    }

    _onButtonPressEvent (actor, event) {
        if (!this._applet_enabled) {
            return false;
        }

        let button = event.get_button();
        if (button < 3) {
            if (!this._draggable.inhibit) {
                return false;
            } else {
                if (this._applet_context_menu.isOpen) {
                    this._applet_context_menu.toggle();
                }
            }
        }

        if (button === 1) {
            this.on_applet_clicked(event);
        } else if (button === 2) {
            this.on_applet_middle_clicked(event);
        } else if (button === 3) {
            if (this._applet_context_menu._getMenuItems().length > 0) {
                this._applet_context_menu.toggle();
                this.context_menu_item_configure.menu.toggle();
            }
        }
        return true;
    }

    on_applet_added_to_panel(userEnabled) {
        this.isRunning = true;
        this._renew_network_devices_status();
        this.monitor_interfaces();
        this.run_main_loop();
    }

    on_applet_removed_from_panel(deleteConfig) {
        this.isRunning = false;
        this.disconnect_monitors();
        remove_all_sources();
        this.closeSettingsWindow();
    }

    get _isHighlighted() {
        let isHL = this.actor.has_style_pseudo_class("highlight");
        if (this.isHighlighted !== isHL)
            this.isHighlighted = isHL;
        return isHL;
    }

}

class MemDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('MEM');
        this.memusage = 0;
        this.memTotal = 0;
        this.currentReadings = [0, 0, 0, 0];
    }

    getColorList() {
        let types = ["Usedup", "Cache", "Buffers", "Free", "Swap"];
        if (this.applet.Mem_onlyUsedAvailable)
            types = ["Usedup", "Free", "Free", "Free", "Swap"];
        var colorList = [];
        for (let t of types)
            colorList.push(this.applet[`Mem_color${t}`]);
        return colorList;
    }

    getData() {
        if (!this.isEnabled && !this.isEnabledTooltip) return [];
        return this.currentReadings;
    }

    setData(total, used, memInfo) {
        const precision = 100000;
        this.memTotal = 1 * memInfo["MemTotal"];
        if (this.applet.Mem_method === "htop") { // htop:
            this.currentReadings = [
                (memInfo["MemUsed"] - memInfo["Cached"] - memInfo["Buffers"]) / memInfo["MemTotal"],
                memInfo["Cached"] / memInfo["MemTotal"],
                memInfo["Buffers"] / memInfo["MemTotal"],
                1 - memInfo["MemUsed"] / memInfo["MemTotal"]
            ]
        } else { // System Monitor: https://github.com/JTourteau/gnome-system-monitor/blob/main/extension.js
            let memAvailable = 1 * memInfo["MemAvailable"];
            let memUsed = 1 * this.memTotal - memAvailable;
            let memBuffers = 1 * memInfo["Buffers"];
            let memCached = 1 * memInfo["Cached"];
            this.currentReadings = [
                memUsed / this.memTotal,
                memCached / this.memTotal,
                memBuffers / this.memTotal,
                1.0 - ((memUsed + memBuffers + memCached) / this.memTotal)
            ]
        }
    }

    getTooltipString() {
        if (! this.isEnabledTooltip) return "";
        if (! this.isRunning) return "";
        var sum_used = 0;
        let trans = _("Memory");
        let [strMemTotal, unitMemTotal] = formatBytesValueUnit(this.memTotal, 2, false);
        if (this.applet.Mem_showBytesInTooltip) {
            trans += " " + strMemTotal + " " + unitMemTotal;
        }
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*(spaces + 1) - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*(spaces + 1) - len)/2)) + '\n';
        if (this.applet.Mem_showBytesInTooltip) {
            let [strMemUsed, unitMemUsed] = formatBytesValueUnit(this.memTotal * this.currentReadings[0], 2, false);
            let [strMemAvail, unitMemAvail] = formatBytesValueUnit(this.memTotal * (1.0 - this.currentReadings[0]), 2, false);
            toolTipString += _('Used:').split(':')[0].padStart(spaces, ' ') + ':\t'  + "" + formatNumber(parseFloat(strMemUsed).toFixed(2), 2).padStart(8, ' ') + " " + unitMemUsed.padStart(6, ' ') + '\n';
            toolTipString += _('Available:').split(':')[0].padStart(spaces, ' ') + ':\t'  + "" + formatNumber(parseFloat(strMemAvail).toFixed(2), 2).padStart(8, ' ') + " " + unitMemAvail.padStart(6, ' ') + '\n';
        }
        let percentChar = "%";
        if (this.applet.percentAtEndOfLine)
            percentChar = "%".padStart(6, " ");
        if (this.applet.Mem_onlyUsedAvailable) {
            toolTipString += _('Used:').split(':')[0].padStart(spaces, ' ') + ':\t' + "" + formatNumber(parseFloat((Math.round(1000 * this.currentReadings[0])/10)).toFixed(2), 2).padStart(8, ' ') + " " + percentChar + '\n';
            toolTipString += _('Available:').split(':')[0].padStart(spaces, ' ') + ':\t' + "" + formatNumber(parseFloat((Math.round(1000 * (1 - this.currentReadings[0]))/10)).toFixed(2), 2).padStart(8, ' ') + " " + percentChar + '\n';
        } else {
            let attributes = [_('Used:'), _('Cached:'), _('Buffer:'), _('Free:')];
            for (let i = 0; i < attributes.length; i++) {
                toolTipString += (attributes[i]).split(':')[0].padStart(spaces, ' ') + ':\t' + "" + formatNumber(parseFloat((Math.round(1000 * this.currentReadings[i])/10)).toFixed(2), 2).padStart(8, ' ') + " " + percentChar + '\n';
            }
        }
        return toolTipString;
    }

    get isEnabled() {
        return this.applet.Mem_enabled;
    }

    get isEnabledTooltip() {
        return this.applet.Mem_enabledTooltip;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

class BufferCacheSharedDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('Buffers/Cache/Shared');
        this.currentReadings = [0, 0];
    }

    getColorList() {
        return [];
    }

    getData() {
        if (!this.isEnabled && !this.isEnabledBufferCacheSharedTooltip) return [];
        return this.currentReadings;
    }

    setData(buffers, cache, shared) {
        this.currentReadings = [
            buffers,
            cache,
            shared
        ];
    }

    getTooltipString() {
        if (! this.isEnabledTooltip || ! this.isEnabledBufferCacheSharedTooltip) return "";
        if (! this.isRunning) return "";
        let trans = this.name;
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*(spaces + 1) - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*(spaces + 1) - len)/2)) + '\n';

        let colon = _(":");
        let lenColon = Math.max(colon.length - 1, 0);
        let attributes = [_('Buffer'), _('Cache'), _("Shared")];

        for (let i=0, len=attributes.length; i<len; i++) {
            let [value, unit] = formatBytesValueUnit(Math.round(this.currentReadings[i]), 2, false);
            value = formatNumber(parseFloat(value).toFixed(2), 2);
            let valueLen = (""+value).length;
            toolTipString += attributes[i].padStart(spaces - lenColon, ' ') + colon + "\t" + "" + value.padStart(8, ' ') + " " + unit.padStart(6, ' ') + '\n';
        }
        return toolTipString;
    }

    get isEnabledTooltip() {
        return this.applet.Mem_enabledTooltip;
    }

    get isEnabledBufferCacheSharedTooltip() {
        return this.applet.Mem_enabledBufferCacheSharedTooltip;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

class SwapDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('SWAP');
        this.swapusage = true;
        this.swapTotal = 0;
        this.currentReadings = [0];
    }

    getColorList() {
        return [this.applet.Mem_colorSwap];
    }

    getData() {
        if ((!this.isEnabled && !this.isEnabledTooltip) || !this.swapusage) return [0];
        return this.currentReadings;
    }

    setData(total, value) {
        if (isNaN(value)) value = 0;
        this.swapTotal = total;
        this.swapusage = parseInt(total) !== 0;
        if (TESTING)
            this.currentReadings = [0.6];
        else
            this.currentReadings = [value];
    }

    getTooltipString() {
        if (!this.isEnabledTooltip || !this.swapusage) {
            return '';
        }
        let trans = _("Swap");
        let [strSwapTotal, unitSwapTotal] = formatBytesValueUnit(this.swapTotal, 2, false);
        let trans2 = trans + "";
        if (this.applet.Mem_showBytesInTooltip) {
            trans2 = trans + " " + strSwapTotal + " " + unitSwapTotal;
        }
        let len = trans2.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*(spaces + 1) - len)/2)) + " " + trans2 + " " + "-".repeat(Math.round((2*(spaces + 1) - len)/2)) + '\n';
        if (this.applet.Mem_showBytesInTooltip) {
            let [swapUsedAmount, swapUsedUnit] = formatBytesValueUnit(this.swapTotal * this.currentReadings[0], 2, false);
            if (isNaN(parseFloat(swapUsedAmount))) swapUsedAmount = "0";
            let [swapAvailableAmount, swapAvailableUnit] = formatBytesValueUnit(this.swapTotal * (1 - this.currentReadings[0]), 2, false);
            toolTipString += _('Used:').split(':')[0].padStart(spaces, ' ') + ':\t'  + "" + formatNumber(parseFloat(swapUsedAmount).toFixed(2), 2).padStart(8, ' ') + " " + swapUsedUnit.padStart(6, ' ') + '\n';
            toolTipString += _('Available:').split(':')[0].padStart(spaces, ' ') + ':\t'  + "" + formatNumber(parseFloat(swapAvailableAmount).toFixed(2), 2).padStart(8, ' ') + " " + swapAvailableUnit.padStart(6, ' ') + '\n';
        }
        let percentChar = "%";
        if (this.applet.percentAtEndOfLine)
            percentChar = "%".padStart(6, " ");

        let colon = _(":");
        let lenColon = Math.max(colon.length - 1, 0);
        toolTipString += trans.padStart(spaces - lenColon, ' ') + colon + '\t' + "" + formatNumber(parseFloat((Math.round(10000 * this.currentReadings[0]) / 100)).toFixed(2), 2).padStart(8, ' ') + " " + percentChar + '\n';
        return toolTipString;
    }

    get isEnabled() {
        return this.applet.Swap_enabled;
    }

    get isEnabledTooltip() {
        return this.applet.Swap_enabledTooltip;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

class MultiCpuDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('CPU');
        this.prevData = [];
        this.currentReadings = [];
    }

    getColorList() {
        var colorList = [];
        let nb = this.CPUCount;
        if (this.applet.CPU_showLoadOverTime === true && this.applet.CPU_mergeAll && this.applet.CPU_ignoreHyperthreading)
            nb = this.applet.CPU_showLoadOverTimeHowManyBars;
        for (let i=0; i<nb ; i++) {
            let n = i % 4;
            colorList.push(this.applet[`CPU_color${n}`]);
        }
        return colorList;
    }

    getData() {
        if (!this.isEnabled && !this.isEnabledTooltip) return [];
        return this.currentReadings;
    }

    setData(data) {
        if (this.applet.hyperThreadingIsOn && this.applet.CPU_mergeAll && this.applet.CPU_ignoreHyperthreading && data[0] && !this.applet.CPU_showLoadOverTime) {
            data[0] = Math.min(2 * data[0], 1);
        }
        this.currentReadings = data;
    }

    getTooltipString() {
        if (! this.isEnabledTooltip) return "";
        if (! this.isRunning) return "";
        let trans = _("CPUs");
        if (this.applet.CPU_showTemp && this.applet.CPU_temperature) {
            let temperature = 1 * this.applet.CPU_temperature;
            let degree = (this.applet.CPU_tempInFahrenheit) ?  "°F" : "°C";
            temperature = "" + temperature + degree;
            trans += " " + temperature;
        }
        let len = trans.length - 2;
        var toolTipString = "-".repeat(Math.trunc((2*(spaces + 1) - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*(spaces + 1) - len)/2)) + '\n';

        let colon = _(":");
        let lenColon = Math.max(colon.length - 1, 0);
        let percentChar = "%";
        if (this.applet.percentAtEndOfLine)
            percentChar = "%".padStart(9, " ");

        if (this.applet.CPU_showLoadOverTime) {
            let percentage = formatNumber(parseInt(100 * this.currentReadings[this.currentReadings.length - 1]), 0);
            var percentage_str = "" + percentage;
            percentage_str = percentage_str.padStart(4);
            toolTipString += (_('CPU') + ' ').padStart(spaces - lenColon, ' ');
            toolTipString += colon + '\t' + " " + percentage_str + " " + percentChar + '\n';
        } else {
            for (let i = 0; i < this.CPUCount; i++) {
                let percentage = formatNumber(parseInt(100 * this.currentReadings[i]), 0);
                var percentage_str = "" + percentage;
                percentage_str = percentage_str.padStart(4);
                if (this.applet.CPU_mergeAll) {
                    toolTipString += (_('CPU') + ' ').padStart(spaces - lenColon, ' ');
                } else {
                    toolTipString += (_('Core') + ' ' + i).padStart(spaces - lenColon, ' ');
                }
                toolTipString += colon + '\t' + " " + percentage_str + " " + percentChar + '\n';
            }
        }
        return toolTipString;
    }

    get CPUCount() {
        return this.currentReadings.length;
    }

    get isEnabled() {
        return this.applet.CPU_enabled;
    }

    get isEnabledTooltip() {
        return this.applet.CPU_enabledTooltip;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

class NetDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('NET');
        this.disabledDevices = [];
        this.inTotalDevices = [];
        this.totalAmountCurrent = [0, 0];
        this.totalAmountPrevious = [0, 0];
        this.currentReadings = [];
        this.lastUpdatedTime = Date.now();
        if (this.applet.Net_mergeAll) {
            this.currentReadings.push({
                "id": "Net",
                "name": _("Network"),
                "up": 0,
                "down": 0,
                "tooltipUp": 0,
                "tooltipDown": 0,
                "lastReading": [0, 0],
                "readingRatesList": [0, 0]
            });
            return;
        }
        for (let dev of this.applet.Net_devicesList) {
            if (! dev["enabled"]) {
                this.disabledDevices.push(dev["id"]);
                continue;
            } else {
                if (dev["inTotal"]) this.inTotalDevices.push(dev["id"]);
            }

            this.currentReadings.push({
                "id": dev["id"],
                "name": (dev["name"].length === 0) ? dev["id"] : dev["name"],
                "up": 0,
                "down": 0,
                "tooltipUp": 0,
                "tooltipDown": 0,
                "lastReading": [0, 0],
                "readingRatesList": [0, 0]
            });

        }
    }

    getColorList() {
        var colorList = [];
        for (let dev of this.applet.Net_devicesList) {
            if (dev.enabled === true) {
                 colorList = colorList.concat([this.applet.colors[dev.colorDown], this.applet.colors[dev.colorUp]]);
            }
        }
        return colorList;
    }

    getData() {
        if (!this.isEnabled && !this.isEnabledTooltip) return [];
        return this.currentReadings;
    }

    setData(data, disabledDevices) {
        this.disabledDevices = disabledDevices;
        var dataIds = [];
        for (let d of data) {
            if (dataIds.indexOf(d["id"]) < 0)
                dataIds.push(d["id"])
        }
        const newUpdateTime = Date.now();
        const secondsSinceLastUpdate = (newUpdateTime - this.lastUpdatedTime) / 1000;

        var currentAmount = [0, 0];
        var previousAmount = [0, 0];
        for (let i = 0, len = this.currentReadings.length; i < len; i++) {
            let data_index = dataIds.indexOf(this.currentReadings[i]["id"]);
            if (data_index < 0) continue;
            this.currentReadings[i]["down"] = data[data_index]["down"];
            this.currentReadings[i]["up"] = data[data_index]["up"];
            if (this.inTotalDevices.indexOf(this.currentReadings[i]["id"] > -1)) {
                previousAmount[0] = previousAmount[0] + this.currentReadings[i].lastReading[0];
                previousAmount[1] = previousAmount[1] + this.currentReadings[i].lastReading[1];
                currentAmount[0] = currentAmount[0] + this.currentReadings[i]["down"];
                currentAmount[1] = currentAmount[1] + this.currentReadings[i]["up"];
            }

            if (this.currentReadings[i].lastReading[0] === 0 && this.currentReadings[i].lastReading[1] === 0) {
                this.currentReadings[i].lastReading[0] = this.currentReadings[i]["down"];
                this.currentReadings[i].lastReading[1] = this.currentReadings[i]["up"];
                continue
            }

            this.currentReadings[i].tooltipDown = Math.abs(Math.round(
                ((this.currentReadings[i]["down"] - this.currentReadings[i].lastReading[0]) / secondsSinceLastUpdate)
            ));
            this.currentReadings[i].tooltipUp = Math.abs(Math.round(
                ((this.currentReadings[i]["up"] - this.currentReadings[i].lastReading[1]) / secondsSinceLastUpdate)
            ));

            this.currentReadings[i].lastReading[0] = this.currentReadings[i]["down"];
            this.currentReadings[i].lastReading[1] = this.currentReadings[i]["up"];

            this.currentReadings[i].readingRatesList[0] = this.currentReadings[i].tooltipDown;
            this.currentReadings[i].readingRatesList[1] = this.currentReadings[i].tooltipUp;
        }
        this.totalAmountPrevious[0] = previousAmount[0];
        this.totalAmountPrevious[1] = previousAmount[1];
        this.totalAmountCurrent[0] = currentAmount[0];
        this.totalAmountCurrent[1] = currentAmount[1];

        this.lastUpdatedTime = newUpdateTime;
    }

    getTooltipString() {
        if (! this.isEnabledTooltip) return "";
        if (! this.isRunning) return "";
        let trans = _("Networks");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*(spaces + 1) - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*(spaces + 1) - len)/2)) + '\n';

        for (let i = 0, len = this.currentReadings.length; i < len; i++) {
            if (!this.currentReadings[i].tooltipDown) {
                this.currentReadings[i].tooltipDown = 0;
            }
            if (!this.currentReadings[i].tooltipUp) {
                this.currentReadings[i].tooltipUp = 0;
            }
            let [down_value, down_unit] = formatBytesValueUnit(parseFloat(this.currentReadings[i].tooltipDown).toFixed(2), 2);
            if (isNaN(down_value) || (typeof(down_value) === "string" && down_value.length <= 1)) {
                down_value = formatNumber("0.00", 2);
                down_unit = "B" + rate;
            } else {
                down_value = formatNumber(parseFloat(down_value).toFixed(2), 2);
            }
            let [up_value, up_unit] = formatBytesValueUnit(parseFloat(this.currentReadings[i].tooltipUp).toFixed(2), 2);
            if (isNaN(up_value) || (typeof(up_value) === "string" && up_value.length <= 1)) {
                up_value = formatNumber("0.00", 2);
                up_unit = "B" + rate;
            } else {
                up_value = formatNumber(parseFloat(up_value).toFixed(2), 2);
            }
            let name = (this.currentReadings[i]['name'].length === 0) ? this.currentReadings[i].id : this.currentReadings[i].name;
            toolTipString += name.padEnd(22) + '\n';

            if (this.applet.Net_symbolsInTooltip) {
                toolTipString += (' ▼︎' + _(':')).split(':')[0].padStart(spaces + 1, ' ') + ':' + "\t" + "" + down_value.padStart(8) + " " + down_unit.padStart(6, ' ') + '\n';
                toolTipString += (' ▲' + _(':')).split(':')[0].padStart(spaces, ' ') + ':'  + "\t" + "" + up_value.padStart(8) + " " + up_unit.padStart(6, ' ') + '\n';
            } else {
                toolTipString += _('Down:').split(':')[0].padStart(spaces, ' ') + ':' + "\t" + "" + down_value.padStart(8) + " " + down_unit.padStart(6, ' ') + '\n';
                toolTipString += _('Up:').split(':')[0].padStart(spaces, ' ') + ':'  + "\t" + "" + up_value.padStart(8) + " " + up_unit.padStart(6, ' ') + '\n';
            }
        }
        return toolTipString;
    }

    get isEnabled() {
        return this.applet.Net_enabled;
    }

    get isEnabledTooltip() {
        return this.applet.Net_enabledTooltip;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

class DiskDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('DISK');

        this.disabledDevices = [];
        this.currentReadings = [];
        this.totalAmountCurrent = [0, 0];
        this.totalAmountPrevious = [0, 0];
        this.lastUpdatedTime = Date.now();

        if (this.applet.Disk_mergeAll) {
            this.currentReadings.push({
                "id": "Disks",
                "name": _("Disks"),
                "read": 0,
                "write": 0,
                "tooltipRead": 0,
                "tooltipWrite": 0,
                "lastReading": [0, 0],
                "readingRatesList": [0, 0]
            });
            return;
        }
        for (let dev of this.applet.Disk_devicesList) {
            if (! dev["enabled"]) {
                this.disabledDevices.push(dev["id"]);
                continue;
            }
            this.currentReadings.push({
                "id": dev["id"],
                "name": (dev["name"].length === 0) ? dev["id"] : dev["name"],
                "read": 0,
                "write": 0,
                "tooltipRead": 0,
                "tooltipWrite": 0,
                "lastReading": [0, 0],
                "readingRatesList": [0, 0]
            });

        }
    }

    getColorList() {
        var colorList = [];
        for (let dev of this.applet.Disk_devicesList) {
            if (dev.enabled === true) {
                 colorList = colorList.concat([this.applet.colors[dev.colorRead], this.applet.colors[dev.colorWrite]]);
            }
        }
        return colorList;
    }

    setData(data) {
        var dataIds = [];
        for (let d of data) {
            if (dataIds.indexOf(d["id"]) < 0)
                dataIds.push(d["id"])
        }
        const newUpdateTime = Date.now();
        const secondsSinceLastUpdate = (newUpdateTime - this.lastUpdatedTime) / 1000;

        var currentAmount = [0, 0];
        var previousAmount = [0, 0];

        for (let i = 0, len = this.currentReadings.length; i < len; i++) {
            let data_index = dataIds.indexOf(this.currentReadings[i]["id"]);
            if (data_index < 0) continue;
            this.currentReadings[i].read = data[data_index]["read"];
            this.currentReadings[i].write = data[data_index]["write"];
            currentAmount[0] = currentAmount[0] + this.currentReadings[i].read;
            currentAmount[1] = currentAmount[1] + this.currentReadings[i].write;
            previousAmount[0] = previousAmount[0] + this.currentReadings[i].lastReading[0];
            previousAmount[1] = previousAmount[1] + this.currentReadings[i].lastReading[1];

            this.currentReadings[i].tooltipRead = Math.round(
                ((this.currentReadings[i].read - this.currentReadings[i].lastReading[0]) / secondsSinceLastUpdate)
            );
            this.currentReadings[i].tooltipWrite = Math.round(
                ((this.currentReadings[i].write - this.currentReadings[i].lastReading[1]) / secondsSinceLastUpdate)
            );

              this.currentReadings[i].lastReading[0] = this.currentReadings[i].read;
              this.currentReadings[i].lastReading[1] = this.currentReadings[i].write;

              this.currentReadings[i].readingRatesList[0] = Math.round(this.currentReadings[i].tooltipRead / 1024);
              this.currentReadings[i].readingRatesList[1] = Math.round(this.currentReadings[i].tooltipWrite / 1024);
        }

        this.totalAmountPrevious[0] = previousAmount[0];
        this.totalAmountPrevious[1] = previousAmount[1];
        this.totalAmountCurrent[0] = currentAmount[0];
        this.totalAmountCurrent[1] = currentAmount[1];

        this.lastUpdatedTime = newUpdateTime;
    }

    getData() {
        if (!this.isEnabled && !this.isEnabledTooltip) return [];
        return this.currentReadings;
    }

    getTooltipString() {
        if (!this.isEnabledTooltip) {
            return "";
        }
        let trans = _("Disks");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*(spaces + 1) - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*(spaces + 1) - len)/2)) + '\n';
        let title = "" + toolTipString;

        for (let i = 0, len = this.currentReadings.length; i < len; i++) {
            if (!this.currentReadings[i]) {
                continue;
            }
            let [read, read_unit] = formatBytesValueUnit(this.currentReadings[i].tooltipRead, 2);
            let [write, write_unit] = formatBytesValueUnit(this.currentReadings[i].tooltipWrite, 2);
            if (isNaN(read) || (typeof(read) === "string" && read.length <= 1)) {
                read = formatNumber("0.00", 2);
                read_unit = "B" + rate;
            } else {
                read = formatNumber(parseFloat(read).toFixed(2), 2);
            }
            if (isNaN(write) || (typeof(write) === "string" && write.length <= 1)) {
                write = formatNumber("0.00", 2);
                write_unit = "B" + rate;
            } else {
                write = formatNumber(parseFloat(write).toFixed(2), 2);
            }
            if (this.currentReadings[i].name != this.currentReadings[i].id)
                toolTipString += this.currentReadings[i].name.padStart(1, " ").padEnd(title.length - this.currentReadings[i].id.length - 1, " ") + this.currentReadings[i].id + '\n';
            else
                toolTipString += this.currentReadings[i].name.padEnd(22) + '\n';

            if (this.applet.Disk_symbolsInTooltip) {
                toolTipString += (' ▲' + _(':')).split(':')[0].padStart(spaces, ' ') + ':' + "\t" + "" + read.padStart(8, " ") + " " + read_unit.padStart(6, " ") + '\n';
                toolTipString += (' ▼︎' + _(':')).split(':')[0].padStart(spaces + 1, ' ') + ':' + "\t" + "" + write.padStart(8, " ") + " " + write_unit.padStart(6, " ") + '\n';
            } else {
                toolTipString += _('Read:').split(':')[0].padStart(spaces, ' ') + ':' + "\t" + "" + read.padStart(8, " ") + " " + read_unit.padStart(6, " ") + '\n';
                toolTipString += _('Write:').split(':')[0].padStart(spaces, ' ') + ':' + "\t" + "" + write.padStart(8, " ") + " " + write_unit.padStart(6, " ") + '\n';
            }
        }
        return toolTipString;
    }

    get isEnabled() {
        return this.applet.Disk_enabled;
    }

    get isEnabledTooltip() {
        return this.applet.Disk_enabledTooltip;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

class DiskUsageDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('DISK');
        this.currentReadings = [];
    }

    setData(data) {
        this.currentReadings = data;
    }

    getColorList() {
        return [this.applet.DiskUsage_colorFree, this.applet.DiskUsage_colorUsed];
    }

    getData() {
        if (!this.isEnabled && !this.isEnabledTooltip) return [];
        return this.currentReadings;
    }

    getTooltipString() {
        if (!this.isEnabledTooltip) {
            return "";
        }
        let trans = _("Usage");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*(spaces + 1) - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*(spaces + 1) - len)/2)) + '\n';
        let title = "" + toolTipString;

        let colon = _(":");
        let lenColon = Math.max(colon.length - 1, 0);
        let percentChar = "%";
        if (this.applet.percentAtEndOfLine)
            percentChar = "%".padStart(9, " ");

        var names = [];
        for (let p of this.applet.DiskUsage_pathList) {
            if (! p["enabled"]) continue;
            if (p["name"].length != 0) {
                names.push(p["name"])
            } else if (p["path"].length != 0) {
                names.push(p["path"])
            }
        }

        for (let i=0, len=this.currentReadings.length; i<len; i++) {
            let percentage = Math.round(100 * this.currentReadings[i].value, 2);
            let maxPercentage = Math.round(100 * this.currentReadings[i].maxvalue, 2);
            if (this.applet.DiskUsage_mergeAll) {
                if (percentage < maxPercentage)
                    toolTipString += (_('Disks') + ' ').padStart(spaces - lenColon, ' ') + colon + '\t ' + formatNumber(percentage, 0).padStart(4, ' ') + " " + percentChar + '\n';
                else
                    toolTipString += (_('Disks') + ' ').padStart(spaces - lenColon, ' ') + colon + '\t <b>' + formatNumber(percentage, 0).padStart(4, ' ') + " " + percentChar + '</b>\n';
            } else {
                let name = names[i];
                if (percentage < maxPercentage)
                    toolTipString += name.padStart(spaces - lenColon, ' ') + colon + '\t ' + formatNumber(percentage, 0).padStart(4, ' ') + " " + percentChar + '\n';
                else
                    toolTipString += name.padStart(spaces - lenColon, ' ') + colon + '\t <b>' + formatNumber(percentage, 0).padStart(4, ' ') + " " + percentChar + '</b>\n';
            }
        }

        return toolTipString;
    }

    get PathCount() {
        return this.currentReadings.length;
    }

    get isEnabled() {
        return this.applet.DiskUsage_enabled;
    }

    get isEnabledTooltip() {
        return this.applet.DiskUsage_enabledTooltip;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

class BatteryDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('BAT');
        this.currentReadings = [];
    }

    setData(data) {
        this.currentReadings = data;
    }

    getColorList() {
        //~ return [this.applet.Battery_colorLoad, this.applet.Battery_colorUnload];
        return [this.applet.Battery_colorUnload, this.applet.Battery_colorLoad];
    }

    getData() {
        if (!this.isEnabled && !this.isEnabledTooltip) return [];
        return this.currentReadings;
    }

    getTooltipString() {
        if (!this.isEnabledTooltip) {
            return "";
        }
        let trans = _("Battery");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*(spaces + 1) - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*(spaces + 1) - len)/2)) + '\n';
        let title = "" + toolTipString;

        let colon = _(":");
        let lenColon = Math.max(colon.length - 1, 0);
        let percentChar = "%";
        if (this.applet.percentAtEndOfLine)
            percentChar = "%".padStart(6, " ");

        var names = [];
        var health = [];
        for (let b of this.applet.Battery_devicesList) {
            if (! b["enabled"] || b["id"].length < 2) continue;
            if (b["name"].length != 0) {
                names.push(b["name"])
            } else if (b["id"].length != 0) {
                names.push(b["id"])
            }
            health.push(this.applet.battery_capacity[b["id"]]);
        }

        for (let i=0, len=this.currentReadings.length; i<len; i++) {
            let percentage = Math.round(10000 * this.currentReadings[i].value) / 100;
            let minPercentage = Math.round(10000 * this.currentReadings[i].minvalue) / 100;
            if (this.applet.DiskUsage_mergeAll) {
                if (percentage > minPercentage)
                    toolTipString += (_('Batteries') + ' ').padStart(spaces - lenColon, ' ') + colon + '\t ' + formatNumber(percentage, 0).padStart(4, ' ') + " " + percentChar + '\n';
                else
                    toolTipString += (_('Batteries') + ' ').padStart(spaces - lenColon, ' ') + colon + '\t <b>' + formatNumber(percentage, 0).padStart(4, ' ') + " " + percentChar + '</b>\n';
            } else {
                let name = names[i];
                //~ let capacity = Math.round(health[i][1] / health[i][0] * 10000) / 100;
                let capacity = formatNumber(health[i][1] / health[i][0] * 100, 1);
                if (percentage > minPercentage) {
                    //~ toolTipString += (name + " (" + capacity.toString() + "%)").padStart(spaces - lenColon, ' ') + colon + '\t ' + formatNumber(percentage, 2).padStart(7, ' ') + " " + percentChar + '\n';
                    toolTipString += (name + " (" + capacity + "%)").padStart(spaces - lenColon, ' ') + colon + '\t ' + formatNumber(percentage, 2).padStart(7, ' ') + " " + percentChar + '\n';
                } else {
                    //~ toolTipString += (name + " (" + capacity.toString() + "%)").padStart(spaces - lenColon, ' ') + colon + '\t <b>' + formatNumber(percentage, 2).padStart(7, ' ') + " " + percentChar + '</b>\n';
                    toolTipString += (name + " (" + capacity.toString() + "%)").padStart(spaces - lenColon, ' ') + colon + '\t <b>' + formatNumber(percentage, 2).padStart(7, ' ') + " " + percentChar + '</b>\n';
                }
            }
        }

        return toolTipString;
    }

    get PathCount() {
        return this.currentReadings.length;
    }

    get isEnabled() {
        return this.applet.Battery_enabled;
    }

    get isEnabledTooltip() {
        return this.applet.Battery_enabledTooltip;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MCSM(metadata, orientation, panel_height, instance_id);
}

