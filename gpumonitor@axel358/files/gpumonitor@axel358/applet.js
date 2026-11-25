const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

// gpu_busy_percent is an instant reading that swings widely within a second, so each refresh shows the mean of
// this many reads spread across its interval, which tracks radeontop's one-second average far more closely.
const BUSY_READS_PER_REFRESH = 5;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;

class GPUUsageApplet extends Applet.TextApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.settings = new Settings.AppletSettings(this, "gpumonitor@axel358", instance_id);

        this.settings.bind("refresh-interval", "refresh_interval", this.on_settings_changed);
        this.settings.bind("decimal-places", "decimal_places", this.on_settings_changed);
        this.settings.bind("display-style", "display_style", this.on_settings_changed);
        this.settings.bind("use-compact-label", "use_compact_label", this.on_settings_changed);
        this.settings.bind("select-gpu", "select_gpu", this.on_settings_changed);
        this.settings.bind("font-size", "font_size", this.update_font_size);

        // PCI address (e.g. "0000:0d:00.0") of each GPU, keyed by its bus number
        this.pci_addresses = {};
        this.sysfs_unavailable = false;
        this.busy_reads = [];
        this.busy_loop_id = 0;

        // dynamically load GPUs into select-gpu options
        Util.spawn_async(["lshw", "-json", "-C", "display"], (gpu_info_raw) => {
            let gpu_info_array = JSON.parse(gpu_info_raw);

            // get the bus numbers of all GPUs
            const gpu_bus_ids = [];
            gpu_info_array.forEach(obj => {
                const { businfo } = obj;

                // match the two-digit (hexadecimal) number between two ':' chars
                const regex_for_bus_number = /:([0-9A-Fa-f]{2}):/g;
                const match = regex_for_bus_number.exec(businfo);

                if (match && match[1]) {
                    // Extracted bus number (e.g. "03", "0e", "0F")
                    gpu_bus_ids.push(match[1]);
                    this.pci_addresses[match[1]] = businfo.replace("pci@", "");
                }
            });

            // create options to display in settings
            const select_gpu_options = {};
            gpu_bus_ids.forEach(bus_id => {
                // TODO: replace the key with the name of the GPU + bus_id, making it easier to read.
                select_gpu_options[bus_id] = bus_id;
            });

            this.settings.setOptions("select-gpu", select_gpu_options);
        });

        this.set_applet_tooltip("Click for more details");

        const menu_manager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        menu_manager.addMenu(this.menu);

        this.info_menu_item = new PopupMenu.PopupMenuItem("Collecting data...", { reactive: false });
        this.menu.addMenuItem(this.info_menu_item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const item = new PopupMenu.PopupMenuItem(_("Launch Radeontop"));
        item.connect('activate', () => {
            const bus_arg = this.select_gpu ? " -b " + this.select_gpu : "";
            Util.spawnCommandLine("gnome-terminal -t Radeontop -- radeontop" + bus_arg);
        });
        this.menu.addMenuItem(item);
        this.set_applet_label("radeontop not installed");

        this.update_font_size();
        this.update();
    }

    on_settings_changed() {
        //TODO: This causes performance issues
        //this.update();
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    update() {
        const address = this.select_gpu ? this.pci_addresses[this.select_gpu] : Object.values(this.pci_addresses)[0];

        if (address && !this.sysfs_unavailable) {
            this.start_busy_sampler(address);
            this.read_sysfs(address);
        } else {
            this.read_radeontop();
        }

        this.update_loop_id = Mainloop.timeout_add(this.refresh_interval, Lang.bind(this, this.update));
    }

    // The amdgpu driver publishes the GPU's load and VRAM counters in sysfs, so reading them spawns no process.
    // Since Cinnamon 6.8 every spawned process gets its own systemd scope, which the journal logs on each refresh.
    // The legacy radeon driver publishes no such files, which leaves radeontop as the fallback.
    read_sysfs(address) {
        const device = "/sys/bus/pci/devices/" + address + "/";
        const counters = ["gpu_busy_percent", "mem_info_vram_used", "mem_info_vram_total"];

        Promise.all(counters.map(counter => this.read_number(device + counter)))
            .then(([gpu, vram_used, vram_total]) => {
                const busy_reads = this.busy_reads.concat([gpu]);
                this.busy_reads = [];
                const mean_gpu = busy_reads.reduce((sum, value) => sum + value, 0) / busy_reads.length;

                this.show(mean_gpu, vram_used / vram_total * 100, (vram_used / 1048576).toFixed(this.decimal_places) + "MB");
            })
            .catch(() => {
                this.sysfs_unavailable = true;
                this.stop_busy_sampler();
                this.read_radeontop();
            });
    }

    start_busy_sampler(address) {
        if (this.busy_loop_id > 0) {
            return;
        }

        const busy_path = "/sys/bus/pci/devices/" + address + "/gpu_busy_percent";
        const spacing = Math.round(this.refresh_interval / BUSY_READS_PER_REFRESH);

        this.busy_loop_id = Mainloop.timeout_add(spacing, () => {
            this.read_number(busy_path)
                .then(value => this.busy_reads.push(value))
                .catch(() => {});

            return GLib.SOURCE_CONTINUE;
        });
    }

    stop_busy_sampler() {
        if (this.busy_loop_id > 0) {
            Mainloop.source_remove(this.busy_loop_id);
            this.busy_loop_id = 0;
        }
    }

    read_number(path) {
        return new Promise((resolve, reject) => {
            Gio.File.new_for_path(path).load_contents_async(null, (file, result) => {
                try {
                    const [, contents] = file.load_contents_finish(result);
                    resolve(parseFloat(ByteArray.toString(contents)));
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    read_radeontop() {
        const bus_arg = this.select_gpu ? ["-b", this.select_gpu] : [];
        let command = ["radeontop"];
        command = command.concat(bus_arg);
        command = command.concat(["-l", "1", "-d", "-"]);
        Util.spawn_async(command, (output) => {
            const gpu_regex = /gpu\s([\d.]+)%/i;
            const vram_regex = /vram\s([\d.]+)%\s([\d.]+)([kmgt]b|b)\b/i;

            const gpu = parseFloat(output.match(gpu_regex)[1]);
            const vram_matches = output.match(vram_regex);
            const vram = parseFloat(vram_matches[1]);
            const vram_usage = parseFloat(vram_matches[2]).toFixed(this.decimal_places) + vram_matches[3].toUpperCase();

            this.show(gpu, vram, vram_usage);
        });
    }

    show(gpu, vram, vram_usage) {
        const formatted_gpu = (this.use_compact_label ? "G: " : "GPU: ") + gpu.toFixed(this.decimal_places) + "% ";
        const formatted_vram = (this.use_compact_label ? "V: " : "VRAM: ") + vram.toFixed(this.decimal_places) + "% ";

        switch (this.display_style) {
            case "column":
                this.set_applet_label(formatted_gpu + "\n" + formatted_vram);
                break;
            case "row":
                this.set_applet_label(formatted_gpu + " " + formatted_vram);
                break;
            case "gpu":
                this.set_applet_label(formatted_gpu);
                break;
            case "vram":
                this.set_applet_label(formatted_vram);
        }

        //Only retrieve additional info if the menu is open
        if (this.menu.isOpen) {

            Util.spawn_async(["sensors", "radeon-pci-*", "amdgpu-pci-*"], output => {
                const temp_regex = /(temp1:|edge:)\s+\+([\d.]+°C)/i;
                const temp = output.match(temp_regex)[2];

                const formatted_vram_mb = "<b>VRAM Usage: </b>" + vram_usage;
                const formatted_gpu_long = "<b>GPU Usage: </b>" + gpu.toFixed(this.decimal_places) + "% ";
                const formatted_temp = "<b>Temperature: </b>" + temp;

                this.info_menu_item.label.get_clutter_text().set_markup(formatted_gpu_long + "\n" + formatted_vram_mb + "\n" + formatted_temp, true);
            });
        }
    }

    update_font_size() {
        this._applet_label.style = "font-size: " + this.font_size + "%;";
    }

    on_applet_removed_from_panel() {
        if (this.update_loop_id > 0) {
            Mainloop.source_remove(this.update_loop_id);
            this.update_loop_id = 0;
        }

        this.stop_busy_sampler();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new GPUUsageApplet(metadata, orientation, panel_height, instance_id);
}
