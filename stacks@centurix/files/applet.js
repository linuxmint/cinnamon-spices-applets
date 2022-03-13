const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Gtk = imports.gi.Gtk;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "stacks@centurix";

const APPLET_FOLDER = global.userdatadir + "/applets/stacks@centurix/";

const ICON_UP = APPLET_FOLDER + "icons/docker_compose_128x128.png";
const ICON_MISSING = APPLET_FOLDER + "icons/docker_compose_missing_128x128.png";

const DOCKER_COMPOSE_PROJECT_FOLDER = "~/docker-projects";
const DOCKER_COMPOSE_CMD = "docker-compose2";
const EDITOR = 'xed';

/**
 * TODO
 * ====
 * 
 * Add configuration for docker-compose storage area
 * List stacks
 * Add/Remove stacks
 * Up/down a stack
 * Edit a docker-compose.yml file using xed
 * Show the running containers in the stack
 * Show the logs
 * Show the open ports and open browsers
 */

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

	_init: function(orientation, panelHeight, instanceId) {
		Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

		try {
		    this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);

			this._msgsrc = new MessageTray.SystemNotificationSource("Stacks");
			Main.messageTray.add(this._msgsrc);

			this.docker_compose_project_folder = DOCKER_COMPOSE_PROJECT_FOLDER;
			this.docker_compose_cmd = DOCKER_COMPOSE_CMD;
			this.editor = EDITOR;

			global.log(UUID + "::docker_compose_project_folder: " + this.docker_compose_project_folder);
			global.log(UUID + "::docker_compose_cmd: " + this.docker_compose_cmd);
			global.log(UUID + "::editor: " + this.editor);

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
				"editor",
				"editor",
				this.onEditorUpdate
			);
			this.settingsApiCheck();

			this.refreshApplet();
		} catch (e) {
			global.log(UUID + "::_init: " + e);
		}
	},

	onDockerComposeProjectFolderUpdate: function() {
		// Refresh the list of docker compose projects in the menu
		global.log(UUID + "::onDockerComposeProjectFolderUpdate: " + this.docker_compose_project_folder);
        this.updateApplet(true)
	},

	onDockerComposeCmdUpdate: function() {
		// Refresh any docker compose related info based on the selected version of the command
		global.log(UUID + "::onDockerComposeProjectFolderUpdate: " + this.docker_compose_cmd);
        this.updateApplet(true)
	},

	onEditorUpdate: function() {
		global.log(UUID + "::onDockerComposeProjectFolderUpdate: " + this.editor);
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

	newIconMenuItem: function(icon, label, callback, options = {}) {
		try {
			let newItem = new PopupMenu.PopupIconMenuItem(label, icon, St.IconType.FULLCOLOR, options);
			if (callback) {
				newItem.connect("activate", Lang.bind(this, callback));
			}
			return newItem;
		} catch(e) {
			global.log(UUID + "::newIconMenuItem: " + e);
		}
	},

	newMenuItem: function(label, callback, options = {}) {
		let newItem = new PopupMenu.PopupMenuItem(label, options);
		if (callback) {
			newItem.connect("activate", Lang.bind(this, callback));
		}
		return newItem;
	},

	newSwitchMenuItem: function(label, state, callback) {
		let newItem = new PopupMenu.PopupSwitchMenuItem(label, state);
		if (callback) {
			newItem.connect("activate", Lang.bind(this, callback));
		}
		return newItem;
	},

	newSeparator: function() {
		return new PopupMenu.PopupSeparatorMenuItem();
	},

	on_applet_clicked: function(event) {
		this.menu.toggle();
	},

    refreshApplet: function() {
        this.updateApplet()
	},

	notification: function(message) {
		let notification = new MessageTray.Notification(this._msgsrc, "Stacks", message);
		notification.setTransient(true);
		this._msgsrc.notify(notification);
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

	openBrowser: function(url) {
		let matches = (new RegExp('\\("(.*?)"\\)')).exec(url);
		if (matches && matches.length > 0) {
			Main.Util.spawnCommandLine("xdg-open http://" + matches[1]);
		}
	},

	checkDockerComposeExists: function() {
		try {
			let [res, list, err, status] = GLib.spawn_command_line_sync("which " + this.docker_compose_cmd);
			return parseInt(status) == 0;
		} catch(e) {
			global.log(UUID + "::checkDockerComposeExists: " + e);
		}
	},

	openDockerComposeInstructions: function() {
		Main.Util.spawnCommandLine("xdg-open https://docs.docker.com/compose/install/");
	},

	updateApplet: function(status) {
		/*
		 * Draw the main menu.
		 * Check for the existance for docker-compose. If it doesn't exist, alert the user and direct them to installation instructions
		 * 
		 */
		try {
			if (!this.checkDockerComposeExists()) {
				this.set_applet_icon_path(ICON_MISSING);
				this.set_applet_tooltip(_("Stacks: Docker compose missing or not configured."));
				this.notification(_("Docker compose missing or not configured."));

				this.menu.removeAll();
				this.menu.addMenuItem(this.newIconMenuItem('apport', _('Docker-compose not installed'), null, {reactive: false}));
				this.menu.addMenuItem(this.newIconMenuItem('emblem-web', _('Click here for installation instructions'), this.openDockerComposeInstructions));
				this.menu.addMenuItem(this.newIconMenuItem('view-refresh', _('Refresh this menu'), this.refreshApplet));
				return
			}

			this.set_applet_icon_path(ICON_UP);

			this.menu.removeAll();

            this.subMenuSites = new PopupMenu.PopupSubMenuMenuItem(_('Configured Stacks'));

            this.subMenuSites.menu.addMenuItem(this.newIconMenuItem('emblem-web', 'Stack #1', this.openBrowser));
            this.subMenuSites.menu.addMenuItem(this.newIconMenuItem('emblem-web', 'Stack #2', this.openBrowser));
            this.subMenuSites.menu.addMenuItem(this.newIconMenuItem('emblem-web', 'Stack #3', this.openBrowser));
            this.subMenuSites.menu.addMenuItem(this.newIconMenuItem('emblem-web', 'Stack #4', this.openBrowser));
            this.subMenuSites.menu.addMenuItem(this.newIconMenuItem('emblem-web', 'Stack #5', this.openBrowser));

            this.menu.addMenuItem(this.subMenuSites);
            this.menu.addMenuItem(this.newSeparator());
			this.menu.addMenuItem(this.newIconMenuItem('view-refresh', _('Refresh this menu'), this.refreshApplet));

		} catch(e) {
			global.log(UUID + "::updateMenu: " + e);
		}
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new Stacks(metadata, orientation, panelHeight, instanceId);
}
