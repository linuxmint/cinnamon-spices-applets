const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Extension = imports.ui.extension;

/**
 * Looks for a program in PATH. Never blocks.
 * Cinnamon 6.8+ provides Cinnamon.find_program_in_path(), which is asynchronous:
 * it takes a callback and returns nothing. Older versions fall back to GLib.
 * @param {string} program - Name of the program.
 * @returns {Promise<string|null>} Resolves with the full path, or null if not found.
 */
function find_program_in_path(program) {
    return new Promise((resolve) => {
        if (Cinnamon.find_program_in_path) {
            Cinnamon.find_program_in_path(program, (path) => resolve(path));
        } else {
            resolve(GLib.find_program_in_path(program));
        }
    });
}

if (!Extension.getCurrentExtension) {
    module.exports = { find_program_in_path };
}
