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
const {readJSONAsync, tryFn} = require('./utils');

let Gda = null;
tryFn(function() {
  Gda = imports.gi.Gda;
});

const readFirefoxBookmarks = function(appInfo, profileDir) {
  let connection, bookmarks = [];

  let result;

  if (!connection) {
    tryFn(function() {
      connection = Gda.Connection.open_from_string(
        'SQLite', 'DB_DIR=' + profileDir + ';DB_NAME=places.sqlite',
        null, Gda.ConnectionOptions.READ_ONLY
      );
    });
  }

  tryFn(function() {
    result = connection.execute_select_command(
      'SELECT moz_bookmarks.title, moz_places.url FROM moz_bookmarks ' +
      'INNER JOIN moz_places ON (moz_bookmarks.fk = moz_places.id) ' +
      'WHERE moz_bookmarks.fk NOT NULL AND moz_bookmarks.title NOT ' +
      'NULL AND moz_bookmarks.type = 1'
    );
  });

  // Gda binding seems buggy on Ubuntu 18.04 with error:
  // "Unsupported type void, deriving from fundamental void"
  if (!result) return [];

  let nRows = result.get_n_rows();

  const handleMeta = function(result, row) {
    return tryFn(function() {
      return [
        result.get_value_at(0, row),
        result.get_value_at(1, row)
      ]
    }, () => [null, null]);
  }

  for (let row = 0; row < nRows; row++) {
    let [name, uri] = handleMeta(result, row);

    bookmarks.push({
      app: appInfo,
      name: name.replace(/\//g, '|'),
      score: 0,
      uri
    });
  }
  return bookmarks;
}

function readFirefoxProfiles(appSystem) {
  if (!Gda) return [];

  let profilesFile, profileDir, bookmarksFile;
  let foundApps = appSystem.lookup_desktop_wmclass('firefox');
  let appInfo = foundApps.get_app_info();
  let firefoxDir = GLib.build_filenamev([GLib.get_home_dir(), '.mozilla',
    'firefox'
  ]);
  if (!foundApps || foundApps.length === 0 || !Gda) {
    return [];
  }

  profilesFile = Gio.File.new_for_path(GLib.build_filenamev(
    [firefoxDir, 'profiles.ini']));

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

    if (profileName === 'default') {
      if (relative) {
        profileDir = GLib.build_filenamev([firefoxDir, path]);
      } else {
        profileDir = path;
      }

      bookmarksFile = Gio.File.new_for_path(
        GLib.build_filenamev([profileDir, 'places.sqlite']));

      if (bookmarksFile.query_exists(null)) {
        return readFirefoxBookmarks(appInfo, profileDir);
      }
    }
  }
  return [];
}

const readChromiumBookmarks = function(bookmarks, path = ['chromium', 'Default', 'Bookmarks'], wmClass = 'chromium-browser', appSystem) {
  let appInfo, bookmarksFile;

  let foundApps = appSystem.lookup_desktop_wmclass(path[0]);
  return new Promise(function(resolve, reject) {
    if (!foundApps || foundApps.length === 0) {
      foundApps = appSystem.lookup_desktop_wmclass(wmClass);
      if (!foundApps || foundApps.length === 0) {
        resolve(bookmarks);
      }
    }

    appInfo = foundApps.get_app_info();

    bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_config_dir(), ...path]));

    if (!bookmarksFile.query_exists(null)) {
      resolve(bookmarks);
    }

    readJSONAsync(bookmarksFile).then(function(jsonResult) {
      if (!jsonResult.hasOwnProperty('roots')) {
        resolve(bookmarks);
      }

      let recurseBookmarks = (children, cont)=>{
        for (let i = 0, len = children.length; i < len; i++) {
          if (children[i].type == 'url') {
            bookmarks.push({
              app: appInfo,
              name: children[i].name,
              score: 0,
              uri: children[i].url
            });
          } else if (children[i].hasOwnProperty('children')) {
            recurseBookmarks(children[i].children);
          }
        }
      };

      for (let bookmarkLocation in jsonResult.roots) {
        let children = jsonResult.roots[bookmarkLocation].children;
        if (children === undefined) {
          continue;
        }
        recurseBookmarks(children);
      }
      resolve(bookmarks)
    }).catch(() => resolve(bookmarks));
  });
}

module.exports = {readChromiumBookmarks, readFirefoxProfiles, Gda};