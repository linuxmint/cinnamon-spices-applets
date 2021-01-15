import { WeatherApplet } from "./main";

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

function main(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
    return new WeatherApplet(metadata, orientation, panelHeight, instanceId);
}