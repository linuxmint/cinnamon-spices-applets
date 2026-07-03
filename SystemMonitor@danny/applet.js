const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio; // Manejador de rutas para iconos del sistema
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Gettext = imports.gettext;
const Settings = imports.ui.settings;

let GTop = null;
try { GTop = imports.gi.GTop; } catch(e) {}

const UUID = "SystemMonitor@danny";


const ICONS_DIR = GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + UUID + "/icons";

const ICON_CPU  = ICONS_DIR + "/cpu.svg";
const ICON_RAM  = ICONS_DIR + "/ram.svg";
const ICON_SWAP = ICONS_DIR + "/swap.svg";
const ICON_GPU  = ICONS_DIR + "/gpu.svg";
const ICON_VRAM = ICONS_DIR + "/vram.svg";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) { return Gettext.dgettext(UUID, str) || str; }

class Tools {
    formatGB(bytes) {
        return (bytes / (1024*1024*1024)).toFixed(2) + "GB";
    }
}

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

    },

    _read_sys_file: function(path) {
        try {
            let [success, content] = GLib.file_get_contents(path);
            if (success && content) return String.fromCharCode.apply(null, content).trim();
        } catch(e) {}
        return "0";
    },

    _find_gpu_file: function(fileName) {
        let paths = [
            "/sys/class/drm/card0/device/" + fileName,
            "/sys/class/drm/card1/device/" + fileName
        ];
        for (let fullPath of paths) {
            if (GLib.file_test(fullPath, GLib.FileTest.EXISTS)) {
                return fullPath;
            }
        }
        return null;
    },

    _run_command: function(cmd) {
        try {
            let [success, stdout] = GLib.spawn_command_line_sync(cmd);
            if (success && stdout) return String.fromCharCode.apply(null, stdout).trim();
        } catch(e) {}
        return "";
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

            // 3. PROCESAR GRÁFICOS
            let gpuPercent = 0;
            let vramGB = "0.00GB";

            if (this.showGpu || this.showVram) {
                let amdFile = this._find_gpu_file("gpu_busy_percent");

                if (amdFile) {
                    gpuPercent = parseInt(this._read_sys_file(amdFile) || 0);
                    let vramPath = amdFile.replace("gpu_busy_percent", "mem_info_vram_used");
                    let vramUsed = parseInt(this._read_sys_file(vramPath) || 0);
                    vramGB = this.tools.formatGB(vramUsed);
                }
                else {
                    let intelActFreqFile = this._find_gpu_file("gt_act_freq_mhz");
                    let intelMaxFreqFile = this._find_gpu_file("gt_max_freq_mhz");

                    if (intelActFreqFile && intelMaxFreqFile) {
                        let actFreq = parseInt(this._read_sys_file(intelActFreqFile) || 0);
                        let maxFreq = parseInt(this._read_sys_file(intelMaxFreqFile) || 1);
                        gpuPercent = Math.round((actFreq / maxFreq) * 100);
                        vramGB = "Compartida";
                    }
                    else {
                        let nvidiaData = this._run_command("nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits");
                        if (nvidiaData) {
                            let parts = nvidiaData.split(",");
                            if (parts.length >= 2){
                                gpuPercent = parseInt(parts[0].trim() || 0);
                                let vramUsedBytes = parseInt(parts[1].trim() || 0) * 1024 * 1024;
                                vramGB = this.tools.formatGB(vramUsedBytes);
                            }
                        } else {
                            gpuPercent = 0;
                            vramGB = "N/A";
                        }
                    }
                }
            }

            // 4. LIMPIEZA Y CONSTRUCCIÓN DE INTERFAZ CON FORZADO RÍGIDO DE SVG
            this.actor.destroy_all_children();

            let components = [
                { show: this.showCpu,  icon: ICON_CPU,  text: `${cpu.toFixed(1)}%` },
                { show: this.showRam,  icon: ICON_RAM,  text: `${ramGB}` },
                { show: this.showSwap, icon: ICON_SWAP, text: `${swapGB}` },
                { show: this.showGpu,  icon: ICON_GPU,  text: `${gpuPercent}%` },
                { show: this.showVram, icon: ICON_VRAM, text: `${vramGB}` }
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

                    // Añadir separador visual " | " entre sensores activos
                    if (i > 0) {
                        let sepBin = new St.Bin();
                        let sepLabel = new St.Label({ text: " | ", style: "color: #555555; margin: 0 6px;" });
                        sepBin.set_child(sepLabel);
                        this.actor.add(sepBin, { y_align: St.Align.MIDDLE, y_fill: false });
                    }

                    // Forzamos un tamaño absoluto pequeño de 16 píxeles para romper la resolución del SVG
                    let targetSize = 16;

                    // Contenedor St.Bin limitando explícitamente el ancho y el alto
                    let iconBin = new St.Bin({
                        y_align: St.Align.MIDDLE,
                        x_align: St.Align.MIDDLE,
                        height: targetSize,
                        width: targetSize
                    });

                    let gicon = Gio.icon_new_for_string(item.icon);

                    // Icono St.Icon con propiedades de ancho y alto explícitas obligatorias
                    let icon = new St.Icon({
                        gicon: gicon,
                        icon_size: targetSize,
                        width: targetSize,  // Restringe el ancho del renderizado
                        height: targetSize, // Restringe el alto del renderizado
                        icon_type: St.IconType.FULLCOLOR
                    });

                    iconBin.set_child(icon);
                    this.actor.add(iconBin, { y_align: St.Align.MIDDLE, y_fill: false });

                    // Contenedor para el texto del sensor
                    let textBin = new St.Bin();
                    let label = new St.Label({ text: " " + item.text + " " });
                    textBin.set_child(label);
                    this.actor.add(textBin, { y_align: St.Align.MIDDLE, y_fill: false });
                }
            }

        } catch (err) {
            global.logError("MONITOR_ERROR: " + err.message);
            this.actor.destroy_all_children();
            let errBin = new St.Bin();
            let errLabel = new St.Label({ text: "Error" });
            errBin.set_child(errLabel);
            this.actor.add(errBin, { y_align: St.Align.MIDDLE, y_fill: false });
        }

        if (this.shouldUpdate) {
            this.loopId = Mainloop.timeout_add(this.updateFrequency, () => {
                this._update_loop();
                return false;
            });
        }
    },

    on_applet_removed_from_panel: function() {
        this.shouldUpdate = false;
        if (this.loopId) Mainloop.source_remove(this.loopId);
    }
};

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
