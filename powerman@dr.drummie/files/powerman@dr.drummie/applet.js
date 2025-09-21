// PowerMan - Enhanced Power Applet - powerman@dr.drummie
// Simplified with Manager-based Architecture
// Minimal changes to original power@cinnamon.org applet code with automated functionality via managers

// Usual suspects for applet
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
const UUID = "powerman@dr.drummie";
const LOCALE_DIR = GLib.get_home_dir() + "/.local/share/locale";

// Import the refactored framework
const Framework = require("./powerman-framework.js");

// Original constants from power applet
const BrightnessBusName = "org.cinnamon.SettingsDaemon.Power.Screen";
const KeyboardBusName = "org.cinnamon.SettingsDaemon.Power.Keyboard";
const CSD_BACKLIGHT_NOT_SUPPORTED_CODE = 1;
const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

// UPower enums
const {
    DeviceKind: UPDeviceKind,
    DeviceLevel: UPDeviceLevel,
    DeviceState: UPDeviceState,
    Device: UPDevice,
} = UPowerGlib;

// Set up translations
Gettext.bindtextdomain(UUID, LOCALE_DIR);
function _(str) {
    let translated = Gettext.dgettext(UUID, str);
    return translated || str;
}

// Power profile names
const POWER_PROFILES = {
    "power-saver": _("Power Saver"),
    balanced: _("Balanced"),
    performance: _("Performance"),
};

// Utility functions (keep from original)
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
        case UPDeviceKind.BLUETOOTH_GENERIC:
            return _("Bluetooth device");
        default: {
            try {
                return UPDevice.kind_to_string(kind).replaceAll("-", " ").capitalize();
            } catch {
                return _("Unknown");
            }
        }
    }
}

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
            if (icon) return icon;
            else return "battery-full";
    }
}

function reportsPreciseLevels(battery_level) {
    return battery_level == UPDeviceLevel.NONE;
}

// Device item class (unchanged from original)
class DeviceItem extends PopupMenu.PopupBaseMenuItem {
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

// Brightness slider class (mostly unchanged from original)
class BrightnessSlider extends PopupMenu.PopupSliderMenuItem {
    constructor(applet, label, icon, busName, minimum_value) {
        super(0);
        this.actor.hide();

        // Bind debug logging method from applet
        this._debugLog = applet._debugLog
            ? applet._debugLog.bind(applet)
            : (msg) => global.log(`[BrightnessSlider] ${msg}`);
        this._busName = busName; // Store for debugging

        this._applet = applet;
        this._seeking = false;
        this._minimum_value = minimum_value;
        this._step = 0.05;
        this._internalChange = false; // Flag to prevent hook triggering on internal changes

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
        this._proxy.connectSignal("Changed", Lang.bind(this, this._getBrightness));
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
        this._setBrightness(Math.min(100, Math.round(v * 100)));
    }

    _getBrightness() {
        if (!this._seeking) this._getBrightnessForcedUpdate();
    }

    /**
     * Force update brightness from proxy, applying +1% correction for consistency
     */
    _getBrightnessForcedUpdate() {
        this._proxy.GetPercentageRemote(
            Lang.bind(this, function (b) {
                let bNum = Number(b); // Parse to number to avoid string concatenation
                let _b = bNum < 100 ? bNum + 1 : 100;
                //this._debugLog(`Brightness raw from ${this._busName}: ${bNum}, corrected: ${_b}`);
                //this._debugLog(`Brightness updated from ${this._busName}: ${_b}%`);
                this._updateBrightnessLabel(_b);
                this.setValue(_b / 100);
            })
        );
    }

    _setBrightness(value) {
        this._internalChange = true; // Mark as internal change
        this._proxy.SetPercentageRemote(
            value,
            Lang.bind(this, function (b, error) {
                this._debugLog(
                    `SetBrightness: sent ${value}%, received ${b}% (error: ${error ? error.message : "none"})`
                );
                this._updateBrightnessLabel(b);
            })
        );
    }

    _updateBrightnessLabel(value) {
        this.tooltipText = this.label;
        if (value) this.tooltipText += ": " + value + "%";
        this.tooltip.set_text(this.tooltipText);
        if (this._dragging) this.tooltip.show();

        // Trigger hook for brightness change in extension framework
        if (this._applet._extensionFramework && value && !this._internalChange) {
            this._applet._extensionFramework.triggerHook("brightness-changed", value);
        }
        this._internalChange = false; // Reset flag after processing
    }

    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.DOWN) {
            this._proxy.StepDownRemote(function () {});
        } else if (direction == Clutter.ScrollDirection.UP) {
            this._proxy.StepUpRemote(function () {});
        }
        this._getBrightnessForcedUpdate();
        this._slider.queue_repaint();
    }
}

/**
 * Main Enhanced Power Applet Class
 * STREAMLINED: Only essential bindings, managers handle automation
 */
class EnhancedCinnamonPowerApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.metadata = metadata;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);

        // === MINIMAL SETTINGS BINDING ===
        // Only bind essential display settings - automation handled by managers
        this.settings.bind("labelinfo", "labelinfo", this._devicesChanged);
        this.settings.bind("debug-logging", "debugLogging", this._onDebugSettingChanged);
        this.settings.bind("showmulti", "showmulti", this._devicesChanged);

        // Initialize logging
        this._initializeLogging();
        this._log("Enhanced Power Applet starting...");

        // === ORIGINAL POWER APPLET SETUP ===
        Main.systrayManager.registerTrayIconReplacement("power", metadata.uuid);
        Main.systrayManager.registerTrayIconReplacement("battery", metadata.uuid);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.aliases = global.settings.get_strv("device-aliases");
        this._deviceItems = [];
        this._devices = [];
        this._primaryDeviceId = null;
        this.panel_icon_name = "";

        // Menu setup
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.brightness = new BrightnessSlider(this, _("Brightness"), "display-brightness", BrightnessBusName, 0);
        this.keyboard = new BrightnessSlider(this, _("Keyboard backlight"), "keyboard-brightness", KeyboardBusName, 0);
        this.menu.addMenuItem(this.brightness);
        this.menu.addMenuItem(this.keyboard);

        // Power profiles setup
        this._setupPowerProfiles();

        // Menu actions
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Add automation switches (only if corresponding features are available)
        if (this.brightness) {
            this._brightnessAutoSwitch = new PopupMenu.PopupSwitchMenuItem(
                _("Brightness Automation"),
                this.settings.getValue("enable-brightness-auto")
            );
            this._brightnessAutoSwitchId = this._brightnessAutoSwitch.connect(
                "toggled",
                Lang.bind(this, this._onBrightnessAutoToggled)
            );
            this.menu.addMenuItem(this._brightnessAutoSwitch);
        }

        if (this._profilesProxy && this._profilesProxy.Profiles) {
            this._profileAutoSwitch = new PopupMenu.PopupSwitchMenuItem(
                _("Power Profile Automation"),
                this.settings.getValue("enable-profile-auto")
            );
            this._profileAutoSwitchId = this._profileAutoSwitch.connect(
                "toggled",
                Lang.bind(this, this._onProfileAutoToggled)
            );
            this.menu.addMenuItem(this._profileAutoSwitch);
        }

        // Add separator if either automation switch is present
        if (this._profileAutoSwitch || this._brightnessAutoSwitch) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        // Connect to setting changes to keep switches in sync (without binding)
        this._brightnessAutoChangedId = this.settings.connect(
            "changed::enable-brightness-auto",
            Lang.bind(this, this._onBrightnessAutoChanged)
        );
        this._profileAutoChangedId = this.settings.connect(
            "changed::enable-profile-auto",
            Lang.bind(this, this._onProfileAutoChanged)
        );

        // Add automation settings menu item
        let settingsItem = new PopupMenu.PopupMenuItem(_("Automation Settings"));
        settingsItem.connect(
            "activate",
            Lang.bind(this, function () {
                this.configureApplet();
            })
        );
        this.menu.addMenuItem(settingsItem);

        this.menu.addSettingsAction(_("Power Settings"), "power");

        // Event handlers
        this.actor.connect("scroll-event", Lang.bind(this, this._onScrollEvent));
        global.settings.connect("changed::" + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._onPanelEditModeChanged));

        // === DELAYED D-BUS CONNECTION SETUP ===
        // Add timeout to allow CSD Power service to start before attempting connection
        // This fixes early detection issues, especially in VM environments and laptops
        GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            500,
            Lang.bind(this, () => {
                this._setupDBusConnections();
                return false; // Run once
            })
        );

        this.set_show_label_in_vertical_panels(false);
        this._log("Enhanced Power Applet initialized");
    }

    // === LOGGING FUNCTIONS ===
    _initializeLogging() {
        this._debugLog("Debug logging initialized");
    }

    _log(msg) {
        let timestamp = new Date().toLocaleTimeString();
        global.log(`[powerman] [${timestamp}] ${msg}`);
    }

    _debugLog(msg) {
        if (this.debugLogging) {
            this._log(`[DEBUG] ${msg}`);
        }
    }

    _onDebugSettingChanged() {
        this._log(`Debug logging ${this.debugLogging ? "enabled" : "disabled"}`);
    }

    /**
     * Handle brightness automation switch toggle
     */
    _onBrightnessAutoToggled(sender, state) {
        this._debugLog(`Brightness automation toggled to: ${state}`);
        this.settings.setValue("enable-brightness-auto", state);
    }

    /**
     * Handle profile automation switch toggle
     */
    _onProfileAutoToggled(sender, state) {
        this._debugLog(`Profile automation toggled to: ${state}`);
        this.settings.setValue("enable-profile-auto", state);
    }

    /**
     * Handle brightness automation setting change from external source
     */
    _onBrightnessAutoChanged() {
        if (this._brightnessAutoSwitch) {
            this._brightnessAutoSwitch.setToggleState(this.settings.getValue("enable-brightness-auto"));
        }
    }

    /**
     * Handle profile automation setting change from external source
     */
    _onProfileAutoChanged() {
        if (this._profileAutoSwitch) {
            this._profileAutoSwitch.setToggleState(this.settings.getValue("enable-profile-auto"));
        }
    }

    // === NEW METHOD: SETUP D-BUS CONNECTIONS ===
    /**
     * Sets up D-Bus connections with improved error handling and retry logic.
     * This method is called after a delay to ensure services are ready.
     */
    _setupDBusConnections() {
        // D-Bus connection setup for CSD Power
        this._proxy = null;
        this.csd_power_watch_id = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            "org.cinnamon.SettingsDaemon.Power",
            0,
            Lang.bind(this, (c, name) => {
                Interfaces.getDBusProxyAsync(
                    "org.cinnamon.SettingsDaemon.Power",
                    Lang.bind(this, (proxy, error) => {
                        Gio.bus_unwatch_name(this.csd_power_watch_id);
                        this.csd_power_watch_id = 0;

                        if (error) {
                            // Log as debug instead of error if likely a VM/environment issue
                            this._debugLog(
                                `Could not connect to csd-power (may be expected in VM/laptop): ${error.message}`
                            );
                            return;
                        }

                        this._proxy = proxy;
                        this._proxy.connect("g-properties-changed", Lang.bind(this, this._devicesChanged));

                        global.settings.connect(
                            "changed::device-aliases",
                            Lang.bind(this, this._on_device_aliases_changed)
                        );

                        this._debugLog("Connected to CSD Power service");

                        // Initial device scan
                        this._devicesChanged();

                        // Still initialize framework even if proxy fails - like in enhanced version
                        if (!this._extensionFramework) {
                            this._initializeExtensionFramework();
                        }
                    })
                );
            }),
            null
        );
    }

    // === POWER PROFILES SETUP ===
    _setupPowerProfiles() {
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

            // Fallback to UPower if Hadess doesn't work
            if (!this._profilesProxy.Profiles) {
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
            this._debugLog("Power profiles initialized");
        } else {
            this._debugLog("Power profiles not available");
        }
    }

    // === EXTENSION FRAMEWORK INITIALIZATION ===
    _initializeExtensionFramework() {
        try {
            this._extensionFramework = new Framework.PowerAppletExtensionFramework(this);

            // Register Idle Manager first as it is needed by other managers
            this._extensionFramework.registerManager("idle", Framework.IdleManager);

            // Register all other managers
            this._extensionFramework.registerManager("battery", Framework.BatteryManager);
            this._extensionFramework.registerManager("brightness", Framework.BrightnessManager);
            this._extensionFramework.registerManager("power-automation", Framework.PowerAutomationManager);
            this._extensionFramework.registerManager("system", Framework.SystemManager);

            // Patch original applet to work with framework
            this._extensionFramework.patchOriginalApplet();

            this._log("Extension framework initialized with automation support");
        } catch (e) {
            global.logError("Failed to initialize extension framework: " + e.message);
        }
    }

    // === EVENT HANDLERS ===
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

    _on_device_aliases_changed() {
        this.aliases = global.settings.get_strv("device-aliases");
        this._devicesChanged();
    }

    _onButtonPressEvent(actor, event) {
        if (event.get_button() === 2) {
            this.keyboard._proxy.ToggleRemote(function () {});
        }
        return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.UP) {
            this.brightness._proxy.StepUpRemote(function () {});
        } else if (direction == Clutter.ScrollDirection.DOWN) {
            this.brightness._proxy.StepDownRemote(function () {});
        }
        this.brightness._getBrightnessForcedUpdate();
    }

    on_panel_height_changed() {
        if (this._proxy) this._devicesChanged();
    }

    // === DEVICE STATUS AND DISPLAY ===
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

    showDeviceInPanel(device) {
        let [device_id, vendor, model, device_kind, icon, percentage, state, battery_level, seconds] = device;
        let status = this._getDeviceStatus(device);
        this.set_applet_tooltip(status);

        let labelText = "";
        if (this.labelinfo == "nothing") {
            // Show nothing
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

    // === POWER PROFILES ===
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
    }

    _changeProfile(newProfile) {
        let oldProfile = this.ActiveProfile;
        this._profilesProxy.ActiveProfile = newProfile;
        this.ActiveProfile = this._profilesProxy.ActiveProfile;
        this._debugLog(`Power profile changed to: ${newProfile}`);
    }

    // === DEVICES CHANGED - Core functionality (mostly unchanged) ===
    _devicesChanged() {
        this._debugLog("Device scan started");

        this._devices = [];
        this._primaryDevice = null;
        this._primaryDeviceId = null;

        if (!this._proxy) return;

        // Get primary device
        this._proxy.GetPrimaryDeviceRemote(
            Lang.bind(this, function (device, error) {
                if (error) {
                    this._primaryDeviceId = null;
                } else {
                    if (device.length == 1) {
                        device = device[0];
                    }
                    let [device_id, vendor, model, device_kind, icon, percentage, state, battery_level, seconds] =
                        device;
                    this._primaryDeviceId = device_id;
                    this._debugLog(`Primary device: ${device_id}`);
                }

                // Scan all devices
                this._proxy.GetDevicesRemote(
                    Lang.bind(this, function (result, error) {
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

                            this._debugLog(
                                `Found ${devices.length} total devices: [${devices
                                    .map((device) => {
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
                                        ] = device;
                                        try {
                                            let kindStr = deviceKindToString(device_kind);
                                            let stateStr =
                                                state === UPDeviceState.CHARGING
                                                    ? "charging"
                                                    : state === UPDeviceState.DISCHARGING
                                                    ? "discharging"
                                                    : state === UPDeviceState.FULLY_CHARGED
                                                    ? "full"
                                                    : "other";
                                            return `${kindStr}(${Math.round(percentage)}%, ${stateStr})`;
                                        } catch (e) {
                                            return "unknown";
                                        }
                                    })
                                    .join(", ")}]`
                            );

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
                                // Ignore devices with unknown state
                                if (state == UPDeviceState.UNKNOWN) continue;

                                if (reportsPreciseLevels(battery_level)) {
                                    pct_support_count++;
                                }

                                let stats = "%s (%d%%)".format(deviceKindToString(device_kind), percentage);
                                devices_stats.push(stats);
                                _devices.push(devices[i]);

                                if (this._primaryDeviceId == null || this._primaryDeviceId == device_id) {
                                    if (device_kind == UPDeviceKind.BATTERY && this._primaryDevice == null) {
                                        this._primaryDevice = devices[i];
                                        this._debugLog(`Primary battery found: ${percentage}%`);
                                    }
                                }

                                let status = this._getDeviceStatus(devices[i]);
                                let item = new DeviceItem(devices[i], status, this.aliases);
                                this.menu.addMenuItem(item, position);
                                _deviceItems.push(item);
                                position++;
                            }

                            this._debugLog(`Processed ${_devices.length} display devices`);
                        } else {
                            global.logError(error);
                        }

                        this._devices = _devices;
                        this._deviceItems = _deviceItems;

                        // Panel display logic
                        this.set_applet_enabled(true);

                        if (
                            this._primaryDevice != null &&
                            (!this.showmulti || (this._devices.length === 1 && pct_support_count === 1))
                        ) {
                            this.showDeviceInPanel(this._primaryDevice);
                        } else {
                            if (this._devices.length === 1 && pct_support_count === 1) {
                                this.showDeviceInPanel(this._devices[0]);
                            } else if (this._devices.length > 0) {
                                // Show summary
                                this._showMultiDeviceSummary(devices_stats, pct_support_count);
                            } else {
                                // No battery devices - show brightness info or disable
                                this._showNoBatteryState();
                            }
                        }

                        // Trigger post-scan hook after devices are populated
                        if (this._extensionFramework) {
                            this._extensionFramework.triggerHook("device-scan-post", this._devices);
                        }

                        this._debugLog("Device scan completed");
                    })
                );
            })
        );
    }

    _showMultiDeviceSummary(devices_stats, pct_support_count) {
        let labelText = "";
        if (this.labelinfo !== "nothing") {
            let num = 0;

            for (let i = 0; i < this._devices.length; i++) {
                let [, , , , , percentage, , battery_level, seconds] = this._devices[i];

                if (!reportsPreciseLevels(battery_level)) {
                    continue;
                }

                if (pct_support_count > 1) {
                    labelText += num++ + ": ";
                }

                if (this.labelinfo == "time" && seconds !== 0) {
                    let time = Math.round(seconds / 60);
                    let minutes = time % 60;
                    let hours = Math.floor(time / 60);
                    labelText += C_("time of battery remaining", "%d:%02d").format(hours, minutes);
                } else if (this.labelinfo == "percentage" || (this.labelinfo == "percentage_time" && seconds === 0)) {
                    labelText += C_("percent of battery remaining", "%d%%").format(Math.round(percentage));
                } else if (this.labelinfo == "percentage_time") {
                    let time = Math.round(seconds / 60);
                    let minutes = Math.floor(time % 60);
                    let hours = Math.floor(time / 60);
                    labelText +=
                        C_("percent of battery remaining", "%d%%").format(Math.round(percentage)) +
                        " (" +
                        C_("time of battery remaining", "%d:%02d").format(hours, minutes) +
                        ")";
                }

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
    }

    _showNoBatteryState() {
        this.set_applet_label("");
        if (this.brightness.actor.visible) {
            this.set_applet_tooltip(_("Brightness"));
            this.panel_icon_name = "display-brightness";
            this.set_applet_icon_symbolic_name("display-brightness");
            this.set_applet_enabled(true);
        } else if (this.keyboard.actor.visible) {
            this.set_applet_tooltip(_("Keyboard backlight"));
            this.panel_icon_name = "keyboard-brightness";
            this.set_applet_icon_symbolic_name("keyboard-brightness");
            this.set_applet_enabled(true);
        } else {
            this.set_applet_enabled(false);
        }
    }

    // === CLEANUP ===
    /**
     * Cleanup method for proper signal disconnection
     */
    destroy() {
        // Disconnect brightness switch signal
        if (this._brightnessAutoSwitch && this._brightnessAutoSwitchId) {
            try {
                this._brightnessAutoSwitch.disconnect(this._brightnessAutoSwitchId);
                this._debugLog("Disconnected brightness switch signal");
            } catch (e) {
                this._debugLog(`Error disconnecting brightness switch: ${e.message}`);
            }
        }

        // Disconnect profile switch signal
        if (this._profileAutoSwitch && this._profileAutoSwitchId) {
            try {
                this._profileAutoSwitch.disconnect(this._profileAutoSwitchId);
                this._debugLog("Disconnected profile switch signal");
            } catch (e) {
                this._debugLog(`Error disconnecting profile switch: ${e.message}`);
            }
        }

        // Disconnect settings change signals
        if (this._brightnessAutoChangedId) {
            try {
                this.settings.disconnect(this._brightnessAutoChangedId);
                this._debugLog("Disconnected brightness setting change signal");
            } catch (e) {
                this._debugLog(`Error disconnecting brightness setting change: ${e.message}`);
            }
        }

        if (this._profileAutoChangedId) {
            try {
                this.settings.disconnect(this._profileAutoChangedId);
                this._debugLog("Disconnected profile setting change signal");
            } catch (e) {
                this._debugLog(`Error disconnecting profile setting change: ${e.message}`);
            }
        }

        // Call parent destroy if available
        if (super.destroy) {
            super.destroy();
        }

        this._debugLog("Applet destroyed");
    }

    on_applet_removed_from_panel() {
        this._log("Enhanced Power Applet shutting down");

        // Stop D-Bus watch
        if (this.csd_power_watch_id) {
            Gio.bus_unwatch_name(this.csd_power_watch_id);
            this.csd_power_watch_id = 0;
        }

        // Cleanup framework
        if (this._extensionFramework) {
            this._extensionFramework.destroy();
            this._extensionFramework = null;
        }

        // Original cleanup
        Main.systrayManager.unregisterTrayIconReplacement(this.metadata.uuid);
        if (this._proxyId && this._profilesProxy) {
            this._profilesProxy.disconnect(this._proxyId);
        }
        this._proxy = null;
        this._profilesProxy = null;
    }
}

// Applet entry point
function main(metadata, orientation, panel_height, instanceId) {
    return new EnhancedCinnamonPowerApplet(metadata, orientation, panel_height, instanceId);
}
