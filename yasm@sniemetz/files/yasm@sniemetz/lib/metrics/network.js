function parseNetDev(content) {
  return content.split('\n')
    .filter(l => l.includes(':') && !l.trim().startsWith('Inter') && !l.trim().startsWith('face'))
    .map(line => {
      const [namePart, statsPart] = line.split(':');
      const name = namePart.trim();
      const nums = statsPart.trim().split(/\s+/).map(Number);
      return { name, rxBytes: nums[0], txBytes: nums[8] };
    })
    .filter(Boolean);
}

function computeNetRate(prev, curr, elapsedSec) {
  return {
    name:          curr.name,
    rxBytesPerSec: Math.max(0, curr.rxBytes - prev.rxBytes) / elapsedSec,
    txBytesPerSec: Math.max(0, curr.txBytes - prev.txBytes) / elapsedSec,
  };
}

function humanRate(bps) {
  if (bps >= 1024 * 1024 * 1024) return `${(bps/1024/1024/1024).toFixed(1)}G`;
  if (bps >= 1024 * 1024)        return `${(bps/1024/1024).toFixed(1)}M`;
  return `${(bps/1024).toFixed(1)}k`;
}

function formatPanel(rates) {
  if (!rates || rates.length === 0) return 'no net';
  const totalTx = rates.reduce((s, r) => s + r.txBytesPerSec, 0);
  const totalRx = rates.reduce((s, r) => s + r.rxBytesPerSec, 0);
  return `${humanRate(totalTx)} ↑ ${humanRate(totalRx)} ↓`;
}

// txRow: upload bottom-up; rxRow: download top-aligned
function formatTooltip(rates, txRow, rxRow) {
  const lines = [];
  if (txRow) lines.push(`  ↑ ${txRow}`);
  if (rxRow) lines.push(`  ↓ ${rxRow}`);
  if (txRow || rxRow) lines.push('');
  rates.forEach(r => {
    lines.push(`  ${r.name.padEnd(10)} ↑${humanRate(r.txBytesPerSec).padStart(8)}  ↓${humanRate(r.rxBytesPerSec).padStart(8)}`);
  });
  return lines.join('\n');
}

function read(fileutil) {
  const content = fileutil.readFile('/proc/net/dev');
  if (!content) return [];
  return parseNetDev(content);
}

if (typeof module !== 'undefined') {
  module.exports = { parseNetDev, computeNetRate, humanRate, formatPanel, formatTooltip, read };
}
