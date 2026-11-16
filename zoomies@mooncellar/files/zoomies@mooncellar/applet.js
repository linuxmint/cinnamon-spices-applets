const TEST_LOAD = null;     // set 0-100 to fake the load when testing, null for the real sensor

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;

// cats live in cats/<folder>/frame_0.png, frame_1.png, ...
const DEFAULT_CAT = "black";        // fallback if the chosen cat is missing
const MAX_FRAMES = 64;

const HIDDEN_CHECK_MS = 500;        // how often to check back while the panel is hidden

// details popup
const TOP_COUNT = 5;
const PAGE_SIZE = 4096;
const BAR_WIDTH = 240;
const BAR_HEIGHT = 4;
const BAR_COLOR = "#5b9bd5";
const BAR_RGB = [0.357, 0.608, 0.835];               // BAR_COLOR as 0-1 values for cairo
const TRACK_COLOR = "rgba(128, 128, 128, 0.25)";
const ROW_ICON_SIZE = 16;
const GRAPH_HEIGHT = 48;

// high load alert (icon-shadow doesn't work on every theme)
const ALERT_ICON_STYLE = "icon-shadow: 0px 0px 6px rgba(255, 60, 60, 1);";
const ALERT_LABEL_STYLE = "color: #ff6b6b; font-weight: bold;";

// cat picker
const PICKER_COLUMNS = 4;
const PICKER_ICON_SIZE = 96;        // 2x the 48px frames so they stay sharp
const PICKER_MAX_HEIGHT = 480;      // about 3 rows; more cats than that scroll

// network connections that aren't a real link. their traffic also goes through
// Wi-Fi or Ethernet, so counting them too would double it
const VPN_IFACES = /^(tun|tap|wg|tailscale|vpn)/;
const VIRTUAL_IFACES = /^(docker|veth|br-|virbr|lxc|vnet)/;

function isVirtualIface(name) {
    return name === "lo" || VPN_IFACES.test(name) || VIRTUAL_IFACES.test(name);
}

// TextDecoder is the modern way; older Cinnamon versions don't have it yet
const DECODER = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;

function bytesToString(bytes) {
    return DECODER ? DECODER.decode(bytes) : imports.byteArray.toString(bytes);
}

function readFile(path) {
    let [ok, contents] = GLib.file_get_contents(path);
    return bytesToString(contents);
}

// returns null instead of throwing. processes can exit mid-scan and
// some /proc files need root
function readFileSafe(path) {
    try {
        let [ok, contents] = GLib.file_get_contents(path);
        return ok ? bytesToString(contents) : null;
    } catch (e) {
        return null;
    }
}

function fileExists(path) {
    return Gio.File.new_for_path(path).query_exists(null);
}

function nowSeconds() {
    return GLib.get_monotonic_time() / 1000000;
}

function formatRate(bytesPerSec) {
    if (bytesPerSec >= 1e6) return (bytesPerSec / 1e6).toFixed(1) + " MB/s";
    if (bytesPerSec >= 1e3) return Math.round(bytesPerSec / 1e3) + " KB/s";
    return Math.round(bytesPerSec) + " B/s";
}

function formatBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
    if (bytes >= 1048576) return Math.round(bytes / 1048576) + " MB";
    return Math.round(bytes / 1024) + " KB";
}

function formatDuration(seconds) {
    if (seconds >= 120) return Math.round(seconds / 60) + " min";
    return Math.round(seconds) + " s";
}

// "pixel_black" -> "Pixel black"
function prettyName(folder) {
    let s = folder.replace(/[_-]+/g, " ").trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// first line of name.txt, or the folder name if there isn't one
function catDisplayName(dirPath, folder) {
    let text = readFileSafe(dirPath + "/" + folder + "/name.txt");
    let name = text ? text.trim().split("\n")[0].trim() : "";
    return name || prettyName(folder);
}


// loads prefix0.png, prefix1.png, ... until one is missing
function loadFrames(base, prefix) {
    let frames = [];
    for (let i = 0; i < MAX_FRAMES; i++) {
        let path = base + "/" + prefix + i + ".png";
        if (!fileExists(path)) break;
        frames.push(new Gio.FileIcon({ file: Gio.File.new_for_path(path) }));
    }
    return frames;
}

// folders in cats/ that have a frame_0.png
function listCats(dirPath) {
    let cats = [];
    try {
        let dir = Gio.File.new_for_path(dirPath);
        let enumerator = dir.enumerate_children("standard::name,standard::type",
            Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            if (info.get_file_type() !== Gio.FileType.DIRECTORY) continue;
            let name = info.get_name();
            if (fileExists(dirPath + "/" + name + "/frame_0.png")) cats.push(name);
        }
        enumerator.close(null);
    } catch (e) {
        global.logWarning("Zoomies: could not list cats: " + e);
    }
    cats.sort();
    return cats;
}


// process names that don't match their app's .desktop file (keys in lowercase)
const ALIASES = {
    "isolated web co": "firefox",
    "isolated servic": "firefox",
    "web content": "firefox",
    "webextensions": "firefox",
    "privileged cont": "firefox",
    "rdd process": "firefox",
    "socket process": "firefox",
    "utility process": "firefox",
    "brave": "brave-browser",
    "chrome": "google-chrome",
    "steamwebhelper": "steam",
};

// launchers that would match way too many processes
const GENERIC_EXECUTABLES = {
    "flatpak": 1, "env": 1, "sh": 1, "bash": 1, "dash": 1, "python": 1, "python3": 1,
    "java": 1, "snap": 1, "sudo": 1, "pkexec": 1, "gtk-launch": 1, "xdg-open": 1,
};

// Maps process names from /proc to installed apps using their .desktop files
class AppResolver {
    constructor() {
        this._map = null;
        this._cache = Object.create(null);
    }

    invalidate() {
        this._map = null;
        this._cache = Object.create(null);
    }

    _build() {
        let map = Object.create(null);
        let add = (name, app) => {
            if (!name) return;
            let key = name.toLowerCase();
            if (Object.prototype.hasOwnProperty.call(GENERIC_EXECUTABLES, key)) return;
            if (!map[key]) map[key] = app;
            // /proc cuts names off at 15 chars
            if (key.length > 15 && !map[key.slice(0, 15)]) map[key.slice(0, 15)] = app;
        };
        let apps = [];
        try {
            apps = Gio.AppInfo.get_all();
        } catch (e) {
            global.logWarning("Zoomies: could not read installed apps: " + e);
        }
        for (let app of apps) {
            try {
                if (!app.should_show()) continue;
                let exec = app.get_executable();
                if (exec) add(GLib.path_get_basename(exec), app);
                let id = app.get_id();
                if (id) add(id.replace(/\.desktop$/, ""), app);
                if (app.get_startup_wm_class) add(app.get_startup_wm_class(), app);
            } catch (e) {
                // broken .desktop file, skip it
            }
        }
        this._map = map;
    }

    _lookup(lower) {
        let m = this._map;
        if (m[lower]) return m[lower];
        let stripped = lower.replace(/^\./, "").replace(/(-bin|-wrapped|\.real|_real)$/, "");
        if (m[stripped]) return m[stripped];
        if (lower.length >= 15) {
            // truncated name, like "gnome-terminal-" for gnome-terminal-server
            for (let k in m) {
                if (k.startsWith(lower)) return m[k];
                if (k.length >= 4 && lower.startsWith(k + "-")) return m[k];
            }
        }
        return null;
    }

    // returns { key, label, icon }. processes from the same app get the same key
    resolve(comm) {
        let cached = this._cache[comm];
        if (cached) return cached;
        if (!this._map) this._build();

        let lower = comm.toLowerCase();
        let alias = Object.prototype.hasOwnProperty.call(ALIASES, lower) ? ALIASES[lower] : lower;
        let app = this._lookup(alias);
        let result;
        if (app) {
            result = { key: "app:" + app.get_id(), label: app.get_name(), icon: app.get_icon() };
        } else {
            result = { key: "proc:" + comm, label: comm, icon: null };
        }
        this._cache[comm] = result;
        return result;
    }
}


// pids = the numeric folders in /proc
function listPids() {
    let pids = [];
    try {
        let dir = Gio.File.new_for_path("/proc");
        let enumerator = dir.enumerate_children("standard::name",
            Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            let name = info.get_name();
            if (/^\d+$/.test(name)) pids.push(name);
        }
        enumerator.close(null);
    } catch (e) {
        global.logWarning("Zoomies: could not list /proc: " + e);
    }
    return pids;
}

// adds up processes that belong to the same app
function addToGroup(groups, info, amount) {
    let g = groups[info.key];
    if (!g) g = groups[info.key] = { info: info, amount: 0 };
    g.amount += amount;
}

// CPU ticks used so far by every process
function snapshotCpu() {
    let statLine = readFile("/proc/stat").split("\n")[0];
    let total = statLine.trim().split(/\s+/).slice(1, 9).map(Number)
        .reduce((a, b) => a + b, 0);

    let procs = {};
    for (let pid of listPids()) {
        let text = readFileSafe("/proc/" + pid + "/stat");
        if (!text) continue;
        // the name is in brackets and can have spaces or brackets in it
        let open = text.indexOf("(");
        let close = text.lastIndexOf(")");
        if (open < 0 || close < 0) continue;
        let name = text.slice(open + 1, close);
        let rest = text.slice(close + 2).split(" ");
        let ticks = Number(rest[11]) + Number(rest[12]);   // utime + stime
        procs[pid] = { name: name, ticks: ticks };
    }
    return { total: total, procs: procs };
}

// apps that used the most CPU between two snapshots
function topCpu(prev, cur, count, resolver) {
    let dTotal = cur.total - prev.total;
    if (dTotal <= 0) return [];

    let groups = Object.create(null);
    for (let pid in cur.procs) {
        let p = cur.procs[pid];
        let before = prev.procs[pid];
        let used = p.ticks - (before && before.name === p.name ? before.ticks : 0);
        if (used <= 0) continue;
        addToGroup(groups, resolver.resolve(p.name), used);
    }

    let list = Object.keys(groups).map(k => ({
        info: groups[k].info,
        percent: 100 * groups[k].amount / dTotal,
    }));
    list.sort((a, b) => b.percent - a.percent);
    return list.slice(0, count);
}

function topRam(count, resolver) {
    let meminfo = readFile("/proc/meminfo");
    let totalBytes = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]) * 1024;

    let groups = Object.create(null);
    for (let pid of listPids()) {
        let statm = readFileSafe("/proc/" + pid + "/statm");
        if (!statm) continue;
        let fields = statm.trim().split(/\s+/).map(Number);
        // resident minus shared, so shared libraries don't get counted
        let bytes = Math.max(0, fields[1] - fields[2]) * PAGE_SIZE;
        if (bytes === 0) continue;
        let comm = readFileSafe("/proc/" + pid + "/comm");
        if (!comm) continue;
        addToGroup(groups, resolver.resolve(comm.trim()), bytes);
    }

    let list = Object.keys(groups).map(k => ({
        info: groups[k].info,
        bytes: groups[k].amount,
        percent: 100 * groups[k].amount / totalBytes,
    }));
    list.sort((a, b) => b.bytes - a.bytes);
    return list.slice(0, count);
}

// bytes written per process. only works for my own processes,
// the kernel won't show other users' io
function snapshotDisk() {
    let procs = {};
    for (let pid of listPids()) {
        let io = readFileSafe("/proc/" + pid + "/io");
        if (!io) continue;
        let m = io.match(/write_bytes:\s+(\d+)/);
        if (!m) continue;
        let comm = readFileSafe("/proc/" + pid + "/comm");
        if (!comm) continue;
        procs[pid] = { name: comm.trim(), bytes: Number(m[1]) };
    }
    return { time: nowSeconds(), procs: procs };
}

function topDisk(prev, cur, count, resolver) {
    let dt = cur.time - prev.time;
    if (dt <= 0) return [];

    let groups = Object.create(null);
    for (let pid in cur.procs) {
        let p = cur.procs[pid];
        let before = prev.procs[pid];
        let used = p.bytes - (before && before.name === p.name ? before.bytes : 0);
        if (used <= 0) continue;
        addToGroup(groups, resolver.resolve(p.name), used);
    }

    let list = Object.keys(groups).map(k => ({
        info: groups[k].info,
        rate: groups[k].amount / dt,
    }));
    list.sort((a, b) => b.rate - a.rate);
    return list.slice(0, count);
}


// "wlp3s0" -> "Wi-Fi (wlp3s0)" with a matching icon
function describeIface(name) {
    let kind;
    let iconName = "network-workgroup-symbolic";
    let isWireless = /^wl/.test(name) ||
        GLib.file_test("/sys/class/net/" + name + "/wireless", GLib.FileTest.IS_DIR);
    if (isWireless) {
        kind = "Wi-Fi";
        iconName = "network-wireless-symbolic";
    } else if (/^(en|eth)/.test(name)) {
        kind = "Ethernet";
        iconName = "network-wired-symbolic";
    } else if (VPN_IFACES.test(name)) {
        kind = "VPN";
        iconName = "network-vpn-symbolic";
    } else if (VIRTUAL_IFACES.test(name)) {
        kind = "Virtual";
    }
    return {
        key: "net:" + name,
        label: kind ? kind + " (" + name + ")" : name,
        icon: Gio.ThemedIcon.new(iconName),
    };
}

function snapshotNet() {
    let ifaces = {};
    let lines = readFile("/proc/net/dev").split("\n").slice(2);
    for (let line of lines) {
        if (!line.includes(":")) continue;
        let [iface, rest] = line.split(":");
        iface = iface.trim();
        if (iface === "lo") continue;
        let f = rest.trim().split(/\s+/).map(Number);
        ifaces[iface] = { rx: f[0], tx: f[8] };
    }
    return { time: nowSeconds(), ifaces: ifaces };
}

function topNet(prev, cur, count) {
    let dt = cur.time - prev.time;
    if (dt <= 0) return [];

    let list = [];
    for (let name in cur.ifaces) {
        let before = prev.ifaces[name];
        if (!before) continue;
        let rx = Math.max(0, (cur.ifaces[name].rx - before.rx) / dt);
        let tx = Math.max(0, (cur.ifaces[name].tx - before.tx) / dt);
        if (rx + tx <= 0) continue;
        list.push({ info: describeIface(name), rx: rx, tx: tx, total: rx + tx });
    }
    list.sort((a, b) => b.total - a.total);
    return list.slice(0, count);
}


// percent graphs top out at 100, rate graphs scale to the data
function graphMax(kind, values) {
    if (kind === "percent") return 100;
    let max = 0;
    for (let v of values) if (v > max) max = v;
    return Math.max(10240, max * 1.1);
}


// Sensors: read() returns { load: 0-100, text, value }
// value is the raw number that goes in the history graph

// the first reading of CPU, network and disk has nothing to compare with yet,
// so it returns this and the cat waits one second for a real value
const NOT_READY = { load: 0, text: "...", value: null };

class CpuSensor {
    constructor() {
        this.name = "CPU";
        this.kind = "percent";
        this._prevTotal = null;
        this._prevIdle = 0;
    }
    read() {
        let line = readFile("/proc/stat").split("\n")[0];
        let parts = line.trim().split(/\s+/).slice(1, 9).map(Number);
        let idle = parts[3] + parts[4];
        let total = parts.reduce((a, b) => a + b, 0);
        let first = this._prevTotal === null;
        let dTotal = total - this._prevTotal;
        let dIdle = idle - this._prevIdle;
        this._prevTotal = total;
        this._prevIdle = idle;
        if (first) return NOT_READY;
        let load = dTotal > 0 ? 100 * (1 - dIdle / dTotal) : 0;
        return { load: load, text: Math.round(load) + "%", value: load };
    }
}

class RamSensor {
    constructor() {
        this.name = "RAM";
        this.kind = "percent";
    }
    read() {
        let text = readFile("/proc/meminfo");
        let total = parseInt(text.match(/MemTotal:\s+(\d+)/)[1]);
        let available = parseInt(text.match(/MemAvailable:\s+(\d+)/)[1]);
        let load = 100 * (1 - available / total);
        return { load: load, text: Math.round(load) + "%", value: load };
    }
}

// shared by network and disk, anything measured in bytes/sec.
// subclasses need a _totalBytes()
class RateSensor {
    constructor() {
        this.kind = "rate";
        this._prevBytes = null;
        this._prevTime = 0;
        this._peak = 100000;  // 100 KB/s to start with
    }
    read() {
        let bytes = this._totalBytes();
        let now = nowSeconds();
        let first = this._prevBytes === null;
        let rate = 0;
        if (!first && now > this._prevTime) {
            rate = Math.max(0, (bytes - this._prevBytes) / (now - this._prevTime));
        }
        this._prevBytes = bytes;
        this._prevTime = now;
        if (first) return NOT_READY;

        // let the peak slowly drop so one big spike doesn't throw off the scale for good
        this._peak = Math.max(rate, this._peak * 0.98, 100000);
        return { load: 100 * rate / this._peak, text: formatRate(rate), value: rate };
    }
}

class NetworkSensor extends RateSensor {
    constructor() {
        super();
        this.name = "Network";
    }
    _totalBytes() {
        let lines = readFile("/proc/net/dev").split("\n").slice(2);
        let total = 0;
        for (let line of lines) {
            if (!line.includes(":")) continue;
            let [iface, rest] = line.split(":");
            if (isVirtualIface(iface.trim())) continue;   // real connections only
            let fields = rest.trim().split(/\s+/).map(Number);
            total += fields[0] + fields[8];        // rx + tx
        }
        return total;
    }
}

class DiskSensor extends RateSensor {
    constructor() {
        super();
        this.name = "Disk write";
    }
    _totalBytes() {
        let lines = readFile("/proc/diskstats").split("\n");
        let sectors = 0;
        for (let line of lines) {
            let parts = line.trim().split(/\s+/);
            if (parts.length < 10) continue;
            // whole disks only, partitions would get counted twice
            if (!/^(sd[a-z]+|vd[a-z]+|nvme\d+n\d+|mmcblk\d+)$/.test(parts[2])) continue;
            sectors += Number(parts[9]);           // sectors written
        }
        return sectors * 512;
    }
}

const SENSORS = {
    cpu: CpuSensor,
    ram: RamSensor,
    network: NetworkSensor,
    disk: DiskSensor,
};


class ZoomiesApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._metadata = metadata;
        this._panelHeightPx = panelHeight;
        this._lastErrors = {};      // last error logged per loop, see _logError()

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("sensor", "sensorId", () => this._chooseSensor());
        this.settings.bind("cat", "catId", () => this._loadCat());
        this.settings.bind("size", "sizeMode", () => this._applySize());
        this.settings.bind("show_value", "showValue");
        this.settings.bind("slowest_ms", "slowestMs");
        this.settings.bind("fastest_ms", "fastestMs");
        this.settings.bind("curve", "curve");
        this.settings.bind("alert_enabled", "alertEnabled");
        this.settings.bind("alert_threshold", "alertThreshold");
        this.settings.bind("alert_seconds", "alertSeconds");
        this.settings.bind("click_action", "clickAction", () => this._onClickActionChanged());
        this.settings.bind("click_command", "clickCommand");
        this.settings.bind("show_history", "showHistory");
        this.settings.bind("history_seconds", "historySeconds", () => this._trimHistory());

        this._icon = new St.Icon({ icon_size: 48 });
        this._label = new St.Label({ y_align: Clutter.ActorAlign.CENTER });
        this.actor.add_actor(this._icon);
        this.actor.add_actor(this._label);

        this._applet_context_menu.addAction("Choose cat...", () => this.openCatPicker());

        // details popup
        this._resolver = new AppResolver();
        this._appMonitor = Gio.AppInfoMonitor.get();
        this._appMonitorId = this._appMonitor.connect("changed", () => this._resolver.invalidate());

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.connect("open-state-changed", (menu, open) => this._onMenuToggled(open));

        this._titleItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.menu.addMenuItem(this._titleItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._graphItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let graphBox = new St.BoxLayout({ vertical: true, x_expand: true });
        this._graph = new St.DrawingArea({ width: BAR_WIDTH, height: GRAPH_HEIGHT });
        this._graph.connect("repaint", area => this._drawGraph(area));
        this._graphLabel = new St.Label({ text: "", style: "font-size: 9pt; padding-top: 2px;" });
        this._graphLabel.set_opacity(170);
        graphBox.add_actor(this._graph);
        graphBox.add_actor(this._graphLabel);
        this._graphItem.addActor(graphBox, { expand: true, span: -1 });
        this.menu.addMenuItem(this._graphItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._rows = [];
        for (let i = 0; i < TOP_COUNT; i++) {
            let row = this._makeRow();
            this.menu.addMenuItem(row.item);
            this._rows.push(row);
        }
        this._fallbackIcon = Gio.ThemedIcon.new("application-x-executable");
        this._prevSnap = null;
        this._prevSnapKind = "";

        this._frames = [];
        this._frame = 0;
        this._currentCat = null;    // the cat folder actually showing (after any fallback)
        this._shownIcon = null;
        this._lastLabel = null;
        this._load = 0;
        this._text = "";
        this._history = [];
        this._alertCount = 0;
        this._alerting = false;

        this._applySize();
        this._loadCat();
        this._chooseSensor();
        this._sample();
        this._animate();
    }

    // logs each different error once per place, so an error that repeats
    // every frame doesn't flood the log
    _logError(where, e) {
        let message = String(e);
        if (this._lastErrors[where] === message) return;
        this._lastErrors[where] = message;
        global.logError("Zoomies: " + where + " failed: " + message +
            (e && e.stack ? "\n" + e.stack : ""));
    }

    on_applet_clicked() {
        if (this.clickAction === "details") {
            this.menu.toggle();
        } else if (this.clickAction === "command") {
            let command = (this.clickCommand || "").trim() || "gnome-system-monitor";
            try {
                Util.spawnCommandLine(command);
            } catch (e) {
                global.logWarning("Zoomies: could not run '" + command + "': " + e);
            }
        }
    }

    _onClickActionChanged() {
        // popup is open but clicking won't open it anymore, so close it
        if (this.clickAction !== "details" && this.menu.isOpen) this.menu.close();
    }

    on_panel_height_changed() {
        this._applySize();
    }

    _applySize() {
        let size;
        if (this.sizeMode === "auto") {
            let panelHeight = (this.panel && this.panel.height) || this._panelHeightPx || 48;
            size = Math.max(16, panelHeight);
        } else {
            size = parseInt(this.sizeMode) || 48;
        }
        this._icon.set_icon_size(size);
    }

    _setIcon(gicon) {
        if (gicon !== this._shownIcon) {
            this._icon.gicon = gicon;
            this._shownIcon = gicon;
        }
    }

    _loadCat() {
        let catsDir = this._metadata.path + "/cats";
        let folder = this.catId || DEFAULT_CAT;
        let run = loadFrames(catsDir + "/" + folder, "frame_");

        // chosen cat is missing: try the default cat
        if (run.length === 0 && folder !== DEFAULT_CAT) {
            global.logWarning("Zoomies: cat '" + folder + "' not found, using " + DEFAULT_CAT);
            folder = DEFAULT_CAT;
            run = loadFrames(catsDir + "/" + folder, "frame_");
        }

        // default cat is missing too: use the first cat that exists
        if (run.length === 0) {
            let cats = listCats(catsDir);
            if (cats.length > 0) {
                global.logWarning("Zoomies: cat '" + folder + "' not found, using " + cats[0]);
                folder = cats[0];
                run = loadFrames(catsDir + "/" + folder, "frame_");
            } else {
                global.logWarning("Zoomies: no cats found in " + catsDir);
                folder = null;
            }
        }

        this._frames = run;
        this._frame = 0;
        this._currentCat = folder;
        this._shownIcon = null;
        if (run.length > 0) this._setIcon(run[0]);
    }

    openCatPicker() {
        let cats = listCats(this._metadata.path + "/cats");
        if (cats.length === 0) {
            global.logWarning("Zoomies: no cats found in " + this._metadata.path + "/cats");
            return;
        }

        let dialog = new ModalDialog.ModalDialog();
        dialog.contentLayout.add_actor(new St.Label({
            text: "Choose your cat",
            style: "font-weight: bold; font-size: 14pt; padding-bottom: 12px;",
        }));

        // padding on the right leaves room for the scrollbar
        let grid = new St.BoxLayout({ vertical: true, style: "padding-right: 10px;" });
        let row = null;
        cats.forEach((cat, i) => {
            if (i % PICKER_COLUMNS === 0) {
                row = new St.BoxLayout({ style: "spacing: 12px; padding-bottom: 12px;" });
                grid.add_actor(row);
            }
            row.add_actor(this._makeCatButton(cat, dialog));
        });

        // the grid scrolls once there are more cats than fit in PICKER_MAX_HEIGHT
        let scroll = new St.ScrollView({ style: "max-height: " + PICKER_MAX_HEIGHT + "px;" });
        let policy = St.PolicyType || imports.gi.Gtk.PolicyType;   // older Cinnamon uses Gtk's
        scroll.set_policy(policy.NEVER, policy.AUTOMATIC);
        scroll.add_actor(grid);
        dialog.contentLayout.add_actor(scroll);

        dialog.setButtons([{
            label: "Close",
            action: () => dialog.close(),
            key: Clutter.KEY_Escape,
        }]);
        this._picker = dialog;
        dialog.open();
    }

    _makeCatButton(cat, dialog) {
        let isCurrent = this._currentCat === cat;
        let button = new St.Button({
            reactive: true,
            track_hover: true,
            can_focus: true,
            style: "padding: 8px; border-radius: 8px; border: 2px solid " +
                (isCurrent ? BAR_COLOR : "transparent") + ";",
        });

        let box = new St.BoxLayout({ vertical: true, style: "spacing: 6px;" });
        let file = Gio.File.new_for_path(this._metadata.path + "/cats/" + cat + "/frame_0.png");
        box.add_actor(new St.Icon({
            gicon: new Gio.FileIcon({ file: file }),
            icon_size: PICKER_ICON_SIZE,
        }));
        box.add_actor(new St.Label({
            text: catDisplayName(this._metadata.path + "/cats", cat),
            x_align: Clutter.ActorAlign.CENTER,
        }));
        button.set_child(box);

        button.connect("clicked", () => {
            this.settings.setValue("cat", cat);
            this._loadCat();    // don't wait for the settings callback
            dialog.close();
        });
        return button;
    }

    _chooseSensor() {
        let SensorClass = SENSORS[this.sensorId] || CpuSensor;
        this._sensor = new SensorClass();
        this._load = 0;
        this._text = "";
        this._history = [];
        this._alertCount = 0;
    }

    // the next sample is always scheduled, even if this one fails,
    // so one bad read can't stop the cat for good
    _sample() {
        try {
            let result = this._sensor.read();
            this._load = Math.min(100, Math.max(0, result.load));
            if (TEST_LOAD !== null) this._load = TEST_LOAD;
            this._text = result.text;

            if (result.value !== null) this._history.push(result.value);
            this._trimHistory();
            this._updateAlert();

            this.set_applet_tooltip((this._alerting ? "High load - " : "") +
                this._sensor.name + ": " + result.text);
        } catch (e) {
            this._logError("sensor", e);
        }

        this._sampleTimeout = Mainloop.timeout_add_seconds(1, () => {
            this._sample();
            return false;
        });
    }

    _trimHistory() {
        let keep = Math.max(10, this.historySeconds || 120);
        if (this._history.length > keep) this._history.splice(0, this._history.length - keep);
    }

    // CPU and RAM only. network and disk load is relative to their recent peak,
    // so a fixed threshold doesn't really mean anything there
    _updateAlert() {
        let canAlert = !!this.alertEnabled && this._sensor.kind === "percent";
        if (canAlert && this._load >= this.alertThreshold) this._alertCount++;
        else this._alertCount = 0;

        let on = canAlert && this._alertCount >= this.alertSeconds;
        if (on !== this._alerting) {
            this._alerting = on;
            this._icon.set_style(on ? ALERT_ICON_STYLE : "");
            this._label.set_style(on ? ALERT_LABEL_STYLE : "");
        }
    }

    // ms per frame at the current load
    _speedDelay() {
        let slow = Math.max(this.slowestMs, this.fastestMs);
        let fast = Math.min(this.slowestMs, this.fastestMs);
        let t = Math.pow(this._load / 100, this.curve);
        let delay = Math.round(slow - t * (slow - fast));
        return isFinite(delay) ? Math.max(10, delay) : 250;
    }

    _updateLabel() {
        let show = !!this.showValue;
        if (this._label.visible !== show) this._label.visible = show;
        if (show) {
            let text = " " + this._text;
            if (text !== this._lastLabel) {
                this._label.set_text(text);
                this._lastLabel = text;
            }
        }
    }

    // the next frame is always scheduled, even if this one fails
    _animate() {
        let delay = HIDDEN_CHECK_MS;

        try {
            // panel auto-hidden: don't bother drawing, just check back less often
            let visible = this.actor.mapped !== false;

            if (this._frames.length > 0) {
                this._frame = (this._frame + 1) % this._frames.length;
                if (visible) this._setIcon(this._frames[this._frame]);
                delay = this._speedDelay();
            }
            if (!visible) delay = Math.max(delay, HIDDEN_CHECK_MS);

            this._updateLabel();
        } catch (e) {
            this._logError("animation", e);
            delay = HIDDEN_CHECK_MS;
        }

        this._animTimeout = Mainloop.timeout_add(delay, () => {
            this._animate();
            return false;
        });
    }

    // icon, name and value on top, bar underneath
    _makeRow() {
        let item = new PopupMenu.PopupBaseMenuItem({ reactive: false });

        let box = new St.BoxLayout({ vertical: true, x_expand: true });
        let top = new St.BoxLayout({ x_expand: true });
        let icon = new St.Icon({ icon_size: ROW_ICON_SIZE, style: "padding-right: 6px;" });
        let name = new St.Label({
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
        });
        let value = new St.Label({
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });
        top.add_actor(icon);
        top.add_actor(name);
        top.add_actor(value);

        let track = new St.BoxLayout({
            style: "background-color: " + TRACK_COLOR + "; border-radius: 2px;",
            width: BAR_WIDTH,
            height: BAR_HEIGHT,
        });
        let fill = new St.Widget({
            style: "background-color: " + BAR_COLOR + "; border-radius: 2px;",
            height: BAR_HEIGHT,
        });
        track.add_actor(fill);

        box.add_actor(top);
        box.add_actor(track);
        item.addActor(box, { expand: true, span: -1 });

        return { item: item, icon: icon, name: name, value: value, track: track, fill: fill };
    }

    _onMenuToggled(open) {
        if (open) {
            this._prevSnap = null;       // old snapshot would give wrong rates
            this._prevSnapKind = "";
            this._refreshMenu();
        } else if (this._menuTimeout) {
            Mainloop.source_remove(this._menuTimeout);
            this._menuTimeout = null;
        }
    }

    // compares a new snapshot with the last one of the same kind.
    // null the first time since there's nothing to compare yet
    _delta(kind, takeSnapshot, compare) {
        let cur = takeSnapshot();
        let prev = this._prevSnapKind === kind ? this._prevSnap : null;
        this._prevSnap = cur;
        this._prevSnapKind = kind;
        return prev ? compare(prev, cur) : null;
    }

    // the next refresh is always scheduled, even if this one fails,
    // so the popup can't freeze
    _refreshMenu() {
        try {
            this._fillMenu();
        } catch (e) {
            this._logError("details popup", e);
            try {
                this._showRows("Details", null, "Could not read the details right now");
            } catch (e2) {
                // nothing more we can do this round
            }
        }

        this._menuTimeout = Mainloop.timeout_add_seconds(1, () => {
            this._refreshMenu();
            return false;
        });
    }

    _fillMenu() {
        let res = this._resolver;
        let id = SENSORS[this.sensorId] ? this.sensorId : "cpu";
        let title = "";
        let rows = null;        // [{ name, icon, value, amount }]
        let message = "";

        if (id === "cpu") {
            title = "Top processes: CPU";
            let list = this._delta("cpu", snapshotCpu, (p, c) => topCpu(p, c, TOP_COUNT, res));
            if (list === null) {
                message = "Measuring...";
            } else {
                rows = list.map(r => ({
                    name: r.info.label,
                    icon: r.info.icon,
                    value: r.percent.toFixed(1) + "%",
                    amount: r.percent,
                }));
                if (rows.length === 0) message = "Nothing using the CPU right now";
            }
        } else if (id === "ram") {
            title = "Top processes: RAM";
            this._prevSnap = null;
            this._prevSnapKind = "";
            rows = topRam(TOP_COUNT, res).map(r => ({
                name: r.info.label,
                icon: r.info.icon,
                value: formatBytes(r.bytes) + " (" + r.percent.toFixed(1) + "%)",
                amount: r.bytes,
            }));
            if (rows.length === 0) message = "No data";
        } else if (id === "disk") {
            title = "Disk writes: your apps";
            let list = this._delta("disk", snapshotDisk, (p, c) => topDisk(p, c, TOP_COUNT, res));
            if (list === null) {
                message = "Measuring...";
            } else {
                rows = list.map(r => ({
                    name: r.info.label,
                    icon: r.info.icon,
                    value: formatRate(r.rate),
                    amount: r.rate,
                }));
                if (rows.length === 0) message = "Nothing writing to disk right now";
            }
        } else {
            title = "Network by interface";
            let list = this._delta("net", snapshotNet, (p, c) => topNet(p, c, TOP_COUNT));
            if (list === null) {
                message = "Measuring...";
            } else {
                rows = list.map(r => ({
                    name: r.info.label,
                    icon: r.info.icon,
                    value: "↓ " + formatRate(r.rx) + "  ↑ " + formatRate(r.tx),
                    amount: r.total,
                }));
                if (rows.length === 0) message = "No network traffic right now";
            }
        }

        this._showRows(title, rows, message);
        this._showGraph();
    }

    _showRows(title, rows, message) {
        this._titleItem.label.set_text(title);

        // nothing to list, show the message in the first row
        if (!rows || rows.length === 0) {
            let first = this._rows[0];
            first.name.set_text(message || "No data");
            first.icon.hide();
            first.value.hide();
            first.track.hide();
            first.item.actor.show();
            for (let i = 1; i < this._rows.length; i++) this._rows[i].item.actor.hide();
            return;
        }

        // bars are relative to the top entry
        let max = rows[0].amount > 0 ? rows[0].amount : 1;
        for (let i = 0; i < this._rows.length; i++) {
            let row = this._rows[i];
            if (i < rows.length) {
                let r = rows[i];
                row.name.set_text(r.name);
                row.icon.set_gicon(r.icon || this._fallbackIcon);
                row.icon.show();
                row.value.set_text(r.value);
                row.value.show();
                row.track.show();
                row.fill.set_width(Math.max(2, Math.round(BAR_WIDTH * r.amount / max)));
                row.item.actor.show();
            } else {
                row.item.actor.hide();
            }
        }
    }

    _showGraph() {
        if (!this.showHistory) {
            this._graphItem.actor.hide();
            return;
        }
        this._graphItem.actor.show();

        let n = this._history.length;
        if (n < 2) {
            this._graphLabel.set_text("Collecting history...");
        } else {
            let peak = 0;
            for (let v of this._history) if (v > peak) peak = v;
            let peakText = this._sensor.kind === "percent" ? Math.round(peak) + "%" : formatRate(peak);
            this._graphLabel.set_text("Last " + formatDuration(n) + "  -  peak " + peakText);
        }
        this._graph.queue_repaint();
    }

    // filled line graph, newest value on the right
    _drawGraph(area) {
        let [w, h] = area.get_surface_size();
        let cr = area.get_context();

        try {
            cr.setSourceRGBA(0.5, 0.5, 0.5, 0.15);
            cr.rectangle(0, 0, w, h);
            cr.fill();

            let values = this._history;
            let n = values.length;
            if (n >= 2) {
                let capacity = Math.max(10, this.historySeconds || 120);
                let step = w / (capacity - 1);
                let yMax = graphMax(this._sensor.kind, values);
                let pts = values.map((v, i) => [
                    w - (n - 1 - i) * step,
                    h - 1 - (h - 2) * Math.min(1, v / yMax),
                ]);

                cr.setSourceRGBA(BAR_RGB[0], BAR_RGB[1], BAR_RGB[2], 0.25);
                cr.moveTo(pts[0][0], h);
                for (let p of pts) cr.lineTo(p[0], p[1]);
                cr.lineTo(pts[n - 1][0], h);
                cr.closePath();
                cr.fill();

                cr.setSourceRGBA(BAR_RGB[0], BAR_RGB[1], BAR_RGB[2], 1);
                cr.setLineWidth(1.5);
                cr.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < n; i++) cr.lineTo(pts[i][0], pts[i][1]);
                cr.stroke();
            }
        } catch (e) {
            this._logError("history graph", e);
        } finally {
            if (cr.$dispose) cr.$dispose();
        }
    }

    on_applet_removed_from_panel() {
        if (this._sampleTimeout) Mainloop.source_remove(this._sampleTimeout);
        if (this._animTimeout) Mainloop.source_remove(this._animTimeout);
        if (this._menuTimeout) Mainloop.source_remove(this._menuTimeout);
        if (this._appMonitor && this._appMonitorId) this._appMonitor.disconnect(this._appMonitorId);
        if (this._picker) this._picker.close();
        this.menu.destroy();        // otherwise the popup stays around until Cinnamon restarts
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new ZoomiesApplet(metadata, orientation, panelHeight, instanceId);
}
