// cinnamon-applet-IntelTurboBoost - https://github.com/wsmenezes/cinnamon-applet-IntelTurboBoost
// copyright (c) 2023 cinnamon-applet-IntelTurboBoost contributors
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
// ----------------------------------------------------------------------

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;

const UUID = "IntelTurboBoost@wsmenezes";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "./local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str)
}

function main(metadata, orientation) {
    return new TurboBoostApplet(orientation);
}

function exec_async(args) {
    return new Promise((resolve, reject) => {
        let strOUT = '';
        try {
            let proc = Gio.Subprocess.new(args, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if(proc.get_successful()) strOUT = stdout;
                }
                catch (e) {
                    logError(e);
                }
                finally {
                    resolve(strOUT);
                }
            });
        }
        catch (e) {
            logError(e);
        }
    })
}

const TurboBoostApplet = class TurboBoostApplet extends Applet.IconApplet {

    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._orientation = orientation;
        this._menu_manager = null;
        this._menu = null;

        this.set_applet_icon_name("off");
        this.set_applet_tooltip(_("Intel Turbo Boost"));
    }

    on_applet_added_to_panel(userEnabled) {

        if (!this._menu_manager) {
            this._menu_manager = new PopupMenu.PopupMenuManager(this);
            this._menu = new Applet.AppletPopupMenu(this, this._orientation);
            this._menu_manager.addMenu(this._menu);
        }

        this._refresh();
    }

    on_applet_removed_from_panel(deleteConfig) {

        if (this._menu_manager) {
            this._menu_manager.removeMenu(this._menu);
            this._menu = null;
            this._menu_manager = null;
        }

    }

    on_applet_clicked(event) {
        if (this._menu)
            this._menu.toggle();
    }

    async on_item_toggled(object, enable) {

        try {
            if (enable)
                await exec_async(['pkexec', 'wrmsr', '-a', '0x1a0', '0x850089']);
            else
                await exec_async(['pkexec', 'wrmsr', '-a', '0x1a0', '0x4000850089']);

            object.setToggleState(enable);
            this._refresh();

        } catch (e) {
            this._handle_error(_("Failed calling wrmsr, please make sure msr-tools package is installed and accessible."), e, false);
        }
    }

    async _refresh() {

        if (!this._menu)
            return;

        this._menu.removeAll();

        let is_turbo_enabled = !(!!parseInt(await exec_async(['cat', '/sys/devices/system/cpu/intel_pstate/no_turbo'])));

        const item = new PopupMenu.PopupSwitchMenuItem('Turbo Boost', is_turbo_enabled);
        item.connect('toggled', (object, value) => this.on_item_toggled(object, value));

        this._menu.addMenuItem(item);

        this.set_applet_icon_name(is_turbo_enabled ? "on" : "off");
        this.set_applet_tooltip(_("Intel Turbo Boost"));
    }

    _handle_error(msg, details = null, fatal = true) {
        let formatted = msg;

        if (details)
            formatted += "\n\n" + _("Error details") + ":\n" + details;

        global.logError(formatted);

        new ModalDialog.NotifyDialog(formatted).open();

        if (fatal) {
            this.on_applet_removed_from_panel();
            this.set_applet_tooltip(msg);
        }
    }

    static _array_equals(arr1, arr2) {
        return arr1.length == arr2.length && arr1.filter(e => arr2.includes(e)).length == arr1.length
    }
};
