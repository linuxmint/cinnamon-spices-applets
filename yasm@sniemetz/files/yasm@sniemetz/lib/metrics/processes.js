const Gio = imports.gi.Gio;

function listProcPids() {
  const pids = [];
  try {
    const enumerator = Gio.File.new_for_path('/proc')
      .enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
      const name = info.get_name();
      if (/^\d+$/.test(name)) pids.push(name);
    }
    enumerator.close(null);
  } catch(e) {}
  return pids;
}

function parseProcStat(content) {
  const parenEnd = content.lastIndexOf(')');
  if (parenEnd === -1) return null;
  const comm = content.slice(content.indexOf('(') + 1, parenEnd);
  const rest = content.slice(parenEnd + 2).split(' ');
  // After state (rest[0]): ppid, pgrp, session, tty_nr, tpgid, flags,
  // minflt, cminflt, majflt, cmajflt, utime(11), stime(12)
  const utime = +rest[11];
  const stime = +rest[12];
  if (isNaN(utime) || isNaN(stime)) return null;
  return { comm, utime, stime };
}

function cpuSum(stat) {
  return stat.user + stat.nice + stat.system + stat.idle +
         stat.iowait + stat.irq + stat.softirq + stat.steal;
}

function read(fileutil, prevProcStats, prevCpuStat, currCpuStat, numCores) {
  const pids = listProcPids();
  const currStats = {};
  for (const pid of pids) {
    const content = fileutil.readFile(`/proc/${pid}/stat`);
    if (!content) continue;
    const stat = parseProcStat(content);
    if (stat) currStats[pid] = stat;
  }

  let topProcs = [];
  if (prevProcStats && prevCpuStat && currCpuStat) {
    const deltaTotal = cpuSum(currCpuStat.total) - cpuSum(prevCpuStat.total);
    if (deltaTotal > 0) {
      const nc = numCores || 1;
      topProcs = Object.keys(currStats)
        .map(pid => {
          const curr = currStats[pid];
          const prev = prevProcStats[pid];
          const deltaCpu = prev
            ? Math.max(0, (curr.utime + curr.stime) - (prev.utime + prev.stime))
            : 0;
          return { pid, comm: curr.comm, cpuPct: nc * 100 * deltaCpu / deltaTotal };
        })
        .filter(p => p.cpuPct >= 0.05)
        .sort((a, b) => b.cpuPct - a.cpuPct)
        .slice(0, 10);
    }
  }

  return { topProcs, currStats };
}

function formatTooltip(topProcs) {
  if (!topProcs || topProcs.length === 0) return '';
  const rows = topProcs.map(p =>
    `${p.comm.slice(0, 20).padEnd(20)} ${p.cpuPct.toFixed(1).padStart(5)}%`
  );
  return '<b>Top processes</b>\n' + rows.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { listProcPids, parseProcStat, read, formatTooltip };
}
