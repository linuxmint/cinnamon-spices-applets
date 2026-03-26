//!/usr/bin/cjs
const  GLib = imports.gi.GLib;

/**
 * _sourceIds
 * Array containing IDs of all looping loops.
 */
var _sourceIds = [];

/**
 * timeout_add_seconds
 *
 * @callback (function) is executed every @sec (number) seconds
 * with @params (dictionnary as {'key1': value1, 'key2': value2, ...}).
 *
 * @params is often null.
 *
 */
function timeout_add_seconds(sec, callback, params=null) {
  let id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, sec, callback);
  if (id && (_sourceIds.indexOf(id) === -1)) _sourceIds.push(id);
  return id;
}

/**
 * timeout_add_seconds
 *
 * @callback (function) is executed every @ms (number) milliseconds
 * with @params (dictionnary as {'key1': value1, 'key2': value2, ...}).
 *
 * @params is often null.
 *
 */
function timeout_add(ms, callback, params=null) {
  let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, callback);
  if (id && (_sourceIds.indexOf(id) === -1)) _sourceIds.push(id);
  return id;
}

/**
 * setTimeout:
 * @callback (function): Function to call at the end of the timeout.
 * @ms (number): Milliseconds until the timeout expires.
 *
 * Convenience wrapper for a Mainloop.timeout_add loop that
 * returns false.
 *
 * Returns (number): The ID of the loop.
 */
function setTimeout(callback, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }

    let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
      ms,
      () => {
        callback.call(null, ...args);
        return false; // Stop repeating
      }
    );

    if (id && (_sourceIds.indexOf(id) === -1)) _sourceIds.push(id);

    return id;
}

/**
 * clearTimeout:
 * @id (number): The ID of the loop to remove.
 *
 * Convenience wrapper for Mainloop.source_remove.
 */
function clearTimeout(id) {
    if (id) {
      source_remove(id);
    }
}


/**
 * setInterval:
 * @callback (function): Function to call on every interval.
 * @ms (number): Milliseconds between invocations.
 *
 * Convenience wrapper for a Mainloop.timeout_add loop that
 * returns true.
 *
 * Returns (number): The ID of the loop.
 */
function setInterval(callback, ms) {
    let args = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }

    let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        callback.call(null, ...args);
        return true; // Repeat
    });

    if (id && (_sourceIds.indexOf(id) === -1)) _sourceIds.push(id);

    return id;
}

/**
 * clearInterval:
 * @id (number): The ID of the loop to remove.
 *
 * Convenience wrapper for Mainloop.source_remove.
 */
function clearInterval(id) {
    if (id) {
      source_remove(id);
    }
};

/**
 * source_exists
 *
 * @id (number, or null)
 *
 * Checks if @id is well the ID of a loop.
 *
 */
function source_exists(id) {
  let _id = id;
  if (!_id) return false;
  return (GLib.MainContext.default().find_source_by_id(_id) != null);
}

/**
 * source_remove
 *
 * @id (number): The ID of the loop to stop.
 * @remove_from_sourceIds (boolean): *true* (by default) when we want to
 * remove @id from _sourceIds. May be *false* for internal functionning.
 *
 * Convenience wrapper for a Mainloop.source_remove(id) that returns a
 * boolean.
 */
function source_remove(id, remove_from_sourceIds=true) {
  if (source_exists(id)) {
    GLib.source_remove(id);
    if (remove_from_sourceIds) {
      const pos = _sourceIds.indexOf(id);
      if (pos > -1) _sourceIds.splice(pos, 1);
    }
    return true;
  }
  return false;
}

/**
 * remove_all_sources
 *
 * Execute it when removing the spice.
 * Tries to delete all remaining sources, in order to remove all loops.
 */
function remove_all_sources() {
  while (_sourceIds.length > 0) {
    let id = _sourceIds.pop();
    source_remove(id, false);
  }
}

module.exports = {
  _sourceIds,
  timeout_add_seconds,
  timeout_add,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  source_exists,
  source_remove,
  remove_all_sources
}
