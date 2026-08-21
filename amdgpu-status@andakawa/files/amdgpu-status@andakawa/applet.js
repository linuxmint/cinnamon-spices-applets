const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

class AMDGPUStatusApplet extends Applet.TextApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_tooltip("AMD GPU Status");

        // Initialize settings
        this.settings = new Settings.AppletSettings(this, "amdgpu-status@andakawa", instance_id);

        // Bind properties
        this.settings.bindProperty(Settings.BindingDirection.IN, "update-interval", "updateInterval", this.on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "temperature-unit", "temperatureUnit", this.on_display_settings_changed, null);

        // Initialize data
        this.updateLoopId = 0;
        this.gpuData = null;

        // Create menu
        const menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        menuManager.addMenu(this.menu);

        this.infoMenuItem = new PopupMenu.PopupMenuItem("Collecting data...", { reactive: false });
        this.menu.addMenuItem(this.infoMenuItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Add refresh button
        const refreshItem = new PopupMenu.PopupMenuItem("Refresh");
        refreshItem.connect('activate', () => {
            this.updateGPUData();
        });
        this.menu.addMenuItem(refreshItem);

        // Start monitoring
        this.set_applet_label("GPU: Loading...");
        this.updateGPUData();
    }

    on_settings_changed() {
        // Handle update interval changes
        if (this.updateLoopId > 0) {
            Mainloop.source_remove(this.updateLoopId);
            this.updateLoopId = 0;
        }
        this.updateGPUData();
    }

    on_display_settings_changed() {
        // Handle display-related settings changes
        if (this.gpuData) {
            this.updateDisplay();
        }
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }


    convertTemperature(celsius) {
        const tempUnit = this.temperatureUnit || "celsius";
        const isFahrenheit = tempUnit === "fahrenheit" ||
            (tempUnit && tempUnit.toLowerCase().includes("fahrenheit"));

        if (isFahrenheit) {
            return (celsius * 9/5) + 32;
        }
        return celsius;
    }

    getTemperatureUnit() {
        const tempUnit = this.temperatureUnit || "celsius";
        const isFahrenheit = tempUnit === "fahrenheit" ||
            (tempUnit && tempUnit.toLowerCase().includes("fahrenheit"));
        return isFahrenheit ? "°F" : "°C";
    }


    updateGPUData() {
        // Check if amdgpu_top is available using Util.spawn_async
        Util.spawn_async(['which', 'amdgpu_top'], (stdout) => {
            if (!stdout || stdout.trim() === '') {
                this.set_applet_label("amdgpu_top not found");
                this.set_applet_tooltip("Please install amdgpu_top - https://github.com/Umio-Yasuno/amdgpu_top");
                this.scheduleNextUpdate();
                return;
            }

            // Execute amdgpu_top command using Util.spawn_async
            Util.spawn_async(['amdgpu_top', '-d', '--json'], (stdout) => {
                if (stdout) {
                    try {
                        this.gpuData = JSON.parse(stdout);
                        this.updateDisplay();
                    } catch (e) {
                        this.set_applet_label("GPU: Parse Error");
                        this.set_applet_tooltip("Failed to parse amdgpu_top output");
                    }
                } else {
                    this.set_applet_label("GPU: Exec Error");
                    this.set_applet_tooltip("Failed to execute amdgpu_top");
                }
                this.scheduleNextUpdate();
            });
        });
    }


    scheduleNextUpdate() {
        const intervalMs = Math.max(1000, (this.updateInterval || 5) * 1000);

        this.updateLoopId = Mainloop.timeout_add(intervalMs, Lang.bind(this, () => {
            this.updateGPUData();
            return false;
        }));
    }


    updateDisplay() {
        if (!this.gpuData || this.gpuData.length === 0) {
            this.set_applet_label("GPU: N/A");
            this.set_applet_tooltip("No GPU data available");
            return;
        }

        // Use first GPU, multi-gpu environments could be added in later versions
        let gpu = this.gpuData[0];

        // Extract data
        const gpuUsage = gpu.gpu_activity?.GFX?.value || 0;
        const vramUsed = gpu.VRAM?.["Total VRAM Usage"]?.value || 0;
        const vramTotal = gpu.VRAM?.["Total VRAM"]?.value || 0;
        const vramPercent = vramTotal > 0 ? (vramUsed / vramTotal) * 100 : 0;
        const temperatureCelsius = gpu.Sensors?.["Edge Temperature"]?.value || 0;
        const temperature = this.convertTemperature(temperatureCelsius);
        const power = gpu.Sensors?.["Average Power"]?.value || 0;

        const displayText = `GPU: ${gpuUsage.toFixed(1)}% VRAM: ${vramPercent.toFixed(1)}% Temp: ${temperature.toFixed(0)}${this.getTemperatureUnit()}`;
        this.set_applet_label(displayText);

        // Update the tooltip with detailed info
        const tooltipLines = [
            gpu.DeviceName || "AMD GPU",
            `GPU Usage: ${gpuUsage.toFixed(1)}%`,
            `VRAM: ${vramUsed}MB / ${vramTotal}MB (${vramPercent.toFixed(1)}%)`,
            `Temperature: ${temperature.toFixed(1)}${this.getTemperatureUnit()}`,
        ];

        if (power > 0) {
            tooltipLines.push(`Power: ${power}W`);
        }

        this.set_applet_tooltip(tooltipLines.join('\n'));

        // Update menu (only if the menu is open to avoid performance issues)
        if (this.menu.isOpen) {
            this.updateMenu(gpu);
        }

    }

    updateMenu(gpu) {
        // Clear existing menu items
        this.menu.removeAll();

        // Add header
        let headerItem = new PopupMenu.PopupMenuItem(gpu.DeviceName || "AMD GPU", {
            reactive: false,
            style_class: 'popup-subtitle-menu-item'
        });
        this.menu.addMenuItem(headerItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


        // GPU Activity
        const gpuUsage = gpu.gpu_activity?.GFX?.value || 0;
        const memActivity = gpu.gpu_activity?.Memory?.value || 0;
        const mediaActivity = gpu.gpu_activity?.MediaEngine?.value || 0;

        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `GPU Usage: ${gpuUsage.toFixed(1)}%`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `Memory Activity: ${memActivity.toFixed(1)}%`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `Media Engine: ${mediaActivity.toFixed(1)}%`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


        // VRAM Usage
        const vramUsed = gpu.VRAM?.["Total VRAM Usage"]?.value || 0;
        const vramTotal = gpu.VRAM?.["Total VRAM"]?.value || 0;
        const vramPercent = vramTotal > 0 ? (vramUsed / vramTotal) * 100 : 0;
        const gttUsed = gpu.VRAM?.["Total GTT Usage"]?.value || 0;
        const gttTotal = gpu.VRAM?.["Total GTT"]?.value || 0;

        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `VRAM: ${vramUsed}MB / ${vramTotal}MB (${vramPercent.toFixed(1)}%)`,
            { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `GTT: ${gttUsed}MB / ${gttTotal}MB`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


        // Temperatures
        const edgeTemp = this.convertTemperature(gpu.Sensors?.["Edge Temperature"]?.value || 0);
        const junctionTemp = this.convertTemperature(gpu.Sensors?.["Junction Temperature"]?.value || 0);
        const memTemp = this.convertTemperature(gpu.Sensors?.["Memory Temperature"]?.value || 0);
        const tempUnit = this.getTemperatureUnit();


        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `Edge Temperature: ${edgeTemp.toFixed(1)}${tempUnit}`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `Junction Temperature: ${junctionTemp.toFixed(1)}${tempUnit}`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `Memory Temperature: ${memTemp.toFixed(1)}${tempUnit}`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Power and Clocks
        const power = gpu.Sensors?.["Average Power"]?.value || 0;
        const gpuClock = gpu.Sensors?.["GFX_SCLK"]?.value || 0;
        const memClock = gpu.Sensors?.["GFX_MCLK"]?.value || 0;

        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `Power: ${power}W`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `GPU Clock: ${gpuClock}MHz`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            `Memory Clock: ${memClock}MHz`, { reactive: false }
        ));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


        // Refresh button
        const refreshItem = new PopupMenu.PopupMenuItem("Refresh");
        refreshItem.connect('activate', () => {
            this.updateGPUData();
        });
        this.menu.addMenuItem(refreshItem);
    }

    on_applet_removed_from_panel() {
        if (this.updateLoopId > 0) {
            Mainloop.source_remove(this.updateLoopId);
            this.updateLoopId = 0;
        }

        if (this.settings) {
            this.settings.finalize();
        }
    }


}

function main(metadata, orientation, panel_height, instance_id) {
    return new AMDGPUStatusApplet(orientation, panel_height, instance_id);
}
