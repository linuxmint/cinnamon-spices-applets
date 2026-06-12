function findGpus(fileutil) {
  const gpus = [];
  for (let i = 0; i < 8; i++) {
    const cardPath = `/sys/class/drm/card${i}`;
    const vendor = (fileutil.readFile(`${cardPath}/device/vendor`) || '').trim();
    if (!vendor) continue;
    const v = parseInt(vendor, 16);
    const type = v === 0x10de ? 'nvidia' : v === 0x1002 ? 'amd' : v === 0x8086 ? 'intel' : null;
    if (!type) continue;
    gpus.push({ id: i, cardPath, type });
  }
  // Discrete GPUs before Intel iGPU
  return gpus.sort((a, b) => (a.type === 'intel' ? 1 : 0) - (b.type === 'intel' ? 1 : 0));
}

function isOnAC(fileutil) {
  for (const name of ['AC', 'AC0', 'ACAD', 'ADP0', 'ADP1']) {
    if ((fileutil.readFile(`/sys/class/power_supply/${name}/online`) || '').trim() === '1')
      return true;
  }
  return false;
}

function isActive(fileutil, cardPath) {
  const s = (fileutil.readFile(`${cardPath}/device/power/runtime_status`) || '').trim();
  return s === '' || s === 'active'; // empty = no runtime PM (desktop), always active
}

function _hwmonTemp(fileutil, driverName) {
  for (let i = 0; i < 20; i++) {
    const base = `/sys/class/hwmon/hwmon${i}`;
    if ((fileutil.readFile(`${base}/name`) || '').trim() !== driverName) continue;
    const raw = parseInt(fileutil.readFile(`${base}/temp1_input`) || '0');
    if (raw > 0) return raw / 1000;
  }
  return null;
}

function readAmd(fileutil, gpu) {
  const active = isActive(fileutil, gpu.cardPath);
  const tempC  = _hwmonTemp(fileutil, 'amdgpu');
  if (!active) return { ...gpu, active: false, tempC };
  const dev = `${gpu.cardPath}/device`;
  const busyPct   = parseInt(fileutil.readFile(`${dev}/gpu_busy_percent`)    || '0');
  const vramUsed  = parseInt(fileutil.readFile(`${dev}/mem_info_vram_used`)  || '0');
  const vramTotal = parseInt(fileutil.readFile(`${dev}/mem_info_vram_total`) || '1');
  return { ...gpu, active: true, tempC, busyPct,
    vramUsedMB:  Math.round(vramUsed  / 1024 / 1024),
    vramTotalMB: Math.round(vramTotal / 1024 / 1024) };
}

function readNvidiaSync(fileutil, gpu) {
  return { ...gpu, active: isActive(fileutil, gpu.cardPath), tempC: _hwmonTemp(fileutil, 'nvidia') };
}

// Fallback async for systems without nvtop: util%, VRAM, temp via nvidia-smi. cb(data|null)
function readNvidiaAsync(fileutil, cb) {
  fileutil.spawnAsync(
    ['nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu',
     '--format=csv,noheader,nounits'],
    out => {
      if (!out) { cb(null); return; }
      const p = out.trim().split(',').map(s => parseInt(s.trim()));
      cb(p.length >= 4 && !p.some(isNaN)
        ? { busyPct: p[0], vramUsedMB: p[1], vramTotalMB: p[2], tempC: p[3] } : null);
    }
  );
}

function readIntel(fileutil, gpu) {
  const clockMhz = parseInt(fileutil.readFile(`${gpu.cardPath}/gt_cur_freq_mhz`) || '0');
  const maxMhz   = parseInt(fileutil.readFile(`${gpu.cardPath}/gt_max_freq_mhz`) || '0');
  return { ...gpu, active: true, clockMhz, maxMhz };
}

// Primary async: all GPUs in one call via nvtop -s (JSON snapshot).
// Returns [{type, deviceName, busyPct, tempC, clockMhz, powerW, vramUsedMB, vramTotalMB}]
// or null if nvtop unavailable. cb(array|null)
function _nvtopInt(s) {
  if (s == null) return null;
  const v = parseInt(s);
  return isNaN(v) ? null : v;
}

function _nvtopType(name) {
  const n = (name || '').toLowerCase();
  if (/quadro|geforce|rtx\b|gtx\b|titan|nvs|grid|nvidia/.test(n)) return 'nvidia';
  if (/radeon|\bamd\b|rx\s|vega|navi|polaris|fiji/.test(n)) return 'amd';
  if (/intel|uhd\s|iris|arc\s|coffeelake|whiskeylake|cometlake|tigerlake|alderlake|raptorlake|meteorlake/.test(n)) return 'intel';
  return null;
}

function readNvtopAsync(fileutil, cb) {
  fileutil.spawnAsync(['nvtop', '-s'], out => {
    if (!out) { cb(null); return; }
    try {
      const entries = JSON.parse(out);
      if (!Array.isArray(entries)) { cb(null); return; }
      const gpus = entries.map(e => {
        const type = _nvtopType(e.device_name);
        if (!type) return null;
        const g = {
          type,
          deviceName: e.device_name,
          busyPct:    _nvtopInt(e.gpu_util),
          tempC:      _nvtopInt(e.temp),
          clockMhz:   _nvtopInt(e.gpu_clock),
          powerW:     _nvtopInt(e.power_draw),
        };
        // Intel mem_used is GTT (system RAM), not dedicated VRAM — skip
        if (type !== 'intel') {
          const u = _nvtopInt(e.mem_used), t = _nvtopInt(e.mem_total);
          g.vramUsedMB  = u != null ? Math.round(u / 1048576) : null;
          g.vramTotalMB = t != null ? Math.round(t / 1048576) : null;
        }
        return g;
      }).filter(Boolean);
      cb(gpus.length > 0 ? gpus : null);
    } catch(e) { cb(null); }
  });
}

function formatPanel(g) {
  if (!g) return '—';
  if (!g.active) return 'susp.';
  const parts = [];
  if (g.busyPct    != null) parts.push(`${g.busyPct}%`);
  if (g.tempC      != null) parts.push(`${Math.round(g.tempC)}°C`);
  if (g.vramUsedMB != null) parts.push(`${g.vramUsedMB}M`);
  if (g.clockMhz)            parts.push(`${g.clockMhz}MHz`);
  return parts.join(' | ') || g.type.toUpperCase();
}

function formatTooltip(gpus) {
  const lines = ['<b>GPU</b>'];
  (gpus || []).forEach((g, idx) => {
    if (idx > 0) lines.push('');
    if (g.deviceName) lines.push(`Name:     ${g.deviceName}`);
    else              lines.push(`Type:     ${g.type.toUpperCase()}`);
    lines.push(`Status:   ${g.active ? 'active' : 'suspended'}`);
    if (g.tempC      != null) lines.push(`Temp:     ${g.tempC.toFixed ? g.tempC.toFixed(1) : g.tempC}°C`);
    if (g.busyPct    != null) lines.push(`Busy:     ${g.busyPct}%`);
    if (g.powerW     != null) lines.push(`Power:    ${g.powerW}W`);
    if (g.vramUsedMB != null) lines.push(`VRAM:     ${g.vramUsedMB} / ${g.vramTotalMB} MB`);
    if (g.clockMhz)            lines.push(`Clock:    ${g.clockMhz}${g.maxMhz ? ' / ' + g.maxMhz : ''} MHz`);
  });
  return lines.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { findGpus, isActive, readAmd, readNvidiaSync, readNvidiaAsync,
                     readIntel, readNvtopAsync, formatPanel, formatTooltip };
}
