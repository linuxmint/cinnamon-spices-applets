const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const Main = imports.ui.main;
const UUID = "bash-sensors@pkkk";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
};

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

        try {
            this.path = metadata.path;
            this.settings = new Settings.AppletSettings(this, UUID, instance_id);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            let section = new PopupMenu.PopupMenuSection('PopupMenuSection');
            let item = new PopupMenu.PopupMenuItem('');
            this.menuLabel = new St.Label({text: '<init>'});

            this.bind_settings();

            this.wait_for_clicked_cmd = false;
            this.wait_for_label_cmd = [false, false];
            this.wait_for_icon_cmd = false;
            this.wait_for_tooltip_cmd = false;
            this.wait_for_startup_cmd = false;
            this.labels = ['', '',]

            if (this.startupScript && this.startupScript.trim()) {
                this.wait_for_startup_cmd = true;
                Util.spawn_async([this.shell, '-c', this.startupScript], Lang.bind(this, this.update_started));
            }
            this.autoupdate();

            item.addActor(this.menuLabel);
            section.addMenuItem(item);

            this.menu.addMenuItem(section);
            this.menuManager.addMenu(this.menu);
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function (event) {
        if (!this.menu.isOpen) {
            if(this.menu.setCustomStyleClass) {
                this.menu.setCustomStyleClass("click");
            }
            else if(this.menu.actor.add_style_class_name) {
                this.menu.actor.add_style_class_name("click");
            }
            if (!this.wait_for_clicked_cmd) {
                this.wait_for_clicked_cmd = true;
            let cmd = (this.menuScript && this.menuScript.trim()) ? this.menuScript : this.script1;
                Util.spawn_async([this.shell, '-c', cmd], Lang.bind(this, this.update_clicked));
            } else {
                this.menuLabel.set_text(_("Error: Still waiting for command to finish!"));
            }
        }

        this.update();
    },

    update_clicked: function (cmd_output) {
        if (this.menuScriptDisplay) {
            Main.notify(this.title, cmd_output.toString().trimRight());
        }
        this.wait_for_clicked_cmd = false;
        this.update();
    },

    update_cmd1: function (cmd_output) {
        this.labels[0] = cmd_output.toString().replace(/\n/g, "").substring(0, 50).trimRight();
        if (this.script2 && this.script2.trim() && this.enableScript2) {
            this.set_applet_label(this.labels.join('\n'));
        } else {
            this.set_applet_label(this.labels[0].replace(/\f/g, "\n"));
        }
        this.wait_for_label_cmd[0] = false;
    },

    update_cmd2: function (cmd_output) {
        this.labels[1] = cmd_output.toString().replace(/\n/g, "").substring(0, 50).trimRight();
        this.set_applet_label(this.labels.join('\n'));
        this.wait_for_label_cmd[1] = false;
    },

    update_icon: function (cmd_output) {
        let icon = cmd_output.toString().trim();
        if (icon) {
            // from placesCenter@scollins
            if (Gtk.IconTheme.get_default().has_icon(icon)) {
                if (icon.search("-symbolic") != -1) {
                    this.set_applet_icon_symbolic_name(icon);
                } else {
                    this.set_applet_icon_name(icon);
                }
            } else {
                this.set_applet_icon_path(icon);
            }
        } else {
            this.hide_applet_icon();
        }
        this.wait_for_icon_cmd = false;
    },

    update_tooltip: function (cmd_output) {
        this.set_applet_tooltip(cmd_output.toString().trim());
        this.wait_for_tooltip_cmd = false;
    },

    update_started: function (cmd_output) {
        this.wait_for_startup_cmd = false;
    },

    update: function () {
        if (this.dynamicTooltip) {
            if (!this.wait_for_tooltip_cmd) {
                this.wait_for_tooltip_cmd = true;
            let cmd = (this.tooltipScript && this.tooltipScript.trim()) ? this.tooltipScript : this.script1;
                Util.spawn_async([this.shell, '-c', cmd], Lang.bind(this, this.update_tooltip));
            }
        } else {
            this.set_applet_tooltip(this.tooltipScript.trim());
        }

        if (this.script1 && this.script1.trim() && !this.wait_for_label_cmd[0]) {
            this.wait_for_label_cmd[0] = true;
            Util.spawn_async([this.shell, '-c', this.script1], Lang.bind(this, this.update_cmd1));
            }
        if (this.script2 && this.script2.trim() && this.enableScript2 && !this.wait_for_label_cmd[1]) {
            this.wait_for_label_cmd[1] = true;
            Util.spawn_async([this.shell, '-c', this.script2], Lang.bind(this, this.update_cmd2));
        }

        if (this.iconScript && this.iconScript.trim()) {
            if (this.dynamicIcon) {
                if (!this.wait_for_icon_cmd) {
                    this.wait_for_icon_cmd = true;
                    Util.spawn_async([this.shell, '-c', this.iconScript], Lang.bind(this, this.update_icon));
                }
            } else {
                this.set_applet_icon_path(this.iconScript);
            }
        } else {
            this.hide_applet_icon();
        }
    },

    autoupdate: function () {
        // Wait for startup command to finish
        if (!this.wait_for_startup_cmd) {
        this.update();
        }

        if (this.refreshInterval) {
            Mainloop.timeout_add_seconds(this.refreshInterval, Lang.bind(this, this.autoupdate));
        }
    },

    bind_settings: function () {
        for (let str of ["title", "refreshInterval", "shell",
                         "script1", "enableScript2", "script2",
                         "dynamicIcon", "iconScript",
                         "dynamicTooltip", "tooltipScript",
                         "menuScript", "menuScriptDisplay",
                         "startupScript"]) {
            this.settings.bindProperty(Settings.BindingDirection.IN,
                str,
                str,
                null,
                null);
        }
    }
};

function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
