/*
 * Netctl Status is a Cinnamonon applet that indicates netctl status in the notification area.
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

const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gettext = imports.gettext;
const GObject = imports.gi.GObject;
const Signals = imports.signals;
const Mainloop = imports.mainloop;
const MessageTray = imports.ui.messageTray;
const Util = imports.misc.util;
const UUID = "netctlstatus@prmurthy";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// const NETWORK_CONNECTED = "network-wireless-symbolic";
// const NETWORK_OFFLINE = "network-offline-symbolic";

const NETWORK_OFFLINE = "network-error-symbolic";
const NETWORK_ETHERNET = "network-wired-symbolic";
const NETWORK_WL_CONNECTED_0 = "network-wireless-signal-none-symbolic";
const NETWORK_WL_CONNECTED_1 = "network-wireless-signal-weak-symbolic";
const NETWORK_WL_CONNECTED_2 = "network-wireless-signal-ok-symbolic";
const NETWORK_WL_CONNECTED_3 = "network-wireless-signal-good-symbolic";
const NETWORK_WL_CONNECTED_4 = "network-wireless-signal-excellent-symbolic";


let indicator;
let event=null;

function Netctl(orientation) {
  this._init(orientation);
}

Netctl.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);
	
	try {
        this._set_icon();
	this._refresh_details();
	}
	catch (e) {
		global.logError(e);
	}
    },

    _get_connected_networks: function() {
	let check_interface_exists = GLib.spawn_command_line_sync("ip route list")[1].toString();

	// if this returns a null, then there are no active interfaces 
	if(check_interface_exists == ""){ return ["N", _("None"), 0];}

	let iface = check_interface_exists.split(" ",5)[4].toString();

	// interface name begins with e, so it must be Ethernet
	if(iface.charAt(0) == "e"){return ["E", _("Ethernet"), 0];} else

	// interface name begins with w so it must be wireless
	if(iface.charAt(0) == "w") {
		let t1 = GLib.spawn_command_line_sync("iwconfig").toString().match(/Quality=.*/).toString();
		let qmax = t1.substr(11,2).valueOf();
		let q = t1.substr(8,2).valueOf();
		let strength = (q/qmax).toFixed(2);
	
		let profiles =  GLib.spawn_command_line_sync("netctl list")[1].toString();
	        let connected = profiles.match(/\*.*/g);
		if(connected == null){

//		if above returns null, netctl could be in auto mode. So we check as below
			let shellcmd = "wpa_cli -i " + iface + " status";
			let connected = GLib.spawn_command_line_sync(shellcmd)[1].toString().match(/(?:.*?(id_str.*)){1}/)[1].toString().slice(7);
			return ["A", connected, strength]; //we are connected automatically
		}else { return ["M", connected.toString().slice(2), strength];} // we are connected manually
	}else { return ["N", _("None"), 0];} // Something's wrong if we are here
    },

    _set_icon: function(){
        let icon_name = "";
	let networkname = this._get_connected_networks();
	if(networkname[1] == _("Ethernet")){
	    icon_name = NETWORK_ETHERNET;
	    tooltiptext = _("Connected via Ethernet");
	}else if (networkname[1] == null || networkname[1] == "None"){
            icon_name = NETWORK_OFFLINE;
	    tooltiptext = _("Not Connected");
        } else {
		let contype;            	
		let quality = (networkname[2]*100).valueOf();
		if (networkname[0] == "A") { contype = _("Auto: ");} else
		if (networkname[0] == "M") { contype = _("Manual: ");}
	        tooltiptext = contype + _("Connected to ") + networkname[1].toString() + " : " + quality.toString() + "%";
		if (quality < 25) { icon_name = NETWORK_WL_CONNECTED_1;} else
		if (quality < 50) { icon_name = NETWORK_WL_CONNECTED_2;} else
		if (quality < 75) { icon_name = NETWORK_WL_CONNECTED_3;} else
		if (quality <= 100) { icon_name = NETWORK_WL_CONNECTED_4;}
        }

	this.set_applet_tooltip(tooltiptext);
        let statusIcon = new St.Icon({icon_name: icon_name, icon_size: 16 });

        this.actor.get_children().forEach(function(c) {
            c.destroy()
        });
        this.actor.add_actor(statusIcon);
    },

    _refresh_details: function() {
        event = GLib.timeout_add_seconds(0, 5, Lang.bind(this, function () {
            this._set_icon();
            return true;
        }));
    }


}

function main(metadata, orientation) {
    let myApplet = new Netctl(orientation);
    return myApplet;
}
