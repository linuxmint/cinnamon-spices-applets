const GLib = imports.gi.GLib;
const Reconcile = imports.lib.alarmReconcile;
const Limits = imports.lib.alarmLimits;

const MAX_TIMER_DELAY_MS = 24 * 60 * 60 * 1000;

function AlarmService(onChanged, onFire, opts = {}) {
  this._onChanged = onChanged;
  this._onFire = onFire;
  this._onMissed = typeof opts.onMissed === "function" ? opts.onMissed : null;
  this._missedGraceMs =
    opts.missedGraceMs === undefined ? 2 * 60 * 1000 : Math.max(0, Number(opts.missedGraceMs) || 0);
  this._reconcileTickSeconds =
    opts.reconcileTickSeconds === undefined ? 10 : Math.max(2, Number(opts.reconcileTickSeconds) || 2);
  const requestedMaxAlarms = Number(opts.maxAlarms);
  this._maxAlarms = Number.isFinite(requestedMaxAlarms)
    ? Math.min(Limits.MAX_ALARMS, Math.max(1, Math.floor(requestedMaxAlarms)))
    : Limits.MAX_ALARMS;
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
  const delayMs = Math.min(MAX_TIMER_DELAY_MS, Math.max(1, dueMs - this._nowMs()));
  return this._glib.timeout_add(this._glib.PRIORITY_DEFAULT, delayMs, () => {
    const alarm = this._alarms.get(id);
    if (!alarm) return this._glib.SOURCE_REMOVE;
    const nowMs = this._nowMs();

    // Keep individual GLib timeouts bounded. This avoids integer overflow for
    // alarms far in the future while the normal reconcile loop handles clock
    // changes and suspend/resume between chunks.
    if (alarm.dueMs > nowMs) {
      alarm.timerId = this._schedule(id, alarm.dueMs);
      return this._glib.SOURCE_REMOVE;
    }

    const state = Reconcile.classifyAlarmDueState({
      dueMs: alarm.dueMs,
      nowMs,
      graceMs: this._missedGraceMs,
    });
    this._alarms.delete(id);
    try {
      const payload = {
        id,
        due: new Date(alarm.dueMs),
        label: alarm.label,
        showSeconds: !!alarm.showSeconds,
      };
      if (state === "missed") {
        if (this._onMissed) this._onMissed(payload);
      } else {
        this._onFire(payload);
      }
    } finally {
      this._onChanged();
    }
    return this._glib.SOURCE_REMOVE;
  });
};

AlarmService.prototype.add = function (dueDate, label, showSeconds) {
  if (this._alarms.size >= this._maxAlarms) return 0;
  if (!dueDate || typeof dueDate.getTime !== "function") return 0;
  const dueMs = dueDate.getTime();
  if (!Number.isSafeInteger(dueMs)) return 0;
  const id = this._nextId++;
  const timerId = this._schedule(id, dueMs);

  const safeLabel = typeof label === "string" ? label.slice(0, Limits.MAX_TEXT_LENGTH) : "";
  this._alarms.set(id, { id, dueMs, label: safeLabel, timerId, showSeconds: !!showSeconds });
  this._onChanged();
  return id;
};

AlarmService.prototype.restore = function (alarms) {
  if (!Array.isArray(alarms) || alarms.length === 0) return 0;

  let restored = 0;
  for (const alarm of alarms) {
    if (this._alarms.size >= this._maxAlarms) break;
    if (!alarm || !alarm.due || typeof alarm.due.getTime !== "function") continue;
    const dueMs = alarm.due.getTime();
    if (!Number.isSafeInteger(dueMs)) continue;

    const id = this._nextId++;
    const timerId = this._schedule(id, dueMs);
    this._alarms.set(id, {
      id,
      dueMs,
      label: typeof alarm.label === "string" ? alarm.label.slice(0, Limits.MAX_TEXT_LENGTH) : "",
      timerId,
      showSeconds: alarm.showSeconds === true,
    });
    restored++;
  }

  if (restored === 0) return 0;

  // Reconcile synchronously before the event loop can fire overdue one-shot
  // timers, preserving the normal grace-window behavior after a restart.
  const reconciled = this._reconcile();
  if (!reconciled) this._onChanged();
  return restored;
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
  return changed;
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
