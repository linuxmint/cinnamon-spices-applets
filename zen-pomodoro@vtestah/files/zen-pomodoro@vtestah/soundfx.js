const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "zen-pomodoro@vtestah";
function _(str) { return Gettext.dgettext(UUID, str); }

let C, SoundModule;
if (typeof require !== 'undefined') {
    C = require('./constants');
    SoundModule = require('./sound');
} else {
    const AppletDir = imports.ui.appletManager.applets[UUID];
    C = AppletDir.constants;
    SoundModule = AppletDir.sound;
}
const {
    POMODORO_STATE_FILE,
    POMODORO_STATE_MAX_AGE_MS,
    POMODORO_STATS_FILE,
    POMODORO_FOCUS_FRAME_BOTTOM_SAFE,
    POMODORO_FOCUS_FRAME_NORMAL_STYLE,
    POMODORO_FOCUS_FRAME_WARNING_STYLE,
    POMODORO_BREAK_OVER_FRAME_STYLE,
    POMODORO_FOCUS_FRAME_PULSE_INTERVAL_MS,
    POMODORO_FOCUS_FRAME_TRANSITION,
    POMODORO_FOCUS_FRAME_PULSE_STYLES,
    POMODORO_BREAK_FRAME_PULSE_STYLES,
    POMODORO_FOCUS_FRAME_STYLE,
    POMODORO_PANEL_FOCUS_CUE_STYLE,
    POMODORO_PANEL_BREAK_CUE_STYLE,
    POMODORO_PANEL_FOCUS_LABEL_STYLE,
    POMODORO_PANEL_BREAK_LABEL_STYLE,
    POMODORO_FOCUS_TASK_CHIP_STYLE,
    POMODORO_FOCUS_TASK_CHIP_PAUSED_STYLE,
    POMODORO_FOCUS_CHIP_MARGIN,
    POMODORO_FOCUS_RITUAL_STYLE,
    POMODORO_FOCUS_RITUAL_FADE_IN_MS,
    POMODORO_FOCUS_RITUAL_HOLD_MS,
    POMODORO_FOCUS_RITUAL_FADE_OUT_MS,
    POMODORO_FOCUS_RITUAL_FRAME_FADE_MS,
    POMODORO_FOCUS_RITUAL_STEP_MS,
    POMODORO_FOCUS_GLOW_FOCUS_RGB,
    POMODORO_FOCUS_GLOW_FOCUS_END_RGB,
    POMODORO_FOCUS_GLOW_BREAK_RGB,
    POMODORO_FOCUS_GLOW_END_SHIFT_START,
    POMODORO_FOCUS_GLOW_DEPTH_RATIO,
    POMODORO_FOCUS_GLOW_DEPTH_MAX,
    POMODORO_FOCUS_GLOW_DEPTH_MIN,
    POMODORO_FOCUS_GLOW_MAX_ALPHA,
    POMODORO_FOCUS_GLOW_PROGRESS_WIDTH,
    POMODORO_FOCUS_GLOW_PROGRESS_ALPHA,
    POMODORO_FOCUS_GLOW_TRACK_ALPHA,
    POMODORO_FOCUS_GLOW_TICK_ALPHA,
    POMODORO_FOCUS_GLOW_TICK_RADIUS,
    POMODORO_FOCUS_GLOW_BREATH_BOOST,
    POMODORO_FOCUS_GLOW_BREATH_MS
} = C;

function install(proto) {
    proto._playTickerSound = function(previewOnly = false) {
        if (this._opt_playTickerSound) {
            this._sounds.tick.play({ loop: true, volume: this._opt_tickerSoundVolume / 100, preview: previewOnly });
        }
    };

    proto._stopTickerSound = function() {
        this._sounds.tick.stop();
    };

    proto._playBreakSound = function(previewOnly = false) {
        if (this._opt_playBreakSound) {
            this._sounds.break.play({ volume: this._opt_breakSoundVolume / 100, preview: previewOnly });
        }
    };

    proto._playWarnSound = function(previewOnly = false) {
        if (this._opt_playWarnSound) {
            this._sounds.warn.play({ volume: this._opt_warnSoundVolume / 100, preview: previewOnly });
        }
    };

    proto._playStartSound = function(previewOnly = false) {
        if (this._opt_playStartSound) {
            this._sounds.start.play({ volume: this._opt_startSoundVolume / 100, preview: previewOnly });
        }
    };

    proto._playIntervalChime = function(previewOnly = false) {
        if (this._opt_intervalChime && this._sounds && this._sounds.chime) {
            this._sounds.chime.play({ volume: (this._opt_intervalChimeVolume || 80) / 100, preview: previewOnly });
        }
    };

    // Preview helpers for the settings "Listen" buttons: play a short sample of
    // the chosen sound regardless of whether that sound is currently enabled,
    // so you can audition it before turning it on.
    proto._previewSound = function(key, volPct) {
        if (this._sounds && this._sounds[key]) {
            this._sounds[key].play({ volume: Math.max(0, Math.min(1, (volPct || 100) / 100)), preview: true });
        }
    };
    proto._previewTimerSound = function() { this._previewSound('tick',  this._opt_tickerSoundVolume); };
    proto._previewBreakSound = function() { this._previewSound('break', this._opt_breakSoundVolume); };
    proto._previewWarnSound  = function() { this._previewSound('warn',  this._opt_warnSoundVolume); };
    proto._previewStartSound = function() { this._previewSound('start', this._opt_startSoundVolume); };
    proto._previewChime      = function() { this._previewSound('chime', this._opt_intervalChimeVolume || 80); };

    proto._loadSoundEffects = function() {
        if (!SoundModule.isPlayable()) {
            global.logError("Zen Pomodoro: no usable sound backend (GSound or paplay/canberra-gtk-play/play); sounds disabled");
        }
    
        this._sounds = this._sounds || {};
        this._sounds.tick = this._loadSoundEffect(this._sounds.tick, this._opt_tickerSoundPath);
        this._sounds.break = this._loadSoundEffect(this._sounds.break, this._opt_breakSoundPath);
        this._sounds.warn = this._loadSoundEffect(this._sounds.warn, this._opt_warnSoundPath);
        this._sounds.start = this._loadSoundEffect(this._sounds.start, this._opt_startSoundPath);
        this._sounds.chime = this._loadSoundEffect(this._sounds.chime, this._opt_intervalChimeFile);
    };

    proto._stopAllSounds = function() {
        if (this._sounds) {
            for (let key in this._sounds) {
                let s = this._sounds[key];
                if (s && typeof s.stop === 'function') {
                    s.stop();
                }
            }
        }
        this._stopAmbientSound();
    };
}
