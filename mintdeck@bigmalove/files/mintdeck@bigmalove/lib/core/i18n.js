// lib/core/i18n.js —— 界面文案的唯一入口
//
// 约定（与 gettext 一致）：msgid 就是简体中文原文，译文按 locale 查表。
// 这样做的好处是：
//   · 源码里读到的就是「用户会看到什么」，不用维护一套 key 表；
//   · po/*.po 里 msgid 也是中文，xlet-settings 与 Cinnamon 的 metadata 翻译走同一个 domain，
//     同一份 po 既能编译成 .mo（设置窗口 / 小程序列表），又能生成 i18nData.js（画布文字）。
//
// 这里只做纯查表：不读文件、不碰 GI（node 与 cjs 都能跑）。
// 词典由 applet.js 在启动时注入（imports.lib.core.i18nData），测试直接 require 注入。
'use strict';

// 简体中文是 msgid 的语言，也是所有回退链的终点
var SOURCE_LOCALE = 'zh_CN';

// 认识的语言（新增语言时同步：po/<locale>.po、settings-schema.json 的 language 选项、这里）
var KNOWN_LOCALES = ['zh_CN', 'zh_TW', 'ja', 'en'];

var _catalogs = {};        // locale -> { msgid: string | [单数, 复数] }
var _locale = SOURCE_LOCALE;

// ---------------------------------------------------------------- locale

// 'zh_CN.UTF-8' / 'zh-Hans-CN' / 'ja_JP@calendar' → 'zh_CN' / 'zh_CN' / 'ja_JP'
// 编码后缀（.UTF-8）与修饰（@calendar）先切掉，再用「4 字母 = 文字、2 字母 = 地区」拆段。
function normalize(tag) {
  if (!tag) return '';
  var s = String(tag).trim().split(/[.@]/)[0].replace(/-/g, '_');
  if (!s) return '';
  var parts = s.split('_');
  var lang = (parts[0] || '').toLowerCase();
  // 'C' / 'POSIX' 表示「没有 locale」，不是一门语言
  if (!lang || lang === 'c' || lang === 'posix') return '';

  var script = '', region = '';
  for (var i = 1; i < parts.length; i++) {
    var p = parts[i];
    if (!p) continue;
    if (/^[A-Za-z]{4}$/.test(p)) script = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    else if (/^[A-Za-z]{2}$/.test(p) || /^[0-9]{3}$/.test(p)) region = p.toUpperCase();
  }

  if (lang === 'zh') {
    // 繁体：显式 Hant 或港澳台地区；其余（CN/SG/无）按简体
    if (script === 'Hant' || region === 'TW' || region === 'HK' || region === 'MO') return 'zh_TW';
    return 'zh_CN';
  }
  return region ? (lang + '_' + region) : lang;
}

// 系统语言列表（GLib.get_language_names() 的顺序：'zh_CN.UTF-8', 'zh_CN', 'zh', 'C'）
// → 第一个「这门语言真的有词典」的结果；都没有就回落简体中文。
function pickLocale(names) {
  var list = names || [];
  for (var i = 0; i < list.length; i++) {
    var norm = normalize(list[i]);
    if (!norm) continue;
    if (has(norm)) return norm;
    var base = norm.split('_')[0];
    if (base !== norm && has(base)) return base;
  }
  return SOURCE_LOCALE;
}

function has(locale) {
  if (!locale) return false;
  if (locale === SOURCE_LOCALE) return true;
  return Object.prototype.hasOwnProperty.call(_catalogs, locale);
}

// 词典注入：{ en: {...}, ja: {...} }。键统一归一化，避免 'zh-tw' 这种写法查不到。
function setCatalog(catalog) {
  _catalogs = {};
  if (!catalog || typeof catalog !== 'object') return;
  var keys = Object.keys(catalog);
  for (var i = 0; i < keys.length; i++) {
    var id = normalize(keys[i]) || keys[i];
    _catalogs[id] = catalog[keys[i]] || {};
  }
}

function setLocale(tag) {
  var norm = normalize(tag);
  _locale = norm || SOURCE_LOCALE;
  return _locale;
}

function getLocale() { return _locale; }

// 实际有词典的语言（简体中文是 msgid 本身，没有单独的词典文件）
function locales() {
  var out = [SOURCE_LOCALE];
  var keys = Object.keys(_catalogs).sort();
  for (var i = 0; i < keys.length; i++) if (keys[i] !== SOURCE_LOCALE) out.push(keys[i]);
  return out;
}

// ------------------------------------------------ 回退链：选定 → 基语言（de_AT → de）→ 中文

function chain() {
  var out = [_locale];
  var base = String(_locale || '').split('_')[0];
  if (base && base !== _locale) out.push(base);
  out.push(SOURCE_LOCALE);
  return out;
}

// 查表：返回译文（string）或复数数组（Array），查不到返回 null
function lookup(msgid) {
  var order = chain();
  for (var i = 0; i < order.length; i++) {
    var cat = _catalogs[order[i]];
    if (!cat) continue;
    if (Object.prototype.hasOwnProperty.call(cat, msgid)) return cat[msgid];
  }
  return null;
}

// ---------------------------------------------------------------- 复数

// 各语言的复数规则只在这里出现一次：ja / zh 不分单复数，en 按 n===1，其余按 en 兜底
function pluralIndex(n, locale) {
  var id = normalize(locale || _locale);
  if (id === 'ja' || id === 'zh_CN' || id === 'zh_TW') return 0;
  if (id === 'en') return Number(n) === 1 ? 0 : 1;
  return Number(n) === 1 ? 0 : 1;
}

// ---------------------------------------------------------------- 格式化

// 只认 %s / %d / %%（与 po 里的 msgstr 写法一致）。
// 参数按顺序取，所以译者可以调换占位符相对位置，但不能调换参数语义。
function format(template, args) {
  if (template === null || template === undefined) return '';
  var s = String(template);
  if (!args || !args.length) return s.replace(/%%/g, '%');
  var out = '', ai = 0;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch !== '%') { out += ch; continue; }
    var next = s.charAt(i + 1);
    if (next === '%') { out += '%'; i++; continue; }
    if ((next === 's' || next === 'd') && ai < args.length) {
      var arg = args[ai++];
      if (next === 'd') {
        var num = Number(arg);
        out += String(Number.isFinite(num) ? Math.round(num) : 0);
      } else {
        out += (arg === null || arg === undefined) ? '' : String(arg);
      }
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

// ---------------------------------------------------------------- 对外

// 单数：t('今日')、t('%s 个会话', n)
function t(msgid) {
  var args = Array.prototype.slice.call(arguments, 1);
  var v = lookup(msgid);
  if (typeof v === 'string') return format(v, args);
  if (v && v.length) return format(v[0], args);
  return format(msgid, args);
}

// 复数：tn('%s 天前', '%s 天前', days)。第一个 %s 一定是 n 本身。
function tn(singular, plural, n) {
  var args = [n].concat(Array.prototype.slice.call(arguments, 3));
  var v = lookup(singular);
  if (v && v.length) return format(v[pluralIndex(n)], args);
  return format(Number(n) === 1 ? singular : plural, args);
}

// 测试与「换语言后重画」用：清掉注入的词典
function reset() {
  _catalogs = {};
  _locale = SOURCE_LOCALE;
}

if (typeof module !== 'undefined') {
  module.exports = {
    SOURCE_LOCALE: SOURCE_LOCALE,
    KNOWN_LOCALES: KNOWN_LOCALES,
    normalize: normalize,
    pickLocale: pickLocale,
    setCatalog: setCatalog,
    setLocale: setLocale,
    getLocale: getLocale,
    locales: locales,
    lookup: lookup,
    pluralIndex: pluralIndex,
    format: format,
    t: t,
    tn: tn,
    reset: reset
  };
}
