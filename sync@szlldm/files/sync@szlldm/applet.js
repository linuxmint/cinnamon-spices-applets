/*
 *    Cinnamon DE panel applet to show unwritten data amount and initiate sync
 *    Copyright (C) 2017  szlldm
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU General Public License as published by
 *    the Free Software Foundation, either version 3 of the License, or
 *    (at your option) any later version.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU General Public License for more details.
 *
 *    You should have received a copy of the GNU General Public License
 *    along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const UUID = "sync@szlldm";
const AppletDir = imports.ui.appletManager.appletMeta["sync@szlldm"].path;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "./local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str)
}

function MyApplet(orientation) {
    this._init(orientation);

}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            this.set_applet_icon_path(AppletDir + '/icon.png');
            //this.set_applet_icon_name("emblem-ubuntuone-unsynchronized");
            this.set_applet_tooltip(_("Click to sync"));
            this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
            this._update();
        }
        catch (e) {
            global.logError(e);
        }
    },

    _update: function() {
	let [res1, out1] = GLib.spawn_command_line_sync('grep -e Dirty: /proc/meminfo');
	let [res2, out2] = GLib.spawn_command_line_sync('grep -e Writeback: /proc/meminfo');
	var dirty = out1.toString();
	var writeback = out2.toString();

	dirty = dirty.substring(7).trim();
	writeback = writeback.substring(11).trim();

	var text =  _("Click to sync");

	text += "\n---------------------------\n";
	text += dirty + " / " + writeback;

	this.set_applet_tooltip(text.toString());

	var sum = parseFloat(dirty) + parseFloat(writeback);
	if (sum >= 1073741824.0) {
		sum = sum / 1073741824.0;
		text = sum.toFixed(2).toString() + " TB";
	} else
	if (sum >= 1048576.0) {
		sum = sum / 1048576.0;
		text = sum.toFixed(2).toString() + " GB";
	} else
	if (sum >= 1024.0) {
		sum = sum / 1024.0;
		text = sum.toFixed(2).toString() + " MB";
	} else {
		text = sum.toString() + " kB";
	}


	this.set_applet_label(text);
	this.actor.style = "width: 100px";
	imports.mainloop.timeout_add(1000, Lang.bind(this, this._update));
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (this._applet_enabled) {
            if (event.get_button() == 1) {
                if (!this._draggable.inhibit) {
                    return false;
                } else {
                    GLib.spawn_command_line_async('sync');
                }
            }
        }
        return true;
    }

};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
