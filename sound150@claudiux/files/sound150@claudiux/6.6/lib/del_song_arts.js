//!/usr/bin/cjs
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const XDG_RUNTIME_DIR = GLib.getenv("XDG_RUNTIME_DIR");

function del_song_arts() {
    let paths = [XDG_RUNTIME_DIR+"/AlbumArt/song-art", XDG_RUNTIME_DIR+"/sound150/arts", XDG_RUNTIME_DIR+"/sound150/icons"];
    for (let dir_path of paths) {
        if (GLib.file_test(dir_path, GLib.FileTest.EXISTS)) {
            let dir = Gio.file_new_for_path(dir_path);
            let dir_children = dir.enumerate_children("standard::name,standard::type,standard::icon,time::modified", Gio.FileQueryInfoFlags.NONE, null);
            var file = dir_children.next_file(null);
            while (file != null) {
                let name = file.get_name();
                if (name.startsWith("R3SongArt")) {
                    let f = Gio.file_new_for_path(dir_path+"/"+name);
                    if (f.query_exists(null))
                        f.delete(null);
                }
                file = dir_children.next_file(null);
            }
            dir_children.close(null);
        }
    }
}

module.exports = {
    del_song_arts
}
