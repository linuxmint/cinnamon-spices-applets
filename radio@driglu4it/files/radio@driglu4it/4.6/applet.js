const {radioApplet} = require('./radio-applet');
    
function main(metadata, orientation, panel_height, instance_id) {
    return new radioApplet.main({
        orientation,
        panelHeight: panel_height,
        instanceId: instance_id
    });
}