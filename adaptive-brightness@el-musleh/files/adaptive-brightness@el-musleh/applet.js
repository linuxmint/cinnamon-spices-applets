/*
Adaptive Brightness applet for Cinnamon

Reads an ambient light sensor (sysfs) and maps lux values to a
brightness percentage. The mapping is logarithmic to approximate
human perception. The applet includes smoothing, hysteresis and
defensive checks to avoid crashing Cinnamon.

Maintainer notes / best-practices applied:
- Validate settings and apply changes at runtime
- Avoid silent catch blocks; log errors for diagnostics
- Prefer non-blocking GLib.spawn_command_line_async for external calls
- Keep scheduled poll loop non-reentrant and robust to failures
*/

const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;
const Meta = imports.gi.Meta;

// Constraints and defaults
const POLL_INTERVAL = { MIN: 100, DEFAULT: 1000, MAX: 60000 };
const BRIGHTNESS = { MIN: 1, MAX: 100, DEFAULT_MIN: 10, DEFAULT_MAX: 100 };
const BRIGHTNESS_AUTO = { MIN_APPLY_DELTA: 2 };
const MIN_BRIGHTNESS_DELTA = { DEFAULT: 2, MIN: 1, MAX: 10 };
const SMOOTHING = { MIN: 0, MAX: 0.95, DEFAULT: 0.7 };
const LUX = {
    DEFAULT_MAX: 700,
    DEFAULT_MIN: 10,
    MIN_MAX: 100,
    MIN_MIN: 0,
    MAX_MIN: 5000,
    MIN_RANGE_RATIO: 0.20,
    // Minimum absolute gap (lux) required between min-lux and max-lux during calibration
    MIN_GAP: 10,
    // Cap for the max allowed noise floor in dark calibration (lux)
    MAX_DAMPED_GAP: 1000,
    // Ratio for enforcing minimum gap between min-lux and max-lux in settings validation
    GAP_ENFORCEMENT_RATIO: 0.05
};
// Minimum lux change required before recomputing brightness (noise dead-band).
const LUX_CHANGE_THRESHOLD = { DEFAULT: 3, MIN: 0, MAX: 50 };
const MANUAL_DEBOUNCE_WINDOW = { DEFAULT: 5, MIN: 5, MAX: 120 };
const CALIBRATION_EXPECTED_SAMPLES = 50;

// Mathematical constants for response curves
const SIGMOIDAL_CENTER = 0.5;
const SIGMOIDAL_STEEPNESS = -10;
const LOG_OFFSET = 1;
const PERCENTAGE_TO_NORMALIZED = 0.01;

// Sentinel values for uninitialized state
const UNINITIALIZED_VALUE = -1;
const INITIAL_COUNTER_VALUE = 0;

// Calibration constants
const CALIBRATION_COUNTDOWN_SECONDS = 10;
const CALIBRATION_POLL_INTERVAL_MS = 200;
const TIMER_INTERVAL_1_SECOND_MS = 1000;
const TIMER_INTERVAL_10_SECONDS_MS = 10000;
const SENSOR_REDISCOVERY_POLLS = 30;
const RAW_LUX_WINDOW_SIZE = 9;

// Idle detection threshold: if user has been idle this long, brightness changes are
// treated as OS idle-dimming (not manual override) to avoid blocking screen lock.
const IDLE_THRESHOLD_US = 3 * 1000000; // 3 seconds in microseconds

const CAL_PHASE = { NONE: "none", DARK: "dark", BRIGHT: "bright" };
const LABEL_DISPLAY_MODES = ["brightness", "lux", "brightness_lux"];

// Strategy map for lux-to-brightness response curves.
// Each function receives (normalizedLux, luxRange, effMin) and returns normalized brightness in [0,1].
// Note: linear and sigmoidal ignore luxRange/effMin; logarithmic uses effMin when available.
const RESPONSE_CURVES = {
    linear: (n) => n,
    sigmoidal: (n) => 1 / (1 + Math.exp(SIGMOIDAL_STEEPNESS * (n - SIGMOIDAL_CENTER))),
    logarithmic: (n, luxRange, effMin) => {
        if (effMin > 0) {
            const k = luxRange / effMin;
            return Math.log(n * k + LOG_OFFSET) / Math.log(k + LOG_OFFSET);
        }
        return Math.log(n * luxRange + LOG_OFFSET) / Math.log(luxRange + LOG_OFFSET);
    },
};


/**
 * Modal dialog that displays a live-computed lux-to-brightness mapping table
 * for all three response curves, using the applet's current settings.
 */
let CurvePreviewDialog = GObject.registerClass(
    class CurvePreviewDialog extends ModalDialog.ModalDialog {
        _init(titleText, bodyText) {
            super._init({ styleClass: "curve-preview-dialog" });
            let title = new St.Label({ text: titleText, style_class: "curve-preview-title" });
            let body = new St.Label({ text: bodyText, style_class: "curve-preview-body" });
            this.contentLayout.add_child(title);
            this.contentLayout.add_child(body);
            this.setButtons([{ label: "Close", action: () => this.close() }]);
        }
    });

/**
 * Main applet class that reads an ambient light sensor and adjusts screen brightness.
 *
 * Features:
 * - Multiple response curves (linear, sigmoidal, logarithmic)
 * - Manual calibration (dark/bright) with high-speed sampling
 * - Comprehensive logging for diagnostics
 */
class AdaptiveBrightnessApplet extends Applet.TextIconApplet {
    /**
     * Create a new AdaptiveBrightnessApplet instance.
     *
     * @param {Object} metadata    - Cinnamon applet metadata (uuid, name, etc.).
     * @param {number} orientation - Panel orientation constant.
     * @param {number} panelHeight - Panel height in pixels.
     * @param {number} instanceId  - Unique instance identifier.
     */
    constructor(metadata, orientation, panelHeight, instanceId) {
        try {
            super(orientation, panelHeight, instanceId);
            this.metadata = metadata;
            this.set_applet_icon_name("display-brightness-symbolic");
            this.set_applet_label("");

            // Runtime state
            this._isRunning = false;        // re-entrancy guard for the poll loop
            this._loopStartTime = 0;        // monotonic time when current loop started (detect stale guard)
            this._screenShieldId = null;    // signal connection id for screen-shield unlock
            this._loopId = null;           // Mainloop source id for scheduled polling
            this._scheduleTimerId = null;    // Mainloop source id for schedule off-period timer
            this._enabled = true;          // user toggle state
            this._sensorAvailable = false; // whether a usable sensor was found
            this._sensorPath = null;       // the chosen sensor path object
            this._brightness = null;       // buffered (smoothed) brightness value
            this._previousBrightness = UNINITIALIZED_VALUE; // last applied brightness
            this._lastLux = UNINITIALIZED_VALUE;            // most recent lux reading
            this._lastAppliedLux = UNINITIALIZED_VALUE;     // lux value that last triggered a brightness recomputation
            this._errorCount = INITIAL_COUNTER_VALUE;          // consecutive error count
            this._lastError = null;        // last error message logged
            this._lastPollInterval = undefined; // tracks poll interval changes
            this._backlightPath = undefined;    // Cached sysfs backlight device path (undefined = not yet searched, null = searched but not found)
            this._brightnessctlPath = GLib.find_program_in_path('brightnessctl'); // Discovered at startup
            this._brightnessctlDirectFailed = false; // Set to true when direct spawn fails so we fallback to sudo
            this._brightnessFailureNotified = false; // One-time user notify on persistent apply failure
            this._sensorRetryCounter = INITIAL_COUNTER_VALUE;
            this._scheduleCausedDisable = false; // True when schedule turned applet off
            this._rawLuxWindow = [];           // Rolling window for median-filtering raw lux
            this._luxEMA = null;               // Exponential moving average of filtered lux
            this._manualOverrideEndTime = 0;              // Monotonic time (us) until manual override cooldown expires
            this._lastAdoptedManualBrightness = UNINITIALIZED_VALUE; // Last brightness adopted as manual override
            this._lastAdoptedManualTime = 0;                        // When it was adopted (monotonic us)
            this._calibration = {
                phase: CAL_PHASE.NONE,
                timerId: null,
                countdownId: null,
                darkSamples: [],
                brightSamples: [],
                brightMax: INITIAL_COUNTER_VALUE,
                countdown: INITIAL_COUNTER_VALUE,
                pollId: null,
                originalPollInterval: null,
                normalLoopPaused: false,
                mutex: false,             // Prevent race conditions
            };

            // Settings with safe defaults
            this.min_brightness = BRIGHTNESS.DEFAULT_MIN;
            this.max_brightness = BRIGHTNESS.DEFAULT_MAX;
            this.smoothing_factor = SMOOTHING.DEFAULT;
            this.max_lux = LUX.DEFAULT_MAX;
            this.poll_interval = POLL_INTERVAL.DEFAULT;
            this.min_lux = LUX.DEFAULT_MIN;
            this.sensor_path = "";
            this.show_label = "live_status";
            // NOTE: label_display_mode default must match settings-schema.json and gschema.xml
            this.label_display_mode = "brightness";
            this.response_curve = "logarithmic";
            this.lux_change_threshold = LUX_CHANGE_THRESHOLD.DEFAULT;
            this.min_brightness_delta = MIN_BRIGHTNESS_DELTA.DEFAULT;
            this.manual_debounce_window = MANUAL_DEBOUNCE_WINDOW.DEFAULT;
            this.schedule_enabled = false;
            this.schedule_off_start = { h: 22, m: 0, s: 0 };
            this.schedule_off_end = { h: 6, m: 0, s: 0 };
            this.log_level = "off";

            // Initialise file logger before settings so early errors are captured.
            const logDir = GLib.get_user_data_dir() +
                "/cinnamon/applets/adaptive-brightness@el-musleh/logs";
            this._logger = new ABLogger(logDir, "off");

            this._init_settings(metadata, instanceId);
            this._on_log_level_changed();
            this._logger.info("Applet starting (instance " + instanceId + ")");
            this._start();
        } catch (e) {
            try {
                if (this._logger) this._logger.error("Constructor: " + (e && e.message ? e.message : e));
            } catch (_) {
                // Logger may itself be broken; swallow to avoid infinite error recursion.
            }
            // Fallback to global.logError if logger initialization failed
            try { global.logError("[AB] Constructor: " + (e && e.message ? e.message : e)); } catch (_) {
                // global.logError may also be unavailable; final fallback is silent.
            }
            this.set_applet_icon_name("dialog-error-symbolic");
            this.set_applet_label(" ⚠");
        }
    }

    /**
     * Detect whether the user changed brightness outside the applet since last apply.
     *
     * @param {number|null} currentBrightness - Actual system brightness 0-100.
     * @returns {boolean} True when a manual override is detected.
     */
    _is_manual_brightness_override(currentBrightness) {
        if (currentBrightness === null || this._previousBrightness < 0) {
            return false;
        }
        const delta = Math.abs(currentBrightness - this._previousBrightness);
        if (delta < this.min_brightness_delta) {
            return false;
        }
        // Check if user is idle — brightness changes during idle are likely OS idle-dimming,
        // not manual user intervention. Treating them as manual overrides would fight the
        // OS and prevent screen lock from engaging.
        try {
            const idleTime = Meta.IdleMonitor.get_core_monitor().get_idletime();
            if (idleTime > IDLE_THRESHOLD_US) {
                this._logger.debug("Ignoring brightness change during idle (idleTime=" + (idleTime / 1000000).toFixed(1) + "s) — treating as OS idle-dimming.");
                return false;
            }
        } catch (e) {
            // IdleMonitor may be unavailable; fall through to normal detection.
        }
        // Debounce repeated adoption of the same brightness — prevents bouncing
        // when an external brightness daemon keeps resetting the screen.
        const now = GLib.get_monotonic_time();
        const windowSec = Math.min(this.manual_debounce_window || MANUAL_DEBOUNCE_WINDOW.DEFAULT, MANUAL_DEBOUNCE_WINDOW.MAX);
        if (this._lastAdoptedManualBrightness >= 0 &&
            Math.abs(currentBrightness - this._lastAdoptedManualBrightness) < this.min_brightness_delta &&
            (now - this._lastAdoptedManualTime) < windowSec * 1000000) {
            this._logger.debug("Manual override debounced (brightness=" + currentBrightness + "%), treating as external interference.");
            return false;
        }
        return true;
    }

    /**
     * Sync internal state and panel display to a user-set brightness level.
     *
     * @param {number} currentBrightness - Actual system brightness 0-100.
     * @param {number} lux             - Current lux reading for label/tooltip.
     */
    _adopt_manual_brightness(currentBrightness, lux) {
        // Preserve the adaptive smoothing buffer (_brightness) so that when
        // the cooldown expires the transition back to adaptive is smooth.
        const now = GLib.get_monotonic_time();
        const cooldownSec = Math.min(this.manual_debounce_window || MANUAL_DEBOUNCE_WINDOW.DEFAULT, MANUAL_DEBOUNCE_WINDOW.MAX);
        this._previousBrightness = currentBrightness;
        this._lastLux = lux;
        this._manualOverrideEndTime = now + cooldownSec * 1000000;
        this._lastAdoptedManualBrightness = currentBrightness;
        this._lastAdoptedManualTime = now;
        if (this.show_label !== "hide_actor") {
            this.set_applet_icon_name("display-brightness-symbolic");
        }
        this._update_label(currentBrightness, lux);
        this._update_live_tooltip(lux, currentBrightness);
        this._logger.debug("Manual brightness override adopted: " + currentBrightness + "%. Cooldown=" + cooldownSec + "s.");
    }

    /**
     * Parse brightness percentage from brightnessctl -m machine output.
     * Format: device,class,current_raw,percentage,max_raw (e.g. intel_backlight,backlight,132,33%,400)
     *
     * @param {string} stdout - Raw stdout from brightnessctl -m.
     * @returns {number|null} Brightness percentage 0-100, or null if unparseable.
     */
    _parse_brightnessctl_machine(stdout) {
        const parts = stdout.trim().split(',');
        for (let i = 0; i < parts.length; i++) {
            if (String(parts[i]).indexOf('%') >= 0) {
                const pct = parseInt(String(parts[i]).replace('%', ''), 10);
                if (Number.isFinite(pct)) {
                    return Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, pct));
                }
            }
        }
        if (parts.length >= 5) {
            const current = parseInt(parts[2], 10);
            const max = parseInt(parts[4], 10);
            if (Number.isFinite(current) && Number.isFinite(max) && max > 0) {
                return Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, Math.round(current / max * 100)));
            }
        }
        return null;
    }

    /**
     * Cinnamon lifecycle: called after the applet actor is added to the panel.
     * Guarantees this.actor is available, so we can apply any deferred hide mode
     * that was skipped during constructor settings binding.
     */
    on_applet_added_to_panel() {
        try {
            this._on_show_label_changed();
        } catch (e) {
            this._logger.error("on_applet_added_to_panel: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Bind all settings keys to local fields and perform initial validation.
     * Cinnamon's settings system automatically preserves existing values on update
     * and uses schema defaults for fresh installations.
     *
     * @param {Object} metadata   - Cinnamon applet metadata.
     * @param {number} instanceId - Unique instance identifier.
     */
    _init_settings(metadata, instanceId) {
        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
            const validator = this._validate_settings.bind(this);
            this.settings.bind("min-brightness", "min_brightness", validator);
            this.settings.bind("max-brightness", "max_brightness", validator);
            this.settings.bind("smoothing-factor", "smoothing_factor", validator);
            this.settings.bind("max-lux", "max_lux", this._on_max_lux_changed.bind(this));
            this.settings.bind("poll-interval", "poll_interval", validator);
            this.settings.bind("min-lux", "min_lux", this._on_min_lux_changed.bind(this));
            this.settings.bind("show-label", "show_label", this._on_show_label_changed.bind(this));
            this.settings.bind("label-display-mode", "label_display_mode", this._on_show_label_changed.bind(this));
            this.settings.bind("response-curve", "response_curve", validator);
            this.settings.bind("lux-change-threshold", "lux_change_threshold", this._on_lux_threshold_changed.bind(this));
            this.settings.bind("min-brightness-delta", "min_brightness_delta", validator);
            this.settings.bind("sensor-path", "sensor_path", this._on_sensor_path_changed.bind(this));
            this.settings.bind("log-level", "log_level", this._on_log_level_changed.bind(this));
            this.settings.bind("manual-debounce-window", "manual_debounce_window", validator);
            this.settings.bind("schedule-enabled", "schedule_enabled", this._on_schedule_changed.bind(this));
            this.settings.bind("schedule-off-start", "schedule_off_start", this._on_schedule_changed.bind(this));
            this.settings.bind("schedule-off-end", "schedule_off_end", this._on_schedule_changed.bind(this));

            // Initial validation applies defaults and may trigger an immediate
            // brightness computation if a recent lux exists.
            this._validate_settings();
        } catch (e) {
            this._logger.error("Settings init failed: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Callback for the lux-change-threshold setting change.
     * Resets the dead-band anchor so the next poll recalculates with the new threshold.
     */
    _on_lux_threshold_changed() {
        try {
            this._lastAppliedLux = UNINITIALIZED_VALUE;
            this._validate_settings();
            this._logger.info("Lux change threshold changed — dead-band anchor reset.");
        } catch (e) {
            this._logger.error("lux-threshold callback: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Callback for the sensor-path setting change.
     * Resets sensor availability and the dead-band so the next poll re-evaluates everything.
     */
    _on_sensor_path_changed() {
        try {
            this._sensorAvailable = false;
            this._sensorPath = null;
            this._locate_sensor();
            this._errorCount = INITIAL_COUNTER_VALUE;
            this._lastAppliedLux = UNINITIALIZED_VALUE;  // Reset dead-band so first poll always applies
            this._update_tooltip();
            this._logger.info("Sensor path changed — resetting error counter and dead-band.");
        } catch (e) {
            this._logger.error("sensor-path binding callback: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Locate the ambient light sensor and start the polling loop.
     */
    _start() {
        try {
            this._locate_sensor();
            this._update_tooltip();
            // Force a poll when the screen is unlocked so we don't wait for the
            // next scheduled tick after a lock/suspend that froze the JS runtime.
            if (Main.screenShield && !this._screenShieldId) {
                this._screenShieldId = Main.screenShield.connect('active-changed', (shield, active) => {
                    if (!active && this._enabled) {
                        this._logger.info("Screen unlocked — forcing adaptive poll.");
                        this._do_loop();
                    }
                });
            }
            this._schedule_next_loop();
            this._logger.info("Polling started (interval=" + this.poll_interval + "ms).");
            this._apply_schedule();
        } catch (e) {
            this._logger.error("_start failed: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Callback for the min-lux setting change.
     * Validates and clamps the new value.
     */
    _on_min_lux_changed() {
        try {
            this._validate_settings();
        } catch (e) {
            this._logger.error("min-lux callback: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Callback for the max-lux setting change.
     * Validates and clamps the new value.
     */
    _on_max_lux_changed() {
        try {
            this._validate_settings();
        } catch (e) {
            this._logger.error("max-lux callback: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Callback when the log-level setting changes.
     * Updates the logger's enabled state and level to match the new setting.
     */
    _on_log_level_changed() {
        try {
            this._logger.info("Log level changed to: " + this.log_level);
            if (this.log_level === "off") {
                this._logger.setEnabled(false);
            } else {
                this._logger.setEnabled(true);
                this._logger.setLevel(this.log_level);
            }
        } catch (e) {
            this._logger.error("Log level callback: " + (e && e.message ? e.message : e));
        }
    }


    /**
     * Parse schedule time settings from JSON strings if needed.
     * Cinnamon's gsettings may return JSON strings for timechooser values.
     */
    _parse_schedule_time() {
        try {
            if (typeof this.schedule_off_start === 'string') {
                this.schedule_off_start = JSON.parse(this.schedule_off_start);
            }
            if (typeof this.schedule_off_end === 'string') {
                this.schedule_off_end = JSON.parse(this.schedule_off_end);
            }
        } catch (e) {
            this._logger.error("Schedule time parse failed: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Callback when any schedule setting changes.
     * Re-evaluates whether we are currently in the off-period and reschedules
     * the next transition boundary.
     */
    _on_schedule_changed() {
        try {
            this._parse_schedule_time();
            this._apply_schedule();
            this._logger.info("Schedule settings changed — re-evaluating off period.");
        } catch (e) {
            this._logger.error("Schedule changed callback: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Determine whether the current time falls inside the configured off-period.
     * Supports ranges that cross midnight (e.g., 22:00 to 06:00).
     *
     * @param {Date} now - Current local time.
     * @returns {boolean} True if now is within the off-period.
     */
    _is_in_off_period(now) {
        const start = this.schedule_off_start;
        const end = this.schedule_off_end;
        if (!start || !end) return false;
        const startSec = (start.h * 3600) + (start.m * 60) + (start.s || 0);
        const endSec = (end.h * 3600) + (end.m * 60) + (end.s || 0);
        const nowSec = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
        if (startSec <= endSec) {
            return nowSec >= startSec && nowSec < endSec;
        } else {
            return nowSec >= startSec || nowSec < endSec;
        }
    }

    /**
     * Apply the schedule: disable the applet if currently in the off-period,
     * re-enable it if outside, and schedule the next boundary check.
     */
    _apply_schedule() {
        try {
            if (!this.schedule_enabled) {
                if (this._scheduleTimerId) {
                    Mainloop.source_remove(this._scheduleTimerId);
                    this._scheduleTimerId = null;
                }
                // Restore applet only if schedule was the one that turned it off
                if (!this._enabled && this._scheduleCausedDisable) {
                    this._set_enabled(true, "schedule disabled");
                    this._scheduleCausedDisable = false;
                }
                return;
            }
            const start = this.schedule_off_start;
            const end = this.schedule_off_end;
            if (!start || !end) return;
            const startSec = (start.h * 3600) + (start.m * 60) + (start.s || 0);
            const endSec = (end.h * 3600) + (end.m * 60) + (end.s || 0);
            // If start == end the window is zero-length — treat as no schedule
            if (startSec === endSec) {
                this._logger.info("Schedule: start == end, treating as disabled.");
                return;
            }
            const now = new Date();
            const inOff = this._is_in_off_period(now);
            if (inOff && this._enabled) {
                this._set_enabled(false, "schedule");
                this._scheduleCausedDisable = true;
            } else if (!inOff && !this._enabled && this._scheduleCausedDisable) {
                this._scheduleCausedDisable = false;
                this._set_enabled(true, "schedule");
            }
            this._schedule_next_transition();
        } catch (e) {
            this._logger.error("Apply schedule: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Schedule a one-shot timer for the next schedule boundary (start or end).
     * After the timer fires, _apply_schedule is called to toggle state and
     * reschedule the following boundary.
     */
    _schedule_next_transition() {
        try {
            if (!this.schedule_enabled) return;
            if (this._scheduleTimerId) {
                Mainloop.source_remove(this._scheduleTimerId);
                this._scheduleTimerId = null;
            }
            const now = new Date();
            const start = this.schedule_off_start;
            const end = this.schedule_off_end;
            const startSec = (start.h * 3600) + (start.m * 60) + (start.s || 0);
            const endSec = (end.h * 3600) + (end.m * 60) + (end.s || 0);
            const nowSec = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
            let nextBoundarySec;
            let inOff;
            if (startSec <= endSec) {
                inOff = nowSec >= startSec && nowSec < endSec;
                nextBoundarySec = inOff ? endSec : startSec;
            } else {
                inOff = nowSec >= startSec || nowSec < endSec;
                nextBoundarySec = inOff ? endSec : startSec;
            }
            let diffSec = nextBoundarySec - nowSec;
            if (diffSec <= 0) diffSec += 24 * 3600;
            this._scheduleTimerId = Mainloop.timeout_add_seconds(diffSec, () => {
                this._scheduleTimerId = null;
                this._apply_schedule();
                return false;
            });
            const boundaryLabel = inOff ? "end" : "start";
            this._logger.info("Next schedule " + boundaryLabel + " in " + diffSec + "s.");
        } catch (e) {
            this._logger.error("Schedule next transition: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Set the applet enabled or disabled, updating icon, label, tooltip, and
     * starting or stopping the poll loop. Used by both user clicks and the
     * schedule timer.
     *
     * @param {boolean} enable - Desired enabled state.
     * @param {string} [reason] - Optional reason for the change (logged).
     */
    _set_enabled(enable, reason) {
        try {
            this._enabled = enable;
            this._lastAdoptedManualBrightness = UNINITIALIZED_VALUE;
            this._lastAdoptedManualTime = 0;
            if (this._enabled) {
                this._lastAppliedLux = UNINITIALIZED_VALUE;
                this._rawLuxWindow = [];
                this._luxEMA = null;
            }
            if (this.show_label !== "hide_actor") {
                if (this._enabled) {
                    this.set_applet_icon_name("display-brightness-symbolic");
                } else {
                    this.set_applet_icon_name("weather-clear-night-symbolic");
                }
            }
            this._update_label();
            this._update_tooltip();
            const reasonText = reason ? " (" + reason + ")" : "";
            this._logger.info("Applet " + (this._enabled ? "enabled" : "disabled") + reasonText + ".");

            if (this._enabled) {
                this._errorCount = INITIAL_COUNTER_VALUE;
                this._sensorRetryCounter = INITIAL_COUNTER_VALUE;
                this._locate_sensor();
                this._update_tooltip();
                if (!this._isRunning) {
                    try {
                        this._do_loop();
                    } catch (e) {
                        this._logger.error("Immediate loop on enable failed: " + (e && e.message ? e.message : e));
                        this._schedule_next_loop();
                    }
                } else {
                    this._schedule_next_loop();
                }
            }
        } catch (e) {
            this._logger.error("_set_enabled: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Open the log file in the default text editor (settings button callback).
     */
    _open_log_file() {
        try {
            this._logger.ensureLogFile();
            const path = this._logger.getLogPath();
            this._logger.info("Log viewer opened.");
            GLib.spawn_async(null, ['xdg-open', path], null, GLib.SpawnFlags.SEARCH_PATH, null, null);
        } catch (e) {
            this._logger.error("_open_log_file failed: " + (e && e.message ? e.message : e));
            Main.notify("Adaptive Brightness",
                "Failed to open log file. Check that xdg-open is installed and a text editor is configured.");
        }
    }

    /**
     * Show a modal dialog with a live-computed lux-to-brightness mapping table
     * for all three response curves, using current min/max lux and brightness settings.
     * (settings button callback)
     */
    _show_curve_preview() {
        try {
            const minB = this.min_brightness;
            const maxB = this.max_brightness;
            const minLux = this.min_lux;
            const maxLux = this.max_lux;
            const luxRange = maxLux - minLux;
            const bRange = maxB - minB;

            if (bRange <= 0 || luxRange <= 0) {
                new CurvePreviewDialog(
                    "Curve Mapping Preview — Invalid Range",
                    "Check that Maximum Brightness > Minimum Brightness\nand Maximum Lux > Minimum Lux."
                ).open();
                return;
            }

            const targets = [0, 20, 40, 60, 80, 100];
            const curves = ["linear", "logarithmic", "sigmoidal"];
            const labels = { linear: "Linear", logarithmic: "Logarithmic", sigmoidal: "Sigmoidal" };
            const active = this.response_curve;

            // Compute lux for each (targetBrightness, curve)
            const rows = targets.map(tgt => {
                const cells = curves.map(curve => {
                    // Boundary: brightness at/below min maps to minLux; at/above max maps to maxLux
                    if (tgt <= minB) return "≤" + String(minLux);
                    if (tgt >= maxB) return "≥" + String(maxLux);
                    const norm = (tgt - minB) / bRange;
                    let lux;
                    if (curve === "linear") {
                        lux = minLux + norm * luxRange;
                    } else if (curve === "logarithmic") {
                        if (minLux <= 0) return " — ";
                        lux = minLux * Math.exp(norm * Math.log(maxLux / minLux));
                    } else {
                        // sigmoidal
                        if (norm <= 0.01 || norm >= 0.99) return " — ";
                        let n = SIGMOIDAL_CENTER - Math.log(1 / norm - 1) / Math.abs(SIGMOIDAL_STEEPNESS);
                        n = Math.max(0, Math.min(1, n));
                        lux = minLux + n * luxRange;
                    }
                    lux = Math.round(lux);
                    if (lux < 0) return "< 0";
                    if (lux > maxLux) return maxLux + " (capped)";
                    return String(lux);
                });
                return { tgt, cells };
            });

            // Build monospace table text
            const maxTgt = 5;   // "80%"
            const colW = 7;     // e.g. "700 cap"
            const pad = (s, w) => String(s).padStart(w);
            let body = pad("Target", maxTgt) + "  " +
                curves.map(c => {
                    const label = labels[c] + (c === active ? " *" : "");
                    return pad(label, colW + 2);
                }).join("  ") + "\n";
            body += "─".repeat(maxTgt + 2 + curves.length * (colW + 4)) + "\n";
            for (const row of rows) {
                body += pad(row.tgt + "%", maxTgt) + "  " +
                    row.cells.map(c => pad(c, colW + 2)).join("  ") + "\n";
            }
            body += "\n* = currently selected curve (" + labels[active] + ")\n";
            body += "Lower lux = darker environment needed to reach that brightness.";

            const title = "Curve Mapping Preview (min=" + minLux + " lux, max=" + maxLux + " lux, " + minB + "%→" + maxB + "%)";
            new CurvePreviewDialog(title, body).open();
        } catch (e) {
            this._logger.error("_show_curve_preview failed: " + (e && e.message ? e.message : e));
            Main.notify("Adaptive Brightness", "Failed to build curve preview. Check the log for details.");
        }
    }

    /**
     * Check whether a value is a valid non-negative finite lux reading.
     *
     * @param {*} lux - Value to validate.
     * @returns {boolean} True if lux is a valid reading.
     */
    _has_valid_lux(lux) {
        try {
            return lux !== null && lux !== undefined && Number.isFinite(lux) && lux >= 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * Format a lux value for display.
     *
     * @param {number} lux - Lux value.
     * @returns {string} Formatted string (e.g. "312 lux").
     */
    _format_lux(lux) {
        try {
            return Math.round(lux) + " lux";
        } catch (e) {
            return "? lux";
        }
    }

    /**
     * Update the live tooltip with current lux and brightness values.
     *
     * @param {number|null} lux       - Current lux reading.
     * @param {number|null} brightness - Current brightness percentage.
     */
    _update_live_tooltip(lux, brightness) {
        try {
            const luxText = this._has_valid_lux(lux) ? this._format_lux(lux) : "unknown";
            const brightnessText = brightness !== null && brightness !== undefined && Number.isFinite(brightness)
                ? Math.round(brightness) + "%"
                : "calculating";
            let tooltip = "Light: " + luxText + " | Brightness: " + brightnessText;
            this.set_applet_tooltip(tooltip);
        } catch (e) {
            this._logger.error("_update_live_tooltip: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Update the panel label to reflect current enabled/brightness/lux state.
     * Pass an explicit brightness value when it differs from this._brightness
     * (e.g. the rounded finalBrightness computed in _do_loop).
     *
     * @param {number} [brightness] - Explicit brightness to display.
     * @param {number} [lux]        - Explicit lux to display.
     */
    _update_label(brightness, lux) {
        try {
            if (this.show_label === "hide_actor" || this.show_label === "icon_only") {
                this.set_applet_label("");
                return;
            }
            if (!this._enabled) {
                this.set_applet_label(" Off");
                return;
            }
            const b = (brightness !== undefined)
                ? brightness
                : (this._brightness !== null ? Math.round(this._brightness) : null);
            const currentLux = this._has_valid_lux(lux)
                ? lux
                : (this._has_valid_lux(this._lastLux) ? this._lastLux : null);

            let label = "";
            const mode = LABEL_DISPLAY_MODES.includes(this.label_display_mode)
                ? this.label_display_mode
                : "brightness";
            switch (mode) {
                case "lux":
                    label = currentLux !== null ? this._format_lux(currentLux) : "";
                    break;
                case "brightness_lux":
                    if (b !== null && currentLux !== null) {
                        label = b + "% | " + this._format_lux(currentLux);
                    } else if (b !== null) {
                        label = b + "%";
                    } else if (currentLux !== null) {
                        label = this._format_lux(currentLux);
                    }
                    break;
                case "brightness":
                default:
                    label = b !== null ? b + "%" : "";
                    break;
            }

            this.set_applet_label(label ? " " + label : "");
        } catch (e) {
            this._logger.error("_update_label: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Update the panel label immediately when the show_label setting changes.
     * Handles hide_actor mode by showing/hiding the applet actor.
     */
    _on_show_label_changed() {
        try {
            // Handle hide_actor mode only when actor is available (may not exist during constructor)
            if (this.show_label === "hide_actor") {
                if (this.actor) this.actor.hide();
                return;
            }
            if (this.actor) this.actor.show();
            this._update_label(undefined, this._lastLux);
            this._update_tooltip();
        } catch (e) {
            this._logger.error("_on_show_label_changed: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Calculate the median of an array for robust outlier filtering.
     *
     * @param {number[]} values - Numeric array.
     * @returns {number} Median value, or 0 for empty input.
     */
    _median(values) {
        try {
            if (!values || values.length === 0) return 0;
            const sorted = values.slice().sort(function (a, b) { return a - b; });
            const mid = Math.floor(sorted.length / 2);
            if (sorted.length % 2 === 0) {
                return (sorted[mid - 1] + sorted[mid]) / 2;
            }
            return sorted[mid];
        } catch (e) {
            this._logger.error("_median failed: " + (e && e.message ? e.message : e));
            return 0;
        }
    }

    /**
     * Calculate a percentile of an array for robust outlier filtering.
     *
     * @param {number[]} values    - Numeric array.
     * @param {number}   percentile - Percentile to compute (0-100).
     * @returns {number} The requested percentile, or 0 for empty input.
     */
    _percentile(values, percentile) {
        try {
            if (!values || values.length === 0) return 0;
            const sorted = values.slice().sort(function (a, b) { return a - b; });
            const index = Math.floor((percentile / 100) * (sorted.length - 1));
            return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
        } catch (e) {
            this._logger.error("_percentile failed: " + (e && e.message ? e.message : e));
            return 0;
        }
    }

    /**
     * Atomically update the poll interval with mutex protection.
     * Note: This mutex is safe because GJS/Cinnamon runs JavaScript in a single thread,
     * so there are no true race conditions. The flag is for logical state management.
     *
     * @param {number} newInterval - Desired poll interval in milliseconds.
     * @returns {boolean} True if the change was applied, false if blocked by calibration mutex.
     */
    _set_poll_interval_safe(newInterval) {
        if (this._calibration.mutex) {
            this._logger.debug("Poll interval change blocked by calibration mutex");
            return false;
        }
        this.poll_interval = newInterval;
        return true;
    }

    /**
     * Restore the original poll interval after calibration completes.
     * Releases the calibration mutex and resumes normal polling.
     */
    _restore_poll_interval() {
        if (this._calibration.originalPollInterval !== null) {
            // Clamp the restored interval to valid bounds (defense-in-depth)
            this.poll_interval = Math.max(POLL_INTERVAL.MIN,
                Math.min(POLL_INTERVAL.MAX, this._calibration.originalPollInterval));
            this._calibration.originalPollInterval = null;
            this._calibration.normalLoopPaused = false;
            this._calibration.mutex = false; // Release mutex
            this._schedule_next_loop();
            this._logger.info("Restored original poll interval: " + this.poll_interval + "ms");
        }
    }

    /**
     * Undo partial calibration startup after an exception (timers, mutex, poll pause).
     */
    _rollback_calibration_start() {
        if (!this._calibration.mutex && !this._calibration.normalLoopPaused) {
            return;
        }
        try {
            if (this._calibration.pollId) {
                Mainloop.source_remove(this._calibration.pollId);
                this._calibration.pollId = null;
            }
            if (this._calibration.countdownId) {
                Mainloop.source_remove(this._calibration.countdownId);
                this._calibration.countdownId = null;
            }
            if (this._calibration.timerId) {
                Mainloop.source_remove(this._calibration.timerId);
                this._calibration.timerId = null;
            }
            this._calibration.phase = CAL_PHASE.NONE;
            this._restore_poll_interval();
            this._update_tooltip();
        } catch (e) {
            this._logger.error("_rollback_calibration_start failed: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Persist a calibrated lux value to settings and trigger validation.
     *
     * @param {string} key          - Settings key (e.g. "min-lux").
     * @param {string} propertyName - Local property name (e.g. "min_lux").
     * @param {number} value        - New calibrated value.
     */
    _set_calibrated_lux(key, propertyName, value) {
        try {
            this.settings.setValue(key, value);
            this[propertyName] = value;
            // Reset median filter and dead-band so the new bounds take effect immediately.
            // NOTE: do NOT manually assign this._brightness here — settings.setValue() fires
            // the binding callback synchronously (_validate_settings → _apply_settings_effects)
            // which already recomputes and applies brightness. A second assignment here would
            // overwrite that result and bypass the manual-override guard.
            this._rawLuxWindow = [];
            this._luxEMA = null;
            this._lastAppliedLux = UNINITIALIZED_VALUE;
            // setValue already triggers the binding callback (validator), so
            // _validate_settings runs automatically. Avoid double-validation.
        } catch (e) {
            this._logger.error("Failed to set calibrated lux: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * High-frequency calibration sample collector (200ms interval).
     * Reads the sensor and appends the value to the current phase's sample array.
     */
    _cal_poll_sample() {
        if (this._calibration.phase === CAL_PHASE.NONE) return;

        try {
            // Guard against sensor becoming unavailable during calibration
            if (!this._sensorPath) return;

            // Read sensor
            let lux;
            if (this._sensorPath.input) {
                lux = this._readNumber(this._sensorPath.input);
            } else {
                const raw = this._readNumber(this._sensorPath.raw);
                const scale = this._sensorPath.scale ? this._readNumber(this._sensorPath.scale) : 1;
                const offset = this._sensorPath.offset ? this._readNumber(this._sensorPath.offset) : 0;
                if (raw !== null && scale !== null && offset !== null) {
                    lux = (raw + offset) * scale;
                }
            }

            if (lux === null || !Number.isFinite(lux) || lux < 0) return;

            // Collect samples
            if (this._calibration.phase === CAL_PHASE.DARK) {
                this._calibration.darkSamples.push(lux);
            } else if (this._calibration.phase === CAL_PHASE.BRIGHT) {
                this._calibration.brightSamples.push(lux);
                if (lux > this._calibration.brightMax) {
                    this._calibration.brightMax = lux;
                }
            }
        } catch (e) {
            this._logger.error("Calibration poll error: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Start the DARK calibration phase.
     * Pauses normal polling, switches to high-frequency sampling for 10 seconds,
     * then computes the noise floor (median) and updates min-lux.
     */
    _start_dark_calibration() {
        try {
            if (this._calibration.phase !== CAL_PHASE.NONE) {
                this._logger.info("Calibration already running, ignoring DARK start.");
                return;
            }
            if (!this._sensorAvailable) {
                Main.notify("Adaptive Brightness", "No sensor found - cannot calibrate.");
                return;
            }

            this._logger.info("DARK calibration phase started (10s high-speed). current min-lux=" + this.min_lux);
            this._calibration.phase = CAL_PHASE.DARK;
            this._calibration.darkSamples = [];
            this._calibration.countdown = CALIBRATION_COUNTDOWN_SECONDS;

            // Pause normal polling and store original interval
            this._calibration.normalLoopPaused = true;
            this._calibration.originalPollInterval = this.poll_interval;
            // Use 200ms for 50 samples in 10 seconds (set before acquiring mutex)
            this._set_poll_interval_safe(CALIBRATION_POLL_INTERVAL_MS);
            this._calibration.mutex = true; // Prevent further poll interval changes

            Main.notify("Adaptive Brightness",
                "DARK phase started.\nGo to your dimmest environment.\nReading for 10 seconds at high speed.");

            // Start high-frequency sampling
            this._calibration.pollId = Mainloop.timeout_add(CALIBRATION_POLL_INTERVAL_MS, () => {
                this._cal_poll_sample();
                return this._calibration.phase === CAL_PHASE.DARK;
            });

            // Countdown timer
            this._calibration.countdownId = Mainloop.timeout_add(TIMER_INTERVAL_1_SECOND_MS, this._cal_tick_dark.bind(this));

            // Finish timer (10 seconds)
            const self = this;
            this._calibration.timerId = Mainloop.timeout_add(TIMER_INTERVAL_10_SECONDS_MS, function () {
                self._calibration.timerId = null;
                self._finish_dark_calibration();
                return false;
            });
        } catch (e) {
            this._logger.error("_start_dark_calibration failed: " + (e && e.message ? e.message : e));
            this._rollback_calibration_start();
        }
    }

    /**
     * Update the tooltip each second during DARK calibration countdown.
     *
     * @returns {boolean} True to keep the timer running, false to stop.
     */
    _cal_tick_dark() {
        try {
            if (this._calibration.phase !== CAL_PHASE.DARK) return false;
            this._calibration.countdown = Math.max(0, this._calibration.countdown - 1);
            const samples = this._calibration.darkSamples.length;
            this.set_applet_tooltip(
                `[Calibrating DARK] ${samples}/${CALIBRATION_EXPECTED_SAMPLES} samples | ${this._calibration.countdown}s remaining`
            );
            if (this._calibration.countdown <= 0) { this._calibration.countdownId = null; return false; }
            return true;
        } catch (e) {
            this._logger.error("_cal_tick_dark: " + (e && e.message ? e.message : e));
            return false;
        }
    }

    /**
     * Finalise the DARK calibration phase.
     * Computes the noise floor from collected samples, validates it, and persists min-lux.
     */
    _finish_dark_calibration() {
        if (this._calibration.phase !== CAL_PHASE.DARK) return;
        this._calibration.phase = CAL_PHASE.NONE;

        try {
            // Stop timers
            if (this._calibration.countdownId) {
                Mainloop.source_remove(this._calibration.countdownId);
                this._calibration.countdownId = null;
            }
            if (this._calibration.timerId) {
                Mainloop.source_remove(this._calibration.timerId);
                this._calibration.timerId = null;
            }
            if (this._calibration.pollId) {
                Mainloop.source_remove(this._calibration.pollId);
                this._calibration.pollId = null;
            }

            const samples = this._calibration.darkSamples;

            if (samples.length < 10) {
                this._logger.info("DARK calibration aborted: too few samples (" + samples.length + ").");
                Main.notify("Adaptive Brightness",
                    "DARK calibration failed: too few samples (" + samples.length + ").\n" +
                    "Ensure the sensor is active and try again.");
                return;
            }

            // Use median filtering for robust noise floor detection
            const noiseFloor = this._median(samples);
            this._logger.info("DARK calibration: " + samples.length + " samples collected, noise floor (median)=" + noiseFloor.toFixed(2) + " lux, min=" + Math.min(...samples).toFixed(2) + ", max=" + Math.max(...samples).toFixed(2));

            const maxAllowed = Math.min(this.max_lux * LUX.MIN_RANGE_RATIO, LUX.MAX_DAMPED_GAP);
            if (noiseFloor > maxAllowed) {
                this._logger.info("DARK calibration aborted: noise floor (" + noiseFloor.toFixed(1) + " lux) > maxAllowed (" + maxAllowed.toFixed(0) + " lux). min-lux unchanged (" + this.min_lux + ").");
                Main.notify("Adaptive Brightness",
                    "DARK calibration: noise floor (" + noiseFloor.toFixed(1) + " lux) " +
                    "exceeds the allowed dark limit (" + maxAllowed.toFixed(0) + " lux, " +
                    "20% of max-lux=" + this.max_lux + ").\n" +
                    "The environment may not be dark enough, or max-lux is too low.\n" +
                    "Tip: lower max-lux or use a darker environment.\n" +
                    "min-lux not updated.");
                return;
            }

            const newMinLux = Math.round(noiseFloor * 1.10);
            this._logger.info("DARK calibration: setting min-lux " + this.min_lux + " -> " + newMinLux + " (noise floor " + noiseFloor.toFixed(2) + " × 1.10).");
            this._set_calibrated_lux("min-lux", "min_lux", newMinLux);
            this._logger.info("DARK calibration complete. min-lux persisted as " + newMinLux + " (from " + samples.length + " samples)");
            Main.notify("Adaptive Brightness",
                "DARK calibration complete.\nmin-lux set to " + newMinLux + " lux (median of " + samples.length + " samples).\n" +
                "Now calibrate BRIGHT level if needed.");
        } finally {
            // Always restore normal polling and release the calibration mutex,
            // even if an error occurred during timer cleanup or validation.
            this._restore_poll_interval();
            this._update_tooltip();
        }
    }

    /**
     * Start the BRIGHT calibration phase.
     * Pauses normal polling, switches to high-frequency sampling for 10 seconds,
     * then computes the 95th percentile and updates max-lux.
     */
    _start_bright_calibration() {
        try {
            if (this._calibration.phase !== CAL_PHASE.NONE) {
                this._logger.info("Calibration already running, ignoring BRIGHT start.");
                return;
            }
            if (!this._sensorAvailable) {
                Main.notify("Adaptive Brightness", "No sensor found - cannot calibrate.");
                return;
            }

            this._logger.info("BRIGHT calibration phase started (10s high-speed). current max-lux=" + this.max_lux);
            this._calibration.phase = CAL_PHASE.BRIGHT;
            this._calibration.brightSamples = [];
            this._calibration.brightMax = 0;
            this._calibration.countdown = CALIBRATION_COUNTDOWN_SECONDS;

            // Pause normal polling and store original interval
            this._calibration.normalLoopPaused = true;
            this._calibration.originalPollInterval = this.poll_interval;
            // Use 200ms for 50 samples in 10 seconds (set before acquiring mutex)
            this._set_poll_interval_safe(CALIBRATION_POLL_INTERVAL_MS);
            this._calibration.mutex = true; // Prevent further poll interval changes

            Main.notify("Adaptive Brightness",
                "BRIGHT phase started.\nGo to your brightest environment.\nReading for 10 seconds at high speed.");

            // Start high-frequency sampling
            this._calibration.pollId = Mainloop.timeout_add(CALIBRATION_POLL_INTERVAL_MS, () => {
                this._cal_poll_sample();
                return this._calibration.phase === CAL_PHASE.BRIGHT;
            });

            // Countdown timer
            this._calibration.countdownId = Mainloop.timeout_add(TIMER_INTERVAL_1_SECOND_MS, this._cal_tick_bright.bind(this));

            // Finish timer (10 seconds)
            const self = this;
            this._calibration.timerId = Mainloop.timeout_add(TIMER_INTERVAL_10_SECONDS_MS, function () {
                self._calibration.timerId = null;
                self._finish_bright_calibration();
                return false;
            });
        } catch (e) {
            this._logger.error("_start_bright_calibration failed: " + (e && e.message ? e.message : e));
            this._rollback_calibration_start();
        }
    }

    /**
     * Update the tooltip each second during BRIGHT calibration countdown.
     *
     * @returns {boolean} True to keep the timer running, false to stop.
     */
    _cal_tick_bright() {
        try {
            if (this._calibration.phase !== CAL_PHASE.BRIGHT) return false;
            this._calibration.countdown = Math.max(0, this._calibration.countdown - 1);
            const samples = this._calibration.brightSamples.length;
            this.set_applet_tooltip(
                `[Calibrating BRIGHT] ${samples}/${CALIBRATION_EXPECTED_SAMPLES} samples | ${this._calibration.countdown}s remaining`
            );
            if (this._calibration.countdown <= 0) { this._calibration.countdownId = null; return false; }
            return true;
        } catch (e) {
            this._logger.error("_cal_tick_bright: " + (e && e.message ? e.message : e));
            return false;
        }
    }

    /**
     * Finalise the BRIGHT calibration phase.
     * Computes the 95th percentile from collected samples, validates it, and persists max-lux.
     */
    _finish_bright_calibration() {
        if (this._calibration.phase !== CAL_PHASE.BRIGHT) return;
        this._calibration.phase = CAL_PHASE.NONE;

        try {
            // Stop timers
            if (this._calibration.countdownId) {
                Mainloop.source_remove(this._calibration.countdownId);
                this._calibration.countdownId = null;
            }
            if (this._calibration.timerId) {
                Mainloop.source_remove(this._calibration.timerId);
                this._calibration.timerId = null;
            }
            if (this._calibration.pollId) {
                Mainloop.source_remove(this._calibration.pollId);
                this._calibration.pollId = null;
            }

            const samples = this._calibration.brightSamples;

            if (samples.length < 10) {
                this._logger.info("BRIGHT calibration aborted: too few samples (" + samples.length + ").");
                Main.notify("Adaptive Brightness",
                    "BRIGHT calibration failed: too few samples (" + samples.length + ").\n" +
                    "Ensure the sensor is active and try again.");
                return;
            }

            // Use 95th percentile to exclude outliers (transient light spikes)
            const calibratedMaxLux = this._percentile(samples, 95);
            this._logger.info("BRIGHT calibration: " + samples.length + " samples collected, 95th percentile=" + calibratedMaxLux.toFixed(2) + " lux, min=" + Math.min(...samples).toFixed(2) + ", max=" + Math.max(...samples).toFixed(2));

            if (calibratedMaxLux < LUX.MIN_MAX) {
                this._logger.info("BRIGHT calibration aborted: calibrated lux (" + calibratedMaxLux.toFixed(1) + ") below minimum threshold (" + LUX.MIN_MAX + "). max-lux unchanged.");
                Main.notify("Adaptive Brightness",
                    "BRIGHT calibration failed: calibrated lux (" + calibratedMaxLux.toFixed(1) +
                    ") below minimum threshold (" + LUX.MIN_MAX + ").\n" +
                    "Ensure sensor is exposed to bright light during calibration.");
                return;
            }

            const minGap = Math.max(LUX.MIN_GAP, Math.round(calibratedMaxLux * LUX.MIN_RANGE_RATIO));
            if (calibratedMaxLux - this.min_lux < minGap) {
                this._logger.info("BRIGHT calibration aborted: range too narrow (calibratedMax=" + calibratedMaxLux.toFixed(1) + ", min_lux=" + this.min_lux + ", required gap=" + minGap + "). max-lux unchanged.");
                Main.notify("Adaptive Brightness",
                    "BRIGHT calibration: range too narrow (max=" + calibratedMaxLux.toFixed(1) +
                    ", min=" + this.min_lux + ").\n" +
                    "Please calibrate DARK level first, or expose sensor to brighter light.");
                return;
            }

            const newMaxLux = Math.round(calibratedMaxLux * 1.10);
            this._logger.info("BRIGHT calibration: setting max-lux " + this.max_lux + " -> " + newMaxLux + " (p95 " + calibratedMaxLux.toFixed(2) + " × 1.10).");
            this._set_calibrated_lux("max-lux", "max_lux", newMaxLux);
            this._logger.info("BRIGHT calibration complete. max-lux persisted as " + newMaxLux + " (from " + samples.length + " samples)");
            Main.notify("Adaptive Brightness",
                "BRIGHT calibration complete.\nmax-lux set to " + newMaxLux + " lux (p95 × 1.10, " + samples.length + " samples).");
        } finally {
            // Always restore normal polling and release the calibration mutex,
            // even if an error occurred during timer cleanup or validation.
            this._restore_poll_interval();
            this._update_tooltip();
        }
    }

    /**
     * Validate and sanitize a user-provided sensor sysfs path.
     *
     * @param {string} path - Raw user input.
     * @returns {string|false} Cleaned path if valid, false otherwise.
     */
    _validate_sensor_path(path) {
        try {
            if (!path || typeof path !== 'string') return false;

            // Remove leading/trailing whitespace
            const cleanPath = path.trim();

            // Basic path validation
            if (cleanPath === '') return false;

            // Prevent directory traversal attacks
            if (cleanPath.includes('..') || cleanPath.includes('~')) {
                this._logger.info("Unsafe sensor path rejected: " + cleanPath);
                return false;
            }

            // Ensure path starts with expected prefixes
            const validPrefixes = [
                '/sys/bus/iio/devices/',
                '/sys/class/sensors/',
                '/sys/devices/'
            ];

            const isValidPrefix = validPrefixes.some(prefix => cleanPath.startsWith(prefix));
            if (!isValidPrefix) {
                this._logger.info("Sensor path with invalid prefix rejected: " + cleanPath);
                return false;
            }

            // Additional safety: no shell metacharacters
            if (/[;&|`$(){}[\]\n\r]/.test(cleanPath)) {
                this._logger.info("Sensor path with unsafe characters rejected: " + cleanPath);
                return false;
            }

            return cleanPath;
        } catch (e) {
            this._logger.error("_validate_sensor_path failed: " + (e && e.message ? e.message : e));
            return false;
        }
    }

    /**
     * Try to find a usable ambient light sensor. Priority order:
     * 1. User-provided sensor path override
     * 2. Dynamic enumeration of iio:device* nodes
     * 3. Legacy /sys/class/sensors/light path
     */
    _locate_sensor() {
        const self = this;
        const checkPath = function (rawPath, scalePath, offsetPath, inputPath) {
            try {
                const raw = Gio.File.new_for_path(rawPath);
                const scale = scalePath ? Gio.File.new_for_path(scalePath) : null;
                const input = inputPath ? Gio.File.new_for_path(inputPath) : null;

                if (raw.query_exists(null)) {
                    const scaleExists = scale && scale.query_exists(null);
                    const offset = offsetPath ? Gio.File.new_for_path(offsetPath) : null;
                    self._sensorPath = {
                        raw: rawPath,
                        scale: scaleExists ? scalePath : null,
                        offset: offset && offset.query_exists(null) ? offsetPath : null,
                        input: null
                    };
                    self._sensorAvailable = true;
                    self._logger.info("Found sensor (raw" + (scaleExists ? "+scale" : ", default scale=1") + ") at: " + rawPath);
                    return true;
                }
                if (input && input.query_exists(null)) {
                    self._sensorPath = { raw: null, scale: null, offset: null, input: inputPath };
                    self._sensorAvailable = true;
                    self._logger.info("Found sensor (direct input) at: " + inputPath);
                    return true;
                }
            } catch (e) {
                self._logger.debug("Sensor check failed for " + rawPath + ": " + (e && e.message ? e.message : e));
            }
            return false;
        };

        // Try user override if provided
        if (this.sensor_path && this.sensor_path.trim() !== "") {
            const validatedPath = this._validate_sensor_path(this.sensor_path);
            if (validatedPath) {
                if (checkPath(
                    validatedPath + "/in_illuminance_raw",
                    validatedPath + "/in_illuminance_scale",
                    validatedPath + "/in_illuminance_offset",
                    validatedPath + "/in_illuminance_input"
                )) {
                    return;
                }
            } else {
                this._logger.info("Invalid user sensor path provided, falling back to auto-detection");
            }
        } else {
            this._logger.debug("No user sensor path override; attempting auto-detection.");
        }

        // Dynamically discover all available iio devices
        const IIO_BASE = "/sys/bus/iio/devices/";
        try {
            const dir = Gio.File.new_for_path(IIO_BASE);
            if (dir.query_exists(null)) {
                const enumerator = dir.enumerate_children("standard::name", 0, null);
                let fileInfo;
                while ((fileInfo = enumerator.next_file(null)) !== null) {
                    const name = fileInfo.get_name();
                    if (name.startsWith("iio:device")) {
                        const devicePath = IIO_BASE + name;
                        if (checkPath(
                            devicePath + "/in_illuminance_raw",
                            devicePath + "/in_illuminance_scale",
                            devicePath + "/in_illuminance_offset",
                            devicePath + "/in_illuminance_input"
                        )) {
                            enumerator.close(null);
                            return;
                        }
                    }
                }
                enumerator.close(null);
            }
        } catch (e) {
            this._logger.info("Dynamic device discovery failed, falling back to range 0-9: " + (e && e.message ? e.message : e));
            // Fallback to original range if dynamic discovery fails
            for (let i = 0; i <= 9; i++) {
                const dir = IIO_BASE + "iio:device" + i;
                if (checkPath(
                    dir + "/in_illuminance_raw",
                    dir + "/in_illuminance_scale",
                    dir + "/in_illuminance_offset",
                    dir + "/in_illuminance_input"
                )) {
                    return;
                }
            }
        }

        // Legacy fallback
        const legacyBase = "/sys/class/sensors/light";
        if (checkPath(
            legacyBase + "/in_illuminance_raw",
            legacyBase + "/in_illuminance_scale",
            null,
            legacyBase + "/in_illuminance_input"
        )) {
            return;
        }

        this._sensorAvailable = false;
        this._sensorPath = null;
        this._logger.error("No light sensor found");
    }

    /**
     * Update the tray tooltip to reflect the current applet state.
     */
    _update_tooltip() {
        try {
            if (this._enabled && this._sensorAvailable) {
                if (this._has_valid_lux(this._lastLux)) {
                    const brightness = this._brightness !== null
                        ? Math.round(this._brightness)
                        : (this._previousBrightness >= 0 ? this._previousBrightness : null);
                    this._update_live_tooltip(this._lastLux, brightness);
                } else {
                    this.set_applet_tooltip("Enabled | Right-click for settings");
                }
            } else if (!this._sensorAvailable) {
                this.set_applet_tooltip("No sensor detected");
            } else {
                this.set_applet_tooltip("Disabled | Right-click for settings");
            }
        } catch (e) {
            this._logger.error("_update_tooltip: " + (e && e.message ? e.message : e));
        }
    }

    // Clamp and sanitize all settings fields to their legal ranges.
    /**
     * Clamp and sanitize all settings fields to their legal ranges.
     * Pure: only modifies this.* settings fields and persists corrections.
     */
    _clamp_settings() {
        const rawMinBrightness = this.min_brightness;
        const rawMaxBrightness = this.max_brightness;
        const rawSmoothingFactor = this.smoothing_factor;
        const rawMaxLux = this.max_lux;
        const rawPollInterval = this.poll_interval;
        const rawMinLux = this.min_lux;
        const rawSensorPath = this.sensor_path;
        const rawShowLabel = this.show_label;
        const rawLabelDisplayMode = this.label_display_mode;
        const rawLuxChangeThreshold = this.lux_change_threshold;
        const rawMinBrightnessDelta = this.min_brightness_delta;
        const rawResponseCurve = this.response_curve;
        const rawLogLevel = this.log_level;
        const rawManualDebounceWindow = this.manual_debounce_window;
        this.min_brightness = Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, parseInt(this.min_brightness, 10) || BRIGHTNESS.DEFAULT_MIN));
        this.max_brightness = Math.min(BRIGHTNESS.MAX, Math.max(this.min_brightness + 1, Math.min(BRIGHTNESS.MAX, parseInt(this.max_brightness, 10) || BRIGHTNESS.DEFAULT_MAX)));
        const parsedSmoothing = parseFloat(this.smoothing_factor);
        this.smoothing_factor = Math.max(SMOOTHING.MIN, Math.min(SMOOTHING.MAX, Number.isFinite(parsedSmoothing) ? parsedSmoothing : SMOOTHING.DEFAULT));
        const parsedMaxLux = parseInt(this.max_lux, 10);
        this.max_lux = Math.max(LUX.MIN_MAX, Number.isFinite(parsedMaxLux) ? parsedMaxLux : LUX.DEFAULT_MAX);
        const parsedMinLux = parseInt(this.min_lux, 10);
        this.min_lux = Math.max(LUX.MIN_MIN, Math.min(LUX.MAX_MIN, Number.isFinite(parsedMinLux) ? parsedMinLux : LUX.DEFAULT_MIN));
        const minGap = Math.max(LUX.MIN_GAP, Math.round(this.max_lux * LUX.GAP_ENFORCEMENT_RATIO));
        if (this._calibration.phase === CAL_PHASE.NONE && this.min_lux >= this.max_lux - minGap) {
            const correctedMinLux = Math.max(0, this.max_lux - minGap);
            this._logger.info("Settings clamped: min-lux " + this.min_lux + " -> " + correctedMinLux + " (gap enforcement: max_lux=" + this.max_lux + ", minGap=" + minGap + ").");
            this.min_lux = correctedMinLux;
        }
        let interval = parseInt(this.poll_interval, 10) || POLL_INTERVAL.DEFAULT;
        if (!this._calibration.mutex) {
            this.poll_interval = Math.max(POLL_INTERVAL.MIN, Math.min(POLL_INTERVAL.MAX, interval));
        }
        const validPanelModes = ["live_status", "icon_only", "hide_actor"];
        if (!validPanelModes.includes(this.show_label)) {
            this.show_label = "live_status";
        }
        if (!LABEL_DISPLAY_MODES.includes(this.label_display_mode)) {
            this.label_display_mode = "brightness";
        }
        const parsedLuxThreshold = parseInt(this.lux_change_threshold, 10);
        this.lux_change_threshold = Math.max(LUX_CHANGE_THRESHOLD.MIN, Math.min(LUX_CHANGE_THRESHOLD.MAX,
            Number.isFinite(parsedLuxThreshold) ? parsedLuxThreshold : LUX_CHANGE_THRESHOLD.DEFAULT));
        const parsedMinBrightnessDelta = parseInt(this.min_brightness_delta, 10);
        this.min_brightness_delta = Math.max(MIN_BRIGHTNESS_DELTA.MIN, Math.min(MIN_BRIGHTNESS_DELTA.MAX,
            Number.isFinite(parsedMinBrightnessDelta) ? parsedMinBrightnessDelta : MIN_BRIGHTNESS_DELTA.DEFAULT));
        const parsedDebounce = parseInt(this.manual_debounce_window, 10);
        this.manual_debounce_window = Math.max(MANUAL_DEBOUNCE_WINDOW.MIN, Math.min(MANUAL_DEBOUNCE_WINDOW.MAX,
            Number.isFinite(parsedDebounce) ? parsedDebounce : MANUAL_DEBOUNCE_WINDOW.DEFAULT));

        const validResponseCurves = Object.keys(RESPONSE_CURVES);
        if (!validResponseCurves.includes(this.response_curve)) {
            this.response_curve = "logarithmic";
        }
        const validLogLevels = ["off", "debug", "info", "error"];
        if (!validLogLevels.includes(this.log_level)) {
            this.log_level = "off";
        }

        // Parse schedule time settings if they arrive as JSON strings from gsettings
        this._parse_schedule_time();

        const persistIfChanged = (key, rawValue, normalizedValue) => {
            if (rawValue !== normalizedValue) {
                this._logger.info("Settings clamped: " + key + " " + rawValue + " -> " + normalizedValue + " (persisted).");
                this.settings.setValue(key, normalizedValue);
            }
        };

        persistIfChanged("min-brightness", rawMinBrightness, this.min_brightness);
        persistIfChanged("max-brightness", rawMaxBrightness, this.max_brightness);
        persistIfChanged("smoothing-factor", rawSmoothingFactor, this.smoothing_factor);
        persistIfChanged("max-lux", rawMaxLux, this.max_lux);
        persistIfChanged("poll-interval", rawPollInterval, this.poll_interval);
        persistIfChanged("min-lux", rawMinLux, this.min_lux);
        persistIfChanged("sensor-path", rawSensorPath, this.sensor_path);
        persistIfChanged("show-label", rawShowLabel, this.show_label);
        persistIfChanged("label-display-mode", rawLabelDisplayMode, this.label_display_mode);
        persistIfChanged("lux-change-threshold", rawLuxChangeThreshold, this.lux_change_threshold);
        persistIfChanged("min-brightness-delta", rawMinBrightnessDelta, this.min_brightness_delta);
        persistIfChanged("response-curve", rawResponseCurve, this.response_curve);
        persistIfChanged("log-level", rawLogLevel, this.log_level);
        persistIfChanged("manual-debounce-window", rawManualDebounceWindow, this.manual_debounce_window);
    }

    /**
     * Apply runtime side-effects after settings have been clamped:
     * re-apply brightness if bounds changed, and reschedule the poll loop if
     * the interval changed.
     */
    _apply_settings_effects() {
        // Recompute brightness from the current lux reading whenever settings
        // change so that curve, lux bounds, and brightness limits take effect
        // immediately.  Reset the dead-band so the next poll does not skip.
        try {
            if (Number.isFinite(this._lastLux) && this._lastLux >= 0) {
                const target = this._luxToBrightness(this._lastLux);
                this._brightness = target;
                if (Math.abs(target - this._previousBrightness) >= 1) {
                    this._apply_brightness(target);
                    this._previousBrightness = target;
                }
                // Force the next poll to recalculate even if lux is stable
                this._lastAppliedLux = UNINITIALIZED_VALUE;
            } else if (this._brightness !== null) {
                // No valid lux yet; just clamp buffered brightness to new bounds
                const clamped = Math.max(this.min_brightness, Math.min(this.max_brightness, Math.round(this._brightness)));
                if (clamped !== Math.round(this._brightness)) {
                    this._brightness = clamped;
                    if (Math.abs(clamped - this._previousBrightness) >= 1) {
                        this._apply_brightness(clamped);
                        this._previousBrightness = clamped;
                    }
                }
            }
        } catch (e) {
            this._logger.error("Apply settings runtime failed: " + (e && e.message ? e.message : e));
        }

        // If the poll interval changed, reschedule the loop immediately
        try {
            if (!this._calibration.normalLoopPaused &&
                this._lastPollInterval !== this.poll_interval) {
                this._lastPollInterval = this.poll_interval;
                this._schedule_next_loop();
            }
        } catch (e) {
            this._logger.error("Reschedule after settings change failed: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Validate settings: clamp values then apply runtime effects.
     * Called as the settings-change callback for all numeric/enum bindings.
     */
    _validate_settings() {
        try {
            this._logger.debug("_validate_settings triggered. min-lux=" + this.min_lux + ", max-lux=" + this.max_lux + ", min-brightness=" + this.min_brightness + ", max-brightness=" + this.max_brightness + ".");
            this._clamp_settings();
            this._apply_settings_effects();
        } catch (e) {
            this._logger.error("Validation: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Toggle applet enabled/disabled on left click. When enabling, run an immediate
     * poll so the UI reflects adaptive behaviour without waiting for the next
     * scheduled timeout.
     */
    on_applet_clicked() {
        try {
            // Manual click always overrides schedule control.
            this._scheduleCausedDisable = false;
            this._set_enabled(!this._enabled, "user click");
        } catch (e) {
            this._logger.error("Click: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Read a numeric value from a sysfs path. Returns null on error, actual number on success.
     * This distinguishes read errors from legitimate zero values.
     *
     * @param {string} path - Absolute sysfs file path.
     * @returns {number|null} Parsed value, or null on failure.
     */
    _readNumber(path) {
        try {
            const result = GLib.file_get_contents(path);
            if (!result || !result[0] || !result[1]) {
                this._logger.debug("_readNumber: file not readable or empty: " + path);
                return null;
            }
            const num = parseFloat(result[1].toString().trim());
            if (!Number.isFinite(num) || num < 0) {
                this._logger.debug("_readNumber: invalid value (" + num + ") from: " + path);
                return null;
            }
            return num; // Return actual number (could be 0)
        } catch (e) {
            this._logger.debug("_readNumber failed for " + path + ": " + (e && e.message ? e.message : e));
            return null;
        }
    }

    /**
     * Discover the sysfs backlight device path (cached after first call).
     *
     * @returns {string|null} Backlight device path, or null if none found.
     */
    _find_backlight_path() {
        if (this._backlightPath !== undefined) return this._backlightPath;
        let enumerator;
        try {
            const base = Gio.File.new_for_path("/sys/class/backlight");
            if (!base.query_exists(null)) return null;
            enumerator = base.enumerate_children("standard::name", 0, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const candidate = "/sys/class/backlight/" + info.get_name();
                const brightnessFile = Gio.File.new_for_path(candidate + "/brightness");
                const maxFile = Gio.File.new_for_path(candidate + "/max_brightness");
                if (brightnessFile.query_exists(null) && maxFile.query_exists(null)) {
                    this._backlightPath = candidate;
                    this._logger.info("Found backlight device: " + candidate);
                    return this._backlightPath;
                }
            }
            this._backlightPath = null;
            this._logger.info("No backlight device found in /sys/class/backlight.");
        } catch (e) {
            this._logger.debug("_find_backlight_path: " + (e && e.message ? e.message : e));
        } finally {
            if (enumerator) {
                try { enumerator.close(null); } catch (_) { }
            }
        }
        return null;
    }

    /**
     * Read current brightness via brightnessctl machine output (-m).
     * Fast local subprocess; acceptable sync read in the poll loop.
     *
     * @returns {number|null} Brightness percentage 0-100, or null if unavailable.
     */
    _read_brightness_via_brightnessctl() {
        const cmd = this._brightnessctlPath;
        if (!cmd) {
            return null;
        }
        try {
            const argv = this._brightnessctlDirectFailed
                ? ['sudo', '-n', cmd, '-m']
                : [cmd, '-m'];
            const proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            const [, stdout] = proc.communicate_utf8(null, null);
            if (!stdout) {
                return null;
            }
            const pct = this._parse_brightnessctl_machine(stdout);
            if (pct === null) {
                return null;
            }
            this._logger.debug("Current system brightness (brightnessctl): " + pct + "%.");
            return pct;
        } catch (e) {
            this._logger.debug("_read_brightness_via_brightnessctl failed: " + (e && e.message ? e.message : e));
            if (!this._brightnessctlDirectFailed) {
                this._brightnessctlDirectFailed = true;
                this._logger.info("Direct brightnessctl read failed, will fallback to sudo on next attempt.");
            }
            return null;
        }
    }

    /**
     * Read actual current system brightness from brightnessctl or sysfs fallback.
     *
     * @returns {number|null} Brightness percentage 0-100, or null if unavailable.
     */
    _read_current_brightness() {
        try {
            const viaBrightnessctl = this._read_brightness_via_brightnessctl();
            if (viaBrightnessctl !== null) {
                return viaBrightnessctl;
            }

            const path = this._find_backlight_path();
            if (!path) return null;
            const current = this._readNumber(path + "/brightness");
            const max = this._readNumber(path + "/max_brightness");
            if (current === null || max === null || max <= 0) return null;
            const pct = Math.round(current / max * 100);
            this._logger.debug("Current system brightness (sysfs): " + pct + "%.");
            return pct;
        } catch (e) {
            this._logger.debug("_read_current_brightness failed: " + (e && e.message ? e.message : e));
            return null;
        }
    }

    /**
     * Convert a lux reading to a brightness percentage.
     * Supports logarithmic, linear, and sigmoidal curves.
     *
     * @param {number} lux - Ambient light reading.
     * @returns {number} Brightness percentage in [BRIGHTNESS.MIN, BRIGHTNESS.MAX].
     */
    _luxToBrightness(lux) {
        try {
            if (!Number.isFinite(lux) || lux < 0 || !Number.isFinite(this.max_lux) || this.max_lux <= 0) {
                return this.min_brightness;
            }

            const effMin = this.min_lux;
            const effMax = this.max_lux;
            this._logger.debug("Lux range: min=" + effMin + " max=" + effMax);

            if (lux <= effMin) return this.min_brightness;
            if (lux >= effMax) return this.max_brightness;

            const luxRange = effMax - effMin;
            if (luxRange <= 0) return this.min_brightness;
            const linearNorm = (lux - effMin) / luxRange;
            const curveFn = RESPONSE_CURVES[this.response_curve] || RESPONSE_CURVES.logarithmic;
            let normalized = curveFn(linearNorm, luxRange, effMin);

            normalized = Math.max(0, Math.min(1, normalized));
            const brightness = Math.round(
                this.min_brightness + normalized * (this.max_brightness - this.min_brightness)
            );
            return Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, brightness));
        } catch (e) {
            this._logger.error("Lux mapping error: " + (e && e.message ? e.message : e));
            return this.min_brightness;
        }
    }

    /**
     * Calculate curve steepness at current lux position.
     * Higher values = steeper curve = more aggressive brightness response.
     * For log curve: steepness ≈ 1/(normalizedLux * luxRange + 1)
     *
     * @param {number} lux - Current lux reading.
     * @returns {number} Steepness factor 0-1, where 1 = very steep (low lux).
     */
    _getCurveSteepness(lux) {
        try {
            const effMin = this.min_lux;
            const effMax = this.max_lux;

            if (lux <= effMin || lux >= effMax) return 0;

            const luxRange = effMax - effMin;
            if (luxRange <= 0) return 0;

            const normalizedPos = (lux - effMin) / luxRange;

            // Curve is log(n*k + 1) / log(k + 1), n in [0,1], k = luxRange/effMin (or luxRange when effMin<=0).
            // Derivative w.r.t. n: k / ((n*k + 1) * log(k + 1)).
            // Max at n=0: k / log(k + 1). Normalize to get 0-1 steepness.
            if (this.response_curve === "logarithmic") {
                const k = effMin > 0 ? luxRange / effMin : luxRange;
                const logDenom = Math.log(k + LOG_OFFSET);
                if (logDenom <= 0) return 0;
                const rawDerivative = k / ((normalizedPos * k + LOG_OFFSET) * logDenom);
                const maxDerivative = k / logDenom; // At normalizedPos = 0
                return Math.min(1, rawDerivative / maxDerivative);
            }

            // Sigmoidal: derivative is |k * f(n) * (1 - f(n))| where k = SIGMOIDAL_STEEPNESS.
            // Peak at the center (n = SIGMOIDAL_CENTER). Normalize against that peak.
            if (this.response_curve === "sigmoidal") {
                const fn = 1 / (1 + Math.exp(SIGMOIDAL_STEEPNESS * (normalizedPos - SIGMOIDAL_CENTER)));
                const rawDerivative = Math.abs(SIGMOIDAL_STEEPNESS) * fn * (1 - fn);
                const fnCenter = 1 / (1 + Math.exp(SIGMOIDAL_STEEPNESS * (SIGMOIDAL_CENTER - SIGMOIDAL_CENTER)));
                const maxDerivative = Math.abs(SIGMOIDAL_STEEPNESS) * fnCenter * (1 - fnCenter);
                return maxDerivative > 0 ? Math.min(1, rawDerivative / maxDerivative) : 0;
            }

            // Linear: constant slope, no steep region
            return 0;
        } catch (e) {
            this._logger.debug("_getCurveSteepness failed: " + (e && e.message ? e.message : e));
            return 0;
        }
    }

    /**
     * Get adaptive smoothing factor based on curve steepness.
     * When curve is steep (low lux on log curve), increase smoothing to prevent
     * jarring brightness jumps from small lux fluctuations.
     *
     * @param {number} lux - Current lux reading.
     * @returns {number} Effective smoothing factor (0-0.95).
     */
    _getAdaptiveSmoothing(lux) {
        try {
            const baseSmoothing = Math.max(SMOOTHING.MIN, Math.min(SMOOTHING.MAX, this.smoothing_factor));
            const steepness = this._getCurveSteepness(lux);

            // When steepness > 0.5 (steep part of curve), add up to +0.20 smoothing
            // This makes low-lux transitions much more gradual
            const extraSmoothing = steepness > 0.5 ? (steepness - 0.5) * 0.4 : 0;
            const effectiveSmoothing = Math.min(0.95, baseSmoothing + extraSmoothing);

            this._logger.debug("Adaptive smoothing: base=" + baseSmoothing.toFixed(2) +
                " steepness=" + steepness.toFixed(2) +
                " extra=" + extraSmoothing.toFixed(2) +
                " effective=" + effectiveSmoothing.toFixed(2));

            return effectiveSmoothing;
        } catch (e) {
            this._logger.debug("_getAdaptiveSmoothing failed: " + (e && e.message ? e.message : e));
            return Math.max(SMOOTHING.MIN, Math.min(SMOOTHING.MAX, this.smoothing_factor));
        }
    }

    /**
     * Ensure only a single scheduled poll exists. We clear any previous timeout
     * then create a new one at the configured interval.
     */
    _schedule_next_loop() {
        try {
            if (this._loopId) {
                Mainloop.source_remove(this._loopId);
                this._loopId = null;
            }
            let interval = this.poll_interval || POLL_INTERVAL.DEFAULT;
            interval = Math.max(POLL_INTERVAL.MIN, Math.min(POLL_INTERVAL.MAX, interval));
            const self = this;
            this._loopId = Mainloop.timeout_add(interval, function () {
                self._loopId = null;
                self._do_loop();
                return false;
            });
            this._logger.debug("Next poll scheduled in " + interval + "ms.");
        } catch (e) {
            this._logger.error("Schedule: " + (e && e.message ? e.message : e));
            if (this._loopId) Mainloop.source_remove(this._loopId);
            const self = this;
            this._loopId = Mainloop.timeout_add(POLL_INTERVAL.DEFAULT, function () {
                self._loopId = null;
                self._schedule_next_loop();
                return false;
            });
        }
    }

    /**
     * Main polling loop: read sensor, adjust lux bounds if needed, then
     * compute and enforce the target brightness.
     */
    _do_loop() {
        if (this._isRunning) {
            // If the previous loop invocation was interrupted by a system suspend
            // or screen lock, the finally block never ran and _isRunning stayed true.
            // Detect this stale guard by checking how long it has been "running".
            // Threshold must exceed poll interval to avoid false positives with long intervals.
            const STALE_LOOP_THRESHOLD_US = Math.max(5 * 1000000, (this.poll_interval || 1000) * 2 * 1000);
            const now = GLib.get_monotonic_time();
            // _loopStartTime === 0 means the loop hasn't recorded a start time yet —
            // treat as genuinely running (conservative). Only trigger stale recovery
            // if a valid start time exists AND the elapsed time exceeds the threshold.
            if (this._loopStartTime === 0 || (now - this._loopStartTime) < STALE_LOOP_THRESHOLD_US) {
                // Genuinely still running — skip this invocation but still reschedule
                // so we don't lose the loop. _isRunning will be cleared by the
                // in-flight call's finally block.
                if (!this._loopId) {
                    this._schedule_next_loop();
                }
                return;
            }
            this._logger.info("Stale loop guard detected, recovering from suspend/lock.");
            this._isRunning = false;
        }
        this._isRunning = true;
        this._loopStartTime = GLib.get_monotonic_time();

        try {
            // Skip if calibration is running (high-frequency polling takes over).
            // Do NOT call _schedule_next_loop() here — the finally block does it.
            if (this._calibration.normalLoopPaused) {
                this._logger.debug("_do_loop skipped: calibration in progress.");
                return;
            }

            if (!this._enabled) {
                this._logger.debug("_do_loop skipped: enabled=false");
                return;
            }

            if (!this._sensorAvailable || !this._sensorPath) {
                this._sensorRetryCounter++;
                if (this._sensorRetryCounter >= SENSOR_REDISCOVERY_POLLS) {
                    this._sensorRetryCounter = INITIAL_COUNTER_VALUE;
                    this._locate_sensor();
                    this._update_tooltip();
                }
                this._logger.debug("_do_loop skipped: sensorAvailable=" + this._sensorAvailable + " sensorPath=" + !!this._sensorPath);
                return;
            }
            this._sensorRetryCounter = INITIAL_COUNTER_VALUE;

            // Read sensor values safely
            let lux;
            if (this._sensorPath.input) {
                lux = this._readNumber(this._sensorPath.input);
            } else {
                const raw = this._readNumber(this._sensorPath.raw);
                const scale = this._sensorPath.scale ? this._readNumber(this._sensorPath.scale) : 1;
                const offset = this._sensorPath.offset ? this._readNumber(this._sensorPath.offset) : 0;
                if (raw !== null && scale !== null && offset !== null) {
                    lux = (raw + offset) * scale;
                }
            }

            if (lux === null || !Number.isFinite(lux) || lux < 0) {
                this._logger.debug("_do_loop skipped: invalid lux reading.");
                return;
            }

            // Median-filter raw lux to suppress noise before curve mapping.
            // Adaptive calibration and zone detection still use the raw reading.
            this._rawLuxWindow.push(lux);
            if (this._rawLuxWindow.length > RAW_LUX_WINDOW_SIZE) {
                this._rawLuxWindow.shift();
            }
            const filteredLux = this._rawLuxWindow.length >= RAW_LUX_WINDOW_SIZE
                ? this._median(this._rawLuxWindow)
                : lux;

            // Additional exponential smoothing on the median-filtered lux.
            // This shares the same smoothing_factor knob as brightness smoothing,
            // giving users a single control for overall responsiveness.
            if (this._luxEMA === null) {
                this._luxEMA = filteredLux;
            } else {
                const emaFactor = Math.max(SMOOTHING.MIN, Math.min(SMOOTHING.MAX, this.smoothing_factor));
                this._luxEMA = this._luxEMA * emaFactor + filteredLux * (1 - emaFactor);
            }
            const smoothedLux = this._luxEMA;

            const currentBrightness = this._read_current_brightness();

            // 1. Detect a fresh manual brightness override and start the cooldown.
            if (this._is_manual_brightness_override(currentBrightness)) {
                this._adopt_manual_brightness(currentBrightness, smoothedLux);
                return;
            }

            // 2. During the cooldown window, respect the manual value and skip adaptive computation.
            const now = GLib.get_monotonic_time();
            if (now < this._manualOverrideEndTime) {
                this._lastLux = smoothedLux;
                const displayBrightness = currentBrightness !== null
                    ? currentBrightness
                    : (this._brightness !== null ? Math.round(this._brightness) : undefined);
                this._update_label(displayBrightness, smoothedLux);
                this._update_live_tooltip(smoothedLux, displayBrightness);
                this._logger.debug("Manual override cooldown active, skipping adaptive.");
                return;
            }

            // 3. Cooldown just expired — reset the dead-band so the next poll recomputes.
            if (this._manualOverrideEndTime > 0) {
                this._manualOverrideEndTime = 0;
                this._lastAppliedLux = UNINITIALIZED_VALUE;
                this._rawLuxWindow = []; // Reset median filter for fresh start
                this._luxEMA = null;     // Reset lux EMA for fresh start
                this._logger.debug("Manual override cooldown expired, resuming adaptive.");
            }

            // 4. Lux dead-band: skip brightness recomputation when sensor noise causes
            // tiny lux fluctuations that would otherwise drift the smoothing buffer.
            // Always compute on the very first poll (_lastAppliedLux === -1).
            const luxDelta = Math.abs(smoothedLux - this._lastAppliedLux);
            const deadBand = Math.max(0, this.lux_change_threshold);
            let targetBrightness = this._luxToBrightness(smoothedLux);
            if (this._lastAppliedLux >= 0 && deadBand > 0 && luxDelta < deadBand) {
                // If the smoothed brightness hasn't converged to the target yet,
                // bypass the dead-band so exponential smoothing can continue.
                const currentSmoothed = this._brightness !== null ? Math.round(this._brightness) : null;
                const converged = currentSmoothed !== null &&
                    Math.abs(currentSmoothed - targetBrightness) < this.min_brightness_delta;
                if (converged) {
                    this._lastLux = smoothedLux;
                    const displayBrightness = this._brightness !== null ? Math.round(this._brightness) : undefined;
                    this._logger.debug(
                        "Dead-band skip: lux=" + smoothedLux.toFixed(1) +
                        " lastApplied=" + this._lastAppliedLux.toFixed(1) +
                        " delta=" + luxDelta.toFixed(1) +
                        " threshold=" + deadBand
                    );
                    this._update_label(displayBrightness, smoothedLux);
                    this._update_live_tooltip(smoothedLux, displayBrightness);
                    return;
                }
                this._logger.debug(
                    "Dead-band bypass: lux=" + smoothedLux.toFixed(1) +
                    " delta=" + luxDelta.toFixed(1) +
                    " smoothed=" + currentSmoothed +
                    " target=" + targetBrightness +
                    " (not converged)"
                );
                // Continue to brightness calculation - bypass only means we don't skip
            }
            // Update the dead-band anchor every time we compute brightness.
            // Previously the anchor was left unchanged on bypass, which caused
            // infinite bypass loops when the target kept oscillating due to
            // sensor noise near a steep curve boundary.
            this._lastAppliedLux = smoothedLux;

            // Exponential smoothing: smoothing_factor is smoothness (0=instant, 1=frozen).
            // responsiveness = (1 - factor) is the fraction moved toward target each poll.
            // Use adaptive smoothing that increases when curve is steep (low lux on log curve).
            if (this._brightness === null) {
                this._brightness = targetBrightness;
            } else if ((targetBrightness === this.min_brightness && this._brightness <= this.min_brightness + 2) ||
                (targetBrightness === this.max_brightness && this._brightness >= this.max_brightness - 2)) {
                // Snap-to-extremes: jump directly to floor/ceiling only when already near boundary.
                // This prevents jarring instant jumps from small fluctuations while still ensuring
                // we reach the true min/max when approaching boundaries.
                this._brightness = targetBrightness;
            } else {
                const smoothness = this._getAdaptiveSmoothing(smoothedLux);
                const responsiveness = 1 - smoothness;
                if (responsiveness <= 0) {
                    // Defence-in-depth: a responsiveness of 0 would freeze brightness forever.
                    // Snap directly to target to avoid silent failure.
                    this._brightness = targetBrightness;
                } else {
                    this._brightness = this._brightness + (targetBrightness - this._brightness) * responsiveness;
                }
            }

            const finalBrightness = Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, Math.round(this._brightness)));

            const targetDelta = this._previousBrightness >= 0
                ? Math.abs(finalBrightness - this._previousBrightness)
                : Infinity;

            if (this._previousBrightness < 0 || targetDelta >= this.min_brightness_delta) {
                this._apply_brightness(finalBrightness);
                this._previousBrightness = finalBrightness;
            }

            if (this.show_label !== "hide_actor") {
                this.set_applet_icon_name("display-brightness-symbolic");
            }
            this._lastLux = smoothedLux;
            this._update_label(finalBrightness, smoothedLux);
            this._update_live_tooltip(smoothedLux, finalBrightness);
            this._errorCount = 0;
            this._logger.debug(
                "Poll: lux=" + smoothedLux.toFixed(1) +
                " target=" + targetBrightness +
                "% smoothed=" + (this._brightness !== null ? this._brightness.toFixed(2) : "null") +
                "% applied=" + finalBrightness + "%"
            );

        } catch (e) {
            this._errorCount++;
            if (this._errorCount > 5) {
                this._logger.error("Too many errors, auto-disabling");
                this._enabled = false;
                if (this.show_label !== "hide_actor") {
                    this.set_applet_icon_name("dialog-error-symbolic");
                }
                this.set_applet_label(" Error");
                this._update_tooltip();
            } else if (e && e.message !== this._lastError) {
                this._logger.error("Loop: " + (e && e.message ? e.message : e));
                this._lastError = e && e.message ? e.message : e;
            }
        } finally {
            this._isRunning = false;
            this._loopStartTime = 0;
            if (this._enabled) {
                this._schedule_next_loop();
            } else {
                // When disabled, remove any pending loop so we don't keep waking up
                if (this._loopId) {
                    Mainloop.source_remove(this._loopId);
                    this._loopId = null;
                }
            }
        }
    }

    /**
     * Notify the user once when brightnessctl fails persistently.
     *
     * @param {*} error - Failure from wait_finish or subprocess.
     */
    _notify_brightness_failure_once(error) {
        const msg = error && error.message ? error.message : String(error);
        this._logger.error("Brightness control failed: " + msg);
        if (!this._brightnessFailureNotified) {
            this._brightnessFailureNotified = true;
            Main.notify(
                "Adaptive Brightness",
                "Could not change screen brightness.\n" +
                "Check brightnessctl permissions (see README troubleshooting)."
            );
        }
    }

    /**
     * Spawn brightnessctl set and handle exit status asynchronously.
     *
     * @param {string} cmd         - brightnessctl executable path.
     * @param {number} brightness  - Target brightness percentage.
     * @param {boolean} useSudo    - Whether to invoke via sudo -n.
     */
    _spawn_brightness_set(cmd, brightness, useSudo) {
        const argv = useSudo
            ? ['sudo', '-n', cmd, 'set', brightness + '%']
            : [cmd, 'set', brightness + '%'];
        const proc = Gio.Subprocess.new(
            argv,
            Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
        );
        proc.wait_async(null, (p, res) => {
            try {
                p.wait_finish(res);
                this._brightnessFailureNotified = false;
                if (!useSudo && this._brightnessctlDirectFailed) {
                    this._brightnessctlDirectFailed = false;
                    this._logger.info("Direct brightnessctl succeeded, removing sudo fallback.");
                }
                this._logger.debug(
                    (useSudo ? "sudo " : "") + cmd + " set " + brightness + "% succeeded."
                );
            } catch (e) {
                if (!useSudo) {
                    this._brightnessctlDirectFailed = true;
                    this._logger.info("Direct brightnessctl failed, falling back to sudo.");
                    this._spawn_brightness_set(cmd, brightness, true);
                } else {
                    this._notify_brightness_failure_once(e);
                }
            }
        });
    }

    /**
     * Apply brightness using brightnessctl with sudo (non-interactive NOPASSWD).
     *
     * @param {number} brightness - Target brightness percentage.
     */
    _apply_brightness(brightness) {
        try {
            brightness = Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, brightness));
            const cmd = this._brightnessctlPath || 'brightnessctl';
            this._spawn_brightness_set(cmd, brightness, this._brightnessctlDirectFailed);
        } catch (e) {
            this._logger.error("_apply_brightness failed (brightness=" + brightness + "%): " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Cleanup resources when the applet is removed from the panel.
     */
    on_applet_removed_from_panel() {
        try {
            this._logger.info("Applet removed from panel, starting cleanup...");
            // Clean up screen-shield signal
            try {
                if (this._screenShieldId && Main.screenShield) {
                    Main.screenShield.disconnect(this._screenShieldId);
                    this._screenShieldId = null;
                }
            } catch (e) {
                this._logger.error("Cleanup screen-shield: " + (e && e.message ? e.message : e));
            }

            // Clean up main loop timer
            try {
                if (this._loopId) {
                    Mainloop.source_remove(this._loopId);
                    this._loopId = null;
                }
            } catch (e) {
                this._logger.error("Cleanup main loop: " + (e && e.message ? e.message : e));
            }

            // Clean up schedule timer
            try {
                if (this._scheduleTimerId) {
                    Mainloop.source_remove(this._scheduleTimerId);
                    this._scheduleTimerId = null;
                }
            } catch (e) {
                this._logger.error("Cleanup schedule timer: " + (e && e.message ? e.message : e));
            }

            // Clean up calibration timers and restore state
            try {
                if (this._calibration.timerId) {
                    Mainloop.source_remove(this._calibration.timerId);
                    this._calibration.timerId = null;
                }
                if (this._calibration.countdownId) {
                    Mainloop.source_remove(this._calibration.countdownId);
                    this._calibration.countdownId = null;
                }
                if (this._calibration.pollId) {
                    Mainloop.source_remove(this._calibration.pollId);
                    this._calibration.pollId = null;
                }
                if (this._calibration.originalPollInterval !== null) {
                    const restored = Math.max(POLL_INTERVAL.MIN,
                        Math.min(POLL_INTERVAL.MAX, this._calibration.originalPollInterval));
                    this.poll_interval = restored;
                    this._calibration.originalPollInterval = null;
                }
                // Ensure calibration state is fully reset regardless of interruption.
                // Safe to clear mutex here because GJS is single-threaded; any
                // in-flight calibration operations would have completed or failed.
                this._calibration.mutex = false;
                this._calibration.phase = CAL_PHASE.NONE;
            } catch (e) {
                this._logger.error("Cleanup calibration: " + (e && e.message ? e.message : e));
            }

            // Invalidate backlight cache.
            try {
                this._backlightPath = null;
                this._lastAppliedLux = UNINITIALIZED_VALUE;
            } catch (e) {
                this._logger.error("Cleanup backlight cache: " + (e && e.message ? e.message : e));
            }

            // Finalize settings
            try {
                if (this.settings) {
                    this.settings.finalize();
                }
            } catch (e) {
                this._logger.error("Cleanup settings: " + (e && e.message ? e.message : e));
            }
        } catch (e) {
            this._logger.error("on_applet_removed_from_panel: " + (e && e.message ? e.message : e));
        }
    }
}

// ── ABLogger (inlined from deleted logger.js) ───────────────────────────────

const LOG_LEVELS = { debug: 0, info: 1, error: 2 };
const MAX_BYTES = 200 * 1024; // 200 KB rotation threshold
const _textEncoder = new TextEncoder();

var ABLogger = class ABLogger {
    /**
     * @param {string} logDir  - Absolute path to the directory where the log file lives.
     *                           Created automatically on first write if absent.
     * @param {string} level   - Initial log level: "debug" | "info" | "error"
     */
    constructor(logDir, level) {
        this._logDir = logDir;
        this._logPath = logDir + "/adaptive-brightness.log";
        this._level = LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.info;
        this._enabled = true;
    }

    /** Write a DEBUG-level message (only when level ≤ debug). */
    debug(msg) {
        if (!this._enabled || this._level > LOG_LEVELS.debug) return;
        this._write("DEBUG", msg);
    }

    /** Write an INFO-level message (only when level ≤ info). */
    info(msg) {
        if (!this._enabled || this._level > LOG_LEVELS.info) return;
        this._write("INFO ", msg);
    }

    /**
     * Write an ERROR-level message (always written) and forward to
     * global.logError so journalctl continues to capture errors.
     */
    error(msg) {
        if (this._enabled) this._write("ERROR", msg);
        try { global.logError("[AB] " + msg); } catch (_) {
            // global.logError unavailable; silent fallback to prevent crash.
        }
    }

    /** Hot-swap the active log level without restarting the applet. */
    setLevel(level) {
        if (LOG_LEVELS[level] !== undefined) {
            this._level = LOG_LEVELS[level];
        }
    }

    /** Enable or disable file logging. */
    setEnabled(enabled) {
        this._enabled = !!enabled;
    }

    /** Truncate the log file. */
    clearLog() {
        try {
            this._ensureDir();
            const file = Gio.File.new_for_path(this._logPath);
            file.replace_contents(
                new Uint8Array(0),
                null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            try { global.logError("[AB] Logger clearLog failed: " + (e && e.message ? e.message : e)); } catch (_) {
            }
        }
    }

    /** Return the absolute path to the log file. */
    getLogPath() {
        return this._logPath;
    }

    /** Create the log directory and an empty log file if missing. */
    ensureLogFile() {
        try {
            this._ensureDir();
            const file = Gio.File.new_for_path(this._logPath);
            if (!file.query_exists(null)) {
                file.replace_contents(
                    new Uint8Array(0),
                    null, false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null
                );
            }
        } catch (e) {
            try { global.logError("[AB] Logger ensureLogFile failed: " + (e && e.message ? e.message : e)); } catch (_) {
            }
        }
    }

    _write(levelLabel, msg) {
        try {
            this._ensureDir();
            this._rotateIfNeeded();
            const line = "[" + this._timestamp() + "] [" + levelLabel + "] " + msg + "\n";
            const file = Gio.File.new_for_path(this._logPath);
            const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
            try {
                stream.write(_textEncoder.encode(line), null);
            } finally {
                stream.close(null);
            }
        } catch (e) {
            // Intentional swallow — a logger must never crash the applet.
        }
    }

    _ensureDir() {
        const dir = Gio.File.new_for_path(this._logDir);
        if (!dir.query_exists(null)) {
            dir.make_directory_with_parents(null);
        }
    }

    _rotateIfNeeded() {
        try {
            const file = Gio.File.new_for_path(this._logPath);
            if (!file.query_exists(null)) return;
            const info = file.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null);
            if (info.get_size() < MAX_BYTES) return;
            const backup = Gio.File.new_for_path(this._logPath + ".1");
            file.move(backup, Gio.FileCopyFlags.OVERWRITE, null, null);
        } catch (_) {
            // Intentional swallow — rotation failure must never crash the applet.
        }
    }

    _timestamp() {
        const now = new Date();
        const pad = (n, w) => String(n).padStart(w, "0");
        return (
            now.getFullYear() + "-" +
            pad(now.getMonth() + 1, 2) + "-" +
            pad(now.getDate(), 2) + " " +
            pad(now.getHours(), 2) + ":" +
            pad(now.getMinutes(), 2) + ":" +
            pad(now.getSeconds(), 2)
        );
    }
};

/**
 * Cinnamon applet entry point.
 *
 * @param {Object} metadata    - Applet metadata.
 * @param {number} orientation - Panel orientation.
 * @param {number} panelHeight - Panel height in pixels.
 * @param {number} instanceId  - Unique instance identifier.
 * @returns {AdaptiveBrightnessApplet} New applet instance.
 */
function main(metadata, orientation, panelHeight, instanceId) {
    try {
        return new AdaptiveBrightnessApplet(metadata, orientation, panelHeight, instanceId);
    } catch (e) {
        try { global.logError("[AB] main() failed: " + (e && e.message ? e.message : e)); } catch (_) {
            // global.logError unavailable; silent is the only safe fallback.
        }
        return null;
    }
}
