const { MoonPhase } = require('./js/moonPhase');

function main(metadata, orientation, panel_height, instance_id) {
    return new MoonPhase(metadata, orientation, panel_height, instance_id);
}