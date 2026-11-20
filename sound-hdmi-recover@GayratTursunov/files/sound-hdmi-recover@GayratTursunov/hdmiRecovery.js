// hdmiRecovery.js — recover an HDMI/DisplayPort output whose sink WirePlumber
// failed to create, when the user selects it in the applet's "Output device" menu.
//
// PROBLEM STATEMENT
//   After a display sleeps and wakes, a GPU's HDMI audio device can be briefly
//   busy. PipeWire fails to open it ("playback open failed: Device or resource
//   busy") and WirePlumber < 0.5.15 never retries ("Failed to create
//   alsa_output.…hdmi-stereo: Object activation aborted"). The card still lists
//   the HDMI port with its profile active, so the output shows in the menu, but
//   there is no sink behind it: selecting it does nothing.
//
// SOLUTION
//   When the user selects an HDMI/DP output and no sink exists for it after
//   1.5 s, cycle the card's profile (off -> the HDMI profile) through Cvc, which
//   makes WirePlumber create the sink again, then make it the default output.
//   At most 3 attempts with random, increasing gaps (1-3 s, then 2-6 s, then
//   5-12 s, each gap longer than the previous one). The last attempt starts no
//   later than 25 s after the failure was detected and never after 30 s. Stops
//   as soon as the sink exists.
//
//   Coexists with the optional `hdmi-audio-recover` user service through a lock
//   directory per card: $XDG_RUNTIME_DIR/hdmi-audio-recover/card-<index>.lock
//   (mkdir is atomic; locks older than 40 s are stale). If the service holds the
//   lock, the applet only waits for the sink and then selects it.

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;

const CHECK_DELAY_MS = 1500;   // after selection, before deciding the sink failed
const OFF_GAP_MS = 500;        // between profile "off" and the HDMI profile
const VERIFY_MS = 1500;        // after restoring the profile, before checking
const DEADLINE_S = 30;         // no attempt starts later than this after detection
const LOCK_STALE_S = 40;
const WAIT_POLL_MS = 1000;     // while another process holds the card lock
const LOG_PREFIX = '[sound-hdmi-recover]';

function randInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Three strictly increasing gaps in seconds: g1 in 1-3, g2 in 2-6, g3 in 5-12.
function drawGaps() {
    const g1 = randInt(1, 3);
    const g2 = randInt(Math.max(2, g1 + 1), 6);
    const g3 = randInt(Math.max(5, g2 + 1), 12);
    return [g1, g2, g3];
}

class HdmiRecovery {
    constructor(control) {
        this._control = control;
        this._timers = new Set();
        this._busyCards = new Set();   // card indexes being handled by us
        this._ownedLocks = new Set();  // lock paths we created
        this.enabled = true;
    }

    destroy() {
        for (const id of this._timers)
            GLib.source_remove(id);
        this._timers.clear();
        for (const path of this._ownedLocks)
            this._rmLock(path);
        this._ownedLocks.clear();
        this._busyCards.clear();
    }

    // Called after the applet's own change_output(device).
    watchSelection(device) {
        if (!this.enabled || !this._isHdmi(device))
            return;
        const id = device.get_id();
        this._after(CHECK_DELAY_MS, () => {
            const dev = this._control.lookup_output_id(id);
            if (!dev || this._hasSink(dev))
                return;
            const card = this._findCard(dev);
            if (!card || this._busyCards.has(card.index))
                return;
            this._start(id, card.index);
        });
    }

    _start(id, cardIndex) {
        const t0 = GLib.get_monotonic_time();
        const lock = this._lockPath(cardIndex);
        this._busyCards.add(cardIndex);
        const dev = this._control.lookup_output_id(id);
        const label = dev ? `${dev.origin} / ${dev.description}` : `output ${id}`;
        this._log(`no sink for "${label}" (card ${cardIndex}) after selection — recovering`);

        if (!this._acquireLock(lock)) {
            this._log(`card ${cardIndex} is being recovered by another process; waiting for the sink`);
            this._waitForSink(id, cardIndex, t0);
            return;
        }
        this._ownedLocks.add(lock);

        const gaps = drawGaps();
        const attempt = (n) => {
            const elapsed = (GLib.get_monotonic_time() - t0) / 1e6;
            if (elapsed > DEADLINE_S)
                return this._finish(id, cardIndex, lock, false, `deadline (${DEADLINE_S} s) reached`);
            const d = this._control.lookup_output_id(id);
            if (!d)
                return this._finish(id, cardIndex, lock, false, 'output disappeared');
            if (this._hasSink(d))
                return this._finish(id, cardIndex, lock, true, `sink appeared before attempt ${n + 1}`);
            const card = this._findCard(d);
            if (!card)
                return this._finish(id, cardIndex, lock, false, 'card disappeared');
            const target = this._targetProfile(d, card);
            if (!target)
                return this._finish(id, cardIndex, lock, false, 'no HDMI profile for this output');

            this._log(`attempt ${n + 1}/3 at +${elapsed.toFixed(1)} s: card ${card.index} off -> ${target}`);
            card.change_profile('off');
            this._after(OFF_GAP_MS, () => {
                const c2 = this._findCard(this._control.lookup_output_id(id) || d) || card;
                c2.change_profile(target);
                this._after(VERIFY_MS, () => {
                    const d2 = this._control.lookup_output_id(id);
                    if (d2 && this._hasSink(d2))
                        return this._finish(id, cardIndex, lock, true, `recovered on attempt ${n + 1}`);
                    if (n + 1 >= gaps.length)
                        return this._finish(id, cardIndex, lock, false, 'giving up after 3 attempts');
                    this._after(gaps[n + 1] * 1000, () => attempt(n + 1));
                });
            });
        };
        this._after(gaps[0] * 1000, () => attempt(0));
    }

    // Another process (the user service) owns the lock: just wait for the sink.
    _waitForSink(id, cardIndex, t0) {
        const tick = () => {
            const d = this._control.lookup_output_id(id);
            if (d && this._hasSink(d))
                return this._finish(id, cardIndex, null, true, 'sink restored by the other process');
            if ((GLib.get_monotonic_time() - t0) / 1e6 > DEADLINE_S)
                return this._finish(id, cardIndex, null, false, 'other process did not restore the sink in time');
            this._after(WAIT_POLL_MS, tick);
        };
        this._after(WAIT_POLL_MS, tick);
    }

    _finish(id, cardIndex, lock, ok, why) {
        if (lock) {
            this._rmLock(lock);
            this._ownedLocks.delete(lock);
        }
        this._busyCards.delete(cardIndex);
        this._log(`card ${cardIndex}: ${why}`);
        const d = this._control.lookup_output_id(id);
        if (ok && d) {
            this._control.change_output(d);  // honour the user's selection
        } else if (!ok) {
            Main.notify(_("Sound output could not be restored"),
                (d ? `${d.origin} / ${d.description}: ` : '') +
                _("the audio device did not come back. Try selecting it again, or switch the card profile off and on in Sound settings."));
        }
    }

    // --- helpers -----------------------------------------------------------

    _isHdmi(device) {
        return (device.port_name || '').startsWith('hdmi-output');
    }

    _hasSink(device) {
        return !!this._control.get_stream_from_device(device);
    }

    // MixerUIDevice.card is not introspectable; match by card description
    // (device.origin) plus the port the card owns.
    _findCard(device) {
        return this._control.get_cards().find(k =>
            k.name === device.origin &&
            k.get_ports().some(p => p.port === device.port_name)) || null;
    }

    // Keep the card's current profile if it serves this output (the failure
    // case); otherwise the first profile that does.
    _targetProfile(device, card) {
        const names = device.get_profiles().map(p => p.profile);
        if (card.profile && card.profile !== 'off' && names.includes(card.profile))
            return card.profile;
        return names[0] || null;
    }

    _lockPath(cardIndex) {
        return GLib.build_filenamev([GLib.get_user_runtime_dir(), 'hdmi-audio-recover', `card-${cardIndex}.lock`]);
    }

    _acquireLock(path) {
        GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
        for (let i = 0; i < 2; i++) {
            if (GLib.mkdir(path, 0o700) === 0)
                return true;
            const f = Gio.File.new_for_path(path);
            try {
                const info = f.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
                const age = GLib.get_real_time() / 1e6 - info.get_attribute_uint64('time::modified');
                if (age <= LOCK_STALE_S)
                    return false;
                this._log(`removing stale lock ${path} (${Math.round(age)} s old)`);
                this._rmLock(path);
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    _rmLock(path) {
        try {
            Gio.File.new_for_path(path).delete(null);
        } catch (e) {
            // already gone
        }
    }

    _after(ms, fn) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            this._timers.delete(id);
            try {
                fn();
            } catch (e) {
                global.logError(`${LOG_PREFIX} ${e}`);
            }
            return GLib.SOURCE_REMOVE;
        });
        this._timers.add(id);
    }

    _log(msg) {
        global.log(`${LOG_PREFIX} ${msg}`);
    }
}

module.exports = { HdmiRecovery, drawGaps };
