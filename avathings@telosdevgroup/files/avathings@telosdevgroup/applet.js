const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;

class AvathingsApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this.appletPath = metadata.path;
        this.set_applet_label("P:--");
        this.set_applet_tooltip(_("Avathings: Compute & Battery Governor"));

        // Binary detection
        this.hasChangestate = GLib.find_program_in_path("changestate") !== null;
        this.hasAvabatt = GLib.find_program_in_path("avabatt") !== null;

        // State trackers
        this.currentTier = "p23";
        this.currentTierLabel = "P:--";
        this.batteryCapacity = null;
        this.batteryStatus = "";
        this.stopThreshold = null;
        this.startThreshold = null;
        this.autoDaemonActive = false;
        this.availableTiers = [];

        // Build popup menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.buildMenu();

        if (this.hasChangestate) {
            this.fetchTiers();
        }
        this.refreshState();

        // 5-second polling interval
        this.timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this.refreshState();
            return true;
        });
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this.timerId) {
            GLib.source_remove(this.timerId);
            this.timerId = null;
        }
    }

    executeCommand(command, callback = null) {
        let fullCmd = command;
        if (command.startsWith("sudo ")) {
            fullCmd = "pkexec " + command.substring(5);
        }

        try {
            let [res, argv] = GLib.shell_parse_argv(fullCmd);
            let subprocess = new Gio.Subprocess({
                argv: argv,
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            subprocess.init(null);
            subprocess.wait_async(null, (proc, resAsync) => {
                try {
                    proc.wait_finish(resAsync);
                    if (callback) callback();
                    this.refreshState();
                } catch (e) {
                    global.logError("[Avathings] Error running command: " + e.message);
                }
            });
        } catch (e) {
            Util.spawnCommandLineAsync(fullCmd);
            if (callback) setTimeout(callback, 1000);
        }
    }

    readCommandOutput(command, callback) {
        try {
            let [res, argv] = GLib.shell_parse_argv(command);
            let subprocess = new Gio.Subprocess({
                argv: argv,
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            subprocess.init(null);
            subprocess.communicate_utf8_async(null, null, (proc, resAsync) => {
                try {
                    let [ok, stdout, stderr] = proc.communicate_utf8_finish(resAsync);
                    if (ok && stdout) {
                        callback(stdout.trim());
                    } else {
                        callback(null);
                    }
                } catch (e) {
                    callback(null);
                }
            });
        } catch (e) {
            callback(null);
        }
    }

    spawnTerminal(title, command) {
        let terminal = GLib.find_program_in_path("gnome-terminal") ||
                       GLib.find_program_in_path("x-terminal-emulator") ||
                       GLib.find_program_in_path("xterm");

        if (!terminal) {
            global.logError("[Avathings] No terminal emulator found to run: " + command);
            return;
        }

        if (terminal.endsWith("gnome-terminal")) {
            Util.spawnCommandLineAsync(`gnome-terminal --title='${title}' -- bash -c '${command}'`);
        } else {
            Util.spawnCommandLineAsync(`${terminal} -T '${title}' -e bash -c '${command}'`);
        }
    }

    fetchTiers() {
        this.readCommandOutput("changestate tiers-json", (output) => {
            if (output) {
                try {
                    this.availableTiers = JSON.parse(output);
                    this.rebuildTierSubmenu();
                } catch (e) {
                    global.logError("[Avathings] Failed to parse tiers-json: " + e.message);
                }
            }
        });
    }

    refreshState() {
        // Re-check program presence in case installed after applet loaded
        let prevHasChangestate = this.hasChangestate;
        let prevHasAvabatt = this.hasAvabatt;
        this.hasChangestate = GLib.find_program_in_path("changestate") !== null;
        this.hasAvabatt = GLib.find_program_in_path("avabatt") !== null;

        if (prevHasChangestate !== this.hasChangestate || prevHasAvabatt !== this.hasAvabatt) {
            this.buildMenu();
            if (this.hasChangestate) {
                this.fetchTiers();
            }
        }

        // 1. Fetch avabatt status if present
        if (this.hasAvabatt) {
            this.readCommandOutput("avabatt status --json", (output) => {
                if (output) {
                    try {
                        let data = JSON.parse(output);
                        if (data.batteries && data.batteries.length > 0) {
                            let bat = data.batteries[0];
                            this.batteryCapacity = bat.capacity;
                            this.batteryStatus = bat.status;
                            this.startThreshold = bat.start_threshold;
                            this.stopThreshold = bat.stop_threshold;
                        }
                    } catch (e) {}
                }
                this.refreshChangestate();
            });
        } else {
            this.batteryCapacity = null;
            this.batteryStatus = "";
            this.startThreshold = null;
            this.stopThreshold = null;
            this.refreshChangestate();
        }
    }

    refreshChangestate() {
        if (this.hasChangestate) {
            this.readCommandOutput("changestate status", (output) => {
                if (output) {
                    let matchTier = output.match(/Active Level:\s*(P:\d+)/i);
                    if (matchTier) {
                        this.currentTierLabel = matchTier[1].toUpperCase();
                        this.currentTier = matchTier[1].replace(":", "").toLowerCase();
                    }
                }

                // Check changestate-auto daemon status
                this.readCommandOutput("systemctl is-active changestate-auto", (daemonOut) => {
                    this.autoDaemonActive = (daemonOut === "active");
                    this.updateUI();
                });
            });
        } else {
            this.currentTierLabel = "P:--";
            this.autoDaemonActive = false;
            this.updateUI();
        }
    }

    updateUI() {
        if (!this.hasChangestate && !this.hasAvabatt) {
            this.set_applet_label("Avathings (!)");
            this.set_applet_tooltip(_("Avathings: changestate and avabatt utilities are not installed. Click for details."));
            return;
        }

        this.set_applet_label(this.currentTierLabel || "P:--");

        let tooltipLines = [
            `Avathings Control Center`
        ];

        if (this.hasChangestate) {
            tooltipLines.push(`Compute Governor: ${this.currentTierLabel} (Auto Daemon: ${this.autoDaemonActive ? "ON" : "OFF"})`);
        } else {
            tooltipLines.push(`Compute Governor: changestate not installed`);
        }

        if (this.hasAvabatt) {
            if (this.batteryCapacity !== null) {
                tooltipLines.push(`Battery: ${this.batteryCapacity}% (${this.batteryStatus})`);
                tooltipLines.push(`Charge Limits: Start ${this.startThreshold}% | Stop ${this.stopThreshold}%`);
            }
        } else {
            tooltipLines.push(`Battery: avabatt not installed`);
        }

        this.set_applet_tooltip(tooltipLines.join("\n"));

        // Update Menu Status Labels
        if (this.computeStatusItem) {
            if (this.hasChangestate) {
                let daemonStr = this.autoDaemonActive ? "Auto-Scaling: ACTIVE" : "Auto-Scaling: OFF";
                this.computeStatusItem.label.set_text(`Active Tier: ${this.currentTierLabel} (${daemonStr})`);
            } else {
                this.computeStatusItem.label.set_text("changestate is not installed");
            }
        }

        if (this.batteryStatusItem) {
            if (this.hasAvabatt) {
                let limitStr = this.stopThreshold ? `Limit: ${this.stopThreshold}%` : "No limit";
                this.batteryStatusItem.label.set_text(`Battery: ${this.batteryCapacity}% (${this.batteryStatus}) · ${limitStr}`);
            } else {
                this.batteryStatusItem.label.set_text("avabatt is not installed");
            }
        }

        if (this.autoDaemonSwitch) {
            this.autoDaemonSwitch.setToggleState(this.autoDaemonActive);
        }
    }

    buildMenu() {
        this.menu.removeAll();

        // --- SECTION: CHANGESTATE ---
        let computeHeader = new PopupMenu.PopupMenuItem("🎚️  Compute Capacity (changestate)", { reactive: false });
        computeHeader.actor.add_style_class_name("avathings-menu-header");
        this.menu.addMenuItem(computeHeader);

        if (!this.hasChangestate) {
            let missingItem = new PopupMenu.PopupIconMenuItem("Install changestate CLI...", "dialog-warning-symbolic", St.IconType.SYMBOLIC);
            missingItem.connect("activate", () => {
                Util.spawnCommandLineAsync("xdg-open https://github.com/telosdevgroup/changestate");
            });
            this.menu.addMenuItem(missingItem);
        } else {
            this.computeStatusItem = new PopupMenu.PopupMenuItem("Active Tier: Loading...", { reactive: false });
            this.menu.addMenuItem(this.computeStatusItem);

            // Auto Daemon Toggle
            this.autoDaemonSwitch = new PopupMenu.PopupSwitchMenuItem("Autonomous Governor (changestate-auto)", this.autoDaemonActive);
            this.autoDaemonSwitch.connect("toggled", (item, state) => {
                let action = state ? "start" : "stop";
                this.executeCommand(`sudo systemctl ${action} changestate-auto`);
            });
            this.menu.addMenuItem(this.autoDaemonSwitch);

            // Full Tier Submenu
            this.tierSubmenu = new PopupMenu.PopupSubMenuMenuItem("🎯 Select Capacity Tier");
            this.menu.addMenuItem(this.tierSubmenu);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // --- SECTION: AVABATT ---
        let battHeader = new PopupMenu.PopupMenuItem("🔋 Battery Telemetry (avabatt)", { reactive: false });
        battHeader.actor.add_style_class_name("avathings-menu-header");
        this.menu.addMenuItem(battHeader);

        if (!this.hasAvabatt) {
            let missingBattItem = new PopupMenu.PopupIconMenuItem("Install avabatt CLI...", "dialog-warning-symbolic", St.IconType.SYMBOLIC);
            missingBattItem.connect("activate", () => {
                Util.spawnCommandLineAsync("xdg-open https://github.com/telosdevgroup/avabatt");
            });
            this.menu.addMenuItem(missingBattItem);
        } else {
            this.batteryStatusItem = new PopupMenu.PopupMenuItem("Battery: Loading...", { reactive: false });
            this.menu.addMenuItem(this.batteryStatusItem);

            let battPresetMenu = new PopupMenu.PopupSubMenuMenuItem("⚡ Quick Battery Ceilings");
            let battPresets = [
                { id: "80", name: "Desk Mode (Cap 80% · Preserves Battery Health)" },
                { id: "100", name: "Full Travel Mode (100% Uncapped)" }
            ];
            battPresets.forEach(bp => {
                let item = new PopupMenu.PopupMenuItem(bp.name);
                item.connect("activate", () => {
                    this.executeCommand(`sudo avabatt ${bp.id}`);
                });
                battPresetMenu.menu.addMenuItem(item);
            });
            this.menu.addMenuItem(battPresetMenu);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // --- SECTION: LIVE TERMINALS & LOGS ---
        let terminalMenu = new PopupMenu.PopupSubMenuMenuItem("💻 Live Terminals & Logs");

        // changestate tools
        if (this.hasChangestate) {
            let changestateLogItem = new PopupMenu.PopupIconMenuItem("changestate: Live Daemon Logs", "utilities-terminal-symbolic", St.IconType.SYMBOLIC);
            changestateLogItem.connect("activate", () => {
                this.spawnTerminal("changestate-auto Logs", "journalctl -u changestate-auto -f");
            });
            terminalMenu.menu.addMenuItem(changestateLogItem);

            let changestateStatusItem = new PopupMenu.PopupIconMenuItem("changestate: Full Diagnostics", "utilities-terminal-symbolic", St.IconType.SYMBOLIC);
            changestateStatusItem.connect("activate", () => {
                this.spawnTerminal("changestate Diagnostic", "changestate status; echo ''; read -n 1 -s -r -p 'Press any key to close...'");
            });
            terminalMenu.menu.addMenuItem(changestateStatusItem);
        }

        if (this.hasChangestate && this.hasAvabatt) {
            terminalMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        // avabatt tools
        if (this.hasAvabatt) {
            let avabattStatusItem = new PopupMenu.PopupIconMenuItem("avabatt: Battery Diagnostics", "utilities-terminal-symbolic", St.IconType.SYMBOLIC);
            avabattStatusItem.connect("activate", () => {
                this.spawnTerminal("avabatt Diagnostic", "avabatt status; echo ''; read -n 1 -s -r -p 'Press any key to close...'");
            });
            terminalMenu.menu.addMenuItem(avabattStatusItem);

            let avabattLogItem = new PopupMenu.PopupIconMenuItem("avabatt: Service Logs", "utilities-terminal-symbolic", St.IconType.SYMBOLIC);
            avabattLogItem.connect("activate", () => {
                this.spawnTerminal("avabatt Logs", "journalctl -u avabatt -n 50 -f");
            });
            terminalMenu.menu.addMenuItem(avabattLogItem);
        }

        // Dashboard option if dashboard.sh exists
        let dashPath = GLib.build_filenamev([this.appletPath, "dashboard.sh"]);
        if (GLib.file_test(dashPath, GLib.FileTest.IS_EXECUTABLE)) {
            terminalMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let liveDashItem = new PopupMenu.PopupIconMenuItem("Avathings: Live TUI Dashboard", "utilities-terminal-symbolic", St.IconType.SYMBOLIC);
            liveDashItem.connect("activate", () => {
                this.spawnTerminal("Avathings Live Dashboard", dashPath);
            });
            terminalMenu.menu.addMenuItem(liveDashItem);
        }

        this.menu.addMenuItem(terminalMenu);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // --- SECTION: UTILITIES ---
        let refreshItem = new PopupMenu.PopupIconMenuItem("Refresh Telemetry", "view-refresh-symbolic", St.IconType.SYMBOLIC);
        refreshItem.connect("activate", () => {
            if (this.hasChangestate) this.fetchTiers();
            this.refreshState();
        });
        this.menu.addMenuItem(refreshItem);
    }

    rebuildTierSubmenu() {
        if (!this.tierSubmenu) return;
        this.tierSubmenu.menu.removeAll();

        this.availableTiers.forEach(tier => {
            let label = tier.label || `${tier.id.toUpperCase()} · ~${tier.pct}%`;
            if (tier.id === "p11" || tier.prime === 11) {
                label = `P:11 · ~${tier.pct || 35}% (Wakeup)`;
            }
            let item = new PopupMenu.PopupMenuItem(label);
            item.connect("activate", () => {
                this.executeCommand(`sudo changestate ${tier.id}`);
            });
            this.tierSubmenu.menu.addMenuItem(item);
        });
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new AvathingsApplet(metadata, orientation, panelHeight, instanceId);
}
