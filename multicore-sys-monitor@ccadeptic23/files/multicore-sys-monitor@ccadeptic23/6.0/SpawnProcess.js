//#!/usr/bin/gjs
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

let tryFn, to_string;
if (typeof require !== 'undefined') {
  tryFn = require('./utils').tryFn;
  to_string = require('./tostring').to_string
} else {
  const AppletDir = imports.ui.appletManager.applets['multicore-sys-monitor@ccadeptic23'];
  tryFn = AppletDir.utils.tryFn;
  to_string = AppletDir.tostring.to_string
}

function ProcessSpawnHandler(workingdir, childargs) {
  this._init(workingdir, childargs);
}
ProcessSpawnHandler.prototype = {
  _init: function(workingdir, childargs) {
    this.workingdir = workingdir;
    this.childargs = childargs;
    this.currentMessage = '';
    let [success, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
      this.workingdir,
      this.childargs,
      null,
      GLib.SpawnFlags.DO_NOT_REAP_CHILD | GLib.SpawnFlags.SEARCH_PATH,
      null
    );

    this._childPid = pid;
    this._stdin = new Gio.UnixOutputStream({
      fd: stdin,
      close_fd: true
    });
    this._stdout = new Gio.UnixInputStream({
      fd: stdout,
      close_fd: true
    });

    // We need this one too, even if don't actually care of what the process
    // has to say on stderr, because otherwise the fd opened by g_spawn_async_with_pipes
    // is kept open indefinitely
    let stderrStream = new Gio.UnixInputStream({
      fd: stderr,
      close_fd: true
    });

    this._dataStdout = new Gio.DataInputStream({
      base_stream: this._stdout
    });

    this._readChildStdout();

    this._childWatch = GLib.child_watch_add(
      GLib.PRIORITY_DEFAULT,
      pid,
      Lang.bind(this, this._childFinished)
    );

    this.isFinished = false;
    this.debugmode = false;
  },

  setDebugMode: function(dbgmode) {
    this.debugmode = dbgmode;
  },

  destroy: function() {
    if (this._destroyed) {
      return;
    }

    GLib.source_remove(this._childWatch);

    this._stdin.close(null);
    // Stdout is closed when we finish reading from it
    this._destroyed = true;
  },

  _childFinished: function(pid, status, requestObj) {
    this.isFinished = true;
    this.destroy();
  },

  _childProcessLine: function(line) {
    if (this._previousLine != undefined) {
      // Two consecutive newlines mean that the child should be closed
      // (the actual newlines are eaten by Gio.DataInputStream)
      // Send a termination message
      if (line === '' && this._previousLine === '') {
        tryFn(() => {
          this._stdin.write('QUIT\n\n', null);
        }); /* ignore broken pipe errors */
      } else {
        this._previousLine = line;
        this.currentMessage = line.trim();
      }
    } else {
      this._previousLine = line;
      this.currentMessage = line.trim();
    }
  },

  _readChildStdout: function() {
    this._dataStdout.read_line_async(
      GLib.PRIORITY_DEFAULT,
      null,
      Lang.bind(this, function(stream, result) {
        let [line, len] = this._dataStdout.read_line_finish(result);
        if (line == null) {
          // end of file
          this._stdout.close(null);
          return;
        }
        this._childProcessLine(to_string(line));
        if (this.debugmode) {
          print(this.currentMessage);
        }
        // try to read more!
        this._readChildStdout();
      })
    );
  },
  getCurrentMessage: function() {
    return this.currentMessage;
  },
  isChildFinished: function() {
    return this.isFinished;
  }
};
