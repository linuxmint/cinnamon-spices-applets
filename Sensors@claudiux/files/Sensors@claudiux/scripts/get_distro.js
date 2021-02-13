const osinfo = imports.gi.Libosinfo;

let osInfo = new osinfo.Os();

global.log(osInfo.get_distro());
