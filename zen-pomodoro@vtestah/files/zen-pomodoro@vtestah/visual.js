const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "zen-pomodoro@vtestah";
function _(str) { return Gettext.dgettext(UUID, str); }

let C;
if (typeof require !== 'undefined') {
    C = require('./constants');
} else {
    C = imports.ui.appletManager.applets[UUID].constants;
}
const {
    POMODORO_STATE_FILE,
    POMODORO_STATE_MAX_AGE_MS,
    POMODORO_STATS_FILE,
    POMODORO_FOCUS_FRAME_BOTTOM_SAFE,
    POMODORO_FOCUS_FRAME_NORMAL_STYLE,
    POMODORO_FOCUS_FRAME_WARNING_STYLE,
    POMODORO_BREAK_OVER_FRAME_STYLE,
    POMODORO_OVERRUN_FRAME_STYLE,
    POMODORO_FOCUS_FRAME_TRANSITION,
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
    proto._stopFocusFramePulse = function() {
        if (this._focusFramePulseSourceId === null) {
            return;
        }

        Mainloop.source_remove(this._focusFramePulseSourceId);
        this._focusFramePulseSourceId = null;
    };

    proto._getFocusFrameStyle = function(ticks) {
        if (this._currentState === 'break-over') {
            return POMODORO_BREAK_OVER_FRAME_STYLE;
        }

        // Soft landing "overrun": a finished focus pomodoro held while the user
        // is still working (wait mode). A calm, steady wrap-up frame — distinct
        // from the warning/pulse the classic ending would show.
        if (this._currentState === 'pomodoro-overrun') {
            return POMODORO_OVERRUN_FRAME_STYLE;
        }

        let remainingRatio = this._getTimerRemainingRatio(ticks);
        if (remainingRatio === null) {
            return this._currentState === 'pomodoro' ? POMODORO_FOCUS_FRAME_NORMAL_STYLE : null;
        }

        if (this._currentState === 'pomodoro') {
            if (ticks <= 60 || remainingRatio <= 0.05) {
                return POMODORO_FOCUS_FRAME_WARNING_STYLE;
            }

            if (remainingRatio <= 0.20) {
                return POMODORO_FOCUS_FRAME_WARNING_STYLE;
            }

            return POMODORO_FOCUS_FRAME_NORMAL_STYLE;
        }

        if (this._currentState === 'pomodoro-paused') {
            if (remainingRatio <= 0.20) {
                return POMODORO_FOCUS_FRAME_WARNING_STYLE;
            }

            return POMODORO_FOCUS_FRAME_NORMAL_STYLE;
        }

        if (this._currentState === 'short-break' || this._currentState === 'long-break') {
            if (ticks <= 60 || remainingRatio <= 0.20) {
                return POMODORO_BREAK_OVER_FRAME_STYLE;
            }
        }

        if (this._currentState === 'short-break-paused' || this._currentState === 'long-break-paused') {
            return POMODORO_BREAK_OVER_FRAME_STYLE;
        }

        return null;
    };

    proto._createFocusFrame = function() {
        if (this._focusFrames && this._focusFrames.length > 0) {
            return;
        }

        this._focusFrames = [];
        this._rebuildFocusFrames();

        if (Main.layoutManager) {
            this._focusFrameMonitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
                this._rebuildFocusFrames();
                this._updateFocusFrame();
            });
        }
    };

    proto._getFocusFrameMonitors = function() {
        if (!Main.layoutManager) {
            return [];
        }

        let monitors = Main.layoutManager.monitors || [];
        if (monitors.length > 0) {
            return monitors;
        }

        let primary = Main.layoutManager.primaryMonitor;
        return primary ? [primary] : [];
    };

    proto._destroyFocusFrameActors = function() {
        if (!this._focusFrames) {
            this._focusFrames = [];
        }

        for (let frame of this._focusFrames) {
            frame.destroy();
        }

        this._focusFrames = [];
        this._focusFrame = null;

        if (!this._focusGlowFrames) {
            this._focusGlowFrames = [];
        }

        for (let glow of this._focusGlowFrames) {
            glow.destroy();
        }

        this._focusGlowFrames = [];

        if (this._focusTaskChip) {
            this._focusTaskChip.destroy();
            this._focusTaskChip = null;
            this._focusTaskChipLabel = null;
        }

        this._cancelFocusRitual();
        if (this._focusRitualLabel) {
            this._focusRitualLabel.destroy();
            this._focusRitualLabel = null;
        }
    };

    proto._rebuildFocusFrames = function() {
        this._destroyFocusFrameActors();
        this._focusFrameGeomSig = null;   // new frames must be repositioned

        if (!Main.uiGroup) {
            return;
        }

        for (let monitor of this._getFocusFrameMonitors()) {
            let frame = new St.Widget({
                reactive: false,
                visible: false,
                style: POMODORO_FOCUS_FRAME_STYLE
            });
            Main.uiGroup.add_actor(frame);
            this._focusFrames.push(frame);
        }

        for (let monitor of this._getFocusFrameMonitors()) {
            let glow = new St.DrawingArea({ reactive: false, visible: false });
            glow.connect('repaint', (area) => {
                this._repaintFocusGlow(area);
            });
            Main.uiGroup.add_actor(glow);
            this._focusGlowFrames.push(glow);
        }

        this._focusTaskChip = new St.BoxLayout({
            reactive: false,
            visible: false,
            vertical: false,
            style: POMODORO_FOCUS_TASK_CHIP_STYLE
        });
        this._focusTaskChipLabel = new St.Label({ text: "" });
        this._focusTaskChip.add_actor(this._focusTaskChipLabel);
        Main.uiGroup.add_actor(this._focusTaskChip);

        this._focusRitualLabel = new St.Label({
            reactive: false,
            visible: false,
            text: "",
            style: POMODORO_FOCUS_RITUAL_STYLE
        });
        Main.uiGroup.add_actor(this._focusRitualLabel);

        this._positionFocusFrame();
    };

    proto._positionFocusFrame = function() {
        if (!this._focusFrames || this._focusFrames.length === 0 || !Main.layoutManager) {
            return;
        }

        let monitors = this._getFocusFrameMonitors();
        if (monitors.length !== this._focusFrames.length) {
            this._rebuildFocusFrames();
            return;
        }

        // Frame geometry only changes when the monitors do; skip the per-tick
        // reposition (set_position/size + raise_top) when nothing has moved.
        let geomSig = monitors.map((m) => m.x + "," + m.y + "," + m.width + "," + m.height).join("|");
        if (geomSig === this._focusFrameGeomSig) {
            return;
        }
        this._focusFrameGeomSig = geomSig;

        for (let i = 0; i < this._focusFrames.length; i++) {
            let frame = this._focusFrames[i];
            let monitor = monitors[i];
            if (!frame || !monitor) {
                continue;
            }

            frame.set_position(monitor.x, monitor.y);
            frame.set_size(monitor.width, monitor.height);
            if (typeof frame.raise_top === 'function') {
                frame.raise_top();
            }
        }

        if (this._focusGlowFrames && this._focusGlowFrames.length === monitors.length) {
            for (let i = 0; i < this._focusGlowFrames.length; i++) {
                let glow = this._focusGlowFrames[i];
                let monitor = monitors[i];
                if (!glow || !monitor) {
                    continue;
                }

                glow.set_position(monitor.x, monitor.y);
                glow.set_size(monitor.width, monitor.height);

                // Inset the drawing to the usable work area so the frame never
                // overlaps a panel (top or bottom).
                let inset = { left: 0, top: 0, right: 0, bottom: 0 };
                try {
                    let ws = null;
                    if (global.workspace_manager) {
                        ws = global.workspace_manager.get_active_workspace();
                    } else if (global.screen) {
                        ws = global.screen.get_active_workspace();
                    }
                    let wa = ws ? ws.get_work_area_for_monitor(i) : null;
                    if (wa) {
                        inset.left = Math.max(0, wa.x - monitor.x);
                        inset.top = Math.max(0, wa.y - monitor.y);
                        inset.right = Math.max(0, (monitor.x + monitor.width) - (wa.x + wa.width));
                        inset.bottom = Math.max(0, (monitor.y + monitor.height) - (wa.y + wa.height));
                    }
                } catch (e) {
                    // Work-area API unavailable; fall back to no inset (the ∩ shape
                    // already leaves the bottom edge open for a bottom panel).
                }
                glow._drawInset = inset;

                if (typeof glow.raise_top === 'function') {
                    glow.raise_top();
                }
            }
        }
    };

    proto._updateFocusFrame = function(ticks = null) {
        if (!this._focusFrames || this._focusFrames.length === 0) {
            this._rebuildFocusFrames();
        }

        if (!this._focusFrames || this._focusFrames.length === 0) {
            return;
        }

        this._positionFocusFrame();

        if (ticks === null && this._timerQueue) {
            let timer = this._timerQueue.getCurrentTimer();
            if (timer) {
                ticks = timer.getTicksRemaining();
            }
        }

        this._focusFrameLastTicks = ticks;

        // The task chip / HUD has its own toggle (focus_show_task_chip) and must
        // update regardless of frame style — even when the frame is "off".
        this._updateFocusHud(ticks);

        let fstyle = this._opt_frameStyle || 'glow';
        if (fstyle === 'off') {
            this._stopFocusFramePulse();
            this._hideGlowFrames();
            for (let frame of this._focusFrames) {
                frame.hide();
            }
            return;
        }

        this._stopFocusFramePulse();

        if (fstyle === 'glow' || fstyle === 'corners') {
            // Glow frame: soft inward vignette + perimeter progress (Cairo).
            // Visible for the whole session (focus and break) so the depleting
            // break ring is meaningful — unlike the classic border, which only
            // appears near the end of a break.
            this._stopFocusFramePulse();
            for (let frame of this._focusFrames) {
                frame.hide();
            }

            if (this._currentState === 'pomodoro-stop') {
                this._hideGlowFrames();
                return;
            }

            let breakish = (this._currentState === 'short-break' || this._currentState === 'long-break' ||
                this._currentState === 'short-break-paused' || this._currentState === 'long-break-paused' ||
                this._currentState === 'break-over');
            this._glowBreakish = breakish;
            let ratio = this._getTimerRemainingRatio(ticks);
            if (breakish) {
                // Break depletes (remaining); no set segments.
                this._glowProgress = (ratio === null) ? 0 : ratio;
                this._glowCurrentElapsed = 0;
                this._glowSegments = 0;
            } else {
                // Focus: the ring shows progress through the whole set, divided
                // into one segment per pomodoro.
                let cur = (ratio === null) ? 0 : (1 - ratio);
                let total = this._opt_pomodoriNumber || 4;
                let done = this._numPomodoriFinished || 0;
                this._glowCurrentElapsed = cur;
                this._glowSegments = total;
                this._glowProgress = Math.max(0, Math.min(1, (done + cur) / total));

                // A single gentle "breath" of light when the last minute begins.
                if (typeof ticks === 'number' && ticks <= 60 && this._currentState === 'pomodoro' &&
                    !this._glowBreathedForTimer) {
                    this._playGlowBreath();
                    this._glowBreathedForTimer = true;
                }
            }

            let zenSpot = this._zenActive && this._opt_zenModeEnabled &&
                (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-paused');
            let zenMon = -1;
            if (zenSpot) {
                let fw = (global.display && global.display.get_focus_window) ? global.display.get_focus_window() : null;
                if (fw && typeof fw.get_monitor === 'function') { zenMon = fw.get_monitor(); }
                if (zenMon < 0 && Main.layoutManager && Main.layoutManager.focusMonitor) {
                    zenMon = Main.layoutManager.focusMonitor.index;
                }
            }
            let gmons = this._getFocusFrameMonitors();
            for (let gi = 0; gi < this._focusGlowFrames.length; gi++) {
                let glow = this._focusGlowFrames[gi];
                let gmon = gmons[gi];
                // In Zen, only the monitor you're working on keeps its frame.
                if (zenSpot && zenMon >= 0 && gmon && gmon.index !== zenMon) {
                    glow.hide();
                    continue;
                }
                if (typeof glow.raise_top === 'function') {
                    glow.raise_top();
                }
                glow.queue_repaint();
                glow.show();
            }
            return;
        }

        // Classic border frame.
        this._hideGlowFrames();
        let frameStyle = this._getFocusFrameStyle(ticks);
        if (frameStyle === null) {
            this._stopFocusFramePulse();
            for (let frame of this._focusFrames) {
                frame.hide();
            }
            return;
        }
        for (let frame of this._focusFrames) {
            frame.set_style(frameStyle);
            frame.show();
        }
    };

    proto._hideGlowFrames = function() {
        if (!this._focusGlowFrames) {
            return;
        }
        for (let glow of this._focusGlowFrames) {
            glow.hide();
        }
    };

    proto._perimeterPoint = function(f, x0, y0, x1, y1) {
        // U-shape (∩) path: bottom-left -> up -> across top -> down -> bottom-right.
        // The bottom edge is intentionally left open so the frame never overlaps
        // a bottom panel.
        let sideLen = y1 - y0, topLen = x1 - x0;
        let total = 2 * sideLen + topLen;
        let d = total * Math.max(0, Math.min(1, f));
        if (d <= sideLen) {
            return [x0, y1 - d];
        }
        d -= sideLen;
        if (d <= topLen) {
            return [x0 + d, y0];
        }
        d -= topLen;
        return [x1, y0 + d];
    };

    proto._accentRgb = function(breakish) {
        let preset = this._opt_themePreset || "warm";
        if (preset === "custom") {
            return this._parseColor(breakish ? this._opt_accentBreakColor : this._opt_accentFocusColor, breakish);
        }
        let table = {
            warm: { focus: POMODORO_FOCUS_GLOW_FOCUS_RGB, brk: POMODORO_FOCUS_GLOW_BREAK_RGB },
            cool: { focus: [120, 180, 230], brk: [90, 200, 180] },
            mono: { focus: [200, 200, 205], brk: [170, 175, 180] }
        };
        let t = table[preset] || table.warm;
        return breakish ? t.brk.slice() : t.focus.slice();
    };

    proto._parseColor = function(str, breakish) {
        let fallback = breakish ? POMODORO_FOCUS_GLOW_BREAK_RGB.slice() : POMODORO_FOCUS_GLOW_FOCUS_RGB.slice();
        if (!str || typeof str !== "string") {
            return fallback;
        }
        let m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (m) {
            return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
        }
        m = str.match(/^#([0-9a-fA-F]{6})$/);
        if (m) {
            let h = m[1];
            return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
        }
        return fallback;
    };

    proto._cssRgb = function(rgb) {
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    };

    proto._applyAppearance = function() {
        if (this._appletMenu && typeof this._appletMenu.setAppearance === "function") {
            this._appletMenu.setAppearance({
                accentFocus: this._cssRgb(this._accentRgb(false)),
                accentBreak: this._cssRgb(this._accentRgb(true)),
                fontScale: this._opt_menuFontScale || 100
            });
        }
        this._updateFocusFrame();
    };

    proto._previewAppearance = function() {
        this._applyAppearance();

        // If a session is running the real frame is already on screen.
        if (this._isSessionActive()) {
            return;
        }

        this._cancelAppearancePreview();
        this._positionFocusFrame();

        let fstyle = this._opt_frameStyle || 'glow';
        let reduce = Boolean(this._opt_reduceMotion);

        if (fstyle === 'glow' || fstyle === 'corners') {
            this._glowBreakish = false;
            this._glowSegments = this._opt_pomodoriNumber || 4;
            this._glowCurrentElapsed = 0.62;
            this._glowProgress = 0.62;
            this._glowBreathBoost = 0;
            for (let glow of this._focusGlowFrames) {
                if (typeof glow.raise_top === 'function') {
                    glow.raise_top();
                }
                glow.queue_repaint();
                glow.show();
                if (reduce) {
                    glow.opacity = 255;
                } else {
                    this._animateActorOpacity(glow, 0, 255, POMODORO_FOCUS_RITUAL_FRAME_FADE_MS, null);
                }
            }
        } else if (fstyle === 'border') {
            for (let frame of this._focusFrames) {
                frame.set_style(POMODORO_FOCUS_FRAME_NORMAL_STYLE);
                frame.show();
                if (reduce) {
                    frame.opacity = 255;
                } else {
                    this._animateActorOpacity(frame, 0, 255, POMODORO_FOCUS_RITUAL_FRAME_FADE_MS, null);
                }
            }
        }
        // fstyle === 'off' → only the sample chip is shown.

        if (this._focusTaskChip && this._focusTaskChipLabel) {
            this._focusTaskChipLabel.set_text(`\u25CF  ${_("Preview")}`);
            this._focusTaskChip.set_style(POMODORO_FOCUS_TASK_CHIP_STYLE);
            let primary = Main.layoutManager ? (Main.layoutManager.focusMonitor || Main.layoutManager.primaryMonitor) : null;
            if (primary) {
                let [, natW] = this._focusTaskChip.get_preferred_width(-1);
                let [, natH] = this._focusTaskChip.get_preferred_height(natW);
                let m = POMODORO_FOCUS_CHIP_MARGIN;
                let pos = this._opt_chipPosition || 'br';
                let left = (pos === 'bl' || pos === 'tl');
                let top = (pos === 'tl' || pos === 'tr');
                let x = left ? (primary.x + m) : (primary.x + primary.width - natW - m);
                let y = top ? (primary.y + m) : (primary.y + primary.height - natH - m);
                this._focusTaskChip.set_position(Math.round(x), Math.round(y));
            }
            if (typeof this._focusTaskChip.raise_top === 'function') {
                this._focusTaskChip.raise_top();
            }
            this._focusTaskChip.show();
        }

        this._appearancePreviewTimeout = Mainloop.timeout_add(3500, () => {
            this._appearancePreviewTimeout = 0;
            this._endAppearancePreview();
            return false;
        });
    };

    proto._cancelAppearancePreview = function() {
        if (this._appearancePreviewTimeout) {
            Mainloop.source_remove(this._appearancePreviewTimeout);
            this._appearancePreviewTimeout = 0;
        }
    };

    proto._endAppearancePreview = function() {
        // If a real session started meanwhile, let the normal logic own the frame.
        if (this._isSessionActive()) {
            return;
        }
        this._hideGlowFrames();
        for (let frame of this._focusFrames) {
            frame.hide();
        }
        if (this._focusTaskChip) {
            this._focusTaskChip.hide();
        }
    };

    proto._previewBreathing = function() {
        if (this._isSessionActive()) {
            return;
        }
        this._cancelBreathingPreview();
        this._startBreathing();
        this._breathingPreviewTimeout = Mainloop.timeout_add(9000, () => {
            this._breathingPreviewTimeout = 0;
            this._stopBreathing();
            return false;
        });
    };

    proto._cancelBreathingPreview = function() {
        if (this._breathingPreviewTimeout) {
            Mainloop.source_remove(this._breathingPreviewTimeout);
            this._breathingPreviewTimeout = 0;
        }
    };

    proto._getGlowColor = function() {
        let base = this._accentRgb(this._glowBreakish);
        if (this._glowBreakish) {
            return base;
        }

        // Focus: gently warm the colour as the current pomodoro nears its end
        // (only for the "warm" preset; other presets stay constant).
        if ((this._opt_themePreset || "warm") !== "warm") {
            return base;
        }
        let p = this._glowCurrentElapsed || 0;
        if (p <= POMODORO_FOCUS_GLOW_END_SHIFT_START) {
            return base;
        }
        let t = Math.min(1, (p - POMODORO_FOCUS_GLOW_END_SHIFT_START) / (1 - POMODORO_FOCUS_GLOW_END_SHIFT_START));
        let a = base, b = POMODORO_FOCUS_GLOW_FOCUS_END_RGB;
        return [
            Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t)
        ];
    };

    proto._repaintFocusGlow = function(area) {
        let cr = area.get_context();
        try {
            let [w, h] = area.get_surface_size();
            if (w <= 2 || h <= 2) {
                return;
            }

            let inset = area._drawInset || { left: 0, top: 0, right: 0, bottom: 0 };
            let x0 = inset.left + 1.5;
            let y0 = inset.top + 1.5;
            let x1 = w - inset.right - 1.5;
            let y1 = h - inset.bottom - 1.5;
            if (x1 - x0 < 16 || y1 - y0 < 16) {
                return;
            }

            let rgb = this._getGlowColor();
            let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;

            // Soft inward glow on TOP / LEFT / RIGHT edges only — the bottom edge
            // is left open so the frame never overlaps a bottom panel.
            let depth = Math.round(Math.min(w, h) * POMODORO_FOCUS_GLOW_DEPTH_RATIO);
            depth = Math.max(POMODORO_FOCUS_GLOW_DEPTH_MIN, Math.min(POMODORO_FOCUS_GLOW_DEPTH_MAX, depth));
            let baseAlpha = (typeof this._opt_glowIntensity === 'number' && this._opt_glowIntensity > 0)
                ? this._opt_glowIntensity / 100 : POMODORO_FOCUS_GLOW_MAX_ALPHA;
            // Scale the perimeter trace (track / ticks / progress) by glow
            // intensity too, so lowering it dims the whole frame, not just the
            // soft wash (1.0 at the default intensity — no change there).
            let traceScale = baseAlpha / POMODORO_FOCUS_GLOW_MAX_ALPHA;
            let pw = POMODORO_FOCUS_GLOW_PROGRESS_WIDTH;
            let maxA = baseAlpha * (1 + (this._glowBreathBoost || 0));
            let cornersOnly = (this._opt_frameStyle === 'corners');
            cr.setLineWidth(1);
            if (cornersOnly) {
                // Short L-brackets in the four corners instead of full edges.
                let armX = Math.max(12, Math.min(60, (x1 - x0) * 0.06));
                let armY = Math.max(12, Math.min(60, (y1 - y0) * 0.06));
                for (let i = 0; i < depth; i++) {
                    let t = 1 - (i / depth);
                    cr.setSourceRGBA(r, g, b, maxA * t * t);
                    let xx0 = x0 + i, xx1 = x1 - i, yy0 = y0 + i, yy1 = y1 - i;
                    if (xx1 <= xx0 || yy1 <= yy0) {
                        continue;
                    }
                    cr.moveTo(xx0, yy0 + armY); cr.lineTo(xx0, yy0); cr.lineTo(xx0 + armX, yy0); cr.stroke();
                    cr.moveTo(xx1 - armX, yy0); cr.lineTo(xx1, yy0); cr.lineTo(xx1, yy0 + armY); cr.stroke();
                    cr.moveTo(xx0, yy1 - armY); cr.lineTo(xx0, yy1); cr.lineTo(xx0 + armX, yy1); cr.stroke();
                    cr.moveTo(xx1 - armX, yy1); cr.lineTo(xx1, yy1); cr.lineTo(xx1, yy1 - armY); cr.stroke();
                }
            } else {
                for (let i = 0; i < depth; i++) {
                    let t = 1 - (i / depth);
                    cr.setSourceRGBA(r, g, b, maxA * t * t);
                    let xx0 = x0 + i, xx1 = x1 - i, yy0 = y0 + i;
                    if (xx1 <= xx0) {
                        continue;
                    }
                    // top
                    cr.moveTo(xx0, yy0);
                    cr.lineTo(xx1, yy0);
                    cr.stroke();
                    // left
                    cr.moveTo(xx0, yy0);
                    cr.lineTo(xx0, y1);
                    cr.stroke();
                    // right
                    cr.moveTo(xx1, yy0);
                    cr.lineTo(xx1, y1);
                    cr.stroke();
                }
            }

            // Faint full ∩ track.
            cr.setLineWidth(pw);
            cr.setSourceRGBA(r, g, b, POMODORO_FOCUS_GLOW_TRACK_ALPHA * traceScale);
            cr.moveTo(x0, y1);
            cr.lineTo(x0, y0);
            cr.lineTo(x1, y0);
            cr.lineTo(x1, y1);
            cr.stroke();

            // Milestone marks: one per pomodoro boundary during focus
            // (k / segments), or quarters during a break.
            cr.setSourceRGBA(r, g, b, POMODORO_FOCUS_GLOW_TICK_ALPHA * traceScale);
            let tickFracs = [];
            if (this._glowSegments > 1) {
                for (let k = 1; k < this._glowSegments; k++) {
                    tickFracs.push(k / this._glowSegments);
                }
            } else {
                tickFracs = [0.25, 0.5, 0.75];
            }
            for (let f of tickFracs) {
                let [px, py] = this._perimeterPoint(f, x0, y0, x1, y1);
                cr.arc(px, py, POMODORO_FOCUS_GLOW_TICK_RADIUS, 0, 2 * Math.PI);
                cr.fill();
            }

            // Progress stroke along the ∩ from the bottom-left, going up, across
            // the top, then down the right. Focus fills up; break depletes.
            let frac = Math.max(0, Math.min(1, this._glowProgress || 0));
            if (frac > 0) {
                let sideLen = y1 - y0, topLen = x1 - x0;
                let rem = (2 * sideLen + topLen) * frac;

                cr.setSourceRGBA(r, g, b, POMODORO_FOCUS_GLOW_PROGRESS_ALPHA * traceScale);
                cr.setLineWidth(pw);
                cr.moveTo(x0, y1);

                let seg = Math.min(sideLen, rem);
                cr.lineTo(x0, y1 - seg);
                rem -= seg;
                if (rem > 0) {
                    seg = Math.min(topLen, rem);
                    cr.lineTo(x0 + seg, y0);
                    rem -= seg;
                }
                if (rem > 0) {
                    seg = Math.min(sideLen, rem);
                    cr.lineTo(x1, y0 + seg);
                    rem -= seg;
                }
                cr.stroke();
            }
        } finally {
            cr.$dispose();
        }
    };

    proto._updateFocusHud = function(ticks) {
        let state = this._currentState;

        // On-screen task anchor chip (primary monitor, focus only).
        let showChip = Boolean(this._opt_focusShowTaskChip) &&
            (state === 'pomodoro' || state === 'pomodoro-paused') &&
            Boolean(this._currentFocusTask);
        if (this._focusTaskChip && this._focusTaskChipLabel) {
            if (showChip) {
                let timeStr = this._getFormattedTimeLeft(ticks) || "";
                let prefix = (state === 'pomodoro-paused') ? "\u23F8" : "\u25CF";
                let text = `${prefix}  ${this._currentFocusTask}`;
                if (timeStr) {
                    text += `   ${timeStr}`;
                }
                this._focusTaskChipLabel.set_text(text);
                this._focusTaskChip.set_style(state === 'pomodoro-paused'
                    ? POMODORO_FOCUS_TASK_CHIP_PAUSED_STYLE
                    : POMODORO_FOCUS_TASK_CHIP_STYLE);

                let primary = Main.layoutManager ? (Main.layoutManager.focusMonitor || Main.layoutManager.primaryMonitor) : null;
                if (primary) {
                    let [, natW] = this._focusTaskChip.get_preferred_width(-1);
                    let [, natH] = this._focusTaskChip.get_preferred_height(natW);
                    let m = POMODORO_FOCUS_CHIP_MARGIN;
                    let pos = this._opt_chipPosition || 'br';
                    let left = (pos === 'bl' || pos === 'tl');
                    let top = (pos === 'tl' || pos === 'tr');
                    let x = left ? (primary.x + m) : (primary.x + primary.width - natW - m);
                    let y = top ? (primary.y + m) : (primary.y + primary.height - natH - m);
                    this._focusTaskChip.set_position(Math.round(x), Math.round(y));
                }
                if (typeof this._focusTaskChip.raise_top === 'function') {
                    this._focusTaskChip.raise_top();
                }
                this._focusTaskChip.show();
            } else {
                this._focusTaskChip.hide();
            }
        }
    };

    proto._animateActorOpacity = function(actor, fromOpacity, toOpacity, durationMs, onComplete) {
        if (!actor) {
            if (onComplete) {
                onComplete();
            }
            return;
        }

        actor.set_opacity(fromOpacity);
        let steps = Math.max(1, Math.round(durationMs / POMODORO_FOCUS_RITUAL_STEP_MS));
        let i = 0;
        let sourceId = Mainloop.timeout_add(POMODORO_FOCUS_RITUAL_STEP_MS, () => {
            i++;
            let t = i / steps;
            if (t >= 1) {
                actor.set_opacity(toOpacity);
                this._removeRitualTimeout(sourceId);
                if (onComplete) {
                    onComplete();
                }
                return false;
            }
            let eased = 1 - (1 - t) * (1 - t); // easeOutQuad
            actor.set_opacity(Math.round(fromOpacity + (toOpacity - fromOpacity) * eased));
            return true;
        });
        this._focusRitualTimeouts.push(sourceId);
    };

    proto._removeRitualTimeout = function(sourceId) {
        if (!this._focusRitualTimeouts) {
            return;
        }
        let idx = this._focusRitualTimeouts.indexOf(sourceId);
        if (idx >= 0) {
            this._focusRitualTimeouts.splice(idx, 1);
        }
    };

    proto._cancelFocusRitual = function() {
        if (this._focusRitualTimeouts) {
            for (let id of this._focusRitualTimeouts) {
                Mainloop.source_remove(id);
            }
        }
        this._focusRitualTimeouts = [];

        if (this._focusRitualLabel) {
            this._focusRitualLabel.hide();
        }
    };

    proto._playFocusStartRitual = function() {
        if (!this._opt_focusStartRitual || !this._focusRitualLabel) {
            return;
        }

        this._cancelFocusRitual();

        let text = this._currentFocusTask
            ? _("Focus: %s").format(this._currentFocusTask)
            : _("Focus");
        this._focusRitualLabel.set_text(text);

        let primary = Main.layoutManager ? (Main.layoutManager.focusMonitor || Main.layoutManager.primaryMonitor) : null;
        if (primary) {
            let [, natW] = this._focusRitualLabel.get_preferred_width(-1);
            let [, natH] = this._focusRitualLabel.get_preferred_height(natW);
            let x = primary.x + Math.round((primary.width - natW) / 2);
            let y = primary.y + Math.round((primary.height - natH) / 2.4);
            this._focusRitualLabel.set_position(x, y);
        }

        if (typeof this._focusRitualLabel.raise_top === 'function') {
            this._focusRitualLabel.raise_top();
        }
        this._focusRitualLabel.show();

        // Gentle fade-in of the focus frame so the "entry" is smooth, not abrupt.
        let fstyleFade = this._opt_frameStyle || 'glow';
        let framesToFade = (fstyleFade === 'glow' || fstyleFade === 'corners') ? this._focusGlowFrames : this._focusFrames;

        // Hold duration for the start ritual (fade-in + fade-out ≈ 1.1s).
        let holdMs = Math.max(0, (4 * 1000) - 1100);

        if (this._opt_reduceMotion) {
            // No motion: show frame + label instantly, hold, then hide.
            for (let frame of framesToFade) {
                frame.opacity = 255;
                frame.show();
            }
            this._focusRitualLabel.opacity = 255;
            let holdId = Mainloop.timeout_add(holdMs + 600, () => {
                this._removeRitualTimeout(holdId);
                if (this._focusRitualLabel) {
                    this._focusRitualLabel.hide();
                }
                return false;
            });
            this._focusRitualTimeouts.push(holdId);
            return;
        }

        for (let frame of framesToFade) {
            this._animateActorOpacity(frame, 0, 255, POMODORO_FOCUS_RITUAL_FRAME_FADE_MS, null);
        }

        // Fade the centered label in, hold, then fade out and hide.
        this._animateActorOpacity(this._focusRitualLabel, 0, 255, POMODORO_FOCUS_RITUAL_FADE_IN_MS, () => {
            let holdId = Mainloop.timeout_add(holdMs, () => {
                this._removeRitualTimeout(holdId);
                this._animateActorOpacity(this._focusRitualLabel, 255, 0, POMODORO_FOCUS_RITUAL_FADE_OUT_MS, () => {
                    if (this._focusRitualLabel) {
                        this._focusRitualLabel.hide();
                    }
                });
                return false;
            });
            this._focusRitualTimeouts.push(holdId);
        });
    };

    proto._cancelGlowBreath = function() {
        if (this._glowBreathTimeouts) {
            for (let id of this._glowBreathTimeouts) {
                Mainloop.source_remove(id);
            }
        }
        this._glowBreathTimeouts = [];
        this._glowBreathBoost = 0;
    };

    proto._playGlowBreath = function() {
        if (this._opt_reduceMotion) {
            return;
        }
        this._cancelGlowBreath();

        let steps = Math.max(1, Math.round(POMODORO_FOCUS_GLOW_BREATH_MS / POMODORO_FOCUS_RITUAL_STEP_MS));
        let i = 0;
        let sourceId = Mainloop.timeout_add(POMODORO_FOCUS_RITUAL_STEP_MS, () => {
            i++;
            let t = Math.min(1, i / steps);
            this._glowBreathBoost = POMODORO_FOCUS_GLOW_BREATH_BOOST * Math.sin(Math.PI * t);
            if (this._focusGlowFrames) {
                for (let glow of this._focusGlowFrames) {
                    glow.queue_repaint();
                }
            }
            if (t >= 1) {
                this._glowBreathBoost = 0;
                let idx = this._glowBreathTimeouts.indexOf(sourceId);
                if (idx >= 0) {
                    this._glowBreathTimeouts.splice(idx, 1);
                }
                if (this._focusGlowFrames) {
                    for (let glow of this._focusGlowFrames) {
                        glow.queue_repaint();
                    }
                }
                return false;
            }
            return true;
        });
        this._glowBreathTimeouts.push(sourceId);
    };

    proto._destroyFocusFrame = function() {
        this._stopFocusFramePulse();
        this._cancelFocusRitual();
        this._cancelGlowBreath();

        if (this._focusFrameMonitorsChangedId && Main.layoutManager) {
            Main.layoutManager.disconnect(this._focusFrameMonitorsChangedId);
            this._focusFrameMonitorsChangedId = null;
        }

        this._destroyFocusFrameActors();
    };
}
