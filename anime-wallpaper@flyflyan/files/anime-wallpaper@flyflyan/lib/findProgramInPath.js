const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;

/* Look up @program in PATH without doing synchronous I/O on the main loop.
 *
 * Cinnamon 6.8 added the asynchronous Cinnamon.find_program_in_path(); older
 * versions only ship the synchronous GLib helper, so those still use it. The
 * callback always receives the full path, or null when the program is not
 * installed.
 */
function find_program_in_path(program, callback) {
    if (Cinnamon.find_program_in_path) {
        Cinnamon.find_program_in_path(program, (path) => callback(path || null));
    } else {
        callback(GLib.find_program_in_path(program));
    }
}
