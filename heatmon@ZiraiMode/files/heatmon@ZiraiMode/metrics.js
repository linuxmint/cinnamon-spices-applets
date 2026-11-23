// Pure parsing / formatting logic. No GI imports: testable under plain cjs.

function parseCpuStat(text) {
    if (!text)
        return null;
    const line = text.split('\n').find(l => l.startsWith('cpu '));
    if (!line)
        return null;
    const f = line.trim().split(/\s+/).slice(1, 9).map(Number);
    if (f.length < 8 || f.some(isNaN))
        return null;
    const total = f.reduce((a, b) => a + b, 0);
    const idle = f[3] + f[4];
    return { busy: total - idle, total };
}

function cpuLoadPercent(prev, cur) {
    if (!prev || !cur)
        return null;
    const dt = cur.total - prev.total;
    if (dt <= 0)
        return null;
    const p = 100 * (cur.busy - prev.busy) / dt;
    return Math.min(100, Math.max(0, p));
}

function parseMemInfo(text) {
    if (!text)
        return null;
    const want = { MemTotal: 'total', MemAvailable: 'available', SwapTotal: 'swapTotal', SwapFree: 'swapFree' };
    const out = { total: null, available: null, swapTotal: null, swapFree: null };
    for (const line of text.split('\n')) {
        const m = /^(\w+):\s+(\d+)/.exec(line);
        if (m && want[m[1]])
            out[want[m[1]]] = Number(m[2]) * 1024;
    }
    return out;
}

function parseNetDev(text) {
    const map = new Map();
    if (!text)
        return map;
    for (const line of text.split('\n')) {
        const idx = line.indexOf(':');
        if (idx < 0)
            continue;
        const iface = line.slice(0, idx).trim();
        const nums = line.slice(idx + 1).trim().split(/\s+/).map(Number);
        if (!iface || nums.length < 9 || isNaN(nums[0]) || isNaN(nums[8]))
            continue;
        map.set(iface, { rx: nums[0], tx: nums[8] });
    }
    return map;
}

function parseDefaultRoute(text) {
    if (!text)
        return null;
    let best = null, bestMetric = Infinity;
    for (const line of text.split('\n').slice(1)) {
        const f = line.trim().split(/\s+/);
        if (f.length < 8)
            continue;
        // Iface Destination Gateway Flags RefCnt Use Metric Mask ...
        if (f[1] !== '00000000' || f[7] !== '00000000')
            continue;
        const metric = Number(f[6]);
        if (metric < bestMetric) {
            bestMetric = metric;
            best = f[0];
        }
    }
    return best;
}

function parseNvidiaSmiLine(line) {
    if (!line)
        return null;
    const parts = line.split(', ');
    if (parts.length < 10)
        return null;
    const n = parts.slice(0, 9).map(s => {
        const v = parseFloat(s);
        return isNaN(v) ? null : v;
    });
    return {
        temp: n[0], load: n[1], memUsedMiB: n[2], memTotalMiB: n[3],
        powerW: n[4], powerLimitW: n[5], fanPct: n[6],
        clockGrMHz: n[7], clockMemMHz: n[8],
        name: parts.slice(9).join(', ').trim(),
    };
}

function isNum(v) {
    return typeof v === 'number' && !isNaN(v);
}

function level(value, warn, crit) {
    if (!isNum(value))
        return 0;
    if (value >= crit)
        return 2;
    if (value >= warn)
        return 1;
    return 0;
}

function fmtTemp(v) {
    return isNum(v) ? String(Math.round(v)).padStart(2) + '°' : '--°';
}

function fmtPercent(v) {
    return isNum(v) ? String(Math.round(v)).padStart(3) + '%' : ' --%';
}

function fmtGiBShort(bytes) {
    return isNum(bytes) ? (bytes / 2 ** 30).toFixed(1).padStart(4) + 'G' : '  --G';
}

function fmtRateShort(bps) {
    if (!isNum(bps))
        return ' -- ';
    let v = bps / 1000, unit = 'k';
    if (v >= 999.5) {
        v /= 1000;
        unit = 'M';
    }
    if (v >= 999.5) {
        v /= 1000;
        unit = 'G';
    }
    const s = v < 9.95 ? v.toFixed(1) : String(Math.round(v));
    return s.padStart(3) + unit;
}

function fmtPowerShort(w) {
    return isNum(w) ? String(Math.round(w)).padStart(3) + 'W' : ' --W';
}

function fmtRateLong(bps) {
    if (!isNum(bps))
        return ['—', ''];
    if (bps < 1000)
        return [String(Math.round(bps)), 'bit/s'];
    if (bps < 1e6)
        return [(bps / 1e3).toFixed(1), 'kbit/s'];
    if (bps < 1e9)
        return [(bps / 1e6).toFixed(1), 'Mbit/s'];
    return [(bps / 1e9).toFixed(1), 'Gbit/s'];
}

function fmtBytesLong(bytes) {
    if (!isNum(bytes))
        return ['—', ''];
    if (bytes < 2 ** 20)
        return [(bytes / 2 ** 10).toFixed(0), 'KiB'];
    if (bytes < 2 ** 30)
        return [(bytes / 2 ** 20).toFixed(1), 'MiB'];
    return [(bytes / 2 ** 30).toFixed(2), 'GiB'];
}

module.exports = {
    parseCpuStat, cpuLoadPercent, parseMemInfo, parseNetDev, parseDefaultRoute,
    parseNvidiaSmiLine, level, fmtTemp, fmtPercent, fmtGiBShort, fmtRateShort,
    fmtPowerShort, fmtRateLong, fmtBytesLong,
};
