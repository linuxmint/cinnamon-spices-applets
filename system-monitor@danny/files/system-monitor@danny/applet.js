const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const UUID = "system-monitor@danny";
const ICONS_DIR = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + UUID + "/icons";
const Mainloop = imports.mainloop;

function SystemMonitor(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

SystemMonitor.prototype = {
    __proto__: Applet.Applet.prototype,
    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        //cpu and gpu
        this.lastCpuTotal = 0;
        this.lastCpuIdle = 0;
        this.loopId = null;
        this.destroyed = false;
        this.gpuVendor = "unknown";
        this.gpuBusyPath = null;
        this.gpuVramPath = null;
        this.gpuActFreqPath = null;
        this.gpuMinFreq = null;
        this.gpuMaxFreq = null;
        //settings 
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "refresh-interval",
            "updateFrequency",
            null,
            null
        );
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "ram-font-size",
            "ramFontSize",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "ram-color",
            "ramColor",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "swap-font-size",
            "swapFontSize",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "swap-color",
            "swapColor",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "show-ram",
            "ShowRam",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "show-swap",
            "ShowSwap",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "show-cpu",
            "ShowCpu",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "cpu-size",
            "cpuSizeFont",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "cpu-color",
            "cpuColorFont",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "show-gpu",
            "ShowGpu",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "gpu-size",
            "gpuSizeFont",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "gpu-color",
            "gpuColorFont",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "show-vram",
            "ShowVram",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "vram-size",
            "vramSizeFont",
            this._on_settings_changed,
            null
        )
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "vram-color",
            "vramColorFont",
            this._on_settings_changed,
            null
        )

        //label
        this.cpuBox = new St.BoxLayout ({
            style_class: "monitor-box" 
        });
        this.gpuBox = new St.BoxLayout ({
            style_class: "monitor-box"
        })
        this.vramBox = new St.BoxLayout ({
            style_class: "monitor-box"
        })
        this.ramBox = new St.BoxLayout({
            style_class: "monitor-box"
        });
        this.swapBox = new St.BoxLayout({
            style_class:"monitor-box"
        });
        this.cpuLabel = new St.Label ({
            text: "0%",
            style: "font-size:" + this.cpuSizeFont + "px; color:" + this.cpuColorFont + ";"
        });
        this.gpuLabel = new St.Label ({
            text: "0%",
            style: "font-size:" + this.gpuSizeFont + "px; color:" + this.gpuColorFont + ";"
        });
        this.vramLabel = new St.Label ({
            text: "0%",
            style: "font-size:" + this.vramSizeFont + "px; color:" + this.vramColorFont + ";"
        });
        this.ramLabel = new St.Label ({
            text: "0.00GB",
            style: "font-size:" + this.ramFontSize + "px; color:" + this.ramColor + ";"
        });
        this.swapLabel = new St.Label ({
            text: "0.00GB",
            style: "font-size:" + this.swapFontSize + "px; color:" + this.swapColor + ";"
        })
        this.cpuIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(ICONS_DIR + "/cpu.svg"),
            icon_size: 16
        })
        this.gpuIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(ICONS_DIR + "/gpu.svg"),
            icon_size: 16
        })
        this.vramIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(ICONS_DIR + "/vram.svg"),
            icon_size: 16
        });
        this.ramIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(ICONS_DIR + "/ram.svg"),
            icon_size: 16
        });
        this.swapIcon = new St.Icon({
            gicon: Gio.icon_new_for_string(ICONS_DIR + "/swap.svg"),
            icon_size: 16
        })
        //cpu show 
        this.cpusep = new St.Label({
            text: "|", style: "color: #888888; padding: 0 5px; font-size:" + this.cpuSizeFont + "px;"
        })
        this.cpuBox.visible = this.ShowCpu;
        this.cpuBox.add(this.cpusep, {y_align: St.Align.MIDDLE})
        this.cpuBox.add(this.cpuIcon, {y_align: St.Align.MIDDLE});
        this.cpuBox.add(this.cpuLabel, {y_align: St.Align.MIDDLE});
        this.actor.add(this.cpuBox, {y_align: St.Align.MIDDLE});
        //gpu show 
        this.gpusep = new St.Label({
            text: "|", style: "color: #888888; padding: 0 5px; font-size:" + this.gpuSizeFont + "px;"
        })
        this.gpuBox.visible = this.ShowGpu;
        this.gpuBox.add(this.gpusep, {y_align: St.Align.MIDDLE})
        this.gpuBox.add(this.gpuIcon, {y_align: St.Align.MIDDLE});
        this.gpuBox.add(this.gpuLabel, {y_align: St.Align.MIDDLE});
        this.actor.add(this.gpuBox, {y_align: St.Align.MIDDLE});
        //vram show 
        this.vramsep = new St.Label({
            text: "|", style: "color: #888888; padding: 0 5px; font-size:" + this.vramSizeFont + "px;"
        })
        this.vramBox.visible = this.ShowVram;
        this.vramBox.add(this.vramsep, {y_align: St.Align.MIDDLE})
        this.vramBox.add(this.vramIcon, {y_align: St.Align.MIDDLE});
        this.vramBox.add(this.vramLabel, {y_align: St.Align.MIDDLE});
        this.actor.add(this.vramBox, {y_align: St.Align.MIDDLE});
        //ram show 
        this.ramsep = new St.Label({
            text: "|", style: "color: #888888; padding: 0 5px; font-size:" + this.ramFontSize + "px;"
        });
        this.ramBox.visible = this.ShowRam;
        this.ramBox.add(this.ramsep, {y_align: St.Align.MIDDLE})
        this.ramBox.add(this.ramIcon, {y_align: St.Align.MIDDLE});
        this.ramBox.add(this.ramLabel, {y_align: St.Align.MIDDLE});
        this.actor.add(this.ramBox, {y_align: St.Align.MIDDLE});
        //swap show 
        this.swapsep = new St.Label({
            text: "|", style: "color: #888888; padding: 0 5px; font-size:" + this.swapFontSize + "px;"
        });
        this.swapBox.visible = this.ShowSwap;
        this.swapBox.add(this.swapsep, {y_align: St.Align.MIDDLE})
        this.swapBox.add(this.swapIcon, {y_align: St.Align.MIDDLE});
        this.swapBox.add(this.swapLabel, {y_align: St.Align.MIDDLE});
        this.actor.add(this.swapBox, {y_align: St.Align.MIDDLE});

        // La deteccion de GPU es asincrona: el bucle arranca cuando termina.
        this._detect_gpu(() => {
            if (!this.destroyed) {
                this._update_loop();
            }
        });
    },
    _on_settings_changed: function() {
        if (this.ramLabel) {
            this.ramLabel.set_style("font-size:" + this.ramFontSize + "px; color:" + this.ramColor + ";");
        }
        if (this.swapLabel) {
            this.swapLabel.set_style("font-size:" + this.swapFontSize + "px; color:" + this.swapColor + ";");
        }
        if (this.ramBox) {
            this.ramBox.visible = this.ShowRam;
        }
        if (this.swapBox) {
            this.swapBox.visible = this.ShowSwap;
        }
        if (this.cpuLabel) {
            this.cpuLabel.set_style("font-size:" + this.cpuSizeFont + "px; color:" + this.cpuColorFont + ";");
        }
        if (this.cpuBox) {
            this.cpuBox.visible = this.ShowCpu;
        }
        if (this.gpuLabel) {
            this.gpuLabel.set_style("font-size:" + this.gpuSizeFont + "px; color:" + this.gpuColorFont + ";");
        }
        if (this.gpuBox) {
            this.gpuBox.visible = this.ShowGpu;
        }
        if (this.vramLabel) {
            this.vramLabel.set_style("font-size:" + this.vramSizeFont + "px; color:" + this.vramColorFont + ";");
        }
        if (this.vramBox) {
            this.vramBox.visible = this.ShowVram;
        }
        
    },

    // ---------- Helpers asincronos ----------

    // Lee un archivo completo. SIEMPRE llama a callback: con el texto, o con null si fallo.
    _read_file_async: function(path, callback) {
        let file = Gio.File.new_for_path(path);
        file.load_contents_async(null, (source, result) => {
            let text = null;
            try {
                let [success, contents] = source.load_contents_finish(result);
                if (success) {
                    text = imports.byteArray.toString(contents);
                }
            } catch (e) {
                global.logError("Error leyendo " + path + ": " + e.message);
            }
            callback(text);
        });
    },
    // Comprueba si una ruta existe sin bloquear. SIEMPRE llama a callback(true/false).
    _file_exists_async: function(path, callback) {
        let file = Gio.File.new_for_path(path);
        file.query_info_async(
            "standard::name",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (source, result) => {
                let exists = false;
                try {
                    source.query_info_finish(result);
                    exists = true;
                } catch (e) {
                    exists = false;
                }
                callback(exists);
            }
        );
    },
    // Devuelve (por callback) la primera ruta de la lista que exista, o null.
    _find_first_existing_async: function(paths, callback) {
        let index = 0;
        let next = () => {
            if (index >= paths.length) {
                callback(null);
                return;
            }
            let path = paths[index];
            index++;
            this._file_exists_async(path, (exists) => {
                if (exists) {
                    callback(path);
                } else {
                    next();
                }
            });
        };
        next();
    },

    // ---------- Deteccion de GPU ----------

    _detect_gpu: function(callback) {
        let cards = [0, 1, 2, 3];
        let amdCandidates = cards.map(n => "/sys/class/drm/card" + n + "/device/gpu_busy_percent");
        let intelCandidates = cards.map(n => "/sys/class/drm/card" + n + "/gt_act_freq_mhz");

        this._find_first_existing_async(amdCandidates, (amdPath) => {
            if (amdPath) {
                this.gpuVendor = "amd";
                this.gpuBusyPath = amdPath;
                this.gpuVramPath = amdPath.replace("gpu_busy_percent", "mem_info_vram_used");
                callback();
                return;
            }
            this._find_first_existing_async(intelCandidates, (intelPath) => {
                if (intelPath) {
                    this.gpuVendor = "intel";
                    this.gpuActFreqPath = intelPath;
                    // Las iGPU Intel no exponen VRAM por sysfs (comparten la RAM del sistema).
                    this.gpuVramPath = null;
                    this._read_intel_freq_limits(intelPath, callback);
                    return;
                }
                // nvidia: solo se detecta, aun no se lee (queda en N/A).
                this._file_exists_async("/proc/driver/nvidia", (hasNvidia) => {
                    if (hasNvidia) {
                        this.gpuVendor = "nvidia";
                    } else {
                        this.gpuVendor = "unknown";
                        global.log("GPU NO DETECTED");
                    }
                    callback();
                });
            });
        });
    },
    // Lee min y max de frecuencia una sola vez y los guarda.
    _read_intel_freq_limits: function(actPath, callback) {
        let minPath = actPath.replace("gt_act_freq_mhz", "gt_min_freq_mhz");
        let maxPath = actPath.replace("gt_act_freq_mhz", "gt_max_freq_mhz");

        this._read_file_async(minPath, (minText) => {
            this._read_file_async(maxPath, (maxText) => {
                let min = minText !== null ? parseInt(minText.trim()) : NaN;
                let max = maxText !== null ? parseInt(maxText.trim()) : NaN;
                this.gpuMinFreq = isNaN(min) ? 0 : min;
                this.gpuMaxFreq = isNaN(max) ? null : max;
                callback();
            });
        });
    },

    // ---------- Lecturas ----------

    _read_gpu_async: function(callback) {
        if (this.gpuVendor === "amd") {
            this._read_file_async(this.gpuBusyPath, (text) => {
                let percent = text !== null ? parseInt(text.trim()) : NaN;
                callback({
                    vendor: "amd", percent: isNaN(percent) ? null : percent
                });
            });
        } else if (this.gpuVendor === "intel") {
            this._read_file_async(this.gpuActFreqPath, (text) => {
                let actFreq = text !== null ? parseInt(text.trim()) : NaN;
                if (isNaN(actFreq) || this.gpuMaxFreq === null) {
                    callback({ vendor: "intel", percent: null });
                    return;
                }
                let range = this.gpuMaxFreq - this.gpuMinFreq;
                let percent = range > 0 ? Math.round(((actFreq - this.gpuMinFreq) / range) * 100) : 0;
                percent = Math.max(0, Math.min(100, percent));
                callback({ vendor: "intel", percent: percent });
            });
        } else {
            callback({
                vendor: this.gpuVendor, percent: null
            });
        }
    },
    _read_vram_async: function(callback) {
        if (this.gpuVramPath) {
            this._read_file_async(this.gpuVramPath, (text) => {
                let bytes = text !== null ? parseInt(text.trim()) : NaN;
                callback({
                    vendor: this.gpuVendor, bytes: isNaN(bytes) ? null : bytes
                });
            });
        } else {
            callback({
                vendor: this.gpuVendor, bytes: null
            });
        }
    },
    _update_loop: function() {
        if (this.destroyed) {
            return;
        }

        let pending = 4;

        let checkDone = () => {
            pending--;
            if (pending === 0 && !this.destroyed) {
                this.loopId = Mainloop.timeout_add(this.updateFrequency, () => {
                    this.loopId = null;
                    this._update_loop();
                    return false;
                });
            }
        };

        this._read_file_async("/proc/meminfo", (data) => {
            if (data !== null) {
                let memTotalKB = parseInt(data.match(/MemTotal:\s+(\d+)/)?.[1] || 0);
                let memAvailableKB = parseInt(data.match(/MemAvailable:\s+(\d+)/)?.[1] || 0);
                let swapTotal = parseInt(data.match(/SwapTotal:\s+(\d+)/)?.[1] || 0);
                let swapfree = parseInt(data.match(/SwapFree:\s+(\d+)/)?.[1] || 0);

                let ramUsageKB = memTotalKB - memAvailableKB;
                let swapUsageKB = swapTotal - swapfree;

                this.ramLabel.set_text((ramUsageKB / (1024 * 1024)).toFixed(2) + "GB");
                this.swapLabel.set_text((swapUsageKB / (1024 * 1024)).toFixed(2) + "GB");
            } else {
                this.ramLabel.set_text("N/A");
                this.swapLabel.set_text("N/A");
            }
            checkDone();
        });

        this._read_file_async("/proc/stat", (text) => {
            if (text !== null) {
                let firstLine = text.split("\n")[0];
                let parts = firstLine.trim().split(/\s+/);
                let numbers = parts.slice(1).map(n => parseInt(n));
                let idle = numbers[3];
                let total = numbers.reduce((suma, n) => suma + n, 0);

                let deltaTotal = total - this.lastCpuTotal;
                let deltaIdle = idle - this.lastCpuIdle;

                let cpuUsage = 0;
                if (deltaTotal > 0) {
                    cpuUsage = ((deltaTotal - deltaIdle) / deltaTotal) * 100;
                }
                this.lastCpuTotal = total;
                this.lastCpuIdle = idle;

                this.cpuLabel.set_text(cpuUsage.toFixed(1) + "%");
            } else {
                this.cpuLabel.set_text("N/A");
            }
            checkDone();
        });

        this._read_gpu_async((gpuData) => {
            if (gpuData.percent !== null) {
                this.gpuLabel.set_text(gpuData.percent + "%");
            } else {
                this.gpuLabel.set_text("N/A");
            }
            checkDone();
        });

        this._read_vram_async((vramData) => {
            if (vramData.bytes !== null) {
                let vramGB = (vramData.bytes / (1024 * 1024 * 1024)).toFixed(2) + "GB";
                this.vramLabel.set_text(vramGB);
            } else {
                this.vramLabel.set_text("N/A");
            }
            checkDone();
        });
    },
    on_applet_clicked: function(event){
        GLib.spawn_command_line_async("gnome-system-monitor");
    },
    on_applet_removed_from_panel: function() {
        this.destroyed = true;
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
            this.loopId = null;
        }
        if (this.settings) {
            this.settings.finalize();
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new SystemMonitor(metadata, orientation, panel_height, instance_id);
}