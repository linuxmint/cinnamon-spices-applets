import { UUID } from "./consts";
import { Logger } from "./lib/logger";
import { WeatherApplet } from "./main";

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

export function main(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
	// importing custom translations
	imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
	// Manually add the icons to the icon theme - only one icons folder
	imports.gi.Gtk.IconTheme.get_default().append_search_path(metadata.path + "/../icons");
	imports.gi.Gtk.IconTheme.get_default().append_search_path(metadata.path + "/../arrow-icons");

	Logger.UpdateInstanceID(instanceId);

	return new WeatherApplet(metadata, orientation, panelHeight, instanceId);
}