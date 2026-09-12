/* global imports */
/* exported main */

// SPDX-License-Identifier: GPL-3.0-or-later

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;

const Metrics = require("./metrics");

const UUID = "system-monitor@oss-singularity";
const HWMON_PATH = "/sys/class/hwmon";
const THERMAL_PATH = "/sys/class/thermal";
// Keep the 2.0.1 default at the existing 90% visual baseline.
const FONT_SIZE_RENDER_SCALE = 0.9;

class AdaptiveSystemMonitorApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this._isVertical = this._orientationIsVertical(orientation);
        this._panelThickness = panelHeight;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._timeoutId = 0;
        this._destroyed = false;
        this._gpuCancellable = null;
        this._metricsCancellable = new Gio.Cancellable();
        this._gpuBusy = false;
        this._metricsBusy = false;
        this._gpuAvailable = this._findRadeontop() !== null;
        this._cpuSample = null;
        this._cpuTempPath = null;
        this._cpuTempDiscoveryPending = false;
        this._actors = {};
        this._values = {
            cpu: null,
            memory: null,
            swap: null,
            temperature: null,
            gpu: null,
            vram: null
        };
        this._details = {
            memory: "--",
            swap: "--",
            vram: "--",
            gpuStatus: "Waiting for radeontop"
        };

        this._setDefaults();
        this._bindSettings(instanceId);
        this._buildUi();
        this._buildMenu(orientation);
        this._discoverCpuTemperaturePath();
        this._updateAll();
        this._restartTimer();
    }

    _setDefaults() {
        this.refreshInterval = 2000;
        this.fontSize = 100;
        this.separator = "|";
        this.useIcons = true;
        this.showColors = true;
        this.normalColor = "#ffffff";
        this.warningColor = "#f6d32d";
        this.criticalColor = "#ed333b";
        this.showCpu = true;
        this.showMemory = true;
        this.showSwap = true;
        this.showTemperature = true;
        this.showGpu = true;
        this.showVram = true;
        this.temperatureUnit = "celsius";
        this.gpuBus = "";
        this.cpuWarning = 70;
        this.cpuCritical = 90;
        this.memoryWarning = 75;
        this.memoryCritical = 90;
        this.swapWarning = 50;
        this.swapCritical = 80;
        this.temperatureWarning = 75;
        this.temperatureCritical = 90;
        this.gpuWarning = 75;
        this.gpuCritical = 95;
        this.vramWarning = 90;
        this.vramCritical = 95;
    }

    _bindSettings(instanceId) {
        this.settings = new Settings.AppletSettings(this, UUID, instanceId);

        const layoutChanged = this._onLayoutSettingChanged.bind(this);
        const visibilityChanged = this._onMetricVisibilityChanged.bind(this);
        const styleChanged = this._onStyleSettingChanged.bind(this);
        const gpuChanged = this._onGpuSettingChanged.bind(this);

        this.settings.bind("refresh-interval", "refreshInterval", this._onIntervalChanged.bind(this));
        this.settings.bind("font-size", "fontSize", styleChanged);
        this.settings.bind("separator", "separator", layoutChanged);
        this.settings.bind("use-icons", "useIcons", layoutChanged);
        this.settings.bind("show-colors", "showColors", styleChanged);
        this.settings.bind("normal-color", "normalColor", styleChanged);
        this.settings.bind("warning-color", "warningColor", styleChanged);
        this.settings.bind("critical-color", "criticalColor", styleChanged);

        this.settings.bind("show-cpu", "showCpu", visibilityChanged);
        this.settings.bind("show-memory", "showMemory", visibilityChanged);
        this.settings.bind("show-swap", "showSwap", visibilityChanged);
        this.settings.bind("show-temperature", "showTemperature", visibilityChanged);
        this.settings.bind("show-gpu", "showGpu", visibilityChanged);
        this.settings.bind("show-vram", "showVram", visibilityChanged);
        this.settings.bind("temperature-unit", "temperatureUnit", styleChanged);
        this.settings.bind("gpu-bus", "gpuBus", gpuChanged);

        for (const metric of ["cpu", "memory", "swap", "temperature", "gpu", "vram"]) {
            this.settings.bind(`${metric}-warning`, `${metric}Warning`, styleChanged);
            this.settings.bind(`${metric}-critical`, `${metric}Critical`, styleChanged);
        }
    }

    _buildUi() {
        this.actor.style = this._isVertical
            ? "padding-left: 0px; padding-right: 0px;"
            : null;

        this._root = new St.BoxLayout({
            reactive: true,
            vertical: this._isVertical
        });
        this.actor.add_child(this._root);
        this._syncPanelThickness();
        this._rebuildMetrics();
        this.set_applet_tooltip("Adaptive System Monitor");
    }

    _metricDefinitions() {
        return [
            { id: "cpu", short: "CPU", icon: "cpu_white.svg", visible: this.showCpu },
            { id: "memory", short: "RAM", icon: "ram_white.svg", visible: this.showMemory },
            { id: "swap", short: "SWP", icon: "swap_white.svg", visible: this.showSwap },
            { id: "temperature", short: "TMP", icon: "temp_white.svg", visible: this.showTemperature },
            { id: "gpu", short: "GPU", icon: "gpu_white.svg", visible: this.showGpu && this._gpuAvailable },
            { id: "vram", short: "VRM", icon: "vram_white.svg", visible: this.showVram && this._gpuAvailable }
        ];
    }

    _rebuildMetrics() {
        if (!this._root) return;

        for (const child of this._root.get_children()) {
            this._root.remove_child(child);
            child.destroy();
        }
        this._actors = {};

        const definitions = this._metricDefinitions().filter(definition => definition.visible);
        definitions.forEach((definition, index) => {
            const metricActor = this._createMetricActor(definition);
            this._actors[definition.id] = metricActor;
            this._root.add_child(metricActor.actor);

            if (!this._isVertical && this.separator && index < definitions.length - 1) {
                const separator = new St.Label({
                    text: this.separator,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: "padding-left: 4px; padding-right: 4px;"
                });
                this._root.add_child(separator);
            }
        });

        this.actor.visible = definitions.length > 0;
        this._applyValues();
    }

    _createMetricActor(definition) {
        const actor = new St.BoxLayout({
            reactive: false,
            vertical: this._isVertical
        });
        actor.x_align = this._isVertical ? Clutter.ActorAlign.CENTER : Clutter.ActorAlign.FILL;
        actor.style = this._isVertical ? "padding: 1px 0px;" : "";

        const iconPath = `${this.metadata.path}/icons/${definition.icon}`;
        const useIcon = this.useIcons;
        let symbol;

        if (useIcon) {
            symbol = new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(iconPath) }),
                icon_size: 16,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: this._isVertical ? "padding-bottom: 1px;" : "padding-right: 3px;"
            });
        } else {
            symbol = new St.Label({
                text: this._isVertical ? definition.short : `${definition.short} `,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER
            });
            symbol.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
        }

        const value = new St.Label({
            text: "--",
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        value.clutter_text.set_line_alignment(Pango.Alignment.CENTER);

        actor.add_child(symbol);
        actor.add_child(value);
        return { actor, symbol, value, usesText: !useIcon };
    }

    _buildMenu(orientation) {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._infoItem = new PopupMenu.PopupMenuItem("Collecting data…", { reactive: false });
        this.menu.addMenuItem(this._infoItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const systemMonitorItem = new PopupMenu.PopupIconMenuItem(
            "Open System Monitor",
            "utilities-system-monitor",
            St.IconType.SYMBOLIC
        );
        systemMonitorItem.connect("activate", () => Util.spawn(["gnome-system-monitor"]));
        this.menu.addMenuItem(systemMonitorItem);

        const radeontopItem = new PopupMenu.PopupIconMenuItem(
            "Open radeontop",
            "video-display-symbolic",
            St.IconType.SYMBOLIC
        );
        radeontopItem.connect("activate", () => {
            const args = ["gnome-terminal", "--", "radeontop"];
            const bus = this._validatedGpuBus();
            if (bus) args.push("-b", bus);
            Util.spawn(args);
        });
        this.menu.addMenuItem(radeontopItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const restartItem = new PopupMenu.PopupIconMenuItem(
            "Restart Cinnamon",
            "view-refresh-symbolic",
            St.IconType.SYMBOLIC
        );
        restartItem.connect("activate", () => Main.restartCinnamon());
        this.menu.addMenuItem(restartItem);
    }

    on_applet_clicked() {
        this._updateMenuText();
        this.menu.toggle();
    }

    on_orientation_changed(orientation) {
        this._isVertical = this._orientationIsVertical(orientation);

        if (!this._root) return;
        this.actor.style = this._isVertical
            ? "padding-left: 0px; padding-right: 0px;"
            : null;
        this._root.set_vertical(this._isVertical);
        this._syncPanelThickness();
        this._rebuildMetrics();
    }

    on_panel_height_changed() {
        if (this._isVertical && this.panel) {
            this._panelThickness = this.panel.width;
        }
        this._syncPanelThickness();
    }

    _syncPanelThickness() {
        if (!this._root) return;

        if (this._isVertical) {
            this._root.set_width(this._panelThickness);
            this._root.x_align = Clutter.ActorAlign.START;
        } else {
            this._root.set_width(-1);
            this._root.x_align = Clutter.ActorAlign.FILL;
        }
    }

    _orientationIsVertical(orientation) {
        return orientation === St.Side.LEFT || orientation === St.Side.RIGHT;
    }

    _onLayoutSettingChanged() {
        this._rebuildMetrics();
    }

    _onMetricVisibilityChanged() {
        if (!this.showGpu) this._values.gpu = null;
        if (!this.showVram) {
            this._values.vram = null;
            this._details.vram = "--";
        }

        if (!this.showGpu && !this.showVram && this._gpuCancellable) {
            this._gpuCancellable.cancel();
        }

        this._rebuildMetrics();
        this._updateAll();
    }

    _onStyleSettingChanged() {
        this._applyValues();
    }

    _onGpuSettingChanged() {
        this._values.gpu = null;
        this._values.vram = null;
        this._details.vram = "--";
        this._updateGpu();
        this._applyValues();
    }

    _onIntervalChanged() {
        this._restartTimer();
    }

    _restartTimer() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        const interval = Math.max(500, Number(this.refreshInterval) || 2000);
        this._timeoutId = Mainloop.timeout_add(interval, () => {
            this._updateAll();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _updateAll() {
        if (this._destroyed) return GLib.SOURCE_REMOVE;
        this._updateSystemMetrics();
        this._updateGpu();
        this._applyValues();
        return GLib.SOURCE_CONTINUE;
    }

    _updateSystemMetrics() {
        if (this._metricsBusy) return;
        this._metricsBusy = true;

        let pending = 0;
        const complete = () => {
            pending -= 1;
            if (pending !== 0 || this._destroyed) return;

            this._metricsBusy = false;
            this._applyValues();
        };
        const read = (path, handler) => {
            pending += 1;
            this._readTextFileAsync(path, contents => {
                if (!this._destroyed) handler(contents);
                complete();
            });
        };

        if (this.showCpu) {
            read("/proc/stat", cpuText => {
                if (!this.showCpu) {
                    this._values.cpu = null;
                    return;
                }
                if (cpuText !== null) {
                    const cpu = Metrics.parseCpuStat(cpuText, this._cpuSample);
                    if (cpu) {
                        this._cpuSample = cpu.sample;
                        this._values.cpu = cpu.percentage;
                    }
                }
            });
        } else {
            this._values.cpu = null;
        }

        if (this.showMemory || this.showSwap) {
            read("/proc/meminfo", memoryText => {
                if (!this.showMemory && !this.showSwap) {
                    this._values.memory = null;
                    this._values.swap = null;
                    return;
                }

                const memory = memoryText === null ? null : Metrics.parseMemInfo(memoryText);
                if (memory) {
                    this._values.memory = this.showMemory ? memory.memoryPercentage : null;
                    this._values.swap = this.showSwap ? memory.swapPercentage : null;
                    if (this.showMemory) {
                        this._details.memory = `${this._formatKiB(memory.memoryUsedKiB)} / ${this._formatKiB(memory.memoryTotalKiB)}`;
                    }
                    if (this.showSwap) {
                        this._details.swap = `${this._formatKiB(memory.swapUsedKiB)} / ${this._formatKiB(memory.swapTotalKiB)}`;
                    }
                }
            });
        } else {
            this._values.memory = null;
            this._values.swap = null;
        }

        if (this.showTemperature) {
            if (!this._cpuTempPath) this._discoverCpuTemperaturePath();
            if (this._cpuTempPath) {
                read(this._cpuTempPath, rawTemperature => {
                    if (!this.showTemperature) {
                        this._values.temperature = null;
                        return;
                    }
                    if (rawTemperature === null) {
                        this._cpuTempPath = null;
                        this._discoverCpuTemperaturePath();
                        this._values.temperature = null;
                        return;
                    }
                    const value = Number(rawTemperature);
                    this._values.temperature = Number.isFinite(value) ? value / 1000 : null;
                });
            } else {
                this._values.temperature = null;
            }
        } else {
            this._values.temperature = null;
        }

        if (pending === 0) this._metricsBusy = false;
    }

    _updateGpu() {
        if (this._gpuBusy || (!this.showGpu && !this.showVram)) return;

        const executable = this._findRadeontop();
        if (!executable) {
            this._details.gpuStatus = "radeontop is not installed";
            this._values.gpu = null;
            this._values.vram = null;
            this._setGpuAvailability(false);
            return;
        }

        const args = [executable];
        const bus = this._validatedGpuBus();
        if (bus) args.push("-b", bus);
        args.push("-l", "1", "-d", "-");

        this._gpuBusy = true;
        this._gpuCancellable = new Gio.Cancellable();

        try {
            const process = new Gio.Subprocess({
                argv: args,
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            process.init(null);
            process.communicate_utf8_async(null, this._gpuCancellable, (source, result) => {
                this._gpuBusy = false;
                this._gpuCancellable = null;

                try {
                    const [, stdout, stderr] = source.communicate_utf8_finish(result);
                    const parsed = Metrics.parseRadeontop(stdout);
                    if (!parsed) {
                        const errorText = String(stderr || "No AMD GPU data").trim() || "No AMD GPU data";
                        this._details.gpuStatus = errorText.split("\n")[0].slice(0, 160);
                        this._values.gpu = null;
                        this._values.vram = null;
                        this._setGpuAvailability(false);
                    } else {
                        this._values.gpu = this.showGpu ? parsed.gpuPercentage : null;
                        this._values.vram = this.showVram ? parsed.vramPercentage : null;
                        if (this.showVram) {
                            this._details.vram = `${parsed.vramUsed.toFixed(1)} ${parsed.vramUnit}`;
                        }
                        this._details.gpuStatus = "AMD GPU data available";
                        this._setGpuAvailability(true);
                    }
                } catch (error) {
                    const cancelled = error.matches && error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);
                    if (!cancelled) {
                        this._details.gpuStatus = "Could not read radeontop data";
                        this._values.gpu = null;
                        this._values.vram = null;
                        this._setGpuAvailability(false);
                        global.logError(`${UUID}: radeontop failed: ${error}`);
                    }
                }

                if (!this._destroyed) this._applyValues();
            });
        } catch (error) {
            this._gpuBusy = false;
            this._gpuCancellable = null;
            this._details.gpuStatus = "Could not start radeontop";
            this._values.gpu = null;
            this._values.vram = null;
            this._setGpuAvailability(false);
            global.logError(`${UUID}: could not start radeontop: ${error}`);
        }
    }

    _findRadeontop() {
        return GLib.find_program_in_path("radeontop");
    }

    _setGpuAvailability(available) {
        if (this._gpuAvailable === available) return;

        this._gpuAvailable = available;
        if (!this._destroyed && this._root) this._rebuildMetrics();
    }

    _applyValues() {
        if (!this._actors) return;

        const renderFontSize = this.fontSize * FONT_SIZE_RENDER_SCALE;

        for (const definition of this._metricDefinitions()) {
            const metric = this._actors[definition.id];
            if (!metric) continue;

            metric.value.set_text(this._formatMetric(definition.id, this._values[definition.id]));
            if (metric.usesText) {
                metric.symbol.style = `font-size: ${Math.max(60, renderFontSize - 20)}%; font-weight: 600;`;
            }
            metric.value.style = `font-size: ${renderFontSize}%; color: ${this._metricColor(definition.id)};`;
        }

        this._updateMenuText();
    }

    _formatMetric(id, value) {
        if (id === "temperature") {
            if (value === null || value === undefined || !Number.isFinite(value)) return "--";
            if (this.temperatureUnit === "fahrenheit") {
                return `${Math.round(value * 9 / 5 + 32)}°F`;
            }
            return `${Math.round(value)}°C`;
        }
        return Metrics.formatPercent(value);
    }

    _metricColor(id) {
        if (!this.showColors) return this.normalColor;

        const value = this._values[id];
        if (value === null || value === undefined || !Number.isFinite(value)) return this.normalColor;

        const warning = this[`${id}Warning`];
        const critical = this[`${id}Critical`];
        if (value >= critical) return this.criticalColor;
        if (value >= warning) return this.warningColor;
        return this.normalColor;
    }

    _updateMenuText() {
        if (!this._infoItem) return;

        const lines = [
            `CPU: ${this._formatMetric("cpu", this._values.cpu)}`,
            `CPU temperature: ${this._formatMetric("temperature", this._values.temperature)}`,
            `Memory: ${this._formatMetric("memory", this._values.memory)} (${this._details.memory})`,
            `Swap: ${this._formatMetric("swap", this._values.swap)} (${this._details.swap})`,
            `GPU: ${this._formatMetric("gpu", this._values.gpu)}`,
            `VRAM: ${this._formatMetric("vram", this._values.vram)} (${this._details.vram})`,
            this._details.gpuStatus
        ];
        this._infoItem.label.set_text(lines.join("\n"));
    }

    _validatedGpuBus() {
        const value = String(this.gpuBus || "").trim();
        return /^[0-9a-fA-F]{2}$/.test(value) ? value : "";
    }

    _readTextFileAsync(path, callback) {
        if (this._destroyed) return;

        const file = Gio.File.new_for_path(path);
        try {
            file.load_contents_async(this._metricsCancellable, (source, result) => {
                if (this._destroyed) return;

                try {
                    const [success, contents] = source.load_contents_finish(result);
                    callback(success ? ByteArray.toString(contents).trim() : null);
                } catch {
                    callback(null);
                }
            });
        } catch {
            callback(null);
        }
    }

    _enumerateDirectoryAsync(path, callback) {
        const base = Gio.File.new_for_path(path);

        try {
            base.enumerate_children_async(
                "standard::name",
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_LOW,
                this._metricsCancellable,
                (source, result) => {
                    if (this._destroyed) return;

                    let enumerator;
                    try {
                        enumerator = source.enumerate_children_finish(result);
                    } catch (error) {
                        callback([], error);
                        return;
                    }

                    const entries = [];
                    const readNext = () => {
                        if (this._destroyed) {
                            try {
                                enumerator.close(null);
                            } catch {
                                // The applet is being removed; close is best effort.
                            }
                            return;
                        }

                        enumerator.next_files_async(
                            32,
                            GLib.PRIORITY_LOW,
                            this._metricsCancellable,
                            (enumeratorSource, nextResult) => {
                                if (this._destroyed) return;

                                try {
                                    const batch = enumeratorSource.next_files_finish(nextResult);
                                    if (batch.length === 0) {
                                        enumerator.close(null);
                                        callback(entries, null);
                                        return;
                                    }
                                    entries.push(...batch);
                                    readNext();
                                } catch (error) {
                                    try {
                                        enumerator.close(null);
                                    } catch {
                                        // The enumerator is already failing; close is best effort.
                                    }
                                    callback([], error);
                                }
                            }
                        );
                    };

                    readNext();
                }
            );
        } catch (error) {
            callback([], error);
        }
    }

    _discoverCpuTemperaturePath() {
        if (this._cpuTempDiscoveryPending || this._destroyed) return;

        this._cpuTempDiscoveryPending = true;
        this._enumerateDirectoryAsync(HWMON_PATH, (entries, error) => {
            if (this._destroyed) return;
            if (error) global.logWarning(`${UUID}: could not inspect hwmon: ${error}`);

            if (error) {
                this._collectThermalCandidates(0, [], candidates => this._finishCpuTemperatureDiscovery(candidates));
                return;
            }

            const candidates = [];
            this._collectHwmonCandidates(entries, 0, candidates, () => {
                if (candidates.length > 0) {
                    this._finishCpuTemperatureDiscovery(candidates);
                    return;
                }
                this._collectThermalCandidates(0, [], found => this._finishCpuTemperatureDiscovery(found));
            });
        });
    }

    _collectHwmonCandidates(entries, entryIndex, candidates, done) {
        if (this._destroyed) return;
        if (entryIndex >= entries.length) {
            done();
            return;
        }

        const directory = `${HWMON_PATH}/${entries[entryIndex].get_name()}`;
        this._readTextFileAsync(`${directory}/name`, chipText => {
            const chip = (chipText || "").toLowerCase();
            const inspect = temperatureIndex => {
                if (temperatureIndex > 16) {
                    this._collectHwmonCandidates(entries, entryIndex + 1, candidates, done);
                    return;
                }

                const inputPath = `${directory}/temp${temperatureIndex}_input`;
                this._readTextFileAsync(inputPath, inputText => {
                    if (inputText === null) {
                        inspect(temperatureIndex + 1);
                        return;
                    }

                    this._readTextFileAsync(`${directory}/temp${temperatureIndex}_label`, labelText => {
                        const label = (labelText || "").toLowerCase();
                        let score = 0;
                        if (["k10temp", "coretemp", "zenpower"].includes(chip)) score += 100;
                        if (/tctl|tdie|package|cpu/.test(label)) score += 50;
                        if (/nvme|amdgpu|battery|wifi/.test(chip)) score -= 100;
                        candidates.push({ path: inputPath, score });
                        inspect(temperatureIndex + 1);
                    });
                });
            };

            inspect(1);
        });
    }

    _collectThermalCandidates(index, candidates, done) {
        if (this._destroyed) return;
        if (index >= 32) {
            done(candidates);
            return;
        }

        const directory = `${THERMAL_PATH}/thermal_zone${index}`;
        const inputPath = `${directory}/temp`;
        this._readTextFileAsync(inputPath, inputText => {
            if (inputText === null) {
                this._collectThermalCandidates(index + 1, candidates, done);
                return;
            }

            this._readTextFileAsync(`${directory}/type`, typeText => {
                const type = (typeText || "").toLowerCase();
                const score = /cpu|pkg|x86/.test(type) ? 50 : 0;
                candidates.push({ path: inputPath, score });
                this._collectThermalCandidates(index + 1, candidates, done);
            });
        });
    }

    _finishCpuTemperatureDiscovery(candidates) {
        candidates.sort((left, right) => right.score - left.score);
        this._cpuTempPath = candidates.length > 0 ? candidates[0].path : null;
        this._cpuTempDiscoveryPending = false;

        if (this._cpuTempPath && !this._destroyed && !this._metricsBusy) {
            this._updateSystemMetrics();
        }
    }

    _formatKiB(value) {
        if (!Number.isFinite(value) || value <= 0) return "0 MiB";
        if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} GiB`;
        return `${Math.round(value / 1024)} MiB`;
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._gpuCancellable) {
            this._gpuCancellable.cancel();
            this._gpuCancellable = null;
        }
        if (this._metricsCancellable) {
            this._metricsCancellable.cancel();
            this._metricsCancellable = null;
        }
        if (this.settings) this.settings.finalize();
    }
}

// Cinnamon loads this entry point by name.
// eslint-disable-next-line no-unused-vars
function main(metadata, orientation, panelHeight, instanceId) {
    return new AdaptiveSystemMonitorApplet(metadata, orientation, panelHeight, instanceId);
}
