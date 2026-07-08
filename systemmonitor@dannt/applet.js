const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const UUID = "systemmonitor@dannt";
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
        this._detect_gpu();
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

        this._update_loop();
        
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
    _read_meminfo_async: function(callback) {
        let file = Gio.File.new_for_path("/proc/meminfo");

        file.load_contents_async(null, (source, result) => {
            try {
                let [success, contents] = source.load_contents_finish(result);
                if (success) {
                    callback(imports.byteArray.toString(contents));
                } else {
                    callback(null);
                }
            } catch (e) {
                global.logError("Error leyendo el meminfo (async): " + e.message);
            }
        });
    },
    _read_cpu_async: function(callback) {
        let filecpu = Gio.File.new_for_path("/proc/stat");

        filecpu.load_contents_async(null, (source, result) => {
                try {
                    let [success, contents] = source.load_contents_finish(result);
                if (!success) {
                    callback(null);
                    return;
                }
                let text = imports.byteArray.toString(contents);
                let firstLine = text.split("\n")[0];
                let parts = firstLine.trim().split(/\s+/);

                let numbers = parts.slice(1).map(n => parseInt(n));
                let idle = numbers[3];
                let total = numbers.reduce((suma, n) => suma + n, 0);

                callback({
                    idle: idle, total: total
                })
            }catch (e) {
                global.logError("Error leyendo /proc/stat:" + e.message);
            }


        })
    },
    _detect_gpu: function() {
        let amdCandidates = [
            "/sys/class/drm/card0/device/gpu_busy_percent",
            "/sys/class/drm/card1/device/gpu_busy_percent",
            "/sys/class/drm/card2/device/gpu_busy_percent",
            "/sys/class/drm/card3/device/gpu_busy_percent"
        ];
        for (let path of amdCandidates){
            if(GLib.file_test(path, GLib.FileTest.EXISTS)){
                this.gpuVendor = "amd";
                this.gpuBusyPath = path;
                this.gpuVramPath = path.replace("gpu_busy_percent", "mem_info_vram_used");
                return;

            }
        }
        let intelCandidates = [
            "/sys/class/drm/card0/gt_act_freq_mhz",
            "/sys/class/drm/card1/gt_act_freq_mhz",
            "/sys/class/drm/card2/gt_act_freq_mhz",
            "/sys/class/drm/card3/gt_act_freq_mhz"
        ]
        for (let path of intelCandidates) {
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                this.gpuVendor = "intel";
                this.gpuActFreqPath = path;
                this.gpuMaxFreqPath = path.replace("gt_act_freq_mhz", "gt_max_freq_mhz");
                
                let intelVramCandidates = [
                    path.replace("gt_act_freq_mhz", "mem_info_vram_used"),
                    "/sys/class/drm/card0/device/mem_info_vram_used",
                    "/sys/class/drm/card1/device/mem_info_vram_used",
                    "/sys/class/drm/card2/device/mem_info_vram_used",
                    "/sys/class/drm/card3/device/mem_info_vram_used"
                ];
                this.gpuVramPath = null;
                for (let vramPath of intelVramCandidates) {
                    if (GLib.file_test(vramPath, GLib.FileTest.EXISTS)) {
                        this.gpuVramPath = vramPath;
                        break;
                    }
                }
                return;
            }
        }

        let nvidiaPath = GLib.find_program_in_path("nvidia-smi");
        if(nvidiaPath) {
            this.gpuVendor = "nvidia";
        } else {
            this.gpuVendor = "unknow";
            global.log("GPU NO DETECTED");
        }

        
    },
    _read_gpu_async: function(callback) {
        if (this.gpuVendor === "amd") {
            let fileGPU = Gio.File.new_for_path(this.gpuBusyPath);
            fileGPU.load_contents_async(null, (source, result) => {
                try {
                    let [success, contents] = source.load_contents_finish(result);
                    if (success) {
                        let percent = parseInt(imports.byteArray.toString(contents).trim());
                        callback({
                            vendor: "amd", percent: percent
                        });
                    } else {
                        callback ({
                            vendor: "amd", percent: null
                        })
                    }
                } catch (e) {
                    global.logError("Error al leer GPU (amd)" + e.message);
                    callback({
                        vendor: "amd", percent: null
                    })
                }
            });
        } else if (this.gpuVendor == "intel") {
            let fileAct = Gio.File.new_for_path(this.gpuActFreqPath);
            fileAct.load_contents_async(null, (source, result) => {
                try {
                    let [success, contents] = source.load_contents_finish(result);
                    if (!success) {
                        callback({
                            vendor:"intel", percent: null
                        });
                        return;
                    }
                    let actFreq = parseInt(imports.byteArray.toString(contents).trim());

                    let [successMax, contentsMax] = GLib.file_get_contents(this.gpuMaxFreqPath);
                    let maxFreq = successMax ? parseInt(imports.byteArray.toString(contentsMax).trim()): 1;
                    let percent = maxFreq > 0 ? Math.round((actFreq / maxFreq) * 100) : 0;
                    callback ({
                        vendor:"intel", percent: percent
                    });
                } catch (e) {
                    global.logError("Error al leer GPU (intel)" + e.message);
                    callback({
                        vendor:"intel", percent: null
                    });
                }
            });
        } else {
            callback({
                vendor: this.gpuVendor, percent: null
            })
        }
    },
    _read_vram_async: function(callback) {
        if (this.gpuVendor == "amd") {
            let fileVram = Gio.File.new_for_path(this.gpuVramPath);
            fileVram.load_contents_async(null, (source, result) => {
                try {
                    let [success, contents] = source.load_contents_finish(result);
                    if (success) {
                        let bytes = parseInt(imports.byteArray.toString(contents).trim());
                        callback({
                            vendor: "amd", bytes: bytes
                        });
                    } else {
                        callback ({
                            vendor: "amd", bytes: null
                        });
                    }
                }catch (e) {
                    global.logError("Error al leer VRAM (amd):" + e.message);
                    callback({
                        vendor: "amd", bytes: null
                    });
                }
            });
        } else if (this.gpuVendor == "intel") {
            if (this.gpuVramPath) {
                let fileVram = Gio.File.new_for_path(this.gpuVramPath);
                fileVram.load_contents_async(null, (source, result) => {
                    try {
                        let [success, contents] = source.load_contents_finish(result);
                        if (success) {
                            let bytes = parseInt(imports.byteArray.toString(contents).trim());
                            callback({
                                vendor: "intel", bytes: bytes
                            });
                        } else {
                            callback ({
                                vendor: "intel", bytes: null
                            });
                        }
                    } catch (e) {
                        global.logError("Error al leer VRAM (intel):" + e.message);
                        callback({
                            vendor: "intel", bytes: null
                        });
                    }
                });
            } else {
                callback({
                    vendor: "intel", bytes: null
                });
            }
        } else {
            callback ({
                vendor: this.gpuVendor, bytes: null
            });
        }
    },
    _update_loop: function() {

        let pending = 4;

        let checkDone = () => {
            pending --;
            if (pending === 0) {
                this.loopId = Mainloop.timeout_add(this.updateFrequency, () => {
                    this._update_loop();
                    return false;
                })
            }
        }
        this._read_meminfo_async((data) =>{
            let memTotalKB = parseInt(data.match(/MemTotal:\s+(\d+)/)?.[1] || 0);
            let memAvailableKB = parseInt(data.match(/MemAvailable:\s+(\d+)/)?.[1] || 0);
            let swapTotal = parseInt(data.match(/SwapTotal:\s+(\d+)/)?.[1] || 0);
            let swapfree = parseInt(data.match(/SwapFree:\s+(\d+)/)?.[1] || 0);

            let ramUsageKB = memTotalKB - memAvailableKB;
            let swapUsageKB = swapTotal - swapfree;

            let ramGB = (ramUsageKB / (1024 * 1024)).toFixed(2) + "GB";
            let swapGB = (swapUsageKB / (1024 * 1024)).toFixed(2) + "GB";

            this.ramLabel.set_text(ramGB);
            this.swapLabel.set_text(swapGB);

            checkDone();

        });
        this._read_cpu_async((cpuData) => {
            let deltaTotal = cpuData.total - this.lastCpuTotal;
            let deltaIdle = cpuData.idle - this.lastCpuIdle;

            let cpuUsage = 0;
            if (deltaTotal > 0) {
                cpuUsage = ((deltaTotal - deltaIdle) / deltaTotal) * 100;
            }
            this.lastCpuTotal = cpuData.total;
            this.lastCpuIdle = cpuData.idle;

            this.cpuLabel.set_text(cpuUsage.toFixed(1) + "%");
            checkDone();
        });
        this._read_gpu_async((gpuData => {
            if (gpuData.percent !== null) {
                this.gpuLabel.set_text(gpuData.percent + "%");
            } else {
                this.gpuLabel.set_text("N/A");
            }
            checkDone();
        }));
        this._read_vram_async((vramData) => {
            if (vramData.bytes !== null) {
                let vramGB = (vramData.bytes / (1024 * 1024 * 1024)).toFixed(2) + "GB";
                this.vramLabel.set_text(vramGB);
            } else {
                this.vramLabel.set_text("N/A");
            }
            checkDone();
        })
    },
    on_applet_clicked: function(event){
        GLib.spawn_command_line_async("gnome-system-monitor");
    },
    on_applet_removed_from_panel: function() {
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new SystemMonitor(metadata, orientation, panel_height, instance_id);
}
