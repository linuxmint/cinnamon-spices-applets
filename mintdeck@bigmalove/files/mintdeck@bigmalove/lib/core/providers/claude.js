'use strict';

// Claude Code 的用量与配额数据层。
//
// 数据来源（本机实测，PLAN.md §6.1）：
//   ~/.claude/projects/**/*.jsonl，两种行：
//     {"type":"assistant","message":{"model":..,"usage":{input_tokens,output_tokens,
//       cache_read_input_tokens,cache_creation_input_tokens}},"timestamp":..,"requestId":..}
//     {"type":"cost-state","totalCostUSD":..,"modelUsage":{"<model>":{inputTokens,outputTokens,
//       thinkingTokens,cacheReadInputTokens,cacheCreationInputTokens,costUSD}},"sessionId":..,"startTime":..}
// 本机 8 个 jsonl 全都有 cost-state（每个文件只在末尾写一次），assistant 行只有 claude-sonnet-5-5 一个模型。
//
// 本模块不读文件、不发请求：文本由调用方读，配额请求只返回「给调用方照着发的 url + headers」。
//
// ── 费用取整策略（重要）────────────────────────────────────────────────────────
// totalCostUSD 是「整个会话的累计值」，不是单条消息的费用。所以：
//   * 同一会话里出现多条 cost-state 时，只取**最后一条**（按文件出现顺序，也就是最新写入的那条）；
//     把它们相加会把同一会话重复计 N 次。
//   * 时间归属不看 cost-state 的 startTime（那是会话开始时间，可能在上周），也不看其中间状态，
//     而是把「该会话的最后一条 cost-state」整体计入**会话文件的 mtime** 所在的那一天。
//     即：今天还在写的会话，其累计费用算今天；昨天停下的会话，算昨天。
//   * 由此带来的已知偏差：一个跨零点仍在写的会话，昨天的部分会被算到今天。上游同样按会话
//     最后一条 cost-state 取值（不按天拆分），这是同一取舍，已在 PLAN.md §6.1 记录。
//   * token 数不受此影响：assistant 行自带 timestamp，逐条按天/周归集。
//
// 上游出处：LogReader.cs:200-213（assistant 行解析）、Pricing.cs:386-395（按 token 估价）、
// LogReader.cs:237-267（Claude 配额字段）。差异见文件末尾 Deltas 注释。

var DAY_MS = 86400000;
// 一周 = 含今日在内最近 7 个自然日（本地时区）。上游的历史窗口是 29 天（LogReader.cs:37），
// 这里只做「今日/本周」两档，故取 7。
var WEEK_DAYS = 7;

// 配额接口。上游 UsageService.cs:348 用的是 api.anthropic.com；PLAN.md §6.1 与本任务正文写的是
// claude.ai。两者都留着：默认走**上游代码里那一行**（带 oauth token 时它才是有效端点），
// 需要旧值时显式传 { url: QUOTA_URL_WEB }。
var QUOTA_URL = 'https://api.anthropic.com/api/oauth/usage'; // UsageService.cs:348
var QUOTA_URL_WEB = 'https://claude.ai/api/oauth/usage'; // PLAN.md §6.1 记载的地址，默认不启用
var QUOTA_BETA = 'oauth-2025-04-20'; // UsageService.cs:349
var QUOTA_APP = 'cli'; // 本任务要求补的 x-app 头；上游只发 Bearer + anthropic-beta

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

// epoch 毫秒；数字按「>1e11 是毫秒，否则是秒」，字符串按 ISO。拿不到就是 null（Usage.cs:59-67）。
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

function hash32(input) {
  var h = 0x811c9dc5;
  for (var i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h.toString(16);
}

// ---- 会话文件解析 ----------------------------------------------------------

// parseSession(text, meta) -> { sessionKey, mtime, entries, costStates }
//   meta = { sessionKey: 文件路径, mtime: 文件修改时间 }（都可省略；mtime 省略时退化为最后一条 cost-state/entry 的时间）
//   entries    : [{ requestId, model, ts, input, output, cacheRead, cacheWrite, total }]
//   costStates : [{ ts, startTime, totalCostUSD, modelUsage }]（按文件顺序，最后一条即会话最新累计）
function parseSession(text_, meta) {
  var content = typeof text_ === 'string' ? text_ : '';
  var info = isObject(meta) ? meta : {};
  var sessionKey = text(info.sessionKey);
  var entries = [];
  var costStates = [];
  var best = Object.create(null); // requestId -> 最完整的一条
  var fileName = sessionKey || '(text)';
  var lineNo = 0;
  var lines = content.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    lineNo++;
    if (raw.length === 0) continue;
    if (raw.charCodeAt(raw.length - 1) === 13) raw = raw.slice(0, -1);
    if (raw.length === 0) continue;
    // 廉价预筛：既不含 usage 也不含 cost-state 的行直接跳过（日志里绝大多数是附件/消息正文）。
    if (raw.indexOf('"usage"') < 0 && raw.indexOf('"cost-state"') < 0) continue;

    var obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      continue; // 坏行跳过，不抛
    }
    if (!isObject(obj)) continue;
    var type = text(obj.type);

    if (type === 'assistant') {
      var entry = readAssistant(obj, fileName, lineNo, raw);
      if (!entry) continue;
      var old = best[entry.key];
      if (old === undefined || entry.total > old.total) {
        if (old !== undefined) {
          // 替换掉旧条目，保持「一条 requestId 只算一次」
          for (var j = 0; j < entries.length; j++) {
            if (entries[j].key === entry.key) {
              entries.splice(j, 1);
              break;
            }
          }
        }
        best[entry.key] = entry;
        entries.push(entry);
      }
      continue;
    }

    if (type === 'cost-state') {
      var state = readCostState(obj, fileName);
      if (state) costStates.push(state);
    }
  }

  var mtime = toMs(info.mtime);
  if (mtime === null) {
    // 调用方没给 mtime 时退化：先取最后一条 cost-state 的会话开始时间，再退到最后一条 assistant 的时间。
    // 这只是近似——费用归日靠的就是 mtime，缺它时窗口归类会偏早。
    if (costStates.length > 0) mtime = costStates[costStates.length - 1].startTime;
    else if (entries.length > 0) mtime = entries[entries.length - 1].ts;
  }

  return {
    sessionKey: sessionKey,
    mtime: mtime,
    entries: entries.map(publicEntry),
    costStates: costStates
  };
}

// 对外条目：任务约定的 7 个字段 + total（= input+output+cacheRead+cacheWrite，与上游 TokenEntry.Total
// 同义，Usage.cs:15）。total 留着是因为 summarize/aggregate 都要用它，避免调用方各自重算。
function publicEntry(entry) {
  return {
    requestId: entry.requestId,
    model: entry.model,
    ts: entry.ts,
    input: entry.input,
    output: entry.output,
    cacheRead: entry.cacheRead,
    cacheWrite: entry.cacheWrite,
    total: entry.total
  };
}

function readAssistant(obj, fileName, lineNo, raw) {
  var ts = toMs(obj.timestamp);
  if (ts === null) return null;
  var message = isObject(obj.message) ? obj.message : null;
  if (!message || !isObject(message.usage)) return null;
  var usage = message.usage;
  var requestId = text(obj.requestId) || text(message.id);
  var input = count(usage.input_tokens);
  var output = count(usage.output_tokens);
  var cacheRead = count(usage.cache_read_input_tokens);
  // 上游把 cache_creation_input_tokens 拆成 1 小时 ephemeral 与 5 分钟两档（LogReader.cs:205-206），
  // 报价表也只有 input/output/cacheRead 三列，这里合并成 cacheWrite 一个数。
  var cacheWrite = count(usage.cache_creation_input_tokens);
  return {
    key: requestId || ('line:' + hash32(fileName + '#' + lineNo + '#' + raw)),
    requestId: requestId,
    model: text(message.model) || 'unknown',
    ts: ts,
    input: input,
    output: output,
    cacheRead: cacheRead,
    cacheWrite: cacheWrite,
    total: input + output + cacheRead + cacheWrite
  };
}

function readCostState(obj, fileName) {
  var total = typeof obj.totalCostUSD === 'number' ? obj.totalCostUSD : Number(obj.totalCostUSD);
  if (!Number.isFinite(total)) return null;
  var usage = Object.create(null);
  if (isObject(obj.modelUsage)) {
    var models = Object.keys(obj.modelUsage);
    for (var i = 0; i < models.length; i++) {
      var row = obj.modelUsage[models[i]];
      if (!isObject(row)) continue;
      var usd = typeof row.costUSD === 'number' ? row.costUSD : Number(row.costUSD);
      usage[models[i]] = {
        inputTokens: count(row.inputTokens),
        outputTokens: count(row.outputTokens),
        thinkingTokens: count(row.thinkingTokens),
        cacheReadInputTokens: count(row.cacheReadInputTokens),
        cacheCreationInputTokens: count(row.cacheCreationInputTokens),
        costUSD: Number.isFinite(usd) ? usd : 0
      };
    }
  }
  return {
    // cost-state 行没有「本条记录的时间」；startTime 是会话**开始**时间，仅作元数据。
    // 费用归属不按它，而按会话文件的 mtime（见文件头「费用取整策略」）。
    startTime: toMs(obj.startTime),
    sessionId: text(obj.sessionId) || fileName,
    totalCostUSD: total,
    modelUsage: usage
  };
}

// ---- 汇总 ------------------------------------------------------------------

// lastCostState(session) -> 该会话费用应当被计入的那一条 cost-state（最后一条），没有则 null。
function lastCostState(session) {
  if (!isObject(session) || !Array.isArray(session.costStates) || session.costStates.length === 0) return null;
  return session.costStates[session.costStates.length - 1];
}

// summarize(parsed | parsed[], now) -> { today: {usd, tokens}, week: {usd, tokens},
//                                        models: [{model, tokens, usd}] }
//   usd 为 null 表示「没有任何费用数据」，为 0 表示「有费用数据但确实是 0」。
//   models 的 tokens/week 取本周窗口内的 assistant 条目；usd 取本周窗口内会话的最后一条
//   cost-state 的 modelUsage[model].costUSD。注意 cost-state 的 modelUsage 键名由 Claude Code
//   自己决定（带日期后缀是常见情况），与 message.model 不完全一致时该模型的 usd 会落在
//   「会话总额有、模型行没有」的状态，因此 models 里各 usd 之和允许小于 week.usd。
function summarize(parsed, now) {
  var sessions = Array.isArray(parsed) ? parsed : [parsed];
  var nowMs = toMs(now);
  if (nowMs === null) nowMs = Date.now();
  var todayStart = startOfDay(nowMs);
  var weekStart = todayStart - (WEEK_DAYS - 1) * DAY_MS;

  var today = { usd: 0, tokens: 0 };
  var week = { usd: 0, tokens: 0 };
  var hasCost = false;
  var models = Object.create(null); // 小写模型名 -> 行，避免 message.model 与 modelUsage 键大小写不一致时裂成两行
  var order = [];

  function modelRow(name) {
    var key = name.toLowerCase();
    var row = models[key];
    if (!row) {
      models[key] = row = { model: name, tokens: 0, usd: 0 };
      order.push(key);
    }
    return row;
  }

  for (var s = 0; s < sessions.length; s++) {
    var session = sessions[s];
    if (!isObject(session)) continue;

    // token：逐条按 assistant 行自己的时间戳归集（LogReader.cs:65 同样过滤 cutoff..now）
    var list = Array.isArray(session.entries) ? session.entries : [];
    for (var e = 0; e < list.length; e++) {
      var entry = list[e];
      if (!isObject(entry)) continue;
      var ts = toMs(entry.ts);
      if (ts === null || ts > nowMs) continue;
      var total = count(entry.total);
      if (total <= 0) total = count(entry.input) + count(entry.output) + count(entry.cacheRead) + count(entry.cacheWrite);
      if (total <= 0) continue;
      if (ts >= todayStart) today.tokens += total;
      if (ts >= weekStart) {
        week.tokens += total;
        // models 里的 token 数取**本周**窗口（与 models 里的 usd 同窗口，便于横向比）
        modelRow(text(entry.model) || 'unknown').tokens += total;
      }
    }

    // 费用：整个会话的最后一条 cost-state，按会话 mtime 归入某一天
    var state = lastCostState(session);
    if (!state) continue;
    hasCost = true;
    var sessionMs = toMs(session.mtime);
    if (sessionMs === null) sessionMs = toMs(state.startTime);
    if (sessionMs === null) continue;
    var usd = Number.isFinite(state.totalCostUSD) ? state.totalCostUSD : 0;
    if (sessionMs > nowMs) continue; // 未来时间（时钟回拨）不计入
    if (sessionMs >= todayStart) today.usd += usd;
    if (sessionMs >= weekStart) {
      week.usd += usd;
      var names = Object.keys(state.modelUsage || {});
      for (var m = 0; m < names.length; m++) {
        modelRow(names[m]).usd += state.modelUsage[names[m]].costUSD || 0;
      }
    }
  }

  var rows = [];
  for (var k = 0; k < order.length; k++) {
    var row = models[order[k]];
    if (row.tokens <= 0 && row.usd <= 0) continue;
    rows.push({ model: row.model, tokens: row.tokens, usd: row.usd });
  }
  rows.sort(function (a, b) { return b.tokens - a.tokens || (a.model < b.model ? -1 : 1); });

  return {
    today: { usd: hasCost ? today.usd : null, tokens: today.tokens },
    week: { usd: hasCost ? week.usd : null, tokens: week.tokens },
    models: rows
  };
}

// ---- 在线配额 --------------------------------------------------------------

// quotaRequest(token, opts) -> { method, url, headers }
// 只描述请求，不负责发。opts.url 可覆盖（例如退回 QUOTA_URL_WEB）。
function quotaRequest(token, opts) {
  var options = isObject(opts) ? opts : {};
  return {
    method: 'GET',
    url: text(options.url) || QUOTA_URL,
    headers: {
      Authorization: 'Bearer ' + text(token),
      'anthropic-beta': QUOTA_BETA,
      'x-app': QUOTA_APP
    }
  };
}

// 计费仪表的字段名有三套写法，按可信度依次取第一个是数字的：
//   _percentage（PLAN.md §6.1 与本任务正文）→ utilization（上游 LogReader.cs:246）→ percent
//   _reset_time → resets_at（上游 LogReader.cs:246）
// 缺失就跳过该项，绝不补 0——「服务器没给」和「用了 0%」是两件事（LogReader.cs:247-248 同一立场）。
var METERS = [
  ['five_hour', '5 小时额度'],
  ['seven_day', '每周额度'],
  ['seven_day_sonnet', 'Sonnet 每周']
];

function readNumber(obj, names) {
  for (var i = 0; i < names.length; i++) {
    var value = obj[names[i]];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.length > 0) {
      var n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

// parseQuotaResponse(json | object) -> [{ label, usedPercent, resetAt }]
//   usedPercent 0..100（上游 Quota.UsedPercent 同义，Clamp 到 0..100）
//   resetAt     epoch 毫秒，缺失为 null
// 额外额度（extra_usage）作为最后一项，带 usedCredits / monthlyLimit 两个附加字段。
function parseQuotaResponse(input) {
  var root = input;
  if (typeof input === 'string') {
    try {
      root = JSON.parse(input);
    } catch (e) {
      return [];
    }
  }
  if (!isObject(root)) return [];

  var quotas = [];
  for (var i = 0; i < METERS.length; i++) {
    var meter = root[METERS[i][0]];
    if (!isObject(meter)) continue;
    var percent = readNumber(meter, ['_percentage', 'utilization', 'percent']);
    if (percent === null) continue;
    quotas.push({
      label: METERS[i][1],
      usedPercent: Math.max(0, Math.min(100, percent)),
      resetAt: toMs(readReset(meter))
    });
  }

  var extra = root.extra_usage;
  if (isObject(extra)) {
    var credits = readNumber(extra, ['used_credits']);
    var limit = readNumber(extra, ['monthly_limit']);
    if (credits !== null) {
      var used = limit !== null && limit > 0 ? Math.max(0, Math.min(100, (credits / limit) * 100)) : null;
      quotas.push({
        label: '额外用量',
        usedPercent: used,
        resetAt: toMs(extra.resets_at),
        usedCredits: credits,
        monthlyLimit: limit
      });
    }
  }
  return quotas;
}

function readReset(meter) {
  if (meter._reset_time !== undefined) return meter._reset_time;
  if (meter.resets_at !== undefined) return meter.resets_at;
  return null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    QUOTA_URL: QUOTA_URL,
    QUOTA_URL_WEB: QUOTA_URL_WEB,
    WEEK_DAYS: WEEK_DAYS,
    parseSession: parseSession,
    summarize: summarize,
    quotaRequest: quotaRequest,
    parseQuotaResponse: parseQuotaResponse,
    lastCostState: lastCostState,
    toMs: toMs
  };
}
