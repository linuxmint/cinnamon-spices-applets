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

const { _, padColumn } = typeof imports !== 'undefined' ? imports.lib.util : require('../util.js');

function formatPanel(fans) {
  if (!fans || fans.length === 0) return _("no fans");
  const maxRpm = Math.max(...fans.map(f => f.rpm));
  // Every fan reporting 0 rpm means the fan curve has spun them down —
  // '0rpm' reads as a broken sensor, 'off' reads as the actual state.
  if (maxRpm === 0) return _("off");
  return `${maxRpm}rpm`;
}

function formatTooltip(fans) {
  if (!fans || fans.length === 0) return _("No fans detected");
  const lines = [`<b>${_("Fans")}</b>`];
  const pairs = fans.map(f => [f.label, `${f.rpm} rpm`]);
  lines.push(...padColumn(pairs));
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
