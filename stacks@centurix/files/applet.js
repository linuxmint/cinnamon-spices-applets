const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
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

const DOCKER_COMPOSE_PROJECT_FOLDER = "~/docker_projects";
const DOCKER_COMPOSE_CMD = "docker-compose";
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
			global.log(UUID + "::checkDockerComposeExists: checking for " + this.docker_compose_cmd);
			let [res, list, err, status] = GLib.spawn_command_line_sync("which " + this.docker_compose_cmd);
			return parseInt(status) == 0;
		} catch(e) {
			global.log(UUID + "::checkDockerComposeExists: " + e);
		}
	},

	openDockerComposeInstructions: function() {
		this.openBrowser("https://docs.docker.com/compose/install/");
	},

	findDockerComposeFiles: function(currentDir) {
		// Scan through the docker compose project folder for:
		// docker-compose.yaml and docker-compose.yml files
		try {
			let compose_files = [];
			let enumerator = currentDir.enumerate_children("standard::*", Gio.FileQueryInfoFlags.NONE, null);

			let info;
			while ( (info = enumerator.next_file(null)) != null ) {
				if ( info.get_is_hidden() ) continue;
				if ( info.get_file_type() == Gio.FileType.DIRECTORY) {
					let childDir = currentDir.get_child(info.get_name());
					compose_files = compose_files.concat(this.findDockerComposeFiles(childDir));
				} else {
					if ( !info.get_name().endsWith(".yaml") && !info.get_name().endsWith(".yml") ) continue;
					compose_files.push(currentDir.get_child(info.get_name()).get_path());
				}
			}
			return compose_files;
		} catch(e) {
			global.log(UUID + "::findDockerComposeFiles: " + e);
		}
	},

	dockerComposeToggle: function(event) {
		try {
			if (event._switch.state) {
				this.transitionMenu(_("Docker Compose: Bringing Stack up, please wait..."));
				// this.homestead.up(Lang.bind(this, this.refreshApplet));
				this.notification(_("Bringing Stack up..."));
				return true;
			}
			this.transitionMenu(_("Docker Compose: Taking Stack down, please wait..."));
			// this.homestead.halt(Lang.bind(this, this.refreshApplet));
			this.notification(_("Taking Stack down..."));
		} catch(e) {
			global.log(UUID + '::dockerComposeToggle: ' + e);
		}
	},

	dockerComposeSSH: function() {
		this.notification(_("Docker Compose SSH Terminal opened"));
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

			let dir = Gio.file_new_for_path(resolveHome(this.docker_compose_project_folder));
			let docker_projects = this.findDockerComposeFiles(dir);

			global.log(UUID + "::updateMenu: FOUND PROJECTS: " + docker_projects);

			this.set_applet_icon_path(ICON_UP);

			this.menu.removeAll();

			this.stacks = [];

			for (let index = 0; index < docker_projects.length; index ++) {
				let stack = new PopupMenu.PopupSubMenuMenuItem(docker_projects[index]);
				stack.menu.addMenuItem(this.newSwitchMenuItem(_('Status') + " Down", false, this.dockerComposeToggle));

				// stack.menu.addMenuItem(this.newIconMenuItem('system-run', _('Docker Compose Up'), this.homesteadProvision));
				// stack.menu.addMenuItem(this.newIconMenuItem('media-playback-pause', _('Docker Compose Down'), this.homesteadSuspend));
				stack.menu.addMenuItem(this.newIconMenuItem('utilities-terminal', _('SSH Terminal...'), this.dockerComposeSSH));

				this.stacks.push(stack);
				this.menu.addMenuItem(stack);
			}

            // this.menu.addMenuItem(this.subMenuSites);
            this.menu.addMenuItem(this.newSeparator());
			this.menu.addMenuItem(this.newIconMenuItem('view-refresh', _('Refresh this menu'), this.refreshApplet));

		} catch(e) {
			global.log(UUID + "::updateMenu: " + e);
		}
	}
}

function resolveHome(path) {
	let home = GLib.get_home_dir();
	return path.replace('~', home);
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new Stacks(metadata, orientation, panelHeight, instanceId);
}
