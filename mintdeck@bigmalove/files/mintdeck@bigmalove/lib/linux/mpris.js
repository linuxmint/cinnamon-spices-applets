// lib/linux/mpris.js — 音乐面板的 MPRIS 通道（Windows SMTC → DBus MPRIS）。
//
// 上游语义参照 BrimDeck.Core/Music.cs：MediaTrack 只要 title/artist/album/artUrl/长度/位置/能力位。
// 这里只做「读 + 必要的控制方法封装」，不自己开轮询：Position 不随 PropertiesChanged 推送（§6.2 坑 2），
// 轮询交给调用方（1s 轮询 Properties.Get），本模块只提供 getPosition()。
//
// 实测踩到的坑（都已在本机 chrome 的 org.mpris.MediaPlayer2.chromium.instance5889 上复现）：
//   1. Metadata 是 a{sv}，内层还是 variant → deepUnpack 两次，否则拿到 variant 对象；
//   2. Chrome 不提供 introspection XML（proxy.get_interface_info() === null）→ 方法参数只能按规范手写；
//   3. xesam:artist 可能是 ['']（内嵌播放）→ 兜底成 ''。
'use strict';

const OBJ_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';
const ROOT_IFACE = 'org.mpris.MediaPlayer2';
const PROPS_IFACE = 'org.freedesktop.DBus.Properties';
const PLAYER_PREFIX = 'org.mpris.MediaPlayer2.';
const BUS_NAME = 'org.freedesktop.DBus';
const BUS_PATH = '/org/freedesktop/DBus';
// 实测: signal_subscribe 的 arg0 **不支持**「尾点命名空间」匹配 —— 传 'org.mpris.MediaPlayer2.'
// 时 NameOwnerChanged 一条都不来（同进程 RequestName 验证过）；arg0=null 与精确名字都能收到。
// 所以这里一律全收再在 JS 里按前缀过滤；NameOwnerChanged 本身量很小，不值当为省回调另加匹配规则。

// ---------------------------------------------------------------- GI 惰性句柄

function gi() {
  if (typeof imports === 'undefined' || !imports.gi) return null;
  return imports.gi;
}

function gio() {
  const g = gi();
  return g && g.Gio ? g.Gio : null;
}

function glib() {
  const g = gi();
  return g && g.GLib ? g.GLib : null;
}

// variant 剥壳。Metadata 的 a{sv} 需要剥两层：外层 dict 的每个值本身就是 v。
function unwrap(value) {
  if (value === null || value === undefined) return null;
  let out = value;
  if (typeof out.deepUnpack === 'function') out = out.deepUnpack();
  if (out !== null && typeof out === 'object' && typeof out.deepUnpack === 'function') out = out.deepUnpack();
  return out;
}

function asString(value, fallback) {
  const v = unwrap(value);
  if (v === null || v === undefined) return fallback === undefined ? '' : fallback;
  return String(v);
}

function asNumber(value, fallback) {
  const v = Number(unwrap(value));
  return Number.isFinite(v) ? v : fallback === undefined ? 0 : fallback;
}

function asBool(value) {
  const v = unwrap(value);
  return v === true || v === 1;
}

// xesam:artist 是字符串数组，实测可能是 ['']：过滤空白项再拼，空就返回 ''。
function artistText(value) {
  const v = unwrap(value);
  if (Array.isArray(v)) {
    const parts = [];
    for (let i = 0; i < v.length; i++) {
      const item = unwrap(v[i]);
      const text = item === null || item === undefined ? '' : String(item).trim();
      if (text) parts.push(text);
    }
    return parts.join(', ');
  }
  return v === null || v === undefined ? '' : String(v);
}

// ---------------------------------------------------------------- 播放器发现

/**
 * 当前会话里所有 MPRIS 播放器名。
 * @returns {string[]} 形如 'org.mpris.MediaPlayer2.chromium.instance5889'
 */
function listPlayers() {
  const Gio = gio();
  const GLib = glib();
  if (!Gio || !GLib) return [];
  try {
    const reply = Gio.DBus.session.call_sync(
      BUS_NAME, BUS_PATH, BUS_NAME, 'ListNames',
      null, new GLib.VariantType('(as)'), 0, 2000, null);
    // 返回类型是 (as)：deepUnpack 后是 [ [names] ]。
    const outer = reply.deepUnpack();
    const list = Array.isArray(outer) && Array.isArray(outer[0]) ? outer[0] : outer;
    if (!Array.isArray(list)) return [];
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const name = String(list[i]);
      if (name.indexOf(PLAYER_PREFIX) === 0 && out.indexOf(name) < 0) out.push(name);
    }
    return out;
  } catch (e) {
    return [];
  }
}

// ---------------------------------------------------------------- 代理

/**
 * 建一个 Player 接口代理（构造时会把全部 Properties 缓存下来）。
 * @param {string} playerName 形如 org.mpris.MediaPlayer2.<x>
 * @returns {{proxy:object, playerName:string, state:function}|null} 拿不到代理时 null
 */
function attach(playerName) {
  const Gio = gio();
  if (!Gio || !playerName) return null;
  let proxy;
  try {
    proxy = Gio.DBusProxy.new_sync(
      Gio.DBus.session, Gio.DBusProxyFlags.NONE, null,
      String(playerName), OBJ_PATH, PLAYER_IFACE, null);
  } catch (e) {
    return null;   // 播放器刚好退出 / 名字不是 MPRIS 播放器
  }
  if (!proxy) return null;
  return {
    proxy: proxy,
    playerName: String(playerName),
    state: function () { return state(proxy); }
  };
}

/**
 * 读取当前播放状态。Position 不在这里（它不推送，只给 getPosition 按需取）。
 * @returns {{status:string, title:string, artist:string, album:string, artUrl:string,
 *            lengthUs:number, positionUs:number|null, canSeek:boolean, canGoNext:boolean,
 *            trackId:string}}
 */
function state(proxy) {
  const empty = {
    status: 'Stopped', title: '', artist: '', album: '', artUrl: '',
    lengthUs: 0, positionUs: null, canSeek: false, canGoNext: false, trackId: ''
  };
  if (!proxy) return empty;
  const md = unwrap(proxy.get_cached_property('Metadata')) || {};
  return {
    status: asString(proxy.get_cached_property('PlaybackStatus'), 'Stopped'),
    title: asString(md['xesam:title']),
    artist: artistText(md['xesam:artist']),
    album: asString(md['xesam:album']),
    artUrl: asString(md['mpris:artUrl']),
    lengthUs: asNumber(md['mpris:length'], 0),
    positionUs: null,   // 见 getPosition()
    canSeek: asBool(proxy.get_cached_property('CanSeek')),
    canGoNext: asBool(proxy.get_cached_property('CanGoNext')),
    trackId: asString(md['mpris:trackid'])
  };
}

// 同步读 Position（微秒）。Position 不推送（§6.2 坑 2），调用方按 1s 轮询。
function getPosition(proxy) {
  if (!proxy) return null;
  const Gio = gio();
  const GLib = glib();
  if (!Gio || !GLib) return null;
  try {
    const reply = Gio.DBus.session.call_sync(
      proxy.get_name(), OBJ_PATH, PROPS_IFACE, 'Get',
      new GLib.Variant('(ss)', [PLAYER_IFACE, 'Position']),
      new GLib.VariantType('(v)'), 0, 2000, null);
    const inner = reply.deepUnpack()[0];
    const v = Number(inner !== null && typeof inner === 'object' && typeof inner.deepUnpack === 'function'
      ? inner.deepUnpack() : inner);
    return Number.isFinite(v) ? v : null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- 控制

// 这些方法都是「无返回值」的 MPRIS 方法；Chrome 没 introspection，参数只能按规范硬编码（即使它是空的）。
function callNoArgs(proxy, method) {
  if (!proxy) return false;
  const Gio = gio();
  if (!Gio) return false;
  try {
    proxy.call_sync(method, null, Gio.DBusCallFlags.NONE, 2000, null);
    return true;
  } catch (e) {
    return false;
  }
}

function playPause(proxy) { return callNoArgs(proxy, 'PlayPause'); }
function next(proxy) { return callNoArgs(proxy, 'Next'); }
function previous(proxy) { return callNoArgs(proxy, 'Previous'); }
function play(proxy) { return callNoArgs(proxy, 'Play'); }
function pause(proxy) { return callNoArgs(proxy, 'Pause'); }

/**
 * 跳到绝对位置（微秒）。SetPosition 的签名是 (o:trackid, x:int64)，trackid 必须来自当前 Metadata
 * （Chrome 是 /org/chromium/MediaPlayer2/TrackList/TrackXXX 这种动态路径）。
 * @returns {boolean}
 */
function seekTo(proxy, us) {
  if (!proxy) return false;
  const Gio = gio();
  const GLib = glib();
  if (!Gio || !GLib) return false;
  const md = unwrap(proxy.get_cached_property('Metadata')) || {};
  const trackId = asString(md['mpris:trackid']);
  if (!trackId) return false;
  const position = Math.max(0, Math.round(Number(us) || 0));
  try {
    proxy.call_sync('SetPosition', new GLib.Variant('(ox)', [trackId, position]),
      Gio.DBusCallFlags.NONE, 2000, null);
    return true;
  } catch (e) {
    return false;
  }
}

// Seek 是「相对偏移」，上游 MediaSeekPreview 用绝对位置，所以主入口是 seekTo；相对那位留着备用。
function seekBy(proxy, offsetUs) {
  if (!proxy) return false;
  const Gio = gio();
  const GLib = glib();
  if (!Gio || !GLib) return false;
  try {
    proxy.call_sync('Seek', new GLib.Variant('(x)', [Math.round(Number(offsetUs) || 0)]),
      Gio.DBusCallFlags.NONE, 2000, null);
    return true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------- 监听

/**
 * 监听 MPRIS 播放器出现/消失。
 * @param {function(string, boolean)} callback (playerName, appeared)
 *        第一个参数是完整的播放器名；appeared=true 表示新出现（该 attach 新播放器），false 表示已消失。
 * @returns {function():void} cancel
 */
function watch(callback) {
  const Gio = gio();
  if (!Gio || typeof callback !== 'function') return function () {};
  const conn = Gio.DBus.session;
  let id = 0;
  try {
    id = Gio.DBus.session.signal_subscribe(
      BUS_NAME, BUS_NAME, 'NameOwnerChanged', BUS_PATH,
      null,   // arg0 传 null：见文件头那条实测，尾点命名空间匹配在 GDBus 里不生效，前缀过滤在回调里做
      Gio.DBusSignalFlags.NONE,
      function (c, sender, path, iface, signal, params) {
        let payload;
        try {
          payload = params.deepUnpack();
        } catch (e) {
          return;
        }
        const name = String(payload[0] || '');
        if (name.indexOf(PLAYER_PREFIX) !== 0) return;
        const oldOwner = payload[1] ? String(payload[1]) : '';
        const newOwner = payload[2] ? String(payload[2]) : '';
        const appeared = !oldOwner && !!newOwner;
        const vanished = !!oldOwner && !newOwner;
        if (!appeared && !vanished) return;
        callback(name, appeared);
      });
  } catch (e) {
    return function () {};
  }
  return function cancel() {
    if (!id) return;
    try { conn.signal_unsubscribe(id); } catch (e) { /* 连接已断，忽略 */ }
    id = 0;
  };
}

// 上游多源切换（MediaAppTarget）要知道播放器是谁；MPRIS 里名字就是身份。
function describe(proxy) {
  if (!proxy) return null;
  let identity = '';
  try {
    const Gio = gio();
    const GLib = glib();
    const reply = Gio.DBus.session.call_sync(
      proxy.get_name(), OBJ_PATH, PROPS_IFACE, 'Get',
      new GLib.Variant('(ss)', [ROOT_IFACE, 'Identity']),
      new GLib.VariantType('(v)'), 0, 2000, null);
    const inner = reply.deepUnpack()[0];
    identity = String(inner && typeof inner.deepUnpack === 'function' ? inner.deepUnpack() : inner);
  } catch (e) {
    identity = '';
  }
  return { playerName: proxy.get_name(), identity: identity };
}

if (typeof module !== 'undefined') {
  module.exports = {
    OBJ_PATH: OBJ_PATH,
    PLAYER_IFACE: PLAYER_IFACE,
    listPlayers: listPlayers,
    attach: attach,
    state: state,
    getPosition: getPosition,
    getPositionUs: getPosition,
    playPause: playPause,
    next: next,
    previous: previous,
    play: play,
    pause: pause,
    seekTo: seekTo,
    seekBy: seekBy,
    watch: watch,
    describe: describe
  };
}
