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
try {
  var Gda = imports.gi.Gda;
} catch (e) {
  var Gda = null;
}

// External imports
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;

// Gjs imports
const Lang = imports.lang;

const _appSystem = Cinnamon.AppSystem.get_default();
//const _foundApps = _appSystem.initial_search(['midori']);
const _foundApps = _appSystem.lookup_desktop_wmclass('midori');
const _midoriDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'midori']);

var _appInfo = null;
var _bookmarksFile = null;
var _bookmarksMonitor = null;
var _callbackId = null;
var _connection = null;
var bookmarks = [];

function _readBookmarks() {
  bookmarks = [];

  let result;

  if (!_connection) {
    try {
      _connection = Gda.Connection.open_from_string(
        'SQLite', 'DB_DIR=' + _midoriDir + ';DB_NAME=bookmarks', null,
        Gda.ConnectionOptions.READ_ONLY);
    } catch (e) {
      global.logError('ERROR: ' + e.message);
      return;
    }
  }

  try {
    result = _connection.execute_select_command(
      'SELECT title, uri FROM bookmarks');
  } catch (e) {
    global.logError('ERROR: ' + e.message);
    return;
  }

  let nRows = result.get_n_rows();

  for (let row = 0; row < nRows; row++) {
    let name;
    let uri;

    try {
      name = result.get_value_at(0, row);
      uri = result.get_value_at(1, row);
    } catch (e) {
      global.logError('ERROR: ' + e.message);
      continue;
    }

    bookmarks.push({
      appInfo: _appInfo,
      name: name,
      score: 0,
      uri: uri
    });
  }
}

function _reset() {
  if (_connection) {
    _connection.close();
  }

  _appInfo = null;
  _bookmarksFile = null;
  _bookmarksMonitor = null;
  _callbackId = null;
  _connection = null;
  bookmarks = [];
}

function init() {
  if (!Gda) {
    return;
  }

  if (!_foundApps || _foundApps.length === 0) {
    return;
  }

  //_appInfo = _foundApps[0].get_app_info();
  _appInfo = _foundApps.get_app_info();

  _bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev(
    [_midoriDir, 'bookmarks.db']));

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