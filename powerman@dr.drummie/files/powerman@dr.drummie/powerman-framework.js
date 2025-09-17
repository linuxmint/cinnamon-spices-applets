// PowerMan - Enhanced Extension Framework - powerman@dr.drummie
// Refactored and Streamlined, Organized by functionality with reduced complexity

// Usual suspects
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const UPowerGlib = imports.gi.UPowerGlib;
const St = imports.gi.St;
const Meta = imports.gi.Meta;

// For translations
const Gettext = imports.gettext;

// Configuration constants
const UUID = "powerman@dr.drummie";
const LOCALE_DIR = GLib.get_home_dir() + "/.local/share/locale";

// Set up translations
Gettext.bindtextdomain(UUID, LOCALE_DIR);
function _(str) {
    let translated = Gettext.dgettext(UUID, str);
    return translated || str;
}

// Power profile constants for localization
const POWER_PROFILES = {
    "power-saver": _("Power Saver"),
    balanced: _("Balanced"),
    performance: _("Performance"),
};

// UPower enums for easier access
const { DeviceKind: UPDeviceKind, DeviceState: UPDeviceState, DeviceLevel: UPDeviceLevel } = UPowerGlib;

/**
 * Main Extension Framework
 * Defines managers, hooks, and settings with interactions
 */
function PowerAppletExtensionFramework(originalApplet) {
    this._init(originalApplet);
}

PowerAppletExtensionFramework.prototype = {
    _init: function (originalApplet) {
        this._originalApplet = originalApplet;
        this._managers = new Map();
        this._settings = new Map(); // Central settings cache
        this._hooks = new Map();

        this._initializeHooks();
        this._initializeSettings();
    },

    /**
     * Initialize hook system - simplified with essential hooks only
     */
    _initializeHooks: function () {
        this._hooks.set("device-scan-pre", []);
        this._hooks.set("device-scan-post", []);
        this._hooks.set("power-source-changed", []); // AC/Battery change
        this._hooks.set("battery-level-changed", []); // Battery percentage change
        this._hooks.set("battery-saver-trigger", []); // Battery saver activation needed
        this._hooks.set("setting-changed", []); // Any setting change
        this._hooks.set("brightness-changed", []); // Brightness change
        this._hooks.set("automation-action", []); // Automation performed
        this._hooks.set("idle-state-changed", []); // Idle state change
    },

    /**
     * Initialize settings with bidirectional binding
     */
    _initializeSettings: function () {
        if (!this._originalApplet.settings) return;

        // Bind all automation settings with IN direction for code modifications
        const automationSettings = [
            "enable-brightness-auto",
            "ac-brightness",
            "battery-brightness",
            "idle-dim-ac",
            "idle-dim-battery",
            "idle-dim-time",
            "idle-brightness",
            "enable-profile-auto",
            "ac-power-profile",
            "battery-power-profile",
            "enable-battery-saver",
            "battery-low-threshold",
            "show-notifications",
            "debug-logging",
            "replace-system-tray-icon",
            "hide-applet-icon",
            "prefer-battery-ac-detection",
            "original-power-applets",
        ];

        for (let key of automationSettings) {
            try {
                // Cache current value
                this._settings.set(key, this._originalApplet.settings.getValue(key));

                // Bind with IN direction for programmatic changes
                this._originalApplet.settings.bind(
                    key,
                    key,
                    () => {
                        let newValue = this._originalApplet.settings.getValue(key);
                        let oldValue = this._settings.get(key);
                        // Deep comparison to handle arrays/objects correctly
                        let newValueStr = JSON.stringify(newValue);
                        let oldValueStr = JSON.stringify(oldValue);
                        if (newValueStr !== oldValueStr) {
                            this._settings.set(key, newValue);
                            this.triggerHook("setting-changed", key, newValue, oldValue);
                        }
                    },
                    Gio.SettingsBindFlags.GET
                );
            } catch (e) {
                this._log(`Error binding setting ${key}: ${e.message}`);
            }
        }
    },

    /**
     * Register a manager with the framework
     */
    registerManager: function (name, managerClass) {
        try {
            let manager = new managerClass(this._originalApplet, this);
            this._managers.set(name, manager);

            if (manager.initialize) {
                manager.initialize();
            }

            this._log(`Manager '${name}' registered successfully`);
            return true;
        } catch (e) {
            global.logError(`Failed to register manager '${name}': ${e.message}`);
            return false;
        }
    },

    /**
     * Add hook callback
     */
    addHook: function (hookName, callback) {
        if (!this._hooks.has(hookName)) {
            this._hooks.set(hookName, []);
        }
        this._hooks.get(hookName).push(callback);
    },

    /**
     * Format hook arguments for debug logging
     * @param {Array} args - Hook arguments array
     * @returns {string} Formatted argument list
     */
    _formatHookArguments: function (args) {
        return args
            .map((arg) => {
                try {
                    if (arg === null) return "null";
                    if (arg === undefined) return "undefined";
                    if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") return arg;
                    if (Array.isArray(arg)) return `Array(${arg.length})`;
                    if (typeof arg === "object") return arg.constructor.name;
                    return typeof arg;
                } catch (e) {
                    return "unknown";
                }
            })
            .join(", ");
    },

    /**
     * Trigger hook with error handling
     * @param {string} hookName - Name of the hook to trigger
     * @param {...any} args - Arguments to pass to hook callbacks
     */
    triggerHook: function (hookName, ...args) {
        if (this._hooks.has(hookName)) {
            this._debugLog(
                `Triggering hook: ${hookName} with ${args.length} arguments: [${this._formatHookArguments(args)}]`
            );
            for (let callback of this._hooks.get(hookName)) {
                try {
                    callback.apply(null, args);
                } catch (e) {
                    this._log(`Hook '${hookName}' error: ${e.message}`);
                }
            }
        }
    },

    /**
     * Get setting value
     */
    getSetting: function (key) {
        return this._settings.get(key);
    },

    /**
     * Set setting value programmatically
     */
    setSetting: function (key, value) {
        if (this._originalApplet.settings) {
            this._originalApplet.settings.setValue(key, value);
        }
    },

    /**
     * Get manager by name
     */
    getManager: function (name) {
        return this._managers.get(name);
    },

    /**
     * Patch original applet with minimal hooks
     */
    patchOriginalApplet: function () {
        let originalDevicesChanged = this._originalApplet._devicesChanged;

        this._originalApplet._devicesChanged = Lang.bind(this._originalApplet, function () {
            // Trigger pre-scan hook before calling original
            this._extensionFramework.triggerHook("device-scan-pre");

            // Call original _devicesChanged
            originalDevicesChanged.apply(this._originalApplet, arguments);

            // Trigger post-scan hook after original completes (devices populated)
            this._extensionFramework.triggerHook("device-scan-post", this._originalApplet._devices);
        });

        this._originalApplet._extensionFramework = this;
        this._log("Original applet patched successfully");
    },

    // Logging functions
    _log: function (message) {
        if (this._originalApplet && this._originalApplet._log) {
            this._originalApplet._log(`[Framework] ${message}`);
        } else {
            global.log(`[PowerFramework] ${message}`);
        }
    },

    _debugLog: function (message) {
        if (this._originalApplet && this._originalApplet._debugLog) {
            this._originalApplet._debugLog(`[Framework] ${message}`);
        } else if (this.getSetting("debug-logging")) {
            this._log(`[DEBUG] ${message}`);
        }
    },

    /**
     * Cleanup
     */
    destroy: function () {
        for (let [name, manager] of this._managers) {
            if (manager.destroy) {
                try {
                    manager.destroy();
                    this._log(`Manager '${name}' destroyed`);
                } catch (e) {
                    this._log(`Error destroying manager '${name}': ${e.message}`);
                }
            }
        }
        this._managers.clear();
        this._hooks.clear();
        this._settings.clear();
        this._log("Extension framework destroyed");
    },
};

/**
 * Base Manager Class - Simplified with essential functionality, extended by concrete managers
 */
class BaseManager {
    constructor(applet, framework) {
        this._applet = applet;
        this._framework = framework;
        this._name = this.constructor.name;
    }

    // Override in concrete managers
    initialize() {}
    destroy() {}

    // Helper methods
    addHook(hookName, callback) {
        this._framework.addHook(hookName, Lang.bind(this, callback));
    }

    getSetting(key) {
        return this._framework.getSetting(key);
    }

    setSetting(key, value) {
        this._framework.setSetting(key, value);
    }

    log(message) {
        this._framework._log(`[${this._name}] ${message}`);
    }

    debug(message) {
        this._framework._debugLog(`[${this._name}] ${message}`);
    }

    /**
     * Trigger an automation action
     * @param {string} description
     * @param {function} action
     * @returns {boolean}
     */
    triggerAutomationAction(description, action) {
        try {
            this.debug(`Executing: ${description}`);
            let result = action();
            this._framework.triggerHook("automation-action", description, result, this._name);
            return result;
        } catch (e) {
            this.log(`Action failed: ${description} - ${e.message}`);
            return false;
        }
    }

    /**
     * Show a notification if enabled in settings
     * @param {string} title
     * @param {string} message
     * @param {string} [iconPath] - Optional icon path or name
     */
    notify(title, message, iconPath = null) {
        if (this.getSetting("show-notifications")) {
            try {
                if (iconPath) {
                    let icon = new St.Icon({
                        icon_name: iconPath,
                        icon_type: St.IconType.FULLCOLOR,
                        icon_size: 24,
                    });
                    Main.warningNotify(title, message, icon);
                } else {
                    Main.notify(title, message);
                }
                this.debug(`Notification: ${title} - ${message}${iconPath ? ` (icon: ${iconPath})` : ""}`);
            } catch (e) {
                this.log(`Notification failed: ${e.message}`);
            }
        }
    }
}

/**
 * IDLE MANAGER - Dedicated idle/active state detection because dimming has some issues in Cinnamon
 * Uses Mutter IdleMonitor directly for more reliable idle detection
 * Postpones brightness changes until user is active again,
 * so we can avoid dimming issues when setting brightness while system is idle
 * Unfortunately it still requires some user activity to re-enable dimming after idle when previous state had dimming turned off
 *
 * Mutter idle setup needs cyclic idle/active watches to function properly
 * Needs to re-apply new dimming timeout to dconf settings after idle ends to avoid dimming issues,
 * then restarts idle monitoring with new timeout if changed in settings
 */
class IdleManager extends BaseManager {
    initialize() {
        this._isIdle = false;
        this._idleMonitor = null;
        this._idleWatchId = null;
        this._activeWatchId = null;
        this._dconfSettings = null;

        // Initialize dconf settings for dimming control with default values from settings
        this._initializeDconfSettings();
        this._updateDimmingSettings();

        // Setup idle monitoring
        this._setupIdleMonitoring();

        // Listen for setting changes that affect idle monitoring
        this.addHook("setting-changed", this._onSettingChanged);
        this.log("Idle Manager initialized");
    }

    /**
     * Setup idle monitoring using Mutter IdleMonitor directly
     * @private
     */
    _setupIdleMonitoring() {
        try {
            // Ensure Meta.IdleMonitor is available
            if (!Meta || !Meta.IdleMonitor) throw new Error("Meta.IdleMonitor not available");

            this._idleMonitor = Meta.IdleMonitor.get_core();
            let timeoutMs = (this.getSetting("idle-dim-time") || 30) * 1000;
            this._isIdle = false;

            // Setup first idle watch
            this._installIdleWatch(timeoutMs);
            this.debug(`Idle monitoring setup: timeout=${timeoutMs / 1000}s`);
            return true;
        } catch (e) {
            this.debug(`Idle monitoring setup failed: ${e.message}`);
            return false;
        }
    }

    /**
     * Install idle watch to detect when user becomes idle
     * @param {number} timeout - Idle timeout in milliseconds
     */
    _installIdleWatch(timeout) {
        // Remove previous if exists
        if (this._idleWatchId) {
            this._idleMonitor.remove_watch(this._idleWatchId);
            this._idleWatchId = null;
        }

        // Install idle watch
        this._idleWatchId = this._idleMonitor.add_idle_watch(timeout, () => {
            this.debug(`User idle detected after ${timeout / 1000}s`);

            this._isIdle = true;
            this._onIdleChanged(true);

            // After idle detected, install active watch
            this._installActiveWatch();
        });
    }

    /**
     * Install user activity watch to detect when user becomes active again
     */
    _installActiveWatch() {
        if (this._activeWatchId) {
            this._idleMonitor.remove_watch(this._activeWatchId);

            this._activeWatchId = null;
        }

        // Install active watch after activity detected
        this._activeWatchId = this._idleMonitor.add_user_active_watch(() => {
            if (this._isIdle) {
                this.debug("User activity detected");

                this._isIdle = false;
                this._onIdleChanged(false);

                // === DIMMING ISSUES FIX ===
                // 1 - Update dconf idle-dim-time for system to restore settings default values because of dimming system issues
                // 2 - And then restore applet's dimming settings
                // DOES NOT HELP WITH DIMMING ISSUES, BUT AVOIDS BUGGY DIMMING TIMEOUTS
                this._refreshDconfSettings();

                // Reinstall idle-watch after activity with default applet timeout
                let timeoutMs = (this.getSetting("idle-dim-time") || 30) * 1000;
                this._installIdleWatch(timeoutMs);
                this.debug(`Reinstalled idle watch after activity, idle watch timeout ${timeoutMs / 1000}s`);
            }
        });

        if (this._activeWatchId === 0) this.debug("Failed to add user active watch");
        else this.debug(`User active watch added with ID: ${this._activeWatchId}`);
    }

    /**
     * Handle idle state changes and trigger hook for other managers
     * @param {boolean} isIdle - True if system went idle, false if became active
     */
    _onIdleChanged(isIdle) {
        if (isIdle) {
            this.debug("System went idle");
        } else {
            this.debug("System resumed from idle");
        }

        // Trigger hook for other managers to respond to idle state changes
        this._framework.triggerHook("idle-state-changed", isIdle);
    }

    /**
     * Handle setting changes that affect idle monitoring
     * @param {string} key - Setting key that changed
     * @param {*} newValue - New setting value
     * @param {*} oldValue - Previous setting value
     */
    _onSettingChanged(key, newValue, oldValue) {
        if (key.includes("idle-dim") || key.includes("idle-brightness")) {
            this.debug(`Dimming setting changed: ${key} from ${oldValue} to ${newValue}`);

            // Update dimming settings in dconf
            this._updateDimmingSettings();
        }
    }

    /**
     * Initialize dconf settings for dimming control
     */
    _initializeDconfSettings() {
        try {
            this._dconfSettings = new Gio.Settings({ schema_id: "org.cinnamon.settings-daemon.plugins.power" });
        } catch (e) {
            this.debug(`Could not initialize dconf settings: ${e.message}`);
        }
    }

    /**
     * Update dconf dimming settings
     */
    _updateDimmingSettings() {
        if (!this._dconfSettings) return;

        try {
            this._dconfSettings.set_boolean("idle-dim-ac", this.getSetting("idle-dim-ac") || false);
            this._dconfSettings.set_boolean("idle-dim-battery", this.getSetting("idle-dim-battery") || false);
            this._dconfSettings.set_int("idle-dim-time", this.getSetting("idle-dim-time") || 30);
            this._dconfSettings.set_int("idle-brightness", this.getSetting("idle-brightness") || 15);

            this.debug("Updated dconf dimming settings");
        } catch (e) {
            this.log(`Error updating dimming settings: ${e.message}`);
        }
    }

    /**
     * Force refresh of dconf settings to avoid dimming issues
     */
    _refreshDconfSettings() {
        if (this._dconfSettings) {
            // Change idle dim time value for system to register change
            this._dconfSettings.set_int("idle-dim-time", (this.getSetting("idle-dim-time") || 30) + 5);
            this.debug("Updated dconf settings for idle dim time");
        }

        // Trigger a dummy setting change to force refresh
        this._updateDimmingSettings();
    }

    /**
     * Get current idle state
     * @returns {boolean} True if system is currently idle
     */
    isIdle() {
        return this._isIdle;
    }

    /**
     * Get current idle timeout setting in seconds
     * @returns {number} Idle timeout in seconds
     */
    getIdleTimeout() {
        return this.getSetting("idle-dim-time") || 30;
    }

    /**
     * Force idle state change (for testing or manual control)
     * @param {boolean} idle - True to set idle, false to set active
     */
    setIdleState(idle) {
        if (this._isIdle !== idle) {
            this._isIdle = idle;
            this._onIdleChanged(idle);
            this.debug(`Manually set idle state to: ${idle}`);
        }
    }

    /**
     * Cleanup idle monitoring
     */
    destroy() {
        if (this._idleMonitor) {
            if (this._idleWatchId) {
                this._idleMonitor.remove_watch(this._idleWatchId);
                this.debug("Removed idle watch");
            }

            if (this._activeWatchId) {
                this._idleMonitor.remove_watch(this._activeWatchId);
                this.debug("Removed active watch");
            }

            this._idleMonitor = null;
        }

        super.destroy();
    }
}

/**
 * BATTERY MANAGER - All battery and power source related functionality
 */
class BatteryManager extends BaseManager {
    initialize() {
        this._lastPowerState = null; // AC/Battery state
        this._batteryStates = new Map(); // Device state tracking
        this._batteryModels = new Map(); // Battery models by deviceId
        this._vendorWorkarounds = this._detectVendorWorkarounds();

        this.addHook("device-scan-post", this._onDeviceUpdate);
        this.log("Battery Manager initialized");
    }

    /**
     * Detect vendor-specific workarounds
     */
    _detectVendorWorkarounds() {
        let workarounds = { ignoreLinePower: false, vendor: "unknown" };

        try {
            let dmiFile = Gio.File.new_for_path("/sys/devices/virtual/dmi/id/sys_vendor");
            if (dmiFile.query_exists(null)) {
                let [success, contents] = dmiFile.load_contents(null);
                if (success) {
                    let vendor = contents.toString().trim().toLowerCase();
                    workarounds.vendor = vendor;

                    // Vendor-specific workarounds and user preference for battery-based AC detection
                    if (this.getSetting("prefer-battery-ac-detection")) {
                        workarounds.ignoreLinePower = true;
                        this.debug("Applied battery-based AC detection workarounds");
                    }
                }
            }
        } catch (e) {
            this.debug(`Vendor detection failed: ${e.message}`);
        }

        return workarounds;
    }

    /**
     * Handle device updates - use existing device data from applet
     */
    _onDeviceUpdate(devices) {
        // Use devices from the applet's _devicesChanged scan instead of making new request
        this._processExistingDeviceData();
    }

    /**
     * Process device data that's already been scanned by the applet
     */
    _processExistingDeviceData() {
        if (!this._applet._proxy) return;

        // Get fresh device data using the same method as _devicesChanged
        this._applet._proxy.GetDevicesRemote(
            Lang.bind(this, function (result, error) {
                if (error) {
                    this.debug(`Error getting devices for power state: ${error.message}`);
                    return;
                }

                let devices = result[0];
                let batteryDevices = [];
                let linePowerDevices = [];
                let hasBatteries = false;

                this.debug(`Processing ${devices.length} devices for power state detection`);

                // Process all raw devices
                for (let device of devices) {
                    let [deviceId, vendor, model, deviceKind, icon, percentage, state, batteryLevel, seconds] = device;

                    if (deviceKind === UPDeviceKind.BATTERY && state !== UPDeviceState.UNKNOWN) {
                        batteryDevices.push({ deviceId, percentage, state, vendor, model });
                        hasBatteries = true;
                        // Store battery model for later retrieval
                        this._batteryModels.set(deviceId, { vendor, model });
                        this._trackBatteryState(deviceId, percentage, state, batteryLevel);
                        this.debug(`Battery device: ${deviceId}, ${Math.round(percentage)}%, state: ${state}`);
                    } else if (deviceKind === UPDeviceKind.LINE_POWER) {
                        // For LINE_POWER, online status is usually derived from percentage or state
                        let online = percentage > 0 || state !== UPDeviceState.UNKNOWN;
                        linePowerDevices.push({ deviceId, online, state, percentage });
                        this.debug(
                            `LINE_POWER device: ${deviceId}, online: ${online}, percentage: ${percentage}, state: ${state}`
                        );
                    }
                }

                // Determine AC state using hybrid approach
                let acState = this._determineACState(batteryDevices, linePowerDevices, hasBatteries);
                this._checkPowerStateChange(acState);
            })
        );
    }

    /**
     * Hybrid AC detection - battery state primary, LINE_POWER fallback
     */
    _determineACState(batteryDevices, linePowerDevices, hasBatteries) {
        this.debug(
            `Determining AC state: ${batteryDevices.length} batteries, ${linePowerDevices.length} line power devices`
        );

        // Desktop/VM fallback - no batteries means constant AC (moved to top)
        if (!hasBatteries) {
            this.debug("No batteries detected - assuming desktop/VM with AC");
            return true;
        }

        // Battery state / AC detection
        if (hasBatteries && batteryDevices.length > 0) {
            let chargingCount = 0;
            let dischargingCount = 0;
            let fullCount = 0;

            for (let battery of batteryDevices) {
                this.debug(
                    `Battery ${battery.deviceId}: state=${battery.state} (${this._getStateString(battery.state)})`
                );

                if (battery.state === UPDeviceState.CHARGING) {
                    chargingCount++;
                } else if (battery.state === UPDeviceState.FULLY_CHARGED) {
                    fullCount++;
                } else if (battery.state === UPDeviceState.DISCHARGING) {
                    dischargingCount++;
                }
            }

            this.debug(
                `Battery analysis: charging=${chargingCount}, full=${fullCount}, discharging=${dischargingCount}`
            );

            // If any battery is charging, AC is connected
            if (chargingCount > 0) {
                this.debug(`AC detected via battery state: ${chargingCount} charging`);
                return true;
            }
            // If all batteries are discharging, AC is disconnected
            else if (dischargingCount > 0 && chargingCount + fullCount === 0) {
                this.debug(`Battery mode detected via battery state: ${dischargingCount} discharging`);
                return false;
            }
            // If batteries are full but not charging, could be AC connected but full
            else if (fullCount > 0 && dischargingCount === 0) {
                this.debug(`Batteries full - checking LINE_POWER for confirmation`);
                // Fall through to LINE_POWER check
            }
        }

        // LINE_POWER detection (if no clear battery indication)
        if (!this._vendorWorkarounds.ignoreLinePower && linePowerDevices.length > 0) {
            for (let linePower of linePowerDevices) {
                this.debug(`LINE_POWER analysis: ${linePower.deviceId}, online=${linePower.online}`);
                if (linePower.online) {
                    this.debug("AC detected via LINE_POWER");
                    return true;
                }
            }
            this.debug("Battery mode detected via LINE_POWER");
            return false;
        }

        // Fallback to previous state or assume AC
        this.debug("Could not determine AC state - using fallback");
        return this._lastPowerState !== null ? this._lastPowerState : true;
    }

    /**
     * Get human-readable state string for debugging
     */
    _getStateString(state) {
        switch (state) {
            case UPDeviceState.CHARGING:
                return "CHARGING";
            case UPDeviceState.DISCHARGING:
                return "DISCHARGING";
            case UPDeviceState.FULLY_CHARGED:
                return "FULLY_CHARGED";
            case UPDeviceState.EMPTY:
                return "EMPTY";
            case UPDeviceState.UNKNOWN:
                return "UNKNOWN";
            default:
                return `STATE_${state}`;
        }
    }

    /**
     * Track individual battery state changes
     */
    _trackBatteryState(deviceId, percentage, state, batteryLevel) {
        let lastState = this._batteryStates.get(deviceId);
        let currentState = { percentage: Math.round(percentage), state, batteryLevel };

        //this.debug(`Tracking battery ${deviceId}: ${currentState.percentage}%, state: ${this._getStateString(state)}`);

        // Only trigger changes if we have a previous state to compare
        if (lastState) {
            // Check for state changes (charging/discharging)
            if (lastState.state !== currentState.state) {
                this.debug(
                    `Battery ${deviceId} state changed: ${this._getStateString(
                        lastState.state
                    )} -> ${this._getStateString(currentState.state)}`
                );
            }

            // Check for low battery conditions
            this._checkBatteryThresholds(deviceId, currentState, lastState);

            // Trigger battery level change if significant change
            if (Math.abs(lastState.percentage - currentState.percentage) >= 5) {
                this._framework.triggerHook(
                    "battery-level-changed",
                    deviceId,
                    currentState.percentage,
                    lastState.percentage
                );
            }
        }

        this._batteryStates.set(deviceId, currentState);
    }

    /**
     * Check for power state changes and trigger automation
     */
    _checkPowerStateChange(currentAcState) {
        if (this._lastPowerState !== currentAcState) {
            this.debug(`Power state changed: ${this._lastPowerState} -> ${currentAcState}`);

            // Log the power source change
            if (currentAcState) {
                this.log("Switched to AC power");
            } else {
                this.log("Switched to battery power");
            }

            // FIX: Pass the actual previous state instead of !currentAcState
            // wasBattery should be true if previous state was battery (AC=false)
            let wasBattery = this._lastPowerState === false; // true if previous was battery
            this._lastPowerState = currentAcState;
            this._framework.triggerHook("power-source-changed", currentAcState, wasBattery);
        } else {
            this.debug(`Power state unchanged: ${currentAcState ? "AC" : "Battery"}`);
        }
    }

    /**
     * Check battery thresholds and handle low battery situations
     */
    _checkBatteryThresholds(deviceId, current, last) {
        const thresholds = [
            { level: 10, name: "critical" },
            { level: 5, name: "critical" },
            { level: 15, name: "low" },
            { level: this.getSetting("battery-low-threshold") || 20, name: "user-defined" },
        ];

        // Get battery model for enhanced notifications
        let batteryInfo = this._batteryModels.get(deviceId);
        let modelText = batteryInfo ? `${batteryInfo.vendor} ${batteryInfo.model}` : deviceId;

        for (let threshold of thresholds) {
            if (current.percentage <= threshold.level && last.percentage > threshold.level) {
                this.debug(`Battery ${deviceId} crossed ${threshold.name} threshold: ${current.percentage}%`);

                if (threshold.name === "critical") {
                    this.notify(
                        _("Critical Battery"),
                        _("Battery %s critically low").format(modelText) + ` (${current.percentage}%)`,
                        "battery-caution-symbolic"
                    );
                } else if (threshold.name === "low") {
                    this.notify(
                        _("Low Battery"),
                        _("Battery %s low").format(modelText) + ` (${current.percentage}%)`,
                        "battery-low-symbolic"
                    );
                } else if (threshold.name === "user-defined") {
                    // Trigger battery saver hook for any interested managers
                    this._framework.triggerHook("battery-saver-trigger", deviceId, current.percentage, threshold.level);
                }
            }
        }
    }

    getCurrentPowerState() {
        return this._lastPowerState;
    }

    getCurrentBatteryLevel() {
        if (!this._applet._primaryDevice) return null;
        try {
            let [, , , , , percentage, , ,] = this._applet._primaryDevice;
            return Math.round(percentage);
        } catch (e) {
            return null;
        }
    }

    getVendorInfo() {
        return this._vendorWorkarounds.vendor;
    }
}

/**
 * BRIGHTNESS MANAGER - All brightness functionality
 */
class BrightnessManager extends BaseManager {
    initialize() {
        this._lastScreenBrightness = null;
        this._lastKeyboardBrightness = null;
        this._pendingBrightness = null; // Store brightness to apply after idle ends
        this._isIdle = false; // Track idle state from IdleManager

        // Listen to hooks from other managers
        this.addHook("power-source-changed", this._onPowerSourceChanged);
        this.addHook("setting-changed", this._onSettingChanged);
        //this.addHook("brightness-changed", this._onBrightnessChanged);

        // IMPORTANT: Listen to idle state changes from IdleManager
        this.addHook("idle-state-changed", this._onIdleChanged);

        this.log("Brightness Manager initialized");
    }

    /**
     * Handle power source changes for brightness and dimming automation
     */
    _onPowerSourceChanged(isAC, wasBattery) {
        if (!this.getSetting("enable-brightness-auto")) return;

        // Check dimming settings for old and new power sources
        let oldDimEnabled = wasBattery ? this.getSetting("idle-dim-battery") : this.getSetting("idle-dim-ac");
        let newDimEnabled = isAC ? this.getSetting("idle-dim-ac") : this.getSetting("idle-dim-battery");

        this.debug(
            `Power source changed: ${
                isAC ? "AC" : "Battery"
            }, dimming on power source: before ${oldDimEnabled} -> now ${newDimEnabled}, idle: ${this._isIdle}`
        );

        // Determine target brightness based on power source
        let targetBrightness = isAC ? this.getSetting("ac-brightness") : this.getSetting("battery-brightness");

        // Postpone brightness change if idle and dimming was previously enabled
        if (this._isIdle && oldDimEnabled) {
            // If idle, defer brightness change until user becomes active
            this._pendingBrightness = targetBrightness;
            this.debug(`Brightness change deferred to ${targetBrightness}% (idle active)`);
        } else {
            // Apply immediately if not idle
            this.triggerAutomationAction(_("brightness %d%%").format(targetBrightness), () =>
                this.setBrightness(targetBrightness)
            );
        }
    }

    /**
     * Apply pending brightness change and clear automation flags
     * @private
     */
    _applyPendingBrightness() {
        if (this._pendingBrightness !== null) {
            this.triggerAutomationAction(_("brightness %d%%").format(this._pendingBrightness), () =>
                this.setBrightness(this._pendingBrightness)
            );
            this._pendingBrightness = null;
            return true;
        }
        return false;
    }

    /**
     * Handle idle state changes from IdleManager
     * @param {boolean} isIdle - True if system went idle, false if became active
     */
    _onIdleChanged(isIdle) {
        this._isIdle = isIdle;

        if (isIdle) {
            this.debug("System went idle - brightness automation paused");
        } else {
            this.debug("System resumed from idle - checking for pending brightness changes");
            // Apply any pending brightness change after resuming from idle
            this._applyPendingBrightness();
        }
    }

    /**
     * Handle dimming-related setting changes
     */
    _onSettingChanged(key, newValue, oldValue) {
        if (key.includes("idle-dim") || key.includes("idle-brightness")) {
            this.debug(`Dimming setting changed: ${key} from ${oldValue} to ${newValue}`);
            // No direct action needed here since IdleManager handles dimming settings
        }
    }

    /**
     * Handle brightness changes
     */
    _onBrightnessChanged(value) {
        this.debug(`Brightness changed (external event): ${value}%`);
        // No direct action needed here since BrightnessManager handles brightness changes
    }

    /**
     * Set screen brightness if supported
     */
    setBrightness(value) {
        if (!this._applet.brightness || !this._applet.brightness._proxy) {
            this.debug(`Screen brightness not supported`);
            return false;
        }

        try {
            this._applet.brightness._setBrightness(value);
            this.debug(`Set screen brightness to ${value}%`);
            return true;
        } catch (e) {
            this.debug(`Error setting brightness: ${e.message}`);
            return false;
        }
    }

    /**
     * Set keyboard brightness if supported
     */
    setKeyboardBrightness(value) {
        if (!this._applet.keyboard || !this._applet.keyboard._proxy) {
            this.debug(`Keyboard brightness not supported`);
            return false;
        }

        try {
            this._applet.keyboard._setBrightness(value);
            this.debug(`Set keyboard brightness to ${value}%`);
            return true;
        } catch (e) {
            this.debug(`Error setting keyboard brightness: ${e.message}`);
            return false;
        }
    }

    isBrightnessSupported() {
        return this._applet.brightness && this._applet.brightness.actor && this._applet.brightness.actor.visible;
    }

    isKeyboardBrightnessSupported() {
        return this._applet.keyboard && this._applet.keyboard.actor && this._applet.keyboard.actor.visible;
    }
}

/**
 * POWER AUTOMATION MANAGER - Power profile automation
 */
class PowerAutomationManager extends BaseManager {
    initialize() {
        // Cache battery manager reference
        this._batteryManager = null;

        // Existing hook
        this.addHook("power-source-changed", this._onPowerSourceChanged);
        // BatteryLevel Changed
        this.addHook("battery-level-changed", this._onBatteryLevelChanged);
        // Add battery saver trigger hook
        this.addHook("battery-saver-trigger", this._onBatterySaverTrigger);

        this.log("Power Automation Manager initialized");
    }

    /**
     * Get battery manager with lazy initialization and caching
     * @returns {BatteryManager|null} Battery manager instance or null if not available
     */
    _getBatteryManager() {
        if (!this._batteryManager) {
            this._batteryManager = this._framework.getManager("battery");
            if (this._batteryManager) {
                this.debug("Battery manager cached successfully");
            }
        }
        return this._batteryManager;
    }

    /**
     * Handle power source changes for profile automation
     * @param {boolean} isAC - True if on AC power
     * @param {boolean} wasBattery - True if previously on battery power
     */
    _onPowerSourceChanged(isAC, wasBattery) {
        // Only proceed if profile automation is enabled and profiles are supported
        if (this.isProfileAutomationEnabled() && this.isPowerProfilesSupported()) {
            // Determine target profile based on power source and battery level
            let targetProfile = isAC ? this.getACProfile() : this.getBatteryProfile();
            // Apply the profile change
            this.triggerAutomationAction(_("power profile %s").format(_(POWER_PROFILES[targetProfile])), () =>
                this.setProfile(targetProfile)
            );
        }
    }

    /**
     * Handle battery level changes
     * @param {*} deviceId
     * @param {*} newLevel
     * @param {*} oldLevel
     * @returns
     */
    _onBatteryLevelChanged(deviceId, newLevel, oldLevel) {
        let batteryManager = this._getBatteryManager();
        if (!batteryManager) {
            this.debug("Battery manager not available");
            return;
        }

        // TODO: Add battery level change logic here if needed
    }

    /**
     * Handle battery saver trigger from battery manager
     * @param {string} deviceId - Battery device ID
     * @param {number} batteryLevel - Current battery percentage
     * @param {number} threshold - Threshold that was crossed
     */
    _onBatterySaverTrigger(deviceId, batteryLevel, threshold) {
        // Only activate if battery saver is enabled and we're on battery power
        let batteryManager = this._getBatteryManager();
        if (!this.isBatterySaverEnabled() || !batteryManager || batteryManager.getCurrentPowerState() === true) {
            this.debug("Battery saver trigger ignored: disabled or on AC power");
            return;
        }

        this.debug(`Battery saver triggered for ${deviceId}: ${batteryLevel}% (threshold: ${threshold}%)`);
        this.enableBatterySaver(batteryLevel);
    }

    /**
     * Get the current battery profile
     * @returns {string} Current battery profile or null if not applicable
     */
    getBatteryProfile() {
        if (this.isBatterySaverEnabled()) {
            let batteryManager = this._getBatteryManager();
            if (batteryManager) {
                let currentLevel = batteryManager.getCurrentBatteryLevel();
                let threshold = this.getSetting("battery-low-threshold") || 20;
                // If battery is below threshold, use power-saver profile
                if (currentLevel !== null && currentLevel <= threshold) {
                    this.debug(
                        `Battery level ${currentLevel}% below threshold ${threshold}%, using power-saver profile`
                    );
                    return "power-saver";
                }
            } else {
                this.debug("Battery manager not available for battery level check");
            }
        }
        // Return the default battery profile
        return this.getSetting("battery-power-profile");
    }

    /**
     * Get the current AC profile
     * @returns {string} Current AC profile
     */
    getACProfile() {
        return this.getSetting("ac-power-profile");
    }

    /**
     * Set power profile with enhanced logging
     * @param {string} profile - Profile name to set
     * @returns {boolean} Success status
     */
    setProfile(profile) {
        if (!this._applet._profilesProxy) {
            this.debug("Power profiles not available");
            return false;
        }

        try {
            let currentProfile = this._applet._profilesProxy.ActiveProfile;
            if (currentProfile === profile) {
                this.debug(`Profile already set to '${profile}', skipping change`);
                return true;
            }

            this._applet._changeProfile(profile);
            this.debug(`Successfully changed profile from '${currentProfile}' to '${profile}'`);
            return true;
        } catch (e) {
            this.debug(`Error setting profile to ${profile}: ${e.message}`);
            return false;
        }
    }

    /**
     * Enable battery saver mode when battery is low
     * @param {number} batteryLevel - Current battery percentage
     */
    enableBatterySaver(batteryLevel) {
        if (!this.isBatterySaverEnabled() || !this.isPowerProfilesSupported()) {
            this.debug("Battery saver mode not enabled or profiles not supported");
            return;
        }

        // Check if already in power-saver mode
        if (this._applet._profilesProxy.ActiveProfile === "power-saver") {
            this.debug(`Already in power-saver mode, battery level: ${batteryLevel}%`);
            return;
        }

        // Trigger battery saver profile change
        this.triggerAutomationAction(_("power-saver mode (battery low: %d%%)").format(batteryLevel), () =>
            this.setProfile("power-saver")
        );
    }

    /**
     * Check if profile automation is enabled
     * @returns {boolean} True if profile automation is enabled
     */
    isProfileAutomationEnabled() {
        return this.getSetting("enable-profile-auto");
    }

    /**
     * Check if battery saver mode is enabled
     * @returns {boolean} True if battery saver mode is enabled
     */
    isBatterySaverEnabled() {
        return this.getSetting("enable-battery-saver");
    }

    /**
     * Check if power profiles are supported
     * @returns {boolean} True if power profiles are supported
     */
    isPowerProfilesSupported() {
        return this._applet._profilesProxy && this._applet._profilesProxy.Profiles;
    }

    /**
     * Check if battery is available (lazy check to avoid unnecessary binding)
     * @returns {boolean} True if battery manager exists and battery is detected
     */
    hasBattery() {
        let batteryManager = this._getBatteryManager();
        return batteryManager && batteryManager.getCurrentBatteryLevel() !== null;
    }

    /**
     * Get current system status for debugging
     * @returns {Object} Status object with current state
     */
    getSystemStatus() {
        let batteryManager = this._getBatteryManager();
        return {
            isAC: batteryManager ? batteryManager.getCurrentPowerState() : null,
            batteryLevel: batteryManager ? batteryManager.getCurrentBatteryLevel() : null,
            currentProfile: this._applet._profilesProxy ? this._applet._profilesProxy.ActiveProfile : null,
            profileAutomationEnabled: this.isProfileAutomationEnabled(),
            batterySaverEnabled: this.isBatterySaverEnabled(),
            batterySaverThreshold: this.getSetting("battery-low-threshold") || 20,
        };
    }
}

/**
 * SYSTEM MANAGER - System integration, notifications, and applet management
 */
class SystemManager extends BaseManager {
    initialize() {
        // Pending notifications for grouping
        this._pendingNotifications = [];
        // Timer for delayed notification display
        this._notificationTimer = null;
        // Last notification time for cooldown
        this._lastNotificationTime = null;

        // Update capabilities after devices are scanned
        this.addHook("device-scan-post", this._updateSystemIntegration.bind(this));

        this.addHook("setting-changed", this._onSettingChanged);
        this.addHook("automation-action", this._onAutomationAction);

        this.log("System Manager initialized");
    }

    /**
     * Handle setting changes for system integration
     */
    _onSettingChanged(key, newValue, oldValue) {
        if (key === "replace-system-tray-icon") {
            this._updateSystemTrayReplacement();
        } else if (key === "hide-applet-icon") {
            this._updateAppletVisibility();
        }
    }

    /**
     * Handle automation actions for consolidated notifications
     * @param {string} description - Description of the automation action
     * @param {boolean} result - Success status of the action
     * @param {string} source - Source manager name
     */
    _onAutomationAction(description, result, source) {
        if (!result || !this.getSetting("show-notifications")) return;

        // Add to pending notifications
        this._pendingNotifications.push(description);

        // Reset timer if active, or start new one
        if (this._notificationTimer) {
            GLib.source_remove(this._notificationTimer);
        }
        this._notificationTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._showConsolidatedNotification();
            this._notificationTimer = null;
            return false; // Don't repeat
        });
    }

    /**
     * Show consolidated notification with power state prefix
     * @private
     */
    _showConsolidatedNotification() {
        if (this._pendingNotifications.length === 0) return;

        // Get current power state from BatteryManager
        let batteryManager = this._framework.getManager("battery");
        let isAC = batteryManager ? batteryManager.getCurrentPowerState() : true; // Default to AC if unknown
        let powerPrefix = isAC ? _("AC power: ") : _("Battery power: ");

        // Dynamic icon selection based on power source and battery level
        let notificationIcon;
        if (isAC) {
            notificationIcon = "ac-adapter-symbolic";
        } else {
            // On battery - check battery level for appropriate icon
            let batteryLevel = batteryManager ? batteryManager.getCurrentBatteryLevel() : null;
            let lowThreshold = this.getSetting("battery-low-threshold") || 20;

            if (batteryLevel !== null && batteryLevel <= lowThreshold) {
                notificationIcon = "battery-low-symbolic";
            } else {
                notificationIcon = "battery-good-symbolic";
            }
        }

        // Combine all pending notifications
        let combinedMessage = this._pendingNotifications.join(", ");
        let fullMessage = powerPrefix + combinedMessage;

        // Show notification with cooldown
        let now = Date.now();
        if (!this._lastNotificationTime || now - this._lastNotificationTime > 1000) {
            this.notify(_("Power Automation"), fullMessage, notificationIcon);
            this._lastNotificationTime = now;
            this.debug(`Consolidated notification: ${fullMessage}`);
        }

        // Clear pending notifications
        this._pendingNotifications = [];
    }

    /**
     * Update system integration settings
     */
    _updateSystemIntegration() {
        this._updateSystemTrayReplacement();
        this._updateAppletVisibility();
        this._updateCapabilitySettings();
    }

    /**
     * Handle system tray replacement
     */
    _updateSystemTrayReplacement() {
        if (this.getSetting("replace-system-tray-icon")) {
            this._disableSystemPowerApplets();
        } else {
            this._enableSystemPowerApplets();
        }
    }

    /**
     * Disable system power applets
     */
    _disableSystemPowerApplets() {
        try {
            let panelSettings = new Gio.Settings({ schema_id: "org.cinnamon" });
            let enabledApplets = panelSettings.get_strv("enabled-applets");
            let cleanedApplets = [];
            this._originalPowerApplets = [];

            for (let appletEntry of enabledApplets) {
                if (appletEntry.includes("power@cinnamon.org") || appletEntry.includes("battery@cinnamon.org")) {
                    this._originalPowerApplets.push(appletEntry);
                    this.debug(`Disabled system power applet: ${appletEntry}`);
                } else {
                    cleanedApplets.push(appletEntry);
                }
            }

            if (this._originalPowerApplets.length > 0) {
                panelSettings.set_strv("enabled-applets", cleanedApplets);
                this.setSetting("original-power-applets", this._originalPowerApplets);
                this.log("System power applets disabled");
            }
        } catch (e) {
            this.log(`Error disabling system power applets: ${e.message}`);
        }
    }

    /**
     * Re-enable system power applets
     */
    _enableSystemPowerApplets() {
        try {
            let originalApplets = this.getSetting("original-power-applets") || [];
            if (originalApplets.length === 0) return;

            let panelSettings = new Gio.Settings({ schema_id: "org.cinnamon" });
            let enabledApplets = panelSettings.get_strv("enabled-applets");

            for (let originalApplet of originalApplets) {
                if (!enabledApplets.includes(originalApplet)) {
                    enabledApplets.push(originalApplet);
                }
            }

            panelSettings.set_strv("enabled-applets", enabledApplets);
            this.setSetting("original-power-applets", []);
            this.log("System power applets restored");
        } catch (e) {
            this.log(`Error restoring system power applets: ${e.message}`);
        }
    }

    /**
     * Update applet visibility
     */
    _updateAppletVisibility() {
        if (this.getSetting("hide-applet-icon")) {
            this._applet.actor.hide();
            this.debug("Applet icon hidden");
        } else {
            this._applet.actor.show();
            this.debug("Applet icon shown");
        }
    }

    /**
     * Update capability settings for UI visibility
     */
    _updateCapabilitySettings() {
        try {
            let brightnessManager = this._framework.getManager("brightness");
            let powerManager = this._framework.getManager("power-automation");
            let batteryManager = this._framework.getManager("battery");

            // Update capability flags for settings UI
            let hasBrightness = brightnessManager && brightnessManager.isBrightnessSupported();
            let hasPowerProfiles = powerManager && powerManager.isPowerProfilesSupported();
            let hasBattery = this._applet._devices && this._applet._devices.length > 0;

            this.setSetting("brightness-available", hasBrightness);
            this.setSetting("brightness-not-available", !hasBrightness);
            this.setSetting("power-control-available", hasPowerProfiles && hasBattery);
            this.setSetting("power-control-not-available", !(hasPowerProfiles && hasBattery));
            this.setSetting("battery-available", hasBattery);
            this.setSetting("hide-applet-icon", !(hasBrightness && hasBattery));

            // Enhanced debug logging with flexible profile details
            let profileDetails =
                hasPowerProfiles && this._applet._profilesProxy.Profiles
                    ? this._applet._profilesProxy.Profiles.map((p) => {
                          try {
                              return p.Profile.unpack();
                          } catch (e) {
                              this.debug(`Error extracting profile name: ${e.message}`);
                              return "error";
                          }
                      }).join(", ")
                    : "none";
            this.debug(`Capabilities: brightness=${hasBrightness}, profiles=${profileDetails}, battery=${hasBattery}`);
        } catch (e) {
            this.debug(`Error updating capabilities: ${e.message}`);
        }
    }

    /**
     * Cleanup system integration on removal
     */
    destroy() {
        // Always restore system power applets when removed
        this._enableSystemPowerApplets();

        // Cleanup notification timer
        if (this._notificationTimer) {
            GLib.source_remove(this._notificationTimer);
            this._notificationTimer = null;
            this.debug("Notification timer cleaned up");
        }

        super.destroy();
    }
}

// Export all classes
module.exports = {
    PowerAppletExtensionFramework: PowerAppletExtensionFramework,
    BaseManager: BaseManager,
    IdleManager: IdleManager,
    BatteryManager: BatteryManager,
    BrightnessManager: BrightnessManager,
    PowerAutomationManager: PowerAutomationManager,
    SystemManager: SystemManager,
};
