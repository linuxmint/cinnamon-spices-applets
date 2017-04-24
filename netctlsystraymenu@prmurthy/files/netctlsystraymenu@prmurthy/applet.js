/*
 * Netctl Status is a Cinnamonon applet that indicates netctl status in the notification area.
 * It also allows you to switch between manual profiles, or enable netctl-auto
 *
 * Copyright (C) 2013  Pradeep Murthy
 * This program is based on the Netctl Menu gnome-shell extension by Tjaart van der Walt
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
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
const version = 2.0
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const GObject = imports.gi.GObject;
const Signals = imports.signals;
const Mainloop = imports.mainloop;
const MessageTray = imports.ui.messageTray;
const Util = imports.misc.util;

// Icons
const NETWORK_OFFLINE = "network-error-symbolic";
const NETWORK_ETHERNET = "network-wired-symbolic";
const NETWORK_WL_CONNECTED_0 = "network-wireless-signal-none-symbolic";
const NETWORK_WL_CONNECTED_1 = "network-wireless-signal-weak-symbolic";
const NETWORK_WL_CONNECTED_2 = "network-wireless-signal-ok-symbolic";
const NETWORK_WL_CONNECTED_3 = "network-wireless-signal-good-symbolic";
const NETWORK_WL_CONNECTED_4 = "network-wireless-signal-excellent-symbolic";

let indicator;
let event = null;
let iface;
let wl_contype;
let enet_static_iface;
let wl_static_iface;

function Netctl(orientation) {
    this._init(orientation);
}

function execute_async(command) {
    try {
        let[result, argv] = GLib.shell_parse_argv(command);
        let[returnval, pid] = GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function () {
            close_async(pid);
        });
        return pid;
    } catch (e) {
        global.logError(e);
    }
}

function close_async(pid) {
    try {
        GLib.spawn_close_pid(pid);
    } catch (e) {
        global.logError(e);
    }
}

Netctl.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._update_menu();
            this._set_icon();
            this._refresh_details();
        } catch (e) {
            global.logError(e);
        }
    },

    _get_interface: function () {
        // gets the currently active interface. returns the active interface name if any

        let check_interface_exists = GLib.spawn_command_line_sync("ip route list")[1].toString();

        // if this returns a null, then there are no active interfaces 
        if (check_interface_exists == "") {
            iface = "";
            this._get_static_interface();

            wl_contype = "N";
            return "";
        }
        let iface0 = check_interface_exists.split(" ", 5)[4].toString();
        return iface0;
    },

    _get_static_interface: function () {
        // gets the names of the network devices in the system. sets the global variables wl_static_interface and enet_static_interface
        // we are assuming that there is only 1 wireless and ethernet interface each, and the interface names start with w and e respectively
        // If there are more than one interface each, the last interface will be the static interface selected

        let ifacelist = GLib.spawn_command_line_sync("ls /sys/class/net").toString();
        all_iface = ifacelist.split("\n", 3);
        for (i = 0; i < all_iface.length; i++) {
            if (all_iface[i].charAt(0) == "w") {
                wl_static_iface = all_iface[i]
            } else
            if (all_iface[i].charAt(0) == "e") {
                enet_static_iface = all_iface[i]
            }
        }
    },

    _get_connected_networks: function () {
        // finds out the name of the network we are connected to, and how
        // returns the connection type (Ethernet, Auto, Manual), Name of the connected wireless network if any, and signal quality as a 2digit decimal

        if (iface == "") {
            return [wl_contype, "None", 0];
        }

        // interface name begins with e, so it must be Ethernet
        if (iface.charAt(0) == "e") {
            wl_contype = "E";
            return [wl_contype, "Ethernet", 0];
        } else

        // interface name begins with w so it must be wireless
        if (iface.charAt(0) == "w") {
            let t1 = GLib.spawn_command_line_sync("iwconfig").toString().match(/Quality=.*/).toString();
            let qmax = t1.substr(11, 2).valueOf();
            let q = t1.substr(8, 2).valueOf();
            let strength = (q / qmax).toFixed(2);

            let profiles = GLib.spawn_command_line_sync("netctl list")[1].toString();
            let connected = profiles.match(/\*.*/g);
            if (connected == null) {

                //if above returns null, netctl could be in auto mode. So we check as below
                let shellcmd = "wpa_cli -i " + iface + " status";
                let connected = GLib.spawn_command_line_sync(shellcmd)[1].toString().match(/(?:.*?(id_str.*)){1}/)[1].toString().slice(7);
                wl_contype = "A";
                return [wl_contype, connected, strength]; //we are connected automatically
            } else {
                wl_contype = "M";
                return [wl_contype, connected.toString().slice(2), strength];
            } // we are connected manually
        } else {
            return ["N", "None", 0];
        } // Something's wrong if we are here
    },

    _set_icon: function () {
        // Sets the systray icon and the tooltip text, after getting data from _get_connected_networks

        let icon_name = "";
        let networkname = this._get_connected_networks();
        if (networkname[1] == "Ethernet") {
            icon_name = NETWORK_ETHERNET;
            tooltiptext = "Connected via Ethernet";
        } else if (networkname[1] == null || networkname[1] == "None") {
            icon_name = NETWORK_OFFLINE;
            tooltiptext = "Not Connected";
        } else {
            let contype;
            let quality = (networkname[2] * 100).valueOf();
            if (networkname[0] == "A") {
                contype = "Auto: ";
            } else
            if (networkname[0] == "M") {
                contype = "Manual: ";
            }
            tooltiptext = contype + "Connected to " + networkname[1].toString() + " : " + quality.toString() + "%";
            if (quality < 25) {
                icon_name = NETWORK_WL_CONNECTED_1;
            } else
            if (quality < 50) {
                icon_name = NETWORK_WL_CONNECTED_2;
            } else
            if (quality < 75) {
                icon_name = NETWORK_WL_CONNECTED_3;
            } else
            if (quality <= 100) {
                icon_name = NETWORK_WL_CONNECTED_4;
            }
        }

        this.set_applet_tooltip(tooltiptext);
        let statusIcon = new St.Icon({
            icon_name: icon_name,
            icon_size: 16
        });

        this.actor.get_children().forEach(function (c) {
            c.destroy()
        });
        this.actor.add_actor(statusIcon);
    },

    _get_network_profiles: function () {
        // gets the list of netctl profiles
        // returns an array of profile names

        var profileString = GLib.spawn_command_line_sync("netctl list")[1].toString();
        var profileArray = profileString.split("\n")
        return profileArray.splice(0, profileArray.length - 1)
    },

    _switch_to_profile: function (newprofileName) {
        // switches to selected manual profile. Not used for switching to auto profile because netctl switch-to doesnt work for switching from manual profile to auto

        let _wl_contype = wl_contype;
        let oldprofile = this._get_connected_networks();
        let msg = "Switching to" + newprofileName + ". Please enter your password";
        if (_wl_contype == "A") {
            shellcmd = "gksudo --message \"" + msg + "\" \"sh -c " + "\'systemctl stop netctl-auto@" + iface + "; netctl switch-to " + newprofileName + "\'" + "\"";
            let pid = execute_async(shellcmd);
            // wait for child to exit and then check if it worked
            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function () {
                Netctl.prototype._switch_back_on_failure(_wl_contype, oldprofile[1].toString(), newprofileName);
            });

        } else if (_wl_contype == "M" || _wl_contype == "N") {
            shellcmd = "gksudo --message \"" + msg + "\" netctl switch-to " + newprofileName;
            let pid = execute_async(shellcmd);

            // wait for child to exit and then check if it worked
            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function () {
                Netctl.prototype._switch_back_on_failure(_wl_contype, oldprofile[1].toString(), newprofileName);
            });

        }
    },

    _switch_back_on_failure: function (contype, oldprofileName, newprofileName) {
        // checks if the switch to a new profile worked. If it didnt, switches back to old profile. calls _get_connected_networks to update variables. updates the menu

        // if iface is set to null by _get_interface, it means we arent connected any more. The switch failed, so need to switch back
        iface = this._get_interface();
        this._get_connected_networks();

        if (iface == "") {
            if (contype == "A") {
                msg = "The wireless network" + newprofileName + " is not available. Re-enabling the auto profile. Please enter your password again";
                shellcmd = "gksudo --message \"" + msg + "\" \"sh -c " + "\'systemctl restart netctl-auto@" + wl_static_iface + "\'" + "\"";
                execute_async(shellcmd);
            } else
            if (contype == "M") {
                msg = "The wireless network" + newprofileName + " is not available. Switching back to" + oldprofileName + ". Please enter your password again";
                shellcmd = "gksudo --message \"" + msg + "\" \"sh -c " + "\'netctl start " + oldprofileName + "\'" + "\"";
                execute_async(shellcmd);
            } else {
                Main.notify("Netctl: Sorry, the wireless network" + newprofileName + " is not available");
            }
        } else {
            Main.notify("Netctl: Connected to" + newprofileName);
        }
        this._update_menu();

    },

    _add_auto_wl_menu_item: function () {
        // adds the menu item for switching to wireless auto profile

        let menuItem = new PopupMenu.PopupMenuItem("  Switch to auto");
        this.menu.addMenuItem(menuItem);
        menuItem.connect('activate', Lang.bind(this, function () {
            this._auto_wl_connect();
        }));

    },

    _auto_wl_connect: function () {
        // switches to the wireless auto profile. first switches off any active manual profiles.
        // we are assuming that this always works

        let profileName = this._get_connected_networks();
        let msg = "Switching to auto. Please enter your password";
        if (iface == "") {
            shellcmd = "gksudo --message \"" + msg + "\" \"sh -c " + "\'netctl stop-all; systemctl restart netctl-auto@" + wl_static_iface + "\'" + "\"";
        } else {
            shellcmd = "gksudo --message \"" + msg + "\" \"sh -c " + "\'netctl stop " + profileName[1] + "; systemctl restart netctl-auto@" + iface + "\'" + "\"";
        }
        var pid = execute_async(shellcmd);
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function () {
            Main.notify("Netctl: Switched to wireless auto profile");
        });

    },

    _add_wifi_menu_menu_item: function () {
    // adds menu item for wifi-menu

        let menuItem = new PopupMenu.PopupMenuItem("  Add new networks (run wifi-menu)");
        this.menu.addMenuItem(menuItem);
        menuItem.connect('activate', Lang.bind(this, function () {
	    var msg = "Wifi-menu needs admin privileges. Please enter your password"
            shellcmd = "gksudo  --message \"" + msg + "\" \"/usr/bin/xterm -e " + "\"" + "/usr/bin/wifi-menu" + "\"" + "\""
	    var pid = execute_async(shellcmd);
        }));
    },
	

    _add_profile_menu_item: function (profile) {
        // adds profiles to the menu. provides click action for inactive profiles      

        if (!profile.match(/\*.*/g)) {
            let menuItem = new PopupMenu.PopupMenuItem(profile);
            this.menu.addMenuItem(menuItem);
            menuItem.connect('activate', Lang.bind(this, function () {
                this._switch_to_profile(profile);
            }));
        } else {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(profile, {
                reactive: false
            }));
        }
    },

    _update_menu: function () {
        // creates the menu

        this.menu.removeAll();
        iface = this._get_interface();

        var profiles = this._get_network_profiles();
        for (let i = 0; i < profiles.length; i++) {
            this._add_profile_menu_item(profiles[i]);
        }
        if (wl_contype !== "A") {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._add_auto_wl_menu_item();
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._add_wifi_menu_menu_item();
    },

    _refresh_details: function () {
        // refreshes the menu and icons/tooltip text

        event = GLib.timeout_add_seconds(0, 5, Lang.bind(this, function () {
            this._update_menu();
            this._set_icon();
            return true;
        }));
    },

    on_applet_clicked: function (event) {
        this.menu.toggle();
    }

}

function main(metadata, orientation) {
    let myApplet = new Netctl(orientation);
    return myApplet;
}
