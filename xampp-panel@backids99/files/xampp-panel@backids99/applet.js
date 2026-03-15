const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const UUID = "xampp-panel@backids99";
const Util = imports.misc.util;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const AppletDir = imports.ui.appletManager.appletMeta['xampp-panel@backids99'].path;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var CommandConstants = {
  COMMAND_START_LINUX_MANAGER: "./.local/share/cinnamon/applets/xampp-panel@backids99/xamp_manager_wrap.sh",
  COMMAND_START_XAMPP: "pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY /opt/lampp/lampp start",
  COMMAND_STOP_XAMPP: "pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY /opt/lampp/lampp stop",
  COMMAND_RESTART_XAMPP: "pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY /opt/lampp/lampp restart",
  COMMAND_START_MYSQL: "pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY /opt/lampp/lampp startmysql",
  COMMAND_STOP_MYSQL: "pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY /opt/lampp/lampp stopmysql",
  COMMAND_RESTART_MYSQL: "pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY /opt/lampp/lampp restartmysql",
  COMMAND_PHP_CONFIG_EDIT: "xed admin:///opt/lampp/etc/php.ini",
  COMMAND_HOSTS_EDIT: "xed admin:///etc/hosts",
  COMMAND_HTTPD_VHOSTS_CONF_EDIT: "xed admin:///opt/lampp/etc/extra/httpd-vhosts.conf",
  COMMAND_HTTPD_CONF_EDIT: "xed admin:///opt/lampp/etc/httpd.conf",
  COMMAND_LAUNCH_PHPMYADMIN: "xdg-open http://localhost/phpmyadmin/",
  COMMAND_LAUNCH_WEBDIR: "xdg-open http://localhost/",
  COMMAND_OPEN_WEBDIR: "nemo /opt/lampp/htdocs/",
}

class MyApplet extends Applet.IconApplet {
  constructor(orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.set_applet_icon_path(AppletDir + "/" + "icon.png");
    this.set_applet_tooltip(_("Xampp Panel"));
    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    this.settings.bindProperty(
      Settings.BindingDirection.IN,
      "MySQLActions",
      "showMySQLActions",
      () => this._showMenu(),
      null
    );
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this._showMenu();
  }

  _showMenu() {
  // Clear all menu items then reload when opening
    this.menu.removeAll();
    this.menu.addAction(_("Start XAMPP manager"), () => {
      Util.spawnCommandLineAsync(CommandConstants.COMMAND_START_LINUX_MANAGER, null, null);
    });
    this.menu.addAction(_("XAMPP Start"), () => {
      Util.spawnCommandLineAsync(CommandConstants.COMMAND_START_XAMPP, null, null);
    });
    this.menu.addAction(_("XAMPP Stop"), () => {
      Util.spawnCommandLineAsync(CommandConstants.COMMAND_STOP_XAMPP, null, null);
    });
    this.menu.addAction(_("XAMPP Restart"), () => {
      Util.spawnCommandLineAsync(CommandConstants.COMMAND_RESTART_XAMPP, null, null);
    });

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    // show SQL actions if this setting is enabled
    if (this.showMySQLActions) {
      this.menu.addAction(_("MySQL Start"), () => {
        Util.spawnCommandLineAsync(CommandConstants.COMMAND_START_MYSQL, () => {
          Main.notify(_("Xampp Panel Menu"), _("Starting MySQL..."));
        });
      });
      this.menu.addAction(_("MySQL Stop"), () => {
        Util.spawnCommandLineAsync(CommandConstants.COMMAND_STOP_MYSQL, () => {
          Main.notify(_("Xampp Panel Menu"), _("Stopping MySQL..."));
        });
      });
      this.menu.addAction(_("MySQL Restart"), () => {
        Util.spawnCommandLineAsync(CommandConstants.COMMAND_RESTART_MYSQL, () => {
          Main.notify(_("Xampp Panel Menu"), _("Restarting MySQL..."));
        });
      });
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    this.menu.addAction(_("Open Web Dir"), () => {
      Util.spawnCommandLine(CommandConstants.COMMAND_OPEN_WEBDIR);
    });
    this.menu.addAction(_("Launch Web Dir"), () => {
      Util.spawnCommandLine(CommandConstants.COMMAND_LAUNCH_WEBDIR);
    });
    this.menu.addAction(_("Launch phpMyAdmin"), () => {
      Util.spawnCommandLine(CommandConstants.COMMAND_LAUNCH_PHPMYADMIN);
    });

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.menu.addAction(_("Edit default php.ini"), () => {
      Util.spawnCommandLine(CommandConstants.COMMAND_PHP_CONFIG_EDIT);
    });
    this.menu.addAction(_("Edit etc/hosts"), () => {
      Util.spawnCommandLine(CommandConstants.COMMAND_HOSTS_EDIT);
    });
    this.menu.addAction(_("Edit extra/httpd-vhosts.conf"), () => {
      Util.spawnCommandLine(CommandConstants.COMMAND_HTTPD_VHOSTS_CONF_EDIT);
    });
    this.menu.addAction(_("Edit httpd.conf"), () => {
      Util.spawnCommandLine(CommandConstants.COMMAND_HTTPD_CONF_EDIT);
    });
  }
  on_applet_clicked() {
    this.menu.toggle();
  }
}
function main(metadata, orientation, panel_height, instance_id) {
  return new MyApplet(orientation, panel_height, instance_id);
}