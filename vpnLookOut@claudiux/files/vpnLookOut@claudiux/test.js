

const GLib = imports.gi.GLib; // ++ Needed for starting programs and translations
const Gio = imports.gi.Gio; // Needed for file infos


let poPath = "~/.local/share/cinnamon/applets/vpnLookOut@claudiux/po";

let poDir = Gio.file_new_for_path(poPath);

let poList = poDir.list('*.po');

GLib.spawn_command_line_async('sh -c echo "'+ poList + '" >> /tmp/poList.txt');
