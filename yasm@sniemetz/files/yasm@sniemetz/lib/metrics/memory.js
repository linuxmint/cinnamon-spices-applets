function parseMeminfo(content) {
  const get = key => {
    const m = content.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
    return m ? parseInt(m[1]) : 0;
  };
  const totalKb     = get('MemTotal');
  const freeKb      = get('MemFree');
  const availableKb = get('MemAvailable');
  const buffersKb   = get('Buffers');
  const cachedKb    = get('Cached');
  const swapTotalKb = get('SwapTotal');
  const swapFreeKb  = get('SwapFree');
  const usedKb      = totalKb - availableKb;
  const usedPct     = totalKb > 0 ? (usedKb / totalKb) * 100 : 0;
  const swapUsedKb  = swapTotalKb - swapFreeKb;
  const kb2g = kb => kb / (1024 * 1024);
  return {
    totalKb, freeKb, availableKb, buffersKb, cachedKb,
    swapTotalKb, swapFreeKb, swapUsedKb, usedKb, usedPct,
    totalG:     kb2g(totalKb),
    usedG:      kb2g(usedKb),
    freeG:      kb2g(freeKb),
    availableG: kb2g(availableKb),
    swapTotalG: kb2g(swapTotalKb),
    swapUsedG:  kb2g(swapUsedKb),
  };
}

function formatPanel(data) {
  return `${data.totalG.toFixed(1)}G | ${Math.round(data.usedPct)}%`;
}

function formatTooltip(data, history) {
  const lines = [];
  if (history) { lines.push(`${'in Use'.padEnd(10)}${history}  ${Math.round(data.usedPct)}%`, ''); }
  lines.push(
    `${'Total:'.padEnd(10)}${data.totalG.toFixed(1)} G`,
    `${'Used:'.padEnd(10)}${data.usedG.toFixed(1)} G`,
    `${'Free:'.padEnd(10)}${data.freeG.toFixed(1)} G`,
    `${'Avail.:'.padEnd(10)}${data.availableG.toFixed(1)} G`,
  );
  if (data.swapTotalG > 0)
    lines.push(`${'Swap:'.padEnd(10)}${data.swapUsedG.toFixed(1)} / ${data.swapTotalG.toFixed(1)} G`);
  return lines.join('\n');
}

function read(fileutil) {
  const content = fileutil.readFile('/proc/meminfo');
  if (!content) return null;
  return parseMeminfo(content);
}

if (typeof module !== 'undefined') {
  module.exports = { parseMeminfo, formatPanel, formatTooltip, read };
}
