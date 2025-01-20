// THIS FILE IS AUTOGENERATED!
const { panelManager } = imports.ui.main
const { getAppletDefinition } = imports.ui.appletManager;
const {radioApplet} = require('./radio-applet');
    
function main(metadata, orientation, panel_height, instance_id) {
    __meta.instanceId = instance_id
    __meta.orientation = orientation

    const appletDefinition = getAppletDefinition({applet_id: instance_id})

    const panel = panelManager.panels.find(pnl => {
        // not using Optional chaining (?.) as this is not supported in Linux Mint 20 which is the lowest supported version
        if (!pnl) return false

        return pnl.panelId === appletDefinition.panelId
    })

    const locationLabel = appletDefinition.location_label

    __meta.panel = panel
    __meta.locationLabel = locationLabel

    return new radioApplet.main();
}