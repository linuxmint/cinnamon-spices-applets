/*
  applet.js - Cinnamon entry point
  Copyright (C) 2016  Gaston Brito <2 previous words without separators in gmail>
 
  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.
 
  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.
 
  You should have received a copy of the GNU General Public License along
  with this program; if not, write to the Free Software Foundation, Inc.,
  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Lang = imports.lang;

function launchPython(path, params) {
    Util.spawnCommandLine("/usr/bin/python3 " + path + "/desktopiconsize.py" + params);
}

function MyApplet (metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {

    __proto__: Applet.IconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {

        // Initialize

        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._metadata = metadata;
        this.set_applet_icon_path(this._metadata.path + "/iconpanel.svg");
        this.set_applet_tooltip("Desktop Icon Size");

        // Create menu

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Create menu items

        this.diswindow = new PopupMenu.PopupMenuItem("Adjust icons");
        this.profile1  = new PopupMenu.PopupMenuItem("Load profile 1");
        this.profile2  = new PopupMenu.PopupMenuItem("Load profile 2");
        this.profile3  = new PopupMenu.PopupMenuItem("Load profile 3");
        this.profile4  = new PopupMenu.PopupMenuItem("Load profile 4");

        // Handle events

        this.diswindow.connect('activate', Lang.bind(this, function() {
            launchPython(this._metadata.path, "");
        }));
        this.profile1.connect('activate', Lang.bind(this, function() {
            launchPython(this._metadata.path, " -p 0");
        }));
        this.profile2.connect('activate', Lang.bind(this, function() {
            launchPython(this._metadata.path, " -p 1");
        }));
        this.profile3.connect('activate', Lang.bind(this, function() {
            launchPython(this._metadata.path, " -p 2");
        }));
        this.profile4.connect('activate', Lang.bind(this, function() {
            launchPython(this._metadata.path, " -p 3");
        }));

        // Add menu items to menu

        this.menu.addMenuItem(this.diswindow);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.profile1);
        this.menu.addMenuItem(this.profile2);
        this.menu.addMenuItem(this.profile3);
        this.menu.addMenuItem(this.profile4);
    },

    on_applet_clicked: function() {
        this.menu.toggle();
    }

};

function main (metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
