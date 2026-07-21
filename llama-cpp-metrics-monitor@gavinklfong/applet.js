const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;

class Utils {
    static extractCounter(text, name) {
        let line = text.split("\n").find(l => l.startsWith(name + " "));
        if (!line) return 0;
        let parts = line.trim().split(/\s+/);
        if (parts.length < 2) return 0;
        let v = parseFloat(parts[1]);
        return isNaN(v) ? 0 : v;
    }

    static convertToGB(bytes) {
        return bytes / (1024 * 1024 * 1024);
    }

    static getSystemRamUsage() {
        try {
            let meminfoFile = Gio.File.new_for_path("/proc/meminfo");
            let [success, data] = meminfoFile.load_contents(null);
            if (!success) return { used: 0, total: 0 };

            let content = data.toString();
            let memTotal = 0;
            let memAvailable = 0;

            let totalMatch = content.match(/MemTotal:\s+(\d+)\s+kB/);
            let availableMatch = content.match(/MemAvailable:\s+(\d+)\s+kB/);

            if (totalMatch) {
                memTotal = parseInt(totalMatch[1], 10) * 1024;
            }
            if (availableMatch) {
                memAvailable = parseInt(availableMatch[1], 10) * 1024;
            }

            return {
                used: memTotal - memAvailable,
                total: memTotal
            };
        } catch (e) {
            global.logError("Error reading system RAM usage: " + e.message);
            return { used: 0, total: 0 };
        }
    }

    static getAverageCpuLoad(lastTotal, lastIdle) {
        try {
            let file = Gio.File.new_for_path("/proc/stat");
            let [success, contents] = file.load_contents(null);
            if (!success) return { load: 0, total: 0, idle: 0 };

            let lines = contents.toString().split("\n");
            let cpuLine = lines.find(l => l.startsWith("cpu "));
            if (!cpuLine) return { load: 0, total: 0, idle: 0 };

            let parts = cpuLine.trim().split(/\s+/);
            let user = parseFloat(parts[1]) || 0;
            let nice = parseFloat(parts[2]) || 0;
            let system = parseFloat(parts[3]) || 0;
            let idle = parseFloat(parts[4]) || 0;
            let iowait = parseFloat(parts[5]) || 0;
            let irq = parseFloat(parts[6]) || 0;
            let softirq = parseFloat(parts[7]) || 0;
            let steal = parseFloat(parts[8]) || 0;

            let total = user + nice + system + idle + iowait + irq + softirq + steal;
            let idleTime = idle + iowait;

            let load = 0;
            if (lastTotal > 0) {
                let deltaTotal = total - lastTotal;
                let deltaIdle = idleTime - lastIdle;
                if (deltaTotal > 0) {
                    load = (1 - (deltaIdle / deltaTotal)) * 100;
                }
            }

            return {
                load: Math.max(0, Math.min(100, load)),
                total: total,
                idle: idleTime
            };
        } catch (e) {
            global.logError("Error reading CPU load: " + e.message);
            return { load: 0, total: 0, idle: 0 };
        }
    }

    static getCpuHwmonPath() {
        try {
            let baseDir = Gio.File.new_for_path("/sys/class/hwmon");
            let enumerator = baseDir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
            let info;

            while ((info = enumerator.next_file(null)) !== null) {
                let folderName = info.get_name();
                let currentPath = `/sys/class/hwmon/${folderName}`;
                
                let nameFile = Gio.File.new_for_path(`${currentPath}/name`);
                if (!nameFile.query_exists(null)) continue;

                let [ok, contents] = nameFile.load_contents(null);
                if (!ok) continue;

                let driverName = contents.toString().trim();
                if (driverName === "coretemp" || driverName === "k10temp" || driverName === "zenpower") {
                    return currentPath;
                }
            }
        } catch (e) {
            global.logError(`[LlamaApplet] Failed to get CPU hwmon path: ` + e.message);
        }
        return null;
    }

    static getGpuHwmonPaths(includeDedicated) {
        let paths = [];
        try {
            let baseDir = Gio.File.new_for_path("/sys/class/hwmon");
            let enumerator = baseDir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
            let info;

            while ((info = enumerator.next_file(null)) !== null) {
                let folderName = info.get_name();
                let currentPath = `/sys/class/hwmon/${folderName}`;
                
                let nameFile = Gio.File.new_for_path(`${currentPath}/name`);
                if (!nameFile.query_exists(null)) continue;

                let [ok, contents] = nameFile.load_contents(null);
                if (!ok) continue;

                let driverName = contents.toString().trim();
                if (driverName === "amdgpu" || driverName === "nouveau" || driverName === "nvidia") {
                    let powerCapFile = Gio.File.new_for_path(`${currentPath}/power1_cap`);
                    if (powerCapFile.query_exists(null) === includeDedicated) {
                        paths.push(currentPath);
                    }
                }
            }
        } catch (e) {
            global.logError(`[LlamaApplet] Failed to get GPU hwmon paths (includeDedicated=${includeDedicated}): ` + e.message);
        }
        return paths;
    }

    static getGpuDataFromPath(path) {
        try {
            let dir = Gio.File.new_for_path(path);
            let data = {
                name: "Unknown GPU",
                gpuUsage: 0,
                gpuVramUsed: 0,
                gpuVramTotal: 0,
                components: []
            };

            data.name = this.readGpuName(dir);
            let gpuMetrics = this.readGpuMetrics(dir);
            data.gpuUsage = gpuMetrics.gpuUsage;
            data.gpuVramUsed = gpuMetrics.gpuVramUsed;
            data.gpuVramTotal = gpuMetrics.gpuVramTotal;
            data.components = this.readComponentTemperatures(dir);

            return data;
        } catch (e) {
            global.logError(`Error reading dedicated GPU data at ${path}: ${e.message}`);
            return null;
        }
    }

    static readGpuName(dir) {
        let name = "Unknown GPU";
        let nameFile = dir.get_child("name");
        if (nameFile.query_exists(null)) {
            let [ok, contents] = nameFile.load_contents(null);
            if (ok) return contents.toString().trim();
        }
        return "Unknown GPU";
    }

    static readGpuMetrics(dir) {
        let gpuUsage = 0;
        let gpuVramUsed = 0;
        let gpuVramTotal = 0;
        let deviceDir = dir.get_child("device");
        if (deviceDir.query_exists(null)) {
            let usageFile = deviceDir.get_child("gpu_busy_percent");
            if (usageFile.query_exists(null)) {
                let [ok, contents] = usageFile.load_contents(null);
                if (ok) gpuUsage = parseFloat(contents.toString().trim());
            }

            let vramUsedFile = deviceDir.get_child("mem_info_vram_used");
            if (vramUsedFile.query_exists(null)) {
                let [ok, contents] = vramUsedFile.load_contents(null);
                if (ok) gpuVramUsed = parseFloat(contents.toString().trim());
            }

            let vramTotalFile = deviceDir.get_child("mem_info_vram_total");
            if (vramTotalFile.query_exists(null)) {
                let [ok, contents] = vramTotalFile.load_contents(null);
                if (ok) gpuVramTotal = parseFloat(contents.toString().trim());
            }
        }

        return {gpuUsage, gpuVramUsed, gpuVramTotal};
    }

    static readComponentTemperatures(dir) {
        let enumerator = dir.enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null);
        let info;
        let components = [];

        while ((info = enumerator.next_file(null)) !== null) {
            let name = info.get_name();
            let match = name.match(/temp(\d+)_input/);
            if (match) {
                let index = match[1];
                let inputFile = dir.get_child(`temp${index}_input`);
                let labelFile = dir.get_child(`temp${index}_label`);

                let [inOk, inData] = inputFile.load_contents(null);
                if (inOk) {
                    let temp = parseFloat(inData.toString().trim()) / 1000.0;
                    let componentName = `Temp ${index}`;

                    if (labelFile.query_exists(null)) {
                        let [lOk, lData] = labelFile.load_contents(null);
                        if (lOk) componentName = lData.toString().trim();
                    }

                    components.push({
                        componentName: componentName,
                        componentTemp: temp
                    });
                }
            }
        }

        return components;
    }

    static getGpuData(hwmonPaths) {
        let gpuDataList = [];
        for (let path of hwmonPaths) {
            let data = this.getGpuDataFromPath(path);
            if (data) {
                gpuDataList.push(data);
            }
        }
        return gpuDataList;
    }

    static getAllDedicatedGpuHwmonPaths() {
        return this.getGpuHwmonPaths(true);
    }

    static getAllIntegratedGpuHwmonPaths() {
        return this.getGpuHwmonPaths(false);
    }

    static getCpuData(hwmonPath, lastTotal, lastIdle) {
        try {
            let dir = Gio.File.new_for_path(hwmonPath);
            let data = {
                usage: 0,
                ramUsed: 0,
                ramTotal: 0,
                components: [],
                total: 0,
                idle: 0
            };

            let cpuStats = this.getAverageCpuLoad(lastTotal, lastIdle);
            data.usage = cpuStats.load;
            data.total = cpuStats.total;
            data.idle = cpuStats.idle;

            let ramUsage = this.getSystemRamUsage();
            data.ramUsed = ramUsage.used;
            data.ramTotal = ramUsage.total;
            data.components = this.readComponentTemperatures(dir);

            return data;
        } catch (e) {
            global.logError(`Error reading CPU data at ${hwmonPath}: ${e.message}`);
            return null;
        }
    }
}


class UIHelper {
    static buildLabel(promptRate, predRate, dedicatedGpuDataList, integratedGpuDataList, cpuData) {
        let gr = predRate.toFixed(1);
        let pr = promptRate.toFixed(1);

        let label = `PP ${pr} t/s | TG ${gr} t/s\n`;
        let cpuTemp = (cpuData && cpuData.components && cpuData.components.length > 0) ? Math.max(...cpuData.components.map(c => c.componentTemp)) : 0;
        let cpuLoad = cpuData ? cpuData.usage : 0;

        if (dedicatedGpuDataList.length === 1) {
            let g = dedicatedGpuDataList[0];
            let gTemp = (g.components && g.components.length > 0) ? Math.max(...g.components.map(c => c.componentTemp)) : 0;
            label += `GPU: 🌡️${gTemp.toFixed(0)}°C ⚡${g.gpuUsage.toFixed(0)}% | CPU: 🌡️${cpuTemp.toFixed(0)}°C ⚡${cpuLoad.toFixed(0)}%`;
        } else if (dedicatedGpuDataList.length > 1) {
            let g0 = dedicatedGpuDataList[0];
            let g1 = dedicatedGpuDataList[1];
            let g0Temp = (g0.components && g0.components.length > 0) ? Math.max(...g0.components.map(c => c.componentTemp)) : 0;
            let g1Temp = (g1.components && g1.components.length > 0) ? Math.max(...g1.components.map(c => c.componentTemp)) : 0;
            label += `GPU: 🌡️${g0Temp.toFixed(0)}°C ⚡${g0.gpuUsage.toFixed(0)}% | GPU: 🌡️${g1Temp.toFixed(0)}°C ⚡${g1.gpuUsage.toFixed(0)}%`;
        } else {
            let i = integratedGpuDataList.length > 0 ? integratedGpuDataList[0] : { gpuUsage: 0, components: [] };
            let iTemp = (i.components && i.components.length > 0) ? Math.max(...i.components.map(c => c.componentTemp)) : 0;
            label += `iGPU: 🌡️${iTemp.toFixed(0)}°C ⚡${i.gpuUsage.toFixed(0)}% | CPU: 🌡️${cpuTemp.toFixed(0)}°C ⚡${cpuLoad.toFixed(0)}%`;
        }
        return label;
    }

    static buildTooltip(promptRate, predRate, dedicatedGpuDataList, integratedGpuDataList, cpuData) {
        let gr = predRate.toFixed(1);
        let pr = promptRate.toFixed(1);

        let tooltip = `🧠 LLM Inference: PP ${pr} tok/s | TG ${gr} tok/s`;

        if (dedicatedGpuDataList.length > 0) {
            tooltip += `\n\n🎮 [DEDICATED GPU]\n`;
            for (let gpu of dedicatedGpuDataList) {
                let maxTemp = 0;
                if (gpu.components && gpu.components.length > 0) {
                    maxTemp = Math.max(...gpu.components.map(c => c.componentTemp));
                }
                let vramPerc = gpu.gpuVramTotal > 0 ? ((gpu.gpuVramUsed / gpu.gpuVramTotal) * 100).toFixed(0) : 0;
                tooltip += `  ▪ ${gpu.name}\n`;
                tooltip += `    🌡️ ${maxTemp.toFixed(0)}°C | ⚡ Load: ${gpu.gpuUsage.toFixed(0)}% | 💾 VRAM: ${Utils.convertToGB(gpu.gpuVramUsed).toFixed(1)}/${Utils.convertToGB(gpu.gpuVramTotal).toFixed(1)}GB (${vramPerc}%)\n`;
            }
        }

        if (integratedGpuDataList.length > 0) {
            tooltip += `\n🧩 [INTEGRATED GPU]\n`;
            for (let gpu of integratedGpuDataList) {
                let maxTemp = 0;
                if (gpu.components && gpu.components.length > 0) {
                    maxTemp = Math.max(...gpu.components.map(c => c.componentTemp));
                }
                let vramPerc = gpu.gpuVramTotal > 0 ? ((gpu.gpuVramUsed / gpu.gpuVramTotal) * 100).toFixed(0) : 0;
                tooltip += `  ▪ ${gpu.name}\n`;
                tooltip += `    🌡️ ${maxTemp.toFixed(0)}°C | ⚡ Load: ${gpu.gpuUsage.toFixed(0)}% | 💾 VRAM: ${Utils.convertToGB(gpu.gpuVramUsed).toFixed(1)}/${Utils.convertToGB(gpu.gpuVramTotal).toFixed(1)}GB (${vramPerc}%)\n`;
            }
        }

        let cpuTemp = (cpuData && cpuData.components && cpuData.components.length > 0) ? Math.max(...cpuData.components.map(c => c.componentTemp)) : 0;
        let cpuLoad = cpuData ? cpuData.usage : 0;
        let ramUsed = Utils.convertToGB(cpuData.ramUsed);
        let ramTotal = Utils.convertToGB(cpuData.ramTotal);
        let ramPerc = cpuData.ramTotal > 0 ? (cpuData.ramUsed / cpuData.ramTotal * 100).toFixed(0) : 0;

        tooltip += `\n💻 [SYSTEM]\n`;
        tooltip += `  ▪ CPU: 🌡️ ${cpuTemp.toFixed(0)}°C | ⚡ Load: ${cpuLoad.toFixed(0)}%\n`;
        tooltip += `  ▪ RAM: 💾 ${ramUsed.toFixed(1)}/${ramTotal.toFixed(1)} GB (${ramPerc}%)\n`;

        return tooltip;
    }
}

 class LlamaCppMetricsApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // 1. Initialize settings binding
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);

        // 2. Bind JSON properties to instance variables
        // syntax: bind(keyInJson, classProperty, callbackWhenChanged)
        this.settings.bind("metricsUrl", "_metricsUrl", this._onSettingsChanged.bind(this));
        this.settings.bind("llamaPollIntervalMs", "_llamaPollIntervalMs", this._onSettingsChanged.bind(this));
        this.settings.bind("hwPollIntervalMs", "_hwPollIntervalMs", this._onSettingsChanged.bind(this));

        // Initial placeholder states
        this.set_applet_label("llama: init…");
        this.set_applet_tooltip("Llama.cpp token rates");

        // Use modern libsoup 3 Session interface
        this._httpSession = new Soup.Session();

        // Polling intervals in milliseconds.
        this._llamaPollIntervalMs = 5000;
        this._hwPollIntervalMs = 1000;
        this._llamaLoopId = null;
        this._hwLoopId = null;
        
        this._dedicatedGpuHwmonPaths = Utils.getAllDedicatedGpuHwmonPaths();
        this._integratedGpuHwmonPaths = Utils.getAllIntegratedGpuHwmonPaths();
        this._cpuHwmonPath = Utils.getCpuHwmonPath();
        
        // Generation (TG) Tracking Anchors
        this._lastPredTokens = 0;
        this._lastPredTime = 0;
        this._lastGenRate = 0;

        // Prompt (PP) Tracking Anchors
        this._lastPromptTokens = 0;
        this._lastPromptTime = 0;
        this._lastPromptRate = 0;

        // Hardware Tracking Anchors
        this._lastDedicatedGpuData = [];
        this._lastIntegratedGpuData = [];

        this._lastCpuTotal = 0;
        this._lastCpuIdle = 0;
        this._lastCpuData = {};

        this._startPolling();
    }

    // Callback when the user changes a setting in the GUI configuration dialog
    _onSettingsChanged() {
        // Restart the polling loop to pick up any new interval changes
        if (this._llamaLoopId) {
            Mainloop.source_remove(this._llamaLoopId);
            this._llamaLoopId = null;
        }
        if (this._hwLoopId) {
            Mainloop.source_remove(this._hwLoopId);
            this._hwLoopId = null;
        }
        this._startPolling();
    }


    on_applet_removed_from_panel() {
        if (this._llamaLoopId) {
            Mainloop.source_remove(this._llamaLoopId);
            this._llamaLoopId = null;
        }
        if (this._hwLoopId) {
            Mainloop.source_remove(this._hwLoopId);
            this._hwLoopId = null;
        }
    }

    _startPolling() {
        this._llamaLoopId = Mainloop.timeout_add(this._llamaPollIntervalMs, () => {
            this._pollMetrics();
            return true;
        });
        this._hwLoopId = Mainloop.timeout_add(this._hwPollIntervalMs, () => {
            this._pollHardware();
            return true;
        });
    }

    _pollMetrics() {
        let msg = Soup.Message.new("GET", this._metricsUrl);

        this._httpSession.send_and_read_async(msg, global.PRIORITY_DEFAULT, null, (session, result) => {
            try {
                let bytes = session.send_and_read_finish(result);
                let body = bytes.get_data().toString();

                if (!body) {
                    this.set_applet_label("llama: empty");
                    return;
                }

                let { currentPromptRate, currentGenRate } = this._calculateRates(body);

                // Use cached hardware data from the other loop
                this._updateUI(currentPromptRate, currentGenRate, this._lastDedicatedGpuData, this._lastIntegratedGpuData, this._lastCpuData);

            } catch (e) {
                global.logError("Error fetching metrics: " + e.message);
                this.set_applet_tooltip("Failed to fetch or parse llama.cpp metrics from: " + this._metricsUrl);
            }
        });
    }

    _calculateRates(body) {
        // 1. Extract metrics from the Prometheus response body
        const activeRequests = Utils.extractCounter(body, "llamacpp:requests_processing");

        const totalPromptTokens = Utils.extractCounter(body, "llamacpp:prompt_tokens_total");
        const totalPromptTime = Utils.extractCounter(body, "llamacpp:prompt_seconds_total");
        const avgPromptRate = Utils.extractCounter(body, "llamacpp:prompt_tokens_seconds");

        const totalPredTokens = Utils.extractCounter(body, "llamacpp:tokens_predicted_total");
        const totalPredTime = Utils.extractCounter(body, "llamacpp:tokens_predicted_seconds_total");
        const avgPredRate = Utils.extractCounter(body, "llamacpp:predicted_tokens_seconds");

        // 2. Helper to calculate delta-based rate with fallback to average rate
        const getRate = (total, lastTotal, time, lastTime, avg, lastRate) => {
            let rate = lastRate;
            if (lastTotal > 0) {
                const dTokens = total - lastTotal;
                const dTime = time - lastTime;
                if (dTokens > 0 && dTime > 0) rate = dTokens / dTime;
            }
            return (rate === 0 && avg > 0) ? avg : rate;
        };

        let currentPromptRate = 0;
        let currentGenRate = 0;

        // 3. Calculate rates only if there are active requests
        if (activeRequests > 0) {
            currentPromptRate = getRate(totalPromptTokens, this._lastPromptTokens, totalPromptTime, this._lastPromptTime, avgPromptRate, this._lastPromptRate);
            currentGenRate = getRate(totalPredTokens, this._lastPredTokens, totalPredTime, this._lastPredTime, avgPredRate, this._lastGenRate);
        }

        // 4. Update history anchors for the next poll
        this._lastPromptRate = currentPromptRate;
        this._lastGenRate = currentGenRate;
        this._lastPromptTokens = totalPromptTokens;
        this._lastPromptTime = totalPromptTime;
        this._lastPredTokens = totalPredTokens;
        this._lastPredTime = totalPredTime;

        return { currentPromptRate, currentGenRate };
    }

    _pollHardware() {
        this._lastDedicatedGpuData = Utils.getGpuData(this._dedicatedGpuHwmonPaths);
        this._lastIntegratedGpuData = Utils.getGpuData(this._integratedGpuHwmonPaths);

        let cpuData = Utils.getCpuData(this._cpuHwmonPath, this._lastCpuTotal, this._lastCpuIdle);
        if (cpuData) {
            this._lastCpuTotal = cpuData.total;
            this._lastCpuIdle = cpuData.idle;
        }
        this._lastCpuData = cpuData;
        this._updateUI(this._lastPromptRate, this._lastGenRate, this._lastDedicatedGpuData, this._lastIntegratedGpuData, this._lastCpuData);
    }

    _updateUI(promptRate, predRate, dedicatedGpuDataList, integratedGpuDataList, cpuData) {
        this.set_applet_label(UIHelper.buildLabel(promptRate, predRate, dedicatedGpuDataList, integratedGpuDataList, cpuData));
        this.set_applet_tooltip(UIHelper.buildTooltip(promptRate, predRate, dedicatedGpuDataList, integratedGpuDataList, cpuData));
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new LlamaCppMetricsApplet(metadata, orientation, panelHeight, instanceId);
}