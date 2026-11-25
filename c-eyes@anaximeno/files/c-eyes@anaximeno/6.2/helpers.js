/* helpers.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
'use strict';

const Util = imports.misc.util;
const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const Configs = require("./configs.js");

// Longer gaps between frames (e.g. after a system suspend) are not passed on as is.
const MAX_FRAME_DELTA_S = 0.25;


var log = (instanceId, ...args) => {
    global.log(`[${Configs.UUID}/${instanceId}]`, ...args);
}


var Debouncer = class Debouncer {
    _sourceId;

    constructor() {
        this._sourceId = 0;
    }

    clearSource() {
        if (this._sourceId > 0) {
            Util.clearTimeout(this._sourceId);
            this._sourceId = 0;
        }
    }

    debounce(fn, timeout) {
        return ((...args) => {
            this.clearSource();
            this._sourceId = Util.setTimeout(() => {
                this.clearSource();
                fn.apply(this, args);
            }, timeout);
        }).bind(this);
    }
}


var IdleMonitor = class IdleMonitor {
    constructor(idle_delay) {
        this.idle_delay = idle_delay;

        this.idle_monitor = Meta.IdleMonitor.get_core();
        this._idle_watch_id = this.idle_monitor.add_idle_watch(this.idle_delay, this._handle_idle.bind(this));
        this.idle = this.idle_monitor.get_idletime() > this.idle_delay;

        this._listener_counter = 0;
        this._idle_listeners = new Map();
    }

    add_idle_listener(callback) {
        const id = ++this._listener_counter;
        this._idle_listeners.set(id, callback);
        return id;
    }

    remove_idle_listener(id) {
        this._idle_listeners.delete(id);
    }

    trigger_idle_callbacks() {
        for (const callback of this._idle_listeners.values()) {
            callback(this.idle);
        }
    }

    destroy() {
        this.idle_monitor.remove_watch(this._idle_watch_id);
        this._idle_listeners.clear();
        this._listener_counter = 0;
        this._idle_watch_id = 0;
        this.idle_monitor = null;
    }

    _handle_idle() {
        this.idle = true;
        this.idle_monitor.remove_watch(this._idle_watch_id);
        this._idle_watch_id = this.idle_monitor.add_user_active_watch(this._handle_active.bind(this));
        this.trigger_idle_callbacks();
    }

    _handle_active() {
        this.idle = false;
        this.idle_monitor.remove_watch(this._idle_watch_id);
        this._idle_watch_id = this.idle_monitor.add_idle_watch(this.idle_delay, this._handle_idle.bind(this));
        this.trigger_idle_callbacks();
    }
}


/**
 * Calls a function at a regular interval while running, with the elapsed time since the previous call.
 */
var FrameClock = class FrameClock {
    /**
     * @param {Function} on_frame Called on each frame with the elapsed time in seconds
     */
    constructor(on_frame) {
        this._on_frame = on_frame;
        this._source_id = 0;
        this._interval_ms = 0;
        this._last_frame_us = 0;
    }

    get running() {
        return this._source_id !== 0;
    }

    /**
     * Starts, stops or changes the interval of the clock, as needed
     * @param {boolean} running Whether the clock should run
     * @param {number} interval_ms The time between frames
     */
    configure(running, interval_ms) {
        if (running === this.running && interval_ms === this._interval_ms) return;

        this.stop();
        this._interval_ms = interval_ms;

        if (running) {
            this._last_frame_us = GLib.get_monotonic_time();
            this._source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval_ms, this._handle_frame.bind(this));
        }
    }

    stop() {
        if (this._source_id !== 0) {
            GLib.source_remove(this._source_id);
            this._source_id = 0;
        }
    }

    _handle_frame() {
        const now_us = GLib.get_monotonic_time();
        const delta_s = Math.min((now_us - this._last_frame_us) / 1e6, MAX_FRAME_DELTA_S);
        this._last_frame_us = now_us;

        this._on_frame(delta_s);
        return GLib.SOURCE_CONTINUE;
    }
}
