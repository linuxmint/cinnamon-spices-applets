const { CircularBuffer } = imports.lib.sparkline;
const { HISTORY_SIZE, DEFAULT_INTERVAL_SEC } = imports.lib.constants;
const { parseList } = imports.lib.util;
const fileutil   = imports.lib.fileutil;
const BatteryLog = imports.lib.batteryLog;
const GLib       = imports.gi.GLib;

const UptimeMetric  = imports.lib.metrics.uptime;
const BatteryMetric = imports.lib.metrics.battery;
const CpuMetric     = imports.lib.metrics.cpu;
const MemoryMetric  = imports.lib.metrics.memory;
const DiskMetric    = imports.lib.metrics.disk;
const NetworkMetric = imports.lib.metrics.network;
const FanMetric     = imports.lib.metrics.fan;
const ProcessMetric = imports.lib.metrics.processes;
const GpuMetric     = imports.lib.metrics.gpu;

var MetricsManager = class MetricsManager {
  constructor(applet, onUpdate) {
    this._applet   = applet;
    this._onUpdate = onUpdate;
    this._prevCpuStat     = null;
    this._prevProcStats   = null;
    this._prevProcCpuStat = null;
    this._prevNetIfaces  = null;
    this._prevDiskstats  = null;
    this._prevTimestamp  = null;

    const sz = HISTORY_SIZE;
    this._history = {
      loadAvg:       new CircularBuffer(sz),
      batteryPct:    new CircularBuffer(sz),
      batteryW:      new CircularBuffer(sz),
      batteryDraw:   new CircularBuffer(sz),
      batteryCharge: new CircularBuffer(sz),
      cpuPct:        new CircularBuffer(sz),
      cpuPackageC:   new CircularBuffer(sz),
      memPct:        new CircularBuffer(sz),
      diskIo:        new CircularBuffer(sz),
      netRx:         new CircularBuffer(sz),
      netTx:         new CircularBuffer(sz),
      gpuPct:        new CircularBuffer(sz),
    };

    this._data = {};
    this._sub  = { df: null, nvtop: null, nvidia: null };

    this._batLogPath      = GLib.get_user_data_dir() + '/yasm/battery-log.jsonl';
    this._lastBatLogSec   = 0;
    this._batLogCache     = null;
    this._batLogCacheSec  = -1;
    this._lastProcSec     = 0;
    this._lastMemReadSec  = 0;
    this._lastFanReadSec  = 0;
    this._lastDfSec       = 0;
    this._lastNvidiaSec   = 0;
    this._prevRaplEnergyUj = null;
    this._prevRaplTimeSec  = null;
    BatteryLog.pruneOld(fileutil, this._batLogPath);

    this._cachedHwmonPaths = this._resolveHwmonPaths();
    this._hwmonPath        = this._cachedHwmonPaths[0] || null;
    this._cachedFanPaths   = this._resolveFanPaths();

    this._cachedGpus  = GpuMetric.findGpus(fileutil);
    // Detect laptop display once at startup (type=raw/platform/firmware = internal panel)
    this._hasDisplay  = this._detectDisplay();
    // Detect RAPL availability
    this._raplPath    = '/sys/class/powercap/intel-rapl:0/energy_uj';
    this._raplMaxPath = '/sys/class/powercap/intel-rapl:0/max_energy_range_uj';
    this._raplAvail   = fileutil.readFile(this._raplPath) !== null;

    // Pre-seed net interfaces so first collect() can compute delta rates immediately
    this._prevNetIfaces = NetworkMetric.read(fileutil);

    this._fetchAsync();
  }

  _resolveFanPaths() {
    const list    = parseList(this._applet._fanHwmonList);
    const enabled = list.filter(h => h.enabled);
    const valid   = enabled.filter(h => {
      const actual = (fileutil.readFile(`/sys/class/hwmon/hwmon${h.hwmon}/name`) || '').trim();
      return actual && (!h.name || actual === h.name);
    });
    if (valid.length > 0) return valid.map(h => `/sys/class/hwmon/hwmon${h.hwmon}`);
    return FanMetric.findFanChips(fileutil).map(c => c.path);
  }

  _resolveHwmonPaths() {
    const auto = CpuMetric.findCoretemPath(fileutil);
    return auto ? [auto] : [];
  }

  _detectDisplay() {
    const GioFile = imports.gi.Gio.File;
    try {
      const dir = GioFile.new_for_path('/sys/class/backlight');
      const en  = dir.enumerate_children('standard::name', 0, null);
      let fi;
      while ((fi = en.next_file(null)) !== null) {
        const type = (fileutil.readFile(`/sys/class/backlight/${fi.get_name()}/type`) || '').trim();
        if (type === 'raw' || type === 'platform' || type === 'firmware') { en.close(null); return true; }
      }
      en.close(null);
    } catch(e) {}
    return false;
  }

  _readRaplWatts(nowSec) {
    if (!this._raplAvail) return null;
    const raw = fileutil.readFile(this._raplPath);
    if (!raw) return null;
    const uj = parseInt(raw.trim());
    if (isNaN(uj)) return null;
    const prev = this._prevRaplEnergyUj;
    const prevT = this._prevRaplTimeSec;
    this._prevRaplEnergyUj = uj;
    this._prevRaplTimeSec  = nowSec;
    if (prev === null || prevT === null) return null;
    const dt = nowSec - prevT;
    if (dt <= 0) return null;
    let deltaUj = uj - prev;
    if (deltaUj < 0) {
      // counter wrapped — use max_energy_range_uj
      const maxRaw = fileutil.readFile(this._raplMaxPath);
      const maxUj  = maxRaw ? parseInt(maxRaw.trim()) : 0;
      if (maxUj > 0) deltaUj += maxUj;
      else return null;
    }
    return deltaUj / dt / 1e6;
  }

  _batterySource() {
    const list    = parseList(this._applet._batteryList);
    const primary = list.find(b => b.enabled);
    return primary ? primary.device : 'auto';
  }

  _fetchAsync() {
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - this._lastDfSec >= 60) {
      this._lastDfSec = nowSec;
      fileutil.spawnAsync(
        ['df', '-BG', '--output=source,size,avail,pcent,target'],
        out => { this._sub.df = out; }
      );
    }
    const gpuInterval = this._applet._refreshInterval || DEFAULT_INTERVAL_SEC;
    if (this._cachedGpus.length > 0 && nowSec - this._lastNvidiaSec >= gpuInterval) {
      this._lastNvidiaSec = nowSec;
      GpuMetric.readNvtopAsync(fileutil, result => {
        if (result) {
          this._sub.nvtop   = result;
        } else {
          // nvtop unavailable — fall back to nvidia-smi for NVIDIA GPUs
          const nv = this._cachedGpus.find(g => g.type === 'nvidia');
          if (nv && GpuMetric.isActive(fileutil, nv.cardPath)) {
            GpuMetric.readNvidiaAsync(fileutil, r => { this._sub.nvidia = r; });
          }
        }
      });
    }
  }

  collect() {
    const now     = Date.now() / 1000;
    const elapsed = this._prevTimestamp
      ? (now - this._prevTimestamp)
      : (this._applet._refreshInterval || DEFAULT_INTERVAL_SEC);
    this._prevTimestamp = now;

    this._data.uptime = UptimeMetric.read(fileutil);
    if (this._data.uptime) this._history.loadAvg.push(this._data.uptime.load.avg1);

    const enabledBats = parseList(this._applet._batteryList).filter(b => b.enabled);
    if (enabledBats.length > 1) {
      const results = enabledBats.map(b => BatteryMetric.read(fileutil, b.device));
      const valid   = results.filter(Boolean);
      if (valid.length > 0) {
        const combined = Object.assign({}, valid[0]);
        combined.energyWh     = valid.reduce((s, d) => s + d.energyWh, 0);
        combined.energyFullWh = valid.reduce((s, d) => s + d.energyFullWh, 0);
        combined.capacityPct  = Math.round(valid.reduce((s, d) => s + d.capacityPct, 0) / valid.length);
        this._data.battery = combined;
      }
    } else {
      this._data.battery = BatteryMetric.read(fileutil, enabledBats[0] ? enabledBats[0].device : 'auto');
    }
    if (this._data.battery) {
      this._history.batteryPct.push(this._data.battery.capacityPct);
      this._history.batteryW.push(this._data.battery.powerW);
      this._history.batteryDraw.push(  this._data.battery.isCharging ? 0 : this._data.battery.powerW);
      this._history.batteryCharge.push(this._data.battery.isCharging ? this._data.battery.powerW : 0);
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec - this._lastBatLogSec >= 15) {
        BatteryLog.appendEntry(fileutil, this._batLogPath, nowSec, this._data.battery.capacityPct, this._data.battery.powerW, this._data.battery.isCharging);
        this._lastBatLogSec = nowSec;
      }
    }

    const hwmonPaths = this._cachedHwmonPaths;
    const cpuResult  = CpuMetric.read(fileutil, this._prevCpuStat, hwmonPaths[0] || null);
    if (cpuResult) {
      if (hwmonPaths.length > 1) {
        const allTemps = hwmonPaths.map(p => CpuMetric.readHwmonTemps(fileutil, p));
        cpuResult.packageC = Math.max(...allTemps.map(t => t.packageC));
        // Pick chip with most core temps (handles stale non-CPU entries in list)
        const best = allTemps.reduce((a, b) => b.coresC.length > a.coresC.length ? b : a);
        if (best.coresC.length > 0) cpuResult.coresC = best.coresC;
      }
      const procNow = Math.floor(Date.now() / 1000);
      if (procNow - this._lastProcSec > 60) {
        // Large gap = wake from suspend; reset baselines so stale data isn't used
        this._prevProcStats   = null;
        this._prevProcCpuStat = null;
      }
      if (procNow - this._lastProcSec >= 5) {
        const procResult = ProcessMetric.read(fileutil, this._prevProcStats, this._prevProcCpuStat, cpuResult.stat, cpuResult.numCores);
        this._prevProcStats   = procResult.currStats;
        this._prevProcCpuStat = cpuResult.stat;
        this._data.processes  = procResult.topProcs;
        this._lastProcSec     = procNow;
      }
      this._prevCpuStat = cpuResult.stat;
      this._numCores    = cpuResult.numCores;
      this._history.cpuPct.push(cpuResult.cpuPct);
      this._history.cpuPackageC.push(cpuResult.packageC);
      cpuResult.pkgWatt = this._readRaplWatts(Math.floor(Date.now() / 1000));
      this._data.cpu = cpuResult;
    }

    const nowSecM = Math.floor(Date.now() / 1000);
    if (nowSecM - this._lastMemReadSec >= 15) {
      this._data.memory = MemoryMetric.read(fileutil);
      this._lastMemReadSec = nowSecM;
      if (this._data.memory) this._history.memPct.push(this._data.memory.usedPct);
    }

    this._data.disk = DiskMetric.read(fileutil, this._sub.df);
    if (this._data.disk) {
      if (this._prevDiskstats) {
        this._data.diskRates = this._data.disk.diskstats.map(curr => {
          const prev = this._prevDiskstats.find(p => p.name === curr.name);
          return prev
            ? DiskMetric.computeDiskRate(prev, curr, elapsed)
            : { name: curr.name, readBytesPerSec: 0, writeBytesPerSec: 0 };
        });
        const enabledDisks = parseList(this._applet._diskList).filter(d => d.enabled).map(d => d.device);
        const totalBps = this._data.diskRates
          .filter(r => {
            const parent = DiskMetric.parentDevice(r.name);
            if (parent !== r.name) return false;
            return enabledDisks.length === 0 || enabledDisks.includes(parent);
          })
          .reduce((s, r) => s + r.readBytesPerSec + r.writeBytesPerSec, 0);
        this._history.diskIo.push(totalBps);
      } else {
        this._data.diskRates = [];
      }
      this._prevDiskstats = this._data.disk.diskstats;
    }

    const netIfaces = NetworkMetric.read(fileutil);
    if (this._prevNetIfaces) {
      this._data.netRates = netIfaces.map(curr => {
        const prev = this._prevNetIfaces.find(p => p.name === curr.name);
        return prev
          ? NetworkMetric.computeNetRate(prev, curr, elapsed)
          : { name: curr.name, rxBytesPerSec: 0, txBytesPerSec: 0 };
      });
      const enabledIfaces = parseList(this._applet._netList).filter(n => n.enabled).map(n => n.iface);
      const netForHistory = enabledIfaces.length > 0
        ? this._data.netRates.filter(r => enabledIfaces.includes(r.name))
        : this._data.netRates;
      const totalRx = netForHistory.reduce((s, r) => s + r.rxBytesPerSec, 0);
      const totalTx = netForHistory.reduce((s, r) => s + r.txBytesPerSec, 0);
      this._history.netRx.push(totalRx);
      this._history.netTx.push(totalTx);
    }
    this._prevNetIfaces = netIfaces;

    const nowSecF = Math.floor(Date.now() / 1000);
    if (nowSecF - this._lastFanReadSec >= 15) {
      this._data.fan = FanMetric.read(fileutil, this._cachedFanPaths);
      this._lastFanReadSec = nowSecF;
    }

    if (this._cachedGpus.length > 0) {
      let results;
      if (this._sub.nvtop) {
        // nvtop covers all GPU types — enrich with isActive() from sysfs
        const typeIdx = {};
        results = this._sub.nvtop.map(entry => {
          const t   = entry.type;
          const idx = typeIdx[t] || 0;
          typeIdx[t] = idx + 1;
          const gpu = this._cachedGpus.filter(g => g.type === t)[idx];
          return { ...entry, active: gpu ? GpuMetric.isActive(fileutil, gpu.cardPath) : true };
        });
        // Supplement with cached GPUs absent from nvtop (e.g., NVIDIA suspended in PRIME/on-demand mode)
        const nvtopCount = {};
        for (const r of this._sub.nvtop) nvtopCount[r.type] = (nvtopCount[r.type] || 0) + 1;
        const seenCount = {};
        for (const gpu of this._cachedGpus) {
          const t   = gpu.type;
          const seq = (seenCount[t] = (seenCount[t] || 0) + 1);
          if (seq <= (nvtopCount[t] || 0)) continue; // already represented in nvtop output
          if (t === 'nvidia') {
            const sync = GpuMetric.readNvidiaSync(fileutil, gpu);
            results.push(sync.active && this._sub.nvidia ? { ...sync, ...this._sub.nvidia } : sync);
          } else if (t === 'amd') {
            results.push(GpuMetric.readAmd(fileutil, gpu));
          } else if (t === 'intel') {
            results.push(GpuMetric.readIntel(fileutil, gpu));
          }
        }
      } else {
        // Fallback: sync sysfs reads (no Intel busyPct; NVIDIA merges nvidia-smi result)
        results = this._cachedGpus.map(gpu => {
          if (gpu.type === 'amd')    return GpuMetric.readAmd(fileutil, gpu);
          if (gpu.type === 'intel')  return GpuMetric.readIntel(fileutil, gpu);
          if (gpu.type === 'nvidia') {
            const sync = GpuMetric.readNvidiaSync(fileutil, gpu);
            return sync.active && this._sub.nvidia
              ? { ...sync, ...this._sub.nvidia } : sync;
          }
          return null;
        }).filter(Boolean);
      }
      this._data.gpu = results;
      const discrete = results.find(g => g.type !== 'intel' && g.busyPct != null);
      if (discrete) {
        this._history.gpuPct.push(discrete.busyPct);
      } else {
        const intel = results.find(g => g.type === 'intel');
        if (intel) {
          if (intel.busyPct != null) this._history.gpuPct.push(intel.busyPct);
          else if (intel.maxMhz > 0) this._history.gpuPct.push(Math.round(intel.clockMhz / intel.maxMhz * 100));
        }
      }
    }

    // Compute ≈ AC usage from available sources
    if (this._data.battery && this._data.battery.isCharging) {
      const pkgWatt = (this._data.cpu && this._data.cpu.pkgWatt) || null;
      const gpuWatt = (this._data.gpu || []).reduce((s, g) => s + (g.powerW || 0), 0) || null;
      const dram    = 3;
      const display = this._hasDisplay ? 5 : 0;
      if (pkgWatt !== null) {
        this._data.battery.usageW      = pkgWatt + (gpuWatt || 0) + dram + display;
        this._data.battery.usageDetail = { pkgWatt, gpuWatt, dram, display };
      } else {
        this._data.battery.usageW      = null;
        this._data.battery.usageDetail = null;
      }
      this._data.battery.raplAvail = this._raplAvail;
    }

    if (this._onUpdate) this._onUpdate(this._data, this._history);

    this._fetchAsync();
  }

  getNumCores() { return this._numCores || 1; }

  getBatSparklines() {
    const now = Math.floor(Date.now() / 1000);
    // Adapt window to actual log span when history is shorter than target
    const windowSec = (entries, targetSec) => {
      if (entries.length < 2) return targetSec;
      const span = now - entries[0].t;
      return span >= targetSec ? targetSec : Math.max(span, 60);
    };

    if (this._batLogCacheSec !== this._lastBatLogSec) {
      this._batLogCache    = BatteryLog.readWindow(fileutil, this._batLogPath, 21600);
      this._batLogCacheSec = this._lastBatLogSec;
    }
    const e6h = this._batLogCache;
    const w6h = windowSec(e6h, 21600);

    const last = e6h.length ? e6h[e6h.length - 1] : null;
    const currentChargeW = last && last.w > 0 ? last.w  : 0;
    const currentDrawW   = last && last.w < 0 ? -last.w : 0;

    const drawVals   = BatteryLog.timeSparklineWVals(e6h, 10800, HISTORY_SIZE, 'draw');
    const chargeVals = BatteryLog.timeSparklineWVals(e6h, 10800, HISTORY_SIZE, 'charge');

    const drawSamples = drawVals.filter(v => v != null);
    const avgDrawW = drawSamples.length >= 3
      ? drawSamples.reduce((s, v) => s + v, 0) / drawSamples.length : null;

    return {
      currentDrawW,
      currentChargeW,
      avgDrawW,
      pctVals:    BatteryLog.timeSparklineVals(e6h, w6h, HISTORY_SIZE),
      drawVals,
      chargeVals,
    };
  }

  getData()    { return this._data; }
  getHistory() { return this._history; }
};
