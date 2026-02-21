
/**
 * Screen Snipper
 * Copyright (C) 2026 kprakesh
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;

class ScreenSnipperApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        // Initialize default value to prevent "undefined" in menu before settings load
        this.delaySeconds = 0;

        // Bind settings
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        
        // Correctly bind the callback using .bind(this)
        this.settings.bindProperty(Settings.BindingDirection.IN, 
            "delay-seconds", 
            "delaySeconds", 
            this.on_settings_changed.bind(this), 
            null
        );

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_tooltip("Screen Snipper");

        // Use the system icon name (as discussed previously)
        this.set_applet_icon_symbolic_name("edit-cut-symbolic");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._buildMenu();
    }

    on_settings_changed() {
        this._buildMenu();
    }

    _buildMenu() {
        this.menu.removeAll();

        // 1. Capture Area Item
        let itemClipboard = new PopupMenu.PopupMenuItem("Capture Area");
        // Use Arrow Function instead of Lang.bind
        itemClipboard.connect('activate', () => this._snipToClipboard());
        this.menu.addMenuItem(itemClipboard);

        // 2. Delayed Capture Item
        let delayText = `Delayed Capture (${this.delaySeconds}s)`;
        let itemDelayed = new PopupMenu.PopupMenuItem(delayText);
        itemDelayed.connect('activate', () => this._fullScreenDelayed());
        this.menu.addMenuItem(itemDelayed);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _checkDependency() {
        if (!GLib.find_program_in_path("gnome-screenshot")) {
            Main.notify("Screen Snipper Error", "Please install 'gnome-screenshot' to use this applet.");
            return false;
        }
        return true;
    }

   _snipToClipboard() {
        if (this._checkDependency()) {
            Util.spawnCommandLine("gnome-screenshot -a -c");
        }
    }

   _fullScreenDelayed() {
        if (this._checkDependency()) {
            Util.spawnCommandLine(`gnome-screenshot -c -d ${this.delaySeconds}`);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ScreenSnipperApplet(metadata, orientation, panel_height, instance_id);
}