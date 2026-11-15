// widgets/widgetBase.js
'use strict';

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;

const { tilePx } = require('./gridMath');

class WidgetBase {
    constructor(tileData, applet) {
        this.tileData = tileData;
        this.applet   = applet;
        this._refreshTimeoutId = null;

        // Outer container — fills the tile, transparent background so tile
        // colour shows through. Subclasses render into this._contentActor directly.
        this._contentActor = new St.BoxLayout({
            vertical:  true,
            x_expand:  true,
            y_expand:  true,
            style: 'background-color: transparent; margin: 0; padding: 0;'
        });
    }

    // ---- Public API ---------------------------------------------------------

    get contentActor() { return this._contentActor; }

    /** Called once after the widget is constructed. Subclasses populate _contentActor. */
    buildUI() {}

    /** Fetch/refresh data. Subclasses implement this. */
    refresh() {}

    /** Called when the menu closes — stop timers to save CPU. */
    pause() { this._clearRefresh(); }

    /** Called when the menu reopens — restart data fetching if stale. */
    resume() { this.refresh(false); }

    /** Open the inline settings popover. */
    openSettings() {
        try {
            const WidgetSettingsPopover = require('./widgets/widgetSettingsPopover');
            const popover = new WidgetSettingsPopover(this.applet, this.tileData, this);
            popover.show();
        } catch(e) {
            global.logError('[Widget] openSettings failed: ' + e);
        }
    }

    /** Full teardown — called when the tile is destroyed. */
    destroy() {
        this._clearRefresh();
        try { this._contentActor.destroy(); } catch(e) {}
    }

    // ---- Helpers for subclasses ---------------------------------------------

    /**
     * Schedule a periodic refresh.
     * @param {number} intervalSec - interval in seconds (0 = disabled)
     * @param {Function} callback  - called every interval
     */
    _scheduleRefresh(intervalSec, callback) {
        this._clearRefresh();
        if (intervalSec <= 0) return;
        this._refreshTimeoutId = Mainloop.timeout_add_seconds(intervalSec, () => {
            callback();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _clearRefresh() {
        if (this._refreshTimeoutId) {
            Mainloop.source_remove(this._refreshTimeoutId);
            this._refreshTimeoutId = null;
        }
    }

    /**
     * Spawn a subprocess and deliver stdout to callback(stdout, errorOrNull).
     * Errors are logged; the callback always fires.
     */
    _spawnAsync(argv, callback) {
        try {
            let proc = new Gio.Subprocess({
                argv:  argv,
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    let [, stdout] = p.communicate_utf8_finish(res);
                    callback(stdout || '', null);
                } catch(e) {
                    global.logError('[Widget] _spawnAsync finish error: ' + e);
                    callback('', e);
                }
            });
        } catch(e) {
            global.logError('[Widget] _spawnAsync launch error: ' + e);
            callback('', e);
        }
    }

    /** Return pixel dimensions of this tile. */
    _getSize() {
        return {
            w: tilePx(this.tileData.w),
            h: tilePx(this.tileData.h)
        };
    }

    _showLoading() {
        let target = this._contentActor;
        if (this._viewport) {
            target = this._viewport;
        } else if (this._layoutBox) {
            target = this._layoutBox;
        }
        target.remove_all_children();
        const lbl = new St.Label({
            text: 'Loading…',
            style: 'color: rgba(255,255,255,0.7); font-size: 13px; font-family: "Inter", sans-serif;',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });
        target.add_child(lbl);
    }

    /**
     * Show a centred error message inside _contentActor (or child layout).
     * Safe to call at any point — replaces all existing children.
     */
    _showError(msg) {
        let target = this._contentActor;
        if (this._viewport) {
            target = this._viewport;
        } else if (this._layoutBox) {
            target = this._layoutBox;
        }
        target.remove_all_children();
        const lbl = new St.Label({
            text: msg || 'Error fetching data',
            style: 'color: #ffb3b0; font-size: 12px; font-family: "Inter", sans-serif;',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });
        lbl.clutter_text.set_line_wrap(true);
        target.add_child(lbl);
    }
}

module.exports = WidgetBase;
