const Lang = imports.lang;
const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;

// l10n/translation support
const UUID = "ddcci-multi-monitor@tim-we";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const DEFAULT_TOOLTIP = _("Adjust monitor brightness via DDC/CI");

function log(message, type = "debug") {
    const finalLogMessage = `[${UUID}] ${message}`;

    if (type === "error") {
        global.logError(finalLogMessage);
    } else if (type === "warning") {
        global.logWarning(finalLogMessage);
    } else {
        global.log(finalLogMessage);
    }
}

class Monitor {
    #promises;
    constructor(index, name, bus, brightnessFeatureFlag, showBusNumber=false, isActive=false, showCheckbox=false) {
        this.index = index;
        this.name = name;
        this.brightness = 50;
        this.send_brightness = null;
        this.sent_brightness = null;
        this.bus = bus;
        this.menuLabel = null;
        this.menuSlider = null;
        this.menuCheckbox = null;
        this.brightnessFeatureFlag = brightnessFeatureFlag;
        this.showBusNumber = showBusNumber;
        this.isActive = isActive;
        this.showCheckbox = showCheckbox;
        this.#promises = Promise.resolve();
    }

    setShowBusNumber(showBusNumber) {
        this.showBusNumber = showBusNumber;
    }

    setShowCheckbox(showCheckbox) {
        this.showCheckbox = showCheckbox;
    }

    setActive(value) {
        this.isActive = value;
        if (this.menuCheckbox) {
            this.menuCheckbox.setToggleState(value);
        }
    }

    updateBrightness() {
        return new Promise((resolve) => {
            // get current brightness value
            const cmd = `ddcutil --bus=${this.bus} getvcp ${this.brightnessFeatureFlag}`;
            Util.spawnCommandLineAsyncIO(cmd, (stdout, stderr, exitCode) => {
                // guarantee resolve, even if the following code fails
                setTimeout(resolve, 500);

                if (exitCode == 0) {
                    // regex from ddcci-monitor-control@andr35
                    const matchRes = stdout.match(/current value =\s*(\d+)/);

                    if (matchRes[1]) {
                        this.brightness = parseInt(matchRes[1], 10);
                        this.updateMenu();
                    }
                } else {
                    log(
                        `cmd: "${cmd}" returned exit code ${exitCode}`,
                        "error"
                    );
                    log(stderr, "error");
                }
            });
        });
    }

    updateLabel() {
        if (this.showBusNumber) {
            this.menuLabel.setLabel(`${this.name} (bus ${this.bus})  (${this.brightness}%)`);
        } else {
            this.menuLabel.setLabel(`${this.name}  (${this.brightness}%)`);
        }
    }

    updateMenu() {
        this.updateLabel();
        this.menuSlider.setValue(this.brightness / 100);
    }

    setBrightness(value) {
        this.brightness = Math.round(value);
        this.send_brightness = this.brightness;
        this.updateMenu();
        this.#promises = this.#promises.then(() => {
            return new Promise((resolve, reject) => {
                setTimeout(resolve, 5000);
                this.trySetBrightness(resolve, reject, 16);
            });
        });
    }

    trySetBrightness(resolve, reject, attempts) {
        if (attempts <= 0) {
            log(`Failed to change brightness of ${this.name} after multiple attempts.`, "warning");
            return resolve();
        }
        const target_brightness = this.send_brightness;
        if (target_brightness !== this.sent_brightness) {
            Util.spawnCommandLineAsync(
                `ddcutil --bus=${this.bus} setvcp ${this.brightnessFeatureFlag} ${target_brightness}`,
                () => {
                    this.sent_brightness = target_brightness;
                    resolve();
                },
                () => {
                    this.trySetBrightness(resolve, reject, attempts - 1);
                },
            );
        } else {
            resolve();
        }
    }

    addToMenu(menu, saveActiveStateCallback) {
        // create & add label
        const menuLabel = new PopupMenu.PopupMenuItem(this.name, {
            reactive: false,
        });
        this.menuLabel = menuLabel;
        menu.addMenuItem(menuLabel);

        // create & add slider control
        const menuSlider = new PopupMenu.PopupSliderMenuItem(0.5);
        this.menuSlider = menuSlider;
        menuSlider.connect("value-changed", async (slider) => {
            const brightness = Math.round(100 * slider.value);
            this.brightness = brightness;
            this.updateLabel();
        });

        menuSlider.connect("drag-end", (slider) => {
            const brightness = Math.round(100 * slider.value);
            this.setBrightness(brightness);
        });

        menu.addMenuItem(menuSlider);

        // checkbox to mark active monitor
        if (this.showCheckbox) {
            const menuCheckbox = new PopupMenu.PopupSwitchMenuItem(_("Use for scroll/click"), this.isActive);
            this.menuCheckbox = menuCheckbox;
            menu.addMenuItem(menuCheckbox);

            menuCheckbox.connect("toggled", (item, state) => {
                this.isActive = state;
                saveActiveStateCallback(this.bus, state); // use bus number as key
            });
        }
    }
}

class DDCMultiMonitor extends Applet.TextIconApplet {

    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);

        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this._bind_settings();

        // load persistent settings for custom monitor selection
        this.activeMonitors = this._loadActiveMonitors();

        this.detecting = false;
        this.set_applet_icon_symbolic_name("display-brightness");
        this._updateAppletLabel();
        this.set_applet_tooltip(DEFAULT_TOOLTIP);
        this.actor.connect('scroll-event', (...args) => this._onScrollEvent(...args));
        this.lastTooltipTimeoutID = null;

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this.updateMonitors();
        this._initTogglePoints();
    }

    _bind_settings() {
        // appearance
        this.settings.bind("entry_applet-label", "appletLabel", this._updateAppletLabel.bind(this));
        this.settings.bind("switch_show-bus-number", "showBusNumber", this._updateMonitorSettings.bind(this));
        // scrolling
        this.settings.bind("combobox_scroll-step", "brightnessAdjustmentStep", null);
        // toggle points
        this.settings.bind("switch_use-toggle-points", "useTogglePoints", this._initTogglePoints.bind(this));
        this.settings.bind("spinbutton_num-of-toggle-points", "numOfTogglePoints", this._initTogglePoints.bind(this));
        this.settings.bind("scale_toggle_point_1", "togglePoint1", this._initTogglePoints.bind(this));
        this.settings.bind("scale_toggle_point_2", "togglePoint2", this._initTogglePoints.bind(this));
        this.settings.bind("scale_toggle_point_3", "togglePoint3", this._initTogglePoints.bind(this));
        // single monitor
        this.settings.bind("switch_manual-select-monitors", "manualSelectMonitors", () => {
            this._updateMonitorSettings();
            this.updateMenu();
        });
    }

    _loadActiveMonitors() {
        try {
            const s = this.settings.getValue("string_active-monitors") || "{}";
            return JSON.parse(s);
        } catch (e) {
            log("active-monitors parse failed, resetting to {}", "warning");
            return {};
        }
    }

    _saveActiveMonitors() {
        try {
            this.settings.setValue("string_active-monitors", JSON.stringify(this.activeMonitors));
        } catch (e) {
            log("active-monitors save failed: " + e, "error");
        }
    }

    on_applet_clicked() {
        this.monitors.forEach((monitor) => {
            monitor.updateBrightness(); // Makes sure the brightness shown is the real brightness
        });
        this.menu.toggle();
    }

    on_applet_middle_clicked() {
        if (this.useTogglePoints) {
            this._toggleBrightnessForMonitors();
        }
    }

    on_applet_added_to_panel() {
        if(!this.detecting) {
            this.updateMonitors();
        }
    }

    _updateAppletLabel() {
        this.set_applet_label(this.appletLabel.length > 0 ? this.appletLabel : "");
    }

    _updateMonitorSettings() {
        this.monitors.forEach((monitor) => {
            monitor.setShowBusNumber(this.showBusNumber);
            monitor.setShowCheckbox(this.manualSelectMonitors);
        });
    }

    updateMenu() {
        this.menu.removeAll();

        this.monitors.forEach((monitor) => {
            // Pass a callback to save checkbox state
            monitor.addToMenu(this.menu, (bus, state) => {
                const key = String(bus);
                this.activeMonitors[key] = state;
                this._saveActiveMonitors();
            });

            const saved = this.activeMonitors[String(monitor.bus)];
            if (saved !== undefined) {
                monitor.setActive(!!saved);
            }

        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let reload = new PopupMenu.PopupImageMenuItem(
            _("Detect displays"),
            "emblem-synchronizing-symbolic",
            St.IconType.SYMBOLIC,
            {
                reactive: true,
            }
        );

        this.menu.addMenuItem(reload);

        reload.connect("activate", () => {
            if (!this.detecting) {
                const infoOSD = new ModalDialog.InfoOSD(_("Detecting displays..."));
                infoOSD.show();
                reload.destroy();
                this.updateMonitors().then(
                    () => this.menu.open(true),
                    e  => log("Error: "  + e)
                ).then(() => infoOSD.destroy());
            }
        });
    }

    async updateMonitors(init = true) {
        this.detecting = true;
        log("Detecting displays...");
        this.monitors = (await getDisplays()).map((d) => {
            const isActive = !!this.activeMonitors[String(d.bus)];
            return new Monitor(d.index, d.name, d.bus, d.brightnessFeatureFlag, this.showBusNumber, isActive, this.manualSelectMonitors);
        });

        if (this.monitors.length === 0) {
            log("Could not find any ddc/ci displays.", "warning");
        }

        if (init) {
            this.updateMenu();
        }

        for (const monitor of this.monitors) {
            log(`Getting brightness of display ${monitor.index}...`);
            await monitor.updateBrightness();
        }

        this.detecting = false;
        if (!init) {
            this.updateMenu();
        }
    }

    _initTogglePoints() {
        this._togglePoints = [];
        if (this.numOfTogglePoints >= 1) this._togglePoints.push(this.togglePoint1);
        if (this.numOfTogglePoints >= 2) this._togglePoints.push(this.togglePoint2);
        if (this.numOfTogglePoints >= 3) this._togglePoints.push(this.togglePoint3);
        this._currentToggleIndex = -1;
    }

    _toggleBrightnessForMonitors() {
        if (!this._togglePoints || this._togglePoints.length === 0) return;
        // Cycle through toggle points
        this._currentToggleIndex = (this._currentToggleIndex + 1) % this._togglePoints.length;
        let brightness = this._togglePoints[this._currentToggleIndex];
        this._setBrightnessForMonitors(brightness);
    }

    // Change the brightness when scrolling on the icon
    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.SMOOTH) { // Prevents being triggered twice
            return
        }

        if (direction == Clutter.ScrollDirection.DOWN) {
            this._incrementBrightnessForMonitors(this.brightnessAdjustmentStep, false);
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._incrementBrightnessForMonitors(this.brightnessAdjustmentStep, true);
        }
    }

    _incrementBrightnessForMonitors(amount, isAdd) {

        let monitorsToUpdate = this._getMonitorsToUpdate();

        clearTimeout(this.lastTooltipTimeoutID);
        let tooltipMessage = monitorsToUpdate.map(monitor => {
            let newBrightness = isAdd
                ? Math.min(100, monitor.brightness + amount)
                : Math.max(0, monitor.brightness - amount);
            monitor.setBrightness(newBrightness);
            return `${monitor.name}: ${newBrightness}%`;
        }).join("\n");

        this.set_applet_tooltip(tooltipMessage);
        this._applet_tooltip.show();
        this.lastTooltipTimeoutID = setTimeout(() => {
            this._applet_tooltip.hide();
            this.set_applet_tooltip(DEFAULT_TOOLTIP);
        }, 2500);
    }

    _setBrightnessForMonitors(brightness) {

        let monitorsToUpdate = this._getMonitorsToUpdate();

        clearTimeout(this.lastTooltipTimeoutID);
        let tooltipMessage = monitorsToUpdate.map(monitor => {
            monitor.setBrightness(brightness);
            return `${monitor.name}: ${brightness}%`;
        }).join("\n");

        this.set_applet_tooltip(tooltipMessage);
        this._applet_tooltip.show();
        this.lastTooltipTimeoutID = setTimeout(() => {
            this._applet_tooltip.hide();
            this.set_applet_tooltip(DEFAULT_TOOLTIP);
        }, 2500);
    }

    _getMonitorsToUpdate() {
        return this.manualSelectMonitors ? this.monitors.filter(monitor => monitor.isActive) : this.monitors;
    }
}

async function getDisplays() {
    // detect displays with ddcutil
    const ddcutilOutput = await new Promise((resolve, reject) => {
        Util.spawnCommandLineAsyncIO(
            `ddcutil detect | iconv -f utf-8 -t utf-8 -c`,
            (stdout, stderr, exitCode) => {
                if (exitCode == 0) {
                    resolve(stdout);
                } else {
                    log("Failed to detect displays: " + stderr, "error");
                    const dialog = new ModalDialog.NotifyDialog([
                        _("Failed to detect displays."),
                        _("Make sure you have ddcutil installed and the correct permissions."),
                        _("Error:") + ` ${stderr}`
                    ].join("\n"));
                    dialog.open();
                    reject(stderr);
                }
            }
        );
    });
    log("done detect");

    let capabilitiesByDisplay = [];
    // Get the capabilities of each monitor and the feature value needed, because occasionally it's different.
    for (let i = 1; i < ddcutilOutput.split("Display").length; i++) {
        let capabilitiesOutput = await new Promise((resolve, reject) => {
            Util.spawnCommandLineAsyncIO(
                `ddcutil capabilities --display=${i} | iconv -f utf-8 -t utf-8 -c`,
                (stdout, stderr, exitCode) => {
                    if (exitCode == 0) {
                        resolve(stdout);
                    } else {
                        log("Failed to detect display capabilities for display " + i + " error: " + stderr, "error");
                        resolve(stdout.concat(stderr));
                    }
                }
            );
        });
        capabilitiesOutput = capabilitiesOutput.split("Model: ");
        capabilitiesByDisplay.push(String(capabilitiesOutput[1]));
        //log(capabilitiesByDisplay);
    }
    //log(capabilitiesOutput);


    let displays = [];

    // parse output
    //capabilitiesByDisplay = capabilitiesOutput.split("Model: "); // Split by models
    //capabilitiesByDisplay.splice(0, 1); // Then delete the first item which will always be nothing, or fluff
    const lines = ddcutilOutput.split("\n");
    let currentDisplay = null;
    for (const line of lines) {
        const displayMR = line.match(/^Display (\d+)$/);

        if (displayMR && displayMR.length === 2) {
            const index = parseInt(displayMR[1], 10);

            if (currentDisplay) {
                if (currentDisplay.name === undefined) {
                    currentDisplay.name = currentDisplay.fallbackName;
                }
                displays.push(currentDisplay);
            }

            currentDisplay = {
                index,
                fallbackName: displayMR[0],
            };
        } else {
            if (currentDisplay) {
                const busMR = line.match(/^\s+I2C bus:\s+\/dev\/i2c-(\d+)$/);

                if (busMR && busMR.length === 2 && currentDisplay.bus === undefined) {
                    currentDisplay.bus = parseInt(busMR[1], 10);
                }
                else {
                    const modelMR = line.match(/^\s+Model:\s+(.+)$/);

                    if (modelMR && modelMR.length === 2 && currentDisplay.name === undefined) {
                        currentDisplay.name = modelMR[1];
                    }
                }
            }
            else {
                continue;
            }
        }
    }

    if (currentDisplay) {
        if (currentDisplay.name === undefined) {
            currentDisplay.name = currentDisplay.fallbackName;
        }
        displays.push(currentDisplay);
    }

    let displays_temp = displays;
    displays = [];
    for (let display of displays_temp) {
        for (let capableDisplay of capabilitiesByDisplay) {
            let capabilities = capableDisplay.split("\n")
            //log(capabilities[0]);
            //log(display.name);
            //log(String(capabilities[0].indexOf(display.name) !== -1));
            //log(String(display.name.indexOf(capableDisplay[0]) !== -1));
            if (capabilities[0].indexOf(display.name) !== -1 || display.name.indexOf(capabilities[0]) !== -1) {
                //log("yes");
                for (let capability of capableDisplay.split("\n")) {
                    //log(capability);
                    if (capability.includes("(Backlight Level: White)")) {
                        display.brightnessFeatureFlag = capability.split("Feature: ")[1].split(" (")[0];
                        log(`Brightness feature ${display.brightnessFeatureFlag} found for display ${display.name}`);
                        //log(capability.split("Feature: ")[1].split(" (")[0]);
                    }
                }

                if (!display.brightnessFeatureFlag) {
                    for (let capability of capableDisplay.split("\n")) {
                        //log(capability);
                        if (capability.includes("(Brightness)")) {
                            display.brightnessFeatureFlag = capability.split("Feature: ")[1].split(" (")[0];
                            log(`Brightness feature ${display.brightnessFeatureFlag} found for display ${display.name}`);
                            //log(capability.split("Feature: ")[1].split(" (")[0]);
                        }
                    }
                }
            }
        }
        if (display.brightnessFeatureFlag) {

            displays.push(display);
        }
        else {
            display.brightnessFeatureFlag = 10;
            displays.push(display);
        }

    }
    log(`Detected ${displays.length} displays.`);

    return displays;
}

function main(metadata, orientation, panel_height, instance_id) {
    const applet = new DDCMultiMonitor(
        metadata,
        orientation,
        panel_height,
        instance_id
    );

    return applet;
}
