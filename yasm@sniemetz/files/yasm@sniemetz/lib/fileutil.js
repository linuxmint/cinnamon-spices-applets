const GLib     = imports.gi.GLib;
const Gio      = imports.gi.Gio;
const ByteArray = imports.byteArray;

function readFile(path) {
  try {
    const [ok, bytes] = GLib.file_get_contents(path);
    if (!ok) return null;
    return ByteArray.toString(bytes);
  } catch(e) {
    return null;
  }
}

function appendFile(path, text) {
  try {
    const file   = Gio.File.new_for_path(path);
    const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
    stream.write_all(ByteArray.fromString(text), null);
    stream.close(null);
  } catch(e) {}
}

function writeFile(path, text) {
  try { GLib.file_set_contents(path, text); } catch(e) {}
}

function ensureDir(path) {
  try { Gio.File.new_for_path(path).make_directory_with_parents(null); } catch(e) {}
}

function spawnAsync(argv, callback) {
  try {
    const proc = Gio.Subprocess.new(
      argv,
      Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
    );
    proc.communicate_utf8_async(null, null, (p, res) => {
      try {
        const [, stdout] = p.communicate_utf8_finish(res);
        callback(stdout || null);
      } catch(e) {
        callback(null);
      }
    });
  } catch(e) {
    callback(null);
  }
}
