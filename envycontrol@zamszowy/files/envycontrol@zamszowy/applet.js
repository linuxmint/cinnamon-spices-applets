const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const messageTray = imports.ui.main.messageTray;
const { SystemNotificationSource, Notification, Urgency } = imports.ui.messageTray;

const UUID = "envycontrol@zamszowy";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');
function _(str) { return Gettext.dgettext(UUID, str); }

function EnvyControlGui(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

EnvyControlGui.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        this.applet_path = metadata.path;

        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("unknown");
        this.hide_applet_label(true);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.MessageSource = new SystemNotificationSource("EnvyControl GUI");
        messageTray.add(this.MessageSource);

        if (!GLib.find_program_in_path("envycontrol")) {
            this.hide_applet_icon(true);
            this.hide_applet_label(false);
            this.set_applet_label(_("missing dependencies"));
            return;
        }

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("enable-coolbits", "enableCoolbits", this.update, null);
        this.settings.bind("coolbits", "coolbits", this.update, null);
        this.settings.bind("enable-forcecompositionpipeline", "enableForcecompositionpipeline", this.update, null);
        this.settings.bind("override-dm", "overrideDm", this.update, null);
        this.settings.bind("dm", "dm", this.update, null);
        this.settings.bind("use-nvidia-current", "useNvidiaCurrent", this.update, null);
        this.settings.bind("enable-rtd3", "enableRtd3", this.update, null);
        this.settings.bind("rtd3", "rtd3", this.update, null);

        this.pending_mode = "";
        this.current_mode = "";

        Util.spawn_async(['/usr/bin/bash', this.applet_path + '/control.sh', "info"], (stdout) => {
            [this.cpu_vendor, this.current_mode, this.pending_mode] = stdout.trim().split(":");
            this.add_right_click_menu();
            this.update();
        });
    },

    add_menu_item(name) {
        if (this.current_mode == name && this.pending_mode == "") {
            return;
        }

        let iModeStr = _("Switch to %s").format(name);
        if (this.pending_mode == name) {
            iModeStr = _("Switched to %s (pending reboot)").format(name);
        } else if (this.current_mode == name && this.pending_name != name) {
            iModeStr = _("Switch back to %s").format(name);
        }

        let extraArgs = [];
        if (name == "nvidia") {
            if (this.enableCoolbits) {
                extraArgs.push("--coolbits", this.coolbits);
            }
            if (this.enableForcecompositionpipeline) {
                extraArgs.push("--force-comp");
            }
            if (this.overrideDm) {
                extraArgs.push("--dm", this.dm);
            }
            if (this.useNvidiaCurrent) {
                extraArgs.push("--use-nvidia-current");
            }
        } else if (name == "hybrid") {
            if (this.enableRtd3) {
                extraArgs.push("--rtd3", this.rtd3);
            }
        }

        let iMode = new PopupMenu.PopupIconMenuItem(iModeStr, this.get_icon_name(name), St.IconType.SYMBOLIC, { reactive: this.pending_mode != name });
        iMode.connect('activate', () => {
            this.set_applet_icon_name("envy-configure");
            this.set_applet_tooltip(_("Changing mode to %s").format(name));
            this.menu.removeAll();
            this.notify("EnvyControl", _("Switching to %s mode in progress...").format(name), this.get_icon_name(name), Urgency.NORMAL);

            Util.spawn_async(['/usr/bin/bash', this.applet_path + '/control.sh', "change", name].concat(extraArgs), (stdout) => {
                if (stdout.trim() == "ok") {
                    this.notify("EnvyControl", _("Switched to %s mode").format(name), this.get_icon_name(name), Urgency.NORMAL);

                    if (this.pending_mode == this.current_mode || this.current_mode == name) {
                        this.pending_mode = "";
                    } else {
                        this.pending_mode = name;
                    }
                }
                this.update();
            });
        });
        this.menu.addMenuItem(iMode);
    },

    refresh_left_click_menu() {
        this.menu.removeAll();
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        this.add_menu_item("integrated");
        this.add_menu_item("hybrid");
        this.add_menu_item("nvidia");
    },

    add_right_click_menu() {
        let position = 0;

        let runCmd = (priviliged, show_mode, args, notify_msg) => {
            this.set_applet_icon_name("envy-configure");
            this.set_applet_tooltip(_("Configuring..."));
            this.menu.removeAll();

            Util.spawn_async(['/usr/bin/bash', this.applet_path + '/control.sh', "run", priviliged, show_mode].concat(args), (out) => {
                if (show_mode != "show-out-always" && out.trim() == "ok") {
                    this.notify("EnvyControl", notify_msg, "envy-configure", Urgency.NORMAL);
                }
                this.update()
            });
        };

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Hybrid settings:"), { reactive: false, }), position++);

        let hybridCreateCache = new PopupMenu.PopupMenuItem(_("  Create cache"), { reactive: this.current_mode == "hybrid", });
        hybridCreateCache.connect('activate', () => {
            runCmd('priviliged', 'show-out-on-fail', ['--cache-create'], _("successfully created cache"));
        });
        this._applet_context_menu.addMenuItem(hybridCreateCache, position++);

        let hybridDeleteCache = new PopupMenu.PopupMenuItem(_("  Delete cache"),);
        hybridDeleteCache.connect('activate', () => {
            runCmd('priviliged', 'show-out-on-fail', ['--cache-delete'], _("successfully deleted cache"));
        });
        this._applet_context_menu.addMenuItem(hybridDeleteCache, position++);

        let hybridShowCache = new PopupMenu.PopupMenuItem(_("  Show cache"),);
        hybridShowCache.connect('activate', () => {
            runCmd('non-priviliged', 'show-out-always', ['--cache-query'], "");
        });
        this._applet_context_menu.addMenuItem(hybridShowCache, position++);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), position++);

        let log = new PopupMenu.PopupMenuItem(_("Show last switch log"),);
        log.connect('activate', () => {
            Util.spawn_async(['/usr/bin/bash', this.applet_path + '/control.sh', "show-last-log"]);
        });
        this._applet_context_menu.addMenuItem(log, position++);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), position++);
    },

    update: function () {
        this.set_applet_tooltip(_("Current mode: %s").format(this.current_mode) + (this.pending_mode ? " " + _("(pending switch to %s)").format(this.pending_mode) : ""));
        this.set_applet_icon_name(this.get_icon_name(this.current_mode));

        this.refresh_left_click_menu();

        this.set_applet_enabled(true);
    },

    on_applet_clicked: function () {
        this.menu.toggle();
    },

    notify: function (title, message, icon_name, urgency = Urgency.NORMAL) {
        let icon = new St.Icon({
            icon_name: icon_name,
            icon_type: St.IconType.FULLCOLOR,
            icon_size: 16
        });

        const notification = new Notification(this.MessageSource, title, message, { icon: icon });
        notification.setTransient(false);
        notification.setUrgency(urgency);
        this.MessageSource.notify(notification);
    },

    get_icon_name: function (mode) {
        return "envy-" + (mode == "integrated" ? this.cpu_vendor : mode)
    },
};

function main(metadata, orientation, panel_height, instance_id) {
    return new EnvyControlGui(metadata, orientation, panel_height, instance_id);
}
