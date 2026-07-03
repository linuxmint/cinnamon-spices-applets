const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;

let GTop = null;
try { GTop = imports.gi.GTop; } catch(e) {}

const UUID = "SystemMonitor@danny";

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_tooltip("Monitor de Sistema");
        this.tools = new Tools();

        this.cpuProvider = GTop ? new CpuProvider() : null;
        this.shouldUpdate = true;

        // Corrección de rutas dinámicas usando metadata.path
        this.iconsDir = metadata.path + "/icons";
        this.iconCpu  = this.iconsDir + "/cpu.svg";
        this.iconRam  = this.iconsDir + "/ram.svg";
        this.iconSwap = this.iconsDir + "/swap.svg";
        this.iconGpu  = this.iconsDir + "/gpu.svg";
        this.iconVram = this.iconsDir + "/vram.svg";

        // Corrección de localización respetando XDG_DATA_HOME
        let localeDir = Gio.File.new_for_path(GLib.get_user_data_dir()).get_child("locale").get_path();
        Gettext.bindtextdomain(UUID, localeDir);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        this.settings.bindProperty(Settings.BindingDirection.IN, "refresh-interval", "updateFrequency", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-cpu", "showCpu", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-ram", "showRam", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-swap", "showSwap", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-gpu", "showGpu", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-vram", "showVram", this._on_settings_changed, null);

        this._update_loop();
    },

    _on_settings_changed: function() {
        // Callback para cambios de configuración si es necesario
    },

    // Corrección: Carga de archivos no bloqueante usando Gio.File
    _read_sys_file: function(path) {
        try {
            let file = Gio.File.new_for_path(path);
            let [success, content] = file.load_contents(null);
            if (success && content) {
                return String.fromCharCode.apply(null, content).trim();
            }
        } catch(e) {}
        return "0";
    },

    // Corrección: Reemplazo de GLib.file_test por Gio para evitar bloqueos en sistemas lentos
    _find_gpu_file: function(fileName) {
        let paths = [
            "/sys/class/drm/card0/device/" + fileName,
            "/sys/class/drm/card1/device/" + fileName
        ];
        for (let fullPath of paths) {
            try {
                let file = Gio.File.new_for_path(fullPath);
                if (file.query_exists(null)) {
                    return fullPath;
                }
            } catch (e) {}
        }
        return null;
    },

    // Corrección: Ejecución asíncrona real mediante vectores (argv) con Gio.Subprocess
    _run_nvidia_command_async: function(callback) {
        try {
            let argv = ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used", "--format=csv,noheader,nounits"];
            let proc = new Gio.Subprocess({
                argv: argv,
                flags: Gio.SubprocessFlags.STDOUT_PIPE
            });

            proc.init(null);
            proc.communicate_utf8_async(null, null, (obj, res) => {
                try {
                    let [success, stdout, stderr] = obj.communicate_utf8_finish(res);
                    if (success && stdout) {
                        callback(stdout.trim());
                    } else {
                        callback("");
                    }
                } catch (e) {
                    callback("");
                }
            });
        } catch (e) {
            callback("");
        }
    },

    _update_loop: function() {
        try {
            // 1. PROCESAR CPU
            let cpu = 0;
            if (this.showCpu && this.cpuProvider) {
                cpu = this.cpuProvider.getUsage();
            }

            // 2. PROCESAR RAM Y SWAP
            let ramGB = "0.00GB";
            let swapGB = "0.00GB";
            if (this.showRam || this.showSwap) {
                let meminfo = this._read_sys_file("/proc/meminfo") || "";
                if (this.showRam) {
                    let memTotal = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] || 0);
                    let memAvail = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] || 0);
                    ramGB = this.tools.formatGB((memTotal - memAvail) * 1024);
                }
                if (this.showSwap) {
                    let swapTotal = parseInt(meminfo.match(/SwapTotal:\s+(\d+)/)?.[1] || 0);
                    let swapFree = parseInt(meminfo.match(/SwapFree:\s+(\d+)/)?.[1] || 0);
                    swapGB = this.tools.formatGB((swapTotal - swapFree) * 1024);
                }
            }

            // 3. PROCESAR GRÁFICOS (AMD / INTEL / NVIDIA)
            if (this.showGpu || this.showVram) {
                let amdFile = this._find_gpu_file("gpu_busy_percent");

                if (amdFile) {
                    let gpuPercent = parseInt(this._read_sys_file(amdFile) || 0);
                    let vramPath = amdFile.replace("gpu_busy_percent", "mem_info_vram_used");
                    let vramUsed = parseInt(this._read_sys_file(vramPath) || 0);
                    let vramGB = this.tools.formatGB(vramUsed);

                    this._render_interface(cpu, ramGB, swapGB, gpuPercent, vramGB);
                }
                else {
                    let intelActFreqFile = this._find_gpu_file("gt_act_freq_mhz");
                    let intelMaxFreqFile = this._find_gpu_file("gt_max_freq_mhz");

                    if (intelActFreqFile && intelMaxFreqFile) {
                        let actFreq = parseInt(this._read_sys_file(intelActFreqFile) || 0);
                        let maxFreq = parseInt(this._read_sys_file(intelMaxFreqFile) || 1);
                        let gpuPercent = Math.round((actFreq / maxFreq) * 100);
                        let vramGB = "Compartida";

                        this._render_interface(cpu, ramGB, swapGB, gpuPercent, vramGB);
                    }
                    else {
                        // Flujo Asíncrono para Nvidia: delegamos el renderizado al callback
                        this._run_nvidia_command_async((nvidiaData) => {
                            let gpuPercent = 0;
                            let vramGB = "N/A";

                            if (nvidiaData) {
                                let parts = nvidiaData.split(",");
                                if (parts.length >= 2){
                                    gpuPercent = parseInt(parts[0].trim() || 0);
                                    let vramUsedBytes = parseInt(parts[1].trim() || 0) * 1024 * 1024;
                                    vramGB = this.tools.formatGB(vramUsedBytes);
                                }
                            }
                            this._render_interface(cpu, ramGB, swapGB, gpuPercent, vramGB);
                        });
                        return; // Salimos temprano; el callback se encargará de dibujar e iterar
                    }
                }
            } else {
                // Si no hay GPUs que mostrar, renderizamos inmediatamente
                this._render_interface(cpu, ramGB, swapGB, 0, "0.00GB");
            }

        } catch (err) {
            this._handle_error(err);
        }

        this._queue_next_update();
    },

    _render_interface: function(cpu, ramGB, swapGB, gpuPercent, vramGB) {
        this.actor.destroy_all_children();

        let components = [
            { show: this.showCpu,  icon: this.iconCpu,  text: `${cpu.toFixed(1)}%` },
            { show: this.showRam,  icon: this.iconRam,  text: `${ramGB}` },
            { show: this.showSwap, icon: this.iconSwap, text: `${swapGB}` },
            { show: this.showGpu,  icon: this.iconGpu,  text: `${gpuPercent}%` },
            { show: this.showVram, icon: this.iconVram, text: `${vramGB}` }
        ];

        let activeComponents = components.filter(c => c.show);

        if (activeComponents.length === 0) {
            let layoutBin = new St.Bin();
            let l = new St.Label({ text: "Monitor Apagado" });
            layoutBin.set_child(l);
            this.actor.add(layoutBin, { y_align: St.Align.MIDDLE, y_fill: false });
        } else {
            for (let i = 0; i < activeComponents.length; i++) {
                let item = activeComponents[i];

                if (i > 0) {
                    let sepBin = new St.Bin();
                    let sepLabel = new St.Label({ text: " | ", style: "color: #555555; margin: 0 6px;" });
                    sepBin.set_child(sepLabel);
                    this.actor.add(sepBin, { y_align: St.Align.MIDDLE, y_fill: false });
                }

                let targetSize = 16;

                let iconBin = new St.Bin({
                    y_align: St.Align.MIDDLE,
                    x_align: St.Align.MIDDLE,
                    height: targetSize,
                    width: targetSize
                });

                let gicon = Gio.icon_new_for_string(item.icon);

                let icon = new St.Icon({
                    gicon: gicon,
                    icon_size: targetSize,
                    width: targetSize,
                    height: targetSize,
                    icon_type: St.IconType.FULLCOLOR
                });

                iconBin.set_child(icon);
                this.actor.add(iconBin, { y_align: St.Align.MIDDLE, y_fill: false });

                let textBin = new St.Bin();
                let label = new St.Label({ text: " " + item.text + " " });
                textBin.set_child(label);
                this.actor.add(textBin, { y_align: St.Align.MIDDLE, y_fill: false });
            }
        }
    },

    _queue_next_update: function() {
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
            this.loopId = null;
        }

        if (this.shouldUpdate) {
            this.loopId = Mainloop.timeout_add(this.updateFrequency, () => {
                this._update_loop();
                return false;
            });
        }
    },

    _handle_error: function(err) {
        global.logError("MONITOR_ERROR: " + err.message);
        this.actor.destroy_all_children();
        let errBin = new St.Bin();
        let errLabel = new St.Label({ text: "Error" });
        errBin.set_child(errLabel);
        this.actor.add(errBin, { y_align: St.Align.MIDDLE, y_fill: false });
    },

    on_applet_removed_from_panel: function() {
        this.shouldUpdate = false;
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
            this.loopId = null;
        }
    }
};

function _(str) {
    return Gettext.dgettext(UUID, str) || str;
}

class Tools {
    formatGB(bytes) {
        return (bytes / (1024*1024*1024)).toFixed(2) + "GB";
    }
}

class CpuProvider {
    constructor() {
        this.gtop = new GTop.glibtop_cpu();
        this.lastIdle = 0;
        this.lastTotal = 0;
        this.firstRun = true;
    }
    getUsage() {
        try {
            GTop.glibtop_get_cpu(this.gtop);
            if (this.firstRun) {
                this.lastIdle = this.gtop.idle;
                this.lastTotal = this.gtop.total;
                this.firstRun = false;
                return 0;
            }
            let deltaTotal = this.gtop.total - this.lastTotal;
            let deltaIdle = this.gtop.idle - this.lastIdle;
            let usage = 0;
            if (deltaTotal > 0) {
                usage = (deltaTotal - deltaIdle) / deltaTotal;
            }
            this.lastIdle = this.gtop.idle;
            this.lastTotal = this.gtop.total;
            return usage * 100;
        } catch(e) { return 0; }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
