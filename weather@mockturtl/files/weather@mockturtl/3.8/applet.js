const { weatherApplet } = require('./weather-applet');

function main(metadata, orientation, panel_height, instance_id) {
    return weatherApplet.main(metadata, orientation, panel_height, instance_id);
}