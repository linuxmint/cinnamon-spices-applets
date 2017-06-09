const GLib = imports.gi.GLib;

function objectSniff(object_sniff) {
	var keys = Object.keys(object_sniff);
	for (var i=0; i < keys.length; i++) {
		global.log(keys[i]);
	}
}

function resolveHome(path) {
	path = path.replace('file://', '');
	home = GLib.get_home_dir();
	return path.replace('~', home);
}
