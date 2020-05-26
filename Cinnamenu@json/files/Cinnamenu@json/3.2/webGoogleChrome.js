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
// External imports
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;

const _appSystem = Cinnamon.AppSystem.get_default();
const _foundApps = _appSystem.lookup_desktop_wmclass('google-chrome');

var _appInfo = null;
var _bookmarksFile = null;
var bookmarks = [];

function _readBookmarks() {
  bookmarks = [];
  if (!_foundApps || _foundApps.length === 0) {
    return [];
  }

  _appInfo = _foundApps.get_app_info();

  _bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev(
    [GLib.get_user_config_dir(), 'google-chrome', 'Default', 'Bookmarks']));

  if (!_bookmarksFile.query_exists(null)) {
    return [];
  }

  let content;
  let jsonResult;
  let success;

  try {
    [success, content] = _bookmarksFile.load_contents(null);
  } catch (e) {
    return [];
  }

  if (!success) {
    return [];
  }

  try {
    jsonResult = JSON.parse(content);
  } catch (e) {
    return [];
  }

  if (!jsonResult.hasOwnProperty('roots')) {
    return [];
  }

  let recurseBookmarks = (children, cont)=>{
    for (let i = 0, len = children.length; i < len; i++) {
      if (children[i].type === 'url') {
        bookmarks.push({
          appInfo: _appInfo,
          name: children[i].name.replace(/\//g, '|'),
          score: 0,
          uri: children[i].url
        });
      } else if (children[i].hasOwnProperty('children')) {
        recurseBookmarks(children[i].children);
      }
    }
  };

  let rootKeys = Object.keys(jsonResult.roots);
  for (let i = 0, len = rootKeys.length; i < len; i++) {
    let children = jsonResult.roots[rootKeys[i]].children;
    if (children === undefined) {
      continue;
    }
    recurseBookmarks(children);
  }
  return bookmarks;
}

function _reset() {
  _appInfo = null;
  _bookmarksFile = null;
  bookmarks = [];
}