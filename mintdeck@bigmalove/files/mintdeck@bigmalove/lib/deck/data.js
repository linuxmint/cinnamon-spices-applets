// lib/deck/data.js —— 把本机真实数据接进面板
//
// 两个源（本机确实存在的）：
//   · Claude Code      → ~/.claude/projects/**/*.jsonl（assistant 行的 usage + cost-state 的 totalCostUSD）
//   · DeepSeek Harness → ~/.dsh-desktop/sessions/**/session.v4.jsonl.zstd（zstd -dc 后取 assistant/message 的 data.usage）
// 解析逻辑在 lib/core/providers/*.js（纯 JS，node 可测），这里只负责「找文件 → 读 → 汇总 → 喂给 UI」。
//
// 两条性能约束（实测）：218 个 DSH 会话逐个起 zstd 要 5.6s，所以
//   1) 分片异步跑，每次最多占 30ms，不卡 shell；
//   2) 解析结果按 (path, mtime) 缓存到 ~/.cache/mintdeck/usage-cache.json，第二次启动只处理新增会话（实测 18ms）。
'use strict';

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Draw = imports.lib.ui.draw;
const I18n = imports.lib.core.i18n;
const Claude = imports.lib.core.providers.claude;
const Dsh = imports.lib.core.providers.dsh;
const WorkBuddy = imports.lib.core.providers.workbuddy;

// 列里的文字是「刷新那一刻」的译文：换语言时 applet 会重新 refresh()，不需要在这里监听
const _ = I18n.t;
const tn = I18n.tn;

const HOME = GLib.get_home_dir();
const CLAUDE_DIR = GLib.build_filenamev([HOME, '.claude', 'projects']);
const DSH_DIR = GLib.build_filenamev([HOME, '.dsh-desktop', 'sessions']);
const CACHE_DIR = GLib.build_filenamev([GLib.get_user_cache_dir(), 'mintdeck']);
const CACHE_FILE = GLib.build_filenamev([CACHE_DIR, 'usage-cache.json']);
const CACHE_VERSION = 1;

const SLICE_MS = 30;           // 单次 idle 回调最多占用
const DSH_MAX_FILES = 400;

const _files = { claude: {}, dsh: {} };   // path -> {mtime, parsed}
let _diskLoaded = false;
let _dirty = false;

// ---------------------------------------------------------------- 磁盘缓存

function loadDiskCache() {
    if (_diskLoaded) return;
    _diskLoaded = true;
    try {
        const [ok, bytes] = GLib.file_get_contents(CACHE_FILE);
        if (!ok || !bytes) return;
        const data = JSON.parse(new TextDecoder('utf-8').decode(bytes));
        if (!data || data.version !== CACHE_VERSION) return;
        for (const kind of ['claude', 'dsh']) {
            const src = data[kind] || {};
            for (const path in src) {
                if (src[path] && typeof src[path].mtime === 'number') _files[kind][path] = src[path];
            }
        }
    } catch (e) { /* 缓存坏了就当没有 */ }
}

function saveDiskCache() {
    if (!_dirty) return;
    try {
        GLib.mkdir_with_parents(CACHE_DIR, 0o700);
        GLib.file_set_contents(CACHE_FILE, JSON.stringify({ version: CACHE_VERSION, claude: _files.claude, dsh: _files.dsh }));
        _dirty = false;
    } catch (e) { global.logError(e); }
}

// ---------------------------------------------------------------- 文件

function listFiles(dirPath, suffix, out) {
    out = out || [];
    let en;
    try {
        en = Gio.File.new_for_path(dirPath).enumerate_children(
            'standard::name,standard::type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
    } catch (e) {
        return out;
    }
    // 枚举器一直持有一个 dirfd，必须显式关掉：
    //   · GJS 靠 GC 回收，等 GC 的时候这些 fd 全开着；
    //   · 一次刷新要枚举 ~233 个会话目录 → 一次刷新就吃掉 ~250 个 fd，
    //     连续几次（切语言 / 连点刷新 / 并行刷新）就撞上 cinnamon 的 1024 上限，
    //     进程直接 abort（GLib-ERROR: Creating pipes for GWakeup: 打开的文件过多）。
    try {
        let info;
        while ((info = en.next_file(null)) !== null) {
            const name = info.get_name();
            const child = en.get_child(info);
            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                listFiles(child.get_path(), suffix, out);
            } else if (name.length > suffix.length && name.slice(-suffix.length) === suffix) {
                const mt = info.get_modification_time();
                out.push({
                    path: child.get_path(),
                    mtime: (mt ? mt.tv_sec : 0) * 1000 + (mt ? Math.floor(mt.tv_usec / 1000) : 0)
                });
            }
        }
    } finally {
        try { en.close(null); } catch (e) { /* 已经关了也无所谓 */ }
    }
    return out;
}

// 外部命令一律走 argv 形式（GLib.spawn_sync），不拼 shell 字符串：
//   · 路径里出现空格、引号、$ 也不用转义，不会被 shell 解释；
//   · SEARCH_PATH 让 'zstd' / 'python3' 按 PATH 解析，找不到时 spawn 直接抛，调用方按「不可用」处理。
// 注：spawn_sync 的阻塞被两条限制夹住 —— 一次 refresh 只对新增/变更的文件调用，
// 调用点本身跑在 30ms 一片的 idle 回调里（见 collectDshAsync），超出的部分留给下一帧。
// argv 形式 + SEARCH_PATH：不拼 shell 字符串，路径里有空格/引号也不会被解释。
function spawnCapture(argv) {
    try {
        const res = GLib.spawn_sync(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
        if (!res || !res[0]) return null;
        return res[1] || null;
    } catch (e) {
        return null;
    }
}

// 单文件同步读的上限由调用方控制：解析按 (path, mtime) 缓存，只在新文件出现时才真的读盘。
function readText(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        if (!ok || !bytes) return null;
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        return null;
    }
}

function readZstd(path) {
    const stdout = spawnCapture(['zstd', '-dc', '--', path]);
    if (!stdout) return null;
    try {
        return new TextDecoder('utf-8').decode(stdout);
    } catch (e) {
        return null;
    }
}

function newestMtime(list) {
    let newest = 0;
    for (const f of list) if (f.mtime > newest) newest = f.mtime;
    return newest;
}


// ---------------------------------------------------------------- WorkBuddy

// WorkBuddy 的用量在 SQLite 里，而本机没有 sqlite3 CLI —— 用 python3 只读桥（~19ms）。
// mode=ro 让 sqlite 自己处理 -wal，不会锁库、不会写回。
const WB_DB = GLib.build_filenamev([HOME, '.workbuddy', 'workbuddy.db']);
const WB_SNAPSHOT = GLib.build_filenamev([HOME, '.workbuddy', 'storage', 'skeleton', 'account-snapshot.json']);
let _wbCache = null;

function readWorkbuddy() {
    if (_wbCache && (Date.now() - _wbCache.at) < 30000) return _wbCache.data;

    const script = [
        'import sqlite3,json,os',
        'p=' + JSON.stringify(WB_DB),
        'c=sqlite3.connect("file:"+p+"?mode=ro",uri=True)',
        'rows=[{"sid":r[0],"used":r[1],"size":r[2],"upd":r[3],"credit":(sum(json.loads(r[4]).values()) if r[4] else 0)}',
        '      for r in c.execute("select session_id,used,size,updated_at,credit_json from session_usage")]',
        'snap={}',
        'try:',
        '    snap=json.load(open(' + JSON.stringify(WB_SNAPSHOT) + ')).get("primary",{})',
        'except Exception: pass',
        'print(json.dumps({"rows":rows,"snapshot":snap}))'
    ].join('\n');

    let out = null;
    const stdout = spawnCapture(['python3', '-c', script]);
    if (stdout) {
        try { out = JSON.parse(new TextDecoder('utf-8').decode(stdout)); } catch (e) { out = null; }
    }
    if (!out) return null;
    _wbCache = { at: Date.now(), data: out };
    return out;
}

// ---------------------------------------------------------------- 解析

function parseClaudeFile(f) {
    const hit = _files.claude[f.path];
    if (hit && hit.mtime === f.mtime) return hit.parsed;
    const text = readText(f.path);
    if (!text) return null;
    const parsed = Claude.parseSession(text, { sessionKey: f.path, mtime: f.mtime });
    _files.claude[f.path] = { mtime: f.mtime, parsed: parsed };
    _dirty = true;
    return parsed;
}

function parseDshFile(f) {
    const hit = _files.dsh[f.path];
    if (hit && hit.mtime === f.mtime) return hit.parsed;
    const text = readZstd(f.path);
    if (!text) return null;
    const parsed = Dsh.parseSession(text);
    _files.dsh[f.path] = { mtime: f.mtime, parsed: parsed };
    _dirty = true;
    return parsed;
}

function collectClaudeSync(now) {
    loadDiskCache();
    const files = listFiles(CLAUDE_DIR, '.jsonl', []);
    const parsed = [];
    for (const f of files) {
        try {
            const p = parseClaudeFile(f);
            if (p) parsed.push(p);
        } catch (e) { /* 单文件坏了不影响整列 */ }
    }
    return { summary: Claude.summarize(parsed, now), count: files.length, newest: newestMtime(files) };
}

// 刷新代号：每调一次 refresh 就 +1，旧的异步扫描看到代号变了就自己收手。
// 没有这个，连点「重新读取数据」或连切语言会同时跑好几条扫描链（每条都枚举 233 个目录）。
let _scanToken = 0;

// DSH 文件多：按时间片跑，onDone(summary, meta)
function collectDshAsync(now, onDone, token) {
    loadDiskCache();
    const all = listFiles(DSH_DIR, '.zstd', []);
    all.sort((a, b) => b.mtime - a.mtime);
    const files = all.slice(0, DSH_MAX_FILES);
    const parsed = [];
    let i = 0;

    const step = () => {
        if (token !== undefined && token !== _scanToken) return;   // 已有更新的一次刷新，这条链作废
        const t0 = GLib.get_monotonic_time();
        while (i < files.length) {
            try {
                const p = parseDshFile(files[i]);
                if (p) parsed.push(p);
            } catch (e) { /* 同上 */ }
            i++;
            if ((GLib.get_monotonic_time() - t0) / 1000 > SLICE_MS) break;
        }
        if (i < files.length) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => { step(); return false; });
            return;
        }
        const summary = Dsh.summarize(parsed, now);
        saveDiskCache();
        onDone(summary, { parsed: files.length, total: all.length, newest: newestMtime(files) });
    };
    step();
}

function workbuddyColumn(applet, s) {
    const pct = s.contextPercent;
    return {
        name: 'WorkBuddy',
        plan: s.plan ? String(s.plan) : '',
        color: appColor(applet, 'other'),
        quotas: [{
            title: _('上下文'),
            percent: pct,
            valueText: pct === null ? '—' : Math.round(pct) + '%',
            resetText: s.latest ? _('最近：%s', agoText(s.latest.upd) || _('无')) : null
        }],
        statusText: null,
        todayTokens: _('%s 积分', WorkBuddy.fmtCredits(s.today.credits)),
        weekTokens: _('%s 积分', WorkBuddy.fmtCredits(s.week.credits)),
        todayUsd: null,
        weekUsd: null,
        footer: _('%s 个会话 · 累计 %s 积分', s.total.sessions, WorkBuddy.fmtCredits(s.total.credits))
    };
}

// ---------------------------------------------------------------- 展示

function fmtTokens(n) {
    const v = Number(n) || 0;
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
    return String(Math.round(v));
}

function fmtUsd(v) {
    if (v === null || v === undefined) return null;
    const n = Number(v) || 0;
    if (n >= 100) return '$' + n.toFixed(0);
    if (n >= 1) return '$' + n.toFixed(2);
    if (n > 0) return '$' + n.toFixed(3);
    return '$0';
}

function agoText(ms) {
    if (!ms) return null;
    const days = Math.floor((Date.now() - ms) / 86400000);
    if (days <= 0) return _('今天');
    if (days === 1) return _('昨天');
    if (days < 30) return tn('%s 天前', '%s 天前', days);
    return tn('%s 个月前', '%s 个月前', Math.floor(days / 30));
}

function appColor(applet, id) {
    try {
        const apps = applet._theme && applet._theme.apps;
        return apps && apps[id] ? Draw.cssColor(apps[id]) : null;
    } catch (e) {
        return null;
    }
}

function claudeColumn(applet, s, meta) {
    const empty = !s.today.tokens && !s.week.tokens;
    return {
        name: 'Claude',
        plan: '',
        color: appColor(applet, 'claude'),
        quotas: [
            { title: _('5 小时'), percent: null, resetText: null },
            { title: _('每周'), percent: null, resetText: null }
        ],
        statusText: _('未登录 · 仅本机用量'),
        todayTokens: fmtTokens(s.today.tokens),
        weekTokens: fmtTokens(s.week.tokens),
        todayUsd: fmtUsd(s.today.usd),
        weekUsd: fmtUsd(s.week.usd),
        footer: empty ? _('最近记录 %s', agoText(meta && meta.newest) || _('无')) : _('本机会话')
    };
}

function dshColumn(applet, s, meta) {
    return {
        name: 'DeepSeek Harness',
        plan: '',
        color: appColor(applet, 'dsh'),
        quotas: [],
        todayTokens: fmtTokens(s.today.tokens),
        weekTokens: fmtTokens(s.week.tokens),
        todayUsd: null,
        weekUsd: null,
        footer: meta ? _('%s/%s 个会话', meta.parsed, meta.total) : _('本机会话')
    };
}

// ---------------------------------------------------------------- 入口

function render(applet, columns) {
    applet._panel.setUsage(columns);
    // 收起态的环：每个启用的源一个环（颜色是各自的工具色）。
    // 有配额百分比就填充，没有就只画轨道 —— 上游在「有该源但读不到配额」时也是这样留空的。
    const quotas = [];
    for (const c of columns) {
        if (c.statusCode === 'error') continue;
        const pct = Number.isFinite(c.percent) ? c.percent
            : (c.quotas || []).reduce((best, q) => (Number.isFinite(q.percent) ? Math.max(best, q.percent) : best), 0);
        quotas.push({ percent: pct, color: c.color });
    }
    applet._island.setQuotas(quotas, applet.v_showQuotaRing !== false);
}

// 两段式：Claude 立刻出（文件少），DSH 分片跑完后刷新一次
function refresh(applet) {
    const token = ++_scanToken;
    const now = new Date();
    const cols = [];

    if (applet.v_sourceClaude !== false) {
        try {
            const r = collectClaudeSync(now);
            cols.push(claudeColumn(applet, r.summary, r));
        } catch (e) {
            cols.push({ name: 'Claude', color: appColor(applet, 'claude'), statusText: _('读取失败'), statusCode: 'error' });
        }
    }
    if (applet.v_sourceDsh !== false) {
        cols.push({ name: 'DeepSeek Harness', color: appColor(applet, 'dsh'), statusText: _('读取中…'), statusCode: 'loading' });
    }
    if (applet.v_sourceWorkbuddy !== false) {
        try {
            const raw = readWorkbuddy();
            if (raw) cols.push(workbuddyColumn(applet, WorkBuddy.summarize(raw, now)));
        } catch (e) {
            cols.push({ name: 'WorkBuddy', color: appColor(applet, 'other'), statusText: _('读取失败'), statusCode: 'error' });
        }
    }
    render(applet, cols);

    if (applet.v_sourceDsh !== false) {
        collectDshAsync(now, (summary, meta) => {
            const out = cols.filter(c => c.name !== 'DeepSeek Harness');
            try {
                out.push(dshColumn(applet, summary, meta));
            } catch (e) {
                out.push({ name: 'DeepSeek Harness', statusText: _('读取失败'), statusCode: 'error' });
            }
            render(applet, out);
        }, token);
    }
}

function schedule(applet, delayMs) {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs || 1500, () => {
        try { refresh(applet); } catch (e) { global.logError(e); }
        return false;
    });
}

if (typeof module !== 'undefined') {
    module.exports = {
        refresh: refresh,
        schedule: schedule,
        collectClaude: collectClaudeSync,
        collectDsh: collectDshAsync,
        fmtTokens: fmtTokens,
        fmtUsd: fmtUsd,
        listFiles: listFiles,
        _resetCache: function () { _files.claude = {}; _files.dsh = {}; _diskLoaded = false; _dirty = true; }
    };
}
