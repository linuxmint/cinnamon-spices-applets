// A simple panel based todo system that shows the first line of a text file
// Based on todo@threefi
// Author: BeatLink

// Imports
const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop; 		// for repeated updating

// Constants
const UUID = "paneldo@beatlink";

function MyApplet(orientation) {
	this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,
	_init: function(orientation,instanceId) {
		this._preferences = {};
		this.settings = new Settings.AppletSettings(this._preferences, UUID, instanceId);
		for (let setting of ["list_editor", "path_to_file", "empty_file_message", "prefix_string", "suffix_string", "text_width", "reminder_time", "reminder_delay", "reminder_color"]){
			this.settings.bindProperty(Settings.BindingDirection.IN, setting, setting,this.on_settings_changed, null);
		}
		Applet.TextIconApplet.prototype._init.call(this, orientation);
   		try {
			this.update_panel();
			this.update_reminder();
		} catch (e) {
        	global.logError(e);
        }
	},
	on_applet_clicked: function(event) {
		Util.spawnCommandLine(this._preferences.list_editor + " " + this._preferences.path_to_file);
	},

	update_panel: function() {
		let todoList = [];
		let prefix = this._preferences.prefix_string
		let suffix = this._preferences.suffix_string
		this.file = this._preferences.path_to_file;
		if (GLib.file_test(this.file, GLib.FileTest.EXISTS)) {
			let content = GLib.file_get_contents(this.file)
			let isReadSuccessful = content[0];
			if (isReadSuccessful){
				todoList = content[1].toString().split('\n').filter(val => !(typeof val == 'undefined' || val.substring(0,1) == "#" || val == "" || !val.trim().length));
				let currentTodo = todoList.length > 0 ? todoList[0] : this._preferences.empty_file_message
				this.set_applet_label(prefix + currentTodo.substring(0, this._preferences.text_width) + suffix);
			} else {
				this.set_applet_label(prefix + "Error while opening file" + suffix);
			}
		} else {
			this.set_applet_label(prefix + "File does not exist. Create the file and set path in settings" + suffix);
		}
		Mainloop.timeout_add(1000, Lang.bind(this, this.update_panel));
	},

	update_reminder: function() {
	    if (this._preferences.reminder_delay > 0) {
    		this.actor.style = "background-color:" + this._preferences.reminder_color;
			if (this._preferences.reminder_time >= 100){
				Mainloop.timeout_add(this._preferences.reminder_time,  Lang.bind(this, this.cancel_reminder_background));
			}
    		Mainloop.timeout_add((this._preferences.reminder_delay * 1000), Lang.bind(this, this.update_reminder));
	    } else {
			Mainloop.timeout_add(1000, Lang.bind(this, this.update_reminder));
		}
	},

	cancel_reminder_background: function() {
		this.actor.style = "";
	}


};

function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(orientation,instanceId);
    return myApplet;
}
