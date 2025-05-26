// A applet that shows text produced from a Trilium API script
// Based on todo@threefi
// Author: BeatLink

// Links
// https://github.com/linuxmint/cinnamon/blob/master/files/usr/share/cinnamon/applets/settings-example%40cinnamon.org/settings-schema.json

// Imports
const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop; 		// for repeated updating

// Constants
const UUID = "trilium-api@beatlink";

// Helper function to send HTTP Requests ------------------------------------------------------------------------------
function sendPostRequest(url, postData, callback) {
	let encodedForm = Soup.form_encode_hash(postData)
	let message = Soup.Message.new_from_encoded_form('POST', url, encodedForm);
	let session = new Soup.Session();
	session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
		try {
			let responseBytes = session.send_and_read_finish(result);
			let responseText = ByteArray.toString(ByteArray.fromGBytes(responseBytes));
			callback(null, responseText);
		} catch (error) {
			callback(error, null);
		}
	});
}


// Settings -----------------------------------------------------------------------------------------------------------
class TriliumAPIAppletSettings {

	constructor(instanceId, callback) {
		this._setting_keys = [
			"api_polling_interval",
			"api_location",
			"api_url",
			"api_key",
			"api_endpoint",
			"fetch_action",
			"click_action",
			"prefix_string",
            "suffix_string",
            "text_width",
			"reminder_enabled",
            "reminder_time",
            "reminder_delay",
            "reminder_color",
			"open_on_click_toggle",
			"open_command"
		];
		this.settingsProvider = new Settings.AppletSettings(this, UUID, instanceId);
		for (let setting of this._setting_keys){
			this.settingsProvider.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, setting, setting, callback, null);
		}
	}
}

// Main Applet --------------------------------------------------------------------------------------------------------
class TriliumAPIApplet extends Applet.TextIconApplet {

	constructor(metadata, orientation, panelHeight, instanceId) {
		super(orientation, panelHeight, instanceId);
        this._metadata = metadata;

		// Configure Settings
		this.settings = new TriliumAPIAppletSettings(instanceId, this.settings_callback.bind(this))
		this.base_url = this.settings.api_location == "local" ? "http://localhost" : this.settings.api_url
		this.port = "37840"
		this.endpoint = this.settings.api_endpoint
		this.full_url = `${this.base_url}:${this.port}/custom/${this.endpoint}`

		// Setup menus
		this.toggle_reminder_menu = new PopupMenu.PopupSwitchMenuItem(_("Toggle Reminders"), this.settings.reminder_enabled);
		this.toggle_reminder_menu.connect('activate', this.toggle_reminder.bind(this))
		this._applet_context_menu.addMenuItem(this.toggle_reminder_menu);

		// Setup data persistence
		this.response_data = {
			text: "",
			note_id: ""
		}

		// Start Fetching Text and Updating Reminders																
		try {																					
			this.fetch();																	
			this.update_reminder();
		} catch (e) {
        	global.logError(e);
        }
	}

	settings_callback(){
		this.fetch()
		this.toggle_reminder_menu.setToggleState(this.settings.reminder_enabled);
	}


	// Panel Updating -------------------------------------------------------------------------------------------------
	fetch() {
		let body = { 
			api_key: this.settings.api_key,
			action: this.settings.fetch_action,
		}
		sendPostRequest(this.full_url, body, Lang.bind(this, 
			(err, response) => {
				if (err) {
					this.response_data = {
						text: "",					// The text shown in the panel
						onclick_data: ""			// The data sent when the panel is clicked. Could be used to store a note ID to open for example 
					}
				} else {
					this.response_data = JSON.parse(response)
				}
				Mainloop.timeout_add(1000 * this.settings.api_polling_interval, Lang.bind(this, this.fetch));
				this.update_panel()
			}
		));
	}

	update_panel(){
		if (this.response_data.text){
			let prefix = this.settings.prefix_string
			let suffix = this.settings.suffix_string
			this.set_applet_label(prefix + this.response_data.text.replaceAll('"', "").substring(0, this.settings.text_width) + suffix);
		} else {
			this.set_applet_label("")
		}
	}

	// Reminder Management --------------------------------------------------------------------------------------------
	toggle_reminder() {
		this.settings.reminder_enabled = !this.settings.reminder_enabled
	}

	update_reminder() {
	    if (this.settings.reminder_enabled && this.response_data.text) {
    		this.actor.style = "background-color:" + this.settings.reminder_color;
			if (this.settings.reminder_time >= 100){
				Mainloop.timeout_add(this.settings.reminder_time,  Lang.bind(this, this.cancel_reminder_background));
			}
    		Mainloop.timeout_add((this.settings.reminder_delay * 1000), Lang.bind(this, this.update_reminder));
	    } else {
			Mainloop.timeout_add(1000, Lang.bind(this, this.update_reminder));
		}
	}

	cancel_reminder_background() {
		this.actor.style = "";
	}

	// Opening Trilium ------------------------------------------------------------------------------------------------
	on_applet_clicked(){
		if (this.settings.open_on_click_toggle) {
			let commandLine = this.settings.open_command
			Util.spawnCommandLine(commandLine);				
		}
		let body = { 
			api_key: this.settings.api_key,
			action: this.settings.click_action,
			onclick_data: this.response_data.onclick_data
		}
		sendPostRequest(this.full_url, body, Lang.bind(this, 
			(err, response) => {
				if (err) {
					global.logError("POST request failed: " + err.message);
				}
			}
		));
	}
}

function main(metadata, orientation, panel_height, instanceId) {
	return new TriliumAPIApplet (metadata, orientation, panel_height, instanceId)
}
