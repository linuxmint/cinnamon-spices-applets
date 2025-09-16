const Applet = imports.ui.applet;
const Main = imports.ui.main;
const {AppletSettings} = imports.ui.settings;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;
const ScreenSaver = imports.misc.screenSaver;
const St = imports.gi.St;
const { restartCinnamon } = imports.ui.main;
const ScreensaverInhibitor = require("./screensaverInhibitor");
//~ const Mainloop = imports.mainloop;
//mainloopTools:
const {
  _sourceIds,
  timeout_add_seconds,
  timeout_add,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  source_exists,
  source_remove,
  remove_all_sources
} = require("mainloopTools");

const UUID = "Exit@claudiux";
const SCRIPTS_DIR = GLib.get_home_dir()+"/.local/share/cinnamon/applets/"+UUID+"/scripts";
const CANSHUTDOWN_SCRIPT = SCRIPTS_DIR+"/can-shutdown.sh";

// l10n/translation support
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

var ExitPopupMenu = class ExitPopupMenu extends Applet.AppletPopupMenu {
    _init(launcher, orientation) {
        super._init(launcher, orientation);
        this.applet = launcher;
    }

    _onKeyPressEvent(actor, event) {
        let ks = event.get_key_symbol();
        if (ks === Clutter.KEY_Escape) {
            this.close(true);
            return true;
        }

        let mkSuspend = this.applet.s.getValue("mkSuspend");
        if (mkSuspend.length === 0) {
            mkSuspend = "S";
        } else {
            mkSuspend = mkSuspend[0].toUpperCase();
        }
        let mkSuspendLC = mkSuspend.toLowerCase();

        let mkHibernate = this.applet.s.getValue("mkHibernate");
        if (mkHibernate.length === 0) {
            mkHibernate = "H";
        } else {
            mkHibernate = mkHibernate[0].toUpperCase();
        }
        let mkHibernateLC = mkHibernate.toLowerCase();

        let mkRestart = this.applet.s.getValue("mkRestart");
        if (mkRestart.length === 0) {
            mkRestart = "R";
        } else {
            mkRestart = mkRestart[0].toUpperCase();
        }
        let mkRestartLC = mkRestart.toLowerCase();

        let mkShutdown = this.applet.s.getValue("mkShutdown");
        if (mkShutdown.length === 0) {
            mkShutdown = "U";
        } else {
            mkShutdown = mkShutdown[0].toUpperCase();
        }
        let mkShutdownLC = mkShutdown.toLowerCase();


        //~ if (this.applet.showHibernate && (ks === Clutter.KEY_H || ks === Clutter.KEY_h)) {
        if (this.applet.showHibernate && (ks === Clutter[`KEY_${mkHibernate}`] || ks === Clutter[`KEY_${mkHibernateLC}`])) {
            this.close(true);
            if (this.applet.hibernateNeedsSudo) {
                Util.spawnCommandLineAsync("pkexec sudo systemctl hibernate")
            } else {
                Util.spawnCommandLineAsync("systemctl hibernate")
            }
            return true;
        }
        if (this.applet.showPowerOff && (ks === Clutter[`KEY_${mkShutdown}`] || ks === Clutter[`KEY_${mkShutdownLC}`])) {
            this.close(true);
            Util.spawnCommandLineAsync("systemctl poweroff");
            return true;
        }
        if (this.applet.showRestart && (ks === Clutter[`KEY_${mkRestart}`] || ks === Clutter[`KEY_${mkRestartLC}`])) {
            this.close(true);
            Util.spawnCommandLineAsync("systemctl reboot");
            return true;
        }
        //~ if (this.applet.showSuspend && (ks === Clutter.KEY_S || ks === Clutter.KEY_s)) {
        if (this.applet.showSuspend && (ks === Clutter[`KEY_${mkSuspend}`] || ks === Clutter[`KEY_${mkSuspendLC}`])) {
            this.close(true);
            Util.spawnCommandLineAsync("systemctl suspend");
            return true;
        }

        return false;
    }
}

class ExitApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.instanceId = instance_id;
        this.orientation = orientation;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.isWaylandSession = Meta.is_wayland_compositor();

        this.can_shutdown = false;

        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
        this.screensaver_inhibitor = new ScreensaverInhibitor.ScreensaverInhibitor(this);

        this.set_applet_icon_symbolic_name("system-shutdown");
        this.set_applet_tooltip(_(metadata.name));

        this.lockdown_settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.lockdown' });

        this.get_user_settings();

        //~ this.screenOffIntervalId = null;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new ExitPopupMenu(this, this.orientation);
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
        this.s.bind("hibernateNeedsSudo", "hibernateNeedsSudo");
        this.s.bind("showRestart", "showRestart");
        this.s.bind("showPowerOff", "showPowerOff");
        this.s.bind("showScreenOff", "showScreenOff");
        this.s.bind("mouse-deactivation-duration", "mouseDeactivationDuration");
        this.s.bind("showLockscreen", "showLockscreen");
        this.s.bind("showSwitchUser", "showSwitchUser");
        this.s.bind("showLogout", "showLogout");
        this.s.bind("logoutMode", "logoutMode");
        this.s.bind("kbToggleMenu", "kbToggleMenu", () => { this.on_keybinds_changed() });
        this.s.bind("kbWakeUpMonitor", "kbWakeUpMonitor", () => { this.on_keybinds_changed() });
    }

    check_system_managed_options() {
        this.displayLockScreenSetting = !this.lockdown_settings.get_boolean('disable-lock-screen') && !this.isWaylandSession;
        this.displaySwitchUserSetting = !this.lockdown_settings.get_boolean('disable-user-switching') && !this.isWaylandSession;
        this.displayLogoutSetting = !this.lockdown_settings.get_boolean('disable-log-out');

        let subProcess =  Util.spawnCommandLineAsyncIO(CANSHUTDOWN_SCRIPT, (stdout, stderr, exitCode) => {
            if (exitCode == 0) {
                this.can_shutdown = true;
            } else {
                this.can_shutdown = false;
            }
            subProcess.send_signal(9);
        });

        this.loop = timeout_add_seconds(1, () => this.check_system_managed_options());
        return false;
    }

    screenOff() {
        let duration = Math.trunc(1000 * this.mouseDeactivationDuration);
        //~ Util.spawn_async(
            //~ ['/usr/bin/env', 'bash', '-c',
            //~ 'for m in $(xinput | grep -i Mouse | tr -d " " | tr "\t" " " | cut -d" " -f2 | cut -d"=" -f2); do \
            //~ xinput disable $m; done'],
            //~ null
        //~ );
        Util.spawnCommandLine(SCRIPTS_DIR + "/mice.sh disable");
        Util.spawnCommandLine('xset dpms force off');
        //~ this.screenOffIntervalId = timeout_add(
            //~ 300,
            //~ () => {
                //~ global.log("Screen Off");
                //~ Util.spawnCommandLine('xset dpms force off');
                //~ return true;
            //~ }
        //~ );
        let _to = setTimeout(
            () => {
                clearTimeout(_to);
                Util.spawnCommandLine(SCRIPTS_DIR + "/mice.sh enable");
            },
            duration
        );
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
                item.connect('activate', () => {

                    this.menu.close(true);
                    restartCinnamon(this.showOSD); // replaces: global.reexec_self();
                });
                this.menu.addMenuItem(item);

                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            if (this.showScreenOff) {
                item = new PopupMenu.PopupIconMenuItem(_("Screen Off"), "preferences-desktop-screensaver-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.screenOff()
                });
                this.menu.addMenuItem(item);
            }

            if (allow_lock_screen && this.showLockscreen) {
                item = new PopupMenu.PopupIconMenuItem(_("Lock Screen"), "system-lock-screen-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
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
                });
                this.menu.addMenuItem(item);
            }

            if (this.showScreenOff || (allow_lock_screen && this.showLockscreen)) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            if (allow_switch_user && this.showSwitchUser) {
                if (this.can_shutdown) {
                    if (GLib.getenv("XDG_SEAT_PATH")) {
                        // LightDM
                        item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user-symbolic", St.IconType.SYMBOLIC);
                        item.connect('activate', () => {
                            this.menu.close(true);
                            launcher.spawnv(["cinnamon-screensaver-command", "--lock"]);
                            launcher.spawnv(["dm-tool", "switch-to-greeter"]);
                        });
                        this.menu.addMenuItem(item);
                    }
                    else if (GLib.file_test("/usr/bin/mdmflexiserver", GLib.FileTest.EXISTS)) {
                        // MDM
                        item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user-symbolic", St.IconType.SYMBOLIC);
                        item.connect('activate', () => {
                            this.menu.close(true);
                            launcher.spawnv(["mdmflexiserver"]);
                        });
                        this.menu.addMenuItem(item);
                    }
                    else if (GLib.file_test("/usr/bin/gdmflexiserver", GLib.FileTest.EXISTS)) {
                        // GDM
                        item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user-symbolic", St.IconType.SYMBOLIC);
                        item.connect('activate', () => {
                            this.menu.close(true);
                            launcher.spawnv(["cinnamon-screensaver-command", "--lock"]);
                            launcher.spawnv(["gdmflexiserver"]);
                        });
                        this.menu.addMenuItem(item);
                    }
                } else {
                    item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "action-unavailable-symbolic", St.IconType.SYMBOLIC);
                    item.connect('activate', () => {
                        this.menu.close(true);
                        launcher.spawnv(["notify-send", "--icon=mintupdate-installing", _("Performing automatic updates"), _("Please wait")]);
                    });
                    this.menu.addMenuItem(item);
                }
            }
        } else { // Wayland session:
            this.displayRestartCinnamonSetting = false;
            this.displayLockScreenSetting = false;
            this.displaySwitchUserSetting = false;
        }

        if (allow_log_out && this.showLogout) {
            if (this.can_shutdown) {
                item = new PopupMenu.PopupIconMenuItem(_("Log Out"), "system-log-out-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    this.screensaver_inhibitor.uninhibit_screensaver();
                    launcher.spawnv(["cinnamon-session-quit", "--logout", this.logoutMode]);
                    this.menu.close(true);
                    restartCinnamon(false);
                });
                this.menu.addMenuItem(item);
            } else {
                item = new PopupMenu.PopupIconMenuItem(_("Log Out"), "action-unavailable-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    launcher.spawnv(["notify-send", "--icon=mintupdate-installing", _("Performing automatic updates"), _("Please wait")]);
                });
                this.menu.addMenuItem(item);
            }
        }

        if (allow_log_out || allow_lock_screen || allow_switch_user)
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (this.showSuspend) {
            if (this.can_shutdown) {
                let mkSuspend = this.s.getValue("mkSuspend");
                if (mkSuspend.length === 0) {
                    mkSuspend = "S";
                } else {
                    mkSuspend = mkSuspend[0].toUpperCase();
                }
                item = new PopupMenu.PopupIconMenuItem(_("Suspend") + " [" + mkSuspend + "]", "system-suspend", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    launcher.spawnv(["systemctl", "suspend"]);
                });
                this.menu.addMenuItem(item);
            } else {
                item = new PopupMenu.PopupIconMenuItem(_("Suspend"), "action-unavailable-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    launcher.spawnv(["notify-send", "--icon=mintupdate-installing", _("Performing automatic updates"), _("Please wait")]);
                });
                this.menu.addMenuItem(item);
            }
        }

        if (this.showHibernate) {
            if (this.can_shutdown) {
                let mkHibernate = this.s.getValue("mkHibernate");
                if (mkHibernate.length === 0) {
                    mkHibernate = "H";
                } else {
                    mkHibernate = mkHibernate[0].toUpperCase();
                }
                item = new PopupMenu.PopupIconMenuItem(_("Hibernate") + " [" + mkHibernate + "]", "system-suspend-hibernate", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    if (this.hibernateNeedsSudo)
                        launcher.spawnv(["pkexec", "sudo", "systemctl", "hibernate"]);
                    else
                        launcher.spawnv(["systemctl", "hibernate"]);
                });
                this.menu.addMenuItem(item);
            } else {
                item = new PopupMenu.PopupIconMenuItem(_("Hibernate"), "action-unavailable-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    launcher.spawnv(["notify-send", "--icon=mintupdate-installing", _("Performing automatic updates"), _("Please wait")]);
                });
                this.menu.addMenuItem(item);
            }
        }

        if (this.showSuspend || this.showHibernate)
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (this.showRestart) {
            if (this.can_shutdown) {
                let mkRestart = this.s.getValue("mkRestart");
                if (mkRestart.length === 0) {
                    mkRestart = "R";
                } else {
                    mkRestart = mkRestart[0].toUpperCase();
                }
                item = new PopupMenu.PopupIconMenuItem(_("Restart") + " [" + mkRestart + "]", "view-refresh", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    launcher.spawnv(["systemctl", "reboot"]);
                });
                this.menu.addMenuItem(item);
            } else {
                item = new PopupMenu.PopupIconMenuItem(_("Restart"), "action-unavailable-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    launcher.spawnv(["notify-send", "--icon=mintupdate-installing", _("Performing automatic updates"), _("Please wait")]);
                });
                this.menu.addMenuItem(item);
            }
        }

        if (this.showPowerOff) {
            if (this.can_shutdown) {
                let mkShutdown = this.s.getValue("mkShutdown");
                if (mkShutdown.length === 0) {
                    mkShutdown = "U";
                } else {
                    mkShutdown = mkShutdown[0].toUpperCase();
                }
                item = new PopupMenu.PopupIconMenuItem(_("Power Off") + " [" + mkShutdown + "]", "system-shutdown-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    this.screensaver_inhibitor.uninhibit_screensaver();
                    launcher.spawnv(["systemctl", "poweroff"]);
                });
                this.menu.addMenuItem(item);
            } else {
                item = new PopupMenu.PopupIconMenuItem(_("Power Off"), "action-unavailable-symbolic", St.IconType.SYMBOLIC);
                item.connect('activate', () => {
                    this.menu.close(true);
                    launcher.spawnv(["notify-send", "--icon=mintupdate-installing", _("Performing automatic updates"), _("Please wait")]);
                });
                this.menu.addMenuItem(item);
            }
        }

    }

    on_buttonApplyMenuKeys_pressed() {
        let mkShutdown = this.s.getValue("mkShutdown");
        if (mkShutdown.length === 0) {
            mkShutdown = "U";
        } else {
            mkShutdown = mkShutdown[0].toUpperCase();
        }

        let mkRestart = this.s.getValue("mkRestart");
        if (mkRestart.length === 0) {
            mkRestart = "R";
        } else {
            mkRestart = mkRestart[0].toUpperCase();
        }

        let mkHibernate = this.s.getValue("mkHibernate");
        if (mkHibernate.length === 0) {
            mkHibernate = "H";
        } else {
            mkHibernate = mkHibernate[0].toUpperCase();
        }

        let mkSuspend = this.s.getValue("mkSuspend");
        if (mkSuspend.length === 0) {
            mkSuspend = "S";
        } else {
            mkSuspend = mkSuspend[0].toUpperCase();
        }

        let _to = setTimeout(() => {
                clearTimeout(_to);
                this.s.setValue("mkShutdown", mkShutdown);
                this.s.setValue("mkRestart", mkRestart);
                this.s.setValue("mkHibernate", mkHibernate);
                this.s.setValue("mkSuspend", mkSuspend);
            },
            2100
        );
    }

    on_keybinds_changed() {
        Main.keybindingManager.addHotKey(
            "toggle-exit-menu-" + this.instanceId,
            this.kbToggleMenu,
            () => { this.on_applet_clicked(null) }
        );
        Main.keybindingManager.addHotKey(
            "wakeupmonitor-exit-" + this.instanceId,
            this.kbWakeUpMonitor,
            () => { this.wake_up_monitor() }
        );
    }

    wake_up_monitor() {
        //~ global.log("Monitor wake-up");
        //~ if (this.screenOffIntervalId != null) {
            //~ source_remove(this.screenOffIntervalId);
            //~ this.screenOffIntervalId = null;
        //~ }
        Util.spawnCommandLine(SCRIPTS_DIR + "/mice.sh enable");
        Util.spawnCommandLine('xset dpms force on');
    }

    on_applet_clicked(event) {
        if (!this.menu.isOpen)
            this.make_menu();
        this.menu.toggle();
    }

    on_applet_added_to_panel() {
        this.on_keybinds_changed();
        this.check_system_managed_options()
    }

    on_applet_removed_from_panel() {
        source_remove(this.loop);
        Main.keybindingManager.removeHotKey("toggle-exit-menu-" + this.instanceId);
        Main.keybindingManager.removeHotKey("wakeupmonitor-exit-" + this.instanceId);
        remove_all_sources();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new ExitApplet(metadata, orientation, panel_height, instance_id);
}
