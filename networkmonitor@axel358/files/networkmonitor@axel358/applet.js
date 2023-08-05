const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
const GTop = imports.gi.GTop;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;

class NetworkUsageApplet extends Applet.TextApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.settings = new Settings.AppletSettings(this, "networkmonitor@axel358", instance_id);

        this.settings.bind("refresh-interval", "refresh_interval", this.on_settings_changed);
        this.settings.bind("decimal-places", "decimal_places", this.on_settings_changed);
        this.settings.bind("hide-umbral", "hide_umbral", this.on_settings_changed);
        this.settings.bind("display-style", "display_style", this.on_settings_changed);

        this.set_applet_tooltip("Click for more details");

        const menu_manager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        menu_manager.addMenu(this.menu);

        this.info_menu_item = new PopupMenu.PopupMenuItem("Collecting data...", { reactive: false });
        this.menu.addMenuItem(this.info_menu_item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const item = new PopupMenu.PopupMenuItem(_("Open System Monitor"));
        item.connect('activate', () => Util.spawnCommandLine("gnome-system-monitor"));
        this.menu.addMenuItem(item);

        this.netload = new GTop.glibtop_netload();

        //Hack: this fails the first time it's called during Cinnamon startup
        try {
            this.devices = GTop.glibtop.get_netlist(new GTop.glibtop_netlist()).filter(device => device !== "lo");
        } catch (e) {
            this.devices = GTop.glibtop.get_netlist(new GTop.glibtop_netlist()).filter(device => device !== "lo");
        }

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
        //Gather network traffic on all devices
        let down = 0;
        let up = 0;

        this.devices.forEach(device => {
            GTop.glibtop.get_netload(this.netload, device);
            down += this.netload.bytes_in;
            up += this.netload.bytes_out;
        });

        //Get current up and down speed in bytes per second
        const down_speed = (down - this.last_down) / this.refresh_interval * 1000;
        const up_speed = (up - this.last_up) / this.refresh_interval * 1000;
        const total_speed = down_speed + up_speed;

        const formatted_down_speed = this.formatBytes(down_speed, this.decimal_places) + "/s";
        const formatted_up_speed = this.formatBytes(up_speed, this.decimal_places) + "/s";
        const formatted_total_speed = this.formatBytes(total_speed, this.decimal_places) + "/s";

        //Update last up and down
        this.last_down = down;
        this.last_up = up;

        if (total_speed >= this.hide_umbral) {
            switch (this.display_style) {
                case "combined":
                    this.set_applet_label("\u21f5 " + formatted_total_speed);
                    break;
                case "column":
                    this.set_applet_label("\u2191 " + formatted_up_speed + "\n\u2193 " + formatted_down_speed);
                    break;
                case "row":
                    this.set_applet_label("\u2191 " + formatted_up_speed + " \u2193 " + formatted_down_speed);
                    break;
                case "download":
                    this.set_applet_label("\u2193 " + formatted_down_speed);
                    break;
                case "upload":
                    this.set_applet_label("\u2191 " + formatted_up_speed);
            }
        }
        else
            this.set_applet_label("\u21f5");

        //Only retrieve additional info if the menu is open
        if (this.menu.isOpen) {
            this.info_menu_item.label.get_clutter_text().set_markup("<b>Downloaded: </b>" + this.formatBytes(down) + "\n<b>Uploaded: </b>" + this.formatBytes(up), true)
        }

        this.update_loop_id = Mainloop.timeout_add(this.refresh_interval, Lang.bind(this, this.update));
    }

    formatBytes(bytes, decimals = 1) {
        if (bytes === 0)
            return '0 B';

        const kilo = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const index = Math.floor(Math.log(bytes) / Math.log(kilo));

        return parseFloat((bytes / Math.pow(kilo, index)).toFixed(decimals)) + " " + sizes[index];
    }

    on_applet_removed_from_panel() {
        if (this.update_loop_id > 0) {
            Mainloop.source_remove(this.update_loop_id);
            this.update_loop_id = 0;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new NetworkUsageApplet(metadata, orientation, panel_height, instance_id);
}
