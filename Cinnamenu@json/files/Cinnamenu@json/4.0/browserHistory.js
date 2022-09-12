
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;
const {getChromiumProfileDirs} = require('./utils');

var current_pattern;

function searchBrowserProfile(path, appInfo, pattern) {
    return new Promise(function(resolve, reject) {
        const full_path = GLib.build_filenamev([GLib.get_user_config_dir()].concat(path));
        if (!GLib.file_test(full_path + '/History', GLib.FileTest.EXISTS)) {
            resolve([]);
            return;
        }

        Util.spawn_async([__meta.path + '/searchHistory.py', full_path, pattern], (results) => {
            if (pattern == current_pattern) {
                results = JSON.parse(results);
                results.forEach( result => {
                    result.app = appInfo;
                    if (!result.icon_filename) {//Use browser icon if no favicon available
                        result.gicon = appInfo.get_icon();
                    }
                    result.isSearchResult = true;
                    result.deleteAfterUse = true;
                    result.activate = () => Util.spawn(['xdg-open', result.uri]);
                });
                resolve(results);
            }
            resolve([]);
        });
    });
}

function searchBrowserHistory(pattern, callback) {
    current_pattern = pattern;
    const promises = [];
    let history = [];

    getChromiumProfileDirs().forEach( profilePath => {
        const path = profilePath[0];
        const appInfo = profilePath[1];

        const full_path = GLib.build_filenamev([GLib.get_user_config_dir()].concat(path));
        if (!GLib.file_test(full_path + '/History', GLib.FileTest.EXISTS)) {
            return;
        }
        promises.push(searchBrowserProfile(path, appInfo, pattern));
    });

    Promise.all(promises).then( results => {
        results.forEach( result => history = history.concat(result));
        if (history.length > 12) {
            history.length = 12;
        }
        callback(history);
    });

}


module.exports = {searchBrowserHistory};
