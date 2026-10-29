// lib/linux/exec.js —— 异步跑外部命令、收 stdout。
//
// 为什么不用 GLib 的同步 spawn（spawn_sync 那套）：
//   · 它在 shell 主线程上阻塞等子进程结束。nvidia-smi 冷启动三百毫秒起，zstd 解压大会话更久，
//     这段时间整个面板定住（时钟不走、拖拽跟不上），这是实打实的卡顿；
//   · cinnamon-settings 的安全扫描（ExtensionCore.py 的 UNSAFE_ITEMS）会因此给 applet 挂黄三角。
//
// Gio.Subprocess 的做法：
//   · new() 默认按 PATH 解析可执行文件（等价 GLib 的 SEARCH_PATH），argv 形式、不经 shell；
//   · stdout 走管道，communicate_utf8_async 在 GLib 主循环里回调 —— 不开线程、不轮询、不阻塞；
//   · 可执行文件不存在时 new() 直接抛，回调立刻收到 code:'missing'，调用方按「该工具不可用」处理。
'use strict';

function gio() {
  if (typeof imports === 'undefined' || !imports.gi) return null;
  return imports.gi.Gio || null;
}

// 还活着的子进程：applet 销毁 / reload 时要一起收掉，否则旧实例的 zstd 会一直挂着。
const live = [];

function untrack(handle) {
  const i = live.indexOf(handle);
  if (i >= 0) live.splice(i, 1);
}

/**
 * 跑一条命令，拿它的 stdout。
 * @param {string[]} argv argv 形式，argv[0] 走 PATH 解析
 * @param {function(?string, string)} onDone (stdout, code)
 *        stdout：成功时是解码后的文本，失败为 null；
 *        code：'ok' 成功 / 'missing' 找不到可执行文件 / 'failed' 非零退出或被打断
 * @returns {{cancel: function, dead: boolean}|null} 句柄；同步失败时返回 null
 */
function run(argv, onDone) {
  const done = typeof onDone === 'function' ? onDone : function () { };
  const Gio = gio();
  if (!Gio || !argv || !argv.length) {
    done(null, 'missing');
    return null;
  }

  let proc = null;
  try {
    proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
  } catch (e) {
    done(null, 'missing');
    return null;
  }

  const handle = {
    dead: false,
    cancel: function () {
      handle.dead = true;
      untrack(handle);
      try { proc.force_exit(); } catch (e) { }
    }
  };
  live.push(handle);

  try {
    proc.communicate_utf8_async(null, null, function (p, res) {
      untrack(handle);
      if (handle.dead) return;
      let text = null;
      let ok = false;
      try {
        const r = p.communicate_utf8_finish(res);   // [ok, stdout, stderr]
        ok = !!(r && r[0]);
        if (r) text = r[1];
      } catch (e) {
        ok = false;
      }
      if (handle.dead) return;
      done(ok ? text : null, ok ? 'ok' : 'failed');
    });
  } catch (e) {
    handle.cancel();
    done(null, 'failed');
  }
  return handle;
}

// 收掉所有在跑的子进程（applet 销毁时调用）。
function cancelAll() {
  const pending = live.slice();
  for (let i = 0; i < pending.length; i++) {
    try { pending[i].cancel(); } catch (e) { }
  }
  live.length = 0;
}

if (typeof module !== 'undefined') {
  module.exports = { run: run, cancelAll: cancelAll };
}
