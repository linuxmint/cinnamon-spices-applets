function discoverBatteries(fileutil) {
  const found = [];
  for (const prefix of ['BAT', 'CMB']) {
    for (let i = 0; i <= 5; i++) {
      const name = `${prefix}${i}`;
      if (fileutil.readFile(`/sys/class/power_supply/${name}/capacity`) !== null)
        found.push(name);
    }
  }
  return found;
}

function discoverHwmon(fileutil) {
  const chips = [];
  for (let i = 0; i < 20; i++) {
    const base     = `/sys/class/hwmon/hwmon${i}`;
    const chipName = (fileutil.readFile(`${base}/name`) || '').trim();
    if (!chipName) continue;
    if (fileutil.readFile(`${base}/temp1_input`) !== null) {
      const firstLabel = (fileutil.readFile(`${base}/temp1_label`) || chipName).trim();
      chips.push({ hwmon: i, name: chipName, label: firstLabel });
    }
  }
  return chips;
}

function discoverDiskDevices(fileutil) {
  const content = fileutil.readFile('/proc/diskstats');
  if (!content) return [];
  const devices = [];
  content.split('\n').filter(l => l.trim()).forEach(line => {
    const name = line.trim().split(/\s+/)[2];
    if (!name) return;
    if (/^(loop|ram|sr|fd|dm-|md)/.test(name)) return; // skip virtual/optical/software-raid
    // Keep only parent devices, not partitions
    const isPartition = /^nvme\d+n\d+p\d+$/.test(name)  ||
                        /^mmcblk\d+p\d+$/.test(name)     ||
                        (/^[a-z]+\d+$/.test(name) && !/^nvme/.test(name) && !/^mmcblk/.test(name));
    if (!isPartition && !devices.includes(name)) devices.push(name);
  });
  return devices;
}

function discoverNetInterfaces(fileutil) {
  const content = fileutil.readFile('/proc/net/dev');
  if (!content) return [];
  return content.split('\n')
    .filter(l => l.includes(':'))
    .map(l => l.split(':')[0].trim())
    .filter(name => name && !/^(Inter|face)/.test(name));
}

// Merge discovered items into existing list, preserving user settings.
// key = the field that uniquely identifies an item (e.g. 'device', 'hwmon', 'iface')
function mergeLists(discovered, existing, key) {
  const result = discovered.map(d => {
    const ex = existing.find(e => String(e[key]) === String(d[key]));
    return ex ? Object.assign({}, d, ex) : d;
  });
  // Keep entries no longer discovered (device may be temporarily absent)
  existing.forEach(e => {
    if (!result.find(r => String(r[key]) === String(e[key]))) result.push(e);
  });
  return result;
}

// Merge hwmon chip list by chip NAME (not hwmon number — numbers change across reboots).
// Preserves enabled state from existing list; discards stale entries.
function mergeHwmonLists(discovered, existing) {
  return discovered.map(d => {
    const ex = existing.find(e => e.name === d.name);
    return ex ? Object.assign({}, d, { enabled: ex.enabled }) : d;
  });
}

if (typeof module !== 'undefined') {
  module.exports = { discoverBatteries, discoverHwmon, discoverDiskDevices, discoverNetInterfaces, mergeLists, mergeHwmonLists };
}
