const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const UUID = "xampp-panel@backids99";
const Util = imports.misc.util;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const AppletDir = imports.ui.appletManager.appletMeta['xampp-panel@backids99'].path;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

var CommandConstants = {
  COMMAND_START_LINUX_MANAGER: ["bash", AppletDir + "/xamp_manager_wrap.sh"],
  COMMAND_START_XAMPP: ["bash", AppletDir + "/server_wrap.sh", "start"],
  COMMAND_STOP_XAMPP: ["bash", AppletDir + "/server_wrap.sh", "stop"],
  COMMAND_RESTART_XAMPP: ["bash", AppletDir + "/server_wrap.sh", "restart"],
  COMMAND_START_MYSQL: ["bash", AppletDir + "/server_wrap.sh", "startmysql"],
  COMMAND_STOP_MYSQL: ["bash", AppletDir + "/server_wrap.sh", "stopmysql"],
  COMMAND_RESTART_MYSQL: ["bash", AppletDir + "/server_wrap.sh", "restartmysql"],
  COMMAND_PHP_CONFIG_EDIT: ["xed", "admin:///opt/lampp/etc/php.ini"],
  COMMAND_HOSTS_EDIT: ["xed", "admin:///etc/hosts"],
  COMMAND_HTTPD_VHOSTS_CONF_EDIT: ["xed", "admin:///opt/lampp/etc/extra/httpd-vhosts.conf"],
  COMMAND_HTTPD_CONF_EDIT: ["xed", "admin:///opt/lampp/etc/httpd.conf"],
  COMMAND_LAUNCH_PHPMYADMIN: ["xdg-open", "http://localhost/phpmyadmin/"],
  COMMAND_LAUNCH_WEBDIR: ["xdg-open", "http://localhost/"],
  COMMAND_OPEN_WEBDIR: ["nemo", "/opt/lampp/htdocs/"],
};

class MyApplet extends Applet.IconApplet {
  constructor(orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.set_applet_icon_path(AppletDir + "/" + "icon.png");
    this.set_applet_tooltip(_("Xampp Panel"));
    this.settings = new Settings.AppletSettings(this, UUID, instance_id);
    this.settings.bindProperty(
      Settings.BindingDirection.IN,
      "mySQLActions",
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
      Util.spawn(CommandConstants.COMMAND_START_LINUX_MANAGER);
    });
    this.menu.addAction(_("XAMPP Start"), () => {
      Util.spawn(CommandConstants.COMMAND_START_XAMPP);
    });
    this.menu.addAction(_("XAMPP Stop"), () => {
      Util.spawn(CommandConstants.COMMAND_STOP_XAMPP);
    });
    this.menu.addAction(_("XAMPP Restart"), () => {
      Util.spawn(CommandConstants.COMMAND_RESTART_XAMPP);
    });

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    // show SQL actions if this setting is enabled
    if (this.showMySQLActions) {
      this.menu.addAction(_("MySQL Start"), () => {
        Util.spawn(CommandConstants.COMMAND_START_MYSQL);
      });
      this.menu.addAction(_("MySQL Stop"), () => {
        Util.spawn(CommandConstants.COMMAND_STOP_MYSQL);
      });
      this.menu.addAction(_("MySQL Restart"), () => {
        Util.spawn(CommandConstants.COMMAND_RESTART_MYSQL);
      });
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    this.menu.addAction(_("Open Web Dir"), () => {
      Util.spawn(CommandConstants.COMMAND_OPEN_WEBDIR);
    });
    this.menu.addAction(_("Launch Web Dir"), () => {
      Util.spawn(CommandConstants.COMMAND_LAUNCH_WEBDIR);
    });
    this.menu.addAction(_("Launch phpMyAdmin"), () => {
      Util.spawn(CommandConstants.COMMAND_LAUNCH_PHPMYADMIN);
    });

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.menu.addAction(_("Edit default php.ini"), () => {
      Util.spawn(CommandConstants.COMMAND_PHP_CONFIG_EDIT);
    });
    this.menu.addAction(_("Edit etc/hosts"), () => {
      Util.spawn(CommandConstants.COMMAND_HOSTS_EDIT);
    });
    this.menu.addAction(_("Edit extra/httpd-vhosts.conf"), () => {
      Util.spawn(CommandConstants.COMMAND_HTTPD_VHOSTS_CONF_EDIT);
    });
    this.menu.addAction(_("Edit httpd.conf"), () => {
      Util.spawn(CommandConstants.COMMAND_HTTPD_CONF_EDIT);
    });
  }
  on_applet_clicked() {
    this.menu.toggle();
  }
}
function main(metadata, orientation, panel_height, instance_id) {
  return new MyApplet(orientation, panel_height, instance_id);
}