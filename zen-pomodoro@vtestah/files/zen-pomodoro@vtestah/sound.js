const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

/*
 * Sound backend.
 *
 * Playback prefers GSound (a GObject-introspected, asynchronous, cancellable
 * native API). GSound on libcanberra/PulseAudio does not reliably accept a
 * per-sound volume attribute, so when the user lowers a volume we fall back to
 * a managed Gio.Subprocess running a player that does support volume
 * (paplay -> canberra-gtk-play -> play). Nothing uses a shell, kill, or sox as
 * a hard dependency, and looping is stopped cleanly via Gio.Cancellable /
 * Gio.Subprocess.force_exit() rather than signalling a PID.
 */

let GSound = null;
try {
    GSound = imports.gi.GSound;
} catch (e) {
    GSound = null;
}

// GStreamer powers the gapless ambient loop (see AmbientLoop). Lazy-initialised;
// null means unavailable, in which case AmbientLoop falls back to SoundEffect.
let _gstChecked = false;
let _gst = null;
function _getGst() {
    if (_gstChecked) {
        return _gst;
    }
    _gstChecked = true;
    try {
        imports.gi.versions.Gst = '1.0';
        const G = imports.gi.Gst;
        G.init(null);
        _gst = G;
    } catch (e) {
        _gst = null;
    }
    return _gst;
}

const PREVIEW_MS = 2000;
const FULL_VOLUME = 0.999;

let _gsoundContext;   // undefined = not initialised yet, null = unavailable

function _getGSoundContext() {
    if (_gsoundContext !== undefined) {
        return _gsoundContext;
    }
    _gsoundContext = null;
    if (GSound) {
        try {
            let ctx = new GSound.Context();
            ctx.init(null);
            _gsoundContext = ctx;
        } catch (e) {
            global.logError("Zen Pomodoro: GSound init failed, will use a fallback player: " + e.message);
            _gsoundContext = null;
        }
    }
    return _gsoundContext;
}

// Players that are commonly preinstalled on Cinnamon/Mint, in order of preference.
const _PLAYERS = ["paplay", "canberra-gtk-play", "play"];
let _resolvedPlayer;  // undefined = not resolved yet, null = none available

function _getPlayer() {
    if (_resolvedPlayer !== undefined) {
        return _resolvedPlayer;
    }
    _resolvedPlayer = null;
    for (let p of _PLAYERS) {
        if (GLib.find_program_in_path(p)) {
            _resolvedPlayer = p;
            break;
        }
    }
    return _resolvedPlayer;
}

// Build a player argv. volume is a linear gain in [0, 1].
function _buildPlayerArgv(player, soundPath, volume) {
    if (player === "paplay") {
        let v = Math.max(0, Math.min(65536, Math.round(volume * 65536)));
        return ["paplay", "--volume=" + v, soundPath];
    }
    if (player === "play") {
        return ["play", "-q", "--volume", volume.toFixed(2), soundPath];
    }
    // canberra-gtk-play has no per-invocation volume control.
    return ["canberra-gtk-play", "-f", soundPath];
}

function addPathIfRelative(soundPath, basePath) {
    if (soundPath.startsWith('file://')) {
        soundPath = soundPath.substring(7);
    }
    if (soundPath.startsWith('/')) {
        return soundPath;
    }
    let fullPath = basePath ? `${basePath}/` : '';
    fullPath += soundPath;
    return fullPath;
}

// True if any backend (GStreamer, GSound or a fallback player) is available.
function isPlayable() {
    return _getGst() !== null || _getGSoundContext() !== null || _getPlayer() !== null;
}

var SoundEffect = class SoundEffect {
    constructor(soundPath) {
        this._soundPath = "";
        this._isPlayable = false;
        this._loop = false;
        this._cancellable = null;     // active GSound playback
        this._subprocess = null;      // active fallback playback
        this._previewTimeoutId = 0;
        this._generation = 0;         // invalidates stale async callbacks
        this.setSoundPath(soundPath);
    }

    setSoundPath(soundPath) {
        soundPath = soundPath || "";
        let exists = soundPath !== "" && GLib.file_test(soundPath, GLib.FileTest.EXISTS);
        if (soundPath !== "" && !exists) {
            global.logError(`Zen Pomodoro: sound file not found: ${soundPath}`);
        }
        this._soundPath = soundPath;
        this._isPlayable = Boolean(exists) && isPlayable();
    }

    getSoundPath() {
        return this._soundPath;
    }

    isPlaying() {
        return this._cancellable !== null || this._subprocess !== null;
    }

    /**
     * Plays the sound.
     * @param {Object} params - { preview:Boolean, volume:Number(0..1), loop:Boolean }
     * @returns {Boolean} whether playback was started.
     */
    play(params = {}) {
        let preview = params.preview === true;
        let loop = (params.loop === true) && !preview;
        let volume = (typeof params.volume === "number") ? params.volume : 1;
        volume = Math.max(0, Math.min(1, volume));

        if (!this._isPlayable) {
            return false;
        }

        this.stop();
        this._loop = loop;
        this._generation++;
        let myGen = this._generation;

        let ctx = _getGSoundContext();
        let player = _getPlayer();
        let started = false;

        // GSound cannot attenuate, so use it only at (near) full volume.
        if (ctx && (volume >= FULL_VOLUME || !player)) {
            started = this._playGSound(ctx, myGen);
        } else if (player) {
            started = this._playSubprocess(player, volume, myGen);
        } else if (ctx) {
            started = this._playGSound(ctx, myGen);
        }

        if (started && preview) {
            this._previewTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, PREVIEW_MS, () => {
                this._previewTimeoutId = 0;
                this.stop();
                return GLib.SOURCE_REMOVE;
            });
        }
        return started;
    }

    playOnce() {
        return this.play();
    }

    _playGSound(ctx, myGen) {
        let cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        let attrs = {};
        attrs[GSound.ATTR_MEDIA_FILENAME] = this._soundPath;
        try {
            ctx.play_full(attrs, cancellable, (src, res) => {
                let finishedOk = false;
                try {
                    finishedOk = src.play_full_finish(res);
                } catch (e) {
                    if (this._cancellable === cancellable) {
                        this._cancellable = null;
                    }
                    return;
                }
                if (myGen !== this._generation || this._cancellable !== cancellable) {
                    return; // superseded or stopped
                }
                if (this._loop && finishedOk && !cancellable.is_cancelled()) {
                    this._playGSound(ctx, myGen);
                } else {
                    this._cancellable = null;
                }
            });
        } catch (e) {
            global.logError("Zen Pomodoro: GSound playback failed: " + e.message);
            this._cancellable = null;
            return false;
        }
        return true;
    }

    _playSubprocess(player, volume, myGen) {
        let argv = _buildPlayerArgv(player, this._soundPath, volume);
        let proc;
        try {
            proc = Gio.Subprocess.new(argv,
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (e) {
            global.logError("Zen Pomodoro: failed to start sound player: " + e.message);
            return false;
        }
        this._subprocess = proc;
        proc.wait_async(null, (p, res) => {
            try {
                p.wait_finish(res);
            } catch (e) {
                // ignore
            }
            if (myGen !== this._generation || this._subprocess !== proc) {
                return; // superseded or stopped
            }
            if (this._loop) {
                this._playSubprocess(player, volume, myGen);
            } else {
                this._subprocess = null;
            }
        });
        return true;
    }

    stop() {
        this._loop = false;
        this._generation++;
        if (this._previewTimeoutId) {
            GLib.source_remove(this._previewTimeoutId);
            this._previewTimeoutId = 0;
        }
        if (this._cancellable) {
            try {
                this._cancellable.cancel();
            } catch (e) {
                // ignore
            }
            this._cancellable = null;
        }
        if (this._subprocess) {
            try {
                this._subprocess.force_exit();
            } catch (e) {
                // ignore
            }
            this._subprocess = null;
        }
    }
};

// A gapless, looping player for the ambient background sound. A GStreamer
// playbin re-arms its own URI on "about-to-finish", so the loop has no seam
// (the one-shot players above must restart on completion, which leaves an
// audible gap). Volume is applied natively and can be changed live. Falls back
// to a looping SoundEffect when GStreamer is unavailable.
var AmbientLoop = class AmbientLoop {
    constructor(soundPath) {
        this._soundPath = "";
        this._uri = null;
        this._playbin = null;
        this._bus = null;
        this._busHandlers = null;
        this._loopArmed = false;
        this._dur = -1;
        this._fallback = null;   // SoundEffect, used only without GStreamer
        this._previewHoldId = 0;
        this._fadeId = 0;
        this.setSoundPath(soundPath);
    }

    setSoundPath(soundPath) {
        soundPath = soundPath || "";
        let exists = soundPath !== "" && GLib.file_test(soundPath, GLib.FileTest.EXISTS);
        if (soundPath !== "" && !exists) {
            global.logError(`Zen Pomodoro: sound file not found: ${soundPath}`);
        }
        this._soundPath = soundPath;
        this._uri = null;
        if (exists && _getGst()) {
            try { this._uri = GLib.filename_to_uri(soundPath, null); } catch (e) { this._uri = null; }
        }
        if (!this._uri) {
            // No GStreamer (or a bad path): use the one-shot looper instead.
            if (this._fallback) { this._fallback.setSoundPath(soundPath); }
            else { this._fallback = new SoundEffect(soundPath); }
        }
    }

    getSoundPath() {
        return this._soundPath;
    }

    isPlaying() {
        if (this._playbin !== null) {
            return true;
        }
        return this._fallback ? this._fallback.isPlaying() : false;
    }

    // params: { volume:Number(0..1) }. Looping is implied (this is a loop player).
    play(params = {}) {
        let volume = (typeof params.volume === "number") ? params.volume : 1;
        volume = Math.max(0, Math.min(1, volume));

        let G = _getGst();
        if (!G || !this._uri) {
            return this._fallback ? this._fallback.play({ loop: true, volume: volume }) : false;
        }

        // Already looping this clip — just adjust the volume live (gapless).
        if (this._playbin) {
            try { this._playbin.set_property('volume', volume); } catch (e) {}
            return true;
        }

        try {
            let pb = G.ElementFactory.make('playbin', null);
            if (!pb) { throw new Error("playbin unavailable"); }
            pb.set_property('uri', this._uri);
            pb.set_property('volume', volume);

            // Truly seamless loop: keep ONE decode session and use SEGMENT seeks
            // (about-to-finish stitches two decode sessions, leaving a tiny seam).
            // Preroll in PAUSED, then on async-done arm a flushing segment seek
            // [0..duration] and go PLAYING; each segment-done re-seeks to 0
            // without flushing, so playback continues without a gap.
            let bus = pb.get_bus();
            bus.add_signal_watch();
            this._loopArmed = false;
            this._dur = -1;
            let hAsync = bus.connect('message::async-done', () => {
                if (this._loopArmed || this._playbin !== pb) { return; }
                this._loopArmed = true;
                try {
                    let res = pb.query_duration(G.Format.TIME);
                    this._dur = (res && res.length > 1 && res[0]) ? res[1] : -1;
                } catch (e) { this._dur = -1; }
                try {
                    pb.seek(1.0, G.Format.TIME, G.SeekFlags.FLUSH | G.SeekFlags.SEGMENT,
                            G.SeekType.SET, 0, G.SeekType.SET, this._dur);
                } catch (e) {}
                try { pb.set_state(G.State.PLAYING); } catch (e) {}
            });
            let hSeg = bus.connect('message::segment-done', () => {
                if (this._playbin !== pb) { return; }
                try {
                    pb.seek(1.0, G.Format.TIME, G.SeekFlags.SEGMENT,
                            G.SeekType.SET, 0, G.SeekType.SET, this._dur);
                } catch (e) {}
            });
            let hErr = bus.connect('message::error', (b, msg) => {
                try { let info = msg.parse_error(); global.logError("Zen Pomodoro: ambient playback error: " + (info && info[0] && info[0].message)); } catch (e) {}
                this._stopPlaybin();
                if (!this._fallback) { this._fallback = new SoundEffect(this._soundPath); }
                this._fallback.play({ loop: true, volume: volume });
            });

            this._bus = bus;
            this._busHandlers = [hAsync, hSeg, hErr];
            this._playbin = pb;
            pb.set_state(G.State.PAUSED);
            return true;
        } catch (e) {
            global.logError("Zen Pomodoro: GStreamer ambient loop failed: " + e.message);
            this._stopPlaybin();
            if (!this._fallback) { this._fallback = new SoundEffect(this._soundPath); }
            return this._fallback.play({ loop: true, volume: volume });
        }
    }

    _stopPlaybin() {
        if (this._playbin) {
            let G = _getGst();
            if (this._bus) {
                try { for (let id of (this._busHandlers || [])) { this._bus.disconnect(id); } } catch (e) {}
                try { this._bus.remove_signal_watch(); } catch (e) {}
                this._bus = null;
            }
            this._busHandlers = null;
            this._loopArmed = false;
            try { if (G) { this._playbin.set_state(G.State.NULL); } } catch (e) {}
            this._playbin = null;
        }
    }

    stop() {
        this._cancelPreviewTimers();
        this._stopPlaybin();
        if (this._fallback) { this._fallback.stop(); }
    }

    // Play for ~durationMs, then fade out over fadeMs and stop — a smooth
    // settings preview instead of a hard 2 s cut. Looping fills the window even
    // for short clips, and the fade avoids ending on an abrupt cut.
    previewFor(volume, durationMs, fadeMs) {
        volume = Math.max(0, Math.min(1, (typeof volume === "number") ? volume : 1));
        durationMs = (typeof durationMs === "number" && durationMs > 0) ? durationMs : 6000;
        fadeMs = Math.min((typeof fadeMs === "number" && fadeMs > 0) ? fadeMs : 600, durationMs);
        if (!this.play({ volume: volume })) { return false; }
        this._cancelPreviewTimers();
        if (this._playbin) {
            let holdMs = Math.max(0, durationMs - fadeMs);
            this._previewHoldId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, holdMs, () => {
                this._previewHoldId = 0;
                this._beginFadeOut(volume, fadeMs);
                return GLib.SOURCE_REMOVE;
            });
        } else {
            // Fallback player can't fade; just stop after the duration.
            this._previewHoldId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, durationMs, () => {
                this._previewHoldId = 0;
                this.stop();
                return GLib.SOURCE_REMOVE;
            });
        }
        return true;
    }

    _beginFadeOut(fromVol, fadeMs) {
        let steps = 10;
        let stepMs = Math.max(20, Math.round(fadeMs / steps));
        let i = 0;
        this._fadeId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, stepMs, () => {
            i++;
            if (!this._playbin || i >= steps) {
                this._fadeId = 0;
                this.stop();
                return GLib.SOURCE_REMOVE;
            }
            try { this._playbin.set_property('volume', Math.max(0, fromVol * (1 - i / steps))); } catch (e) {}
            return GLib.SOURCE_CONTINUE;
        });
    }

    _cancelPreviewTimers() {
        if (this._previewHoldId) { try { GLib.source_remove(this._previewHoldId); } catch (e) {} this._previewHoldId = 0; }
        if (this._fadeId) { try { GLib.source_remove(this._fadeId); } catch (e) {} this._fadeId = 0; }
    }
};
