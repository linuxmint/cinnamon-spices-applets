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

const { _, padColumn } = typeof imports !== 'undefined' ? imports.lib.util : require('../util.js');

function formatPanel(data) {
  return `${data.usedG.toFixed(1)}G | ${Math.round(data.usedPct)}%`;
}

function formatTooltip(data, history) {
  const lines = [`<b>${_("Memory")}</b>   ${data.totalG.toFixed(1)} G`];
  const inUse = _("in Use");
  if (history) { lines.push(`${inUse.padEnd(10)}${history}  ${Math.round(data.usedPct)}%`, ''); }
  const pairs = [
    [_("Used:"),   `${data.usedG.toFixed(1)} G`],
    [_("Free:"),   `${data.freeG.toFixed(1)} G`],
    [_("Avail.:"), `${data.availableG.toFixed(1)} G`],
  ];
  if (data.swapTotalG > 0)
    pairs.push([_("Swap:"), `${data.swapUsedG.toFixed(1)} / ${data.swapTotalG.toFixed(1)} G`]);
  lines.push(...padColumn(pairs));
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
