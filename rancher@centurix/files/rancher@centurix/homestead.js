const GLib = imports.gi.GLib;
const Lang = imports.lang;
const UUID = "rancher@centurix";
const Util = imports.misc.util;
let AppletUtil, HomesteadYamlReader, TerminalReader;
if (typeof require !== 'undefined') {
	AppletUtil = require('./util');
	HomesteadYamlReader = require('./homestead_yaml_reader');
	TerminalReader = require('./terminal_reader');
} else {
	const AppletDir = imports.ui.appletManager.applets['rancher@centurix'];
	AppletUtil = AppletDir.util;
	HomesteadYamlReader = AppletDir.homestead_yaml_reader;
	TerminalReader = AppletDir.terminal_reader;
}

var STATUS_RUNNING = 0;
var STATUS_SAVED = 1;
var STATUS_POWER_OFF = 2;
var STATUS_NOT_CREATED = 3;
var STATUS_HOMESTEAD_MISSING = 4;
var STATUS_KERNAL_NOT_LOADED = 5;
var STATUS_VAGRANT_OUT_OF_DATE = 6;

/**
 * Homestead/Vagrant manager
 */
function Homestead(project_folder, config_folder, vagrant_cmd, editor) {
	this._init(project_folder, config_folder, vagrant_cmd, editor);
}

Homestead.prototype = {
	_init: function(project_folder, config_folder, vagrant_cmd, editor) {
		this.setProjectFolder(project_folder);
		this.setConfigFolder(config_folder);
		this.setVagrantCmd(vagrant_cmd);
		this.setEditor(editor);

		this._up = null;
		this._status_pause = null;
		this._out = {};
	},

	setProjectFolder: function(folder) {
		this._project_folder = folder;
	},

	setConfigFolder: function(folder) {
		try {
			// If this folder doesn't exist, default to the _project_folder
			if (!GLib.file_test(AppletUtil.resolveHome(folder) + "/Homestead.yaml", GLib.FileTest.EXISTS)) {
				let folder = this._project_folder;
			}
			this._config_folder = folder;
		} catch(e) {
			global.log(UUID + "::setConfigFolder: " + e);
		}
	},

	setVagrantCmd: function(cmd) {
		this._vagrant_cmd = cmd;
	},

	setEditor: function(editor) {
		this._editor = editor;
	},

	checkProjectExists: function() {
		try {
			return GLib.file_test(AppletUtil.resolveHome(this._project_folder) + "/Vagrantfile", GLib.FileTest.EXISTS);
		} catch(e) {
			global.log(UUID + "::checkProjectExists: " + e);
		}
	},

	checkConfigExists: function() {
		try {
			return GLib.file_test(AppletUtil.resolveHome(this._config_folder) + "/Homestead.yaml", GLib.FileTest.EXISTS);
		} catch(e) {
			global.log(UUID + "::checkConfigExists: " + e);
		}
	},

	checkVagrantExists: function() {
		try {
			let [res, list, err, status] = GLib.spawn_command_line_sync("which vagrant");
			return parseInt(status) == 0;
		} catch(e) {
			global.log(UUID + "::checkVagrantExists: " + e);
		}
	},

	exists: function() {
		try {
			return this.checkProjectExists() && this.checkConfigExists() && this.checkVagrantExists();
		} catch(e) {
			global.log(e);
			return false;
		}
	},

	checkStatus: function(callback) {
		try {
			let reader = new TerminalReader.TerminalReader(AppletUtil.resolveHome(this._project_folder), this._vagrant_cmd + ' status', Lang.bind(this, function (command, status, stdout) {
				reader.destroy();
				if (new RegExp('Please change your Vagrant version').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_VAGRANT_OUT_OF_DATE)
					}
				}
				else if (new RegExp('running').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_RUNNING);
					}
				}
				else if (new RegExp('saved').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_SAVED);
					}
				}
				else if (new RegExp('poweroff').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_POWER_OFF);
					}
				}
				else if (new RegExp('not created').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_NOT_CREATED);
					}
				}
				else if (new RegExp('can\'t cd to').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_HOMESTEAD_MISSING);
					}
				}
				else if (new RegExp('VBoxManage --version').test(stdout)) {
					if (typeof callback == 'function') {
						callback(this.exists(), STATUS_KERNAL_NOT_LOADED);
					}
				}
			}));
			reader.executeReader();
		} catch (e) {
			global.log(e);
		}
	},

	vagrantExec: function(command, callback = null) {
		callback = callback;
		try {
			let [exit, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(
				AppletUtil.resolveHome(this._project_folder),
				[this._vagrant_cmd].concat(command),
				null,
				GLib.SpawnFlags.DO_NOT_REAP_CHILD,
				null
			); 
			this._watch = GLib.child_watch_add(
				GLib.PRIORITY_DEFAULT,
				pid,
				Lang.bind(this, function(pid, status, requestObj) {
					GLib.source_remove(this._watch);
					if (typeof callback == 'function') {
						callback();
					}
				})
			);
		} catch(e) {
			global.log(UUID + "::exec(" + command + "): " + e);
		}
	},

	up: function(callback) {
		this.vagrantExec(['up'], callback);
	},

	halt: function(callback) {
		this.vagrantExec(['halt'], callback);
	},

	destroy: function(callback) {
		this.vagrantExec(['destroy', '--force'], callback);
	},

	suspend: function(callback) {
		this.vagrantExec(['suspend'], callback);
	},

	provision: function(callback) {
		this.vagrantExec(['provision'], callback);
	},

	recompile: function(callback) {
		Util.spawnCommandLine("gnome-terminal --working-directory=" + AppletUtil.resolveHome(this._project_folder) + " -x sudo /sbin/rcvboxdrv setup");
	},

	ssh: function() {
		Util.spawnCommandLine("gnome-terminal --working-directory=" + AppletUtil.resolveHome(this._project_folder) + " -x vagrant ssh");
	},

	edit: function() {
		try {
			GLib.spawn_async(
				AppletUtil.resolveHome(this._config_folder),
				[this._editor, AppletUtil.resolveHome(this._config_folder) + '/Homestead.yaml'],
				null,
				GLib.SpawnFlags.DEFAULT,
				null
			);
		} catch(e) {
			global.log(UUID + "::edit: " + e);
		}
	},

	parseConfig: function() {
		try {
			let yaml = new HomesteadYamlReader.HomesteadYamlReader(AppletUtil.resolveHome(this._config_folder) + "/Homestead.yaml");

			return {
				ip: yaml.ip,
				memory: yaml.memory,
				cpu: yaml.cpu,
				provider: yaml.provider,
				sites: yaml.sites,
				databases: yaml.databases
			}
		} catch(e) {
			global.log(e);
		}
	}

}
