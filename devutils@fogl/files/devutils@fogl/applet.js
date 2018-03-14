//SIMPLE APLLET For developing

const UUID = "devutils@fogl";
const ICON = "go-down";
const CMD_SETTINGS = "cinnamon-settings applets " + UUID;

const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const ModalDialog = imports.ui.modalDialog;
const Gettext = imports.gettext



Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;

var SettingsKeys = [
	["geany", "geany", "Geany"],
	["eclipse", "eclipse", "Eclipse"],
	["terminal", "select_terminal", "Terminal"],
	["gedit", "gedit", "Gedit"],
	["filezilla", "filezilla", "Filezilla"],
	["mysql_browser", "select_mysql_browser", _("MySQL Browser")],
	["select_terminal", "select_terminal", ""],
	["select_mysql_browser", "select_mysql_browser", ""],
	["path_heidi", "path_heidi", ""],
	["services", "services", ""],
	["services_type", "services_type", ""],
	["config", "menu_block", ""],
	["open_project_dir", "open_project_dir", _("Open Project Directory")]
];

//TODO: Make things dynamically...

var ServiceKeys = [
	["nginx", _("Nginx Web Server"), "nginx"],
	["mysql", _("MySQL Server"), "mysql"],
	["postgresql", _("PostgreSQL Server"), "postgres"],
	//["network-manager", "Network-Manager", "NetworkManager"],
	["apache2", _("Apache Web Server"), "apache2"]
];

var CommandConstants = new function() {
	this.COMMAND_START_NGINX = "gksu service nginx start";
	this.COMMAND_STOP_NGINX = "gksu service nginx stop";
	this.COMMAND_START_MYSQL = "gksu service mysql start";
	this.COMMAND_STOP_MYSQL = "gksu service mysql stop";
	this.COMMAND_START_PGSQL = "gksu service postgresql start";
	this.COMMAND_STOP_PGSQL = "gksu service postgresql stop";
	this.COMMAND_STATUS_NGINX = "service nginx status";
	this.COMMAND_NGINX_CONFIG_EDIT = "gksu gedit /etc/nginx/sites-available/default";
	this.COMMAND_LAUNCH_WEBDIR = "xdg-open http://127.0.0.1/";
	this.COMMAND_OPEN_WEBDIR = "xdg-open /home/wolfman/Projects";
}

function ErrorCommandDialog(){
    this._init();
}

ErrorCommandDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
	ModalDialog.ModalDialog.prototype._init.call(this);
	let label = new St.Label({text: _("ERROR: Could not execute command...\nPlease check your configurations!\n\nOpen applet configuration?\n\n")});
	this.contentLayout.add(label);

	this.setButtons([
	    {
		label: _("Open Applet Settings"),
		action: Lang.bind(this, function(){
                    Util.spawnCommandLine(CMD_SETTINGS);
                    this.close();
		})
	    },
	    {
		label: _("Open Applet Source"),
		action: Lang.bind(this, function(){
                    Util.spawnCommandLine("xdg-open .local/share/cinnamon/applets/" + UUID + "/applet.js" );
                    this.close();
		})
	    },
	    {
		label: _("Cancel"),
		action: Lang.bind(this, function(){
		    this.close();
		})
	    }
	]);
    },
}

function devUtils(metadata, orientation, panelHeight, instanceId) {
	this.settings = new Settings.AppletSettings(this, UUID, instanceId)
	this._init(orientation, panelHeight, instanceId)
}

devUtils.prototype = {
	__proto__: Applet.IconApplet.prototype

,	_init: function(orientation, panelHeight, instanceId) {
		Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {

			for (var i in SettingsKeys) {
				this.settings.bindProperty(Settings.BindingDirection.IN, SettingsKeys[i][0], SettingsKeys[i][0], function () {this["property_changed"](SettingsKeys[i][0])}, null);
			}

            this.set_applet_icon_symbolic_name(ICON);
            this.set_applet_tooltip(_("Development Utils"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            //Context menu
			let settingsMenuItemAppletSettings = new Applet.MenuItem(_("Settings"), Gtk.STOCK_EDIT, Lang.bind(this, function() {
				Util.spawnCommandLine(CMD_SETTINGS);
			}));
			this._applet_context_menu.addMenuItem(settingsMenuItemAppletSettings);
			//Main.createLookingGlass().open();
			let settingsMenuItemLookingGlass = new Applet.MenuItem(_("Looking Glass"), Gtk.STOCK_EDIT, Lang.bind(this, function() {
				Main.createLookingGlass().open();
			}));
			this._applet_context_menu.addMenuItem(settingsMenuItemLookingGlass);

			this.buildMenu();
        }
        catch (e) {
            global.logError(e);
        }
    },

    buildMenu: function() {
		this.menu.removeAll();
		try {
			//Begin Switch Buttons
			if(typeof this.services.actor !== 'undefinded' && (this.services.actor == true || this.services == true) && this.services_type == "buttons") {

				for (var i in ServiceKeys) {
					this[ServiceKeys[i][0] + "EnabledSwitch"] = new PopupMenu.PopupSwitchMenuItem(_(ServiceKeys[i][1]), checkService(ServiceKeys[i][2]));
					this.menu.addMenuItem(this[ServiceKeys[i][0] + "EnabledSwitch"]);

				}
				this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			}
			//End Switch Buttons

            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            //Begin Subemnu Control Items
            if((this.services.actor == true || this.services == true) && this.services_type == "submenu") {

				for (var i in ServiceKeys) {
					this[ServiceKeys[i][0] + "Item"] = new PopupMenu.PopupSubMenuMenuItem(_("Control " + ServiceKeys[i][1]));
					this[ServiceKeys[i][0] + "Item"].menu.addAction(checkService(ServiceKeys[i][0]) == true ? _("  Service is up") : _("  Start service"), eval("function(event) { try {Util.trySpawnCommandLine('gksu service " + ServiceKeys[i][0] + " start') } catch (e) { this.error = new ErrorCommandDialog(); this.error.open(); } }"));
					this[ServiceKeys[i][0] + "Item"].menu.addAction(checkService(ServiceKeys[i][0]) == false ? _("  Service is down") : _("  Stop service"), eval("function(event) { try {Util.trySpawnCommandLine('gksu service " + ServiceKeys[i][0] + " stop') } catch (e) { this.error = new ErrorCommandDialog(); this.error.open(); } }"));
					this.menu.addMenuItem(this[ServiceKeys[i][0] + "Item"]);
				}

				this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			}
            //End Subemnu Control Items

            //BEGIN DYNAMIC MENU
            for (var i in SettingsKeys) {
				if(this[SettingsKeys[i][0]] == true || SettingsKeys[i][2].length == 0) {
					if(SettingsKeys[i][1].substr(0, 6) === "select") {
						var command = this[SettingsKeys[i][1]];
						if(command.substr(0, 4) === "path") {
							var temp = this[command];
							command = temp;
						}
					}
					else {
						var command = SettingsKeys[i][0];
					}
					if(SettingsKeys[i][2].length > 0) {
						this.menu.addAction(_(SettingsKeys[i][2]), eval("(function(event) { try { Util.trySpawnCommandLine('" + command + "'); } catch(e) { this.error = new ErrorCommandDialog(); this.error.open(); } })"));
					}
					else {
						void(0);
					}
				}
			}
             this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            //END DYNAMIC MENU

            //BEGIN STATIC MENU
            if(this.config.actor == true || this.config == true) {
				var open_dir = this.open_project_dir;
				this.menu.addAction(_("Open Project Directory"), function(event) {
					try {
						Util.trySpawnCommandLine(open_dir);
					}
					catch(e) {
						this.error = new ErrorCommandDialog();
						this.error.open();
					}
				});

				this.menu.addAction(_("Launch 127.0.0.1"), function(event) {
					Util.spawnCommandLine(CommandConstants.COMMAND_LAUNCH_WEBDIR);
				});

				this.menu.addAction(_("Edit default nginx config"), function(event) {
					Util.spawnCommandLine(CommandConstants.COMMAND_NGINX_CONFIG_EDIT);
				});
				//this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			}
			//END STATIC MENU

			if((this.services.actor == true || this.services == true) && this.services_type == "buttons") {
				for (var j in ServiceKeys) {
					this[ServiceKeys[j][0] + "EnabledSwitch"].connect("toggled", Lang.bind(this, eval("(function(item) { if(item.state) { Util.spawnCommandLine('gksu service " + ServiceKeys[j][0] + " start'); } else { Util.spawnCommandLine('gksu service " + ServiceKeys[j][0] + " stop'); } })")));
				}
			}
		}
		catch(e) {
			global.logError(e);
		}
	},

	property_changed: function(key) {
        this.actor.key = this.key;
        this.updateMenu();
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
        this.updateMenu();
    },

    updateMenu: function() {
		this.buildMenu();
	},
};

function main(metadata, orientation, panelHeight, instanceId) {
	return new devUtils(metadata, orientation, panelHeight, instanceId)
}

function checkService(service) {

	let s=GLib.spawn_async_with_pipes(null, ["pgrep",service], null, GLib.SpawnFlags.SEARCH_PATH,null)
	let c=GLib.IOChannel.unix_new(s[3])

	let [res, pid, in_fd, out_fd, err_fd] =
	  GLib.spawn_async_with_pipes(
	    null, ["pgrep",service], null, GLib.SpawnFlags.SEARCH_PATH, null);
	let out_reader = new Gio.DataInputStream({ base_stream: new Gio.UnixInputStream({fd: out_fd}) });

	let [out, size] = out_reader.read_line(null);

	var result = false;
	if(out != null) {
		result = true;
	}

	return result;
}
