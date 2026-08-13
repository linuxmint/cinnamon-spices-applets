const SPARK_CHARS = '_▁▂▃▄▅▆▇█'; // 9 bottom-aligned chars, index 0-8

function CircularBuffer(capacity) {
  this._buf = [];
  this._cap = capacity;
}
CircularBuffer.prototype.push = function(value) {
  this._buf.push(value);
  if (this._buf.length > this._cap) this._buf.shift();
};
CircularBuffer.prototype.values = function() { return this._buf.slice(); };
CircularBuffer.prototype.length = function() { return this._buf.length; };

function _norm(v, min, max, levels) {
  const n = levels !== undefined ? levels : SPARK_CHARS.length - 1;
  return Math.max(0, Math.min(n, Math.round((v - min) / ((max - min) || 1) * n)));
}

// opts: { zeroBlank: bool }
function renderSparkline(circBuf, min, max, opts) {
  const zeroBlank = opts && opts.zeroBlank;
  const levels = SPARK_CHARS.length - 1;
  const vals = circBuf.values();
  if (vals.length === 0) return '';
  const cap = Math.max(circBuf._cap, 20);
  return vals.map(v => (zeroBlank && v === 0) ? ' ' : SPARK_CHARS[_norm(v, min, max, levels)]).join('').padStart(cap, ' ');
}

// TX (upload) = bottom-up; RX (download) = top-aligned (bars hang from top).
// Returns [txRow, rxRow] — single-height each.
function renderNetBidirRows(txBuf, rxBuf, maxTx, maxRx) {
  const cap    = Math.max(txBuf._cap, 20);
  const txVals = txBuf.values();
  const rxVals = rxBuf.values();
  const len    = Math.min(txVals.length, rxVals.length);
  const tx     = txVals.slice(txVals.length - len);
  const rx     = rxVals.slice(rxVals.length - len);
  const lvl = SPARK_CHARS.length - 1;

  let txRow = '', rxRow = '';
  for (let i = 0; i < len; i++) {
    txRow += SPARK_CHARS[_norm(tx[i] || 0, 0, maxTx || 1, lvl)];
    rxRow += SPARK_CHARS[_norm(rx[i] || 0, 0, maxRx || 1, lvl)];
  }
  return [txRow.padStart(cap, ' '), rxRow.padStart(cap, ' ')];
}

if (typeof module !== 'undefined')
  module.exports = { CircularBuffer, renderSparkline, renderNetBidirRows };
