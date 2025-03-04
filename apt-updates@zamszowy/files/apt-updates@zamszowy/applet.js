const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;


function AptUpdates(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

AptUpdates.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        this.applet_path = metadata.path;

        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("update-none");
        this.hide_applet_label(true);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        if (!GLib.find_program_in_path("gnome-terminal")) {
            this.hide_applet_icon(true);
            this.hide_applet_label(false);
            this.set_applet_label("missing dependencies");
            return;
        }

        this.uuid = metadata.uuid;
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        this.settings.bind("update-refresh", "refreshTimeout", null, null);
        this.settings.bind("hide-applet", "hideApplet", this._update, null);

        this.settings.bind("different-levels", "differentLevels", this._update, null);
        this.settings.bind("level-1", "level1", this._update, null);
        this.settings.bind("level-2", "level2", this._update, null);

        this.settings.bind("commandUpdate", "commandUpdate", null, null);
        this.settings.bind("commandUpgrade", "commandUpgrade", null, null);

        this.packages_count = 0;

        this.enabled = true;
        this.run();
    },

    _update: function() {
        const count = this.packages_count;

        this.set_applet_enabled(!this.hideApplet || count != 0);

        if (this.differentLevels) {
            if (count <= 0) {
                this.set_applet_tooltip("No updates available");
                this.set_applet_icon_name("update-none");
            } else if (count < this.level1) {
                this.set_applet_tooltip(count.toString() + " updates available");
                this.set_applet_icon_name("update-low");
            } else if (count < this.level2) {
                this.set_applet_tooltip(count.toString() + " updates available");
                this.set_applet_icon_name("update-medium");
            } else {
                this.set_applet_tooltip(count.toString() + " updates available");
                this.set_applet_icon_name("update-high");
            }
        } else {
            if (count <= 0) {
                this.set_applet_tooltip("No updates available");
                this.set_applet_icon_name("update-none");
            } else {
                this.set_applet_tooltip(count.toString() + " updates available");
                this.set_applet_icon_name("update-low");
            }
        }

        this.menu.removeAll();
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        const iViewStr = count > 0 ? "View " + count.toString() + " updates" : "No updates to view";
        let iView = new PopupMenu.PopupIconMenuItem(iViewStr, "view-list-bullet-symbolic", St.IconType.SYMBOLIC, {reactive: count > 0});
        iView.connect('activate', Lang.bind(this, function () {
            Util.spawn_async(['/bin/bash', this.applet_path + '/updates.sh', "view"]);
        }));

        let iCheck = new PopupMenu.PopupIconMenuItem("Check for new updates", "view-refresh-symbolic", St.IconType.SYMBOLIC);
        iCheck.connect('activate', Lang.bind(this, function () {
            const args = ['/bin/bash', this.applet_path + '/updates.sh', "command", this.commandUpdate];
            Util.spawn_async(args, Lang.bind(this, function() {
                this._refreshUpdatesInfo();
            }));
        }));

        const iUpgradeStr = count > 0 ? "Upgrade " + count.toString() + " packages" : "No packages to upgrade";
        let iUpgrade = new PopupMenu.PopupIconMenuItem(iUpgradeStr, "system-run-symbolic", St.IconType.SYMBOLIC, {reactive: count > 0});
        iUpgrade.connect('activate', Lang.bind(this, function () {
            const args = ['/bin/bash', this.applet_path + '/updates.sh', "command", this.commandUpgrade];
            Util.spawn_async(args, Lang.bind(this, function() {
                this._refreshUpdatesInfo();
            }));
        }));

        this.menu.addMenuItem(iCheck);
        this.menu.addMenuItem(iView);
        this.menu.addMenuItem(iUpgrade);
    },

    on_applet_clicked: function() {
        this.menu.toggle();
    },

    on_applet_removed: function() {
        this.enabled = false;
    },

    _refreshUpdatesInfo: function() {
        Util.spawn_async(['/bin/bash', this.applet_path + '/updates.sh', "check"], Lang.bind(this, function(stdout){
            this.packages_count = parseInt(stdout.trim());
            this._update();
        }));
    },

    run: function() {
        if (!this.enabled) {
            return;
        }

        Util.spawn_async(['/bin/bash', this.applet_path + '/updates.sh', "check"], Lang.bind(this, function(stdout){
            this.packages_count = parseInt(stdout.trim());
            this._update();

            Util.spawn_async(['/usr/bin/sleep', (parseInt(this.refreshTimeout) * 60).toString()], Lang.bind(this, function(_) {
                this.run();
            }));
        }));
    },
};

function main(metadata, orientation, panel_height, instance_id) {
    return new AptUpdates(metadata, orientation, panel_height, instance_id);
}
