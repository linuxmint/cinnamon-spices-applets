const MAX_AGE_SEC = 6 * 3600;

function appendEntry(fileutil, logPath, t, pct, powerW, isCharging) {
  fileutil.ensureDir(logPath.replace(/\/[^/]+$/, ''));
  const entry = { t, pct };
  if (powerW != null) entry.w = Math.round((isCharging ? powerW : -powerW) * 10) / 10;
  fileutil.appendFile(logPath, JSON.stringify(entry) + '\n');
}

function readEntries(fileutil, logPath) {
  const content = fileutil.readFile(logPath);
  if (!content) return [];
  return content.trim().split('\n')
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
    .filter(Boolean);
}

function readWindow(fileutil, logPath, windowSec) {
  const cutoff = Math.floor(Date.now() / 1000) - windowSec;
  return readEntries(fileutil, logPath).filter(e => e.t >= cutoff);
}

function pruneOld(fileutil, logPath) {
  const cutoff = Math.floor(Date.now() / 1000) - MAX_AGE_SEC;
  const kept = readEntries(fileutil, logPath).filter(e => e.t >= cutoff);
  fileutil.writeFile(logPath, kept.map(e => JSON.stringify(e)).join('\n') + (kept.length ? '\n' : ''));
}

// Returns numeric bucket values for canvas drawing — null for leading empty buckets
// (no data yet), number for filled buckets. Forward-fill applied for sleep gaps.
function timeSparklineVals(entries, windowSec, numBuckets) {
  if (!entries || entries.length === 0) return new Array(numBuckets).fill(null);
  const now = Math.floor(Date.now() / 1000);
  const bucketSec = windowSec / numBuckets;
  const buckets = new Array(numBuckets).fill(null);
  entries.forEach(({ t, pct }) => {
    const age = now - t;
    if (age < 0 || age >= windowSec) return;
    const idx = numBuckets - 1 - Math.floor(age / bucketSec);
    if (idx < 0 || idx >= numBuckets) return;
    if (buckets[idx] === null || t > buckets[idx].t) buckets[idx] = { pct, t };
  });
  let last = null;
  for (let i = 0; i < numBuckets; i++) {
    if (buckets[i] !== null) last = buckets[i].pct;
    else if (last !== null)  buckets[i] = { pct: last, t: 0 };
  }
  return buckets.map(b => b !== null ? b.pct : null);
}

// Numeric watt bucket averages for canvas. sign: 'charge' (w>0) or 'draw' (w<0).
function timeSparklineWVals(entries, windowSec, numBuckets, sign) {
  const valid = (entries || []).filter(e => e.w != null &&
    (sign === 'charge' ? e.w > 0 : e.w < 0));
  if (valid.length === 0) return new Array(numBuckets).fill(null);
  const now = Math.floor(Date.now() / 1000);
  const bucketSec = windowSec / numBuckets;
  const sums = new Array(numBuckets).fill(0);
  const cnts = new Array(numBuckets).fill(0);
  valid.forEach(({ t, w }) => {
    const age = now - t;
    if (age < 0 || age > windowSec) return;
    const idx = numBuckets - 1 - Math.floor(age / bucketSec);
    if (idx < 0 || idx >= numBuckets) return;
    sums[idx] += Math.abs(w);
    cnts[idx] += 1;
  });
  return sums.map((s, i) => cnts[i] > 0 ? s / cnts[i] : null);
}

if (typeof module !== 'undefined') {
  module.exports = { appendEntry, readWindow, pruneOld, timeSparklineVals, timeSparklineWVals };
}
