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
const BRIGHTNESS = { MIN: 1, MAX: 100, DEFAULT_MIN: 10, DEFAULT_MAX: 100 };
const SMOOTHING = { MIN: 0, MAX: 1, DEFAULT: 0.2 };
const LUX = {
    DEFAULT_MAX: 10000,
    DEFAULT_MIN: 0,
    MIN_MAX: 100,
    MIN_MIN: 0,
    MAX_MIN: 5000,
    MIN_RANGE_RATIO: 0.05
};

const CAL_PHASE = { NONE: "none", DARK: "dark", BRIGHT: "bright" };

class AdaptiveBrightnessApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        try {
            super(orientation, panelHeight, instanceId);
            this.metadata = metadata;

            // Runtime state
            this._isRunning = false;        // re-entrancy guard for the poll loop
            this._loopId = null;           // Mainloop source id for scheduled polling
            this._enabled = true;          // user toggle state
            this._sensorAvailable = false; // whether a usable sensor was found
            this._sensorPath = null;       // the chosen sensor path object
            this._brightness = null;       // buffered (smoothed) brightness value
            this._previousBrightness = -1; // last applied brightness
            this._lastLux = -1;            // most recent lux reading
            this._errorCount = 0;          // consecutive error count
            this._lastError = null;        // last error message logged
            this._lastPollInterval = undefined; // tracks poll interval changes
            this._calPhase         = CAL_PHASE.NONE;
            this._calTimerId       = null;
            this._calCountdownId   = null;
            this._calDarkSamples   = [];
            this._calBrightMax     = 0;
            this._calCountdown     = 0;

            // Settings with safe defaults
            this.min_brightness = BRIGHTNESS.DEFAULT_MIN;
            this.max_brightness = BRIGHTNESS.DEFAULT_MAX;
            this.smoothing_factor = SMOOTHING.DEFAULT;
            this.max_lux = LUX.DEFAULT_MAX;
            this.poll_interval = POLL_INTERVAL.DEFAULT;
            this.calibrate_max_lux = false;
            this.min_lux = LUX.DEFAULT_MIN;
            this.sensor_path = "";
            this.calibrate_min_lux = false;

            // Bind settings to local fields and validate on change
            try {
                this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
                const validator = this._validate_settings.bind(this);
                this.settings.bind("min-brightness", "min_brightness", validator);
                this.settings.bind("max-brightness", "max_brightness", validator);
                this.settings.bind("smoothing-factor", "smoothing_factor", validator);
                this.settings.bind("max-lux", "max_lux", validator);
                this.settings.bind("poll-interval", "poll_interval", validator);
                this.settings.bind("min-lux", "min_lux", validator);
                this.settings.bind("sensor-path", "sensor_path", function() {
                    try {
                        this._sensorAvailable = false;
                        this._sensorPath = null;
                        this._locate_sensor();
                        this._update_tooltip();
                    } catch (e) {
                        global.logError("[AB] sensor-path binding callback: " + (e && e.message ? e.message : e));
                    }
                }.bind(this));
                this.settings.bind("calibrate-min-lux", "calibrate_min_lux",
                    this._start_dark_calibration.bind(this));
                this.settings.bind("calibrate-max-lux", "calibrate_max_lux",
                    this._start_bright_calibration.bind(this));

                // Initial validation applies defaults and may trigger an immediate
                // brightness computation if a recent lux exists.
                this._validate_settings();
            } catch (e) {
                global.logError("[AB] Settings init failed: " + (e && e.message ? e.message : e));
            }

            // Locate an available ambient light sensor and start polling
            this._locate_sensor();
            this.set_applet_label("🌤");
            this._update_tooltip();
            this._schedule_next_loop();
        } catch (e) {
            global.logError("[AB] Constructor: " + (e && e.message ? e.message : e));
            this.set_applet_label("⚠");
        }
    }

    _start_dark_calibration() {
        if (!this.calibrate_min_lux) return;
        if (this._calPhase !== CAL_PHASE.NONE) {
            global.log("[AB] Calibration already running, ignoring DARK start.");
            return;
        }
        if (!this._sensorAvailable) {
            Main.notify("Adaptive Brightness", "No sensor found — cannot calibrate.");
            return;
        }

        global.log("[AB] DARK calibration phase started.");
        this._calPhase = CAL_PHASE.DARK;
        this._calDarkSamples = [];
        this._calCountdown = 60;

        Main.notify("Adaptive Brightness",
            "DARK phase started.\nGo to your dimmest environment.\nReading for 60 seconds.");

        this._calCountdownId = Mainloop.timeout_add(1000, this._cal_tick_dark.bind(this));
        const self = this;
        this._calTimerId = Mainloop.timeout_add(60000, function() {
            self._calTimerId = null;
            self._finish_dark_calibration();
            return false;
        });
    }

    _cal_tick_dark() {
        if (this._calPhase !== CAL_PHASE.DARK) return false;
        this._calCountdown = Math.max(0, this._calCountdown - 1);
        const cur = this._lastLux >= 0 ? this._lastLux.toFixed(1) + " lux" : "reading…";
        this.set_applet_tooltip(
            "[Calibrating DARK] " + cur + " | " + this._calCountdown + "s remaining"
        );
        if (this._calCountdown <= 0) { this._calCountdownId = null; return false; }
        return true;
    }

    _finish_dark_calibration() {
        if (this._calPhase !== CAL_PHASE.DARK) return;
        this._calPhase = CAL_PHASE.NONE;

        if (this._calCountdownId) {
            Mainloop.source_remove(this._calCountdownId);
            this._calCountdownId = null;
        }
        if (this._calTimerId) {
            Mainloop.source_remove(this._calTimerId);
            this._calTimerId = null;
        }
        this.calibrate_min_lux = false;

        const samples = this._calDarkSamples;

        if (samples.length < 3) {
            Main.notify("Adaptive Brightness",
                "DARK calibration failed: too few samples (" + samples.length + ").\n" +
                "Ensure the sensor is active and the poll interval is under 5000ms.");
            this._update_tooltip();
            return;
        }

        samples.sort(function(a, b) { return a - b; });
        const floorIdx = Math.floor(samples.length * 0.25);
        const noiseFloor = samples[floorIdx];

        const maxAllowed = this.max_lux * LUX.MIN_RANGE_RATIO;
        if (noiseFloor > maxAllowed) {
            Main.notify("Adaptive Brightness",
                "DARK calibration: noise floor (" + noiseFloor.toFixed(1) + " lux) " +
                "exceeds 5% of max-lux (" + this.max_lux + ").\n" +
                "The environment may not be dark enough, or max-lux is too low.\n" +
                "min-lux not updated.");
            this._update_tooltip();
            return;
        }

        const newMinLux = Math.round(noiseFloor * 1.10);
        this.min_lux = newMinLux;
        this.settings.setValue("min-lux", newMinLux);

        global.log("[AB] DARK calibration complete. min-lux=" + newMinLux);
        Main.notify("Adaptive Brightness",
            "DARK calibration complete.\nmin-lux set to " + newMinLux + " lux.\n" +
            "Now calibrate BRIGHT level if needed.");
        this._update_tooltip();
    }

    _start_bright_calibration() {
        if (!this.calibrate_max_lux) return;
        if (this._calPhase !== CAL_PHASE.NONE) {
            global.log("[AB] Calibration already running, ignoring BRIGHT start.");
            return;
        }
        if (!this._sensorAvailable) {
            Main.notify("Adaptive Brightness", "No sensor found — cannot calibrate.");
            return;
        }

        global.log("[AB] BRIGHT calibration phase started.");
        this._calPhase = CAL_PHASE.BRIGHT;
        this._calBrightMax = 0;
        this._calCountdown = 60;

        Main.notify("Adaptive Brightness",
            "BRIGHT phase started.\nGo to your brightest environment.\nReading for 60 seconds.");

        this._calCountdownId = Mainloop.timeout_add(1000, this._cal_tick_bright.bind(this));
        const self = this;
        this._calTimerId = Mainloop.timeout_add(60000, function() {
            self._calTimerId = null;
            self._finish_bright_calibration();
            return false;
        });
    }

    _cal_tick_bright() {
        if (this._calPhase !== CAL_PHASE.BRIGHT) return false;
        this._calCountdown = Math.max(0, this._calCountdown - 1);
        const cur = this._lastLux >= 0 ? this._lastLux.toFixed(1) + " lux" : "reading…";
        this.set_applet_tooltip(
            "[Calibrating BRIGHT] " + cur + " | " + this._calCountdown + "s remaining"
        );
        if (this._calCountdown <= 0) { this._calCountdownId = null; return false; }
        return true;
    }

    _finish_bright_calibration() {
        if (this._calPhase !== CAL_PHASE.BRIGHT) return;
        this._calPhase = CAL_PHASE.NONE;

        if (this._calCountdownId) {
            Mainloop.source_remove(this._calCountdownId);
            this._calCountdownId = null;
        }
        if (this._calTimerId) {
            Mainloop.source_remove(this._calTimerId);
            this._calTimerId = null;
        }
        this.calibrate_max_lux = false;

        if (this._calBrightMax < LUX.MIN_MAX) {
            Main.notify("Adaptive Brightness",
                "BRIGHT calibration failed: peak lux (" + this._calBrightMax.toFixed(1) +
                ") below minimum threshold (" + LUX.MIN_MAX + ").\n" +
                "Ensure sensor is exposed to bright light during calibration.");
            this._update_tooltip();
            return;
        }

        const minGap = Math.max(10, Math.round(this._calBrightMax * LUX.MIN_RANGE_RATIO));
        if (this._calBrightMax - this.min_lux < minGap) {
            Main.notify("Adaptive Brightness",
                "BRIGHT calibration: range too narrow (max=" + this._calBrightMax.toFixed(1) +
                ", min=" + this.min_lux + ").\n" +
                "Please calibrate DARK level first, or expose sensor to brighter light.");
            this._update_tooltip();
            return;
        }

        const newMaxLux = Math.round(this._calBrightMax);
        this.max_lux = newMaxLux;
        this.settings.setValue("max-lux", newMaxLux);

        global.log("[AB] BRIGHT calibration complete. max-lux=" + newMaxLux);
        Main.notify("Adaptive Brightness",
            "BRIGHT calibration complete.\nmax-lux set to " + newMaxLux + " lux.");
        this._update_tooltip();
    }

    // Try to find a usable ambient light sensor. Priority order:
    // 1. User-provided sensor path override
    // 2. Enumerate iio:device0-9 (raw+scale, then input)
    // 3. Legacy /sys/class/sensors/light path
    _locate_sensor() {
        const self = this;
        const checkPath = function(rawPath, scalePath, offsetPath, inputPath) {
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
                    global.log("[AB] Found sensor (raw+scale) at: " + rawPath);
                    return true;
                }
                if (input && input.query_exists(null)) {
                    self._sensorPath = { raw: null, scale: null, offset: null, input: inputPath };
                    self._sensorAvailable = true;
                    global.log("[AB] Found sensor (direct input) at: " + inputPath);
                    return true;
                }
            } catch (e) {
                global.log("[AB] Sensor check failed for " + rawPath + ": " + (e && e.message ? e.message : e));
            }
            return false;
        };

        // Try user override if provided
        if (this.sensor_path && this.sensor_path.trim() !== "") {
            const base = this.sensor_path.trim();
            if (checkPath(
                base + "/in_illuminance_raw",
                base + "/in_illuminance_scale",
                base + "/in_illuminance_offset",
                base + "/in_illuminance_input"
            )) {
                return;
            }
        }

        // Enumerate iio:device0 through iio:device9
        const IIO_BASE = "/sys/bus/iio/devices/";
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

        global.logError("[AB] No light sensor found");
        this._enabled = false;
    }

    // Update the tray tooltip to reflect current state for users
    _update_tooltip() {
        if (this._enabled && this._sensorAvailable) {
            this.set_applet_tooltip("Enabled | Right-click for settings");
        } else if (!this._sensorAvailable) {
            this.set_applet_tooltip("No sensor detected");
        } else {
            this.set_applet_tooltip("Disabled | Right-click for settings");
        }
    }

    // Validate and clamp settings. Also apply changes to runtime state so
    // updating values in the UI takes effect immediately.
    _validate_settings() {
        try {
            this.min_brightness = Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, parseInt(this.min_brightness) || BRIGHTNESS.DEFAULT_MIN));
            this.max_brightness = Math.max(this.min_brightness + 1, Math.min(BRIGHTNESS.MAX, parseInt(this.max_brightness) || BRIGHTNESS.DEFAULT_MAX));
            this.smoothing_factor = Math.max(SMOOTHING.MIN, Math.min(SMOOTHING.MAX, parseFloat(this.smoothing_factor) || SMOOTHING.DEFAULT));
            this.max_lux = Math.max(LUX.MIN_MAX, parseInt(this.max_lux) || LUX.DEFAULT_MAX);
            this.min_lux = Math.max(LUX.MIN_MIN, Math.min(LUX.MAX_MIN, parseInt(this.min_lux) || LUX.DEFAULT_MIN));
            const minGap = Math.max(10, Math.round(this.max_lux * 0.05));
            if (this.min_lux >= this.max_lux - minGap) {
                this.min_lux = Math.max(0, this.max_lux - minGap);
                this.settings.setValue("min-lux", this.min_lux);
            }
            let interval = parseInt(this.poll_interval) || POLL_INTERVAL.DEFAULT;
            this.poll_interval = Math.max(POLL_INTERVAL.MIN, Math.min(POLL_INTERVAL.MAX, interval));

            // Apply configuration changes immediately to runtime state
            try {
                // If we have a buffered brightness, clamp it into the new bounds
                if (this._brightness !== null) {
                    const clamped = Math.max(this.min_brightness, Math.min(this.max_brightness, Math.round(this._brightness)));
                    if (clamped !== Math.round(this._brightness)) {
                        this._brightness = clamped;
                        if (Math.abs(clamped - this._previousBrightness) >= 1) {
                            this._apply_brightness(clamped);
                            this._previousBrightness = clamped;
                        }
                    }
                } else if (isFinite(this._lastLux) && this._lastLux >= 0) {
                    // If we have a recent lux reading (from earlier polls), recompute
                    // and apply a target brightness using the new settings.
                    const target = this._luxToBrightness(this._lastLux);
                    this._brightness = target;
                    if (Math.abs(target - this._previousBrightness) >= 1) {
                        this._apply_brightness(target);
                        this._previousBrightness = target;
                    }
                }
            } catch (e) {
                global.logError("[AB] Apply settings runtime failed: " + (e && e.message ? e.message : e));
            }

            // If the poll interval changed, reschedule the loop immediately
            try {
                if (this._lastPollInterval !== this.poll_interval) {
                    this._lastPollInterval = this.poll_interval;
                    this._schedule_next_loop();
                }
            } catch (e) {
                global.logError("[AB] Reschedule after settings change failed: " + (e && e.message ? e.message : e));
            }
        } catch (e) {
            global.logError("[AB] Validation: " + (e && e.message ? e.message : e));
        }
    }

    // Toggle applet enabled/disabled on click. When enabling, run an immediate
    // poll so the UI reflects adaptive behaviour without waiting for the next
    // scheduled timeout.
    on_applet_clicked() {
        try {
            this._enabled = !this._enabled;
            this.set_applet_label(this._enabled ? "🌤" : "🌙");
            this._update_tooltip();

            if (this._enabled) {
                if (!this._isRunning) {
                    try {
                        this._do_loop();
                    } catch (e) {
                        global.logError("[AB] Immediate loop on enable failed: " + (e && e.message ? e.message : e));
                        this._schedule_next_loop();
                    }
                } else {
                    // Ensure the scheduler matches the configured interval
                    this._schedule_next_loop();
                }
            }
        } catch (e) {
            global.logError("[AB] Click: " + (e && e.message ? e.message : e));
        }
    }

    // Read a numeric value from a sysfs path. Returns 0 on error. We log
    // failures at a low level to aid diagnosis of missing nodes.
    _readNumber(path) {
        try {
            const result = GLib.file_get_contents(path);
            if (!result || !result[0] || !result[1]) return 0;
            const num = parseFloat(result[1].toString().trim());
            return (isFinite(num) && num >= 0) ? num : 0;
        } catch (e) {
            global.log("[AB] _readNumber failed for " + path + ": " + (e && e.message ? e.message : e));
            return 0;
        }
    }

    // Convert lux reading to a brightness percentage using a logarithmic
    // mapping so changes at low light levels are more significant.
    _luxToBrightness(lux) {
        try {
            if (!isFinite(lux) || lux < 0 || !isFinite(this.max_lux) || this.max_lux <= 0) {
                return this.min_brightness;
            }
            if (lux <= this.min_lux) return this.min_brightness;
            if (lux >= this.max_lux)  return this.max_brightness;

            const numerator   = Math.log(lux - this.min_lux + 1);
            const denominator = Math.log(this.max_lux - this.min_lux + 1);
            const normalized  = Math.max(0, Math.min(1, numerator / denominator));
            const brightness  = Math.round(
                this.min_brightness + normalized * (this.max_brightness - this.min_brightness)
            );
            return Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, brightness));
        } catch (e) {
            global.logError("[AB] Lux mapping error: " + (e && e.message ? e.message : e));
            return this.min_brightness;
        }
    }

    // Ensure only a single scheduled poll exists. We clear any previous timeout
    // then create a new one at the configured interval.
    _schedule_next_loop() {
        try {
            if (this._loopId) {
                Mainloop.source_remove(this._loopId);
                this._loopId = null;
            }
            let interval = this.poll_interval || POLL_INTERVAL.DEFAULT;
            interval = Math.max(POLL_INTERVAL.MIN, Math.min(POLL_INTERVAL.MAX, interval));
            const self = this;
            this._loopId = Mainloop.timeout_add(interval, function() {
                self._loopId = null;
                self._do_loop();
                return false;
            });
        } catch (e) {
            global.logError("[AB] Schedule: " + (e && e.message ? e.message : e));
            if (this._loopId) Mainloop.source_remove(this._loopId);
            const self = this;
            this._loopId = Mainloop.timeout_add(POLL_INTERVAL.DEFAULT, function() {
                self._loopId = null;
                self._schedule_next_loop();
                return false;
            });
        }
    }

    // Main polling loop: read sensor, compute smoothed brightness and apply
    // if it differs sufficiently from the previous applied value.
    _do_loop() {
        if (this._isRunning) {
            this._schedule_next_loop();
            return;
        }
        this._isRunning = true;

        try {
            if (!this._enabled || !this._sensorAvailable || !this._sensorPath) {
                this._schedule_next_loop();
                return;
            }

            // Read sensor values safely
            let lux;
            if (this._sensorPath.input) {
                lux = this._readNumber(this._sensorPath.input);
            } else {
                const raw    = this._readNumber(this._sensorPath.raw);
                const scale  = this._readNumber(this._sensorPath.scale);
                const offset = this._sensorPath.offset ? this._readNumber(this._sensorPath.offset) : 0;
                lux = (raw + offset) * scale;
            }

            if (!isFinite(lux) || lux < 0) {
                this._schedule_next_loop();
                return;
            }

            let targetBrightness = this._luxToBrightness(lux);

            // Collect calibration samples
            if (this._calPhase === CAL_PHASE.DARK && isFinite(lux)) {
                this._calDarkSamples.push(lux);
            } else if (this._calPhase === CAL_PHASE.BRIGHT && lux > this._calBrightMax) {
                this._calBrightMax = lux;
            }

            // Exponential smoothing: blends previous value with the new target
            if (this._brightness === null) {
                this._brightness = targetBrightness;
            } else {
                const factor = Math.max(SMOOTHING.MIN, Math.min(SMOOTHING.MAX, this.smoothing_factor));
                this._brightness = this._brightness + (targetBrightness - this._brightness) * factor;
            }

            const finalBrightness = Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, Math.round(this._brightness)));

            // Apply only when there's a meaningful change to reduce external calls
            if (Math.abs(finalBrightness - this._previousBrightness) >= 1) {
                this._apply_brightness(finalBrightness);
                this._previousBrightness = finalBrightness;
            }

            this.set_applet_tooltip(`Light: ${lux.toFixed(0)}lux | Brightness: ${finalBrightness}%`);
            this._lastLux = lux;
            this._errorCount = 0;

        } catch (e) {
            this._errorCount++;
            if (this._errorCount > 5) {
                global.logError("[AB] Too many errors, auto-disabling");
                this._enabled = false;
                this._update_tooltip();
            } else if (e && e.message !== this._lastError) {
                global.logError("[AB] Loop: " + (e && e.message ? e.message : e));
                this._lastError = e && e.message ? e.message : e;
            }
        } finally {
            this._isRunning = false;
            this._schedule_next_loop();
        }
    }

    // Apply brightness using brightnessctl with sudo (non-interactive NOPASSWD).
    // Most systems require root to modify device backlight files.
    _apply_brightness(brightness) {
        try {
            brightness = Math.max(BRIGHTNESS.MIN, Math.min(BRIGHTNESS.MAX, brightness));
            
            // Use sudo -n (non-interactive) which respects sudoers NOPASSWD entries
            const cmd = 'sudo -n /usr/bin/brightnessctl set ' + brightness + '%';
            global.log('[AB] Executing: ' + cmd);
            GLib.spawn_command_line_async(cmd);
        } catch (e) {
            global.logError("[AB] _apply_brightness failed: " + (e && e.message ? e.message : e));
        }
    }

    // Cleanup resources when the applet is removed
    on_applet_removed_from_panel() {
        try {
            if (this._loopId) {
                Mainloop.source_remove(this._loopId);
                this._loopId = null;
            }
            if (this._calTimerId) {
                Mainloop.source_remove(this._calTimerId);
                this._calTimerId = null;
            }
            if (this._calCountdownId) {
                Mainloop.source_remove(this._calCountdownId);
                this._calCountdownId = null;
            }
            if (this.settings) {
                this.settings.finalize();
            }
        } catch (e) {
            global.logError("[AB] Cleanup: " + (e && e.message ? e.message : e));
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new AdaptiveBrightnessApplet(metadata, orientation, panelHeight, instanceId);
}
