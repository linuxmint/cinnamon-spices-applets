const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const UUID = "xampp-panel@backids99";
const Util = imports.misc.util;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const AppletDir = imports.ui.appletManager.appletMeta['xampp-panel@backids99'].path;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

//applet command constants
var CommandConstants = {
    COMMAND_START_LINUX_MANAGER: "./.local/share/cinnamon/applets/xampp-panel@backids99/xamp_manager_wrap.sh",
	COMMAND_START_XAMPP: "pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY /opt/lampp/lampp start",
	COMMAND_STOP_XAMPP: "pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY /opt/lampp/lampp stop",
	COMMAND_RESTART_XAMPP: "pkexec env DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY /opt/lampp/lampp restart",
	COMMAND_PHP_CONFIG_EDIT: "xed admin:///opt/lampp/etc/php.ini",
	COMMAND_HOSTS_EDIT: "xed admin:///etc/hosts",
	COMMAND_HTTPD_VHOSTS_CONF_EDIT: "xed admin:///opt/lampp/etc/extra.httpd-vhosts.conf",
	COMMAND_HTTPD_CONF_EDIT: "xed admin:///opt/lampp/etc/httpd.conf",
	COMMAND_LAUNCH_PHPMYADMIN: "xdg-open http://localhost/phpmyadmin/",
	COMMAND_LAUNCH_WEBDIR: "xdg-open http://localhost/",
	COMMAND_OPEN_WEBDIR: "nemo /opt/lampp/htdocs/",
}


function MyApplet(orientation){
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation){
        Applet.IconApplet.prototype._init.call(this, orientation);
        this.set_applet_icon_path( AppletDir + "/" + "icon.png");
        this.set_applet_tooltip(_("Xampp Panel"));

        //setup a new menuManager and add the main context main to the manager

		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

        this.menu.addAction(_("Start XAMPP manager"), function(event) {
                        Util.spawnCommandLineAsync(CommandConstants.COMMAND_START_LINUX_MANAGER,null,null);
		});
		this.menu.addAction(_("XAMPP Start"), function(event) {
                        Util.spawnCommandLineAsync(CommandConstants.COMMAND_START_XAMPP,null,null);
		});

		this.menu.addAction(_("XAMPP Stop"), function(event) {
                        Util.spawnCommandLineAsync(CommandConstants.COMMAND_STOP_XAMPP,null,null);
		});

		this.menu.addAction(_("XAMPP Restart"), function(event) {
                        Util.spawnCommandLineAsync(CommandConstants.COMMAND_RESTART_XAMPP,null,null);
		});

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

		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		this.menu.addAction(_("Edit default php.ini"), function(event) {
						Util.spawnCommandLine(CommandConstants.COMMAND_PHP_CONFIG_EDIT);
		});

		this.menu.addAction(_("Edit etc/hosts"), function(event) {
						Util.spawnCommandLine(CommandConstants.COMMAND_HOSTS_EDIT);
		});

		this.menu.addAction(_("Edit extra.httpd-vhosts.conf"), function(event) {
						Util.spawnCommandLine(CommandConstants.COMMAND_HTTPD_VHOSTS_CONF_EDIT);
		});

		this.menu.addAction(_("Edit httpd.conf"), function(event) {
						Util.spawnCommandLine(CommandConstants.COMMAND_HTTPD_CONF_EDIT);
		});
    },

	on_applet_clicked: function(){
		this.menu.toggle();
    },

}


function main(metadata, orientation){
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
