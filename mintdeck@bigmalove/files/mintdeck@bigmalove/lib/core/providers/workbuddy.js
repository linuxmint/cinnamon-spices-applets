// lib/core/providers/workbuddy.js —— WorkBuddy 的用量汇总（纯 JS，node 可测）
//
// 数据来自 ~/.workbuddy/workbuddy.db 的 session_usage 表（由 python3 只读桥导出成 JSON）：
//   used / size      最近一次请求的上下文占用 / 上下文窗口（不是累计，别当用量加总）
//   credit_json      {requestId: credits}，按会话求和 = 该会话消耗的积分
//   updated_at       毫秒时间戳，用它把积分归入今日/本周
// 套餐档位在 ~/.workbuddy/storage/skeleton/account-snapshot.json 的 primary.editionType（free/pro…）。
// 5 小时 / 每周额度只在服务端（/billing/meter/...），本地没有缓存 —— 所以这里不出配额百分比。
'use strict';

var DAY_MS = 86400000;
var WEEK_DAYS = 7;

function num(v) {
  var n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toMs(v) {
  if (v === null || v === undefined) return null;
  var n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n > 1e12) return n;            // 已经是毫秒
  if (n > 1e9) return n * 1000;      // 秒
  return null;
}

function startOfDay(ms) {
  var d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// raw: {rows:[{sid,used,size,upd,credit}], snapshot:{editionType,isPro,...}}
function summarize(raw, now) {
  var data = raw || {};
  var rows = Array.isArray(data.rows) ? data.rows : [];
  var snap = data.snapshot || {};
  var nowMs = now instanceof Date ? now.getTime() : (Number(now) || Date.now());
  var todayStart = startOfDay(nowMs);
  var weekStart = todayStart - (WEEK_DAYS - 1) * DAY_MS;

  var today = { credits: 0, sessions: 0 };
  var week = { credits: 0, sessions: 0 };
  var total = { credits: 0, sessions: rows.length };
  var latest = null;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var credit = num(r.credit);
    var upd = toMs(r.upd);
    total.credits += credit;

    if (upd !== null) {
      if (upd >= todayStart) { today.credits += credit; today.sessions += 1; }
      if (upd >= weekStart) { week.credits += credit; week.sessions += 1; }
      // 只看真正用过上下文的会话（used=0 的是刚建的空会话，会让环永远停在 0）
      if (num(r.used) > 0 && (!latest || upd > latest.upd)) {
        latest = { upd: upd, used: num(r.used), size: num(r.size) };
      }
    }
  }

  var pct = latest && latest.size > 0 && latest.used > 0 ? Math.min(100, (latest.used / latest.size) * 100) : null;

  return {
    plan: snap.editionType ? String(snap.editionType) : '',
    isPro: !!snap.isPro,
    today: today,
    week: week,
    total: total,
    latest: latest,
    contextPercent: pct,
    savedAt: snap.savedAt || null
  };
}

function fmtCredits(v) {
  var n = num(v);
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  if (n >= 10) return n.toFixed(0);
  if (n > 0) return n.toFixed(1);
  return '0';
}

if (typeof module !== 'undefined') {
  module.exports = {
    summarize: summarize,
    fmtCredits: fmtCredits,
    toMs: toMs,
    startOfDay: startOfDay,
    WEEK_DAYS: WEEK_DAYS,
    DAY_MS: DAY_MS
  };
}
