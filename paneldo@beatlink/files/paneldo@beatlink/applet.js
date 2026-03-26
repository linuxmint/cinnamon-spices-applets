// A simple panel based todo system that shows the first line of a text file
// Based on todo@threefi
// Author: BeatLink

// Imports
const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop; 		// for repeated updating

// Constants
const UUID = "paneldo@beatlink";


class PaneldoApplet extends Applet.TextIconApplet {

	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);
        this._metadata = metadata;

		// Configure Settings
        this._settings_list_editor = null
        this._settings_path_to_file = null
        this._settings_empty_file_message = null
        this._settings_prefix_string = null
        this._settings_suffix_string = null
        this._settings_text_width = null
		this._settings_reminder_enabled = false
        this._settings_reminder_time = null
        this._settings_reminder_delay = null
        this._settings_reminder_color = null

		this._settings_dict = {
            "list_editor": "_settings_list_editor",
            "path_to_file": "_settings_path_to_file",
            "empty_file_message": "_settings_empty_file_message",
            "prefix_string": "_settings_prefix_string",
            "suffix_string": "_settings_suffix_string",
            "text_width": "_settings_text_width",
			"reminder_enabled": "_settings_reminder_enabled",
            "reminder_time": "_settings_reminder_time",
            "reminder_delay": "_settings_reminder_delay",
            "reminder_color": "_settings_reminder_color"
        };

        this.settingsProvider = new Settings.AppletSettings(this, UUID, instanceId);
		for (let setting in this._settings_dict){
			this.settingsProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, setting, this._settings_dict[setting], this.update_panel, null);
		}

		// Setup menu
		this.menuManager = new PopupMenu.PopupMenuManager(this);
		this.menu = new Applet.AppletPopupMenu(this, orientation);
		this.menuManager.addMenu(this.menu);

		this.edit_todos_menu = new PopupMenu.PopupMenuItem(_("Edit Todos"));
		this.edit_todos_menu.connect('activate', this.edit_todo.bind(this))
		this.menu.addMenuItem(this.edit_todos_menu);

		this.toggle_reminder_menu = new PopupMenu.PopupSwitchMenuItem(_("Toggle Reminders"), false);
		this.toggle_reminder_menu.connect('activate', this.toggle_reminder.bind(this))
		this.menu.addMenuItem(this.toggle_reminder_menu);
		

		try {
			this.update_panel();
			this.update_reminder();
		} catch (e) {
        	global.logError(e);
        }
	}

	// Events ---------------------------------------------------------------------------------------------------------
	on_applet_clicked() {
        this.menu.toggle();
	}


	// Functions ------------------------------------------------------------------------------------------------------
	edit_todo(){
		global.logError("Running: " + this._settings_list_editor);
		let commandLine = `${this._settings_list_editor} ${this._settings_path_to_file}`
		Util.spawnCommandLine(commandLine);
	}

	toggle_reminder(){
		this._settings_reminder_enabled = !this._settings_reminder_enabled
	}

	update_panel() {
		let todoList = [];
		let prefix = this._settings_prefix_string
		let suffix = this._settings_suffix_string
		this.file = this._settings_path_to_file;
		if (GLib.file_test(this.file, GLib.FileTest.EXISTS)) {
			let content = GLib.file_get_contents(this.file)
			let isReadSuccessful = content[0];
			if (isReadSuccessful){
				todoList = content[1].toString().split('\n').filter(val => !(typeof val == 'undefined' || val.substring(0,1) == "#" || val == "" || !val.trim().length));
				let currentTodo = todoList.length > 0 ? todoList[0] : this._settings_empty_file_message
				this.set_applet_label(prefix + currentTodo.substring(0, this._settings_text_width) + suffix);
			} else {
				this.set_applet_label(prefix + "Error while opening file" + suffix);
			}
		} else {
			this.set_applet_label(prefix + "File does not exist. Create the file and set path in settings" + suffix);
		}
		Mainloop.timeout_add(1000, Lang.bind(this, this.update_panel));
	}

	update_reminder() {
	    if (this._settings_reminder_enabled) {
    		this.actor.style = "background-color:" + this._settings_reminder_color;
			if (this._settings_reminder_time >= 100){
				Mainloop.timeout_add(this._settings_reminder_time,  Lang.bind(this, this.cancel_reminder_background));
			}
    		Mainloop.timeout_add((this._settings_reminder_delay * 1000), Lang.bind(this, this.update_reminder));
	    } else {
			Mainloop.timeout_add(1000, Lang.bind(this, this.update_reminder));
		}
	}

	cancel_reminder_background() {
		this.actor.style = "";
	}

}

function main(metadata, orientation, panel_height, instanceId) {
	return new PaneldoApplet (metadata, orientation, panel_height, instanceId)
}
