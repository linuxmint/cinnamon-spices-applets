const Applet = imports.ui.applet;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const PopupMenu = imports.ui.popupMenu;
const ScreenSaver = imports.misc.screenSaver;
const St = imports.gi.St;

// l10n/translation support
const UUID = "system-controls@rcalixte";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

class SystemControlsApplet extends Applet.TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

        this.set_applet_icon_symbolic_name("system-shutdown");
        this.set_applet_label("");
        this.set_applet_tooltip(_("System Controls"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        let launcher = new Gio.SubprocessLauncher({
            flags: (Gio.SubprocessFlags.STDIN_PIPE |
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE)
        });

        let controlsBox = new St.BoxLayout({ style_class: 'controls-box', reactive: true, vertical: false });

        this.controlsLabel = new St.Label(({ style_class: 'controls-label' }));
        controlsBox.add(this.controlsLabel,
            {
                x_fill: true,
                y_fill: false,
                x_align: St.Align.END,
                y_align: St.Align.MIDDLE
            });

        this.menu.addActor(controlsBox);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        let item;
        if (!Meta.is_wayland_compositor()) {
            item = new PopupMenu.PopupIconMenuItem(_("Restart Cinnamon"), "cinnamon-symbolic", St.IconType.SYMBOLIC);
            item.connect('activate', Lang.bind(this, function () {
                global.reexec_self();
            }));
            this.menu.addMenuItem(item);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            item = new PopupMenu.PopupIconMenuItem(_("Lock Screen"), "system-lock-screen-symbolic", St.IconType.SYMBOLIC);
            item.connect('activate', Lang.bind(this, function () {
                let screensaver_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.screensaver" });
                let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
                if (screensaver_dialog.query_exists(null)) {
                    if (screensaver_settings.get_boolean("ask-for-away-message")) {
                        launcher.spawnv(["cinnamon-screensaver-lock-dialog"]);
                    }
                    else {
                        launcher.spawnv(["cinnamon-screensaver-command", "--lock"]);
                    }
                }
                else {
                    this._screenSaverProxy.LockRemote();
                }
            }));
            this.menu.addMenuItem(item);

            let lockdown_settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.lockdown' });
            if (!lockdown_settings.get_boolean('disable-user-switching')) {
                if (GLib.getenv("XDG_SEAT_PATH")) {
                    // LightDM
                    item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user-symbolic", St.IconType.SYMBOLIC);
                    item.connect('activate', Lang.bind(this, function () {
                        launcher.spawnv(["cinnamon-screensaver-command", "--lock"]);
                        launcher.spawnv(["dm-tool", "switch-to-greeter"]);
                    }));
                    this.menu.addMenuItem(item);
                }
                else if (GLib.file_test("/usr/bin/mdmflexiserver", GLib.FileTest.EXISTS)) {
                    // MDM
                    item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user-symbolic", St.IconType.SYMBOLIC);
                    item.connect('activate', Lang.bind(this, function () {
                        launcher.spawnv(["mdmflexiserver"]);
                    }));
                    this.menu.addMenuItem(item);
                }
                else if (GLib.file_test("/usr/bin/gdmflexiserver", GLib.FileTest.EXISTS)) {
                    // GDM
                    item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user-symbolic", St.IconType.SYMBOLIC);
                    item.connect('activate', Lang.bind(this, function () {
                        launcher.spawnv(["cinnamon-screensaver-command", "--lock"]);
                        launcher.spawnv(["gdmflexiserver"]);
                    }));
                    this.menu.addMenuItem(item);
                }
            }
        }

        item = new PopupMenu.PopupIconMenuItem(_("Log Out"), "system-log-out-symbolic", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function () {
            launcher.spawnv(["cinnamon-session-quit", "--logout", "--no-prompt"]);
        }));
        this.menu.addMenuItem(item);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = new PopupMenu.PopupIconMenuItem(_("Suspend"), "system-suspend", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function () {
            launcher.spawnv(["systemctl", "suspend"]);
        }));
        this.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Hibernate"), "system-suspend-hibernate", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function () {
            launcher.spawnv(["systemctl", "hibernate"]);
        }));
        this.menu.addMenuItem(item);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = new PopupMenu.PopupIconMenuItem(_("Restart"), "view-refresh", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function () {
            launcher.spawnv(["systemctl", "reboot"]);
        }));
        this.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Power Off"), "system-shutdown-symbolic", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function () {
            launcher.spawnv(["systemctl", "poweroff"]);
        }));
        this.menu.addMenuItem(item);

        this.set_show_label_in_vertical_panels(false);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new SystemControlsApplet(orientation, panel_height, instance_id);
}
