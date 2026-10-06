/* One grade session for the whole Cinnamon process.
 *
 * The panel applet and the shell extension are both thin clients. Whichever
 * copy of this file loads first stores the session on `global`, so the two
 * xlets cannot mount the shaders twice.
 *
 * The muffin unredirect key is process-global. The original value is written
 * to ~/.config/iron-within/unredirect.json before it is changed. The next
 * start restores it if the shell died while the grade was on.
 */

const Logic = require("./gradeLogic").GradeLogic;
const ByteArray = imports.byteArray;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

const Main = imports.ui.main;

const ENGINE_VERSION = 1;
const ENGINE_KEY = "__ironWithinGradeEngine";
const GRADE_NAME = "cinematic-grade";
const SHARP_NAME = "cinematic-sharpen";
const MUFFIN_SCHEMA = "org.cinnamon.muffin";
const UNREDIRECT_KEY = "unredirect-fullscreen-windows";

function getEngine(projectRoot) {
    let existing = global[ENGINE_KEY];
    if (existing && existing.version === ENGINE_VERSION)
        return existing;
    if (existing && existing.shutdown) {
        try {
            existing.shutdown();
        } catch (e) {
            global.logError("[cinematic-grade] shutdown: " + e);
        }
    }
    let engine = new GradeEngine(projectRoot);
    global[ENGINE_KEY] = engine;
    return engine;
}

function GradeEngine(projectRoot) {
    this._init(projectRoot);
}

GradeEngine.prototype = {
    version: ENGINE_VERSION,

    _init: function(projectRoot) {
        this.version = ENGINE_VERSION;
        this._root = projectRoot;
        this._clients = {};
        this._owner = null;
        this._active = false;
        this._presetName = "iron_within";
        this._intensity = 1;
        this._composite = true;
        this._presets = null;
        this._error = null;
        this._gradeSource = null;
        this._sharpSource = null;
        this._shadersDirty = true;
        this._timeline = null;
        this._grainFrameId = 0;
        this._grainFrame = 0;
        this._reloadTimer = 0;
        this._reloadKind = {};
        this._floatValue = null;
        this._intValue = null;
        this._muffin = null;
        this._monitors = [];
        this._signals = [];
        this._shuttingDown = false;
        this._shadersReady = false;
        this._activateOnShaders = false;
        this._shaderOp = 0;
        this._presetOp = 0;
        this._unredirectBusy = false;
        this._unredirectPending = false;
        this._reloadRunning = false;
        this._reloadAgain = false;

        this._loadShadersInitial();
        this._loadPresetsNow(() => {
            if (this._shuttingDown || !this._active)
                return;
            if (!this._ensureEffects()) {
                this._setActive(false);
                return;
            }
            this._updateUniforms();
            this._syncGrainClock();
            this._emit();
        });
        this._watchFiles();
        this._connectStage();
        /* Grade is off. If a previous session crashed, put the muffin key back. */
        this._syncUnredirect();
    },

    root: function() {
        return this._root;
    },

    register: function(id, role, listener) {
        let previousOwner = this._owner;
        this._clients[id] = { role: role, listener: listener };
        if (role === "applet") {
            this._owner = id;
            if (previousOwner !== id)
                this._setActive(false);
        } else if (!this._owner) {
            this._owner = id;
        }
        this._emit();
        return this._owner === id;
    },

    unregister: function(id) {
        if (!this._clients[id])
            return;
        let wasOwner = this._owner === id;
        delete this._clients[id];
        if (wasOwner) {
            this._setActive(false);
            this._owner = null;
            let ids = Object.keys(this._clients);
            for (let i = 0; i < ids.length; i++) {
                if (this._clients[ids[i]].role === "applet") {
                    this._owner = ids[i];
                    break;
                }
            }
            if (!this._owner && ids.length)
                this._owner = ids[0];
        }
        this._emit();
    },

    isOwner: function(id) {
        return this._owner === id;
    },

    configure: function(id, config) {
        if (this._owner !== id)
            return;
        this._presetName = String(config.preset || "iron_within");
        this._intensity = Logic.clampIntensity(config.intensity);
        this._composite = !!config.compositeFullscreen;
        if (this._active) {
            if (!this._ensureEffects()) {
                this._setActive(false);
                return;
            }
            this._updateUniforms();
            this._syncGrainClock();
        }
        this._syncUnredirect();
        this._emit();
    },

    setActive: function(id, active) {
        if (this._owner !== id)
            return false;
        return this._setActive(!!active);
    },

    toggle: function(id) {
        if (this._owner !== id)
            return false;
        return this._setActive(!this._active);
    },

    reloadPresets: function() {
        this._loadPresetsNow(() => {
            if (this._shuttingDown)
                return;
            if (this._active) {
                this._updateUniforms();
                this._syncGrainClock();
            }
            this._emit();
        });
    },

    status: function() {
        return {
            active: this._active,
            preset: this._presetName,
            intensity: this._intensity,
            session: this._sessionKind(),
            desktop: "cinnamon",
            effects: this._effectCount(),
            shaders: !!(this._gradeSource && this._sharpSource),
            root: this._root,
            owner: this._owner,
            error: this._error,
            passes: this._passCount(),
            workingSpace: Logic.WORKING_SPACE
        };
    },

    shutdown: function() {
        this._shuttingDown = true;
        this._setActive(false);
        this._stopGrainClock();
        if (this._reloadTimer) {
            GLib.source_remove(this._reloadTimer);
            this._reloadTimer = 0;
        }
        for (let i = 0; i < this._monitors.length; i++) {
            try {
                this._monitors[i].cancel();
            } catch (e) {
                /* monitor already cancelled */
            }
        }
        this._monitors = [];
        this._disconnectStage();
        this._clients = {};
        this._owner = null;
        if (this._floatValue) {
            this._floatValue.unset();
            this._floatValue = null;
        }
        if (this._intValue) {
            this._intValue.unset();
            this._intValue = null;
        }
    },

    _setActive: function(active) {
        active = !!active;
        if (!active)
            this._activateOnShaders = false;
        else if (this._shadersReady && this._gradeSource && this._sharpSource)
            this._activateOnShaders = false;
        if (active === this._active)
            return true;
        if (active && (!this._gradeSource || !this._sharpSource)) {
            if (!this._shadersReady) {
                this._activateOnShaders = true;
                return false;
            }
            if (!this._error)
                this._error = "shader source missing";
            this._active = false;
            this._removeEffects();
            this._syncUnredirect();
            this._stopGrainClock();
            this._emit();
            return false;
        }
        if (active) {
            if (!this._ensureEffects()) {
                this._active = false;
                this._removeEffects();
                this._syncUnredirect();
                this._stopGrainClock();
                this._emit();
                return false;
            }
            this._active = true;
            this._updateUniforms();
            this._syncUnredirect();
            this._syncGrainClock();
        } else {
            this._active = false;
            this._removeEffects();
            this._syncUnredirect();
            this._stopGrainClock();
            if (this._gradeSource && this._sharpSource)
                this._error = null;
        }
        this._emit();
        return this._active === active;
    },

    _emit: function() {
        if (this._shuttingDown)
            return;
        let state = this.status();
        let ids = Object.keys(this._clients);
        for (let i = 0; i < ids.length; i++) {
            let client = this._clients[ids[i]];
            if (!client)
                continue;
            try {
                client.listener(state);
            } catch (e) {
                global.logError("[cinematic-grade] listener: " + e);
            }
        }
    },

    _currentPreset: function() {
        let source = (this._presets && this._presets[this._presetName])
            || (this._presets && this._presets.iron_within)
            || Logic.FALLBACK_PRESET;
        return Logic.normalizePreset(source);
    },

    _passCount: function() {
        if (!this._active)
            return 0;
        let perActor = Logic.sharpenWanted(this._currentPreset(), this._intensity) ? 2 : 1;
        return this._targets().length * perActor;
    },

    _targets: function() {
        let list = [];
        if (Main.uiGroup)
            list.push(Main.uiGroup);
        if (global.bottom_window_group)
            list.push(global.bottom_window_group);
        if (global.top_window_group)
            list.push(global.top_window_group);
        return list;
    },

    _ensureEffects: function() {
        let wantSharp = Logic.sharpenWanted(this._currentPreset(), this._intensity);
        let targets = this._targets();
        if (!targets.length) {
            this._error = "no desktop actors to grade";
            this._removeEffects();
            return false;
        }
        for (let i = 0; i < targets.length; i++) {
            let actor = targets[i];
            let hasGrade = this._hasEffect(actor, GRADE_NAME);
            let hasSharp = this._hasEffect(actor, SHARP_NAME);
            if (hasGrade && hasSharp === wantSharp && !this._shadersDirty)
                continue;
            this._clearActor(actor);
            /* First effect added is the outer pass. Sharpen runs after the grade. */
            if (wantSharp && !this._addShader(actor, SHARP_NAME, this._sharpSource)) {
                this._removeEffects();
                this._error = "sharpen shader failed to mount";
                return false;
            }
            if (!this._addShader(actor, GRADE_NAME, this._gradeSource)) {
                this._removeEffects();
                this._error = "grade shader failed to mount";
                return false;
            }
        }
        this._shadersDirty = false;
        return true;
    },

    _removeEffects: function() {
        let targets = this._targets();
        for (let i = 0; i < targets.length; i++)
            this._clearActor(targets[i]);
    },

    _addShader: function(actor, name, source) {
        try {
            let effect = new Clutter.ShaderEffect({
                shader_type: Clutter.ShaderType.FRAGMENT_SHADER
            });
            if (!effect.set_shader_source(source)) {
                global.logError("[cinematic-grade] set_shader_source failed for " + name);
                return false;
            }
            this._setInt(effect, "tex", 0);
            actor.add_effect_with_name(name, effect);
            return true;
        } catch (e) {
            global.logError("[cinematic-grade] mount " + name + ": " + e);
            return false;
        }
    },

    _clearActor: function(actor) {
        this._dropEffect(actor, GRADE_NAME);
        this._dropEffect(actor, SHARP_NAME);
    },

    _hasEffect: function(actor, name) {
        try {
            return actor.get_effect(name) != null;
        } catch (e) {
            return false;
        }
    },

    _dropEffect: function(actor, name) {
        if (!this._hasEffect(actor, name))
            return;
        try {
            actor.remove_effect_by_name(name);
        } catch (e) {
            global.logError("[cinematic-grade] remove " + name + ": " + e);
        }
    },

    _effectCount: function() {
        let count = 0;
        let targets = this._targets();
        for (let i = 0; i < targets.length; i++) {
            if (this._hasEffect(targets[i], GRADE_NAME))
                count++;
            if (this._hasEffect(targets[i], SHARP_NAME))
                count++;
        }
        return count;
    },

    _updateUniforms: function() {
        let preset = this._currentPreset();
        let intensity = this._intensity;
        let targets = this._targets();
        for (let i = 0; i < targets.length; i++) {
            let actor = targets[i];
            let grade = null;
            let sharp = null;
            try {
                grade = actor.get_effect(GRADE_NAME);
                sharp = actor.get_effect(SHARP_NAME);
            } catch (e) {
                continue;
            }
            let size = this._textureSize(actor);
            if (grade)
                this._pushGradeUniforms(grade, preset, intensity, size);
            if (sharp) {
                this._setInt(sharp, "tex", 0);
                this._setFloat(sharp, "amount", preset.sharpen * intensity);
                this._setFloat(sharp, "tex_width", size[0]);
                this._setFloat(sharp, "tex_height", size[1]);
            }
        }
    },

    _pushGradeUniforms: function(grade, preset, intensity, size) {
        this._setInt(grade, "tex", 0);
        this._setFloat(grade, "intensity", intensity);
        this._setFloat(grade, "exposure", preset.exposure);
        this._setFloat(grade, "contrast", preset.contrast);
        this._setFloat(grade, "highlights", preset.highlights);
        this._setFloat(grade, "shadows", preset.shadows);
        this._setFloat(grade, "blacks", preset.blacks);
        this._setFloat(grade, "saturation", preset.saturation);
        this._setFloat(grade, "temperature", preset.temperature);
        this._setFloat(grade, "shadow_teal", preset.shadow_teal);
        this._setFloat(grade, "highlight_warmth", preset.highlight_warmth);
        this._setFloat(grade, "gamma_power", preset.gamma);
        this._setFloat(grade, "vignette", preset.vignette);
        this._setFloat(grade, "skin_protect", preset.skin_protect);
        this._setFloat(grade, "grain", preset.grain);
        this._setFloat(grade, "grain_time", this._grainFrame);
        this._setFloat(grade, "tex_width", size[0]);
        this._setFloat(grade, "tex_height", size[1]);
    },

    _textureSize: function(actor) {
        let scale = 1;
        try {
            scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        } catch (e) {
            scale = 1;
        }
        if (!scale || scale < 1)
            scale = 1;
        let width = 0;
        let height = 0;
        try {
            width = actor.get_width();
            height = actor.get_height();
        } catch (e) {
            width = 0;
            height = 0;
        }
        if (!(width > 0) || !(height > 0)) {
            width = global.stage.width;
            height = global.stage.height;
        }
        return [width * scale, height * scale];
    },

    _syncGrainClock: function() {
        let preset = this._currentPreset();
        if (this._active && preset.grain > 0.001 && this._intensity > 0.001)
            this._startGrainClock();
        else
            this._stopGrainClock();
    },

    /* Grain needs new frames while the desktop is idle. The timeline is on
     * the Clutter frame clock: one grain_time update per frame, and one
     * redraw. Presets with grain 0 do not start it. */
    _startGrainClock: function() {
        if (this._timeline)
            return;
        try {
            this._timeline = new Clutter.Timeline({ duration: 1000, repeat_count: -1 });
            this._grainFrameId = this._timeline.connect("new-frame", () => this._onGrainFrame());
            this._timeline.start();
        } catch (e) {
            global.logError("[cinematic-grade] frame clock: " + e);
            this._timeline = null;
            this._grainFrameId = 0;
        }
    },

    _stopGrainClock: function() {
        if (!this._timeline)
            return;
        try {
            if (this._grainFrameId)
                this._timeline.disconnect(this._grainFrameId);
            this._timeline.stop();
        } catch (e) {
            global.logError("[cinematic-grade] stop grain: " + e);
        }
        this._timeline = null;
        this._grainFrameId = 0;
    },

    _onGrainFrame: function() {
        if (!this._active || !this._timeline)
            return;
        this._grainFrame = (this._grainFrame + 1) % 4096;
        let targets = this._targets();
        for (let i = 0; i < targets.length; i++) {
            let actor = targets[i];
            let grade = null;
            try {
                grade = actor.get_effect(GRADE_NAME);
            } catch (e) {
                continue;
            }
            if (!grade)
                continue;
            this._setFloat(grade, "grain_time", this._grainFrame);
            try {
                actor.queue_redraw();
            } catch (e) {
                /* set_uniform_value already dirties the effect on this Muffin. */
            }
        }
    },

    _loadShadersInitial: function() {
        let op = ++this._shaderOp;
        this._readShaderPair((loaded) => {
            if (op !== this._shaderOp || this._shuttingDown)
                return;
            if (!loaded.ok) {
                this._failShaderLoad(loaded.error, false);
                return;
            }
            if (!this._shaderCompiles(loaded.grade) || !this._shaderCompiles(loaded.sharp)) {
                this._failShaderLoad("shader compile failed", true);
                return;
            }
            this._gradeSource = loaded.grade;
            this._sharpSource = loaded.sharp;
            this._shadersDirty = true;
            this._shadersReady = true;
            if (this._error && this._error.indexOf("shader") === 0)
                this._error = null;
            if (this._activateOnShaders)
                this._setActive(true);
            else
                this._emit();
        });
    },

    _failShaderLoad: function(message, logIt) {
        this._error = message;
        this._gradeSource = null;
        this._sharpSource = null;
        this._shadersReady = true;
        this._activateOnShaders = false;
        if (logIt)
            global.logError("[cinematic-grade] " + message);
        this._emit();
    },

    _reloadShaders: function(callback) {
        let op = ++this._shaderOp;
        this._readShaderPair((loaded) => {
            if (op !== this._shaderOp || this._shuttingDown) {
                if (callback)
                    callback();
                return;
            }
            if (!loaded.ok) {
                this._error = loaded.error;
                global.logError("[cinematic-grade] " + loaded.error);
                if (callback)
                    callback();
                return;
            }
            if (!this._shaderCompiles(loaded.grade) || !this._shaderCompiles(loaded.sharp)) {
                this._error = "shader compile failed, keeping the previous shader";
                global.logError("[cinematic-grade] " + this._error);
                if (callback)
                    callback();
                return;
            }
            this._gradeSource = loaded.grade;
            this._sharpSource = loaded.sharp;
            this._shadersDirty = true;
            this._shadersReady = true;
            if (this._error && this._error.indexOf("shader") === 0)
                this._error = null;
            if (callback)
                callback();
        });
    },

    _readShaderPair: function(callback) {
        this._readTextAsync(this._shaderPath("grade.glsl"), (gradeErr, grade) => {
            if (gradeErr) {
                callback({ ok: false, error: "shader source missing" });
                return;
            }
            this._readTextAsync(this._shaderPath("sharpen.glsl"), (sharpErr, sharp) => {
                if (sharpErr)
                    callback({ ok: false, error: "shader source missing" });
                else
                    callback({ ok: true, grade: grade, sharp: sharp });
            });
        });
    },

    _shaderCompiles: function(source) {
        try {
            let effect = new Clutter.ShaderEffect({
                shader_type: Clutter.ShaderType.FRAGMENT_SHADER
            });
            return !!effect.set_shader_source(source);
        } catch (e) {
            global.logError("[cinematic-grade] compile: " + e);
            return false;
        }
    },

    _loadPresetsNow: function(callback) {
        let op = ++this._presetOp;
        this._readTextAsync(this._presetsPath(), (err, text) => {
            if (op !== this._presetOp || this._shuttingDown) {
                if (callback)
                    callback();
                return;
            }
            if (err) {
                this._error = "presets.json: " + err;
                if (!this._presets)
                    this._presets = { iron_within: Logic.FALLBACK_PRESET };
                global.logError("[cinematic-grade] " + this._error);
                if (callback)
                    callback();
                return;
            }
            let decision = Logic.acceptPresetText(text, this._presets);
            if (!decision.ok) {
                this._error = decision.error;
                if (!this._presets)
                    this._presets = { iron_within: Logic.FALLBACK_PRESET };
                global.logError("[cinematic-grade] " + decision.error);
                if (callback)
                    callback();
                return;
            }
            this._presets = decision.presets;
            if (this._error && this._error.indexOf("presets.json") === 0)
                this._error = null;
            if (callback)
                callback();
        });
    },

    _watchFiles: function() {
        this._watch(this._presetsPath(), "presets");
        this._watch(this._shaderPath("grade.glsl"), "shaders");
        this._watch(this._shaderPath("sharpen.glsl"), "shaders");
    },

    _watch: function(path, kind) {
        try {
            let monitor = Gio.File.new_for_path(path).monitor_file(Gio.FileMonitorFlags.NONE, null);
            monitor.connect("changed", (_monitor, _file, _other, eventType) => {
                if (eventType === Gio.FileMonitorEvent.CHANGES_DONE_HINT
                    || eventType === Gio.FileMonitorEvent.CHANGED
                    || eventType === Gio.FileMonitorEvent.CREATED)
                    this._scheduleReload(kind);
            });
            this._monitors.push(monitor);
        } catch (e) {
            global.logError("[cinematic-grade] watch " + path + ": " + e);
        }
    },

    _scheduleReload: function(kind) {
        this._reloadKind[kind] = true;
        if (this._reloadTimer)
            GLib.source_remove(this._reloadTimer);
        this._reloadTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            this._reloadTimer = 0;
            try {
                this._runReload();
            } catch (e) {
                global.logError("[cinematic-grade] reload: " + e);
            }
            return GLib.SOURCE_REMOVE;
        });
    },

    _runReload: function() {
        if (this._reloadRunning) {
            this._reloadAgain = true;
            return;
        }
        this._reloadRunning = true;
        let kinds = this._reloadKind;
        this._reloadKind = {};
        let finish = () => {
            this._reloadRunning = false;
            if (this._shuttingDown)
                return;
            if (this._reloadAgain) {
                this._reloadAgain = false;
                this._runReload();
                return;
            }
            if (this._activateOnShaders && this._gradeSource && this._sharpSource) {
                this._setActive(true);
                return;
            }
            if (this._active) {
                if (!this._ensureEffects()) {
                    this._setActive(false);
                    return;
                }
                this._updateUniforms();
                this._syncGrainClock();
            }
            this._emit();
        };
        let afterPresets = () => {
            if (kinds.shaders)
                this._reloadShaders(finish);
            else
                finish();
        };
        if (kinds.presets)
            this._loadPresetsNow(afterPresets);
        else
            afterPresets();
    },

    _connectStage: function() {
        try {
            this._signals.push({
                object: Main.layoutManager,
                id: Main.layoutManager.connect("monitors-changed", () => {
                    if (this._active)
                        this._updateUniforms();
                })
            });
        } catch (e) {
            global.logError("[cinematic-grade] monitors: " + e);
        }
        try {
            this._signals.push({
                object: global.stage,
                id: global.stage.connect("notify::width", () => {
                    if (this._active)
                        this._updateUniforms();
                })
            });
            this._signals.push({
                object: global.stage,
                id: global.stage.connect("notify::height", () => {
                    if (this._active)
                        this._updateUniforms();
                })
            });
        } catch (e) {
            /* stage size is also read when the grade turns on */
        }
    },

    _disconnectStage: function() {
        for (let i = 0; i < this._signals.length; i++) {
            try {
                this._signals[i].object.disconnect(this._signals[i].id);
            } catch (e) {
                /* signal already gone */
            }
        }
        this._signals = [];
    },

    _syncUnredirect: function() {
        this._unredirectPending = true;
        this._pumpUnredirect();
    },

    /* One transition at a time. The restore file is durable before the muffin
     * key changes. A newer request discards a plan that has not written yet
     * and runs again from disk. */
    _pumpUnredirect: function() {
        if (this._unredirectBusy || !this._unredirectPending)
            return;
        this._unredirectPending = false;
        let muffin = this._readMuffin();
        if (muffin === null)
            return;
        this._unredirectBusy = true;
        this._readRestoreAsync((file) => {
            if (this._unredirectPending) {
                this._unredirectBusy = false;
                this._pumpUnredirect();
                return;
            }
            muffin = this._readMuffin();
            if (muffin === null) {
                this._unredirectBusy = false;
                return;
            }
            let plan = Logic.unredirectTransition(file, muffin, this._composite, this._active);
            if (!plan.writeFile) {
                this._applyUnredirectPlan(plan, muffin);
                return;
            }
            this._writeRestoreAsync(plan.writeFile, (err) => {
                if (err) {
                    this._unredirectError(err);
                    this._unredirectBusy = false;
                    if (this._unredirectPending)
                        this._pumpUnredirect();
                    return;
                }
                if (this._unredirectPending) {
                    this._unredirectBusy = false;
                    this._pumpUnredirect();
                    return;
                }
                this._applyUnredirectPlan(plan, muffin);
            });
        });
    },

    _applyUnredirectPlan: function(plan, muffin) {
        try {
            if (plan.setMuffin !== null && plan.setMuffin !== muffin)
                this._writeMuffin(plan.setMuffin);
        } catch (e) {
            this._unredirectError(e);
            this._unredirectBusy = false;
            if (this._unredirectPending)
                this._pumpUnredirect();
            return;
        }
        if (!plan.deleteFile) {
            this._unredirectBusy = false;
            if (this._unredirectPending)
                this._pumpUnredirect();
            return;
        }
        this._deleteRestoreAsync((err) => {
            if (err)
                this._unredirectError(err);
            this._unredirectBusy = false;
            if (this._unredirectPending)
                this._pumpUnredirect();
        });
    },

    _unredirectError: function(error) {
        this._error = "could not update fullscreen compositing";
        global.logError("[cinematic-grade] unredirect: " + error);
    },

    _muffinSettings: function() {
        if (this._muffin)
            return this._muffin;
        try {
            this._muffin = new Gio.Settings({ schema_id: MUFFIN_SCHEMA });
        } catch (e) {
            global.logError("[cinematic-grade] muffin settings: " + e);
            return null;
        }
        return this._muffin;
    },

    _readMuffin: function() {
        let settings = this._muffinSettings();
        if (!settings)
            return null;
        try {
            return settings.get_boolean(UNREDIRECT_KEY);
        } catch (e) {
            global.logError("[cinematic-grade] unredirect read: " + e);
            return null;
        }
    },

    _writeMuffin: function(value) {
        let settings = this._muffinSettings();
        if (!settings)
            throw new Error("muffin settings unavailable");
        settings.set_boolean(UNREDIRECT_KEY, !!value);
    },

    _restorePath: function() {
        return GLib.build_filenamev([GLib.get_user_config_dir(), "iron-within", "unredirect.json"]);
    },

    _readRestoreAsync: function(callback) {
        this._readTextAsync(this._restorePath(), (err, text) => {
            if (err) {
                if (!Logic.isNotFound(err)) {
                    this._error = "unredirect restore file is unreadable";
                    global.logError("[cinematic-grade] unredirect.json: " + err);
                }
                callback(null);
                return;
            }
            try {
                let payload = Logic.readUnredirectPayload(text);
                if (!payload)
                    throw new Error("value is not a boolean");
                callback(payload);
            } catch (e) {
                this._error = "unredirect restore file is unreadable";
                global.logError("[cinematic-grade] unredirect.json: " + e);
                callback(null);
            }
        });
    },

    _writeRestoreAsync: function(payload, callback) {
        try {
            let dir = GLib.build_filenamev([GLib.get_user_config_dir(), "iron-within"]);
            if (GLib.mkdir_with_parents(dir, 0o700) !== 0)
                throw new Error("could not create " + dir);
        } catch (e) {
            callback(e);
            return;
        }
        let file = Gio.File.new_for_path(this._restorePath());
        let bytes = new GLib.Bytes(ByteArray.fromString(Logic.unredirectPayload(payload.value)));
        file.replace_contents_async(
            bytes,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
            (obj, res) => {
                try {
                    obj.replace_contents_finish(res);
                    callback(null);
                } catch (e) {
                    callback(e);
                }
            }
        );
    },

    _deleteRestoreAsync: function(callback) {
        let file = Gio.File.new_for_path(this._restorePath());
        file.delete_async(GLib.PRIORITY_DEFAULT, null, (obj, res) => {
            try {
                obj.delete_finish(res);
                callback(null);
            } catch (e) {
                callback(Logic.isNotFound(e) ? null : e);
            }
        });
    },

    _sessionKind: function() {
        try {
            if (Meta.is_wayland_compositor())
                return "wayland";
        } catch (e) {
            /* Muffin exposes this on both sessions. Fall through. */
        }
        let kind = GLib.getenv("XDG_SESSION_TYPE");
        if (kind === "wayland" || kind === "x11")
            return kind;
        return "x11";
    },

    _shaderPath: function(name) {
        return GLib.build_filenamev([this._root, "shaders", name]);
    },

    _presetsPath: function() {
        return GLib.build_filenamev([this._root, "presets.json"]);
    },

    _readTextAsync: function(path, callback) {
        Gio.File.new_for_path(path).load_contents_async(null, (file, result) => {
            try {
                let loaded = file.load_contents_finish(result);
                callback(null, ByteArray.toString(loaded[1]));
            } catch (e) {
                callback(e, null);
            }
        });
    },

    _setFloat: function(effect, name, number) {
        if (!this._floatValue) {
            this._floatValue = new GObject.Value();
            this._floatValue.init(GObject.TYPE_DOUBLE);
        }
        this._floatValue.set_double(Number(number));
        effect.set_uniform_value(name, this._floatValue);
    },

    _setInt: function(effect, name, number) {
        if (!this._intValue) {
            this._intValue = new GObject.Value();
            this._intValue.init(GObject.TYPE_INT);
        }
        this._intValue.set_int(number | 0);
        effect.set_uniform_value(name, this._intValue);
    }
};
