function formatTimeHours(h) {
  if (h === null || h === undefined) return '—';
  const hrs = Math.floor(h);
  const min = Math.round((h - hrs) * 60);
  return hrs > 0 ? `${hrs}h ${min}m` : `${min}m`;
}

function formatPanel(data) {
  const sign = data.isCharging ? '+' : '-';
  const tte  = data.timeHours !== null ? ` | ${formatTimeHours(data.timeHours)}` : '';
  return `${data.capacityPct}% | ${sign}${data.powerW.toFixed(1)}W${tte}`;
}

function formatTooltip(data, tempC) {
  const pad = (l, v) => `${l.padEnd(14)}${v}`;
  const lines = [];
  lines.push(
    pad('Charge:',    `${data.capacityPct}%`),
    pad('Energy:',    `${data.energyWh.toFixed(1)} / ${data.energyFullWh.toFixed(1)} Wh`),
    pad('Capacity:',  `${data.designCapacityPct.toFixed(1)}%`),
    pad(data.isCharging ? 'Charging:' : 'Draw:',
        `${data.isCharging ? '+' : '-'}${data.powerW.toFixed(2)} W`),
    pad('Voltage:',   `${data.voltageV.toFixed(2)} V`),
    pad('Current:',   `${data.currentA.toFixed(2)} A`),
    pad('Temp:',      tempC != null ? `${tempC.toFixed(1)}°C` : '—'),
    pad(data.isCharging ? 'Full in:' : 'Empty in:', formatTimeHours(data.timeHours)),
  );
  return lines.join('\n');
}

function findBatteryPath(fileutil, source) {
  if (source && source !== 'auto') {
    const path = `/sys/class/power_supply/${source}`;
    return fileutil.readFile(`${path}/capacity`) !== null ? path : null;
  }
  for (const name of ['BAT0', 'BAT1', 'BAT2', 'CMB0', 'CMB1']) {
    if (fileutil.readFile(`/sys/class/power_supply/${name}/capacity`) !== null)
      return `/sys/class/power_supply/${name}`;
  }
  return null;
}

function readBatteryTemp(fileutil) {
  for (let i = 0; i < 20; i++) {
    const base = `/sys/class/hwmon/hwmon${i}`;
    const name = (fileutil.readFile(`${base}/name`) || '').trim();
    if (name === 'BAT0' || name === 'acpi-BAT0') {
      const raw = parseInt(fileutil.readFile(`${base}/temp1_input`) || '0');
      return raw > 0 ? raw / 1000 : null;
    }
  }
  return null;
}

function readSys(fileutil, path) {
  const rd  = f => (fileutil.readFile(`${path}/${f}`) || '').trim();
  const num = (f, div) => { const v = parseInt(rd(f)); return isNaN(v) ? 0 : v / div; };

  const status     = rd('status');
  const isCharging = status === 'Charging';
  const capacityPct = parseInt(rd('capacity')) || 0;
  const voltageV    = num('voltage_now',        1e6);
  // Use nominal voltage for capacity math — instantaneous voltage swings
  // 10.8 V (empty) → 13.2 V (full) and would make energy-full read 107 Wh
  // instead of the correct ~92 Wh. voltage_min_design is the nominal.
  const voltageNom  = num('voltage_min_design', 1e6) || voltageV;

  let energyWh, energyFullWh, energyFullDesignWh, powerW, currentA;
  if (rd('energy_now') !== '') {
    energyWh           = num('energy_now',        1e6);
    energyFullWh       = num('energy_full',        1e6);
    energyFullDesignWh = num('energy_full_design', 1e6);
    powerW             = num('power_now',          1e6);
    currentA           = voltageV > 0 ? powerW / voltageV : 0;
  } else {
    currentA           = num('current_now',         1e6);
    energyWh           = num('charge_now',          1e6) * voltageNom;
    energyFullWh       = num('charge_full',         1e6) * voltageNom;
    energyFullDesignWh = num('charge_full_design',  1e6) * voltageNom;
    powerW             = currentA * voltageV;
  }

  const designCapacityPct = energyFullDesignWh > 0 ? energyFullWh / energyFullDesignWh * 100 : 0;
  let timeHours = null;
  if (powerW > 0.1)
    timeHours = isCharging ? (energyFullWh - energyWh) / powerW : energyWh / powerW;

  return {
    status: isCharging ? 'Charging' : status === 'Discharging' ? 'Discharging' : 'Unknown',
    isCharging, powerW, voltageV, currentA,
    energyWh, energyFullWh, energyFullDesignWh,
    capacityPct, designCapacityPct, timeHours,
  };
}

function read(fileutil, source) {
  const path = findBatteryPath(fileutil, source);
  if (!path) return null;
  const data = readSys(fileutil, path);
  const tempRaw = parseInt(fileutil.readFile(`${path}/temp`) || '0');
  data.tempC = tempRaw > 0 ? tempRaw / 10 : readBatteryTemp(fileutil);
  return data;
}

if (typeof module !== 'undefined') {
  module.exports = { formatTimeHours, formatPanel, formatTooltip, findBatteryPath, read };
}
