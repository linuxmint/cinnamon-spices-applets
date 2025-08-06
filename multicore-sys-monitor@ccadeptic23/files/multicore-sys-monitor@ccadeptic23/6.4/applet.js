//!/usr/bin/cjs
const Gettext = imports.gettext;
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const appSystem = imports.gi.Cinnamon.AppSystem.get_default();
const Util = imports.misc.util;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const {
  reloadExtension,
  Type
} = imports.ui.extension; //Extension

const { to_string } = require("./lib/tostring");
const Graphs = require('./lib/Graphs');
const {
  timeout_add_seconds,
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

const indent = '    ';
const rate = _('/s');
const spaces = 12;

const properties = [
    {graph: 'multiCpuGraph', provider: 'multiCpuProvider', abbrev: 'CPU'},
    {graph: 'memoryGraph', provider: 'memoryProvider', abbrev: 'Mem'},
    {graph: 'swapGraph', provider: 'swapProvider', abbrev: 'Swap'},
    {graph: 'networkGraph', provider: 'networkProvider', abbrev: 'Net'},
    {graph: 'diskGraph', provider: 'diskProvider', abbrev: 'Disk'}
];


const formatBytes = (bytes, decimals=2)=>{
    if (bytes < 1) {
        return '0'.padStart(spaces/2 - 1) + '.00'.padEnd(spaces/2 - 1) + 'B'.padStart(3, ' ') + rate;
    }
    let k = 1000;
    let dm = decimals + 1 || 3;
    let sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let i = Math.min(Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))), 8);
    let value;
    if (isNaN(i)) {
        i = 0;
        value = "0";
    } else {
        value = (bytes / Math.pow(k, i)).toPrecision(dm).toString();
    }
    let parts = value.split('.');
    let dec_part = (parts.length === 2) ? '.' + parts[1].toString().padEnd(2, '0') : '.00';
    return parts[0].padStart(spaces/2 - 1) + dec_part.padEnd(spaces/2 - 1) + sizes[i].padStart(3, ' ') + rate;
};



Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans.length > 0 && customTrans !== str)
        return customTrans;
    return Gettext.gettext(str);
}

class MCSM extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.orientation = orientation;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;
        this.instance_id = instance_id;

        Util.spawnCommandLineAsync("bash -c 'cd %s && chmod 755 *.sh'".format(PATH2SCRIPTS));

        if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
            this._applet_tooltip._tooltip.set_style('text-align: right; font-family: monospace;');
        } else {
            this._applet_tooltip._tooltip.set_style('text-align: left; font-family: monospace;');
        }

        this.settings = new AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("CPU_useProgressiveColors", "CPU_useProgressiveColors", null);
        this.settings.bind("CPU_byActivity", "CPU_byActivity", () => { this.on_CPU_byActivity_changed(); });
        this.settings.bind("Net_devicesList", "Net_devicesList");
        this.settings.bind("Disk_devicesList", "Disk_devicesList");
        this.settings.bind("labelsOn", "labelsOn");
        this.settings.bind("CPU_labelOn", "CPU_labelOn");
        this.settings.bind("Mem_labelOn", "Mem_labelOn");
        this.settings.bind("Net_labelOn", "Net_labelOn");
        this.settings.bind("Disk_labelOn", "Disk_labelOn");
        this.settings.bind("thickness", "thickness");
        this.settings.bind("useIconSize", "useIconSize");
        this.settings.bind("refreshRate", "refreshRate");
        this.settings.bind("labelColor", "labelColor");
        this.settings.bind("backgroundColor", "backgroundColor");
        this.settings.bind("CPU_enabled", "CPU_enabled");
        this.settings.bind("CPU_squared", "CPU_squared");
        this.settings.bind("CPU_width", "CPU_width");
        this.settings.bind("CPU_mergeAll", "CPU_mergeAll");
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
        this.settings.bind("Mem_squared", "Mem_squared");
        this.settings.bind("Mem_width", "Mem_width");
        this.settings.bind("Mem_startAt12Oclock", "Mem_startAt12Oclock");
        this.settings.bind("Mem_colorUsedup", "Mem_colorUsedup");
        this.settings.bind("Mem_colorCached", "Mem_colorCached");
        this.settings.bind("Mem_colorBuffer", "Mem_colorBuffer");
        this.settings.bind("Mem_colorFree", "Mem_colorFree");
        this.settings.bind("Mem_colorSwap", "Mem_colorSwap");
        this.settings.bind("Net_enabled", "Net_enabled");
        this.settings.bind("Net_squared", "Net_squared");
        this.settings.bind("Net_width", "Net_width");
        this.settings.bind("Net_mergeAll", "Net_mergeAll");
        this.settings.bind("Net_autoscale", "Net_autoscale");
        this.settings.bind("Net_logscale", "Net_logscale");
        this.settings.bind("Disk_enabled", "Disk_enabled");
        this.settings.bind("Disk_squared", "Disk_squared");
        this.settings.bind("Disk_width", "Disk_width");
        this.settings.bind("Disk_mergeAll", "Disk_mergeAll");
        this.settings.bind("Disk_autoscale", "Disk_autoscale");
        this.settings.bind("Disk_logscale", "Disk_logscale");
        for (let i=0; i<16; i++)
            this.settings.bind(`color${i}`, `color${i}`, () => { this.on_color_changed() });

        this.on_color_changed();
        this.useSymbolicIcon = true;
        if (this.without_any_graph)
            this.setIcon();
        //~ global.log("ICON SIZE: " + this.getPanelIconSize(St.IconType.FULLCOLOR));
        this.iconSize = this.getPanelIconSize(St.IconType.FULLCOLOR);
        if (this.useIconSize)
            this.panelHeight = this.iconSize;
        else
            this.panelHeight = this._panelHeight;

        // Is the user a sudoer?
        var user = GLib.get_user_name();
        const HOME_DIR = GLib.get_home_dir();
        const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
        const SCRIPTS_DIR = APPLET_DIR + "/scripts";
        let command = SCRIPTS_DIR + "/get-sudoers.sh";
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

        this.isRunning = true;

        this.memoryProvider = new MemDataProvider(this);
        this.multiCpuProvider = new MultiCpuDataProvider(this);
        this.swapProvider = new SwapDataProvider(this);
        this.networkProvider = new NetDataProvider(this);
        this.diskProvider = new DiskDataProvider(this);

        this._initContextMenu();

        this.graphArea = new St.DrawingArea();
        this.graphArea.width = 1;
        //~ global.log(UUID + " - this._panelHeight: " + this._panelHeight);
        //~ global.log(UUID + " - this.panelHeight: " + this.panelHeight);
        this.graphArea.height = this.panelHeight * global.ui_scale;

        this.graphArea.connect('repaint', (area) => this.onGraphRepaint(area));

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

        this.actor.add_actor(this.graphArea);
    }

    onGraphRepaint(area) {
        if (this.without_any_graph) return;
        let xOffset = 0;
        for (let i = 0; i < properties.length; i++) {
            if (properties[i].abbrev === 'Swap') {
                continue;
            }
            //~ global.log(UUID + " - abbrev:" + properties[i].abbrev);
            if (this[properties[i].provider].isEnabled) {
                // translate origin to the new location for the graph
                let areaContext = area.get_context();
                areaContext.translate(xOffset, 0);
                let width = (this[`${properties[i].abbrev}_squared`] === true) ? this.panelHeight : this[`${properties[i].abbrev}_width`] * global.ui_scale;
                if (properties[i].abbrev === 'Mem') {
                    // paint the "swap" backdrop
                    this.swapGraph.paint(
                        this.swapProvider.name,
                        this.swapProvider.currentReadings,
                        area,
                        areaContext,
                        // no label for the backdrop
                        false,
                        width - 2 * global.ui_scale,
                        this.panelHeight - 2 * global.ui_scale,
                        [0, 0, 0, 0],
                        // clear background so that it doesn't mess up the other one
                        [0, 0, 0, 0],
                        [this.Mem_colorSwap]
                        //~ this.configSettings._prefs.mem.swapcolors
                    );
                }
                let labelOn = this[`${properties[i].abbrev}_labelOn`];
                this[properties[i].graph].paint(
                    this[properties[i].provider].name,
                    this[properties[i].provider].currentReadings,
                    area,
                    areaContext,
                    this.labelsOn && labelOn,
                    width,
                    this.panelHeight - 2 * global.ui_scale,
                    this.labelColor,
                    this.backgroundColor,
                    this[properties[i].provider].getColorList()
                );
                // return translation to origin
                areaContext.translate(-xOffset, 0);
                // update xOffset for next translation
                xOffset += width + 1;
            }
        }
        area.set_width(xOffset > 1 ? xOffset - 1 : 1);
        area.set_height(this.panelHeight);
    }

    _initContextMenu() {
        let menuChildren = null;
        if (this.restart_menu_item) {
            let children = this._applet_context_menu._getMenuItems();
            children[0].destroy();
        }
        this.restart_menu_item = new Applet.MenuItem(_('Refresh All'), Gtk.STOCK_REFRESH, () => {
            this.refreshAll()
        });
        this._applet_context_menu.addMenuItem(this.restart_menu_item, 0);

        if (this.wo_graphs_item || this.w_graphs_item) {
            let children = this._applet_context_menu._getMenuItems();
            children[1].destroy();
        }
        if (!this.without_any_graph) {
            this.wo_graphs_item = new Applet.MenuItem(_('Without any graphics'), Gtk.STOCK_REMOVE, () => {
                GLib.file_set_contents(this.metadata.path+"/WOGRAPH", "");
                this.refreshAll()
            });
            this._applet_context_menu.addMenuItem(this.wo_graphs_item, 1);
        } else {
            this.w_graphs_item = new Applet.MenuItem(_('With graphics'), Gtk.STOCK_REMOVE, () => {
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
        //~ this.out_reader = null;
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

    on_Net_getdevlist_btn_clicked() {
        let subProcess = Util.spawnCommandLineAsyncIO(PATH2SCRIPTS + "/get-network-devices.sh", (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                var knownDevices = [];
                var new_Net_devicesList = this.Net_devicesList;
                for (let d of this.Net_devicesList) {
                    if (d["id"].length === 0) continue;
                    knownDevices.push(d["id"]);
                }
                var returnedDevices = stdout.trim().split(" ");
                for (let d of returnedDevices) {
                    let [dev, status] = d.split(":");
                    if (knownDevices.indexOf(dev) < 0) {
                        if (status === "up" || status === "down") {
                            new_Net_devicesList.push({
                                "enabled": status === "up",
                                "id": dev,
                                "name": dev,
                                "colorDown": (knownDevices.length * 2) % 16,
                                "colorUp": (knownDevices.length * 2 + 1) % 16
                            });
                            knownDevices.push(dev);
                        }
                    }
                }
                this.Net_devicesList = new_Net_devicesList;
            }
            subProcess.send_signal(9);
        });
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
                        let discGran = child["disc-gran"];
                        if (knownDevices.indexOf(mntName) < 0) {
                            new_Disk_devicesList.push({
                                "enabled": true,
                                "id": mntName,
                                "name": (mntPoint.length > 0) ? mntPoint : mntName,
                                "discGran": discGran,
                                "colorRead": (knownDevices.length * 2) % 16,
                                "colorWrite": (knownDevices.length * 2 + 1) % 16
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

    on_Disk_cleardevlist_btn_clicked() {
        this.Disk_devicesList = [];
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
        for (let i=0; i<16; i++) {
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
        let subProcess = Util.spawnCommandLineAsyncIO(PATH2SCRIPTS + "/get-mem-data.sh", (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                //~ global.log(UUID + " - stdout is a " + typeof stdout);
                let [, dataMem, dataSwap] = stdout.split(":");
                dataMem = dataMem.trim();
                //~ var i = 0;
                while (dataMem.includes("  ") && i < 10) {
                    //~ i++;
                    dataMem = dataMem.replace(/\ \ /g, " ");
                }
                //~ global.log(UUID + " - dataMem: " + dataMem);
                dataSwap = dataSwap.trim();
                while (dataSwap.includes("  ") && i < 10) {
                    //~ i++;
                    dataSwap = dataSwap.replace(/\ \ /g, " ");
                }
                //~ global.log(UUID + " - dataSwap: " + dataSwap);
                //~ 16485462016  3414532096   500703232   278343680  4845682688  8356085760 13070929920
                let [total, used, shared, buffers, cache, available] = dataMem.split(" ");
                let [swapTotal, swapUsed, swapAvailable] = dataSwap.split(" ");
                this.memoryProvider.setData(used / total, cache / total, buffers / total, (total - used - cache - buffers) / total);
                this.swapProvider.setData(swapTotal, swapUsed / swapTotal);
                //~ global.log(this.memoryProvider.getTooltipString());
            }
            subProcess.send_signal(9);
        });
    }

    get_cpu_info() {
        if (!this.isRunning) return;
        let subProcess = Util.spawnCommandLineAsyncIO(PATH2SCRIPTS + "/get-cpu-data3.sh", (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                let cpuString = stdout.trim();
                var data = [];
                let values = cpuString.split(" ");
                if (this.oldCPUvalues.length === 0) { // first execution
                    if (this.CPU_mergeAll) {
                        data.push(0);
                    } else {
                        for (let i=0, len=values.length; i<len; i++)
                            data.push(0);
                    }
                } else { // next executions
                    if (this.CPU_mergeAll) {
                        data.push(parseFloat(values[0]) / 100);
                    } else {
                        let i = 0;
                        for (let v of values) {
                            if (i === 0) {
                                i++;
                                continue;
                            }
                            data.push(parseFloat(v) / 100);
                            i++;
                        }
                    }
                }
                this.oldCPUvalues = values;

                this.multiCpuProvider.setData(data);
            }
            subProcess.send_signal(9);
        });
    }

    get_net_info() {
        if (!this.isRunning) return;
        let subProcess = Util.spawnCommandLineAsyncIO(PATH2SCRIPTS + "/get-network-data.sh", (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                //~ global.log(UUID + " - stdout is a " + typeof stdout);
                //~ global.log(UUID + " - stdout: " + stdout);
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
                let netInfo = stdout.trim().split(" ");
                var sum_rx = 0;
                var sum_tx = 0;
                for (let info of netInfo) {
                    let [iface, rx, tx] = info.split(":");
                    if (allowedInterfaces.indexOf(iface) < 0) {
                        disabledDevices.push(iface);
                        continue;
                    }
                    if (this.Net_mergeAll) {
                        sum_rx = sum_rx + Math.trunc(rx);
                        sum_tx = sum_tx + Math.trunc(tx);
                    } else {
                        data.push({
                            "id": iface,
                            "name": names[iface],
                            "up": Math.trunc(tx),
                            "down": Math.trunc(rx)
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
            subProcess.send_signal(9);
        });
    }

    get_disk_info() {
        if (!this.isRunning) return;
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
        let diskstats = (to_string(GLib.file_get_contents("/proc/diskstats")[1])).trim().split("\n");
        //~ global.log(UUID + " - diskstats:\n" + diskstats);
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
                sum_read = sum_read + _read;
                sum_write = sum_write + _write;
            } else {
                data.push({
                    "id": _dev,
                    "name": deviceNames[_dev],
                    "read": _read,
                    "write": _write
                });
            }
            //~ global.log(UUID + " - line:\n" + line);

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
        //~ global.log(UUID + " - data:\n" + JSON.stringify(data, null, "\t"));

    }

    _setTooltip() {
        if (!this.isRunning) return;
        var appletTooltipString = "";
        appletTooltipString += this.multiCpuProvider.getTooltipString();
        appletTooltipString += this.memoryProvider.getTooltipString();
        appletTooltipString += this.swapProvider.getTooltipString();
        appletTooltipString += this.networkProvider.getTooltipString();
        appletTooltipString += this.diskProvider.getTooltipString();

        if (this.hovered)
            this.set_applet_tooltip(appletTooltipString);
    }

    refreshAll() {
        reloadExtension(UUID, Type.APPLET);
    }

    on_applet_clicked(event) {
        this._runSysMon();
    }

    on_applet_added_to_panel() {
        this.isRunning = true;
        timeout_add(this.refreshRate, () => {
            this.get_mem_info();
            this.get_cpu_info();
            this.get_net_info();
            this.get_disk_info();
            this._setTooltip();
            this.graphArea.queue_repaint();
            //~ this.onGraphRepaint(this.graphArea);
            //~ this.graphArea.emit('repaint');

            return this.isRunning;
        });
    }

    on_applet_removed_from_panel() {
        this.isRunning = false;
        remove_all_sources();
    }

}

class MemDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('MEM');
        //~ this.isEnabled = this.applet.Mem_enabled;
        this.memusage = 0;
        this.currentReadings = [0, 0, 0, 0];
    }

    getColorList() {
        let types = ["Usedup", "Cached", "Buffer", "Free", "Swap"]
        var colorList = [];
        for (let t of types)
            colorList.push(this.applet[`Mem_color${t}`]);
        return colorList;
    }

    getData() {
        if (!this.isEnabled) return [];
        return this.currentReadings;
    }

    setData(used, shared, buffers, cache) {
        this.currentReadings = [
            Math.round(used*10000) / 10000,
            Math.round(shared*10000) / 10000,
            Math.round(buffers*10000) / 10000,
            Math.round(cache*10000) / 10000
        ];
    }

    getTooltipString() {
        if (! this.isEnabled) return "";
        if (! this.isRunning) return "";
        let toolTipString = _('----------- Memory -----------') + '\n';
        let attributes = [_('Used:'), _('Cached:'), _('Buffer:'), _('Free:')];
        for (let i = 0; i < attributes.length; i++) {
            toolTipString += (attributes[i]).split(':')[0].padStart(spaces, ' ') + ':\t' + Math.round(100 * this.currentReadings[i]).toString().padStart(2, ' ') + ' %\n';
        }
        return toolTipString;
    }

    get isEnabled() {
        return this.applet.Mem_enabled;
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
        this.currentReadings = [0];
    }

    getColorList() {
        return [this.applet.Mem_colorSwap];
    }

    getData() {
        if (!this.isEnabled || !this.swapusage) return [0];
        return this.currentReadings;
    }

    setData(total, value) {
        this.swapusage = parseInt(total) !== 0;
        this.currentReadings = [value];
    }

    getTooltipString() {
    //if (!this.isEnabled || !this.currentReadings[0]) { //Replaced by:
        if (!this.isEnabled || !this.swapusage) {
            return '';
        }
        let toolTipString = _('------------ Swap ------------') + '\n';
        toolTipString += _('Swap').padStart(spaces, ' ') + ':\t' + (Math.round(10000 * this.currentReadings[0]) / 100).toString().padStart(2, ' ') + ' %\n';
        return toolTipString;
    }

    get isEnabled() {
        return this.applet.CPU_enabled;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

class MultiCpuDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('CPU');
        this.currentReadings = [];
    }

    getColorList() {
        var colorList = [];
        for (let i=0, nb=this.CPUCount; i<nb ; i++) {
            let n = i % 4;
            colorList.push(this.applet[`CPU_color${n}`]);
        }
        return colorList;
    }

    getData() {
        if (!this.isEnabled) return [];
        return this.currentReadings;
    }

    setData(data) {
        this.currentReadings = data;
    }

    getTooltipString() {
        if (! this.isEnabled) return "";
        if (! this.isRunning) return "";
        let toolTipString = _('------------- CPU ------------') + '\n';
        for (let i = 0; i < this.CPUCount; i++) {
            let percentage = Math.round(100 * this.currentReadings[i], 2);
            if (this.applet.CPU_mergeAll) {
                toolTipString += (_('CPU') + ' ').padStart(spaces, ' ') + ':\t' + percentage.toString().padStart(2, ' ') + ' %\n';
            } else {
                toolTipString += (_('Core') + ' ' + i).padStart(spaces, ' ') + ':\t' + percentage.toString().padStart(2, ' ') + ' %\n';
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

    get isRunning() {
        return this.applet.isRunning;
    }
}

class NetDataProvider {
    constructor(applet) {
        this.applet = applet;
        this.name = _('NET');
        this.disabledDevices = [];
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
                 //~ colorList.push([this.applet.colors[dev.colorDown], this.applet.colors[dev.colorUp]]);
            }
        }
        //~ global.log(UUID + " - this.applet.colors: " + JSON.stringify(this.applet.colors, null, 4));
        //~ global.log(UUID + " - Net colorList: " + JSON.stringify(colorList, null, 4));
        return colorList;
    }

    getData() {
        if (!this.isEnabled) return [];
        return this.currentReadings;
    }

    setData(data, disabledDevices) {
        //~ global.log(UUID + " - data: " + JSON.stringify(data, null, "\t"));
        this.disabledDevices = disabledDevices;
        var dataIds = [];
        for (let d of data) {
            if (dataIds.indexOf(d["id"]) < 0)
                dataIds.push(d["id"])
        }
        //~ global.log(UUID + " - dataIds: " + dataIds);
        const newUpdateTime = Date.now();
        const secondsSinceLastUpdate = (newUpdateTime - this.lastUpdatedTime) / 1000;

        for (let i = 0, len = this.currentReadings.length; i < len; i++) {
            let data_index = dataIds.indexOf(this.currentReadings[i]["id"]);
            //~ global.log(UUID + " - data_index: " + data_index);
            if (data_index < 0) continue;
            this.currentReadings[i].down = data[data_index]["down"];
            this.currentReadings[i].up = data[data_index]["up"];

            this.currentReadings[i].tooltipDown = Math.round(
                ((this.currentReadings[i].down - this.currentReadings[i].lastReading[0]) / secondsSinceLastUpdate)
            );
            this.currentReadings[i].tooltipUp = Math.round(
                ((this.currentReadings[i].up - this.currentReadings[i].lastReading[1]) / secondsSinceLastUpdate)
            );

              this.currentReadings[i].lastReading[0] = this.currentReadings[i].down;
              this.currentReadings[i].lastReading[1] = this.currentReadings[i].up;

              this.currentReadings[i].readingRatesList[0] = Math.round(this.currentReadings[i].tooltipDown / 1024);
              this.currentReadings[i].readingRatesList[1] = Math.round(this.currentReadings[i].tooltipUp / 1024);
        }

        this.lastUpdatedTime = newUpdateTime;
    }

    getTooltipString() {
        if (! this.isEnabled) return "";
        if (! this.isRunning) return "";
        let toolTipString = _('---------- Networks ----------') + '\n';
        for (let i = 0, len = this.currentReadings.length; i < len; i++) {
            if (!this.currentReadings[i].tooltipDown) {
                this.currentReadings[i].tooltipDown = 0;
            }
            if (!this.currentReadings[i].tooltipUp) {
                this.currentReadings[i].tooltipUp = 0;
            }
            let down = formatBytes(this.currentReadings[i].tooltipDown, 2);
            let up = formatBytes(this.currentReadings[i].tooltipUp, 2);
            let name = (this.currentReadings[i]['name'].length === 0) ? this.currentReadings[i].id : this.currentReadings[i].name;
            toolTipString += name.padEnd(22) + '\n';
            toolTipString += _('Down:').split(':')[0].padStart(spaces, ' ') + ':' + down.padStart(spaces + 2) + '\n';
            toolTipString += _('Up:').split(':')[0].padStart(spaces, ' ') + ':'  + up.padStart(spaces + 2) + '\n';
        }
        return toolTipString;
    }

    get isEnabled() {
        return this.applet.Net_enabled;
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
                 //~ colorList = colorList.concat([this.applet[`colors${dev.colorRead}`], this.applet[`colors${dev.colorWrite}`]]);
                 //~ colorList.push([this.applet.colors[dev.colorRead], this.applet.colors[dev.colorWrite]]);
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
        //~ global.log(UUID + " - dataIds: " + dataIds);
        const newUpdateTime = Date.now();
        const secondsSinceLastUpdate = (newUpdateTime - this.lastUpdatedTime) / 1000;

        for (let i = 0, len = this.currentReadings.length; i < len; i++) {
            let data_index = dataIds.indexOf(this.currentReadings[i]["id"]);
            //~ global.log(UUID + " - data_index: " + data_index);
            if (data_index < 0) continue;
            this.currentReadings[i].read = data[data_index]["read"];
            this.currentReadings[i].write = data[data_index]["write"];

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

        this.lastUpdatedTime = newUpdateTime;
    }

    getData() {
        if (!this.isEnabled) return [];
        return this.currentReadings;
    }

    getTooltipString() {
        if (!this.isEnabled) {
            return "";
        }
        let toolTipString = _('------------ Disks -----------') + '\n';
        for (let i = 0, len = this.currentReadings.length; i < len; i++) {
            if (!this.currentReadings[i]) {
                continue;
            }
            let read = formatBytes(this.currentReadings[i].tooltipRead, 2);
            let write = formatBytes(this.currentReadings[i].tooltipWrite, 2);
            //~ toolTipString += this.currentReadings[i].name.padEnd(22) + '\n';
            if (this.currentReadings[i].name != this.currentReadings[i].id)
                toolTipString += this.currentReadings[i].name.padStart(1, " ").padEnd('------------ Disks -----------'.length - this.currentReadings[i].id.length, " ") + this.currentReadings[i].id + '\n';
            else
                toolTipString += this.currentReadings[i].name.padEnd(22) + '\n';
            toolTipString += _('Read:').split(':')[0].padStart(spaces, ' ') + ':' + String(read).padStart(spaces + 2) + '\n';
            toolTipString += _('Write:').split(':')[0].padStart(spaces, ' ') + ':' + String(write).padStart(spaces + 2) + '\n';
        }
        return toolTipString;
    }

    get isEnabled() {
        return this.applet.Disk_enabled;
    }

    get isRunning() {
        return this.applet.isRunning;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MCSM(metadata, orientation, panel_height, instance_id);
}

