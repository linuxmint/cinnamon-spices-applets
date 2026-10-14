
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const {getChromiumProfileDirs} = require('./utils');

function searchBrowserProfile(appThis, currentSearchId, path, appInfo, pattern) {
    return new Promise(function(resolve, reject) {
        if (currentSearchId != appThis.currentSearchId) {
            resolve([]);
            return;
        }

        const full_path = GLib.build_filenamev([GLib.get_user_config_dir()].concat(path));
        if (!GLib.file_test(full_path + '/History', GLib.FileTest.EXISTS)) {
            resolve([]);
            return;
        }

        Util.spawn_async([__meta.path + '/searchHistory.py', full_path, pattern], (results) => {
            if (currentSearchId != appThis.currentSearchId) {
                resolve([]);
                return;
            }

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
        });
    });
}

function searchBrowserHistory(appThis, currentSearchId, pattern, callback) {
    if (currentSearchId != appThis.currentSearchId) {
        return;
    }

    const promises = [];
    let history = [];

    getChromiumProfileDirs().forEach( profilePath => {
        const path = profilePath[0];
        const appInfo = profilePath[1];

        const full_path = GLib.build_filenamev([GLib.get_user_config_dir()].concat(path));
        if (!GLib.file_test(full_path + '/History', GLib.FileTest.EXISTS)) {
            return;
        }
        promises.push(searchBrowserProfile(appThis, currentSearchId, path, appInfo, pattern));
    });

    Promise.all(promises).then( results => {
        results.forEach( result => history = history.concat(result));
        if (history.length > 20) {
            history.length = 20;
        }
        callback(history);
    });

}


module.exports = {searchBrowserHistory};
