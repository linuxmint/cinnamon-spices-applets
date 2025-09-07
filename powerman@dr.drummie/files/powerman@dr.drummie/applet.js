/**
 * PowerMan - Cinnamon Power Applet with enhanced functionality
 * This applet monitors and displays power and battery information, brightness, and power profiles.
 * It interacts with UPower, Cinnamon Settings Daemon, and DBus to get device and power state.
 * It is based on default Cinnamon Power applet code.
 */

// Core Cinnamon imports
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

// GI imports
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const UPowerGlib = imports.gi.UPowerGlib;
const GLib = imports.gi.GLib;

// Other imports
const Interfaces = imports.misc.interfaces;
const Lang = imports.lang;
const Gettext = imports.gettext;
// Configuration constants
const UUID = "powerman@dr.drummie"; // Must match metadata.json
const LOCALE_DIR = GLib.get_home_dir() + "/.local/share/locale";

// DBus service names for hardware control
const BrightnessBusName = "org.cinnamon.SettingsDaemon.Power.Screen";
const KeyboardBusName = "org.cinnamon.SettingsDaemon.Power.Keyboard";

// Error codes and panel settings
const CSD_BACKLIGHT_NOT_SUPPORTED_CODE = 1;
const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

// UPower destructuring for cleaner code
const {
    DeviceKind: UPDeviceKind,
    DeviceLevel: UPDeviceLevel,
    DeviceState: UPDeviceState,
    Device: UPDevice,
} = UPowerGlib;

// Set up Gettext for translations
Gettext.bindtextdomain(UUID, LOCALE_DIR);

/**
 * Translation function - translates strings using the Gettext library.
 * @param {string} str - String to translate
 * @returns {string} Translated string or original if no translation found
 */
function _(str) {
    let translated = Gettext.dgettext(UUID, str);
    return translated || str;
}

// Power profile mappings
const POWER_PROFILES = {
    "power-saver": _("Power Saver"),
    balanced: _("Balanced"),
    performance: _("Performance"),
};

/**
 * Converts a UPower device level enum to a human-readable string.
 * @param {number} level - UPower device level enum value
 * @returns {string} Localized human-readable battery level description
 */
function deviceLevelToString(level) {
    switch (level) {
        case UPDeviceLevel.FULL:
            return _("Battery full");
        case UPDeviceLevel.HIGH:
            return _("Battery almost full");
        case UPDeviceLevel.NORMAL:
            return _("Battery good");
        case UPDeviceLevel.LOW:
            return _("Low battery");
        case UPDeviceLevel.CRITICAL:
            return _("Critically low battery");
        default:
            return _("Unknown");
    }
}

/**
 * Converts a UPower device kind enum to a human-readable string.
 * @param {number} kind - UPower device kind enum value
 * @returns {string} Localized human-readable device type description
 */
function deviceKindToString(kind) {
    switch (kind) {
        case UPDeviceKind.LINE_POWER:
            return _("AC adapter");
        case UPDeviceKind.BATTERY:
            return _("Laptop battery");
        case UPDeviceKind.UPS:
            return _("UPS");
        case UPDeviceKind.MONITOR:
            return _("Monitor");
        case UPDeviceKind.MOUSE:
            return _("Mouse");
        case UPDeviceKind.KEYBOARD:
            return _("Keyboard");
        case UPDeviceKind.PDA:
            return _("PDA");
        case UPDeviceKind.PHONE:
            return _("Cell phone");
        case UPDeviceKind.MEDIA_PLAYER:
            return _("Media player");
        case UPDeviceKind.TABLET:
            return _("Tablet");
        case UPDeviceKind.COMPUTER:
            return _("Computer");
        case UPDeviceKind.GAMING_INPUT:
            return _("Gaming input");
        case UPDeviceKind.PEN:
            return _("Pen");
        case UPDeviceKind.TOUCHPAD:
            return _("Touchpad");
        case UPDeviceKind.MODEM:
            return _("Modem");
        case UPDeviceKind.NETWORK:
            return _("Network");
        case UPDeviceKind.HEADSET:
            return _("Headset");
        case UPDeviceKind.SPEAKERS:
            return _("Speakers");
        case UPDeviceKind.HEADPHONES:
            return _("Headphones");
        case UPDeviceKind.VIDEO:
            return _("Video");
        case UPDeviceKind.OTHER_AUDIO:
            return _("Audio device");
        case UPDeviceKind.REMOTE_CONTROL:
            return _("Remote control");
        case UPDeviceKind.PRINTER:
            return _("Printer");
        case UPDeviceKind.SCANNER:
            return _("Scanner");
        case UPDeviceKind.CAMERA:
            return _("Camera");
        case UPDeviceKind.WEARABLE:
            return _("Wearable");
        case UPDeviceKind.TOY:
            return _("Toy");
        default: {
            try {
                return UPDevice.kind_to_string(kind).replaceAll("-", " ").capitalize();
            } catch {
                return _("Unknown");
            }
        }
    }
}

/**
 * Maps a device kind to an appropriate icon name.
 * @param {number} kind - UPower device kind enum value
 * @param {string} icon - Optional custom icon name to use instead
 * @returns {string} Icon name for the device type
 */
function deviceKindToIcon(kind, icon) {
    switch (kind) {
        case UPDeviceKind.MONITOR:
            return "video-display";
        case UPDeviceKind.MOUSE:
            return "input-mouse";
        case UPDeviceKind.KEYBOARD:
            return "input-keyboard";
        case UPDeviceKind.PHONE:
        case UPDeviceKind.MEDIA_PLAYER:
            return "phone-apple-iphone";
        case UPDeviceKind.TABLET:
            return "input-tablet";
        case UPDeviceKind.COMPUTER:
            return "computer";
        case UPDeviceKind.GAMING_INPUT:
            return "input-gaming";
        case UPDeviceKind.TOUCHPAD:
            return "input-touchpad";
        case UPDeviceKind.HEADSET:
            return "audio-headset";
        case UPDeviceKind.SPEAKERS:
            return "audio-speakers";
        case UPDeviceKind.HEADPHONES:
            return "audio-headphones";
        case UPDeviceKind.PRINTER:
            return "printer";
        case UPDeviceKind.SCANNER:
            return "scanner";
        case UPDeviceKind.CAMERA:
            return "camera-photo";
        default:
            if (icon) {
                return icon;
            } else {
                return "battery-full";
            }
    }
}

/**
 * Checks if the device reports precise battery levels (percentage).
 * @param {number} battery_level - UPower device level enum value
 * @returns {boolean} True if device reports exact percentage, false if only level indicators
 */
function reportsPreciseLevels(battery_level) {
    return battery_level == UPDeviceLevel.NONE;
}

/**
 * Represents a device (battery, mouse, etc.) in the popup menu.
 * Creates a menu item showing device information including name, icon, battery percentage and status.
 *
 * @class
 * @extends PopupMenu.PopupBaseMenuItem
 */
class DeviceItem extends PopupMenu.PopupBaseMenuItem {
    /**
     * Creates a new device menu item.
     * @param {Array} device - Device info array [id, vendor, model, kind, icon, percentage, state, battery_level, time]
     * @param {string} status - Device status string (charging, discharging, etc.)
     * @param {Array} aliases - Array of device aliases from settings
     */
    constructor(device, status, aliases) {
        super({ reactive: false });

        let [device_id, vendor, model, device_kind, icon, percentage, state, battery_level, time] = device;

        this._box = new St.BoxLayout({ style_class: "popup-device-menu-item" });
        this._vbox = new St.BoxLayout({ style_class: "popup-device-menu-item", vertical: true });

        let description = deviceKindToString(device_kind);
        if (vendor != "" || model != "") {
            description = "%s %s".format(vendor, model);
        }

        for (let i = 0; i < aliases.length; ++i) {
            let alias = aliases[i];
            try {
                let parts = alias.split(":=");
                if (parts[0] == device_id) {
                    description = parts[1];
                }
            } catch (e) {
                // ignore malformed aliases
                global.logError(alias);
            }
        }

        let statusLabel = null;

        if (battery_level == UPDeviceLevel.NONE) {
            this.label = new St.Label({ text: "%s %d%%".format(description, Math.round(percentage)) });
            statusLabel = new St.Label({ text: "%s".format(status), style_class: "popup-inactive-menu-item" });
        } else {
            this.label = new St.Label({ text: "%s".format(description) });
            statusLabel = new St.Label({
                text: "%s".format(deviceLevelToString(battery_level)),
                style_class: "popup-inactive-menu-item",
            });
        }

        let device_icon = deviceKindToIcon(device_kind, icon);
        if (device_icon == icon) {
            this._icon = new St.Icon({
                gicon: Gio.icon_new_for_string(icon),
                icon_type: St.IconType.SYMBOLIC,
                style_class: "popup-menu-icon",
            });
        } else {
            this._icon = new St.Icon({ icon_name: device_icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16 });
        }

        this._box.add_actor(this._icon);
        this._box.add_actor(this.label);

        this._vbox.add_actor(this._box);
        this._vbox.add_actor(statusLabel);

        this.addActor(this._vbox);
    }
}

/**
 * Brightness slider for screen or keyboard backlight.
 * Connects to brightness control DBus services and provides user interface for adjusting brightness.
 *
 * @class
 * @extends PopupMenu.PopupSliderMenuItem
 */
class BrightnessSlider extends PopupMenu.PopupSliderMenuItem {
    /**
     * Creates a new brightness slider.
     * @param {CinnamonPowerApplet} applet - Parent applet instance
     * @param {string} label - Display label for the slider
     * @param {string} icon - Icon name for the slider
     * @param {string} busName - DBus service name for brightness control
     * @param {number} minimum_value - Minimum brightness value (0-1)
     */
    constructor(applet, label, icon, busName, minimum_value) {
        super(0);
        this.actor.hide();

        this._applet = applet;
        this._seeking = false;
        this._minimum_value = minimum_value;
        this._step = 0.05;

        this.connect(
            "drag-begin",
            Lang.bind(this, function () {
                this._seeking = true;
            })
        );
        this.connect(
            "drag-end",
            Lang.bind(this, function () {
                this._seeking = false;
            })
        );

        this.icon = new St.Icon({ icon_name: icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16 });
        this.removeActor(this._slider);
        this.addActor(this.icon, { span: 0 });
        this.addActor(this._slider, { span: -1, expand: true });

        this.label = label;
        this.tooltipText = label;
        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        Interfaces.getDBusProxyAsync(
            busName,
            Lang.bind(this, function (proxy, error) {
                if (error) {
                    this._debugLog(`DBus proxy error for ${busName}: ${error.message}`);
                    return;
                }
                this._proxy = proxy;
                this._proxy.GetPercentageRemote(Lang.bind(this, this._dbusAcquired));
            })
        );
    }

    _dbusAcquired(b, error) {
        if (error) return;

        try {
            this._proxy.GetStepRemote((step, error) => {
                if (error != null) {
                    if (error.code != CSD_BACKLIGHT_NOT_SUPPORTED_CODE) {
                        global.logError(`Could not get backlight step for ${busName}: ${error.message}`);
                        return;
                    } else {
                        this._step = 0.05;
                    }
                }
                this._step = step / 100;
            });
        } catch (e) {
            this._step = 0.05;
        }

        this._updateBrightnessLabel(b);
        this.setValue(b / 100);
        this.connect("value-changed", Lang.bind(this, this._sliderChanged));

        this.actor.show();

        //get notified
        this._proxy.connect("Changed", Lang.bind(this, this._getBrightness));
        this._applet.menu.connect("open-state-changed", Lang.bind(this, this._getBrightnessForcedUpdate));
    }

    _sliderChanged(slider, value) {
        if (value < this._minimum_value) {
            value = this._minimum_value;
        }

        let i = this._minimum_value;
        let v = value;
        let step = this._step;

        while (i < 1.0) {
            if (v > i + step) {
                i = i + step;
                continue;
            }

            if (i + step - v < v - i) {
                v = i + step;
            } else {
                v = i;
            }

            break;
        }

        this.setValue(v);

        // A non-zero minimum brightness can cause our stepped value
        // to exceed 100, making the slider jitter (because c-s-d rejects
        // the value)
        this._setBrightness(Math.min(100, Math.round(v * 100)));
    }

    _getBrightness() {
        //This func is called when dbus signal is received.
        //Only update items value when slider is not used
        if (!this._seeking) this._getBrightnessForcedUpdate();
    }

    _getBrightnessForcedUpdate() {
        this._proxy.GetPercentageRemote(
            Lang.bind(this, function (b) {
                this._updateBrightnessLabel(b);
                this.setValue(b / 100);
            })
        );
    }

    _setBrightness(value) {
        this._proxy.SetPercentageRemote(
            value,
            Lang.bind(this, function (b) {
                this._updateBrightnessLabel(b);
            })
        );
    }

    _updateBrightnessLabel(value) {
        this.tooltipText = this.label;
        if (value) this.tooltipText += ": " + value + "%";

        this.tooltip.set_text(this.tooltipText);
        if (this._dragging) this.tooltip.show();
    }

    /* Overriding PopupSliderMenuItem so we can modify the scroll step */
    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.DOWN) {
            this._proxy.StepDownRemote(function () {});
        } else if (direction == Clutter.ScrollDirection.UP) {
            this._proxy.StepUpRemote(function () {});
        }

        // Add this to update the slider value after hardware change
        this._getBrightnessForcedUpdate();
        this._slider.queue_repaint();
    }
}

/**
 * Main applet class for Cinnamon Power Applet.
 * Handles device detection, menu, brightness, power profiles, and panel icon/label updates.
 * @class
 * @extends Applet.TextIconApplet
 */
class CinnamonPowerApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);

        // Bind all automation settings
        this.settings.bind("enable-brightness-auto", "enableBrightnessAuto", this._onSettingsChanged);
        this.settings.bind("ac-brightness", "acBrightness", this._onSettingsChanged);
        this.settings.bind("battery-brightness", "batteryBrightness", this._onSettingsChanged);
        this.settings.bind("idle-dim-ac", "dimOnAc", this._onDimSettingChanged);
        this.settings.bind("idle-dim-battery", "dimOnBattery", this._onDimSettingChanged);
        this.settings.bind("idle-dim-time", "dimIdleTime", this._onDimSettingChanged);
        this.settings.bind("idle-brightness", "dimIdleBrightness", this._onDimSettingChanged);
        this.settings.bind("enable-profile-auto", "enableProfileAuto", this._onSettingsChanged);
        this.settings.bind("ac-power-profile", "acPowerProfile", this._onSettingsChanged);
        this.settings.bind("battery-power-profile", "batteryPowerProfile", this._onSettingsChanged);
        this.settings.bind("enable-battery-saver", "enableBatterySaver", this._onSettingsChanged);
        this.settings.bind("battery-low-threshold", "batteryLowThreshold", this._onSettingsChanged);
        this.settings.bind("show-notifications", "showNotifications", this._onSettingsChanged);
        this.settings.bind("replace-system-tray-icon", "replaceSystemTrayIcon", this._onSystemTraySettingChanged);
        this.settings.bind("hide-applet-icon", "hideAppletIcon", this._onHideIconSettingChanged);
        this.settings.bind("debug-logging", "debugLogging", this._onSettingsChanged);

        // Initialize capability settings BEFORE binding to prevent warnings
        try {
            this.settings.setValue("brightness-available", false);
            this.settings.setValue("brightness-not-available", true);
            this.settings.setValue("power-control-available", false);
            this.settings.setValue("power-control-not-available", true);
            this.settings.setValue("battery-available", false);
        } catch (e) {
            this._debugLog(`Warning: Could not initialize capability settings: ${e.message}`);
        }

        // Bind capability settings (generic type - invisible to user)
        this.settings.bind("brightness-available", "brightnessAvailable");
        this.settings.bind("power-control-available", "powerControlAvailable");
        this.settings.bind("battery-available", "batteryAvailable");

        // Handle system tray replacement
        this._updateSystemTrayReplacement();

        // Handle applet visibility
        this._updateAppletVisibility();

        // Initialize dconf settings for brightness dimming
        this._dconfSettings = new Gio.Settings({ schema_id: "org.cinnamon.settings-daemon.plugins.power" });

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.aliases = global.settings.get_strv("device-aliases");

        this._deviceItems = [];
        this._devices = [];
        this._primaryDeviceId = null;
        this.panel_icon_name = ""; // remember the panel icon name (so we only set it when it actually changes)
        this._originalPowerApplets = []; // track system power applets for restoration

        // Initialize tracking states for change detection
        this._lastPowerState = null; // AC/battery state
        this._lastBatteryLevel = null; // battery percentage
        this._brightnessSupported = null; // brightness support status
        this._batteryStates = new Map(); // track individual battery states

        // Capabilities tracking for settings dependencies
        this._capabilities = {
            hasBrightness: false,
            hasKeyboard: false,
            hasPowerProfiles: false,
            hasBattery: false,
        };

        // Track if icon was auto-hidden (to avoid overriding manual user choice)
        this._autoHidden = false;

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.brightness = new BrightnessSlider(this, _("Brightness"), "display-brightness", BrightnessBusName, 0);
        this.keyboard = new BrightnessSlider(this, _("Keyboard backlight"), "keyboard-brightness", KeyboardBusName, 0);
        this.menu.addMenuItem(this.brightness);
        this.menu.addMenuItem(this.keyboard);

        try {
            // Hadess interface
            let PowerProfilesInterface = `<node>
              <interface name="net.hadess.PowerProfiles">
                <property name="ActiveProfile" type="s" access="readwrite" />
                <property name="PerformanceDegraded" type="s" access="read" />
                <property name="Profiles" type="aa{sv}" access="read" />
                <property name="ActiveProfileHolds" type="aa{sv}" access="read" />
              </interface>
            </node>`;
            let PowerProfilesProxy = Gio.DBusProxy.makeProxyWrapper(PowerProfilesInterface);
            this._profilesProxy = new PowerProfilesProxy(
                Gio.DBus.system,
                "net.hadess.PowerProfiles",
                "/net/hadess/PowerProfiles"
            );
            // Upower if hadess doesn't work..
            if (!this._profilesProxy.Profiles) {
                // UPower interface
                let PowerProfilesInterface = `<node>
                  <interface name="org.freedesktop.UPower.PowerProfiles">
                    <property name="ActiveProfile" type="s" access="readwrite" />
                    <property name="PerformanceDegraded" type="s" access="read" />
                    <property name="Profiles" type="aa{sv}" access="read" />
                    <property name="ActiveProfileHolds" type="aa{sv}" access="read" />
                  </interface>
                </node>`;
                let PowerProfilesProxy = Gio.DBusProxy.makeProxyWrapper(PowerProfilesInterface);
                this._profilesProxy = new PowerProfilesProxy(
                    Gio.DBus.system,
                    "org.freedesktop.UPower.PowerProfiles",
                    "/org/freedesktop/UPower/PowerProfiles"
                );
            }
        } catch {
            // Initialize last device states for tracking changes
            this._lastDeviceStates = {
                ac: undefined,
                percent: undefined,
            };
            this._profilesProxy = null;
        }

        if (this._profilesProxy && this._profilesProxy.Profiles) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.contentSection = new PopupMenu.PopupMenuSection();

            this.ActiveProfile = this._profilesProxy.ActiveProfile;
            this.Profiles = this._profilesProxy.Profiles;

            this._proxyId = this._profilesProxy.connect("g-properties-changed", (proxy, changed, invalidated) => {
                for (let [changedProperty, changedValue] of Object.entries(changed.deepUnpack())) {
                    if (["ActiveProfile", "Profiles"].includes(changedProperty))
                        this[changedProperty] = changedValue.deepUnpack();
                    this._updateProfile();
                }
            });

            this._updateProfile();
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Add automation settings button
        let automationSettings = new PopupMenu.PopupMenuItem(_("Automation Settings"));
        automationSettings.connect(
            "activate",
            Lang.bind(this, function () {
                this.configureApplet();
            })
        );
        this.menu.addMenuItem(automationSettings);

        this.menu.addSettingsAction(_("Power Settings"), "power");

        this.actor.connect("scroll-event", Lang.bind(this, this._onScrollEvent));

        this._proxy = null;

        global.settings.connect("changed::" + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._onPanelEditModeChanged));

        this.csd_power_watch_id = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            "org.cinnamon.SettingsDaemon.Power",
            0,
            (c, name) => {
                Interfaces.getDBusProxyAsync(
                    "org.cinnamon.SettingsDaemon.Power",
                    Lang.bind(this, function (proxy, error) {
                        Gio.bus_unwatch_name(this.csd_power_watch_id);
                        this.csd_power_watch_id = 0;

                        if (error) {
                            global.logError("Could not connect to csd-power", error.message);
                            return;
                        }

                        this._proxy = proxy;

                        this._proxy.connect(
                            "g-properties-changed",
                            Lang.bind(this, function () {
                                if (!this._devicesUpdatePending) {
                                    this._devicesUpdatePending = true;
                                    GLib.timeout_add(
                                        GLib.PRIORITY_DEFAULT,
                                        500,
                                        Lang.bind(this, function () {
                                            this._devicesChanged();
                                            this._devicesUpdatePending = false;
                                            return false;
                                        })
                                    );
                                }
                            })
                        );
                        global.settings.connect(
                            "changed::device-aliases",
                            Lang.bind(this, this._on_device_aliases_changed)
                        );
                        this.settings.bind("labelinfo", "labelinfo", this._devicesChanged);
                        this.settings.bind("showmulti", "showmulti", this._devicesChanged);

                        this._devicesChanged();
                    })
                );
            },
            null
        );

        this.set_show_label_in_vertical_panels(false);
    }

    /**
     * =========================================================================
     * EVENT HANDLERS
     * =========================================================================
     */

    /**
     * Handles changes to panel edit mode (shows placeholder icon if editing).
     */
    _onPanelEditModeChanged() {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            if (!this.actor.visible) {
                this.set_applet_icon_symbolic_name("battery-missing");
                this.set_applet_enabled(true);
            }
        } else {
            this._devicesChanged();
        }
    }

    /**
     * Updates device aliases when settings change.
     */
    _on_device_aliases_changed() {
        this.aliases = global.settings.get_strv("device-aliases");
        this._devicesChanged();
    }

    /**
     * Handles mouse button press events on the applet (middle click toggles keyboard backlight).
     */
    _onButtonPressEvent(actor, event) {
        //toggle keyboard brightness on middle click
        if (event.get_button() === 2) {
            this.keyboard._proxy.ToggleRemote(function () {});
        }
        return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    }
    /**
     * =========================================================================
     * DEBUG AND LOGGING FUNCTIONS
     * =========================================================================
     */

    /**
     * Simple logging without notifications
     */
    _log(msg) {
        let timestamp = new Date().toLocaleTimeString();
        global.log(`[powerman] [${timestamp}] ${msg}`);
    }

    /**
     * Enhanced debug logging helper that respects debug setting
     * @param {string} msg - Debug message
     */
    _debugLog(msg) {
        if (this.debugLogging) {
            this._log(`[DEBUG] ${msg}`);
        }
    }

    /**
     * Show notification if enabled
     */
    _notify(title, msg) {
        if (this.showNotifications) {
            try {
                Main.notify(title, msg);
            } catch (e) {
                global.logError("Notification failed: " + e.message);
            }
        }
    }

    /**
     * Log and optionally notify for automation events
     */
    _logAutomation(msg, showNotification = true) {
        // Simple duplicate detection by comparing message content
        if (this._lastNotificationMessage === msg) {
            this._debugLog(`Duplicate notification blocked: "${msg}"`);
            return; // Skip duplicate notification
        }

        this._lastNotificationMessage = msg;

        this._log(msg);
        if (showNotification) {
            this._notify(_("Power Automation"), msg);
        }
    }

    /**
     * Legacy method maintained for compatibility - now uses simpler logging
     * @param {string} msg - Message to log (no longer automatically shows notifications)
     */
    _notifyAndLog(msg) {
        this._log(msg);
    }

    /**
     * Handles applet click event (shows/hides menu).
     */
    on_applet_clicked(event) {
        this.menu.toggle();
    }

    /**
     * Handles scroll events on the applet (adjusts brightness).
     */
    _onScrollEvent(actor, event) {
        //adjust screen brightness on scroll
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.UP) {
            this.brightness._proxy.StepUpRemote(function () {});
        } else if (direction == Clutter.ScrollDirection.DOWN) {
            this.brightness._proxy.StepDownRemote(function () {});
        }
        this.brightness._getBrightnessForcedUpdate();
    }

    /**
     * Returns a status string for a device, including charging/discharging state and time remaining.
     * @param {Array} device - Device info array
     * @returns {string} Status string
     */
    _getDeviceStatus(device) {
        let status = "";
        let [device_id, vendor, model, device_kind, icon, percentage, state, battery_level, seconds] = device;

        let time = Math.round(seconds / 60);
        let minutes = time % 60;
        let hours = Math.floor(time / 60);

        if (state == UPDeviceState.UNKNOWN) {
            status = "";
        } else if (state == UPDeviceState.CHARGING) {
            if (time == 0) {
                status = _("Charging");
            } else if (time >= 60) {
                if (minutes == 0) {
                    status = ngettext(
                        "Charging - %d hour until fully charged",
                        "Charging - %d hours until fully charged",
                        hours
                    ).format(hours);
                } else {
                    /* Translators: this is a time string, as in "%d hours %d minutes remaining" */
                    let template = _("Charging - %d %s %d %s until fully charged");
                    status = template.format(
                        hours,
                        ngettext("hour", "hours", hours),
                        minutes,
                        ngettext("minute", "minutes", minutes)
                    );
                }
            } else {
                status = ngettext(
                    "Charging - %d minute until fully charged",
                    "Charging - %d minutes until fully charged",
                    minutes
                ).format(minutes);
            }
        } else if (state == UPDeviceState.FULLY_CHARGED) {
            status = _("Fully charged");
        } else if (state == UPDeviceState.DISCHARGING) {
            if (time == 0) {
                status = _("Using battery power");
            } else if (time >= 60) {
                if (minutes == 0) {
                    status = ngettext(
                        "Using battery power - %d hour remaining",
                        "Using battery power - %d hours remaining",
                        hours
                    ).format(hours);
                } else {
                    /* Translators: this is a time string, as in "%d hours %d minutes remaining" */
                    let template = _("Using battery power - %d %s %d %s remaining");
                    status = template.format(
                        hours,
                        ngettext("hour", "hours", hours),
                        minutes,
                        ngettext("minute", "minutes", minutes)
                    );
                }
            } else {
                status = ngettext(
                    "Using battery power - %d minute remaining",
                    "Using battery power - %d minutes remaining",
                    minutes
                ).format(minutes);
            }
        } else if (state == UPDeviceState.EMPTY) {
            status = _("Fully discharged");
        } else {
            status = _("Not charging");
        }

        return status;
    }

    /**
     * Updates devices when panel height changes (to adjust icon/label size).
     */
    on_panel_height_changed() {
        if (this._proxy) this._devicesChanged();
    }

    /**
     * Updates the panel icon, label, and tooltip for a given device.
     * @param {Array} device - Device info array
     */
    showDeviceInPanel(device) {
        let [device_id, vendor, model, device_kind, icon, percentage, state, battery_level, seconds] = device;
        let status = this._getDeviceStatus(device);
        this.set_applet_tooltip(status);
        let labelText = "";
        if (this.labelinfo == "nothing") {
        } else if (this.labelinfo == "time" && seconds != 0) {
            let time = Math.round(seconds / 60);
            let minutes = time % 60;
            let hours = Math.floor(time / 60);
            labelText = C_("time of battery remaining", "%d:%02d").format(hours, minutes);
        } else if (this.labelinfo == "percentage" || (this.labelinfo == "percentage_time" && seconds == 0)) {
            labelText = C_("percent of battery remaining", "%d%%").format(Math.round(percentage));
        } else if (this.labelinfo == "percentage_time") {
            let time = Math.round(seconds / 60);
            let minutes = Math.floor(time % 60);
            let hours = Math.floor(time / 60);
            labelText =
                C_("percent of battery remaining", "%d%%").format(Math.round(percentage)) +
                " (" +
                C_("time of battery remaining", "%d:%02d").format(hours, minutes) +
                ")";
        }
        this.set_applet_label(labelText);

        if (icon) {
            if (this.panel_icon_name != icon) {
                this.panel_icon_name = icon;
                this.set_applet_icon_symbolic_name("battery-full");
                let gicon = Gio.icon_new_for_string(icon);
                this._applet_icon.gicon = gicon;
            }
        } else {
            if (this.panel_icon_name != "battery-full") {
                this.panel_icon_name = "battery-full";
                this.set_applet_icon_symbolic_name("battery-full");
            }
        }

        this._applet_icon.set_style_class_name("system-status-icon");
    }

    /**
     * Updates the power profile section in the menu.
     */
    _updateProfile() {
        this.contentSection.removeAll();

        for (let profileNum = 0; profileNum < this.Profiles.length; profileNum++) {
            let profileName = this.Profiles[profileNum].Profile.unpack();
            let item;
            if (profileName == this.ActiveProfile) {
                this.profileIndex = profileNum;
                item = new PopupMenu.PopupMenuItem(POWER_PROFILES[profileName], {
                    style_class: "popup-device-menu-item",
                    reactive: false,
                });
                item.setShowDot(true);
            } else {
                item = new PopupMenu.PopupMenuItem(POWER_PROFILES[profileName]);
                item.connect(
                    "activate",
                    Lang.bind(this, function () {
                        this._changeProfile(profileName);
                        this.menu.toggle();
                    })
                );
            }
            this.contentSection.addMenuItem(item);
        }

        this.menu.addMenuItem(this.contentSection);

        // Update capabilities when profiles are updated
        this._updateCapabilities();
    }

    /**
     * Changes the active power profile.
     * @param {string} newProfile - New profile name
     */
    _changeProfile(newProfile) {
        this._profilesProxy.ActiveProfile = newProfile;
        this.ActiveProfile = this._profilesProxy.ActiveProfile;
    }

    /**
     * Updates the list of devices, their menu items, and the panel display.
     */
    _devicesChanged() {
        this._debugLog("=== _devicesChanged() called ===");

        // Check brightness support status (jednom)
        if (this._brightnessSupported === null) {
            this._checkBrightnessSupport();
        }

        this._devices = [];
        this._primaryDevice = null;
        this._primaryDeviceId = null;

        if (!this._proxy) return;

        // GCF1 - changed because: Added _pendingDeviceUpdate flag to prevent overlapping async calls and ensure proper sequencing
        this._pendingDeviceUpdate = true; // Flag to prevent overlapping updates

        // Identify the primary battery device
        this._proxy.GetPrimaryDeviceRemote(
            Lang.bind(this, function (device, error) {
                // NEW: Enhanced primary device detection with fallback
                if (error) {
                    this._debugLog(`GetPrimaryDeviceRemote error: ${error.message}`);
                    this._primaryDeviceId = null;
                } else {
                    if (device.length == 1) {
                        // Primary Device can be an array of primary devices rather than a single device, in that case, take the first one.
                        device = device[0];
                    }
                    let [device_id, vendor, model, device_kind, icon, percentage, state, battery_level, seconds] =
                        device;
                    this._primaryDeviceId = device_id;
                    this._debugLog(`Primary device ID from UPower: ${device_id}, kind: ${device_kind}`);
                }

                // Scan battery devices
                this._proxy.GetDevicesRemote(
                    Lang.bind(this, function (result, error) {
                        // GCF2 - changed because: Added error handling in GetDevicesRemote callback to prevent crashes and log errors
                        if (error) {
                            this._debugLog(`Error getting devices: ${error.message}`);
                            this._pendingDeviceUpdate = false;
                            return;
                        }
                        if (!this._pendingDeviceUpdate) return; // Skip if another update started
                        this._deviceItems.forEach(function (i) {
                            i.destroy();
                        });
                        this._deviceItems = [];
                        let devices_stats = [];
                        let pct_support_count = 0;
                        let _devices = [];
                        let _deviceItems = [];

                        if (!error) {
                            let devices = result[0];
                            let position = 0;
                            let acConnected = false;
                            let batteryDevices = [];

                            // NEW: Set _primaryDevice IMMEDIATELY after getting devices
                            if (this._primaryDeviceId) {
                                this._debugLog(`Looking for primary device: ${this._primaryDeviceId}`);
                                for (let i = 0; i < devices.length; i++) {
                                    let [device_id, , , device_kind, , percentage, , ,] = devices[i];
                                    this._debugLog(`Checking device: ${device_id}, kind: ${device_kind}`);
                                    if (device_id === this._primaryDeviceId && device_kind == UPDeviceKind.BATTERY) {
                                        this._primaryDevice = devices[i];
                                        this._debugLog(
                                            `Primary device set early: ${device_id}, percentage: ${percentage}%`
                                        );
                                        break;
                                    }
                                }

                                // If exact match failed, try without kind restriction
                                if (!this._primaryDevice) {
                                    this._debugLog(`Exact match failed, trying without kind restriction`);
                                    for (let i = 0; i < devices.length; i++) {
                                        let [device_id, , , device_kind, , percentage, , ,] = devices[i];
                                        if (device_id === this._primaryDeviceId) {
                                            this._primaryDevice = devices[i];
                                            this._debugLog(
                                                `Primary device set early (no kind check): ${device_id}, kind: ${device_kind}, percentage: ${percentage}%`
                                            );
                                            break;
                                        }
                                    }
                                }
                            } else {
                                this._debugLog(`No _primaryDeviceId from UPower, using fallback logic immediately`);
                            }

                            // Enhanced fallback if no primary device found (ALWAYS RUN)
                            if (!this._primaryDevice) {
                                this._debugLog(`Primary device still null, running enhanced fallback`);
                                // Try to find any laptop battery first
                                for (let i = 0; i < devices.length; i++) {
                                    let [device_id, , , device_kind, , percentage, , ,] = devices[i];
                                    if (device_kind == UPDeviceKind.BATTERY) {
                                        this._primaryDevice = devices[i];
                                        this._debugLog(
                                            `Primary device set as laptop battery fallback: ${device_id}, percentage: ${percentage}%`
                                        );
                                        break;
                                    }
                                }

                                // If still no device, try UPS
                                if (!this._primaryDevice) {
                                    for (let i = 0; i < devices.length; i++) {
                                        let [device_id, , , device_kind, , percentage, , ,] = devices[i];
                                        if (device_kind == UPDeviceKind.UPS) {
                                            this._primaryDevice = devices[i];
                                            this._debugLog(
                                                `Primary device set as UPS fallback: ${device_id}, percentage: ${percentage}%`
                                            );
                                            break;
                                        }
                                    }
                                }
                            }

                            // First pass - detect all devices and their states
                            for (let i = 0; i < devices.length; i++) {
                                let [
                                    device_id,
                                    vendor,
                                    model,
                                    device_kind,
                                    icon,
                                    percentage,
                                    state,
                                    battery_level,
                                    seconds,
                                ] = devices[i];

                                // AC adapter detection
                                if (device_kind == UPDeviceKind.LINE_POWER) {
                                    acConnected =
                                        state == UPDeviceState.FULLY_CHARGED ||
                                        state == UPDeviceState.CHARGING ||
                                        state != UPDeviceState.UNKNOWN;
                                    this._debugLog(
                                        `AC adapter detected: ${device_id}, state=${state}, acConnected=${acConnected}`
                                    );
                                    continue; // Skip further processing for AC devices
                                }

                                // Collecting battery devices for analysis
                                if (device_kind == UPDeviceKind.BATTERY && state != UPDeviceState.UNKNOWN) {
                                    batteryDevices.push(devices[i]);
                                    this._checkBatteryStatus(
                                        device_id,
                                        vendor,
                                        model,
                                        device_kind,
                                        percentage,
                                        state,
                                        battery_level
                                    );
                                }
                            }

                            // **NEW LOGIC: Fallback AC detection via battery state**
                            let acConnectedFromBattery = null;
                            if (batteryDevices.length > 0) {
                                // If there are batteries, check if they're charging (charging = AC connected)
                                let chargingCount = 0;
                                let dischargingCount = 0;

                                for (let batteryDevice of batteryDevices) {
                                    let [, , , , , , state, ,] = batteryDevice;
                                    if (state == UPDeviceState.CHARGING || state == UPDeviceState.FULLY_CHARGED) {
                                        chargingCount++;
                                    } else if (state == UPDeviceState.DISCHARGING) {
                                        dischargingCount++;
                                    }
                                }

                                // Determine AC status based on battery state
                                if (chargingCount > 0) {
                                    acConnectedFromBattery = true; // At least one battery charging = AC connected
                                } else if (dischargingCount > 0) {
                                    acConnectedFromBattery = false; // All batteries discharging = AC disconnected
                                }

                                this._debugLog(
                                    `Battery state analysis: charging=${chargingCount}, discharging=${dischargingCount}, acFromBattery=${acConnectedFromBattery}`
                                );
                            }

                            // Use battery fallback if LINE_POWER doesn't work properly
                            let finalAcState = acConnected;
                            if (!acConnected && acConnectedFromBattery === true) {
                                this._debugLog(
                                    `LINE_POWER shows disconnected, but battery is charging - using battery fallback`
                                );
                                finalAcState = true;
                            } else if (acConnected && acConnectedFromBattery === false) {
                                this._debugLog(
                                    `LINE_POWER shows connected, but battery is discharging - using battery fallback`
                                );
                                finalAcState = false;
                            } else if (acConnectedFromBattery !== null) {
                                this._debugLog(`Using battery state as AC indicator: ${acConnectedFromBattery}`);
                                finalAcState = acConnectedFromBattery;
                            }

                            this._debugLog(
                                `Final AC state: LINE_POWER=${acConnected}, Battery=${acConnectedFromBattery}, Final=${finalAcState}`
                            );

                            this._debugLog(
                                `Analysis complete - acConnected: ${acConnected}, batteryDevices: ${batteryDevices.length}`
                            );

                            // NEW: Only call power state check AFTER _primaryDevice is set
                            this._debugLog(
                                `Power state check - primaryDevice: ${this._primaryDevice ? "set" : "null"}`
                            );
                            this._checkPowerSourceChange(finalAcState);

                            // Now process devices for display (existing logic)
                            for (let i = 0; i < devices.length; i++) {
                                let [
                                    device_id,
                                    vendor,
                                    model,
                                    device_kind,
                                    icon,
                                    percentage,
                                    state,
                                    battery_level,
                                    seconds,
                                ] = devices[i];

                                // Ignore LINE_POWER devices
                                if (device_kind == UPDeviceKind.LINE_POWER) continue;

                                // Ignore devices which state is unknown
                                if (state == UPDeviceState.UNKNOWN) continue;

                                if (reportsPreciseLevels(battery_level)) {
                                    // Devices that give accurate % charge will return this for battery level.
                                    pct_support_count++;
                                }

                                let stats = "%s (%d%%)".format(deviceKindToString(device_kind), percentage);
                                devices_stats.push(stats);
                                _devices.push(devices[i]);

                                if (this._primaryDeviceId == null || this._primaryDeviceId == device_id) {
                                    // NEW: Fallback logic only if primary device wasn't set earlier
                                    if (this._primaryDevice == null) {
                                        if (device_kind == UPDeviceKind.BATTERY) {
                                            this._primaryDevice = devices[i];
                                            this._debugLog(
                                                `Primary device set as fallback: ${device_id}, percentage: ${percentage}%`
                                            );
                                        } else if (device_kind == UPDeviceKind.UPS) {
                                            this._primaryDevice = devices[i];
                                            this._debugLog(
                                                `Using UPS as fallback primary device: ${device_id}, percentage: ${percentage}%`
                                            );
                                        }
                                    }
                                }

                                let status = this._getDeviceStatus(devices[i]);
                                let item = new DeviceItem(devices[i], status, this.aliases);
                                this.menu.addMenuItem(item, position);
                                _deviceItems.push(item);
                                position++;
                            }
                        } else {
                            global.logError(error);
                        }

                        this._devices = _devices;
                        this._deviceItems = _deviceItems;

                        // GCF3 - changed because: Moved _updateCapabilities() to the end of the processing cycle to avoid redundancy and ensure it's called only once
                        // Update capabilities after devices are processed
                        this._updateCapabilities();

                        // The menu is built. Below, we update the information present in the panel (icon, tooltip and label)
                        this.set_applet_enabled(true);
                        let panel_device = null;

                        // Things should only ever be in the panel if they provide accurate reporting (percentages), otherwise
                        // they're probably not likely to drain quickly enough to merit showing except on demand, in the popup menu.

                        // One or more devices, one is a real battery, and multi-device is disabled
                        if (
                            this._primaryDevice != null &&
                            (!this.showmulti || (this._devices.length === 1 && pct_support_count === 1))
                        ) {
                            this.showDeviceInPanel(this._primaryDevice);
                        } else {
                            // One device, not marked primary, but has accurate reporting (not sure this will ever happen).
                            if (this._devices.length === 1 && pct_support_count === 1) {
                                this.showDeviceInPanel(this._devices[0]);
                            } else if (this._devices.length > 0) {
                                // Show a summary
                                let labelText = "";
                                if (this.labelinfo !== "nothing") {
                                    let num = 0;

                                    for (let i = 0; i < this._devices.length; i++) {
                                        let [, , , , , percentage, , battery_level, seconds] = this._devices[i];

                                        // Skip devices without accurate reporting
                                        if (!reportsPreciseLevels(battery_level)) {
                                            continue;
                                        }

                                        // Only number them if we'll have multiple items
                                        if (pct_support_count > 1) {
                                            labelText += num++ + ": ";
                                        }

                                        if (this.labelinfo == "time" && seconds !== 0) {
                                            let time = Math.round(seconds / 60);
                                            let minutes = time % 60;
                                            let hours = Math.floor(time / 60);
                                            labelText += C_("time of battery remaining", "%d:%02d").format(
                                                hours,
                                                minutes
                                            );
                                        } else if (
                                            this.labelinfo == "percentage" ||
                                            (this.labelinfo == "percentage_time" && seconds === 0)
                                        ) {
                                            labelText += C_("percent of battery remaining", "%d%%").format(
                                                Math.round(percentage)
                                            );
                                        } else if (this.labelinfo == "percentage_time") {
                                            let time = Math.round(seconds / 60);
                                            let minutes = Math.floor(time % 60);
                                            let hours = Math.floor(time / 60);
                                            labelText +=
                                                C_("percent of battery remaining", "%d%%").format(
                                                    Math.round(percentage)
                                                ) +
                                                " (" +
                                                C_("time of battery remaining", "%d:%02d").format(hours, minutes) +
                                                ")";
                                        }

                                        // Only add a gap if we have remaining valid devices to show.
                                        if (num < pct_support_count) {
                                            labelText += "  ";
                                        }
                                    }
                                }

                                this.set_applet_tooltip(devices_stats.join(", "));
                                this.set_applet_label(labelText);
                                let icon = this._proxy.Icon;
                                if (icon) {
                                    if (icon != this.panel_icon_name) {
                                        this.panel_icon_name = icon;
                                        this.set_applet_icon_symbolic_name("battery-full");
                                        let gicon = Gio.icon_new_for_string(icon);
                                        this._applet_icon.gicon = gicon;
                                    }
                                } else {
                                    if (this.panel_icon_name != "battery-full") {
                                        this.panel_icon_name = "battery-full";
                                        this.set_applet_icon_symbolic_name("battery-full");
                                    }
                                }
                            } else {
                                // If there are no battery devices, show brightness info or disable the applet
                                this.set_applet_label("");
                                if (this.brightness.actor.visible) {
                                    // Show the brightness info
                                    this.set_applet_tooltip(_("Brightness"));
                                    this.panel_icon_name = "display-brightness";
                                    this.set_applet_icon_symbolic_name("display-brightness");
                                } else if (this.keyboard.actor.visible) {
                                    // Show the brightness info
                                    this.set_applet_tooltip(_("Keyboard backlight"));
                                    this.panel_icon_name = "keyboard-brightness";
                                    this.set_applet_icon_symbolic_name("keyboard-brightness");
                                } else {
                                    // Disable the applet
                                    this.set_applet_enabled(false);
                                }
                            }
                        }

                        // Update applet visibility after processing devices
                        this._updateAppletVisibility();
                        this._pendingDeviceUpdate = false; // Clear flag after completion
                    })
                );
            })
        );
    }

    /**
     * Checks brightness support status and logs the result.
     */
    _checkBrightnessSupport() {
        if (this.brightness && this.brightness.actor) {
            // Check if brightness slider is visible (means it's supported)
            let supported = this.brightness.actor.visible;

            // Only log if support status has changed
            if (this._brightnessSupported !== supported) {
                this._brightnessSupported = supported;
                global.log(`[powerman] Screen brightness support: ${supported ? "YES" : "NO"}`);

                // Additionally check keyboard brightness
                if (this.keyboard && this.keyboard.actor) {
                    let kbSupported = this.keyboard.actor.visible;
                    global.log(`[powerman] Keyboard brightness support: ${kbSupported ? "YES" : "NO"}`);
                }

                // Update capabilities after brightness check
                this._updateCapabilities();
            }
        }
    }

    /**
     * Enhanced brightness setting with proper error handling
     */
    _setBrightnessIfSupported(value) {
        if (!this._capabilities.hasBrightness || !this.brightness || !this.brightness._proxy) {
            this._debugLog(`Brightness not supported - skipping brightness change to ${value}%`);
            return false;
        }

        try {
            this.brightness._setBrightness(value);
            this._debugLog(`Successfully set brightness to ${value}%`);
            return true;
        } catch (e) {
            this._debugLog(`Error setting brightness to ${value}%: ${e.message}`);
            return false;
        }
    }

    /**
     * Get current battery level from primary device (with safety check)
     */
    _getCurrentBatteryLevel() {
        // NEW: Debug logging for 'this' object to inspect capabilities and primary device
        this._debugLog(
            `Debug 'this' in _getCurrentBatteryLevel(): capabilities=${JSON.stringify(
                this._capabilities
            )}, primaryDevice=${this._primaryDevice ? "exists" : "null"}`
        );

        if (!this._capabilities.hasBattery || !this._primaryDevice) {
            this._debugLog("No battery capability or no primary device - cannot get battery level");
            return null;
        }

        try {
            let [, , , , , percentage, , ,] = this._primaryDevice;
            this._debugLog(`Current battery level: ${percentage}%`);
            return Math.round(percentage);
        } catch (e) {
            this._debugLog(`Error getting battery level: ${e.message}`);
            return null;
        }
    }

    /**
     * Enhanced power source change detection with device capability awareness
     */
    _checkPowerSourceChange(currentAcState) {
        this._debugLog(`Power state check: current=${currentAcState}, last=${this._lastPowerState}`);
        this._debugLog(
            `Capabilities: battery=${this._capabilities.hasBattery}, brightness=${this._capabilities.hasBrightness}, profiles=${this._capabilities.hasPowerProfiles}`
        );

        // Force automation on applet restart/initialization
        let forceOnRestart = this._lastPowerState !== null && !this._hasRunInitialCheck;
        if (forceOnRestart) {
            this._hasRunInitialCheck = true;
            this._debugLog("Forcing automation on applet restart");
        }

        // Ensure checks on restart / suspend because power source could change meanwhile
        if (this._lastPowerState === null || this._lastPowerState !== currentAcState || forceOnRestart) {
            if (currentAcState) {
                this._log(_("Switched to AC power"));
                this._debugLog("Calling _applyAcSettings()");
                this._applyAcSettings();
            } else {
                this._log(_("Switched to battery power"));
                this._debugLog("Calling _applyBatterySettings()");
                this._applyBatterySettings();
            }
        } else {
            this._debugLog(`No power state change detected - skipping automation`);
        }
        this._lastPowerState = currentAcState;
    }

    /**
     * Tracks battery status and logs important changes.
     * @param {string} deviceId - Device identifier
     * @param {string} vendor - Device vendor
     * @param {string} model - Device model
     * @param {number} deviceKind - Device kind
     * @param {number} percentage - Battery percentage
     * @param {number} state - Device state (charging, discharging, etc.)
     * @param {number} batteryLevel - Battery level enum
     */
    _checkBatteryStatus(deviceId, vendor, model, deviceKind, percentage, state, batteryLevel) {
        let lastState = this._batteryStates.get(deviceId);
        let currentState = {
            percentage: Math.round(percentage),
            state: state,
            batteryLevel: batteryLevel,
        };

        if (lastState) {
            // Check for significant percentage changes (every 5%)
            let percentageDiff = Math.abs(lastState.percentage - currentState.percentage);
            if (percentageDiff >= 5) {
                this._debugLog(`Battery ${deviceId}: ${lastState.percentage}% → ${currentState.percentage}%`);
            }

            // Check low/critical levels
            this._checkBatteryLevels(deviceId, vendor, model, deviceKind, currentState, lastState);

            // Check state changes (charging/discharging)
            if (lastState.state !== currentState.state) {
                let stateMsg = this._getStateMessage(currentState.state);
                this._debugLog(`Battery ${deviceId} state changed: ${stateMsg}`);
            }
        }

        this._batteryStates.set(deviceId, currentState);
    }

    /**
     * Enhanced battery level checking with notifications (only if notifications enabled)
     * @param {string} deviceId - Device identifier
     * @param {string} vendor - Device vendor
     * @param {string} model - Device model
     * @param {number} deviceKind - Device kind
     * @param {Object} current - Current battery state
     * @param {Object} last - Last battery state
     */
    _checkBatteryLevels(deviceId, vendor, model, deviceKind, current, last) {
        // Only proceed if we have battery capability
        if (!this._capabilities.hasBattery) {
            return;
        }

        // Get user-friendly device name
        const deviceName = this._getDeviceDisplayName(deviceId, vendor, model, deviceKind);

        // Critical level (usually below 5%)
        if (current.percentage <= 5 && last.percentage > 5) {
            this._log(_("CRITICAL: Battery %s critically low (%d%%)").format(deviceName, current.percentage));
            this._notify(
                _("Critical Battery"),
                _("Battery %s critically low (%d%%)").format(deviceName, current.percentage)
            );
        }

        // Low level (usually below 15%)
        if (current.percentage <= 15 && last.percentage > 15) {
            this._log(_("LOW: Battery %s low (%d%%)").format(deviceName, current.percentage));
            this._notify(_("Low Battery"), _("Battery %s low (%d%%)").format(deviceName, current.percentage));
        }

        // Auto power-saver on low battery (if not already handled in _applyBatterySettings)
        if (
            this.enableBatterySaver &&
            current.percentage <= this.batteryLowThreshold &&
            last.percentage > this.batteryLowThreshold &&
            this._capabilities.hasPowerProfiles &&
            !this._lastPowerState // Only on battery power
        ) {
            try {
                this._changeProfile("power-saver");
                this._logAutomation(_("Auto-enabled power saver (battery low: %d%%)").format(current.percentage));
            } catch (e) {
                this._debugLog(`Error enabling power-saver on low battery: ${e.message}`);
            }
        }

        // Battery level enum checks
        if (current.batteryLevel !== last.batteryLevel) {
            if (current.batteryLevel === UPDeviceLevel.CRITICAL) {
                this._log(_("CRITICAL: Battery %s critically low").format(deviceName));
                this._notify(_("Critical Battery"), _("Battery %s critically low").format(deviceName));
            } else if (current.batteryLevel === UPDeviceLevel.LOW) {
                this._log(_("LOW: Battery %s low").format(deviceName));
                this._notify(_("Low Battery"), _("Battery %s low").format(deviceName));
            }
        }
    }

    /**
     * Gets user-friendly display name for a device
     * @param {string} deviceId - UPower device ID
     * @param {string} vendor - Device vendor
     * @param {string} model - Device model
     * @param {number} deviceKind - UPower device kind
     * @returns {string} Human-readable device name
     */
    _getDeviceDisplayName(deviceId, vendor, model, deviceKind) {
        // For battery devices, use generic or vendor+model name
        if (deviceKind === UPDeviceKind.BATTERY) {
            if (vendor && model && vendor.trim() && model.trim()) {
                return `${vendor.trim()} ${model.trim()}`;
            }
            return _("Battery");
        }

        // For other devices, prefer vendor+model or fallback to device type
        if (vendor && model && vendor.trim() && model.trim()) {
            return `${vendor.trim()} ${model.trim()}`;
        }

        // Fallback to generic device type names
        switch (deviceKind) {
            case UPDeviceKind.UPS:
                return _("UPS");
            case UPDeviceKind.LINE_POWER:
                return _("AC Adapter");
            default:
                return _("Power Device");
        }
    }

    /**
     * Converts device state enum to readable message.
     * @param {number} state - UPower device state
     * @returns {string} Human-readable state message
     */
    _getStateMessage(state) {
        switch (state) {
            case UPDeviceState.CHARGING:
                return "Charging";
            case UPDeviceState.DISCHARGING:
                return "Discharging";
            case UPDeviceState.FULLY_CHARGED:
                return "Fully charged";
            case UPDeviceState.EMPTY:
                return "Empty";
            default:
                return "Unknown state";
        }
    }

    /**
     * Handles settings changes and updates automation state.
     */
    _onSettingsChanged() {
        this._debugLog(`Settings changed - current automation settings:`);
        this._debugLog(`  - enableBrightnessAuto: ${this.enableBrightnessAuto}`);
        this._debugLog(`  - acBrightness: ${this.acBrightness}%`);
        this._debugLog(`  - batteryBrightness: ${this.batteryBrightness}%`);
        this._debugLog(`  - enableProfileAuto: ${this.enableProfileAuto}`);
        this._debugLog(`  - acPowerProfile: ${this.acPowerProfile}`);
        this._debugLog(`  - batteryPowerProfile: ${this.batteryPowerProfile}`);
        this._debugLog(`  - enableBatterySaver: ${this.enableBatterySaver}`);
        this._debugLog(`  - batteryLowThreshold: ${this.batteryLowThreshold}%`);
        this._debugLog(`  - debugLogging: ${this.debugLogging}`);

        this._updateCapabilities();
    }

    /**
     * Handles dim setting changes and updates dconf.
     */
    _onDimSettingChanged() {
        try {
            this._dconfSettings.set_boolean("idle-dim-ac", this.dimOnAc);
            this._dconfSettings.set_boolean("idle-dim-battery", this.dimOnBattery);
            this._dconfSettings.set_int("idle-dim-time", this.dimIdleTime);
            this._dconfSettings.set_int("idle-brightness", this.dimIdleBrightness);
            this._debugLog(
                `Updated dconf dim settings: AC=${this.dimOnAc}, Battery=${this.dimOnBattery}, Time=${this.dimIdleTime}s, Level=${this.dimIdleBrightness}%`
            );
        } catch (e) {
            global.logError(`Failed to update dconf dim settings: ${e.message}`);
        }
    }

    /**
     * Handles system tray setting changes.
     */
    _onSystemTraySettingChanged() {
        this._updateSystemTrayReplacement();
        this._debugLog(`System tray replacement changed: ${this.replaceSystemTrayIcon}`);
    }

    /**
     * Handles hide icon setting changes.
     */
    _onHideIconSettingChanged() {
        this._updateAppletVisibility();
        this._debugLog(`Applet icon visibility changed: hidden=${this.hideAppletIcon}`);
    }

    /**
     * Updates system tray icon replacement based on settings.
     * Uses clean applet enable/disable approach instead of hiding.
     */
    _updateSystemTrayReplacement() {
        if (this.replaceSystemTrayIcon) {
            this._disableSystemPowerApplets();
        } else {
            this._enableSystemPowerApplets();
        }
    }

    /**
     * Cleanly disables system power applets by removing them from enabled list.
     */
    _disableSystemPowerApplets() {
        try {
            let panelSettings = new Gio.Settings({ schema_id: "org.cinnamon" });
            let enabledApplets = panelSettings.get_strv("enabled-applets");

            // Store original applets for restoration (only if not already stored)
            if (this._originalPowerApplets.length === 0) {
                this._originalPowerApplets = [];
                let cleanedApplets = [];

                for (let appletEntry of enabledApplets) {
                    // Check for default power applets (power@cinnamon.org, battery@cinnamon.org)
                    if (appletEntry.includes("power@cinnamon.org") || appletEntry.includes("battery@cinnamon.org")) {
                        if (!this._originalPowerApplets.includes(appletEntry)) {
                            // Avoid duplicates
                            this._originalPowerApplets.push(appletEntry);
                        }
                        this._debugLog(`Disabled system power applet: ${appletEntry}`);
                    } else {
                        cleanedApplets.push(appletEntry);
                    }
                }

                if (this._originalPowerApplets.length > 0) {
                    // Update the enabled applets list without power applets
                    panelSettings.set_strv("enabled-applets", cleanedApplets);
                    // NEW: Save to settings for persistence
                    this.settings.setValue("original-power-applets", this._originalPowerApplets);
                    this._debugLog(
                        `Successfully disabled ${this._originalPowerApplets.length} system power applets and saved to settings`
                    );

                    // No restart needed - Cinnamon automatically applies changes
                    this._notify(_("Power Applet"), _("System power applet disabled. Using PowerMan instead."));
                } else {
                    this._debugLog("No system power applets found to disable");
                }
            } else {
                this._debugLog("System power applets already disabled");
            }
        } catch (e) {
            this._debugLog(`Error disabling system power applets: ${e.message}`);
            this._notify(_("Error"), _("Could not disable system power applet"));
        }
    }

    /**
     * Re-enables previously disabled system power applets.
     */
    _enableSystemPowerApplets() {
        try {
            if (!this._originalPowerApplets || this._originalPowerApplets.length === 0) {
                this._debugLog("No system power applets to restore");
                return;
            }

            let panelSettings = new Gio.Settings({ schema_id: "org.cinnamon" });
            let enabledApplets = panelSettings.get_strv("enabled-applets");

            // Add back the original power applets (bez duplikata)
            let restoredApplets = [...enabledApplets];
            for (let originalApplet of this._originalPowerApplets) {
                if (!restoredApplets.includes(originalApplet)) {
                    restoredApplets.push(originalApplet);
                }
            }
            panelSettings.set_strv("enabled-applets", restoredApplets);

            this._debugLog(`Successfully restored ${this._originalPowerApplets.length} system power applets`);
            this._notify(_("Power Applet"), _("System power applet re-enabled. Both applets are now active."));

            // Clear the stored applets and save settings
            this._originalPowerApplets = [];
            this.settings.setValue("original-power-applets", []);
        } catch (e) {
            this._debugLog(`Error restoring system power applets: ${e.message}`);
            this._notify(_("Error"), _("Could not restore system power applet"));
        }
    }

    /**
     * Updates applet visibility based on hide setting.
     */
    _updateAppletVisibility() {
        if (this.hideAppletIcon) {
            this.actor.hide();
            this._debugLog("Applet icon hidden - automation continues in background");
        } else {
            this.actor.show();
            this._debugLog("Applet icon shown");
        }
    }

    /**
     * Updates capabilities based on current hardware detection.
     * FIXED: Safer capability updates with proper error handling
     */
    _updateCapabilities() {
        let oldCapabilities = { ...this._capabilities };

        this._capabilities.hasBrightness = this.brightness && this.brightness.actor && this.brightness.actor.visible;
        this._capabilities.hasKeyboard = this.keyboard && this.keyboard.actor && this.keyboard.actor.visible;
        this._capabilities.hasPowerProfiles =
            this._profilesProxy && this._profilesProxy.Profiles && this._profilesProxy.Profiles.length > 0;
        this._capabilities.hasBattery = this._devices && this._devices.length > 0;

        // NEW: Auto-set hideAppletIcon if no relevant hardware support
        let shouldHide =
            !this._capabilities.hasBattery && !this._capabilities.hasBrightness && !this._capabilities.hasKeyboard; // && !this._capabilities.hasPowerProfiles;
        if (shouldHide) {
            this.settings.setValue("hide-applet-icon", true);
            this._autoHidden = true;
            this._debugLog("Auto-hiding applet icon due to no hardware support");
        } else if (this._autoHidden) {
            // Only reset if it was previously auto-hidden
            this.settings.setValue("hide-applet-icon", false);
            this._autoHidden = false;
            this._debugLog("Showing applet icon due to available hardware support");
        }

        // Update settings visibility based on capabilities with error handling
        try {
            let newBrightnessAvailable = this._capabilities.hasBrightness;
            let newPowerControlAvailable = this._capabilities.hasPowerProfiles && this._capabilities.hasBattery;
            let newBatteryAvailable = this._capabilities.hasBattery;

            // Only update if values actually changed
            if (this.brightnessAvailable !== newBrightnessAvailable) {
                this.settings.setValue("brightness-available", newBrightnessAvailable);
                this.settings.setValue("brightness-not-available", !newBrightnessAvailable);
                this._debugLog(`Brightness sections visibility: ${newBrightnessAvailable}`);
            }

            if (this.powerControlAvailable !== newPowerControlAvailable) {
                this.settings.setValue("power-control-available", newPowerControlAvailable);
                this.settings.setValue("power-control-not-available", !newPowerControlAvailable);
                this._debugLog(`Power control sections visibility: ${newPowerControlAvailable}`);
            }

            if (this.batteryAvailable !== newBatteryAvailable) {
                this.settings.setValue("battery-available", newBatteryAvailable);
                this._debugLog(`Battery sections visibility: ${newBatteryAvailable}`);
            }
        } catch (e) {
            this._debugLog(`Error updating capability settings: ${e.message}`);
        }

        this._debugLog(`Capabilities updated:`);
        this._debugLog(`  - Screen Brightness: ${oldCapabilities.hasBrightness} → ${this._capabilities.hasBrightness}`);
        this._debugLog(`  - Keyboard Backlight: ${oldCapabilities.hasKeyboard} → ${this._capabilities.hasKeyboard}`);
        this._debugLog(
            `  - PowerProfiles: ${oldCapabilities.hasPowerProfiles} → ${this._capabilities.hasPowerProfiles}`
        );
        this._debugLog(`  - Battery: ${oldCapabilities.hasBattery} → ${this._capabilities.hasBattery}`);
    }

    /**
     * Applies AC power settings with consolidated notification and capability checks
     */
    _applyAcSettings() {
        let actions = [];

        // Brightness automation - only if supported
        if (this.enableBrightnessAuto) {
            if (this._setBrightnessIfSupported(this.acBrightness)) {
                actions.push(_("brightness %d%%").format(this.acBrightness));
            }
        }

        // Power profile automation - only if supported
        if (this.enableProfileAuto && this._capabilities.hasPowerProfiles) {
            try {
                this._changeProfile(this.acPowerProfile);
                actions.push(_("power profile %s").format(_(POWER_PROFILES[this.acPowerProfile])));
                this._debugLog(`Set AC power profile to: ${this.acPowerProfile}`);
            } catch (e) {
                this._debugLog(`Error setting AC power profile: ${e.message}`);
            }
        }

        // Send consolidated notification only if actions were performed
        if (actions.length > 0) {
            let message = _("AC power: ") + actions.join(", ");
            this._logAutomation(message);
        } else {
            // Log that we switched to AC but no automation was applied
            this._log(_("Switched to AC power (no automation applied)"));
        }
    }

    /**
     * Applies battery power settings with low battery check and capability checks
     */
    _applyBatterySettings() {
        let actions = [];
        let batteryLevel = this._getCurrentBatteryLevel();
        let isLowBattery = batteryLevel !== null && batteryLevel <= this.batteryLowThreshold;

        // Only proceed if we actually have battery devices
        if (!this._capabilities.hasBattery) {
            this._log(_("Switched to battery power (no battery devices detected)"));
            return;
        }

        // Brightness automation - only if supported
        if (this.enableBrightnessAuto) {
            if (this._setBrightnessIfSupported(this.batteryBrightness)) {
                actions.push(_("brightness %d%%").format(this.batteryBrightness));
            }
        }

        // Check for low battery and force power-saver if enabled
        if (this.enableBatterySaver && isLowBattery && this._capabilities.hasPowerProfiles) {
            try {
                this._changeProfile("power-saver");
                actions.push(_("power-saver mode (battery low: %d%%)").format(batteryLevel));
                this._debugLog(`Forced power-saver due to low battery: ${batteryLevel}%`);
            } catch (e) {
                this._debugLog(`Error setting power-saver mode: ${e.message}`);
            }
        } else {
            // Power profile automation (only if not forced to power-saver)
            if (this.enableProfileAuto && this._capabilities.hasPowerProfiles) {
                try {
                    this._changeProfile(this.batteryPowerProfile);
                    actions.push(_("power profile %s").format(_(POWER_PROFILES[this.batteryPowerProfile])));
                    this._debugLog(`Set battery power profile to: ${this.batteryPowerProfile}`);
                } catch (e) {
                    this._debugLog(`Error setting battery power profile: ${e.message}`);
                }
            }
        }

        // Send consolidated notification only if actions were performed
        if (actions.length > 0) {
            let message = _("Battery power: ") + actions.join(", ");
            this._logAutomation(message);
        } else {
            // Log that we switched to battery but no automation was applied
            this._log(_("Switched to battery power (no automation applied)"));
        }
    }

    /**
     * Cleans up when the applet is removed from the panel.
     */
    on_applet_removed_from_panel() {
        // Always restore system power applets when our applet is removed
        this._enableSystemPowerApplets();

        // Clean up DBus connections
        if (this._proxy) {
            try {
                this._proxy.disconnect_all(); // ili zapamti connection ID-jeve
            } catch (e) {}
        }

        // Clean up power profiles
        if (this._proxyId && this._profilesProxy) {
            this._profilesProxy.disconnect(this._proxyId);
        }

        // Clean up CSD power watch
        if (this.csd_power_watch_id > 0) {
            Gio.bus_unwatch_name(this.csd_power_watch_id);
            this.csd_power_watch_id = 0;
        }

        // Clean up brightness sliders
        if (this.brightness) {
            try {
                this.brightness.destroy();
            } catch (e) {}
        }

        if (this.keyboard) {
            try {
                this.keyboard.destroy();
            } catch (e) {}
        }

        // Finalize settings
        if (this.settings) {
            this.settings.finalize();
        }
    }
}

/**
 * Applet entry point. Instantiates the CinnamonPowerApplet.
 * @param {object} metadata
 * @param {number} orientation
 * @param {number} panel_height
 * @param {string} instanceId
 * @returns {CinnamonPowerApplet}
 */
function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonPowerApplet(metadata, orientation, panel_height, instanceId);
}
