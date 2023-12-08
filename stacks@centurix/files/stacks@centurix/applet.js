const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Gtk = imports.gi.Gtk;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
let Util, DockerCompose;
if (typeof require !== 'undefined') {
	DockerCompose = require('./dockercompose');
	Util = require('./util');
} else {
	const AppletDir = imports.ui.appletManager.applets['stacks@centurix'];
	DockerCompose = AppletDir.docker_compose;
	Util = AppletDir.util;
}

const UUID = "stacks@centurix";
const APPLET_NAME = "Stacks";

const APPLET_FOLDER = global.userdatadir + "/applets/stacks@centurix/";

const ICON_UP = APPLET_FOLDER + "icons/docker_compose_128x128.png";
const ICON_MISSING = APPLET_FOLDER + "icons/docker_compose_missing_128x128.png";

const DOCKER_COMPOSE_PROJECT_FOLDER = "~/docker_projects";
const DOCKER_COMPOSE_CMD = "docker-compose";
const DOCKER_CMD = "docker";
const EDITOR = 'xed';

/**
 * L10n support
 **/
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

/**
 * Applet manager
 **/
function Stacks(metadata, orientation, panelHeight, instanceId) {
	this.settings = new Settings.AppletSettings(this, UUID, instanceId);
	this._init(orientation, panelHeight, instanceId);
}

Stacks.prototype = {
	__proto__: Applet.IconApplet.prototype,

	/************************************************
	 * Bootstrapping the applet
	 ************************************************/

	_init: function(orientation, panelHeight, instanceId) {
		Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

		try {
			// Use default values until we get proper config
			this.docker_compose_project_folder = DOCKER_COMPOSE_PROJECT_FOLDER;
			this.docker_compose_cmd = DOCKER_COMPOSE_CMD;
			this.docker_cmd = DOCKER_CMD;
			this.editor = EDITOR;

			this.createMainMenu(orientation);
			this.attachNotifications();
			this.attachSettings();

			/*
			 * Create and instance of the main docker compose object
			 */
			this.docker_compose = new DockerCompose.DockerCompose(this.docker_compose_cmd, this.docker_cmd, this.docker_compose_project_folder);

			this.refreshApplet();
		} catch (e) {
			global.log(`${UUID}::${(new Error().stack).split('@')[0]}: ${e}`);
		}
	},

	createMainMenu: function(orientation) {
		/*
		 * Attach the main menu to Cinnamon
		 */
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);
	},

	attachNotifications: function() {
		/*
		 * Add a notification source to this tray item
		 */
		this._msgsrc = new MessageTray.SystemNotificationSource(APPLET_NAME);
		Main.messageTray.add(this._msgsrc);
	},

	attachSettings: function() {
		/*
		 * Attach the applets settings
		 */
		this.settings.bindProperty(
			Settings.BindingDirection.IN, 
			"dockerComposeProjectFolder",
			"docker_compose_project_folder",
			this.onDockerComposeProjectFolderUpdate
		);

		this.settings.bindProperty(
			Settings.BindingDirection.IN, 
			"dockerComposeCmd",
			"docker_compose_cmd",
			this.onDockerComposeCmdUpdate
		);

		this.settings.bindProperty(
			Settings.BindingDirection.IN, 
			"dockerCmd",
			"docker_cmd",
			this.onDockerCmdUpdate
		);

		this.settings.bindProperty(
			Settings.BindingDirection.IN, 
			"editor",
			"editor",
			this.onEditorUpdate
		);
		this.settingsApiCheck();
	},

	settingsApiCheck: function() {
		const Config = imports.misc.config;
		const SETTINGS_API_MIN_VERSION = 2;
		const CMD_SETTINGS = "cinnamon-settings applets " + UUID;

		let cinnamonVersion = Config.PACKAGE_VERSION.split('.');
		let majorVersion = parseInt(cinnamonVersion[0]);

		if (majorVersion >= SETTINGS_API_MIN_VERSION) {
			return;
		}

		let mi = new Applet.MenuItem(_("Settings"), Gtk.STOCK_EDIT, Lang.bind(this, function() {
			Util.spawnCommandLine(CMD_SETTINGS)
		}));
		this._applet_context_menu.addMenuItem(mi);
	},

	/************************************************
	 * Applet events
	 ************************************************/

	/* Settings changes */
	onDockerComposeProjectFolderUpdate: function() {
		// Refresh the list of docker compose projects in the menu
		global.log(`${UUID}::${(new Error().stack).split('@')[0]}: ${this.docker_compose_project_folder}`);
        this.updateApplet()
	},

	onDockerComposeCmdUpdate: function() {
		// Refresh any docker compose related info based on the selected version of the command
		global.log(`${UUID}::${(new Error().stack).split('@')[0]}: ${this.docker_compose_cmd}`);
		this.DockerCompose.setDockerComposeCmd(this.docker_compose_cmd);
        this.updateApplet()
	},

	onDockerCmdUpdate: function() {
		// Refresh any docker related info based on the selected version of the command
		global.log(`${UUID}::${(new Error().stack).split('@')[0]}: ${this.docker_cmd}`);
		this.DockerCompose.setDockerCmd(this.docker_cmd);
        this.updateApplet()
	},

	onEditorUpdate: function() {
		global.log(`${UUID}::${(new Error().stack).split('@')[0]}: ${this.editor}`);
	},

	/* Base cinnamon applet events */
	on_applet_clicked: function(event) {
		// Right-click menu popup
		this.menu.toggle();
	},

	/************************************************
	 * Menu item management
	 ************************************************/

	newIconMenuItem: function(icon, label, callback, options = {}, docker_compose_file = 0) {
		try {
			let newItem = new PopupMenu.PopupIconMenuItem(label, icon, St.IconType.FULLCOLOR, options);
			if (docker_compose_file) {
				newItem.docker_compose_file = docker_compose_file;
			}
			if (callback) {
				newItem.connect("activate", Lang.bind(this, callback));
			}
			return newItem;
		} catch(e) {
			global.log(`${UUID}::${(new Error().stack).split('@')[0]}: ${e}`);
		}
	},

	newMenuItem: function(label, callback, options = {}) {
		let newItem = new PopupMenu.PopupMenuItem(label, options);
		if (callback) {
			newItem.connect("activate", Lang.bind(this, callback));
		}
		return newItem;
	},

	newSwitchMenuItem: function(label, state, callback, docker_compose_file) {
		let newItem = new PopupMenu.PopupSwitchMenuItem(label, state);
		if (docker_compose_file) {
			newItem.docker_compose_file = docker_compose_file;
		}
		if (callback) {
			newItem.connect("activate", Lang.bind(this, callback));
		}
		return newItem;
	},

	newSeparator: function() {
		return new PopupMenu.PopupSeparatorMenuItem();
	},

	transitionMenu: function(message, refresh = false) {
		this.set_applet_icon_path(ICON_MISSING);
		this.set_applet_tooltip(message);
		this.menu.removeAll();
		this.menu.addMenuItem(this.newIconMenuItem('dialog-information', message, null, {reactive: false}));
		if (refresh) {
			this.menu.addMenuItem(this.newIconMenuItem('view-refresh', _('Refresh this menu'), this.refreshApplet));
		}
	},

	/************************************************
	 * Behaviour
	 ************************************************/

	notification: function(message) {
		let notification = new MessageTray.Notification(this._msgsrc, APPLET_NAME, message);
		notification.setTransient(true);
		this._msgsrc.notify(notification);
	},

	openDockerComposeInstructions: function() {
		Main.Util.spawnCommandLine("xdg-open https://docs.docker.com/compose/install/");
	},

	dockerComposeToggle: function(event) {
		global.log(`${UUID}::${(new Error().stack).split('@')[0]}: Bringing stack up with ${event.docker_compose_file}`);
		try {
			if (event._switch.state) {
				this.transitionMenu(_("Docker Compose: Bringing Stack up, please wait..."));
				this.docker_compose.up(event.docker_compose_file);
				this.notification(_("Bringing Stack up..."));
				this.refreshApplet();
				return true;
			}
			this.transitionMenu(_("Docker Compose: Taking Stack down, please wait..."));
			this.docker_compose.down(event.docker_compose_file);
			this.notification(_("Taking Stack down..."));
			this.refreshApplet();
		} catch(e) {
			global.log(`${UUID}::${(new Error().stack).split('@')[0]}: ${e}`);
		}
	},

	dockerComposeEdit: function(event) {
		try {
			this.notification(_("Editing docker-compose.yml"));
			Main.Util.spawnCommandLine(this.editor + " " + event.docker_compose_file);
		} catch (e) {
			global.log(UUID + '::dockerComposeLogs: ' + e);
		}
	},

	dockerComposeLogs: function(event) {
		try {
			this.notification(_("Opening logs..."));
			this.docker_compose.logs(event.docker_compose_file).then(logs => {
				// Dump the log out to a temporary file and call xed
				let logFile = Gio.File.new_for_path("/tmp/tmplog.txt")
				if (logFile.query_exists(null))
					logFile.delete(null);

				let readwrite = logFile.create_readwrite(Gio.FileCreateFlags.NONE, null);
				let writeFile = readwrite.get_output_stream();

				writeFile.write(logs, null);
				writeFile.close(null);

				Main.Util.spawnCommandLine(this.editor + " /tmp/tmplog.txt");
			});
		} catch (e) {
			global.log(UUID + '::dockerComposeLogs: ' + e);
		}
	},

	refreshApplet: function() {
        this.updateApplet()
	},

	updateApplet: function() {
		/*
		 * Draw the main menu.
		 * Check for the existance for docker-compose. If it doesn't exist, alert the user and direct them to installation instructions
		 */
		try {
			this.docker_compose.available().then(results => {
				let docker_projects = this.docker_compose.listDockerComposefiles();

				global.log(`${UUID}::${(new Error().stack).split('@')[0]}: Found Docker Compose projects ${docker_projects}`);
	
				this.set_applet_icon_path(ICON_UP);
				this.menu.removeAll();
				this.stacks = [];

				for (let index = 0; index < docker_projects.length; index ++) {
					let stack = new PopupMenu.PopupSubMenuMenuItem(docker_projects[index]);
					this.docker_compose.isUp(docker_projects[index]).then(result => {
						stack.menu.addMenuItem(this.newSwitchMenuItem(_('Status') + " Up", true, this.dockerComposeToggle, docker_projects[index]));
						stack.menu.addMenuItem(this.newIconMenuItem('accessories-text-editor', _('Edit...'), this.dockerComposeEdit, {}, docker_projects[index]));
						stack.menu.addMenuItem(this.newIconMenuItem('text-x-script', _('Logs...'), this.dockerComposeLogs, {}, docker_projects[index]));
					}).catch(result => {
						stack.menu.addMenuItem(this.newSwitchMenuItem(_('Status') + " Down", false, this.dockerComposeToggle, docker_projects[index]));
						stack.menu.addMenuItem(this.newIconMenuItem('accessories-text-editor', _('Edit...'), this.dockerComposeEdit, {}, docker_projects[index]));
					})
	
					this.stacks.push(stack);
					this.menu.addMenuItem(stack);
				}
	
				this.menu.addMenuItem(this.newSeparator());
				this.menu.addMenuItem(this.newIconMenuItem('view-refresh', _('Refresh this menu'), this.refreshApplet));	
			}).catch(results => {
				this.set_applet_icon_path(ICON_MISSING);
				this.set_applet_tooltip(_("Stacks: Docker compose missing or not configured. Right click to configure."));
				this.notification(_("Docker compose missing or not configured. Right click to configure."));

				this.menu.removeAll();
				this.menu.addMenuItem(this.newIconMenuItem('apport', _('Docker-compose not installed'), null, {reactive: false}));
				this.menu.addMenuItem(this.newIconMenuItem('emblem-web', _('Click here for installation instructions'), this.openDockerComposeInstructions));
				this.menu.addMenuItem(this.newIconMenuItem('view-refresh', _('Refresh this menu'), this.refreshApplet));
			})
		} catch(e) {
			global.log(`${UUID}::${(new Error().stack).split('@')[0]}: ${e}`);
		}
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new Stacks(metadata, orientation, panelHeight, instanceId);
}
