const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const UUID = "bash-sensors@pkkk";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
};

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation);
        this.path = metadata.path;
        this.settings = new Settings.AppletSettings(this, UUID, instance_id);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        let section = new PopupMenu.PopupMenuSection('PopupMenuSection');
        let item = new PopupMenu.PopupMenuItem('');
        this.menuLabel = new St.Label({text: '<init>'});

        this.bind_settings();
        this.autoupdate();

        item.addActor(this.menuLabel);
        section.addMenuItem(item);

        this.menu.addMenuItem(section);
        this.menuManager.addMenu(this.menu);
    },

    spawn_sync: function (script) {
        return GLib.spawn_sync(null,
            ['bash', '-c', script],
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null);
    },

    on_applet_clicked: function (event) {
        if (!this.menu.isOpen) {
            if(this.menu.setCustomStyleClass) {
                this.menu.setCustomStyleClass("click");
            }
            else if(this.menu.actor.add_style_class_name) {
                this.menu.actor.add_style_class_name("click");
            }
            let cmd = (this.menuScript && this.menuScript.trim()) ? this.menuScript : this.script1;
            let cmd_output = this.spawn_sync(cmd);
            let cmd_stdout = cmd_output[0] ? cmd_output[1].toString() : _("script error");
            this.menuLabel.set_text(cmd_stdout.trimRight());
        }

        this.update();
        this.menu.toggle();
    },
    update: function () {
        if (this.dynamicTooltip) {
            let cmd = (this.tooltipScript && this.tooltipScript.trim()) ? this.tooltipScript : this.script1;
            let cmd_output = this.spawn_sync(cmd);
            let cmd_stdout = cmd_output[0] ? cmd_output[1].toString() : _("script error");
            this.set_applet_tooltip(cmd_stdout.trim());
        } else {
            this.set_applet_tooltip(this.tooltipScript.trim());
        }

        let full = '';
        let scripts = this.script2 && this.script2.trim() && this.enableScript2 ?
            [this.script1, this.script2] : [this.script1];
        for (let cmd of scripts) {
            let cmd_stdout = _("script error");
            let cmd_output = this.spawn_sync(cmd);
            if (cmd_output[0]) {
                cmd_stdout = cmd_output[1].toString();
                cmd_stdout+= cmd_output[2].toString();
                cmd_stdout = cmd_stdout.replace(/\n/g, "").substring(0, 50);
            }
            full += cmd_stdout + '\n';
        }
        this.set_applet_label(full.trimRight());
    },

    autoupdate: function () {
        this.update();
        if (this.refreshInterval) {
            Mainloop.timeout_add(this.refreshInterval * 1000, Lang.bind(this, this.autoupdate));
        }
    },

    bind_settings: function () {
        for (let str of ["refreshInterval", "script1", "script2", "tooltipScript", "enableScript2", "dynamicTooltip", "menuScript"]) {
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
