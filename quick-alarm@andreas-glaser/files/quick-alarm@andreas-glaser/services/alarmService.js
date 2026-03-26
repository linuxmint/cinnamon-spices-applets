const GLib = imports.gi.GLib;
const Reconcile = imports.lib.alarmReconcile;

function AlarmService(onChanged, onFire, opts = {}) {
  this._onChanged = onChanged;
  this._onFire = onFire;
  this._onMissed = typeof opts.onMissed === "function" ? opts.onMissed : null;
  this._missedGraceMs = Math.max(0, Number(opts.missedGraceMs) || 2 * 60 * 1000);
  this._reconcileTickSeconds = Math.max(2, Number(opts.reconcileTickSeconds) || 10);
  this._glib = opts.glib || GLib;
  this._nowMs = typeof opts.nowMsFn === "function" ? opts.nowMsFn : () => Date.now();
  this._nextId = 1;
  this._alarms = new Map(); // id -> { id, dueMs, label, timerId }
  this._reconcileTimerId = 0;
  this._lastReconcileWallMs = 0;

  const autoStart = opts.autoStart === undefined ? true : !!opts.autoStart;
  if (autoStart) this._startReconcileLoop();
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

AlarmService.prototype._schedule = function (id, dueMs) {
  const delayMs = Math.max(1, dueMs - this._nowMs());
  return this._glib.timeout_add(this._glib.PRIORITY_DEFAULT, delayMs, () => {
    const alarm = this._alarms.get(id);
    if (!alarm) return this._glib.SOURCE_REMOVE;

    this._alarms.delete(id);
    try {
      this._onFire({
        id,
        due: new Date(alarm.dueMs),
        label: alarm.label,
        showSeconds: !!alarm.showSeconds,
      });
    } finally {
      this._onChanged();
    }
    return this._glib.SOURCE_REMOVE;
  });
};

AlarmService.prototype.add = function (dueDate, label, showSeconds) {
  const dueMs = dueDate.getTime();
  const id = this._nextId++;
  const timerId = this._schedule(id, dueMs);

  this._alarms.set(id, { id, dueMs, label, timerId, showSeconds: !!showSeconds });
  this._onChanged();
  return id;
};

AlarmService.prototype.remove = function (id) {
  const alarm = this._alarms.get(id);
  if (!alarm) return false;
  this._glib.source_remove(alarm.timerId);
  this._alarms.delete(id);
  this._onChanged();
  return true;
};

AlarmService.prototype._rescheduleAll = function () {
  for (const alarm of this._alarms.values()) {
    try {
      this._glib.source_remove(alarm.timerId);
    } catch (e) {
      // ignore
    }
    alarm.timerId = this._schedule(alarm.id, alarm.dueMs);
  }
};

AlarmService.prototype._reconcile = function () {
  const nowMs = this._nowMs();

  const intervalMs = this._reconcileTickSeconds * 1000;
  if (Reconcile.shouldRescheduleAfterTick({ lastTickMs: this._lastReconcileWallMs, nowMs, intervalMs })) {
    // If the wall clock jumped forward a lot (suspend/resume) the existing monotonic
    // timeout sources will drift; reschedule to match wall-clock again.
    this._rescheduleAll();
  }
  this._lastReconcileWallMs = nowMs;

  let changed = false;
  for (const [id, alarm] of this._alarms.entries()) {
    const state = Reconcile.classifyAlarmDueState({
      dueMs: alarm.dueMs,
      nowMs,
      graceMs: this._missedGraceMs,
    });
    if (state === "future") continue;

    changed = true;
    try {
      this._glib.source_remove(alarm.timerId);
    } catch (e) {
      // ignore
    }
    this._alarms.delete(id);

    const payload = {
      id,
      due: new Date(alarm.dueMs),
      label: alarm.label,
      showSeconds: !!alarm.showSeconds,
    };

    try {
      if (state === "due") this._onFire(payload);
      else if (this._onMissed) this._onMissed(payload);
    } catch (e) {
      // ignore
    }
  }

  if (changed) this._onChanged();
};

AlarmService.prototype.reconcileNow = function () {
  this._reconcile();
};

AlarmService.prototype._startReconcileLoop = function () {
  if (this._reconcileTimerId) return;
  this._lastReconcileWallMs = this._nowMs();
  this._reconcileTimerId = this._glib.timeout_add_seconds(
    this._glib.PRIORITY_DEFAULT,
    this._reconcileTickSeconds,
    () => {
      try {
        this._reconcile();
      } catch (e) {
        // ignore
      }
      return this._glib.SOURCE_CONTINUE;
    },
  );
};

AlarmService.prototype.destroy = function () {
  if (this._reconcileTimerId) this._glib.source_remove(this._reconcileTimerId);
  this._reconcileTimerId = 0;
  for (const alarm of this._alarms.values()) this._glib.source_remove(alarm.timerId);
  this._alarms.clear();
  this._onChanged();
};

var AlarmService = AlarmService;
