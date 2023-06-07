const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

const makeHttpRequest = function(method, uri, cb) {
	uri = uri.replace(/([^:])\/{2,}/, '$1/');
	return new Promise((resolve, reject) => {
		const request = Soup.Message.new(method, uri);
		request.request_headers.append('accept', 'application/json');
		_httpSession.queue_message(request, (_httpSession, message) => {
			if (message.status_code === 200) {
				cb(resolve, message);
			} else {
				reject(`Failed to acquire request (${message.status_code})`);
			}
		});
	});
}

function WakaTimeDisplay(metadata, orientation, panel_height, instance_id) {
	this._init(metadata, orientation, panel_height, instance_id);
}

WakaTimeDisplay.prototype = {
	__proto__: Applet.TextIconApplet.prototype,

	_init: function(metadata, orientation, panel_height, instance_id) {
		Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
		this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

		// bind settings
		this.settings.bindProperty(Settings.BindingDirection.IN,
			"refreshInterval",
			"refreshInterval",
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
		this.set_applet_icon_name(`wakatime-${this.logoColor}`);

		// set text based on apiKey presence
		if (this.apiKey) {
			this.set_applet_label("Loading...");
			this.set_applet_tooltip(_("Click to open your WakaTime Dashboard"));
		} else {
			this.set_applet_label("Missing API Key");
			this.set_applet_tooltip(_("Open the Applet configuration to add your WakaTime API Key"));
		}

		// get this party started!
		this.startUp(true);
	},

	on_applet_clicked: function() {
		// launch dashboard
		Util.spawnCommandLine("gio open 'https://wakatime.com/dashboard'");
	},

	on_settings_changed: function() {
		// set logo color
		this.set_applet_icon_name(`wakatime-${this.logoColor}`);

		// apply new settings
		this.startUp(false);
	},

	startUp: function(setupLoop) {
		if (setupLoop) {
			this.updateLoop(true);
		} else {
			this.updateUI();
		}
	},

	requestStatusBar: function() {
		// make the request to the status bar endpoint
		return makeHttpRequest(
			'GET', `https://wakatime.com/api/v1/users/current/status_bar/today?api_key=${this.apiKey}`,
			(resolve, message) => resolve(JSON.parse(message.response_body.data))
		);
	},

	updateUI: function() {
		// show the time from the status bar endpoint
		this.requestStatusBar().then(
			(data) => this.set_applet_label(' '+data.data.grand_total.digital)
		);
	},

	updateLoop: function() {
		// make initial request and setup the loop
		this.updateUI();
		Mainloop.timeout_add_seconds(this.refreshInterval * 60, this.updateLoop.bind(this));
	},

	openApiKeyPage: function() {
		// open the wakatime api key page via button click in config page
		Util.spawnCommandLine("gio open 'https://wakatime.com/settings/api-key'");
	}
};

function main(metadata, orientation, panel_height, instance_id) {
	return new WakaTimeDisplay(metadata, orientation, panel_height, instance_id);
}