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

const GLib = imports.gi.GLib;
const Main = imports.ui.main;

const CHECK_DELAY_MS = 1500;   // after selection, before deciding the sink failed
const OFF_GAP_MS = 500;        // between profile "off" and the HDMI profile
const VERIFY_MS = 1500;        // after restoring the profile, before checking
const DEADLINE_S = 30;         // no attempt starts later than this after detection
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

var HdmiRecovery = class HdmiRecovery {
    // control: the applet's Cvc.MixerControl; translate: the applet's _() function
    constructor(control, translate) {
        this._control = control;
        this._ = translate;
        this._timers = new Set();
        this._busyCards = new Set();   // card indexes being recovered
        this.enabled = true;
    }

    destroy() {
        for (const id of this._timers)
            GLib.source_remove(id);
        this._timers.clear();
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
        this._busyCards.add(cardIndex);
        this._log(`no sink for "${this._label(id)}" (card ${cardIndex}) after selection, recovering`);

        const gaps = drawGaps();
        const attempt = (n) => {
            const elapsed = (GLib.get_monotonic_time() - t0) / 1e6;
            if (elapsed > DEADLINE_S)
                return this._finish(id, cardIndex, false, `deadline (${DEADLINE_S} s) reached`);
            const d = this._control.lookup_output_id(id);
            if (!d)
                return this._finish(id, cardIndex, false, 'output disappeared');
            if (this._hasSink(d))
                return this._finish(id, cardIndex, true, `sink appeared before attempt ${n + 1}`);
            const card = this._findCard(d);
            if (!card)
                return this._finish(id, cardIndex, false, 'card disappeared');
            const target = this._targetProfile(d, card);
            if (!target)
                return this._finish(id, cardIndex, false, 'no HDMI profile for this output');

            this._log(`attempt ${n + 1}/3 at +${elapsed.toFixed(1)} s: card ${card.index} off -> ${target}`);
            card.change_profile('off');
            this._after(OFF_GAP_MS, () => {
                const c2 = this._findCard(this._control.lookup_output_id(id) || d) || card;
                c2.change_profile(target);
                this._after(VERIFY_MS, () => {
                    const d2 = this._control.lookup_output_id(id);
                    if (d2 && this._hasSink(d2))
                        return this._finish(id, cardIndex, true, `recovered on attempt ${n + 1}`);
                    if (n + 1 >= gaps.length)
                        return this._finish(id, cardIndex, false, 'giving up after 3 attempts');
                    this._after(gaps[n + 1] * 1000, () => attempt(n + 1));
                });
            });
        };
        this._after(gaps[0] * 1000, () => attempt(0));
    }

    _finish(id, cardIndex, ok, why) {
        this._busyCards.delete(cardIndex);
        this._log(`card ${cardIndex}: ${why}`);
        const d = this._control.lookup_output_id(id);
        if (ok && d) {
            this._control.change_output(d);  // honour the user's selection
        } else if (!ok) {
            Main.notify(this._("Sound output could not be restored"),
                this._("%s did not come back. Try selecting it again, or switch the card profile off and on in Sound settings.")
                    .format(this._label(id)));
        }
    }

    // --- helpers -----------------------------------------------------------

    _label(id) {
        const d = this._control.lookup_output_id(id);
        return d ? `${d.origin} / ${d.description}` : `output ${id}`;
    }

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
};
