import { Config } from "./config";
import { UUID } from "./consts";
import { Logger } from "./lib/services/logger";
import { WeatherApplet } from "./main";
import type { Metadata } from "./types";

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

export function main(metadata: Metadata, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number): WeatherApplet {
	// importing custom translations
	imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
	// Manually add the icons to the icon theme - only one icons folder
	imports.gi.Gtk.IconTheme.get_default().append_search_path(metadata.path + "/../icons");
	imports.gi.Gtk.IconTheme.get_default().append_search_path(metadata.path + "/../arrow-icons");

	Logger.UpdateInstanceID(instanceId);

	const config = new Config(instanceId);
	return new WeatherApplet(config, metadata, orientation, panelHeight, instanceId);
}