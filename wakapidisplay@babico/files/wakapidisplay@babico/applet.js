const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const { HttpLib } = require("./lib/httpLib.js");
const http = new HttpLib();

function WakapiDisplay(metadata, orientation, panel_height, instance_id) {
	this._init(metadata, orientation, panel_height, instance_id);
}

WakapiDisplay.prototype = {
	__proto__: Applet.TextIconApplet.prototype,

	_init: function (metadata, orientation, panel_height, instance_id) {
		Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
		this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

		// bind settings
		this.settings.bindProperty(Settings.BindingDirection.IN,
			"refreshInterval",
			"refreshInterval",
			this.on_settings_changed,
			null);
		this.settings.bindProperty(Settings.BindingDirection.IN,
			"apiLink",
			"apiLink",
			this.on_settings_changed,
			null);
		this.settings.bindProperty(Settings.BindingDirection.IN,
			"apiKey",
			"apiKey",
			this.on_settings_changed,
			null);
		this.settings.bindProperty(Settings.BindingDirection.IN,
			"logoColor",
			"logoColor",
			this.on_settings_changed,
			null);

		// set logo color
		this.set_applet_icon_name(`wakapi-${this.logoColor}`);

		// set text based on apiKey presence
		if (this.apiKey && this.apiLink) {
			this.set_applet_label("Loading...");
			this.set_applet_tooltip(_("Click to open your Wakapi Dashboard"));
		} else {
			this.set_applet_label("Missing API Key or API link");
			this.set_applet_tooltip(_("Open the Applet configuration to add your Wakapi API Key and link"));
		}

		// get this party started!
		this.startUp(true);
	},

	on_applet_clicked: function () {
		// launch dashboard
		Util.spawnCommandLine(`gio open '${this.apiLink}/summary'`);
	},

	on_settings_changed: function () {
		// set logo color
		this.set_applet_icon_name(`wakapi-${this.logoColor}`);

		// apply new settings if apiKey setted correctly
		let len = this.apiKey.length;
		if (len == 36)
			this.startUp(false);
	},

	startUp: function (setupLoop) {
		if (setupLoop) {
			this.updateLoop(true);
		} else {
			this.updateUI();
		}
	},

	requestStatusBar: async function () {
		// make the request to the status bar endpoint
		try {
			const response = await http.LoadJsonAsync(`${this.apiLink}/api/users/current/statusbar/today`, { "api_key": this.apiKey }, null, "GET");
			return response.Data;
		} catch (error) {
			global.logError("[wakapidisplay@babico/applet.js:80]" + error);
			return null;
		}
	},

	updateUI: function () {
		// show the time from the status bar endpoint
		this.requestStatusBar().then(
			(data) => {
				if (data.data === undefined)
					throw new Error(`No data returned from request, err: ${data}`);

				this.set_applet_label(' ' + data.data.grand_total.digital);
			}
		).catch(
			(error) => {
				this.set_applet_label('Error!');
				global.logError("[wakapidisplay@babico/applet.js:91] " + error);
			}
		);
	},

	updateLoop: function () {
		// make initial request and setup the loop
		this.updateUI();
		Mainloop.timeout_add_seconds(this.refreshInterval * 60, this.updateLoop.bind(this));
	},

	openApiKeyPage: function () {
		// open the wakapi api key page via button click in config page
		Util.spawnCommandLine(`gio open '${this.apiLink}/summary'`);
	}
};

function main(metadata, orientation, panel_height, instance_id) {
	return new WakapiDisplay(metadata, orientation, panel_height, instance_id);
}