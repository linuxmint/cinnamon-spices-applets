"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const consts_1 = require("./consts");
const logger_1 = require("./logger");
const main_1 = require("./main");
function main(metadata, orientation, panelHeight, instanceId) {
    imports.gettext.bindtextdomain(consts_1.UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
    imports.gi.Gtk.IconTheme.get_default().append_search_path(metadata.path + "/../icons");
    imports.gi.Gtk.IconTheme.get_default().append_search_path(metadata.path + "/../arrow-icons");
    logger_1.Log.Instance.UpdateInstanceID(instanceId);
    return new main_1.WeatherApplet(metadata, orientation, panelHeight, instanceId);
}
