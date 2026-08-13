function parseFanInputs(fileutil, hwmonPath) {
  const fans = [];
  for (let i = 1; i <= 16; i++) {
    const raw = fileutil.readFile(`${hwmonPath}/fan${i}_input`);
    if (raw === null) break;
    const rpm   = parseInt(raw.trim()) || 0;
    const label = (fileutil.readFile(`${hwmonPath}/fan${i}_label`) || `Fan ${i}`).trim();
    fans.push({ label, rpm });
  }
  return fans;
}

function formatPanel(fans) {
  if (!fans || fans.length === 0) return 'no fans';
  const maxRpm = Math.max(...fans.map(f => f.rpm));
  return `${maxRpm} rpm`;
}

function formatTooltip(fans) {
  if (!fans || fans.length === 0) return 'No fans detected';
  const lines = ['<b>Fans</b>'];
  fans.forEach(f => {
    lines.push(`${f.label.padEnd(14)}${f.rpm} rpm`);
  });
  return lines.join('\n');
}

function findFanChips(fileutil) {
  const chips = [];
  for (let i = 0; i < 20; i++) {
    const base = `/sys/class/hwmon/hwmon${i}`;
    const name = (fileutil.readFile(`${base}/name`) || '').trim();
    if (!name) continue;
    if (fileutil.readFile(`${base}/fan1_input`) !== null)
      chips.push({ hwmon: i, name, path: base });
  }
  return chips;
}

function read(fileutil, hwmonPaths) {
  if (!hwmonPaths || hwmonPaths.length === 0) return null;
  const fans = hwmonPaths.flatMap(p => parseFanInputs(fileutil, p));
  return fans.length > 0 ? fans : null;
}

if (typeof module !== 'undefined') {
  module.exports = { parseFanInputs, findFanChips, formatPanel, formatTooltip, read };
}
