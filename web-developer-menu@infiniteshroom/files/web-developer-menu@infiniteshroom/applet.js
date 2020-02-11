const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const UUID = "web-developer-menu@infiniteshroom";
const Util = imports.misc.util;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

//applet command constants
var CommandConstants = new function() {
  this.COMMAND_START_APACHE = "sudo service apache2 restart";
  this.COMMAND_STOP_APACHE = "sudo service apache2 stop";
  this.COMMAND_START_MYSQL = "sudo service mysql restart";
  this.COMMAND_STOP_MYSQL = "sudo service mysql stop";
  this.COMMAND_APACHE_CONFIG_EDIT = "sudo gedit /etc/apache2/sites-enabled/000-default";
  this.COMMAND_PHP_CONFIG_EDIT = "sudo gedit /etc/php5/apache2/php.ini";
  this.COMMAND_LAUNCH_PHPMYADMIN = "xdg-open http://localhost/phpmyadmin/";
  this.COMMAND_LAUNCH_WEBDIR = "xdg-open http://localhost/";
  this.COMMAND_OPEN_WEBDIR = "nemo /var/www/";
}


Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function checkService(service) {
  let s=GLib.spawn_async_with_pipes(null, ["pgrep",service], null, GLib.SpawnFlags.SEARCH_PATH,null)
  let c=GLib.IOChannel.unix_new(s[3])

  let [res, pid, in_fd, out_fd, err_fd] =
    GLib.spawn_async_with_pipes(null, ["pgrep",service], null, GLib.SpawnFlags.SEARCH_PATH, null);

  let out_reader = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({fd: out_fd}) });

  let [out, size] = out_reader.read_line(null);

  var result = false;
  if(out != null) {
    result = true;
  }

  return result;
}


function MyApplet(orientation){
  this._init(orientation);
}

MyApplet.prototype = {
  __proto__: Applet.IconApplet.prototype,

  _init: function(orientation){
    Applet.IconApplet.prototype._init.call(this, orientation);
    this.set_applet_icon_symbolic_name("network-server-symbolic");
    this.set_applet_tooltip("WebMenu");

    //setup a new menuManager and add the main context main to the manager

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);


    //add two Toggle buttons one for Apache and one for mysql
    this.apacheEnabledSwitch = new PopupMenu.PopupSwitchMenuItem(_("Apache Web Server"), checkService("apache"));
    this.mysqlEnabledSwitch = new PopupMenu.PopupSwitchMenuItem(_("MySQL Server"), checkService("mysql"))
    this.menu.addMenuItem(this.apacheEnabledSwitch);
    this.menu.addMenuItem(this.mysqlEnabledSwitch);

    //add a separator to separate the toggle buttons and actions
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


    this.menu.addAction(_("Open Web Dir"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_OPEN_WEBDIR);
    });

    this.menu.addAction(_("Launch Web Dir"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_LAUNCH_WEBDIR);
    });

    this.menu.addAction(_("Launch phpMyAdmin"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_LAUNCH_PHPMYADMIN);
    });

    this.menu.addAction(_("Edit default php.ini"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_PHP_CONFIG_EDIT);
    });

    this.menu.addAction(_("Edit Apache Conf"), function(event) {
      Util.spawnCommandLine(CommandConstants.COMMAND_APACHE_CONFIG_EDIT);
    });

    this.apacheEnabledSwitch.connect('toggled', Lang.bind(this, this.onapacheSwitchPressed));
    this.mysqlEnabledSwitch.connect('toggled', Lang.bind(this, this.onmysqlSwitchPressed));
  },

  on_applet_clicked: function(){
    this.menu.toggle();
    this.apacheEnabledSwitch.setToggleState(checkService("apache")); //reload state
    this.mysqlEnabledSwitch.setToggleState(checkService("mysql"));   //reload state
  },

  onapacheSwitchPressed: function(item){
    this.menu.toggle(); //Close before calling gksu
    if(item.state){
      Util.spawnCommandLine(CommandConstants.COMMAND_START_APACHE);
    }

    else {
      Util.spawnCommandLine(CommandConstants.COMMAND_STOP_APACHE);
    }
  },

  onmysqlSwitchPressed: function(item){
    this.menu.toggle(); //Close before calling gksu
    if(item.state){

      Util.spawnCommandLine(CommandConstants.COMMAND_START_MYSQL);
    }

    else {
      Util.spawnCommandLine(CommandConstants.COMMAND_STOP_MYSQL);
    }
  },
}


function main(metadata, orientation){
  let myApplet = new MyApplet(orientation);
  return myApplet;
}
