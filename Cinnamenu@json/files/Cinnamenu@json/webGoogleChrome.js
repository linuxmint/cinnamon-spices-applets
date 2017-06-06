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

// Gjs imports
const Lang = imports.lang;

const _appSystem = Cinnamon.AppSystem.get_default();
const _foundApps = _appSystem.lookup_desktop_wmclass('google-chrome');

var _appInfo = null;
var _bookmarksFile = null;
var _bookmarksMonitor = null;
var _callbackId = null;
var bookmarks = [];

function _readBookmarks() {
  bookmarks = [];

  let content;
  let jsonResult;
  let size;
  let success;

  try {
    [success, content, size] = _bookmarksFile.load_contents(null);
  } catch (e) {
    log("ERROR: " + e.message);
    return;
  }

  if (!success) {
    return;
  }

  try {
    jsonResult = JSON.parse(content);
  } catch (e) {
    log("ERROR: " + e.message);
    return;
  }

  if (!jsonResult.hasOwnProperty('roots')) {
    return;
  }

  let recurseBookmarks = (children, cont)=>{
    for (let i = 0, len = children.length; i < len; i++) {
      if (children[i].type == 'url') {
        bookmarks.push({
          appInfo: _appInfo,
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
}

function _reset() {
  _appInfo = null;
  _bookmarksFile = null;
  _bookmarksMonitor = null;
  _callbackId = null;
  bookmarks = [];
}

function init() {
  if (!_foundApps || _foundApps.length === 0) {
    return;
  }

  _appInfo = _foundApps.get_app_info();

  _bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev(
    [GLib.get_user_config_dir(), 'google-chrome', 'Default', 'Bookmarks']));

  if (!_bookmarksFile.query_exists(null)) {
    _reset();
    return;
  }

  _bookmarksMonitor = _bookmarksFile.monitor_file(
    Gio.FileMonitorFlags.NONE, null);
  _callbackId = _bookmarksMonitor.connect(
    'changed', Lang.bind(this, _readBookmarks));

  _readBookmarks();
}

function deinit() {
  if (_bookmarksMonitor) {
    if (_callbackId) {
      _bookmarksMonitor.disconnect(_callbackId);
    }

    _bookmarksMonitor.cancel();
  }

  _reset();
}