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

const rate = _('/s');
var spaces = 14;
const translated_strings = [
    _("Core 128:"),
    _("Unrecoverable:"),
    _("Recoverable:"),
    _("Used:"),
    _("Usedup:"),
    _("Free:"),
    _("Swap"),
    _("Down:"),
    _("Up:"),
    _("Read:"),
    _("Write:")
];
for (let s of translated_strings) {
    let l = s.length + 1;
    if (l > spaces)
        spaces = l;
}

const properties = [
    {graph: 'multiCpuGraph', provider: 'multiCpuProvider', abbrev: 'CPU'},
    {graph: 'memoryGraph', provider: 'memoryProvider', abbrev: 'Mem'},
    {graph: 'swapGraph', provider: 'swapProvider', abbrev: 'Swap'},
    {graph: 'networkGraph', provider: 'networkProvider', abbrev: 'Net'},
    {graph: 'diskGraph', provider: 'diskProvider', abbrev: 'Disk'},
    {graph: 'diskUsageGraph', provider: 'diskUsageProvider', abbrev: 'DiskUsage'}
];

function get_nemo_size_prefixes() {
    let _SETTINGS_SCHEMA='org.nemo.preferences';
    let _SETTINGS_KEY = 'size-prefixes';
    let _interface_settings = new Gio.Settings({ schema_id: _SETTINGS_SCHEMA });
    return _interface_settings.get_string(_SETTINGS_KEY)
}

const formatBytes = (bytes, decimals=2, withRate=true)=>{
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
        i = Math.min(Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))), 8);
    } else {
        k = 1024;
        sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
        i = Math.min(Math.max(0, Math.floor(Math.log2(bytes) / Math.log2(k))), 8);
    }
    let value;
    if (isNaN(i)) {
        i = 0;
        value = "0";
    } else {
        value = (bytes / Math.pow(k, i)).toPrecision(dm).toString();
    }
    let parts = value.split('.');
    let dec_part = (parts.length === 2) ? '.' + parts[1].toString().padEnd(2, '0') : '.00';
    return parts[0].padStart(spaces/2 - 1) + dec_part.padEnd(spaces/2 - 1) + sizes[i].padStart((_rate.length == 0) ? 4 : 3, ' ') + _rate;
};



Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");
function _(str) {
    let customTrans = Gettext.dgettext(UUID, str);
    if (customTrans.length > 0 && customTrans !== str)
        return customTrans;
    return Gettext.gettext(str);
}

//~ class MCSM extends Applet.TextIconApplet {
class MCSM extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.orientation = orientation;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;
        this.instance_id = instance_id;

        Util.spawnCommandLineAsync("/usr/bin/env bash -c 'cd %s && chmod 755 *.sh'".format(PATH2SCRIPTS));

        if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
            this._applet_tooltip._tooltip.set_style('text-align: right; font-family: monospace;');
        } else {
            this._applet_tooltip._tooltip.set_style('text-align: left; font-family: monospace;');
        }

        this.settings = new AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("isHighlighted", "isHighlighted");
        this.settings.bind("CPU_useProgressiveColors", "CPU_useProgressiveColors");
        this.settings.bind("CPU_byActivity", "CPU_byActivity", () => { this.on_CPU_byActivity_changed(); });
        this.settings.bind("Net_devicesList", "Net_devicesList");
        this.settings.bind("Disk_devicesList", "Disk_devicesList");
        this.settings.bind("labelsOn", "labelsOn");
        this.settings.bind("borderOn", "borderOn");
        this.settings.bind("graphSpacing", "graphSpacing");
        this.settings.bind("CPU_labelOn", "CPU_labelOn");
        this.settings.bind("Mem_labelOn", "Mem_labelOn");
        this.settings.bind("Net_labelOn", "Net_labelOn");
        this.settings.bind("Disk_labelOn", "Disk_labelOn");
        this.settings.bind("thickness", "thickness");
        this.settings.bind("useIconSize", "useIconSize", () => { this.set_panelHeight(); });
        this.settings.bind("refreshRate", "refreshRate", () => { this.run_main_loop(); });
        this.settings.bind("labelColor", "labelColor");
        this.settings.bind("borderColor", "borderColor");
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
        this.settings.bind("Mem_colorFree", "Mem_colorFree");
        this.settings.bind("Mem_colorSwap", "Mem_colorSwap");
        this.settings.bind("Mem_swapWidth", "Mem_swapWidth");
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
        this.settings.bind("DiskUsage_enabled", "DiskUsage_enabled");
        this.settings.bind("DiskUsage_labelOn", "DiskUsage_labelOn");
        this.settings.bind("DiskUsage_squared", "DiskUsage_squared");
        this.settings.bind("DiskUsage_width", "DiskUsage_width");
        this.settings.bind("DiskUsage_mergeAll", "DiskUsage_mergeAll");
        //~ this.settings.bind("DiskUsage_chartType", "DiskUsage_chartType");
        this.DiskUsage_chartType = "bar";
        this.settings.bind("DiskUsage_colorUsed", "DiskUsage_colorUsed");
        this.settings.bind("DiskUsage_colorFree", "DiskUsage_colorFree");
        this.settings.bind("DiskUsage_colorAlert", "DiskUsage_colorAlert");
        this.settings.bind("DiskUsage_pathList", "DiskUsage_pathList");
        for (let i=0; i<nb_colors; i++)
            this.settings.bind(`color${i}`, `color${i}`, () => { this.on_color_changed() });

        if (this.refreshRate < 1000)
            this.refreshRate = 1000;

        this.mainLoopId = null;

        this.on_color_changed();
        this.useSymbolicIcon = true;
        if (this.without_any_graph)
            this.setIcon();
        //~ global.log("ICON SIZE: " + this.getPanelIconSize(St.IconType.FULLCOLOR));

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

        this.isRunning = true;

        this.memoryProvider = new MemDataProvider(this);
        this.multiCpuProvider = new MultiCpuDataProvider(this);
        this.swapProvider = new SwapDataProvider(this);
        this.buffcachesharedProvider = new BufferCacheSharedDataProvider(this);
        this.networkProvider = new NetDataProvider(this);
        this.diskProvider = new DiskDataProvider(this);
        this.diskUsageProvider = new DiskUsageDataProvider(this);

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

        if (this.DiskUsage_chartType === "bar")
            this.diskUsageGraph = new Graphs.GraphVBars100(this.graphArea, this);
        else
            this.diskUsageGraph = new Graphs.GraphPieChart(this.graphArea, this);

        this.actor.add_actor(this.graphArea);
    }

    set_panelHeight() {
        this.iconSize = this.getPanelIconSize(St.IconType.FULLCOLOR);
        if (this.useIconSize)
            this.panelHeight = this.iconSize;
        else
            this.panelHeight = this._panelHeight;
    }

    run_main_loop() {
        if (this.mainLoopId != null && source_exists(this.mainLoopId)) {
            this.isRunning = false;
            source_remove(this.mainLoopId);
            this.mainLoopId = null;
            this.isRunning = true;
        }
        this.mainLoopId = timeout_add(this.refreshRate, () => {
            this.get_mem_info();
            this.get_cpu_info();
            this.get_net_info();
            this.get_disk_info();
            this.get_disk_usage();
            this._setTooltip();
            this.graphArea.queue_repaint();
            return this.isRunning;
        });
    }

    onGraphRepaint(area) {
        this._isHighlighted;
        if (this.without_any_graph) return;
        let xOffset = 0;
        for (let i = 0, len = properties.length; i < len; i++) {
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
                        Math.round(width * this.Mem_swapWidth / 100) - 2 * global.ui_scale,
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
                    //~ (this.borderOn) ? (this.panelHeight - 2) * 0.8 * global.ui_scale : (this.panelHeight - 2) * global.ui_scale,
                    this.labelColor,
                    this.backgroundColor,
                    this[properties[i].provider].getColorList()
                );
                // return translation to origin
                areaContext.translate(-xOffset, 0);
                // update xOffset for next translation
                //~ xOffset += width + 1;
                if (i === len - 1)
                    xOffset += width;
                else
                    xOffset += width + 1 + this.graphSpacing;
            }
        }
        //~ area.set_width(xOffset > 1 ? xOffset - 1 : 1);
        area.set_width(xOffset > 1 ? xOffset : 1);
        area.set_height(this.panelHeight);
    }

    _initContextMenu() {
        //~ let menuChildren = null;
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

        let menuChildren = this._applet_context_menu._getMenuItems();
        var posConfigure = -1;
        for (let i=0; i<menuChildren.length; i++) {
            //~ global.log("menuChildren["+i+"]: "+menuChildren[i]);
            if ((""+menuChildren[i]).includes(_("Configure...")))
                posConfigure = i;
        }
        if (posConfigure != -1) {
            menuChildren[posConfigure].destroy();
            let context_menu_item_configure = new PopupMenu.PopupSubMenuMenuItem(_("Configure..."));
            context_menu_item_configure.menu.addAction(_("General"), () => { this.configureApplet(0) });
            context_menu_item_configure.menu.addAction(_("CPU"), () => { this.configureApplet(1) });
            context_menu_item_configure.menu.addAction(_("Memory"), () => { this.configureApplet(2) });
            context_menu_item_configure.menu.addAction(_("Network"), () => { this.configureApplet(3) });
            context_menu_item_configure.menu.addAction(_("Disk IO"), () => { this.configureApplet(4) });
            context_menu_item_configure.menu.addAction(_("Disk Usage"), () => { this.configureApplet(5) });
            context_menu_item_configure.menu.addAction(_("Colors"), () => { this.configureApplet(6) });
            this._applet_context_menu.addMenuItem(context_menu_item_configure, posConfigure);
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

        let pid = Util.spawnCommandLine(`cinnamon-settings applets ${UUID} -i ${this.instance_id} -t ${tab}`);

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
                                "colorDown": (knownDevices.length * 2) % nb_colors,
                                "colorUp": (knownDevices.length * 2 + 1) % nb_colors
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
                //~ var mounts = stdout.trim().split(" ");
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
        if (!this.Mem_enabled) return;
        let old, duration;
        if (DEBUG) old = Date.now();
        let subProcess = Util.spawnCommandLineAsyncIO(PATH2SCRIPTS + "/get-mem-raw-data.sh", (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                let [total, used, free, shared, buffers, cache, available, swapTotal, swapUsed] = stdout.split(" ");

                this.memoryProvider.setData(1 * total, 1 * used);
                this.swapProvider.setData(1 * swapTotal, 1 * swapUsed / swapTotal);
                this.buffcachesharedProvider.setData(1 * buffers, 1 * cache, 1 * shared);
            }
            subProcess.send_signal(9);
            if (DEBUG) {
                duration = Date.now() - old;
                global.log(UUID + " - get_mem_info Duration: " + duration + " ms.");
            }
        });
    }

    get_cpu_info() {
        if (!this.isRunning) return;
        if (!this.CPU_enabled) return;
        let old, duration;
        if (DEBUG) old = Date.now();
        let subProcess = Util.spawnCommandLineAsyncIO(PATH2SCRIPTS + "/get-cpu-raw-data.sh", (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
                let cpuString = stdout.trim();
                var data = [];
                let values = cpuString.split(" ");
                if (this.oldCPU_Total_Values.length === 0) { // first execution
                    if (this.CPU_mergeAll) {
                        data.push(0);
                        for (let v of values) {
                            let [total, idle] = v.split(",");
                            this.oldCPU_Total_Values.push(total);
                            this.oldCPU_Idle_Values.push(idle);
                        }
                    } else {
                        for (let i=0, len=values.length; i<len; i++) {
                            data.push(0);
                            let [total, idle] = values[i].split(",");
                            this.oldCPU_Total_Values.push(total);
                            this.oldCPU_Idle_Values.push(idle);
                        }
                    }
                } else { // next executions
                    if (this.CPU_mergeAll) {
                        //~ data.push(parseFloat(values[0]) / 100);
                        let [totalValue, idleValue] = values[0].split(",");
                        let total = totalValue - this.oldCPU_Total_Values[0];
                        let idle = idleValue - this.oldCPU_Idle_Values[0];
                        data.push((total - idle) / total);
                        this.oldCPU_Total_Values[0] = totalValue;
                        this.oldCPU_Idle_Values[0] = idleValue;
                        for (let i=1, len=values.length; i < len; i++) {
                            let [totalValue, idleValue] = values[i].split(",");
                            this.oldCPU_Total_Values[i] = totalValue;
                            this.oldCPU_Idle_Values[i] = idleValue;
                        }
                    } else {
                        let i = 0;
                        for (let v of values) {
                            let [totalValue, idleValue] = v.split(",");
                            let total = totalValue - this.oldCPU_Total_Values[i];
                            let idle = idleValue - this.oldCPU_Idle_Values[i];
                            this.oldCPU_Total_Values[i] = totalValue;
                            this.oldCPU_Idle_Values[i] = idleValue;
                            if (i === 0) {
                                i++;
                                continue;
                            }
                            data.push((total - idle) / total);
                            //~ data.push(parseFloat(v) / 100);
                            i++;
                        }
                    }
                }
                this.oldCPUvalues = values;

                this.multiCpuProvider.setData(data);

            }
            subProcess.send_signal(9);
            if (DEBUG) {
                duration = Date.now() - old;
                global.log(UUID + " - get_cpu_info Duration: " + duration + " ms.");
            }
        });
    }

    get_net_info() {
        if (!this.isRunning) return;
        if (!this.Net_enabled) return;
        let old, duration;
        if (DEBUG) old = Date.now();
        let subProcess = Util.spawnCommandLineAsyncIO(PATH2SCRIPTS + "/get-network-data.sh", (stdout, stderr, exitCode) => {
            if (exitCode === 0) {
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
            if (DEBUG) {
                duration = Date.now() - old;
                global.log(UUID + " - get_net_info Duration: " + duration + " ms.");
            }
        });
    }

    get_disk_info() {
        if (!this.isRunning) return;
        if (!this.Disk_enabled) return;
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
        if (DEBUG) {
            duration = Date.now() - old;
            global.log(UUID + " - get_disk_info Duration: " + duration + " ms.");
        }
    }

    get_disk_usage() {
        if (!this.isRunning) return;
        if (!this.DiskUsage_enabled) return;
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
            //~ global.log(path + " - size: " + size + ", used: " + used);
            if (this.DiskUsage_mergeAll) {
                sumSize = sumSize + size;
                sumUsed = sumUsed + used;
            } else {
                if (this.DiskUsage_chartType === "bar")
                    data.push({
                        "value": 1.0 * used / size,
                        "maxvalue": maxValue
                    });
                else
                    data.push([size, used]);
            }
        }
        if (this.DiskUsage_mergeAll) {
            if (this.DiskUsage_chartType === "bar")
                data.push({
                    "value": 1.0 * sumUsed / sumSize,
                    "maxvalue": 0.8
                });
            else
                data.push([1 * sumSize, 1 * sumUsed]);
        }
        this.diskUsageProvider.setData(data);
    }

    disk_usage(path) {
        if (!this.isRunning) return [0, 0];
        if (!this.DiskUsage_enabled) return [0, 0];
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
            "diskUsageProvider"
        ]) {
            appletTooltipString += this[provider].getTooltipString();
        }
        if (this.hovered)
            this.set_applet_tooltip(appletTooltipString, true);
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

    on_applet_added_to_panel() {
        this.isRunning = true;
        this.run_main_loop();
    }

    on_applet_removed_from_panel() {
        this.isRunning = false;
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
        //~ this.isEnabled = this.applet.Mem_enabled;
        this.memusage = 0;
        this.currentReadings = [0, 0, 0, 0];
    }

    getColorList() {
        //~ let types = ["Usedup", "Cached", "Buffer", "Free", "Swap"];
        //~ let types = ["Usedup", "Recoverable", "Free", "Swap"];
        let types = ["Usedup", "Free", "Swap"];
        var colorList = [];
        for (let t of types)
            colorList.push(this.applet[`Mem_color${t}`]);
        return colorList;
    }

    getData() {
        if (!this.isEnabled) return [];
        return this.currentReadings;
    }

    //~ setData(used, cached, buffers, free) {
    //~ setData(used, recoverable) {
    //~ setData(total, used, free, available) {
    setData(total, used) {
        const precision = 100000;
        //~ const recoverable = available - free;
        //~ const unrecoverable = used - recoverable;
        //~ const realUsed = recoverable + unrecoverable;

        //~ const realUsed = available - free + used - (available - free);
        //~ const realUsed = used;
        //~ const usedProp = realUsed / total;
        const usedProp = used / total;
        this.currentReadings = [
            Math.round(usedProp * precision) / precision,
            Math.round((1 - usedProp)*precision) / precision
        ];
    }

    getTooltipString() {
        if (! this.isEnabled) return "";
        if (! this.isRunning) return "";
        var sum_used = 0;
        //~ let toolTipString = _('----------- Memory -----------') + '\n';
        let trans = _("Memory");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*spaces - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*spaces - len)/2)) + '\n';

        //~ let attributes = [_('Used:'), _('Cached:'), _('Buffer:'), _('Free:')];
        let attributes = [_('Used:'), _('Free:')];
        //~ let attributes = [_('Unrecoverable:'), _("Recoverable:"), _('Used:'), _('Free:')];
        for (let i = 0; i < attributes.length; i++) {
            if (i < 2) {
                sum_used = sum_used + this.currentReadings[i];
            }
            if (i < 2) {
                toolTipString += (attributes[i]).split(':')[0].padStart(spaces, ' ') + ':\t' + (Math.round(1000 * this.currentReadings[i])/10).toString().padStart(2, ' ') + ' %\n';
            } else if (i === 2) {
                toolTipString += (attributes[i]).split(':')[0].padStart(spaces, ' ') + ':\t' + (Math.round(1000 * sum_used)/10).toString().padStart(2, ' ') + ' %\n';
            } else {
                toolTipString += (attributes[i]).split(':')[0].padStart(spaces, ' ') + ':\t' + (Math.round(1000 * this.currentReadings[i-1])/10).toString().padStart(2, ' ') + ' %\n';
            }
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
        if (!this.isEnabled) return [];
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
        if (! this.isEnabled) return "";
        if (! this.isRunning) return "";
        let trans = this.name;
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*spaces - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*spaces - len)/2)) + '\n';

        let colon = _(":");
        let lenColon = Math.max(colon.length - 1, 0);
        let attributes = [_('Buffer'), _('Cache'), _("Shared")];

        for (let i = 0; i < attributes.length; i++) {
            let valueWithUnit = formatBytes(this.currentReadings[i], 2, false);
            toolTipString += attributes[i].padStart(spaces - lenColon, ' ') + colon + " " + valueWithUnit.padStart(2, ' ') + '\n';
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
        if (TESTING)
            this.currentReadings = [0.6];
        else
            this.currentReadings = [value];
    }

    getTooltipString() {
    //if (!this.isEnabled || !this.currentReadings[0]) { //Replaced by:
        if (!this.isEnabled || !this.swapusage) {
            return '';
        }
        //~ let toolTipString = _('------------ Swap ------------') + '\n';
        let trans = _("Swap");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*spaces - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*spaces - len)/2)) + '\n';

        toolTipString += trans.padStart(spaces, ' ') + ':\t' + (Math.round(10000 * this.currentReadings[0]) / 100).toString().padStart(2, ' ') + ' %\n';
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
        this.prevData = [];
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
        //~ let toolTipString = _('------------- CPU ------------') + '\n';
        let trans = _("CPUs");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*spaces - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*spaces - len)/2)) + '\n';

        let colon = _(":");
        let lenColon = Math.max(colon.length - 1, 0);

        for (let i = 0; i < this.CPUCount; i++) {
            let percentage = Math.round(100 * this.currentReadings[i], 2);
            if (this.applet.CPU_mergeAll) {
                toolTipString += (_('CPU') + ' ').padStart(spaces - lenColon, ' ') + colon + '\t' + percentage.toString().padStart(2, ' ') + ' %\n';
            } else {
                toolTipString += (_('Core') + ' ' + i).padStart(spaces - lenColon, ' ') + colon + '\t' + + percentage.toString().padStart(2, ' ') + ' %\n';
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
        //~ let toolTipString = _('---------- Networks ----------') + '\n';
        let trans = _("Networks");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*spaces - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*spaces - len)/2)) + '\n';

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
        //~ let toolTipString = _('------------ Disks -----------') + '\n';
        let trans = _("Disks");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*spaces - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*spaces - len)/2)) + '\n';
        let title = "" + toolTipString;

        for (let i = 0, len = this.currentReadings.length; i < len; i++) {
            if (!this.currentReadings[i]) {
                continue;
            }
            let read = formatBytes(this.currentReadings[i].tooltipRead, 2);
            let write = formatBytes(this.currentReadings[i].tooltipWrite, 2);
            //~ toolTipString += this.currentReadings[i].name.padEnd(22) + '\n';
            if (this.currentReadings[i].name != this.currentReadings[i].id)
                toolTipString += this.currentReadings[i].name.padStart(1, " ").padEnd(title.length - this.currentReadings[i].id.length - 1, " ") + this.currentReadings[i].id + '\n';
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
        if (!this.isEnabled) return [];
        return this.currentReadings;
    }

    getTooltipString() {
        if (!this.isEnabled) {
            return "";
        }
        let trans = _("Usage");
        let len = trans.length - 2;
        let toolTipString = "-".repeat(Math.trunc((2*spaces - len)/2)) + " " + trans + " " + "-".repeat(Math.round((2*spaces - len)/2)) + '\n';
        let title = "" + toolTipString;

        let colon = _(":");
        let lenColon = Math.max(colon.length - 1, 0);

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
                    toolTipString += (_('Disks') + ' ').padStart(spaces - lenColon, ' ') + colon + '\t' + percentage.toString().padStart(2, ' ') + ' %\n';
                else
                    toolTipString += (_('Disks') + ' ').padStart(spaces - lenColon, ' ') + colon + '\t<b>' + percentage.toString().padStart(2, ' ') + ' %</b>\n';
            } else {
                let name = names[i];
                if (percentage < maxPercentage)
                    toolTipString += name.padStart(spaces - lenColon, ' ') + colon + '\t' + + percentage.toString().padStart(2, ' ') + ' %\n';
                else
                    toolTipString += name.padStart(spaces - lenColon, ' ') + colon + '\t<b>' + + percentage.toString().padStart(2, ' ') + ' %</b>\n';
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

    get isRunning() {
        return this.applet.isRunning;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MCSM(metadata, orientation, panel_height, instance_id);
}

