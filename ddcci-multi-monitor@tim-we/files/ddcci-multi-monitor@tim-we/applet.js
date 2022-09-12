const Lang = imports.lang;
const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;

const UUID = "ddcci-multi-monitor@tim-we";

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
    constructor(index, name, bus) {
        this.index = index;
        this.name = name;
        this.brightness = 50;
        this.bus = bus;
        this.menuLabel = null;
        this.menuSlider = null;
    }

    updateBrightness() {
        return new Promise((resolve) => {
            // get current brightness value
            const cmd = `ddcutil --bus=${this.bus} getvcp 10`;
            Util.spawnCommandLineAsyncIO(cmd, (stdout, stderr, exitCode) => {
                // guarantee resolve, even if the following code fails
                setTimeout(resolve, 10);

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
        this.menuLabel.setLabel(`${this.name}  (${this.brightness}%)`);
    }

    updateMenu() {
        this.updateLabel();
        this.menuSlider.setValue(this.brightness / 100);
    }

    setBrightness(value) {
        this.brightness = Math.round(value);
        this.updateLabel();

        return new Promise((resolve, reject) => {
            Util.spawnCommandLineAsync(
                `ddcutil --bus=${this.bus} setvcp 10 ${this.brightness}`,
                resolve,
                reject
            );
        });
    }

    addToMenu(menu) {
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
    }
}

class DDCMultiMonitor extends Applet.IconApplet {

    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this.detecting = false;
        this.set_applet_icon_symbolic_name("display-brightness");
        this.set_applet_tooltip("Adjust monitor brightness via DDC/CI");

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);

        this.updateMonitors();
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_added_to_panel() {
        if(!this.detecting) {
            this.updateMonitors();
        }
    }

    updateMenu() {
        this.menu.removeAll();

        this.monitors.forEach((monitor) => {
            monitor.addToMenu(this.menu);
        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let reload = new PopupMenu.PopupImageMenuItem(
            "Detect displays",
            "emblem-synchronizing-symbolic",
            St.IconType.SYMBOLIC,
            {
                reactive: true,
            }
        );

        this.menu.addMenuItem(reload);

        reload.connect("activate", () => {
            if (!this.detecting) {
                const infoOSD = new ModalDialog.InfoOSD("Detecting displays...");
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
        this.monitors = (await getDisplays()).map(
            (d) => new Monitor(d.index, d.name, d.bus)
        );

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
}

async function getDisplays() {
    // detect displays with ddcutil
    const ddcutilOutput = await new Promise((resolve, reject) => {
        Util.spawnCommandLineAsyncIO(
            `ddcutil detect`,
            (stdout, stderr, exitCode) => {
                if (exitCode == 0) {
                    resolve(stdout);
                } else {
                    log("Failed to detect displays: " + stderr, "error");
                    const dialog = new ModalDialog.NotifyDialog([
                        "Failed to detect displays.",
                        "Make sure you have ddcutil installed and the correct permissions.",
                        "Error: " + stderr
                    ].join("\n"));
                    dialog.open();
                    reject(stderr);
                }
            }
        );
    });

    let displays = [];

    // parse output
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
                } else {
                    const modelMR = line.match(/^\s+Model:\s+(.+)$/);

                    if (modelMR && modelMR.length === 2 && currentDisplay.name === undefined) {
                        currentDisplay.name = modelMR[1];
                    }
                }
            } else {
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
