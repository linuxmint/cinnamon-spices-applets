// fw_fanctrl: A simple Cinnamon applet to control the fan-speed strategy
// See: https://github.com/not-a-feature/fw_fanctrl_applet

// @author: Jules Kreuer / not_a_feature
// License: GPL-3.0
const Applet = imports.ui.applet;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const AppletSettings = imports.ui.settings;

const UUID = "fw_fanctrl@juleskreuer.eu";
const APPLET_DIR = imports.ui.appletManager.appletMeta[UUID].path;

class FW_CONTROL extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.applet_dir = metadata.path;
        this.settings = new AppletSettings.AppletSettings(this, UUID, instance_id);

        this.set_icon();
        //this.set_applet_icon_symbolic_name('node-segment-curve');

        this.set_applet_tooltip("Framework Fan Strategy Control");

        /**
         * Menu Manager and Menu
         */

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        let titleItem = new PopupMenu.PopupMenuItem('Select fan strategy', { reactive: false });
        this.menu.addMenuItem(titleItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.buildMenu();
    }

    buildMenu() {
        let settingsData = this.settings["settingsData"];
        for (let label_idx in settingsData["strategies"]) {
            let label = settingsData["strategies"][label_idx];

            let active = settingsData[label]["value"]
            if (active) {
                let visual_label = settingsData[label + "-label"]["description"]
                let icon = settingsData[label + "-icon"]["value"]
                let menuItem = new PopupMenu.PopupIconMenuItem(
                     visual_label,
                     icon,
                    St.IconType.SYMBOLIC);

                menuItem.connect('activate', () => {
                    this.activateStrategy(label);
                });

                this.menu.addMenuItem(menuItem);
            }
        }

    }

    set_icon() {
        let icon_name = this.is_theme_dark() ? '/icon_light.png' : '/icon.png';
        let icon_path = APPLET_DIR + icon_name;
        this.set_applet_icon_path(icon_path);
    }



    is_theme_dark() {
        try {
            let [success, theme_name] = GLib.spawn_command_line_sync("gsettings get org.cinnamon.theme name");
            if (!success) {
                return false;
            }
            theme_name = byte_array_to_string(theme_name)
            return theme_name.toLowerCase().includes('dark');

        } catch (error) {
            return false;
        }

    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    activateStrategy(strategy) {
        Util.spawnCommandLine("fw-fanctrl " + strategy);
        this.menu.close();
    }
}

function byte_array_to_string(data) {
    if (data.hasOwnProperty("toString")) {
        return "" + data.toString();
    }
    return "" + data;
}

function main(metadata, orientation, panel_height, instance_id) {
    return new FW_CONTROL(metadata, orientation, panel_height, instance_id);
}
