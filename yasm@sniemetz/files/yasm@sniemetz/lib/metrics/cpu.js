function parseStat(content) {
  const lines = content.split('\n').filter(l => l.startsWith('cpu'));
  const parse = line => {
    const p = line.trim().split(/\s+/);
    return { user: +p[1], nice: +p[2], system: +p[3], idle: +p[4],
             iowait: +p[5], irq: +p[6], softirq: +p[7], steal: +(p[8] || 0) };
  };
  return { total: parse(lines[0]), cores: lines.slice(1).map(parse) };
}

function computeCpuPct(prev, curr) {
  const sum = o => o.user + o.nice + o.system + o.idle + o.iowait + o.irq + o.softirq + o.steal;
  const prevTotal = sum(prev), currTotal = sum(curr);
  const deltaTotal = currTotal - prevTotal;
  if (deltaTotal === 0) return 0;
  const prevBusy = prevTotal - prev.idle - prev.iowait;
  const currBusy = currTotal - curr.idle - curr.iowait;
  return 100 * (currBusy - prevBusy) / deltaTotal;
}

function computeCpuBreakdown(prev, curr) {
  const sum = o => o.user + o.nice + o.system + o.idle + o.iowait + o.irq + o.softirq + o.steal;
  const deltaTotal = sum(curr) - sum(prev);
  if (deltaTotal === 0) return { total: 0, usr: 0, sys: 0, iowt: 0 };
  const pct = v => Math.round(100 * v / deltaTotal);
  return {
    total: pct((curr.user+curr.nice+curr.system+curr.iowait+curr.irq+curr.softirq+curr.steal)
              -(prev.user+prev.nice+prev.system+prev.iowait+prev.irq+prev.softirq+prev.steal)),
    usr:  pct((curr.user + curr.nice)  - (prev.user + prev.nice)),
    sys:  pct(curr.system  - prev.system),
    iowt: pct(curr.iowait  - prev.iowait),
  };
}

function validateHwmonPath(fileutil, hwmonPath) {
  if (!hwmonPath) return false;
  if (fileutil.readFile(`${hwmonPath}/temp1_input`) === null) return false;
  if (fileutil.readFile(`${hwmonPath}/temp1_label`) === null) return true; // no labels — trust it
  for (let j = 1; j <= 20; j++) {
    const lbl = (fileutil.readFile(`${hwmonPath}/temp${j}_label`) || '').trim().toLowerCase();
    if (!lbl) break;
    if (/package|core|tctl|tccd/.test(lbl)) return true;
  }
  return false;
}

function findCoretemPath(fileutil) {
  for (let i = 0; i < 20; i++) {
    const base = `/sys/class/hwmon/hwmon${i}`;
    const name = (fileutil.readFile(`${base}/name`) || '').trim();
    if (name === 'coretemp') return base;
  }
  return null;
}

function readHwmonTemps(fileutil, hwmonPath) {
  let packageC = null;
  const coresC = [];

  const chipName = (fileutil.readFile(`${hwmonPath}/name`) || '').trim();

  // coretemp / k10temp: deterministic layout — temp1 = package, temp2+ = cores
  if (chipName === 'coretemp' || chipName === 'k10temp' || chipName === 'zenpower') {
    for (let i = 1; i <= 20; i++) {
      const raw = fileutil.readFile(`${hwmonPath}/temp${i}_input`);
      if (raw === null) break;
      const tempC = parseInt(raw) / 1000;
      if (i === 1) packageC = tempC;
      else         coresC.push(tempC);
    }
    return { packageC: packageC || 0, coresC };
  }

  // Other chips: use label matching
  let hasAnyLabel = false;
  for (let i = 1; i <= 20; i++) {
    const raw = fileutil.readFile(`${hwmonPath}/temp${i}_input`);
    if (raw === null) break;
    const tempC = parseInt(raw) / 1000;
    const label = (fileutil.readFile(`${hwmonPath}/temp${i}_label`) || '').trim();
    if (label) {
      hasAnyLabel = true;
      if (/package/i.test(label))  packageC = tempC;
      else if (/core/i.test(label)) coresC.push(tempC);
    }
  }
  if (!hasAnyLabel) packageC = parseFloat(fileutil.readFile(`${hwmonPath}/temp1_input`) || '0') / 1000;
  if (packageC === null && coresC.length) packageC = Math.max(...coresC);
  return { packageC: packageC || 0, coresC };
}

function formatPanel(cpuPct, packageTempC) {
  return `${Math.round(cpuPct)}% | ${Math.round(packageTempC)}°C`;
}

function formatTooltip(coreBreakdowns, coreTemps, packageTempC, history, cpuPct) {
  const lines = [`<b>CPU</b>   ${Math.round(packageTempC)}°C`];
  if (history) {
    const pctStr = cpuPct != null ? `  ${Math.round(cpuPct)}%` : '';
    lines.push(`total %  ${history}${pctStr}`, '');
  }
  lines.push(`${'Core'.padEnd(6)} ${'%usr'.padStart(5)} ${'%sys'.padStart(5)} ${'%iowt'.padStart(6)} ${'temp'.padStart(6)}`);
  const nTemps = coreTemps ? coreTemps.length : 0;
  coreBreakdowns.forEach((b, i) => {
    // Map logical core to physical: multiple logical cores share one physical temp sensor
    const physTemp = nTemps > 0 ? coreTemps[i % nTemps] : undefined;
    const temp = physTemp != null ? `${Math.round(physTemp)}°C`.padStart(6) : '     —';
    lines.push(`${`C${i}`.padEnd(6)} ${(b.usr+'%').padStart(5)} ${(b.sys+'%').padStart(5)} ${(b.iowt+'%').padStart(6)} ${temp}`);
  });
  return lines.join('\n');
}

function read(fileutil, prevStat, hwmonPath) {
  const content = fileutil.readFile('/proc/stat');
  if (!content) return null;
  const stat = parseStat(content);
  let cpuPct = 0, corePcts = [], coreBreakdowns = [];

  if (prevStat) {
    const overall = computeCpuBreakdown(prevStat.total, stat.total);
    cpuPct = overall.total;
    coreBreakdowns = stat.cores.map((c, i) =>
      prevStat.cores[i] ? computeCpuBreakdown(prevStat.cores[i], c) : { total:0, usr:0, sys:0, iowt:0 }
    );
    corePcts = coreBreakdowns.map(b => b.total);
  }

  const validPath = validateHwmonPath(fileutil, hwmonPath) ? hwmonPath : null;
  const { packageC, coresC } = validPath
    ? readHwmonTemps(fileutil, validPath)
    : { packageC: 0, coresC: [] };

  return { stat, cpuPct, corePcts, coreBreakdowns, packageC, coresC, numCores: stat.cores.length };
}

if (typeof module !== 'undefined') {
  module.exports = { parseStat, computeCpuPct, computeCpuBreakdown, validateHwmonPath,
                     findCoretemPath, readHwmonTemps, formatPanel, formatTooltip, read };
}
