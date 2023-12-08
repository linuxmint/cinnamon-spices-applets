const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = 'multicore-sys-monitor@ccadeptic23';
// Translation support
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');
var _ = function(str) {
  return Gettext.dgettext(UUID, str);
}

var findIndex = function(arr, cb) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb(arr[i], i, arr)) {
      return i;
    }
  }
  return -1;
}

var map = function (arr, fn) {
  if (arr == null) {
    return [];
  }

  let len = arr.length;
  let out = Array(len);

  for (let i = 0; i < len; i++) {
    out[i] = fn(arr[i], i, arr);
  }

  return out;
}

var tryFn = function(fn, errCb) {
  try {
    return fn();
  } catch (e) {
    if (typeof errCb === 'function') {
      errCb(e);
    }
  }
}

var filter = function (arr, cb) {
  let result = [];
  for (let i = 0, len = arr.length; i < len; i++) {
    if (cb(arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }
  return result;
};
