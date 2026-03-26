//#!/usr/bin/gjs
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Gtk = imports.gi.Gtk;

function ProcessSpawnHandler(workingdir, childargs) {
  this._init(workingdir, childargs);
}
ProcessSpawnHandler.prototype = {

  _init: function(workingdir, childargs) {

    try {
      this.workingdir = workingdir;
      this.childargs = childargs;
      this.currentMessage = "";
      let [success, pid, stdin, stdout, stderr] =
      GLib.spawn_async_with_pipes(this.workingdir, this.childargs,
        null, /* envp */
        GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null /* child_setup */ );

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
      stderrStream.close(null);
      this._dataStdout = new Gio.DataInputStream({
        base_stream: this._stdout
      });

      this._readChildStdout();

      this._childWatch = GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid,
        Lang.bind(this, this._childFinished));

      this.isFinished = false;
      this.debugmode = false;

    } catch (e) {
      print("error while spawning child " + e);
    }
  },
  setDebugMode: function(dbgmode) {
    this.debugmode = dbgmode;
  },

  //spawnChild: function()
  //{
  //},

  destroy: function() {
    if (this._destroyed)
      return;

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
      if (line == '' && this._previousLine == '') {
        try {
          this._stdin.write('QUIT\n\n', null);
        } catch (e) {} /* ignore broken pipe errors */
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

    this._dataStdout.read_line_async(GLib.PRIORITY_DEFAULT, null, Lang.bind(this, function(stream, result) {

      let [line, len] = this._dataStdout.read_line_finish(result);
      if (line == null) {
        // end of file
        this._stdout.close(null);
        return;
      }
      this._childProcessLine(line.toString());
      if (this.debugmode)
        print(this.currentMessage);
      // try to read more!
      this._readChildStdout();
    }));
  },
  getCurrentMessage: function() {
    return this.currentMessage;
  },
  isChildFinished: function() {
    return this.isFinished;
  }
}