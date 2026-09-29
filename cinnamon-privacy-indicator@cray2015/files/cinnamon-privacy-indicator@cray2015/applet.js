// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 the cinnamon-privacy-indicator contributors

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const ByteArray = imports.byteArray;

const UUID = 'cinnamon-privacy-indicator@cray2015';

// Bind our own translation domain rather than relying on Cinnamon's global
// gettext setup, which only covers Cinnamon's own strings — without this,
// a translator's po/ files for this applet would never actually apply.
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(text) {
    return Gettext.dgettext(UUID, text);
}

const STATE = {
    IDLE: 'idle',
    CAMERA: 'camera',
    MIC: 'mic',
    BOTH: 'both'
};

const ICON_FILES = {
    [STATE.IDLE]: 'idle.svg',
    [STATE.CAMERA]: 'camera-active.svg',
    [STATE.MIC]: 'mic-active.svg',
    [STATE.BOTH]: 'both-active.svg',
    // Not a real activity state — an overlay shown instead of the hidden
    // idle icon when a detector is broken, so a permanently-unavailable
    // feature is discoverable instead of looking identical to "all quiet".
    error: 'error.svg'
};

// fuser sends PIDs to stdout and everything else (access-type letters, errors
// for a device with no holder) to stderr, so plain `fuser <paths>` on stdout
// is all we need — no -v table to parse, no ps call to cross-reference.
//
// callback(stdout, errorKind): errorKind is null on success, 'not-found' when
// the binary itself doesn't exist (distinguished via GLib.SpawnError.NOENT so
// callers can tell "this feature isn't available on this system" apart from
// "ran fine, nothing to report" or a one-off transient failure), else 'error'.
function runSubprocessAsync(argv, callback) {
    let proc;
    try {
        proc = new Gio.Subprocess({
            argv: argv,
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
        });
        proc.init(null);
    } catch (e) {
        let notFound = e.matches(GLib.spawn_error_quark(), GLib.SpawnError.NOENT);
        callback('', notFound ? 'not-found' : 'error');
        return;
    }
    proc.communicate_utf8_async(null, null, (source, res) => {
        try {
            let [, stdout] = source.communicate_utf8_finish(res);
            callback(stdout || '', null);
        } catch (e) {
            callback('', 'error');
        }
    });
}

// Async all the way down (enumerate + paged next_files_async), even though
// /dev is a tiny in-memory pseudo-fs — this runs in Cinnamon's own process,
// so any sync I/O here blocks the compositor's main loop, not just us.
function listVideoDevicesAsync(callback) {
    let devDir = Gio.File.new_for_path('/dev');
    devDir.enumerate_children_async(
        'standard::name', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null,
        (source, res) => {
            let enumerator;
            try {
                enumerator = source.enumerate_children_finish(res);
            } catch (e) {
                // /dev not readable — no video devices to report.
                callback([]);
                return;
            }
            let devices = [];
            let collectNext = () => {
                enumerator.next_files_async(64, GLib.PRIORITY_DEFAULT, null, (src2, res2) => {
                    let infos;
                    try {
                        infos = src2.next_files_finish(res2);
                    } catch (e) {
                        infos = [];
                    }
                    if (infos.length === 0) {
                        enumerator.close_async(GLib.PRIORITY_DEFAULT, null, () => {});
                        callback(devices.sort());
                        return;
                    }
                    for (let info of infos) {
                        let name = info.get_name();
                        if (/^video\d+$/.test(name)) {
                            devices.push('/dev/' + name);
                        }
                    }
                    collectNext();
                });
            };
            collectNext();
        }
    );
}

// Resolves several PIDs' process names in parallel and fans back in once
// all have finished — same join pattern _pollTick() uses for camera/mic.
function resolveProcessNamesAsync(pids, callback) {
    let names = {};
    let remaining = pids.length;
    if (remaining === 0) {
        callback(names);
        return;
    }
    for (let pid of pids) {
        let file = Gio.File.new_for_path('/proc/' + pid + '/comm');
        file.load_contents_async(null, (source, res) => {
            try {
                let [ok, contents] = source.load_contents_finish(res);
                names[pid] = ok ? ByteArray.toString(contents).trim() : 'unknown';
            } catch (e) {
                // Process may have exited between fuser's snapshot and this read.
                names[pid] = 'unknown';
            }
            remaining--;
            if (remaining === 0) callback(names);
        });
    }
}

class PrivacyIndicatorApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._metadata = metadata;
        this._state = null;
        this._pollInFlight = false;
        this._timeoutId = null;
        this._cameraProcesses = [];
        this._micProcesses = [];
        // null = not checked yet, true = pw-dump present, false = missing.
        this._micDetectionAvailable = null;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this._pollIntervalSec = 2;
        this.settings.bind('poll-interval', 'pollIntervalSetting', this._onPollIntervalChanged.bind(this));
        this._pollIntervalSec = Math.max(1, this.pollIntervalSetting || 2);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._applyIcon(STATE.IDLE);
        this.set_applet_tooltip(_("No camera or microphone activity detected."));
        // Mirrors the macOS/iOS privacy dot this applet is modeled on: no
        // permanent panel slot, it only appears while something is active.
        this.actor.hide();

        this._startPolling();
    }

    _onPollIntervalChanged() {
        this._pollIntervalSec = Math.max(1, this.pollIntervalSetting || 2);
        this._startPolling();
    }

    _applyIcon(state) {
        let path = this._metadata.path + '/icons/' + ICON_FILES[state];
        this.set_applet_icon_path(path);
    }

    _startPolling() {
        this._stopPolling();
        this._pollTick();
        this._timeoutId = Mainloop.timeout_add_seconds(this._pollIntervalSec, () => this._pollTick());
    }

    _stopPolling() {
        if (this._timeoutId !== null) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
    }

    _pollTick() {
        if (this._pollInFlight) {
            // Previous poll's subprocesses haven't returned yet — skip this
            // tick rather than stacking a second round of detection calls.
            return GLib.SOURCE_CONTINUE;
        }
        this._pollInFlight = true;

        let camDone = false;
        let micDone = false;
        let finish = () => {
            if (camDone && micDone) {
                this._pollInFlight = false;
                this._updateState();
            }
        };

        this._checkCamera((processes) => {
            this._cameraProcesses = processes;
            camDone = true;
            finish();
        });

        this._checkMic((processes) => {
            this._micProcesses = processes;
            micDone = true;
            finish();
        });

        return GLib.SOURCE_CONTINUE;
    }

    _checkCamera(callback) {
        listVideoDevicesAsync((devices) => {
            if (devices.length === 0) {
                callback([]);
                return;
            }
            // errorKind is ignored here: fuser (psmisc) is near-universal on
            // desktop distros, unlike pw-dump/PipeWire — see _checkMic.
            runSubprocessAsync(['fuser'].concat(devices), (stdout, errorKind) => {
                let matches = stdout.match(/\d+/g);
                if (!matches) {
                    callback([]);
                    return;
                }
                let seen = {};
                let uniquePids = [];
                for (let pid of matches) {
                    if (seen[pid]) continue;
                    seen[pid] = true;
                    uniquePids.push(pid);
                }
                resolveProcessNamesAsync(uniquePids, (names) => {
                    callback(uniquePids.map(pid => ({ pid: pid, name: names[pid] })));
                });
            });
        });
    }

    // pw-dump queries PipeWire's own graph directly, rather than going
    // through the PulseAudio compatibility shim (pipewire-pulse). That shim
    // doesn't reliably surface every active capture — e.g. ALSA-plugin
    // clients can be missed or show only a running/idle "source-output"
    // regardless of whether audio is actually flowing. pw-dump's node
    // `state` field ("running" vs "idle"/"suspended") is the accurate
    // "is this actually capturing right now" signal.
    _checkMic(callback) {
        runSubprocessAsync(['pw-dump'], (stdout, errorKind) => {
            if (errorKind === 'not-found') {
                // Distinct from "no mic activity": this system has no
                // PipeWire at all, so mic detection can never work here.
                // Log once (not every poll) so it's discoverable via
                // Looking Glass instead of silently looking like idle
                // forever; _buildMenu() also surfaces it in the popup.
                if (this._micDetectionAvailable !== false) {
                    this._micDetectionAvailable = false;
                    global.logWarning('[' + UUID + '] ' +
                        'pw-dump not found — microphone detection is unavailable ' +
                        '(requires PipeWire). Camera detection is unaffected.');
                }
                callback([]);
                return;
            }

            let processes = [];
            if (errorKind === null) {
                this._micDetectionAvailable = true;
                try {
                    let data = JSON.parse(stdout || '[]');
                    for (let obj of data) {
                        if (obj.type !== 'PipeWire:Interface:Node') continue;
                        let info = obj.info || {};
                        let props = info.props || {};
                        if (props['media.class'] !== 'Stream/Input/Audio') continue;
                        if (info.state !== 'running') continue;
                        let name = props['application.name'] || props['node.name'] || 'unknown';
                        let pid = props['application.process.id'] || null;
                        processes.push({ pid: pid, name: name });
                    }
                } catch (e) {
                    // pw-dump ran but gave malformed output — no mic activity
                    // to report this tick, but don't flip availability off;
                    // that's reserved for "the binary doesn't exist at all".
                }
            }
            // errorKind === 'error': one-off transient failure (e.g. a
            // communicate_utf8_async hiccup) — treat as no data this tick,
            // same as before, without touching _micDetectionAvailable.
            callback(processes);
        });
    }

    _updateState() {
        let hasCam = this._cameraProcesses.length > 0;
        let hasMic = this._micProcesses.length > 0;
        let micBroken = this._micDetectionAvailable === false;

        let state = STATE.IDLE;
        if (hasCam && hasMic) state = STATE.BOTH;
        else if (hasCam) state = STATE.CAMERA;
        else if (hasMic) state = STATE.MIC;
        this._state = state;

        // Icon/visibility are recomputed unconditionally every tick (not
        // just on a state change) so neither can stay desynced from the
        // actual state — this bit the applet once already (see commit
        // history / prior bugfix) when it was gated on a state transition.
        //
        // Idle is normally hidden entirely (§8.1), but a broken detector
        // needs to be discoverable even with nothing active — otherwise
        // it's silently indistinguishable from "all quiet" forever, which
        // defeats the point of surfacing it at all (see _checkMic).
        let showError = (state === STATE.IDLE) && micBroken;
        this._applyIcon(showError ? 'error' : state);
        if (state === STATE.IDLE && !showError) {
            this.actor.hide();
        } else {
            this.actor.show();
        }

        this.set_applet_tooltip(this._buildTooltip(hasCam, hasMic, showError));
    }

    _buildTooltip(hasCam, hasMic, showError) {
        if (showError) return _("Microphone detection unavailable — click for details");
        if (!hasCam && !hasMic) return _("No camera or microphone activity detected.");
        let parts = [];
        if (hasCam) parts.push(_("Camera active"));
        if (hasMic) parts.push(_("Microphone active"));
        return parts.join(' · ');
    }

    _buildMenu() {
        this.menu.removeAll();
        let hasCam = this._cameraProcesses.length > 0;
        let hasMic = this._micProcesses.length > 0;
        let micBroken = this._micDetectionAvailable === false;

        if (!hasCam && !hasMic && !micBroken) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
                _("No camera or microphone activity detected."), { reactive: false }));
            return;
        }

        if (hasCam) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Camera:"), { reactive: false }));
            for (let p of this._cameraProcesses) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
                    '  ' + _("%s (PID %s)").format(p.name, p.pid), { reactive: false }));
            }
        }

        if (hasCam && (hasMic || micBroken)) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        if (hasMic) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Microphone:"), { reactive: false }));
            for (let p of this._micProcesses) {
                let label = p.pid ? _("%s (PID %s)").format(p.name, p.pid) : p.name;
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem('  ' + label, { reactive: false }));
            }
        } else if (micBroken) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
                _("Microphone: detection unavailable (pw-dump not found — requires PipeWire)"),
                { reactive: false }));
        }
    }

    on_applet_clicked(event) {
        this._buildMenu();
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._stopPolling();
        if (this.settings) {
            this.settings.finalize();
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new PrivacyIndicatorApplet(metadata, orientation, panel_height, instance_id);
}
