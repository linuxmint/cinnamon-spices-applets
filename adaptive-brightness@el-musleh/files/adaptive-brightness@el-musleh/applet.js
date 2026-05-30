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
const Settings = imports.ui.settings;
const Main = imports.ui.main;

// Constraints and defaults
const POLL_INTERVAL = { MIN: 100, DEFAULT: 1000, MAX: 60000 };
const BRIGHTNESS = { MIN: 1, MAX: 100, DEFAULT_MIN: 5, DEFAULT_MAX: 100 };
const BRIGHTNESS_AUTO = { MIN_APPLY_DELTA: 2 };
const SMOOTHING = { MIN: 0, MAX: 1, DEFAULT: 0.7 };
const LUX = {
    DEFAULT_MAX: 700,
    DEFAULT_MIN: 1,
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
const TRAVEL_MODE_HEADROOM = 1.10;
const MANUAL_OVERRIDE_COOLDOWN_US = 5 * 1000000; // 5 seconds in microseconds

// Zone detection constants
const ZONE_MIN_SAMPLES_RATIO = 0.5;
const INITIAL_HYSTERESIS_COUNT = 1;
const ZONE_PERCENTILE_LOW = 5;
const ZONE_PERCENTILE_HIGH = 95;
const ZONE_DARK_ROOM_MAX_LUX = 50;
const ZONE_INDOOR_MIN_LUX = 5;
const ZONE_INDOOR_MAX_LUX = 800;
const ZONE_OUTDOOR_MIN_LUX = 200;

const CAL_PHASE = { NONE: "none", DARK: "dark", BRIGHT: "bright" };
const LABEL_DISPLAY_MODES = ["brightness", "lux", "brightness_lux"];

// Strategy map for lux-to-brightness response curves.
// Each function receives (normalizedLux, luxRange) and returns normalized brightness in [0,1].
// Note: linear and sigmoidal ignore luxRange; logarithmic requires it.
const RESPONSE_CURVES = {
    linear: (n) => n,
    sigmoidal: (n) => 1 / (1 + Math.exp(SIGMOIDAL_STEEPNESS * (n - SIGMOIDAL_CENTER))),
    logarithmic: (n, luxRange) => Math.log(n * luxRange + LOG_OFFSET) / Math.log(luxRange + LOG_OFFSET),
};

// Zone definitions for Travel Mode environment detection.
// Each zone has a lux threshold range and an effective lux sub-range for dynamic brightness.
const ZONE = {
    DARK_ROOM: "DARK_ROOM",
    INDOOR: "INDOOR",
    OUTDOOR: "OUTDOOR",
};
const ZONE_THRESHOLDS = {
    DARK_ROOM: { max: 30 },
    INDOOR: { min: 30, max: 800 },
    OUTDOOR: { min: 800 },
};
const ZONE_HYSTERESIS = 5;
const ZONE_WINDOW_SIZE = 30;

/**
 * Main applet class that reads an ambient light sensor and adjusts screen brightness.
 *
 * Features:
 * - Multiple response curves (linear, sigmoidal, logarithmic)
 * - Travel Mode with zone-aware environment detection
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
            this._loopId = null;           // Mainloop source id for scheduled polling
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
            this._adaptiveCalibrationAboveCount = INITIAL_COUNTER_VALUE; // Consecutive samples above max-lux
            this._adaptiveCalibrationBelowCount = INITIAL_COUNTER_VALUE; // Consecutive samples below min-lux
            this._adaptiveCalibrationPeakLux = INITIAL_COUNTER_VALUE;    // Rolling peak lux during above-range window
            this._adaptiveCalibrationMinLux = Infinity;  // Rolling minimum lux during below-range window
            this._manualOverrideEndTime = 0;              // Monotonic time (us) until manual override cooldown expires
            // Zone detection state for enhanced Travel Mode
            this._luxWindow = [];              // Rolling window of recent lux samples
            this._currentZone = ZONE.INDOOR;   // Current detected environment zone
            this._zoneCounter = INITIAL_COUNTER_VALUE;             // Consecutive samples in candidate zone
            this._candidateZone = null;        // Zone being evaluated for transition
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
            this.label_display_mode = "brightness_lux";
            this.response_curve = "logarithmic";
            this.adaptive_calibration_enabled = false;
            this.adaptive_calibration_threshold = 15; // Note: this is the default, clamped in _clamp_settings
            this.lux_change_threshold = LUX_CHANGE_THRESHOLD.DEFAULT;
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
        return Math.abs(currentBrightness - this._previousBrightness) >= BRIGHTNESS_AUTO.MIN_APPLY_DELTA;
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
        this._previousBrightness = currentBrightness;
        this._lastLux = lux;
        this._manualOverrideEndTime = GLib.get_monotonic_time() + MANUAL_OVERRIDE_COOLDOWN_US;
        if (this.show_label !== "hide_actor") {
            this.set_applet_icon_name("display-brightness-symbolic");
        }
        this._update_label(currentBrightness, lux);
        this._update_live_tooltip(lux, currentBrightness);
        this._logger.debug("Manual brightness override adopted: " + currentBrightness + "%. Cooldown until " + this._manualOverrideEndTime + ".");
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
            this.settings.bind("adaptive-calibration-enabled", "adaptive_calibration_enabled", this._on_adaptive_calibration_changed.bind(this));
            this.settings.bind("adaptive-calibration-threshold", "adaptive_calibration_threshold", validator);
            this.settings.bind("response-curve", "response_curve", validator);
            this.settings.bind("lux-change-threshold", "lux_change_threshold", validator);
            this.settings.bind("sensor-path", "sensor_path", this._on_sensor_path_changed.bind(this));
            this.settings.bind("log-level", "log_level", this._on_log_level_changed.bind(this));

            // Initial validation applies defaults and may trigger an immediate
            // brightness computation if a recent lux exists.
            this._validate_settings();
        } catch (e) {
            this._logger.error("Settings init failed: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Callback for the sensor-path setting change.
     * Resets sensor availability, adaptive calibration counters, zone state,
     * and the dead-band so the next poll re-evaluates everything.
     */
    _on_sensor_path_changed() {
        try {
            this._sensorAvailable = false;
            this._sensorPath = null;
            this._locate_sensor();
            this._adaptiveCalibrationAboveCount = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationBelowCount = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationPeakLux = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationMinLux = Infinity;
            this._luxWindow = [];
            this._currentZone = ZONE.INDOOR;
            this._zoneCounter = INITIAL_COUNTER_VALUE;
            this._candidateZone = null;
            this._errorCount = INITIAL_COUNTER_VALUE;
            this._lastAppliedLux = UNINITIALIZED_VALUE;  // Reset dead-band so first poll always applies
            this._update_tooltip();
            this._logger.info("Sensor path changed — resetting error counter, zone state, and dead-band.");
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
            this._schedule_next_loop();
            this._logger.info("Polling started (interval=" + this.poll_interval + "ms).");
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
            if (this.log_level === "off") {
                this._logger.setEnabled(false);
            } else {
                this._logger.setEnabled(true);
                this._logger.setLevel(this.log_level);
            }
            this._logger.info("Log level changed to: " + this.log_level);
        } catch (e) {
            this._logger.error("Log level callback: " + (e && e.message ? e.message : e));
        }
    }

    /**
     * Callback when the adaptive-calibration-enabled (Travel Mode) setting changes.
     * Clears the rolling lux window and zone state so a fresh classification
     * begins when Travel Mode is turned back on.
     */
    _on_adaptive_calibration_changed() {
        try {
            this._luxWindow = [];
            this._currentZone = ZONE.INDOOR;
            this._zoneCounter = INITIAL_COUNTER_VALUE;
            this._candidateZone = null;
            this._adaptiveCalibrationAboveCount = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationBelowCount = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationPeakLux = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationMinLux = Infinity;
            this._logger.info("Travel Mode " + (this.adaptive_calibration_enabled ? "enabled" : "disabled") + " — zone state reset.");
            this._validate_settings();
        } catch (e) {
            this._logger.error("Travel Mode toggle callback: " + (e && e.message ? e.message : e));
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
     * Check whether a value is a valid non-negative finite lux reading.
     *
     * @param {*} lux - Value to validate.
     * @returns {boolean} True if lux is a valid reading.
     */
    _has_valid_lux(lux) {
        try {
            return lux !== null && lux !== undefined && isFinite(lux) && lux >= 0;
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
     * Includes the current zone name when Travel Mode is active.
     *
     * @param {number|null} lux       - Current lux reading.
     * @param {number|null} brightness - Current brightness percentage.
     */
    _update_live_tooltip(lux, brightness) {
        try {
            const luxText = this._has_valid_lux(lux) ? this._format_lux(lux) : "unknown";
            const brightnessText = brightness !== null && brightness !== undefined && isFinite(brightness)
                ? Math.round(brightness) + "%"
                : "calculating";
            let tooltip = "Light: " + luxText + " | Brightness: " + brightnessText;
            if (this.adaptive_calibration_enabled && this._luxWindow.length >= Math.floor(ZONE_WINDOW_SIZE * ZONE_MIN_SAMPLES_RATIO)) {
                tooltip += " [" + this._format_zone(this._currentZone) + "]";
            }
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
            const index = Math.ceil((percentile / 100) * sorted.length) - 1;
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
                const scale = this._readNumber(this._sensorPath.scale);
                const offset = this._sensorPath.offset ? this._readNumber(this._sensorPath.offset) : 0;
                if (raw !== null && scale !== null && offset !== null) {
                    lux = (raw + offset) * scale;
                }
            }

            if (lux === null || !isFinite(lux) || lux < 0) return;

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
                const raw = Gio.file_new_for_path(rawPath);
                const scale = Gio.file_new_for_path(scalePath);
                const input = inputPath ? Gio.file_new_for_path(inputPath) : null;

                if (raw.query_exists(null) && scale.query_exists(null)) {
                    const offset = offsetPath ? Gio.file_new_for_path(offsetPath) : null;
                    self._sensorPath = {
                        raw: rawPath,
                        scale: scalePath,
                        offset: offset && offset.query_exists(null) ? offsetPath : null,
                        input: null
                    };
                    self._sensorAvailable = true;
                    self._logger.info("Found sensor (raw+scale) at: " + rawPath);
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
            const dir = Gio.file_new_for_path(IIO_BASE);
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
        const rawAdaptiveCalibrationEnabled = this.adaptive_calibration_enabled;
        const rawAdaptiveCalibrationThreshold = this.adaptive_calibration_threshold;
        const rawLuxChangeThreshold = this.lux_change_threshold;
        const rawResponseCurve = this.response_curve;
        const rawLogLevel = this.log_level;
        this.min_brightness = Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, parseInt(this.min_brightness) || BRIGHTNESS.DEFAULT_MIN));
        this.max_brightness = Math.min(BRIGHTNESS.MAX, Math.max(this.min_brightness + 1, Math.min(BRIGHTNESS.MAX, parseInt(this.max_brightness) || BRIGHTNESS.DEFAULT_MAX)));
        const parsedSmoothing = parseFloat(this.smoothing_factor);
        this.smoothing_factor = Math.max(SMOOTHING.MIN, Math.min(SMOOTHING.MAX, Number.isFinite(parsedSmoothing) ? parsedSmoothing : SMOOTHING.DEFAULT));
        const parsedMaxLux = parseInt(this.max_lux, 10);
        this.max_lux = Math.max(LUX.MIN_MAX, Number.isFinite(parsedMaxLux) ? parsedMaxLux : LUX.DEFAULT_MAX);
        const parsedMinLux = parseInt(this.min_lux, 10);
        this.min_lux = Math.max(LUX.MIN_MIN, Math.min(LUX.MAX_MIN, Number.isFinite(parsedMinLux) ? parsedMinLux : LUX.DEFAULT_MIN));
        const minGap = Math.max(LUX.MIN_GAP, Math.round(this.max_lux * LUX.GAP_ENFORCEMENT_RATIO));
        if (this._calibration.phase === CAL_PHASE.NONE && this.min_lux >= this.max_lux - minGap) {
            const correctedMinLux = Math.max(0, this.max_lux - minGap);
            this._logger.info("Settings clamped: min-lux " + this.min_lux + " -> " + correctedMinLux + " (gap enforcement: max_lux=" + this.max_lux + ", minGap=" + minGap + ", persisted).");
            this.min_lux = correctedMinLux;
            this.settings.setValue("min-lux", this.min_lux);
        }
        let interval = parseInt(this.poll_interval) || POLL_INTERVAL.DEFAULT;
        if (!this._calibration.mutex) {
            this.poll_interval = Math.max(POLL_INTERVAL.MIN, Math.min(POLL_INTERVAL.MAX, interval));
        }
        const validPanelModes = ["live_status", "icon_only", "hide_actor"];
        if (!validPanelModes.includes(this.show_label)) {
            this.show_label = "live_status";
        }
        if (!LABEL_DISPLAY_MODES.includes(this.label_display_mode)) {
            this.label_display_mode = "brightness_lux";
        }
        this.adaptive_calibration_enabled = rawAdaptiveCalibrationEnabled !== false;
        this.adaptive_calibration_threshold = Math.max(1, Math.min(60, parseInt(this.adaptive_calibration_threshold) || 15));
        const parsedLuxThreshold = parseInt(this.lux_change_threshold);
        this.lux_change_threshold = Math.max(LUX_CHANGE_THRESHOLD.MIN, Math.min(LUX_CHANGE_THRESHOLD.MAX,
            Number.isFinite(parsedLuxThreshold) ? parsedLuxThreshold : LUX_CHANGE_THRESHOLD.DEFAULT));

        const validResponseCurves = Object.keys(RESPONSE_CURVES);
        if (!validResponseCurves.includes(this.response_curve)) {
            this.response_curve = "logarithmic";
        }
        const validLogLevels = ["off", "debug", "info", "error"];
        if (!validLogLevels.includes(this.log_level)) {
            this.log_level = "off";
        }

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
        persistIfChanged("adaptive-calibration-enabled", rawAdaptiveCalibrationEnabled, this.adaptive_calibration_enabled);
        persistIfChanged("adaptive-calibration-threshold", rawAdaptiveCalibrationThreshold, this.adaptive_calibration_threshold);
        persistIfChanged("lux-change-threshold", rawLuxChangeThreshold, this.lux_change_threshold);
        persistIfChanged("response-curve", rawResponseCurve, this.response_curve);
        persistIfChanged("log-level", rawLogLevel, this.log_level);
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
            if (isFinite(this._lastLux) && this._lastLux >= 0) {
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
            this._enabled = !this._enabled;
            this._adaptiveCalibrationAboveCount = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationBelowCount = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationMinLux = Infinity;
            this._luxWindow = [];
            this._currentZone = ZONE.INDOOR;
            this._zoneCounter = INITIAL_COUNTER_VALUE;
            this._candidateZone = null;
            if (this._enabled) {
                this._lastAppliedLux = UNINITIALIZED_VALUE;
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
            this._logger.info("Applet " + (this._enabled ? "enabled" : "disabled") + " by user click.");

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
                    // Ensure the scheduler matches the configured interval
                    this._schedule_next_loop();
                }
            }
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
            if (!isFinite(num) || num < 0) {
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
        try {
            const base = Gio.file_new_for_path("/sys/class/backlight");
            if (!base.query_exists(null)) return null;
            const enumerator = base.enumerate_children("standard::name", 0, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const candidate = "/sys/class/backlight/" + info.get_name();
                const brightnessFile = Gio.file_new_for_path(candidate + "/brightness");
                const maxFile = Gio.file_new_for_path(candidate + "/max_brightness");
                if (brightnessFile.query_exists(null) && maxFile.query_exists(null)) {
                    this._backlightPath = candidate;
                    this._logger.info("Found backlight device: " + candidate);
                    enumerator.close(null);
                    return this._backlightPath;
                }
            }
            enumerator.close(null);
            this._backlightPath = null;
            this._logger.info("No backlight device found in /sys/class/backlight.");
        } catch (e) {
            this._logger.debug("_find_backlight_path: " + (e && e.message ? e.message : e));
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
     * When Travel Mode is ON, uses zone-aware effective lux range for finer
     * granularity within the detected environment.
     *
     * @param {number} lux - Ambient light reading.
     * @returns {number} Brightness percentage in [BRIGHTNESS.MIN, BRIGHTNESS.MAX].
     */
    _luxToBrightness(lux) {
        try {
            if (!isFinite(lux) || lux < 0 || !isFinite(this.max_lux) || this.max_lux <= 0) {
                return this.min_brightness;
            }

            // Determine effective lux range: zone-aware when Travel Mode is ON,
            // otherwise use global min/max lux settings.
            const effectiveRange = this._get_zone_effective_range();
            const effMin = effectiveRange.min;
            const effMax = effectiveRange.max;
            this._logger.debug("Effective range: min=" + effMin + " max=" + effMax);

            if (lux <= effMin) return this.min_brightness;
            if (lux >= effMax) return this.max_brightness;

            const luxRange = effMax - effMin;
            if (luxRange <= 0) return this.min_brightness;
            const linearNorm = (lux - effMin) / luxRange;
            const curveFn = RESPONSE_CURVES[this.response_curve] || RESPONSE_CURVES.logarithmic;
            let normalized = curveFn(linearNorm, luxRange);

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
     * Update min/max lux automatically after consecutive out-of-range samples.
     * Uses a rolling peak for max-lux updates to avoid basing calibration on a
     * single potentially noisy sample.
     *
     * @param {number} lux - Current lux reading.
     */
    _adaptive_calibration_sample(lux) {
        if (!this.adaptive_calibration_enabled) {
            this._adaptiveCalibrationAboveCount = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationBelowCount = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationPeakLux = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationMinLux = Infinity;
            return;
        }

        // Use the bound value directly — it has already been clamped by _clamp_settings.
        // Apply an additional safety clamp in case settings are corrupted.
        const threshold = Math.max(1, Math.min(60, this.adaptive_calibration_threshold));

        if (lux > this.max_lux) {
            this._adaptiveCalibrationAboveCount++;
            this._adaptiveCalibrationBelowCount = INITIAL_COUNTER_VALUE;
            // Track the highest lux seen in this consecutive above-range window
            if (lux > this._adaptiveCalibrationPeakLux) {
                this._adaptiveCalibrationPeakLux = lux;
            }
            this._logger.debug(
                "Travel Mode above-range: lux=" + lux.toFixed(1) +
                " max_lux=" + this.max_lux +
                " count=" + this._adaptiveCalibrationAboveCount +
                "/" + threshold +
                " peak=" + this._adaptiveCalibrationPeakLux.toFixed(1)
            );
            if (this._adaptiveCalibrationAboveCount >= threshold) {
                // Use the rolling peak for a more robust max-lux estimate
                const newMaxLux = Math.round(this._adaptiveCalibrationPeakLux * TRAVEL_MODE_HEADROOM);
                if (newMaxLux !== this.max_lux) {
                    this._logger.info(
                        "Travel Mode: max-lux " + this.max_lux + " -> " + newMaxLux +
                        " (peak over " + threshold + " consecutive above-range samples)."
                    );
                    this.max_lux = newMaxLux;
                    this.settings.setValue("max-lux", newMaxLux);
                    this._validate_settings();
                }
                this._adaptiveCalibrationAboveCount = INITIAL_COUNTER_VALUE;
                this._adaptiveCalibrationPeakLux = INITIAL_COUNTER_VALUE;
            }
            return;
        }

        if (lux < this.min_lux) {
            this._adaptiveCalibrationBelowCount++;
            this._adaptiveCalibrationAboveCount = INITIAL_COUNTER_VALUE;
            this._adaptiveCalibrationPeakLux = INITIAL_COUNTER_VALUE;
            // Track the lowest lux seen in this consecutive below-range window
            if (lux < this._adaptiveCalibrationMinLux) {
                this._adaptiveCalibrationMinLux = lux;
            }
            this._logger.debug(
                "Travel Mode below-range: lux=" + lux.toFixed(1) +
                " min_lux=" + this.min_lux +
                " count=" + this._adaptiveCalibrationBelowCount +
                "/" + threshold +
                " minRolling=" + this._adaptiveCalibrationMinLux.toFixed(1)
            );
            if (this._adaptiveCalibrationBelowCount >= threshold) {
                const newMinLux = Math.round(this._adaptiveCalibrationMinLux * TRAVEL_MODE_HEADROOM);
                if (newMinLux !== this.min_lux) {
                    this._logger.info(
                        "Travel Mode: min-lux " + this.min_lux + " -> " + newMinLux +
                        " after " + threshold + " consecutive below-range samples" +
                        " (rolling min=" + this._adaptiveCalibrationMinLux.toFixed(1) + ")."
                    );
                    this.min_lux = newMinLux;
                    this.settings.setValue("min-lux", newMinLux);
                    this._validate_settings();
                }
                this._adaptiveCalibrationBelowCount = INITIAL_COUNTER_VALUE;
                this._adaptiveCalibrationMinLux = Infinity;
            }
            return;
        }

        // In-range: reset all counters
        this._adaptiveCalibrationAboveCount = INITIAL_COUNTER_VALUE;
        this._adaptiveCalibrationBelowCount = INITIAL_COUNTER_VALUE;
        this._adaptiveCalibrationPeakLux = INITIAL_COUNTER_VALUE;
        this._adaptiveCalibrationMinLux = Infinity;
        this._logger.debug("Travel Mode: in-range, resetting all adaptive counters.");
    }

    /**
     * Classify a lux value into an environment zone.
     *
     * @param {number} lux - Lux reading.
     * @returns {string} Zone constant (DARK_ROOM, INDOOR, or OUTDOOR).
     */
    _classify_zone(lux) {
        try {
            if (lux <= ZONE_THRESHOLDS.DARK_ROOM.max) return ZONE.DARK_ROOM;
            if (lux >= ZONE_THRESHOLDS.OUTDOOR.min) return ZONE.OUTDOOR;
            return ZONE.INDOOR;
        } catch (e) {
            this._logger.error("_classify_zone failed: " + (e && e.message ? e.message : e));
            return ZONE.INDOOR;
        }
    }

    /**
     * Update the rolling lux window and detect zone transitions.
     * Only active when Travel Mode (adaptive calibration) is enabled.
     *
     * @param {number} lux - Current lux reading.
     * @returns {string} Current zone constant.
     */
    _update_zone_detection(lux) {
        if (!this.adaptive_calibration_enabled) {
            return this._currentZone;
        }

        // Maintain rolling window
        this._luxWindow.push(lux);
        if (this._luxWindow.length > ZONE_WINDOW_SIZE) {
            this._luxWindow.shift();
        }

        // Need at least half the window before classifying
        const minSamples = Math.floor(ZONE_WINDOW_SIZE * ZONE_MIN_SAMPLES_RATIO);
        if (this._luxWindow.length < minSamples) {
            this._logger.debug("Zone detection: window too small (" + this._luxWindow.length + " / " + minSamples + " samples).");
            return this._currentZone;
        }

        // Compute rolling median for zone classification
        const median = this._median(this._luxWindow);
        const detectedZone = this._classify_zone(median);

        // Hysteresis: require consecutive samples in the new zone before switching
        if (detectedZone !== this._currentZone) {
            if (detectedZone === this._candidateZone) {
                this._zoneCounter++;
                if (this._zoneCounter >= ZONE_HYSTERESIS) {
                    const prevZone = this._currentZone;
                    this._currentZone = detectedZone;
                    this._candidateZone = null;
                    this._zoneCounter = INITIAL_COUNTER_VALUE;
                    this._logger.info(
                        "Travel Mode zone transition: " + prevZone + " -> " + this._currentZone +
                        " (median=" + median.toFixed(1) + " lux, window=" + this._luxWindow.length + ")"
                    );
                }
            } else {
                this._candidateZone = detectedZone;
                this._zoneCounter = INITIAL_HYSTERESIS_COUNT;
                this._logger.debug("Zone candidate: " + detectedZone + " (median=" + median.toFixed(1) + " lux).");
            }
        } else {
            this._candidateZone = null;
            this._zoneCounter = INITIAL_COUNTER_VALUE;
        }

        return this._currentZone;
    }

    /**
     * Clamp a zone-derived lux range to the user's configured min/max bounds.
     *
     * @param {number} rawMin - Proposed effective minimum lux.
     * @param {number} rawMax - Proposed effective maximum lux.
     * @returns {{min: number, max: number}} Clamped effective range.
     */
    _clamp_zone_effective_range(rawMin, rawMax) {
        const minGap = Math.max(LUX.MIN_GAP, Math.round(this.max_lux * LUX.GAP_ENFORCEMENT_RATIO));
        let min = Math.max(this.min_lux, rawMin);
        let max = Math.min(this.max_lux, rawMax);
        if (max - min < minGap) {
            max = Math.min(this.max_lux, min + minGap);
            min = Math.max(this.min_lux, max - minGap);
        }
        return { min, max };
    }

    /**
     * Compute the effective lux range for the current zone.
     * Uses percentile-based bounds from the rolling lux window to dynamically
     * tighten the brightness mapping to the actual ambient range.
     *
     * @returns {{min: number, max: number}} Effective min and max lux.
     */
    _get_zone_effective_range() {
        if (!this.adaptive_calibration_enabled || this._luxWindow.length < Math.floor(ZONE_WINDOW_SIZE * ZONE_MIN_SAMPLES_RATIO)) {
            return { min: this.min_lux, max: this.max_lux };
        }

        const p5 = this._percentile(this._luxWindow, ZONE_PERCENTILE_LOW);
        const p95 = this._percentile(this._luxWindow, ZONE_PERCENTILE_HIGH);

        switch (this._currentZone) {
            case ZONE.DARK_ROOM:
                return this._clamp_zone_effective_range(
                    0,
                    Math.max(ZONE_DARK_ROOM_MAX_LUX, p95)
                );
            case ZONE.INDOOR:
                return this._clamp_zone_effective_range(
                    Math.min(ZONE_INDOOR_MIN_LUX, p5),
                    Math.max(ZONE_INDOOR_MAX_LUX, p95)
                );
            case ZONE.OUTDOOR:
                return this._clamp_zone_effective_range(
                    Math.min(ZONE_OUTDOOR_MIN_LUX, p5),
                    Math.max(this.max_lux, p95)
                );
            default:
                return { min: this.min_lux, max: this.max_lux };
        }
    }

    /**
     * Format a zone constant for display in tooltip/label.
     *
     * @param {string} zone - Zone constant.
     * @returns {string} Human-readable zone name.
     */
    _format_zone(zone) {
        try {
            switch (zone) {
                case ZONE.DARK_ROOM: return "Dark Room";
                case ZONE.INDOOR: return "Indoor";
                case ZONE.OUTDOOR: return "Outdoor";
                default: return "";
            }
        } catch (e) {
            this._logger.error("_format_zone failed: " + (e && e.message ? e.message : e));
            return "";
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
            // Already running — skip this invocation but still reschedule
            // so we don't lose the loop. _isRunning will be cleared by the
            // in-flight call's finally block.
            if (!this._loopId) {
                this._schedule_next_loop();
            }
            return;
        }
        this._isRunning = true;

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
                const scale = this._readNumber(this._sensorPath.scale);
                const offset = this._sensorPath.offset ? this._readNumber(this._sensorPath.offset) : 0;
                if (raw !== null && scale !== null && offset !== null) {
                    lux = (raw + offset) * scale;
                }
            }

            if (lux === null || !isFinite(lux) || lux < 0) {
                this._logger.debug("_do_loop skipped: invalid lux reading.");
                return;
            }

            // Always run adaptive calibration and zone detection regardless of the dead-band.
            this._adaptive_calibration_sample(lux);
            this._update_zone_detection(lux);

            const currentBrightness = this._read_current_brightness();

            // 1. Detect a fresh manual brightness override and start the cooldown.
            if (this._is_manual_brightness_override(currentBrightness)) {
                this._adopt_manual_brightness(currentBrightness, lux);
                return;
            }

            // 2. During the cooldown window, respect the manual value and skip adaptive computation.
            const now = GLib.get_monotonic_time();
            if (now < this._manualOverrideEndTime) {
                this._lastLux = lux;
                const displayBrightness = currentBrightness !== null
                    ? currentBrightness
                    : (this._brightness !== null ? Math.round(this._brightness) : undefined);
                this._update_label(displayBrightness, lux);
                this._update_live_tooltip(lux, displayBrightness);
                this._logger.debug("Manual override cooldown active, skipping adaptive.");
                return;
            }

            // 3. Cooldown just expired — reset the dead-band so the next poll recomputes.
            if (this._manualOverrideEndTime > 0) {
                this._manualOverrideEndTime = 0;
                this._lastAppliedLux = UNINITIALIZED_VALUE;
                this._logger.debug("Manual override cooldown expired, resuming adaptive.");
            }

            // 4. Lux dead-band: skip brightness recomputation when sensor noise causes
            // tiny lux fluctuations that would otherwise drift the smoothing buffer.
            // Always compute on the very first poll (_lastAppliedLux === -1).
            const luxDelta = Math.abs(lux - this._lastAppliedLux);
            const deadBand = Math.max(0, this.lux_change_threshold);
            if (this._lastAppliedLux >= 0 && deadBand > 0 && luxDelta < deadBand) {
                this._lastLux = lux;
                const displayBrightness = currentBrightness !== null
                    ? currentBrightness
                    : (this._brightness !== null ? Math.round(this._brightness) : undefined);
                this._logger.debug(
                    "Dead-band skip: lux=" + lux.toFixed(1) +
                    " lastApplied=" + this._lastAppliedLux.toFixed(1) +
                    " delta=" + luxDelta.toFixed(1) +
                    " threshold=" + deadBand
                );
                this._update_label(displayBrightness, lux);
                this._update_live_tooltip(lux, displayBrightness);
                return;
            }
            this._lastAppliedLux = lux;

            let targetBrightness = this._luxToBrightness(lux);

            // Exponential smoothing: smoothing_factor is smoothness (0=instant, 1=frozen).
            // responsiveness = (1 - factor) is the fraction moved toward target each poll.
            if (this._brightness === null) {
                this._brightness = targetBrightness;
            } else {
                const smoothness = Math.max(SMOOTHING.MIN, Math.min(SMOOTHING.MAX, this.smoothing_factor));
                const responsiveness = 1 - smoothness;
                this._brightness = this._brightness + (targetBrightness - this._brightness) * responsiveness;
            }

            const finalBrightness = Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, Math.round(this._brightness)));

            const targetDelta = this._previousBrightness >= 0
                ? Math.abs(finalBrightness - this._previousBrightness)
                : Infinity;

            if (this._previousBrightness < 0 || targetDelta >= BRIGHTNESS_AUTO.MIN_APPLY_DELTA) {
                this._apply_brightness(finalBrightness);
                this._previousBrightness = finalBrightness;
            }

            if (this.show_label !== "hide_actor") {
                this.set_applet_icon_name("display-brightness-symbolic");
            }
            this._lastLux = lux;
            this._update_label(finalBrightness, lux);
            this._update_live_tooltip(lux, finalBrightness);
            this._errorCount = 0;
            this._logger.debug(
                "Poll: lux=" + lux.toFixed(1) +
                " target=" + targetBrightness +
                "% smoothed=" + (this._brightness !== null ? this._brightness.toFixed(2) : "null") +
                "% applied=" + finalBrightness + "%" +
                (this.adaptive_calibration_enabled ? " zone=" + this._currentZone : "")
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
            // Clean up main loop timer
            try {
                if (this._loopId) {
                    Mainloop.source_remove(this._loopId);
                    this._loopId = null;
                }
            } catch (e) {
                this._logger.error("Cleanup main loop: " + (e && e.message ? e.message : e));
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
                // Ensure calibration state is fully reset regardless of interruption
                this._calibration.mutex = false;
                this._calibration.phase = CAL_PHASE.NONE;
            } catch (e) {
                this._logger.error("Cleanup calibration: " + (e && e.message ? e.message : e));
            }

            // Invalidate backlight cache and reset adaptive calibration counters.
            try {
                this._backlightPath = null;
                this._adaptiveCalibrationAboveCount = INITIAL_COUNTER_VALUE;
                this._adaptiveCalibrationBelowCount = INITIAL_COUNTER_VALUE;
                this._adaptiveCalibrationPeakLux = INITIAL_COUNTER_VALUE;
                this._adaptiveCalibrationMinLux = Infinity;
                this._luxWindow = [];
                this._currentZone = ZONE.INDOOR;
                this._zoneCounter = INITIAL_COUNTER_VALUE;
                this._candidateZone = null;
                this._lastAppliedLux = UNINITIALIZED_VALUE;
            } catch (e) {
                this._logger.error("Cleanup adaptive calibration: " + (e && e.message ? e.message : e));
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
            const file = Gio.file_new_for_path(this._logPath);
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
            const file = Gio.file_new_for_path(this._logPath);
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
            const file = Gio.file_new_for_path(this._logPath);
            const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
            try {
                stream.write(new TextEncoder().encode(line), null);
            } finally {
                stream.close(null);
            }
        } catch (e) {
            // Intentional swallow — a logger must never crash the applet.
        }
    }

    _ensureDir() {
        const dir = Gio.file_new_for_path(this._logDir);
        if (!dir.query_exists(null)) {
            dir.make_directory_with_parents(null);
        }
    }

    _rotateIfNeeded() {
        try {
            const file = Gio.file_new_for_path(this._logPath);
            if (!file.query_exists(null)) return;
            const info = file.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null);
            if (info.get_size() < MAX_BYTES) return;
            const backup = Gio.file_new_for_path(this._logPath + ".1");
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
