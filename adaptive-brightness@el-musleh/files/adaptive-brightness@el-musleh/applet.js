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

// Candidate sysfs locations for ambient light sensors. We try each
// path and pick the first that exposes both 'raw' and 'scale'.
const ALS_PATHS = [
    { raw: "/sys/bus/iio/devices/iio:device0/in_illuminance_raw", scale: "/sys/bus/iio/devices/iio:device0/in_illuminance_scale" },
    { raw: "/sys/bus/iio/devices/iio:device1/in_illuminance_raw", scale: "/sys/bus/iio/devices/iio:device1/in_illuminance_scale" },
    { raw: "/sys/class/sensors/light/in_illuminance_raw", scale: "/sys/class/sensors/light/in_illuminance_scale" }
];

// Constraints and defaults
const POLL_INTERVAL = { MIN: 100, DEFAULT: 1000, MAX: 60000 };
const BRIGHTNESS = { MIN: 1, MAX: 100, DEFAULT_MIN: 10, DEFAULT_MAX: 100 };
const SMOOTHING = { MIN: 0, MAX: 1, DEFAULT: 0.2 };
const LUX = { DEFAULT_MAX: 10000, MIN_MAX: 100 };

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

            // Settings with safe defaults
            this.min_brightness = BRIGHTNESS.DEFAULT_MIN;
            this.max_brightness = BRIGHTNESS.DEFAULT_MAX;
            this.smoothing_factor = SMOOTHING.DEFAULT;
            this.max_lux = LUX.DEFAULT_MAX;
            this.poll_interval = POLL_INTERVAL.DEFAULT;

            // Bind settings to local fields and validate on change
            try {
                this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
                const validator = this._validate_settings.bind(this);
                this.settings.bind("min-brightness", "min_brightness", validator);
                this.settings.bind("max-brightness", "max_brightness", validator);
                this.settings.bind("smoothing-factor", "smoothing_factor", validator);
                this.settings.bind("max-lux", "max_lux", validator);
                this.settings.bind("poll-interval", "poll_interval", validator);

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

    // Try to find a sysfs sensor path from ALS_PATHS; mark the applet disabled
    // if no usable sensor exists. We log failures rather than silently ignoring
    // them so maintainers can diagnose hardware differences.
    _locate_sensor() {
        for (const path of ALS_PATHS) {
            try {
                const raw = Gio.file_new_for_path(path.raw);
                const scale = Gio.file_new_for_path(path.scale);

                if (raw.query_exists(null) && scale.query_exists(null)) {
                    this._sensorPath = path;
                    this._sensorAvailable = true;
                    global.log("[AB] Found sensor at: " + path.raw);
                    return;
                }
            } catch (e) {
                global.log("[AB] _locate_sensor check failed for " + path.raw + ": " + (e && e.message ? e.message : e));
            }
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
            const normalized = Math.log(lux + 1) / Math.log(this.max_lux + 1);
            const clamped = Math.max(0, Math.min(1, normalized));
            const brightness = Math.round(this.min_brightness + clamped * (this.max_brightness - this.min_brightness));
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
            this._loopId = Mainloop.timeout_add(interval, () => {
                this._loopId = null;
                this._do_loop();
                return false;
            });
        } catch (e) {
            global.logError("[AB] Schedule: " + (e && e.message ? e.message : e));
            if (this._loopId) Mainloop.source_remove(this._loopId);
            this._loopId = Mainloop.timeout_add(POLL_INTERVAL.DEFAULT, () => {
                this._loopId = null;
                this._schedule_next_loop();
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
            const raw = this._readNumber(this._sensorPath.raw);
            const scale = this._readNumber(this._sensorPath.scale);
            const lux = raw * scale;

            if (!isFinite(lux) || lux < 0) {
                this._schedule_next_loop();
                return;
            }

            let targetBrightness = this._luxToBrightness(lux);

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
