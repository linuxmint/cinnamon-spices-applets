'use strict';

// DeepSeek 会话（DshSessions / DshUsage）里的用量部分。
//
// 来源：~/.cache 之外的 <数据目录>/sessions/<place>/<id>/session_v?.jsonl（新版本是
// sessions/<slug>/session-<uuid>/session.v4.jsonl.zst）。zstd 解压由调用方完成
// （`zstd -dc`），这里只吃解压后的 JSONL 文本。
//
// 真实样本（本机 ~/.dsh-desktop/sessions，265 条 assistant/message）：
//   {"type":"assistant/message","seq":22,"time":1793189208952,
//    "data":{"turn":1,"step":1,"message":{"id":..,"role":"assistant",
//              "source":{"provider":"reapi","model":"deepseek/deepseek-v4.1-flash-1017-thinking-max"}},
//            "usage":{"inputTokens":2431,"outputTokens":351,"totalTokens":18014,
//                     "cacheReadTokens":15232,"cacheWriteTokens":0}}}
//
// ── 与任务正文/上游的三处差异（都以本机真实样本为准）────────────────────────
//   1. **usage 在 data.usage，不在 data.message.usage。** 本机 265 条样本里 data 的键恒为
//      {message, step, stream, turn, usage}；message 的键恒为 {content, id, role, source}。
//      任务正文的样例把 usage 写在 message 里，与实测不符。两者都认：先看 data.usage，
//      没有再退到 message.usage（后者恒缺 → 跳过该行，符合「data.message 可能缺 usage 就跳过」）。
//   2. **cacheWriteTokens 可能整个字段不存在**（本机 198/265 条没有它，64 条有）。缺失按 0 计。
//   3. **事件类型不止 15 种**：本机单文件就出现 34 种（tool/call、job/settled、step/start…），
//      只认 assistant/message，其余一律跳过，不计入坏行。
//
// 上游字段映射：DshSessions.cs:191-205 的 ParseLine。

var DAY_MS = 86400000;
var WEEK_DAYS = 7; // 与 providers/claude.js 一致：含今日在内最近 7 个自然日

// ---- 小工具 ----------------------------------------------------------------

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function count(value) {
  var n = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : NaN);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1e15 ? 1e15 : Math.floor(n);
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value > 100000000000 ? Math.round(value) : Math.round(value * 1000);
  }
  if (typeof value === 'string' && value.length > 0) {
    var parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value instanceof Date) {
    var time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

function startOfDay(ms) {
  var d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---- 解析 ------------------------------------------------------------------

// parseSession(text) -> { entries: [{ seq, ts, provider, model, input, output, cacheRead, cacheWrite, total }] }
//   ts 是 epoch 毫秒（样本里的 time 就是毫秒）；分天归属在 summarize 里按本地时区做。
//   total 优先用 usage.totalTokens（本机样本里它恒等于 input+output+cacheRead+cacheWrite），
//   缺失时退化为四项之和——与上游 TokenEntry.Total 的定义一致（Usage.cs:15）。
function parseSession(text_) {
  var content = typeof text_ === 'string' ? text_ : '';
  var entries = [];
  var seen = Object.create(null); // 消息 id 去重：fork 出来的会话会复制父会话事件及其 id（DshSessions.cs:11-12）
  var lines = content.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    if (raw.length === 0) continue;
    if (raw.charCodeAt(raw.length - 1) === 13) raw = raw.slice(0, -1);
    // 预筛：文件里绝大多数行是 tool/call、tool/result、job/* 等事件（本机 452/265 条 tool 事件），
    // 先用字符串判断省掉 JSON.parse。
    if (raw.indexOf('assistant/message') < 0) continue;

    var obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      continue; // 坏行跳过，不抛
    }
    if (!isObject(obj) || text(obj.type) !== 'assistant/message') continue;
    var ts = toMs(obj.time);
    if (ts === null) continue;
    var data = isObject(obj.data) ? obj.data : null;
    if (!data) continue;
    var usage = isObject(data.usage) ? data.usage : null;
    var message = isObject(data.message) ? data.message : null;
    if (!usage && message && isObject(message.usage)) usage = message.usage; // 差异 1 的兼容分支
    if (!usage) continue; // 「data.message 可能缺 usage 就跳过」

    var input = count(usage.inputTokens);
    var output = count(usage.outputTokens);
    var cacheRead = count(usage.cacheReadTokens);
    var cacheWrite = count(usage.cacheWriteTokens); // 差异 2：可能整个字段缺失 → 0
    var total = count(usage.totalTokens);
    if (total <= 0) total = input + output + cacheRead + cacheWrite;
    if (total <= 0) continue;

    var source = message && isObject(message.source) ? message.source : {};
    var seq = typeof obj.seq === 'number' ? obj.seq : count(obj.seq);
    var messageId = message ? text(message.id) : '';
    var key = messageId || ('seq:' + seq + ':' + ts);
    if (seen[key]) continue; // 同 id 只算一次（上游 entries.TryAdd）
    seen[key] = true;

    entries.push({
      seq: seq,
      ts: ts,
      provider: text(source.provider) || 'unknown',
      model: text(source.model) || 'unknown',
      input: input,
      output: output,
      cacheRead: cacheRead,
      cacheWrite: cacheWrite,
      total: total
    });
  }
  return { entries: entries };
}

// ---- 汇总 ------------------------------------------------------------------

// summarize(parsed | parsed[], now) -> { today: {usd, tokens}, week: {usd, tokens},
//                                        models: [{model, tokens, usd}] }
// DSH 没有本地费用数据（费用要问 platform.deepseek.com 的账户接口，见 DshUsage.cs:37-71），
// 所以 usd 恒为 null —— 与 claude 的 summarize 同形，UI 层不必分支。
function summarize(parsed, now) {
  var sessions = Array.isArray(parsed) ? parsed : [parsed];
  var nowMs = toMs(now);
  if (nowMs === null) nowMs = Date.now();
  var todayStart = startOfDay(nowMs);
  var weekStart = todayStart - (WEEK_DAYS - 1) * DAY_MS;

  var todayTokens = 0;
  var weekTokens = 0;
  var models = Object.create(null);
  var order = [];

  function modelRow(name) {
    var key = name.toLowerCase();
    var row = models[key];
    if (!row) {
      models[key] = row = { model: name, tokens: 0 };
      order.push(key);
    }
    return row;
  }

  for (var s = 0; s < sessions.length; s++) {
    var session = sessions[s];
    if (!isObject(session)) continue;
    var list = Array.isArray(session.entries) ? session.entries : [];
    for (var e = 0; e < list.length; e++) {
      var entry = list[e];
      if (!isObject(entry)) continue;
      var ts = toMs(entry.ts);
      if (ts === null || ts > nowMs) continue;
      var total = count(entry.total);
      if (total <= 0) total = count(entry.input) + count(entry.output) + count(entry.cacheRead) + count(entry.cacheWrite);
      if (total <= 0) continue;
      if (ts >= todayStart) todayTokens += total;
      if (ts >= weekStart) {
        weekTokens += total;
        modelRow(text(entry.model) || 'unknown').tokens += total;
      }
    }
  }

  var rows = [];
  for (var k = 0; k < order.length; k++) {
    var row = models[order[k]];
    rows.push({ model: row.model, tokens: row.tokens, usd: null });
  }
  rows.sort(function (a, b) { return b.tokens - a.tokens || (a.model < b.model ? -1 : 1); });

  return {
    today: { usd: null, tokens: todayTokens },
    week: { usd: null, tokens: weekTokens },
    models: rows
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    WEEK_DAYS: WEEK_DAYS,
    parseSession: parseSession,
    summarize: summarize,
    toMs: toMs
  };
}
