const Extension = imports.ui.extension;
// Cinnamon 6.6+ warns on require(); its own importer exposes each module's var and function symbols.
const { weatherApplet } = Extension.getCurrentExtension ? Extension.getCurrentExtension().imports['weather-applet'] : require('./weather-applet');

function main(metadata, orientation, panel_height, instance_id) {
    return weatherApplet.main(metadata, orientation, panel_height, instance_id);
}