function parseFanInputs(fileutil, hwmonPath, hwmonName, skipZeroRpm) {
  const fans = [];
  for (let i = 1; i <= 16; i++) {
    const raw = fileutil.readFile(`${hwmonPath}/fan${i}_input`);
    if (raw === null) continue;
    const rpm   = parseInt(raw.trim()) || 0;
    const label = (fileutil.readFile(`${hwmonPath}/fan${i}_label`) || '').trim();
    // When auto-discovering, skip fans with no label and 0 rpm — likely unconnected
    if (skipZeroRpm && !label && rpm === 0) continue;
    // Add chip prefix to distinguish fan sources
    const chipPrefix = hwmonName ? getChipPrefix(hwmonName, i) : '';
    fans.push({ label: label || `${chipPrefix}Fan ${i}`, rpm });
  }
  return fans;
}

function getChipPrefix(chipName, fanIndex) {
  const name = chipName.toLowerCase();
  // amdgpu → GPU Fan
  if (name.includes('amdgpu')) return 'GPU ';
  // nct6798/nct6775/nct6796 → fan1 = CPU Fan, fan2+ = SYS Fan
  if (name.includes('nct6798') || name.includes('nct6775') || name.includes('nct6796')) {
    return fanIndex === 1 ? 'CPU ' : 'SYS ';
  }
  return '';
}

function formatPanel(fans) {
  if (!fans || fans.length === 0) return 'no fans';
  const maxRpm = Math.max(...fans.map(f => f.rpm));
  // Every fan reporting 0 rpm means the fan curve has spun them down —
  // '0rpm' reads as a broken sensor, 'off' reads as the actual state.
  if (maxRpm === 0) return 'off';
  return `${maxRpm}rpm`;
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

function read(fileutil, hwmonChips) {
  if (!hwmonChips || hwmonChips.length === 0) return null;
  // Don't skip 0-rpm fans during read — user explicitly configured these hwmon paths
  const fans = hwmonChips.flatMap(c => parseFanInputs(fileutil, c.path, c.name, false));
  return fans.length > 0 ? fans : null;
}

if (typeof module !== 'undefined') {
  module.exports = { parseFanInputs, findFanChips, formatPanel, formatTooltip, read };
}
