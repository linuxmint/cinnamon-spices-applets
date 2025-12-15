const GLib = imports.gi.GLib;

function AlarmService(onChanged, onFire) {
  this._onChanged = onChanged;
  this._onFire = onFire;
  this._nextId = 1;
  this._alarms = new Map(); // id -> { id, dueMs, label, timerId }
}

AlarmService.prototype.list = function () {
  const out = Array.from(this._alarms.values()).map((a) => ({
    id: a.id,
    due: new Date(a.dueMs),
    label: a.label,
    showSeconds: !!a.showSeconds,
  }));
  out.sort((a, b) => a.due.getTime() - b.due.getTime());
  return out;
};

AlarmService.prototype.add = function (dueDate, label, showSeconds) {
  const dueMs = dueDate.getTime();
  const delayMs = Math.max(1, dueMs - Date.now());

  const id = this._nextId++;
  const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
    const alarm = this._alarms.get(id);
    if (!alarm) return GLib.SOURCE_REMOVE;

    this._alarms.delete(id);
    try {
      this._onFire({
        id,
        due: new Date(alarm.dueMs),
        label: alarm.label,
      });
    } finally {
      this._onChanged();
    }
    return GLib.SOURCE_REMOVE;
  });

  this._alarms.set(id, { id, dueMs, label, timerId, showSeconds: !!showSeconds });
  this._onChanged();
  return id;
};

AlarmService.prototype.remove = function (id) {
  const alarm = this._alarms.get(id);
  if (!alarm) return false;
  GLib.source_remove(alarm.timerId);
  this._alarms.delete(id);
  this._onChanged();
  return true;
};

AlarmService.prototype.destroy = function () {
  for (const alarm of this._alarms.values()) GLib.source_remove(alarm.timerId);
  this._alarms.clear();
  this._onChanged();
};

var AlarmService = AlarmService;
