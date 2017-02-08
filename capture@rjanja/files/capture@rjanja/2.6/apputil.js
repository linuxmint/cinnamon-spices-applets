const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Params = imports.misc.params;
const Lang = imports.lang;


function Exec (cmd) {
  try {
    let success, argc, argv, pid, stdin, stdout, stderr;
    [success,argv] = GLib.shell_parse_argv(cmd);
    [success,pid,stdin,stdout,stderr] =
     GLib.spawn_async_with_pipes(null,argv,null,GLib.SpawnFlags.SEARCH_PATH,null,null);
  }
  catch (e)
  {
    global.log(e);
  }

  return true;
}

function TryExec (cmd, onStart, onFailure, onComplete, logger) {
  let success, argv, pid, in_fd, out_fd, err_fd;
  [success,argv] = GLib.shell_parse_argv(cmd);

  try {
    [success, pid, in_fd, out_fd, err_fd] = GLib.spawn_async_with_pipes(
      null,
      argv,
      null,
      GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
      null);
  }
  catch (e) {
    typeof logger == 'function' && logger("Failure creating process");
    typeof onFailure == 'function' && onFailure(cmd);
    return false;
  }
  if (success && pid != 0)
  {
    let out_reader = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({fd: out_fd}) });
    // Wait for answer
    typeof logger == 'function' && logger("Spawned process with pid=" + pid);
    typeof onStart == 'function' && onStart(pid);
    GLib.child_watch_add( GLib.PRIORITY_DEFAULT, pid,
    function(pid,status) {
       GLib.spawn_close_pid(pid);
       // global.log("Process completed, status=" + status);
       var [line, size, buf] = [null, 0, ""];
       while (([line, size] = out_reader.read_line(null)) != null && line != null) {
          buf += line;
       }
       if (buf.indexOf("Error during recording") > 0) {
          typeof onFailure == 'function' && onFailure(cmd);
       }
       else {
          typeof onComplete == 'function' && onComplete(status, buf);
       }
    });
  }
  else
  {
    typeof logger == 'function' && logger("Failed to spawn process");
    typeof onFailure == 'function' && onFailure(cmd);
  }

  return true;
}

function SpawnOpts(command, options) {
  let opts = Params.parse(options, {
    onSpawn: function(_){},
    onFailure: function(_){return false;},
    onComplete: function(_){},
    onLineOut: function(_){},
    logger: function(_){},
  });

  opts.logger('Running ' + command);
  let pid, stdin, stdout, stderr, stream, reader, success, argv;
  [success,argv] = GLib.shell_parse_argv(command);

  try {
    [res, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
      null, argv, null, GLib.SpawnFlags.SEARCH_PATH  | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);    
  }
  catch (e) {
    opts.logger("Failure creating process");
    return opts.onFailure(e);
  }

  if (res && pid != 0) {
    opts.logger("Spawned process with pid=" + pid);
    opts.onSpawn(pid);

    stream = new Gio.DataInputStream({ base_stream : new Gio.UnixInputStream({ fd : stdout }) });
    
    if (typeof opts.onLineOut == 'function') {
      this.read = function(stream, func) {
        stream.read_line_async(GLib.PRIORITY_LOW, null, Lang.bind(this, function(source, result) {
          let [out, length] = source.read_line_finish(result);
          if (out !== null) {
            this.read(source, func);
            func(out.toString());
          }
          return true;
        }));
      }
      this.read(stream, opts.onLineOut);
    }

    if (typeof opts.onComplete == 'function') {
      GLib.child_watch_add( GLib.PRIORITY_DEFAULT, pid, function(pid,status) {
        GLib.spawn_close_pid(pid);
        opts.logger("Process completed, status=" + status);
        if (typeof opts.onLineOut == 'function') {
          opts.onComplete(status, null);
        }
        else {
          var [line, size, buf] = [null, 0, ""];
          while (([line, size] = stream.read_line(null)) != null && line != null) {
            buf += line;
          }
          opts.onComplete(status, buf);
        }
      });
    }

    return true;
  }
  else {
    opts.logger("Failed to spawn process");
    return opts.onFailure();
  }
}