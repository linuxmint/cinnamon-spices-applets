'use strict';

// 模型单价表（简化版）。上游 Pricing.cs（499 行）的价格**不在源码里**：它从
// https://openrouter.ai/api/v1/models 拉取并缓存到磁盘（Pricing.cs:22 Source、:226-251 Parse），
// 内部按「每 token」存，只在设置界面换算成每百万（Pricing.cs:323 注释）。
// 本方案 M4 才做在线拉取，M1-M3 用一张内置常量表顶上，因此这里：
//   * 单位统一为「美元 / 百万 token」，priceFor 直接返回这个单位；
//   * 表里只放 8-15 个常见模型，再加一层按模型族前缀的回退（对应上游 Find 的「去日期后缀」回退，
//     Pricing.cs:353-363），否则带 -20260101 这种日期后缀的 ID 会一律查不到价；
//   * 不做 openrouter 拉取、不做 tiers/overrides（上游 Pricing.cs:238-251 的长上下文阶梯价）。
//
// 价格来源：各厂商公开目录价（Anthropic / OpenAI / DeepSeek / Moonshot / Google），
// 单位已换算成「美元 / 百万 token」。上游源码里唯一出现的字面单价是测试夹具
// （tests/BrimDeck.Tests/Program.cs:50-51、:79），都是虚构模型，不能当真实价目，故不采用。
// 价目随厂商调整，这里只是估算；标 FIXME 的条目等 M4 接 openrouter 后由远程价目替换。
//
// cacheWrite 上游没有单独一列可抄（TokenPrices 有，但目录价常缺），按「缓存写入按输入价计」
// 简化（上游手动价目的同一条规则：Pricing.cs:380-385）。

// ---- 价目表（美元 / 百万 token）---------------------------------------------

// 精确 ID：键已规范化（小写、claude 的 4.6 → 4-6、去掉 vendor 前缀）。
var MODEL_PRICES = {
  // Anthropic 公开价（美元/百万 token）
  'claude-opus-4': { input: 15, output: 75, cacheRead: 1.5 },
  'claude-opus-4-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-6': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-4': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-sonnet-4-5': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1 },
  'claude-3-7-sonnet': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-3-5-haiku': { input: 0.8, output: 4, cacheRead: 0.08 },
  // OpenAI
  'gpt-5': { input: 1.25, output: 10, cacheRead: 0.125 },
  'gpt-5-mini': { input: 0.25, output: 2, cacheRead: 0.025 },
  // DeepSeek（本机 DSH 最活跃的两个：deepseek-flash / deepseek/deepseek-v4.1-flash-1017）
  'deepseek-chat': { input: 0.27, output: 1.1, cacheRead: 0.07 },
  'deepseek-reasoner': { input: 0.55, output: 2.19, cacheRead: 0.14 },
  'deepseek-flash': { input: 0.27, output: 1.1, cacheRead: 0.07 }, // FIXME(字段待确认: flash 档公开价目)
  'deepseek-v4.1-flash': { input: 0.27, output: 1.1, cacheRead: 0.07 }, // FIXME(字段待确认: 同上)
  // Moonshot（本机有 moonshotai/kimi-k3.1-pro-thinking）
  'kimi-k2': { input: 0.6, output: 2.5, cacheRead: 0.15 },
  'kimi-k3': { input: 0.6, output: 2.5, cacheRead: 0.15 }, // FIXME(字段待确认: k3 档公开价目)
  'kimi-k3.1-pro': { input: 0.6, output: 2.5, cacheRead: 0.15 }, // FIXME(字段待确认: 同上)
  // Google
  'gemini-2.5-pro': { input: 1.25, output: 10, cacheRead: 0.31 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cacheRead: 0.075 }
};

// 模型族回退：当 ID 带版本/日期/思考档后缀（claude-sonnet-5-5、deepseek/deepseek-v4.1-flash-1017-thinking-max、
// kimi-k3.1-pro-thinking）时，取「最长匹配的族前缀」的价。顺序无关，按前缀长度取最长。
var FAMILY_PRICES = {
  'claude-opus': { input: 15, output: 75, cacheRead: 1.5 }, // 上游 Opus 档常见价
  'claude-sonnet': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-haiku': { input: 0.8, output: 4, cacheRead: 0.08 },
  'claude-3': { input: 3, output: 15, cacheRead: 0.3 },
  'gpt-5': { input: 1.25, output: 10, cacheRead: 0.125 },
  'gpt-4': { input: 2.5, output: 10, cacheRead: 1.25 },
  'deepseek': { input: 0.27, output: 1.1, cacheRead: 0.07 },
  'kimi': { input: 0.6, output: 2.5, cacheRead: 0.15 },
  'gemini-pro': { input: 1.25, output: 10, cacheRead: 0.31 },
  'gemini-flash': { input: 0.3, output: 2.5, cacheRead: 0.075 },
  'gemini': { input: 1.25, output: 10, cacheRead: 0.31 }
};

// ---- 规范化 ----------------------------------------------------------------

// 对应上游 Pricing.Normalize（Pricing.cs:258-263）：小写；claude 的 "4.6" 与 "4-6" 归一到 "4-6"。
// 额外多做一步：去掉 "anthropic/""moonshotai/" 这类 vendor 前缀，让查表只看模型本身
// （上游用另一条 lookup 别名路径达到同样效果，Pricing.cs:279-283）。
function normalize(model) {
  var value = typeof model === 'string' ? model.trim().toLowerCase() : '';
  if (value.length === 0) return '';
  // 只对 claude 把「4.6」归一成「4-6」——上游就是这么限定范围的（Pricing.cs:261-262），
  // 若对所有模型都替换，deepseek-v4.1-flash 会被改成 deepseek-v4-1-flash 而查不到。
  if (value.indexOf('claude-') === 0 || value.indexOf('anthropic/claude-') === 0) {
    value = value.replace(/(\d)\.(\d)/g, '$1-$2');
  }
  var slash = value.indexOf('/');
  if (slash >= 0) value = value.slice(slash + 1);
  return value;
}

// 去掉尾部的「-thinking」「-thinking-max」「-highspeed」这类非计价限定词，
// 让 deepseek-v4-flash-1017-thinking-max 这类 ID 能落到 deepseek 族。
function stripQualifiers(value) {
  var out = value;
  for (var i = 0; i < 8; i++) {
    var before = out;
    out = out.replace(/-(thinking|thinking-max|max|highspeed|fast|slow|minimal|low|medium|high)$/, '');
    if (out === before) break;
  }
  return out;
}

// ---- 查价 ------------------------------------------------------------------

// priceFor(model) -> { input, output, cacheRead, cacheWrite }（美元 / 百万 token）或 null
//   cacheWrite 无独立价，按输入价计（见文件头）。
//   查不到就返回 null，让调用方把这条记录标成「未定价」，绝不返回 0 冒充免费。
function priceFor(model) {
  var key = normalize(model);
  if (key.length === 0) return null;
  var price = MODEL_PRICES[key] || matchFamily(stripQualifiers(key)) || matchFamily(key);
  if (!price) return null;
  return {
    input: price.input,
    output: price.output,
    cacheRead: price.cacheRead,
    cacheWrite: price.input
  };
}

// 最长前缀匹配（chr 边界必须是 '-' 或结尾），对应上游「逐段删词再查」的回退思路（Pricing.cs:472-489）。
function matchFamily(key) {
  var best = null;
  var bestLength = -1;
  var families = Object.keys(FAMILY_PRICES);
  for (var i = 0; i < families.length; i++) {
    var family = families[i];
    if (key === family || key.indexOf(family + '-') === 0) {
      if (family.length > bestLength) {
        best = FAMILY_PRICES[family];
        bestLength = family.length;
      }
    }
  }
  return best;
}

// estimateUsd(tokens, model) -> 美元，或 null（无价目）
//   tokens = { input, output, cacheRead, cacheWrite }（camelCase，与 providers 的条目同形）
//   也接受 { input_tokens, ... } 的下划线写法（调用方有时直接传原始 usage 对象）。
function estimateUsd(tokens, model) {
  if (tokens === null || typeof tokens !== 'object') return null;
  var price = priceFor(model);
  if (!price) return null;
  var input = number(tokens.input !== undefined ? tokens.input : tokens.input_tokens);
  var output = number(tokens.output !== undefined ? tokens.output : tokens.output_tokens);
  var cacheRead = number(tokens.cacheRead !== undefined ? tokens.cacheRead : (tokens.cache_read_input_tokens !== undefined ? tokens.cache_read_input_tokens : tokens.cacheReadTokens));
  var cacheWrite = number(tokens.cacheWrite !== undefined ? tokens.cacheWrite : (tokens.cache_creation_input_tokens !== undefined ? tokens.cache_creation_input_tokens : tokens.cacheWriteTokens));
  return (input * price.input + output * price.output + cacheRead * price.cacheRead + cacheWrite * price.cacheWrite) / 1e6;
}

function number(value) {
  var n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

if (typeof module !== 'undefined') {
  module.exports = {
    MODEL_PRICES: MODEL_PRICES,
    FAMILY_PRICES: FAMILY_PRICES,
    normalize: normalize,
    priceFor: priceFor,
    estimateUsd: estimateUsd
  };
}
