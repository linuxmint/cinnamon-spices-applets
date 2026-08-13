function parseUptime(content) {
  const totalSeconds = Math.floor(parseFloat(content.trim().split(' ')[0]));
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return { days, hours, minutes, totalSeconds };
}

function parseLoadavg(content) {
  const p = content.trim().split(' ');
  return { avg1: parseFloat(p[0]), avg5: parseFloat(p[1]), avg15: parseFloat(p[2]) };
}

function formatUptimeOnly(uptime) {
  const parts = [];
  if (uptime.days > 0) parts.push(`${uptime.days}d`);
  parts.push(`${uptime.hours}h`);
  parts.push(`${uptime.minutes}m`);
  return parts.join(' ');
}

function formatLoadOnly(load, loadLabel) {
  return loadLabel ? `${loadLabel}: ${load.avg1.toFixed(2)}` : load.avg1.toFixed(2);
}

function formatPanel(uptime, load, loadLabel) {
  return `${formatUptimeOnly(uptime)} | ${formatLoadOnly(load, loadLabel)}`;
}

function formatTooltip(uptime, load, numCores, history) {
  const parts = [];
  if (uptime.days > 0) parts.push(`${uptime.days}d`);
  parts.push(`${String(uptime.hours).padStart(2,'0')}h`);
  parts.push(`${String(uptime.minutes).padStart(2,'0')}m`);
  const lines = [
    `<b>Uptime</b>  ${parts.join(' ')}`,
    `Load:   ${load.avg1.toFixed(2)} / ${load.avg5.toFixed(2)} / ${load.avg15.toFixed(2)}`,
  ];
  if (history) {
    lines.push(`Load      ${history}`);
    lines.push(`          ${numCores} cores`);
    lines.push('');
  }
  lines.push('<i>Click to open top</i>');
  return lines.join('\n');
}

function read(fileutil) {
  const uptimeContent = fileutil.readFile('/proc/uptime');
  const loadContent   = fileutil.readFile('/proc/loadavg');
  const uptime = parseUptime(uptimeContent || '0.0 0.0');
  const load   = parseLoadavg(loadContent || '0.0 0.0 0.0 0/0 0');
  return { uptime, load };
}

if (typeof module !== 'undefined') {
  module.exports = { parseUptime, parseLoadavg, formatUptimeOnly, formatLoadOnly, formatPanel, formatTooltip, read };
}
