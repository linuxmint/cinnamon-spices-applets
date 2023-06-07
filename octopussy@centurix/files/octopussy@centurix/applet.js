const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const Gtk = imports.gi.Gtk;
let Util, OctoPrint;
if (typeof require !== 'undefined') {
	OctoPrint = require('./octoprint');
	Util = require('./util');
} else {
	const AppletDir = imports.ui.appletManager.applets['octopussy@centurix'];
	OctoPrint = AppletDir.octoprint;
	Util = AppletDir.util;
}
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "octopussy@centurix";

const CMD_SETTINGS = "cinnamon-settings applets " + UUID;

const APPLET_FOLDER = global.userdatadir + "/applets/" + UUID + "/";

const OCTOPUSSY_ICON = APPLET_FOLDER + "icon.png";
const OCTOPUSSY_UNAVAILABLE_ICON = APPLET_FOLDER + "icon_unavailable.png";
const OCTOPUSSY_STARTING_ICON = APPLET_FOLDER + "icon_starting.png";

const Mainloop = imports.mainloop;

const OCTOPRINT_URL = "http://octopi.local/";
const OCTOPRINT_INTERVAL = 5000;
const OCTOPRINT_API_KEY = "";
const VIDEO_CMD = "vlc --video-on-top --qt-minimal-view --no-video-title";

const setInterval = function(func, ms) {
  let args = [];
  if (arguments.length > 2) {
    args = args.slice.call(arguments, 2);
  }

  let id = Mainloop.timeout_add(ms, () => {
    func.apply(null, args);
    return true; // Repeat
  }, null);

  return id;
};

const clearInterval = function(id) {
  Mainloop.source_remove(id);
};

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

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
function OctoPussy(metadata, orientation, panelHeight, instanceId) {
	this.settings = new Settings.AppletSettings(this, UUID, instanceId);
	this._init(orientation, panelHeight, instanceId);
}

OctoPussy.prototype = {
	__proto__: Applet.TextIconApplet.prototype,

	_init: function(orientation, panelHeight, instanceId) {
		Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

		try {
			this.printerStatus = null;
			this.jobStatus = null;

			this.menuItems = {};

		    this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);

			this._msgsrc = new MessageTray.SystemNotificationSource("OctoPussy");
			Main.messageTray.add(this._msgsrc);

			this.octoprint_url = OCTOPRINT_URL;
			this.octoprint_api_key = OCTOPRINT_API_KEY;
			this.octoprint_interval = OCTOPRINT_INTERVAL;
			this.video_cmd = VIDEO_CMD;

			this.settings.bindProperty(
				Settings.BindingDirection.IN, 
				"octoprintUrl",
				"octoprint_url",
				this.onOctoprintUrlUpdate, 
				null
			);

			this.settings.bindProperty(
				Settings.BindingDirection.IN, 
				"octoprintApiKey",
				"octoprint_api_key",
				this.onOctoprintApiKeyUpdate, 
				null
			);

			this.settings.bindProperty(
				Settings.BindingDirection.IN, 
				"octoprintInterval",
				"octoprint_interval",
				this.onOctoprintIntervalUpdate, 
				null
			);

			this.settings.bindProperty(
				Settings.BindingDirection.IN, 
				"octoprintVideoCommand",
				"video_cmd",
				this.onVideoCmdUpdate, 
				null
			);

			this.settingsApiCheck();
			this.octoprint = new OctoPrint.OctoPrint(this.octoprint_url, this.octoprint_api_key);
			this.set_applet_tooltip(_("OctoPussy: OctoPrint manager."));
			this.set_applet_icon_path(OCTOPUSSY_STARTING_ICON);

			this.setupMenuItems();
			this.interval = setInterval(Lang.bind(this, this.setStatusHeader), this.octoprint_interval * 1000);
			this.setStatusHeader();
			if (this.octoprint_api_key == "") {
				this.Notification("WARNING: OctoPrint API key is blank. Select Configuration to set one.")
			}
		} catch (e) {
			global.log(UUID + "::_init: " + e);
		}
	},

	onOctoprintUrlUpdate: function() {
		this.octoprint.octoprint_url = this.octoprint_url;
	},

	onOctoprintApiKeyUpdate: function() {
		this.octoprint.octoprint_api_key = this.octoprint_api_key;
	},

	onOctoprintIntervalUpdate: function() {
		clearInterval(this.interval);
		this.interval = setInterval(Lang.bind(this, this.setStatusHeader), this.octoprint_interval * 1000);
	},

	onVideoCmdUpdate: function() {
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

	settingsApiCheck: function() {
		const Config = imports.misc.config;
		const SETTINGS_API_MIN_VERSION = 2;

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

	on_applet_clicked: function(event) {
		this.menu.toggle();
	},

	setPrinterStatus(status) {
		if (status == null) {
			this.printerStatus = null;
			this.set_applet_icon_path(OCTOPUSSY_UNAVAILABLE_ICON);
			this.menuItems["change_filament"].actor.visible = false;
			this.menuItems["camera"].actor.visible = false;
			this.menuItems["web"].actor.visible = false;
			this.menuItems["reboot"].actor.visible = false;
			this.menuItems["shutdown"].actor.visible = false;
			this.menuItems["configure"].actor.visible = true;
			this.menuItems["printer_separator"].actor.visible = false;
			return;
		}
		this.printerStatus = status;
		this.set_applet_icon_path(OCTOPUSSY_ICON);
		// this.menuItems["change_filament"].actor.visible = true;
		this.menuItems["camera"].actor.visible = true;
		this.menuItems["web"].actor.visible = true;
		this.menuItems["reboot"].actor.visible = true;
		this.menuItems["shutdown"].actor.visible = true;
		this.menuItems["configure"].actor.visible = true;
		this.menuItems["printer_separator"].actor.visible = true;
	},

	setJobStatus(status) {
		if (status == null) {
			this.jobStatus = null;
			this.menuItems["time_elapsed"].actor.visible = false;
			this.menuItems["time_estimated"].actor.visible = false;
			this.menuItems["time_separator"].actor.visible = false;
			this.menuItems["total_time"].actor.visible = false;

			return;
		}
		// Check for status change and raise toast
		if (this.jobStatus != null) {
			if (this.jobStatus["state"] == "Operational" && status["state"] == "Printing") {
				this.notification(status["job"]["file"]["display"] + " started...");
			}
			if (this.jobStatus["state"] == "Printing" && status["state"] == "Paused") {
				this.notification(status["job"]["file"]["display"] + " paused...");
			}
			if (this.jobStatus["state"] == "Paused" && status["state"] == "Printing") {
				this.notification(status["job"]["file"]["display"] + " resumed...");
			}
			if (this.jobStatus["state"] == "Printing" && status["state"] == "Operational") {
				this.notification(status["job"]["file"]["display"] + " finished...");
			}
			if (this.jobStatus["state"] != "Error" && status["state"] == "Error") {
				this.notification(status["job"]["file"]["display"] + " error!");
			}
		}
		this.jobStatus = status;
		if (status["progress"]["printTime"] != null && ["Printing", "Paused"].includes(status["state"])) {
			if (status["state"] == "Printing") {
				this.menuItems["pause"].actor.visible = true;
				this.menuItems["continue"].actor.visible = false;
			} else {
				this.menuItems["pause"].actor.visible = false;
				this.menuItems["continue"].actor.visible = true;
			}
			let printTime = parseInt(status["progress"]["printTime"], 10);
			let duration = new Date(printTime * 1000).toISOString().substr(11, 8);
			this.menuItems["time_elapsed"].label.text = _('Time lapsed: ' + duration);

			let estTime = parseInt(status["progress"]["printTimeLeft"], 10);
			let total_duration = new Date((printTime + estTime) * 1000).toISOString().substr(11, 8);
			this.menuItems["time_estimated"].label.text = _('Estimated: ' + total_duration);

			this.menuItems["time_elapsed"].actor.visible = true;
			this.menuItems["time_estimated"].actor.visible = true;
			this.menuItems["time_separator"].actor.visible = true;
			this.menuItems["total_time"].actor.visible = false;
		} else if (status["state"] == "Operational" && status["progress"]["completion"] == 100) {
			// Current job is complete
			let printTime = parseInt(status["progress"]["printTime"], 10);
			let duration = new Date(printTime * 1000).toISOString().substr(11, 8);
			this.menuItems["total_time"].label.text = _('Total time: ' + duration);

			this.menuItems["time_elapsed"].actor.visible = false;
			this.menuItems["time_estimated"].actor.visible = false;
			this.menuItems["time_separator"].actor.visible = false;
			this.menuItems["total_time"].actor.visible = true;
		} else {
			this.menuItems["time_elapsed"].actor.visible = false;
			this.menuItems["time_estimated"].actor.visible = false;
			this.menuItems["time_separator"].actor.visible = false;
			this.menuItems["total_time"].actor.visible = false;
		}
		if (status["state"] == "Printing") {
			this.menuItems["pause"].active = true;
			this.menuItems["continue"].active = false;
		} else if (status["state"] == "Paused") {
			this.menuItems["pause"].active = false;
			this.menuItems["continue"].active = true;
		}
	},

	setStatusHeader: function() {
		let status = ""
		if (this.jobStatus != null) {
			if (this.jobStatus["job"]["file"]["size"] == null) {
				status += "(No job) "
			} else if (this.jobStatus["progress"]["completion"] == null) {
				status += "(New job, not started) "
			} else if (this.jobStatus["progress"]["completion"] != null) {
				if (this.jobStatus["state"] == "Printing") {
					status += "⏵ ";
				} else if (this.jobStatus["state"] == "Paused") {
					status += "⏸ ";
				} else if (this.jobStatus["state"] == "Operational") {
					status += "✔ ";
				} else {
					status += "? ";
				}
				status += parseInt(this.jobStatus["progress"]["completion"], 10) + "% ";
			}	
		}
		if (this.printerStatus == null) {
			status = "Connecting...";
		} else {
			for(var key in this.printerStatus["temperature"]) {
				let toolNumber = parseInt(key.slice(-1), 10) + 1;
				if (key == "bed") {
					status += "[🛏" + Math.trunc(this.printerStatus["temperature"][key]["actual"]) + "°]";
				} else if (toolNumber) {
					status += "[🠷" + SUPERSCRIPT.substr(toolNumber, 1) + " " + Math.trunc(this.printerStatus["temperature"][key]["actual"]) + "°]";
				}
			}
		}
		this.set_applet_label(status);
		this.octoprint.getPrinterStatus(Lang.bind(this, this.setPrinterStatus));
		this.octoprint.getJobStatus(Lang.bind(this, this.setJobStatus));
	},

	setupMenuItems: function() {
		this.menuItems["time_elapsed"] = this.newIconMenuItem('appointment-soon', _('Time lapsed: '));
		this.menuItems["time_estimated"] = this.newIconMenuItem('appointment-soon', _('Estimated: '));
		this.menuItems["total_time"] = this.newIconMenuItem('appointment-soon', _('Total time: '));
		this.menuItems["time_separator"] = this.newSeparator();
		this.menuItems["pause"] = this.newIconMenuItem('media-playback-pause', _('Pause current print'), this.pausePrint);
		this.menuItems["continue"] = this.newIconMenuItem('media-playback-start', _('Continue current print'), this.continuePrint);
		this.menuItems["control_separator"] = this.newSeparator();
		this.menuItems["change_filament"] = this.newIconMenuItem('media-playlist-shuffle', _('Change filament'), this.changeFilament);
		this.menuItems["camera"] = this.newIconMenuItem('camera-web', _('Camera monitor'), this.openCamera);
		this.menuItems["web"] = this.newIconMenuItem('emblem-web', _('Open OctoPrint web'), this.openOctoPrint);
		this.menuItems["printer_separator"] = this.newSeparator();
		this.menuItems["reboot"] = this.newIconMenuItem('system-reboot', _('Restart OctoPrint'), this.restartOctoPrint);
		this.menuItems["shutdown"] = this.newIconMenuItem('system-shutdown', _('Shutdown OctoPrint'), this.shutdownOctoPrint);
		this.menuItems["configure"] = this.newIconMenuItem('preferences-desktop', _('Configure...'), this.openConfiguration);

		for(var key in this.menuItems) {
			this.menuItems[key].actor.visible = false;
			this.menu.addMenuItem(this.menuItems[key])
		}
	},

	toggleOne: function() {
		this.menuItems["item_one"].actor.visible = !this.menuItems["item_one"].actor.visible;
	},

	notification: function(message) {
		let notification = new MessageTray.Notification(this._msgsrc, "OctoPussy", message);
		notification.setTransient(true);
		this._msgsrc.notify(notification);
	},

	pausePrint: function() {
		this.octoprint.pause();
	},

	continuePrint: function() {
		this.octoprint.continue();
	},

	changeFilament: function() {
		this.octoprint.changeFilament();
	},

	restartOctoPrint: function() {
		this.octoprint.restartOctoPrint();
	},

	shutdownOctoPrint: function() {
		this.octoprint.shutdownOctoPrint();
	},

	openCamera: function() {
		Main.Util.spawnCommandLine(this.video_cmd.replace("%s", this.octoprint_url + "webcam/?action=stream"));
	},

	openOctoPrint: function() {
		Main.Util.spawnCommandLine("xdg-open " + this.octoprint_url);
	},

	openConfiguration: function() {
		Main.Util.spawnCommandLine(CMD_SETTINGS);
	}
}

function main(metadata, orientation, panelHeight, instanceId) {
	return new OctoPussy(metadata, orientation, panelHeight, instanceId);
}
