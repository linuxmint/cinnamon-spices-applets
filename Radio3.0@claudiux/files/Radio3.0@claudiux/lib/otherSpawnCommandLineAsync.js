const GLib = imports.gi.GLib;
// Callback parameters: ok(Boolean), standart_output(String), standart_error(String), exit_status(Number)
const yetAnotherSpawnCommandLineAsync = function(commandLine, callback) {
    let success_, argv, pid, stdin, stdout, stderr;

    try {
        [success_, argv] = GLib.shell_parse_argv(commandLine);
        [success_, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
            null,
            argv,
            null,
            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
            null
        );
    } catch (e) {
        logError(e);
        callback(false);
        return;
    }

    GLib.close(stdin);
    let outUnixStream = new Gio.UnixInputStream({ fd: stdout, close_fd: true });
    let errUnixStream = new Gio.UnixInputStream({ fd: stderr, close_fd: true });
    let outDataStream = new Gio.DataInputStream({ base_stream: outUnixStream, close_base_stream: true });
    let errDataStream = new Gio.DataInputStream({ base_stream: errUnixStream, close_base_stream: true });

    let read = (dataStream, array) => {
        dataStream.read_line_async(GLib.PRIORITY_LOW, null, (dataStream, res) => {
            let [line, length_] = dataStream.read_line_finish_utf8(res);
            if (line !== null) {
                array.push(line);
                read(dataStream, array);
            } else {
                dataStream.close(null);
            }
        });
    };

    let outputs = [];
    let errors = [];

    read(outDataStream, outputs);
    read(errDataStream, errors);

    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (pid, status) => {
        GLib.spawn_close_pid(pid);
        callback(true, outputs.join('\n'), errors.join('\n'), status);
    });
};
