const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "directory-menu@torchipeppo";

/**
 * Normalize a URI path, converting ~ to home directory and ensuring file:// prefix
 */
function normalizeUri(path) {
    if (!path) path = GLib.get_home_dir();

    if (path[0] == "~") {
        path = GLib.get_home_dir() + path.slice(1);
    }

    if (!path.startsWith("file://")) {
        path = "file://" + path;
    }

    return path;
}
