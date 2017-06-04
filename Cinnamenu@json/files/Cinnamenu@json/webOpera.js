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
//const _foundApps = _appSystem.initial_search(['opera']);
const _foundApps = _appSystem.lookup_desktop_wmclass('opera');

var initialized = false;

var _appInfo = null;
var _bookmarksFile = null;
var _bookmarksMonitor = null;
var _callbackId = null;
var bookmarks = [];

function _readBookmarks() {
  bookmarks = [];

  let content;
  let size;
  let success;

  try {
    [success, content, size] = _bookmarksFile.load_contents(null);
  } catch (e) {
    global.logError('ERROR: ' + e.message);
    return;
  }

  if (!success) {
    return;
  }

  let lines = String(content).split('\n');

  let isURL = false;
  let name = null;
  let url = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line == '#URL') {
      isURL = true;
    } else {
      if (isURL) {
        if (line.indexOf('NAME=') === 0) {
          name = line.split('NAME=')[1];
        } else if (line.indexOf('URL=') === 0) {
          url = line.split('URL=')[1];
        } else if (line.length === 0) {
          bookmarks.push({
            appInfo: _appInfo,
            name: name,
            score: 0,
            uri: url
          });

          isURL = false;
          name = null;
          url = null;
        }
      }
    }
  }
  return bookmarks;
}

function _reset() {
  _appInfo = null;
  _bookmarksFile = null;
  _bookmarksMonitor = null;
  _callbackId = null;
  bookmarks = [];
}

function init(cb) {
  if (!_foundApps || _foundApps.length === 0) {
    return;
  }

  //_appInfo = _foundApps[0].get_app_info();
  _appInfo = _foundApps.get_app_info();

  _bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev(
    [GLib.get_home_dir(), '.opera', 'bookmarks.adr']));

  if (!_bookmarksFile.query_exists(null)) {
    _reset();
    return;
  }

  if (!initialized) {
    _bookmarksMonitor = _bookmarksFile.monitor_file(
      Gio.FileMonitorFlags.NONE, null);
    _callbackId = _bookmarksMonitor.connect('changed', ()=>{
      cb();
    });
  }

  initialized = true;
  return _readBookmarks();
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

module.exports = {
  init: init,
  deinit: deinit
};