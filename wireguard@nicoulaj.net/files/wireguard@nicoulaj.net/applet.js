// cinnamon-applet-wireguard - https://github.com/nicoulaj/cinnamon-applet-wireguard
// copyright (c) 2019 cinnamon-applet-wireguard contributors
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

const UUID = "wireguard@nicoulaj.net";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "./local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str)
}

function main(metadata, orientation) {
    return new WireGuardApplet(orientation);
}

const WireGuardApplet = class WireGuardApplet extends Applet.IconApplet {

    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._orientation = orientation;
        this._menu_manager = null;
        this._menu = null;
        this._net_monitor = null;
        this._net_monitor_id = null;
        this._net_interfaces = null;
        this._wg_monitor = null;
        this._wg_monitor_id = null;
        this._wg_interfaces = null;

        this.set_applet_icon_name("off");
        this.set_applet_tooltip(_("WireGuard"));
    }

    on_applet_added_to_panel(userEnabled) {

        if (!this._net_monitor) {
            this._net_monitor = Gio.network_monitor_get_default();
            this._net_monitor_id = this._net_monitor.connect('network-changed', (monitor, network_available, user_data) => this._on_net_changed());
        }

        if (!this._wg_monitor) {
            let wg_config_path = Gio.file_new_for_path("/etc/wireguard");
            if (!wg_config_path.query_exists(null)) {
                this._handle_error(_("WireGuard configs directory /etc/wireguard does not exist, please make sure WireGuard is installed"));
                return;
            }
            this._wg_monitor = wg_config_path.monitor_directory(Gio.FileMonitorFlags.SEND_MOVED, null);
            this._wg_monitor_id = this._wg_monitor.connect('changed', (type) => this._on_wg_changed());
        }

        if (!this._menu_manager) {
            this._menu_manager = new PopupMenu.PopupMenuManager(this);
            this._menu = new Applet.AppletPopupMenu(this, this._orientation);
            this._menu_manager.addMenu(this._menu);
        }

        if (!this._net_interfaces)
            this._net_interfaces = this._get_net_interfaces();

        if (!this._wg_interfaces)
            this._wg_interfaces = this._get_wg_interfaces();

        this._refresh();
    }

    on_applet_removed_from_panel(deleteConfig) {
        if (this._net_monitor) {
            this._net_monitor.disconnect(this._net_monitor_id);
            this._net_monitor = null;
        }

        if (this._wg_monitor) {
            this._wg_monitor.disconnect(this._wg_monitor_id);
            this._wg_monitor = null;
        }

        if (this._menu_manager) {
            this._menu_manager.removeMenu(this._menu);
            this._menu = null;
            this._menu_manager = null;
        }

        if (this._net_interfaces)
            this._net_interfaces = null;

        if (this._wg_interfaces)
            this._wg_interfaces = null;
    }

    on_applet_clicked(event) {
        if (this._menu)
            this._menu.toggle();
    }

    on_item_toggled(iface, object, enable) {
        object.setToggleState(!enable);

        try {
            const proc = Gio.Subprocess.new(
                ['pkexec', 'wg-quick', enable ? 'up' : 'down', iface],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE | GLib.SpawnFlags.SEARCH_PATH
            );

            let out, self = this;

            proc.get_stdout_pipe().read_bytes_async(1048576, 0, null, Lang.bind(proc, function (o, result) {
                out = o.read_bytes_finish(result).get_data().toString();
            }));

            proc.wait_async(null, Lang.bind(proc, function (o, result) {
                if (proc.get_exit_status())
                    self._handle_error(_("Failed toggling WireGuard interface"), out, false);
            }));

        } catch (e) {
            this._handle_error(_("Failed calling wg-quick, please make sure it is installed and accessible"), e, false);
        }
    }

    _on_net_changed() {

        const net_interfaces = this._get_net_interfaces();
        if (!net_interfaces)
            return;

        if (!WireGuardApplet._array_equals(this._net_interfaces, net_interfaces)) {
            this._net_interfaces = net_interfaces;
            this._refresh();
        }
    }

    _on_wg_changed() {

        const wg_interfaces = this._get_wg_interfaces();
        if (!wg_interfaces)
            return;

        if (!WireGuardApplet._array_equals(this._wg_interfaces, wg_interfaces)) {
            this._wg_interfaces = wg_interfaces;
            this._refresh();
        }
    }

    _get_net_interfaces() {
        try {
            const interfaces = [];
            for (let file, enumerator = Gio.file_new_for_path("/sys/class/net").enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null); (file = enumerator.next_file(null)) !== null;)
                interfaces.push(file.get_name());
            return interfaces;
        } catch (e) {
            this._handle_error(_("Failed reading network interfaces"), e);
        }
    }

    _get_wg_interfaces() {
        try {
            const interfaces = [];
            for (let file, enumerator = Gio.file_new_for_path("/etc/wireguard").enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null); (file = enumerator.next_file(null)) !== null;)
                if (file.get_file_type() == Gio.FileType.REGULAR && file.get_name().endsWith(".conf"))
                    interfaces.push(file.get_name().slice(0, -5));
            return interfaces;
        } catch (e) {
            this._handle_error(_("Failed accessing WireGuard configs directory, please make sure it is accessible\nsudo chmod o+r /etc/wireguard or sudo setfacl -m u:$username:rx /etc/wireguard"), e);
        }
    }

    _refresh() {

        if (!this._menu)
            return;

        this._menu.removeAll();

        let active_ifaces = 0;

        for (let i = 0; i < this._wg_interfaces.length; i++) {
            const iface = this._wg_interfaces[i];

            const enabled = this._net_interfaces.includes(iface);
            if (enabled)
                active_ifaces++;

            const item = new PopupMenu.PopupSwitchMenuItem(iface, enabled);
            item.connect('toggled', (object, value) => this.on_item_toggled(iface, object, value));
            this._menu.addMenuItem(item);
        }

        this.set_applet_icon_name(active_ifaces > 0 ? "on" : "off");
        this.set_applet_tooltip(_("WireGuard"));
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
