import { Logger } from "./logger";
import { WeatherApplet } from "./main";

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

function main(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
	Logger.UpdateInstanceID(instanceId);
    return new WeatherApplet(metadata, orientation, panelHeight, instanceId);
}