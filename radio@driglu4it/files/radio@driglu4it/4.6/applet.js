"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RadioApplet_1 = require("./RadioApplet");
function main(metadata, orientation, panelHeight, instanceId) {
    imports.gettext.bindtextdomain(metadata.uuid, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
    const radioApplet = new RadioApplet_1.RadioApplet(orientation, panelHeight, instanceId);
    radioApplet.init(orientation);
    return radioApplet;
}
