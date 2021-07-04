const { weatherApplet } = require('./weather-applet');

function main(metadata, orientation, panel_height, instance_id) {
    return new weatherApplet.main(metadata, orientation, panel_height, instance_id);
}