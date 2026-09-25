/*
 * Kapszula panel monitor - providers.js
 *
 * Data collection only. This module hands back raw numbers: it knows nothing
 * about alert thresholds, text formatting or colors. The contract it has to
 * honour is written down in SPEC.md, section 7.1.
 *
 * Loaded from the other modules as:
 *   const Providers = imports.ui.appletManager.applets['kapszula@gaborkis'].providers;
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// GTop is an optional dependency (gir1.2-gtop-2.0). Without it every GTop
// backed reading degrades to null instead of throwing.
var GTop = null;
try {
    GTop = imports.gi.GTop;
} catch (e) {
    GTop = null;
}

/* ------------------------------------------------------------------------ *
 * Constants that follow from the specification, not from user settings.
 * ------------------------------------------------------------------------ */

// CPU: window of the rolling average that backs the sustained load reading.
const CPU_AVG_WINDOW_US = 10 * 1000000;

// TMP: hwmon chip names that carry the CPU package temperature, in order of
// preference. The hwmon index itself changes between boots and must never be
// hardcoded, so the chips are looked up by name.
const CPU_TEMP_CHIPS = ["k10temp", "coretemp"];
const HWMON_DIR = "/sys/class/hwmon";
// How often a failed temperature lookup is retried (the chip may reappear).
const TEMP_RESCAN_US = 30 * 1000000;

// NET: twenty history buckets, one second each, newest one last. Twenty
// buckets of one second give a twenty second window, and the right hand edge
// still moves every single second (SPEC.md 6.2).
const NET_BARS = 20;
const NET_BUCKET_US = 1000000;
// Bar heights are scaled to the peak of exactly the window that is on screen,
// so this is deliberately tied to the bar count rather than being a number of
// its own. The scale therefore comes from what is actually visible: the
// tallest visible bar always fills the frame, and when a spike rolls off the
// left edge the scale comes back with it, within twenty seconds instead of a
// minute. The absolute magnitude is not lost, because v2 prints both speeds as
// numbers next to the graph - the graph carries the shape and the rhythm, the
// numbers carry the magnitude. Do not "simplify" this back to a longer window.
const NET_PEAK_WINDOW_US = NET_BARS * NET_BUCKET_US;
// ... with a floor, applied to each direction on its own.
//
// The floor decides what counts as traffic at all. Anything below half a
// megabyte per second is not blown up to the height of the frame, because it is
// either idle noise or the acknowledgement traffic that the opposite direction
// produces as a by-product. Anything above it is a real event and fills the
// frame.
//
// 512 KB/s rather than 128: measured on this machine, a 50 MB/s download drives
// 80-133 KB/s of upstream ACKs. Against a 128 KB/s floor that drew the upload
// half at 63-100 % during every large download, which reads as "a serious
// upload is running" when nothing of the sort is happening. Against 512 KB/s
// the same ACK peak is 26 % - visible, clearly subordinate. A modest but real
// 300 KB/s upload still gets 59 %, and idle noise stays under 1 %.
const NET_PEAK_FLOOR_BPS = 512 * 1024;
// The interface list is re-read now and then, so that interfaces that come and
// go (docker veth pairs, VPN tunnels) are picked up without an applet restart.
const NET_DEVLIST_TTL_US = 10 * 1000000;
const NET_SYSFS_DIR = "/sys/class/net";

// SSD: filesystem types that are never offered as a fixed volume. Every other
// pseudo filesystem is already filtered out by the "must live on /dev" rule,
// but squashfs images do sit on a real /dev/loopN device, so the list stays.
const PSEUDO_FSTYPES = ["tmpfs", "devtmpfs", "squashfs", "efivarfs"];
// Mount point prefixes that hold removable or hand mounted media.
const REMOVABLE_PREFIXES = ["/media/", "/run/media/", "/mnt/"];
const MOUNTS_FILE = "/proc/mounts";

// GPU: a single call brings every GPU field. --id=0 pins the reading to the
// first NVIDIA adapter, so an integrated GPU never interferes.
const NVIDIA_ARGV = [
    "nvidia-smi",
    "--id=0",
    "--query-gpu=memory.used,memory.total,utilization.gpu,temperature.gpu",
    "--format=csv,noheader,nounits"
];

/* ------------------------------------------------------------------------ *
 * Small helpers.
 * ------------------------------------------------------------------------ */

function _now() {
    return GLib.get_monotonic_time();
}

function _decode(bytes) {
    if (typeof bytes === "string")
        return bytes;
    try {
        return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
        return imports.byteArray.toString(bytes);
    }
}

// Reads a whole text file. Returns null instead of throwing when the file is
// missing or unreadable, which is the normal case all over /sys.
function _readTextFile(path) {
    try {
        let [ok, bytes] = GLib.file_get_contents(path);
        if (!ok)
            return null;
        return _decode(bytes);
    } catch (e) {
        return null;
    }
}

function _readNumberFile(path) {
    let text = _readTextFile(path);
    if (text === null)
        return null;
    let value = parseFloat(text.trim());
    return isFinite(value) ? value : null;
}

// A finite number, or null. Every value that leaves this module goes through
// one of these, because the contract allows numbers and null only.
function _num(value) {
    return (typeof value === "number" && isFinite(value)) ? value : null;
}

function _round(value, decimals) {
    if (!(typeof value === "number" && isFinite(value)))
        return null;
    let f = Math.pow(10, decimals);
    return Math.round(value * f) / f;
}

function _clamp(value, min, max) {
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}

// /proc/mounts escapes spaces, tabs, newlines and backslashes in octal.
function _unescapeMountField(field) {
    return field.replace(/\\([0-7]{3})/g, function (all, octal) {
        return String.fromCharCode(parseInt(octal, 8));
    });
}

// Works inside Cinnamon and in a plain cjs test run alike.
function _log(message) {
    if (typeof global !== "undefined" && global && typeof global.log === "function")
        global.log("[kapszula] " + message);
}

/* ------------------------------------------------------------------------ *
 * Sampler
 * ------------------------------------------------------------------------ */

var Sampler = function Sampler() {
    this._init();
};

Sampler.prototype = {

    _init: function () {
        this._destroyed = false;

        // Diagnostics are printed at most once per kind, never once per cycle.
        this._logged = {};

        // Settings mirrored from the applet.
        this._diskMount = "/";
        this._nvidiaEnabled = true;

        // Latest known values. Every sampler rebuilds its object from scratch,
        // so the objects handed out by getValues() are immutable snapshots.
        this._mem = null;
        this._swp = null;
        this._cpu = null;
        this._gpu = null;
        this._gfx = null;
        this._tmp = null;
        this._ssd = null;
        this._net = null;

        this._initCpu();
        this._initMem();
        this._initTemp();
        this._initNet();
        this._initGpu();

        // The disk is slow moving, but the first value should be there before
        // the first 60 s cycle elapses.
        this.sampleDisk();
    },

    /* -------------------------------------------------------------------- *
     * Configuration
     * -------------------------------------------------------------------- */

    setDiskMount: function (path) {
        let mount = (typeof path === "string" && path !== "") ? path : "/";
        if (mount === this._diskMount)
            return;
        this._diskMount = mount;
        // A settings change should be visible right away, not up to a minute
        // later. statvfs is cheap and this only runs on user interaction.
        this.sampleDisk();
    },

    setNvidiaEnabled: function (enabled) {
        this._nvidiaEnabled = !!enabled;
        if (!this._nvidiaEnabled) {
            this._gpu = null;
            this._gfx = null;
        }
    },

    /* -------------------------------------------------------------------- *
     * Sampling entry points
     * -------------------------------------------------------------------- */

    // 1000 ms cycle: everything that is cheap and stays inside the process.
    sampleFast: function () {
        if (this._destroyed)
            return;
        let now = _now();
        this._sampleCpu(now);
        this._sampleMem();
        this._sampleSwap();
        this._sampleNet(now);
        this._sampleTemp(now);
    },

    // 5000 ms cycle: starts the asynchronous nvidia-smi call. The result lands
    // in the cache from the callback; getValues() keeps serving the previous
    // reading until then.
    sampleGpu: function () {
        if (this._destroyed)
            return;

        if (!this._nvidiaEnabled) {
            this._gpu = null;
            this._gfx = null;
            return;
        }

        if (this._nvidiaPath === undefined) {
            this._nvidiaPath = GLib.find_program_in_path("nvidia-smi");
            if (!this._nvidiaPath)
                this._logOnce("nvidia-missing", "nvidia-smi not found, GPU readings stay empty");
        }
        if (!this._nvidiaPath) {
            this._gpu = null;
            this._gfx = null;
            return;
        }

        // A call is still in flight. Never stack a second process on top of it.
        if (this._gpuProc)
            return;

        try {
            this._gpuCancellable = new Gio.Cancellable();
            this._gpuProc = Gio.Subprocess.new(
                NVIDIA_ARGV,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            this._gpuProc.communicate_utf8_async(null, this._gpuCancellable,
                (source, result) => this._onGpuFinished(source, result));
        } catch (e) {
            this._gpuProc = null;
            this._gpuCancellable = null;
            this._gpu = null;
            this._gfx = null;
            this._logOnce("nvidia-spawn", "nvidia-smi could not be started: " + e.message);
        }
    },

    // 60000 ms cycle.
    sampleDisk: function () {
        if (this._destroyed)
            return;
        let mount = this._diskMount;
        let usage = this._fsUsage(mount);
        if (!usage) {
            this._ssd = null;
            return;
        }
        this._ssd = {
            pct: _round(usage.pct, 1),
            mount: mount,
            usedBytes: Math.round(usage.usedBytes),
            totalBytes: Math.round(usage.totalBytes)
        };
    },

    getValues: function () {
        return {
            mem: this._mem,
            swp: this._swp,
            cpu: this._cpu,
            gpu: this._gpu,
            gfx: this._gfx,
            tmp: this._tmp,
            ssd: this._ssd,
            net: this._net
        };
    },

    /* -------------------------------------------------------------------- *
     * CPU
     * -------------------------------------------------------------------- */

    _initCpu: function () {
        this._cpuGtop = null;
        this._cpuLast = null;
        this._cpuHistory = [];
        if (!GTop)
            return;
        try {
            this._cpuGtop = new GTop.glibtop_cpu();
            // Prime the counters, so the very first cycle already has a delta.
            this._readCpuCounters();
        } catch (e) {
            this._cpuGtop = null;
            this._logOnce("cpu-init", "CPU sampling unavailable: " + e.message);
        }
    },

    _readCpuCounters: function () {
        GTop.glibtop_get_cpu(this._cpuGtop);
        let g = this._cpuGtop;
        this._cpuLast = { total: g.total, idle: g.idle, iowait: g.iowait };
    },

    _sampleCpu: function (now) {
        if (!this._cpuGtop) {
            this._cpu = null;
            return;
        }
        try {
            let previous = this._cpuLast;
            this._readCpuCounters();
            let current = this._cpuLast;

            let deltaTotal = current.total - previous.total;
            if (!(deltaTotal > 0))
                return;                 // no time passed, keep the last reading

            // Waiting for I/O is not the processor doing work, so iowait counts
            // as idle here.
            let deltaIdle = (current.idle - previous.idle) + (current.iowait - previous.iowait);
            let pct = _clamp(100 * (1 - deltaIdle / deltaTotal), 0, 100);

            this._cpuHistory.push({ t: now, pct: pct });
            while (this._cpuHistory.length > 0 && (now - this._cpuHistory[0].t) > CPU_AVG_WINDOW_US)
                this._cpuHistory.shift();

            let sum = 0;
            for (let i = 0; i < this._cpuHistory.length; i++)
                sum += this._cpuHistory[i].pct;
            let avg = this._cpuHistory.length > 0 ? sum / this._cpuHistory.length : pct;

            this._cpu = { pct: _round(pct, 1), avg10: _round(avg, 1) };
        } catch (e) {
            this._cpu = null;
            this._logOnce("cpu-read", "CPU sampling failed: " + e.message);
        }
    },

    /* -------------------------------------------------------------------- *
     * Memory and swap
     * -------------------------------------------------------------------- */

    _initMem: function () {
        this._memGtop = null;
        this._swapGtop = null;
        if (!GTop)
            return;
        try {
            this._memGtop = new GTop.glibtop_mem();
            this._swapGtop = new GTop.glibtop_swap();
        } catch (e) {
            this._memGtop = null;
            this._swapGtop = null;
            this._logOnce("mem-init", "memory sampling unavailable: " + e.message);
        }
    },

    _sampleMem: function () {
        if (!this._memGtop) {
            this._mem = null;
            return;
        }
        try {
            GTop.glibtop_get_mem(this._memGtop);
            let g = this._memGtop;
            let total = g.total;
            if (!(total > 0)) {
                this._mem = null;
                return;
            }
            // Really used memory. The raw "used" figure counts the page cache
            // too, so it sits around 90 % at all times and says nothing.
            let used = g.used - g.cached - g.buffer;
            if (!(used > 0))
                used = 0;
            this._mem = {
                pct: _round(_clamp(100 * used / total, 0, 100), 1),
                usedBytes: Math.round(used),
                totalBytes: Math.round(total)
            };
        } catch (e) {
            this._mem = null;
            this._logOnce("mem-read", "memory sampling failed: " + e.message);
        }
    },

    _sampleSwap: function () {
        if (!this._swapGtop) {
            this._swp = null;
            return;
        }
        try {
            GTop.glibtop_get_swap(this._swapGtop);
            let g = this._swapGtop;
            let total = g.total;
            let used = g.used;
            // A machine without swap is at 0 %, not unknown.
            let pct = (total > 0) ? _clamp(100 * used / total, 0, 100) : 0;
            this._swp = {
                pct: _round(pct, 1),
                usedBytes: Math.round(total > 0 ? used : 0),
                totalBytes: Math.round(total > 0 ? total : 0)
            };
        } catch (e) {
            this._swp = null;
            this._logOnce("swap-read", "swap sampling failed: " + e.message);
        }
    },

    /* -------------------------------------------------------------------- *
     * CPU temperature
     * -------------------------------------------------------------------- */

    _initTemp: function () {
        this._tempPath = null;
        this._tempScanStamp = 0;
        this._tempPath = this._findCpuTempPath();
        this._tempScanStamp = _now();
    },

    // The hwmon index changes between boots, so the chip is located by the
    // name file rather than by a hardcoded number.
    _findCpuTempPath: function () {
        let best = null;
        let bestRank = CPU_TEMP_CHIPS.length;
        try {
            let dir = Gio.File.new_for_path(HWMON_DIR);
            let enumerator = dir.enumerate_children("standard::name",
                Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                let base = HWMON_DIR + "/" + info.get_name();
                let name = _readTextFile(base + "/name");
                if (name === null)
                    continue;
                let rank = CPU_TEMP_CHIPS.indexOf(name.trim());
                if (rank < 0 || rank >= bestRank)
                    continue;
                let input = base + "/temp1_input";
                if (_readNumberFile(input) === null)
                    continue;
                best = input;
                bestRank = rank;
            }
            enumerator.close(null);
        } catch (e) {
            return best;
        }
        if (!best)
            this._logOnce("temp-missing", "no k10temp or coretemp hwmon chip found");
        return best;
    },

    _sampleTemp: function (now) {
        // A missing or vanished chip is retried, but only every 30 seconds.
        if (!this._tempPath && (now - this._tempScanStamp) >= TEMP_RESCAN_US) {
            this._tempScanStamp = now;
            this._tempPath = this._findCpuTempPath();
        }
        if (!this._tempPath) {
            this._tmp = null;
            return;
        }
        let milli = _readNumberFile(this._tempPath);
        if (milli === null) {
            // The chip was re-enumerated under a different index.
            this._tempPath = null;
            this._tempScanStamp = now - TEMP_RESCAN_US;
            this._tmp = null;
            return;
        }
        this._tmp = { celsius: _round(milli / 1000, 1) };
    },

    /* -------------------------------------------------------------------- *
     * Network
     * -------------------------------------------------------------------- */

    _initNet: function () {
        this._netload = null;
        this._netDevices = [];
        this._netDevStamp = 0;
        this._netCounters = {};      // interface -> { rx, tx }
        this._netSamples = [];       // { t, down, up } over the visible window
        this._netStamp = 0;

        if (!GTop)
            return;
        try {
            this._netload = new GTop.glibtop_netload();
        } catch (e) {
            this._netload = null;
            this._logOnce("net-init", "network sampling unavailable: " + e.message);
            return;
        }
        this._refreshNetDevices(true);
        // Prime the byte counters so the first cycle already yields a delta.
        this._readNetCounters();
        this._netStamp = _now();
    },

    _refreshNetDevices: function (force) {
        let now = _now();
        if (!force && (now - this._netDevStamp) < NET_DEVLIST_TTL_US)
            return;
        this._netDevStamp = now;

        let devices = null;
        try {
            let netlist = new GTop.glibtop_netlist();
            devices = GTop.glibtop_get_netlist(netlist);
        } catch (e) {
            devices = null;
        }

        // Workaround inherited from sysmonitor@orcus/3.0/providers.js, do not
        // remove: after GTop.glibtop_get_netlist() the first String.match()
        // call throws once ("Could not locate glibtop_init_s ... undefined
        // symbol: glibtop_init_s"). Absorbing that throw here keeps it out of
        // the applet initialisation code, where it would abort the applet.
        // Everything works normally once the error has been thrown once.
        try {
            "".match(/./);
        } catch (e) {
        }

        if (!devices || devices.length === 0)
            devices = this._listNetDevicesFromSysfs();

        // Physical interfaces only: an interface backed by real hardware has a
        // "device" entry in sysfs, a virtual one has not. Traffic that actually
        // enters or leaves the machine crosses a physical interface exactly
        // once, so this counts every byte once and no byte twice. Without it,
        // container traffic would be counted two or three times (veth, docker0
        // and the physical card), and a VPN tunnel twice. It also drops the
        // loopback interface, the bridges and the tun/tap devices, without
        // guessing from interface names.
        this._netDevices = devices.filter((device) => this._isPhysicalNetDevice(device));
    },

    _isPhysicalNetDevice: function (device) {
        return GLib.file_test(NET_SYSFS_DIR + "/" + device + "/device", GLib.FileTest.EXISTS);
    },

    _listNetDevicesFromSysfs: function () {
        let devices = [];
        try {
            let dir = Gio.File.new_for_path(NET_SYSFS_DIR);
            let enumerator = dir.enumerate_children("standard::name",
                Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null)
                devices.push(info.get_name());
            enumerator.close(null);
        } catch (e) {
            return [];
        }
        return devices;
    },

    // Sums the byte counters of every physical interface. Deltas are kept per
    // interface, so an interface appearing or disappearing does not show up as
    // a traffic spike.
    _readNetCounters: function () {
        let down = 0;
        let up = 0;
        let counters = {};

        for (let i = 0; i < this._netDevices.length; i++) {
            let device = this._netDevices[i];
            // The interface may be gone since the list was taken (a USB adapter
            // unplugged, a card rebound). Asking GTop about a missing interface
            // would fill the log with warnings on every cycle.
            if (!GLib.file_test(NET_SYSFS_DIR + "/" + device, GLib.FileTest.EXISTS))
                continue;
            let rx, tx;
            try {
                GTop.glibtop_get_netload(this._netload, device);
                rx = this._netload.bytes_in;
                tx = this._netload.bytes_out;
            } catch (e) {
                continue;
            }
            if (!isFinite(rx) || !isFinite(tx))
                continue;

            counters[device] = { rx: rx, tx: tx };
            let previous = this._netCounters[device];
            if (previous) {
                // A recreated interface restarts from zero; skip that step
                // instead of reporting a negative or huge delta.
                if (rx >= previous.rx)
                    down += rx - previous.rx;
                if (tx >= previous.tx)
                    up += tx - previous.tx;
            }
        }

        this._netCounters = counters;
        return [down, up];
    },

    _sampleNet: function (now) {
        if (!this._netload) {
            this._net = null;
            return;
        }
        try {
            this._refreshNetDevices(false);

            let elapsedUs = now - this._netStamp;
            if (elapsedUs < 1000)
                return;                 // called twice within a millisecond
            this._netStamp = now;

            let [downBytes, upBytes] = this._readNetCounters();
            let seconds = elapsedUs / 1000000;
            let down = downBytes / seconds;
            let up = upBytes / seconds;
            let total = down + up;

            this._netSamples.push({ t: now, down: down, up: up });
            while (this._netSamples.length > 0 &&
                   (now - this._netSamples[0].t) > NET_PEAK_WINDOW_US)
                this._netSamples.shift();

            // The bars are scaled to the peak of the twenty seconds that are on
            // screen, with a floor, so that idle noise does not show up as a
            // full graph. Sample retention and the peak window are the same
            // number, so this loop already sees exactly the visible samples.
            //
            // EACH DIRECTION HAS ITS OWN PEAK AND ITS OWN FLOOR, ON PURPOSE.
            // Do not put the two halves back on a shared scale, and do not take
            // the peak from down + up. Both were tried and both were wrong:
            // the download phase of a speed test pushed the shared peak up, so
            // the upload phase that followed was drawn at a fifth of its height
            // for twenty seconds and then jumped when the download samples
            // rolled out of the window; and a peak taken from the sum meant
            // neither direction ever reached full height while anything at all
            // was moving the other way.
            //
            // The price is that the height of the upper half can no longer be
            // compared with the height of the lower half. That is accepted: the
            // graph answers "is anything moving, which way, in what rhythm",
            // and the two numbers printed next to it carry the magnitude.
            let peakDown = NET_PEAK_FLOOR_BPS;
            let peakUp = NET_PEAK_FLOOR_BPS;
            for (let i = 0; i < this._netSamples.length; i++) {
                let sample = this._netSamples[i];
                if (sample.down > peakDown)
                    peakDown = sample.down;
                if (sample.up > peakUp)
                    peakUp = sample.up;
            }

            let history = this._netHistory(now, peakDown, peakUp);

            this._net = {
                downBps: Math.round(down),
                upBps: Math.round(up),
                totalBps: Math.round(total),
                peakDownBps: Math.round(peakDown),
                peakUpBps: Math.round(peakUp),
                // Kept so that anything still reading the old field gets a
                // sensible number: the taller of the two scales.
                peakBps: Math.round(Math.max(peakDown, peakUp)),
                historyDown: history.down,
                historyUp: history.up
            };
        } catch (e) {
            this._net = null;
            this._logOnce("net-read", "network sampling failed: " + e.message);
        }
    },

    // Two arrays of twenty ratios between 0 and 1, one per second of the last
    // twenty seconds, the freshest one at the end of both arrays. The buckets
    // are built from timestamps rather than from sample counts, so the graph
    // still spans twenty seconds when the refresh rate is not exactly one
    // second. Both directions go through the same bucketing, but each is
    // divided by its own peak - see the comment in _sampleNet() for why the
    // two arrays are deliberately not comparable with each other.
    _netHistory: function (now, peakDown, peakUp) {
        let downSums = [];
        let upSums = [];
        let counts = [];
        for (let i = 0; i < NET_BARS; i++) {
            downSums.push(0);
            upSums.push(0);
            counts.push(0);
        }

        // Reading that is already older than the window; empty leading buckets
        // inherit it when the refresh rate is slower than one second. Both
        // directions are carried together, they always come from one sample.
        let carryDown = null;
        let carryUp = null;

        for (let i = 0; i < this._netSamples.length; i++) {
            let sample = this._netSamples[i];
            let age = now - sample.t;
            if (age < 0)
                age = 0;
            let index = NET_BARS - 1 - Math.floor(age / NET_BUCKET_US);
            if (index < 0) {
                // Samples are in chronological order, so the last one that
                // falls out of the window on this side is the freshest of them.
                carryDown = sample.down;
                carryUp = sample.up;
                continue;
            }
            if (index >= NET_BARS)
                continue;
            downSums[index] += sample.down;
            upSums[index] += sample.up;
            counts[index] += 1;
        }

        let downBars = [];
        let upBars = [];
        for (let i = 0; i < NET_BARS; i++) {
            let downValue;
            let upValue;
            if (counts[i] > 0) {
                downValue = downSums[i] / counts[i];
                upValue = upSums[i] / counts[i];
                carryDown = downValue;
                carryUp = upValue;
            } else {
                // Nothing measured in this second: hold the previous reading,
                // or stay at zero while the history is still filling up.
                downValue = (carryDown === null) ? 0 : carryDown;
                upValue = (carryUp === null) ? 0 : carryUp;
            }
            downBars.push(_round(_clamp(downValue / peakDown, 0, 1), 3));
            upBars.push(_round(_clamp(upValue / peakUp, 0, 1), 3));
        }
        return { down: downBars, up: upBars };
    },

    /* -------------------------------------------------------------------- *
     * GPU (asynchronous nvidia-smi)
     * -------------------------------------------------------------------- */

    _initGpu: function () {
        this._nvidiaPath = undefined;   // undefined = not looked up yet
        this._gpuProc = null;
        this._gpuCancellable = null;
    },

    _onGpuFinished: function (source, result) {
        this._gpuProc = null;
        this._gpuCancellable = null;

        let output = null;
        let failure = null;
        try {
            let [ok, stdout, stderr] = source.communicate_utf8_finish(result);
            if (ok && source.get_successful())
                output = stdout;
            else
                failure = "nvidia-smi returned an error: " + String(stderr || "").trim();
        } catch (e) {
            failure = "nvidia-smi call failed: " + e.message;
        }

        // Cancelled from destroy(): nothing to report and nothing to update.
        if (this._destroyed)
            return;
        if (failure)
            this._logOnce("nvidia-call", failure);

        // The setting may have been switched off while the call was running.
        if (!this._nvidiaEnabled)
            return;

        let parsed = this._parseNvidia(output);
        if (!parsed) {
            this._gpu = null;
            this._gfx = null;
            return;
        }
        this._gpu = parsed.gpu;
        this._gfx = parsed.gfx;
    },

    // Expected output on this machine: "10866, 16303, 0, 41"
    _parseNvidia: function (text) {
        if (!text)
            return null;

        let lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line === "")
                continue;

            // The first line is the first NVIDIA adapter; that is the one.
            let fields = line.split(",");
            if (fields.length < 3)
                return null;

            // Fields can read "[N/A]" on some adapters, which is not a number.
            let usedMiB = _num(parseFloat(fields[0]));
            let totalMiB = _num(parseFloat(fields[1]));
            let gfxPct = _num(parseFloat(fields[2]));
            let tempC = (fields.length > 3) ? _num(parseFloat(fields[3])) : null;

            let gpu = null;
            if (usedMiB !== null && totalMiB !== null && totalMiB > 0) {
                gpu = {
                    pct: _round(_clamp(100 * usedMiB / totalMiB, 0, 100), 1),
                    usedMiB: Math.round(usedMiB),
                    totalMiB: Math.round(totalMiB),
                    // The same call already carries the adapter temperature, so
                    // it is published here. Nothing shows it yet, on purpose.
                    celsius: _round(tempC, 1)
                };
            }
            let gfx = (gfxPct === null) ? null : { pct: _round(_clamp(gfxPct, 0, 100), 1) };

            return { gpu: gpu, gfx: gfx };
        }
        return null;
    },

    /* -------------------------------------------------------------------- *
     * Filesystems
     * -------------------------------------------------------------------- */

    // Fixed volumes only: no pseudo filesystems, no removable media.
    listMounts: function () {
        let result = [];
        let text = _readTextFile(MOUNTS_FILE);
        if (text === null)
            return result;

        let lines = text.split("\n");
        let seen = {};
        for (let i = 0; i < lines.length; i++) {
            let parts = lines[i].split(" ");
            if (parts.length < 3)
                continue;
            let device = _unescapeMountField(parts[0]);
            let mount = _unescapeMountField(parts[1]);
            let fstype = parts[2];

            if (seen[mount])
                continue;
            if (!this._isFixedVolume(device, mount, fstype))
                continue;
            seen[mount] = true;

            let usage = this._fsUsage(mount);
            if (!usage)
                continue;
            result.push({
                mount: mount,
                pct: _round(usage.pct, 1),
                fstype: fstype
            });
        }
        return result;
    },

    _isFixedVolume: function (device, mount, fstype) {
        // A fixed volume lives on a real block device. This single rule drops
        // every pseudo filesystem at once: sysfs, proc, cgroup2, overlay, nsfs,
        // fuse mounts, tmpfs and devtmpfs are not mounted from /dev.
        if (device.indexOf("/dev/") !== 0)
            return false;
        // Image filesystems still sit on a real /dev/loopN device.
        if (PSEUDO_FSTYPES.indexOf(fstype) >= 0)
            return false;
        // Removable and hand mounted media.
        for (let i = 0; i < REMOVABLE_PREFIXES.length; i++) {
            if (mount.indexOf(REMOVABLE_PREFIXES[i]) === 0)
                return false;
        }
        return true;
    },

    _fsUsage: function (path) {
        if (!GTop || !path)
            return null;
        // A mount point typed by hand may not exist; statvfs on it would write
        // a warning to the log on every cycle.
        if (!GLib.file_test(path, GLib.FileTest.EXISTS))
            return null;
        try {
            let usage = new GTop.glibtop_fsusage();
            GTop.glibtop_get_fsusage(usage, path);

            let blockSize = usage.block_size > 0 ? usage.block_size : 512;
            let totalBytes = usage.blocks * blockSize;
            if (!(totalBytes > 0))
                return null;

            let usedBytes = (usage.blocks - usage.bfree) * blockSize;
            let availBytes = usage.bavail * blockSize;
            if (!(usedBytes > 0))
                usedBytes = 0;

            // Same convention as df: the blocks reserved for root are neither
            // used nor available, so they are left out of the percentage.
            let denominator = usedBytes + availBytes;
            let pct = (denominator > 0) ? _clamp(100 * usedBytes / denominator, 0, 100) : 0;

            return { pct: pct, usedBytes: usedBytes, totalBytes: totalBytes };
        } catch (e) {
            return null;
        }
    },

    /* -------------------------------------------------------------------- *
     * Housekeeping
     * -------------------------------------------------------------------- */

    // One line per kind of failure for the whole lifetime of the applet, so a
    // permanently missing sensor never floods the log.
    _logOnce: function (key, message) {
        if (this._logged[key])
            return;
        this._logged[key] = true;
        _log(message);
    },

    destroy: function () {
        this._destroyed = true;

        // A running nvidia-smi is cancelled and killed; its callback checks
        // _destroyed and touches nothing afterwards.
        if (this._gpuCancellable) {
            try {
                this._gpuCancellable.cancel();
            } catch (e) {
            }
            this._gpuCancellable = null;
        }
        if (this._gpuProc) {
            try {
                this._gpuProc.force_exit();
            } catch (e) {
            }
            this._gpuProc = null;
        }

        // No timers and no file monitors are created by this module, so the
        // rest is only dropping the GTop handles and the caches.
        this._cpuGtop = null;
        this._memGtop = null;
        this._swapGtop = null;
        this._netload = null;
        this._cpuLast = null;
        this._cpuHistory = [];
        this._netDevices = [];
        this._netCounters = {};
        this._netSamples = [];
        this._mem = null;
        this._swp = null;
        this._cpu = null;
        this._gpu = null;
        this._gfx = null;
        this._tmp = null;
        this._ssd = null;
        this._net = null;
    }
};
