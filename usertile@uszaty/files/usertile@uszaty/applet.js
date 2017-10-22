//UserTile Applet by Uszaty and Shelley, forked from user@cinnamon.org
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio
const AccountsService = imports.gi.AccountsService;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const UUID = "usertile@uszaty";

// l10n/translation support

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        //this.actor.style_class = 'applet-us'; 
        
        try {
            this._session = new GnomeSession.SessionManager();
            this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
            this.notif_settings = new Gio.Settings({ schema: "org.cinnamon.desktop.notifications" })
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                                                                    
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);
            let userBox = new St.BoxLayout({ style_class: 'user-box', reactive: true, vertical: false });
            let userApplet = new St.BoxLayout({ style_class: 'user-applet', reactive: true, vertical: false });
            this._userIcon = new St.Bin({ style_class: 'user-icon'});
            this._userIconApplet = new St.Bin({ style_class: 'user-icon'});
            this._line = userApplet;
            let iconFileName;
            let iconFile;
            let icon;
            let img1;
            let img2;


            this.actor.add(this._line, { y_align: St.Align.MIDDLE, y_fill: true });
            userApplet.add(this._userIconApplet,
                        { x_fill:  true,
                          y_fill:  false,
                          x_align: St.Align.END,
                          y_align: St.Align.START });

            userBox.connect('button-press-event', Lang.bind(this, function() {
                this.menu.toggle();
                Util.spawnCommandLine("cinnamon-settings user");
            }));

            this._userIcon.hide();

            this.userLabel = new St.Label(({ style_class: 'user-label'}));
            /*this.userLabel2 = new St.Label(({ style_class: 'user-label'}));
            this.userLabel2.set_text("Account Details");

            let menuX1 = new PopupMenu.PopupMenuItem("Account Details");
            menuX1.connect('activate', Lang.bind(this, function() {
                Util.spawnCommandLine("cinnamon-settings user");
            }));*/

            userBox.add(this.userLabel,
                        { x_fill:  true,
                          y_fill:  false,
                          x_align: St.Align.END,
                          y_align: St.Align.START });
            /*userBox.add(this.menuX1,
                        { x_fill:  true,
                          y_fill:  true,
                          x_align: St.Align.START,
                          y_align: St.Align.END }); FIXME: Doesn't work this way*/
            userBox.add(this._userIcon,
                        { x_fill:  true,
                          y_fill:  false,
                          x_align: St.Align.END,
                          y_align: St.Align.START });

            this.menu.addActor(userBox);

            this.menu.addAction(_("Account Details"), Lang.bind(this, function() {
                Util.spawnCommandLine("cinnamon-settings user");
            }));

            this.menu.addAction(_("System Settings"), Lang.bind(this, function() {
                Util.spawnCommandLine("cinnamon-settings");
            }));

            this.notificationsSwitch = new PopupMenu.PopupSwitchMenuItem(_("Notifications"), this._toggleNotifications);
            this.notif_settings.connect('changed::display-notifications', Lang.bind(this, function() {
                this.notificationsSwitch.setToggleState(this.notif_settings.get_boolean("display-notifications"));
            }));
            this.notificationsSwitch.connect('toggled', Lang.bind(this, function() {
                this.notif_settings.set_boolean("display-notifications", this.notificationsSwitch.state);
            }));

            this.notificationsSwitch.setToggleState(this.notif_settings.get_boolean("display-notifications"));
            this.menu.addMenuItem(this.notificationsSwitch);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._powerMenu = new PopupMenu.PopupSubMenuMenuItem(_("Power..."), true);
            this.menu.addMenuItem(this._powerMenu);

            let menuItem1 = new PopupMenu.PopupMenuItem(_("Lock Screen"));
            menuItem1.connect('activate', Lang.bind(this, function() {
                let screensaver_settings = new Gio.Settings({ schema: "org.cinnamon.desktop.screensaver" });
                let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");    
                if (screensaver_dialog.query_exists(null)) {
                    if (screensaver_settings.get_boolean("ask-for-away-message")) {                                    
                        Util.spawnCommandLine("cinnamon-screensaver-lock-dialog");
                    }
                    else {
                        Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    }
                }
                else {                    
                    this._screenSaverProxy.LockRemote();
                }
            }));
            this._powerMenu.menu.addMenuItem(menuItem1);

                if (GLib.getenv("XDG_SEAT_PATH")) {
                // LightDM
            let menuItem2 = new PopupMenu.PopupMenuItem(_("Switch User"));
            menuItem2.connect('activate', Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("dm-tool switch-to-greeter");
            }));
            this._powerMenu.menu.addMenuItem(menuItem2);
            }
            else if (GLib.file_test("/usr/bin/mdmflexiserver", GLib.FileTest.EXISTS)) {
                // MDM
            let menuItem2 = new PopupMenu.PopupMenuItem(_("Switch User"));
            menuItem2.connect('activate', Lang.bind(this, function() {
                  Util.spawnCommandLine("mdmflexiserver");
            }));
            this._powerMenu.menu.addMenuItem(menuItem2);
            }
            else if (GLib.file_test("/usr/bin/gdmflexiserver", GLib.FileTest.EXISTS)) {
                // GDM
            let menuItem2 = new PopupMenu.PopupMenuItem(_("Switch User"));
            menuItem2.connect('activate', Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("gdmflexiserver");
            }));
            }

            let menuItem3 = new PopupMenu.PopupMenuItem(_("Log Out..."));
            menuItem3.connect('activate', Lang.bind(this, function() {
                this._session.LogoutRemote(0);
            }));
            this._powerMenu.menu.addMenuItem(menuItem3);

            let menuItem4 = new PopupMenu.PopupMenuItem(_("Power off..."));
            menuItem4.connect('activate', Lang.bind(this, function() {
                this._session.ShutdownRemote();
            }));
            this._powerMenu.menu.addMenuItem(menuItem4);

            this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
            this._userLoadedId = this._user.connect('notify::is_loaded', Lang.bind(this, this._onUserChanged));
            this._userChangedId = this._user.connect('changed', Lang.bind(this, this._onUserChanged));
            this._onUserChanged();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _onUserChanged: function() {
        if (this._user.is_loaded) {
            this.set_applet_tooltip(this._user.get_real_name());   
            this.userLabel.set_text (this._user.get_real_name());
            if (this._userIcon || this._userIconApplet) {
                iconFileName = this._user.get_icon_file();
                iconFile = Gio.file_new_for_path(iconFileName);
                if (iconFile.query_exists(null)) {
                    icon = new Gio.FileIcon({file: iconFile});
                } else {
                    icon = new Gio.ThemedIcon({name: 'avatar-default'});
                }
                img1 = St.TextureCache.get_default().load_gicon(null, icon, 100);
                img2 = St.TextureCache.get_default().load_gicon(null, icon, this._panelHeight - 4);
                this._userIcon.set_child (img1);
                this._userIcon.show();
                this._userIconApplet.set_child (img2);
                this._userIconApplet.show();
            }
        }
    },

    on_panel_height_changed: function () {
        if (this._user.is_loaded) {
            if (this._userIcon || this._userIconApplet) {
                img2 = St.TextureCache.get_default().load_gicon(null, icon, this._panelHeight - 4);
                this._userIconApplet.set_child (img2);
                this._userIconApplet.show();
            }
        }
    },
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
