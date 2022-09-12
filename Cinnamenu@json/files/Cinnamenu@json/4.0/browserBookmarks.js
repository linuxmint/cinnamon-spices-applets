/* ========================================================================================================
 *  CREDITS:  Code borrowed from SearchBookmarks extension by bmh1980
 *            at https://extensions.gnome.org/extension/557/search-bookmarks/
 * ========================================================================================================
 */
/**
 * Copyright (C) 2012 Marcus Habermehl <bmh1980de@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301,
 * USA.
 */
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const Cinnamon = imports.gi.Cinnamon;
const Util = imports.misc.util;
const {getChromiumProfileDirs} = require('./utils');

let Gda = null;
try {
    Gda = imports.gi.Gda;
} catch(e) {}

const readFileAsync = function(file, opts = {utf8: true}) {
    const {utf8} = opts;
    return new Promise(function(resolve, reject) {
        if (typeof file === 'string' || file instanceof String) {
            file = Gio.File.new_for_path(file);
        }
        if (!file.query_exists(null)) reject(new Error('File does not exist.'));
        file.load_contents_async(null, function(object, result) {
            try {
                let [success, data] = file.load_contents_finish(result);
                if (!success) return reject(new Error('File cannot be read.'));
                if (utf8) {
                    if (data instanceof Uint8Array) data = ByteArray.toString(data);
                    else data = data.toString();
                }
                resolve(data);
            } catch(e) {
                reject(e);
            }
        });
    });
};

const readJSONAsync = function(file) {
    return readFileAsync(file).then(function(json) {
        return JSON.parse(json);
    });
};

const readFirefoxBookmarks = function(appInfo, profileDir) {
    let connection, bookmarks = [];

    let result;

    if (!connection) {
        try {
            connection = Gda.Connection.open_from_string(
                            'SQLite', 'DB_DIR=' + profileDir + ';DB_NAME=places.sqlite',
                            null, Gda.ConnectionOptions.READ_ONLY);
        } catch(e) {}
    }

    try {
        result = connection.execute_select_command(
            'SELECT moz_bookmarks.title, moz_places.url FROM moz_bookmarks ' +
            'INNER JOIN moz_places ON (moz_bookmarks.fk = moz_places.id) ' +
            'WHERE moz_bookmarks.fk NOT NULL AND moz_bookmarks.title NOT ' +
            'NULL AND moz_bookmarks.type = 1'
        );
    } catch(e) {}

    // Gda binding seems buggy on Ubuntu 18.04 with error:
    // "Unsupported type void, deriving from fundamental void"
    if (!result) return [];

    let nRows = result.get_n_rows();

    const handleMeta = function(result, row) {
        try {
            return [result.get_value_at(0, row),
                    result.get_value_at(1, row)];
        } catch(e) {
            return [null, null];
        }
    };

    for (let row = 0; row < nRows; row++) {
        let [name, uri] = handleMeta(result, row);

        bookmarks.push({
            app: appInfo,
            name: name.replace(/\//g, '|'),
            uri: uri
        });
    }
    return bookmarks;
};

function readFirefoxProfiles() {
    if (!Gda) return [];

    let profilesFile, profileDir, bookmarksFile;
    let foundApps = Cinnamon.AppSystem.get_default().lookup_desktop_wmclass('firefox');
    let appInfo = foundApps.get_app_info();
    let firefoxDir = GLib.build_filenamev([GLib.get_home_dir(), '.mozilla', 'firefox']);
    if (!foundApps || foundApps.length === 0) {
        return [];
    }

    profilesFile = Gio.File.new_for_path(GLib.build_filenamev([firefoxDir, 'profiles.ini']));

    if (!profilesFile.query_exists(null)) {
        return [];
    }
    let groups;
    let nGroups;

    let keyFile = new GLib.KeyFile();

    keyFile.load_from_file(profilesFile.get_path(), GLib.KeyFileFlags.NONE);

    [groups, nGroups] = keyFile.get_groups();

    for (let i = 0; i < nGroups; i++) {
        let path;
        let profileName;
        let relative;

        try {
            profileName = keyFile.get_string(groups[i], 'Name');
            path = keyFile.get_string(groups[i], 'Path');
            relative = keyFile.get_boolean(groups[i], 'IsRelative');
        } catch (e) {
            continue;
        }

        if (profileName === 'default' || profileName === 'default-release') {
            if (relative) {
                profileDir = GLib.build_filenamev([firefoxDir, path]);
            } else {
                profileDir = path;
            }

            bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev([profileDir, 'places.sqlite']));

            if (bookmarksFile.query_exists(null)) {
                return readFirefoxBookmarks(appInfo, profileDir);
            }
        }
    }
    return [];
}

const readChromiumBookmarksFile = function(path, appInfo) {

    return new Promise(function(resolve, reject) {
        const foundBookmarks = [];

        const bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev(
                                        [GLib.get_user_config_dir(), ...path, 'Bookmarks']));
        if (!bookmarksFile.query_exists(null)) {
            resolve([]);
            return;
        }

        readJSONAsync(bookmarksFile).then(function(jsonResult) {
            if (!jsonResult.hasOwnProperty('roots')) {
                resolve([]);
                return;
            }

            const recurseBookmarks = (children, cont) => {
                children.forEach( child => {
                    if (child.type == 'url') {
                        const url = child.url;
                        const domain = url.slice(0, url.indexOf('/', url.indexOf('://') + 3));
                        foundBookmarks.push({
                            app: appInfo,
                            name: child.name,
                            uri: url,
                            domain: domain
                        });
                    } else if (child.hasOwnProperty('children')) {
                        recurseBookmarks(child.children);
                    }
                });
            };

            for (let bookmarkLocation in jsonResult.roots) {
                const children = jsonResult.roots[bookmarkLocation].children;
                if (children === undefined) {
                    continue;
                }
                recurseBookmarks(children);
            }

            const faviconsFile = GLib.build_filenamev([GLib.get_user_config_dir(), ...path, 'Favicons']);
            const domains = [];
            foundBookmarks.forEach( bookmark => {
                domains.push(bookmark.domain);
            });
            const domainsJSON = JSON.stringify(domains);

            Util.spawn_async([__meta.path + '/getFavicons.py', faviconsFile, domainsJSON], (results) => {
                results = JSON.parse(results);
                foundBookmarks.forEach( bookmark => {
                    if (bookmark.domain in results) {
                        bookmark.icon_filename = results[bookmark.domain];
                    }
                });

                resolve(foundBookmarks);
            });
        });
    });
};

//=====================

class BookmarksManager {
    constructor() {
        this.bookmarks = [];
        const promises = [];

        getChromiumProfileDirs().forEach( profilePath => {
            const path = profilePath[0];
            const appInfo = profilePath[1];

            promises.push(readChromiumBookmarksFile(path, appInfo));
        });
        Promise.all(promises).then((results) => {
            results.forEach( result => this.bookmarks = this.bookmarks.concat(result));

            this.bookmarks = this.bookmarks.concat(readFirefoxProfiles());

            this.bookmarks.forEach( bookmark => {
                if (!bookmark.icon_filename){
                    bookmark.gicon = bookmark.app.get_icon();
                }
                let desc = bookmark.uri;
                if (desc.length > 150) {
                    desc = desc.slice(0, 150) + ' ...';
                }
                bookmark.description = desc;
                bookmark.isSearchResult = true;
                bookmark.activate = () => Util.spawn(['xdg-open', bookmark.uri]);
                //bookmark.activate = () => bookmak.app.launch_uris([bookmark.uri], null);
            });

            // Create a unique list of bookmarks across all browsers.
            const bm = {};
            this.bookmarks.forEach( bookmark => bm[bookmark.uri] = bookmark );
            this.bookmarks = [];
            Object.keys(bm).forEach( key => this.bookmarks.push(bm[key]) );

            this.bookmarks.sort( (a, b) => { return (a.name.toUpperCase() > b.name.toUpperCase()) ?
                                                1 : (a.name.toUpperCase() < b.name.toUpperCase()) ? -1 : 0;  });

        }).catch((e) => global.logError(e.message, e.stack));
    }
}

module.exports = {BookmarksManager};
