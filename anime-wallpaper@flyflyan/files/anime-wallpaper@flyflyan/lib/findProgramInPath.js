const Cinnamon = imports.gi.Cinnamon;

/* Look up @program in PATH without touching the main loop.
 *
 * Cinnamon 6.8 added the asynchronous Cinnamon.find_program_in_path(), whose
 * callback receives the full path or null when the program is not installed.
 * Older versions have no asynchronous equivalent, and the synchronous GLib
 * helper would stat-walk PATH on the UI thread, so the callback then gets
 * undefined: "unknown - just try the program and see".
 */
function find_program_in_path(program, callback) {
    if (Cinnamon.find_program_in_path) {
        Cinnamon.find_program_in_path(program, (path) => callback(path || null));
        return;
    }
    callback(undefined);
}
