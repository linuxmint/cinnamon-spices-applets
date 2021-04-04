import { RadioApplet } from "./RadioApplet";

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

function main(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
	// importing custom translations
	imports.gettext.bindtextdomain(metadata.uuid, imports.gi.GLib.get_home_dir() + "/.local/share/locale");


	const radioApplet = new RadioApplet(orientation, panelHeight, instanceId)
	radioApplet.init(orientation)

	return radioApplet;
}