const  GLib = imports.gi.GLib;

function source_exists(id) {
  let _id = id;
  if (!_id) return false;
  return (GLib.MainContext.default().find_source_by_id(_id) != null);
}

function timeout_exists(id) {
  if (!id) return false;
  if (!id.source_id) return false;
  return (GLib.MainContext.default().find_source_by_id(id.source_id) != null);
}

function interval_exists(id) {
  return timeout_exists(id);
}
