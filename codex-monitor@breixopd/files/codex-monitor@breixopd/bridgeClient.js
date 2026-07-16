'use strict';

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const ByteArray = imports.byteArray;

var BridgeClient = class BridgeClient {
  constructor(options) {
    this._options = options;
    this._pending = new Map();
    this._sequence = 0;
    this._process = null;
    this._running = false;
    this._reader = null;
    this._writer = null;
    this._writeState = null;
  }

  start() {
    this.stop();
    const flags = Gio.SubprocessFlags.STDIN_PIPE |
      Gio.SubprocessFlags.STDOUT_PIPE |
      Gio.SubprocessFlags.STDERR_SILENCE;
    const launcher = Gio.SubprocessLauncher.new(flags);
    if (this._options.codexHome)
      launcher.setenv('CODEX_HOME', this._options.codexHome, true);
    const argv = [
      'python3',
      GLib.build_filenamev([this._options.appletPath, 'helper', 'bridge.py']),
      '--codex', this._options.codexBinary || 'codex',
      '--history-days', String(this._options.historyDays || 30),
    ];
    if (this._options.codexHome)
      argv.push('--codex-home', this._options.codexHome);

    this._process = launcher.spawnv(argv);
    this._running = true;
    this._reader = new Gio.DataInputStream({
      base_stream: this._process.get_stdout_pipe(),
    });
    this._writer = new Gio.DataOutputStream({
      base_stream: this._process.get_stdin_pipe(),
    });
    this._writeState = {
      writer: this._writer,
      cancellable: new Gio.Cancellable(),
      queue: [],
      current: null,
      currentChunk: null,
      writing: false,
      stopping: false,
      closing: false,
    };
    this._readNextLine();
  }

  request(action, params, callback) {
    if (!this._process || !this._running) {
      callback(new Error('Codex bridge is not running'));
      return;
    }
    this._sequence += 1;
    const id = `cinnamon-${Date.now()}-${this._sequence}`;
    const timeoutSeconds = action === 'remote_repair' ? 120 : 30;
    const timeoutId = Mainloop.timeout_add_seconds(timeoutSeconds, () => {
      const pending = this._pending.get(id);
      if (pending) {
        this._pending.delete(id);
        pending.callback(new Error('Codex bridge timed out'));
      }
      return GLib.SOURCE_REMOVE;
    });
    this._pending.set(id, { callback, timeoutId });

    const state = this._writeState;
    try {
      const payload = JSON.stringify({ id, action, params: params || {} }) + '\n';
      state.queue.push({
        id,
        bytes: GLib.Bytes.new(ByteArray.fromString(payload)),
        offset: 0,
      });
      this._writeNext(state);
    } catch (error) {
      Mainloop.source_remove(timeoutId);
      this._pending.delete(id);
      callback(new Error('Unable to write to Codex bridge'));
    }
  }

  stop() {
    const process = this._process;
    const writeState = this._writeState;
    for (const pending of this._pending.values()) {
      Mainloop.source_remove(pending.timeoutId);
      pending.callback(new Error('Codex bridge stopped'));
    }
    this._pending.clear();
    if (writeState) {
      writeState.stopping = true;
      writeState.queue.length = 0;
      writeState.cancellable.cancel();
      if (!writeState.writing)
        this._closeWriter(writeState);
    }
    if (process)
      this._waitForExit(process);
    this._running = false;
    this._process = null;
    this._reader = null;
    this._writer = null;
    this._writeState = null;
  }

  _writeNext(state) {
    if (state.stopping || state.writing)
      return;
    while (state.queue.length && !this._pending.has(state.queue[0].id))
      state.queue.shift();
    if (!state.queue.length)
      return;

    const item = state.queue.shift();
    state.current = item;
    state.writing = true;
    this._writeCurrent(state);
  }

  _writeCurrent(state) {
    const item = state.current;
    const total = item.bytes.get_size();
    const remaining = total - item.offset;
    state.currentChunk = item.offset === 0
      ? item.bytes
      : GLib.Bytes.new(item.bytes.get_data().slice(item.offset));
    try {
      state.writer.write_bytes_async(
        state.currentChunk,
        GLib.PRIORITY_DEFAULT,
        state.cancellable,
        (stream, result) => {
          let written = 0;
          try {
            written = stream.write_bytes_finish(result);
          } catch (error) {
            written = 0;
          }
          state.currentChunk = null;
          if (state.stopping) {
            state.current = null;
            state.writing = false;
            this._closeWriter(state);
            return;
          }
          if (!Number.isInteger(written) || written <= 0 || written > remaining) {
            state.current = null;
            state.writing = false;
            this._failPending('Unable to write to Codex bridge');
            this.stop();
            return;
          }
          item.offset += written;
          if (item.offset < total) {
            this._writeCurrent(state);
            return;
          }
          state.current = null;
          state.writing = false;
          this._writeNext(state);
        }
      );
    } catch (error) {
      state.currentChunk = null;
      state.current = null;
      state.writing = false;
      this._failPending('Unable to write to Codex bridge');
      this.stop();
    }
  }

  _closeWriter(state) {
    if (state.closing)
      return;
    state.closing = true;
    try {
      state.writer.close_async(GLib.PRIORITY_DEFAULT, null, (stream, result) => {
        try {
          stream.close_finish(result);
        } catch (error) {
          // The helper may already have closed its pipe.
        }
      });
    } catch (error) {
      // The helper may already have closed its pipe.
    }
  }

  _waitForExit(process) {
    let forceTimer = Mainloop.timeout_add_seconds(5, () => {
      forceTimer = 0;
      try {
        process.force_exit();
      } catch (error) {
        // The helper may already have exited.
      }
      return GLib.SOURCE_REMOVE;
    });
    try {
      process.wait_async(null, (_source, result) => {
        try {
          process.wait_finish(result);
        } catch (error) {
          // The helper may have been force-closed after the grace period.
        }
        if (forceTimer) {
          Mainloop.source_remove(forceTimer);
          forceTimer = 0;
        }
      });
    } catch (error) {
      if (forceTimer) {
        Mainloop.source_remove(forceTimer);
        forceTimer = 0;
      }
      try {
        process.force_exit();
      } catch (forceError) {
        // The helper already exited before the wait could be registered.
      }
    }
  }

  _readNextLine() {
    if (!this._reader)
      return;
    this._reader.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, result) => {
      let line = null;
      try {
        [line] = stream.read_line_finish_utf8(result);
      } catch (error) {
        this._failPending('Codex bridge read failed');
        return;
      }
      if (line === null) {
        this._running = false;
        this._failPending('Codex bridge exited');
        return;
      }
      this._handleLine(line);
      this._readNextLine();
    });
  }

  _handleLine(line) {
    let response;
    try {
      response = JSON.parse(line);
    } catch (error) {
      return;
    }
    const pending = this._pending.get(response.id);
    if (!pending)
      return;
    Mainloop.source_remove(pending.timeoutId);
    this._pending.delete(response.id);
    if (response.ok)
      pending.callback(null, response.data);
    else {
      const error = new Error(
        response.error && response.error.message || 'Codex request failed'
      );
      if (response.error && typeof response.error.code === 'string' &&
          /^[A-Z_]{1,64}$/.test(response.error.code))
        error.code = response.error.code;
      pending.callback(error);
    }
  }

  _failPending(message) {
    this._running = false;
    for (const pending of this._pending.values()) {
      Mainloop.source_remove(pending.timeoutId);
      pending.callback(new Error(message));
    }
    this._pending.clear();
  }
};
