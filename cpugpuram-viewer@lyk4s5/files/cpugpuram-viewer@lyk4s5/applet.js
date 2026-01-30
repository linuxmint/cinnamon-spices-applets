const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;

class CinnamonApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

     
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        
    
        this.set_applet_label("...");
        this.set_applet_tooltip("Click to open System Monitor.");

    
        this.prevIdle = 0;
        this.prevTotal = 0;

    
        this.gpuProvider = this.detectGpuProvider();
        
  
        this.updateLoop();
    }


    on_applet_clicked(event) {
        Util.spawnCommandLine("gnome-system-monitor -r");
    }

    detectGpuProvider() {
        // 1. NVIDIA 
        let nvidiaPath = GLib.find_program_in_path("nvidia-smi");
        if (nvidiaPath) {
            return "nvidia";
        }

        // 2. AMD 
        if (GLib.file_test("/sys/class/drm/card0/device/gpu_busy_percent", GLib.FileTest.EXISTS)) {
            return "amd_card0";
        }
        if (GLib.file_test("/sys/class/drm/card1/device/gpu_busy_percent", GLib.FileTest.EXISTS)) {
            return "amd_card1";
        }

        return null;
    }

    updateLoop() {
        this.updateMetrics();
        // 2 saniyede bir güncelle
        Mainloop.timeout_add_seconds(2, () => {
            this.updateLoop();
        });
    }

    updateMetrics() {
        try {
            let parts = []; 

        // 1. CPU
        let cpuUsage = String(this.getCpuUsage()).padStart(4, ' '); 
        parts.push(`CPU %${cpuUsage}`);

        // 2. GPU (Eğer varsa)
        if (this.gpuProvider) {
            let gpuValue = this.getGpuUsage();
            if (gpuValue !== null) {
                let gpuUsage = String(gpuValue).padStart(4, ' ');
                parts.push(`GPU %${gpuUsage}`);
    }
}

        // 3. RAM
        let ramUsage = String(this.getRamUsage()).padStart(4, ' ');
        parts.push(`RAM %${ramUsage}`);

            
            this.set_applet_label(parts.join(" • "));

        } catch (e) {
            global.logError(e);
            this.set_applet_label("Hata");
        }
    }

    getGpuUsage() {
        try {
            if (this.gpuProvider === "nvidia") {
                let [res, out] = GLib.spawn_command_line_sync("nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits");
                if (res) return out.toString().trim();
            } 
            else if (this.gpuProvider.startsWith("amd")) {
                let cardPath = this.gpuProvider === "amd_card0" ? 
                    "/sys/class/drm/card0/device/gpu_busy_percent" : 
                    "/sys/class/drm/card1/device/gpu_busy_percent";
                
                let [res, out] = GLib.file_get_contents(cardPath);
                if (res) return out.toString().trim();
            }
        } catch (e) { return null; }
        return null;
    }

    getCpuUsage() {
        try {
            let [res, fileContent] = GLib.file_get_contents('/proc/stat');
            if (!res) return 0;
            
            let lines = fileContent.toString().split('\n');
            let cpuLine = lines[0].split(/\s+/);

            let idle = parseInt(cpuLine[4]) + parseInt(cpuLine[5]);
            let total = 0;
            for (let i = 1; i < cpuLine.length; i++) {
                let val = parseInt(cpuLine[i]);
                if (!isNaN(val)) total += val;
            }

            let diffIdle = idle - this.prevIdle;
            let diffTotal = total - this.prevTotal;
            let usage = 0;

            if (diffTotal > 0) {
                usage = Math.round(100 * (diffTotal - diffIdle) / diffTotal);
            }

            this.prevIdle = idle;
            this.prevTotal = total;

            return usage;
        } catch(e) { return 0; }
    }

    getRamUsage() {
        try {
            let [res, fileContent] = GLib.file_get_contents('/proc/meminfo');
            if (!res) return 0;
            
            let contentStr = fileContent.toString();
            let totalMatch = contentStr.match(/MemTotal:\s+(\d+)/);
            let availableMatch = contentStr.match(/MemAvailable:\s+(\d+)/);

            if (totalMatch && availableMatch) {
                let total = parseInt(totalMatch[1]);
                let available = parseInt(availableMatch[1]);
                return Math.round(((total - available) / total) * 100);
            }
        } catch(e) { return 0; }
        return 0;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonApplet(metadata, orientation, panel_height, instance_id);
}
