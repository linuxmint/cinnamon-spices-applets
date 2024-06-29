const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
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

                    const vram_mb = parseFloat(vram_matches[2]);
                    const formatted_vram_mb = "<b>VRAM Usage: </b>" + vram_mb.toFixed(this.decimal_places) + vram_matches[3].toUpperCase();
                    const formatted_gpu_long = "<b>GPU Usage: </b>" + gpu.toFixed(this.decimal_places) + "% ";
                    const formatted_temp = "<b>Temperature: </b>" + temp;

                    this.info_menu_item.label.get_clutter_text().set_markup(formatted_gpu_long + "\n" + formatted_vram_mb + "\n" + formatted_temp, true);
                });
            }
        });
        this.update_loop_id = Mainloop.timeout_add(this.refresh_interval, Lang.bind(this, this.update));
    }

    update_font_size() {
        this._applet_label.style = "font-size: " + this.font_size + "%;";
    }

    on_applet_removed_from_panel() {
        if (this.update_loop_id > 0) {
            Mainloop.source_remove(this.update_loop_id);
            this.update_loop_id = 0;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new GPUUsageApplet(metadata, orientation, panel_height, instance_id);
}
