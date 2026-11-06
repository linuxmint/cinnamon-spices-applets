// Preserve Onboard's visible geometry or adapt it using its desktop share.
// All geometry calculations use GSettings/GDK coordinates, not stage pixels.
// The original rectangle is retained through all native stages until 100%.
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const { _ } = require("./i18n");

const POSITION_SCHEMAS = ["org.onboard.window.landscape", "org.onboard.window.portrait"];
const RECT_KEYS = ["x", "y", "width", "height"];
const same = (a, b) => Math.abs(a - b) < 0.001;
const equalRect = (a, b) => !!a && !!b && RECT_KEYS.every(key => a[key] === b[key]);
const validRect = r => r && ["x", "y"].every(key =>
    Number.isInteger(r[key]) && Math.abs(r[key]) < 2147483647) && ["width", "height"].every(key =>
    Number.isInteger(r[key]) && r[key] > 0 && r[key] < 2147483647);

// s is the actual native screen factor relative to 100%, not the menu's
// desired text size. One common factor preserves the keyboard's proportions.
function scaledGeometry(original, desktop, s, targetDesktop, mode = "smart") {
    if (!validRect(original) || ![desktop.width, desktop.height, s].every(n => Number.isFinite(n) && n > 0))
        return null;
    const target = targetDesktop || { x: desktop.x || 0, y: desktop.y || 0,
        width: desktop.width / s, height: desktop.height / s };
    const b = Math.max(original.width / desktop.width, original.height / desktop.height);
    const factor = mode === "fixed" ? 1 / s : 1 - b + b / s;
    if (!(factor > 0))
        return null;
    const width = Math.max(1, Math.round(original.width * factor));
    const height = Math.max(1, Math.round(original.height * factor));
    const position = (value, extent, oldSize, newSize, origin, newOrigin, available) => {
        if (mode === "fixed")
            return Math.round(newOrigin + (value - origin) / s);
        const free = extent - oldSize;
        // A full-width/full-height keyboard has no gap ratio (0/0).
        // Its corresponding axis starts at the desktop edge.
        const ratio = Math.abs(free) < 0.001 ? 0 : (value - origin) / free;
        return Math.round(newOrigin + ratio * (available - newSize));
    };
    const rect = {
        x: position(original.x, desktop.width, original.width, width, desktop.x || 0, target.x || 0, target.width),
        y: position(original.y, desktop.height, original.height, height, desktop.y || 0, target.y || 0, target.height),
        width, height
    };
    return validRect(rect) ? rect : null;
}

// Interpret a deliberate edit at an enlarged desktop in the same model.
// c = b * (1 - (1 - 1/s) * b); the smaller quadratic root is the unique
// root in [0,1] for the supported native factors from 1 through 2.
function referenceGeometry(live, desktop, s, mode = "smart") {
    if (!validRect(live) || ![desktop.width, desktop.height, s].every(n => Number.isFinite(n) && n > 0))
        return null;
    if (same(s, 1))
        return { ...live };
    if (mode === "fixed") {
        const rect = {};
        for (const key of RECT_KEYS)
            rect[key] = Math.round(live[key] * s);
        return validRect(rect) ? rect : null;
    }
    const c = Math.max(live.width / desktop.width, live.height / desktop.height);
    const a = 1 - 1 / s;
    const discriminant = 1 - 4 * a * c;
    if (discriminant < -0.000001)
        return null;
    const b = 2 * c / (1 + Math.sqrt(Math.max(0, discriminant)));
    const factor = 1 - a * b;
    if (!(factor > 0))
        return null;
    const width = Math.max(1, Math.round(live.width / factor));
    const height = Math.max(1, Math.round(live.height / factor));
    const position = (value, oldSize, newSize, extent, origin) => {
        const free = extent / s - oldSize;
        const ratio = Math.abs(free) < 0.001 ? 0 : (value - origin / s) / free;
        return Math.round(origin + ratio * (extent - newSize));
    };
    const rect = { x: position(live.x, live.width, width, desktop.width, desktop.x || 0),
        y: position(live.y, live.height, height, desktop.height, desktop.y || 0), width, height };
    return validRect(rect) ? rect : null;
}

class OnboardPositionCompensation {
    constructor(appletPath) {
        this._record = null;
        this._prepared = null;
        this._sourceId = 0;
        this._sourceSerial = 0;
        this._repairTask = Promise.resolve();
        this._modeTask = Promise.resolve();
        this._stateTail = Promise.resolve();
        this._owner = null;
        this._watchId = 0;
        this._enabled = false;
        this._mode = "none";
        this._activationPending = false;
        this._destroyed = false;
        this._reported = false;
        this._liveDirty = false;
        this._transitioning = false;
        this._watchedWindow = null;
        this._windowSignals = [];
        this._displaySignal = 0;
        this._percent = 100;
        this._settings = new Map();
        this._processPath = GLib.build_filenamev([appletPath, "onboard-process.py"]);
        this._restarting = false;
        this._restart = null;
        this._restoring = 0;
        this._token = GLib.uuid_string_random();
        this._ready = this._process("claim", { token: this._token,
            created: GLib.get_monotonic_time() }).catch(error => {
            this._report(error);
            return { owned: false };
        });
        try {
            this._watchId = Gio.bus_watch_name(Gio.BusType.SESSION, "org.onboard.Onboard",
                Gio.BusNameWatcherFlags.NONE,
                (connection, name, owner) => {
                    this._owner = owner;
                    if ((this._restarting || this._restoring) && this._record)
                        this._record.identity = owner;
                    this._watchWindow(this._keyboard());
                },
                () => {
                    // Recreating an override-redirect keyboard window does not
                    // change Onboard's D-Bus owner. Quitting Onboard does.
                    if (this._owner && !this._restarting && !this._restoring) {
                        this._cancel();
                        try { this._restoreOwned(); } catch (error) { this._report(error); }
                        this._record = this._prepared = null;
                        this._unwatchWindow();
                        this._liveDirty = false;
                    }
                    this._owner = null;
                });
            if (global.display && typeof global.display.connect === "function")
                this._displaySignal = global.display.connect("window-created", (display, window) => {
                    if (this._isKeyboard(window))
                        this._watchWindow(window);
                });
            this._watchWindow(this._keyboard());
        } catch (error) { this._report(error); }
    }

    _report(error) {
        if (!this._reported) {
            this._reported = true;
            global.logError(error, _("Display Scale: Onboard scaling"));
        }
    }

    setMode(mode, percent = 100, ready = true) {
        // Disable immediately during a native handoff. Its finally block
        // must restore the reference before restarting the captured process.
        if (mode === "none" && this._restarting)
            this._enabled = this._activationPending = false;
        else if (mode !== "none" && !ready && !this._enabled)
            this._activationPending = true;
        const task = this._modeTask.then(async () => {
            const status = await this._ready;
            if (status.owned)
                await this._setMode(mode, percent, ready);
        });
        this._modeTask = task.catch(error => this._report(error));
        return this._modeTask;
    }

    async _setMode(mode, percent, ready) {
        if (this._destroyed)
            return;
        await this._repairTask;
        if (this._destroyed)
            return;
        mode = mode === "smart" || mode === "fixed" ? mode : "none";
        const enabled = mode !== "none";
        if (!enabled && this._restarting) {
            // finish() owns the already stopped process until it is resumed.
            // Do not write restored geometry halfway through a native change.
            this._enabled = this._activationPending = false;
            return;
        }
        if (!enabled) {
            if (!this._enabled && !this._activationPending && !this._record && !this._prepared) {
                this._mode = "none";
                return;
            }
            if (this._enabled && this._liveDirty && !this._transitioning) {
                this._prepare(percent);
                try {
                    if (this._record)
                        await this._write(this._record, this._record.original);
                } catch (error) { this._report(error); }
            }
            this._enabled = this._activationPending = false;
            this._cancel();
            try { await this._restoreOwned(); } catch (error) { this._report(error); }
            this._record = this._prepared = null;
            this._transitioning = false;
            this._mode = "none";
            return;
        }
        if (this._enabled && !this._activationPending) {
            if (mode === this._mode || !ready || this._restarting || this._transitioning)
                return;
            // Capture deliberate edits using the preceding model first.
            // Both active modes share the same normalized 100% reference.
            this._prepare(percent);
            this._mode = mode;
            if (this._prepared)
                this._prepared.force = true;
            await this.finish(percent);
            return;
        }
        this._mode = mode;
        this._enabled = true;
        this._activationPending = !ready;
        if (!ready)
            return;
        // Turning the option on at an already enlarged desktop applies it
        // immediately without asking the native scale helper to change mode.
        if (percent > 100) {
            this._prepare(percent);
            if (this._prepared)
                this._prepared.force = true;
            await this.finish(percent);
        }
    }

    _getSettings(schemaId) {
        if (this._settings.has(schemaId))
            return this._settings.get(schemaId);
        const source = Gio.SettingsSchemaSource.get_default();
        const schema = source && source.lookup(schemaId, true);
        if (!schema)
            return null;
        const settings = new Gio.Settings({ settings_schema: schema });
        this._settings.set(schemaId, settings);
        return settings;
    }

    _keyboard() {
        for (const actor of global.get_window_actors()) {
            const window = actor.meta_window;
            if (this._isKeyboard(window))
                return window;
        }
        return null;
    }

    _isKeyboard(window) {
        return window && String(window.get_wm_class()).toLowerCase() === "onboard" && window.get_title() === "Onboard";
    }

    _watchWindow(window) {
        if (this._destroyed || !window || window === this._watchedWindow || typeof window.connect !== "function")
            return;
        this._unwatchWindow();
        this._watchedWindow = window;
        const changed = () => {
            const pointer = global.get_pointer();
            if (this._enabled && !this._transitioning && pointer &&
                (pointer[2] & imports.gi.Clutter.ModifierType.BUTTON1_MASK))
                this._liveDirty = true;
        };
        for (const signal of ["position-changed", "size-changed"])
            this._windowSignals.push(window.connect(signal, changed));
        this._windowSignals.push(window.connect("unmanaged", () => this._unwatchWindow()));
    }

    _unwatchWindow() {
        for (const id of this._windowSignals) {
            try { this._watchedWindow.disconnect(id); } catch (error) {}
        }
        this._windowSignals = [];
        this._watchedWindow = null;
    }

    _liveGeometry(window, context) {
        if (!window || window.minimized || typeof window.get_frame_rect !== "function" ||
            typeof window.frame_rect_to_client_rect !== "function")
            return null;
        // Gtk.Window stores frame position but client size. Server-side
        // decorations therefore must not become extra keyboard width/height.
        const frame = window.get_frame_rect();
        const client = window.frame_rect_to_client_rect(frame);
        const rect = { x: Math.round(frame.x / context.uiScale), y: Math.round(frame.y / context.uiScale),
            width: Math.round(client.width / context.uiScale), height: Math.round(client.height / context.uiScale) };
        return validRect(rect) ? rect : null;
    }

    _context(percent) {
        const monitors = Main.layoutManager && Main.layoutManager.monitors;
        if (!monitors || monitors.length !== 1 || !Number.isFinite(percent) || percent <= 0)
            return null;
        const m = monitors[0];
        const monitor = { x: m.x, y: m.y, width: m.width, height: m.height };
        if (!Object.values(monitor).every(Number.isFinite) || monitor.width <= 0 || monitor.height <= 0)
            return null;
        const uiScale = Math.max(1, global.ui_scale || 1);
        return { monitor, uiScale, percent,
            desktop: { x: m.x / uiScale, y: m.y / uiScale, width: m.width / uiScale, height: m.height / uiScale },
            schemaId: POSITION_SCHEMAS[m.width >= m.height ? 0 : 1] };
    }

    _geometry(settings) {
        const geometry = {};
        for (const key of RECT_KEYS)
            geometry[key] = settings.get_int(key);
        return geometry;
    }

    _knownGeometry(record) {
        const current = this._geometry(record.settings);
        return [record.original, record.expected, record.source, record.stored].some(rect => equalRect(current, rect));
    }

    async prepare(percent) {
        await this._ready;
        await this._modeTask;
        await this._repairTask;
        this._prepare(percent);
    }

    _prepare(percent) {
        if (this._destroyed || !this._enabled || this._activationPending)
            return;
        const wasPending = !!this._sourceId;
        this._cancel();
        this._prepared = null;
        this._percent = percent;
        try {
            const context = this._context(percent);
            const window = this._keyboard();
            this._watchWindow(window);
            if (!context || (!this._owner && !window))
                return;
            const options = this._getSettings("org.onboard.window");
            const settings = this._getSettings(context.schemaId);
            if (options && options.get_boolean("docking-enabled")) {
                this._restoreOwned();
                this._record = null;
                return;
            }
            if (!options || !settings || !RECT_KEYS.every(key => settings.is_writable(key)))
                return;
            const stored = this._geometry(settings);
            const live = this._liveGeometry(window, context);
            const savedChanged = this._record && !this._knownGeometry(this._record);
            const sizeChanged = live && ["width", "height"].some(key => Math.abs(live[key] - stored[key]) > 1);
            const liveEdit = live && (this._liveDirty || (!wasPending && sizeChanged && !savedChanged) ||
                (savedChanged && equalRect(live, stored)));
            if (this._record && (savedChanged || liveEdit)) {
                this._clearCache();
                this._record = null;
            }
            const identity = this._owner || window.get_pid();
            if (this._record && (this._record.identity !== identity || this._record.schemaId !== context.schemaId)) {
                this._restoreOwned();
                this._record = null;
            }
            const fresh = !this._record;
            if (fresh) {
                // Recover the 100% desktop even when first enabled at 125%
                // or later. The saved GSettings rectangle is the reference.
                const s = percent / 100;
                const desktop = {};
                for (const key of ["x", "y", "width", "height"])
                    desktop[key] = context.desktop[key] * s;
                const original = liveEdit ? referenceGeometry(live, desktop, s, this._mode) : stored;
                if (!validRect(original))
                    return;
                this._record = { schemaId: context.schemaId, identity, settings, desktop, original,
                    source: liveEdit ? { ...live } : null, stored, expected: null };
                this._liveDirty = false;
            }
            this._prepared = { ...context, fresh, wasPending, force: false };
            this._transitioning = true;
        } catch (error) { this._report(error); }
    }

    async finish(percent) {
        if (this._restart)
            return this._finishRestart(percent);
        const before = this._prepared;
        this._prepared = null;
        this._transitioning = false;
        this._percent = percent;
        if (this._destroyed || !this._enabled || !before || !this._record)
            return;
        try {
            const after = this._context(percent);
            if (!after || after.schemaId !== this._record.schemaId)
                return;
            const changed = !same(before.percent, after.percent) || before.uiScale !== after.uiScale ||
                !["x", "y", "width", "height"].every(key => same(before.monitor[key], after.monitor[key]));
            if (!changed && !before.wasPending && !before.force) {
                if (before.fresh)
                    this._record = null;
                return;
            }
            const record = this._record;
            const returning = same(after.percent, 100);
            const target = returning ? { ...record.original } :
                scaledGeometry(record.original, record.desktop, after.percent / 100, after.desktop, this._mode);
            if (!target)
                return;
            let elapsed = 0;
            const serial = this._sourceSerial;
            const repair = async () => {
                try { return await this._repair(after, target); }
                catch (error) { this._report(error); return false; }
            };
            const current = () => !this._destroyed && serial === this._sourceSerial;
            // Onboard debounces external settings for 100 ms and restores
            // its rectangle 1.5 s after screen changes. Keep the same absolute
            // target through those events; never recalculate from our writes.
            const run = async () => {
                if (!current())
                    return;
                const keep = await repair();
                if (!current())
                    return;
                if (!keep || elapsed >= 2500) {
                    if (returning && this._record === record && equalRect(this._geometry(record.settings), record.original)) {
                        await this._clearCache();
                        this._record = null;
                    }
                    return;
                }
                this._sourceId = Mainloop.timeout_add(250, () => {
                    this._sourceId = 0;
                    elapsed += 250;
                    this._repairTask = run();
                    return false;
                });
            };
            this._repairTask = run();
            await this._repairTask;
        } catch (error) { this._report(error); }
    }

    _process(action, request) {
        return new Promise((resolve, reject) => {
            try {
                const process = Gio.Subprocess.new(["/usr/bin/python3", this._processPath, action],
                    Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
                process.communicate_utf8_async(JSON.stringify(request), null, (source, result) => {
                    try {
                        const [, stdout, stderr] = source.communicate_utf8_finish(result);
                        const response = JSON.parse(stdout || "{}");
                        if (!source.get_successful() || response.error) {
                            const error = new Error(response.error || stderr.trim() || _("Onboard could not be restarted."));
                            error.restart = response.restart || null;
                            throw error;
                        }
                        resolve(response);
                    } catch (error) { reject(error); }
                });
            } catch (error) { reject(error); }
        });
    }

    async pause() {
        if (!this._prepared || !this._record || !this._enabled || this._destroyed)
            return;
        if (this._restarting)
            throw new Error(_("Onboard is already being restarted."));
        this._restarting = true;
        try {
            await this._ready;
            await this._stateTail;
            const window = this._keyboard();
            const result = await this._process("stop", { owner: this._owner,
                pid: window ? window.get_pid() : null, schemaId: this._record.schemaId });
            this._restart = result.restart || null;
            if (this._restart && this._restart.stopped !== false)
                this._adoptStoppedGeometry(this._restart.geometry);
            // A process that exited before we could address it stays stopped.
            if (!this._restart) {
                this._record = this._prepared = null;
                this._restarting = false;
            }
        } catch (error) {
            this._restart = error.restart || this._restart;
            if (!this._restart)
                this._restarting = false;
            throw error;
        }
    }

    _adoptStoppedGeometry(geometry) {
        const record = this._record;
        const before = this._prepared;
        if (!record || !before)
            return;
        if (!validRect(geometry))
            throw new Error(_("Onboard's final saved geometry is invalid."));
        // An unobserved move/resize is flushed by Onboard during cleanup.
        // This is its final HOME geometry, even when no MetaWindow was
        // available or Cinnamon delivered configure events after mouse-up.
        // It belongs to the OLD screen factor; adopt it before that changes.
        const baseline = record.expected || record.stored;
        if (!equalRect(geometry, baseline) && !equalRect(geometry, record.source)) {
            const original = referenceGeometry(geometry, record.desktop, before.percent / 100, this._mode);
            if (!validRect(original))
                throw new Error(_("Onboard's final saved geometry could not be read."));
            const stored = this._geometry(record.settings);
            this._clearCache();
            record.original = original;
            record.source = { ...geometry };
            record.stored = stored;
            record.expected = null;
        }
    }

    async _finishRestart(percent) {
        const restart = this._restart;
        const record = this._record;
        this._prepared = null;
        this._percent = percent;
        let failure = null;
        try {
            const context = this._context(percent);
            const options = this._getSettings("org.onboard.window");
            if (restart.stopped !== false && record && this._knownGeometry(record)) {
                const active = this._enabled && !this._destroyed && context &&
                    context.schemaId === record.schemaId && options && !options.get_boolean("docking-enabled");
                const target = !active || same(percent, 100) ? { ...record.original } :
                    scaledGeometry(record.original, record.desktop, percent / 100, context.desktop, this._mode);
                if (!target)
                    throw new Error(_("Onboard's target geometry could not be calculated."));
                // Onboard is gone. A single committed write replaces the
                // repeating repair loop used by the preceding trial.
                await this._write(record, target, true);
                if (!active || same(percent, 100)) {
                    await this._clearCache();
                    this._record = null;
                }
            }
        } catch (error) { failure = error; }
        try {
            // Always revive a keyboard stopped by us, including a failed
            // native change, option disable or applet removal.
            const result = await this._process("start", restart);
            if (this._record && result.owner)
                this._record.identity = result.owner;
        } catch (error) { failure = failure || error; }
        finally {
            this._restart = null;
            this._restarting = false;
            this._transitioning = false;
            if (this._destroyed) {
                await this._state("release");
                this._record = null;
                this._settings.clear();
            } else {
                this._watchWindow(this._keyboard());
            }
        }
        if (failure)
            throw failure;
    }

    async _repair(context, target) {
        const record = this._record;
        const now = this._context(context.percent);
        if (this._destroyed || !this._enabled || !record || !now || context.uiScale !== now.uiScale ||
            !["x", "y", "width", "height"].every(key => same(context.monitor[key], now.monitor[key])))
            return false;
        if (this._liveDirty)
            return false; // Let the user's edit finish; prepare reads it before the next switch.
        if (!this._owner && !this._keyboard())
            return false;
        const options = this._getSettings("org.onboard.window");
        if (!options)
            return false;
        if (options.get_boolean("docking-enabled")) {
            this._restoreOwned();
            this._record = null;
            return false;
        }
        if (!this._knownGeometry(record)) {
            this._clearCache();
            this._record = null;
            return false; // An explicit external geometry becomes the new reference.
        }
        const pointer = global.get_pointer();
        if (pointer && (pointer[2] & imports.gi.Clutter.ModifierType.BUTTON1_MASK))
            return true;
        return await this._write(record, target);
    }

    _snapshot(record, expected = record.expected) {
        return { schemaId: record.schemaId, original: record.original, expected,
            source: record.source, stored: record.stored };
    }

    _state(action, request = {}) {
        const task = this._stateTail.then(async () => {
            const status = await this._ready;
            if (!status.owned)
                return { owned: false, applied: false };
            return await this._process(action, { ...request, token: this._token });
        });
        // Keep the queue usable after a failed operation and observe every
        // rejection, including cleanup calls made by synchronous signals.
        this._stateTail = task.catch(error => this._report(error));
        return task;
    }

    async _write(record, target, allowRemoved = false) {
        if (!validRect(target))
            throw new Error(_("Invalid Onboard geometry."));
        if (this._destroyed && !allowRemoved)
            return false;
        if (equalRect(this._geometry(record.settings), target))
            return true;
        const result = await this._state("apply", {
            record: this._snapshot(record, target), previous: record.expected
        });
        if (!result.applied) {
            if (this._record === record)
                this._record = null;
            return false;
        }
        record.expected = { ...target };
        return true;
    }

    _restoreOwned(record = this._record) {
        if (!record || !record.expected)
            return Promise.resolve();
        const window = this._keyboard();
        ++this._restoring;
        return this._state("restore", { record: this._snapshot(record),
            owner: this._owner, pid: window ? window.get_pid() : null }).then(
            () => { --this._restoring; },
            error => { --this._restoring; this._report(error); });
    }

    _clearCache() {
        return this._state("clear");
    }

    _cancel() {
        ++this._sourceSerial;
        if (this._sourceId)
            Mainloop.source_remove(this._sourceId);
        this._sourceId = 0;
    }

    destroy() {
        if (this._destroyed)
            return this._disposal;
        if (this._enabled && this._liveDirty && !this._transitioning && !this._restarting)
            this._prepare(this._percent);
        this._destroyed = true;
        this._enabled = this._activationPending = false;
        this._cancel();
        if (this._watchId)
            Gio.bus_unwatch_name(this._watchId);
        this._watchId = 0;
        this._unwatchWindow();
        if (this._displaySignal) {
            try { global.display.disconnect(this._displaySignal); } catch (error) {}
        }
        this._displaySignal = 0;
        this._disposal = (async () => {
            await this._modeTask;
            await this._repairTask;
            if (!this._restarting) {
                try { await this._restoreOwned(); }
                finally { await this._state("release"); }
                this._record = this._prepared = null;
                this._settings.clear();
            }
            // An in-flight native handoff is completed by finish(), which
            // alone owns restarting the already stopped keyboard.
        })().catch(error => this._report(error));
        return this._disposal;
    }

}

module.exports = OnboardPositionCompensation;
module.exports.scaledGeometry = scaledGeometry;
module.exports.referenceGeometry = referenceGeometry;
