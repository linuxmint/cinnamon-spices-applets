
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;

var current_pattern;

function search_browser(path, wmClass, pattern) {
    current_pattern = pattern;
    return new Promise(function(resolve, reject) {
        const appSystem = Cinnamon.AppSystem.get_default();
        const foundApps = appSystem.lookup_desktop_wmclass(wmClass);
        if (!foundApps || foundApps.length === 0) {
            resolve([]);
            return;
        }
        const appInfo = foundApps.get_app_info();

        const full_path = GLib.get_user_config_dir() + '/' + path.join('/');
        if (!GLib.file_test(full_path + '/History', GLib.FileTest.EXISTS)) {
            resolve([]);
            return;
        }

        Util.spawn_async([__meta.path + '/searchHistory.py', full_path, pattern], (results) => {
            if (pattern == current_pattern) {
                results = JSON.parse(results);
                results.forEach( result => {
                    result.app = appInfo;
                    if (!result.icon_filename) {
                        result.gicon = appInfo.get_icon();
                    }
                    result.isSearchResult = true;
                    result.deleteAfterUse = true;
                    result.activate = () => Util.spawn(['xdg-open', result.uri]);
                });
                resolve(results);
            }
        });
    });
}

module.exports = {search_browser};
