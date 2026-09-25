// SPDX-License-Identifier: GPL-3.0-or-later

function clampPercentage(value) {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, value));
}

function parseCpuStat(text, previousSample) {
    const line = String(text).split("\n").find(entry => entry.startsWith("cpu "));
    if (!line) return null;

    const fields = line.trim().split(/\s+/).slice(1).map(Number);
    if (fields.length < 4 || fields.some(value => !Number.isFinite(value))) return null;

    const idle = fields[3] + (fields[4] || 0);
    const total = fields.reduce((sum, value) => sum + value, 0);
    const sample = { idle, total };

    if (!previousSample || total <= previousSample.total) {
        return { percentage: null, sample };
    }

    const totalDelta = total - previousSample.total;
    const idleDelta = idle - previousSample.idle;
    const percentage = clampPercentage(100 * (totalDelta - idleDelta) / totalDelta);
    return { percentage, sample };
}

function parseMemInfo(text) {
    const values = {};

    String(text).split("\n").forEach(line => {
        const match = line.match(/^([A-Za-z_()]+):\s+(\d+)/);
        if (match) values[match[1]] = Number(match[2]);
    });

    if (!values.MemTotal) return null;

    const available = values.MemAvailable !== undefined
        ? values.MemAvailable
        : (values.MemFree || 0) + (values.Buffers || 0) + (values.Cached || 0);
    const memoryPercentage = clampPercentage(100 * (values.MemTotal - available) / values.MemTotal);
    const swapTotal = values.SwapTotal || 0;
    const swapFree = values.SwapFree || 0;
    const swapPercentage = swapTotal > 0
        ? clampPercentage(100 * (swapTotal - swapFree) / swapTotal)
        : 0;

    return {
        memoryPercentage,
        swapPercentage,
        memoryUsedKiB: values.MemTotal - available,
        memoryTotalKiB: values.MemTotal,
        swapUsedKiB: swapTotal - swapFree,
        swapTotalKiB: swapTotal
    };
}

function parseRadeontop(text) {
    const source = String(text);
    const gpuMatch = source.match(/\bgpu\s+([\d.]+)%/i);
    const vramMatch = source.match(/\bvram\s+([\d.]+)%\s+([\d.]+)\s*([kmgt]?b|b)\b/i);

    if (!gpuMatch || !vramMatch) return null;

    const gpuPercentage = clampPercentage(Number(gpuMatch[1]));
    const vramPercentage = clampPercentage(Number(vramMatch[1]));
    if (gpuPercentage === null || vramPercentage === null) return null;

    return {
        gpuPercentage,
        vramPercentage,
        vramUsed: Number(vramMatch[2]),
        vramUnit: vramMatch[3].toUpperCase()
    };
}

function formatPercent(value) {
    return value === null || value === undefined || !Number.isFinite(value)
        ? "--"
        : `${Math.round(value)}%`;
}

module.exports = {
    clampPercentage,
    parseCpuStat,
    parseMemInfo,
    parseRadeontop,
    formatPercent
};
