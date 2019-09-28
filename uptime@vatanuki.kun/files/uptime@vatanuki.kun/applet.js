// Imports
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const UUID = "uptime@vatanuki.kun";
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
	return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instane_id) {
	this._init(metadata, orientation, panel_height, instane_id);
}

MyApplet.prototype = {
	__proto__: Applet.TextIconApplet.prototype,
	_timeout: null,

	_init: function (metadata, orientation, panel_height, instane_id) {
		Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instane_id);

		try {
			// Variables needed for the settings
			this._display = "";
			this._prefix = "";
			this._pattern = "";
			this._text_css = "";
			this._show_icon = true;
			this._minimal_mode = false;

			// Setup the settings
			this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);
			this.settings.bind("display", "_display", this.settings_changed);
			this.settings.bind("show_icon", "_show_icon", this.settings_changed);
			this.settings.bind("minimal_mode", "_minimal_mode", this.settings_changed);
			this.settings.bind("prefix", "_prefix", this.settings_changed);
			this.settings.bind("pattern", "_pattern", this.settings_changed);
			this.settings.bind("text_css", "_text_css", this.settings_changed);

			if (this._minimal_mode || this._show_icon)
				// Set a clock icon on the applet
				this.set_applet_icon_symbolic_name("preferences-system-time-symbolic");
			else
				this.hide_applet_icon ();
	
			// Set label style, refresh and hookup a one minute update function
			this._applet_label.set_style(this._text_css);
			this._refresh();
			this._timeout = Mainloop.timeout_add_seconds(60, Lang.bind(this, this._refresh));
		}
		catch (e) {
			global.logError(e);
		}
	},

	_refresh: function () {
		// Get uptime from /proc/uptime
		let timestamps_s = Cinnamon.get_file_contents_utf8_sync('/proc/uptime').split(" ")[0];

		// Calculate uptime years, days, hours and minutes
		let minutes = Math.floor((timestamps_s / 60) % 60);
		let hours = Math.floor((timestamps_s / 3600) % 24);
		let days = Math.floor((timestamps_s / 86400) % 365);
		let years = Math.floor(timestamps_s / 31536000);
		let label_text = "";
		let tooltip_text = _("Uptime : Shows the time that have passed since last reboot.");

		if (this._display == "classic")
			label_text = this._prefix + this.GetClassicDescription(years, days, hours, minutes)
		else if (this._display == "simple")
			label_text = this._prefix + this.GetSimpleDescription(years, days, hours, minutes)
		else if (this._display == "complex")
			label_text = this._prefix + this.GetComplexDescription(years, days, hours, minutes)

		if (this._minimal_mode) {
			tooltip_text = label_text;
			label_text = "";
		}

		// Set application label (including prefix)
		this.set_applet_label(label_text);
		// Set tooltip of the applet
		this.set_applet_tooltip(tooltip_text);

		return true;
	},
	// Get the classic description
	GetClassicDescription: function (years, days, hours, minutes) {
		if (years > 0)
			return years + _("Y") + days + _("D");
		else if (days > 99)
			return days + _("D");
		else if (days > 0) {
			if (hours < 10)
				hours = "0" + hours;
			return days + _("D") + hours + _("h");
		}
		else {
			if (minutes < 10)
				minutes = "0" + minutes;
			return hours + ":" + minutes;
		}
	},
	// Get the new simple description
	GetSimpleDescription: function (years, days, hours, minutes) {
		if (years > 0)
			return years + " " + _("years") + " " + _("and") + " " + days + " " + _("days");
		else if (days > 0)
			return days + " " + _("days") + " " + _("and") + " " + hours + " " + _("hours");
		else if (hours > 0)
			return hours + " " + _("hours") + " " + _("and") + " " + minutes + " " + _("minutes");
		else
			return minutes + " " + _("minutes");
	},
	// Get the complex description
	GetComplexDescription: function (years, days, hours, minutes) {
		let text = this._pattern;
		text = text.replace('%y', years).replace('%d', days).replace('%h', hours).replace('%m', minutes);
		text = text.replace('%H', hours.toString().padStart(2, '0')).replace('%M', minutes.toString().padStart(2, '0'));
		return text;
	},
	// Called when the settings have changed
	settings_changed: function () {

		if (this._minimal_mode || this._show_icon)
			// Set a clock icon on the applet
			this.set_applet_icon_symbolic_name("preferences-system-time-symbolic");
		else
			this.hide_applet_icon ();

		this._applet_label.set_style(this._text_css);

		this._refresh();
	},
	// Refresh the uptime when the application is clicked
	on_applet_clicked: function (event) {
		this._refresh();
	},
	// Clean up when the application is removed from the panel
	on_applet_removed_from_panel: function () {
		if (this._timeout) {
			Mainloop.source_remove(this._timeout);
			this._timeout = null;
		}
	},
};

// Main function
function main(metadata, orientation, panel_height, instance_id) {
	let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
	return myApplet;
}