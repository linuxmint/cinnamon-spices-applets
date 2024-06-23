const Applet = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const PopupMenu = imports.ui.popupMenu;
const ScreenSaver = imports.misc.screenSaver;
const St = imports.gi.St;
const { restartCinnamon } = imports.ui.main;
const Mainloop = imports.mainloop;

// l10n/translation support
const UUID = "Exit@claudiux";
//~ Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
    let _str = Gettext.dgettext(UUID, str);
    if (_str != str)
        return _str;
    Gettext.bindtextdomain("lightdm", "/usr/share/locale");
    _str = Gettext.dgettext("lightdm", str);
    if (_str != str)
        return _str;
    Gettext.bindtextdomain("gnome-panel", "/usr/share/locale");
    _str = Gettext.dgettext("gnome-panel", str);
    if (_str != str)
        return _str;
    // If the text was not found locally then try with system-wide translations:
    return Gettext.gettext(str);
}

class ExitApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.instanceId = instance_id;
        this.orientation = orientation;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.isWaylandSession = Meta.is_wayland_compositor();

        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

        this.set_applet_icon_symbolic_name("system-shutdown");
        this.set_applet_tooltip(_(metadata.name));

        this.lockdown_settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.lockdown' });

        this.get_user_settings();

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        this.make_menu();
    }

    get_user_settings() {
        this.s = new AppletSettings(this, UUID, this.instanceId);
        this.s.bind("displayLockScreenSetting", "displayLockScreenSetting");
        this.s.bind("displaySwitchUserSetting", "displaySwitchUserSetting");
        this.s.bind("displayLogoutSetting", "displayLogoutSetting");
        this.s.bind("displayRestartCinnamonSetting", "displayRestartCinnamonSetting");
        this.s.bind("showOSD", "showOSD");
        this.s.bind("showRestartCinnamon", "showRestartCinnamon");
        this.s.bind("showSuspend", "showSuspend");
        this.s.bind("showHibernate", "showHibernate");
        this.s.bind("showRestart", "showRestart");
        this.s.bind("showPowerOff", "showPowerOff");
        this.s.bind("showLockscreen", "showLockscreen");
        this.s.bind("showSwitchUser", "showSwitchUser");
        this.s.bind("showLogout", "showLogout");
        this.s.bind("logoutMode", "logoutMode");
    }

    check_system_managed_options() {
        this.displayLockScreenSetting = !this.lockdown_settings.get_boolean('disable-lock-screen') && !this.isWaylandSession;
        this.displaySwitchUserSetting = !this.lockdown_settings.get_boolean('disable-user-switching') && !this.isWaylandSession;
        this.displayLogoutSetting = !this.lockdown_settings.get_boolean('disable-log-out');

        this.loop = Mainloop.timeout_add_seconds(1, () => this.check_system_managed_options());
        return false;
    }

    make_menu() {
        //~ this.check_system_managed_options();
        this.menu.removeAll();

        let launcher = new Gio.SubprocessLauncher({
            flags: (Gio.SubprocessFlags.STDIN_PIPE |
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE)
        });

        let item;

        //~ let lockdown_settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.lockdown' });
        let allow_lock_screen = !this.lockdown_settings.get_boolean('disable-lock-screen');
        let allow_switch_user = !this.lockdown_settings.get_boolean('disable-user-switching');
        let allow_log_out = !this.lockdown_settings.get_boolean('disable-log-out');

        if (!this.isWaylandSession) { //X11 session:
            this.displayRestartCinnamonSetting = true;
            if (this.showRestartCinnamon) {
                item = new PopupMenu.PopupIconMenuItem(_("Restart Cinnamon"), "cinnamon-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', Lang.bind(this, function () {

                    this.menu.close(true);
                    restartCinnamon(this.showOSD); // replaces: global.reexec_self();
                }));
                this.menu.addMenuItem(item);

                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            if (allow_lock_screen && this.showLockscreen) {
                item = new PopupMenu.PopupIconMenuItem(_("Lock Screen"), "system-lock-screen-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', Lang.bind(this, function () {
                    let screensaver_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.screensaver" });
                    let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
                    this.menu.close(true);
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
            }

            if (allow_switch_user && this.showSwitchUser) {
                if (GLib.getenv("XDG_SEAT_PATH")) {
                    // LightDM
                    item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user-symbolic", St.IconType.SYMBOLIC);
                    item.connect('activate', Lang.bind(this, function () {
                        this.menu.close(true);
                        launcher.spawnv(["cinnamon-screensaver-command", "--lock"]);
                        launcher.spawnv(["dm-tool", "switch-to-greeter"]);
                    }));
                    this.menu.addMenuItem(item);
                }
                else if (GLib.file_test("/usr/bin/mdmflexiserver", GLib.FileTest.EXISTS)) {
                    // MDM
                    item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user-symbolic", St.IconType.SYMBOLIC);
                    item.connect('activate', Lang.bind(this, function () {
                        this.menu.close(true);
                        launcher.spawnv(["mdmflexiserver"]);
                    }));
                    this.menu.addMenuItem(item);
                }
                else if (GLib.file_test("/usr/bin/gdmflexiserver", GLib.FileTest.EXISTS)) {
                    // GDM
                    item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user-symbolic", St.IconType.SYMBOLIC);
                    item.connect('activate', Lang.bind(this, function () {
                        this.menu.close(true);
                        launcher.spawnv(["cinnamon-screensaver-command", "--lock"]);
                        launcher.spawnv(["gdmflexiserver"]);
                    }));
                    this.menu.addMenuItem(item);
                }
            }
        } else { // Wayland session:
            this.displayRestartCinnamonSetting = false;
            this.displayLockScreenSetting = false;
            this.displaySwitchUserSetting = false;
        }

        if (allow_log_out && this.showLogout) {
            item = new PopupMenu.PopupIconMenuItem(_("Log Out"), "system-log-out-symbolic", St.IconType.SYMBOLIC);
            item.connect('activate', Lang.bind(this, function () {
                this.menu.close(true);
                launcher.spawnv(["cinnamon-session-quit", "--logout", this.logoutMode]);
            }));
            this.menu.addMenuItem(item);
        }

        if (allow_log_out || allow_lock_screen || allow_switch_user)
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (this.showSuspend) {
            item = new PopupMenu.PopupIconMenuItem(_("Suspend"), "system-suspend", St.IconType.SYMBOLIC);
            item.connect('activate', Lang.bind(this, function () {
                this.menu.close(true);
                launcher.spawnv(["systemctl", "suspend"]);
            }));
            this.menu.addMenuItem(item);
        }

        if (this.showHibernate) {
            item = new PopupMenu.PopupIconMenuItem(_("Hibernate"), "system-suspend-hibernate", St.IconType.SYMBOLIC);
            item.connect('activate', Lang.bind(this, function () {
                this.menu.close(true);
                launcher.spawnv(["systemctl", "hibernate"]);
            }));
            this.menu.addMenuItem(item);
        }

        if (this.showSuspend || this.showHibernate)
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (this.showRestart) {
            item = new PopupMenu.PopupIconMenuItem(_("Restart"), "view-refresh", St.IconType.SYMBOLIC);
            item.connect('activate', Lang.bind(this, function () {
                this.menu.close(true);
                launcher.spawnv(["systemctl", "reboot"]);
            }));
            this.menu.addMenuItem(item);
        }

        if (this.showPowerOff) {
            item = new PopupMenu.PopupIconMenuItem(_("Power Off"), "system-shutdown-symbolic", St.IconType.SYMBOLIC);
            item.connect('activate', Lang.bind(this, function () {
                this.menu.close(true);
                launcher.spawnv(["systemctl", "poweroff"]);
            }));
            this.menu.addMenuItem(item);
        }

    }

    on_applet_clicked(event) {
        this.make_menu();
        this.menu.toggle();
    }

    on_applet_added_to_panel() {
        this.check_system_managed_options()
    }

    on_applet_removed_from_panel() {
        Mainloop.source_remove(this.loop)
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ExitApplet(metadata, orientation, panel_height, instance_id);
}
