function parseDiskstats(content) {
  return content.split('\n')
    .filter(l => l.trim())
    .map(line => {
      const p = line.trim().split(/\s+/);
      return {
        name:           p[2],
        sectorsRead:    parseInt(p[5])  || 0,
        sectorsWritten: parseInt(p[9])  || 0,
      };
    });
}

function computeDiskRate(prev, curr, elapsedSec) {
  return {
    name:             curr.name,
    readBytesPerSec:  Math.max(0, curr.sectorsRead    - prev.sectorsRead)    * 512 / elapsedSec,
    writeBytesPerSec: Math.max(0, curr.sectorsWritten - prev.sectorsWritten) * 512 / elapsedSec,
  };
}

function humanBps(bps) {
  if (bps >= 1024 * 1024 * 1024) return `${(bps/1024/1024/1024).toFixed(1)}G/s`;
  if (bps >= 1024 * 1024)        return `${(bps/1024/1024).toFixed(1)}M/s`;
  return `${(bps/1024).toFixed(0)}k/s`;
}

function parseDf(dfOutput) {
  return dfOutput.trim().split('\n')
    .filter(l => l.trim() && l.startsWith('/dev/'))
    .map(line => {
      const p      = line.trim().split(/\s+/);
      const source = p[0];
      const name   = source.replace('/dev/', '');
      const totalG = parseInt(p[1]) || 0;
      const freeG  = parseInt(p[2]) || 0;
      const usedPct = parseInt((p[3] || '0%').replace('%','')) || 0;
      const mount  = p[4];
      return { source, name, totalG, freeG, usedPct, freePct: 100 - usedPct, mount };
    });
}

function parentDevice(name) {
  // nvme0n1p2 → nvme0n1;  nvme0n1 → nvme0n1 (parent, unchanged)
  if (name.startsWith('nvme')) {
    const m = name.match(/^(nvme\d+n\d+)/);
    return m ? m[1] : name;
  }
  // mmcblk0p1 → mmcblk0;  mmcblk0 → mmcblk0
  if (name.startsWith('mmcblk')) return name.replace(/p\d+$/, '');
  // sda1 → sda;  sda → sda
  return name.replace(/\d+$/, '');
}

function groupDisksByDevice(dfDisks) {
  const map = new Map();
  dfDisks.forEach(d => {
    const dev = parentDevice(d.name);
    if (!map.has(dev)) map.set(dev, { device: dev, partitions: [] });
    map.get(dev).partitions.push(d);
  });
  return Array.from(map.values());
}

function humanG(g) {
  return g >= 1024 ? `${(g/1024).toFixed(1)}T` : `${g}G`;
}

function formatPanel(dfDisks, diskRates) {
  if (!dfDisks || dfDisks.length === 0) return 'no disk';
  const totalFreeG = dfDisks.reduce((s, d) => s + d.freeG, 0);
  const devices    = groupDisksByDevice(dfDisks).map(g => g.device);
  const totalBps   = (diskRates || [])
    .filter(r => devices.includes(r.name))
    .reduce((s, r) => s + r.readBytesPerSec + r.writeBytesPerSec, 0);
  return `${humanG(totalFreeG)} avail | ${humanBps(totalBps)}`;
}

// Reading /sys/class/hwmon/hwmon*/temp1_input for an NVMe controller makes
// the kernel issue an NVMe admin command; a slow controller can stall that
// read for tens of seconds, which would freeze the whole panel if done on
// the main thread. So temps are read in a child process and cached here.
let _nvmeTemps = {};
let _nvmeTempsAt = 0;
let _nvmeTempsBusy = false;

function getNvmeTemps() {
  return _nvmeTemps;
}

// Kicks off an async refresh at most once per minIntervalMs (default 30s).
// Emits lines like "nvme0 42300" from the shell; maps to nvme0n1 keys.
function maybeRefreshNvmeTemps(fileutil, minIntervalMs) {
  const now = Date.now();
  if (_nvmeTempsBusy || now - _nvmeTempsAt < (minIntervalMs || 30000)) return;
  _nvmeTempsBusy = true;
  _nvmeTempsAt = now;
  fileutil.spawnAsync(
    ['sh', '-c',
     'for d in /sys/class/hwmon/hwmon*; do ' +
       '[ "$(cat "$d/name" 2>/dev/null)" = nvme ] || continue; ' +
       'n=$(readlink "$d" | grep -oE "nvme[0-9]+" | head -1); ' +
       't=$(cat "$d/temp1_input" 2>/dev/null); ' +
       '[ -n "$n" ] && [ -n "$t" ] && echo "$n $t"; ' +
     'done'],
    out => {
      _nvmeTempsBusy = false;
      const temps = {};
      (out || '').split('\n').forEach(line => {
        const p = line.trim().split(/\s+/);
        const raw = parseInt(p[1]);
        if (p.length === 2 && p[0].indexOf('nvme') === 0 && raw > 0)
          temps[p[0] + 'n1'] = raw / 1000;
      });
      _nvmeTemps = temps;
    });
}

// Name column width: device padEnd(16) aligns with "  └─ " (5) + name padEnd(11)
const COL_NAME = 16, COL_SIZE = 5, COL_PCT = 4;
function _diskRow(name, totalG, freePct, suffix) {
  const pct = (String(freePct)+'%').padStart(COL_PCT);
  return `${name.padEnd(COL_NAME)} ${humanG(totalG).padStart(COL_SIZE)}  ${pct}free  ${suffix}`;
}

// nvmeTemps: {blockDevice: tempC} map from getNvmeTemps(), or null
function formatTooltip(dfDisks, diskRates, history, nvmeTemps) {
  const lines = [];
  if (history) {
    const totalBps = (diskRates || []).filter(r => parentDevice(r.name) === r.name)
      .reduce((s, r) => s + r.readBytesPerSec + r.writeBytesPerSec, 0);
    lines.push(`${'I/O'.padEnd(10)}${history}  ${humanBps(totalBps)}`, '');
  }
  groupDisksByDevice(dfDisks).forEach(({ device, partitions }) => {
    const rate      = (diskRates || []).find(r => r.name === device);
    const devTotalG = partitions.reduce((s, p) => s + p.totalG, 0);
    const devFreeG  = partitions.reduce((s, p) => s + p.freeG,  0);
    const devFreeP  = devTotalG > 0 ? Math.round(devFreeG / devTotalG * 100) : 0;
    const ioBps     = rate ? rate.readBytesPerSec + rate.writeBytesPerSec : 0;
    const ioStr     = ioBps > 0 ? humanBps(ioBps) : '';
    const tempC     = nvmeTemps && nvmeTemps[device];
    const tempStr   = tempC != null ? `${tempC.toFixed(0)}°C` : '';
    const suffix    = [ioStr, tempStr].filter(Boolean).join('  ');
    lines.push(_diskRow(device, devTotalG, devFreeP, suffix));
    partitions.forEach(p => {
      const prefix = `  └─ ${p.name.padEnd(COL_NAME - 5)}`;
      lines.push(`${prefix} ${humanG(p.totalG).padStart(COL_SIZE)}  ${(String(p.freePct)+'%').padStart(COL_PCT)}free  ${p.mount}`);
    });
  });
  return lines.join('\n');
}

function read(fileutil, dfOut) {
  const diskstatsContent = fileutil.readFile('/proc/diskstats');
  const diskstats        = diskstatsContent ? parseDiskstats(diskstatsContent) : [];
  const dfDisks          = dfOut ? parseDf(dfOut) : [];
  return { dfDisks, diskstats };
}

if (typeof module !== 'undefined') {
  module.exports = { parseDiskstats, computeDiskRate, humanBps, parseDf, parentDevice, groupDisksByDevice, formatPanel, formatTooltip, getNvmeTemps, maybeRefreshNvmeTemps, read };
}
