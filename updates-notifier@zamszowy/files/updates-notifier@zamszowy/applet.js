const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const { themeManager } = imports.ui.main;

const UUID = "updates-notifier@zamszowy";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');
function _(str) { return Gettext.dgettext(UUID, str); }

function UpdatesNotifier(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

UpdatesNotifier.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {

        this.applet_path = metadata.path;

        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("update-notifier-none-dark");
        this.hide_applet_label(true);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        if (!GLib.find_program_in_path("gnome-terminal")) {
            this.hide_applet_icon(true);
            this.hide_applet_label(false);
            this.set_applet_label(_("missing dependencies"));
            return;
        }

        this.uuid = metadata.uuid;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        this.settings.bind("update-refresh", "refreshTimeout", this._set_check_interval, null);
        this.settings.bind("hide-applet", "hideApplet", this._update, null);

        this.settings.bind("different-levels", "differentLevels", this._update, null);
        this.settings.bind("level-1", "level1", this._update, null);
        this.settings.bind("level-2", "level2", this._update, null);

        this.settings.bind("commandUpdate", "commandUpdate", null, null);
        this.settings.bind("commandUpgrade", "commandUpgrade", null, null);

        this.settings.bind("icon-style", "icon_style", this._update, null);

        this.packages_count = 0;

        this.interval = null;

        this._refreshUpdatesInfo();
        this._set_check_interval();
    },

    _apply_applet_icon: function (icon_name) {
        let full_icon_name = icon_name + "-";
        if (this.icon_style == "dark") {
            full_icon_name += "dark";
        } else if (this.icon_style == "light") {
            full_icon_name += "light";
        } else if (this.icon_style == "symbolic") {
            full_icon_name += "symbolic";
        } else {
            full_icon_name += "dark";
        }
        this.set_applet_icon_name(full_icon_name);
    },

    _set_check_interval: function () {
        let parsedMinutes = parseInt(this.refreshTimeout);
        if (isNaN(parsedMinutes) || parsedMinutes < 1) {
            this.refreshTimeout = "60";
            parsedMinutes = 60;
        }
        const milis = parsedMinutes * 60 * 1000;

        this._update();

        if (this.interval) {
            Util.clearInterval(this.interval);
        }
        this.interval = Util.setInterval(() => {
            Util.spawn_async(['/usr/bin/bash', this.applet_path + '/updates.sh', "check"], (stdout) => {
                this.packages_count = parseInt(stdout.trim());
                this._update();
            });
        }, milis);
    },

    _update: function () {
        const count = this.packages_count;

        this.set_applet_enabled(!this.hideApplet || count != 0);
        const tooltip = count > 0
            ? _("%s updates available").format(count.toString())
            : _("No updates available");
        this.set_applet_tooltip(tooltip);

        if (this.differentLevels) {
            if (count <= 0) {
                this._apply_applet_icon("update-notifier-none");
            } else if (count < this.level1) {
                this._apply_applet_icon("update-notifier-low");
            } else if (count < this.level2) {
                this._apply_applet_icon("update-notifier-medium");
            } else {
                this._apply_applet_icon("update-notifier-high");
            }
        } else {
            if (count <= 0) {
                this._apply_applet_icon("update-notifier-none");
            } else {
                this._apply_applet_icon("update-notifier-low");
            }
        }

        this.menu.removeAll();
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        const iViewStr = count > 0 ? _("View %s updates").format(count.toString()) : _("No updates to view");
        let iView = new PopupMenu.PopupIconMenuItem(iViewStr, "view-list-bullet-symbolic", St.IconType.SYMBOLIC, { reactive: count > 0 });
        iView.connect('activate', () => {
            Util.spawn_async(['/usr/bin/bash', this.applet_path + '/updates.sh', "view"]);
        });

        let iCheck = new PopupMenu.PopupIconMenuItem(_("Check for new updates"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
        iCheck.connect('activate', () => {
            const args = ['/usr/bin/bash', this.applet_path + '/updates.sh', "command", this.commandUpdate];
            Util.spawn_async(args, () => {
                this._refreshUpdatesInfo();
            });
        });

        const iUpgradeStr = count > 0 ? _("Upgrade %s packages").format(count.toString()) : _("No packages to upgrade");
        let iUpgrade = new PopupMenu.PopupIconMenuItem(iUpgradeStr, "system-run-symbolic", St.IconType.SYMBOLIC, { reactive: count > 0 });
        iUpgrade.connect('activate', () => {
            const args = ['/usr/bin/bash', this.applet_path + '/updates.sh', "command", this.commandUpgrade];
            Util.spawn_async(args, () => {
                this._refreshUpdatesInfo();
            });
        });

        this.menu.addMenuItem(iCheck);
        this.menu.addMenuItem(iView);
        this.menu.addMenuItem(iUpgrade);
    },

    on_applet_clicked: function () {
        this.menu.toggle();
    },

    on_applet_removed: function () {
        if (this.interval) {
            Util.clearInterval(this.interval);
        }
    },

    _refreshUpdatesInfo: function () {
        Util.spawn_async(['/usr/bin/bash', this.applet_path + '/updates.sh', "check"], (stdout) => {
            this.packages_count = parseInt(stdout.trim());
            this._update();
        });
    },
};

function main(metadata, orientation, panel_height, instance_id) {
    return new UpdatesNotifier(metadata, orientation, panel_height, instance_id);
}
