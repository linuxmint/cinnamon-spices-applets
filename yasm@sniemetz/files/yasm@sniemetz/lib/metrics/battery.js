const { _, padColumn } = typeof imports !== 'undefined' ? imports.lib.util : require('../util.js');

function formatTimeHours(h) {
  if (h === null || h === undefined) return '—';
  const hrs = Math.floor(h);
  const min = Math.round((h - hrs) * 60);
  return hrs > 0 ? `${hrs}h ${min}m` : `${min}m`;
}

function formatPanel(data) {
  const tte  = data.timeHours !== null ? ` | ${formatTimeHours(data.timeHours)}` : '';
  if (data.isFull)     return `${data.capacityPct}% | AC${tte}`;
  const sign = data.isCharging ? '+' : '-';
  return `${data.capacityPct}% | ${sign}${data.powerW.toFixed(1)}W${tte}`;
}

function formatTooltip(data, tempC) {
  // Tri-state: Charging → '+N.NN W', Full/idle on AC → '0.00 W' (no sign),
  //            Discharging → '-N.NN W'.
  let rateLabel, rateValue;
  if (data.isCharging)      { rateLabel = _("Charging:"); rateValue = `+${data.powerW.toFixed(2)} W`; }
  else if (data.isFull)     { rateLabel = _("Idle:");     rateValue = `${data.powerW.toFixed(2)} W`; }
  else                      { rateLabel = _("Draw:");     rateValue = `-${data.powerW.toFixed(2)} W`; }
  const timeLabel = data.isCharging ? _("Full in:") : data.isFull ? '' : _("Empty in:");
  const pairs = [
    [_("Charge:"),   `${data.capacityPct}%`],
    [_("Energy:"),   `${data.energyWh.toFixed(1)} / ${data.energyFullWh.toFixed(1)} Wh`],
    [_("Capacity:"), `${data.designCapacityPct.toFixed(1)}%`],
    [rateLabel,      rateValue],
    [_("Voltage:"),  `${data.voltageV.toFixed(2)} V`],
    [_("Current:"),  `${data.currentA.toFixed(2)} A`],
    [_("Temp:"),     tempC != null ? `${tempC.toFixed(1)}°C` : '—'],
  ];
  if (timeLabel) pairs.push([timeLabel, formatTimeHours(data.timeHours)]);
  return padColumn(pairs).join('\n');
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

  const status      = rd('status');
  const isCharging  = status === 'Charging';
  // On AC with battery topped up: kernel reports 'Full' or 'Not charging'.
  // In this state current_now is an unsigned trickle (leakage/topping-up)
  // that should not be surfaced as either charge or draw.
  const isFull      = status === 'Full' || status === 'Not charging';
  const isOnAC      = isCharging || isFull;
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

  // Suppress residual leakage/topping-up trickle when the battery is
  // full so it does not render as a fake draw.
  if (isFull) { powerW = 0; currentA = 0; }

  const designCapacityPct = energyFullDesignWh > 0 ? energyFullWh / energyFullDesignWh * 100 : 0;
  let timeHours = null;
  if (powerW > 0.1)
    timeHours = isCharging ? (energyFullWh - energyWh) / powerW : energyWh / powerW;

  return {
    status: isCharging ? 'Charging' : isFull ? 'Full'
          : status === 'Discharging' ? 'Discharging' : 'Unknown',
    isCharging, isFull, isOnAC,
    powerW, voltageV, currentA,
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
