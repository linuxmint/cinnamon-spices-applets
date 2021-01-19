"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./logger");
const main_1 = require("./main");
function main(metadata, orientation, panelHeight, instanceId) {
    logger_1.Log.Instance.UpdateInstanceID(instanceId);
    return new main_1.WeatherApplet(metadata, orientation, panelHeight, instanceId);
}
