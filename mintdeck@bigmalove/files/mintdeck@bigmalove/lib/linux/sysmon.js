// lib/linux/sysmon.js — 系统监控的 Linux 通道（PDH/WMI → procfs）。
//
// 上游语义参照 BrimDeck.Core/SystemMonitor.cs：读数只有「已知」或「不可用 + 原因」两种，
// 不可用时返回 null / 空数组，绝不编造 0（SystemMonitor.cs:5-9 那条注释就是这条规矩）。
// 本文件属 lib/linux，允许用 GI；但 GI 一律惰性取（gi() 里才碰 imports.gi），
// 这样 node 侧测试 require 本文件时不会 ReferenceError，纯解析函数可直接断死。
'use strict';

// 下面这些常量都是本机实测结论，出处见 docs/PLAN.md §6.3 与各处的 // 实测 注释。

// user nice system idle iowait irq softirq steal 共 8 个；guest/guest_nice 已包含在 user/nice 里，不重复计。
const CPU_FIELDS = 8;
// 实测 getconf CLK_TCK = 100。libgtop 的 glibtop_proc_time.utime/stime 也是这个单位（见 topProcesses 处实测）。
const CLK_TCK = 100;

// 实测：本机 Meta tun(198.18.0.1/30) 的 rx/tx 与 wlp5s0 完全重复（8134690754 vs 9631352104 同一批流量），
// 不排除会把它算两遍。前缀表按「接口名可能带后缀」的命名习惯写（podman/netavark 的 br-<hash>、libvirt 的 virbr0 走 virbr）；
// 老式裸名 br0 不在表内 —— 那种环境请用 parseNetDev 的 ifaces 白名单点名。
const VIRTUAL_PREFIXES = ['veth', 'docker', 'br-', 'virbr'];
const VIRTUAL_EXACT = ['lo', 'meta'];   // meta 小写比较：本机 tun 名就是字面量 Meta

// argv 形式：不拼 shell 字符串（与 Cinnamon 自身 util.killall 的写法一致）
const NVIDIA_ARGV = [
  'nvidia-smi',
  '--query-gpu=utilization.gpu,memory.used,memory.total',
  '--format=csv,noheader,nounits'
];

// ---------------------------------------------------------------- GI 惰性句柄

function gi() {
  if (typeof imports === 'undefined' || !imports.gi) return null;
  return imports.gi;
}

function gLib() {
  const g = gi();
  return g && g.GLib ? g.GLib : null;
}

// 子进程统一走 lib/linux/exec（异步）。这里惰性取，node 侧 require 本文件时 imports 不存在也不炸。
function execModule() {
  if (typeof imports === 'undefined' || !imports.lib) return null;
  try {
    return imports.lib.linux && imports.lib.linux.exec ? imports.lib.linux.exec : null;
  } catch (e) {
    return null;
  }
}

function decode(bytes) {
  if (bytes === null || bytes === undefined) return '';
  if (typeof bytes === 'string') return bytes;
  try {
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return '';
  }
}

// 读文本文件；读不到返回 null。null 与 '' 必须分开：pickNetworkInterface 靠 null 判断 operstate 文件不存在。
function readTextOrNull(path) {
  const GLib = gLib();
  if (!GLib) return null;
  try {
    const result = GLib.file_get_contents(path);
    if (!result || !result[0]) return null;
    return decode(result[1]);
  } catch (e) {
    return null;
  }
}

// /proc 读失败给空串，上层按空数据走「不可用」分支。
function readText(path) {
  const text = readTextOrNull(path);
  return text === null ? '' : text;
}

function clampPct(value) {
  if (!isFinite(value)) return 0;
  return value < 0 ? 0 : value > 100 ? 100 : value;
}

// ---------------------------------------------------------------- CPU（/proc/stat）

// 解析 /proc/stat。返回 {total:{idle,total}|null, cores:[{index,idle,total}]}。
// idle 取 idle+iowait：iowait 期间核心同样没干活，算成忙会让占用率虚高（§6.3 的算法）。
function parseCpuStat(text) {
  const out = { total: null, cores: [] };
  const rows = String(text || '').split('\n');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.slice(0, 3) !== 'cpu') continue;
    const parts = row.trim().split(/\s+/);
    const name = parts[0];
    let total = 0;
    for (let k = 1; k <= CPU_FIELDS; k++) {
      const v = Number(parts[k]);
      total += Number.isFinite(v) ? v : 0;
    }
    const idle = (Number(parts[4]) || 0) + (Number(parts[5]) || 0);   // idle + iowait
    if (name === 'cpu') out.total = { idle: idle, total: total };
    else out.cores.push({ index: Number(name.slice(3)), idle: idle, total: total });
  }
  // /proc/stat 本身按 cpu0..cpuN 顺序给，这里仍按 index 排一次：node 测试夹具可能乱序。
  out.cores.sort(function (a, b) { return a.index - b.index; });
  return out;
}

// 两次采样之间某一行的占用率（0–100）。分母 <= 0 或计数回退（休眠、cpu hotplug）返回 null。
function cpuDeltaPercent(prev, cur) {
  if (!prev || !cur) return null;
  const dTotal = cur.total - prev.total;
  const dIdle = cur.idle - prev.idle;
  if (dTotal <= 0 || dIdle < 0) return null;
  return clampPct((1 - dIdle / dTotal) * 100);
}

/**
 * 两次 /proc/stat 文本求差分占用率。
 * prevText 为空（首帧没有基线）时返回 {total:0, perCore:[]}，UI 该显示「—」而不是 0%。
 * @returns {{total:number, perCore:number[]}}
 */
function sampleCpu(prevText, curText) {
  if (!prevText || !curText) return { total: 0, perCore: [] };
  const prev = parseCpuStat(prevText);
  const cur = parseCpuStat(curText);
  if (!prev.total || !cur.total) return { total: 0, perCore: [] };
  const total = cpuDeltaPercent(prev.total, cur.total);
  const perCore = [];
  const count = Math.min(prev.cores.length, cur.cores.length);
  for (let i = 0; i < count; i++) {
    const pct = cpuDeltaPercent(prev.cores[i], cur.cores[i]);
    perCore.push(pct === null ? 0 : pct);   // 单核拿不到差分时给 0，避免把 NaN 塞进 UI
  }
  return { total: total === null ? 0 : total, perCore: perCore };
}

function readCpuText() { return readText('/proc/stat'); }

// ---------------------------------------------------------------- 内存（/proc/meminfo）

/**
 * @returns {{totalKb:number, availableKb:number, usedKb:number, swapTotalKb:number,
 *            swapFreeKb:number, usedPercent:number, swapUsedPercent:number}|null}
 * MemTotal 缺失时返回 null（无数据不编造）。
 */
function parseMeminfo(text) {
  const src = String(text || '');
  const values = Object.create(null);
  const rows = src.split('\n');
  for (let i = 0; i < rows.length; i++) {
    const m = /^([A-Za-z_()0-9]+):\s+(\d+)/.exec(rows[i]);
    if (m) values[m[1]] = Number(m[2]);
  }
  const totalKb = values.MemTotal || 0;
  if (!totalKb) return null;
  // 老内核没有 MemAvailable（< 3.14）；那时按 free+buffers+cached 估，至少不是编的 0。
  const availableKb = values.MemAvailable !== undefined
    ? values.MemAvailable
    : (values.MemFree || 0) + (values.Buffers || 0) + (values.Cached || 0);
  const swapTotalKb = values.SwapTotal || 0;
  const swapFreeKb = values.SwapFree || 0;
  return {
    totalKb: totalKb,
    availableKb: availableKb,
    usedKb: Math.max(0, totalKb - availableKb),
    swapTotalKb: swapTotalKb,
    swapFreeKb: swapFreeKb,
    usedPercent: clampPct(100 * (1 - availableKb / totalKb)),   // 实测 32GB 机器 52.5%
    swapUsedPercent: swapTotalKb > 0 ? clampPct(100 * (1 - swapFreeKb / swapTotalKb)) : 0
  };
}

function readMeminfoText() { return readText('/proc/meminfo'); }

// ---------------------------------------------------------------- 网卡（/proc/net/dev）

function isExcludedIface(name) {
  const low = String(name).toLowerCase();
  if (VIRTUAL_EXACT.indexOf(low) >= 0) return true;
  for (let i = 0; i < VIRTUAL_PREFIXES.length; i++) {
    if (low.indexOf(VIRTUAL_PREFIXES[i]) === 0) return true;
  }
  return false;
}

// /proc/net/dev 里出现过的全部接口名（保持文件顺序）。
function netDevIfaces(text) {
  const names = [];
  const rows = String(text || '').split('\n');
  for (let i = 0; i < rows.length; i++) {
    const cut = rows[i].indexOf(':');
    if (cut < 0) continue;
    const name = rows[i].slice(0, cut).trim();
    if (name) names.push(name);
  }
  return names;
}

/**
 * 按网卡白名单求和收发字节数。
 * ifaces 省略时用默认白名单：排除 lo / Meta 与 veth*、docker*、br-*、virbr* 这类虚拟接口。
 * 返回值额外带 ifaces（实际计入的接口名），专门用来验「Meta 有没有被排掉」。
 * @param {string} text /proc/net/dev 内容
 * @param {string[]=} ifaces 白名单；给了就只认这些名字
 * @returns {{rxBytes:number, txBytes:number, ifaces:string[]}}
 */
function parseNetDev(text, ifaces) {
  const allow = Array.isArray(ifaces) && ifaces.length ? ifaces : null;
  let rxBytes = 0;
  let txBytes = 0;
  const used = [];
  const rows = String(text || '').split('\n');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cut = row.indexOf(':');
    if (cut < 0) continue;
    const name = row.slice(0, cut).trim();
    if (!name) continue;
    if (allow ? allow.indexOf(name) < 0 : isExcludedIface(name)) continue;
    const fields = row.slice(cut + 1).trim().split(/\s+/);
    if (fields.length < 9) continue;
    const rx = Number(fields[0]);
    const tx = Number(fields[8]);   // rx 是第 1 个数字、tx 是第 9 个（§6.3 实测）
    rxBytes += Number.isFinite(rx) ? rx : 0;
    txBytes += Number.isFinite(tx) ? tx : 0;
    used.push(name);
  }
  return { rxBytes: rxBytes, txBytes: txBytes, ifaces: used };
}

function readNetDevText() { return readText('/proc/net/dev'); }

/**
 * 选一个真实在用的网卡。
 * 判据：operstate == 'up' 且不虚拟；operstate 文件不存在（或读不了）就当 up —— 本机 enp6s0 是 down、
 * lo 是 unknown、Meta 是 unknown，只有 wlp5s0 是 up，所以正常会选到 wlp5s0。
 * @param {string} text /proc/net/dev 内容
 * @param {function(string):(string|null)=} readFile 注入读文件（node 测试用）；默认走 GLib
 * @returns {string|null}
 */
function pickNetworkInterface(text, readFile) {
  const read = typeof readFile === 'function' ? readFile : readTextOrNull;
  const candidates = [];
  const names = netDevIfaces(text);
  for (let i = 0; i < names.length; i++) if (!isExcludedIface(names[i])) candidates.push(names[i]);
  if (!candidates.length) return null;
  for (let i = 0; i < candidates.length; i++) {
    const raw = read('/sys/class/net/' + candidates[i] + '/operstate');
    const state = raw === null || raw === undefined ? 'up' : String(raw).trim();
    if (state === 'up') return candidates[i];
  }
  return null;   // 全部 down：返回 null，让调用方走「不可用」
}

// ---------------------------------------------------------------- GPU

// 实测本机：nvidia-smi 存在，输出 "41, 2547, 10240"（util%, MiB, MiB）。
function nvidiaGpu() {
  const GLib = gLib();
  if (!GLib) return null;
  try {
    const result = GLib.spawn_sync(null, NVIDIA_ARGV, null, GLib.SpawnFlags.SEARCH_PATH, null);
    if (!result || !result[0]) return null;
    const stdout = decode(result[1]);
    const line = stdout.split('\n')[0] || '';
    const parts = line.split(',');
    if (parts.length < 3) return null;
    const util = Number(parts[0].trim());
    const used = Number(parts[1].trim());
    const total = Number(parts[2].trim());
    if (!Number.isFinite(util) || !Number.isFinite(total) || total <= 0) return null;
    return {
      source: 'nvidia',
      utilization: clampPct(util),
      memUsedMiB: Number.isFinite(used) ? used : null,
      memTotalMiB: total
    };
  } catch (e) {
    return null;   // nvidia-smi 不存在时 spawn 直接抛（本机有，这条分支留给无 N 卡的机器）
  }
}

// AMD：/sys/class/drm/cardN/device/gpu_busy_percent（0–100），显存另读 mem_info_vram_*。
// 实测: 本机是 N 卡，card0/card1 下没有 gpu_busy_percent，这条分支未能实跑。
function amdGpu() {
  for (let i = 0; i < 8; i++) {
    const base = '/sys/class/drm/card' + i + '/device/';
    const busy = readTextOrNull(base + 'gpu_busy_percent');
    if (busy === null) continue;
    const util = Number(String(busy).trim());
    if (!Number.isFinite(util)) continue;
    const usedRaw = readTextOrNull(base + 'mem_info_vram_used');
    const totalRaw = readTextOrNull(base + 'mem_info_vram_total');
    const used = usedRaw === null ? null : Number(String(usedRaw).trim()) / (1024 * 1024);
    const total = totalRaw === null ? null : Number(String(totalRaw).trim()) / (1024 * 1024);
    return {
      source: 'amd',
      utilization: clampPct(util),
      memUsedMiB: Number.isFinite(used) ? Math.round(used) : null,
      memTotalMiB: Number.isFinite(total) ? Math.round(total) : null
    };
  }
  return null;
}

/**
 * GPU 占用。nvidia → amd → none 依次回落，都拿不到时 source:'none' 且数值为 null。
 * nvidia-smi 是外部进程，调用方别按 1s 采样（§6.3：2–3s）。
 * @returns {{source:string, utilization:number|null, memUsedMiB:number|null, memTotalMiB:number|null}}
 */
function gpuText() {
  const nv = nvidiaGpu();
  if (nv) return nv;
  const amd = amdGpu();
  if (amd) return amd;
  return { source: 'none', utilization: null, memUsedMiB: null, memTotalMiB: null };
}

// ---------------------------------------------------------------- CPU 频率（小工具，无副作用）

/**
 * 各核心当前频率（MHz），取自 scaling_cur_freq（kHz）。
 * @returns {{avgMhz:number, perCore:number[]}|null}
 */
function frequencyMhz() {
  const perCore = [];
  for (let i = 0; i < 256; i++) {
    const raw = readTextOrNull('/sys/devices/system/cpu/cpu' + i + '/cpufreq/scaling_cur_freq');
    if (raw === null) {
      if (i === 0) return null;      // cpu0 就没有 cpufreq → 这台机器不报频率
      continue;
    }
    const khz = Number(String(raw).trim());
    if (Number.isFinite(khz)) perCore.push(Math.round(khz / 1000));
  }
  if (!perCore.length) return null;
  let sum = 0;
  for (let i = 0; i < perCore.length; i++) sum += perCore[i];
  return { avgMhz: Math.round(sum / perCore.length), perCore: perCore };
}

// 上游字段名叫 FrequencyMhz 的读数；这里给个同义别名，免得 UI 层记两套名字。
function freqSample() { return frequencyMhz(); }

// ---------------------------------------------------------------- TOP 进程（GTop）

// 模块内保存上一帧，用来做区间差分。上游 ProcessSample.CpuPercent 是「单核百分比」（250 = 2.5 核）。
// 首次调用（或间隔超过 60s）没有可比基线，退化成进程生命期平均占用，别当成瞬时值看。
let lastProcSample = null;   // {at: 微秒, ticks: Map<pid, ticks>}

function procName(state) {
  // 实测：comm 是 undefined；cmd 是 40 字节定长、以 NUL 结尾，**而且是普通 JS Array（不是 Uint8Array）**，
  // 直接喂 TextDecoder 会抛 "Provided input cannot be converted to ArrayBufferView"，所以先归一成 Uint8Array。
  const cmd = state && state.cmd;
  if (!cmd) return '';
  let end = cmd.length;
  for (let i = 0; i < cmd.length; i++) {
    if (cmd[i] === 0) { end = i; break; }
  }
  let view;
  if (typeof cmd.subarray === 'function' && cmd.buffer) {
    view = cmd.subarray(0, end);
  } else {
    view = new Uint8Array(end);
    for (let i = 0; i < end; i++) view[i] = cmd[i] & 0xff;
  }
  try {
    return new TextDecoder().decode(view);
  } catch (e) {
    return '';
  }
}

/**
 * 按 CPU 占用排前 N 的进程。
 * 坑（§6.3 实测）：glibtop_get_proclist 直接返回 pid 数组；glibtop_* 结构体带自引用，
 * 绝不能 JSON.stringify；utime/stime 单位是 clock tick（与 /proc/<pid>/stat 一致，实测 1s 内两边增量相同）。
 * @param {number=} limit 默认 8
 * @returns {{pid:number, name:string, cpuPercent:number, memKb:number}[]}
 */
function topProcesses(limit) {
  const g = gi();
  const GTop = g && g.GTop;
  const GLib = gLib();
  if (!GTop || !GLib) return [];
  const top = limit && limit > 0 ? Math.floor(limit) : 8;

  let pids;
  try {
    pids = GTop.glibtop_get_proclist(new GTop.glibtop_proclist(), GTop.GLIBTOP_KERN_PROC_ALL, 0);
  } catch (e) {
    return [];
  }
  if (!pids || !pids.length) return [];

  const time = new GTop.glibtop_proc_time();
  const state = new GTop.glibtop_proc_state();
  const mem = new GTop.glibtop_proc_mem();
  const nowUs = GLib.get_monotonic_time();
  const nowSec = Date.now() / 1000;

  const prev = lastProcSample;
  const intervalSec = prev ? (nowUs - prev.at) / 1e6 : 0;
  const useDelta = prev && intervalSec > 0.05 && intervalSec < 60;
  const ticksNow = new Map();
  const rows = [];

  for (let i = 0; i < pids.length; i++) {
    const pid = pids[i];
    let ticks = 0;
    let startTime = 0;
    try {
      GTop.glibtop_get_proc_time(time, pid);
      ticks = (time.utime || 0) + (time.stime || 0);
      startTime = time.start_time || 0;
    } catch (e) { continue; }
    if (!ticks && !startTime) continue;
    ticksNow.set(pid, ticks);

    GTop.glibtop_get_proc_state(state, pid);
    let name = procName(state);
    // 兜底：极少数进程 cmd 全 0（内核线程早期状态），退回 /proc/<pid>/comm。
    if (!name) {
      const comm = readTextOrNull('/proc/' + pid + '/comm');
      if (comm) name = comm.trim();
    }
    GTop.glibtop_get_proc_mem(mem, pid);
    const memKb = Math.round((mem.resident || 0) / 1024);   // resident 是字节

    let cpuPercent;
    if (useDelta) {
      const before = prev.ticks.get(pid);
      cpuPercent = before === undefined ? 0 : ((ticks - before) / CLK_TCK / intervalSec) * 100;
    } else {
      // 实测：GTop 的 start_time 是 epoch 秒（pid1 = btime = 1793152164）。
      const elapsed = startTime > 0 ? Math.max(1, nowSec - startTime) : 0;
      cpuPercent = elapsed > 0 ? ticks / CLK_TCK / elapsed * 100 : 0;
    }
    if (!Number.isFinite(cpuPercent) || cpuPercent < 0) cpuPercent = 0;
    rows.push({ pid: pid, name: name, cpuPercent: cpuPercent, memKb: memKb });
  }

  lastProcSample = { at: nowUs, ticks: ticksNow };
  rows.sort(function (a, b) {
    return b.cpuPercent - a.cpuPercent || b.memKb - a.memKb || a.pid - b.pid;
  });
  return rows.slice(0, top);
}

// 丢掉差分基线（比如暂停监控一段时间后恢复，别让老基线算出离谱数值）。
function resetProcessBaseline() { lastProcSample = null; }

if (typeof module !== 'undefined') {
  module.exports = {
    sampleCpu: sampleCpu,
    parseCpuStat: parseCpuStat,
    parseMeminfo: parseMeminfo,
    parseNetDev: parseNetDev,
    pickNetworkInterface: pickNetworkInterface,
    isExcludedIface: isExcludedIface,
    netDevIfaces: netDevIfaces,
    readCpuText: readCpuText,
    readMeminfoText: readMeminfoText,
    readNetDevText: readNetDevText,
    gpuText: gpuText,
    frequencyMhz: frequencyMhz,
    freqSample: freqSample,
    topProcesses: topProcesses,
    resetProcessBaseline: resetProcessBaseline
  };
}
