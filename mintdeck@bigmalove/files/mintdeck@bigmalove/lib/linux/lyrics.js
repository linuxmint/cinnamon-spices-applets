// lib/linux/lyrics.js — 歌词通道：本地 *.lrc → lrclib → 网易云（顺序照上游 Lyrics.cs:107-110）。
//
// 只负责「取到文本并解析成 [{timeMs,text}]」，不写文件、不缓存（缓存与 LRU 由调用方做）。
// Soup 版本必须在 import 之前钉死：cjs 里不写这句会拿到 2.4 的 API，async 方法全变。
'use strict';

if (typeof imports !== 'undefined' && imports.gi) imports.gi.versions.Soup = '3.0';

const LRCLIB_EXACT = 'https://lrclib.net/api/get';
const LRCLIB_SEARCH = 'https://lrclib.net/api/search';
const NETEASE_SEARCH = 'https://music.163.com/api/search/get/web?type=1&limit=8&s=';
const NETEASE_LYRIC = 'https://music.163.com/api/song/lyric?id=';
const UA = 'MintDeck/0.1';
// 上游 MaxResponseBytes：一条歌词几 KB，超过 2MB 直接放弃，别把内存交给服务器。
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const TIMEOUT_SEC = 8;

// ---------------------------------------------------------------- GI 惰性句柄

function gi() {
  if (typeof imports === 'undefined' || !imports.gi) return null;
  return imports.gi;
}

function soup() {
  const g = gi();
  return g && g.Soup ? g.Soup : null;
}

function glib() {
  const g = gi();
  return g && g.GLib ? g.GLib : null;
}

function gio() {
  const g = gi();
  return g && g.Gio ? g.Gio : null;
}

// ---------------------------------------------------------------- LRC 解析

// [mm:ss]、[mm:ss.xx]、[mm:ss:xx] 都见过；一行挂多个时间戳是副歌复用的写法。
const STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET = /\[offset:\s*([+-]?\d+)\s*\]/i;

/**
 * 解析 LRC 文本。
 * - 小数位按「毫秒左对齐」处理：[00:01.5] 是 1500ms，不是 5ms（上游用 "0." + 分组字符串，同义）；
 * - [offset:±ms] 整体平移，负值压到 0；
 * - 保留空文本行（上游把它们当间奏空档，UI 显示 ♪）；
 * - 结果按时间升序，同一 (time,text) 去重。
 * @param {string} text
 * @returns {{timeMs:number, text:string}[]}
 */
function parseLrc(text) {
  const src = String(text === null || text === undefined ? '' : text);
  if (!src) return [];
  const offsetMatch = OFFSET.exec(src);
  const offsetMs = offsetMatch ? Number(offsetMatch[1]) : 0;
  const out = [];
  const seen = Object.create(null);
  const rows = src.split('\n');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.indexOf('[') < 0) continue;
    STAMP.lastIndex = 0;
    const stamps = [];
    let m = STAMP.exec(row);
    while (m) {
      stamps.push({ index: m.index, length: m[0].length, timeMs: stampToMs(m) });
      m = STAMP.exec(row);
    }
    if (!stamps.length) continue;
    const last = stamps[stamps.length - 1];
    const lineText = row.slice(last.index + last.length).trim();
    for (let k = 0; k < stamps.length; k++) {
      const timeMs = Math.max(0, stamps[k].timeMs + offsetMs);
      const key = timeMs + '\u0000' + lineText;
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ timeMs: timeMs, text: lineText });
    }
  }
  out.sort(function (a, b) { return a.timeMs - b.timeMs; });
  return out;
}

function stampToMs(match) {
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  let ms = 0;
  if (match[3]) {
    // 「5」是 500ms、「05」是 50ms：按小数位左对齐补零，不能当 5ms / 5ms。
    const frac = String(match[3]);
    ms = Number(frac.length >= 3 ? frac.slice(0, 3) : frac + '0'.repeat(3 - frac.length));
  }
  return minutes * 60000 + seconds * 1000 + ms;
}

// 纯文本歌词没有时间轴，保留顺序、时间一律 0（上游同样处理，UI 手动滚动）。
function plainLines(text) {
  const out = [];
  const rows = String(text || '').split('\n');
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i].trim();
    if (line) out.push({ timeMs: 0, text: line });
  }
  return out;
}

// ---------------------------------------------------------------- 本地 .lrc

// 上游的归一化：去空白、标点、符号后大写比较，避免「Look at the Stars」和「look_at_the_stars」错过。
function norm(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .toUpperCase();
}

/**
 * 在目录里找与曲目对应的 *.lrc。
 * 规则：文件名含 title 即命中（归一化后比较）；文件名同时含 artist 的优先，
 * 归一化后与 title 完全相同的更优先；同分取较短的（更可能是正经命名的那份）。
 * @param {string} dir
 * @param {{title:string, artist?:string}} meta
 * @returns {string|null} 绝对路径
 */
function findLocalLrc(dir, meta) {
  const Gio = gio();
  if (!Gio || !dir) return null;
  const title = norm(meta && meta.title);
  if (!title) return null;
  const artist = norm(meta && meta.artist);
  let files = [];
  try {
    const folder = Gio.File.new_for_path(String(dir));
    // 目录不存在时 enumerate_children 会抛 NOT_FOUND，由下面的 catch 兜住：
    // 多一次 query_exists 只是多一次同步 syscall，没有信息量。
    const children = folder.enumerate_children('standard::name,standard::type', 0, null);
    let info = children.next_file(null);
    while (info) {
      const name = info.get_name();
      if (info.get_file_type() === Gio.FileType.REGULAR && /\.lrc$/i.test(name)) files.push(name);
      info = children.next_file(null);
    }
    children.close(null);
  } catch (e) {
    return null;
  }
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < files.length; i++) {
    const base = files[i].replace(/\.lrc$/i, '');
    const normalized = norm(base);
    if (normalized.indexOf(title) < 0) continue;
    let score = 1;
    if (normalized === title) score += 4;
    if (artist && normalized.indexOf(artist) >= 0) score += 2;
    if (score > bestScore || (score === bestScore && best !== null && files[i].length < best.length)) {
      best = files[i];
      bestScore = score;
    }
  }
  if (!best) return null;
  return String(dir).replace(/\/+$/, '') + '/' + best;
}

// ---------------------------------------------------------------- HTTP

/**
 * 取一个 JSON。等到 finish 才回调，天然在主循环里。
 * @param {string} url
 * @param {Object<string,string>=} headers
 * @param {function(Error|null, number, any)} cb
 */
function getJson(url, headers, cb) {
  const Soup = soup();
  const GLib = glib();
  if (!Soup || !GLib) {
    cb(new Error('Soup/GLib 不可用'), 0, null);
    return null;
  }
  let session;
  let message;
  try {
    session = new Soup.Session();
    session.set_timeout(TIMEOUT_SEC);
    message = Soup.Message.new('GET', url);
    const requestHeaders = message.get_request_headers();
    requestHeaders.append('User-Agent', UA);
    requestHeaders.append('Accept', 'application/json');
    const keys = Object.keys(headers || {});
    for (let i = 0; i < keys.length; i++) requestHeaders.append(keys[i], headers[keys[i]]);
  } catch (e) {
    cb(e, 0, null);
    return null;
  }
  let finished = false;
  const handle = {
    abort: function () {
      if (finished) return;
      finished = true;
      try { session.abort(); } catch (e) { /* 已结束 */ }
    }
  };
  session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, function (sess, result) {
    if (finished) return;
    finished = true;
    let bytes = null;
    let error = null;
    try {
      bytes = sess.send_and_read_finish(result);
    } catch (e) {
      error = e;
    }
    const status = Number(message.get_status());
    if (error) { cb(error, status, null); return; }
    let body = '';
    try {
      const data = bytes ? bytes.get_data() : null;
      if (data && data.length > MAX_RESPONSE_BYTES) { cb(new Error('响应过大'), status, null); return; }
      body = data ? new TextDecoder().decode(data) : '';
    } catch (e) {
      cb(e, status, null);
      return;
    }
    if (!body) { cb(null, status, null); return; }
    try {
      cb(null, status, JSON.parse(body));
    } catch (e) {
      cb(e, status, null);
    }
  });
  return handle;
}

// ---------------------------------------------------------------- 数据源

// 从 lrclib 的记录里取行：优先 syncedLyrics，退 plainLyrics（上游 Lyrics.Parse 的双入参就是这意思）。
function linesFromLrclibRecord(record) {
  if (!record || typeof record !== 'object') return [];
  const synced = parseLrc(String(record.syncedLyrics || ''));
  if (synced.length) return synced;
  return plainLines(record.plainLyrics || '');
}

// 候选打分：标题命中 > 有时间轴 > 时长接近。验收用例（'Look at the stars'，275s，无 artist）
// 靠这条规则选到 Soulline 那份 299s 的带轴歌词，而不是 268s 的无轴纯文本。
function scoreRecord(record, meta) {
  const title = norm(meta.title);
  const candidateTitle = norm(record.trackName);
  let score = 0;
  if (candidateTitle === title) score += 20;
  else if (candidateTitle.indexOf(title) >= 0 || title.indexOf(candidateTitle) >= 0) score += 6;
  else return -1;
  if (String(record.syncedLyrics || '').length) score += 10;
  const duration = Number(record.duration);
  const wanted = Number(meta.durationSec);
  if (wanted > 0 && duration > 0) {
    const diff = Math.abs(duration - wanted);
    score += Math.max(0, 8 - Math.floor(diff / 5));
  }
  return score;
}

function pickLrclibRecord(list, meta) {
  if (!Array.isArray(list)) return null;
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < list.length; i++) {
    const score = scoreRecord(list[i], meta);
    if (score > bestScore) { bestScore = score; best = list[i]; }
  }
  return bestScore > 0 ? best : null;
}

// 拼 query：空值直接省略（lrclib 对空 album_name 是容忍的，但省掉更干净）。
function lrclibUrl(base, params) {
  const parts = [];
  const keys = Object.keys(params);
  for (let i = 0; i < keys.length; i++) {
    const value = params[keys[i]];
    if (value === null || value === undefined || value === '') continue;
    parts.push(keys[i] + '=' + encodeURIComponent(String(value)));
  }
  return base + '?' + parts.join('&');
}

// ---------------------------------------------------------------- 主入口

/**
 * 依次试 lrclib 精确 → lrclib 搜索 → 网易云（搜索取 id → 取歌词）。
 * 只发请求，不写盘、不缓存。
 * @param {{title:string, artist?:string, album?:string, durationSec?:number, songId?:string}} meta
 *        songId 形如 'netease:347230' 时跳过 lrclib 直接按 id 取（上游 Lyrics.cs:107 同规矩）。
 * @param {function(Error|null, {timeMs:number,text:string}[], string|null)} onDone
 *        err 只在「请求/解析出错」时非空；全部源都没结果时 err=null、lines=[]、source=null。
 * @returns {{abort:function}|null}
 */
function fetchRemote(meta, onDone) {
  const done = typeof onDone === 'function' ? onDone : function () {};
  const track = meta || {};
  if (!track.title) {
    done(new Error('缺少 title'), [], null);
    return null;
  }
  let aborted = false;
  let current = null;
  const handle = {
    abort: function () {
      aborted = true;
      if (current && current.abort) current.abort();
    }
  };
  // 记住第一条请求/解析错误：全部源都空时把它交给调用方（空歌词本身不算错）。
  let firstError = null;
  const noteError = function (err) { if (err && !firstError) firstError = err; };

  const finish = function (lines, source) {
    if (aborted) return;
    done(lines && lines.length ? null : firstError, lines || [], source || null);
  };

  // 网易云：先搜 id 再取歌词。Referer 是必须的（实测不带会拿不到数据）。
  const neteaseFallback = function () {
    if (aborted) return;
    const keyword = String(track.title) + (track.artist ? ' ' + track.artist : '');
    current = getJson(NETEASE_SEARCH + encodeURIComponent(keyword), { Referer: 'https://music.163.com/' },
      function (err, status, data) {
        if (aborted) return;
        if (err || status !== 200) { noteError(err); finish([], null); return; }
        const songs = data && data.result && Array.isArray(data.result.songs) ? data.result.songs : [];
        const wanted = Number(track.durationSec) || 0;
        const wantedTitle = norm(track.title);
        let songId = null;
        for (let i = 0; i < songs.length; i++) {
          const song = songs[i];
          const name = norm(song.name);
          if (!name) continue;
          const titleOk = name === wantedTitle || name.indexOf(wantedTitle) >= 0;
          if (!titleOk) continue;
          const seconds = Number(song.duration) / 1000;
          if (wanted > 0 && seconds > 0 && Math.abs(seconds - wanted) > 8) continue;
          songId = song.id;
          break;
        }
        if (songId === null) { finish([], null); return; }
        current = getJson(NETEASE_LYRIC + songId + '&lv=-1&kv=-1&tv=-1', { Referer: 'https://music.163.com/' },
          function (err2, status2, data2) {
            if (aborted) return;
            if (err2 || status2 !== 200) { noteError(err2); finish([], null); return; }
            const lyric = data2 && data2.lrc && typeof data2.lrc.lyric === 'string' ? data2.lrc.lyric : '';
            const lines = parseLrc(lyric);
            finish(lines, lines.length ? 'netease' : null);
          });
      });
  };


  // 直接按 id 取（上游 Lyrics.cs:107：SongId 以 netease: 开头就不查 lrclib，避免串到别的版本）。
  const neteaseById = function (id) {
    if (aborted) return;
    current = getJson(NETEASE_LYRIC + id + '&lv=-1&kv=-1&tv=-1', { Referer: 'https://music.163.com/' },
      function (err, status, data) {
        if (aborted) return;
        if (err || status !== 200) { noteError(err); finish([], null); return; }
        const lyric = data && data.lrc && typeof data.lrc.lyric === 'string' ? data.lrc.lyric : '';
        const lines = parseLrc(lyric);
        if (lines.length) { finish(lines, 'netease'); return; }
        neteaseFallback();
      });
  };

  const lrclibSearch = function () {
    if (aborted) return;
    const url = lrclibUrl(LRCLIB_SEARCH, { track_name: track.title, artist_name: track.artist || '' });
    current = getJson(url, null, function (err, status, data) {
      if (aborted) return;
      if (err || status !== 200) { noteError(err); neteaseFallback(); return; }
      const record = pickLrclibRecord(data, track);
      const lines = record ? linesFromLrclibRecord(record) : [];
      if (lines.length) { finish(lines, 'lrclib'); return; }
      neteaseFallback();
    });
  };

  const lrclibExact = function () {
    if (aborted) return;
    // 实测: /api/get 的 artist_name 必填（空串回 400 ValidationError），所以没有 artist 就跳过精确接口。
    if (!track.artist) { lrclibSearch(); return; }
    const url = lrclibUrl(LRCLIB_EXACT, {
      track_name: track.title,
      artist_name: track.artist,
      album_name: track.album || '',
      duration: track.durationSec ? Number(track.durationSec).toFixed(3).replace(/\.?0+$/, '') : ''
    });
    current = getJson(url, null, function (err, status, data) {
      if (aborted) return;
      if (err) { noteError(err); lrclibSearch(); return; }
      if (status !== 200 || !data || typeof data !== 'object') { lrclibSearch(); return; }
      const lines = linesFromLrclibRecord(data);
      if (lines.length) { finish(lines, 'lrclib'); return; }
      lrclibSearch();
    });
  };

  const neteaseIdMatch = /^netease:(\d{1,16})$/.exec(String(track.songId || ''));
  if (neteaseIdMatch) neteaseById(neteaseIdMatch[1]);
  else lrclibExact();
  return handle;
}

if (typeof module !== 'undefined') {
  module.exports = {
    parseLrc: parseLrc,
    plainLines: plainLines,
    findLocalLrc: findLocalLrc,
    fetchRemote: fetchRemote
  };
}
