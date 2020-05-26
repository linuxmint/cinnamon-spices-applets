const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const AppletDir = imports.ui.appletManager.appletMeta['serviceLauncher@hulygun'].path;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const UUID = "serviceLauncher@hulygun";

// l10n/translation support

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function ServiceCommand(service, command) {
    var com = 'sudo systemctl ' + command + ' ' + service + '.service';
    Util.spawnCommandLine(com)
}

function MyApplet(orientation) {
    this._init(orientation);
}


MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (orientation) {
        this.orientation = orientation;
        Applet.IconApplet.prototype._init.call(this, orientation);
        this.set_applet_icon_path(AppletDir + "/" + "web-programming.png");
        this.set_applet_tooltip(_("Service launcher"));
        this.refresh();

    },
    refresh: function () {
        this.settings = new Settings.AppletSettings(this, "serviceLauncher@hulygun", this.instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, "services", "services", this.on_settings_changed, null);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);
        var menu = this.menu;
        if (this.services.length) {
            var services = this.services.split(',');
            services.forEach(function (item) {
                if (item !== 'separator') {
                    var vals = item.split(':');
                    var serviceSwitch = new PopupMenu.PopupSwitchMenuItem(vals[0], checkService(vals[1]));
                    serviceSwitch.connect('toggled', function (item) {
                        var command;
                        if (item.state) {
                            command = 'start';
                        } else {
                            command = 'stop';
                        }
                        ServiceCommand(vals[1], command);
                    });
                    menu.addMenuItem(serviceSwitch);
                } else {
                    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                }
            });
        }
    },
    on_applet_clicked: function () {
        this.menu.toggle();
    },
    on_settings_changed: function () {
        this.refresh();
    }
};

function checkService(service) {
    var s = GLib.spawn_async_with_pipes(null, ["pgrep", service], null, GLib.SpawnFlags.SEARCH_PATH, null);
    var c = GLib.IOChannel.unix_new(s[3]);
    let [res, pid, in_fd, out_fd, err_fd] =
        GLib.spawn_async_with_pipes(
            null, ["pgrep", service], null, GLib.SpawnFlags.SEARCH_PATH, null);
    const out_reader = new Gio.DataInputStream({base_stream: new Gio.UnixInputStream({fd: out_fd})});
    let [out, size] = out_reader.read_line(null);
    var result = false;
    if (out != null) {
        result = true;
    }
    return result;
}


function main(metadata, orientation) {
    var myApplet = new MyApplet(orientation);
    return myApplet;
}
