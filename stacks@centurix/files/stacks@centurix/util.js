const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

function objectSniff(object_sniff) {
	let keys = Object.keys(object_sniff);
	for (var i = 0; i < keys.length; i++) {
		global.log(keys[i]);
	}
}

function resolveHome(path) {
	path = path.replace('file://', '');
	let home = GLib.get_home_dir();
	return path.replace('~', home);
}
