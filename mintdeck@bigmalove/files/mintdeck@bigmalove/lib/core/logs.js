'use strict';

// 用量日志的增量读取层，对应上游 LogReader.cs（文件共 307 行，核心读取在 96-206 行）。
//
// 这里不做 IO：调用方把「某个文件此刻的完整内容」当字符串传进来（lib/linux 那边读文件），
// 本模块只回答一个问题——相对上次读到的位置，这次新增了哪些条目。
//
// 与上游的三处有意差异（其余语义照抄）：
//   1. 偏移单位：上游按 byte offset 记（LogReader.cs:98、:127），这里按 JS 字符串下标。
//      调用方每次都传完整文本，所以行内多字节字符不会造成错位；代价是每次要传全文，
//      好在 Claude 会话文件都是几十 KB 级（本机 8 个文件合计 < 1MB）。
//   2. 只解析 Claude Code 的会话格式（type:"assistant" + message.usage）。上游同一个函数里
//      还分支处理 Codex 的 token_count 事件；本方案不接 Codex（PLAN.md §6.1「未安装」）。
//   3. 去重顺序：上游先看 message.id、再看 uuid（LogReader.cs:207-209），这里按本任务要求
//      先看 requestId——同一 requestId 下的流式重复才是真正的重复，message.id 也可能复现。
//
// 状态对象只存普通对象/数组，不存函数与 Date，调用方可以整个序列化后落盘。

// 单行上限（LogReader.cs:25 DefaultMaxLine = 32MB）。超长的行大概率是内嵌的巨型工具结果，
// 上游直接丢弃并计一次读取失败，这里同样跳过，不抛。
var DEFAULT_MAX_LINE = 32 << 20;

// 只处理含这些键的行（LogReader.cs:157 UsageKeys）。用于在 JSON.parse 之前做一次廉价预筛：
// 会话文件里大量 attachment/user 行与本模块无关，避免为它们付解析成本。
var USAGE_KEYS = ['"usage"', '"token_count"', '"turn_context"'];

// ---- 小工具 ----------------------------------------------------------------

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// 上游 JsonValue.Count（Usage.cs:58）：非数字/负数/超范围一律归零，保证聚合不会出现 NaN。
function count(value) {
  var n = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : NaN);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  return n > 1e15 ? 1e15 : Math.floor(n);
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

// 上游 JsonValue.Date（Usage.cs:59-67）：数字按 Unix 毫秒或秒（>1e11 视为毫秒）解释，
// 字符串按 ISO 解析。返回 epoch 毫秒，拿不到就 null——绝不返回 NaN 让上层去猜。
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

// FNV-1a 32 位：没有 requestId/message.id 的行需要一个稳定指纹，
// 同一行内容重读两次必须得到同一个 key，否则每次刷新都会重复计数。
function hash32(input) {
  var h = 0x811c9dc5;
  for (var i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h.toString(16);
}

function hasUsageKey(line) {
  for (var i = 0; i < USAGE_KEYS.length; i++) {
    if (line.indexOf(USAGE_KEYS[i]) >= 0) return true;
  }
  return false;
}

// ---- 状态 ------------------------------------------------------------------

// 每个 reader 记住每个 path 读到哪、已经产出过哪些 key。
// files[path] = { offset: 已消费的字符数, line: 已消费的行数, errors: 坏行累计 }
// seen[key]   = 该 key 目前最完整的条目
function createReader() {
  return { files: Object.create(null), seen: Object.create(null) };
}

function resetReader(reader) {
  reader.files = Object.create(null);
  reader.seen = Object.create(null);
  return reader;
}

// ---- 单行解析 --------------------------------------------------------------

// 解析一条 Claude Code 会话行，返回 entry 或 null。对应 LogReader.cs:200-213 的 else 分支。
// 上游把 cache_creation_input_tokens 拆成「1 小时 ephemeral」与其余两段（cacheWriteHour/cacheWrite），
// 这里合并回 cache_creation_input_tokens 一个数——本方案的条目模型只有 cacheWrite 一列。
function parseAssistantLine(obj, sessionKey, lineNo, rawLine) {
  if (text(obj.type) !== 'assistant') return null;
  var ts = toMs(obj.timestamp);
  if (ts === null) return null;
  var message = isObject(obj.message) ? obj.message : null;
  if (!message || !isObject(message.usage)) return null;
  var usage = message.usage;
  var input = count(usage.input_tokens);
  var output = count(usage.output_tokens);
  var cacheRead = count(usage.cache_read_input_tokens);
  var cacheWrite = count(usage.cache_creation_input_tokens);
  var requestId = text(obj.requestId);
  var messageId = text(message.id);
  // 无 requestId 的行用「路径 + 绝对行号 + 行内容」的指纹：行号保证同内容不同行不互吞，
  // 行内容保证文件被重写后行号复用不会误判成同一条。
  var key = requestId || messageId || ('line:' + hash32(sessionKey + '#' + lineNo + '#' + rawLine));
  return {
    key: 'claude:' + key,
    sessionKey: sessionKey,
    requestId: requestId || messageId,
    model: text(message.model) || 'unknown',
    ts: ts,
    input: input,
    output: output,
    cacheRead: cacheRead,
    cacheWrite: cacheWrite,
    total: input + output + cacheRead + cacheWrite
  };
}

// ---- 增量读取 --------------------------------------------------------------

// readNew(reader, path, text) -> { entries, nextOffset, badLines, duplicates }
//
// 只消费「已经以换行结束」的完整行：文件末尾正在写入的半行留到下一次刷新
// （LogReader.cs:92-94 的注释就是这条规则）。返回的 nextOffset 是下次调用时应从哪个下标继续。
function readNew(reader, path, text) {
  var content = typeof text === 'string' ? text : '';
  var file = reader.files[path];
  if (!file) {
    reader.files[path] = file = { offset: 0, line: 0, errors: 0 };
  }
  var result = { entries: [], nextOffset: 0, badLines: 0, duplicates: 0 };
  // 文件变短 = 被截断或整体重写（LogReader.cs:58-60 同样从 0 重来）。
  // 已产出的 key 保留不清：旧 key 若再次出现，说明内容真的重复，继续按「更完整者胜」处理。
  if (content.length < reader.files[path].offset) {
    reader.files[path] = { offset: 0, line: 0, errors: 0 };
  }
  file = reader.files[path];

  var pos = file.offset;
  // BOM：上游在每行开头检查（LogReader.cs:167），这里在文件头检查一次即可。
  if (pos === 0 && content.charCodeAt(0) === 0xfeff) pos = 1;

  while (pos < content.length) {
    var newline = content.indexOf('\n', pos);
    if (newline < 0) break; // 尾部半行，留给下一次
    var raw = content.slice(pos, newline);
    var start = pos;
    pos = newline + 1;
    file.offset = pos;
    file.line++;
    if (raw.charCodeAt(raw.length - 1) === 13) raw = raw.slice(0, -1); // CRLF
    if (raw.length === 0) continue;
    if (raw.length > DEFAULT_MAX_LINE) {
      // 超长行按「坏行」处理，但不抛、也不让 offset 停在这里。
      file.errors++;
      result.badLines++;
      continue;
    }
    if (!hasUsageKey(raw)) continue;

    var obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      // 坏行跳过，只计数（LogReader.cs:214 catch (JsonException) { item.Errors++; }）
      file.errors++;
      result.badLines++;
      continue;
    }
    if (!isObject(obj)) continue;
    var entry;
    try {
      entry = parseAssistantLine(obj, path, file.line, raw);
    } catch (err) {
      result.badLines++;
      file.errors++;
      continue;
    }
    if (!entry) continue;

    var old = reader.seen[entry.key];
    if (old === undefined) {
      reader.seen[entry.key] = entry;
      result.entries.push(entry);
      continue;
    }
    // 流式记录会重复同一 id，保留用量更完整的那一条（LogReader.cs:66-67）。
    result.duplicates += 1;
    if (entry.total > old.total) {
      reader.seen[entry.key] = entry;
      result.entries.push(entry); // 改进后的那条也交出去；aggregate 内部会按 key 再去一次重
    }
  }
  result.nextOffset = file.offset;
  // 未消费的尾部（不含换行）不计入 offset，下一次从这里重读。
  return result;
}

// reader 里累计的全部条目，按时间升序。刷新后要重新汇总时用这个，而不是自己拼每次的 entries。
function allEntries(reader) {
  var keys = Object.keys(reader.seen);
  var list = [];
  for (var i = 0; i < keys.length; i++) list.push(reader.seen[keys[i]]);
  list.sort(function (a, b) { return a.ts - b.ts; });
  return list;
}

// ---- 聚合 ------------------------------------------------------------------

// aggregate(entries) -> [{ sessionKey, model, input, output, cacheRead, cacheWrite, total }]
//
// 先按 key 去重（同一 key 只留 total 最大的那条），再按 {sessionKey, model} 分组。
// 去重放在这里而不是只放在 readNew 里，是为了让「每次刷新各自拿 entries 再拼起来」的调用方
// 也不会重复计数。没有 key 的条目（例如手工构造的夹具）按数组下标补一个匿名 key。
function aggregate(entries) {
  var list = Array.isArray(entries) ? entries : [];
  var best = Object.create(null);
  for (var i = 0; i < list.length; i++) {
    var entry = list[i];
    if (!isObject(entry)) continue;
    var key = text(entry.key) || ('anon:' + i);
    var known = best[key];
    if (known === undefined || count(entry.total) > count(known.total)) best[key] = entry;
  }

  var groups = Object.create(null);
  var order = [];
  var keys = Object.keys(best);
  for (var j = 0; j < keys.length; j++) {
    var item = best[keys[j]];
    var sessionKey = text(item.sessionKey);
    var model = text(item.model) || 'unknown';
    var groupKey = sessionKey + '\u0000' + model;
    var group = groups[groupKey];
    if (!group) {
      groups[groupKey] = group = {
        sessionKey: sessionKey,
        model: model,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
      };
      order.push(groupKey);
    }
    group.input += count(item.input);
    group.output += count(item.output);
    group.cacheRead += count(item.cacheRead);
    group.cacheWrite += count(item.cacheWrite);
    group.total += count(item.total) || (count(item.input) + count(item.output) + count(item.cacheRead) + count(item.cacheWrite));
  }
  order.sort();
  var out = [];
  for (var k = 0; k < order.length; k++) out.push(groups[order[k]]);
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = {
    DEFAULT_MAX_LINE: DEFAULT_MAX_LINE,
    createReader: createReader,
    resetReader: resetReader,
    readNew: readNew,
    allEntries: allEntries,
    aggregate: aggregate,
    // 下列名字只为测试与 providers 复用，不是对外主接口
    toMs: toMs,
    count: count,
    hash32: hash32
  };
}
