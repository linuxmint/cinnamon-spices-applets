const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;

function find_program_in_path(p, s=null) {
    if (Cinnamon.find_program_in_path) {
        return Cinnamon.find_program_in_path(p, () => {});
    } else {
        return GLib.find_program_in_path(p);
    }
}
